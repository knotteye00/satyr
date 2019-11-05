// written by crushv <nik@telekem.net>
// thanks nikki

const net = require('net')
const EventEmitter = require('events')

const socket = new net.Socket()
const emitter = new EventEmitter()

socket.setEncoding('utf8')

socket.on('error', console.error)

function m (text) {
  console.log('> ' + text)
  socket.write(text + '\r\n')
}

var config

socket.once('connect', async () => {
  console.log('Connected')
  m(`PASS ${config.pass} TS 6 :${config.sid}`)
  m('CAPAB QS ENCAP EX IE SAVE EUID')
  m(`SERVER ${config.server} 1 satyr`)
})

function parseLine (l) {
  const colIndex = l.lastIndexOf(':')
  if (colIndex > -1) {
    return {
      params: l.substring(0, colIndex - 1).split(' '),
      query: l.substring(colIndex + 1)
    }
  } else return { params: l.split(' ') }
}

const servers = []
const users = {}
const channels = {}

const globalCommands = {
  // PING :42X
  // params: SID
  PING: l => {
    const { query } = parseLine(l)
    m(`PONG :${query}`)
    emitter.emit('ping')
  },
  // PASS hunter2 TS 6 :42X
  // params: password, 'TS', TS version, SID
  PASS: l => {
    const { query } = parseLine(l)
    // adds a server
    servers.push(query)
  }
}

const serverCommands = {
  // EUID nik 1 1569146316 +i ~nik localhost6.attlocal.net 0::1 42XAAAAAB * * :nik
  // params: nickname, hopcount, nickTS, umodes, username, visible hostname, IP address, UID, real hostname, account name, gecos
  EUID: l => {
    const { params } = parseLine(l)
    const user = {
      nick: params[0],
      nickTS: params[2],
      modes: params[3],
      username: params[4],
      vhost: params[5],
      ip: params[6],
      uid: params[7]
    }
    users[user.uid] = user
  },
  // SJOIN 1569142987 #test +nt :42XAAAAAB
  // params: channelTS, channel, simple modes, opt. mode parameters..., nicklist
  SJOIN: l => {
    const { params, query } = parseLine(l)
    const channel = {
      timestamp: params[0],
      name: params[1],
      modes: params.slice(2).join(' '),
      nicklist: query.split(' ').map(uid => {
        if (/[^0-9a-zA-Z]/.test(uid[0])) return { uid: uid.slice(1), mode: uid[0] }
        else return { uid: uid, mode: '' }
      })
    }
    channels[channel.name] = channel
  }
}

const userCommands = {
  // :42XAAAAAC PRIVMSG #test :asd
  // params: target, msg
  PRIVMSG: (l, source) => {
    const { params, query } = parseLine(l)
    emitter.emit('message', users[source].nick, params[0], query)
  },
  // :42XAAAAAC JOIN 1569149395 #test +
  JOIN: (l, source) => {
    const { params } = parseLine(l)
    channels[params[1]].nicklist.push({
      uid: source
    })
  },
  // :42XAAAAAC PART #test :WeeChat 2.6
  PART: (l, source) => {
    const { params } = parseLine(l)
    for (let i = 0; i < channels[params[0]].nicklist.length; i++) {
      if (channels[params[0]].nicklist[i].uid === source) {
        channels[params[0]].nicklist.splice(i, 1)
        return
      }
    }
  },
  QUIT: (_l, source) => {
    delete users[source]
  }
}

function parser (l) {
  const split = l.split(' ')
  const cmd = split[0]
  const args = split.slice(1).join(' ')
  if (globalCommands[cmd]) return globalCommands[cmd](args)
  if (cmd[0] === ':') {
    const source = cmd.slice(1)
    const subcmd = split[1]
    const subargs = split.slice(2).join(' ')
    if (servers.indexOf(source) > -1 && serverCommands[subcmd]) serverCommands[subcmd](subargs)
    if (users[source] && userCommands[subcmd]) userCommands[subcmd](subargs, source)
  }
}

socket.on('data', data => {
  data.split('\r\n')
    .filter(l => l !== '')
    .forEach(l => {
      console.log('< ' + l)
      parser(l)
    })
})

process.on('SIGINT', () => {
  socket.write('QUIT\r\n')
  process.exit()
})

module.exports.connect = conf => new Promise((resolve, reject) => {
  emitter.once('ping', resolve)
  config = conf
  socket.connect(config.port)
})
module.exports.events = emitter

const genTS = () => Math.trunc((new Date()).getTime() / 1000)
const genUID = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  var uid = ''
  for (let i = 0; i < 6; i++) uid += chars.charAt(Math.floor(Math.random() * chars.length))
  if (users[uid]) return genUID()
  return config.sid + uid
}
const getUID = nick => {
  for (const key in users) if (users[key].nick === nick) return key
}

module.exports.registerUser = nick => {
  const user = {
    nick: nick,
    nickTS: genTS(),
    modes: '+i',
    username: '~' + nick,
    vhost: config.vhost,
    ip: '0::1',
    uid: genUID()
  }
  users[user.uid] = user
  m(`EUID ${user.nick} 1 ${user.nickTS} ${user.modes} ~${user.nick} ${user.vhost} 0::1 ${user.uid} * * :${user.nick}`)
}
module.exports.unregisterUser = nick => {
  const uid = getUID(nick)
  m(`:${uid} QUIT :Quit: satyr`)
  delete users[uid]
}
module.exports.join = (nick, channelName) => {
  const uid = getUID(nick)
  if (!channels[channelName]) {
    const channel = {
      timestamp: genTS(),
      name: channelName,
      modes: '+nt',
      nicklist: [{ uid: uid, mode: '' }]
    }
    channels[channel.name] = channel
  }
  m(`:${uid} JOIN ${channels[channelName].timestamp} ${channelName} +`)
}
module.exports.part = (nick, channelName) => {
  const uid = getUID(nick)
  m(`:${uid} PART ${channelName} :satyr`)
  for (let i = 0; i < channels[channelName].nicklist.length; i++) {
    if (channels[channelName].nicklist[i].uid === uid) {
      channels[channelName].nicklist.splice(i, 1)
      return
    }
  }
}
module.exports.send = (nick, channelName, message) => {
  const uid = getUID(nick)
  m(`:${uid} PRIVMSG ${channelName} :${message}`)
  emitter.emit('message', nick, channelName, message)
}

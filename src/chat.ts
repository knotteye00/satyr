import * as db from "./database";
import {config} from "./config";
import {io} from "./http";
import * as irc from "irc";
import * as discord from "discord.js";
import * as twitch from "dank-twitch-irc";
import * as xmpp from "simple-xmpp";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

var ircClient;
var xmppIgnore: Array<string> = [];
var xmppJoined: Array<string> = [];
var twitchClient;
var twitchArr: Array<string> = [];
var discordClient;
var liveUsers: Array<any>;
var chatIntegration: Array<any>;

async function init() {
	setInterval(updateUsers, 20000);
	setInterval(updateInteg, 60000);
	if(config['chat']['discord']['enabled']){
		discordClient = new discord.Client();
		discordClient.once('ready', ()=>{ console.log('Discord bot ready')});
		discordClient.on('message', async (msg) => {
			if(msg['author']['bot']) return;
			var lu = getUsr(msg['channel']['name'], 'discord')
			for(var i=0;i<lu.length;i++){
				sendAll(lu[i], [msg['author']['username'], await normalizeDiscordMsg(msg)], "discord");
			}
		});
		discordClient.login(config['chat']['discord']['token']);
	}
	if(config['chat']['irc']['enabled']){
		ircClient = new irc.Client(config['chat']['irc']['server'], config['chat']['irc']['nickname'], {
			userName: config['chat']['irc']['username'],
			realName: config['chat']['irc']['realname'],
			port: config['chat']['irc']['port'],
			secure: config['chat']['irc']['tls'],
			sasl: config['chat']['irc']['sasl'],
			password: config['chat']['irc']['password'],
		});
		ircClient.addListener('error', (message) => {
			console.log('IRC Client Error: ', message);
		});
		ircClient.once('registered', () => {
			console.log("IRC Client Ready");
		});
		ircClient.on('message', (from, to, msg) => {
			var lu = getUsr(to, 'irc');
			for(var i=0;i<lu.length;i++){
				sendAll(lu[i], [from, msg], "irc")
			}
		});
	}
	if(config['chat']['xmpp']['enabled']){
		xmpp.on('online', (data) => {
			console.log("XMPP Client Ready");
		});
		xmpp.on('groupchat', function(conference, from, message, stamp) {
			if(xmppIgnore.findIndex((e) => { return e === conference }) !== -1) return false;
			if(from === config['chat']['xmpp']['nickname']) return false;
			console.log(from+'\n'+conference+'\n'+message+'\n'+stamp);
			var lu = getUsr(conference, "xmpp");
			for(var i=0;i<lu.length;i++){
				sendAll(lu[i], [from, message], "xmpp")
			}
		});
		xmpp.connect({
			jid: config['chat']['xmpp']['jid'],
			password: config['chat']['xmpp']['password'],
			host: config['chat']['xmpp']['server'],
			port: config['chat']['xmpp']['port']
		});
	}
	if(config['chat']['twitch']['enabled']){
		twitchClient = new twitch.ChatClient({
			username: config['chat']['twitch']['username'],
			password: config['chat']['twitch']['password'],
		});
		twitchClient.on('ready', () => {
			console.log("Twitch Client Ready");
		});
		twitchClient.on("error", (error) => {
			if (error != null) {
				console.error("Twitch Client Error: ", error);
			}
		});
		twitchClient.on("PRIVMSG", (msg) => {
			if(msg['senderUserID'] === twitchClient['userStateTracker']['globalState']['userID']) return;
			var lu = getUsr(msg['channelName'], 'twitch');
			for(var i=0;i<lu.length;i++){
				sendAll(lu[i], [msg['displayName'], msg['messageText']], "twitch");
			}
		});
		//this library doesn't internally track which channels are currently joined, so we have to do it ourself
		twitchClient.on('JOIN', (m) => {
			if(twitchArr.indexOf(m['channelName']) === -1)
				twitchArr.push(m['channelName']);
		});
		twitchClient.on('PART', (m) => {
			if(twitchArr.indexOf(m['channelName']) !== -1)
				twitchArr.splice(twitchArr.indexOf(m['channelName']), 1);
		});
		twitchClient.connect();
	}
}

async function updateUsers() {
	liveUsers = await db.query('SELECT username FROM user_meta WHERE live=true');
	return;
}

async function updateInteg() {
	if(liveUsers.length === 0) {
		chatIntegration = [];
		if(config['chat']['irc']['enabled']) updateIRCChan();
		if(config['chat']['twitch']['enabled']) updateTwitchChan();
		if(config['chat']['xmpp']['enabled']) updateXmppChan();
		return;
	}
	if(liveUsers.length === 1) {
		chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username='+db.raw.escape(liveUsers[0]['username']));
		if(config['chat']['irc']['enabled']) updateIRCChan();
		if(config['chat']['twitch']['enabled']) updateTwitchChan();
		if(config['chat']['xmpp']['enabled']) updateXmppChan();
		return;
	}
	var qs: string;
	for(var u in liveUsers) {
		qs += db.raw.escape(u['username']) + " OR username=";
	}
	qs = qs.substring(0, qs.length - 13);
	chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username='+qs);
	if(config['chat']['irc']['enabled']) updateIRCChan();
	if(config['chat']['twitch']['enabled']) updateTwitchChan();
	if(config['chat']['xmpp']['enabled']) updateXmppChan();
}

async function sendAll(user: string, msg: Array<string>, src: string) {
	//msg should be an array containing first the username of the user who sent the message
	//followed by the message text
	//[sender, message]

	//user string is the user whose chat is being mirrored

	if(user === null) return;

	if(src !== "irc") sendIRC(getCh(user, "irc"), '['+src.toUpperCase()+']'+msg[0]+': '+msg[1]);
	if(src !== "twitch") sendTwitch(getCh(user, "twitch"), '['+src.toUpperCase()+']'+msg[0]+': '+msg[1]);
	if(src !== "discord") sendDiscord(getCh(user, "discord"), '['+src.toUpperCase()+']'+msg[0]+': '+msg[1]);
	if(src !== "xmpp") sendXMPP(getCh(user, "xmpp"), '['+src.toUpperCase()+']'+msg[0]+': '+msg[1]);
	if(src !== "web") sendWeb(user, ['['+src.toUpperCase()+']'+msg[0], msg[1]]);
}

async function sendIRC(channel: string, msg: string) {
	if(!config['chat']['irc']['enabled']) return;
	if(channel === null) return;
	ircClient.say(channel, msg);
}

async function sendDiscord(channel: string, msg: string) {
	if(!config['chat']['discord']['enabled']) return;
	if(channel === null) return;
	var ch = discordClient.channels.find('name', channel);
	ch.send(msg);
}

async function sendXMPP(channel: string, msg: string) {
	if(!config['chat']['xmpp']['enabled']) return;
	if(channel === null) return;
	xmpp.send(channel, msg, true);
}

async function sendTwitch(channel: string, msg: string) {
	if(!config['chat']['twitch']['enabled']) return;
	if(channel === null) return;
	twitchClient.say(channel, msg);
}

async function sendWeb(channel: string, msg: Array<string>) {
	if(channel === null) return;
	io.to(channel).emit('MSG', {nick: msg[0], msg: msg[1], room: channel});
}

function getCh(usr: string, itype: string): string{
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i]['username'] === usr){
			if(chatIntegration[i][itype].trim() !== "" && chatIntegration[i][itype] !== null) return chatIntegration[i][itype];
		}
	}
	return null;
}

function getUsr(channel: string, ctype: string): Array<string>{
	var list: Array<string> = [];
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i][ctype] === channel) list.push(chatIntegration[i]['username']);
	}
	return list;
}

async function updateIRCChan() {
	var ilist: Array<string> = [];
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i]['irc'].trim() !== "" && chatIntegration[i]['irc'] !== null) {
			ilist.push(chatIntegration[i]['irc']);
		}
	}
	//do this to avoid duplicate channel joins
	//and leave IRC channels when done
	var tmp: Array<string> = ilist.filter(n => !Object.keys(ircClient.chans).includes(n)); //channels to join
	for(var i=0;i<tmp.length;i++){
		ircClient.join(tmp[i]);
	}
	tmp = Object.keys(ircClient.chans).filter(n => !ilist.includes(n)); //channels to part
	for(var i=0;i<tmp.length;i++){
		ircClient.part(tmp[i]);
	}
}

async function updateTwitchChan() {
	var ilist: Array<string> = [];
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i]['twitch'].trim() !== "" && chatIntegration[i]['twitch'] !== null) ilist.push(chatIntegration[i]['twitch']);
	}
	//do this to avoid duplicate channel joins
	//and leave twitch channels when done
	var tmp: Array<string> = ilist.filter(n => !twitchArr.includes(n)); //channels to join
	for(var i=0;i<tmp.length;i++){
		twitchClient.join(tmp[i]);
	}
	tmp = twitchArr.filter(n => !ilist.includes(n)); //channels to part
	for(var i=0;i<tmp.length;i++){
		twitchClient.part(tmp[i]);
	}
}

async function normalizeDiscordMsg(msg): Promise<string>{
	var nmsg: string=msg['content'];
	
	//normalize user mentions
	var uarray = await msg['mentions']['users'].array();
	var karray = await msg['mentions']['users'].keyArray();
	for(var i=0;i<karray.length;i++){
		var usr = uarray[i];
		nmsg = nmsg.replace(new RegExp('<@!'+karray[i]+'>', 'g'), '@'+usr['username']);
	}
	
	//normalize emoji
	var e = nmsg.match(new RegExp('<:\\w+:[0-9]+>', 'g'));
		//<:.+:.+>
	if(e !== null)
	for (var i=0;i<e.length;i++){
		nmsg = nmsg.replace(e[i], e[i].match(new RegExp(':\\w+:', 'g'))[0]);
	}
	//in 10 minutes, I will have forgot what all of this regex does.
	
	//normalize role mentions
	var uarray = await msg['mentions']['roles'].array();
	var karray = await msg['mentions']['roles'].keyArray();
	for(var i=0;i<karray.length;i++){
		var role = uarray[i];
		nmsg = nmsg.replace(new RegExp('<@&'+karray[i]+'>', 'g'), '@'+role['name']);
	}
	
	//normalize channel mentions
	var c = nmsg.match(new RegExp('<#[0-9]+>', 'g'));
	if(c !== null)
	for(var i=0;i<c.length;i++){
		nmsg = nmsg.replace(c[i], '#'+discordClient.channels.get(c[i].match(new RegExp('[0-9]+', 'g'))[0])['name']);
	}

	//fuck me this better work

	return nmsg;
}

function xmppJoin(room: string): void{
	if(xmppJoined.findIndex((e) => { return e === room }) !== -1) return;
	var stanza = new xmpp.Element('presence', {"to": room+'/'+config['chat']['xmpp']['nickname']}).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).c('history', { maxstanzas: 0, seconds: 0});
	xmpp.conn.send(stanza);
	xmppIgnore = xmppIgnore.concat([room]);
	xmpp.join(room+'/'+config['chat']['xmpp']['nickname']);
	xmppJoined = xmppJoined.concat([room]);
	sleep(4000).then(() => {
		xmppIgnore = xmppIgnore.filter((item) => {
			return item !== room;
		});
	});
}

function updateXmppChan(): void{
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i]['xmpp'].trim() !== "" && chatIntegration[i]['xmpp'] !== null) xmppJoin(chatIntegration[i]['xmpp']);
	}
	//we can't really leave channels so I'll come back to that.
}

export { init, sendAll };
import * as express from "express";
import * as njk from "nunjucks";
import * as bodyparser from "body-parser";
import * as fs from "fs";
import * as socketio from "socket.io";
import * as http from "http";
import * as dirty from "dirty";
import * as api from "./api";
import * as db from "./database";
import * as irc from "./irc";

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const store = dirty();
var njkconf;

async function init(satyr: any, port: number, ircconf: any){
	njk.configure('templates', {
		autoescape: true,
		express   : app,
		watch: false
	});
	njkconf ={
		sitename: satyr.name,
		domain: satyr.domain,
		email: satyr.email,
		rootredirect: satyr.rootredirect,
		version: satyr.version
	};
	app.use(bodyparser.json());
	app.use(bodyparser.urlencoded({ extended: true }));
	//site handlers
	app.get('/', (req, res) => {
		res.redirect(njkconf.rootredirect);
	});
	app.get('/about', (req, res) => {
		res.render('about.njk', njkconf);
	});
	app.get('/users', (req, res) => {
		db.query('select username from users').then((result) => {
			res.render('list.njk', Object.assign({list: result}, njkconf));
		});
	});
	app.get('/users/live', (req, res) => {
		db.query('select username,title from user_meta where live=1;').then((result) => {
			res.render('live.njk', Object.assign({list: result}, njkconf));
		});
	});
	app.get('/users/*', (req, res) => {
		db.query('select username,title,about from user_meta where username='+db.raw.escape(req.url.split('/')[2].toLowerCase())).then((result) => {
			if(result[0]){
				/*njkconf.user = result[0].username;
				njkconf.streamtitle = result[0].title;
				njkconf.about = result[0].about;*/
				res.render('user.njk', Object.assign(result[0], njkconf));
			}
			else res.render('404.njk', njkconf);
		});
	});
	app.get('/vods/*', (req, res) => {
		njkconf.user = req.url.split('/')[2].toLowerCase();
		db.query('select username from user_meta where username='+db.raw.escape(req.url.split('/')[2].toLowerCase())).then((result) => {
			if(result[0]){
				fs.readdir('./site/live/'+njkconf.user, {withFileTypes: true} , (err, files) => {
					//if(files) njkconf.list = files.filter(fn => fn.name.endsWith('.mp4'));
					//else njkconf.list = [];
					res.render('vods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, njkconf));
				});
			}
			else res.render('404.njk', njkconf);
		});
	});
	app.get('/register', (req, res) => {
		res.render('registration.njk', njkconf);
	});
	app.get('/profile', (req, res) => {
		res.render('profile.njk', njkconf);
	});
	app.get('/changepwd', (req, res) => {
		res.render('changepwd.njk', njkconf);
	});
	app.get('/changesk', (req, res) => {
		res.render('changesk.njk', njkconf);
	});
	app.get('/chat', (req, res) => {
		res.render('chat.html', njkconf);
	});
	app.get('/help', (req, res) => {
		res.render('help.njk', njkconf);
	});
	//api handlers
	app.post('/api/register', (req, res) => {
		api.register(req.body.username, req.body.password, req.body.confirm).then( (result) => {
			res.send(result);
		});
	});
	app.post('/api/user', (req, res) => {
		api.update(req.body.username, req.body.password, req.body.title, req.body.bio, req.body.record).then((result) => {
			res.send(result);
		});
	});
	app.post('/api/user/password', (req, res) => {
		api.changepwd(req.body.username, req.body.password, req.body.newpassword).then((result) => {
			res.send(result);
		});
	});
	app.post('/api/user/streamkey', (req, res) => {
		api.changesk(req.body.username, req.body.password).then((result) => {
			res.send(result);
		})
	});
	//static files if nothing else matches first
	app.use(express.static('site'));
	//404 Handler
	app.use(function (req, res, next) {
		res.status(404).render('404.njk', njkconf);
	});
	//irc peering
	if(ircconf.enable){
		await irc.connect({
			port: ircconf.port,
			sid: ircconf.sid,
			pass: ircconf.pass,
			server: ircconf.server,
			vhost: ircconf.vhost
		});
		irc.events.on('message', (nick, channel, msg) => {
			io.to(channel).emit('MSG', {nick: nick, msg: msg});
		});
	}
	//socket.io chat logic
	io.on('connection', async (socket) => {
		socket.nick = await newNick(socket);
		if(ircconf.enable) irc.registerUser(socket.nick);
		socket.on('JOINROOM', async (data) => {
			let t: any = await db.query('select username from users where username='+db.raw.escape(data));
			if(t[0]){
				socket.join(data);
				io.to(data).emit('JOINED', {nick: socket.nick});
				if(ircconf.enable) irc.join(socket.nick, data);
			}
			else socket.emit('ALERT', 'Room does not exist');
		});
		socket.on('LEAVEROOM', (data) => {
			socket.leave(data);
			if(ircconf.enable) irc.part(socket.nick, data);
			io.to(data).emit('LEFT', {nick: socket.nick});
		});
		socket.on('disconnecting', (reason) => {
			let rooms = Object.keys(socket.rooms);
			for(let i=1;i<rooms.length;i++){
				if(ircconf.enable) irc.part(socket.nick, rooms[i]);
				io.to(rooms[i]).emit('ALERT', socket.nick+' disconnected');
			}
			if(ircconf.enable) irc.unregisterUser(socket.nick);
			store.rm(socket.nick);
		});
		socket.on('NICK', async (data) => {
			data.nick = data.nick.replace(' ','');
			if(store.get(data.nick)){
				socket.emit('ALERT', 'Nickname is already in use');
				return false;
			}
			let user = await db.query('select username from users where username='+db.raw.escape(data.nick));
			if(user[0]){
				if(!data.password){
					socket.emit('ALERT','Incorrect username or password');
					return false;
				}
				if(await db.validatePassword(data.nick, data.password)){
					chgNick(socket, data.nick);
				}
				else socket.emit('ALERT','Incorrect username or password');
			}
			else {
				chgNick(socket, data.nick);
			}
		});
		socket.on('MSG', (data) => {
			if(data.msg === "") return;
			io.to(data.room).emit('MSG', {nick: socket.nick, msg: data.msg});
			if(ircconf.enable) irc.send(socket.nick, data.room, data.msg);
		});
		socket.on('KICK', (data) => {
			if(socket.nick === data.room){
			//find client with data.nick
				let id: string = store.get(data.nick);
				if(id){
					let target = io.sockets.connected[id];
					io.in(data.room).emit('ALERT', data.nick+' has been kicked.');
					target.disconnect(true);
				}
				else socket.emit('ALERT', 'No such user found.');
			}
			else socket.emit('ALERT', 'Not authorized to do that.');
		});
	});
	server.listen(port);
}

async function newNick(socket) {
	let n: string = 'Guest'+Math.floor(Math.random() * Math.floor(100));
	if(store.get(n)) return newNick(socket);
	else {
		store.set(n, socket.id);
		return n;
	}
}
async function chgNick(socket, nick) {
	let rooms = Object.keys(socket.rooms);
	for(let i=1;i<rooms.length;i++){
		io.to(rooms[i]).emit('ALERT', socket.nick+' is now known as '+nick);
	}
	store.rm(socket.nick);
	store.set(nick, socket.id);
	socket.nick = nick;
}

export { init };
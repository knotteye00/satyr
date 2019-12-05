import * as express from "express";
import * as njk from "nunjucks";
import * as bodyparser from "body-parser";
import * as fs from "fs";
import * as socketio from "socket.io";
import * as http from "http";
import * as cookies from "cookie-parser";
import * as dirty from "dirty";
import * as api from "./api";
import * as db from "./database";
import * as irc from "./irc";
import { readFileSync, writeFileSync } from "fs";
import { JWT, JWK } from "jose";
import { strict } from "assert";
import { parse } from "path";
import { isBuffer } from "util";

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const store = dirty();
var jwkey;
try{
	jwkey = JWK.asKey(readFileSync('./config/jwt.pem'));
} catch (e) {
	console.log("No key found for JWT signing, generating one now.");
	jwkey = JWK.generateSync('RSA', 2048, { use: 'sig' });
	writeFileSync('./config/jwt.pem', jwkey.toPEM(true));
}
var njkconf;

async function init(satyr: any, http: object, ircconf: any){
	njk.configure('templates', {
		autoescape	: true,
		express   	: app,
		watch		: false
	});
	njkconf ={
		sitename: satyr.name,
		domain: satyr.domain,
		email: satyr.email,
		rootredirect: satyr.rootredirect,
		version: satyr.version
	};
	app.use(cookies());
	app.use(bodyparser.json());
	app.use(bodyparser.urlencoded({ extended: true }));
	if(http['hsts']){
		app.use((req, res, next) => {
			res.append('Strict-Transport-Security', 'max-age=5184000');
			next();
		});
	}
	app.disable('x-powered-by');
	//site handlers
	await initSite(satyr.registration);
	//api handlers
	await initAPI();
	//static files if nothing else matches first
	app.use(express.static(satyr.directory));
	//404 Handler
	app.use(function (req, res, next) {
		if(tryDecode(req.cookies.Authorization)) {
			res.status(404).render('404.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.status(404).render('404.njk', njkconf);
		//res.status(404).render('404.njk', njkconf);
	});
	await initChat(ircconf);
	server.listen(http['port']);
}

async function newNick(socket, skip?: boolean) {
	if(socket.handshake.headers['cookie'] && !skip){
		let c = await parseCookie(socket.handshake.headers['cookie']);
		let t = await validToken(c['Authorization']);
		if(t) return t['username'];
	}
	//i just realized how shitty of an idea this is
	let n: string = 'Guest'+Math.floor(Math.random() * Math.floor(1000));
	if(store.get(n)) return newNick(socket, true);
	else {
		store.set(n, socket.id);
		return n;
	}
}

async function chgNick(socket, nick, f?: boolean) {
	let rooms = Object.keys(socket.rooms);
	for(let i=1;i<rooms.length;i++){
		io.to(rooms[i]).emit('ALERT', socket.nick+' is now known as '+nick);
	}
	if(store.get(socket.nick)) store.rm(socket.nick);
	if (!f) store.set(nick, socket.id);
	socket.nick = nick;
}

async function genToken(u: string){
	return await JWT.sign({
		username: u
	}, jwkey, {
		expiresIn: '1 week',
		iat: true,
		kid: false
	});//set jwt
}

async function validToken(t: any){
	try {
		let token = JWT.verify(t, jwkey);
		return token;
	}
	catch (err){
		return false;
	}
}

function tryDecode(t: any){
	try {
		return JWT.decode(t);
	}
	catch (err){
		return false;
	}
}

async function parseCookie(c){
	if(typeof(c) !== 'string' || !c.includes('=')) return {};
	return Object.assign({[c.split('=')[0].trim()]:c.split('=')[1].split(';')[0].trim()}, await parseCookie(c.split(/;(.+)/)[1]));
}

async function initAPI() {
	app.get('/api/users/live', (req, res) => {
		db.query('select username,title from user_meta where live=1 limit 10;').then((result) => {
			res.send(result);
		});
	});
	app.get('/api/users/live/:num', (req, res) => {
		if(req.params.num > 50) req.params.num = 50;
		db.query('select username,title from user_meta where live=1 limit '+req.params.num+';').then((result) => {
			res.send(result);
		});
	});
	app.post('/api/register', (req, res) => {
		api.register(req.body.username, req.body.password, req.body.confirm).then( (result) => {
			if(result[0]) return genToken(req.body.username).then((t) => {
				res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
				res.send(result);
				return;
			});
			res.send(result);
		});
	});
	app.post('/api/user/update', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				return api.update({name: t['username'],
					title: "title" in req.body ? req.body.title : false,
					bio: "bio" in req.body ? req.body.bio : false,
					rec: "record" in req.body ? req.body.record : "NA"
				}).then((r) => {
					res.send(r);
					return;
				});
			}
			else {
				res.send('{"error":"invalid token"}');
				return;
			}
		});
		/*api.update(req.body.username, req.body.password, req.body.title, req.body.bio, req.body.record).then((result) => {
			res.send(result);
		});*/
	});
	app.post('/api/user/password', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				return api.changepwd(t['username'], req.body.password, req.body.newpassword).then((r) => {
					res.send(r);
					return;
				});
			}
			else {
				res.send('{"error":"invalid token"}');
				return;
			}
		});
	});
	app.post('/api/user/streamkey', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				api.changesk(t['username']).then((r) => {
					res.send(r);
				});
			}
			else {
				res.send('{"error":"invalid token"}');
			}
		});
	});
	app.post('/api/login', (req, res) => {
		if(req.cookies.Authorization) validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				if(t['exp'] - 86400 < Math.floor(Date.now() / 1000)){
					return genToken(t['username']).then((t) => {
						res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
						res.send('{"success":""}');
						return;
					});
				}
				else {
					res.send('{"success":"already verified"}');
					return;
				}
			}
			else {
				res.send('{"error":"invalid token"}');
				return;
			}
		});
		else {
			api.login(req.body.username, req.body.password).then((result) => {
				if(!result){
					genToken(req.body.username).then((t) => {
						res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
						res.send('{"success":""}');
					})
				}
				else {
					res.send(result);
				}
			});
		}
	})
}

async function initSite(openReg) {
	app.get('/', (req, res) => {
		res.redirect(njkconf.rootredirect);
	});
	app.get('/about', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			res.render('about.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.render('about.njk',njkconf);
	});
	app.get('/users', (req, res) => {
		db.query('select username from users').then((result) => {
			if(tryDecode(req.cookies.Authorization)) {
				res.render('list.njk', Object.assign({list: result}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
			}
			else res.render('list.njk', Object.assign({list: result}, njkconf));
			//res.render('list.njk', Object.assign({list: result}, njkconf));
		});
	});
	app.get('/users/live', (req, res) => {
		db.query('select username,title from user_meta where live=1;').then((result) => {
			if(tryDecode(req.cookies.Authorization)) {
				res.render('live.njk', Object.assign({list: result}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
			}
			else res.render('live.njk', Object.assign({list: result}, njkconf));
			//res.render('live.njk', Object.assign({list: result}, njkconf));
		});
	});
	app.get('/users/:user', (req, res) => {
		db.query('select username,title,about from user_meta where username='+db.raw.escape(req.params.user)).then((result) => {
			if(result[0]){
				if(tryDecode(req.cookies.Authorization)) {
					res.render('user.njk', Object.assign(result[0], {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
				}
				else res.render('user.njk', Object.assign(result[0], njkconf));
				//res.render('user.njk', Object.assign(result[0], njkconf));
			}
			else if(tryDecode(req.cookies.Authorization)) {
				res.status(404).render('404.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
			}
			else res.status(404).render('404.njk', njkconf);
		});
	});
	app.get('/vods/:user', (req, res) => {
		db.query('select username from user_meta where username='+db.raw.escape(req.params.user)).then((result) => {
			if(result[0]){
				fs.readdir('./site/live/'+result[0].username, {withFileTypes: true} , (err, files) => {
					if(tryDecode(req.cookies.Authorization)) {
						res.render('vods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
					}
					else res.render('vods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, njkconf));
					//res.render('vods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, njkconf));
				});
			}
			else if(tryDecode(req.cookies.Authorization)) {
				res.status(404).render('404.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
			}
			else res.status(404).render('404.njk', njkconf);
		});
	});
	app.get('/login', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			res.redirect('/profile');
		}
		else res.render('login.njk',njkconf);
	});
	app.get('/register', (req, res) => {
		if(tryDecode(req.cookies.Authorization) || !openReg) {
			res.redirect(njkconf.rootredirect);
		}
		else res.render('registration.njk',njkconf);
	});
	app.get('/profile', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			res.render('profile.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.redirect('/login');
	});
	app.get('/changepwd', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			res.render('changepwd.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.redirect('/login');
	});
	app.get('/chat', (req, res) => {
		res.render('chat.html', njkconf);
	});
	app.get('/help', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			res.render('help.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.render('help.njk',njkconf);
	});
}

async function initChat(ircconf: any) {
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
		socket.on('LIST', (data) => {
			let str = "";
			let client;
			io.in(data.room).clients((err, clients) => {
				if(err) throw err;
				if(clients === []) {
					socket.emit('LIST', 'The room is empty.');
					return;
				}
				for(let i=0;i<clients.length;i++) {
					str += io.sockets.connected[clients[i]].nick+', ';
				}
				socket.emit('LIST', str.substring(0, str.length - 2));
			});
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
					chgNick(socket, data.nick, true);
				}
				else socket.emit('ALERT','Incorrect username or password');
			}
			else {
				chgNick(socket, data.nick);
			}
		});
		socket.on('MSG', (data) => {
			if(data.msg === "" || !data.msg.replace(/\s/g, '').length) return;
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
}

export { init };

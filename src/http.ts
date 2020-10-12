import * as express from "express";
import * as njk from "nunjucks";
import * as bodyparser from "body-parser";
import * as socketio from "socket.io";
import * as http from "http";
import * as cookies from "cookie-parser";
import * as dirty from "dirty";
import * as socketSpam from "socket-anti-spam";
import * as api from "./api";
import * as db from "./database";
import * as chatInteg from "./chat";
import { config } from "./config";
import { readdir, readFileSync, writeFileSync } from "fs";
import { JWT, JWK } from "jose";
import { strict } from "assert";
import { parse } from "path";
import { isBuffer } from "util";

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const store = dirty();
var banlist;
var jwkey;
try{
	jwkey = JWK.asKey(readFileSync('./config/jwt.pem'));
	console.log('Found key for JWT signing.');
} catch (e) {
	console.log("No key found for JWT signing, generating one now.");
	jwkey = JWK.generateSync('RSA', 2048, { use: 'sig' });
	writeFileSync('./config/jwt.pem', jwkey.toPEM(true));
}
var njkconf;

async function init(){
	njk.configure('templates', {
		autoescape	: true,
		express   	: app,
		watch		: false
	});
	njkconf = {
		sitename: config['satyr']['name'],
		domain: config['satyr']['domain'],
		email: config['satyr']['email'],
		rootredirect: config['satyr']['rootredirect'],
		version: config['satyr']['version']
	};
	app.use(cookies());
	app.use(bodyparser.json());
	app.use(bodyparser.urlencoded({ extended: true }));
	if(config['http']['hsts']){
		app.use((req, res, next) => {
			res.append('Strict-Transport-Security', 'max-age=5184000');
			next();
		});
	}
	app.disable('x-powered-by');
	//site handlers
	await initSite(config['satyr']['registration']);
	//api handlers
	await initAPI();
	//static files if nothing else matches first
	app.use(express.static(config['http']['directory']));
	//404 Handler
	app.use(function (req, res, next) {
		if(tryDecode(req.cookies.Authorization)) {
			res.status(404).render('404.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.status(404).render('404.njk', njkconf);
		//res.status(404).render('404.njk', njkconf);
	});
	banlist = new dirty('./config/bans.db').on('load', () => {initChat()});
	server.listen(config['http']['port']);
}

async function newNick(socket, skip?: boolean, i?: number) {
	if(socket.handshake.headers['cookie'] && !skip){
		let c = await parseCookie(socket.handshake.headers['cookie']);
		let t = await validToken(c['Authorization']);
		if(t) {
			store.set(t['username'], [].concat(store.get(t['username']), socket.id).filter(item => item !== undefined));
			return t['username'];
		}
	}
	if(!i) i = 10;
	let n: string = 'Guest'+Math.floor(Math.random() * Math.floor(i));
	if(store.get(n)) return newNick(socket, true, Math.floor(i * 10));
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
	if(store.get(socket.nick)) {
		if(Array.isArray(store.get(socket.nick))) store.set(socket.nick, store.get(socket.nick).filter(item => item !== socket.id));
		else store.rm(socket.nick);
	}
	if(f) store.set(nick, [].concat(store.get(nick), [socket.id]).filter(item => item !== undefined));
	else store.set(nick, socket.id);
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
	app.get('/api/instance/info', (req, res) => {
		res.json({
			name: config['satyr']['name'],
			domain: config['satyr']['domain'],
			registration: config['satyr']['registration'],
			version: config['satyr']['version'],
			email: config['satyr']['email']
		});
	});
	app.get('/api/instance/config', (req, res) => {
		res.json({
			rtmp: {
				port: config['rtmp']['port'],
				ping_timeout: config['rtmp']['ping_timeout']
			},
			media: {
				vods: config['media']['record'],
				publicEndpoint: config['media']['publicEndpoint'],
				privateEndpoint: config['media']['privateEndpoint'],
				adaptive: config['transcode']['adaptive']
			}
		});
	});
	app.post('/api/users/live', (req, res) => {
		let qs = 'SELECT username,title FROM user_meta WHERE live=1';

		if(req.body.sort) {
			switch (req.body.sort) {
				case "alphabet":
					qs += ' ORDER BY username ASC';
					break;
				case "alphabet-r":
					qs += ' ORDER BY username DESC';
					break;
				default:
					break;
			}
		}

		if(!req.body.num || req.body.num > 50 || req.body.num === NaN || req.body.num === Infinity || typeof(req.body.num) !== 'number'){
			req.body.num = 10;
		}
		qs += ' LIMIT '+req.body.num;

		if(req.body.page && typeof(req.body.page) === 'number' && req.body.page !== NaN && req.body.page !== Infinity){
			qs += ' OFFSET '+Math.floor(req.body.num * req.body.page);
		}

		db.query(qs+';').then((result) => {
			if(result) res.json({users: result});
			else res.json({error:""});
		});
	});
	app.post('/api/users/all', (req, res) => {
		let qs = 'SELECT username,title,live FROM user_meta';

		if(req.body.sort) {
			switch (req.body.sort) {
				case "alphabet":
					qs += ' ORDER BY username ASC';
					break;
				case "alphabet-r":
					qs += ' ORDER BY username DESC';
					break;
				default:
					break;
			}
		}

		if(!req.body.num || req.body.num > 50 || req.body.num === NaN || req.body.num === Infinity || typeof(req.body.num) !== 'number'){
			req.body.num = 10;
		}
		qs += ' LIMIT '+req.body.num;

		if(req.body.page && typeof(req.body.page) === 'number' && req.body.page !== NaN && req.body.page !== Infinity){
			qs += ' OFFSET '+Math.floor(req.body.num * req.body.page);
		}

		db.query(qs+';').then((result) => {
			if(result) res.json({users: result});
			else res.json({error:""});
		});
	});
	app.post('/api/register', (req, res) => {
		api.register(req.body.username, req.body.password, req.body.confirm).then( (result) => {
			if(result[0]) return genToken(req.body.username).then((t) => {
				res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
				res.json(result);
				return;
			});
			res.json(result);
		});
	});
	app.post('/api/user/update', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				if(req.body.record === "true") req.body.record = true;
				else if(req.body.record === "false") req.body.record = false;
				if(req.body.twitch === "true") req.body.twitch = true;
				else if(req.body.twitch === "false") req.body.twitch = false;
				return api.update({name: t['username'],
					title: "title" in req.body ? req.body.title : false,
					bio: "bio" in req.body ? req.body.bio : false,
					rec: "record" in req.body ? req.body.record : "NA",
					twitch: "twitch" in req.body ? req.body.twitch: "NA",
					twitch_key: "twitch_key" in req.body ? req.body.twitch_key : false
				}).then((r) => {
					res.json(r);
					return;
				});
			}
			else {
				res.json({error:"invalid token"});
				return;
			}
		});
		/*api.update(req.body.username, req.body.password, req.body.title, req.body.bio, req.body.record).then((result) => {
			res.send(result);
		});*/
	});
	app.post('/api/user/update/chat', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				return api.updateChat({name: t['username'],
					discord: "discord" in req.body ? req.body.discord : false,
					xmpp: "xmpp" in req.body ? req.body.xmpp : false,
					twitch: "twitch" in req.body ? req.body.twitch : false,
					irc: "irc" in req.body ? req.body.irc : false,
				}).then((r) => {
					res.json(r);
					return;
				});
			}
			else {
				res.json({error:"invalid token"});
				return;
			}
		});
		/*api.update(req.body.username, req.body.password, req.body.title, req.body.bio, req.body.record).then((result) => {
			res.send(result);
		});*/
	});
	app.post('/api/user/vods/delete', (req, res) => {
		if(req.body.vlist === undefined || req.body.vlist === null || req.body.vlist === []){
			res.json({error:"no vods specified"});
			return;
		}
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				//token is valid, process deletion request
				return api.deleteVODs(req.body.vlist, t['username']).then((r)=> {
					res.json(r)
					return;
				});
			}
			else {
				res.json({error:"invalid token"});
				return;
			}
		});
	});
	app.post('/api/user/password', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				return api.changepwd(t['username'], req.body.password, req.body.newpassword).then((r) => {
					res.json(r);
					return;
				});
			}
			else {
				res.json({error:"invalid token"});
				return;
			}
		});
	});
	app.get('/api/user/streamkey/current', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				db.query('SELECT stream_key FROM users WHERE username='+db.raw.escape(t['username'])).then(o => {
					if(o[0]) res.json(o[0]);
					else res.json({error:""});
				});
			}
			else {
				res.json({error:"invalid token"});
			}
		});
	});
	app.post('/api/user/streamkey', (req, res) => {
		validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				api.changesk(t['username']).then((r) => {
					res.json(r);
				});
			}
			else {
				res.json({error:"invalid token"});
			}
		});
	});
	app.post('/api/login', (req, res) => {
		if(req.cookies.Authorization) validToken(req.cookies.Authorization).then((t) => {
			if(t) {
				if(t['exp'] - 86400 < Math.floor(Date.now() / 1000)){
					return genToken(t['username']).then((t) => {
						res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
						res.json({success:""});
						return;
					});
				}
				else {
					res.json({success:"already verified"});
					return;
				}
			}
			else {
				res.json({error:"invalid token"});
				return;
			}
		});
		else {
			api.login(req.body.username, req.body.password).then((result) => {
				if(!result){
					genToken(req.body.username).then((t) => {
						res.cookie('Authorization', t, {maxAge: 604800000, httpOnly: true, sameSite: 'Lax'});
						res.json({success:""});
					})
				}
				else {
					res.json(result);
				}
			});
		}
	});
	app.get('/api/:user/vods', (req, res) => {
		readdir('./site/live/'+req.params.user, {withFileTypes: true} , (err, files) => {
			if(err) {
				res.json({vods: []});
				return;
			}
			var list = files.filter(fn => fn.name.endsWith('.mp4'));
			res.json({vods: list});
		});
	});
	app.get('/api/:user/config', (req, res) => {
		if(req.cookies.Authorization) validToken(req.cookies.Authorization).then(r => {
			if(r && r['username'] === req.params.user) {
				api.getConfig(req.params.user, true).then(re => {
					res.json(re);
				});
				return;
			}
			else api.getConfig(req.params.user).then(re => {
				res.json(re);
			});
			return;
		});
		else api.getConfig(req.params.user).then(r => {
			res.json(r);
		});
	});
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
	app.get('/vods/:user/manage', (req, res) => {
		db.query('select username from user_meta where username='+db.raw.escape(req.params.user)).then((result) => {
			if(result[0]){
				readdir('./site/live/'+result[0].username, {withFileTypes: true} , (err, files) => {
					if(tryDecode(req.cookies.Authorization)) {
						res.render('managevods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
					}
					else res.redirect('/login');
					//res.render('vods.njk', Object.assign({user: result[0].username, list: files.filter(fn => fn.name.endsWith('.mp4'))}, njkconf));
				});
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
				readdir('./site/live/'+result[0].username, {withFileTypes: true} , (err, files) => {
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
			db.query('select * from user_meta where username='+db.raw.escape(JWT.decode(req.cookies.Authorization)['username'])).then((result) => {
				db.query('select record_flag from users where username='+db.raw.escape(JWT.decode(req.cookies.Authorization)['username'])).then((r2) => {
					res.render('profile.njk', Object.assign({rflag: r2[0]}, {meta: result[0]}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
				});
			});
			//res.render('profile.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
		}
		else res.redirect('/login');
	});
	app.get('/profile/chat', (req, res) => {
		if(tryDecode(req.cookies.Authorization)) {
			db.query('select * from chat_integration where username='+db.raw.escape(JWT.decode(req.cookies.Authorization)['username'])).then((result) => {
				res.render('chat_integ.njk', Object.assign({integ: result[0]}, {auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
			});
			//res.render('chat_integ.njk', Object.assign({auth: {is: true, name: JWT.decode(req.cookies.Authorization)['username']}}, njkconf));
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

async function initChat() {
	//set a cookie to request same nick
	
	//socket.io chat logic
	io.on('connection', async (socket) => {
		socket.nick = await newNick(socket);
		socket.on('JOINROOM', async (data) => {
			let t: any = await db.query('select username from users where username='+db.raw.escape(data));
			if(t[0]){
				if(banlist.get(data) && banlist.get(data)[socket['handshake']['address']]){
					if(Math.floor(banlist.get(data)[socket['handshake']['address']]['time'] + (banlist.get(data)[socket['handshake']['address']]['length'] * 60)) < Math.floor(Date.now() / 1000)){
						banlist.set(data, Object.assign({}, banlist.get(data), {[socket['handshake']['address']]: null}));
					}
					else {
						socket.emit('ALERT', 'You are banned from that room');
						return;
					}
				}
				socket.join(data);
				io.to(data).emit('JOINED', {nick: socket.nick, room: data});
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
			io.to(data).emit('LEFT', {nick: socket.nick, room: data});
			socket.leave(data);
		});
		socket.on('disconnecting', (reason) => {
			let rooms = Object.keys(socket.rooms);
			for(let i=1;i<rooms.length;i++){
				io.to(rooms[i]).emit('ALERT', socket.nick+' disconnected');
			}
			if(Array.isArray(store.get(socket.nick))) {
				store.set(socket.nick, store.get(socket.nick).filter(item => item !== socket.id))
				if(store.get(socket.nick) !== [])
				return;
			}
			store.rm(socket.nick);
		});
		socket.on('NICK', async (data) => {
			data.nick = data.nick.replace(' ','');
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
				if(store.get(data.nick)){
					socket.emit('ALERT', 'Nickname is already in use');
					return false;
				}
				chgNick(socket, data.nick);
			}
		});
		socket.on('MSG', (data: object) => {
			if(data['msg'] === "" || !data['msg'].replace(/\s/g, '').length) return;
			if(socket.rooms[data['room']]) io.to(data['room']).emit('MSG', {nick: socket.nick, msg: data['msg'], room: data['room']});
			chatInteg.sendAll(data['room'], [socket.nick, data['msg']], "web");
		});
		socket.on('KICK', (data) => {
			if(socket.nick === data.room){
			//find client with data.nick
				let id: string = store.get(data.nick);
				if(id){
					if(Array.isArray(id)) {
						for(let i=0;i<id.length;i++){
							io.sockets.connected[id[i]].leave(data.room);
						}
						io.in(data.room).emit('ALERT', data.nick+' has been kicked.');
						return;
					}
					let target = io.sockets.connected[id];
					io.in(data.room).emit('ALERT', data.nick+' has been kicked.');
					target.leave(data.room);
				}
				else socket.emit('ALERT', 'No such user found.');
			}
			else socket.emit('ALERT', 'Not authorized to do that.');
		});
		socket.on('BAN', (data: Object) => {
			if(socket.nick === data['room']){
				let id: string = store.get(data['nick']);
				if(id){
					if(Array.isArray(id)) {
						for(let i=0;i<id.length;i++){
							let target = io.sockets.connected[id[i]];
							if(typeof(data['time']) === 'number' && (data['time'] !== 0 && data['time'] !== NaN)) banlist.set(data['room'], Object.assign({}, banlist.get(data['room']), {[target.ip]: {time: Math.floor(Date.now() / 1000), length: data['time']}}));
							else banlist.set(data['room'], Object.assign({}, banlist.get(data['room']), {[target.ip]: {time: Math.floor(Date.now() / 1000), length: 30}}));
							target.leave(data['room']);
						}
						io.to(data['room']).emit('ALERT', data['nick']+' was banned.');
						return;
					}
					let target = io.sockets.connected[id];
					if(typeof(data['time']) === 'number' && (data['time'] !== 0 && data['time'] !== NaN)) banlist.set(data['room'], Object.assign({}, banlist.get(data['room']), {[target.ip]: {time: Math.floor(Date.now() / 1000), length: data['time']}}));
					else banlist.set(data['room'], Object.assign({}, banlist.get(data['room']), {[target.ip]: {time: Math.floor(Date.now() / 1000), length: 30}}));
					target.leave(data['room']);
					io.to(data['room']).emit('ALERT', target.nick+' was banned.');
				}
				else socket.emit('ALERT', 'No such user found.');
			}
			else socket.emit('ALERT', 'Not authorized to do that.');
		});
		socket.on('UNBAN', (data: Object) => {
			if(socket.nick === data['room']){
				if(banlist.get(data['room']) && banlist.get(data['room'])[data['ip']]){
					banlist.set(data['room'], Object.assign({}, banlist.get(data['room']), {[data['ip']]: null}));
					socket.emit('ALERT', data['ip']+' was unbanned.');
				}
				else
				socket.emit('ALERT', 'That IP is not banned.');
			}
			else socket.emit('ALERT', 'Not authorized to do that.');
		});
		socket.on('LISTBAN', (data: Object) => {
			if(socket.nick === data['room']){
				if(banlist.get(data['room'])) {
					let bans = Object.keys(banlist.get(data['room']));
					let str = '';
					for(let i=0;i<bans.length;i++){
						str += bans[i]+', ';
					}
					socket.emit('ALERT', 'Banned IP adresses: '+str.substring(0, str.length - 2));
					return;
				}
				socket.emit('ALERT', 'No one is banned from this room');
			}
			else socket.emit('ALERT', 'Not authorized to do that.');
		});
	});
	//socketio spam
	const socketAS = new socketSpam({
		banTime:            20,
		kickThreshold:      10,
		kickTimesBeforeBan: 3,
		banning:            true,
		io:                 io
	});
	socketAS.event.on('ban', (socket) => {
		let rooms = Object.keys(socket.rooms);
		for(let i=1;i<rooms.length;i++){
			io.to(rooms[i]).emit('ALERT', socket.nick+' was banned.');
		}
		store.rm(socket.nick);
	});
}

export { init, io };

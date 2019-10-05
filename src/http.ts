import * as express from "express";
import * as njk from "nunjucks";
import * as bodyparser from "body-parser";
import * as fs from "fs";
import * as api from "./api";
import * as db from "./database";

var app = express();
var njkconf;

function init(satyr: any){
	app.listen(8000);
	njk.configure('templates', {
		autoescape: true,
		express   : app,
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
			njkconf.list = result;
			res.render('list.njk', njkconf);
			njkconf.list = '';
		});
	});
	app.get('/users/live', (req, res) => {
		db.query('select username,title from user_meta where live=1;').then((result) => {
			njkconf.list = result;
			res.render('live.njk', njkconf);
			njkconf.list = '';
		});
	});
	app.get('/users/*', (req, res) => {
		njkconf.user = req.url.split('/')[2].toLowerCase();
		db.query('select title,about from user_meta where username='+db.raw.escape(njkconf.user)).then((result) => {
			if(result[0]){
				njkconf.streamtitle = result[0].title;
				njkconf.about = result[0].about;
				res.render('user.njk', njkconf);
			}
			else res.render('404.njk', njkconf);
		});
	});
	app.get('/vods/*', (req, res) => {
		njkconf.user = req.url.split('/')[2].toLowerCase();
		db.query('select username from user_meta where username='+db.raw.escape(njkconf.user)).then((result) => {
			if(result[0]){
				fs.readdir('./site/live/'+njkconf.user, {withFileTypes: true} , (err, files) => {
					if(files) njkconf.list = files.filter(fn => fn.name.endsWith('.mp4'));
					else njkconf.list = [];
					res.render('vods.njk', njkconf);
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
}

export { init };
import * as express from "express";
import * as njk from "nunjucks";
import * as bodyparser from "body-parser";
import * as api from "./api";
import * as db from "./database";

var app = express();
var njkconf;

function init(satyr: any){
	app.listen(8000);
	njk.configure('templates', {
		autoescape: true,
		express   : app,
		watch: true
	});
	njkconf ={
		sitename: satyr.name,
		domain: satyr.domain,
		email: satyr.email,
		user: '',
		streamtitle: '',
	};
	app.use(bodyparser.json());
	app.use(bodyparser.urlencoded({ extended: true }));
	app.get('/', (req, res) => {
		res.render('index.njk', njkconf);
	});
	app.get('/about', (req, res) => {
		res.render('about.njk', njkconf);
	});
	app.get('/users/*', (req, res) => {
		njkconf.user = req.url.split('/')[2].toLowerCase();
		res.render('user.njk', njkconf);
	});
	app.get('/registration', (req, res) => {
		res.render('registration.njk', njkconf);
	});
	app.post('/api/register', (req, res) => {
		api.register(req.body.username, req.body.password, req.body.streamer).then( (result) => {
			res.send({"error":""});
		});
	});
	app.use(express.static('site'));
}

export { init };
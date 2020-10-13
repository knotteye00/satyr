import {parseAsYaml as parse} from "parse-yaml";
import {readFileSync as read} from "fs";
try {
	var localconfig: Object = parse(read('config/config.yml'));
	console.log('Config file found.');
} catch (e) {
	console.log('No config file found. Exiting.');
	process.exit();
}
const config: Object = {
	crypto: Object.assign({ 
		saltRounds: 12 
	}, localconfig['crypto']),
	satyr: Object.assign({
	   name: '',
	   domain: '',
	   registration: false,
	   email: null,
	   restrictedNames: [ 'live', 'user', 'users', 'register', 'login', 'invite' ],
	   rootredirect: '/users/live',
	   version: process.env.npm_package_version,
	 }, localconfig['satyr']),
	database: Object.assign({
	   host: 'localhost',
	   user: 'satyr',
	   password: '',
	   database: 'satyr_db',
	   connectionLimit: '50',
	   connectionTimeout: '1000',
	   insecureAuth: false,
	   debug: false }, localconfig['database']),
	rtmp: Object.assign({
	  port: 1935,
	  chunk_size: 6000,
	  gop_cache: true,
	  ping: 30,
	  ping_timeout: 60 }, localconfig['rtmp']),
	http: Object.assign({ 
		hsts: false, directory: './site', port: 8000 
	}, localconfig['http']),
	media: Object.assign({
	   record: false,
	   publicEndpoint: 'live',
	   privateEndpoint: 'stream',
	   ffmpeg: ''
	}, localconfig['media']),
	transcode: Object.assign({ 
		adapative: false, 
		variants: 3, 
		format: 'dash',
		inputflags: null,
		outputflags: null
	}, localconfig['transcode']),
	chat: {
		irc: Object.assign({
			enabled: false,
			server: null,
			port: 6667,
			tls: false,
			nickname: 'SatyrChat',
			userName: 'SatyrChat',
			sasl: false,
			password: null
		}, localconfig['chat']['irc']),

		discord: Object.assign({
			enabled: false,
			token: null
		}, localconfig['chat']['discord']),

		xmpp: Object.assign({
			enabled: false,
			server: null,
			port: 5222,
			nickname: 'SatyrChat',
			username: 'SatyrChat'
		}, localconfig['chat']['xmpp']),

		twitch: Object.assign({
			enabled: false,
			username: null,
			token: null
		}, localconfig['chat']['twitch'])
	},
	twitch_mirror: Object.assign({
		enabled: false,
		ingest: null
	}, localconfig['twitch_mirror'])
};
export { config };
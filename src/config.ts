import {parseAsYaml as parse} from "parse-yaml";
import {readFileSync as read} from "fs";
var localconfig: Object = parse(read('config/config.yml'));
const config: Object = {
	crypto: Object.assign({ 
		saltRounds: 12 
	}, localconfig['crypto']),
	satyr: Object.assign({
	   name: '',
	   domain: '',
	   registration: false,
	   restrictedNames: [ 'live' ],
	   rootredirect: '/users/live',
	   version: process.env.npm_package_version,
	 }, localconfig['satyr']),
	ircd: Object.assign({
	   port: 6667,
	}, localconfig['ircd']),
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
		format: 'dash' 
	}, localconfig['transcode'])
};
export { config };
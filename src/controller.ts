import * as mediaserver from "./server";
import * as ircd from "./ircd";
import * as db from "./database";

const mediaconfig: any = {
	rtmp: {
		port: 1935,
		chunk_size: 60000,
		gop_cache: true,
		ping: 30,
		ping_timeout: 60
	},
	http: {
		port:8000,
		allow_origin: '*',
		mediaroot: './site'
	},
	trans: {
		ffmpeg: '/usr/bin/ffmpeg',
		tasks: [
			{
				app: 'live',
				hls: 'true',
				hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]'
			}
		]
	}
};

const dbconfig: any = {
	connectionLimit: 50,
	host : 'localhost',
	user : 'satyr',
	password : 'password',
	database : 'satyr_db'
};

function boot(): void{
	db.run(dbconfig);
	mediaserver.boot(mediaconfig);
	ircd.boot();
}
boot();
export { boot };
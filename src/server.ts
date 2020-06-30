import * as NodeMediaServer from "node-media-server";
import * as dirty from "dirty";
import { mkdir, fstat, access } from "fs";
import * as strf from "strftime";
import * as db from "./database";
import {config} from "./config";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { exec, execFile } = require('child_process');

const keystore = dirty();

function init () {
	const nms = new NodeMediaServer({logType: 0,rtmp: config['rtmp']});
	nms.run();

	nms.on('postPublish', (id, StreamPath, args) => {
		console.log("[NodeMediaServer] Publish Hook for stream:",id);
		let session = nms.getSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//disallow urls not formatted exactly right
		if (StreamPath.split("/").length !== 3 || key.includes(' ')){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		if(app !== config['media']['privateEndpoint']){
			//app isn't at public endpoint if we've reached this point
			console.log("[NodeMediaServer] Wrong endpoint, rejecting stream:",id);
			session.reject();
			return false;
		}
		//if the url is formatted correctly and the user is streaming to the correct private endpoint
		//grab the username from the database and redirect the stream there if the key is valid
		//otherwise kill the session
		db.query('select username,record_flag from users where stream_key='+db.raw.escape(key)+' limit 1').then(async (results) => {
			if(results[0]){
				//transcode to mpd after making sure directory exists
				keystore[results[0].username] = key;
				mkdir(config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+results[0].username, { recursive : true }, ()=>{;});
				while(true){
					if(session.audioCodec !== 0 && session.videoCodec !== 0){
						transCommand(results[0].username, key).then((r) => {
							execFile(config['media']['ffmpeg'], r, {maxBuffer: Infinity}, (err, stdout, stderr) => {});
						});
						break;
					}
					await sleep(300);
				}
				if(results[0].record_flag && config['media']['record']){
					console.log('[NodeMediaServer] Initiating recording for stream:',id);
					mkdir(config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+results[0].username, { recursive : true }, (err) => {
						if (err) throw err;
						execFile(config['media']['ffmpeg'], ['-loglevel', 'fatal', '-i', 'rtmp://127.0.0.1:'+config['rtmp']['port']+'/'+config['media']['privateEndpoint']+'/'+key, '-vcodec', 'copy', '-acodec', 'copy', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+results[0].username+'/'+strf('%d%b%Y-%H%M')+'.mp4'], {
							detached : true,
							stdio : 'inherit',
							maxBuffer: Infinity
						}).unref();
						//spawn an ffmpeg process to record the stream, then detach it completely
						//ffmpeg can then (probably) finalize the recording if satyr crashes mid-stream
					});
				}
				else {
					console.log('[NodeMediaServer] Skipping recording for stream:',id);
				}
				db.query('update user_meta set live=true where username=\''+results[0].username+'\' limit 1');
				console.log('[NodeMediaServer] Stream key ok for stream:',id);
			}
			else{
				console.log('[NodeMediaServer] Invalid stream key for stream:',id);
				session.reject();
			}
		});
	});
	nms.on('donePublish', (id, StreamPath, args) => {
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		if(app === config['media']['privateEndpoint']) {
			db.query('update user_meta,users set user_meta.live=false where users.stream_key='+db.raw.escape(key));
			db.query('select username from users where stream_key='+db.raw.escape(key)+' limit 1').then(async (results) => {
				if(results[0]) keystore.rm(results[0].username);
			});

		}
	});
	nms.on('prePlay', (id, StreamPath, args) => {
		let session = nms.getSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//correctly formatted urls again
		if (StreamPath.split("/").length !== 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		//localhost can play from whatever endpoint
		//other clients must use private endpoint
		if(app !== config['media']['publicEndpoint'] && !session.isLocal) {
			console.log("[NodeMediaServer] Non-local Play from private endpoint, rejecting client:",id);
			session.reject();
			return false;
		}
		//rewrite playpath to private endpoint serverside
		//(hopefully)
		if(app === config['media']['publicEndpoint']) {
			if(keystore[key]){
				session.playStreamPath = '/'+config['media']['privateEndpoint']+'/'+keystore[key];
				return true;
			}
		}
	});
}

async function transCommand(user: string, key: string): Promise<string[]>{
	let args: string[] = [/*'-loglevel', 'fatal',*/ '-y', '-i', 'rtmp://127.0.0.1:'+config['rtmp']['port']+'/'+config['media']['privateEndpoint']+'/'+key];
	if(config['transcode']['adaptive']===true && config['transcode']['variants'] > 1) {
		for(let i=0;i<config['transcode']['variants'];i++){
			args = args.concat(['-map', '0:2']);
		}
		args = args.concat(['-map', '0:1', '-c:a', 'aac', '-c:v:0', 'libx264']);
		for(let i=1;i<config['transcode']['variants'];i++){
			args = args.concat(['-c:v:'+i, 'libx264',]);
		}
		for(let i=1;i<config['transcode']['variants'];i++){
			let crf: number = Math.floor(18 + (i * 8)) > 51 ? 51 : Math.floor(18 + (i * 7));
			args = args.concat(['-crf:'+i, ''+crf]);
		}
		for(let i=1;i<config['transcode']['variants'];i++){
			let bv: number = Math.floor((5000 / config['transcode']['variants']) * (config['transcode']['variants'] - i));
			args = args.concat(['-b:v:'+i, ''+bv]);
		}
	}
	else {
		args = args.concat(['-c:a', 'aac', '-c:v', 'libx264']);
	}
	//if(config['transcode']['format'] === 'dash')
	args = args.concat(['-remove_at_exit', '1', '-seg_duration', '1', '-window_size', '30', '-f', 'dash', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+user+'/index.mpd']);
	//else if(config['transcode']['format'] === 'hls')
	//args = args.concat(['-remove_at_exit', '1', '-hls_time', '1', '-hls_list_size', '30', '-f', 'hls', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+user+'/index.m3u8']);
	return args;
}
export { init };

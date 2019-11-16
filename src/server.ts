import * as NodeMediaServer from "node-media-server";
import { mkdir, fstat, access } from "fs";
import * as db from "./database";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { exec, execFile } = require('child_process');

function init (mediaconfig: any, satyrconfig: any) {
	const nms = new NodeMediaServer(mediaconfig);
	nms.run();

	nms.on('postPublish', (id, StreamPath, args) => {
		console.log("[NodeMediaServer] Publish Hook for stream:",id);
		let session = nms.getSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//disallow urls not formatted exactly right
		if (StreamPath.split("/").length !== 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		if(app === satyrconfig.publicEndpoint) {
			if(session.ip.includes('127.0.0.1') || session.ip === '::1') {
				//only allow publish to public endpoint from localhost
				//this is NOT a comprehensive way of doing this, but I'm ignoring it
				//until satyr releases and someone opens an issue
				console.log("[NodeMediaServer] Local publish, stream:",`${id} ok.`);
			}
			else{
				console.log("[NodeMediaServer] Non-local Publish to public endpoint, rejecting stream:",id);
				session.reject();
				return false;
			}
			console.log("[NodeMediaServer] Public endpoint, checking record flag.");
			//set live flag
			db.query('update user_meta set live=true where username=\''+key+'\' limit 1');
			//if this stream is from the public endpoint, check if we should be recording
			return db.query('select username,record_flag from users where username=\''+key+'\' limit 1').then((results) => {
				if(results[0].record_flag && satyrconfig.record){
					console.log('[NodeMediaServer] Initiating recording for stream:',id);
					mkdir(satyrconfig.directory+'/'+satyrconfig.publicEndpoint+'/'+results[0].username, { recursive : true }, (err) => {
						if (err) throw err;
						let subprocess = exec('ffmpeg -i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.publicEndpoint+'/'+results[0].username+' -vcodec copy -acodec copy '+satyrconfig.directory+'/'+satyrconfig.publicEndpoint+'/'+results[0].username+'/$(date +%d%b%Y-%H%M).mp4',{
							detached : true,
							stdio : 'inherit'
						});
						subprocess.unref();
						//spawn an ffmpeg process to record the stream, then detach it completely
						//ffmpeg can then (probably) finalize the recording if satyr crashes mid-stream
					});
				}
				else {
					console.log('[NodeMediaServer] Skipping recording for stream:',id);
				}
				return true;
			});
		}
		if(app !== satyrconfig.privateEndpoint){
			//app isn't at public endpoint if we've reached this point
			console.log("[NodeMediaServer] Wrong endpoint, rejecting stream:",id);
			session.reject();
			return false;
		}
		//if the url is formatted correctly and the user is streaming to the correct private endpoint
		//grab the username from the database and redirect the stream there if the key is valid
		//otherwise kill the session
		if(key.includes(' ')) {
			session.reject();
			return false;
		}
		db.query('select username from users where stream_key='+db.raw.escape(key)+' limit 1').then(async (results) => {
			if(results[0]){
				//push to rtmp
				exec('ffmpeg -analyzeduration 0 -i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.privateEndpoint+'/'+key+' -vcodec copy -acodec copy -crf 18 -f flv rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.publicEndpoint+'/'+results[0].username);
				//push to mpd after making sure directory exists
				mkdir(satyrconfig.directory+'/'+satyrconfig.publicEndpoint+'/'+results[0].username, { recursive : true }, (err) => {;});
				sleep(5000).then( () => {
					//wait for stream to initialize, but i'm not happy about this
					exec('ffmpeg -y -i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.privateEndpoint+'/'+key+' -map 0:2 -map 0:2 -map 0:2 -map 0:1 -c:a copy -c:v:0 copy -c:v:1 libx264 -c:v:2 libx264 -crf:1 33 -crf:2 40 -b:v:1 3000K -b:v:2 1500K -remove_at_exit 1 -seg_duration 1 -window_size 30 -f dash '+satyrconfig.directory+'/'+satyrconfig.publicEndpoint+'/'+results[0].username+'/index.mpd');
				});
				//switch to execFile at some point, it's safer
				//execFile('/usr/bin/ffmpeg',['-analyzeduration 0', '-i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.privateEndpoint+'/'+key, '-vcodec copy', '-acodec copy', '-crf 18', '-f flv', 'rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.publicEndpoint+'/'+results[0].username]);
				console.log('[NodeMediaServer] Stream key okay for stream:',id);
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
		if(app === satyrconfig.publicEndpoint) {
			db.query('update user_meta set live=false where username=\''+key+'\' limit 1');
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
		//disallow playing from the private endpoint for anyone except localhost
		//(this will be the ffmpeg instance redirecting the stream)
		if(app === satyrconfig.privateEndpoint) {
			if(session.ip.includes('127.0.0.1') || session.ip === '::1') {
				console.log("[NodeMediaServer] Local play, client:",`${id} ok.`);
			}
			else{
				console.log("[NodeMediaServer] Non-local Play from private endpoint, rejecting client:",id);
				session.reject();
			}
		}
	});
}
export { init };
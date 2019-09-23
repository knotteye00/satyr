import * as NodeMediaServer from "node-media-server";
import { mkdir } from "fs";
import * as db from "./database";
//import { transcode } from "buffer"; why is this here?
const { exec } = require('child_process');

function boot (mediaconfig: any, satyrconfig: any) {
	const nms = new NodeMediaServer(mediaconfig);
	nms.run();

	nms.on('postPublish', (id, StreamPath, args) => {
		console.log("[NodeMediaServer] Prepublish Hook for stream:",id);
		let session = nms.getSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//disallow urls not formatted exactly right
		if (StreamPath.split("/").length !== 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		if(app === mediaconfig.trans.tasks[0].app) {
			//only allow publish to public endpoint from localhost
			//this is NOT a comprehensive way of doing this, but I'm ignoring it
			//until satyr releases and someone opens an issue
			if(session.ip.includes('127.0.0.1') || session.ip === '::1') {
				console.log("[NodeMediaServer] Local publish, stream:",`${id} ok.`);
			}
			else{
				console.log("[NodeMediaServer] Non-local Publish to public endpoint, rejecting stream:",id);
				session.reject();
			}
			console.log("[NodeMediaServer] Public endpoint, checking record flag.");
			//if this stream is from the public endpoint, stream
			db.raw.query('select username from users where username=\''+key+'\' and record_flag=true limit 1', (error, results, fields) => {
				if (error) {throw error;}
				if(results[0].username && satyrconfig.record){
					console.log('[NodeMediaServer] Initiating recording for stream:',id);
					mkdir(mediaconfig.http.mediaroot+'/'+mediaconfig.trans.tasks[0].app+'/'+results[0].username, { recursive : true }, (err) => {
						if (err) throw err;
						let subprocess = exec('ffmpeg -i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+mediaconfig.trans.tasks[0].app+'/'+results[0].username+' -vcodec copy -acodec copy '+mediaconfig.http.mediaroot+'/'+mediaconfig.trans.tasks[0].app+'/'+results[0].username+'/$(date +%d%b%Y-%H%M).mp4',{
							detached : true,
							stdio : 'inherit'
						});
						subprocess.unref();
						//spawn an ffmpeg process to record the stream, then detach it completely
						//ffmpeg can then finalize the recording if satyr crashes mid-stream
					});
				}
				else {
					console.log('[NodeMediaServer] Skipping recording for stream:',id);
				}
			});
			return true;
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
		db.raw.query('select username from users where stream_key=\''+key+'\' limit 1', (error, results, fields) => {
			if (error) {throw error;}
			if(results[0]){
				exec('ffmpeg -analyzeduration 0 -i rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+satyrconfig.privateEndpoint+'/'+key+' -vcodec copy -acodec copy -crf 18 -f flv rtmp://127.0.0.1:'+mediaconfig.rtmp.port+'/'+mediaconfig.trans.tasks[0].app+'/'+results[0].username);
				console.log('[NodeMediaServer] Stream key okay for stream:',id);
			}
			else{
				console.log('[NodeMediaServer] Invalid stream key for stream:',id);
				session.reject();
			}
		});
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
export { boot };
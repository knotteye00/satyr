import * as NodeMediaServer from "node-media-server";
import { mkdir } from "fs";
import * as db from "./database";
const isLocal = require("check-localhost");
const { exec } = require('child_process');

function boot (mediaconfig: any) {
	const nms = new NodeMediaServer(mediaconfig);
	nms.run();

	nms.on('postPublish', (id, StreamPath, args) => {
		console.log("[NodeMediaServer] Prepublish Hook for stream:",id);
		let session = nms.getSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		if (StreamPath.split("/").length > 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		if(app === "live") {
			isLocal(session.ip).then( (local) => {
				if(local) {
					console.log("[NodeMediaServer] Local publish, stream:",`${id} ok.`);
				}
				else{
					console.log("[NodeMediaServer] Non-local Publish to /live, rejecting stream:",id);
					session.reject();
				}
			});
			console.log("[NodeMediaServer] Public endpoint, checking record flag.");
			db.raw.query('select username,record_flag from users where username=\''+key+'\' and record_flag=true limit 1', (error, results, fields) => {
				if (error) {throw error;}
				if(results[0]){
					console.log('[NodeMediaServer] Initiating recording for stream:',id);
					mkdir('./site/live/'+results[0].username, { recursive : true }, (err) => {
						if (err) throw err;
					});
					let subprocess = exec('ffmpeg -i rtmp://127.0.0.1/live/'+results[0].username+' -vcodec copy -acodec copy ./site/live/'+results[0].username+'/$(date +%d%b%Y-%H%M).mp4',{
						detached : true,
						stdio : 'inherit'
					});
					subprocess.unref();
					//spawn an ffmpeg process to record the stream, then detach it completely
				}
				else {
					console.log('[NodeMediaServer] Skipping recording for stream:',id);
				}
			});
			return true;
		}
		if(app !== "stream"){
			//app isn't 'live' if we've reached this point
			console.log("[NodeMediaServer] Wrong endpoint, rejecting stream:",id);
			session.reject();
			return false;
		}
		db.raw.query('select username from users where stream_key=\''+key+'\' limit 1', (error, results, fields) => {
			if (error) {throw error;}
			if(results[0]){
				exec('ffmpeg -analyzeduration 0 -i rtmp://localhost/stream/'+key+' -vcodec copy -acodec copy -crf 18 -f flv rtmp://localhost:1935/live/'+results[0].username);
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
		if (StreamPath.split("/").length > 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection for stream:",id);
			session.reject();
			return false;
		}
		if(app === "stream") {
			isLocal(session.ip).then( (local) => {
				if(local) {
					console.log("[NodeMediaServer] Local play, client:",`${id} ok.`);
				}
				else{
					console.log("[NodeMediaServer] Non-local Play from /stream, rejecting client:",id);
					session.reject();
				}
			});
		}
	});
}
export { boot };
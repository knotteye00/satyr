import * as NodeMediaServer from "node-media-server";
import { mkdir } from "fs";
const { exec } = require('child_process');

//initialize configs, eventually grab from runtime config file
function initConfig(): void{
	;
}

/*function streamAuth(path: string){
	if (path.split("/").length > 3){
		console.log("[NodeMediaServer] Malformed URL, closing connection.");
		return false;
	}
	let app: string = path.split("/")[1];
	let key: string = path.split("/")[2];
	console.log("[NodeMediaServer] Authenticating stream with credentials: ",`app=${app} key=${key}`);
	if (app !== "stream"){
		console.log("[NodeMediaServer] Invalid app name, closing connection.");
		return false;
	}
	console.log("[NodeMediaServer] App name ok.");
	if (key !== "temp"){
		console.log("[NodeMediaServer] Invalid stream key, closing connection.");
		return false;
	}
	console.log("[NodeMediaServer] Stream key ok.");
	return true;
}*/

function boot (config: any){
	const nms = new NodeMediaServer(config);

	nms.run();

	nms.on('prePublish', (id, StreamPath, args) => {
		console.log("[NodeMediaServer] Prepublish Hook for stream id=",id);
		let session = nms.getSession(id);
		if (StreamPath.split("/").length > 3){
			console.log("[NodeMediaServer] Malformed URL, closing connection.");
			session.reject();
			return false;
		}
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		console.log("[NodeMediaServer] Authenticating stream with credentials: ",`app=${app} key=${key}`);
		if (app !== "stream"){
			console.log("[NodeMediaServer] Invalid app name, closing connection.");
			session.reject();
			return false;
		}
		console.log("[NodeMediaServer] App name ok.");
		//TODO: Hook up to DB and redirect from query
		if (key !== "temp"){
			console.log("[NodeMediaServer] Invalid stream key, closing connection.");
			session.reject();
			return false;
		}
		console.log("[NodeMediaServer] Stream key ok.");
		session.publishStreamPath = "/live/amy";
	});

	nms.on('postPublish', (id, StreamPath, args) => {
		console.log('[NodeMediaServer] Checking record flag for ', `id=${id} StreamPath=${StreamPath}`);
		//Hook up to postgres DB.
		if(true){
			console.log('[NodeMediaServer] Initiating recording for ', `id=${id} StreamPath=${StreamPath}`);
			mkdir('./media'+StreamPath, { recursive : true }, (err) => {
				if (err) throw err;
			});
			let subprocess = exec('ffmpeg -i rtmp://127.0.0.1'+StreamPath+' -vcodec copy -acodec copy ./media'+StreamPath+'/$(date +%d%b%Y-%H%M).mp4',{
				detached : true,
				stdio : 'inherit'
			});
			subprocess.unref();
			//spawn an ffmpeg process to record the stream, then detach it completely
			return true;
		}
		console.log('[NodeMediaServer] Skipping recording for ', `id=${id} StreamPath=${StreamPath}`);
	});
}
export { boot };
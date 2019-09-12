import NodeMediaServer = require("node-media-server");
const ircd = require("./lib/ircdjs/lib/server.js").Server;

//initialize configs, eventually grab from runtime config file
const mediaconfig = {
	rtmp: {
		port: 1935,
		chunk_size: 60000,
		gop_cache: true,
		ping: 30,
		ping_timeout: 60
	},
	http: {
		port:8000,
		allow_origin: '*'
	}
};

function streamAuth(path: string){
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
}


var nms = new NodeMediaServer(mediaconfig);

nms.run();
ircd.boot();

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

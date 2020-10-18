import * as cluster from 'cluster';
import * as net from 'net';
import * as NodeRtmpSession from '../node_modules/node-media-server/node_rtmp_session';
import * as logger from '../node_modules/node-media-server/node_core_logger';
import * as dirty from "dirty";
import { mkdir, fstat, access } from "fs";
import * as strf from "strftime";
import * as ctx from '../node_modules/node-media-server/node_core_ctx';
import * as db from "./database";
import {config} from "./config";
import * as isPortAvailable from "is-port-available";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { exec, execFile } = require('child_process');

const keystore = dirty();
const num_processes = require('os').cpus().length;
const workerMap = {};

if (cluster.isMaster) {
	//master logic

	//store workers in here
	var workers = [];

	// Helper function for spawning worker at index 'i'.
	var spawn = function(i) {
		workers[i] = cluster.fork();
		workers[i].on('message', (msg) => {
			handleMsgMaster(msg, i)
		});

		// Restart worker on exit
		workers[i].on('exit', function(code, signal) {
			console.log('[RTMP Cluster MASTER] Respawning Worker', i);
			spawn(i);
		});
    };

    // Spawn initial workers
	for (var i = 0; i < num_processes; i++) {
		spawn(i);
	}

	var nextWorker: number = 0;

	//TODO assign incoming connections correctly

	var server = net.createServer({ pauseOnConnect: true }, function(connection) {
		if(nextWorker >= workers.length) nextWorker = 0;
		var worker = workers[nextWorker];
		worker.send('rtmp-session:connection', connection); //send connection to worker
	}).listen(config['rtmp']['port']);

	console.log('[RTMP Cluster MASTER] Master Ready.');
} else {

	//worker logic

	//we need our own database pool since we can't share memory anyone else
	db.initRTMPCluster();

	const rtmpcfg = {
		logType: 0,
		rtmp: Object.assign({port: 1936}, config['rtmp'])
	};

	//find a unique port to listen on
	getPort().then((wPort) => {

	// creating the rtmp server
	var serv = net.createServer((socket) => {
		let session = new NodeRtmpSession(rtmpcfg, socket);
		session.run();
	}).listen(wPort);
	logger.setLogType(0);

	// RTMP Server Logic
	newRTMPListener('postPublish', (id, StreamPath, args) =>{
		console.log(`[RTMP Cluster WORKER ${process.pid}] Publish Hook for stream: ${id}`);
		let session = getRTMPSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//disallow urls not formatted exactly right
		if (StreamPath.split("/").length !== 3 || key.includes(' ')){
			console.log(`[RTMP Cluster WORKER ${process.pid}] Malformed URL, closing connection for stream: ${id}`);
			session.reject();
			return false;
		}
		if(app !== config['media']['privateEndpoint']){
			//app isn't at public endpoint if we've reached this point
			console.log(`[RTMP Cluster WORKER ${process.pid}] Wrong endpoint, rejecting stream: ${id}`);
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
						transCommand(results[0].username, key, wPort).then((r) => {
							execFile(config['media']['ffmpeg'], r, {maxBuffer: Infinity}, (err, stdout, stderr) => {
								/*console.log(err);
								console.log(stdout);
								console.log(stderr);*/
							});
						});
						break;
					}
					await sleep(300);
				}
				if(results[0].record_flag && config['media']['record']){
					console.log(`[RTMP Cluster WORKER ${process.pid}] Initiating recording for stream: ${id}`);
					mkdir(config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+results[0].username, { recursive : true }, (err) => {
						if (err) throw err;
						execFile(config['media']['ffmpeg'], ['-loglevel', 'fatal', '-i', 'rtmp://127.0.0.1:'+wPort+'/'+config['media']['privateEndpoint']+'/'+key, '-vcodec', 'copy', '-acodec', 'copy', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+results[0].username+'/'+strf('%d%b%Y-%H%M')+'.mp4'], {
							detached : true,
							stdio : 'inherit',
							maxBuffer: Infinity
						}).unref();
						//spawn an ffmpeg process to record the stream, then detach it completely
						//ffmpeg can then (probably) finalize the recording if satyr crashes mid-stream
					});
				}
				else {
					console.log(`[RTMP Cluster WORKER ${process.pid}] Skipping recording for stream: ${id}`);
				}
				db.query('update user_meta set live=true where username=\''+results[0].username+'\' limit 1');
				db.query('SELECT twitch_key,enabled from twitch_mirror where username='+db.raw.escape(results[0].username)+' limit 1').then(async (tm) => {
					if(!tm[0]['enabled'] || !config['twitch_mirror']['enabled'] || !config['twitch_mirror']['ingest']) return;
					console.log(`[RTMP Cluster WORKER ${process.pid}] Mirroring to twitch for stream: ${id}`)
					execFile(config['media']['ffmpeg'], ['-loglevel', 'fatal', '-i', 'rtmp://127.0.0.1:'+wPort+'/'+config['media']['privateEndpoint']+'/'+key, '-vcodec', 'copy', '-acodec', 'copy', '-f', 'flv', config['twitch_mirror']['ingest']+tm[0]['twitch_key']], {
						detached: true,
						stdio : 'inherit',
						maxBuffer: Infinity
					}).unref();
				});
				console.log(`[RTMP Cluster WORKER ${process.pid}] Stream key ok for stream: ${id}`);
				console.log(`[RTMP Cluster WORKER ${process.pid}] Stream key ok for stream: ${id}`);
				//notify master process that we're handling the stream for this user
				process.send({type: 'handle-publish', name:results[0].username});
			}
			else{
				console.log(`[RTMP Cluster WORKER ${process.pid}] Invalid stream key for stream: ${id}`);
				session.reject();
			}
		});
	});

	newRTMPListener('donePublish', (id, StreamPath, args) => {
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		if(app === config['media']['privateEndpoint']) {
			db.query('update user_meta,users set user_meta.live=false where users.stream_key='+db.raw.escape(key));
			db.query('select username from users where stream_key='+db.raw.escape(key)+' limit 1').then(async (results) => {
				if(results[0]) keystore.rm(results[0].username);
				//notify master process that we're no longer handling the stream for this user
				process.send({type: 'handle-publish-done', name:results[0].username});
			});
		}
	});

	newRTMPListener('prePlay', (id, StreamPath, args) => {
		let session = getRTMPSession(id);
		let app: string = StreamPath.split("/")[1];
		let key: string = StreamPath.split("/")[2];
		//correctly formatted urls again
		if (StreamPath.split("/").length !== 3){
			console.log(`[RTMP Cluster WORKER ${process.pid}] Malformed URL, closing connection for stream: ${id}`);
			session.reject();
			return false;
		}
		//localhost can play from whatever endpoint
		//other clients must use private endpoint
		if(app !== config['media']['publicEndpoint'] && !session.isLocal) {
			console.log(`[RTMP Cluster WORKER ${process.pid}] Non-local Play from private endpoint, rejecting client: ${id}`);
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
			//here the client is asking for a valid stream that we don't have
			//so we are going to ask the master process for it
			else session.reject();
		}
	});

	//recieve messages from master
	process.on('message', function(message, connection) {
		if (message === 'rtmp-session:connection') {
			// Emulate a connection event on the server by emitting the
			// event with the connection the master sent us.
			serv.emit('connection', connection);
			connection.resume();
			return;
		}
		if(message['type'] === 'stream-request:h') {
			if(!message['available'])
				getRTMPSession(message['id']).reject();
		}
	});
	console.log(`[RTMP Cluster WORKER ${process.pid}] Worker Ready.`);

	});
}

function newRTMPListener(eventName, listener) {
	ctx.nodeEvent.on(eventName, listener);
}

function getRTMPSession(id) {
	return ctx.sessions.get(id);
}

async function getPort(): Promise<number>{
	let port = 1936+process.pid;
	while(true){
		let i=0;
		if(await isPortAvailable(port+i)){
			port += i;
			break;
		}
		i++;
	}
	return port;
}

async function transCommand(user: string, key: string, wPort): Promise<string[]>{
	let args: string[] = ['-loglevel', 'fatal', '-y'];
	if(config['transcode']['inputflags'] !== null && config['transcode']['inputflags'] !== "") args = args.concat(config['transcode']['inputflags'].split(" "));
	args = args.concat(['-i', 'rtmp://127.0.0.1:'+wPort+'/'+config['media']['privateEndpoint']+'/'+key, '-movflags', '+faststart']);
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
	args = args.concat(['-preset', 'veryfast', '-tune', 'zerolatency']);
	//if(config['transcode']['format'] === 'dash')
	args = args.concat(['-remove_at_exit', '1', '-seg_duration', '1', '-window_size', '30']);
	if(config['transcode']['outputflags'] !== null && config['transcode']['outputflags'] !== "") args = args.concat(config['transcode']['outputflags'].split(" "));
	args = args.concat(['-f', 'dash', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+user+'/index.mpd']);
	//else if(config['transcode']['format'] === 'hls')
	//args = args.concat(['-remove_at_exit', '1', '-hls_time', '1', '-hls_list_size', '30', '-f', 'hls', config['http']['directory']+'/'+config['media']['publicEndpoint']+'/'+user+'/index.m3u8']);
	return args;
}

function handleMsgMaster(msg, index) {
	if(msg['type'] === 'handle-publish'){
		workerMap[msg['name']] = index;
		nextWorker++;
		if(nextWorker >= workers.length) nextWorker = 0;
	}
	if(msg['type'] === 'handle-publish-done'){
		workerMap[msg['name']] = undefined;
	}
	if(msg['type'] === 'stream-request:h'){
		if(workerMap[msg['key']] !== undefined){
			workers[index].send({type: 'stream-request:h', id: msg['id'], key: msg['key'], available: true});
		}
		else {
			workers[index].send({type: 'stream-request:h', id: msg['id'], key: msg['key'], available: false});
		}
	}
}
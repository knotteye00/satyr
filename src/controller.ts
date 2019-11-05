import * as mediaserver from "./server";
import * as db from "./database";
import * as api from "./api";
import * as http from "./http";
import * as cleanup from "./cleanup";
import * as config from "config";

async function run() {
	const dbcfg: object = config.database;
	const bcryptcfg: object = config.bcrypt;
	const satyr: object = {
		privateEndpoint: config.media.privateEndpoint,
		record: config.media.record,
		registration: config.satyr.registration,
		webFormat: config.satyr.webFormat,
		restrictedNames: config.satyr.restrictedNames,
		name: config.satyr.name,
		domain: config.satyr.domain,
		email: config.satyr.email,
		rootredirect: config.satyr.rootredirect,
		version: process.env.npm_package_version
	};
	const nms: object = {
		logType: config.server.logs,
		rtmp: {
			port: config.server.rtmp.port,
			chunk_size: config.server.rtmp.chunk_size,
			gop_cache: config.server.rtmp.gop_cache,
			ping: config.server.rtmp.ping,
			ping_timeout: config.server.rtmp.ping_timeout,
		},
		http: {
			port: config.server.http.port + 1,
			mediaroot: config.server.http.directory,
			allow_origin: config.server.http.allow_origin
		},
		trans: {
			ffmpeg: config.media.ffmpeg,
			tasks: [
				{
					app: config.media.publicEndpoint,
					hls: config.transcode.hls,
					hlsFlags: config.transcode.hlsFlags,
					dash: config.transcode.dash,
					dashFlags: config.transcode.dashFlags
				}
			]
		},
		auth: {
			api: config.server.api,
			api_user: config.server.api_user,
			api_pass: config.server.api_pass
		}
		
	};
	db.init(dbcfg, bcryptcfg);
	await cleanup.init(config.server.http.directory);
	api.init(satyr);
	http.init(satyr, config.server.http.port);
	mediaserver.init(nms, satyr);
}
run();
export { run };
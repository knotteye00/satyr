import {init as initRTMP} from "./server";
import {init as initDB} from "./database";
import {init as initHTTP} from "./http";
import {init as clean} from "./cleanup";
import {init as initChat} from "./chat";
import { config } from "./config";
import { execFile } from "child_process";

async function run() {
	await initDB();
	await clean();
	await initHTTP();
	config['rtmp']['cluster'] ? execFile(process.cwd()+'/node_modules/.bin/ts-node' [process.cwd()+'src/cluster.ts']) : await initRTMP();
	await initChat();
	console.log(`Satyr v${config['satyr']['version']} ready`);
}
run();
export { run };
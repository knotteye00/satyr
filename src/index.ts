import {init as initRTMP} from "./server";
import {init as initDB} from "./database";
import {init as initHTTP} from "./http";
import {init as clean} from "./cleanup";
import {init as initChat} from "./chat";
import { config } from "./config";

async function run() {
	await initDB();
	await clean();
	await initHTTP();
	await initRTMP();
	await initChat();
	console.log(`Satyr v${config['satyr']['version']} ready`);
}
run();
export { run };
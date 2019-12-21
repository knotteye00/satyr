import * as mediaserver from "./server";
import * as db from "./database";
import * as http from "./http";
import * as cleanup from "./cleanup";
import { config } from "./config";

async function run() {
	await db.init();
	await cleanup.init();
	await http.init();
	await mediaserver.init();
	console.log(`Satyr v${config['satyr']['version']} ready`);
}
run();
export { run };
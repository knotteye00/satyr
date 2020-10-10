import {init as initDB} from "./database";
import {init as clean} from "./cleanup";
import { config } from "./config";

async function run() {
	await initDB();
	await clean(false);
}
run().then(() => {process.exit()});
import * as db from "./database";
import {readdirSync} from "fs";
import { execSync } from "child_process";

async function init() {
	if(process.argv.indexOf('--skip-migrate') === -1){
		console.log('Checking database version.');
		var tmp: string[] = await db.query('show tables like \"db_meta\"');
		if(tmp.length === 0){
			console.log('No database version info, running initial migration.');
			await require('./db/0').run();
		}
		await bringUpToDate();
	}
	else {
		console.log('Skipping database version check.');
	}

	if(!require('./config').config['http']['server_side_render'] && process.argv.indexOf('--skip-compile') === -1) {
		console.log("Compiling templates for client-side frontend.");
		execSync(process.cwd()+'/node_modules/.bin/nunjucks-precompile  -i [\"\\.html$\",\"\\.njk$\"] templates > site/templates.js');
	}
	else if(!require('./config').config['http']['server_side_render']){
		console.log("Skipped compiling templates for client-side frontend.");
	}

    //If satyr is restarted in the middle of a stream
    //it causes problems
    //Live flags in the database stay live
    await db.query('update user_meta set live=false');
}

async function bringUpToDate(): Promise<void>{
	var versions: Object[] =  JSON.parse(JSON.stringify(await db.query('select * from db_meta'))); //ugh, don't ask
	var scripts: any[] = readdirSync('./src/db/', {withFileTypes: false});
	if(scripts.length - versions.length === 0){
		console.log('No migration needed.');
	} else {
		console.log('Versions differ, migrating now.');
		var diff: string[] = scripts.filter(n => {
			//we have to use versions.some because {version: 0} === {version: 0} returns false lmao
			return !versions.some(o => o['version']+''=== n.substring(0, n.length - 3))
		});
		for(let i=0;i<diff.length;i++){
			console.log('Running migration '+diff[i]);
			await require('./db/'+diff[i]).run();
		}
		console.log('Done migrating database.');
	}
}

export { init };

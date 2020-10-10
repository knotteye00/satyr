import * as db from "./database";
import {readdirSync} from "fs";

async function init(m?: boolean) {
	if(!m){
		console.log('Checking database version.');
		var tmp: string[] = await db.query('show tables like \"db_meta\"');
		if(tmp.length === 0){
			console.log('No database version info, running initial migration.');
			await require('./db/0').run();
			await bringUpToDate();
		}
		else {
			await bringUpToDate();
		}
	}
	else {
		console.log('Skipping database version check.');
	}
    //If satyr is restarted in the middle of a stream
    //it causes problems
    //Live flags in the database stay live
    await db.query('update user_meta set live=false');
}

async function bringUpToDate(): Promise<void>{
	var versions: Object[] =  await db.query('select * from db_meta');
	var scripts: Buffer[] | string[] = readdirSync('./src/db/', {withFileTypes: false});
	var diff: number = scripts.length - versions.length
	if(diff === 0){
		console.log('No migration needed.');
	} else {
		console.log('Versions differ, migrating now.');
		for(let i=0;i<diff;i++){
			console.log('Migration to version '+Math.floor(scripts.length-(diff-i)));
			await require('./db/'+scripts[Math.floor(scripts.length-(diff-i))]).run();
		}
		console.log('Done migrating database.');
	}
}

export { init };

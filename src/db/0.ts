import * as db from "../database";

async function run () {
	await db.query('CREATE TABLE IF NOT EXISTS db_meta(version SMALLINT)');
	await db.query('INSERT INTO db_meta (version) VALUES (0)');
}

export { run }
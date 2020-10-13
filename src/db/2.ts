import * as db from "../database";

async function run () {
	await db.query('CREATE TABLE IF NOT EXISTS invites(code VARCHAR(150))');
	await db.query('INSERT INTO db_meta (version) VALUES (2)');
}

export { run }
import * as db from "../database";

async function run () {
	await db.query('CREATE TABLE IF NOT EXISTS twitch_mirror(username VARCHAR(25), enabled TINYINT DEFAULT 0, twitch_key VARCHAR(50) DEFAULT \"\")');
	await db.query('INSERT INTO twitch_mirror(username) SELECT username FROM users');
	await db.query('INSERT INTO db_meta (version) VALUES (1)');
}

export { run }
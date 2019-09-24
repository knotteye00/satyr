import * as mysql from "mysql";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { resolve } from "url";
var raw: any;
var cryptoconfig: any;

function run (db: object, bcrypt: object){
	raw = mysql.createPool(db);
	cryptoconfig = bcrypt;
}

async function addUser(name: string, password: string, streamer: boolean, admin: boolean){
	//does not respect registration setting in config
	if(password === '') return false;
	let key: string = ' ';
	if (streamer) key = await genKey();
	let hash: string = await bcrypt.hash(password, cryptoconfig.saltRounds);
	let dupe = await query('select * from users where username=\''+name+'\'');
	if(dupe[0]) return false;
	let q: string = 'INSERT INTO users (username, password_hash, stream_key, record_flag, is_mod) VALUES (\''+name+'\', \''+hash+'\', \''+key+'\', 0, '+admin+')';
	await query(q);
	return true;
}

async function rmUser(name: string){
	let exist = await query('select * from users where username=\''+name+'\'');
	if(!exist[0]) return false;
	await query('delete from users where username=\''+name+'\' limit 1');
	return true;
}

async function genKey(){
	let key: string = crypto.randomBytes(10).toString('hex');
	let result = await query('select * from users where stream_key=\''+key+'\'');
	if(result[0]) return await genKey();
	else return key;
}

async function addStreamKey(name: string){
	let exist = await query('select * from users where username=\''+name+'\'');
	if(!exist[0]) return false;
	let key = await genKey();
	await query('update users set stream_key=\''+key+'\' where username=\''+name+'\' limit 1');
	return true;
}

async function rmStreamKey(name: string){
	let exist = await query('select * from users where username=\''+name+'\'');
	if(!exist[0]) return false;
	await query('update users set stream_key=\'\' where username=\''+name+'\' limit 1');
	return true;
}

async function query(query: string){
	return new Promise(resolve => raw.query(query, (error, results, fields) => {
		if(error) throw error;
		resolve(results);
	}));
}

async function validatePassword(username: string, password: string){
	;
}

export { query, raw, run, addUser, rmUser, addStreamKey, rmStreamKey };
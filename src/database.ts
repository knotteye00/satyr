import * as mysql from "mysql";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { resolve } from "url";
var raw: any;
var cryptoconfig: any;

function init (db: object, bcrypt: object){
	raw = mysql.createPool(db);
	cryptoconfig = bcrypt;
}

async function addUser(name: string, password: string){
	//does not respect registration setting in config
	if(password === '') return false;
	let key: string = await genKey();
	let hash: string = await bcrypt.hash(password, cryptoconfig.saltRounds);
	let dupe = await query('select * from users where username='+raw.escape(name));
	if(dupe[0]) return false;
	await query('INSERT INTO users (username, password_hash, stream_key, record_flag) VALUES ('+raw.escape(name)+', '+raw.escape(hash)+', '+raw.escape(key)+', 0)');
	await query('INSERT INTO user_meta (username, title, about, live) VALUES ('+raw.escape(name)+',\'\',\'\',false)');
	return true;
}

async function rmUser(name: string){
	let exist = await query('select * from users where username='+raw.escape(name));
	if(!exist[0]) return false;
	await query('delete from users where username='+raw.escape(name)+' limit 1');
	await query('delete from user_meta where username='+raw.escape(name)+' limit 1');
	return true;
}

async function genKey(){
	let key: string = crypto.randomBytes(10).toString('hex');
	let result = await query('select * from users where stream_key=\''+key+'\'');
	if(result[0]) return await genKey();
	else return key;
}

async function query(query: string){
	return new Promise(resolve => raw.query(query, (error, results, fields) => {
		if(error) throw error;
		resolve(results);
	}));
}

async function validatePassword(username: string, password: string){
	try {
		let pass: any = await query('select password_hash from users where username='+raw.escape(username)+' limit 1');
		return await bcrypt.compare(password, pass[0].password_hash.toString());
	} catch(e) {
		return false;
	}
}

async function hash(pwd){
	return await bcrypt.hash(pwd, cryptoconfig.saltRounds);
}

export { query, raw, init, addUser, rmUser, validatePassword, hash, genKey };
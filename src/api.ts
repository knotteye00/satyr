import * as db from "./database"
import { unregisterUser } from "./irc";

var config: any;
function init(conf: object){
	config = conf;
}

async function register(name: string, password: string, confirm: string) {
	if(!config.registration) return {"error":"registration disabled"};
	if(name.includes(';') || name.includes(' ') || name.includes('\'')) return {"error":"illegal characters"};
	if(password !== confirm) return {"error":"mismatched passwords"};
	for(let i=0;i<config.restrictedNames.length;i++){
		if (name === config.restrictedNames[i]) return {"error":"restricted name"};
	}
	let r: boolean = await db.addUser(name, password);
	if(r) {
		let k = await db.query('select stream_key from users where username='+db.raw.escape(name));
		return k;
	}
	return {"error":""};
}

async function update(fields: object){
	if(!fields['title'] && !fields['bio'] && (fields['rec'] !== 'true' && fields['rec'] !== 'false')) return {"error":"no valid fields specified"};
	let qs: string = "";
	let f: boolean = false;
	if(fields['title']) {qs += ' user_meta.title='+db.raw.escape(fields['title']);f = true;}
	if(fields['bio']) {
		if(f) qs+=',';
		qs += ' user_meta.about='+db.raw.escape(fields['bio']);
		f=true;
	}
	if(typeof(fields['rec']) === 'boolean' || typeof(fields['rec']) === 'number') {
		if(f) qs+=',';
		qs += ' users.record_flag='+db.raw.escape(fields['rec']);
	}
	await db.query('UPDATE users,user_meta SET'+qs+' WHERE users.username='+db.raw.escape(fields['name'])+' AND user_meta.username='+db.raw.escape(fields['name']));
	return {"success":""};
}

async function changepwd(name: string, password: string, newpwd: string){
	if(!name || !password || !newpwd) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	let newhash: string = await db.hash(newpwd);
	await db.query('UPDATE users set password_hash='+db.raw.escape(newhash)+'where username='+db.raw.escape(name)+' limit 1');
	return {"success":""};
}

async function changesk(name: string){
	let key: string = await db.genKey();
	await db.query('UPDATE users set stream_key='+db.raw.escape(key)+'where username='+db.raw.escape(name)+' limit 1');
	return {"success":key};
}

async function login(name: string, password: string){
	if(!name || !password) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	return false;
}

export { init, register, update, changepwd, changesk, login };
import * as db from "./database";
import { config } from "./config";
import {unlink} from "fs";

async function register(name: string, password: string, confirm: string): Promise<object> {
	if(!config['satyr']['registration']) return {"error":"registration disabled"};
	if(name.includes(';') || name.includes(' ') || name.includes('\'')) return {"error":"illegal characters"};
	if(password !== confirm) return {"error":"mismatched passwords"};
	for(let i=0;i<config['satyr']['restrictedNames'].length;i++){
		if (name === config['satyr']['restrictedNames'][i]) return {"error":"restricted name"};
	}
	let r: boolean = await db.addUser(name, password);
	if(r) {
		let k = await db.query('select stream_key from users where username='+db.raw.escape(name));
		return k;
	}
	return {"error":""};
}

async function update(fields: object): Promise<object>{
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

async function updateChat(fields: object): Promise<object>{
	await db.query('UPDATE chat_integration SET xmpp='+db.raw.escape(fields['xmpp'])+', discord='+db.raw.escape(fields['discord'])+', irc='+db.raw.escape(fields['irc'])+', twitch='+db.raw.escape(fields['twitch'])+' WHERE username='+db.raw.escape(fields['name']));
	return {"success":""};
}

async function changepwd(name: string, password: string, newpwd: string): Promise<object>{
	if(!name || !password || !newpwd) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	let newhash: string = await db.hash(newpwd);
	await db.query('UPDATE users set password_hash='+db.raw.escape(newhash)+'where username='+db.raw.escape(name)+' limit 1');
	return {"success":""};
}

async function changesk(name: string): Promise<object>{
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

async function deleteVODs(vodlist: Array<string>, username: string): Promise<object>{
	for(var i=0;i<vodlist.length;i++){
		unlink('./site/live/'+username+'/'+vodlist[i], ()=>{});
	}
	return {"success":""};
}

async function getConfig(username: string, all?: boolean): Promise<object>{
	let t = {username: username};
	if(all) {
		let users = await db.query('SELECT stream_key,record_flag FROM users WHERE username='+db.raw.escape(username));
		if(users[0]) Object.assign(t, users[0]);
		let usermeta = await db.query('SELECT title,about FROM user_meta WHERE username='+db.raw.escape(username));
		if(usermeta[0]) Object.assign(t, users[0]);
		let ci = await db.query('SELECT irc,xmpp,twitch,discord FROM chat_integration WHERE username='+db.raw.escape(username));
		if(ci[0]) Object.assign(t, ci[0]);
	}
	else {
		let um = await db.query('SELECT title,about FROM user_meta WHERE username='+db.raw.escape(username));
		if(um[0]) Object.assign(t, um[0]);
	}
	return t;
}

export { register, update, changepwd, changesk, login, updateChat, deleteVODs, getConfig };
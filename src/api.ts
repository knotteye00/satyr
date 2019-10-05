import * as db from "./database"

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
	if(r) return {"success":""};
	return {"error":""};
}

async function update(name: string, password: string, title: string, bio: string, record: boolean){
	if(!name || !password) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	await db.query('UPDATE user_meta set title='+db.raw.escape(title)+', about='+db.raw.escape(bio)+' where username='+db.raw.escape(name));
	if(!record) await db.query('UPDATE users set record_flag=false where username='+db.raw.escape(name));
	else await db.query('UPDATE users set record_flag=true where username='+db.raw.escape(name));
	return {"success":""};
}

async function changepwd(name: string, password: string, newpwd: string){
	if(!name || !password) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	let newhash: string = await db.hash(newpwd);
	await db.query('UPDATE users set password_hash='+db.raw.escape(newhash)+'where username='+db.raw.escape(name)+' limit 1');
	return {"success":""};
}

async function changesk(name: string, password: string){
	if(!name || !password) return {"error":"Insufficient parameters"};
	let auth: boolean = await db.validatePassword(name, password);
	if(!auth) return {"error":"Username or Password Incorrect"};
	let key: string = await db.genKey();
	await db.query('UPDATE users set stream_key='+db.raw.escape(key)+'where username='+db.raw.escape(name)+' limit 1');
	return {"success":key};
}

export { init, register, update, changepwd, changesk };
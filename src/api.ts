import * as db from "./database"

var config: any;
function init(conf: object){
	config = conf;
}

async function register(name: string, password: string, streamer: boolean) {
	if(!config.registration){
		return {"error":"registration disabled"};
	}
	else {
		if(name.includes(';') || name.includes(' ')) return {"error":"illegal characters"};
		let s: boolean;
		if(streamer && config.streamKeys) s = true;
		else s = false;
		let r: boolean = await db.addUser(name, password, s, false);
		if(r) return {"success":""};
		else return {"error":""};
	}
}

async function login(name: string, pass: string) {
	return await db.validatePassword(name, pass);
}

async function users(num: number) {
	return await db.query('select username from users limit '+num);
}

async function user(name: string) {

}

async function instance() {

}

export { init, register };
import * as db from "./database";
import {config} from "./config";
import * as irc from "irc";

var ircClient;
var xmppClient;
var twitchClient;
var discordClient;
var liveUsers: Array<any>;
var chatIntegration: Array<any>;

async function init() {
	setInterval(updateUsers, 20000);
	setInterval(updateInteg, 60000);
}

async function updateUsers() {
	liveUsers = await db.query('SELECT username FROM user_meta WHERE live=true');
	return;
}

async function updateInteg() {
	if(liveUsers.length === 0) {
		chatIntegration = [];
		return;
	}
	if(liveUsers.length === 1) {
		chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username=');
		return;
	}
	var qs: string;
	for(var u in liveUsers) {
		qs += u['username'] + " OR username=";
	}
	qs = qs.substring(0, qs.length - 13);
	chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username='+db.raw.escape(qs));
}

async function sendAll(user, msg, src) {
	
}

async function sendIRC(channel, msg) {

}

async function sendDiscord(channel, msg) {

}

async function sendXMPP(channel, msg) {

}

async function sendTwitch(channel, msg) {

}

async function sendWeb(channel, msg) {

}

export { init };
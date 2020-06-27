import * as db from "./database";
import {config} from "./config";
import {io} from "./http";
import * as irc from "irc";
import * as discord from "discord.js";

var ircClient;
var xmppClient;
var twitchClient;
var discordClient;
var liveUsers: Array<any>;
var chatIntegration: Array<any>;

async function init() {
	setInterval(updateUsers, 20000);
	setInterval(updateInteg, 60000);
	if(config['chat']['discord']['enabled']){
		discordClient = new discord.Client();
		discordClient.once('ready', ()=>{ console.log('Discord bot ready')});
		discordClient.on('message', (msg) => {
			if(msg['author']['bot']) return;
			var lu = getUsr(msg['channel']['name'], 'discord')
			for(var i=0;i<lu.length;i++){
				sendAll(lu[i], [msg['author']['username'], msg['content']], "discord")
			}
		});
		discordClient.login(config['chat']['discord']['token']);
	}
	if(config['chat']['irc']['enabled']){

	}
	if(config['chat']['xmpp']['enabled']){
		
	}
	if(config['chat']['twitch']['enabled']){
		
	}
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
		chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username='+db.raw.escape(liveUsers[0]['username']));
		console.log('updated ci');
		return;
	}
	var qs: string;
	for(var u in liveUsers) {
		qs += db.raw.escape(u['username']) + " OR username=";
	}
	qs = qs.substring(0, qs.length - 13);
	console.log('SELECT * FROM chat_integration WHERE username='+qs);
	chatIntegration = await db.query('SELECT * FROM chat_integration WHERE username='+qs);
	console.log('updated integrations');
	console.log(chatIntegration);
}

async function sendAll(user: string, msg: Array<string>, src: string) {
	//msg should be an array containing first the username of the user who sent the message
	//followed by the message text
	//[sender, message]

	//user string is the user whose chat is being mirrored

	if(user === null) return;

	//if(src !== "irc") sendIRC();
	//if(src !== "twitch") sendTwitch();
	if(src !== "discord") sendDiscord(getCh(user, "discord"), '['+src.toUpperCase()+']'+msg[0]+': '+msg[1]);
	//if(src !== "xmpp") sendXMPP();
	if(src !== "web") sendWeb(user, ['['+src.toUpperCase()+']'+msg[0], msg[1]]);
}

async function sendIRC(channel: string, msg: string) {
	if(!config['chat']['irc']['enabled']) return;
	if(channel === null) return;
}

async function sendDiscord(channel: string, msg: string) {
	if(!config['chat']['discord']['enabled']) return;
	if(channel === null) return;
	var ch = discordClient.channels.find('name', channel);
	ch.send(msg);
}

async function sendXMPP(channel: string, msg: string) {
	if(!config['chat']['xmpp']['enabled']) return;
	if(channel === null) return;
}

async function sendTwitch(channel: string, msg: string) {
	if(!config['chat']['twitch']['enabled']) return;
	if(channel === null) return;
}

async function sendWeb(channel: string, msg: Array<string>) {
	if(channel === null) return;
	io.to(channel).emit('MSG', {nick: msg[0], msg: msg[1], room: channel});
}

function getCh(usr: string, itype: string): string{
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i]['username'] === usr){
			if(chatIntegration[i][itype].trim() !== "" && chatIntegration[i][itype] !== null) return chatIntegration[i][itype];
		}
	}
	return null;
}

function getUsr(channel: string, ctype: string): Array<string>{
	var list: Array<string> = [];
	for(var i=0;i<chatIntegration.length;i++){
		if(chatIntegration[i][ctype] === channel) list.push(chatIntegration[i]['username']);
	}
	return list;
}

export { init, sendAll };
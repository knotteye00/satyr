import irc = require('irc');

function chanReg(channel: string, owner: string){
	var bot = new irc.Client('127.0.0.1', 'ChanReg', {
		channels: ['#ChanReg'],
		userName: 'ChanReg',
		realName: 'Channel Registration Bot',
		floodProtection: false,
	});
	bot.addListener('registered', (message) => {
		bot.send('OPER', 'admin', 'test');
		bot.join(channel);
		bot.send('MODE', channel, '+P');
		bot.send('MODE', channel, '+w', 'o:'+owner+'!*@*');
		bot.disconnect();
	});
}

function chanUnReg(channel: string){
	var bot = new irc.Client('127.0.0.1', 'ChanReg', {
		channels: [''],
		userName: 'ChanReg',
		realName: 'Channel Registration Bot',
		floodProtection: false,
		debug: true
	});
	bot.addListener('registered', (message) => {
		bot.send('OPER', 'admin', 'test');
		bot.join(channel);
		bot.send('MODE', channel, '-P');
		bot.disconnect();
	});
}
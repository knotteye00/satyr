import * as db from "./database";
import * as api from "./api";
import * as flags from "flags";

db.init();

flags.defineString('adduser', '', 'User to add');
flags.defineString('rmuser', '', 'User to remove');
flags.defineString('password', '', 'password to hash');
flags.defineBoolean('invite', false, 'generate invite code');

flags.parse();

if(flags.get('adduser') !== ''){
	db.addUser(flags.get('adduser'), flags.get('password')).then((result) => {
		if(result) console.log("User added successfully.");
		else console.log("Could not add user. Is the password field empty?");
		process.exit();
	});
}

if(flags.get('rmuser') !== ''){
	db.rmUser(flags.get('rmuser')).then((result) => {
		if(result) console.log("User removed successfully.");
		else console.log("Could not remove user.");
		process.exit();
	});
}

if(flags.get('invite')){
	var config = require("./config").config;
	api.genInvite().then((r: string) => {
		console.log('invite code: '+r);
		console.log('Direct the user to https://'+config['satyr']['domain']+'/invite/'+r);
		process.exit();
	});
}
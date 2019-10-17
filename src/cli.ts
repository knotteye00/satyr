import * as db from "./database"
import * as flags from "flags";
import * as config from "config"

db.init(config.database, config.bcrypt);

flags.defineString('adduser', '', 'User to add');
flags.defineString('rmuser', '', 'User to remove');
flags.defineString('password', '', 'password to hash');

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
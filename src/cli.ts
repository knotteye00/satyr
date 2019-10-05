import * as db from "./database"
import * as flags from "flags";
import * as config from "config"

db.init(config.database, config.bcrypt);

flags.defineString('add', '', 'User to add');
flags.defineString('remove', '', 'User to remove');
flags.defineString('password', '', 'password to hash');
flags.defineBoolean('admin');
flags.defineBoolean('streamer');

flags.parse();

if(flags.get('add') !== ''){
	db.addUser(flags.get('add'), flags.get('password')).then((result) => {
		if(result) console.log("User added successfully.");
		else console.log("Could not add user. Is the password field empty?");
		process.exit();
	});
}

if(flags.get('remove') !== ''){
	db.rmUser(flags.get('remove')).then((result) => {
		if(result) console.log("User removed successfully.");
		else console.log("Could not remove user.");
		process.exit();
	});
}
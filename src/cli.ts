import * as db from "./database"
import * as flags from "flags";
import * as config from "config"

db.init(config.database, config.bcrypt);

flags.defineString('add', '', 'User to add');
flags.defineString('remove', '', 'User to remove');
flags.defineString('mkstreamer', '', 'Give a stream key to a user');
flags.defineString('rmstreamer', '', 'Remove a stream key from a user');
flags.defineString('password', '', 'password to hash');
flags.defineBoolean('admin');
flags.defineBoolean('streamer');

flags.parse();

if(flags.get('add') !== ''){
	db.addUser(flags.get('add'), flags.get('password'), flags.get('streamer'), flags.get('admin')).then((result) => {
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

if(flags.get('mkstreamer') !== ''){
	db.addStreamKey(flags.get('mkstreamer')).then((result) => {
		if(result) console.log("Key added successfully.");
		else console.log("Could not add key.");
		process.exit();
	});
}

if(flags.get('rmstreamer') !== ''){
	db.rmStreamKey(flags.get('rmstreamer')).then((result) => {
		if(result) console.log("Key removed successfully.");
		else console.log("Could not remove key.");
		process.exit();
	});
}
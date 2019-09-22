import * as mysql from "mysql";
import * as bcrypt from "bcrypt";
var raw: any;

function run (dbconfig: any){
	raw = mysql.createPool(dbconfig);
}

function streamKeyAuth(key: string){
	;
}

async function validatePassword(username: string, password: string){
	raw.connect();
	return raw.query('select password_hash from users where username=\''+username+'\' limit 1', (error, results, fields) => {
		if (error) { throw error; }
		return bcrypt.compare(password, results[0].password_hash, (err, result) =>{
			if (err) { throw err; }
			return result;
		});
	})
}

export { streamKeyAuth, validatePassword, raw, run };
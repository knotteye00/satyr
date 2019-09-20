import * as child from "child_process";
var ircd: child.ChildProcess;
function boot():void{
	ircd = child.execFile("./lib/inspircd-3.3.0/run/inspircd", ["restart"], (error, stdout, stderr) => {
		if (error){
			console.log("[IRCD] Failed to start Inspircd");
			console.log(stdout);
			throw error;
		}
		else {
			console.log("[IRCD] Started Inspircd");
		}
	});
}

function reloadSSL():void{
	ircd.kill("SIGUSR1");
}

export { boot, reloadSSL };
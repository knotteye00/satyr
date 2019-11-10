import * as db from "./database";
import * as read from "recursive-readdir";
import * as fs from "fs";

async function init(siteDir: string) {
    //If satyr is restarted in the middle of a stream
    //it causes problems
    //Live flags in the database stay live
    await db.query('update user_meta set live=false');
    //and stray m3u8 files will play the last
    //few seconds of a stream back
    try {
        var files = await read(siteDir+'/live', ['!*.m3u8']);
    }
    catch (error) {}
    if(files === undefined || files.length == 0) return;
    for(let i=0;i<files.length;i++){
        fs.unlinkSync(files[i]);
    }
    return;
}

export { init };
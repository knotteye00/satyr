import * as db from "./database";

async function init() {
    //If satyr is restarted in the middle of a stream
    //it causes problems
    //Live flags in the database stay live
    await db.query('update user_meta set live=false');
}

export { init };

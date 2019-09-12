"use strict";
exports.__esModule = true;
var NodeMediaServer = require("node-media-server");
var ircd = require("./lib/ircdjs/lib/server.js").Server;
//initialize configs, eventually grab from runtime config file
var mediaconfig = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: 8000,
        allow_origin: '*'
    }
};
function streamAuth(path) {
    if (path.split("/").length > 3) {
        console.log("[NodeMediaServer] Malformed URL, closing connection.");
        return false;
    }
    var app = path.split("/")[1];
    var key = path.split("/")[2];
    console.log("[NodeMediaServer] Authenticating stream with credentials: ", "app=" + app + " key=" + key);
    if (app !== "stream") {
        console.log("[NodeMediaServer] Invalid app name, closing connection.");
        return false;
    }
    console.log("[NodeMediaServer] App name ok.");
    if (key !== "temp") {
        console.log("[NodeMediaServer] Invalid stream key, closing connection.");
        return false;
    }
    console.log("[NodeMediaServer] Stream key ok.");
    return true;
}
var nms = new NodeMediaServer(mediaconfig);
nms.run();
ircd.boot();
nms.on('prePublish', function (id, StreamPath, args) {
    console.log("[NodeMediaServer] Prepublish Hook for stream id=", id);
    var session = nms.getSession(id);
    if (StreamPath.split("/").length > 3) {
        console.log("[NodeMediaServer] Malformed URL, closing connection.");
        session.reject();
        return false;
    }
    var app = StreamPath.split("/")[1];
    var key = StreamPath.split("/")[2];
    console.log("[NodeMediaServer] Authenticating stream with credentials: ", "app=" + app + " key=" + key);
    if (app !== "stream") {
        console.log("[NodeMediaServer] Invalid app name, closing connection.");
        session.reject();
        return false;
    }
    console.log("[NodeMediaServer] App name ok.");
    if (key !== "temp") {
        console.log("[NodeMediaServer] Invalid stream key, closing connection.");
        session.reject();
        return false;
    }
    console.log("[NodeMediaServer] Stream key ok.");
    session.publishStreamPath = "/live/amy";
});

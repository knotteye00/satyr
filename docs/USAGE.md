## Satyr Usage

### Administration
Satyr needs access to port 1935 for RTMP streams, and will serve HTTP on port 8000. The ports can be changed with follow config lines.
```
[server.http]
port = 8000
[server.rtmp]
port = 1935
```
Changing the rtmp port is not recommended.

For HTTPS, run a reverse proxy in front of satyr. An example nginx block is shown below.
```
server {
    port 80;
    port [::]80;
    server_name example.tld;
    return https://$server_name$request_uri 301;
}
server {
    port 443 ssl;
    port [::]443 ssl;
    server_name example.tld;

    ssl_trusted_certificate   /etc/letsencrypt/live/example.tld/chain.pem;
    ssl_certificate               /etc/letsencrypt/live/example.tld/fullchain.pem;
    ssl_certificate_key        /etc/letsencrypt/live/example.tld/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000/;
    }
}
```

Users can be added from the command line even if registration is closed. Use the following syntax.
```bash
npm run-script user -- --adduser kawen --password imkawen
npm run-script user -- --rmuser lain
```

### Users

#### Accounts
If registration is open, users can register at example.tld/registration, and set some options such as whether to record VODs and a stream title on /profile
Stream keys can be changed at example.tld/changesk, and passwords at /changepwd

#### Chat
Chat is based on Socket.IO, and can be accessed through the webclient at /chat.
Chatting and changing a nickname do not require authentication, but the usernames of streamers are reserved.
The following commands are available:
`/nick kawen (password)` Password is only required if kawen is a registered user.
`/join kawen` Join the chatroom for kawen's stream and leave the previous room.
`/kick lain` Available only in your own room if you are a streamer. Forcefully disconnect the user.

#### Streaming
Users should stream to rtmp://example.tld/stream/examplestreamkey
The stream will be available at rtmp://example.tld/live/kawen and http://example.tld/live/kawen/index.m3u8 or .mpd if you've enabled DASH. (Enabling both HLS and DASH is not recommended for most use cases.)

Most software, such as OBS, will have a separate field for the URL and stream key, in which case the user can enter rtmp://example.tld/stream/ and the stream key in the appropriate field.

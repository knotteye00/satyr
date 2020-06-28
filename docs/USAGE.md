## Satyr Usage

### Administration
Satyr needs access to port 1935 for RTMP streams, and will serve HTTP on port 8000. The ports can be changed with follow config lines.

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

### Users

#### Accounts
If registration is open, users can register at example.tld/registration, and set some options such as whether to record VODs and a stream title on /profile
Stream keys can be changed at example.tld/changesk, and passwords at /changepwd

#### Chat
Chat is based on Socket.IO, and can be accessed through the webclient at /chat.
Chatting and changing a nickname do not require authentication, but the usernames of streamers are reserved.
The following commands are available:
`/nick sally (password)` Password is only required if sally is a registered user.
`/join sally` Join the chatroom for sally's stream and leave the previous room.
`/kick bob` Available only in your own room if you are a streamer. Forcefully disconnect the user.
`/ban bob (time)` Ban a user from your room. Bans are based on IP address. The optional time is in minutes. The default is 30.
`/banlist` List the IPs currently banned from your room.
`/unban (ip)` self explanatory

You can set up mirroring to and from webchat rooms and IRC channels, twitch streams, and discord server channels.
More information is in CONFIGURATION.md

#### Streaming
Users should stream to rtmp://example.tld/stream/examplestreamkey
The stream will be available at rtmp://example.tld/live/kawen and http://example.tld/live/kawen/index.mpd

Most software, such as OBS, will have a separate field for the URL and stream key, in which case the user can enter rtmp://example.tld/stream/ and the stream key in the appropriate field.

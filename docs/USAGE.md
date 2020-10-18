## Satyr Usage

### Administration
Satyr needs access to port 1935 for RTMP streams, and will serve HTTP on port 8000. See CONFIGURATION.md for details on changing this.

For HTTPS, run a reverse proxy in front of satyr. An example nginx config can be found at install/satyr.nginx
An example systemd service can also be at install/satyr.service

#### CLI
Satyr's CLI tool can be run with `npm run cli` or `node_modules/.bin/ts-node src/cli.ts`

It's not very complex. The following commands are available:
* `npm run cli -- --adduser sally --password "hunter12"` to create user sally with the password hunter12
* `npm run cli -- --rmuser sally` to remove user sally
* `npm run cli -- --invite` to generate an invite code used for creating account even when registration is closed


### Users

#### Accounts
If registration is open, users can register at example.tld/registration, and set some options such as whether to record VODs and a stream title on /profile
Stream keys can be changed at example.tld/changesk, and passwords at /changepwd

#### Chat
Chat is based on Socket.IO, and can be accessed through the webclient at /chat.
Chatting and changing a nickname do not require authentication, but the usernames of streamers are reserved.

The following commands are available:
* `/nick sally (password)` Password is only required if sally is a registered user.
* `/join sally` Join the chatroom for sally's stream and leave the previous room.
* `/kick bob` Available only in your own room if you are a streamer. Forcefully disconnect the user.
* `/ban bob (time)` Ban a user from your room. Bans are based on IP address. The optional time is in minutes. The default is 30.
* `/banlist` List the IPs currently banned from your room.
* `/unban (ip)` self explanatory

You can set up mirroring to and from webchat rooms and IRC channels, twitch streams, and discord server channels.
More information is in CONFIGURATION.md

#### Streaming
Users should stream to rtmp://example.tld/stream/examplestreamkey
The stream will be available at rtmp://example.tld/live/kawen and http://example.tld/live/kawen/index.mpd

Most software, such as OBS, will have a separate field for the URL and stream key, in which case the user can enter rtmp://example.tld/stream/ and the stream key in the appropriate field.

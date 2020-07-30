# A Guide to the API for Satyr's webchat
This is not a guide to using the webchat, this a reference point for writing clients.

Satyr's webchat is based on [socket.io](https://socket.io/), you can find clients for [Java](https://github.com/socketio/socket.io-client-java), [C++](https://github.com/socketio/socket.io-client-cpp), [Swift](https://github.com/socketio/socket.io-client-swift), [Dart](https://github.com/rikulo/socket.io-client-dart), and probably more.

Socket.IO is loosely reminiscent of IRC in that you will receive events from the server and sent events to it. The following is a list of incoming and outgoing events you will need to handle or send. If you would like to see examples, templates/chat.html is implementation used in the webclient by satyr.

# Incoming Events
These are events you will recieve from the server that need to be handled in some way.

## MSG
A MSG event is a chat message. It will have data attached in the following JSON format:
```
{
	nick: "nickname of the sending user",
	msg: "the text of the message",
	room: "the room the message was sent to"
}
```

## ALERT
An ALERT event is a message from the server to a room. It is just a string containing the plaintext message. Alerts notify a user about things like nickname changes, users who are kicked or banned, and errors.

## JOINED
A JOINED event notifies the client that a new user has joined a room they are in. It's a JSON message in the following format:
```
{
	nick: "the user that joined",
	room: "the name of the room"
}
```

## LEFT
A LEFT event notifies the client that a user has left a room they are in. It's a JSON message in the following format:
```
{
	nick: "the user that left",
	room: "the name of the room"
}
```

## LIST
A LIST event will only be emitted by the server in response to receiving a LIST event from the client. It is a string containing the list of users in a room, separated by commas.

# Outgoing Events
These are events sent from the client to request that the server do something.

## NICK
This is a request to set the client's nickname. The data attached to a NICK event should be a JSON object in the following format. The password field is optional, and only required for registered users.
```
{
	nick: "the requested nickname",
	password: "the optional password"
}
```
During the initial connect of the client, the server will check for the "Authorization" cookie. If the cookie is a valid, signed JWT, the client will be assigned the nickname of the user that cookie belongs to. If it doesn't exist or is invalid, the client will be assigned a nickname of the form Guest+some integer.

The server will send an alert notifying the client of either the nickname change, or some error.

## MSG
This is a chat message to send to room. It should be a JSON object in the following format:
```
{
	room: "the room to send the messag to",
	msg: "the text of the message"
}
```

## JOINROOM
This is a request to join a room and be notified of its events. The attached data should be a string containing the name of the room.

The server will send the client an alert notifying them of having joined the room, or some error.

## LEAVEROOM
This is a request to leave a room and no longer be notified of its events. The attached data should be a string containing the name of the room.

## LIST
This is a request for a list of users in a room. It should be a JSON object of the following format:

`{room: "the name of the room"}`

## KICK
This is a request to kick a user from a room. It can only be done by the owner of the room. It should be a JSON object of the following format:
```
{
	nick: "the user to kick",
	room: "the room to kick them from"
}
```

## BAN
This is a request to ban a user from a room. It can only be done by the owner of the room. All bans are based on IP. It should be a JSON object of the following format:
```
{
	nick: "the user to ban",
	room: "the room to ban them from",
	length: 30
}
```
The length field is time in minutes.

## LISTBAN
This is a request for a list of IP adresses banned from a room. It should be a JSON object of the following format:

`{room: "the name of the room"}`

The server will reply with an ALERT that contains a list of IP addresses separated by commas.

## UNBAN
A request to unban an IP address. It can only be done by the owner of the room. It should be a JSON object of the following format:
```
{
	room: "the name of the room",
	ip: "the ip address to unban"
}
```

# Final Notes

Sending more than 10 messages a second will cause the server to kick your client. If kicked this way 3 times, the client will be banned for 20 minutes.

Kicked or banned users will not be notified of this through an event.

The server *will* send your own MSG events back to you, you will need to parse them out if you want to append them immediately.

Clients who successfully authenticate as a registered user, through either a password or a signed JWT, can ignore nickname collision and have as many connections as they wish.
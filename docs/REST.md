## Using Satyr's Rest API

### /api/instance/info

Generic enformation about the instance.

Method: GET

Authentication: no

Parameters: none

Response: Returns a JSON object containing the name, domain, version, email, and whether registration is open. Email will be null if not specified.

Example: `{name: "Example Instance", domain: "example.com", registration: false, version: 0.7, email: null}`



### /api/instance/config

Configuration of the instance relating to media

Method: GET

Authentication: no

Parameters: none

Response: JSON object containing the port and ping_timeout for RTMP, public and private play endpoints, and whether adaptive livestreaming and VOD recording are enabled.

Example:
```
{
	rtmp: {
		port: 1935,
		ping_timeout: 60
	},
	media: {
		vods: false,
		publicEndpoint: 'live',
		privateEndpoint: 'stream',
		adaptive: true
	}
}
```
Public and private endpoints work like this, from the above example:
stream to: rtmp://example.com/stream
play from: rtmp://example.com/live/username or https://example.com/live/username/index.mpd



### /api/users/live/

UNFINISHED

Returns the usernames and stream titles of 10 users who are currently streaming

Method: GET

Authentication: no

Parameters: num (optional), sort (optional)

Response: Returns an array of objects containing the username and title of each stream. Returns an empty array if no one is streaming.

Example: `[{username:"foo", title:"bar"}]`


### /api/users/all

Same as above, but returns all users regardless of whether they are streaming. Also unfinished.



###  /api/register

Register a new user.

Method: POST

Authentication: no

Parameters: Username, password, confirm

Response: If successful, returns a json object with the users stream key. Otherwise returns `{error: "error reason"}`

Examples: 
`{stream_key: "asdfghjkltyuiop12345"}`
`{error: "registration disabled"}`


### /api/login

Obtain a signed json web token for authentication

Method: POST

Authentication: no

Parameters: Username and password OR a valid JWT cookie expiring in less than 24 hours

Response: If succesful, will return `{success: ""}` or `{success: "already verified"}` if the JWT provided is too early to be renewed. If unsuccesful, will return `{error: "invalid password"}` or `{error: "Username or Password Incorrect"}` depending on the authentication method. Note that if a JWT is available, the parameters will be ignored.

Notes: I've already listed nearly every response. My final note is that the JWT is set as the cookie 'Authorization', not returned in the response.


### /api/user/update

Update the current user's information

Method: POST

Authentication: yes

Parameters: title, bio, rec
Rec is a boolean (whether to record VODs), others are strings. Parameters that are not included in the request will not be updated.

Response: Returns `{error: "error code"}` or `{success: ""}`



### /api/user/update/chat

Update the chatrooms on other platforms to integrate with the user's stream chat

Method: POST

Authentication: yes

Parameters: discord, xmpp, twitch irc
All strings corresponding to a channel name to mirror to. XMPP is currently unused. Parameters not included in the request will not be updated.

Response: Returns `{error: "error code"}` or `{success: ""}`



### /api/user/vods/delete

Delete the specified vods of the current user

Method: POST

Authentication: yes

Paramters: A string array of the names of vods to be deleted. (Do not include the file extension);

Response: Returns `{error: "error code"}` or `{success: ""}`

### /api/user/password

Change the current user's password

Method: POST

Authentication: yes

Parameters: The user's current password, the new password, AND a valid JWT cookie.

Response: Returns `{error: "error code"}` or `{success: ""}`



### /api/user/streamkey

Change the current user's stream key. This will not affect the stream if the user is currently live.

Method: POST

Authentication: yes

Parameters: A valid JWT cookie. No other parameters.

Response: Returns `{error: "error code"}` or `{success: "new_stream_key"}`

### /api/:user/vods

Get a list of the named users VODs

Method: GET

Authentication: no

Parameters: user

Response: Returns an array of VODs with the format `[{"name":"yote.mp4"},{"name":"yeet.mp4"}]`

Notes: VODs are always available at http://domain.com/publicEndpoint/username/filename.mp4



## /api/:user/config

Method: GET

Authentication: optional

Parameters: user

Response: Returns a JSON object with available information about the user. If the user is authenticated and searching for their own information, will return all available information. Otherwise it will return only the stream title and bio. In the case of searching for a user that does not exist, the returned object will contain only the username searched for.

Example: `{username: "foo", title: "bar", about: "This is an example bio"}`



## Not Yet Implemented

#### /api/user/streamkey/current

Return current stream key
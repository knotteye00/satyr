## Configuring Satyr

### Config file
All changes to satyr's config will go in the config/config.yml file
Some values you might want to change are
```
satyr:
  registration: true
# allow new users to register
  port: 8000
# the port to serve http on

http:
  hsts: true
# enable strict transport security

rtmp:
  port: 1935
# change the port to serve rtmp on
  cluster: false
# enable clustering for the RTMP server
# clustering is an attempt to take better advantage of multi threaded systems in spite of node.js being single-threaded
# satyr will spawn one RTMP Worker per CPU core, and round-robin incoming connections between workers
# If you turn this on, satyr will no longer be able to reliably serve RTMP streams to clients
# Your users will have to use DASH instead

media:
  record: true
# allow users to record VODs

transcode:
  adapative: true
# enable adaptive livestreaming when transcoding to mpeg-dash
# this will help users with poor connections, but is very cpu intensive
# even 3 variants will max out most budget VPSs with a single stream
  variants: 3
# the number of stream variants to generate when transcoding
# satyr will generate one source quality variant, and the remaining
# variants will be of incrementally lower quality and bitrate

  inputflags: ""
# additional flags to apply to the input during transcoding
  outputflags: ""
# additional flags to apply to the output during transcoding

# hardware acceleration is a bit difficult to configure programmatically
# this is a good place to do so for your system
# https://trac.ffmpeg.org/wiki/HWAccelIntro is a good place to start

# having more than 4-5 variants will start giving diminishing returns on stream quality for cpu load
# if you can't afford to generate at least 3 variants, it's recommended to leave adaptive streaming off

crypto:
  saltRounds: 12
# change the number of rounds of bcrypt to fit your hardware
# if you don't understand the implications, don't change this

chat:
# the following settings are for chat bridging bots
# users will still need to choose which channel to bridge
# for their chat at /profile/chat
  irc:
    enabled: true
    server: chat.freenode.net
    port: 6697
    tls: true
# settings for the server the IRC bot will connect to
    nickname: 'satyrchat'
    sasl: true
    password: 'definitelyrealpassword'
# if you want the bot to authenticate itself to reserve the username

  discord:
    enabled: true
    token: abcdefghijklmnopqrstuvwxyz
# the access token for the bot
# note that the bot will mirror every channel matching the name the user has chosen
# even if it's connected to multiple servers

  twitch:
    enabled: true
    username: satyrchataccount
    token: asdfghjklASDFGHJKL
# access token for the twitch chat bot
# this is not the account password, you will need to generate a token here:
# https://twitchapps.com/tmi/

  xmpp:
    enabled: true
    server: 'example.com'
    port: 5222
    jid: 'exampleBot@example.com'
    password: 'abcde'
# connection settings for the bot
    nickname: 'SatyrChat
# the nickname the bot will join MUCs with

# note that for the best experience you should set the default number of history messages to 0 for the MUC
# The bot will attempt to request 0 history messages anyway, and will also attempt to ignore any history messages it receives
# but both of these things are unreliable
```

### Web Frontend
If you want to customize the front-end css, place a file with any changes you wish to make at site/local.css
You can change the logo by replacing site/logo.svg.
You should also consider editing templates/about.html and templates/tos.html

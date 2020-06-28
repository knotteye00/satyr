## Configuring Satyr

### Config file
All changes to satyr's config will go in the config/config.yml file
Some values you might want to change are
```
satyr:
  registration: true
# allow new users to register

http:
  hsts: true
# enable strict transport security

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

# having more than 4-5 variants will start giving diminishing returns on stream quality for cpu load
# if you can't afford to generate at least 3 variants, it's reccomended to leave adaptive streaming off

crypto:
  saltRounds: 12
# change the number of rounds of bcrypt to fit your hardware
# if you don't understand the implications, don't change this

chat:
# the following settings are for chat mirroring bots
# users will still need to choose which channel to mirror
# for their chat at /profile/chat
  irc:
    enabled: true
# enable irc mirroring
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
# enabled discord integration
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
```

### Web Frontend
If you want to customize the front-end css, place a file with any changes you wish to make at site/local.css
You can change the logo by replacing site/logo.svg.
You should also consider editing templates/about.html and templates/tos.html

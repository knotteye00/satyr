## Configuring Satyr

### Config file
All changes to satyr's config will go in the config/local.toml file
Some values you might want to change are
```
[satyr]
registration = true
# allow new users to register
rootRedirect = '/users/live'
# the page users are directed to when they visit your site root

[server.http]
hsts = true
# enable strict transport security

[media]
record = true
# allow users to record VODs

[transcode]
adapative = true
# enable adaptive livestreaming
# will help users with poor connections, but EXTREMELY cpu intensive
# even 3 variants will max out most budget VPSs with a single stream
variants = 3
# the number of adaptive streaming variants to generate
# satyr will always copy the source stream
# and the remaining variants will lower the quality incrementally

# So the default setting of 3 will copy the source stream once
# And generate two lower quality & bitrate variants

[bcrypt]
saltRounds = 12
#change the number of rounds of bcrypt to fit your hardware
#if you don't understand the implications, don't change this

[ircd]
enable = true
#enable IRC peering
#extremely beta
```

### Web Frontend
If you want to customize the front-end css, place a file with any changes you wish to make at site/local.css
You can change the logo by replacing site/logo.svg.
You should also consider editing templates/about.html and templates/tos.html
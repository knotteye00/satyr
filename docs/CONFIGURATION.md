## Configuring Satyr

### Config file
All changes to satyr's config will go in the config/local.toml file
Some values you might want to change are
```
[satyr]
registration = true
#allow new users to register
rootRedirect = '/users/live'
#the page users are directed to when they visit your site root
[media]
record = true
#allow users to record VODs
[bcrypt]
saltRounds = 12
#change the number of rounds of bcrypt to fit your hardware
#if you don't understand the implications, don't change this
[ircd]
enable = true
#enable IRC peering
```

### Web Frontend
If you want to customize the front-end css, place a file with any changes you wish to make at site/local.css
You can change the logo by replacing site/logo.svg, or edit templates/base.njk to look for another source.
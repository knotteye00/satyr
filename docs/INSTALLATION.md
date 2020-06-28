## Installing Satyr
A more detailed walkthrough.

### System Dependencies
Install ffmpeg(>= 4.2.1) and mysql through your distribution's package manager.
See [this page](https://nodejs.org/en/download/package-manager/) for instructions on installing node v10.
If the version in your distro's package manager is different, you can install 'n' through npm to manage node versions.

### Installing Satyr
Before starting, you should create a system user to run the satyr service.

Clone the repository and change to the directory
```bash
git clone https://gitlab.com/knotteye/satyr.git
cd satyr
```
Install nodejs dependencies
```bash
npm install
```
Run the setup script to generate a config file and database setup.
```bash
npm run setup
```
Look over the generated config file in config/generated.yml, and move it to config/config.yml when you're satisfied.
Run the setup script for the database.
```bash
sudo mysql
source install/db_setup.sql;
```
Then start the server.
```bash
npm run start
```

It is reccomended that you run Satyr behind a TLS terminating reverse proxy like nginx. An example configuration can be found in CONFIGURATION.md
An example systemd service is provided at install/satyr.service. It assumes you've installed satyr into /opt/satyr, and created a satyr user with the home directory /var/lib/satyr for the purpose of running the service.

## Updating Satyr
Updating should be as simple as pulling the latest code and dependencies, then restarting the server.

```bash
git pull
npm i
npm update
```

Then restart the server.

## Migrating Satyr
To backup and restore, you will need to export the mysqlDB. Restore the new database from the backup, then copy the config and site directories to the new location.
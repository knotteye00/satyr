## Installing Satyr
A more detailed walkthrough.

### System Dependencies
Install ffmpeg and mysql through your distribution's package manager.
See [this page](https://nodejs.org/en/download/package-manager/) for instructions on install node. Compatible versions are >=10. Nightly builds may fail to compile some of the native addons.

### Installing Satyr
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
Look over the generated config file in config/generated.toml, and move it to config/local.toml when you're satisfied.
Run the setup script for the database.
```bash
sudo mysql
source install/db_setup.sql;
```
Compile the code and start the server.
```bash
npm run build
npm start
```

It is reccomended that you run Satyr behind a TLS terminating reverse proxy, like nginx.
An example systemd service is provided at install/satyr.service. It assumes you've installed satyr into /opt/satyr, and created a satyr user with the home directory /var/lib/satyr for the purpose of running the service.

## Updating Satyr
Updating should be as simple as pulling the latest code and dependencies, then building and restarting the server.

```bash
git pull
npm i
npm run build
```

Then restart the server.

## Migrating Satyr
To backup and restore, you will need to export the mysqlDB. Restore the new database from the backup, then copy the config/local.toml file and the site directory to the new install.
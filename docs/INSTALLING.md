##Installing Satyr
A generic guide for install satyr. Example commands are provided for distributions based on debian and arhc.

###Preparing the system
It is reccomended to create a system user to run satyr.
```bash
adduser satyr -D /var/lib/satyr -m -r -U
```
Install ffmpeg and mysql with your package manager.
```bash
sudo apt install ffmpeg mysql
pacman -S ffmpeg mysql
```

###Installing NodeJS

####Installing on distributions with a compatible version of node
If your distribution ships with a compatible version of node(stable, >=10), you can install it with your distribution's package manager.
```bash
sudo apt install nodejs
```
You can verify the version with 
```bash
node --verion
```
####Installing on distributions with an incompatible version of node
If the version provided by your disribution is not a new enough version, is a nightly build (such as Arch), you will need to get a compatible version from [nodejs.org](https://nodejs.org/en/downloads) and add the binaries to your path.
```bash
wget https://nodejs.org/dist/path/to/download.tar.xz
tar -xf node-v10.something.tar.xz
```
Add the /bin folder to your path (and the path of the satyr user), or symlink the binaries.
```bash
sudo ln -sf node-v10.something/bin/node /usr/bin
sudo ln -sf node-v10.something/bin/npm /usr/bin
sudo ln -sf node-v10.something/bin/npx /usr/bin
```

Alternatively, use a tool like [nvm](https://github.com/nvm-sh/nvm) to manage your current node version.

###Install Satyr
Clone the satyr repo to a folder such as /opt/satyr or /var/lib/satyr and make satyr the owner of the folder.
```bash
sudo mkdir -p /opt/satyr
sudo chown -R satyr:satyr /opt/satyr
sudo -Hu satyr git clone https://gitlab.com/knotteye/satyr.git /opt/satyr
```
Change to the satyr directory and install dependecies. It will ask you a few questions to generate an initial config.
```bash
cd /opt/satyr
npm install
```
Build and start the server.
```bash
npm run build
npm start
```
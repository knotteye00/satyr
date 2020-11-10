# This repository is a mirror
And an infrequently updated one at that. Development happens at https://pond.waldn.net/git/knotteye/satyr/, head there to contribute.

## Satyr: A livestreaming server

System dependencies: A stable version of node>=10, mysql3 (or a compatible implementation such as MariaDB), and ffmpeg >=4.2

### Setup Instructions
```bash
git clone https://pond.waldn.net/git/knotteye/satyr.git
cd satyr
npm install
npm run setup
```
Follow the instructions after setup runs.

### Run the server
```bash
npm run start
```
You can also skip checking the database version and compiling templates (if you don't use server-side rendering) on startup.
```bash
npm run start -- --skip-migrate --skip-compile
# don't forget to migrate manually when you update
npm run migrate
# and compile templates after any changes
npm run make-templates
```

## Contributing

1. Fork the repository
2. Create new feature branch
3. Write Code
4. Create an request to merge back into develop

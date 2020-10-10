## Satyr: A livestreaming server

System dependencies: A stable version of node>=10, mysql3 (or a compatible implementation such as MariaDB), and ffmpeg >=4.2

### Setup Instructions
```bash
git clone https://gitlab.com/knotteye/satyr.git
cd satyr
npm install
npm run setup
```
Follow the instructions after setup runs.

### Run the server
```bash
npm run start
```
You can also run this to skip checking the database version on startup.
```bash
npm run start -- --skip-migrate
# don't forget to migrate manually when you update
npm run migrate
```

## Contributing

1. Fork the repository
2. Create new feature branch
3. Write Code
4. Create an request to merge back into develop

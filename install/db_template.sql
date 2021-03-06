CREATE USER '<dbuser>'@'<dbclient>' IDENTIFIED BY '<dbpass>';
CREATE DATABASE <dbname>;
GRANT ALL PRIVILEGES ON <dbname>.* TO '<dbuser>'@'<dbclient>';
USE <dbname>;
CREATE TABLE users(
	username VARCHAR(25),
	password_hash BINARY(60),
	stream_key CHAR(20),
	record_flag TINYINT
);
CREATE TABLE user_meta(
	username VARCHAR(25),
	title VARCHAR(120),
	about VARCHAR(5000),
	live TINYINT
);
CREATE TABLE chat_integration(
	username VARCHAR(25),
	irc VARCHAR(1000),
	xmpp VARCHAR(1000),
	twitch VARCHAR(1000),
	discord VARCHAR(1000)
);
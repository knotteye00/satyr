CREATE USER 'satyr'@'localhost' IDENTIFIED BY 'password';
CREATE DATABASE satyr_db;
GRANT ALL PRIVILEGES ON satyr_db.* TO 'satyr'@'localhost';
USE satyr_db;
CREATE TABLE users(
	username VARCHAR(25),
	password_hash BINARY(60),
	stream_key CHAR(20),
	record_flag TINYINT,
	is_mod TINYINT
);
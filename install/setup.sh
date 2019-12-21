#!/bin/sh
echo "Please answer a few questions about your instance to get started."
echo "Default values are in brackets."
name=""
while [ -z "$name" ]
do
	echo "Please enter a name for your instance.[]"
	read name
done
domain=""
while [ -z "$domain" ]
do
	echo "Please the domain name for your instance.[]"
	read domain
done
echo "Enter the contact email for the instance."
read email
echo "Please enter the path to the ffmpeg binary on your system.[$(which ffmpeg)]"
read ffmpeg
ffmpeg="${ffmpeg:=$(which ffmpeg)}"
echo "Please enter the user for the database.[satyr]"
read dbuser
dbuser="${dbuser:=satyr}"
echo "Please enter the password for the database.[autogenerated]"
read dbpassword
dbpassword="${dbpass:=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 15 | head -n 1)}"
echo "Please enter the name for the database.[satyr_db]"
read dbname
dbname="${dbname:=satyr_db}"
echo "Please enter the hostname for the database.[localhost]"
read dbhost
dbhost="${dbhost:=localhost}"
if [ "$dbhost" != "localhost" ]
then
echo "Please enter the public ip or hostname this server will connect to the database with.[*]"
read dbclient
dbclient="${dbclient:='*'}"
else
dbclient="localhost"
fi
sed -e "s#<iname>#$name#g" -e "s#<domain>#$domain#g" -e "s#<ffmpeg>#$ffmpeg#g" -e "s#<dbuser>#$dbuser#g" -e "s#<dbname>#$dbname#g" -e "s#<dbpass>#$dbpass#g" -e "s#<dbhost>#$dbhost#g" -e "s#<email>#$email#g" install/config.example.yml > config/generated.yml
sed -e "s#<dbuser>#$dbuser#g" -e "s#<dbname>#$dbname#g" -e "s#<dbpass>#$dbpass#g" -e "s#<dbhost>#$dbhost#g" -e "s#<dbclient>#$dbclient#g" install/db_template.sql > install/db_setup.sql
echo "A setup script for the database has been generated at install/db_setup.sql. Please run it by connecting to your database software and executing 'source install/db_setup.sql;''"
echo "A default configuration file has been generated at config/generated.yml"
echo "If everything looks fine, move it to config/config.yml and start your instance."
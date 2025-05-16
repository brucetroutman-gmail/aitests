1. brew install mysql
2. brew services start mysq
3. mysql_secure_installation 
	a. Would you like to setup VALIDATE PASSWORD component? n
	b. New password: FormR!1234
	c. Re-enter new password: FormR!1234
	d. Remove anonymous users? (Press y|Y for Yes, any other key for No) : y
	e. Disallow root login remotely? (Press y|Y for Yes, any other key for No) :  n
	f. Remove test database and access to it? (Press y|Y for Yes, any other key for No) :  n
	g.Reload privilege tables now? (Press y|Y for Yes, any other key for No) : y
4. mysql -u root -p FormR!1234
	a. CREATE DATABASE performanceDB;
	b. CREATE USER 'nimda'@'localhost' IDENTIFIED BY 'FormR!1234';
	c. GRANT ALL PRIVILEGES ON performanceDB.* TO 'nimda'@'localhost';
	d. FLUSH PRIVILEGES;	
	e.  \q
5. brew install --cask mysqlworkbench
6. open mysqlworkbench
	a. explore database performanceDB

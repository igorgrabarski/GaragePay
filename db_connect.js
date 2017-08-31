// *********** Connection to database ************
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'YOUR_HOST',
    port: 3306,
    user: 'USERNAME',
    password: 'PASSWORD',
    database: 'garagepay'
});

module.exports.connection = connection;

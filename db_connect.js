// ********** Connection to database ************
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'IgOr2708',
    database: 'garagepay'
});

module.exports.connection = connection;
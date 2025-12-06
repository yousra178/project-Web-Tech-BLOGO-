//laadt mysql bibliotheek

const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '???', //zet hier jouw MYSQL password
  database: 'globo',  //database naam
});

module.exports = pool.promise();

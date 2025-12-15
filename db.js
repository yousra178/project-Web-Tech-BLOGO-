// Load mysql library
const mysql = require('mysql2');

const pool = mysql.createPool({  // Create the pool
  host: 'localhost',
  user: 'root',
  password: 'Benna3maninou26**', // Write here your MYSQL password!
  database: 'globo',           
});

module.exports = pool.promise(); // Export the pool

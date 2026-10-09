const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Create database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'autokart_db6'
});

// Read SQL file
const sqlFile = path.join(__dirname, 'database', 'blog_tables.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Split SQL into individual statements
const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

// Execute statements
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }

  console.log('Connected to database. Creating blog tables...');

  let completed = 0;
  const total = statements.length;

  statements.forEach((statement, index) => {
    db.query(statement, (err, result) => {
      completed++;
      
      if (err) {
        console.error(`Error in statement ${index + 1}:`, err.message);
      } else {
        console.log(`Statement ${index + 1}/${total} executed successfully`);
      }

      if (completed === total) {
        console.log('Blog tables setup completed!');
        db.end();
      }
    });
  });
});

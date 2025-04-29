import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function queryDatabase(sqlStatement) {
  // Open the database
  const db = await open({
    filename: './performance_data.db',
    driver: sqlite3.Database
  });
  
  try {
    // Run the provided SQL query

    const rows = await db.all(sqlStatement);

   // Print header
   if (rows.length > 0) {
    console.log(Object.keys(rows[0]).join('\t'));
  }
  
  // Print rows
  rows.forEach(row => {
    console.log(Object.values(row).join('\t'));
  });
  
} catch (error) {
    console.error('SQL Error:', error.message);
  } finally {
    // Close the connection
    await db.close();
  }
}

// Get the SQL statement from command line arguments
const sqlStatement = process.argv[2];

if (!sqlStatement) {
  console.error('Please provide an SQL statement as a command-line argument');
  console.error('Example: node query-sqlite.mjs "SELECT * FROM performance LIMIT 10"');
  process.exit(1);
}

queryDatabase(sqlStatement).catch(console.error);

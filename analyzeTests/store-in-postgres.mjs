// store-in-postgres.mjs
import fs from 'fs';
import pg from 'pg';
import papa from 'papaparse';

const { Pool } = pg;

// PostgreSQL connection config
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'performance_data',
  password: 'postgres!123',
  port: 5432,
});

async function createDatabase() {
  // First connect to the default 'postgres' database
  const initPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Connect to default database first
    password: 'postgres!123', // Make sure this matches your actual password
    port: 5432,
  });

  try {
    // Check if our target database exists
    const checkResult = await initPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'performance_data'"
    );
    
    // If database doesn't exist, create it
    if (checkResult.rows.length === 0) {
      console.log("Creating performance_data database...");
      await initPool.query('CREATE DATABASE performance_data');
      console.log("Database created successfully");
    } else {
      console.log("Database performance_data already exists");
    }
  } catch (err) {
    console.error("Database creation error:", err);
  } finally {
    await initPool.end();
  }

  // Now connect to our target database and create the table
  const newPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'performance_data',
    password: 'postgres!123', // Make sure this matches your actual password
    port: 5432,
  });
  
  const client = await newPool.connect();
  
  try {
    // Get sample data to extract headers
    const sampleData = await getSampleData('./consolidated-data.csv');
    const headers = Object.keys(sampleData[0]);
    
    // Create table based on CSV headers
    let createTableSQL = 'CREATE TABLE IF NOT EXISTS performance (\n  id SERIAL PRIMARY KEY,';
    
    // Add columns based on CSV headers
    headers.forEach(header => {
      const columnName = header.replace(/ +$/,"").replace(/[^a-zA-Z0-9_]/g, '_');
      createTableSQL += `\n  "${columnName}" TEXT,`;
    });
    
    // Remove trailing comma and close parenthesis
    createTableSQL = createTableSQL.slice(0, -1);
    createTableSQL += '\n)';
    
    await client.query(createTableSQL);
    return { client, headers };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

async function getSampleData(filePath, numRows = 1) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(papa.parse(papa.NODE_STREAM_INPUT, { header: true }))
      .on('data', (data) => {
        results.push(data);
        if (results.length >= numRows) {
          resolve(results);
        }
      })
      .on('error', reject);
  });
}

async function importData(headers) {
  const batchSize = 1000;
  let batch = [];
  let totalRows = 0;
  const client = await pool.connect();
  
  try {
    // Prepare column names for SQL
    const columnNames = headers.map(h => `"${h.replace(/ +$/,"").replace(/[^a-zA-Z0-9_]/g, '_')}"`).join(', ');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream('./consolidated-data.csv')
        .pipe(papa.parse(papa.NODE_STREAM_INPUT, { header: true }))
        .on('data', async (row) => {
          const values = headers.map(header => row[header]);
          batch.push(values);
          
          if (batch.length >= batchSize) {
            await insertBatch(client, columnNames, batch, headers.length);
            totalRows += batch.length;
            console.log(`Inserted ${totalRows} rows`);
            batch = [];
          }
        })
        .on('end', async () => {
          if (batch.length > 0) {
            await insertBatch(client, columnNames, batch, headers.length);
            totalRows += batch.length;
          }
          console.log(`Import complete. Total rows: ${totalRows}`);
          resolve(totalRows);
        })
        .on('error', reject);
    });
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

async function insertBatch(client, columnNames, batch, columnCount) {
  // Begin transaction
  await client.query('BEGIN');
  
  try {
    // Create parameterized query with multiple rows
    const placeholders = [];
    const values = [];
    let paramCounter = 1;
    
    batch.forEach((row, rowIndex) => {
      const rowPlaceholders = [];
      for (let i = 0; i < columnCount; i++) {
        rowPlaceholders.push(`$${paramCounter}`);
        values.push(row[i]);
        paramCounter++;
      }
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });
    
    const query = `INSERT INTO performance (${columnNames}) VALUES ${placeholders.join(', ')}`;
    await client.query(query, values);
    
    // Commit transaction
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  try {
    console.log('Creating database...');
    const result = await createDatabase();
    const { headers } = result;
    
    console.log('Importing data...');
    const totalRows = await importData(headers);
    
    console.log('Creating indexes for faster queries...');
    // Add indexes for columns you'll query frequently
    // Example: 
    // const client = await pool.connect();
    // await client.query('CREATE INDEX idx_timestamp ON performance("timestamp")');
    // client.release();
    
    console.log('Database setup complete');
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

main();

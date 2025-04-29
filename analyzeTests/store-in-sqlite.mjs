// store-in-sqlite.mjs
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import papa from 'papaparse';

async function createDatabase() {
  // Open database
  const db = await open({
    filename: './performance_data.db',
    driver: sqlite3.Database
  });
  
  // Create table based on CSV structure
  const sampleData = await getSampleData('./consolidated-data.csv', 1);
  const headers = Object.keys(sampleData[0]);
  
  let createTableSQL = `CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,`;
    
    headers.forEach((header, index) => {
      // Determine column type based on sample data
      const value = sampleData[0][header];
      let type = 'TEXT';
      
      if (value === null || value === undefined) {
        // Handle null/undefined values
        type = 'TEXT';
      } else if (!isNaN(parseFloat(value))) {
        type = 'REAL';
      } else if (typeof value === 'string' && 
                (value.match(/^\d{4}-\d{2}-\d{2}/) || value.match(/^\d{2}\/\d{2}\/\d{4}/))) {
        type = 'DATE';
      }
      
 
      createTableSQL += `\n    ${header.replace(/ +$/,"").replace(/[^a-zA-Z0-9_]/g, '_')} ${type}`;
      if (index < headers.length - 1) createTableSQL += ',';
    });
   
  createTableSQL += '\n)';
  
  await db.exec(createTableSQL);
  return { db, headers };
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

async function importData(db, headers) {
  const batchSize = 1000;
  let batch = [];
  let totalRows = 0;
  
  // Prepare SQL statement
  const placeholders = headers.map(() => '?').join(', ');
  const columnNames = headers.map(h => h.replace(/ +$/,"").replace(/[^a-zA-Z0-9_]/g, '_')).join(', ');
  const stmt = await db.prepare(`INSERT INTO performance (${columnNames}) VALUES (${placeholders})`);
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('./consolidated-data.csv')
      .pipe(papa.parse(papa.NODE_STREAM_INPUT, { header: true }))
      .on('data', async (row) => {
        const values = headers.map(header => row[header]);
        batch.push(values);
        
        if (batch.length >= batchSize) {
          await insertBatch(db, stmt, batch);
          totalRows += batch.length;
          console.log(`Inserted ${totalRows} rows`);
          batch = [];
        }
      })
      .on('end', async () => {
        if (batch.length > 0) {
          await insertBatch(db, stmt, batch);
          totalRows += batch.length;
        }
        await stmt.finalize();
        console.log(`Import complete. Total rows: ${totalRows}`);
        resolve(totalRows);
      })
      .on('error', reject);
  });
}

async function insertBatch(db, stmt, batch) {
  await db.exec('BEGIN TRANSACTION');
  for (const row of batch) {
    await stmt.run(row);
  }
  await db.exec('COMMIT');
}

async function main() {
  try {
    console.log('Creating database...');
    const { db, headers } = await createDatabase();
    
    console.log('Importing data...');
    const totalRows = await importData(db, headers);
    
    console.log('Creating indexes for faster queries...');
    // Add indexes for columns you'll query frequently
    // Example: await db.exec('CREATE INDEX idx_timestamp ON performance(timestamp)');
    
    console.log('Database setup complete');
    await db.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

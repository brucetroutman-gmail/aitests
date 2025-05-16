// store-in-mysql.mjs
import fs from 'fs';
import mysql from 'mysql2/promise';
import papa from 'papaparse';

// MySQL connection config
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'FormR!1234',
  port: 3306
};

async function createDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port
  });

  try {
    const [rows] = await connection.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'performance_data'"
    );

    if (rows.length === 0) {
      console.log("Creating performance_data database...");
      await connection.query('CREATE DATABASE performance_data');
      console.log("Database created successfully");
    } else {
      console.log("Database performance_data already exists");
    }
  } catch (err) {
    console.error("Database creation error:", err);
    throw err;
  } finally {
    await connection.end();
  }

  const pool = await mysql.createPool({
    ...dbConfig,
    database: 'performance_data',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const connection2 = await pool.getConnection();

  try {
    // Update CSV parsing options to handle quoted fields
    const sampleData = await getSampleData('./consolidated-data.csv');
    const headers = Object.keys(sampleData[0]);

    let createTableSQL = 'CREATE TABLE IF NOT EXISTS performance (\n  id INT AUTO_INCREMENT PRIMARY KEY,';
    headers.forEach(header => {
      const columnName = header.replace(/ +$/, "").replace(/[^a-zA-Z0-9_]/g, '_');
      createTableSQL += `\n  \`${columnName}\` TEXT,`;
    });
    createTableSQL = createTableSQL.slice(0, -1) + '\n)';

    await connection2.query(createTableSQL);
    return { pool, headers };
  } catch (error) {
    throw error;
  } finally {
    connection2.release();
  }
}

async function getSampleData(filePath, numRows = 1) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      
      // Parse with delimiter detection
      const results = papa.parse(data, {
        header: true,
        skipEmptyLines: true,
        quoteChar: '"',
        escapeChar: '"',
        dynamicTyping: false,
        // Force all fields to be treated as strings
        transform: value => String(value)
      });
      
      // Debug the first row
      console.log('First row headers:', Object.keys(results.data[0]).length);
      console.log('Sample row data:', Object.keys(results.data[0]));
      
      if (results.data && results.data.length > 0) {
        resolve(results.data.slice(0, numRows));
      } else {
        reject(new Error('No data found in CSV'));
      }
    });
  });
}

async function importData(pool, headers) {
  const batchSize = 1000;
  let batch = [];
  let totalRows = 0;
  let rowNum = 0;
  const connection = await pool.getConnection();

  try {
    // Clean up header names for SQL
    const cleanHeaders = headers.map(h => h.trim());
    const columnNames = cleanHeaders.map(h => `\`${h.replace(/[^a-zA-Z0-9_]/g, '_')}\``).join(', ');

    return new Promise((resolve, reject) => {
      fs.readFile('./consolidated-data.csv', 'utf8', (err, data) => {
        if (err) return reject(err);

        // Use more flexible parsing options
        const results = papa.parse(data, {
          header: true,
          skipEmptyLines: true,
          quoteChar: '"',
          escapeChar: '"',
          dynamicTyping: false,
          transform: value => String(value)
        });

        if (results.errors && results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
          // Continue despite warnings
        }

        const processRows = async () => {
          for (const row of results.data) {
            rowNum++;
            
            try {
              // Only use the headers we know about
              const values = cleanHeaders.map(header => {
                const value = row[header];
                return value !== undefined ? value : '';
              });
              
              // Ensure we have exactly the right number of values
              if (values.length === cleanHeaders.length) {
                batch.push(values);
              } else {
                console.warn(`Skipping row ${rowNum}: Column count mismatch (expected ${cleanHeaders.length}, got ${values.length})`);
                console.log('Problem row:', JSON.stringify(row).substring(0, 200) + '...');
                continue;
              }

              if (batch.length >= batchSize) {
                await insertBatch(connection, columnNames, batch, cleanHeaders.length);
                totalRows += batch.length;
                console.log(`Inserted ${totalRows} rows`);
                batch = [];
              }
            } catch (rowError) {
              console.error(`Error processing row ${rowNum}:`, rowError);
              // Skip this row but continue with others
            }
          }

          if (batch.length > 0) {
            await insertBatch(connection, columnNames, batch, cleanHeaders.length);
            totalRows += batch.length;
          }

          console.log(`Import complete. Total rows: ${totalRows}`);
          resolve(totalRows);
        };

        processRows().catch(reject);
      });
    });
  } catch (error) {
    console.error(`Error at row ${rowNum}:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

async function insertBatch(connection, columnNames, batch, columnCount) {
  await connection.beginTransaction();

  try {
    const placeholders = [];
    batch.forEach(() => {
      const rowPlaceholders = Array(columnCount).fill('?').join(', ');
      placeholders.push(`(${rowPlaceholders})`);
    });

    const flatValues = batch.flat();
    const query = `INSERT INTO performance (${columnNames}) VALUES ${placeholders.join(', ')}`;
    await connection.query(query, flatValues);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  let pool;
  try {
    console.log('Creating database...');
    const result = await createDatabase();
    pool = result.pool;
    const { headers } = result;

    console.log('Importing data...');
    const totalRows = await importData(pool, headers);

    console.log('Creating indexes for faster queries...');
    console.log('Database setup complete');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (pool) await pool.end();
  }
}

main();

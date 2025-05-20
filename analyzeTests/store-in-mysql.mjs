// store-in-mysql.mjs
import fs from 'fs';
import mysql from 'mysql2/promise';
import papa from 'papaparse';
import path from 'path';

// MySQL connection config
const dbConfig = {
  host: '45.32.219.12',
  user: 'nimdas',
  password: 'FormR!1234',
  port: 3306
};

// Improved column name transformation
function transformColumnName(header) {
  return String(header)
    .trim()                      // Remove leading/trailing whitespace
    .replace(/\s+/g, "")         // Remove all spaces
    .replace(/[^a-zA-Z0-9]/g, ''); // Remove special chars including backticks
} 
  // Ensure it doesn't start with a number (MySQL restriction)
  //return /^\d/.test(cleaned) ? `col_${cleaned}` : cleaned;


// Improved function to guess data types from sample data
function guessColumnType(values) {
  // Remove undefined, null, and empty values
  const cleanValues = values.filter(v => v !== undefined && v !== null && v !== '');
  
  if (cleanValues.length === 0) return 'TEXT';
  
  // Check if all values are numbers
  const allNumbers = cleanValues.every(v => !isNaN(Number(v)) && v.trim() !== '');
  if (allNumbers) {
    // Check if all values are integers
    const allIntegers = cleanValues.every(v => Number.isInteger(Number(v)));
    if (allIntegers) {
      // Determine integer size based on max value
      const maxValue = Math.max(...cleanValues.map(v => Math.abs(Number(v))));
      if (maxValue < 128) return 'TINYINT';
      if (maxValue < 32768) return 'SMALLINT';
      if (maxValue < 8388608) return 'MEDIUMINT';
      if (maxValue < 2147483648) return 'INT';
      return 'BIGINT';
    }
    return 'DOUBLE';
  }
  
  // Check if all values are dates
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
  const allDates = cleanValues.every(v => datePattern.test(v.trim()));
  if (allDates) return 'DATE';
  
  // Check if all values are timestamps
  const timestampPattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{1,2}:\d{1,2}/;
  const allTimestamps = cleanValues.every(v => timestampPattern.test(v.trim()));
  if (allTimestamps) return 'DATETIME';
  
  // Check string length for VARCHAR vs TEXT
  const maxLength = Math.max(...cleanValues.map(v => String(v).length));
  if (maxLength < 256) return `VARCHAR(${maxLength})`;
  if (maxLength < 65536) return 'TEXT';
  if (maxLength < 16777216) return 'MEDIUMTEXT';
  return 'LONGTEXT';
}

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
    // Get a larger sample to better determine column types
    const sampleData = await getSampleData('./consolidated-data.csv', 100);
    const headers = Object.keys(sampleData[0]);
    
    // For each column, collect sample values to determine best data type
    const columnTypes = {};
    headers.forEach(header => {
      const values = sampleData.map(row => row[header]);
      columnTypes[header] = guessColumnType(values);
    });
    
    console.log("Detected column types:", columnTypes);

    let createTableSQL = 'CREATE TABLE IF NOT EXISTS performance (\n  id INT AUTO_INCREMENT PRIMARY KEY,';
    headers.forEach(header => {
      const columnName = transformColumnName(header);
      const columnType = columnTypes[header];
      createTableSQL += `\n  \`${columnName}\` ${columnType},`;
    });

    createTableSQL = createTableSQL.slice(0, -1) + '\n)';

    try {
      await connection2.query(createTableSQL);
      console.log("Table created successfully with SQL:", createTableSQL);
    } catch (error) {
      console.error("Failed to create table:", error);
      throw error;
    }
    
    return { pool, headers, columnTypes };
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
      
    // Normalize line endings before parsing
    data = data.replace(/\r\n|\r/g, "\n");

    // Parse with consistent header transformation
      const results = papa.parse(data, {
        header: true,
        skipEmptyLines: true,
        delimiter: "\t", // Change to tab delimiter
        quoteChar: '"',
        escapeChar: '"',
        dynamicTyping: false,
        transformHeader: header => header.trim(), // transformHeader: header => transformColumnName(header),
        transform: value => String(value)
      });
      
      // Debug the first row
      console.log('First row headers count:', Object.keys(results.data[0]).length);
      console.log('Sample headers (transformed):', Object.keys(results.data[0]));
      
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
  let skippedRows = 0;
  let rowNum = 0;
  const connection = await pool.getConnection();

  try {
    const cleanHeaders = headers.map(h => h.trim());
    const transformedHeaders = cleanHeaders.map(h => transformColumnName(h));
    const columnNames = transformedHeaders.map(h => `\`${h}\``).join(', ');

    console.log('Using these transformedHeaders:', transformedHeaders);
  
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream('./consolidated-data.csv');
      
      papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        delimiter: "\t",
        quoteChar: '"',
        escapeChar: '"',
        transformHeader: header => header.trim(),
        step: async function(result, parser) {
          rowNum++;
          
          try {
            // Check if we have the expected fields
            if (Object.keys(result.data).length !== cleanHeaders.length) {
              console.warn(`Row ${rowNum}: Field count mismatch (expected ${cleanHeaders.length}, got ${Object.keys(result.data).length})`);
              skippedRows++;
              
              if (skippedRows <= 3) {
                console.log('Problem row:', JSON.stringify(result.data).substring(0, 200) + '...');
                console.log('Fields found:', Object.keys(result.data));
              }
              return;
            }
            
            // Only use the fields we know about
            const values = cleanHeaders.map(header => {
              // Get data using original header
              const value = result.data[header];
              
              // For debug purposes
              if (value === undefined && rowNum <= 10) {
                console.log(`Missing value for header: "${header}" in row ${rowNum}`);
              }
              
              return value !== undefined ? value : '';
            });
            
            batch.push(values);
            
            if (batch.length >= batchSize) {
              // Pause parsing while we insert the batch
              parser.pause();
              
              try {
                await insertBatch(connection, columnNames, batch, cleanHeaders.length);
                totalRows += batch.length;
                console.log(`Inserted ${totalRows} rows (${skippedRows} skipped)`);
                batch = [];
              } catch (insertError) {
                console.error('Error inserting batch:', insertError);
              }
              
              // Resume parsing
              parser.resume();
            }
          } catch (rowError) {
            console.error(`Error processing row ${rowNum}:`, rowError);
          }
        },
        complete: async function() {
          try {
            if (batch.length > 0) {
              await insertBatch(connection, columnNames, batch, cleanHeaders.length);
              totalRows += batch.length;
            }
            
            console.log(`Import complete. Total rows: ${totalRows}, Skipped rows: ${skippedRows}`);
            resolve(totalRows);
          } catch (error) {
            reject(error);
          }
        },
        error: function(error) {
          reject(error);
        }
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

async function createIndexes(pool, headers) {
  const connection = await pool.getConnection();
  try {
    console.log("Creating useful indexes...");
    
    // Create indexes on columns that might be frequently used in WHERE clauses
    // This is just an example - you should customize based on your query patterns
    const potentialIndexColumns = ['date', 'id', 'name', 'category', 'type'];
    
    const transformedHeaders = headers.map(h => transformColumnName(h.trim()));
    
    // Find columns that match our potential index names
    const columnsToIndex = transformedHeaders.filter(header => {
      const lowerHeader = header.toLowerCase();
      return potentialIndexColumns.some(col => lowerHeader.includes(col));
    });
    
    // Create an index for each identified column
    for (const column of columnsToIndex) {
      try {
        console.log(`Creating index on ${column}...`);

        await connection.query(
          `CREATE INDEX idx_${column} ON performance (\`${column}\`)`
        );

      } catch (err) {
        console.warn(`Could not create index on ${column}:`, err.message);
      }
    }
    
    console.log("Index creation complete");
  } catch (err) {
    console.error("Error creating indexes:", err);
  } finally {
    connection.release();
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
    await createIndexes(pool, headers);
    
    console.log('Database setup complete');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (pool) await pool.end();
  }
}

main();

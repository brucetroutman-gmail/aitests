import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MySQL connection configuration
const config = {
  host: '45.32.219.12',
  user: 'nimdas', // Change to your MySQL username
  password: 'FormR!1234', // Change to your MySQL password
  database: 'scoredResponsesBaseTest',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Initialize database and tables
async function initializeDatabase() {
  // First connect without specifying a database
  const connection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password
  });

  console.log('Connected to MySQL server');
  
  try {
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
    console.log(`Database '${config.database}' created or already exists`);
    
    // Switch to the database
    await connection.query(`USE ${config.database}`);
    
    // Create scores table if it doesn't exist
    await connection.query(`
    CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pc_no VARCHAR(50),
    modelName VARCHAR(100) NOT NULL,
    responseFileName VARCHAR(255),
    runAT VARCHAR(50),
    accurateScore INT,
    relevantScore INT,
    organizationScore INT,
    totalScore DECIMAL(6,2),
    weightedScore DECIMAL(6,2),
    totalDuration FLOAT,
    loadDuration FLOAT,
    promptEvalCount INT,
    promptEvalDuration FLOAT,
    promptEvalRate DECIMAL(10,2),
    evalCount INT,
    evalDuration FLOAT,
    evalRate DECIMAL(10,2),
    timestamp DATETIME,
    fileName VARCHAR(255)
    );
    `);
    console.log("Table 'scores' created or already exists");
  } finally {
    await connection.end();
    console.log('Initial setup connection closed');
  }
}

// Import JSON scores into database
async function importScores() {
  // Create a connection pool
  const pool = mysql.createPool(config);
  
  try {
    // Get all JSON files in the directory
    const files = await fs.readdir(__dirname);
    const jsonFiles = files.filter(file => 
      file.startsWith('simplifiedScore_') && file.endsWith('.json')
    );
    
    if (jsonFiles.length === 0) {
      console.log('No JSON score files found to import');
      return;
    }
    
    console.log(`Found ${jsonFiles.length} JSON files to process`);
    
    // Process each file
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(__dirname, file);
        const jsonContent = await fs.readFile(filePath, 'utf8');
        const scoreData = JSON.parse(jsonContent);
        
        // Extract MAC address or use a default if not available
        const pc_no = scoreData.pc_no || 'UNKNOWN';
 
        // Insert data into the scores table
        const [result] = await pool.query(
          `INSERT INTO scores (
            pc_no, modelName, responseFileName, runAt, accurateScore, relevantScore, organizationScore,
            totalScore, weightedScore, totalDuration, loadDuration, promptEvalCount,
            promptEvalDuration, promptEvalRate, evalCount, evalDuration,
            evalRate, timestamp, fileName
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pc_no,
            scoreData.modelName,
            scoreData.responseFileName,
            scoreData.runAt,
            scoreData.scores.accurate || 0,
            scoreData.scores.relevant || 0,
            scoreData.scores.organization || 0,
            scoreData.scores.totalScore || 0,
            scoreData.scores.weightedScore || 0,
            scoreData.performanceMetrics.totalDuration || 0,
            scoreData.performanceMetrics.loadDuration || 0,
            scoreData.performanceMetrics.promptEvalCount || 0,
            scoreData.performanceMetrics.promptEvalDuration || 0,
            scoreData.performanceMetrics.promptEvalRate || 0,
            scoreData.performanceMetrics.evalCount || 0,
            scoreData.performanceMetrics.evalDuration || 0,
            scoreData.performanceMetrics.evalRate || 0,
            new Date(scoreData.timestamp),
            file
          ]
        );
        
        console.log(`Imported ${file}: ID ${result.insertId}`);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error importing scores:', error.message);
  } finally {
    await pool.end();
    console.log('Database connection pool closed');
  }
}

// Main function
async function main() {
  try {
    await initializeDatabase();
    await importScores();
    console.log('Import process completed');
  } catch (error) {
    console.error('Error in main process:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

// import-benchmarks-mysql.mjs
import fs from 'fs';
import mysql from 'mysql2/promise';

// Function to create the database and import the JSON data
async function importBenchmarkToMySQL(jsonFilePath, config) {
  let connection;
  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create initial connection WITHOUT specifying a database
    const initialConfig = {...config};
    delete initialConfig.database; // Remove database from initial connection config
    
    // Connect to MySQL server without specifying a database
    connection = await mysql.createConnection(initialConfig);
    
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
    
    // Now use the created database
    await connection.query(`USE ${config.database}`);
    
    // Create tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS models (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        text TEXT,
        UNIQUE KEY (text(255))
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS benchmark_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        model_id INT,
        prompt_id INT,
        time_taken FLOAT,
        response LONGTEXT,
        success BOOLEAN,
        FOREIGN KEY (model_id) REFERENCES models(id),
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      )
    `);
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Process each model in the JSON data
      for (const [modelName, prompts] of Object.entries(jsonData)) {
        // Insert model (ignore if already exists)
        await connection.query('INSERT IGNORE INTO models (name) VALUES (?)', [modelName]);
        
        // Process each prompt for the current model
        for (const [promptText, result] of Object.entries(prompts)) {
          // Check the structure of the result
          console.log(`Processing result for model ${modelName}, prompt: ${promptText.substring(0, 50)}...`);
          console.log('Result structure:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
          
          // Ensure result has the expected properties
          const timeTaken = result.timeTaken || 0;
          const response = (result.response && typeof result.response === 'object' && result.response.response) 
                ? result.response.response 
                : (typeof result.response === 'string' ? result.response : ''); 
                
          const success = result.success !== undefined ? (result.success ? 1 : 0) : 0;
          
          // Insert prompt (ignore if already exists)
          await connection.query('INSERT IGNORE INTO prompts (text) VALUES (?)', [promptText]);
          
          // Get model ID and prompt ID
          const [modelRows] = await connection.query('SELECT id FROM models WHERE name = ?', [modelName]);
          const [promptRows] = await connection.query('SELECT id FROM prompts WHERE text = ?', [promptText]);
          
          if (modelRows.length > 0 && promptRows.length > 0) {
            const modelId = modelRows[0].id;
            const promptId = promptRows[0].id;
            
            // Log the values we're trying to insert
            console.log('Inserting values:', {
              modelId,
              promptId,
              timeTaken,
              responseLength: response.length,
              success
            });
            
            // Insert the benchmark result with explicit column names
            await connection.query(
              `INSERT INTO benchmark_results 
               (model_id, prompt_id, time_taken, response, success) 
               VALUES (?, ?, ?, ?, ?)`,
              [modelId, promptId, timeTaken, response, success]
            );
          }
        }
      }
      
      // Commit transaction
      await connection.commit();
      console.log(`Successfully imported benchmark data into ${config.database}`);
      
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    }
    
    // Create useful views
    // View that joins all the data together for easy querying
    await connection.query(`
      CREATE OR REPLACE VIEW benchmark_view AS
      SELECT 
        m.name as model_name,
        p.text as prompt_text,
        br.time_taken,
        br.success,
        br.response
      FROM benchmark_results br
      JOIN models m ON br.model_id = m.id
      JOIN prompts p ON br.prompt_id = p.id
    `);
    
    // View for summary statistics by model
    await connection.query(`
      CREATE OR REPLACE VIEW model_stats AS
      SELECT 
        m.name as model_name,
        COUNT(*) as total_prompts,
        SUM(CASE WHEN br.success = 1 THEN 1 ELSE 0 END) as successful_prompts,
        AVG(br.time_taken) as avg_time,
        MIN(br.time_taken) as min_time,
        MAX(br.time_taken) as max_time
      FROM benchmark_results br
      JOIN models m ON br.model_id = m.id
      GROUP BY m.name
    `);
    
    return true;
    
  } catch (error) {
    console.error('Error importing benchmark data:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// MySQL connection configuration
const config = {
  host: 'localhost',
  user: 'root', // Change to your MySQL username
  password: 'FormR!1234', // Change to your MySQL password
  database: 'ollama_benchmarks',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Check for command line arguments
const jsonFilePath = process.argv[2] || 'benchmark_results.json';

// Run the import
importBenchmarkToMySQL(jsonFilePath, config)
  .then((success) => {
    if (success) {
      console.log('Import complete!');
      console.log('You can now query the database with SQL commands.');
      console.log('Example queries:');
      console.log('- SELECT * FROM benchmark_view LIMIT 5;');
      console.log('- SELECT * FROM model_stats ORDER BY avg_time ASC;');
      console.log('- SELECT model_name, AVG(time_taken) FROM benchmark_view GROUP BY model_name ORDER BY AVG(time_taken);');
    }
  })
  .catch(err => console.error('Import failed:', err));

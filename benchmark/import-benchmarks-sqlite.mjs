import fs from 'fs';
import sqlite3 from 'sqlite3';
const { verbose } = sqlite3;
const sqlite = verbose();

// Function to create the database and import the JSON data
async function importBenchmarkToSQLite(jsonFilePath, dbFilePath) {
  // Read the JSON file
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create/connect to SQLite database
    const db = new sqlite.Database(dbFilePath);
    
    // Run everything in a transaction for better performance
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Begin transaction
        db.run('BEGIN TRANSACTION');
        
        // Create tables
        db.run(`
          CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT UNIQUE
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS benchmark_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER,
            prompt_id INTEGER,
            time_taken REAL,
            response TEXT,
            success INTEGER,
            FOREIGN KEY (model_id) REFERENCES models(id),
            FOREIGN KEY (prompt_id) REFERENCES prompts(id)
          )
        `);
        
        // Prepare statements for insertion
        const insertModel = db.prepare('INSERT OR IGNORE INTO models (name) VALUES (?)');
        const insertPrompt = db.prepare('INSERT OR IGNORE INTO prompts (text) VALUES (?)');
        const insertResult = db.prepare(`
          INSERT INTO benchmark_results (model_id, prompt_id, time_taken, response, success)
          VALUES (
            (SELECT id FROM models WHERE name = ?),
            (SELECT id FROM prompts WHERE text = ?),
            ?, ?, ?
          )
        `);
        
        // Process each model in the JSON data
        Object.entries(jsonData).forEach(([modelName, prompts]) => {
          insertModel.run(modelName);
          
          // Process each prompt for the current model
          Object.entries(prompts).forEach(([promptText, result]) => {
            insertPrompt.run(promptText);
            
            // Insert the benchmark result
            insertResult.run(
              modelName,
              promptText,
              result.timeTaken,
              result.response,
              result.success ? 1 : 0
            );
          });
        });
        
        // Finalize prepared statements
        insertModel.finalize();
        insertPrompt.finalize();
        insertResult.finalize();
        
        // Commit transaction
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    // Create useful views
    db.serialize(() => {
      // View that joins all the data together for easy querying
      db.run(`
        CREATE VIEW IF NOT EXISTS benchmark_view AS
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
      db.run(`
        CREATE VIEW IF NOT EXISTS model_stats AS
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
    });
    
    console.log(`Successfully imported benchmark data into ${dbFilePath}`);
    db.close();
    
  } catch (error) {
    console.error('Error importing benchmark data:', error);
  }
}

// Check for command line arguments
const jsonFilePath = process.argv[2] || 'benchmark_results.json';
const dbFilePath = process.argv[3] || 'ollama_benchmarks.db';

// Run the import
importBenchmarkToSQLite(jsonFilePath, dbFilePath)
  .then(() => {
    console.log('Import complete!');
    console.log('You can now query the database with SQL commands.');
    console.log('Example queries:');
    console.log('- SELECT * FROM benchmark_view LIMIT 5;');
    console.log('- SELECT * FROM model_stats ORDER BY avg_time ASC;');
    console.log('- SELECT model_name, AVG(time_taken) FROM benchmark_view GROUP BY model_name ORDER BY AVG(time_taken);');
  })
  .catch(err => console.error('Import failed:', err));

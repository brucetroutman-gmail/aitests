// init-and-run-promptfoo.mjs
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Get current directory (ES6 module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Function to get formatted date
function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

// Function to check if promptfoo is installed
async function checkPrompfooInstalled() {
  try {
    const { stdout } = await execPromise('npx --no-install promptfoo --version');
    console.log(`Promptfoo version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.log('Promptfoo not found, installing...');
    try {
      const { stdout } = await execPromise('npm install promptfoo');
      console.log(stdout);
      return true;
    } catch (installError) {
      console.error(`Failed to install promptfoo: ${installError.message}`);
      return false;
    }
  }
}

// Function to ensure config file exists
async function ensureConfigExists() {
  const configPath = path.join(__dirname, 'promptfoo.yaml');
  
  if (await fileExists(configPath)) {
    console.log('Configuration file found.');
    return true;
  }
  
  // If no config, try to initialize
  console.log('No configuration file found. Attempting to initialize...');
  try {
    const { stdout } = await execPromise('npx promptfoo init --yes');
    console.log(stdout);
    console.log('Basic configuration created. Please check and modify promptfoo.yaml as needed.');
    return true;
  } catch (error) {
    console.error(`Failed to initialize config: ${error.message}`);
    return false;
  }
}

// Function to ensure required directories exist
async function ensureDirectoriesExist() {
  const resultsDir = path.join(__dirname, 'evaluation-results');
  
  try {
    await fs.mkdir(resultsDir, { recursive: true });
    console.log('Directories verified.');
    return true;
  } catch (error) {
    console.error(`Failed to create directories: ${error.message}`);
    return false;
  }
}

// Function to run promptfoo evaluation
async function runEvaluation() {
  console.log('Running promptfoo evaluation...');
  
  try {
    // Try different command variations
    try {
      const { stdout } = await execPromise('npx promptfoo eval');
      console.log(stdout);
      return true;
    } catch (error) {
      console.log('First command failed, trying alternate command...');
      const { stdout } = await execPromise('npx --no-install promptfoo evaluate');
      console.log(stdout);
      return true;
    }
  } catch (error) {
    console.error(`All evaluation commands failed: ${error.message}`);
    
    // Print available commands
    try {
      const { stdout } = await execPromise('npx promptfoo --help');
      console.log('Available promptfoo commands:');
      console.log(stdout);
    } catch (helpError) {
      console.error(`Could not get help: ${helpError.message}`);
    }
    
    return false;
  }
}

// Main function
async function main() {
  try {
    // Setup and checks
    const installed = await checkPrompfooInstalled();
    if (!installed) {
      console.error('Could not verify promptfoo installation. Exiting.');
      process.exit(1);
    }
    
    const configExists = await ensureConfigExists();
    if (!configExists) {
      console.error('Could not verify configuration. Exiting.');
      process.exit(1);
    }
    
    const dirsExist = await ensureDirectoriesExist();
    if (!dirsExist) {
      console.error('Could not verify directories. Exiting.');
      process.exit(1);
    }
    
    // Run evaluation
    const evalSuccess = await runEvaluation();
    if (!evalSuccess) {
      console.error('Evaluation failed. Exiting.');
      process.exit(1);
    }
    
    console.log('Evaluation completed successfully.');
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
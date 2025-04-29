// run-evaluation.mjs
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES6 module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Function to run promptfoo evaluation using promises
function runEvaluation() {
  return new Promise((resolve, reject) => {
    console.log('Running promptfoo evaluation...');
    
    // Run promptfoo command - fixed to use correct syntax
    exec('npx promptfoo eval', (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error running promptfoo: ${error.message}`));
        return;
      }
      
      if (stderr) {
        console.warn(`Warnings: ${stderr}`);
      }
      
      console.log(stdout);
      resolve();
    });
  });
}

// Function to read and format results
async function formatResults() {
  // Find the most recent results file
  const resultsDir = path.join(__dirname, 'evaluation-results');
  const files = await fs.readdir(resultsDir);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    throw new Error('No results files found');
  }
  
  // Get file stats for sorting
  const fileStats = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = path.join(resultsDir, file);
      const stats = await fs.stat(filePath);
      return { file, mtime: stats.mtime.getTime() };
    })
  );
  
  // Sort by creation date (newest first)
  const sortedFiles = fileStats.sort((a, b) => b.mtime - a.mtime);
  
  // Read the most recent file
  const latestFile = sortedFiles[0].file;
  const resultsJson = await fs.readFile(path.join(resultsDir, latestFile), 'utf-8');
  const results = JSON.parse(resultsJson);
  
  // Format output similar to your original script
  const testCase = results.results[0]; // First test case
  const evaluationResult = testCase.evaluations.find(e => e.id === 'five-criteria-evaluation');
  
  if (!evaluationResult) {
    throw new Error('Evaluation results not found');
  }
  
  // Format the evaluation output
  const formattedOutput = `
### Evaluation for Response

**Factual Accuracy**: ${evaluationResult.factual_accuracy}/10  
Justification: ${evaluationResult.factual_accuracy_justification}

**Structured Response**: ${evaluationResult.structured_response}/10  
Justification: ${evaluationResult.structured_response_justification}

**Multiple Perspectives**: ${evaluationResult.multiple_perspectives}/10  
Justification: ${evaluationResult.multiple_perspectives_justification}

**Actionable Suggestions**: ${evaluationResult.actionable_suggestions}/10  
Justification: ${evaluationResult.actionable_suggestions_justification}

**Reflection**: ${evaluationResult.reflection}/10  
Justification: ${evaluationResult.reflection_justification}

**Total Score**: ${evaluationResult.total_score}/50  
Overall Comments: ${evaluationResult.overall_comments}

**Performance Metrics**:
Test completed in: ${testCase.duration}ms
Model: ${testCase.provider}
`;

  // Write the formatted results to a file
  const dateStr = getFormattedDate();
  const outputFileName = `GradedResponse_${evaluationResult.total_score}_${testCase.provider}_${dateStr}.txt`;
  const outputPath = path.join(__dirname, outputFileName);
  await fs.writeFile(outputPath, formattedOutput);
  
  console.log(formattedOutput);
  console.log(`Evaluation written to ${outputFileName}`);
}

// Main function
async function main() {
  try {
    await runEvaluation();
    await formatResults();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
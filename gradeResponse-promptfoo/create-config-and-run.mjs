// create-config-and-run.mjs
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Get current directory
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

// Function to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Function to create configuration file
async function createConfigFile() {
  const configPath = path.join(__dirname, 'promptfoo.yaml');
  
  // Create a proper configuration file based on your requirements
  const configContent = `
# Promptfoo Configuration

# Define providers (the models you want to use)
providers:
  - id: ollama-gemma
    provider: ollama
    model: gemma3:1b

# Define the prompts to test
prompts:
  - file: prompt-system.txt
    vars:
      user_prompt: file:prompt-user.txt
      response_to_evaluate: file:response.txt

# Define test cases/scenarios
tests:
  - description: "Evaluate model response"
    vars:
      user_prompt: file:prompt-user.txt
      response_to_evaluate: file:response.txt

# Define the evaluation metrics
evaluations:
  - type: llm-rubric
    provider: ollama-gemma
    prompt: |
      You are an expert evaluator tasked with grading a response based on five criteria: Factual Accuracy, Structured Response, Multiple Perspectives, Actionable Suggestions, and Reflection. Below are the definitions for each criterion and the scoring instructions.

      ### Scoring Criteria Definitions
      - **Factual Accuracy**: The degree to which the response contains correct, verifiable information supported by evidence or widely accepted knowledge. It should be free from errors, fabrications, or hallucinations and align with the prompt's context.
        - Score 10: Entirely accurate with no errors or unsupported claims.
        - Score 1: Major factual errors or fabrications dominate the response.
      - **Structured Response**: The organization, clarity, and logical flow of the response. A well-structured response is coherent, easy to follow, and uses appropriate formatting (e.g., headings, bullet points) to present ideas systematically.
        - Score 10: Exceptionally clear, logically organized, and well-formatted.
        - Score 1: Disorganized, incoherent, or lacks any clear structure.
      - **Multiple Perspectives**: The extent to which the response acknowledges and incorporates diverse viewpoints, stakeholders, or approaches relevant to the prompt. It should demonstrate inclusivity and avoid undue bias.
        - Score 10: Fully incorporates diverse, relevant perspectives with balance.
        - Score 1: Ignores alternative viewpoints or is heavily biased.
      - **Actionable Suggestions**: The presence of practical, feasible recommendations or steps that users can realistically implement to address the prompt's query or problem.
        - Score 10: Specific, realistic, and highly actionable suggestions.
        - Score 1: No suggestions or entirely vague/impractical ones.
      - **Reflection**: The response's ability to draw broader lessons, insights, or implications, connecting specific details to larger themes, trends, or universal principles.
        - Score 10: Deep, insightful reflections with clear broader implications.
        - Score 1: No reflection or superficial comments without depth.

      ### Input
      - **System Prompt**: {{prompt}}
      - **User Prompt**: {{user_prompt}}
      - **Response to Evaluate**: {{response_to_evaluate}}

      ### Instructions
      1. Evaluate the response based on the five criteria.
      2. Assign a score from 1 to 10 for each criterion.
      3. Provide a brief justification for each score.
      4. Format your response as follows:

      **Factual Accuracy**: [Score]/10
      Justification: [Your reasoning]

      **Structured Response**: [Score]/10
      Justification: [Your reasoning]

      **Multiple Perspectives**: [Score]/10
      Justification: [Your reasoning]

      **Actionable Suggestions**: [Score]/10
      Justification: [Your reasoning]

      **Reflection**: [Score]/10
      Justification: [Your reasoning]

      **Total Score**: [Total Score]/50
      Overall Comments: [Optional brief summary or additional notes]

# Output configuration
output:
  - format: json
    file: "evaluation-results/results-{{DATE}}.json"
  - format: html
    file: "evaluation-results/report-{{DATE}}.html"
`;

try {
  await fs.writeFile(configPath, configContent);
  console.log(`Configuration file created at ${configPath}`);
  return true;
} catch (error) {
  console.error(`Error creating configuration file: ${error.message}`);
  return false;
}
}

// Function to ensure source files exist
async function ensureSourceFiles() {
  const requiredFiles = ['prompt-system.txt', 'prompt-user.txt', 'response.txt'];
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (!(await fileExists(filePath))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    console.error(`Missing required files: ${missingFiles.join(', ')}`);
    console.log('Please create these files with appropriate content.');
    return false;
  }
  
  console.log('All required source files exist.');
  return true;
}

// Function to ensure results directory exists
async function ensureResultsDir() {
  const resultsDir = path.join(__dirname, 'evaluation-results');
  
  try {
    await fs.mkdir(resultsDir, { recursive: true });
    console.log(`Results directory created at ${resultsDir}`);
    return true;
  } catch (error) {
    console.error(`Error creating results directory: ${error.message}`);
    return false;
  }
}

// Function to run evaluation
async function runEvaluation() {
  console.log('Running promptfoo evaluation...');
  
  try {
    const { stdout, stderr } = await execPromise('npx promptfoo eval');
    
    if (stderr) {
      console.warn(`Warnings: ${stderr}`);
    }
    
    console.log(stdout);
    return true;
  } catch (error) {
    console.error(`Error running evaluation: ${error.message}`);
    return false;
  }
}

// Function to format results
async function formatResults() {
  console.log('Formatting results...');
  
  try {
    // Find the most recent results file
    const resultsDir = path.join(__dirname, 'evaluation-results');
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('No results files found. Evaluation may not have produced output.');
      return false;
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
    const filePath = path.join(resultsDir, latestFile);
    console.log(`Reading results from ${filePath}`);
    
    const resultsJson = await fs.readFile(filePath, 'utf-8');
    const results = JSON.parse(resultsJson);
    
    console.log('Results file read successfully.');
    
    // Extract evaluation results - this will depend on the exact structure of your output
    // This is a simplified example that may need to be adjusted
    const evaluationResults = results.results[0].outputs[0].output;
    
    // Simple parsing of the evaluation text to extract scores
    const scores = {};
    const scoreRegex = /\*\*([^:]+)\*\*: (\d+)\/10/g;
    let match;
    let totalScore = 0;
    
    while ((match = scoreRegex.exec(evaluationResults)) !== null) {
      const criterion = match[1].trim();
      const score = parseInt(match[2], 10);
      scores[criterion] = score;
      
      if (criterion !== 'Total Score') {
        totalScore += score;
      }
    }
    
    // Format the evaluation output
    const formattedOutput = evaluationResults + `\n\nEvaluation completed using promptfoo with ollama-gemma model.`;
    
    // Write to file with date
    const dateStr = getFormattedDate();
    const outputFileName = `GradedResponse_${totalScore}_ollama-gemma_${dateStr}.txt`;
    const outputPath = path.join(__dirname, outputFileName);
    await fs.writeFile(outputPath, formattedOutput);
    
    console.log(`\n${formattedOutput}\n`);
    console.log(`Evaluation written to ${outputFileName}`);
    
    return true;
  } catch (error) {
    console.error(`Error formatting results: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    // Create config file
    await createConfigFile();
    
    // Ensure required files exist
    const filesExist = await ensureSourceFiles();
    if (!filesExist) {
      return;
    }
    
    // Ensure results directory exists
    await ensureResultsDir();
    
    // Run evaluation
    const evalSuccess = await runEvaluation();
    if (!evalSuccess) {
      return;
    }
    
    // Format results
    await formatResults();
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Run the script
main();
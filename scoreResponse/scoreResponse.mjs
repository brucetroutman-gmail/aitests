import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ollama from 'ollama';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get pc_no from hardware serial number
async function getPCNumber() {
  try {
    // Use the child_process module to execute system commands
    const { execSync } = await import('child_process');
    let serialNumber;
    
    // Different commands for different OS
    if (process.platform === 'win32') {
      // For Windows - get BIOS serial number
      const output = execSync('wmic bios get serialnumber').toString().trim();
      serialNumber = output.split('\n')[1].trim(); // Extract the serial number
    } else if (process.platform === 'darwin') {
      // For macOS - get hardware serial
      serialNumber = execSync("system_profiler SPHardwareDataType | grep 'Serial Number' | awk '{print $4}'").toString().trim();
    } else {
      // For Linux - try to get system serial from DMI
      serialNumber = execSync("sudo dmidecode -s system-serial-number").toString().trim();
    }
    
    if (!serialNumber || serialNumber === 'To be filled by O.E.M.' || serialNumber === 'System Serial Number') {
      throw new Error('Could not determine valid serial number');
    }
    
    // Create pc_no from first 3 and last 3 characters of the serial number
    const cleanSerial = serialNumber.replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters
    const pcNo = cleanSerial.substring(0, 3) + cleanSerial.substring(cleanSerial.length - 3);
    
    return pcNo;
  } catch (error) {
    console.error(`Error getting serial number: ${error.message}`);
    return 'UNKNOWN'; // Fallback value
  }
}


// Function to read file content
async function readFileContent(fileName) {
  const filePath = path.join(__dirname, fileName);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Error reading ${fileName}: ${error.message}`);
  }
}

// Function to format current date as YYMMDD-MMSS
function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

// Function to check if Ollama server is running
async function checkOllamaServer() {
  try {
    await ollama.list(); // Check if server is reachable
    console.log('Ollama server is reachable.');
    console.log('Debug: Adding debug checkpoint after server check');
  } catch (error) {
    throw new Error(`Ollama server is not running or unreachable: ${error.message}`);
  }
}


// Function to format duration (nanoseconds to seconds or milliseconds)
function formatDuration(ns) {
  if (ns < 1e6) return `${(ns / 1e6).toFixed(2)}ms`;
  return `${(ns / 1e9).toFixed(2)}`;
}


// Function to evaluate response using Ollama
async function evaluateResponse(modelName, userPrompt, systemPrompt, response) {
  const evaluationPrompt = `
You are an expert evaluator tasked with grading a response based on three criteria: Accuracy, Relevance, and Coherence. Below are the definitions for each criterion and the scoring instructions.
### Scoring Criteria Definitions
-##Accurate (1-5)
The degree to which the response contains correct, verifiable information supported by evidence or widely accepted knowledge.

Score 5: Entirely accurate with no errors. All information is verifiable and precisely addresses requirements.
Score 4: Highly accurate with minimal errors that don't impact overall value.
Score 3: Generally accurate with a few minor errors or slightly unsupported assertions.
Score 2: Mixed accuracy with noticeable errors or unverifiable claims alongside correct information.
Score 1: Predominantly inaccurate with major factual errors or fabrications.

-##Relevant (1-5)
The extent to which the response directly addresses the prompt and includes necessary information.

Score 5: Answer fully addresses the prompt, is concise, with minimal unnecessary information.
Score 4: Response addresses the core of the prompt with little tangential information.
Score 3: Response mostly addresses the prompt but includes some unnecessary information.
Score 2: Response partially addresses the prompt with significant omissions or irrelevant content.
Score 1: Response barely addresses or misses the prompt entirely.

-##Organization (1-5)
The logical structure, organization, and flow of the response.

Score 5: Exceptionally clear, logically organized, with perfect flow between ideas.
Score 4: Very clear structure with strong logical flow throughout.
Score 3: Generally clear organization with a few awkward transitions or minor issues.
Score 2: Somewhat organized but with noticeable logical gaps or confusing structure.
Score 1: Disorganized, incoherent, or lacks any clear structure.

### Input
- **System Prompt**: ${systemPrompt}
- **User Prompt**: ${userPrompt}
- **Response to Evaluate**: ${response}

### Instructions
1. Evaluate the response based on the three criteria.
2. Assign a score from 1 to 5 for each criterion.
3. Provide a brief justification for each score.
4. If a criterion is not applicable (e.g., no suggestions requested), state this in the justification and assign a 0/5.
5. Format the output as follows:

### Evaluation for Response

**Accurate**: [Score]  
Justification: [Your reasoning]

**Relevant**: [Score]  
Justification: [Your reasoning]

**Organization**: [Score]  
Justification: [Your reasoning]

**Total Score**: [Total Score]  
Overall Comments: [Optional brief summary or additional notes]

Please provide the evaluation in this exact format.
`;

  try {
    const result = await ollama.chat({
      model: modelName,
      messages: [{ role: 'user', content: evaluationPrompt }],
    });

    return { content: result.message.content, metrics: result };
  } catch (error) {
    throw new Error(`Error evaluating response with Ollama: ${error.message}`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = {
    modelName: null,
    responseFileName: null, // No default - will be required
    showJustification: true,
  };

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--no-justification') {
      args.showJustification = false;
    } else if (!args.modelName) {
      args.modelName = process.argv[i];
    } else if (!args.responseFileName) {
      args.responseFileName = process.argv[i]; // This will be the third argument
    }
  }

  if (!args.modelName || !args.responseFileName) {
  console.error('Please provide an Ollama model name and a response filename (e.g., node scoreResponse.mjs llama3:8b response.txt [--no-justification])');
  process.exit(1);
}

  return args;
}


// Extract scores from evaluation text
function extractScores(evaluation) {
  const scores = {};
  const scoreRegex = /\*\*(Accurate|Relevant|Organization)\*\*: (\d+)/g;
  
  let match;
  while ((match = scoreRegex.exec(evaluation)) !== null) {
    const criterion = match[1].toLowerCase();
    scores[criterion] = parseInt(match[2], 10);
  }
  
  return scores;
}

// Main function
async function main() {
  // Parse arguments
  const args = parseArgs();
  console.log('Debug: Arguments parsed:', args);
  
  if (!args.modelName) {
    console.error('Please provide an Ollama model name (e.g., node scoreResponse.mjs gemma2:2b)');
    process.exit(1);
  }

  try {
    // Check Ollama server
    console.log('Debug: Checking Ollama server...');
    await checkOllamaServer();

    // Get pc_no
    console.log('Debug: Getting pc_no...');
    const pcNo = await getPCNumber();
    console.log('Debug: pc_no obtained:', pcNo);

 // Read input files
    console.log('Debug: Reading input files...');
    const userPrompt = await readFileContent('prompt-user.txt');
    console.log('Debug: User prompt loaded, length:', userPrompt.length);
    
    const systemPrompt = await readFileContent('prompt-system.txt');
    console.log('Debug: System prompt loaded, length:', systemPrompt.length);
    
    const response = await readFileContent(args.responseFileName);
    console.log('Debug: Response loaded, length:', response.length);

    // Evaluate response
    console.log('Debug: Starting evaluation with model:', args.modelName);
    const { content: evaluation, metrics } = await evaluateResponse(args.modelName, userPrompt, systemPrompt, response);
    console.log('Debug: Evaluation completed, response length:', evaluation.length);

    // Extract scores
    console.log('Debug: Extracting scores from evaluation...');
    const scores = extractScores(evaluation);
    console.log('Debug: Extracted scores:', scores);
    
    // Create simplified result object with pc_no as the first element
    console.log('Debug: Creating simplified result object...');
    const simplifiedResult = {
      pc_no: pcNo,
      modelName: args.modelName,
      responseFileName: args.responseFileName,
      runAt: getFormattedDate(new Date().toISOString()),
      scores: {
        accurate: scores.accurate || 0,
        relevant: scores.relevant || 0,
        organization: scores.organization || 0,
        totalScore: ((scores.accurate + scores.relevant + scores.organization) / 15 * 100).toFixed(1) ,
        weightedScore: (((scores.accurate * 3) + (scores.relevant * 2) + (scores.organization * 1)) / 30 * 100).toFixed(1) 
      },
      performanceMetrics: {
        totalDuration: formatDuration(metrics.total_duration),
        loadDuration: formatDuration(metrics.load_duration),
        promptEvalCount: metrics.prompt_eval_count,
        promptEvalDuration: formatDuration(metrics.prompt_eval_duration),
        promptEvalRate: (metrics.prompt_eval_count / (metrics.prompt_eval_duration / 1e9)).toFixed(2),
        evalCount: metrics.eval_count,
        evalDuration: formatDuration(metrics.eval_duration),
        evalRate: (metrics.eval_count / (metrics.eval_duration / 1e9)).toFixed(2)
      }
    };
    console.log('Debug: Simplified result object created:', JSON.stringify(simplifiedResult, null, 2));

    // Write the simplified JSON file with pc_no included in the filename
    const dateStr = getFormattedDate();
    
    // Extract the base name of the response file (without extension)
    const responseBaseName = path.basename(args.responseFileName, path.extname(args.responseFileName));

    // Create the output filename with the response base name included
    const jsonFileName = `simplifiedScore_${pcNo}_${responseBaseName}_${args.modelName.replace(':', '_')}_${dateStr}.json`;
    const jsonPath = path.join(__dirname, jsonFileName);
    console.log('Debug: Writing JSON to file:', jsonPath);
    await fs.writeFile(jsonPath, JSON.stringify(simplifiedResult, null, 2));
    console.log(`Simplified JSON result written to ${jsonFileName}`);

    // Still generate the original full output for reference
    console.log(`Evaluation completed using ${args.modelName}.`);
    
    return simplifiedResult;
  } catch (error) {
    console.error(`Debug: ERROR CAUGHT: ${error.message}`);
    console.error(`Debug: Error stack:`, error.stack);
    process.exit(1);
  }
}

// If this file is being run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled exception:', error);
    process.exit(1);
  });
}

// Export the main function
export default main;

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ollama from 'ollama'; // Correct import for ollama package

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to read file content
async function readFileContent(fileName) {
  const filePath = path.join(__dirname, fileName); // Files are in the same directory as the script
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Error reading ${fileName}: ${error.message}`);
  }
}

// Function to format current date as YYMMDD-MMSS
function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last two digits of year
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
  } catch (error) {
    throw new Error(`Ollama server is not running or unreachable: ${error.message}`);
  }
}

// Function to format duration (nanoseconds to seconds or milliseconds)
function formatDuration(ns) {
  if (ns < 1e6) return `${(ns / 1e6).toFixed(3)}ms`;
  return `${(ns / 1e9).toFixed(3)}s`;
}

// Function to evaluate response using Ollama
async function evaluateResponse(modelName, userPrompt, systemPrompt, response) {
  const evaluationPrompt = `
You are an expert evaluator tasked with grading a response based on three criteria: Accuracy, Relevance, and Coherence. Below are the definitions for each criterion and the scoring instructions.

### Scoring Criteria Definitions
-##Accuracy (1-10)
The degree to which the response contains correct, verifiable information supported by evidence or widely accepted knowledge. It should be free from errors, fabrications, or hallucinations and align with the prompt's context.

Score 10: Entirely accurate with no errors or unsupported claims. All information is verifiable and precisely addresses the prompt's requirements.
Score 8-9: Highly accurate with minimal errors that don't impact the overall value of the response.
Score 6-7: Generally accurate with a few minor errors or slightly unsupported assertions.
Score 4-5: Mixed accuracy with some correct information alongside noticeable errors or unverifiable claims.
Score 2-3: Predominantly inaccurate with occasional correct information.
Score 1: Major factual errors or fabrications dominate the response.

-##Relevance (1-10)
The extent to which the response directly addresses the prompt, includes necessary information, and excludes unnecessary content.

Score 10: Answer fully addresses the prompt, is concise, and has very little unnecessary information.
Score 8-9: Response addresses the core of the prompt with minimal tangential information.
Score 6-7: Response mostly addresses the prompt but includes some unnecessary information or misses minor aspects.
Score 4-5: Response partially addresses the prompt with significant omissions or contains substantial irrelevant information.
Score 2-3: Response barely addresses the prompt, focusing mostly on tangential information.
Score 1: Response does not address the prompt or is overwhelmed with irrelevant information.

-##Coherence (1-10)
The logical structure, organization, and flow of the response, including appropriate formatting and clarity of expression.

Score 10: Exceptionally clear, logically organized, and well-formatted with perfect flow between ideas.
Score 8-9: Very clear structure with strong logical flow and appropriate formatting throughout.
Score 6-7: Generally clear organization with a few awkward transitions or minor formatting issues.
Score 4-5: Somewhat organized but with noticeable logical gaps, confusing transitions, or inconsistent formatting.
Score 2-3: Poorly organized with frequent logical breaks and difficult-to-follow structure.
Score 1: Disorganized, incoherent, or lacks any clear structure.

### Input
- **System Prompt**: ${systemPrompt}
- **User Prompt**: ${userPrompt}
- **Response to Evaluate**: ${response}

### Instructions
1. Evaluate the response based on the three criteria.
2. Assign a score from 1 to 10 for each criterion.
3. Provide a brief justification for each score.
4. If a criterion is not applicable (e.g., no suggestions requested), state this in the justification and assign a 0/10.
5. Format the output as follows:

### Evaluation for Response

**Accuracy**: [Score]  
Justification: [Your reasoning]

**Relevance**: [Score]  
Justification: [Your reasoning]

**Coherence**: [Score]  
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
    showJustification: true,
  };

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--no-justification') {
      args.showJustification = false;
    } else if (!args.modelName) {
      args.modelName = process.argv[i];
    }
  }

  return args;
}

// Extract justifications and create structured object from evaluation text
function extractJustifications(evaluation) {
  const result = {
    scores: {},
    justifications: {},
    totalScore: 0,
    overallComments: '',
  };

  // Extract individual criteria scores and justifications
  const criteriaMatches = [...evaluation.matchAll(/\*\*(\w+\s*\w*)\*\*: (\d+)(?:\/10)?\s*\nJustification: (.*?)(?=\n\n|\n\*\*|\n$)/gs)];
  
  criteriaMatches.forEach(match => {
    const criteria = match[1];
    // Skip Total Score as we'll calculate it
    if (criteria !== 'Total Score') {
      const score = parseInt(match[2], 10);
      const justification = match[3].trim();
      
      result.scores[criteria] = score;
      result.justifications[criteria] = justification;
      result.totalScore += score;
    }
  });

  // Extract overall comments if available
  const commentsMatch = evaluation.match(/Overall Comments: (.*?)(?=\n\*\*|\n$)/s);
  if (commentsMatch) {
    result.overallComments = commentsMatch[1].trim();
  }

  return result;
}

// Main function that now returns an object
async function main() {
  // Parse arguments
  const args = parseArgs();
  
  if (!args.modelName) {
    console.error('Please provide an Ollama model name (e.g., node gradeResponse.mjs gemma2:2b [--no-justification])');
    process.exit(1);
  }

  try {
    // Check Ollama server
    await checkOllamaServer();

    // Read input files
    const userPrompt = await readFileContent('prompt-user.txt');
    const systemPrompt = await readFileContent('prompt-system.txt');
    const response = await readFileContent('response.txt');

    // Evaluate response
    const { content: evaluation, metrics } = await evaluateResponse(args.modelName, userPrompt, systemPrompt, response);

    // Parse and reformat scores
    const scoreRegex = /\*\*(\w+\s*\w*)\*\*: (\d+)(?:\s*\/\s*10)?/g;
    let totalScore = 0;
    let scoreCount = 0;
    let formattedEvaluation = evaluation;
    const scores = [];

    // Collect scores and reformat
    let match;
    while ((match = scoreRegex.exec(evaluation)) !== null) {
      // Skip "Total Score" during the regex collection phase
      if (match[1] !== 'Total Score') {
        const score = parseInt(match[2], 10);
        totalScore += score;
        scoreCount++;
        scores.push({ criteria: match[1], score });
        
        // Create a new regex pattern for each match to avoid double "/10"
        const fullPattern = new RegExp(`\\*\\*${match[1]}\\*\\*: ${match[2]}(?:\\s*\\/\\s*10)?`, 'g');
        formattedEvaluation = formattedEvaluation.replace(
          fullPattern,
          `**${match[1]}**: ${score}/10`
        );
      }
    }

    // Extract structured data from the evaluation
    const evaluationData = extractJustifications(evaluation);

    // Create a structured result object
    const resultObject = {
      modelName: args.modelName,
      scores: {
        ...evaluationData.scores,
        totalScore: totalScore
      },
      justifications: evaluationData.justifications,
      overallComments: evaluationData.overallComments || `Evaluation completed using ${args.modelName}.`,
      metrics: {
        totalDuration: metrics.total_duration,
        totalDurationFormatted: formatDuration(metrics.total_duration),
        loadDuration: metrics.load_duration,
        loadDurationFormatted: formatDuration(metrics.load_duration),
        promptEvalCount: metrics.prompt_eval_count,
        promptEvalDuration: metrics.prompt_eval_duration,
        promptEvalDurationFormatted: formatDuration(metrics.prompt_eval_duration),
        promptEvalRate: (metrics.prompt_eval_count / (metrics.prompt_eval_duration / 1e9)).toFixed(2),
        evalCount: metrics.eval_count,
        evalDuration: metrics.eval_duration,
        evalDurationFormatted: formatDuration(metrics.eval_duration),
        evalRate: (metrics.eval_count / (metrics.eval_duration / 1e9)).toFixed(2)
      },
      rawEvaluation: evaluation,
      timestamp: new Date().toISOString()
    };

    // Validate that we have exactly 3 scores
    if (scoreCount !== 3) {
      console.warn('Warning: Expected 3 scores, but found', scoreCount);
      resultObject.warning = `Expected 3 scores, but found ${scoreCount}`;
    }

    // Format total score as scoretotal/30
    const formattedTotalScore = `${totalScore}/30`;

    // Update or append Total Score in the output
    if (formattedEvaluation.includes('**Total Score**')) {
      formattedEvaluation = formattedEvaluation.replace(
        /\*\*Total Score\*\*: .+/,
        `**Total Score**: ${formattedTotalScore}`
      );
    } else {
      formattedEvaluation += `\n**Total Score**: ${formattedTotalScore}`;
    }

    // Remove justifications if flag is set
    if (!args.showJustification) {
      formattedEvaluation = formattedEvaluation.replace(/Justification: .+?\n\n/gs, '\n');
    }

    // Format metrics
    const metricsOutput = `
**Performance Metrics**:
total duration:       ${formatDuration(metrics.total_duration)}
load duration:        ${formatDuration(metrics.load_duration)}
prompt eval count:    ${metrics.prompt_eval_count} token(s)
prompt eval duration: ${formatDuration(metrics.prompt_eval_duration)}
prompt eval rate:     ${(metrics.prompt_eval_count / (metrics.prompt_eval_duration / 1e9)).toFixed(2)} tokens/s
eval count:           ${metrics.eval_count} token(s)
eval duration:        ${formatDuration(metrics.eval_duration)}
eval rate:            ${(metrics.eval_count / (metrics.eval_duration / 1e9)).toFixed(2)} tokens/s
`;

    // Format final output
    let finalOutput = formattedEvaluation;
    finalOutput += `\nOverall Comments: Evaluation completed using ${args.modelName}.\n${metricsOutput}`;

    // Display output
    console.log(finalOutput);

    // Create a flag indicator for the filename
    const justFlag = args.showJustification ? '' : '_no-just';

    // Write to file with total score and duration in name
    const dateStr = getFormattedDate();
    const totalDurationSeconds = Math.round(metrics.total_duration / 1e9); // Convert nanoseconds to seconds and round
    const outputFileName = `GradedResponse_${totalScore}${justFlag}_${totalDurationSeconds}_${args.modelName.replace(':', '_')}_${dateStr}.txt`;
    const outputPath = path.join(__dirname, outputFileName);
    await fs.writeFile(outputPath, finalOutput);
    console.log(`Evaluation written to ${outputFileName}`);

    // Export the result as JSON
    const jsonFileName = `GradedResponse_${totalScore}${justFlag}_${totalDurationSeconds}_${args.modelName.replace(':', '_')}_${dateStr}.json`;
    const jsonPath = path.join(__dirname, jsonFileName);
    await fs.writeFile(jsonPath, JSON.stringify(resultObject, null, 2));
    console.log(`JSON result written to ${jsonFileName}`);

    // Return the result object
    return resultObject;

  } catch (error) {
    console.error(`Error: ${error.message}`);
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
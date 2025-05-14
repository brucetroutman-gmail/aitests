// example.mjs

import { getModels, runPrompt } from './api.mjs';
import fs from 'fs/promises';

function formatTimestamp() {
  const now = new Date();
  
  // Format as YY-MM-DD HH:MM:SS
  const year = now.getFullYear().toString().slice(2); // Get last 2 digits of year
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// Create the filename constant
const timestamp = formatTimestamp();
const benchmarkFilename = `benc-resu-${timestamp}.json`;

async function runBenchmark() {
  try {
    console.log('Starting Ollama model benchmark...');
    
    // Get all available models
console.log('Fetching available models...');
const availableModels = await getModels();
console.log(`Found ${availableModels.length} total models`);

const models = availableModels
  .map(model => {
    // If model.name already includes a tag (has a colon)
    if (model.name && model.name.includes(':')) {
      return model.name;
    }
    // If there's a separate tag field
    else if (model.tag) {
      return `${model.name}:${model.tag}`;
    }
    // If there's no tag, just use the name
    else {
      return model.name;
    }
  })
      .filter(modelString => {
        // Exclude models that are still downloading or have issues
        if (modelString.includes('partial')) return false;
        
        // Exclude specific large models that might take too long to benchmark
        if (modelString.includes('llama3:70b') || 
            modelString.includes('mixtral:8x22b')) return false;
        
        // Exclude non-chat models that might not work with your prompts
        if (modelString.includes('llava') || 
            modelString.includes('embed')) return false;
        
        // Only include specific model families (uncomment if needed)
        // return modelString.includes('llama3') || modelString.includes('gemma');
        
        // Include all models by default
        return true;
      });

    // Optionally, you can sort models by name for better organization
    models.sort();

    console.log(`Filtered ${models.length} models for benchmarking:`, models);
    
    // Define test prompts
    const prompts = [
      "Explain quantum computing in simple terms.",
      "Write a short poem about artificial intelligence.",
      "What are three ways to improve productivity?"
    ];
    
    // Prepare results object
    const results = {};
    
    // Test each model with each prompt
    for (const model of models) {
      console.log(`\nBenchmarking model: ${model}`);
      results[model] = {};
      
      for (const prompt of prompts) {
        console.log(`  Testing prompt: "${prompt.substring(0, 30)}..."`);
        
        const startTime = performance.now();
        
        try {
          const response = await runPrompt(model, prompt, {
            temperature: 0.7,
            max_tokens: 500
          });
          
          const endTime = performance.now();
          const timeTaken = (endTime - startTime) / 1000;

          results[model][prompt] = {
            timeTaken: timeTaken,
            response: response.response || "No response",
            success: true
          };
          
          console.log(`  ✓ Completed in ${timeTaken.toFixed(2)} sec`);
        } catch (error) {
          console.error(`  ✗ Failed: ${error.message}`);
          results[model][prompt] = {
            timeTaken: null,
            response: null,
            error: error.message,
            success: false
          };
        }
      }
    }
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    // Use your function that handles context removal:
    // Create a deep copy and remove context fields
    const processedResults = JSON.parse(JSON.stringify(results));
/*
    if (processedResults.detailedResults && Array.isArray(processedResults.detailedResults)) {
      processedResults.detailedResults.forEach(result => {
        if (result.response) {
          // Find and remove any "context" field at the response level
          if (result.response.context !== undefined) {
            delete result.response.context;
          }
          
          // Alternative approach: remove any field between done_reason and total_duration
          const keys = Object.keys(result.response);
          const doneReasonIndex = keys.indexOf("done_reason");
          const totalDurationIndex = keys.indexOf("total_duration");
          
          if (doneReasonIndex !== -1 && totalDurationIndex !== -1 && doneReasonIndex < totalDurationIndex) {
            // Remove all fields between done_reason and total_duration
            for (let i = doneReasonIndex + 1; i < totalDurationIndex; i++) {
              delete result.response[keys[i]];
            }
          }
        }
      });
    }
*/

await fs.writeFile(benchmarkFilename, JSON.stringify(results, null, 2));

await removeContextFromJsonFile(benchmarkFilename);

    console.log(`\nBenchmark complete! Results saved to benchmark-results-${timestamp}.json`);
    
    // Generate summary
    console.log("\nSummary:");
    for (const model in results) {
      const modelResults = results[model];
      const successCount = Object.values(modelResults).filter(r => r.success).length;
      const modelTimes = Object.values(modelResults);
      const successfulTimes = modelTimes.filter(r => r.timeTaken);
      const avgTimeSec = successfulTimes.reduce((sum, r) => sum + r.timeTaken, 0) / (successfulTimes.length || 1);            
      console.log(`${model}: ${successCount}/${Object.keys(modelResults).length} successful, avg time: ${avgTimeSec.toFixed(2)} sec`);
    }
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}


/**
 * Removes all "context" fields from a JSON file after it has been written
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<void>}
 */
async function removeContextFromJsonFile(filePath) {
  try {
    // Read the file
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    // Parse the JSON
    const data = JSON.parse(fileContent);
    
    // Function to recursively remove context fields from an object
    function removeContextField(obj) {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => removeContextField(item));
      } else {
        if (obj.response && obj.response.context) {
          delete obj.response.context;
        }
        
        // Process all other object properties recursively
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            removeContextField(value);
          }
        });
      }
    }
    
    // Remove context fields
    removeContextField(data);
    
    // Write the cleaned data back to the file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully removed context fields from ${filePath}`);
  } catch (error) {
    console.error(`Error removing context fields: ${error.message}`);
  }
}

// Run the benchmark
runBenchmark();

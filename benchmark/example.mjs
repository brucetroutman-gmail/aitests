// example.mjs

import { getModels, runPrompt } from './api.mjs';
import { saveBenchmarkResults } from './api.mjs';

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
    const filename = `benchmark-results-${timestamp}.json`;
    await saveBenchmarkResults(results, filename);
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

// Run the benchmark
runBenchmark();

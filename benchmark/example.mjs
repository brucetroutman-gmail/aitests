import { runPrompt, getModels } from './api.mjs';
import fs from 'fs';

// Function to run benchmarks on available models
async function runBenchmarks() {
  try {
    // Get the list of available models dynamically
    console.log("Fetching available models...");
    const modelsList = await getModels();
    
    if (!modelsList || modelsList.length === 0) {
      console.log("No models found. Please ensure Ollama is running and has models installed.");
      return;
    }
    
    console.log(`Found ${modelsList.length} models: ${modelsList.map(model => model.name).join(', ')}`);
    
    // Sample prompt for benchmarking
    const prompt = "Explain the concept of neural networks in simple terms.";
    
    // Results storage
    const results = [];
    
    // Run the prompt on each model
    for (const model of modelsList) {
      console.log(`\nRunning benchmark for model: ${model.name}`);
      
      const startTime = performance.now();
      const response = await runPrompt(model.name, prompt);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      results.push({
        model: model.name,
        executionTime: executionTime,
        response: response
      });
      
      console.log(`Completed in ${executionTime.toFixed(2)} ms`);
    }
    
    // Sort results by execution time
    results.sort((a, b) => a.executionTime - b.executionTime);
    
    // Display and save results
    console.log("\n==== BENCHMARK RESULTS ====");
    console.log("Models ranked by execution time (fastest first):");
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.model}: ${result.executionTime.toFixed(2)} ms`);
    });
    
    // Save results to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsJson = JSON.stringify(results, null, 2);
    fs.writeFileSync(`benchmark-results-${timestamp}.json`, resultsJson);
    
    console.log(`\nDetailed results saved to benchmark-results-${timestamp}.json`);
    
  } catch (error) {
    console.error("Error during benchmarking:", error);
  }
}

// Run the benchmarks
runBenchmarks();

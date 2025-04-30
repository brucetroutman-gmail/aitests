// example.mjs

import { getModels, runPrompt } from './api.mjs';
import fs from 'fs/promises';

async function runBenchmark() {
  try {
    console.log('Starting Ollama model benchmark...');
    
    // Get all available models
    console.log('Fetching available models...');
    const availableModels = await getModels();
    console.log(`Found ${availableModels.length} total models`);
    
    // Filter models based on specific criteria
    const models = availableModels
      .map(model => `${model.name}:${model.tag}`)
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
          const timeTaken = endTime - startTime;
          
          results[model][prompt] = {
            timeTaken: timeTaken,
            response: response.response || "No response",
            success: true
          };
          
          console.log(`  ✓ Completed in ${timeTaken.toFixed(2)}ms`);
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
    await fs.writeFile(`benchmark-results-${timestamp}.json`, JSON.stringify(results, null, 2));
    console.log(`\nBenchmark complete! Results saved to benchmark-results-${timestamp}.json`);
    
    // Generate summary
    console.log("\nSummary:");
    for (const model in results) {
      const modelResults = results[model];
      const successCount = Object.values(modelResults).filter(r => r.success).length;
      const avgTime = Object.values(modelResults)
        .filter(r => r.timeTaken)
        .reduce((sum, r) => sum + r.timeTaken, 0) / successCount || 0;
      
      console.log(`${model}: ${successCount}/${Object.keys(modelResults).length} successful, avg time: ${avgTime.toFixed(2)}ms`);
    }
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

// Run the benchmark
runBenchmark();

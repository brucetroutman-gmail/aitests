import { getModels, generateCompletion } from './api.mjs';
import fs from 'fs/promises';

async function runBenchmark() {
  try {
    // Get all available models
    const models = await getModels();
    console.log(`Found ${models.length} models`);
    
    // Filter models (optional: you can adjust or remove this filtering)
    const filteredModels = models.filter(model => 
      !model.name.includes(':7b') && 
      !model.name.includes(':8x7b') && 
      !model.name.includes(':34b') &&
      !model.name.includes(':70b')
    );
    console.log(`Running benchmark on ${filteredModels.length} models`);

    const prompt = "Explain the concept of recursion in programming in one paragraph.";
    const results = [];

    // Run benchmark for each model
    for (const model of filteredModels) {
      console.log(`Testing model: ${model.name}`);
      try {
        const response = await generateCompletion(model.name, prompt);
        
        // Convert durations from milliseconds to seconds
        const processedResponse = {
          model: model.name,
          response: response.response,
          total_duration: response.total_duration / 1000, // Convert to seconds
          load_duration: response.load_duration / 1000,   // Convert to seconds
          prompt_eval_duration: response.prompt_eval_duration / 1000, // Convert to seconds
          eval_duration: response.eval_duration / 1000,   // Convert to seconds
          eval_count: response.eval_count
          // Context is now excluded
        };
        
        results.push(processedResponse);
        console.log(`Completed ${model.name}`);
      } catch (error) {
        console.error(`Error with model ${model.name}:`, error.message);
        // Add failed model to results with error information
        results.push({
          model: model.name,
          error: error.message
        });
      }
    }

    // Save results to file
    await fs.writeFile('benchmark-results.json', JSON.stringify(results, null, 2));
    console.log('Benchmark complete! Results saved to benchmark-results.json');
    
    // Print a summary of the results
    console.log('\nBenchmark Summary:');
    results.forEach(result => {
      if (result.error) {
        console.log(`${result.model}: Failed - ${result.error}`);
      } else {
        console.log(`${result.model}: ${result.total_duration.toFixed(2)}s total, ${result.eval_count} tokens`);
      }
    });
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

runBenchmark();

// api.mjs

//import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:11434/api';

/**
 * Fetches available models from the Ollama API
 * @returns {Promise<Array>} List of available models
 */
export async function getModels() {
  try {
    const response = await fetch(`${BASE_URL}/tags`);
    
    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.models;  // The response format is { models: [...] }
  } catch (error) {
    console.error('Error fetching models:', error);
    throw error;
  }
}

/**
 * Sends a prompt to a specific Ollama model
 * @param {string} model - The model name to use
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options for the model
 * @returns {Promise<Object>} The model's response with performance metrics
 */
export async function runPrompt(model, prompt, options = {}) {
  try {
    const requestBody = {
      model: model,
      prompt: prompt,
      stream: false,  // Set to false for a complete response
      ...options
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2)); // Debug output
    
    const startTime = performance.now();
    
    const response = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to run prompt: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    const endTime = performance.now();
    
    // Calculate total execution time in seconds
    const executionTimeSeconds = (endTime - startTime) / 1000;
    
    // Extract benchmark metrics
    const benchmarkData = {
      response: data,
      metrics: {
        totalTime: executionTimeSeconds,
        evalTokens: data.eval_count || 0,
        evalTokensPerSecond: data.eval_count ? data.eval_count / executionTimeSeconds : 0,
        promptTokens: data.prompt_eval_count || 0,
        totalTokens: (data.eval_count || 0) + (data.prompt_eval_count || 0),
        tokensPerSecond: data.eval_duration ? (data.eval_count || 0) / (data.eval_duration / 1e9) : 0
      }
    };
    
    return benchmarkData;
  } catch (error) {
    console.error('Error running prompt:', error);
    throw error;
  }
}

/**
 * Runs a benchmark test on a specific model with multiple prompts
 * @param {string} model - The model name to benchmark
 * @param {Array<string>} prompts - Array of prompts to test
 * @param {Object} options - Additional options for the model
 * @returns {Promise<Object>} Benchmark results
 */
export async function runBenchmark(model, prompts, options = {}) {
  try {
    console.log(`Starting benchmark for model: ${model}`);
    
    const results = [];
    const startTime = performance.now();
    
    for (let i = 0; i < prompts.length; i++) {
      console.log(`Running prompt ${i + 1}/${prompts.length}`);
      const result = await runPrompt(model, prompts[i], options);
      results.push(result);
    }
    
    const endTime = performance.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    
    // Calculate aggregate metrics
    const totalEvalTokens = results.reduce((sum, r) => sum + r.metrics.evalTokens, 0);
    const totalPromptTokens = results.reduce((sum, r) => sum + r.metrics.promptTokens, 0);
    const totalTokens = totalEvalTokens + totalPromptTokens;
    
    const benchmarkSummary = {
      model,
      totalPrompts: prompts.length,
      totalTimeSeconds,
      totalEvalTokens,
      totalPromptTokens,
      totalTokens,
      avgEvalTokensPerSecond: totalEvalTokens / totalTimeSeconds,
      avgTokensPerPrompt: totalTokens / prompts.length,
      detailedResults: results
    };
    
    return benchmarkSummary;
  } catch (error) {
    console.error(`Benchmark error for model ${model}:`, error);
    throw error;
  }
}

/**
 * Gets detailed information about a specific model
 * @param {string} modelName - The name of the model
 * @returns {Promise<Object>} Model information
 */
export async function getModelInfo(modelName) {
  try {
    const response = await fetch(`${BASE_URL}/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: modelName })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get model info: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error getting info for model ${modelName}:`, error);
    throw error;
  }
}

/**
 * Saves benchmark results to a JSON file
 * @param {Object} benchmarkData - The benchmark data to save
 * @param {string} filePath - Path to save the file
 * @returns {Promise<void>}
 */
export async function saveBenchmarkResults(benchmarkData, filePath) {
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(benchmarkData, null, 2));
    console.log(`Benchmark results saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving benchmark results:', error);
    throw error;
  }
}



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
 * @returns {Promise<Object>} The model's response
 */
// Modified runPrompt function with more explicit parameters
export async function runPrompt(model, prompt, options = {}) {
  try {
    const requestBody = {
      model: model,
      prompt: prompt,
      stream: false,  // Set to false for a complete response
      ...options
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2)); // Debug output
    
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
    
    return await response.json();
  } catch (error) {
    console.error('Error running prompt:', error);
    throw error;
  }
}


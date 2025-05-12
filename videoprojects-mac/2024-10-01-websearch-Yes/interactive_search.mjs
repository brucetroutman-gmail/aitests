import fetch from 'node-fetch'; // Using node-fetch; omit if Node.js 18+ with native fetch
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { createInterface } from 'readline';

// Set up readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user asynchronously
const promptUser = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Main execution wrapped in an async IIFE
(async () => {
  // Prompt user for search and AI queries
  const searchPrompt = (await promptUser("Enter your search prompt (e.g., 'Lexington VA'): ")) || "Lexington VA Tourism";
  const aiPrompt = (await promptUser("Enter your AI prompt (e.g., 'Tell me about tourism'): ")) || "Tell me about tourism";

  console.log(`Search Prompt: "${searchPrompt}"`);
  console.log(`AI Prompt: "${aiPrompt}"`);

  const urls = await getNewsUrls(searchPrompt);
  const alltexts = await getCleanedText(urls);
  await answerQuery(aiPrompt, alltexts);

  rl.close(); // Close readline after execution
})();

async function getNewsUrls(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
  console.log(`Fetching from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    if (!text) {
      console.log("Empty response from DuckDuckGo.");
      return ["https://www.lexingtonvirginia.com/"];
    }
    const searchResultsJson = JSON.parse(text);
    console.log("API Response:", JSON.stringify({
      AbstractURL: searchResultsJson.AbstractURL,
      Results: searchResultsJson.Results,
      RelatedTopics: searchResultsJson.RelatedTopics ? searchResultsJson.RelatedTopics.slice(0, 3) : []
    }, null, 2));

    const results = [
      ...(searchResultsJson.Results || []),
      ...(searchResultsJson.RelatedTopics || []).flatMap(item => 
        "Topics" in item ? item.Topics : [item]
      ),
    ].filter(item => item.FirstURL && item.Text);

    if (searchResultsJson.AbstractURL) {
      results.unshift({ FirstURL: searchResultsJson.AbstractURL, Text: "Overview" });
    }

    const urls = results.map(result => result.FirstURL).slice(0, 5);
    if (urls.length === 0) {
      console.log("No URLs found, returning fallback.");
      return ["https://www.lexingtonvirginia.com/"];
    }
    console.log(`Found ${urls.length} URLs:`, urls);
    return urls;
  } catch (error) {
    console.error("Error in getNewsUrls:", error);
    return ["https://www.lexingtonvirginia.com/"];
  }
}

async function getCleanedText(urls) {
  const texts = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      console.log(`Fetching ${url}`);
      const html = await response.text();
      const text = htmlToText(html);
      texts.push(`Source: ${url}\n${text}\n\n`);
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  }
  return texts;
}

function htmlToText(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const text = new Readability(doc).parse();
  return text.textContent;
}

async function answerQuery(query, texts) {
  if (texts.length === 0) {
    console.log("No text content available to summarize.");
    return;
  }
  try {
    const ollamaUrl = 'http://localhost:11434/api/generate'; // Adjust if Ollama runs elsewhere
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3", // Using your specified model
        prompt: `${query}. Summarize the information and provide an answer. Use only the information in the following articles to answer the question: ${texts.join("\n\n")}`,
        stream: true,
        options: {
          num_ctx: 16000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP error! Status: ${response.status}`);
    }

    // Handle streaming response with Node.js Readable stream
    await new Promise((resolve, reject) => {
      let buffer = '';
      response.body.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            const chunk = JSON.parse(line);
            if (chunk.response) {
              process.stdout.write(chunk.response);
            }
          }
        }
      });

      response.body.on('end', () => {
        if (buffer.trim()) {
          const chunk = JSON.parse(buffer);
          if (chunk.response) {
            process.stdout.write(chunk.response);
          }
        }
        resolve();
      });

      response.body.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error in answerQuery:", error);
  }
}
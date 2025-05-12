import { Readability } from "jsr:@paoramen/cheer-reader";
import ollama from "npm:ollama";
import * as cheerio from "npm:cheerio@1.0.0";

// Define a basic interface for the DuckDuckGo response
interface DuckDuckGoResponse {
  AbstractURL: string;
  Results: Array<{ FirstURL: string; Text: string }>;
  RelatedTopics: Array<{ FirstURL?: string; Text: string } | { Topics: Array<{ FirstURL: string; Text: string }> }>;
}

// Prompt user for search and AI queries
const searchPrompt = prompt("Enter your search prompt (e.g., 'Lexington VA'):") || "Lexington VA";
const aiPrompt = prompt("Enter your AI prompt (e.g., 'Tell me about tourism'):") || "Tell me about tourism";

console.log(`Search Prompt: "${searchPrompt}"`);
console.log(`AI Prompt: "${aiPrompt}"`);

const urls = await getNewsUrls(searchPrompt);
const alltexts = await getCleanedText(urls);
await answerQuery(aiPrompt, alltexts);

async function getNewsUrls(query: string): Promise<string[]> {
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
      return ["https://www.lexingtonvirginia.com/"]; // Fallback URL
    }
    const searchResultsJson: DuckDuckGoResponse = JSON.parse(text);
    console.log("API Response:", JSON.stringify({
      AbstractURL: searchResultsJson.AbstractURL,
      Results: searchResultsJson.Results,
      RelatedTopics: searchResultsJson.RelatedTopics.slice(0, 3)
    }, null, 2));

    const results = [
      ...(searchResultsJson.Results || []),
      ...(searchResultsJson.RelatedTopics || []).flatMap(item => 
        "Topics" in item ? item.Topics : [item]
      ),
    ].filter((item): item is { FirstURL: string; Text: string } => !!item.FirstURL && !!item.Text);

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

async function getCleanedText(urls: string[]) {
  const texts = [];
  for await (const url of urls) {
    try {
      const getUrl = await fetch(url);
      console.log(`Fetching ${url}`);
      const html = await getUrl.text();
      const text = htmlToText(html);
      texts.push(`Source: ${url}\n${text}\n\n`);
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  }
  return texts;
}

function htmlToText(html: string) {
  const $ = cheerio.load(html);
  const text = new Readability($).parse();
  return text.textContent;
}

async function answerQuery(query: string, texts: string[]) {
  const result = await ollama.generate({
    model: "llama3",
    prompt: `${query}. Summarize the information and provide an answer. Use only the information in the following articles to answer the question: ${texts.join("\n\n")}`,
    stream: true,
    options: {
      num_ctx: 16000,
    },
  });
  for await (const chunk of result) {
    if (chunk.done !== true) {
      await Deno.stdout.write(new TextEncoder().encode(chunk.response));
    }
  }
}
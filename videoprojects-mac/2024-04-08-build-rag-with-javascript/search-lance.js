import ollama from "ollama";
import { connect } from "@lancedb/lancedb";
import { getConfig } from "./utilities.js";

const { embedmodel, mainmodel } = getConfig();

// Connect to LanceDB
let db, table;
try {
    db = await connect("./lancedb");
    table = await db.openTable("documents_vector_store");
    console.log("Table ready.");
} catch (error) {
    console.error("Error opening LanceDB table:", error.message);
    process.exit(1);
}

// Get user query from command line arguments
const query = process.argv.slice(2).join(" ");
let queryembed;

// Generate embedding for the query
try {
    queryembed = (await ollama.embeddings({ model: embedmodel, prompt: query })).embedding;
    if (!queryembed) throw new Error("No embedding returned from ollama");
} catch (error) {
    console.error("Error generating query embedding:", error.message);
    process.exit(1);
}

console.log(query);
let relevantDocs;

// Query LanceDB for similar documents
try {
    // Get search results using toArray() for cleaner handling
    const results = await table.search(queryembed).limit(5).toArray();
    
    if (results && Array.isArray(results) && results.length > 0) {
      // Extract just the relevant text information
      relevantDocs = results
        .map(item => {
          // Handle different possible structures of the results
          if (item.text) return item.text;
          if (item.metadata && item.metadata.text) return item.metadata.text;
          if (item.vector) return null; // Skip vector data
          return null;
        })
        .filter(Boolean) // Remove any null entries
        .join("\n\n---\n\n"); // Add separators between documents
      
      console.log(`Found ${results.length} relevant documents.`);
    } else {
      relevantDocs = "No matching documents found.";
      console.log("Search completed but no relevant documents were found.");
    }
  } catch (error) {
    console.error(`Error during search: ${error.message}`);
    relevantDocs = "An error occurred while searching the knowledge base.";
  }
  
  // Format final response for the user
  const response = {
    query: query,
    sources: relevantDocs ? relevantDocs.length : 0,
    content: relevantDocs || "No information available."
  };
  
  // You can then use this structured response
  console.log("\n=== SEARCH RESULTS ===");
  console.log(`Query: ${response.query}`);
  console.log("------------------------");
  console.log(response.content);
  

// Create the prompt with context for the LLM
const modelQuery = `${query} - Answer that question using the following text as a resource: ${relevantDocs}`;

// Generate response using Ollama
try {
    const stream = await ollama.generate({ model: mainmodel, prompt: modelQuery, stream: true });
    for await (const chunk of stream) {
        process.stdout.write(chunk.response);
    }
} catch (error) {
    console.error("Error generating response from ollama:", error.message);
}

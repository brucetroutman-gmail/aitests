import ollama from "ollama";
import { connect } from "@lancedb/lancedb";
import { readText } from "./utilities.js";
import { chunkTextBySentences } from "matts-llm-tools";
import { readFile } from "fs/promises";
import { mkdir, access } from "fs/promises";

const DB_PATH = "./lancedb";

async function ensureDirectoryExists(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    await mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

async function main() {
  await ensureDirectoryExists(DB_PATH);
  const db = await connect(DB_PATH);
  console.log("Connected to LanceDB");

  const sampleEmbedding = new Array(768).fill(0.1);
  
  let table;
  
  try {
    try {
      table = await db.openTable("documents_vector_store");
      console.log("Table exists, will reuse it");
    } catch (error) {
      console.log("Creating new table 'documents_vector_store'");
      await db.createTable("documents_vector_store", 
        [{ 
          id: "sample1", 
          vector: sampleEmbedding, 
          source: "sample", 
          text: "sample document" 
        }],
        {
          vector: { dim: 768, type: 'float' },
          text: 'string',
          source: 'string',
          id: 'string'
        }
      );
      console.log("Table created with initial sample data");
      
      table = await db.openTable("documents_vector_store");
    }

    // Delete the sample document if it exists
    try {
      await table.delete("id = 'sample1'");
    } catch (error) {
      console.log("No sample document to delete or error deleting:", error.message);
    }
    
    // Read list of documents from sourcedocs.txt
    const docstoimport = (await readFile("sourcedocs.txt", "utf-8")).split("\n").filter(Boolean);
    console.log(`Found ${docstoimport.length} documents to import`);
    
    // For each document in the list
    for (const doc of docstoimport) {
      console.log(`\nEmbedding chunks from ${doc}`);
      const text = await readText(doc);
      const chunks = chunkTextBySentences(text, 7, 0);
      console.log(`Created ${chunks.length} chunks from document`);
      
      // Process each chunk
      for (const [index, chunk] of chunks.entries()) {
        try {
          // Generate embedding using Ollama
          const embed = (await ollama.embeddings({ 
            model: "nomic-embed-text", // You can replace with embedmodel from config if needed
            prompt: chunk 
          })).embedding;
          
          if (!embed) throw new Error("No embedding returned");
          
          // Add to LanceDB table
          await table.add([{
            id: `${doc}_${index}`,
            vector: embed,
            source: doc,
            text: chunk
          }]);
          
          process.stdout.write(".");
        } catch (error) {
          console.error(`\nError embedding chunk ${index} from ${doc}:`, error.message);
        }
      }
    }
    
    // Count rows after import
    const count = await table.countRows();
    console.log(`\nTotal rows in table after import: ${count}`);
    
  } catch (err) {
    console.error("Error during processing:", err);
    throw err;
  }
}

main()
  .then(() => console.log("\nImport completed successfully"))
  .catch(err => console.error("Error during import:", err))
  .finally(() => process.exit(0));

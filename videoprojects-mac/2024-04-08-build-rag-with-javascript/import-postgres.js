import ollama from "ollama";
import { getConfig, readText } from "./utilities.js";
import { chunkTextBySentences } from "matts-llm-tools";
import { readFile } from "fs/promises";
import pg from "pg";

const pgClient = new pg.Client({
  host: "localhost",
  port: 5432,
  database: "vectordb",
  user: "vector",
  password: "vector!123",
});

await pgClient.connect();
console.log("Connected to PostgreSQL");

const { embedmodel, mainmodel } = getConfig();

const docstoimport = (await readFile("sourcedocs.txt", "utf-8")).split("\n");
for (const doc of docstoimport) {
  console.log(`\nEmbedding chunks from ${doc}\n`);
  const text = await readText(doc);
  const chunks = chunkTextBySentences(text, 7, 0);

  for (const [index, chunk] of chunks.entries()) {
    try {
      const embed = (await ollama.embeddings({ model: embedmodel, prompt: chunk })).embedding;
      if (!embed) throw new Error("No embedding returned");
      
      // Format the embedding array as a PostgreSQL vector string
      const vectorString = '[' + embed.join(',') + ']';
      
      // Insert into PostgreSQL with properly formatted vector
      await pgClient.query(
        `INSERT INTO buildrag (id, embedding, metadata, document)
         VALUES ($1, $2::vector, $3, $4)`,
        [
          doc + index, 
          vectorString, 
          JSON.stringify({ source: doc }), 
          chunk
        ]
      );
      
      process.stdout.write(".");
    } catch (error) {
      console.error(`\nError embedding chunk ${index} from ${doc}:`, error.message);
    }
  }
}

// Close PostgreSQL connection when done
await pgClient.end();
console.log("\nCompleted importing documents to PostgreSQL");

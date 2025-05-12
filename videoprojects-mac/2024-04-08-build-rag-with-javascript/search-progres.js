import ollama from "ollama";
import pg from "pg";
import { getConfig } from "./utilities.js";

const { embedmodel, mainmodel } = getConfig();

// PostgreSQL client setup
const pgClient = new pg.Client({
  host: "localhost",
  port: 5432,
  database: "vectordb",
  user: "vector",
  password: "vector!123",
});

try {
  await pgClient.connect();
  console.log("Connected to PostgreSQL");
} catch (error) {
  console.error("Error connecting to PostgreSQL:", error.message);
  process.exit(1);
}

const query = process.argv.slice(2).join(" ");
let queryembed;
try {
  queryembed = (await ollama.embeddings({ model: embedmodel, prompt: query })).embedding;
  if (!queryembed) throw new Error("No embedding returned from ollama");
} catch (error) {
  console.error("Error generating query embedding:", error.message);
  await pgClient.end();
  process.exit(1);
}

console.log(query);
let relevantDocs;
try {
  // Format the embedding array as a PostgreSQL vector string
  // This is the key fix - convert JavaScript array to PostgreSQL vector format
  const vectorString = '[' + queryembed.join(',') + ']';
  
  const result = await pgClient.query(
    `SELECT document FROM buildrag
     ORDER BY embedding <=> $1::vector
     LIMIT 5`,
    [vectorString]
  );
  
  relevantDocs = result.rows.map(row => row.document).join("\n\n");
} catch (error) {
  console.error("Error querying PostgreSQL:", error.message);
  await pgClient.end();
  process.exit(1);
}

const modelQuery = `${query} - Answer that question using the following text as a resource: ${relevantDocs}`;

try {
  const stream = await ollama.generate({ model: mainmodel, prompt: modelQuery, stream: true });
  for await (const chunk of stream) {
    process.stdout.write(chunk.response);
  }
} catch (error) {
  console.error("Error generating response from ollama:", error.message);
}

// Close the PostgreSQL connection when done
await pgClient.end();

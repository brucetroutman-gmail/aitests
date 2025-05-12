import ollama from "ollama";
import { ChromaClient } from "chromadb";
import { getConfig } from "./utilities.js";

const { embedmodel, mainmodel } = getConfig();

const chroma = new ChromaClient({ path: "http://localhost:8000" }); // Explicit http://

let collection;
try {
    collection = await chroma.getOrCreateCollection({ 
        name: "buildragwithtypescript", 
        metadata: { "hnsw:space": "cosine" } 
    });
    console.log("Collection ready.");
} catch (error) {
    console.error("Error creating/getting collection:", error.message);
    process.exit(1); // Exit if collection fails
}

const query = process.argv.slice(2).join(" ");
let queryembed;
try {
    queryembed = (await ollama.embeddings({ model: embedmodel, prompt: query })).embedding;
    if (!queryembed) throw new Error("No embedding returned from ollama");
} catch (error) {
    console.error("Error generating query embedding:", error.message);
    process.exit(1);
}

console.log(query);
let relevantDocs;
try {
    relevantDocs = (await collection.query({ queryEmbeddings: [queryembed], nResults: 5 })).documents[0].join("\n\n");
} catch (error) {
    console.error("Error querying collection:", error.message);
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
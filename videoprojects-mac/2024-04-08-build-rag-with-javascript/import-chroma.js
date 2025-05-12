import ollama from "ollama";
import { ChromaClient } from "chromadb";
import { getConfig, readText } from "./utilities.js";
import { chunkTextBySentences } from "matts-llm-tools";
import { readFile } from "fs/promises";

const chroma = new ChromaClient({ path: "http://localhost:8000" }); // Explicitly use http://

try {
    await chroma.deleteCollection({ name: "buildragwithtypescript" });
    console.log("Deleted existing collection (if any).");
} catch (error) {
    console.error("Error deleting collection:", error.message);
}

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
            await collection.add({

                ids: [doc + index], 
                embeddings: [embed], 
                metadatas: { source: doc }, 
                documents: [chunk] 
            });
            process.stdout.write(".");
        } catch (error) {
            console.error(`\nError embedding chunk ${index} from ${doc}:`, error.message);
        }
    }
}
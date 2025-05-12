import { Ollama } from "ollama";
import { readFile } from "fs/promises";

const ollama = new Ollama();

function splitIntoChunks(text, chunkSize) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = [];
    
    for (const word of words) {
        currentChunk.push(word);
        if (currentChunk.length >= chunkSize) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    return chunks;
}

const path = "/users/shared/repos/documents/txt/constitution-bt.txt";
// const path = "/users/shared/repos/docs/txt/marine.txt";
// const path = "/users/shared/repos/docs/txt/the-brothers-karamazov.txt";
const text = await readFile(path, "utf-8");

const chunks = splitIntoChunks(text, 500);
console.log("done reading");

let i = 0;
for await (const c of chunks) {
    i++;
    const b = await ollama.embeddings({
        model: "llama3",
        prompt: c
    });
    console.log(i);
}
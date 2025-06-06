
import { Ollama } from "ollama";

const ollama = new Ollama();

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const words: string[] = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.length >= chunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks;
}

const path = "/users/shared/repos/documents/txt/constitution-bt.txt";
//const path = "/users/shared/repos/docs/txt/marine.txt";
// const path = "/users/shared/repos/docs/txt/the-brothers-karamazov.txt";
const file = Bun.file(path);

const chunks = splitIntoChunks(await file.text(), 500);
console.log('done reading')


let i = 0
for await (const c of chunks) {
  i++;
  const b = await ollama.embeddings({
    model: "llama3",
    prompt: c
  })
  console.log(i);
}


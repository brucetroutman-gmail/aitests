import {Ollama} from 'ollama';

const ollama = new Ollama({ host: "mattsremoteollamaapi" });
const prompt = "why is the sky blue";

const output = await ollama.generate({ model: "llama3", prompt: prompt })

console.log(output)

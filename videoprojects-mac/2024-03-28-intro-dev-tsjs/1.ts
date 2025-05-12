import ollama from 'ollama';

const output = await ollama.generate({ model: "llama3", prompt: "" })

console.log(output)
 
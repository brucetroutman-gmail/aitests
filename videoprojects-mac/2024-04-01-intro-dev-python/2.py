import ollama

prompt = "why is the sky blue";

output = ollama.generate(model="llama3", prompt=prompt)

print(output)

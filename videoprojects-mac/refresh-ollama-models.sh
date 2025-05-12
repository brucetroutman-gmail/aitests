ollama list | 
awk 'NR>1 {print $1}' | 
xargs -I{} sh -c 'echo Pulling model: {};
ollama pull {}'
bash 
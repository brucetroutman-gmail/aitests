import { readFile } from "fs/promises";
import { convert } from "html-to-text";

const config = JSON.parse(await readFile("./config.json", "utf-8"));

export function getConfig() {
    return config;
}

export async function readText(path) {
    // Test if path is a local file or a remote URL
    const protocol = path.split("://")[0];
    if (protocol === "http" || protocol === "https") {
        const text = await fetch(path).then(x => x.text());
        return convert(text);
    } else {
        return (await readFile(path, "utf-8"));
    }
}
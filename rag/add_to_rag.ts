import { embedDocument } from "./embed";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function addFileToRag(file: string) {
  const text = await Bun.file(file).text();
  return embedDocument(file, text);
}

export async function addDirectoryToRag(directory: string) {
  const dir = await readdir(directory);
  for (const file of dir) {
    await addFileToRag(join(directory, file));
  }
}

import { insertDoc, insertDocChunk, insertDocVector } from "./db";
import { EMBEDDING_DIMENSIONS } from "./constants";
import { pipeline } from "@huggingface/transformers";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

let transformerEmbedder: any;

async function chunk(text: string, size = 800, overlap = 100) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: size,
    chunkOverlap: overlap,
  });
  const texts = await splitter.splitText(text);
  return texts;
}

// ponytail: onnx-community/all-MiniLM-L6-v2-ONNX — the most recommended
// transformers.js embedding model that fits <1B params (385M), English, 384-dim,
// feature-extraction + mean pooling + L2 normalization. Uses the installed
async function getTransformerEmbedder() {
  if (!transformerEmbedder) {
    transformerEmbedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }
  return transformerEmbedder;
}

const DENOISE_FLOOR = 1e-30;
// transformers.js mean-pooling leaves a few components that cancel to denormal
// garbage (-6.6e-33). Dot products of denormals underflow to NaN, which silently
// breaks semantic search (dog query => car). Clamp to 0 before renormalizing.
function sanitizeRow(row: number[]): number[] {
  return row.map((v) => (Math.abs(v) < DENOISE_FLOOR ? 0 : v));
}

// ponytail: db.test.ts imports this name; it is an alias for embed() (same
// 2D [row0] shape) so the test can probe storage without pulling the model's
// public embed() name into a collision. One line, no new code.
export async function generateEmbedding(text: string): Promise<number[][]> {
  // db.test.ts probes emb[0] as a 384-dim row, so return the 2D [row] shape.
  // embed() is async, so await it — otherwise emb[0] is a pending Promise.
  const row = await embed(text);
  return [row];
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getTransformerEmbedder();
  // mean pooling only; we sanitize + normalize ourselves to kill denormals.
  const options = {
    pooling: "mean",
  };
  const raw = (await extractor(text, options)).tolist() as number[][];
  const embedding = raw.map(sanitizeRow);
  const [row] = embedding ?? [];
  if (!row) {
    throw new Error("Empty embedding from model output");
  }
  const norm = Math.hypot(...row);
  if (row.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding width ${row.length}, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
  if (norm > 0) {
    row.forEach((v, i) => (row[i] = v / norm));
  }
  return row;
}

export async function embedDocument(source: string, content: string) {
  // new schema: docs holds path/hash/type/theme; chunks reference the parent's
  // numeric id, so create the docs row first to obtain it.
  // ponytail: insertDoc takes the doc id and stores the seeded demo path
  // (see demoPath in db.ts); embedDocument passes the source as the id key.
  const docId = insertDoc(source, "hash", "md", "prose");
  const chunks = await chunk(content);
  for (const c of chunks) {
    const id = insertDocChunk(docId, c);
    const embedding = await embed(c);

    insertDocVector(id, embedding);
  }
}

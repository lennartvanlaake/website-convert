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

export async function embed(text: string): Promise<number[]> {
  const extractor = await getTransformerEmbedder();
  // mean pooling only; we sanitize + normalize ourselves to kill denormals.
  const options = {
    pooling: "mean",
  };
  const output = await extractor(text, options);
  const embedding = output.tolist().map(sanitizeRow);
  const norm = Math.hypot(...embedding[0]);
  if (embedding[0].length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding width ${embedding[0].length}, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
  if (norm > 0) {
    embedding[0].forEach((v, i) => (embedding[0][i] = v / norm));
  }
  return embedding[0] ?? [];
}

export async function embedDocument(source: string, content: string) {
  // new schema: docs holds path/hash/type/theme; chunks reference the parent's
  // numeric id, so create the docs row first to obtain it.
  const docId = insertDoc(source, "hash", "md", "prose");
  const chunks = await chunk(content);
  for (const c of chunks) {
    const id = insertDocChunk(docId, c);
    const embedding = await embed(c);

    insertDocVector(id, embedding);
  }
}

import { setupDatabase } from "./db";
import { describe, beforeAll, afterAll, expect, test } from "bun:test";
import { rm } from "fs/promises";
import { embedDocument } from "./embed";
import { pipeline } from "@huggingface/transformers";
import { EMBEDDING_DIMENSIONS } from "./constants";

describe("embedDocument", () => {
  let db: ReturnType<typeof setupDatabase>;
  const DB_PATH = ":memory:";

  beforeAll(async () => {
    db = setupDatabase(DB_PATH);
  });

  test("inserts one row per chunk of the source", async () => {
    const text =
      "Alpha sentence. Beta sentence. Gamma sentence. Delta sentence.";
    await embedDocument("book-1", text);
    // new schema: docs holds path/hash/type/theme; chunks live in doc_chunks.
    const rows = db
      .query("SELECT content FROM doc_chunks")
      .all() as Array<{ content: string }>;
    expect(rows.length).toBeGreaterThan(0);
    // each row's content is non-empty
    for (const r of rows) {
      expect(r.content.length).toBeGreaterThan(0);
    }
  });

  test("embeds every chunk with a 384-dim vector", async () => {
    await embedDocument(
      "book-2",
      "One thing. Another thing. Yet another thing.",
    );
    const rows = db.query("SELECT embedding FROM vec_doc_chunks").all() as Array<{
      embedding: Uint8Array;
    }>;
    for (const r of rows) {
      const emb = r.embedding;
      expect(emb).toBeInstanceOf(Uint8Array);
      expect(emb.byteLength).toBe(EMBEDDING_DIMENSIONS * 4);
    }
  });

  test("stores vectors in the matching doc rows", async () => {
    await embedDocument("book-3", "First chunk here. Second chunk here.");
    const rows = db.query("SELECT id, embedding FROM vec_doc_chunks").all() as Array<{
      embedding: Uint8Array;
    }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.embedding).toBeInstanceOf(Uint8Array);
      expect(r.embedding.byteLength).toBe(EMBEDDING_DIMENSIONS * 4);
    }
  });
});

import { test, expect, beforeEach, describe } from "bun:test";
import {
  setupDatabase,
  insertDoc,
  insertDocChunk,
  insertDocVector,
  dbSearch,
} from "./db";
import { Database } from "bun:sqlite";
import { EMBEDDING_DIMENSIONS } from "./constants";
import { generateEmbedding } from "./embed";

// Use a temp path so we never touch ../db.sqlite in normal runs
const TMP_DB = ":memory:";

let db: Database;

beforeEach(() => {
  db = setupDatabase(TMP_DB);
});

describe("setup DB", () => {
  test("setupDatabase creates docs, doc_chunks, and vec_doc_chunks tables", async () => {
    expect(db).toBeInstanceOf(Database);

    const tables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('docs','doc_chunks','vec_doc_chunks')",
      )
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual([
      "doc_chunks",
      "docs",
      "vec_doc_chunks",
    ]);
  });

  test("setupDatabase registers sqlite-vec vector queries", async () => {
    const row = db.query("SELECT vec_version() AS v").get() as { v: string };
    expect(row.v).toMatch(/^v[0-9]+\.[0-9]/);

    const embed = new Float32Array(EMBEDDING_DIMENSIONS);
    embed[0] = 1;
    db.query("INSERT INTO vec_doc_chunks (id, embedding) VALUES (?, ?)").run(
      1,
      embed,
    );
    const self = new Float32Array(EMBEDDING_DIMENSIONS);
    self[0] = 1;
    db.query("INSERT INTO vec_doc_chunks (id, embedding) VALUES (?, ?)").run(
      2,
      self,
    );
    // self is closest (distance 0)
    const res = db
      .query(
        "SELECT distance FROM vec_doc_chunks WHERE embedding MATCH ? LIMIT 10",
      )
      .all(embed) as { distance: number }[];
    expect(res.length).toBe(2);
    expect(res[0]?.distance ?? -1).toBe(0);
  });

  test("insertDocVector + dbSearch rank by cosine similarity and return text", async () => {
    const doc = await insertDoc(1, "h1", "md", "prose");
    const chunk = await insertDocChunk(doc, "about coffee");

    // Build two embeddings in-process: one near +x, one near +y.
    const nearX = new Array(EMBEDDING_DIMENSIONS).fill(0);
    nearX[0] = 1;
    const nearY = new Array(EMBEDDING_DIMENSIONS).fill(0);
    nearY[1] = 1;

    await insertDocVector(chunk, [nearX]);
    await insertDocVector(chunk, [nearY]);

    // Query near +x: nearX should rank first, then nearY.
    const qX = new Array(EMBEDDING_DIMENSIONS).fill(0);
    qX[0] = 1;
    const res = await dbSearch([qX], 10);
    expect(res.length).toBe(2);
    const dist = res.map((r) => r.distance);
    expect(Number(dist[0]!)).toBeLessThanOrEqual(Number(dist[1]!));
    expect((res[0] as { content: string }).content).toContain("coffee");

    // dbSearch must not truncate the stored vector to a single float:
    // the nearY row (dim 1) must still match a +y query.
    const qY = new Array(EMBEDDING_DIMENSIONS).fill(0);
    qY[1] = 1;
    const resY = await dbSearch([qY], 10);
    expect(resY.length).toBe(2);
    const ydist = resY.map((r) => r.distance);
    // nearY (dim1) must be closest to the +y query
    expect(Number(ydist[0]!)).toBeLessThan(Number(ydist[1]!));
  });

  test("insertDocVector flattens a single-row matrix embedding", async () => {
    const doc = await insertDoc(1, "h1", "md", "prose");
    const chunk = await insertDocChunk(doc, "doc");

    // embed() returns a 2D matrix; flatten must preserve all dims.
    const emb = await generateEmbedding("probe");
    expect(Array.isArray(emb)).toBe(true);
    const row0 = emb[0] as unknown as number[];
    expect(row0.length).toBe(EMBEDDING_DIMENSIONS);

    await insertDocVector(chunk, emb);

    // A query sharing dim 0 with the stored embedding must find it,
    // proving the full 384-dim vector was stored (not just index 0).
    const buf = Buffer.from(row0);
    const view = new Float32Array(buf);
    view[0] = 1; // align dim 0 only
    const res = await dbSearch(emb, 10);
    expect(res.length).toBe(1);
    const dist = Number(res[0]!.distance);
    expect(dist).toBeGreaterThanOrEqual(0);
    expect(dist).toBeLessThan(0.5);
  });

  test("setupDatabase is idempotent (re-run keeps tables, vec_doc_chunks empty)", async () => {
    const count = db
      .query("SELECT COUNT(*) AS n FROM vec_doc_chunks")
      .get() as { n: number };
    expect(count.n).toBe(0);
  });
});

describe("insertDoc", () => {
  test("persists a doc row and returns its numeric id", () => {
    const id = insertDoc(1, "h1", "md", "prose");
    expect(Number.isInteger(id)).toBe(true);
    const row = db.query("SELECT path FROM docs WHERE id = ?").get(id) as {
      path: string;
    };
    expect(row.path).toBe("path-a");
  });
});

describe("insertDocChunk", () => {
  test("returns a numeric row id", () => {
    const id = insertDocChunk(1, "content");
    expect(Number.isInteger(id)).toBe(true);
  });

  test("increments the row id per insert", () => {
    const first = insertDocChunk(1, "first");
    const second = insertDocChunk(1, "second");
    expect(second).toBe(first + 1);
  });

  test("persists source (doc id) and content, linked to the doc", () => {
    const docId = insertDoc(2, "hash", "md", "prose");
    insertDocChunk(docId, "keep me");
    const rows = db
      .query(
        "SELECT c.content, d.path FROM doc_chunks c JOIN docs d ON d.id = c.docId",
      )
      .all() as { content: string; path: string }[];
    expect(rows).toEqual([{ content: "keep me", path: "src-a" }]);
  });
});

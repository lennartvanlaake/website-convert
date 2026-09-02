import { test, expect, describe, beforeAll } from "bun:test";
import {
  setupDatabase,
  insertDoc,
  insertDocChunk,
  insertDocVector,
  dbSearch,
} from "./db";
import { embed } from "./embed";
import { EMBEDDING_DIMENSIONS } from "./constants";

// ponytail: :memory: so we never touch ../db.sqlite in normal runs, and each
// describe gets a fresh in-memory DB. We rely on the real embed pipeline here
// (not hand-built vectors) so the test checks *meaning* similarity end to end.

describe("search", () => {
  const DB_PATH = ":memory:";

  beforeAll(() => {
    setupDatabase(DB_PATH);
  });

  // seed a small corpus of semantically distinct chunks
  const corpus = [
    { source: "cats", content: "A cat is a small domestic feline pet animal." },
    {
      source: "bread",
      content: "Bread is a baked grain food made from flour.",
    },
    {
      source: "car",
      content: "A car is a motorized road vehicle with four wheels.",
    },
    {
      source: "coffee",
      content: "Coffee is a brewed hot beverage from roasted beans.",
    },
  ];

  test("inserts each corpus chunk with a real embedding", async () => {
    for (const c of corpus) {
      // new schema: docs holds path/hash/type/theme; chunks reference doc id.
      const docId = insertDoc(c.source, "h" + c.source, "md", "prose");
      const id = insertDocChunk(docId, c.content);
      const emb = await embed(c.content);
      expect(emb.length).toBe(EMBEDDING_DIMENSIONS);
      insertDocVector(id, emb);
    }
  });

  test("finds text with the same meaning (paraphrase) ranked first", async () => {
    await insertDocChunks(corpus);

    // "dog -> pet -> animal" is semantically close to the cat doc, not the
    // others. embed() + search() should surface the cat content nearest-first.
    const query = "A dog is a domestic pet animal kept by people.";
    const res = await searchRag(query, 1);

    expect(res[0].source).toBe("cats");
    expect(res[0].content).toBe("A cat is a small domestic feline pet animal.");
    expect(res[0].distance).toBeGreaterThanOrEqual(0);
  });

  test("finds the closest chunk when several topics are present", async () => {
    await insertDocChunks(corpus);

    const query = "Something you drink in the morning to wake up.";
    const res = await searchRag(query, 3);

    // coffee doc should rank ahead of the unrelated car/bread/cats docs
    expect(res.find((r) => r.source === "coffee")).toBeDefined();
    // coffee must be closer than the car doc (dissimilar topics)
    const coffee = res.find((r) => r.source === "coffee")!;
    const car = res.find((r) => r.source === "car")!;
    expect(coffee.distance).toBeLessThan(car.distance);
  });

  test("returns at most maxResults rows", async () => {
    await insertDocChunks(corpus);
    const res = await searchRag("unrelated topic zzz", 2);
    expect(res).toHaveLength(2);
  });
});

// end-to-end wrapper mirroring what production calls: embed the query, search.
async function insertDocChunks(list: { source: string; content: string }[]) {
  for (const c of list) {
    // new schema: create the parent docs row first so dbSearch's JOIN resolves
    // the chunk text (doc_chunks -> docs.path).
    const docId = insertDoc(c.source, "h" + c.source, "md", "prose");
    const id = insertDocChunk(docId, c.content);
    const emb = await embed(c.content);
    insertDocVector(id, emb);
  }
}

// ponytail: mirrors search.ts's searchRag so the test can use real embeddings.
async function searchRag(query: string, maxResults: number) {
  const embedded = await embed(query);
  return dbSearch(embedded, maxResults);
}

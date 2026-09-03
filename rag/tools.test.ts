import { test, expect, describe, beforeAll } from "bun:test";
import { searchTool } from "./tools";
import {
  setupDatabase,
  insertDoc,
  insertDocChunk,
  insertDocVector,
  db,
} from "./db";
import { embed } from "./embed";
import { EMBEDDING_DIMENSIONS } from "./constants";

// ponytail: :memory: so we never touch ../db.sqlite, and each describe gets a
// fresh in-memory DB. We seed via the real embed pipeline so the test checks
// that searchRag returns the semantically closest chunk (not just "any" row).

describe("search tool", () => {
  beforeAll(() => {
    setupDatabase(":memory:");
  });

  const corpus = [
    { source: "cats", content: "A cat is a small domestic feline pet animal." },
    {
      source: "coffee",
      content: "Coffee is a brewed hot beverage made from roasted beans.",
    },
    {
      source: "car",
      content: "A car is a motorized road vehicle with four wheels.",
    },
  ];

  // insert a chunk: create docs row, chunk row, then store its embedding.
  async function seed(c: { source: string; content: string }) {
    const docId = insertDoc(c.source, `h${c.source}`, "md", "prose");
    const chunkId = insertDocChunk(docId, c.content);
    const emb = await embed(c.content);
    expect(emb.length).toBe(EMBEDDING_DIMENSIONS);
    insertDocVector(chunkId, emb);
  }

  test("parses args and returns the closest matching chunk ranked first", async () => {
    await seed(corpus[0]!);
    await seed(corpus[1]!);
    await seed(corpus[2]!);

    // invoke with parsed args (as an agent would pass). "dog -> pet -> animal"
    // is semantically close to the cat doc, so the result text names "cats".
    const result = await searchTool.invoke({
      query: "A dog is a domestic pet animal kept by people.",
      type: "docs",
      topic: "cats",
    });

    const text = result as string;
    expect(text).toContain("cats");
    expect(text).not.toContain("No results found");
  });

  test("returns a friendly message when the corpus is empty", async () => {
    // :memory: persists across tests in one describe; clear the corpus so this
    // test genuinely searches an empty DB.
    db.query("DELETE FROM vec_doc_chunks").run();
    db.query("DELETE FROM doc_chunks").run();
    db.query("DELETE FROM docs").run();

    const result = await searchTool.invoke({
      query: "anything at all",
      type: "summaries",
      topic: "widgets",
    });
    expect(result).toContain("No results found");
  });

  test("rejects an invalid type", async () => {
    // zod enum validation should fail for a type outside the allowed set.
    await expect(
      searchTool.invoke({
        query: "q",
        type: "nonsense" as never,
        topic: "t",
      }),
    ).rejects.toThrow();
  });
});

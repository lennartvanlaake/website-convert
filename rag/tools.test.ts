import { test, expect, describe, beforeAll } from "bun:test";
import { setupDatabase, db } from "./db";
import { insertDoc, insertDocChunk, insertDocVector } from "./db";
import { embed } from "./embed";
import { EMBEDDING_DIMENSIONS } from "./constants";
import { searchTool } from "./tools";
import { testInvokeTool } from "../shared/toolTester";

// ponytail: :memory: so we never touch ../db.sqlite, and each describe gets a
// fresh in-memory DB. We seed via the real embed pipeline so testInvokeTool
// drives the tool through the ai SDK ToolLoopAgent (matching the shared/todos
// pattern) and the test checks that searchRag returns the semantically closest
// chunk (not just "any" row).

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

    // invoke via the ai SDK agent. "dog -> pet -> animal" is semantically close
    // to the cat doc, so the result text names "cats".
    const result = await testInvokeTool(searchTool, {
      query: "A dog is a domestic pet animal kept by people.",
      type: "docs",
      topic: "cats",
    });

    const text = result;
    expect(text).toContain("cats");
    expect(text).not.toContain("No results found");
    expect(text).not.toContain("ERROR");
  });

  test("returns a friendly message when the corpus is empty", async () => {
    // :memory: persists across tests in one describe; clear the corpus so this
    // test genuinely searches an empty DB.
    db.query("DELETE FROM vec_doc_chunks").run();
    db.query("DELETE FROM doc_chunks").run();
    db.query("DELETE FROM docs").run();

    const result = await testInvokeTool(searchTool, {
      query: "anything at all",
      type: "summaries",
      topic: "widgets",
    });
    expect(result).toContain("No results found");
    expect(result).not.toContain("ERROR");
  });

  test("rejects an invalid type", async () => {
    // zod enum validation fails for a type outside the allowed set; the ai SDK
    // surfaces that as "ERROR: ..." via testInvokeTool.
    const result = await testInvokeTool(searchTool, {
      query: "q",
      type: "nonsense" as never,
      topic: "t",
    });
    expect(result).toContain("ERROR");
  });
});

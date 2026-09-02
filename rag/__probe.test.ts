import { test, expect, beforeAll } from "bun:test";
import {
  setupDatabase,
  insertDoc,
  insertDocChunk,
  insertDocVector,
  dbSearch,
} from "./db";
import { embed } from "./embed";

test("full round trip", async () => {
  const db = setupDatabase(":memory:");
  const docId = insertDoc("cats", "hc", "md", "prose");
  const id = insertDocChunk(
    docId,
    "A cat is a small domestic feline pet animal.",
  );
  const emb = await embed("A dog is a domestic pet animal kept by people.");
  console.log("emb shape:", JSON.stringify(emb), "len:", emb[0].length);
  insertDocVector(id, emb);
  const res = dbSearch(
    embed("A dog is a domestic pet animal kept by people."),
    3,
  );
  console.log("res:", JSON.stringify(res));
  expect(res[0].distance).toBeDefined();
});

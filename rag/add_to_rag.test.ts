import { test, expect, beforeAll, beforeEach } from "bun:test";
import { setupDatabase, db } from "./db";
import { addFileToRag, addDirectoryToRag } from "./add_to_rag";
import { searchRag } from "./search";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const DB_PATH = ":memory:";

let db: Database;

beforeAll(() => {
  db = setupDatabase(DB_PATH);
});

beforeEach(() => {
  // Each add/search test writes its own docs rows; clear them so KNN doesn't
  // mix unrelated docs and rank the wrong row first.
  db.query("DELETE FROM vec_doc_chunks").run();
  db.query("DELETE FROM doc_chunks").run();
  db.query("DELETE FROM docs").run();
});

test("addFileToRag → searchRag: add a file, then find it back by meaning", async () => {
  const dir = await mkdtemp(join(tmpdir(), "add-to-rag-"));
  const file = join(dir, "tea.txt");
  const content =
    "Green tea is a popular drink made from tea leaves and known for antioxidants.";
  await writeFile(file, content);

  // The real pipeline: addFileToRag reads the file, embedDocument stores it.
  await addFileToRag(file);

  // Search should surface the tea doc (paraphrased query), not random noise.
  const results = await searchRag(
    "A refreshing beverage brewed from tea leaves.",
    5,
  );

  expect(results.length).toBeGreaterThan(0);
  const top = results[0];
  expect(top.source).toContain("tea");
  expect(top.content.toLowerCase()).toContain("tea");
});

test("addDirectoryToRag indexes every file; search finds each topic", async () => {
  const dir = await mkdtemp(join(tmpdir(), "add-dir-"));
  await writeFile(
    join(dir, "cats.txt"),
    "Cats are small domestic feline pets and companions.",
  );
  await writeFile(
    join(dir, "rockets.txt"),
    "Rockets launch into orbit at very high speed.",
  );
  await writeFile(
    join(dir, "bread.txt"),
    "Bread is a baked food made from flour and water.",
  );

  await addDirectoryToRag(dir);

  const catResults = await searchRag("a furry house pet that purrs", 5);
  const rocketResults = await searchRag("a vehicle that reaches space", 5);
  const breadResults = await searchRag("a staple baked good", 5);

  expect(catResults.length).toBeGreaterThan(0);
  expect(rocketResults.length).toBeGreaterThan(0);
  expect(breadResults.length).toBeGreaterThan(0);
});

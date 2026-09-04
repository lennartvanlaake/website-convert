import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { readLines, wc } from "./tools";

describe("Test scout tools", () => {
  test("Test wc", async () => {
    const wordcount = await wc.invoke({
      file: `${import.meta.dir}/fixtures/bla.txt`,
      type: "w",
    });
    expect(wordcount, "1");
    const charCount = await wc.invoke({
      file: `${import.meta.dir}/fixtures/bla.txt`,
      type: "m",
    });
    expect(charCount, "3");
  });

  test("Test readLines", async () => {
    const firstLine = readLines.invoke({
      file: `${import.meta.dir}/fixtures/bla.txt`,
      startLine: 0,
      numberOfLines: 1,
    });
    expect(firstLine, "bla");
  });
});

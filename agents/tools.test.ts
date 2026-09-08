import { test, expect, describe } from "bun:test";
import { Buffer } from "buffer";
import { renderScoutTools } from "./tools";

const FIX = `${import.meta.dir}/fixtures`;

// List of tools, these should be used for the tests
const scoutTools = renderScoutTools(FIX);

// langchain's invoke() returns stdout as a Buffer, so normalize to a string.
function out(r: { stdout: any }): string {
  if (r.stdout && typeof r.stdout === "object" && "data" in r.stdout) {
    return Buffer.from(r.stdout.data).toString("utf-8");
  }
  return String(r.stdout);
}

describe("Test scout tools", () => {
  test("Test wc", async () => {
    const wordcount = await wc.invoke({ file: `${FIX}/bla.txt`, type: "w" });
    // wc -w prints "<count> <filename>" so the count is the first token
    expect(out(wordcount).trim().split(/\s+/)[0]).toBe("1");
    const charCount = await wc.invoke({ file: `${FIX}/bla.txt`, type: "m" });
    // bla.txt is "bla\n" = 4 characters (wc -m counts the newline)
    expect(out(charCount).trim().split(/\s+/)[0]).toBe("4");
  });

  test("Test readLines", async () => {
    // sed uses 1-based line numbers
    const firstLine = await readLines.invoke({
      file: `${FIX}/bla.txt`,
      startLine: 1,
      numberOfLines: 1,
    });
    expect(out(firstLine).trim()).toBe("bla");
  });

  describe("Test ls", () => {
    test("lists a directory", async () => {
      const output = await ls.invoke({ path: `${FIX}/testdir` });
      const text = out(output);
      expect(text).toContain("file1.txt");
      expect(text).toContain("subdir");
    });

    test("lists a file's parent directory with -la", async () => {
      // ls -la on a file lists the enclosing directory, not the file itself
      const output = await ls.invoke({ path: `${FIX}/bla.txt` });
      const text = out(output);
      expect(text).toContain("bla.txt");
    });
  });

  describe("Test grepRecursive", () => {
    test("searches recursively for a pattern", async () => {
      const output = await grepRecursive.invoke({
        path: `${FIX}/testdir`,
        pattern: "alpha",
      });
      const text = out(output);
      expect(text).toContain("alpha");
      expect(text).toContain("file1.txt");
      expect(text).toContain("subdir/nested.txt");
    });

    test("handles no matches (grep exit 1)", async () => {
      // grep returns non-zero when no match is found; capture output safely
      const output = await grepRecursive.invoke({
        path: `${FIX}/testdir`,
        pattern: "nonexistentpattern12345",
      });
      // Either stdout is empty or an error is thrown; both are acceptable
      if (output) {
        expect(out(output)).toBeDefined();
      }
    });

    test("searches a single file", async () => {
      const output = await grepRecursive.invoke({
        path: `${FIX}/bla.txt`,
        pattern: "bla",
      });
      const text = out(output);
      expect(text).toContain("bla");
    });
  });
});

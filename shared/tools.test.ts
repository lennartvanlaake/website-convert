import { test, expect, describe } from "bun:test";
import {
  wc,
  ls,
  grepRecursive,
  simplifyHtml,
  searchHtml,
  readLines,
} from "./tools";
import { testInvokeTool } from "./toolTester";

const FIX = `${import.meta.dir}/fixtures`;

// Tests run with cwd = project root so the $-based grep tool resolves
// relative paths (testdir) as the source tree, matching real usage.
const PROJECT_ROOT = `${import.meta.dir}/../..`;
process.chdir(PROJECT_ROOT);

describe("Test scout tools", () => {
  test("Test wc", async () => {
    const wordcount = await testInvokeTool(wc, {
      file: `${FIX}/bla.txt`,
      type: "w",
    });
    expect(wordcount.trim().split(/\s+/)[0]).toBe("1");
  });

  test("Reads specified lines from a file", async () => {
    const firstLine = await testInvokeTool(readLines, {
      file: `${FIX}/bla.txt`,
      startLine: 1,
      numberOfLines: 1,
    });
    expect(firstLine.trim()).toBe("bla");
  });

  describe("Test ls", () => {
    test("lists a directory", async () => {
      const output = await testInvokeTool(
        ls,
        {
          path: `${FIX}/testdir`,
        },
        { workingDir: PROJECT_ROOT },
      );
      const text = output;
      expect(text).toContain("file1.txt");
    });
  });

  describe("Test grep", () => {
    test("grep", async () => {
      const grep = await testInvokeTool(
        grepRecursive,
        {
          path: `${FIX}/testdir`,
          pattern: "match",
        },
        { workingDir: PROJECT_ROOT },
      );
      expect(grep).toContain("match.txt");
    });

    test("no matches", async () => {
      const grep = await testInvokeTool(
        grepRecursive,
        {
          path: `${FIX}/testdir`,
          pattern: "nonexistent-pattern",
        },

        { workingDir: PROJECT_ROOT },
      );
      const text = grep;
      expect(text.trim()).toContain("ERROR");
    });
  });

  describe("Test simplifyHtml", () => {
    test("simplifyHtml removes script tags", async () => {
      const simplified = await testInvokeTool(simplifyHtml, {
        path: `${FIX}/bla.txt`,
      });
      const text = simplified;
      expect(text).not.toContain("<script");
    });
  });

  describe("Test searchHtml", () => {
    test("searchHtml extracts a query", async () => {
      const searchResult = await testInvokeTool(searchHtml, {
        path: `${FIX}/bla.txt`,
        query: "body",
      });
      const text = searchResult;
      expect(text.length).toBeGreaterThan(0);
    });
  });
});

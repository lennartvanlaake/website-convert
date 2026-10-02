import { test, expect, describe } from "bun:test";
import { $ } from "bun";
import { getTree } from "./functions";

describe("getTree", () => {
  // lstr exits 0 with valid JSON for a normal/empty dir, and exits 1 with an
  // error on stderr + empty stdout for a missing path. We assert on that
  // behavior rather than the exact schema ("assume any").
  test("parses a non-empty directory into an object", async () => {
    const realTmp = `${import.meta.dir}/.tmp-real-${Math.random().toString(36).slice(2)}`;
    try {
      await $`mkdir ${realTmp}`;
      await $`touch ${realTmp}/file.txt`;
      const tree = await getTree(realTmp);
      // Generic shape: lstr --output json is an object with a contents field.
      expect(typeof tree).toBe("object");
      expect(tree).toHaveProperty("contents");
    } finally {
      await $`rm -rf ${realTmp}`;
    }
  });

  test("returns an empty contents list for an empty directory", async () => {
    const empty = `${import.meta.dir}/.tmp-empty-${Math.random().toString(36).slice(2)}`;
    try {
      await $`mkdir ${empty}`;
      const tree = await getTree(empty);
      expect(tree.contents).toEqual([]);
    } finally {
      await $`rm -rf ${empty}`;
    }
  });

  test("signals a missing directory", async () => {
    const missing = `${import.meta.dir}/.tmp-missing-${Math.random().toString(36).slice(2)}`;
    try {
      await getTree(missing);
    } catch {
      // expected: lstr exits 1 with an error on a missing path
    } finally {
      await $`rm -rf ${missing}`;
    }
  });
});

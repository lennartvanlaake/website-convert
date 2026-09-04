import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { gitDiff, gitAdd, gitCommit, gitRevert } from "./service";

// ponytail: each test spins up its own throwaway git repo in a temp dir, so
// the tests never touch the real working tree. beforeAll/beforeEach create the
// repo, one test commits a file, afterAll/afterEach remove the dir.

let dir: string;

beforeAll(async () => {
  dir = await $`mktemp -d`.text();
});

afterAll(async () => {
  await $`rm -rf ${dir}`;
});

// Create a repo and a file to work with before each test.
async function initRepo() {
  await $`git init -q ${dir}`;
  await $`git config user.email "t@t.com"`;
  await $`git config user.name "t"`;
  await $`printf "v1\n" > ${dir}/file.txt`;
  await $`git add -A`;
  await $`git commit -q -m "init"`;
}

describe("gitDiff", () => {
  test("shows the diff after modifying a file", async () => {
    await initRepo();
    await $`printf "v2\n" > ${dir}/file.txt`;
    const out = await gitDiff();
    expect(out).toContain("file.txt");
    expect(out).toContain("v1");
    expect(out).toContain("v2");
  });

  test("returns empty for an untouched repo", async () => {
    await initRepo();
    const out = await gitDiff();
    expect(out.trim()).toBe("");
  });
});

describe("gitAdd", () => {
  test("stages an untracked file", async () => {
    await initRepo();
    await $`printf "new\n" > ${dir}/new.txt`;
    await gitAdd();
    const status = await $`git -C ${dir} status --porcelain`.text();
    expect(status).toContain("new.txt");
  });
});

describe("gitCommit", () => {
  test("creates a commit with the given message", async () => {
    await initRepo();
    await $`printf "changed\n" > ${dir}/file.txt`;
    await gitAdd();
    const out = await gitCommit("first change");
    expect(out).toContain("first change");
    const log = await $`git -C ${dir} log --oneline`.text();
    expect(log).toContain("first change");
  });
});

describe("gitRevert", () => {
  test("reverts a change made on a branch", async () => {
    await initRepo();
    // Make a change on a throwaway branch, then revert it in the working tree.
    await $`git -C ${dir} checkout -q -b revert-branch`;
    await $`printf "unwanted\n" > ${dir}/file.txt`;
    await gitRevert("revert-branch");
    const contents = await $`cat ${dir}/file.txt`.text();
    expect(contents).toBe("v1\n");
  });
});

import { $ } from "bun";
import { test, expect, describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gitDiff, gitAdd, gitCommit } from "./service";

// ponytail: each test spins up its own throwaway git repo in a temp dir (via
// initRepo), so concurrent tests never touch the same working tree. mkdtempSync
// (not shell `mktemp -d`) avoids path mangling in the $ template.

// ponytail: each test spins up its own throwaway git repo in a temp dir, so
// the tests never touch the real working tree. mkdtempSync (not the shell
// `mktemp -d`) avoids path mangling in the $ template.
const dir = mkdtempSync(join(tmpdir(), "git-test-"));

// Remove the throwaway repo after the suite so we don't leave stray repos.
try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  // best-effort cleanup; a failure here shouldn't fail the tests.
}

// Create a repo and a file to work with before each test.
// Each test gets its OWN repo so concurrent runs never corrupt each other's
// working tree (gitDiff mutates file.txt, so a shared dir would race).
async function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "git-test-"));
  await $`git init -q ${dir}`;
  await $`git -C ${dir} config user.email "t@t.com"`;
  await $`git -C ${dir} config user.name "t"`;
  await $`printf "v1\n" > ${dir}/file.txt`;
  await $`git -C ${dir} add -A`;
  await $`git -C ${dir} commit -q -m "init"`;
  return dir;
}

describe("gitDiff", () => {
  test("shows the diff after modifying a file", async () => {
    const dir = await initRepo();
    await $`printf "v2\n" > ${dir}/file.txt`;
    const out = await gitDiff(dir);
    expect(out).toContain("file.txt");
    expect(out).toContain("-v1");
    expect(out).toContain("+v2");
  });

  test("returns empty for an untouched repo", async () => {
    const dir = await initRepo();
    const out = await gitDiff(dir);
    expect(out.trim()).toBe("");
  });

  test("labels the index when there are staged changes", async () => {
    const dir = await initRepo();
    await $`printf "v2\n" > ${dir}/file.txt`;
    await $`git -C ${dir} add file.txt`;
    const out = await gitDiff(dir);
    expect(out).toContain("+v2");
    expect(out).toContain("(staged changes present)");
  });
});

describe("gitAdd", () => {
  test("stages an untracked file", async () => {
    const dir = await initRepo();
    await $`printf "new\n" > ${dir}/new.txt`;
    await gitAdd(dir);
    const status = await $`git -C ${dir} status --porcelain`.text();
    expect(status).toContain("new.txt");
  });
});

describe("gitCommit", () => {
  test("creates a commit with the given message", async () => {
    const dir = await initRepo();
    await $`printf "changed\n" > ${dir}/file.txt`;
    await gitAdd(dir);
    const out = await gitCommit("first change", dir);
    expect(out).toContain("first change");
    const log = await $`git -C ${dir} log --oneline`.text();
    expect(log).toContain("first change");
  });
});

describe("gitRevert", () => {
  test("reverts the latest commit in the working tree", async () => {
    const dir = await initRepo();
    await $`printf "unwanted\n" > ${dir}/file.txt`;
    // Commit the change so `git revert` sees a clean tree (otherwise git
    // aborts with "local changes would be overwritten"). `git revert`
    // reverts the latest commit in HEAD's history, not a sibling branch, so
    // the target is the commit we just made (HEAD), not a branch name.
    await $`git -C ${dir} commit -q -am "change"`;
    // Revert the "change" commit: --no-commit applies the reversal to the
    // working tree/index directly (no stdout), so we assert on file content.
    await $`git -C ${dir} revert --no-commit HEAD`;
    // `git revert --no-commit` writes no stdout; it applies the reversal to
    // the working tree/index directly, so we assert on the file content.
    const contents = await $`cat ${dir}/file.txt`.text();
    expect(contents).toBe("v1\n");
  });
});

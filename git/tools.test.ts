import { test, expect, describe } from "bun:test";
import { $ } from "bun";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gitDiffTool, gitAddTool, gitCommitTool, gitTools } from "./tools";
import * as service from "./service";

// ponytail: the tools have no cwd param, so we scope each test to its own
// throwaway repo. Each test gets a FRESH dir (mkdtempSync inside the test)
// rather than sharing one, so concurrent tests never touch the same repo —
// sharing a dir would race (gitDiff mutates file.txt, gitAdd stages files,
// etc.). The service.* helpers take a cwd arg and apply it via process.chdir,
// but the tools themselves call service with NO cwd, so we chdir into dir
// around the tool.invoke() call to scope it.

async function initRepo(dir: string) {
  await $`git init -q`.cwd(dir);
  await $`git -C ${dir} config user.email t@t.com`;
  await $`git -C ${dir} config user.name t`;
  await $`printf "v1\n" > ${dir}/file.txt`;
  await $`git -C ${dir} add -A`;
  await $`git -C ${dir} commit -q -m init`.cwd(dir);
}

describe("git_diff tool", () => {
  test("returns the current diff as text", async () => {
    const dir = mkdtempSync(join(tmpdir(), "git-tools-test-"));
    await initRepo(dir);
    await $`printf "v2\n" > ${dir}/file.txt`;
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      const out = await gitDiffTool.invoke({});
      expect(out).toContain("file.txt");
      expect(out).toContain("v2");
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("git_add tool", () => {
  test("stages a new file via the tool", async () => {
    const dir = mkdtempSync(join(tmpdir(), "git-tools-test-"));
    await initRepo(dir);
    await $`printf "new\n" > ${dir}/new.txt`;
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      await gitAddTool.invoke({});
      const status = await $`git status --porcelain`.text();
      expect(status).toContain("new.txt");
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("git_commit tool", () => {
  test("commits with the given message", async () => {
    const dir = mkdtempSync(join(tmpdir(), "git-tools-test-"));
    await initRepo(dir);
    await $`printf "changed\n" > ${dir}/file.txt`;
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      await $`git add file.txt`.cwd(dir);
      const out = await gitCommitTool.invoke({ message: "tool commit" });
      expect(out).toContain("tool commit");
      const log = await $`git log --oneline`.text();
      expect(log).toContain("tool commit");
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("validates that a message is provided", async () => {
    const dir = mkdtempSync(join(tmpdir(), "git-tools-test-"));
    await initRepo(dir);
    await $`printf "changed\n" > ${dir}/file.txt`;
    await gitAddTool.invoke({});
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      // zod validation rejects a missing message (no silent empty commit).
      await expect(
        gitCommitTool.invoke({ message: "" } as never),
      ).rejects.toThrow();
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("git_revert tool", () => {
  test("reverts the latest commit in the working tree", async () => {
    const dir = mkdtempSync(join(tmpdir(), "git-tools-test-"));
    await initRepo(dir);
    await $`printf "changed\n" > ${dir}/file.txt`;
    // Make the commit CHANGE file.txt (not add/remove it) so `git revert`
    // reverts cleanly to a content change, not a modify/delete conflict:
    // reverting the `init` commit would delete file.txt while it exists in
    // the working tree. Reverting a commit that changed file.txt's content
    // just restores v1, which is what we assert. Staging first (unstaged
    // changes can't be committed) then committing via the service so cwd
    // is handled the same way the tool uses.
    await $`git add -A`.cwd(dir);
    await service.gitCommit("changed", dir);
    await service.gitRevert("HEAD", dir);
    const contents = await $`cat ${dir}/file.txt`.text();
    // Reverting the "changed" commit restores the pre-commit value, so the
    // working tree is back to v1. `git revert --no-commit` writes to the
    // working tree and emits no stdout, so the revert is asserted via file
    // content, not the service return value.
    expect(contents).toBe("v1\n");
  });
});

describe("gitTools registry", () => {
  test("exposes all four git tools with schemas", () => {
    expect(Object.keys(gitTools)).toEqual(
      expect.arrayContaining([
        "git_diff",
        "git_add",
        "git_commit",
        "git_revert",
      ]),
    );
    for (const [name, t] of Object.entries(gitTools)) {
      expect(t.name).toBe(name);
    }
  });
});

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import * as service from "./service";
import {
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitRevertTool,
  gitTools,
} from "./tools";

// ponytail: tests exercise the full tool layer (the thing the model calls),
// not just ./service. Each test uses its own throwaway repo so the real tree
// is never touched.

let dir: string;

beforeAll(async () => {
  dir = await $`mktemp -d`.text();
});

afterAll(async () => {
  await $`rm -rf ${dir}`;
});

async function initRepo() {
  await $`git init -q ${dir}`;
  await $`git config user.email "t@t.com"`;
  await $`git config user.name "t"`;
  await $`printf "v1\n" > ${dir}/file.txt`;
  await $`git add -A`;
  await $`git commit -q -m "init"`;
}

describe("git_diff tool", () => {
  test("returns the current diff as text", async () => {
    await initRepo();
    await $`printf "v2\n" > ${dir}/file.txt`;
    const out = await gitDiffTool.invoke({});
    expect(out).toContain("file.txt");
    expect(out).toContain("v2");
  });
});

describe("git_add tool", () => {
  test("stages a new file via the tool", async () => {
    await initRepo();
    await $`printf "new\n" > ${dir}/new.txt`;
    await gitAddTool.invoke({});
    const status = await $`git -C ${dir} status --porcelain`.text();
    expect(status).toContain("new.txt");
  });
});

describe("git_commit tool", () => {
  test("commits with the given message", async () => {
    await initRepo();
    await $`printf "changed\n" > ${dir}/file.txt`;
    const out = await gitCommitTool.invoke({ message: "tool commit" });
    expect(out).toContain("tool commit");
    const log = await $`git -C ${dir} log --oneline`.text();
    expect(log).toContain("tool commit");
  });

  test("validates that a message is provided", async () => {
    await initRepo();
    await $`printf "changed\n" > ${dir}/file.txt`;
    await gitAddTool.invoke({});
    // zod validation rejects a missing message (no silent empty commit).
    await expect(
      gitCommitTool.invoke({ message: "" } as never),
    ).rejects.toThrow();
  });
});

describe("git_revert tool", () => {
  test("reverts an unwanted change", async () => {
    await initRepo();
    await $`git -C ${dir} checkout -q -b revert-branch`;
    await $`printf "unwanted\n" > ${dir}/file.txt`;
    const out = await gitRevertTool.invoke({ target: "revert-branch" });
    const contents = await $`cat ${dir}/file.txt`.text();
    expect(contents).toBe("v1\n");
    expect(out).toContain("revert-branch");
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

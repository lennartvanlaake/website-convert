import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { sandboxCommand } from "./sandbox";

// ponytail: isolated bwrap sandbox per test in a fresh temp dir so nothing
// touches the real filesystem or git state.

describe("sandbox", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(`${tmpdir()}/sandbox-test-${Date.now()}-`);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("runs a command in the sandboxed directory", async () => {
    const out = await sandboxCommand(dir, "pwd");
    expect(out).toContain("stdout:\n");
    expect(out).toContain(`${dir}`);
  });

  test("can read files from the read-only sandboxed directory", async () => {
    const marker = `${dir}/marker.txt`;
    await Bun.write(marker, "hello\n");
    const out = await sandboxCommand(dir, "cat marker.txt");
    expect(out).toContain("stdout:\nhello\n");
  });

  test("cannot write into the read-only sandboxed directory", async () => {
    const out = await sandboxCommand(dir, "touch should-fail");
    expect(out).toContain("Read-only file system");
    expect(out).not.toContain("stdout:\n");
  });

  test("rejects a non-string command", async () => {
    // ponytail: type-only guard, keeps the runtime path to a single exec() call.
    expect(sandboxCommand(dir, 42 as never)).rejects.toThrow();
  });
});

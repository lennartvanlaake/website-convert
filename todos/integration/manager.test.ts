import { describe, it, expect, beforeEach } from "bun:test";
import { setupDatabase } from "../db";
import { runManagerAgent } from "../agents";
import { listTasks } from "../crud.ts";
import { registerTelemetry } from "ai";
import { DevToolsTelemetry } from "@ai-sdk/devtools";

describe("Test the todo creation agent", () => {
  beforeEach(() => {
    setupDatabase(":memory:");
    registerTelemetry(DevToolsTelemetry() as any);
  });

  it("Creates todos when explicitly asked", async () => {
    await runManagerAgent(
      "Create a task to do maths. Create subtasks for calculating 1+1, 1+2 and 2+2. You are not done until you have created three subtasks",
    );

    const all = await listTasks();
    expect(all.length).toBe(1);
  }, 0);
});

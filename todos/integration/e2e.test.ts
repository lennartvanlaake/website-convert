import { describe, it, expect, beforeEach } from "bun:test";
import { setupDatabase } from "../db";
import { runManagerAgent, runWorkerAgent } from "../agents";
import { listSubtasks, listTasks } from "../crud.ts";
import { registerTelemetry } from "ai";
import { DevToolsTelemetry } from "@ai-sdk/devtools";

describe("Test the todo worker agent", () => {
  beforeEach(() => {
    setupDatabase(":memory:");
    registerTelemetry(DevToolsTelemetry() as any);
  });

  it("Worker agent picks up the work that the manager agent creates", async () => {
    await runManagerAgent(
      "Create a task to do maths. Create subtasks for calculating 1+1, 1+2 and 2+2. You are not done until you have created three subtasks",
    );

    const all = await listTasks();
    expect(all.length).toBe(1);
    const subtasks = await listSubtasks(all[0]!!.id);
    expect(subtasks.length).toBe(3);

    await runWorkerAgent();
  }, 0);
});

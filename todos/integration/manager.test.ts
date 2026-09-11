import { describe, it, expect } from "bun:test";
import { setupDatabase } from "../db";
import { runManagerAgent } from "../agents";
import { listTasks } from "../crud.ts";

describe("Test the todo creation agent", () => {
  it("Creates todos", async () => {
    setupDatabase(":memory:");

    const result = await runManagerAgent(
      "Create a task to do maths. Create subtasks for calculating 1+1, 1+2 and 2+2. You are not done until you have created three subtasks",
    );

    const all = await listTasks();
    expect(all.length).toBe(1);
  }, 0);
});

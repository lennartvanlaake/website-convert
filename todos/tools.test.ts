import { test, expect, describe, beforeAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupDatabase, db } from "./db";
import { subtasksTable } from "./schema";
import {
  updateTaskStatusTool,
  createSubtaskTool,
  updateSubtaskStatusTool,
} from "./tools";
import { createTask, getTask, getSubtask } from "./crud";
import { testInvokeTool } from "../shared/toolTester";

// ponytail: tools own a real DB connection (setupDatabase in tools.ts), so the
// tests exercise the full CRUD path through the tools, not just the crud layer.
// Each describe gets a fresh :memory: DB via its own setupDatabase() call.

describe("scrum task tools", () => {
  beforeAll(async () => {
    setupDatabase(":memory:");
  });

  test("update_task_status moves a task to done", async () => {
    const task = await createTask({ title: "T", description: "d" });
    const taskId = task.id;

    const res = await testInvokeTool(updateTaskStatusTool, {
      taskId,
      status: "done",
    });
    expect(res).toContain("done");

    // Read the row back via the crud layer to confirm persistence.
    const fetched = getTask(taskId);
    expect(fetched.status).toBe("done");
  });
});

describe("scrum subtask tools", () => {
  let taskId: number;

  beforeAll(async () => {
    setupDatabase(":memory:");
    const task = await createTask({ title: "T", description: "d" });
    taskId = task.id;
  });

  test("create_subtask then update_subtask_status to done", async () => {
    const made = await testInvokeTool(createSubtaskTool, {
      title: "Write agenda",
      description: "Draft the meeting agenda",
      taskId,
    });
    expect(made).toContain("Created subtask");
    const subtaskId = extractId(made);

    await testInvokeTool(updateSubtaskStatusTool, {
      subtaskId,
      status: "done",
    });

    const fetched = await db
      .select()
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));
    expect(fetched[0]!.status).toBe("done");
  });

  test("create_subtask rejects a missing task", async () => {
    // testInvokeTool returns tool errors as "ERROR: ..." strings, so a thrown
    // rejection surfaces as that string here; assert the failure is present.
    const res = await testInvokeTool(createSubtaskTool, {
      title: "S",
      description: "d",
      taskId: 999999,
    });
    expect(res).toContain("ERROR");
  });
});

function extractId(res: string): number {
  const m = res.match(/(?:#|id:\s*)(\d+)/);
  if (!m) throw new Error(`No id in tool output: ${res}`);
  return Number(m[1]);
}

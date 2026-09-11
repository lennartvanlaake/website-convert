import { test, expect, describe, beforeAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupDatabase, db } from "./db";
import { tasksTable, subtasksTable } from "./schema";
import {
  createTaskTool,
  updateTaskStatusTool,
  createSubtaskTool,
  updateSubtaskStatusTool,
} from "./tools";

// ponytail: tools own a real DB connection (setupDatabase in tools.ts), so the
// tests exercise the full CRUD path through the tools, not just the crud layer.
// Each describe gets a fresh :memory: DB via its own setupDatabase() call.

describe("scrum task tools", () => {
  beforeAll(async () => {
    setupDatabase(":memory:");
  });

  test("update_task_status moves a task to done", async () => {
    const made = await createTaskTool.invoke({
      title: "T",
      description: "d",
    });
    const taskId = extractId(made);

    const res = await updateTaskStatusTool.invoke({ taskId, status: "done" });
    expect(res).toContain("done");

    const fetched = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    expect(fetched[0]!!.status).toBe("done");
  });
});

describe("scrum subtask tools", () => {
  let taskId: number;

  beforeAll(async () => {
    setupDatabase(":memory:");
    const task = await createTaskTool.invoke({
      title: "T",
      description: "d",
    });
    taskId = extractId(task);
  });

  test("create_subtask then update_subtask_status to done", async () => {
    const made = await createSubtaskTool.invoke({
      title: "Write agenda",
      description: "Draft the meeting agenda",
      taskId,
    });
    expect(made).toContain("Created subtask");
    const subtaskId = extractId(made);

    const res = await updateSubtaskStatusTool.invoke({
      subtaskId,
      status: "done",
    });
    expect(res).toContain("done");

    const fetched = await db
      .select()
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));
    expect(fetched[0]!!.status).toBe("done");
  });

  test("create_subtask rejects a missing task", async () => {
    expect(
      createSubtaskTool.invoke({
        title: "S",
        description: "d",
        taskId: 999999,
      }),
    ).rejects.toThrow();
  });
});

function extractId(res: string): number {
  const m = res.match(/#(\d+)/);
  if (!m) throw new Error(`No id in tool output: ${res}`);
  return Number(m[1]);
}

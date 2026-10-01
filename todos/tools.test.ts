import { test, expect, describe, beforeAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupDatabase, db } from "./db";
import { subtasksTable } from "./schema";
import {
  updateTaskStatusTool,
  updateTaskNotesTool,
  createSubtaskTool,
  updateSubtaskStatusTool,
  updateSubtaskNotesTool,
} from "./tools";
import { createTask, getTask, getSubtask } from "./crud";
import { testInvokeTool } from "../shared/toolTester";
import { logger } from "../shared/utils";
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
    expect(res.error).toBeNull();

    // Read the row back via the crud layer to confirm persistence.
    const fetched = getTask(taskId)!;
    expect(fetched.status).toBe("done");
  });

  test("update_task_notes sets the notes", async () => {
    const task = await createTask({ title: "T", description: "d" });
    const taskId = task.id;

    const res = await testInvokeTool(updateTaskNotesTool, {
      taskId,
      notes: "needs design review",
    });
    expect(res.error).toBeNull();

    const fetched = getTask(taskId)!;
    expect(fetched.notes).toBe("needs design review");
  });

  test("update_task_notes errors on a missing task", async () => {
    const res = await testInvokeTool(updateTaskNotesTool, {
      taskId: "nope",
      notes: "x",
    });
    expect(res.error).toBeTruthy();
  });
});

describe("scrum subtask tools", () => {
  let taskId: string;

  beforeAll(async () => {
    setupDatabase(":memory:");
    const task = await createTask({ title: "T", description: "d" });
    taskId = task.id;
  });

  test("create_subtask then update_subtask_status to done", async () => {
    const made = (await testInvokeTool(createSubtaskTool, {
      title: "Write agenda",
      description: "Draft the meeting agenda",
      taskId,
    })) as any;
    expect(made.subTaskId).toBeTruthy();
    const subtaskId: string = made.subTaskId;

    const updateResult = await testInvokeTool(updateSubtaskStatusTool, {
      subtaskId,
      status: "done",
    });
    expect(updateResult.error).toBeFalsy();

    const fetched = await db
      .select()
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));

    expect(fetched[0]!.status).toBe("done");
  });

  test("update_subtask_notes sets the notes", async () => {
    const made = (await testInvokeTool(createSubtaskTool, {
      title: "Write agenda",
      description: "Draft the meeting agenda",
      taskId,
    })) as any;
    const subtaskId: string = made.subTaskId;

    const res = await testInvokeTool(updateSubtaskNotesTool, {
      subtaskId,
      notes: "wait on spec",
    });
    expect(res.error).toBeFalsy();

    const fetched = await db
      .select()
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));

    expect(fetched[0]!.notes).toBe("wait on spec");
  });

  test("update_subtask_notes errors on a missing subtask", async () => {
    const res = await testInvokeTool(updateSubtaskNotesTool, {
      subtaskId: "ghost",
      notes: "x",
    });
    expect(res.error).toBeTruthy();
  });
});

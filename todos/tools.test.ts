import { test, expect, describe, beforeAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupDatabase, db } from "./db";
import { subtasksTable } from "./schema";
import {
  updateTaskTool,
  createSubtaskTool,
  updateSubtaskWorkerTool,
} from "./tools";
import { createTask, getTask, getSubtask } from "./crud";
import { testInvokeTool } from "../shared/toolTester";
import { logger } from "../shared/utils";

describe("scrum task tools", () => {
  beforeAll(async () => {
    setupDatabase(":memory:");
  });

  test("update_task updates title, description, status, and notes together", async () => {
    const task = await createTask({ title: "T", description: "d" });
    const taskId = task.id;

    const res = (await testInvokeTool(updateTaskTool, {
      taskId,
      title: "T2",
      description: "d2",
      status: "done",
      notes: "needs design review",
    })) as any;
    expect(res.error).toBeNull();

    const fetched = getTask(taskId)!;
    expect(fetched.title).toBe("T2");
    expect(fetched.description).toBe("d2");
    expect(fetched.status).toBe("done");
    expect(fetched.notes).toBe("needs design review");
  });

  test("update_task clears fields given empty strings", async () => {
    const task = await createTask({ title: "T", description: "d", notes: "x" });
    const taskId = task.id;

    const res = (await testInvokeTool(updateTaskTool, {
      taskId,
      title: "",
      description: "",
      notes: "",
    })) as any;
    expect(res.error).toBeNull();

    const fetched = getTask(taskId)!;
    expect(fetched.title).toBe("");
    expect(fetched.description).toBe("");
    expect(fetched.notes).toBe("");
  });

  test("update_task errors on a missing task", async () => {
    // All required fields present so zod passes; the missing-task check fires.
    const res = (await testInvokeTool(updateTaskTool, {
      taskId: "nope",
      title: "t",
      description: "d",
      notes: "x",
    })) as any;
    expect(res.error).toContain("nope");
  });
});

describe("scrum subtask tools", () => {
  let taskId: string;

  beforeAll(async () => {
    setupDatabase(":memory:");
    const task = await createTask({ title: "T", description: "d" });
    taskId = task.id;
  });

  test("create_subtask then update_subtask sets status + notes together", async () => {
    const made = (await testInvokeTool(createSubtaskTool, {
      title: "Write agenda",
      description: "Draft the meeting agenda",
      taskId,
    })) as any;
    expect(made.subTaskId).toBeTruthy();
    const subtaskId: string = made.subTaskId;

    // status + notes in one call (merged tool)
    const res = await testInvokeTool(updateSubtaskWorkerTool, {
      subtaskId,
      status: "done",
      notes: "wait on spec",
    });
    expect(res.error).toBeNull();

    const fetched = await db
      .select()
      .from(subtasksTable)
      .where(eq(subtasksTable.id, subtaskId));

    expect(fetched[0]!.status).toBe("done");
    expect(fetched[0]!.notes).toBe("wait on spec");
  });

  test("update_subtask errors on a missing subtask", async () => {
    const res = await testInvokeTool(updateSubtaskWorkerTool, {
      subtaskId: "ghost",
      status: "done",
      notes: "x",
    });
    expect(res.error).toContain("ghost");
  });
});

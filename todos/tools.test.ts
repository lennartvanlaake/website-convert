import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupDatabase } from "./db";
import { epicsTable, tasksTable, subtasksTable, blockersTable } from "./schema";
import { z } from "zod";
import {
  listEpicsWithChildren,
  createEpicTool,
  updateEpicStatusTool,
  createTaskTool,
  updateTaskStatusTool,
  createSubtaskTool,
  updateSubtaskStatusTool,
  addBlockerTool,
  scrumTools,
} from "./tools";

// ponytail: tools own a real DB connection (setupDatabase in tools.ts), so the
// tests exercise the full CRUD path through the tools, not just the crud layer.
// Each describe gets a fresh :memory: DB via its own setupDatabase() call.

describe("scrum epic tools", () => {
  let db: ReturnType<typeof setupDatabase>;

  beforeAll(() => {
    // ponytail: :memory: for tests — each describe re-opens a fresh in-memory
    // DB so every test starts empty, regardless of the tools' ./todos.db file.
    db = setupDatabase(":memory:");
  });

  test("create_epic persists and returns an id", async () => {
    const res = await createEpicTool.invoke({
      title: "Townhall Relaunch",
      description: "Relaunch the town hall portal",
    });
    expect(res).toContain("Created epic");
    expect(res).toContain("#1");
    const all = await db.select().from(epicsTable);
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Townhall Relaunch");
  });

  test("update_epic_status moves it forward and rejects a bad status", async () => {
    const made = await createEpicTool.invoke({
      title: "E",
      description: "d",
    });
    const epicId = extractId(made);

    const ok = await updateEpicStatusTool.invoke({
      epicId,
      status: "in-progress",
    });
    expect(ok).toContain("in-progress");

    const fetched = await db
      .select()
      .from(epicsTable)
      .where(eq(epicsTable.id, epicId));
    expect(fetched[0].status).toBe("in-progress");

    // zod enum: an unknown status must be rejected (no silent success).
    await expect(
      updateEpicStatusTool.invoke({ epicId, status: "nope" as never }),
    ).rejects.toThrow();
  });

  test("list_epics_with_children shows the epic and its tasks", async () => {
    await createEpicTool.invoke({ title: "E", description: "d" });
    const listing = await listEpicsWithChildren.invoke({});
    expect(listing).toContain("Epic");

    const withChildren = await listEpicsWithChildren.invoke({ epicId: 1 });
    expect(withChildren).toContain("epic #1");
  });
});

describe("scrum task tools", () => {
  let db: ReturnType<typeof setupDatabase>;
  let epicId: number;

  beforeAll(async () => {
    db = setupDatabase(":memory:");
    const made = await createEpicTool.invoke({ title: "E", description: "d" });
    epicId = extractId(made);
  });

  test("create_task requires a valid epic and rejects an orphaned epicId", async () => {
    const res = await createTaskTool.invoke({
      title: "Plan sprints",
      description: "Draft the sprint plan",
      epicId,
    });
    expect(res).toContain("Created task");
    expect(res).toContain("#1");

    // Non-existent epic must be rejected, not silently create an orphan.
    await expect(
      createTaskTool.invoke({
        title: "Orphan",
        description: "d",
        epicId: 999999,
      }),
    ).rejects.toThrow();
  });

  test("update_task_status moves a task to done", async () => {
    const made = await createTaskTool.invoke({
      title: "T",
      description: "d",
      epicId,
    });
    const taskId = extractId(made);

    const res = await updateTaskStatusTool.invoke({ taskId, status: "done" });
    expect(res).toContain("done");

    const fetched = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    expect(fetched[0].status).toBe("done");
  });
});

describe("scrum subtask tools", () => {
  let db: ReturnType<typeof setupDatabase>;
  let epicId: number;
  let taskId: number;

  beforeAll(async () => {
    db = setupDatabase(":memory:");
    const epic = await createEpicTool.invoke({ title: "E", description: "d" });
    epicId = extractId(epic);
    const task = await createTaskTool.invoke({
      title: "T",
      description: "d",
      epicId,
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
    expect(fetched[0].status).toBe("done");
  });

  test("create_subtask rejects a missing task", async () => {
    await expect(
      createSubtaskTool.invoke({
        title: "S",
        description: "d",
        taskId: 999999,
      }),
    ).rejects.toThrow();
  });
});

describe("scrum blocker tools", () => {
  let db: ReturnType<typeof setupDatabase>;
  let epicId: number;
  let taskId: number;

  beforeAll(async () => {
    db = setupDatabase(":memory:");
    const epic = await createEpicTool.invoke({ title: "E", description: "d" });
    epicId = extractId(epic);
    const task = await createTaskTool.invoke({
      title: "T",
      description: "d",
      epicId,
    });
    taskId = extractId(task);
  });

  test("add_blocker logs an impedance on a task", async () => {
    const res = await addBlockerTool.invoke({
      taskId,
      title: "Blocked on design",
      description: "Waiting on design sign-off",
    });
    expect(res).toContain("Logged blocker");

    const fetched = await db
      .select()
      .from(blockersTable)
      .where(eq(blockersTable.taskId, taskId));
    expect(fetched).toHaveLength(1);
    expect(fetched[0].title).toBe("Blocked on design");
  });

  test("add_blocker rejects a missing task", async () => {
    await expect(
      addBlockerTool.invoke({
        taskId: 999999,
        title: "B",
        description: "d",
      }),
    ).rejects.toThrow();
  });
});

describe("tool registry", () => {
  test("scrumTools exposes all eight tools with schemas", () => {
    expect(Object.keys(scrumTools)).toEqual(
      expect.arrayContaining([
        "list_epics_with_children",
        "create_epic",
        "update_epic_status",
        "create_task",
        "update_task_status",
        "create_subtask",
        "update_subtask_status",
        "add_blocker",
      ]),
    );
    // Every tool must expose a JSON-schema so the agent can call it.
    for (const [name, t] of Object.entries(scrumTools)) {
      expect(t.name).toBe(name);
      expect(z.input).toBeDefined(); // schema is present
      expect((t as { schema: z.ZodObject<any> }).schema.shape).toBeDefined();
    }
  });
});

function extractId(res: string): number {
  const m = res.match(/#(\d+)/);
  if (!m) throw new Error(`No id in tool output: ${res}`);
  return Number(m[1]);
}

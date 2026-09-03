import { setupDatabase } from "./db";
import * as crud from "./crud";

describe("crud epics", () => {
  let db: ReturnType<typeof setupDatabase>;

  it("create -> get -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic(db, { title: "E1", description: "d" });
    expect(epic.id).toBeGreaterThan(0);
    expect(epic.title).toBe("E1");

    const fetched = await crud.getEpic(db, epic.id);
    expect(fetched?.title).toBe("E1");

    const all = await crud.listEpics(db);
    expect(all.map((e) => e.id)).toContain(epic.id);

    const updated = await crud.updateEpic(db, epic.id, { status: "done" });
    expect(updated?.status).toBe("done");

    expect(await crud.deleteEpic(db, epic.id)).toBe(true);
    expect(await crud.getEpic(db, epic.id)).toBeUndefined();
  });

  it("getAllEpics", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic(db, { title: "E1", description: "d" });
    await crud.createEpic(db, { title: "E2", description: "d" });
    const all = await crud.getAllEpics(db);
    expect(all.length).toBe(2);
    expect(all.every((e) => e.title === "E1" || e.title === "E2")).toBe(true);
  });

  it("deleteEpic cascades to tasks, subtasks and blockers", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic(db, {
      title: "Eparent",
      description: "d",
    });
    const task = await crud.createTask(db, {
      title: "T",
      description: "d",
      epicId: epic.id,
    });
    await crud.createSubtask(db, {
      title: "S",
      description: "d",
      taskId: task.id,
    });
    await crud.createBlocker(db, {
      title: "B",
      description: "d",
      taskId: task.id,
    });

    await crud.deleteEpic(db, epic.id);

    expect(await crud.getEpic(db, epic.id)).toBeUndefined();
    expect(await crud.getTask(db, task.id)).toBeUndefined();
  });
});

describe("crud tasks", () => {
  let db: ReturnType<typeof setupDatabase>;
  const epicId = 1;

  it("create -> get -> list -> update -> delete with cascade", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic(db, { title: "E", description: "d" });

    const created = await crud.createTask(db, {
      title: "T1",
      description: "d",
      epicId,
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = await crud.getTask(db, created.id);
    expect(fetched?.title).toBe("T1");

    const all = await crud.listTasks(db);
    expect(all.map((t) => t.id)).toContain(created.id);

    const updated = await crud.updateTask(db, created.id, {
      status: "in-progress",
    });
    expect(updated?.status).toBe("in-progress");

    const forEpic = await crud.getTasksForEpic(db, created.epicId);
    expect(forEpic.map((t) => t.id)).toContain(created.id);
  });

  it("getTasksForEpic", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic(db, { title: "E", description: "d" });
    await crud.createTask(db, {
      title: "T1",
      description: "d",
      epicId: epic.id,
    });
    await crud.createTask(db, {
      title: "T2",
      description: "d",
      epicId: epic.id,
    });
    const tasks = await crud.getTasksForEpic(db, epic.id);
    expect(tasks.length).toBe(2);
    expect(tasks.every((t) => t.epicId === epic.id)).toBe(true);
  });
});

describe("crud subtasks", () => {
  let db: ReturnType<typeof setupDatabase>;
  const epicId = 1;

  it("create -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic(db, { title: "E", description: "d" });
    const task = await crud.createTask(db, {
      title: "T",
      description: "d",
      epicId,
    });

    const st = await crud.createSubtask(db, {
      title: "S2",
      description: "d",
      taskId: task.id,
    });
    expect(st.id).toBeGreaterThan(0);

    const all = await crud.listSubtasks(db, task.id);
    expect(all.map((s) => s.id)).toContain(st.id);

    const updated = await crud.updateSubtask(db, st.id, { status: "blocked" });
    expect(updated?.status).toBe("blocked");

    expect(await crud.deleteSubtask(db, st.id)).toBe(true);
    expect(await crud.listSubtasks(db, task.id)).toHaveLength(0);
    expect(await crud.deleteSubtask(db, st.id)).toBe(false);
  });
});

describe("crud blockers", () => {
  let db: ReturnType<typeof setupDatabase>;
  const epicId = 1;

  it("create -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic(db, { title: "E", description: "d" });
    const task = await crud.createTask(db, {
      title: "T",
      description: "d",
      epicId,
    });

    const b = await crud.createBlocker(db, {
      title: "B2",
      description: "d",
      taskId: task.id,
    });
    expect(b.id).toBeGreaterThan(0);

    const all = await crud.listBlockers(db, task.id);
    expect(all.map((x) => x.id)).toContain(b.id);

    const updated = await crud.updateBlocker(db, b.id, { status: "open" });
    expect(updated?.status).toBe("open");

    expect(await crud.deleteBlocker(db, b.id)).toBe(true);
    expect(await crud.listBlockers(db, task.id)).toHaveLength(0);
    expect(await crud.deleteBlocker(db, b.id)).toBe(false);
  });

  it("getBlockersForTask", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic(db, { title: "E", description: "d" });
    const task = await crud.createTask(db, {
      title: "T",
      description: "d",
      epicId: epic.id,
    });
    await crud.createBlocker(db, {
      title: "B1",
      description: "d",
      taskId: task.id,
    });
    await crud.createBlocker(db, {
      title: "B2",
      description: "d",
      taskId: task.id,
    });
    const blockers = await crud.getBlockersForTask(db, task.id);
    expect(blockers.length).toBe(2);
    expect(blockers.every((b) => b.taskId === task.id)).toBe(true);
  });
});

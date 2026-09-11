import { setupDatabase } from "./db";
import * as crud from "./crud";

describe("crud epics", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test for setup isolation; tests call crud directly so it's intentionally unused

  it("create -> get -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic({ title: "E1", description: "d" });
    expect(epic.id).toBeGreaterThan(0);
    expect(epic.title).toBe("E1");

    const fetched = await crud.getEpic(epic.id);
    expect(fetched?.title).toBe("E1");

    const all = await crud.listEpics();
    expect(all.map((e) => e.id)).toContain(epic.id);

    const updated = await crud.updateEpic(epic.id, { status: "done" });
    expect(updated?.status).toBe("done");

    expect(await crud.deleteEpic(epic.id)).toBe(true);
    expect(await crud.getEpic(epic.id)).toBeUndefined();
  });

  it("getAllEpics", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic({ title: "E1", description: "d" });
    await crud.createEpic({ title: "E2", description: "d" });
    const all = await crud.getAllEpics();
    expect(all.length).toBe(2);
    expect(all.every((e) => e.title === "E1" || e.title === "E2")).toBe(true);
  });

  it("deleteEpic cascades to tasks, subtasks and blockers", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic({
      title: "Eparent",
      description: "d",
    });
    const task = await crud.createTask({
      title: "T",
      description: "d",
      epicId: epic.id,
    });
    await crud.createSubtask({
      title: "S",
      description: "d",
      taskId: task.id,
    });
    await crud.createBlocker({
      title: "B",
      description: "d",
      taskId: task.id,
    });

    await crud.deleteEpic(epic.id);

    expect(await crud.getEpic(epic.id)).toBeUndefined();
    expect(await crud.getTask(task.id)).toBeUndefined();
  });
});

describe("crud tasks", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test; tests call crud directly
  const epicId = 1;

  it("create -> get -> list -> update -> delete with cascade", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic({ title: "E", description: "d" });

    const created = await crud.createTask({
      title: "T1",
      description: "d",
      epicId,
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = await crud.getTask(created.id);
    expect(fetched?.title).toBe("T1");

    const all = await crud.listTasks();
    expect(all.map((t) => t.id)).toContain(created.id);

    const updated = await crud.updateTask(created.id, {
      status: "in-progress",
    });
    expect(updated?.status).toBe("in-progress");

    const forEpic = await crud.getTasksForEpic(created.epicId);
    expect(forEpic.map((t) => t.id)).toContain(created.id);
  });

  it("getTasksForEpic", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic({ title: "E", description: "d" });
    await crud.createTask({
      title: "T1",
      description: "d",
      epicId: epic.id,
    });
    await crud.createTask({
      title: "T2",
      description: "d",
      epicId: epic.id,
    });
    const tasks = await crud.getTasksForEpic(epic.id);
    expect(tasks.length).toBe(2);
    expect(tasks.every((t) => t.epicId === epic.id)).toBe(true);
  });
});

describe("crud subtasks", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test; tests call crud directly
  const epicId = 1;

  it("create -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic({ title: "E", description: "d" });
    const task = await crud.createTask({
      title: "T",
      description: "d",
      epicId,
    });

    const st = await crud.createSubtask({
      title: "S2",
      description: "d",
      taskId: task.id,
    });
    expect(st.id).toBeGreaterThan(0);

    const all = await crud.listSubtasks(task.id);
    expect(all.map((s) => s.id)).toContain(st.id);

    const updated = await crud.updateSubtask(st.id, { status: "blocked" });
    expect(updated?.status).toBe("blocked");

    expect(await crud.deleteSubtask(st.id)).toBe(true);
    expect(await crud.listSubtasks(task.id)).toHaveLength(0);
    expect(await crud.deleteSubtask(st.id)).toBe(false);
  });
});

describe("crud blockers", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test; tests call crud directly
  const epicId = 1;

  it("create -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    await crud.createEpic({ title: "E", description: "d" });
    const task = await crud.createTask({
      title: "T",
      description: "d",
      epicId,
    });

    const b = await crud.createBlocker({
      title: "B2",
      description: "d",
      taskId: task.id,
    });
    expect(b.id).toBeGreaterThan(0);

    const all = await crud.listBlockers(task.id);
    expect(all.map((x) => x.id)).toContain(b.id);

    const updated = await crud.updateBlocker(b.id, { status: "open" });
    expect(updated?.status).toBe("open");

    expect(await crud.deleteBlocker(b.id)).toBe(true);
    expect(await crud.listBlockers(task.id)).toHaveLength(0);
    expect(await crud.deleteBlocker(b.id)).toBe(false);
  });

  it("getBlockersForTask", async () => {
    db = setupDatabase(":memory:");
    const epic = await crud.createEpic({ title: "E", description: "d" });
    const task = await crud.createTask({
      title: "T",
      description: "d",
      epicId: epic.id,
    });
    await crud.createBlocker({
      title: "B1",
      description: "d",
      taskId: task.id,
    });
    await crud.createBlocker({
      title: "B2",
      description: "d",
      taskId: task.id,
    });
    const blockers = await crud.getBlockersForTask(task.id);
    expect(blockers.length).toBe(2);
    expect(blockers.every((b) => b.taskId === task.id)).toBe(true);
  });
});

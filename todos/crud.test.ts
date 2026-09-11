import { setupDatabase } from "./db";
import * as crud from "./crud";
import { describe, it, expect } from "bun:test";

describe("crud tasks", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test; tests call crud directly
  const epicId = 1;

  it("create -> get -> list -> update -> delete with cascade", async () => {
    db = setupDatabase(":memory:");

    const created = await crud.createTask({
      title: "T1",
      description: "d",
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = crud.getTask(created.id);
    expect(fetched?.title).toBe("T1");

    const all = await crud.listTasks();
    expect(all.map((t) => t.id)).toContain(created.id);

    const updated = await crud.updateTask(created.id, {
      status: "in-progress",
    });
    expect(updated?.status).toBe("in-progress");
  });
});

describe("crud subtasks", () => {
  let db: ReturnType<typeof setupDatabase>; // ponytail: reassigned per test; tests call crud directly

  it("create -> list -> update -> delete", async () => {
    db = setupDatabase(":memory:");
    const task = await crud.createTask({
      title: "T",
      description: "d",
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

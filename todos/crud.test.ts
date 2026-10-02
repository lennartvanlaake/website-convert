import * as crud from "./crud";
import { setupDatabase } from "./db";
import { TaskStatus } from "./constants";
import { describe, it, expect } from "bun:test";

describe("crud tasks", () => {
  it("create -> get -> list -> update -> delete with cascade", async () => {
    setupDatabase(":memory:");

    const created = await crud.createTask({
      title: "T1",
      description: "d",
    });

    const fetched = crud.getTask(created.id);
    expect(fetched?.title).toBe("T1");

    const all = await crud.listTasks();
    expect(all.map((t) => t.id)).toContain(created.id);

    const updated = await crud.updateTask(created.id, {
      status: "in-progress",
    });
    expect(updated?.status).toBe("in-progress");
  });

  it("getNextTask: ignores done tasks", async () => {
    setupDatabase(":memory:");
    const d = await crud.createTask({ title: "done", description: "d" });
    await crud.updateTask(d.id, { status: TaskStatus["done"] });
    expect(crud.getNextTask()).toBeNull();
  });
});

describe("crud subtasks", () => {
  it("create -> list -> update -> delete", async () => {
    setupDatabase(":memory:");
    const task = await crud.createTask({
      title: "T",
      description: "d",
    });

    const st = await crud.createSubtask({
      title: "S2",
      description: "d",
      taskId: task.id,
    });
    expect(st.id).toBeTruthy();

    const all = await crud.listSubtasks(task.id);
    expect(all.map((s) => s.id)).toContain(st.id);

    const updated = await crud.updateSubtask(st.id, { status: "blocked" });
    expect(updated?.status).toBe("blocked");

    expect(await crud.deleteSubtask(st.id)).toBe(true);
    expect(await crud.listSubtasks(task.id)).toHaveLength(0);
    expect(await crud.deleteSubtask(st.id)).toBe(false);
  });

  it("getNextSubtask: in-progress subtask of the task, falls back to most-recent todo, scoped to task, null when empty", async () => {
    setupDatabase(":memory:");

    // in-progress beats a newer todo subtask of the same task
    const task = await crud.createTask({ title: "T", description: "d" });
    const todo = await crud.createSubtask({
      title: "todo",
      description: "d",
      taskId: task.id,
    });
    const prog = await crud.createSubtask({
      title: "prog",
      description: "d",
      taskId: task.id,
    });
    await crud.updateSubtask(todo.id, { status: TaskStatus["in-progress"] });
    // in-progress beats a todo subtask of the same task
    expect(crud.getNextSubtask(task.id)?.id).toBe(todo.id);

    // fall back to most-recent todo (desc createdAt)
    await crud.updateSubtask(prog.id, { status: TaskStatus["todo"] });
    await crud.updateSubtask(todo.id, { status: TaskStatus["todo"] });
    expect(crud.getNextSubtask(task.id)?.id).toBe(todo.id);

    // scoped to the task: once task has no subtasks, only other's are visible
    const other = await crud.createTask({ title: "O", description: "d" });
    await crud.deleteSubtask(todo.id);
    await crud.deleteSubtask(prog.id);
    const otherSub = await crud.createSubtask({
      title: "S",
      description: "d",
      taskId: other.id,
    });
    // task has no subtasks left -> null
    expect(crud.getNextSubtask(task.id)).toBeNull();
    // but other's todo subtask is returned when asking for other
    expect(crud.getNextSubtask(other.id)?.id).toBe(otherSub.id);
  });
});

describe("crud subtask -> task cascade", () => {
  it("task status follows subtask status: all-todo -> todo", async () => {
    setupDatabase(":memory:");
    const task = await crud.createTask({ title: "T", description: "d" });
    const s1 = await crud.createSubtask({
      title: "s1",
      description: "d",
      taskId: task.id,
    });
    const s2 = await crud.createSubtask({
      title: "s2",
      description: "d",
      taskId: task.id,
    });
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["todo"]);

    await crud.updateSubtask(s1.id, { status: TaskStatus["in-progress"] });
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["in-progress"]);

    await crud.updateSubtask(s2.id, { status: TaskStatus["done"] });
    // mixed done + in-progress -> in-progress
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["in-progress"]);

    await crud.updateSubtask(s1.id, { status: TaskStatus["done"] });
    // all done -> done
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["done"]);
  });

  it("task status resets to todo when the last active subtask goes back to todo", async () => {
    setupDatabase(":memory:");
    const task = await crud.createTask({ title: "T", description: "d" });
    const s1 = await crud.createSubtask({
      title: "s1",
      description: "d",
      taskId: task.id,
    });
    await crud.updateSubtask(s1.id, { status: TaskStatus["in-progress"] });
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["in-progress"]);

    await crud.updateSubtask(s1.id, { status: TaskStatus["todo"] });
    expect(crud.getTask(task.id)?.status).toBe(TaskStatus["todo"]);
  });

  it("cascade only touches the parent task", async () => {
    setupDatabase(":memory:");
    const a = await crud.createTask({ title: "A", description: "d" });
    const b = await crud.createTask({ title: "B", description: "d" });
    const s = await crud.createSubtask({
      title: "s",
      description: "d",
      taskId: a.id,
    });
    await crud.updateSubtask(s.id, { status: TaskStatus["done"] });
    expect(crud.getTask(a.id)?.status).toBe(TaskStatus["done"]);
    expect(crud.getTask(b.id)?.status).toBe(TaskStatus["todo"]);
  });
});

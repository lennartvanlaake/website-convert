import { test, expect, beforeEach } from "bun:test";
import { updateSubtaskWorkerTool } from "./tools.ts";
import { crud } from "./crud.ts";
import { TaskStatus } from "./constants.ts";

beforeEach(async () => {
  await crud.deleteAll({ subtasks: true });
});

test("empty-string notes does not wipe existing handoff notes", async () => {
  const sub = await crud.createSubtask({
    title: "s",
    description: "",
    status: TaskStatus.todo,
    notes: "worker finished, do the wiring next",
  });

  const res = await updateSubtaskWorkerTool.execute({
    subtaskId: sub.id,
    status: TaskStatus.done,
    notes: "",
  });

  expect(res.error).toBeNull();
  const stored = await crud.getSubtask(sub.id);
  expect(stored!.notes).toBe("worker finished, do the wiring next");
});

test("non-empty notes are still persisted", async () => {
  const sub = await crud.createSubtask({
    title: "s",
    description: "",
    status: TaskStatus.in_progress,
    notes: "",
  });

  const res = await updateSubtaskWorkerTool.execute({
    subtaskId: sub.id,
    status: TaskStatus.in_progress,
    notes: "still stuck on the API",
  });

  expect(res.error).toBeNull();
  const stored = await crud.getSubtask(sub.id);
  expect(stored!.notes).toBe("still stuck on the API");
});

import { eq, and, desc, notInArray } from "drizzle-orm";
import {
  tasksTable,
  subtasksTable,
  type SubtasksRow,
  type TasksInsert,
  type SubtasksInsert,
} from "./schema";
import { db } from "./db";
import { randomUUIDv7 } from "bun";
import { TaskStatus } from "./constants";
import { logger } from "../shared/utils";

// ponytail: ids are string UUIDs (uuidv7) now, no numeric coercion. Generated
// in code because SQLite can't auto-generate stable uuids for text PKs.

//
// ---- Tasks ----
//
// Exposed via the crud registry; tests drive them with a fresh :memory: db,
// so `db` is the module-level binding (no db param passed anywhere).
export function getTask(id: string) {
  return db.select().from(tasksTable).where(eq(tasksTable.id, id)).get();
}

export async function createTask(values: Omit<TasksInsert, "id" | "status">) {
  const insert = await db
    .insert(tasksTable)
    .values({ id: randomUUIDv7(), status: TaskStatus["todo"], ...values })
    .returning();
  return insert.at(0)!;
}

export async function updateTask(id: string, input: Partial<TasksInsert>) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task with id ${id} does not exist`);
  }
  const merged = { ...task, ...input };
  return (
    await db
      .update(tasksTable)
      .set(merged)
      .where(eq(tasksTable.id, id))
      .returning()
  ).at(0)!;
}

export function listTasks() {
  return db.select().from(tasksTable);
}

export async function deleteTask(id: string) {
  const subtaskIds = (
    await db
      .select({ id: subtasksTable.id })
      .from(subtasksTable)
      .where(eq(subtasksTable.taskId, id))
  ).map((r) => r.id);
  for (const sid of subtaskIds) await deleteSubtask(sid);
  const row = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, id))
    .returning();
  return row.length > 0;
}

// ponytail: per-task subtask scan; O(task*sub) across all tasks. Fine for a
// next-up lookup; a single indexed count join if this ever scales.
function hasOpenSubtaskFor(taskId: string): boolean {
  const subs = listSubtasks(taskId);
  return subs.length > 0 && subs.some((s) => s.status !== TaskStatus["done"]);
}

export function getNextTask() {
  // In-progress is derived from subtasks: at least one non-done subtask.
  // Scan candidate tasks (non-done) and derive hasOpenSubtask in JS rather
  // than a JOIN, which drizzle-orm nests under table names and would drop the
  // flat task shape the callers expect.
  const candidates = db
    .select(tasksTable)
    .from(tasksTable)
    .where(notInArray(tasksTable.status, [TaskStatus["done"]]))
    .all();
  for (const task of candidates) {
    if (hasOpenSubtaskFor(task.id)) {
      return task;
    }
  }
  const todo = db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.status, TaskStatus["todo"]))
    .orderBy(desc(tasksTable.createdAt), desc(tasksTable.id))
    .limit(1)
    .get();

  if (todo) {
    return todo;
  }
  return null;
}

//
// ---- Subtasks ----
//

export function getSubtask(id: string) {
  return db.select().from(subtasksTable).where(eq(subtasksTable.id, id)).get()!;
}

export function getNextSubtask(taskId: string) {
  const progress = db
    .select()
    .from(subtasksTable)
    .where(
      and(
        eq(subtasksTable.status, TaskStatus["in-progress"]),
        eq(subtasksTable.taskId, taskId),
      ),
    )
    .get();
  if (progress) {
    return progress;
  }
  const todo = db
    .select()
    .from(subtasksTable)
    .where(
      and(
        eq(subtasksTable.status, TaskStatus["todo"]),
        eq(subtasksTable.taskId, taskId),
      ),
    )
    .orderBy(desc(subtasksTable.createdAt))
    .limit(1)
    .get();

  if (todo) {
    return todo;
  }
  return null;
}

export async function createSubtask(
  values: Omit<SubtasksInsert, "id" | "status">,
) {
  return (
    await db
      .insert(subtasksTable)
      .values({ id: randomUUIDv7(), status: TaskStatus["todo"], ...values })
      .returning()
  ).at(0)!;
}

export function listSubtasks(taskId: string) {
  return db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, taskId))
    .orderBy(subtasksTable.id)
    .all();
}

export async function updateSubtask(
  id: string,
  input: Partial<SubtasksInsert>,
) {
  const subtask = getSubtask(id);
  if (!subtask) {
    throw new Error(`No subtask with id ${id}`);
  }
  const merged = { ...subtask, ...input };
  return (
    await db
      .update(subtasksTable)
      .set(merged)
      .where(eq(subtasksTable.id, id))
      .returning()
  ).at(0)!;
}

export async function deleteSubtask(id: string) {
  const row = (await db
    .delete(subtasksTable)
    .where(eq(subtasksTable.id, id))
    .returning()) as SubtasksRow[];
  return row.length > 0;
}



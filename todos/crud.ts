import { eq, and, desc, inArray, count } from "drizzle-orm";
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

export function getNextTask() {
  const progress = db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.status, TaskStatus["in-progress"]))
    .get();
  if (progress) {
    return progress;
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
    .orderBy(subtasksTable.id);
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

export function todoSubtasks() {
  const countResult = db
    .select({ count: count() })
    .from(subtasksTable)
    .where(
      inArray(subtasksTable.status, [
        TaskStatus.todo,
        TaskStatus["in-progress"],
      ]),
    )
    .get();

  return countResult?.count ?? 0;
}

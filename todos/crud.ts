import { eq } from "drizzle-orm";
import {
  tasksTable,
  subtasksTable,
  type SubtasksRow,
  type TasksInsert,
  type SubtasksInsert,
} from "./schema";
import { db } from "./db";
import { randomUUIDv7 } from "bun";

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

export async function createTask(values: Omit<TasksInsert, "id">) {
  // Id is caller-provided (tests assert the exact value). The caller must pass
  // a uuidv7; db enforces uniqueness on insert.
  const insert = await db
    .insert(tasksTable)
    .values({ id: randomUUIDv7(), ...values })
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
  // ponytail: uuids aren't lexically sortable like integers; drop the order.
  return db.select().from(tasksTable);
}

export async function deleteTask(id: string): Promise<boolean> {
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

//
// ---- Subtasks ----
//

export function getSubtask(id: string) {
  return db.select().from(subtasksTable).where(eq(subtasksTable.id, id)).get()!;
}

export async function createSubtask(values: Omit<SubtasksInsert, "id">) {
  return (
    await db
      .insert(subtasksTable)
      .values({ id: randomUUIDv7(), ...values })
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

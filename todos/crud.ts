import { eq } from "drizzle-orm";
import {
  tasksTable,
  subtasksTable,
  type TasksRow,
  type SubtasksRow,
  type TasksInsert,
  type SubtasksInsert,
} from "./schema";
import { db } from "./db";

// ponytail: BunSQLite returns autoincrement rowids as TEXT under
// PRAGMA foreign_keys=ON; coerce to number so ids stay numeric end-to-end.
function asId(v: unknown): number {
  return typeof v === "string" && v.length > 0 ? Number(v) : Number(v);
}

//
// ---- Tasks ----
//
// Exposed via the crud registry; tests drive them with a fresh :memory: db,
// so `db` is the module-level binding (no db param passed anywhere).
export function getTask(id: number) {
  return db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, asId(id)))
    .get();
}

export async function createTask(values: TasksInsert) {
  return (await db.insert(tasksTable).values(values).returning()).at(0)!!;
}

export async function updateTask(id: number, input: Partial<TasksInsert>) {
  const task = getTask(id);
  if (!task) {
    throw Error(`Task with id ${id} does not exist`);
  }
  const merged = { ...task, ...input };
  return (
    await db
      .update(tasksTable)
      .set(merged)
      .where(eq(tasksTable.id, id))
      .returning()
  ).at(0)!!;
}

export function listTasks() {
  return db.select().from(tasksTable).orderBy(tasksTable.id);
}

export async function deleteTask(id: number): Promise<boolean> {
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

export function getSubtask(id: number) {
  return db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.id, asId(id)))
    .get()!!;
}

export async function createSubtask(values: SubtasksInsert) {
  // non-null assert because we just created it
  return (await db.insert(subtasksTable).values(values).returning()).at(0)!!;
}

export function listSubtasks(taskId: number) {
  return db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, taskId))
    .orderBy(subtasksTable.id);
}

export async function updateSubtask(
  id: number,
  input: Partial<SubtasksInsert>,
) {
  const subtask = getSubtask(id);
  if (!subtask) {
    throw Error(`No subtask with id ${id}`);
  }
  const merged = { ...subtask, ...input };
  return (
    await db
      .update(subtasksTable)
      .set(merged)
      .where(eq(subtasksTable.id, id))
      .returning()
  ).at(0)!!;
}

export async function deleteSubtask(id: number) {
  const row = (await db
    .delete(subtasksTable)
    .where(eq(subtasksTable.id, id))
    .returning()) as SubtasksRow[];
  return row.length > 0;
}

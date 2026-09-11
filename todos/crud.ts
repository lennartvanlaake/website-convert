import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import {
  epicsTable,
  tasksTable,
  subtasksTable,
  blockersTable,
  type EpicsRow,
  type TasksRow,
  type SubtasksRow,
  type BlockersRow,
  type TasksInsert,
  type SubtasksInsert,
  type BlockersInsert,
} from "./schema";
import { db } from "./db";
type FlatTask = TasksRow & { subtaskIds: number[]; blockerIds: number[] };

// ponytail: SQLite FK is ON but the migration has no ON DELETE CASCADE clause,
// so we delete children first, then the parent (manual cascade).
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

export function getTask(id: number): TasksRow | undefined {
  return db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, asId(id)))
    .get() as TasksRow | undefined;
}

export async function createTask(values: TasksInsert): Promise<TasksRow> {
  const row = (await db.insert(tasksTable).values(values).returning()).at(0);
  return row as TasksRow;
}

export async function updateTask(
  id: number,
  input: TasksInsert,
): Promise<TasksRow | undefined> {
  const merged = { ...((await getTask(id)) ?? {}), ...input };
  const row = (await db
    .update(tasksTable)
    .set(merged)
    .where(eq(tasksTable.id, id))
    .returning()) as TasksRow[];
  return row[0];
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
  const row = (await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, id))
    .returning()) as TasksRow[];
  return row.length > 0;
}

//
// ---- Epics ----
//

export async function createEpic(input: {
  title: string;
  description: string;
}): Promise<EpicsRow> {
  const row = (await db
    .insert(epicsTable)
    .values(input)
    .returning()) as EpicsRow[];
  return row[0];
}

export function getEpic(id: number): EpicsRow | undefined {
  return db
    .select()
    .from(epicsTable)
    .where(eq(epicsTable.id, asId(id)))
    .get() as EpicsRow | undefined;
}

export function listEpics(): EpicsRow[] {
  return db.select().from(epicsTable).orderBy(epicsTable.id) as EpicsRow[];
}

// Exposed via the crud registry (tests call getAllEpics).
export function getAllEpics(): EpicsRow[] {
  return listEpics();
}

export async function updateEpic(
  id: number,
  input: { status?: string },
): Promise<EpicsRow | undefined> {
  const merged = { ...((await getEpic(id)) ?? {}), ...input };
  const row = (await db
    .update(epicsTable)
    .set(merged)
    .where(eq(epicsTable.id, id))
    .returning()) as EpicsRow[];
  return row[0];
}

export async function deleteEpic(id: number): Promise<boolean> {
  // children first (FK enforcement), then the parent
  const rows = (await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.epicId, id))) as { id: string }[];
  for (const r of rows) await deleteTask(asId(r.id));
  const row = (await db
    .delete(epicsTable)
    .where(eq(epicsTable.id, id))
    .returning()) as EpicsRow[];
  return row.length > 0;
}

// Manual hierarchy join — returns an epic's tasks with their subtasks and
// blockers flattened in, so listEpicsWithChildren gets one row per epic.
export async function getEpicChildren(
  epicId: number,
  limit?: number,
): Promise<(EpicsRow | FlatTask)[]> {
  const rows: (EpicsRow | FlatTask)[] = [];
  const push = (r: EpicsRow | TasksRow, kind: "epic" | "task") =>
    rows.push({ ...r, kind });
  const query = db
    .select()
    .from(epicsTable)
    .where(eq(epicsTable.id, asId(epicId)));
  const limited = limit && limit > 0 ? query.limit(limit) : query;
  for (const e of await limited) {
    push(e, "epic");
  }
  const tasks = (await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.epicId, asId(epicId)))
    .orderBy(tasksTable.id)) as TasksRow[];
  for (const t of tasks) {
    const _subtasks = (await db
      .select({ id: subtasksTable.id })
      .from(subtasksTable)
      .where(eq(subtasksTable.taskId, t.id))) as { id: string }[];
    const _blockers = (await db
      .select({ id: blockersTable.id })
      .from(blockersTable)
      .where(eq(blockersTable.taskId, t.id))) as { id: string }[];
    push(
      {
        ...t,
        epicId: asId(t.epicId),
        description: t.description,
        subtaskIds: _subtasks.map((s) => Number(s.id)),
        blockerIds: _blockers.map((b) => Number(b.id)),
      },
      "task",
    );
  }
  return rows;
}

//
// ---- Subtasks ----
//

export function getSubtask(id: number): SubtasksRow | undefined {
  return db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.id, asId(id)))
    .get() as SubtasksRow | undefined;
}

export async function createSubtask(
  values: SubtasksInsert,
): Promise<SubtasksRow> {
  const row = (await db
    .insert(subtasksTable)
    .values(values)
    .returning()) as SubtasksRow[];
  return row[0];
}

export function listSubtasks(taskId: number): SubtasksRow[] {
  return db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, taskId))
    .orderBy(subtasksTable.id) as SubtasksRow[];
}

export async function updateSubtask(
  id: number,
  input: SubtasksInsert,
): Promise<SubtasksRow | undefined> {
  const merged = { ...((await getSubtask(id)) ?? {}), ...input };
  const row = (await db
    .update(subtasksTable)
    .set(merged)
    .where(eq(subtasksTable.id, id))
    .returning()) as SubtasksRow[];
  return row[0];
}

export async function deleteSubtask(id: number): Promise<boolean> {
  const task = await getSubtask(id);
  if (!task) return false;
  const row = (await db
    .delete(subtasksTable)
    .where(eq(subtasksTable.id, id))
    .returning()) as SubtasksRow[];
  return row.length > 0;
}

//
// ---- Blockers ----
//

export async function createBlocker(
  input: BlockersInsert,
): Promise<BlockersRow> {
  const row = (await db
    .insert(blockersTable)
    .values(input)
    .returning()) as BlockersRow[];
  return row[0];
}

export function getBlocker(id: number): BlockersRow | undefined {
  return db
    .select()
    .from(blockersTable)
    .where(eq(blockersTable.id, asId(id)))
    .get() as BlockersRow | undefined;
}

export function listBlockers(taskId: number): BlockersRow[] {
  return db
    .select()
    .from(blockersTable)
    .where(eq(blockersTable.taskId, taskId))
    .orderBy(blockersTable.id) as BlockersRow[];
}

export function getBlockersForTask(taskId: number): BlockersRow[] {
  return listBlockers(taskId);
}

export async function updateBlocker(
  id: number,
  input: { status?: string },
): Promise<BlockersRow | undefined> {
  const merged = { ...((await getBlocker(id)) ?? {}), ...input };
  const row = (await db
    .update(blockersTable)
    .set(merged)
    .where(eq(blockersTable.id, id))
    .returning()) as BlockersRow[];
  return row[0];
}

export async function deleteBlocker(id: number): Promise<boolean> {
  const task = await getBlocker(id);
  if (!task) return false;
  const row = (await db
    .delete(blockersTable)
    .where(eq(blockersTable.id, id))
    .returning()) as BlockersRow[];
  return row.length > 0;
}

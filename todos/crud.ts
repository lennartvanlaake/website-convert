import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import {
  epicsTable,
  tasksTable,
  subtasksTable,
  blockersTable,
  type EpicsRow,
  type TasksRow,
} from "./schema";

type FlatTask = TasksRow & { subtaskIds: number[]; blockerIds: number[] };

type Row = {
  id: number;
  status?: string | null;
  title: string;
  description: string;
  notes?: string | null;
  createdAt: number;
};

type CreateInput = Partial<Omit<Row, "id" | "createdAt">> &
  Record<string, unknown>;

// ponytail: manual cascade — SQLite FK is ON but the migration has no
// ON DELETE CASCADE clause, so we delete children first, then the parent.

// ponytail: BunSQLite returns autoincrement rowids as TEXT when
// PRAGMA foreign_keys=ON is set. Coerce to number so ids stay numeric
// end-to-end (compare/insert against FK columns).
function asId(v: unknown): number {
  return typeof v === "string" && v.length > 0 ? Number(v) : Number(v);
}

export async function createEpic(
  db: BunSQLiteDatabase,
  input: CreateInput,
): Promise<Row> {
  const row = (await db.insert(epicsTable).values(input).returning()).at(
    0,
  ) as Row;
  return row;
}

export async function getEpic(
  db: BunSQLiteDatabase,
  id: number,
): Promise<Row | undefined> {
  const row = await db
    .select()
    .from(epicsTable)
    .where(eq(epicsTable.id, asId(id)))
    .get();
  return row as Row | undefined;
}

export async function listEpics(db: BunSQLiteDatabase): Promise<Row[]> {
  return (await db.select().from(epicsTable).orderBy(epicsTable.id)) as Row[];
}

export async function getAllEpics(db: BunSQLiteDatabase): Promise<Row[]> {
  return listEpics(db);
}

export async function updateEpic(
  db: BunSQLiteDatabase,
  id: number,
  input: CreateInput,
): Promise<Row | undefined> {
  const merged = { ...((await getEpic(db, id)) ?? {}), ...input };
  const row = (await db
    .update(epicsTable)
    .set(merged)
    .where(eq(epicsTable.id, id))
    .returning()) as Row[];
  return row[0];
}

export async function deleteEpic(
  db: BunSQLiteDatabase,
  id: number,
): Promise<boolean> {
  // children first (FK enforcement), then the parent
  const rows = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.epicId, id));
  for (const r of rows) await deleteTask(db, asId(r.id));
  const row = (await db
    .delete(epicsTable)
    .where(eq(epicsTable.id, id))
    .returning()) as Row[];
  return row.length > 0;
}

export async function createTask(
  db: BunSQLiteDatabase,
  input: CreateInput & { epicId?: number },
): Promise<Row> {
  const row = (
    await db
      .insert(tasksTable)
      .values({ ...input, epicId: asId(input.epicId) })
      .returning()
  ).at(0) as Row;
  return row;
}

export async function createSubtask(
  db: BunSQLiteDatabase,
  input: CreateInput & { taskId: number },
): Promise<Row> {
  const row = (
    await db
      .insert(subtasksTable)
      .values({ ...input, taskId: asId(input.taskId) })
      .returning()
  ).at(0) as Row;
  return row;
}

export async function createBlocker(
  db: BunSQLiteDatabase,
  input: CreateInput & { taskId: number },
): Promise<Row> {
  const row = (
    await db
      .insert(blockersTable)
      .values({ ...input, taskId: asId(input.taskId) })
      .returning()
  ).at(0) as Row;
  return row;
}

export async function getTask(
  db: BunSQLiteDatabase,
  id: number,
): Promise<Row | undefined> {
  const row = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, asId(id)))
    .get();
  return row as Row | undefined;
}

export async function listTasks(db: BunSQLiteDatabase): Promise<Row[]> {
  return (await db.select().from(tasksTable).orderBy(tasksTable.id)) as Row[];
}

// ponytail: manual hierarchy join — returns an epic's tasks with their subtasks
// and blockers flattened in, so the list_epics_with_children tool gets one row
// per epic instead of N round-trips.
export async function getEpicChildren(
  db: BunSQLiteDatabase,
  epicId: number,
  limit?: number,
): Promise<(EpicsRow | FlatTask)[]> {
  const rows: (EpicsRow | FlatTask)[] = [];
  const push = (r: Row, kind: "epic" | "task") => rows.push({ ...r, kind });
  // ponytail: omit LIMIT entirely when unset — passing `Infinity` as a bound
  // param makes bun:sqlite emit `LIMIT ∞`, which SQLite rejects as a type mismatch.
  const query = db
    .select()
    .from(epicsTable)
    .where(eq(epicsTable.id, asId(epicId)));
  const limited = limit && limit > 0 ? query.limit(limit) : query;
  for (const e of await limited) {
    push(e, "epic");
  }
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.epicId, asId(epicId)))
    .orderBy(tasksTable.id);
  for (const t of tasks) {
    // only ids forwarded; detail re-fetched on demand by the list tool.
    const _subtasks = await db
      .select({ id: subtasksTable.id })
      .from(subtasksTable)
      .where(eq(subtasksTable.taskId, t.id));
    const _blockers = await db
      .select({ id: blockersTable.id })
      .from(blockersTable)
      .where(eq(blockersTable.taskId, t.id));
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

export async function getTasksForEpic(
  db: BunSQLiteDatabase,
  epicId: number,
): Promise<Row[]> {
  return (await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.epicId, epicId))
    .orderBy(tasksTable.id)) as Row[];
}

export async function updateTask(
  db: BunSQLiteDatabase,
  id: number,
  input: CreateInput,
): Promise<Row | undefined> {
  const merged = { ...((await getTask(db, id)) ?? {}), ...input };
  const row = (await db
    .update(tasksTable)
    .set(merged)
    .where(eq(tasksTable.id, id))
    .returning()) as Row[];
  return row[0];
}

export async function deleteTask(
  db: BunSQLiteDatabase,
  id: number,
): Promise<boolean> {
  const subtaskIds = (
    await db
      .select({ id: subtasksTable.id })
      .from(subtasksTable)
      .where(eq(subtasksTable.taskId, id))
  ).map((r) => r.id);
  for (const sid of subtaskIds) await deleteSubtask(db, sid);

  const blockerIds = (
    await db
      .select({ id: blockersTable.id })
      .from(blockersTable)
      .where(eq(blockersTable.taskId, id))
  ).map((r) => r.id);
  for (const bid of blockerIds) await deleteBlocker(db, bid);

  const row = (await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, id))
    .returning()) as Row[];
  return row.length > 0;
}

export async function listSubtasks(
  db: BunSQLiteDatabase,
  taskId: number,
): Promise<Row[]> {
  return (await db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, taskId))
    .orderBy(subtasksTable.id)) as Row[];
}

export async function getSubtasksForTask(
  db: BunSQLiteDatabase,
  taskId: number,
): Promise<Row[]> {
  return listSubtasks(db, taskId);
}

export async function updateSubtask(
  db: BunSQLiteDatabase,
  id: number,
  input: CreateInput,
): Promise<Row | undefined> {
  const merged = { ...((await getSubtask(db, id)) ?? {}), ...input };
  const row = (await db
    .update(subtasksTable)
    .set(merged)
    .where(eq(subtasksTable.id, id))
    .returning()) as Row[];
  return row[0];
}

export async function deleteSubtask(
  db: BunSQLiteDatabase,
  id: number,
): Promise<boolean> {
  const task = await getSubtask(db, id);
  if (!task) return false;
  const row = (await db
    .delete(subtasksTable)
    .where(eq(subtasksTable.id, id))
    .returning()) as Row[];
  return row.length > 0;
}

export async function listBlockers(
  db: BunSQLiteDatabase,
  taskId: number,
): Promise<Row[]> {
  return (await db
    .select()
    .from(blockersTable)
    .where(eq(blockersTable.taskId, taskId))
    .orderBy(blockersTable.id)) as Row[];
}

export async function getBlockersForTask(
  db: BunSQLiteDatabase,
  taskId: number,
): Promise<Row[]> {
  return listBlockers(db, taskId);
}

export async function updateBlocker(
  db: BunSQLiteDatabase,
  id: number,
  input: CreateInput,
): Promise<Row | undefined> {
  const merged = { ...((await getBlocker(db, id)) ?? {}), ...input };
  const row = (await db
    .update(blockersTable)
    .set(merged)
    .where(eq(blockersTable.id, id))
    .returning()) as Row[];
  return row[0];
}

export async function deleteBlocker(
  db: BunSQLiteDatabase,
  id: number,
): Promise<boolean> {
  const task = await getBlocker(db, id);
  if (!task) return false;
  const row = (await db
    .delete(blockersTable)
    .where(eq(blockersTable.id, id))
    .returning()) as Row[];
  return row.length > 0;
}

// --- getters used by the CRUD functions above ---

async function getSubtask(
  db: BunSQLiteDatabase,
  id: number,
): Promise<Row | undefined> {
  const row = await db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.id, asId(id)))
    .get();
  return row as Row | undefined;
}

async function getBlocker(
  db: BunSQLiteDatabase,
  id: number,
): Promise<Row | undefined> {
  const row = await db
    .select()
    .from(blockersTable)
    .where(eq(blockersTable.id, asId(id)))
    .get();
  return row as Row | undefined;
}

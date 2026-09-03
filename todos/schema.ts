import { sqliteTable, integer, text, type SQL } from "drizzle-orm/sqlite-core";
// ponytail: `sql\`(unixepoch())\`` is rejected by bun:sqlite's CREATE TABLE
// parser (it chokes on the parens in the default). CURRENT_TIMESTAMP is
// equivalent and parses cleanly. Drop the sql import.
export const ts = (): SQL<string> => "CURRENT_TIMESTAMP" as SQL<string>;

export const epicsTable = sqliteTable("epics", {
  id: integer().primaryKey(),
  status: text(),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(ts()),
});
export type EpicsRow = typeof epicsTable.$inferSelect;

export const tasksTable = sqliteTable("tasks", {
  id: integer().primaryKey(),
  status: text(),
  epicId: integer().references(() => epicsTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(ts()),
});
export type TasksRow = typeof tasksTable.$inferSelect;

export const subtasksTable = sqliteTable("subtasks", {
  id: integer("id").primaryKey(),
  status: text(),
  taskId: integer().references(() => tasksTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(ts()),
});
export type SubtasksRow = typeof subtasksTable.$inferSelect;

export const blockersTable = sqliteTable("blockers", {
  id: integer("id").primaryKey(),
  status: text(),
  taskId: integer().references(() => tasksTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(ts()),
});
export type BlockersRow = typeof blockersTable.$inferSelect;

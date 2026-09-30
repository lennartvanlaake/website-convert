import { sql } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
// ponytail: `sql\`(unixepoch())\`` is rejected by bun:sqlite's CREATE TABLE
// parser (it chokes on the parens in the default). CURRENT_TIMESTAMP is
// equivalent and parses cleanly. Drop the sql import.
export const CURRENT_TIMESTAMP = sql`CURRENT_TIMESTAMP`;

export const tasksTable = sqliteTable("tasks", {
  id: text().notNull(),
  status: text(),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(CURRENT_TIMESTAMP),
});
export type TasksRow = typeof tasksTable.$inferSelect;
export type TasksInsert = typeof tasksTable.$inferInsert;

export const subtasksTable = sqliteTable("subtasks", {
  id: text().notNull(),
  status: text(),
  taskId: text().references(() => tasksTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer().notNull().default(CURRENT_TIMESTAMP),
});
export type SubtasksRow = typeof subtasksTable.$inferSelect;
export type SubtasksInsert = typeof subtasksTable.$inferInsert;

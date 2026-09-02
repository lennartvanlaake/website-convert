import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const epicsTable = sqliteTable("epics", {
  id: integer().primaryKey(),
  status: text(),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer()
    .notNull()
    .default(sql`(unixepoch())`),
});

export const tasksTable = sqliteTable("tasks", {
  id: integer().primaryKey(),
  status: text(),
  epicId: integer().references(() => epicsTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer()
    .notNull()
    .default(sql`(unixepoch())`),
});

export const subtasksTable = sqliteTable("subtasks", {
  id: integer("id").primaryKey(),
  status: text(),
  taskId: integer().references(() => tasksTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer()
    .notNull()
    .default(sql`(unixepoch())`),
});

export const blockersTable = sqliteTable("blockers", {
  id: integer("id").primaryKey(),
  status: text(),
  taskId: integer().references(() => tasksTable.id),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer()
    .notNull()
    .default(sql`(unixepoch())`),
});

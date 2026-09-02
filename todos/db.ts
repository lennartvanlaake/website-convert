import Database from "bun:sqlite";
import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

let db: BunSQLiteDatabase;

export function setupDatabase(path: string): BunSQLiteDatabase {
  try {
    const sqlite = new Database(path);
    db = drizzle({ client: sqlite });
    return db;
  } catch (error) {
    console.error("Failed to setup database:", error);
    throw error;
  }
}

const epicsTable = sqliteTable("epics", {
  id: integer().primaryKey(),
  status: text(),
  title: text().notNull(),
  description: text().notNull(),
  notes: text(),
  createdAt: integer()
    .notNull()
    .default(sql`(unixepoch())`),
});

const tasksTable = sqliteTable("tasks", {
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

const subtasksTable = sqliteTable("subtasks", {
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

const blockersTable = sqliteTable("blockers", {
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

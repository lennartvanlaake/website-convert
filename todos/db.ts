import Database from "bun:sqlite";
import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

let db: BunSQLiteDatabase;

export function setupDatabase(path: string): BunSQLiteDatabase {
  try {
    const sqlite = new Database(path);
    db = drizzle({ client: sqlite });
    migrate(db, { migrationsFolder: "./drizzle" });
    return db;
  } catch (error) {
    console.error("Failed to setup database:", error);
    throw error;
  }
}

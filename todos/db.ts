import Database from "bun:sqlite";
import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// ponytail: the drizzle client for the shared module-level connection.
// `let` so tests can re-point it at a fresh :memory: DB via setupDatabase();
// production calls setupDatabase("./todos.db") once at startup.
export let db: ReturnType<typeof drizzle>;

export function setupDatabase(path: string) {
  try {
    const sqlite = new Database(path);
    // Enable FK enforcement so cascade works (SQLite defaults to off).
    sqlite.run("PRAGMA foreign_keys = ON");
    db = drizzle({ client: sqlite });
    migrate(db, { migrationsFolder: `${import.meta.dir}/drizzle` });
    // ponytail: `migrate` resets SQLite's FK pragma back to OFF, so
    // re-enable it right after so FK constraints actually take effect.
    sqlite.run("PRAGMA foreign_keys = ON");
    // idk, types are being weird here
    return db;
  } catch (error) {
    console.error("Failed to setup database:", error);
    throw error;
  }
}

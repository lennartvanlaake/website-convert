import Database from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// ponytail: the drizzle client for the shared module-level connection.
// `let` so tests can re-point it at a fresh :memory: DB via setupDatabase();
// production calls setupDatabase("./todos.db") once at startup.
let db: ReturnType<typeof drizzle>;

export function setupDatabase(path: string): ReturnType<typeof drizzle> {
  try {
    const sqlite = new Database(path);
    // Enable FK enforcement so cascade works (SQLite defaults to off).
    sqlite.run("PRAGMA foreign_keys = ON");
    db = drizzle({ client: sqlite });
    migrate(db, { migrationsFolder: `${import.meta.dir}/drizzle` });
    // ponytail: `migrate` resets SQLite's FK pragma back to OFF, so
    // re-enable it right after so FK constraints actually take effect.
    sqlite.run("PRAGMA foreign_keys = ON");
    return db;
  } catch (error) {
    console.error("Failed to setup database:", error);
    throw error;
  }
}

// The shared connection, so tools.ts can call crud.* without threading db.
export { db };

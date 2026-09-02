import Database from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";

// ponytail: db.ts needs toVecBuffer for search; keep the local copy here so
// db stays self-contained (no shared vector-util file for one caller).

let db: Database;
type SearchResult = {
  source: string;
  content: string;
  distance: number;
};

// Setup SQLite-Vec Database
export function setupDatabase(path: string): Database {
  try {
    db = new Database(path);
    sqliteVec.load(db);

    db.run(
      "CREATE TABLE IF NOT EXISTS docs (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, hash TEXT NOT NULL, type TEXT NOT NULL, theme TEXT NOT NULL)",
    );
    // if this database already exists, clear it for this example.
    // ponytail: bun:sqlite's db.run chokes on multi-line template literals
    // (SQLiteError: near ")"), so SQL stays single-line.
    db.run(
      "CREATE TABLE IF NOT EXISTS doc_chunks (id INTEGER PRIMARY KEY AUTOINCREMENT, docId INTEGER NOT NULL REFERENCES docs(id), content TEXT NOT NULL);",
    );
    db.run(
      // ponytail: distance_metric=cosine is required so vec_distance_cosine computes
      // real cosine distance (not the vec0 default Euclidean); the vec0 .so advertises
      // it, this table just omits it. dimension is a compile-time constant, not runtime input.
      `CREATE VIRTUAL TABLE IF NOT EXISTS vec_doc_chunks USING vec0(id INTEGER PRIMARY KEY, embedding float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine);`,
    );

    return db;
  } catch (error) {
    console.error("Failed to setup database:", error);
    throw error;
  }
}

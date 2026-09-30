# Llumox Styleguide (for AI agents adding code)

You are adding code to **llumox**, a Bun + TypeScript project: a manager/worker
agent harness (`todos/`) that shells out via CLI tools (`shared/`, `git/`) and a
semantic-search RAG layer (`rag/`). The project runs on a **local** model
(`Ornith`/`Smol` at `localhost:8080`), uses **sqlite-vec** for embeddings, and
has **50 tests / 114 `expect()` calls**, all passing. Your job is to extend it
without breaking that.

Read this before writing a line. It is precise, not aspirational.

---

## 0. Non-negotiables (do these every time)

1. **Tests.** Every new/changed production function needs coverage. Match the
   existing pattern: create a `.test.ts` next to the code, use `bun:test`
   (`import { test, expect, describe, beforeEach } from "bun:test"`), and drive
   it with a **fresh `:memory:` DB** when the code touches `db` (see
   `rag/db.ts`, `todos/db.ts`). Never leave a production function untested.
   Run `bun test` from the repo root; it must stay **50 pass / 0 fail**.
2. **`tsc` clean.** After your change, type-check the whole project:
   `npx tsc --noEmit` (or `bunx tsc`). Zero errors. No `any` unless a file
   already uses it for the same reason (e.g. `rag/embed.ts` caches a HuggingFace
   pipeline as `any`).
3. **One schema at a time.** New tables/columns: edit the Drizzle schema, run
   `bunx drizzle-kit generate --dialect sqlite --schema ./schema.ts` from
   `website-convert` (the README documents this exact command), then wire the
   CRUD query. Do not hand-write `CREATE TABLE` in production code.
4. **`ponytail:` comments.** The codebase is already in ponytail (full) mode:
   the *shortest thing that works*, with a one-line comment naming why a
   simplification exists and the upgrade path if it ever matters. Match that
   voice. See §7.

---

## 1. Language & tooling

- **Runtime is Bun.** Use `bun:sqlite` (not `sqlite3` directly) for in-process
  DBs, `bun:test` for tests, `$` from `bun` for shell escaping. ESM only
  (`"type": "module"`, `.ts` extensions on relative imports — `allowImportingTsExtensions` is on).
- **Module system.** `import z from "zod/v4"` (default import) or
  `import { z } from "zod/v4"`. Both are used in the repo; either is fine.
  Never `require`.
- **Types.** `tsconfig` is strict, `noUncheckedIndexedAccess` on,
  `noImplicitOverride` on. So: `.array()[0]` is `T | undefined` — the code
  works around this with `.at(0)!!` (non-null assert) after creating a row, and
  `asId()` for the TEXT-vs-number rowid mismatch under `PRAGMA foreign_keys=ON`.
  Replicate these exact patterns; do not "fix" them differently.
- **ID handling.** SQLite autoincrement rowids come back as **TEXT**; coerce with
  a tiny `Number(...)` helper (`asId` in `todos/crud.ts`) so ids stay numeric
  end-to-end. Do not assume `id` is already a number from the DB.

---

## 2. Tools / agents (the `ai` SDK)

This is the core product. Two conventions:

- **`ai` SDK `tool()`** for CLI/scout tools (`shared/tools.ts`): `tool({ description, inputSchema: z.object({...}), execute: async ({...}) => ... })`.
- **LangGraph/LangChain structured tools** for the git tools (`git/tools.ts`):
  `tool(async () => ..., { name, description, schema: z.object({...}) })`.
  Do not mix the two shapes for the same responsibility.

**Schema rules for `ai` tools:**

- Always declare `inputSchema` with `z.object({...})`.
- Use `.describe(...)` on **every** field — the model reads this to decide when
  to call the tool. `shared/tools.ts` demonstrates this thoroughly.
- Constrain enums: `z.enum([...])` (see `todos/tools.ts` `TASK_STATUSES`).
  Never let the model invent values.
- Set `.min(1)` on free-text fields the model fills in.

**Validation pattern:** `tools.ts` wraps every CRUD-backed tool in `try/catch`
that returns an error *string* (e.g. `Failed to create task: ${message}`) rather
than throwing. `createSubtaskTool` pre-checks the parent task exists and throws
an `Error` (caught by the wrapper). Replicate: validate before creating, and
convert thrown errors to user-facing strings.

**System prompts:** terse, first-person role framing. `todos/agents.ts` uses a
2-line manager prompt. Keep new prompts to a few sentences; the model already
reads the schema descriptions.

**Shell out safely.** Commands go through the bwrap sandbox (`sandbox/sandbox.ts`
→ `sandboxCommand(dir, cmd)`) or `bun $` (auto-escaped; do not string-concat
shell args). Never `exec` a user/model-supplied string without the sandbox or
`$`. SQL likewise uses **parameterized queries** (`?` placeholders) — never
string-interpolate values.

---

## 3. RAG layer (`rag/`)

The semantic-search stack. If you touch this, know the invariants:

- **Embedding dimension is 384.** `EMBEDDING_DIMENSIONS = 384` in
  `rag/constants.ts` — that is the onnx-community `all-MiniLM-L6-v2` feature-extraction
  output. If you change the model, update this constant and re-verify
  `embed.test.ts`. Never hardcode `384` elsewhere.
- **Embeddings are stored as binary `vec_f32`.** `insertDocVector` uses
  `vec_f32(?)`, not JSON. `vec0` auto-parses TEXT columns as JSON on read, so
  JSON.stringify crashes — do not "improve" this.
- **Flatten nesting before storage.** Embeddings arrive as `Float32Array`,
  `number[]`, or a 2D `[row]` wrapper (from `generateEmbedding`). Flatten to a
  1D dim-384 row with the recursive `flattenEmbedding` helper in `rag/db.ts`
  before inserting. `.flat()` alone is insufficient (only recurses plain
  arrays) — reuse the existing helper; do not re-implement it.
- **Denormal sanitization.** `embed.ts` clamps subnormal values (`Math.abs < 1e-30`
  → 0) before L2-normalizing; denormals dot-product to NaN. Keep this if you add
  embedding code.
- **Search is vec0 KNN + JOIN.** `dbSearch` builds a `WITH knn AS (...)` CTE with
  `embedding MATCH ?` and `vec_distance_cosine(embedding, ?)`, marked
  `// ast-grep-ignore`. SQLite/vec0 has no query builder — this SQL is not
  portable. Do not refactor it into a library call.
- **`searchRag(query, maxResults=5)`** is the public entry: `embed` then
  `dbSearch`. `searchTool` (the `ai` tool) calls it. Reuse; do not bypass.

**SQL style:** single-line SQL strings (bun:sqlite chokes on multi-line
template literals — `rag/db.ts` documents this). Keep new SQL single-line.

---

## 4. Testing conventions (match what exists)

- **Framework:** `bun:test`. `describe(...)` / `test(...)` / `it(...)` (both
  names are used; prefer `test` in new files).
- **In-memory DBs:** import `setupDatabase` and call it in `beforeEach` with
  `":memory:"` (see `rag/db.test.ts`, `todos/db.test.ts`, `todos/crud.test.ts`).
  Never open a real file in a test.
- **Fresh state:** the test owns its writes (insert, query, assert). Production
  functions use the module-level `db` and expect the test to seed it.
- **Assertions:** `expect(...).toBe(...)` / `.toEqual(...)` / `.length`. 114
  `expect()` calls today — keep that density; don't add unasserted `console.log`.
- **Integration/E2E** live under `integration/` and are excluded from `bun test`
  via `bunfig.toml` (`pathIgnorePatterns`). Put cross-module/end-to-end flows
  there, not at the root.
- **Fixtures:** test-only files/dirs go in `shared/fixtures/` or a test-local
  temp path; do not pollute the repo's real project directories.

---

## 5. Layout & file placement

- **`shared/`** — reusable, cross-cutting helpers with zero local dependencies
  (`models.ts`, `tools.ts`, `toolTester.ts`). Add shared utilities here.
- **`rag/`** — embedding, vector storage, search, RAG-backed `ai` tools.
- **`todos/`** — the manager/worker agent, task/subtask schema (Drizzle), CRUD,
  and tool registry. `agents.ts` is the agent wiring; `tools.ts` is the tool
  registry; `crud.ts` is persistence. Keep concerns in their file.
- **`sandbox/`** — the bwrap command sandbox.
- **`git/`** — git CLI tools (LangChain structured tools + `service.ts`).
- **`website-convert/`** — a Hugo site conversion exercise; **separate
  subproject** (Go template, Hugo config, `.release-it.json`). Do NOT treat it
  as part of the llumox runtime. If you must touch it, stay inside that folder.
- **Keep file sizes small.** Existing files are 3–164 lines. Split new modules
  so no file grows much past ~120 lines.

---

## 6. Code quality rules

- **Enums over string unions** for status/vocabulary fields (`todos/tools.ts`).
- **`.describe()` on every schema field** — the model relies on it.
- **Prefer `try/catch` → error string** for tool `execute` bodies (see
  `tools.ts`), except where a thrown error is caught *inside* the tool to
  pre-validate (e.g. orphaned subtask check).
- **`!` non-null asserts** are acceptable when a row was just created
  (`.at(0)!!`) — this is the established workaround for `noUncheckedIndexedAccess`.
- **No speculative abstractions.** One implementation, no factory/interface
  wrapper. If it's not needed now, don't write it.
- **Shortest diff wins.** Reuse an existing helper rather than adding a parallel
  one (e.g. reuse `flattenEmbedding`, `asId`, `sandboxCommand`).
- **`ponytail:` comments.** Explain non-obvious simplifications in ≤1 line with
  the ceiling + upgrade path, e.g.:
  `// ponytail: global lock; per-account locks if throughput ever matters`.

---

## 7. What NOT to do

- Do not switch the runtime to Node/ESM-CJS, or add `require`.
- Do not change the 384-dim embedding contract without updating the constant
  and re-testing.
- Do not hand-write `CREATE TABLE`/migrations — use Drizzle + `drizzle-kit`.
- Do not string-concat shell args or SQL values; use `$` / parameterized SQL.
- Do not add a dependency to solve what ≤5 lines of Bun/stdlib does.
- Do not leave production code without a `.test.ts`.
- Do not touch `website-convert/` as if it were the llumox runtime.
- Do not "clean up" the existing ponytail comments — they encode why the code
  looks the way it does; remove one and the reason disappears.

---

## 8. Verify before declaring done

After your change:

```bash
bun test          # must be 50 pass / 0 fail
npx tsc --noEmit  # must be 0 errors
```

If both are clean, the addition is merged-ready. If you added a schema change,
run the `drizzle-kit generate` command from §0.3 first.

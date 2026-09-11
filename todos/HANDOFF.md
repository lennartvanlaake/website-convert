# HANDOFF — todos task tests

## Goal (issue #8)

Add tests for CRUD of tasks and subtasks. Only epic and blocker tests should be
commented out (epics/blockers are covered; tasks/subtasks are the focus).

## Signature direction: crud.ts is the source of truth — tests adjust

**`crud.ts` defines the contract. The tests (`crud.test.ts`) must adjust to
match the crud signatures, NOT the other way around. Do NOT change crud
signatures to match the tests.**

- Functions read the **module-level** `db` (a `let` in `db.ts`), which tests
  re-point at `:memory:` per test via `setupDatabase()`. No `db` param is passed
  anywhere.
- Keep the **original no-`db`** signatures — `createEpic(input)`, `getTask(id)`,
  `listEpics()`, etc. If anything converted them to `db`-prefixed, strip the `db`
  param back off; the tests should be updated to match, not the functions.
- `tools.ts` tool handlers use the module-level `db` and call the crud layer's
  no-`db` functions.

## async/await: do NOT use it — sync only

No `async`/`await` in the crud layer. But sync is **not uniform** — split it:

- **Sync (no `await`):** read/query ops. `db.select()…get()`, `db.all()`,
  `db.values().returning()`. These return synchronous values.
- **NOT sync (use `await`):** write ops. `db.insert()`, `db.update()`,
  `db.delete()` return promises. `createEpic`, `createTask`, `updateTask`,
  `deleteTask`, etc. must be `async` and `await` their write calls.

So: `getEpic`/`listEpics` are sync; `createEpic`/`updateEpic`/`deleteEpic` are
`async`. If you flattened everything to sync, the writes need to be `async`
again.

## Current state of `crud.ts` — MANGLED, needs cleanup

The current `crud.ts` is a messy half-rewrite. It has two problems:

1. **Wrong signatures** — everything was converted to `db`-prefixed
   (`createEpic(db, {...})`). This is the mistake to undo. Strip the `db`
   param back off (tests adjust to the no-`db` signatures).
2. **Duplicated `getEpicChildren`** — the real definition ends, then a second
   copy of its body follows a stray `}` with no enclosing function. This dead
   code is the "used before declaration" / redeclaration noise.

**Fix:** (a) remove the `db` param from every crud function signature, and
(b) delete the duplicate second copy of `getEpicChildren`'s body so there is
exactly one definition.

## Key technical facts (verified)

- Functions read the **module-level** `db` (from `./db`), which tests re-point
  at `:memory:` per test via `setupDatabase()`. No `db` param needed.
- **Bun-SQLite is split by operation type**, not uniformly sync:
  - **sync:** `.select()…get()`, `.all()`, `.values().returning()` (query-only).
  - **promise:** `.insert()`, `.update()`, `.delete()` (writes) → `await` them.
- Wrapping a sync query in `async` and `await`-ing a sync value is harmless, but
  writes need `async`. Don't flatten writes to sync.
- BunSQLite returns autoincrement rowids as **TEXT** under
  `PRAGMA foreign_keys=ON` → `asId()` / `Number(...)` coerces string→number so
  ids stay numeric end-to-end.
- `getEpicChildren` uses manual cascade (delete children first, then parent)
  because the migration has no ON DELETE CASCADE.
- `deleteEpic` also does manual cascade (delete linked tasks' subtasks/blockers
  first, then the task, then the epic).

## Files involved

- `crud.ts` — CRUD layer. Source of truth. No `db` params (module-level `db`),
  mixed sync/async (reads sync, writes `async`). Currently mangled: `db`-prefixed
  signatures to strip + duplicated `getEpicChildren` body to remove.
- `crud.test.ts` — **must adjust to match** the crud signatures. `db`-prefixed
  calls → no-`db` calls, and `await` results.
- `tools.ts` — tool handlers. Uses the module-level `db` and calls the crud
  layer's no-`db` functions.
- `tools.test.ts` — registry test; needs `add_blocker` in the registry (was
  commented out). Add it to match `tools.ts`.
- `db.ts` — `db` is a `let`; tests re-point it at `:memory:` via `setupDatabase()`.
- `schema.ts` — table/type defs (EpicsRow, TasksRow, SubtasksRow, BlockersRow).

## Remaining work

1. `crud.ts`: strip the `db` param from every crud function signature; restore
   the mixed sync/async split (reads sync, writes `async`).
2. `crud.ts`: delete the duplicate second copy of `getEpicChildren`'s body.
3. `crud.test.ts`: adjust the tests to match the no-`db` crud signatures.
4. `tools.test.ts`: uncomment / add `add_blocker` to the tool registry.
5. Run `bun test` to verify all pass.

## Ponytail note

The `ponytail:` comments in crud.ts are legit: Bun rowid TEXT coercion, and
manual cascade (no ON DELETE CASCADE in migration). Do not delete them.

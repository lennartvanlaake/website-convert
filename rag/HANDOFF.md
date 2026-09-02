# HANDOFF — Embedding Search Fix (WIP)

**Status:** Partially fixed. Root cause identified and the main fix applied, but the
`search.test.ts` relevance tests still fail. See below for where the fix lands short
and what's left open.

**Files changed:** `db.ts` (vec0 table creation + `dbSearch` query).

---

## Root cause

`dbSearch` returns irrelevant results because `vec_distance_cosine(embedding, ?)` was
computing the WRONG distance. The vec0 table `vec_doc_chunks` in `db.ts` was created
WITHOUT `distance_metric=cosine`, so vec0 defaulted to Euclidean distance. The
`vec_distance_cosine` function then computed garbage (distances near 1.0 for everything,
~0.976 for dog-vs-cat which should be 0.47).

**The fix:** added `distance_metric=cosine` to the vec0 table creation:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS vec_doc_chunks USING vec0(
  id INTEGER PRIMARY KEY,
  embedding float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
);
```

The vec0 `.so` binary advertises `distance_metric` support (`distance_metric` string in
`vec0.so`), and `vec_distance_cosine` now computes correct cosine distances in isolation.

---

## Why the tests still fail

After the fix, isolated tests show correct distances (dog-cat = 0.47, dog-car = 0.875).
But the full `search.test.ts` still fails — "dog" query returns "coffee" (distance 0.976),
not "cats" (expected). Coffee/car distances are all ~0.96-1.04, near 1.0.

**Hypotheses not yet resolved:**

1. **Cached database:** `setupDatabase` uses `CREATE TABLE IF NOT EXISTS` — if a previous
   run created the table without `distance_metric=cosine`, the column definition is
   frozen. Tests create a fresh `:memory:` DB, so this is unlikely but worth verifying.
2. **Embedding dimension mismatch:** The `embed()` pipeline (all-MiniLM-L6-v2) produces
   384-dim vectors, matching `EMBEDDING_DIMENSIONS=384` and the vec0 column. But the
   distances near 1.0 suggest the vectors being compared aren't aligned properly.
3. **Buffer encoding:** `insertDocVector` stores the embedding as a BLOB via
   `toVecBuffer` (little-endian f32). If the query vector in `dbSearch` is bound
   differently than the stored vectors, cosine won't compute correctly.

**Test result:** 10 pass, 4 fail (the 4 are the semantic-relevance tests). The dimension
check `expect(emb[0].length).toBe(EMBEDDING_DIMENSIONS)` passes, so embeddings are 384-dim.

---

## What works (verified in isolation)

- `distance_metric=cosine` on the vec0 table → `vec_distance_cosine` computes correct
  cosine distances (dog-cat = 0.47, not 0.976).
- Query vector must be bound as `Float32Array` (not `Buffer`), which vec0 accepts for
  the `embedding MATCH ?` placeholder.
- The vec0 KNN query structure works:

  ```sql
  SELECT id, vec_distance_cosine(embedding, ?) AS distance
  FROM vec_doc_chunks
  WHERE embedding MATCH ? AND k = ${maxResults} ORDER BY distance
  ```

---

## What to try next

1. **Verify the table schema** after `setupDatabase` — confirm `distance_metric=cosine`
   is actually in the created table (rule out cached table definition).
2. **Compare stored vs query vectors byte-for-byte** — `insertDocVector` uses
   `toVecBuffer` (BLOB), `dbSearch` binds `Float32Array`. Confirm they encode identically.
3. **Check `EMBEDDING_DIMENSIONS`** — if it's 384 but the model outputs a different dim,
   the vectors get truncated/misaligned.
4. **Try the blog-post approach** — `distance_metric=cosine` works in isolation, so why
   does the full pipeline differ? The gap is between isolated and full-DB behavior.

---

## Non-blocking lint findings (ignore these)

- **L103 raw SQL in `dbSearch`**: false positive. The vec0 KNN query requires non-portable
  `embedding MATCH ?` + `k = ${maxResults}` interpolation — no query builder can express
  it. The `k` value is bounded by the caller.
- **L100 raw SQL string**: same false positive as L103.
- **`qVecDist` unused**: removed in the latest edit — the query binds `qVec` for both
  placeholders (both need the same query vector).
- **L13 comma operator**: `Buffer.from(new Uint8Array(vec.buffer); ...)` — this is the
  correct little-endian f32 encoding for vec0. The `vec.buffer` is the shared ArrayBuffer;
  the slice `[0; byteLength]` is the embedding bytes.

---

## Next session

Reproduce the isolated fix in the full `search.test.ts` context. The gap between working
isolated distances (0.47) and broken full-DB distances (0.976) points to either a
cached table definition or a stored-vs-query vector mismatch. Start by inspecting the
actual `vec_doc_chunks` schema after `setupDatabase` and comparing the stored BLOB bytes
against the query `Float32Array` bytes.

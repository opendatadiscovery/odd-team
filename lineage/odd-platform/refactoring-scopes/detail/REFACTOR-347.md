## REFACTOR-347 — `listByOddrns` SQL pagination has NO `ORDER BY` clause → unstable pagination on `/my/upstream`, `/my/downstream`, and every other caller; consecutive `page=N` requests may produce overlapping or missing entries

**Severity**: MEDIUM
**Category**: missing-order-by (pagination correctness)
**Pillars affected**: [P-01-data-discovery, P-05-data-lineage]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "**Pagination is applied to the derived set, NOT to the lineage neighbourhood — `page=2, size=5` is semantically arbitrary.** Because the lineage expansion happens entirely in memory (`.flatMap.distinct.filter.collectList()` at `DataEntityRelationsServiceImpl.java:35-38`) and the SQL pagination is applied to `listByOddrns` (after the in-memory derivation), the `page` and `size` parameters slice the *materialised* derived set — there is no stable ordering. The DB-side `LIMIT/OFFSET` on `listByOddrns` orders rows by jOOQ default ordering (no `ORDER BY` clause in `ReactiveDataEntityRepositoryImpl.java:247-250`), which Postgres documents as 'undefined'. Pagination across pages may produce duplicates and/or missing entries between consecutive requests."
- `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:performance.known_performance_gaps.[3]` (MEDIUM)

**Description**: `ReactiveDataEntityRepositoryImpl.listByOddrns(Collection<String>, boolean, boolean, Integer, Integer)` at lines 228-253 (the final SQL projection used by `/my/upstream`, `/my/downstream`, and every other caller of `listByOddrns`) builds the query as:

```java
DSL.selectFrom(DATA_ENTITY)
   .where(conditions)
   .limit(size)
   .offset((page - 1) * size)
```

(simplified from lines 247-250 — actual code uses `.limit(...)` and `.offset(...)` jOOQ DSL calls)

There is **NO `.orderBy(...)` call** anywhere in the query chain. Postgres documents that without an explicit `ORDER BY`, the row order returned by a query is **undefined** (https://www.postgresql.org/docs/current/queries-order.html — "If sorting is not chosen, the rows will be returned in an unspecified order"). In practice, Postgres returns rows in physical-storage order influenced by VACUUM, by which tuples were updated most recently, by which pages are in shared-buffer cache, and by the parallel-scan plan.

**Concrete consequence for `/my/upstream` and `/my/downstream`**:
- User opens the home page → UI fires `GET /api/dataentities/my/upstream?page=1&size=5` → Postgres returns the first 5 rows in physical-storage order.
- User refreshes → UI re-fires same request → Postgres returns the first 5 rows in physical-storage order, BUT a concurrent VACUUM or update on the data_entity table may have reordered the storage; the second response may contain different rows than the first.
- User clicks "next page" → UI fires `GET /api/dataentities/my/upstream?page=2&size=5` → Postgres returns rows 6-10 in physical-storage order, but the ordering relative to the first call is **not guaranteed**. Rows may appear in both responses (duplicate) or in neither (missing).

For the home-page `Recommended` panel use case (size=5, single page only), the consequence is mild — the user sees 5 random-ordered upstream/downstream neighbours and never paginates. For third-party API consumers paginating through every owned entity's neighbourhood, the consequence is silent data corruption — the consumer cannot reliably reconstruct the full set.

**Concrete consequence for every other `listByOddrns` consumer**: The method is reused across `getDataEntityDetails` (per batch F sidecar), lineage tab materialisation, search-results pagination, group-lineage assembly. All inherit the unstable-pagination shape.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:247-250` (the `DSL.selectFrom(DATA_ENTITY).where(conditions).limit(size).offset(page)` chain — no `.orderBy(...)` call)
- (contrast) `ReactiveDataEntityRepositoryImpl.java:515-534` (the `listByOwner` paginated overload — verify whether IT has `.orderBy(...)`; the sidecar does not name this — to be verified)

**Existing-ADR-or-implied-prescription**: none. The platform's general SQL pagination pattern across other repositories (e.g. `ReactiveAlertRepositoryImpl` — per batch H sidecar) typically includes `.orderBy(...)` clauses; `listByOddrns` is the violator.

**Proposed remedy**: Add `.orderBy(DATA_ENTITY.ID.asc())` (or `.orderBy(DATA_ENTITY.ODDRN.asc())` for predictable lexicographic order) at the `listByOddrns` query chain. The choice of order column:
- **`DATA_ENTITY.ID.asc()`** — fastest (primary-key-indexed), produces a stable but operationally-arbitrary order. Suitable for the home-page panel; consumers paginating get a deterministic sequence.
- **`DATA_ENTITY.ODDRN.asc()`** — lexicographic, requires a non-PK index lookup. More expensive but operationally meaningful (oddrn carries datasource + entity-type prefixes).
- **`DATA_ENTITY.UPDATED_AT.desc()`** — most-recently-changed-first; semantic order. Most expensive (requires UPDATED_AT index). Best for "show me what changed" UI use cases.

The minimum-viable fix is `.orderBy(DATA_ENTITY.ID.asc())` — fastest, predictable, no schema changes.

The cost is one extra column-sort at the DB layer (cheap for PK-indexed columns); the benefit is contract-correct pagination across consecutive page reads.

**Severity rationale**: MEDIUM — pagination correctness gap; affects every consumer of `listByOddrns` (the `/my*` lineage variants, lineage-tab materialisation, search-results, group-lineage). Not HIGH because the home-page use case is single-page; the gap surfaces only for consumers paginating through.

**Suggested backlog grouping**: `Pagination correctness sprint` — couple with REFACTOR-346 (in-memory derivation defeats pagination), REFACTOR-208 (no pagination on lineage), and any other `listByOddrns` consumers that need stable pagination.

---

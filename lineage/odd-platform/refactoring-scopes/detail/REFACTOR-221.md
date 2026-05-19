## REFACTOR-221 — No index on `data_entity.view_count` — every Popular page render is a sequential scan + sort

**Severity**: MEDIUM
**Category**: missing-index
**Surfaced by**:
- `getPopular.md:bugs_limitations_corner_cases[4]`
- `getPopular.md:performance.known_performance_gaps[0]`
- `getPopular.md:performance.scaling_characteristics`

**Description**: The Popular ranking `ORDER BY view_count DESC` is executed without an index on `view_count`. Verified across all 91 Liquibase migration files: only `V0_0_10__add_counters.sql` (adds the column with `DEFAULT 0`) and `V0_0_37__update_view_count.sql` (adds `NOT NULL`) touch the column — no `CREATE INDEX` statement on `view_count` anywhere. For a deployment with 10K+ data entities (a realistic scale), every Popular page-load is a sequential scan + in-memory sort. Worst-case Postgres plan: `Sort -> Seq Scan on data_entity ... Filter: (NOT hollow AND status != deleted_id)`. For N=10K entities this is ~1ms; for N=100K it's ~10-100ms depending on row width and shared_buffers. The lack of index defeats the otherwise-correct intuition that ranking by a counter should be O(K log K) where K = page size.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:633` (the orderBy)
- `V0_0_10__add_counters.sql:1-2` (column added with DEFAULT 0 — no index)
- `V0_0_37__update_view_count.sql:1-3` (NOT NULL constraint — no index)
- `grep -rln 'view_count' <odd-platform-repo>/odd-platform-api/src/main/resources/db/migration` (verified returning only the column-add and NOT-NULL migrations)

**Existing-ADR-or-implied-prescription**: none directly; ADR-CANDIDATE-066 (Popular ranking signal minimalism) implies the maintainer would want this to scale.

**Proposed remedy**: Add a Liquibase migration:
```sql
CREATE INDEX idx_data_entity_view_count_desc
ON data_entity (view_count DESC)
WHERE hollow = false AND status != <DELETED_id>;
```
This is a partial descending B-tree index on the popular-eligible rows. The query becomes `Index Scan + Limit` which is O(K) for page size K instead of O(N) for total rows N.

**Severity rationale**: MEDIUM — performance gap that becomes acute at deployment scale (100K+ entities) but is invisible on small deployments. Worth fixing proactively because the home-page render is the most-frequent query in the catalog UX.

**Suggested backlog grouping**: PERF-NNN scaling-prep sprint. Pair with REFACTOR-220 (the inflation surface that this index speeds up the attack against — but the index is fix-anyway because the attack vector exists with or without it).

---

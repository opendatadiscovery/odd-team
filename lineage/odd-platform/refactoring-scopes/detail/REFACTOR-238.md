## REFACTOR-238 — No covering index for soft-delete OR-predicate on either-endpoint in `softDeleteLineageRelations` / `restoreLineageRelations` — cascade degrades to sequential scan

**Severity**: MEDIUM
**Category**: missing-index
**Surfaced by**:
- `ReactiveLineageRepositoryImpl.md:bugs_limitations_corner_cases[5]`
- `ReactiveLineageRepositoryImpl.md:performance.known_performance_gaps[3]`

**Description**: `softDeleteLineageRelations` (`ReactiveLineageRepositoryImpl.java:92-99`) and `restoreLineageRelations` (`:102-109`) implement the soft-delete-on-either-end cascade for entity status-change. Both use the same predicate shape:

```sql
WHERE LINEAGE.CHILD_ODDRN IN (?, ?, ...) OR LINEAGE.PARENT_ODDRN IN (?, ?, ...)
```

The lineage table's PK is `(parent_oddrn, child_oddrn, establisher_oddrn)` per `V0_0_17__add_establisher_into_lineage.sql:116-117`. Postgres CAN use the PK index for the `PARENT_ODDRN IN (...)` leg of the OR (since parent_oddrn is the leading column), but the `CHILD_ODDRN IN (...)` leg has NO covering index. The only other index on the table is `lineage_establisher_oddrn` (`V0_0_17:119`) on `establisher_oddrn`, which doesn't help either leg of this OR.

For a soft-delete cascade involving many entity oddrns, Postgres's planner may:
- (a) Use the PK index for the parent_oddrn leg + sequential scan for the child_oddrn leg → BitmapOr at intersection time.
- (b) Sequential scan the whole table for both legs → slow on large lineage tables.

The choice depends on row statistics (`pg_stats.most_common_vals`, table size). For a deployment with ≥1M lineage rows, the sequential scan path becomes the chosen plan; soft-delete cascades involving 100+ entity oddrns can stall the transaction for seconds-to-minutes.

This couples with REFACTOR-238's sibling: there's also **no partial index for the `is_deleted = false` filter** (a common pattern: `CREATE INDEX ... ON lineage (parent_oddrn) WHERE is_deleted = false`). For a lineage table with a large soft-deleted tail (accumulating over months/years of soft-deletes), reads pay sequential-scan-shaped cost on every operation that filters `is_deleted = false` — which is EVERY READ on this repository.

The migration history (`V0_0_2__add_lineage.sql`, `V0_0_17__add_establisher_into_lineage.sql`, `V0_0_26__remove_length_constraints.sql`, `V0_0_79__data_deprecation.sql`) declares no index on `child_oddrn` alone and no partial index on `is_deleted`. Both gaps are addressable via separate Liquibase migrations.

**Primary source citations**:
- `ReactiveLineageRepositoryImpl.java:92-99` — `softDeleteLineageRelations` with OR-on-either-end predicate
- `ReactiveLineageRepositoryImpl.java:102-109` — `restoreLineageRelations` (mirror)
- `V0_0_2__add_lineage.sql:1-7` — original schema; PK is `(parent_oddrn, child_oddrn)`
- `V0_0_17__add_establisher_into_lineage.sql:116-117` — PK rotation to `(parent_oddrn, child_oddrn, establisher_oddrn)`
- `V0_0_17__add_establisher_into_lineage.sql:119` — `CREATE INDEX lineage_establisher_oddrn` (the only non-PK index)
- `V0_0_79__data_deprecation.sql:11-12` — `is_deleted` column added with NO covering index
- contrast: `ReactiveAlertRepositoryImpl.java:130-134` — uses FOR UPDATE on the high-concurrency ingestion read path; the comment frames the intent. The lineage cascade has no analogous high-concurrency framing but also no index hardening.

**Existing-ADR-or-implied-prescription**: implicit — the codebase's convention is to add covering indexes for hot-path read predicates (visible at `policy_name_unique`, `role_name_unique`, `lineage_establisher_oddrn` migrations). The soft-delete cascade is a hot-path WRITE; the absence of covering indexes is unexplained.

**Proposed remedy**: Two Liquibase migrations:
1. **Index on child_oddrn** for the OR-leg:
   ```sql
   CREATE INDEX IF NOT EXISTS lineage_child_oddrn ON lineage (child_oddrn);
   ```
   Mirrors the existing `lineage_establisher_oddrn` index pattern.

2. **Partial index for is_deleted filter** (optional — defer if soft-deleted tail is small):
   ```sql
   CREATE INDEX IF NOT EXISTS lineage_parent_oddrn_live
   ON lineage (parent_oddrn, child_oddrn) WHERE is_deleted = false;
   ```
   This is the canonical pattern for accelerating soft-delete-aware reads.

Add an integration test that:
1. Creates 100K lineage rows (50% soft-deleted).
2. Asserts `softDeleteLineageRelations(<100 entity oddrns>)` completes within an acceptable time budget (e.g. < 5 seconds).
3. Asserts `getChildrenCount(<oddrn list>)` for non-deleted edges completes within < 1 second.

**Severity rationale**: MEDIUM — performance gap that surfaces only on large lineage tables. Small-deployment operators (≤ 10K lineage rows) won't see it. Large-scale operators (≥ 1M rows, common in ELT-heavy data platforms) will see slow soft-delete cascades during entity-status changes (a moderately common operation). Combined with the no-`@ReactiveTransactional`-on-repository convention (ADR-CANDIDATE-067), a slow cascade holds the caller's transactional R2DBC connection for the duration; under load, the connection pool exhausts.

**Suggested backlog grouping**: `Database performance hardening sprint` — pair with REFACTOR-221 (no view_count index) and the partial-index discussion. All three are migration-shaped fixes with similar test patterns.

---

## REFACTOR-569 — Cursor pagination's `trunc(ACTIVITY.CREATED_AT, SECOND)` wraps the indexed column in a function — Postgres cannot use `activity_created_at_idx` for the truncated comparator unless a functional index exists; deep-window pagination triggers full-partition sequential scans

**Severity**: MEDIUM (performance regression on deep pagination)
**Category**: missing-index
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:performance.known_performance_gaps[2]` (CANARY HEADLINE — "**Cursor predicate function-on-column may bypass index**: `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` (line 288) wraps the indexed column in a function — Postgres can use the index only if a functional index `(date_trunc('second', created_at))` exists. The migration creates `activity_created_at_idx ON activity(created_at)` (V0_0_48__add_activity.sql:15) — plain column, not functional. Deep-window pagination triggers full-partition scans" — MEDIUM)
- `ReactiveActivityRepositoryImpl.java:285-288` (the cursor predicate using `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)`)
- `V0_0_48__add_activity.sql:15` (the index `activity_created_at_idx ON activity(created_at)` — plain-column, not functional)

**Description**: Cursor pagination at `ReactiveActivityRepositoryImpl.java:285-288`:

```java
final OffsetDateTime truncated = lastEventDateTime.truncatedTo(ChronoUnit.SECONDS);
conditions.add(
  DSL.row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID)
    .lessThan(DSL.row(truncated, lastEventId))
);
```

The cursor predicate compares (`trunc(created_at, SECOND)`, `id`) against (`truncated_cursor_time`, `cursor_id`) — row-tuple comparison.

The `trunc(...)` function is `date_trunc('second', created_at)` in SQL. Postgres can use an index on `created_at` for predicates like `created_at < X` (direct column comparison), BUT NOT for `date_trunc('second', created_at) < X` (function-on-column comparison) — UNLESS an index exists on the function expression: `CREATE INDEX activity_created_at_trunc_sec_idx ON activity ((date_trunc('second', created_at)));`.

The migration `V0_0_48__add_activity.sql:15` creates `CREATE INDEX activity_created_at_idx ON activity(created_at)` — the PLAIN-COLUMN index. This index is unusable for the truncated-column predicate. Postgres falls back to a sequential scan of the partition.

**The cost on deep pagination**:
- First page request (no cursor): the query has NO cursor predicate at all; Postgres uses `activity_created_at_idx` for the ORDER BY (line 291: `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()`) — index-supported, fast.
- Subsequent pages (with cursor): the cursor predicate adds `trunc(created_at, SECOND) < X` — Postgres cannot use the index for this; it sequentially scans the partition matching the WHERE clause.
- For a partition with millions of activity rows, the sequential scan is multi-second per page.

**Compounding with REFACTOR-085**: the activity table grows monotonically (non-empty partitions never drop). Multi-year deployments have N partitions with cumulative GB of data. The cursor predicate is a per-page sequential scan over the matched partition; deep-window pagination scales linearly with the partition size, NOT with the rows-per-page returned.

**Operator-visible consequence**: deep pagination of the Activity Feed is slow on populated deployments. Users paging through hundreds of historical activity events see multi-second latency per page (vs sub-100ms for the first page). The defect compounds with REFACTOR-067 (`size` unbounded), REFACTOR-085 (monotonic growth), and REFACTOR-564 (count(*) cost).

**The structural fix**: add a functional index on `date_trunc('second', created_at)` AND keep the plain-column index for ORDER BY.

**Cross-cutting context**: This is the **function-on-indexed-column defect class** — a standard Postgres pitfall. The fix is well-documented: functional index OR rewrite the predicate to avoid the function.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:285-288` (the cursor predicate — verified `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)`)
- `ReactiveActivityRepositoryImpl.java:290-292` (the ORDER BY — uses plain column)
- `V0_0_48__add_activity.sql:15` (the existing plain-column index)
- Postgres documentation on functional indexes

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-201 (NEW from this batch — "Cursor pagination with symmetric truncate-to-second comparator + full-precision ORDER BY") codifies the cursor design choice. The truncation is intentional (per the ADR, to accommodate client-clock-precision loss across JSON serialization). The defect: the supporting index for the truncated comparator was never added.

**Proposed remedy**: Two options:

1. **LOWEST cost — add a functional index in a new migration**:
   ```sql
   -- V0_N_NN__add_activity_created_at_trunc_sec_idx.sql
   CREATE INDEX CONCURRENTLY activity_created_at_trunc_sec_idx ON activity ((date_trunc('second', created_at)));
   ```
   Use `CONCURRENTLY` to avoid blocking writes. Cost: index storage (incremental per partition). Benefit: cursor pagination becomes O(log N) per page instead of O(N).

2. **MEDIUM cost — rewrite the cursor predicate to use plain column**:
   ```java
   // BEFORE (current):
   DSL.row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID)
     .lessThan(DSL.row(truncated, lastEventId));

   // AFTER (using direct column with adjusted cursor time):
   // The cursor passes (truncated_cursor_time, cursor_id); we want strictly-less-than rows.
   // For exact second-precision: we can use `created_at >= cursor_time AND created_at < cursor_time + 1 second`
   // ... or simpler: relax the truncation to use the plain column on both sides
   final OffsetDateTime cursorPlusOneSecond = truncated.plusSeconds(1);
   conditions.add(
     ACTIVITY.CREATED_AT.lessThan(cursorPlusOneSecond)
       .and(DSL.row(ACTIVITY.CREATED_AT, ACTIVITY.ID).lessThan(DSL.row(truncated, lastEventId)))
   );
   ```
   This is more complex; preserves the second-precision semantics while using the plain-column index. The first predicate (`created_at < cursorPlusOneSecond`) is index-supported and narrows the scan.

**Recommended**: Option 1 (functional index) — minimal change, standard Postgres pattern. The functional index supports the existing query shape directly.

**Severity rationale**: MEDIUM — performance regression on deep pagination. Severity is bounded by:
- The first page is fast (no cursor); subsequent pages are slow.
- Most users don't paginate deeply (Activity Feed is typically reviewed by recent-events).
- Compounds with REFACTOR-085 (table growth) — escalates on multi-year deployments.
- The fix is mechanical.

**Suggested backlog grouping**: `PERF-NNN activity-feed performance sprint`. Pair with REFACTOR-085 (growth), REFACTOR-067 (size unbounded), REFACTOR-564 (count(*) cost).

---

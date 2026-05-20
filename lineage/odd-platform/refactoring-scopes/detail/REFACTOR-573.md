## REFACTOR-573 — `ActivityServiceImpl.getActivityCounts` Mono.zip 4-way cross-query inconsistency under READ_COMMITTED — totalCount may NOT equal sum-of-sub-counts; UI displays "100 total = 12 my + 5 down + 8 up + ???" which can fail to balance under sustained writes

**Severity**: LOW (UI visual inconsistency only; no correctness impact on any single count)
**Category**: dual-driver-race
**Surfaced by**:
- `ActivityServiceImpl.md:stress_findings.S-C-1` (CANARY HEADLINE — Mono.zip subscribes to all four sources concurrently. Since `ActivityServiceImpl` carries no `@ReactiveTransactional`... the four queries execute against four separate JDBC connections at READ COMMITTED isolation. A row INSERTed between the four queries CAN appear in some counts but not others — the four sub-counts are NOT guaranteed to sum to or align with `totalCount`)
- `ActivityController.md:stress_findings.STRESS_C3` (CONFIRMED — "the 4 parallel queries run in parallel via Mono.zip with no shared transaction — each is a separate read snapshot")
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[8]` ("Cross-query inconsistency in `getActivityCounts`" — LOW)
- `ActivityServiceImpl.java:138-166` (the `getActivityCounts` Mono.zip)
- `ActivityServiceImpl.java:219-258` (the 4 individual count methods — each opens its own DB connection via JooqReactiveOperations)

**Description**: `ActivityServiceImpl.getActivityCounts` (`:138-166`):

```java
public Mono<ActivityCountInfo> getActivityCounts(...) {
  final Mono<Long> totalCount = getTotalCount(...);                  // line 158
  final Mono<Long> myObjectActivitiesCount = getMyObjectActivitiesCount(...);  // line 159
  final Mono<Long> downstreamActivitiesCount = getDependentActivitiesCount(..., LineageStreamKind.DOWNSTREAM);  // line 160
  final Mono<Long> upstreamActivitiesCount = getDependentActivitiesCount(..., LineageStreamKind.UPSTREAM);     // line 161

  return Mono.zip(totalCount, myObjectActivitiesCount, downstreamActivitiesCount, upstreamActivitiesCount)
    .map(TupleUtils.function((total, my, down, up) -> new ActivityCountInfo()
      .totalCount(total)
      .myObjectsCount(my)
      .downstreamCount(down)
      .upstreamCount(up)));
}
```

`Mono.zip` subscribes to all 4 sources CONCURRENTLY (default Reactor behaviour). Each `getXCount` method (lines 219-258) opens its own JOOQ R2DBC connection via `jooqReactiveOperations.mono(...)`. There is NO `@ReactiveTransactional` wrap, NO shared TX context.

Under PostgreSQL's READ_COMMITTED isolation (R2DBC default):
- Each count query takes its OWN snapshot at the moment of its SELECT execution.
- For 4 queries fired in parallel at T=0, T=0.01, T=0.02, T=0.03 (typical sub-millisecond spread), each sees a DIFFERENT snapshot of the activity table.
- An INSERT committing between T=0 and T=0.03 appears in some counts but not others.

**The visible UI inconsistency**:

```
GET /api/activity/counts → {
  totalCount: 100,         (snapshot at T=0)
  myObjectsCount: 12,      (snapshot at T=0.01 — may include a row not in totalCount's snapshot)
  downstreamCount: 5,      (snapshot at T=0.02 — different again)
  upstreamCount: 8         (snapshot at T=0.03 — different again)
}

UI displays: "All (100), My objects (12), Downstream (5), Upstream (8)"
```

If the UI tries to compute `Other = total - (my + down + up) = 100 - 25 = 75`, the result may not match what a re-fetch of `getActivity?type=ALL&size=100` would return. The visible inconsistency: under sustained write traffic, the counts CAN be off-by-one or off-by-N depending on how many INSERTs landed during the millisecond window.

**Operator-visible consequence**:
- Compliance auditor querying "how many alert-events happened today" sees the count fluctuate across refreshes — not because the underlying data changed, but because the 4-way snapshot drift.
- Most operators don't NOTICE this (the counts are close enough); the rare attentive user who does notice is misled.

**Cross-cutting context**: This is the **cross-query-snapshot-inconsistency defect class** under READ_COMMITTED. Standard fix: wrap the 4 queries in a shared TX (or a single COUNT-by-type query using a CASE expression). The cost is performance (one connection held for the duration of 4 sequential queries vs 4 parallel connections); the benefit is consistency.

**Primary source citations**:
- `ActivityServiceImpl.java:138-166` (verified Mono.zip 4-way)
- `ActivityServiceImpl.java:219-258` (the 4 individual count methods — each on separate connection)
- `JooqReactiveOperations.mono(...)` semantics (acquires fresh connection per call)
- READ_COMMITTED isolation behaviour per PostgreSQL docs

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (`@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE TX) prescribes this pattern. Read-side queries are intentionally non-transactional for performance. The defect is the cross-query inconsistency CONSEQUENCE of that stance.

**Proposed remedy**: Three options:

1. **LOWEST cost — Accept and document**: Add a doc-comment at `getActivityCounts` explaining the inconsistency:
   ```java
   /**
    * Returns 4 separate count aggregates fetched concurrently via Mono.zip.
    * Under sustained write traffic, the 4 counts may not be mutually
    * consistent — totalCount may not equal sum-of-sub-counts. This is an
    * intentional trade-off favouring concurrent fetch performance over
    * snapshot consistency.
    */
   ```
   Cheap; sets future-maintainer expectations.

2. **MEDIUM cost — Wrap in a shared transaction (`@ReactiveTransactional` or programmatic)**: The 4 queries execute sequentially on one connection, in one TX, with one snapshot. Cost: 4× the latency (sequential vs parallel) but consistent counts.

3. **HIGHER cost — Rewrite as single SQL aggregation**: A single `SELECT COUNT(*) FILTER (WHERE ...)` query with 4 different filter clauses produces all 4 counts in one DB round-trip. Postgres's `FILTER` syntax is efficient for this. Architecturally cleanest; requires JOOQ DSL fluency for the multi-filter aggregation.

**Recommended**: Option 1 (accept and document) — the inconsistency is operationally minor; the cost of mitigation (Option 2 or 3) is moderate. Document the trade-off as an explicit choice.

**Severity rationale**: LOW — UI visual inconsistency. No correctness impact on any single count value. No operator workflow broken. Severity is bounded by:
- The drift is bounded by sustained write rate × the 4-query window (typically sub-millisecond).
- The 4 counts are typically displayed side-by-side, not summed.
- The defect is invisible to most operators.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — pair with REFACTOR-249 (Mono.zipDelayError comment-absence), REFACTOR-562 (Mono.just(Flux.error) ambiguity).

---

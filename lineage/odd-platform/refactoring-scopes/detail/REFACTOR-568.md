## REFACTOR-568 — `ReactiveActivityRepositoryImpl.buildBaseQuery` has NO `DISTINCT` — multi-tag / multi-owner filter queries return N×M duplicates pre-LIMIT; UI shows `size=100` results that represent only 30-40 distinct activity events

**Severity**: MEDIUM (results-correctness UX defect)
**Category**: dual-path
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[5]` (CANARY HEADLINE — "**No DISTINCT on the SELECT — multi-tag / multi-owner filters duplicate activity rows in results**. `buildBaseQuery` (line 208-225) issues plain `DSL.select(selectFields).from(ACTIVITY).join(DATA_ENTITY)...` followed by conditional LEFT JOINs to TAG_TO_DATA_ENTITY and OWNERSHIP based on filter presence (line 237-242). A data entity with 3 tags + 2 owners produces 6 rows from the join cardinality alone; the SELECT returns all 6 (with the activity columns identical and the join columns differing). The `findActivities` flow doesn't apply DISTINCT — UI sees duplicates. The `size` parameter caps the result set but does NOT collapse duplicates first — a `size=100` request with multi-tag filter may return 100 rows representing only 30-40 distinct activity events" — MEDIUM)
- `ReactiveActivityRepositoryImpl.java:208-225` (`buildBaseQuery` — no `selectDistinct`)
- `ReactiveActivityRepositoryImpl.java:237-242` (the LEFT JOINs on TAG_TO_DATA_ENTITY + OWNERSHIP that produce multiplicity)
- `ReactiveActivityRepositoryImpl.java:290-292` (the final `where + orderBy + limit` — no DISTINCT applied at finalize)

**Description**: `ReactiveActivityRepositoryImpl.buildBaseQuery` (`:208-225`) constructs:

```java
return DSL.using(connection)
  .select(selectFields)              // ACTIVITY.* + USER_OWNER_MAPPING + OWNER + DATA_ENTITY columns
  .from(ACTIVITY)
  .join(DATA_ENTITY).on(...)         // INNER
  .leftJoin(USER_OWNER_MAPPING).on(...)
  .leftJoin(OWNER).on(...)
  // ... conditional joins follow ...
;
```

Then, conditionally based on filter presence (lines 237-242):

```java
if (CollectionUtils.isNotEmpty(tagIds)) {
  query = query.leftJoin(TAG_TO_DATA_ENTITY).on(TAG_TO_DATA_ENTITY.DATA_ENTITY_ID.eq(DATA_ENTITY.ID));
}
if (CollectionUtils.isNotEmpty(ownerIds)) {
  query = query.leftJoin(OWNERSHIP).on(OWNERSHIP.DATA_ENTITY_ID.eq(DATA_ENTITY.ID));
}
```

The LEFT JOINs add multiplicity: for a single activity row whose data entity has 3 tags AND 2 owners (and the filter matches them), the join produces `1 activity × 3 tags × 2 owners = 6 result rows`. The SELECT projection is on `ACTIVITY.*` — all 6 rows return IDENTICAL activity-column values (only the joined-tag and joined-owner columns differ).

There is NO `.selectDistinct(...)` applied. The final query at line 290-292:

```java
.where(buildConditions(...))
.orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())
.limit(size)
```

LIMIT applies AFTER the cardinality blow-up. A `size=100` request can return 100 rows representing only ~30 distinct activity events (the rest are JOIN-duplicates).

**Operator-visible consequence**:
- The UI's Activity Feed shows "100 results" but, on inspection, many appear as duplicates (same actor, same time, same diff — but DIFFERENT join-attribute hint in the UI display).
- Pagination breaks: the cursor moves by `size=100` rows but represents fewer distinct events; the operator paging deeper sees fewer NEW events per page.
- Search-by-multi-tag-filter is misleading: filtering by multiple tags returns rows that match ANY of the tags (because of the LEFT JOIN with IN predicate), and each match produces a duplicate.

**The structural fix**: add `.selectDistinct(...)` OR use a subquery pattern.

**Cross-cutting context**: This is a standard SQL anti-pattern — multi-row LEFT JOIN without DISTINCT inflates result cardinality. Fix is mechanical.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:208-225` (`buildBaseQuery` — verified no DISTINCT)
- `ReactiveActivityRepositoryImpl.java:237-242` (the multiplicity-producing LEFT JOINs)
- `ReactiveActivityRepositoryImpl.java:290-292` (final query — no DISTINCT)
- `ReactiveActivityRepositoryImpl.java:74-89` (`findAllActivities` caller — does not wrap in DISTINCT)

**Existing-ADR-or-implied-prescription**: NONE. The defect is incidental.

**Proposed remedy**:

```java
// BEFORE:
return DSL.using(connection)
  .select(selectFields)
  .from(ACTIVITY)
  ...;

// AFTER:
return DSL.using(connection)
  .selectDistinct(selectFields)
  .from(ACTIVITY)
  ...;
```

OR (more robust, avoids potential index-scan-pessimisation under DISTINCT):

```java
// Wrap in a subquery; LIMIT the outer query:
return DSL.using(connection)
  .select(selectFields)
  .from(ACTIVITY.where(ACTIVITY.ID.in(
    // subquery returning only the distinct activity-ids matching the multi-axis filter
    DSL.selectDistinct(ACTIVITY.ID).from(ACTIVITY).join(...).leftJoin(TAG_TO_DATA_ENTITY).leftJoin(OWNERSHIP).where(...)
  )))
  .join(DATA_ENTITY).on(...)
  .leftJoin(USER_OWNER_MAPPING).on(...)
  .leftJoin(OWNER).on(...)
  // (no TAG_TO_DATA_ENTITY / OWNERSHIP joins — already filtered)
  .orderBy(...)
  .limit(size);
```

The subquery pattern is more performant for typical query plans.

**Severity rationale**: MEDIUM — results-correctness UX defect. Operators see misleading row counts. Severity is bounded by:
- Visible only when the caller specifies multi-tag OR multi-owner filters (single-element filters produce no multiplicity).
- The diff content is still correct (each row contains real audit data); only the count is wrong.
- The fix is mechanical and low-risk.

**Suggested backlog grouping**: `UX-NNN activity-feed correctness sprint`. Pair with REFACTOR-567 (axis-mismatch — same broad theme of UX semantics), REFACTOR-565 (`ownerIds` silently dropped), REFACTOR-061 (typo).

---

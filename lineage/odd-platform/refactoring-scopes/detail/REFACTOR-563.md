## REFACTOR-563 — `ActivityServiceImpl.getActivityCounts` accepts NULL `begin_date`/`end_date` asymmetric with `getActivityList` — null dates propagate to a COUNT(*) over the entire retained activity history (millions of rows over multi-year deployments)

**Severity**: MEDIUM (DoS-amplification surface; performance cliff)
**Category**: dos-surface
**Surfaced by**:
- `ActivityServiceImpl.md:stress_findings.S-B-3` (CANARY HEADLINE — "`getActivityCounts` accepts null dates; `getActivityList` rejects them" — emitted P-023 to verify the actual unbounded-scan behaviour)
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[0]` ("`getActivityCounts` accepts null begin/end dates, asymmetric with `getActivityList`. A `/api/activity/counts` call without dates yields an unbounded scan over the entire retained activity table. Severity: MEDIUM. Evidence: lines 138-166 (no null-check) vs lines 98-100, 128-130 (BadUserRequestException)")
- `ActivityServiceImpl.java:138-166` (verified: no null-check on `beginDate`/`endDate` in `getActivityCounts`)
- `ActivityServiceImpl.java:98-100` (`getActivityList`'s null-check — present)
- `ActivityServiceImpl.java:128-130` (`getDataEntityActivityList`'s null-check — present)
- `ReactiveActivityRepositoryImpl.java:255-256` (the date-condition predicate in `getCommonConditions` — NPE-risk on null per the repo sidecar's S-A-2)
- `ReactiveActivityRepositoryImpl.md:stress_findings.A2` ("**No guard for `getActivityCounts` (line 138-166)** — null dates would propagate to `mapUTCDateTime(null)` at this repo line 255-256, where `DateTimeUtil.mapUTCDateTime(null)` may NPE")
- `ActivityController.java:43-56` (`getActivityCounts` controller — no validation; binds the parameters to the service)
- Probe `P-023` (`lineage/odd-platform/probes/P-023.yaml`) — pending experimental confirmation

**Description**: `ActivityServiceImpl.getActivityList` (`:85-117`) and `ActivityServiceImpl.getDataEntityActivityList` (`:119-136`) BOTH validate `beginDate` and `endDate` non-null at the service entrance and return `Flux.error(BadUserRequestException("Begin date and end date can't be null"))` (lines 98-100 and 128-130 respectively).

`ActivityServiceImpl.getActivityCounts` (`:138-166`) does NOT. The method directly proceeds to:

```java
public Mono<ActivityCountInfo> getActivityCounts(
    OffsetDateTime beginDate, OffsetDateTime endDate, List<Long> datasourceIds, ...
) {
  final Mono<Long> totalCount = getTotalCount(beginDate, endDate, datasourceIds, ...);
  final Mono<Long> myObjectActivitiesCount = getMyObjectActivitiesCount(beginDate, endDate, ...);
  final Mono<Long> downstreamActivitiesCount = ...;
  final Mono<Long> upstreamActivitiesCount = ...;

  return Mono.zip(totalCount, myObjectActivitiesCount, downstreamActivitiesCount, upstreamActivitiesCount)
    .map(tuple -> ...);
}
```

When `beginDate == null` or `endDate == null`:
- The four count queries propagate the null values to `ReactiveActivityRepositoryImpl.getTotalActivitiesCount` / `getMyObjectsActivitiesCount` / `getDependentActivitiesCount`.
- The repo's `getCommonConditions` (line 255-256) builds the date-predicate `ACTIVITY.CREATED_AT.between(...).and(ACTIVITY.CREATED_AT.lessThan(...))`. The `mapUTCDateTime(null)` call at line 255 either:
  - NPEs (per the repo sidecar's S-A-2 — `DateTimeUtil.mapUTCDateTime` may not null-check) — produces an HTTP 500 to the caller.
  - OR (if the date-predicate is null-safe via JOOQ's null-handling) — the COUNT(*) runs over the entire retained activity table.

**Either outcome is operationally hostile**:

- **NPE → HTTP 500**: an operator getting "Internal Server Error" on a missing-date call cannot debug WHY their request is broken — the actual cause is "you forgot the date parameters", not "platform is down".
- **Unbounded COUNT(*) over the activity table**: on a multi-year deployment with monotonic growth (per REFACTOR-085 — activity table grows forever, no DELETE path), the activity table is hundreds of MB to tens of GB. A `SELECT COUNT(*) FROM activity` over ALL partitions is a sequential scan of every byte. For a 10M-row activity table on a single partition, ~seconds. For a 100GB table spread across 60+ partitions, MINUTES per query.
- **And `getActivityCounts` runs FOUR such count queries in parallel via `Mono.zip`** (per REFACTOR-573 — STRESS_C3 + STRESS_E2). So the actual cost is 4× the unbounded count — potentially gigabytes of I/O per single API call.

**DoS-amplification**: a caller (even an authenticated one) submitting `curl /api/activity/counts` without dates triggers this expensive path. Combined with the read-collaborative posture (any authenticated user reaches this endpoint), the DoS surface is wide.

**Cross-cutting context**: This is the **asymmetric-validation defect class** — the same input contract differs between sibling endpoints. Standard fix: extract the validation into a shared method, apply consistently across all three (list + per-entity-list + counts).

**Primary source citations**:
- `ActivityServiceImpl.java:138-166` (verified absence of null-check on `beginDate`/`endDate` — line-by-line read)
- `ActivityServiceImpl.java:98-100` (the symmetric validation in `getActivityList`)
- `ActivityServiceImpl.java:128-130` (the symmetric validation in `getDataEntityActivityList`)
- `ReactiveActivityRepositoryImpl.java:255-256` (the date-predicate construction — NPE risk on null)
- `ActivityController.java:43-56` (the controller surface — no validation either)
- `DateTimeUtil.java:11-13` (the `mapUTCDateTime` method — needs verification on null handling)
- `components.yaml:4218-4226` (the SizeParam / DateParam OpenAPI schemas — `required: true` on the date params per the spec, but the Spring binding is `OffsetDateTime` boxed, so null is accepted by Spring)
- Probe `P-023` for experimental confirmation of unbounded-scan behaviour

**Existing-ADR-or-implied-prescription**: NO existing ADR defends the asymmetric validation. ADR-CANDIDATE-021 (Activity cursor pagination) prescribes the date-window contract for `getActivity` but does not address `getActivityCounts`. The maintainer's intent (per the explicit validation on list/per-entity-list) is "dates are required" — `getActivityCounts` is the OUTLIER.

**Proposed remedy**: Two options:

1. **LOWEST cost — add the null-check to `getActivityCounts`**:
   ```java
   public Mono<ActivityCountInfo> getActivityCounts(
       OffsetDateTime beginDate, OffsetDateTime endDate, List<Long> datasourceIds, ...
   ) {
     if (beginDate == null || endDate == null) {
       return Mono.error(new BadUserRequestException("Begin date and end date can't be null"));
     }
     // ... existing body ...
   }
   ```
   Symmetric with the other two methods. Use `Mono.error` (not `Flux.error`) since the return type is `Mono<ActivityCountInfo>` — propagates cleanly up the outer Mono and is caught by `@RestControllerAdvice` → HTTP 400.

2. **MEDIUM cost — also require a max-range cap**: Even with non-null dates, an operator could submit `begin_date=1970-01-01, end_date=2099-12-31` — a 130-year window. Add a `MAX_DATE_RANGE_DAYS = 90` (or operator-configurable) check:
   ```java
   if (beginDate == null || endDate == null) {
     return Mono.error(new BadUserRequestException("Begin date and end date can't be null"));
   }
   long rangeDays = ChronoUnit.DAYS.between(beginDate, endDate);
   if (rangeDays > MAX_DATE_RANGE_DAYS) {
     return Mono.error(new BadUserRequestException(
       "Date range exceeds maximum " + MAX_DATE_RANGE_DAYS + " days"
     ));
   }
   ```
   Applies to `getActivityCounts` AND to `getActivityList` / `getDataEntityActivityList` — comprehensive coverage.

**Recommended**: Option 1 (immediate fix for the asymmetric validation gap) + Option 2 (additional max-range cap) as a future-hardening backlog item. Pair with REFACTOR-067 (`size` parameter unbounded — same operator-perm class).

**Severity rationale**: MEDIUM — DoS-amplification surface bounded by:
- Requires an authenticated caller (under LOGIN_FORM/OAUTH2/LDAP). Under DISABLED, anonymous.
- The four-way count query produces 4× the load; expensive but bounded by the activity table's actual size.
- Most callers correctly submit dates; the defect triggers under operator-error or hostile inputs.
- The fix is mechanical (one if-statement).

The severity escalates to HIGH if the deployment is multi-year (large activity table) and runs DISABLED (anonymous traffic reaches the endpoint) — then any external caller can issue cheap unbounded-scan requests.

**Suggested backlog grouping**: `SEC-NNN activity-feed hardening sprint`. Pair with REFACTOR-067 (`getActivity size` unbounded), REFACTOR-557 (EmptyPartitions race), REFACTOR-085 (activity table growth — connected: the cost of THIS unbounded-scan is amplified by the table size REFACTOR-085 describes).

---

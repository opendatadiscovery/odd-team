# SHB-011 — Runs History endpoint 500s on in-flight runs (RUNNING wire/DB enum asymmetry) and surfaces RUNNING tasks at top of list silently

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators see a per-test "Runs History" page (`/dataentities/{id}/history` and the test-report-details first-10-runs preview) that **becomes unavailable exactly when an in-flight test most needs visibility** because the DB column `data_entity_task_run.status` accepts the seven-value `IngestionTaskRunStatus` enum (including `RUNNING`) but the API wire enum `DataEntityRunStatus` declares only six values (RUNNING is missing). The `DataEntityRunMapper` flat-maps the DB-side String into the wire-enum target via MapStruct's `Enum.valueOf()` strategy; an unknown literal throws `IllegalArgumentException` → HTTP 500. A simultaneous secondary defect: `ORDER BY end_time DESC` has no `NULLS FIRST/LAST` directive — Postgres default for DESC is NULLS FIRST, so RUNNING rows (end_time=NULL) appear AT THE TOP of the runs list with an empty Duration column and no visual signal of in-flight status. F-040 (DQ Test Run History — diagnostic-text leak) covers the cross-owner read of `status_reason`; this thread anchors the **availability defect** that F-040 doesn't capture.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/IngestionTaskRun.java:28-36` — seven-value DB enum: `SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | RUNNING | UNKNOWN`.
- `odd-platform-specification/components.yaml:1407-1415` — six-value wire enum `DataEntityRunStatus`: `SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN`. **RUNNING is absent.**
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/DataEntityRunMapper.java:13-14` — MapStruct flat-maps the String `status` field into the wire enum target. `Enum.valueOf()` (MapStruct's default) throws `IllegalArgumentException` on unknown literals → ControllerAdvice → HTTP 500.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityTaskRunRepositoryImpl.java:176-182` — `paginate(..., DATA_ENTITY_TASK_RUN.END_TIME, SortOrder.DESC, ...)` — no `NULLS FIRST/LAST` directive.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/JooqQueryHelper.java:74-89` — the paginate helper emits the raw `ORDER BY end_time DESC` clause; Postgres default for DESC is NULLS FIRST.
- `odd-platform-ui/src/components/.../TestRunsHistory/TestRunItem.tsx:25-60` — UI labels each row by `startTime` (leftmost column); Duration column is empty when `endTime` is null.
- `odd-platform-ui/src/components/.../TestRunsHistory/TestRunsHistory.tsx:24-122` — the page hosts the rendered list; infinite-scroll consumer.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityRunController.java:18-27` — sole endpoint, delegates to `DataEntityRunService.getDataEntityRuns(...)`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityRunServiceImpl.java:32-44` — entity-class gate accepts only `DATA_TRANSFORMER` (2) and `DATA_QUALITY_TEST` (4); rejects DATA_TRANSFORMER_RUN (3) and DATA_QUALITY_TEST_RUN (5) with `BadUserRequestException`.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md` (HIGH-severity bug entry; probe P-151).

## Notes

- **The availability failure is timing-dependent**: a test that finishes BEFORE the operator opens the history page renders fine. A test still RUNNING when the operator opens the page → 500 → page is empty / error toast. The operator's response is "refresh, try again" — but the refresh only succeeds once the test completes, leaving the operator without visibility during the exact window they care about most.
- **The fix shape is structural**: add `RUNNING` to the wire enum (`components.yaml:1407-1415`), regenerate the API, MapStruct picks up the new literal. The breaking-change concern is: existing clients filtering on the enum may not know about RUNNING; but they would get the same Enum.valueOf failure today, so adding RUNNING strictly improves the situation.
- **Alternative fix**: configure MapStruct with a `@ValueMapping(source = MappingConstants.ANY_REMAINING, target = "UNKNOWN")` on the mapper — defaults unknown values to UNKNOWN instead of throwing. Lower-impact but loses semantic distinction.
- **The NULLS FIRST behaviour is doubly bad**: (a) operator sees an undated-looking row at the top of the list with no Duration; (b) the UI labels it by startTime, which IS available, but provides no chip / badge / icon distinguishing in-flight from completed.
- **Tie-breaker drift**: when two completed runs share `end_time`, ordering between them is Postgres physical-storage-defined. InfiniteScroll fetches across page boundaries can duplicate or skip rows.
- **UI sort key (start_time) ≠ backend sort key (end_time)** — operator looking at the runs list sees `startTime` rendered in the leftmost column and naturally expects ordering by that column. Backend orders by `end_time`. For typical completed runs the two are correlated; for long-running tests (a slow run started yesterday vs a fast run started today) the divergence is operator-visible.
- **`size` parameter unbounded**: OpenAPI `SizeParam` (`components.yaml:4222-4229`) has no max constraint. UI ships size=100; an attacker / curious operator can request `size=1000000` and exhaust memory.
- **`status_reason` is operator-supplied diagnostic text** populated by Great Expectations / dbt — commonly contains failed-row samples that may carry PII. F-040 anchors this; SHB-011 is the AVAILABILITY and ORDERING sibling.

## Next

1. **REFACTOR-NNN — HIGH** — add `RUNNING` to the `DataEntityRunStatus` wire enum (`components.yaml:1407-1415`) OR add `@ValueMapping(source = ANY_REMAINING, target = UNKNOWN)` to `DataEntityRunMapper`. The former is semantically correct; the latter is a safer immediate band-aid.
2. **REFACTOR-NNN — MEDIUM** — add `NULLS LAST` to the ORDER BY in `ReactiveDataEntityTaskRunRepositoryImpl.java:176-182` (or a `COALESCE(end_time, start_time)` ordering key) so RUNNING rows don't surface at the top of the list unannotated.
3. **REFACTOR-NNN — MEDIUM** — UI: add a "Running" badge / icon on the TestRunItem when `endTime` is null (or `status === RUNNING` once the wire enum supports it). Currently in-flight rows look identical to completed-with-empty-duration rows.
4. **REFACTOR-NNN — LOW** — add `@Max(1000)` (or platform-wide pagination cap) to `SizeParam` in `components.yaml` to prevent unbounded-page DoS.
5. **TEST-NNN — HIGH** — controller-level `WebTestClient` test confirming 200 OK when result set contains a RUNNING row (currently 500 — probe P-151 codifies this).
6. **DOC-NNN** — `/features/data-quality` and adjacent pages do not document the runs-history endpoint's enum, ordering, or RUNNING semantics. Operator opening the page on a DQ-test details surface has no source for what they're looking at.
7. **Cluster** with F-040 — both describe drift on the same surface (the runs-history endpoint). F-040 is the security/diagnostic-text leak facet; SHB-011 is the availability/ordering facet.

## Links

- cluster_with: [F-040]
- merged_into: (open)
- supersedes: []

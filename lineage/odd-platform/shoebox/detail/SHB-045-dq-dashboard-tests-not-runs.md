# SHB-045 — Quality Dashboard `test_results` counts TESTS by their latest-run status, NOT RUNS as the label and live docs promise

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators reading the `/data-quality` Quality Dashboard see a "Test Results Breakdown" ring with the legend "count of test runs broken down by status" (per the verbatim live docs page `data-quality/dashboard`, the UI label "Test Results Breakdown" at `DataQualityContent.tsx:110`, the OpenAPI operation summary "Get Data Quality tests runs" at `openapi.yaml:1975-1976`, and the URL segment `/api/dataqatests/runs`). Three independent surfaces converge on the operator-mental-model "this is a histogram of how many test EXECUTIONS landed in each status bucket." The implementation joins `DATA_ENTITY_TASK_LAST_RUN` whose `task_oddrn` is `PRIMARY KEY` — exactly one row per test (`V0_0_45__last_runs_table.sql:9`). A test that ran 100 times (99 SUCCESS, 1 latest FAILED) contributes 1 to FAILED, NOT 99 to SUCCESS + 1 to FAILED. The dashboard cannot distinguish "one transient failure on a stable test" from "a test that fails every run." This is the LSN-019 class drift (label-vs-behaviour) instantiated on the catalog-wide aggregate surface. Operator-visible: an operator triaging "why is our failed-test count up?" assumes proportional growth in failures; the truth is that one test reclassified from SUCCESS to FAILED on its latest run shifts the count without any change in failure volume.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:76,95,100` — the JOIN + GROUP BY + COUNT against `DATA_ENTITY_TASK_LAST_RUN`. One row per test.
- `odd-platform-api/src/main/resources/db/migration/V0_0_45__last_runs_table.sql:7-13` — table creation: `task_oddrn` declared `PRIMARY KEY`, guaranteeing single-row-per-task semantics. The denormalisation IS the dashboard's semantic.
- `odd-platform-specification/openapi.yaml:1975-1976` — operation summary "Get Data Quality tests runs" + URL path `/api/dataqatests/runs`. The endpoint NAME promises runs.
- `odd-platform-ui/src/components/DataQuality/DataQualityContent.tsx:110` — UI ring label "Test Results Breakdown."
- `documentation/docs/data-quality/dashboard.md` (WebFetched 2026-05-25 status 200, per DataQualityRunsController sidecar `inferred_docs[0]` fetched_excerpts): verbatim definition "Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)." The docs reinforce the runs reading.
- `odd-platform-api/src/main/resources/db/migration/V0_0_45__last_runs_table.sql:15-21` — the back-fill SQL: `DISTINCT ON (tr.task_oddrn) ... ORDER BY tr.task_oddrn, tr.end_time DESC` — explicitly preserves only the most recent run per task. The ingestion path upserts subsequent runs into this same row.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/DataQualityCategoryMapperImpl.java:45-60` — pads every (category, status) cell with `count=0` if absent, so the response envelope is always 6 × 6 = 36 cells. The padding hides "we have no test runs" from "we have 0 tests with latest=X" — both render identically.

## Notes

- This is the most operator-impactful drift in the Quality Dashboard surface. Three independent layers (URL path, operation summary, UI label, docs) all promise per-RUN semantics; the SQL delivers per-TEST-by-latest-status. The drift is not malicious — it reflects a deliberate denormalisation for query speed (`DATA_ENTITY_TASK_LAST_RUN` exists precisely so the dashboard does not need to compute `DISTINCT ON` at query time; without it, the dashboard would be O(N×M) on every render). The denormalisation IS the decision; the LABEL is the bug.
- Two correctness paths exist: (a) RENAME the surface to honour the truth — "Tests Breakdown by Latest Run Status" everywhere (URL path, OperationId, UI label, docs); (b) ADD a second endpoint that DOES count runs (probably a sample window — last N days) and surface BOTH metrics on the dashboard (one ring "Tests by Latest Status", another "Run Volume by Status, last 30d"). Path (a) is mechanical; path (b) is the right product call but requires backend work.
- This is `clustering` because it enriches F-032 (Quality Dashboard) explicitly — F-032 is the catalog-wide quality view but does not capture the per-TEST-vs-per-RUN drift. The feature-flow-builder should fold this into F-032 as a drift facet, NOT mint a new feature.
- Caveat: the user-visible consequence is not "dashboard wrong" but "dashboard meaning differs from dashboard label." A maintainer reading the OpenAPI spec to build a custom BI panel will WRITE the wrong query (will assume `SUM(count)` across statuses equals total runs; it equals total tests). The first PR consumer hits this.
- A second-order consequence: a test that flaps (alternating SUCCESS/FAILED across runs) shows up in WHICHEVER bucket its latest run hit. A team observing the dashboard daily sees the same test "jump" between buckets each refresh — but because the dashboard caption says "runs" they cannot explain to non-engineering stakeholders why the count fluctuates without test addition / removal.
- Related drift (same file): `titleIds` binds to OWNERSHIP.TITLE_ID (LSN-020); `namespaceIds` widens to datasource-namespace; both are already captured in F-032's drift facets and in the companion DataQualityFilters sidecar — NOT this thread's responsibility.

## Next

1. **Promote into F-032 as drift facet**: feature-flow-builder appends a `drift_class: label_promises_runs_implements_tests_by_latest_status` block citing this thread's evidence. Mark as HIGH severity per the LSN-019 family classification.
2. **Probe + DOC-GAP**: write probe P-NNN — execute the dashboard endpoint against a seeded test that has 5 historical runs (4 SUCCESS, 1 latest FAILED); assert the response shows count=1 in FAILED bucket; document the result on `data-quality/dashboard.md` as a caveat.
3. **Promote rename OR augmentation backlog item**: REFACTOR-NNN — "Quality Dashboard surface naming: pick (a) rename URL+OpId+UI+docs to honour per-test semantics, or (b) add second per-run-volume metric." Tag P-04 + the test-class label.
4. **Test gap**: there is no test pinning the per-test-by-latest-status invariant (`ReactiveDataQualityRunsRepositoryTest.java` covers two of three sub-queries; none asserts "100-run test contributes 1 row"). Add it as TEST-GAP-NNN.

## Links

- cluster_with: [F-032, F-022, F-040]
- merged_into: F-032
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged into F-032 (P-04:F-002 Quality Dashboard) — thread is an enricher capturing the LSN-019 class drift (label-vs-behaviour) on the catalog-wide aggregate surface. Three independent surfaces (URL path /api/dataqatests/runs, operation summary "Get Data Quality tests runs", UI label "Test Results Breakdown", live docs) all promise per-RUN semantics; SQL delivers per-TEST-by-latest-status via DATA_ENTITY_TASK_LAST_RUN's PRIMARY KEY on task_oddrn. drift_class: label_promises_runs_implements_tests_by_latest_status (new facet, HIGH severity per LSN-019 family). NOT minting a new feature because F-032 is the catalog-wide quality view's anchor; this is a label-vs-implementation drift on the SAME surface, not a new user-observable feature. Maintainer ADR-shape decision: (a) rename URL+OpId+UI+docs to honour per-test semantics OR (b) add second per-run-volume metric. Both paths preserve the dashboard's identity as F-032.

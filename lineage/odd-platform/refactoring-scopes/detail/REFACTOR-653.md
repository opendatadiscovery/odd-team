## REFACTOR-653 — Data Quality Dashboard's "Test Results Breakdown" ring counts TESTS keyed on latest-run-status, NOT test runs — contrary to the live doc's verbatim "count of test runs broken down by status" wording (LSN-019 class instance at the DQ-dashboard surface)

**Severity**: HIGH
**Category**: count-tests-vs-runs (LSN-019)
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality, P-11 Platform API (doc-vs-code semantic divergence)]

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**`test_results` counts TESTS keyed on latest-run-status, not RUNS — diverges from the user-facing label and from the live documentation.** Trace: the OpenAPI operation summary says 'Get Data Quality tests runs' (`openapi.yaml:1975-1976`), the UI title chart label says 'Test Results Breakdown' (`DataQualityContent.tsx:110`), and the live doc says 'count of test runs broken down by status'. The SQL joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`); `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`), guaranteeing one row per test. Concrete consequence: a test with 100 historical runs (99 SUCCESS, 1 latest FAILED) contributes 1 to FAILED bucket; the dashboard cannot distinguish 'one transient failure on a healthy test' from 'a test that fails every time it runs'."

**Statement**: The Data Quality Dashboard's "Test Results Breakdown" ring shows counts per (category, status). The OpenAPI operation summary says "Get Data Quality tests runs"; the UI title says "Test Results Breakdown"; the live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` page says verbatim:

> "Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)."

A reader of any of these surfaces infers the count is over RUN INSTANCES. The implementation counts SOMETHING ELSE: the SQL joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`), a denormalised table with `task_oddrn` as `PRIMARY KEY` (per ADR-CANDIDATE-220 NEW) — exactly ONE row per test. The count is therefore "number of TESTS whose latest run has status X", NOT "number of test runs with status X".

The operator-visible consequence (sample case):
- Test A: 100 historical runs, 99 SUCCESS, 1 most-recent FAILED → contributes 1 to FAILED, 0 to SUCCESS
- Test B: 100 historical runs, 99 FAILED, 1 most-recent SUCCESS → contributes 1 to SUCCESS, 0 to FAILED
- Test C: 1 run ever, SUCCESS → contributes 1 to SUCCESS

The dashboard cannot distinguish "flapping test that just recovered" (Test B) from "stable test" (Test C). An operator triaging the dashboard sees a count and assumes it reflects run volume; the count actually reflects test count weighted to the latest-run state.

This is the **LSN-019 class** (name-vs-behaviour drift at a count-shaped metric) instantiated on the DQ dashboard surface — the SAME shape as REFACTOR-546 (`listMostPopular` not popularity-ordered) and REFACTOR-490 (Popular Tags ordering drift). The doc says "runs"; the code computes "tests by latest". The shapes are operator-misleading.

**Evidence**:
- OpenAPI summary: `openapi.yaml:1975-1976` ("Get Data Quality tests runs")
- UI label: `DataQualityContent.tsx:110` ("Test Results Breakdown")
- Live doc page: WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status 200 — "count of test runs broken down by status (passed / failed / skipped)"
- SQL join: `ReactiveDataQualityRunsRepositoryImpl.java:76, 95` (joins `DATA_ENTITY_TASK_LAST_RUN`)
- Schema PK: `V0_0_45__last_runs_table.sql:9` (`task_oddrn varchar(2048) PRIMARY KEY` — guarantees one row per test)
- Hypothesis: `lineage/odd-platform/probes/P-156.yaml`

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-220 NEW** governs the denormalisation choice (one row per test in DATA_ENTITY_TASK_LAST_RUN — deliberate for throughput). The ADR captures the architectural intent; this REFACTOR captures the doc-vs-code semantic divergence the intent CREATES at the wire surface.

**Proposed remedy**:
- **Option A (doc-side fix — smallest change)**: Update the live `/features/data-quality/dashboard` page to read "count of TESTS broken down by their latest run's status (passed / failed / skipped)". The dashboard semantic is preserved; the doc-side language aligns with the code.
- **Option B (wire-side rename)**: Rename the OpenAPI operation summary + response field name to make the semantic explicit (e.g., `latest_test_results` instead of `test_results`). Breaks SDK-consumer contracts but communicates intent at the API surface.
- **Option C (semantic change — REPLACE the count)**: change the SQL to count run instances (join DATA_ENTITY_TASK_RUN instead of DATA_ENTITY_TASK_LAST_RUN). Reverses ADR-CANDIDATE-220 NEW (the denormalisation choice); changes the dashboard semantic; may require pagination if the catalog is large.

Option A is the operator-friendly fix without breaking architectural commitments. The LSN-019 family typically chooses Option A (doc-side fix); the maintainer's preference at the platform's other LSN-019 instances (REFACTOR-546, -490) is the case-law.

**Severity rationale**: HIGH — doc-vs-code divergence at a load-bearing operator-facing metric; the dashboard is the catalog-wide quality posture surface; mis-interpretation by operators leads to incorrect triage decisions ("look at the FAILED count to find broken tests" misses tests that flap or just-recovered).

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (paired with REFACTOR-600 — multi-axis dashboard doc incompleteness) + `LSN-019 family` (paired with REFACTOR-546, REFACTOR-490).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-546 + REFACTOR-490 (the LSN-019 family); ADR-CANDIDATE-220 NEW (the architectural intent behind the count semantic) — this REFACTOR is the wire-surface consequence of that intent.
- SUPERSEDES: none.
- CONFLICTS: ADR-CANDIDATE-220 NEW captures the WHY (denormalisation chosen for throughput); THIS REFACTOR captures the WHAT (operator-visible semantic divergence). No direct conflict; the two artefacts are complementary.

---

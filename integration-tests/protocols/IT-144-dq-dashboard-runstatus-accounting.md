---
id: IT-144
title: "The Data Quality dashboard counts in-flight RUNNING runs and rates Table Health by a priority cascade (incl. Unknown)"
gates:
  validates: [F-032]
  enforces: []
  regresses: [1794]
test_class: integration
stack: odd-minimal
automation: "e2e:specs/dq-dashboard-runstatus-accounting.spec.ts"
plan_ref: "contributor/CTRIB-037.md"
status: ready
---

# IT-144 — DQ dashboard run-status accounting (F-032 / #1794)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The catalog-wide Data Quality dashboard (`/data-quality`, `GET /api/dataqatests/runs`) must account for
**every** run status, including in-flight `RUNNING`:

- **Defect 1 — in-flight runs.** An in-flight test run (no `end_time`) must (a) **ingest** at all, and
  (b) become the test's *latest* run so it is counted in the **Test Results Breakdown** as `Running` (and
  reflected in Table Health), instead of being silently dropped.
- **Defect 2 — Table Health.** Each table is rated by the **highest-severity** latest-run status on any of
  its tests: **Error** = at least one `Failed`; **Warning** = at least one `Broken` (no `Failed`);
  **Unknown** = at least one `Unknown` (no `Failed`/`Broken`) — a **new** bucket; **Healthy** = none of those
  (only `Success`/`Skipped`/`Aborted`/`Running`).

**Operator-facing consequence if it FAILS:** a compliance dashboard that hides running tests (the `Running`
slice reads 0 even while tests run) and mis-rates table health — a `Broken`/`Skipped`/`Running` test pushes a
table into the wrong bucket. Source: F-032 · #1794 · `ReactiveDataQualityRunsRepositoryImpl.getLatestTablesHealth`
· `ReactiveDataEntityTaskRunRepositoryImpl.insertLastRuns` · `DataEntityTaskRunMapperImpl.mapTaskRun`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres; UI + API on `http://localhost:18080`). Brought up by the
  harness; manually: `docker compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default — anonymous ingestion).
- **Browser toolchain**: `cd integration-tests/e2e && npm install && npm run browser` (one-time).
- **Seed** (the spec does this through the REAL ingestion API): a datasource `//it144`, then
  `POST /ingestion/entities` of a table + DQ test (JOB with `data_quality_test.expectation.category`) + a
  `JOB_RUN` carrying `data_quality_test_run.{start_time, status[, end_time]}`. An **in-flight** run omits
  `end_time`. Assertions are read from the dashboard filtered to the `//it144` datasource (the suite shares
  one DB), so they are exact regardless of other specs' data.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Ingestion accepts an in-flight run: `POST /ingestion/entities` with a `data_quality_test_run` that has a
  `start_time` and **no** `end_time` → **200** (on pre-#1794 main this is a **500** — the bug).

## 4. Run protocol — what to run
- **Automated**: `integration-tests/run-suite.sh feature-complete` (or `cd integration-tests/e2e &&
  npx playwright test dq-dashboard-runstatus-accounting`).
- **Manual / full-chain**: ingest (per §2) a test with a `SUCCESS` run then an in-flight `RUNNING` run, and
  tables whose tests' latest runs are `FAILED` / `BROKEN` / `UNKNOWN` / `SUCCESS` / in-flight `RUNNING`; open
  `http://localhost:18080/data-quality` and read the two donuts.

## 5. What it checks — assertions (filtered to the `//it144` datasource)
- **PASS** when, on the fix:
  - the in-flight run ingests with **200**;
  - the **Test Results Breakdown** (Assertion Tests) shows `RUNNING = 1` (the in-flight test) and
    `SUCCESS = 1` (the completed test);
  - **Table Health** = `error_tables=1` (FAILED), `warning_tables=1` (BROKEN), `unknown_tables=1` (UNKNOWN),
    `healthy_tables=3` (SUCCESS, in-flight RUNNING, and the success+running table);
  - the `/data-quality` page renders "Table Health" + "Test Results Breakdown" (the FE handles the new
    `unknown_tables` field).
- **FAIL (expected on pre-#1794 main / `ODD_SUT=ref:main`)**: the in-flight ingestion returns **500**
  (NPE in the task-run mapper), so the spec fails before the dashboard assertions.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: F-032 (Quality Dashboard) · #1794 · the GATE-1-approved plan in `contributor/CTRIB-037.md`.
- Sibling: **IT-004** (F-032 — the palette blank-out on a *never-before-seen* status; a different known bug,
  response-injection) · **IT-058** (F-022 — the per-dataset DQ ingestion template this spec's seed mirrors).
- Predecessor: #1793 (CTRIB-024) surfaced in-flight RUNNING in the per-test run *list*; #1794 completes it for
  the dashboard aggregates.
- Automation: `integration-tests/e2e/specs/dq-dashboard-runstatus-accounting.spec.ts`.

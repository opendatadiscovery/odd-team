# fix(data-quality): account for in-flight RUNNING runs + Table Health priority cascade

Closes #1794
Milestone: 0.29.0
Docs: documentation@release/0.29.0 (data-quality/dashboard.md) — publishes with the 0.29.0 release.

## Problem (reproduced on a local stack)

The catalog-wide Data Quality dashboard (`GET /api/dataqatests/runs`) mishandled run statuses. Two defects,
plus a deeper layer the write-up missed:

- **Defect 1 — in-flight RUNNING runs are invisible.**
  - **1a (found by reproducing):** ingesting a run with **no `end_time`** (in-flight) returns **HTTP 500** —
    `DataEntityTaskRunMapperImpl.mapTaskRun` called `getEndTime()/getStartTime().toLocalDateTime()`
    unconditionally (both are optional on the wire: `DataEntityRun.required = [status]`). So the run never
    reached the rollup.
  - **1b:** `insertLastRuns` filtered `end_time != null`, dropping in-flight runs from
    `data_entity_task_last_run` (its only writer) — the **Running** total read **0** even while tests ran.
- **Defect 2 — Table Health methodology + a missing Unknown state.** A `Broken` test read **Error**, a
  `Skipped`/`Aborted`/`Running` test read **Warning** (false alarm), and an `Unknown` test had no bucket.

## Change

- **1a:** null-guard `start_time`/`end_time` in the task-run ingestion mapper.
- **1b:** `insertLastRuns` keeps the latest run per task by `COALESCE(end_time, start_time)` — an in-flight
  run becomes the current last run (`RUNNING`), replaced by its terminal status on completion. Adds an
  **additive nullable `start_time`** column (`V0_0_93`) so the rollup can order in-flight runs (conforms to
  #1793's "an in-flight run is the freshest" ordering).
- **Defect 2:** `getLatestTablesHealth` now rates each table by a **priority cascade** — **Error** = any
  `Failed`; **Warning** = any `Broken` (no `Failed`); **Unknown** = any `Unknown` (no `Failed`/`Broken`);
  **Healthy** = none of those (`Success`/`Skipped`/`Aborted`/`Running`). Adds the **Unknown** table-health
  state: an additive `unknown_tables` field + a 4th dashboard ring slice + `Unknown` in all 7 locales.
- The per-dataset `test_report` `total` now excludes `RUNNING` (no `running_total` slot; a running test is not
  a completed result), keeping `total` == the breakdown.

## Scope (deliberately excluded)

- The dashboard **blank-out on a never-before-seen run status** (a UI palette lookup) — a separate, unrelated
  bug; `RUNNING` is already a known palette key, so this change does not touch it.
- No breaking API change — the `unknown_tables` field is additive; the run-status enum is unchanged.

## Tests / running-system evidence

- **Unit (odd-platform CI):** `DataEntityTaskRunMapperImplTest` (null-timestamp mapping; NPEs on pre-fix main)
  + `ReactiveDataQualityTableHealthTest` (the full cascade incl. Unknown + `insertLastRuns` records an in-flight
  run). Full `:odd-platform-api:build` green.
- **Integration (browser e2e):** real ingestion → the dashboard API + a UI render, asserting the in-flight run
  ingests, `Running` is counted, and the Table-Health cascade incl. `Unknown`. **RED on pre-#1794 `main`** (the
  in-flight ingestion 500s); green on the fix. Full regression (feature-complete + multi-stack + known-bugs +
  ingestion-e2e) green on the branch SUT.

## Docs

`data-quality/dashboard.md` updated on the `release/0.29.0` train (the four-slice cascade + in-flight `Running`
counted); publishes with the 0.29.0 release. (The dashboard screenshot is regenerated at release.)

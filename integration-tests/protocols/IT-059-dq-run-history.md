---
id: IT-059
title: "Per-DQ-test run history paginates + orders (in-flight at top); a RUNNING row loads + renders (#1757)"
gates:
  validates: [F-040]
  enforces: []
  regresses: [PLT-021]
test_class: integration
stack: odd-minimal
automation: "e2e:dq-run-history.spec.ts"
plan_ref: I10
status: ready
---

# IT-059 — DQ test run history (paginated /runs)

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs
> the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
F-040 (DQ Test Run History). Grounded against the running platform via
`GET /api/dataentities/{data_entity_id}/runs`:

- **SUCCESS (F-040-UC-1, confirmed promise):** a DQ test with several ingested runs
  returns a most-recent-first (by `end_time DESC`), correctly **paginated** timeline
  (`{items:[{start_time,end_time,status,status_reason,…}], page_info:{total,hasNext}}`).
  With 5 runs at size 2: page 1 → 2 newest + `hasNext=true total=5`; page 3 → 1 oldest +
  `hasNext=false`; the union across pages is all 5 runs, each once, ordered.

- **CORNER 1 (F-040-UC-2, RE-GROUNDED 2026-06-19 — #1757 / PLT-021; was a 500 RED-pin, LSN-029 flip):**
  a run whose status is `RUNNING` now **LOADS** — the endpoint returns **HTTP 200**, the in-flight run
  is present with `status: RUNNING`, and it sorts to the **TOP** of the list (an in-flight run is the
  freshest activity — CTRIB-024 Option A). The DB column `data_entity_task_run.status` accepts the
  7-value `IngestionTaskRunStatus` (incl. `RUNNING`); `RUNNING` is now **also** a value of the wire enum
  `DataEntityRunStatus`, so `DataEntityRunMapper` maps it (and a tolerant default method degrades any
  *future* unmapped status to `UNKNOWN` instead of throwing → no more 500-on-enum-drift). RED proof on
  `ODD_SUT=ref:main`: the same request still 500s (the pre-fix wire/DB enum asymmetry). Also driven in
  the **browser**: the history page renders the in-flight run with a "running" status badge (the FE theme
  palette gained a `RUNNING` colour; pre-fix it had none and the row render would throw).

- **CORNER 2 (F-040-UC-4, RE-GROUNDED 2026-06-19 — #1757):** `status=RUNNING` is now a **valid** filter —
  it BINDS and returns the in-flight runs (**200**), since `RUNNING` is a wire-enum value (was a 400). An
  *invalid* literal (`status=BANANA`) still returns a clean **400** at param-binding (we added a real
  value, not a swallow-everything catch-all) — the ControllerAdvice `ResponseStatusException` pass-through
  (#1760/#1761, CTRIB-005) keeps the framework's status. A valid filter (`status=FAILED`) returns 200
  filtered. RED proof on `ODD_SUT=ref:main`: `status=RUNNING` -> 400 there.

## 2. Preparation — build the test stand
- **Stack**: shared odd-minimal (`ODD_STACK_EXTERNAL=1`). API `:18080`, PG `:15432`, AUTH=DISABLED.
- **Seed data** (spec, idempotent, namespaced `it059_` / ids 20590–20599):
  1. `POST /api/datasources` → source `//it059`.
  2. `POST /ingestion/entities`: dataset + DQ test (`type:JOB` + `data_quality_test{…}`)
     + **5 runs** (`type:JOB_RUN` + `data_quality_test_run{…}`) with strictly increasing
     `end_time`s and a mix of statuses; one carries a `status_reason`.
  3. Resolve the DQ-test id from `data_entity.oddrn` via `dbQuery`.
  4. For CORNER 1: insert one `data_entity_task_run` row with `status='RUNNING', end_time=NULL`
     via `dbQuery` (ingestion does not emit a partial in-flight run through this fixture);
     this is the real DB state a collector writes mid-run. Remove it after the corner check
     so it does not poison the happy-path pages.

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `UP`.
- Seed present: `dbQuery('SELECT count(*) FROM data_entity_task_run WHERE task_oddrn=$1',[dqOddrn])` ≥ 5.

## 4. Run protocol
1. `GET /api/dataentities/{dqId}/runs?page=1&size=2` → 200; `items.length=2`, `page_info.total=5`, `hasNext=true`; `end_time[0] >= end_time[1]`.
2. `GET …/runs?page=3&size=2` → 200; `items.length=1`, `hasNext=false`.
3. Union of all pages = 5 distinct run oddrns, globally ordered by `end_time DESC`.
4. Seed a `RUNNING` row (end_time NULL); `GET …/runs?page=1&size=30` → **200**; the in-flight run is present with `status:RUNNING` and is `items[0]` (top). Remove the row.
5. Seed a `RUNNING` row; `GET …/runs?status=RUNNING&page=1` → **200** (only RUNNING rows); `GET …/runs?status=BANANA&page=1` → **400**; `GET …/runs?status=FAILED&page=1` → 200 (only FAILED rows). Remove the row.
6. (Browser) `GET` the SPA route `/dataentities/{dsId}/test-reports/{dqId}/history` with a `RUNNING` row seeded → the page renders the in-flight run with a "running" status badge (no render crash).

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/dq-run-history.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: pagination + ordering hold across pages (in-flight rows at the TOP, then completed end_time DESC; union = all seeded runs, once each); a RUNNING DB row yields **200** with the in-flight run present at `items[0]`; `status=RUNNING` yields 200 (only RUNNING rows); an invalid literal yields 400; a valid filter yields 200; the browser history page renders the in-flight run with a "running" badge.
- **FAIL** when: ordering/pagination is wrong or rows are dropped/duplicated; OR a RUNNING DB row 500s again (the #1757 fix regressed); OR `status=RUNNING` 400s again; OR the history page fails to render the in-flight run (FE palette regressed).

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-059.md`.

## Cross-references
- Source: F-040 (UC-1 confirmed / UC-2 contradicted / UC-4 contradicted) · `lineage/odd-platform/feature-flows/detail/F-040.yaml`
- Code (post-#1757): `DataEntityRunController.java` · `DataEntityRunServiceImpl.java` · `ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns` (orders `END_TIME DESC` — Postgres NULLs-first default keeps in-flight runs at the top — then `START_TIME DESC, ID DESC` for a total order) · `DataEntityRunMapper.mapRunStatus` (tolerant String→enum, unmapped→UNKNOWN) · wire enum `DataEntityRunStatus` now **7 values incl. RUNNING** == DB `IngestionTaskRunStatus` · FE `theme/palette.ts` `runStatus`/`reportStatus` gained a `RUNNING` colour
- Plan: `lineage/odd-platform/test-plan.md` batch I10

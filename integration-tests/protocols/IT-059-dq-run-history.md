---
id: IT-059
title: "Per-DQ-test run history paginates + orders by end_time DESC; a RUNNING row 500s the page"
gates:
  validates: [F-040]
  enforces: []
  regresses: []
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

- **CORNER 1 (F-040-UC-2, contradicted promise — RED-characterization pin, LSN-029):**
  a run whose status is `RUNNING` makes the endpoint return **HTTP 500**. The DB column
  `data_entity_task_run.status` accepts the 7-value `IngestionTaskRunStatus`
  (incl. `RUNNING`); the wire enum `DataEntityRunStatus` has only 6 values (no `RUNNING`);
  `DataEntityRunMapper` uses MapStruct `Enum.valueOf` which throws
  `IllegalArgumentException` → 500. The page is unavailable *exactly* while a test is
  in flight. KNOWN BUG (PLT needed). The pin asserts the CURRENT 500 (GREEN now) and
  RED-flips the instant the mapper is made tolerant or `RUNNING` is added to the wire enum.

- **CORNER 2 (F-040-UC-4, contradicted promise — characterization):** filtering by a
  status value the wire enum cannot represent (`status=RUNNING`, and indeed any invalid
  literal e.g. `status=BANANA`) returns **HTTP 500** at the controller param-binding
  layer, not a `400 Bad Request`. A valid filter (`status=FAILED`) returns 200 filtered.
  Pins the current 500-on-unmappable-filter so a future `400` (the correct REST shape)
  RED-flips it.

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
4. Seed a `RUNNING` row; `GET …/runs?page=1&size=30` → **500**. Remove the row.
5. `GET …/runs?status=RUNNING` → **500**; `GET …/runs?status=BANANA` → **500**; `GET …/runs?status=FAILED` → 200 (only FAILED rows).

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/dq-run-history.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: pagination + end_time-DESC ordering hold across pages (union = all seeded runs, once each); a RUNNING row yields 500; an unmappable status filter yields 500; a valid filter yields 200.
- **FAIL** when: ordering/pagination is wrong or rows are dropped/duplicated; OR a RUNNING row no longer 500s (bug fixed → flip the pin); OR an invalid status filter starts returning 400 (REST shape fixed → flip the pin).

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-059.md`.

## Cross-references
- Source: F-040 (UC-1 confirmed / UC-2 contradicted / UC-4 contradicted) · `lineage/odd-platform/feature-flows/detail/F-040.yaml`
- Code: `DataEntityRunController.java:18-27` · `DataEntityRunServiceImpl.java:27-45` · `ReactiveDataEntityTaskRunRepositoryImpl.java:160-191` · `DataEntityRunMapper` (MapStruct `Enum.valueOf`) · wire enum `DataEntityRunStatus` (6 values) vs DB `IngestionTaskRunStatus` (7 values)
- Plan: `lineage/odd-platform/test-plan.md` batch I10

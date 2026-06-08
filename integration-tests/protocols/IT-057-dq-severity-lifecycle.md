---
id: IT-057
title: "DQ test severity set/change drives SLA colour; gate is bypassed under AUTH_TYPE=DISABLED"
gates:
  validates: [F-057]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:dq-severity-lifecycle.spec.ts"
plan_ref: I10
status: ready
---

# IT-057 — DQ test severity lifecycle (Minor / Major / Critical)

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs
> the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
F-057 (DQ Test Severity Lifecycle). Three falsifiable claims, all grounded against
the running platform on `http://localhost:18080` (AUTH_TYPE=DISABLED):

- **SUCCESS (F-057-UC-002, confirmed promise):** raising the severity of a *failing*
  DQ test from `MINOR` to `MAJOR` flips the dataset's aggregate SLA colour from
  `YELLOW` to `RED` with **no run-status change** — severity alone drives the colour
  (`SLACalculator.getSLAColour`: `allMinorsFailed → YELLOW`; `allMajorsFailed → RED`).
  Operator consequence if it regresses: the SLA trust signal no longer reflects the
  operator's risk classification — a Critical-classified failing test could read GREEN.

- **CORNER 1 (F-057-UC-005, contradicted under DISABLED):** the severity `PUT`
  is declared permission-gated (`DATASET_TEST_RUN_SET_SEVERITY`,
  `SecurityConstants.java:243-246`) but under `AUTH_TYPE=DISABLED` the whole
  authorization framework is bypassed (`DisabledAuthSecurityConfiguration` →
  `permitAll`), so an **anonymous** caller can set severity. This is the documented
  dev-only posture; we **characterize** it (LSN-001 permissive-default family). The
  test goes RED if DISABLED ever stops being fully-open (which would be a behaviour
  change worth knowing).

- **CORNER 2 (F-057-UC-006, contradicted — characterization pin, LSN-029):** the
  severity write is an UPSERT on `(data_quality_test_id, dataset_id)` with **no version
  / history column** (`ReactiveDataQualityRepositoryImpl.java:86-102`). After three
  successive severity changes the DB holds exactly **one** row carrying only the latest
  value — the prior severities are unrecoverable. Pins the current (lossy) behaviour;
  goes RED when a history/audit surface is added.

## 2. Preparation — build the test stand
- **Stack**: the shared odd-minimal stack (`ODD_STACK_EXTERNAL=1` — never bring it
  up/down). API `http://localhost:18080`, Postgres `:15432`, `AUTH_TYPE=DISABLED`.
- **Seed data** (the spec does this, idempotently, namespaced `it057_` / ids 20570–20579):
  1. `POST /api/datasources` to register source `//it057`.
  2. `POST /ingestion/entities` with: a dataset (`type:TABLE`), a DQ test
     (`type:JOB` + `data_quality_test:{suite_name, dataset_list:[<ds oddrn>], expectation}`),
     and one run (`type:JOB_RUN` + `data_quality_test_run:{...,status:FAILED}`). Ingestion
     populates `data_entity.specific_attributes` so the read paths do not NPE.
  3. Resolve the dataset id + DQ-test id from `data_entity.oddrn` via `dbQuery`.
  4. Force the test's last run to `FAILED` (`UPDATE data_entity_task_last_run SET status='FAILED'`)
     so severity governs the colour.

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `dbQuery('SELECT id FROM data_entity WHERE oddrn=$1', [dqOddrn])` returns a row.

## 4. Run protocol
1. `PUT /api/datasets/{dsId}/dataqatests/{dqId}/severity {"severity":"MINOR"}` (anonymous).
2. `GET /api/datasets/{dsId}/sla_report` → expect `sla_colour=YELLOW`.
3. `PUT …/severity {"severity":"MAJOR"}` (anonymous).
4. `GET …/sla_report` → expect `sla_colour=RED`.
5. `PUT …/severity {"severity":"CRITICAL"}` (anonymous).
6. `dbQuery('SELECT severity FROM data_quality_test_severity WHERE dataset_id=$1 AND data_quality_test_id=$2')`
   → expect exactly **one** row, `severity=CRITICAL`.

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/dq-severity-lifecycle.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: anon PUTs return 200; sla_colour is YELLOW@MINOR then RED@MAJOR (severity-driven, run status unchanged); exactly one severity row remains, holding only the latest value.
- **FAIL** when: severity has no effect on colour (UC-002 regression); the anon PUT is rejected under DISABLED (posture change); or more than one severity row survives (history added — flip the characterization pin).

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-057.md` (date · stack_commit · runner · outcome · evidence · notes).

## Cross-references
- Source: F-057 (UC-002 confirmed / UC-005 contradicted-under-DISABLED / UC-006 contradicted) · `lineage/odd-platform/feature-flows/detail/F-057.yaml`
- Code: `DataQualityController.java:50-61` · `DataQualityServiceImpl.java:62-81` · `ReactiveDataQualityRepositoryImpl.java:86-102` · `SLACalculator.java:80-121` · `SecurityConstants.java:243-246`
- Plan: `lineage/odd-platform/test-plan.md` batch I10

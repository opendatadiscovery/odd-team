---
id: IT-058
title: "Per-dataset DQ test report + SLA badge/JSON render the seeded test and its SLA status"
gates:
  validates: [F-022]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:dq-test-reports-sla.spec.ts"
plan_ref: I10
status: ready
---

# IT-058 — Per-dataset DQ test reports & SLA

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs
> the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
F-022 (Per-Dataset DQ Test Reports & SLA). Grounded against the running platform:

- **SUCCESS (F-022-UC-08 + the read surface):** a dataset with one ingested DQ test
  and one run exposes a coherent per-dataset DQ read surface:
  - `GET /api/datasets/{id}/dataqatests` → 200, lists the test (with `suite_name`).
  - `GET /api/datasets/{id}/test_report` → 200, the status-count aggregate
    (`{score,total,success_total,failed_total,…}`) matches the seeded run's status.
  - `GET /api/datasets/{id}/sla` → 200 `image/png` (the BI-embeddable badge).
  - `GET /api/datasets/{id}/sla_report` → 200 `application/json` `DataSetSLAReport`
    (`{total,success,sla_colour,severity_weights,sla_ref}`).
  Operator consequence if it regresses: the dataset's Test Reports tab + the SLA trust
  signal break for the audience that most relies on them (data-quality engineers, BI).

- **CORNER 1 (F-022-UC-01, content-type contract):** the `/sla` (PNG) and `/sla_report`
  (JSON) endpoints **do not swap** content-types. This is the load-bearing F-022 doc
  drift: the live docs once described `/sla` as returning JSON; a BI client written to
  that doc receives a PNG byte stream. We pin the wire reality so a future swap RED-fails.

- **CORNER 2 (F-022-UC-03, contradicted promise — characterization, LSN-029):** opening
  the test list for a dataset with **zero** DQ tests returns **404** (`USR002`,
  `DataQualityServiceImpl.java:38-42`), not `200 + []`. The user-facing promise
  ("empty state, not an error") is unmet; we pin the current 404 so it RED-flips if the
  service ever returns an empty collection instead.

## 2. Preparation — build the test stand
- **Stack**: shared odd-minimal (`ODD_STACK_EXTERNAL=1`). API `:18080`, PG `:15432`, AUTH=DISABLED.
- **Seed data** (spec, idempotent, namespaced `it058_` / ids 20580–20589):
  1. `POST /api/datasources` → source `//it058`.
  2. `POST /ingestion/entities`: dataset (`type:TABLE`) + DQ test
     (`type:JOB` + `data_quality_test{suite_name,dataset_list,expectation}`) +
     one run (`type:JOB_RUN` + `data_quality_test_run{…,status:SUCCESS}`).
  3. A SECOND, *bare* dataset (ingested, no DQ test linked) for the empty-list 404 corner.
  4. Resolve ids from `data_entity.oddrn` via `dbQuery`.

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `UP`.
- Seed present: `dbQuery('SELECT id FROM data_entity WHERE oddrn=$1',[dqOddrn])` returns a row;
  `dbQuery('SELECT count(*) FROM data_quality_test_relations WHERE dataset_oddrn=$1',[dsOddrn])` ≥ 1.

## 4. Run protocol
1. `GET /api/datasets/{dsId}/dataqatests` → 200; body `items[]` contains the test, `suite_name='it058_suite'`.
2. `GET /api/datasets/{dsId}/test_report` → 200; `success_total=1`, `total=1`.
3. `GET /api/datasets/{dsId}/sla` → 200; `content-type: image/png`; body length > 0.
4. `GET /api/datasets/{dsId}/sla_report` → 200; `content-type: application/json`; `sla_colour ∈ {GREEN,YELLOW,RED}`; `sla_ref` ends `/sla`.
5. `GET /api/datasets/{bareDsId}/dataqatests` → 404 (`USR002`).

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/dq-test-reports-sla.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: list/report/sla/sla_report all 200 with the shapes above; `/sla` is PNG and `/sla_report` is JSON (no swap); the test_report counts match the seeded run; the bare dataset's list is 404.
- **FAIL** when: any read 500s/404s for the seeded dataset; the content-types swap; the counts do not reflect the seeded run; or the empty-list endpoint stops returning 404 (flip the characterization pin).

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-058.md`.

## Cross-references
- Source: F-022 (UC-01 / UC-03 / UC-08) · `lineage/odd-platform/feature-flows/detail/F-022.yaml`
- Code: `DataQualityController.java:25-68` · `DataQualityServiceImpl.java:38-60,89-101` · `ReactiveDataQualityRepositoryImpl.java:45-160` · `SLACalculator.java`
- Plan: `lineage/odd-platform/test-plan.md` batch I10

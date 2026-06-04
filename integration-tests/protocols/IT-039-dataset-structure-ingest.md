---
id: IT-039
title: "Dataset structure via real ingestion — ingested columns appear; re-ingest surfaces a new column"
gates:
  validates: [F-047]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:dataset-structure-ingest.spec.ts"
plan_ref: I5
status: ready
---

# IT-039 — F-047 Dataset Field per-Column Surface (structure via real ingestion)

## 1. What this checks

A collector ingests a dataset with a column list (`POST /ingestion/entities`, `dataset.field_list`);
the platform must expose those columns on `GET /api/datasets/{id}/structure`. Re-ingesting with a new
column must surface it. **Operator consequence if it FAILS:** a dataset's schema never appears, or a
column add never propagates. Driven through the REAL ingestion contract — the prior raw-DB seed hit a
`deserializeStats` NPE; real ingest sets the field shape correctly (→ 200).

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source` (`seedIngestionDataSource`) + a TABLE entity ingested WITH a populated
  `dataset.field_list` (via the ingestion-API helper).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Structure endpoint real (not SPA): `GET /api/datasets/{id}/structure` → 200 `application/json`

## 4. Run protocol

1. Ingest a TABLE entity `E` with `dataset.field_list=[{oddrn,name:it039_user_id,type:{TYPE_STRING}}]` → 200.
2. `GET /api/datasets/{id}/structure` → body contains the column `it039_user_id`, not a ghost column.
3. Re-ingest `E` with `[it039_user_id, it039_created_at]` → `GET .../structure` → contains the new column.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-039`.

## 5. Assertions

- **PASS** when: the ingested column appears on the structure (no NPE); a never-ingested column is absent;
  a re-ingested new column surfaces.
- **FAIL** when: structure 500s (NPE), the column is missing, or a column add never propagates.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-039.md`.

## Cross-references
- Source: F-047 (column surface); unblocks the IT-023 raw-seed deserializeStats NPE via real ingest.
- Plan: `lineage/odd-platform/test-plan.md` batch I5

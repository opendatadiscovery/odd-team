---
id: IT-023
title: "The dataset Structure tab renders the dataset's columns (data-driven)"
gates:
  validates: [F-045]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/dataset-structure-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-023 — Dataset Structure tab renders columns (F-045)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
A dataset's **Structure** tab (`/dataentities/{id}/structure` → `GET /api/datasets/{id}/structure`
latest) renders the dataset's column rows (name verbatim, type abbreviated). The list is data-driven —
a column not in the dataset is not rendered. If it FAILS, the dataset schema does not reach the
Structure read surface (F-045 Dataset Schema Revision History — Structure tab). Source: feature-flow
F-045; `DatasetController.getDataSetStructureLatest` + `DatasetStructure.tsx`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` (a DATASET, class DATA_SET) via `helpers/db.ts seedDatasetColumn(name)` —
  seeds a `dataset_version` + a `dataset_field` + the `dataset_structure` link (verified schema).
  ⚠ `dataset_field.stats` must be non-null (`'{}'`) — `DatasetFieldApiMapper.deserializeStats` NPEs
  (HTTP 500) on null stats (latent platform bug; collectors always send stats).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `GET /api/datasets/2001/structure` → `field_list[]` contains the column;
  detail `version_list` has version 1.

## 4. Run protocol
1. SUCCESS: `seedDatasetColumn("<col>")`; open `/dataentities/2001/structure`; wait for the
   `GET /api/datasets/2001/structure` response; observe the column rows.
2. NEGATIVE: same seed; assert a column name NOT in the dataset (`IT023GhostColumn`) is absent.

**Automated rail**: `integration-tests/run-suite.sh IT-023` (Playwright `e2e/specs/dataset-structure-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the seeded column name renders on the Structure tab.
  (FAIL: the column never appears → the dataset schema does not reach the Structure tab.)
- **NEGATIVE (PASS):** a column not in the dataset is not rendered (visible count 0).

## 6. Result log
- 2026-06-03 — authored; structure API + Structure-tab DOM ground-truth verified (column renders);
  surfaced a latent platform bug (deserializeStats NPE→500 on null dataset_field.stats); run via
  run-suite.sh IT-023 (see run-log/).

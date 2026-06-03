---
id: IT-025
title: "The data entity Overview renders its namespace (and none when the data source has none)"
gates:
  validates: [F-028]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-namespace-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-025 — Namespace renders on the Overview (F-028)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview renders the entity's **namespace** (sourced from its data source) under the
"Namespace" label, and none when the data source has no namespace — the field is data-driven. If it
FAILS, the namespace (F-028 Namespace Lifecycle Management) does not reach the entity read surface
(`OverviewGeneral.tsx` → `dataSource.namespace.name`, rendered verbatim). Source: feature-flow F-028.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityNamespace(name)` — getOrCreates a
  `namespace` and points the entity's `data_source.namespace_id` at it (verified image schema); or
  `clearEntityNamespace()` to null the data source's namespace.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT n.name FROM data_source ds JOIN namespace n ON n.id = ds.namespace_id WHERE ds.id = 2001;`.
- API projection: `curl -s http://localhost:18080/api/dataentities/2001` → `data_source.namespace` (snake_case wire).

## 4. Run protocol
1. SUCCESS: `seedEntityNamespace("<ns>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the "Namespace" field.
2. NEGATIVE: `clearEntityNamespace()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-025` (Playwright `e2e/specs/entity-namespace-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the namespace name renders on the Overview.
  (FAIL: the namespace never appears → it does not reach the Overview.)
- **NEGATIVE (PASS):** with no namespace on the data source, the namespace is absent (visible count 0).

## 6. Result log
- 2026-06-03 — authored; namespace render confirmed in source (verbatim, OverviewGeneral) + API
  ground-truth; run via run-suite.sh IT-025 (see run-log/).

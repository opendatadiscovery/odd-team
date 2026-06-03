---
id: IT-031
title: "The detail header renders the business name (internal_name), falling back to the external name"
gates:
  validates: [F-178]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-business-name-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-031 — Business name (internal name) header display (F-178)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The data-entity detail **header** renders the operator-set **business name** (`internal_name`) as the
heading, falling back to the collector `external_name` when it is unset (`internalName || externalName`).
If it FAILS, the business-name override does not reach the header (F-178 Entity Header Authoring Surface
— Internal Name). Verified live (2026-06-03): internal_name renders verbatim as the heading. Source:
feature-flow F-178.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityBusinessName(name|null)` — sets (or clears)
  `data_entity.internal_name` (verified image schema). external_name stays `it002_table`.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT internal_name, external_name FROM data_entity WHERE id = 2001;`.
- API: `curl -s http://localhost:18080/api/dataentities/2001` → `internal_name` / `external_name`.

## 4. Run protocol
1. SUCCESS: `seedEntityBusinessName("<name>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the header heading.
2. NEGATIVE: `seedEntityBusinessName(null)`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-031` (Playwright `e2e/specs/entity-business-name-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the business name renders as the header heading.
- **NEGATIVE (PASS):** with no business name, the header falls back to the external name AND the
  business name is absent (visible count 0).

## 6. Result log
- 2026-06-03 — authored; internal_name/external_name fallback ground-truth verified; run via run-suite.sh IT-031 (see run-log/).

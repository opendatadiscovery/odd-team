---
id: IT-014
title: "The data entity Overview renders the internal description (and none when unset)"
gates:
  validates: [F-004]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-description-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-014 — Entity description renders on the Overview (F-004)

> A protocol is the source of truth — a human can execute every step below without
> tooling. The e2e spec automates the same steps and reaches the same verdict.

## 1. What this checks
The entity Overview renders the entity's **internal description** when one is set, and does
NOT render it when unset — i.e. the description panel is driven by the data. If this FAILS,
the description an operator edited (F-004 "Entity Description Editing") either does not reach
the Overview or a stale/placeholder value is shown. Source: feature-flow F-004.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityDescription(text|null)` — seeds the
  base entity (seedEntity) then sets `data_entity.internal_description`.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT internal_description FROM data_entity WHERE id = 2001;`.

## 4. Run protocol
1. SUCCESS: `seedEntityDescription("<marker>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe.
2. NEGATIVE: `seedEntityDescription(null)`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-014` (Playwright
`e2e/specs/entity-description-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the marker description text is visible on the Overview.
  (FAIL: marker never appears → the description does not reach the Overview.)
- **NEGATIVE (PASS):** with the description cleared, the marker text is absent (count 0).
  (FAIL: marker shows with no description set → stale/placeholder render.)

## 6. Result log
- 2026-06-03 — authored; run via run-suite.sh IT-014 (see run-log/).

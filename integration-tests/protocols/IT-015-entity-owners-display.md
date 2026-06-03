---
id: IT-015
title: "The data entity Overview renders assigned owners (and none when unassigned)"
gates:
  validates: [F-019]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-owners-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-015 — Entity owners render on the Overview (F-019)

> A protocol is the source of truth — a human can execute every step below without tooling.
> The e2e spec automates the same steps and reaches the same verdict.

## 1. What this checks
The entity Overview renders the entity's **assigned owners** when ownership exists, and renders
none when there is no ownership — the owners panel is data-driven. If this FAILS, ownership an
operator assigned (F-019 Owner Lifecycle Management) does not reach the entity read surface, or a
stale owner is shown. Source: feature-flow F-019.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityOwner(name, role)` — seeds the base
  entity, an `owner` (unique name), a `role`, and an `ownership` row binding them; or
  `clearEntityOwners()` for the no-owner case.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT o.name FROM ownership os JOIN owner o ON o.id = os.owner_id WHERE os.data_entity_id = 2001;`.

## 4. Run protocol
1. SUCCESS: `seedEntityOwner("<owner>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe.
2. NEGATIVE: `clearEntityOwners()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-015` (Playwright
`e2e/specs/entity-owners-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the owner name is visible on the Overview.
  (FAIL: owner name never appears → ownership does not reach the Overview.)
- **NEGATIVE (PASS):** with no ownership, the owner name is absent (count 0).
  (FAIL: owner name shows with no ownership → stale render.)

## 6. Result log
- 2026-06-03 — authored; run via run-suite.sh IT-015 (see run-log/).

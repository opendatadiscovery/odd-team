---
id: IT-013
title: "Opening a data entity's Overview composes + renders the entity end-to-end"
gates:
  validates: [F-176]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/data-entity-overview.spec.ts"
plan_ref: ""
status: ready
---

# IT-013 — Data Entity Overview composed reading surface (F-176)

> A protocol is the source of truth — a human can execute every step below without
> tooling. The e2e spec automates the same steps and reaches the same verdict.

## 1. What this checks
Navigating a real browser to `/dataentities/{id}/overview` for a seeded entity **composes
the Overview surface and renders that entity** (its name is shown; the detail fetch fires).
Conversely, navigating to a **non-existent** id does **not** render the seeded entity.
If this FAILS the entity detail page is broken end-to-end (the default route per
`dataEntitiesRoutes.ts:66-73`, composed by `Overview.tsx`) — the single most-used read
surface in ODD. Source: feature-flow F-176 ("navigate to /dataentities/{id}/overview —
assert panels render").

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED — no login). Brought up by the runner during
  the e2e run via `integration-tests/run-suite.sh IT-013`.
- **Auth/config**: default DISABLED — the UI loads without authentication.
- **Seed data**: one renderable data entity at `ENTITY_ID=2001` (`external_name=it002_table`)
  via `helpers/db.ts seedEntity()` — a `data_source` + `data_entity` row (the same minimal
  shape IT-002 proved sufficient for `GET /api/dataentities/{id}` to return 200).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT external_name FROM data_entity WHERE id = 2001;` → `it002_table`.

## 4. Run protocol
1. Seed the entity (`seedEntity()`).
2. SUCCESS: open `/dataentities/2001/overview`; wait for the `GET /api/dataentities/2001`
   detail response; observe the rendered page.
3. NEGATIVE: open `/dataentities/999999/overview` (no such entity); observe the rendered page.

**Automated rail**: `integration-tests/run-suite.sh IT-013` (Playwright spec
`e2e/specs/data-entity-overview.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the Overview renders entity 2001 — its name `it002_table` is visible.
  (FAIL: the name never appears → the Overview did not compose/load the entity.)
- **NEGATIVE (PASS):** for the absent id `999999`, the seeded entity's name `it002_table` is
  NOT present (count 0) — a bad id does not render some other entity.
  (FAIL: `it002_table` shows for `999999` → wrong-entity / stale render.)

## 6. Result log
- 2026-06-03 — authored; run via run-suite.sh IT-013 (see run-log/).

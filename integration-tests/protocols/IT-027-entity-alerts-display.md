---
id: IT-027
title: "The per-entity Alerts tab renders the entity's alerts (and none when there are no alerts)"
gates:
  validates: [F-014]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-alerts-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-027 — Per-entity alert view (F-014)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The per-entity **Alerts** tab (`/dataentities/{id}/alerts` → `GET /api/dataentities/{id}/alerts`)
renders each alert raised on the entity by its TYPE label (verbatim — e.g. "Backwards incompatible
schema") + status, and none when there are no alerts — the panel is data-driven. If it FAILS, an
alert raised on the entity does not reach its read surface (F-014 Per-Entity Alert View). Source:
feature-flow F-014. Verified live (2026-06-03): the type label renders.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityAlert(desc?)` — inserts an OPEN `alert`
  (type BACKWARDS_INCOMPATIBLE_SCHEMA) + an `alert_chunk` (the alerts list inner-joins alert_chunk,
  so a chunk is required for the alert to appear); or `clearEntityAlerts()` for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT a.status, a.type FROM alert a WHERE a.data_entity_oddrn = '//e2e-source-IT-002/db/tables/it002_table';`.
- API: `curl -s http://localhost:18080/api/dataentities/2001/alerts?page=1&size=20` → the alert in `items[]`.

## 4. Run protocol
1. SUCCESS: `seedEntityAlert()`; open `/dataentities/2001/alerts`; wait for the
   `GET /api/dataentities/2001/alerts` response; observe.
2. NEGATIVE: `clearEntityAlerts()`; open `/dataentities/2001/alerts`; wait for alerts; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-027` (Playwright `e2e/specs/entity-alerts-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the alert type label renders on the Alerts tab.
  (FAIL: the alert never appears → the alert does not reach the per-entity view.)
- **NEGATIVE (PASS):** with no alert, the alert type is absent (visible count 0).

## 6. Result log
- 2026-06-03 — authored; alert API + Alerts-tab DOM ground-truth verified (type label renders; alerts
  list inner-joins alert_chunk); run via run-suite.sh IT-027 (see run-log/).

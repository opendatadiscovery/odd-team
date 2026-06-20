---
id: IT-030
title: "The global Alerts page lists open alerts by default and surfaces resolved alerts via the status filter"
gates:
  validates: [F-126]
  enforces: []
  regresses: [1763]
test_class: integration
stack: odd-minimal
automation: "e2e:specs/global-alerts-list.spec.ts"
plan_ref: "contributor/CTRIB-025.md"
status: ready
---

# IT-030 — Global alerts list page (F-126)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The platform-wide **Alerts** page (`/alerts` "All" tab → `GET /api/alerts`) lists every open alert with
its entity name + type label, and none when there are no open alerts — data-driven. If it FAILS, an
alert does not reach the global alerts list (F-126 Global Alerts List Page). Distinct from IT-027
(F-014, the per-entity Alerts tab). Verified live (2026-06-03): the global list shows the entity name +
type. Source: feature-flow F-126.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedEntityAlert(desc?)` — an OPEN alert + chunk on entity 2001 (the
  alerts list inner-joins alert_chunk); `clearEntityAlerts()` for none. (Shared with IT-027.)

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/alerts?page=1&size=20'` → the alert in `items[]` (type + data_entity).

## 4. Run protocol
1. SUCCESS: `seedEntityAlert()`; open `/alerts`; wait for the `GET /api/alerts` response; observe the list.
2. NEGATIVE: `clearEntityAlerts()`; open `/alerts`; wait for alerts; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-030` (Playwright `e2e/specs/global-alerts-list.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the open alert's type label renders in the global alerts list.
  (FAIL: the alert never appears → it does not reach the global list.)
- **NEGATIVE (PASS):** with no open alert, the alert type is absent (visible count 0).
- **#1763 status filter (PASS):** `seedOpenAndResolvedAlerts()` seeds one OPEN (type "Backwards incompatible
  schema") + one RESOLVED (type "Failed DQ test") alert. On the default `/alerts` view (status=OPEN) the OPEN
  type renders and the RESOLVED type is ABSENT; navigating to `/alerts?status=RESOLVED` (the URL the Status
  filter sets) the RESOLVED type renders. (FAIL on the pre-fix system: `/api/alerts/list` + the status param
  do not exist, so the resolved alert is unreachable on the global page — the RED proof for #1763 / CTRIB-025.)

## 6. Result log
- 2026-06-03 — authored; global alerts API + /alerts page ground-truth verified; run via run-suite.sh IT-030 (see run-log/).
- 2026-06-20 — extended for #1763 (CTRIB-025): the hardened Activity-style view now calls `GET /api/alerts/list`
  and surfaces resolved alerts via the status filter; added the status-filter RED→GREEN assertion.

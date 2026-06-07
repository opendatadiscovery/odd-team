---
id: IT-092
title: "The Notification Settings dialog opens, renders its four alert-type fields, and round-trips a saved halt window"
gates:
  validates: [F-198]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:notification-settings-dialog.spec.ts"
plan_ref: I4
status: ready
---

# IT-092 — Notification Settings dialog (react-hook-form) (F-198)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The **Notification settings** dialog on the Alerts tab (`/dataentities/{id}/alerts`) opens for a permitted
user, renders its four alert-type fields, and a persisted halt window loads back into the form
(F-198-UC-10 the save→persist→reload round-trip; F-198-UC-01 the permission-gated trigger is visible). If
it FAILS, the dialog does not open, a field is missing, or a saved halt window does not reload. Mutation
surface sibling to F-014. Source: feature-flow F-198 (UC-01, UC-10).

GROUND TRUTH (read + curl-verified 2026-06):
- The trigger (`NotificationSettings` button, text "Notification settings") is wrapped in
  `<WithPermissions permissionTo=DATA_ENTITY_ALERT_CONFIG_UPDATE>` (DataEntityAlerts.tsx:53). On
  odd-minimal `/api/identity/whoami` returns admin WITH that permission → the trigger renders.
- On click → `GET /api/dataentities/{id}/alert_config`. Dialog renders title "Notification settings", a
  helper line, four `AlertTypeRange` rows ("Backwards incompatible schema change", "Failed data quality
  test", "Failed job", "Distribution anomaly"), and an "Apply" submit.
- A FUTURE `incompatible_schema_halt_until` (verified schema: `alert_halt_config(data_entity_id PK,
  *_halt_until timestamps)`) makes `AlertTypeRange.getRangeToEnableNotification` render a
  "<duration> to turn on" caption — the reload signal.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline `dbQuery`, id 20920, oddrn `//e2e-it092/`): entity `it092_notif_entity`; for the
  round-trip a row in `alert_halt_config` with `incompatible_schema_halt_until = NOW() + 3 days`; for the
  clean-form path, no `alert_halt_config` row.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Perms: `curl -s http://localhost:18080/api/identity/whoami` → includes `DATA_ENTITY_ALERT_CONFIG_UPDATE`.
- API: `curl -s http://localhost:18080/api/dataentities/20920/alert_config` → the seeded halt-until.

## 4. Run protocol
1. FIELDS: seed entity (no config); open `/dataentities/20920/alerts`; click "Notification settings"; wait
   for `GET /alert_config`; observe the dialog + all four alert-type labels + "Apply".
2. ROUND-TRIP: seed `incompatible_schema_halt_until = NOW()+3d`; open the dialog; observe a
   "... to turn on" remaining-time caption (the saved value reloaded into the form).
3. NEGATIVE: seed entity with NO config; open the dialog; observe NO "... to turn on" caption.

**Automated rail**: `integration-tests/run-suite.sh IT-092` (Playwright `e2e/specs/notification-settings-dialog.spec.ts`).

## 5. What it checks — assertions
- **FIELDS (PASS):** the dialog opens and renders the four alert-type fields + the Apply submit.
  (FAIL: trigger hidden / dialog empty.)
- **ROUND-TRIP (PASS):** with a persisted future halt window, the form shows the "... to turn on" caption.
  (FAIL: the saved value does not reload.)
- **NEGATIVE (PASS):** with no persisted config, no remaining-time caption appears (data-driven).

## 6. Result log
- 2026-06-07 — authored; trigger permission (admin has DATA_ENTITY_ALERT_CONFIG_UPDATE under DISABLED) +
  alert_config round-trip curl-verified; dialog open + four fields + reload caption verified end-to-end
  (3/3 green); run via run-suite.sh IT-092 (see run-log/).

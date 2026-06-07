---
id: IT-091
title: "The three-panel Discussions UI composes (Channels / MessagesList / CurrentMessage) under no-config"
gates:
  validates: [F-197]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:data-collaboration-ui-tab.spec.ts"
plan_ref: I4
status: ready
---

# IT-091 — Data Collaboration UI Tab (three-panel composition) (F-197)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Discussions UI (`DataCollaboration.tsx`) composes its three panels — Channels (left) + MessagesList
(middle) + CurrentMessage (right) — even under no-Slack-config (F-197-H-008). CHARACTERIZATION (LSN-029):
pins the CURRENT no-config composition. If it FAILS, a panel no longer renders. Sibling to IT-090 (F-038
backend no-config state); this is the UI-composition characterization. Source: feature-flow F-197 (H-008).

GROUND TRUTH (read):
- Left  → `Channels` → `DataEntityChannelsAutocomplete` (label "Channels" / placeholder "Search channel").
- Middle → `MessagesList` (empty → "No messages", MessagesList.tsx:70).
- Right → `CurrentMessage` → `NoMessage` default sub-route → "Messages are not selected" +
  "Select a message to see discussions".
- `GET /messages` → 200 `{"items":[]}` (always-on controller); Slack channel calls 500.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline `dbQuery`, id 20910, oddrn `//e2e-it091/`): a renderable entity
  `it091_collab_ui_entity`.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/dataentities/20910/messages` → `{"items":[]}`.

## 4. Run protocol
1. SUCCESS: open `/dataentities/20910/discussions`; observe the left panel ("Channels"), the middle panel
   ("No messages"), and the right panel ("Messages are not selected") all render.
2. CORNER: same navigation; observe the right panel's helper line "Select a message to see discussions".

**Automated rail**: `integration-tests/run-suite.sh IT-091` (Playwright `e2e/specs/data-collaboration-ui-tab.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** all three panels render their no-config text (Channels / No messages / Messages are
  not selected). (FAIL: a panel is missing → the shell does not compose.)
- **CORNER (PASS):** the right panel renders its no-selection helper line.

## 6. Result log
- 2026-06-07 — authored; three-panel composition verified end-to-end (2/2 green); messages-fetch wait made
  react-query-resilient (race + timeout; DOM is the gate) to remove a combined-run flake; run via
  run-suite.sh IT-091 (see run-log/).

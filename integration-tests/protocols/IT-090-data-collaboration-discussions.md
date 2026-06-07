---
id: IT-090
title: "The Slack Discussions tab mounts and renders the empty no-config state on odd-minimal"
gates:
  validates: [F-038]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:data-collaboration-discussions.spec.ts"
plan_ref: I4
status: ready
---

# IT-090 — Data Collaboration (Slack Discussions) no-config state (F-038)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Data Entity **Discussions** tab (`/dataentities/{id}/discussions`) mounts and, on odd-minimal where
Slack is NOT usably configured, renders the empty messages state (F-038-UC-10 — the user-observable
no-config experience). CHARACTERIZATION (LSN-029): it pins the CURRENT rendered state, not an ideal
Slack-connected one. If it FAILS, the tab no longer mounts or the empty state regresses. Source:
feature-flow F-038 (UC-10).

GROUND TRUTH (curl-verified on the running stack 2026-06):
- `GET /api/dataentities/{id}/messages` → `200 {"items":[]}` — served by `DataEntityController`
  (always registered, NOT `@ConditionalOnDataCollaboration`).
- `GET /api/datacollaboration/.../channels` → `500 SYS001` — `DataCollaborationController` IS registered
  (`datacollaboration.enabled=true`) but Slack calls fail (no working workspace/token). So the realistic
  operator state is "feature flag on, Slack non-functional" — the messages surface is simply empty.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline `dbQuery`, id 20900, oddrn `//e2e-it090/`): a renderable entity
  `it090_discussions_entity` to mount the tab on.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/dataentities/20900/messages` → `{"items":[]}`.

## 4. Run protocol
1. SUCCESS: open `/dataentities/20900/discussions`; wait for the `GET /messages` to settle; observe the
   middle panel renders the "No messages" empty placeholder.
2. CORNER: same navigation; observe the right panel renders "Messages are not selected" (no `:messageId`).

**Automated rail**: `integration-tests/run-suite.sh IT-090` (Playwright `e2e/specs/data-collaboration-discussions.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the Discussions tab shows the "No messages" empty messages state.
  (FAIL: the tab does not mount / the empty state is gone.)
- **CORNER (PASS):** the current-message panel shows the "Messages are not selected" no-selection state.

## 6. Result log
- 2026-06-07 — authored; messages endpoint (always-on, items:[]) vs channels endpoint (500, Slack
  non-functional) distinction curl-verified; no-config rendered state verified end-to-end (2/2 green);
  run via run-suite.sh IT-090 (see run-log/).

---
id: IT-142
title: "An alert status change reflects on the per-entity Alerts tab without a refresh, and both surfaces confirm before flipping"
gates:
  validates: [F-014]
  enforces: []
  regresses: [1803]
test_class: integration
stack: odd-minimal
automation: "e2e:specs/alert-status-change.spec.ts"
plan_ref: "contributor/CTRIB-034.md"
status: ready
---

# IT-142 — Alert status change: reflect-without-refresh + confirm-before-flip (F-014 / #1803)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
Changing an alert's status from the UI must (a) prompt a confirmation **before** the flip on BOTH surfaces —
the per-entity Data Entity → Alerts tab and the global `/alerts` page — and (b) on the per-entity tab, reflect
the new status **without a page refresh**. If it FAILS, the platform reproduces odd-platform#1803: a single
click flips the status with no guard (Defect 2), and the per-entity tab shows a stale "Open"/"Resolve" while a
success toast claims the change worked (Defect 1 — the `updateAlertStatus` thunk emits the entity id under
`dataEntityId` but the reducer reads `entityId`, so the per-entity in-place update branch is dead and the write
falls through to the global list the tab does not render). Source: feature-flow F-014; CTRIB-034.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityAlert()` — an OPEN alert (type
  BACKWARDS_INCOMPATIBLE_SCHEMA) + an `alert_chunk` (the alerts list inner-joins alert_chunk). Each test
  re-seeds (idempotent: deletes prior + inserts a fresh OPEN alert), so an earlier resolve does not leak.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `curl -s http://localhost:18080/api/dataentities/2001/alerts?page=1&size=20` → 1 OPEN item.

## 4. Run protocol
1. **Per-entity reflect (Defect 1 + 2):** `seedEntityAlert()`; open `/dataentities/2001/alerts`; wait for the
   `GET /api/dataentities/2001/alerts`; click **Resolve**; a confirmation dialog must appear (asserting the
   "Are you sure you want to resolve this alert?" copy); confirm; observe the row WITHOUT navigating/refreshing.
2. **Per-entity cancel gates:** `seedEntityAlert()`; open the tab; click **Resolve**; dismiss the dialog
   (Escape) without confirming; observe the row.
3. **Global confirm (Defect 2, second surface):** `seedEntityAlert()`; open `/alerts`; click **Resolve**;
   observe whether a confirmation dialog appears.

**Automated rail**: `integration-tests/run-suite.sh IT-142` (Playwright `e2e/specs/alert-status-change.spec.ts`).

## 5. What it checks — assertions
- **Per-entity reflect (PASS):** a confirmation dialog appears before the flip; after confirming, the trigger
  flips to **Reopen** and no **Resolve** button remains — i.e. the row shows "Resolved" with no refresh.
  (FAIL on the pre-fix system: no dialog appears → the dialog assertion times out; and even after the immediate
  flip the per-entity row stays "Open"/"Resolve" until a refetch — the RED proof for #1803.)
- **Per-entity cancel (PASS):** after dismissing the dialog, the alert is still open (Resolve still offered,
  no Reopen) — the confirmation gates the flip.
- **Global confirm (PASS):** clicking Resolve on `/alerts` opens a confirmation dialog. (FAIL on the pre-fix
  system: the status flips immediately with no dialog.)

## 6. Result log
- 2026-06-24 — authored (CTRIB-034 / #1803). RED proof on `ODD_SUT=ref:main`; GREEN on the working-tree fix.
  Run via `run-suite.sh IT-142` (see run-log/).

---
id: IT-002
title: "Opening a data-entity Overview page registers exactly one view (UI e2e)"
gates:
  validates: [F-001]
  enforces: []
  regresses: [PLT-104]
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/view-count-overview.spec.ts"
plan_ref: "F-001 P1 — the user-flow integration test for view_count (IT-001 = backend sub-check)"
status: ready
expected_result: "RED until PLT-104 fixed — one page-open double-counts to +2; the red is the regression signal"
---

# IT-002 — view_count, the real user scenario (UI Overview page)

> **This is the integration test for F-001.** It drives the real browser through the
> user flow. The API-only `IT-001`/`P-001` is a backend sub-check: it confirms the
> documented `+1` per `GET /api/dataentities/{id}` but **cannot** see the user-facing
> double-count, because that bug lives in a React `useEffect` dependency array
> (LSN-017) that only fires when a browser opens the page.

## 1. What this checks
A user opening a data entity's **Overview page** is **one visit** and must increment
`data_entity.view_count` by exactly **+1** — because that count drives the Popular
Entities ranking (F-001). **Known bug (PLT-104 / LSN-017):** each page-open registers
**+2** (the `useEffect` dep-array fires the detail fetch twice), so the "most popular"
ranking is inflated 2× for entities users actually click. **This test is RED today** —
the red is the regression signal; it goes green when PLT-104 is fixed.
Source: F-001 H-002 · PLT-104 · LSN-017 · TEST-GAP-836 (UI anchor).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres). The platform image serves the bundled
  React UI at `http://localhost:18080`. The harness brings it up automatically; manually:
  `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Browser toolchain**: Node 20+ (workspace pins 24), then `cd integration-tests/e2e &&
  npm install && npm run browser` (installs Chromium). One-time.
- **Seed**: a renderable entity `id=2001` with `view_count=0` (the spec's `helpers/db.seedEntity()`;
  manually, the same INSERT shape as `probes/P-001.yaml`).

## 3. Readiness check — is the stand ready?
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `curl -s http://localhost:18080/ | head` → HTML (`<div id="root">` — the UI is served)
- `SELECT view_count FROM data_entity WHERE id=2001;` → `0`

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh ui-e2e` (or `cd integration-tests/e2e && npm test`).
- **Manual (human-carryable)**: in a browser, open `http://localhost:18080/dataentities/2001/overview`
  **exactly once**; wait for the page to finish loading; do not refresh.

## 5. What it checks — assertions
- **PASS** when: after one page-open, `view_count == 1`.
- **FAIL (expected today)** when: `view_count == 2` — the LSN-017/PLT-104 UI double-count is live.
- **FAIL (setup)** when: `view_count == 0` — the page didn't load the entity (verify the UI route).

## 6. Result log
`integration-tests/run-log/{date}-ui-e2e.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure (gitignored — attach to the log if material).

## Cross-references
- Source: F-001 H-002 · PLT-104 · LSN-017
- Backend sub-check: `IT-001` (`probes/P-001.yaml`) — the `+1` API contract this UI test sits on top of
- Plan: `lineage/odd-platform/test-plan.md` (F-001 P1; the e2e reframing of the integration approach)
- Automation: `integration-tests/e2e/specs/view-count-overview.spec.ts`

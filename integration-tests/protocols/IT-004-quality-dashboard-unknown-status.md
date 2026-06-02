---
id: IT-004
title: "An unknown Data-Quality run status must degrade gracefully, not blank the dashboard (UI e2e)"
gates:
  validates: [F-032]
  enforces: []
  regresses: [PLT-052]
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/quality-dashboard-unknown-status.spec.ts"
plan_ref: "I9 (UI cross-tier e2e) — Tier-1 DISABLED-stack clean UI flow"
status: ready
expected_result: "RED until DataQualityContent uses a null-safe palette lookup — an out-of-enum run status throws a TypeError during render and blanks the whole dashboard (no error boundary). PLT-052 Defect 1."
---

# IT-004 — Quality Dashboard unknown run-status blanks the page

> **This is an integration test for F-032 (Quality Dashboard).** It drives the real
> catalog-wide Data Quality dashboard and exercises the exact scenario PLT-052 names —
> "a backend enum addition" — by making the dashboard receive a run status its palette
> does not know. The general "any render throw white-screens the app" sibling is
> IT-006; this one pins the specific palette crash.

## 1. What this checks
The Data Quality dashboard must render every run status — including one the UI does not
recognise — with a fallback colour, never crash. **Known bug (PLT-052 Defect 1):**
`DataQualityContent.tsx:47-48` does `palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown`.
`palette.runStatus` is keyed by exactly the SIX `DataEntityRunStatus` values
(`SUCCESS`/`FAILED`/`SKIPPED`/`BROKEN`/`ABORTED`/`UNKNOWN`). Any other status makes
`palette.runStatus[status]` undefined, so `.color` throws a **TypeError before the `??`
fallback can apply** — during render, with no error boundary → the whole dashboard
blanks while the build stays green.

**Operator-facing consequence if it FAILS:** the day the platform (or a collector)
emits a new run-status value, every operator's Data Quality dashboard goes blank with
no error and no degraded view — a flagship compliance surface silently dies on a
forward-compatible data change. Source: F-032 H-004 · PLT-052 Defect 1 · `DataQualityContent.tsx:47-48`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres; UI at `http://localhost:18080`). Brought
  up automatically; manually: `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install && npm run browser`. One-time.
- **Trigger — two equivalent ways to make an unknown status reach the dashboard:**
  - **Automated (this spec):** intercept the dashboard JSON response and inject a
    `{status:"WARNING", count:1}` entry into the test-results breakdown (mutating the
    real response, so the shape is exactly correct — this is precisely "a backend enum
    addition"). No DB seed needed.
  - **Manual / full-chain (human-carryable):** because `data_entity_task_last_run.status`
    is `VARCHAR(64)` (NOT a Postgres enum — `V0_0_45__last_runs_table.sql:12`), you can
    seed one out-of-enum run directly: insert a data-quality-test `data_entity` (with
    `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` set) + a
    `data_entity_task_run` + a `data_entity_task_last_run` with `status='WARNING'`
    (`task_oddrn` = the test's oddrn). The dashboard aggregation
    (`ReactiveDataQualityRunsRepositoryImpl.getLatestDataQualityRunsResults`) then groups
    that into the breakdown.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Dashboard route serves the UI: `curl -s http://localhost:18080/data-quality | head` → HTML (`<div id="root">`)

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh known-bugs`
  (or `cd integration-tests/e2e && npx playwright test quality-dashboard-unknown-status`).
- **Manual (human-carryable)**: with an out-of-enum run seeded (see §2), open
  `http://localhost:18080/data-quality` in a browser and watch the "Test Results
  Breakdown" donut. (Without a seed, the manual path needs the response-injection a
  browser devtools "local override" can also do.)

## 5. What it checks — assertions
- **PASS** when: the dashboard renders — the "Test Results Breakdown" section is visible
  and the unknown status appears with the fallback colour; no uncaught render TypeError.
- **FAIL (expected today)** when: the dashboard does not render (the "Test Results
  Breakdown" title is absent) and an uncaught `TypeError` (reading `color` of undefined)
  reaches the window — the page blanked.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (the captured pageerror / whether the dashboard rendered) · notes`.

## Cross-references
- Source: F-032 H-004 · PLT-052 Defect 1 · `DataQualityContent.tsx:47-48` · run-status enum `DataEntityRunStatus` (SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN)
- Sibling (the general class): **IT-006** — error-boundary containment (TEST-GAP-1013 / F-042); a fix to *this* palette lookup does NOT fix the missing boundary IT-006 pins.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI e2e) + the Tier-1 e2e build-out
- Automation: `integration-tests/e2e/specs/quality-dashboard-unknown-status.spec.ts`
- Fix that flips this GREEN: `palette.runStatus[status]?.color ?? palette.dataQualityDashboard.unknown` (PLT-052 Defect 1 suggested fix), then move IT-004 to `feature-complete`.

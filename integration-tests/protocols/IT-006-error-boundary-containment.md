---
id: IT-006
title: "A render-time throw must be contained by an error boundary, not white-screen the whole app (UI e2e)"
gates:
  validates: [F-042]
  enforces: []
  regresses: []
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/error-boundary-containment.spec.ts"
plan_ref: "I9 (UI cross-tier e2e) — Tier-1; TEST-GAP-1013"
status: ready
expected_result: "RED until a root/route-level error boundary exists — today any render throw unmounts the entire React tree and blanks the whole app (nav chrome included). TEST-GAP-1013 / F-042."
---

# IT-006 — SPA error-boundary containment

> **This is an integration test for F-042 (page-level UI error handling).** It pins the
> *class* behind IT-004: odd-platform-ui has **no error boundary anywhere**, so any
> single render-time throw white-screens the whole app rather than degrading one view.
> IT-004 pins the specific dashboard palette crash (PLT-052); IT-006 pins the missing
> containment — and stays meaningful after IT-004 is fixed, because it induces a throw
> that is independent of the palette lookup.

## 1. What this checks
A render-time exception in one view must be **contained** — the app shell (top
navigation) survives and a scoped error UI is shown — never blank the entire
application. **Known gap (TEST-GAP-1013 / F-042):** `grep -r "ErrorBoundary|componentDidCatch"
odd-platform-ui/src` returns **zero** hits. With no boundary, a throw propagates to the
React root, unmounts the whole tree, and empties `#root` — the nav, every route, gone.

**Operator-facing consequence if it FAILS:** one malformed/version-skewed API payload,
one out-of-enum value, one unexpected `null` anywhere in the component tree takes down
the *entire* console — the operator can't even navigate away to an unaffected page. A
local data fault becomes a total outage with a blank white screen and no recovery short
of the developer console. Source: F-042 · TEST-GAP-1013 (CRITICAL) · the absent boundary.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres; UI at `http://localhost:18080`). Auto
  bring-up; manually: `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install && npm run browser`. One-time.
- **Trigger — a guaranteed render throw, independent of any one bug's fix:** intercept
  the dashboard JSON and set `tablesDashboard = null`. `DataQualityContent.tsx:55`
  dereferences `data.tablesDashboard.tablesHealth`, so this throws during render
  regardless of the PLT-052 palette fix — isolating the error-boundary contract, not the
  palette bug. (A malformed/partial payload is a realistic backend version-skew, so this
  is a fair, representative fault.)

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- The app shell renders normally first: opening `http://localhost:18080/` shows a
  non-empty `#root` (the spec asserts this baseline before injecting the fault).

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh known-bugs`
  (or `cd integration-tests/e2e && npx playwright test error-boundary-containment`).
- **Manual (human-carryable)**: in the browser devtools, add a Network "local override"
  (or a request-blocking rule) that makes the data-quality dashboard response return
  `"tablesDashboard": null`; then open `http://localhost:18080/data-quality` and observe
  whether the whole page goes blank-white (no nav, no content) or whether the nav chrome
  survives with a contained error.

## 5. What it checks — assertions
- **PASS** when: after the throw, the app shell is intact — `#root` still has content
  (nav chrome + a contained error UI). The fault was caught by an error boundary.
- **FAIL (expected today)** when: `#root` is empty — the entire React tree unmounted and
  the app white-screened, because no error boundary contained the throw.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (#root content length after the fault; baseline length) · notes`.

## Cross-references
- Source: F-042 · TEST-GAP-1013 (CRITICAL) · absent `ErrorBoundary`/`componentDidCatch` in `odd-platform-ui/src`
- Sibling (the instance): **IT-004** — the dashboard palette crash (PLT-052) is one concrete throw this missing boundary fails to contain.
- Plan: `lineage/odd-platform/test-plan.md` batch I9 (UI e2e; TEST-GAP-1013) + the Tier-1 e2e build-out
- Automation: `integration-tests/e2e/specs/error-boundary-containment.spec.ts`
- Fix that flips this GREEN: add a root/route-level `ErrorBoundary` (e.g. `react-error-boundary`) around `<Routes>` so a render throw degrades to a contained error UI; then move IT-006 to `feature-complete`.

---
id: IT-101
title: "The global application toolbar renders its chrome and persists across routes"
gates:
  validates: [F-041]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:application-toolbar.spec.ts"
plan_ref: I9
status: ready
---

# IT-101 — Application Toolbar global chrome (F-041)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Application Toolbar (`AppToolbar.tsx`, mounted exactly once at `App.tsx:56` above
`<Routes>`) renders its parts — the brand block ("Platform", linked to `/`), the 9-tab
primary navigation (Catalog / Directory / Data Quality / Data Modelling / Master Data /
Management / Dictionary / Alerts / Activity), and the user/profile cluster — on every route,
and is a SINGLE global chrome that persists across navigation. If it FAILS, the platform's
most-rendered surface (the chrome every user interaction passes through) is broken — exactly
the class of regression that ships unnoticed because nothing guards it (F-041, 0/13 promises
verified). A corner pin records the DISABLED-mode identity-label behaviour (UC-2). Source:
feature-flow F-041; `components/shared/elements/AppToolbar/*`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED — the running stack default).
- **Auth/config**: DISABLED → `GET /api/identity/whoami` returns the synthetic dummyOwner
  (`username='admin'`), `ownership` null (IdentityController).
- **Seed data**: NONE — the toolbar is chrome; it renders independent of catalog data.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- SPA shell: `curl -sL -o /dev/null -w '%{http_code}' http://localhost:18080/directory` → `200`.

## 4. Run protocol
1. SUCCESS: open `/directory`; wait for `GET /api/identity/whoami`; observe the brand
   ("Platform"), the Catalog/Management/Directory primary-nav tabs (role=tab; Catalog href
   contains `/search`), and the user cluster label.
2. PERSISTENCE: from `/directory`, click the Management tab; assert the URL is `/management`
   and the brand + tabs are still mounted (one global chrome, not re-created per route).
3. CORNER PIN (UC-2): open `/directory`; assert the user cluster renders the literal `admin`
   (the DISABLED dummyOwner username — a GREEN LSN-029 pin, RED when that render changes).

**Automated rail**: `integration-tests/run-suite.sh IT-101` (Playwright `e2e/specs/application-toolbar.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** brand "Platform" link visible; Catalog/Management/Directory tabs visible;
  Catalog tab `href` matches `/search`; user-cluster label visible. (FAIL: any chrome part
  absent → the toolbar did not compose / mount.)
- **PERSISTENCE (PASS):** after navigating to `/management`, the brand + Catalog tab remain
  visible (the same chrome). (FAIL: chrome re-mounts/disappears per route.)
- **CORNER PIN (PASS today):** the user cluster shows `admin` under DISABLED. RED ⇒ the
  DISABLED-mode identity render changed (e.g. gained an anonymous-viewer signal) — re-verdict.

## 6. Result log
- 2026-06-07 — authored; AppToolbar/ToolbarTabs DOM ground-truthed (tabs render role=tab as
  react-router Links; brand is a link "Platform"); 3/3 green via run-suite.sh IT-101 (see run-log/).

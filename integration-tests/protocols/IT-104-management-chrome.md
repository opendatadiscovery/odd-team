---
id: IT-104
title: "The Management chrome renders its tab strip, default-redirects, and routes sub-areas"
gates:
  validates: [F-161]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:management-chrome.spec.ts"
plan_ref: I9
status: ready
---

# IT-104 — Management section top-level chrome (F-161)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Management chrome (`Management.tsx` at `/management/*`) composes the sidebar tab strip
(`ManagementTabs.tsx` — 9 tabs) + the content pane (`ManagementRoutes.tsx`). Bare `/management`
redirects to `/management/namespaces` (`ManagementRoutes.tsx:151`), and clicking a sidebar tab
routes to that sub-area + swaps the pane. This protocol confirms the default redirect (H-005)
and tab navigation (H-006), and CHARACTERIZES the recon posture (H-001 — every admin tab label
is advertised to the viewer). The chrome is the mount for nine admin surfaces yet has 0/11
promises verified. Source: feature-flow + reflection F-161; `components/Management/*`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED).
- **Auth/config**: DISABLED — the dummy principal resolves `OWNER_ASSOCIATION_MANAGE` as
  granted (DOM-probed), so ALL nine sidebar tabs render, incl. the conditionally-hidden
  Associations tab.
- **Seed data**: NONE — the assertions are on the chrome (tab strip + routing + active-tab
  selection), which render independent of seeded namespaces/owners.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- SPA shell: `curl -sL -o /dev/null -w '%{http_code}' http://localhost:18080/management` → `200`.

## 4. Run protocol
1. SUCCESS (H-005): open `/management`; observe the redirect to `/management/namespaces`, the
   sidebar tabs (Namespaces / Datasources / Owners / Tags / Roles / Policies) rendered, and the
   Namespaces tab `aria-selected='true'` (default sub-area mounted).
2. NAV (H-006): click the Owners sidebar tab; observe the URL becomes `/management/owners`,
   Owners becomes `aria-selected='true'`, and Namespaces is no longer selected (pane swapped).
3. CORNER PIN (H-001): on `/management/namespaces`, observe the privileged Policies + Roles
   admin tabs are advertised (visible), and Associations is visible on the DISABLED stack.

**Automated rail**: `integration-tests/run-suite.sh IT-104` (Playwright `e2e/specs/management-chrome.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** bare `/management` → `/management/namespaces`; the six checked sidebar
  tabs are visible; Namespaces is the selected tab. (FAIL: no redirect / missing tabs → the
  chrome did not compose.)
- **NAV (PASS):** clicking Owners routes to `/management/owners` and selects the Owners tab.
  (FAIL: URL/selection unchanged → the sub-nav is broken.)
- **CORNER PIN (PASS today):** Policies + Roles + Associations tabs are advertised in the
  sidebar. RED ⇒ the visibility model stopped advertising an admin surface; re-verdict F-161 H-001.

## 6. Result log
- 2026-06-07 — authored; Management chrome DOM-probed (bare /management → namespaces; all 9
  sidebar tabs render under DISABLED; tabs are role=tab); 3/3 green via run-suite.sh IT-104 (see run-log/).

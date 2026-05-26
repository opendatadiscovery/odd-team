## STRENGTHENS — Batch ZJ (2026-05-26 — AppErrorPage primary-source sidecar reveals the STRUCTURAL ROOT CAUSE: no `<Route path='*'>` catch-all anywhere in App.tsx, no React error boundary, AppErrorPage is per-page-component-owned)

Prior REFACTOR-670 framed the bare `/terms` blank-page defect as a pillar-specific routing-fallback gap. Batch ZJ's AppErrorPage primary-source sidecar surfaces the structural root cause: AppErrorPage is NOT mounted on a `path='*'` catch-all, AppErrorPage is NOT a React error boundary, the entire platform UI has NO error boundary anywhere, and AppErrorPage's scope is ONLY async-thunk-rejection paths — NOT route-fallthrough.

**New surfaced_by entry**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "Bare `/terms`, `/master-data`, and any other URL not matched by `App.tsx`'s route table produces a BLANK PAGE — AppErrorPage is NOT mounted on a `path='*'` catch-all. App.tsx:59-89 declares exactly 11 `<Route>` entries; none has `path='*'`. React-Router-DOM v6's NO-MATCH behaviour is to render nothing inside `<Routes>`. The AppToolbar (line 56) still renders, but the route-body area is empty. ... Cross-batch finding: this is the structural root cause of the ZH+ZI bare-page observations. A 5-line fix (add `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}} />} />` to `App.tsx:89`) would route ALL fall-through to this widget."

**What this strengthening adds**: the prior framing treated each bare-pillar-URL gap (REFACTOR-669 master-data, REFACTOR-670 terms) as a per-pillar defect. Batch ZJ reveals that BOTH are downstream symptoms of the SAME structural absence in App.tsx — there is no `<Route path='*'>` catch-all, and AppErrorPage isn't wired as the global fallback. The 5-line fix at App.tsx:89 would close BOTH defects simultaneously AND would catch every future unknown-URL navigation (typos in shared links, deleted feature URLs, deep-link migrations not yet handled).

The per-pillar fixes (REFACTOR-669's `<Navigate>` redirect for /master-data; REFACTOR-670's Pattern A index route for /terms) remain valid as fine-grained UX improvements (e.g. /master-data should redirect to /master-data/lookup-tables, not show a generic 404), but they are LOCAL fixes — the global catch-all is the structural fix.

**Note: the structural absence is now tracked as REFACTOR-686 NEW this batch** — a separate scope for "no path='*' catch-all in App.tsx" as a stand-alone refactoring item, paired with REFACTOR-685 NEW this batch ("no React error boundary anywhere").

**Triangulation count after ZJ**: 3 sidecars (was 2 — terms route + masterData route; ZJ adds AppErrorPage primary-source).

**Severity unchanged**: MEDIUM. The structural framing doesn't change the per-pillar severity; both the global and the per-pillar fixes are MEDIUM individually.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-669 (sibling bare-master-data blank), REFACTOR-685 NEW this batch (no React error boundary — the structural cousin of no-catch-all), REFACTOR-686 NEW this batch (the standalone no-path='*' scope), ADR-CANDIDATE-227 (bare base URL redirects to canonical first tab — the ADR this defect violates).
- SUPERSEDES: none.
- CONFLICTS: none.

---

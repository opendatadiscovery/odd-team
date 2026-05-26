## STRENGTHENS — Batch ZJ (2026-05-26 — same structural root cause as REFACTOR-670)

Prior REFACTOR-669 framed the bare `/master-data` dead-end as a missing parent-route declaration. Batch ZJ's AppErrorPage primary-source sidecar surfaces the broader structural root cause: there is NO `<Route path='*'>` catch-all in App.tsx and NO React error boundary anywhere in `odd-platform-ui/src`. Even if the maintainer adds `<Route path='/master-data'>` with a `<Navigate>` redirect (per REFACTOR-669's proposed remedy), the broader class — typing ANY unknown URL — would still blank-page.

**New surfaced_by entry**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "Bare `/terms`, `/master-data`, and any other URL not matched by `App.tsx`'s route table produces a BLANK PAGE — AppErrorPage is NOT mounted on a `path='*'` catch-all. App.tsx:59-89 declares exactly 11 `<Route>` entries; none has `path='*'`. ... A 5-line fix (add `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}} />} />` to `App.tsx:89`) would route ALL fall-through to this widget."

**What this strengthening adds**: same as REFACTOR-670's strengthen — the per-pillar fix (REFACTOR-669's `<Navigate>` redirect to `/master-data/lookup-tables`) remains valid as a UX improvement, but the structural global fix (REFACTOR-686 NEW this batch — add `path='*'` catch-all) closes the broader class.

**Triangulation count after ZJ**: 3 sidecars (was 2 — masterData route + WebFetch; ZJ adds AppErrorPage primary-source).

**Severity unchanged**: MEDIUM.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-670 (sibling bare-terms blank), REFACTOR-685 NEW this batch (no React error boundary), REFACTOR-686 NEW this batch (the standalone no-path='*' scope), ADR-CANDIDATE-227 (bare base URL redirects).
- SUPERSEDES: none.
- CONFLICTS: none.

---

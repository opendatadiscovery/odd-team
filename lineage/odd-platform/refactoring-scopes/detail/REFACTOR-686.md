## REFACTOR-686 — NO `<Route path='*'>` catch-all in `App.tsx` — every unmatched URL (typos in shared links, deleted feature URLs, deep-link migrations) produces a BLANK page below the toolbar; AppErrorPage is per-page-component-owned and CANNOT serve as global fallback without mounting

**Severity**: MEDIUM
**Category**: missing-route-fallback / structural-absence
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — every URL the operator might mistype or migrate falls into this gap]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "**Bare `/terms`, `/master-data`, and any other URL not matched by `App.tsx`'s route table produces a BLANK PAGE — AppErrorPage is NOT mounted on a `path='*'` catch-all.** `App.tsx:59-89` declares exactly 11 `<Route>` entries; none has `path='*'`. React-Router-DOM v6's NO-MATCH behaviour is to render nothing inside `<Routes>`. The AppToolbar (line 56) still renders, but the route-body area is empty. Operator-facing impact: hitting any unknown URL — including the documented-elsewhere shape `/terms` (the parent route exists but has only a `:termId/*` child, no `index` route — `App.tsx:66-68`) and `/master-data` (no parent route exists — `lookupTablesPath()` returns `/master-data/lookup-tables` only — `routes/masterDataRoutes.ts:1-4`) — shows the user a blank pane below the toolbar with no error message, no '404' code, no Home Page link. Cross-batch finding: this is the structural root cause of the ZH+ZI bare-page observations. A 5-line fix (add `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}} />} />` to `App.tsx:89`) would route ALL fall-through to this widget."

**Statement**: `App.tsx:59-89` declares 11 `<Route>` entries; NONE has `path='*'` (the React-Router-DOM v6 convention for "match-all"). NO `<Routes>` block has a `<Route index>` fallback at the top level. Result: every URL not matched by the 11 explicit routes produces a blank below-toolbar pane. The user sees the toolbar (with the brand block + 9 tabs + info icon + user dropdown) but no content body, no error, no '404' indicator, no redirect to home.

Two specific instances are already tracked (REFACTOR-669 master-data; REFACTOR-670 terms); this refactor is the STRUCTURAL ROOT — even after fixing those two pillars individually with `<Navigate>` redirects, the broader class (any other unknown URL) would still blank-page.

Concrete failure modes:
1. **Operator types a URL from memory** — e.g. `/owners` (no such top-level route; the closest is `/management/owners`). Blank page.
2. **Stale bookmark from a renamed route** — e.g. an operator who bookmarked `/dataentities` (the legacy short form) but the current code uses `/dataentities/:id/*`. The bare `/dataentities` bookmark may match the parent and blank-page (depends on the exact route shape).
3. **Deep link sent by a colleague with a typo** — `slack: 'check this https://odd.example/data-quailty (sic)'`. Blank page; the operator can't tell whether the URL is wrong or the platform is broken.
4. **Asset migrations during deployment** — if a feature URL is migrated (e.g. `/old-feature` → `/new-feature`) without a server-side or client-side redirect, every bookmark hits the blank.
5. **The compound case with REFACTOR-685 NEW this batch** — even WITH a route match, an uncaught render error blanks the page; the user can't distinguish "wrong URL" from "broken feature".

**Evidence**:
- App.tsx:59-89 (11 `<Route>` entries; verified absent `path='*'`)
- routes/termsRoutes.ts:21-23 + App.tsx:66-68 (the bare `/terms` parent-with-only-child shape, captured by REFACTOR-670)
- routes/masterDataRoutes.ts:1-4 (no parent route, captured by REFACTOR-669)
- AppErrorPage.tsx (the widget that SHOULD be the catch-all target — exists, but unwired at the global level)
- Grep `path=['\"]\\*['\"]|NotFound|Page404|404Page|NoMatch` over `odd-platform-ui/src` returns NO matches.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-227 (bare base URL redirects to canonical first tab) prescribes the pillar-specific redirect pattern (e.g. `/master-data` → `/master-data/lookup-tables`); this refactor is the GLOBAL FALLBACK that catches everything ADR-227 doesn't enumerate. The two compose: ADR-227 closes the known pillar-bare-URL gaps cleanly (each pillar gets a meaningful redirect); the catch-all closes everything else with a "Page Not Found" surface.

**Proposed remedy**: Add ONE `<Route path='*'>` entry at the end of the `<Routes>` block in `App.tsx`. The fallback element is AppErrorPage rendered with a synthetic 404 error:

```tsx
<Route
  path="*"
  element={
    <AppErrorPage
      showError
      error={{ status: 404, statusText: 'Page Not Found', url: '', message: '' }}
    />
  }
/>
```

— this reuses the existing widget; no new component; no new infrastructure; ONE line of meaningful diff. Composes with REFACTOR-685 NEW (the error boundary) — the boundary catches synchronous throws; the catch-all catches URL fall-through; together they close the "blank page" class.

**Severity rationale**: MEDIUM — operator-experience gap; not data loss, not security exposure; bounded by frequency (typo URLs, stale bookmarks). Same severity as REFACTOR-669/670 individually; the structural framing doesn't change the per-instance severity but does change the proposed remedy scope (one global fix vs N per-pillar fixes).

**Suggested backlog grouping**: `UI architecture hardening sprint` — paired with REFACTOR-685 NEW (error boundary). The two-task batch is a 1-3 hour change closing a class of operator-facing surprises.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-669 (master-data bare URL), REFACTOR-670 (terms bare URL), REFACTOR-685 NEW (error boundary — the same structural-absence class at the synchronous-throw layer), ADR-CANDIDATE-227 (bare base URL redirects — composes for pillar-specific redirects).
- SUPERSEDES: none.
- CONFLICTS: none.

---

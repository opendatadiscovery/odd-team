## REFACTOR-695 — `ToolbarTabs.tsx:100-104` uses `pathname.includes(tab.value)` (substring match) to determine the selected tab — fragile-by-design; a future route like `/management-history` would silently select the Management tab; renaming a `routes/*.ts` literal without updating the matching `value` literal silently breaks tab highlighting

**Severity**: MEDIUM
**Category**: fragile-heuristic / substring-match-instead-of-prefix / coupling-by-string
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-08 Operator Experience — tab selectedness is a navigation affordance]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[2]` (MEDIUM) — "Selected-tab heuristic uses `pathname.includes(tab.value)` — a substring match, not an exact-prefix match. With the current `tab.value` corpus the heuristic happens to be unambiguous, but this is fragile-by-design: a future route like `/management-history` or `/data-quality-old` could silently match the wrong tab. Also fragile: if a `routes/*.ts` helper is renamed (e.g. `/master-data` → `/reference-data`) without updating the `value: 'master-data'` literal at ToolbarTabs.tsx:58, the tab silently stops highlighting and no test catches it."

**Statement**: `ToolbarTabs.tsx:100-104` resolves selected-tab from the current URL via `pathname.includes(tab.value)`. The `tab.value` per tab is a hand-picked discriminator string (`'directory'`, `'data-quality'`, `'data-modelling'`, `'master-data'`, `'management'`, `'termsearch'`, `'alerts'`, `'activity'`) that happens to be a substring of each corresponding route in the current code. The discriminator is hand-coupled to the route module's URL literals; there is no compile-time verification that they match.

The substring-match heuristic has TWO fragility surfaces:

**Surface 1 — Future-route collision**: a new route literal containing one of the existing discriminator substrings would silently match the WRONG tab. Examples:
- `/management-history` (a hypothetical future audit-log feature) → `pathname.includes('management')` → TRUE → Management tab incorrectly highlights.
- `/data-quality-old` (a transition URL during migration) → matches Data Quality tab.
- `/activity-summary` (a hypothetical Activity Feed companion) → matches Activity tab.

Today the route corpus avoids these collisions by accident; tomorrow a new feature URL could break tab selectedness without anyone noticing.

**Surface 2 — Route-rename desync**: if a `routes/*.ts` helper is renamed (e.g. `/master-data` → `/reference-data` in a pillar-rename refactor) WITHOUT updating the matching `value: 'master-data'` literal at ToolbarTabs.tsx:58, the tab silently stops highlighting. Specifically:
- The Catalog tab uses `value: undefined` (it has no value; selectedness is determined via `searchPath/dataEntitiesPath` substring match in lines 92-98 — a dedicated special-case branch, robust by being special-cased).
- Every other tab couples its `value` literal to a substring of its destination route. If the route module renames its literal, the toolbar's `value` literal doesn't auto-update — the maintainer must remember to grep+edit.

There is NO test asserting that for each route `routes/*.ts` produces, the corresponding ToolbarTabs `value` is a substring of it. The desync risk is purely "did the contributor remember".

**Operator-visible impact**:
- Subtle: a tab is selected (highlighted in the toolbar) but the user is on a route that doesn't match. The tab selectedness UX becomes a guess rather than a reliable indicator.
- More subtle: NO tab is selected (the substring check returns -1) even though the user IS on a valid route. The toolbar shows no selected tab — the user is confused about where they are.

**Evidence**:
- ToolbarTabs.tsx:100-104 (`tab.value && pathname.includes(tab.value)`)
- ToolbarTabs.tsx:42-79 (the `value` literals coupled to route substrings — `'directory'`, `'data-quality'`, etc.)
- ToolbarTabs.tsx:92-98 (the Catalog special-case using `matchPath` — the ROBUST pattern that the other 7 tabs do not follow)
- routes/managementRoutes.ts (and the other route modules) — produce URL constants that the discriminators must stay in sync with.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-228 (per-pillar `routes/{pillar}*.ts` module with path-builder functions) is the routing-architecture anchor; the path-builders return URL constants that the discriminators SHOULD reference rather than hand-coupling. The fix path aligns with extending ADR-228's convention to route-discrimination.

**Proposed remedy**: Replace `pathname.includes(tab.value)` with `matchPath` per-tab — the same pattern already used for the Catalog tab special-case (lines 92-98). The shape:

```tsx
// Per-tab selectedness using matchPath (react-router-dom v6 API):
const tabSelectedPredicates = useMemo(() => [
  // [0] Catalog — special case (the searchPath OR dataEntitiesPath family)
  (pathname: string) => matchPath(`${searchPath()}/*`, pathname) || matchPath(`${dataEntitiesPath()}/*`, pathname),
  // [1] Directory
  (pathname: string) => matchPath(`${directoryPath()}/*`, pathname),
  // [2] Data Quality
  (pathname: string) => matchPath(`${dataQualityPath()}/*`, pathname),
  // [3] Data Modelling — match ANY data-modelling sub-route
  (pathname: string) => matchPath(`${dataModellingPath()}/*`, pathname),
  // ... etc per tab ...
], []);

useEffect(() => {
  if (matchPath('/', pathname)) {
    setSelectedTab(-1);
    return;
  }
  const idx = tabSelectedPredicates.findIndex((predicate) => predicate(pathname));
  setSelectedTab(idx);
}, [pathname, tabSelectedPredicates]);
```

This replaces the substring heuristic with PREFIX matching anchored at the path-builder output. Renaming the path-builder propagates automatically to the predicate (because the predicate references the builder, not a string literal). New routes with overlapping substrings no longer collide. Effort: 1-2 hours for the refactor + a unit test pinning the per-tab matchPath behaviour.

**Severity rationale**: MEDIUM — fragility surface affecting tab selectedness UX across every navigation. Bounded today (no current route triggers a collision), but every new feature URL is a potential silent breaker. Not HIGH because the consequence is UX confusion (wrong tab highlighted), not functional breakage. Not LOW because the substring-match shape is a known anti-pattern and the codebase already has the robust alternative (matchPath) used elsewhere.

**Suggested backlog grouping**: `UI architecture hardening sprint` — couple with REFACTOR-694 NEW (silent thunk rejection), REFACTOR-685 NEW (no error boundary), REFACTOR-686 NEW (no path='*' catch-all). The four together close ToolbarTabs / App.tsx structural weakness.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-228 (per-pillar route modules — the path-builder convention this refactor extends to selectedness); ADR-CANDIDATE-235 NEW (the 9 hard-coded tabs — context).
- SUPERSEDES: none.
- CONFLICTS: none.

---

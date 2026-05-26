## REFACTOR-669 — Bare `/master-data` URL is a dead-end: no `<Route path='/master-data'>` parent is declared in App.tsx, no fallback, no `<Navigate>` redirect to the only sub-route — operator typing or bookmarking `/master-data` lands on a blank content area beneath the toolbar with no error message and no recovery affordance

**Severity**: MEDIUM
**Category**: missing-route-fallback / deep-link-broken / convention-violation-ADR-227
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-03 Master Data Management]

**Surfaced by**:
- `masterData.md:bugs_limitations_corner_cases[0]` (LOW from sidecar; promoted to MEDIUM here for cross-batch reach) — "Visiting `/master-data` directly (no nested path) produces no `<Route>` match — react-router renders nothing and there is no fallback / no redirect to `/master-data/lookup-tables`. The toolbar tab uses `lookupTablesPath()` so users following the UI never hit this, but a bookmark / hand-typed URL on `/master-data` lands on a blank content area."
- `masterData.md:stress_findings.name_behavior_pairs.[BASE_PATH master-data root]` — "BASE_PATH is declared but never exported and never mounted as a route in App.tsx. Visiting `/master-data` (without `/lookup-tables` suffix) does not match any `<Route>` and renders nothing." DRIFT_MINOR.
- `masterData.md:stress_findings.request_inputs[0]` (TRANSLATES_SILENTLY) — "The constant's name (BASE_PATH) suggests a usable root, but visiting `/master-data` doesn't match any `<Route>` and renders nothing. The 'master data' base is an in-code organisational marker that has no corresponding URL surface."
- `masterData.md:bugs_limitations_corner_cases[2]` — "The selected-tab logic in ToolbarTabs uses `pathname.includes('master-data')` (`ToolbarTabs.tsx:101`). Both `/master-data` (no match — see above) and `/master-data/lookup-tables` (real route) light up the Master Data tab as selected." → the toolbar tab lights up as selected but the content area is BLANK — operator-confusing dual state.

**Statement**: `masterDataRoutes.ts:1-5` declares a file-private `BASE_PATH = '/master-data'` constant used to construct `lookupTablesPath() → '/master-data/lookup-tables'`. App.tsx:60-89 declares `<Route path={lookupTablesPath()} ...>` (i.e., a route at `/master-data/lookup-tables`) but **does NOT declare a `<Route path='/master-data'>` parent**, does NOT add a `<Route path='*'>` wildcard fallback, and does NOT mount a `<Navigate to='lookup-tables' replace />` redirect on the base path. Visiting `/master-data` produces NO React Router match — the `<Routes>` block falls through with no `<Route>` element to render → React Router renders nothing in the content area.

The toolbar tab lights up as selected (because `ToolbarTabs.tsx:101` uses substring match `pathname.includes('master-data')`) but the content area is blank. The operator sees the toolbar saying "Master Data" is the current section while the page beneath is empty. No error, no message, no path to recovery.

This is a deep-link / bookmark hazard. Operators following the toolbar tab navigate to `lookupTablesPath()` directly (not the bare URL), so the common path doesn't hit this. The bad path: any external link, stale bookmark, email reference, or hand-typed `/master-data` URL.

The fix is one of three patterns, per **ADR-CANDIDATE-227** (NEW this batch — bare base URL redirects to canonical first tab):
1. Add `<Route path='/master-data' element={<Navigate to='lookup-tables' replace />} />` — the dataModelling / management / alerts convention.
2. Convert the route to a nested layout: `<Route path={masterDataPath()}><Route index element={<Navigate to='lookup-tables' replace />} /><Route path='lookup-tables' element={<LookupTables />} /></Route>` — the React Router v6 recommended pattern.
3. Add a wildcard fallback at the `<Routes>` root level (e.g., `<Route path='*' element={<NotFoundPage />} />`) — broader fix that catches all unmounted URLs.

Pattern 1 is the cheapest and aligns with the existing convention (3 confirming pillars per ADR-CANDIDATE-227). Pattern 2 is the most idiomatic for React Router v6 and removes the duplication of the `/master-data` prefix. Pattern 3 is orthogonal but composes (every unmounted URL is a NotFound, including this one).

**Evidence**:
- `masterDataRoutes.ts:1-5` (declares BASE_PATH; not exported; no helper for the bare base; no `masterDataPath()` builder)
- `App.tsx:60-89` (no `<Route path='/master-data'>` parent and no wildcard fallback)
- `ToolbarTabs.tsx:100-104` (substring match for selected-tab indicator)
- Grep over `odd-platform-ui/src` for `'/master-data'` (2026-05-26): matches in `masterDataRoutes.ts` only — no consumer hard-codes the literal, no consumer NAVIGATES to bare `/master-data`

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-227** (NEW this batch) codifies the bare-base-URL-redirects-to-first-tab convention; THIS scope is the master-data violation.
- ADR-CANDIDATE-228 (NEW this batch) codifies the per-pillar single-file URL-shape convention; `masterDataRoutes.ts` is conformant — the absence of a `masterDataPath()` builder + the absence of the route mount is the gap.

**Proposed remedy**: Apply Pattern 1 from above — add `<Route path='/master-data' element={<Navigate to={lookupTablesPath()} replace />} />` to `App.tsx`. One-line fix, no UX change for the common path, fixes the bookmark/deep-link hazard.

The route module `masterDataRoutes.ts` MAY also gain an exported `masterDataPath()` builder (zero-arg, returns `BASE_PATH`) per ADR-CANDIDATE-228 for symmetry with `termsPath()` (which exists ONLY to keep the route mount and the prefix in lock-step — see terms.md:implicit_adrs[1]). That part is cosmetic.

**Severity rationale**: MEDIUM — operator-confusing dead-end; common path unaffected; bad path silently broken; fix is one line. Not HIGH because no data loss / no security exposure / no audit-misleading shape. Not LOW because the toolbar-tab-says-selected + content-area-blank combination is a real operator dead-end with no recovery affordance.

**Suggested backlog grouping**: `URL-shape architecture codification` (composes with ADR-CANDIDATE-227 promotion).

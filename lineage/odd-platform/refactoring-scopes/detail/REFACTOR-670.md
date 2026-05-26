## REFACTOR-670 — Bare `/terms` URL renders blank: `<Route path={termsPath()}>` at `App.tsx:66` is declared as a parent route with one child `:termId/*` and NO `index` route, NO `element` prop, NO `<Navigate>` fallback — React Router matches the parent but has no element to render → operator types `/terms` and sees a blank content area beneath the toolbar (anti-pattern violation of ADR-CANDIDATE-227)

**Severity**: MEDIUM
**Category**: missing-route-fallback / deep-link-broken / convention-violation-ADR-227 / Category-B-name-vs-behaviour
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-06 Data Glossary]

**Surfaced by**:
- `terms.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "**Visiting bare `/terms` renders a blank page.** App.tsx:66 declares `<Route path={termsPath()}>` as a parent with one child route (`:termId/*`) and NO `index` route, NO `element` prop on the parent itself, NO `Navigate` fallback. React Router matches the parent but has nothing to render — the operator sees an empty page beneath the toolbar with no error message and no redirect. Compare App.tsx:63 (`/termsearch/*` self-renders TermSearch). The Dictionary tab in ToolbarTabs.tsx:67 navigates to `/termsearch`, NOT `/terms`, so the user never reaches `/terms` via normal navigation — but typing it in the address bar, sharing a stale link, or any code path that calls `termsPath()` and navigates produces the dead-end. Live doc (Business Glossary, WebFetched 2026-05-26) implies a list view exists at the Dictionary tab; if a maintainer/operator deduces 'maybe it's at /terms' from `termsPath` they get a blank page. **Pinned by P-164**."
- `terms.md:stress_findings.name_behavior_pairs.[termsPath()]` DRIFT_NAME_VS_BEHAVIOR — "Returns the bare string `/terms`. The ONLY consumer is App.tsx:66, which mounts it as a parent route with NO element and NO index route — the URL renders a blank page. The Dictionary tab in ToolbarTabs.tsx:67 navigates to `termsSearchPath()` (i.e. `/termsearch`), NOT `termsPath()`. No code path navigates to `/terms` directly."
- `terms.md:probes_emitted.P-164` (PROBE pending) — "Visiting bare `/terms` in the running SPA — what does the user see? Blank, redirect, error, or empty-list page?"

**Statement**: `termsRoutes.ts:21-23` declares `termsPath()` returning `'/terms'`. `App.tsx:66-68` mounts the route as:

```tsx
<Route path={termsPath()}>
  <Route path=':termId/*' element={<TermDetails />} />
</Route>
```

This is a parent route with ONE child route `:termId/*` and NO `index` route, NO `element` prop on the parent. Per React Router v6 semantics, the parent route MATCHES the URL `/terms`, but because there is no `index` route and no `element` on the parent, the parent's `<Outlet>` has no child to render — the result is a blank content area beneath the toolbar.

Compare the sibling pattern at `App.tsx:63`: `<Route path={`${termsSearchPath()}/*`} element={<TermSearch />} />` — a self-rendering route with an explicit `element`. The terms parent route ALSO needs either:
- An `index` route declaration: `<Route index element={<Navigate to='/termsearch' replace />} />` (or to a hypothetical `/terms/all` list page if one is later added), OR
- An `element` prop on the parent declaring a default page

The Dictionary tab in `ToolbarTabs.tsx:67` navigates to `termsSearchPath()` (`/termsearch`), NOT `termsPath()`, so the COMMON path bypasses the bare URL. The bad paths:
1. **Operator types `/terms` in the address bar** — blank page; toolbar tab "Dictionary" lights up as selected (substring matcher in ToolbarTabs.tsx) but content is empty.
2. **Stale bookmark / shared link of `/terms`** — same blank page.
3. **External email reference / external doc linking `/terms`** — same.
4. **A future code change that calls `navigate(termsPath())`** — would silently land on the blank page; the type system doesn't help because `termsPath()` returns a string.
5. **A maintainer deducing "maybe the terms list is at /terms" from the existence of `termsPath()`** — particularly likely because the live Business Glossary doc (`https://docs.opendatadiscovery.org/features/data-glossary/business-glossary`, WebFetched 2026-05-26) says "The Dictionary tab is the catalog-wide list of all terms in the platform" — implying a LIST surface, which `termsPath()` would naively be assumed to be.

The convention violation IS the same shape as REFACTOR-669 (master-data) but with a DIFFERENT cause: master-data has no parent route at all; terms has a parent route with no fallback. Both are deep-link / bookmark hazards; both violate ADR-CANDIDATE-227 (NEW this batch — bare base URL redirects to canonical first tab).

The Category-B framing (per `terms.md:stress_findings.name_behavior_pairs`): the function name `termsPath()` PROMISES the URL for the Terms feature (implied: a navigable surface, e.g. a terms list); the implementation returns `/terms` which mounts a blank parent route. The promise + implementation diverge — the function's caller cannot infer "this URL renders nothing" from the function's name.

**Evidence**:
- `termsRoutes.ts:4` (`BASE_PATH = '/terms'`)
- `termsRoutes.ts:21-23` (`termsPath()` returns `BASE_PATH`)
- `App.tsx:66-68` (parent route with one child, no index, no element)
- `ToolbarTabs.tsx:67` (Dictionary tab → `termsSearchPath()`, NOT `termsPath()`)
- `App.tsx:63` (the CORRECT shape — `<Route path='${termsSearchPath()}/*' element={<TermSearch />} />`)
- WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (2026-05-26 status 200) — implies a list surface at the Dictionary tab; reader could deduce `/terms` exists
- Grep `termsPath()` in `odd-platform-ui/src` — exactly 2 occurrences: the declaration (`termsRoutes.ts:21-23`) and the App.tsx mount (line 66). NO code path NAVIGATES to bare `/terms`. The function exists ONLY to keep the App.tsx mount and `termDetailsPath` prefix in lock-step (per terms.md:implicit_adrs[1]).

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-227** (NEW this batch) codifies the bare-base-URL-redirects-to-first-tab convention; THIS scope is the terms violation.
- **REFACTOR-671** (NEW this batch — Dictionary tab "list" vs "search" doc-vs-code drift) is the doc-side companion; if `/terms` were a proper list surface (per the doc's mental model), the bare-URL redirect would target that list page; today the redirect target is `/termsearch`.

**Proposed remedy**: One-line fix at `App.tsx:66-68`. Two viable patterns:

**Pattern A (minimal — match the existing TermSearch path)**:
```tsx
<Route path={termsPath()}>
  <Route index element={<Navigate to={termsSearchPath()} replace />} />
  <Route path=':termId/*' element={<TermDetails />} />
</Route>
```
The bare `/terms` URL redirects to `/termsearch` (the current Dictionary destination). Aligns with the existing toolbar tab behaviour. Cheap; no UX change for the common path.

**Pattern B (more idiomatic but adds an empty-state page)**:
```tsx
<Route path={termsPath()}>
  <Route index element={<TermsLandingPage />} />
  <Route path=':termId/*' element={<TermDetails />} />
</Route>
```
A dedicated landing page (could match the doc's "list of all terms" mental model — see REFACTOR-671). More work; closes the doc-drift gap simultaneously.

Pattern A is the cheaper fix. Pattern B requires authoring the landing page + composes with the doc-drift refactor.

The route module `termsRoutes.ts` does NOT need changes; the route mount is the locus.

**Severity rationale**: MEDIUM — operator-confusing dead-end; common path unaffected; bad path silently broken; fix is 1-2 lines. Identical shape to REFACTOR-669 (master-data) and ranked the same. Not HIGH because no data loss / no security exposure / no audit-misleading. Not LOW because the toolbar-tab-says-selected + content-blank dual state is a real recovery-broken hazard.

**Suggested backlog grouping**: `URL-shape architecture codification` (composes with REFACTOR-669 + ADR-CANDIDATE-227 + REFACTOR-671 doc-drift).

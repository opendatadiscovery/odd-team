## REFACTOR-684 — Three route-module cosmetic gaps in single batch: (a) `/search/*` wildcard mount is broader than necessary — Search subtree has no nested routes; (b) `URLSearchParams` exported constant in `queryExamplesRoutes.ts` shadows the global Web Platform `URLSearchParams` class; (c) `size: 30` page-size hard-coded at `Relationships.tsx:23` with no URL parameter or runtime tunable

**Severity**: LOW
**Category**: cosmetic-route-shape / naming-collision / tunable-not-exposed
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery, P-02 Data Modelling]

**Surfaced by**:
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[4]` (LOW) — "**The `/*` wildcard at App.tsx:61 (`searchPath() + '/*'`) is broader than necessary.** The Search component tree has no nested routes — the wildcard could be `/search/:searchId?` (optional param) instead. The wildcard accepts `/search/anything/nested/garbage` and renders `<Search/>` with `useParams()` returning `{searchId: 'anything'}` (only the FIRST segment captured by React-Router 6's wildcard semantics). This is harmless today but invites future drift."
- `odd-platform__ts__routes__route__queryExamples.md:bugs_limitations_corner_cases[3]` (LOW) — "**`URLSearchParams` shadows the global Web Platform `URLSearchParams` class**: the file declares `export const URLSearchParams = { QUERY_SEARCH_ID: 'querySearchId' } as const` (lines 5-7). The global `window.URLSearchParams` is the constructor for the URL-search-params API used throughout the SPA. A module that imports BOTH this constant and the global by name would shadow one — but TypeScript module scoping means the import wins. A reader scanning the file may briefly believe `URLSearchParams` refers to the platform API; only the type definition resolves the ambiguity."
- `odd-platform__ts__routes__route__relationships.md:bugs_limitations_corner_cases[2]` (LOW) — "**`size: 30` is hard-coded at `Relationships.tsx:23`** — no URL parameter, no user-configurable control. A power-user on a large catalog cannot increase page size to reduce scroll fatigue, and a small-catalog operator cannot decrease it for visual density."

**Description**: Three independent low-severity cosmetic / quality-of-implementation gaps surfaced across the batch ZI route sidecars. Grouped here because each is too small to justify its own scope but together they represent a pattern of route-module micro-fragility.

**Gap A — `/search/*` wildcard mount is too permissive**:
The route declaration at `App.tsx:61` is `<Route path={\`${searchPath()}/*\`} element={<Search/>}/>` — the trailing `/*` makes React Router accept any URL starting with `/search/`. The Search component tree has no nested routes. Concrete consequences:
- `/search/abc/def/ghi/garbage` ALL render `<Search/>` (React Router treats `abc` as `:searchId`, ignores the rest).
- A future developer adding a nested route under Search may not realise the wildcard already matched everything; the new nested route may silently not fire.

The narrower form `/search/:searchId?` (optional path-param) would express the actual intent. The `/*` form is more permissive than needed.

**Gap B — `URLSearchParams` naming collision**:
The constant at `queryExamplesRoutes.ts:5-7` is:
```typescript
export const URLSearchParams = {
  QUERY_SEARCH_ID: 'querySearchId',
} as const;
```

The name `URLSearchParams` is the same as the global Web Platform `URLSearchParams` constructor used throughout the SPA (the standard Web URL API). A reader scanning the file may briefly think the export wraps the platform API. TypeScript module-scoping resolves the ambiguity (the local import wins inside the module that imports it; the global wins where the import isn't present), but the naming is unconventional.

Renaming to e.g. `QueryExamplesURLParams` or `QueryExamplesSearchParams` would eliminate the collision.

**Gap C — `size: 30` hard-coded**:
At `Relationships.tsx:23` the page-size for the Relationships list is hard-coded at 30. No URL parameter, no user-configurable control. A power-user on a large catalog cannot increase the page size; a small-catalog operator cannot decrease it. The Activity, Catalog, and other list pages have similar hard-coded sizes (per their respective sidecars) — the pattern is system-wide; this is just the relationships instance.

**Why all three are LOW**:
- Gap A is harmless today; latent for future nested-route drift.
- Gap B is harmless (module scoping resolves it); cosmetic.
- Gap C is a UX gap with no functional broken-ness — operators can scroll; just less ergonomic.

**Evidence**:
- `odd-platform-ui/src/components/App.tsx:61` (the wildcard mount)
- `odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:5-7` (the shadowing constant)
- `odd-platform-ui/src/components/DataModelling/Relationships.tsx:23` (the hard-coded size)

**Existing-ADR-or-implied-prescription**: no governing ADRs; each gap is a local code-cleanup item.

**Proposed remedy**:

**Fix A — Narrow the wildcard**:
```tsx
<Route path={searchPath() + '/:searchId?'} element={<Search/>} />
```
or more explicitly:
```tsx
<Route path={searchPath()} element={<Search/>} />
<Route path={`${searchPath()}/:searchId`} element={<Search/>} />
```

**Fix B — Rename the constant**:
```typescript
export const QueryExamplesURLParams = {
  QUERY_SEARCH_ID: 'querySearchId',
} as const;
```
Update the one consumer (`useCreateQueryExampleSearch.ts`).

**Fix C — Make page size operator-tunable**:
Path 1 (URL parameter): `?size=50` on the URL; `useSearchParams` reads it; defaults to 30.
Path 2 (page-size selector): UI dropdown — 10 / 30 / 50 / 100; writes to URL.
Path 1 is minimal (one URL param + one default-fallback).

**Severity rationale**: LOW — three independent cosmetic gaps; no broken-ness; each is a one-file fix. Severity reinforced by the absence of test coverage (REFACTOR-289) — a regression on any of the three would ship unnoticed.

**Suggested backlog grouping**: `UI architecture codification — micro-cleanups` batch.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-228 (routes-as-functions — these are the per-pillar micro-gaps the convention does not address).
- SUPERSEDES: none.
- CONFLICTS: none.

## ADR-CANDIDATE-228 — Each UI pillar's URL surface is declared in ONE `routes/{pillar}*.ts` module exposing path-BUILDER FUNCTIONS (never bare constants); per-pillar `BASE_PATH` lives file-private inline; all modules re-exported through `routes/index.ts` barrel — the URL contract is centralised, callable-uniform, and single-source-of-truth

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-02, P-03, P-04, P-06, P-07, P-08] — every pillar with a URL surface (UI architecture-wide)

**Support count**: 5 sidecars (every batch-ZH sidecar confirms the convention)

**Surfaced by** (5 sidecars):
- `dataModelling.md:implicit_adrs[1]` — "The Data Modelling pillar's URL prefix lives in a SHARED `BASE_PATH` constant, exported from this file and imported by both sibling files. This is the only routes subdirectory in `odd-platform-ui/src/routes/` that uses this cross-file shared-constant pattern — peer pillars (alerts, activity, etc.) declare their `BASE_PATH` inline in their single route file."
- `dataQuality.md:implicit_adrs[0,1]` — "Each route module under `odd-platform-ui/src/routes/` declares its URL prefix and exposes a path-builder function from a single file, re-exported through `routes/index.ts`. `dataQualityRoutes.ts` follows the directory convention: one named function exporting one URL surface, re-exported via `index.ts:3` so consumers import from `'routes'`. The directory has 11 sibling modules and this is the only one with a function returning a hard-coded literal with no `BASE_PATH` constant — the convention itself is the implicit ADR." AND "Path builders are functions even when they take no arguments — the route's URL is callable, not a bare constant. `dataQualityPath` is a zero-arg function (`dataQualityRoutes.ts:1-3`); the same shape appears in `activityPath(query?)`, `directoryPath()`, `alertsPath(path?)`, `lookupTablesPath()`. The decision is API consistency: callers always write `dataQualityPath()`, never `dataQualityPath` — so refactoring a single route to take parameters (e.g. adding a sub-path argument) is a non-breaking change at the call sites."
- `management.md:implicit_adrs[0]` — "Route modules under `odd-platform-ui/src/routes/` declare `BASE_PATH` as a file-private inline `const` rather than importing from a shared routes module. The consistency of the pattern across 8 sibling modules is the convention."
- `masterData.md:implicit_adrs[0]` — "Master Data is a top-level URL namespace (`/master-data`) reserved for a future family of master-data-management sub-features; lookup tables is the first and currently only sub-feature."
- `terms.md:implicit_adrs[1]` — "`termsPath()` exists ONLY to keep the App.tsx route mount and the `termDetailsPath` prefix in lock-step. It is not a navigation target. The function body is `return BASE_PATH;` with no parameters. The choice to expose a parameterless function (vs `export const BASE_PATH = '/terms'`) is to keep the function-call signature consistent with `termsSearchPath()` and `termDetailsPath(...)` — the routes module's convention is 'every URL is a function call'."

**Decision statement**: The odd-platform-ui SPA's URL contract follows a **three-part convention**:

1. **One module per pillar** in `odd-platform-ui/src/routes/{pillar}*.ts` (some pillars have a single file like `dataQualityRoutes.ts` / `masterDataRoutes.ts` / `termsRoutes.ts`; others have a subdirectory like `dataModelling/` with three files). The pillar's URL prefix lives in this module; no other source file hard-codes the literal.

2. **Path builders are FUNCTIONS, never bare constants** — every exported URL surface is a callable: `dataQualityPath()`, `lookupTablesPath()`, `termsPath()`, `termsSearchPath(searchId?)`, `termDetailsPath(termId, path?)`, `managementPath(path?)`, `associationsPath(path)`, `integrationsPath(integrationId, path?)`. Even zero-arg builders are functions (`dataQualityPath()`, `lookupTablesPath()`, `termsPath()`, `directoryPath()`, `dataModellingPath()`) — the uniformity is intentional: refactoring a route to take parameters is a non-breaking change at call sites.

3. **`BASE_PATH` is file-PRIVATE inline `const` per pillar** (8 of 11 modules — `alertsRoutes.ts`, `activityRoutes.ts`, `dataEntitiesRoutes.ts`, `directoryRoutes.ts`, `searchRoutes.ts`, `termsRoutes.ts`, `masterDataRoutes.ts`, `managementRoutes.ts`); the constant is referenced only inside the builder function bodies, never exported. Two outliers: (a) `dataModelling/dataModelling.ts` EXPORTS `BASE_PATH` so sibling files `queryExamplesRoutes.ts` and `relationshipsRoutes.ts` can compose URLs with the shared prefix — the multi-file subdirectory shape; (b) `dataQualityRoutes.ts` inlines the literal `/data-quality` directly in the return statement with no `BASE_PATH` constant at all — the lone outlier (8 vs 1 vs 2).

4. **Re-export through `routes/index.ts` barrel** — every per-pillar module is exposed via `export * from './{pillar}Routes'` so consumers import from the `'routes'` package, not from the per-file path. The directory layout is implementation detail; the public API is the barrel.

The intent: a single grep over `odd-platform-ui/src/routes/` enumerates every URL surface in the SPA; renaming a URL is a one-file change visible in that grep; consumers are insulated from file-layout refactors.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the convention is consistently applied across 11 sibling modules; the lone outlier (`dataQualityRoutes.ts` inlining the literal) is a cosmetic deviation, not a counter-pattern; the multi-file dataModelling subdirectory exception is itself a convention-extension (when a pillar has multiple sub-paths, externalise BASE_PATH to a shared file).
2. *Structural impact?* YES — defines the URL contract architecture; every new pillar surface, every refactor that renames a URL, every consumer importing a path goes through this convention.
3. *Refactoring or structural?* STRUCTURAL — changing the convention (e.g., exposing URLs as bare constants, hard-coding URLs at call sites, or moving URLs to a single `urls.ts` registry) is a multi-file refactor that touches every consumer.
→ ADR.

**Evidence**:
- `routes/index.ts:1-12` (the barrel) re-exports every per-pillar module
- `dataQualityRoutes.ts:1-3` (single-file pillar, zero-arg function, no BASE_PATH — outlier)
- `masterDataRoutes.ts:1-5` (single-file pillar, file-private BASE_PATH, zero-arg function)
- `termsRoutes.ts:1-63` (single-file pillar with multiple builders: termsPath, termsSearchPath, termDetailsPath; file-private BASE_PATH + TERMS_SEARCH_PATH)
- `managementRoutes.ts:1-57` (single-file pillar with frozen sub-route literal map + multiple builders)
- `dataModelling/dataModelling.ts:1-7` + `dataModelling/queryExamplesRoutes.ts:1-38` + `dataModelling/relationshipsRoutes.ts:1-6` (multi-file pillar with exported BASE_PATH)
- intent_anchor: the consistency of the convention across 11 sibling modules

**Existing ADRs / composition**:
- Composes with **ADR-CANDIDATE-227** (NEW this batch — bare base URL redirects to canonical first tab) — together they form the URL-shape architecture: per-pillar URL prefix in `routes/`, path-builder functions, redirect-to-first-tab on the bare URL.
- Composes with **ADR-CANDIDATE-091** (URL is the source of truth for view state) — the path-builders are the WRITE side of the URL-as-state contract; ADR-091 is the READ side (`useSearchParams`-as-state).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-289 (existing — ZERO UI test coverage; the convention has zero pinning tests — every typo in BASE_PATH ships green)
- REFACTOR-673 (NEW — `useIntegrationRouteParams` + `useTermsRouteParams` type-system lies: the convention has zero compile-time defence against calling the hook outside its matching route subtree)

**Proposed action**: Promote to `adrs/drafts/ui-route-module-convention.md`. Document:
- The three-part convention (one module per pillar, path-builders as functions, file-private BASE_PATH).
- The barrel re-export shape.
- The outliers (dataQualityRoutes — no BASE_PATH; dataModelling/ subdirectory — exported BASE_PATH) and why each is allowed.
- The maintenance obligation: every new URL surface is a path-builder function in `routes/{pillar}*.ts`, re-exported through the barrel.
- The migration consequence: changing the convention requires touching every consumer; the current call shape `pathBuilder()` is the abstraction boundary.

**Severity rationale**: MEDIUM — pattern-shaping convention; 5-sidecar support across 5 pillars; the convention is observable to every UI maintainer. Below HIGH because it's a code-organisation convention, not a load-bearing architectural choice.

**Suggested backlog grouping**: `UI architecture codification`.

---

**STRENGTHENS — batch ZH (2026-05-26 — UI Routes 1: 5 sidecars confirm the convention is universal across the routes/ directory)**

Prior to batch ZH the convention was IMPLICIT — observable in code but not yet codified as ADR. Batch ZH's 5 route sidecars provide PRIMARY-SOURCE confirmation across 5 distinct pillars (Data Modelling, Data Quality, Management, Master Data, Terms), with each sidecar's `implicit_adrs` section explicitly naming the convention as the pillar's URL-shape contract. The convergence makes the convention codifiable.

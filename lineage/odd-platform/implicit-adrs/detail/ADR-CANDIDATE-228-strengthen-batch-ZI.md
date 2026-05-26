## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: 5 more route sidecars confirm the convention is universal across the routes/ directory)

Batch ZI completes the routes-directory walk started in batch ZH. Five additional route sidecars (activity, directory, search, queryExamples, relationships) confirm the three-part convention is universal:

1. **One module per pillar** — every sidecar's source file lives in `odd-platform-ui/src/routes/{pillar}*.ts` (activity → single file; directory → single file; search → single file; queryExamples + relationships → both inside the multi-file `routes/dataModelling/` subdirectory consistent with the ZH-batch's documented multi-file pattern).

2. **Path builders are FUNCTIONS, never bare constants** — every sidecar confirms: `activityPath(query?)` (zero-arg-or-string), `directoryPath()` (zero-arg), `directoryDataSourcePath(prefix, dsId?, typeId?)` (multi-arg), `searchPath(searchId?)` (zero-arg-or-string), `queryExamplesPath(queryExampleId?)` (zero-arg-or-number), `relationshipsPath()` (zero-arg). Each is a callable.

3. **`BASE_PATH` is file-PRIVATE inline `const` per pillar** — activityRoutes.ts:1, directoryRoutes.ts:4, searchRoutes.ts:3 all confirm the file-private inline pattern. queryExamplesRoutes.ts and relationshipsRoutes.ts both **import** `BASE_PATH` from the sibling `./dataModelling` — the multi-file pillar exception established in batch ZH is now fully visible across two sibling consumers (queryExamples + relationships) reading from one shared module (dataModelling).

**New surfaced_by entries**:

- `odd-platform__ts__routes__route__activity.md:implicit_adrs[0]` (HIGH) — "Route modules under `odd-platform-ui/src/routes/` declare `BASE_PATH` as a file-private inline `const` rather than importing from a shared routes module — `activityRoutes.ts:1` follows the same pattern as `alertsRoutes.ts:1`, `dataEntitiesRoutes.ts:4`, `directoryRoutes.ts:4`, `managementRoutes.ts:3`, `masterDataRoutes.ts:1`, `searchRoutes.ts:3`, `termsRoutes.ts:4` (verified via the alerts sidecar's grep across all eight non-index modules)."

- `odd-platform__ts__routes__route__directory.md:implicit_adrs[0,1]` (HIGH) — "Each route module under `odd-platform-ui/src/routes/` declares its URL prefix and exposes a path-builder function from a single file" + "The URL builder + the route-params hook are co-located in the same file, NOT split. Same convention in `dataEntitiesRoutes.ts:47-59 + 63-134` and `termsRoutes.ts:54-63 + 12-42`."

- `odd-platform__ts__routes__route__search.md:implicit_adrs[1]` (HIGH) — "Cohesion via single source-of-truth constants. The three constants `BASE_PATH`, `SEARCH_ID_PARAM`, `SEARCH_ID` (lines 3-5) feed BOTH the link generator and the param hook."

- `odd-platform__ts__routes__route__queryExamples.md:implicit_adrs[3]` (HIGH) — "The route file owns BOTH the path builder (`queryExamplesPath`) AND the param parser (`useQueryExamplesRouteParams`) — a single file is the SoT for the URL shape from BOTH the producer side (builder) and consumer side (parser). The decision: route shapes are bidirectional contracts; co-locating the two halves means a refactor that adds a new path param updates both ends in one edit."

- `odd-platform__ts__routes__route__relationships.md:implicit_adrs[1]` (MEDIUM) — "The sub-path string `'relationships'` is duplicated between `relationshipsRoutes.ts:5` (concatenated against `BASE_PATH`) and `DataModellingRoutes.tsx:40` (hard-coded `<Route path='relationships'>`). The decision: the inner Routes declaration uses bare React Router child-path syntax rather than re-importing the path builder. Same pattern is used by `queryExamplesRoutes.ts:30` / `DataModellingRoutes.tsx:18,28`."

**Triangulation count after ZI**: 10 sidecars (was 5; ZH-batch contributed 5; ZI adds 5 more). Every non-index route module in `odd-platform-ui/src/routes/` is now sidecar-covered and each surfaces the convention.

**Severity unchanged**: MEDIUM — pattern-shaping convention.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-227 (bare-base redirect-to-first-tab — directly composes with this routes-as-functions convention for multi-tab pillars).
- SUPERSEDES: none.
- CONFLICTS: none.

---

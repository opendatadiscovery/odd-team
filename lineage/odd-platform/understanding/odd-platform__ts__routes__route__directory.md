---
node_id: "odd-platform ts routes route:directory"
node_kind: route
axis: ui_routes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZI
pillar: P-01
related_pillar_features:
  - "P-01:F-Directory"  # the four-level browse surface; Directory sub-feature of Data Discovery
related_concepts:
  - directory
  - oddrn
  - ui-route-mount
  - route-base-path-convention
  - param-coercion-string-to-number
related_sidecars:
  - odd-platform__java__DirectoryController__controller-class__DirectoryController  # backend side — same four levels, /api/directory*
  - odd-platform__ts__routes__route__alerts
  - odd-platform__ts__routes__route__dataQuality
  - odd-platform__ts__routes__route__terms                                            # closest analog (param-coercion, multi-builder, useParams hook)
references:
  - kind: caller
    node: "odd-platform ts route-registry App.tsx"
    unresolved: true
    note: "the route table mounts <Route path=`${directoryPath()}/*` element={<DirectoryRoutes />}> at App.tsx:19, 38, 72 (no WithPermissionsProvider wrapper)"
  - kind: caller
    node: "odd-platform ts react-component component:ToolbarTabs"
    unresolved: true
    note: "global toolbar builds the 'Directory' tab link via directoryPath() at ToolbarTabs.tsx:17, 42 (rendered unconditionally for every authenticated session)"
  - kind: caller
    node: "odd-platform ts react-component component:DirectoryRoutes (Directory/DirectoryRoutes.tsx)"
    unresolved: true
    note: "inner React-Router subtree under /directory/*; declares four <Route> children at DirectoryRoutes.tsx:11-17, including the Navigate fallback :dataSourceTypePrefix/:dataSourceId → all at line 15-17"
  - kind: caller
    node: "odd-platform ts react-component component:Overview-DirectoryItem"
    unresolved: true
    note: "Overview/Directory/DirectoryItem.tsx:4,16 — landing-page Directory-card grid calls directoryDataSourcePath(prefix) to build level-2 links"
  - kind: caller
    node: "odd-platform ts react-component component:EntitiesTabs"
    unresolved: true
    note: "Directory/Entities/EntitiesTabs.tsx:6,19,26 — builds 'All' tab link via directoryDataSourcePath(prefix, dsId, 'all') and per-type tabs via directoryDataSourcePath(prefix, dsId, id:number) at EntitiesTabs.tsx:19"
  - kind: callee
    node: "react-router-dom generatePath / useParams"
    unresolved: false
    note: "external dependency imported at directoryRoutes.ts:1; the entire URL substitution + param-read mechanism delegates to this library"
---

# directoryRoutes — semantic understanding

## understanding

`directoryRoutes.ts` (63 lines) is the URL-shape contract for the **Directory feature (pillar P-01:F-Directory)** in the platform UI — the catalog's hierarchy-driven browse surface complementing Search's query-driven flat results. It declares a single module-private `BASE_PATH = '/directory'` (line 4) plus six param-name constants (lines 10-15), and exposes **three exports**: `directoryPath()` (line 6 — returns the bare base path; sole consumer is the route-registry mount at `App.tsx:72` plus the global `ToolbarTabs.tsx:42` 'Directory' tab), `useDirectoryRouteParams()` (line 29 — the typed wrapper around `useParams` that coerces `dataSourceId` string→number and translates the literal `'all'` segment to `undefined typeId`), and `directoryDataSourcePath(prefix, dsId?, typeId?)` (line 43 — the level-2/level-4 URL builder, with a level-3 fallback that builds bare `/directory/{prefix}` when `dsId` or `typeId` are absent). **Category B finding — the live doc page (WebFetched 2026-05-26, status 200) documents FOUR navigation levels with FOUR distinct URL patterns; this module's `directoryDataSourcePath` builds ONLY THREE of them.** The level-3 URL `/directory/{prefix}/{dsId}/all` is NOT directly built by `directoryDataSourcePath` — it is reached via the React Router `<Navigate to='all' replace />` at `Directory/DirectoryRoutes.tsx:15-17`, OR via `EntitiesTabs.tsx:26` which explicitly passes `typeId='all'` to the builder. The module name suggests a flat URL set; the implementation hides the navigation behaviour in the consumer's <Routes> tree. **Category D finding — the `/directory/*` mount at `App.tsx:72` has NO `WithPermissionsProvider` wrapper** (contrast `/lookup-tables` at `App.tsx:75-88` which IS wrapped on `LOOKUP_TABLE_CREATE | _UPDATE | _DELETE`); the 'Directory' top-bar tab at `ToolbarTabs.tsx:40-44` is rendered unconditionally for every authenticated session — every level of the Directory is reachable by any signed-in user, mirroring the backend's NO-`@PreAuthorize` posture pinned by the `DirectoryController` sidecar (cross-owner read-collaborative posture, REFACTOR-024 family). **Category F finding — the `useDirectoryRouteParams` hook coerces `dataSourceId` via `parseInt(dataSourceId, 10)` at line 37 with NO `isNaN` guard**; a deep-link with a non-numeric segment (`/directory/postgresql/abc/all`) produces `dataSourceId: NaN` in every consumer (`DataSourceList`, `Entities`, `DirectoryBreadCrumbs`, `EntitiesTabs`, `EntityItem`, `TableHeader`), then `useGetDataSourceEntities({dataSourceId: NaN})` calls `directoryApi.getDatasourceEntities({dataSourceId: NaN})` → backend 400/404 — same shape as the `useTermsRouteParams` NaN-swallowing pattern (`terms` sidecar `invariants[2]`). Additionally the `typeId === 'all'` literal is the in-band sentinel for "no type filter" — the hook translates it to `undefined typeId` at line 34, and the UI's `TableHeader.tsx:22` toggles the Type column ONLY when `typeId` is `undefined`; the literal `'all'` is therefore a **load-bearing magic string** shared across this module, `DirectoryRoutes.tsx:16`, and `EntitiesTabs.tsx:26`.

## concepts

- entities: [
    "`DataSource` and `DataSourceType` (OpenAPI-generated DTOs from `generated-sources`, line 2) — referenced via `DataSource['id']` (= `number`) at lines 25, 45 and `DataSourceType['prefix']` (= `string`) at lines 24, 44 for type-narrowing builder args.",
    "`DATA_SOURCE_TYPE_PREFIX` (line 11, the string `'dataSourceTypePrefix'`), `DATA_SOURCE_ID` (line 13, `'dataSourceId'`), `TYPE_ID` (line 15, `'typeId'`) — three string-key constants used both as URL-path-param names with `:` prefix (lines 10, 12, 14) AND as object-property names in the `DirectoryRouteParams` / `AppDirectoryRouteParams` interfaces (lines 18-20, 24-26). The double-use keeps URL pattern names and route-params keys in lock-step at compile time (same convention as `termsRoutes.ts:7-10`).",
    "`DirectoryRouteParams` (lines 17-21) — the URL-layer (`react-router-dom`) shape; all three params are `string` because that is what `useParams<T>()` returns.",
    "`AppDirectoryRouteParams` (lines 23-27) — the application-layer shape; `dataSourceTypePrefix` is `DataSourceType['prefix']` (string), `dataSourceId` is `DataSource['id']` (number), `typeId` is `undefined | number`. The hook converts between the two.",
    "The literal `'all'` (referenced indirectly at line 34) — the in-band sentinel meaning 'no type filter; show all entity types of this data source'. NOT exported, NOT named as a constant; the literal lives in three coordinated locations: the hook's coercion check (`typeId === 'all' ? undefined : parseInt(typeId, 10)` line 34), the inner Routes' Navigate fallback (`Directory/DirectoryRoutes.tsx:16` `<Navigate to='all' replace />`), and the EntitiesTabs builder call (`EntitiesTabs.tsx:26` `directoryDataSourcePath(prefix, dsId, 'all')`)."
  ]
- operations: [
    "`directoryPath()` (lines 6-8) — returns the bare `'/directory'` string. **Two consumers**: `App.tsx:72` mounts `<Route path=`${directoryPath()}/*` element={<DirectoryRoutes />} />`, `ToolbarTabs.tsx:42` builds the 'Directory' top-bar tab link. The function exists purely so the mount string and the toolbar tab link share a single source of truth.",
    "`useDirectoryRouteParams()` (lines 29-41) — React Router-bound hook; calls `useParams<keyof DirectoryRouteParams>()` (line 30), casts to `DirectoryRouteParams` (line 32), then **coerces `dataSourceId` to `number` via `parseInt(dataSourceId, 10)` (line 37)** and **translates the literal `typeId === 'all'` to `undefined` else `parseInt(typeId, 10)` (line 34)**. `dataSourceTypePrefix` is passed through as-is.",
    "`directoryDataSourcePath(prefix, dsId?, typeId?)` (lines 43-62) — branches on the presence of both `dsId` AND `typeId`: when BOTH are truthy, returns the level-4 URL `/directory/{prefix}/{dsId}/{typeId}` via `generatePath`; ELSE falls back to the level-2 URL `/directory/{prefix}`. **There is NO branch that builds a level-3 URL `/directory/{prefix}/{dsId}` (without typeId) AND there is NO branch that builds a level-3 URL `/directory/{prefix}/{dsId}/all` directly via this builder** — the level-3 URL is reached either via the React Router `<Navigate to='all' replace />` redirect (`DirectoryRoutes.tsx:16`) when the user clicks a data-source row, OR via `EntitiesTabs.tsx:26` which explicitly passes `typeId='all'` to make the `dsId && typeId` branch fire."
  ]
- invariants: [
    "**Single `BASE_PATH` is `/directory`** (line 4) — the canonical prefix for every Directory URL in the UI; both consumers (`App.tsx:72`, `ToolbarTabs.tsx:42`) and the inner React-Router subtree (`Directory/DirectoryRoutes.tsx:11-17`) compose URLs from this prefix. Renaming `BASE_PATH` here is a one-file change at this layer, BUT the inner `DirectoryRoutes.tsx:11-17` re-hardcodes `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` as path patterns; renaming THOSE in this module breaks the inner Routes match silently (same shape as the `alertsRoutes` LSN-tracked inconsistency in the alerts sidecar).",
    "**The `'all'` literal is a load-bearing magic string shared across THREE files**: this module's hook coercion (line 34, `typeId === 'all' ? undefined : parseInt(typeId, 10)`), the inner Routes' Navigate fallback (`Directory/DirectoryRoutes.tsx:16`, `<Navigate to='all' replace />`), and `EntitiesTabs.tsx:26`. NO named constant unites them. Renaming `'all'` to e.g. `'any'` in one location without the others silently desynchronises the Navigate target / hook recognition / tab builder.",
    "**`useDirectoryRouteParams` coerces `dataSourceId` via `parseInt(dataSourceId, 10)` (line 37) with NO `isNaN` guard.** A deep-link to `/directory/postgresql/abc/all` produces `dataSourceId: NaN`; consumers (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) receive `NaN` and call backend APIs with `dataSourceId=NaN`; the backend responds 400/404 — same shape as the `useTermsRouteParams` NaN-swallowing pattern (`terms` sidecar `invariants[2]`).",
    "**`directoryDataSourcePath` has only TWO output branches** (level-2 bare-prefix OR level-4 full path) despite the URL space having FOUR distinct shapes (level-1 `/directory`, level-2 `/directory/{prefix}`, level-3 `/directory/{prefix}/{dsId}/all`, level-4 `/directory/{prefix}/{dsId}/{typeId}`). Level-1 has its own builder (`directoryPath()`); level-3 is NEVER built directly — it is either redirected-to by the React-Router fallback at `DirectoryRoutes.tsx:15-17` OR built indirectly by passing the string `'all'` to `directoryDataSourcePath` from `EntitiesTabs.tsx:26`.",
    "**No `element` on the level-3 mount that strips `typeId`** — `DirectoryRoutes.tsx:14-17` declares `<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to='all' replace />} />` as a sibling of the level-4 route. The level-3 URL is fundamentally an immediate-redirect surface; the operator typing `/directory/postgresql/1` in the browser is bounced to `/directory/postgresql/1/all` before any element renders.",
    "**`directoryPath` is a zero-argument function** returning a constant string (lines 6-8); the convention is shared with `dataQualityPath`, `directoryPath`, `activityPath` siblings (per the `dataQualityRoutes` sidecar `implicit_adrs[1]`). Callers always write `directoryPath()`, never `directoryPath` — so adding a future argument is non-breaking at the call sites.",
    "**`directoryDataSourcePath` accepts `typeId` as `number | 'all'`** (line 47) — the type annotation explicitly includes the literal `'all'` as a valid argument; the builder type-system-enforces that callers pass either a number OR the literal `'all'`, never an arbitrary string. EntitiesTabs.tsx:19 (`id` from `DataEntityType` = number) and EntitiesTabs.tsx:26 (`'all'`) are the two real call shapes."
  ]
- audiences: [
    "any-authenticated-user — the literal `/directory` URL is surfaced to every signed-in user via the unconditional 'Directory' toolbar tab (`ToolbarTabs.tsx:40-44`); there is no client-side permission gate around the tab or the route (mirrors the backend cross-owner read-collaborative posture per the `DirectoryController` sidecar `security.owner_scoping = BYPASSES`).",
    "data-engineer-analyst — primary intended audience per live doc `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-26 status 200: 'Reach for the Directory when ... you want to see what data sources are registered in the platform ... you know the kind of source (PostgreSQL, Snowflake, Kafka, Airflow, ...) but not the specific instance or entity ... you're auditing per-source coverage'.",
    "data-steward-owner — uses Directory to navigate from data-source-type to specific data sources for governance review.",
    "platform-administrator — uses Directory to inventory all registered data sources (host/port/database property leakage to any authenticated user is the `DirectoryController` sidecar's MEDIUM-severity reconnaissance finding; the URL-shape declared here is the entry point)."
  ]

## dependencies_semantic

- requires-feature: [
    "P-01 Data Discovery — the `Directory` route is meaningful only when the `DirectoryRoutes` component (`Directory/DirectoryRoutes.tsx`) is mounted at `App.tsx:72`; this module is the URL half of the contract, the component module is the render half.",
    "P-01:F-Directory — the four-level browse surface; the URL space declared here IS the user-facing contract for the four levels documented at `docs.opendatadiscovery.org/features/data-discovery/directory`."
  ]
- requires-config: [] — N/A. The module reads no `@Value` / no env var / no feature flag; the URL shape is static at build time. The literal `'/directory'` is the only mutable surface, controlled by this one file.
- requires-runtime: [
    "react-router-dom — `generatePath` (line 1, used at lines 49 and 59 to substitute `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` params); `useParams` (line 1, used at line 30). Unlike `dataQualityRoutes.ts` (which imports NOTHING) and like `dataEntitiesRoutes.ts:1` (which imports `generatePath + useParams`), this module DOES couple to react-router-dom — necessary for the hook + builder pair.",
    "OpenAPI-generated `DataSource`, `DataSourceType` DTOs from `generated-sources` (line 2) — type-only imports, used as `DataSource['id']` and `DataSourceType['prefix']` to type-narrow builder arguments."
  ]
- couples-to: [
    "`App.tsx:19, 72` — the route table imports `directoryPath` and uses it to mount the `<Route path=`${directoryPath()}/*` element={<DirectoryRoutes />} />` element. The trailing `/*` is what enables React Router to delegate level-2/3/4 matching to the inner `<DirectoryRoutes>` subtree.",
    "`ToolbarTabs.tsx:17, 42` — the global toolbar imports `directoryPath` and uses it as the 'Directory' tab `link`. Unconditional render — no permission predicate around the tab.",
    "`Directory/DirectoryRoutes.tsx:11-17` — the inner React-Router subtree. RE-HARDCODES `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` as path patterns at lines 12, 13, 15 (does NOT import the constants from this module). Renaming the constants in this module without updating the inner subtree silently desyncs URL match.",
    "`Overview/Directory/DirectoryItem.tsx:4, 16` — landing-page Directory-card grid calls `directoryDataSourcePath(prefix)` (no `dsId`, no `typeId`) to build level-2 links.",
    "`Directory/Entities/EntitiesTabs.tsx:6, 19, 26` — builds 'All' tab link via `directoryDataSourcePath(prefix, dsId, 'all')` and per-type tabs via `directoryDataSourcePath(prefix, dsId, id:number)`. THE ONLY caller that exercises the level-4 builder branch.",
    "`Directory/DataSourceList.tsx:20, 27`, `Directory/Entities/Entities.tsx:12, 20`, `Directory/DirectoryBreadCrumbs/DirectoryBreadCrumbs.tsx:6, 13`, `Directory/Entities/EntitiesList/EntityItem/EntityItem.tsx:13, 40`, `Directory/Entities/EntitiesList/TableHeader/TableHeader.tsx:5, 13` — six callers of `useDirectoryRouteParams()` reading some/all of `{ dataSourceTypePrefix, dataSourceId, typeId }`. NO caller guards against `dataSourceId === NaN`.",
    "`routes/index.ts:5` — `export * from './directoryRoutes'` re-exports all three named exports from the `'routes'` barrel; consumers import from `'routes'`, not from this file directly."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test file references `directoryPath`, `directoryDataSourcePath`, or `useDirectoryRouteParams` (Grep over `odd-platform-ui/src` `*.test.*` / `*.spec.*` returned no matches at ede5d277).
- uncovered_behaviours:
  - behaviour: "`directoryPath()` returns the literal `'/directory'`"
    test_class: unit
    criticality: LOW
    note: "A typo (e.g. `/directry`) would silently break every link to the Directory; the build would not fail; users would hit a router 'no match' (the parent `<Route path=`${directoryPath()}/*`>` would still pass-through, but no inner child would match, and the toolbar tab would navigate to a non-matching route)."
  - behaviour: "`directoryDataSourcePath(prefix)` returns `/directory/{prefix}` (level-2 single-arg branch)"
    test_class: unit
    criticality: LOW
    note: "The fallback branch at lines 59-61. Used by `Overview/Directory/DirectoryItem.tsx:16` to wire the landing-page Directory-card grid. A regression that changed the fallback to e.g. emit the level-4 pattern with empty params would break the landing page silently."
  - behaviour: "`directoryDataSourcePath(prefix, dsId, typeId)` returns `/directory/{prefix}/{dsId}/{typeId}` (level-4 three-arg branch)"
    test_class: unit
    criticality: LOW
    note: "Used by `EntitiesTabs.tsx:19, 26`. A regression that changed the substitution order would silently route to wrong URLs."
  - behaviour: "`directoryDataSourcePath(prefix, dsId, 'all')` correctly substitutes the literal 'all' as the `:typeId` segment"
    test_class: unit
    criticality: MEDIUM
    note: "The cross-file coordination point. If a future change tightened the `typeId` type to `number` (dropping `| 'all'` from line 47), `EntitiesTabs.tsx:26` would fail to typecheck — but ONLY if the inner literal stays `'all'`. The hook coercion at line 34 specifically checks the string `'all'` — if the literal drifts (e.g. `'any'`), the typeId column behaviour in `TableHeader.tsx:22` silently changes."
  - behaviour: "`useDirectoryRouteParams()` translates the URL segment `'all'` to `typeId: undefined` AND coerces non-`'all'` `typeId` via `parseInt(typeId, 10)`"
    test_class: unit
    criticality: HIGH
    note: "The single most behavior-critical path of this module. The `'all'` ↔ undefined translation drives the UI's Type-column toggle (`TableHeader.tsx:22`) AND the entity-fetch query (`useGetDataSourceEntities` passes the resolved `typeId` straight through to `directoryApi.getDatasourceEntities`). A regression breaking either branch silently corrupts navigation behaviour."
  - behaviour: "`useDirectoryRouteParams()` handles non-numeric `dataSourceId` (NaN-swallowing under malformed URL)"
    test_class: unit
    criticality: MEDIUM
    note: "Defensive boundary. Deep-link `/directory/postgresql/abc/all` produces `dataSourceId: NaN` in every consumer; backend gets `?dataSourceId=NaN`; response is 400/404; UI surfaces an AppErrorPage. NOT a bug per se (the malformed URL is the user's fault) — but the lack of an explicit `isNaN` guard means consumers cannot distinguish 'invalid URL' from 'data source genuinely missing'. Worth a one-line test pinning the current behaviour so a future tightening to `null`-on-NaN is a deliberate breaking change."
  - behaviour: "`/directory/{prefix}/{dsId}` (level-3-with-no-typeId URL) triggers the React-Router Navigate-to-'all' redirect"
    test_class: integration
    criticality: MEDIUM
    note: "A Playwright/Cypress test that navigates to `/directory/postgresql/1` and asserts the URL becomes `/directory/postgresql/1/all` (replace semantics). A regression that removed the Navigate route silently leaves users on a blank page."
- test_files: [] — Grep over `odd-platform-ui/src` for `directoryPath`, `directoryDataSourcePath`, `useDirectoryRouteParams` in `*.test.*` / `*.spec.*` returned no matches (2026-05-26).
- gaps: |
    This module has zero direct test coverage. The directory-wide pattern is
    the same: NO route module under `odd-platform-ui/src/routes/` has tests
    (per the `alerts`, `dataQuality`, `terms` sidecars' identical gap).
    Worst-coverage class is `integration`: there is no end-to-end test
    that walks the four-level drill-down (`/directory` → click PostgreSQL
    card → `/directory/postgresql` → click data source row → triggers
    Navigate → lands on `/directory/postgresql/1/all` → click `tables` tab
    → `/directory/postgresql/1/{tableTypeId}`). A single integration test
    covering this flow would catch (a) the URL-prefix typo class, (b) the
    Navigate fallback removal class, (c) the `'all'` magic-string drift
    class, and (d) the `parseInt`/NaN class — all the highest-criticality
    behaviour. Cost: one Playwright spec. Gap is directory-wide; the
    highest-leverage fix is the integration suite that doesn't yet exist
    for any route module.

## docs_link_semantic

- declared_docs: [] — N/A. No `// @docs:` annotation in the source file.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/directory"
    anchor: ""
    rationale: "Canonical Directory feature page in the live docs site; explicitly documents the four URL patterns this module + its consumer subtree implement. This is the canonical doc for the URL surface this module declares."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-26 (verbatim URL patterns):
      "Level 1 — Data source types: `/directory`"
      "Level 2 — Data sources of selected type: `/directory/{type-prefix}`"
      "Level 3 — Entity types within selected data source: `/directory/{type-prefix}/{data-source-id}/all`
        (UI surfaces this on the data-source detail page)"
      "Level 4 — Entities of selected (data source, entity type) pair:
        `/directory/{type-prefix}/{data-source-id}/{type-id}`"

      Access-control language (verbatim absence): "The page contains no
      mention of access control, permissions, or visibility restrictions.
      There is no discussion of authentication requirements, role-based
      access, or any limitations on who can view Directory content."

      Note: the live doc lists the 'all' literal at level 3 verbatim as part
      of the URL pattern — the docs and the code agree that 'all' is the
      level-3 in-band sentinel.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/directory"
    anchor: ""
    rationale: "Sibling API-reference doc page describing the four BACKEND endpoints (`/api/directory*`) that the UI's four levels consume. Cross-link from this UI route module's understanding to the backend's URL contract."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-26 (the four backend endpoints):
      "GET /api/directory — lists ODDRN-prefixes with registered data sources"
      "GET /api/directory/datasources?prefix={type-prefix} — lists data sources for a given prefix"
      "GET /api/directory/datasources/{data_source_id}/types — lists entity types in a data source"
      "GET /api/directory/datasources/{data_source_id}?type_id={type-id}&page={n}&size={m}
        — paged entity listing"

      Operational detail (verbatim): "every level on the UI maps to one call;
      the display names and entity counts surfaced at level 1 are derived at
      request time by parsing the ODDRN of every registered data source."

      Access-control language (verbatim absence): "The page contains no
      information about authentication mechanisms, permission requirements,
      or access controls."
  - url: "https://docs.opendatadiscovery.org/data-discovery/directory"
    anchor: ""
    rationale: "Legacy URL path mentioned in the prior v0.1.0 backend `DirectoryController` sidecar (2026-05-08) as a 404; canonical URL moved to `/features/data-discovery/directory`. Re-verified 2026-05-26 — still 404. Recorded for archaeology."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Status 404 on 2026-05-26: "The requested URL data-discovery/directory
      does not exist; the page 'may have been moved, renamed, or deleted'
      and suggests alternative documentation links."
- doc_drift_findings:
  - "**NO drift between the URL patterns declared in this module and the URL patterns named in the live doc.** All four levels documented at `/features/data-discovery/directory` (status 200, 2026-05-26) match this module's pattern verbatim: level 1 = `/directory` (= `directoryPath()`), level 2 = `/directory/{type-prefix}` (= `directoryDataSourcePath(prefix)` single-arg fallback at lines 59-61), level 3 = `/directory/{type-prefix}/{data-source-id}/all` (= the `<Navigate to='all' replace />` redirect at `DirectoryRoutes.tsx:15-17`, OR `directoryDataSourcePath(prefix, dsId, 'all')` at `EntitiesTabs.tsx:26`), level 4 = `/directory/{type-prefix}/{data-source-id}/{type-id}` (= the three-arg builder branch at lines 48-57). The URL space is fully aligned."
  - "**INHERITED MEDIUM-severity doc gap — access-control silence at the URL surface.** The live `data-discovery/directory` page (verified 2026-05-26 status 200) and the sibling `api-reference/directory` page (also 200) BOTH make NO statement about who can view the Directory. This URL contract is mounted at `App.tsx:72` with NO `WithPermissionsProvider` wrapper (contrast `App.tsx:75-88` `/lookup-tables`); the toolbar tab is rendered unconditionally (`ToolbarTabs.tsx:40-44`); the BACKEND DirectoryController has NO `@PreAuthorize` and NO entry in `SecurityConstants.SECURITY_RULES` (per the backend sidecar). The full picture (frontend route reachable to any authenticated user + backend cross-owner read-collaborative posture + reflection-based ODDRN property leakage) is a MEDIUM-severity reconnaissance surface per the backend `DirectoryController` sidecar — and the doc-side is silent. The actionable item lives in the docs pillar (a Visibility section for the Directory feature page), not in this UI route module — surfaced here for cross-surface completeness. — severity: MEDIUM."
  - "**Doc gap — the `'all'` magic string is NOT explained.** The live doc page (2026-05-26 status 200) lists `/directory/{type-prefix}/{data-source-id}/all` as the level-3 URL pattern but does NOT explain that `'all'` is an in-band sentinel meaning 'no type filter; show all entity types'. An operator deep-linking to a Directory level-3 URL has to either (a) read the source or (b) navigate from level 2 to learn that the `all` segment is special. The same docs page does explain level 4's `{type-id}` as a numeric id, by contrast — so the asymmetry is real. A one-sentence addition to the doc would close the gap. — severity: LOW."

## implicit_adrs

- "**Each route module under `odd-platform-ui/src/routes/` declares its URL prefix and exposes a path-builder function from a single file, re-exported through `routes/index.ts`.** `directoryRoutes.ts` follows the directory convention: one named function exporting the bare URL surface (`directoryPath`), plus an additional builder for the parametric URLs (`directoryDataSourcePath`), plus a typed hook for the URL params (`useDirectoryRouteParams`). The directory has 11 sibling modules; the pattern is uniform per the `alerts`, `dataQuality`, `terms` sidecars' `implicit_adrs[0]`. The decision is to centralise URL strings so renaming a URL is a one-file change visible in a single grep over `routes/`." — evidence: `directoryRoutes.ts:1-63` (the module) + `routes/index.ts:5` (the re-export) + parallel structure in `alertsRoutes.ts:1`, `activityRoutes.ts:1`, `dataEntitiesRoutes.ts:4`, `masterDataRoutes.ts:1`, `termsRoutes.ts:4`, `dataModelling/dataModelling.ts:3` (all sibling modules expose path builders) — intent_anchor: "export * from './directoryRoutes';" (`routes/index.ts:5`) — confidence: HIGH

- "**The URL builder + the route-params hook are co-located in the same file, NOT split.** `directoryDataSourcePath` (the builder; lines 43-62) and `useDirectoryRouteParams` (the hook; lines 29-41) are both in `directoryRoutes.ts`. Same convention in `dataEntitiesRoutes.ts:47-59 + 63-134` and `termsRoutes.ts:54-63 + 12-42`. The decision is symmetry: the type system links the path-param names in the builder (`DATA_SOURCE_TYPE_PREFIX_PARAM` etc.) to the keys in the params interface (`DirectoryRouteParams`) at lines 17-21 — keeping both in one file makes a URL-shape refactor a single grep target." — evidence: `directoryRoutes.ts:10-15` (param-name constants) + `directoryRoutes.ts:17-21` (interface) + `directoryRoutes.ts:29-41` (hook) + `directoryRoutes.ts:43-62` (builder) — intent_anchor: the constants at lines 10-15 are imported into BOTH the interface keys (lines 18-20 via `[DATA_SOURCE_TYPE_PREFIX]: string`) AND the builder substitution map (lines 51-55 via `[DATA_SOURCE_TYPE_PREFIX]: dataSourcePrefix`) — the double-use is mechanical evidence the co-location is deliberate — confidence: HIGH

- "**The literal `'all'` is the in-band sentinel for 'no type filter at the entity-list level'.** Choosing a sentinel STRING (rather than e.g. an explicit `?typeId=` query param or an explicit `*` wildcard) is a deliberate convention: the URL `/directory/{prefix}/{dsId}/all` is human-readable and self-describing (the operator types it and understands they're asking for 'all types'), whereas a missing query param or a `*` would obscure intent. The hook recognises the literal and translates it back to `undefined` so downstream code can branch on a typed value. The pattern's case-law: `EntitiesTabs.tsx:26` builds the 'All' tab explicitly via `directoryDataSourcePath(..., 'all')` — confirming the sentinel is a feature, not a workaround." — evidence: `directoryRoutes.ts:34` (the hook's recognition of `typeId === 'all'`), `directoryRoutes.ts:47` (the builder's type annotation accepting `number | 'all'`), `Directory/DirectoryRoutes.tsx:15-17` (`<Navigate to='all' replace />`), `EntitiesTabs.tsx:26` (explicit `'all'`-passing builder call), `TableHeader.tsx:22` (downstream UI branch `if (!typeId) cells.splice(...)`) — intent_anchor: the type annotation at line 47 (`typeId?: number | 'all'`) — the literal IS a first-class accepted argument shape — confidence: HIGH

- "**Level-3 URLs are produced via React-Router redirect (`<Navigate to='all' replace />`), not via the URL builder.** The builder `directoryDataSourcePath` has only TWO output branches (level-2 bare prefix at lines 59-61; level-4 full path at lines 48-57). The level-3 surface `/directory/{prefix}/{dsId}/all` is built ONLY via the inner subtree's `<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to='all' replace />} />` (`DirectoryRoutes.tsx:15-17`) when a user clicks a data-source row from level 2 OR via the EntitiesTabs explicit-'all' call. The choice is: the builder represents 'addressable, user-reachable states'; the level-3 URL is fundamentally a transient redirect target. An operator typing `/directory/postgresql/1` is bounced; no app code WANTS to build that URL — only the React Router declaration wants to MATCH it." — evidence: `directoryRoutes.ts:48-62` (only two branches in the builder) + `Directory/DirectoryRoutes.tsx:14-17` (the Navigate route) + `EntitiesTabs.tsx:26` (the only explicit `'all'` builder consumer) — intent_anchor: the Navigate element's `replace` prop (`DirectoryRoutes.tsx:16`) — `replace` is the explicit semantic 'this URL should not appear in browser history' — confidence: HIGH

## bugs_limitations_corner_cases

- "**No client-side permission gate at the URL declaration's only mount site (`App.tsx:72`).** The route module itself does not and cannot enforce auth — that is the consumer's responsibility (the `<Route>` element). The consumer mounts a BARE `<Route path=`${directoryPath()}/*` element={<DirectoryRoutes />} />` without a `WithPermissionsProvider` wrapper, contrasting the sibling `/lookup-tables` route (`App.tsx:75-88`, wrapped on `LOOKUP_TABLE_CREATE | _UPDATE | _DELETE`). The 'Directory' top-bar tab is also rendered unconditionally (`ToolbarTabs.tsx:40-44`, no permission predicate). Whether the Directory data is gated at the BACKEND endpoint is pinned by the backend `DirectoryController` sidecar: NO `@PreAuthorize`, NO entry in `SecurityConstants.SECURITY_RULES` (per `security.authorization_assertions = []`), cross-owner read posture for the entire feature. The full picture: any authenticated user (even one with zero Permissions and zero Owner association) navigates `/directory/*` end-to-end and enumerates every registered datasource's ODDRN-derived properties (host, database, port, account, warehouse, cluster, topic). Recorded as a corner-case (not an `implicit_adr`) because the absence is unexplained — no comment, no annotation, no exception defends it in this module or in the consumer at `App.tsx:72`. The decision MAY be intentional (mirrors `ADR-CANDIDATE-003` read-collaborative-GET posture per the backend sidecar), but the intent is not expressed in code anywhere on the UI side. Cross-link: P-169 (this sidecar's emitted probe; pins whether `WithPermissionsProvider` wrapping `/directory` would even gate the route, given `WithPermissionsProvider` is non-blocking per ZH finding — context-only, doesn't render-block its children)." — evidence: `directoryRoutes.ts:1-63` (no auth predicates) + `App.tsx:72` (bare consumer mount) + `App.tsx:75-88` (the contrasting gated sibling route, for shape) + `ToolbarTabs.tsx:40-44` (unconditional tab) + `WithPermissionsProvider.tsx:12-49` (non-blocking — children render regardless of permissions) + backend `DirectoryController` sidecar `security.known_security_gaps[0]` — severity: MEDIUM

- "**`useDirectoryRouteParams` coerces `dataSourceId` via `parseInt(dataSourceId, 10)` (line 37) with NO `isNaN` guard.** A deep-link to `/directory/postgresql/abc/all` produces `dataSourceId: NaN`; six consumers (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) receive `NaN` without guard; `useGetDataSourceEntities({dataSourceId: NaN})` (Entities.tsx:36-41) calls `directoryApi.getDatasourceEntities({dataSourceId: NaN})` — `NaN` JSON-serialises as `null` in some toolchains, may serialise as `NaN` (invalid JSON) in others; the backend's OpenAPI-validator typically responds 400 with an error body, the UI surfaces an `AppErrorPage` via `Entities.tsx:60-64`. Same shape as the `useTermsRouteParams` NaN-swallowing pattern (`terms` sidecar `invariants[2]`). Severity: LOW (the malformed-URL case is rare; users get an error page; no data exposure)." — evidence: `directoryRoutes.ts:37` (no `isNaN`) + six consumer files reading `dataSourceId` without guard + `Entities.tsx:36-41` (passes through to API call) — severity: LOW

- "**The literal `'all'` is a load-bearing magic string shared across THREE files with no named constant uniting them.** Renaming `'all'` to e.g. `'any'` in one location without the others silently desynchronises: (a) the hook's `typeId === 'all'` check (line 34) would no longer translate to `undefined`, so `TableHeader.tsx:22` would NOT render the Type column even on the 'All' tab; (b) the Navigate target (`DirectoryRoutes.tsx:16`) would either remain `'all'` (causing a redirect to the new sentinel only if Navigate changes) or be updated independently; (c) the EntitiesTabs builder call (`EntitiesTabs.tsx:26`) would build URLs with the new sentinel but the hook wouldn't recognise it. A single exported `DIRECTORY_ALL_TYPES_SENTINEL = 'all'` constant from this module would close the gap. Same shape as the `AlertsRoutes` LSN-tracked inconsistency (alerts sidecar `bugs_limitations_corner_cases[1]`)." — evidence: `directoryRoutes.ts:34` (hook recognition) + `Directory/DirectoryRoutes.tsx:16` (Navigate target) + `EntitiesTabs.tsx:26` (builder caller) + `TableHeader.tsx:22` (downstream branch) — severity: LOW

- "**The inner `DirectoryRoutes.tsx:11-17` RE-HARDCODES the path-param names `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` instead of importing the constants from this module.** This module declares `DATA_SOURCE_TYPE_PREFIX_PARAM = ':dataSourceTypePrefix'` (line 10), `DATA_SOURCE_ID_PARAM = ':dataSourceId'` (line 12), `TYPE_ID_PARAM = ':typeId'` (line 14) — but the inner `<Routes>` declarations at `DirectoryRoutes.tsx:12,13,15` literally repeat the same strings. Renaming any of the three constants in this module without updating the inner subtree silently breaks the URL match (the substitution would emit the new param name but the React Router pattern would still match the OLD one). Same shape as the alerts `<Route path='all|my|dependents'>` re-hardcoding (alerts sidecar `bugs_limitations_corner_cases[1]`)." — evidence: `directoryRoutes.ts:10,12,14` (the constants) + `Directory/DirectoryRoutes.tsx:11-17` (the re-hardcoded literals) — severity: LOW

- "**`directoryDataSourcePath(prefix)` (single-arg call) and `directoryDataSourcePath(prefix, dsId)` (two-arg call) both fall into the same level-2 branch.** The truthy-check at line 48 is `if (dataSourceId && typeId)` — so calling `directoryDataSourcePath(prefix, 5)` (with valid dsId but no typeId) silently returns the level-2 URL `/directory/{prefix}`, dropping the dsId entirely. The behaviour is correct (there is no addressable level-3 URL to build directly; only Navigate-redirect or explicit `'all'`), but the silent drop is surprising for callers. No call site exercises this shape today (Grep confirms two-arg calls do not exist), but a future refactor that passes `directoryDataSourcePath(prefix, dsId)` expecting a level-3 build would get a level-2 URL and silently misnavigate." — evidence: `directoryRoutes.ts:48` (the `dsId && typeId` guard) + Grep over consumers (`DirectoryItem.tsx:16` `directoryDataSourcePath(prefix)`, `EntitiesTabs.tsx:19,26` `directoryDataSourcePath(prefix, dsId, id|'all')` — no two-arg shape exists) — severity: LOW

- "**No tests for this module or any other route module under `odd-platform-ui/src/routes/`.** A typo in `BASE_PATH = '/directory'` (e.g. `/directry`) would not be caught by the build or by tests. The route would silently stop matching and the entire Directory feature would be unreachable by URL; the toolbar tab would navigate to a non-matching route; React Router would render the bare layout (with the inner `<Routes>` from `DirectoryRoutes.tsx:10-18` failing to match anything, since the parent `<Route path=`${directoryPath()}/*`>` would still match by prefix BUT the children would not). The behavioural impact is silent navigation failure; discovery is human-only. Same directory-wide gap as the `alerts`, `dataQuality`, `terms` sidecars." — evidence: Grep `find <odd-platform-repo>/odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep -l directoryPath` returned no matches at commit ede5d277 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
    # The module has no numeric literals (no LIMIT, no timeout, no retry
    # count, no page size). The single magic string `'all'` (referenced
    # indirectly at line 34) is documented under `name_behavior_pairs` /
    # `request_inputs` rather than `tunables` because it is a sentinel
    # value, not a tunable boundary. The integer base 10 at line 34 / 37
    # is a parseInt convention, not an operationally tunable parameter.
    # Recorded as explicit [] per Rule 9 so "checked, no triggers" is
    # distinct from "forgot to check".
  name_behavior_pairs:
    - name: "directoryPath()"
      promise: "Returns the URL path for the Directory landing page."
      implementation: "Returns the constant string '/directory' (directoryRoutes.ts:6-8). Two consumers use the return verbatim: App.tsx:72 mounts <Route path=`${directoryPath()}/*` element={<DirectoryRoutes />} />, ToolbarTabs.tsx:42 sets link: directoryPath() on the 'Directory' tab. Name promises a URL; implementation returns that URL. No drift."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "directoryRoutes.ts:6-8 + App.tsx:72 + ToolbarTabs.tsx:42"
    - name: "directoryDataSourcePath(prefix, dsId?, typeId?)"
      promise: "Builds a Directory URL for the given (data-source-type-prefix, data-source-id, type-id) tuple — varying levels of the four-level hierarchy depending on arity."
      implementation: "TWO branches only. If BOTH dsId AND typeId are truthy → builds the level-4 URL `/directory/{prefix}/{dsId}/{typeId}` via generatePath (lines 48-57). ELSE → builds the level-2 URL `/directory/{prefix}` (lines 59-61). NO branch builds the level-3 URL `/directory/{prefix}/{dsId}/all` — the level-3 URL is produced by the inner Routes subtree's `<Navigate to='all' replace />` at DirectoryRoutes.tsx:15-17 (when a user clicks a data-source row, Navigate transitions /directory/{prefix}/{dsId} to /directory/{prefix}/{dsId}/all) OR by passing the literal `'all'` to the level-4 branch (EntitiesTabs.tsx:26: `directoryDataSourcePath(prefix, dsId, 'all')`). Name promises a 'data-source path builder'; implementation builds two of the four addressable URL shapes, with the third (level-3) reached via redirect rather than a direct build. No misnaming — the third level IS not directly addressable by build; the function shape correctly reflects the architecture. No drift."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "directoryRoutes.ts:43-62 + Directory/DirectoryRoutes.tsx:11-17 + EntitiesTabs.tsx:19,26 + Overview/Directory/DirectoryItem.tsx:16"
    - name: "useDirectoryRouteParams()"
      promise: "Read-and-typecheck the React-Router URL params for the Directory subtree; return them in the application's expected shape (dataSourceId as number, typeId as undefined | number)."
      implementation: "useParams<keyof DirectoryRouteParams>() destructure (line 30-32), then THREE coercions: dataSourceTypePrefix → as-is (line 38, returns the URL string), dataSourceId → `parseInt(dataSourceId, 10)` (line 37 — NO isNaN guard), typeId → `typeId === 'all' ? undefined : parseInt(typeId, 10)` (line 34). The hook is type-correct for the happy path. NO defensive guards: a non-numeric dataSourceId becomes NaN; a typeId that is neither 'all' nor numeric becomes NaN (and the consumer's `TableHeader.tsx:22 if (!typeId)` does NOT branch into 'All' mode because NaN is falsy — actually it does, NaN is falsy, so the side effect is the Type column DOES render on NaN-typeId URLs, but the entity-fetch sends typeId=NaN which the backend rejects). Name promises 'route params'; implementation returns route params with two unguarded coercions. The behaviour is consistent with the rest of the codebase's `parseInt(..., 10)` pattern (cf. terms sidecar invariants[2]) — not a drift, but a corner case."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "directoryRoutes.ts:29-41 + DataSourceList.tsx:27 + Entities.tsx:20 + DirectoryBreadCrumbs.tsx:13 + EntitiesTabs.tsx:13 + EntityItem.tsx:40 + TableHeader.tsx:13,22"
    - name: "Toolbar 'Directory' tab + URL '/directory' + four-level hierarchy"
      promise: "The Toolbar's 'Directory' tab takes the operator to the Directory feature, which (per the live docs page) is a four-level browse drill-down."
      implementation: "Tab click navigates to the bare /directory URL → inner Routes mount Directory component (DirectoryRoutes.tsx:11) → renders level-1 cards (Directory/Directory.tsx). User clicks a card → Link to {prefix} (DirectoryItem.tsx:16 uses relative Link target, NOT directoryDataSourcePath — the relative Link resolves to /directory/{prefix}) → inner Routes mount DataSourceList component (DirectoryRoutes.tsx:12). User clicks a data-source row → Navigate transition to /directory/{prefix}/{dsId}/all (level-3 URL, via DirectoryRoutes.tsx:15-17 Navigate) → mounts Entities component (DirectoryRoutes.tsx:13). User clicks a type tab → navigates to /directory/{prefix}/{dsId}/{typeId} via EntitiesTabs.tsx:19 → re-mounts Entities. Name promises four-level drill-down; implementation delivers four-level drill-down. No drift. ASYMMETRY OBSERVATION (recorded under bugs_limitations_corner_cases[1]): the Overview-page Directory cards use `directoryDataSourcePath(prefix)` for an absolute href (Overview/Directory/DirectoryItem.tsx:16) while the Directory-page cards use a RELATIVE Link `to={prefix}` (Directory/Directory/DirectoryItem/DirectoryItem.tsx:16 — `<Link to={prefix}>`). Both resolve to the same URL when mounted at /directory; the asymmetry is harmless but inconsistent."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:40-44 + App.tsx:72 + Directory/DirectoryRoutes.tsx:8-22 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/directory 2026-05-26 status 200 + Overview/Directory/DirectoryItem/DirectoryItem.tsx:16 (absolute href) + Directory/Directory/DirectoryItem/DirectoryItem.tsx:16 (relative Link)"
  orderings: []
    # No ORDER BY, no LIMIT/paginate, no .sort()/Comparator. The module
    # returns strings and parsed parameter objects; there is no collection
    # to order. Pagination at the entity-list level is owned by the
    # backend DirectoryController (mandatory page+size at level 4 per the
    # backend sidecar `concepts.invariants`); not within this module's
    # scope. The downstream useInfiniteQuery in useGetDataSourceEntities
    # is a paged-list mechanism owned by the data-fetch layer, not this
    # URL-declaration module.
  auth_gates:
    - location: "directoryRoutes.ts:1-63 + (consumer site) App.tsx:72"
      endpoint: "UI route mount — <Route path=`${directoryPath()}/*` element={<DirectoryRoutes />} />"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The route DECLARATION (this module) is auth-mode-agnostic — it returns plain strings and parsed param objects. Auth enforcement is global at the backend SecurityConfiguration beans, not at the route declaration. The route MOUNT (App.tsx:72) is also auth-mode-agnostic: no per-mode branching in the consumer, no WithPermissionsProvider wrapper. Under DISABLED the SPA is reachable unauthenticated and the route renders for anyone; under LOGIN_FORM/OAUTH2/LDAP the SPA is reachable only post-authentication and any authenticated principal renders the route. Identical behaviour in all four modes after the global gate."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:1-63 (no auth branches) + App.tsx:72 (no auth wrapper) + Directory/DirectoryRoutes.tsx:1-22 (no auth checks in the inner subtree)"
        - q: "What does an unauthenticated caller see?"
          a: "For LOGIN_FORM/OAUTH2/LDAP — the SPA shell never loads for an unauthenticated caller; backend SecurityConfiguration redirects to the auth flow before App.tsx renders. For DISABLED — there is no authentication, the page is anonymously reachable; the entire four-level Directory drill-down is open to any caller able to reach the HTTP port. This module imposes no separate check; the global auth posture applies. Cross-link: the backend DirectoryController sidecar `security.known_security_gaps[3]` records the DISABLED-mode reachability with MEDIUM severity (the ODDRN-property reflection extractor leaks internal hostnames + database names + ports to anyone under DISABLED)."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:1-63 (no own guard) + App.tsx:72 (no own guard) + backend DirectoryController sidecar `security.auth_mode_relevance` + REFACTOR-185 (DISABLED-mode bypass)"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated principal — including a minimum-privilege user with zero Permissions and zero ownership associations — reaches every level of the Directory and renders the full inventory. The route is a BARE <Route> at App.tsx:72, NOT wrapped in WithPermissionsProvider. Even if it WERE wrapped, WithPermissionsProvider is non-blocking (WithPermissionsProvider.tsx:12-49 — it provides a context but ALWAYS renders the children/Component regardless of permissions; the children-level isAllowedTo callback decides what buttons/controls render INSIDE the page, not whether the page itself renders) — ZH non-blocking finding. The 'Directory' top-bar tab is rendered unconditionally (ToolbarTabs.tsx:40-44). Whether the wrong-role caller then sees DATA depends on the backend authorization — pinned by the backend DirectoryController sidecar: NO @PreAuthorize, cross-owner read posture, ODDRN-derived properties (host, database, port, account, warehouse, cluster, topic) returned for EVERY registered data source regardless of caller's ownership. P-169 (this sidecar's emitted probe) pins whether the visual outcome of a minimum-privilege user navigating /directory is the full inventory render."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:1-63 + App.tsx:72 (bare mount, no WithPermissionsProvider) + App.tsx:75-88 (the contrasting gated sibling) + ToolbarTabs.tsx:40-44 (unconditional tab) + WithPermissionsProvider.tsx:12-49 (non-blocking) + backend DirectoryController sidecar `security.owner_scoping = BYPASSES`"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Frontend route declaration: NOWHERE in this module, and NOWHERE in the mounting consumer (App.tsx:72 is a bare <Route> with /*). The 'Directory' tab in ToolbarTabs.tsx has no conditional. Backend (pinned by the backend DirectoryController sidecar): NOWHERE either — controller has NO @PreAuthorize, NO entry in SecurityConstants.SECURITY_RULES (which is mutation-method-only); the only gate is the global authenticated() SecurityFilterChain rule. From the perspective of this URL-declaration module, the answer is unambiguously 'nowhere at the frontend layer, and the backend's only gate is global-authentication (skipped under DISABLED)'."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:1-63 (no predicate) + App.tsx:72 (no wrapper) + ToolbarTabs.tsx:40-44 (no conditional) + backend DirectoryController sidecar `security.authorization_assertions = []`"
  resource_boundaries: []
    # No @Transactional, no synchronized, no lock, no cache, no async path,
    # no insert/update logic. The module is a pure URL-shape contract:
    # one function returning a constant, one hook reading useParams +
    # parseInt, one builder calling generatePath. No resource boundary
    # surface. The data fetch layer (`lib/hooks/api/directory.ts`) DOES
    # have caching via useQuery / useInfiniteQuery (TanStack Query
    # caches by queryKey), but that is a SIBLING node not this module.
  request_inputs:
    - location: "directoryRoutes.ts:30-32 (the useParams destructure)"
      input_kind: path-param
      input_name: "dataSourceTypePrefix"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A data-source TYPE prefix — i.e. the ODDRN-prefix string identifying the kind of data source (postgresql, snowflake, kafka, airflow, mysql). Per live doc `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-26 status 200: 'One card per ODDRN prefix that the platform's registered data sources resolve to (postgresql, snowflake, kafka, airflow, mysql, ...)'."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:18 (interface key) + directoryRoutes.ts:24 (type DataSourceType['prefix']) + live doc"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Passed through as-is (no coercion) from useParams to the hook return (line 38 = `dataSourceTypePrefix` returned unchanged). Consumers use it as: (a) the `prefix` arg to `useGetDirectoryDataSources({prefix})` in DataSourceList.tsx:34 → backend `/api/directory/datasources?prefix={prefix}` (per backend DirectoryController sidecar — calls DirectoryServiceImpl.findByPrefix); (b) the `name` prop of `DatasourceLogo` in DataSourceList.tsx:120 and Entities.tsx:69 (purely UI — picks an icon); (c) the breadcrumb label via `getCapitalizedDatasourceNameFromPrefix(prefix)` in DirectoryBreadCrumbs.tsx:17 (UI rendering); (d) part of the URL build in `directoryDataSourcePath(dataSourceTypePrefix, ...)` in EntitiesTabs.tsx:19,26 (further navigation). The prefix flows through the level-2 backend call AND the UI rendering AND further URL building."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:38 + DataSourceList.tsx:27,34,120 + Entities.tsx:20,69 + DirectoryBreadCrumbs.tsx:13,17 + EntitiesTabs.tsx:13,19,26 + backend DirectoryController sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The name `dataSourceTypePrefix` accurately describes what the input is: the ODDRN prefix identifying a data-source type. The implementation passes it through to a backend `prefix` query parameter (per backend sidecar) that filters by ODDRN prefix, AND to UI rendering that displays the prefix's capitalized name. The literal 'other' is accepted as the sentinel-prefix for unknown-ODDRN data sources (per backend sidecar `concepts.invariants` — 'Level 2 requires a prefix query param; passing the literal `other` triggers the unknown-ODDRN bucket scan'); the UI builds Directory cards for every type INCLUDING 'other', and the URL pattern accepts 'other' just like 'postgresql'. The 'other' sentinel is the only nuance not surfaced by the name alone, but the backend sidecar documents it and the live doc page mentions the 'other' bucket implicitly via 'one card per ODDRN prefix'. No drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:38 + backend DirectoryController sidecar `concepts.invariants` + live doc /features/data-discovery/directory 2026-05-26"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. The path param is consumed end-to-end. No alternative column/field carrying a 'data-source type' or 'prefix' meaning is unused."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:38 + grep over consumers"
      routes_to_finding: "N/A — no drift"
    - location: "directoryRoutes.ts:30-32 (the useParams destructure)"
      input_kind: path-param
      input_name: "dataSourceId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric id of a specific registered data source (one row in the data_source table per the backend schema). Per backend DirectoryController sidecar: `getDatasourceEntityTypes(dataSourceId)` and `getDatasourceEntities(dataSourceId, ...)` use it to look up the specific data_source row."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:25 (type DataSource['id']) + backend DirectoryController sidecar"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Coerced via `parseInt(dataSourceId, 10)` (line 37) without isNaN guard, then returned. Consumers use it as: (a) the `dataSourceId` arg to `useGetDataSourceEntities({dataSourceId, size, typeId, enabled: !!types})` in Entities.tsx:36-41 → backend `/api/directory/datasources/{dataSourceId}?type_id=&page=&size=`; (b) the `dataSourceId` arg to `useGetDataSourceEntityTypes({dataSourceId})` (implicit — Entities.tsx:27 calls it via destructure) → backend `/api/directory/datasources/{dataSourceId}/types`; (c) the breadcrumb-id segment in DirectoryBreadCrumbs.tsx:13,21. The id flows through TWO backend calls AND the breadcrumb rendering."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:37 + Entities.tsx:20,27,36-41 + DirectoryBreadCrumbs.tsx:13,21"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The name `dataSourceId` accurately describes what the input is: the numeric id of a data source. The implementation passes it through (after parseInt) to backend endpoints that look up data_source by primary key (per backend sidecar). No drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:37 + backend DirectoryController sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE; the caveat is the NaN-swallowing (recorded under bugs_limitations_corner_cases[1]), not a name-vs-implementation drift."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. The path param is consumed end-to-end."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:37 + grep over consumers"
      routes_to_finding: "N/A — no drift; NaN-swallowing is bugs_limitations_corner_cases[1]"
    - location: "directoryRoutes.ts:30-32 (the useParams destructure) + line 34 (the 'all' coercion)"
      input_kind: path-param
      input_name: "typeId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric id of a DataEntityType (TABLE / FILE / STREAM / JOB / MODEL / ...) per the OpenAPI DataEntityType DTO, OR the literal string 'all' meaning 'no type filter; show all entity types of this data source'. The dual-shape is encoded in the field's type `undefined | number` (line 26): after the hook's coercion, `'all'` → undefined, anything else → parseInt result."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:26 (interface) + directoryRoutes.ts:34 (the 'all' coercion) + EntitiesTabs.tsx:14-26 (the type-tabs UI)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Coerced via `typeId === 'all' ? undefined : parseInt(typeId, 10)` (line 34), then returned. Consumers use the COERCED value as: (a) the `typeId` arg to `useGetDataSourceEntities({dataSourceId, size, typeId, enabled})` in Entities.tsx:36-41 → backend `/api/directory/datasources/{id}?type_id={typeId}&page=&size=` — undefined typeId omits the query param (so the backend returns all types); (b) the 'show Type column?' toggle in TableHeader.tsx:22 (`if (!typeId) cells.splice(1, 0, { name: t('Type'), ... })` — type column appears ONLY in 'all' view); (c) the tab-selection-index calc in EntitiesTabs.tsx:34-37 (`tabs.findIndex(tab => String(tab.value) === String(typeId))`); (d) the 'show type label?' decision in EntityItem.tsx:81-85 (renders the type cell ONLY when typeId is undefined — i.e. in 'all' view). The coerced value branches FOUR UI/data behaviours."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:34 + Entities.tsx:20,36-41 + TableHeader.tsx:13,22 + EntitiesTabs.tsx:13,34-37 + EntityItem.tsx:40,81-85"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The name `typeId` accurately describes what the input is in the numeric case (a DataEntityType id), AND the additional 'all' sentinel is consistent across this module, the inner Routes, the EntitiesTabs builder, and the documentation. The doc page (verified 2026-05-26 status 200) lists the level-3 URL pattern with `/all` verbatim — the docs and the code agree. No drift. The `'all'` literal is a load-bearing magic string (recorded under bugs_limitations_corner_cases[2]) but that is a CONSISTENCY concern (no named constant unites the three locations using it), not a name-vs-implementation drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:34 + EntitiesTabs.tsx:26 + Directory/DirectoryRoutes.tsx:16 + WebFetch /features/data-discovery/directory 2026-05-26 status 200"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE. The dual-shape (numeric OR 'all') is documented in the live doc AND encoded in the TypeScript type annotation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. The DataEntityType.id is the canonical field this path param refers to and is consumed end-to-end."
          confidence: STATIC-INFERRED
          evidence: "directoryRoutes.ts:34 + grep over consumers"
      routes_to_finding: "N/A — no drift; magic-string consistency is bugs_limitations_corner_cases[2]"
  probes_emitted:
    - probe_id: P-169
      question: "Auth gate Category D — does the minimum-privilege authenticated user (LOGIN_FORM, no Permissions, no Owner association) actually navigate the full four-level /directory hierarchy AND see all ODDRN-derived properties (host, database, port) for every registered data source? The frontend route mount is bare (no WithPermissionsProvider), and even if it WERE wrapped, WithPermissionsProvider is non-blocking (ZH finding). The backend has NO @PreAuthorize per the DirectoryController sidecar. Hypothesis: the minimum-privilege user fully enumerates the catalog inventory — the visual outcome confirms the cross-owner read-collaborative posture for the UI surface end-to-end."
      probe_path: "lineage/odd-platform/probes/P-169.yaml"
  stress_summary:
    triggers_total: 8         # 4 name-behavior pairs + 1 auth_gate site + 3 request_inputs
    questions_total: 23       # 4 name-behavior + 4 auth + 3*5 request_inputs = 4 + 4 + 15 = 23
    answers_static_inferred: 22
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this module is a plain TypeScript module exporting a string constant, a builder, and a hook. It is not on the HTTP surface; it carries no auth predicates, no fetch calls, and no role/permission checks. The four ODD authentication modes (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) are enforced globally by `*SecurityConfiguration` beans on the backend, which protect the backend endpoints the consumer components' data fetches hit — not the client URL strings this module declares. Per WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (referenced in the `dataQualityRoutes` sidecar 2026-05-26 status 200), auth modes branch backend behaviour; this UI module does not branch under any mode. — evidence: `directoryRoutes.ts:1-63` (no auth-related imports or branches)
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag gates `POST /ingestion/entities` server-side only; it has no relationship to UI routes.
- **authorization_assertions**: [] — the module enforces no permission. The CONSUMER (`App.tsx:72`) also enforces no permission — the route is a bare `<Route path=`${directoryPath()}/*`>` with no `WithPermissionsProvider`, contrasting the sibling `/lookup-tables` route (`App.tsx:75-88`) which IS wrapped on `LOOKUP_TABLE_CREATE | _UPDATE | _DELETE`. The 'Directory' top-bar tab (`ToolbarTabs.tsx:40-44`) is rendered unconditionally — no permission check. EVEN IF wrapped, `WithPermissionsProvider` is non-blocking per the ZH finding (`WithPermissionsProvider.tsx:12-49` — provides a context but always renders children; only inner controls hide via the `isAllowedTo` callback). — evidence: `App.tsx:72` (bare route) + `App.tsx:75-88` (the contrasting gated sibling) + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49`
- **owner_scoping**: `N/A — this node is not data-scoped`. The module returns a string / builds URLs / parses URL params; it fetches and renders no data. Owner-scoping of the Directory's data inventory (or rather, the lack of owner-scoping per the cross-owner read posture) is a property of the backend DirectoryController + DirectoryService + DataEntityService chain, fully pinned by the backend `DirectoryController` sidecar's `security.owner_scoping = BYPASSES — returns data across owners (no owner filter)`. — evidence: `directoryRoutes.ts:1-63` (no data, no scoping)
- **data_exposure**:
  - "The literal strings `/directory`, `/directory/{prefix}`, `/directory/{prefix}/{dsId}/all`, `/directory/{prefix}/{dsId}/{typeId}` are emitted into the rendered HTML/JS bundle for every authenticated session and are discoverable to anyone who can fetch the SPA bundle → no audience restriction at this layer; under `auth.type=DISABLED` the bundle is reachable unauthenticated. The URL patterns themselves are non-secret routing shapes (parallel to the public source on GitHub) — recorded for completeness, not as a confidentiality concern." — evidence: `directoryRoutes.ts:4,49-50,59-60` (the URL literals)
- **known_security_gaps**:
  - "**Frontend route mount has NO permission gate; the `WithPermissionsProvider` wrapper is non-blocking even if used.** The `/directory` URL declared by this module is mounted at `App.tsx:72` with NO `WithPermissionsProvider` wrapper (bare `<Route path=`${directoryPath()}/*`>`), unlike the sibling `/lookup-tables` route at `App.tsx:75-88` (which IS wrapped). The toolbar tab building this URL (`ToolbarTabs.tsx:40-44`) is rendered unconditionally. Any authenticated principal — including a minimum-privilege user with zero Permissions and zero ownership — can navigate to every level of the Directory and renders the full inventory. Additionally, the ZH finding establishes that `WithPermissionsProvider` is NON-BLOCKING: `WithPermissionsProvider.tsx:12-49` ALWAYS renders the children/Component regardless of permissions; only the inner controls hide via the `isAllowedTo` callback. So even a hypothetical fix that wrapped this route would NOT gate it — the wrapper would need to be combined with a render-block check at the wrapped component's top. The backend authorization posture for the four Directory endpoints is pinned by the backend `DirectoryController` sidecar: NO `@PreAuthorize`, NO entry in `SecurityConstants.SECURITY_RULES`, cross-owner read posture, ODDRN-derived properties leak. The doc-side is silent on access control (both `/features/data-discovery/directory` and `/developer-guides/api-reference/directory` verified 2026-05-26 status 200 make no mention of permissions or who can view the Directory). The full cross-surface picture (frontend unrestricted + backend cross-owner + doc silent) is the MEDIUM-severity reconnaissance surface flagged by the backend sidecar's `security.known_security_gaps[0]`. This is an inherited finding from the consumer side, not a defect in this URL-declaration module — surfaced here so the cross-surface picture is complete. P-169 pins whether the visual outcome of a minimum-privilege user is the full inventory." — evidence: `directoryRoutes.ts:1-63` (no own guard) + `App.tsx:72` (bare consumer mount) + `App.tsx:75-88` (gated sibling, for contrast) + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49` (non-blocking — the ZH finding) + backend `DirectoryController` sidecar `security.known_security_gaps[0]` + P-169 + WebFetch `/features/data-discovery/directory` + `/developer-guides/api-reference/directory` 2026-05-26 — severity: MEDIUM

## performance

- **hot_paths**:
  - "`directoryPath()` is invoked at module-init by `App.tsx:72` to set up the `<Route>` element, and at render time by `ToolbarTabs.tsx:42` (rendered as part of the global toolbar on every navigation). The function body is `return '/directory'` — cost is negligible (O(1), zero allocations beyond the interned string literal)." — evidence: `directoryRoutes.ts:6-8` + `App.tsx:72` + `ToolbarTabs.tsx:42`
  - "`useDirectoryRouteParams()` is invoked by six sibling components (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) on every render under the `/directory/*` subtree. The hook calls `useParams()` (delegates to react-router-dom internal state, O(1)) and a single `parseInt`/conditional pair (O(1)). Cost is negligible per invocation; the multiplier is the EntityItem render — for a level-4 page of 30 entity rows, `useDirectoryRouteParams` fires 30 times (one per EntityItem render) on every list update. Re-runs are not memoised at this layer (hook returns a fresh object each call), but consumers can memoise downstream if needed." — evidence: `directoryRoutes.ts:29-41` + six consumer files + the EntityItem render in EntitiesList
  - "`directoryDataSourcePath(prefix, dsId, typeId)` is invoked inside the `tabs` useMemo of `EntitiesTabs.tsx:16-31` — gated by `[types, dataSourceTypePrefix, dataSourceId]` (line 31); the function fires once per type tab on each memo re-evaluation. For a typical data source with ~5-15 entity types, that is 5-15 `generatePath` calls per memo re-eval. `generatePath` itself is O(L) in URL pattern length — sub-microsecond. Not a hot path."
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O.`
- **resource_allocation**: `Trivial — string constants returned, plus per-call generatePath / parseInt invocations. The bundle-size cost is approximately the length of `'/directory'` plus the function bodies after minification (tens of bytes). The hook produces a fresh object per call — minor GC pressure on heavy subtree renders, negligible in practice.` — evidence: `directoryRoutes.ts:1-63`
- **scaling_characteristics**: `Stateless and pure — `directoryPath`, `directoryDataSourcePath`, `useDirectoryRouteParams` are referentially transparent (the hook depends on react-router-dom state which IS observable from outside this module, but the hook itself is a thin wrapper). No closures over mutable state, no module-level mutation, no side effects. Scales horizontally with the React render tree at zero cost.` — evidence: `directoryRoutes.ts:1-63`
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/directory/*"
  caller_node: "odd-platform ts route-registry App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:19 (`import { ..., directoryPath, ... } from 'routes'`) + App.tsx:72 (`<Route path={`${directoryPath()}/*`} element={<DirectoryRoutes />} />`). The function is called once at App-module initialization to produce the `path` prop for the `<Route>` element. The resulting string is then matched by React Router on every navigation. The function itself is NOT invoked per navigation — only the route match is."
  observation_class: ui-call
  caller_node_unresolved: true

- entry_point: "ui_button:ToolbarTabs 'Directory' tab"
  caller_node: "odd-platform ts react-component component:ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:17 (`import { ..., directoryPath, ... } from 'routes'`) + ToolbarTabs.tsx:42 (`link: directoryPath()`, inside the `tabs` useMemo). The function is invoked each time the `tabs` memo re-evaluates — gated by `[activityQueryString, t]` (line 81-82), so the function fires once per locale change or activity-query-string change, NOT once per render. The returned string is the navigation target when the user clicks the 'Directory' tab."
  observation_class: ui-call
  caller_node_unresolved: true

- entry_point: "ui_route:/ (Catalog Overview landing)"
  caller_node: "odd-platform ts react-component component:Overview-DirectoryItem"
  multiplicity_per_trigger: "N (one per data-source-type card)"
  evidence: "Overview/Directory/DirectoryItem.tsx:4 (`import { directoryDataSourcePath } from 'routes'`) + Overview/Directory/DirectoryItem.tsx:16 (`to={directoryDataSourcePath(prefix)}`). For each DataSourceType card rendered by the Catalog Overview Directory section, the builder is invoked once with the single-arg fallback branch — producing the level-2 URL `/directory/{prefix}`. For a deployment with M registered data-source types, M builder invocations per Overview render."
  observation_class: ui-call
  caller_node_unresolved: true

- entry_point: "ui_route:/directory/{prefix}/{dsId}/{typeId}"
  caller_node: "odd-platform ts react-component component:EntitiesTabs"
  multiplicity_per_trigger: "K (one per entity type tab + 1 for 'All' tab)"
  evidence: "EntitiesTabs.tsx:6 (`import { directoryDataSourcePath, useDirectoryRouteParams } from 'routes'`) + EntitiesTabs.tsx:19 (`link: directoryDataSourcePath(dataSourceTypePrefix, dataSourceId, id)` per entity type) + EntitiesTabs.tsx:26 (`link: directoryDataSourcePath(dataSourceTypePrefix, dataSourceId, 'all')` for the 'All' tab). Per data source, the builder fires (K + 1) times — K = number of distinct entity types in this data source — on each memo re-evaluation, gated by `[types, dataSourceTypePrefix, dataSourceId]` (line 31)."
  observation_class: ui-call
  caller_node_unresolved: true

- entry_point: "ui_route:/directory/* (any subtree page reading params)"
  caller_node: "six React components (DataSourceList, Entities, DirectoryBreadCrumbs, EntitiesTabs, EntityItem, TableHeader)"
  multiplicity_per_trigger: "1 per consumer per render — for EntityItem, multiplied by entity-row count (up to 30 per page)"
  evidence: "DataSourceList.tsx:20,27 + Entities.tsx:12,20 + DirectoryBreadCrumbs.tsx:6,13 + EntitiesTabs.tsx:6,13 + EntityItem.tsx:13,40 + TableHeader.tsx:5,13. Each consumer calls useDirectoryRouteParams() once per render; the hook reads useParams() (react-router-dom internal state) and returns the typed param object. NO consumer guards against NaN dataSourceId."
  observation_class: ui-call
  caller_node_unresolved: true

# NOTE: Grep across odd-platform-ui at commit ede5d277 confirms exactly the
# five caller categories above. No additional callers of directoryPath,
# directoryDataSourcePath, or useDirectoryRouteParams exist.

## downstream_side_effects

- side_effect_class: page-render
  description: "Indirectly, by serving as the `path` prop on the `App.tsx:72` `<Route>` element, this URL declaration is the trigger that causes React Router to mount `<DirectoryRoutes />` (and its four inner Route children) when the location matches `/directory` or any sub-path. The module itself produces no DOM, no fetch, no log, no metric, no header — it returns strings and parsed objects consumed by react-router-dom. The page-render is downstream of the consumer, not of this module."
  evidence: "directoryRoutes.ts:1-63 (the URL contract) + App.tsx:72 (the consumer that mounts <DirectoryRoutes/> when the URL matches) + Directory/DirectoryRoutes.tsx:11-17 (the inner subtree)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/directory"
    - "ui_route:/directory/{prefix}"
    - "ui_route:/directory/{prefix}/{dsId}/all"
    - "ui_route:/directory/{prefix}/{dsId}/{typeId}"
    - "ui_button:ToolbarTabs 'Directory' tab"
    - "ui_route:/ (Catalog Overview Directory section link)"

- side_effect_class: redirect-issue
  description: "Indirectly, the level-3 URL `/directory/{prefix}/{dsId}` (no typeId) causes a Navigate-replace redirect to `/directory/{prefix}/{dsId}/all` per `Directory/DirectoryRoutes.tsx:15-17`. The redirect is operator-visible as a URL change in the browser address bar (the `replace` semantic means it doesn't appear in browser history). This module's contribution: it declares the URL shape that the inner Routes match against. The redirect itself is owned by the inner subtree."
  evidence: "directoryRoutes.ts:43-62 (the builder has no level-3 branch) + Directory/DirectoryRoutes.tsx:15-17 (the Navigate route)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/directory/{prefix}/{dsId} (deep-link)"
    - "ui_call: clicking a DataSource row from level 2"

# NOTE: This module's downstream_side_effects is intentionally minimal. The
# module itself does NOTHING beyond returning strings and parsed objects.
# The render of <DirectoryRoutes/> and its children is owned by the consumer
# (App.tsx + Directory/DirectoryRoutes.tsx); the backend data fetches are
# owned by `lib/hooks/api/directory.ts`; the breadcrumb/tab/table rendering
# is owned by the respective components. This sidecar records the page-render
# AND redirect-issue side effects because the URL declaration is the upstream
# necessary-condition for both — but neither side effect is produced by this
# file directly. Recorded for cross-surface completeness.

## sources

- understanding ← `directoryRoutes.ts:1-63` + `App.tsx:19, 38, 72` + `ToolbarTabs.tsx:17, 42` + `Directory/DirectoryRoutes.tsx:1-22` + `App.tsx:75-88` (the contrasting gated sibling route) + `WithPermissionsProvider.tsx:12-49` (the ZH non-blocking finding)
- concepts.entities ← `directoryRoutes.ts:2,10-15,17-21,23-27,34`
- concepts.operations ← `directoryRoutes.ts:6-8,29-41,43-62`
- concepts.invariants[0] ← `directoryRoutes.ts:4` + `Directory/DirectoryRoutes.tsx:11-17`
- concepts.invariants[1] ← `directoryRoutes.ts:34` + `Directory/DirectoryRoutes.tsx:16` + `EntitiesTabs.tsx:26`
- concepts.invariants[2] ← `directoryRoutes.ts:37` + six consumer files
- concepts.invariants[3] ← `directoryRoutes.ts:43-62`
- concepts.invariants[4] ← `Directory/DirectoryRoutes.tsx:14-17`
- concepts.invariants[5] ← `directoryRoutes.ts:6` + sibling path builders
- concepts.invariants[6] ← `directoryRoutes.ts:47`
- concepts.audiences[0] ← `ToolbarTabs.tsx:40-44` (unconditional tab) + `App.tsx:72` (bare route)
- concepts.audiences[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-26 status 200
- concepts.audiences[2,3] ← backend DirectoryController sidecar + live doc + ToolbarTabs unconditional tab
- dependencies_semantic.requires-feature ← `App.tsx:72` (the URL is meaningful only when the route is mounted) + Directory/DirectoryRoutes.tsx
- dependencies_semantic.requires-runtime ← `directoryRoutes.ts:1-2` (imports) + sibling routes for the import-shape comparison
- dependencies_semantic.couples-to ← `App.tsx:19, 72` + `ToolbarTabs.tsx:17, 42` + `Directory/DirectoryRoutes.tsx:11-17` + `Overview/Directory/DirectoryItem.tsx:4, 16` + `Directory/Entities/EntitiesTabs.tsx:6, 19, 26` + six useDirectoryRouteParams call sites + `routes/index.ts:5`
- tests_coverage_semantic.test_files ← Grep over `odd-platform-ui/src` for `directoryPath` / `directoryDataSourcePath` / `useDirectoryRouteParams` in `*.test.*` / `*.spec.*` returned no matches at commit ede5d277
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-26 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/directory` 2026-05-26 status 200
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/data-discovery/directory` 2026-05-26 status 404
- docs_link_semantic.doc_drift_findings[0] ← four URL patterns in `directoryRoutes.ts` + `Directory/DirectoryRoutes.tsx:11-17` + WebFetch confirms verbatim match 2026-05-26
- docs_link_semantic.doc_drift_findings[1] ← `App.tsx:72` (no guard) + `ToolbarTabs.tsx:40-44` (unconditional tab) + `WithPermissionsProvider.tsx:12-49` (non-blocking) + WebFetch `/features/data-discovery/directory` + `/developer-guides/api-reference/directory` 2026-05-26 (both silent on access control) + backend `DirectoryController` sidecar
- docs_link_semantic.doc_drift_findings[2] ← `directoryRoutes.ts:34` (the 'all' coercion) + WebFetch 2026-05-26 (doc lists `/all` verbatim without explaining the sentinel)
- implicit_adrs[0] ← `directoryRoutes.ts:1-63` + `routes/index.ts:5` + all sibling route modules under `odd-platform-ui/src/routes/`
- implicit_adrs[1] ← `directoryRoutes.ts:10-15` (param-name constants) + `directoryRoutes.ts:17-21` (interface) + `directoryRoutes.ts:29-41` (hook) + `directoryRoutes.ts:43-62` (builder)
- implicit_adrs[2] ← `directoryRoutes.ts:34,47` + `Directory/DirectoryRoutes.tsx:15-17` + `EntitiesTabs.tsx:26` + `TableHeader.tsx:22`
- implicit_adrs[3] ← `directoryRoutes.ts:48-62` + `Directory/DirectoryRoutes.tsx:14-17` + `EntitiesTabs.tsx:26`
- bugs_limitations_corner_cases[0] ← `directoryRoutes.ts:1-63` (no own guard) + `App.tsx:72` (bare mount) + `App.tsx:75-88` (contrasting gated sibling) + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49` + backend `DirectoryController` sidecar + P-169
- bugs_limitations_corner_cases[1] ← `directoryRoutes.ts:37` (no `isNaN`) + six consumer files + `Entities.tsx:36-41` (NaN flows to API)
- bugs_limitations_corner_cases[2] ← `directoryRoutes.ts:34` + `Directory/DirectoryRoutes.tsx:16` + `EntitiesTabs.tsx:26` + `TableHeader.tsx:22`
- bugs_limitations_corner_cases[3] ← `directoryRoutes.ts:10,12,14` + `Directory/DirectoryRoutes.tsx:11-17`
- bugs_limitations_corner_cases[4] ← `directoryRoutes.ts:48` (the `dsId && typeId` guard) + Grep over consumers (no two-arg shape)
- bugs_limitations_corner_cases[5] ← Grep over `odd-platform-ui/src` `*.test.*` and `*.spec.*` for `directoryPath` / `directoryDataSourcePath` / `useDirectoryRouteParams` — no matches at ede5d277
- stress_findings.name_behavior_pairs[0] ← `directoryRoutes.ts:6-8` + `App.tsx:72` + `ToolbarTabs.tsx:42`
- stress_findings.name_behavior_pairs[1] ← `directoryRoutes.ts:43-62` + `Directory/DirectoryRoutes.tsx:11-17` + `EntitiesTabs.tsx:19,26` + `Overview/Directory/DirectoryItem.tsx:16`
- stress_findings.name_behavior_pairs[2] ← `directoryRoutes.ts:29-41` + six consumer files
- stress_findings.name_behavior_pairs[3] ← `ToolbarTabs.tsx:40-44` + `App.tsx:72` + `Directory/DirectoryRoutes.tsx:8-22` + WebFetch `/features/data-discovery/directory` 2026-05-26 + two Overview vs Directory DirectoryItem files
- stress_findings.auth_gates ← `directoryRoutes.ts:1-63` + `App.tsx:72` + `App.tsx:75-88` + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49` + backend `DirectoryController` sidecar + P-169
- stress_findings.request_inputs ← `directoryRoutes.ts:30-32,34,37,38` + six consumer files + backend `DirectoryController` sidecar
- security.authorization_assertions ← `App.tsx:72` + `App.tsx:75-88` + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49`
- security.known_security_gaps[0] ← `App.tsx:72` + `App.tsx:75-88` + `ToolbarTabs.tsx:40-44` + `WithPermissionsProvider.tsx:12-49` + WebFetch `/features/data-discovery/directory` + `/developer-guides/api-reference/directory` 2026-05-26 + backend `DirectoryController` sidecar + P-169
- performance.hot_paths[0,1] ← `directoryRoutes.ts:6-8, 29-41` + `App.tsx:72` + `ToolbarTabs.tsx:42` + six consumer files
- performance.hot_paths[2] ← `EntitiesTabs.tsx:16-31`
- upstream_callers[0] ← `App.tsx:19, 72`
- upstream_callers[1] ← `ToolbarTabs.tsx:17, 42, 81-82`
- upstream_callers[2] ← `Overview/Directory/DirectoryItem.tsx:4, 16`
- upstream_callers[3] ← `EntitiesTabs.tsx:6, 19, 26`
- upstream_callers[4] ← six consumer files reading `useDirectoryRouteParams()`
- downstream_side_effects[0] ← `directoryRoutes.ts:1-63` + `App.tsx:72` + `Directory/DirectoryRoutes.tsx:11-17`
- downstream_side_effects[1] ← `directoryRoutes.ts:43-62` + `Directory/DirectoryRoutes.tsx:15-17`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH
  # 22 of 23 stress questions resolve STATIC-INFERRED with strong file:line
  # evidence; the 1 PROBE-NEEDED question (Category D auth-gate, minimum-
  # privilege user's visual outcome through the full /directory hierarchy)
  # is emitted as P-169. The frontend-layer ambiguity is statically certain
  # (bare mount + non-blocking WithPermissionsProvider + unconditional tab);
  # P-169 pins the backend half's visual outcome end-to-end. The route-depth
  # Category B finding (level-3 reached via Navigate redirect, not via the
  # builder) is fully STATIC-INFERRED — no PROBE-NEEDED for that. The
  # Category F findings across the three path params (dataSourceTypePrefix,
  # dataSourceId, typeId) all resolve MATCHES/STATIC-INFERRED with no
  # drift — the dual-shape `typeId: number | 'all'` is documented in both
  # code (line 47 type annotation) and live doc.

## Maintainer notes

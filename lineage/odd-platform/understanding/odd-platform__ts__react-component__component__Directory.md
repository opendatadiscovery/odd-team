---
node_id: "odd-platform ts react-component component:Directory"
node_kind: react-component
axis: ui_components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-ZA-Directory
feature_hint: "P-01:F-007 (Directory Browsing UI — 4-level catalog drill-down). LEVEL-1 ENTRY surface of F-023 (just minted batch T): the user-facing root-card grid at `/directory` that renders one card per ODDRN-prefix bucket (postgresql, snowflake, kafka, airflow, mysql, ...) with the `entitiesCount` aggregate per bucket. Sister UI nodes: `DataSourceList` (level 2 — datasource instances within a prefix), `EntitiesTabs` + `EntitiesList` (level 3 + 4 — type filter + paged entity list). The four UI levels mount through `DirectoryRoutes` (DirectoryRoutes.tsx:8-20) — this sidecar is the level-1 root. The corresponding API entry point is `GET /api/directory` (DirectoryController.java:23-26, batch T primary source), backed by `DirectoryServiceImpl.getDataSourceTypes` (DirectoryServiceImpl.java:48-50). Batch ZA is the FINAL batch of the ontology sprint — this sidecar closes the UI half of F-023 from the level-1 entry side; level-2/3/4 UI sidecars remain unwritten (deferred)."
related_features:
  - F-023  # Directory Browsing — the just-minted P-01:F-007 batch-T feature; this sidecar is the level-1 UI entry contributing_node
related_pillar_features:
  - "P-01:F-007"
related_refactors:
  - REFACTOR-024  # cross-owner read posture family — Directory level 1 is the CATALOG-CARDINALITY enumeration vector at the UI tier (every authenticated user sees how many entities per ODDRN-prefix bucket, including for buckets the user has no Owner relationship with)
  - REFACTOR-185  # auth.type=DISABLED bypass — Directory.tsx renders the level-1 grid with NO `appInfo.authType` gate (unlike Overview.tsx where DISABLED hides the Recommended panel); under `auth.type=DISABLED` the `/directory` route is anonymously reachable AND the level-1 cards render
  - REFACTOR-203  # graph-shaped cross-owner enumeration sibling — Directory level 1 is the FLAT-LIST entry to the family; the per-prefix entitiesCount is the catalog-shape signal complementary to lineage edges
related_adrs:
  - ADR-CANDIDATE-003  # read-collaborative catalog posture — Directory level 1 IS this posture's catalog-wide-aggregate-count surface at the UI tier
  - ADR-CANDIDATE-122  # catalog-wide aggregate counts as deliberate design — `entitiesCount` per ODDRN-prefix bucket displayed unconditionally to every authenticated user
related_concepts:
  - directory
  - oddrn
  - read-collaborative-catalog-posture
related_sidecars:
  - odd-platform__java__DirectoryController__controller-class__DirectoryController  # batch T primary-source — the API the `useGetDataSourceTypes` hook calls
  - odd-platform__ts__react-component__component__PopularStrip  # sibling UI sidecar (Overview / Catalog-Overview surface) — the OTHER F-003 home-page entry; both are owner-unscoped at the read tier
  - odd-platform__ts__react-component__component__DataEntityDetails  # the LSN-017 useEffect dep-array sidecar — explicitly cross-referenced for the doubling-pattern coherence check
related_retrospectives:
  - LSN-017  # useEffect dep-array doubling — explicitly tested HERE: this component uses TanStack `useQuery`, NOT `useEffect`; the doubling pattern DOES NOT apply (see implicit_adrs for the design choice)
  - LSN-018  # coherence pre-emit check — cross-checked against F-023 (batch T) + DirectoryController sidecar + PopularStrip + DataEntityDetails (sister UI nodes)
coherence_check:
  performed: true
  strengthens:
    - target: F-023
      target_drift_facet: cross_owner_datasource_inventory_enumeration
      note: |
        F-023 batch-T enumerates the CONTROLLER-tier read posture
        (DirectoryController.java:23-51 + DirectoryServiceImpl.java:48-50
        — no @PreAuthorize, no owner-derived predicate). This sidecar
        adds the UI-TIER confirmation: the `useGetDataSourceTypes` hook
        (directory.ts:12-21) consumes the unscoped API and the component
        renders all `dataSourceTypes` returned, looped via `.map()` at
        Directory.tsx:38-45. There is NO client-side filter, NO permission
        gate, NO `appInfo.authType` check, NO conditional rendering by
        Owner association. The level-1 grid surfaces the catalog-wide
        ODDRN-prefix-bucket inventory to every viewer who reaches the
        `/directory` route — the UI half of the F-023 cross-owner
        enumeration vector. Each card is a `<Link to={prefix}>` (level-2
        navigation), so an attacker drilling further enumerates every
        registered datasource instance per bucket (level-2 surface, also
        unscoped per F-023).
    - target: REFACTOR-185
      target_drift_facet: disabled_mode_reachability_directory
      note: |
        Unlike `OwnerAssociation` (Overview.tsx:53-59) which gates the
        Recommended panel by `appInfo.authType !== 'DISABLED'`,
        Directory.tsx has NO `authType` check. The route mount
        (App.tsx:72 `<Route path={`${directoryPath()}/*`} element={<DirectoryRoutes />}/>`)
        is unconditional. Under `auth.type=DISABLED` the SPA serves
        `/directory` to any anonymous caller AND the level-1 cards
        render with full `entitiesCount` data. The DISABLED-mode UI-tier
        reach is the structural twin of the controller-tier reach
        F-023 documents at the API layer — both UI and API surfaces
        are unauthenticated-reachable under DISABLED.
    - target: REFACTOR-024
      target_drift_facet: catalog_cardinality_enumeration_ui_tier
      note: |
        REFACTOR-024 batch-M added the FACET-AGGREGATOR enumeration
        vector (catalog cardinality via owner-names / tag-names /
        namespace-names / group-names + counts). This sidecar adds the
        DIRECTORY-LEVEL-1 vector: the count of entities per ODDRN-prefix
        bucket. The signal is narrower in dimension (prefix bucket vs.
        owner / tag / namespace / group) but the privacy property is
        identical — an authenticated user with no Owner binding learns
        "this platform has N PostgreSQL entities, M Snowflake entities,
        K Kafka entities" catalog-wide. This is the FOURTH UI-tier
        confirmation of the catalog-cardinality enumeration shape
        (after SearchController.facets, OwnerEntitiesList sums, and
        the search-result counts).
  reinforces:
    - target: ADR-CANDIDATE-122
      note: |
        Catalog-wide aggregate counts as deliberate design extends to
        the Directory level-1 cards. The doc page
        `https://docs.opendatadiscovery.org/features/data-discovery/directory`
        (WebFetched 2026-05-20 status 200) describes the surface as
        "One card per ODDRN prefix that the platform's registered data
        sources resolve to" — the design IS the catalog-wide aggregate
        view. Cross-link with PopularStrip and SearchController.facets:
        the home page exposes the same shape via Recommended.
  supersedes: []
  conflicts_surfaced: []
  not_applicable:
    - target: LSN-017
      target_drift_facet: useeffect_dep_array_doubling
      note: |
        LSN-017's exact pattern is `useEffect(() => dispatch(thunk), [..., responseDerivedDep])`
        where one of the dependency array members is itself produced by
        the fetch (DataEntityDetails.tsx:56-64 — `details.status?.status`).
        This component uses TanStack `useQuery` (directory.ts:12-21),
        NOT `useEffect`. `useQuery` fetches based on `queryKey` identity,
        not on a useEffect dep array; the query fires once per mount
        for the static `queryKey: ['dataSourceTypes']`, returns from
        cache on subsequent mounts unless invalidated (none observed),
        and does NOT refetch when the response-derived `data` changes.
        The doubling pattern that produces +2 view_count per page-open
        in DataEntityDetails CANNOT occur here. Confirmed by reading
        Directory.tsx:14-23 + directory.ts:12-21 end-to-end + checking
        the global QueryClient defaults at index.tsx:39-47
        (`refetchOnWindowFocus: false`, `retry: false`) — no implicit
        refetch path exists for this query.
    - target: REFACTOR-425
      target_drift_facet: page_vs_count_predicate_divergence
      note: |
        REFACTOR-425 the page-vs-count divergence (and the structurally
        analogous REFACTOR-NEW filed in F-023 batch T for the
        `listByDatasourceAndType` / `countByDatasourceAndType` level-4
        delegate) applies to PAGED responses where the `page.size` total
        diverges from a separate count query. The level-1 `/api/directory`
        endpoint (this component's only API consumer) returns
        `DataSourceTypeList` — a complete list of ODDRN-prefix buckets
        with their entity counts, NO pagination, NO separate count
        query. The page-vs-count divergence shape DOES NOT apply at
        level 1. The bug surfaces at level 4 only — in `Entities` /
        `EntitiesList` (sister UI components NOT enriched this batch).
        Filed as not-applicable rather than reinforce to make explicit
        that the level-1 root has been audited for the pattern.
---

# Directory (level-1 root — `/directory` ODDRN-prefix card grid) — semantic understanding

## understanding

`Directory.tsx` (57 lines) is the level-1 root of the F-023 four-level catalog drill-down — the SPA entry point mounted at `/directory` via `DirectoryRoutes.tsx:11` (the `<Route path='/' element={<Directory />}/>` inside `DirectoryRoutes`, which itself is mounted at `App.tsx:72` `<Route path={`${directoryPath()}/*`} element={<DirectoryRoutes />}/>` with `directoryPath() = '/directory'`). The component renders **one card per ODDRN-prefix bucket** observed across the platform's registered data sources, in a `Grid container` (MUI), looping over the `dataSourceTypes` returned by the `useGetDataSourceTypes` hook (`Directory.tsx:16-22`). Each card is a `DirectoryItem` (`./DirectoryItem/DirectoryItem.tsx:15-29`) — a `<Link to={prefix}>` that navigates to the level-2 datasource-list under `/directory/{prefix}`. The data fetch is a TanStack Query (`useQuery({ queryKey: ['dataSourceTypes'], queryFn: directoryApi.getDataSourceTypes })` per `directory.ts:12-21`), NOT a `useEffect` + Redux thunk — the LSN-017 doubling pattern does not apply here (`useQuery` fires once per mount, cached by `queryKey` identity, no refetch on response-derived dependency change; global defaults at `index.tsx:39-47` set `retry: false` + `refetchOnWindowFocus: false`).

Three load-bearing UX states render conditionally: `isLoading && <AppLoadingPage />`, `isError && <AppErrorPage error={...}/>`, and `dataSourceTypes && <ScrollableContainer>...</ScrollableContainer>` plus an `EmptyContentPlaceholder` for the empty-list case (`Directory.tsx:29-52`). The component is the UI-tier confirmation of F-023's batch-T cross-owner enumeration finding: there is NO permission check, NO `appInfo.authType` gate, NO Owner-association gate, NO per-Owner filter; the level-1 grid renders identically for every viewer that reaches `/directory` — under LOGIN_FORM/OAUTH2/LDAP for any authenticated user, AND under `auth.type=DISABLED` for any anonymous caller. The cardinality of the rendered grid IS a catalog-wide aggregate enumeration surface — the count of entities per ODDRN-prefix bucket (`entitiesCount` field, rendered at `DirectoryItem.tsx:23-25` as `{pluralize(entitiesCount, 'entity', 'entities')}`). The infrastructure-property leak from F-023 facet 2 (the `DirectoryServiceImpl.getOddrnPathProperties` reflection at `DirectoryServiceImpl.java:138-171`) does NOT surface at level 1 — this component renders only `{prefix, name, entitiesCount}` (`Directory.tsx:38-45`), the host/port/database/cluster ODDRN-derived properties are surfaced one level deeper at `DataSourceList`.

## concepts

- entities:
  - "`DataSourceType` (OpenAPI-generated DTO — `generated-sources` Type — returned by `GET /api/directory` as `DataSourceTypeList.items`; per-card fields rendered here are `{prefix, name, entitiesCount}` at Directory.tsx:38-45 + DirectoryItem.tsx:15-29; cross-link to F-023 chain hop 1 evidence)"
  - "`DataSourceTypeList` (the wire response — `{items: DataSourceType[]}` per the generated SDK; the `useGetDataSourceTypes` hook destructures `.items` at directory.ts:16-18 and returns ONLY the array, not the wrapper)"
  - "`ErrorState` (Redux interface used to coerce the React-Query `error` shape for AppErrorPage — `Directory.tsx:5` + `:33` `error as unknown as ErrorState`)"
  - "TanStack Query cache key — `['dataSourceTypes']` (directory.ts:14) — STATIC, no parameter — the query is shared across every mount of this component and any other consumer of `useGetDataSourceTypes` (verified: also consumed by `Overview/Directory/Directory.tsx:10` for the home-page Recommended-panel-adjacent surface; both consumers share the cache entry)"
  - "Route mount path — `directoryPath() = '/directory'` (routes/directoryRoutes.ts:4-8); the level-1 component mounts at the SPA's root directory path with no further segments"
  - "Translation key — `t('Directories')` (Directory.tsx:27) — note: ENGLISH plural form; the doc-product editorial framing in `documentation/docs/features/data-discovery/directory.md` and on the live page uses singular 'Directory' to name the feature, but the UI header is plural 'Directories' — a copy-tone divergence (not user-facing wrong but worth surfacing)"
  - "`DirectoryItem` (sibling component at Directory/DirectoryItem/DirectoryItem.tsx:15-29) — the per-card renderer; consumes `{name, prefix, entitiesCount}` and emits `<Link to={prefix}>` for level-2 navigation; uses `DatasourceLogo` from `components/shared/elements` to render the per-prefix icon"
  - "`pluralize` helper (lib/helpers — used at DirectoryItem.tsx:24 for `entity`/`entities` pluralization) — pure string helper, no i18n"
- operations:
  - "Mount → `useGetDataSourceTypes()` (Directory.tsx:16-22) → TanStack `useQuery` with `queryKey: ['dataSourceTypes']` (directory.ts:13-14) → on first mount fires `directoryApi.getDataSourceTypes()` (directory.ts:16) → wire call `GET /api/directory` → server-side `DirectoryController.getDataSourceTypes` (DirectoryController.java:23-26 per F-023 batch T) → returns `DataSourceTypeList` → hook destructures `items` array → component renders"
  - "Render loop: `dataSourceTypes.map(({ prefix, name, entitiesCount }) => <DirectoryItem ...>)` (Directory.tsx:38-45) — one DOM node per ODDRN-prefix bucket; the bucket roster includes `UNKNOWN_DATASOURCE_TYPE = 'other'` whenever any registered datasource has an ODDRN that fails parsing (DirectoryServiceImpl.java:101-110 per F-023 batch T) — the user sees 'other' as a normal bucket with no UI signal disambiguating it from a recognised prefix"
  - "Per-card click navigation: `<Link to={prefix}>` (DirectoryItem.tsx:16) → react-router-dom navigation to `/directory/{prefix}` → renders `<DataSourceList>` via the level-2 route (DirectoryRoutes.tsx:12) — drills into the level-2 ODDRN-prefix-filtered datasource roster"
  - "Loading state: `isLoading && <AppLoadingPage />` (Directory.tsx:29) — full-page loading indicator while the fetch is in-flight"
  - "Error state: `<AppErrorPage showError={isError} offsetTop={210} error={error as unknown as ErrorState}/>` (Directory.tsx:30-34) — full-page error placeholder; offsetTop=210 reserves space for the top app bar"
  - "Empty state: `<EmptyContentPlaceholder isContentLoaded={isSuccess} isContentEmpty={!dataSourceTypes?.length}/>` (Directory.tsx:47-50) — renders 'No information to display' (default empty-placeholder text) when fetch succeeded but the items array is empty (a deployment with zero registered datasources)"
  - "Header: `<Typography variant='h0'>{t('Directories')}</Typography>` (Directory.tsx:26-28) — static heading; no breadcrumbs at level 1 (breadcrumbs appear at levels 2-4 via `DirectoryBreadCrumbs` per `components/Directory/DirectoryBreadCrumbs/DirectoryBreadCrumbs.tsx`)"
  - "No cleanup, no abort signal, no manual refetch — TanStack Query handles cache lifecycle; the component does not invoke `queryClient.invalidateQueries(['dataSourceTypes'])` anywhere (verified by grep) — the level-1 list refreshes only on (a) a fresh app bootstrap, (b) cache eviction, or (c) explicit invalidation (none observed in this codebase)"
- invariants:
  - "**fetch fires once per mount via TanStack `useQuery`** — not via `useEffect`. The LSN-017 doubling pattern (useEffect dep array contains response-derived state → re-fires after fetch resolves) DOES NOT apply: `useQuery` re-fires only when the `queryKey` changes (here it's the STATIC `['dataSourceTypes']`), not when the returned `data` changes. The doubling of `view_count` documented in `DataEntityDetails.tsx:56-64` cannot occur here. Cross-reference: the structurally similar `Overview/Directory/Directory.tsx:10` (the home-page Recommended-panel-adjacent surface) uses the SAME hook and SHARES the TanStack Query cache entry — mounting this `/directory` route after the home-page mount returns the cached list, fires no second API call."
  - "**NO `appInfo.authType` gate at the component level — DISABLED-mode reaches the level-1 grid.** Unlike `OwnerEntitiesList` (which is gated by `OwnerAssociation`'s `appInfo.authType !== 'DISABLED'` check at Overview.tsx:53-59 — see PopularStrip sidecar invariant 6), this component renders unconditionally for any caller reaching `/directory`. Under `auth.type=DISABLED` an anonymous caller sees the full ODDRN-prefix bucket roster with per-bucket entity counts. The DISABLED-mode reach is the UI-tier confirmation of REFACTOR-185 + F-023 facet 5 (disabled_mode_anonymous_reach_directory)."
  - "**NO Owner-association gate, NO permission check, NO Redux-state pre-condition.** This component is a thin loader — no `useAppSelector` reads identity / ownership / appInfo / permissions; no `WithPermissionsProvider` wraps it; no `WithPermissions` guards any UI element inside. Every authenticated user (or anonymous caller under DISABLED) sees the identical level-1 grid. UI-tier confirmation of F-023 facet 1 (cross_owner_datasource_inventory_enumeration) at the catalog-cardinality dimension."
  - "**`entitiesCount` displayed verbatim per bucket** — `DirectoryItem.tsx:23-25` renders `{pluralize(entitiesCount, 'entity', 'entities')}`. The aggregate is server-computed (F-023 batch T evidence + DirectoryServiceImpl.java:48-50). No client-side filtering, masking, or 'show only my buckets' affordance. The count includes hollow / soft-deleted-but-not-cleaned entities iff the server-side count includes them (handled at the repository tier per F-023's REFACTOR-NEW finding for level 4; the level-1 count's predicate set is server-defined)."
  - "**`UNKNOWN_DATASOURCE_TYPE='other'` is rendered as a normal card with no UI signal.** The server-side bucket sentinel for unparseable ODDRNs (DirectoryServiceImpl.java:101-110 + F-023 facet 6 `unknown_oddrn_silent_bucket_to_other`) reaches this component as a `DataSourceType` row with `{prefix: 'other', name: 'Other'}`. No icon variant, no tooltip, no warning chip — the UI is mute about the data-quality signal the bucket represents. The live doc page (WebFetched 2026-05-20 status 200) makes no mention of the 'Other' bucket. Cross-link: F-023 facet 6."
  - "**Layout — MUI Grid + ScrollableContainer + `columnGap=1`/`rowGap=3`** (Directory.tsx:26-46) — flexible flow of equal-sized cards (`DirectoryItem.styles.ts:5-11` — `width: '160px'`, `LogoContainer` `height: '160px'`). For a deployment with hundreds of distinct ODDRN-prefix buckets (unlikely but unbounded — F-023 batch-T data point: 'typically <20 buckets including other'), the grid wraps and scrolls vertically inside `ScrollableContainer $offsetY={70}`."
  - "**`<Link to={prefix}>` relies on react-router's RELATIVE PATH resolution** — `prefix='postgresql'` from `<Route path='/' element={<Directory />}/>` resolves to `/directory/postgresql` (not `/postgresql`) because react-router-v6 nested routes treat `<Link to='postgresql'>` as relative to the current route. Verified by reading DirectoryRoutes.tsx:11-13 + App.tsx:72 + react-router-dom v6 nesting semantics. A future maintainer adding a top-level route with the same `prefix` value would NOT shadow the directory navigation."
  - "**Translation key `t('Directories')` (plural) vs doc-product feature name `Directory` (singular)** — Directory.tsx:27 uses plural; documentation/docs/features/data-discovery/directory.md and the live page use singular. Not a wrong-meaning bug but a tone divergence; cross-link to F-023 facet 9 (type_vs_class_dimension_doc_drift) as a related but distinct UI-vs-doc copy mismatch."
  - "**No `useMemo`, no `useCallback`, no key-stability hazard** — the `<DirectoryItem key={prefix}>` (Directory.tsx:40) uses the ODDRN prefix as React key. The prefix set is stable across re-fetches (TanStack `useQuery` returns the same row identity for the same `prefix` value), so React's reconciler avoids unnecessary card-remount churn. Server-side enumeration order is not stable (DirectoryServiceImpl uses `Stream.groupBy` without an explicit sort) — the visual order may change between mounts but the `prefix` key prevents flicker."
- audiences:
  - "platform-operator — primary audience: an operator reaching `/directory` to audit per-source-type coverage (per the doc page Use Cases: 'You want to see what data sources are registered in the platform without scrolling through search facets'; 'You're auditing per-source coverage — how many entities did the collector pull from each source')"
  - "data-engineer-analyst / data-scientist-ml-engineer / viz-bi-engineer — Data Discovery audiences using the hierarchy-driven browse as an alternative to query-driven Search"
  - "odd-platform-ui-end-user — any signed-in user reaching the top-nav Directory tab via the SPA navigation; under `auth.type=DISABLED` the same surface reaches any anonymous caller"
  - "data-steward-owner — owners auditing the catalog walk through the per-prefix entity counts; the UI does NOT visually distinguish 'my buckets' vs 'other buckets' (no owner-self filter)"

## dependencies_semantic

- requires-feature:
  - "F-023 / P-01:F-007 Directory Browsing — this UI is the LEVEL-1 ROOT contributing_node; F-023 already enumerates the API + service + repository tiers (DirectoryController batch T + DirectoryServiceImpl + ReactiveDataEntityRepositoryImpl level-4 chain). This sidecar adds the LEVEL-1 UI tier — the operator's first surface."
  - "F-008 / P-10 Batch Ingestion — the producer half of what the Directory enumerates. Every `DataSourceType` rendered here is a downstream artefact of a `POST /ingestion/entities` payload whose `datasource.oddrn` parsed to the given prefix. Cross-link to F-023's `feeds_from` to P-10."
  - "P-09 Authorization framework — relevant by ABSENCE: no `Permission.*` consumed at this UI tier (no `WithPermissions` wrap, no permission gate); the read-collaborative posture (ADR-CANDIDATE-003) means UI affordances are not permission-hidden. Cross-link to REFACTOR-024."
  - "Routing pillar (App.tsx + DirectoryRoutes) — App.tsx:38 lazy-loads `DirectoryRoutes`; App.tsx:72 mounts at `/directory/*`. DirectoryRoutes.tsx:11 selects this level-1 component for the empty-path nested route."
- requires-config:
  - "(none operator-controllable at this component) — no `application.yml` / env-var / feature-flag controls the level-1 rendering. The data shape is server-defined; the layout dimensions (`width: '160px'`, `height: '160px'`, gaps) are build-time constants in `DirectoryItem.styles.ts:5-11, 13-26`. Per substrate UI sidecar conventions, this is N/A for `requires-config` rather than a finding."
- requires-runtime:
  - "React 18+ — `import React, { type FC } from 'react'` (Directory.tsx:1); no useEffect, no useState, no useCallback used — purely declarative wrapper around the hook"
  - "TanStack Query (@tanstack/react-query) — `useQuery` + the global `QueryClient` at index.tsx:30-48 with `defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }`; the query cache is shared with `Overview/Directory/Directory.tsx`"
  - "react-i18next — `useTranslation` for `t('Directories')` (Directory.tsx:3, :15, :27)"
  - "MUI `@mui/material` — Grid + Typography (Directory.tsx:2)"
  - "react-router-dom — `<Link to={prefix}>` consumed by DirectoryItem (DirectoryItem.tsx:3); the route mount lives at App.tsx:72 + DirectoryRoutes.tsx:11"
  - "OpenAPI-generated `directoryApi` from `generated-sources` — specifically `directoryApi.getDataSourceTypes()` (directory.ts:16) returning `DataSourceTypeList`"
  - "Shared UI elements (`components/shared/elements`) — AppErrorPage, AppLoadingPage, EmptyContentPlaceholder, ScrollableContainer (Directory.tsx:6-11), DatasourceLogo (DirectoryItem.tsx:5)"
- couples-to:
  - "`useGetDataSourceTypes` hook (lib/hooks/api/directory.ts:12-21) — the only data fetch; static `queryKey: ['dataSourceTypes']`"
  - "`directoryApi.getDataSourceTypes` (OpenAPI-generated, `lib/api`) — the wire call wrapper for `GET /api/directory`"
  - "`DirectoryItem` (Directory/DirectoryItem/DirectoryItem.tsx:15-29) — per-card renderer + level-2 navigation"
  - "`DirectoryRoutes` (DirectoryRoutes.tsx:8-20) — parent route component that mounts this as the empty-path child"
  - "`ListLayout` (components/shared/elements) — the layout wrapper inside DirectoryRoutes (DirectoryRoutes.tsx:9) — provides the page chrome"
  - "Sibling Catalog-Overview variant — `Overview/Directory/Directory.tsx:1-30` — DIFFERENT component but SAME data via SAME hook + SAME TanStack cache entry; the home page surfaces a subset of the same level-1 list inline"

## upstream_callers

What renders this component — the inbound graph.

- **`DirectoryRoutes.tsx:11`** (`<Route path='/' element={<Directory />}/>`) — the only renderer. DirectoryRoutes itself is lazy-loaded at App.tsx:38 and mounted at App.tsx:72 (`<Route path={`${directoryPath()}/*`} element={<DirectoryRoutes />}/>`). User reaches `/directory` via top-nav navigation or direct URL.
- **No other renderer** — `grep -rn 'Directory' <odd-platform-repo>/odd-platform-ui/src/components/Directory/` shows that `Directory.tsx` is imported only by `DirectoryRoutes.tsx:5`. The home page renders a DIFFERENT component (`Overview/Directory/Directory.tsx`) that imports its OWN `DirectoryItem` (Overview/Directory/DirectoryItem/DirectoryItem.tsx — separate file). The two SHARE the `useGetDataSourceTypes` hook + the TanStack Query cache key, but are distinct rendering trees.
- **Lazy-loading boundary** — `DirectoryRoutes` is `lazy()`-imported at App.tsx:38. The first time a user navigates to `/directory`, the chunk loads, then this component mounts. Subsequent navigation within `/directory/*` (level 2, 3, 4) does NOT re-mount `Directory` (level 1) because react-router-v6 nested routing keeps the parent route stable.

## downstream_side_effects

| Trigger | Effect | RW shape | Failure modes |
|---|---|---|---|
| Component mount | `useGetDataSourceTypes` invocation → TanStack Query checks cache by `queryKey: ['dataSourceTypes']`; on cache miss, fires `directoryApi.getDataSourceTypes()` → `GET /api/directory` | READ-ONLY at the UI tier: returns `DataSourceTypeList.items`. NO write, NO mutation. Server-side: DirectoryController.getDataSourceTypes → DirectoryServiceImpl.getDataSourceTypes (DirectoryServiceImpl.java:48-50 per F-023 batch T) → `dataSourceRepository.list()` (unfiltered SELECT over the entire data_source table) | Network error → React Query's `isError + error` populated → AppErrorPage renders with the error message. 401 → the global `queryClient.onError` handler (index.tsx:32-35) calls `window.location.reload()` to drive the user back to the login page. 5xx → showServerErrorToast (index.tsx:36) raises a toast; component renders AppErrorPage. Empty `items` → EmptyContentPlaceholder renders. |
| Per-card click | react-router navigation to `/directory/{prefix}` via `<Link to={prefix}>` (DirectoryItem.tsx:16) | UI navigation only — NO API call from this component. The level-2 component (`DataSourceList`) fires its own `useGetDirectoryDataSources({prefix})` per directory.ts:23-30 → `GET /api/directory/datasources?prefix={...}`. | If `prefix` is `'other'`, the level-2 query runs against an `Other` synthetic bucket — the server-side query at DirectoryServiceImpl.findByPrefix (per F-023 batch T evidence) handles unrecognised prefixes; user sees an empty or sparse level-2 list. No client-side error path. |
| TanStack Query cache invalidation by external consumer (NONE observed) | Re-fetch — but `grep -rn 'invalidateQueries.*dataSourceTypes' <odd-platform-repo>/odd-platform-ui/src` returns ZERO matches | N/A — no invalidator exists | The level-1 list refreshes only on (a) hard reload, (b) cache eviction (TanStack default `gcTime` = 5 minutes after no consumer), (c) explicit `queryClient.invalidateQueries(...)` (none). A platform that adds a new datasource via Management does NOT automatically refresh the Directory level-1 grid for a viewer who is already on `/directory` — stale-while-revalidate is the default UX. |

## decision_provenance

| Choice | Rationale | Evidence |
|---|---|---|
| TanStack `useQuery` over Redux thunk + useEffect | Avoids the LSN-017 doubling pattern; declarative data fetching with built-in cache; `refetchOnWindowFocus: false` globally prevents unwanted re-fetches | directory.ts:12-21 (the hook), index.tsx:30-48 (global QueryClient defaults), Directory.tsx:14-23 (the consumption) |
| Static `queryKey: ['dataSourceTypes']` (no parameter) | Level 1 takes no input; the response is a complete catalog-wide list, not a paged or filtered subset | directory.ts:13-14 |
| Render `dataSourceTypes` unconditionally, no Owner / permission gate | Read-collaborative catalog posture (ADR-CANDIDATE-003 + ADR-CANDIDATE-122) — the catalog-wide aggregate is intentionally visible to every authenticated user; UI mirrors the controller-tier decision F-023 documents | Directory.tsx:35-52 (no conditional gating); F-023 facet 1 (`cross_owner_datasource_inventory_enumeration`); ADR-CANDIDATE-003 |
| Use `<Link to={prefix}>` (relative path) over `<Link to={`${directoryPath()}/${prefix}`}>` | Concise, react-router-v6 idiomatic relative navigation; survives a future route remount under a different parent | DirectoryItem.tsx:16; react-router-v6 nesting semantics |
| Plural `t('Directories')` as the header label | Localisation slot; the en.json key was authored plural by the original UI author. NOT a deliberate disambiguation from the doc-product feature name (which is singular 'Directory') | Directory.tsx:27; no source-code comment explains the choice |
| `AppErrorPage` with `offsetTop={210}` | Reserves vertical space for the top navigation bar; magic number used across other top-level page components | Directory.tsx:32 |

## tests_coverage_semantic

- covered_behaviours: []
  - "No test files target this component — confirmed by `grep -rn 'Directory' <odd-platform-repo>/odd-platform-ui/src --include='*.test.*'` returning zero matches and `glob '**/Directory/**/*.test.*'` returning empty"
- uncovered_behaviours:
  - "Empty-state rendering — deployment with zero registered datasources renders EmptyContentPlaceholder; no test pin"
  - "Loading-state rendering — `isLoading` true → AppLoadingPage renders; no test pin"
  - "Error-state rendering — `isError` true → AppErrorPage renders with the error message; no test pin"
  - "401 redirect path — the global `queryClient.onError` `window.location.reload()` behaviour for 401; no test pin"
  - "Per-card navigation — clicking a DirectoryItem navigates to `/directory/{prefix}`; no test pin"
  - "ODDRN-prefix bucket cardinality — render N cards for N buckets; no test pin"
  - "TanStack cache shared with `Overview/Directory/Directory.tsx` — mounting one then the other returns cached result, fires only one API call; no test pin"
  - "DISABLED-mode anonymous reach — under `auth.type=DISABLED` the route renders for anonymous callers; no test pin (cross-link to F-023 security gap)"
  - "'Other' bucket rendering — when the server returns `{prefix: 'other'}` the card renders identically to a known prefix bucket; no UI signal disambiguates it; no test pin"
- test_files: []
- gaps: |
    A `Directory.test.tsx` would assert: (a) loading / error / empty / 
    loaded states render the right placeholders; (b) cardinality of 
    rendered DirectoryItem matches the hook's return; (c) clicking a 
    DirectoryItem navigates to the prefix; (d) the 'Other' bucket 
    renders. The four state-render assertions are the highest-leverage 
    pins — a UI regression on this surface is invisible without them. 
    Behaviour-level integration with the F-023 backend findings 
    (REFACTOR-024 cross-owner, REFACTOR-185 DISABLED, REFACTOR-NEW 
    page-vs-count at level 4) require a probe stack at the level-2/3/4 
    sister components, NOT this level-1 root.

## docs_link_semantic

- declared_docs: []
  - "No `// @docs` annotation in Directory.tsx (verified via Read of the entire 57-line file)"
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/directory"
    anchor: ""
    rationale: "Canonical user-facing doc page for the Directory feature; F-023 batch T already references this URL as `documentation/docs/features/data-discovery/directory.md`. The UI at `/directory` is the user-observable surface this page documents."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from WebFetch 2026-05-20:
      "Level 1: Data Source Types — One card per ODDRN prefix that the 
      platform's registered data sources resolve to (postgresql, 
      snowflake, kafka, airflow, mysql, ...)"
      "Level 2: Data Sources — The list of registered data source 
      instances for the chosen type — name, ODDRN-derived properties 
      (host, port, database, ...), and per-source entity count."
      "Level 3: Entity Types — The distinct Data Entity classes present 
      in the chosen data source (Dataset, Transformer, Transformer Run, 
      Quality Test, Quality Test Run, Consumer, Input, Group, 
      Relationship, ...)."
      "Level 4: Entities — The paged list of data entities matching 
      both filters; click an entity to land on its detail page 
      (Overview tab)."
      Use Cases: "You want to see what data sources are registered in 
      the platform without scrolling through search facets"; "You're 
      auditing per-source coverage — how many entities did the 
      collector pull from each source"; "You're onboarding a teammate 
      and want to walk them through the catalog visually."
      Authorization/owner-scoping/the 'Other' bucket/pagination: 
      "The page contains no information on these topics."
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/directory"
    anchor: ""
    rationale: "API-reference page enumerating the 4 GET endpoints. The hook `useGetDataSourceTypes` consumes the level-1 endpoint."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from WebFetch 2026-05-20:
      "Level 1 lists ODDRN-prefixes with display names and entity 
      counts."
      "each result carries the source's ODDRN-derived properties and 
      per-source entity count" (level 2)
      "Level 4 supports pagination through page={n}&size={m} 
      parameters, described as a 'paged list of entities.'"
      Authorization / 'Other' bucket: "The page contains no information 
      about authorization requirements or mechanisms" / "The page does 
      not mention an 'Other' bucket or handling of unknown ODDRNs."
    confidence: HIGH
- doc_drift_findings:
  - "Live `/features/data-discovery/directory` page silent on UI-tier behaviours visible at this component: (a) Empty-state copy 'No information to display' (Directory.tsx:47-50 + EmptyContentPlaceholder default); (b) the 'Other' bucket is rendered as a normal card with no UI signal; (c) under `auth.type=DISABLED` the route is anonymously reachable; (d) the UI header is PLURAL 'Directories' while the doc feature name is SINGULAR 'Directory'."
  - "Doc-product editorial silence on the UI's catalog-wide aggregate-count posture matches F-023 facet 7 (`doc_silence_on_directory_authorization_owner_scoping`) — the UI sidecar's evidence confirms the doc-product gap from the consumer side."
  - "Strict copy mismatch: doc page uses 'Distinct Data Entity classes' at level 3 (carried from F-023 facet 9 type_vs_class_dimension_doc_drift) — UI rendering deferred to level-3 sister components NOT enriched here, but the level-3 UI consumes the same `DataEntityType` API the doc miscalls 'class'."

## implicit_adrs

- "Static `queryKey: ['dataSourceTypes']` for a catalog-wide aggregate query — implicit ADR: the level-1 list is a SINGLETON per SPA session; sharing the cache across all consumers (Directory.tsx AND Overview/Directory/Directory.tsx) is the intentional efficiency choice. The lack of `queryClient.invalidateQueries(['dataSourceTypes'])` calls anywhere in the codebase confirms the design: stale-while-revalidate is acceptable; the level-1 list does not need to track real-time datasource registrations." — evidence: directory.ts:13-14 + grep `invalidateQueries.*dataSourceTypes` returning empty + Overview/Directory/Directory.tsx:10 sharing the hook — intent_anchor: "the global QueryClient `refetchOnWindowFocus: false` (index.tsx:42) explicitly disables an automatic refetch trigger that would defeat the singleton cache" — confidence: HIGH

- "Read-collaborative posture at the UI tier — implicit ADR: this component renders the catalog-wide aggregate `entitiesCount` per ODDRN-prefix bucket to every viewer (authenticated or anonymous under DISABLED) with NO permission gate, NO Owner-association gate, NO `appInfo.authType` check. This mirrors the controller-tier decision F-023 documents at DirectoryController.java:23-26 — the UI is INTENTIONALLY non-gated because the API is intentionally non-gated. ADR-CANDIDATE-003 (read-collaborative catalog) is the parent decision; this is its UI manifestation." — evidence: Directory.tsx:14-55 (no gates anywhere) + DirectoryRoutes.tsx:11 (unconditional mount) + cross-link to ADR-CANDIDATE-003 — intent_anchor: "Directory.tsx is a 57-line file with zero `useAppSelector`, zero `WithPermissions`, zero `appInfo` reference, zero auth-mode check — the absence is consistent across the entire component, which is the structural signal of intentional design (a half-applied gate would surface as inconsistency)" — confidence: MEDIUM (intent inferred from cross-tier consistency with the controller; no source-code comment makes the read-collaborative rationale explicit at the UI tier)

- "TanStack Query chosen over Redux thunks for read-only catalog queries — implicit ADR: the post-2024 UI evolution adopts TanStack Query for read-side data fetching (directory.ts, terms.ts, datasetField.ts, ownerAssociationRequest.ts, dataEntity.ts all use it) while Redux remains for mutation-side state. This component's `useGetDataSourceTypes` is in that family. The LSN-017 doubling pattern (which afflicts Redux-thunk + useEffect consumers like DataEntityDetails.tsx:56-64) is structurally avoided here." — evidence: index.tsx:30-48 (the global QueryClient with retry:false + refetchOnWindowFocus:false) + directory.ts entire file + the consistent pattern across the lib/hooks/api/* family — intent_anchor: "the global `defaultOptions.queries.retry: false` (index.tsx:41) is a deliberate posture choice — failed reads do NOT auto-retry, the user sees the error or empty state immediately; this is the opposite of TanStack's default and indicates an intentional UX decision about read-side error visibility" — confidence: HIGH

## bugs_limitations_corner_cases

- "Plural `t('Directories')` header vs singular doc-product feature name 'Directory' — a tone divergence. The live doc page (WebFetched 2026-05-20 status 200) names the feature 'Directory'; this UI says 'Directories'. NOT a wrong-meaning bug but a copy-tone mismatch a maintainer could fix in one en.json edit." — evidence: Directory.tsx:27 (t('Directories')) + WebFetch 2026-05-20 /features/data-discovery/directory — severity: LOW

- "The 'Other' bucket renders as a normal card with NO UI signal disambiguating it from a recognised ODDRN prefix. A datasource whose ODDRN failed parsing (DirectoryServiceImpl.java:101-110 per F-023 batch T) lands in this bucket silently; the operator sees 'Other' but has no UI affordance to ask 'why is this Postgres source under Other?' (the only signal is the server-side error log per F-023 facet 6 unknown_oddrn_silent_bucket_to_other). The card displays 'Other' as the name and the entitiesCount aggregate of every misparsed source." — evidence: Directory.tsx:38-45 (no per-prefix conditional rendering) + DirectoryItem.tsx:15-29 (no 'Other'-specific branch) + DirectoryServiceImpl.java:101-110 per F-023 — severity: MEDIUM

- "Under `auth.type=DISABLED` the route is anonymously reachable. Unlike `Overview.tsx:53-59` (which gates the Recommended panel by `appInfo.authType !== 'DISABLED'`), `Directory.tsx` has no `authType` check. Anonymous callers reaching `/directory` on a DISABLED-mode deployment see the full ODDRN-prefix bucket roster with per-bucket entitiesCount. UI-tier confirmation of F-023 facet 5 (`disabled_mode_anonymous_reach_directory`)." — evidence: Directory.tsx:14-55 (no authType gate) + DirectoryRoutes.tsx:11 (unconditional mount) + App.tsx:72 (unconditional route) — severity: LOW-MEDIUM (severity matches F-023 facet 5; the inheritance to the UI tier is the new datum)

- "No `Directory.test.tsx` exists — confirmed by `grep` + `glob`. The four state-render branches (isLoading / isError / isSuccess+populated / isSuccess+empty) are uncovered. A UI regression that breaks one branch is invisible without a test pin." — evidence: `grep -rn 'Directory' <odd-platform-repo>/odd-platform-ui/src --include='*.test.*'` returns zero matches + `glob '**/Directory/**/*.test.*'` returns empty — severity: MEDIUM

- "TanStack Query cache key `['dataSourceTypes']` does NOT include any user-identity scope. If two users with DIFFERENT visibility constraints share a browser session (not common in production but possible in shared-workstation environments), the cache leaks the level-1 view across users. Today the API returns the same catalog-wide view for every authenticated user, so this is currently moot — but if a future patch adds per-user scoping to the API while leaving the UI cache key untouched, a cache-hit would return the prior user's view to the new user." — evidence: directory.ts:13-14 (static queryKey) + index.tsx:30-48 (no per-session cache reset on identity change) — severity: LOW (latent — actionable only if API-tier scoping is added)

- "The level-1 query has no `staleTime` set — so TanStack Query treats the cache as immediately stale and refetches on the next consumer mount (if outside the `gcTime` window). For a navigation-heavy session (user mounting `/directory` repeatedly via top-nav clicks), this fires repeated `GET /api/directory` calls per visit. Unbounded levels-1-2-3 response sizes (F-023 facet 4 no_pagination_levels_1_2_3_unbounded_response_size) compound — a deployment with 100+ ODDRN-prefix buckets pays the in-memory-grouping cost on every navigation." — evidence: directory.ts:12-21 (no staleTime option) + index.tsx:39-47 (no global staleTime in defaultOptions) + F-023 batch T DirectoryServiceImpl.java:48 (`dataSourceRepository.list()` then group-in-memory) — severity: LOW (perf class; compounds with F-023 facet 4 + facet 12 no_http_caching_no_etag_directory)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — under the first three modes the route is gated by the global `.authenticated()` fall-through; under DISABLED the route is anonymously reachable. The component itself reads NO auth mode, applies NO mode-specific branching.
- **ingestion_filter_relevance**: N/A — this is a UI component on the read path, not on `POST /ingestion/entities`. The `auth.ingestion.filter.enabled` knob has zero effect on this surface.
- **authorization_assertions**: `[]` — NO `WithPermissions`, NO `Permission.*` consumed, NO permission-gated UI element. Read-collaborative posture at the UI tier (see implicit_adrs entry 2).
- **owner_scoping**: `BYPASSES — renders catalog-wide aggregate counts unconditionally`. The level-1 list `entitiesCount` per ODDRN-prefix bucket is computed by `DirectoryServiceImpl.getDataSourceTypes` via unfiltered `dataSourceRepository.list()` (DirectoryServiceImpl.java:48-50 per F-023 batch T) — the UI tier rendering at Directory.tsx:38-45 has NO post-fetch client-side filter. Cross-link: F-023 facet 1.
- **data_exposure**:
  - "`DataSourceTypeList.items` payload → any authenticated user (LOGIN_FORM/OAUTH2/LDAP) — every ODDRN-prefix bucket with name + entitiesCount aggregate. The aggregate is a catalog-cardinality signal (count of entities per source type platform-wide)."
  - "`DataSourceTypeList.items` payload → any anonymous caller under `auth.type=DISABLED` — the same payload reaches an unauthenticated browser."
  - "Indirect: the `<Link to={prefix}>` per card primes the user to drill into level 2, where the F-023 facet 2 ODDRN reflection infrastructure-property leak surfaces (host, port, database, cluster, account, warehouse). This component does NOT directly render those properties — but it is the entry point that funnels users toward them."
- **known_security_gaps**:
  - "level-1 grid is catalog-cardinality-revealing — `entitiesCount` per ODDRN-prefix bucket reveals deployment shape (N PostgreSQL entities, M Snowflake entities, K Kafka entities) to any authenticated viewer; under DISABLED, to any anonymous viewer. The aggregate is the UI-tier equivalent of REFACTOR-024 facet-aggregator catalog-cardinality enumeration vector (batch M)" — evidence: Directory.tsx:38-45 (the per-prefix card render) + DirectoryItem.tsx:23-25 (the entitiesCount display) + REFACTOR-024 batch-M evidence — severity: LOW-MEDIUM (the count is less specific than per-owner / per-tag enumeration; but the ODDRN prefix set itself reveals platform composition)
  - "no `appInfo.authType` gate at the component or route — under DISABLED, anonymous caller reaches the level-1 catalog inventory. Sister-component PopularStrip and OwnerEntitiesList DO check authType (Overview.tsx:53-59); Directory.tsx does NOT" — evidence: Directory.tsx:14-55 + DirectoryRoutes.tsx:8-20 (no authType branching) + App.tsx:72 (unconditional route mount) + cross-link to PopularStrip sidecar invariant 6 — severity: LOW-MEDIUM
  - "no per-Owner UI filter, no 'my datasources' affordance — the read-collaborative posture is total at the UI tier; a future maintainer adding an owner-self filter would need to add a Redux/permission-aware ancestor wrapper. The current shape encodes the design choice as IMPLICIT in the component's absence of any such gate" — evidence: Directory.tsx end-to-end (no useAppSelector, no permission reads) + ADR-CANDIDATE-003 cross-link — severity: LOW (design choice; surface for ADR-CANDIDATE-003 traceability)

## performance

- **hot_paths**:
  - "Initial mount on `/directory` navigation fires `GET /api/directory` → server-side unfiltered `dataSourceRepository.list()` + in-memory grouping (DirectoryServiceImpl.java:48-50 per F-023 batch T) — O(N) over the data_source table per request, NO server-side caching layer. The level-1 response itself is small (typically <20 rows) but the server-side cost is full-table-scan per fetch." — evidence: Directory.tsx:16-22 + directory.ts:12-21 + DirectoryServiceImpl.java:48-50 (cited from F-023 batch T) — severity hint: shared with F-023 facet 4
- **throughput_characteristics**:
  - "single-call READ — one GET per mount; no batching, no pagination, no streaming. The level-1 surface is fundamentally a one-shot full-list call."
- **resource_allocation**:
  - "Client-side memory: the level-1 list array sits in TanStack Query cache (default `gcTime = 5 minutes` after no consumer) — bounded by `< 1 KB per row × < 20 rows` typically; under a path-finder deployment with 100+ distinct prefixes the cache stays under 100 KB. Negligible."
  - "DOM size: one `DirectoryItem` per bucket, each a 160×160 px card (DirectoryItem.styles.ts:5-11). For typical 5-20 buckets the DOM tree is small; for an extreme 100+ bucket case the grid wraps and ScrollableContainer virtualization is NOT used — every card is in the DOM. Cross-link: F-023 facet 4 no_pagination_levels_1_2_3_unbounded_response_size."
- **scaling_characteristics**:
  - "stateless component — instances scale with React's normal rendering cost"
  - "TanStack Query cache is shared with `Overview/Directory/Directory.tsx` — concurrent mounts of both consumers fire ONE wire call, not two"
  - "no staleTime — every fresh mount outside the gcTime window triggers a re-fetch (see bugs entry 6); a heavy navigation pattern (user clicking top-nav 'Directory' repeatedly) fires per-mount calls"
- **known_performance_gaps**:
  - "No `staleTime` set on the TanStack `useQuery` — per-mount refetches outside gcTime. For a session with many `/directory` navigations the server pays full-table-scan repeatedly. Adding `staleTime: 60_000` (1 minute) would deduplicate fetches across navigations without staleness risk (the data-source roster changes at operator cadence, not user cadence). REMEDY: directory.ts:13-19 add `staleTime: 60_000`" — evidence: directory.ts:12-21 + index.tsx:39-47 (no global staleTime) — severity: LOW
  - "No HTTP-cache headers on the response — F-023 facet 12 `no_http_caching_no_etag_directory` applies at this consumer too. Combined with the no-staleTime above, every fresh mount round-trips to the server even though the response is read-mostly and stable" — evidence: F-023 facet 12 cross-link + Directory.tsx + directory.ts — severity: LOW
  - "No virtualization on the grid — every `DirectoryItem` mounts in the DOM. For pathological prefix-bucket counts (100+) the grid render cost grows linearly. Today bounded by typical <20 buckets, but no safety rail" — evidence: Directory.tsx:37-46 (plain `.map()` render) + DirectoryItem.styles.ts:5-11 — severity: LOW (latent — actionable only at extreme bucket cardinality)

## sources

- understanding ← Directory.tsx:1-57 + DirectoryRoutes.tsx:11 + App.tsx:38, 72 + directoryRoutes.ts:4-8 + directory.ts:12-21 + index.tsx:30-48 + F-023 (lineage/odd-platform/feature-flows/detail/F-023.yaml) + DataEntityDetails.tsx:56-64 (LSN-017 reference)
- concepts.entities.DataSourceType ← directory.ts:14-18 + Directory.tsx:38-45 + DirectoryItem.tsx:9-14 + F-023 chain hop 1 evidence
- concepts.entities.DataSourceTypeList ← directory.ts:16 (`const { items } = await directoryApi.getDataSourceTypes()`) + F-023 description
- concepts.entities.queryKey ← directory.ts:13-14 + index.tsx:30-48
- concepts.entities.routeMount ← App.tsx:72 + directoryRoutes.ts:4-8 + DirectoryRoutes.tsx:11
- concepts.entities.translation ← Directory.tsx:27 + en.json key (referenced; not opened)
- concepts.operations.mount ← Directory.tsx:14-22 + directory.ts:12-21 + F-023 chain hop 1
- concepts.operations.renderLoop ← Directory.tsx:37-46
- concepts.operations.cardClick ← DirectoryItem.tsx:15-29 + DirectoryRoutes.tsx:12
- concepts.invariants.useQuery-not-useEffect ← directory.ts:12-21 + LSN-017 retrospective + DataEntityDetails.tsx:56-64
- concepts.invariants.no-authType-gate ← Directory.tsx:14-55 + Overview.tsx:53-59 (counter-example) + F-023 facet 5
- concepts.invariants.no-Owner-gate ← Directory.tsx end-to-end + ADR-CANDIDATE-003
- concepts.invariants.entitiesCount-verbatim ← DirectoryItem.tsx:23-25 + F-023 chain hop 1 evidence
- concepts.invariants.Other-bucket-no-signal ← Directory.tsx:38-45 + DirectoryItem.tsx:15-29 + F-023 facet 6 + DirectoryServiceImpl.java:101-110 (cited from F-023)
- concepts.invariants.layout ← Directory.tsx:26-46 + DirectoryItem.styles.ts:5-11
- concepts.invariants.relative-Link ← DirectoryItem.tsx:16 + DirectoryRoutes.tsx:11-13
- concepts.invariants.translation-tone ← Directory.tsx:27 + WebFetch /features/data-discovery/directory 2026-05-20
- concepts.invariants.key-stability ← Directory.tsx:40 (`key={prefix}`)
- concepts.audiences ← WebFetch /features/data-discovery/directory 2026-05-20 use-cases section + F-023 audiences
- dependencies_semantic.requires-feature.F-023 ← lineage/odd-platform/feature-flows/detail/F-023.yaml entire file
- dependencies_semantic.requires-feature.F-008 ← F-023 cross_pillar_relationships P-10 entry
- dependencies_semantic.requires-runtime ← Directory.tsx:1-12 + directory.ts:1-10 + index.tsx:5
- dependencies_semantic.couples-to ← Directory.tsx:6-12 + DirectoryItem.tsx:1-7 + DirectoryRoutes.tsx:5-6 + Overview/Directory/Directory.tsx:4
- upstream_callers ← DirectoryRoutes.tsx:8-20 + App.tsx:38, 72 (grep for renderer)
- downstream_side_effects.mount ← Directory.tsx:14-22 + directory.ts:12-21 + DirectoryController.java:23-26 (cited from F-023) + DirectoryServiceImpl.java:48-50 (cited from F-023) + index.tsx:32-38 (onError handler)
- downstream_side_effects.click ← DirectoryItem.tsx:16 + DirectoryRoutes.tsx:12 + directory.ts:23-30
- downstream_side_effects.invalidation ← grep `invalidateQueries.*dataSourceTypes` returning empty
- decision_provenance ← directory.ts:12-21 + index.tsx:30-48 + Directory.tsx:14-55 + DirectoryItem.tsx:16
- tests_coverage_semantic ← grep + glob returning empty for `**/Directory/**/*.test.*` and `Directory` in `*.test.*` under `<odd-platform-repo>/odd-platform-ui/src`
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/directory 2026-05-20 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/directory 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings ← WebFetch results above + Directory.tsx:27 (plural header) + F-023 facets 6, 7, 9
- implicit_adrs.[0] static-queryKey-singleton-cache ← directory.ts:13-14 + index.tsx:39-47 + grep on invalidateQueries
- implicit_adrs.[1] read-collaborative-UI-tier ← Directory.tsx:14-55 (absence of any gate) + ADR-CANDIDATE-003 + F-023 batch T
- implicit_adrs.[2] tanstack-query-pattern ← directory.ts entire file + index.tsx:30-48 + cross-link to LSN-017
- bugs_limitations_corner_cases.[0] tone ← Directory.tsx:27 + WebFetch live doc 2026-05-20
- bugs_limitations_corner_cases.[1] Other-bucket-silent ← Directory.tsx:38-45 + F-023 facet 6 + DirectoryServiceImpl.java:101-110 (cited)
- bugs_limitations_corner_cases.[2] DISABLED-anonymous ← Directory.tsx + DirectoryRoutes.tsx + App.tsx:72 + Overview.tsx:53-59 (counter-example)
- bugs_limitations_corner_cases.[3] no-tests ← grep + glob returning empty
- bugs_limitations_corner_cases.[4] cache-no-identity-scope ← directory.ts:13-14 + index.tsx:30-48
- bugs_limitations_corner_cases.[5] no-staleTime ← directory.ts:12-21 + index.tsx:39-47 + F-023 facets 4, 12
- security.auth_mode_relevance ← App.tsx:72 + DirectoryRoutes.tsx:11 + Directory.tsx (no authType reads)
- security.owner_scoping ← Directory.tsx:14-55 + DirectoryServiceImpl.java:48-50 (cited from F-023) + F-023 facet 1
- security.data_exposure ← Directory.tsx:38-45 + DirectoryItem.tsx:23-25 + F-023 facet 2 (cross-link only — UI does not render the leaked properties at level 1)
- security.known_security_gaps.[0] catalog-cardinality ← Directory.tsx + REFACTOR-024 batch-M evidence (cited)
- security.known_security_gaps.[1] no-authType-gate ← Directory.tsx + Overview.tsx:53-59 (counter-example) + DirectoryRoutes.tsx + App.tsx:72
- security.known_security_gaps.[2] no-Owner-filter ← Directory.tsx end-to-end + ADR-CANDIDATE-003
- performance.hot_paths ← Directory.tsx:16-22 + DirectoryServiceImpl.java:48-50 (cited from F-023)
- performance.scaling_characteristics ← Overview/Directory/Directory.tsx:10 (cache sharing) + index.tsx:39-47 + F-023 facet 12
- performance.known_performance_gaps.[0] no-staleTime ← directory.ts:12-21 + index.tsx:39-47
- performance.known_performance_gaps.[1] no-HTTP-cache ← F-023 facet 12 cross-link
- performance.known_performance_gaps.[2] no-virtualization ← Directory.tsx:37-46 + DirectoryItem.styles.ts:5-11

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- decision_provenance: HIGH (architectural rationale partly inferred — confidence on the WHAT is HIGH; the WHY of "TanStack over Redux for reads" carries MEDIUM cross-codebase consistency evidence rather than explicit ADR)
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (two live WebFetches verified 2026-05-20 status 200; quoted excerpts are verbatim)
- implicit_adrs: MEDIUM (the read-collaborative-UI-tier ADR is partly inferred from absence; cross-tier consistency with the controller is the strongest signal, but no source-code comment makes the rationale explicit at the UI)
- bugs_limitations_corner_cases: HIGH
- security: HIGH (per-file-local scope; aggregate posture lives at REFACTOR-024 + ADR-CANDIDATE-003 + F-023)
- performance: HIGH (per-file-local scope; the cross-tier cost lives at F-023 facets 4, 11, 12)

## Maintainer notes

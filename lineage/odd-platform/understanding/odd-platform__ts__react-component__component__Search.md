---
node_id: "odd-platform ts components/Search react-component:Search"
node_kind: react-component
axis: ui_components
extracted_at_commit: 074c9927
enriched_at_commit: 074c9927
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-Search-1760-refresh
feature_hint: "P-01:F-005 (Search Filter Facets — Data Discovery pillar Catalog page, feature-flows/detail/F-017.yaml). UI entry point at `/search` (index) + `/search/:searchId` (App.tsx:61-64 + searchRoutes.ts:3 BASE_PATH='/search'). REFRESHED at commit 074c9927 (branch contrib/CTRIB-005-search-session-not-found) which carries the #1760 fix: App.tsx replaced the legacy `'/search/*'` splat (introduced #1551, Dec 2023 — which left useSearchRouteParams().searchId ALWAYS undefined so every cold /search/{uuid} silently minted a fresh empty session) with nested `index` + `:searchId` param routes, making the URL-restore path REAL; and Search.tsx now renders a graceful dead-link state (404 deep-link → SearchSessionExpired 'This search has expired' + 'Start new search'; non-404 → AppErrorPage with the real status). Sister to TermSearch.tsx (Dictionary tab) which mirrors the identical fix. Backend partner is the batch-ZE SearchController (POST/GET/PUT /api/search). Three children: Filters (left sidebar, 7 facets), MainSearch (text input wrapping MainSearchInput), Results (passed via Component={Results} into WithPermissionsProvider)."
related_features:
  - F-017       # PRIMARY — Search Filter Facets (P-01:F-005); IT-125 + CTRIB-005 anchor here
  - F-001       # LSN-017 dep-array class cross-link (view_count doubling counterpart)
  - F-008       # REFACTOR-425 page-vs-count divergence family
related_pillar_features:
  - "P-01:F-005"   # Search Filter Facets (Data Discovery pillar) — this UI IS the operator-facing surface
related_retrospectives:
  - LSN-017   # useEffect dep-array smell — three instances here; effect-1 now manifests as a create-FAILURE retry loop (P-244)
  - LSN-018   # coherence cross-check across F-017 + batch-ZE SearchController + batch-U TermSearch
  - LSN-020   # Category F — every named request input (searchId, query, filters, myObjects, pageSize) traced
  - LSN-023   # interpret request fields by the UI control that feeds them, not the backend name alone
related_batches:
  - ZA   # SearchResults UI (Results.tsx — now mounted via Component={Results})
  - ZE   # SearchController class + .search method (backend partner; FTS-injection + no-auth surface)
  - ZH   # ToolbarTabs (top-nav 'Catalog' tab → searchPath() bare → drops session)
  - ZI   # searchRoutes.ts (route-construction module; :searchId Category F drift)
  - ZL   # prior FINAL Search sidecar (this is its #1760 refresh)
related_issues:
  - "1760"   # filters 500-vs-404 + SPA 'Unknown Error' for expired/shared deep-links (the fix this refresh enriches)
  - "1761"   # invalid-facet-enum 400 class (regressed by IT-125)
related_contributions:
  - "CTRIB-005"   # the /contribute work item that produced this commit (contributor/CTRIB-005.md)
related_integration_tests:
  - "IT-125"   # integration-tests/e2e/specs/search-session-not-found.spec.ts — expired state, restore, no-replacement-POST guard
---

# Search (Catalog page — Discovery search/filter root) — semantic understanding

## understanding

`Search.tsx` (lines 1-122, commit 074c9927) is the Data Discovery pillar's **Catalog page** root SPA component, mounted at `/search` (index) and `/search/:searchId` (App.tsx:61-64). It is a thin orchestrator over the `dataEntitySearch` Redux slice that (a) **creates a server-side search session** on first mount when no `:searchId` URL param and no Redux-cached `searchId` exist — `createSearch({query:'', pageSize:30, filters:{}})` → `useCreateSearch()` dispatches `createDataEntitiesSearch` (`POST /api/search`) then `navigate(searchPath(searchId))` to capture the new UUID in the URL (Search.tsx:58-63 + useCreateSearch.ts:14-19); (b) **restores an existing session** from the URL parameter via `getDataEntitiesSearch({searchId: routerSearchId})` (`GET /api/search/{searchId}`) when a `:searchId` is present and Redux holds no session yet (Search.tsx:65-69) — **this path is REAL only as of this commit**: the prior `'/search/*'` splat route (since #1551, Dec 2023) left `useSearchRouteParams().searchId` always `undefined`, so effect (a) silently minted a fresh empty session for every cold deep-link; the route fix (App.tsx nested `index` + `:searchId`) wires the param so the restore fires and the session is loaded, not replaced (regression-locked by IT-125). (c) **Handles dead deep-links gracefully** — a deep-link that fails to load (`!searchId && routerSearchId && isSearchNotLoaded`, Search.tsx:48-51) renders `SearchSessionExpired` ("This search has expired" + a "Start new search" button that calls `resetLoaderByAction` then `createSearch`) when the error status is exactly `404`, and `AppErrorPage` carrying the real `searchError.status`/`statusText` otherwise (Search.tsx:94-100); the real status is now reliable because `lib/errorHandling.tsx:12-18` unwraps the generated client's `ResponseError` wrapper. (d) **Debounces facet-state mutations** at 1500 ms leading-edge into `updateDataEntitiesSearch` (`PUT /api/search/{searchId}`) whenever facet selection diverges from server-synced state (Search.tsx:71-92). (e) **Lays out the three-child shell**: `<Filters/>` (left sidebar, 7 facets, xs=3), `<MainSearch placeholder={t('Search')} disableSuggestions/>` (text input), and `<Results/>` injected via `WithPermissionsProvider Component={Results} allowedPermissions=[DATA_ENTITY_GROUP_CREATE]` (Search.tsx:102-118). The user-typed search **text** is not entered in this orchestrator — `<MainSearch>` mounts `<MainSearchInput>` which dispatches `updateDataEntitiesSearch` synchronously on Enter (the in-session path, since this surface omits `mainSearch`), forwarding the raw `query` into `SearchFormData` with **no client-side sanitisation**.

## concepts

- entities:
  - "SearchFormData (OpenAPI request DTO — spec components.yaml:2244-2287: `{query?: string, my_objects?: boolean, filters: {types,entity_classes,tags,namespaces,owners,datasources,groups,statuses}}`, `required: [filters]`). NOTE: `pageSize` is NOT a SearchFormData property in the spec — the `pageSize: 30` literal at Search.tsx:60 + MainSearchInput.tsx:38 is an extraneous field absent from the wire contract."
  - "SearchFacetsData (OpenAPI response DTO — the server-side `search_facets` session row; carries `search_id`, query, totals, facetState)"
  - "DataEntitySearchState (Redux slice `state.dataEntitySearch`; `initialState` at dataEntitySearch.slice.ts:22 with `isFacetsStateSynced: true` at :34; `updateSearchState` merge helper at :40; create/update set `isFacetsStateSynced:false` at :134 and :178, reset to true at :97)"
  - "AppError / ErrorState (lib/errorHandling.tsx:5-10 `{status, statusText, url, message}`) — produced by `getErrorResponse` which unwraps the generated client's `ResponseError.response` (errorHandling.tsx:12-18); surfaced into Redux by the loader slice's global `/rejected` matcher (loader.slice.ts:42-49) and read here via `getSearchError` (selectors :60)"
  - "SearchSessionExpired (shared element, SearchSessionExpired.tsx:1-46 — renders 'This search has expired' + 'Start new search'; re-exported at shared/elements/index.ts:58)"
  - "AppErrorPage (shared element, AppErrorPage.tsx:1-41 — renders `error.status` + `error.statusText || 'Unknown Error'` + a Home Page link; re-exported at index.ts:57)"
  - "Permission.DATA_ENTITY_GROUP_CREATE (generated enum; passed to WithPermissionsProvider at Search.tsx:111; consumed downstream by WithPermissions in Results.tsx:125 wrapping the 'Add group' button)"
  - "useSearchRouteParams / searchPath (route module searchRoutes.ts:7-19; imported from the `routes` barrel at Search.tsx:27; `BASE_PATH='/search'`, `SEARCH_ID_PARAM=':searchId'`)"
  - "Server-side search session UUID (the `:searchId` URL param — server-generated `search_facets` PK; ephemeral, 30-day TTL eviction per F-010; NO user-binding column per REFACTOR-344 / batch-ZE)"
  - "PageWithLeftSidebar (layout primitive — MainContainer/ContentContainer/LeftSidebarContainer/ListContainer at Search.tsx:103-116; identical sibling pattern in TermSearch.tsx)"
- operations:
  - "On mount with no `:searchId` + no in-flight create + no cached `searchId` → `createSearch({query:'', pageSize:30, filters:{}})` (Search.tsx:58-63) → `createDataEntitiesSearch` thunk (`POST /api/search`) → on fulfilment `navigate(searchPath(searchId))` writes the new UUID into the URL (useCreateSearch.ts:14-19)"
  - "On URL with `:searchId` present + no cached `searchId` → `getDataEntitiesSearch({searchId: routerSearchId})` (Search.tsx:65-69) → `searchApi.getSearchFacetList` (`GET /api/search/{searchId}`) → restores the persisted session"
  - "On deep-link load failure → `isDeepLinkNotLoaded = !searchId && !!routerSearchId && isSearchNotLoaded` (Search.tsx:50). If `searchError.status === 404` → render `<SearchSessionExpired onStartNewSearch={handleStartNewSearch}/>` (Search.tsx:94-96); else render `<AppErrorPage showError error={searchError}/>` (Search.tsx:98-100)"
  - "Recovery from expired state → `handleStartNewSearch` (Search.tsx:53-56) dispatches `resetLoaderByAction(getDataEntitySearchActionType)` (clears the stale rejected loader status + error so the gate stops matching) then `createSearch({query:'', filters:{}})` (a fresh session; note no `pageSize` field on this call)"
  - "On facet-state change with `!searchFacetsSynced` → `updateSearchFacets()` (Search.tsx:88-92) → debounced (1500 ms leading-edge, :71-86) `updateDataEntitiesSearch({searchId, searchFormData:{query, myObjects, filters: mapValues(searchFacetParams, values)}})` (`PUT /api/search/{searchId}`)"
  - "Text-query dispatch (NOT in this orchestrator): `<MainSearch>` mounts `<MainSearchInput>`; since Search.tsx:109 omits `mainSearch`, Enter/search-click runs `handleUpdateSearch` → `updateDataEntitiesSearch({searchId: storedSearchId, searchFormData:{query, pageSize:30, filters:{}}})` SYNCHRONOUSLY (MainSearchInput.tsx:42-48, 50-61). Raw text is dispatched with no metacharacter escaping."
  - "Layout: PageWithLeftSidebar.MainContainer → ContentContainer → LeftSidebarContainer(xs=3)/<Filters/> + ListContainer(xs=9)/<MainSearch .. disableSuggestions/> + WithPermissionsProvider(Component={Results}) (Search.tsx:102-118)"
- invariants:
  - "**Server-side URL-backed session model; deep-link restore is REAL as of this commit.** App.tsx:61-64 nested `index`+`:searchId` routes (was a `'/search/*'` splat) → `useSearchRouteParams().searchId` resolves → effect 2 (Search.tsx:65-69) restores the session instead of effect 1 minting a replacement. IT-125 locks: GET /api/search/{searchId} returns 200, the query is restored in the search box, and ZERO replacement POSTs fire for a valid deep-link."
  - "**Graceful dead-link state: 404 → 'This search has expired' screen; non-404 → real-status AppErrorPage.** Search.tsx:48-51 + 94-100. The 404 branch offers a working recovery (Start new search → resetLoaderByAction + createSearch). Reliant on errorHandling.tsx:12-18 unwrapping `ResponseError.response` so `searchError.status` is the real HTTP status, not undefined."
  - "**Permission-gating at the DEG-Create CTA only; LIST + search input + filter sidebar are NOT gated.** Search.tsx:110-114 (`WithPermissionsProvider Component={Results}`) INJECTS permission context but ALWAYS renders `<Results/>` (WithPermissionsProvider.tsx:30-39 — the `Component` branch renders unconditionally inside a PermissionProvider). Only the conditional 'Add group' button is gated, at Results.tsx:125 (`WithPermissions permissionTo={DATA_ENTITY_GROUP_CREATE}`) AND class-tab-gated (`showDEGBtn`, Results.tsx:126). Every authenticated user sees the full catalog list (Results.tsx:151 unconditional `.map`)."
  - "**Read-collaborative posture — no per-owner / per-namespace scoping at the UI layer; 'My Objects' is opt-in.** The result list renders every server-returned entity; the only owner-scoping affordance is the My Objects tab (Results child), which sets `myObjects:true` on the next update. Default tab is 'All' → full catalog. Backend non-scoping is owned by batch-ZE SearchController + SearchServiceImpl (referenced, not re-verified at this commit)."
  - "**Text-query `query` field is dispatched verbatim — no client-side sanitisation.** MainSearchInput.tsx:38, 44 build `{query, pageSize:30, filters:{}}` and dispatch as-is; Search.tsx:109 mounts MainSearch with no validation prop. tsquery metacharacters reach the backend FTS path (REFACTOR-229, batch-ZE — referenced)."
  - "**`pageSize` is dead AND off-contract.** Search.tsx:60 + MainSearchInput.tsx:38 pass `pageSize:30`, but (a) `pageSize` is not a SearchFormData property in the spec (components.yaml:2244-2287) so it is not part of the wire payload, and (b) result pagination is driven by Results.tsx:45 `const size = 30`, not by the session. `handleStartNewSearch` (Search.tsx:55) omits `pageSize` entirely — confirming it is inert."
  - "**Empty-state copy lives in the Results child, not this orchestrator.** Results.tsx:161-165 renders `EmptyContentPlaceholder text={t('No matches found')}` — same string for a fresh zero-entity deployment and a zero-result filter."
- audiences:
  - "odd-platform-ui-end-user — the Catalog page is the principal data-discovery entry point; reaching `/search` requires an authenticated session under LOGIN_FORM/OAUTH2/LDAP, or `auth.type=DISABLED` dev-only mode"
  - "data-engineer-analyst / data-quality-engineer / data-scientist-ml-engineer / viz-bi-engineer — the personas who discover entities via free-text + faceted search (system-mission.md P-01)"
  - "platform-operator — validates catalog state during onboarding; uses 'Add group' to bootstrap DEG structure; receives shared `/search/{uuid}` links from teammates"

## dependencies_semantic

- requires-feature:
  - "F-017 / P-01:F-005 Search Filter Facets (Data Discovery pillar Catalog page) — this UI is the OPERATOR ENTRY POINT; batch-ZE covers the backend half."
  - "P-08 housekeeping — F-010 SearchFacetsHousekeepingJob (search_facets 30-day TTL eviction) is what makes a deep-linked session eventually 404, triggering the SearchSessionExpired path (referenced, not re-verified at this commit)."
  - "P-09 Authorization framework — `Permission.DATA_ENTITY_GROUP_CREATE` (Search.tsx:111) gates the DEG-create CTA only."
  - "Layout pillar (PageWithLeftSidebar) — shared left-sidebar primitive; sibling consumer is TermSearch.tsx."
- requires-config:
  - "(none operator-controllable in this component) — `1500` ms debounce (Search.tsx:82), the xs split 3/9 (Search.tsx:105, 108), and the dead `pageSize:30` (Search.tsx:60) are build-time literals. Result page size is Results.tsx:45. No env/feature-flag controls this component."
- requires-runtime:
  - "React 18+ — `React.useEffect` (Search.tsx:58, 65, 88), `React.useCallback` (53, 71)"
  - "Redux Toolkit — `useAppDispatch`/`useAppSelector` (Search.tsx:35, 39-46); `dataEntitySearch` slice owns session-merge; `loader` slice owns async status + error state (loader.slice.ts)"
  - "`react-router-dom` — `useNavigate` (via useCreateSearch.ts:2); `useSearchRouteParams` (Search.tsx:36, from the `routes` barrel re-exporting searchRoutes.ts:18-19)"
  - "`use-debounce` — `useDebouncedCallback` (Search.tsx:72; 1500 ms leading-edge)"
  - "`lodash/mapValues` + `lodash/values` — transform `searchFacetParams` into the wire `filters` shape (Search.tsx:3-4, 77)"
  - "`generated-sources` — `Permission` enum (Search.tsx:25); the SearchFormData/SearchFacetsData types (typescript-fetch generator v7.2.0 from odd-platform-specification per generate.sh + openapi-config.yaml; output dir is gitignored)"
  - "`components/shared/contexts` — `WithPermissionsProvider` (Search.tsx:26)"
  - "`components/shared/elements` — `AppErrorPage`, `MainSearch`, `PageWithLeftSidebar`, `SearchSessionExpired` (Search.tsx:6-11)"
  - "`redux/slices/loader.slice` — `resetLoaderByAction` (Search.tsx:28; loader.slice.ts:18-24, 53)"
  - "`redux/actions` — `getDataEntitySearchActionType` (Search.tsx:29; dataentitySearch.actions.ts:5-8)"
- couples-to:
  - "`Filters` (Filters.tsx:1-76) — child; no props; mounts 7 facets (Datasource/Type/Namespace/Owner/Tag/Groups/Statuses at Filters.tsx:47-65; Type only when an entity-class tab is selected, :53)"
  - "`MainSearch` → `MainSearchInput` (MainSearchInput.tsx:1-82) — dispatches `updateDataEntitiesSearch` synchronously on Enter (in-session path; mainSearch omitted here); text-query bypasses this orchestrator's debouncer"
  - "`Results` (Results.tsx:1-177) — injected via `Component={Results}`; owns InfiniteScroll + SearchResultsTabs + EmptyContentPlaceholder + the DEG-create button + the result-fetch (`fetchDataEntitySearchResults({searchId, page+1, size:30})`, Results.tsx:71-74)"
  - "`useCreateSearch` (useCreateSearch.ts:1-23) — `createDataEntitiesSearch` dispatch + `navigate(searchPath(searchId))`; NO `.catch` on the `.then` chain (lines 14-19). Shared with MainSearchInput.tsx (handleCreateSearch path)"
  - "`handleResponseAsyncThunk` (handleResponseThunk.ts:19-43) — wraps each search thunk in try/catch; on error calls `getErrorResponse(err)` + `showServerErrorToast(err)` (unless `switchOffErrorMessage`) + `rejectWithValue(errResp)`. This is why a failed create/restore surfaces a toast AND populates the loader error map."
  - "Server-side (referenced — batch-ZE): `POST /api/search` (SearchController.search), `GET /api/search/{searchId}` (getSearchFacetList), `PUT /api/search/{searchId}` (updateSearchFacets), `GET /api/search/{searchId}/results` (getSearchResults, via Results)"

## upstream_callers

- entry_point: "ui_route:/search (index)"
  caller_node: "ts app-route:App.tsx-line-62"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:34 (lazy import) + App.tsx:61-64 (`<Route path={searchPath()}><Route index element={<Search/>}/><Route path=':searchId' element={<Search/>}/></Route>`). The index route mounts Search with NO `:searchId` → effect 1 (Search.tsx:58-63) fires createSearch."
  observation_class: ui-call

- entry_point: "ui_route:/search/:searchId (deep-link / reload)"
  caller_node: "ts app-route:App.tsx-line-63"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:63 nested `:searchId` route. `useSearchRouteParams().searchId` now resolves → effect 2 (Search.tsx:65-69) fires getDataEntitiesSearch to RESTORE the session. Pre-#1760 this route was a splat and the param was always undefined (the bug fixed by this commit; IT-125 regression-locks the restore)."
  observation_class: ui-call

- entry_point: "ui_button:top-nav-Catalog-tab"
  caller_node: "ts react-component:ToolbarTabs.tsx-line-38"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:38 (`link: searchPath()` — bare, no UUID) + :93 (`matchPath(\\`${searchPath()}/*\\`, ...)` selects the tab). Clicking 'Catalog' from any page lands on `/search` index → effect 1 mints a fresh session; the prior session UUID is orphaned server-side until housekeeping reaps it."
  observation_class: ui-call

- entry_point: "ui_button:global-MainSearch-top-nav (mainSearch=true)"
  caller_node: "ts react-component:MainSearchInput.tsx-line-37 (handleCreateSearch path)"
  multiplicity_per_trigger: 1
  evidence: "A global `<MainSearchInput mainSearch={true}/>` calls `useCreateSearch().createSearch(...)` then navigates to `/search/{newId}` (useCreateSearch.ts:14-19), bringing the user TO this Catalog page as the result surface."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: db-write
  description: "Creates a new `search_facets` row on first mount with empty query + empty filters (POST /api/search). Server allocates the session UUID; no owner/created_by column (REFACTOR-344, referenced)."
  evidence: "Search.tsx:58-63 + useCreateSearch.ts:14-19 + dataentitiesSearch.thunks.ts:25-32"
  cardinality_per_call: "1 per Catalog index-route mount with no cached searchId; UNBOUNDED retry loop if POST /api/search keeps failing (effect-1 re-fires on each pending→rejected transition — see bugs[1], probe P-244)"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_button:top-nav-Catalog-tab"
    - "ui_button:global-MainSearch-top-nav (mainSearch=true)"

- side_effect_class: db-read
  description: "Restores the persisted `search_facets` row on deep-link / reload (GET /api/search/{searchId}). NOW REAL (route param resolves post-#1760)."
  evidence: "Search.tsx:65-69 + dataentitiesSearch.thunks.ts:43-50 + IT-125 spec (asserts 200 + query restored)"
  cardinality_per_call: "1 per deep-link / reload arrival when no cached searchId exists"
  reachable_from_entry_points:
    - "ui_route:/search/:searchId (deep-link / reload)"

- side_effect_class: db-write
  description: "Updates the session's query/filters on facet click or text-query submit (PUT /api/search/{searchId})."
  evidence: "Search.tsx:71-92 (debounced facet path) + MainSearchInput.tsx:42-48 (synchronous text path) + dataentitiesSearch.thunks.ts:34-41"
  cardinality_per_call: "1 per facet click (the 1500 ms debounce is defeated by useCallback recreation — bugs[3]); 1 per text-query Enter"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (deep-link / reload)"

- side_effect_class: redirect-issue
  description: "After a successful POST /api/search, `navigate(searchPath(searchId))` performs a client-side route push to `/search/{newUuid}` (URL updates without full reload)."
  evidence: "useCreateSearch.ts:16-18"
  cardinality_per_call: "1 per session-create"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_button:global-MainSearch-top-nav (mainSearch=true)"

- side_effect_class: page-render
  description: "Renders one of THREE terminal views: (i) SearchSessionExpired ('This search has expired' + Start-new-search) for a 404 deep-link failure; (ii) AppErrorPage (real status + Home link) for a non-404 deep-link failure; (iii) the three-child Catalog shell (Filters + MainSearch + Results). The DEG-create button visibility leaks the user's DATA_ENTITY_GROUP_CREATE permission to the DOM."
  evidence: "Search.tsx:94-96 (expired) + 98-100 (error page) + 102-118 (catalog shell)"
  cardinality_per_call: "1 per render"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (deep-link / reload)"
    - "ui_button:top-nav-Catalog-tab"

- side_effect_class: log-emit
  description: "On any search-thunk rejection, a server-error toast is shown (handleResponseAsyncThunk → showServerErrorToast), deduped by id=response.url. This is the operator-visible signal that the old sidecar incorrectly claimed was absent."
  evidence: "handleResponseThunk.ts:34-39 + errorHandling.tsx:58-80"
  cardinality_per_call: "1 toast per distinct failing URL (deduped)"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (deep-link / reload)"

- side_effect_class: external-call
  description: "REFERENCE — pagination dispatches GET /api/search/{searchId}/results?page=&size=30 from the Results child (Results.tsx:71-74). See batch-ZA SearchResults sidecar."
  evidence: "Results.tsx:71-74 + dataentitiesSearch.thunks.ts:52-67"
  cardinality_per_call: "1 per infinite-scroll page"
  reachable_from_entry_points:
    - "ui_route:/search (index)"
    - "ui_route:/search/:searchId (deep-link / reload)"
  unresolved: true

## implicit_adrs

- "**Graceful dead-link state: a 404 search deep-link is treated as a normal expired-link UX, NOT a platform fault (#1760).** Search.tsx:48-51 + 94-100 + SearchSessionExpired.tsx:12-13. The decision distinguishes a 404 (the ephemeral session is gone — TTL eviction or a foreign/typo'd link → SearchSessionExpired with a recovery affordance) from any other status (a real error → AppErrorPage with the actual status). The intent is explicit in two comments. This is a deliberate product stance: shareable search links are a discovery-surface trust promise (CTRIB-005 scope analysis), so a dead link must self-explain and offer a one-click fresh start rather than dumping a generic error boundary." — evidence: Search.tsx:48-51 + 94-100 + SearchSessionExpired.tsx:12-13 — intent_anchor: "// A deep-linked session that failed to load: 404 = the ephemeral session is gone (expired TTL / foreign link) — a graceful dead-link state, not an error (#1760)." (Search.tsx:48-49) + "// Graceful state for a search deep-link whose ephemeral session no longer exists (#1760): the link is dead data, not a platform fault" (SearchSessionExpired.tsx:12-13) — confidence: HIGH

- "**Error status is unwrapped from the generated client's ResponseError at a single chokepoint, so FE error states carry real HTTP statuses.** errorHandling.tsx:12-18 `toResponse` unwraps `err.response` (the typescript-fetch `ResponseError` wraps the `Response`); `getErrorResponse` then reads the real `status`/`statusText`/body. This is the load-bearing dependency for the 404-vs-other branch in Search.tsx:51 — without it, `searchError.status` would be undefined and the expired-state discrimination could not work." — evidence: errorHandling.tsx:12-36 — intent_anchor: "// The generated API client throws ResponseError wrapping the Response (runtime.ts), so the real status/statusText/body live one level deeper than a bare fetch Response." (errorHandling.tsx:12-13) — confidence: HIGH

- "**Server-side URL-backed session model with a server-generated UUID; restore wired through nested routes.** App.tsx:61-64 (nested `index`+`:searchId`) + searchRoutes.ts:3-19 + useCreateSearch.ts:16-18. The session (query+myObjects+facetState) lives on the server keyed by UUID, surfaced as the URL path segment, enabling deep-link sharing + reload survival + server-side TTL cleanup. The #1760 commit corrects the route shape so the restore path actually executes (the prior `'/search/*'` splat had silently disabled it for ~18 months)." — evidence: App.tsx:61-64 + searchRoutes.ts:3-19 + useCreateSearch.ts:16-18 + Search.tsx:65-69 — intent_anchor: useCreateSearch.ts:16-18 chains `.then(({searchId}) => navigate(searchPath(searchId)))` — the navigation IS the load-bearing side-effect of session create — confidence: HIGH

- "**Permission-gated DEG-Create CTA via the WithPermissions/Provider pattern (UI hide, not auth enforcement).** Search.tsx:110-114 + Results.tsx:125-138. `WithPermissionsProvider Component={Results}` injects the permission context and ALWAYS renders Results (WithPermissionsProvider.tsx:30-39); the only gate is the inner `WithPermissions` around the conditionally-rendered 'Add group' button. Backend authorization is the operative defence (batch-ZE)." — evidence: Search.tsx:110-114 + WithPermissionsProvider.tsx:30-39 + Results.tsx:125-138 — intent_anchor: the `Component` branch of WithPermissionsProvider renders `<PermissionProvider><Component/></PermissionProvider>` unconditionally (WithPermissionsProvider.tsx:30-39) — confidence: HIGH

- "**1500 ms leading-edge debouncer for facet mutations; text queries bypass it.** Search.tsx:71-86 (`{leading: true}`) + MainSearchInput.tsx:50-61 (synchronous dispatch on Enter). The model: facet clicks coalesce, explicit text submits fire immediately." — evidence: Search.tsx:82-83 + MainSearchInput.tsx:50-61 — intent_anchor: the `{leading: true}` option passed to `useDebouncedCallback(..., 1500, { leading: true })` (Search.tsx:83) — confidence: HIGH (intent is explicit; the implementation defeats it — see bugs[3])

- "**Read-collaborative posture — every authenticated user searches the entire catalog by default; 'My Objects' is opt-in.** Search.tsx:102-118 (no owner wrap on the Results mount) + Results.tsx:151 (unconditional .map). The backend non-scoping is owned by SearchServiceImpl (batch-ZE, referenced). This is the UI counterpart of system-mission.md's read-collaborative stance." — evidence: Search.tsx:102-118 + Results.tsx:151-159 + batch-ZE SearchController owner_scoping (referenced) — intent_anchor: the absence of any per-owner wrap on the result-list mount + the My-Objects affordance being a tab toggle rather than a default — confidence: MEDIUM (UI-side absence is HIGH-confidence; the backend non-scoping is a cross-batch reference not re-verified at this commit)

## bugs_limitations_corner_cases

- "**LSN-017-class dep-array smell on the create effect (Search.tsx:58-63) — now manifests as a create-FAILURE retry loop.** The guard reads three values (`routerSearchId`, `isSearchCreating`, `searchId`) but the deps array is only `[routerSearchId, isSearchCreating]`. On SUCCESS the smell is masked (navigate + Redux searchId update batch together, as before). On FAILURE the smell becomes active: `createDataEntitiesSearch` rejects → `isSearchCreating` flips pending→false → the effect re-fires → guard still passes (`!searchId` true, no UUID was stored) → re-dispatch. With no backoff this is a tight retry loop bounded only by round-trip latency. A server-error toast is shown each cycle but deduped by URL, so the operator sees one persistent toast over a storm of POSTs. Probe P-244 emitted to measure the loop's request cardinality." — evidence: Search.tsx:58-63 + useCreateSearch.ts:14-19 (no .catch) + handleResponseThunk.ts:34-41 (rejectWithValue + toast) + P-244 — severity: MEDIUM

- "**LSN-017-class dep-array smell on the facet-sync effect (Search.tsx:88-92).** The guard reads `searchFacetsSynced` but the deps array is only `[searchFacetParams]`. The effect does not re-fire when `searchFacetsSynced` transitions back to true (set on every fulfilment at slice.ts:97). Combined with `mapValues(...)` producing a fresh `filters` reference each dispatch (Search.tsx:77), this is a candidate re-fire vector during the in-flight PUT window. Class-match to LSN-017; pinned by existing probe P-189." — evidence: Search.tsx:88-92 + dataEntitySearch.slice.ts:97 + P-189 — severity: MEDIUM

- "**Correct counter-example: the restore effect (Search.tsx:65-69) has a deps array matching its read-set** (`[searchId, routerSearchId]` vs guard reading both). Documented to show the LSN-017 class disappears when deps match reads — the contrast with effects 1 and 3 is the structural lesson." — evidence: Search.tsx:65-69 — severity: N/A (counter-example)

- "**Debouncer is recreated on every facet-state change — the 1500 ms rate-limit is not realised.** Search.tsx:71-86: `useCallback(useDebouncedCallback(..., 1500, {leading:true}), [searchId, searchFacetParams])`. `searchFacetParams` changes on every facet click → a new debouncer instance per click → the prior pending timer is unreachable → every click dispatches immediately. A user clicking 5 facets in 2 s issues ~5 PUTs, not 1. Identical to TermSearch batch-U. Pinned by existing probe P-189." — evidence: Search.tsx:71-86 (useCallback deps at :85) + P-189 — severity: MEDIUM

- "**Create-path failure is not surfaced as a component-level error state (only a toast).** useCreateSearch.ts:14-19 has no `.catch`; the dataEntitySearch slice has no `.rejected` case (extraReducers at slice.ts:214). The loader slice DOES capture create rejections in its error map (loader.slice.ts:42-49) and a toast IS shown (handleResponseThunk.ts:37-39), BUT Search.tsx's expired/error gates (lines 94-100) key off `getDataEntitySearchActionType` (the GET/restore action) ONLY — they do NOT read the create action's loader status. So a failing POST /api/search renders no dedicated UI; the page shows the create skeleton/empty shell while effect 1 retries (bugs[1]) and toasts accumulate-then-dedupe. NOTE: this corrects the prior sidecar's claim that create-failure shows 'a frozen empty page with no error message' — a toast appears; the residual gap is the absence of a create-specific error/expired screen + the retry loop." — evidence: useCreateSearch.ts:14-19 + dataEntitySearch.slice.ts:214 + loader.slice.ts:42-49 + handleResponseThunk.ts:37-39 + Search.tsx:94-100 (gates read only the GET action) — severity: MEDIUM

- "**Deep-link session expiry is now RECOVERABLE (was 'no recovery path' pre-#1760).** A reload/deep-link to `/search/{evicted-uuid}` (after the 30-day SearchFacetsHousekeepingJob TTL, F-010) → GET /api/search/{searchId} 404 → `SearchSessionExpired` renders 'This search has expired' + a 'Start new search' button (handleStartNewSearch → resetLoaderByAction + createSearch). The prior sidecar's bug 'permanently broken page, no recovery' is RESOLVED for the deep-link case. Residual: the URL still carries the dead UUID until the user clicks Start-new-search (which navigates to a fresh UUID); IT-125 asserts the recovery navigates to a new /search/{uuid} and the expired text clears." — evidence: Search.tsx:53-56 + 94-96 + SearchSessionExpired.tsx:35-40 + IT-125 spec lines 62-78 — severity: LOW (resolved; residual is cosmetic)

- "**Race: in-flight facet PUT vs synchronous text-query PUT.** A facet click (dispatches immediately due to the broken debouncer) then an Enter-submit within the round-trip window both hit PUT /api/search/{searchId} with different payloads — the facet payload carries `filters: mapValues(searchFacetParams, values)` (Search.tsx:77) while the text payload carries `filters: {}` (MainSearchInput.tsx:44). Whichever resolves second wins; a facet selection can be discarded by a text submit." — evidence: Search.tsx:74-80 + MainSearchInput.tsx:42-48 — severity: LOW

- "**FTS-injection: typed search text reaches the backend tsquery path unescaped (REFACTOR-229, batch-ZE).** MainSearchInput.tsx:38, 44 dispatch the raw `query`; Search.tsx:109 mounts MainSearch with no validation prop. tsquery metacharacters (`( ) & | ! * :`) can poison the session. The live doc now WARNS about these characters (see docs_link_semantic), but the UI provides ZERO programmatic mitigation. The backend FTS/highlight sink line numbers are owned by batch-ZE / REFACTOR-229 (referenced, not re-verified at this commit); pinned end-to-end by existing probe P-188." — evidence: Search.tsx:109 + MainSearchInput.tsx:38, 44 + REFACTOR-229 (referenced) + P-188 — severity: HIGH (security/availability; the UI-side absence of mitigation is HEAD-verified, the backend sink is a reference)

- "**Cross-owner result set: read-collaborative posture, no UI affordance to scope to 'my data' by default.** Results.tsx:151 renders every server-returned entity; the My Objects tab is opt-in. A user can find any team's entity (incl. names like `finance/customers_pii`) regardless of ownership. Not a per-component bug; a per-component manifestation of the platform stance." — evidence: Search.tsx:102-118 + Results.tsx:151-159 + system-mission.md read-collaborative posture (referenced) — severity: MEDIUM

- "**Pagination total-vs-list divergence inherited from REFACTOR-425 (batch-ZE).** Results.tsx:71-74 paginates via `fetchDataEntitySearchResults({searchId, page+1, size:30})`; `hasNext` is computed client-side (Results.tsx:54, 72). The backend's `hasNext` contract bug (batch-ZE) is masked for the UI but exposed for third-party OpenAPI consumers. UI does no defensive count check." — evidence: Results.tsx:54, 71-74 + REFACTOR-425 (referenced) — severity: MEDIUM

- "**Empty-state copy 'No matches found' does not distinguish a zero-entity deployment from a zero-result filter.** Results.tsx:161-165. A fresh ODD with no ingested entities shows the same string as an over-filtered search — an onboarding gap." — evidence: Results.tsx:161-165 — severity: LOW

- "**Suggestions explicitly disabled on this surface (`disableSuggestions`, Search.tsx:109).** The suggestions backend exists but is suppressed here; the live doc does not mention suggestions either way." — evidence: Search.tsx:109 + MainSearchInput.tsx:75 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "Search.tsx:60 + MainSearchInput.tsx:38"
      name: "pageSize"
      value: "30"
      questions:
        - q: "What at pageSize=0 / 31 / any value?"
          a: "No effect on result loading. `pageSize` is NOT a SearchFormData property in the spec (components.yaml:2244-2287 lists only query/my_objects/filters, required:[filters]) — the typescript-fetch client serialises only contract fields, so pageSize never reaches the server. Result pagination is driven solely by Results.tsx:45 `const size = 30`. The literal is dead twice over (off-contract AND superseded by the Results constant)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:60 + MainSearchInput.tsx:38 + components.yaml:2244-2287 + Results.tsx:45"
        - q: "What does the operator see at each boundary?"
          a: "No difference for any value. A maintainer bumping Search.tsx:60 to 50 sees no change — they must edit Results.tsx:45 and (if they want it on the wire) add pageSize to the spec + regenerate the client. handleStartNewSearch (Search.tsx:55) already omits pageSize, confirming it is inert."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:55, 60 + Results.tsx:45 + components.yaml:2244-2287"

    - location: "Search.tsx:82"
      name: "debounce window"
      value: "1500 (ms)"
      questions:
        - q: "What at debounce=1500 (current)?"
          a: "Non-functional. The useCallback deps `[searchId, searchFacetParams]` (Search.tsx:85) recreate the debouncer on every facet click, so only the FIRST click of a session ever sees the window; subsequent clicks each construct a fresh leading-edge debouncer that fires immediately. Net: N PUTs per N clicks."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:71-86 (deps at :85) + bugs[3]"
        - q: "What does the operator see at each boundary (0 / 1500 / 10000)?"
          a: "Today, all values behave identically (N PUTs per N clicks) because the debouncer is recreated each click. If the recreation bug were fixed, 1500 ms would coalesce rapid clicks into one trailing PUT after an immediate leading one; 10000 ms would feel sluggish. Probe P-189 measures the broken cardinality."
          confidence: PROBE-NEEDED
          evidence: "P-189"

  name_behavior_pairs:
    - name: "createSearch (useCreateSearch hook)"
      promise: "Create a new search session and navigate to the URL carrying its UUID."
      implementation: "dispatch(createDataEntitiesSearch).unwrap().then(({searchId}) => navigate(searchPath(searchId))). No .catch — rejection re-thrown by .unwrap() is an unhandled promise rejection in the fire-and-forget effect (a toast still shows via the thunk wrapper)."
      drift: NONE
      operator_visible_consequence: "Name/impl align on the happy path; the failure path has no .catch and (via the effect-1 deps smell) loops — see bugs[1]/[5]."
      confidence: STATIC-INFERRED
      evidence: "useCreateSearch.ts:14-19 + handleResponseThunk.ts:34-41"

    - name: "updateSearchFacets (Search.tsx debouncer)"
      promise: "Debounce facet mutations and push them every 1500 ms."
      implementation: "useCallback recreates useDebouncedCallback on every searchFacetParams change, defeating the debounce; every click dispatches immediately."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "5 rapid facet clicks → ~5 PUTs instead of 1; backend load amplifies. Pinned by P-189."
      confidence: PROBE-NEEDED
      evidence: "Search.tsx:71-86 + P-189"

    - name: "MainSearch (placeholder='Search')"
      promise: "Friendly free-text natural-language search."
      implementation: "Typed text dispatched verbatim into SearchFormData.query → backend tsquery path (REFACTOR-229, referenced). Whitespace-separated words work; tsquery metacharacters poison the session."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Typing an entity name with `:` or parens (e.g. a Snowflake-style fully-qualified name) can break the search. The live doc now warns 'Avoid the characters ( ) & | ! * :' but the input itself gives no inline feedback."
      confidence: STATIC-INFERRED
      evidence: "Search.tsx:109 + MainSearchInput.tsx:38, 44 + REFACTOR-229 (referenced) + WebFetch /features/data-discovery/search 2026-06-11"

    - name: "SearchSessionExpired / 'This search has expired'"
      promise: "Tell the user their search link is dead and offer a clean restart."
      implementation: "Rendered only when isDeepLinkNotLoaded AND searchError.status === 404 (Search.tsx:51, 94-96). 'Start new search' resets the loader for the GET action then createSearch()."
      drift: NONE
      operator_visible_consequence: "Honours its promise; recovery navigates to a fresh /search/{uuid} (IT-125)."
      confidence: STATIC-INFERRED
      evidence: "Search.tsx:48-56, 94-96 + SearchSessionExpired.tsx:29-40 + IT-125 spec lines 62-78"

    - name: "Catalog top-nav tab"
      promise: "Take me to the catalog of all data entities."
      implementation: "ToolbarTabs.tsx:38 links to searchPath() (no UUID) → /search index → effect 1 mints a new session, dropping any current /search/{uuid} session."
      drift: MINOR
      operator_visible_consequence: "An operator inside a filtered session who clicks 'Catalog' loses their filters (new empty session). The live doc now documents this ('Clicking the Catalog top-nav tab drops the UUID and starts a fresh session')."
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:38, 93 + Search.tsx:58-63 + searchRoutes.ts:11 + WebFetch 2026-06-11"

  orderings:
    - location: "Results.tsx:71-74 (downstream, out of this orchestrator's scope)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer for the result list?"
          a: "REFERENCE — owned by batch-ZE SearchController + the downstream FTS/JOOQ chain. This orchestrator imposes no client-side ordering."
          confidence: REFERENCE
          evidence: "odd-platform__java__SearchController (batch-ZE)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No client-side re-sort: the slice appends pages and Results.tsx:151 renders in array order. Trust-the-server posture."
          confidence: STATIC-INFERRED
          evidence: "Results.tsx:151-159"

  auth_gates:
    - location: "Search.tsx:1-122 + App.tsx:61-64 (route mount)"
      endpoint: "ui_route:/search + /search/:searchId + downstream POST/GET/PUT /api/search"
      questions:
        - q: "What does this route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymous traffic reaches the route + downstream APIs (no SECURITY_RULES entry for /api/search*, per batch-ZE). LOGIN_FORM/OAUTH2/LDAP: any authenticated user (any role) reaches the full Catalog. The route mount (App.tsx:61-64) is BARE — no WithPermissionsProvider wraps it. Pinned by existing probe P-187."
          confidence: PROBE-NEEDED
          evidence: "P-187 + App.tsx:61-64 + batch-ZE SearchController invariants (referenced)"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: the full Catalog. Under LOGIN_FORM/OAUTH2/LDAP: the platform HTTP layer redirects to login before Search mounts; enforcement is at the network layer, not in this component."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:1-122 (no auth check) + batch-ZE security model (referenced)"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated user sees the full result list. The DEG-create button is hidden without DATA_ENTITY_GROUP_CREATE (Results.tsx:125) — a UI hide, not auth; backend POST /api/dataentitygroups is gated separately."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:110-114 + Results.tsx:125-138"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE for the read surface (batch-ZE: no @PreAuthorize, no owner-scoping on the main result list). The route mount has no permission wrap. The only gate is the platform redirect-to-login under non-DISABLED modes."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:61-64 + batch-ZE SearchController invariants (referenced) + P-187"

  resource_boundaries:
    - location: "Search.tsx:58-63 (create effect) + 71-92 (debouncer + facet-sync effect)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Facet PUT vs text-query PUT race (bugs[7]) — whichever resolves second wins; a text submit carrying filters:{} can discard a facet selection. The create effect's failure-retry loop (bugs[1]) can also race multiple in-flight POSTs before the first resolves."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:58-63, 74-80 + MainSearchInput.tsx:42-48"
        - q: "Is the call replay-safe?"
          a: "POST /api/search: NOT idempotent (each call mints a new UUID; failure-retry loop mints many orphans on the server). PUT /api/search/{searchId}: idempotent for identical payload + UUID. GET /api/search/{searchId}: idempotent."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:58-63 + useCreateSearch.ts:14-19 + batch-ZE (referenced)"
        - q: "If a cache fronts this, what is the TTL / staleness window?"
          a: "No UI cache (Redux in-memory; no localStorage). Server-side search_facets has a 30-day TTL (SearchFacetsHousekeepingJob, F-010, referenced) — a deep-link older than that 404s and now renders SearchSessionExpired (bugs[6])."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:1-122 (no cache) + F-010 (referenced) + Search.tsx:94-96"

  request_inputs:
    # Search.tsx is a UI orchestrator: its 'request inputs' are (a) the route param :searchId,
    # and (b) the SearchFormData payload it dispatches (query, filters, myObjects, the dead pageSize).

    - location: "Search.tsx:36 (useSearchRouteParams → routerSearchId) + searchRoutes.ts:4-5"
      input_kind: path-param
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "'searchId' in the URL bar /search/{uuid} reads like a stable, shareable handle for THIS search — implies a saved/persistent search resource."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 + Search.tsx:36"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Search.tsx:36 → :67 dispatch getDataEntitiesSearch({searchId: routerSearchId}) → searchApi.getSearchFacetList (dataentitiesSearch.thunks.ts:43-50) → batch-ZE GET /api/search/{searchId} → reads the search_facets row by PK. It is a server-side EPHEMERAL session UUID, not a user-meaningful saved-search id."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:65-69 + dataentitiesSearch.thunks.ts:43-50 + batch-ZE (referenced)"
        - q: "Does the actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name implies a durable handle; the implementation is an ephemeral 30-day-TTL session UUID with no user binding (REFACTOR-344, referenced). HOWEVER the gap is narrower than at the prior enrichment: the live doc NOW states the URL is 'a server-side session, not a frozen query' and documents the 30-day eviction, and the code now renders a self-explaining expired state on 404. The remaining drift is that the parameter name itself still communicates neither the TTL nor the bearer-token shape."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 + REFACTOR-344 (referenced) + F-010 (referenced) + WebFetch 2026-06-11 + Search.tsx:94-96"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when wrong?"
          a: "(a) Bookmark/share a link, return after 30 days → 404 → 'This search has expired' + Start-new-search (recoverable now, was a dead page before #1760). (b) The recipient of a shared link can READ and UPDATE the session (no user binding). (c) An adversary harvesting valid UUIDs can poison sessions via FTS-injection (REFACTOR-229). (d) Clicking the Catalog tab drops the current UUID. The name 'searchId' signals none of these; the live doc now does (b)-style sharing semantics and (d)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:94-96 + REFACTOR-344/REFACTOR-229 (referenced) + ToolbarTabs.tsx:38 + WebFetch 2026-06-11"
        - q: "Is there a column/field that DOES match the name and is unused (available-but-unused)?"
          a: "NONE — there is no saved-search entity in odd-platform. Verified at this commit: `grep -irn 'saved.?search|savedSearch|saved_search' <odd-platform-repo>` (search root: entire repo) returns ZERO files. To honour 'searchId' as a durable handle would require a new saved-search feature (a table with owner_id/name/created_at). The drift is structural: the feature the name implies does not exist."
          confidence: STATIC-INFERRED
          evidence: "`grep -irn 'saved.?search|savedSearch|saved_search' <odd-platform-repo>` 2026-06-11 (search root: entire repo; zero matches) + components.yaml:2244-2287 (SearchFormData has no name field)"
      routes_to_finding: "bugs[6] (expiry now recoverable) + security.known_security_gaps (bearer-token-shape) + docs_link_semantic (mostly resolved on the live doc)"

    - location: "Search.tsx:60, 75 + MainSearchInput.tsx:38, 44 (SearchFormData.query)"
      input_kind: body-field
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "'query' + the placeholder 'Search' (Search.tsx:109) promise free-text natural-language search."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:109 + MainSearchInput.tsx:38 + components.yaml:2247-2248"
        - q: "When supplied, what does the implementation USE it for?"
          a: "MainSearchInput.tsx:38/44 build {query,pageSize:30,filters:{}} → createDataEntitiesSearch/updateDataEntitiesSearch → POST/PUT /api/search → batch-ZE FTS path (to_tsquery + a highlight SQL-interpolation sink per REFACTOR-229; backend line numbers referenced, not re-verified at this commit)."
          confidence: STATIC-INFERRED
          evidence: "MainSearchInput.tsx:38-48 + dataentitiesSearch.thunks.ts:25-50 + REFACTOR-229 (referenced)"
        - q: "Does the actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — natural-language promise vs Postgres tsquery expression language. Whitespace words work; metacharacters (`( ) & | ! * :`) can poison the session. The live doc NOW warns about exactly these characters (resolving the prior doc gap), but the UI still performs no inline validation."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:109 + MainSearchInput.tsx:38-48 + REFACTOR-229 (referenced) + WebFetch 2026-06-11"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when wrong?"
          a: "Typing `db:schema:table`, a quoted phrase, or boolean operators yields broken or surprising results; deliberate metacharacters poison the session UUID (DoS vector, shareable). Pinned by existing probe P-188."
          confidence: PROBE-NEEDED
          evidence: "P-188 + REFACTOR-229 (referenced)"
        - q: "Is there a closer-aligned field unused?"
          a: "NONE — search_facets.query_string stores the raw text; there is no parsed/validated form. The fix is a client-side parser OR a backend tsquery escape at the FTS chokepoint (REFACTOR-229's architectural fix)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:2247-2248 + REFACTOR-229 (referenced)"
      routes_to_finding: "bugs[8] (FTS-injection) + security.known_security_gaps + docs_link_semantic (query-char caveat now documented)"

    - location: "Search.tsx:71-80 (filters via mapValues(searchFacetParams, values))"
      input_kind: body-field
      input_name: "filters"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A structured set of facet selections (Datasource/Type/Namespace/Owner/Tag/Groups/Statuses)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:77 + components.yaml:2251-2285"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Search.tsx:77 flattens {facetName:{optionId:state}} → {facetName:[state]} → PUT /api/search/{searchId} → batch-ZE updateSearchFacets → persisted JSONB → translated to WHERE clauses on fetch. MATCHES at the structural level; filters is the only `required` SearchFormData field (components.yaml:2286-2287)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:71-80 + dataentitiesSearch.thunks.ts:34-41 + components.yaml:2251-2287"
        - q: "Does the actual scope MATCH the name's promise?"
          a: "MATCHES — facet payload corresponds to facet WHERE clauses; the 8 spec facet keys map to the 7 rendered Filters (entity_classes is set by the tab, not the sidebar)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:71-80 + Filters.tsx:47-65 + components.yaml:2253-2285"
        - q: "Available-but-unused?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A"

    - location: "Search.tsx:76 (myObjects forwarded from getSearchMyObjects)"
      input_kind: body-field
      input_name: "myObjects (spec: my_objects)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A scope-to-my-data toggle — when true, return only entities the current user owns."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:76 + components.yaml:2249-2250"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Search.tsx:76 forwards myObjects → PUT /api/search/{searchId} → batch-ZE: when true the result query is scoped to the user's owner mapping; when false, full catalog. Backend line numbers referenced (not re-verified at this commit)."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:76 + batch-ZE SearchController (referenced)"
        - q: "Does the actual scope MATCH the name's promise?"
          a: "MATCHES (objects I OWN, via user-owner mapping). LSN-020 class-awareness note: 'my' resolves to the user-OWNER mapping, not the created_by audit column — but for 'my objects' the owner mapping IS the correct semantic, so this is NOT a drift, just a documented edge."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:76 + LSN-020 + batch-ZE (referenced)"
        - q: "For wrong assumption / available-but-unused?"
          a: "Edge: a user with no USER_OWNER_MAPPING entry who toggles myObjects=true sees an empty list. Fix is to add a mapping, not rename. No closer-aligned field."
          confidence: STATIC-INFERRED
          evidence: "LSN-020 + batch-ZE (referenced)"
      routes_to_finding: "N/A (drift NONE; LSN-020 cross-link for class-awareness)"

    - location: "Search.tsx:60 (pageSize in the create payload)"
      input_kind: body-field
      input_name: "pageSize"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Results per page."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:60"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Nothing on the wire — pageSize is NOT a SearchFormData property in the spec (components.yaml:2244-2287), so the generated client does not serialise it. Result pagination uses Results.tsx:45 size=30."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:60 + components.yaml:2244-2287 + Results.tsx:45"
        - q: "Does the actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY (stronger than the prior enrichment said): not merely superseded by a Results constant, it is OFF-CONTRACT. A maintainer editing it sees no effect AND it is not even sent to the server."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:60 + components.yaml:2244-2287 + Results.tsx:45"
        - q: "Available-but-unused?"
          a: "Results.tsx:45 `const size = 30` is the authoritative size. Recommend removing pageSize from the create payload (handleStartNewSearch already omits it) or wiring a single shared constant."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:55, 60 + Results.tsx:45"
      routes_to_finding: "invariants (pageSize dead + off-contract)"

  probes_emitted:
    - probe_id: P-244
      question: "Create-FAILURE retry loop on Search.tsx:58-63 (effect-1 deps smell × isSearchCreating pending->rejected re-fire) — measures POST cardinality in a 10s window under a forced 500"
      probe_path: "lineage/odd-platform/probes/P-244.yaml"
    - probe_id: P-187
      question: "(pre-existing) Auth gate at the Catalog route under DISABLED + the bare route mount"
      probe_path: "lineage/odd-platform/probes/P-187.yaml"
    - probe_id: P-188
      question: "(pre-existing) FTS-injection / session-poisoning end-to-end from the typed query"
      probe_path: "lineage/odd-platform/probes/P-188.yaml"
    - probe_id: P-189
      question: "(pre-existing) Debouncer recreation under rapid facet clicking — PUT cardinality"
      probe_path: "lineage/odd-platform/probes/P-189.yaml"

  stress_summary:
    triggers_total: 13
    questions_total: 41
    answers_static_inferred: 34
    answers_probe_needed: 5
    answers_reference: 2
    drift_flags: 5   # updateSearchFacets, MainSearch/query, Catalog-tab(MINOR), searchId, pageSize
```

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "Canonical live doc for Search Filter Facets (P-01:F-005 / F-017). WebFetched in this session 2026-06-11 — status 200. The page enumerates the same 7 facets THIS UI's <Filters/> renders (Filters.tsx:47-65) and NOW documents the session model, deep-link sharing, the 30-day eviction, the Catalog-tab-drop, and the query-character caveat — content that was absent at the prior (2026-05-20) enrichment."
    last_verified_at: "2026-06-11T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "WebFetch in this session against the live URL (two prompts: facet/query/session-coverage + my-objects/pagination/expiry-coverage)"
    confidence: HIGH
- fetched_excerpts: |
    From live WebFetch of `https://docs.opendatadiscovery.org/features/data-discovery/search` (status 200, 2026-06-11):
    - Facets (matches Filters.tsx:47-65): Datasource, Type, Namespace, Owner, Tag, Groups, Statuses.
    - Query: "Type your search query into the search bar and ODD does the rest." Caveat: "Avoid the characters ( ) & | ! * : in the search box." — the platform treats these as FTS operators; entering them causes subsequent reads to fail with HTTP 500 until corrected.
    - Session model: the /search/{id} URL is "a server-side session, not a frozen query"; "Sharing a /search/{uuid} URL with a teammate hands them an interactive cursor, not a snapshot"; "Clicking the Catalog top-nav tab drops the UUID and starts a fresh session."
    - Expiry: "A session row lives until 30 days after its last access (configurable via housekeeping.ttl.search_facets_days). After eviction the URL returns no results (the Catalog reverts to an empty state)." Bookmarking is described as "unreliable" for long-term reference.
    - My Objects tab: "The subset of the above owned by the authenticated user. The personal-namespace tab."
    - NOT covered: search suggestions/autocomplete; pagination / infinite-scroll / page size; the 'Add group' (DEG-create) CTA; the new "This search has expired" screen.
- doc_drift_findings:
  - "**RESOLVED since the prior enrichment (docs caught up):** deep-link share-ability, the read-collaborative / My-Objects posture, the query-character caveat, and the Catalog-tab-drops-session behaviour are now all documented on the live page (WebFetched 2026-06-11). The four prior UI-DOC-GAPs (A/B/C/G) are substantially closed on the doc side. The corresponding CODE-side facts (no client-side FTS mitigation; default cross-owner visibility) remain real and live in bugs/security — code facts, not doc facts."
  - "**NEW forward-drift — UI-DOC-GAP-Search-H: the live doc says an expired session 'returns no results (the Catalog reverts to an empty state)'; the CODE at this commit renders a dedicated 'This search has expired' screen with a 'Start new search' button (Search.tsx:94-96 + SearchSessionExpired.tsx:29-40).** The doc describes the PRE-#1760 behaviour. This is release-train territory: the #1760 fix rides milestone 0.28.0 (CTRIB-005), and a pending-release doc update (DOC-443, per workspace state) should re-describe the expired-link UX. Severity: MEDIUM (the doc actively mis-describes the new behaviour). Routed from name_behavior_pairs.SearchSessionExpired + bugs[6]."
  - "**UI-DOC-GAP-Search-D (still open): pagination / infinite-scroll / 30-per-page is undocumented.** Severity: LOW."
  - "**UI-DOC-GAP-Search-E (still open): the DEG-create ('Add group') CTA visibility model (DATA_ENTITY_GROUP_CREATE + ENTITY_GROUP tab) is undocumented.** Severity: LOW."
  - "**UI-DOC-GAP-Search-F (still open): suggestions are explicitly disabled on this surface (Search.tsx:109) and undocumented either way.** Severity: LOW."

**Release-train marker** *(adrs/drafts/release-train-doc-gating.md)*: the "This search has expired" UX is merged on this branch but rides milestone **0.28.0**; the matching doc update is pending-release (DOC-443). UI-DOC-GAP-Search-H confidence stays LOW until the release gate publishes and a later enrichment verifies the live page describes the expired-screen behaviour.

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the Catalog page is a UI/API surface protected by the three non-DISABLED modes; under `auth.type=DISABLED` the route + downstream APIs are anonymously reachable (dev-only mode; pinned by existing probe P-187). The component itself does no auth-mode gating — App.tsx:61-64 mounts it bare; the platform HTTP layer enforces redirect-to-login under non-DISABLED modes.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. Drives `/api/search/*`, governed by SECURITY_RULES, not the ingestion filter.
- **authorization_assertions**:
  - "`<WithPermissionsProvider allowedPermissions={[DATA_ENTITY_GROUP_CREATE]} resourcePermissions={[]} Component={Results}/>` (Search.tsx:110-114) — INJECTS permission context; ALWAYS renders Results (WithPermissionsProvider.tsx:30-39). NOT a route gate."
  - "`<WithPermissions permissionTo={DATA_ENTITY_GROUP_CREATE}>` (Results.tsx:125) — UI HIDE of the 'Add group' button (invisible, not disabled)."
  - "NO row-level authorization on the result list (Results.tsx:151 unconditional .map)."
  - "NO @PreAuthorize on SearchController.search (batch-ZE, referenced) — read surface open to authenticated users (and to anyone under DISABLED)."
- **owner_scoping**: `BYPASSES — read-collaborative posture` (backend non-scoping owned by batch-ZE SearchServiceImpl, referenced; UI-side confirmed by the absence of any owner wrap on the Results mount, Search.tsx:110-114, and Results.tsx:151). My Objects is opt-in.
- **data_exposure**:
  - "The result list exposes every data-entity row across every owner/namespace to every authenticated user (Results.tsx:151) — names like `finance/customers_pii` are discoverable regardless of ownership."
  - "Click-through to entity detail is unconditional per row (Results child); per F-001 the detail open inflates view_count (LSN-017)."
  - "The DEG-create button visibility leaks the user's DATA_ENTITY_GROUP_CREATE permission to the DOM (when on the ENTITY_GROUP tab)."
  - "The session UUID is visible in the URL (`/search/{uuid}`) and is bearer-token-shaped — no user binding (REFACTOR-344, referenced); sharing the URL shares read+update access to the session. The live doc now describes this as 'an interactive cursor, not a snapshot'."
  - "Typed query text is stored server-side and reflected in SearchFacetsData.query; combined with REFACTOR-229 it is a session-poisoning / SQL-injection vector at the backend (referenced)."
- **known_security_gaps**:
  - "**Read-collaborative posture — every authenticated user searches the entire catalog by default; My Objects is opt-in.** Now documented on the live doc, but the code stance is unchanged." — evidence: Search.tsx:110-114 + Results.tsx:151-159 + batch-ZE (referenced) — severity: MEDIUM
  - "**FTS-injection / session-poisoning at the typed query (REFACTOR-229) — UI provides ZERO programmatic mitigation.** The live doc warns about the characters, but there is no client-side validation/escape. Backend FTS + highlight-SQL-interpolation sinks owned by batch-ZE (referenced, not re-verified at this commit); pinned by existing probe P-188." — evidence: Search.tsx:109 + MainSearchInput.tsx:38, 44 + REFACTOR-229 (referenced) + P-188 — severity: HIGH (UI-side absence HEAD-verified; backend sink a reference)
  - "**Session UUID is bearer-token-shaped (REFACTOR-344).** No user binding; the param name 'searchId' does not communicate it. Category F finding." — evidence: Search.tsx:65-69 + REFACTOR-344 (referenced) — severity: MEDIUM
  - "**Create-path failure has no component-level error surface and retries unboundedly.** The expired/error gates (Search.tsx:94-100) key only off the GET action, so a failing POST /api/search renders no dedicated UI; effect 1 retries (bugs[1], P-244). A toast IS shown (corrects the prior 'no error message' claim), but it is deduped to one. Observability + DoS-amplification concern under a partial search outage." — evidence: Search.tsx:58-63, 94-100 + useCreateSearch.ts:14-19 + loader.slice.ts:42-49 + P-244 — severity: MEDIUM
  - "**Deep-link restore failure is now surfaced gracefully (404 → expired screen; other → AppErrorPage).** This is a security/observability IMPROVEMENT over the prior silent-failure posture — recorded for the audit trail." — evidence: Search.tsx:48-51, 94-100 + errorHandling.tsx:12-18 — severity: N/A (improvement)
  - "**Anonymous reach under auth.type=DISABLED.** Pinned by existing probe P-187; the route mount is bare and the downstream APIs have no SECURITY_RULES entry (batch-ZE, referenced)." — evidence: P-187 + App.tsx:61-64 + batch-ZE (referenced) — severity: MEDIUM

## performance

- **hot_paths**:
  - "Initial mount fires POST /api/search → server-side session INSERT + a catalog-wide facet/count aggregation (batch-ZE, referenced) on every Catalog index-route mount. For a large catalog this is non-trivial per mount." — evidence: Search.tsx:58-63 + useCreateSearch.ts:14-19 + batch-ZE (referenced)
  - "**NEW: create-failure retry loop (bugs[1]) turns a single failed mount into a storm of POST /api/search calls** (no backoff) — a self-inflicted load amplifier under a partial search outage. Probe P-244 measures the cardinality." — evidence: Search.tsx:58-63 + P-244
  - "Facet interactions fire one PUT per click (broken debouncer, bugs[3]) — 5 clicks → ~5 PUTs. Pinned by P-189." — evidence: Search.tsx:71-92 + P-189
  - "Restore (deep-link/reload) fires one GET /api/search/{searchId} (now real post-#1760). 404 on an evicted session → SearchSessionExpired (cheap)." — evidence: Search.tsx:65-69 + F-010 (referenced)
- **throughput_characteristics**:
  - "Single-item mutation per facet change (no bulk-facet API); the broken debouncer means N PUTs per N clicks."
  - "Text-query fires one synchronous PUT per Enter (no debounce)." — evidence: MainSearchInput.tsx:42-48
  - "Infinite-scroll: one GET per page (size=30, Results.tsx:45)."
- **resource_allocation**:
  - "Each facet dispatch allocates a fresh `mapValues(searchFacetParams, values)` object (Search.tsx:77); the debouncer is reconstructed per facet click (bugs[3])."
  - "Redux store holds the facet-state map + loaded result pages + suggestions/facets caches (dataEntitySearch.slice.ts:22) — bounded by loaded page count × 30."
- **scaling_characteristics**:
  - "Stateless component (no module-level mutable state — Search.tsx:1-122). Dev StrictMode double-mount fires the create twice (orphans one session); production builds do not." — evidence: Search.tsx:1-122
  - "Manual URL edit /search/X → /search/Y triggers the restore effect (Search.tsx:65-69) for the new UUID." — evidence: Search.tsx:65-69
- **known_performance_gaps**:
  - "**Create-failure retry loop (P-244)** — the highest-leverage new perf concern: a flaky/failing POST /api/search is amplified by the dep-array smell into a tight retry. Recommended fix: add `searchId` to effect-1 deps AND a backoff/short-circuit on the rejected status." — evidence: Search.tsx:58-63 + P-244 — severity: MEDIUM
  - "**Broken debouncer (P-189)** — 1500 ms intent unrealised; N PUTs per N facet clicks. Fix: useMemo the debouncer or drop searchFacetParams from the useCallback deps. Fix BOTH Search.tsx and TermSearch.tsx together." — evidence: Search.tsx:71-86 + P-189 — severity: MEDIUM
  - "**Catalog-wide aggregation on every mount** — combined with the no-rate-limit posture, repeated session creation is a DoS lever; the UI offers no client throttle." — evidence: Search.tsx:58-63 + batch-ZE (referenced) — severity: MEDIUM

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Deep-link to a VALID /search/{searchId} loads the shared session (GET 200, query restored in the search box) and fires ZERO replacement POSTs — the #1551 splat regression is locked closed."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:80-106"]
  - behaviour: "Deep-link to a MISSING /search/{uuid} renders 'This search has expired' and 'Start new search' navigates to a fresh /search/{uuid} (recovery), with the expired text cleared."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:62-78"]
  - behaviour: "Missing-session reads (facets / results / facet/{type}) are uniformly 404 USR002; unrouted /api path is a framework 404; invalid facet enum is 400 USR001 (the #1761 class)."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:36-60"]
  - behaviour: "Term-search mirror: /termsearch/{valid} restores and /termsearch/{missing} shows the same expired state."
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:108-122"]
- uncovered_behaviours:
  - behaviour: "Create-FAILURE retry loop (POST /api/search 500 on mount → effect-1 re-fires unboundedly)"
    test_class: integration
    criticality: HIGH
    note: "P-244 emitted; no current spec forces a failing create"
  - behaviour: "Facet change with synced=false → one PUT per 1500ms window (currently FAILS — debouncer recreated per click)"
    test_class: integration
    criticality: HIGH
    note: "P-189 emitted"
  - behaviour: "Facet PUT vs text-query PUT race → eventual-consistency / no silent facet loss"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "FTS metacharacter query poisons the session (UI-side: no mitigation)"
    test_class: security
    criticality: HIGH
    note: "P-188 emitted"
  - behaviour: "Cross-owner default-tab visibility (read-collaborative posture)"
    test_class: security
    criticality: HIGH
  - behaviour: "Anonymous reach under auth.type=DISABLED"
    test_class: security
    criticality: HIGH
    note: "P-187 emitted"
  - behaviour: "Non-404 deep-link failure renders AppErrorPage with the real status (e.g. a 500/401 restore) — only the 404 branch is asserted by IT-125"
    test_class: integration
    criticality: MEDIUM
    note: "IT-125 covers the 404 branch; the AppErrorPage (non-404) branch at Search.tsx:98-100 is unasserted"
  - behaviour: "Pure-component unit tests (jest + @testing-library/react) for the three useEffect dep-array smells"
    test_class: unit
    criticality: HIGH
    note: "no Search.test.tsx exists; the LSN-017-class smells are caught only at integration today"
- test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts"]
- gaps: |
    The #1760 fix is now well-covered at the INTEGRATION layer by IT-125 (restore, expired state,
    recovery, no-replacement-POST guard, term-search mirror, and the BE status-alignment). The worst
    remaining gaps are: (a) the non-404 AppErrorPage branch (Search.tsx:98-100) is unasserted; (b)
    the create-failure retry loop (P-244) has no forcing test; (c) the broken debouncer (P-189) and
    the FTS UI-mitigation absence (P-188) are PROBE-NEEDED; (d) there is no component-level unit test
    harness, so the three dep-array smells (effects at 58-63, 65-69, 88-92) are not caught at PR time.
    The highest-leverage addition is a unit test asserting effect-1 does NOT re-dispatch createSearch
    after a rejection (would red-flag the retry loop deterministically).

## coherence_check (LSN-018 Rule 6)

Coherence check across F-017.yaml, IT-125 spec, CTRIB-005, and sibling sidecars (batch ZA/ZE/ZH/ZI, batch-U TermSearch):

- **Corrects the prior Search sidecar (batch ZL)** on three load-bearing points the #1760 commit changed: (1) effect 2 (restore) is now REAL (route fixed from splat to nested param) — the prior "restores … when reload/deep-link arrives" was the BROKEN intent; (2) deep-link expiry is now RECOVERABLE (SearchSessionExpired), not a dead page; (3) create/restore failure surfaces a toast + (for restore) a dedicated error state — the prior "frozen empty page, no error message" / "slice missing .rejected" claims are corrected (the loader slice owns error state, loader.slice.ts:42-49).
- **Strengthens F-017** (Search Filter Facets, P-01:F-005) — provides the UI-half evidence for the route-restore fix, the graceful dead-link UX, and the residual create-failure retry loop. Confirms the existing F-017 facets (cross_owner_facet_enumeration, bearer_token_shaped_session_uuids, tsquery_operator_injection_dos, disabled_mode_bypass, side_effect_update_on_every_get) at HEAD.
- **Strengthens batch-ZE SearchController** — the backend half (no @PreAuthorize, no owner-scoping, FTS-injection, no user binding, 30-day TTL) composes with this UI: backend open + UI no-defensive-padding. The #1760 BE status-alignment (filters 500→404) is locked by IT-125.
- **Strengthens batch-ZH ToolbarTabs** — confirms the Catalog-tab-drops-session behaviour at the new index route (App.tsx:62).
- **Strengthens batch-ZI searchRoutes** — confirms searchPath()/useSearchRouteParams() and the now-correct nested route shape (the route-module sidecar predates the fix).
- **Strengthens batch-U TermSearch** — TermSearch.tsx mirrors this fix verbatim (SearchSessionExpired + isDeepLinkNotLoaded + the same expired/error gates, TermSearch.tsx:46-103). The debouncer/dep-array smells remain shared; fix both files together.
- **Refines the LSN-017 link**: the shape is NOT the view_count response-derived-dep case. The new, sharper manifestation is effect-1's create-FAILURE retry loop — a dep-array-vs-read-set divergence that becomes a tight loop on rejection (P-244). Class-match to LSN-017; distinct mechanism.

## sources

- understanding ← Search.tsx:1-122 + searchRoutes.ts:1-19 + App.tsx:34, 61-64 + SearchSessionExpired.tsx:1-46 + AppErrorPage.tsx:1-41 + errorHandling.tsx:12-18 + useCreateSearch.ts:1-23 + MainSearchInput.tsx:1-82 + IT-125 spec + WebFetch /features/data-discovery/search 2026-06-11 status 200
- concepts.entities ← Search.tsx:6-29, 39-51, 110-114 + components.yaml:2244-2287 + SearchSessionExpired.tsx:1-46 + AppErrorPage.tsx:1-41 + errorHandling.tsx:5-18 + loader.slice.ts:42-49 + dataentitySearch.selectors.ts:60 + searchRoutes.ts:3-19 + Filters.tsx:47-65
- concepts.operations ← Search.tsx:53-92 + useCreateSearch.ts:14-19 + MainSearchInput.tsx:42-61 + Results.tsx:71-74 + dataentitiesSearch.thunks.ts:25-50
- concepts.invariants[0] (restore real) ← App.tsx:61-64 + Search.tsx:65-69 + IT-125 spec:80-106
- concepts.invariants[1] (graceful dead-link) ← Search.tsx:48-51, 94-100 + SearchSessionExpired.tsx:12-13 + errorHandling.tsx:12-18
- concepts.invariants[2] (DEG-create gate only) ← Search.tsx:110-114 + WithPermissionsProvider.tsx:30-39 + Results.tsx:125-138, 151-159
- concepts.invariants[3] (read-collaborative) ← Search.tsx:102-118 + Results.tsx:151-159 + batch-ZE (referenced)
- concepts.invariants[4] (query verbatim) ← Search.tsx:109 + MainSearchInput.tsx:38, 44
- concepts.invariants[5] (pageSize dead + off-contract) ← Search.tsx:55, 60 + components.yaml:2244-2287 + Results.tsx:45
- concepts.invariants[6] (empty-state in Results) ← Results.tsx:161-165
- dependencies_semantic ← Search.tsx:1-31 (imports) + loader.slice.ts:18-53 + dataentitySearch.actions.ts:5-8 + handleResponseThunk.ts:19-43 + generate.sh + openapi-config.yaml
- upstream_callers ← App.tsx:34, 61-64 + searchRoutes.ts:3-19 + ToolbarTabs.tsx:38, 93 + MainSearchInput.tsx:37 (global mainSearch path)
- downstream_side_effects ← Search.tsx:53-118 + useCreateSearch.ts:14-19 + dataentitiesSearch.thunks.ts:25-50 + handleResponseThunk.ts:34-39 + Results.tsx:71-74
- implicit_adrs[0] (graceful dead-link) ← Search.tsx:48-51, 94-100 + SearchSessionExpired.tsx:12-13
- implicit_adrs[1] (ResponseError unwrap chokepoint) ← errorHandling.tsx:12-36
- implicit_adrs[2] (URL-backed session; restore wired) ← App.tsx:61-64 + searchRoutes.ts:3-19 + useCreateSearch.ts:16-18 + Search.tsx:65-69
- implicit_adrs[3] (DEG-create UI hide) ← Search.tsx:110-114 + WithPermissionsProvider.tsx:30-39 + Results.tsx:125-138
- implicit_adrs[4] (1500ms leading-edge debouncer) ← Search.tsx:82-83 + MainSearchInput.tsx:50-61
- implicit_adrs[5] (read-collaborative posture) ← Search.tsx:102-118 + Results.tsx:151-159 + batch-ZE (referenced)
- bugs[1] (create-failure retry loop) ← Search.tsx:58-63 + useCreateSearch.ts:14-19 + handleResponseThunk.ts:34-41 + P-244
- bugs[2] (facet-sync effect smell) ← Search.tsx:88-92 + dataEntitySearch.slice.ts:97 + P-189
- bugs[3] (restore effect counter-example) ← Search.tsx:65-69
- bugs[4] (broken debouncer) ← Search.tsx:71-86 + P-189
- bugs[5] (create-path no component error surface; toast shown; gates key off GET only) ← useCreateSearch.ts:14-19 + dataEntitySearch.slice.ts:214 + loader.slice.ts:42-49 + handleResponseThunk.ts:37-39 + Search.tsx:94-100
- bugs[6] (expiry now recoverable) ← Search.tsx:53-56, 94-96 + SearchSessionExpired.tsx:35-40 + IT-125 spec:62-78 + F-010 (referenced)
- bugs[7] (facet/text race) ← Search.tsx:74-80 + MainSearchInput.tsx:42-48
- bugs[8] (FTS-injection UI no-mitigation) ← Search.tsx:109 + MainSearchInput.tsx:38, 44 + REFACTOR-229 (referenced) + P-188
- bugs[9] (cross-owner result set) ← Search.tsx:102-118 + Results.tsx:151-159 + system-mission.md read-collaborative (referenced)
- bugs[10] (page-vs-count divergence) ← Results.tsx:54, 71-74 + REFACTOR-425 (referenced)
- bugs[11] (empty-state copy) ← Results.tsx:161-165
- bugs[12] (suggestions disabled) ← Search.tsx:109 + MainSearchInput.tsx:75
- stress_findings.tunables ← Search.tsx:55, 60, 82, 85 + components.yaml:2244-2287 + Results.tsx:45 + P-189
- stress_findings.name_behavior_pairs ← useCreateSearch.ts:14-19 + Search.tsx:71-86, 94-96, 109 + MainSearchInput.tsx:38-61 + SearchSessionExpired.tsx:29-40 + ToolbarTabs.tsx:38, 93 + IT-125 spec
- stress_findings.orderings ← Results.tsx:71-74, 151-159 + batch-ZE (referenced)
- stress_findings.auth_gates ← Search.tsx:1-122 + App.tsx:61-64 + batch-ZE (referenced) + P-187
- stress_findings.resource_boundaries ← Search.tsx:58-63, 71-92 + MainSearchInput.tsx:42-48 + F-010 (referenced)
- stress_findings.request_inputs.searchId ← Search.tsx:36, 65-69 + searchRoutes.ts:4-5 + REFACTOR-344/F-010 (referenced) + `grep -irn 'saved.?search|savedSearch|saved_search' <odd-platform-repo>` 2026-06-11 (zero saved-search matches; search root: entire repo) + components.yaml:2244-2287
- stress_findings.request_inputs.query ← Search.tsx:60, 75, 109 + MainSearchInput.tsx:38, 44 + components.yaml:2247-2248 + REFACTOR-229 (referenced) + P-188
- stress_findings.request_inputs.filters ← Search.tsx:71-80 + dataentitiesSearch.thunks.ts:34-41 + components.yaml:2251-2287 + Filters.tsx:47-65
- stress_findings.request_inputs.myObjects ← Search.tsx:76 + components.yaml:2249-2250 + LSN-020 + batch-ZE (referenced)
- stress_findings.request_inputs.pageSize ← Search.tsx:55, 60 + components.yaml:2244-2287 + Results.tsx:45
- stress_findings.probes_emitted ← P-244 (this refresh) + P-187/P-188/P-189 (pre-existing)
- docs_link_semantic ← Search.tsx (no @docs) + WebFetch /features/data-discovery/search 2026-06-11 status 200 (two prompts)
- security.auth_mode_relevance ← Search.tsx:1-122 + App.tsx:61-64 + P-187
- security.authorization_assertions ← Search.tsx:110-114 + WithPermissionsProvider.tsx:30-39 + Results.tsx:125-138, 151-159 + batch-ZE (referenced)
- security.owner_scoping ← Search.tsx:110-114 + Results.tsx:151-159 + batch-ZE (referenced)
- security.data_exposure ← Search.tsx:65-69, 110-114 + Results.tsx:151-159 + REFACTOR-344/REFACTOR-229 (referenced) + WebFetch 2026-06-11
- security.known_security_gaps ← Search.tsx:58-63, 94-100, 109-114 + useCreateSearch.ts:14-19 + loader.slice.ts:42-49 + errorHandling.tsx:12-18 + REFACTOR-229/REFACTOR-344 (referenced) + P-187 + P-188 + P-244
- performance.hot_paths ← Search.tsx:58-92 + useCreateSearch.ts:14-19 + Results.tsx:71-74 + batch-ZE (referenced) + P-244 + P-189
- performance.known_performance_gaps ← Search.tsx:58-86 + P-244 + P-189 + batch-ZE (referenced)
- tests_coverage_semantic ← integration-tests/e2e/specs/search-session-not-found.spec.ts:36-122 + Search.tsx:58-100 + P-187/P-188/P-189/P-244

## confidence_per_field

- understanding: HIGH (whole-file read at 074c9927 + the #1760 supporting files read in full)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (IT-125 spec read in full this session)
- docs_link_semantic: HIGH (live WebFetch 2026-06-11 status 200; facet list matches Filters.tsx; new forward-drift H is the honest finding)
- implicit_adrs: HIGH (every decision has a HEAD-verified intent_anchor comment in the read files)
- bugs_limitations_corner_cases: HIGH (UI-side facts HEAD-verified; backend sinks honestly marked as references)
- security: MEDIUM (UI-side posture HEAD-verified; the backend non-scoping / FTS-sink claims are cross-batch references not re-verified at this commit; P-187/P-188 still PROBE-NEEDED)
- performance: MEDIUM (the retry-loop and debouncer claims are STATIC-INFERRED from the read source; P-244/P-189 PROBE-NEEDED for cardinality)
- upstream_callers: HIGH (App.tsx:61-64 + ToolbarTabs.tsx:38, 93 read this session)
- downstream_side_effects: HIGH (every effect anchored at file:line; the Results-child reference honestly flagged unresolved)
- stress_findings: MEDIUM (41 questions / 13 triggers; 34 STATIC-INFERRED + 5 PROBE-NEEDED + 2 REFERENCE; load-bearing drift claims for searchId/query/pageSize are HIGH STATIC-INFERRED; the loop/debouncer cardinality and auth-reach are PROBE-NEEDED)

## Maintainer notes


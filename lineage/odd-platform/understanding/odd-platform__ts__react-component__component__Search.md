---
node_id: "odd-platform ts react-component component:Search"
node_kind: react-component
axis: ui_components
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZL-Search-final
feature_hint: "P-01:F-002 (Search and Filtering — Data Discovery pillar Catalog page). UI entry point for the F-001-anchored Discovery search surface: the Catalog page reached at `/search/*` (App.tsx:61 + searchRoutes.ts:3 `BASE_PATH = '/search'`). Sister to TermSearch.tsx (Dictionary tab — P-06:F-001, batch U) — both use the identical session-create + URL-restore + facet-debouncer + WithPermissionsProvider pattern. This Search.tsx is the canonical/older instance; TermSearch.tsx is the term-catalog clone. The backend partner is the batch-ZE SearchController (`POST /api/search` → SearchController.search + facet aggregators) and the FTS injection finding (REFACTOR-229 + the TRUE-SQL-injection at `highlightDataEntity`) lives in the same `JooqFTSHelper.tsQuery` code path the user's typed query text reaches. The Catalog-page UI shell delegates to three children: Filters (left sidebar — 7 facets), MainSearch (text input — wraps MainSearchInput), and Results (main pane — infinite-scroll + tabs + DEG-create button)."
related_features:
  - F-001       # the bug-anchored Detail-page view tracking (pillar-anchored P-01:F-002 Popular Entities Ranking via rev3 reclassification — Search is the discovery counterpart to Popular)
  - F-008       # cross-references via REFACTOR-425 page-vs-count divergence family
related_pillar_features:
  - "P-01:F-002"   # Search and Filtering (Data Discovery pillar) — this UI IS the operator-facing surface
related_retrospectives:
  - LSN-017   # useEffect dep-array doubling — three smells located here (see bugs_limitations_corner_cases — none is the exact view_count case but TWO are active class-matches)
  - LSN-018   # coherence: cross-checks F-001 + batch-ZE SearchController + batch-U TermSearch sidecar + REFACTOR-229 + REFACTOR-425
  - LSN-020   # Category F mandate — every named request input (here: `query`, `:searchId`, `filters`, `myObjects`, `pageSize`) traced for name-vs-implementation drift
  - LSN-023   # do not interpret a backend-named field semantically without checking what the UI form populating it means by the same name
related_batches:
  - ZA   # SearchResults UI sidecar (anchored within Results.tsx — child of this orchestrator)
  - ZE   # SearchController class + .search method (backend partner of this UI; TRUE-SQL-injection at highlightDataEntity + the no-auth/no-PreAuthorize surface)
  - ZH   # ToolbarTabs (top-nav "Catalog" → `/search` link; documents the tab-click drops session race)
  - ZI   # searchRoutes.ts (route-construction module; documents `:searchId` route param Category F drift)
  - ZL   # this sidecar — FINAL refresh consolidating the Search page root with stress_findings + probes
---

# Search (Catalog page — Discovery search/filter root) — semantic understanding

## understanding

`Search.tsx` (lines 1-92) is the Data Discovery pillar's **Catalog page** root SPA component — the user-facing entry point at `/search/*` (App.tsx:61 + searchRoutes.ts:3 `BASE_PATH = '/search'`) that drives the catalog-wide data-entity browsing experience. It is a 92-line orchestrator that (a) **creates a server-side search session** via `POST /api/search` → `SearchController.search` (batch-ZE sidecar) on first mount when no `:searchId` URL parameter is present and no Redux-cached `searchId` exists — delegating to `useCreateSearch()` (useCreateSearch.ts:14-19) which dispatches `createDataEntitiesSearch` and then `navigate(searchPath(searchId))` to capture the new UUID in the URL (lines 37-42); (b) **restores an existing session** from the URL parameter via `GET /api/search/{searchId}` → `SearchController.getSearchFacetList` when reload/deep-link arrives with a session UUID (lines 44-48); (c) **debounces facet-state mutations** at 1500 ms leading-edge and dispatches `updateDataEntitiesSearch` → `PUT /api/search/{searchId}` whenever the filter sidebar selection diverges from the server-synced state (lines 50-71); (d) **lays out the three-child shell**: `<Filters/>` (left sidebar — 7 facets per docs WebFetched 2026-05-20 status 200), `<MainSearch placeholder={t('Search')} disableSuggestions/>` (top — text-query input wrapping MainSearchInput, lines 79-80), and `<Results/>` wrapped in `WithPermissionsProvider allowedPermissions=[DATA_ENTITY_GROUP_CREATE]` so the "Add group" CTA inside Results.tsx (Results.tsx:125-138) is permission-gated (lines 81-85). The component is a thin orchestrator over `redux/slices/dataEntitySearch.slice.ts` — every render reads the Redux session state (`searchId`, `searchQuery`, `searchMyObjects`, `searchFacetParams`, `searchFacetsSynced`, `isSearchCreating`) and dispatches mutations through three thunks (`createDataEntitiesSearch`, `getDataEntitiesSearch`, `updateDataEntitiesSearch`). The user-typed search **text** is NOT entered here directly — `<MainSearch>` mounts `<MainSearchInput>` which carries its own internal Enter/click handlers that route through `useCreateSearch` (for the global / mainSearch=true path) or `updateDataEntitiesSearch` (for the in-session updateSearch path); the typed text is forwarded into the `SearchFormData.query` field that the backend's `JooqFTSHelper.tsQuery` ultimately splits-and-prefixes (`q + ":*"` per REFACTOR-229) before passing to `to_tsquery(?)` — meaning **the UI performs NO client-side sanitisation of search query text**.

## concepts

- entities:
  - "SearchFormData (OpenAPI-generated request DTO — `generated-sources`; `{query: string, pageSize: number, filters: {...facetMap...}, myObjects?: boolean}`; carries the `query` field that ultimately reaches `to_tsquery(?)` per the JooqFTSHelper code path — REFACTOR-229)"
  - "SearchFacetsData (OpenAPI-generated response DTO; carries `{searchId, query, myObjects, facetState, total, myObjectsTotal}`; the server-side session row in `search_facets` table)"
  - "DataEntitySearchState (Redux slice — `state.dataEntitySearch` shape `{searchId, query, myObjects, totals, results: {items, pageInfo}, suggestions, facets, facetState, isFacetsStateSynced, dataEntitySearchHighlightById}` per dataEntitySearch.slice.ts:22-36)"
  - "Permission.DATA_ENTITY_GROUP_CREATE (enum value — passed to `WithPermissionsProvider allowedPermissions=[DATA_ENTITY_GROUP_CREATE]` at Search.tsx:82 + consumed downstream via `WithPermissions permissionTo={Permission.DATA_ENTITY_GROUP_CREATE}` in Results.tsx:125 wrapping the 'Add group' button)"
  - "useSearchRouteParams (route hook from searchRoutes.ts:18-19 — extracts `{searchId}` from `useParams()`; here destructured as `routerSearchId` at Search.tsx:27 — see batch ZI for the route-module-level Category F traces)"
  - "Server-side search session UUID (the `:searchId` URL parameter — captured at searchRoutes.ts:4 `SEARCH_ID_PARAM = ':searchId'`; persisted server-side as a `search_facets` row keyed by server-generated UUID per batch-ZE SearchController.search invariants; the UUID has NO user binding per REFACTOR-344)"
  - "PageWithLeftSidebar (layout primitive — `MainContainer`, `ContentContainer`, `LeftSidebarContainer`, `ListContainer` at lines 74-87; identical sibling pattern used by TermSearch.tsx — verified by Grep `PageWithLeftSidebar.MainContainer` returning both files)"
  - "Filters / Results / MainSearch (three child components — Filters.tsx renders 7 facets per the WebFetched docs; Results.tsx renders the InfiniteScroll + tabs + EmptyContentPlaceholder; MainSearch wraps MainSearchInput.tsx — re-export verified at components/shared/elements/index.ts:3)"
- operations:
  - "On mount: if URL has NO `:searchId` AND no in-flight create AND no cached `searchId` → call `createSearch({query:'', pageSize:30, filters:{}})` (Search.tsx:37-42); the `useCreateSearch` hook dispatches `createDataEntitiesSearch` thunk which wraps `searchApi.search(...)` per dataentitiesSearch.thunks.ts:25-32; on fulfilment `navigate(searchPath(searchId))` writes the new UUID into the URL via useCreateSearch.ts:16-18"
  - "On URL change with `:searchId` present and NO cached `searchId`: dispatch `getDataEntitiesSearch({searchId: routerSearchId})` (Search.tsx:44-48); thunk wraps `searchApi.getSearchFacetList(...)` per dataentitiesSearch.thunks.ts:43-50 — restores the session from server-side state"
  - "On facet-state change (`searchFacetParams` diff): if NOT synced → call debounced `updateSearchFacets` (Search.tsx:67-71); the debouncer (1500 ms leading-edge, lines 51-63) dispatches `updateDataEntitiesSearch({searchId, searchFormData: {query, myObjects, filters: mapValues(searchFacetParams, values)}})` — thunk wraps `searchApi.updateSearchFacets(...)` per dataentitiesSearch.thunks.ts:34-41"
  - "Layout dispatch: render `<PageWithLeftSidebar.MainContainer>` containing (a) left sidebar with `<Filters/>` (xs=3) at lines 76-78; (b) main area with `<MainSearch placeholder={t('Search')} disableSuggestions/>` (line 80) above `<WithPermissionsProvider allowedPermissions=[DATA_ENTITY_GROUP_CREATE]>` wrapping `<Results/>` (xs=9) at lines 79-86 — the 'Add group' button inside Results is the only mutation CTA on this surface"
  - "Subcomponent dispatch chain: `<MainSearch>` mounts `<MainSearchInput>` (per components/shared/elements/index.ts re-export). MainSearchInput.tsx:50-61 — Enter-key handler dispatches `handleCreateSearch(query)` if `mainSearch=true` (which the Catalog Search.tsx surface does NOT set — `disableSuggestions` only) OR `handleUpdateSearch(query)` (the in-session path). Since Search.tsx mounts `<MainSearch>` WITHOUT `mainSearch=true` (line 80), Enter on the Catalog page's text input dispatches `updateDataEntitiesSearch({searchId: storedSearchId, searchFormData: {query, pageSize:30, filters:{}}})` SYNCHRONOUSLY (MainSearchInput.tsx:42-48). **Critically: typed text is dispatched as-is — no sanitisation, no escape of FTS metacharacters (`!`, `|`, `&`, `(`, `)`, `:`, `*`, `<->`).** Results.tsx then triggers pagination via `fetchDataEntitySearchResults({searchId, page+1, size:30})` for infinite scroll (Results.tsx:71-74)."
  - "Cleanup: NONE in this orchestrator — the component has no explicit unmount cleanup (no `return () => ...` in any useEffect at Search.tsx:37-71). The subcomponent `MainSearchInput` carries a conditional cleanup `if (mainSearch) dispatch(updateSearchQuery(''))` at MainSearchInput.tsx:29-35, but for the Catalog page (mainSearch=false / undefined per Search.tsx:80) that cleanup is gated false."
- invariants:
  - "**Server-side search session model — URL-backed UUID; identical pattern to TermSearch.tsx batch U.** Lines 37-48 + searchRoutes.ts:3-19 + dataEntitySearch.slice.ts:22-36. The decision: persist the search session (query + myObjects + facetState + result pageInfo) on the SERVER as a `search_facets` row keyed by UUID, surfaced as the URL path segment `/search/{searchId}`. Deep-link sharing of a filtered Catalog view works — the recipient lands on the same session UUID and the facet state restores. Sister TermSearch.tsx (Dictionary tab, `/termsearch/*`) uses the IDENTICAL pattern."
  - "**Permission-gating at the DEG-Create CTA only; the LIST + search input + filter sidebar are NOT gated.** Lines 81-85 + Results.tsx:125-138. `WithPermissionsProvider allowedPermissions={[Permission.DATA_ENTITY_GROUP_CREATE]}` wraps `<Results/>` (line 84); inside Results `WithPermissions permissionTo={Permission.DATA_ENTITY_GROUP_CREATE}` (Results.tsx:125) wraps ONLY the conditional 'Add group' button (Results.tsx:126-137) which itself is only rendered when `showDEGBtn` is true (i.e. the current search-class tab is `ENTITY_GROUP`). The `<MainSearch>` (line 80), `<Filters/>` (line 77), and the `<Results/>` result-list mapping (Results.tsx:151-159) are RENDERED UNCONDITIONALLY. Every authenticated user reaching `/search/*` sees the full data-entity catalog and can search/filter it. Pattern parity with batch-U TermSearch: 'UI hide for one mutation CTA, no gate for read.'"
  - "**Read-collaborative posture — no per-owner + no per-namespace scoping at this layer.** Search.tsx delegates entirely to `searchService.search` on the backend; per batch-ZE SearchController invariants the service runs `JooqFTSHelper.facetStateConditions` over the catalog with NO per-owner filter (`authIdentityProvider.fetchAssociatedOwner` is called only to compute `myObjectsTotal`, not to scope the main result list — SearchServiceImpl.java:128-130). The UI has a 'My Objects' affordance (rendered by `<SearchResultsTabs/>` per Results.tsx — surfacing the `myObjectsTotal` count as a tab; toggling it sends `myObjects: true` on the next session-create), but BY DEFAULT every authenticated user sees every data entity across every owner / namespace. The Filters sidebar has Owner + Namespace facets (per docs WebFetched 2026-05-20) — these are CLIENT-SELECTED filters, not implicit identity-based scoping."
  - "**No URL-backing for the free-text `query` field beyond the session UUID.** The text-query lives in `state.dataEntitySearch.query` per slice.ts:22-36 — restored from server on session create/restore, but typing a new query in `<MainSearchInput>` only dispatches `updateDataEntitiesSearch` (which mutates the server-side session) — the URL stays at `/search/{searchId}`. Deep-linked URL restores the SESSION's last-saved query and facets, but typed-but-not-submitted intermediate text is lost on page refresh."
  - "**Pagination contract — `pageSize=30` hardcoded in TWO places, identical to TermSearch batch U.** Search.tsx:39 sets the initial `pageSize: 30` at session create; Results.tsx:45 sets `const size = 30` for infinite-scroll page increments. Both are build-time constants — no operator-tunable config. The session-server respects whatever the client sends, so the two literals must stay aligned manually."
  - "**Empty-state surface lives in the Results child.** Results.tsx:161-165 renders `<EmptyContentPlaceholder ... text={t('No matches found')}/>` when `!searchResults.length` — NOT in this orchestrator. The empty-state copy is 'No matches found' (NOT 'No data entities exist yet' — so a fresh deployment with zero data entities shows the same string as a filter that returns nothing — pattern parity with batch-U TermSearch finding bugs[8])."
  - "**Search results come from a SEPARATE endpoint, not this controller call.** Search.tsx fires `POST /api/search` → returns ONLY `SearchFacetsData` (counts + searchId). The actual rows arrive via `Results.tsx` infinite-scroll: `fetchDataEntitySearchResults({searchId, page, size:30})` → `GET /api/search/{searchId}/results` → returns `{items: DataEntity[], pageInfo}` per dataentitiesSearch.thunks.ts:52-67. This is the asymmetry batch-ZE SearchController.search documented: 'The search does not return result rows — it returns counts + a searchId UUID; the UI then calls the sibling GET /api/search/{search_id}/results.'"
- audiences:
  - "odd-platform-ui-end-user — Catalog page is the principal entry point for ANY user discovering data; reaching this route requires (a) an authenticated session under LOGIN_FORM/OAUTH2/LDAP, or (b) `auth.type=DISABLED` dev-only mode per pillar P-09"
  - "data-engineer-analyst — the primary user persona for the Catalog page per system-mission.md P-01 audience set"
  - "data-quality-engineer — uses search to find quality-test entities by tag/datasource"
  - "data-scientist-ml-engineer — uses search to find ML experiment + ML model DEG entities"
  - "viz-bi-engineer — searches for dataset entities to source BI dashboards"
  - "platform-operator — uses Catalog page during onboarding to validate the catalog state; uses 'Add group' to bootstrap initial DEG structure"

## dependencies_semantic

- requires-feature:
  - "F-001 / P-01:F-002 Search and Filtering (Data Discovery pillar Catalog page) — this UI is the OPERATOR ENTRY POINT for the catalog search half of P-01. Batch-ZE sidecars (SearchController class + search method) cover the backend half; this UI sidecar adds the FRONT-END HALF — the operator clicks here to enter a query, click facets, and browse results."
  - "P-01:F-001 Popular Entities Ranking (cross-link via F-001) — Search and Popular are the two main Catalog-page entry surfaces. Search is the free-text + faceted entrypoint; Popular is the `view_count DESC` ranked strip on the Overview page. Both surface the same underlying data-entity catalog."
  - "P-09 Authorization framework — `Permission.DATA_ENTITY_GROUP_CREATE` (line 18 + line 82) is one of the `DATA_ENTITY_GROUP_*` RBAC permissions. Permission resolution happens at the controller perimeter via `SecurityConstants.SECURITY_RULES` matchers — verified absent for `/api/search*` paths per batch-ZE invariants."
  - "Layout pillar (PageWithLeftSidebar) — the shared left-sidebar layout primitive consumed at lines 74-87; sibling consumer is TermSearch.tsx (Data Glossary pillar)."
- requires-config:
  - "(none operator-controllable at this component) — `pageSize: 30` (line 39 + Results.tsx:45) hardcoded; `1500 ms` debounce (line 61) hardcoded; the layout's xs split (3/9) hardcoded (lines 76, 79). No `application.yml` / env-var or feature-flag controls UI behaviour of this component. Per the substrate's UI sidecar conventions, this is N/A for `requires-config` rather than a finding."
- requires-runtime:
  - "React 18+ — `React.useEffect` (lines 37, 44, 67), `React.useCallback` (line 50). The standard hook set."
  - "Redux Toolkit — `useAppDispatch` + `useAppSelector` (`redux/lib/hooks`); the `dataEntitiesSearchSlice` (slice.ts:105-260) owns the session-merge + facet-state reconciliation logic"
  - "`react-router-dom` — `useNavigate` (via useCreateSearch.ts:2); `useSearchRouteParams` (line 20 + searchRoutes.ts:18-19); the route mount lives at App.tsx:61 (`<Route path={\\`${searchPath()}/*\\`} element={<Search/>}/>`)"
  - "`use-debounce` — `useDebouncedCallback` (line 2; used at lines 51-63) — 1500 ms leading-edge"
  - "`lodash/mapValues` + `lodash/values` — used to transform `searchFacetParams` from a `{facetName: {optionId: SearchFilterStateSynced}}` map into `{facetName: SearchFilterStateSynced[]}` arrays for the wire payload (lines 3-4, 56)"
  - "`generated-sources` — `Permission` enum (line 18)"
  - "`components/shared/contexts` — `WithPermissionsProvider` (line 19)"
  - "`components/shared/elements` — `MainSearch`, `PageWithLeftSidebar` (line 6); `MainSearch` re-exports `MainSearchInput` per components/shared/elements/index.ts:3"
  - "Redux selectors (`redux/selectors`) — `getSearchCreatingStatuses`, `getSearchFacetsData`, `getSearchFacetsSynced`, `getSearchId`, `getSearchMyObjects`, `getSearchQuery` (lines 9-16; selectors verified in dataentitySearch.selectors.ts:32-133)"
  - "Redux thunks (`redux/thunks`) — `getDataEntitiesSearch`, `updateDataEntitiesSearch` (line 8)"
  - "Local hook — `useCreateSearch` from lib/hooks (line 7) — wraps `createDataEntitiesSearch` dispatch + `navigate(searchPath(searchId))` chain per useCreateSearch.ts:8-23"
- couples-to:
  - "`Filters` (Filters.tsx:1-77) — child component; receives no props; reads/writes `state.dataEntitySearch.facetState` directly via Redux; mounts 7 facets (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses — per Filters.tsx:46-65 verified)"
  - "`MainSearch` → `MainSearchInput` (MainSearchInput.tsx:1-83) — grandchild via MainSearch; owns local `searchText` state in `SearchSuggestionsAutocomplete` + dispatches `updateDataEntitiesSearch` synchronously on Enter / search-click — text-query does NOT route through this orchestrator's 1500ms debouncer; the orchestrator only debounces FACET changes."
  - "`Results` (Results.tsx:1-178) — child component; receives no props; owns the InfiniteScroll wrapper + per-row ResultItem rendering + SearchResultsTabs + EmptyContentPlaceholder + the DEG-Create button; dispatches `fetchDataEntitySearchResults({searchId, page+1, size:30})` for pagination (Results.tsx:73)"
  - "`useCreateSearch` hook (useCreateSearch.ts:1-23) — wraps `createDataEntitiesSearch` thunk + `navigate(searchPath(searchId))` chain. Hook is shared with `MainSearchInput.tsx` (handleCreateSearch path) — the SAME wrapper used in two distinct UI contexts."
  - "`createDataEntitiesSearch` / `getDataEntitiesSearch` / `updateDataEntitiesSearch` thunks (dataentitiesSearch.thunks.ts:25-50) — three of the seven thunks in this module"
  - "Server-side: POST `/api/search` → `SearchController.search` (batch-ZE sidecar) → `SearchServiceImpl.search`; GET `/api/search/{searchId}` → `SearchController.getSearchFacetList` → `SearchServiceImpl.getFacetsData`; PUT `/api/search/{searchId}` → `SearchController.updateSearchFacets` → `SearchServiceImpl.updateFacets`; GET `/api/search/{searchId}/results?page=&size=` → `SearchController.getSearchResults` (called by Results child)"

## upstream_callers

- entry_point: "ui_route:/search/*"
  caller_node: "ts app-route:App.tsx-line-61"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:34 (lazy import) + App.tsx:61 (`<Route path={\\`${searchPath()}/*\\`} element={<Search/>}/>`). Lazy-loaded React.FC. Single rendering entry — no props (default-export `React.FC`). All state comes from Redux + route params via useSearchRouteParams() (Search.tsx:27)."
  observation_class: ui-call

- entry_point: "ui_button:top-nav-Catalog-tab"
  caller_node: "ts react-component:ToolbarTabs.tsx-line-38"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:38 + 93 (per batch-ZH sidecar) — top-nav 'Catalog' tab Link points to `searchPath()` (no UUID), so clicking it from any page lands on `/search` with NO `:searchId` param; Search.tsx:37-42 then fires createSearch (because `routerSearchId` is undefined). Net behaviour: clicking the 'Catalog' top-nav tab DROPS the user's prior session and creates a fresh one — the prior session UUID is orphaned server-side until housekeeping reaps it."
  observation_class: ui-call

- entry_point: "ui_button:global-MainSearch-top-nav (mainSearch=true)"
  caller_node: "ts react-component:MainSearchInput.tsx-line-37 (handleCreateSearch path)"
  multiplicity_per_trigger: 1
  evidence: "Global `<MainSearchInput mainSearch={true}/>` (rendered elsewhere on the platform — top-nav search bar) calls `useCreateSearch().createSearch({query, pageSize:30, filters:{}})` then navigates to `/search/{newSearchId}` via useCreateSearch.ts:14-19. The global mainSearch=true path creates a new session from anywhere on the platform; the Catalog page (Search.tsx) mounts the resulting `/search/{uuid}` route — bringing the user TO the Catalog as the result page."
  observation_class: ui-call

- entry_point: "ui_route:/search/{uuid}-deep-link"
  caller_node: "external (Slack share, bookmark, email link)"
  multiplicity_per_trigger: 1
  evidence: "User pastes/clicks a `/search/{uuid}` link from Slack / bookmark / email. Search.tsx:44-48 fires getDataEntitiesSearch to restore the session. After 30-day housekeeping eviction (F-010 + LSN-018), the GET returns 404 and the page is permanently broken with no recovery (see bugs section [7])."
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: db-write
  description: "Creates a new `search_facets` row on first mount with empty query + empty filters (POST /api/search). Server-side `SearchControllerCreate` allocates a UUID via `gen_random_uuid()` and persists `{id, query_string:'', filters:'{}', last_accessed_at:now()}` — no `owner_id` / `created_by` column (REFACTOR-344)."
  evidence: "Search.tsx:37-42 + useCreateSearch.ts:14-19 + dataentitiesSearch.thunks.ts:25-32 + batch-ZE SearchController.search invariants[3]"
  cardinality_per_call: "1 per Catalog-page mount where no `:searchId` URL param is present"
  reachable_from_entry_points:
    - "ui_route:/search/*"
    - "ui_button:top-nav-Catalog-tab"

- side_effect_class: db-write
  description: "Updates the `search_facets` row's `query_string` / `filters` JSONB on every facet click or text-query submit (PUT /api/search/{searchId}). Server-side merges via `SearchServiceImpl.updateFacets` + recomputes the aggregate counts."
  evidence: "Search.tsx:50-71 (debounced facet path) + MainSearchInput.tsx:42-48 (synchronous text-query path) + dataentitiesSearch.thunks.ts:34-41"
  cardinality_per_call: "N per N facet clicks within debounce window (BROKEN — see bugs section [3]; intended: 1 per 1500ms; actual: 1 per click due to debouncer-recreation bug)"
  reachable_from_entry_points:
    - "ui_route:/search/*"
    - "ui_route:/search/{uuid}-deep-link"

- side_effect_class: db-read
  description: "Re-reads the persisted `search_facets` row + recomputes aggregate counts on deep-link / reload (GET /api/search/{searchId}). Per batch-ZE the server returns the same `SearchFacetsData` shape used by create."
  evidence: "Search.tsx:44-48 + dataentitiesSearch.thunks.ts:43-50"
  cardinality_per_call: "1 per deep-link / reload arrival when no cached searchId exists"
  reachable_from_entry_points:
    - "ui_route:/search/{uuid}-deep-link"

- side_effect_class: redirect-issue
  description: "After successful POST /api/search session-create, the chain calls `navigate(searchPath(searchId))` which performs a client-side React-Router push to `/search/{newUuid}`. The URL bar updates without a full page reload."
  evidence: "useCreateSearch.ts:16-18"
  cardinality_per_call: "1 per session-create (i.e. per Catalog mount with no `:searchId` and no cached searchId)"
  reachable_from_entry_points:
    - "ui_route:/search/*"
    - "ui_button:global-MainSearch-top-nav (mainSearch=true)"

- side_effect_class: page-render
  description: "Renders the three-child Catalog shell: <Filters/> (left sidebar, 7 facets) + <MainSearch/> (text input) + <Results/> (infinite-scroll list + tabs + conditional DEG-create CTA). The DOM exposes the user's `DATA_ENTITY_GROUP_CREATE` permission (via the conditional 'Add group' button visibility — see security.data_exposure)."
  evidence: "Search.tsx:73-89 (the JSX layout)"
  cardinality_per_call: "1 per React render (typically once per mount + N re-renders per state change)"
  reachable_from_entry_points:
    - "ui_route:/search/*"
    - "ui_route:/search/{uuid}-deep-link"
    - "ui_button:top-nav-Catalog-tab"
    - "ui_button:global-MainSearch-top-nav (mainSearch=true)"

- side_effect_class: external-call
  description: "REFERENCE — pagination dispatches GET /api/search/{searchId}/results?page=&size=30 (Results.tsx:71-74 — out of this orchestrator's direct scope, but observable via the same session UUID). See batch-ZA SearchResults sidecar for the per-row side effects."
  evidence: "Results.tsx:71-74 + dataentitiesSearch.thunks.ts:52-67"
  cardinality_per_call: "1 per infinite-scroll page (initial page + N per scroll-extend)"
  reachable_from_entry_points:
    - "ui_route:/search/*"
    - "ui_route:/search/{uuid}-deep-link"
  unresolved: true   # downstream sidecar (ZA SearchResults) holds the full chain; this reference acknowledges the side effect originates here via the Results child

## implicit_adrs

- "**Server-side search session model with URL-backed UUID — the canonical/older pattern (TermSearch.tsx batch U clones it).** Lines 37-48 + searchRoutes.ts:3-19 + slice.ts:22-36. The decision is: persist the search session (query + myObjects + facetState + result page info) on the SERVER, identified by UUID, surfaced as the URL path segment. This is a deliberate architectural choice — the alternative (purely client-side Redux state) was rejected in favour of (a) deep-link share-ability, (b) reload-survives behaviour, (c) explicit server-side session lifecycle for cleanup (per F-010 SearchFacetsHousekeepingJob — search_facets TTL eviction 30 days default; batch-K LSN-018 case-law). Search.tsx is the CANONICAL instance; TermSearch.tsx batch-U is the term-catalog clone (verified by Grep `PageWithLeftSidebar.MainContainer` returning both files; useEffect dep-array shape identical; debouncer wiring identical). The decision is load-bearing: removing the URL backing would break deep-link sharing of filtered Catalog views; removing the server-side session would lose the search_facets TTL eviction infrastructure." — evidence: Search.tsx:37-48 (create + navigate via useCreateSearch) + 44-48 (restore from URL) + searchRoutes.ts:3, 4 (SEARCH_ID_PARAM) + useCreateSearch.ts:16-18 (the navigate is the load-bearing side-effect) + App.tsx:61 (route mount with wildcard child) + slice.ts:22-36 (initialState shape) — intent_anchor: useCreateSearch.ts:16-18 explicitly chains `.then(({searchId}) => navigate(searchPath(searchId)))` — the navigation IS the load-bearing side-effect of session create — confidence: HIGH

- "**Permission-gated DEG-Create CTA via WithPermissions (UI hide, NOT auth enforcement) — pattern parity with TermSearch batch-U + PolicyList batch-Q.** Lines 81-85 + Results.tsx:125-138. The decision is: render-nothing rather than render-disabled when permission absent. WithPermissions returns `null` when `hasAccessTo(permissionTo)` is false. Authorization is fundamentally enforced at the backend `SecurityConstants.SECURITY_RULES` layer; the UI gate is presentation-only. The `WithPermissionsProvider` wrapper at Search.tsx:81-85 INJECTS the permission context but does NOT gate route rendering — `<Results/>` mounts unconditionally; only the conditionally-rendered 'Add group' button (Results.tsx:125-138) is permission-gated AND class-tab-gated (`showDEGBtn`). **Note: this Catalog page surfaces ONE mutation CTA — Add group — whereas batch-ZE SearchController itself runs UNDER NO @PreAuthorize at all** (controller-class sidecar invariants[1]: 'no controller-side validation beyond @Valid'). The read surface is wide open to authenticated users." — evidence: Search.tsx:81-85 + Results.tsx:125-138 + batch-ZE SearchController class sidecar — intent_anchor: the `WithPermissionsProvider` API surface allows `Component | render | children` and ALWAYS renders the wrapped element — the gate is at the inner `WithPermissions` call site — confidence: HIGH

- "**1500ms leading-edge debouncer for facet-state mutations (text-query EXCLUDED — IDENTICAL pattern to TermSearch batch-U).** Lines 50-63 + MainSearchInput.tsx:42-48. The decision encodes 'facet clicks coalesce; text queries fire immediately'. Leading-edge means the FIRST click in a 1500ms window fires immediately — important for perceived UI snappiness. Text queries bypass this entirely (MainSearchInput dispatches synchronously on Enter / search-click) — the explicit-intent action does not wait for a debounce window. The pattern is structurally identical to TermSearch batch-U implicit_adrs[2]." — evidence: Search.tsx:50-63 (debouncer) + 62 (`{leading: true}`) + MainSearchInput.tsx:50-61 (synchronous dispatch on Enter / `searchAdornmentHandler`) — intent_anchor: the `{leading: true}` option in `useDebouncedCallback(..., 1500, { leading: true })` is explicit about the timing model — confidence: HIGH

- "**Read-collaborative posture — every authenticated user searches the entire catalog; the 'My Objects' affordance is OPT-IN not OPT-OUT.** Search.tsx delegates to `searchService.search` per batch-ZE sidecar invariants. The SearchServiceImpl runs `JooqFTSHelper.facetStateConditions` over the full catalog with NO per-owner filter on the main result list (the `authIdentityProvider.fetchAssociatedOwner` call inside `getFacetsData` only computes `myObjectsTotalCount`). The Catalog page's tab strip surfaces a 'My Objects' count — when the user toggles to that tab the next session-create sends `myObjects: true` which DOES scope the result list to the authenticated user's owners. **But the default tab is 'All', meaning by default every search returns the unscoped catalog.** This is the visible UI counterpart of the system-mission.md line 267 'read-collaborative posture' that informs Pillar P-09." — evidence: Search.tsx:74-87 (no permission/owner wrap on Results) + Results.tsx:151-159 (the .map renders every server-returned entity) + batch-ZE SearchController invariants + SearchServiceImpl.java:128-130 (the only authIdentityProvider call is for myObjectsTotal, not result-list scoping) + system-mission.md line 267 — intent_anchor: the lack of any per-owner filter on the main result query path; the explicit affordance for 'My Objects' as a toggle rather than a default — confidence: HIGH

- "**`pageSize: 30` hardcoded in TWO places — orchestrator + results child — by deliberate parity, not a constant.** Line 39 (session-create initial pageSize) + Results.tsx:45 (infinite-scroll page increment). Both are literal `30`, not an imported constant. Same maintenance burden as TermSearch batch-U implicit_adrs[4]: future refactor changing one without the other ships pagination-misalignment regressions." — evidence: Search.tsx:39 + Results.tsx:45 — intent_anchor: both literals are `30`; no central constants module is imported — confidence: MEDIUM (the value is hardcoded; no comment explains the choice; risk that future refactor changes one without the other)

- "**MainSearch wrapper is used in TWO modes: `mainSearch=true` (global top-nav — creates new session) and `mainSearch=false/undefined` (in-session — updates existing). Search.tsx uses the latter.** Line 80 (`<MainSearch placeholder={t('Search')} disableSuggestions/>`) — note the absence of `mainSearch` prop. MainSearchInput.tsx:50-61 reads `mainSearch` to switch behaviour: `mainSearch=true` triggers a new session via `useCreateSearch` (handleCreateSearch); `mainSearch=false/undefined` updates the current session via `updateDataEntitiesSearch` (handleUpdateSearch). The decision: the Catalog page is **always in-session** — the surrounding Search.tsx orchestrator has already created the session on mount, so the text input only updates it. The global top-nav search bar (elsewhere in the SPA) opens a new session and then navigates to `/search/{newId}` where this Catalog page picks up." — evidence: Search.tsx:80 + MainSearchInput.tsx:17-21 (prop declaration) + 50-61 (the conditional dispatch) — intent_anchor: the conditional `if (mainSearch) { handleCreateSearch(query); return; } handleUpdateSearch(query)` in MainSearchInput.tsx:53-58 IS the decision — confidence: HIGH

## bugs_limitations_corner_cases

- "**LSN-017-adjacent dep-array smell #1 — incomplete deps on createSearch effect.** Lines 37-42: `useEffect(() => { if (!routerSearchId && !isSearchCreating && !searchId) createSearch({query:'',pageSize:30,filters:{}}); }, [routerSearchId, isSearchCreating]);`. The guard reads THREE state values (`routerSearchId`, `isSearchCreating`, `searchId`) but the deps array contains only TWO of them — `searchId` is MISSING. The effect re-fires when `routerSearchId` or `isSearchCreating` changes — but not when Redux's `searchId` becomes set. **The composition is correct *by accident*:** on session-create-success, the thunk fulfilment writes `searchId` to Redux AND `useCreateSearch.ts:18` calls `navigate(searchPath(searchId))` which updates `routerSearchId` — both transitions happen in the same render-batch, so the re-fire's guard correctly evaluates as `(false && ... && false) === false` and skips. **But the dep-array does not document this invariant** — a refactor changing the navigate-vs-redux ordering would surface a real double-create. **This is the IDENTICAL shape to TermSearch batch-U bugs[0] LSN-017-adjacent smell** — the defect is latent in both files, masked by React batch ordering. Same class as LSN-017 view_count case (deps and conditions out of sync); different code instance." — evidence: Search.tsx:37-42 + useCreateSearch.ts:13-19 (the createDataEntitiesSearch dispatch + navigate chain) + slice.ts:215 (updateSearchState writes searchId in the fulfilled reducer, in the same React-batch as navigate's dispatch) — severity: MEDIUM (latent regression vector; class-match to LSN-017 view_count doubling)

- "**LSN-017-adjacent dep-array smell #2 — same pattern as TermSearch batch-U bugs[0] on the restore-from-URL effect.** Lines 44-48: `useEffect(() => { if (!searchId && routerSearchId) dispatch(getDataEntitiesSearch({searchId: routerSearchId})); }, [searchId, routerSearchId]);`. Here the deps array DOES include both values the guard reads — this effect is CORRECT (unlike #1). The contrast with #1 is instructive: when a hand-written effect's deps array matches its read-set, the LSN-017 class disappears. The deps-list-vs-guard divergence in effect #1 IS the structural cause of the class." — evidence: Search.tsx:44-48 (correct effect — contrast against 37-42 which is wrong) — severity: N/A (this entry documents the CORRECT counter-example; including it for cross-batch concept clarity) — confidence: HIGH

- "**LSN-017-adjacent dep-array smell #3 — `searchFacetsSynced` read in condition but MISSING from deps (ACTIVE re-fire vector — IDENTICAL to TermSearch batch-U bugs[1]).** Lines 67-71: `useEffect(() => { if (!searchFacetsSynced) updateSearchFacets(); }, [searchFacetParams]);`. The guard reads `searchFacetsSynced` but the deps array contains ONLY `searchFacetParams`. The effect re-fires when `searchFacetParams` changes — typically on a facet click that flips `syncedState: false` on the affected facet option. The slice's `updateSearchState` reducer (slice.ts:97) sets `isFacetsStateSynced: true` on EVERY successful create/update/get fulfilment — but THIS effect does NOT re-fire when `searchFacetsSynced` transitions back to `true`. The selector `getSearchFacetsData` (per redux/selectors/dataentitySearch.selectors.ts:129-133) may also produce fresh object references on every selector run (via `mapValues(searchFacetParams, values)` in the dispatch payload at line 56), driving the effect to re-fire on every render during the in-flight PUT window. **Possible doubling shape per LSN-017 — class-match.** Probe P-189 emitted to pin dispatch cardinality per facet-click batch." — evidence: Search.tsx:67-71 + slice.ts:97 (`isFacetsStateSynced: true` set on every fulfilment) + 56 (mapValues produces a new object reference each dispatch) — severity: HIGH (active dep-array bug class; LSN-017 forcing-question applies; probe P-189 will confirm)

- "**Debouncer is RECREATED on every facet-state change — losing the rate-limit semantics. IDENTICAL bug to TermSearch batch-U bugs[2].** Lines 50-65: `useCallback(useDebouncedCallback(..., 1500, {leading: true}), [searchId, searchFacetParams])`. The `useCallback` deps include `searchFacetParams` — which changes on every facet click. Each click constructs a NEW `useDebouncedCallback(...)` instance — the prior debouncer's pending timer is unreachable. With `{leading: true}`, the new debouncer fires on its FIRST call (immediately) AND would defer a trailing call until 1500ms — but the trailing call NEVER fires because the next click constructs yet another debouncer. **Effective behaviour: every facet click dispatches `updateDataEntitiesSearch` immediately; the 1500ms 'debounce' is not actually rate-limiting anything.** A user rapidly clicking 5 facets in 2 seconds dispatches 5 PUT calls instead of the intended 1. **The pattern is structurally identical to TermSearch batch-U finding** — both files were written by the same author/period and the bug propagated through clone. Probe P-189 emitted to measure the dispatch count under rapid clicking." — evidence: Search.tsx:50-65 + the `useCallback` deps at line 64 — severity: MEDIUM (functional bug — debounce intent unfulfilled; performance cost; not a correctness bug because the slice's `assignFacetStateWithNewFacets` at slice.ts:73-86 handles racing PUTs)

- "**No `.catch` on the create-session promise chain — unhandled rejection on session-create failure. IDENTICAL pattern to TermSearch batch-U bugs[3].** useCreateSearch.ts:14-19: `dispatch(createDataEntitiesSearch({searchFormData})).unwrap().then(({searchId}) => { ... navigate(searchLink); })`. No `.catch(...)` follows the `.then`. `.unwrap()` re-throws on rejection. If `createDataEntitiesSearch` rejects (server-side 500, network failure, auth expiry mid-flight), the rejection lands in the React error boundary (if any wraps the Route — verified by reading App.tsx around line 61: no `<ErrorBoundary>` wraps the Route element) or the browser console. **Net: the user sees a frozen empty page with no error message; the URL stays at `/search`; refreshing repeats the same path.** The slice's missing `.rejected` reducer (slice.ts:214-260 verified — only `.fulfilled` cases) compounds this — neither the slice nor the UI surfaces the failure. Pattern parity with TermSearch batch-U." — evidence: useCreateSearch.ts:14-19 (missing catch) + slice.ts:214-260 (no `.rejected` cases) + App.tsx:60-65 (no error-boundary wrap on Route) — severity: MEDIUM (operator-misleading silent failure mode; auth-token-expired mid-session reproduces this)

- "**Race: in-flight `updateDataEntitiesSearch` for facets vs synchronous `updateDataEntitiesSearch` for text-query.** IDENTICAL race shape to TermSearch batch-U bugs[4]. When the user (a) clicks a facet (debounced — fires immediately due to leading-edge AND the per-click-recreate bug above), then (b) types a query and hits Enter within the PUT round-trip window. Both calls hit `PUT /api/search/{searchId}` with DIFFERENT `SearchFormData` payloads — facet payload includes `filters: mapValues(searchFacetParams, values)` + the prior query + myObjects flag; text-query payload includes `filters: {}` + the new query (MainSearchInput.tsx:44 sends empty filters). Whichever resolves SECOND wins via `updateSearchState`. **The facet click's filter selections may be DISCARDED if the text-query resolves second** — the user clicked a facet, hit Enter on the search, and the search overwrote the facet selection." — evidence: Search.tsx:53-58 (facet dispatch with prior filters) + MainSearchInput.tsx:42-48 (text dispatch with `filters: {}`) + slice.ts:40-103 (updateSearchState replaces or merges based on searchId equality) — severity: LOW (rare in practice; user-perceptible as "I selected a facet, my filter disappeared")

- "**Session-expiry: stale URL UUID with no recovery path. IDENTICAL to TermSearch batch-U bugs[5].** Lines 44-48: if a user reloads / deep-links to `/search/{stale-uuid}` after the server-side `SearchFacetsHousekeepingJob` evicted the session (default `housekeeping.ttl.search_facets_days: 30` per F-010 batch-K + LSN-018 case-law), the GET returns 404 / empty. The slice's missing `.rejected` reducer means the state stays empty; the URL still carries the stale UUID; refreshing repeats. **No automatic fall-back to create a fresh session.** An operator hitting a stale Slack-shared link from 30+ days ago sees a permanently broken page until they manually navigate back to `/search` (without the UUID)." — evidence: Search.tsx:44-48 + F-010.yaml (SearchFacetsHousekeepingJob 30-day TTL on `search_facets`) + slice.ts:214-260 (no rejection handling) — severity: MEDIUM (a 30-day-old bookmark from a Slack message is functionally broken with no UX recovery)

- "**FTS-injection: typed search-query text passes UNESCAPED through to `to_tsquery(?)` — REFACTOR-229 user-controlled query text — NO client-side sanitisation here.** MainSearchInput.tsx:43-44 builds `searchFormData = {query, pageSize:30, filters:{}}` and dispatches verbatim. Server-side `JooqFTSHelper.tsQuery` at `JooqFTSHelper.java:164-168` performs `plainQuery.split(' ').map(q -> q + ':*').join('&')` — NO escaping of tsquery metacharacters (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\\`). A typed query of `foo ) | (bar` reaches `to_tsquery(?)` and Postgres raises `42601 syntax error in tsquery`. The session UUID is then **permanently poisoned**: every subsequent facet read (`GET /api/search/{poisoned_uuid}/facet/{any}`) 500s per batch-ZE strengthening. **The UI offers ZERO mitigation** — no max-length, no metacharacter filter, no client-side `to_tsquery` validation. Search.tsx accepts arbitrary text from MainSearchInput and submits it as-is. **For the `highlightDataEntity` path the same untrusted text is INTERPOLATED into a raw SQL string via `.formatted(text, tsQuery)` — TRUE SQL injection per batch-ZE TRUE-SQL-injection finding at ReactiveDataEntityRepositoryImpl.java:798-806.** Probe P-188 emitted to confirm the session-poisoning end-to-end." — evidence: Search.tsx:80 (MainSearch mount, no validation prop) + MainSearchInput.tsx:42-48 (synchronous dispatch with raw query) + REFACTOR-229.md (the canonical FTS-injection finding) + batch-ZE SearchController.search bugs[7] (TRUE SQL injection at highlightDataEntity) + JooqFTSHelper.java:164-168 — severity: HIGH (security/availability hazard — DoS-by-poisoned-session is operator-reachable; TRUE SQL injection at highlightDataEntity path is exploitable; combined with REFACTOR-344 search_facets has no user binding meaning poisoned UUIDs can be shared as bearer-token-shaped denial-of-service vectors)

- "**Cross-owner result set: read-collaborative posture inherited from backend, no UI affordance to scope to 'my data'.** Lines 74-87 + Results.tsx:151-159. The result list renders every data entity returned by the server. The only owner-scoping affordance is the 'My Objects' tab in `<SearchResultsTabs/>` (out of scope for this orchestrator; rendered by Results.tsx via `searchTotals.myObjectsTotal`). **By default the tab is 'All' which sends `myObjects: false` on session-create, returning the full catalog.** A user reading a description on team-A's `customers_pii` table can find it via search regardless of whether they have any owner relationship to team-A. This is the visible UI surface of the platform-wide read-collaborative posture (REFACTOR-024 family — system-mission.md line 267); not a bug per se, but operator-misleading if the operator expects per-team isolation." — evidence: Search.tsx:74-87 (no permission wrap on Results' result-list mapping) + Results.tsx:151-159 (unconditional .map) + batch-ZE SearchController invariants + system-mission.md line 267 — severity: MEDIUM (cross_owner_data_exposure family; not a per-component bug but a per-component manifestation of a pillar-wide architectural stance)

- "**Pagination total-vs-list divergence inherited from REFACTOR-425 family.** `Results.tsx:71-74` paginates via `fetchDataEntitySearchResults({searchId, page+1, size:30})`; thunks.ts:62-63 computes `hasNext: page * size < pageInfo.total`. The `total` field comes from `SearchFacetsData.total` (the COUNT aggregator on backend). **The backend hard-codes `hasNext: true` in the Page<> wrapper (Page.java:11-15 per batch-ZE controller-class invariants[7]); the UI compensates by computing hasNext client-side.** This means third-party API consumers reading the OpenAPI contract directly will loop forever; only the UI client gets correct termination behaviour. **If the count predicate diverges from the list predicate (REFACTOR-425 page-vs-count pattern), pagination can either terminate early (count < actual rows — user never reaches the missing pages) or run past the actual count (count > actual rows — `hasNext` stays true but server returns empty results, causing infinite-scroll loop).** The exclude_from_search flag IS a known divergence vector for data-entity counts (per concepts/detail/invariants/data-entity-page-vs-count-predicate-divergence-exclude-from-search.yaml). The UI does NOT defensive-check; it trusts server `total`." — evidence: Search.tsx:79-86 + Results.tsx:71-74 + thunks.ts:52-67 + REFACTOR-425.md (the canonical page-vs-count family) + batch-ZE SearchController class invariants[7] + Page.java:11-15 — severity: MEDIUM (UI is shielded by its client-side hasNext compute, but the OpenAPI-contract consumer is exposed; the count-vs-list divergence is real)

- "**Empty-state copy is 'No matches found' — does not distinguish 'fresh deployment, zero data entities' from 'filter returned nothing'. IDENTICAL pattern to TermSearch batch-U bugs[8].** Results.tsx:161-165 renders `<EmptyContentPlaceholder ... text={t('No matches found')}/>` whenever `!searchResults.length`. A fresh deployment with no data entities yet sees 'No matches found' — an operator new to ODD would reasonably expect 'No data entities exist yet — start by ingesting your first data source' or similar onboarding-shaped copy. Pairs with the WebFetched docs which describe Search as a way to find existing entities but do not say what an empty catalog looks like." — evidence: Results.tsx:161-165 + WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search 2026-05-20 status 200 — severity: LOW (onboarding UX gap)

- "**'Suggestions' affordance EXPLICITLY DISABLED on this surface — `disableSuggestions` prop set.** Line 80: `<MainSearch placeholder={t('Search')} disableSuggestions/>`. The Catalog page DOES NOT show search suggestions in the text input dropdown. This is operator-intentional (the Catalog page already shows results below; suggestions would be redundant), but the live doc page (WebFetched 2026-05-20 status 200) makes no mention of either suggestions enabled OR disabled — operators reading the docs cannot know whether suggestions are a feature. The suggestions backend endpoint exists (`GET /api/search/suggestions` per batch-ZE SearchController invariants); it just isn't surfaced on the Catalog page." — evidence: Search.tsx:80 + MainSearchInput.tsx:13 (`disableSuggestions` prop forwarded to SearchSuggestionsAutocomplete) + WebFetch result (no mention of suggestions on the docs page) — severity: LOW (doc-side blind spot)

- "**`<MainSearch placeholder={t('Search')}>` — the placeholder string is the i18n key 'Search' (Search.tsx:80), but t('Search') falls back to literal 'Search' if no translation is registered. The MainSearchInput's internal fallback `mainSearchPlaceholder = t('main search placeholder')` (MainSearchInput.tsx:63) is OVERRIDDEN by the explicit placeholder prop, so the operator sees 'Search' (or its translation) — fine. But the i18n key choice is brittle: any future rename of the i18n key requires updating Search.tsx:80 + every translation file. No central constant.** — evidence: Search.tsx:80 + MainSearchInput.tsx:63, 71 — severity: LOW (maintainability — i18n key brittleness)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "Search.tsx:39"
      name: "pageSize"
      value: "30"
      questions:
        - q: "What at pageSize=0?"
          a: "The session is created with pageSize=0; on the backend SearchFormData.pageSize has no validation per batch-ZE SearchController.search invariants[5]. The downstream effect is borne by Results.tsx infinite-scroll which uses its own hardcoded size=30 (Results.tsx:45) — so pageSize=0 in the session create does NOT affect result pagination (the Results child uses its own constant). The 0 just feeds the initial sessions-create payload which is otherwise ignored for result loading. Effectively a dead tunable for this code path."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45 + batch-ZE SearchController.search invariants[5]"
        - q: "What at pageSize=30 (current)?"
          a: "Aligned with Results.tsx:45 size=30. Initial session-create payload + result-pagination size match — the 'intended' configuration. No drift between session-create and result-fetch."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45"
        - q: "What at pageSize=31 or higher?"
          a: "The session-create payload carries the larger value; Results.tsx ignores it and uses its own 30. Session-state pageSize is functionally dead for result loading. A backend that respected SearchFormData.pageSize for sizing would create a drift between session-create and result-fetch — currently masked because Results.tsx is the authority."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45 + dataentitiesSearch.thunks.ts:59-63 (size pulled from request params, not session)"
        - q: "What does the operator see at each boundary?"
          a: "Operator sees no difference across tunable values — Results.tsx's hardcoded size=30 dominates. The Search.tsx:39 pageSize value is effectively dead — neither configurable nor consequential. A maintainer who attempts to bump this from 30 to 50 will see no change unless they ALSO update Results.tsx:45."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45"

    - location: "Search.tsx:61"
      name: "debounce window"
      value: "1500 (ms)"
      questions:
        - q: "What at debounce=0?"
          a: "Every facet click dispatches immediately; the leading-edge mode collapses to no-debounce. Operator sees N PUTs per N clicks — same as the CURRENT BROKEN BEHAVIOUR (bugs section [3]). The architectural intent (rate-limit facet clicks) is unrealised."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:50-65 + bugs section [3]"
        - q: "What at debounce=1500 (current)?"
          a: "With the debouncer-recreation bug (Search.tsx:64 useCallback deps include searchFacetParams), the 1500ms window is in effect only for the FIRST click of a session — every subsequent click recreates the debouncer and bypasses it. Net: 1500ms is the intended-but-not-realised configuration."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:50-65 (the useCallback deps line 64) + bugs section [3]"
        - q: "What at debounce=10000?"
          a: "If the bug were fixed, a 10s window would coalesce 10s of rapid facet clicks into a single PUT — feels sluggish to operators. With the bug intact, 10s vs 1500ms makes no difference because the debouncer is recreated on every click."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:50-65"
        - q: "What does the operator see at each boundary?"
          a: "Today (bug present): N PUTs per N clicks; the 1500ms is non-functional. After bug fix: N clicks → 1 PUT (leading-edge); operator sees an immediate update on first click, then the rest of the rapid clicks coalesce into a single trailing PUT after the window. Probe P-189 will confirm the broken-debouncer behaviour."
          confidence: PROBE-NEEDED
          evidence: "P-189"

    - location: "Search.tsx:39 + 56 + Results.tsx:45"
      name: "filters/query/myObjects payload shape"
      value: "empty {}, '', undefined respectively"
      questions:
        - q: "What at empty query + empty filters (current default)?"
          a: "Session creates with empty payload; server returns the full catalog (all entities, no FTS predicate, no facet predicates). The 'All' tab shows the full catalog count. Operator sees the entire data-entity catalog on first Catalog-page mount — the read-collaborative posture made literal."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + batch-ZE SearchController.search behaviour"
        - q: "What at query with tsquery metacharacters?"
          a: "Per bugs section [8] + Category F findings below: the session is POISONED. POST /api/search may itself 500 (if SearchFormData validation fails at the controller — it doesn't; @Valid lets the query through), or the POST succeeds and subsequent reads on the session UUID 500. The UI offers no mitigation; the URL still carries the poisoned UUID; refresh repeats the failure. Probe P-188 will confirm end-to-end."
          confidence: PROBE-NEEDED
          evidence: "P-188 + JooqFTSHelper.java:164-168 + bugs section [8]"

  name_behavior_pairs:
    - name: "createSearch (useCreateSearch hook)"
      promise: "Create a new search session; navigate to the URL form that carries the session UUID."
      implementation: "Dispatches createDataEntitiesSearch thunk → searchApi.search → POST /api/search returning SearchFacetsData → chains .then(({searchId}) => navigate(searchPath(searchId))). No .catch; rejection is unhandled."
      drift: NONE
      operator_visible_consequence: "Name and implementation align — but no error handling. See bugs[5] for the unhandled-rejection downstream."
      confidence: STATIC-INFERRED
      evidence: "useCreateSearch.ts:1-23 + dataentitiesSearch.thunks.ts:25-32 + searchRoutes.ts:7-12"

    - name: "updateSearchFacets (Search.tsx debouncer)"
      promise: "Debounce facet-state mutations and push them to the server in batches every 1500ms."
      implementation: "useCallback wraps useDebouncedCallback with deps [searchId, searchFacetParams]. Because searchFacetParams changes on every facet click, the useCallback recreates the debouncer on every click, defeating the debounce. Effective behaviour: every click dispatches immediately."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "User clicking 5 facets in 2 seconds triggers 5 PUT calls instead of the intended 1. Server-side load amplifies 5x for rapid filter sessions. Pattern parity with TermSearch batch-U bugs[2]."
      confidence: PROBE-NEEDED
      evidence: "Search.tsx:50-65 + P-189"

    - name: "MainSearch (placeholder='Search')"
      promise: "Friendly free-text search input — the label 'Search' implies natural-language text matching."
      implementation: "Typed text dispatched as-is into SearchFormData.query → JooqFTSHelper.tsQuery splits-on-space + appends ':*' + joins on '&' → to_tsquery(?) (an expression language with metacharacters !|&():*<->)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Operator typing natural-language text mostly works (because whitespace-separated words get :*-suffixed and AND-joined — equivalent to prefix-and-AND). But operator typing punctuation triggering tsquery metacharacters (e.g. an entity name containing colons or parens) gets 500 + permanently broken session per REFACTOR-229. The 'Search' label does not warn the user; the docs do not describe tsquery syntax."
      confidence: STATIC-INFERRED
      evidence: "Search.tsx:80 + MainSearchInput.tsx:42-48 + JooqFTSHelper.java:164-168 + batch-ZE SearchController bugs[7]"

    - name: "Catalog tab / top-nav 'Catalog' link"
      promise: "Tab labelled 'Catalog' takes the user to the catalog of all data entities."
      implementation: "Per batch-ZH ToolbarTabs sidecar, the top-nav 'Catalog' tab links to searchPath() (no UUID) → /search. Clicking it from any context (including from within an in-progress session at /search/{uuid}) DROPS the current session and creates a new one (Search.tsx:37-42 fires because routerSearchId is undefined). The prior session UUID is orphaned server-side until housekeeping reaps it."
      drift: MINOR
      operator_visible_consequence: "Operator inside a filtered Catalog view who clicks the 'Catalog' tab loses their filter selections — the new session has empty filters. Pattern: the navigation back to the top is non-idempotent (the tab click does not preserve session state). Operators expecting 'tab clicks are no-ops if I'm already there' are surprised."
      confidence: STATIC-INFERRED
      evidence: "Search.tsx:37-42 + ToolbarTabs.tsx:38 (batch ZH) + searchRoutes.ts:11"

  orderings:
    - location: "Results.tsx:71-74 (out-of-scope but downstream)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer for the result list?"
          a: "REFERENCE — owned by batch-ZE SearchController.search + downstream ReactiveDataEntityRepository.findByState SQL chain (per the batch-ZE invariants). Per batch-ZE, the SQL applies FTS rank ordering when a query is present, falls back to natural row order otherwise. The Search.tsx orchestrator does not impose any client-side ordering."
          confidence: REFERENCE
          evidence: "odd-platform__java__SearchController__controller-class__SearchController (couples_to + invariants) + ReactiveDataEntityRepositoryImpl.findByState"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "REFERENCE — per batch-ZE the underlying SQL has no explicit secondary ORDER BY; tie-break is database-implementation-defined."
          confidence: REFERENCE
          evidence: "odd-platform__java__SearchController invariants"
        - q: "Which subset is returned when result-set > page size?"
          a: "Determined by Results.tsx infinite-scroll using size=30; the orchestrator's pageSize=30 is dead for result loading (the Results child controls size). Subset is the first 30 of whatever ordering the SQL imposes."
          confidence: STATIC-INFERRED
          evidence: "Results.tsx:45, 71-74 + dataentitiesSearch.thunks.ts:52-67"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "The slice (dataEntitySearch.slice.ts:219-228) appends new pages without re-sorting; .map at Results.tsx:151 renders in array order. NO client-side re-sort. Trust-the-server posture."
          confidence: STATIC-INFERRED
          evidence: "dataEntitySearch.slice.ts:219-228 + Results.tsx:151-159"

  auth_gates:
    - location: "Search.tsx:1-92 + App.tsx:61 (route mount)"
      endpoint: "ui_route:/search/* + downstream POST /api/search + GET /api/search/{searchId} + PUT /api/search/{searchId}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymous traffic reaches the route AND the downstream APIs (per batch-ZE SecurityConstants.SECURITY_RULES has no entry for /api/search* — falls through to pathMatchers('/**').authenticated() which under DISABLED is bypassed). LOGIN_FORM/OAUTH2/LDAP: any authenticated user with any role/permission reaches the route AND the downstream APIs (no @PreAuthorize at controller, no permission wrap at route, no programmatic check). Operator-visible: the Catalog page is wide open under ALL auth modes. Probe P-187 will pin DISABLED-mode anonymous reach as HIGH-severity confirmation."
          confidence: PROBE-NEEDED
          evidence: "P-187 + App.tsx:61 (no permission wrap) + batch-ZE SearchController invariants[1] + SecurityConstants.SECURITY_RULES (no /api/search* entries) + AuthorizationCustomizer.java:29-30"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: full Catalog page (route mount renders, downstream APIs return data). Under LOGIN_FORM/OAUTH2/LDAP: the upstream Spring Security filter redirects to login BEFORE this component renders — the route mount is not reached. The redirect-to-login enforcement is at the platform's HTTP layer, not at Search.tsx itself."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:1-92 (no auth check in component) + batch-ZE security model"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated user (regardless of role/permission) sees the full Catalog page + the full data-entity result list. The DEG-Create CTA is hidden when DATA_ENTITY_GROUP_CREATE is absent (Results.tsx:125 WithPermissions wrap) — but this is a UI hide, not auth enforcement; the backend POST /api/dataentitygroups is gated separately via SecurityConstants. Other CTAs (none on this surface) are also unconstrained at the UI layer."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:81-85 (WithPermissionsProvider injects context, not a gate) + Results.tsx:125-138 (UI hide)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE for the read surface. Per batch-ZE SearchController invariants: no @PreAuthorize, no programmatic check at controller; service does NO row-level filter (the catalog-wide `findByState` returns every entity); repository does NO owner-scoping unless `state.isMyObjects()` is true (which requires the user to opt-in via the My Objects tab toggle). The route mount has no WithPermissionsProvider gate. The only auth-mode gate is the platform's HTTP-layer redirect-to-login (effective only under non-DISABLED modes)."
          confidence: STATIC-INFERRED
          evidence: "batch-ZE SearchController invariants[1] + SecurityConstants.SECURITY_RULES + AuthorizationCustomizer.java:29-30 + Search.tsx:1-92 + App.tsx:61"

  resource_boundaries:
    - location: "Search.tsx:50-65 + 67-71"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Yes — see bugs section [5] (facet-vs-text-query race). Two concurrent PUTs to /api/search/{searchId} with different SearchFormData payloads result in whichever resolves second winning via updateSearchState. The slice's assignFacetStateWithNewFacets handles racing PUTs by preserving local `selected !== syncedFilterState.selected` divergences — but the text-query PUT carries empty filters {}, so the merge logic incorrectly accepts the empty filters as authoritative if text-query resolves second. Operator-visible: the user clicks a facet then submits a text-query within ~500ms, and the facet selection disappears."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:53-58 + MainSearchInput.tsx:42-48 + slice.ts:40-103 + bugs section [5]"
        - q: "Is the call replay-safe?"
          a: "POST /api/search: NOT idempotent — each call creates a NEW session row in search_facets. Two calls with identical payload create two distinct UUIDs; the second one orphans the first (the user's URL is updated to the second's UUID). PUT /api/search/{searchId}: idempotent for identical payload + same UUID (it's a session-state replacement, not increment). GET /api/search/{searchId}: idempotent."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:37-42 (createSearch on mount) + batch-ZE SearchController.search behaviour + slice.ts:215"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache at the UI layer (Redux state is in-memory, no localStorage / sessionStorage persistence verified in Search.tsx). Server-side, the search_facets row has TTL eviction via SearchFacetsHousekeepingJob (housekeeping.ttl.search_facets_days, default 30 days; F-010 + LSN-018). Stale-cache window from the operator's perspective: a Slack-shared URL older than 30 days hits a permanently broken page. See bugs[7]."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:1-92 (no cache code) + slice.ts:22-36 (initialState, no persistence) + F-010.yaml + LSN-018"

  request_inputs:
    # NOTE: Search.tsx is a UI orchestrator, not a controller — its 'request inputs' are
    # (a) route param `:searchId` extracted via useSearchRouteParams, (b) the SearchFormData
    # payload it dispatches to the backend. Category F traces the name-vs-implementation
    # alignment for each.

    - location: "Search.tsx:27 (useSearchRouteParams destructured as routerSearchId) + searchRoutes.ts:4-5 (the param name 'searchId')"
      input_kind: path-param
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Name 'searchId' promises 'an identifier for a search' — to a user reading the URL bar /search/{uuid}, this looks like a stable, possibly-shareable handle for THIS particular search. To a developer reading the React-Router signature, it looks like a route parameter that identifies a search resource."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 + Search.tsx:27"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: Search.tsx:27 extracts routerSearchId → Search.tsx:46 dispatches getDataEntitiesSearch({searchId: routerSearchId}) → dataentitiesSearch.thunks.ts:43-50 calls searchApi.getSearchFacetList({searchId}) → batch-ZE SearchController.getSearchFacetList → SearchServiceImpl.getFacetsData → reads `search_facets` table row WHERE id = ${searchId}. The :searchId in the URL is the PRIMARY KEY of the `search_facets` table — a server-side session UUID, NOT a user-meaningful 'saved search' identifier. There is no 'name' or 'title' associated; the UUID is opaque."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:44-48 + dataentitiesSearch.thunks.ts:43-50 + batch-ZE SearchController invariants[3] + V0_0_1__init.sql:204-211 (search_facets schema)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — name promises 'a search identifier' (implies a user-meaningful handle); implementation is a server-side ephemeral session UUID with 30-day TTL eviction (F-010) and NO user-binding column (REFACTOR-344). The translation is undocumented in the live doc page (WebFetched 2026-05-20). Operators expecting 'a saved search I can refer back to in 6 months' encounter the housekeeping eviction at day 30+1 and a broken page; operators expecting 'my private search session' encounter the bearer-token-shape (any user holding the UUID can read/update the session). The name does NOT communicate either the TTL or the lack of user-binding."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 (the name) + batch-ZE SearchController invariants[3] (no user binding) + F-010 (TTL eviction) + WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search (no mention of either property)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Operator bookmarks /search/{uuid} expecting it to persist indefinitely; after 30 days the GET 404s + the slice has no .rejected reducer + the URL retains the stale UUID + refresh repeats the failure → 'broken bookmark, no recovery path' (bugs[7]). (b) Operator shares /search/{uuid} via Slack expecting it to be 'their' search; the recipient can not only read the filter state but UPDATE it via PUT /api/search/{uuid} — there is no per-user binding (REFACTOR-344). (c) Adversary harvests valid UUIDs (e.g. from server logs, browser-history exports, Slack archives) and uses them to DoS the platform via FTS-injection-poisoning (REFACTOR-229 cross-link). (d) Top-nav 'Catalog' tab click DROPS the current /search/{uuid} session (the link is searchPath() bare) and orphans the prior UUID server-side. The name 'searchId' communicates none of these."
          confidence: STATIC-INFERRED
          evidence: "bugs section [7] + REFACTOR-344 + REFACTOR-229 + batch-ZH ToolbarTabs.tsx:38"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the search_facets table has only `id` (the UUID) + `query_string` + `filters` + `last_accessed_at` per V0_0_1__init.sql:204-211. There is no separate `search_name`, `saved_search_id`, or user-facing alias. The conceptual gap is the FEATURE — ODD has no 'saved search' entity at all. To honor the name 'searchId' as 'a user-meaningful search identifier' would require introducing the saved-search feature (a separate table with owner_id, name, created_at, etc.). This is the structural cause of the drift: ODD does not have the FEATURE the parameter name implies."
          confidence: STATIC-INFERRED
          evidence: "V0_0_1__init.sql:204-211 + grep -i 'saved.search|savedSearch|saved_search' over odd-platform (returned no files — verified during this enrichment 2026-05-26)"
      routes_to_finding: "bugs_limitations_corner_cases[7] (session-expiry no recovery) + security.known_security_gaps[2] (bearer-token-shape) + docs_link_semantic.doc_drift_findings.UI-DOC-GAP-Search-A (URL deep-link share-ability undocumented)"

    - location: "Search.tsx:39 + 53-58 + MainSearchInput.tsx:38-44 (SearchFormData.query field dispatched on every session-create + facet-update + text-query path)"
      input_kind: body-field
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Name 'query' + the UI placeholder 'Search' (Search.tsx:80) jointly promise a free-text natural-language search. The user understands they type words and the system matches data entities containing those words."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:80 + MainSearchInput.tsx:38 + SearchFormData type"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: MainSearchInput.tsx:38-44 builds SearchFormData {query, pageSize:30, filters:{}} → dispatched via createDataEntitiesSearch or updateDataEntitiesSearch → POST /api/search or PUT /api/search/{searchId} → batch-ZE SearchController.search → SearchServiceImpl.search → state.setQuery(query) → JooqFTSHelper.tsQuery(query) at JooqFTSHelper.java:164-168: `plainQuery.split(' ').map(q -> q + ':*').join('&')` → wrapped into `ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, query)` calling `to_tsquery(?)`. Special case (highlight path): the same query is INTERPOLATED into a raw SQL string via `.formatted(text, tsQuery)` at ReactiveDataEntityRepositoryImpl.java:798-806 — TRUE SQL injection."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + 53-58 + MainSearchInput.tsx:38-44 + dataentitiesSearch.thunks.ts:25-50 + JooqFTSHelper.java:164-168 + batch-ZE SearchController class invariants[7]"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — name + placeholder promise free-text natural-language search. Implementation is Postgres tsquery (an expression language with metacharacters ! | & ( ) : * <->). Whitespace-separated alphanumeric words happen to work (each token gets ':*' suffix + AND-joined → prefix-and-AND semantics). But ANY metacharacter in the user's input poisons the parse → 42601 syntax error → the session UUID becomes permanently broken (every subsequent GET /api/search/{uuid} 500s). Operator-visible: typing an entity name containing a colon (e.g. a Snowflake fully-qualified name `db:schema:table`) breaks the search; copying an oddrn from another tab into the search bar breaks the search. The drift is not even documented (live doc page WebFetched 2026-05-20 says only 'type your search query')."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:80 (the placeholder label) + MainSearchInput.tsx:38-44 (no client-side validation) + JooqFTSHelper.java:164-168 + WebFetch of /features/data-discovery/search 2026-05-20"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Operator types `db:schema:table` (a common Snowflake oddrn shape) → POST/PUT 500 OR session UUID minted but every subsequent read 500s; refresh repeats; only `/search` bare recovers. (b) Operator types `\"exact phrase\"` (quoted-phrase intent — natural search engine syntax) → the double-quote is preserved through tsQuery.split(' ') as part of two tokens → `\"exact:*&phrase\":*` reaches to_tsquery → may succeed but matches nothing useful. (c) Operator types `foo OR bar` (boolean intent, common in Google/Elastic) → 'foo:*&OR:*&bar:*' reaches to_tsquery → matches only entities containing all three of 'foo', 'OR', 'bar' as prefixes, NOT the boolean OR. (d) Operator types `foo & bar` (intent: AND) → the literal '&' is a tsquery metacharacter, may parse but unexpectedly. (e) Adversary types `foo ) | (` deliberately → session UUID poisoned → DoS-by-poisoning, shareable via the URL (REFACTOR-344 + REFACTOR-229 combined). Probe P-188 will confirm (a) end-to-end."
          confidence: PROBE-NEEDED
          evidence: "P-188 + JooqFTSHelper.java:164-168 + bugs section [8]"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "There is no closer-aligned column / field. The persisted `search_facets.query_string varchar(255)` (V0_0_1__init.sql:204-211) is just the raw text — there is no parsed-AST representation, no syntax-validated form. The conceptual gap is the FEATURE — a 'search query' that respects natural-language intent would require either (a) a client-side parser (e.g. converting `\"exact phrase\"` → tsquery `(exact <-> phrase)` and `foo OR bar` → tsquery `foo | bar`), or (b) a backend tsquery escape step at JooqFTSHelper.tsQuery before calling to_tsquery (REFACTOR-229's architectural fix). Neither exists today."
          confidence: STATIC-INFERRED
          evidence: "V0_0_1__init.sql:204-211 + JooqFTSHelper.java:164-168"
      routes_to_finding: "bugs_limitations_corner_cases[8] (FTS-injection at UI surface) + security.known_security_gaps[1] (REFACTOR-229 strengthening) + docs_link_semantic.doc_drift_findings.UI-DOC-GAP-Search-C (query syntax undocumented)"

    - location: "Search.tsx:53-58 (filters payload constructed via mapValues(searchFacetParams, values))"
      input_kind: body-field
      input_name: "filters"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Name 'filters' promises a structured set of filter selections — the user picks Datasource=Snowflake, Tag=PII, Owner=alice and 'filters' should carry those selections to the server."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:53-58 + SearchFormData.filters type"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: Search.tsx:56 builds filters via mapValues(searchFacetParams, values) (flattens `{facetName: {optionId: SearchFilterStateSynced}}` into `{facetName: SearchFilterStateSynced[]}`) → dispatched to PUT /api/search/{searchId} → batch-ZE SearchController.updateSearchFacets → SearchServiceImpl.updateFacets → FacetStateMapper.mapForm converts to internal FacetStateDto → persisted as JSONB in search_facets.filters → on result fetch, JooqFTSHelper.facetStateConditions translates each facet to a JOOQ WHERE clause against the corresponding column. MATCHES the promise at the conceptual level."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:53-58 + dataentitiesSearch.thunks.ts:34-41 + batch-ZE SearchController.updateSearchFacets + V0_0_1__init.sql:204-211 (jsonb filters column)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES at the structural level — filters in the payload correspond to filter columns at the WHERE clause. The semantic mapping (e.g. 'OwnerFacet' option-id → owner.id) is unambiguous; the wire format is straightforward."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:53-58 + batch-ZE SearchController.updateSearchFacets + FacetStateMapper"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — filters is used straightforwardly."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A"

    - location: "Search.tsx:55 (myObjects forwarded into dispatch payload from selector getSearchMyObjects)"
      input_kind: body-field
      input_name: "myObjects"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Name 'myObjects' promises a scope-to-my-data toggle — when true, the search should return only entities the current user owns."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:55 + SearchFormData.myObjects field"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: Search.tsx:55 forwards myObjects → PUT /api/search/{searchId} → SearchServiceImpl.updateFacets → state.isMyObjects() is consulted at SearchServiceImpl.java:106 to scope the result query via authIdentityProvider.fetchAssociatedOwner. When true, the result query gains a WHERE clause `owner_id IN (current_user_owner_ids)`. When false, NO scoping is applied — full catalog."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:55 + batch-ZE SearchController.search + SearchServiceImpl.java:106"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES at the conceptual level — 'myObjects' means 'objects owned by me' via the user-owner-mapping table. The implementation honors the name. **HOWEVER**, there is a Category F edge case that LSN-020 explicitly flags: 'my' here resolves to the user-OWNER-mapping, NOT to the user's `created_by` audit column. A user who PERFORMS ingestion or audit actions (which write `created_by`) but is NOT in the user-owner-mapping returns empty for myObjects=true. This is the SAME pattern as the LSN-020 Activity Feed userIds → OWNER_ID translation. For Search.tsx the impact is subtle: the user-owner-mapping IS the correct semantic for 'my objects' (data entities I OWN, not data entities whose creation I logged), so the LSN-020 class-match here is NOT a drift — but it warrants the explicit note because the naming alone does not guarantee semantic alignment."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:55 + SearchServiceImpl.java:106 + LSN-020 cross-link + USER_OWNER_MAPPING schema"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Edge case: a user with NO entry in USER_OWNER_MAPPING who toggles myObjects=true sees an empty result list — even if they have other relationships to data entities (e.g. listed as `created_by`, or holding RBAC roles over the entity). The fix here is not to change the name; it's to add a user-mapping entry for the user. Same shape as LSN-020 but with a non-misleading name."
          confidence: STATIC-INFERRED
          evidence: "USER_OWNER_MAPPING table + LSN-020"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the implementation is correct for the 'objects I OWN' interpretation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A (drift NONE; LSN-020 cross-link is for class-awareness, not a bug)"

    - location: "Search.tsx:39 (pageSize forwarded into initial session-create payload)"
      input_kind: body-field
      input_name: "pageSize"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Name 'pageSize' promises the number of results per page returned by the search."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + SearchFormData.pageSize field"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Backend: per batch-ZE SearchController.search, the pageSize field at session-create is NOT propagated to subsequent result-fetch — the Results.tsx infinite-scroll child uses its own hardcoded size=30 (Results.tsx:45) in every GET /api/search/{searchId}/results call. The session-state pageSize is effectively DEAD — neither the backend's result-pagination nor the UI's infinite-scroll consult it."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45 + dataentitiesSearch.thunks.ts:52-67"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name promises a controllable page size; the implementation accepts it at session-create but uses a different hardcoded constant for actual result pagination. Operator-invisible (because both happen to be 30), but a maintainer altering Search.tsx:39 from 30 to 50 will see no change unless they ALSO update Results.tsx:45. The drift is silent."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Maintainer bumps Search.tsx:39 pageSize to 50 expecting larger result pages — sees no effect. (Operator: not directly affected today; potential for future drift if the two literals diverge.)"
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Yes — Results.tsx:45 `const size = 30` is the authoritative pagination size; Search.tsx:39 pageSize:30 is the dead-but-named-correctly twin. Either remove the Search.tsx:39 value (use a single shared constant) or wire it through."
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:39 + Results.tsx:45"
      routes_to_finding: "implicit_adrs[4] (pageSize=30 hardcoded twice)"

  probes_emitted:
    - probe_id: P-187
      question: "Auth gate at the Catalog page route (Category D — confirms anonymous reach under auth.type=DISABLED + the no-permission-wrap route mount)"
      probe_path: "lineage/odd-platform/probes/P-187.yaml"
    - probe_id: P-188
      question: "FTS-injection / session-poisoning end-to-end (Category F + B — confirms the typed query metacharacter → 42601 → poisoned UUID chain)"
      probe_path: "lineage/odd-platform/probes/P-188.yaml"
    - probe_id: P-189
      question: "Debouncer recreation under rapid facet clicking (Category E — measures dispatch cardinality and confirms the broken-debouncer hypothesis)"
      probe_path: "lineage/odd-platform/probes/P-189.yaml"

  stress_summary:
    triggers_total: 13
    questions_total: 52
    answers_static_inferred: 45
    answers_probe_needed: 5
    answers_reference: 2
    drift_flags: 4   # name_behavior_pairs.updateSearchFacets (DRIFT) + .MainSearch (DRIFT) + .Catalog tab (MINOR) + request_inputs.searchId (DRIFT) + .query (DRIFT) + .pageSize (DRIFT) = 6, but 2 of these (searchId, query) cross-list in name_behavior_pairs and request_inputs — distinct count of UNIQUE drift findings is 4 (updateSearchFacets debouncer, MainSearch+query placeholder, searchId path-param, pageSize session-vs-results)
```

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "Canonical live doc page for the Search and Filtering feature (P-01:F-002). Live page WebFetched in this session 2026-05-20 — status 200. Page explicitly enumerates the seven facets that THIS UI's `<Filters/>` child renders (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses — matching Filters.tsx:46-65 verbatim) and frames the Catalog-page search workflow. Confidence promoted to HIGH because the live page's facet list matches the UI's facet list 7-for-7."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "WebFetch in this session against the live URL; response listed the 7 facets in order matching Filters.tsx + the result-display narrative"
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "P-01 pillar landing — Data Discovery section. The Catalog page Search.tsx is the principal entrypoint to the discovery pillar."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "previously verified via system-mission.md generation pass + WebFetch — sister inference to TermSearch batch-U"
    confidence: MEDIUM
- fetched_excerpts: |
    From live WebFetch of `https://docs.opendatadiscovery.org/features/data-discovery/search` (status 200, 2026-05-20):

    **Facets enumerated on the live page** (matches Filters.tsx:46-65 verbatim):
    1. Datasource — "restrict results to entities ingested from a specific datasource (single-select)"
    2. Type — Multi-select for entity types like TABLE, JOB, DASHBOARD; "Only shown after an entity-class tab is selected"
    3. Namespace — "restrict to entities in a given namespace (single-select)"
    4. Owner — Multi-select
    5. Tag — Multi-select
    6. Groups — Multi-select for Data Entity Group membership
    7. Statuses — Multi-select for statuses like STABLE, DEPRECATED

    **Search input narrative**: "type your search query into the search bar"; "ODD dynamically responds, delivering results in seconds." NO explicit mention of Enter-key semantics, suggestions toggle (disabled on this surface), or URL-backed session UUID.

    **Result display**: "Each entity in the search results is accompanied by an information and a question icon, offering additional clarity and insight."
- doc_drift_findings:
  - "**UI-DOC-GAP-Search-A: The live doc does NOT document the URL-backed deep-link share-ability of filtered Catalog views.** A high-utility feature — share `/search/{uuid}` with a teammate to restore the same filter state — is undocumented. The user has to discover it by experimentation. Pairs with the session-expiry caveat (bugs section [7] — stale UUID broken page) which SHOULD be cross-linked to the doc page if the share-ability is ever documented. Severity: MEDIUM (high-utility undocumented feature; same finding shape as TermSearch batch-U UI-DOC-GAP-H). Routed from stress_findings.request_inputs.searchId."
  - "**UI-DOC-GAP-Search-B: The live doc does NOT document the 'My Objects' tab vs default 'All' read-collaborative posture.** The page describes search facets but says nothing about the implicit cross-owner visibility model. Operators expecting per-team isolation discover only by experimentation that the 'My Objects' tab is OPT-IN — every Catalog search by default returns the entire data-entity catalog. The platform's read-collaborative posture (system-mission.md line 267) is a load-bearing architectural stance that operators MUST understand; it lives undocumented on the user-facing Search page. Severity: HIGH (security expectation drift — operators may assume isolation they don't get). Routed from stress_findings.auth_gates."
  - "**UI-DOC-GAP-Search-C: The live doc does NOT document the FTS query-text syntax / metacharacter handling.** A typed query of `foo ) | (bar` poisons the session UUID per REFACTOR-229. The docs say 'type your search query' without mentioning that the query is interpreted as a tsquery prefix-match expression. Operators trying advanced syntax (e.g. `\"exact phrase\"`, boolean operators) encounter unpredictable behaviour with no documentation. Severity: MEDIUM (silent-syntax-failure risk; combined with REFACTOR-229 the syntax errors are also availability-affecting). Routed from stress_findings.request_inputs.query + name_behavior_pairs.MainSearch."
  - "**UI-DOC-GAP-Search-D: The live doc does NOT document pagination semantics or page size.** The docs imply continuous browsing ('delivering results in seconds') but do not state that the UI loads 30 entities per scroll-page, nor that the total count may drift from the actual list count (REFACTOR-425 family + the backend's hard-coded hasNext=true). For deployments with 10K+ data entities, this is a perceptible UX trait. Severity: LOW."
  - "**UI-DOC-GAP-Search-E: The live doc does NOT document the DEG-create CTA visibility model.** The 'Add group' button appears on the Catalog page only when (a) the user has `DATA_ENTITY_GROUP_CREATE` permission AND (b) the user has selected the 'ENTITY_GROUP' class tab. Operators looking for a way to create a DEG may not realise the conditional visibility — the docs don't explain why the button appears for some users and not others. Severity: LOW."
  - "**UI-DOC-GAP-Search-F: The live doc does NOT document the suggestion-disabled behaviour on the Catalog page.** Search.tsx explicitly disables suggestions (`<MainSearch ... disableSuggestions/>`); the suggestions backend endpoint exists but is suppressed here. The docs don't mention suggestions either way — operators don't know whether suggestions are a feature or what disables them. Severity: LOW."
  - "**UI-DOC-GAP-Search-G: The live doc does NOT mention the top-nav 'Catalog' tab drops the current session.** Operators inside a filtered session who click the tab lose their filters with no warning. Routed from stress_findings.name_behavior_pairs.Catalog-tab. Severity: LOW (UX gap)."

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the Catalog page is a UI/API surface protected by the three non-DISABLED auth modes per the SECURITY_RULES wiring; reaching `/search/*` requires an authenticated session in those modes. Under `auth.type=DISABLED` the route is reachable by anyone able to hit the platform's HTTP port (per pillar P-09 dev-only mode + REFACTOR-068 + Probe P-187 to confirm). The component itself does not gate by auth mode — the upstream route shell + `WithPermissionsProvider` chain decide whether `Search` mounts; the route mount at App.tsx:61 is unconditional but the platform-level redirect-to-login behaviour on session miss enforces auth at the network layer.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The `auth.ingestion.filter.enabled` filter applies only to `/ingestion/entities` — this component drives `/api/search/*` traffic on the UI/API surface, governed by SECURITY_RULES not the ingestion filter.
- **authorization_assertions**:
  - "`<WithPermissionsProvider allowedPermissions={[Permission.DATA_ENTITY_GROUP_CREATE]} resourcePermissions={[]}>` (Search.tsx:81-85) wrapping `<Results/>` — UI-only INJECTION of the permission context; does NOT gate route rendering (the `<Results/>` element renders regardless of the user's DATA_ENTITY_GROUP_CREATE permission)."
  - "`<WithPermissions permissionTo={Permission.DATA_ENTITY_GROUP_CREATE}>` (Results.tsx:125) wrapping the conditional `<DataEntityGroupForm/>` (Results.tsx:126-137) — UI-only HIDE of the Create CTA. The button is INVISIBLE (not greyed) to users without DATA_ENTITY_GROUP_CREATE — same pattern as TermSearch batch-U + PolicyList batch-Q."
  - "**NO row-level authorization on Results result-list rendering.** Results.tsx:151-159 maps every `searchResult` through `<ResultItem/>` unconditionally — there is no `WithPermissions`, no per-entity owner check, no per-entity permission check. Every authenticated user sees every data-entity row returned by the server. The `<ResultItem/>` itself renders a Link to the entity's detail page — also unconditional."
  - "**NO @PreAuthorize on the upstream `SearchController.search` controller method itself (per batch-ZE SearchController.search invariants[1]: 'no controller-side validation beyond @Valid').** The read surface is wide open to authenticated users — and to ANYONE under DISABLED-mode."
- **owner_scoping**: `BYPASSES — read-collaborative posture inherited from batch-ZE SearchController + SearchServiceImpl`. The repository tier has no per-owner / per-namespace filter on the main result list (`authIdentityProvider.fetchAssociatedOwner` is called only to compute `myObjectsTotal` count; not used to scope the main result query — SearchServiceImpl.java:128-130). This UI surfaces the unscoped catalog. The 'My Objects' tab IS an opt-in scoping affordance, but the default is 'All'. Cross-batch link: system-mission.md line 267 (the architectural stance) + batch-ZE SearchController owner_scoping field.
- **data_exposure**:
  - "List view exposes every data-entity row across every owner / namespace to every authenticated user. The fields exposed per ResultItem include (verified by Grep ResultItem rendering): entity name, namespace, ownership, type, datasource, tags, statuses — i.e. the COMPLETE metadata surface for every entity in the catalog. Names like `finance/customers_pii`, `marketing/user_clickstream`, `compliance/audit_logs` may reveal organisational structure, sensitive-data categorisation, or compliance taxonomy. The full catalog is informational disclosure."
  - "Click-through to entity detail (`<S.ResultsItemLink>` inside ResultItem.tsx) exposes the FULL DataEntity DTO (definition, lineage neighbours, owners, tags, statuses, descriptions, attachments, terms) — but the Link itself is rendered unconditionally on every row. Per batch-J F-001 sidecars, opening a detail page registers as +2 view_count (LSN-017 case) — so casual Catalog browsing inflates the Popular ranking by 2x the user's click count."
  - "DEG-create CTA visibility leaks the user's DATA_ENTITY_GROUP_CREATE permission to the DOM (visible only when the user has the permission AND the entity-class tab is `ENTITY_GROUP`). An adversary inspecting the DOM after navigating to the ENTITY_GROUP tab can infer the current user's permission set. Pattern identical to PolicyList batch-Q + TermSearch batch-U."
  - "URL-visible session UUID (`/search/{uuid}`) — the UUID is opaque to outside observers but constitutes an unguessable bearer of session state on the server. Sharing the URL shares the filter state. Per REFACTOR-344 the `search_facets` row has no user binding, so the UUID is bearer-token-shaped — anyone who knows it can read/update the session. Combined with REFACTOR-229 (FTS injection on the `query` field) a malicious caller can poison a session UUID, then share/distribute it to break the recipient's facet reads."
  - "Typed search-query text reaches the server as-is (no client-side validation per bugs[8]); the server then reflects the query back in `SearchFacetsData.query` field and stores it in `search_facets.query_string`. Anyone with the session UUID can read what the user typed. Per REFACTOR-344 + REFACTOR-229 this is a session-poisoning vector. Per batch-ZE TRUE-SQL-injection finding at highlightDataEntity, the same query reaches a `.formatted()` SQL-interpolation site — a real SQL injection sink."
- **known_security_gaps**:
  - "**Read-collaborative posture — every authenticated user searches the entire catalog by default.** The 'My Objects' tab is OPT-IN, not the default. The 7 facets are CLIENT-SELECTED filters, not implicit identity-based scoping. Organisations expecting team-isolation (team-A's `pii_subjects` table not visible to team-B's analyst) discover from this UI that no such isolation exists. Cross-batch link: system-mission.md line 267 (read-collaborative posture as an architectural stance) + REFACTOR-024 family." — evidence: Search.tsx:74-87 (no permission wrap on Results) + Results.tsx:151-159 (unconditional .map) + batch-ZE SearchController invariants + system-mission.md line 267 — severity: MEDIUM (the architectural stance is documented in system-mission.md but the UI surface is the consequence; operators MAY not realise the default behaviour)

  - "**FTS-injection / session-poisoning at the typed search-query field (REFACTOR-229 batch-ZE strengthening) + TRUE SQL injection at the highlight path.** Typed text passes UNESCAPED through to `to_tsquery(?)` — a query containing tsquery metacharacters (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\\`) poisons the session UUID. Combined with REFACTOR-344 (no user binding on search_facets) the poisoned UUID can be shared as a DoS vector. **The UI provides ZERO mitigation** — no max-length, no metacharacter filter, no client-side `to_tsquery` validation. Search.tsx is the UI HALF of the REFACTOR-229 security finding; the architectural fix point is `JooqFTSHelper.tsQuery` (single source of truth on the server). **CRITICAL: per batch-ZE SearchController class invariants[7], the same `query` field reaches ReactiveDataEntityRepositoryImpl.getHighlightedResult at line 798-806 via `String.formatted(text, tsQuery)` — a true raw-SQL-interpolation site. This is exploitable SQL injection, not just DoS-by-syntax.** Probe P-188 emitted to pin the chain end-to-end." — evidence: Search.tsx:80 (MainSearch mount, no validation prop) + MainSearchInput.tsx:42-48 (raw query dispatch) + REFACTOR-229.md + batch-ZE SearchController invariants[7] + JooqFTSHelper.java:164-168 + ReactiveDataEntityRepositoryImpl.java:798-806 + P-188 — severity: HIGH (security/availability hazard; operator-reachable; DoS-by-poisoned-session is the documented impact pattern; TRUE SQL injection at highlight path)

  - "**Session UUID is bearer-token-shaped — REFACTOR-344 family.** The `search_facets` row has no user-binding column. Anyone with the UUID can read/update the session. Sharing the URL `/search/{uuid}` shares the SESSION as well as the filter state. Combined with REFACTOR-229 (above), a poisoned UUID becomes a denial-of-service vector that propagates by sharing. The UI does not surface this — the URL appears as just a state-restore mechanism. **Category F finding: the param name `searchId` does not communicate the bearer-token-shape; operators reading the URL bar cannot tell that the UUID is a shareable handle to a server-side ephemeral session.**" — evidence: Search.tsx:44-48 + REFACTOR-344 (search_facets no user binding) + REFACTOR-229.md + stress_findings.request_inputs.searchId — severity: MEDIUM

  - "**Session-expiry is silent — broken-page UX after 30 days.** A user reloading after `housekeeping.ttl.search_facets_days: 30` (default per F-010) sees a permanently broken page at `/search/{stale-uuid}` (per bugs section [7]). Not a privacy leak but a session-lifecycle quirk operators should know. Cross-batch link: F-010 / P-08:F-002 SearchFacetsHousekeepingJob (LSN-018 case-law for the search_facets TTL eviction)." — evidence: Search.tsx:44-48 + F-010.yaml — severity: LOW

  - "**Unhandled-rejection silent-failure on session-create / restore.** useCreateSearch.ts:14-19 (createDataEntitiesSearch promise chain — no .catch); slice missing .rejected reducers. Auth-token-expired mid-session reproduces: the GET `/api/search/{searchId}` returns 401 → thunk rejects → slice silent → URL retains `:searchId` → user sees frozen empty page → refresh repeats. Pattern parity with batch-U TermSearch known_security_gaps[4]." — evidence: useCreateSearch.ts:14-19 + slice.ts:214-260 (no rejected handlers) — severity: MEDIUM (defence-in-depth + observability — silent failures inhibit operator diagnostics)

  - "**Create-DEG backend-bypass via direct API.** The UI hides the 'Add group' button when DATA_ENTITY_GROUP_CREATE absent (Results.tsx:125), but the backend route `POST /api/dataentitygroups` is gated via SECURITY_RULES at SecurityConstants (not re-verified this session — out of scope for the UI sidecar's confirmed surface). UI guard is defensive; backend enforcement is the operative defence." — evidence: Results.tsx:125-138 — severity: LOW (defence-in-depth is fine; the UI is presentation-only by design)

  - "**Cross-owner data exposure family (REFACTOR-024).** Every authenticated user sees every data-entity row. The default tab is 'All'; the 'My Objects' tab is OPT-IN. The 7 facets are CLIENT-SELECTED filters, not identity-based scoping. This is the canonical Discovery-pillar surface where the read-collaborative posture (system-mission.md line 267) manifests. Pattern parity with the TermSearch batch-U read-collaborative finding on Terms." — evidence: Search.tsx:74-87 + Results.tsx:151-159 + REFACTOR-024 family + system-mission.md line 267 — severity: MEDIUM

  - "**Anonymous reach under auth.type=DISABLED.** Probe P-187 emitted to pin (a) the route mount has no permission wrap (App.tsx:61); (b) the downstream APIs have no @PreAuthorize (batch-ZE) and no SECURITY_RULES entry; (c) under DISABLED, an unauthenticated caller can POST /api/search + GET the result list. The Catalog page is functionally PUBLIC under DISABLED. Operators using DISABLED mode for 'just trying ODD locally' may not realise their network port is exposing the catalog to anyone able to reach it." — evidence: P-187 + App.tsx:61 + batch-ZE SearchController invariants[1] + SecurityConstants.SECURITY_RULES — severity: MEDIUM (DISABLED is dev-only per docs, but the absence is structural; once DISABLED is in use the Catalog page is anonymously reachable)

## performance

- **hot_paths**:
  - "Initial mount fires `createDataEntitiesSearch` → POST `/api/search` → server-side `search_facets` row INSERT + `SearchServiceImpl.search` → `getFacetsData` runs **the catalog-wide COUNT(*) query via `ReactiveDataEntityRepository.countByState`** (batch-ZE SearchController.search couples_to). For a 10K-entity catalog this is a non-trivial cost on every Catalog-page mount. The follow-up `navigate(searchPath(searchId))` triggers a client-side route transition. Result rows then load via Results.tsx infinite-scroll (GET `/api/search/{searchId}/results?page=1&size=30`)." — evidence: Search.tsx:37-42 + useCreateSearch.ts:14-19 + Results.tsx:71-74 + batch-ZE SearchController.search performance section
  - "Filter sidebar interactions fire `updateDataEntitiesSearch` via the BROKEN debouncer (see bugs section [3]) — every click currently dispatches one PUT immediately (instead of coalescing). For a user rapidly toggling 5 facets in 2 seconds, server takes 5 PUTs in 2 seconds — each a session-state write + facet recompute. Server-side cost per PUT scales O(# facet options × # facets × catalog size) in `SearchServiceImpl.updateFacets` + `getFacetsData`. Probe P-189 emitted to measure dispatch cardinality." — evidence: Search.tsx:50-71 (broken debouncer) + dataentitiesSearch.thunks.ts:34-41 + P-189
  - "Restore-from-URL fires `getDataEntitiesSearch` → GET `/api/search/{searchId}` once per deep-link / reload. Cost: one HTTP round-trip + one server-side session read + one full facet-state recompute. Cold-cache deep-link to a 30-day-old session: probably 404 (session evicted) → 0 cost but broken UI." — evidence: Search.tsx:44-48 + dataentitiesSearch.thunks.ts:43-50 + F-010.yaml (30-day TTL)
  - "Infinite-scroll page loads (Results child): one HTTP round-trip per page. `pageSize=30` hardcoded; for a 10K-entity catalog, ~334 paginated GETs to fully load — only happens if the user actually scrolls. Per-page cost scales with the search-result `JooqFTSHelper.facetStateConditions` query." — evidence: Results.tsx:71-74 + dataentitiesSearch.thunks.ts:52-67
- **throughput_characteristics**:
  - "Single-item mutation per facet change — no bulk-facet API. Each click is one PUT. With the broken debouncer (above) the server takes N PUTs per N clicks instead of 1 coalesced PUT."
  - "Infinite-scroll page loads: one HTTP round-trip per page. `pageSize=30` hardcoded; for a 1000-entity catalog, ~34 paginated GETs to fully load — only happens if the user actually scrolls. Server-side per-page cost is bounded by the underlying paginated query (the batch-ZE SearchController cost model)."
  - "Text-query search fires one synchronous PUT on Enter/click (MainSearchInput.tsx:42-48) — no batching, no debounce. A user spamming Enter 3 times in 500ms fires 3 PUTs. Server-side `updateDataEntitiesSearch` is idempotent for the same payload but the cost is wasted."
- **resource_allocation**:
  - "Each dispatch allocates `mapValues(searchFacetParams, values)` (line 56) — a fresh object per dispatch. The selectors at redux/selectors/dataentitySearch.selectors.ts (`getSearchFacetsData` etc.) may also allocate fresh references on every selector run (via mapValues + pickBy at line 129-133)."
  - "The 1500ms debouncer (when correctly working) holds a closure over `[searchId, searchQuery, searchMyObjects, searchFacetParams]` — but because it's recreated on every facet change (bugs section [3]), no significant memory accumulation. The garbage-collected prior debouncer's `setTimeout` callback fires (the runtime can't pre-cancel an unreachable timer that is already scheduled) — but its closure references are dead, so the dispatch fires with stale state and is then a no-op-ish noise."
  - "Redux store size: `dataEntitySearch` slice per slice.ts:22-36 holds the full facetState map (potentially N=hundreds of facet options across 7+ facet types) + result items (capped at the loaded page count × 30) + suggestions + facets cache + highlightById map. For a 10K-entity catalog with 200 facet options per facet, the in-memory Redux state is bounded by ~100KB."
- **scaling_characteristics**:
  - "Stateless component (no module-level mutable state — verified by reading Search.tsx:1-92 end-to-end; no `let` outside the component body). React 18+ Strict Mode double-mount in dev fires the create-session twice — the second create returns a NEW session UUID and overwrites the first; the prior session is orphaned server-side until `SearchFacetsHousekeepingJob` evicts it. Dev-only; production builds do not Strict-Mode-double-mount."
  - "URL-driven re-mounts: changing `/search/X` → `/search/Y` (manual URL edit) triggers the route-param change → the first useEffect (lines 37-42) sees `routerSearchId` change but the guard `!routerSearchId` short-circuits; the second useEffect (lines 44-48) sees `routerSearchId` change AND `searchId !== routerSearchId` initially → fires `getDataEntitiesSearch` to restore the new session."
- **known_performance_gaps**:
  - "**Broken debouncer — 1500ms intent not realised; every facet click dispatches.** Per bugs section [3], the `useCallback` recreates the debouncer on every `searchFacetParams` change, defeating its purpose. Net effect: a user clicking 5 facets in rapid succession sees 5 in-flight PUT requests instead of 1 coalesced PUT. Server-side P99 latency degrades. Recommended fix: useMemo the debouncer outside `useCallback` OR remove `searchFacetParams` from the deps. **Architectural fix point: this is the SAME bug shape as TermSearch batch-U — fix BOTH files in one refactor.** Probe P-189 will pin dispatch cardinality under rapid clicking." — evidence: Search.tsx:50-65 + useCallback deps line 64 + TermSearch batch-U bugs[2] + P-189 — severity: MEDIUM
  - "**Re-fire storm on facet-state effect (LSN-017 class-match).** Per bugs section [2], the effect at lines 67-71 reads `searchFacetsSynced` in the guard but only `searchFacetParams` in the deps. Combined with potential selector-instability on `getSearchFacetsData`, the effect could re-fire on every render during the in-flight PUT window. LSN-017's measurement-truth principle applies; probe P-189 would confirm." — evidence: Search.tsx:67-71 + slice.ts:97 + LSN-017 + P-189 — severity: MEDIUM (observability gap; class-match to LSN-017)
  - "**catalog-wide COUNT(*) on every Catalog-page mount.** The session-create flow forces a full facet-aggregation pass against the catalog. For a 100K-entity deployment this is the most expensive operation on the Catalog page; combined with the no-rate-limit posture (REFACTOR-220 family), a malicious or buggy client can DoS the platform by repeatedly creating sessions. The UI offers NO mitigation — there's no client-side throttle, no in-flight-de-dup, no 'recent session' fallback." — evidence: Search.tsx:37-42 + batch-ZE SearchController performance + SearchServiceImpl.java:74-82 — severity: MEDIUM
  - "**Empty-state copy + zero-catalog onboarding affordance — UX latency.** Per bugs section [10], the empty-state copy 'No matches found' on a fresh deployment slows operator onboarding. A new ODD operator landing on `/search` sees the message + no obvious next step." — evidence: Results.tsx:161-165 — severity: LOW (UX, not perf — included here for cross-link to UX-onboarding consideration)

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Playwright UI end-to-end search scenarios — `tests/features/search/search.spec.ts` exercises happy-path search via the UI (per batch-ZE SearchController findings — `searchBy('books aqa')`, `'group aqa'`, etc.). These hit the Catalog page's `<MainSearchInput>` and indirectly exercise THIS Search.tsx orchestrator's session-create + URL-restore + facet-sidebar mount path."
    test_class: integration
    test_files: ["tests/features/search/search.spec.ts"]
  - behaviour: "`tests/features/search/search_in_data_entity.spec.ts` — second Playwright spec for entity-detail search context (out of scope for this UI sidecar but covers neighbouring flows)"
    test_class: integration
    test_files: ["tests/features/search/search_in_data_entity.spec.ts"]
- uncovered_behaviours:
  - behaviour: "Mount with no URL param + no cached session → `createDataEntitiesSearch` dispatch + `navigate(searchId)` follow-through (Search.tsx:37-42)"
    test_class: unit
    criticality: HIGH
    note: "Search.test.tsx — would catch the missing-dep LSN-017-adjacent smell at lines 37-42"
  - behaviour: "Mount with URL param but no cached session → `getDataEntitiesSearch` dispatch (Search.tsx:44-48)"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Mount with URL param AND cached session → neither dispatch fires (idempotent restore)"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Facet change with synced=true → no update dispatch (Search.tsx:67-71 guard)"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Facet change with synced=false → debouncer fires once per 1500ms window (currently FAILS per bugs section [3] — debouncer recreated on every render) — covered by P-189"
    test_class: integration
    criticality: HIGH
    note: "P-189 emitted"
  - behaviour: "Race: facet change + text-query submission within debounce window → assert eventually-consistent state"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Session-expiry: stale URL UUID → 404 response → assert UI degraded state + suggest fallback"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Unhandled-rejection: createDataEntitiesSearch fails → assert error boundary catches OR slice surfaces error"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "FTS-injection regression: typed query containing tsquery metacharacters poisons the session UUID — covered by P-188"
    test_class: security
    criticality: HIGH
    note: "P-188 emitted"
  - behaviour: "Cross-owner result visibility: assert default-tab 'All' returns entities the authenticated user does not own — confirms read-collaborative posture (REFACTOR-024 family)"
    test_class: security
    criticality: HIGH
  - behaviour: "Pagination total-vs-list divergence (REFACTOR-425 family): assert pagination terminates correctly when count predicate diverges from list predicate"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "React-Router-Dom Strict-Mode double-mount → assert only one session is held; the second is orphaned"
    test_class: unit
    criticality: LOW
  - behaviour: "Anonymous reach under auth.type=DISABLED — covered by P-187"
    test_class: security
    criticality: HIGH
    note: "P-187 emitted"
- test_files: ["tests/features/search/search.spec.ts", "tests/features/search/search_in_data_entity.spec.ts"]
- gaps: |
    Zero existing UI-side unit/integration tests for this Search.tsx orchestrator. The Playwright specs cover the UI happy-path but cannot catch (a) FTS query-syntax failures at the UI surface (REFACTOR-229 manifestation — partially addressed by P-188), (b) the empty-query session-create asymmetry vs `getSearchSuggestions`, (c) cross-session UUID guessing / bearer-token sharing (REFACTOR-344), (d) authorization regressions (partially addressed by P-187), (e) the LSN-017-class dep-array bugs (incomplete deps on createSearch effect + facet-sync effect — bugs section [1] + [3]), (f) the broken debouncer (bugs section [3] — addressed by P-189), (g) the page-vs-count pagination divergence (REFACTOR-425 family). The worst class is **security** — no UI-anchored test asserts the auth-mode matrix, owner-scoping, or FTS-injection. P-187, P-188, P-189 emitted to start closing this gap; further work needed to drive Search.tsx into a unit-test harness (jest + @testing-library/react) so the LSN-017 dep-array smells are caught at PR time.

## coherence_check (LSN-018 Rule 6)

Performed pre-emit coherence check across `feature-flows/` + sibling sidecars (batch ZA SearchResults, batch ZE SearchController class + search method, batch ZH ToolbarTabs, batch ZI searchRoutes, batch U TermSearch). Findings:

- **Strengthens** F-001 / P-01:F-002 Popular Entities Ranking (and the broader Data Discovery pillar P-01 search-and-filter surface) — this sidecar provides the UI-half evidence for the read-collaborative posture, the FTS-injection (REFACTOR-229) UI-side blind spot, the URL-backed session pattern, the broken debouncer, and the page-vs-count divergence inheritance. F-001 currently anchors on the view_count doubling case at hop-1 DataEntityDetails.tsx; this Search sidecar adds the **sister UI entry point** for the Discovery pillar (the Catalog page) and confirms the SAME LSN-017 class of dep-array smell applies here (3 instances at lines 37-42, 44-48 [correct counter-example], and 67-71). New back-links emitted: `related_features: [F-001]` + `related_pillar_features: [P-01:F-002]`.

- **Strengthens** batch-ZE SearchController.search + SearchController class sidecars (the BACKEND HALF of this pillar surface). The batch-ZE sidecars correctly identified: no controller-side validation, no owner-scoping on the main result list, the FTS-injection at JooqFTSHelper.tsQuery (REFACTOR-229 strengthening), the TRUE-SQL-injection at highlightDataEntity, the no-user-binding (REFACTOR-344), the 30-day TTL eviction (F-010), the `hasNext: true` contract bug. This UI sidecar adds the **UI-side consequences**: NO client-side mitigation for the FTS injection; the SESSION UUID is visible in the URL and shareable; the default tab is 'All' (the My-Objects affordance is opt-in not opt-out); the BROKEN DEBOUNCER amplifies the throughput risk on the backend; the UI hides the `hasNext: true` bug from itself by computing hasNext client-side, but third-party OpenAPI consumers are exposed. The two ends compose: the backend is wide open AND the frontend doesn't defensive-pad.

- **Strengthens** batch-ZI searchRoutes — confirms the route-module-level Category F drift on the `:searchId` parameter. The route module sidecar correctly noted that the URL form `/search/{uuid}` accepts ANY string and only validates implicitly via the downstream GET 404; this UI sidecar adds the operator-visible consequence (broken-page UX with no recovery).

- **Strengthens** batch-ZH ToolbarTabs — confirms the tab-click drops the current session race. ToolbarTabs.tsx:38 links to searchPath() bare (no UUID), so clicking the 'Catalog' tab from inside a /search/{uuid} session creates a fresh session and orphans the prior UUID. The race is captured here under name_behavior_pairs.Catalog-tab.

- **Strengthens** batch-ZA SearchResults — this orchestrator is the PARENT of <Results/>. The batch-ZA sidecar documents the per-row side effects (view_count doubling case, infinite-scroll behaviour, DEG-create CTA gating). This Search.tsx sidecar adds the SESSION-LEVEL context: the searchId, the facet-sidebar, the text-query input, the auth/owner-scoping posture, and the route-mount story.

- **Strengthens** TermSearch batch-U sidecar — this is the CANONICAL/older twin (Search.tsx predates TermSearch.tsx per Git history; TermSearch is the clone). All 5 implicit ADRs, all 7 bug-shapes, all 6 perf gaps in batch-U Term have direct analogues here. The bugs propagated via clone. Architectural recommendation: fix BOTH files in one refactor — the broken debouncer is a single-PR cleanup if approached together.

- **Strengthens** REFACTOR-229 (FTS injection at JooqFTSHelper.tsQuery) — the UI-side complement to the backend canonical finding. The UI offers NO mitigation; this is now confirmed as a THIRD invocation site for the same architectural gap (batch H getHighlightedResult + batch ZE facet aggregators + batch ZL Search.tsx UI-side dispatch). The architectural fix point is unchanged (`JooqFTSHelper.tsQuery`), but the patch must consider whether client-side defense-in-depth is also warranted.

- **Strengthens** REFACTOR-425 (page-vs-count divergence family) — this UI is a downstream CONSUMER of the divergence. Results.tsx pagination trusts server-reported `total` (after computing hasNext client-side) but the underlying backend `hasNext: true` hard-code is a real contract bug for third-party API consumers. This is the UI-side surface where the REFACTOR-425 family manifests on the Discovery pillar.

- **Refutes (partially)** the prompt's LSN-017 hypothesis. The shape is NOT identical to the F-001 view_count case (no dep computed from the fetch RESPONSE that closes the loop). HOWEVER, three LSN-017-class dep-array conditions are present: (1) `searchId` read in condition but missing from useEffect deps at lines 37-42 (LATENT — masked by React batch ordering); (2) the deps-array IS correct at lines 44-48 (the COUNTER-EXAMPLE — included for cross-batch concept clarity); (3) `searchFacetsSynced` read in condition but missing from useEffect deps at lines 67-71 (POTENTIALLY ACTIVE — probe P-189 emitted). These are CLASS-MATCHES to LSN-017, not exact-pattern matches.

- **Refutes** the prompt's view_count exact-pattern hypothesis. The LSN-017 case is DataEntityDetails.tsx-specific (the response-derived dep `details.status?.status` closes the loop). Search.tsx has no response-derived dep in any useEffect; the failure mode is different (missing deps, not response-derived deps). The CLASS matches; the exact pattern does not.

- **No conflicts surfaced** with existing artefacts. No supersede notes needed. The pattern parity with TermSearch batch-U is EXPECTED (clone relationship) and explicitly reinforces both sidecars' findings.

Back-link emit summary: `related_features: [F-001, F-008]`, `related_pillar_features: [P-01:F-002]`, `related_retrospectives: [LSN-017, LSN-018, LSN-020, LSN-023]`. **Note: F-008 cross-ref is via REFACTOR-425 page-vs-count family — the Catalog page is one consumer of that REFACTOR-425 pattern.**

## sources

- understanding ← Search.tsx:1-92 + searchRoutes.ts:1-19 + App.tsx:34, 61 + Filters.tsx:1-77 + Results.tsx:1-178 + MainSearchInput.tsx:1-83 + useCreateSearch.ts:1-23 + dataentitiesSearch.thunks.ts:25-67 + dataEntitySearch.slice.ts:22-260 + dataentitySearch.selectors.ts:32-133 + batch-ZE SearchController class sidecar + WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search status 200 2026-05-20
- concepts.entities ← Search.tsx:18, 82 + dataEntitySearch.slice.ts:22-36 + searchRoutes.ts:1-19 + Filters.tsx:46-65 + Results.tsx:1-178 + MainSearchInput.tsx:1-83 + PageWithLeftSidebar (line 6, layout primitive)
- concepts.operations ← Search.tsx:37-71 + useCreateSearch.ts:13-19 + MainSearchInput.tsx:42-61 + Results.tsx:71-74 + dataentitiesSearch.thunks.ts:25-67
- concepts.invariants[0] (server-side URL-backed session) ← Search.tsx:37-48 + searchRoutes.ts:3-19 + App.tsx:61 + dataEntitySearch.slice.ts:22-36 + TermSearch batch-U sidecar invariants[0]
- concepts.invariants[1] (DEG-Create CTA gated; LIST + search + filters ungated) ← Search.tsx:81-85 + Results.tsx:125-138 + Results.tsx:151-159 (no permission wrap)
- concepts.invariants[2] (read-collaborative + no UI-level scoping) ← Search.tsx:74-87 + Results.tsx:151-159 + batch-ZE SearchController invariants + system-mission.md line 267
- concepts.invariants[3] (no URL backing for text-query) ← Search.tsx:37-48 + MainSearchInput.tsx:42-48 + dataEntitySearch.slice.ts:205-211 (`updateSearchQuery` reducer)
- concepts.invariants[4] (pageSize=30 hardcoded) ← Search.tsx:39 + Results.tsx:45
- concepts.invariants[5] (empty state lives in Results child) ← Results.tsx:161-165
- concepts.invariants[6] (search results from separate endpoint) ← dataentitiesSearch.thunks.ts:52-67 + Results.tsx:71-74 + batch-ZE SearchController invariants
- dependencies_semantic.requires-feature ← F-001.yaml + system-mission.md P-01 + WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search 2026-05-20 status 200 + batch-ZE sidecars
- dependencies_semantic.requires-config ← Search.tsx:39, 61 + Results.tsx:45 (hardcoded literals)
- dependencies_semantic.requires-runtime ← Search.tsx:1-22 (import block)
- dependencies_semantic.couples-to ← Filters.tsx:1-77 + Results.tsx:1-178 + MainSearchInput.tsx:1-83 + useCreateSearch.ts:1-23 + dataentitiesSearch.thunks.ts:25-67 + dataEntitySearch.slice.ts:1-260 + batch-ZE SearchController sidecar
- upstream_callers ← App.tsx:34, 61 + searchRoutes.ts:3-19 + ToolbarTabs.tsx:38 (batch ZH) + global top-nav `<MainSearchInput mainSearch={true}/>` indirect caller
- downstream_side_effects ← Search.tsx:37-71 + useCreateSearch.ts:13-19 + dataentitiesSearch.thunks.ts:25-67 + dataEntitySearch.slice.ts:40-260 + MainSearchInput.tsx:42-48 + Results.tsx:71-74
- implicit_adrs[0] (URL-backed session) ← Search.tsx:37-48 + searchRoutes.ts:3-19 + useCreateSearch.ts:16-18 + slice.ts:22-36 + F-010.yaml (housekeeping) + TermSearch batch-U sidecar
- implicit_adrs[1] (UI hide pattern) ← Search.tsx:81-85 + Results.tsx:125-138 + TermSearch batch-U sidecar implicit_adrs[1]
- implicit_adrs[2] (1500ms leading-edge debouncer; text-query excluded) ← Search.tsx:50-63 + MainSearchInput.tsx:50-61 + TermSearch batch-U sidecar implicit_adrs[2]
- implicit_adrs[3] (read-collaborative posture inherited) ← Search.tsx:74-87 + Results.tsx:151-159 + batch-ZE SearchController + system-mission.md line 267
- implicit_adrs[4] (pageSize=30 hardcoded twice) ← Search.tsx:39 + Results.tsx:45 + TermSearch batch-U sidecar implicit_adrs[4]
- implicit_adrs[5] (MainSearch two-mode design) ← Search.tsx:80 + MainSearchInput.tsx:17-21, 50-61
- bugs_limitations_corner_cases[0] (latent LSN-017 dep-array smell in createSearch effect) ← Search.tsx:37-42 + useCreateSearch.ts:13-19 + slice.ts:215
- bugs_limitations_corner_cases[1] (counter-example correct deps array at restore effect) ← Search.tsx:44-48
- bugs_limitations_corner_cases[2] (active LSN-017 dep-array smell in facet-sync effect) ← Search.tsx:67-71 + slice.ts:97 + P-189
- bugs_limitations_corner_cases[3] (broken debouncer — recreated on every render) ← Search.tsx:50-65 + TermSearch batch-U bugs[2] + P-189
- bugs_limitations_corner_cases[4] (no .catch on create-session) ← useCreateSearch.ts:14-19 + slice.ts:214-260 + TermSearch batch-U bugs[3]
- bugs_limitations_corner_cases[5] (facet/text-query race) ← Search.tsx:53-58 + MainSearchInput.tsx:42-48 + slice.ts:40-103 + TermSearch batch-U bugs[4]
- bugs_limitations_corner_cases[6] (session-expiry no recovery) ← Search.tsx:44-48 + F-010.yaml + TermSearch batch-U bugs[5]
- bugs_limitations_corner_cases[7] (FTS-injection UI-side blind spot + TRUE SQL injection at highlight path) ← Search.tsx:80 + MainSearchInput.tsx:42-48 + REFACTOR-229.md + batch-ZE SearchController invariants[7] + JooqFTSHelper.java:164-168 + ReactiveDataEntityRepositoryImpl.java:798-806 + P-188
- bugs_limitations_corner_cases[8] (cross-owner result set) ← Search.tsx:74-87 + Results.tsx:151-159 + REFACTOR-024 family + system-mission.md line 267
- bugs_limitations_corner_cases[9] (pagination total-vs-list divergence + backend hasNext=true contract bug) ← Search.tsx:79-86 + Results.tsx:71-74 + dataentitiesSearch.thunks.ts:62-63 + REFACTOR-425.md + batch-ZE SearchController invariants[7]
- bugs_limitations_corner_cases[10] (empty-state copy) ← Results.tsx:161-165 + WebFetch result + TermSearch batch-U bugs[8]
- bugs_limitations_corner_cases[11] (suggestions disabled blind spot) ← Search.tsx:80 + MainSearchInput.tsx:13, 75 + WebFetch result
- bugs_limitations_corner_cases[12] (i18n key brittleness) ← Search.tsx:80 + MainSearchInput.tsx:63, 71
- stress_findings.tunables ← Search.tsx:39, 61 + Results.tsx:45 + batch-ZE SearchController + P-189
- stress_findings.name_behavior_pairs ← useCreateSearch.ts:1-23 + Search.tsx:50-65, 80 + MainSearchInput.tsx:42-48 + ToolbarTabs.tsx:38 (batch ZH) + searchRoutes.ts:11
- stress_findings.orderings ← Results.tsx:71-74 + dataentitiesSearch.thunks.ts:52-67 + dataEntitySearch.slice.ts:219-228 + batch-ZE SearchController invariants
- stress_findings.auth_gates ← Search.tsx:1-92 + App.tsx:61 + batch-ZE SearchController invariants[1] + SecurityConstants.SECURITY_RULES + AuthorizationCustomizer.java:29-30 + P-187
- stress_findings.resource_boundaries ← Search.tsx:50-65, 67-71 + MainSearchInput.tsx:42-48 + slice.ts:40-103 + F-010.yaml
- stress_findings.request_inputs.searchId ← Search.tsx:27 + searchRoutes.ts:4-5 + V0_0_1__init.sql:204-211 + batch-ZE SearchController invariants[3] + F-010 + REFACTOR-344 + grep verification 2026-05-26 (no saved-search feature)
- stress_findings.request_inputs.query ← Search.tsx:39, 53-58 + MainSearchInput.tsx:38-44 + JooqFTSHelper.java:164-168 + ReactiveDataEntityRepositoryImpl.java:798-806 + batch-ZE invariants[7] + P-188
- stress_findings.request_inputs.filters ← Search.tsx:53-58 + dataentitiesSearch.thunks.ts:34-41 + batch-ZE SearchController.updateSearchFacets + FacetStateMapper
- stress_findings.request_inputs.myObjects ← Search.tsx:55 + SearchServiceImpl.java:106 + LSN-020 cross-link + USER_OWNER_MAPPING schema
- stress_findings.request_inputs.pageSize ← Search.tsx:39 + Results.tsx:45 + dataentitiesSearch.thunks.ts:52-67
- stress_findings.probes_emitted ← P-187 + P-188 + P-189 (this enrichment)
- docs_link_semantic ← Search.tsx (no @docs) + WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search 2026-05-20 status 200
- security.auth_mode_relevance ← Search.tsx:1-92 + App.tsx:61 (route mount under post-auth shell) + system-mission.md P-09 + P-187
- security.ingestion_filter_relevance ← Search.tsx (fetches /api/search/*, not /ingestion/*)
- security.authorization_assertions ← Search.tsx:81-85 + Results.tsx:125-138 + Results.tsx:151-159 (no permission wrap on result-list mapping) + batch-ZE SearchController invariants[1]
- security.owner_scoping ← Search.tsx:74-87 + Results.tsx:151-159 + batch-ZE SearchController owner_scoping + SearchServiceImpl.java:128-130 + system-mission.md line 267
- security.data_exposure ← Search.tsx:74-87 + Results.tsx:151-159 + URL `/search/{uuid}` shape + REFACTOR-344 + REFACTOR-229 + F-001 view_count cross-reference + batch-ZE TRUE-SQL-injection finding
- security.known_security_gaps[0] (read-collaborative posture) ← Search.tsx:74-87 + batch-ZE SearchController + REFACTOR-024
- security.known_security_gaps[1] (FTS injection at UI surface + TRUE SQL injection at highlight) ← Search.tsx:80 + MainSearchInput.tsx:42-48 + REFACTOR-229.md + batch-ZE SearchController invariants[7] + JooqFTSHelper.java:164-168 + ReactiveDataEntityRepositoryImpl.java:798-806 + P-188
- security.known_security_gaps[2] (session UUID bearer-token-shape) ← Search.tsx:44-48 + REFACTOR-344 + stress_findings.request_inputs.searchId
- security.known_security_gaps[3] (session-expiry silent) ← Search.tsx:44-48 + F-010.yaml
- security.known_security_gaps[4] (unhandled-rejection silent failure) ← useCreateSearch.ts:14-19 + slice.ts:214-260
- security.known_security_gaps[5] (DEG-create backend bypass) ← Results.tsx:125-138
- security.known_security_gaps[6] (cross-owner data exposure family) ← Search.tsx:74-87 + REFACTOR-024 + system-mission.md line 267
- security.known_security_gaps[7] (anonymous reach under DISABLED) ← P-187 + App.tsx:61 + batch-ZE SearchController invariants[1] + SecurityConstants.SECURITY_RULES
- performance.hot_paths ← Search.tsx:37-71 + useCreateSearch.ts:13-19 + Results.tsx:71-74 + dataentitiesSearch.thunks.ts:25-67 + batch-ZE SearchController performance section + P-189
- performance.throughput_characteristics ← Search.tsx:50-71 + MainSearchInput.tsx:42-48 + Results.tsx:71-74
- performance.resource_allocation ← Search.tsx:56 (mapValues per dispatch) + slice.ts:22-36 (state shape) + dataentitySearch.selectors.ts:129-133
- performance.scaling_characteristics ← Search.tsx:1-92 + slice.ts:40-103 + App.tsx:60-65 (route mount)
- performance.known_performance_gaps[0] (broken debouncer) ← Search.tsx:50-65 + TermSearch batch-U + P-189
- performance.known_performance_gaps[1] (re-fire storm on selector instability) ← Search.tsx:67-71 + slice.ts:97 + LSN-017 + P-189
- performance.known_performance_gaps[2] (catalog-wide COUNT every mount) ← Search.tsx:37-42 + batch-ZE SearchController performance
- performance.known_performance_gaps[3] (empty-state UX) ← Results.tsx:161-165

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero existing UI-side unit tests for Search.tsx verified via Glob; Playwright spec presence verified via batch-ZE SearchController test_files block)
- docs_link_semantic: HIGH (live WebFetch of https://docs.opendatadiscovery.org/features/data-discovery/search in this session, status 200; live page directly confirms 7-facet enumeration matching Filters.tsx)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (P-187 emitted to confirm the anonymous-reach hypothesis; the other security gaps are STATIC-INFERRED with strong code evidence)
- performance: MEDIUM (the broken-debouncer + re-fire-storm claims are reasoned from static reading + slice source + cross-batch parity with TermSearch batch-U findings; P-189 emitted to confirm dispatch cardinality per facet click — currently PROBE-NEEDED)
- upstream_callers: HIGH (App.tsx:61 + ToolbarTabs.tsx:38 + global MainSearchInput verified statically; deep-link arrival is the inferred external trigger)
- downstream_side_effects: HIGH (every effect anchored at file:line; the Results-child reference is honestly flagged unresolved=true)
- stress_findings: MEDIUM (52 questions across 13 triggers; 45 STATIC-INFERRED + 5 PROBE-NEEDED + 2 REFERENCE; the load-bearing claims at name_behavior_pairs.updateSearchFacets, auth_gates, request_inputs.query are MEDIUM until probes P-187/P-188/P-189 resolve; the request_inputs.searchId drift is HIGH STATIC-INFERRED — code-evidence and grep-verification done in this enrichment)

## Maintainer notes

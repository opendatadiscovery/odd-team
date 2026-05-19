---
node_id: "odd-platform ts react-component component:DataEntityDetails"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-J-DataEntityDetails-tsx
schema_version: v0.3.0
---

# DataEntityDetails — semantic understanding

## understanding

`DataEntityDetails` is the **top-level React component for the per-entity detail page** — every navigation to `/dataentities/{id}/*` mounts this single component, which orchestrates the data-fetch lifecycle, renders the persistent shell (header + tabs strip + content slot via nested `<Routes>`), and gates child components on a `WithPermissionsProvider` permissions context. It is **hop 1 of feature flow P-01:F-001 Popular Entities Ranking**: the component contains the LSN-017 root-cause bug — the `useEffect` at lines 56-64 lists `details.status?.status` (a value derived from the fetch response) in its dependency array, so the effect fires once on mount (`details.status` undefined → fetch dispatched → +1 view_count), then re-fires when the response lands and the status changes from `undefined` to its final value (→ second fetch dispatched → +1 view_count), producing **two GET requests per logical page-open** (empirically confirmed by probe P-004, run R-20260519T010758Z-P-004). A second `useEffect` at lines 66-76 issues 4 additional dispatches per mount (alerts count, DQ test report, SLA report, resource permissions) — each is a single fetch correctly keyed on `dataEntityId` alone.

## concepts

- entities: [
    "`DataEntityDetails` payload — the 34-field response from `GET /api/dataentities/{id}` (per the `DataEntityDetails` TypeScript type imported from `generated-sources` via `dataentities.thunks.ts:17`); the component reads `id`, `internalName`, `externalName`, `entityClasses`, `type`, `manuallyCreated`, `lastIngestedAt`, `isStale`, `status` from it (`DataEntityDetails.tsx:90-99`)",
    "Redux store slice `dataEntities.byId[id]` (per `dataentities.slice.ts:97-99` reducer that handles `fetchDataEntityDetails.fulfilled`) — the source the component reads via `getDataEntityDetails(id)` selector (`dataentity.selectors.ts:93-97`)",
    "fetching status sub-state — `isLoading` / `isNotLoaded` flags surfaced via `getDataEntityDetailsFetchingStatuses` (`dataentity.selectors.ts:159`); error envelope via `getDataEntityDetailsFetchingError` (`dataentity.selectors.ts:162`)",
    "permission context — `resourcePermissions` for the `DATA_ENTITY` resource type, keyed on `dataEntityId` (`DataEntityDetails.tsx:35-37`), filtered against three permissions: `DATA_ENTITY_INTERNAL_NAME_UPDATE`, `DATA_ENTITY_GROUP_UPDATE`, `DATA_ENTITY_STATUS_UPDATE` (`DataEntityDetails.tsx:84-86`)",
    "route param `dataEntityId` — extracted from `useDataEntityRouteParams()` (`routes/dataEntitiesRoutes.ts:47-58`); the raw string from React Router is parsed via `parseInt(dataEntityId, 10)` (`dataEntitiesRoutes.ts:53`)",
    "group-membership flags — `isDataEntityGroupUpdated`, `isDataEntityAddedToGroup`, `isDataEntityDeletedFromGroup` (`DataEntityDetails.tsx:39-54`) — three independent Redux statuses signalling DEG-membership mutations elsewhere in the app should re-fetch this page's details"
  ]
- operations: [
    "extract `dataEntityId` from URL params via `useDataEntityRouteParams()` (line 32)",
    "subscribe to `details`, `resourcePermissions`, and three group-status flags + fetch-status + error from Redux (lines 34-54)",
    "on mount + on each dep-array change, dispatch `fetchDataEntityDetails({ dataEntityId })` (lines 56-64) — the LSN-017 bug locus",
    "on mount only, dispatch four parallel data fetches: `fetchDataEntityAlertsCounts({ dataEntityId, status: OPEN })`, `fetchDataSetQualityTestReport({ dataEntityId })`, `fetchDataSetQualitySLAReport({ dataEntityId })`, `fetchResourcePermissions({ resourceId: dataEntityId, permissionResourceType: DATA_ENTITY })` (lines 66-76)",
    "render `DataEntityDetailsHeader` inside a `WithPermissionsProvider` only when `details.id` is set AND `isDataEntityDetailsFetching` is false (lines 80-102)",
    "render the persistent `DataEntityDetailsTabs` strip below the header (lines 103-105)",
    "render `DataEntityDetailsRoutes` (the nested `<Routes>` switcher across 13 sub-routes including Overview / Structure / Lineage / Alerts / History / Activity / Discussions / etc., per `DataEntityDetailsRoutes.tsx:42-150`) — always, regardless of fetching state (line 115)",
    "render `DataEntityDetailsSkeleton` while fetching (lines 108-114)",
    "render `AppErrorPage` when `isDataEntityDetailsNotFetched` is true (lines 116-119)"
  ]
- invariants: [
    "The component never directly fetches data — every read goes through `dispatch(...)` of a Redux thunk; the Redux slice owns the deduplication / status / cache lifecycle",
    "Mounting the component triggers exactly 5 distinct thunk dispatches in the steady state: 1 × `fetchDataEntityDetails` (which the LSN-017 bug duplicates to 2), and 1 each of alert-counts / DQ-test-report / SLA-report / resource-permissions",
    "The 5-element dep-array (line 58-64) on the details fetch contains 4 stable values (`dataEntityId`, plus three group-status flags) AND 1 derived value (`details.status?.status`) — only the last is response-derived; the other four legitimately re-fetch when DEG membership changes",
    "Skeleton, content, and error UI are exclusive but the routes outlet (`<DataEntityDetailsRoutes />`) renders unconditionally (line 115) — child route components must handle the loading state themselves",
    "`DataEntityDetailsRoutes` is a sibling, not a child, of the header+tabs render — so child route components share the same `details` Redux state as this parent component via their own `useAppSelector(getDataEntityDetails(dataEntityId))` calls (verified in `DataEntityDetailsTabs.tsx:37`)"
  ]
- audiences: [
    "ODD Platform UI end-user — every entity-detail page navigation lands on this component (the only entry point for `/dataentities/:id/*` routes per the app router; the component renders 13 distinct sub-tabs)",
    "Redux store (downstream side-effect consumers — owners.slice, metadata.slice, dataentities.slice all `addCase` against `fetchDataEntityDetails.fulfilled`)"
  ]

## upstream_callers

**Schema v0.3.0 — who triggers this component / what entry path mounts it.**

- `react-router-dom <Route>` registrations in the application's top-level router → the `/dataentities/:dataEntityId/*` route mounts this component (per the SPA's `<BrowserRouter>` configuration; the route base path is `/dataentities` per `routes/dataEntitiesRoutes.ts:4`). Every internal link constructed via `dataEntityDetailsPath(id, path)` (`routes/dataEntitiesRoutes.ts:66-73`) navigates here. — confidence: HIGH (verified — `useDataEntityRouteParams()` requires the route to provide `:dataEntityId` per `routes/dataEntitiesRoutes.ts:47-58`).
- Direct deep-link navigation from external sources (browser bookmarks, Slack alert links, GenAI suggestions, email notifications) — the operator-facing landing page for any `oddrn` lookup that resolves to a numeric data entity id; the platform's primary URL-shareable surface.
- Internal navigation from within the UI: Search results (`/search`), Catalog Overview's Popular / My Objects / Upstream / Downstream tiles, Directory leaves, Lineage graph node clicks (`Lineage.tsx`), Alert list rows (`Alerts.tsx`), DEG member list, Activity feed entity references, Query Examples linked datasets, Term linked entities — each of these surfaces uses `dataEntityDetailsPath(id)` to construct a navigable link (`routes/dataEntitiesRoutes.ts:66-73` is the path-builder).

## downstream_side_effects

**Schema v0.3.0 — what this component's lifecycle actually causes when mounted.**

- **5 Redux thunk dispatches per mount, BUT 6 backend HTTP requests per mount** due to the LSN-017 bug — confidence: HIGH (empirically confirmed by P-004; per-call delta confirmed by P-001):
  - 2 × `dispatch(fetchDataEntityDetails({ dataEntityId }))` — the LSN-017 doubling. Each dispatch issues `GET /api/dataentities/{id}` (`dataentities.thunks.ts:35-42`), backend per-call side effect is `UPDATE data_entity SET view_count = view_count + 1` (`ReactiveDataEntityRepositoryImpl.java:173-180` via `DataEntityServiceImpl.getDetails` @ReactiveTransactional at line 197).
  - 1 × `dispatch(fetchDataEntityAlertsCounts({ dataEntityId, status: AlertStatus.OPEN }))` (line 67) — issues `GET /api/dataentities/{id}/alerts/counts?status=OPEN`.
  - 1 × `dispatch(fetchDataSetQualityTestReport({ dataEntityId }))` (line 68) — issues `GET /api/dataentities/{id}/quality/test_report` (dataset-only endpoint).
  - 1 × `dispatch(fetchDataSetQualitySLAReport({ dataEntityId }))` (line 69) — issues `GET /api/dataentities/{id}/quality/sla`.
  - 1 × `dispatch(fetchResourcePermissions({ resourceId: dataEntityId, permissionResourceType: DATA_ENTITY }))` (lines 70-75) — issues `GET /api/permissions/resource/...`.
- **Backend `view_count` mutation per mount: +2 (LSN-017 bug locus)** — empirically pinned by probe P-004 at run R-20260519T010758Z-P-004 (xhr_count=2 + DB delta=2; regex-filtered to exact `/api/dataentities/1004` path) — confidence: HIGH (MEASURED, not inferred).
- **Redux store mutations on response landing**:
  - `dataentities.slice.ts:97-99` — `byId[id]` populated with the full `DataEntityDetails` payload (every field of the 34-field response).
  - `owners.slice.ts:53` — owner records extracted from the response and merged into the owners slice.
  - `metadata.slice.ts:18` — metadata field values merged into the metadata slice.
- **Re-fetch triggers (the dep-array contents at lines 58-64)** — confidence: HIGH (the 5 deps are the legal re-fetch triggers; only the 5th is the bug):
  - `dataEntityId` change → legitimate (navigating between entities).
  - `isDataEntityGroupUpdated` change → legitimate (user updated DEG metadata elsewhere; re-fetch to pick up changed group membership in the response).
  - `isDataEntityAddedToGroup` change → legitimate (entity was just added to a DEG via the DEG edit form; re-fetch to surface the new group in `dataEntityGroups[]`).
  - `isDataEntityDeletedFromGroup` change → legitimate (entity was removed from a DEG; re-fetch to drop the group).
  - `details.status?.status` change → **the LSN-017 bug**. The value is sourced from the previous fetch's response (the same Redux slice the dep-array reads from), so the first fetch returning a defined status flips the dep-array, triggering a second identical fetch. Once the second fetch lands, the value is unchanged so the cycle quiesces at +2.
- **Render-time UI render of**:
  - `DataEntityDetailsHeader` (with 9 props passed: dataEntityId, internalName, externalName, entityClasses, type, manuallyCreated, lastIngestedAt, isStale, status).
  - `DataEntityDetailsTabs` (no props; reads from Redux directly).
  - `DataEntityDetailsRoutes` (lazy-loaded 13-child-route switcher).

## dependencies_semantic

- requires-feature: [
    "Data Discovery — live page `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, WebFetched 2026-05-19) describes the per-entity Overview tab as 'the landing tab inside any data entity's detail page' — the doc framing covers the existence of this surface but is silent on the view-count side-effect, the 2-fetch doubling, or the read-collaborative posture",
    "the F-001 Popular Entities Ranking feature — this component is the **producer** of the `view_count` signal that the Popular tile on Catalog Overview consumes (per `documentation/docs/data-discovery/catalog-overview.md:50`: 'Popular — the most-viewed or most-used data entities across the catalog')",
    "the 13 sub-tab surfaces reachable from the routes outlet: Overview / Structure (datasets only) / Lineage / Test reports (datasets only) / History (transformers + QA tests only) / Alerts / Linked entities / Activity / Discussions / Query examples / Data / Relationships (per `DataEntityDetailsRoutes.tsx:42-150` and `DataEntityDetailsTabs.tsx:45-...`)"
  ]
- requires-config: [] — N/A. The component reads no runtime config keys; behaviour is entirely fixed at compile time.
- requires-runtime: [
    "React 18 / `useEffect` semantics — the bug depends on React's behaviour of comparing dep-array items via `Object.is` between renders; when a deeply-equal-but-fresh response object replaces the prior `emptyObj` in Redux, `details.status?.status` flips from `undefined` to a concrete enum value, satisfying React's change detection",
    "Redux Toolkit `createAsyncThunk` with `handleResponseAsyncThunk` wrapper (`redux/lib/handleResponseThunk`) — provides the `.fulfilled` action type that the slice reducer matches on",
    "react-router-dom v6 `useParams` + `useDataEntityRouteParams()` helper at `routes/dataEntitiesRoutes.ts:47-58` — extracts `:dataEntityId` from the URL and parses it as a base-10 integer (no NaN guard; an invalid route param yields `NaN` which then passes through every selector and the API call as a literal `'NaN'`)",
    "the generated `DataEntityApi` client (`generated-sources`) — the actual transport for `GET /api/dataentities/{id}`",
    "Material-UI `Grid` — single layout primitive used at line 103",
    "Vitest as the project's test runner (per `odd-platform-ui/package.json:10`: `\"test\": \"vitest\"`)"
  ]
- couples-to: [
    "`fetchDataEntityDetails` thunk (`redux/thunks/dataentities.thunks.ts:35-42`) — wraps `dataEntityApi.getDataEntityDetails({ dataEntityId })`; the LSN-017 bug fires it twice per mount",
    "`fetchDataEntityAlertsCounts`, `fetchDataSetQualityTestReport`, `fetchDataSetQualitySLAReport`, `fetchResourcePermissions` thunks (all imported from `redux/thunks` per `DataEntityDetails.tsx:4-10`)",
    "`getDataEntityDetails` selector (`redux/selectors/dataentity.selectors.ts:93-97`) — falls back to `emptyObj` when the entry is missing, so `details.id` is `undefined` on first render (gating line 80's render)",
    "`getDataEntityDetailsFetchingStatuses` + `getDataEntityDetailsFetchingError` selectors (`dataentity.selectors.ts:159-164`) — surface the fetch-lifecycle state to drive Skeleton / Error UI",
    "`getResourcePermissions` selector (used to populate `WithPermissionsProvider`)",
    "`getDataEntityAddToGroupStatuses`, `getDataEntityDeleteFromGroupStatuses`, `getDataEntityGroupUpdatingStatuses` selectors (`DataEntityDetails.tsx:39-54`) — DEG-membership lifecycle flags that legitimately trigger re-fetch",
    "`useDataEntityRouteParams` (`routes/dataEntitiesRoutes.ts:47-58`)",
    "`DataEntityDetailsHeader` child (`./DataEntityDetailsHeader/DataEntityDetailsHeader.tsx`)",
    "`DataEntityDetailsTabs` child (`./DataEntityDetailsTabs/DataEntityDetailsTabs.tsx:27-...`) — reads same details via `getDataEntityDetails(dataEntityId)` independently",
    "`DataEntityDetailsRoutes` child (`./DataEntityDetailsRoutes/DataEntityDetailsRoutes.tsx:32-156`) — owns the 13-sub-route switcher",
    "`DataEntityDetailsSkeleton`, `AppErrorPage`, `SkeletonWrapper`, `WithPermissionsProvider` (shared elements)",
    "Backend endpoint `GET /api/dataentities/{id}` (the hop-3 controller method `DataEntityController.getDataEntityDetails` per neighbour sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md` — backend per-call delta +1 view_count is empirically confirmed by P-001)"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — confidence: HIGH. **The component has ZERO direct test coverage.** Verified by `Glob odd-platform-ui/**/*.test.*` (no results), `Glob odd-platform-ui/**/*.spec.*` (no results), `Glob odd-platform-ui/**/__tests__/**` (no results), `Grep DataEntityDetails` across `.test.*` files (no results). The repo has Vitest configured (`odd-platform-ui/package.json:10` `"test": "vitest"`, `package.json:136` `"vitest": "^4.0.17"`) but ZERO test files exist for the UI codebase as of the enriched commit `ede5d277`.
- uncovered_behaviours:
  - behaviour: "useEffect dispatches `fetchDataEntityDetails` exactly once per mount (regression-pin for LSN-017 fix)"
    test_class: integration
    upstream_callers: "react-testing-library `render()` mounting `<DataEntityDetails />` inside a `<MemoryRouter>` with `:dataEntityId` set"
    downstream_side_effects: "should observe exactly 1 dispatch of `fetchDataEntityDetails` action type on `mockStore`; after the fulfilled action lands and updates `details.status?.status`, should observe NO additional dispatch (current bug behaviour: observes 2 dispatches)"
    confidence: HIGH
  - behaviour: "useEffect re-fires correctly when `dataEntityId` changes (URL navigation between two entities)"
    test_class: integration
    upstream_callers: "react-testing-library — rerender with a different `:dataEntityId` route param"
    downstream_side_effects: "should dispatch `fetchDataEntityDetails` once for entity A, then once for entity B; total = 2 dispatches across the 2 mounts in the bug-free version (LSN-017 = 4)"
    confidence: HIGH
  - behaviour: "useEffect re-fires when `isDataEntityGroupUpdated` / `isDataEntityAddedToGroup` / `isDataEntityDeletedFromGroup` flips — the legitimate dep-array entries"
    test_class: integration
    upstream_callers: "react-testing-library — dispatch a mock `updateDataEntityGroup.fulfilled` / `addDataEntityToGroup.fulfilled` / `deleteDataEntityFromGroup.fulfilled` while the component is mounted"
    downstream_side_effects: "should observe an additional `fetchDataEntityDetails` dispatch per legitimate trigger (the assertion proves the dep-array CORRECTLY catches DEG mutations — distinct from the LSN-017 bug entry)"
    confidence: HIGH
  - behaviour: "second useEffect (mount-only, lines 66-76) dispatches the 4 ancillary fetches exactly once per mount, NOT re-firing on details-fetch-completion"
    test_class: integration
    upstream_callers: "react-testing-library — render component, wait for `fetchDataEntityDetails.fulfilled` to land in mock store"
    downstream_side_effects: "should observe alerts-counts / DQ-test-report / SLA-report / resource-permissions each dispatched exactly 1× (the second useEffect's dep-array is just `[dataEntityId]` so it does NOT have the LSN-017 issue; this assertion locks down that property)"
    confidence: HIGH
  - behaviour: "renders `DataEntityDetailsSkeleton` while `isDataEntityDetailsFetching` is true and not yet `details.id`"
    test_class: integration
    upstream_callers: "react-testing-library — render with mock store state `{ statuses: { fetchDataEntityDetails: { isLoading: true } }, byId: {} }`"
    downstream_side_effects: "should render the `<DataEntityDetailsSkeleton />` DOM tree; should NOT render `<DataEntityDetailsHeader />`"
    confidence: HIGH
  - behaviour: "renders `AppErrorPage` when `isDataEntityDetailsNotFetched` is true with the error envelope"
    test_class: integration
    upstream_callers: "react-testing-library — render with mock store state `{ statuses: { fetchDataEntityDetails: { isNotLoaded: true, isLoading: false } }, errors: { fetchDataEntityDetails: { ... } } }`"
    downstream_side_effects: "should render `<AppErrorPage showError={true} error={...} />`; the error component handles 404/403/500 paths internally"
    confidence: HIGH
  - behaviour: "DataEntityDetailsRoutes renders independent of fetching state (line 115 is unconditional)"
    test_class: integration
    upstream_callers: "react-testing-library — mount with `isLoading=true` AND `byId={}`"
    downstream_side_effects: "should observe `<DataEntityDetailsRoutes />` mounted regardless of the surrounding skeleton/content state (child route components are responsible for their own loading UI)"
    confidence: HIGH
  - behaviour: "WithPermissionsProvider gates the header on the 3 permissions: DATA_ENTITY_INTERNAL_NAME_UPDATE / DATA_ENTITY_GROUP_UPDATE / DATA_ENTITY_STATUS_UPDATE"
    test_class: integration
    upstream_callers: "react-testing-library — mount with mock store containing each permission missing / present"
    downstream_side_effects: "should render the header in all cases (the provider gates child mutation affordances, not header presence) — but the assertion proves the permissions vector is passed correctly to the provider"
    confidence: MEDIUM (the precise gating behaviour lives inside WithPermissionsProvider, not this component)
  - behaviour: "invalid route param `:dataEntityId='abc'` yields `NaN` and the component dispatches `fetchDataEntityDetails({ dataEntityId: NaN })`"
    test_class: integration
    upstream_callers: "react-testing-library — mount under `<MemoryRouter initialEntries={['/dataentities/abc/overview']}>`"
    downstream_side_effects: "should observe the network call with `NaN` in the URL — the API client likely 404s but the component has no client-side validation guard; the assertion documents the gap"
    confidence: HIGH (the absence-of-validation is the finding; the test would document it)
  - behaviour: "Playwright end-to-end probe — opening a real running platform's detail page registers EXACTLY +1 view_count (regression-pin for LSN-017 fix)"
    test_class: integration
    upstream_callers: "Playwright spec equivalent to probe P-004 (`lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml`)"
    downstream_side_effects: "should observe `xhr_count=1` (regex-filtered to exact `/api/dataentities/{id}` path) AND DB `view_count` delta = 1 across a single page-open; the current PINNING-BUG state observes 2"
    confidence: HIGH (this is the P-004 probe re-purposed as the regression-pin; the assertion flips from 2 → 1 on fix)
- test_files: [] — N/A. **No test files exist that exercise this component.** Confirmed by exhaustive Glob across the `odd-platform-ui` tree.
- gaps: |
    The component has the highest-leverage UI bug in the platform's hottest user-facing flow (LSN-017 +2 view_count doubling, empirically pinned by P-004) and ZERO test coverage. The fix (remove `details.status?.status` from the dep-array — line 63) is a 1-line code change but a regression-prone refactor: another contributor adding a "re-fetch when status changes" bug later would silently restore the LSN-017 behaviour. The single most valuable test is a Vitest + react-testing-library suite asserting "exactly 1 fetchDataEntityDetails dispatch per mount + per dataEntityId/group-flag change, NEVER on details.status change". The unit-test gap is comprehensive: 10 distinct behaviours uncovered, none with a corresponding test. Layering: (a) Vitest component tests for the dispatch-count invariants; (b) Playwright end-to-end probe (P-004 already exists as a one-shot probe-run; promoting it to a CI-permanent Playwright spec turns it into a regression-pin); (c) Vitest assertion for the skeleton/error/content render-state machine. The 13-sub-route routing logic in `DataEntityDetailsRoutes.tsx` also has no test coverage but is out-of-scope for THIS node (covered by a future sidecar on `DataEntityDetailsRoutes`).

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the component file or its imports.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "Sole live page that describes the per-entity detail page surface — the 'Overview tab' framing in the Catalog Overview vs entity Overview tab disambiguation block; also the documented destination of the Popular tile that consumes the view_count this component mutates."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim (WebFetched 2026-05-19): "**4. Popular** — \"the most-viewed or most-used data entities across the catalog.\""
      Verbatim (from local clone `documentation/docs/data-discovery/catalog-overview.md:67`, mirrored to the live page): "The per-entity **Overview tab** is the landing tab inside any data entity's detail page — entity description, owners, tags, terms, custom metadata."
      The page **does not** describe the view-count side-effect, the +2 per page-open doubling (LSN-017), the read-collaborative posture, the soft-delete-still-returned behaviour, or the 13 sub-tabs reachable from this component's nested routes.
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Pillar P-01 landing page — establishes Catalog / Search / Directory as the three entry paths that drive clicks into this component."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-19: the page covers the Data Discovery pillar and its sub-features (Catalog Overview, Directory, Search and Filtering, tagging, groups, statuses, attachments, schema diff, metadata stale) but **does not describe the entity detail page**, **does not describe any view-count or view-tracking behaviour**, and **does not describe per-entity authorization rules**.
- doc_drift_findings:
  - "**The view-count side-effect of opening the detail page is undocumented end-to-end.** Live docs (`/features/data-discovery/catalog-overview`) describe the Popular tile as 'the most-viewed or most-used data entities' but never describe the mechanism (UI page-mount fires `GET /api/dataentities/{id}` → backend `UPDATE view_count`) NOR the LSN-017 bug (2 fetches per page-open). Operators tuning Popular ranking or auditing read-only access paths have no published signal that opening a detail page mutates state. F-001 feature flow + P-004 probe-run prove the behaviour empirically."
  - "**LSN-017 is undocumented in the public docs.** The bug (`details.status?.status` in the dep-array causes 2 fetches per mount, doubling view_count) is captured in `retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md` and proven by probe P-004 (run R-20260519T010758Z-P-004) — but the live docs do not warn operators that the Popular ranking is currently 2× sensitive to detail-page navigation. This is acceptable for an internal retro but is a doc-gap candidate (DOC-GAP-085 already tracks; the regression-pin is the P-004 probe)."
  - "**The 13-sub-tab UI taxonomy is partially documented.** Live `/features/data-discovery/catalog-overview` confirms 'Overview tab is the landing tab' — but the other 12 sub-tabs (Structure, Lineage, Test reports, History, Alerts, Linked entities, Activity, Discussions, Query examples, Data, Relationships) are documented one-per-feature-page rather than as the per-entity navigation taxonomy. A reader landing on the detail page has no doc-side map of what tabs they can expect to see based on entity class (DEG vs Dataset vs Transformer vs Quality test)."

## implicit_adrs

- "**The component owns the data-fetch lifecycle, not the route shell or a feature provider.** The decision is to colocate fetching at the page-component layer rather than (a) at a route loader (`react-router-dom@6` supports `loader` functions but the project does not use them), (b) at an outer `<DataEntityProvider>` context, or (c) at the child Overview tab. The pattern is consistent across the platform's other detail pages." — evidence: DataEntityDetails.tsx:56-76 (two useEffects co-located in the top page component) — intent_anchor: "the structural pattern of `useEffect → dispatch(...)` at the page-component layer applied consistently across `/dataentities/:id/*`" — confidence: HIGH
- "**Skeleton + content + error are exclusive renders, but the routes outlet renders unconditionally.** The render block (lines 78-120) makes header+tabs visible only when content is ready (line 80 `details.id && !isDataEntityDetailsFetching`), but `DataEntityDetailsRoutes` always renders (line 115). The decision is that child route components handle their own loading state independently — a deliberate choice to let route-level lazy-loading + each child's own selectors drive UI rather than gating everything on the parent's fetch lifecycle." — evidence: DataEntityDetails.tsx:78-120 (the conditional vs unconditional split) — intent_anchor: "the unconditional `<DataEntityDetailsRoutes />` at line 115, parallel to the conditional header+tabs at lines 80-106" — confidence: HIGH
- "**Permissions are passed via context, not via props.** The header is wrapped in `WithPermissionsProvider` carrying 3 allowedPermissions + the `resourcePermissions` selector result (lines 82-87). The decision is to use React Context (provider/consumer) rather than prop-drilling permission checks through the header → action buttons chain." — evidence: DataEntityDetails.tsx:82-102 (WithPermissionsProvider wraps the header render) — intent_anchor: "the `WithPermissionsProvider` wrapper as the consistent permission-gating primitive across pages" — confidence: HIGH

## bugs_limitations_corner_cases

- "**LSN-017 — `details.status?.status` in the useEffect dep-array causes 2 fetches per page-open, doubling backend view_count delta to +2.** The 5th dep-array element (line 63) is derived from the fetch response — once the first fetch lands and Redux populates `details.status`, the dep-array shifts from `[id, false, false, false, undefined]` to `[id, false, false, false, 'STABLE']` (or whichever enum value), triggering a second identical fetch. The second fetch returns the same status, the cycle quiesces at exactly +2. **Empirically pinned by probe P-004** (run R-20260519T010758Z-P-004 — xhr_count=2 + DB delta=2 with regex-filtered exact path match). **Fix is 1 line**: remove `details.status?.status` from the dep-array (line 63). Operationally consequential because: (a) Popular ranking signal is doubled vs intent; (b) inflation attacks are 2× cheaper; (c) cross-pillar bug — UI-side cause, backend-side observable; no per-layer scan would have caught it. **The dep-array CORRECTLY catches DEG-membership changes** via the 3 group-status flags (lines 60-62) — the bug is specifically that ONE of the 5 deps is response-derived rather than externally-driven." — evidence: DataEntityDetails.tsx:56-64 (the dep-array) + DataEntityDetails.tsx:34 (the `details` source via `getDataEntityDetails(dataEntityId)`) + retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml — severity: HIGH
- "**Invalid route param `:dataEntityId` yields `NaN` with no client-side guard.** `useDataEntityRouteParams()` at `routes/dataEntitiesRoutes.ts:47-58` calls `parseInt(dataEntityId, 10)` with no `Number.isNaN` check — if the route param is `'abc'` (manually-typed bad URL, mis-encoded query string, etc.), the component proceeds to dispatch `fetchDataEntityDetails({ dataEntityId: NaN })` which travels through the API client to the backend as the literal string `'NaN'`. The backend likely 404s but no UI-side error is emitted at the source of the mistake. A simple `if (!Number.isFinite(dataEntityId)) return <NotFoundPage />` guard at the top of the component would surface the error at the right layer." — evidence: routes/dataEntitiesRoutes.ts:53 (`parseInt(dataEntityId, 10)` no NaN guard) + DataEntityDetails.tsx:32 (consumes the parsed value directly) + DataEntityDetails.tsx:57 (dispatches without validation) — severity: LOW
- "**No abort/cleanup on the useEffect — rapid URL navigation between entities issues overlapping fetches with no cancellation.** When the user rapidly navigates A → B → C → D, the component triggers 5 thunk dispatches per transition (or 6 with the LSN-017 bug). If a slow A-fetch resolves AFTER the user has navigated to D, the slice reducer for `fetchDataEntityDetails.fulfilled` STILL applies (`dataentities.slice.ts:97-99`) — but `byId[A]` is updated, not `byId[D]`. The store remains consistent (each fetch keyed by id), but the network bandwidth and DB increment are wasted, and the component does no AbortController plumbing. Per-mount-only the second useEffect cannot leak side-effects this way because each fetch targets a different id; the first useEffect's bug compounds with rapid nav." — evidence: DataEntityDetails.tsx:56-76 (no cleanup function returned from either useEffect; no AbortController passed through) + dataentities.thunks.ts:35-42 (the thunk wrapper does not accept a signal) — severity: LOW
- "**The component does not surface backend permission errors to the user.** The fetch lifecycle status surfaces `isNotLoaded` + `isLoading` only — `AppErrorPage` (line 116) consumes whatever the slice stored in `errors`. If the backend ever adds per-entity authorization (currently absent per backend-side sidecar's read-collaborative posture), this component would receive a 403 indistinguishable from a 404 at the UI layer because both manifest as `isNotLoaded`. The `error` envelope has the response-status info but `AppErrorPage`'s rendering is generic. A retrofitted auth gate would need UI changes to discriminate 403 / 404 / 500." — evidence: DataEntityDetails.tsx:116-119 (AppErrorPage receives `error` but the component does no status-specific branching) — severity: LOW (forward-looking; gap surfaces if authz lands)
- "**Skeleton-flicker on legitimate re-fetch.** When `isDataEntityGroupUpdated` (or sibling group flag) flips, the useEffect dispatches a fresh `fetchDataEntityDetails` — which sets `isDataEntityDetailsFetching=true` in the slice, hiding the header+tabs and showing the skeleton (line 80's check fails on the `!isDataEntityDetailsFetching` branch). The user briefly loses the page chrome on what should be a transparent refresh. A pattern using `isFetching && !details.id` (skeleton only on first load) vs `isFetching && details.id` (in-place refresh, no skeleton) would smooth the experience." — evidence: DataEntityDetails.tsx:80 (the render gate predicates on BOTH `details.id` AND `!isDataEntityDetailsFetching` — so any refetch hides the chrome until it lands) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a UI component running in the user's browser; it does not directly enforce auth modes. However, every backend call it triggers (`GET /api/dataentities/{id}` and the 4 sibling ancillary fetches) inherits the platform's auth posture per neighbour sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md`: LOGIN_FORM / OAUTH2 / LDAP require authentication; DISABLED admits anonymous callers; S2S `N/A` (UI surface, not ingestion). Under `auth.type=DISABLED`, opening this page anonymously triggers the +2 view_count side-effect with no audit trail (probe P-002 empirically proven, run R-20260519T003811Z-P-002).
- **ingestion_filter_relevance**: `NO — UI/API surface on /api/dataentities/{id}, not /ingestion/entities`.
- **authorization_assertions**: [] — the component itself enforces no authorization. It passes a 3-permission vector (`DATA_ENTITY_INTERNAL_NAME_UPDATE`, `DATA_ENTITY_GROUP_UPDATE`, `DATA_ENTITY_STATUS_UPDATE`, lines 84-86) to `WithPermissionsProvider` for descendant mutation affordances — the provider gates child UI elements (edit-name button, status-change action, group-edit form) but the **read** of the entity payload is unguarded. Any user who can reach this route (per the platform's auth mode) can mount this page and trigger all 5 dispatches.
- **owner_scoping**: `BYPASSES — no owner predicate at this layer` — the component passes `dataEntityId` directly to thunks without owner filtering. Backend confirms (per neighbour sidecar): the GET endpoint applies no owner scoping (read-collaborative posture); cross-owner reads are silent. This component is the front-end embodiment of the read-collaborative posture: it does not surface any UI signal that the user is reading another owner's entity. There is no banner, no permission-aware redirect, no soft-gate prompt.
- **data_exposure**:
  - "Triggers display of the full 34-field DataEntityDetails payload (description, ownership, tags, terms, metadata, dataSource, linkedUrlList, lineage shortcuts, source URLs, soft-delete state) to any user able to mount the route — same exposure as the backend endpoint, surfaced visually to the user"
  - "Triggers display of alert counts, DQ test reports, SLA reports (the 3 mount-only secondary fetches at lines 67-69) — each carrying its own exposure surface; an authenticated user under read-collaborative posture sees every entity's alert/quality status"
  - "Permissions vector exposed via WithPermissionsProvider — the 3 mutation permissions surface in the UI; absent permissions hide the corresponding UI affordance but do NOT block backend access (the backend has the load-bearing authz layer)"
- **known_security_gaps**:
  - "**LSN-017 — view_count inflation is 2× cheaper from this component than from a direct API call.** Probe P-004 empirically proves the doubling; combined with backend-side absence of rate-limiting (per neighbour sidecar `ReactiveDataEntityRepositoryImpl.md` known_security_gaps[3]), one page-open is a +2 vote into Popular ranking. A bot driving the UI (vs hitting the API directly) achieves twice the ranking-inflation throughput per page-render. Fix at line 63 reduces this by 50%; rate-limiting at backend reduces it absolutely." — evidence: DataEntityDetails.tsx:56-64 + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml — severity: MEDIUM
  - "**DISABLED-mode page-open is anonymous and inflates view_count.** Probe P-002 confirmed: 10 anonymous GETs against the backend yielded +10 view_count under `auth.type=DISABLED`. Opening this UI component under DISABLED achieves the same with +2 per page-open. The platform's default config thus has no audit trail for who's driving the Popular ranking." — evidence: DataEntityDetails.tsx:56-76 (no auth-mode-aware gating) + lineage/odd-platform/probe-runs/2026-05-19-P-002.yaml + neighbour sidecar DisabledAuthSecurityConfiguration analysis — severity: HIGH (under default config)
  - "**Permissions vector is rendered for the header but not surfaced to the user as an explicit access-level indicator.** The user doesn't see 'You don't have permission to edit this entity' anywhere — they just see the edit affordances disappear. No tooltip, no banner. This is a UX gap that compounds into an audit gap: a user uncertain about why they can/can't edit cannot self-diagnose, and operators auditing a user's intent have no log trail." — evidence: DataEntityDetails.tsx:82-102 (silent gating via WithPermissionsProvider) — severity: LOW (UX, not security per se)

## performance

- **hot_paths**:
  - "Component mount → 5 Redux dispatches (6 with LSN-017) → 6 backend GET requests. Every entity-detail page navigation runs this lifecycle. Probe P-003 baseline (run R-20260519T003916Z-P-003): backend `GET /api/dataentities/{id}` p50=106ms, p95=202ms, p99=1539ms (50-call sample; p99 driven by JIT warmup). Mount-time wall-clock latency is bounded by `max(per-fetch-latency)` of the 5 (or 6) parallel requests since Redux thunks fire concurrently." — evidence: DataEntityDetails.tsx:56-76 + lineage/odd-platform/probe-runs/2026-05-19-P-003.yaml
  - "Re-fetch on DEG-membership change — flipping any of `isDataEntityGroupUpdated`, `isDataEntityAddedToGroup`, `isDataEntityDeletedFromGroup` triggers a fresh `fetchDataEntityDetails` even if the user did not navigate. Three independent re-trigger paths." — evidence: DataEntityDetails.tsx:58-64
- **throughput_characteristics**:
  - "Single mount per route navigation — no batch / no multiplexing. Each detail-page open is one independent request set."
  - "LSN-017 doubles the network load on the hottest UI path: +1 redundant `GET /api/dataentities/{id}` per page-open across the platform's most-trafficked surface."
- **resource_allocation**:
  - "No client-side caching layer between Redux and the network — every dispatch issues a fresh fetch. The Redux slice stores the response in `byId[id]` so SUBSEQUENT in-session reads of the same entity (via selectors) are cache hits, but the FETCH always re-issues."
  - "5 parallel thunks per mount each open a separate XHR — the browser's per-host parallelism limit (~6 in Chrome) caps the effective concurrency but the platform is well under it."
  - "No virtualisation / windowing needed at this component (it's a single page, not a list); virtualisation lives in child components like `DataEntityAlerts`, `LinkedItemsList`, etc."
- **scaling_characteristics**:
  - "Stateless component — multiple browser tabs / users navigate independently; no shared state."
  - "No pagination at this surface (single entity render per route)."
  - "LSN-017 amplifies backend `view_count` UPDATE contention by 2× — the hot-row problem documented in F-001's facet[5] (`hot-row contention at service tier`) is multiplied by the UI bug."
- **known_performance_gaps**:
  - "**LSN-017 doubles network round-trip cost per page-open.** Every detail-page navigation costs 2× `GET /api/dataentities/{id}` instead of 1×. At a hypothetical 1000 page-opens / hour, the surplus 1000 calls translate to 1000 redundant DB UPDATEs on `data_entity.view_count` — a wasted hot-row write per page-open. Fix (remove line 63 from the dep-array) is 1 line. Empirically pinned by P-004." — evidence: DataEntityDetails.tsx:56-64 + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml — severity: MEDIUM
  - "**Skeleton flicker on legitimate re-fetch (DEG mutation, status change) — the render gate predicates on BOTH `details.id` AND `!isDataEntityDetailsFetching`, so any refetch hides the chrome.** Cost is purely UX (a brief flicker) but it compounds the LSN-017 doubling: every status change triggers a +2 view_count + a chrome flicker." — evidence: DataEntityDetails.tsx:80 (the predicate `details.id && !isDataEntityDetailsFetching`) — severity: LOW
  - "**No request coalescing / deduplication at the thunk layer.** If two components mounting simultaneously dispatch `fetchDataEntityDetails({ dataEntityId: 42 })`, both fire independent fetches — the Redux slice has no in-flight tracking. This component is the only direct consumer of `fetchDataEntityDetails` per `dataentities.slice.ts:97`, so the practical risk is low; but the second useEffect's dispatches (alerts counts / DQ test / SLA / resource permissions) are also called from sibling components (Activity feed, Catalog overview tile) without coalescing." — evidence: dataentities.thunks.ts:35-42 (no in-flight check; `handleResponseAsyncThunk` is a fire-and-await wrapper) — severity: LOW

## sources

- understanding ← odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:1-125 (whole file) + LSN-017 case-law + F-001 chain + probe P-004
- concepts.entities ← odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:1-125 + odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:35-42 + odd-platform-ui/src/redux/selectors/dataentity.selectors.ts:93-164 + odd-platform-ui/src/redux/slices/dataentities.slice.ts:97-99
- concepts.operations ← DataEntityDetails.tsx:30-125 (every line numbered against the dispatch / render path)
- concepts.invariants ← DataEntityDetails.tsx:56-76 (dep-arrays) + DataEntityDetails.tsx:115 (unconditional routes render) + DataEntityDetailsTabs.tsx:37 (independent selector read)
- concepts.audiences ← DataEntityDetails.tsx:78-120 (UI render) + dataentities.slice.ts:97 + owners.slice.ts:53 + metadata.slice.ts:18 (downstream Redux slice consumers)
- upstream_callers ← routes/dataEntitiesRoutes.ts:4-100 (path builders + BASE_PATH + useDataEntityRouteParams)
- downstream_side_effects ← DataEntityDetails.tsx:56-76 (the 2 useEffects) + dataentities.thunks.ts:35-42 (the fetch thunk wiring) + dataentities.slice.ts:97 + owners.slice.ts:53 + metadata.slice.ts:18 (downstream consumers) + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml (empirical xhr_count=2 + DB delta=2)
- dependencies_semantic.requires-feature ← documentation/docs/data-discovery/catalog-overview.md:42-67 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-05-19 status 200
- dependencies_semantic.requires-runtime ← DataEntityDetails.tsx:1-22 (imports) + routes/dataEntitiesRoutes.ts:47-58 (useDataEntityRouteParams parsing) + odd-platform-ui/package.json:10,136 (Vitest config)
- dependencies_semantic.couples-to ← DataEntityDetails.tsx:1-22 (imports) + DataEntityDetailsRoutes.tsx:32-156 + DataEntityDetailsTabs.tsx:27-80
- tests_coverage_semantic ← exhaustive Glob `odd-platform-ui/**/*.test.*` (empty) + `odd-platform-ui/**/*.spec.*` (empty) + Glob `odd-platform-ui/**/__tests__/**` (empty) + Grep `DataEntityDetails` over `.test.*` (no matches)
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-05-19 status 200 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery 2026-05-19 status 200 + local clone documentation/docs/data-discovery/catalog-overview.md:42-67 + documentation/docs/data-discovery.md:1-54
- implicit_adrs.[0] ← DataEntityDetails.tsx:56-76 (two co-located useEffects pattern)
- implicit_adrs.[1] ← DataEntityDetails.tsx:78-120 (the conditional vs unconditional render split)
- implicit_adrs.[2] ← DataEntityDetails.tsx:82-102 (WithPermissionsProvider wrap)
- bugs_limitations_corner_cases.[0] ← DataEntityDetails.tsx:56-64 (the dep-array) + retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml
- bugs_limitations_corner_cases.[1] ← routes/dataEntitiesRoutes.ts:47-58 (NaN-unguarded parseInt) + DataEntityDetails.tsx:32 (consumes it)
- bugs_limitations_corner_cases.[2] ← DataEntityDetails.tsx:56-76 (no cleanup return)
- bugs_limitations_corner_cases.[3] ← DataEntityDetails.tsx:116-119 (AppErrorPage generic)
- bugs_limitations_corner_cases.[4] ← DataEntityDetails.tsx:80 (predicate hides chrome on refetch)
- security.auth_mode_relevance ← DataEntityDetails.tsx:30-125 (no auth-mode-aware code) + neighbour sidecar odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md security block
- security.authorization_assertions ← DataEntityDetails.tsx:82-87 (3-permission vector to WithPermissionsProvider; no programmatic check on read)
- security.owner_scoping ← DataEntityDetails.tsx:57 (dispatches with id only, no owner) + neighbour sidecar getDataEntityDetails.md owner_scoping
- security.known_security_gaps.[0] ← DataEntityDetails.tsx:56-64 + probe P-004
- security.known_security_gaps.[1] ← probe P-002 + neighbour sidecar disabled-mode finding
- performance.hot_paths.[0] ← DataEntityDetails.tsx:56-76 + probe P-003 baseline
- performance.scaling_characteristics ← DataEntityDetails.tsx:30-125 (stateless) + F-001.yaml facet[6] hot-row contention
- performance.known_performance_gaps.[0] ← DataEntityDetails.tsx:56-64 + probe P-004

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-tests is the finding; gap is exhaustively verified)
- docs_link_semantic: HIGH (live WebFetch + local-clone both confirm doc coverage shape)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (LSN-017 is empirically pinned by P-004)
- security: HIGH
- performance: HIGH (P-003 baseline + P-004 doubling are both measured)

## Maintainer notes

(reserved — no existing sidecar to inherit from)

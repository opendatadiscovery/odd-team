---
node_id: "odd-platform ts react-component component:Activity"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-01
---

# Activity (global Activity page root) — semantic understanding

## understanding

`Activity` is the top-level page component for the global Activity Feed surface at `/activity` (mounted lazy-loaded at `App.tsx:37, App.tsx:65`). It is a pure layout shell: a `MainContainer` wrapping a 3/9 split `ContentContainer` Grid whose left column hosts `<Filters />` (sidebar — calendar + three single-select filters [Datasource / Namespace / Event type] + three multi-select filters [Tag / Owner / User]) and whose right column hosts `<ActivityResults />` (which composes `<ActivityTabs />` + `<ActivityResultsList />`). The component declares no state, no effects, no thunk dispatches, no permission gates — all data flow lives in the two children, which both consume `useQueryParams<ActivityQuery>(defaultActivityQuery)` so the URL query string is the single source of truth for filter state. The page is the operator-visible entry point at which LSN-020's `userIds`→`OWNER_ID` translation first surfaces as a labelled "User" UI control whose backing dropdown actually lists owners.

## concepts

- entities: [ActivityQuery (the URL-query state shape; common.ts:7-10), Filters panel, ActivityResults panel, ActivityType (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM` — encoded in `type` query param, not in URL path)]
- operations: [render the page layout, compose Filters + ActivityResults, delegate all data fetching + state to children]
- invariants:
  - "The page is a flat two-child layout — `<Filters />` on the left (`xs={3}`) and `<ActivityResults />` on the right (`xs={9}`). The grid split is hardcoded — no responsive breakpoint, no collapsible sidebar."
  - "All filter state and result state lives in URL query params, not in component state. `Activity.tsx` itself holds no React state; both children read `useQueryParams<ActivityQuery>(defaultActivityQuery)` independently — they synchronise via the URL, not via prop drilling or context."
  - "The 'Filters' label and the seven facet labels (Period / Datasource / Namespace / Event type / Tag / Owner / User) are translation-keyed via `t(...)` — the component supports the en/es/fr/de/it/zh locale set (en.json:347 `\"User\": \"User\"`)."
- audiences: [signed-in platform users browsing the platform-wide audit trail via the AppToolbar `Activity` tab; operators auditing platform changes; security/compliance reviewers — gated by NOTHING at the component or route layer, see `bugs_limitations_corner_cases`]

## dependencies_semantic

- requires-feature:
  - "`Filters` child component (`components/Activity/Filters/Filters.tsx`) — owns the seven facet UI, dispatches `fetchDataSourcesList` + `fetchNamespaceList` at mount (line 26-30), composes `CalendarFilter` + three `SingleFilter` (`datasourceId`, `namespaceId`, `eventType`) + three `MultipleFilter` (`tagIds`, `ownerIds`, `userIds`). The `MultipleFilter` for `userIds` is the LSN-020 channel."
  - "`ActivityResults` child component — owns the `useEffect([queryParams])` that dispatches `fetchActivityCounts(queryParams)` + `fetchActivityList({...queryParams, isQueryUpdated: true})` (ActivityResults.tsx:47-50). Renders `ActivityTabs` + `ActivityResultsList`."
  - "Backend dependency (transitive through the children): `GET /api/activity` + `GET /api/activity/counts` — backed by `ActivityController.getActivity` / `getActivityCounts` (sidecar: `odd-platform__java__ActivityController__controller-method__getActivity.md`). The `userIds` query parameter binds at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (`ReactiveActivityRepositoryImpl.java:272-273`) — see LSN-020."
- requires-config: []
- requires-runtime:
  - "React 18 (`React.FC` arrow component)."
  - "Material-UI Grid + the local `PageWithLeftSidebar` styled components (`components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:5-26`) — `MainContainer` + `ContentContainer` + `LeftSidebarContainer` + `ListContainer`."
- additional_coupling:
  - "Lazy-loaded at `App.tsx:37` (`lazy(() => import('./Activity/Activity'))`) — the bundle splits at this component. A render error inside the Activity tree is isolated by React Suspense from sibling routes."
  - "Mounted at `App.tsx:65` (`<Route path={activityPath()} element={<Activity />} />`) — bare route, no `WithPermissionsProvider`, no owner-association guard, no `/*` suffix (no nested child routes). See route sidecar (`odd-platform__ts__routes__route__activity.md`) for the route-level audit."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Activity component renders with `Filters` in left column (`xs=3`) and `ActivityResults` in right column (`xs=9`) at viewport ≥ md."
    test_class: unit
    criticality: LOW
  - behaviour: "Activity component renders without crashing when neither `dataSourcesList` nor `namespaceList` are loaded (initial fetch in-flight)."
    test_class: unit
    criticality: MEDIUM
    note: "The Filters child dispatches fetch at mount (Filters.tsx:26-30); if those thunks throw before the page mounts, does the page render or surface an error boundary?"
  - behaviour: "Visiting `/activity` as an authenticated user with no owner association under LOGIN_FORM/OAUTH2/LDAP renders the page and surfaces cross-owner activity rows (the default `type=ALL` does not honour owner scope)."
    test_class: security
    criticality: HIGH
    note: "The route + component have NO permission gate; the backend has NO @PreAuthorize on /api/activity. The page exposes the platform-wide audit trail to every authenticated user — confirmed in the ActivityController.getActivity sidecar; this is the UI-visible consequence."
  - behaviour: "Selecting an entry from the 'User' filter autocomplete shows OWNER results (not user results) and the resulting filtered activity feed only matches actors with an active user-owner mapping pointing to that owner."
    test_class: integration
    criticality: HIGH
    note: "The 'User' label is operator-misleading per LSN-020; see P-190."
  - behaviour: "Selecting an unmapped user (impossible via the current UI — autocomplete only surfaces owners) returns the same set as picking the owner-with-no-mapped-users. The UI cannot express the actual `created_by` filter the doc copy promises."
    test_class: integration
    criticality: HIGH
    note: "Available-but-unused column smell: activity.created_by is read in the LEFT JOIN but never used in WHERE — see P-190 + LSN-020."
  - behaviour: "Activity page handles `queryParams.beginDate` later than `queryParams.endDate` gracefully (calendar UI should refuse to set this; what happens if the URL is hand-crafted that way?)."
    test_class: integration
    criticality: LOW
- test_files: []
- gaps: |
    No tests under `odd-platform-ui/src/components/Activity/` (verified via
    glob on `**/*.test.*` returns zero matches for the Activity tree). The
    integration-class gaps (LSN-020 surface; HIGH criticality) are the
    load-bearing absences — the unit-class layout test is nice-to-have. The
    LSN-020 user-filter integration test is the highest-leverage gap;
    P-190 is the probe skeleton for the regression.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Canonical user-facing doc page for the Activity feature; its 'Filters on the global Activity page' section enumerates the seven facets the `Filters` child renders. The page's User-filter description is the doc-side of the LSN-020 drift channel."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      H1: "Activity Feed"
      H2: "Where to find it" verbatim:
        "Global Activity page — top-level Activity entry in the platform's
        navigation. Shows every event across the catalog with a seven-facet
        filter panel (see below)."
      User filter description verbatim:
        "show events **performed by** one or more selected users
        (multi-select). Useful for auditing a specific person's platform
        activity."
      Owner filter description verbatim:
        "show events on entities with one or more selected owners
        (multi-select). Useful for 'what happened to my team's data
        this week'."
      The page does NOT specify:
        - default time windows or page sizes
        - access control / viewing restrictions
        - the four tabs (All / My Objects / Downstream / Upstream)
- doc_drift_findings:
  - "The live doc page's User-filter description (`show events **performed by** one or more selected users`) is the doc-side LSN-020 drift surface. The `Filters` child binds the 'User' UI control to `queryParams.userIds`; the backend translates this to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (`ReactiveActivityRepositoryImpl.java:272-273`). Users without an owner mapping cannot be selected at all (the autocomplete only surfaces owners); reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; multiple users mapped to the same owner collapse into a single filter result. The doc page does NOT warn about any of this — the operator reading the doc has no way to know the filter does not honour the label. Already filed as DOC-GAP-303 + LSN-020. — severity: HIGH"
  - "The live doc page omits the four UI tabs (All / My Objects / Downstream / Upstream — implemented at `ActivityTabs.tsx:29-51`). The doc's only navigation discussion is global-vs-per-entity; the in-page tab axis (`type` query parameter) is invisible to the doc reader. Surface as DOC-NNN candidate."
  - "The live doc page makes no access-control statement. The Activity page (this component) has no permission gate at the route, no guard at the component, and the backend has no `@PreAuthorize` — every authenticated user reads the platform-wide audit trail, including for resources they have no ownership association with. An operator reading the doc cannot determine the page is platform-wide visible. Surface as DOC-NNN candidate."
  - "The live doc page does not specify the default 6-day backward window (`beginDate = startOfDay(now - 5 days)`, `endDate = endOfDay(now + 1 day)` per `common.ts:33-34`) or the page size (`size = 30` per `activity.thunks.ts:20`). An operator reading the doc cannot anticipate either default. Surface as DOC-NNN candidate."

## implicit_adrs

- "All filter state and result state lives in URL query params (`useQueryParams<ActivityQuery>(defaultActivityQuery)`) rather than in component state or in a parent context. The two children (`Filters` + `ActivityResults`) synchronise via the URL — the page-root `Activity` component itself holds no state at all. This is the deliberate pattern that makes Activity URLs shareable and deep-linkable (the AppToolbar tab at `ToolbarTabs.tsx:77` deep-links via `activityPath(activityQueryString)`)." — evidence: Activity.tsx:6-17 (no state, no effect, no context) + Filters.tsx:24 (`useQueryParams<ActivityQuery>(defaultActivityQuery)`) + ActivityResults.tsx:26 (same hook) — intent_anchor: "two sibling children using the same `useQueryParams` hook with the same default — the URL is the contract between them" — confidence: HIGH
- "Sub-views (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`) are encoded as a `type` query parameter rather than as URL path segments, deliberately diverging from the alerts pattern (`/alerts/all`, `/alerts/my`, `/alerts/dependents`). Tab clicks call `setQueryParams(prev => ({...prev, type: newActivityType}))` (`ActivityTabs.tsx:58-61`) rather than triggering React Router navigation. Already recorded in the route sidecar (`activityRoutes.ts` implicit_adrs); restated here because this is the operator-visible consequence — the URL `/activity?type=MY_OBJECTS` carries the tab selection." — evidence: Activity.tsx:6-17 (single bare component) + ActivityTabs.tsx:29-61 (the four tabs with setQueryParams dispatch) — intent_anchor: "tab dispatch via setQueryParams on the `type` field rather than via React Router navigation to a sub-path" — confidence: HIGH

## bugs_limitations_corner_cases

- "The 'User' filter (Filters.tsx:93-98 — `<MultipleFilter filterName='userIds' name={t('User')} />`) is operator-misleading at the UI layer (Category F TRANSLATES_SILENTLY — LSN-020). MultipleFilter at `components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34` dispatches `fetchOwnersList` for any `filterName !== 'tagIds'`; MultipleFilterAutocomplete (lines 44-47) does the same. The dropdown therefore lists OWNERS, not users. Selecting an OWNER puts its ID into `queryParams.userIds`; the backend binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. Three operator-observable consequences: (a) users without a user-owner mapping cannot be selected at all (silent absence from dropdown); (b) reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; (c) multiple users sharing an owner collapse into a single filter result. The label says 'User'; the live doc says 'performed by'; the implementation says owner-of-the-actor-via-mapping. See P-190 for the integration probe." — evidence: components/Activity/Filters/Filters.tsx:93-98 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47 + ActivityController.getActivity sidecar + LSN-020 — severity: HIGH
- "No permission gate at the route or the component. `<Activity />` is mounted bare at `App.tsx:65`; there is no `WithPermissionsProvider`, no owner-association guard, no role check. Combined with the backend `ActivityController.getActivity` carrying no `@PreAuthorize` (per its sidecar), every authenticated user reads the platform-wide audit trail. The component is the UI-visible entry point for the HIGH-severity security gap already recorded at the route + backend sidecars; restated here because operators land HERE first." — evidence: App.tsx:65 (no wrapper) + activity route sidecar (no guard) + ActivityController.getActivity sidecar (no @PreAuthorize) — severity: HIGH (inherits)
- "The default 6-day window (`beginDate = startOfDay(now - 5 days)`, `endDate = endOfDay(now + 1 day)` per `components/shared/elements/Activity/common.ts:33-34`) is recomputed at module-eval time, not URL-stamped. Visiting `/activity` directly shows the default window relative to YOUR `now`; sharing the URL with a colleague shows the default window relative to THEIR `now`. Operators expecting 'the URL I shared = the view I saw' will be surprised — silent semantic drift across share-time. (Identical observation already recorded in the route sidecar; the component is where the user actually encounters it.)" — evidence: components/shared/elements/Activity/common.ts:33-41 (`beginDate`/`endDate` via `addDays(new Date(), -5)` / `+1` evaluated at module load) + Activity.tsx:6-17 (no URL-stamping on mount) — severity: MEDIUM
- "Tab counts (`activityCounts.totalCount`, `myObjectsCount`, etc.) are fetched independently of the activity list — `ActivityResults` dispatches `fetchActivityCounts(queryParams)` AND `fetchActivityList(...)` on every queryParams change (`ActivityResults.tsx:47-50`). This is FIVE Postgres queries per filter change (4 counts via `Mono.zip` + 1 list). No debounce, no cache. A user rapidly twiddling the filter panel issues a fresh 5-query burst per change." — evidence: components/Activity/ActivityResults/ActivityResults.tsx:47-50 + ActivityController.getActivity sidecar performance.hot_paths.[2] (the four-Mono.zip costs of the counts endpoint) — severity: LOW
- "`Filters.tsx:34-42` defines a hardcoded `excludedTypes` list of seven `ActivityEventType` enum values (`DATA_ENTITY_OVERVIEW_UPDATED`, `DATA_ENTITY_METADATA_UPDATED`, `DATA_ENTITY_SCHEMA_UPDATED`, `DATA_ENTITY_RELATION_UPDATED`, `CUSTOM_METADATA_CREATED|UPDATED|DELETED`). These events ARE recorded on the backend (the live doc page calls them out on the per-entity Activity tab) and ARE filterable via the API, but the global Activity page's event-type dropdown hides them. The implicit ADR (live doc): 'these events are too noisy for the cross-catalog feed and exist only on per-entity tabs'. The doc page documents this; the implementation enforces it client-side only — a hand-crafted URL with `eventType=DATA_ENTITY_OVERVIEW_UPDATED` would bypass the filter UI and still return matching rows from the backend." — evidence: components/Activity/Filters/Filters.tsx:34-45 (the hardcoded list + the `filter` call) + WebFetch activity-feed doc (`Where to find it` describes the per-entity exclusions) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components/Activity/Filters/Filters.tsx:27"
      name: "params.size (DataSources + Namespace list pre-fetch)"
      value: "100"
      questions:
        - q: "What at N > 100 datasources / namespaces?"
          a: "The fetch dispatch hardcodes `size: 100` (Filters.tsx:27). Datasources beyond 100 (sorted by API default — verified in ActivityController.getActivity sidecar but not in this file) are silently absent from the SingleFilter dropdown. Operator picks from the first 100 datasources/namespaces only; no paging in the filter UI."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/Filters/Filters.tsx:27"
        - q: "What at N at the boundary (= 100)?"
          a: "100 datasources/namespaces fit in one fetch — last one is reachable; 101st is not."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/Filters/Filters.tsx:27"
        - q: "What does the operator see at boundary > 100?"
          a: "Silent truncation in the SingleFilter dropdown; no UI signal that more datasources/namespaces exist. The 'Clear All' button still works (it sets the field to null, which is 'All'). REFERENCE — depends on the SingleFilter rendering and the backend default ordering of /api/datasources and /api/namespaces (not in scope here)."
          confidence: REFERENCE
          evidence: "node_id: odd-platform java DataSourceController / NamespaceController"
    - location: "components/shared/elements/Activity/common.ts:33-34"
      name: "default Calendar window (beginDate / endDate)"
      value: "now-5d to now+1d (6 days)"
      questions:
        - q: "What at the boundary — visiting /activity at 23:59:59 vs 00:00:00 local?"
          a: "`startOfDay(now-5d)` / `endOfDay(now+1d)` are recomputed at module-eval time (which is once per page load), not URL-stamped. The window's exact instants depend on the user's clock at navigation time. Two operators navigating the same shared URL one minute apart see different windows; an operator who keeps the tab open over a midnight boundary sees the window unchanged until they navigate or refresh, then the window shifts to the new day."
          confidence: STATIC-INFERRED
          evidence: "components/shared/elements/Activity/common.ts:33-34"
        - q: "What at extreme inputs — negative duration, beginDate > endDate via hand-crafted URL?"
          a: "Calendar UI (`CalendarFilter.tsx:24-33`) is keyed off the `AppDateRangePicker`; the date picker's UI likely refuses an inverted range, but a hand-crafted URL `?beginDate=X&endDate=Y` where Y < X would be passed through to the backend. PROBE-NEEDED — depends on the date picker's input validation."
          confidence: PROBE-NEEDED
          evidence: "P-190 (verified-via stub — the existing probe covers a related Category-F path; a date-inversion probe is a separate concern)"
        - q: "What does the operator see at the default boundary (no filters applied)?"
          a: "30 most-recent activity rows in the 6-day window (size=30 — `activity.thunks.ts:20`) ordered DESC by `(created_at, id)` — the newest 30 rows. Infinite scroll fetches the next page via cursor."
          confidence: STATIC-INFERRED
          evidence: "redux/thunks/activity.thunks.ts:20 + ReactiveActivityRepositoryImpl.java:291"
    - location: "components/Activity/Filters/Filters.tsx:34-42"
      name: "excludedTypes (filter UI event-type allowlist)"
      value: "7 hidden event types: DATA_ENTITY_{OVERVIEW,METADATA,SCHEMA,RELATION}_UPDATED + CUSTOM_METADATA_{CREATED,UPDATED,DELETED}"
      questions:
        - q: "What at boundary — operator hand-crafts URL with eventType=DATA_ENTITY_OVERVIEW_UPDATED?"
          a: "Filter UI hides the option; the backend has no such restriction. A hand-crafted URL bypasses the UI filter and the backend returns matching rows. Per-entity Activity tab DOES show these event types (per live doc); only the global filter hides them."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/Filters/Filters.tsx:34-45 + WebFetch activity-feed doc"
  name_behavior_pairs:
    - name: "Filters / `t('User')` (the User filter label)"
      promise: "Filter activity events by the user(s) who performed each action — the label + the live doc copy ('show events **performed by** one or more selected users') together promise an actor-filter."
      implementation: "Filters.tsx:93-98 renders <MultipleFilter filterName='userIds' .../>. MultipleFilter dispatches fetchOwnersList for any filterName != tagIds (MultipleFilter.tsx:32-34). MultipleFilterAutocomplete searches via fetchOwnersList (lines 44-47). The dropdown lists OWNERS. Selecting an owner stores its ID in queryParams.userIds. The thunk sends userIds=[<ownerId>] to GET /api/activity. The SQL binds USER_OWNER_MAPPING.OWNER_ID.in(userIds) — owners-via-user-owner-mapping (ReactiveActivityRepositoryImpl.java:272-273). The actual actor column activity.created_by is read in the LEFT JOIN (line 221) and SELECTED (line 212) but NEVER filtered. Round-trip is consistent on the OWNER axis; the label, doc copy, and parameter name promise the USER axis."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Users without an owner mapping cannot be selected (silent dropdown absence); reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; multiple users mapped to the same owner collapse into one filter result. See P-190."
      confidence: STATIC-INFERRED
      evidence: "components/Activity/Filters/Filters.tsx:93-98 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47 + ReactiveActivityRepositoryImpl.java:272-273 + LSN-020"
    - name: "ActivityResults / `useEffect([queryParams])` (dispatch behaviour)"
      promise: "Refresh activity list when the user changes a filter."
      implementation: "ActivityResults.tsx:47-50 dispatches BOTH fetchActivityCounts(queryParams) AND fetchActivityList({...queryParams, isQueryUpdated: true}) on EVERY queryParams change. The counts endpoint runs 4 parallel Postgres queries via Mono.zip (per ActivityController.getActivity sidecar performance.hot_paths.[2]). So a single filter twiddle issues 5 DB queries total. No debounce, no cache."
      drift: MINOR
      operator_visible_consequence: "Rapid filter changes burst-fire DB load; UI is responsive but DB load is 5× the filter-change count."
      confidence: STATIC-INFERRED
      evidence: "components/Activity/ActivityResults/ActivityResults.tsx:47-50 + ActivityController.getActivity sidecar performance"
  orderings:
    - location: "redux/thunks/activity.thunks.ts:45 (setPageInfo paginator)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "`ReactiveActivityRepositoryImpl.java:291` — `.orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())`. Newest-first by created_at; tie-break by id DESC. Deterministic."
          confidence: STATIC-INFERRED
          evidence: "ReactiveActivityRepositoryImpl.java:291"
        - q: "Tie-breaker when sort-key values are equal?"
          a: "`ACTIVITY.ID.desc()` — id is monotonically increasing per row, so within a (created_at second) bucket the higher-id row sorts first."
          confidence: STATIC-INFERRED
          evidence: "ReactiveActivityRepositoryImpl.java:291"
        - q: "What when result-set > page size (size=30)?"
          a: "First 30 newest rows returned; cursor (lastEventId + lastEventDateTime) carries the next-page anchor. InfiniteScroll in ActivityResultsList.tsx:52-60 fires `fetchNextPage` on scroll-near-end; ActivityResults.tsx:52-63 dispatches the next list page with `isQueryUpdated: false` so the reducer APPENDS rather than REPLACES."
          confidence: STATIC-INFERRED
          evidence: "ActivityResults.tsx:52-63 + ActivityResultsList.tsx:52-60 + activity.thunks.ts:22-51 + ReactiveActivityRepositoryImpl.java:284-294"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Rows are grouped client-side by `activityDate` for the date-section subheaders (ActivityResultsList.tsx:64-87). The grouping preserves DB order within each date; no in-memory sort modifies the DESC ordering. The 'Hide all details' toggle is a render flag, not a sort/filter."
          confidence: STATIC-INFERRED
          evidence: "ActivityResultsList.tsx:64-87"
  auth_gates: []  # No auth annotations in this UI component; gate analysis lives in route sidecar (App.tsx:65 unwrapped) + ActivityController sidecar (no @PreAuthorize).
  resource_boundaries:
    - location: "components/Activity/ActivityResults/ActivityResults.tsx:47-50"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two queryParams changes in rapid succession can race — Effect-2 dispatches its list+counts pair while Effect-1's dispatches are still in flight. Reducer composition is order-independent for counts (last write wins is OK — counts are point-in-time aggregates), but the list reducer uses `isQueryUpdated: true` to REPLACE and `isQueryUpdated: false` to APPEND (activity.thunks.ts:48 + reducer logic not read here). If Effect-1's list (REPLACE for query A) lands AFTER Effect-2's list (REPLACE for query B), the user sees query A rows for the query B URL. PROBE-NEEDED — depends on the redux slice ordering."
          confidence: PROBE-NEEDED
          evidence: "P-190 (the existing probe is a different Category-F concern; a race-condition probe is a separate concern)"
        - q: "Replay-safe?"
          a: "GET endpoint; idempotent at the network. No side effect on the server beyond DB read."
          confidence: STATIC-INFERRED
          evidence: "ActivityController.getActivity sidecar"
        - q: "Cache TTL / eviction / staleness window?"
          a: "No client-side cache visible in `ActivityResults.tsx`. The activity slice in redux holds the last-fetched list; navigating away and back re-fetches via the mount-time `useEffect([queryParams])`. There is no React Query / RTK Query layer with TTL semantics on this surface."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/ActivityResults/ActivityResults.tsx:47-50"
  request_inputs:
    - location: "components/Activity/Filters/Filters.tsx:93-98"
      input_kind: query-param
      input_name: "userIds (composed in URL via setQueryParams; user-facing label `t('User')`)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'Filter activity events by the user(s) who performed each action.' The label `User` in the filter panel + the live doc copy ('show events performed by one or more selected users') + the parameter name `userIds` together promise an actor-filter."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/Filters/Filters.tsx:93-98 + WebFetch activity-feed doc + redux/thunks/activity.thunks.ts:20-51"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "UI flow: MultipleFilter (`components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34`) and MultipleFilterAutocomplete (lines 44-47) dispatch fetchOwnersList for filterName != tagIds — the dropdown lists owners. Selecting an owner stores its ID in queryParams.userIds (MultipleFilterAutocomplete.tsx:80-86). The thunk (activity.thunks.ts:22-51) sends userIds=[<ownerId>] to GET /api/activity. Backend chain: ActivityController.getActivity → ActivityServiceImpl.getActivityList → ReactiveActivityRepositoryImpl. The SQL binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (line 273) — owner-via-mapping filter. The available-but-unused column is `ACTIVITY.CREATED_BY` (the actual actor username, read at line 221, selected at line 212, NEVER filtered)."
          confidence: STATIC-INFERRED
          evidence: "components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47 + redux/thunks/activity.thunks.ts:22-51 + ReactiveActivityRepositoryImpl.java:212,221,272-273"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The label says 'User' and the live doc says 'performed by'; the implementation filters by owner-of-the-actor via user-owner mapping. The translation has no comment, no ADR, no documentation. The 'available-but-unused' column (`activity.created_by`) is exactly the column an actor-filter would use."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "components/Activity/Filters/Filters.tsx:93-98 + ReactiveActivityRepositoryImpl.java:212,221,272-273 + LSN-020"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Users without an active user-owner mapping cannot be selected at all — the dropdown only surfaces owners (autocomplete uses fetchOwnersList exclusively); a user-without-owner is silently absent from the picker, distinct from 'returns empty'. (b) Reassigning a user-owner mapping (the user changes which owner they represent) RETROACTIVELY rewrites which historical activity rows match the filter — the audit trail's 'who did this' answer for past events changes silently without any event-log entry. (c) Multiple users mapped to the same owner all collapse into the same filter result — picking 'owner-Alice-team' returns rows for every user mapped to that owner. (d) The deleted-user-mapping case: when `USER_OWNER_MAPPING.DELETED_AT.isNull()` is enforced (line 274), filtering by a soft-deleted mapping's owner_id returns empty even if the underlying actor still exists."
          confidence: STATIC-INFERRED
          evidence: "ReactiveActivityRepositoryImpl.java:272-274 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-41 + P-190"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "YES. `ACTIVITY.CREATED_BY` (text column carrying the actual actor's OIDC username) is read in the LEFT JOIN at `ReactiveActivityRepositoryImpl.java:221` (`USER_OWNER_MAPPING.OIDC_USERNAME.eq(ACTIVITY.CREATED_BY)`), SELECTED in the result mapping via `buildBaseQuery` at line 212, but ABSENT from any WHERE predicate. This is the column an actor-filter that honored the parameter name would filter on."
          confidence: STATIC-INFERRED
          evidence: "ReactiveActivityRepositoryImpl.java:212,221"
      routes_to_finding: "bugs_limitations_corner_cases.[0] + docs_link_semantic.doc_drift_findings.[0]"
  probes_emitted:
    - probe_id: P-190
      question: "Verify the LSN-020 UI surface: User filter → Owners dropdown → userIds binds to OWNER_ID. Verify three operator-observable consequences (unmapped-user absence, retroactive mapping rewrite, multi-user collapse)."
      probe_path: "lineage/odd-platform/probes/P-190.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 19
    answers_static_inferred: 15
    answers_probe_needed: 2
    answers_reference: 2
    drift_flags: 2
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | INTERNAL_ONLY
  - "The Activity page is a UI surface mounted at `/activity` (`App.tsx:65`). Authentication mode determines whether the route is reachable: under LOGIN_FORM/OAUTH2/LDAP, the AuthorizationCustomizer default rule `pathMatchers('/**').authenticated()` requires authentication to fetch `index.html`/the SPA shell. Under DISABLED, anonymous traffic reaches the page. The component itself contains no auth check — the gate (such as it is) lives at the backend layer. From the component's perspective, auth-mode coupling is INTERNAL_ONLY (no @ConditionalOnProperty equivalent in React)." — evidence: components/Activity/Activity.tsx:1-19 (no auth code) + App.tsx:65 (no guard wrapper) + ActivityController.getActivity sidecar
- ingestion_filter_relevance: "NO — UI surface, not ingestion."
- authorization_assertions: []
  - "The component has no permission check. No `useAppSelector(getCurrentPermissions)`, no `<WithPermissions>` wrapper, no Permission-enum gate. The route at `App.tsx:65` is also unwrapped. The component renders unconditionally for any caller who reaches the route." — evidence: components/Activity/Activity.tsx:1-19 + App.tsx:65 + WithPermissionsProvider sidecar (the non-blocking-wrapper finding from ZH)
- owner_scoping: "BYPASSES — the component does not invoke owner scoping. The backend has no owner gate on /api/activity (default `type=ALL`). The `type=MY_OBJECTS` tab IS owner-scoped but only when the user explicitly selects it; the default landing tab is `ALL`. The 'My Objects' tab does not redirect users without an associated owner — it silently returns empty (per ActivityController.getActivity sidecar tests_coverage_semantic.uncovered_behaviours)." — evidence: components/Activity/Activity.tsx:1-19 + ActivityType.ALL default at common.ts:40 + ActivityController.getActivity sidecar owner_scoping
- data_exposure:
  - "Full Activity payload (id, event_type, created_at, created_by — the actor's owner + username, data_entity — oddrn + naming + type, old_state + new_state — every tracked field's value before/after) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP via this page; any caller under DISABLED. The component renders the payload via `ActivityItem` (`components/Activity/ActivityResults/ActivityItem/ActivityItem.tsx`) — no field-level redaction at the UI." — evidence: components/Activity/Activity.tsx:1-19 + components/Activity/ActivityResults/ActivityResults.tsx:65-89 + ActivityController.getActivity sidecar data_exposure
  - "Filter inputs surface as URL query parameters — `userIds` and `ownerIds` enumeration vectors (per ActivityController.getActivity sidecar known_security_gaps.[2]) are reachable directly via the page URL. A user can crawl `/activity?userIds=1&userIds=2&...` and infer which owner IDs have associated user-owner mappings (the count returned changes monotonically with valid IDs)." — evidence: components/Activity/Filters/Filters.tsx + ActivityController.getActivity sidecar known_security_gaps.[2]
- known_security_gaps:
  - "The page is mounted without permission gate at the route + has no internal permission check + the backend has no @PreAuthorize on /api/activity. Combined effect: every authenticated user (and every caller under DISABLED) reads the platform-wide audit trail including the actor identity and full old/new state diffs of descriptions, business names, ownership transitions, and custom metadata. This is the HIGH-severity gap already recorded at both the route sidecar (`bugs_limitations_corner_cases.[0]`) and the ActivityController sidecar (`known_security_gaps.[0]`); restated here because operators encounter the gap at this UI surface first." — evidence: components/Activity/Activity.tsx:1-19 (no guard) + App.tsx:65 (no wrapper) + ActivityController.getActivity sidecar — severity: HIGH (inherits)
  - "The 'User' filter label is operator-misleading at this surface. An auditor using the page to investigate 'what did user X do?' is given a UI control labelled 'User', whose underlying filter is on owner-of-actor-via-mapping. The audit conclusion drawn from the filtered list is wrong in shape — the user X's actions are absent unless X has a user-owner mapping, and the actions of every other user mapped to X's owner are present. This is the operator-facing surface of LSN-020." — evidence: components/Activity/Filters/Filters.tsx:93-98 + LSN-020 + P-190 — severity: HIGH

## performance

- hot_paths:
  - "Every queryParams change triggers FIVE backend queries via the `useEffect([queryParams])` in ActivityResults.tsx:47-50 — 1 list query + 4 parallel count queries (`Mono.zip` of totalCount + myObjectsCount + downstreamCount + upstreamCount). A user twiddling the filter panel generates 5 DB queries per change with no debounce." — evidence: components/Activity/ActivityResults/ActivityResults.tsx:47-50 + ActivityController.getActivity sidecar performance.hot_paths.[2]
  - "Initial mount of the page issues TWO pre-fetches (`fetchDataSourcesList` + `fetchNamespaceList` at Filters.tsx:26-30) IN ADDITION TO the 5 activity queries — so the cold-page-load is 7 DB queries." — evidence: components/Activity/Filters/Filters.tsx:26-30 + components/Activity/ActivityResults/ActivityResults.tsx:47-50
- throughput_characteristics:
  - "Single-user surface — page-load + filter-twiddle generate per-user query bursts; no batch or streaming pattern."
  - "Infinite scroll (`InfiniteScroll` at `ActivityResultsList.tsx:52-60`) appends pages as the user scrolls — pagination is cursor-based via `lastEventId` + `lastEventDateTime` (no offset)."
- resource_allocation:
  - "Page initial render: 2 pre-fetch + 1 list query + 4 count queries = 7 queries. No HTTP retries observed at the thunk layer (`activity.thunks.ts:22-51` uses `handleResponseAsyncThunk` with `switchOffErrorMessage: true`). No request cancellation on rapid filter changes (no AbortController plumbed through)."
- scaling_characteristics:
  - "Stateless component — the entire page-state lives in URL query string + Redux store. Multi-tab navigation works fine; cross-tab state changes propagate via URL not via shared cache."
- known_performance_gaps:
  - "No debounce on the queryParams effect — rapid filter changes (typing in calendar, multi-selecting tags, etc.) issue 5 DB queries per change. A debounced wrapper (250-500ms) would dramatically reduce DB load with no UX cost." — evidence: components/Activity/ActivityResults/ActivityResults.tsx:47-50 — severity: MEDIUM
  - "No request cancellation. A queryParams change while the previous fetch is in-flight does not abort the previous request — the response races; the redux reducer determines which one wins (replace logic via `isQueryUpdated: true`)." — evidence: activity.thunks.ts:22-51 (no AbortController) — severity: LOW (cosmetic; the staleness is bounded by the round-trip latency)

## upstream_callers

- entry_point: "ui_route:/activity"
  caller_node: "odd-platform ts routes route:activity"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:65 — `<Route path={activityPath()} element={<Activity />} />` — single bare route mount; one Activity render per route activation."
  observation_class: ui-call

- entry_point: "ui_link:AppToolbar Activity tab"
  caller_node: "odd-platform ts react-component component:ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:77 deep-links via `activityPath(activityQueryString)` (per route sidecar dependencies_semantic.additional_coupling) — single navigation per click."
  observation_class: ui-call

- entry_point: "ui_link:Activity hotkey / direct URL nav"
  caller_node: "unresolved"
  multiplicity_per_trigger: 1
  evidence: "Direct URL navigation to /activity by typing in the address bar or via an external link reaches the component via the same App.tsx:65 route. No explicit hotkey binding observed in the component or in App.tsx."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders the Activity page shell — left-sidebar Filters panel + right-pane ActivityResults panel (which composes ActivityTabs + ActivityResultsList)."
  evidence: "components/Activity/Activity.tsx:6-17"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/activity"
    - "ui_link:AppToolbar Activity tab"

# Indirect side effects (composed through children — recorded as REFERENCES per Rule 6):
- side_effect_class: external-call
  description: "[REFERENCE] fetchDataSourcesList + fetchNamespaceList dispatched at Filters child mount (Filters.tsx:26-30). Pre-fetches the dropdown options for the SingleFilter facets."
  evidence: "components/Activity/Filters/Filters.tsx:26-30"
  cardinality_per_call: "2 (one each — fired once at Filters mount)"
  reachable_from_entry_points: ["ui_route:/activity", "ui_link:AppToolbar Activity tab"]
  unresolved: true  # Filters child not yet enriched

- side_effect_class: external-call
  description: "[REFERENCE] fetchActivityCounts + fetchActivityList dispatched at ActivityResults child mount AND on every queryParams change (ActivityResults.tsx:47-50). 4-query Mono.zip on counts + 1 list query = 5 backend queries per dispatch."
  evidence: "components/Activity/ActivityResults/ActivityResults.tsx:47-50"
  cardinality_per_call: "5 backend queries per queryParams change; first dispatch at mount + one per filter change"
  reachable_from_entry_points: ["ui_route:/activity", "ui_link:AppToolbar Activity tab"]
  unresolved: true  # ActivityResults child not yet enriched as a dedicated sidecar

- side_effect_class: db-write
  description: "[REFERENCE] None directly — the page is read-only. Backend ActivityController.getActivity is a pure read path; no INSERT / UPDATE / DELETE issued by this page."
  evidence: "ActivityController.getActivity sidecar (only Mono.just(response) + read queries)"
  cardinality_per_call: 0
  reachable_from_entry_points: ["ui_route:/activity"]

## sources

- understanding ← components/Activity/Activity.tsx:1-19 + components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:5-26 + components/App.tsx:37,65
- concepts.entities ← components/Activity/Activity.tsx:3-4 + components/shared/elements/Activity/common.ts:7-41 + components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51
- concepts.operations ← components/Activity/Activity.tsx:6-17
- concepts.invariants.[0] ← components/Activity/Activity.tsx:9-14 (xs=3 / xs=9 grid split)
- concepts.invariants.[1] ← components/Activity/Filters/Filters.tsx:24 + components/Activity/ActivityResults/ActivityResults.tsx:26
- concepts.invariants.[2] ← components/Activity/Filters/Filters.tsx:22 + locales/translations/en.json:347
- dependencies_semantic.requires-feature.[0] ← components/Activity/Filters/Filters.tsx (full file) + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47
- dependencies_semantic.requires-feature.[1] ← components/Activity/ActivityResults/ActivityResults.tsx:47-50
- dependencies_semantic.requires-feature.[2] ← redux/thunks/activity.thunks.ts:22-51 + ReactiveActivityRepositoryImpl.java:272-273 + LSN-020
- dependencies_semantic.requires-runtime ← components/Activity/Activity.tsx:1-2 + components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:1-3
- dependencies_semantic.additional_coupling ← components/App.tsx:37 + components/App.tsx:65 + activity route sidecar
- tests_coverage_semantic.gaps ← glob `**/*.test.*` under components/Activity — zero matches
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-26)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch activity-feed doc + components/Activity/Filters/Filters.tsx:93-98 + ReactiveActivityRepositoryImpl.java:272-273 + LSN-020
- implicit_adrs.[0] ← components/Activity/Activity.tsx:6-17 + components/Activity/Filters/Filters.tsx:24 + components/Activity/ActivityResults/ActivityResults.tsx:26
- implicit_adrs.[1] ← components/Activity/Activity.tsx:6-17 + components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-61
- bugs_limitations_corner_cases.[0] ← components/Activity/Filters/Filters.tsx:93-98 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47 + ReactiveActivityRepositoryImpl.java:272-273 + LSN-020
- bugs_limitations_corner_cases.[1] ← components/App.tsx:65 + activity route sidecar + ActivityController.getActivity sidecar
- bugs_limitations_corner_cases.[2] ← components/shared/elements/Activity/common.ts:33-41 + components/Activity/Activity.tsx:6-17
- bugs_limitations_corner_cases.[3] ← components/Activity/ActivityResults/ActivityResults.tsx:47-50 + ActivityController.getActivity sidecar
- bugs_limitations_corner_cases.[4] ← components/Activity/Filters/Filters.tsx:34-45 + WebFetch activity-feed doc
- stress_findings.tunables ← components/Activity/Filters/Filters.tsx:27 + components/shared/elements/Activity/common.ts:33-34 + components/Activity/Filters/Filters.tsx:34-42
- stress_findings.name_behavior_pairs ← components/Activity/Filters/Filters.tsx:93-98 + components/Activity/ActivityResults/ActivityResults.tsx:47-50
- stress_findings.orderings ← redux/thunks/activity.thunks.ts:45 + ReactiveActivityRepositoryImpl.java:291 + components/Activity/ActivityResults/ActivityResults.tsx:52-63
- stress_findings.resource_boundaries ← components/Activity/ActivityResults/ActivityResults.tsx:47-50 + redux/thunks/activity.thunks.ts:22-51
- stress_findings.request_inputs ← components/Activity/Filters/Filters.tsx:93-98 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34 + components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilterAutocomplete/MultipleFilterAutocomplete.tsx:44-47 + ReactiveActivityRepositoryImpl.java:212,221,272-274 + LSN-020 + P-190
- security.auth_mode_relevance ← components/Activity/Activity.tsx:1-19 + components/App.tsx:65 + ActivityController.getActivity sidecar
- security.authorization_assertions ← components/Activity/Activity.tsx:1-19 + components/App.tsx:65
- security.owner_scoping ← components/Activity/Activity.tsx:1-19 + components/shared/elements/Activity/common.ts:40 + ActivityController.getActivity sidecar
- security.data_exposure ← components/Activity/Activity.tsx:1-19 + components/Activity/ActivityResults/ActivityResults.tsx:65-89 + ActivityController.getActivity sidecar data_exposure
- security.known_security_gaps.[0] ← components/Activity/Activity.tsx:1-19 + components/App.tsx:65 + ActivityController.getActivity sidecar known_security_gaps.[0]
- security.known_security_gaps.[1] ← components/Activity/Filters/Filters.tsx:93-98 + LSN-020 + P-190
- performance.hot_paths ← components/Activity/ActivityResults/ActivityResults.tsx:47-50 + ActivityController.getActivity sidecar performance.hot_paths.[2]
- performance.throughput_characteristics ← components/Activity/ActivityResults/ActivityResults.tsx:52-63 + ActivityResultsList.tsx:52-60
- performance.resource_allocation ← components/Activity/Filters/Filters.tsx:26-30 + components/Activity/ActivityResults/ActivityResults.tsx:47-50 + redux/thunks/activity.thunks.ts:22-51
- performance.known_performance_gaps.[0] ← components/Activity/ActivityResults/ActivityResults.tsx:47-50
- upstream_callers.[0] ← components/App.tsx:65 + activity route sidecar
- upstream_callers.[1] ← activity route sidecar (additional_coupling — ToolbarTabs.tsx:77)
- downstream_side_effects ← components/Activity/Activity.tsx:6-17 (page-render) + components/Activity/Filters/Filters.tsx:26-30 (external-call REFERENCE) + components/Activity/ActivityResults/ActivityResults.tsx:47-50 (external-call REFERENCE) + ActivityController.getActivity sidecar (db-write none)

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
- downstream_side_effects: MEDIUM  # most are REFERENCES — children not yet enriched as standalone sidecars
- stress_findings: HIGH  # all load-bearing claims STATIC-INFERRED; only 2 of 19 PROBE-NEEDED (none on the load-bearing Category-F drift, which is STATIC-INFERRED + P-190)

## Maintainer notes

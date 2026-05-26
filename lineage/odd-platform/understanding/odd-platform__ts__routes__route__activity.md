---
node_id: "odd-platform ts routes route:activity"
node_kind: route
axis: ui_routes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-01
---

# activityRoutes — semantic understanding

## understanding

This module is the URL-shape contract for the **global** Activity Feed in the platform UI. It declares a private `BASE_PATH = '/activity'` and exports one builder `activityPath(query?)` that returns `'/activity'` or `'/activity?<query>'` — there are no sub-paths (unlike `alertsRoutes.ts` which declares three) because tab selection (`All` / `My Objects` / `Downstream` / `Upstream`) is encoded in the `type` query parameter, not in the URL path. The route is mounted at `App.tsx:65` as `<Route path={activityPath()} element={<Activity />} />` — a single bare route, NOT wrapped in `WithPermissionsProvider`, NOT wrapped in any owner-association guard, and NOT carrying a `/*` suffix (so there are no nested child routes). The `Activity` component (`components/Activity/Activity.tsx`) renders `Filters` + `ActivityResults` (which renders `ActivityTabs` + `ActivityResultsList`) and fires `fetchActivityCounts` + `fetchActivityList` on every `queryParams` change. The global Activity surface — exposing the platform-wide audit trail across every owner — is reachable by every authenticated user; the only owner-scope choice lives in the `type` query parameter (`MY_OBJECTS` filters to the caller's owner; `ALL` returns cross-owner activity). A separate per-entity Activity surface lives at `/dataentities/:dataEntityId/activity` (DataEntityActivity) — NOT under this route.

## concepts

- entities: [Activity, ActivityType (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`), ActivityFilter (datasourceId, namespaceId, eventType, tagIds, ownerIds, userIds, beginDate, endDate)]
- operations: [build the global Activity URL, optionally append a query string carrying the default `ActivityQuery` (`beginDate`, `endDate`, `size=30`, `type=ALL`)]
- invariants:
  - "`BASE_PATH` is `/activity` and is the single canonical prefix for the global Activity URL in the UI."
  - "There are NO sub-paths declared in this module — `ActivityType` (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`) is conveyed via the `type` query parameter, NOT via `/activity/{type}` path segments. Tab switches in `ActivityTabs.tsx:58-61` call `setQueryParams(prev => ({ ...prev, type: newActivityType }))`."
  - "`activityPath(query)` does NOT prefix the query argument with `?` — the caller passes a raw query string (sans `?`); the function prepends `?` internally (line 4). Passing `'?key=val'` would yield `/activity??key=val`."
  - "The default query (`defaultActivityQuery` at `components/shared/elements/Activity/common.ts:36-41`) carries `beginDate = startOfDay(now - 5 days)`, `endDate = endOfDay(now + 1 day)`, `size = 30`, `type = ActivityType.ALL` — this is the default 6-day window the global Activity tab in `ToolbarTabs.tsx:77` deep-links to."
- audiences: [signed-in platform users browsing the platform-wide audit trail via the AppToolbar `Activity` tab; operators auditing platform changes; security/compliance reviewers — gated by NOTHING at the route layer, so the audience is "every authenticated user" under LOGIN_FORM/OAUTH2/LDAP and "every caller able to reach the application port" under DISABLED]

## dependencies_semantic

- requires-feature: [Activity Feed feature in the platform UI — the route only makes sense when the `<Activity>` component tree is mounted in `App.tsx:65`. Backend dependency: the route's `<Activity>` component dispatches `fetchActivityCounts` + `fetchActivityList` thunks (`redux/thunks/activity.thunks.ts:22-103`) which call `activityApi.getActivity` + `activityApi.getActivityCounts` → backed by `ActivityController.getActivity` / `getActivityCounts` (sidecar: `odd-platform__java__ActivityController__controller-method__getActivity.md`).]
- requires-config: []
- requires-runtime: [react-router-dom — the consumer (`App.tsx:65`) passes the string into React Router's `<Route path>` and `<Link to>`; this module itself imports nothing from react-router-dom.]
- additional_coupling:
  - "Exposed via `routes/index.ts:7` (`export * from './activityRoutes'`), so consumers import from `'routes'` rather than the file directly — refactoring the file path is safe; renaming `activityPath` breaks every consumer."
  - "The global Activity tab in `ToolbarTabs.tsx:77` deep-links via `activityPath(activityQueryString)` where `activityQueryString` is derived from `defaultActivityQuery` (`components/shared/elements/Activity/common.ts:36-41`). Changing `BASE_PATH` here would break the toolbar tab silently (no test coverage)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`activityPath()` returns the bare base path `/activity` when called with no argument."
    test_class: unit
    criticality: LOW
  - behaviour: "`activityPath('size=30&type=ALL')` concatenates the query with a single `?` prefix yielding `/activity?size=30&type=ALL`."
    test_class: unit
    criticality: LOW
  - behaviour: "`activityPath('?already-prefixed')` produces `/activity??already-prefixed` (double-`?` bug surfaces if a caller mistakenly pre-prefixes the query)."
    test_class: unit
    criticality: LOW
    note: "Edge-case the type signature does not prevent — `query` is typed as `string | undefined`, not as a non-`?`-prefixed string."
  - behaviour: "Visiting `/activity` unauthenticated under `auth.type=DISABLED` renders `<Activity />` and surfaces platform-wide audit-trail data."
    test_class: security
    criticality: HIGH
    note: "Backend gate is the only protection; no route-layer guard. See P-166 + ActivityController sidecar."
  - behaviour: "Visiting `/activity` as a no-owner / no-role authenticated user under LOGIN_FORM/OAUTH2/LDAP renders the page and returns cross-owner activity rows (the `type=ALL` default does not honour owner scope)."
    test_class: security
    criticality: HIGH
- test_files: []
- gaps: |
    No unit tests target this module or any other module under
    `odd-platform-ui/src/routes/`. Directory-wide gap. The security-class
    gap (Activity feed surface visible to all authenticated users — and to
    unauthenticated callers under DISABLED) is the load-bearing gap; the
    unit-class behaviours are nice-to-have but the security-class behaviours
    are what an operator would want documented.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "The Activity Feed feature page is the canonical user-facing doc for what this UI route surfaces. The page's `Where to find it` section describes both the `Global Activity page` (this route) and the `Per-entity Activity tab` (under `/dataentities/:id/activity`, not this route). The page's `Filters on the global Activity page` section enumerates the seven facets that map to the `ActivityQuery` fields (`datasourceId`, `namespaceId`, `eventType`, `tagIds`, `ownerIds`, `userIds`, calendar)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      H1: "Activity Feed"
      H2 list: "Where to find it", "Filters on the global Activity page",
      "Event types", "Auto-resolved alert events", "Configuration",
      "Where to next".
      "Where to find it" verbatim:
        "Global Activity page — top-level Activity entry in the platform's
        navigation. Shows every event across the catalog with a seven-facet
        filter panel (see below).
        Per-entity Activity tab — every data-entity detail page has an
        Activity tab that scopes the feed to events on that entity only
        (plus a few additional internal event types — entity overview /
        metadata / schema / relation updates and custom-metadata create /
        update / delete — that are recorded on the per-entity tab but
        hidden from the global filter to keep that view concise)."
      User filter description verbatim:
        "show events performed by one or more selected users (multi-select).
        Useful for auditing a specific person's platform activity."
      Owner filter description verbatim:
        "show events on entities with one or more selected owners
        (multi-select). Useful for 'what happened to my team's data
        this week'."
- doc_drift_findings:
  - "The live doc page's User filter description ('show events **performed by** one or more selected users') promises filtering by who-performed-the-action, but the Filters component (`components/Activity/Filters/Filters.tsx:93-98`) binds `userIds` to a query parameter that — per the existing `ActivityController.getActivity` sidecar and LSN-020 — translates at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (i.e. filters by owner-of-entity via the user-owner mapping). The doc copy reinforces the wrong promise: a user without an owner mapping returns empty; reassigning a user-owner association retroactively rewrites who looks responsible for past actions. This is the same drift category as LSN-020, surfaced now at the UI layer where the operator first encounters the misleading label. The doc page does NOT warn about this translation."
  - "The doc page does not enumerate the four tabs (`All` / `My Objects` / `Downstream` / `Upstream`) implemented at `ActivityTabs.tsx:29-51`. The page's only navigation discussion is the global-vs-per-entity split. Surface as documentation gap — DOC-NNN candidate."
  - "The doc page contains NO discussion of access control / who can view the global Activity page. The page is reachable by every authenticated user (and by every caller under `auth.type=DISABLED`); an operator reading the doc would not know the global audit trail is platform-wide visible. Surface as documentation gap — DOC-NNN candidate."

## implicit_adrs

- "Route modules under `odd-platform-ui/src/routes/` declare `BASE_PATH` as a file-private inline `const` rather than importing from a shared routes module — `activityRoutes.ts:1` follows the same pattern as `alertsRoutes.ts:1`, `dataEntitiesRoutes.ts:4`, `directoryRoutes.ts:4`, `managementRoutes.ts:3`, `masterDataRoutes.ts:1`, `searchRoutes.ts:3`, `termsRoutes.ts:4` (verified via the alerts sidecar's grep across all eight non-index modules)." — evidence: activityRoutes.ts:1 + the routes-directory pattern — intent_anchor: "consistent pattern across all eight route modules in the directory" — confidence: HIGH
- "The Activity feature encodes its sub-views (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`) as a `type` query parameter rather than as URL path segments, deliberately diverging from the alerts pattern (which uses `/alerts/all`, `/alerts/my`, `/alerts/dependents` path segments declared in `AlertsRoutes`). This means deep-linking a colleague to 'my activity feed' yields `/activity?type=MY_OBJECTS` (a query) rather than `/activity/my` (a path)." — evidence: activityRoutes.ts:1-7 (no sub-paths) + components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51 (four ActivityType values rendered as in-page tabs) + components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:58-61 (tab clicks call `setQueryParams(... type ...)`) — intent_anchor: "tab dispatch via setQueryParams on the `type` field rather than via React Router navigation to a sub-path" — confidence: HIGH

## bugs_limitations_corner_cases

- "The route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper. Unlike `lookupTablesPath()` at `App.tsx:75-87` — which gates render on `LOOKUP_TABLE_CREATE | UPDATE | DELETE` permissions — the Activity route is rendered for every authenticated user regardless of role / owner / permission. The platform-wide audit trail is therefore globally visible. Note also (ZH systemic finding): even where `WithPermissionsProvider` IS used, it ONLY provides a permission CONTEXT for descendants to consult; it does NOT block render or redirect on its own (`components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49` — all three render branches unconditionally render the child). So even the lookup-tables protection is contextual / non-blocking. For Activity, there is no protection at all. The only effective gate is the backend `ActivityController.getActivity` — which itself (per its sidecar) has NO `@PreAuthorize` and falls through to the default `pathMatchers('/**').authenticated()` rule, meaning any authenticated user sees cross-owner audit data, and under `auth.type=DISABLED` any unauthenticated caller does too." — evidence: components/App.tsx:65 (no wrapper) + components/App.tsx:75-87 (lookup-tables wrapper for comparison) + components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49 (non-blocking pattern) + ActivityController sidecar (no @PreAuthorize) — severity: HIGH
- "`activityPath('?already-prefixed')` produces `/activity??already-prefixed`. The type signature is `query?: string`; nothing prevents the caller from pre-prefixing. `ToolbarTabs.tsx:77` correctly passes the unprefixed `activityQueryString` derived from `useQueryParams(...).defaultQueryString`, but a future caller could regress." — evidence: activityRoutes.ts:3-6 (no `?`-strip guard) + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77 — severity: LOW
- "Renaming `BASE_PATH` here breaks the AppToolbar tab silently — no test coverage anywhere under `odd-platform-ui/src/routes/`. Same directory-wide gap as `alertsRoutes` (per its sidecar)." — evidence: activityRoutes.ts:1-7 + alerts sidecar's `find odd-platform-ui/src -name '*.test.*'` result — severity: LOW
- "The route does not implement a redirect from `/activity` (bare) to `/activity?<defaults>` — visiting `/activity` directly relies on the consumer (`ActivityResults.tsx:26`) calling `useQueryParams<ActivityQuery>(defaultActivityQuery)` which fills in defaults at the React-state layer but does NOT push them into the URL. The URL stays `/activity` (no query string visible to the user) while the page renders the default 6-day window with `type=ALL`. Sharing the URL with a colleague then surfaces the same default 6-day window relative to THEIR `now`, not the original visitor's `now` — silent semantic drift across share-time. This is by design (the `defaultActivityQuery` is recomputed each render), but operators who expect 'the URL I shared = the view I saw' will be surprised." — evidence: activityRoutes.ts:1-7 (no redirect logic) + components/shared/elements/Activity/common.ts:33-41 (`beginDate`/`endDate` computed via `addDays(new Date(), -5)` / `+1` — recomputed at module-eval time, not URL-stamped) — severity: MEDIUM
- "Backend `userIds` filter does not honour the parameter name (LSN-020) — bound to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` not to `activity.created_by`. The UI Filters panel (`components/Activity/Filters/Filters.tsx:93-98`) labels the filter `t('User')` — and the live doc reinforces the wrong promise — but the SQL filters by owner-of-entity. The label is operator-misleading; this is the route's most material LSN-020 exposure point." — evidence: components/Activity/Filters/Filters.tsx:93-98 + ActivityController.getActivity sidecar (`ReactiveActivityRepositoryImpl.java:272-273`) + LSN-020 — severity: HIGH

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components/shared/elements/Activity/common.ts:33-34"
      name: "default-window: beginDate / endDate"
      value: "startOfDay(now - 5 days) / endOfDay(now + 1 day) (a ~6-day window)"
      questions:
        - q: "What at window > 5 days back / future-dated > 1 day ahead?"
          a: "The user can override via the CalendarFilter. The backend (`ActivityServiceImpl.java:98-100`) rejects `null` for either bound but does not cap the range; LSN-019/LSN-020 sister probes have not measured the row-volume budget for wide windows. The 6-day default is a UI choice, not enforced server-side."
          confidence: STATIC-INFERRED
          evidence: "components/shared/elements/Activity/common.ts:33-34 + ActivityServiceImpl.java:98-100 (referenced via ActivityController sidecar)"
        - q: "What does the operator see at each boundary?"
          a: "Empty result set if the chosen window has no events; bounded by `size=30` per fetch and cursor-paginated via `(lastEventId, lastEventDateTime)`. Operator sees only the most-recent 30 events per type-tab on initial load; infinite-scroll fetches more (`ActivityResults.tsx:52-63`)."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/ActivityResults/ActivityResults.tsx:52-63 + redux/thunks/activity.thunks.ts:20-51"
    - location: "redux/thunks/activity.thunks.ts:20"
      name: "activityListSize"
      value: "30"
      questions:
        - q: "What at N=0 / negative / very large?"
          a: "Hard-coded constant — no operator-tunable surface. The backend `size` parameter (`ActivityApiGetActivityRequest`) accepts arbitrary integers; the UI passes 30. A consumer that wanted a different size would have to override `defaultActivityQuery` at the call site."
          confidence: STATIC-INFERRED
          evidence: "redux/thunks/activity.thunks.ts:20 + components/shared/elements/Activity/common.ts:39"
        - q: "What does the operator see at each boundary?"
          a: "30 events per page; infinite scroll fetches subsequent pages via cursor. Operator sees no UI control to change page size."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/ActivityResults/ActivityResults.tsx:52-63"
  name_behavior_pairs:
    - name: "activityPath"
      promise: "Build the URL for the Activity feature surface, optionally with a query string"
      implementation: "Returns `'/activity'` when called with no argument, or `'/activity?' + query` when called with a query argument (note the `?` is prepended, NOT verified-absent — pre-prefixed callers yield `'?'+'?'+'key=val'`)."
      drift: MINOR
      operator_visible_consequence: "Caller passing `'?key=val'` (mistaken pre-prefix) produces `/activity??key=val` — broken URL; no type-level guard. Today the one production caller (`ToolbarTabs.tsx:77`) passes the unprefixed `activityQueryString`, so no live impact, but a future caller could regress."
      confidence: STATIC-INFERRED
      evidence: "activityRoutes.ts:3-6"
    - name: "/activity (the URL itself, vs the live doc's 'global Activity page')"
      promise: "Doc page describes this as the platform-wide audit trail showing every event across the catalog with a seven-facet filter panel."
      implementation: "Matches the description — `<Activity />` at App.tsx:65 renders Filters + ActivityResults which fires `fetchActivityList` with `type=ALL` by default → `GET /api/activity` → cross-owner audit feed."
      drift: NONE
      operator_visible_consequence: "N/A"
      confidence: STATIC-INFERRED
      evidence: "components/App.tsx:65 + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (2026-05-26, status 200)"
  orderings: []
  auth_gates:
    - location: "components/App.tsx:65"
      endpoint: "Route /activity"
      questions:
        - q: "What does this route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "No route-level guard exists at this layer. The route mount is `<Route path={activityPath()} element={<Activity />} />` — NO `WithPermissionsProvider`, NO redirect-on-no-owner, NO conditional render. Under all four auth modes, hitting `/activity` mounts `<Activity />` and fires `fetchActivityList`. The backend `GET /api/activity` (per ActivityController sidecar) has no `@PreAuthorize`, falls through to the default `pathMatchers('/**').authenticated()` rule under LOGIN_FORM/OAUTH2/LDAP, and to `.anyExchange().permitAll()` under DISABLED. So under DISABLED the page renders for any caller; under the other three modes any authenticated user (regardless of role/owner) gets the full cross-owner audit feed."
          confidence: PROBE-NEEDED
          evidence: "P-166"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "Under DISABLED: the SPA bundle is served (no auth on static assets), `<Activity />` renders, `fetchActivityList` fires, the API returns rows. Under LOGIN_FORM/OAUTH2/LDAP: the API call should 401 and the UI's `handleResponseAsyncThunk` should surface an error — BUT the SPA bundle itself is typically served by the same Spring Security config (path-pattern-based, not auth-required for static assets) and the React route renders an empty `<Activity />` shell. Verify via P-166."
          confidence: PROBE-NEEDED
          evidence: "P-166"
        - q: "What does a wrong-role caller see (e.g. a READ_ONLY-equivalent role under LOGIN_FORM)?"
          a: "No role-based gate exists anywhere in the chain — neither the React route nor `ActivityController` nor the `ActivityApi` generated interface carries a role check. Any authenticated user, regardless of role, sees the same cross-owner audit feed when `type=ALL` (the default). The only owner-scope narrowing happens when the user manually selects the `My Objects` tab (which sets `type=MY_OBJECTS` and routes through `authIdentityProvider.fetchAssociatedOwner()` in the service layer)."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:65 + ActivityController sidecar (no @PreAuthorize) + components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51"
        - q: "Where does the gate live — route, service, repository, or nowhere?"
          a: "**Nowhere** for the global cross-owner view (`type=ALL` / default). The `MY_OBJECTS` tab applies an owner-scope at the service layer (`ActivityServiceImpl.fetchMyActivities` per the ActivityController sidecar). `DOWNSTREAM` / `UPSTREAM` tabs walk the lineage graph but apply no caller-ownership filter — anyone authenticated can ask 'what changed upstream of entities I am downstream of?' for any data entity. So the answer is: gate is at the user's tab choice (a UI affordance), not at any code layer."
          confidence: STATIC-INFERRED
          evidence: "components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51 + ActivityController sidecar"
  resource_boundaries: []
  request_inputs:
    - location: "activityRoutes.ts:3"
      input_kind: query-param
      input_name: "query (the function parameter — opaque pass-through string)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised>. `query` is an opaque string passed to the URL builder; it does not promise any particular field semantics. The semantic-bearing names live one layer up in `ActivityQuery` (`tagIds`, `ownerIds`, `userIds`, `eventType`, `datasourceId`, `namespaceId`, `type`)."
          confidence: STATIC-INFERRED
          evidence: "activityRoutes.ts:3"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "String-concatenated into the URL after a literal `?`. No parsing, no validation, no escaping — pass-through."
          confidence: STATIC-INFERRED
          evidence: "activityRoutes.ts:4-5"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — generic `query` parameter, used as a generic URL query string."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "activityRoutes.ts:3-6"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation."
          confidence: STATIC-INFERRED
          evidence: "activityRoutes.ts:3-6"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE at this layer. The Category F load-bearing finding is one layer down at the Filters component — the `userIds` filter (`components/Activity/Filters/Filters.tsx:93-98` labelled `t('User')`) IS the LSN-020 instance. The UI labels the filter `User` (promising 'filter by who performed the action'), the backend SQL binds to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (per ActivityController sidecar + LSN-020). The available-but-unused column is `activity.created_by` — read in the LEFT JOIN, never filtered. Recorded here as a REFERENCE to the ActivityController sidecar where the trace lives."
          confidence: REFERENCE
          evidence: "odd-platform__java__ActivityController__controller-method__getActivity"
      routes_to_finding: "bugs_limitations_corner_cases (the WithPermissionsProvider absence finding) AND docs_link_semantic.doc_drift_findings (the User-filter doc claim and the missing access-control discussion)"
  probes_emitted:
    - probe_id: P-166
      question: "Auth gate on /activity — does the route render for unauthenticated callers under DISABLED, and for no-role/no-owner authenticated users under LOGIN_FORM/OAUTH2/LDAP?"
      probe_path: "lineage/odd-platform/probes/P-166.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 16
    answers_static_inferred: 13
    answers_probe_needed: 2
    answers_reference: 1
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` for this declarative module — the file exports a plain URL builder; auth-mode enforcement happens at the consumer (`App.tsx:65` mounts the route with no `WithPermissionsProvider`) and downstream at `ActivityController` (no `@PreAuthorize`, falls through to default `.authenticated()` under LOGIN_FORM/OAUTH2/LDAP and `.permitAll()` under DISABLED). The route module ITSELF has no auth predicate. — evidence: activityRoutes.ts:1-7 (no auth-related imports or branches).
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag gates only `POST /ingestion/entities` server-side.
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped` at this layer. The Owner-based narrowing happens via the user-selected `type` tab in `ActivityTabs.tsx:29-51` (`MY_OBJECTS` routes through `authIdentityProvider.fetchAssociatedOwner()` in the service); `ALL` / `DOWNSTREAM` / `UPSTREAM` are unscoped. The route module emits the URL unconditionally and the consumer mounts unconditionally.
- **data_exposure**: `"The literal string '/activity' is emitted into the rendered JS bundle (non-secret URL); the page that mounts there exposes the platform-wide audit trail (every event across every owner) → audience is every authenticated user under LOGIN_FORM/OAUTH2/LDAP, every caller under DISABLED. Audit data includes old_state/new_state of description text, tag assignments, ownership changes, custom-metadata values, dataset-field internal names, and business names — see ActivityController.getActivity sidecar for the full payload shape."` — evidence: components/App.tsx:65 + ActivityController sidecar.
- **known_security_gaps**:
  - "Route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper — unlike `lookupTablesPath()` at `App.tsx:75-87`. Combined with the backend `ActivityController` having no `@PreAuthorize`, this means the platform-wide audit trail (cross-owner activity, including ownership-change events that reveal user-owner associations) is visible to every authenticated user. Under `auth.type=DISABLED` it is visible to every caller able to reach the application port." — evidence: components/App.tsx:65 vs. components/App.tsx:75-87 + ActivityController sidecar — severity: HIGH
  - "Even when `WithPermissionsProvider` IS used elsewhere, it ONLY provides a permission context for descendants to consult — it does NOT block render or redirect. All three branches of `components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49` unconditionally render the child. Mentioned here (1) so the maintainer does not assume the wrapper is sufficient if added later to this route, and (2) as the ZH systemic finding's UI-side instance — the wrapper is named like a gate but behaves like a context." — evidence: components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49 — severity: HIGH
  - "Doc page's 'User' filter description ('show events **performed by** one or more selected users') misleads operators about what the filter actually does. The `userIds` query parameter binds at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (per LSN-020). A security/compliance reviewer setting `userIds = [insider-suspect-id]` to audit that user's actions would get rows of activity on entities OWNED BY that user-via-mapping, NOT actions PERFORMED BY that user. Misses the actual actor (`activity.created_by`) entirely." — evidence: components/Activity/Filters/Filters.tsx:93-98 + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (2026-05-26, 200) + ActivityController sidecar + LSN-020 — severity: HIGH

## performance

- **hot_paths**: `"activityPath(query?)` is invoked at component render time by `ToolbarTabs.tsx:77` (global toolbar, rendered on every navigation). The function body is one truthy check + one template-literal concatenation — O(1), negligible cost." — evidence: activityRoutes.ts:3-6 + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77.
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path.`
- **resource_allocation**: `Trivial — one BASE_PATH constant + one function. Bundle-size cost is a few dozen bytes after minification.` — evidence: activityRoutes.ts:1-7.
- **scaling_characteristics**: `Stateless and pure — `activityPath` is referentially transparent (closure-free, no module-level mutation, no side effects).` — evidence: activityRoutes.ts:3-6.
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/ (root SPA mount → toolbar always-rendered)"
  caller_node: "ts react-component:ToolbarTabs.tsx (components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx)"
  multiplicity_per_trigger: 1
  evidence: "components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:13 (import) + :77 (link: activityPath(activityQueryString)) — called once per ToolbarTabs render to populate the Activity tab's `link`. The toolbar re-renders on each navigation; ToolbarTabs memoises the tabs list on `[activityQueryString, t]` dependencies so the function fires once per memo invalidation."
  observation_class: ui-call
- entry_point: "ui_route:/ (SPA root mount → App.tsx Routes declaration)"
  caller_node: "ts react-component:App.tsx (components/App.tsx)"
  multiplicity_per_trigger: 1
  evidence: "components/App.tsx:14 (import) + :65 (<Route path={activityPath()} element={<Activity />} />) — called once per App render to populate the React Router path."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns the literal string `'/activity'` or `'/activity?' + query` — emitted into React Router's path-matching machinery (App.tsx:65) and into <Link to> targets (ToolbarTabs.tsx:77). Subsequent user navigation to that URL triggers the lazy-loaded `<Activity />` component, which dispatches `fetchActivityList` + `fetchActivityCounts` thunks → `GET /api/activity` + `GET /api/activity/counts`. The terminal user-observable effect is the global Activity Feed page rendering with the platform-wide audit trail."
  evidence: "activityRoutes.ts:3-6 (the function body) + components/App.tsx:65 (route mount) + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77 (toolbar link) + components/Activity/ActivityResults/ActivityResults.tsx:47-50 (thunk dispatch on mount and queryParams change)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/ (toolbar always-rendered → Activity tab link)"
    - "ui_route:/activity (direct deep-link / user-typed URL / shared-URL)"

## sources

- understanding ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 + odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/components/Activity/Activity.tsx:1-20 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityResults.tsx:24-90 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51 + odd-platform-ui/src/components/Activity/Filters/Filters.tsx:52-100 + odd-platform-ui/src/components/shared/elements/Activity/common.ts:36-41
- concepts.entities ← odd-platform-ui/src/components/shared/elements/Activity/common.ts:7-19 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51
- concepts.invariants.[BASE_PATH canonical] ← odd-platform-ui/src/routes/activityRoutes.ts:1
- concepts.invariants.[no sub-paths, type via query] ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:58-61
- concepts.invariants.[?-prefix bug shape] ← odd-platform-ui/src/routes/activityRoutes.ts:4
- concepts.invariants.[defaultActivityQuery shape] ← odd-platform-ui/src/components/shared/elements/Activity/common.ts:33-41 + odd-platform-ui/src/redux/thunks/activity.thunks.ts:20
- concepts.audiences.[gated by nothing at route layer] ← odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/components/App.tsx:75-87 (lookup-tables comparison)
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/redux/thunks/activity.thunks.ts:22-103 (thunks → activityApi.getActivity)
- dependencies_semantic.requires-runtime ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 (no imports — react-router is in the consumer)
- dependencies_semantic.additional_coupling ← odd-platform-ui/src/routes/index.ts:7 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77
- tests_coverage_semantic.uncovered_behaviours.[security] ← odd-platform-ui/src/components/App.tsx:65 + ActivityController sidecar (no @PreAuthorize)
- tests_coverage_semantic.gaps ← inherited from alerts sidecar's directory-wide grep (no test files target odd-platform-ui/src/routes)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (2026-05-26, status 200, returned H1 + 6 H2s + filter descriptions verbatim)
- docs_link_semantic.doc_drift_findings.[User-filter promise vs SQL] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (2026-05-26, status 200) + odd-platform-ui/src/components/Activity/Filters/Filters.tsx:93-98 + ActivityController.getActivity sidecar + retrospectives/LSN-020
- docs_link_semantic.doc_drift_findings.[tabs not documented] ← WebFetch (2026-05-26) + odd-platform-ui/src/components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:29-51
- docs_link_semantic.doc_drift_findings.[no access-control discussion] ← WebFetch (2026-05-26) + odd-platform-ui/src/components/App.tsx:65 (no guard)
- implicit_adrs.[inline BASE_PATH pattern] ← odd-platform-ui/src/routes/activityRoutes.ts:1 + the alerts sidecar's verified grep across all 8 route modules
- implicit_adrs.[type as query not sub-path] ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityTabs/ActivityTabs.tsx:58-61 + odd-platform-ui/src/routes/alertsRoutes.ts:2-13 (the contrasting sub-path pattern)
- bugs_limitations_corner_cases.[no WithPermissionsProvider] ← odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/components/App.tsx:75-87 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49 + ActivityController sidecar
- bugs_limitations_corner_cases.[?-prefix bug shape] ← odd-platform-ui/src/routes/activityRoutes.ts:3-6
- bugs_limitations_corner_cases.[no test coverage] ← alerts sidecar inheritance
- bugs_limitations_corner_cases.[default-window time-relative URL share] ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 + odd-platform-ui/src/components/shared/elements/Activity/common.ts:33-41
- bugs_limitations_corner_cases.[userIds filter LSN-020 surface] ← odd-platform-ui/src/components/Activity/Filters/Filters.tsx:93-98 + ActivityController.getActivity sidecar + retrospectives/LSN-020
- stress_findings.tunables ← odd-platform-ui/src/components/shared/elements/Activity/common.ts:33-41 + odd-platform-ui/src/redux/thunks/activity.thunks.ts:20
- stress_findings.name_behavior_pairs ← odd-platform-ui/src/routes/activityRoutes.ts:3-6 + WebFetch (2026-05-26) + odd-platform-ui/src/components/App.tsx:65
- stress_findings.auth_gates ← odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/components/App.tsx:75-87 + ActivityController sidecar + P-166
- stress_findings.request_inputs ← odd-platform-ui/src/routes/activityRoutes.ts:3-6 + odd-platform-ui/src/components/Activity/Filters/Filters.tsx:93-98 + ActivityController sidecar (LSN-020 trace)
- stress_findings.probes_emitted.[P-166] ← lineage/odd-platform/probes/P-166.yaml
- security.auth_mode_relevance ← odd-platform-ui/src/routes/activityRoutes.ts:1-7 + odd-platform-ui/src/components/App.tsx:65 + ActivityController sidecar
- security.data_exposure ← odd-platform-ui/src/components/App.tsx:65 + ActivityController sidecar (cross-owner audit payload)
- security.known_security_gaps.[no WithPermissionsProvider] ← odd-platform-ui/src/components/App.tsx:65 + ActivityController sidecar
- security.known_security_gaps.[WithPermissionsProvider non-blocking] ← odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49
- security.known_security_gaps.[User-filter LSN-020 misleads compliance reviewers] ← odd-platform-ui/src/components/Activity/Filters/Filters.tsx:93-98 + WebFetch (2026-05-26) + retrospectives/LSN-020
- performance.hot_paths.[0] ← odd-platform-ui/src/routes/activityRoutes.ts:3-6 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77
- performance.resource_allocation ← odd-platform-ui/src/routes/activityRoutes.ts:1-7
- performance.scaling_characteristics ← odd-platform-ui/src/routes/activityRoutes.ts:3-6
- upstream_callers.[ToolbarTabs] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:13,77
- upstream_callers.[App.tsx Route] ← odd-platform-ui/src/components/App.tsx:14,65
- downstream_side_effects.[page-render] ← odd-platform-ui/src/routes/activityRoutes.ts:3-6 + odd-platform-ui/src/components/App.tsx:65 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77 + odd-platform-ui/src/components/Activity/ActivityResults/ActivityResults.tsx:47-50

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
- stress_findings: MEDIUM

## Maintainer notes

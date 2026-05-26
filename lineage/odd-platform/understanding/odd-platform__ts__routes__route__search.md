---
node_id: "odd-platform ts routes route:search"
node_kind: route
axis: routes
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZI-search-route
feature_hint: "P-01:F-002 (Search and Filtering — Data Discovery pillar Catalog page). Route-construction module for the Catalog page. Owns the URL form (`/search` or `/search/{searchId}`), the React-Router param hook (`useSearchRouteParams`), and the link generator (`searchPath`). Three downstream consumers — App.tsx:61 (route mount), Search.tsx:27 (param read), useCreateSearch.ts:17 (navigate target), plus ToolbarTabs.tsx:38 + 93 (top-nav tab link + active-tab matchPath). The `searchId` URL parameter is a server-side session UUID (not a saved-search id) — see Stress Protocol Category F."
related_features:
  - F-001
  - F-008
related_pillar_features:
  - "P-01:F-002"
related_retrospectives:
  - LSN-020   # Category F is mandatory for every named request input — including UI route params
  - LSN-023   # do not enrich a backend understanding of `searchId` without checking what the UI form/route means by it
---

# searchRoutes.ts — semantic understanding

## understanding

`searchRoutes.ts` (lines 1-19) is the route-construction module for the Catalog page at `/search`. It exposes (a) `searchPath(searchId?)` — a 6-line link generator that returns either `/search` (no arg) or `/search/{searchId}` (with arg), used by `App.tsx:61` to declare the `<Route path={'/search/*'} element={<Search/>}/>` mount, by `useCreateSearch.ts:17` to navigate to the freshly-created session, and by `ToolbarTabs.tsx:38` for the top-nav "Catalog" tab link; and (b) `useSearchRouteParams()` — a 2-line React-Router hook wrapper that returns `{searchId: string}` extracted from `useParams()`, consumed by `Search.tsx:27` to detect deep-link arrivals. The `searchId` URL parameter is a **server-side search-session UUID** (a `search_facets.id` row id per batch-M `SearchController.search` invariants) — NOT a saved-search id, NOT an arbitrary query parameter, NOT user-meaningful text. The route declares `/*` wildcard at App.tsx:61 so descendant pages (currently only `<Search/>` itself; no nested routes are declared in the Search component tree) can extend; today no descendant uses it.

## concepts

- entities:
  - "BASE_PATH (module-level constant `/search` at searchRoutes.ts:3 — the URL root for the Catalog page; consumed verbatim by App.tsx:61, useCreateSearch.ts:17 via searchPath(), ToolbarTabs.tsx:38 + 93)"
  - "SEARCH_ID_PARAM (module-level constant `:searchId` at searchRoutes.ts:4 — the React-Router path template segment)"
  - "SEARCH_ID (module-level constant `searchId` at searchRoutes.ts:5 — the param name used by both `generatePath` and `useParams`)"
  - "SearchRouteParams (TypeScript interface at searchRoutes.ts:14-16 — `{searchId: string}`; literal shape returned by the param hook)"
  - "searchPath (exported function at searchRoutes.ts:7-12 — link generator; signature `(searchId?: string) => string`; returns `/search` when called with no arg, `/search/{uuid}` otherwise)"
  - "useSearchRouteParams (exported hook at searchRoutes.ts:18-19 — thin wrapper over `useParams<keyof SearchRouteParams>()` with a type cast)"
  - "Server-side search session UUID (the actual semantic content of the `:searchId` URL segment — a `search_facets` row UUID generated server-side per batch-M SearchController.search; the route module is unaware of this — it just transports a string)"
- operations:
  - "Generate a link to the Catalog root: `searchPath()` returns `/search` (searchRoutes.ts:11 — the fallback branch). Used by App.tsx:61 to declare the route mount (`searchPath() + '/*'`), by ToolbarTabs.tsx:38 for the 'Catalog' top-nav tab link, by ToolbarTabs.tsx:93 for the active-tab matchPath."
  - "Generate a link to a specific search session: `searchPath(uuid)` returns `/search/{uuid}` via `generatePath('/search/:searchId', {searchId: uuid})` (searchRoutes.ts:9). Used ONLY by useCreateSearch.ts:17 — after `createDataEntitiesSearch` thunk resolves with the server-issued `searchId`, the hook `navigate(searchPath(searchId))` so the URL bar carries the new session UUID."
  - "Extract the `searchId` from the current URL: `useSearchRouteParams()` returns `{searchId: string}` via `useParams<keyof SearchRouteParams>()` (searchRoutes.ts:18-19). Used ONLY by Search.tsx:27 — the orchestrator reads `routerSearchId` to decide between session-create (no param → call createSearch) and session-restore (param present → dispatch getDataEntitiesSearch)."
- invariants:
  - "**Route ALWAYS mounts at `/search/*` wildcard, never as a discrete `/search` + `/search/:searchId` pair.** App.tsx:61 declares ONE route: `<Route path={\`${searchPath()}/*\`} element={<Search/>}/>`. This means `/search`, `/search/abc-def`, `/search/anything-at-all/nested/garbage` ALL render the same `<Search/>` component; the wildcard does NOT impose a 'must be UUID' shape. React-Router will happily route `/search/<arbitrary-string>` to `<Search/>` — the validation happens implicitly later, when `Search.tsx:44-48` calls `getDataEntitiesSearch({searchId: routerSearchId})` → `GET /api/search/{searchId}` → returns 404 if the UUID is not a real `search_facets` row. See bugs[1] for the operator-visible consequence."
  - "**`searchId` is a SERVER-SIDE session UUID, not a saved-search id, not a query parameter.** The route segment receives a `search_facets.id` value that was minted by `SearchController.search` (POST /api/search) on a previous click. There is NO 'saved search' feature in ODD — the `search_facets` row TTL / cleanup story is unspecified at this layer (see Stress Protocol Category F). The URL form `/search/{uuid}` permits link-sharing of a session's current state (query + facets + my-objects toggle), but the recipient sees state as of the LAST `updateSearchFacets` mutation on the sender's side — and once the row is reaped (if it ever is), the deep-link 404s."
  - "**No route guard. No permission wrapper. No authentication shim at this layer.** searchRoutes.ts:1-19 is pure path-construction + param-extraction. The route mount at App.tsx:61 does NOT wrap `<Search/>` in `<WithPermissionsProvider>` (contrast with `lookupTablesPath()` at App.tsx:75-88 which IS wrapped). The Catalog page is accessible to ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP — and accessible to UNAUTHENTICATED traffic when `auth.type=DISABLED`. There is no UI-side gate, no role check, no permission check at the route level. See Stress Protocol Category D + bugs[2]."
  - "**No URL state beyond the session UUID — no query-string params, no hash fragments.** The Catalog page does not encode any state in `?param=value` or `#anchor` form. The session UUID is the ONLY URL-bearing state. Implication: a user filtering by 'Datasource=Snowflake' cannot share JUST the filter — they must share their session UUID, and the recipient sees whatever state the SESSION has at fetch time (not necessarily what the sender intended)."
  - "**The two exported APIs (`searchPath` + `useSearchRouteParams`) use the same source constants — drift-resistant.** Both reference the module-level constants `BASE_PATH` (line 3), `SEARCH_ID_PARAM` (line 4), `SEARCH_ID` (line 5). A rename of the param requires editing exactly one line; both the link generator and the param-hook stay in sync. This is intentional cohesion — the sister route modules (`alertsRoutes.ts`, `dataEntitiesRoutes.ts`, etc., per routes/index.ts) follow the same shape."
  - "**`searchPath(undefined)` and `searchPath()` both return `/search` (no trailing slash, no `/undefined`).** The function explicitly guards `if (searchId)` at line 8; only the truthy branch calls `generatePath`. This is the contract App.tsx:61 relies on when constructing the wildcard mount `searchPath() + '/*'` → `/search/*`."
- audiences:
  - "odd-platform-ui-end-user — every user of the Catalog page traverses this route (URL bar shows `/search` then `/search/{uuid}` after first mount)"
  - "platform-operator — when troubleshooting 'user reports a stale catalog view', the operator sees the session UUID in the URL bar; the row lives in `search_facets` table; the operator can `SELECT * FROM search_facets WHERE id = '{uuid}'` to inspect the persisted state"
  - "tab-switching-user — the top-nav 'Catalog' tab (ToolbarTabs.tsx:38) always links to `/search` (no UUID), meaning a tab click DROPS the user's current session and creates a new one on Search.tsx remount (Search.tsx:37-42 fires `createSearch` because `routerSearchId` is now undefined). See bugs[3]."

## dependencies_semantic

- requires-feature:
  - "F-001 / P-01:F-002 Search and Filtering (Data Discovery pillar Catalog page) — this route module is the URL surface that mounts the Catalog page; behaviour at `/search/{uuid}` depends on the server-side `search_facets` row persistence model owned by batch-M SearchController.search."
- requires-config:
  - "(none) — no application.yml / env-var / feature-flag controls the route. The path is hardcoded at line 3. No operator-tunable shape."
- requires-runtime:
  - "`react-router-dom` — `generatePath` (line 1; used at line 9) and `useParams` (line 1; used at line 19). Library version: react-router-dom 6.x per odd-platform-ui/package.json (not directly verified at this node's scope)"
  - "TypeScript — the `keyof SearchRouteParams` type cast (line 19) is a compile-time-only concern; at runtime `useParams()` returns whatever the URL contains"
- couples-to:
  - "App.tsx:61 — declares `<Route path={\`${searchPath()}/*\`} element={<Search/>}/>`. Route MOUNT consumer; passes the path through unmodified."
  - "Search.tsx:27 — destructures `{searchId: routerSearchId} = useSearchRouteParams()`. Param-READ consumer; decides session-create vs session-restore based on truthiness."
  - "useCreateSearch.ts:17 — calls `searchPath(searchId)` after `createDataEntitiesSearch` resolves. Link-GENERATE consumer; the URL bar gets the new session UUID immediately after server creation."
  - "ToolbarTabs.tsx:38 — top-nav 'Catalog' tab `link: searchPath()` (no UUID). Tab-LINK consumer."
  - "ToolbarTabs.tsx:93 — active-tab detection `matchPath(\`${searchPath()}/*\`, pathname)`. Path-MATCH consumer; highlights the Catalog tab when the URL is on any `/search/*` page."
  - "routes/index.ts:6 — re-exports `searchPath` + `useSearchRouteParams` via `export * from './searchRoutes'`."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`searchPath(uuid)` returns `/search/{uuid}` for a valid string"
    test_class: unit
    criticality: LOW
    note: "Trivial — but the absence of ANY test for this module is symptomatic. A 19-line route module with three exported APIs and zero tests."
  - behaviour: "`searchPath()` (no arg) and `searchPath(undefined)` both return `/search` (no trailing slash, no '/undefined' literal)"
    test_class: unit
    criticality: LOW
  - behaviour: "`useSearchRouteParams()` returns `{searchId}` matching the current URL param"
    test_class: integration
    criticality: LOW
    note: "Requires React-Router test wrapper; cheap but absent."
  - behaviour: "End-to-end: a user navigating to `/search/<garbage-string>` (not a real UUID) sees an empty-state / error, not a crash"
    test_class: integration
    criticality: MEDIUM
    note: "bugs[1] — no test asserts the failure mode. A 404 from `GET /api/search/{garbage}` may be silently swallowed by the redux thunk's error handler; the operator sees an empty results view, indistinguishable from 'zero matches'."
  - behaviour: "Deep-link sharing: a `/search/{uuid}` URL opened by a second user (assuming both authenticated) renders the same facet state as the originator"
    test_class: integration
    criticality: MEDIUM
    note: "Per batch-M SearchController invariants the search session has NO user binding — REFACTOR-344. Any authenticated user with the UUID can fetch the session. No test asserts this is intended (vs accidental enumeration risk). See bugs[4]."
- test_files: []
- gaps: |
    Zero tests for this module. The route construction is trivial enough that
    unit tests would be ceremonial; the load-bearing behaviour is integration —
    the deep-link 404 path, the session-share visibility model, and the
    tab-click-drops-session UX. None of those are asserted anywhere.
    Worst test_class gap: **integration** — the absence of `/search/{uuid}`
    end-to-end tests means a server-side change to `search_facets` row TTL
    (if one were ever introduced) could silently break deep-link sharing
    without any CI signal.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: "(none)"
    rationale: "The only operator-facing doc that describes the Catalog page. WebFetched 2026-05-26 status 200."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "**The live doc page does NOT mention the `/search/{searchId}` URL form at all.** WebFetched 2026-05-26: the page describes free-text + faceted search and lists the 7 facets, but the entire URL-shape / session-persistence / deep-link-sharing story is undocumented. An operator reading the doc has no way to know that (a) the URL bar carries a session UUID, (b) the UUID is shareable, (c) the UUID represents a persisted server-side row, (d) tab-clicking the 'Catalog' tab drops the session. This is documentation absence, not contradiction — the doc-gap-finder reducer should surface this as a DOC-NNN candidate."
  - "**The live doc page does NOT mention the access model for the Catalog page.** No statement of 'every authenticated user can search' or 'search is read-collaborative'. Operators have to infer the absence of access-controls. Routes to bugs[2] + the security section."

## implicit_adrs

- "**Server-side search session model with URL-backed UUID.** The decision to persist search sessions server-side (vs encoding state in query-string params or localStorage) is encoded in this module by EXPOSING the `searchId` as a path segment rather than a query string. evidence: searchRoutes.ts:4 (`SEARCH_ID_PARAM = ':searchId'`) + searchRoutes.ts:9 (`generatePath(\`${BASE_PATH}/${SEARCH_ID_PARAM}\`)`). intent_anchor: \"the SEARCH_ID_PARAM constant declares the URL grammar explicitly; the path-segment form is a deliberate choice over the alternative `?searchId=` query-string form\". confidence: MEDIUM"
- "**Cohesion via single source-of-truth constants.** The three constants `BASE_PATH`, `SEARCH_ID_PARAM`, `SEARCH_ID` (lines 3-5) feed BOTH the link generator and the param hook. evidence: searchRoutes.ts:9 + searchRoutes.ts:19 (both reference `SEARCH_ID`). intent_anchor: \"the constants are module-private; rename safety is the intent — change one constant, both APIs follow\". confidence: HIGH"

## bugs_limitations_corner_cases

- "**No validation that `:searchId` is a real (or even well-formed) UUID before mounting `<Search/>`.** Any string in the segment routes to `<Search/>`; Search.tsx:44-48 then fires `GET /api/search/{garbage}` which returns 404; the redux thunk's `handleResponseAsyncThunk` (per redux/lib/handleResponseThunk pattern) typically surfaces the error as a toast OR silently — the user sees an empty Catalog (zero results) which is indistinguishable from 'no matches' for an authentic search. evidence: searchRoutes.ts:9 (no UUID-shape validation in generatePath, no guard at consumer); App.tsx:61 (no react-router param-pattern constraint like `:searchId(\\w{8}-...)`). severity: MEDIUM"

- "**No UI route guard — Catalog page reachable by any authenticated user (and unauthenticated when `auth.type=DISABLED`).** Contrast with App.tsx:75-88 where `lookupTablesPath()` IS wrapped in `WithPermissionsProvider` with `[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE]`. The search route at App.tsx:61 has NO such wrapper. This is consistent with the read-collaborative posture per batch-M SearchController invariants (no per-owner scoping, no permission gate on `POST /api/search`), but it means there's no UI surface to declare 'restrict search to certain roles' even if a deployment wanted it. The backend SECURITY_RULES (SecurityConstants.java:98+) has NO `/api/search` entry — confirmed. ZH batch's `WithPermissionsProvider` non-blocking finding (WithPermissionsProvider.tsx:18-48 — it's a CONTEXT provider, not a gate; always renders children regardless of permission) reinforces that even where it IS used in Search.tsx:81-85, it only context-provides for the `<WithPermissions>` consumer inside Results — the route-mount level is wholly unguarded. severity: MEDIUM"

- "**Clicking the 'Catalog' top-nav tab DROPS the current search session.** ToolbarTabs.tsx:38 links to `searchPath()` (no UUID). When a user has an active session at `/search/{uuid}` and clicks the 'Catalog' tab, the URL becomes `/search` (no param); Search.tsx:37-42 sees `!routerSearchId && !searchId` (Redux is reset on remount? or persists? — see Search.tsx:37-42 logic) and creates a NEW empty session via `useCreateSearch({query:'', pageSize:30, filters:{}})`. The user's previous filter state is lost (the URL no longer points at the prior UUID). This may be intentional (a 'fresh catalog view' affordance) but is undocumented. evidence: ToolbarTabs.tsx:38 (`link: searchPath()`) + Search.tsx:37-42. severity: LOW"

- "**Deep-link sharing — `:searchId` UUID has NO user binding; any authenticated user with the UUID can fetch the session.** Per batch-M SearchController.search REFACTOR-344 invariant: the `search_facets` row stores no `created_by` or `owner_id`. Combined with the lack of route guard here, this means: User A shares URL `/search/{uuid}` with User B; User B (authenticated) opens it; the server returns User A's session state regardless of B's identity. This is enumeration-friendly (a UUID guess attack is bounded by 128-bit entropy — not exploitable in practice, but the design lacks a 'this session is yours' contract). evidence: searchRoutes.ts:9 (URL exposes UUID) + batch-M SearchController.search sidecar invariant 'No user binding on search_facets row'. severity: LOW"

- "**The `/*` wildcard at App.tsx:61 (`searchPath() + '/*'`) is broader than necessary.** The Search component tree has no nested routes — the wildcard could be `/search/:searchId?` (optional param) instead. The wildcard accepts `/search/anything/nested/garbage` and renders `<Search/>` with `useParams()` returning `{searchId: 'anything'}` (only the FIRST segment captured by React-Router 6's wildcard semantics). This is harmless today but invites future drift (a developer adding a nested route in the Search subtree may not realise the wildcard already matched the URL). evidence: App.tsx:61 + searchRoutes.ts:9 (the path template declares one param, but the mount uses `/*` wildcard). severity: LOW"

- "**No URL state for ANY filter / facet / query / page-position — only the session UUID.** A user filtering by `Type=Dataset, Owner=Alice` cannot bookmark a URL that encodes that filter; they must rely on the server-side `search_facets` row persisting. If the row TTL is short (or zero — see Stress Protocol Category F, probe P-168), the bookmark breaks. evidence: searchRoutes.ts:14-16 — the interface declares ONLY `searchId`; no `query`, no `filters`. severity: LOW (operator UX — not a bug per se, a design choice that conflicts with typical 'shareable filter URL' patterns in catalog UIs)"

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED
  - "All four modes apply because the route mount at App.tsx:61 has no route-level guard; whoever can reach the SPA reaches `/search/*`. Under DISABLED, unauthenticated users reach the route. Under LOGIN_FORM/OAUTH2/LDAP, the backend's pathMatchers('/**').authenticated() (LoginFormSecurityConfiguration.java:57) blocks unauthenticated API requests — but the SPA shell itself renders before the first API call."
- ingestion_filter_relevance: "N/A — this is a UI route module, not an HTTP handler"
- authorization_assertions: []
  - "(none) — the module imports no `Permission`, contains no `@PreAuthorize`-equivalent, no `WithPermissions` wrapper, no role check. The route declaration in App.tsx:61 likewise has no permission gate."
- owner_scoping: "N/A — route module; no data access at this layer"
- data_exposure:
  - "URL bar exposes session UUID — `/search/{uuid}` is visible in browser history, server access logs, referer headers if any external links are clicked from the Catalog page. The UUID itself is opaque (random 128-bit), but it's the handle to fetch the session's query + facets + last results."
- known_security_gaps:
  - "**No route-level permission gate — Catalog page reachable by every authenticated user without any role check.** evidence: App.tsx:61 (no `<WithPermissionsProvider>` wrapping `<Search/>`) + SecurityConstants.java:98+ (no `/api/search` SecurityRule entry) — confirmed by Grep. severity: MEDIUM (intentional per the read-collaborative posture batch-M SearchController documents, but the absence is undocumented at the doc-page level — operator has no way to know 'search is unrestricted by design')"
  - "**Session UUID enumeration surface — combined with no per-user binding on `search_facets` row, any authenticated user can fetch any session by guessing UUIDs.** evidence: searchRoutes.ts:9 (URL form exposes UUID) + batch-M SearchController.search REFACTOR-344. severity: LOW (128-bit entropy makes guessing impractical; recorded for completeness)"

## performance

- hot_paths: []
  - "Route construction is build-time-cheap (string concatenation in generatePath); not on any latency path."
- throughput_characteristics: "N/A — synchronous string ops"
- resource_allocation: "N/A — no allocation beyond the returned string + interface object"
- scaling_characteristics: "N/A — no state in the module"
- known_performance_gaps: []

## stress_findings

```yaml
stress_findings:
  tunables: []
    # No numeric literals, no @Value, no constants gating behaviour.
    # The three string constants (BASE_PATH, SEARCH_ID_PARAM, SEARCH_ID)
    # are not tunables — they're naming conventions; changing them is a
    # rename, not a tunable.
  name_behavior_pairs:
    - name: "searchPath"
      promise: "Generate a link to the search page. With no arg → the Catalog root. With a string arg → the page for that specific search."
      implementation: "Returns `/search` when called with falsy `searchId` (undefined, empty string, null). Returns `/search/{searchId}` via `generatePath` when truthy. The string arg is NOT validated as UUID-shape, NOT URL-encoded by this function (generatePath performs RFC-3986 segment encoding via React-Router's internal logic). The 'search page' the name promises is the Catalog page in ODD's terminology — verified via App.tsx:61 + ToolbarTabs.tsx:38 (the top-nav tab labelled 'Catalog' is the only entry point that uses searchPath() without an arg)."
      drift: MINOR
      operator_visible_consequence: "`searchPath` is a misleading name for ODD's vocabulary — the doc page calls this 'Catalog'. A new developer searching the codebase for 'Catalog' would not find this module; the search URL `/search` is also the source of the route's name, not the user-visible label. Documenting case-law: the same drift exists for the top-nav tab — labelled 'Catalog' in ToolbarTabs.tsx:38 (t('Catalog')) but the URL/path/route is /search. Either rename the module to `catalogRoutes.ts` (high churn) or document the synonym (low effort)."
      confidence: STATIC-INFERRED
      evidence: "searchRoutes.ts:1-12 + ToolbarTabs.tsx:38 (t('Catalog')) + WebFetched live doc 2026-05-26 status 200 (uses 'Search and Filtering' as the feature label)"
    - name: "useSearchRouteParams"
      promise: "A React-Router hook that returns the route's typed params for the search page."
      implementation: "Wraps `useParams<keyof SearchRouteParams>()` with a type cast to `SearchRouteParams`. At runtime returns whatever `useParams()` returns — a plain object with string properties; the type cast is compile-time only. If the URL is `/search` (no UUID), `useParams()` returns `{}` and the cast asserts it as `{searchId: string}` — meaning consumers read `searchId` as `undefined` despite the type claiming `string`. Search.tsx:27 destructures and uses truthy-check at lines 38 + 45 — handles undefined correctly. But the type lies."
      drift: MINOR
      operator_visible_consequence: "Type-safety lie: TypeScript callers of `useSearchRouteParams()` see `searchId: string` and may forget to handle undefined. Search.tsx:27 happens to handle it correctly via `if (!routerSearchId)` checks, but a new caller could write `useSearchRouteParams().searchId.toUpperCase()` and crash at runtime on the root `/search` URL. The correct type would be `{searchId?: string}` or `{searchId: string | undefined}`."
      confidence: STATIC-INFERRED
      evidence: "searchRoutes.ts:14-19 + Search.tsx:27 + Search.tsx:38 + Search.tsx:45 (correct handling at consumer despite type lie)"
  orderings: []
    # No ORDER BY, no LIMIT, no sort, no aggregation. Route module is
    # pure path-construction.
  auth_gates:
    - location: "searchRoutes.ts:1-19 (no gate present)"
      endpoint: "(module exposes link generator + param hook; no endpoint)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "N/A at this layer — the module is route-construction, not request-handling. The route MOUNT at App.tsx:61 has no permission wrapper; the React-Router declaration is identical across auth modes. The downstream behaviour depends on whether the SPA shell is reachable at all — under DISABLED, unauthenticated users render the SPA and hit `/search`. Under LOGIN_FORM/OAUTH2/LDAP, an unauthenticated user trying to load the SPA is redirected to login by the backend's pathMatchers('/**').authenticated() at LoginFormSecurityConfiguration.java:57. Once the SPA loads, the route always renders `<Search/>` regardless of role."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:61 + LoginFormSecurityConfiguration.java:56-57 + SecurityConstants.java:98+ (no /api/search SecurityRule)"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: the Catalog page renders normally; POST /api/search succeeds with no auth context (per batch-M SearchController invariants). Under LOGIN_FORM/OAUTH2/LDAP: the user is redirected to the login page by the backend before the SPA shell loads."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:61 + LoginFormSecurityConfiguration.java:55-58"
        - q: "What does a wrong-role caller see?"
          a: "No role distinction at this layer. Every authenticated user sees the same Catalog page UI. The 'Add group' CTA inside Results.tsx is the only role-gated affordance on the Search subtree — and that gate lives in Search.tsx:81-85 (`<WithPermissionsProvider allowedPermissions={[DATA_ENTITY_GROUP_CREATE]}>`), NOT in the route module."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:61 (no gate) + Search.tsx:81-85 (gate downstream, inside the page)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE at the route layer. The single permission check on the Search subtree is the `WithPermissions permissionTo={Permission.DATA_ENTITY_GROUP_CREATE}` consumer inside Results.tsx:125 (a downstream child of Search.tsx) — which gates ONLY the 'Add group' button rendering, not the page itself, not the search input, not the result list. The backend has NO `/api/search` SecurityRule (confirmed by Grep of SecurityConstants.java); the search endpoints are protected only by the catch-all `pathMatchers('/**').authenticated()`."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:1-19 (no gate) + App.tsx:61 (no gate) + Search.tsx:81-85 (provider, not enforcer) + Results.tsx:125 (downstream gate on one CTA) + SecurityConstants.java:98+ (no search rule)"
  resource_boundaries: []
    # No @Transactional, no synchronized, no cache, no idempotency concern.
    # Module is pure functions.
  request_inputs:
    - location: "searchRoutes.ts:4 (SEARCH_ID_PARAM = ':searchId') + searchRoutes.ts:14-16 (SearchRouteParams interface) + searchRoutes.ts:18-19 (useSearchRouteParams hook)"
      input_kind: path-param
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name `searchId` promises 'the identifier of a search'. A naive reading suggests a saved-search id, or a user-meaningful query id ('search #42'), or a saved-filter token. The route URL form `/search/{searchId}` reinforces this — it looks like the canonical 'view search id X' RESTful URL."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 + searchRoutes.ts:14-16"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced chain: useSearchRouteParams() (searchRoutes.ts:18-19) returns {searchId} to consumers. The ONLY consumer is Search.tsx:27 (`{searchId: routerSearchId} = useSearchRouteParams()`). Search.tsx uses it at line 38 (truthy check — 'is there a UUID in the URL?') and line 45-47 (`if (!searchId && routerSearchId) dispatch(getDataEntitiesSearch({searchId: routerSearchId}))`). The dispatch routes to dataentitiesSearch.thunks.ts:43-50 (`getDataEntitiesSearch`) which calls `searchApi.getSearchFacetList({searchId})`. This becomes `GET /api/search/{searchId}` on the backend. Backend (batch-M SearchController.getFacetList) looks up `search_facets WHERE id = {uuid}::uuid` — a server-side SESSION row, NOT a saved-search row, NOT a query id."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:18-19 + Search.tsx:27 + Search.tsx:44-48 + dataentitiesSearch.thunks.ts:43-50 + batch-M SearchController.search sidecar (`search_facets` row keyed by server-generated UUID)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The name `searchId` promises 'a saved/persistent search identifier'. The implementation uses it as a SERVER-SIDE SESSION ROW UUID — a transient row in `search_facets` that was minted by the most recent `POST /api/search` and that has no user binding, no TTL guarantee at this layer, no 'saved search' semantics. The same row gets MUTATED on every facet change (PUT /api/search/{searchId}/facets). The UUID is not user-meaningful, not bookmarkable in the way 'saved search #42' would be, not durable in the way a saved-search id would be."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:4-5 (name) + batch-M SearchController.search sidecar (`search_facets` row keyed by UUID; mutated by PUT /facets; no user binding) + dataentitiesSearch.thunks.ts:25-50 (the three thunks treat it as a session handle, not a saved-search id)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Three operator-visible consequences. (1) **Bookmark fragility.** A user bookmarks `/search/{uuid}`; the server-side row may be cleaned up at some unknown TTL (the cleanup story is unspecified at this layer — see batch-M; resolved by probe P-168); the bookmark 404s. The user sees an empty Catalog (or a toast) and doesn't understand why their 'saved search' disappeared. (2) **Cross-user sharing exposes whatever state the session has at fetch time.** User A shares `/search/{uuid}` with User B; between A's last `updateSearchFacets` and B's arrival, no one mutates anything — B sees A's intended state. But if A keeps clicking around their UI (each click mutates the SAME row via PUT /facets), the URL B opens 30 seconds later shows STATE B never expected. The URL doesn't behave like a saved-search id; it behaves like 'pointer to whatever this row currently holds'. (3) **Tab navigation drops the session.** Clicking the Catalog top-nav tab (ToolbarTabs.tsx:38 → `searchPath()` no arg → `/search`) drops the UUID; the user expected their 'saved search' would be there when they came back. It isn't — Search.tsx:37-42 creates a fresh empty session."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:38 (drops UUID) + Search.tsx:37-42 (creates fresh session) + batch-M SearchController.updateFacets (mutates same row) + searchRoutes.ts:14-16 (interface declares the type as string, hiding the session semantics)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE in this module. The route module has only one param — `searchId`. There's no neighbouring `sessionId` or `savedSearchId` or `queryId` field that would have been a clearer name. The drift is the NAME `searchId`, not 'wrong column used'. The fix at this layer would be renaming to `searchSessionId` across all three modules (searchRoutes.ts, the URL form `/search/{sessionId}`, and useSearchRouteParams) — high-churn rename. Alternative: add a JSDoc on the SearchRouteParams interface documenting 'this is a server-side session UUID, not a saved-search id'. Low effort, captures the drift."
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:1-19 (full module — one param, one name) + batch-M SearchController.search sidecar (the persisted row IS called search_facets server-side, not search_session — the naming inconsistency is system-wide)"
      routes_to_finding: "bugs_limitations_corner_cases[3 + 5] (tab-clicks-drop-session + URL state limited to UUID) AND docs_link_semantic.doc_drift_findings[0] (doc page never explains the URL form) AND security.known_security_gaps[1] (UUID enumeration surface in absence of user binding)"
  probes_emitted:
    - probe_id: P-168
      question: "Is the `search_facets` row cleaned up by any background job, TTL, or reaper — and if so, how long does a deep-link `/search/{uuid}` URL stay valid?"
      probe_path: "lineage/odd-platform/probes/P-168.yaml"
  stress_summary:
    triggers_total: 4              # 2 name_behavior_pairs + 1 auth_gates + 1 request_inputs
    questions_total: 11            # 2 (name_behavior pairs, 1 Q each) + 4 (auth_gates Q1-Q4) + 5 (request_inputs Q1-Q5)
    answers_static_inferred: 11    # all questions answered from code-walk
    answers_probe_needed: 1        # the search_facets TTL/reaper sub-question — emitted as P-168
    answers_reference: 0
    drift_flags: 3                 # 2 MINOR (searchPath label drift, useSearchRouteParams type lie) + 1 DRIFT_INPUT_NAME_VS_IMPLEMENTATION (searchId is session UUID not saved-search id)
```

## upstream_callers

- entry_point: "ui_route:/search"
  caller_node: "ts react-component:App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:61 — `<Route path={\`${searchPath()}/*\`} element={<Search/>}/>` — calls searchPath() at module-init time to build the route path; the result is a static string passed to React-Router"
  observation_class: ui-call
- entry_point: "ui_route:/search/{searchId}"
  caller_node: "ts react-component:Search.tsx"
  multiplicity_per_trigger: 1
  evidence: "Search.tsx:27 — `const { searchId: routerSearchId } = useSearchRouteParams();` — once per render of the Search component"
  observation_class: ui-call
- entry_point: "ui_call:useCreateSearch"
  caller_node: "ts hook:useCreateSearch.ts"
  multiplicity_per_trigger: 1
  evidence: "useCreateSearch.ts:17 — `const searchLink = searchPath(searchId);` — once per successful createDataEntitiesSearch resolution; the call dispatches in turn from MainSearchInput (Enter-key handler on global mainSearch=true) or from Search.tsx (initial mount with no URL UUID)"
  observation_class: ui-call
- entry_point: "ui_navigation:top-nav-Catalog-tab"
  caller_node: "ts react-component:ToolbarTabs.tsx"
  multiplicity_per_trigger: 2
  evidence: "ToolbarTabs.tsx:38 — `link: searchPath()` (no UUID — drops session); ToolbarTabs.tsx:93 — `matchPath(\`${searchPath()}/*\`, pathname)` for active-tab detection. Both fire on every render of the toolbar (toolbar mounted in App.tsx); the LINK is consumed when the user clicks the tab."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Route module produces strings consumed by React-Router; the side effect is the mount of `<Search/>` at `/search/*` (App.tsx:61), which on first render fires (a) `dispatch(createDataEntitiesSearch(...))` if no UUID in URL (Search.tsx:37-42 → POST /api/search → persists a new `search_facets` row + server allocates UUID + UI navigate to /search/{uuid}) OR (b) `dispatch(getDataEntitiesSearch({searchId: routerSearchId}))` if UUID is present (Search.tsx:44-48 → GET /api/search/{uuid} → server reads `search_facets` row). The route module itself does not perform the dispatch — it ENABLES the dispatch by making the UUID readable."
  evidence: "searchRoutes.ts:18-19 + Search.tsx:27 + Search.tsx:37-48"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/search"
    - "ui_route:/search/{searchId}"

- side_effect_class: db-write
  description: "**INDIRECT via Search.tsx:37-42.** When the SPA mounts at /search (no UUID), the orchestrator dispatches createDataEntitiesSearch → POST /api/search → SearchController.search → SearchServiceImpl.search → INSERT into search_facets. The route module is the conduit (it surfaces the UUID-absent state via useSearchRouteParams); it does not directly issue the write."
  evidence: "Search.tsx:37-42 (the gate) + batch-M SearchController.search sidecar (the actual INSERT)"
  cardinality_per_call: "0 or 1 — 0 if URL already has UUID; 1 if route mounts with no UUID and no in-flight create and no cached searchId"
  reachable_from_entry_points:
    - "ui_route:/search"
    - "ui_navigation:top-nav-Catalog-tab"     # tab click drops UUID → fresh INSERT
    - "ui_call:useCreateSearch"               # global search-bar Enter → same INSERT

- side_effect_class: external-call
  description: "**INDIRECT via Search.tsx:44-48.** When the SPA mounts at /search/{uuid}, the orchestrator dispatches getDataEntitiesSearch → GET /api/search/{uuid}. The route module surfaces the UUID; the orchestrator performs the call."
  evidence: "Search.tsx:44-48"
  cardinality_per_call: "0 or 1 — 1 if URL has UUID and Redux has no cached searchId; 0 otherwise"
  reachable_from_entry_points:
    - "ui_route:/search/{searchId}"

## sources

- understanding ← searchRoutes.ts:1-19
- concepts.entities.* ← searchRoutes.ts:3, 4, 5, 7-12, 14-16, 18-19
- concepts.operations.* ← searchRoutes.ts:7-12 + App.tsx:61 + Search.tsx:27 + Search.tsx:37-48 + useCreateSearch.ts:14-19 + ToolbarTabs.tsx:38 + ToolbarTabs.tsx:93
- concepts.invariants.* ← searchRoutes.ts:1-19 + App.tsx:61 + SecurityConstants.java:98+ + Search.tsx:81-85 + LoginFormSecurityConfiguration.java:55-58 + WithPermissionsProvider.tsx:18-48
- dependencies_semantic.couples-to.* ← App.tsx:61 + Search.tsx:27 + useCreateSearch.ts:14-19 + ToolbarTabs.tsx:38 + ToolbarTabs.tsx:93 + routes/index.ts:6
- tests_coverage_semantic.uncovered_behaviours.* ← Glob for searchRoutes test files returned no results; integration tests for the deep-link flow would require Playwright + the substrate's docker-compose stack
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/search (2026-05-26 status 200; described 7 facets + free-text + faceted search but NOT the URL form)
- docs_link_semantic.doc_drift_findings.[0,1] ← WebFetched content shows URL-form + access-model both absent
- implicit_adrs.[0,1] ← searchRoutes.ts:3-5, 9, 19 (intent anchor: rename-safe cohesion)
- bugs_limitations_corner_cases.[1] ← searchRoutes.ts:9 + Search.tsx:44-48
- bugs_limitations_corner_cases.[2] ← App.tsx:61, 75-88 + SecurityConstants.java:98+ + WithPermissionsProvider.tsx:18-48
- bugs_limitations_corner_cases.[3] ← ToolbarTabs.tsx:38 + Search.tsx:37-42
- bugs_limitations_corner_cases.[4] ← searchRoutes.ts:9 + batch-M SearchController.search sidecar invariants
- bugs_limitations_corner_cases.[5] ← App.tsx:61 + searchRoutes.ts:9
- bugs_limitations_corner_cases.[6] ← searchRoutes.ts:14-16
- security.auth_mode_relevance ← App.tsx:61 + LoginFormSecurityConfiguration.java:55-58 + SecurityConstants.java:95-98 (WHITELIST_PATHS does not include /search; pathMatchers /** authenticated covers it)
- security.known_security_gaps.[0,1] ← App.tsx:61 + SecurityConstants.java:98+ + batch-M SearchController.search REFACTOR-344
- stress_findings.name_behavior_pairs.[0] ← searchRoutes.ts:7-12 + ToolbarTabs.tsx:38 + live doc page WebFetched 2026-05-26
- stress_findings.name_behavior_pairs.[1] ← searchRoutes.ts:14-19 + Search.tsx:27, 38, 45
- stress_findings.auth_gates ← searchRoutes.ts:1-19 + App.tsx:61 + SecurityConstants.java:98+ + LoginFormSecurityConfiguration.java:55-58
- stress_findings.request_inputs ← searchRoutes.ts:4-5, 14-19 + Search.tsx:27, 44-48 + dataentitiesSearch.thunks.ts:43-50 + batch-M SearchController.search sidecar
- upstream_callers.* ← App.tsx:61 + Search.tsx:27 + useCreateSearch.ts:17 + ToolbarTabs.tsx:38, 93
- downstream_side_effects.* ← Search.tsx:37-48 (orchestrator gates the dispatches) + dataentitiesSearch.thunks.ts:25-50 (the thunks) + batch-M SearchController sidecar (the backend INSERT/SELECT)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH      # confidence that there are NO tests is high (Glob/Grep returned no results); confidence in the gap analysis itself is HIGH
- docs_link_semantic: HIGH            # live fetch 2026-05-26 status 200; absence of URL-form documentation is confirmed
- implicit_adrs: MEDIUM               # intent anchors are inferred (no comment in the module); confidence moderated accordingly
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH                   # N/A across the board, confidently
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH               # 10/11 STATIC-INFERRED with strong evidence; 1 PROBE-NEEDED (P-168 for search_facets row TTL/cleanup question) — under the half-threshold, HIGH preserved

## Maintainer notes

(no prior sidecar — empty)

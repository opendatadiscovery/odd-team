---
node_id: "odd-platform ts routes route:dataQuality"
node_kind: route
axis: ui_routes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZH
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — this module is the URL-shape contract for the dashboard route entry
related_concepts:
  - data-quality-dashboard
  - ui-route-mount
  - route-base-path-convention
references:
  - kind: sibling-callee
    node: "odd-platform ts react-component component:DataQuality"
    unresolved: false
    note: "the React route-entry component mounted at this path; batch ZC"
  - kind: caller
    node: "odd-platform ts route-registry App.tsx"
    unresolved: true
    note: "the route table that calls dataQualityPath() to mount the DataQuality component (App.tsx:18, 73)"
  - kind: caller
    node: "odd-platform ts react-component component:ToolbarTabs"
    unresolved: true
    note: "the global toolbar that builds the 'Data Quality' tab link via dataQualityPath() (ToolbarTabs.tsx:16, 47)"
  - kind: cross-surface-backend
    node: "odd-platform java DataQualityController controller-class:DataQualityController"
    unresolved: false
    note: "the per-dataset DQ HTTP surface — DISTINCT from this route; documents the same read-collaborative posture that P-090 pins for the dashboard endpoint"
---

# dataQualityRoutes — semantic understanding

## understanding

`dataQualityRoutes.ts` is the URL-shape contract for the standalone Data
Quality dashboard (pillar feature P-04:F-002). The whole module is three
lines: a single named export `dataQualityPath()` returning the literal
string `'/data-quality'`. The function has no parameters, no sub-paths,
no `BASE_PATH` indirection — it inlines the literal. Its two consumers
both call it once: `App.tsx:73` mounts `<Route path={dataQualityPath()}
element={<DataQuality />} />` (a BARE route, with no
`WithPermissionsProvider` wrapper — contrast `/lookup-tables` at
`App.tsx:75-88`), and `ToolbarTabs.tsx:47` builds the top-bar 'Data
Quality' tab link. The module owns no rendering, no auth-gating, no data
fetch, no params handling — purely a string constant promoted to a
function so consumers import a callable from `'routes'`.

## concepts

- entities: [
    "DataQualityDashboard URL — the literal `/data-quality`, the single canonical mount point for the catalog-wide DQ aggregate view (`dataQualityRoutes.ts:2`)"
  ]
- operations: [
    "build-data-quality-url — return the constant `/data-quality` (`dataQualityRoutes.ts:1-3`)"
  ]
- invariants: [
    "The string `/data-quality` exists in EXACTLY ONE place in source (`dataQualityRoutes.ts:2`); both consumers (`App.tsx:73` and `ToolbarTabs.tsx:47`) call `dataQualityPath()` instead of hard-coding the literal — so renaming the URL is a one-file change",
    "No path parameters, no sub-routes — `App.tsx:73` mounts the route WITHOUT a trailing `/*`, meaning React Router will only match exactly `/data-quality` (not `/data-quality/anything`); the dashboard is a single-page mount, not a sub-tree",
    "`dataQualityPath` is a function, not a constant — chosen for parallelism with the sibling route modules (`alertsPath()`, `searchPath()`, `directoryPath()` etc.), which all expose path BUILDERS; this module's builder accepts no arguments because the route has no parameters"
  ]
- audiences: [
    "any-authenticated-user — the literal `/data-quality` is the URL surfaced to any signed-in user via the unconditional 'Data Quality' toolbar tab (`ToolbarTabs.tsx:45-49`); there is no client-side permission gate around the tab or the route",
    "data-quality-engineer — primary intended audience per live doc `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-26 status 200: 'Open it from the top-level navigation Data Quality tab (the catalog-wide dashboard)'"
  ]

## dependencies_semantic

- requires-feature: [
    "P-04 Data Quality pillar — the route is meaningful only if the `DataQuality` route-entry component (`App.tsx:73`) is mounted; this route module is the URL half of the contract, the component module is the render half"
  ]
- requires-config: [] — N/A. The module reads no `process.env`, no feature flag, no runtime config; the path is a hard-coded literal at compile time.
- requires-runtime: [
    "None directly. Unlike `dataModellingRoutes.ts:1` (which imports `generatePath` from react-router-dom) and `dataEntitiesRoutes.ts:1` (which imports `generatePath` + `useParams`), this module imports NOTHING — it returns a plain string literal. React Router is only a runtime dependency in the CONSUMERS (`App.tsx:2`, `ToolbarTabs.tsx:2`), not in this module."
  ]
- couples-to: [
    "`App.tsx:18, 73` — the route table imports `dataQualityPath` and uses it to mount the `<Route>` element",
    "`ToolbarTabs.tsx:16, 47` — the global toolbar imports `dataQualityPath` and uses it as the 'Data Quality' tab `link`",
    "`routes/index.ts:3` — `export * from './dataQualityRoutes'` re-exports the function from the `'routes'` barrel; consumers import from `'routes'`, not from this file path"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test file references `dataQualityPath` or `dataQualityRoutes` (Grep over `*.test.*` and `*.spec.*` under `odd-platform-ui/src` returns no matches, 2026-05-26).
- uncovered_behaviours:
  - behaviour: "`dataQualityPath()` returns the literal `/data-quality`"
    test_class: unit
    criticality: LOW
    note: "A regression that changed the literal (e.g. typo to `/dataquality` or `/data-qualitiy`) would silently break every link to the dashboard. The build would not fail; users would hit a router 'no match' (the `<Routes>` block falls through with no element, rendering blank). One assertion would catch it."
  - behaviour: "Single source of truth — both consumers (`App.tsx:73` and `ToolbarTabs.tsx:47`) call `dataQualityPath()` rather than re-hardcoding `/data-quality`"
    test_class: unit
    criticality: LOW
    note: "Currently true; a grep test asserting no other source file in `odd-platform-ui/src` contains the literal `/data-quality` outside this file + the docs would prevent re-hardcoding drift. Lower-leverage than a behavioural test."
- test_files: [] — Grep over `odd-platform-ui/src` for `dataQualityPath` or `dataQualityRoutes` in `*.test.*` / `*.spec.*` returned no matches (2026-05-26).
- gaps: |
    This module has zero direct test coverage. The directory-wide pattern is the same: NO route module under `odd-platform-ui/src/routes/` has tests (Grep over all `*Routes.ts` in `*.test.*` and `*.spec.*` returned no matches). A `unit`-class regression test that pins `dataQualityPath() === '/data-quality'` is the most surface-area coverage for the lowest cost — but the gap is directory-wide, not specific to this file. The worst-coverage class is `integration`: there is no Playwright/Cypress click-the-tab-and-assert-the-dashboard-renders test that would catch a coupled regression (route literal + ToolbarTabs link + App.tsx mount drifting apart). Highest-leverage test: a single integration test that navigates to `/data-quality` and asserts the `DataQuality` component's two-pane skeleton renders.

## docs_link_semantic

- declared_docs: [] — N/A. No `// @docs:` annotation in the source file.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "Dedicated sub-page for the Quality Dashboard; explicitly names the route `/data-quality` as the dashboard location. This is the canonical doc for the URL surface this module declares."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      URL mention (verbatim): "The dashboard is located at `/data-quality`"
      (also: "the catalog-wide quality view at `/data-quality`" per the parent
      `data-quality.md`).

      Access-control language (verbatim absence): "The page contains no
      mentions of access restrictions, permission requirements, or who can
      view the dashboard."

      Headings: Quality Dashboard, Three breakdown rings, Six anomaly-class
      metrics, Monitored vs unmonitored portions, Filtering, Where to next.
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "Pillar landing page — distinguishes the top-level Data Quality tab (this route) from per-entity Test reports tabs (F-022 — a distinct surface); this is the doc that names the toolbar tab whose link is built from `dataQualityPath()`."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      URL mention (verbatim): "the catalog-wide quality view at
      `/data-quality`".

      Tab/route distinction (verbatim): "Open it from the top-level
      navigation **Data Quality** tab (the catalog-wide dashboard)" or "from
      any data entity's **Test reports** tab (per-entity test results and
      SLA status)".

      Access-control language (verbatim absence): "No access control,
      permissions, or role-based restrictions are mentioned in this page
      content."
- doc_drift_findings:
  - "**NO drift between the URL declared here and the URL named in the docs.** Both the dashboard sub-page (`dashboard.md`) and the pillar landing (`data-quality.md`) name the dashboard URL as exactly `/data-quality` — matching `dataQualityRoutes.ts:2` verbatim. The route name, the URL, and the doc page agree (`/data-quality` ↔ 'Data Quality' tab ↔ 'Quality Dashboard' page title) — the user-facing label uses the broad pillar name 'Data Quality', and the doc explicitly tells the user this tab is the standalone catalog-wide dashboard, distinguishing it from the per-entity Test reports tab; the broad name is intentional and disambiguated by the doc, not a Category B name-vs-behavior drift."
  - "**DOC GAP — access control silence at the URL surface.** Both linked doc pages (verified 2026-05-26, status 200 each) make NO statement about who can view the dashboard. This route is mounted bare (`App.tsx:73`, no `WithPermissionsProvider`) and the toolbar tab is rendered unconditionally (`ToolbarTabs.tsx:45-49`), so the URL is reachable by any authenticated user. The doc-side silence is shared across the sibling `DataQuality` component sidecar (`doc_drift_findings[0]` there) and the `DataQualityController` sidecar (which records the same silence for the per-dataset read endpoints). This is an inherited finding — the actionable item lives in the docs pillar, not in this route module — severity: MEDIUM."

## implicit_adrs

- "**Each route module under `odd-platform-ui/src/routes/` declares its URL prefix and exposes a path-builder function from a single file, re-exported through `routes/index.ts`.** `dataQualityRoutes.ts` follows the directory convention: one named function exporting one URL surface, re-exported via `index.ts:3` so consumers import from `'routes'`. The directory has 11 sibling modules and this is the only one with a function returning a hard-coded literal with no `BASE_PATH` constant — the convention itself is the implicit ADR. The decision is to centralise URL strings so renaming an URL is a one-file change visible in a single grep over `routes/`." — evidence: `dataQualityRoutes.ts:1-3` (the module) + `routes/index.ts:3` (the re-export) + `alertsRoutes.ts:1` + `activityRoutes.ts:1` + `directoryRoutes.ts:4` + `masterDataRoutes.ts:1` + `dataModelling/dataModelling.ts:3` (all sibling modules also expose path builders) — intent_anchor: "export * from './dataQualityRoutes';" (`routes/index.ts:3`) — confidence: HIGH

- "**Path builders are functions even when they take no arguments — the route's URL is callable, not a bare constant.** `dataQualityPath` is a zero-arg function (`dataQualityRoutes.ts:1-3`); the same shape appears in `activityPath(query?)`, `directoryPath()`, `alertsPath(path?)`, `lookupTablesPath()`. The decision is API consistency: callers always write `dataQualityPath()`, never `dataQualityPath` — so refactoring a single route to take parameters (e.g. adding a sub-path argument) is a non-breaking change at the call sites. The convention is applied uniformly across the route directory; the uniformity is the evidence of intent." — evidence: `dataQualityRoutes.ts:1` (`export function dataQualityPath()`) + the analogous declarations in `activityRoutes.ts:3`, `alertsRoutes.ts:10`, `directoryRoutes.ts:6`, `masterDataRoutes.ts:2` — intent_anchor: "export function dataQualityPath() { return '/data-quality'; }" (`dataQualityRoutes.ts:1-3`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**Convention break — `dataQualityRoutes.ts` is the ONLY route module that does NOT use a private `BASE_PATH` constant.** Every other sibling module declares its URL prefix as `const BASE_PATH = '/...'` and references the constant in its path builder (`alertsRoutes.ts:1`, `activityRoutes.ts:1`, `dataEntitiesRoutes.ts:4`, `directoryRoutes.ts:4`, `masterDataRoutes.ts:1`, `dataModelling/dataModelling.ts:3`, `searchRoutes.ts:3`, `termsRoutes.ts:4`). This module inlines the literal `/data-quality` directly in the return statement. Functionally harmless (the route has no sub-paths to compose); cosmetic/consistency defect. If a future change adds a sub-path under `/data-quality/...`, the convention break shifts from cosmetic to a refactor friction-point. Severity: LOW." — evidence: `dataQualityRoutes.ts:1-3` (no BASE_PATH) + Grep `BASE_PATH` across `odd-platform-ui/src/routes/*.ts` (returns 8 sibling modules; this module is absent from the matches) — severity: LOW

- "**No client-side permission gate at the URL declaration's only mount site (`App.tsx:73`).** The route module itself does not and cannot enforce auth — that is the consumer's responsibility (the `<Route>` element). The consumer mounts a BARE `<Route path={dataQualityPath()} element={<DataQuality />} />` without a `WithPermissionsProvider` wrapper, contrasting the sibling `/lookup-tables` route (`App.tsx:75-88`, wrapped on `LOOKUP_TABLE_CREATE | _UPDATE | _DELETE`). The 'Data Quality' top-bar tab is also rendered unconditionally (`ToolbarTabs.tsx:45-49`, no permission predicate). Whether the dashboard data is gated at the BACKEND endpoint is pinned by P-090 (already emitted by the sibling `DataQuality` component sidecar). Recorded here as a corner-case (not an `implicit_adr`) because the absence is unexplained — no comment, no annotation, no exception defends it in this module or in the consumer at `App.tsx:73`. Severity: MEDIUM. This is the same finding as `DataQuality` sibling's `bugs_limitations_corner_cases[0]`; route module + component module share the same posture." — evidence: `dataQualityRoutes.ts:1-3` (no auth predicates, by design) + `App.tsx:73` (bare consumer mount) + `App.tsx:75-88` (the gated sibling route, for contrast) + `ToolbarTabs.tsx:45-49` (unconditional tab) + P-090 for the backend half — severity: MEDIUM

- "**No tests for this module or any other route module under `odd-platform-ui/src/routes/`.** A typo in `/data-quality` (e.g. `/data-qaulity`) would not be caught by the build or by tests. The route would silently stop matching and the dashboard would be unreachable by URL; the toolbar tab would navigate to a non-matching route and React Router would render blank (no `<Route element>` matches). Discovery is human-only. The gap is directory-wide, not specific to this file." — evidence: Grep `find odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep -l dataQualityPath` returned no matches at commit ede5d277 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
    # No numeric literals, no @Value-equivalent, no magic strings gating
    # behaviour, no constants beyond the URL literal itself (which is not a
    # tunable — it is the route's identity). Recorded as explicit [] per
    # Rule 9 so "checked, no triggers" is distinct from "forgot to check".
  name_behavior_pairs:
    - name: "dataQualityPath()"
      promise: "Returns the URL path for the Data Quality dashboard page."
      implementation: "Returns the constant string '/data-quality' (dataQualityRoutes.ts:1-3). Both consumers use the return verbatim: App.tsx:73 mounts <Route path={dataQualityPath()} ...>, ToolbarTabs.tsx:47 sets link: dataQualityPath() on the 'Data Quality' tab. Name promises a URL; implementation returns that URL. No drift."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "dataQualityRoutes.ts:1-3 + App.tsx:73 + ToolbarTabs.tsx:47"
    - name: "URL '/data-quality' + Toolbar label 'Data Quality' + Component scope (catalog-wide dashboard)"
      promise: "URL says 'data-quality' (broad — the whole DQ domain); toolbar tab is labelled 'Data Quality' (broad). Naive reading: clicking this lands on a Data Quality DOMAIN landing page, perhaps with multiple sub-views."
      implementation: "The mounted element is a single dashboard view (DataQuality.tsx — three donut charts + a category-results list + a two-set filter sidebar). The URL has no trailing /*  (App.tsx:73), so /data-quality matches only this single page; there are no /data-quality/sub-routes. The user-facing label is BROAD but the page is SPECIFIC (the catalog-wide aggregate dashboard). The live docs (dashboard.md + data-quality.md, both verified 2026-05-26 status 200) explicitly distinguish this 'Data Quality tab — the catalog-wide dashboard' from per-entity 'Test reports' tabs (F-022 — a distinct surface accessed under /dataentities/{id}/test-reports); the broad URL/label is intentional and the doc disambiguates it. No drift — the broad name is the intended pillar-level entry point, and the doc makes that distinction explicit."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "dataQualityRoutes.ts:2 (the URL) + ToolbarTabs.tsx:46-49 (the label) + DataQuality.tsx:7-18 (the component scope) + App.tsx:73 (no trailing /*) + WebFetch https://docs.opendatadiscovery.org/features/data-quality 2026-05-26 status 200 (the doc disambiguates) + WebFetch https://docs.opendatadiscovery.org/features/data-quality/dashboard 2026-05-26 status 200"
  orderings: []
    # No ORDER BY, no LIMIT/paginate, no .sort()/Comparator. The module
    # returns a string; there is no collection to order.
  auth_gates:
    - location: "dataQualityRoutes.ts:1-3 + (consumer site) App.tsx:73"
      endpoint: "UI route mount — <Route path={dataQualityPath()} element={<DataQuality />} />"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The route DECLARATION (this module) is auth-mode-agnostic — it returns a plain string. Auth enforcement is global at the backend SecurityConfiguration beans, not at the route declaration. The route MOUNT (App.tsx:73) is also auth-mode-agnostic: there is no per-mode branching in the consumer. Under DISABLED the SPA is reachable unauthenticated and the route renders for anyone; under LOGIN_FORM/OAUTH2/LDAP the SPA is reachable only post-authentication and any authenticated principal renders the route. Identical behaviour in all four modes after the global gate."
          confidence: STATIC-INFERRED
          evidence: "dataQualityRoutes.ts:1-3 (no auth branches) + App.tsx:73 (no auth wrapper) + DataQuality.tsx:7-18 (no auth check)"
        - q: "What does an unauthenticated caller see?"
          a: "For LOGIN_FORM/OAUTH2/LDAP — the SPA shell never loads for an unauthenticated caller; backend SecurityConfiguration redirects to the auth flow before App.tsx renders. For DISABLED — there is no authentication, the page is anonymously reachable. This module imposes no separate check; the global auth posture applies."
          confidence: STATIC-INFERRED
          evidence: "dataQualityRoutes.ts:1-3 (no own guard) + App.tsx:73 (no own guard) — global enforcement upstream"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated principal — including a minimum-privilege user with zero Permissions and zero ownership associations — reaches the route and renders the DataQuality component. The route is a BARE <Route> at App.tsx:73, NOT wrapped in WithPermissionsProvider (contrast App.tsx:75-88 where /lookup-tables IS wrapped on LOOKUP_TABLE_CREATE|UPDATE|DELETE permissions). The 'Data Quality' top-bar tab is rendered unconditionally (ToolbarTabs.tsx:45-49). Whether the wrong-role caller then sees DATA depends on the backend dashboard endpoint authorization — owned by the DataQualityContent sibling. P-090 (already emitted by the sibling DataQuality component sidecar) pins the backend half. This module's contribution: the URL exists and is reachable for every authenticated role at the frontend layer."
          confidence: STATIC-INFERRED
          evidence: "dataQualityRoutes.ts:1-3 + App.tsx:73 (bare mount, no WithPermissionsProvider) + App.tsx:75-88 (the contrasting gated sibling) + ToolbarTabs.tsx:45-49 (unconditional tab) + P-090 (backend half)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Frontend route declaration: NOWHERE in this module, and NOWHERE in the mounting consumer (App.tsx:73 is a bare <Route>). The 'Data Quality' tab in ToolbarTabs.tsx has no conditional. Backend gate posture is pinned by P-090. From the perspective of this URL-declaration module, the answer is unambiguously 'nowhere at the frontend layer'."
          confidence: STATIC-INFERRED
          evidence: "dataQualityRoutes.ts:1-3 (no predicate) + App.tsx:73 (no wrapper) + ToolbarTabs.tsx:45-49 (no conditional) + P-090 for the backend"
  resource_boundaries: []
    # No @Transactional, no synchronized, no lock, no cache, no async path,
    # no insert/update logic. The module is a pure function returning a
    # constant string. No resource boundary surface.
  request_inputs: []
    # `dataQualityPath()` is a zero-argument function. There are no path
    # parameters (the URL has no React Router :param placeholders), no query
    # parameters (sibling like activityPath(query?) DO accept query strings,
    # but dataQualityPath does NOT — see App.tsx:65 vs App.tsx:73), no headers,
    # no body, no form fields. The URL '/data-quality' is a fixed literal with
    # no captures. Category F is therefore empty for this module. The
    # downstream dashboard endpoint DOES take query-parameter filters
    # (deNamespaceIds, datasourceIds, ownerIds, titleIds, tagIds — owned by
    # the DataQualityFilters sibling node via useSearchParams); those are
    # Category F triggers for THAT sibling, not for this URL-declaration
    # module. Recorded as explicit [] per Rule 9 so "checked, no triggers"
    # is distinct from "forgot to check".
  probes_emitted: []
    # No new probe emitted by this sidecar. The Category D auth-gate question
    # (does the BACKEND dashboard endpoint enforce authorization for a
    # minimum-privilege authenticated user?) was already emitted by the
    # sibling DataQuality component sidecar as P-090 (which this module
    # references). All other stress questions for this node resolved to
    # STATIC-INFERRED with strong file:line evidence — no runtime ambiguity
    # remains specifically for the URL declaration.
  stress_summary:
    triggers_total: 3
    questions_total: 6
    answers_static_inferred: 6
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this module is a plain TypeScript function returning a string literal. It is not on the HTTP surface; it carries no auth predicates, no fetch calls, and no role/permission checks. The four ODD authentication modes (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) are enforced globally by `*SecurityConfiguration` beans on the backend, which protect the backend endpoints the consumer component's data fetch hits — not the client URL string this module declares. Per WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (2026-05-26 status 200), auth modes branch backend behaviour; this UI module does not branch under any mode. — evidence: `dataQualityRoutes.ts:1-3` (no auth-related imports or branches)
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag gates `POST /ingestion/entities` server-side only; it has no relationship to UI routes.
- **authorization_assertions**: [] — the module enforces no permission. The CONSUMER (`App.tsx:73`) also enforces no permission — the route is a bare `<Route>` with no `WithPermissionsProvider`, contrasting the sibling `/lookup-tables` route (`App.tsx:75-88`) which IS wrapped on `LOOKUP_TABLE_CREATE | LOOKUP_TABLE_UPDATE | LOOKUP_TABLE_DELETE`. The 'Data Quality' top-bar tab (`ToolbarTabs.tsx:45-49`) is rendered unconditionally — no permission check. — evidence: `App.tsx:73` (bare route) + `App.tsx:75-88` (the contrasting gated sibling) + `ToolbarTabs.tsx:45-49`
- **owner_scoping**: `N/A — this node is not data-scoped`. The module returns a constant string; it fetches and renders no data. Owner-scoping (if any) of the dashboard aggregate is a property of the backend dashboard endpoint, owned by the `DataQualityContent` sibling — pinned by P-090. — evidence: `dataQualityRoutes.ts:1-3` (no data, no scoping)
- **data_exposure**:
  - "The literal string `/data-quality` is emitted into the rendered HTML/JS bundle for every authenticated session and is discoverable to anyone who can fetch the SPA bundle → no audience restriction at this layer; under `auth.type=DISABLED` the bundle is reachable unauthenticated. The URL itself is a non-secret routing shape (parallel to the public source on GitHub) — recorded for completeness, not as a confidentiality concern." — evidence: `dataQualityRoutes.ts:2`
- **known_security_gaps**:
  - "The `/data-quality` URL declared by this module is mounted at `App.tsx:73` with NO client-side permission guard (bare `<Route>`, no `WithPermissionsProvider`), unlike the sibling `/lookup-tables` route at `App.tsx:75-88` (which IS wrapped). The toolbar tab building this URL (`ToolbarTabs.tsx:45-49`) is rendered unconditionally. Any authenticated principal can navigate to the dashboard. The backend authorization posture for the dashboard data endpoint is not determinable from this module alone — pinned by P-090 (already emitted by the sibling `DataQuality` component sidecar). The doc-side is silent on access control (both `dashboard.md` and `data-quality.md` verified 2026-05-26 status 200 make no mention of permissions or who can view the dashboard). This is an inherited finding from the consumer side, not a defect in this URL-declaration module — surfaced here so the cross-surface picture is complete." — evidence: `dataQualityRoutes.ts:1-3` (no own guard) + `App.tsx:73` (bare consumer mount) + `App.tsx:75-88` (gated sibling, for contrast) + `ToolbarTabs.tsx:45-49` + P-090 + WebFetch `dashboard.md` + `data-quality.md` 2026-05-26 — severity: MEDIUM

## performance

- **hot_paths**:
  - "`dataQualityPath()` is invoked at render time by `ToolbarTabs.tsx:47` (rendered as part of the global toolbar on every navigation) and once at module-init time by `App.tsx:73` to set up the `<Route>` element. The function body is a single `return '/data-quality'` — cost is negligible (O(1), zero allocations beyond the interned string literal)." — evidence: `dataQualityRoutes.ts:1-3` + `App.tsx:73` + `ToolbarTabs.tsx:47`
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O.`
- **resource_allocation**: `Trivial — one string literal returned from a zero-arg function. The bundle-size cost is approximately the length of the string `/data-quality` plus the function signature after minification (single digits of bytes).` — evidence: `dataQualityRoutes.ts:1-3`
- **scaling_characteristics**: `Stateless and pure — `dataQualityPath` is referentially transparent with no closure over mutable state, no module-level mutation, and no side effects. Scales horizontally with the React render tree at zero cost.` — evidence: `dataQualityRoutes.ts:1-3`
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts route-registry App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:18 (`import { dataQualityPath } from 'routes'`) + App.tsx:73 (`<Route path={dataQualityPath()} element={<DataQuality />} />`). The function is called once at App-module initialization to produce the `path` prop for the `<Route>` element. The resulting string is then matched by React Router on every navigation. The function itself is NOT invoked per navigation — only the route match is."
  observation_class: ui-call
  caller_node_unresolved: true

- entry_point: "ui_button:ToolbarTabs 'Data Quality' tab"
  caller_node: "odd-platform ts react-component component:ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:16 (`import { ..., dataQualityPath, ... } from 'routes'`) + ToolbarTabs.tsx:47 (`link: dataQualityPath()`, inside the `tabs` useMemo). The function is invoked each time the `tabs` memo re-evaluates — gated by the memo's dependency array `[activityQueryString, t]` (ToolbarTabs.tsx:81-82), so the function fires once per locale change or activity-query-string change, NOT once per render. The returned string is the navigation target when the user clicks the 'Data Quality' tab."
  observation_class: ui-call
  caller_node_unresolved: true

# NOTE: there are exactly two call-sites for `dataQualityPath`; grep across
# odd-platform-ui confirmed (App.tsx:18,73 + ToolbarTabs.tsx:16,47). No
# third caller exists at commit ede5d277.

## downstream_side_effects

- side_effect_class: page-render
  description: "Indirectly, by serving as the `path` prop on the `App.tsx:73` `<Route>` element, this URL declaration is the trigger that causes React Router to mount `<DataQuality />` when the location matches `/data-quality`. The module itself produces no DOM, no fetch, no log, no metric, no header — it returns a string consumed by react-router-dom. The page-render is downstream of the consumer, not of this module."
  evidence: "dataQualityRoutes.ts:1-3 (the URL) + App.tsx:73 (the consumer that mounts <DataQuality/> when the URL matches)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-quality"
    - "ui_button:ToolbarTabs 'Data Quality' tab"

# NOTE: This module's downstream_side_effects is intentionally minimal. The
# module itself does NOTHING — it returns a string. The render of <DataQuality/>
# is owned by the App.tsx route registry (the consumer); the dashboard data
# fetch and chart renders are owned by the DataQualityContent sibling node;
# the filter atoms and URL-synced query parameters are owned by the
# DataQualityFilters + DataQualityStore siblings. This sidecar records the
# page-render side effect because the URL declaration is the upstream
# necessary-condition for the render — but the side effect is INHERITED
# from the consumer, not produced by this file. Recorded for cross-surface
# completeness.

## sources

- understanding ← `dataQualityRoutes.ts:1-3` + `App.tsx:18, 73` + `ToolbarTabs.tsx:16, 47` + `App.tsx:75-88` (the contrasting gated sibling route)
- concepts.entities ← `dataQualityRoutes.ts:2`
- concepts.operations ← `dataQualityRoutes.ts:1-3`
- concepts.invariants[0] ← `dataQualityRoutes.ts:2` + Grep over `odd-platform-ui/src` for the literal `/data-quality` (2026-05-26): matches only in this file + `ToolbarTabs.tsx:48` (the `value` field for tab matching, separate from the link) + `MultipleFilterItemAutocomplete.tsx:149` (an autocomplete id prefix — unrelated to the URL)
- concepts.invariants[1] ← `App.tsx:73` (no trailing `/*`, contrast `App.tsx:61` `<Route path='${searchPath()}/*'>` and `App.tsx:72` `<Route path='${directoryPath()}/*'>`)
- concepts.invariants[2] ← `dataQualityRoutes.ts:1` (function not const) + `activityRoutes.ts:3` + `alertsRoutes.ts:10` + `directoryRoutes.ts:6` + `masterDataRoutes.ts:2` (sibling modules all expose functions)
- concepts.audiences[0] ← `ToolbarTabs.tsx:45-49` (unconditional tab) + `App.tsx:73` (bare route)
- concepts.audiences[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-26 status 200
- dependencies_semantic.requires-feature ← `App.tsx:73` (the URL is meaningful only when the route is mounted) + sibling `DataQuality` component sidecar
- dependencies_semantic.requires-runtime ← `dataQualityRoutes.ts:1-3` (no imports) vs. `dataModelling/dataModelling.ts:1` (imports `generatePath`) vs. `dataEntitiesRoutes.ts:1` (imports `generatePath, useParams`)
- dependencies_semantic.couples-to ← `App.tsx:18, 73` + `ToolbarTabs.tsx:16, 47` + `routes/index.ts:3`
- tests_coverage_semantic.test_files ← Grep over `odd-platform-ui/src` for `dataQualityPath` or `dataQualityRoutes` in `*.test.*` / `*.spec.*` returned no matches at commit ede5d277
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-26 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-26 status 200
- docs_link_semantic.doc_drift_findings[0] ← `dataQualityRoutes.ts:2` (URL) + `ToolbarTabs.tsx:46-49` (label) + WebFetch `dashboard.md` + `data-quality.md` 2026-05-26 (both name the dashboard's role unambiguously)
- docs_link_semantic.doc_drift_findings[1] ← `App.tsx:73` (no guard) + `ToolbarTabs.tsx:45-49` (unconditional tab) + WebFetch `dashboard.md` + `data-quality.md` 2026-05-26 (both silent on access control)
- implicit_adrs[0] ← `dataQualityRoutes.ts:1-3` + `routes/index.ts:3` + all sibling route modules under `odd-platform-ui/src/routes/`
- implicit_adrs[1] ← `dataQualityRoutes.ts:1` + sibling path builders in `activityRoutes.ts:3`, `alertsRoutes.ts:10`, `directoryRoutes.ts:6`, `masterDataRoutes.ts:2`
- bugs_limitations_corner_cases[0] ← `dataQualityRoutes.ts:1-3` (no `BASE_PATH`) + Grep `BASE_PATH` across `odd-platform-ui/src/routes/*.ts` (8 sibling modules with `BASE_PATH`, this module is the lone outlier)
- bugs_limitations_corner_cases[1] ← `dataQualityRoutes.ts:1-3` + `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49` + P-090
- bugs_limitations_corner_cases[2] ← Grep over `odd-platform-ui/src` `*.test.*` and `*.spec.*` for `dataQualityPath` — no matches at ede5d277
- stress_findings.auth_gates ← `dataQualityRoutes.ts:1-3` + `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49` + P-090 (the backend half pinned by the sibling component sidecar)
- stress_findings.name_behavior_pairs[0] ← `dataQualityRoutes.ts:1-3` + `App.tsx:73` + `ToolbarTabs.tsx:47`
- stress_findings.name_behavior_pairs[1] ← `dataQualityRoutes.ts:2` + `ToolbarTabs.tsx:46-49` + `DataQuality.tsx:7-18` + `App.tsx:73` + WebFetch `data-quality.md` 2026-05-26 status 200 (the doc disambiguates tab-vs-tab) + WebFetch `dashboard.md` 2026-05-26 status 200
- security.authorization_assertions ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49`
- security.known_security_gaps[0] ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49` + WebFetch `dashboard.md` + `data-quality.md` 2026-05-26 + P-090
- performance.hot_paths[0] ← `dataQualityRoutes.ts:1-3` + `App.tsx:73` + `ToolbarTabs.tsx:47`
- upstream_callers[0] ← `App.tsx:18, 73`
- upstream_callers[1] ← `ToolbarTabs.tsx:16, 47, 81-82`
- downstream_side_effects[0] ← `dataQualityRoutes.ts:1-3` + `App.tsx:73`

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
  # All 6 stress questions across 3 triggers resolve STATIC-INFERRED with
  # strong file:line evidence. The Category D backend-half ambiguity is
  # already pinned by the sibling component sidecar's P-090; this URL-
  # declaration module's load-bearing claim is the FRONTEND-layer
  # reachability of /data-quality, which is statically certain. No PROBE-
  # NEEDED for this node; no REFERENCE needed (cache/backend questions
  # cleanly out of scope for a string-constant module).

## Maintainer notes

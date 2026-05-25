---
node_id: "odd-platform ts react-component component:DataQuality"
node_kind: react-component
axis: react-component
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-ZC
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — THIS node is the route entry component for the standalone /data-quality dashboard; this batch closes the long-forward-declared gap
related_features:
  - F-022  # per-dataset DQ Test reports tab + SLA badge — DISTINCT surface; the /data-quality dashboard is the GLOBAL aggregate, F-022 is the per-entity drill-down
related_concepts:
  - data-quality-dashboard
  - quality-dashboard-filters
  - ui-route-mount
  - lazy-route-code-split
references:
  - kind: sibling-callee
    node: "odd-platform ts react-component component:DataQualityFilters"
    unresolved: true
    note: "sticky-sidebar child — owns the formFiltersAtom and the table/test filter sets; enriched in parallel this batch"
  - kind: sibling-callee
    node: "odd-platform ts react-component component:DataQualityContent"
    unresolved: true
    note: "main-pane child — owns useGetDataQualityDashboard fetch + the three DonutCharts + the TestCategoryResults list; enriched in parallel this batch"
  - kind: sibling-callee
    node: "odd-platform ts module component:DataQualityStore"
    unresolved: true
    note: "the jotai atom store (filtersAtom / formFiltersAtom / clear*Atom); enriched in parallel this batch"
  - kind: sibling-callee
    node: "odd-platform ts react-component component:TestCategoryResults"
    unresolved: true
    note: "per-category test-result matrix row; enriched in parallel this batch"
---

# DataQuality (route entry component) — semantic understanding

## understanding

`DataQuality` is the React route-entry component registered for the standalone
`/data-quality` page — the catalog-wide Data Quality dashboard (pillar feature
P-04:F-002). It is a 20-line pure-composition component: it renders no data of
its own and holds no state. Its sole job is to establish the page skeleton —
wrap the subtree in a fresh jotai atom `Provider` (`DataQualityAtomProvider`),
then lay out a sticky left `Sidebar` containing `<DataQualityFilters/>` and a
flex-grow `Content` pane containing `<DataQualityContent/>`. It is lazy-loaded
and code-split (`App.tsx:39`, `React.lazy`), mounted under the app-wide
`AppSuspenseWrapper`, and — unlike the sibling `/lookup-tables` route — is NOT
wrapped in any permission guard, so any authenticated user who can reach the
app shell can render this page.

## concepts

- entities: [
    "DataQualityDashboard (the page) — the catalog-wide aggregate quality view; this component is its DOM root (`DataQuality.tsx:7-18`)",
    "DataQualityAtomProvider — a jotai `Provider` scope; isolates the dashboard's filter atoms to this subtree's lifetime (`DataQualityProvider.tsx:4-6`)"
  ]
- operations: [
    "mount-data-quality-page — render the provider + sidebar + content skeleton (`DataQuality.tsx:7-18`)",
    "establish-filter-atom-scope — create a fresh jotai Provider so dashboard filter state does not bleed across mounts (`DataQuality.tsx:8`, `DataQualityProvider.tsx:5`)",
    "compose-two-pane-layout — sticky filter sidebar + scrolling content pane (`DataQuality.tsx:9-16`)"
  ]
- invariants: [
    "Stateless / pure-composition — the component has no `useState`, `useEffect`, `useAtom`, or data fetch; it is a static JSX tree (`DataQuality.tsx:7-18`)",
    "The jotai `Provider` wraps BOTH children — `DataQualityFilters` (writer of `formFiltersAtom`) and `DataQualityContent` (reader of `filtersAtom`) share one atom scope, so the filter sidebar and the dashboard content communicate through that shared store (`DataQuality.tsx:8-17`)",
    "The sidebar is `position: sticky` + `align-self: flex-start` — it stays pinned while the content pane scrolls; `max-width: 15rem` (`DataQuality.tsx:10`, `layout.ts:13-25`)",
    "Default-exported — required because `App.tsx:39` consumes it via `React.lazy(() => import('./DataQuality/DataQuality'))`, which resolves the module's default export (`DataQuality.tsx:20`)"
  ]
- audiences: [
    "odd-platform-ui-end-user — any authenticated user; reaches the page via the top-bar 'Data Quality' tab (`ToolbarTabs.tsx:45-49`) or by navigating directly to `/data-quality`",
    "data-quality-engineer — the primary intended audience per the live doc; the page is the catalog-wide quality view backing the DQ-Engineer use case (per live doc `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200, which links `/use-cases/use-cases/dq-visibility.md` 'Data Quality Engineer use case')"
  ]

## dependencies_semantic

- requires-feature: [
    "P-04 Data Quality pillar — the page only has content if test results have been ingested; the dashboard aggregates already-ingested DQ data (no test execution inside ODD, per the pillar invariant — see DataQualityController sidecar `implicit_adrs`)",
    "P-04:F-002 backend dashboard endpoint — the page is an empty shell unless `DataQualityContent`'s `useGetDataQualityDashboard` fetch resolves; that endpoint is owned by the DataQualityContent sibling node (REFERENCE — `unresolved: true`)"
  ]
- requires-config: [] — N/A. The component reads no `process.env`, no feature flag, no runtime config. The `/data-quality` tab is shown unconditionally in `ToolbarTabs.tsx:45-49` (not behind `fetchActiveFeatures`).
- requires-runtime: [
    "React 18 — `React.FC`, JSX (`DataQuality.tsx:1, 7`)",
    "jotai — the `Provider` component re-exported as `DataQualityAtomProvider` (`DataQualityProvider.tsx:2`)",
    "react-router-dom — the component is mounted as a `<Route element>` and is reachable only inside the router tree (`App.tsx:2, 73`)",
    "React.lazy + Suspense — the component is code-split; its chunk loads on first navigation to `/data-quality`, with `AppLoadingPage` as the Suspense fallback (`App.tsx:39, 58`, `AppSuspenseWrapper.tsx:14, 20`)"
  ]
- couples-to: [
    "`DataQualityFilters` — direct child; the writer side of the shared filter atoms (`DataQuality.tsx:3, 11`)",
    "`DataQualityContent` — direct child; the reader side + the dashboard data fetch (`DataQuality.tsx:5, 14`)",
    "`DataQualityAtomProvider` / `DataQualityProvider.tsx` — the jotai scope wrapper (`DataQuality.tsx:4, 8`)",
    "`components/shared/styled-components/layout` — the `LayoutContainer` / `Sidebar` / `Content` primitives shared with other two-pane pages, e.g. Directory (`DataQuality.tsx:2`, `layout.ts:3-31`)",
    "`App.tsx` route registry — the sole mount site; `App.tsx:39` (lazy import) + `App.tsx:73` (Route element)"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test file references `DataQuality.tsx`; see `uncovered_behaviours`.
- uncovered_behaviours:
  - behaviour: "Navigating to `/data-quality` renders the `DataQuality` component (route registration is correct)"
    test_class: integration
    criticality: LOW
    note: "Route-registration regression — covered implicitly only if an e2e/Playwright suite exercises the tab; no such test found in the UI tree."
  - behaviour: "The `/data-quality` page is reachable by any authenticated user — no permission guard"
    test_class: security
    criticality: MEDIUM
    note: "No test asserts the route is OR is not gated. The absence of `WithPermissionsProvider` (contrast `LookupTables`, App.tsx:75-88) is the intended state per the code, but a future tightening to gate the dashboard would have no test to break. See P-090."
  - behaviour: "The jotai `Provider` isolates filter atoms per mount — re-entering `/data-quality` starts with cleared/default filters, no leak from a prior visit"
    test_class: integration
    criticality: LOW
    note: "`DataQualityAtomProvider` creates a fresh atom scope per mount; no test asserts the no-leak property. Low risk — it is jotai's documented default behaviour."
- test_files: [] — no test file in `odd-platform-ui/src` references `DataQuality.tsx`, `DataQualityProvider`, or `DataQualityAtomProvider` (Grep over `*.tsx`/`*.ts` in `odd-platform-ui/src`, 2026-05-22).
- gaps: |
    This node has zero direct test coverage. It is a 20-line pure-composition
    component, so unit-testing its own logic would assert nothing meaningful —
    the real regression surface is the `App.tsx` route wiring (a renamed
    `dataQualityPath()` or a dropped `<Route>` line silently 404s the page)
    and the lazy-chunk boundary (a broken dynamic import shows the Suspense
    fallback forever). The worst-coverage class is `integration`: there is no
    Playwright/Cypress test that clicks the 'Data Quality' tab and asserts the
    dashboard skeleton renders. The highest-leverage gap is the `security`
    class — no test pins whether `/data-quality` is permission-gated, so the
    deliberate "any-authenticated" posture is undocumented AND unguarded by a
    regression test (see `stress_findings.auth_gates` + P-090).

## docs_link_semantic

- declared_docs: [] — N/A. `DataQuality.tsx` carries no `// @docs:` annotation; this matches the repo-wide UI convention (no React component in the tree declares `@docs`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "Dedicated sub-page for the standalone Quality Dashboard — names the `/data-quality` route and describes the three breakdown rings + the test-category matrix + the two-set filter sidebar this component's subtree renders. This is the canonical doc page for P-04:F-002 / this node."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Route (verbatim): the dashboard is located at `"/data-quality"` and serves as
      "the catalog's cross-entity quality view."

      Three breakdown rings (verbatim):
        - Table Health — "the count of tables broken down by their aggregate
          health status (success / failed / broken)."
        - Test Results Breakdown — "the count of test runs broken down by status
          (passed / failed / skipped)."
        - Monitored Tables — "the count of tables broken down by whether they are
          monitored (have at least one DQ test) or unmonitored."

      Test-category matrix (verbatim): "the right-side matrix shows failures
      across six anomaly dimensions" — Assertion Tests, Column Values Anomalies,
      Freshness Anomalies, Schema Changes, Unknown Category, Volume Anomalies.

      Filter sidebar (verbatim): "Two independent filter sets using five
      dimensions (Namespace, Datasource, Owner, Title, Tag)" — a tables-side set
      and a tests-side set.

      Admonition block (verbatim): one info block — "`AND`-only conjunction" —
      "the platform implements only AND logic across filter dimensions; results
      are the intersection of all selected filters."

      Access-control language (verbatim absence): the page contains "no
      information about access control, permissions, or who can view the
      dashboard."
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "Pillar landing page — distinguishes the top-level 'Data Quality' tab (aggregate dashboard) from the per-entity 'Test reports' tab, and names the dashboard.md sub-page."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Dashboard mention (verbatim): "the catalog-wide quality view at
      `/data-quality` — three breakdown rings (Table Health / Test Results /
      Monitored Tables), six anomaly-class metrics."

      Surface distinction (verbatim, paraphrased by the fetch): the page
      "distinguishes between two access points: the top-level Data Quality tab
      for the aggregate dashboard, versus individual entity Test reports tabs
      for per-dataset views."

      Access-control language (verbatim absence): the page "contains no
      information about access control, permissions, or who can view the
      dashboard."
- doc_drift_findings:
  - "**DOC GAP — access control / 'who can see the dashboard' is silent on every Data Quality doc page.** The live `dashboard.md` (WebFetched 2026-05-22 status 200) and the live `data-quality.md` landing (same date, status 200) make NO statement about access control or permissions. The code is unambiguous: the `/data-quality` route is mounted at `App.tsx:73` with NO `WithPermissionsProvider` wrapper (contrast `/lookup-tables` at `App.tsx:75-88`, which IS wrapped), and the 'Data Quality' top-bar tab is rendered unconditionally (`ToolbarTabs.tsx:45-49`). Any authenticated user can open the catalog-wide aggregate quality view. The doc-side silence is consistent with the platform's read-collaborative posture (the DataQualityController sidecar records the same silence for the four DQ read endpoints — `doc_drift_findings[1]` there), but the dashboard page is the natural place to disclose 'visible to any authenticated user' and it does not. Severity: MEDIUM — operator-facing surprise, not a guide-off-a-cliff."
  - "**NO content drift on the dashboard structure.** The live `dashboard.md` description of three breakdown rings (Table Health / Test Results Breakdown / Monitored Tables) and the two-set filter sidebar (tables-side + tests-side; Namespace/Datasource/Owner/Title/Tag) matches the code this node mounts: `DataQualityContent.tsx:91-144` renders exactly three `DonutChart`s with those titles, and `DataQualityFilters.tsx:61-90` renders exactly two `ListContainer`s ('Filters for tables' / 'Filters for tests') each with five filter rows. The doc and code agree on the dashboard's shape. (Verification of the ring counts / filter rows belongs to the `DataQualityContent` and `DataQualityFilters` sibling sidecars; recorded here as the cross-surface agreement note for the route-entry node.)"

## implicit_adrs

- "**Each entry-level route page that has its own scoped client state mounts a private jotai `Provider`, rather than sharing the app-global atom store.** `DataQuality` wraps its entire subtree in `DataQualityAtomProvider` — a thin re-export of jotai's `<Provider>` (`DataQualityProvider.tsx:4-6`). The decision is to give the dashboard's filter atoms a lifetime bounded by the page mount: navigating away and back to `/data-quality` starts from a clean atom scope, and the dashboard's `filtersAtom` cannot collide with any other feature's atoms. The intent is visible in the deliberate wrapper component — a no-op pass-through whose only reason to exist is to name and localise the atom scope." — evidence: `DataQuality.tsx:8, 17` (the `<DataQualityAtomProvider>` wrapping both children) + `DataQualityProvider.tsx:1-6` (the wrapper is `<Provider>{children}</Provider>` and nothing else) — intent_anchor: "export const DataQualityAtomProvider: React.FC<React.PropsWithChildren> = ({ children }) => <Provider>{children}</Provider>;" (`DataQualityProvider.tsx:4-6`) — confidence: HIGH

- "**Every primary navigation page is lazy-loaded and code-split — the `/data-quality` chunk is not in the initial bundle.** `App.tsx:39` registers `DataQuality` via `React.lazy(() => import('./DataQuality/DataQuality'))`, consistent with all 11 other primary routes in the same block (`App.tsx:30-41`). The decision is a uniform code-splitting convention applied across the route registry: the dashboard's JS (and its jotai store, charts, filter components) downloads only when a user first navigates to `/data-quality`. The convention is applied identically to every sibling route — that uniformity is the evidence of an intentional pattern, not an incidental choice." — evidence: `App.tsx:30-41` (all 12 primary route components declared via `lazy(() => import(...))`) + `App.tsx:58` (the single `AppSuspenseWrapper` providing the fallback for all of them) — intent_anchor: "const DataQuality = lazy(() => import('./DataQuality/DataQuality'));" (`App.tsx:39`) — confidence: HIGH

- "**The two-pane sticky-sidebar layout (`LayoutContainer` / `Sidebar` / `Content`) is a shared cross-feature layout primitive, not a per-page bespoke layout.** `DataQuality.tsx:2` imports the layout components from `components/shared/styled-components/layout` and composes the standard sidebar-plus-content shell. The decision is to keep filter-sidebar pages visually and structurally consistent by reusing one set of styled primitives rather than re-implementing flex layout per page; `layout.ts:3-31` is a tiny shared module whose `Sidebar` is parameterised (`$position`, `$alignSelf`) precisely so multiple pages can reuse it with page-specific stickiness. The shared module's existence and parameterisation is the evidence of the convention." — evidence: `DataQuality.tsx:2, 9-16` (the import + the `LayoutContainer`/`Sidebar`/`Content` composition) + `layout.ts:13-25` (the parameterised `Sidebar` styled component, designed for reuse) — intent_anchor: "export const Sidebar = styled('aside')<{ $alignSelf?: CSSObject['alignSelf']; $position?: CSSObject['position']; }>" (`layout.ts:13-16`) — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**The `/data-quality` route has no client-side permission guard — it is reachable by any authenticated user regardless of role or ownership.** `App.tsx:73` mounts the route as a bare `<Route path={dataQualityPath()} element={<DataQuality />} />`. The sibling `/lookup-tables` route directly below it (`App.tsx:75-88`) IS wrapped in `WithPermissionsProvider` with explicit `allowedPermissions`. The 'Data Quality' top-bar tab is also rendered unconditionally (`ToolbarTabs.tsx:45-49` — no permission check, no conditional render). Whether this is a defect or the intended read-collaborative posture cannot be settled from the frontend alone — the dashboard data comes from a backend endpoint owned by the `DataQualityContent` sibling. If the backend endpoint also has no gate (the hypothesis under P-090), the catalog-wide aggregate health of every dataset is visible to every authenticated principal. Recorded here as a corner-case (not an `implicit_adr`) because there is NO comment, exception, or convention in this file or `App.tsx` defending the absence of a guard — it is an unexplained absence." — evidence: `App.tsx:73` (bare route, no wrapper) vs `App.tsx:75-88` (the `LookupTables` route IS wrapped in `WithPermissionsProvider`) + `ToolbarTabs.tsx:45-49` (unconditional tab) — severity: MEDIUM

- "**A broken or slow `/data-quality` lazy chunk shows the global `AppLoadingPage` fallback with no timeout and no error boundary at this node.** `DataQuality` is `React.lazy`-loaded (`App.tsx:39`) inside `AppSuspenseWrapper`, whose only Suspense `fallback` is `<AppLoadingPage />` (`AppSuspenseWrapper.tsx:14, 20`). If the dynamic `import()` fails (chunk 404 after a redeploy that changed chunk hashes, or a network drop), React's lazy throws and there is no `ErrorBoundary` around the route — the user sees the loading page indefinitely or an uncaught error, with no retry affordance. This is a generic consequence of the app-wide lazy pattern, not specific to `DataQuality`, but it applies to this node because the node is the lazy boundary." — evidence: `App.tsx:39` (`lazy` import) + `App.tsx:58` (`AppSuspenseWrapper` is the only wrapper — no `ErrorBoundary` sibling) + `AppSuspenseWrapper.tsx:8-21` (Suspense only, no error handling) — severity: LOW

- "**`DataQuality.tsx` mounts no error or empty-state UI of its own — a failed dashboard data fetch surfaces only inside `DataQualityContent`.** This component is pure layout: it renders the sidebar and content shells unconditionally. If the dashboard endpoint errors, `DataQualityContent`'s `useGetDataQualityDashboard` hook returns `isSuccess: false` and `data` undefined; `DataQualityContent.tsx:33,44,54,66` early-return empty arrays and the page renders empty donut charts with no error message. The route-entry node does not and cannot compensate. Recorded here so the feature-flow reducer sees that error-state ownership lives in the `DataQualityContent` sibling, not this node." — evidence: `DataQuality.tsx:13-15` (the `Content` pane unconditionally renders `<DataQualityContent/>`) + `DataQualityContent.tsx:24, 33, 44` (the fetch + the `if (!data) return []` early returns — no error UI) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
    # No numeric literals, no @Value-equivalent, no magic strings gating behaviour
    # in DataQuality.tsx. (The DONUT_CHART_* size constants live in the
    # DataQualityContent sibling node — DataQualityContent.tsx:17-20 — not here;
    # they are out of this node's scope.)
  name_behavior_pairs:
    - name: "DataQuality (React component)"
      promise: "Renders the Data Quality page."
      implementation: "Renders <DataQualityAtomProvider> wrapping a two-pane Layout: a sticky Sidebar containing <DataQualityFilters/> and a Content pane containing <DataQualityContent/>. Pure composition — no data, no state (DataQuality.tsx:7-18)."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataQuality.tsx:7-18"
    - name: "DataQualityAtomProvider"
      promise: "Provides an atom store scoped to the Data Quality subtree."
      implementation: "Re-exports jotai's <Provider> verbatim — <Provider>{children}</Provider>. The name accurately describes a jotai Provider scope; 'Atom' in the name refers to jotai atoms (DataQualityProvider.tsx:2-6)."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataQualityProvider.tsx:1-6"
    - name: "dataQualityPath()"
      promise: "Returns the route path for the Data Quality page."
      implementation: "Returns the constant string '/data-quality' (dataQualityRoutes.ts:1-3). Used both for the <Route path> at App.tsx:73 and the tab link at ToolbarTabs.tsx:47 — single source of truth, no drift."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "dataQualityRoutes.ts:1-3 + App.tsx:73 + ToolbarTabs.tsx:47"
  orderings: []
    # No ORDER BY, no LIMIT/paginate, no .sort()/Comparator in this node.
    # (The dashboard's test-category list IS sorted — data.testResults.toSorted(...)
    # at DataQualityContent.tsx:76 — but that ordering is owned by the
    # DataQualityContent sibling node, not this route-entry node.)
  auth_gates:
    - location: "App.tsx:73"
      endpoint: "UI route mount — <Route path='/data-quality' element={<DataQuality />} />"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The route mount itself is auth-mode-agnostic at the React layer — App is only rendered after the app shell loads, which is reached only post-authentication for LOGIN_FORM/OAUTH2/LDAP and unconditionally for DISABLED. There is NO per-mode branching at App.tsx:73 or in DataQuality.tsx: the component renders identically in all four modes for any caller who reaches the app shell. Auth-mode enforcement is global (the *SecurityConfiguration beans on the backend), not local to this route."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:43-94 (no auth-mode branching in the route registry) + DataQuality.tsx:7-18 (no mode check)"
        - q: "What does an unauthenticated caller see?"
          a: "An unauthenticated caller never reaches App.tsx's route table — for LOGIN_FORM/OAUTH2/LDAP the backend redirects to the auth flow before the SPA shell + App component render. For auth.type=DISABLED there is no authentication, so 'unauthenticated' is not a meaningful state and the page renders. The route-entry node has no own auth check; this is a global-config behaviour."
          confidence: STATIC-INFERRED
          evidence: "DataQuality.tsx:7-18 (no guard) + App.tsx:73 (bare route) — global auth is enforced upstream of the SPA"
        - q: "What does a wrong-role caller see?"
          a: "A caller with any authenticated role — including a minimum-privilege user with zero Permissions and zero ownership associations — renders the FULL /data-quality page. The route at App.tsx:73 is a bare <Route>, NOT wrapped in WithPermissionsProvider (contrast the /lookup-tables route immediately below at App.tsx:75-88, which IS wrapped and gates on LOOKUP_TABLE_* permissions). The 'Data Quality' top-bar tab is rendered unconditionally with no permission check (ToolbarTabs.tsx:45-49). Whether the wrong-role caller then sees DATA in the dashboard depends on the backend dashboard endpoint's authorization — owned by the DataQualityContent sibling; the frontend imposes no role restriction. PROBE-NEEDED for the backend half."
          confidence: PROBE-NEEDED
          evidence: "P-090"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "At the FRONTEND layer: NOWHERE. App.tsx:73 has no WithPermissionsProvider; ToolbarTabs.tsx:45-49 has no conditional. The frontend route is ungated. Whether a gate exists at the BACKEND dashboard endpoint is not determinable from this node — the fetch lives in the DataQualityContent sibling. P-090 pins the backend posture."
          confidence: PROBE-NEEDED
          evidence: "App.tsx:73 (no wrapper) + ToolbarTabs.tsx:45-49 (no conditional) + P-090 for the backend"
  resource_boundaries:
    - location: "DataQuality.tsx:8 + DataQualityProvider.tsx:4-6"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Not applicable in the backend sense — this is a React render, not a concurrent server call. Each mount of <DataQuality> creates a fresh, independent jotai Provider scope (DataQualityProvider.tsx:5). Two browser tabs each get their own JS runtime and their own atom store; there is no shared mutable state across mounts or tabs. No corruption surface."
          confidence: STATIC-INFERRED
          evidence: "DataQualityProvider.tsx:4-6 (fresh <Provider> per mount) + DataQuality.tsx:8"
        - q: "Is the call replay-safe?"
          a: "Yes — rendering <DataQuality> is idempotent. It has no side effects (no useEffect, no dispatch, no fetch in this node). Unmounting and remounting the route produces an identical fresh skeleton; the jotai Provider's atom scope is recreated with default atom values each mount, so a re-visit to /data-quality does not inherit a prior visit's filter state."
          confidence: STATIC-INFERRED
          evidence: "DataQuality.tsx:7-18 (no side effects) + DataQualityProvider.tsx:4-6 (fresh scope per mount)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache at this node. The component renders no data. (Dashboard data IS fetched + may be react-query-cached inside the DataQualityContent sibling's useGetDataQualityDashboard hook — caching semantics there are owned by that sibling node, recorded as a REFERENCE.)"
          confidence: REFERENCE
          evidence: "odd-platform ts react-component component:DataQualityContent (useGetDataQualityDashboard)"
  request_inputs: []
    # DataQuality.tsx handles no request inputs. It is a route-entry component
    # mounted on the STATIC path '/data-quality' — dataQualityRoutes.ts:1-3
    # returns a literal string with NO path parameters, NO route segments to
    # capture. The component reads no query parameters, no body, no headers.
    # The dashboard's query-parameter filters (deNamespaceIds, datasourceIds,
    # ownerIds, titleIds, tagIds, etc. — synced to the URL via useSearchParams)
    # are owned and read by the DataQualityFilters sibling node
    # (DataQualityFilters.tsx:25-54, 70-89), NOT by this node. Category F is
    # therefore empty for the route-entry node and is the responsibility of the
    # DataQualityFilters sibling sidecar. Recorded as explicit [] per Rule 9 so
    # "checked, no triggers" is distinct from "forgot to check".
  probes_emitted:
    - probe_id: P-090
      question: "Is the catalog-wide /data-quality dashboard endpoint readable by any authenticated user (including a minimum-privilege user with no Permissions and no ownership), or is it permission-gated at the backend? The frontend route has NO guard (App.tsx:73)."
      probe_path: "lineage/odd-platform/probes/P-090.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 13
    answers_static_inferred: 10
    answers_probe_needed: 2
    answers_reference: 1
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — under these three modes the SPA shell (and therefore this route) renders only after authentication; the global `*SecurityConfiguration` beans enforce the gate, not this component. Under `DISABLED` the page is anonymously reachable like every other route. There is no per-mode branching in `DataQuality.tsx` or at the `App.tsx:73` route registration.
- **ingestion_filter_relevance**: `NO — UI route component, not an ingestion path`. This is a React component; it has no relationship to `POST /ingestion/entities` or the `IngestionDataEntitiesFilter`.
- **authorization_assertions**: [] — `DataQuality.tsx` enforces no permission. The `/data-quality` route at `App.tsx:73` is a bare `<Route>` with no `WithPermissionsProvider` (contrast `/lookup-tables` at `App.tsx:75-88`, which gates on `LOOKUP_TABLE_CREATE | LOOKUP_TABLE_UPDATE | LOOKUP_TABLE_DELETE`). The 'Data Quality' top-bar tab (`ToolbarTabs.tsx:45-49`) is rendered with no permission check. — evidence: `App.tsx:73` + `App.tsx:75-88` (the contrasting sibling) + `ToolbarTabs.tsx:45-49`
- **owner_scoping**: `N/A — this node is not data-scoped`. `DataQuality.tsx` fetches and renders no data; it is a layout shell. Owner-scoping (if any) of the dashboard aggregate is a property of the backend dashboard endpoint, owned by the `DataQualityContent` sibling node — recorded as a REFERENCE, surfaced for runtime verification by P-090.
- **data_exposure**:
  - "No data is exposed BY this node directly — it renders zero data fields (`DataQuality.tsx:7-18`). Indirectly, by mounting `<DataQualityContent/>` it places the catalog-wide aggregate quality view (table-health counts, monitored/unmonitored counts, test-results breakdown across all datasets) in front of whatever user reached the route — and any authenticated user can reach the route (no frontend guard). The actual data shape exposed is owned by `DataQualityContent` + the backend endpoint." — evidence: `DataQuality.tsx:13-15` (mounts `DataQualityContent`) + `App.tsx:73` (ungated route) + `ToolbarTabs.tsx:45-49` (unconditional tab)
- **known_security_gaps**:
  - "The `/data-quality` route is mounted with NO client-side permission guard (`App.tsx:73`, a bare `<Route>`), unlike the sibling `/lookup-tables` route which IS wrapped in `WithPermissionsProvider` (`App.tsx:75-88`). The 'Data Quality' tab is shown to every authenticated user unconditionally (`ToolbarTabs.tsx:45-49`). If the backend dashboard endpoint also lacks an authorization gate (hypothesis under P-090), the catalog-wide aggregate health of every dataset is visible to every authenticated principal — coherent with the platform's documented read-collaborative posture (the DataQualityController sidecar records the same for the four DQ read endpoints) but undocumented on every live Data Quality doc page. Whether this is a gap or the intended posture is a maintainer-triage call; the actionable item is the doc-gap." — evidence: `App.tsx:73` (bare route) + `App.tsx:75-88` (the gated sibling, for contrast) + `ToolbarTabs.tsx:45-49` (unconditional tab) + WebFetch `dashboard.md` + `data-quality.md` 2026-05-22 (both silent on access control) — severity: MEDIUM

## performance

- **hot_paths**:
  - "`DataQuality.tsx` is on the render critical path the first time a user navigates to `/data-quality`, but its own render cost is negligible — a 4-element static JSX tree with no data, no computation, no effects (`DataQuality.tsx:7-18`). The real per-render cost (the dashboard data fetch, the three `DonutChart` SVG renders, the per-category result rows) lives in the `DataQualityContent` sibling node." — evidence: `DataQuality.tsx:7-18`
- **throughput_characteristics**:
  - "No request, no batch, no stream at this node — `DataQuality` issues no network call. (The single dashboard fetch is `useGetDataQualityDashboard` in the `DataQualityContent` sibling — REFERENCE.)" — evidence: `DataQuality.tsx:1-20` (no fetch, no `useEffect`)
- **resource_allocation**:
  - "Code-split: the `/data-quality` JS chunk (this component + its subtree + the jotai store) is NOT in the initial bundle; it downloads on first navigation to the route, with `AppLoadingPage` shown during the fetch (`App.tsx:39, 58`, `AppSuspenseWrapper.tsx:14`). This keeps the app's initial bundle smaller; the cost is a one-time chunk-download latency on first dashboard visit." — evidence: `App.tsx:39` (`lazy` import) + `AppSuspenseWrapper.tsx:8-21`
- **scaling_characteristics**:
  - "Stateless, pure-composition component — no instance state, no shared mutable state, no module-level mutable singletons. Each mount creates an independent jotai `Provider` scope (`DataQualityProvider.tsx:5`). The component places no constraint on horizontal scaling of the SPA (the SPA is static assets) or of the backend." — evidence: `DataQuality.tsx:7-18` + `DataQualityProvider.tsx:4-6`
- **known_performance_gaps**: [] — N/A. As a 20-line static-composition route-entry component with no data, no effects, and no computation, `DataQuality.tsx` has no file-local performance gap. Dashboard-data-fetch and chart-render performance concerns belong to the `DataQualityContent` sibling node.

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts route-registry App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:73 — `<Route path={dataQualityPath()} element={<DataQuality />} />`. The route element is instantiated once per navigation to `/data-quality`. `dataQualityPath()` (dataQualityRoutes.ts:1-3) returns the static string `/data-quality`. The component is lazy-loaded — `App.tsx:39` `const DataQuality = lazy(() => import('./DataQuality/DataQuality'))` — so the first mount also triggers the chunk download (Suspense fallback `AppLoadingPage`, App.tsx:58 + AppSuspenseWrapper.tsx:14). LSN-017 multiplicity check: this node has NO useEffect and dispatches NOTHING — there is no double-dispatch surface at the route-entry node. Multiplicity is exactly 1 mount per navigation."
  observation_class: ui-call

- entry_point: "ui_button:ToolbarTabs 'Data Quality' tab"
  caller_node: "odd-platform ts react-component component:ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:45-49 — the 'Data Quality' tab entry with `link: dataQualityPath()`. Clicking the tab navigates the router to `/data-quality`, which mounts this component via the App.tsx:73 route. The tab is rendered unconditionally (no permission check). This is the same terminal mount as the ui_route entry point — recorded separately because the tab click is the user-facing trigger, the route is the mechanism. `handleTabClick` (ToolbarTabs.tsx:107-126) has no special branch for 'Data Quality' (it special-cases only 'Dictionary' and 'Catalog'), so the tab click is a plain navigation."
  caller_node_unresolved: true
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders the Data Quality dashboard page skeleton — a sticky filter sidebar (<DataQualityFilters/>) and a content pane (<DataQualityContent/>), both inside a fresh jotai atom Provider scope. This is the only externally-observable effect of mounting this node: the user sees the two-pane dashboard shell appear."
  evidence: "DataQuality.tsx:7-18"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-quality"
    - "ui_button:ToolbarTabs 'Data Quality' tab"

# NOTE: DataQuality.tsx itself produces NO db-write, NO activity-emit, NO
# external-call, NO sse-push, NO cache-mutate, NO header-set, NO redirect. It is
# pure composition. The dashboard DATA FETCH (useGetDataQualityDashboard) and any
# of its side effects are owned by the DataQualityContent sibling node — recorded
# in this sidecar's `references` block (unresolved: true) and to be resolved when
# that sibling's sidecar is written this batch. The route-entry node's
# downstream_side_effects is legitimately just the page-render.

## sources

- understanding ← `DataQuality.tsx:1-20` (full file) + `App.tsx:39, 73` (lazy import + route mount) + `DataQualityProvider.tsx:1-6` (the jotai Provider wrapper) + `App.tsx:75-88` (the contrasting gated `/lookup-tables` route)
- concepts.entities ← `DataQuality.tsx:7-18` + `DataQualityProvider.tsx:4-6`
- concepts.operations ← `DataQuality.tsx:7-18` + `DataQualityProvider.tsx:5`
- concepts.invariants[0] ← `DataQuality.tsx:7-18` (no `useState`/`useEffect`/`useAtom`/fetch)
- concepts.invariants[1] ← `DataQuality.tsx:8-17` (the `<DataQualityAtomProvider>` wrapping both children)
- concepts.invariants[2] ← `DataQuality.tsx:10` + `layout.ts:13-25`
- concepts.invariants[3] ← `DataQuality.tsx:20` (`export default`) + `App.tsx:39` (`React.lazy` consumes the default export)
- concepts.audiences ← `ToolbarTabs.tsx:45-49` (the tab) + WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200
- dependencies_semantic.requires-runtime ← `DataQuality.tsx:1` (React) + `DataQualityProvider.tsx:2` (jotai) + `App.tsx:2, 73` (react-router-dom) + `App.tsx:39, 58` + `AppSuspenseWrapper.tsx:14, 20` (lazy + Suspense)
- dependencies_semantic.couples-to ← `DataQuality.tsx:2-5` (the four imports) + `App.tsx:39, 73` (route registry) + `layout.ts:3-31`
- tests_coverage_semantic.test_files ← Grep over `odd-platform-ui/src` `*.tsx`/`*.ts` for `DataQuality`/`DataQualityProvider`/`DataQualityAtomProvider` (2026-05-22) — no test file references this node
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch `dashboard.md` + `data-quality.md` 2026-05-22 (both silent on access control) + `App.tsx:73` (no guard) + `App.tsx:75-88` (gated sibling) + `ToolbarTabs.tsx:45-49`
- docs_link_semantic.doc_drift_findings[1] ← WebFetch `dashboard.md` 2026-05-22 + `DataQualityContent.tsx:91-144` (three `DonutChart`s) + `DataQualityFilters.tsx:61-90` (two filter `ListContainer`s)
- implicit_adrs[0] ← `DataQuality.tsx:8, 17` + `DataQualityProvider.tsx:1-6`
- implicit_adrs[1] ← `App.tsx:30-41` (all 12 routes lazy) + `App.tsx:58`
- implicit_adrs[2] ← `DataQuality.tsx:2, 9-16` + `layout.ts:13-25`
- bugs_limitations_corner_cases[0] ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49`
- bugs_limitations_corner_cases[1] ← `App.tsx:39, 58` + `AppSuspenseWrapper.tsx:8-21`
- bugs_limitations_corner_cases[2] ← `DataQuality.tsx:13-15` + `DataQualityContent.tsx:24, 33, 44`
- stress_findings.auth_gates ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49` + `DataQuality.tsx:7-18` + probe `lineage/odd-platform/probes/P-090.yaml`
- stress_findings.resource_boundaries ← `DataQuality.tsx:7-18` + `DataQualityProvider.tsx:4-6`
- security.authorization_assertions ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49`
- security.known_security_gaps[0] ← `App.tsx:73` + `App.tsx:75-88` + `ToolbarTabs.tsx:45-49` + WebFetch `dashboard.md` + `data-quality.md` 2026-05-22
- performance.resource_allocation ← `App.tsx:39` + `AppSuspenseWrapper.tsx:8-21`
- upstream_callers[0] ← `App.tsx:39, 58, 73` + `dataQualityRoutes.ts:1-3` + `AppSuspenseWrapper.tsx:14`
- upstream_callers[1] ← `ToolbarTabs.tsx:45-49, 107-126`
- downstream_side_effects[0] ← `DataQuality.tsx:7-18`

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
  # All 13 stress questions are answered; 10 STATIC-INFERRED with strong file:line
  # evidence, 1 REFERENCE (cache semantics legitimately owned by the
  # DataQualityContent sibling), 2 PROBE-NEEDED. The 2 PROBE-NEEDED questions are
  # the BACKEND half of the auth-gate question — the FRONTEND half (the route is
  # ungated, App.tsx:73) is STATIC-INFERRED with certainty. The load-bearing
  # operator-observable claim of THIS node (frontend route reachability) is
  # statically certain; the backend posture is correctly deferred to P-090.
  # Fewer than half of load-bearing questions are PROBE-NEEDED → HIGH stands.

## Maintainer notes


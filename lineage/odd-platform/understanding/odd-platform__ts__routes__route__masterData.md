---
node_id: "odd-platform ts routes route:masterData"
node_kind: route
axis: routes
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-26-ZH-masterDataRoutes
---

# masterDataRoutes — semantic understanding

## understanding

Five-line route-path helper module that exports a single nullary function `lookupTablesPath()` returning the literal string `/master-data/lookup-tables`. It declares an internal `BASE_PATH = '/master-data'` constant but exports no helper for the bare base, and no React `<Route>` is mounted at `/master-data` anywhere in the app — visiting `/master-data` directly produces no element match (react-router does not auto-redirect to nested children). The file's three consumers are `App.tsx` (mounts the Lookup Tables route under a `WithPermissionsProvider` that — by design or by accident — does NOT block rendering), `ToolbarTabs.tsx` (the "Master Data" toolbar tab links here as its only target), and `LookupTableForm.tsx` (post-create / post-edit redirect target).

## concepts

- entities: [LookupTable (the only first-class entity reachable via this route), MasterData (the URL-namespace / toolbar-tab label — currently a one-feature pillar)]
- operations: [generate-lookup-tables-url, anchor-toolbar-tab, anchor-form-redirect]
- invariants:
  - "The `/master-data` URL namespace is reserved for the Master Data Management pillar (P-03) but currently exposes exactly one nested route — `/lookup-tables`"
  - "`lookupTablesPath()` is the single canonical builder; never construct the URL by string-concatenation outside this module"
  - "The function is nullary — there is no table-id / row-id / namespace-scoped variant; deep links to a specific lookup table go through Data Entity Details, not through this route family (verified: no `:tableId` parameter declared)"
- audiences: [ui-end-user (Master Data tab in toolbar), ui-developer (route builder consumed by 3 sites), product-author (canonical home for the Master Data pillar surface)]

## dependencies_semantic

- requires-feature:
  - "Reference Data backend (`ReferenceDataController` at `/api/referencedata/*`) — the route is meaningless without the underlying API that the `<LookupTables />` element calls"
  - "Permission framework — the route mount in `App.tsx:75-88` references `Permission.LOOKUP_TABLE_CREATE / _UPDATE / _DELETE` from `generated-sources`"
- requires-config: []
- requires-runtime:
  - "react-router-dom — `App.tsx:60-89` mounts the path as a `<Route>` element inside `<Routes>`"
  - "Redux profile state — `WithPermissionsProvider` reads `profile.owner.identity.permissions` via `getGlobalPermissions` (`profile.selectors.ts:17-20`); without a logged-in user this returns the `emptyArr` constant"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Calling `lookupTablesPath()` returns the literal `/master-data/lookup-tables`"
    test_class: unit
    criticality: LOW
    note: "Trivial returning-a-literal function; a unit test would tautologically restate the implementation."
  - behaviour: "Visiting `/master-data` (bare base path) produces a no-match / fallback render rather than a 404 page or a redirect to `/master-data/lookup-tables`"
    test_class: integration
    criticality: MEDIUM
    note: "Operator-visible: a user clicking 'Master Data' would expect to land on the only sub-route, not on an empty content area. No fallback `<Route>` is declared in App.tsx for `/master-data`."
  - behaviour: "Visiting `/master-data/lookup-tables` with zero of LOOKUP_TABLE_CREATE / _UPDATE / _DELETE renders the LookupTables list (the page itself is not gated; only the '+ Add new' button is gated)"
    test_class: security
    criticality: HIGH
    note: "Pairs with the Category-D finding below. No Playwright / Cypress test asserts the route-level gate behaviour; manual verification is required."
  - behaviour: "Visiting `/master-data/lookup-tables` when fully unauthenticated (auth.type=LOGIN_FORM, no cookie) routes to login or renders chrome"
    test_class: security
    criticality: HIGH
    note: "The route mount does NOT gate by 'authenticated'; the upstream HTTP-layer auth filter must redirect — but this is a separate concern from the route's permission-list configuration."
- test_files: []
- gaps: |
    Two-line route module with no dedicated test. The interesting test surface is INTEGRATION (does the route mount + provider combination actually block under-permissioned users? — answer: no, the provider passes context, it does not block) and SECURITY (does the page chrome leak any data that should be backend-RBAC-only?). Both would catch the Category-D drift below.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables"
    anchor: ""
    rationale: "Canonical doc home for the Master Data Management pillar. The doc page states verbatim: 'In the platform UI, lookup tables live under the top-level Master Data tab → Lookup Tables.' (live WebFetch 2026-05-26, 200). This route is the implementation of that statement."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Quoted from the page (WebFetch 2026-05-26, status 200):
      "In the platform UI, lookup tables live under the top-level **Master Data** tab → **Lookup Tables**."
      "[the +Add new button is] gated by the `LOOKUP_TABLE_CREATE` permission"
      "9 permissions on three surfaces — table, definition (the column schema), and data (the rows)"
      The page does NOT state a URL path (no mention of `/master-data/lookup-tables`), does NOT describe what users without LOOKUP_TABLE_CREATE/_UPDATE/_DELETE see when they visit the page directly, and does NOT mention auth modes.
- doc_drift_findings:
  - "Doc page does not state the URL path. An operator deep-linking from a bookmark or external system cannot find the canonical URL in the docs — they have to discover `/master-data/lookup-tables` empirically. — severity: LOW (cosmetic)."
  - "Doc page mentions only the `+Add new` button gating (LOOKUP_TABLE_CREATE) but is SILENT on whether the page itself is route-gated. The code mounts the route under `WithPermissionsProvider` listing CREATE/UPDATE/DELETE — but `WithPermissionsProvider` does NOT block rendering (`PermissionProvider.tsx:12-44`). A user with zero permissions still sees the page, the search box, and the table list. Operator reading the docs has no signal about this. — severity: MEDIUM."
  - "Doc page mentions 9 permissions across three surfaces but the route gate (App.tsx:79-83) lists only the 3 table-level permissions; the 6 definition / data permissions are neither route-listed nor doc-cross-linked to per-component gates inside the table-detail view. — severity: LOW (consistent with backend-enforced fine-grained RBAC, but the route-level set looks like a partial enumeration)."

## implicit_adrs

- "Master Data is a top-level URL namespace (`/master-data`) reserved for a future family of master-data-management sub-features; lookup tables is the first and currently only sub-feature." — evidence: masterDataRoutes.ts:1-4 (`BASE_PATH = '/master-data'` with `lookupTablesPath()` returning `${BASE_PATH}/lookup-tables` — the indirection only makes sense if more `/master-data/...` siblings are anticipated) — intent_anchor: "const BASE_PATH = '/master-data';" (the constant is unexported and used exactly once — file structure indicates intent to add siblings later) — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Visiting `/master-data` directly (no nested path) produces no `<Route>` match — react-router renders nothing and there is no fallback / no redirect to `/master-data/lookup-tables`. The toolbar tab uses `lookupTablesPath()` so users following the UI never hit this, but a bookmark / hand-typed URL on `/master-data` lands on a blank content area." — evidence: App.tsx:60-89 (no `<Route path=\"/master-data\" ...>` and no `<Route path=\"*\" ...>` fallback) + masterDataRoutes.ts:1 — severity: LOW
- "Route mount lists CREATE / UPDATE / DELETE permissions to `WithPermissionsProvider` (App.tsx:79-83) but the Provider does NOT block rendering — it only computes `isAllowedTo` and exposes it via React context (`PermissionProvider.tsx:19-25`). The wrapped `<LookupTables />` element is rendered regardless of the calling user's permissions. This is a NAME-vs-BEHAVIOUR drift in the Provider component, but at the route-mount site it produces a real misuse: the maintainer reading `App.tsx:75-88` would reasonably believe the route is gated, when in fact only the inner `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` block around `LookupTableForm` actually blocks anything (`LookupTables.tsx:72-82`)." — evidence: App.tsx:75-88 + PermissionProvider.tsx:12-44 + WithPermissions.tsx:11-32 (blocking gate) vs WithPermissionsProvider.tsx:11-49 (passes context, never returns null) — severity: HIGH
- "The selected-tab logic in ToolbarTabs uses `pathname.includes('master-data')` (`ToolbarTabs.tsx:101`). Both `/master-data` (no match — see above) and `/master-data/lookup-tables` (real route) light up the Master Data tab as selected. A future sub-route with `master-data` substring elsewhere in the path would falsely light it. Defensible today (no collision), brittle as the URL namespace grows." — evidence: ToolbarTabs.tsx:100-104 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "lookupTablesPath()"
      promise: "Returns the URL path to the Lookup Tables list page"
      implementation: "Returns the literal string `${BASE_PATH}/lookup-tables` where BASE_PATH = '/master-data' — i.e. `/master-data/lookup-tables`. No parameters, no formatting, no side effects."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "masterDataRoutes.ts:1-5"
    - name: "BASE_PATH (master-data root)"
      promise: "Reserves `/master-data` as the URL root of the Master Data section; implies a section landing page or a redirect to the first sub-route"
      implementation: "BASE_PATH is declared but never exported and never mounted as a route in App.tsx. Visiting `/master-data` (without `/lookup-tables` suffix) does not match any `<Route>` and renders nothing."
      drift: MINOR
      operator_visible_consequence: "A user typing or bookmarking `/master-data` lands on an empty page (toolbar visible, content blank). The toolbar tab itself links directly to `/master-data/lookup-tables`, so users following the UI never encounter this — only deep-linkers do."
      confidence: STATIC-INFERRED
      evidence: "masterDataRoutes.ts:1 + App.tsx:60-89 (no `/master-data` route declared and no wildcard fallback)"
  orderings: []
  auth_gates:
    - location: "App.tsx:75-88"
      endpoint: "Route path=`/master-data/lookup-tables` element=<WithPermissionsProvider ...>"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The React route itself is auth-mode-agnostic; route mounting is identical under all four auth modes. Reaching the page first traverses Spring's HTTP-layer auth filter (separate concern from this route). Once past HTTP auth, the page renders for ALL four modes — see the next question for the permission-vs-rendering analysis."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:75-88 + WithPermissionsProvider.tsx (no auth-mode branching)"
        - q: "What does an unauthenticated caller see?"
          a: "When auth.type=DISABLED the HTTP layer passes the caller through; React mounts the route; `profile.owner.identity.permissions` is undefined → `getGlobalPermissions` returns `emptyArr`; `isAllowedTo` evaluates to false (every() over the three required permissions); BUT the Provider does NOT use `isAllowedTo` to gate rendering — it only passes it via context (`PermissionProvider.tsx:19-25`). So the `<LookupTables />` element renders. The page chrome (search, table list) appears; only the `+ Add new` button inside the page (gated by `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` at LookupTables.tsx:72-82) is hidden. Under LOGIN_FORM/OAUTH2/LDAP, the HTTP-layer auth filter should redirect to the login URL before React mounts; if that filter is misconfigured or the auth.type is DISABLED, the page is reachable to any caller."
          confidence: STATIC-INFERRED
          evidence: "PermissionProvider.tsx:12-44 + profile.selectors.ts:17-20 + LookupTables.tsx:72-82 + App.tsx:75-88"
        - q: "What does a wrong-role caller see (authenticated but with zero of the three listed permissions)?"
          a: "Identical to the unauthenticated case once past the HTTP-layer auth filter: the page renders, the search input works, the table list renders (subject to per-row backend RBAC at ReferenceDataController), and only the `+ Add new` button is hidden by the inner `<WithPermissions>` gate. The route mount's permission list (LOOKUP_TABLE_CREATE/_UPDATE/_DELETE) is functionally a NO-OP at the route level — it is a configuration that the component (WithPermissionsProvider) does not honour as a block-render decision."
          confidence: STATIC-INFERRED
          evidence: "PermissionProvider.tsx:12-44 (no early return when `isAllowedTo===false`) + WithPermissionsProvider.tsx:18-48 (renders the Provider unconditionally)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The route mount LOOKS like a gate (it names 3 permissions, wraps the component in `WithPermissionsProvider`) but does NOT block rendering. The real gates live at: (1) the in-page `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` wrapper around the Add-new button at `LookupTables.tsx:72-82`; (2) backend RBAC at `SecurityConstants.SECURITY_RULES` for `/api/referencedata/*` (cross-referenced in the ReferenceDataController sidecar). So: nothing at the React route level; the in-page wrapper for the create button; the backend for every API mutation."
          drift: DRIFT_NAME_VS_BEHAVIOR
          confidence: STATIC-INFERRED
          evidence: "App.tsx:75-88 (mount site) + WithPermissionsProvider.tsx:11-49 (passes context, never blocks) + LookupTables.tsx:72-82 (the in-page button gate) + cross-ref: lineage/odd-platform/understanding/odd-platform__java__ReferenceDataController__controller-class__ReferenceDataController.md (backend RBAC)"
  resource_boundaries: []
  request_inputs:
    - location: "masterDataRoutes.ts:2-4"
      input_kind: "local-variable"
      input_name: "BASE_PATH"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The constant name implies `/master-data` is a usable, mounted URL — a section root that should resolve to something."
          confidence: STATIC-INFERRED
          evidence: "masterDataRoutes.ts:1"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Used exactly once, in a template literal at line 3, to build the lookup-tables URL. No other consumer; not exported."
          confidence: STATIC-INFERRED
          evidence: "masterDataRoutes.ts:1-4"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the constant's name (BASE_PATH) suggests a usable root, but visiting `/master-data` doesn't match any `<Route>` and renders nothing. The 'master data' base is an in-code organisational marker that has no corresponding URL surface."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "masterDataRoutes.ts:1 + App.tsx:60-89 (no /master-data route declared)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A user deep-linking to `/master-data` (bookmarked URL, external link, hand-typed) lands on an empty content area — the toolbar renders, no content appears, no 404, no redirect to the sub-route. The Master Data tab in the toolbar lights up as selected (substring match in ToolbarTabs.tsx:101) but the page is empty. Operator-confusing rather than data-loss class."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:60-89 + ToolbarTabs.tsx:100-104"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — BASE_PATH is the only constant and it is used. The smell is the absence of an exported `masterDataPath()` helper or an App.tsx route mount, not the presence of an unused matching field."
          confidence: STATIC-INFERRED
          evidence: "masterDataRoutes.ts:1-5"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (bare /master-data renders nothing)"
  probes_emitted:
    - probe_id: P-163
      question: "Does visiting `/master-data/lookup-tables` with zero of LOOKUP_TABLE_CREATE/_UPDATE/_DELETE render the page (confirming the WithPermissionsProvider is not a route-level gate)?"
      probe_path: "lineage/odd-platform/probes/P-163.yaml"
  stress_summary:
    triggers_total: 3
    questions_total: 11
    answers_static_inferred: 11
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2
```

## security

- auth_mode_relevance: "INTERNAL_ONLY — the React route module itself is not on the HTTP surface; it produces a URL string and is registered with react-router. Auth-mode handling is at Spring's HTTP-layer auth filter, upstream of React. The downstream `<LookupTables />` element and its API calls operate under whatever auth mode is active."
- ingestion_filter_relevance: "N/A — UI route module, not an ingestion path"
- authorization_assertions: []
- owner_scoping: "N/A — the route module is a URL builder, not a data path. Per-row owner scoping lives at the ReferenceData repository / search layer (cross-ref: lineage/odd-platform/understanding/odd-platform__java__ReferenceDataController__controller-class__ReferenceDataController.md)."
- data_exposure:
  - "URL surface only — no data flows through this module"
- known_security_gaps:
  - "The route mount in App.tsx:75-88 lists three permissions to `WithPermissionsProvider` but the Provider does not block rendering. A reviewer auditing route-level RBAC by reading App.tsx alone would conclude the page is gated; it is not. The Provider is a context publisher, not an auth gate. — evidence: App.tsx:75-88 + WithPermissionsProvider.tsx:11-49 + PermissionProvider.tsx:12-44 — severity: HIGH (audit-trail integrity; not necessarily a data-leak because the backend RBAC catches every mutation, but the configured permissions on the route are misleading documentation-shaped artefacts)"
  - "The 9-permission backend model (LOOKUP_TABLE_{,DEFINITION_,DATA_}{CREATE,UPDATE,DELETE}) is partially represented at the route mount (only the 3 table-level permissions). The 6 definition/data permissions appear neither here nor in any per-component gate that an audit can grep for — they are enforced backend-side via SecurityConstants. An auditor reading the route would not discover the full RBAC surface from this file. — evidence: masterDataRoutes.ts + App.tsx:79-83 + PolicyPermissionDto.java:80-88 — severity: MEDIUM"

## performance

- hot_paths: []
- throughput_characteristics:
  - "Synchronous nullary URL builder; called once per render of App.tsx, ToolbarTabs.tsx, and LookupTableForm.tsx onSubmit. No cost concern."
- resource_allocation: []
- scaling_characteristics:
  - "Pure function returning a literal-shaped string; stateless and trivially scalable"
- known_performance_gaps: []

## upstream_callers

- entry_point: "ui_route:/master-data/lookup-tables"
  caller_node: "ts react-component:App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:20 (import) + App.tsx:76 (`path={lookupTablesPath()}` — invoked once at App.tsx render)"
  observation_class: ui-call
- entry_point: "ui_toolbar:Master Data tab"
  caller_node: "ts react-component:ToolbarTabs.tsx"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:18 (import) + ToolbarTabs.tsx:57 (`link: lookupTablesPath()` — invoked once per tabs memo)"
  observation_class: ui-call
- entry_point: "ui_form:LookupTableForm onSubmit"
  caller_node: "ts react-component:LookupTableForm.tsx"
  multiplicity_per_trigger: 1
  evidence: "LookupTableForm.tsx:9 (import) + LookupTableForm.tsx:69 (`navigate(lookupTablesPath())` — once per successful create/edit)"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: "page-render"
  description: "Resolution of `lookupTablesPath()` to `/master-data/lookup-tables` triggers React Router to mount the `<LookupTables />` element under `<WithPermissionsProvider>` at App.tsx:75-88. The user observes the Lookup Tables list page (page chrome + search + table list)."
  evidence: "App.tsx:75-88"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_toolbar:Master Data tab"
    - "ui_form:LookupTableForm onSubmit (post-create / post-edit redirect)"
    - "external:deep-link / bookmark"
- side_effect_class: "redirect-issue"
  description: "After successful create or edit, LookupTableForm calls `navigate(lookupTablesPath())` — the user is redirected to the list page (URL change observable in browser history)."
  evidence: "LookupTableForm.tsx:67-70"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_form:LookupTableForm onSubmit"

## sources

- understanding ← masterDataRoutes.ts:1-5 + App.tsx:20,75-88 + ToolbarTabs.tsx:18,57 + LookupTableForm.tsx:9,69
- concepts.entities.LookupTable ← masterDataRoutes.ts:2-4 (the only sub-route exposed)
- concepts.invariants.[0] ← masterDataRoutes.ts:1 + App.tsx:60-89 (no other /master-data routes mounted)
- concepts.invariants.[2] ← masterDataRoutes.ts:2 (nullary signature; no parameters declared)
- dependencies_semantic.requires-feature.[0] ← lineage/odd-platform/understanding/odd-platform__java__ReferenceDataController__controller-class__ReferenceDataController.md (cross-ref)
- dependencies_semantic.requires-runtime.[1] ← App.tsx:75-88 + profile.selectors.ts:17-20 + PermissionProvider.tsx:12-44
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables (2026-05-26, status 200)
- docs_link_semantic.doc_drift_findings.[1] ← App.tsx:75-88 + PermissionProvider.tsx:12-44 + WithPermissionsProvider.tsx:11-49
- implicit_adrs.[0] ← masterDataRoutes.ts:1-4 + adjacent route files (e.g. dataQualityRoutes.ts uses no BASE_PATH for a single-feature surface)
- bugs_limitations_corner_cases.[0] ← App.tsx:60-89 + masterDataRoutes.ts:1
- bugs_limitations_corner_cases.[1] ← App.tsx:75-88 + PermissionProvider.tsx:12-44 + WithPermissions.tsx:11-32 + WithPermissionsProvider.tsx:11-49 + LookupTables.tsx:72-82
- bugs_limitations_corner_cases.[2] ← ToolbarTabs.tsx:100-104 + masterDataRoutes.ts:1
- stress_findings.name_behavior_pairs.[1] ← masterDataRoutes.ts:1 + App.tsx:60-89
- stress_findings.auth_gates.[0] ← App.tsx:75-88 + PermissionProvider.tsx:12-44 + WithPermissionsProvider.tsx:11-49 + LookupTables.tsx:72-82
- stress_findings.request_inputs.[0] ← masterDataRoutes.ts:1 + App.tsx:60-89 + ToolbarTabs.tsx:100-104
- security.known_security_gaps.[0] ← App.tsx:75-88 + PermissionProvider.tsx:12-44 + WithPermissionsProvider.tsx:11-49
- security.known_security_gaps.[1] ← App.tsx:79-83 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/policy/PolicyPermissionDto.java:80-88
- upstream_callers.[0] ← App.tsx:20,76
- upstream_callers.[1] ← ToolbarTabs.tsx:18,57
- upstream_callers.[2] ← LookupTableForm.tsx:9,69
- downstream_side_effects.[0] ← App.tsx:75-88
- downstream_side_effects.[1] ← LookupTableForm.tsx:67-70

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: MEDIUM
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: MEDIUM

## Maintainer notes

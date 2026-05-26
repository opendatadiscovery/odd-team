---
node_id: "odd-platform ts react-component component:DataModelling"
node_kind: react-component
axis: ui_components
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZL-DataModelling-component
feature_hint: "P-02 Data Modelling — the COMPONENT-LAYER ROOT of the `/data-modelling/*` UI subtree. 17-line file: a thin two-column layout shell (Sidebar with `<DataModellingTabs/>` + Content with `<DataModellingRoutes/>`) lazy-loaded by `components/App.tsx:40` and mounted at `App.tsx:74`. Composes two siblings — DataModellingTabs (the vertical nav: Query Examples / Relationships, 2 entries, NO ERD tab at this layer) + DataModellingRoutes (the nested Routes element with the bare-base redirect + permission-wrapper-but-not-gate pattern). Pairs with the ZH dataModelling route sidecar (URL-shape contract), ZE RelationshipController (zero authz backend), batch V QueryExampleController (3-of-13 endpoints gated), and ZI queryExamples + relationships route sidecars (Target column copy-paste mention)."
related_features:
  - F-025  # Query Examples (CRUD + Faceted Search) — P-02:F-001 pillar-anchored; this component is the Tab-2 + Route-2 composition surface that lands the user on QueryExamples.tsx by default via DataModellingRoutes.tsx:16 redirect
  - F-037  # ERD/Graph Relationships Listing — P-02 first feature; this component composes Relationships.tsx via DataModellingTabs.tsx:17-22 + DataModellingRoutes.tsx:40 (UNGATED bare route)
related_pillar_features:
  - "P-02"  # Data Modelling pillar
related_adrs: []
related_concepts: []
related_sidecars:
  - odd-platform__ts__routes__route__dataModelling  # ZH — the URL-shape contract sibling; this component is the COMPONENT-LAYER root that mounts the same URL tree
  - odd-platform__java__QueryExampleController__controller-class__QueryExampleController  # batch V — the API behind QueryExamples.tsx (the default tab)
  - odd-platform__java__RelationshipController__controller-class__RelationshipController  # ZE — the API behind Relationships.tsx (the second tab; zero authz backend)
related_retrospectives:
  - LSN-020  # parameter-name vs implementation alignment — the `WithPermissionsProvider` Category B drift parallels LSN-020's class of "name promises one thing, implementation does another"
  - LSN-023  # feature ontology built without the UI — explicitly cross-checked: this sidecar traces the user-visible composition (sidebar + content) from the App.tsx mount through to QueryExamples / Relationships rendering, satisfying Rule 0
---

# DataModelling — semantic understanding

## understanding

`DataModelling` is a 17-line presentational layout component — a two-column shell (Sidebar with `<DataModellingTabs/>` + Content with `<DataModellingRoutes/>` wrapped in styled-components `S.LayoutContainer / S.Sidebar / S.Content` from `components/shared/styled-components/layout.ts:3-31`). It owns NO data fetch, NO state, NO permission gate, NO useEffect, NO hook calls; it composes two children and renders them. Mounted exactly once at `components/App.tsx:74` (`<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />`, where `DataModeling` — note the misspelling, single 'l' — is the local alias at App.tsx:40 for the lazy import of the default export from this file). The semantic richness comes from the two children it composes: `DataModellingTabs` renders a TWO-tab vertical menu (Query Examples + Relationships, NO ERD tab at this layer — ERD is a SUB-tab of Relationships per `components/DataModelling/Relationships/RelationshipsTabs.tsx:14-15`); `DataModellingRoutes` declares three inner routes — `''` redirects to `query-examples` (`DataModellingRoutes.tsx:16`), `query-examples` and `query-examples/:queryExampleId` are wrapped in `<WithPermissionsProvider>` (which only SEEDS a permission context, does NOT block rendering — see stress_findings Category B), and `relationships` is wrapped in NOTHING (no permission gate at all). Per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling` (WebFetched 2026-05-26, status 200) this is the "Data Modelling" pillar root that operators reach via the AppToolbar "Data Modelling" tab — the toolbar entry actually deep-links to `queryExamplesPath()` (`components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54`, `link: queryExamplesPath()`), so the redirect at `DataModellingRoutes.tsx:16` is exercised only by direct-URL navigation or deep-links.

## concepts

- entities: [
    "`DataModelling` — the lazy-loaded layout component (default export, line 17); the visual root of the `/data-modelling/*` URL subtree. Alias `DataModeling` (single 'l') at `App.tsx:40` is the local import name — a typo-vs-pillar-naming asymmetry recorded as a corner-case below",
    "`<S.LayoutContainer>` — flex container from layout.ts:3-11 (display:flex, padding:2, gap:2, overflow:auto, height: calc(100lvh - 3rem) — the 3rem subtracts the AppToolbar height per `lib/constants.toolbarHeight`); the two-column shell shape",
    "`<S.Sidebar $alignSelf='flex-start' $position='sticky'>` — fixed-width vertical column (max-width:15rem; layout.ts:13-25) holding `<DataModellingTabs/>`. The `$position='sticky'` makes the sidebar follow scroll within the content viewport (which is set to the lvh-minus-toolbar height by LayoutContainer)",
    "`<S.Content>` — flex-grow:1 main element (layout.ts:27-31) holding `<DataModellingRoutes/>`, the inner Routes node",
    "**Composed children** (declared in this file as JSX, defined in sibling files): `<DataModellingTabs/>` at line 9 (defined `DataModellingTabs.tsx:1-32`, renders the 2-tab vertical AppTabs menu); `<DataModellingRoutes/>` at line 12 (defined `DataModellingRoutes.tsx:1-45`, declares the inner `<Routes>` with three Routes: redirect / query-examples (+ :id) / relationships)"
  ]
- operations: [
    "render a two-column page shell — sidebar (sticky, max-width 15rem, holds the vertical-tabs menu) + content (flex-grow:1, holds the inner Routes). One presentational behaviour, no business logic",
    "**delegate URL routing to `<DataModellingRoutes/>`** — the component does NOT declare any `<Route>` itself; the inner `<Routes>` lives in the child file, and the outer mount at `App.tsx:74` uses a trailing `/*` to let the child catch all sub-paths",
    "**delegate tab selection to `<DataModellingTabs/>`** — the tab-selection state is driven by `useSetSelectedTab` in `DataModellingTabs.tsx:25`, which reads `useLocation().pathname` and matches against the `link` field of each tab via `pathname.includes(link)`. This component owns no tab state"
  ]
- invariants: [
    "**The component is purely presentational** — no `useState`, no `useEffect`, no `useDispatch`, no API call; the React.FC body is a single JSX expression returning the layout. Verified by reading lines 1-17 end-to-end (no hook imports beyond React's default; only `layout` styled-components, `DataModellingRoutes`, `DataModellingTabs`)",
    "**The composition is fixed** — there is exactly ONE Sidebar + ONE Content; the order is Sidebar-then-Content (Sidebar to the left, Content to the right per LTR flex). No conditional rendering, no permission-based composition, no feature-flag branch. Operator sees the same shell regardless of role, auth mode, or active features",
    "**The component is lazy-loaded** — `App.tsx:40` declares `const DataModeling = lazy(() => import('./DataModelling/DataModelling'))`; the bundle for this component (plus DataModellingTabs + DataModellingRoutes + the three lazy-loaded route children QueryExamples/QueryExampleDetailsContainer/Relationships) is split out and only fetched when the user navigates into `/data-modelling/*`",
    "**Two-tab pillar at the COMPONENT layer** — `DataModellingTabs` (the sidecar's child) declares exactly 2 tabs at this level (Query Examples + Relationships); ERD is NOT a peer tab here — it's a SUB-tab inside Relationships (`components/DataModelling/Relationships/RelationshipsTabs.tsx:14-15` declares ALL/ERD/Graph as `type` query-param values within the Relationships list page)",
    "**No permission discrimination at composition layer** — the component renders the Sidebar with BOTH tab entries (Query Examples + Relationships) unconditionally for any authenticated user reaching the route. The 'Relationships' tab is shown even to users without any QUERY_EXAMPLE_* permission (and vice versa for Query Examples). Per-action gating happens inside the child route trees (QueryExamples.tsx:36-46 for the Add button; QueryExampleDetailsContainerActions.tsx for edit/delete)"
  ]
- audiences: [
    "**Every authenticated user** reaching `/data-modelling/*` — the route mount at `App.tsx:74` is NOT wrapped in `<WithPermissionsProvider>` (unlike LookupTables at App.tsx:75-87), so this component renders for every authenticated session. Under `auth.type=DISABLED` it also renders for unauthenticated sessions (the SPA bundle is reachable without auth in DISABLED mode per the dataModelling route sidecar security.auth_mode_relevance)",
    "**Permission relevance is INSIDE the child components**: the per-action gates live at `QueryExamples.tsx:36-46` (Add button gated by `<WithPermissions permissionTo={Permission.QUERY_EXAMPLE_CREATE}>`) and at `QueryExampleDetailsContainerActions.tsx` (Edit/Delete gates). The Relationships subtree has NO per-action gates because RelationshipController has no @PreAuthorize on any endpoint (per the ZE RelationshipController sidecar)",
    "Per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling` (WebFetched 2026-05-26, status 200), the surface is described as a 'curated space for documenting how datasets are intended to be used' with two sub-features: Query Examples (SQL/KQL/Spark snippets attached to entities/terms) and Relationships (ERD diagrams over ENTITY_RELATIONSHIP + GRAPH_RELATIONSHIP edges). This component is the operator's visual landing point for that surface"
  ]

## dependencies_semantic

- requires-feature: [
    "DataModellingTabs (`components/DataModelling/DataModellingTabs.tsx`) — direct child; provides the 2-tab vertical nav. If DataModellingTabs throws, the Sidebar slot is empty and the user has no way to switch between Query Examples and Relationships",
    "DataModellingRoutes (`components/DataModelling/DataModellingRoutes.tsx`) — direct child; declares the inner `<Routes>` with the 3 inner Route declarations. If DataModellingRoutes throws, the Content slot is empty and the URL routing inside `/data-modelling/*` is broken",
    "QueryExamples feature (`components/DataModelling/QueryExamples.tsx`, `QueryExampleController.java` backend per the batch V QueryExampleController sidecar) — the default landing destination via the `<Navigate to='query-examples' />` redirect at `DataModellingRoutes.tsx:16`",
    "Relationships feature (`components/DataModelling/Relationships.tsx`, `RelationshipController.java` backend per the ZE RelationshipController sidecar) — the second-tab destination via `relationships` Route at `DataModellingRoutes.tsx:40`",
    "Styled layout components (`components/shared/styled-components/layout.ts` — `LayoutContainer`, `Sidebar`, `Content`) — shared across pillars; same shell used by `components/Alerts/Alerts.tsx`, `components/Activity/Activity.tsx`, `components/Management/Management.tsx`, etc. (the platform-wide page-with-vertical-sidebar pattern)"
  ]
- requires-config: []
- requires-runtime: [
    "React (imported on line 1) — the component is a React.FC functional component (line 6)",
    "styled-components (transitively via the `S.*` named imports from `components/shared/styled-components/layout.ts:1-31`) — needed for the LayoutContainer/Sidebar/Content render at runtime",
    "react-router-dom (transitively via DataModellingRoutes — the inner `<Routes>` + `<Route>` + `<Navigate>` JSX nodes require react-router-dom to interpret)"
  ]
- additional_coupling:
  - "**App.tsx coupling is load-bearing**: the component is lazy-imported at `App.tsx:40` as `DataModeling` (single-l alias) and mounted at `App.tsx:74` (`<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />`). The trailing `/*` is essential — without it, the inner `<Routes>` in DataModellingRoutes would not catch sub-paths. Refactoring the alias or removing the trailing wildcard breaks the entire `/data-modelling/*` URL subtree"
  - "**Sidebar `$position='sticky'` couples to scroll behaviour** — the sticky positioning at line 8 only works because `LayoutContainer` (layout.ts:3-11) sets `overflow: auto` + `height: calc(100lvh - 3rem)` (creates the scrolling viewport). If LayoutContainer is later refactored to drop `overflow: auto`, the sidebar's sticky-positioning no longer engages and the Sidebar scrolls with the page"
  - "**Composition is fragile to child renames** — line 3 imports `./DataModellingRoutes`, line 4 imports `./DataModellingTabs`; both are relative paths without extension. A rename of either child file requires a parallel edit here. No type-system enforcement"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Component renders both child slots: Sidebar contains `<DataModellingTabs/>`, Content contains `<DataModellingRoutes/>`"
    test_class: unit
    criticality: LOW
    note: "Pure presentational — a React Testing Library `render` + `screen.getByRole('complementary')` (the `<aside>`) + `screen.getByRole('main')` (the `<main>`) would assert structural shape. Regression risk: a maintainer swaps the JSX order (Content before Sidebar) and the LTR visual changes silently."
  - behaviour: "Under `/data-modelling` (bare URL), the redirect to `/data-modelling/query-examples` works and the Sidebar's 'Query Examples' tab is highlighted as selected"
    test_class: integration
    criticality: LOW
    note: "End-to-end through MemoryRouter + initial-entry `/data-modelling`; assert browser URL becomes `/data-modelling/query-examples`. The redirect lives at `DataModellingRoutes.tsx:16`, not at this component, but a test at this surface verifies the composition behaves correctly."
  - behaviour: "Under `/data-modelling/relationships`, the Sidebar's 'Relationships' tab is highlighted as selected (verifies the `useSetSelectedTab` match-by-pathname-includes-link logic at `useSetSelectedTab.ts:12`)"
    test_class: integration
    criticality: LOW
    note: "Verifies tab selection state matches URL. Regression risk: changing `relationshipsPath()` from `/data-modelling/relationships` to `/data-modelling/relations` desynchronises the tab selection (the `link` field on the tab no longer matches the pathname)."
  - behaviour: "Component is lazy-loaded — does not contribute to the initial bundle"
    test_class: performance
    criticality: LOW
    note: "Webpack bundle analysis (`vite build` output) confirms a separate chunk for `DataModelling.tsx` + its imports; would catch an accidental eager import (e.g. someone changing `App.tsx:40` from `lazy(...)` to a direct `import`)."
  - behaviour: "Under `auth.type=DISABLED`, an unauthenticated session lands on `/data-modelling` and successfully sees the layout shell (no auth challenge)"
    test_class: security
    criticality: LOW
    note: "Verifies the DISABLED-mode reach of the Data Modelling pillar at the UI layer — parallels the F-037 DISABLED-mode reach finding (Relationships endpoint is reachable unauthenticated under DISABLED per the RelationshipController sidecar). Local-only via auth.type=DISABLED profile in the test stack."
- test_files: []
- gaps: |
    No unit, integration, performance, or security test targets this component
    or any sibling under `components/DataModelling/` (Grep across
    `odd-platform-ui/src/` for `*.test.*` / `*.spec.*` files matching
    `DataModelling` / `QueryExamples` / `Relationships` returned zero
    results at commit 4ec2b20). Directory-wide zero-coverage gap, mirrored
    by the dataModelling route sidecar's `tests_coverage_semantic.gaps`.
    The most-likely class of regression that the current zero-test posture
    misses is a refactor at the inner child layer (e.g. someone changing
    DataModellingRoutes.tsx's redirect path from `query-examples` to
    `query_examples` while keeping the toolbar tab linked to
    `queryExamplesPath()` = `/data-modelling/query-examples`) — the
    refactor would silently break the in-page tab selection AND the
    toolbar deep-link without raising any compile-time signal. A single
    integration test rendering this component under a MemoryRouter at
    `/data-modelling` and asserting the resulting pathname + Sidebar tab
    selection would catch the entire failure mode.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling"
    anchor: ""
    rationale: "The Data Modelling pillar page is the canonical operator-facing doc for what this component surfaces. Verified live (WebFetched 2026-05-26, status 200). The page describes the surface as a 'curated space for documenting how datasets are intended to be used' with two sub-features (Query Examples + Relationships), matching this component's child composition. The page also confirms the RBAC posture (`QUERY_EXAMPLE_CREATE` for creation, `QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE` for details/edit) which corresponds to the inner `WithPermissionsProvider` declarations at `DataModellingRoutes.tsx:21-22, 32-34`."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      The Data Modelling section serves as a "curated space for documenting
      how datasets are intended to be used." It focuses on two key areas:
      canonical query examples and entity-to-entity relationships,
      essentially capturing "the contract of a dataset (how it's queried,
      how it's connected)."

      Sub-sections and Tabs:
      1. Query Examples — operator-created SQL/KQL/Spark code snippets
         attached to entities and terms, enabling teams to document usage
         patterns as first-class catalog objects.
      2. Relationships — entity-to-entity links shown as ERD diagrams,
         covering two relationship types: ENTITY_RELATIONSHIP (foreign-key-
         style edges) and GRAPH_RELATIONSHIP (free-form graph edges).

      Permissions: Access control is RBAC-gated. Query Examples creation
      requires QUERY_EXAMPLE_CREATE permission, while updates and deletions
      require QUERY_EXAMPLE_UPDATE and QUERY_EXAMPLE_DELETE permissions
      respectively.

      Navigation Behavior: The default route /data-modelling "redirects to
      /data-modelling/query-examples". A vertical-tabs sidebar enables
      switching between the two sub-sections. Four specific UI entry
      points are documented, including the list views and detail pages
      for both features.
- doc_drift_findings:
  - "**The doc says 'A vertical-tabs sidebar enables switching between the two sub-sections'** — this matches exactly what this component renders (sidebar at line 8-10 with `<DataModellingTabs/>` which declares 2 tabs at DataModellingTabs.tsx:13-22). No drift on the COMPOSITION shape."
  - "**The doc says 'RBAC-gated by QUERY_EXAMPLE_CREATE'** for the Query Examples list page — but the actual gating chain is: this component renders unconditionally → `<DataModellingRoutes/>` declares `WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}` at `DataModellingRoutes.tsx:19-25` → the wrapper UNCONDITIONALLY renders its child (the wrapper is a CONTEXT-SEED, not a gate; see stress_findings Category B and the dataModelling route sidecar `bugs_limitations_corner_cases.[WithPermissionsProvider does not block]`). A user without `QUERY_EXAMPLE_CREATE` who navigates to `/data-modelling/query-examples` STILL SEES the list page (the Sidebar with both tabs, the QueryExamples.tsx page, the count, the search input); they only LOSE the 'Add query example' button (gated by the separate `<WithPermissions>` component at `QueryExamples.tsx:36-46`). The doc's 'RBAC-gated by QUERY_EXAMPLE_CREATE' overstates the restriction. Surface as a doc-clarity finding to doc-gap-finder."
  - "**The doc says Relationships are 'shown as ERD diagrams, covering two relationship types: ENTITY_RELATIONSHIP and GRAPH_RELATIONSHIP'** — at THIS component layer, ERD is NOT a peer tab of Query Examples + Relationships. The sidebar declares exactly two tabs (`DataModellingTabs.tsx:13-22`: Query Examples + Relationships); ERD lives as a SUB-tab WITHIN Relationships at `components/DataModelling/Relationships/RelationshipsTabs.tsx:7-23` (ALL / ERD / Graph as `type` query-param values). The doc's framing is consistent with the code (Relationships is the surface that includes ERD diagrams as one of its three sub-views), but a reader who expects three peer tabs at this layer would be surprised. NOT a drift, but a clarity opportunity for the doc."

## implicit_adrs

- "**The Data Modelling pillar root uses the platform-wide 'layout shell with sticky sidebar' pattern** — `<S.LayoutContainer>` + `<S.Sidebar $alignSelf='flex-start' $position='sticky'>` + `<S.Content>` is the same shell used by `components/Alerts/Alerts.tsx`, `components/Activity/Activity.tsx`, `components/Management/Management.tsx`, `components/MasterData/LookupTables.tsx`. The decision: pillars with multi-tab vertical navigation use the same `layout.ts` styled-component primitives, sharing the 15rem sidebar max-width and the lvh-minus-3rem-toolbar-height viewport behaviour. The component-side cost is one import statement + four lines of JSX." — evidence: components/DataModelling/DataModelling.tsx:7-14 + components/shared/styled-components/layout.ts:3-31 (consumed by multiple pillar roots; same `LayoutContainer / Sidebar / Content` triple appears at sibling files) — intent_anchor: "(no explicit comment; the convention is observable across all the pillar-root components in `components/*/`)" — confidence: HIGH
- "**The pillar root component owns NO routing and NO tab state — it DELEGATES** to two sibling components (DataModellingTabs for the menu, DataModellingRoutes for the inner Routes). This separation is also used by the Alerts pillar (`components/Alerts/Alerts.tsx` composes `AlertsRoutes.tsx` + an alerts-specific tab nav). The decision: pillar roots are layout-only; tab selection and URL routing are factored into sibling components so each concern can be tested and reasoned about in isolation. The composition file becomes trivial enough to read in one screen." — evidence: components/DataModelling/DataModelling.tsx:6-15 (no hooks, no state, no Route children — only Sidebar+Content composition) — intent_anchor: "(no explicit comment; the convention is observable from the file's structure)" — confidence: HIGH
- "**The component is lazy-loaded** at `App.tsx:40` (`const DataModeling = lazy(() => import('./DataModelling/DataModelling'))`) rather than eagerly imported. Same pattern is applied to every pillar root (Management, DataEntityDetails, TermDetails, Overview, Search, Alerts, Activity, DirectoryRoutes, DataQuality, LookupTables — all lazy at App.tsx:30-41). The decision: pillar-root code is code-split at the route-mount boundary; the initial bundle contains only the App shell + Overview (the default route at App.tsx:60). Operators navigating to /data-modelling/* take a small JS network round-trip on first visit; cached afterwards." — evidence: components/App.tsx:40 + AppSuspenseWrapper at App.tsx:58 (wraps the inner `<Routes>`, providing the React.Suspense boundary for the lazy children) — intent_anchor: "(no explicit comment; the lazy() + Suspense pattern is the convention)" — confidence: HIGH
- "**The local import alias `DataModeling` (single 'l') at `App.tsx:40` differs from the pillar's canonical spelling 'Data Modelling' (double-l, used everywhere else)** — this is observably a typo, not a deliberate naming decision (the file is `DataModelling.tsx` with double-l; the default export is `DataModelling`; the AppToolbar tab label is `t('Data Modelling')`; the route module is `routes/dataModelling/dataModelling.ts`; the BASE_PATH is `/data-modelling`). The decision (implicit): the alias is local to App.tsx and does not leak to the user-facing surface; the typo persists because no test or lint rule catches the file-name-vs-alias asymmetry. Cosmetic, not a bug." — evidence: components/App.tsx:40 (`const DataModeling = ...`) vs components/DataModelling/DataModelling.tsx:6 + 17 (`const DataModelling: React.FC = ...; export default DataModelling`) + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:51 (`t('Data Modelling')`) — intent_anchor: "(no comment; observable as an oversight)" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Inconsistent permission gating across the three inner routes (inherited from `<DataModellingRoutes/>`)**: `query-examples` and `query-examples/:queryExampleId` are wrapped in `<WithPermissionsProvider>` (`DataModellingRoutes.tsx:19-25, 31-37`); `relationships` is wrapped in NOTHING (`DataModellingRoutes.tsx:40`, bare `element={<Relationships/>}`). At the COMPONENT layer (this file), the rendering composition is identical — but the operator-visible consequence cascades: Relationships subtree has NO PermissionContext, so any child reading `usePermissions()` from inside Relationships.tsx reads from the default `PermissionContext` (empty globalPermissions). Combined with the ZE RelationshipController having ZERO @PreAuthorize on any endpoint, the `/data-modelling/relationships` surface is ungated end-to-end. This isn't a bug of DataModelling.tsx per se, but a maintainer reading THIS file's composition (Sidebar with 2 tabs + Content with 3 inner Routes) needs to know that the two tabs have radically different authorization shapes downstream." — evidence: components/DataModelling/DataModellingRoutes.tsx:17-41 + RelationshipController sidecar `bugs_limitations_corner_cases` — severity: LOW
- "**`<WithPermissionsProvider>` at the inner-route layer does NOT block rendering — it only seeds a React Context** (see stress_findings Category B and the dataModelling route sidecar `bugs_limitations_corner_cases.[WithPermissionsProvider does not block]`). The naming-vs-behaviour drift is the LSN-020 class — the wrapper's name promises 'permission gate' but the implementation is 'context seed only'. A maintainer reading this DataModelling component composition cannot see the drift without reading three additional files (`WithPermissionsProvider.tsx` + `PermissionProvider.tsx` + `WithPermissions.tsx`). The drift surface is the entire Data Modelling pillar: routes are open to read; only action buttons are gated. Cross-referenced via P-165 probe." — evidence: components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + components/shared/contexts/Permission/WithPermissions.tsx:11-32 + components/DataModelling/DataModellingRoutes.tsx:19-37 + components/DataModelling/QueryExamples.tsx:36-46 — severity: MEDIUM
- "**No unit / integration / performance / security tests** target this component or any sibling under `components/DataModelling/`. Directory-wide zero-coverage gap. Same finding shape as the dataModelling route sidecar; same finding shape as the Alerts pillar (per the Alerts.tsx sidecar if any). A regression that swaps the JSX order (Content before Sidebar) silently flips the LTR visual; a regression that drops the trailing `/*` from `App.tsx:74` breaks the inner Routes; neither has a test catching it." — evidence: Grep across `odd-platform-ui/src/` for `*.test.*` / `*.spec.*` files containing `DataModelling` returned zero matches at commit 4ec2b20 — severity: LOW
- "**Local import alias `DataModeling` (single 'l') at `App.tsx:40` vs the file/component/pillar's canonical 'DataModelling' (double-l)** — observable typo (recorded in implicit_adrs above). The alias is internal to App.tsx and not user-visible, but a future search for 'DataModelling' in `components/App.tsx` returns zero matches at the import line (the import uses single-l), which surprises maintainers grep-ing the file. Cosmetic." — evidence: components/App.tsx:40 (`const DataModeling = lazy(...)`) vs every other Data-Modelling-related symbol in the codebase — severity: LOW
- "**The component renders the Sidebar with `$position='sticky'`**, which only works because LayoutContainer sets `overflow: auto` + `height: calc(100lvh - 3rem)` — if LayoutContainer's `overflow` is changed to `visible` or its `height` is removed, the sticky positioning silently degrades to relative. No comment in either file explains the coupling. A maintainer refactoring layout.ts's LayoutContainer to fix an unrelated overflow bug could break sticky-sidebar across every pillar simultaneously (Alerts, Activity, Management, etc. all use the same shell)." — evidence: components/DataModelling/DataModelling.tsx:8 (`$position='sticky'`) + components/shared/styled-components/layout.ts:3-11 (`overflow: auto; height: calc(100lvh - 3rem)`) — severity: LOW
- "**Sidebar `max-width: 15rem`** (layout.ts:22) is HARDCODED — there is no theme variable, no responsive breakpoint, no override prop. At narrow viewports (< ~600px) the Sidebar still takes 15rem (~240px) leaving the Content area cramped; at wide viewports (> 1920px) the Sidebar is the same 240px regardless of total width. The Data Modelling tabs `Query Examples` and `Relationships` are both labels of ≤ 14 chars so they fit, but a future tab with a longer label (e.g. `Entity Relationship Diagrams`) would either wrap or truncate without warning. Same constraint affects every pillar using this shell." — evidence: components/shared/styled-components/layout.ts:13-25 (no responsive logic) + components/DataModelling/DataModellingTabs.tsx:14, 18 (current label lengths) — severity: LOW
- "**The tab-selection logic in `useSetSelectedTab.ts:9-15` uses `pathname.includes(link) || link.includes(pathname)` (bidirectional substring match)** — this is fragile under route renames. If `relationshipsPath()` is later renamed (e.g. to `/data-modelling/relations`), `pathname.includes('/data-modelling/relations')` could match a PARENT path like `/data-modelling/relations-deep-link` AND match the parent base-path `/data-modelling/relationships-old-cached-url`. The substring fallback `link.includes(pathname)` means a partial pathname (e.g. `/data-modelling`) matches BOTH `link='/data-modelling/query-examples'` AND `link='/data-modelling/relationships'`, returning the first matching index (0 = Query Examples). At the bare-URL state pre-redirect this might briefly select the wrong tab; the redirect at DataModellingRoutes.tsx:16 resolves it within one render cycle, but it's a smell." — evidence: components/shared/elements/AppTabs/useSetSelectedTab.ts:9-15 + components/DataModelling/DataModellingTabs.tsx:25 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components/shared/styled-components/layout.ts:22"
      name: "max-width"
      value: "15rem"
      questions:
        - q: "What at viewport width 320px (mobile)? At 1024px (desktop)? At 3840px (4K)?"
          a: "Sidebar is fixed at 15rem (~240px) regardless of viewport. At 320px viewport, Sidebar takes 240px + LayoutContainer padding (16px×2=32px) + gap (16px) = 288px, leaving ~32px for Content; at this width the Content area is unusable. At 1024px+, Sidebar at 240px is comfortable. At 4K (3840px) the Sidebar is still 240px — proportionally tiny but Content fills the rest. There is no responsive breakpoint, no CSS media query at layout.ts:13-25, no theme-driven override."
          confidence: STATIC-INFERRED
          evidence: "components/shared/styled-components/layout.ts:13-25 (no @media queries, no responsive props beyond `$position` and `$alignSelf`)"
        - q: "What at a Sidebar tab label longer than ~18 chars?"
          a: "The AppTabs label component (`AppTabLabel.tsx` not read directly) renders the text inside an MUI Tab — at 15rem Sidebar width, labels longer than ~18 chars wrap or are truncated by MUI's default Tab styling. Current labels (`Query Examples` = 14 chars, `Relationships` = 13 chars) fit. A future tab label like `Entity Relationship Diagrams` (28 chars) would overflow."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingTabs.tsx:14,18 + components/shared/styled-components/layout.ts:22"
        - q: "What does the operator see at each boundary?"
          a: "At extreme narrow viewport: a 240px Sidebar + a near-zero Content area; UX is broken but not corrupt — the SPA still renders, just unusable. At extreme wide viewport: a 240px Sidebar floating to the left, Content fills the rest; UX is fine. At long-label: text truncation, depending on MUI default Tab handling — possibly silent ellipsis."
          confidence: STATIC-INFERRED
          evidence: "components/shared/styled-components/layout.ts:13-25 + MUI Tab default behaviour"
    - location: "components/shared/styled-components/layout.ts:9"
      name: "height"
      value: "calc(100lvh - 3rem)"
      questions:
        - q: "What at 100lvh = 0 (no viewport)?"
          a: "Not reachable at runtime — browsers always have a viewport. The 3rem subtraction corresponds to the AppToolbar height per `lib/constants.toolbarHeight` (verified via the dataModelling route sidecar evidence chain). If the toolbar height is later changed and `lib/constants.toolbarHeight` is updated but layout.ts's 3rem is not, the LayoutContainer height drifts (becomes too tall or too short) and the sticky-sidebar behaviour degrades."
          confidence: STATIC-INFERRED
          evidence: "components/shared/styled-components/layout.ts:9 + lib/constants.ts (cross-referenced)"
        - q: "What at toolbar height changes (e.g. compact-mode toolbar)?"
          a: "The 3rem literal in layout.ts:9 is a HARDCODED CONSTANT — it does not consume the `toolbarHeight` from lib/constants; a refactor of toolbarHeight requires a parallel edit to layout.ts. Silent coupling."
          confidence: STATIC-INFERRED
          evidence: "components/shared/styled-components/layout.ts:9 (`100lvh - 3rem` literal) + grep for `toolbarHeight` in layout.ts returned no matches"
        - q: "What does the operator see at each boundary?"
          a: "If 3rem ≠ actual toolbar height: a thin gap below the toolbar (3rem > toolbar) OR a scroll-bar appearing at the bottom (3rem < toolbar). Subtle but visible to a careful reader."
          confidence: STATIC-INFERRED
          evidence: "components/shared/styled-components/layout.ts:9 + components/App.tsx:57 (`paddingTop: ${toolbarHeight}px` — separate calculation)"
  name_behavior_pairs:
    - name: "DataModelling (component name + pillar name)"
      promise: "The user clicking the global toolbar 'Data Modelling' tab lands on the pillar's homepage — a unified overview of what Data Modelling offers (Query Examples + Relationships + how to use them)."
      implementation: "The toolbar's `Data Modelling` tab actually deep-links to `queryExamplesPath()` (ToolbarTabs.tsx:50-54), i.e. directly to Query Examples — bypassing the bare `/data-modelling` URL. The bare URL `/data-modelling` (only reachable by typing it or via a deep-link), when visited, redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` at `DataModellingRoutes.tsx:16`. There is NO pillar-overview screen at any URL in this subtree; landing on Query Examples is the design. This is consistent with the live doc (`https://docs.opendatadiscovery.org/features/data-modelling`, WebFetched 2026-05-26, status 200) which describes the default route as 'redirecting to /data-modelling/query-examples'."
      drift: MINOR
      operator_visible_consequence: "Operator clicking 'Data Modelling' in the toolbar is taken straight to a Query Examples list, NOT to a pillar overview. A first-time operator who wants to learn what Data Modelling is may be confused — they expected an overview screen describing the pillar; they got a list of SQL snippets. The deliberate UX shape is 'Query Examples is the canonical first action of the pillar'; the cost is that the Relationships sub-feature is less discoverable (visible only via the in-page secondary tab in the Sidebar)."
      confidence: STATIC-INFERRED
      evidence: "components/DataModelling/DataModelling.tsx:6-15 + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + components/DataModelling/DataModellingRoutes.tsx:16 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)"
    - name: "<DataModellingTabs/> at line 9"
      promise: "Render the vertical-tabs sidebar with EVERY data-modelling sub-feature. A reader of this file sees `<DataModellingTabs />` and assumes the tabs reflect the full set of pillar sub-features (Query Examples + Relationships + ERD if it exists)."
      implementation: "`DataModellingTabs.tsx:11-23` declares EXACTLY 2 tabs at this layer: Query Examples + Relationships. ERD is NOT a peer tab — it's a SUB-tab WITHIN Relationships at `components/DataModelling/Relationships/RelationshipsTabs.tsx:14-15` (declares ALL/ERD/Graph as `type` query-param values used by Relationships.tsx:19 to filter the relationship list). The dichotomy mirrors the live doc's framing: Data Modelling has 2 sub-features (Query Examples, Relationships); Relationships internally renders ERD diagrams as one of three filter views (All / ERD / Graph)."
      drift: NONE
      operator_visible_consequence: "Operator sees 2 sidebar tabs at the Data Modelling pillar layer. To filter Relationships to just-ERD edges, they click 'Relationships' (Sidebar) → 'ERD' (top-of-page tab); the URL becomes `/data-modelling/relationships?type=ERD`. NOT a drift, but a documentation opportunity (the layered navigation is not obvious to a first-time operator)."
      confidence: STATIC-INFERRED
      evidence: "components/DataModelling/DataModelling.tsx:9 + components/DataModelling/DataModellingTabs.tsx:11-23 + components/DataModelling/Relationships/RelationshipsTabs.tsx:7-23 + components/DataModelling/Relationships.tsx:18-19 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)"
    - name: "<DataModellingRoutes/> at line 12"
      promise: "Render the routed content for the matched sub-path — Query Examples list / Query Example details / Relationships list — with appropriate permission gates."
      implementation: "`DataModellingRoutes.tsx:13-43` declares: (a) bare path '' redirects to 'query-examples' via Navigate; (b) 'query-examples' wrapped in `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}>` (CONTEXT-SEED only, does NOT block render — see Category B finding via P-165); (c) 'query-examples/:queryExampleId' wrapped in `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE]}>` (CONTEXT-SEED, with `every()` AND-semantics meaning both perms needed for `isAllowedTo=true`); (d) 'relationships' bare, NO wrapper. The 'appropriate permission gates' premise is FALSE — the route layer does not block any user from rendering any sub-page; only inner-action buttons (Add / Edit / Delete in Query Examples; nothing in Relationships) are gated by the separate `<WithPermissions>` component."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator without `QUERY_EXAMPLE_CREATE` lands on /data-modelling/query-examples and SEES the page (search input, list of examples, count) — they only LOSE the Add button. An operator without `QUERY_EXAMPLE_DELETE` (but with UPDATE) lands on a detail page and SEES it — `WithPermissionsProvider`'s every() returns false, but the wrapper renders anyway; the Delete button inside the detail Actions container may or may not be hidden (separate `<WithPermissions>` check expected; not verified at this sidecar's scope). For Relationships: ANY authenticated user sees ALL relationships across ALL data sources — no per-action gate, no controller @PreAuthorize. Cross-referenced via the P-165 probe (already emitted by the ZH dataModelling route sidecar, covers both list-route and detail-route assertions)."
      confidence: STATIC-INFERRED
      evidence: "components/DataModelling/DataModelling.tsx:12 + components/DataModelling/DataModellingRoutes.tsx:13-43 + components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + components/shared/contexts/Permission/WithPermissions.tsx:11-32 + components/DataModelling/QueryExamples.tsx:36-46 + P-165 probe in lineage/odd-platform/probes/P-165.yaml"
  orderings: []
  auth_gates:
    - location: "components/App.tsx:74 (route mount for this component) + components/DataModelling/DataModelling.tsx:6-15 (this component's body)"
      endpoint: "<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />"
      questions:
        - q: "What does this component render for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "**Auth mode is enforced at the server, not at this component.** Under all four `auth.type` values the SPA bundle is served and React Router renders the layout shell identically. Under `DISABLED` (Spring Security `permitAll()` per the cross-referenced OAuthSecurityConfiguration), an unauthenticated session reaches `/data-modelling/*` and this component renders the Sidebar + Content; inner data calls (`/api/queryexample/**` and `/api/relationships`) succeed because the backend is also unauthenticated for read endpoints (3-of-13 QueryExampleController endpoints gated; 0/N Relationships endpoints gated per the ZE RelationshipController sidecar). Under `LOGIN_FORM | OAUTH2 | LDAP`, an unauthenticated user is redirected to the auth provider at the resource layer BEFORE reaching the SPA. An authenticated user under all three modes lands on this component with their global-permission set populated; the layout renders regardless of permissions."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:74 + components/DataModelling/DataModelling.tsx:6-15 (no auth predicates anywhere) + dataModelling route sidecar `security.auth_mode_relevance` for the 4-mode cross-reference + QueryExampleController + RelationshipController sidecars"
        - q: "What does an unauthenticated caller see?"
          a: "Under `DISABLED`: the layout shell + the QueryExamples list page (the redirect at DataModellingRoutes.tsx:16 fires, the list endpoint succeeds, the count + items render). Under `LOGIN_FORM | OAUTH2 | LDAP`: the auth provider's login screen — this component is never reached because Spring Security blocks the SPA bundle delivery."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:74 + dataModelling route sidecar security.auth_mode_relevance (cross-referenced)"
        - q: "What does a wrong-role caller see?"
          a: "An authenticated user without `QUERY_EXAMPLE_CREATE` (or any QUERY_EXAMPLE_*) still sees the layout shell AND the QueryExamples list (read-collaborative posture — the route doesn't gate). They lose only the Add button (gated at QueryExamples.tsx:36-46 by the separate `<WithPermissions>` component). An authenticated user without DELETE-but-with-UPDATE lands on the detail page and sees it (every()-AND semantics of WithPermissionsProvider means `isAllowedTo=false` for them, but the wrapper unconditionally renders). For Relationships: ANY authenticated user sees ALL relationships."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModelling.tsx:6-15 (no permission discrimination) + components/DataModelling/DataModellingRoutes.tsx:17-41 (inner wrappers seed context but don't block) + components/DataModelling/QueryExamples.tsx:36-46 + RelationshipController sidecar"
        - q: "Where does the gate live — route, controller annotation, downstream service, or nowhere?"
          a: "**Layered across multiple loci, none at THIS component**: (a) Resource layer — Spring Security wires authentication via `auth.type` at the server (not relevant here). (b) Route mount at App.tsx:74 — NO permission gate around `<DataModeling />`; contrast LookupTables at App.tsx:75-87 which DOES wrap, though that wrapper is also CONTEXT-SEED-only per the same drift class. (c) This component's composition layer — pure presentational; no gate. (d) Inner-route layer (`DataModellingRoutes.tsx:19-25, 31-37`) — `<WithPermissionsProvider>` SEEDS context but does NOT block render. (e) Inner-action layer (`QueryExamples.tsx:36-46` for Add; `QueryExampleDetailsContainerActions.tsx` for Edit/Delete) — `<WithPermissions>` DOES block render of the buttons. (f) Backend — `QueryExampleController.create / update / delete` carry @PreAuthorize SECURITY_RULES (3 of 13 endpoints); `RelationshipController` has none. So the gate is real ONLY at the action-button + backend-write-endpoint layer."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:74 + components/DataModelling/DataModelling.tsx:6-15 + components/DataModelling/DataModellingRoutes.tsx:17-41 + components/DataModelling/QueryExamples.tsx:36-46 + QueryExampleController sidecar (3/13 endpoints gated) + RelationshipController sidecar (0/N endpoints gated)"
  resource_boundaries: []
  request_inputs: []
  probes_emitted: []
  stress_summary:
    triggers_total: 5
    questions_total: 13
    answers_static_inferred: 13
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — UI presentational component reachable under all four auth modes. Under DISABLED, the SPA bundle is served unauthenticated and this component renders for any caller; under the three protected modes, the auth challenge happens at the resource layer BEFORE this component is reached. The component itself carries no auth predicates, no role/permission check, no `appInfo.authType` branch — its rendering shape is identical across all four modes. — evidence: components/DataModelling/DataModelling.tsx:1-17 (no auth imports or branches).
- **ingestion_filter_relevance**: `N/A — UI layout component, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag only gates `POST /ingestion/entities` server-side. — evidence: components/DataModelling/DataModelling.tsx:1-17.
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`. The Data Modelling pillar's read-collaborative posture (no per-owner / per-namespace filter at controller, service, or UI layer per the QueryExampleController and RelationshipController sidecars) means this UI component cannot impose owner scoping even if it wanted to — it has no permission context to act on at the composition layer.
- **data_exposure**:
  - "The DataModelling layout shell is rendered in the SPA bundle, reachable by any authenticated user (and unauthenticated under DISABLED). The shell itself exposes no data; it composes children that DO expose data: QueryExamples.tsx (list of every query example across the platform, no owner filter — per QueryExampleController) and Relationships.tsx (list of every relationship across the platform, no auth gate — per RelationshipController). → audience: every authenticated user under LOGIN_FORM/OAUTH2/LDAP; every caller under DISABLED."
  - "The Sidebar's tab labels ('Query Examples' / 'Relationships') and the corresponding URLs ('/data-modelling/query-examples' / '/data-modelling/relationships') are emitted into the rendered HTML/JS bundle for every session. Non-secret URL shape, no confidentiality concern."
- **known_security_gaps**:
  - "**This component's composition is invariant across all permission profiles** — Sidebar with both tabs + Content shell rendered for every authenticated user. The 'Relationships' tab is shown to every authenticated user even though the user may lack any permission to read Relationships (they ARE permitted to read them — the read endpoint is ungated — but the surface reveals the existence of the Relationships feature regardless of role). For an operator who configures READ_ONLY roles expecting them to see only Query Examples, this is surprising. The fix would be a `WithPermissions` wrap around the Relationships tab entry in DataModellingTabs.tsx:17-22 — but there is no `RELATIONSHIP_VIEW` permission in the Permission enum (verified — Grep for `RELATIONSHIP_*` permission returned no permission-class matches), so the gate has nowhere to anchor. The structural cause is the absence of a Relationships read permission, not this component." — evidence: components/DataModelling/DataModelling.tsx:6-15 + components/DataModelling/DataModellingTabs.tsx:11-23 + Permission enum in odd-platform-specification (per cross-references) — severity: LOW
  - "**`/data-modelling/relationships` is ungated end-to-end**, INHERITED through this component's composition. The component composes Relationships.tsx via `<DataModellingRoutes/>` line 12 → DataModellingRoutes.tsx:40 (bare Route, no wrapper) → Relationships.tsx renders the list. No `WithPermissionsProvider`, no `WithPermissions`, no SECURITY_RULES entry per the RelationshipController sidecar. Same finding as the dataModelling route sidecar `security.known_security_gaps.[/data-modelling/relationships ungated end-to-end]` — recorded here for completeness because the component IS the composition layer that surfaces the ungated subtree to the operator." — evidence: components/DataModelling/DataModelling.tsx:11-13 + components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar — severity: LOW

## performance

- **hot_paths**:
  - "**`<DataModelling/>` renders once per `/data-modelling/*` navigation** — the React Router match for the outer route at App.tsx:74 mounts this component; subsequent in-pillar navigation (tab clicks switching between Query Examples and Relationships) does NOT remount this component, only its inner Routes children. The body is a single JSX expression (no hooks, no state, no useEffect), so each render is constant-time + zero allocations beyond the JSX VDOM nodes." — evidence: components/DataModelling/DataModelling.tsx:6-15 + components/App.tsx:74 (`<Route path={`${dataModellingPath()}/*`}>` matches on outer path; inner Route changes don't remount the element)
  - "**Lazy-loading cost**: First navigation into `/data-modelling/*` triggers a JS chunk fetch (the lazy import at App.tsx:40); subsequent navigations hit the browser cache. The chunk includes DataModelling.tsx + DataModellingTabs.tsx + DataModellingRoutes.tsx + the AppSuspenseWrapper's effects + the layout styled-components. Inner route children (QueryExamples, QueryExampleDetailsContainer, Relationships) are FURTHER lazy at DataModellingRoutes.tsx:7-11 — each sub-route's first visit triggers another chunk fetch." — evidence: components/App.tsx:40 (lazy) + components/DataModelling/DataModellingRoutes.tsx:7-11 (inner lazy)
- **throughput_characteristics**: `N/A — presentational composition component, no request/response path. No batching, no async, no I/O at this layer.`
- **resource_allocation**: `Negligible — one JSX VDOM tree (3 styled-component nodes + 2 child component nodes), one styled-component theme lookup per render. Bundle-size cost: a few hundred bytes after minification (the component body itself; the layout.ts styled-components + child components dominate the chunk).` — evidence: components/DataModelling/DataModelling.tsx:1-17
- **scaling_characteristics**: `Stateless and pure — `DataModelling` is a function component with no closure state, no module-level mutation, no side effects. Renders are referentially transparent; React's reconciliation deduplicates identical renders. Scales horizontally with the React render tree at zero cost.` — evidence: components/DataModelling/DataModelling.tsx:6-15 (no hooks, no useEffect, no useState, no useDispatch)
- **known_performance_gaps**:
  - "**The `lvh` viewport unit (layout.ts:9) is not supported in older browsers** (Safari < 15.4, Chrome < 108, Firefox < 101) — under those browsers, `calc(100lvh - 3rem)` evaluates to `auto`-like behaviour and the LayoutContainer's height collapses, breaking the sticky-sidebar effect for this component AND every other pillar using the same shell. No fallback `100vh` in the CSS. Not strictly THIS component's gap (it's shared across pillars via layout.ts), but the gap surfaces here too." — evidence: components/shared/styled-components/layout.ts:9 + caniuse.com data for `lvh` unit (cross-referenced — STATIC-INFERRED) — severity: LOW

## upstream_callers

- entry_point: "ui_route:/data-modelling/* (route mount in App.tsx)"
  caller_node: "ts react-component:components/App.tsx:74"
  multiplicity_per_trigger: 1
  evidence: "components/App.tsx:74 — `<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />`. The lazy import is at App.tsx:40 (`const DataModeling = lazy(() => import('./DataModelling/DataModelling'))`); first visit triggers the chunk fetch + Suspense fallback, subsequent visits reuse the cached chunk. The route element is `<DataModeling/>` (the local alias for the default export of this file)."
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/query-examples (toolbar tab deep-link default landing)"
  caller_node: "ts react-component:components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54"
  multiplicity_per_trigger: 1
  evidence: "components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 — `{ name: t('Data Modelling'), link: queryExamplesPath(), value: 'data-modelling' }`. Operator clicking 'Data Modelling' in the global toolbar navigates to `/data-modelling/query-examples` directly (BYPASSING the bare `/data-modelling` URL), so the React Router match still mounts this component AND mounts the inner QueryExamples route in one render cycle. This component renders once per toolbar-tab click."
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Mounting `<DataModelling/>` causes the React Router engine to render the layout shell: an `<aside>` element (Sidebar slot) containing `<DataModellingTabs/>` (which renders the AppTabs primitive with 2 vertical menu items: Query Examples + Relationships), and a `<main>` element (Content slot) containing `<DataModellingRoutes/>` (which renders the matched inner Route's element — QueryExamples, QueryExampleDetailsContainer, or Relationships). The operator sees the two-column page chrome appear in the browser viewport."
  evidence: "components/DataModelling/DataModelling.tsx:6-15 + components/DataModelling/DataModellingTabs.tsx:11-30 + components/DataModelling/DataModellingRoutes.tsx:13-43 + components/shared/styled-components/layout.ts:3-31"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-modelling/* (any sub-path within the Data Modelling pillar)"
- side_effect_class: page-render
  description: "Implicitly triggers a chunked JS bundle download on first visit — the lazy() import at App.tsx:40 fetches the DataModelling chunk (this file + DataModellingTabs + DataModellingRoutes + layout styled-components). Subsequent visits reuse the cached chunk."
  evidence: "components/App.tsx:40 (lazy import) + React.lazy + Suspense behaviour"
  cardinality_per_call: "1 on first visit (uncached); 0 on subsequent visits (cached)"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/* (first visit within a session)"

## sources

- understanding ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1-17 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:1-32 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-45 + odd-platform-ui/src/components/App.tsx:40, 74 + odd-platform-ui/src/components/shared/styled-components/layout.ts:1-31 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- concepts.entities.[DataModelling] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6, 17
- concepts.entities.[S.LayoutContainer / S.Sidebar / S.Content] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:7-13 + odd-platform-ui/src/components/shared/styled-components/layout.ts:3-31
- concepts.entities.[composed children] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:9, 12 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:1-32 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-45
- concepts.operations.[render two-column shell] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15
- concepts.operations.[delegate URL routing to DataModellingRoutes] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:12 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:13-43
- concepts.operations.[delegate tab selection to DataModellingTabs] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:9 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:25 + odd-platform-ui/src/components/shared/elements/AppTabs/useSetSelectedTab.ts:9-15
- concepts.invariants.[purely presentational] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1-17 (no hooks beyond React's default, no useEffect, no useDispatch)
- concepts.invariants.[composition is fixed] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15
- concepts.invariants.[lazy-loaded] ← odd-platform-ui/src/components/App.tsx:40
- concepts.invariants.[two-tab pillar at component layer] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:14-15 (ERD is sub-tab)
- concepts.invariants.[no permission discrimination at composition layer] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 (no permission imports) + odd-platform-ui/src/components/App.tsx:74 (route mount not wrapped)
- concepts.audiences.[every authenticated user] ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15
- concepts.audiences.[permission relevance inside child components] ← odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-37 + RelationshipController sidecar
- concepts.audiences.[live doc surface description] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:3-4 + child files + QueryExampleController + RelationshipController sidecars + odd-platform-ui/src/components/shared/styled-components/layout.ts:1-31
- dependencies_semantic.requires-runtime.[React] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1
- dependencies_semantic.requires-runtime.[styled-components] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:2 + odd-platform-ui/src/components/shared/styled-components/layout.ts:1
- dependencies_semantic.requires-runtime.[react-router-dom] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:3 (transitive via child)
- dependencies_semantic.additional_coupling.[App.tsx coupling load-bearing] ← odd-platform-ui/src/components/App.tsx:40, 74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6
- dependencies_semantic.additional_coupling.[Sidebar position sticky coupled to overflow auto] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:8 + odd-platform-ui/src/components/shared/styled-components/layout.ts:8-10
- dependencies_semantic.additional_coupling.[composition fragile to child renames] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:3-4
- tests_coverage_semantic.test_files ← Grep across odd-platform-ui/src/ for `*.test.*` / `*.spec.*` matching `DataModelling` / `QueryExamples` / `Relationships` returned zero matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- docs_link_semantic.doc_drift_findings.[composition shape matches doc] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23
- docs_link_semantic.doc_drift_findings.[RBAC phrasing overstates restriction] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-25 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46
- docs_link_semantic.doc_drift_findings.[ERD is sub-tab not peer tab] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:7-23
- implicit_adrs.[layout shell with sticky sidebar pattern] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:7-14 + odd-platform-ui/src/components/shared/styled-components/layout.ts:3-31 + sibling pillar root components
- implicit_adrs.[pillar root owns NO routing or state — delegates] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15
- implicit_adrs.[lazy-loaded pillar root] ← odd-platform-ui/src/components/App.tsx:40 + AppSuspenseWrapper at App.tsx:58
- implicit_adrs.[DataModeling alias typo] ← odd-platform-ui/src/components/App.tsx:40 vs odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6, 17 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:51 + odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3
- bugs_limitations_corner_cases.[inconsistent permission gating across inner routes] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-41 + RelationshipController sidecar
- bugs_limitations_corner_cases.[WithPermissionsProvider does not block] ← odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-37 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46
- bugs_limitations_corner_cases.[no tests] ← Grep across odd-platform-ui/src/ for test/spec files containing `DataModelling` returned no matches
- bugs_limitations_corner_cases.[DataModeling alias typo] ← odd-platform-ui/src/components/App.tsx:40 vs surrounding canonical naming
- bugs_limitations_corner_cases.[sticky sidebar coupling] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:8 + odd-platform-ui/src/components/shared/styled-components/layout.ts:8-10
- bugs_limitations_corner_cases.[Sidebar max-width hardcoded] ← odd-platform-ui/src/components/shared/styled-components/layout.ts:13-25 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:14, 18
- bugs_limitations_corner_cases.[useSetSelectedTab substring match fragility] ← odd-platform-ui/src/components/shared/elements/AppTabs/useSetSelectedTab.ts:9-15 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:25
- stress_findings.tunables.[max-width 15rem] ← odd-platform-ui/src/components/shared/styled-components/layout.ts:22
- stress_findings.tunables.[height calc 100lvh - 3rem] ← odd-platform-ui/src/components/shared/styled-components/layout.ts:9
- stress_findings.name_behavior_pairs.[DataModelling pillar name vs URL surface] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling
- stress_findings.name_behavior_pairs.[DataModellingTabs vs sub-feature set] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:14-15
- stress_findings.name_behavior_pairs.[DataModellingRoutes vs permission promise] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:13-43 + WithPermissionsProvider.tsx + WithPermissions.tsx + P-165 probe
- stress_findings.auth_gates ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + DataModellingRoutes.tsx:17-41 + QueryExamples.tsx:36-46 + QueryExampleController + RelationshipController sidecars
- security.auth_mode_relevance ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1-17 + components/App.tsx:74 + dataModelling route sidecar security.auth_mode_relevance for the 4-mode cross-reference
- security.known_security_gaps.[composition invariant across permission profiles] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23
- security.known_security_gaps.[Relationships ungated end-to-end] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:11-13 + DataModellingRoutes.tsx:40 + RelationshipController sidecar
- performance.hot_paths.[render once per pillar navigation] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + odd-platform-ui/src/components/App.tsx:74
- performance.hot_paths.[lazy-loading cost] ← odd-platform-ui/src/components/App.tsx:40 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:7-11
- performance.resource_allocation ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1-17
- performance.scaling_characteristics ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15
- performance.known_performance_gaps.[lvh unit older-browser fallback] ← odd-platform-ui/src/components/shared/styled-components/layout.ts:9
- upstream_callers.[App.tsx route mount] ← odd-platform-ui/src/components/App.tsx:74
- upstream_callers.[ToolbarTabs deep-link landing] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54
- downstream_side_effects.[page-render layout shell] ← odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx + odd-platform-ui/src/components/shared/styled-components/layout.ts:3-31
- downstream_side_effects.[lazy chunk download first visit] ← odd-platform-ui/src/components/App.tsx:40 + React.lazy + Suspense behaviour

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

## Maintainer notes

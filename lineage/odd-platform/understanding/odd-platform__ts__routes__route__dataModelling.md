---
node_id: "odd-platform ts routes route:dataModelling"
node_kind: route
axis: ui_routes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZH-dataModelling-route
feature_hint: "P-02 Data Modelling — route root for the /data-modelling/* UI subtree. Composes two siblings: queryExamplesPath() and relationshipsPath(). Tiny URL-shape module (one BASE_PATH constant + one path builder) that is the SoT for the Data Modelling pillar's URL surface."
related_features: []
related_pillar_features: ["P-02"]
---

# dataModelling route — semantic understanding

## understanding

This module is the URL-shape contract for the **Data Modelling pillar** (per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling`, WebFetched 2026-05-26, status 200). It declares `BASE_PATH = '/data-modelling'` and exports one builder `dataModellingPath()` that returns the bare base path; sibling files (`queryExamplesRoutes.ts`, `relationshipsRoutes.ts`) import `BASE_PATH` to build the two child paths (`/data-modelling/query-examples`, `/data-modelling/query-examples/:queryExampleId`, `/data-modelling/relationships`). The module owns NO rendering, NO auth gate, NO data fetch — it is a pure URL-string module. The actual `dataModellingPath()` builder is mounted ONCE in the app at `components/App.tsx:74` (`<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />`), behind which `components/DataModelling/DataModellingRoutes.tsx:16-41` (a) redirects bare `/data-modelling` to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` and (b) declares the three inner routes with **inconsistent permission gating** — `query-examples` and `query-examples/:queryExampleId` are wrapped in `WithPermissionsProvider` (sets a permission CONTEXT, does NOT block rendering); `relationships` has no permission wrapper at all. The AppToolbar tab labelled "Data Modelling" (`ToolbarTabs.tsx:50-54`) is shown to every authenticated user and links directly to `queryExamplesPath()` (not the bare base), so the redirect at `DataModellingRoutes.tsx:16` is exercised only by direct-URL navigation or deep-links.

## concepts

- entities: [
    "`BASE_PATH` (string literal `'/data-modelling'`) — the SoT for the Data Modelling pillar's URL prefix; sibling files import this constant rather than re-hardcoding the string",
    "`dataModellingPath()` — the one path builder this module exports; trivial wrapper around `react-router-dom.generatePath(BASE_PATH)` that returns the bare base path (no parameters, no sub-paths)",
    "**Sibling URL shapes** (declared in the same directory, not in this file): `queryExamplesPath(queryExampleId?)` at `queryExamplesRoutes.ts:29-38` (returns `/data-modelling/query-examples` or `/data-modelling/query-examples/{id}`); `relationshipsPath()` at `relationshipsRoutes.ts:4-6` (returns `/data-modelling/relationships`)"
  ]
- operations: [
    "build base data-modelling URL — returns the literal `/data-modelling`; consumers concatenate sub-paths or use the sibling builders",
    "**provide `BASE_PATH` to sibling files** — the file's primary purpose is to export `BASE_PATH` so `queryExamplesRoutes.ts:3` and `relationshipsRoutes.ts:2` can import it; the `dataModellingPath()` builder is consumed only by `App.tsx:74` (one site) for the `<Route path>` declaration"
  ]
- invariants: [
    "`BASE_PATH = '/data-modelling'` is the single canonical prefix for every Data Modelling URL in the UI",
    "The bare `/data-modelling` URL is NOT a renderable view — `DataModellingRoutes.tsx:16` redirects it to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` (component-side, not route-module-side)",
    "Adding a new sub-tab to Data Modelling is a 3-file change: a new sibling route file under `routes/dataModelling/` (or a new function in this module), a new `<Route>` declaration in `DataModellingRoutes.tsx`, a new tab entry in `DataModellingTabs.tsx`",
    "The route module exposes `dataModellingPath()` unconditionally — no auth predicates, no feature-flag gating, no role check"
  ]
- audiences: [
    "Every authenticated user — the 'Data Modelling' tab is shown unconditionally in `ToolbarTabs.tsx:50-54` (no `WithPermissions` wrapper around the tab entry); both sub-tabs (`Query Examples`, `Relationships`) are visible to all authenticated users in `DataModellingTabs.tsx:11-23`",
    "**Permission relevance is inside-only**: per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling` (WebFetched 2026-05-26, status 200), Query Examples are `RBAC-gated by QUERY_EXAMPLE_CREATE` for the creation surface and `QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE` for the details/edit surface. The doc DOES NOT specify view permissions for Relationships (and indeed the controller has none — see RelationshipController sidecar). The route module exposes the URLs to everyone; the inner permission discrimination happens at the component layer via `WithPermissionsProvider` + `WithPermissions` (see `bugs_limitations_corner_cases` for the actual gating shape)"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Modelling pillar UI (`components/DataModelling/DataModelling.tsx`) — the route only makes sense when the parent `<DataModeling>` component tree is mounted at `App.tsx:74`",
    "Query Examples feature (`QueryExampleController.java` backend at `odd-platform-api/.../controller/QueryExampleController.java`; UI at `components/DataModelling/QueryExamples.tsx`) — primary destination of the redirect at `DataModellingRoutes.tsx:16`",
    "Relationships feature (`RelationshipController.java` backend; UI at `components/DataModelling/Relationships.tsx`) — secondary destination via the in-page tab"
  ]
- requires-config: []
- requires-runtime: [
    "`react-router-dom` — imported on line 1 of this file for `generatePath`; this is the only import",
    "**Note on import asymmetry**: the alerts route module (`alertsRoutes.ts`, sibling) declares `BASE_PATH` without importing from `react-router-dom` (and calls plain template-literal concatenation in its builder); this `dataModelling.ts` imports `react-router-dom`'s `generatePath` and uses it even though there are no path parameters to substitute. The two patterns coexist across `routes/` — see implicit_adrs"
  ]
- additional_coupling:
  - "Exposed via `routes/dataModelling/index.ts:1-3` (`export * from './queryExamplesRoutes'; export * from './relationshipsRoutes'; export * from './dataModelling'`) which is in turn re-exported via `routes/index.ts:10` (`export * from './dataModelling'`). Consumers import from `'routes'` (the bare module path), not the file directly. Refactoring this file's path is safe; renaming `dataModellingPath` or `BASE_PATH` breaks every consumer."
  - "**The `BASE_PATH` export is load-bearing across the dataModelling subtree** — `queryExamplesRoutes.ts:3` and `relationshipsRoutes.ts:2` import `BASE_PATH` from this file. Changing `BASE_PATH` from `'/data-modelling'` to anything else cascades silently to both sibling files; there is no test pinning the literal."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`dataModellingPath()` returns the literal string `'/data-modelling'`"
    test_class: unit
    criticality: LOW
    note: "Trivial pure function; a regression (e.g. typo in BASE_PATH) would be caught by humans at the first navigation attempt, but a pinning test would catch it at build time."
  - behaviour: "Bare `/data-modelling` URL redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />`"
    test_class: integration
    criticality: LOW
    note: "The redirect lives at `DataModellingRoutes.tsx:16`, one component layer above this route module — would be exercised by a router-level integration test, not a unit test of this module alone."
  - behaviour: "Adding a new sibling sub-route (e.g. ERD) requires editing 3 files; the type system does NOT enforce coupling between the sub-route literal in `DataModellingRoutes.tsx:18,28,40` and the path builders in `routes/dataModelling/*Routes.ts`"
    test_class: integration
    criticality: LOW
    note: "Same structural fragility as the AlertsRoutes pattern documented in the alerts route sidecar."
- test_files: []
- gaps: |
    No unit tests target this module or any other module under
    `odd-platform-ui/src/routes/dataModelling/` — directory-wide gap, same as
    `odd-platform-ui/src/routes/*` overall (confirmed by Grep for
    `dataModellingPath` / `queryExamplesPath` / `relationshipsPath` in
    `odd-platform-ui/src/` — every match is in production code, none in
    `*.test.*` or `*.spec.*` files). A regression that would slip through:
    accidentally changing `BASE_PATH` to `/data-modeling` (American spelling)
    or `/datamodelling` (no hyphen) silently breaks every link in the
    AppToolbar and the DataModellingTabs — only humans navigating discover it.
    The most-likely class of regression that the current zero-test posture
    misses is the cross-module coupling: `DataModellingRoutes.tsx:18,28,40`
    hard-codes the literals `'query-examples'` / `'query-examples/:queryExampleId'`
    / `'relationships'` separately from the route-module builders; renaming
    either side without the other ships a broken link.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling"
    anchor: ""
    rationale: "The Data Modelling pillar page is the canonical user-facing doc for what this route surfaces. Verified live (WebFetched 2026-05-26, status 200). The page explicitly enumerates the URL surface this route declares: `/data-modelling` redirects to `/data-modelling/query-examples`; `/data-modelling/query-examples` (list + creation); `/data-modelling/query-examples/{id}` (details/edit); `/data-modelling/relationships` (list). The page also confirms the RBAC posture (`QUERY_EXAMPLE_CREATE` for creation, `QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE` for details/edit) which matches the inner `WithPermissionsProvider` declarations at `DataModellingRoutes.tsx:21-22, 32-34`."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      H1: "Data Modelling"
      H2 list: "Subsections", "UI entry points", "Why this is a separate pillar", "Where to next"
      URL surface (verbatim):
        - "/data-modelling redirects to /data-modelling/query-examples"
        - "/data-modelling/query-examples — Query Examples list + creation"
        - "/data-modelling/query-examples/{id} — Query Example details/edit"
        - "/data-modelling/relationships — Relationships list"
      RBAC posture (verbatim):
        - "RBAC-gated by QUERY_EXAMPLE_CREATE" (creation surface)
        - "RBAC-gated by QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE" (details/edit surface)
      Relationships description (verbatim):
        - "Relationships — entity-to-entity links rendered as ERD diagrams.
          Covers two relationship classes: ENTITY_RELATIONSHIP
          (foreign-key-style ERD edges) and GRAPH_RELATIONSHIP (free-form
          graph edges)"
      View-permission note: "The documentation does not explicitly specify
      who can view relationships, only that query examples are gated by
      create/update/delete permissions. Relationships viewing permissions
      are not mentioned." (consistent with the code — RelationshipController
      has zero authorization assertions per the RelationshipController
      sidecar.)
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/data-modelling"
    anchor: ""
    rationale: "Earlier URL convention; verified 404 (WebFetched 2026-05-26). The Data Modelling page lives under `/features/data-modelling`, not under `/features/active-platform-features/data-modelling`. Recorded so the orchestrator's prompt template doesn't accidentally reference the stale path."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      "Page Not Found" with suggested alternative
      "https://docs.opendatadiscovery.org/features/data-modelling.md".
- doc_drift_findings:
  - "The live doc page at `https://docs.opendatadiscovery.org/features/data-modelling` describes Relationships as `entity-to-entity links rendered as ERD diagrams` — this is the **only** doc reference to ERD. The route module declares no ERD-specific path; the doc's `Relationships` section IS the ERD surface (rendered inside the `Relationships.tsx` component via the `RelationshipController` data, NOT as a separate route). The orchestrator's prompt asked whether `dataModelling` 'covers ERD only or query-examples too' — the answer (verified end-to-end): the `dataModelling` URL covers BOTH Query Examples (the default landing tab) AND Relationships (which IS the ERD surface). There is no third ERD route. NOT a drift."
  - "The doc page says `RBAC-gated by QUERY_EXAMPLE_CREATE` for the creation surface (the `query-examples` list page) — but the actual gating at `DataModellingRoutes.tsx:19-25` is `WithPermissionsProvider`, which DOES NOT block rendering of the page; it only seeds a permission context that child components (notably `QueryExamples.tsx:36-46` for the 'Add query example' button) consume to gate UI ACTIONS. A user without `QUERY_EXAMPLE_CREATE` who navigates to `/data-modelling/query-examples` STILL SEES the page (search, list, individual examples); they just cannot see the create button. The doc's `RBAC-gated by QUERY_EXAMPLE_CREATE` phrasing is more restrictive than the implementation — the page is OPEN to read for any authenticated user; only the CREATE action is gated. Surface as a doc-clarity finding to doc-gap-finder; see also the QueryExampleController sidecar which documents the same shape from the backend side (`10 of 13 endpoints fall through to authenticated()` — read-collaborative posture)."
  - "The doc page describes only `/data-modelling/query-examples/{id}` (singular details/edit URL) — but `DataModellingRoutes.tsx:27-39` wraps this route in `WithPermissionsProvider` requiring `QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE`. A user with only `QUERY_EXAMPLE_UPDATE` and not `QUERY_EXAMPLE_DELETE` (or vice versa) cannot land on the details page with full action context — the `WithPermissionsProvider` uses `allowedPermissions.every(...)` (`PermissionProvider.tsx:21-25`) meaning **BOTH** permissions are required for the context to evaluate `isAllowedTo: true`. This subtlety is not in the doc."

## implicit_adrs

- "**Route modules under `odd-platform-ui/src/routes/dataModelling/` use `react-router-dom`'s `generatePath` for path construction**, in contrast to peer route modules (e.g. `alertsRoutes.ts`) that use plain template-literal concatenation. The `generatePath` import is required for the `:queryExampleId` parameter substitution at `queryExamplesRoutes.ts:32`, but is also used for the parameter-free `dataModellingPath()` at line 6 (where it provides no value beyond a no-op). The decision: prefer `generatePath` uniformly within the dataModelling subtree for consistency, accepting one extra import in the parameterless builder." — evidence: dataModelling.ts:1 (`import { generatePath }`) + queryExamplesRoutes.ts:1 + relationshipsRoutes.ts:1 (all three files use it) vs alertsRoutes.ts (sibling — no generatePath import, plain template-literal concatenation) — intent_anchor: "(no explicit comment; the convention is observable across the three files in this directory)" — confidence: MEDIUM
- "**The Data Modelling pillar's URL prefix lives in a SHARED `BASE_PATH` constant**, exported from this file and imported by both sibling files. This is the only routes subdirectory in `odd-platform-ui/src/routes/` that uses this cross-file shared-constant pattern — peer pillars (alerts, activity, etc.) declare their `BASE_PATH` inline in their single route file. The decision: when a pillar has multiple sub-routes that need to share the prefix, externalise the prefix to a `dataModelling.ts`-style module so the sibling files can import it." — evidence: dataModelling.ts:3 (export) + queryExamplesRoutes.ts:3 (`import { BASE_PATH } from './dataModelling'`) + relationshipsRoutes.ts:2 (same) — intent_anchor: "(no explicit comment; the convention is observable from the directory's three-file structure)" — confidence: HIGH
- "**The bare `/data-modelling` URL is not a renderable view** — landing on it always redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` at `components/DataModelling/DataModellingRoutes.tsx:16`. Equivalent pattern is used by Alerts (`/alerts` → `/alerts/all`), Search, Management. The decision: every multi-tab pillar's bare base URL is a redirect to the canonical first tab, not a 404 and not a chooser screen." — evidence: components/DataModelling/DataModellingRoutes.tsx:16 (`<Route path='' element={<Navigate to='query-examples' />} />`) + components/Alerts/AlertsRoutes/AlertsRoutes.tsx (same pattern per the alerts sidecar `implicit_adrs.[4]`) — intent_anchor: "(no inline comment; the convention is enforced by the React-Router declarative shape)" — confidence: HIGH
- "**Query Examples is the canonical first tab of Data Modelling** — both the AppToolbar deep-link (`ToolbarTabs.tsx:52`, `link: queryExamplesPath()`) AND the bare-URL redirect (`DataModellingRoutes.tsx:16`, `<Navigate to='query-examples' />`) bypass Relationships. The decision: when the user clicks 'Data Modelling' in the global nav, they go straight to Query Examples; Relationships is reachable only via the in-page tab or direct URL." — evidence: ToolbarTabs.tsx:50-54 + DataModellingRoutes.tsx:16 + DataModellingTabs.tsx:13-22 (tab ORDER: Query Examples first, Relationships second) — intent_anchor: "(no explicit comment; the convention is observable from two independent code sites converging on the same default)" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Inconsistent permission gating across the three inner routes**: `query-examples` and `query-examples/:queryExampleId` are wrapped in `WithPermissionsProvider` (`DataModellingRoutes.tsx:19-25, 31-37`) but `relationships` is not (`DataModellingRoutes.tsx:40`, bare `element={<Relationships />}`). This inconsistency means the permission-context tree exists for the Query Examples subtree but NOT for Relationships — any child component under `Relationships.tsx` that calls `usePermissions` reads from an empty/default context (the default `PermissionContext` from `PermissionContext.tsx`). The RelationshipController backend ALSO has no authorization assertions (per the RelationshipController sidecar `bugs_limitations_corner_cases.[0]`); the lack of UI permission context is consistent with the lack of backend gating, but neither layer enforces anything specific to Relationships at all." — evidence: components/DataModelling/DataModellingRoutes.tsx:17-39 (query-examples wrapped) vs DataModellingRoutes.tsx:40 (relationships not wrapped) — severity: LOW
- "**`WithPermissionsProvider` does NOT block rendering; it only seeds a context**. Naming the wrapper `WithPermissionsProvider` and using it at the route level (`DataModellingRoutes.tsx:19-25, 31-37`) misleads a reader into believing it gates ACCESS to the route — but inspection of `WithPermissionsProvider.tsx:11-49` + `PermissionProvider.tsx:12-46` shows the wrapper unconditionally renders its child (`{render()}` or `<Component />` or `{children}`); it only computes `isAllowedTo` and provides it via React Context. The actual gating happens in `WithPermissions` (different component, `WithPermissions.tsx:27-29`) which DOES return null when the user lacks the permission. So: `/data-modelling/query-examples` is OPEN to read for any authenticated user; only inner UI ACTIONS (Add button, Edit form, Delete button) are gated by `WithPermissions`. Compare LookupTables (`App.tsx:75-87`) which uses the SAME `WithPermissionsProvider` wrapper at the route mount BUT inside `LookupTables.tsx` apparently STILL renders all-the-time (would need to verify per the LookupTables sidecar — but the wrapper itself is identical, so the behaviour is the same). **The `WithPermissionsProvider` naming-vs-behaviour drift is a Category B finding (name promises 'access gate', behaviour is 'context seed only')** — see `stress_findings`." — evidence: components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + components/shared/contexts/Permission/WithPermissions.tsx:11-32 + components/DataModelling/QueryExamples.tsx:36-46 (uses `WithPermissions` — actually gates) vs components/DataModelling/DataModellingRoutes.tsx:19-37 (uses `WithPermissionsProvider` — does NOT gate) — severity: MEDIUM
- "**No unit tests target this module or any module in `routes/dataModelling/`**. A typo in `BASE_PATH` (e.g. `/data-modeling`) would not be caught by the build or by tests; it would surface only when a human user clicks the Data Modelling tab in the AppToolbar. Same finding shape as the alerts sidecar." — evidence: Grep across `odd-platform-ui/src` for `*.test.*` or `*.spec.*` containing `dataModellingPath` / `queryExamplesPath` / `relationshipsPath` returned zero matches — severity: LOW
- "**`generatePath(BASE_PATH)` is a no-op**: `BASE_PATH = '/data-modelling'` has no `:param` placeholders, so `generatePath` returns the input string verbatim. The `import { generatePath } from 'react-router-dom'` at line 1 is therefore a vestigial idiom — the function could be `export function dataModellingPath() { return BASE_PATH; }` with identical behaviour and one less import. Cosmetic, not a bug." — evidence: dataModelling.ts:5-7 + react-router-dom's `generatePath` behaviour (path with no placeholders is returned unchanged) — severity: LOW
- "**Sibling cross-file coupling is silent**: `queryExamplesRoutes.ts:3` and `relationshipsRoutes.ts:2` both import `BASE_PATH` from this file. There is no type-level constraint that BASE_PATH must remain a string starting with `/data-modelling` — refactoring this file to (e.g.) export `BASE_PATH = '/datamodel'` cascades silently to both sibling files without a build-time warning. A pinning test on `dataModellingPath()` would catch one symptom; a pinning test on `queryExamplesPath()` and `relationshipsPath()` would catch the others." — evidence: dataModelling.ts:3 + queryExamplesRoutes.ts:3 + relationshipsRoutes.ts:2 — severity: LOW
- "**The route module exports `BASE_PATH` AS A NAMED EXPORT** (line 3) — so the constant is part of the public API of `routes/` (since `routes/index.ts:10` re-exports everything from `routes/dataModelling/index.ts:3` which re-exports everything from `dataModelling.ts`). Any consumer can `import { BASE_PATH } from 'routes'` and get `/data-modelling`. The intent of the export is to feed sibling files in the SAME subdirectory; the cross-module leakage is unconventional vs the alerts/activity peer modules which do NOT export their `BASE_PATH`. Either harden by making `BASE_PATH` non-exported and providing a `dataModellingChildPath(sub: string)` helper, or accept the wider visibility deliberately. Cosmetic." — evidence: dataModelling.ts:3 (`export const BASE_PATH`) vs alertsRoutes.ts (`BASE_PATH` not exported per the alerts sidecar) + routes/dataModelling/index.ts:3 + routes/index.ts:10 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "dataModellingPath()"
      promise: "Build the canonical URL for the Data Modelling pillar — returns a string the caller can use as a React Router `path` or a `Link to`."
      implementation: "Returns `generatePath('/data-modelling')` which is identically `'/data-modelling'` (generatePath with no placeholders is a passthrough). The function is the URL builder for the bare base URL only; consumers wanting sub-paths use the sibling builders `queryExamplesPath()` and `relationshipsPath()`."
      drift: NONE
      operator_visible_consequence: "n/a — name and implementation match."
      confidence: STATIC-INFERRED
      evidence: "dataModelling.ts:5-7 + react-router-dom generatePath docs (parameterless path returned unchanged)"
    - name: "dataModelling (module name + pillar name)"
      promise: "URL surface for the Data Modelling pillar — operator opening `/data-modelling` lands on something that lets them DO data modelling."
      implementation: "Bare `/data-modelling` redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` at `DataModellingRoutes.tsx:16`. The Data Modelling pillar's URL surface covers TWO sub-features: Query Examples (the default landing) and Relationships (the in-page second tab, which renders ERD diagrams per the doc at `https://docs.opendatadiscovery.org/features/data-modelling`). NOT a separate ERD route — Relationships IS the ERD surface."
      drift: NONE
      operator_visible_consequence: "Operator clicking the 'Data Modelling' tab in the global toolbar lands directly on Query Examples (not on a pillar overview, not on a chooser). To reach Relationships they must click the secondary in-page tab. This is the deliberate UX shape per `implicit_adrs.[3]`."
      confidence: STATIC-INFERRED
      evidence: "components/DataModelling/DataModellingRoutes.tsx:16 + components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + components/DataModelling/DataModellingTabs.tsx:11-23 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)"
    - name: "WithPermissionsProvider"
      promise: "The name implies 'wrap a component in a permission GATE' — a reader sees `WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}` at `DataModellingRoutes.tsx:19-25` and concludes that the route is BLOCKED for users without `QUERY_EXAMPLE_CREATE`."
      implementation: "`WithPermissionsProvider` does NOT block rendering. It unconditionally renders its child (`{render()}` at line 25 of WithPermissionsProvider.tsx, `<Component />` at line 36, or `{children}` at line 46). It only WRAPS the child in `PermissionProvider`, which computes `isAllowedTo` from the user's globalPermissions and exposes it via React Context. The actual gate is the SIBLING component `WithPermissions` (NO `Provider` suffix) at `WithPermissions.tsx:27-29` which returns `null` when the permission is missing. So the `WithPermissionsProvider` at the route level is a CONTEXT-SEED, not a gate. The Query Examples list page renders for any authenticated user regardless of `QUERY_EXAMPLE_CREATE`."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator without `QUERY_EXAMPLE_CREATE` navigating to `/data-modelling/query-examples` STILL SEES the list of query examples (count, search, individual entries); they only fail to see the 'Add query example' button (gated by the separate `WithPermissions` at `QueryExamples.tsx:36-46`). A reader of `DataModellingRoutes.tsx` who believes the route is gated may misdiagnose 'why does the page render for read-only users?' This drift is consistent with the read-collaborative backend posture (per QueryExampleController sidecar `understanding`: 10 of 13 endpoints fall through to `authenticated()`); the read-collaborative intent is correct, but the misleading wrapper name obscures it."
      confidence: STATIC-INFERRED
      evidence: "components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + components/shared/contexts/Permission/WithPermissions.tsx:11-32 + components/DataModelling/DataModellingRoutes.tsx:19-25, 31-37 + components/DataModelling/QueryExamples.tsx:36-46"
  orderings: []
  auth_gates:
    - location: "components/App.tsx:74"
      endpoint: "<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />"
      questions:
        - q: "What does this route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "**This is a client-side route declaration; auth mode is enforced at the server, not here.** Under all four `auth.type` values the SPA bundle is served and the React Router declaration is parsed identically. Under `DISABLED` an unauthenticated session can reach `/data-modelling/*` and the inner React queries against `/api/queryexample/**` and `/api/relationships` will succeed unauthenticated (per QueryExampleController and RelationshipController sidecars — backend has no @PreAuthorize except for the 3 write endpoints). Under `LOGIN_FORM | OAUTH2 | LDAP` an unauthenticated user is redirected to the auth provider by Spring Security at the resource layer before reaching the SPA; an authenticated user reaches the route with their global-permission set populated, gating the inner UI actions but not the route landing."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:74 (route declaration) + odd-platform-api/.../OAuthSecurityConfiguration.java (4-mode wiring, per the alerts route sidecar `security.auth_mode_relevance`) + QueryExampleController + RelationshipController sidecars"
        - q: "What does an unauthenticated caller see?"
          a: "Same as above — under `LOGIN_FORM | OAUTH2 | LDAP` an unauthenticated user requesting the SPA bundle gets redirected at the resource layer (Spring Security configures the resource server to require auth before serving static assets when auth.type != DISABLED). Under `DISABLED` an unauthenticated session reaches `/data-modelling` and lands on Query Examples; the inner data calls succeed because the backend is unauthenticated. The route module itself does NOT trigger an auth challenge; it's a pure URL-string."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:74 + dataModelling.ts:1-7 (no auth predicates) + alerts route sidecar `security.auth_mode_relevance` (cross-reference for the platform-wide pattern)"
        - q: "What does a wrong-role caller see?"
          a: "A caller authenticated but lacking `QUERY_EXAMPLE_CREATE` still sees the Query Examples list (route is not gated; only the Add button is hidden). A caller lacking `QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE` still sees the Query Example details page (`DataModellingRoutes.tsx:27-39`'s `WithPermissionsProvider` only seeds context; per Category B finding above). Relationships is reachable by any authenticated user. So the route mount imposes NO permission discrimination; the differentiation happens at action-button level inside the child components via `WithPermissions`."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingRoutes.tsx:17-41 + WithPermissionsProvider.tsx:11-49 (does not block) + WithPermissions.tsx:27-29 (does block) + QueryExamples.tsx:36-46 (uses WithPermissions for the Add button)"
        - q: "Where does the gate live — route, controller annotation, downstream service, or nowhere?"
          a: "**Layered across multiple loci, none at the route module itself:** (a) Resource layer — Spring Security wires authentication via auth.type at the server (not relevant here). (b) Route mount — NO permission gate (`App.tsx:74` has no `WithPermissionsProvider` around `<DataModeling />`; contrast `LookupTables` at `App.tsx:75-87` which DOES wrap, though the wrapper still does not block per the Category B finding). (c) Inner route — `DataModellingRoutes.tsx:19-25, 31-37` wrap with `WithPermissionsProvider` (CONTEXT only, no block). (d) Action level — `QueryExamples.tsx:36-46` uses `WithPermissions` to hide the Add button (this is the actual gate that blocks the UI surface). (e) Backend — `QueryExampleController` has @PreAuthorize on 3 of 13 endpoints via SECURITY_RULES (per the QueryExampleController sidecar); `RelationshipController` has none. So the gate is real ONLY at the action-button + backend-write-endpoint layer; the route layer is open by design (read-collaborative posture)."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:74 + DataModellingRoutes.tsx:17-41 + QueryExamples.tsx:36-46 + QueryExampleController sidecar `understanding` (3/13 endpoints gated) + RelationshipController sidecar `understanding` (0 endpoints gated)"
  resource_boundaries: []
  request_inputs: []
  probes_emitted:
    - probe_id: P-165
      question: "Does `WithPermissionsProvider` at `DataModellingRoutes.tsx:19-25, 31-37` actually BLOCK rendering for users without the required permissions, or does it (as Category B static analysis predicts) only seed context and let the route render for everyone?"
      probe_path: "lineage/odd-platform/probes/P-165.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 7
    answers_static_inferred: 7
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — UI declarative module. This file exports plain TypeScript string literals (`/data-modelling`) consumed by React Router on the client side; it carries no auth predicates, no fetch calls, and no role/permission checks. The `auth.type` (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) enforcement happens server-side at the Spring Security configuration (see `OAuthSecurityConfiguration.java` per the alerts route sidecar `security.auth_mode_relevance`); auth mode does not branch the behaviour of this module under any of the four `auth.type` values. — evidence: dataModelling.ts:1-7 (no auth-related imports or branches).
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag only gates `POST /ingestion/entities` server-side; it has no relationship to UI routes. — evidence: dataModelling.ts:1-7 (not on ingestion path).
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`. The Data Modelling pillar's read-collaborative posture means no per-owner scoping is applied at the controller, service, or route layer (per QueryExampleController sidecar `concepts.invariants`: read endpoints return data across all namespaces to all authenticated users).
- **data_exposure**: `"The literal string '/data-modelling' is emitted into the rendered HTML/JS bundle for every authenticated session and discoverable to anyone who can fetch the SPA bundle → no audience restriction at this layer; under auth.type=DISABLED the bundle is reachable unauthenticated"` — non-secret URL shape that parallels the public GitHub source, so disclosure is not a confidentiality concern; recorded for completeness.
- **known_security_gaps**:
  - "**The `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:19-25, 31-37` does NOT block rendering**; it only seeds a permission context. A maintainer reading the file and observing `allowedPermissions={[Permission.QUERY_EXAMPLE_CREATE]}` reasonably concludes the route is gated, but inspection shows the wrapper unconditionally renders its child. The actual gate is the separate `WithPermissions` component used at `QueryExamples.tsx:36-46` to hide the Add button. The naming-vs-behaviour drift is a SECURITY concern only insofar as a future maintainer who relies on the wrapper for access control will silently ship an open page. The current behaviour is consistent with the read-collaborative intent (Query Examples are open to read; only write actions are gated) — but the wrapper name misleads the reader." — evidence: components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/DataModelling/DataModellingRoutes.tsx:19-25, 31-37 + components/DataModelling/QueryExamples.tsx:36-46 — severity: MEDIUM
  - "**The `/data-modelling/relationships` route is ungated end-to-end**: no `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:40`, no @PreAuthorize on `RelationshipController` (per the RelationshipController sidecar `understanding`), no SECURITY_RULES entry for `/api/relationships/**`. Any authenticated user sees every relationship across every data source. The live doc page (WebFetched 2026-05-26) does not state visibility scoping for Relationships; the absence is platform-wide intent (read-collaborative) but is not surfaced to the operator. This is not a route-module finding per se (the route module exposes URLs unconditionally by design), but the maintainer reading this sidecar should know that landing on `/data-modelling/relationships` exposes the full relationship graph to any authenticated viewer." — evidence: DataModellingRoutes.tsx:40 + RelationshipController sidecar — severity: LOW

## performance

- **hot_paths**:
  - "`dataModellingPath()` is invoked at app render time by `components/App.tsx:74` (route declaration, evaluated once at mount) — the function body is `generatePath(BASE_PATH)` with no parameters, returning the literal string `/data-modelling`. The cost is O(1) and the result is effectively a string constant; no allocations of consequence." — evidence: dataModelling.ts:5-7 + components/App.tsx:74
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O.`
- **resource_allocation**: `Trivial — one `BASE_PATH` string constant + one wrapper function. Bundle-size cost is a few dozen bytes after minification. The `react-router-dom`'s `generatePath` is already imported elsewhere in the SPA (used by every parameterised route module), so the import does not add fresh dependency weight.` — evidence: dataModelling.ts:1-7
- **scaling_characteristics**: `Stateless and pure — `dataModellingPath` is a referentially transparent function with no closure over mutable state, no module-level mutation, and no side effects, so it scales horizontally with the React render tree at zero cost. The function is called once at App mount (the route declaration) and the result is interned by React Router; subsequent renders re-use the same string.` — evidence: dataModelling.ts:5-7 + components/App.tsx:74
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/data-modelling/* (route mount)"
  caller_node: "ts react-component:components/App.tsx:74"
  multiplicity_per_trigger: 1
  evidence: "components/App.tsx:74 — `<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />`. The route declaration is evaluated once per App mount; `dataModellingPath()` returns `'/data-modelling'` which is concatenated with `/*` to produce the React Router pattern."
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/query-examples (toolbar tab default landing)"
  caller_node: "ts react-component:components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54"
  multiplicity_per_trigger: "n/a — `dataModellingPath()` is NOT called by ToolbarTabs; the toolbar tab links to `queryExamplesPath()` (sibling builder) directly. Recorded here as a REFERENCE to make the cross-file relationship visible — the toolbar tab labelled 'Data Modelling' (value: 'data-modelling') links to `queryExamplesPath()` not `dataModellingPath()`."
  evidence: "components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 — `{ name: t('Data Modelling'), link: queryExamplesPath(), value: 'data-modelling' }`"
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Mounting `<Route path={dataModellingPath()}/*>` causes the React Router parser to match any URL starting with `/data-modelling/` to the `<DataModeling>` component tree (Sidebar with `<DataModellingTabs>` + Content with `<DataModellingRoutes>`). The bare `/data-modelling` URL renders the `<DataModellingRoutes>` Routes element which fires `<Navigate to='query-examples' />` at `DataModellingRoutes.tsx:16` — the browser URL is rewritten to `/data-modelling/query-examples` and the `<QueryExamples>` component is mounted."
  evidence: "components/App.tsx:74 + components/DataModelling/DataModelling.tsx:6-15 + components/DataModelling/DataModellingRoutes.tsx:13-43"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-modelling/* (any sub-path)"

## sources

- understanding ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:1-38 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-6 + odd-platform-ui/src/routes/dataModelling/index.ts:1-3 + odd-platform-ui/src/routes/index.ts:10 + odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:1-17 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-45 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:1-32 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- concepts.entities.[BASE_PATH] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3
- concepts.entities.[dataModellingPath] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7
- concepts.entities.[sibling URL shapes] ← odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:29-38 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6
- concepts.operations.[build base data-modelling URL] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7
- concepts.operations.[provide BASE_PATH to sibling files] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:3 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2
- concepts.invariants.[BASE_PATH canonical] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3
- concepts.invariants.[bare URL redirects] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16
- concepts.invariants.[adding a new sub-tab is a 3-file change] ← odd-platform-ui/src/routes/dataModelling/ (file layout) + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-41 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23
- concepts.invariants.[unconditional URL exposure] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7
- concepts.audiences.[every authenticated user] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23
- concepts.audiences.[permission relevance inside only] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200) + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-37 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx + QueryExampleController sidecar + RelationshipController sidecar
- dependencies_semantic.requires-runtime.[react-router-dom] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1
- dependencies_semantic.requires-runtime.[import asymmetry vs alertsRoutes] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1 (generatePath import) vs alerts route sidecar `dependencies_semantic.requires-runtime` (`alertsRoutes.ts:1-13` no imports)
- dependencies_semantic.additional_coupling.[exposed via routes/index] ← odd-platform-ui/src/routes/dataModelling/index.ts:1-3 + odd-platform-ui/src/routes/index.ts:10
- dependencies_semantic.additional_coupling.[BASE_PATH load-bearing] ← odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:3 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2
- tests_coverage_semantic.test_files ← Grep for `dataModellingPath` / `queryExamplesPath` / `relationshipsPath` in `*.test.*` / `*.spec.*` under `odd-platform-ui/src/` returned no matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- docs_link_semantic.inferred_docs.[1] (stale URL) ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/data-modelling (2026-05-26, status 404)
- docs_link_semantic.doc_drift_findings.[ERD route does not exist] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200) + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-41 (no ERD route declaration)
- docs_link_semantic.doc_drift_findings.[RBAC phrasing overstates restriction] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200) + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-25 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46
- docs_link_semantic.doc_drift_findings.[every() AND-of-permissions subtlety] ← odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:21-25 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:31-37
- implicit_adrs.[generatePath uniformly within dataModelling subtree] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:1 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1 vs alerts route sidecar dependencies_semantic
- implicit_adrs.[shared BASE_PATH constant pattern] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:3 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2
- implicit_adrs.[bare base URL is a redirect not a view] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + alerts route sidecar implicit_adrs.[4]
- implicit_adrs.[Query Examples is canonical first tab] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:13-22
- bugs_limitations_corner_cases.[inconsistent permission gating] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-41
- bugs_limitations_corner_cases.[WithPermissionsProvider does not block] ← odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-37
- bugs_limitations_corner_cases.[no unit tests] ← Grep across odd-platform-ui/src/ for `dataModellingPath` in test/spec files returned no matches
- bugs_limitations_corner_cases.[generatePath is no-op] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7
- bugs_limitations_corner_cases.[silent sibling coupling] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:3 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2
- bugs_limitations_corner_cases.[BASE_PATH exported as named export] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3 + odd-platform-ui/src/routes/dataModelling/index.ts:3 + odd-platform-ui/src/routes/index.ts:10
- stress_findings.name_behavior_pairs.[dataModellingPath] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7
- stress_findings.name_behavior_pairs.[dataModelling pillar name vs URL surface] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- stress_findings.name_behavior_pairs.[WithPermissionsProvider] ← odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-25, 31-37 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46
- stress_findings.auth_gates ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-41 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46 + QueryExampleController sidecar + RelationshipController sidecar
- stress_findings.probes_emitted.[P-165] ← lineage/odd-platform/probes/P-165.yaml (emitted by this analyser; verifies the Category B drift on WithPermissionsProvider via headless-browser session against a probe stack)
- security.auth_mode_relevance ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7 (no auth branches) + alerts route sidecar security.auth_mode_relevance (cross-reference for the 4-mode wiring)
- security.known_security_gaps.[WithPermissionsProvider does not block] ← see bugs_limitations_corner_cases.[WithPermissionsProvider does not block] sources
- security.known_security_gaps.[/data-modelling/relationships ungated end-to-end] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar
- performance.hot_paths.[dataModellingPath() called once at App mount] ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7 + odd-platform-ui/src/components/App.tsx:74
- performance.resource_allocation ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7
- performance.scaling_characteristics ← odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7 + odd-platform-ui/src/components/App.tsx:74
- upstream_callers.[App.tsx route mount] ← odd-platform-ui/src/components/App.tsx:74
- upstream_callers.[ToolbarTabs reference] ← odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54
- downstream_side_effects.[page-render] ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:6-15 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:13-43

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

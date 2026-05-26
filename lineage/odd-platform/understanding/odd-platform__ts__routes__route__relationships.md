---
node_id: "odd-platform ts routes route:relationships"
node_kind: route
axis: ui_routes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZI-relationships-route
feature_hint: "P-02 Data Modelling — Relationships sub-route. Pairs with ZE (RelationshipController) which has ZERO authz at any layer (no @PreAuthorize, no SECURITY_RULES match for /api/relationships/**, no service check, no owner-scoping). This route is the UI entry point that exposes the un-gated relationship catalog to every authenticated user. Sibling of ZH (dataModelling pillar root) and the queryExamplesRoutes module."
related_features: []
related_pillar_features: ["P-02"]
---

# relationships route — semantic understanding

## understanding

A 7-line module (`odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7`) that exports one path builder: `relationshipsPath()`. The function returns `generatePath('${BASE_PATH}/relationships')` where `BASE_PATH = '/data-modelling'` is imported from the sibling `./dataModelling` module — net result is the literal string `'/data-modelling/relationships'`. The module owns NO rendering, NO auth gate, NO data fetch. The path produced here is consumed at exactly TWO call sites: (a) the in-page tab declaration at `components/DataModelling/DataModellingTabs.tsx:19` (`link: relationshipsPath()`, second tab after Query Examples), and (b) the inner React Router declaration at `components/DataModelling/DataModellingRoutes.tsx:40` which mounts `<Relationships />` at the bare child path `'relationships'` (NOT via `relationshipsPath()` — that file hard-codes the sub-path literal). The route is reached either by clicking the in-page tab from `/data-modelling/query-examples` OR by direct deep-link to `/data-modelling/relationships`; the AppToolbar tab labelled 'Data Modelling' (`ToolbarTabs.tsx:50-54`) sends the user to `queryExamplesPath()` not to relationships, so the relationships URL is exercised by the second click only. Critically — and consistent with the live doc page at `https://docs.opendatadiscovery.org/features/data-modelling` (WebFetched 2026-05-26, status 200) which does NOT specify visibility scoping for Relationships — the route has NO `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:40` (contrast siblings at lines 19-25, 31-37 which wrap Query Examples with `QUERY_EXAMPLE_CREATE` / `QUERY_EXAMPLE_UPDATE+DELETE` contexts). Combined with the ZE finding that RelationshipController has zero authorization at any layer, the URL exposes every relationship in the catalog to every authenticated user (and to every caller at all under `auth.type=DISABLED`). The Relationships component itself (`components/DataModelling/Relationships.tsx:16-84`) reads `?q` (free-text search) and `?type` (ALL/ERD/GRAPH) from `useSearchParams` and forwards both to `useSearchRelationships` which hits `relationshipApi.getRelationships`; the ERD vs GRAPH discrimination is a `type` query-param ping with no client-side filtering. **Statically-visible UI bug**: `components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81` renders the Target column with `dataEntityId={item.sourceDataEntity.id}` (a copy of the Source column) instead of `item.targetDataEntity.id` — the Target column displays Source data for every row.

## concepts

- entities: [
    "`relationshipsPath()` — the only export (`relationshipsRoutes.ts:4-6`); a 1-line wrapper around `react-router-dom.generatePath` that returns the literal `/data-modelling/relationships`",
    "`BASE_PATH` — imported from `./dataModelling` (line 2); the cross-file shared constant `/data-modelling` that the entire Data Modelling pillar's URL surface concatenates against. Refactoring the sibling file's `BASE_PATH` cascades to this builder silently with no compile-time warning",
    "**Component-tier consumers** (declared elsewhere, surfaced here for cross-file context): `<Relationships />` lazy-loaded at `DataModellingRoutes.tsx:11` and mounted at `:40`; `<RelationshipsTabs />` at `Relationships/RelationshipsTabs.tsx:6-54` (the ALL/ERD/Graph tab strip); `<RelationshipsSearchInput />` at `Relationships/RelationshipsSearchInput.tsx:5-23` (the `?q` writer); `<RelationshipsListItem />` at `Relationships/RelationshipsListItem.tsx:49-83` (the row renderer with the Target-column bug); `RelationshipsTitle` at `Relationships/RelationshipsTitle.tsx:17-25` (header with the `<NumberFormatted value={total} />` count)",
    "**Query-string state** (held in URL by `react-router-dom`'s `useSearchParams`): `q` (free-text, written by `RelationshipsSearchInput.tsx:9-12`, read by `Relationships.tsx:18`); `type` (ALL/ERD/GRAPH, written by `RelationshipsTabs.tsx:34-43`, read by `Relationships.tsx:19`). Both default to ALL/empty-string when absent",
    "**Backend boundary**: `useSearchRelationships` at `lib/hooks/api/dataModelling/relatioships.ts:20-41` calls `relationshipApi.getRelationships({query, size, type, page})` with hard-coded `size: 30` (`Relationships.tsx:23`). The hook uses `useInfiniteQuery` from `@tanstack/react-query`; pagination via `pageParam` + `getNextPageParam: lastPage => lastPage.pageInfo.nextPage`",
    "`RelationshipsType` enum (ERD / GRAPH / ALL) — declared OpenAPI-side at `components.yaml:4193-4198` (verified by Read); the UI enum is generated and imported from `'generated-sources'` (`Relationships.tsx:6`, `RelationshipsTabs.tsx:2`)"
  ]
- operations: [
    "**Build the `/data-modelling/relationships` URL** — `relationshipsPath()` at lines 4-6; called from `DataModellingTabs.tsx:19` to make the in-page tab `link` and from no other site (the React Router mount at `DataModellingRoutes.tsx:40` hard-codes the bare sub-path string `'relationships'`)",
    "**Provide the URL constant to the Data Modelling tab strip** — the sole runtime purpose of the export; refactoring the path requires updating both this file and `DataModellingRoutes.tsx:40` (the inner Routes literal is NOT derived from this builder)"
  ]
- invariants: [
    "**`relationshipsPath()` is parameterless** — returns the literal `/data-modelling/relationships` unconditionally. There is no `:relationshipId` segment in the route; the per-relationship detail pages live OUTSIDE the `/data-modelling` subtree (per `RelationshipController` sidecar's `concepts.operations`, the detail endpoints are `GET /api/relationships/erd/{relationship_id}` and `/graph/{relationship_id}` — these are API endpoints; the UI navigates to `/dataentities/{id}/overview` via `RelationshipsListItem.tsx:52` `dataEntityDetailsPath(item.id)` for the per-relationship view, NOT to a separate Data Modelling detail URL)",
    "**The route module is decoupled from the inner Routes string literal** — `DataModellingRoutes.tsx:40` declares `<Route path='relationships' element={<Relationships />} />` with the bare sub-path hard-coded; changing `relationshipsRoutes.ts` to return a different sub-path (e.g. via concatenation with `'/relations'`) silently breaks the toolbar tab link without breaking the mount. The two strings MUST stay in sync; nothing enforces this",
    "**No `WithPermissionsProvider` wrapper** at `DataModellingRoutes.tsx:40` — the Relationships route is the only inner route of the Data Modelling pillar that is NOT wrapped in a permission context (Query Examples and Query Example details ARE wrapped at lines 19-25, 31-37). Combined with the ZE finding (RelationshipController has zero authz), the entire chain from URL to repository is open to any authenticated caller",
    "**`q` and `type` query parameters are URL-state, not component-state** — every change writes to `setSearchParams` (`RelationshipsSearchInput.tsx:10-11`, `RelationshipsTabs.tsx:38-41`) which updates the browser URL; a refresh restores the filter state from URL; a deep-link with `?q=foo&type=ERD` lands directly on the filtered view. The route module itself does NOT declare these parameters — they are dynamic and added by the inner components",
    "**Pagination is `size: 30` hard-coded** at `Relationships.tsx:23` — the only PAGE_SIZE constant in the file. There is no URL parameter, no user-configurable control, and no client-side override. The backend honors this via `useInfiniteQuery`'s `pageParam` mechanism (`relatioships.ts:20-41`)",
    "**Search query free-text matches relationship-row external_name** — per ZE sidecar `concepts.invariants.[search query filters relationship-row external_name, NOT source/target entity names]`, the `q` parameter binds to `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase` on the relationship-class data_entity row at `ReactiveDataEntityRelationshipRepositoryImpl.java:69`. The UI label is 'Search relationships' (`RelationshipsSearchInput.tsx:17`), which matches the SQL behaviour — name and behaviour align here (NOT a Category F drift)"
  ]
- audiences: [
    "**Every authenticated user** — the 'Relationships' tab is visible in the Data Modelling Sidebar (`DataModellingTabs.tsx:13-22`, second item after Query Examples) for every authenticated session; the URL `/data-modelling/relationships` is reachable by any auth'd user; no permission discrimination at any layer (route, controller, service, repository). Under `auth.type=DISABLED` the URL is reachable unauthenticated (per ZE sidecar `security.auth_mode_relevance.[DISABLED]`)",
    "**Doc-page silence on visibility**: per the live doc at `https://docs.opendatadiscovery.org/features/data-modelling` (WebFetched 2026-05-26, status 200), the Relationships subsection is described without any RBAC posture (`'entity-to-entity links rendered as ERD diagrams'` — the only Relationships text). Contrast Query Examples which IS described as `'RBAC-gated by QUERY_EXAMPLE_CREATE'` (creation) / `'QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE'` (details/edit). The doc's silence on Relationships permissions is consistent with the code — there are none — but a future maintainer reading the doc cannot tell whether 'view-only' is intentional or a missing requirement"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Modelling pillar UI (`components/DataModelling/DataModelling.tsx`) — the route only makes sense when the parent `<DataModeling>` tree is mounted at `App.tsx:74`",
    "Relationships UI surface (`components/DataModelling/Relationships.tsx`) — the destination of the route",
    "RelationshipsTabs (`components/DataModelling/Relationships/RelationshipsTabs.tsx`) — the in-page strip that drives the `?type` query parameter; without it the URL still works but the user cannot switch ALL/ERD/GRAPH",
    "ZE: RelationshipController (`odd-platform-api/.../controller/RelationshipController.java`) — backend boundary for `GET /api/relationships` calls fired by `useSearchRelationships`. ZE sidecar documents the zero-authz posture this route surfaces"
  ]
- requires-config: []
- requires-runtime: [
    "`react-router-dom` — `generatePath` imported on line 1; same pattern as the sibling `dataModelling.ts` (ZH sidecar `dependencies_semantic.requires-runtime`)",
    "**Import asymmetry vs `alertsRoutes.ts`** — alerts uses plain template-literal concatenation (no `generatePath` import); the dataModelling subtree (this file + `queryExamplesRoutes.ts` + `dataModelling.ts`) uniformly uses `generatePath` even when the path has no parameters. Cross-pillar convention drift, documented in the ZH sidecar `implicit_adrs`"
  ]
- additional_coupling:
  - "Exposed via `routes/dataModelling/index.ts:2` (`export * from './relationshipsRoutes'`) which is in turn re-exported via `routes/index.ts:10` (`export * from './dataModelling'`). Consumers import from `'routes'` (`DataModellingTabs.tsx:5` — `import { queryExamplesPath, relationshipsPath } from 'routes'`), not from the file directly. Refactoring this file's path is safe; renaming `relationshipsPath` breaks the toolbar tab. Same shape as the parent `dataModelling.ts` (ZH sidecar)"
  - "**`BASE_PATH` consumption is silent** — line 2 imports `BASE_PATH` from `./dataModelling`; a typo in the parent file (`'/data-modelling'` → `'/data-modeling'`) silently breaks this builder's output AND the toolbar tab AND every deep-link without any build-time signal. Documented identically in the ZH sidecar (`bugs_limitations_corner_cases.[silent sibling coupling]`)"
  - "**The inner `<Route path='relationships'>` declaration at `DataModellingRoutes.tsx:40` does NOT consume this module** — the literal sub-path string is duplicated, not derived from `relationshipsPath()`. Refactoring `relationshipsPath` to return `/data-modelling/relations` (a typo) would update the toolbar tab href but NOT the mount path; the user would click the tab, navigate to a route that no longer exists, and see the bare `<DataModeling>` shell with no inner content"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`relationshipsPath()` returns the literal `/data-modelling/relationships`"
    test_class: unit
    criticality: LOW
    note: "Trivial pure function; a regression (typo in concatenation) would be caught at first navigation, but a pinning test would catch it at build time. Same shape as the `dataModellingPath()` gap in ZH sidecar."
  - behaviour: "Refactoring `BASE_PATH` cascades silently — no pinning test catches the cross-file dependency"
    test_class: unit
    criticality: LOW
    note: "Same as the parent file's gap. The shared-constant pattern (`implicit_adrs[shared BASE_PATH constant pattern]` in ZH) requires a pinning test per consumer."
  - behaviour: "`?type=ERD` and `?type=GRAPH` translate into backend round-trips with the corresponding `RelationshipsType` enum value AND return distinct row subsets"
    test_class: integration
    criticality: MEDIUM
    note: "The end-to-end shape — tab click writes URL, URL drives backend call, backend returns type-filtered rows — is the load-bearing behaviour for ERD/GRAPH discrimination. No test pins this; covered by emitted P-167 (Block B + C)."
  - behaviour: "**Target column on `RelationshipsListItem.tsx:73-81` renders Source data, not Target data** — the buggy assignment statically visible in the file"
    test_class: integration
    criticality: HIGH
    note: "Pure DOM observation — Source.href == Target.href for every row. P-167 Block D pins this. No regression test would catch this until shipped. The interface field `targetDataEntity` IS available (used correctly by `RelationshipTypes/EntityRelationship.tsx:33-35` and `GraphRelationship.tsx:32-34`); the bug is a copy-paste in the list-item renderer only."
  - behaviour: "Route is reachable by every authenticated user (no `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:40`); under `auth.type=DISABLED` reachable unauthenticated"
    test_class: security
    criticality: MEDIUM
    note: "Same posture as the ActivityController route (P-166 pins for /activity; P-167 Block A pins for /data-modelling/relationships). Read-collaborative intent per the platform-wide pattern."
- test_files: []
- gaps: |
    No unit tests target `relationshipsRoutes.ts`, and no integration tests
    target the `/data-modelling/relationships` route or the
    `RelationshipsListItem` row renderer (confirmed by Grep across
    `odd-platform-ui/src/` for `relationshipsPath` / `RelationshipsListItem`
    in `*.test.*` / `*.spec.*` — zero matches at commit 4ec2b20). The
    most-likely class of regression that the current zero-test posture
    misses is the Target-column copy-paste bug at
    `RelationshipsListItem.tsx:73-81` — the file Reads cleanly in TypeScript
    (`item.sourceDataEntity.id` is type-correct) and the bug is only visible
    as `Source.href == Target.href` at runtime. A single integration test
    asserting `Source !== Target` on a seeded row would catch it. The
    second-most-likely class: a future maintainer refactoring `BASE_PATH`
    in `dataModelling.ts` without updating the duplicated mount-path
    literal at `DataModellingRoutes.tsx:40`.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling/relationships"
    anchor: ""
    rationale: "Most-specific canonical URL for the Relationships sub-feature. Verified live (WebFetched 2026-05-26, status 200). The page explicitly describes the `/data-modelling/relationships` URL, the table columns (Name, Type, Namespace+Datasource, Source, Target), the ALL/ERD/GRAPH tab strip, the search filter, and the 30-row pagination — every claim is aligned with the code I read EXCEPT for the Target-column display (the page describes a `Target entity` column; the code at `RelationshipsListItem.tsx:73-81` renders Source data in that cell — see doc_drift_findings)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      H1: "Relationships Page Overview"
      Verbatim:
        - "The `/data-modelling/relationships` page serves as the central hub
           for viewing entity-to-entity connections"
        - "A table displaying 'Name, Type (ERD or GRAPH), Namespace +
           Datasource, Source entity, Target entity'"
        - "Type filtering via tabs for 'ALL / ERD / GRAPH'"
        - "Search functionality for filtering by name"
        - "Pagination with 30 items per page using infinite scroll"
      Relationship types (verbatim):
        - "ERD (ENTITY_RELATIONSHIP) — 'Foreign-key-style edges between two
           table-class entities'"
        - "GRAPH (GRAPH_RELATIONSHIP) — 'Free-form graph edges between
           graph-store entities (e.g., relationships between nodes in a
           Neo4j database)'"
      Per-entity view (verbatim):
        - "only the relationships in which the current entity participates
           as Parent or Child"
        - "Users can click any row to open the relationship's detail page,
           with routing determined by the relationship type."
  - url: "https://docs.opendatadiscovery.org/features/data-modelling"
    anchor: "Relationships"
    rationale: "Pillar-level page that surfaces Relationships as a subsection. Same fetch as the ZH sidecar (WebFetched 2026-05-26, status 200). Recorded so cross-pillar nav from a maintainer reading the dataModelling sidecar lands on this finer-grained URL."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Relationships description (verbatim):
        - "Relationships — entity-to-entity links rendered as ERD diagrams.
          Covers two relationship classes: ENTITY_RELATIONSHIP
          (foreign-key-style ERD edges) and GRAPH_RELATIONSHIP (free-form
          graph edges)"
      URL surface table (verbatim row): "/data-modelling/relationships —
      Discovered relationships across all data sources"
  - url: "https://docs.opendatadiscovery.org/active-platform-features/relationships"
    anchor: ""
    rationale: "Stale URL convention; verified 404 (WebFetched 2026-05-26). Recorded so orchestrator templates do not accidentally cite the wrong path."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      "Page Not Found"; suggested alternatives include
      `/features/data-modelling/relationships.md`.
- doc_drift_findings:
  - "**Target column doc-vs-code drift (operator-visible UI bug)**: the live doc at `https://docs.opendatadiscovery.org/features/data-modelling/relationships` describes the table as having `'Source entity, Target entity'` columns. The code at `RelationshipsListItem.tsx:73-81` renders the Target cell with `dataEntityId={item.sourceDataEntity.id} name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''} oddrn={item.sourceDataEntity.oddrn || ''}` — identical to the Source cell (lines 64-72). The `item.targetDataEntity` field IS present on the `DataEntityRelationship` interface and IS consumed correctly by sibling components (`RelationshipTypes/EntityRelationship.tsx:33-35`, `RelationshipTypes/GraphRelationship.tsx:32-34`). The bug is a copy-paste in the list-item renderer. The doc is RIGHT; the code is WRONG. Severity HIGH — operator viewing the table sees no Target indication for any row. P-167 Block D pins the runtime observation."
  - "**Doc says 'Type filtering via tabs for ALL / ERD / GRAPH'** — the code at `RelationshipsTabs.tsx:6-23` matches exactly (three tab values from `RelationshipsType.ALL | ERD | GRAPH` per the OpenAPI enum at `components.yaml:4193-4198`). NOT a drift."
  - "**Doc says 'Pagination with 30 items per page using infinite scroll'** — the code at `Relationships.tsx:23` hard-codes `size: 30`. The InfiniteScroll component at `Relationships.tsx:63-77` consumes `useInfiniteQuery`'s next-page callback. NOT a drift; the `30` value is undocumented as a tunable but is doc-consistent."
  - "**Doc is silent on visibility scoping for Relationships** — neither the pillar page nor the per-feature page mentions who can VIEW relationships. The code has no @PreAuthorize, no SECURITY_RULES match, no owner scoping (per ZE sidecar). This is consistent (silent on both sides) but the absence is operator-relevant: a future operator deploying ODD assumes their relationship catalog is gated based on the platform's overall RBAC story (`enable-security/authorization` doc) and is wrong. Route as a doc-gap-finder follow-up rather than a hard drift."
  - "**Doc says 'Users can click any row to open the relationship's detail page, with routing determined by the relationship type'** — the code at `RelationshipsListItem.tsx:52` always navigates to `dataEntityDetailsPath(item.id)` (the data-entity overview page), NOT to a relationship-type-specific detail URL. The two ZE-documented endpoints `/api/relationships/erd/{id}` and `/api/relationships/graph/{id}` are reached by the data-entity overview page's relationship-card rendering (`OverviewRelationshipStats/OverviewRelationshipType/*.tsx`), not by the row click on this list page. The doc's 'routing determined by the relationship type' phrasing is misleading — from THIS list page, every click routes to the same `/dataentities/{id}/overview` URL regardless of type. The TYPE-specific rendering happens INSIDE that overview page. Route as doc-gap-finder follow-up — the doc overstates client-side type discrimination."

## implicit_adrs

- "**The Relationships sub-route does NOT carry a `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:40`** (contrast siblings at lines 19-25, 31-37 which wrap Query Examples). This is the deliberate read-collaborative shape — Relationships are platform-wide metadata that every authenticated user can read; only the write paths are gated (and per ZE there ARE no write paths on RelationshipController — it is read-only). The decision: pillar members can choose to skip the permission wrapper when the underlying controller is read-only and the read posture is collaborative across owners." — evidence: `components/DataModelling/DataModellingRoutes.tsx:40` (bare `element={<Relationships />}`, no `WithPermissionsProvider`) + RelationshipController sidecar `understanding` (zero authz at any layer) — intent_anchor: "(no explicit comment; the pattern is observable across the three DataModellingRoutes children — two wrapped, one not — and the wrapped/unwrapped split aligns with the controller-side write/read split for the three feature surfaces)" — confidence: MEDIUM
- "**The sub-path string `'relationships'` is duplicated between `relationshipsRoutes.ts:5` (concatenated against `BASE_PATH`) and `DataModellingRoutes.tsx:40` (hard-coded `<Route path='relationships'>`).** The decision: the inner Routes declaration uses bare React Router child-path syntax rather than re-importing the path builder. Same pattern is used by `queryExamplesRoutes.ts:30` / `DataModellingRoutes.tsx:18,28`. The intent: keep the inner Routes file independent of the builder module so they can be moved separately." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingRoutes.tsx:40` + `queryExamplesRoutes.ts:30` + `DataModellingRoutes.tsx:18,28` (identical pattern for the sibling) — intent_anchor: "(no explicit comment; the convention is observable across both Data Modelling sub-routes)" — confidence: MEDIUM
- "**Relationships is the SECOND tab in the Data Modelling Sidebar** — Query Examples is the canonical first (per ZH sidecar `implicit_adrs.[Query Examples is canonical first tab]`). The DataModellingTabs order at lines 11-23 puts Query Examples first, Relationships second; the AppToolbar deep-link goes directly to Query Examples; the bare-URL redirect goes to Query Examples. Relationships is reachable ONLY via the secondary in-page tab (or a direct deep-link). The decision: Query Examples is the primary surface, Relationships is the supporting view." — evidence: `DataModellingTabs.tsx:11-23` (tab order) + `DataModellingRoutes.tsx:16` (bare URL redirect target) + `ToolbarTabs.tsx:50-54` (toolbar deep-link target) — intent_anchor: "(no explicit comment; the convention is enforced by three independent code sites converging on the same default)" — confidence: HIGH

## bugs_limitations_corner_cases

- "**HIGH-severity UI bug — Target column displays Source data**: `RelationshipsListItem.tsx:73-81` renders the Target cell with `RelationshipDatasetInfo dataEntityId={item.sourceDataEntity.id} name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''} oddrn={item.sourceDataEntity.oddrn || ''}` — identical to the Source cell at lines 64-72. The `item.targetDataEntity` field IS present on the `DataEntityRelationship` interface (used correctly by sibling components at `elements/Relationships/RelationshipTypes/EntityRelationship.tsx:33-35` and `GraphRelationship.tsx:32-34`). The bug is a copy-paste in the list-item renderer; the user sees the same dataset in both columns for every row. The doc page at `https://docs.opendatadiscovery.org/features/data-modelling/relationships` describes the table as having distinct Source and Target columns — the doc is correct and the code is wrong. **Not a route-module finding per se** but surfaced here because the route this sidecar declares is the URL where the bug becomes operator-visible; route as a `RelationshipsListItem.tsx` follow-up bug on the next maintainer pass. P-167 Block D pins the runtime observation." — evidence: `RelationshipsListItem.tsx:64-81` (Source and Target both reading `item.sourceDataEntity`) + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-05-26, status 200) — severity: HIGH
- "**Zero-authz exposure of the relationship catalog to every authenticated user**: the route at `DataModellingRoutes.tsx:40` is unwrapped (no `WithPermissionsProvider`); the backend at ZE (`RelationshipController`) has no @PreAuthorize, no SECURITY_RULES match for `/api/relationships/**`, no service check, no owner-scoping. Under `LOGIN_FORM | OAUTH2 | LDAP` every authenticated user sees the entire relationship catalog; under `DISABLED` every caller able to reach the application port sees it. This is consistent with the read-collaborative intent (per ZH sidecar `implicit_adrs`), but the absence is undocumented — the operator deploying ODD with RBAC expectations from the `/configuration-and-deployment/enable-security/authorization` doc has no signal that Relationships are exempt. P-167 Block A confirms runtime. Route to doc-gap-finder for an explicit doc statement." — evidence: `DataModellingRoutes.tsx:40` + RelationshipController sidecar `understanding` (zero authz at any layer) + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (silent on visibility) — severity: MEDIUM
- "**`size: 30` is hard-coded at `Relationships.tsx:23`** — no URL parameter, no user-configurable control. A power-user on a large catalog cannot increase page size to reduce scroll fatigue, and a small-catalog operator cannot decrease it for visual density. The 30 matches the documented value, but a runtime-tunable would be more flexible. Cosmetic; same shape as many list pages." — evidence: `components/DataModelling/Relationships.tsx:23` — severity: LOW
- "**Inner Routes literal `'relationships'` is decoupled from `relationshipsPath()`** — `DataModellingRoutes.tsx:40` hard-codes the sub-path; `relationshipsRoutes.ts:5` concatenates it against `BASE_PATH`. Refactoring `relationshipsPath` to return `/data-modelling/relations` (typo) would break the toolbar tab href but NOT the mount path, leaving the user unable to reach the page via the tab while a direct URL still works. Same shape as ZH sidecar's `bugs_limitations_corner_cases.[silent sibling coupling]`." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingRoutes.tsx:40` — severity: LOW
- "**No unit tests** target `relationshipsRoutes.ts` or any module under `routes/dataModelling/`** — confirmed by Grep across `odd-platform-ui/src/` for `relationshipsPath` in `*.test.*` / `*.spec.*` (zero matches at commit 4ec2b20). A typo in the concatenation (`/data-modelling/relationships` → `/data-modelling/relationship`) would not be caught by build or tests; only manual navigation would reveal it. Same shape as ZH sidecar." — evidence: Grep across `odd-platform-ui/src/` for `relationshipsPath` in test/spec files returned no matches — severity: LOW
- "**`generatePath` is a no-op for the parameterless path** — `relationshipsRoutes.ts:5` calls `generatePath('${BASE_PATH}/relationships')` which has no `:param` placeholders. The function returns the input string verbatim; the `import { generatePath }` could be removed and the builder could `return '${BASE_PATH}/relationships'` for identical behaviour. Same shape as ZH sidecar's `bugs_limitations_corner_cases.[generatePath is no-op]`." — evidence: `relationshipsRoutes.ts:1, 4-6` + `react-router-dom` generatePath docs — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "relationshipsPath()"
      promise: "Build the canonical URL for the Relationships sub-feature — returns a string callers use as `Link to` or React Router `path`."
      implementation: "Returns `generatePath('/data-modelling/relationships')` which is identically `'/data-modelling/relationships'` (parameterless generatePath is a passthrough). The function is the URL builder for the bare relationships URL only; deep-links with `?q` or `?type` are appended at the call site by the inner components."
      drift: NONE
      operator_visible_consequence: "n/a — name and implementation match."
      confidence: STATIC-INFERRED
      evidence: "relationshipsRoutes.ts:4-6 + react-router-dom generatePath docs"
    - name: "Relationships (route name + pillar member name)"
      promise: "The URL `/data-modelling/relationships` lands the operator on a page where they can browse the platform's relationship catalog (per the live doc page) — a list of entity-to-entity links with ALL/ERD/GRAPH filter, search, and infinite-scroll pagination."
      implementation: "Lands on `<Relationships />` (`components/DataModelling/Relationships.tsx:16-84`) which renders: H1 title 'Relationships' with total count + free-text search input + ALL/ERD/GRAPH tab strip + table headers (Name, Type, Namespace+Datasource, Source, Target) + InfiniteScroll list of `<RelationshipsListItem>` rows. **The Target column is bugged** (renders Source data per `RelationshipsListItem.tsx:73-81`) — the rest matches the documented promise."
      drift: MINOR
      operator_visible_consequence: "Per `bugs_limitations_corner_cases.[0]`: every row's Target column displays the Source entity. The user has no way to see what each relationship POINTS TO from this list page. Backend correctness is unaffected; the bug is in the row renderer only."
      confidence: STATIC-INFERRED
      evidence: "RelationshipsListItem.tsx:64-81 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-05-26, status 200)"
  orderings:
    - location: "Relationships.tsx:20-24"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "**REFERENCE to ZE (RelationshipController) sidecar `concepts.invariants.[ordering]`**: the backend SQL at `ReactiveDataEntityRelationshipRepositoryImpl.java:77-79` paginates over `data_entity` rows where `entity_class_ids = [DATA_RELATIONSHIP.getId()=9]` ordered by `data_entity.id ASC` with offset = `(page - 1) * size`. This route module does NOT control the ordering — the backend does. The UI does NOT re-sort client-side (the InfiniteScroll component renders rows in the order they arrive from `useInfiniteQuery`)."
          confidence: REFERENCE
          evidence: "odd-platform__java__RelationshipController__controller-class__RelationshipController"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "**REFERENCE** — `data_entity.id` is a PK column, no two rows can share it; no tie-breaker is needed at the data layer. The UI displays rows in arrival order; if the backend returned two pages with overlapping IDs (it does not), the duplicate would render twice — `RelationshipsListItem` is keyed by `item.id` (`Relationships.tsx:72-73`). Backend ordering is monotonic per ZE."
          confidence: REFERENCE
          evidence: "ZE sidecar + Relationships.tsx:72-73 (key={item.id})"
        - q: "Which subset is returned when result-set > page size?"
          a: "Pagination via `useInfiniteQuery`'s `pageParam` mechanism (`relatioships.ts:30-33, 38-39`). Page 1 is the first 30 rows; subsequent pages are fetched on InfiniteScroll trigger (`Relationships.tsx:63-77` — `next={fetchNextPage}` + `scrollThreshold='200px'`). The backend returns `pageInfo.total` + `pageInfo.nextPage`; the UI keeps `data?.pages` accumulating and flattens via `flatMap(page => page.items)` (`Relationships.tsx:26-29`). Zero rows returned without `nextPage` means the catalog is exhausted."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:20-29, 63-77 + relatioships.ts:20-41"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "**No.** The UI does NOT sort client-side — `relationships = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data?.pages])` (`Relationships.tsx:26-29`) preserves backend order. The `?type` filter is the only client-side input that changes the result; the `?q` free-text search is also forwarded backend-side. NO secondary client-side filter / sort / re-bucketing happens between the API response and the rendered table."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:26-29 (useMemo with no sort) + lib/hooks/api/dataModelling/relatioships.ts:20-41 (no client-side post-processing in useSearchRelationships)"
  auth_gates:
    - location: "components/DataModelling/DataModellingRoutes.tsx:40"
      endpoint: "<Route path='relationships' element={<Relationships />} />"
      questions:
        - q: "What does this route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "**Identical behaviour across all four auth modes at the ROUTE layer** (the route is a client-side declaration; auth.type does not branch it). Under `LOGIN_FORM | OAUTH2 | LDAP`, an authenticated session reaches the route, the SPA mounts `<Relationships />`, and `useSearchRelationships` calls `GET /api/relationships?query=&size=30&type=ALL&page=1`. Per ZE sidecar, this backend call succeeds for every authenticated user with no role/permission discrimination — every relationship in the catalog is returned. Under `DISABLED`, an UNAUTHENTICATED caller reaches the SPA bundle, lands on the route, and the backend call ALSO succeeds (per ZE — no SECURITY_RULES match for `/api/relationships/**`, no @PreAuthorize, no service check). Operator-visible: in DISABLED mode the relationship catalog is public to any caller reaching the application port."
          confidence: STATIC-INFERRED
          evidence: "DataModellingRoutes.tsx:40 (no auth wrapper) + RelationshipController sidecar `understanding` + alerts route sidecar `security.auth_mode_relevance` (cross-reference for the 4-mode wiring)"
        - q: "What does an unauthenticated caller see?"
          a: "Under `LOGIN_FORM | OAUTH2 | LDAP`: Spring Security at the resource layer (per ZH sidecar's cross-reference to OAuthSecurityConfiguration.java) redirects to the auth provider BEFORE the SPA bundle is served — the user never reaches the route. Under `DISABLED`: the SPA bundle ships, `<Relationships />` mounts, and the backend list call returns the full catalog. The UI shows the full Relationships page with no auth challenge."
          confidence: STATIC-INFERRED
          evidence: "DataModellingRoutes.tsx:40 + alerts route sidecar security.auth_mode_relevance + RelationshipController sidecar `security.auth_mode_relevance.[DISABLED]`"
        - q: "What does a wrong-role caller see?"
          a: "**No role-based discrimination.** A caller authenticated with NO write permissions (e.g. only DATA_ENTITY_VIEW) still reaches the route, still sees the full table, still can search and switch tabs, still can navigate to any row's data-entity detail page (which has its own gating per `DataEntityController` — out of scope for this sidecar). A caller authenticated with EVERY permission sees identical behaviour. P-167 Block A pins this with a fresh reader-only user; the static prediction is that page H1 renders and row count >= seeded count."
          confidence: PROBE-NEEDED
          evidence: "P-167 (lineage/odd-platform/probes/P-167.yaml — Block A)"
        - q: "Where does the gate live — route, controller annotation, downstream service, or nowhere?"
          a: "**NOWHERE.** (a) Route mount at `App.tsx:74` — `WithPermissionsProvider` is absent (contrast LookupTables at lines 75-87 which DOES wrap). (b) Inner route at `DataModellingRoutes.tsx:40` — bare `element={<Relationships />}`, no wrapper (contrast siblings at lines 19-25, 31-37). (c) Component layer — `Relationships.tsx:16-84` reads URL state and dispatches API calls; no permission checks. (d) Backend controller — `RelationshipController.java` has no @PreAuthorize (per ZE sidecar). (e) SECURITY_RULES table — no entry for `/api/relationships/**` (per ZE sidecar). (f) Service — `RelationshipsServiceImpl` has no permission check (per ZE sidecar). (g) Repository — no owner JOIN, no permission filter (per ZE sidecar). The chain is open end-to-end for every authenticated caller."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:74 + DataModellingRoutes.tsx:40 + components/DataModelling/Relationships.tsx:16-84 + RelationshipController sidecar `understanding` + RelationshipController sidecar `concepts.invariants.[No authorization gate at any layer]`"
  resource_boundaries: []
  request_inputs:
    - location: "Relationships.tsx:17-19"
      input_kind: query-param
      input_name: "q"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`?q` is the conventional shorthand for free-text search query — the operator-facing label on the input field is 'Search relationships' (`RelationshipsSearchInput.tsx:17`). The name promises: filter the rendered relationship list by free-text match against relationship-row display names."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:18 + RelationshipsSearchInput.tsx:17"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded verbatim to `useSearchRelationships({ query, type, size })` at `Relationships.tsx:20-24`; that hook passes `query` to `relationshipApi.getRelationships({query, size, type, page})` at `relatioships.ts:30`. Per ZE sidecar, the backend binds `query` to `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery)` at `ReactiveDataEntityRelationshipRepositoryImpl.java:69` — the SCANNED relationship-class data_entity's external_name, NOT source/target entity names."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:18-24 + relatioships.ts:30 + ZE sidecar `concepts.invariants.[Search query filters relationship-row external_name]`"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "**MATCHES.** Label is 'Search relationships' — backend searches relationship-row name. The input's promise (free-text search by relationship name) aligns with the SQL (LIKE on relationship-row external_name). The UI label does NOT promise to search by source/target entity name; if it did, this would be a Category F drift. Operator-visible alignment: typing 'orders→customers' (a relationship name) returns the matching relationship row; typing 'customers' (an entity name) does NOT return relationships pointing to a customers table (per ZE — only relationship-row external_name is matched)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "RelationshipsSearchInput.tsx:17 + ZE sidecar concepts.invariants.[Search query filters relationship-row external_name]"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "n/a"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "**NONE for `?q`** — the backend does NOT have a sibling search column that would be more aligned with operator intent; relationship-row external_name IS the canonical user-facing identifier for a relationship. The unused-by-search columns are source/target entity names — but the UI label does not promise to search those, so this is not an available-but-unused smell for THIS input."
          confidence: STATIC-INFERRED
          evidence: "ZE sidecar"
      routes_to_finding: "n/a — MATCHES (no drift)"
    - location: "Relationships.tsx:19"
      input_kind: query-param
      input_name: "type"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`?type` is driven by the ALL/ERD/Graph tab strip (`RelationshipsTabs.tsx:6-23`). The tab labels promise: filter the list to only ERD relationships (ENTITY_RELATIONSHIP class) OR only Graph relationships (GRAPH_RELATIONSHIP class) OR ALL types. The name + tab labels promise a CLASS filter on the rendered relationships."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsTabs.tsx:6-23 + Relationships.tsx:19"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Read from URL search params at `Relationships.tsx:19` and cast to `RelationshipsType` enum (default ALL). Forwarded to `useSearchRelationships({ query, type, size })` at line 23 → `relationshipApi.getRelationships({query, size, type, page})` at `relatioships.ts:31` → backend `RelationshipController.getRelationships(page, size, type, query, exchange)` per ZE → `relationshipsService.getRelationships(page, size, type, query)` → repository filters per ZE."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:19-24 + relatioships.ts:31 + ZE sidecar `concepts.operations.[getRelationships]`"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "**MATCHES.** The enum values ERD / GRAPH / ALL at `components.yaml:4193-4198` align with the tab labels at `RelationshipsTabs.tsx:9-21` (`name: 'All'`, `name: 'ERD'`, `name: 'Graph'` mapped to `RelationshipsType.ALL | ERD | GRAPH`). The backend filtering by type is class-id based per ZE — ERD/GRAPH are two narrowings of the DATA_RELATIONSHIP entity class. P-167 Block B and Block C pin the runtime confirmation that URL → backend round-trip → distinct row subsets."
          drift: NONE
          confidence: PROBE-NEEDED
          evidence: "P-167 Blocks B and C (lineage/odd-platform/probes/P-167.yaml)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES expected."
          confidence: STATIC-INFERRED
          evidence: "n/a"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "**NONE** — `type` is the canonical filter name; no alternative entity field would more closely match the input's name. The `RelationshipsType` enum has exactly the three values the UI exposes."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4193-4198"
      routes_to_finding: "n/a — MATCHES (no drift)"
  probes_emitted:
    - probe_id: P-167
      question: "Does the /data-modelling/relationships route render for a reader-only user with no write permissions; does the ?type tab switch translate into distinct backend calls and distinct row subsets; and does the Target column on RelationshipsListItem render Source data (the statically visible UI bug)?"
      probe_path: "lineage/odd-platform/probes/P-167.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 17
    answers_static_inferred: 13
    answers_probe_needed: 2
    answers_reference: 2
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this module is a TypeScript URL-string export consumed by React Router on the client side; it carries no auth predicates, no fetch calls, and no role/permission checks. The route DESTINATION (`<Relationships />`) is reachable under all four `auth.type` values once the user clears the server-side auth-mode gate (which happens at the Spring Security resource layer before the SPA is served — under DISABLED, the resource layer permits anonymous access per ZE sidecar). The route module itself does not branch under any `auth.type` value. — evidence: `relationshipsRoutes.ts:1-7` (no auth-related imports or branches)
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag only gates `POST /ingestion/entities` server-side. — evidence: `relationshipsRoutes.ts:1-7` (not on ingestion path)
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`. The Relationships sub-feature has no per-owner scoping at any layer (per ZE sidecar `security.owner_scoping`); the route module surfaces an URL whose downstream behavior is owner-blind across the entire chain.
- **data_exposure**: `"The literal string '/data-modelling/relationships' is emitted into the rendered HTML/JS bundle for every authenticated session and discoverable to anyone who can fetch the SPA bundle → no audience restriction at this layer; under auth.type=DISABLED the bundle is reachable unauthenticated. The route's downstream behavior (rendering the full relationship catalog) is documented in ZE sidecar's `security.data_exposure` and is out-of-scope for this route-module file but is the operator-relevant consequence of mounting this URL"`
- **known_security_gaps**:
  - "**The `/data-modelling/relationships` route is ungated end-to-end** — no `WithPermissionsProvider` at the route, no @PreAuthorize on `RelationshipController`, no SECURITY_RULES entry for `/api/relationships/**`, no service check, no owner scoping. Any authenticated user sees every relationship across every data source. Under `auth.type=DISABLED`, any unauthenticated caller reaches the page. The doc page (WebFetched 2026-05-26) is silent on visibility scoping. This is route-relevant because the route is the URL that exposes the un-gated chain to the operator; the broader chain-wide finding lives in the ZE sidecar." — evidence: `DataModellingRoutes.tsx:40` + RelationshipController sidecar `security.known_security_gaps` — severity: LOW (the gap is intentional per platform-wide read-collaborative posture; the absence of doc-side disclosure is the operator-relevant part)

## performance

- **hot_paths**:
  - "`relationshipsPath()` is invoked at App render time by `DataModellingTabs.tsx:19` (tab declaration, evaluated each time the Sidebar renders) — the function body is `generatePath('${BASE_PATH}/relationships')` with no parameters, returning the literal `/data-modelling/relationships`. The cost is O(1); React Router memoizes the tab strip via the parent's `useMemo` (`DataModellingTabs.tsx:11-23`) so the function is called once per parent re-render at most." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingTabs.tsx:11-23`
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O. Page-load and infinite-scroll throughput characteristics live in the Relationships.tsx + useSearchRelationships sidecars (not this route module).`
- **resource_allocation**: `Trivial — one wrapper function. Bundle-size cost is a few dozen bytes after minification. The 'react-router-dom' import for generatePath is already loaded by every sibling route module.` — evidence: `relationshipsRoutes.ts:1-7`
- **scaling_characteristics**: `Stateless and pure — relationshipsPath is referentially transparent with no closure over mutable state. Called once per component-tree render that needs the URL; the resulting string is interned by React.` — evidence: `relationshipsRoutes.ts:4-6`
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/data-modelling/relationships (in-page tab click)"
  caller_node: "ts react-component:components/DataModelling/DataModellingTabs.tsx:19"
  multiplicity_per_trigger: 1
  evidence: "DataModellingTabs.tsx:19 — `{ name: t('Relationships'), link: relationshipsPath() }`. `relationshipsPath()` is invoked once per useMemo evaluation; React Router uses the returned string as the tab `link`. Subsequent clicks on the tab fire the React Router navigation but do NOT re-invoke `relationshipsPath()` (the link was computed at memo time)."
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/relationships (direct URL navigation or deep-link)"
  caller_node: "ts react-router:components/DataModelling/DataModellingRoutes.tsx:40"
  multiplicity_per_trigger: 0
  evidence: "DataModellingRoutes.tsx:40 — `<Route path='relationships' element={<Relationships />} />`. The inner Routes file HARD-CODES the sub-path literal 'relationships' rather than importing `relationshipsPath()` and stripping the BASE_PATH prefix. So this route module is NOT involved in the mount-time URL pattern declaration. The route module's only consumer is the toolbar tab `link` attribute. Recorded with multiplicity 0 to make the asymmetry visible — the inner Routes module duplicates the literal."
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "When a user clicks the in-page 'Relationships' tab (which uses `relationshipsPath()` as `link`), React Router navigates to `/data-modelling/relationships`. The mount at `DataModellingRoutes.tsx:40` lazy-loads `<Relationships />` (`DataModellingRoutes.tsx:11`) and renders it inside the `<S.Content>` slot of `<DataModelling>` (`DataModelling.tsx:11-13`). The Relationships component fires `useSearchRelationships({ query: '', type: 'ALL', size: 30 })` on mount (`Relationships.tsx:20-24`), causing a backend round-trip to `GET /api/relationships?query=&size=30&type=ALL&page=1`. The route module itself does NOT cause the fetch — the destination component does — but this is the observable consequence of the URL the route module produces."
  evidence: "DataModellingTabs.tsx:19 + DataModellingRoutes.tsx:40 + DataModelling.tsx:11-13 + Relationships.tsx:20-24 + lib/hooks/api/dataModelling/relatioships.ts:20-41"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships (any deep-link or tab click)"

## sources

- understanding ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7 + odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7 + odd-platform-ui/src/routes/dataModelling/index.ts:1-3 + odd-platform-ui/src/routes/index.ts:10 + odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-45 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:1-32 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:1-84 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:1-57 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:1-85 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:1-25 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTitle.tsx:1-27 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:1-41 + odd-platform-specification/components.yaml:4193-4198 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-05-26, status 200) + RelationshipController sidecar + dataModelling route sidecar
- concepts.entities.[relationshipsPath] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6
- concepts.entities.[BASE_PATH import] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2
- concepts.entities.[component-tier consumers] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:11, 40 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:6-54 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:5-23 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:49-83 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTitle.tsx:17-25
- concepts.entities.[query-string state] ← odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:9-12 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:18 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:34-43
- concepts.entities.[backend boundary] ← odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:23
- concepts.entities.[RelationshipsType enum] ← odd-platform-specification/components.yaml:4193-4198 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:6
- concepts.operations.[build URL] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:19
- concepts.invariants.[parameterless] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:52 (navigates to dataEntityDetailsPath, not to a /data-modelling sub-detail URL)
- concepts.invariants.[route module decoupled from inner Routes literal] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:5 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- concepts.invariants.[no WithPermissionsProvider wrapper] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:19-25, 31-37, 40 + RelationshipController sidecar `understanding`
- concepts.invariants.[q and type are URL-state] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:17-19 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:9-12 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:34-43
- concepts.invariants.[size 30 hard-coded] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:23
- concepts.invariants.[search query free-text matches relationship-row external_name] ← RelationshipController sidecar concepts.invariants + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:17
- concepts.audiences.[every authenticated user] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:13-22 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar
- concepts.audiences.[doc-page silence on visibility] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-05-26, status 200) + WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:11, 40 + odd-platform-ui/src/components/DataModelling/Relationships.tsx + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx + RelationshipController sidecar
- dependencies_semantic.requires-runtime.[react-router-dom] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1
- dependencies_semantic.requires-runtime.[import asymmetry] ← dataModelling route sidecar implicit_adrs.[generatePath uniformly within dataModelling subtree]
- dependencies_semantic.additional_coupling.[exposed via routes/index] ← odd-platform-ui/src/routes/dataModelling/index.ts:2 + odd-platform-ui/src/routes/index.ts:10 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:5
- dependencies_semantic.additional_coupling.[BASE_PATH consumption silent] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2 + dataModelling route sidecar bugs_limitations_corner_cases
- dependencies_semantic.additional_coupling.[inner Route literal not derived] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:5
- tests_coverage_semantic.test_files ← Grep across odd-platform-ui/src/ for `relationshipsPath` and `RelationshipsListItem` in `*.test.*` / `*.spec.*` returned no matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-05-26, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-05-26, status 200)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/relationships (2026-05-26, status 404)
- docs_link_semantic.doc_drift_findings.[Target column bug] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:64-81
- docs_link_semantic.doc_drift_findings.[type tabs match] ← WebFetch + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:6-23 + odd-platform-specification/components.yaml:4193-4198
- docs_link_semantic.doc_drift_findings.[size 30 match] ← WebFetch + odd-platform-ui/src/components/DataModelling/Relationships.tsx:23, 63-77
- docs_link_semantic.doc_drift_findings.[doc silent on visibility scoping] ← WebFetch + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar
- docs_link_semantic.doc_drift_findings.[doc overstates type-specific row-click routing] ← WebFetch + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:52
- implicit_adrs.[no permission wrapper deliberate] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar understanding
- implicit_adrs.[sub-path literal duplicated] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:5 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:30 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:18, 28
- implicit_adrs.[Relationships is second tab] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54
- bugs_limitations_corner_cases.[Target column bug] ← odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:64-81 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships
- bugs_limitations_corner_cases.[zero-authz exposure] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar
- bugs_limitations_corner_cases.[size 30 hard-coded] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:23
- bugs_limitations_corner_cases.[inner Routes literal decoupled] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- bugs_limitations_corner_cases.[no unit tests] ← Grep across odd-platform-ui/src/ for `relationshipsPath` in test/spec files returned no matches
- bugs_limitations_corner_cases.[generatePath no-op] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1, 4-6 + dataModelling route sidecar
- stress_findings.name_behavior_pairs.[relationshipsPath] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6
- stress_findings.name_behavior_pairs.[Relationships pillar member] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:16-84 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:64-81 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships
- stress_findings.orderings ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:20-29, 63-77 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41 + RelationshipController sidecar
- stress_findings.auth_gates ← odd-platform-ui/src/components/App.tsx:74 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:16-84 + RelationshipController sidecar
- stress_findings.request_inputs.[q] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:17-24 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:5-23 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:30 + RelationshipController sidecar
- stress_findings.request_inputs.[type] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:19-24 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:6-54 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:31 + odd-platform-specification/components.yaml:4193-4198 + RelationshipController sidecar
- stress_findings.probes_emitted.[P-167] ← lineage/odd-platform/probes/P-167.yaml
- security.auth_mode_relevance ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7 + RelationshipController sidecar security.auth_mode_relevance
- security.known_security_gaps ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + RelationshipController sidecar
- performance.hot_paths ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23
- upstream_callers.[DataModellingTabs tab link] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:19
- upstream_callers.[DataModellingRoutes mount] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- downstream_side_effects.[page-render] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:19 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + odd-platform-ui/src/components/DataModelling/DataModelling.tsx:11-13 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:20-24 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41

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

---
node_id: "odd-platform ts routes route:relationships"
node_kind: route
axis: ui_routes
extracted_at_commit: abe51417
enriched_at_commit: abe51417
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-12-refresh-relationships-route
feature_hint: "F-037 Data Modelling — Relationships sub-route, refreshed on contrib/CTRIB-006-relationships-hardening @ abe51417 (the #1752 fix, ships 0.28.0). The pre-fix sidecar's Target-column bug, ?type= 400 dead-end, and graph-label swap findings are HISTORICAL at this commit; the read-open posture (no WithPermissionsProvider, no backend authz) is UNCHANGED and deliberate. Pairs with ZE (RelationshipController) and ZH (dataModelling pillar root)."
related_features: ["F-037"]
related_pillar_features: ["P-02"]
---

# relationships route — semantic understanding

## understanding

A 7-line module (`odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7`) exporting one path builder, `relationshipsPath()`, which concatenates the shared `BASE_PATH` (`'/data-modelling'`, imported from the sibling `./dataModelling` module) with `/relationships` through a parameterless — hence pass-through — `generatePath` call, yielding the literal `'/data-modelling/relationships'`. The builder's only runtime consumer is the in-page tab strip (`DataModellingTabs.tsx:19`); the React Router mount hard-codes the bare child literal instead (`DataModellingRoutes.tsx:40`), still WITHOUT a `WithPermissionsProvider` wrapper — the deliberate read-open posture, now stated on the live doc page. The mounted `<Relationships />` page reads `?q` (free-text, relationship-row-name scope) and `?type` (ALL/ERD/GRAPH) from the URL; at HEAD abe51417 (the #1752 hardening, ships 0.28.0) the raw `?type=` value is validated through the new `parseRelationshipsType` (unknown values degrade to the ALL view with the All tab active, instead of propagating to the API as an enum-bind 400 rendered as a dead empty state), the row renderer's Target cell reads `item.targetDataEntity` (the pre-fix copy-paste that mirrored Source into Target is gone), and the backend list applies the catalog default visibility trio (soft-DELETED / exclude_from_search / hollow relationship entities are hidden). The live doc page still describes the 0.27.x behaviour — its Target-column and `?type=` caveats retire on the `release/0.28.0` documentation train (DOC-446, review-ready).

## concepts

- entities: [
    "`relationshipsPath()` — the only export (`relationshipsRoutes.ts:4-6`); a 1-line wrapper around `react-router-dom.generatePath` that returns the literal `/data-modelling/relationships`",
    "`BASE_PATH` — imported from `./dataModelling` (`relationshipsRoutes.ts:2`; declared at `dataModelling.ts:3`); the cross-file shared constant the entire Data Modelling URL surface concatenates against. A typo in the parent file cascades to this builder silently",
    "**Component-tier consumers** (declared elsewhere, surfaced for cross-file context): `<Relationships />` lazy-loaded at `DataModellingRoutes.tsx:11`, mounted at `:40`; `<RelationshipsTabs />` (`Relationships/RelationshipsTabs.tsx:7-55`, the ALL/ERD/Graph strip); `<RelationshipsSearchInput />` (`Relationships/RelationshipsSearchInput.tsx:5-22`, the `?q` writer); `<RelationshipsListItem />` (`Relationships/RelationshipsListItem.tsx:49-83`, the row renderer — Target cell FIXED at this commit); `RelationshipsTitle` (`Relationships/RelationshipsTitle.tsx:17-24`, H1 + `<NumberFormatted value={total} /> relationships overall`)",
    "**`parseRelationshipsType`** (`components/DataModelling/Relationships/parseRelationshipsType.ts:1-9`, NEW at this commit) — membership check of the raw `?type=` string against `Object.values(RelationshipsType)`; non-members (including case variants like `erd`) return `RelationshipsType.ALL`. Consumed by BOTH read paths: `Relationships.tsx:19` (the API-driving read) and `RelationshipsTabs.tsx:29` (the active-tab read), so an unknown deep-link value renders the ALL list WITH the All tab visibly active",
    "**Query-string state** (URL-held via `useSearchParams`): `q` (written by `RelationshipsSearchInput.tsx:8-12`, read by `Relationships.tsx:18`); `type` (written by `RelationshipsTabs.tsx:35-45`, read via the validator at `Relationships.tsx:19`). Both writers use `new URLSearchParams(searchParams)` + `set`, preserving the OTHER parameter across writes — a `?q` search survives a tab switch and vice versa",
    "**Backend boundary**: `useSearchRelationships` (`lib/hooks/api/dataModelling/relatioships.ts:20-41`) calls `relationshipApi.getRelationships({query, size, type, page})` with hard-coded `size: 30` (`Relationships.tsx:23`); `useInfiniteQuery` paginates via `initialPageParam: 1` + `getNextPageParam: lastPage => lastPage.pageInfo.nextPage`, where `nextPage` is derived client-side by `addNextPage` from `ceil(pageInfo.total / size)` (`lib/hooks/api/utils.ts:13-14`)",
    "`RelationshipsType` enum (ERD / GRAPH / ALL) — OpenAPI-declared at `odd-platform-specification/components.yaml:4199-4204` (re-verified this pass); the UI imports the generated enum (`parseRelationshipsType.ts:1`, `RelationshipsTabs.tsx:2`)"
  ]
- operations: [
    "**Build the `/data-modelling/relationships` URL** — `relationshipsPath()` at `relationshipsRoutes.ts:4-6`; called from `DataModellingTabs.tsx:19` (tab `link`) and from no other site (the mount at `DataModellingRoutes.tsx:40` hard-codes the bare sub-path literal)",
    "**Provide the URL constant to the Data Modelling tab strip** — the sole runtime purpose of the export; a path refactor requires updating this file AND `DataModellingRoutes.tsx:40` in lockstep (nothing enforces the sync)"
  ]
- invariants: [
    "**`relationshipsPath()` is parameterless** — returns the literal unconditionally; there is no `:relationshipId` segment. Per-relationship views are reached by the row link to `/dataentities/{id}/overview` (`RelationshipsListItem.tsx:52`, `dataEntityDetailsPath(item.id)` where `item.id` is the relationship-class data_entity's own id), not via a `/data-modelling` detail URL",
    "**The route module is decoupled from the inner Routes literal** — `DataModellingRoutes.tsx:40` declares `<Route path='relationships' ...>` with the sub-path duplicated, not derived from this builder; the two strings drift independently with no build-time signal",
    "**No `WithPermissionsProvider` wrapper** at `DataModellingRoutes.tsx:40` — the only unwrapped child of the Data Modelling pillar (Query Examples wrapped at `:17-26`, details at `:27-39`). Combined with the backend's zero authz (per ZE sidecar; UNCHANGED at this commit — CTRIB-006 scope exclusion `contributor/CTRIB-006.md:343-344` names the read-open posture as deliberate), the chain is open to every authenticated caller",
    "**Unknown `?type=` values cannot reach the API** — both read paths route through `parseRelationshipsType` (`Relationships.tsx:19`, `RelationshipsTabs.tsx:29`), and the WRITE path (`RelationshipsTabs.tsx:37-41`) only writes canonical enum values; the API receives one of ALL/ERD/GRAPH always. The pre-fix bare cast (any string → enum-bind 400 → dead empty state) is historical at this commit",
    "**The list shows only catalog-visible relationship entities** — the repository adds the default trio `HOLLOW = false`, `STATUS != DELETED`, `EXCLUDE_FROM_SEARCH null-or-false` to the listing's conditionList (`ReactiveDataEntityRelationshipRepositoryImpl.java:75-80`, comment cites #1752), and the page total reuses the same conditionList (`:136-138`) so list and badge stay consistent for the visibility dimension",
    "**Pagination is `size: 30` hard-coded** at `Relationships.tsx:23` — no URL parameter, no user control",
    "**`?q` matches the relationship-row external_name only** — `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery)` on the relationship-class row (`ReactiveDataEntityRelationshipRepositoryImpl.java:69-71`), NOT source/target entity names; the UI label 'Search relationships' (`RelationshipsSearchInput.tsx:17`) and the live doc's search-scope caveat both align with the SQL"
  ]
- audiences: [
    "**Every authenticated user** — the 'Relationships' tab renders for every session (`DataModellingTabs.tsx:17-20`); no permission discrimination at any layer; under `auth.type=DISABLED` the URL is reachable unauthenticated. The live doc page NOW STATES this posture explicitly (WebFetched 2026-06-12, status 200, verbatim: 'There is no RBAC gate on the Relationships endpoints — any authenticated caller can list every relationship in the catalog') — the prior sidecar's 'doc silent on visibility' finding is RESOLVED",
    "**Doc readers get the 0.27.x picture until 0.28.0 publishes** — the live page's Target-column and `?type=` caveats describe behaviour that is fixed at this commit; the corrected page rides the `release/0.28.0` documentation train (DOC-446)"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Modelling pillar UI — the parent `<DataModeling>` tree mounts at `App.tsx:80` (`<Route path={`${dataModellingPath()}/*`} ...>`); the line shifted from :74 since the prior pass",
    "Relationships UI surface (`components/DataModelling/Relationships.tsx`) — the destination of the route, including the NEW `parseRelationshipsType` validator module",
    "RelationshipsTabs (`components/DataModelling/Relationships/RelationshipsTabs.tsx`) — drives the `?type` parameter and renders the active tab from the SAME validator",
    "ZE: RelationshipController (`odd-platform-api/.../controller/RelationshipController.java`) — backend boundary for `GET /api/relationships`; the repository beneath it gained the visibility trio at this commit (`ReactiveDataEntityRelationshipRepositoryImpl.java:75-80`)"
  ]
- requires-config: []
- requires-runtime: [
    "`react-router-dom` — `generatePath` imported at `relationshipsRoutes.ts:1`; the dataModelling subtree uniformly uses `generatePath` even for parameterless paths (cross-pillar convention drift vs `alertsRoutes.ts` documented in the ZH sidecar)",
    "`@tanstack/react-query` — the destination page's fetch layer; the app-global `QueryClient` sets only `retry: false` + `refetchOnWindowFocus: false` (`index.tsx:39-43`), no staleTime/gcTime override"
  ]
- additional_coupling:
  - "Exposed via `routes/dataModelling/index.ts:2` (`export * from './relationshipsRoutes'`), re-exported via `routes/index.ts:10`; consumers import from `'routes'` (`DataModellingTabs.tsx:5`)"
  - "**`BASE_PATH` consumption is silent** — `relationshipsRoutes.ts:2`; a typo in `dataModelling.ts:3` breaks this builder's output, the toolbar tab, and every deep-link with no build-time signal (same shape as the ZH sidecar's finding)"
  - "**The inner `<Route path='relationships'>` at `DataModellingRoutes.tsx:40` does NOT consume this module** — the literal is duplicated; a builder-side rename updates the tab href but not the mount, stranding the tab on a dead URL"

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "The global listing hides soft-DELETED, exclude_from_search and hollow relationship entities; the page total shares the condition list; the DTO carries DISTINCT source and target datasets"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImplTest.java:44-72 (Testcontainers, failing-first; javadoc `@validates F-037` / `@regresses PLT-056` at :31-32)"]
  - behaviour: "ERD type filter and name filter keep working on the visibility-filtered listing"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImplTest.java:74-95"]
  - behaviour: "The list page renders the fixed two-column contract — source entity exactly once (Source column), target entity exactly once (Target column)"
    test_class: integration
    test_files: ["integration-tests/e2e/specs/erd-graph-relationships.spec.ts (IT-077 H-002, re-grounded 2026-06-12 from the LSN-029 characterization pin of the pre-fix bug to the regression guard; RED proven vs ODD_SUT=ref:main per integration-tests/protocols/IT-077-erd-graph-relationships.md:82-88)"]
  - behaviour: "Hidden (DELETED / excluded) relationship entities do not render and the H1 total counts only visible rows"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-077-erd-graph-relationships.md:57-58 (step 3) + integration-tests/e2e/specs/erd-graph-relationships.spec.ts"]
  - behaviour: "A mistyped `?type=foo` deep-link degrades to the ALL view — the API request goes out with `type=ALL`, 200s, the row renders, the All tab has `aria-selected=true`"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-077-erd-graph-relationships.md:59-60 (step 4) + integration-tests/e2e/specs/erd-graph-relationships.spec.ts"]
  - behaviour: "The graph-relationship overview labels its endpoints correctly ('Source:' = source dataset, 'Target:' = target dataset)"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-077-erd-graph-relationships.md:61-62 (step 5) — adjacent surface (/dataentities/{id}/overview), recorded here because the pre-fix label swap was part of the same #1752 contract"]
  - behaviour: "Id contract green-locks: the list `id` IS the `{relationship_id}` path param; the payload's `erd_relationship_id` does NOT round-trip (404 USR002)"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-077-erd-graph-relationships.md:63-65 (step 6)"]
- uncovered_behaviours:
  - behaviour: "`relationshipsPath()` returns the literal `/data-modelling/relationships` (build-time pin of the builder + the duplicated mount literal)"
    test_class: unit
    criticality: LOW
    note: "Trivial pure function; a concatenation typo surfaces only at first navigation. Same gap shape as the ZH sidecar."
  - behaviour: "Refactoring `BASE_PATH` cascades silently — no pinning test catches the cross-file dependency"
    test_class: unit
    criticality: LOW
    note: "Same as the parent module's gap."
  - behaviour: "Route renders identically for a reader-only (no write permissions) authenticated user"
    test_class: security
    criticality: MEDIUM
    note: "P-167 Block A remains the open runtime question — IT-077 runs on the odd-minimal stack with AUTH_TYPE=DISABLED, so no per-role render check exists anywhere yet."
  - behaviour: "Type-filtered pagination window semantics: ERD/Graph tab badge total vs listed rows on a mixed-type catalog; infinite-scroll behaviour across an empty type window"
    test_class: integration
    criticality: MEDIUM
    note: "NEW finding this pass (see bugs_limitations_corner_cases) — neither the repo test (asserts row subsets, not totals, for type-filtered calls) nor IT-077 (single-window seed) pins it. P-248 emitted."
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImplTest.java",
    "integration-tests/protocols/IT-077-erd-graph-relationships.md (status: ready; validates F-037, regresses PLT-056)",
    "integration-tests/e2e/specs/erd-graph-relationships.spec.ts",
    "integration-tests/run-log/2026-06-12-IT-077.md (RED-vs-ref:main + GREEN-on-working-tree record)"
  ]
- gaps: |
    The zero-test posture of the prior pass is gone: the #1752 contract (two-column
    render, visibility trio, ?type= fallback, graph labels, id round-trip) is pinned
    by the failing-first repository test plus the re-grounded IT-077 e2e rail. The
    remaining regression classes the current tests would miss: (1) the route-builder /
    mount-literal sync (unit pin absent — a `relationshipsPath` refactor that misses
    `DataModellingRoutes.tsx:40` strands the tab); (2) per-role rendering (every
    existing rail runs AUTH_TYPE=DISABLED; P-167 Block A still pending); (3) the
    type-filtered pagination window class — badge overcount and the possible
    infinite-scroll stall over an empty type window (P-248). In-repo UI unit tests
    for `parseRelationshipsType` do not exist (grep for `parseRelationshipsType` and
    `relationshipsPath` across `odd-platform-ui/src/` in `*.test.*` / `*.spec.*` —
    zero matches at abe51417); the fallback behaviour is covered only via the
    odd-team e2e rail.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling/relationships"
    anchor: ""
    rationale: "Most-specific canonical URL for the Relationships sub-feature. The page now carries DOC-229's six operational caveats — several describe the 0.27.x (pre-fix) behaviour and retire on the 0.28.0 train (see pending_release below)."
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Title: "Relationships". Columns: "Name, Type (ERD or GRAPH), Namespace +
      Datasource, Source entity, Target entity."
      Target-column caveat (verbatim): "The Target column on the Data Modelling →
      Relationships list page shows the SOURCE entity, not the target — every row
      is currently affected." — describes the PRE-fix behaviour; FIXED at abe51417.
      ?type= caveat (verbatim): "The `?type=` URL parameter accepts arbitrary
      strings and silently renders a blank tab." (backend 400, no UI error) —
      PRE-fix; FIXED at abe51417 (validated fallback to ALL).
      RBAC caveat (verbatim): "There is no RBAC gate on the Relationships
      endpoints — any authenticated caller can list every relationship in the
      catalog." — still TRUE at abe51417 (deliberate posture). Its elaboration
      ("Neither GET /api/relationships nor the type-specific detail endpoints
      filter by owner, namespace, or search-exclusion flags ... including those
      on hidden entities") is PARTIALLY stale: the LIST endpoint now hides
      hidden/excluded/deleted entities; owner/namespace openness remains true.
      Id caveat (verbatim): "The `relationship_id` path parameter on the API is
      the relationship's data-entity id, not the `relationships` table primary
      key." — still TRUE; green-locked by IT-077 step 6.
      Search caveat (verbatim): "The search input filters by relationship name
      only — not by source or target entity name." — still TRUE
      (ReactiveDataEntityRelationshipRepositoryImpl.java:69-71).
      Row-click: "Clicking a list-row name link routes to /dataentities/{id}
      (the entity-detail page), not a relationship-specific URL." — matches
      RelationshipsListItem.tsx:52.
  - pending_release: "0.28.0"
    train_ref: "release/0.28.0 (DOC-446, review-ready) documentation/docs/data-modelling/relationships.md"
    rationale: "The 0.28.0 train edit version-anchors/retires the caveats fixed at abe51417 (Target column; ?type= dead-end; the hidden-entities half of the visibility statement) and keeps the still-true ones (routing, search scope, id contract, RBAC posture). Live WebFetch skipped for the train content — GitBook publishes the release at the gate; the live site cannot show it yet. Confidence stays LOW until a post-release enrichment verifies live."
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-modelling"
    anchor: "Relationships"
    rationale: "Pillar-level page surfacing Relationships as a subsection plus the URL-surface table."
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Relationships subsection (verbatim): "entity-to-entity links rendered as ERD
      diagrams. Covers two relationship classes: `ENTITY_RELATIONSHIP`" ...
      "`GRAPH_RELATIONSHIP` (free-form graph edges, e.g. between Neo4j nodes)."
      URL table row (verbatim): "`/data-modelling/relationships` | Relationships
      list — ERD and graph relationships discovered across all data sources."
      RBAC: Query Examples permissions documented (QUERY_EXAMPLE_CREATE / UPDATE /
      DELETE); "no permission model is described for Relationships" at pillar level
      (the per-feature page carries the posture statement).
  - url: "https://docs.opendatadiscovery.org/active-platform-features/relationships"
    anchor: ""
    rationale: "Stale URL convention; verified 404 on the 2026-05-26 pass (NOT re-fetched this pass — kept as a guard so templates do not cite the wrong path)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
- doc_drift_findings:
  - "**Target-column caveat is stale at HEAD (expected, release-gated)**: the live page describes the pre-fix copy-paste bug; `RelationshipsListItem.tsx:73-81` reads `item.targetDataEntity` at abe51417. NOT a docs-main defect — the behaviour ships at 0.28.0 and the corrected page rides the `release/0.28.0` train (DOC-446). A post-release enrichment must confirm the caveat retired live."
  - "**`?type=` caveat is stale at HEAD (expected, release-gated)**: live page says arbitrary strings reach the backend (400, blank tab); at abe51417 `parseRelationshipsType` (`parseRelationshipsType.ts:6-9`) degrades unknown values to ALL with the All tab active (`RelationshipsTabs.tsx:28-31`). Same train routing as above. Note the live page's advice 'omitting the parameter defaults safely to ALL' was true pre-fix and stays true."
  - "**Visibility elaboration is HALF stale at HEAD**: the live page's claim that the endpoints do not filter 'search-exclusion flags ... including those on hidden entities' no longer holds for the LIST endpoint (`ReactiveDataEntityRelationshipRepositoryImpl.java:78-80`); the owner/namespace (RBAC) half remains true and deliberate (CTRIB-006 scope exclusion, `contributor/CTRIB-006.md:343-344`). Detail-endpoint visibility filtering was deliberately NOT added (`contributor/CTRIB-006.md:352-353`), so the detail-endpoint half of the sentence stays accurate. Train-gated split edit per DOC-446."
  - "**Search-scope caveat MATCHES code** — name-only scope confirmed at `:69-71`; deliberately unchanged (D6 exclusion, `contributor/CTRIB-006.md:345-348`). NOT a drift."
  - "**Id-contract caveat MATCHES code and is now green-locked** (IT-077 step 6) and documented in the OpenAPI spec per the IT-077 re-ground notes. NOT a drift."
  - "**RESOLVED since the prior pass**: (a) the live page now documents the read-open RBAC posture explicitly — the prior 'doc silent on visibility scoping' finding is closed; (b) the row-click description now matches the code ('routes to /dataentities/{id} ... not a relationship-specific URL') — the prior 'doc overstates type-specific row-click routing' finding is closed."
  - "**NEW, un-documented at HEAD**: the type-filtered tab's total badge counts BOTH types (see bugs_limitations_corner_cases) — no doc surface mentions it; route to doc-gap-finder only after P-248 settles the runtime half."

## implicit_adrs

- "**Unknown URL filter values degrade to the default view; raw query-param strings never propagate to a typed API parameter.** The NEW `parseRelationshipsType` module carries the intent in a comment: validation-at-the-URL-boundary with a silent fallback to the tab strip's own default, chosen over surfacing an error state." — evidence: `components/DataModelling/Relationships/parseRelationshipsType.ts:3-9` — intent_anchor: "The ?type= search param arrives as a raw string from deep links; an unknown value must degrade to the ALL view (the tab strip's own default) instead of propagating to the API as an enum-bind 400 that renders like an empty catalog (#1752)." — confidence: HIGH
- "**The Relationships sub-route deliberately carries NO `WithPermissionsProvider`** (contrast the two wrapped Query Examples siblings): relationships are read-collaborative catalog metadata; only write paths are gated, and this surface has none. Upgraded from MEDIUM since the prior pass: the posture is now stated on the live doc page AND named as a deliberate scope exclusion in the #1752 fix." — evidence: `components/DataModelling/DataModellingRoutes.tsx:17-26, 27-39 vs :40` + `contributor/CTRIB-006.md:343-344` — intent_anchor: "No RBAC for relationship endpoints (platform-wide read-open posture — the issue's own corrected scope)" (CTRIB-006 scope exclusions) + live doc verbatim "There is no RBAC gate on the Relationships endpoints" (WebFetched 2026-06-12, status 200) — confidence: HIGH
- "**The sub-path string `'relationships'` is duplicated** between `relationshipsRoutes.ts:5` (concatenated against `BASE_PATH`) and `DataModellingRoutes.tsx:40` (bare React Router child path) — the inner Routes file stays independent of the builder module; same convention as the queryExamples sibling (`queryExamplesRoutes.ts:29-38` + `DataModellingRoutes.tsx:18,28`)." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingRoutes.tsx:40` — intent_anchor: "(no explicit comment; the convention is observable across both Data Modelling sub-routes)" — confidence: MEDIUM
- "**Relationships is the SECOND tab of the pillar** — Query Examples is canonical-first: tab order (`DataModellingTabs.tsx:11-23`), the bare-URL redirect (`DataModellingRoutes.tsx:16` → `query-examples`), and the AppToolbar deep-link (`ToolbarTabs.tsx:50-54` → `queryExamplesPath()`) all converge on Query Examples; Relationships is reached by the second click or a deep-link only." — evidence: the three convergent sites listed — intent_anchor: "(no explicit comment; three independent code sites converge on the same default)" — confidence: HIGH

## bugs_limitations_corner_cases

- "**MEDIUM — type-filtered listing paginates BEFORE the type filter and counts WITHOUT it** (NEW finding this pass; pre-existing structure, NOT introduced by the #1752 fix, which added only the visibility trio at `:78-80`). The repository builds `conditionList` from name query + relationship class + visibility only (`ReactiveDataEntityRelationshipRepositoryImpl.java:67-80`); pagination (`ORDER BY data_entity.id ASC`, offset `(page-1)*size`, limit `size`) applies to that homogeneous query (`:85-87`); the ERD/GRAPH narrowing lives ONLY in the subsequent INNER JOIN (`:107-109`); and the page total reuses `conditionList` (`:136-138`), so it never narrows by type. Operator-visible on a mixed-type catalog: (a) the ERD/Graph tab's H1 badge '`N` relationships overall' (`RelationshipsTitle.tsx:21`, fed by `Relationships.tsx:36`) counts BOTH types while the list shows one — and since the `?q` search DOES narrow the badge (`:69-71` is in `conditionList`), the badge narrows with search but not with tab, side by side; (b) a 30-entity id-window containing zero rows of the selected type returns an EMPTY page with `nextPage` still set (`lib/hooks/api/utils.ts:13-14` derives `nextPage` from the un-narrowed total), and whether the infinite scroll keeps fetching when a page appends zero items (dataLength unchanged, nothing scrollable) is runtime-dependent — if it stalls, type rows beyond the empty window are unreachable from the UI while the badge claims they exist. Also applies in miniature to the ALL tab: a class-9 entity with no `relationships` row occupies a window slot and is dropped by the INNER JOIN (`:105-106`). Not among CTRIB-006's deliberate exclusions (`contributor/CTRIB-006.md:341-357`); not pinned by the repo test (type-filtered assertions check row subsets, not totals — `ReactiveDataEntityRelationshipRepositoryImplTest.java:80-86`) nor by IT-077 (single-window seed). P-248 pins both halves." — evidence: `ReactiveDataEntityRelationshipRepositoryImpl.java:67-87, 99-121, 136-138` + `lib/hooks/api/utils.ts:8-20` + `Relationships.tsx:36` + `RelationshipsTitle.tsx:21` — severity: MEDIUM
- "**LOW — read-open exposure of the relationship catalog (documented posture)**: the route at `DataModellingRoutes.tsx:40` is unwrapped; the backend chain has no authz at any layer (per ZE sidecar; deliberately unchanged — `contributor/CTRIB-006.md:343-344`). Downgraded from the prior pass's MEDIUM: the live doc page now states the posture verbatim with a perimeter-isolation mitigation note (WebFetched 2026-06-12), so the operator-signal gap that justified MEDIUM is closed. Residual: the pillar-level page still describes Query Examples permissions without a Relationships counterpart — cosmetic asymmetry." — evidence: `DataModellingRoutes.tsx:40` + ZE sidecar + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-06-12, 200) — severity: LOW
- "**HISTORICAL (fixed at abe51417)** — the prior pass's HIGH-severity Target-column bug (`RelationshipsListItem` rendering `item.sourceDataEntity` in BOTH columns) and the `?type=` enum-bind 400 dead-end and the GraphRelationship Source:/Target: label swap are all FIXED on this branch: Target cell reads `item.targetDataEntity` (`RelationshipsListItem.tsx:73-81`), unknown types degrade via `parseRelationshipsType.ts:6-9`, and each graph endpoint sits under its own label (`GraphRelationship.tsx:28-35` Source over source, `:55-62` Target over target; the ERD sibling labels target as 'Parent:' — `EntityRelationship.tsx:29-36` — which is the ERD parent/child vocabulary, not a swap). Kept as one line so a reader of the prior sidecar version sees the explicit close-out; regression guards: IT-077 H-002 + steps 4-5, repo test." — evidence: the three files at the cited lines, read at abe51417 — severity: LOW (historical)
- "**LOW — `size: 30` hard-coded** at `Relationships.tsx:23` — no URL parameter, no user-configurable control; matches the documented 30-row infinite scroll." — evidence: `Relationships.tsx:23` — severity: LOW
- "**LOW — inner Routes literal decoupled from `relationshipsPath()`** — `DataModellingRoutes.tsx:40` hard-codes the sub-path; a builder-side refactor updates the tab href but not the mount, stranding the tab on a dead URL while a direct deep-link still works." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingRoutes.tsx:40` — severity: LOW
- "**LOW — no in-repo unit tests** target `relationshipsRoutes.ts` or `parseRelationshipsType.ts` — grep for `relationshipsPath` / `parseRelationshipsType` across `odd-platform-ui/src/` in `*.test.*` / `*.spec.*` files returns zero matches at abe51417 (search root named per the absence-claim rule; the odd-team e2e rail covers the fallback behaviour end-to-end but no build-time pin exists in the UI package)." — evidence: Grep across `odd-platform-ui/src/` (glob `*.{test,spec}.{ts,tsx}`) — zero matches — severity: LOW
- "**LOW — `generatePath` is a no-op for this parameterless path** — `relationshipsRoutes.ts:5` has no `:param` placeholders; the import could be dropped for identical behaviour. Convention-consistency choice within the subtree." — evidence: `relationshipsRoutes.ts:1, 4-6` — severity: LOW
- "**Probe-state note**: P-167 (`lineage/odd-platform/probes/P-167.yaml`, still `pending-stress-protocol`) was emitted by the 0.4.0 pass of this sidecar; its Block D pinned the PRE-fix Target-column bug as the hypothesis and is superseded by IT-077 H-002 (the fixed contract, RED-proven vs ref:main); Blocks B/C (?type round-trips) are covered by IT-077 step 4 + the repo test's type-filter assertions. Block A (reader-only render under a permission-bearing auth mode) remains the only live question in that probe." — evidence: lineage/odd-platform/probes/P-167.yaml:6 + integration-tests/protocols/IT-077-erd-graph-relationships.md:82-88 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components/DataModelling/Relationships.tsx:23"
      name: "size (page size passed to useSearchRelationships)"
      value: "30"
      questions:
        - q: "What at N = 0 visible rows? At a single page (total <= 30)?"
          a: "Zero rows + not loading renders EmptyContentPlaceholder (Relationships.tsx:31-34, 76). At total <= 30, addNextPage computes totalPageCount = 1 and nextPage = undefined (utils.ts:13-14) — hasNextPage false, no further fetches."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:31-34, 76 + lib/hooks/api/utils.ts:13-14"
        - q: "What at N > 30 (catalog larger than one window)?"
          a: "InfiniteScroll fires fetchNextPage at scrollThreshold 200px inside the #relationships-list container (Relationships.tsx:63-71); pages accumulate via data.pages flatMap (:26-29). The backend window is offset (page-1)*30, ORDER BY data_entity.id ASC (ReactiveDataEntityRelationshipRepositoryImpl.java:85-87)."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:26-29, 63-71 + ReactiveDataEntityRelationshipRepositoryImpl.java:85-87"
        - q: "What does the operator see at the type-filtered window boundary (a 30-id window devoid of the selected type)?"
          a: "Statically: an empty page with nextPage still set (total is type-blind). Whether the scroll component re-fires next when dataLength is unchanged needs runtime — P-248 (the stall hypothesis: ERD rows beyond an all-GRAPH window unreachable from the UI while the badge claims them)."
          confidence: PROBE-NEEDED
          evidence: "P-248 (lineage/odd-platform/probes/P-248.yaml)"
  name_behavior_pairs:
    - name: "relationshipsPath()"
      promise: "Build the canonical URL for the Relationships sub-feature."
      implementation: "Returns generatePath('/data-modelling/relationships') — a pass-through for the parameterless literal. Deep-link query params (?q, ?type) are appended by the inner components, not this builder."
      drift: NONE
      operator_visible_consequence: "n/a — name and implementation match."
      confidence: STATIC-INFERRED
      evidence: "relationshipsRoutes.ts:4-6"
    - name: "Relationships (route destination / pillar member)"
      promise: "Land on a browsable catalog of entity-to-entity links: 5-column table (Name, Type, Namespace+Datasource, Source, Target), ALL/ERD/GRAPH tabs, name search, 30-row infinite scroll — the live doc's description."
      implementation: "Matches at abe51417: header cells at Relationships.tsx:46-62 (Source :57, Target :60); row renderer binds sourceDataEntity to Source (:64-72) and targetDataEntity to Target (:73-81); tabs (RelationshipsTabs.tsx:8-24); search (RelationshipsSearchInput.tsx); infinite scroll (Relationships.tsx:63-78). The prior pass's MINOR drift (Target cell mirrored Source) is FIXED; regression-guarded by IT-077 H-002."
      drift: NONE
      operator_visible_consequence: "n/a at code level. The LIVE doc still describes the pre-fix bug until the 0.28.0 train publishes — recorded under docs_link_semantic, not as a code drift."
      confidence: STATIC-INFERRED
      evidence: "Relationships.tsx:46-62 + RelationshipsListItem.tsx:64-81 + WebFetch (2026-06-12, 200)"
    - name: "parseRelationshipsType(raw)"
      promise: "Parse the raw ?type= string into a RelationshipsType."
      implementation: "Membership test against Object.values(RelationshipsType); members pass through, everything else (null, 'foo', case variants like 'erd') returns ALL. Parse-with-documented-fallback, intent stated in the module comment (#1752). The degrade is silent by design — a typo'd deep-link renders the full ALL view with the All tab active, no toast."
      drift: NONE
      operator_visible_consequence: "A caller mistyping ?type= sees ALL rows rather than an error — strictly better than the pre-fix dead empty screen; the silent aspect is the documented trade-off."
      confidence: STATIC-INFERRED
      evidence: "parseRelationshipsType.ts:1-9 + RelationshipsTabs.tsx:28-31"
  orderings:
    - location: "Relationships.tsx:20-24 → relatioships.ts:20-41 → ReactiveDataEntityRelationshipRepositoryImpl.java:82-121"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "ORDER BY data_entity.id ASC with offset (page-1)*size, limit size, applied to the homogeneous relationship-class query (conditionList: optional name LIKE + class = {9} + visibility trio) via jooqQueryHelper.paginate (:85-87). The type narrowing is NOT part of the paginated query — it lives in the INNER JOIN on the relationships table (:107-109). First-hand read this pass (the prior pass held this as a REFERENCE to the ZE sidecar)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:67-87, 99-121"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "None needed — data_entity.id is the PK; no two rows share it. The UI renders arrival order, keyed by item.id (Relationships.tsx:72-74)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:87 + Relationships.tsx:72-74"
        - q: "Which subset is returned when result-set > page size?"
          a: "The page-N window = visible relationship-class entities ranked by id ASC, rows (N-1)*30..N*30 — REGARDLESS of type; the type JOIN then drops non-matching rows from the window, so a type-filtered page returns 0..30 rows and an empty page is possible while later windows still hold matches. nextPage derives from ceil(un-narrowed total / 30) client-side (utils.ts:13-14). Whether the UI traverses an empty window is the P-248 runtime question."
          confidence: PROBE-NEEDED
          evidence: "P-248 (lineage/odd-platform/probes/P-248.yaml) + ReactiveDataEntityRelationshipRepositoryImpl.java:85-87, 107-109 + lib/hooks/api/utils.ts:13-14"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No — relationships = data.pages.flatMap(page => page.items) with no sort (Relationships.tsx:26-29); no client-side filtering; ?q and ?type are both forwarded backend-side."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:26-29 + relatioships.ts:20-41"
  auth_gates:
    - location: "components/DataModelling/DataModellingRoutes.tsx:40"
      endpoint: "<Route path='relationships' element={<Relationships />} /> → GET /api/relationships"
      questions:
        - q: "What does this route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical at the route layer (client-side declaration; auth.type does not branch it). Under LOGIN_FORM/OAUTH2/LDAP an authenticated session mounts the page and the backend call succeeds with no role/permission discrimination; under DISABLED an unauthenticated caller gets the same. NEW at abe51417: the rows returned are narrowed by the visibility trio — hidden/deleted/excluded relationship entities no longer appear in ANY mode (a catalog-hygiene filter, not an authz gate)."
          confidence: STATIC-INFERRED
          evidence: "DataModellingRoutes.tsx:40 + ReactiveDataEntityRelationshipRepositoryImpl.java:78-80 + ZE sidecar understanding"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP the Spring Security resource layer challenges before the SPA serves — the route is never reached. Under DISABLED the full page renders with the full (visible) catalog."
          confidence: STATIC-INFERRED
          evidence: "DataModellingRoutes.tsx:40 + ZE sidecar security.auth_mode_relevance"
        - q: "What does a wrong-role caller see?"
          a: "No role discrimination statically; a reader-only user gets the identical page. Runtime confirmation under a permission-bearing auth mode is STILL pending — P-167 Block A (IT-077 runs AUTH_TYPE=DISABLED and cannot answer it)."
          confidence: PROBE-NEEDED
          evidence: "P-167 (lineage/odd-platform/probes/P-167.yaml — Block A; Blocks B/C/D superseded by IT-077 + the repo test)"
        - q: "Where does the gate live — route, controller annotation, downstream service, repository, or nowhere?"
          a: "NOWHERE, unchanged and now doubly documented as deliberate: route unwrapped (DataModellingRoutes.tsx:40, contrast :17-26/:27-39), no @PreAuthorize / SECURITY_RULES / service / repository gate (per ZE sidecar), CTRIB-006 scope exclusion names the read-open posture (contributor/CTRIB-006.md:343-344), and the live doc page states it verbatim (WebFetched 2026-06-12)."
          confidence: STATIC-INFERRED
          evidence: "DataModellingRoutes.tsx:17-40 + ZE sidecar + contributor/CTRIB-006.md:343-344 + WebFetch (2026-06-12, 200)"
  resource_boundaries:
    - location: "lib/hooks/api/dataModelling/relatioships.ts:25-26 (useInfiniteQuery cache) + src/index.tsx:30-48 (app QueryClient)"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No server-side state — the surface is read-only GET. Client-side, react-query deduplicates in-flight fetches per queryKey ['searchRelationships', query, size, type]; two components reading the same key share one request."
          confidence: STATIC-INFERRED
          evidence: "relatioships.ts:25-33"
        - q: "Is the call replay-safe?"
          a: "Yes — pure read; same params return the same page modulo concurrent catalog mutations. No write side effects anywhere on the chain (contrast e.g. the data-entity detail view_count increment)."
          confidence: STATIC-INFERRED
          evidence: "relatioships.ts:20-41 + ReactiveDataEntityRelationshipRepositoryImpl.java:57-139 (SELECT-only)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "The app QueryClient overrides only retry: false and refetchOnWindowFocus: false (index.tsx:39-43); staleTime/gcTime are NOT raised, so tanstack's library defaults govern staleness — observable: switching ?type or ?q changes the queryKey (fresh fetch); returning to a previously-fetched key inside the gc window paints cached pages, then revalidates on remount. Window-focus revalidation is OFF, so a stale list persists across alt-tab until remount or key change."
          confidence: STATIC-INFERRED
          evidence: "src/index.tsx:30-48 + relatioships.ts:25-26"
  request_inputs:
    - location: "Relationships.tsx:17-18 (read) + RelationshipsSearchInput.tsx:8-12 (write)"
      input_kind: query-param
      input_name: "q"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Free-text search; the control's label is 'Search relationships' (RelationshipsSearchInput.tsx:17) — filter the list by relationship name."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsSearchInput.tsx:17 + Relationships.tsx:18"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Relationships.tsx:18 → useSearchRelationships({query,...}) :20-24 → relationshipApi.getRelationships :28-33 → repository binds DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery) on the relationship-class row (ReactiveDataEntityRelationshipRepositoryImpl.java:69-71). First-hand SQL read this pass."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:18-24 + relatioships.ts:28-33 + ReactiveDataEntityRelationshipRepositoryImpl.java:69-71"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the label promises relationship-name search; the SQL matches the relationship-row external_name. It does NOT search source/target entity names — and that boundary is now a DOCUMENTED caveat on the live page (verbatim: 'The search input filters by relationship name only — not by source or target entity name'), plus a deliberate D6 scope exclusion in CTRIB-006."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "RelationshipsSearchInput.tsx:17 + ReactiveDataEntityRelationshipRepositoryImpl.java:69-71 + WebFetch (2026-06-12, 200) + contributor/CTRIB-006.md:345-348"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES; the one foreseeable wrong assumption (searching by an endpoint dataset's name) is pre-empted by the live doc caveat pointing at the dataset detail page's Relationships tab."
          confidence: STATIC-INFERRED
          evidence: "WebFetch (2026-06-12, 200)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE for 'q' — relationship-row external_name IS the user-facing relationship identifier. The unsearched source/target name columns are a scope boundary, not an available-but-unused smell for THIS input name."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:69-71, 110-113"
      routes_to_finding: "n/a — MATCHES (no drift)"
    - location: "Relationships.tsx:19 (read, validated) + RelationshipsTabs.tsx:28-31 (read, validated) + :35-45 (write, canonical values only)"
      input_kind: query-param
      input_name: "type"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter the list to one relationship class — tab labels All / ERD / Graph map to RelationshipsType.ALL | ERD | GRAPH (RelationshipsTabs.tsx:8-24; enum at components.yaml:4199-4204, re-verified this pass)."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsTabs.tsx:8-24 + odd-platform-specification/components.yaml:4199-4204"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Raw string → parseRelationshipsType (Relationships.tsx:19; unknown → ALL) → useSearchRelationships :20-24 → API :28-33 → repository JOIN condition: type == ALL ? noCondition : RELATIONSHIPS.RELATIONSHIP_TYPE.eq(type.getValue()) (ReactiveDataEntityRelationshipRepositoryImpl.java:107-109). NOTE: the narrowing is applied AFTER pagination and is absent from the COUNT — see bugs_limitations_corner_cases + P-248."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:19-24 + parseRelationshipsType.ts:6-9 + ReactiveDataEntityRelationshipRepositoryImpl.java:107-109"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES for row CONTENT (each listed row is of the selected type — pinned by the repo test's ERD assertion and IT-077's e2e round-trip, GREEN on the working-tree SUT per the run-log). The page-level COUNT does NOT honor the type narrowing — recorded as the new MEDIUM finding rather than a Category F drift, because the parameter does filter what it names; it is the total metadata that ignores it."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImplTest.java:80-86 + integration-tests/protocols/IT-077-erd-graph-relationships.md:59-60, 82-88 + ReactiveDataEntityRelationshipRepositoryImpl.java:136-138"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES on row content. The adjacent wrong assumption (the badge total reflects the active tab) is the P-248 finding."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:136-138"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — RELATIONSHIPS.RELATIONSHIP_TYPE is exactly the column the name implies, and it IS used (in the JOIN). The mis-aligned artifact is the COUNT query's conditionList lacking the same predicate."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:107-109 vs :136-138"
      routes_to_finding: "bugs_limitations_corner_cases.[type-filtered pagination/count] (MEDIUM) — not a Category F drift"
  probes_emitted:
    - probe_id: P-248
      question: "On a mixed-type catalog whose first 30-id window is all-GRAPH: does the ERD tab badge claim the un-narrowed total, does page 1 come back empty with nextPage set, and does the UI infinite scroll stall on the empty window (leaving reachable-by-API ERD rows unreachable in the UI)?"
      probe_path: "lineage/odd-platform/probes/P-248.yaml"
    - probe_id: P-167
      question: "(Emitted by the 0.4.0 pass.) Reader-only render under a permission-bearing auth mode — Block A still live; Blocks B/C/D superseded by IT-077 + the repository test at abe51417."
      probe_path: "lineage/odd-platform/probes/P-167.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 27
    answers_static_inferred: 24
    answers_probe_needed: 3
    answers_reference: 0
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — a TypeScript URL-string export consumed client-side; no auth predicates, no fetch, no permission checks in the module. The route DESTINATION is reachable under all four `auth.type` values once the server-side resource layer is cleared (under DISABLED: anonymously). Unchanged at abe51417. — evidence: `relationshipsRoutes.ts:1-7`
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface.` — evidence: `relationshipsRoutes.ts:1-7`
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped.` The downstream chain remains owner-blind end-to-end (per ZE sidecar; CTRIB-006 deliberately excluded RBAC). NEW at this commit: the chain is no longer VISIBILITY-blind — the list hides soft-DELETED/excluded/hollow entities (`ReactiveDataEntityRelationshipRepositoryImpl.java:78-80`) — a hygiene filter, not owner scoping. — evidence: cited lines + `contributor/CTRIB-006.md:343-344`
- **data_exposure**: `"The literal '/data-modelling/relationships' ships in the SPA bundle to every session. The downstream page exposes the relationship catalog to every authenticated caller (anonymous under DISABLED) — NARROWED at abe51417 to catalog-visible entities only: soft-DELETED, exclude_from_search and hollow relationship rows no longer appear in the list (they did at 0.27.x). Detail endpoints deliberately retain DELETED-entity reachability (contributor/CTRIB-006.md:352-353). The posture is now documented on the live page with a perimeter-isolation mitigation."`
- **known_security_gaps**:
  - "**The route is ungated end-to-end for RBAC** — unchanged, deliberate, and now documented on the live doc page (WebFetched 2026-06-12: 'There is no RBAC gate on the Relationships endpoints'). Severity stays LOW: the read-collaborative intent is named in the fix's scope exclusions and disclosed to operators; the residual operator risk is per-team isolation, which the doc routes to the network perimeter." — evidence: `DataModellingRoutes.tsx:40` + `contributor/CTRIB-006.md:343-344` + WebFetch (2026-06-12, 200) — severity: LOW

## performance

- **hot_paths**:
  - "`relationshipsPath()` is invoked at tab-strip memo time (`DataModellingTabs.tsx:11-23`) — O(1) string build, once per parent re-render at most." — evidence: `relationshipsRoutes.ts:4-6` + `DataModellingTabs.tsx:11-23`
  - "Every page fetch on the destination runs TWO queries server-side: the windowed list query AND a full `selectCount` over `conditionList` (`ReactiveDataEntityRelationshipRepositoryImpl.java:136-138`) — the count re-executes per infinite-scroll page, not once per filter change. Pre-existing; cheap at catalog scale, linear in relationship-class rows." — evidence: `ReactiveDataEntityRelationshipRepositoryImpl.java:123-138`
- **throughput_characteristics**: `N/A — declarative URL-shape module; the destination's fetch cadence (30-row windows on scroll) is recorded under stress_findings.orderings.`
- **resource_allocation**: `Trivial — one wrapper function; bundle cost a few dozen bytes; the react-router-dom import is shared with every sibling route module.` — evidence: `relationshipsRoutes.ts:1-7`
- **scaling_characteristics**: `Stateless and pure — referentially transparent, no closure over mutable state.` — evidence: `relationshipsRoutes.ts:4-6`
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/data-modelling/relationships (in-page tab click)"
  caller_node: "ts react-component:components/DataModelling/DataModellingTabs.tsx:19"
  multiplicity_per_trigger: 1
  evidence: "DataModellingTabs.tsx:17-20 — `{ name: t('Relationships'), link: relationshipsPath() }`; invoked once per useMemo evaluation; clicks navigate via the memoised string without re-invoking the builder."
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/relationships (direct URL navigation or deep-link)"
  caller_node: "ts react-router:components/DataModelling/DataModellingRoutes.tsx:40"
  multiplicity_per_trigger: 0
  evidence: "DataModellingRoutes.tsx:40 hard-codes the child literal 'relationships' rather than deriving it from relationshipsPath(); the builder is NOT involved in mount-time pattern matching. Multiplicity 0 keeps the duplication asymmetry visible."
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Navigation to the URL this builder produces mounts lazy-loaded `<Relationships />` inside the pillar shell and fires `GET /api/relationships?query=&size=30&type=ALL&page=1` on mount (empty `q`; `type=ALL` is now the parseRelationshipsType fallback for an absent/unknown param). Each scroll past the threshold fires one further page fetch. The response at abe51417 contains only catalog-visible relationship entities, each row carrying DISTINCT source and target dataset refs rendered in their own columns."
  evidence: "DataModellingTabs.tsx:19 + DataModellingRoutes.tsx:11, 40 + Relationships.tsx:17-24, 63-78 + parseRelationshipsType.ts:6-9 + relatioships.ts:20-41 + ReactiveDataEntityRelationshipRepositoryImpl.java:67-87"
  cardinality_per_call: "1 mount fetch + 0..N scroll fetches per navigation (N bounded by ceil(total/30) - 1)"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships (tab click or deep-link)"

## sources

- frontmatter.extracted_at_commit / enriched_at_commit ← orchestrator-provided HEAD of contrib/CTRIB-006-relationships-hardening (abe51417); no Bash in this subagent, so the commit id is taken from the refresh input rather than `git rev-parse`
- understanding ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7 + odd-platform-ui/src/routes/dataModelling/dataModelling.ts:1-7 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-46 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:1-33 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:1-85 + odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:1-9 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:49-83 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImpl.java:57-139 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-06-12, 200) + backlog/docs/DOC-446.md:3-11
- concepts.entities.[relationshipsPath] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6
- concepts.entities.[BASE_PATH] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:2 + odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3
- concepts.entities.[component-tier consumers] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:11, 40 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:7-55 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:5-22 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:49-83 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTitle.tsx:17-24
- concepts.entities.[parseRelationshipsType] ← odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:1-9 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:14, 19 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:5, 28-31
- concepts.entities.[query-string state] ← odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:8-12 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:17-19 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:35-45
- concepts.entities.[backend boundary] ← odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41 + odd-platform-ui/src/lib/hooks/api/utils.ts:8-20 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:23
- concepts.entities.[RelationshipsType enum] ← odd-platform-specification/components.yaml:4199-4204 (re-verified this pass; the prior cite 4193-4198 is stale)
- concepts.operations ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:19 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- concepts.invariants.[parameterless] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:52
- concepts.invariants.[decoupled literal] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:5 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- concepts.invariants.[no WithPermissionsProvider] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-26, 27-39, 40 + contributor/CTRIB-006.md:343-344
- concepts.invariants.[unknown type cannot reach API] ← odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:6-9 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:19 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTabs.tsx:28-31, 37-41
- concepts.invariants.[visibility trio] ← odd-platform-api/.../repository/reactive/ReactiveDataEntityRelationshipRepositoryImpl.java:75-80, 136-138
- concepts.invariants.[size 30] ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:23
- concepts.invariants.[q scope] ← odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:69-71 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsSearchInput.tsx:17
- concepts.audiences ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:17-20 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-06-12, 200) + backlog/docs/DOC-446.md:3-11
- dependencies_semantic ← odd-platform-ui/src/components/App.tsx:17, 40, 80 + odd-platform-ui/src/routes/dataModelling/index.ts:2 + odd-platform-ui/src/routes/index.ts:10 + odd-platform-ui/src/index.tsx:30-48 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:5
- tests_coverage_semantic.covered ← odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRelationshipRepositoryImplTest.java:18-95 + integration-tests/protocols/IT-077-erd-graph-relationships.md:1-88 + integration-tests/e2e/specs/erd-graph-relationships.spec.ts:1-54
- tests_coverage_semantic.uncovered.[type-window] ← ReactiveDataEntityRelationshipRepositoryImplTest.java:80-86 (type assertions check subsets, not totals) + lineage/odd-platform/probes/P-248.yaml
- tests_coverage_semantic.gaps.[no UI unit tests] ← Grep for `relationshipsPath` / `parseRelationshipsType` across odd-platform-ui/src/ in `*.{test,spec}.{ts,tsx}` — zero matches at abe51417
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/relationships (2026-06-12, status 200)
- docs_link_semantic.inferred_docs.[pending_release] ← backlog/docs/DOC-446.md:3-11 + contributor/CTRIB-006.md:324-335
- docs_link_semantic.inferred_docs.[pillar page] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling (2026-06-12, status 200)
- docs_link_semantic.inferred_docs.[404 guard] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/relationships (2026-05-26 pass, status 404; not re-fetched)
- docs_link_semantic.doc_drift_findings ← the two 2026-06-12 WebFetches + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81 + odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:6-9 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:69-71, 78-80, 136-138 + contributor/CTRIB-006.md:341-357
- implicit_adrs.[validated fallback] ← odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:3-9
- implicit_adrs.[read-open deliberate] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-40 + contributor/CTRIB-006.md:343-344 + WebFetch (2026-06-12, 200)
- implicit_adrs.[duplicated literal] ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:5 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:18, 28, 40 + odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:29-38
- implicit_adrs.[second tab] ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:16 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54
- bugs_limitations_corner_cases.[type-window/count] ← odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:67-87, 99-121, 136-138 + odd-platform-ui/src/lib/hooks/api/utils.ts:8-20 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:36 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsTitle.tsx:21 + contributor/CTRIB-006.md:341-357
- bugs_limitations_corner_cases.[read-open documented] ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40 + WebFetch (2026-06-12, 200) + contributor/CTRIB-006.md:343-344
- bugs_limitations_corner_cases.[historical fixes] ← odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:64-81 + odd-platform-ui/src/components/shared/elements/Relationships/RelationshipTypes/GraphRelationship.tsx:28-35, 55-62 + odd-platform-ui/src/components/shared/elements/Relationships/RelationshipTypes/EntityRelationship.tsx:29-36 + odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:6-9
- bugs_limitations_corner_cases.[P-167 state] ← lineage/odd-platform/probes/P-167.yaml:6 + integration-tests/protocols/IT-077-erd-graph-relationships.md:82-88
- stress_findings.tunables ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:23, 31-34, 63-76 + odd-platform-ui/src/lib/hooks/api/utils.ts:13-14
- stress_findings.name_behavior_pairs ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:46-62 + odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:64-81 + odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:1-9
- stress_findings.orderings ← odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:67-121 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:26-29, 72-74 + odd-platform-ui/src/lib/hooks/api/utils.ts:13-14
- stress_findings.auth_gates ← odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:17-40 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:78-80 + contributor/CTRIB-006.md:343-344
- stress_findings.resource_boundaries ← odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41 + odd-platform-ui/src/index.tsx:30-48
- stress_findings.request_inputs ← odd-platform-ui/src/components/DataModelling/Relationships.tsx:17-24 + odd-platform-ui/src/components/DataModelling/Relationships/parseRelationshipsType.ts:6-9 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:69-71, 107-109, 136-138 + odd-platform-specification/components.yaml:4199-4204
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-248.yaml (written this pass) + lineage/odd-platform/probes/P-167.yaml (0.4.0 pass)
- security ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:1-7 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:78-80 + contributor/CTRIB-006.md:343-353 + WebFetch (2026-06-12, 200)
- performance ← odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts:4-6 + odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:11-23 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:123-138
- upstream_callers ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:17-20 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:40
- downstream_side_effects ← odd-platform-ui/src/components/DataModelling/DataModellingTabs.tsx:19 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:11, 40 + odd-platform-ui/src/components/DataModelling/Relationships.tsx:17-24, 63-78 + odd-platform-ui/src/lib/hooks/api/dataModelling/relatioships.ts:20-41 + odd-platform-api/.../ReactiveDataEntityRelationshipRepositoryImpl.java:67-87

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (live pages re-fetched this session; the 0.28.0 train entry is LOW by rule until post-release verification)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (the new type-window finding is fully static-traced; only its scroll-stall CONSEQUENCE is probe-gated — P-248)
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH (24/27 STATIC-INFERRED; the 3 PROBE-NEEDED items are corner-case multiplicities, not the node's load-bearing claims)

## Maintainer notes

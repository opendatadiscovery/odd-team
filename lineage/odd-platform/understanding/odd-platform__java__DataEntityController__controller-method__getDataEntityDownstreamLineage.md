---
node_id: "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12F-lineage
---

# DataEntityController.getDataEntityDownstreamLineage — semantic understanding

## understanding

Reactive `GET /api/dataentities/{data_entity_id}/lineage/downstream` controller method (DataEntityController.java:255-263). Three-line delegation that hands `dataEntityId`, the client-supplied `lineageDepth`, and the client-supplied `expandedEntityIds` list to `LineageService.getLineage(...)` with `LineageStreamKind.DOWNSTREAM`, lifts the resulting `Mono<DataEntityLineage>` to a `200 OK` response, and returns. The service issues a single Postgres `WITH RECURSIVE` CTE that walks downstream lineage `LineagePojo` rows from the root entity's `oddrn` for `depth` hops (`ReactiveLineageRepositoryImpl.java:122-176`), unioned with a depth-1 fan-out around any IDs in `expandedEntityIds` (`ReactiveLineageRepositoryImpl.java:134-148`), then maps the merged edge set to a `DataEntityLineage` graph DTO. This is the read-side that powers the lineage canvas on the entity-detail screen; its symmetric sibling `getDataEntityUpstreamLineage` (DataEntityController.java:265-273) executes the identical flow with `LineageStreamKind.UPSTREAM`.

## concepts

- entities: [
    `DataEntity` (root from path), `LineagePojo` (parent_oddrn ↔ child_oddrn edges in the `lineage` table), `DataEntityLineage` (response DTO with `root` + `downstream` + `upstream` graph), `LineageDepth` (wrapper carrying recursion-bound `int`), `DataEntityLineageNode`, `DataEntityLineageEdge`, `DataEntityLineageStreamDto`
  ]
- operations: [
    "resolve root entity by id (404 if not found)", "recursively walk lineage edges DOWNSTREAM for `lineageDepth` hops", "fan out a depth-1 set of edges around every `expandedEntityIds` entry", "merge + distinct the two edge sets", "fetch entity + datasource + namespace + group metadata for every oddrn referenced in edges", "compute children-count / parents-count maps", "assemble + map to `DataEntityLineage`"
  ]
- invariants: [
    "Single bulk SQL query for the recursive walk (Postgres `WITH RECURSIVE` CTE; `ReactiveLineageRepositoryImpl.java:126-131`) — NOT a BFS with one DB round-trip per node",
    "Depth termination is `tDepth.lessThan(lineageDepth.getDepth())` inside the CTE (`ReactiveLineageRepositoryImpl.java:174`) — the depth IS the recursion bound, no separate cycle-detection step",
    "Controller method is a pure pass-through — no validation beyond `@Min(1)` on `lineageDepth` from the generated interface, no `@PreAuthorize`, no owner-scoping, no logging",
    "The method returns `200 OK` with a `DataEntityLineage` body on success; `404` only when the root entity does not exist (`LineageServiceImpl.java:93`)"
  ]
- audiences: [
    "ODD Platform UI — the lineage canvas on the data-entity detail page; the UI sets `lineageDepth` and accumulates `expandedEntityIds` as the user expands nodes",
    "Third-party API consumers reading `/api/dataentities/{id}/lineage/downstream` directly (no contract caveat tells them what depth is safe to ask for)"
  ]

## dependencies_semantic

- requires-feature: [
    "data-lineage (live doc `https://docs.opendatadiscovery.org/features/data-lineage`, status 200, 2026-05-12; live API-reference page `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage`, status 200, 2026-05-12) — feature pages frame upstream/downstream lineage as a discoverable graph but do NOT document depth caps, expansion bounds, pagination, or DoS surface; the API-reference page documents `lineage_depth` as 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth' — this is incorrect per code (see doc_drift_findings)",
    "data-entity directory — root entity must exist in `data_entity` table; if not, `NotFoundException` (`LineageServiceImpl.java:93`) lifts to a 404"
  ]
- requires-config: [] — N/A: this method reads no config keys. (Lineage feature flags such as microservices-lineage live elsewhere; this endpoint has no `@Value` / `@ConfigurationProperties` coupling.)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<DataEntityLineage>>` return + injected `ServerWebExchange` (DataEntityController.java:259)",
    "Postgres recursive-CTE support — `DSL.withRecursive(cte)` (`ReactiveLineageRepositoryImpl.java:126`)",
    "jOOQ reactive operations — `jooqReactiveOperations.flux(query)` (`ReactiveLineageRepositoryImpl.java:129`)",
    "`LineageService` Spring bean (`LineageServiceImpl` annotated `@Service`, constructor-injected at DataEntityController.java:76)"
  ]
- couples-to: [
    "`DataEntityApi.getDataEntityDownstreamLineage` (generated from openapi.yaml at `odd-platform-specification/openapi.yaml:1287-1319`) — supplies `@RequestMapping(method=GET, value='/api/dataentities/{data_entity_id}/lineage/downstream', produces='application/json')` and the `@Min(1) @Valid @RequestParam(value='lineage_depth', required=false)` validation",
    "`LineageService.getLineage(long, int, List<Long>, LineageStreamKind)` — signature uses primitive `int` for depth (`LineageService.java:12-14`); the autoboxing of a null `Integer lineageDepth` from the controller into this primitive is the NPE vector described in bugs_limitations_corner_cases",
    "`ReactiveLineageRepositoryImpl.lineageCte(...)` — the single SQL query that anchors all performance/scaling properties of the endpoint (`ReactiveLineageRepositoryImpl.java:150-176`)"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "`LineageServiceTest#getLineageTest` (LineageServiceTest.java:123-174) — unit test with mocked repository: calls `lineageService.getLineage(1L, 1, List.of(), DOWNSTREAM)` and asserts a 3-node / 2-edge graph response; verifies the mapper output shape only"
  ]
- uncovered_behaviours: [
    "No controller-boundary `WebTestClient` test for `GET /api/dataentities/{id}/lineage/downstream` — the controller method itself (DataEntityController.java:255-263) is not exercised at the HTTP layer; nothing verifies the 200 envelope, the validation of `@Min(1)` on `lineage_depth`, or the propagation of `expanded_entity_ids` to the service",
    "No test asserting behaviour when `lineageDepth` is omitted (the null-Integer → primitive-int NPE vector described in bugs_limitations_corner_cases is unexercised)",
    "No test for boundary values of `lineageDepth` (large values, e.g. 10K — does the CTE complete? does the response stay within memory?)",
    "No test for `expandedEntityIds` with a very large list (10K+ IDs — does the SQL `IN (...)` clause stay within Postgres's parameter limit? does the response size stay bounded?)",
    "No test for cyclic-lineage handling — `lineage` rows form a graph that the CTE walks with `UNION ALL` (no DISTINCT-as-fixpoint guard inside the recursion; only an outer `selectDistinct` deduplicates parent/child columns at ReactiveLineageRepositoryImpl.java:127); a cycle would only terminate via the `depth` bound, but the row-count growth before termination is unbounded by structure",
    "No authorization integration test — nothing asserts that an unauthenticated caller is rejected (in non-DISABLED modes) or that the endpoint is unreachable when `auth.type=DISABLED` is properly fenced (it is not — see security.known_security_gaps)",
    "No owner-scoping test — nothing asserts that the returned graph does or does not include data entities the caller has no owner relationship to"
  ]
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LineageServiceTest.java:123-174 (the only test that touches `LineageService.getLineage(...)`)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/LineageRepositoryTest.java (referenced via Glob; not read in this enrichment — listed as a candidate for the test-coverage-mapper to verify)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/LineageMapperTest.java (referenced via Glob; not read in this enrichment)"
  ]
- gaps: |
    The test gap on this method is severe and load-bearing. The single existing test asserts only a happy-path 3-node graph with `depth=1` and an empty `expandedEntityIds`. None of the four production failure modes (null-Integer NPE on missing `lineage_depth`; unbounded recursive-CTE on very large `depth`; oversized `IN (...)` clause on very large `expandedEntityIds`; cyclic-lineage row-count growth) is exercised. A baseline `@WebFluxTest(DataEntityController.class)` suite covering (a) `400 Bad Request` for `lineage_depth=0` (verifies `@Min(1)` triggers in WebFlux's reactive validation pipeline), (b) the omitted-`lineage_depth` case (currently a 500 NPE per code reading), (c) a depth-100 happy path against a fixed graph fixture asserting bounded latency, (d) an `expanded_entity_ids` list of 1000 IDs asserting the query still completes, and (e) an authorization-mode matrix (DISABLED / LOGIN_FORM-unauthenticated / LOGIN_FORM-authenticated) would close every gap surfaced in `bugs_limitations_corner_cases`. The second-order gap is that the per-method test absence is structurally invisible — without `WebTestClient` coverage the contract drift caught by REFACTOR-008 (`/term` vs `/terms`) and the NPE caught here both fail silently in production rather than at CI.

## docs_link_semantic

- declared_docs: []   # No `@docs` annotation in DataEntityController.java
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "Per the live feature page (WebFetched 2026-05-12, status 200) the data-lineage feature documents the upstream/downstream lineage graph that this endpoint backs; the page explicitly refers readers to `/developer-guides/api-reference/lineage` for the API details"
    last_verified_at: "2026-05-12"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page describes 'data-object lineage: catalog entities and connections' and refers readers to the API Reference section: 'Backed by /api/dataentity/{id}/lineage plus the dedicated group-lineage endpoint'. No mention of lineage_depth caps, expanded_entity_ids bounds, or pagination on this page.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
    anchor: ""
    rationale: "Live API-reference page for the lineage endpoints (WebFetched 2026-05-12, status 200); this is the canonical reader-facing description of `lineage_depth` and `expanded_entity_ids` and therefore the page whose accuracy is binding on this method"
    last_verified_at: "2026-05-12"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      lineage_depth: 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth.'
      expanded_entity_ids: 'IDs of `Data Entity Group` entities that should be expanded inline in the response.'
      No server-side caps, pagination, or DoS / performance caveats are documented.
- doc_drift_findings:
  - "Live `/developer-guides/api-reference/lineage` claims `lineage_depth` 'Unset returns the platform's default depth' — code does NOT have a default. When the client omits the parameter, `Integer lineageDepth` is null at DataEntityController.java:257; passing this through `LineageService.getLineage(dataEntityId, lineageDepth, ...)` (DataEntityController.java:261) into the primitive-`int` parameter at `LineageService.java:12` triggers a NullPointerException on autoboxing. The doc is therefore actively misleading: there is no platform default; omitting the parameter is a 500-class request. Severity: MEDIUM (doc-drift, not data loss; but the documented behaviour is unimplementable without code change)."
  - "Live `/developer-guides/api-reference/lineage` describes `expanded_entity_ids` as 'IDs of Data Entity Group entities that should be expanded inline' — code accepts ANY data-entity IDs (the parameter is `List<Long>` typed at DataEntityController.java:258 and reaches `ReactiveLineageRepositoryImpl.getLineageRelationsForDepthOne(rootIds, streamKind)` at ReactiveLineageRepositoryImpl.java:134-148 which joins on `DATA_ENTITY.ID.in(rootIds)` with no group-class filter). The doc's narrowing to 'Data Entity Group entities' is incorrect; the parameter is a general per-entity depth-1 fan-out set. Severity: LOW (the broader behaviour is more permissive than the documented contract; a third-party caller would see 'unexpected' nodes if they passed non-group IDs, but the call would not fail)."
  - "Live `/features/data-lineage` does NOT describe `lineage_depth` or `expanded_entity_ids` at all; readers must follow the API-reference cross-link. For UI-only consumers that's acceptable (the UI sets these parameters); for third-party API consumers the feature page is the discovery surface and silently routes them to the API page that contains the two inaccuracies above. Severity: LOW (this is a coverage gap, not a contradiction)."

## implicit_adrs

- "Single-query recursive-CTE traversal — lineage is walked via Postgres `WITH RECURSIVE` (one DB round-trip), not BFS with one round-trip per node. The CTE is hand-written at `ReactiveLineageRepositoryImpl.lineageCte(...)` and the depth-1 expansion fan-out is a separate query merged downstream (`ReactiveLineageRepositoryImpl.java:134-148`)." — evidence: ReactiveLineageRepositoryImpl.java:122-176 — intent_anchor: `final var cte = lineageCte(rootOddrns, depth, streamKind); final var query = DSL.withRecursive(cte).selectDistinct(...).from(cte.getName());` — confidence: HIGH (single-query is unambiguously the chosen approach; the alternative BFS-per-node would have manifested as N round-trips in the impl and does not)
- "Client-driven progressive expansion model — the endpoint accepts both a recursion-depth (`lineage_depth`) and a separate `expanded_entity_ids` list to fan out one-hop neighbours of selected nodes. The split signals an intentional UI affordance: the canvas asks for a shallow tree by default then asks for one-hop expansions as the user clicks. The `LineageService.getLineage(...)` signature carries both parameters explicitly rather than collapsing them into a single 'effective-depth' input." — evidence: DataEntityController.java:255-262 + LineageService.java:12-14 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-148 — intent_anchor: `final Flux<LineagePojo> lineageRelations = lineageRepository.getLineageRelations(Set.of(root.getDataEntity().getOddrn()), LineageDepth.of(lineageDepth), lineageStreamKind); final Flux<LineagePojo> expandedRelations = lineageRepository.getLineageRelationsForDepthOne(expandedEntityIds, lineageStreamKind); return lineageRelations.mergeWith(expandedRelations).distinct()...` — confidence: HIGH

## bugs_limitations_corner_cases

- "Null-`lineage_depth` NPE: the OpenAPI spec marks `lineage_depth` as `required: false` (openapi.yaml:1294-1300) and the generated interface declares `Integer lineageDepth` (DataEntityApi.java:918), but the service signature requires primitive `int lineageDepth` (LineageService.java:12). When a client omits the parameter, autoboxing of a null `Integer` to `int` at LineageServiceImpl.java:89 throws `NullPointerException`. The live API-reference doc states 'Unset returns the platform's default depth' — there is no default in code; the documented unset behaviour is unimplementable as written." — evidence: DataEntityController.java:256-262 + LineageService.java:11-14 + LineageServiceImpl.java:87-97 + openapi.yaml:1294-1310 — severity: HIGH
- "No server-side `lineage_depth` upper-bound cap: `@Min(1)` enforces a lower bound (DataEntityApi.java:918) but no `@Max(...)` or service-layer ceiling exists. The depth flows directly into the recursive-CTE termination `tDepth.lessThan(lineageDepth.getDepth())` (ReactiveLineageRepositoryImpl.java:174). For a densely-connected lineage graph the CTE row count grows multiplicatively with depth; a client (or third-party caller, or curious operator) can request `lineage_depth=10000` and the query will attempt to enumerate the entire reachable subgraph. The outer query then loads every parent_oddrn + child_oddrn pair into memory (LineageServiceImpl.java:101-108) before fetching per-oddrn metadata. Combined with no controller-method authentication gate beyond `.authenticated()` (see security), an authenticated caller can drive an arbitrarily-expensive query without provoking a rate-limit or timeout signal at the HTTP layer." — evidence: DataEntityApi.java:918 (`@Min(1)` only) + ReactiveLineageRepositoryImpl.java:122-176 (no cap) + LineageServiceImpl.java:87-122 (no cap) + openapi.yaml:1294-1300 (no `maximum`) — severity: HIGH
- "No bound on `expanded_entity_ids` list size: the OpenAPI schema has no `maxItems` (openapi.yaml:1306-1310) and Spring's `@RequestParam List<Long>` accepts arbitrary lengths. The list flows into `ReactiveLineageRepositoryImpl.getLineageRelationsForDepthOne(rootIds, streamKind)` (ReactiveLineageRepositoryImpl.java:134-148) which builds a `DATA_ENTITY.ID.in(rootIds)` clause. Postgres has a 32K-parameter limit on prepared statements; a sufficiently large list (~30K IDs depending on other bound params) will be rejected by the driver with a non-actionable error rather than a controller-level 400." — evidence: openapi.yaml:1301-1310 + DataEntityController.java:258 + ReactiveLineageRepositoryImpl.java:134-148 — severity: MEDIUM
- "No cycle-detection inside the recursive CTE: the CTE body is `UNION ALL` (ReactiveLineageRepositoryImpl.java:168) without a visited-set guard; the only termination is `tDepth.lessThan(lineageDepth.getDepth())`. For a lineage graph with a cycle (e.g. a transformer that consumes its own downstream artefact), row-count growth before depth-termination is unbounded by graph structure and limited only by the depth ceiling — which itself has no upper bound (see above). The outer `selectDistinct` (ReactiveLineageRepositoryImpl.java:127) deduplicates the FINAL result but does not prune the CTE work." — evidence: ReactiveLineageRepositoryImpl.java:163-175 (CTE body: select+selectDistinct+unionAll, no visited-oddrn filter) — severity: MEDIUM
- "No pagination, no streaming, full graph materialised in memory: `LineageServiceImpl.getLineage(...)` calls `.collectList()` on the merged edge Flux (LineageServiceImpl.java:102) and then loads `repositoryMaps + childrenCountMap + parentsCountMap` for every referenced oddrn (LineageServiceImpl.java:106-119) before constructing the response. For a 100K-node downstream subgraph the response holds all 100K `LineageNodeDto`s + edge list + group-relation map in JVM heap simultaneously, then serialises the full payload to the response. There is no `Flux<...>` streaming variant and no `page`+`size` cursor on either parameter." — evidence: LineageServiceImpl.java:87-122 (single Mono assembly, `.collectList()` at 102) + DataEntityController.java:255-263 (no paging parameters) + openapi.yaml:1287-1319 (no page/size parameters) — severity: MEDIUM
- "No owner-scoping on returned graph: the controller method calls `LineageService.getLineage(dataEntityId, depth, expandedEntityIds, DOWNSTREAM)` with no `Authentication`/`Principal` argument (DataEntityController.java:256-262); the service implementation does not consume the reactor `Context` for the current user (LineageServiceImpl.java:87-122) and the repository walk filters only by `LINEAGE.IS_DELETED.isFalse()` (ReactiveLineageRepositoryImpl.java:167, 174). The returned graph therefore contains every data entity reachable via the lineage edges, including entities the caller has no owner relationship to. Combined with REFACTOR-024 (getAllAlerts cross-owner exposure) and REFACTOR-187 (SearchController catalog-wide enumeration), lineage is the **graph-shaped cross-owner enumeration vector**: an authenticated caller can pivot from any one accessible entity to its full reachable subgraph across owner boundaries." — evidence: DataEntityController.java:255-263 (no owner argument) + LineageServiceImpl.java:87-122 (no owner filter) + ReactiveLineageRepositoryImpl.java:122-176 (no owner column in lineage table; filter is `IS_DELETED.isFalse()` only) — severity: HIGH
- "DISABLED-mode bypass — when `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` registers a `SecurityWebFilterChain` that permits every exchange (`anyExchange().permitAll()` at DisabledAuthSecurityConfiguration.java:16); the lineage endpoint is therefore reachable unauthenticated and an external network probe can drive any of the four expensive-query / memory-pressure / cross-owner scenarios above without an account. This is the 8-sidecar DISABLED-mode pattern from REFACTOR-185 surfacing on a lineage-shaped vector — the cross-owner blast radius makes lineage one of the highest-stakes endpoints under DISABLED-mode." — evidence: DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:19-31 (only consulted under non-DISABLED chains) + DataEntityController.java:255-263 (no per-method auth check) — severity: HIGH
- "Outer `selectDistinct` over the CTE deduplicates `(parent_oddrn, child_oddrn)` pairs but the recursive body `UNION ALL` materialises every distinct path from root — diamond-shaped DAGs (B and C both descend to D) produce duplicate intermediate rows during recursion that the final SELECT deduplicates, but the cost has already been paid inside the CTE. For a 10-deep diamond pattern with branching factor 5 this is millions of intermediate rows before the deduplication." — evidence: ReactiveLineageRepositoryImpl.java:126-131 (outer selectDistinct) + ReactiveLineageRepositoryImpl.java:163-175 (inner UNION ALL with no DISTINCT in recursion) — severity: MEDIUM

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED
    - Under LOGIN_FORM / OAUTH2 / LDAP the endpoint falls through to `pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29-30) — any authenticated principal succeeds regardless of role / permission / owner relationship.
    - Under DISABLED (`auth.type=DISABLED`) the chain `DisabledAuthSecurityConfiguration` permits all exchanges (`DisabledAuthSecurityConfiguration.java:16`) — the endpoint is reachable unauthenticated.
- ingestion_filter_relevance: NO — `/api/dataentities/{id}/lineage/downstream` is the UI/API surface, not the `/ingestion/entities` flow; the `IngestionDataEntitiesFilter` and the `auth.ingestion.filter.enabled` switch do not apply.
- authorization_assertions: [] — N/A: the controller method carries no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, no `@Secured` annotation. Authorization is uniformly `.authenticated()` per the AuthorizationCustomizer catch-all (AuthorizationCustomizer.java:29-30). This is the read-collaborative-GET ADR-CANDIDATE-003 posture surfaced on a graph-shaped vector.
- owner_scoping: BYPASSES — the returned lineage graph is not filtered by the caller's owner relationships; the lineage table itself carries no owner column, and `LineageServiceImpl.getLineage(...)` performs no per-row owner check (LineageServiceImpl.java:87-122). An authenticated caller sees every entity reachable from the root via lineage edges, including entities owned by other teams. — evidence: DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176
- data_exposure: [
    "Full downstream lineage subgraph from a single rooted data entity (id, oddrn, internal/external name, entity_classes, datasource, namespace, group_id_list, status, children_count, parents_count for every reachable node + the edge list) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any caller under DISABLED. No owner filter applied at any layer."
  ]
- known_security_gaps: [
    "Graph-shaped cross-owner enumeration: an authenticated caller can pivot from any one accessible entity to its full reachable downstream subgraph, including entities owned by other teams whose names/oddrns/datasource attribution would otherwise not be visible to the caller. This is materially wider than REFACTOR-024 (getAllAlerts) or REFACTOR-187 (SearchController) because lineage edges encode causal connections — leaking the existence of a downstream transformer or consumer can reveal another team's internal pipeline structure even if the team's individual entities are not separately enumerable. — evidence: DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 — severity: HIGH",
    "No `lineage_depth` upper-bound cap combined with no rate-limit on the controller surface: an authenticated caller can drive arbitrarily-expensive recursive-CTE queries by submitting `lineage_depth=10000` against a dense subgraph; combined with the lack of cycle-detection inside the CTE this is a DoS-amplification vector for any caller (including, under DISABLED, any unauthenticated network probe). — evidence: DataEntityApi.java:918 + ReactiveLineageRepositoryImpl.java:122-176 + DisabledAuthSecurityConfiguration.java:9-19 — severity: HIGH",
    "DISABLED-mode reachability: the lineage endpoint is one of the 8-sidecar DISABLED-mode-bypass pattern surfaces (REFACTOR-185). On a default `auth.type=DISABLED` deployment the unauthenticated network surface includes the cross-owner enumeration + DoS-amplification vectors above. — evidence: DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:19-31 — severity: HIGH",
    "Null-`lineage_depth` NPE returns a generic 500 to the caller rather than the documented behaviour ('Unset returns the platform's default depth'); the 500 leaks a server-side exception trace into logs and complicates a third-party caller's error-handling. Doc-drift + error-handling-hole compounded. — evidence: DataEntityController.java:256-262 + LineageService.java:11-14 + LineageServiceImpl.java:87-97 — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "Every lineage-canvas open in the UI issues a `GET /api/dataentities/{id}/lineage/downstream` (and a sibling `/upstream`); each subsequent click on a node to expand re-issues the same endpoint with an updated `expanded_entity_ids` list — DataEntityController.java:255-263 + ReactiveLineageRepositoryImpl.java:122-148",
    "Recursive-CTE query is the highest-DB-cost read on the entity-detail screen; the CTE materialises one row per (depth, parent_oddrn, child_oddrn) tuple inside the recursion — ReactiveLineageRepositoryImpl.java:163-175",
    "Per-oddrn metadata fetch (`getDataEntityWithDatasourceMap`) loads every entity referenced anywhere in the edge set + every group oddrn (LineageServiceImpl.java:106-119); a 10K-edge response triggers a 20K-oddrn metadata fetch in the same Mono assembly"
  ]
- throughput_characteristics: [
    "Single Mono pipeline per request — non-blocking but synchronous-shape from the caller's perspective (one request → one response holding the full graph; no streaming variant)",
    "No batching of multiple lineage requests; each call is a fresh CTE walk + metadata fetch even if the UI is paging through the same entity's expansions"
  ]
- resource_allocation: [
    "Postgres: the recursive CTE materialises intermediate rows in `work_mem`; row count grows up to the product of branching-factor × `lineage_depth`; for diamond-shaped DAGs deduplication happens AFTER recursion (outer `selectDistinct`) — ReactiveLineageRepositoryImpl.java:126-131, 163-175",
    "JVM heap: full `List<LineagePojo>` collected via `.collectList()` (LineageServiceImpl.java:102) + full per-oddrn metadata map + children/parents count maps + assembled `DataEntityLineageStreamDto` all resident before serialisation; no streaming response — LineageServiceImpl.java:87-122",
    "Network: response body size is unbounded in the contract; a 100K-node graph produces a multi-MB JSON payload"
  ]
- scaling_characteristics: [
    "Endpoint is stateless — instances scale horizontally; lineage data is fully in-Postgres",
    "No caching layer — every call re-runs the CTE; identical repeated requests pay the full DB cost",
    "No pagination on the response — the caller cannot ask for 'the first 100 downstream nodes by depth then a next-cursor' — the only way to bound the response is to bound `lineage_depth`, which is a quality-of-result trade-off (the UI sometimes uses depth=1 + repeated `expanded_entity_ids` calls, but third-party consumers have no such pattern documented)",
    "No rate limit on the endpoint — combined with the lack of a `lineage_depth` upper bound and the lack of cycle-detection, a single authenticated caller can saturate Postgres CPU + JVM heap on a small instance"
  ]
- known_performance_gaps: [
    "No upper bound on `lineage_depth` parameter — operators cannot defend a small Postgres instance against a depth=10000 request without an external WAF/reverse-proxy validation rule. — evidence: DataEntityApi.java:918 (`@Min(1)` only) + ReactiveLineageRepositoryImpl.java:122-176 — severity: HIGH",
    "No cap on `expanded_entity_ids` list length — a multi-thousand-ID list hits the Postgres parameter limit before producing a useful error message. — evidence: openapi.yaml:1301-1310 + ReactiveLineageRepositoryImpl.java:134-148 — severity: MEDIUM",
    "Full-graph in-memory materialisation — no streaming response and no pagination cursor; a 100K-node downstream subgraph holds its full edge list + per-node metadata in heap before serialisation. — evidence: LineageServiceImpl.java:101-119 — severity: MEDIUM",
    "No CTE-level cycle guard — recursion deduplicates only at the outer `selectDistinct`; diamond DAGs and true cycles inflate intermediate row counts inside the CTE before final pruning. — evidence: ReactiveLineageRepositoryImpl.java:126-131, 163-175 — severity: MEDIUM",
    "No caching — identical repeated calls re-walk the CTE and re-fetch every entity's metadata. The lineage graph for a given root changes only on lineage-edge ingestion; a short-TTL cache keyed on `(rootOddrn, depth, expandedEntityIds, streamKind)` would absorb most UI-canvas re-opens. — evidence: LineageServiceImpl.java:87-122 + no `@Cacheable` / cache lookup anywhere in the call chain — severity: LOW"
  ]

## sources

- understanding ← DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176
- concepts.entities ← DataEntityController.java:255-263 + LineageDepth.java:1-19 + LineageServiceImpl.java:87-122 + DataEntityApi.java:891-921 + components.yaml `DataEntityLineage` schema (referenced from openapi.yaml:1283)
- concepts.invariants ← DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:126-131, 174 + DataEntityApi.java:918 (`@Min(1)`)
- dependencies_semantic.requires-feature ← WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` (2026-05-12, status 200) + WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (2026-05-12, status 200)
- dependencies_semantic.requires-runtime ← DataEntityController.java:255-263 + ReactiveLineageRepositoryImpl.java:126, 129 + LineageServiceImpl.java:51-58 (@Service)
- dependencies_semantic.couples-to ← DataEntityApi.java:891-921 + openapi.yaml:1287-1319 + LineageService.java:11-14 + LineageServiceImpl.java:87-97 + ReactiveLineageRepositoryImpl.java:150-176
- tests_coverage_semantic.test_files ← LineageServiceTest.java:123-174 + Glob results for LineageRepositoryTest.java + LineageMapperTest.java
- tests_coverage_semantic.uncovered_behaviours ← LineageServiceTest.java:123-174 (single-test inspection — no NPE-case, no large-depth, no large-list, no cyclic-fixture, no controller boundary, no security mode matrix)
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` (2026-05-12, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (2026-05-12, status 200)
- docs_link_semantic.doc_drift_findings.[0] ← DataEntityController.java:256-261 + LineageService.java:12-14 + LineageServiceImpl.java:89 + WebFetch lineage api-reference excerpt 'Unset returns the platform's default depth'
- docs_link_semantic.doc_drift_findings.[1] ← DataEntityController.java:258 + ReactiveLineageRepositoryImpl.java:134-148 + WebFetch lineage api-reference excerpt 'IDs of Data Entity Group entities that should be expanded inline'
- implicit_adrs.[0] ← ReactiveLineageRepositoryImpl.java:122-176 (CTE construction + recursive-CTE call site)
- implicit_adrs.[1] ← DataEntityController.java:255-262 + LineageService.java:12-14 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-148 (two-input split rather than single combined-depth parameter)
- bugs_limitations_corner_cases.[0] ← DataEntityController.java:256-262 + LineageService.java:11-14 + LineageServiceImpl.java:87-97 + openapi.yaml:1294-1310 + DataEntityApi.java:918
- bugs_limitations_corner_cases.[1] ← DataEntityApi.java:918 + openapi.yaml:1294-1300 + ReactiveLineageRepositoryImpl.java:122-176
- bugs_limitations_corner_cases.[2] ← openapi.yaml:1301-1310 + DataEntityController.java:258 + ReactiveLineageRepositoryImpl.java:134-148
- bugs_limitations_corner_cases.[3] ← ReactiveLineageRepositoryImpl.java:126-131, 163-175
- bugs_limitations_corner_cases.[4] ← LineageServiceImpl.java:87-122 (collectList at 102; full materialisation) + DataEntityController.java:255-263 + openapi.yaml:1287-1319
- bugs_limitations_corner_cases.[5] ← DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176
- bugs_limitations_corner_cases.[6] ← DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:19-31 + DataEntityController.java:255-263
- bugs_limitations_corner_cases.[7] ← ReactiveLineageRepositoryImpl.java:126-131, 163-175
- security.auth_mode_relevance ← AuthorizationCustomizer.java:19-31 + DisabledAuthSecurityConfiguration.java:9-19
- security.owner_scoping ← LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176 (no owner column, no owner filter)
- security.known_security_gaps.[0] ← DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176
- security.known_security_gaps.[1] ← DataEntityApi.java:918 + ReactiveLineageRepositoryImpl.java:122-176 + DisabledAuthSecurityConfiguration.java:9-19
- security.known_security_gaps.[2] ← DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:19-31
- security.known_security_gaps.[3] ← DataEntityController.java:256-262 + LineageService.java:11-14 + LineageServiceImpl.java:87-97 + WebFetch api-reference excerpt
- performance.hot_paths ← DataEntityController.java:255-263 + ReactiveLineageRepositoryImpl.java:122-176 + LineageServiceImpl.java:106-119
- performance.resource_allocation ← LineageServiceImpl.java:87-122 (collectList at 102) + ReactiveLineageRepositoryImpl.java:122-176
- performance.scaling_characteristics ← DataEntityController.java:255-263 + LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176
- performance.known_performance_gaps.[0] ← DataEntityApi.java:918 + ReactiveLineageRepositoryImpl.java:122-176
- performance.known_performance_gaps.[1] ← openapi.yaml:1301-1310 + ReactiveLineageRepositoryImpl.java:134-148
- performance.known_performance_gaps.[2] ← LineageServiceImpl.java:101-119
- performance.known_performance_gaps.[3] ← ReactiveLineageRepositoryImpl.java:126-131, 163-175
- performance.known_performance_gaps.[4] ← LineageServiceImpl.java:87-122 (no caching anywhere in call chain)

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

## Maintainer notes

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

- probe_id: P-008
  probe_run_id: R-20260519T015119Z-P-008
  outcome: PASS
  test_class: integration
  feature_id: F-005
  ran_at: 2026-05-19T01:51:19+00:00
  verdict: "all assertions passed"
- probe_id: P-008
  probe_run_id: R-20260519T020322Z-P-008
  outcome: PASS
  test_class: integration
  feature_id: F-005
  ran_at: 2026-05-19T02:03:22+00:00
  verdict: "all assertions passed"
- probe_id: P-008
  probe_run_id: R-20260519T020812Z-P-008
  outcome: PASS
  test_class: integration
  feature_id: F-005
  ran_at: 2026-05-19T02:08:12+00:00
  verdict: "all assertions passed"
- probe_id: P-008
  probe_run_id: R-20260519T021217Z-P-008
  outcome: PASS
  test_class: integration
  feature_id: F-005
  ran_at: 2026-05-19T02:12:17+00:00
  verdict: "all assertions passed"

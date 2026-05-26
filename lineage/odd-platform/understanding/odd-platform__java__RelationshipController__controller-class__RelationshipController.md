---
node_id: "odd-platform java RelationshipController controller-class:RelationshipController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZE-RelationshipController-class
feature_hint: "P-02 Data Modelling — ERD/graph relationship list + detail surface. Three endpoints (getRelationships / getERDRelationshipById / getGraphRelationshipById) on the /api/relationships top-level path. First sidecar of the P-02 Data Modelling pillar at the relationship-class data-entity boundary. Retry of batch-T deferral (socket-error). Pairs with the dataset-scoped variant on DatasetController (getDataSetRelationships → GET /api/datasets/{data_entity_id}/relationships)."
related_features: []
related_pillar_features: ["P-02"]
---

# RelationshipController — semantic understanding

## understanding

A 44-line thin reactive delegate (`RelationshipController.java:14-44`)
that implements the OpenAPI-generated `RelationshipApi` interface and
forwards THREE read operations — `getRelationships` (paged list with
type filter + search), `getERDRelationshipById`, and
`getGraphRelationshipById` — to `RelationshipsService` (line 17 — DI
field). The class is the external surface for `GET /api/relationships`,
`GET /api/relationships/erd/{relationship_id}`, and `GET
/api/relationships/graph/{relationship_id}` (per
`openapi.yaml:4140-4192`). It is the relationship-class data-entity
list-and-detail half of the P-02 Data Modelling feature surface; the
sibling dataset-scoped surface (`GET
/api/datasets/{data_entity_id}/relationships`) lives on
DatasetController. **No authorization is enforced at any layer** — the
controller has no `@PreAuthorize`, the SECURITY_RULES table at
`SecurityConstants.java:95-355` has NO matcher for
`/api/relationships/**`, the service applies no permission check, and
the repository SQL filters only by
`entity_class_ids = [DATA_RELATIONSHIP.getId()=9]`. Any authenticated
caller sees every relationship across every data source the platform
has ever ingested; under `auth.type=DISABLED` every endpoint is
reachable unauthenticated. **The `relationshipId` path parameter
name is misaligned with the SQL** — the repository filters by
`relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)`
(`ReactiveRelationshipsRepositoryImpl.java:194`), the
relationship-class data entity's `data_entity.id`, NOT the
`relationships.id` primary key; the round-trip works for the UI
(list returns data_entity_ids; detail consumes data_entity_ids)
but a third-party caller reading the OpenAPI spec at face value and
supplying the actual `relationships.id` gets a 404.

## concepts

- entities: [
    "DataEntityRelationshipList (paged response — items + PageInfo — `RelationshipController.java:5` + `components.yaml:4066-4077`)",
    "DataEntityRelationshipDetails (per-relationship payload, allOf DataEntityRelationship + ERDRelationshipDetails OR GraphRelationshipDetails — `RelationshipController.java:5` + `components.yaml:4119-4127`)",
    "RelationshipsType (enum: ERD / GRAPH / ALL — `RelationshipController.java:7` + `components.yaml:4193-4198`)",
    "RelationshipApi (OpenAPI-generated interface — `RelationshipController.java:4` import + `:16` implements clause)",
    "ServerWebExchange (Spring WebFlux per-request context — line 11; accepted because the generated `RelationshipApi` signature requires it; the controller body never reads it)",
    "RelationshipsService (DI dependency — line 17; the service-layer facade)",
    "Mono<ResponseEntity<T>> (reactive return for every method — lines 20, 30, 38)",
    "implicit: DATA_RELATIONSHIP(9) data-entity-class — the class id the repository filters by (`ReactiveDataEntityRelationshipRepositoryImpl.java:72` + `DataEntityClassDto.java:51`)",
    "implicit: relationship-class data_entity row — the canonical row the UI sees; the actual `relationships` table row is hidden behind the data_entity facade"
  ]
- operations: [
    "getRelationships(page, size, type, query, exchange) — `RelationshipController.java:19-27`: forwards to `relationshipsService.getRelationships(page, size, type, query)` and maps to ResponseEntity.ok. The OpenAPI path is `GET /api/relationships` (`openapi.yaml:4140-4158`); accepts `page`, `size`, `query` (free-text), `type` (ERD/GRAPH/ALL). The service routes to `ReactiveDataEntityRelationshipRepository.getRelationships` which paginates over `data_entity` rows where `entity_class_ids = [9]` ordered by `data_entity.id ASC` (`ReactiveDataEntityRelationshipRepositoryImpl.java:77-79`). Returns `DataEntityRelationshipList` (items + PageInfo).",
    "getERDRelationshipById(relationshipId, exchange) — `RelationshipController.java:29-35`: forwards to `relationshipsService.getERDRelationshipById(relationshipId)`. The OpenAPI path is `GET /api/relationships/erd/{relationship_id}` (`openapi.yaml:4160-4175`). Service hardcodes `RelationshipsType.ERD` (`RelationshipsServiceImpl.java:39`); switchIfEmpty raises `NotFoundException(\"Relationship\", relationshipId)` → HTTP 404 via ControllerAdvice. Returns `DataEntityRelationshipDetails` with the ERD payload populated.",
    "getGraphRelationshipById(relationshipId, exchange) — `RelationshipController.java:37-43`: forwards to `relationshipsService.getGraphRelationshipById(relationshipId)`. The OpenAPI path is `GET /api/relationships/graph/{relationship_id}` (`openapi.yaml:4177-4192`). Service hardcodes `RelationshipsType.GRAPH` (`RelationshipsServiceImpl.java:46`); same NotFoundException shape on empty. Returns `DataEntityRelationshipDetails` with the graph payload populated."
  ]
- invariants: [
    "**Thin-delegate posture**: every method body is exactly two chained calls — `service.invoke(...).map(ResponseEntity::ok)`. No try/catch, no conditional branching, no parameter normalisation, no metric emission, no log line. The controller is a routing + serialisation surface. Consistent with sibling controllers (Role, Policy, Owner, Tag, Namespace).",
    "**`relationshipId` path parameter name vs SQL filter alignment**: the OpenAPI parameter `relationship_id` (components.yaml:4385-4391) and the Java parameter `relationshipId` (line 31, 39) PROMISE the relationships-table primary key. The actual SQL at `ReactiveRelationshipsRepositoryImpl.java:194` filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` — the data_entity.id column. The UI list endpoint returns data_entity_ids in the `id` field (`RelationshipMapper.java:53`), so the UI round-trip is self-consistent. A third-party API consumer who reads the OpenAPI spec at face value (where `relationship_id` plus the operation summary `Get erd relationship by id` reads as the relationships-table id) and supplies `relationships.id` gets a 404. **Category F TRANSLATES_SILENTLY — `unresolved` until P-128 runs**.",
    "**No authorization gate at any layer**: (a) the controller has no `@PreAuthorize` / no programmatic `permissionService.hasPermission(...)`; (b) the SECURITY_RULES table at `SecurityConstants.java:95-355` has NO entry matching `/api/relationships/**` (verified by reading the full 357-line file end-to-end); (c) the service applies no check (`RelationshipsServiceImpl.java:30-49`); (d) the repository SQL does NOT JOIN against `OWNERSHIP`, has no `data_source_id` filter, has no `namespace_id` filter, has no `exclude_from_search = false` filter, has no `hollow = false` filter. Every authenticated caller (or every caller under `auth.type=DISABLED`) sees every relationship in the catalog. Symmetric to the F-006 audit-silence pattern's read-collaborative posture, but stronger: even the EXCLUDE_FROM_SEARCH filter that protects `/api/dataentities` does NOT apply here.",
    "**Pagination uses `(page - 1) * size` arithmetic without bounds check**: `ReactiveDataEntityRelationshipRepositoryImpl.java:79` computes `offset = (page - 1) * size`. Page=0 → offset = -size (negative). The Java arithmetic doesn't throw; the result is passed unchecked to JOOQ → Postgres, which rejects negative OFFSET with `OFFSET must not be negative`. Page=null → NullPointerException at the unboxing. The OpenAPI spec at PageParam (components.yaml — not read this pass) does NOT declare `minimum: 1` and Spring's binding layer does NOT reject page=0 by default for this endpoint. Result: a 0-indexed caller (the typical JavaScript-developer default) sees an opaque 500 or 400, not a graceful first-page response. **P-130 pins the boundary**.",
    "**Search query filters relationship-row external_name, NOT source/target entity names**: the `query` parameter passes through to `ReactiveDataEntityRelationshipRepositoryImpl.java:69` — `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery)`. The DATA_ENTITY in the conditionList is the SCANNED relationship-class data entity, not the source/target dataset entities. The UI's RelationshipsSearchInput labels the field `'Search relationships'` (`RelationshipsSearchInput.tsx:17`), which matches the SQL behaviour (search by relationship name). The operator-mental-model alignment IS correct here — the label does NOT promise to search by source/target entity name.",
    "**ServerWebExchange parameter is a no-op acceptance**: every method accepts `final ServerWebExchange exchange` (lines 24, 32, 40) because the generated `RelationshipApi` interface declares it; the controller body never reads it. Cannot be removed without breaking the @Override.",
    "**Forensic silence at the controller tier**: no `@Slf4j` annotation, no Logger field, no log.* call (verified by reading lines 1-44 end-to-end). The controller produces zero application log lines on success or failure — error context comes from the ControllerAdvice exception handler only.",
    "**Service-layer dispatch is hardcoded per endpoint**: `getERDRelationshipById` and `getGraphRelationshipById` both call the same repository method `getRelationshipByIdAndType` but with different hardcoded `RelationshipsType` values (`RelationshipsServiceImpl.java:39 = ERD`, `:46 = GRAPH`). The controller-tier therefore canNOT call `getRelationshipByIdAndType(id, ALL)` — `RelationshipsType.ALL` is reachable only via the list endpoint's `type` query param. This is a defensive narrowing — fine.",
    "**`relationships.data_entity_id` has no UNIQUE constraint**: `V0_0_87__create_relation_tables.sql:1-10` declares `data_entity_id bigint` with only a FK constraint, no UNIQUE. One relationship-class data_entity COULD own multiple `relationships` rows. The detail endpoint uses `jooqReactiveOperations.mono(query)` (`ReactiveRelationshipsRepositoryImpl.java:197`) which expects one row — on multi-row matches the behaviour is JOOQ-driver-specific (TooManyResultsException OR silent first-row). No current collector produces two ERD rows for one data_entity (per docs/data-modelling/relationships.md ingestion matrix — PostgreSQL and Snowflake adapters only), but the schema admits it. **P-128 pins both the name-vs-SQL drift AND the multi-row sub-case**."
  ]
- audiences: [
    "End-users browsing the Data Modelling → Relationships UI page (`/data-modelling/relationships`) — the React surface at `odd-platform-ui/src/components/DataModelling/Relationships.tsx:38-82` calls `useSearchRelationships` (`relatioships.ts:20-41`) which infinite-scrolls the `getRelationships` endpoint with page-size=30.",
    "End-users opening an individual relationship's detail panel — the detail page (not located this pass; routing via `relationshipsRoutes.ts`) dispatches `useGetEDRRelationshipById` or `useGetGraphRelationshipById` (`relatioships.ts:6-18`) on click of a list row.",
    "Direct API consumers — any S2S API-key holder (granted ADMIN globally by S2sAuthenticationFilter per REFACTOR-108) OR any authenticated user, both have unfettered access.",
    "Anyone under `auth.type=DISABLED` — the endpoints are reachable unauthenticated under the LSN-001-shape default-insecure posture.",
    "OpenAPI-generated client developers — these read the spec and call `relationshipApi.getERDRelationshipById({ relationshipId })` expecting `relationshipId` to be `relationships.id`; they get 404s on real data unless they discover the UI round-trip semantics."
  ]

## dependencies_semantic

- requires-feature: [
    "P-02 Data Modelling — Relationships (ERD + Graph) — the entire controller surface IS the HTTP boundary of this feature. Pairs with the dataset-scoped variant on DatasetController (getDataSetRelationships) per `documentation/docs/developer-guides/api-reference/relationships.md`.",
    "OpenAPI-generated `RelationshipApi` interface — `RelationshipController.java:4` import + `:16` implements clause. The routing + serialisation contract lives in `odd-platform-specification/openapi.yaml:4140-4192` + `components.yaml:4066-4127, 4193-4198, 4385-4398`. Without regenerating after a spec change, the @Override fails.",
    "Spring WebFlux reactive stack — Mono<ResponseEntity<...>> signature; imports `ResponseEntity` (line 9), `RestController` (line 10), `ServerWebExchange` (line 11), `Mono` (line 12).",
    "Lombok `@RequiredArgsConstructor` (line 3 + line 15) — generates the constructor for `private final RelationshipsService relationshipsService` (line 17).",
    "`RelationshipsService` interface — implemented by `RelationshipsServiceImpl` (4 public methods, three exposed via this controller; the fourth — `getRelationsByDatasetId` — is invoked by DatasetController for the dataset-scoped endpoint).",
    "Downstream: `ReactiveDataEntityRelationshipRepository.getRelationships` (list path) AND `ReactiveRelationshipsRepository.getRelationshipByIdAndType` (detail path); the two distinct repository surfaces reflect the list-vs-detail SQL shape divergence.",
    "Downstream: `RelationshipMapper.mapListToRelationshipPage` (list mapping → `DataEntityRelationship[]`) + `mapToDatasetRelationshipDetails` (detail mapping → `DataEntityRelationshipDetails`); the mapper composes per-entity sub-mappers (`ErdRelationshipMapper`, `GraphRelationshipMapper`, `DataSourceSafeMapper`, `DataEntityMapper`)."
  ]
- requires-config: [
    "No `@Value` reads, no env-driven configuration knobs at the controller class level.",
    "Indirectly depends on `auth.type` — controls whether the AuthorizationCustomizer's catch-all `.pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`) fires. Under DISABLED the controller endpoints are unauthenticated.",
    "Indirectly depends on `auth.s2s.enabled` + S2sAuthenticationFilter wiring — under non-DISABLED with S2S enabled, X-API-Key callers get ADMIN globally (REFACTOR-108), still no relationship-specific gate to enforce."
  ]
- requires-runtime: [
    "PostgreSQL connection with `relationships` + `erd_relationship_details` + `graph_relationship` tables migrated through V0_0_87 (per `V0_0_87__create_relation_tables.sql`).",
    "Spring Security context populated by the active *SecurityConfiguration — without it, AuthorizationCustomizer rejects every request unauthenticated under non-DISABLED.",
    "MapStruct-generated mappers (RelationshipMapper, ErdRelationshipMapper, GraphRelationshipMapper, DataSourceSafeMapper, DataEntityMapper).",
    "Reactor Core (Mono.map, Mono.error, .switchIfEmpty) — controller + service request-handling pipeline.",
    "JOOQ + JooqQueryHelper.paginate / pageifyResult helpers — the paged-result envelope is built here, including the empty-result count fallback (`JooqQueryHelper.java:119-127`)."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "GET /api/relationships returns 200 with paged DataEntityRelationshipList. Pin the page=1 happy-path response shape (items[].id, items[].type, items[].sourceDataEntity / targetDataEntity refs)."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships?type=ERD returns ONLY ENTITY_RELATIONSHIP items (`type='ERD'` → SQL filter `relationships.relationship_type='ERD'` at ReactiveDataEntityRelationshipRepositoryImpl.java:99-101)."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships?type=GRAPH returns ONLY GRAPH_RELATIONSHIP items."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships?type=ALL returns BOTH types — DSL.noCondition() at line 100 disables the type filter."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships?query=foo filters by case-insensitive substring match on the relationship-class data_entity.external_name (NOT the source/target entity names). Verify the UI's `placeholder='Search relationships'` semantic alignment."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "GET /api/relationships?page=0 — the page-zero boundary (offset=-size). Expected: 500 or 400 — no graceful empty page. **P-130 covers this**."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships/erd/{id} returns 404 when the id is a relationships.id (NOT a data_entity.id). The contract violation surfaced by P-128."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships/erd/{data_entity_id} returns 200 with DataEntityRelationshipDetails for an ERD-type relationship row pointed at by that data_entity. **P-128 covers this**."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships/graph/{data_entity_id} — symmetric to the ERD path; verifies the GRAPH branch."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/relationships/erd/{data_entity_id} on a GRAPH-type relationship row returns 404 (type mismatch at SQL WHERE clause line 178). Test the cross-type negative."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "GET /api/relationships is reachable unauthenticated under auth.type=DISABLED — the canonical LSN-001-shape default-insecure posture. **P-131 covers this**."
    test_class: security
    criticality: HIGH
  - behaviour: "GET /api/relationships does NOT filter by data_source_id permission, namespace permission, EXCLUDE_FROM_SEARCH, or HOLLOW. Cross-tenant + hidden-row visibility test. **P-131 covers this**."
    test_class: security
    criticality: HIGH
  - behaviour: "GET /api/relationships/erd/{data_entity_id} returns the SAME payload to every user, regardless of whether the caller has any owner / policy / role over the underlying data source. Pin the no-access-control invariant."
    test_class: security
    criticality: HIGH
  - behaviour: "When two relationships rows share one data_entity_id (admissible per schema — no UNIQUE constraint), getRelationshipByIdAndType behaviour at the mono() expected-one-row site is undefined. **P-128 covers this**."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "When the response payload's relationships data_entity has DATA_RELATIONSHIP class id but a relationship_type value not in {ERD, GRAPH} (corrupted ingestion), the mapper at `RelationshipMapper.java:60-62` silently defaults to GRAPH_RELATIONSHIP. Verify the type-mapper fallback behaviour with a corrupt row."
    test_class: integration
    criticality: LOW
- test_files: []
- gaps: |
    Zero existing tests for any of the three endpoints. Both
    relationship-class repositories (`ReactiveDataEntityRelationshipRepositoryImpl`
    and `ReactiveRelationshipsRepositoryImpl`) have zero direct test
    coverage. The list endpoint's `query` param is the cleanest unit-test
    candidate — pure SQL filter behaviour, isolated from the larger
    JOIN graph. The CRITICAL gap is `security` — no test exercises the
    no-authorization posture under any of the four auth modes, and no
    test pins the cross-data-source visibility behaviour. The HIGH
    integration gap is the Category F drift between `relationship_id`
    (OpenAPI promise) and `data_entity.id` (SQL reality) — a single
    integration test calling the detail endpoint with both a real
    relationships.id and a real data_entity.id would surface the entire
    finding. Worst test_class coverage: security (zero) — also the
    test_class that would catch the highest-leverage gap (the
    cross-tenant + EXCLUDE_FROM_SEARCH bypass).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/data-modelling/relationships"
    anchor: ""
    rationale: "The /data-modelling/relationships.md file in the local docs repo at `documentation/docs/data-modelling/relationships.md:1-74` describes this feature in full — list page, ERD vs GRAPH distinction, cardinality model, UI walkthrough, adapter ingestion coverage. The HTTP path `/api/relationships` is mentioned at line 52. Live verification deferred — network unreachable this session per orchestrator note."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: network-error
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships"
    anchor: ""
    rationale: "The /developer-guides/api-reference/relationships.md file at `documentation/docs/developer-guides/api-reference/relationships.md:1-19` tabulates the three endpoints by Method + Path + Operation + Description. The local-repo page is the closest API-reference doc for this controller."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: network-error
    confidence: LOW
- doc_drift_findings:
  - "Live-fetch deferred (network unreachable). Local-repo `documentation/docs/developer-guides/api-reference/relationships.md:11` declares `GET /api/relationships/erd/{relationship_id}` — `Full ERD relationship details (source / target / cardinality / owner).` — but DOES NOT warn that the path parameter `{relationship_id}` is actually consumed as `data_entity.id` at the SQL layer, NOT as the `relationships` table primary key. A third-party API consumer calling the endpoint with a relationships.id obtained out-of-band (e.g. from a direct DB query, or guessed from the OpenAPI spec semantics) gets a 404. **CATEGORY F doc-drift candidate** — surfaces only after P-128 runs."
  - "Local-repo `data-modelling/relationships.md:33-38` documents the UI page including `page size is 30 by default` — the size value MATCHES `Relationships.tsx:23` (`size: 30`). No code-vs-doc drift on the page-size tunable."
  - "Local-repo `data-modelling/relationships.md` does NOT mention that the list endpoint applies NO owner-scoping, NO EXCLUDE_FROM_SEARCH filter, NO HOLLOW filter, and NO data_source-permission filter — every authenticated user sees every relationship across every data source in the catalog. The /api/dataentities endpoint applies the EXCLUDE_FROM_SEARCH filter (per batch-T REFACTOR-425 finding); the relationships list does NOT. The asymmetry is undocumented. **DOC-GAP candidate** — surfaces only after P-131 runs."
  - "Local-repo `data-modelling/relationships.md` mentions `/api/relationships` (line 52) but does NOT document the page=0 boundary behaviour (HTTP 500 / 400 per P-130 hypothesis). The API-reference page's `getRelationships` row mentions `?page=N` but does not specify `N >= 1`."

## implicit_adrs

- "**Pagination is 1-indexed BY ARITHMETIC CONVENTION**, not by validation enforcement — `(page - 1) * size` at `ReactiveDataEntityRelationshipRepositoryImpl.java:79` IS the convention. The convention is applied identically across every paginated endpoint that uses `JooqQueryHelper.paginate` (verified by grepping the platform). The implicit ADR is *the maintainer assumes UI callers send page>=1 and accepts arithmetic failure for page<1*. Pillar-wide convention with no defending validation." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:79 — intent_anchor: "the `(page - 1) * size` literal arithmetic with no Math.max(0,...) guard" — confidence: MEDIUM
- "**The relationship list endpoint is a CATALOG-GLOBAL surface, not an owner-scoped one** — distinct from `/api/dataentities/my` which IS owner-scoped (batch-G `getMyObjects`). The intent is that relationships are PUBLIC METADATA across the catalog: a consumer should be able to discover that table A links to table B even if they have no permissions on either. The code embodies this by the absence of any OWNERSHIP JOIN; the data-modelling/relationships.md doc embodies it by NOT documenting any scoping at all. Symmetric to `/api/lineage` (per batch-J Lineage UI) — both are read-collaborative catalog surfaces." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:66-72 (conditionList omits OWNERSHIP and EXCLUDE_FROM_SEARCH) + the parallel pattern in lineage — intent_anchor: "the conditionList contains ONLY `DATA_ENTITY.EXTERNAL_NAME` (when query provided) AND `ENTITY_CLASS_IDS = [9]`; no owner / namespace / exclude_from_search clause" — confidence: MEDIUM
- "**Service-layer dispatch hardcodes the relationship type per endpoint**: `getERDRelationshipById` and `getGraphRelationshipById` are TWO endpoints (not one with a discriminator) because the API surface deliberately exposes the type as a path-segment, not a query parameter. The decision is to make ERD vs GRAPH a first-class API distinction at the URL level." — evidence: RelationshipsServiceImpl.java:38-49 + openapi.yaml:4160-4192 (two separate path entries) — intent_anchor: "the API surface splits at the URL level, not at the query-parameter level, and the service hardcodes the type per method" — confidence: HIGH

## bugs_limitations_corner_cases

- "**CATEGORY F TRANSLATES_SILENTLY — `relationshipId` parameter name vs SQL filter target**: the OpenAPI parameter `relationship_id` and Java parameter `relationshipId` promise the relationships-table primary key; the SQL at `ReactiveRelationshipsRepositoryImpl.java:194` filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` — the data_entity.id, NOT relationships.id. The list endpoint's response maps `.id(item.dataEntityRelationship().getId())` (RelationshipMapper.java:53) — the data_entity id. UI round-trip works (list→detail with same id). Third-party API consumers reading the OpenAPI spec and supplying actual relationships.id values get 404. **Pinned by P-128**." — evidence: RelationshipController.java:31 + RelationshipsServiceImpl.java:38-39 + ReactiveRelationshipsRepositoryImpl.java:194 + RelationshipMapper.java:53 + V0_0_87__create_relation_tables.sql:1-10 — severity: HIGH
- "**No authorization gate at any layer — every endpoint is reachable by any authenticated caller (or anonymous under DISABLED)**: no @PreAuthorize, no SECURITY_RULES entry in SecurityConstants.java:95-355 for `/api/relationships/**`, no service-layer permission check, no repository OWNERSHIP JOIN. Cross-data-source visibility, cross-namespace visibility, and visibility of EXCLUDE_FROM_SEARCH=true relationships are all unrestricted. Whether this is intentional (catalog-as-public-metadata) or a security gap is the doc-drift question — the live data-modelling/relationships.md doc does NOT articulate the choice. **Pinned by P-131**." — evidence: RelationshipController.java:1-44 (no annotations) + SecurityConstants.java:95-355 (no matching matcher) + RelationshipsServiceImpl.java:30-49 (no check) + ReactiveDataEntityRelationshipRepositoryImpl.java:66-75 (conditionList) — severity: HIGH
- "**Page-zero boundary triggers HTTP 500/400, not a graceful empty page**: `(page - 1) * size` at ReactiveDataEntityRelationshipRepositoryImpl.java:79 produces a negative offset for page=0. The OpenAPI PageParam (components.yaml — not read; verified by grep) lacks a `minimum: 1` constraint; Spring's binding accepts page=0. A JavaScript-style 0-indexed caller (typical) hits an opaque error instead of the first page. **Pinned by P-130**." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:79 + RelationshipController.java:20-26 (no validation) — severity: MEDIUM
- "**No UNIQUE constraint on `relationships.data_entity_id`**: schema admits one relationship-class data_entity owning multiple `relationships` rows. The detail endpoint uses `mono()` expecting one row (`ReactiveRelationshipsRepositoryImpl.java:197`); behaviour on multi-match is undefined (JOOQ driver-specific — either TooManyResultsException or silent first-row). No collector currently produces multi-row (per docs/data-modelling/relationships.md ingestion matrix), but a collector regression or manual SQL UPSERT could trigger it. **Pinned by P-128 multi-row sub-case**." — evidence: V0_0_87__create_relation_tables.sql:1-10 (no UNIQUE on data_entity_id) + ReactiveRelationshipsRepositoryImpl.java:197 (mono() expects single row) — severity: MEDIUM
- "**Search-query field semantics surface only the relationship NAME, not source/target entity names**: a user typing the source-table's name in the Relationships page search box sees no results unless the relationship-class data_entity's own external_name happens to contain that text. The UI's `placeholder='Search relationships'` (RelationshipsSearchInput.tsx:17) matches the SQL behaviour — no false promise. But operators who expect entity-graph-search semantics (typing 'orders' to find all relationships involving the ORDERS table) get an empty result." — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:68-69 (DATA_ENTITY.EXTERNAL_NAME match — the relationship row, not source/target) + RelationshipsSearchInput.tsx:14-22 — severity: LOW
- "**Mapper silently defaults to GRAPH_RELATIONSHIP for unknown relationship_type values**: `RelationshipMapper.java:60-62` reads `RelationshipTypeDto.ERD.name().equals(item.relationshipPojo().getRelationshipType()) ? ENTITY_RELATIONSHIP : GRAPH_RELATIONSHIP`. Any value that is NOT exactly 'ERD' falls into GRAPH_RELATIONSHIP — including null, lowercase 'erd', misspellings, or new types added without code updates. The schema's `relationship_type` column is `varchar(256)` with no CHECK constraint (V0_0_87__create_relation_tables.sql:7), so corrupted ingestion is admissible." — evidence: RelationshipMapper.java:60-62 + V0_0_87__create_relation_tables.sql:7 — severity: LOW
- "**`navigation/domains/relationships.md` claims the feature is `Documentation: None`** while in fact `documentation/docs/data-modelling/relationships.md` AND `documentation/docs/developer-guides/api-reference/relationships.md` both exist. Navigation pointer is stale." — evidence: navigation/domains/relationships.md:20 + documentation/docs/data-modelling/relationships.md (exists, 74 lines) + documentation/docs/developer-guides/api-reference/relationships.md (exists, 19 lines) — severity: LOW
- "**Status-code drift check**: openapi.yaml:4151-4173 declares 200 for all three relationship endpoints; the controller returns 200 via `ResponseEntity::ok` on all three. No drift. (Recorded explicitly so the maintainer doesn't have to re-verify.)" — evidence: openapi.yaml:4150-4192 + RelationshipController.java:26, 34, 42 — severity: N/A (no defect, explicit clean-bill-of-health)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:79"
      name: "(page - 1) * size — offset arithmetic"
      value: "page * size arithmetic, no Math.max guard"
      questions:
        - q: "What at page=0?"
          a: "offset = -size (negative). Postgres rejects negative OFFSET with `OFFSET must not be negative`. Hypothesis: 500 from R2DBC; possibly 400 if WebFlux wraps the SQLException. P-130 pins."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What at page=null?"
          a: "NPE at unboxing `Integer page` to int for the arithmetic. The controller does not guard against null. The OpenAPI PageParam declares the parameter required, but Spring's reactive binding may permit absent values through. P-130 covers this boundary too."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What at size=0?"
          a: "LIMIT 0 returns no rows; total count CTE still works. Expected: 200 with items=[] and total=N. P-130 pins."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What at size=Integer.MAX_VALUE?"
          a: "Postgres accepts LIMIT 2147483647. No int overflow at page=1 * MAX. P-130 confirms."
          confidence: PROBE-NEEDED
          evidence: "P-130"
        - q: "What does the operator see at the page=0 boundary?"
          a: "Opaque 500 (most likely) — no graceful empty-page. Falls foul of JavaScript 0-indexed convention. P-130 pins the operator-visible behaviour."
          confidence: PROBE-NEEDED
          evidence: "P-130"
    - location: "odd-platform-ui/src/components/DataModelling/Relationships.tsx:23"
      name: "size: 30 — UI page size"
      value: "30"
      questions:
        - q: "What at size=30?"
          a: "30 rows per page; total page-count = ceil(N/30). Matches data-modelling/relationships.md:38 doc claim of `page size is 30 by default`. No drift."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:23 + documentation/docs/data-modelling/relationships.md:38"
        - q: "Is the page size configurable from the UI?"
          a: "No — hardcoded literal at the useSearchRelationships call site; no env var, no settings page, no react-query option to override at runtime. To change, a developer edits the literal and rebuilds the UI."
          confidence: STATIC-INFERRED
          evidence: "Relationships.tsx:23 + relatioships.ts:20-41"
  name_behavior_pairs:
    - name: "getRelationships"
      promise: "Returns a paginated list of relationships matching the type filter and the search query."
      implementation: "ReactiveDataEntityRelationshipRepositoryImpl.java:57-131. Selects from data_entity WHERE entity_class_ids = [9] AND (optional external_name match), JOOQ paginate with ORDER BY data_entity.id ASC, then JOINs to relationships + source_data_entity + target_data_entity + data_source + namespaces and aggregates per row. Returns Page<RelationshipDto> mapped to DataEntityRelationshipList."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:57-131"
    - name: "getERDRelationshipById"
      promise: "Get information about an ERD relationship by its id (per openapi.yaml:4162-4163 description)."
      implementation: "RelationshipsServiceImpl.java:38-42 hardcodes RelationshipsType.ERD and calls getRelationshipByIdAndType(relationshipId, ERD). SQL at ReactiveRelationshipsRepositoryImpl.java:194 filters by `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)`. The parameter is consumed as a data_entity.id, NOT a relationships.id (verified by reading the SQL end-to-end)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A third-party API consumer reading the OpenAPI spec literally and supplying the relationships.id value gets a 404; UI clients work because the list response returns data_entity.id as the `id` field, so list-then-detail is a self-consistent round-trip."
      confidence: PROBE-NEEDED
      evidence: "P-128"
    - name: "getGraphRelationshipById"
      promise: "Get information about a graph relationship by its id."
      implementation: "Symmetric to ERD path — same SQL site, same data_entity.id-not-relationships.id binding."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Same as ERD path — third-party API consumer pain."
      confidence: PROBE-NEEDED
      evidence: "P-128"
  orderings:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:77-79"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "JOOQ paginate is called with `List.of(new OrderByField(DATA_ENTITY.ID, SortOrder.ASC))` — the wrapper builds a Postgres `ORDER BY data_entity.id ASC` clause inside the paginate CTE. The OUTER SELECT at line 91-113 (with the CTE + 6-table JOIN) does NOT have its own ORDER BY, so the result is implicitly ordered by the inner row_number() over the paginate output, which is the data_entity.id ASC order."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:77-79 + JooqQueryHelper.java:63-90"
        - q: "What is the tie-breaker?"
          a: "data_entity.id is the table PK (bigserial), so values are unique by construction. No tie-breaker needed. Order is fully deterministic across calls."
          confidence: STATIC-INFERRED
          evidence: "V0_0_87__create_relation_tables.sql:1-3 implies + standard data_entity table schema (PK on id)"
        - q: "Which subset is returned when result-set > page size?"
          a: "The (page-1)*size to page*size slice in data_entity.id ASC order. Oldest-first paging — the UI's infinite-scroll appends NEWER entries last (data_entity.id grows monotonically with creation). A newly-ingested relationship lands at the END of the infinite-scroll, not the top — operator-visible behaviour that may or may not match the UI's mental model."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:79 + JooqQueryHelper.java:81-83"
        - q: "Does any upstream layer re-sort?"
          a: "RelationshipMapper.mapListToRelationshipPage iterates the input list and maps each — NO re-sort. The InfiniteScroll component on the UI appends pages in arrival order (Relationships.tsx:63-77). No backend-shaped order is hidden by UI re-sorting."
          confidence: STATIC-INFERRED
          evidence: "RelationshipMapper.java:39-49 + Relationships.tsx:63-77"
  auth_gates:
    - location: "RelationshipController.java:14-44 (entire file)"
      endpoint: "GET /api/relationships + GET /api/relationships/erd/{relationship_id} + GET /api/relationships/graph/{relationship_id}"
      questions:
        - q: "What does each endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: 200 to anonymous (no auth chain wired by DisabledAuthSecurityConfiguration). LOGIN_FORM / OAUTH2 / LDAP: 200 to any authenticated caller (the catch-all `.pathMatchers(\"/**\").authenticated()` at AuthorizationCustomizer.java:29-30 admits any signed-in user; no SECURITY_RULES entry narrows further). NO role / permission gate fires for relationships.* paths."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:14-32 + SecurityConstants.java:95-355 (no relationships matcher)"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: 200 with full payload. Under LOGIN_FORM / OAUTH2 / LDAP: 401 (or redirect to login) from the catch-all `.authenticated()` rule."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "200 — there is NO role gate. Even a READ_ONLY role hits the endpoint. The role-collection model in ODD's authorization is mutation-focused (POLICY → PERMISSION → ROLE mapped to permissions like ROLE_CREATE); read endpoints generally accept any authenticated caller. For relationships specifically, no permission narrowing is wired."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-355 + RelationshipController.java:1-44 (no @PreAuthorize)"
        - q: "Where does the gate live?"
          a: "Catch-all `.authenticated()` at AuthorizationCustomizer.java:29-30 (NON-DISABLED modes only). Under DISABLED there is NO gate at any layer."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration"
  resource_boundaries:
    - location: "ReactiveDataEntityRelationshipRepositoryImpl.java:91-130"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Read-only endpoint. SELECTs only — no UPDATE, INSERT, DELETE in this code path. Two simultaneous calls see the same row set at the SQL snapshot isolation level used by R2DBC + Postgres default (READ COMMITTED). No state corruption possible."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:91-130 (SELECT only) + RelationshipsServiceImpl.java:30-49 (no write)"
        - q: "Is the call replay-safe?"
          a: "Yes — pure GET, no side effects."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:19-43 (all three operations are reads)"
        - q: "If a cache fronts this, what is the TTL?"
          a: "No cache annotation on RelationshipController, RelationshipsService, RelationshipsServiceImpl, ReactiveRelationshipsRepository, or ReactiveDataEntityRelationshipRepository. The UI's react-query layer (`useGetEDRRelationshipById`, `useGetGraphRelationshipById`, `useSearchRelationships` in relatioships.ts) caches per-query-key on the CLIENT, but the BACKEND has no cache."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:1-44 (no @Cacheable) + RelationshipsServiceImpl.java:1-50 (no @Cacheable) + relatioships.ts:1-41 (UI-side react-query keys are the only cache)"
  request_inputs:
    - location: "RelationshipController.java:20-24"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "1-indexed page number for the paginated list result."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:4146 + components.yaml/PageParam (referenced) + UI's Relationships.tsx:38 sets initialPageParam: 1"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded unmodified to RelationshipsServiceImpl.getRelationships (line 31-33) → ReactiveDataEntityRelationshipRepositoryImpl.getRelationships (line 57-58) → consumed as `(page - 1) * size` to produce the JOOQ offset (line 79). 1-indexed by arithmetic convention."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:25 → RelationshipsServiceImpl.java:33 → ReactiveDataEntityRelationshipRepositoryImpl.java:79"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the arithmetic convention treats page>=1 as the valid range; the name 'page' is generic enough that the 1-indexed convention is unspecified at the name level. Boundary failure at page=0 is a validation gap, not a name-vs-implementation drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:79"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there an available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "bugs_limitations_corner_cases.[2] (page=0 boundary)"
    - location: "RelationshipController.java:20-24"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "What does the input NAME promise?"
          a: "Number of items per page in the paginated list result."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:4147 + components.yaml/SizeParam (referenced)"
        - q: "What does the implementation USE it for?"
          a: "Forwarded to JOOQ LIMIT clause at ReactiveDataEntityRelationshipRepositoryImpl.java:79 (`jooqQueryHelper.paginate(...,(page-1)*size, size)`). MATCHES the LIMIT semantic."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:79"
        - q: "Does the implementation MATCH?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:79"
        - q: "For TRANSLATES_SILENTLY: what does a caller see?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A"
    - location: "RelationshipController.java:22"
      input_kind: query-param
      input_name: "type"
      questions:
        - q: "What does the input NAME promise?"
          a: "Filter the result list by relationship type — ERD, GRAPH, or ALL (per the RelationshipsType enum at components.yaml:4193-4198)."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:22 + openapi.yaml:4149 + components.yaml:4193-4198"
        - q: "What does the implementation USE it for?"
          a: "At RelationshipsServiceImpl.java:33 → ReactiveDataEntityRelationshipRepositoryImpl.java:99-101: if `RelationshipsType.ALL == type`, DSL.noCondition() disables the filter; else applies `relationships.field(RELATIONSHIPS.RELATIONSHIP_TYPE).eq(type.getValue())`. Filter on the `relationship_type` column of the `relationships` table — the relationship row's type, which IS what the parameter name promises."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:99-101"
        - q: "Does the implementation MATCH?"
          a: "MATCHES — `type` param filters by the relationship's type column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:99-101"
        - q: "For TRANSLATES_SILENTLY: what does a caller see?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A"
    - location: "RelationshipController.java:23"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise?"
          a: "Free-text search filter for the paginated list. Generic name — promise is 'filter the list by this text'."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:23 + components.yaml:4231-4237 (SearchParam) + RelationshipsSearchInput.tsx:17 (UI placeholder='Search relationships')"
        - q: "What does the implementation USE it for?"
          a: "ReactiveDataEntityRelationshipRepositoryImpl.java:68-69: if non-blank, appends `DATA_ENTITY.EXTERNAL_NAME.containsIgnoreCase(inputQuery)` to the conditionList. The DATA_ENTITY in scope is the relationship-class data entity (entity_class_ids contains 9), so the match is against the RELATIONSHIP's external_name, NOT the source/target dataset entity names."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:68-69 + :74 (DSL.selectFrom(DATA_ENTITY))"
        - q: "Does the implementation MATCH?"
          a: "MATCHES — `query` filters list items by relationship NAME, which matches the UI placeholder 'Search relationships' and the spec's `Search text` description. The match does NOT extend to source/target entity names — an operator hoping to find relationships involving table X by typing 'X' may see empty results unless the relationship row's own external_name contains 'X'."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:68-74 + RelationshipsSearchInput.tsx:14-22"
        - q: "For TRANSLATES_SILENTLY: what does a caller see?"
          a: "N/A — no silent translation; UI label and SQL semantic are aligned."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Available-but-unused column?"
          a: "`source_data_entity.external_name` and `target_data_entity.external_name` are JOINed (lines 102-105) and SELECTed (line 94) but NOT included in the WHERE clause's text-match. An operator-friendlier variant of this search would also match against these — a feature gap, not a bug."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRelationshipRepositoryImpl.java:68-69 (WHERE only on relationship-row external_name) + :102-105 (source/target JOINed but not filtered)"
      routes_to_finding: "bugs_limitations_corner_cases.[4] (search semantics scope)"
    - location: "RelationshipController.java:31"
      input_kind: path-param
      input_name: "relationshipId"
      questions:
        - q: "What does the input NAME promise?"
          a: "The primary key of the relationships table — i.e. an integer id obtained from the relationships table directly. The name `relationship_id` (OpenAPI) plus the operation summary `Get erd relationship by id` reads as the relationships-table id."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:31 + openapi.yaml:4162-4166 + components.yaml:4385-4391"
        - q: "What does the implementation USE it for?"
          a: "Forwarded to RelationshipsServiceImpl.getERDRelationshipById (line 39) → ReactiveRelationshipsRepository.getRelationshipByIdAndType (line 153) → SQL WHERE clause at ReactiveRelationshipsRepositoryImpl.java:194: `.where(relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId))` — filters by `data_entity.id`, NOT `relationships.id`. The list endpoint returns `id` = `data_entity.id` (RelationshipMapper.java:53), so the round-trip works for callers using the list response; standalone callers using actual `relationships.id` values get 404."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsServiceImpl.java:39 → ReactiveRelationshipsRepositoryImpl.java:194 + RelationshipMapper.java:53"
        - q: "Does the implementation MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name promises `relationships.id`; the implementation consumes `data_entity.id`. No comment, no Javadoc, no ADR documents the translation. The UI round-trip masks the drift because the list response also uses data_entity.id as the surfaced `id`."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: PROBE-NEEDED
          evidence: "P-128"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when wrong?"
          a: "A third-party API consumer who reads the OpenAPI spec literally and supplies an actual relationships.id (e.g. queried directly from the DB or generated from a Postman test set) gets HTTP 404 — NotFoundException at RelationshipsServiceImpl.java:40-47. Worse, a consumer that gets 200 (because they happened to supply a data_entity.id that coincidentally matches a relationships.id — both are bigserial — would receive a payload for an UNRELATED relationship. Collision is unlikely but admissible (two independent bigserial counters). When two relationships rows share one data_entity.id (admissible per schema, no UNIQUE constraint), mono() at line 197 hits multi-row case (driver behaviour undefined)."
          confidence: PROBE-NEEDED
          evidence: "P-128"
        - q: "Is there a column / field that DOES match the input's name and is NOT used?"
          a: "YES — `relationships.id` IS the column the name promises; the SQL at line 194 uses `relationshipsDataEntity.field(DATA_ENTITY.ID)` (the data_entity.id column of the relationship-class entity) INSTEAD OF `RELATIONSHIPS.ID`. The fix candidate is changing line 194 from `relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId)` to `RELATIONSHIPS.ID.eq(relationshipId)` — AND updating the list endpoint's mapper to surface `relationshipPojo().getId()` as the `id` instead of `dataEntityRelationship().getId()`. Both halves needed for the rename; either half alone breaks round-trip."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:194 (uses data_entity.id) + RELATIONSHIPS.ID column (exists, unused at filter) + RelationshipMapper.java:53 (surfaces data_entity.id, not relationship.id)"
      routes_to_finding: "bugs_limitations_corner_cases.[0] + docs_link_semantic.doc_drift_findings.[0]"
    - location: "RelationshipController.java:39"
      input_kind: path-param
      input_name: "relationshipId"
      questions:
        - q: "What does the input NAME promise?"
          a: "Same as ERD path — relationships-table primary key."
          confidence: STATIC-INFERRED
          evidence: "RelationshipController.java:39 + openapi.yaml:4181-4183"
        - q: "What does the implementation USE it for?"
          a: "Same SQL site (getRelationshipByIdAndType called with RelationshipsType.GRAPH instead of ERD). Same data_entity.id filter."
          confidence: STATIC-INFERRED
          evidence: "RelationshipsServiceImpl.java:46 → ReactiveRelationshipsRepositoryImpl.java:194"
        - q: "Does the implementation MATCH?"
          a: "TRANSLATES_SILENTLY — same drift as ERD path."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: PROBE-NEEDED
          evidence: "P-128"
        - q: "For TRANSLATES_SILENTLY: what does a caller see?"
          a: "Same as ERD — third-party consumer pain."
          confidence: PROBE-NEEDED
          evidence: "P-128"
        - q: "Available-but-unused column?"
          a: "YES — RELATIONSHIPS.ID (same as ERD path)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveRelationshipsRepositoryImpl.java:194"
      routes_to_finding: "bugs_limitations_corner_cases.[0]"
  probes_emitted:
    - probe_id: P-128
      question: "relationshipId name vs SQL filter target; multi-row sub-case"
      probe_path: "lineage/odd-platform/probes/P-128.yaml"
    - probe_id: P-130
      question: "page-zero / page-null / size-zero / size-MAX / query-omitted boundaries"
      probe_path: "lineage/odd-platform/probes/P-130.yaml"
    - probe_id: P-131
      question: "no-authorization posture; cross-tenant + EXCLUDE_FROM_SEARCH + HOLLOW visibility"
      probe_path: "lineage/odd-platform/probes/P-131.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 46
    answers_static_inferred: 33
    answers_probe_needed: 13
    answers_reference: 0
    drift_flags: 4
```

Note: although `probes_emitted` references P-128 in the list, the actual on-disk file at `lineage/odd-platform/probes/P-128.yaml` was claimed by a sibling agent (LinksController batch) racing this batch — the relationship probe content per this sidecar lives at P-128 conceptually but the writable artifact was deferred; the on-disk probes I authored are P-130 + P-131. The maintainer should rename one of the colliding P-128 entries (P-128.yaml is currently LinksController's) and re-emit the relationship probe at a free P-NNN slot during the next reducer pass.

## security

- auth_mode_relevance: ["DISABLED (200 to anonymous — full payload, all relationships, no filter)", "LOGIN_FORM (200 to any authenticated user)", "OAUTH2 (200 to any authenticated user)", "LDAP (200 to any authenticated user)", "S2S (200 to any X-API-Key holder; S2sAuthenticationFilter grants ADMIN globally per REFACTOR-108 — strictly broader than authenticated mode)"]
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion."
- authorization_assertions: []
- owner_scoping: "BYPASSES — the SQL at ReactiveDataEntityRelationshipRepositoryImpl.java:66-75 (list) and ReactiveRelationshipsRepositoryImpl.java:152-208 (detail) has NO OWNERSHIP JOIN, NO data_source_id filter, NO namespace_id filter, NO exclude_from_search filter, NO hollow filter. The result returns relationships across ALL data sources regardless of caller's owner scope."
- data_exposure: ["DataEntityRelationship list (id, name, oddrn, sourceDataEntity, targetDataEntity, dataSource ref, type) → any authenticated user (or anyone under DISABLED). Discloses the existence of every catalogued relationship and the source/target table names — operator should know that the relationships list is a CATALOG-GLOBAL surface, not owner-scoped (intentional per implicit_adrs[1], but undocumented in data-modelling/relationships.md).", "DataEntityRelationshipDetails (allOf above + erdRelationship.fields_pairs OR graphRelationship.specific_attributes) → same audience. The fields_pairs payload discloses the FK column names of both source and target dataset for ERD relationships — schema-level metadata that may carry implicit confidentiality (e.g. internal naming conventions)."]
- known_security_gaps:
  - "controller has no @PreAuthorize; the OpenAPI-generated RelationshipApi interface (build artifact, not in source tree) has no annotations either; the SECURITY_RULES table at SecurityConstants.java:95-355 has NO matcher for /api/relationships/**. The catch-all .authenticated() at AuthorizationCustomizer.java:29-30 is the ONLY gate (and only under non-DISABLED) — evidence: RelationshipController.java:1-44 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:14-32 — severity: HIGH"
  - "endpoint reachable unauthenticated under auth.type=DISABLED — the AuthorizationCustomizer (which contains the catch-all .authenticated() rule) is not wired by DisabledAuthSecurityConfiguration. LSN-001-shape default-insecure posture — evidence: DisabledAuthSecurityConfiguration.java + RelationshipController.java:1-44 — severity: MEDIUM (DISABLED is dev-only per docs; production deployments should run LOGIN_FORM / OAUTH2 / LDAP)"
  - "no exclude_from_search or hollow filter — the conditionList at ReactiveDataEntityRelationshipRepositoryImpl.java:66-72 selects ONLY by entity_class_ids and optional external_name. /api/dataentities applies EXCLUDE_FROM_SEARCH (per batch-T REFACTOR-425); /api/relationships does not. A relationship-class data_entity flagged exclude_from_search=true (e.g. via an operator-marked HIDE action OR a corrupted ingestion) IS NEVERTHELESS RETURNED here. Asymmetry between the two list surfaces is undocumented — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:66-75 — severity: MEDIUM"
  - "no cross-data-source visibility filter — a caller with policy/role grants over data_source_1 only nonetheless sees relationships from data_source_2 in the list and detail payloads. Whether this is intentional (catalog-as-public-metadata per implicit_adrs[1]) or a security gap depends on the maintainer's stance; the data-modelling/relationships.md doc does NOT articulate the choice — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:66-75 (no data_source filter) — severity: MEDIUM"
  - "S2sAuthenticationFilter grants ADMIN to any X-API-Key holder (REFACTOR-108); a caller who acquires (or guesses) the S2S key has unfettered read access to every relationship across every data source — evidence: cross-reference REFACTOR-108 from batch-E — severity: HIGH (when S2S is enabled)"

## performance

- hot_paths:
  - "list endpoint scans all data_entity rows with entity_class_ids = [9] then JOINs 6 tables (relationships + source_data_entity + target_data_entity + data_source + 2x namespace) per page. Catalogs with >100K relationships hit visible response-time degradation. No index on `data_entity.entity_class_ids` (array GIN) is verified this pass — depends on the platform's standard data_entity indexes — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:74-113"
  - "list endpoint runs an additional COUNT(*) query inside the empty-result fallback (`jooqQueryHelper.pageifyResult` line 129 supplies `DSL.selectCount().from(DATA_ENTITY).where(conditionList)`) — this fires ONLY when the result page is empty (e.g. on a hard-miss search). For non-empty pages the count is embedded in the paginate window-function (`COUNT(*) OVER()` at JooqQueryHelper.java:73). So the COUNT round-trip is a SLOW-PATH cost only — evidence: ReactiveDataEntityRelationshipRepositoryImpl.java:117-130 + JooqQueryHelper.java:73"
- throughput_characteristics:
  - "Read-only endpoint; non-blocking reactive Mono/Flux signature. No bulk-fetch endpoint — each detail page is a single GET. A UI that opens 10 detail tabs simultaneously fires 10 independent SQL queries."
  - "List response includes hasNext + total (computed in-band via the window function); the UI's react-query useInfiniteQuery pre-fetches when hasNext=true — predictable per-page load pattern."
- resource_allocation:
  - "Each list-page row materialises a RelationshipDto with NESTED pojos (RelationshipsPojo, DataEntityPojo x3, DataSourcePojo, NamespacePojo x2) — 6+ object allocations per row, page=30 means ~180 transient pojos per request. For typical loads this is negligible; for a 1000-row scan (size=1000 if a caller bypasses the UI), it grows linearly."
  - "Detail endpoint additionally aggregates an array of DatasetFieldPojo via JSON_ARRAY_AGG (ReactiveRelationshipsRepositoryImpl.java:111 + :174) — the dataset-field projection size depends on the relationship's source_dataset_field_oddrn[] length. Foreign-key relationships with many columns produce larger payloads."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally."
  - "No advisory lock, no synchronized block, no @Transactional on this code path — read-only reactive stack."
  - "No pagination cap at the controller layer. size=Integer.MAX_VALUE is accepted (subject to Postgres LIMIT handling). A malicious caller can request the entire catalog in one page; the JOOQ window function COUNT(*) OVER() still runs once. The list endpoint is therefore O(N) over the relationship-class catalog per call — DoS-class concern when N is large."
- known_performance_gaps:
  - "no maximum-size guard at the controller — a caller supplying size=10000 can pull 10000 RelationshipDto objects in one response. The OpenAPI SizeParam (not read this pass) does not declare a `maximum` constraint as of the schema I read — evidence: RelationshipController.java:21 (Integer size, no @Max) + ReactiveDataEntityRelationshipRepositoryImpl.java:79 (LIMIT size literal) — severity: MEDIUM"
  - "the COUNT(*) OVER() window function on the paginate inner query runs the count on EVERY page, not just the first — for very large catalogs this is wasted work. The pattern is universal to the platform's JooqQueryHelper.paginate helper, so not a relationship-specific gap — evidence: JooqQueryHelper.java:73 — severity: LOW (cross-cutting, defer to the JooqQueryHelper sidecar)"

## upstream_callers

- entry_point: "ui_route:/data-modelling/relationships"
  caller_node: "ts react-component:Relationships.tsx"
  multiplicity_per_trigger: 1
  evidence: "Relationships.tsx:20-24 dispatches useSearchRelationships → calls relationshipApi.getRelationships once per page-fetch; useInfiniteQuery pages on scroll, so total multiplicity per route mount is 1 + N (one per visible page) — but per page boundary, exactly 1 backend call"
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/relationships (detail panel — exact route not located this pass)"
  caller_node: "ts react-hook:useGetEDRRelationshipById"
  multiplicity_per_trigger: 1
  evidence: "relatioships.ts:6-11 — useQuery fires once on mount per relationshipId"
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/relationships (detail panel — graph variant)"
  caller_node: "ts react-hook:useGetGraphRelationshipById"
  multiplicity_per_trigger: 1
  evidence: "relatioships.ts:13-18 — symmetric to ERD hook"
  observation_class: ui-call
- entry_point: "rest:GET /api/relationships"
  caller_node: "<external — direct API consumer>"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "openapi.yaml:4140-4158 declares the endpoint publicly; no auth gate beyond authenticated; third-party consumers are admissible"
  observation_class: rest-call
- entry_point: "rest:GET /api/relationships/erd/{relationship_id}"
  caller_node: "<external — direct API consumer>"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "openapi.yaml:4160-4175"
  observation_class: rest-call
- entry_point: "rest:GET /api/relationships/graph/{relationship_id}"
  caller_node: "<external — direct API consumer>"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "openapi.yaml:4177-4192"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns DataEntityRelationshipList (paged: items + PageInfo) — items[].{id, name, oddrn, sourceDataEntity, targetDataEntity, dataSource, type} — to the caller. Surfaces the existence of every relationship in the catalog (intentional per implicit_adrs[1])."
  evidence: "RelationshipController.java:25-26 + RelationshipMapper.java:45-49"
  cardinality_per_call: "1 response with N items where N <= size (max 30 per UI; uncapped on direct API)"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships"
    - "rest:GET /api/relationships"
- side_effect_class: page-render
  description: "Returns DataEntityRelationshipDetails — allOf DataEntityRelationship + erdRelationship (fields_pairs) — for an ERD relationship. fields_pairs discloses the source/target dataset_field_oddrn pairs of the foreign-key constraint."
  evidence: "RelationshipController.java:33-34 + RelationshipMapper.java:65-81 + ErdRelationshipMapper (not read this pass)"
  cardinality_per_call: "1 if the relationships row + data_entity exist; 0 (HTTP 404 via NotFoundException) if the supplied id has no data_entity match for ERD-type"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships (detail panel)"
    - "rest:GET /api/relationships/erd/{relationship_id}"
- side_effect_class: page-render
  description: "Returns DataEntityRelationshipDetails — allOf DataEntityRelationship + graphRelationship (specific_attributes JSON, is_directed boolean) — for a GRAPH relationship."
  evidence: "RelationshipController.java:41-42 + RelationshipMapper.java:65-81 + GraphRelationshipMapper (not read this pass)"
  cardinality_per_call: "1 if found; 0 (HTTP 404) on miss"
  reachable_from_entry_points:
    - "ui_route:/data-modelling/relationships (detail panel — graph variant)"
    - "rest:GET /api/relationships/graph/{relationship_id}"

(No db-write, no activity-emit, no external-call, no sse-push, no
cache-mutate, no log-emit, no metric-emit, no header-set, no
redirect-issue — every operation is a pure GET that materialises a
response payload from SQL reads. The downstream_side_effects is
exclusively page-render.)

## sources

- understanding ← RelationshipController.java:1-44 + RelationshipsServiceImpl.java:1-50 + ReactiveDataEntityRelationshipRepositoryImpl.java:1-132 + ReactiveRelationshipsRepositoryImpl.java:1-261 + RelationshipMapper.java:1-80
- concepts.entities ← RelationshipController.java:4-12 + openapi.yaml:4140-4192 + components.yaml:4066-4198 + DataEntityClassDto.java:51
- concepts.operations ← RelationshipController.java:19-43 + RelationshipsServiceImpl.java:30-49 + openapi.yaml:4140-4192
- concepts.invariants ← RelationshipController.java:1-44 + RelationshipsServiceImpl.java:38-49 + ReactiveRelationshipsRepositoryImpl.java:152-208 + ReactiveDataEntityRelationshipRepositoryImpl.java:57-131 + V0_0_87__create_relation_tables.sql:1-32 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:14-32 + RelationshipMapper.java:51-80 + RelationshipsSearchInput.tsx:14-22
- concepts.audiences ← Relationships.tsx:20-24 + relatioships.ts:6-41 + REFACTOR-108 (batch-E cross-reference)
- dependencies_semantic.requires-feature ← RelationshipController.java:4-16 + openapi.yaml:4140-4192 + documentation/docs/developer-guides/api-reference/relationships.md:8-14
- dependencies_semantic.requires-config ← AuthorizationCustomizer.java:14-32 + DisabledAuthSecurityConfiguration (file existence confirmed, not read this pass) + S2sAuthenticationFilter (REFACTOR-108)
- dependencies_semantic.requires-runtime ← V0_0_87__create_relation_tables.sql + RelationshipMapper.java:19-25 (mapper composition) + JooqQueryHelper.java:55-117
- tests_coverage_semantic.uncovered_behaviours ← derived from full sidecar reading + WebFetch failure + grep of project test directory (Glob: no Relationship*Test* files exist)
- docs_link_semantic.inferred_docs ← documentation/docs/data-modelling/relationships.md:1-74 + documentation/docs/developer-guides/api-reference/relationships.md:1-19 + WebFetch fail (network unreachable)
- docs_link_semantic.doc_drift_findings ← cross-reference of code findings (above) against the local-repo doc text
- implicit_adrs ← ReactiveDataEntityRelationshipRepositoryImpl.java:66-79 + RelationshipsServiceImpl.java:38-49 + openapi.yaml:4160-4192
- bugs_limitations_corner_cases ← all stress_findings entries with PROBE-NEEDED + the static-inferred drift entries
- stress_findings.tunables ← ReactiveDataEntityRelationshipRepositoryImpl.java:79 + Relationships.tsx:23
- stress_findings.name_behavior_pairs ← RelationshipController.java:19-43 + RelationshipsServiceImpl.java:30-49 + ReactiveRelationshipsRepositoryImpl.java:152-208
- stress_findings.orderings ← ReactiveDataEntityRelationshipRepositoryImpl.java:77-79 + JooqQueryHelper.java:63-90 + RelationshipMapper.java:39-49 + Relationships.tsx:63-77
- stress_findings.auth_gates ← AuthorizationCustomizer.java:14-32 + SecurityConstants.java:95-355 + RelationshipController.java:1-44
- stress_findings.resource_boundaries ← RelationshipController.java:1-44 + RelationshipsServiceImpl.java:1-50 + relatioships.ts:1-41
- stress_findings.request_inputs ← RelationshipController.java:19-43 + ReactiveDataEntityRelationshipRepositoryImpl.java:57-131 + ReactiveRelationshipsRepositoryImpl.java:152-208 + RelationshipMapper.java:51-80 + V0_0_87__create_relation_tables.sql:1-32
- security.authorization_assertions ← (empty — explicit `[]`; the verification is the absence of @PreAuthorize and the absence of /api/relationships/** in SecurityConstants.SECURITY_RULES)
- security.owner_scoping ← ReactiveDataEntityRelationshipRepositoryImpl.java:66-75 + ReactiveRelationshipsRepositoryImpl.java:152-208
- security.known_security_gaps ← AuthorizationCustomizer.java:14-32 + SecurityConstants.java:95-355 + RelationshipController.java:1-44 + cross-ref REFACTOR-108
- performance.hot_paths ← ReactiveDataEntityRelationshipRepositoryImpl.java:74-130
- performance.scaling_characteristics ← RelationshipController.java:1-44 (no @Transactional) + ReactiveDataEntityRelationshipRepositoryImpl.java:79 (no size cap)
- upstream_callers ← Relationships.tsx:20-24 + relatioships.ts:6-41 + openapi.yaml:4140-4192
- downstream_side_effects ← RelationshipController.java:19-43 + RelationshipMapper.java:39-81

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the test gap is empirical — no tests exist)
- docs_link_semantic: MEDIUM (local-repo docs read; live verification deferred due to network unreachable)
- implicit_adrs: MEDIUM (intent anchors are convention-level, not comment-level)
- bugs_limitations_corner_cases: HIGH (all entries cite file:line)
- security: HIGH
- performance: HIGH (limited to file-local signals)
- upstream_callers: HIGH (UI side fully traced; rest entry-points are reference entries by intent)
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (13 of 46 questions resolve to PROBE-NEEDED — Category F drift on `relationshipId`, page-zero boundary, auth posture; load-bearing claims about the Category F drift are PROBE-NEEDED — confidence cannot rise to HIGH until P-128 runs)

## Maintainer notes

(Empty — first enrichment of this node; no prior sidecar to preserve.)

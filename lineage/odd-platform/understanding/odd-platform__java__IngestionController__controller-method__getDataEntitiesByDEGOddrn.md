---
node_id: "odd-platform java IngestionController controller-method:getDataEntitiesByDEGOddrn"
node_kind: controller-method
axis: controllers
extracted_at_commit: HEAD
enriched_at_commit: HEAD
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Z-retry
---

# IngestionController.getDataEntitiesByDEGOddrn — semantic understanding

## understanding

`getDataEntitiesByDEGOddrn` is the read-side companion to the `POST /ingestion/entities` S2S write path: a three-line proxy (`IngestionController.java:76-79`) that takes a path-templated `degOddrn` and returns a `CompactDataEntityList` (each member's ODDRN + DataEntityType) for the named Data Entity Group, by delegating to `DataEntityGroupServiceImpl.listEntitiesWithinDEG` (line 92-108) which flat-SELECTs from `GROUP_ENTITY_RELATIONS` joined to `DATA_ENTITY` filtered only on `GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())` (`ReactiveDataEntityRepositoryImpl.java:318-326`). The controller carries no authorization, no ODDRN-format validation, no existence check, and no logging; the path `/ingestion/**` is in `SecurityConstants.WHITELIST_PATHS` (line 96) so the four UI auth modes do NOT protect it; the only authentication gate is `IngestionDataEntitiesFilter` whose path matcher is hard-coded to `POST /ingestion/entities` exactly (`IngestionDataEntitiesFilter.java:28`) and therefore does NOT match this GET endpoint — making this method **unauthenticated in every shipped deployment configuration**, including when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have protected ingestion.

## concepts

- entities:
  - `degOddrn` (path-templated string) — the Data Entity Group's ODDRN, used verbatim as the SQL WHERE predicate; no format validation
  - `CompactDataEntityList` — response payload: `items: List<CompactDataEntity>` where each CompactDataEntity is `{oddrn, type}` (no name, no namespace, no owner, no parent-group, no creation timestamp)
  - `DataEntityGroupService.listEntitiesWithinDEG(degOddrn)` — service delegate (DataEntityGroupService.java:14)
  - `GROUP_ENTITY_RELATIONS` (Postgres table) — the M:N edge table joining groups to their member entities; the SELECT filters by `GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())`
- operations:
  - accept-deg-oddrn-path-parameter
  - delegate-to-data-entity-group-service
  - select-deg-members-by-oddrn-no-recursion
  - map-to-compact-projection
  - return-200-with-list-shape
- invariants:
  - "**No authorization at any layer**: controller has no `@PreAuthorize` (lines 76-79); `IngestionApi` interface (OpenAPI-generated, sibling sidecars confirm) carries no security annotations; `DataEntityGroupServiceImpl.listEntitiesWithinDEG` (lines 92-108) makes no `fetchAssociatedOwner()` call and references no AuthIdentityProvider; `SecurityConstants.WHITELIST_PATHS` line 96 contains `/ingestion/**` so OAUTH2/LDAP/LOGIN_FORM auth chains skip this path; `LoginFormSecurityConfiguration.java` `permittedPaths` exempts `/ingestion/*` per sibling sidecar evidence; `IngestionDataEntitiesFilter.java:28` matches `POST /ingestion/entities` ONLY (not GET, not the templated child path)."
  - "**Unknown DEG returns 200 OK with empty items**, NOT 404. The SQL `WHERE GROUP_ODDRN.eq(:degOddrn)` returns zero rows; `.collectList()` produces an empty list; the controller wraps it as `CompactDataEntityList(items=[])` and returns `200 OK`. There is no existence check on the DEG, no `switchIfEmpty(Mono.error(NotFoundException))`, no contrast with the closely-related `LineageServiceImpl.getDataEntityGroupLineage` (line 62) which DOES raise `NotFoundException` on empty member resolution. The asymmetry is silent — operators have no contract distinguishing 'DEG exists with no members' from 'DEG does not exist' from 'wrong ODDRN format'."
  - "**No ODDRN format validation**. `degOddrn` is a raw `String` passed verbatim from the path parameter into the SQL `eq(...)` predicate. A caller can submit any string — `\"\"`, `\"null\"`, `\"' OR 1=1 --\"` (jOOQ parameterises the value so SQL injection is not exploitable, but the input is otherwise unconstrained) — and receive 200 OK with empty items. There is no `OddrnFormatValidator` (no Grep hits in `<odd-platform-repo>` for any such class); the platform has no canonical ODDRN-shape validator on read paths."
  - "**Inner-DEG behaviour is implicitly flat, NOT recursive** (contrast `ReactiveGroupEntityRelationRepositoryImpl.java:177-204` recursive CTE used by `getDataEntityGroupLineage`). The SELECT here is a single-level join — it returns the DEG's DIRECT members only. A DEG-A containing nested DEG-B containing entity E exposes DEG-B as a member of DEG-A in the response (as a DATA_ENTITY_GROUP-typed CompactDataEntity), but does NOT expose E. The response carries no marker that any member is itself a DEG that the caller should re-query."
  - "**Cross-owner reachability**: any authenticated caller (or any caller at all under `auth.type=DISABLED`) can read the member list of ANY DEG by knowing or guessing its ODDRN. The endpoint applies no owner filter, no permission check, no participation predicate. The blast radius is the entire DEG catalog × the entire member catalog."
  - "**Path mapping is OpenAPI-contract-driven** — the method is `@Override` of `IngestionApi.getDataEntitiesByDEGOddrn` (line 76); there is no `@GetMapping` on the controller; the path mapping is declared in the OpenAPI specification that generates `IngestionApi`. Consistent with sibling `postDataEntityList`, `createDataSourceEntity`, `postDataSetStatsList`, `ingestMetrics` per the existing batch-F + batch-P sidecars."
  - "**Soft-delete coverage is single-sided**: the SQL filters `GROUP_ENTITY_RELATIONS.IS_DELETED.isFalse()` (ReactiveDataEntityRepositoryImpl.java:322) but does NOT filter the joined `DATA_ENTITY` rows by `STATUS != DELETED` or `HOLLOW = false`. A DEG that contains a soft-deleted (or hollow) data-entity surfaces that entity in the response. This deviates from the platform's `getDataEntityDefaultConditions` pattern used by every UI-side search/listing endpoint."
- audiences:
  - odd-collector and other S2S clients that ingested a DEG via `POST /ingestion/entities` and now need to enumerate its member set
  - third-party integrations (out-of-tree collectors) walking the ingestion catalog
  - security reviewers auditing the S2S surface — this endpoint is the read-side complement to the destructive-write surface at `POST /ingestion/entities`
  - any unauthenticated network probe under default deployment (auth.type=DISABLED, auth.ingestion.filter.enabled=false), enumerating the DEG catalog and its members

## dependencies_semantic

- requires-feature:
  - "`IngestionApi` (OpenAPI-generated interface in the ingestion contract module) — declares the path mapping for `getDataEntitiesByDEGOddrn`. Source-of-truth for the path lives in the OpenAPI ingestion spec (the exact path string is not in-repo at `odd-platform-specification/openapi.yaml`; it lives in the separate `opendatadiscovery-specification` repo not present on this filesystem — verified by Grep `getDataEntitiesByDEGOddrn` in `<odd-platform-specification>/openapi.yaml`: zero matches). The IngestionApi interface is imported from `org.opendatadiscovery.oddplatform.ingestion.contract.api.IngestionApi` (IngestionController.java:10) — separate generated module."
  - "`DataEntityGroupService.listEntitiesWithinDEG(String degOddrn)` — service delegate; the controller is a 3-line proxy. The service is the same `DataEntityGroupService` that owns DEG create/update operations (createDataEntityGroup, updateDataEntityGroup, listDEGItems) — the only operation that DOES NOT carry `@ReactiveTransactional` is `listEntitiesWithinDEG` (DataEntityGroupServiceImpl.java:92-108) — read-only path."
  - "`ReactiveDataEntityRepository.getDEGEntities(String groupOddrn)` — the repository method that runs the SQL. Returns `Mono<List<DataEntityPojo>>` (always-present list, possibly empty — never `Mono.empty()`). Two overloads exist: the single-string variant used here, and a `Collection<String>` batch variant (line 60) used elsewhere — neither applies recursive-CTE traversal."
- requires-config:
  - "`auth.ingestion.filter.enabled` — only nominally relevant. The filter is hard-coded to `POST /ingestion/entities` (filter.java:28) and therefore does NOT match this `GET .../{degOddrn}` path even when the property is `true`. The property name reads as 'lock down ingestion' but covers a different endpoint."
  - "`auth.type` (application.yml:32-34, default DISABLED) — under DISABLED, the SecurityWebFilterChain calls `.anyExchange().permitAll()` per `DisabledAuthSecurityConfiguration.java:11-19` (cited by REFACTOR-185 sidecars), so this endpoint is anonymously reachable. Under OAUTH2/LDAP/LOGIN_FORM, `SecurityConstants.WHITELIST_PATHS` line 96 (`/ingestion/**`) exempts the path AND the `IngestionDataEntitiesFilter` does not match it — so the endpoint is reachable WITHOUT a session token in EVERY auth mode."
  - "`spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) — does not apply to this GET endpoint (no request body)."
- requires-runtime:
  - "Spring WebFlux + Reactor Core (the controller returns `Mono<ResponseEntity<CompactDataEntityList>>`)."
  - "jOOQ + R2DBC reactive Postgres driver — the SELECT runs through `jooqReactiveOperations.flux(query)` (ReactiveDataEntityRepositoryImpl.java:323)."
  - "Jackson `ObjectMapper` (WebFlux's reactive codec serialises `CompactDataEntityList` to JSON)."
- coupling:
  - "Read-side complement to the destructive write at `POST /ingestion/entities` — F-008 P-10:F-001 Batch Ingestion (S2S API). The two endpoints share the `/ingestion/` path prefix, the same OpenAPI-contract `IngestionApi` interface, and the same `IngestionController` class — but only the write endpoint has even nominal auth-filter coverage. The read endpoint is uncovered by ANY filter."
  - "Architectural sibling of `GET /api/dataentitygroups/{id}/lineage` (F-016 P-05:F-002 DEG-Anchored Lineage) — that endpoint applies the same read-collaborative posture (no @PreAuthorize, no SECURITY_RULES entry, no fetchAssociatedOwner) but lives on the `/api` prefix and IS authenticated under OAUTH2/LDAP/LOGIN_FORM. This endpoint lives on `/ingestion` and is NOT authenticated under ANY shipped mode. The architectural asymmetry: the read-collaborative posture is INTENTIONAL for the UI-API surface (per ADR-CANDIDATE-003 / 114 / 122 family); this S2S-read sibling carries the SAME unscoped posture but with WEAKER auth gating."
  - "Schema-level: returns CompactDataEntity (`{oddrn, type}`) per the OpenAPI ingestion contract — the model lives in `org.opendatadiscovery.oddplatform.ingestion.contract.model.CompactDataEntityList` (IngestionController.java:11), the same model package that `postDataEntityList` consumes. The two endpoints use a symmetric model for the request/response payload."
  - "Service-layer: `DataEntityGroupServiceImpl.listEntitiesWithinDEG` lacks `@ReactiveTransactional` annotation (line 92) — read-only, no transaction needed; but means the response is not snapshot-consistent if a concurrent `DELETE FROM group_entity_relations WHERE group_oddrn = ?` races the read."
  - "Repository-layer: `ReactiveDataEntityRepositoryImpl.getDEGEntities(String)` (lines 318-326) — single-level join, NO `DATA_ENTITY.STATUS` filter, NO `DATA_ENTITY.HOLLOW` filter. Contrast `getDataEntityDefaultConditions` used throughout the search/listing surface — the conventional default-filters are NOT applied here."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Happy-path: `GET /ingestion/entities/{validDegOddrn}` with a DEG containing N members → 200 OK with N CompactDataEntity items, each `{oddrn, type}`. Verified ZERO test coverage: `grep -rln 'getDataEntitiesByDEGOddrn|listEntitiesWithinDEG|getDEGEntities' <odd-platform-repo>/odd-platform-api/src/test` returned ZERO matches (run 2026-05-20)."
  - "Unknown-DEG: `GET /ingestion/entities/{nonExistentOddrn}` returns 200 OK with empty items (NOT 404). No test asserts this — a future change adding `switchIfEmpty(Mono.error(NotFoundException))` would break the silent-empty contract with no signal."
  - "Empty-DEG: a DEG that exists but has no members → 200 with empty items. Behaviourally identical to the unknown-DEG case; the silent conflation has no test coverage."
  - "Malformed ODDRN: a path parameter that doesn't follow ODDRN syntax (`\"\"`, `\"x\"`, `\"//garbage\"`) — currently passes through to the SQL → empty list → 200 OK. No test asserts a 400 response."
  - "Null/blank ODDRN via URL encoding edge cases: `%20`, trailing slashes, double-encoded values. Currently produces empty 200; a future ODDRN-validator would change this to 400."
  - "Soft-deleted DATA_ENTITY in a DEG: the SQL does NOT filter `DATA_ENTITY` by `STATUS != DELETED` or `HOLLOW = false`. A test pinning current behaviour (soft-deleted member IS returned) would document the deviation from the platform's default-filters pattern."
  - "Inner-DEG: DEG-A containing nested DEG-B containing entity E. The SQL is single-level — DEG-A's response contains DEG-B as a DATA_ENTITY_GROUP-typed CompactDataEntity, but E is NOT in the response. Compared to the recursive-CTE behaviour of the `getDataEntityGroupLineage` sibling (F-016), the contract asymmetry is silent. No test pins this."
  - "Cross-owner read: caller authenticated as owner-A reads DEG-X owned by owner-B → 200 with full member list. The read-collaborative posture at this layer has no regression pin."
  - "Anonymous reach under `auth.type=DISABLED` and `auth.ingestion.filter.enabled=false` (the shipped default): unauthenticated GET succeeds with the same response. No test asserts auth-mode reachability."
  - "Anonymous reach under `auth.type=OAUTH2` (or LDAP/LOGIN_FORM) with NO bearer token: GET succeeds because `/ingestion/**` is whitelisted. No test asserts the auth-mode-orthogonal reachability."
  - "Filter-active confusion: with `auth.ingestion.filter.enabled=true`, a caller may believe the read endpoint is protected — but the filter's path matcher is `POST /ingestion/entities` (exact, IngestionDataEntitiesFilter.java:28) and does NOT match this GET path. A test asserting 'filter active does not change GET reachability' would document the operator-trap."
  - "Concurrent membership mutation: a `DELETE FROM group_entity_relations WHERE group_oddrn = ?` racing the read produces partial visibility (some members appear, some don't). The method has no `@ReactiveTransactional` — no test pins the race contract."
- test_files: []
- gaps: |
    The method has ZERO direct test coverage at any layer (HTTP / service / repository). The
    `DataEntityGroupServiceTest` (if it exists) does not exercise `listEntitiesWithinDEG`; the
    `BaseIngestionTest` scaffold covers only POST `/ingestion/entities`. The most likely
    regression points are: (1) silent supersede of the empty-200 contract by a future
    `switchIfEmpty(NotFoundException)` change — no test pins the current shape; (2) a future
    refactor that adds the `getDataEntityDefaultConditions` filter to `getDEGEntities(String)`
    would silently change the response by hiding soft-deleted members; (3) any change to the
    `IngestionDataEntitiesFilter` path matcher (e.g. broadening to `/ingestion/**`) would change
    the auth posture of this GET endpoint with no test signal. The absence of any
    `@WebFluxTest(IngestionController.class)` for the read path means the contract is held
    only by the running platform's invariants — operationally fragile.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
    anchor: ""
    rationale: "The S2S sub-page is the only live ODD doc that mentions any `/ingestion/*` endpoint by name. WebFetch attempted 2026-05-20 returned ECONNREFUSED (sandbox network restriction this session); prior session WebFetch evidence from sibling IngestionController sidecars (postDataEntityList 2026-05-12, status 200) shows the page covers POST `/ingestion/entities` only with an `X-API-Key` curl example and a `auth.ingestion.filter.enabled` recommendation — the GET `/ingestion/entities/{deg_oddrn}` endpoint is not mentioned on this page per the prior fetch."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: network-error
    confidence: LOW
    fetched_excerpts: |
      WebFetch unavailable this session (ECONNREFUSED). Prior batch-F WebFetch (2026-05-12,
      status 200) of the same URL by sibling sidecars established: the page mentions
      `/ingestion/entities` POST only; no mention of the GET-by-degOddrn endpoint.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/data-ingestion"
    anchor: ""
    rationale: "Reasonable URL guess for a canonical 'how ingestion works' page following the docs naming convention. Prior batch-F WebFetch (2026-05-12) returned 404 — the page does not exist. WebFetch this session unavailable (ECONNREFUSED). The 404 from the prior session means no canonical doc covers the GET endpoint either."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: network-error
    confidence: LOW
    fetched_excerpts: |
      WebFetch unavailable this session. Prior batch-F WebFetch (2026-05-12, status 404)
      established the URL does not exist; this session cannot re-verify but the prior
      fetch is recent and the docs structure is stable.
- doc_drift_findings:
  - "**NO live ODD doc page describes the GET `/ingestion/entities/{degOddrn}` endpoint**. Combined with the prior batch-F WebFetch evidence (S2S page does not name this endpoint; data-ingestion page does not exist), the entire S2S read surface is documentation-absent. An operator integrating a third-party reader against the ingestion API has no live doc to verify the response shape, the auth requirement, the 404-vs-empty contract, the inner-DEG behaviour, or even the existence of this endpoint."
  - "**The endpoint's anchor in operator mental model is inconsistent with code reality**. Operators enabling `auth.ingestion.filter.enabled=true` per the S2S page's recommendation believe they have 'protected the ingestion endpoint'. The endpoint name (`auth.INGESTION.filter.enabled`) and the property description (per existing sibling sidecars: 'authenticate the ingestion pipeline') do not communicate that the filter matches EXACTLY ONE PATH (`POST /ingestion/entities`) and that the GET-by-degOddrn read sibling on the SAME controller is uncovered. The docs/property-name asymmetry produces a false-sense-of-security drift class."

## implicit_adrs

- "Read-collaborative posture extends to the S2S read surface — explicitly UNSCOPED reads by design" — evidence: IngestionController.java:75-79 (no @PreAuthorize) + DataEntityGroupServiceImpl.java:92-108 (no fetchAssociatedOwner) + ReactiveDataEntityRepositoryImpl.java:318-326 (no OWNERSHIP join) + the platform's consistent pattern of unscoped reads across the entire DEG-membership / DEG-lineage / search / search-facet surfaces (ADR-CANDIDATE-003 / 114 / 122 family per REFACTOR-024 + REFACTOR-203 + F-016) — intent_anchor: the pattern is platform-wide; every DEG-anchored read endpoint in the codebase applies the same unscoped posture. The S2S read endpoint matches the architectural shape of its UI-side siblings. — confidence: HIGH (intent emerges from platform-wide consistency, not from a single comment)

- "Single-level (non-recursive) DEG-member projection is the intentional shape — recursion lives at the lineage surface, not the membership surface" — evidence: ReactiveDataEntityRepositoryImpl.java:318-326 (flat join, no `WITH RECURSIVE` CTE) vs ReactiveGroupEntityRelationRepositoryImpl.java:177-204 (recursive CTE used by getDataEntityGroupLineage) — intent_anchor: the codebase deliberately uses two distinct implementations for two distinct callers; the lineage-side recursion handles nested DEGs explicitly, while the membership-side flat-select treats nested DEGs as opaque members. A future need for recursive membership has a clear precedent in the lineage codepath. — confidence: MEDIUM (the asymmetry is consistent across the two methods, but no comment explicitly defends the single-level choice for this endpoint)

- "Path mapping is OpenAPI-contract-driven (no `@GetMapping`)" — evidence: IngestionController.java:75-79 (`@Override` only, no `@GetMapping`) + the consistent pattern across every method on this controller (postDataEntityList, createDataSource, postDataSetStatsList, ingestMetrics — all OpenAPI-driven per existing sibling sidecars) — intent_anchor: the convention is applied uniformly; only `AlertManagerController` deviates with hand-rolled `@PostMapping` (sibling sidecars cite the third-party-webhook rationale). — confidence: HIGH

- "Empty result IS the contract for unknown-DEG, NOT NotFoundException" — evidence: DataEntityGroupServiceImpl.java:92-108 (no `switchIfEmpty(Mono.error(...))`; the `.map` chain operates on the always-present `Mono<List<DataEntityPojo>>` which is an empty list when no rows match) vs LineageServiceImpl.java:62 (the sibling DEG-lineage explicitly `.switchIfEmpty(Flux.error(new NotFoundException("Data entity group", id)))` for the same empty-membership condition) — intent_anchor: two methods on different services produce different shapes for the same input (empty DEG membership). The membership-read returns empty-200; the lineage-read returns 404. The asymmetry IS the implicit ADR — the question 'do you exist?' has different shapes on the two endpoints; an operator integrating both must handle both shapes. — confidence: MEDIUM (the asymmetry is verifiable in code; whether it's intentional or accidental is borderline — but the consistency of each service with itself argues for intent)

## bugs_limitations_corner_cases

- "**Endpoint is UNAUTHENTICATED in EVERY shipped deployment mode** — including when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion surface. The filter's path matcher is hard-coded to `POST /ingestion/entities` exactly (`IngestionDataEntitiesFilter.java:28`); GET `/ingestion/entities/{anything}` does NOT match. Under `auth.type=DISABLED` (the shipped default per application.yml:32-34), `DisabledAuthSecurityConfiguration.anyExchange().permitAll()` covers it. Under OAUTH2/LDAP/LOGIN_FORM, `SecurityConstants.WHITELIST_PATHS` line 96 (`/ingestion/**`) exempts it. **Any caller able to reach the platform's HTTP port can enumerate the member list of any DEG by knowing or guessing its ODDRN.**" — evidence: IngestionController.java:76-79 (no @PreAuthorize) + IngestionDataEntitiesFilter.java:28 (exact-path matcher `/ingestion/entities` POST only) + SecurityConstants.java:96 (`/ingestion/**` whitelist) + application.yml:32-34 (auth.type=DISABLED default) + application.yml:46-48 (auth.ingestion.filter.enabled=false default) — severity: HIGH

- "**Cross-owner enumeration of DEG membership**: any caller can read the member list of ANY DEG — owned by ANY owner — with no participation predicate, no role check, no ownership join. This extends the REFACTOR-024 / REFACTOR-340 / REFACTOR-203 cross-owner-read posture to the S2S surface. ODDRN values for DEGs include the platform's host + DEG id (per `ODDPlatformDataEntityGroupPath` generation at `DataEntityGroupServiceImpl.java:193-195`) — sequential numeric DEG ids enable trivial enumeration (`for id in 1..N: GET /ingestion/entities/<odd_oddrn>/?id=$id`). Combined with the unauthenticated reach above, the catalog enumeration cost is O(N) where N = number of DEG ids tried. No rate-limit, no audit-log entry, no metric counter on the GET path." — evidence: IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 + ODDPlatformDataEntityGroupPath ODDRN generation pattern + no audit-log call in the service or controller method — severity: HIGH

- "**404 vs empty-200 silent conflation**: an unknown DEG, an empty DEG, a malformed ODDRN, and a NULL-equivalent ODDRN all produce the same `200 OK` with `items: []`. There is no contract distinguishing these conditions. The closely-related `getDataEntityGroupLineage` (F-016 sibling) DOES raise 404 on the same empty-membership condition (LineageServiceImpl.java:62) — the same platform produces two different contracts for the same semantic situation depending on which endpoint a caller hits. No live doc describes either contract." — evidence: DataEntityGroupServiceImpl.java:92-108 (no switchIfEmpty error) + LineageServiceImpl.java:62 (sibling explicitly raises NotFoundException) — severity: MEDIUM

- "**No ODDRN format validation**: the path parameter is a raw `String` passed verbatim into a parameterised SQL predicate. There is no `OddrnFormatValidator` (Grep across `<odd-platform-repo>/odd-platform-api/src/main/java` returns no such class). Callers can submit any string; the response is silently empty for garbage input. The platform has no canonical format-validation layer on read paths; a future ODDRN-shape tightening would need to be added at the controller, the service, or a `@Valid`-style annotation on the generated interface." — evidence: IngestionController.java:76 (parameter type `final String degOddrn`) + DataEntityGroupServiceImpl.java:92-108 (no validation) + ReactiveDataEntityRepositoryImpl.java:318-322 (passes through to jOOQ predicate verbatim) — severity: LOW (input is parameterised so SQL injection not exploitable; the gap is contract-shape, not security-shape)

- "**Soft-deleted members and hollow members surface in the response** — the SQL filters only on `GROUP_ENTITY_RELATIONS.IS_DELETED.isFalse()` (the EDGE soft-delete), not on `DATA_ENTITY.STATUS != DELETED` or `DATA_ENTITY.HOLLOW = false`. A DEG that contains a soft-deleted entity returns that entity in the response. This deviates from the platform's `getDataEntityDefaultConditions` pattern applied across every UI-side search/listing endpoint (per existing search-facet + DataEntity sidecars). The asymmetry is silent — operators integrating against the S2S read surface receive a different view of 'what counts as a member' than UI users see." — evidence: ReactiveDataEntityRepositoryImpl.java:319-322 (only EDGE.IS_DELETED filter, no DATA_ENTITY status/hollow filter) — severity: MEDIUM

- "**Single-level projection — inner DEGs are opaque members**. The SELECT does not recurse into nested DEGs; the response carries `DATA_ENTITY_GROUP`-typed CompactDataEntity entries for nested DEGs without a marker telling the caller they need to re-query. Compare the recursive-CTE behaviour of `getDataEntityGroupLineage` (F-016) which DOES walk nested DEGs. A third-party integration enumerating 'all entities under this DEG' must implement client-side recursion + DEG-type detection — undocumented." — evidence: ReactiveDataEntityRepositoryImpl.java:318-326 (flat join) vs ReactiveGroupEntityRelationRepositoryImpl.java:177-204 (recursive CTE on the lineage side) — severity: LOW (operationally fine for direct-member queries; surprising for 'show me everything')

- "**No `@ReactiveTransactional` on the service method**: a concurrent `DELETE FROM group_entity_relations WHERE group_oddrn = ?` race with the read produces partial visibility. The method `DataEntityGroupServiceImpl.listEntitiesWithinDEG` (line 92) lacks the annotation present on its create/update siblings (lines 62, 73). The race is operationally rare but unhandled." — evidence: DataEntityGroupServiceImpl.java:92 (no annotation) vs lines 62, 73 (siblings ARE annotated) — severity: LOW

- "**No logging, no metrics on the read path**: the controller method has no `log.debug/info/warn` call (line 76-79); the service method has no logging (line 92-108). A security investigation 'who enumerated which DEGs?' cannot be answered from application logs. No Prometheus / OTLP counter on GET ingestion reads (verified: no `meterRegistry.counter(...)` in either method). The endpoint can be probed at scale without audit trace." — evidence: IngestionController.java:30 (@Slf4j) + IngestionController.java:76-79 (no log call) + DataEntityGroupServiceImpl.java:45 (@Slf4j) + DataEntityGroupServiceImpl.java:92-108 (no log call) — severity: MEDIUM (security audit gap; routine for UI reads but distinct for S2S surface)

- "**Response shape is minimal (oddrn + type only)**: CompactDataEntity carries no name, no namespace, no parent-DEG marker, no owner-list. A caller wanting full metadata must follow up with a `GET /api/dataentities/...` call per member — but that endpoint lives on a different prefix (`/api/`, authenticated under UI auth modes) and produces a different result shape. The S2S surface deliberately exposes a narrower projection — but the docs do not name this projection or explain why a caller would use it vs the UI-API." — evidence: IngestionController.java:11 (`CompactDataEntityList`) + DataEntityGroupServiceImpl.java:102-104 (maps to CompactDataEntity with oddrn + type only) — severity: LOW (contract-clarification gap)

## security

- **auth_mode_relevance**: `DISABLED | OAUTH2 | LDAP | LOGIN_FORM — UNAUTHENTICATED IN ALL FOUR MODES due to `/ingestion/**` WHITELIST_PATHS coverage`. The four UI auth modes do NOT protect this path because `SecurityConstants.WHITELIST_PATHS` line 96 (`/ingestion/**`) exempts the entire ingestion prefix from authentication. The S2S filter `IngestionDataEntitiesFilter` is gated by `auth.ingestion.filter.enabled` AND has a hard-coded path matcher of `POST /ingestion/entities` exactly — so it does NOT match this GET path even when enabled. The auth-mode-orthogonal reachability is the load-bearing fact: an operator cannot lock down this endpoint via ANY shipped configuration toggle.
- **ingestion_filter_relevance**: `NO — IngestionDataEntitiesFilter does NOT match this GET path even when auth.ingestion.filter.enabled=true`. The filter's path matcher `PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)` (IngestionDataEntitiesFilter.java:28) is HTTP-method-scoped to POST only AND is the exact literal `/ingestion/entities` (not a wildcard). The templated `/ingestion/entities/{deg_oddrn}` path does NOT match. This is the auth-coverage-gap surfaced in F-008's batch-O extension (`ingestion_filter_path_coverage_incomplete_alertmanager_uncovered`) extended to a read sibling — the same property name (`auth.ingestion.filter.enabled`) suggests broader coverage than it delivers.
- **authorization_assertions**: `[]` — none. There is no `@PreAuthorize` on the controller method (verified IngestionController.java:75-79), no `@PreAuthorize` on the OpenAPI-generated `IngestionApi.getDataEntitiesByDEGOddrn` interface declaration (OpenAPI generators do not emit `@PreAuthorize`), no `permissionService.hasPermission(...)` call at any layer, no `SecurityConstants.SECURITY_RULES` entry for any `/ingestion/*` path (the path is on the WHITELIST), no entry in any reactor `Context` for current-user. The endpoint has ZERO authorization at ZERO layers.
- **owner_scoping**: `N/A — endpoint is not owner-scoped (read-collaborative posture extends here)`. `DataEntityGroupServiceImpl.listEntitiesWithinDEG` has no AuthIdentityProvider field (verified service constructor lines 47-59); makes no `fetchAssociatedOwner()` call; the repository SELECT joins to `DATA_ENTITY` but NOT to `OWNERSHIP`. Any caller reads any DEG's full member list. This matches the platform-wide read-collaborative posture (REFACTOR-024 / REFACTOR-203 / ADR-CANDIDATE-003 / 114) extended to the S2S read surface.
- **data_exposure**:
  - "READ: any caller able to reach the platform's HTTP port can enumerate the member list of any DEG by submitting its ODDRN. The response includes each member's oddrn and DataEntityType. Combined with sequential DEG ids in the ODDRN generation pattern, an attacker can iterate the entire DEG id space and collect the full DEG-to-members mapping for the platform." — evidence: IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 + ODDPlatformDataEntityGroupPath generation (DataEntityGroupServiceImpl.java:193-195) — applies in ALL auth modes
  - "READ (default-off): under `auth.type=DISABLED` (shipped default), ANY caller — including unauthenticated network probes — can perform the above enumeration. This is the same LSN-001 class as the attachment-storage default-data-loss finding and the F-008 default-unauthenticated-ingestion finding, applied to a DEG-member-enumeration vector." — evidence: application.yml:32-34 (auth.type=DISABLED default) + DisabledAuthSecurityConfiguration.anyExchange().permitAll() pattern (sibling sidecars)
  - "READ (filter-enabled-doesn't-help): an operator who has enabled `auth.ingestion.filter.enabled=true` reasonably believes the ingestion endpoints are protected. This endpoint is NOT covered by that filter (path matcher is POST `/ingestion/entities` only). Enabling the toggle does not change this endpoint's reachability. The disconnect between operator mental model and code behaviour is the load-bearing security drift." — evidence: IngestionDataEntitiesFilter.java:28 (exact-path POST-only matcher)
  - "READ (soft-deleted leak): the response includes soft-deleted DATA_ENTITY rows (no STATUS != DELETED filter, no HOLLOW = false filter applied to the joined DATA_ENTITY). An attacker enumerating a DEG can observe entities that have been intentionally hidden from UI users." — evidence: ReactiveDataEntityRepositoryImpl.java:319-322 (only EDGE.IS_DELETED filter)
- **known_security_gaps**:
  - "Endpoint is unauthenticated in every shipped auth mode (DISABLED / OAUTH2 / LDAP / LOGIN_FORM) because `/ingestion/**` is in WHITELIST_PATHS and the `IngestionDataEntitiesFilter` path matcher excludes GET / templated child paths. No live doc warns operators. This is the read-side complement to F-008's destructive-write surface — the BOTH SIDES of the S2S API are unauthenticated by default AND the read side has no opt-in toggle." — evidence: IngestionController.java:76-79 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 + application.yml:32-34, 46-48 — severity: HIGH
  - "DEG catalog enumerable via sequential ODDRN id iteration. The ODDRN generator produces `urn:oddrn:odd:dataentitygroup:{platform_host}/{id}` shapes; the {id} component is the DEG row's primary key, monotonically increasing. An attacker iterating ids 1..N + probing the GET endpoint collects the full membership graph in O(N) requests. No rate-limit at the platform level (verified: no rate-limit annotation on the controller, no per-IP throttle in the WebFlux pipeline)." — evidence: DataEntityGroupServiceImpl.java:191-200 (`ODDPlatformDataEntityGroupPath.builder().id(pojo.getId()).build()` — sequential id construction) + IngestionController.java:76-79 (no rate-limit annotation) — severity: HIGH
  - "Cross-owner enumeration: caller authenticated as owner-A (when auth is enabled at all) reads DEG-X owned by owner-B with no participation check. Extends the REFACTOR-024 / REFACTOR-203 read-collaborative posture to the S2S read surface. Differs from the UI counterparts only in that the UI counterparts at least require authentication; this S2S read does not." — evidence: IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 (no owner filter at any layer) — severity: HIGH (intentional-or-doc-gap per the ADR-CANDIDATE-003 family triage — surface, do not auto-fix)
  - "No audit-log entry on access. The endpoint can be probed at scale (millions of GET requests) without any audit-log row, security log line, or Prometheus counter. A post-incident question 'which DEGs did the attacker enumerate?' has no operational answer. The platform has an Activity feed for DEG mutations but no read-side activity log." — evidence: IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 (no `activityService` call, no `log.info`, no metric counter) — severity: MEDIUM
  - "Filter-coverage-gap: operator enabling `auth.ingestion.filter.enabled=true` believes ingestion is protected; this GET endpoint remains uncovered. The property name + the live S2S doc's recommendation conspire to produce a false-sense-of-security. The same gap covers `POST /ingestion/datasources` (the SIBLING entry point, covered by a different filter — F-008 batch-P) and `POST /ingestion/alert/alertmanager` (covered by NO filter — F-008 batch-O). The S2S surface has THREE distinct auth defaults across its endpoints; the operator-facing property name conflates them." — evidence: IngestionDataEntitiesFilter.java:28 + IngestionController.java:75-79 (this method) + AlertManagerController.java (sibling — no filter coverage) + F-008 batch extensions — severity: HIGH

## performance

- **hot_paths**:
  - "Single SELECT against `GROUP_ENTITY_RELATIONS` joined to `DATA_ENTITY` filtered by `GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())`. No JOIN to OWNERSHIP, no recursive CTE, no aggregation. For a DEG with N members, the query returns N rows; the controller maps them to N CompactDataEntity objects." — evidence: ReactiveDataEntityRepositoryImpl.java:318-326 + DataEntityGroupServiceImpl.java:92-108
  - "Stateless read path — every request incurs: 1 reactive routing decision, 1 SQL roundtrip, 1 list materialisation, 1 stream-map to CompactDataEntity, 1 JSON serialise. No caching layer between the controller and the DB (verified: no `@Cacheable` annotation, no Caffeine cache invocation visible in the read path)."
- **throughput_characteristics**:
  - "Non-batched semantics — one DEG per request. A caller enumerating 1000 DEGs makes 1000 GET requests; there is no `?deg_oddrns=a,b,c` batch parameter (the `Collection<String>` overload at ReactiveDataEntityRepository.java:60 exists at the repository layer but is NOT wired to any controller endpoint)."
  - "Reactive Mono signature — non-blocking from the WebFlux perspective; the R2DBC roundtrip is non-blocking. No `@ReactiveTransactional` — single-statement read, no transaction needed."
- **resource_allocation**:
  - "Per-request DB connection (R2DBC pool default). The SELECT is bounded by the DEG's direct member count — typically dozens to hundreds, not thousands. A pathological DEG with 10K+ members holds the connection for the duration of the result-set drain."
  - "Response payload size: ~ N × 200 bytes (each CompactDataEntity is `{oddrn, type}` — ODDRN strings are typically 100-200 chars + the type enum). For a 10K-member DEG, ~ 2 MB response. WebFlux serialises with default codec settings — no explicit `spring.codec.max-in-memory-size` for outbound."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally."
  - "Single-level read — no JVM stack recursion (contrast the lineage sibling F-016 which DOES use BFS recursion at `LineageServiceImpl.getRelationsForEntities`)."
  - "No pagination — a single response returns all members of the DEG. Pathological DEGs (10K+ members) produce large responses; an operator integrating against the S2S read surface must handle the unbounded list shape. No `?page=&size=` query parameters on this endpoint (the closely-related `listDEGItems` at DataEntityGroupServiceImpl.java:111 DOES paginate — the asymmetry is silent)."
- **known_performance_gaps**:
  - "No batching — enumerating N DEGs costs N HTTP roundtrips. The repository's `Collection<String>` overload (ReactiveDataEntityRepository.java:60) exists but no endpoint exposes it." — evidence: IngestionController.java:75-79 (single-param signature) + ReactiveDataEntityRepository.java:60 (unused batch overload) — severity: LOW
  - "No pagination on the response — 10K-member DEGs return 10K-item lists in one response. The sibling `listDEGItems` (line 111) DOES paginate; this endpoint does not. The asymmetry is undocumented." — evidence: DataEntityGroupServiceImpl.java:92 (no page/size params) vs line 111 (page/size present) — severity: LOW
  - "No caching — repeated reads of the same DEG (common during catalog-walk integrations) re-query the DB each time. The result is identity-stable for a given DEG between mutations; a short-TTL Caffeine cache would reduce DB load proportional to read-fanout." — evidence: no `@Cacheable` on the controller / service / repository method — severity: LOW

## sources

- understanding ← IngestionController.java:75-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 + application.yml:32-34, 46-48
- concepts.entities.degOddrn ← IngestionController.java:76 (parameter declaration) + DataEntityGroupServiceImpl.java:93 (service signature passing through verbatim)
- concepts.entities.CompactDataEntityList ← IngestionController.java:11 (import) + IngestionController.java:76 (return type) + DataEntityGroupServiceImpl.java:102-107 (construction)
- concepts.entities.listEntitiesWithinDEG ← DataEntityGroupService.java:14 (interface) + DataEntityGroupServiceImpl.java:92-108 (implementation)
- concepts.entities.GROUP_ENTITY_RELATIONS ← ReactiveDataEntityRepositoryImpl.java:320-322 (FROM + WHERE clauses)
- concepts.invariants[0] ← IngestionController.java:75-79 (no @PreAuthorize) + DataEntityGroupServiceImpl.java:92-108 (no fetchAssociatedOwner) + IngestionDataEntitiesFilter.java:28 (exact POST-only matcher) + SecurityConstants.java:96 (`/ingestion/**` whitelist)
- concepts.invariants[1] ← DataEntityGroupServiceImpl.java:92-108 (no switchIfEmpty Mono.error) + ReactiveDataEntityRepositoryImpl.java:318-326 (returns Mono of empty List on no rows) + contrast with LineageServiceImpl.java:62
- concepts.invariants[2] ← IngestionController.java:76 (raw `final String degOddrn`) + DataEntityGroupServiceImpl.java:93 (passes through) + ReactiveDataEntityRepositoryImpl.java:322 (passes through to jOOQ predicate)
- concepts.invariants[3] ← ReactiveDataEntityRepositoryImpl.java:318-326 (flat join) vs ReactiveGroupEntityRelationRepositoryImpl.java:177-204 (recursive CTE)
- concepts.invariants[4] ← IngestionController.java:75-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 (no OWNERSHIP join at any layer)
- concepts.invariants[5] ← IngestionController.java:76 (`@Override` only, no `@GetMapping`) + IngestionController.java:31 (`implements IngestionApi`)
- concepts.invariants[6] ← ReactiveDataEntityRepositoryImpl.java:319-322 (only EDGE.IS_DELETED filter)
- dependencies_semantic.requires-feature.IngestionApi ← IngestionController.java:10 (import) + IngestionController.java:31 (implements) + grep evidence that the OpenAPI source is not in odd-platform-specification/openapi.yaml — must live in the separate opendatadiscovery-specification repo
- dependencies_semantic.requires-feature.DataEntityGroupService ← IngestionController.java:16 (import) + IngestionController.java:33 (injection) + DataEntityGroupService.java:14 (interface) + DataEntityGroupServiceImpl.java:92-108 (impl)
- dependencies_semantic.requires-feature.ReactiveDataEntityRepository ← DataEntityGroupServiceImpl.java:55 (injection) + ReactiveDataEntityRepository.java:58 (interface) + ReactiveDataEntityRepositoryImpl.java:318-326 (impl)
- dependencies_semantic.requires-config ← IngestionDataEntitiesFilter.java:20, 28 + application.yml:32-34, 46-48 + SecurityConstants.java:96 + sibling sidecar DisabledAuthSecurityConfiguration evidence
- dependencies_semantic.coupling[0] (read-side of F-008) ← IngestionController.java:75-79 (same controller as F-008's hop-1) + F-008.yaml (Batch Ingestion S2S API)
- dependencies_semantic.coupling[1] (sibling of F-016) ← F-016.yaml (DEG-Anchored Lineage P-05:F-002) + LineageServiceImpl.java:59-85 + DataEntityGroupServiceImpl.java:92-108 (read-collaborative posture extension)
- dependencies_semantic.coupling[2] (CompactDataEntity model) ← IngestionController.java:11 (CompactDataEntityList from ingestion.contract.model) + IngestionController.java:12 (DataEntityList from same package — symmetric model)
- dependencies_semantic.coupling[3] (no transactional annotation) ← DataEntityGroupServiceImpl.java:92 (no annotation) vs lines 62, 73 (siblings annotated)
- dependencies_semantic.coupling[4] (no getDataEntityDefaultConditions) ← ReactiveDataEntityRepositoryImpl.java:319-322 vs the search-facet repository pattern cited in REFACTOR-024 batch-M evidence
- tests_coverage_semantic.uncovered_behaviours ← grep `getDataEntitiesByDEGOddrn|listEntitiesWithinDEG|getDEGEntities` in `<odd-platform-repo>/odd-platform-api/src/test` returned ZERO matches (run 2026-05-20)
- docs_link_semantic.inferred_docs[0] (S2S page) ← prior batch-F WebFetch evidence (2026-05-12, status 200) + this session WebFetch 2026-05-20 ECONNREFUSED (sandbox network restriction)
- docs_link_semantic.inferred_docs[1] (data-ingestion page) ← prior batch-F WebFetch evidence (2026-05-12, status 404) + this session WebFetch 2026-05-20 ECONNREFUSED
- docs_link_semantic.doc_drift_findings[0] ← absence of any live doc on this endpoint per the prior + this-session evidence
- docs_link_semantic.doc_drift_findings[1] ← IngestionDataEntitiesFilter.java:28 (POST-only matcher) + property name `auth.ingestion.filter.enabled` reading as broad coverage
- implicit_adrs[0] (read-collaborative S2S read posture) ← IngestionController.java:75-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 + platform-wide pattern per REFACTOR-024 / REFACTOR-203 / ADR-CANDIDATE-003 family
- implicit_adrs[1] (single-level non-recursive) ← ReactiveDataEntityRepositoryImpl.java:318-326 vs ReactiveGroupEntityRelationRepositoryImpl.java:177-204 (the recursive sibling on the lineage side)
- implicit_adrs[2] (OpenAPI-contract-driven path) ← IngestionController.java:76 (`@Override`, no @GetMapping) + sibling sidecar evidence on createDataSourceEntity invariant about the same convention
- implicit_adrs[3] (empty-200 contract) ← DataEntityGroupServiceImpl.java:92-108 (no switchIfEmpty error) + LineageServiceImpl.java:62 (sibling raises NotFoundException for the same situation)
- bugs_limitations_corner_cases[0] (unauthenticated in every mode) ← IngestionController.java:76-79 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 + application.yml:32-34, 46-48
- bugs_limitations_corner_cases[1] (cross-owner enumeration) ← IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 + DataEntityGroupServiceImpl.java:191-200 (sequential ODDRN id construction)
- bugs_limitations_corner_cases[2] (404 vs empty conflation) ← DataEntityGroupServiceImpl.java:92-108 vs LineageServiceImpl.java:62
- bugs_limitations_corner_cases[3] (no ODDRN format validation) ← IngestionController.java:76 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-322
- bugs_limitations_corner_cases[4] (soft-deleted members surface) ← ReactiveDataEntityRepositoryImpl.java:319-322 (only EDGE.IS_DELETED filter)
- bugs_limitations_corner_cases[5] (single-level projection) ← ReactiveDataEntityRepositoryImpl.java:318-326 vs ReactiveGroupEntityRelationRepositoryImpl.java:177-204
- bugs_limitations_corner_cases[6] (no @ReactiveTransactional) ← DataEntityGroupServiceImpl.java:92 vs lines 62, 73
- bugs_limitations_corner_cases[7] (no logging / metrics) ← IngestionController.java:30 (@Slf4j) + IngestionController.java:76-79 (no log call) + DataEntityGroupServiceImpl.java:45 (@Slf4j) + DataEntityGroupServiceImpl.java:92-108 (no log call)
- bugs_limitations_corner_cases[8] (minimal response shape) ← IngestionController.java:11 (CompactDataEntityList) + DataEntityGroupServiceImpl.java:102-107 (mapper)
- security.auth_mode_relevance ← IngestionController.java:75-79 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 + application.yml:32-34, 46-48
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (PathPatternParserServerWebExchangeMatcher with HttpMethod.POST + exact path)
- security.authorization_assertions ← IngestionController.java:75-79 (verified empty) + DataEntityGroupServiceImpl.java:92-108 (verified empty)
- security.owner_scoping ← IngestionController.java:75-79 + DataEntityGroupServiceImpl.java:47-59 (constructor, no AuthIdentityProvider) + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 (no OWNERSHIP join)
- security.data_exposure ← IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 + ReactiveDataEntityRepositoryImpl.java:318-326 + DataEntityGroupServiceImpl.java:191-200 (ODDRN generation pattern)
- security.known_security_gaps[0] (unauthenticated all modes) ← IngestionController.java:76-79 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 + application.yml:32-34, 46-48
- security.known_security_gaps[1] (sequential id enumeration) ← DataEntityGroupServiceImpl.java:191-200 + IngestionController.java:75-79 (no rate limit)
- security.known_security_gaps[2] (cross-owner enumeration) ← IngestionController.java:75-79 + DataEntityGroupServiceImpl.java:92-108 + ADR-CANDIDATE-003 family
- security.known_security_gaps[3] (no audit-log) ← IngestionController.java:76-79 + DataEntityGroupServiceImpl.java:92-108 (no activityService call, no log, no metric)
- security.known_security_gaps[4] (filter-coverage-gap) ← IngestionDataEntitiesFilter.java:28 + F-008 batch extensions (batch O, P)
- performance.hot_paths ← ReactiveDataEntityRepositoryImpl.java:318-326 + DataEntityGroupServiceImpl.java:92-108 + IngestionController.java:76-79
- performance.throughput_characteristics ← IngestionController.java:75-79 (single-param signature) + ReactiveDataEntityRepository.java:60 (unused batch overload)
- performance.resource_allocation ← ReactiveDataEntityRepositoryImpl.java:318-326 + DataEntityGroupServiceImpl.java:102-107
- performance.scaling_characteristics ← IngestionController.java:32-35 (stateless) + DataEntityGroupServiceImpl.java:92 (no pagination) + sibling listDEGItems at line 111 (with pagination)
- performance.known_performance_gaps[0] ← IngestionController.java:75-79 + ReactiveDataEntityRepository.java:60
- performance.known_performance_gaps[1] ← DataEntityGroupServiceImpl.java:92 vs line 111
- performance.known_performance_gaps[2] ← absence of @Cacheable across the chain (Grep)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (this session's WebFetch failed; cited prior session WebFetch evidence from batch F at 2026-05-12; the prior fetch is recent and the docs structure is stable, but the live verification this session is `network-error`)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## related_features

- P-10:F-001 (F-008) — Batch Ingestion (S2S API): this method is the READ-SIDE complement to F-008's destructive-write surface. F-008 should gain a back-link for the GET read path.
- P-05:F-002 (F-016) — DEG-Anchored Lineage: architectural sibling — same read-collaborative posture, same single-DEG-by-ODDRN access pattern, different response shape (lineage edges vs flat member list) and different 404-vs-empty contract.
- P-11 — Platform API & Developer Surface: this method is one of the P-11 closure targets per state/sprint-themes.yaml theme Z.

## related_refactoring_scopes

- REFACTOR-185 (16-sidecar, DISABLED auth bypass): this endpoint is the SEVENTEENTH supporting sidecar in the family — extends the destructive-write surface finding (sixteenth, IngestionDataEntitiesFilter class-level batch O) to the READ-side surface. Under default deployment, both sides of the S2S API are anonymously reachable; the prescription (boot-time security-posture validator) should compound-check `auth.type=DISABLED` AND `auth.ingestion.filter.enabled=false` AND surface that the validator's check does NOT protect this read endpoint even when toggled.
- REFACTOR-024 (cross-owner read posture, 5-batch / 5-surface family): this endpoint is the SIXTH surface in the family — cross-owner enumeration of DEG MEMBERSHIP joins the catalog enumeration vectors covered by alerts (batch + per-entity), search results, facet aggregators, and DEG-lineage. The S2S surface adds the AUTH-MODE-ORTHOGONAL property — the other five surfaces require authentication; this one does not.

## related_test_gaps

- (new candidate) TEST-GAP-NEW: full HTTP-level test matrix for `getDataEntitiesByDEGOddrn` — happy path, unknown-DEG empty-200 pin, empty-DEG empty-200 pin, malformed-ODDRN empty-200 pin, soft-deleted-member visibility pin, inner-DEG-as-opaque-member pin, cross-owner reach pin, auth-mode reach matrix (DISABLED unauthenticated + OAUTH2 no-token + filter-enabled GET-still-uncovered).

## related_doc_gaps

- (new candidate) DOC-GAP-NEW: the entire S2S read surface has no live doc page. The `configuration-and-deployment/data-ingestion` page does not exist (prior batch-F WebFetch 2026-05-12 status 404). The S2S sub-page covers POST `/ingestion/entities` only (prior batch-F fetch). The endpoint, its response shape (CompactDataEntityList), its 404-vs-empty contract, its auth-mode reachability, and its relationship to `auth.ingestion.filter.enabled` are all undocumented.

## related_concepts

- Data Entity Group (the entity primitive surfaced here)
- Group Entity Relations (the M:N edge table the SELECT queries)
- Read-Collaborative Posture (the platform-wide read-without-owner-scoping pattern, extended here to the S2S surface)
- WHITELIST_PATHS (the auth-bypass mechanism that exempts /ingestion/** from UI auth modes)
- ODDRN (the resource identifier shape, used verbatim as path parameter without validation)
- CompactDataEntity (the minimal response projection)

## related_retrospectives

- LSN-001 — attachment-storage ephemeral default: same default-off-data-class-loss pattern applied to the read-side S2S surface (default deployment ships with this endpoint anonymously reachable).
- LSN-018 — cross-batch reducer contradiction: the maintainer-directed back-links above are an explicit application of LSN-018's Rule 1 (bidirectional back-links between this sidecar and F-008 / F-016 / REFACTOR-185 / REFACTOR-024 + new test/doc-gap candidates). The reducer pass should add the inverse links on the named features and refactors.

## Maintainer notes


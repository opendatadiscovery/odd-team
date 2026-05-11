---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:DataEntityController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-DEC
---

# DataEntityController — semantic understanding

## understanding

`DataEntityController` is the central, largest Spring WebFlux REST controller in `odd-platform-api` — 40 reactive endpoints implementing the OpenAPI-generated `DataEntityApi` interface, fanned out across eleven service collaborators (`DataEntityService`, `DataEntityGroupService`, `OwnershipService`, `AlertService`, `TermService`, `LineageService`, `ActivityService`, `MessageService`, `AlertHaltConfigService`, `MetricService`, `QueryExampleService`). Each method is a one-line delegating pass-through that lifts the service result into a `200 OK` `ResponseEntity` (or `204 No Content` on deletes); the controller carries NO `@PreAuthorize`, NO `@Secured`, NO programmatic permission checks, and NO path/method/produces/consumes annotations — all HTTP wiring lives on the generated `DataEntityApi` interface, and all authorization is bolted on externally via path-pattern matchers in `SecurityConstants.SECURITY_RULES` consumed by `AuthorizationCustomizer`. The controller therefore ships exactly the same per-class shape as `AlertController` (the repository-wide convention), but at 10× the scale, which makes the **consistency of external authorization gating** the single highest-stakes property of this file.

## concepts

- entities: [
    `DataEntity` (root domain object), `DataEntityRef`, `DataEntityDetails`, `DataEntityList`,
    `DataEntityGroup`, `DataEntityGroupItemList`, `DataEntityGroupLineageList`, `DataEntityGroupFormData`, `DataEntityDataEntityGroupFormData`,
    `DataEntityClassAndTypeDictionary`, `DataEntityDomainList`, `DataEntityUsageInfo`,
    `DataEntityLineage` (upstream/downstream graph), `LineageStreamKind` (DOWNSTREAM/UPSTREAM enum),
    `DataEntityStatus`, `DataEntityStatusFormData` (lifecycle: stable/deprecated/deleted/draft/unassigned per live permissions doc),
    `DataEntityAlertConfig` (halt-notification configuration), `AlertList`, `AlertStatus`, `AlertStatusEnum`,
    `Ownership`, `OwnershipFormData`, `OwnershipUpdateFormData`,
    `LinkedTerm`, `DataEntityTermFormData`,
    `Tag`, `TagsFormData`,
    `InternalDescription`, `InternalDescriptionFormData`, `InternalName`, `InternalNameFormData`,
    `MetadataFieldValue`, `MetadataFieldValueList`, `MetadataObject`, `MetadataFieldValueUpdateFormData`,
    `MessageChannelList`, `MessageList`, `Activity`, `ActivityEventType`,
    `MetricSet`, `QueryExample`, `DataEntityQueryExampleFormData`
  ]
- operations:
  - **data-entity-group CRUD**: `createDataEntityGroup` (POST /api/dataentitygroups), `updateDataEntityGroup` (PUT /api/dataentitygroups/{id}), `getDataEntityGroupsChildren` (GET /api/dataentitygroups/{id}/children — paged), `getDataEntityGroupsItems` (GET /api/dataentitygroups/{id}/items — paged + query), `addDataEntityDataEntityGroup` / `deleteDataEntityFromDataEntityGroup` (POST/DELETE /api/dataentities/{id}/data_entity_group)
  - **data-entity ownership**: `createOwnership` (POST), `updateOwnership` (PUT), `deleteOwnership` (DELETE — supports `propagate` flag)
  - **data-entity lineage navigation**: `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (GET /api/dataentities/{id}/lineage/{downstream|upstream} — accepts `lineageDepth` + `expandedEntityIds` list), `getDataEntityGroupsLineage` (GET /api/dataentitygroups/{id}/lineage)
  - **data-entity tagging / terms / status / domain / classes**: `createDataEntityTagsRelations` (PUT /tags — emits `Flux<Tag>` wrapped in `Mono<ResponseEntity<Flux<Tag>>>`), `addDataEntityTerm` / `deleteTermFromDataEntity` (POST/DELETE /terms — note plural path), `updateStatus` (PUT /statuses), `getDataEntityClasses`, `getDomains`
  - **data-entity description / internal name / metadata**: `upsertDataEntityInternalDescription` (PUT /description), `upsertDataEntityInternalName` (PUT /name), `createDataEntityMetadataFieldValue` (POST /metadata — accepts `Flux<MetadataObject>`), `upsertDataEntityMetadataFieldValue` (PUT /metadata/{field_id}), `deleteDataEntityMetadataFieldValue` (DELETE /metadata/{field_id})
  - **data-entity alerts config + listings**: `getDataEntityAlerts` (GET /alerts — paged), `getDataEntityAlertsCounts` (GET /alerts/counts), `getAlertConfig` (GET /alert_config), `updateAlertConfig` (PUT /alert_config — halt-notification flags)
  - **data-entity messaging / discussions**: `getChannels` (GET /channels — Slack channels with messages on this entity), `getDataEntityMessages` (GET /messages), `getMessages` (GET /messages/{message_id} — children of a thread)
  - **metrics access**: `getDataEntityMetrics` (GET /metrics — latest Prometheus-style metric set)
  - **query example linkage**: `createQueryExampleToDatasetRelationshipNew` (POST /queryexample), `deleteQueryExampleToDatasetRelationshipNew` (DELETE /queryexample/{example_id})
  - **per-user / discovery**: `getMyObjects` (GET /api/dataentities/my — paged), `getMyObjectsWithDownstream` (GET /my/downstream), `getMyObjectsWithUpstream` (GET /my/upstream), `getPopular` (GET /api/dataentities/popular — paged), `getDataEntitiesUsage` (GET /api/dataentities/usage — platform-wide usage info)
  - **details + activity**: `getDataEntityDetails` (GET /api/dataentities/{id}), `getDataEntityActivity` (GET /activity — pageable by `lastEventId` + `lastEventDateTime` cursor)
- invariants: [
    "Every endpoint returns `Mono<ResponseEntity<...>>` or `Mono<ResponseEntity<Flux<...>>>` for streaming responses (DataEntityController.java:84-453); successful service emissions always lift to 200 OK or 204 No Content",
    "No request validation, authorization, or owner-scoping happens at the controller layer — all 40 methods are pass-through delegations to a service field",
    "Authorization for mutating endpoints is enforced externally via `SecurityConstants.SECURITY_RULES` path-pattern matchers (e.g. PUT /api/dataentities/{id}/description → DATA_ENTITY_DESCRIPTION_UPDATE), NOT via controller-level annotations",
    "Read endpoints (`getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getMetrics`, `getActivity`, `getChannels`, `getDataEntityClasses`, `getDomains`, `getAlertConfig`, lineage endpoints, getMyObjects*, getPopular, getDataEntitiesUsage, getGroupsChildren/Items/Lineage) have NO entry in `SECURITY_RULES` — they fall through to `pathMatchers(\"/**\").authenticated()` in `AuthorizationCustomizer.java:29-30`, meaning ANY authenticated user can read ANY data entity"
  ]
- audiences: [
    "ODD Platform UI — virtually every screen consumes one or more `DataEntityController` endpoints (search, directory, entity-detail page with its dozen tabs, lineage canvas, alerts panel, messages panel, metrics tab, ownership/tags/terms/description editors, my-objects/popular recommendations)",
    "API consumers building integrations against `/api/dataentities*` and `/api/dataentitygroups*`"
  ]

## dependencies_semantic

- requires-feature: [
    "data-discovery feature (live doc: `https://docs.opendatadiscovery.org/features/data-discovery`, status 200, 2026-05-08) — page describes catalog overview, directory, search/filtering, and the entity-class tabs (`All / My Objects / Datasets / Transformers / Data Consumers / Data Inputs / Quality Tests / Groups / Relationships`) plus the `Recommended` panel containing 'Popular' and 'My Objects' sub-sections that map onto `getPopular` and `getMyObjects*`",
    "data-lineage feature (live doc: `https://docs.opendatadiscovery.org/features/data-lineage`, status 200, 2026-05-08) — page describes upstream/downstream lineage graph containing 'datasets, transformers, transformer runs, quality tests + their runs, consumers, data inputs, data entity groups (including ML experiments), and entity relationships'; the `lineageDepth` + `expandedEntityIds` parameters on `getDataEntity*Lineage` (DataEntityController.java:256-281) implement client-driven progressive expansion of this graph",
    "alerting feature — `getDataEntityAlerts` / `getDataEntityAlertsCounts` (DataEntityController.java:316-330) duplicate Alert listing surface on a per-entity basis (the global surface is `AlertController`); `getAlertConfig` / `updateAlertConfig` (DataEntityController.java:404-421) configure halt-notification flags (e.g. backwards-incompatible schema change alert, failed data quality test, failed job, distribution anomaly per live permissions doc fetched_excerpt)",
    "user→owner association (Owner-link) — `getMyObjects*` (DataEntityController.java:284-305) requires the signed-in user be linked to an Owner record per live data-discovery doc fetched_excerpt: 'My Objects — the most recently ingested five data entities where the user is mentioned as an owner'; without the link these endpoints return empty"
  ]
- requires-config: [] — N/A (controller itself reads no config keys)
- requires-runtime: [
    "Spring WebFlux runtime — uniform `Mono<ResponseEntity<...>>` return type and `ServerWebExchange` parameter (DataEntityController.java:64-65, 84-453)",
    "Reactive authentication context — `getMyObjects*` resolves the current principal via reactor `Context` propagation through `dataEntityService.listAssociated(...)`, NOT via a controller-method parameter (DataEntityController.java:284-305 — no Authentication/Principal argument)",
    "Lombok constructor injection — `@RequiredArgsConstructor` injects all eleven `final` service fields (DataEntityController.java:69, 71-81)"
  ]
- couples-to: [
    "`DataEntityApi` (auto-generated from `odd-platform-specification/openapi.yaml`) — supplies all `@RequestMapping(method=..., value=\"/api/...\", produces=..., consumes=...)` blocks for the 40 endpoints; method signatures here must match exactly or `@Override` compiles fail (verified by grep on DataEntityApi.java for the 40 method names + path patterns)",
    "`SecurityConstants.SECURITY_RULES` (SecurityConstants.java:98-355) — external path-pattern authorization layer that wraps a subset of the controller's mutating endpoints; because this is path-string-coupled, a path mismatch silently disables authorization (see bugs_limitations_corner_cases — the `/term` vs `/terms` mismatch is exactly this failure mode)",
    "Eleven service collaborators (DataEntityController.java:71-81) — all constructor-injected via Lombok; the controller is a fan-in for service composition with no inter-service orchestration logic of its own"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "`updateStatus` (PUT /api/dataentities/{id}/statuses) — happy path (STABLE / DEPRECATED with statusSwitchTime) and exceptional path (DRAFT rejected) covered by `DataEntityStatusChangeTest.statusChangeTest` (DataEntityStatusChangeTest.java:25-52, both `changeStatus` and `changeStatusExceptionally` exercise the controller via `webTestClient.put().uri('/api/dataentities/{data_entity_id}/statuses', ...)`)",
    "`getDataEntityDetails` (GET /api/dataentities/{id}) — exercised as a read-back assertion after status change (DataEntityStatusChangeTest.java:73-80, `webTestClient.get().uri('/api/dataentities/{data_entity_id}', id)`)"
  ]
- uncovered_behaviours: [
    "37 of 40 endpoints have NO controller-boundary integration test (only `updateStatus` + `getDataEntityDetails` are exercised via `webTestClient`; the remaining 38 endpoints — including ALL ownership / tags / terms / description / name / metadata / alert_config / lineage / messaging / metrics / my-objects / popular / activity / DEG-CRUD / query-example endpoints — have no `WebTestClient` smoke test)",
    "Path-pattern authorization wiring — there is no test asserting that mutating endpoints in `SECURITY_RULES` actually require their permission; specifically NO test covers the `/term` (singular, in SECURITY_RULES) vs `/terms` (plural, in actual API) mismatch documented in `bugs_limitations_corner_cases` below — a `WebTestClient` test asserting `403 Forbidden` for an unauthorized caller hitting POST /api/dataentities/1/terms would have caught the gap",
    "Lineage pagination / depth-limit boundary tests (`lineageDepth=0`, very large `expandedEntityIds` list) at the controller boundary — uncovered",
    "Reactive `Context` principal propagation tests for `getMyObjects*` — uncovered (no test asserts that an unauthenticated reactor pipeline correctly resolves the principal, nor that a missing principal degrades to empty rather than crashing)",
    "Bulk operations — there is NO bulk-update endpoint for any per-entity attribute (description, status, ownership, tags, terms, metadata, alert config); operators wanting to mutate N entities must issue N round-trips. Not a test gap per se, but a documented absence."
  ]
- test_files: [
    "<odd-platform>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DataEntityStatusChangeTest.java:1-80 (only DataEntityController-touching test found)"
  ]
- gaps: |
    The test gap is enormous: 38 of 40 endpoints lack any controller-boundary smoke test. The single highest-impact regression risk is the path-pattern authorization layer in `SecurityConstants.SECURITY_RULES` — because authorization is wired by path-string match (not by annotation on the controller method), a typo in the path pattern silently disables authorization without any compile-time or test-time signal. The `/term` (SECURITY_RULES.java:238, 241) vs `/terms` (DataEntityApi.java:148, 542) mismatch IS this exact failure mode in production today (see bugs_limitations_corner_cases) — no test currently catches it. A baseline `@WebFluxTest(DataEntityController.class)` suite asserting (a) `200/204` for an authorized caller on each mutating endpoint and (b) `403 Forbidden` for an unauthorized caller, would catch every future occurrence. The second gap is owner-scoping correctness: `getMyObjects*` is documented in the live data-discovery doc as 'data entities where the user is mentioned as an owner', but no integration test asserts the owner filter is applied — a regression in the reactor `Context` propagation chain (e.g. a misordered `WebFilter`) could silently degrade `/my` to either empty or unscoped output without any test alarm.

## docs_link_semantic

- declared_docs: [] — N/A (the source file carries no `@docs` Javadoc annotation; per slice 6 plan in CLAUDE.md surrounding context, `@docs` annotations have not yet been bootstrapped in this repo)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Catalog interface page describing the per-entity-class tabs and the `Recommended` panel that consumes `getPopular` / `getMyObjects*`; closest live page to the controller's discovery-related endpoints"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "the catalog's home page" / "the home for finding entities in the catalog"
      Entity-class tabs: "All / My Objects / Datasets / Transformers / Data Consumers / Data Inputs / Quality Tests / Groups / Relationships" with per-class counts.
      Faceted left-rail filters: "exposes Datasource / Namespace / Owner / Groups / Statuses facets."
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: "#recommended"
    rationale: "Catalog Overview page documenting the Recommended → Popular and Recommended → My Objects sections; provides verbatim definitions for `getPopular` and `getMyObjects` semantics"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "My Objects — the most recently ingested five data entities where the user is mentioned as an owner."
      "Popular — the most-viewed or most-used data entities across the catalog."
      Distinction note: "Recommended → My Objects displays recently-ingested owned entities, while Alerts → My Objects filters open alerts on the user's owned entities — two different features sharing the same name."
      "Both sections require the signed-in user to be linked to an Owner record for personalized functionality to work."
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "Lineage feature page describing the upstream/downstream graph contents this controller's lineage endpoints expose"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Lineage documents "how entities are connected — which dataset was read by which job, which job produced which model, which microservice traced which call."
      Graph contents: "datasets, transformers, transformer runs, quality tests + their runs, consumers, data inputs, data entity groups (including ML experiments), and entity relationships."
      Two surfaces: "Data-object lineage: catalog entities and connections" and "Microservices lineage: OpenTelemetry-traced calls rendered alongside the data graph."
      (Depth control on `getDataEntity*Lineage` is NOT explicitly described on this page — the `lineageDepth` parameter is a controller-surface detail not surfaced in user-facing prose.)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions reference page enumerating the DATA_ENTITY_* permissions consumed by `SecurityConstants.SECURITY_RULES` to gate this controller's mutating endpoints; the only live source-of-truth for what each permission allows"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      DATA_ENTITY_OWNERSHIP_CREATE: "Allows creating ownership for a data entity."
      DATA_ENTITY_DESCRIPTION_UPDATE: "Allows editing and deleting a data entity's custom description."
      DATA_ENTITY_TAGS_UPDATE: "Allows editing a data entity's tags."
      DATA_ENTITY_ADD_TERM: "Allows adding a term to a data entity."
      DATA_ENTITY_DELETE_TERM: "Allows removing a term from a data entity."
      DATA_ENTITY_STATUS_UPDATE: "Allows changing the lifecycle status of a data entity (e.g., stable, deprecated, deleted, draft, unassigned)."
      DATA_ENTITY_ALERT_CONFIG_UPDATE: "Allows configuring alert settings for a data entity (e.g., backwards-incompatible schema change alert, failed data quality test, failed job, distribution anomaly)."
      DATA_ENTITY_GROUP_UPDATE: "Allows editing a manually created data entity group."
      DATA_ENTITY_ATTACHMENT_MANAGE: "Allows adding, deleting, and managing file attachments and links for a data entity."
      Note from doc: "DATA_ENTITY_GROUP_CREATE is listed under Management permissions, not Data entity permissions."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Auth-mode reference for the four `auth.type` values that govern the UI/API surface this controller is mounted on"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Four `auth.type` modes: DISABLED, LOGIN_FORM, OAUTH2, LDAP — govern "Human users browsing the catalog and programmatic clients calling /api/**".
      S2S ingestion filter is independent: `auth.ingestion.filter.enabled`, default `false`. "Requires Authorization: Bearer <token>; validates the token against the datasource's stored token."
      "Enable the ingestion filter for any deployment where the platform is reachable from an untrusted network."
- doc_drift_findings:
  - "Live `https://docs.opendatadiscovery.org/main-concepts` returns 404 (page-not-found stub redirecting to `/introduction/main-concepts.md`); same for `https://docs.opendatadiscovery.org/data-discovery` (correct path is `/features/data-discovery`). Any internal cross-link in the codebase or sibling docs that uses the un-prefixed path is broken. Severity: needs a separate doc-drift backlog item; not in scope of this controller sidecar to fix."
  - "Live `https://docs.opendatadiscovery.org/features/data-lineage` (status 200) describes the upstream/downstream lineage graph contents but does NOT document the `lineageDepth` / `expandedEntityIds` parameters that `getDataEntity*Lineage` accepts (DataEntityController.java:256-273). For UI-only consumers this is not a gap because the UI sets these parameters, but a third-party API consumer cannot determine bounds, defaults, or pagination semantics from the live doc — they must read the OpenAPI spec or this controller. Severity: documented absence worth tracking as a doc-drift backlog item."

## implicit_adrs

- "Authorization for `DataEntityController` is wired by external path-pattern matching in `SecurityConstants.SECURITY_RULES`, NOT by `@PreAuthorize` annotations on the controller methods or generated `*Api` interface. The trade-off: centralised matrix view of all permissions in one file vs. coupling-by-path-string that breaks silently when paths drift. Path-string coupling has already drifted (see bugs_limitations_corner_cases — `/term` singular in SECURITY_RULES vs `/terms` plural in actual API)." — evidence: DataEntityController.java:1-454 (no `@PreAuthorize`/`@Secured`/permission imports) + SecurityConstants.java:98-355 (path-pattern rules) + grep on DataEntityApi.java for `PreAuthorize|@Secured|@Authorize|hasPermission|hasRole` returned zero matches + AuthorizationCustomizer.java:24-28 (the only consumer of SECURITY_RULES) — confidence: HIGH
- "Read endpoints on `DataEntityController` are NOT in `SECURITY_RULES` — `getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getMetrics`, lineage reads, etc. fall through to `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30). The implicit decision: any authenticated user may read any data entity's full metadata, ownership, alerts, messages, descriptions, and lineage. Whether this is intentional 'collaborative catalog' policy or an oversight is not surfaced in code or docs; from this controller's source alone, ALL data-entity read access is auth-mode-only (no role / owner gate)." — evidence: SecurityConstants.java:98-355 (zero GET rules for /api/dataentities/{id}* read paths) + AuthorizationCustomizer.java:29-30 (`pathMatchers(\"/**\").authenticated()`) — confidence: HIGH
- "Owner-scoped reads (`/my`, `/my/downstream`, `/my/upstream`) take NO principal parameter — the controller delegates to `dataEntityService.listAssociated(page, size [, kind])` and trusts the service to resolve the current user via reactor `Context` propagation. The implicit ADR: principal resolution is a reactor-context concern, not a controller-method-signature concern; the controller does not wire authentication into method calls explicitly." — evidence: DataEntityController.java:284-305 (three `getMyObjects*` methods, none accept `Authentication`/`Principal`/owner-id) — confidence: HIGH
- "Lineage navigation is client-driven by `lineageDepth` + `expandedEntityIds` — the controller does not impose a server-side max depth. The implicit ADR: the back-end trusts the UI to issue bounded depths; a malicious or naive third-party consumer can request arbitrarily deep traversals (the actual bound, if any, lives in `LineageService`, not visible from this file)." — evidence: DataEntityController.java:256-273 (`Integer lineageDepth, List<Long> expandedEntityIds` parameters with no `@Max`/`@Size` constraint at the controller) — confidence: HIGH
- "All 40 endpoints share a uniform `Mono<ResponseEntity<...>>.map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for deletes) pipeline — no `.onErrorResume`, no `.switchIfEmpty(Mono.just(ResponseEntity.notFound()...))`, no try/catch. Non-200/204 responses are produced exclusively by service-thrown exceptions hitting a global Spring exception handler, or by service-emitted `Mono.error(...)` signals." — evidence: DataEntityController.java:84-453 (every method's terminal operator is `.map(ResponseEntity::ok)` or `.thenReturn(ResponseEntity.noContent().build())`) — confidence: HIGH
- "DataEntity is the central domain object; eleven services are fanned-into a single controller rather than split across a dozen sub-controllers (e.g. `DataEntityOwnershipController`, `DataEntityLineageController`). The implicit ADR: keep one HTTP surface per primary domain object; fan-in service composition at the controller layer." — evidence: DataEntityController.java:71-81 (eleven `final` service fields injected) — confidence: HIGH

## bugs_limitations_corner_cases

- "**`SECURITY_RULES` path mismatch — DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM are NOT enforced.** `SecurityConstants.SECURITY_RULES` registers permission gates for path `/api/dataentities/{data_entity_id}/term` and `/api/dataentities/{data_entity_id}/term/{term_id}` (singular `term`), but the actual API path generated from the OpenAPI spec is `/api/dataentities/{data_entity_id}/terms` and `/api/dataentities/{data_entity_id}/terms/{term_id}` (plural `terms`). Because Spring Security's `PathPatternParserServerWebExchangeMatcher` matches by literal path string, the rules NEVER match the actual requests — the endpoints `addDataEntityTerm` (DataEntityController.java:150-156) and `deleteTermFromDataEntity` (DataEntityController.java:159-163) fall through to `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30). Net effect: ANY authenticated user can attach or detach terms on ANY data entity, regardless of policy. This is a privilege-boundary leak under LOGIN_FORM/OAUTH2/LDAP, and anonymous under `auth.type=DISABLED`." — evidence: SecurityConstants.java:237-242 (path uses `/term`) + DataEntityApi.java:128, 148 (`POST /api/dataentities/{data_entity_id}/terms`), DataEntityApi.java:524, 542 (`DELETE /api/dataentities/{data_entity_id}/terms/{term_id}`) + AuthorizationCustomizer.java:24-30 (path-pattern matcher loop + fall-through to `authenticated()`) — severity: HIGH
- "**No tests cover 38 of 40 endpoints at the controller boundary.** Only `updateStatus` and `getDataEntityDetails` are exercised by `DataEntityStatusChangeTest` (the only DataEntityController-touching test in `odd-platform-api/src/test/`). A breaking change to the OpenAPI generator template, the path-pattern security wiring, the WebFlux configuration, or any Jackson serialiser config could silently break 38 production endpoints with the test suite still green. The smallest reproducer: a `@WebFluxTest(DataEntityController.class)` baseline asserting `200/204` per endpoint plus `403 Forbidden` per `SECURITY_RULES`-gated endpoint for an unauthorized caller." — evidence: `find odd-platform -path '*test*' -name 'DataEntityController*'` returned no matches; `grep -l 'DataEntityController\\|listAssociated\\|listPopular\\|getDetails' odd-platform-api/src/test/**/*.java` matched only 3 ingestion tests, and only `DataEntityStatusChangeTest.java:25-80` actually exercises controller endpoints — severity: MEDIUM
- "**Lineage endpoints accept unbounded `lineageDepth` and unbounded `expandedEntityIds` list at the controller.** `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (DataEntityController.java:256-273) declare `Integer lineageDepth, List<Long> expandedEntityIds` with no `@Max`, no `@Size`, no clamp. A caller passing `lineageDepth=1000000` triggers a `LineageService` traversal bounded only by whatever (if any) limit `LineageService.getLineage(...)` enforces; from this controller alone, the worst-case CPU/memory/DB cost is unbounded. Same applies to `getDataEntitiesUsage` / `getPopular` — no size cap." — evidence: DataEntityController.java:256-273, 308-313, 368-371 (no constraint annotations on parameters at the controller) — severity: MEDIUM
- "**Pagination on list endpoints is required but not validated by the controller.** `getDataEntityGroupsChildren`, `getDataEntityGroupsItems`, `getMyObjects*`, `getPopular`, `getDataEntityAlerts`, `getDataEntityMessages` all accept `Integer page, Integer size` without `@Min(1)`, `@Max(...)`, or null-checks at the controller. A caller passing `size=1000000` is rate-limited only by what the service / repository accepts (the validation, if any, lives on the generated `DataEntityApi` interface as `@NotNull @Valid @RequestParam` per the AlertController pattern, but that does NOT bound the value)." — evidence: DataEntityController.java:101-115, 284-313, 316-321, 383-390 (page/size as plain `Integer`, no bound annotations at controller) — severity: MEDIUM
- "**`getDataEntityActivity` cursor pagination uses `lastEventId` + `lastEventDateTime` — vulnerable to clock skew and duplicate IDs.** The cursor scheme delegates to `activityService.getDataEntityActivityList(beginDate, endDate, size, dataEntityId, userIds, eventType, lastEventId, lastEventDateTime)`. If two events share a `lastEventDateTime` and a malicious or naïve client constructs an inconsistent `(lastEventId, lastEventDateTime)` pair, the service-layer query may skip or duplicate events. The controller does no validation of the pair." — evidence: DataEntityController.java:352-365 — severity: LOW
- "**No `@Timed` / Micrometer / structured-logging instrumentation at the controller layer.** Forty endpoints, none are observed at the controller boundary; latency regressions on data-entity reads (the platform's hottest path) are visible only through downstream service / DB metrics, not via per-endpoint instrumentation." — evidence: DataEntityController.java:1-454 (no `@Timed`, no `MeterRegistry`, no `Logger.info(...)` invocations in any method body — only the `@Slf4j` class-level annotation, which gives `log` but is unused) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that protect the UI/API surface this controller is mounted on (per live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`, status 200, fetched_excerpt under `documents`). `DISABLED` skips authentication entirely, making every endpoint anonymously reachable (no fail-closed behaviour). `S2S` is NOT relevant — the S2S ingestion filter is mounted only on `/ingestion/entities` (per the AlertController sidecar's evidence on `IngestionDataEntitiesFilter.java:28`), not on `/api/dataentities*` or `/api/dataentitygroups*`. The controller class itself carries NO `@ConditionalOnProperty` (always wired regardless of `auth.type`); the auth wiring lives in the per-mode `*SecurityConfiguration.java` beans (cf. AlertController sidecar for the four `auth.type` `havingValue` references).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. All 40 paths exposed by this controller live under `/api/dataentities*` or `/api/dataentitygroups*` (per DataEntityApi.java path mappings), none of which match the `IngestionDataEntitiesFilter`'s `/ingestion/entities` path matcher. Per the live security doc fetched_excerpt: "ODD Platform has two independent authentication surfaces, each governed by its own configuration flag. Enabling one does not protect the other."
- **authorization_assertions**: [] at the controller and at the generated interface — `DataEntityController.java:1-454` carries zero `@PreAuthorize`, zero `@Secured`, zero programmatic `permissionService.hasPermission(...)` call. The generated `DataEntityApi.java` (verified via grep on `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` — zero matches) likewise carries no annotations. **Authorization for this controller is enforced exclusively via `SecurityConstants.SECURITY_RULES`** (SecurityConstants.java:98-355), a list of `(AuthorizationManagerType, PathPatternParserServerWebExchangeMatcher, PolicyPermissionDto)` triples consumed by `AuthorizationCustomizer.java:24-28`. The mapping for THIS controller's mutating endpoints is:
  - POST /api/dataentitygroups → `DATA_ENTITY_GROUP_CREATE` (NO_CONTEXT) [SecurityConstants.java:109-110]
  - PUT /api/dataentitygroups/{id} → `DATA_ENTITY_GROUP_UPDATE` (DEG context) [SecurityConstants.java:308-311]
  - PUT /api/dataentities/{id}/description → `DATA_ENTITY_DESCRIPTION_UPDATE` (DATA_ENTITY) [SecurityConstants.java:194-197]
  - PUT /api/dataentities/{id}/name → `DATA_ENTITY_INTERNAL_NAME_UPDATE` (DATA_ENTITY) [SecurityConstants.java:198-200]
  - POST /api/dataentities/{id}/metadata → `DATA_ENTITY_CUSTOM_METADATA_CREATE` (DATA_ENTITY) [SecurityConstants.java:201-203]
  - PUT /api/dataentities/{id}/metadata/{field_id} → `DATA_ENTITY_CUSTOM_METADATA_UPDATE` (DATA_ENTITY) [SecurityConstants.java:204-207]
  - DELETE /api/dataentities/{id}/metadata/{field_id} → `DATA_ENTITY_CUSTOM_METADATA_DELETE` (DATA_ENTITY) [SecurityConstants.java:208-211]
  - PUT /api/dataentities/{id}/tags → `DATA_ENTITY_TAGS_UPDATE` (DATA_ENTITY) [SecurityConstants.java:212-214]
  - POST /api/dataentities/{id}/ownership → `DATA_ENTITY_OWNERSHIP_CREATE` (DATA_ENTITY) [SecurityConstants.java:215-217]
  - PUT /api/dataentities/{id}/ownership/{ownership_id} → `DATA_ENTITY_OWNERSHIP_UPDATE` (DATA_ENTITY) [SecurityConstants.java:218-222]
  - DELETE /api/dataentities/{id}/ownership/{ownership_id} → `DATA_ENTITY_OWNERSHIP_DELETE` (DATA_ENTITY) [SecurityConstants.java:223-227]
  - POST /api/dataentities/{id}/data_entity_group → `DATA_ENTITY_ADD_TO_GROUP` (DATA_ENTITY) [SecurityConstants.java:228-231]
  - DELETE /api/dataentities/{id}/data_entity_group/{group_id} → `DATA_ENTITY_DELETE_FROM_GROUP` (DATA_ENTITY) [SecurityConstants.java:232-236]
  - PUT /api/dataentities/{id}/statuses → `DATA_ENTITY_STATUS_UPDATE` (DATA_ENTITY) [SecurityConstants.java:277-281]
  - PUT /api/dataentities/{id}/alert_config → `DATA_ENTITY_ALERT_CONFIG_UPDATE` (DATA_ENTITY) [SecurityConstants.java:304-307]
  - POST /api/dataentities/{id}/queryexample → `QUERY_EXAMPLE_DATASET_CREATE` (DATA_ENTITY) [SecurityConstants.java:318-320]
  - DELETE /api/dataentities/{id}/queryexample/{example_id} → `QUERY_EXAMPLE_DATASET_DELETE` (DATA_ENTITY) [SecurityConstants.java:321-324]
  - POST /api/dataentities/{id}/term → `DATA_ENTITY_ADD_TERM` (DATA_ENTITY) — **PATH MISMATCH: actual API path is `/terms` plural, rule never matches** [SecurityConstants.java:237-239]
  - DELETE /api/dataentities/{id}/term/{term_id} → `DATA_ENTITY_DELETE_TERM` (DATA_ENTITY) — **PATH MISMATCH: actual API path is `/terms/{term_id}` plural, rule never matches** [SecurityConstants.java:240-242]
- **owner_scoping**:
  - `RESPECTS — filters by current user's owners` (delegated) for `getMyObjects` / `getMyObjectsWithDownstream` / `getMyObjectsWithUpstream` (DataEntityController.java:284-305) — the controller passes only `(page, size [, kind])` without an explicit principal; per the live data-discovery `catalog-overview` doc fetched_excerpt: "My Objects — the most recently ingested five data entities where the user is mentioned as an owner." Owner-scoping correctness is delegated to `dataEntityService.listAssociated(...)` resolving the principal via reactor `Context`. From the controller's source alone, the delegation is verifiable; the *correctness* of the downstream filter is not.
  - `BYPASSES — returns data across owners` for `getPopular` (DataEntityController.java:308-313) per the live `catalog-overview` doc: "Popular — the most-viewed or most-used data entities across the catalog." No owner filter.
  - `BYPASSES — returns data across owners` for `getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getDataEntityActivity`, `getDataEntityMetrics`, `getDataEntityClasses`, `getDomains`, `getDataEntitiesUsage`, `getChannels`, lineage reads, DEG `getDataEntityGroups{Children,Items,Lineage}` — all 27+ read endpoints take no principal/owner argument (DataEntityController.java:139-453 — no `Authentication`/`Principal` parameter on any read method). The ODD design choice here appears to be 'collaborative catalog: any authenticated user can read any entity'; whether this is intentional is not surfaced in code or live docs.
  - `N/A — operation is gated by SECURITY_RULES, owner-scoping is per-permission` for the 17 mutating endpoints registered in `SECURITY_RULES` — the per-resource permission decision (e.g. `DATA_ENTITY_DESCRIPTION_UPDATE` against the specific data_entity_id) is made by the `DATA_ENTITY` `AuthorizationManagerType` policy resolver, which evaluates the user's policies against the resource's properties (owner, namespace, datasource, class, type per `DataEntityPolicyResolverContext` — found at `service/policy/comparer/dataentity/*.java`). Owner-scoping for these is therefore policy-driven, not controller-driven.
- **data_exposure**:
  - "Full data-entity payload (`DataEntityDetails`: id, oddrn, internal name, description, owners, tags, terms, status, type, classes, namespace, data source, metadata field values, lineage shortcuts, alert config) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/dataentities/{id}` — no role / permission gate; under `auth.type=DISABLED` this is anonymous. The exposure includes user-supplied `description` and `internal name` fields which may contain PII or business-sensitive content." — evidence: DataEntityController.java:139-147 (no permission check, no `SECURITY_RULES` entry for GET path) + AuthorizationCustomizer.java:29-30 (fall-through to `authenticated()`)
  - "Per-entity Alert listings (`AlertList` payloads with reasons, severity, status, lastUpdatedAt) → ANY authenticated user via `GET /api/dataentities/{id}/alerts` — same auth-mode-only gate." — evidence: DataEntityController.java:316-321
  - "Slack message threads on a data entity (`MessageList` payloads) → ANY authenticated user via `GET /api/dataentities/{id}/messages` and `GET /api/dataentities/{id}/messages/{message_id}` — same auth-mode-only gate; potential PII / business-discussion exposure if Slack threads contain user-supplied content." — evidence: DataEntityController.java:382-402
  - "Activity log (`Activity` payloads with userId, eventType, eventTime, change deltas) → ANY authenticated user via `GET /api/dataentities/{id}/activity` — exposes the full audit trail of who-changed-what for any entity." — evidence: DataEntityController.java:351-365
  - "Lineage graph (`DataEntityLineage` payloads) → ANY authenticated user via `GET /api/dataentities/{id}/lineage/{downstream|upstream}` — reveals full upstream/downstream topology including microservice connections per the live data-lineage doc fetched_excerpt." — evidence: DataEntityController.java:256-281
  - "Metric set (`MetricSet` — Prometheus-style metric values for the entity) → ANY authenticated user via `GET /api/dataentities/{id}/metrics` — exposes operational telemetry that may include row counts, latency distributions, etc." — evidence: DataEntityController.java:423-428
  - "User→entity association via `getMyObjects*` — leaks 'this user owns these entities' to the calling principal (their own session); the data is owner-scoped server-side per the live doc, but the per-user ownership edges are nonetheless surfaced." — evidence: DataEntityController.java:284-305
  - "Mutation surfaces (description, internal name, tags, terms, statuses, ownership, alert config, metadata, DEG membership) → only callers with the per-resource DATA_ENTITY_* permission via `SECURITY_RULES` policy evaluation — EXCEPT `addDataEntityTerm` / `deleteTermFromDataEntity` which are NOT gated due to the `/term` vs `/terms` path mismatch, falling through to authenticated-only." — evidence: DataEntityController.java:150-163 + SecurityConstants.java:237-242 (path mismatch documented in `bugs_limitations_corner_cases`)
- **known_security_gaps**:
  - "**`SECURITY_RULES` path-matcher mismatch silently disables `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM`.** Rules at SecurityConstants.java:237-242 use path `/api/dataentities/{data_entity_id}/term` and `/api/dataentities/{data_entity_id}/term/{term_id}` (singular), but the actual generated API paths are `/terms` and `/terms/{term_id}` (plural — DataEntityApi.java:148, 542). The path-pattern matcher never fires, and the endpoints fall through to `pathMatchers(\"/**\").authenticated()`. Net effect: any authenticated user can attach or detach terms on any data entity, regardless of policy. Anonymous under `auth.type=DISABLED`." — evidence: SecurityConstants.java:237-242 + DataEntityApi.java:148, 542 + AuthorizationCustomizer.java:29-30 — severity: HIGH
  - "**All read endpoints (27+ of 40) are auth-mode-only — no role/owner/permission gate.** Including `getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getActivity`, `getMetrics`, lineage reads, DEG children/items/lineage. Any authenticated user under LOGIN_FORM/OAUTH2/LDAP can read any data entity's full metadata, ownership history, alerts, and discussion threads. Whether this is intentional 'collaborative catalog' policy or an oversight is not stated in live docs. Under `auth.type=DISABLED`, every read becomes anonymous." — evidence: DataEntityController.java:139-453 (read methods) + SecurityConstants.java:98-355 (zero GET rules for /api/dataentities/{id}* read paths — only POST/PUT/DELETE rules exist) + AuthorizationCustomizer.java:29-30 — severity: MEDIUM (HIGH if regulated data is in description / metadata / messages fields)
  - "**`getDataEntityActivity` exposes who-changed-what audit trail to any authenticated user.** No role gate — every user can see every other user's edits to every data entity. May leak organisational structure, sensitive change history, or PII embedded in activity payloads." — evidence: DataEntityController.java:351-365 — severity: MEDIUM
  - "**`getDataEntityMessages` exposes Slack-thread content to any authenticated user.** Per the live channels endpoint description ('top X channels in which there are messages about this data entity' — DataEntityApi.java:596), this returns user-supplied Slack discussion content. Without a per-channel ACL at the platform layer, this is a cross-tenant content exposure if the Slack workspace has multiple sensitive channels." — evidence: DataEntityController.java:382-402 — severity: MEDIUM
  - "**Authorization layer is path-string-coupled with no compile-time or test-time guard against drift.** A typo in `SecurityConstants.java` (singular vs plural, missing trailing slash, wrong HTTP method) silently disables the gate without any signal. Existing example: the `/term` mismatch above. There is no integration test asserting `403 Forbidden` for unauthorized callers on the gated endpoints (only happy-path `200` for `updateStatus` is covered in `DataEntityStatusChangeTest`)." — evidence: SecurityConstants.java:98-355 (path-string rules) + AuthorizationCustomizer.java:24-30 (no fallback, no logging when zero rules match a request) + `find odd-platform -path '*test*' -name 'DataEntityController*'` returned no matches — severity: HIGH (root cause of the term path mismatch)
  - "**`getDataEntityClasses` and `getDomains` are platform-wide reads with no permission gate** — they expose the full set of data entity classes/types and domains across the entire installation. Limited PII/security risk in themselves, but they enumerate the platform's data taxonomy to any authenticated user (and to anonymous callers under `auth.type=DISABLED`)." — evidence: DataEntityController.java:226-230, 431-434 — severity: LOW
  - "**`getDataEntitiesUsage` is a platform-wide aggregate with no role gate** — exposes per-entity usage telemetry across the whole catalog to any authenticated user. May leak which entities are most-used, by extension which business areas are active." — evidence: DataEntityController.java:368-371 — severity: LOW
  - "**`getMyObjects*` correctness depends on reactor `Context` principal propagation through `dataEntityService.listAssociated(...)`.** A regression in the WebFlux security filter chain (e.g. a misordered `WebFilter`) could silently degrade `/my` to either empty or unscoped output (returning ALL entities to a principal that thinks they're seeing only their own) without any controller-layer alarm." — evidence: DataEntityController.java:284-305 (no principal parameter) + service-layer not visible from this file — severity: MEDIUM

## performance

- **hot_paths**:
  - "`GET /api/dataentities/{id}` (`getDataEntityDetails`) is the platform's single hottest endpoint — every UI navigation to an entity-detail page invokes this; mobile, deep-link, and bookmarked URLs all fan into this method. A details payload includes ownership, tags, terms, description, status, type, classes, namespace, data source, metadata field values — likely a multi-table JOIN at the repository." — evidence: DataEntityController.java:139-147 (single `dataEntityService.getDetails(dataEntityId)` delegation)
  - "`GET /api/dataentities/{id}/lineage/{downstream|upstream}` (lineage walks) — the most CPU/memory-expensive endpoint family. Walks the lineage graph up to client-supplied `lineageDepth`; with `expandedEntityIds` carrying many ids, may N+1-fetch entity details per node. Lineage-canvas panning/zooming in the UI re-issues these on every interaction." — evidence: DataEntityController.java:256-281
  - "`GET /api/dataentitygroups/{id}/lineage` (`getDataEntityGroupsLineage`) — DEG lineage union; semantically a multi-entity lineage walk." — evidence: DataEntityController.java:276-281
  - "`GET /api/dataentities/popular` and `GET /api/dataentities/my*` — recommendation-panel hot paths invoked on every catalog-overview render." — evidence: DataEntityController.java:284-313
  - "`GET /api/dataentities/usage` — per-render aggregate across the whole catalog." — evidence: DataEntityController.java:368-371
  - "`GET /api/dataentities/{id}/metrics` — per-entity Prometheus-style metric query, invoked on entity-detail Metrics tab open." — evidence: DataEntityController.java:423-428
  - "`GET /api/dataentitygroups/{id}/items` — paged DEG-items listing with optional `query` text filter; invoked on DEG-detail page render and on every search-within-DEG keystroke." — evidence: DataEntityController.java:108-116
- **throughput_characteristics**:
  - "All 40 endpoints are reactive `Mono<ResponseEntity<...>>` (or `Mono<ResponseEntity<Flux<...>>>` for streaming) — non-blocking I/O; the uniform `.map(ResponseEntity::ok)` lifting pattern means no per-call thread is held during DB await." — evidence: DataEntityController.java:84-453 (every method's signature)
  - "Single-item operations only — no bulk-update endpoint for description, internal name, tags, terms, status, ownership, metadata, alert config, or DEG membership. A consumer needing to mutate 100 entities (e.g. bulk-tag a namespace's worth of entities) must issue 100 sequential round-trips. The only batch-shaped input is `createDataEntityMetadataFieldValue` (DataEntityController.java:119-127, accepts `Flux<MetadataObject>` for ONE entity)." — evidence: DataEntityController.java:84-453 — single `Long dataEntityId` path variable on every per-entity mutation; no bulk variant in the file
  - "Owner-scoped reads (`getMyObjects*`, DataEntityController.java:284-305) — at minimum two DB round-trips: principal→owner association resolution (via reactor `Context`) plus owners→entities filter." — evidence: DataEntityController.java:284-305
  - "Activity stream (`getDataEntityActivity`, DataEntityController.java:351-365) uses cursor-based pagination (`lastEventId` + `lastEventDateTime`) rather than offset pagination — appropriate for append-only audit data and avoids deep-offset performance cliffs." — evidence: DataEntityController.java:351-365
- **resource_allocation**:
  - "Each Mono signature is non-blocking; per-call DB round-trip is delegated to one of eleven services. The controller itself allocates only the `ResponseEntity` wrapper and the reactive subscription. No per-request HTTP-client construction, no in-memory accumulation, no caching at the controller layer." — evidence: DataEntityController.java:71-81 (eleven `final` service fields, constructor-injected once) + DataEntityController.java:84-453 (no allocations beyond service call and `ResponseEntity::ok`)
  - "`createDataEntityMetadataFieldValue` (DataEntityController.java:119-127) calls `metadataObject.collectList()` BEFORE delegating — this materialises the entire `Flux<MetadataObject>` payload into a `List<MetadataObject>` in memory. For very large metadata payloads, peak memory is bounded by the request body size but the operation is no longer streaming." — evidence: DataEntityController.java:124 (`return metadataObject.collectList()`)
  - "`createDataEntityTagsRelations` (DataEntityController.java:243-253) returns `Mono<ResponseEntity<Flux<Tag>>>` — the response BODY is a Flux, so individual tags stream to the client as they're emitted by the service. Memory-bounded streaming response." — evidence: DataEntityController.java:243-253
  - "Constructor-injected dependencies are singletons (`@RestController` + `@RequiredArgsConstructor` produces a Spring-managed singleton bean) — no per-request bean creation overhead, but the eleven service fields imply a fan-out that may dominate Spring context startup." — evidence: DataEntityController.java:67-81
- **scaling_characteristics**:
  - "Stateless controller — no instance fields beyond the eleven injected services; horizontal scaling via instance count is unconstrained at the controller layer (any DB / reactor scheduler bottlenecks are downstream)." — evidence: DataEntityController.java:71-81 (only `final` service fields)
  - "No locking, no advisory-lock acquisition, no in-memory queue — request handling is purely a reactive pipeline through to the service layer." — evidence: DataEntityController.java:1-454 (no `Lock`, `Semaphore`, `synchronized`, `AtomicReference`, queue/buffer types)
  - "Pagination IS exposed on list endpoints (`getDataEntityGroupsChildren`, `getMyObjects*`, `getPopular`, `getDataEntityAlerts`, `getDataEntityMessages`, etc.), so per-request payload size is bounded by the caller-supplied `size` — but no upper bound enforced at the controller; an absent or malicious `size` value can produce arbitrarily large response bodies and arbitrary repository load (cf. AlertController sidecar's same finding)." — evidence: DataEntityController.java:101-115, 284-313, 316-321, 383-390 (no `@Max` / no clamping logic)
  - "Lineage endpoints take an unbounded `lineageDepth` and an unbounded `expandedEntityIds` list — pagination DOES NOT apply (the response is the full sub-graph at the requested depth). Server-side max-depth, if any, lives in `LineageService`, not visible from this file." — evidence: DataEntityController.java:256-273 (parameters declared, no constraint annotations)
  - "Activity stream uses cursor pagination (`lastEventId` + `lastEventDateTime`) — scales linearly with data growth without deep-offset penalties." — evidence: DataEntityController.java:351-365
- **known_performance_gaps**:
  - "**No upper bound on pagination `size` parameter at the controller — a caller passing `size=1000000` triggers a service-layer query bounded only by whatever (if any) limit `dataEntityService.*` enforces; from this file alone, worst-case response body and DB cost are unbounded.** Same root cause as the AlertController gap." — evidence: DataEntityController.java:101-115, 284-313, 316-321, 383-390 — severity: MEDIUM
  - "**No max-depth bound on lineage endpoints at the controller — `lineageDepth=1000000` reaches the service layer unmodified.** A naïve or malicious client can request arbitrarily deep traversals; the only mitigation is whatever (if any) cap exists in `LineageService.getLineage(...)`. Lineage walks are graph-traversal-bounded by graph density, so the worst case is full-graph fetch." — evidence: DataEntityController.java:256-273 — severity: MEDIUM
  - "**No upper bound on `expandedEntityIds` list size — a caller passing 100K ids forces 100K per-id processing in `LineageService`.** No `@Size(max=...)` at the controller." — evidence: DataEntityController.java:256-273 — severity: LOW
  - "**No caching on `getDataEntityClasses` / `getDomains` / `getDataEntitiesUsage` — these three endpoints return slow-changing platform-wide aggregates yet have no `Cache-Control` header, no ETag, and no in-memory cache at the controller.** Every catalog-overview render re-runs them; for high-traffic platforms the aggregations land on the DB on every request." — evidence: DataEntityController.java:226-230, 368-371, 431-434 — severity: LOW
  - "**No request observability at the controller layer — no `@Timed`, no Micrometer counters, no MDC structured logging on entry/exit.** Latency regressions on the platform's hottest endpoint family (`getDataEntityDetails`, `getDataEntityDownstreamLineage`) are visible only via downstream service / DB metrics, not at the controller boundary. The `@Slf4j`-provided `log` field (DataEntityController.java:68) is unused — class-level annotation gives access but no method body invokes `log.info/debug/error`." — evidence: DataEntityController.java:1-454 (no `@Timed`, no `MeterRegistry`, zero `log.*` invocations) — severity: LOW
  - "**`createDataEntityMetadataFieldValue` materialises the full `Flux<MetadataObject>` request body via `collectList()` BEFORE delegating to the service.** For very large metadata payloads this defeats streaming and pins peak memory at request-body size. Acceptable for typical metadata payloads (small dictionaries) but worth surfacing." — evidence: DataEntityController.java:119-127 — severity: LOW
  - "**Per-entity message thread (`getDataEntityMessages`) and channels (`getChannels`) endpoints have no pagination cap at the controller** — `Integer size` is unbounded; for entities with thousands of Slack messages this can produce arbitrarily large response bodies." — evidence: DataEntityController.java:374-402 — severity: LOW
  - "**Single-item-only mutations preclude bulk-operator workflows** ('tag every entity in this namespace', 'set status=DEPRECATED on a list of 50 entities', 'add term X to all entities matching filter F'). Forces N round-trips. Not a bug, but a documented absence callers should know about before building integrations." — evidence: DataEntityController.java:84-453 (no bulk variant for any mutation) — severity: LOW

## sources

- understanding ← DataEntityController.java:1-454 (full file; the four-sentence claim mirrors the file's actual shape — 40 one-line delegating methods, eleven service fields, no annotations beyond `@RestController` + `@Slf4j` + `@RequiredArgsConstructor` + `@Override`) + DataEntityApi.java grep result for HTTP method/path mappings + SecurityConstants.java:98-355 (external authorization layer reference)
- concepts.entities ← DataEntityController.java:9-47 (38 model imports) + DataEntityController.java:48-49 (DTO imports for AlertStatusEnum and LineageStreamKind)
- concepts.operations ← DataEntityController.java:84-453 (40 method signatures grouped by sub-concept) + DataEntityApi.java HTTP method/path mappings (grep results 92-1473) — group labels and HTTP-verb/path bindings verified per method
- concepts.invariants[0] ← DataEntityController.java:84-453 (every method returns `Mono<ResponseEntity<...>>` or `Mono<ResponseEntity<Flux<...>>>`; every method's terminal operator is `.map(ResponseEntity::ok)` or `.thenReturn(ResponseEntity.noContent().build())`)
- concepts.invariants[1] ← DataEntityController.java:1-454 (no `@PreAuthorize`/`@Secured`/imports of Spring Security; no validation annotations beyond `@Valid` on form-data Mono/Flux which is request-body deserialisation, not authorization)
- concepts.invariants[2] ← SecurityConstants.java:98-355 (external SECURITY_RULES list) + AuthorizationCustomizer.java:24-28 (the only consumer of SECURITY_RULES) + grep on DataEntityApi.java for `PreAuthorize|@Secured|hasPermission|hasRole` returned zero matches
- concepts.invariants[3] ← SecurityConstants.java:98-355 (every entry is a POST/PUT/DELETE/PATCH path-pattern; zero GET-method rules for /api/dataentities/{id}* read paths) + AuthorizationCustomizer.java:29-30 (`pathMatchers(\"/**\").authenticated()` fall-through)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-08) — fetched excerpt under `documents.inferred_docs[0].fetched_excerpts`
- dependencies_semantic.requires-feature ← WebFetch data-discovery page (status 200, 2026-05-08) + WebFetch data-lineage page (status 200, 2026-05-08) + WebFetch catalog-overview page (status 200, 2026-05-08, fetched_excerpts)
- dependencies_semantic.requires-runtime ← DataEntityController.java:64-65 (`reactor.core.publisher.Flux/Mono`), 84-453 (`ServerWebExchange exchange` parameter on every method), DataEntityController.java:69 (`@RequiredArgsConstructor`), DataEntityController.java:71-81 (eleven `final` service fields)
- dependencies_semantic.couples-to ← DataEntityController.java:9 (`import ... DataEntityApi`), 70 (`implements DataEntityApi`), 71-81 (eleven service fields), SecurityConstants.java:98-355 (path-pattern rules) + AuthorizationCustomizer.java:24-28
- tests_coverage_semantic.covered_behaviours ← DataEntityStatusChangeTest.java:25-52 (`statusChangeTest` happy + exceptional paths) + DataEntityStatusChangeTest.java:73-80 (`getDetails` read-back assertion)
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'DataEntityController*'` returned no matches; `grep -l 'DataEntityController\\|listAssociated\\|listPopular\\|getDetails' odd-platform-api/src/test/**/*.java` matched only `DataEntityStatusChangeTest.java` (the only test that actually exercises controller endpoints — the other two matches reference DataEntity in ingestion contexts, not controller paths)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[3] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[4] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08, status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch `https://docs.opendatadiscovery.org/main-concepts` 2026-05-08, status 404 (page-not-found stub redirecting to `/introduction/main-concepts.md`) + WebFetch `https://docs.opendatadiscovery.org/data-discovery` 2026-05-08, status 404 (correct path is `/features/data-discovery`)
- docs_link_semantic.doc_drift_findings[1] ← WebFetch data-lineage page (status 200) — page describes graph contents but does NOT mention `lineageDepth` / `expandedEntityIds` parameters
- implicit_adrs[0] ← DataEntityController.java:1-454 (no annotations) + SecurityConstants.java:98-355 (path-pattern rules) + DataEntityApi.java grep result + AuthorizationCustomizer.java:24-28
- implicit_adrs[1] ← SecurityConstants.java:98-355 (zero GET rules for /api/dataentities/{id}* reads) + AuthorizationCustomizer.java:29-30 (fall-through)
- implicit_adrs[2] ← DataEntityController.java:284-305 (three `getMyObjects*` methods, none accept `Authentication`/`Principal`/owner-id)
- implicit_adrs[3] ← DataEntityController.java:256-273 (no `@Max`/`@Size` constraint on `lineageDepth` or `expandedEntityIds`)
- implicit_adrs[4] ← DataEntityController.java:84-453 (uniform `.map(ResponseEntity::ok)` / `.thenReturn(ResponseEntity.noContent().build())` terminal pattern)
- implicit_adrs[5] ← DataEntityController.java:71-81 (eleven service fields fanned-into one controller)
- bugs_limitations_corner_cases[0] ← SecurityConstants.java:237-242 + DataEntityApi.java:148, 542 (path mismatch) + AuthorizationCustomizer.java:24-30 (fall-through behavior)
- bugs_limitations_corner_cases[1] ← `find odd-platform -path '*test*' -name 'DataEntityController*'` empty result + DataEntityStatusChangeTest.java:25-80 (only test exercising controller paths)
- bugs_limitations_corner_cases[2] ← DataEntityController.java:256-273, 308-313, 368-371 (no constraint annotations at controller)
- bugs_limitations_corner_cases[3] ← DataEntityController.java:101-115, 284-313, 316-321, 383-390 (no bound annotations at controller)
- bugs_limitations_corner_cases[4] ← DataEntityController.java:352-365 (cursor pagination scheme with no validation)
- bugs_limitations_corner_cases[5] ← DataEntityController.java:1-454 (no `@Timed`/`MeterRegistry`/`log.*` invocations)
- security.auth_mode_relevance ← DataEntityController.java:1-454 (no `@ConditionalOnProperty`, always wired) + WebFetch enable-security page status 200, 2026-05-08 (auth modes verbatim) + AlertController sidecar evidence at LoginFormSecurityConfiguration.java:31, OAuthSecurityConfiguration.java:71, LDAPSecurityConfiguration.java:51, DisabledAuthSecurityConfiguration.java:10
- security.ingestion_filter_relevance ← AlertController sidecar evidence at IngestionDataEntitiesFilter.java:28 (path matcher `/ingestion/entities`) + DataEntityApi.java path mappings (all `/api/dataentities*` or `/api/dataentitygroups*`) + WebFetch enable-security page fetched_excerpt
- security.authorization_assertions ← DataEntityController.java:1-454 (zero security annotations or imports) + grep on DataEntityApi.java for `PreAuthorize|@Secured|@Authorize|hasPermission|hasRole` returned no matches + SecurityConstants.java:98-355 (the per-endpoint mapping table is reproduced verbatim with file-line citations into SecurityConstants.java)
- security.owner_scoping ← DataEntityController.java:284-305 (`getMyObjects*` no principal arg) + DataEntityController.java:308-313 (`getPopular` no owner filter) + DataEntityController.java:139-453 (read endpoints take no principal/owner) + WebFetch catalog-overview page fetched_excerpt for "My Objects" / "Popular" semantics + service/policy/comparer/dataentity/*.java (DATA_ENTITY policy resolver context found at `<odd-platform>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/policy/comparer/dataentity/`)
- security.data_exposure ← DataEntityController.java:139-453 (each read endpoint's response type and parameter signature) + SecurityConstants.java:98-355 (mutation gating)
- security.known_security_gaps[0] (term path mismatch) ← SecurityConstants.java:237-242 + DataEntityApi.java:148, 542 + AuthorizationCustomizer.java:29-30
- security.known_security_gaps[1] (auth-mode-only reads) ← DataEntityController.java:139-453 + SecurityConstants.java:98-355 (no GET rules) + AuthorizationCustomizer.java:29-30
- security.known_security_gaps[2] (activity audit trail exposure) ← DataEntityController.java:351-365
- security.known_security_gaps[3] (Slack-thread exposure) ← DataEntityController.java:382-402 + DataEntityApi.java:596 (channels endpoint description)
- security.known_security_gaps[4] (path-string coupling no test guard) ← SecurityConstants.java:98-355 + AuthorizationCustomizer.java:24-30 + test directory search empty result
- security.known_security_gaps[5] (classes/domains platform-wide reads) ← DataEntityController.java:226-230, 431-434
- security.known_security_gaps[6] (usage platform-wide aggregate) ← DataEntityController.java:368-371
- security.known_security_gaps[7] (reactor Context principal propagation) ← DataEntityController.java:284-305 (no principal parameter)
- performance.hot_paths ← DataEntityController.java:139-147 (getDataEntityDetails) + 256-281 (lineage) + 284-313 (my/popular) + 368-371 (usage) + 423-428 (metrics) + 108-116 (DEG items)
- performance.throughput_characteristics ← DataEntityController.java:84-453 (uniform Mono signature, single-item paths) + DataEntityController.java:351-365 (cursor pagination on activity)
- performance.resource_allocation ← DataEntityController.java:71-81 (singleton service fields) + 119-127 (`collectList()` materialisation) + 243-253 (Flux response body) + 67-81 (singleton bean lifecycle)
- performance.scaling_characteristics ← DataEntityController.java:71-81 (no instance state) + 1-454 (no Lock/Semaphore/synchronized/Atomic/queue) + 101-115, 284-313, 316-321, 383-390 (pagination present, no clamping) + 256-273 (lineage no depth bound) + 351-365 (cursor pagination)
- performance.known_performance_gaps[0] (size unbounded) ← DataEntityController.java:101-115, 284-313, 316-321, 383-390
- performance.known_performance_gaps[1] (lineageDepth unbounded) ← DataEntityController.java:256-273
- performance.known_performance_gaps[2] (expandedEntityIds unbounded) ← DataEntityController.java:256-273
- performance.known_performance_gaps[3] (no caching on platform-wide aggregates) ← DataEntityController.java:226-230, 368-371, 431-434
- performance.known_performance_gaps[4] (no observability) ← DataEntityController.java:1-454 (no `@Timed`/`MeterRegistry`/`log.*` invocations)
- performance.known_performance_gaps[5] (`collectList()` materialisation) ← DataEntityController.java:119-127
- performance.known_performance_gaps[6] (messages/channels no pagination cap) ← DataEntityController.java:374-402
- performance.known_performance_gaps[7] (no bulk endpoints) ← DataEntityController.java:84-453

## confidence_per_field

- understanding: HIGH
- concepts: HIGH (40-method enumeration grouped by sub-concept; every group label is a verb-noun phrase anchored to its file:line and HTTP-verb/path mapping in DataEntityApi.java)
- dependencies_semantic: HIGH (live docs WebFetched and quoted verbatim; eleven service fields directly visible)
- tests_coverage_semantic: HIGH (the absence of tests is verified by file-system search and grep; the one test that exists was read in full)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source, so all five links are inferred; all five URLs were WebFetched live, four returned 200 and one path returned 404 — the binding controller→doc is the enricher's judgment, not a maintainer-declared link)
- implicit_adrs: HIGH (every claim is structural — visible in the source files at the cited lines; the path-string-coupling ADR is verified by reading both SecurityConstants.java and AuthorizationCustomizer.java)
- bugs_limitations_corner_cases: HIGH (the term path mismatch is verified by direct comparison of SecurityConstants.java:237-242 against DataEntityApi.java:148, 542; the test gap is verified by file-system search)
- security: HIGH (every claim is structural and cited to file:line; auth-mode names verified verbatim against the live security doc; the DataEntityApi grep verifies absence of authorization annotations on the generated interface; the SECURITY_RULES mapping table is reproduced verbatim with line citations; the term path mismatch is the highest-stakes finding and is verified by direct file-line comparison)
- performance: HIGH (every claim is structural — pagination plumbing, reactive Mono signatures, absence of caching / bulk endpoints / observability annotations are all directly visible in DataEntityController.java; the HOT-PATH characterisation is anchored to the live data-discovery and catalog-overview docs confirming these endpoints are per-render)

## Maintainer notes


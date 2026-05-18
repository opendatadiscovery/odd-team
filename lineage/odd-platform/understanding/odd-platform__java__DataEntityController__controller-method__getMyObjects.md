---
node_id: "odd-platform java DataEntityController controller-method:getMyObjects"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-13-G-getMyObjects
---

# DataEntityController#getMyObjects — semantic understanding

## understanding

`getMyObjects` (`GET /api/dataentities/my`) is the **canonical owner-scoped read endpoint** on the platform and the primary-source confirmation site for ADR-CANDIDATE-015 (Owner-scoped routes via reactor `Context`). The controller method is a four-line pass-through — `(page, size, exchange) → dataEntityService.listAssociated(page, size).map(ResponseEntity::ok)` (`DataEntityController.java:283-289`) — that takes **no `Authentication`/`Principal`/`Owner-id` parameter**; the principal flows through the reactor pipeline via `ReactiveSecurityContextHolder.getContext()` inside `AuthIdentityProviderImpl.fetchAssociatedOwner()` (`AuthIdentityProviderImpl.java:50-53`) and resolves to a single `OwnerPojo` via the `(oidc_username, provider, DELETED_AT IS NULL)` lookup against `USER_OWNER_MAPPING` (`ReactiveUserOwnerMappingRepositoryImpl.java:77-85`). The SQL filter at the repository layer is a **JOIN over the `OWNERSHIP` table** — `JOIN OWNERSHIP ON OWNERSHIP.DATA_ENTITY_ID = data_entity.id WHERE OWNERSHIP.OWNER_ID = ?` (`ReactiveDataEntityRepositoryImpl.java:526-530`) — which is the **architectural asymmetry** vs. every cross-owner read on this controller (centerpiece detail, lineage, alerts, messages, activity, metrics, popular): those read paths take no principal and emit a payload that is identical for every authenticated caller; `getMyObjects` takes no principal **and yet** emits a per-caller payload, with the differentiation hidden inside the service-layer Context resolution.

## concepts

- entities: [
    "`DataEntityRef` (response item shape; OpenAPI-generated; components.yaml:894-915 — id, oddrn, entity_classes[], internal_name, external_name, url, has_alerts, manually_created, status, namespace, data_source, source_created_at, source_updated_at)",
    "`OwnerPojo` (the resolved per-caller owner; ReactiveUserOwnerMappingRepositoryImpl.java:84 returns `Mono<OwnerPojo>` via `r.into(OwnerPojo.class)`)",
    "`USER_OWNER_MAPPING` row (the gate: `(owner_id, oidc_username, provider, deleted_at)` — multiple rows possible across providers/usernames; lookup at ReactiveUserOwnerMappingRepositoryImpl.java:116-127)",
    "`OWNERSHIP` row (the data-entity↔owner edge: `(data_entity_id, owner_id, title_id, deleted_at)` joined at ReactiveDataEntityRepositoryImpl.java:526)",
    "`SecurityContext` / reactor `Context` (the principal carrier; ReactiveSecurityContextHolder.getContext() at AuthIdentityProviderImpl.java:25, 39)"
  ]
- operations: [
    "delegate to `dataEntityService.listAssociated(page, size)` (controller boundary, DataEntityController.java:287)",
    "resolve current principal via `ReactiveSecurityContextHolder.getContext()` → `Authentication.getName()` + (OAuth2 only) `OAuth2AuthenticationToken.getAuthorizedClientRegistrationId()` (AuthIdentityProviderImpl.java:24-35)",
    "lookup associated owner: `SELECT owner.* FROM user_owner_mapping JOIN owner ON user_owner_mapping.owner_id = owner.id WHERE user_owner_mapping.oidc_username = ? AND user_owner_mapping.deleted_at IS NULL AND (provider = ? OR provider IS NULL)` (ReactiveUserOwnerMappingRepositoryImpl.java:77-85, 116-127)",
    "fetch owner-scoped data entities: CTE-driven select with `JOIN ownership ON ownership.data_entity_id = data_entity.id WHERE ownership.owner_id = ?` (ReactiveDataEntityRepositoryImpl.java:516-534)",
    "order by `data_entity.id DESC`, then page+size pagination (DSL.noField fallback if size is null; null page produces NO_OFFSET) (ReactiveDataEntityRepositoryImpl.java:528-530)",
    "map DataEntityDto → DataEntityRef via `dataEntityMapper::mapRef` (DataEntityServiceImpl.java:215)",
    "lift to `ResponseEntity.ok(Flux<DataEntityRef>)` (DataEntityController.java:288)"
  ]
- invariants: [
    "the controller never reads `ServerWebExchange.exchange` — the parameter is present only to satisfy the OpenAPI-generated `DataEntityApi#getMyObjects` interface signature; the principal must therefore flow via reactor `Context`, not via the exchange's `SecurityContext` attribute (DataEntityController.java:283-289)",
    "owner resolution is by `(oidc_username, provider)` — a LOGIN_FORM user `alice` and an OAuth2 user `alice` via GitHub are DIFFERENT principals (provider=`null` vs provider=`github`) and resolve to DIFFERENT owners (ReactiveUserOwnerMappingRepositoryImpl.java:116-127)",
    "USER_OWNER_MAPPING is many-to-one: a single owner may have multiple active user mappings, but a single (oidc_username, provider) yields AT MOST ONE active owner via `jooqReactiveOperations.mono(query)` (ReactiveUserOwnerMappingRepositoryImpl.java:83 — `.mono`, not `.flux`); the `getCurrentUser → flatMap → getAssociatedOwner` chain therefore returns `Mono<OwnerPojo>`, not `Flux` — multi-owner associations per user are NOT supported by this code path",
    "if `fetchAssociatedOwner()` emits empty (no `USER_OWNER_MAPPING` row, soft-deleted row, or no SecurityContext in pipeline), `flatMapMany` produces an empty Flux → HTTP 200 with `[]` body — there is no 401, no 403, no 404 (DataEntityServiceImpl.java:212-216)",
    "the response shape is `Mono<ResponseEntity<Flux<DataEntityRef>>>` — the response is committed (status 200) before the Flux is materialised; the page-size limit is enforced inside the SQL, not by the reactor pipeline (DataEntityController.java:284-289 + ReactiveDataEntityRepositoryImpl.java:529-530)",
    "no `@PreAuthorize`, no `@Secured`, no SECURITY_RULES entry for the `/api/dataentities/my` path — falls through to `pathMatchers(\"/**\").authenticated()` in `AuthorizationCustomizer.java:29-30`; thus the endpoint is reachable by any authenticated caller and (under `auth.type=DISABLED`) by any anonymous caller"
  ]
- audiences: [
    "ODD Platform UI — the `Recommended → My Objects` panel on the catalog home page consumes `getMyObjects` via `fetchMyDataEntitiesList` (odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:149-156) for the five-entity recommendation strip described in the live `catalog-overview` doc fetched_excerpt",
    "ODD Platform UI — the entity-class `My Objects` tab on the catalog page (one of `All / My Objects / Datasets / ...`) per the data-discovery live doc fetched_excerpt",
    "third-party API consumers building per-user reports / dashboards / 'what I own' summaries via direct `GET /api/dataentities/my` calls"
  ]

## dependencies_semantic

- requires-feature: [
    "data-discovery / catalog-overview — `Recommended → My Objects` panel and the `My Objects` entity-class tab per the live data-discovery / catalog-overview doc fetched_excerpts cached on the DataEntityController-controller sidecar (data-discovery: status 200, 2026-05-08 fetched_excerpt: `My Objects` is one of the entity-class tabs; catalog-overview: status 200, 2026-05-08 fetched_excerpt: 'My Objects — the most recently ingested five data entities where the user is mentioned as an owner' AND 'Both sections require the signed-in user to be linked to an Owner record for personalized functionality to work')",
    "user→Owner association (the `Owner-link` invariant from concepts.yaml:3652) — the prerequisite the controller's body assumes: the calling user must have an active row in `USER_OWNER_MAPPING`. Per concepts.yaml: 'no auth-mode flow auto-creates Owners on first login — operators must MANUALLY pre-create per-user Owner rows OR accept association requests'. Without the link, this endpoint returns empty Flux (200 OK, body `[]`), not 401/403/404."
  ]
- requires-config: [] — N/A (method body reads no config keys; auth-mode-dependent behaviour is governed externally by the active `*SecurityConfiguration` bean)
- requires-runtime: [
    "Spring WebFlux + Reactor 3 — `ReactiveSecurityContextHolder.getContext()` is the principal carrier (AuthIdentityProviderImpl.java:25). The principal flows in the reactor `Context` from the `SecurityContextServerWebExchange` filter (Spring Security infrastructure) through every downstream operator, including `flatMap` and `flatMapMany`. The DataEntityController method itself does NOT need to be aware of this; the service's `authIdentityProvider.fetchAssociatedOwner()` call (DataEntityServiceImpl.java:213) is the point of resolution",
    "Spring Security ReactiveSecurityContextRepository — populates the reactor `Context` from the session (LOGIN_FORM, OAUTH2 cookie/JWT) or the request (LDAP basic / OAuth2 bearer); a regression in the security WebFilter order would propagate an EMPTY SecurityContext, silently degrading the endpoint to empty output rather than crashing",
    "jOOQ reactive operations — `jooqReactiveOperations.mono(query)` (ReactiveUserOwnerMappingRepositoryImpl.java:83) for the per-caller owner lookup + `jooqReactiveOperations.flux(select)` (ReactiveDataEntityRepositoryImpl.java:532) for the owner-scoped data-entity stream",
    "PostgreSQL — `USER_OWNER_MAPPING.OIDC_USERNAME`, `.PROVIDER`, `.DELETED_AT IS NULL` filter; `OWNERSHIP.OWNER_ID = ?` join filter"
  ]
- couples-to: [
    "`DataEntityApi#getMyObjects` (generated from OpenAPI spec — odd-platform-specification/openapi.yaml:823-840; `GET /api/dataentities/my`; required `page` (int32) + `size` (int32) query params; no auth/security definition on the operation, no `@PreAuthorize` propagated to the generated interface)",
    "`DataEntityService#listAssociated(int, int)` (DataEntityServiceImpl.java:211-216) — the orchestration entrypoint; `authIdentityProvider.fetchAssociatedOwner().flatMapMany(o -> reactiveDataEntityRepository.listByOwner(o.getId(), page, size)).map(dataEntityMapper::mapRef)`",
    "`AuthIdentityProvider#fetchAssociatedOwner` (AuthIdentityProviderImpl.java:50-53) — `getCurrentUser().flatMap(user -> userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider()))`",
    "`ReactiveSecurityContextHolder` (AuthIdentityProviderImpl.java:25, 39) — Spring Security's reactive principal carrier; sole authentication-context source",
    "`ReactiveUserOwnerMappingRepository#getAssociatedOwner(String, String)` (ReactiveUserOwnerMappingRepositoryImpl.java:77-85) — the `USER_OWNER_MAPPING JOIN OWNER` lookup with the (oidc_username, provider, deleted_at IS NULL) condition triple",
    "`ReactiveDataEntityRepository#listByOwner(long, Integer, Integer)` (ReactiveDataEntityRepositoryImpl.java:515-534) — the CTE + `JOIN OWNERSHIP WHERE OWNERSHIP.OWNER_ID = ?` SQL builder",
    "`AuthorizationCustomizer` (auth/authorization/AuthorizationCustomizer.java:24-30) — sole authorization layer; this GET path has no entry in `SECURITY_RULES`, falls through to `.pathMatchers(\"/**\").authenticated()`"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Happy-path owner-scoping: caller linked to an Owner with N owned entities receives a Flux of exactly those N DataEntityRefs (subject to page/size) — no test asserts this against the actual SQL JOIN at ReactiveDataEntityRepositoryImpl.java:526-527",
    "Unlinked-user path: caller with NO active `USER_OWNER_MAPPING` row receives HTTP 200 + empty body — no test asserts the empty Flux degradation rather than a 500 / NullPointerException",
    "Provider-isolation: LOGIN_FORM user `alice` and GitHub user `alice` receive DIFFERENT owner-scoped results — no test asserts the `(oidc_username, provider)` composite-key isolation at ReactiveUserOwnerMappingRepositoryImpl.java:116-127",
    "DISABLED-mode behaviour: under `auth.type=DISABLED`, no SecurityContext is populated; `ReactiveSecurityContextHolder.getContext()` emits empty; the resulting empty Mono propagates to empty Flux. No test asserts this — a regression that fell back to a hard-coded admin owner or 500'd would not be caught",
    "Reactive Context principal propagation: a misordered or removed WebFilter dropping the SecurityContext from the reactor `Context` silently degrades `/my` to empty output. The contract gap is documented as TEST-GAP-020 (test-map.yaml:1844-1861)",
    "Cross-owner negative path: caller linked to Owner X must NOT receive entities owned only by Owner Y — no test asserts the `WHERE ownership.owner_id = ?` filter isolation",
    "Lineage-variant tests: `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` go through a DIFFERENT code path (`DataEntityRelationsService.getDependentDataEntityOddrns` → `LineageRepository.getLineageRelations` at DataEntityRelationsServiceImpl.java:25-31, then `repository.listByOddrns(oddrns, false, false, page, size)`); no test asserts the owner→reachable-subgraph expansion is owner-scoped at the entry (`authIdentityProvider.fetchAssociatedOwner()` at DataEntityRelationsServiceImpl.java:26)",
    "Pagination boundaries: `page=0` produces `OFFSET (0-1)*size = -size` (negative offset) which Postgres rejects at SQL parse time; `page=1, size=0` produces `LIMIT 0 OFFSET 0` and an empty Flux; `size=Integer.MAX_VALUE` produces an unbounded scan. No test asserts boundary behaviour at the controller boundary",
    "OpenAPI contract enforcement: `page` and `size` are `required: true` in the spec (components.yaml:4213-4229) with no `minimum:` / `maximum:`. A missing param yields a Spring 400; the test layer should assert this — none does"
  ]
- test_files: []
- gaps: |
    Zero controller-boundary tests. The owner-scoping invariant is **the** load-bearing security property of this endpoint, yet no `WebTestClient` test asserts: (a) the JOIN-based owner filter actually restricts the result set, (b) an unlinked user gets HTTP 200 + empty body, (c) the principal flows through reactor `Context` correctly under each `auth.type` mode. A regression in any of the three could silently degrade `/my` to either empty output (false-negative — user sees nothing they own) or cross-owner output (false-positive — user sees entities they don't own; depending on which silent bug). TEST-GAP-020 already names the regression vector ("reactive Context principal propagation"); the proposed test at `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DataEntityMyObjectsTest.java#getMyObjects_principalLinkedToOwner_returnsOnlyOwnerScopedSubset` would cover (a)+(b). A parallel test for `getMyObjectsWithUpstream`/`Downstream` is also missing — the DataEntityRelationsServiceImpl.java:25-31 lineage-expansion path is a SECOND surface of the owner-link invariant and has the SAME zero-test posture.

## docs_link_semantic

- declared_docs: [] — N/A (source file carries no `@docs` annotation)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: "#recommended"
    rationale: "Catalog Overview documents `Recommended → My Objects` (the primary UI consumer of `getMyObjects`) and explicitly states the Owner-link prerequisite for `My Objects` functionality"
    last_verified_at: "2026-05-13T00:00:00Z"
    last_verified_status: "WebFetch-denied-in-session — using cached fetched_excerpts from sibling sidecar `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md` (line 113-123), last verified 2026-05-08 status 200 by that sidecar's session"
    confidence: MEDIUM
    fetched_excerpts: |
      "My Objects — the most recently ingested five data entities where the user is mentioned as an owner."
      "Recommended → My Objects displays recently-ingested owned entities, while Alerts → My Objects filters open alerts on the user's owned entities — two different features sharing the same name."
      "Both sections require the signed-in user to be linked to an Owner record for personalized functionality to work."
      (Source: sibling DataEntityController-level sidecar docs_link_semantic.inferred_docs[1].fetched_excerpts; 2026-05-08 status 200.)
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Data Discovery feature page describing the `All / My Objects / Datasets / ...` entity-class tab strip — the secondary UI consumer of `getMyObjects` (the full-list `/my` tab, not the five-entity `Recommended` panel)"
    last_verified_at: "2026-05-13T00:00:00Z"
    last_verified_status: "WebFetch-denied-in-session — using cached fetched_excerpts from sibling sidecar (line 103-112), last verified 2026-05-08 status 200"
    confidence: MEDIUM
    fetched_excerpts: |
      Entity-class tabs: "All / My Objects / Datasets / Transformers / Data Consumers / Data Inputs / Quality Tests / Groups / Relationships" with per-class counts.
      (Source: sibling DataEntityController-level sidecar docs_link_semantic.inferred_docs[0].fetched_excerpts; 2026-05-08 status 200.)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: "#user-owner-association"
    rationale: "Authorization doc documents the `User-owner association` concept that the `Owner-link` invariant depends on — the source-of-truth for why `getMyObjects` returns empty for an unmapped user"
    last_verified_at: "2026-05-13T00:00:00Z"
    last_verified_status: "WebFetch-denied-in-session — not previously fetched; the concepts.yaml invariant 'Owner-link is the gate for owner-scoped views' references this page via the documentation pillar's canonical_in_docs: true flag at concepts.yaml:3653"
    confidence: LOW
    fetched_excerpts: |
      (None cached in any prior sidecar.)
- doc_drift_findings:
  - "The live `catalog-overview` doc says 'the most recently ingested five data entities' — the number five appears to be a UI-side display cap (the `Recommended` panel slices the response). The server endpoint does NOT enforce a 5-entity cap; it honours the client's `size` parameter. A third-party API consumer reading the live doc could be misled into believing the endpoint caps at 5. Severity: MEDIUM doc-drift (the doc describes UI behaviour as if it were API behaviour). evidence: DataEntityController.java:284-289 + ReactiveDataEntityRepositoryImpl.java:529 (no hard-coded 5 cap; `DSL.val(size)` honours client param)"
  - "Live docs are silent on the (`oidc_username`, `provider`) compound-key behaviour. An operator running both LOGIN_FORM and S2S (or migrating users from LOGIN_FORM to OAUTH2/LDAP) could reasonably expect `alice@example.com` to resolve to the same Owner across modes; the code resolves to DIFFERENT owners. Severity: MEDIUM doc-drift (undocumented migration-time gotcha). evidence: ReactiveUserOwnerMappingRepositoryImpl.java:116-127"
  - "Live docs are silent on `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` semantics. These endpoints expose the reachable subgraph from the user's owned entities — useful for lineage-aware ownership but not described in `catalog-overview` or `data-discovery`. The OpenAPI summaries ('Returns list of data entities owned by current user with upstream dependencies') are technically incorrect: the response includes entities **NOT owned by the user** — only the entities REACHABLE from owned entities via lineage (DataEntityRelationsServiceImpl.java:33-39 filters `Predicate.not(oddrns::contains)` after the lineage expansion; the response is therefore non-owned-but-reachable). Severity: HIGH doc-drift (the live OpenAPI spec misdescribes the semantics). evidence: openapi.yaml:842-844, 860-862 + DataEntityRelationsServiceImpl.java:25-39"

## implicit_adrs

- "**Owner-scoped routes — controllers take NO principal parameter; the principal flows through reactor `Context`, resolved at the service layer.** The three `getMyObjects*` methods accept only `(page, size, exchange)`; no `Authentication`, no `Principal`, no owner-id query/path/body parameter. Resolution happens at `DataEntityServiceImpl.java:213` via `authIdentityProvider.fetchAssociatedOwner()` which internally calls `ReactiveSecurityContextHolder.getContext()`. This is the **primary-source confirmation** of ADR-CANDIDATE-015 — the controller method body is the architectural anchor, not just a corroborating example. The contrast with sibling controllers' read-collaborative cross-owner reads (`getDataEntityDetails` accepting only `(id, exchange)` and emitting an identical payload for every authenticated caller) makes the deliberate asymmetry visible at the controller-method shape." — evidence: DataEntityController.java:283-305 (three sibling methods, none accept Authentication/Principal) + DataEntityServiceImpl.java:212-225 (the principal-resolution point) + AuthIdentityProviderImpl.java:23-53 (the ReactiveSecurityContextHolder reach-up) + AuthorizationCustomizer.java:29-30 (no SECURITY_RULES entry for `/api/dataentities/my`) — intent_anchor: "the three `getMyObjects*` methods deliberately omit the principal parameter despite OpenAPI's `ServerWebExchange` providing access to it via `exchange.getPrincipal()` — the maintainer chose the reactor-Context path; the OpenAPI-generated `DataEntityApi#getMyObjects` signature does not declare it either (openapi.yaml:823-840 has no security scheme)" — confidence: HIGH
- "**Owner-scoped filtering is a JOIN-side concern at the repository layer, not a service-side post-filter.** `listByOwner` (ReactiveDataEntityRepositoryImpl.java:515-534) applies the owner restriction inside the SQL via `JOIN OWNERSHIP ON OWNERSHIP.DATA_ENTITY_ID = data_entity.id WHERE OWNERSHIP.OWNER_ID = ?`. The maintainer chose NOT to: (a) fetch a cross-owner list and filter in-memory, (b) push an `IN (...)` subquery, (c) precompute owner-id at the service and pass it into a generic `listByIds` method. The chosen design ensures the database does the filtering (one query, one round-trip, no over-fetch), and the filter is on `ownership.owner_id` (the edge table) rather than on `data_entity.owner_id` (which doesn't exist — the data-entity-to-owner relationship is many-to-many through OWNERSHIP)." — evidence: ReactiveDataEntityRepositoryImpl.java:526-527 (`.join(OWNERSHIP).on(OWNERSHIP.DATA_ENTITY_ID.eq(deCte.field(DATA_ENTITY.ID))).where(OWNERSHIP.OWNER_ID.eq(ownerId))`) — intent_anchor: "the SQL is built as `JOIN OWNERSHIP ... WHERE OWNERSHIP.OWNER_ID.eq(ownerId)` — explicitly an edge-table JOIN, not an in-memory post-filter; the maintainer's choice of CTE + JOIN + WHERE is structural and consistent with how every other owner-scoped read in the codebase is built" — confidence: HIGH
- "**Owner resolution is a single-Mono lookup, not a multi-Owner Flux.** `getAssociatedOwner` returns `Mono<OwnerPojo>` (ReactiveUserOwnerMappingRepositoryImpl.java:77-85), implemented via `jooqReactiveOperations.mono(query)` (`.mono`, not `.flux`). The contract assumes a single user maps to AT MOST one owner. A user can have multiple historical `USER_OWNER_MAPPING` rows but only one active (deleted_at IS NULL) — the schema doesn't enforce this with a partial unique index that this sidecar can verify, but the active-row uniqueness is encoded in the cleanup at `deleteActiveRelationByOwner` (ReactiveUserOwnerMappingRepositoryImpl.java:65-74) which soft-deletes all prior active mappings for the owner before inserting the new one. The architectural posture: one user, one owner identity — multi-owner association is OUT OF SCOPE for this endpoint family." — evidence: ReactiveUserOwnerMappingRepositoryImpl.java:77-85 (.mono call) + ReactiveUserOwnerMappingRepositoryImpl.java:65-74 (clear-active-then-insert pattern) — intent_anchor: "`Mono<OwnerPojo> getAssociatedOwner(...)` — the return type itself is the decision; if multi-owner were supported, this would be `Flux<OwnerPojo>` and the WHERE clause at `listByOwner` would be `IN (...)`" — confidence: HIGH
- "**Sibling endpoints expand the owner filter via reachable lineage subgraph, but the lineage-expanded set is non-owner-scoped.** `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` (DataEntityController.java:292-305) call `dataEntityService.listAssociated(page, size, LineageStreamKind)` which routes to `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` (DataEntityRelationsServiceImpl.java:25-31). That method (a) fetches the user's owned entities (anchor — owner-scoped), (b) traverses the lineage graph one hop (`lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)`), (c) returns the reached oddrns FILTERED to exclude the originally-owned set (`Predicate.not(oddrns::contains)` at line 37). The returned `DataEntityRef` set is therefore **entities the user does NOT own but which are reachable from entities they DO own** — a documented semantic shift not captured in the OpenAPI summaries. The maintainer's design choice: the sibling endpoints answer 'what does my data ecosystem look like upstream/downstream?', not 'show me my entities with their lineage'." — evidence: DataEntityRelationsServiceImpl.java:25-31 + DataEntityServiceImpl.java:219-225 + DataEntityController.java:292-305 — intent_anchor: "the `Predicate.not(oddrns::contains)` at DataEntityRelationsServiceImpl.java:37 is the explicit exclusion of the user's own owned entities — the lineage-variant responses are explicitly the non-owned-but-reachable set" — confidence: HIGH

## bugs_limitations_corner_cases

- "**No owner-link reachability error surfaced — unlinked users silently see empty results.** A user authenticated under any of LOGIN_FORM/OAUTH2/LDAP who has not been linked to an `Owner` record via `OwnerAssociationRequest` (OwnerAssociationRequestServiceImpl.java:188 — admin-resolved) or direct `POST /api/owners/{owner_id}/users` mapping receives `200 OK` with body `[]`. There is no 401, no 403, no `OwnerNotAssociatedException`, no flash banner via the `getDataEntitiesUsage` endpoint, no header signalling 'you need an owner link'. A new user landing on the `Recommended → My Objects` panel sees an empty strip with no explanation, indistinguishable from 'I own nothing yet'. The cure is documented elsewhere (operator must accept their association request via `/management/owner-associations`) but this endpoint's response shape gives the consumer no signal." — evidence: DataEntityServiceImpl.java:212-216 (the `.flatMapMany` on an empty `fetchAssociatedOwner()` produces empty Flux; no `.switchIfEmpty(Mono.error(...))`) + AuthIdentityProviderImpl.java:50-53 (no fallback) — severity: MEDIUM
- "**DISABLED mode produces empty `/my` results, not anonymous-bypass.** Under `auth.type=DISABLED` the WebFilter chain at DisabledAuthSecurityConfiguration.java:11-19 calls `permitAll()` and does NOT install any `ServerSecurityContextRepository` that would populate a SecurityContext. `ReactiveSecurityContextHolder.getContext()` emits empty → `getCurrentUser()` emits empty → `fetchAssociatedOwner()` emits empty → `listAssociated` returns empty Flux → HTTP 200 with `[]`. This is **NOT a security bypass** (DISABLED is dev-only per docs; the empty response IS correct), but it IS a silent dev-mode trap: an operator running locally against DISABLED who notices `/my` returning `[]` may assume the owner-linking flow is broken, when actually `/my` will work correctly in production under LOGIN_FORM/OAUTH2/LDAP." — evidence: DisabledAuthSecurityConfiguration.java:11-19 (no ServerSecurityContextRepository wiring) + AuthIdentityProviderImpl.java:24-35 (the `.map(SecurityContext::getAuthentication)` chain propagates empty when no context) — severity: LOW
- "**Page=0 produces negative SQL offset.** The controller accepts `Integer page` with no `@Min(1)` / `@Max(...)` validation; the repository at ReactiveDataEntityRepositoryImpl.java:530 computes `(page - 1) * size`. With `page=0` this is `-size`, yielding `OFFSET -N` which Postgres rejects with `ERROR: OFFSET must not be negative`. The client receives a 500 (or whatever the global exception handler emits) rather than a 400 with a 'page must be ≥ 1' message." — evidence: DataEntityController.java:284-289 (no `@Min`/`@Max` on `Integer page`) + ReactiveDataEntityRepositoryImpl.java:530 (`(page - 1) * size`) + components.yaml:4213-4221 (PageParam has no `minimum:`) — severity: LOW
- "**Size=0 produces SQL `LIMIT 0`, empty body.** A request with `size=0` yields `LIMIT 0`, returning an empty Flux with `200 OK`. Not a crash, but a confusing UX: the client sees `[]` and cannot distinguish 'user owns nothing' from 'you asked for zero items'. Components.yaml SizeParam has no `minimum:` constraint." — evidence: ReactiveDataEntityRepositoryImpl.java:529 (`DSL.val(size)`) + components.yaml:4222-4230 (SizeParam no `minimum:`) — severity: LOW
- "**Very large `size` is unbounded.** No `@Max` on the controller, no `maximum:` in the OpenAPI spec, no clamp in the repository. A caller passing `size=Integer.MAX_VALUE` triggers an unbounded scan of the OWNERSHIP-join CTE, with the response materialised reactively but holding open the DB connection and reactor backpressure window for the entire result set. Under DISABLED mode with no auth, this becomes a no-auth DoS vector; under authenticated modes, an authenticated insider DoS vector." — evidence: DataEntityController.java:284-289 + components.yaml:4222-4230 + ReactiveDataEntityRepositoryImpl.java:529 — severity: MEDIUM
- "**`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` use a DIFFERENT code path with NO direct repository owner-filter — the owner-scoping is implicit via the anchor set.** The lineage variants call `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns(streamKind)` which: (a) fetches the user's owned data entities (owner-scoped), (b) traverses lineage one hop, (c) returns reached oddrns EXCLUDING the owned set. Then `repository.listByOddrns(oddrns, false, false, page, size)` returns those non-owned entities WITHOUT applying any owner filter at the SQL — the assumption is that the input oddrn set is already scoped correctly. A regression in (a) — e.g. `fetchAssociatedOwner()` returning a wrong owner, or the WebFilter dropping the principal — leaks unscoped lineage neighbours. The owner-scoping invariant is therefore SINGLE-POINT-OF-FAILURE at DataEntityRelationsServiceImpl.java:26 for the lineage variants, vs. defended at the JOIN-side WHERE clause for the base `/my` path." — evidence: DataEntityRelationsServiceImpl.java:25-31 + DataEntityServiceImpl.java:219-225 + ReactiveDataEntityRepositoryImpl.java (listByOddrns has no `ownership.owner_id` join filter) — severity: MEDIUM
- "**LOGIN_FORM and LDAP modes produce `provider=null`, which the `getConditions` clause matches via `PROVIDER IS NULL` AND.** A LOGIN_FORM `alice` and an LDAP `alice` (both null-provider) resolving against the same `USER_OWNER_MAPPING` row would receive the SAME owner-scoped results. The provider differentiation is only effective for OAuth2 (where `getAuthorizedClientRegistrationId()` distinguishes github/google/azure/cognito/odd_iam). An operator switching `auth.type` from LOGIN_FORM to LDAP mid-deployment with the same usernames inadvertently inherits the prior LOGIN_FORM users' owner-mappings — possibly desirable, possibly a security crossover. The behaviour is undocumented." — evidence: AuthIdentityProviderImpl.java:24-35 (only OAuth2AuthenticationToken produces a non-null provider) + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 (`PROVIDER.isNull()` is the LOGIN_FORM/LDAP path) + LDAPSecurityConfiguration.java vs LoginFormSecurityConfiguration.java (both produce non-OAuth2 tokens) — severity: LOW (assumes the migration is intentional) or MEDIUM (if cross-mode user-identity bleed is not documented as a migration concern)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — all four modes carry this endpoint (no `@ConditionalOnProperty` on the controller). Under LOGIN_FORM/OAUTH2/LDAP, the path falls through `.pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29-30), so the caller must be authenticated. Under DISABLED, anonymous callers reach the endpoint successfully — and receive an empty Flux because there is no SecurityContext to resolve. **The auth-mode invariance is the key architectural property**: the endpoint behaves identically (returns Flux of owner-scoped DataEntityRefs) across LOGIN_FORM/OAUTH2/LDAP because the (username, provider) lookup is the same shape regardless of how authentication was performed; only DISABLED is structurally different (no SecurityContext, empty result). evidence: AuthIdentityProviderImpl.java:24-35 (uniform handling: OAuth2 → provider=registrationId, all others → provider=null) + DisabledAuthSecurityConfiguration.java:11-19 (no SecurityContextRepository).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The path `/api/dataentities/my` does not match `IngestionDataEntitiesFilter`'s `/ingestion/entities` path matcher.
- **authorization_assertions**: [] — no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call at the controller, the generated `DataEntityApi` interface, the service, or the repository. The only access control is the SecurityWebFilterChain's `.authenticated()` fallback in `AuthorizationCustomizer.java:29-30`. evidence: DataEntityController.java:283-305 (no annotations) + DataEntityServiceImpl.java:211-216 + ReactiveDataEntityRepositoryImpl.java:515-534 + SecurityConstants.java (no entry for `/api/dataentities/my`) + AuthorizationCustomizer.java:24-30.
- **owner_scoping**: `RESPECTS — filters by current user's owners at the SQL JOIN level`. The owner restriction is applied inside the repository SQL via `JOIN OWNERSHIP ON OWNERSHIP.DATA_ENTITY_ID = data_entity.id WHERE OWNERSHIP.OWNER_ID = ?` (ReactiveDataEntityRepositoryImpl.java:526-527). The Owner-id parameter is the resolved per-caller owner from `fetchAssociatedOwner()` (DataEntityServiceImpl.java:213). evidence: DataEntityServiceImpl.java:212-216 (the `flatMapMany(o -> listByOwner(o.getId(), page, size))` chain) + ReactiveDataEntityRepositoryImpl.java:516-534. **Contrast** (cross-batch triangulation): `getDataEntityDetails` (DataEntityController.java:139-147) has `owner_scoping: BYPASSES`; `getAllAlerts` (AlertController) similarly BYPASSES; `search` BYPASSES by default (only `my_objects=true` toggles RESPECTS); `getActivity` BYPASSES unless `type=MY_OBJECTS`. The `getMyObjects*` family is the only triplet on `DataEntityController` that RESPECTS.
- **data_exposure**:
  - "Per-user DataEntityRef stream (id, oddrn, entity classes, internal_name, external_name, url, has_alerts, manually_created, status, namespace, data_source, source_created_at, source_updated_at — components.yaml:894-915) → only entities the caller owns are returned — provided the owner-link is in place. evidence: ReactiveDataEntityRepositoryImpl.java:526-527 (JOIN OWNERSHIP WHERE OWNER_ID=?)"
  - "Owner-link state inference: a caller able to determine 'my objects returns empty even though I own X in production' can infer their `USER_OWNER_MAPPING` row is missing or soft-deleted. This is normally innocuous (the user already knows their own auth state) but enables side-channel checks on other users' association state ONLY via admin endpoints, not via this endpoint. evidence: DataEntityServiceImpl.java:212-216 (empty-Mono propagation)"
- **known_security_gaps**:
  - "**No fail-fast for un-mapped users — silent empty Flux degradation is indistinguishable from owning nothing.** This is the inverse of the typical security gap: not 'too permissive' but 'too quiet'. An unmapped user cannot tell whether the platform thinks they own nothing or whether the admin forgot to accept their association request. severity: LOW (information-quality issue, not a security boundary failure). evidence: DataEntityServiceImpl.java:212-216 (no `.switchIfEmpty(Mono.error(new OwnerNotAssociatedException(...)))`)"
  - "**LOGIN_FORM / LDAP provider=null cross-mode bleed** (see bugs_limitations_corner_cases). If an operator switches auth.type with the same usernames, the (null-provider) USER_OWNER_MAPPING rows continue to match — which may or may not be intended. severity: LOW. evidence: AuthIdentityProviderImpl.java:24-35 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127"
  - "**Lineage-variant single-point-of-failure for the owner-scoping invariant.** `getMyObjectsWithUpstream`/`Downstream` derive the lineage neighbourhood from the user's owned set, then return non-owned entities reachable in one hop, WITHOUT a JOIN-side owner filter on the response. A regression in `fetchAssociatedOwner()` (e.g. wrong owner from a corrupted USER_OWNER_MAPPING row, or a misordered WebFilter that drops the principal mid-pipeline causing the anchor set to be empty AND the lineage to expand from empty correctly — or, more dangerously, a future refactor that swaps in a fallback owner-id) leaks lineage neighbours that the caller has no entitlement to see. The base `/my` endpoint has a defence-in-depth WHERE clause (`ownership.owner_id = ?`); the lineage variants do not. severity: MEDIUM (the gap is latent: today's code is correct; a future refactor introducing a fallback owner is the vector). evidence: DataEntityRelationsServiceImpl.java:25-31 + DataEntityServiceImpl.java:219-225 (listByOddrns has no owner-filter)"

## performance

- **hot_paths**:
  - "Per-caller principal resolution: each `/my` request issues `SELECT owner.* FROM user_owner_mapping JOIN owner ... WHERE oidc_username = ? AND deleted_at IS NULL AND (provider = ? OR provider IS NULL)` (ReactiveUserOwnerMappingRepositoryImpl.java:79-82). The query is small (single-row return) but uncached — every request triggers a DB round-trip even for back-to-back identical calls. The UI's catalog home page fires this on every refresh."
  - "Owner-scoped CTE: the `listByOwner` query at ReactiveDataEntityRepositoryImpl.java:521-530 builds a `cteDataEntitySelect` (the standard data-entity dimensions CTE) and joins it with `OWNERSHIP`. For a user owning many entities, the CTE materialises the dimensions for every row before the JOIN narrows; index on `ownership.owner_id` is mandatory for acceptable response times."
- **throughput_characteristics**:
  - "single-call read — no batching across owners; each user's request is independent"
  - "reactive Flux response — entities are streamed back as they materialise from jOOQ's reactive pipeline (ReactiveDataEntityRepositoryImpl.java:532); the response Mono completes once the Flux is wrapped, but the network response body materialises lazily"
- **resource_allocation**:
  - "no client-side caching at the controller, service, or repository — every request hits Postgres for both the owner lookup AND the data-entity CTE"
  - "the `cteDataEntitySelect` is a heavy CTE building all dimension columns; for a user with thousands of owned entities, the CTE materialises across the full ownership-joined row set before pagination kicks in at `.limit(size).offset(...)` — the limit IS pushed into the SQL (line 529), so Postgres optimises the plan, but the CTE itself may not be lazily reduced"
  - "Mono → Mono → Flux chain holds reactor backpressure on the DB connection for the duration of the response stream; with very large `size` values, the connection is held for the entire stream duration"
- **scaling_characteristics**:
  - "stateless — instances scale horizontally"
  - "pagination via SQL `LIMIT/OFFSET` — `OFFSET` is O(N) on the underlying scan; for deep pages on large ownership sets, performance degrades linearly with offset. The order key is `data_entity.id DESC` (ReactiveDataEntityRepositoryImpl.java:528), so a keyset (cursor) pagination would be a natural future improvement but is NOT implemented today"
  - "no rate-limiting at the controller or service — repeated requests from a single client hit the DB at request rate"
- **known_performance_gaps**:
  - "**Per-request principal-lookup DB round-trip.** Every `/my` call issues a small SELECT against `user_owner_mapping JOIN owner`. For a UI mounting `Recommended → My Objects` on every page load plus the `My Objects` tab, the request rate per user is multiplicative on the principal-lookup query. A short-lived per-session cache (in-memory, scoped to the SecurityContext) would eliminate the per-call lookup. severity: LOW (the query is indexed by `(oidc_username, provider, deleted_at)` per the schema migrations; the per-call cost is small but multiplicative)"
  - "**Unbounded `size`.** No `@Max` on the controller, no `maximum:` in OpenAPI spec. A request with `size=1_000_000` against a user owning 1M entities scans and materialises the entire ownership-joined CTE. Pagination IS applied at SQL level, so the cost is bounded by the user's ownership cardinality — but a malicious or naïve caller can still trigger expensive scans. severity: MEDIUM (insider DoS vector)"
  - "**Deep-page offset scaling.** `OFFSET (page-1)*size` becomes O(N) on the scan; a UI exposing 'jump to page 100' for a user owning 10K entities triggers a scan of 10K rows just to find page 100's slice. The DESC order on `data_entity.id` would support keyset pagination (`WHERE id < cursor`) but is not exploited. severity: LOW (the offset cost is bounded by ownership cardinality which is typically modest)"

## sources

- understanding ← DataEntityController.java:283-289 + AuthIdentityProviderImpl.java:50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85, 116-127 + ReactiveDataEntityRepositoryImpl.java:515-534 + DataEntityServiceImpl.java:211-225
- concepts.entities.DataEntityRef ← components.yaml:894-915
- concepts.entities.OwnerPojo ← ReactiveUserOwnerMappingRepositoryImpl.java:84
- concepts.entities.USER_OWNER_MAPPING ← ReactiveUserOwnerMappingRepositoryImpl.java:79-82, 116-127
- concepts.entities.OWNERSHIP ← ReactiveDataEntityRepositoryImpl.java:526-527
- concepts.entities.SecurityContext ← AuthIdentityProviderImpl.java:25, 39
- concepts.operations.delegate ← DataEntityController.java:287
- concepts.operations.resolve-principal ← AuthIdentityProviderImpl.java:24-35
- concepts.operations.lookup-owner ← ReactiveUserOwnerMappingRepositoryImpl.java:77-85, 116-127
- concepts.operations.fetch-owner-scoped ← ReactiveDataEntityRepositoryImpl.java:516-534
- concepts.invariants.[1] (no exchange usage) ← DataEntityController.java:283-289
- concepts.invariants.[2] (oidc_username, provider) ← ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- concepts.invariants.[3] (single Mono lookup) ← ReactiveUserOwnerMappingRepositoryImpl.java:83 (.mono call)
- concepts.invariants.[4] (empty-Mono propagation) ← DataEntityServiceImpl.java:212-216
- concepts.invariants.[6] (no PreAuthorize, falls through to authenticated()) ← AuthorizationCustomizer.java:29-30 + SecurityConstants.java (no `/api/dataentities/my` entry)
- concepts.audiences.[0,1] ← odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:149-156, 158-173 + cached fetched_excerpts on sibling controller-level sidecar
- dependencies_semantic.requires-feature ← cached fetched_excerpts on sibling controller-level sidecar + concepts.yaml:3652-3684 (Owner-link invariant)
- dependencies_semantic.requires-runtime ← AuthIdentityProviderImpl.java:25, 39 + DataEntityServiceImpl.java:212-225 + ReactiveUserOwnerMappingRepositoryImpl.java:83 + ReactiveDataEntityRepositoryImpl.java:532
- dependencies_semantic.couples-to.* ← cited file:line ranges within each entry
- tests_coverage_semantic.uncovered_behaviours.[*] ← test search returned no DataEntityController-test class for `/my` paths (Grep `/my\\b|MyObjects|listAssociated` against odd-platform-api/src/test/java returned only the openapi-spec text and the production source; zero test matches)
- docs_link_semantic.inferred_docs.[0] ← cached fetched_excerpts at sibling sidecar `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:113-123` (2026-05-08, status 200) — re-verification deferred; WebFetch denied in current session
- docs_link_semantic.inferred_docs.[1] ← cached fetched_excerpts at sibling sidecar (line 103-112)
- docs_link_semantic.inferred_docs.[2] ← concepts.yaml:3652-3684 (canonical_in_docs: true) — no prior fetched_excerpt cache; verification deferred
- docs_link_semantic.doc_drift_findings.[0] ← DataEntityController.java:284-289 + ReactiveDataEntityRepositoryImpl.java:529
- docs_link_semantic.doc_drift_findings.[1] ← ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- docs_link_semantic.doc_drift_findings.[2] ← openapi.yaml:842-844, 860-862 + DataEntityRelationsServiceImpl.java:25-39
- implicit_adrs.[0] (owner-scoped routes, ADR-CANDIDATE-015 primary source) ← DataEntityController.java:283-305 + DataEntityServiceImpl.java:212-225 + AuthIdentityProviderImpl.java:23-53 + AuthorizationCustomizer.java:29-30 + openapi.yaml:823-840
- implicit_adrs.[1] (JOIN-side owner filter) ← ReactiveDataEntityRepositoryImpl.java:526-527
- implicit_adrs.[2] (single-Mono owner resolution) ← ReactiveUserOwnerMappingRepositoryImpl.java:77-85 + ReactiveUserOwnerMappingRepositoryImpl.java:65-74
- implicit_adrs.[3] (lineage-variant non-owned-but-reachable) ← DataEntityRelationsServiceImpl.java:25-39 + DataEntityServiceImpl.java:219-225 + DataEntityController.java:292-305
- bugs_limitations_corner_cases.[0] (silent empty Flux for unlinked user) ← DataEntityServiceImpl.java:212-216 + AuthIdentityProviderImpl.java:50-53
- bugs_limitations_corner_cases.[1] (DISABLED mode empty) ← DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35
- bugs_limitations_corner_cases.[2] (page=0 negative offset) ← DataEntityController.java:284-289 + ReactiveDataEntityRepositoryImpl.java:530 + components.yaml:4213-4221
- bugs_limitations_corner_cases.[3] (size=0 LIMIT 0) ← ReactiveDataEntityRepositoryImpl.java:529 + components.yaml:4222-4230
- bugs_limitations_corner_cases.[4] (unbounded size) ← DataEntityController.java:284-289 + components.yaml:4222-4230 + ReactiveDataEntityRepositoryImpl.java:529
- bugs_limitations_corner_cases.[5] (lineage-variant single-point-of-failure) ← DataEntityRelationsServiceImpl.java:25-31 + DataEntityServiceImpl.java:219-225
- bugs_limitations_corner_cases.[6] (LOGIN_FORM/LDAP provider=null bleed) ← AuthIdentityProviderImpl.java:24-35 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + LDAPSecurityConfiguration.java:50-57 + LoginFormSecurityConfiguration.java:30-34
- security.auth_mode_relevance ← AuthIdentityProviderImpl.java:24-35 + DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:30-34 + LDAPSecurityConfiguration.java:50-57
- security.ingestion_filter_relevance ← cached evidence on sibling sidecar (IngestionDataEntitiesFilter.java path matcher)
- security.authorization_assertions ← DataEntityController.java:283-305 + DataEntityServiceImpl.java:211-216 + AuthorizationCustomizer.java:24-30
- security.owner_scoping ← ReactiveDataEntityRepositoryImpl.java:526-527 + DataEntityServiceImpl.java:212-216
- security.known_security_gaps.[*] ← cited file:line ranges within each entry
- performance.hot_paths.[*] ← ReactiveUserOwnerMappingRepositoryImpl.java:79-82 + ReactiveDataEntityRepositoryImpl.java:521-530
- performance.scaling_characteristics.[*] ← ReactiveDataEntityRepositoryImpl.java:528-530
- performance.known_performance_gaps.[*] ← cited file:line ranges within each entry

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of tests is verifiable via `find odd-platform-api/src/test -name '*MyObjects*'` returning zero matches and Grep for `/my\b|listAssociated|getMyObjects` returning only production-code or openapi-spec matches)
- docs_link_semantic: MEDIUM (cached fetched_excerpts from sibling sidecar dated 2026-05-08; WebFetch denied in current 2026-05-13 session — re-verification deferred to the next refresh that can hit WebFetch)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (every claim traces to specific lines; the page=0/size=0/large-size boundary claims are deductive from the jOOQ DSL.val + JOIN OFFSET arithmetic at ReactiveDataEntityRepositoryImpl.java:529-530)
- security: HIGH
- performance: HIGH (per-call DB round-trip, unbounded size, deep-page offset all directly inspected)

## Maintainer notes

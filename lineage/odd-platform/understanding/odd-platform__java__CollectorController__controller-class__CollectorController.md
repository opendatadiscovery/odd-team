---
node_id: "odd-platform java CollectorController controller-class:CollectorController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d27
enriched_at_commit: ede5d27
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-W
---

# CollectorController — semantic understanding

## understanding

Reactive Spring WebFlux controller that exposes the F-020 Collector Lifecycle Management HTTP surface — `/api/collectors` (list, register), `/api/collectors/{id}` (update, soft-delete), and `/api/collectors/{id}/token` (regenerate token). Implements the OpenAPI-generated `CollectorApi` interface; each handler is a thin one-line delegation to `CollectorService` via `Mono<ResponseEntity<...>>` (no inline business logic, no transactional boundaries, no authorization annotations). It is the controller half of the end-to-end plaintext-token chain: the register and regenerate-token paths both return a `Collector` response whose embedded `Token.value` is the **full 40-character alphanumeric plaintext** (via `TokenDto(..., true)` set in `ReactiveTokenRepositoryImpl.create` / `updateToken`), while list and update return a `Token.value` masked as `"******{last6}"`. Authorization for all four mutating endpoints is wired declaratively in `SecurityConstants.SECURITY_RULES`; the list endpoint has no permission requirement.

## concepts

- entities: [Collector (platform-level infrastructure entity registering an ODD collector), CollectorFormData (write-projection: name + namespace_name + description), CollectorList (page-of-Collector), Token (40-char alphanumeric shared secret consumed by IngestionDataEntitiesFilter), CollectorService bean]
- operations: [list-collectors-paginated-with-name-query, register-collector, update-collector, soft-delete-collector, regenerate-collector-token]
- invariants:
  - "All four mutating endpoints (POST /api/collectors, PUT /api/collectors/{id}, DELETE /api/collectors/{id}, PUT /api/collectors/{id}/token) are gated declaratively by SecurityRule entries in SecurityConstants — each demanding a distinct MANAGEMENT-tier Permission (COLLECTOR_CREATE / COLLECTOR_UPDATE / COLLECTOR_DELETE / COLLECTOR_TOKEN_REGENERATE)."
  - "The list endpoint (GET /api/collectors) is NOT in the SecurityRule registry — any authenticated user can list every collector on the platform (masked token included)."
  - "Register and regenerate-token return plaintext token in the response body (via TokenDto showToken=true from ReactiveTokenRepositoryImpl.create/updateToken). List and update return masked tokens (showToken=false default from getDto/listDto)."
  - "Delete is a soft-delete (UPDATE collector SET deleted_at = now) — it does NOT cascade to the joined TOKEN row, leaving an orphan TOKEN row in the database after a collector is deleted."
  - "Delete is cascade-protected at the application layer: dataSourceRepository.existsByCollector(id) is checked before delete, throwing CascadeDeleteException if any non-soft-deleted DataSource references the collector. The error surfaces as HTTP 4xx."
  - "Update semantics are full-replace via @MappingTarget on CollectorPojo + form fields (MapStruct generated) — null fields in the form will null the corresponding columns; this is not a partial-merge / PATCH semantic."
- audiences: [odd-platform-ui CollectorsList page (operators registering collectors, rotating tokens, viewing the plaintext on first issue), platform admins delegated MANAGEMENT-tier permissions, automation scripts holding a session cookie for the collectors API]

## dependencies_semantic

- requires-feature:
  - "CollectorService bean (CollectorServiceImpl) — owns list / create / update / delete / regenerateToken operations; each mutating operation is wrapped in @ReactiveTransactional except regenerateToken."
  - "OpenAPI-generated CollectorApi interface (odd-platform-specification/openapi.yaml lines 529-631) — the controller is a thin @Override implementation; HTTP method, path, operationId, and request/response shapes are sourced from the spec."
  - "TokenGenerator bean (TokenGeneratorImpl) — produces the 40-char alphanumeric token on register and rotates it in place on regenerateToken."
  - "ReactiveTokenRepository (ReactiveTokenRepositoryImpl) — wraps TOKEN row INSERT/UPDATE jOOQ-on-R2DBC; both .create() and .updateToken() return TokenDto with showToken=true (plaintext on the wire)."
  - "ReactiveCollectorRepository (ReactiveCollectorRepositoryImpl) — listDto/getDto/create/update/delete; soft-delete via ReactiveAbstractSoftDeleteCRUDRepository.delete (UPDATE deleted_at)."
  - "ReactiveDataSourceRepository.existsByCollector(id) — cascade-protection check in CollectorServiceImpl.delete."
  - "NamespaceService.getOrCreate(name) — invoked from create/update when CollectorFormData.namespace_name is non-empty."
  - "CollectorMapper (MapStruct) — bidirectional DTO/POJO/Form mapping; uses TokenMapper which applies the showToken / masked-token branch."
- requires-config:
  - "auth.ingestion.filter.enabled=true (gates IngestionDataEntitiesFilter registration in odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java) — only when true does the generated/rotated collector token actually authenticate ingestion."
  - "auth.type — must be one of LOGIN_FORM | OAUTH2 | LDAP for the SecurityRule chain (and therefore COLLECTOR_* permissions) to be enforced. auth.type=DISABLED short-circuits SecurityConstants checks entirely (bypass also documented in the regenerateCollectorToken method-level sidecar)."
- requires-runtime:
  - "Spring WebFlux (@RestController + reactive Mono pipeline + ServerWebExchange access for caller context)."
  - "Reactor Core (Mono.flatMap / Mono.map composition for one-line handlers)."
  - "jOOQ-on-R2DBC reactive Postgres for transactional CRUD; CollectorServiceImpl create/update/delete are @ReactiveTransactional, regenerateToken is NOT (single-UPDATE atomicity)."
  - "Lombok (@RequiredArgsConstructor injects CollectorService via constructor)."
- coupling:
  - "Authorization gate is FILE-LOCAL ABSENT: no @PreAuthorize, no @Secured, no programmatic permissionService.hasPermission(...) call. Enforcement lives entirely in SecurityConstants.SECURITY_RULES (path+method → Permission mapping); a refactor that moves an endpoint without updating SecurityConstants silently disables the permission gate. This convention is consistent across the platform's controllers (DataSourceController, OwnerController, etc.) but is not documented in-file."
  - "Response-body shape coupling: the plaintext-vs-masked token distinction is determined by which repository method runs (create/updateToken → plaintext; listDto/getDto → masked) and travels through TokenMapper.mapValue(...). A change to TokenMapper.mapValue or to either repository's TokenDto constructor flips visibility silently."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Controller-layer slice test of any of the five endpoints (GET list, POST register, PUT update, DELETE delete, PUT regenerate-token)."
  - "Authorization integration test: an authenticated user lacking COLLECTOR_CREATE / COLLECTOR_UPDATE / COLLECTOR_DELETE / COLLECTOR_TOKEN_REGENERATE gets 403 on each mutating endpoint."
  - "List-endpoint authorization test: confirm GET /api/collectors is reachable by any authenticated user regardless of MANAGEMENT permissions (or surface that this should be gated)."
  - "Plaintext-vs-masked token contract test: assert POST and PUT-token responses carry full 40-char Token.value; GET-list and PUT-update responses carry masked '******{last6}' value."
  - "Cascade-delete-protection test: DELETE returns CascadeDeleteException when a non-soft-deleted DataSource references the collector; succeeds when none do."
  - "Orphan-TOKEN-row test: confirm that after DELETE, the TOKEN row remains and is no longer reachable via Collector navigation (documents the limitation, or motivates a fix to also soft-delete the TOKEN)."
  - "Update full-replace semantics test: PUT with name only nulls the description / namespace columns on the persisted CollectorPojo (currently silently destructive)."
  - "S2S contract test: tokens generated by POST and PUT-token actually authenticate against IngestionDataEntitiesFilter equality check."
- test_files:
  - "<odd-platform>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/CollectorRepositoryImplTest.java — repository-layer test only; covers list / create / update / delete data access against a real Postgres (testcontainers), but does NOT exercise the controller, service, authorization gate, or token-visibility contract."
- gaps: |
    The entire CollectorController surface is uncovered at the controller, service,
    and integration layers. A regression that flips response-body token visibility
    (e.g. accidentally constructing TokenDto without `, true` in
    ReactiveTokenRepositoryImpl), removes a SecurityRule entry, breaks the
    cascade-delete check, or changes update semantics from full-replace to partial
    would all ship un-caught. The single CollectorRepositoryImplTest only confirms
    the database round-trip via showToken=false defaults — it does not assert the
    public contract. A new CollectorControllerTest exercising the five endpoints
    against the @SpringBootTest WebFlux stack with policy-scoped users would be
    the highest-leverage addition for F-020.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Documents COLLECTOR_CREATE / COLLECTOR_UPDATE / COLLECTOR_DELETE / COLLECTOR_TOKEN_REGENERATE verbatim under the Management permissions section — the canonical live record of this controller's authorization gates. WebFetch confirmed (2026-05-20) all four permission names are present with one-line descriptions."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "COLLECTOR_CREATE. Allows registering a new metadata collector."
      "COLLECTOR_DELETE. Allows deleting a collector."
      "COLLECTOR_TOKEN_REGENERATE. Allows regenerating the security token for a collector."
      "COLLECTOR_UPDATE. Allows editing a collector's configuration."
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector"
    anchor: ""
    rationale: "The collector consumes the token issued by this controller. WebFetch (2026-05-20) confirmed the page references `token: <COLLECTOR_TOKEN>` in the minimal config example and points readers to 'Token and datasource registration on the hub' — but does NOT cover registration, rotation, deletion, plaintext-on-the-wire, or RBAC."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "token: <COLLECTOR_TOKEN>" (with note "see Token and datasource registration on the hub")
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/management"
    anchor: ""
    rationale: "/management is the documented UI surface page for the platform's admin panel. WebFetch (2026-05-20) returned 'no collector mentions' — this controller's UI consumer (CollectorsList.tsx) is not surfaced on the management.md page, surfacing a doc-coverage gap."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "no collector mentions" (verbatim WebFetch result for the page)
    confidence: LOW
- doc_drift_findings:
  - "There is no canonical live ODD docs page for F-020 (collector lifecycle management). The path /active-platform-features/collectors 404s (WebFetched 2026-05-20). The Permissions page enumerates the four COLLECTOR_* permissions without operational guidance; the odd-collector integration page references <COLLECTOR_TOKEN> without describing how it is registered, rotated, or what happens to it on deletion; /management does not mention collectors. End-to-end an operator who wants to know 'how do I register a collector and where does the token come from' has no canonical page to land on."
  - "The doc-stack does not warn that the registration response and the rotation response BOTH return the full plaintext token in the response body, while the list response returns it masked. UI flows (CollectorsList copy-to-clipboard) and proxy/log configurations should know which endpoints expose the secret on the wire — this is undocumented."
  - "The doc-stack does not warn that DELETE leaves an orphan TOKEN row in the database (cross-confirmed in batch-R ReactiveCollectorRepositoryImpl sidecar). This is invisible to operators but matters for backup / GDPR-style data-deletion contracts."
  - "The doc-stack does not warn that GET /api/collectors is callable by ANY authenticated user (no Permission gate in SecurityConstants), exposing the collector inventory (name, namespace, masked token last-6) to read-only auditors who lack any MANAGEMENT permission. The Permissions page documents only the four mutating gates."

## implicit_adrs

- "Authorization for collector mutations is declarative-by-path, not annotation-by-controller-method" — evidence: SecurityConstants.java:127-137 (four SecurityRule entries for /api/collectors POST/PUT/DELETE/token-PUT, each with a distinct COLLECTOR_* permission) + CollectorController.java:14-52 (no @PreAuthorize, no @Secured, no programmatic check; the entire controller body is delegation) — intent_anchor: SecurityConstants is a curated UtilityClass `SECURITY_RULES` list (the file is named SecurityConstants and the field is named SECURITY_RULES — the entire idiom is the registry pattern) and every mutating controller in the platform consistently has no per-method annotation; the convention is intentional and applied across DataSourceController, OwnerController, TagController, etc. — confidence: HIGH

- "Response shape for token-issuing operations returns plaintext token by design; read operations return masked tokens" — evidence: ReactiveTokenRepositoryImpl.java:21-27 (`create` returns `new TokenDto(r.into(TokenPojo.class), true)`) + ReactiveTokenRepositoryImpl.java:29-39 (`updateToken` returns same with `showToken=true`) + ReactiveCollectorRepositoryImpl.java:114,124 (`getDto`/`listDto` map to `new TokenDto(tokenPojo)` defaulting `showToken=false`) + TokenMapper.java:15-18 (the `mapValue` branch: `dto.showToken() ? dto.tokenPojo().getValue() : "******" + ...substring(...length()-6)`) + TokenDto.java:5-13 (both 2-arg constructor and `visibleToken(...)` factory) — intent_anchor: `TokenDto.visibleToken(...)` is a deliberately-named static factory and the boolean field is named `showToken` (not `isPersisted` or `isFresh`) — the visibility decision is an intentional per-call-site policy. Plaintext-on-issue is necessary because the user has no other way to learn the secret; masking-on-read prevents accidental disclosure via list views. — confidence: HIGH

- "Collector delete is soft-delete (UPDATE deleted_at) — not hard-delete; cascade is application-layer-checked via existsByCollector before the soft-delete commits" — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:51-59 (`delete` issues UPDATE with deleted_at set) + CollectorServiceImpl.java:71-80 (`delete` is @ReactiveTransactional, calls `dataSourceRepository.existsByCollector(id).filter(exists -> !exists).switchIfEmpty(Mono.error(new CascadeDeleteException("Collector has associated data sources")))` then `collectorRepository.delete(id)`) — intent_anchor: the class is named `ReactiveAbstractSoftDeleteCRUDRepository` (explicit naming convention), the exception class is `CascadeDeleteException`, and the message is verbatim "Collector has associated data sources" — the soft-delete-with-cascade-guard pattern is intentional and named. — confidence: HIGH

- "Controller layer is intentionally a thin delegation surface — no inline orchestration, no transactional boundary, no error mapping" — evidence: CollectorController.java:14-52 (each handler is exactly one line: `return collectorService.X(...).map(ResponseEntity::ok)` or equivalent; no try/catch; no @Transactional; no logging) + CollectorService.java:8-18 (the service interface declares the entire business surface, controller just adapts) — intent_anchor: the controller's only fields are `private final CollectorService collectorService` and the entire body is `@Override` delegations — the architectural convention is "controller adapts HTTP ↔ service Mono; service owns transactions, validation, mapping." Applied consistently across the platform's controller package. — confidence: HIGH

## bugs_limitations_corner_cases

- "DELETE leaves orphan TOKEN row: the soft-delete sets COLLECTOR.deleted_at but does NOT also soft-delete or hard-delete the joined TOKEN row referenced by COLLECTOR.token_id. After deletion, the TOKEN row remains in the table with its plaintext value, unreachable via Collector navigation but still present in backups, dumps, and DB reads. Confirmed by batch-R ReactiveCollectorRepositoryImpl sidecar and by absence of any token-deletion call in CollectorServiceImpl.delete." — evidence: CollectorServiceImpl.java:71-80 (delete path issues only `collectorRepository.delete(id)`; no `tokenRepository.delete(...)`) + ReactiveAbstractSoftDeleteCRUDRepository.java:51-59 (soft-delete UPDATEs only the parent table) — severity: MEDIUM

- "GET /api/collectors has no Permission gate — any authenticated user can list every collector on the platform (with masked tokens) regardless of whether they hold any MANAGEMENT-tier permission. Compare to the other four endpoints which each require a specific COLLECTOR_* permission. There is no comment in SecurityConstants defending the omission; the Permissions doc page does not warn that list is open to all authenticated users." — evidence: SecurityConstants.java:127-137 (POST/PUT/DELETE/PUT-token rules present; no GET rule for /api/collectors) + CollectorController.java:19-25 (no annotation, no programmatic check) — severity: MEDIUM

- "Update semantics are full-replace, not PATCH — CollectorMapper.applyToDto with @MappingTarget will overwrite collector fields with whatever (including nulls) appears in the incoming CollectorFormData. A UI flow that submits a partial form (e.g. just the name) will null the description and namespace columns. The OpenAPI spec uses PUT (idempotent full-replace per HTTP semantics is technically correct), but the field semantics are not documented anywhere a UI author would discover them before writing a partial-update flow." — evidence: CollectorController.java:33-40 (delegation passes the entire CollectorFormData through) + CollectorServiceImpl.java:50-69 (`collectorMapper.applyToDto(collectorDto.collectorPojo(), form)`) + CollectorMapper.java:41-47 (`@MappingTarget` is whole-pojo overwrite via MapStruct) — severity: MEDIUM

- "Register and regenerate-token endpoints return the plaintext token in the HTTP response body — any reverse-proxy, API gateway, browser history, request/response logger, or APM tool on the wire captures the credential in cleartext. The platform does not set `Cache-Control: no-store` or any marker on the response indicating sensitive content; there is no documentation warning operators to verify TLS-only and to disable response-body logging on these paths." — evidence: CollectorController.java:27-31, 47-51 (no header customisation in either handler) + TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:26, 38 — severity: MEDIUM

- "No audit logging on any mutating endpoint. Grep against CollectorController.java, CollectorServiceImpl.java, TokenGeneratorImpl.java, ReactiveTokenRepositoryImpl.java for `log\\.(info|warn|debug|error)` returns zero matches on the F-020 paths. The TOKEN.updated_by column captures the actor on rotation, but it is overwritten on each rotation (single-state, not append-only). Forensic investigation of 'who registered / deleted / rotated collector X and when' is unanswerable from production data alone." — evidence: CollectorController.java:1-52 (no @Slf4j, no log imports) + CollectorServiceImpl.java:1-110 (no log statements at any severity) + TokenGeneratorImpl.java:1-53 (no log statements) — severity: HIGH

- "No CollectorController test file exists at any granularity. Glob for `CollectorControllerTest*.java` returns no matches; grep for any of the five method names against test files returns no matches. The only collector-related test is `CollectorRepositoryImplTest.java` which exercises the repository layer." — evidence: glob `<odd-platform>/**/CollectorControllerTest*.java` returned empty; grep `CollectorController|registerCollector|regenerateCollectorToken|updateCollector|deleteCollector` across `*Test*.java` returned no matches — severity: HIGH

- "No rate-limit on any of the five endpoints. An attacker holding a session of a MANAGEMENT-permission user can rapidly create/delete/rotate collectors at the rate the WebFlux stack allows; an attacker holding any authenticated session can rapidly list collectors and harvest masked-token suffixes (potentially aiding offline brute-force on a 6-char suffix space if other guessing approaches narrow it). No `@RateLimited` / no programmatic throttle / no SecurityRule rate-limit metadata." — evidence: CollectorController.java:1-52 (no rate-limit annotations) + SecurityConstants.java:127-137 (rules carry only path/method/permission tuples) — severity: MEDIUM

- "Register response returns HTTP 200 (`ResponseEntity::ok`) instead of HTTP 201 Created as declared in openapi.yaml:557-563 (`'201': description: The resource has been successfully created`). The OpenAPI spec promises 201 but the controller returns 200 via `ResponseEntity::ok`. Similarly update declares 201 in spec (line 586-591) and returns 200." — evidence: CollectorController.java:27-31 (`ResponseEntity::ok`) + CollectorController.java:33-40 (`ResponseEntity::ok`) + openapi.yaml:557-563 + openapi.yaml:586-591 — severity: LOW (functional impact zero; spec-doc drift)

- "No idempotency token / If-Match / ETag on regenerate-token PUT — a UI double-submit or network retry will rotate the token twice and invalidate the value the user copied to clipboard from the first response." — evidence: CollectorController.java:47-51 (no headers consulted) + CollectorApi (generated; openapi.yaml:611-631 declares no idempotency parameter) — severity: LOW

- "Token entropy uses `RandomStringUtils.randomAlphanumeric(40)` which delegates to `ThreadLocalRandom` in commons-lang 3.16+, NOT `SecureRandom`. Cross-confirmed in the regenerateCollectorToken method-level sidecar — applies equally to the register path which uses the same TokenGenerator." — evidence: TokenGeneratorImpl.java:39, 49 — severity: HIGH

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes whose SecurityWebFilterChain enforces SecurityConstants.SECURITY_RULES. `DISABLED` short-circuits the rules (any caller reaching the platform can call every endpoint including DELETE and token regeneration). `S2S` does NOT apply to this controller's surface — S2S is the auth mode consumed BY the token this controller issues, not enforced ON this controller.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. All five endpoints sit under `/api/collectors`; IngestionDataEntitiesFilter only matches `/ingestion/entities`. This controller PRODUCES the credentials the ingestion filter consumes.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, /api/collectors POST, COLLECTOR_CREATE)` — register requires MANAGEMENT-tier COLLECTOR_CREATE Permission" — evidence: SecurityConstants.java:127-128
  - "`SecurityRule(NO_CONTEXT, /api/collectors/{collector_id} PUT, COLLECTOR_UPDATE)` — update requires MANAGEMENT-tier COLLECTOR_UPDATE Permission" — evidence: SecurityConstants.java:129-131
  - "`SecurityRule(NO_CONTEXT, /api/collectors/{collector_id} DELETE, COLLECTOR_DELETE)` — delete requires MANAGEMENT-tier COLLECTOR_DELETE Permission" — evidence: SecurityConstants.java:132-134
  - "`SecurityRule(NO_CONTEXT, /api/collectors/{collector_id}/token PUT, COLLECTOR_TOKEN_REGENERATE)` — regenerate requires MANAGEMENT-tier COLLECTOR_TOKEN_REGENERATE Permission" — evidence: SecurityConstants.java:135-137
  - "GET /api/collectors — NO SecurityRule, NO @PreAuthorize, NO programmatic check — list is reachable by any authenticated user" — evidence: SecurityConstants.java:127-137 (POST/PUT/DELETE/PUT-token only; no GET rule) + CollectorController.java:19-25
  - "No `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call on the controller class or any method" — evidence: CollectorController.java:14-52
- **owner_scoping**: `N/A — Collector is a global resource, not data-scoped`. The COLLECTOR table has no `owner_id` column; permissions are MANAGEMENT-tier and global. The list endpoint does not filter by current user's owners — every authenticated user sees every collector.
- **data_exposure**:
  - "Collector resource body on POST and PUT-token: { id, namespace, token.value (40-char PLAINTEXT), name, description, createdAt, updatedAt } → caller of POST /api/collectors holding COLLECTOR_CREATE, OR caller of PUT /api/collectors/{id}/token holding COLLECTOR_TOKEN_REGENERATE, OR any caller in auth.type=DISABLED."
  - "Collector resource body on GET-list and PUT-update: same shape but token.value is masked to '******{last6chars}' → caller of GET /api/collectors is ANY authenticated user; caller of PUT /api/collectors/{id} holds COLLECTOR_UPDATE."
  - "Token cleartext credentials traverse the response wire on register and regenerate paths — any reverse proxy, API gateway, browser cache, server-side response-body logger, or APM tool on those paths captures the secret. No `Cache-Control: no-store` / no `X-Sensitive-Body` / no documented warning."
- **known_security_gaps**:
  - "GET /api/collectors is unrestricted — any authenticated user can enumerate all collectors with masked-token last-6 chars exposed. No SecurityRule entry, no in-file comment defends the omission." — evidence: SecurityConstants.java:127-137 (no GET rule) + CollectorController.java:19-25 — severity: MEDIUM
  - "Register and regenerate-token endpoints return plaintext 40-char token in response body. No response header marks the body as sensitive. Cross-platform end-to-end plaintext token chain: controller-tier (this file) → response wire → CollectorsList UI plaintext DOM render (batch-Q) → repository at-rest (batch-R)." — evidence: CollectorController.java:27-31, 47-51 + TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:21-39 — severity: MEDIUM (high in aggregate via the chain)
  - "Token entropy is non-cryptographically-secure (RandomStringUtils.randomAlphanumeric → ThreadLocalRandom in commons-lang 3.16+, not SecureRandom). 40 alphanumeric chars ≈ 238 bits of input space but the RNG quality is the binding constraint." — evidence: TokenGeneratorImpl.java:39, 49 — severity: HIGH
  - "DELETE leaves orphan TOKEN row — the plaintext credential of a deleted collector persists in the TOKEN table indefinitely. Backups, replicas, and dumps carry it. A subsequent operator query against TOKEN by id range (e.g. during incident response) sees credentials that should have been retired." — evidence: CollectorServiceImpl.java:71-80 (no token cleanup) + ReactiveAbstractSoftDeleteCRUDRepository.java:51-59 — severity: HIGH
  - "Zero audit logging across the entire F-020 surface — no record of who registered, updated, deleted, or rotated any collector, beyond the in-place updated_by column (single-state). Forensic incident response cannot reconstruct collector-lifecycle history from production data." — evidence: CollectorController.java:1-52 (no @Slf4j) + CollectorServiceImpl.java:1-110 (no log statements) + TokenGeneratorImpl.java:1-53 (no log statements) — severity: HIGH
  - "In auth.type=DISABLED deployments, all four COLLECTOR_* Permission gates are bypassed. Any caller reaching the platform can register / update / delete / rotate any collector. The Authentication docs page describes DISABLED as an auth MODE without warning that all RBAC is also disabled." — evidence: SecurityConstants.java:127-137 (rules registry only applies through SecurityWebFilterChain, which DISABLED bypasses) + DisabledAuthSecurityConfiguration.java (security-config file present in odd-platform-api/src/main/java/.../auth/config/) — severity: HIGH (in DISABLED deployments)
  - "No rate-limit on any of the five endpoints — see bugs_limitations_corner_cases entry on bulk-rotate / harvest attacks." — evidence: CollectorController.java:1-52 + SecurityConstants.java:127-137 — severity: MEDIUM

## performance

- **hot_paths**:
  - "GET /api/collectors (list) — 1 paginated SELECT with LEFT JOIN to NAMESPACE + LEFT JOIN to TOKEN, ORDER BY id ASC, plus 1 COUNT for pagination total. No index pressure mentioned in the repository code; relies on Postgres default indexes." — evidence: ReactiveCollectorRepositoryImpl.java:60-86 + CollectorController.java:19-25
  - "POST /api/collectors (register) — 1 token INSERT, optional namespace getOrCreate (1-2 statements), 1 collector INSERT. 2-4 DB round-trips. @ReactiveTransactional." — evidence: CollectorServiceImpl.java:37-48 + ReactiveTokenRepositoryImpl.java:21-27
  - "PUT /api/collectors/{id} (update) — 1 collector SELECT with joins (getDto), optional namespace getOrCreate, 1 collector UPDATE. @ReactiveTransactional." — evidence: CollectorServiceImpl.java:50-69
  - "DELETE /api/collectors/{id} — 1 existsByCollector SELECT against DATA_SOURCE, 1 collector soft-delete UPDATE. @ReactiveTransactional." — evidence: CollectorServiceImpl.java:71-80
  - "PUT /api/collectors/{id}/token (rotate) — 1 collector SELECT (getDto), 1 token UPDATE. NOT @ReactiveTransactional (single-UPDATE atomicity is enough; documented in regenerateCollectorToken method-level sidecar)." — evidence: CollectorServiceImpl.java:82-90
- **throughput_characteristics**:
  - "Single-collector operations only — no bulk register / bulk delete / bulk rotate endpoint. Operators rotating N collectors make N HTTP calls; this is significant after a credential leak that requires platform-wide rotation." — evidence: CollectorController.java:19-52 (all method signatures take 0-1 collectorId)
  - "Reactive Mono signatures — non-blocking on WebFlux threads, but each request still serializes through flatMap chains with 2-4 DB round-trips."
- **resource_allocation**:
  - "Memory footprint per request is small (CollectorDto + TokenPojo + ResponseEntity). No outbound HTTP, no file I/O. No streaming responses; list endpoint loads the full page into memory before mapping."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally. No locks, no advisory locks, no shared in-memory state." — evidence: CollectorController.java:14-17 (only injected dependency is CollectorService)
  - "Last-write-wins for concurrent updates / rotations against the same collector_id — no `@Version` column, no `WHERE updated_at = :prev` predicate in the UPDATE statements. Two simultaneous PUTs against the same collector produce a last-commit-wins outcome with no error to either caller." — evidence: ReactiveCollectorRepositoryImpl.java:60-127 (no version predicate visible in the mapped UPDATE) + ReactiveTokenRepositoryImpl.java:29-39 (UPDATE WHERE id = :id only)
  - "List endpoint paginates via `(page - 1) * size` OFFSET — well-known anti-pattern at large offsets but acceptable here because collector count per platform is typically <100. Becomes an issue if a platform has thousands of collectors." — evidence: ReactiveCollectorRepositoryImpl.java:60-86 (paginate via OFFSET)
- **known_performance_gaps**:
  - "No bulk-mutation endpoints — post-incident credential rotation against N collectors is N HTTP calls of operator time." — evidence: CollectorController.java:19-52 (single-id signatures only) — severity: LOW
  - "Concurrent-rotation race silently discards credentials — covered in regenerateCollectorToken method-level sidecar." — severity: LOW
  - "OFFSET-based pagination scales O(N) with offset — irrelevant at typical collector count, but a finding if collector inventories scale to 10k+." — evidence: ReactiveCollectorRepositoryImpl.java:64 (`(page - 1) * size` arithmetic feeding paginate) — severity: LOW

## sources

- understanding ← CollectorController.java:1-52 + CollectorServiceImpl.java:1-110 + ReactiveTokenRepositoryImpl.java:21-39 + ReactiveCollectorRepositoryImpl.java:46-127 + TokenMapper.java:15-18 + SecurityConstants.java:127-137
- concepts.entities ← components.yaml:1364-1394 (Collector + CollectorFormData + CollectorList) + components.yaml:1327-1349 (Token)
- concepts.invariants[0] ← SecurityConstants.java:127-137
- concepts.invariants[1] ← SecurityConstants.java:98-355 (full SECURITY_RULES; no GET /api/collectors entry)
- concepts.invariants[2] ← ReactiveTokenRepositoryImpl.java:26, 38 + ReactiveCollectorRepositoryImpl.java:114, 124 + TokenMapper.java:15-18
- concepts.invariants[3] ← CollectorServiceImpl.java:71-80 (no token delete) + ReactiveAbstractSoftDeleteCRUDRepository.java:51-59
- concepts.invariants[4] ← CollectorServiceImpl.java:73-77 + ReactiveDataSourceRepositoryImpl.java:124-132
- concepts.invariants[5] ← CollectorMapper.java:41-47 (@MappingTarget) + CollectorServiceImpl.java:50-69
- dependencies_semantic.requires-feature ← CollectorService.java:1-18 + CollectorServiceImpl.java:1-110 + ReactiveTokenRepositoryImpl.java:1-40 + ReactiveCollectorRepositoryImpl.java:1-127 + ReactiveDataSourceRepositoryImpl.java:124-132 + CollectorMapper.java:1-48
- dependencies_semantic.requires-config ← IngestionDataEntitiesFilter.java:20 (per regenerateCollectorToken method-level sidecar) + SecurityConstants.java:127-137 (rules consumed only under non-DISABLED auth.type)
- dependencies_semantic.requires-runtime ← CollectorController.java:1-17
- dependencies_semantic.coupling ← SecurityConstants.java:127-137 + CollectorController.java:14-52 + TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:21-39
- tests_coverage_semantic.test_files ← glob `<odd-platform>/**/CollectorControllerTest*.java` (empty) + glob `<odd-platform>/**/CollectorRepositoryImplTest.java` (single match) + grep `CollectorController|registerCollector|regenerateCollectorToken|updateCollector|deleteCollector` against `*Test*.java` (no matches)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/integrations/integrations/odd-collector (status 200)
- docs_link_semantic.inferred_docs[2] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/management (status 200)
- docs_link_semantic.doc_drift_findings ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/active-platform-features/collectors (404 — page does not exist) + the three inferred_docs above (none cover F-020 end-to-end)
- implicit_adrs[0] ← SecurityConstants.java:127-137 + CollectorController.java:14-52
- implicit_adrs[1] ← ReactiveTokenRepositoryImpl.java:21-39 + ReactiveCollectorRepositoryImpl.java:114, 124 + TokenMapper.java:15-18 + TokenDto.java:5-13
- implicit_adrs[2] ← ReactiveAbstractSoftDeleteCRUDRepository.java:51-59 + CollectorServiceImpl.java:71-80
- implicit_adrs[3] ← CollectorController.java:14-52 + CollectorService.java:8-18
- bugs_limitations_corner_cases[0] ← CollectorServiceImpl.java:71-80 + ReactiveAbstractSoftDeleteCRUDRepository.java:51-59
- bugs_limitations_corner_cases[1] ← SecurityConstants.java:127-137 (no GET rule) + CollectorController.java:19-25
- bugs_limitations_corner_cases[2] ← CollectorController.java:33-40 + CollectorServiceImpl.java:50-69 + CollectorMapper.java:41-47
- bugs_limitations_corner_cases[3] ← CollectorController.java:27-31, 47-51 + TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:26, 38
- bugs_limitations_corner_cases[4] ← grep `log\\.(info|warn|debug|error)` against CollectorController.java / CollectorServiceImpl.java / TokenGeneratorImpl.java / ReactiveTokenRepositoryImpl.java returned zero matches
- bugs_limitations_corner_cases[5] ← glob `<odd-platform>/**/CollectorControllerTest*.java` returned no matches; grep for method names across `*Test*.java` returned no matches
- bugs_limitations_corner_cases[6] ← CollectorController.java:1-52 + SecurityConstants.java:127-137
- bugs_limitations_corner_cases[7] ← CollectorController.java:27-31, 33-40 + openapi.yaml:557-563, 586-591
- bugs_limitations_corner_cases[8] ← CollectorController.java:47-51 + openapi.yaml:611-631
- bugs_limitations_corner_cases[9] ← TokenGeneratorImpl.java:39, 49
- security.auth_mode_relevance ← SecurityConstants.java:127-137 + auth/config package glob (LoginForm/OAuth/LDAP/Disabled SecurityConfiguration files all present per regenerateCollectorToken sidecar)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (path matcher /ingestion/entities, not /api/collectors/*)
- security.authorization_assertions[0..3] ← SecurityConstants.java:127-137 (each rule cited at its line range)
- security.authorization_assertions[4] ← SecurityConstants.java:127-137 + CollectorController.java:19-25 (absence)
- security.authorization_assertions[5] ← CollectorController.java:14-52 (full file, no annotations)
- security.owner_scoping ← CollectorPojo (no owner_id) + ReactiveCollectorRepositoryImpl.java:46-86 (no owner filter)
- security.data_exposure ← TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:26, 38 + ReactiveCollectorRepositoryImpl.java:114, 124 + CollectorController.java:19-25
- security.known_security_gaps[0] ← SecurityConstants.java:127-137 (no GET rule) + CollectorController.java:19-25
- security.known_security_gaps[1] ← CollectorController.java:27-31, 47-51 + TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:21-39
- security.known_security_gaps[2] ← TokenGeneratorImpl.java:39, 49
- security.known_security_gaps[3] ← CollectorServiceImpl.java:71-80 + ReactiveAbstractSoftDeleteCRUDRepository.java:51-59
- security.known_security_gaps[4] ← CollectorController.java:1-52 + CollectorServiceImpl.java:1-110 + TokenGeneratorImpl.java:1-53 (no log statements anywhere)
- security.known_security_gaps[5] ← SecurityConstants.java:127-137 + DisabledAuthSecurityConfiguration.java (file present per glob; cross-confirmed in regenerateCollectorToken sidecar)
- security.known_security_gaps[6] ← CollectorController.java:1-52 + SecurityConstants.java:127-137
- performance.hot_paths ← CollectorServiceImpl.java:32-90 + ReactiveCollectorRepositoryImpl.java:46-127 + ReactiveTokenRepositoryImpl.java:21-39 + ReactiveDataSourceRepositoryImpl.java:124-132
- performance.throughput_characteristics ← CollectorController.java:19-52 (single-id signatures)
- performance.resource_allocation ← CollectorController.java:1-52 (no I/O beyond DB)
- performance.scaling_characteristics ← CollectorController.java:14-17 + ReactiveCollectorRepositoryImpl.java:60-86 + ReactiveTokenRepositoryImpl.java:29-39
- performance.known_performance_gaps[0] ← CollectorController.java:19-52 (single-id signatures only)
- performance.known_performance_gaps[1] ← ReactiveTokenRepositoryImpl.java:29-39 (no optimistic locking)
- performance.known_performance_gaps[2] ← ReactiveCollectorRepositoryImpl.java:64 (OFFSET arithmetic)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes


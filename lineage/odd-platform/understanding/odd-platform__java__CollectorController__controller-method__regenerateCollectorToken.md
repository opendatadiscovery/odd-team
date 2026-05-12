---
node_id: "odd-platform java CollectorController controller-method:regenerateCollectorToken"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-A
---

# CollectorController.regenerateCollectorToken — semantic understanding

## understanding

Reactive HTTP handler for `PUT /api/collectors/{collector_id}/token`: rotates the shared-secret bearer token used by an ODD collector to authenticate `POST /ingestion/entities` requests against the S2S `IngestionDataEntitiesFilter`. The controller delegates to `CollectorService.regenerateToken(collectorId)` and returns the refreshed `Collector` resource as `200 OK`; the refreshed body carries the new 40-character alphanumeric plaintext token in the `token.value` field (visible — not masked — because `TokenDto.showToken=true` on the rotation path). Rotation is an **in-place UPDATE** of the existing `TOKEN` row — there is no rotation-grace window, no old/new pair, and no separate token-revocation step.

## concepts

- entities: [Collector, Token (40-char alphanumeric shared secret), TokenPojo, CollectorDto]
- operations: [regenerate-collector-token, rotate-ingestion-secret, return-plaintext-token]
- invariants:
  - "Endpoint is gated by Permission `COLLECTOR_TOKEN_REGENERATE` (MANAGEMENT tier) via SecurityConstants.SECURITY_RULES — no admin/owner check, no per-collector ACL beyond the policy."
  - "Rotation is in-place: the existing TOKEN row is UPDATEd with a new `value`. There is no overlap window where both old and new tokens validate."
  - "The new token is RETURNED in the response body in plaintext (40 alphanumeric chars). The platform stores it likewise in plaintext in the DB — there is no hashing layer."
  - "The S2S `IngestionDataEntitiesFilter` does a literal `.equals(...)` against the live in-DB token value; the moment regeneration commits, in-flight ingestion requests using the old token will start 401-ing with `\"Token is not correct\"`."
- audiences: [odd-platform-ui collector settings page (operators rotating leaked / scheduled-rotation tokens), platform admins enforcing credential hygiene]

## dependencies_semantic

- requires-feature:
  - "CollectorService bean — owns the `regenerateToken(collectorId)` operation: load CollectorDto, hand the existing TokenPojo to TokenGenerator.regenerateToken, persist via ReactiveTokenRepository.updateToken, remap to API Collector."
  - "OpenAPI-generated CollectorApi interface — controller is a `@Override` implementation; HTTP method/path/operationId all come from the generated spec."
  - "TokenGenerator bean (TokenGeneratorImpl) — mutates the existing TokenPojo in place, setting `value = RandomStringUtils.randomAlphanumeric(40)`, `updatedAt = now`, `updatedBy = currentUsername`."
  - "ReactiveTokenRepository — issues `UPDATE token SET ... WHERE id = :id` and re-reads the updated row into a TokenDto with `showToken=true`."
- requires-config:
  - "`auth.ingestion.filter.enabled=true` (the value that gates IngestionDataEntitiesFilter registration) — only when this is true does the rotated token actually matter for ingestion authentication."
- requires-runtime:
  - "Spring WebFlux (RestController + reactive Mono pipeline)."
  - "Reactor Core (Mono.flatMap / map composition)."
  - "jOOQ-on-R2DBC reactive PG transaction (CollectorServiceImpl.regenerateToken is NOT `@ReactiveTransactional` — see bugs section)."
- coupling:
  - "Authorization gate lives in SecurityConstants.SECURITY_RULES, not on the controller — there is no `@PreAuthorize` on the controller method nor on the generated CollectorApi interface."
  - "TokenGenerator pulls `currentUser` via `AuthIdentityProvider.getCurrentUser()` purely to stamp the `updated_by` column — it does NOT use this to assert authorization. The Permission check has already passed by the time TokenGenerator runs."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Controller-layer test of `PUT /api/collectors/{collector_id}/token` returning 200 with a Collector body whose `token.value` differs from the previous value."
  - "Service-layer test of `CollectorServiceImpl.regenerateToken` — NotFoundException on missing collector, success path persists a new token value via ReactiveTokenRepository.updateToken."
  - "TokenGenerator test of `regenerateToken(null)` throwing `RuntimeException(\"Token is null\")` (line 46 of TokenGeneratorImpl)."
  - "Integration test of the auth gate: an authenticated user WITHOUT COLLECTOR_TOKEN_REGENERATE permission gets 403 on the endpoint."
  - "Integration test of S2S filter coupling: an ingestion request using the OLD token after rotation receives 401 `Token is not correct`."
  - "Test of the response-body shape: token.value MUST be the full 40-char plaintext (showToken=true on the regenerate path), distinguishing this endpoint from list / get endpoints that mask via `mapValue` to `******{last6}`."
- test_files:
  - "<odd-platform>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/CollectorRepositoryImplTest.java — repository-layer test for CollectorRepository (not the token-rotation flow; covers list / create / update / delete data access)."
- gaps: |
    The entire token-rotation business path is untested at controller, service, and
    integration layers. A regression that (a) silently disables COLLECTOR_TOKEN_REGENERATE
    permission enforcement (e.g. SecurityConstants typo / rule deletion), (b) flips the
    response-body token visibility to masked (breaking UI copy-to-clipboard flows), or
    (c) breaks the S2S filter's equality check against the rotated value, would not be
    caught by the current test suite. Adding even a single end-to-end test
    `rotate → verify-old-token-401 → verify-new-token-200 against /ingestion/entities`
    would be high-leverage; the contract is currently asserted only by manual UI testing.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The page documents `COLLECTOR_TOKEN_REGENERATE` verbatim as a Management-tier permission ('Allows regenerating the security token for a collector.'), which is the live authorization gate for this endpoint per SecurityConstants.java:135-137."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "Lists the S2S authentication mode that the rotated token is consumed by (IngestionDataEntitiesFilter). The page does NOT discuss token rotation, audit logging, or grace periods — surfacing this as a doc gap."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "No live ODD docs page covers the operational mechanics of collector-token rotation: who can rotate (Permission name), what happens to in-flight ingestion requests against the old token, whether rotation is logged, whether the rotation response carries the full plaintext token. The Authentication page enumerates S2S as an auth mode without explaining how its credential is rotated; the Permissions page names COLLECTOR_TOKEN_REGENERATE without operational guidance. A `Token Rotation` section under enable-security would be the canonical home."
  - "WebFetched 2026-05-10 of /configuration-and-deployment/enable-security/authentication (status 200): excerpt — `1. DISABLED — Disable authentication / 2. LOGIN_FORM — Login form / 3. OAUTH2 — OAUTH2/OIDC / 4. LDAP — LDAP / 5. S2S — Server-to-server API-key authentication`. No mention of rotation."
  - "WebFetched 2026-05-10 of /configuration-and-deployment/enable-security/authorization/permissions (status 200): excerpt — `COLLECTOR_TOKEN_REGENERATE: \"Allows regenerating the security token for a collector.\"` — confirms the Permission exists but does not cover operational consequences (no grace period; old-token 401 on in-flight; plaintext-in-response shape)."

## implicit_adrs

- "Authorization for sensitive mutations is wired declaratively in `SecurityConstants.SECURITY_RULES` rather than per-controller `@PreAuthorize` annotations" — evidence: SecurityConstants.java:135-137 (`new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/collectors/{collector_id}/token\", PUT), COLLECTOR_TOKEN_REGENERATE)`) + CollectorController.java:47-51 (no `@PreAuthorize`, no programmatic permission check) — intent_anchor: the entire `SecurityConstants.SECURITY_RULES` list is the file-scoped registry of (path, method, permission) tuples — naming the permission `COLLECTOR_TOKEN_REGENERATE` and using `NO_CONTEXT` (path-based, not entity-context-based) is a deliberate, consistent pattern across every mutating endpoint in the platform — confidence: HIGH

- "Token rotation is an in-place UPDATE of the existing row, not an append-new-then-revoke-old transition" — evidence: TokenGeneratorImpl.java:44-52 (`regenerate(...)` mutates the passed-in TokenPojo via `setValue(...).setUpdatedAt(...).setUpdatedBy(...)`) + ReactiveTokenRepositoryImpl.java:30-39 (`updateToken` issues `DSL.update(TOKEN).set(tokenRecord).where(TOKEN.ID.eq(tokenPojo.getId()))`) — intent_anchor: the method is named `regenerateToken` (not `rotateToken` or `issueNewToken`), and the repository method is `updateToken` (not `replaceToken` or `revokeAndIssue`) — the vocabulary encodes the in-place semantic. The schema has a `TOKEN` row per collector/datasource (1:1 join via `CollectorPojo.tokenId`), so an append model is not possible without a schema change — confidence: HIGH

- "Token is returned in plaintext on rotation; masked on read" — evidence: TokenMapper.java:15-18 (`return dto.showToken() ? dto.tokenPojo().getValue() : \"******\" + dto.tokenPojo().getValue().substring(dto.tokenPojo().getValue().length() - 6);`) + ReactiveTokenRepositoryImpl.java:37-38 (`updateToken` returns `new TokenDto(r.into(TokenPojo.class), true)` — `showToken=true`) + ReactiveCollectorRepositoryImpl.java:114,124 (list/get paths use `new TokenDto(tokenPojo)` — defaulting `showToken=false`) — intent_anchor: the `TokenDto` record has both a 1-arg constructor defaulting `showToken=false` (`TokenDto.java:6-8`) AND a static `visibleToken(token)` factory (line 10-12), indicating the design treats visibility as a deliberate per-call-site choice. Returning plaintext on regenerate is intentional because the user has no other way to learn the new secret — confidence: HIGH

- "Token authentication is plaintext-equality against an in-DB string; no hashing layer" — evidence: IngestionDataEntitiesFilter.java:55-58 (`if (!dto.tokenPojo().getValue().equals(token)) { throw new AccessDeniedException(\"Token is not correct\"); }`) + TokenGeneratorImpl.java:39,49 (token value is the raw `RandomStringUtils.randomAlphanumeric(40)` — no hashing prior to persistence) — intent_anchor: the comparison is a direct `String.equals(...)`, NOT `BCrypt.matches(...)` / `MessageDigest.isEqual(...)` / a HMAC verification — the model is "shared secret stored as-is". This is consistent with the token being a long-random opaque string (40 alphanumeric ≈ 238 bits of entropy) used over TLS-protected transport, but it does mean a DB read or backup carries plaintext credentials — confidence: HIGH

## bugs_limitations_corner_cases

- "No rotation grace period — in-flight ingestion requests using the previous token will 401 the moment the UPDATE commits. There is no `previous_token` column, no `valid_until` window, no overlap. An operator rotating a collector's token during active ingestion will cause ingestion failures until the collector picks up the new token (which is typically a config-file change + restart). The endpoint does not document this; the docs site does not document this." — evidence: TokenGeneratorImpl.java:44-52 + ReactiveTokenRepositoryImpl.java:30-39 + IngestionDataEntitiesFilter.java:55-58 — severity: HIGH

- "Token-rotation operation is NOT audit-logged. No `@Slf4j` log statement at INFO/WARN/AUDIT exists on the regenerate path (verified — grep for `log\\.(info|warn|debug|error)` against CollectorController, CollectorServiceImpl, TokenGeneratorImpl, ReactiveTokenRepositoryImpl returned zero matches). The TOKEN row's `updated_by` column captures the actor username from `AuthIdentityProvider.getCurrentUser()` (TokenGeneratorImpl.java:28-31, 51), which is the only forensic trail — but `updated_by` is overwritten on the next rotation, so the audit trail is single-state, not append-only. A security incident review of 'who rotated token X' cannot answer 'who rotated it before that' from production data." — evidence: TokenGeneratorImpl.java:28-52 (no log calls) + CollectorServiceImpl.java:82-90 (no log calls) + CollectorController.java:47-51 (no log calls) — severity: HIGH

- "CollectorServiceImpl.regenerateToken is NOT `@ReactiveTransactional` (compare to `create`, `update`, `delete` at lines 38, 51, 72, all annotated). The rotation is a single DB UPDATE so a transaction boundary is not strictly required for atomicity, but the absence is inconsistent with the rest of the service — if a follow-up change adds e.g. an audit-log insert or notification dispatch, the developer must remember to add the annotation." — evidence: CollectorServiceImpl.java:82-90 (method has no `@ReactiveTransactional`) — severity: LOW

- "Token plaintext is logged-out via the response body, which means any reverse-proxy / API-gateway / browser-history / response-logging middleware between the UI and the backend will record the new credential. The platform does not warn operators against rotating via a non-TLS path, and there is no header (e.g. `Cache-Control: no-store`, `X-Sensitive-Body: true`) marking the response body as sensitive." — evidence: CollectorController.java:50 (`return collectorService.regenerateToken(collectorId).map(ResponseEntity::ok)` — no response-header customisation) + TokenMapper.java:15-18 (plaintext returned when showToken=true) — severity: MEDIUM

- "Token entropy uses `RandomStringUtils.randomAlphanumeric(40)` which delegates to `Random` (Apache Commons Lang 3.x default) — NOT `SecureRandom`. `RandomStringUtils.random(int, boolean, boolean)` without an explicit Random argument uses `ThreadLocalRandom` in commons-lang 3.16+, which is NOT cryptographically secure. A `RandomStringUtils.secure().nextAlphanumeric(40)` (commons-lang 3.16+) or explicit `new SecureRandom()` would be the security-grade source." — evidence: TokenGeneratorImpl.java:39 (`setValue(RandomStringUtils.randomAlphanumeric(40))`) + TokenGeneratorImpl.java:49 (same) — severity: HIGH

- "There is no rate-limit on the rotation endpoint, no max-rotations-per-window throttle. An attacker who has stolen a valid session of a user with `COLLECTOR_TOKEN_REGENERATE` permission can rotate every collector's token in a tight loop, breaking ingestion across the platform. No backlog item or comment defends the absence." — evidence: CollectorController.java:47-51 (no `@RateLimited` / no programmatic throttle) + SecurityConstants.java:135-137 (no rate-limit metadata on the SecurityRule) — severity: MEDIUM

- "The endpoint returns 200 with the new token even when called through an authentication mode (`auth.type=DISABLED`) that does not identify the caller. In DISABLED mode, AuthIdentityProvider.getCurrentUser() returns empty, and TokenGeneratorImpl.java:30-31 falls through to `Mono.just(this.regenerate(tokenPojo, null))` — the resulting TOKEN row's `updated_by` is NULL. The Permission gate in SecurityConstants is bypassed entirely under `auth.type=DISABLED` (the security filter chain skips authorization). Result: any caller able to reach the platform on a DISABLED deployment can rotate any collector's token and receive the plaintext in the response." — evidence: TokenGeneratorImpl.java:27-32 (`switchIfEmpty(Mono.defer(() -> Mono.just(this.regenerate(tokenPojo, null))))`) + DisabledAuthSecurityConfiguration.java (file present per glob, see security.auth_mode_relevance) — severity: HIGH (in DISABLED deployments) / N/A (in LOGIN_FORM / OAUTH2 / LDAP / S2S deployments)

- "No idempotency token or `If-Match` ETag on the PUT — a UI double-submit (slow click, network retry) will rotate the token twice and invalidate the value the user just copied to clipboard. The response body's `token.value` would be the most recent, but the in-flight first response is now stale immediately." — evidence: CollectorController.java:47-51 (no headers consulted) + CollectorApi (generated; no `If-Match` parameter on the operation) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that route through the SecurityWebFilterChain and enforce `SecurityConstants.SECURITY_RULES` (verified — SecurityConstants.java:98-355 is consumed by each of the three security-config classes per filename glob; `OAuthSecurityConfiguration.java`, `LoginFormSecurityConfiguration.java`, `LDAPSecurityConfiguration.java` are co-located in the config package). `DISABLED` short-circuits all permission checks (see `DisabledAuthSecurityConfiguration.java` per glob; bypass is `bugs_limitations_corner_cases` HIGH entry above). `S2S` does NOT apply — S2S is the ingestion-only auth mode consumed BY this endpoint's output (the rotated token), not enforced ON this endpoint.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The endpoint sits on `/api/collectors/{collector_id}/token`; `IngestionDataEntitiesFilter` only matches `POST /ingestion/entities` (`IngestionDataEntitiesFilter.java:28`). The endpoint instead CREATES the credential that the ingestion filter validates.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, /api/collectors/{collector_id}/token, PUT, COLLECTOR_TOKEN_REGENERATE)` — Permission `COLLECTOR_TOKEN_REGENERATE` (MANAGEMENT tier) required" — evidence: SecurityConstants.java:135-137 + PolicyPermissionDto.java:58 (`COLLECTOR_TOKEN_REGENERATE(MANAGEMENT)`)
  - "No `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call on the controller method itself" — evidence: CollectorController.java:47-51
- **owner_scoping**: `N/A — Collector is a global resource, not data-scoped`. Collectors are platform-level infrastructure (not per-owner) — the MANAGEMENT-tier permission gates them globally. There is no `Owner` association on the `COLLECTOR` table, no `getCollectorsByOwner` lookup.
- **data_exposure**:
  - "Collector resource body (id, namespace, token.value [40-char plaintext], name, description, createdAt, updatedAt) → any caller granted `COLLECTOR_TOKEN_REGENERATE` Permission, OR any caller in a `auth.type=DISABLED` deployment"
  - "Plaintext token traverses every layer between the controller and the client (response interceptors, reverse proxies, browser response cache, server-side request logging if request-body / response-body logging is enabled)"
- **known_security_gaps**:
  - "Rotated token is returned in plaintext via response body — any logging / caching / proxying middleware on the response path captures the credential. No response header marks the body as sensitive (no `Cache-Control: no-store`)." — evidence: CollectorController.java:50 + TokenMapper.java:15-18 — severity: MEDIUM
  - "Token entropy source is `RandomStringUtils.randomAlphanumeric(40)` — non-cryptographically-secure RNG (commons-lang 3.16+ uses ThreadLocalRandom by default; SecureRandom requires `.secure()` variant). 40 alphanumeric chars ≈ 238 bits of input space, but the actual entropy depends on the RNG's quality." — evidence: TokenGeneratorImpl.java:39,49 — severity: HIGH
  - "Token rotation is not audit-logged. The TOKEN.updated_by column is overwritten on each rotation — historical record of 'who rotated it 30 days ago' is unrecoverable from production data." — evidence: TokenGeneratorImpl.java:28-52 (no log calls) + ReactiveTokenRepositoryImpl.java:30-39 (no audit insert) — severity: HIGH
  - "Token is stored in plaintext in the TOKEN table — a DB read, replica, backup, or jOOQ log carries credentials in the clear. No hashing / encryption-at-rest applied at the application layer." — evidence: ReactiveTokenRepositoryImpl.java:21-39 (record stored as-is) + IngestionDataEntitiesFilter.java:55-58 (plaintext `.equals(...)` check confirms no hashing) — severity: HIGH
  - "In `auth.type=DISABLED` deployments, COLLECTOR_TOKEN_REGENERATE is bypassed entirely — any caller reaching the platform can rotate any collector's token and receive the plaintext. The docs do not warn against using DISABLED in any deployment with reachable network exposure." — evidence: TokenGeneratorImpl.java:27-32 (no-current-user fallback) + DisabledAuthSecurityConfiguration.java (config file present per glob) — severity: HIGH (in DISABLED deployments)
  - "No rotation grace period — in-flight ingestion using the old token will 401 immediately. Operators can lock themselves out of ingestion if they rotate during active load. No backlog item / no comment / no docs warn of this." — evidence: ReactiveTokenRepositoryImpl.java:30-39 (UPDATE not INSERT) + IngestionDataEntitiesFilter.java:55-58 (single-value equality) — severity: HIGH (operational severity)
  - "No rate-limit on rotation — an attacker with a stolen session of a MANAGEMENT-permission user can rotate every collector's token in a loop, breaking platform-wide ingestion." — evidence: CollectorController.java:47-51 (no `@RateLimited`) + SecurityConstants.java:135-137 (no throttle metadata) — severity: MEDIUM

## performance

- **hot_paths**:
  - "Endpoint runs synchronously from the caller's perspective: load CollectorDto (1 DB SELECT with joins to NAMESPACE + TOKEN), invoke TokenGenerator.regenerateToken (in-memory mutation), persist via ReactiveTokenRepository.updateToken (1 DB UPDATE RETURNING). 2 DB round-trips total per call. Not on the ingestion hot path." — evidence: CollectorServiceImpl.java:82-90 + ReactiveTokenRepositoryImpl.java:30-39
- **throughput_characteristics**:
  - "Single-collector PUT — no bulk-rotate endpoint. An operator rotating N collectors makes N requests; there is no `POST /api/collectors/tokens/rotate-all` admin endpoint." — evidence: CollectorController.java:47-51 (method signature is `(Long collectorId, ServerWebExchange exchange)` — single id)
  - "Reactive Mono signature — non-blocking from the WebFlux thread, but each request still incurs 2 DB round-trips serialized via flatMap." — evidence: CollectorServiceImpl.java:82-90
- **resource_allocation**:
  - "No outbound HTTP, no file I/O. Memory footprint is one CollectorDto + one TokenPojo + ResponseEntity wrapping a Collector projection. Negligible." — evidence: CollectorController.java:47-51 + CollectorServiceImpl.java:82-90
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally. No locks, no advisory locks, no shared state." — evidence: CollectorController.java:14-17 (`@RestController` + `@RequiredArgsConstructor` with only DI'd dependencies)
  - "Last-write-wins for concurrent rotations: two simultaneous PUTs against the same collector_id will both UPDATE the TOKEN row; the second commit wins and overwrites the first. The two callers receive different `token.value` strings in their respective responses — only the second is actually valid against the ingestion filter. There is no optimistic locking (no `@Version` column, no `WHERE updated_at = :prev`)." — evidence: ReactiveTokenRepositoryImpl.java:30-39 (raw UPDATE WHERE ID = :id, no version predicate)
- **known_performance_gaps**:
  - "No bulk-rotate endpoint — rotating all collectors after a credential leak requires N HTTP calls from the operator's side. For a platform with dozens of collectors, this is operator-time wasted." — evidence: CollectorController.java:47-51 (single-collector signature) — severity: LOW
  - "Concurrent-rotation race produces silently-discarded credentials — operators issuing rapid retries may walk away with a token that is not actually the persisted one. Low-probability but non-zero." — evidence: ReactiveTokenRepositoryImpl.java:30-39 — severity: LOW

## sources

- understanding ← CollectorController.java:47-51 + CollectorServiceImpl.java:82-90 + TokenGeneratorImpl.java:27-52 + ReactiveTokenRepositoryImpl.java:30-39 + TokenMapper.java:15-18 + IngestionDataEntitiesFilter.java:55-58
- concepts.entities ← Collector.java:24-32 (contract model) + TokenPojo (model.tables.pojos) + CollectorDto (dto)
- concepts.invariants[0] ← SecurityConstants.java:135-137 + PolicyPermissionDto.java:58
- concepts.invariants[1] ← ReactiveTokenRepositoryImpl.java:30-39 (UPDATE, not INSERT)
- concepts.invariants[2] ← TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:38 (`new TokenDto(..., true)`)
- concepts.invariants[3] ← IngestionDataEntitiesFilter.java:55-58 (`.equals(...)`)
- dependencies_semantic.requires-feature ← CollectorServiceImpl.java:25-90 + TokenGeneratorImpl.java:18-52 + ReactiveTokenRepositoryImpl.java:17-39
- dependencies_semantic.requires-config ← IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty(value = "auth.ingestion.filter.enabled", havingValue = "true")`)
- dependencies_semantic.coupling ← SecurityConstants.java:135-137 + CollectorController.java:47-51 (no annotations)
- tests_coverage_semantic.test_files ← glob result (only CollectorRepositoryImplTest exists; no service / controller / integration test for the rotation path)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-10 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-10 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (status 200)
- implicit_adrs[0] ← SecurityConstants.java:98-355 (the SECURITY_RULES list is the registry) + CollectorController.java:47-51 (no per-controller annotation)
- implicit_adrs[1] ← TokenGeneratorImpl.java:44-52 + ReactiveTokenRepositoryImpl.java:30-39
- implicit_adrs[2] ← TokenMapper.java:15-18 + TokenDto.java:5-13 + ReactiveTokenRepositoryImpl.java:38 + ReactiveCollectorRepositoryImpl.java:114,124
- implicit_adrs[3] ← IngestionDataEntitiesFilter.java:55-58 + TokenGeneratorImpl.java:39,49
- bugs_limitations_corner_cases[0] ← TokenGeneratorImpl.java:44-52 + ReactiveTokenRepositoryImpl.java:30-39 + IngestionDataEntitiesFilter.java:55-58 (UPDATE + single-value equality)
- bugs_limitations_corner_cases[1] ← grep for `log\\.` against CollectorController / CollectorServiceImpl / TokenGeneratorImpl / ReactiveTokenRepositoryImpl returned zero matches
- bugs_limitations_corner_cases[2] ← CollectorServiceImpl.java:82 (no `@ReactiveTransactional`) vs 38, 51, 72 (annotated)
- bugs_limitations_corner_cases[3] ← CollectorController.java:50 + TokenMapper.java:15-18
- bugs_limitations_corner_cases[4] ← TokenGeneratorImpl.java:39,49 (`RandomStringUtils.randomAlphanumeric(40)`)
- bugs_limitations_corner_cases[5] ← CollectorController.java:47-51 + SecurityConstants.java:135-137 (no rate-limit metadata)
- bugs_limitations_corner_cases[6] ← TokenGeneratorImpl.java:27-32 (no-user fallback) + DisabledAuthSecurityConfiguration.java (file present)
- bugs_limitations_corner_cases[7] ← CollectorController.java:47-51 (no `If-Match` consultation)
- security.auth_mode_relevance ← SecurityConstants.java:98-355 (rules registry) + config package glob (LoginForm/OAuth/LDAP/Disabled security config files all present)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (path matcher is /ingestion/entities, not /api/collectors/*)
- security.authorization_assertions[0] ← SecurityConstants.java:135-137 + PolicyPermissionDto.java:58
- security.authorization_assertions[1] ← CollectorController.java:47-51 (no annotations)
- security.data_exposure ← TokenMapper.java:15-18 + ReactiveTokenRepositoryImpl.java:38
- security.known_security_gaps[0] ← CollectorController.java:50 + TokenMapper.java:15-18
- security.known_security_gaps[1] ← TokenGeneratorImpl.java:39,49
- security.known_security_gaps[2] ← TokenGeneratorImpl.java:28-52 + ReactiveTokenRepositoryImpl.java:30-39
- security.known_security_gaps[3] ← ReactiveTokenRepositoryImpl.java:21-39 + IngestionDataEntitiesFilter.java:55-58
- security.known_security_gaps[4] ← TokenGeneratorImpl.java:27-32 + DisabledAuthSecurityConfiguration.java (filename glob)
- security.known_security_gaps[5] ← ReactiveTokenRepositoryImpl.java:30-39 + IngestionDataEntitiesFilter.java:55-58
- security.known_security_gaps[6] ← CollectorController.java:47-51 + SecurityConstants.java:135-137
- performance.hot_paths ← CollectorServiceImpl.java:82-90 + ReactiveTokenRepositoryImpl.java:30-39
- performance.throughput_characteristics ← CollectorController.java:47-51
- performance.scaling_characteristics ← CollectorController.java:14-17 + ReactiveTokenRepositoryImpl.java:30-39
- performance.known_performance_gaps[0] ← CollectorController.java:47-51 (single-collector signature)
- performance.known_performance_gaps[1] ← ReactiveTokenRepositoryImpl.java:30-39 (no optimistic locking)

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


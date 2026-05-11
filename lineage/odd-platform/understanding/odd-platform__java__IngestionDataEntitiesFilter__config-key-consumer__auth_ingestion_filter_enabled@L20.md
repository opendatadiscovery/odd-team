---
node_id: "odd-platform java IngestionDataEntitiesFilter config-key-consumer:auth.ingestion.filter.enabled@L20"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-B
---

# IngestionDataEntitiesFilter @ConditionalOnProperty(auth.ingestion.filter.enabled) — semantic understanding

## understanding

Class-level `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` is the registration gate for the `IngestionDataEntitiesFilter` WebFilter — the **only** code path that authenticates `POST /ingestion/entities` against the per-datasource (or per-collector) bearer token stored in the `TOKEN` table. When the property is `true` the filter bean is constructed and inserted into the WebFlux filter chain; when the property is absent or any value other than the literal string `"true"` Spring Boot does **not** instantiate the bean, leaving `/ingestion/entities` reachable on the HTTP surface with the existing payload's `dataSourceOddrn` honoured but no credential ever inspected. Because no `matchIfMissing=true` attribute is present on the annotation AND `application.yml` line 48 explicitly sets `auth.ingestion.filter.enabled: false`, the default deployment ships with ingestion-token verification OFF.

## concepts

- entities: [IngestionDataEntitiesFilter (WebFilter), AbstractIngestionFilter (parent), TOKEN row (per-datasource or per-collector), DataSourceDto.token() / CollectorDto.tokenDto(), bearer token string]
- operations: [conditional-bean-registration, default-off-ingestion-auth, gate-token-verification-flow]
- invariants:
  - "Spring Boot `@ConditionalOnProperty` with `havingValue=\"true\"` and **no** `matchIfMissing=true` means the bean is registered ONLY when the property is present AND set to the literal string `\"true\"`. Missing property → bean not registered."
  - "`application.yml:46-48` explicitly sets `auth.ingestion.filter.enabled: false` — the bundled default ships with the filter OFF (verified: the YAML key exists, with value `false`, so even `matchIfMissing` would not matter here)."
  - "When the filter is NOT registered, `/ingestion/entities` is reachable per the SecurityWebFilterChain (every auth mode's `permittedPaths` includes `/ingestion/entities`, and `SecurityConstants.WHITELIST_PATHS` includes `/ingestion/**` for OAuth/LDAP) and the OpenAPI-generated `IngestionController.postDataEntityList` accepts any payload without a credential check."
  - "When the filter IS registered, the parent `AbstractIngestionFilter.resolveToken()` requires `Authorization: <bearer> <token>` header (case-insensitive `bearer ` prefix); missing/malformed header throws `AccessDeniedException(\"Token is missed\")` → 401 with the message as the response body."
  - "Token comparison is plaintext-equality (`String.equals`) against the live in-DB token value from the matched datasource — or, when the datasource has no associated token (`dto.token() == null`), against the parent collector's token from `collectorRepository.getDto(...)`. There is no hashing, no constant-time comparison, no expiry."
- audiences: [odd-collector and odd-collector-sdk processes (HTTP clients ingesting data entities), odd-platform operators choosing whether to demand ingestion authentication, security reviewers]

## dependencies_semantic

- requires-feature:
  - "AbstractIngestionFilter — parent class that does the WebFlux WebFilter plumbing (match-on-path, decorate-request-body, write 401 on AccessDeniedException) and exposes `resolveToken(...)` and `readBody(...)` to subclasses."
  - "ReactiveDataSourceRepository.getDtoByOddrn(...) — resolves the datasource-by-ODDRN-from-payload, returning a `DataSourceDto` whose `.token()` is either a `TokenDto` (datasource-owned token) or `null` (collector-owned token fallback)."
  - "ReactiveCollectorRepository.getDto(collectorId) — fallback path when the matched datasource has no own token; returns a `CollectorDto` whose `.tokenDto()` is the authoritative credential."
  - "IngestionController.postDataEntityList — the OpenAPI-generated controller method this filter wraps. The filter mutates the request via `ServerHttpRequestDecorator` so the controller still receives the original body bytes (the filter reads the body, validates the token, and re-emits the cached buffers via `flatMapIterable(ignored -> dataBuffer)`)."
- requires-config:
  - "`auth.ingestion.filter.enabled` — the literal property this annotation reads. Defaults to `false` in `application.yml:48`. Operators must explicitly set `true` to activate the filter."
  - "Per-datasource or per-collector `TOKEN` rows — without a token row matching the matched datasource's `(token_id)` foreign key (or the parent collector's), the filter cannot validate any inbound token; the request short-circuits to `NotFoundException(\"dataSource\", oddrn)` or `NotFoundException(\"collector\", id)` → propagates as a Spring error (not the filter's `AccessDeniedException` path, so this surfaces as a 5xx-class outcome via the default reactive error handler rather than a 401)."
- requires-runtime:
  - "Spring WebFlux (the filter implements `WebFilter` and operates on `ServerWebExchange` reactively)."
  - "Reactor Core (Mono / Flux composition for body buffering + token validation in flatMap)."
  - "Jackson ObjectMapper (parent's `readBody` uses `new ObjectMapper()` per instance to deserialise the buffered body into `DataEntityList`)."
- coupling:
  - "Filter path matcher is hard-coded — `new PathPatternParserServerWebExchangeMatcher(\"/ingestion/entities\", HttpMethod.POST)` on line 28 — and CANNOT be overridden via configuration. The constructor does not accept a path parameter, and no `@Value` injects one."
  - "Sibling ingestion endpoints — `POST /ingestion/datasources` (matched by `IngestionDataSourceFilter`), `POST /ingestion/alert/alertmanager` (matched by `AlertManagerController.alertManagerWebhook` with NO filter, NO `@PreAuthorize`, NO token check), `POST /ingestion/datasources/{id}/dataentities/statistics`, etc. (all on the controller, no per-endpoint ingestion filter coverage)."
  - "`IngestionDataSourceFilter` (sibling, `/ingestion/datasources` POST) is **NOT** gated by `@ConditionalOnProperty` — it is unconditionally registered. The two filters use the SAME `auth.ingestion.filter.enabled` mental model in operator-facing docs but only THIS filter respects the toggle. The data-source-registration filter is always on (when an `Authorization` header is present) and always off (when it isn't, since `resolveToken` throws `AccessDeniedException(\"Token is missed\")`)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Unit / integration test that `auth.ingestion.filter.enabled=false` (the default) results in `POST /ingestion/entities` accepting an unauthenticated request — i.e. a probe that the filter is genuinely OFF in the default profile."
  - "Unit / integration test that `auth.ingestion.filter.enabled=true` activates the filter (bean present in ApplicationContext, request without `Authorization` header returns 401 `Token is missed`)."
  - "Integration test of the bearer-token happy path: a `POST /ingestion/entities` with valid `Authorization: Bearer <correct-token>` against a known datasource-with-token returns 2xx; with a wrong token returns 401 `Token is not correct`."
  - "Integration test of the datasource-without-token fallback to collector: when the datasource has `token_id IS NULL`, the filter looks up the parent collector's token and validates against it."
  - "Integration test of the path-match exclusion: a request to `POST /ingestion/datasources` is NOT intercepted by `IngestionDataEntitiesFilter` (only by `IngestionDataSourceFilter`); a request to `POST /ingestion/alert/alertmanager` is NOT intercepted by either filter."
  - "Negative test for the `AccessDeniedException` → 401 response path: the parent `AbstractIngestionFilter.writeResponse` returns the exception message verbatim in the response body — a test confirms that on token-mismatch the body is the literal string `\"Token is not correct\"`."
- test_files:
  - "<odd-platform>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java — exercises the ingestion endpoints via WebTestClient but does NOT set `auth.ingestion.filter.enabled=true` (verified: `grep auth.ingestion.filter.enabled src/test` returns zero matches; the test profile inherits `application.yml`'s `false` default, so the filter bean is never registered during integration tests)."
- gaps: |
    The entire conditional registration path is untested. The test suite cannot distinguish
    a code change that (a) silently inverts the default-off stance, (b) removes the
    `@ConditionalOnProperty` annotation entirely and unconditionally registers the filter,
    (c) breaks the `havingValue="true"` literal match by accepting any truthy value, or
    (d) changes the parent's `Authorization: bearer ` prefix to a different scheme. A test
    profile that explicitly sets `auth.ingestion.filter.enabled=true` and asserts (i) 401
    on missing header, (ii) 401 on wrong token, (iii) 2xx on correct token would be
    high-leverage. Doubly so because the filter is the *only* defense for
    `POST /ingestion/entities` — every other security layer (SecurityWebFilterChain,
    SecurityConstants.SECURITY_RULES) explicitly excludes `/ingestion/**`.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The Authentication index page enumerates DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S as the five authentication modes. S2S is described as 'API-key authentication for server-to-server clients, complements any of the above' — but on WebFetch the page does NOT mention `auth.ingestion.filter.enabled`, `Authorization: Bearer` for ingestion, `IngestionDataEntitiesFilter`, or how `POST /ingestion/entities` is authenticated. This is the closest canonical page; the gap is a doc-drift finding."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
    anchor: ""
    rationale: "Dedicated S2S subpage. WebFetched 2026-05-10 (status 200) — describes `auth.s2s.enabled` + `auth.s2s.token` + the `X-API-Key` header used by `S2sAuthenticationFilter` (a SEPARATE class). This page does NOT document `auth.ingestion.filter.enabled` / `Authorization: Bearer` / `IngestionDataEntitiesFilter` — but is the page operators land on when they search 'ODD S2S authentication', conflating two distinct filters in the docs."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "No live ODD docs page documents `auth.ingestion.filter.enabled` — neither what it does, that it defaults to `false`, nor that the resulting default-off behaviour leaves `POST /ingestion/entities` reachable without a credential. WebFetched 2026-05-10 of `/configuration-and-deployment/enable-security/authentication` (status 200) returned excerpt: `1. Disabled authentication / 2. Login form / 3. OAUTH2/OIDC / 4. LDAP / 5. Server-to-server (S2S) — API-key authentication for server-to-server clients, complements any of the above`. The `auth.ingestion.filter.enabled` property does not appear in the response. This is the same default-off-data-loss class as LSN-001 (attachment-storage ephemeral default) — operators following the docs may run a production-shaped deployment with an unauthenticated ingestion endpoint."
  - "The docs CONFLATE two distinct S2S filters: (a) `S2sAuthenticationFilter` — global admin auth via `X-API-Key` header, controlled by `auth.s2s.enabled` + `auth.s2s.token`, applies to ALL paths, and (b) `IngestionDataEntitiesFilter` — per-datasource bearer-token auth via `Authorization: Bearer` header, controlled by `auth.ingestion.filter.enabled`, applies ONLY to `POST /ingestion/entities`. The S2S subpage WebFetched 2026-05-10 (status 200) describes (a) but appears under 'enable-security/authentication/s2s' in a way that operators would reasonably assume covers ingestion. The two filters use different header conventions (`X-API-Key` vs `Authorization: Bearer`), different scope (global vs path-matched), different config keys, and different token sources (a single shared `auth.s2s.token` string vs per-datasource/per-collector DB rows)."
  - "Sibling ingestion endpoints are not covered by any filter: `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) has NO `IngestionDataEntitiesFilter` coverage (path mismatch), NO `IngestionDataSourceFilter` coverage (path mismatch), NO `@PreAuthorize`, and is explicitly inside `SecurityConstants.WHITELIST_PATHS = /ingestion/**` so OAuth/LDAP do not protect it either. The docs do not enumerate which `/ingestion/*` endpoints are authenticated and which are not, so an operator enabling `auth.ingestion.filter.enabled=true` may believe the whole ingestion surface is protected when only `/ingestion/entities` is."

## implicit_adrs

- "Ingestion-token verification is OPT-IN via `auth.ingestion.filter.enabled` with no `matchIfMissing` and an explicit `false` default in `application.yml`" — evidence: IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty(value = \"auth.ingestion.filter.enabled\", havingValue = \"true\")` — note: no `matchIfMissing=true` attribute) + application.yml:46-48 (`auth: ingestion: filter: enabled: false`) — intent_anchor: the YAML default is the explicit literal `false`, NOT a commented-out placeholder. The maintainer wrote the default, knowing that `havingValue="true"` plus no-matchIfMissing already produces off-by-default semantics, and committed `false` explicitly anyway — that's a deliberate "we want operators to see and reason about this toggle" stance. The annotation form is consistent with how every other optional-feature toggle in the project is wired (compare `metrics.export.enabled`, `housekeeping.enabled`, `notifications.enabled`, `datacollaboration.enabled` — all in `application.yml` with explicit boolean defaults). — confidence: HIGH

- "Path matching for ingestion-token auth is hard-coded per-subclass, not registry-driven" — evidence: IngestionDataEntitiesFilter.java:28 (`super(new PathPatternParserServerWebExchangeMatcher(\"/ingestion/entities\", HttpMethod.POST))`) + IngestionDataSourceFilter.java:20 (`super(new PathPatternParserServerWebExchangeMatcher(\"/ingestion/datasources\", HttpMethod.POST))`) — intent_anchor: the parent class `AbstractIngestionFilter` accepts a `ServerWebExchangeMatcher` in its constructor (line 31), and each subclass HARD-CODES the path+method as a constant in its own constructor — there is no `@Value("${ingestion.filter.path:...}")` injection, no central path-registry like `SecurityConstants.SECURITY_RULES`. The pattern is "one filter class per ingestion path", consistently across the package. The naming convention (`IngestionDataEntitiesFilter` ↔ `/ingestion/entities`, `IngestionDataSourceFilter` ↔ `/ingestion/datasources`) makes the coupling discoverable by file name. — confidence: HIGH

- "Token authentication is plaintext-equality against the in-DB shared secret — no hashing layer, no constant-time comparison" — evidence: IngestionDataEntitiesFilter.java:56 (`if (!dto.tokenPojo().getValue().equals(token))`) — intent_anchor: the comparison is `String.equals(...)`, NOT `BCrypt.matches(...)`, NOT `MessageDigest.isEqual(...)`, NOT HMAC verification. This is consistent with the rest of the token model — the sibling `CollectorController.regenerateCollectorToken` sidecar already established that tokens are stored as raw `RandomStringUtils.randomAlphanumeric(40)` plaintext in the TOKEN table (`TokenGeneratorImpl.java:39,49` + `ReactiveTokenRepositoryImpl.java:30-39`). The implementation choice carries across the rotate-side AND the verify-side: shared-secret semantics, not hashed-credential semantics. — confidence: HIGH

- "Subclasses with conditional registration (`IngestionDataEntitiesFilter`) and subclasses with unconditional registration (`IngestionDataSourceFilter`) coexist for `AbstractIngestionFilter`" — evidence: IngestionDataEntitiesFilter.java:19-20 (`@Component` + `@ConditionalOnProperty(... havingValue=\"true\")`) vs IngestionDataSourceFilter.java:15 (`@Component` alone, no conditional) — intent_anchor: the `auth.ingestion.filter.enabled` toggle ONLY suppresses the per-datasource data-entity filter; the collector-token-required filter on `POST /ingestion/datasources` is always on. The implicit decision is: "you must always be a known collector to register a datasource, but you may or may not be a token-bearing collector to ingest data entities." This is consistent with the bootstrap order — a collector first registers itself + its datasources (requires the collector's own token from the start), then ingests data (which the operator opts into authenticating later). — confidence: MEDIUM (the intent is inferable from the structure; no comment explicitly states it)

## bugs_limitations_corner_cases

- "Default deployment ships with `POST /ingestion/entities` UNAUTHENTICATED. `application.yml:48` sets `auth.ingestion.filter.enabled: false` and the docs (WebFetched 2026-05-10) do not surface this property. Combined with `SecurityConstants.WHITELIST_PATHS` including `/ingestion/**` and every security config's `permittedPaths` (or whitelist) including `/ingestion/entities` (LoginFormSecurityConfiguration.java:50), the result is: any caller able to reach the platform's HTTP port can `POST /ingestion/entities` with a valid `DataEntityList` payload and have entities ingested. This is the same shape as LSN-001 (attachment-storage ephemeral default) — a critical-severity default that the docs do not warn about. Severity rating reflects the data-integrity exposure (an attacker can plant arbitrary data entities visible to all platform users); auth.type=DISABLED + filter-disabled compounds it." — evidence: IngestionDataEntitiesFilter.java:20 (`havingValue=\"true\"`, no matchIfMissing) + application.yml:46-48 (`auth.ingestion.filter.enabled: false`) + LoginFormSecurityConfiguration.java:50 (`permittedPaths` includes `/ingestion/entities`) + SecurityConstants.java:95-96 (`WHITELIST_PATHS` includes `/ingestion/**` — enforced by `AuthorizationCustomizer.java:22` for OAUTH2/LDAP modes) — severity: HIGH

- "`AbstractIngestionFilter.resolveToken` (line 47) does NOT use `String.equalsIgnoreCase` for the `bearer ` prefix check; it lowercases the entire token plus prefix via `bearerToken.toLowerCase().startsWith(BEARER)` then substrings on the ORIGINAL `bearerToken` for the suffix. This is intentional and correct, but a maintainer reading the code may misread it. Not a bug — flagged so a future refactor doesn't 'simplify' it incorrectly." — evidence: AbstractIngestionFilter.java:47-50 — severity: LOW

- "Token comparison is `.equals(...)` (line 56), not `MessageDigest.isEqual(...)` — vulnerable to timing-based token discovery on a local network where an attacker can measure response time differences. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle is violated." — evidence: IngestionDataEntitiesFilter.java:56 — severity: MEDIUM

- "Path matcher is hard-coded to `/ingestion/entities` exact (no `/**` suffix); a future addition of `POST /ingestion/entities/batch` or `POST /ingestion/entities/v2` would bypass the filter silently with no compile-time signal. There is no test, no comment, no @docs annotation pinning the path." — evidence: IngestionDataEntitiesFilter.java:28 (literal string `\"/ingestion/entities\"`) — severity: MEDIUM (future-regression risk)

- "When the matched datasource has `token() == null` AND the parent collector's `getDto(...)` returns empty, the filter throws `NotFoundException(\"collector\", id)` (line 50-51) instead of `AccessDeniedException`. Parent class only catches `AccessDeniedException` to write a 401 response (AbstractIngestionFilter.java:40); other exceptions propagate to the default reactive error handler and surface as 500 Internal Server Error. An operator hitting a half-configured collector record receives a misleading status code (5xx vs 4xx)." — evidence: IngestionDataEntitiesFilter.java:50-51 + AbstractIngestionFilter.java:40 — severity: LOW

- "Filter reads the FULL request body into memory via `super.getBody().collectList()` (parent's `getRequestDecorator` is overridden; this version uses `collectList()` on line 38 → `readBody(dataBuffer, DataEntityList.class)` on line 40, materialising the entire byte stream before validation). For a 20 MB `DataEntityList` payload (the platform-wide `spring.codec.max-in-memory-size` cap per `application.yml:15`), each `POST /ingestion/entities` request holds 20 MB in heap during validation, multiplied by concurrent requests. No streaming validation path exists." — evidence: IngestionDataEntitiesFilter.java:37-40 + AbstractIngestionFilter.java:53-64 (readBody buffers everything) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) — severity: MEDIUM (capacity-planning gap, not a security bug)

- "Sibling endpoint `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) has NO ingestion-filter coverage and NO `@PreAuthorize`. It is on `WHITELIST_PATHS` (`/ingestion/**`) and on every auth mode's permitted-paths. An attacker reaching the platform can POST arbitrary external-alert payloads. `auth.ingestion.filter.enabled=true` does NOT protect this endpoint — the property name suggests 'ingestion is locked down' but the toggle covers only one of the `/ingestion/*` endpoints." — evidence: AlertManagerController.java:21 (`@PostMapping(path = \"ingestion/alert/alertmanager\")`, no `@PreAuthorize`) + IngestionDataEntitiesFilter.java:28 (matcher only `/ingestion/entities`) + IngestionDataSourceFilter.java:20 (matcher only `/ingestion/datasources`) — severity: HIGH

- "No log statement on the 401 path. When a token mismatch occurs, the platform writes 401 with the message verbatim (`\"Token is not correct\"` or `\"Token is missed\"`) but does NOT log the attempt. A security incident review of 'how many failed-auth attempts in the last hour against the ingestion endpoint' cannot be answered from application logs. There is no rate-limit / lockout / metric counter on the failure path." — evidence: IngestionDataEntitiesFilter.java:55-58 (throw, no log) + AbstractIngestionFilter.java:66-72 (writeResponse, no log) — severity: MEDIUM

## security

- **auth_mode_relevance**: `S2S` — but specifically the **per-datasource bearer-token** S2S model, NOT the global `auth.s2s.enabled` + `X-API-Key` model. The two coexist in the codebase (`IngestionDataEntitiesFilter` here vs `S2sAuthenticationFilter` in the same package) and use different config keys, different HTTP headers, and different token-storage strategies. For the other auth modes (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`), this filter operates ORTHOGONALLY: every security config explicitly permits `/ingestion/entities` (`LoginFormSecurityConfiguration.java:50` puts it in `permittedPaths`; `SecurityConstants.WHITELIST_PATHS` puts `/ingestion/**` in the OAUTH2/LDAP whitelist via `AuthorizationCustomizer.java:22`), so authentication on this endpoint is EXCLUSIVELY this filter's responsibility — regardless of `auth.type`. When `auth.ingestion.filter.enabled=false`, `/ingestion/entities` is unauthenticated under ALL four UI auth modes.
- **ingestion_filter_relevance**: `YES — this IS the filter`. The node is the `@ConditionalOnProperty` annotation that determines whether the canonical ingestion auth filter is registered as a Spring bean. The path-matcher is `POST /ingestion/entities` (line 28). Sibling `/ingestion/datasources` is covered by `IngestionDataSourceFilter` (unconditional). Sibling `/ingestion/alert/alertmanager` is covered by NO filter.
- **authorization_assertions**:
  - "Filter bean registration gated by `@ConditionalOnProperty(value=\"auth.ingestion.filter.enabled\", havingValue=\"true\")`" — evidence: IngestionDataEntitiesFilter.java:20
  - "Per-request: `Authorization: Bearer <token>` header required when filter is active; token compared via `String.equals` to the matched datasource's TOKEN row (or fallback to parent collector's TOKEN row when datasource.token() is null)" — evidence: IngestionDataEntitiesFilter.java:41 (`resolveToken`) + AbstractIngestionFilter.java:45-51 + IngestionDataEntitiesFilter.java:46-58 (token resolution + .equals check)
  - "No SecurityRule entry — `SecurityConstants.SECURITY_RULES` does not contain `/ingestion/entities`; the ingestion-token check is filter-based, not Permission-based" — evidence: SecurityConstants.java:98-355 (no matcher for `/ingestion/entities`) + AbstractIngestionFilter.java:34-41 (WebFilter, not Permission gate)
- **owner_scoping**: `N/A — ingestion path is not owner-scoped`. The filter authenticates the *caller* (a collector / datasource via shared-secret token) but does not associate the request with an Owner. Ingested DataEntity rows are not stamped with `created_by_owner` based on the calling collector; ownership is established later via the platform's UI / API flows. Token = identity-of-collector, not identity-of-user.
- **data_exposure**:
  - "When `auth.ingestion.filter.enabled=false` (the default): ANY caller able to reach `POST /ingestion/entities` can submit a DataEntityList payload referencing any `dataSourceOddrn`. The ingested entities become visible to ALL authenticated platform users (and to anonymous users if `auth.type=DISABLED`)."
  - "When `auth.ingestion.filter.enabled=true`: callers possessing a valid bearer token for ANY datasource can submit DataEntityList payloads for THAT datasource. No per-entity ACL enforced at this layer."
  - "401 response body contains the `AccessDeniedException` message verbatim (`\"Token is missed\"` or `\"Token is not correct\"`) — useful diagnostic, also a signal-of-deployment-mode to an attacker probing the endpoint."
- **known_security_gaps**:
  - "Default-off ingestion auth — `application.yml:48` sets `auth.ingestion.filter.enabled: false`; `IngestionDataEntitiesFilter.java:20` annotation has no `matchIfMissing=true`. A bundled deployment that the operator runs unmodified has `POST /ingestion/entities` reachable without any credential check. The docs site (WebFetched 2026-05-10) does not mention this property." — evidence: IngestionDataEntitiesFilter.java:20 + application.yml:46-48 — severity: HIGH
  - "Plaintext-equality token comparison — `String.equals(...)` is not constant-time. Timing-based discovery on a low-latency network is theoretically feasible against a 40-char shared secret stored as plaintext in the DB. The sibling `S2sAuthenticationFilter` has the same issue (`s2sTokenProvider.isValidToken(...)` against a YAML-configured `auth.s2s.token`)." — evidence: IngestionDataEntitiesFilter.java:56 — severity: MEDIUM
  - "Failed-auth attempts not logged — no `@Slf4j` log call in the filter or its parent on either `\"Token is missed\"` or `\"Token is not correct\"` paths. A security incident review of 'attacker probed ingestion endpoint with N invalid tokens' cannot be answered from application logs; no metric counter exists either." — evidence: IngestionDataEntitiesFilter.java:55-58 (no log) + AbstractIngestionFilter.java:34-41 (no log on filter-match path) + AbstractIngestionFilter.java:66-72 (writeResponse, no log) — severity: MEDIUM
  - "Filter coverage is endpoint-by-endpoint, not feature-by-feature: `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) is NOT covered by any filter and has no `@PreAuthorize`. The property name `auth.ingestion.filter.enabled` reads as if it locks down 'ingestion' globally, but it locks down only `/ingestion/entities`." — evidence: AlertManagerController.java:21 + IngestionDataEntitiesFilter.java:28 (path matcher: `/ingestion/entities` only) — severity: HIGH
  - "Filter requires the FULL request body in memory before any auth check (it reads the body to extract `dataSourceOddrn` before validating the token). An attacker submitting maximum-size 20 MB payloads with invalid tokens forces the platform to buffer those payloads in heap before rejecting them — a low-effort heap-pressure DoS vector. The auth check could plausibly be reordered to validate the token first (against `Authorization` header) then read the body, but that would require knowing the dataSourceOddrn before the body parse. As written, the order is: read body → resolve datasource → resolve token → compare token → admit." — evidence: IngestionDataEntitiesFilter.java:37-60 (body-first ordering) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) — severity: MEDIUM

## performance

- **hot_paths**:
  - "Conditional bean registration runs ONCE at Spring context startup — no per-request cost from the annotation itself." — evidence: IngestionDataEntitiesFilter.java:20 (class-level annotation)
  - "When the filter IS registered, every `POST /ingestion/entities` request incurs: 1 buffer-collect of full body (reactive `collectList()`), 1 Jackson deserialisation to `DataEntityList` (the data side does this AGAIN downstream in the controller, so this is a duplicate parse on the auth path), 1 DB SELECT for the datasource (`ReactiveDataSourceRepository.getDtoByOddrn`), and IF the datasource has no token, 1 additional DB SELECT for the collector. So 2-3 round-trips total per ingestion request on the happy path." — evidence: IngestionDataEntitiesFilter.java:37-60
- **throughput_characteristics**:
  - "Reactive `Flux<DataBuffer>` signature — non-blocking but each request still buffers the entire body via `collectList()` before token validation. No streaming validation path."
  - "Body is parsed TWICE: once by the filter (`readBody` deserialises to `DataEntityList` for the `getDataSourceOddrn` extraction) and again by the controller's `Mono<DataEntityList>` binding. The 2x parse + 1x serialise-back-to-bytes (via `flatMapIterable(ignored -> dataBuffer)`) is per-request overhead." — evidence: IngestionDataEntitiesFilter.java:40 (readBody) + IngestionController.java:38 (Mono<DataEntityList> deserialises again)
- **resource_allocation**:
  - "Full request body held in memory (up to `spring.codec.max-in-memory-size: 20MB` per `application.yml:15`) for the duration of: body collect → readBody parse → datasource resolve → token compare. Garbage-collected after `flatMapIterable` re-emits the cached buffers." — evidence: IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15
  - "`new ObjectMapper()` is constructed PER `AbstractIngestionFilter` instance (parent class line 32 — instance field, not static). With Spring instantiating each subclass as a singleton, two ObjectMappers exist (one per concrete filter). Minor — Jackson `ObjectMapper` is documented as thread-safe-after-configuration, so a static shared instance would be cheaper. Not a hot-path bug." — evidence: AbstractIngestionFilter.java:32 (`private final ObjectMapper mapper = new ObjectMapper();`)
- **scaling_characteristics**:
  - "Filter is stateless — instances scale horizontally. No locks, no shared mutable state, no advisory locks." — evidence: IngestionDataEntitiesFilter.java:21-32 (stateless `@Component`, only final injected dependencies)
  - "Conditional registration means horizontal-scale clusters can ALL run with the filter disabled (default) and the deployment-wide stance is consistent. An operator changing `auth.ingestion.filter.enabled` requires a restart (Spring `@ConditionalOnProperty` is resolved at bean-graph time)." — evidence: IngestionDataEntitiesFilter.java:20 + Spring Boot ConditionalOnProperty semantics (static at startup)
- **known_performance_gaps**:
  - "Duplicate body parse — the filter materialises `DataEntityList` from bytes purely to extract `dataSourceOddrn`, then re-emits the original buffers for the controller to deserialise the same payload AGAIN. A per-request `O(payload-size)` Jackson parse on a high-throughput ingestion path is non-trivial. A `JsonPath`-style streaming extraction of just the `dataSourceOddrn` field would avoid the duplicate parse." — evidence: IngestionDataEntitiesFilter.java:40 (full deserialise) + IngestionController.java:38-44 (controller re-parses) — severity: MEDIUM
  - "Body-buffered-before-auth — an attacker submitting maximum-size 20 MB payloads with invalid tokens forces the platform to buffer + parse the body before rejecting. Auth-first ordering would shed bad traffic earlier." — evidence: IngestionDataEntitiesFilter.java:37-60 — severity: LOW (perf) / MEDIUM (security — see known_security_gaps)
  - "No connection / token-cache — every ingestion request re-fetches the datasource (and possibly the collector) from the DB. A short-TTL token cache (e.g. Caffeine, keyed by `dataSourceOddrn`) would eliminate the per-request DB hits on a steady-state ingestion stream. The price would be a cache-invalidation requirement on `regenerateCollectorToken` / `regenerateDatasourceToken`." — evidence: IngestionDataEntitiesFilter.java:43-54 (no caching) + sibling-sidecar (CollectorController.regenerateCollectorToken — no invalidation hook) — severity: MEDIUM

## sources

- understanding ← IngestionDataEntitiesFilter.java:19-65 + application.yml:46-48 + AbstractIngestionFilter.java:34-72
- concepts.invariants[0] ← IngestionDataEntitiesFilter.java:20 (annotation form: `havingValue="true"`, no `matchIfMissing` attribute) + Spring Boot `@ConditionalOnProperty` Javadoc semantics
- concepts.invariants[1] ← application.yml:46-48 (`auth: \\ ingestion: \\ filter: \\ enabled: false`)
- concepts.invariants[2] ← LoginFormSecurityConfiguration.java:49-50 (`permittedPaths` includes `/ingestion/entities` + `/ingestion/datasources`) + SecurityConstants.java:95-96 (`WHITELIST_PATHS` includes `/ingestion/**`) + AuthorizationCustomizer.java:22 (`.pathMatchers(SecurityConstants.WHITELIST_PATHS)`)
- concepts.invariants[3] ← AbstractIngestionFilter.java:45-51 (`resolveToken`: requires `Authorization` header with `bearer ` prefix)
- concepts.invariants[4] ← IngestionDataEntitiesFilter.java:46-58 (`.equals(...)` comparison + null-fallback to collector)
- dependencies_semantic.requires-feature ← AbstractIngestionFilter.java:28-72 (parent) + ReactiveDataSourceRepositoryImpl.java:85-93 (`getDtoByOddrn`) + DataSourceDto.java:6 (`record DataSourceDto(... TokenDto token)`) + CollectorDto.java:6 + ReactiveCollectorRepositoryImpl.java:13-20
- dependencies_semantic.requires-config ← IngestionDataEntitiesFilter.java:20 (annotation) + application.yml:46-48 (default false)
- dependencies_semantic.coupling[0] ← IngestionDataEntitiesFilter.java:28 (hard-coded path matcher)
- dependencies_semantic.coupling[1-2] ← AlertManagerController.java:21 + IngestionDataSourceFilter.java:15-20 (no `@ConditionalOnProperty`)
- tests_coverage_semantic.test_files ← grep `auth.ingestion.filter.enabled` against <odd-platform>/odd-platform-api/src/test returned zero matches (BaseIngestionTest.java exists but does not set the property; test profile inherits `application.yml`'s `false` default)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-10T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (status 200) — excerpt: "1. Disabled authentication / 2. Login form / 3. OAUTH2/OIDC / 4. LDAP / 5. Server-to-server (S2S) — API-key authentication for server-to-server clients, complements any of the above"
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-10T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s (status 200) — excerpt: describes `auth.s2s.enabled` + `auth.s2s.token` + `X-API-Key` header for `S2sAuthenticationFilter` (different filter; no mention of `auth.ingestion.filter.enabled` or `Authorization: Bearer` for ingestion)
- docs_link_semantic.doc_drift_findings ← (a) absence of `auth.ingestion.filter.enabled` on the live authentication page; (b) S2S conflation (S2sAuthenticationFilter docs vs. IngestionDataEntitiesFilter behaviour); (c) AlertManagerController.java:21 unprotected sibling endpoint
- implicit_adrs[0] ← IngestionDataEntitiesFilter.java:20 (no matchIfMissing) + application.yml:46-48 (explicit false) — pattern consistent with metrics/notifications/datacollaboration toggles
- implicit_adrs[1] ← IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20 + AbstractIngestionFilter.java:31 (matcher in constructor)
- implicit_adrs[2] ← IngestionDataEntitiesFilter.java:56 (plain `.equals`) + sibling sidecar (`CollectorController__regenerateCollectorToken`) implicit-ADR[3] establishing the shared-secret-stored-plaintext stance
- implicit_adrs[3] ← IngestionDataEntitiesFilter.java:19-20 (conditional) vs IngestionDataSourceFilter.java:15 (unconditional) — annotation-level evidence
- bugs_limitations_corner_cases[0] ← IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + LoginFormSecurityConfiguration.java:50 + SecurityConstants.java:95-96
- bugs_limitations_corner_cases[1] ← AbstractIngestionFilter.java:47 (`bearerToken.toLowerCase().startsWith(BEARER)`) + line 50 (substring on original)
- bugs_limitations_corner_cases[2] ← IngestionDataEntitiesFilter.java:56 (`.equals` not `MessageDigest.isEqual`)
- bugs_limitations_corner_cases[3] ← IngestionDataEntitiesFilter.java:28 (literal `"/ingestion/entities"` — no wildcard)
- bugs_limitations_corner_cases[4] ← IngestionDataEntitiesFilter.java:50-51 (NotFoundException, not AccessDeniedException) + AbstractIngestionFilter.java:40 (only catches AccessDeniedException)
- bugs_limitations_corner_cases[5] ← IngestionDataEntitiesFilter.java:37-40 + AbstractIngestionFilter.java:53-64 + application.yml:14-15
- bugs_limitations_corner_cases[6] ← AlertManagerController.java:21 + IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20
- bugs_limitations_corner_cases[7] ← IngestionDataEntitiesFilter.java:55-58 (no log) + AbstractIngestionFilter.java:66-72 (writeResponse — no log)
- security.auth_mode_relevance ← IngestionDataEntitiesFilter.java:20 + LoginFormSecurityConfiguration.java:50 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + S2sAuthenticationFilter.java:17-48 (sibling filter, separate config)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (the path matcher constitutes "this IS the filter")
- security.authorization_assertions ← IngestionDataEntitiesFilter.java:20 + 41-58 + AbstractIngestionFilter.java:45-51 + SecurityConstants.java:98-355 (no rule entry for /ingestion/entities)
- security.data_exposure ← application.yml:48 (false default) + LoginFormSecurityConfiguration.java:50 (permitted) + AbstractIngestionFilter.java:66-72 (verbatim error in body)
- security.known_security_gaps[0] ← IngestionDataEntitiesFilter.java:20 + application.yml:46-48
- security.known_security_gaps[1] ← IngestionDataEntitiesFilter.java:56
- security.known_security_gaps[2] ← IngestionDataEntitiesFilter.java:55-58 + AbstractIngestionFilter.java:34-41,66-72
- security.known_security_gaps[3] ← AlertManagerController.java:21 + IngestionDataEntitiesFilter.java:28
- security.known_security_gaps[4] ← IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15
- performance.hot_paths ← IngestionDataEntitiesFilter.java:37-60
- performance.throughput_characteristics ← IngestionDataEntitiesFilter.java:40 + IngestionController.java:38
- performance.resource_allocation ← IngestionDataEntitiesFilter.java:37-60 + AbstractIngestionFilter.java:32 + application.yml:14-15
- performance.scaling_characteristics ← IngestionDataEntitiesFilter.java:21-32 (stateless)
- performance.known_performance_gaps[0] ← IngestionDataEntitiesFilter.java:40 + IngestionController.java:38-44
- performance.known_performance_gaps[1] ← IngestionDataEntitiesFilter.java:37-60
- performance.known_performance_gaps[2] ← IngestionDataEntitiesFilter.java:43-54 (no cache)

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


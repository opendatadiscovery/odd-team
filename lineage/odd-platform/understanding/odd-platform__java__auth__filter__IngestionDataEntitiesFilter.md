---
node_id: "odd-platform java auth filter:IngestionDataEntitiesFilter"
node_kind: filter
axis: filters
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-batch-O
related_features:
  - F-008
related_pillar_features:
  - P-10:F-001
related_refactoring_scopes:
  - REFACTOR-185
  - REFACTOR-073
related_concepts:
  - ingestion-authentication-filter
  - shared-secret-tokens-stored-plaintext
  - default-off-ingestion-auth
  - ingestion-filter-path-coverage-incomplete
related_retrospectives:
  - LSN-001
  - LSN-017
coherence_check:
  performed: true
  strengthens:
    - "REFACTOR-185 (15-sidecar) — adds the filter-class-level evidence that PATH MATCHING is the gating mechanism; the filter does NOT consult `auth.type`, so when DISABLED bypasses the SecurityWebFilterChain entirely the filter still runs IF registered, but when the filter is NOT registered (default + DISABLED) there is zero check on the ingestion endpoint."
    - "F-008 (P-10:F-001 Batch Ingestion — `default_off_unauthenticated_ingestion_at_filter_layer` drift facet) — confirms the filter-LAYER mechanism: the filter binds via `@Component + @ConditionalOnProperty(havingValue=\"true\")` with no `matchIfMissing`. With `application.yml:48` shipping `false`, the bean is not registered, and the path-match-only ServerWebExchangeMatcher means the FilterChain never sees an auth requirement."
    - "Existing sidecar `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md` (config-key-consumer axis) — that sidecar covers the ANNOTATION layer; this new sidecar covers the FILTER CLASS layer (path-matching, body-buffering, token-resolution, exception flow). Both are correct and complementary; no contradiction."
  supersedes: []
  conflicts_surfaced: []
  back_links_emitted_to:
    - F-008
    - REFACTOR-185
    - REFACTOR-073
    - LSN-001
    - LSN-017
---

# IngestionDataEntitiesFilter — semantic understanding

## understanding

`IngestionDataEntitiesFilter` is the WebFlux `WebFilter` that authenticates `POST /ingestion/entities` against a per-datasource (or per-collector fallback) bearer token by reading the request body to extract the payload's `dataSourceOddrn`, resolving the DB-stored token for that datasource, and `String.equals`-comparing it to the `Authorization: Bearer <token>` header before allowing the request to reach `IngestionController.postDataEntityList`. It is conditionally registered via class-level `@ConditionalOnProperty("auth.ingestion.filter.enabled", havingValue="true")` with **no `matchIfMissing`** — combined with `application.yml:48` shipping the explicit literal `false`, the bundled deployment NEVER registers this bean and `POST /ingestion/entities` is reachable without any credential check across all four UI auth modes (DISABLED/LOGIN_FORM/OAUTH2/LDAP), because every UI security configuration explicitly permits `/ingestion/entities` (LoginFormSecurityConfiguration whitelists it; OAUTH2/LDAP route through `SecurityConstants.WHITELIST_PATHS` which contains `/ingestion/**`). The filter's path-matcher is hard-coded to the **exact** literal `/ingestion/entities` (line 28) — sibling `POST /ingestion/datasources` is handled by a different filter class (`IngestionDataSourceFilter`, unconditional); sibling `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) is handled by NO filter at all.

## concepts

- entities: [IngestionDataEntitiesFilter (WebFilter subclass), AbstractIngestionFilter (parent), ServerWebExchange, ServerHttpRequestDecorator, DataEntityList (the buffered + parsed body), DataSourceDto, CollectorDto, TokenDto.tokenPojo().getValue() (the raw plaintext shared secret), Authorization Bearer header, ReactiveDataSourceRepository, ReactiveCollectorRepository]
- operations: [path-match-on-POST-/ingestion/entities, buffer-full-body-into-list, parse-body-as-DataEntityList, extract-dataSourceOddrn-from-body, resolve-datasource-token-from-DB, fallback-to-collector-token-if-datasource-token-null, plaintext-equality-compare-against-bearer-header, throw-AccessDeniedException-on-mismatch, re-emit-buffered-body-to-controller]
- invariants:
  - "Filter is registered ONLY when `auth.ingestion.filter.enabled=true` literally (`havingValue=\"true\"`, no `matchIfMissing` attribute). `application.yml:46-48` ships the explicit literal `false`, so the bundled deployment does not register the bean."
  - "Path matcher is constructed from a HARD-CODED literal string `\"/ingestion/entities\"` + `HttpMethod.POST` (line 28). The constructor does not accept a path; no `@Value` or property injects one. A new endpoint `POST /ingestion/entities/batch` or `POST /ingestion/entities/v2` would NOT be matched and would bypass the filter silently."
  - "Token lookup precedence: (1) if the matched datasource's `dto.token() != null`, that is the credential; (2) ELSE the platform looks up the parent collector via `collectorRepository.getDto(dto.dataSource().getCollectorId())` and uses `CollectorDto.tokenDto()`. There is no third tier; an empty parent-collector lookup throws `NotFoundException` (not `AccessDeniedException`)."
  - "Token comparison at line 56 is `dto.tokenPojo().getValue().equals(token)` — plaintext `String.equals`, NOT `MessageDigest.isEqual` (not constant-time) and NOT a hash comparison (the token is stored in the `TOKEN` table in plaintext per `RandomStringUtils.randomAlphanumeric(40)` generation)."
  - "Body buffering precedes auth: `super.getBody().collectList()` (line 38) materialises the entire byte stream BEFORE the token check; the body is then `readBody`-parsed to `DataEntityList` to extract `dataSourceOddrn`. An attacker submitting maximum-size 20MB invalid-token requests forces the platform to buffer + parse before rejecting."
  - "Body is parsed TWICE: the filter parses to extract `dataSourceOddrn`; the controller re-parses the same payload to a `Mono<DataEntityList>`. The filter cannot avoid the duplicate parse because the buffered DataBuffers are re-emitted unchanged via `flatMapIterable(ignored -> dataBuffer)` at line 60."
  - "Only `AccessDeniedException` is caught by `AbstractIngestionFilter.filter` and converted to 401 (line 40). `NotFoundException` (thrown when the payload's dataSourceOddrn is unknown OR the fallback collector lookup is empty) propagates to the default reactive error handler and surfaces as 5xx — a misleading status for a credential resolution failure."
- audiences: [odd-collector and odd-collector-sdk processes (HTTP clients ingesting data entities under filter-enabled deployments), odd-platform operators choosing whether to harden ingestion, security reviewers, odd-tracing-gateway and other push adapters submitting `POST /ingestion/entities`]

## dependencies_semantic

- requires-feature:
  - "AbstractIngestionFilter (sibling file: AbstractIngestionFilter.java:28-72) — provides the WebFlux WebFilter contract, the `matcher.matches(exchange)` short-circuit pattern, the `resolveToken(...)` Authorization-header parser, the `readBody(...)` Jackson deserialiser, and the `writeResponse(...)` 401 emitter."
  - "ReactiveDataSourceRepository.getDtoByOddrn(...) — payload-driven datasource resolution. The filter trusts the body's `dataSourceOddrn` value to identify the source; there is no caller-identity-based scoping."
  - "ReactiveCollectorRepository.getDto(collectorId) — fallback path when datasource has `token() == null`."
  - "IngestionController.postDataEntityList (IngestionController.java:38-45) — the OpenAPI-generated controller method this filter gates. The filter mutates the exchange via `ServerHttpRequestDecorator` so the controller still receives the original body bytes (re-emitted from the cached buffer)."
  - "IngestionService.ingest (the downstream destination of any request that passes the filter) — the single-transaction-per-batch entry point; the filter is the ONLY non-controller defence against arbitrary writes (F-008 destruction surface)."
- requires-config:
  - "`auth.ingestion.filter.enabled` (literal, class-level `@ConditionalOnProperty` annotation at line 20). Defaults to `false` in `application.yml:48`. No `matchIfMissing=true` — a missing OR-false-OR-any-non-\"true\" value suppresses bean registration."
  - "Per-datasource `TOKEN` rows in the `TOKEN` table (referenced via `data_source.token_id` FK) OR per-collector `TOKEN` rows (`collector.token_id` FK). Without either, the filter cannot validate the request and emits `NotFoundException` (NOT `AccessDeniedException`) — surfacing as 5xx not 401."
- requires-runtime:
  - "Spring WebFlux + Reactor Core — reactive Mono/Flux composition; the filter is a `WebFilter`, the request body is consumed reactively via `collectList()` + `flatMapMany`."
  - "Jackson ObjectMapper — parent class instantiates `new ObjectMapper()` per filter instance (AbstractIngestionFilter.java:32) for `DataEntityList` deserialisation."
  - "Spring Boot `@ConditionalOnProperty` resolution at context startup — the toggle is not hot-reloadable; an operator changing `auth.ingestion.filter.enabled` requires a process restart."
- coupling:
  - "Path coverage is incomplete by design — only `/ingestion/entities` POST is matched. `/ingestion/datasources` POST is covered by sibling `IngestionDataSourceFilter` (unconditional). `/ingestion/alert/alertmanager` POST (`AlertManagerController.java:21`) has NO filter coverage and NO `@PreAuthorize`. `POST /ingestion/datasources/{id}/dataentities/statistics` and similar nested endpoints on IngestionController have NO ingestion-filter coverage."
  - "The single `auth.ingestion.filter.enabled` toggle gates ONLY this filter (per-datasource bearer token on `/ingestion/entities`). It does NOT gate the sibling `IngestionDataSourceFilter` (which is always-on when an Authorization header is present); it does NOT gate the `AlertManagerController` webhook. The property name reads as if it locks down all ingestion globally, but its coverage is one endpoint."
  - "Filter is ORTHOGONAL to the four UI auth modes. Every UI security config explicitly permits `/ingestion/entities`: LoginFormSecurityConfiguration.java:49-50 (`permittedPaths` includes the literal path); OAUTH2/LDAP route through `AuthorizationCustomizer.java:22` (`pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()`) and `SecurityConstants.WHITELIST_PATHS` (line 96) contains `/ingestion/**` (wildcard, broader than LOGIN_FORM's exact-path list). Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration.java:13-18` calls `.anyExchange().permitAll()` so the SecurityWebFilterChain is a no-op for everything — including ingestion. In ALL four modes, ingestion authentication is EXCLUSIVELY this filter's responsibility, AND this filter is OFF by default."
  - "S2S filter (`S2sAuthenticationFilter`, sibling class) provides a SEPARATE auth path (`X-API-Key` header → ADMIN identity) that, when `auth.s2s.enabled=true`, runs BEFORE the SecurityWebFilterChain's authorize step. A request carrying a valid S2S `X-API-Key` reaches `POST /ingestion/entities` regardless of this filter's state. The S2S doc page (live, WebFetched 2026-05-19) recommends combining S2S with `auth.ingestion.filter.enabled=true` — a defense-in-depth pairing the platform does not enforce."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Filter-OFF default behaviour — assert that with bundled defaults (`auth.ingestion.filter.enabled` absent or false), the bean is NOT registered (e.g. `ApplicationContext.getBean(IngestionDataEntitiesFilter.class)` throws `NoSuchBeanDefinitionException`)."
  - "Filter-ON happy path — with `auth.ingestion.filter.enabled=true` and a valid bearer token matching a known datasource's TOKEN row, `POST /ingestion/entities` returns 2xx."
  - "Filter-ON wrong-token — returns 401 with the verbatim body `\"Token is not correct\"`."
  - "Filter-ON missing-Authorization-header — returns 401 with the verbatim body `\"Token is missed\"`."
  - "Filter-ON malformed-Authorization-header (no `Bearer ` prefix) — returns 401 with `\"Token is missed\"`."
  - "Filter-ON datasource-without-token fallback — datasource has `token_id IS NULL`; filter looks up the parent collector's token; correct-token request returns 2xx; wrong-token request returns 401."
  - "Filter-ON unknown-datasource-oddrn — filter throws `NotFoundException(\"dataSource\", oddrn)` which surfaces as 5xx (NOT 401). This misleading status code should be pinned by a test to either confirm it as intended OR motivate a fix."
  - "Filter-ON path-match-exclusion — `POST /ingestion/datasources`, `POST /ingestion/alert/alertmanager`, `POST /ingestion/datasources/{id}/dataentities/statistics` are NOT intercepted by this filter (the matcher is exact-literal `/ingestion/entities`)."
  - "Filter ordering versus `S2sAuthenticationFilter` — under `auth.s2s.enabled=true` + `auth.ingestion.filter.enabled=true`, request with valid `X-API-Key` and no `Authorization: Bearer` header should reach the controller (S2S grants ADMIN identity, which the ingestion filter sees as a populated SecurityContext that does NOT satisfy its own check). This ordering behaviour is undocumented."
  - "Auth-failure observability — verify that a failed-token attempt is logged (currently it is NOT; both `\"Token is missed\"` and `\"Token is not correct\"` paths throw without log call). This negative test pins the gap."
- test_files:
  - "No test file references this filter class. `grep -rln 'IngestionDataEntitiesFilter' <odd-platform-repo>/odd-platform-api/src/test` returns ZERO matches. `grep -rln 'auth.ingestion.filter' <odd-platform-repo>/odd-platform-api/src/test` returns ZERO matches. The existing integration tests in `BaseIngestionTest.java` inherit `application.yml`'s `false` default; they exercise the controller path with NO filter in scope. The entire filter is uncovered by tests."
  - "`BaseIngestionTest.java` — exercises the ingestion endpoints via WebTestClient WITHOUT setting `auth.ingestion.filter.enabled=true`; the filter is never instantiated during integration tests. (Cited in companion sidecar `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md`.)"
- gaps: |
    Zero test coverage on the filter class — neither the conditional-registration path, the happy-path token-check, the 401 wire shapes, the datasource-token vs collector-token-fallback branch, nor the misleading 5xx-on-NotFoundException behaviour is exercised. A regression that:
    (a) removes the `@ConditionalOnProperty` annotation entirely (unconditional registration);
    (b) inverts the `havingValue="true"` to `havingValue="false"`;
    (c) changes the path matcher from `/ingestion/entities` to a wildcard `/ingestion/**`;
    (d) replaces `.equals(...)` with `==` (interning-dependent identity comparison);
    (e) reorders the body-buffer-then-token-check to token-check-then-body-buffer;
    (f) catches NotFoundException and re-throws as AccessDeniedException;
    would land green in CI. A profile-based integration-test class fixing
    `auth.ingestion.filter.enabled=true` and exercising all six wire shapes is the
    highest-leverage gap to close in this file. **The absence of these tests is part
    of the F-008 destruction-surface story — the only defence on `POST /ingestion/entities`
    has no tests, and the default deployment ships it OFF.**

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
    anchor: ""
    rationale: "Per WebFetch 2026-05-19 (status 200), this is the ONLY live docs page that mentions `auth.ingestion.filter.enabled` — and only in passing: 'if you only need to authenticate the ingestion pipeline (collectors / push adapters), consider combining S2S with `auth.ingestion.filter.enabled: true`'. The page describes the X-API-Key/S2S auth model (a DIFFERENT filter: `S2sAuthenticationFilter`) and does NOT describe how `IngestionDataEntitiesFilter` works — its bearer-token convention, per-datasource token model, plaintext-equality comparison, path coverage, or the 401 response shapes. Operators reading this page would not know that ingestion authentication exists as a separate mechanism with its own token model."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "Per WebFetch 2026-05-19 (status 200), the authentication index lists five modes — Disable / Login form / OAUTH2/OIDC / LDAP / S2S — and does NOT mention `auth.ingestion.filter.enabled`, `IngestionDataEntitiesFilter`, the `Authorization: Bearer` ingestion convention, or how `POST /ingestion/entities` is authenticated. The five-modes framing is incomplete: ingestion auth is a sixth, orthogonal mechanism not surfaced on this index."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication"
    anchor: ""
    rationale: "Per WebFetch 2026-05-19 (status 200), the DISABLED-authentication page warns 'DO NOT use this method in your production environment!' but does NOT enumerate the surfaces left open — including `POST /ingestion/entities`. Operators reading this page learn DISABLED is dev-only but do not learn that DISABLED + the default `auth.ingestion.filter.enabled=false` combine to expose the centerpiece S2S ingestion endpoint. REFACTOR-185 (15-sidecar) is the load-bearing finding here — DISABLED-mode bypasses the SecurityWebFilterChain entirely, and the ingestion filter being off-by-default means there is zero check on the ingestion endpoint under the bundled default deployment."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "The live docs do not document the `IngestionDataEntitiesFilter` mechanism. Per WebFetch 2026-05-19, the authentication index page (status 200) does not mention `auth.ingestion.filter.enabled`; the S2S subpage (status 200) mentions the property once in passing as a defence-in-depth pairing but does not explain the per-datasource bearer-token model, the `Authorization: Bearer` convention, the path coverage (only `/ingestion/entities`, NOT `/ingestion/datasources` or `/ingestion/alert/alertmanager`), or the default-OFF stance. An operator following the docs would not know how to enable ingestion authentication, what header to send, or that the property is OFF by default in `application.yml:48`."
  - "DISABLED-mode warning is too thin — the disabled-authentication live page (status 200, WebFetch 2026-05-19) carries only 'DO NOT use this method in your production environment!' as its warning. It does NOT enumerate which endpoints become anonymously reachable: the centerpiece `POST /ingestion/entities` (destructive writes per F-008 / REFACTOR-185), the keys-to-the-kingdom RBAC mutations (POLICY_CREATE / ROLE_CREATE per REFACTOR-185 batch E), the data-entity read paths (REFACTOR-185 batch F), the search facets (REFACTOR-185 batch M), the DEG-lineage enumeration (REFACTOR-185 batch M). REFACTOR-185's prescription — boot-time security-posture validator + full blast-radius documentation — directly addresses this drift."
  - "Sibling endpoint `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) is not covered by ANY filter and not surfaced in ANY docs page. `auth.ingestion.filter.enabled=true` does NOT protect it. `SecurityConstants.WHITELIST_PATHS` (line 96) puts `/ingestion/**` into the OAUTH2/LDAP permit list. Under LOGIN_FORM, the explicit `permittedPaths` array (LoginFormSecurityConfiguration.java:50) lists `/ingestion/entities` and `/ingestion/datasources` but NOT `/ingestion/alert/alertmanager` — yet under OAUTH2/LDAP the wildcard `/ingestion/**` IS broad enough to permit it. The LOGIN_FORM exact-path list and the OAUTH2/LDAP wildcard are INCONSISTENT in scope: under LOGIN_FORM, `POST /ingestion/alert/alertmanager` would be REJECTED (no permit, no SecurityRule, falls through to `.pathMatchers(\"/**\").authenticated()`); under OAUTH2/LDAP, it would be PERMITTED. This is a real cross-mode behaviour divergence the docs do not enumerate."

## implicit_adrs

- "Ingestion authentication is a SEPARATE filter, OFF by default, deliberately path-matched per endpoint" — evidence: IngestionDataEntitiesFilter.java:19-28 (`@Component` + `@ConditionalOnProperty(havingValue=\"true\")` + hard-coded `\"/ingestion/entities\"` path matcher in constructor) + IngestionDataSourceFilter.java:15-20 (parallel structure: `@Component` + different path matcher) + AbstractIngestionFilter.java:28-31 (parent accepts a `ServerWebExchangeMatcher` in its constructor, deliberately one-filter-class-per-path) — intent_anchor: the package layout (`auth/filter/*Filter.java`), naming convention (`Ingestion{X}Filter` ↔ `/ingestion/{x}`), the parent's matcher-in-constructor design, and the deliberate split between conditionally-registered (this filter) vs unconditionally-registered (`IngestionDataSourceFilter`) subclasses, all consistently encode the architectural stance: each ingestion endpoint gets its own filter, the operator can toggle the data-entities filter alone, the data-source-registration filter is permanent. The naming + structure + annotation form ARE the design statement. — confidence: HIGH

- "Token verification is PLAINTEXT-EQUALITY against a shared secret stored unhashed in PostgreSQL" — evidence: IngestionDataEntitiesFilter.java:56 (`dto.tokenPojo().getValue().equals(token)`) + companion CollectorController sidecar evidence cited in `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md` (`TokenGeneratorImpl.java:39,49` generates `RandomStringUtils.randomAlphanumeric(40)` plaintext; `ReactiveTokenRepositoryImpl.java:30-39` writes the raw string to TOKEN.value) — intent_anchor: the `String.equals` choice on the verify-side mirrors the plaintext-write on the rotate-side; the project has CONSISTENTLY chosen shared-secret semantics over hashed-credential semantics for the entire collector-token model. The `RandomStringUtils.randomAlphanumeric(40)` length (40 chars × log2(62) ≈ 238 bits of entropy) means brute-force is infeasible, but the timing-side-channel from non-constant-time comparison and the at-rest-plaintext exposure are both architectural consequences of the shared-secret stance. The same stance applies to `S2sAuthenticationFilter` (sibling class — YAML-configured plaintext token compared via `s2sTokenProvider.isValidToken`). — confidence: HIGH

- "Body-buffered-before-auth: the filter reads the entire request body (up to 20MB) before checking the token, because the datasource identity is in the body, not in a header" — evidence: IngestionDataEntitiesFilter.java:37-44 (`super.getBody().collectList().flatMapMany(dataBuffer -> { final DataEntityList body = readBody(dataBuffer, DataEntityList.class); final String token = resolveToken(exchange.getRequest()); return dataSourceRepository.getDtoByOddrn(body.getDataSourceOddrn())...`) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) + AbstractIngestionFilter.java:53-64 (`readBody` materialises the entire `List<DataBuffer>` into a byte array in heap) — intent_anchor: the ordering is structural — `getDataSourceOddrn()` is a body field, not a header, so the platform cannot route to the correct token without parsing the body. The design choice was to embed the datasource identity in the payload (the Ingestion API contract owns this), which forces the filter to materialise + parse before authenticating. A protocol redesign (e.g. requiring `X-Datasource-Oddrn` header) would let the filter authenticate without body materialisation; that redesign would break the Ingestion API contract. — confidence: HIGH

- "When the toggle is OFF, the path is ORTHOGONALLY permitted by every UI auth mode — ingestion auth is the SOLE defender, not a layered defender" — evidence: LoginFormSecurityConfiguration.java:49-51 (`permittedPaths` includes `/ingestion/entities` + `/ingestion/datasources`) + SecurityConstants.java:95-96 (`WHITELIST_PATHS = {..., \"/ingestion/**\", ...}`) + AuthorizationCustomizer.java:22 (`pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()`) + DisabledAuthSecurityConfiguration.java:13-18 (`.anyExchange().permitAll()`) + SecurityConstants.java:98-355 (no SECURITY_RULES entry for `/ingestion/entities`) — intent_anchor: the cross-cutting permit pattern is deliberate. The Ingestion API contract is HTTP-public-but-token-authenticated; embedding it inside the SecurityWebFilterChain's per-permission authorization model would require a synthetic Permission, a per-datasource ResourceExtractor, and a non-trivial AuthorizationManager — the maintainer instead chose a dedicated WebFilter that intercepts BEFORE the SecurityWebFilterChain's authorize step. The trade-off: when the filter is off, there is NO fallback defense. This is consistent with the codebase pattern (`S2sAuthenticationFilter` is structured the same way — orthogonal to the UI auth modes, defending via a dedicated filter). The stance is implicit but coherent. — confidence: HIGH

## bugs_limitations_corner_cases

- "Default-OFF posture leaves `POST /ingestion/entities` UNAUTHENTICATED on a bundled deployment — this is the LARGEST single security exposure in the platform's default deployment posture. `application.yml:48` ships `auth.ingestion.filter.enabled: false`; `IngestionDataEntitiesFilter.java:20` has `havingValue=\"true\"` and NO `matchIfMissing`; therefore the bean is not registered, and the SecurityWebFilterChain explicitly permits `/ingestion/entities` (LoginFormSecurityConfiguration.java:50; SecurityConstants.WHITELIST_PATHS line 96; DisabledAuthSecurityConfiguration line 13-18) under all four UI auth modes. Any caller able to reach the platform's HTTP port can `POST /ingestion/entities` with arbitrary `DataEntityList` payloads referencing any `dataSourceOddrn` — and per F-008 (P-10:F-001 destruction surface), can SILENTLY DELETE metadata and lineage by submitting partial-state payloads. This is the load-bearing element of REFACTOR-185 / F-008's `default_off_unauthenticated_ingestion_at_filter_layer` drift facet. Same shape as LSN-001 (bundled default causes data loss) and the case-law that REFACTOR-073 / REFACTOR-185 prescribe boot-time security-posture validation for." — evidence: IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:11-19 — severity: HIGH

- "Path matcher is hard-coded EXACT-literal `/ingestion/entities` (no wildcard, no property injection, no regex). A new endpoint `POST /ingestion/entities/batch` / `POST /ingestion/entities/v2` / `POST /ingestion/entities/stream` would silently bypass authentication. There is no compile-time signal, no test asserting the path scope, and no `@docs` annotation pinning the literal." — evidence: IngestionDataEntitiesFilter.java:28 (literal string `\"/ingestion/entities\"`) — severity: MEDIUM (future-regression risk)

- "Sibling endpoint `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) is NOT covered by any filter and has NO `@PreAuthorize`. The property name `auth.ingestion.filter.enabled` reads as 'lock down ingestion' but the toggle covers ONLY `/ingestion/entities`. An operator enabling the toggle would reasonably believe ingestion is protected and would be wrong." — evidence: AlertManagerController.java:17-26 (no annotations, no filter) + IngestionDataEntitiesFilter.java:28 (path mismatch) + IngestionDataSourceFilter.java:20 (path mismatch) — severity: HIGH

- "Cross-mode coverage divergence for sibling ingestion paths: LOGIN_FORM's explicit `permittedPaths` (line 50) lists `/ingestion/entities` + `/ingestion/datasources` exact-only — so `POST /ingestion/alert/alertmanager` under LOGIN_FORM would FALL THROUGH to `.pathMatchers(\"/**\").authenticated()` and require login. But OAUTH2/LDAP route through `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**` wildcard, line 96) which DOES permit `/ingestion/alert/alertmanager`. Under DISABLED, every path is permitAll. The mode-by-mode reachability of the alertmanager webhook is INCONSISTENT and undocumented. An operator switching from LOGIN_FORM to OAUTH2 might unknowingly open the alertmanager webhook." — evidence: LoginFormSecurityConfiguration.java:49-51 (exact list, no wildcard) + SecurityConstants.java:95-96 (`/ingestion/**` wildcard) + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:13-18 — severity: MEDIUM

- "Body-buffered-before-auth ordering allows heap-pressure DoS: an attacker submitting 20MB invalid-token payloads forces the platform to buffer + Jackson-parse the body before token rejection (read-body at line 38, parse at line 40, token check at line 56). Repeated bad requests can saturate heap. There is no rate-limit, no concurrent-request cap, no per-IP throttle." — evidence: IngestionDataEntitiesFilter.java:37-60 (body-first ordering) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) — severity: MEDIUM

- "Token mismatch / missing-token attempts are NOT LOGGED. The filter throws `AccessDeniedException(\"Token is not correct\")` (line 57) or the parent throws `AccessDeniedException(\"Token is missed\")` (AbstractIngestionFilter.java:48) and the parent writes a 401 with the message verbatim — but there is no `@Slf4j` log call on either path, and no metric counter. A security incident review of 'how many failed-auth attempts in the last hour' cannot be answered from application logs." — evidence: IngestionDataEntitiesFilter.java:55-58 (no log) + AbstractIngestionFilter.java:34-72 (no log on filter-match OR writeResponse paths; @Slf4j IS imported at line 10 but only used by `readBody` exception path at line 61) — severity: MEDIUM

- "Plaintext-equality `String.equals` is not constant-time — timing-based token discovery on a low-latency network is theoretically feasible. For a 40-char alphanumeric token the search space is large (62^40 ≈ 2.4e71), but the principle is violated. `MessageDigest.isEqual(...)` would mitigate." — evidence: IngestionDataEntitiesFilter.java:56 — severity: MEDIUM

- "`NotFoundException` on unknown datasource/collector surfaces as 5xx (not 401). The parent only catches `AccessDeniedException` to write a 401 response (AbstractIngestionFilter.java:40). Any other exception — including the two `NotFoundException` throws at lines 44 and 50-51 — propagates to the default reactive error handler and surfaces as 500 Internal Server Error. An attacker probing the endpoint with arbitrary payload + valid token can distinguish 'datasource exists, wrong token' (401) from 'datasource does not exist' (5xx) — minor info-leak. An operator hitting a half-configured collector record gets a misleading status code." — evidence: IngestionDataEntitiesFilter.java:43-51 (NotFoundException throws) + AbstractIngestionFilter.java:40 (only catches AccessDeniedException) — severity: LOW (info-leak) / MEDIUM (operator-debug misleading)

- "Token caching is absent. Every ingestion request re-fetches the datasource (and possibly the collector) from PostgreSQL — `getDtoByOddrn` + `getDto` are non-cached reactive DB calls. On a high-throughput ingestion stream (hundreds of `POST /ingestion/entities` per second), this is N+M extra DB round-trips on the hot path. A short-TTL token cache (Caffeine, keyed by `dataSourceOddrn`) would eliminate the per-request DB hits with a known invalidation requirement on `regenerateCollectorToken` / `regenerateDatasourceToken`." — evidence: IngestionDataEntitiesFilter.java:43-54 (no caching) — severity: MEDIUM

- "Body is parsed TWICE: filter parses payload to `DataEntityList` purely to extract `dataSourceOddrn` (line 40), then re-emits the cached buffers (line 60) for the controller (IngestionController.java:38) to deserialise the SAME payload AGAIN. For a 20MB DataEntityList containing 1000 entities, this is two full Jackson tree-walks per request. A streaming `JsonPath`-style extraction of just `dataSourceOddrn` would halve the per-request parse cost." — evidence: IngestionDataEntitiesFilter.java:40 (full deserialise) + IngestionController.java:38-44 (controller re-deserialises) — severity: MEDIUM (perf)

## security

- **auth_mode_relevance**: `S2S` — specifically the **per-datasource bearer-token** S2S variant (NOT the `auth.s2s.enabled` + `X-API-Key` global-admin variant — that is `S2sAuthenticationFilter`, a sibling class). The filter is ORTHOGONAL to the four UI auth modes (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`): all four modes explicitly permit `/ingestion/entities`, so authentication on this endpoint is EXCLUSIVELY this filter's responsibility regardless of `auth.type`. Under DISABLED + filter-OFF (the bundled defaults), the endpoint is unauthenticated; under any of the other three UI modes with filter-OFF, it is STILL unauthenticated (the UI auth mode does not protect this endpoint).
- **ingestion_filter_relevance**: `YES — this IS the canonical ingestion filter` for `POST /ingestion/entities`. The path matcher is `new PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)` at line 28. Sibling endpoints: `/ingestion/datasources` POST is covered by `IngestionDataSourceFilter` (unconditional, collector-token auth); `/ingestion/alert/alertmanager` POST is covered by NO filter (AlertManagerController.java:21); nested paths under `/ingestion/datasources/{id}/dataentities/statistics` etc. are covered by NO filter.
- **authorization_assertions**:
  - "Bean registration gated by `@ConditionalOnProperty(value=\"auth.ingestion.filter.enabled\", havingValue=\"true\")` with no `matchIfMissing`" — evidence: IngestionDataEntitiesFilter.java:20
  - "When registered: per-request `Authorization: Bearer <token>` header required; missing/malformed header throws `AccessDeniedException(\"Token is missed\")` → 401" — evidence: AbstractIngestionFilter.java:45-51 + IngestionDataEntitiesFilter.java:41
  - "Token compared via plaintext `String.equals` to matched datasource's `TOKEN` row (or parent collector's `TOKEN` row when datasource has `token() == null`)" — evidence: IngestionDataEntitiesFilter.java:46-58
  - "No SecurityRule entry — `SecurityConstants.SECURITY_RULES` (lines 98-355) does NOT contain `/ingestion/entities`; the ingestion-token check is filter-based, not Permission-based" — evidence: SecurityConstants.java:98-355 (absence) + AbstractIngestionFilter.java:34-41 (the WebFilter mechanism)
- **owner_scoping**: `N/A — ingestion path is not owner-scoped`. The filter authenticates the *caller* (a collector / datasource via shared-secret token) but does not associate the request with a platform Owner identity. Ingested DataEntity rows are NOT stamped with `created_by_owner` based on the calling collector; ownership is established later via the UI/API. Token = identity-of-collector, NOT identity-of-user. F-008 already documents this: "datasource scoping is **payload-driven, NOT principal-driven**" — the filter validates that THIS token may write to THIS datasource (per the datasource's `token_id` FK), but does not constrain the caller to ANY specific Owner.
- **data_exposure**:
  - "When `auth.ingestion.filter.enabled=false` (the default) AND `auth.type=DISABLED` (also default): `POST /ingestion/entities` is anonymously reachable. Any HTTP caller can submit a `DataEntityList` payload referencing any `dataSourceOddrn`. The ingested entities become visible to ALL platform users (and to anonymous callers under DISABLED). Per F-008 destruction surface — partial payloads silently DELETE metadata and lineage." — evidence: IngestionDataEntitiesFilter.java:20 + application.yml:34 (auth.type=DISABLED) + application.yml:48 (filter=false)
  - "When `auth.ingestion.filter.enabled=false` and any of LOGIN_FORM / OAUTH2 / LDAP is active: `POST /ingestion/entities` is STILL anonymously reachable. The UI auth mode does not protect this endpoint (every config permits it). Same destruction surface applies." — evidence: LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:96 + AuthorizationCustomizer.java:22
  - "When `auth.ingestion.filter.enabled=true`: any caller possessing a valid bearer token for ANY datasource can submit DataEntityList payloads for THAT datasource. No per-entity ACL enforced at this layer. Cross-datasource writes are PREVENTED at this filter (the token must match the datasource in the payload), but a stolen token for datasource A authorises destruction of datasource A's metadata and lineage." — evidence: IngestionDataEntitiesFilter.java:43-58 (token comparison binds caller to the specific datasource in the payload)
  - "401 response body contains the `AccessDeniedException` message verbatim (`\"Token is missed\"` or `\"Token is not correct\"`) — useful diagnostic, also a signal-of-deployment-mode to an attacker probing the endpoint to distinguish filter-on vs filter-off." — evidence: AbstractIngestionFilter.java:66-72 + IngestionDataEntitiesFilter.java:57
- **known_security_gaps**:
  - "DEFAULT-OFF ingestion authentication — the bundled `application.yml:48` ships `auth.ingestion.filter.enabled: false`. Combined with `auth.type=DISABLED` (also default per line 34), an unmodified deployment exposes the centerpiece ingestion endpoint to unauthenticated callers. This is the same shape as LSN-001 (attachment ephemeral default) — a bundled default that silently produces a data-loss / data-integrity vector. REFACTOR-185 (15-sidecar triangulated) and REFACTOR-073 (boot-time security-posture validator prescription) both point at this. F-008 documents the destruction surface that emerges when this filter is OFF." — evidence: IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + application.yml:32-34 — severity: HIGH
  - "Path coverage is endpoint-by-endpoint, not feature-by-feature — `POST /ingestion/alert/alertmanager` (AlertManagerController.java:21) is uncovered by any filter AND has no `@PreAuthorize`. The property name `auth.ingestion.filter.enabled` is misleading; it locks down ONLY `/ingestion/entities`." — evidence: AlertManagerController.java:17-26 + IngestionDataEntitiesFilter.java:28 — severity: HIGH
  - "Plaintext-equality token comparison — `String.equals` is not constant-time. Timing-based token discovery is theoretically feasible on a low-latency network. The token is also stored at-rest as plaintext in PostgreSQL (TOKEN.value column populated by `RandomStringUtils.randomAlphanumeric(40)` per the rotate sidecar). A DB-read attack (read-only SQL injection elsewhere in the platform) would yield the live ingestion tokens." — evidence: IngestionDataEntitiesFilter.java:56 — severity: MEDIUM
  - "Body-buffered-before-auth — 20MB payloads are fully materialised + Jackson-parsed before token rejection. Heap-pressure DoS vector with low attacker effort. No rate-limit, no per-IP throttle." — evidence: IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15 — severity: MEDIUM
  - "Failed-auth attempts not logged — neither `\"Token is missed\"` nor `\"Token is not correct\"` paths emit log calls. No metric counter on the failure path. Security incident review cannot establish 'attacker probed endpoint N times' from application logs." — evidence: IngestionDataEntitiesFilter.java:55-58 (no log) + AbstractIngestionFilter.java:34-72 (no log on match OR writeResponse paths) — severity: MEDIUM
  - "Filter-OFF leaves NO defense — there is no fallback authorization. Unlike the SecurityWebFilterChain (which has SecurityRules as a backup against `@PreAuthorize` omissions on the UI/API surface), ingestion auth has only this one layer. When the toggle is off, the endpoint is open. Defense-in-depth via `auth.s2s.enabled=true` is the only fallback today (S2S ADMIN identity reaches all endpoints), but it requires explicit opt-in." — evidence: IngestionDataEntitiesFilter.java:20 (the single toggle) + AuthorizationCustomizer.java:22 (no SecurityRule fallback for /ingestion/entities) — severity: HIGH

## performance

- **hot_paths**:
  - "Per-request body materialisation + Jackson deserialisation: `super.getBody().collectList()` (line 38) collects the entire reactive Flux of DataBuffers into a List, then `readBody(dataBuffer, DataEntityList.class)` (line 40) Jackson-parses it. For a 20MB payload (1000-entity batch) this is O(payload-size) heap allocation + O(payload-size) parse, on EVERY ingestion request, BEFORE token rejection or admission." — evidence: IngestionDataEntitiesFilter.java:37-40 + AbstractIngestionFilter.java:53-64
  - "Per-request DB round-trips: 1 SELECT on `data_source` by ODDRN (line 43, `dataSourceRepository.getDtoByOddrn`); IF datasource has `token() == null`, 1 ADDITIONAL SELECT on `collector` by id (line 49, `collectorRepository.getDto`). 1-2 DB hits per request on the auth path, NOT cached." — evidence: IngestionDataEntitiesFilter.java:43-54
  - "Body re-emit: after token validation, `flatMapIterable(ignored -> dataBuffer)` (line 60) re-emits the buffered DataBuffers UNCHANGED into the controller's reactive stream. The controller (IngestionController.java:38-44) then re-parses the same payload to its own `Mono<DataEntityList>` via the OpenAPI-generated `IngestionApi` deserialisation. PAYLOAD IS PARSED TWICE per request." — evidence: IngestionDataEntitiesFilter.java:60 + IngestionController.java:38-44
- **throughput_characteristics**:
  - "Reactive `Flux<DataBuffer>` + `Mono` signature — non-blocking, but each request still buffers the entire body via `collectList()` before any auth decision. No streaming validation path; no `JsonPath`-style early extraction of `dataSourceOddrn`."
  - "Duplicate body parse — filter and controller both deserialise to `DataEntityList`. For 1000-entity payloads this is meaningful CPU; for typical 10-entity collector ticks it is negligible."
  - "Filter is registered once at context startup (the `@ConditionalOnProperty` is a static decision) and operates per-request thereafter. Switching the toggle requires process restart."
- **resource_allocation**:
  - "Heap: full request body held in memory (up to `spring.codec.max-in-memory-size: 20MB` per `application.yml:15`) for the duration of body-collect → parse → datasource-resolve → token-compare → re-emit. Concurrent requests multiply heap pressure linearly. GC pressure proportional to (request-rate × payload-size)." — evidence: IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15
  - "ObjectMapper instance allocation: `new ObjectMapper()` per `AbstractIngestionFilter` subclass instance (parent line 32). With Spring singletons, two ObjectMappers exist (one per concrete filter — this filter + IngestionDataSourceFilter). Jackson's recommended pattern is shared static instance; the per-class instance is a minor memory inefficiency. NOT a hot-path bug." — evidence: AbstractIngestionFilter.java:32
  - "DB connection: each ingestion request acquires 1-2 R2DBC connections (1 for datasource SELECT, optionally 1 for collector SELECT). On the happy path these are short-lived. Connection pool sizing must accommodate ingestion concurrency × 1-2." — evidence: IngestionDataEntitiesFilter.java:43-54 (no caching → every request hits DB)
- **scaling_characteristics**:
  - "Filter is stateless — no instance fields beyond injected repositories; instances scale horizontally." — evidence: IngestionDataEntitiesFilter.java:21-32 (only final injected dependencies)
  - "No locks, no advisory locks, no shared mutable state. Concurrent ingestion requests do not contend at the filter layer (contention is downstream in `IngestionService.ingest` via the `SELECT FOR UPDATE` lock on `data_source` per F-008 sidecar)."
  - "Conditional registration is static — horizontal-scale clusters all evaluate the toggle at boot; the cluster's stance is consistent across nodes. An operator changing `auth.ingestion.filter.enabled` requires a rolling restart, not a runtime reconfiguration."
- **known_performance_gaps**:
  - "Duplicate payload parse (filter + controller) — full Jackson deserialisation on the auth path AND the data path. A `JsonPath`-style streaming extraction of `dataSourceOddrn` alone would eliminate the filter's parse cost. Estimated saving: ~half of per-request parse CPU; meaningful at >100 req/s on 1000-entity payloads." — evidence: IngestionDataEntitiesFilter.java:40 + IngestionController.java:38-44 — severity: MEDIUM
  - "Token caching absent — every ingestion request re-fetches the datasource + (optionally) the collector from DB. A short-TTL Caffeine cache keyed by `dataSourceOddrn` would eliminate per-request DB hits on steady-state ingestion streams. Invalidation hook needed on `regenerateCollectorToken` / datasource token rotation." — evidence: IngestionDataEntitiesFilter.java:43-54 (no caching) — severity: MEDIUM
  - "Body-buffered-before-auth — attacker submitting 20MB invalid-token payloads forces the platform to allocate + parse before rejecting. Auth-first ordering (parse just the header + path) would shed bad traffic earlier, but the body-driven datasource identity requires body parse before token resolution. Protocol-level fix (e.g. `X-Datasource-Oddrn` header) would unblock the reordering but break the Ingestion API contract." — evidence: IngestionDataEntitiesFilter.java:37-60 — severity: LOW (perf) / MEDIUM (security DoS — see security.known_security_gaps)

## sources

- understanding ← IngestionDataEntitiesFilter.java:1-65 + AbstractIngestionFilter.java:1-73 + IngestionDataSourceFilter.java:1-44 + application.yml:46-48 + LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:19-31 + DisabledAuthSecurityConfiguration.java:11-19
- concepts.invariants[0] ← IngestionDataEntitiesFilter.java:20 (annotation literal text) + application.yml:46-48
- concepts.invariants[1] ← IngestionDataEntitiesFilter.java:28 (hard-coded matcher constructor call)
- concepts.invariants[2] ← IngestionDataEntitiesFilter.java:43-54 (lookup precedence)
- concepts.invariants[3] ← IngestionDataEntitiesFilter.java:56 (`String.equals`) + companion sidecar `CollectorController__regenerateCollectorToken` evidence
- concepts.invariants[4] ← IngestionDataEntitiesFilter.java:37-44 + AbstractIngestionFilter.java:53-64 + application.yml:14-15
- concepts.invariants[5] ← IngestionDataEntitiesFilter.java:60 (`flatMapIterable(ignored -> dataBuffer)`) + IngestionController.java:38-44 (re-parse)
- concepts.invariants[6] ← IngestionDataEntitiesFilter.java:43-51 (NotFoundException throws) + AbstractIngestionFilter.java:40 (only catches AccessDeniedException)
- dependencies_semantic.requires-feature ← AbstractIngestionFilter.java:1-73 + ReactiveDataSourceRepository (sibling sidecar reference) + IngestionController.java:31-45 + IngestionService.ingest (F-008 destruction-surface chain)
- dependencies_semantic.requires-config ← IngestionDataEntitiesFilter.java:20 + application.yml:46-48
- dependencies_semantic.requires-runtime ← IngestionDataEntitiesFilter.java:1-17 (imports: WebFlux + Reactor + Jackson via parent) + AbstractIngestionFilter.java:32 (ObjectMapper)
- dependencies_semantic.coupling[0] (path coverage incomplete) ← IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20 + AlertManagerController.java:21
- dependencies_semantic.coupling[1] (toggle gates ONLY this filter) ← IngestionDataEntitiesFilter.java:19-20 (`@Component` + conditional) vs IngestionDataSourceFilter.java:15 (`@Component` alone)
- dependencies_semantic.coupling[2] (orthogonal to UI auth modes) ← LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:13-18 + OAuthSecurityConfiguration.java:94-100 + LDAPSecurityConfiguration.java:141-147
- dependencies_semantic.coupling[3] (S2S ordering) ← S2sAuthenticationFilter.java:17-48 + LoginFormSecurityConfiguration.java:61-63 + OAuthSecurityConfiguration.java:108-110 + WebFetch 2026-05-19 of /configuration-and-deployment/enable-security/authentication/s2s (live page recommends combining S2S with `auth.ingestion.filter.enabled=true`)
- tests_coverage_semantic.test_files ← grep `IngestionDataEntitiesFilter` against <odd-platform-repo>/odd-platform-api/src/test returned zero matches; grep `auth.ingestion.filter` returned zero matches; BaseIngestionTest.java exists and exercises the controller without setting the toggle
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-19T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s (status 200) — fetched excerpt: "if you only need to authenticate the ingestion pipeline (collectors / push adapters), consider combining S2S with `auth.ingestion.filter.enabled: true`"
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-19T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (status 200) — fetched excerpt: "Disable authentication / Login form / OAUTH2/OIDC / LDAP / Server-to-server (S2S)" — no mention of ingestion-filter
- docs_link_semantic.inferred_docs[2] ← WebFetch 2026-05-19T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication (status 200) — fetched excerpt: "DO NOT use this method in your production environment!" — no enumeration of exposed surfaces
- docs_link_semantic.doc_drift_findings[0] (no live docs document IngestionDataEntitiesFilter) ← WebFetch evidence above + IngestionDataEntitiesFilter.java:1-65 (entire mechanism undocumented)
- docs_link_semantic.doc_drift_findings[1] (DISABLED warning too thin) ← REFACTOR-185.md (15-sidecar triangulation) + WebFetch of disabled-authentication page (status 200, thin warning)
- docs_link_semantic.doc_drift_findings[2] (cross-mode coverage divergence) ← LoginFormSecurityConfiguration.java:49-51 (exact-path list) + SecurityConstants.java:95-96 (`/ingestion/**` wildcard) + AlertManagerController.java:21 (uncovered sibling)
- implicit_adrs[0] (separate filter, OFF by default, path-matched per endpoint) ← IngestionDataEntitiesFilter.java:19-28 + IngestionDataSourceFilter.java:15-20 + AbstractIngestionFilter.java:28-31 + package layout (auth/filter/*Filter.java naming pattern)
- implicit_adrs[1] (plaintext-equality shared-secret stance) ← IngestionDataEntitiesFilter.java:56 + companion `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md` implicit_adrs[2] + sibling S2sAuthenticationFilter.java:27 (plain-equality)
- implicit_adrs[2] (body-buffered-before-auth structural) ← IngestionDataEntitiesFilter.java:37-44 + application.yml:14-15 + AbstractIngestionFilter.java:53-64
- implicit_adrs[3] (orthogonal to UI auth modes; sole defender when toggle is off) ← LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:13-18 + SecurityConstants.java:98-355 (no SecurityRule entry for /ingestion/entities)
- bugs_limitations_corner_cases[0] (default-OFF deployment) ← IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:11-19 + F-008 + REFACTOR-185
- bugs_limitations_corner_cases[1] (hard-coded path) ← IngestionDataEntitiesFilter.java:28
- bugs_limitations_corner_cases[2] (sibling alertmanager uncovered) ← AlertManagerController.java:17-26 + IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20
- bugs_limitations_corner_cases[3] (cross-mode divergence) ← LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:13-18
- bugs_limitations_corner_cases[4] (body-buffered DoS) ← IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15
- bugs_limitations_corner_cases[5] (no log on failure) ← IngestionDataEntitiesFilter.java:55-58 + AbstractIngestionFilter.java:34-72
- bugs_limitations_corner_cases[6] (timing-side-channel) ← IngestionDataEntitiesFilter.java:56
- bugs_limitations_corner_cases[7] (NotFoundException → 5xx) ← IngestionDataEntitiesFilter.java:43-51 + AbstractIngestionFilter.java:40
- bugs_limitations_corner_cases[8] (no token cache) ← IngestionDataEntitiesFilter.java:43-54
- bugs_limitations_corner_cases[9] (duplicate parse) ← IngestionDataEntitiesFilter.java:40 + IngestionDataEntitiesFilter.java:60 + IngestionController.java:38-44
- security.auth_mode_relevance ← IngestionDataEntitiesFilter.java:20 + LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 + DisabledAuthSecurityConfiguration.java:13-18 + S2sAuthenticationFilter.java:17-48
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:20 + AlertManagerController.java:21
- security.authorization_assertions ← IngestionDataEntitiesFilter.java:20 + 41-58 + AbstractIngestionFilter.java:45-51 + SecurityConstants.java:98-355 (no SecurityRule)
- security.data_exposure ← application.yml:32-48 + LoginFormSecurityConfiguration.java:49-51 + AbstractIngestionFilter.java:66-72 + F-008 destruction surface
- security.known_security_gaps[0] (default-OFF) ← IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + REFACTOR-185
- security.known_security_gaps[1] (alertmanager uncovered) ← AlertManagerController.java:17-26 + IngestionDataEntitiesFilter.java:28
- security.known_security_gaps[2] (plaintext-equality) ← IngestionDataEntitiesFilter.java:56
- security.known_security_gaps[3] (body-buffered DoS) ← IngestionDataEntitiesFilter.java:37-60
- security.known_security_gaps[4] (failed-auth not logged) ← IngestionDataEntitiesFilter.java:55-58 + AbstractIngestionFilter.java:34-72
- security.known_security_gaps[5] (no fallback defense) ← IngestionDataEntitiesFilter.java:20 + AuthorizationCustomizer.java:22 + SecurityConstants.java:98-355
- performance.hot_paths ← IngestionDataEntitiesFilter.java:37-60
- performance.throughput_characteristics ← IngestionDataEntitiesFilter.java:37-60 + IngestionController.java:38-44
- performance.resource_allocation ← IngestionDataEntitiesFilter.java:37-60 + application.yml:14-15 + AbstractIngestionFilter.java:32
- performance.scaling_characteristics ← IngestionDataEntitiesFilter.java:21-32 (stateless)
- performance.known_performance_gaps[0] (duplicate parse) ← IngestionDataEntitiesFilter.java:40 + IngestionController.java:38-44
- performance.known_performance_gaps[1] (no token cache) ← IngestionDataEntitiesFilter.java:43-54
- performance.known_performance_gaps[2] (body-buffered) ← IngestionDataEntitiesFilter.java:37-60

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (3 live URLs WebFetched 2026-05-19, drift findings are evidence-anchored on the fetched excerpts)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

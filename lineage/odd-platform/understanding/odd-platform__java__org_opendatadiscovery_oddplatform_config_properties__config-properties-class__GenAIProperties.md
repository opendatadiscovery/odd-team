---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:GenAIProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-02
---

# GenAIProperties (`@ConfigurationProperties("genai")`) — semantic understanding

## understanding

This is the typed Spring Boot binding for the `genai.*` YAML namespace. It is the
single conceptual schema for the GenAI feature: three fields (`enabled`, `url`,
`requestTimeout`) bound from `application.yml` keys `genai.enabled`, `genai.url`,
`genai.request_timeout` via Spring's relaxed-binding (snake_case ↔ camelCase).
The bean is instantiated by `@EnableConfigurationProperties(GenAIProperties.class)`
in `WebClientConfiguration` and consumed at two distinct lifecycle points: at
bean-construction time (URL + timeout flow into the `genAiWebClient` `WebClient`
constructed once at startup) and at request time (`enabled` is re-read on every
`POST /api/genai/ask` to gate the feature).

## concepts

- entities: [`GenAIProperties` (typed config POJO), the `genai.*` YAML namespace, the `genAiWebClient` Spring bean]
- operations: [bind `genai.enabled` to `boolean enabled`, bind `genai.url` to `String url`, bind `genai.request_timeout` to `int requestTimeout`]
- invariants: [`enabled` is a request-time gate (re-read on every call via `genAIProperties.isEnabled()`); `url` and `requestTimeout` are startup-time inputs (baked into the `WebClient` bean); the feature is **disabled** by `application.yml:18` shipping `genai.enabled: false`; field types use Java primitives (`boolean`, `int`) rather than wrappers — Spring binding will succeed even when the YAML key is absent, falling back to the primitive default]
- audiences: [Platform operators configuring the GenAI proxy via `application.yml` or `GENAI_*` env vars; the `WebClientConfiguration` and `GenAIServiceImpl` runtime consumers]

## dependencies_semantic

- requires-feature: [the GenAI proxy controller surface (`POST /api/genai/ask` exposed via `GenAIController`); an external AI service that accepts `POST {url}/query_data` with JSON body `{"question": "..."}` and returns a string]
- requires-config: [`genai.enabled` (declared at `application.yml:18` with explicit value `false`); `genai.url` (`application.yml:19` is commented out — no Java field initializer, so the runtime default is `null`); `genai.request_timeout` (`application.yml:20` is commented out — no Java field initializer, so the runtime default is `0` minutes)]
- requires-runtime: [Spring Boot's `@ConfigurationProperties` binding; Spring's relaxed binding to map YAML `request_timeout` ↔ Java `requestTimeout`; `@EnableConfigurationProperties(GenAIProperties.class)` declared in `WebClientConfiguration:15` to register the bean (the class itself has no `@Component` / `@ConfigurationPropertiesScan`)]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [(1) verifying that `genai.enabled=false` produces a `BadUserRequestException` ("Gen AI is disabled") at the controller — i.e. the request-time gate; (2) verifying that `genai.request_timeout=N` actually sets `Duration.ofMinutes(N)` on the underlying Reactor Netty `HttpClient.responseTimeout(...)`; (3) verifying that an unset `genai.url` produces a clear startup or first-request failure rather than silent misbehaviour; (4) verifying relaxed binding: that `request_timeout` (snake_case) and `requestTimeout` (camelCase) and `REQUEST_TIMEOUT` (env-var style) all bind to the same field]
- test_files: []
- gaps: |
    There is no `GenAIPropertiesTest`, `GenAIServiceImplTest`, `GenAIControllerTest`,
    or `WebClientConfigurationTest` anywhere under `odd-platform-api/src/test`
    — confirmed by `find odd-platform -path "*/test/*" -name "*.java" | xargs
    grep -l "GenAI"` returning no matches. The most likely silent regression is a
    field rename or YAML key rename that breaks Spring binding silently: e.g.
    renaming `requestTimeout` to `timeoutMinutes` without updating `application.yml`
    leaves the int as `0`, the `genAiWebClient` is built with `Duration.ofMinutes(0)`,
    and every request times out immediately — but the platform boots cleanly and the
    feature is "enabled" from the operator's standpoint. No automated test would
    catch this.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#genai-configuration"
    rationale: "There is no `@docs` annotation on `GenAIProperties.java` (verified by Grep). The published page `configuration-and-deployment/odd-platform` is the canonical operator-facing home for every key under the `genai.*` YAML prefix, and the section `## GenAI Configuration` (anchor `#genai-configuration`) explicitly documents all three fields of this POJO. Confirmed live by WebFetch and locally by reading `documentation/docs/configuration-and-deployment/odd-platform.md:1018`."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08 (status 200, anchor `genai-configuration` present), corroborated by the verbatim source at `documentation/docs/configuration-and-deployment/odd-platform.md:1018-1053`:
    > "## GenAI Configuration
    >
    > The platform can proxy natural-language questions to an external AI service via three keys under the `genai` prefix (`@ConfigurationProperties("genai")` per `GenAIProperties.java`). The feature is **disabled by default** and is **API-only** today (no in-app UI affordance calls the endpoint).
    >
    > * `genai.enabled` (boolean, env `GENAI_ENABLED`) — feature toggle. **Default `false`** (set explicitly at `application.yml` line 18). When `false`, `POST /api/genai/ask` returns HTTP 400 with the message "Gen AI is disabled".
    > * `genai.url` (string, env `GENAI_URL`) — base URL of the external AI service. The platform's `genAiWebClient` is built at startup with this as `baseUrl` and POSTs each request to `{genai.url}/query_data`. **No `@ConfigurationProperties` default — the field has no initializer in `GenAIProperties.java`, so its Java default is `null`.** The example in `application.yml` line 19 (`# url: http://localhost:5000`) is commented out, not a default.
    > * `genai.request_timeout` (integer, env `GENAI_REQUEST_TIMEOUT`) — outbound response timeout, **in minutes**. Wired into `WebClientConfiguration.java:23` as `Duration.ofMinutes(genAIProperties.getRequestTimeout())`. **No `@ConfigurationProperties` default — the Java primitive `int` default is `0`, which means immediate timeout.**"
    >
    > {% hint style="warning" %}
    > **Setting only `genai.enabled=true` will silently misconfigure the feature.** With `url` defaulting to `null` and `request_timeout` defaulting to `0`, the WebClient is built with no `baseUrl` and a `Duration.ofMinutes(0)` timeout — every `POST /api/genai/ask` will fail before the external service has a chance to respond.
    > {% endhint %}
- doc_drift_findings:
  - "No drift between docs and code on the three fields, defaults, and the silent-misconfiguration warning — the live page accurately states `enabled` defaults to `false` (verified at `application.yml:18`), `url` Java default is `null` (verified at `GenAIProperties.java:10` — `private String url;` with no initializer), and `requestTimeout` Java default is `0` (verified at `GenAIProperties.java:11` — `private int requestTimeout;` with no initializer)."
  - "Drift candidate (LOW severity, language only): the live doc says the env var for `genai.request_timeout` is `GENAI_REQUEST_TIMEOUT`. Spring's standard relaxed-binding env-var mapping for `genai.request_timeout` is indeed `GENAI_REQUEST_TIMEOUT` (dots and underscores both upper-cased), so this matches by convention rather than by an explicit binding declaration in this POJO. No code-side issue."

## implicit_adrs

- "GenAI is shipped disabled-by-default — the YAML explicitly writes `enabled: false` rather than relying on the Java primitive default of `false`. This makes the disabled state visible to operators reading `application.yml`, not just an absence." — evidence: GenAIProperties.java:9 (`private boolean enabled;`) + application.yml:17-18 (`genai:\n  enabled: false`) — confidence: HIGH
- "Defaults are deliberately unsafe-when-enabled to force operators to configure the feature deliberately. The Java field initializers for `url` and `requestTimeout` are absent, so unsetting either via env (e.g. `GENAI_URL=`) collapses to `null` / `0` and the request fails fast at the WebClient layer rather than silently calling some implicit endpoint." — evidence: GenAIProperties.java:10-11 (no initializers) + application.yml:19-20 (commented-out examples, not defaults) — confidence: MEDIUM
- "The `WebClient` for GenAI is built once at startup, not per-request — `genai.url` and `genai.request_timeout` changes require a Platform restart." — evidence: WebClientConfiguration.java:20-30 (`@Bean("genAiWebClient")` constructs the client with `baseUrl(genAIProperties.getUrl())` and `responseTimeout(Duration.ofMinutes(genAIProperties.getRequestTimeout()))` once) — confidence: HIGH
- "The `enabled` flag is the only field re-read at request time. `url` and `requestTimeout` are baked into the bean at construction; `enabled` is checked via `genAIProperties.isEnabled()` on every call." — evidence: GenAIServiceImpl.java:37 (`if (!genAIProperties.isEnabled()) { ... }`) + WebClientConfiguration.java:22-23 (other two fields read at bean-construction) — confidence: HIGH
- "GenAI requests are not authenticated and not retried — there is no auth header on the WebClient, no `Authorization`-equivalent field on `GenAIProperties`, and no `Retry`/`onErrorRetry` on the Mono chain. Operators deploy this feature on the assumption that the external AI service is on a trusted network." — evidence: GenAIProperties.java:8-12 (no `apiKey` / `token` / `auth` fields) + WebClientConfiguration.java:26-29 (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`) + GenAIServiceImpl.java:41-52 (no `.retry(...)` / `.retryWhen(...)`) — confidence: HIGH

## bugs_limitations_corner_cases

- "Silent misconfiguration when `genai.enabled=true` is the only key set: `url` Java default is `null` and `requestTimeout` Java default is `0`. The `genAiWebClient` bean is constructed with `baseUrl(null)` and `Duration.ofMinutes(0)`. The platform boots, the feature reports as enabled to the request-time gate, and every `POST /api/genai/ask` fails downstream — at WebClient (null base URL) or via immediate timeout. The live docs flag this explicitly with a warning admonition; the source itself has no field-level safety (no `@NotNull`, no constructor validation, no `@PostConstruct` health check, no `@Validated` on the POJO)." — evidence: GenAIProperties.java:8-12 (no validation annotations, no initializers for `url`/`requestTimeout`) + WebClientConfiguration.java:22-29 (no null-check or zero-check before building the WebClient) — severity: HIGH
- "`requestTimeout=0` is silently accepted at startup: `Duration.ofMinutes(0)` is a legal `Duration` (zero seconds), and `HttpClient.responseTimeout(Duration.ofMinutes(0))` does not throw at bean-construction time. There is no validation that `requestTimeout > 0`. The first request demonstrates the misconfiguration, not the boot." — evidence: WebClientConfiguration.java:23 (`Duration.ofMinutes(genAIProperties.getRequestTimeout())` with no positive-value check) + GenAIProperties.java:11 (`private int requestTimeout;` with no `@Min(1)`) — severity: MEDIUM
- "No bean-validation annotations are declared anywhere on the POJO. There is no `@Validated` at the class level and no `@NotBlank` / `@URL` on `url`, no `@Min(1)` on `requestTimeout`. Spring Boot's `@ConfigurationProperties` validation pipeline (which would surface misconfigurations at startup) is therefore not engaged for this POJO, even though it is engaged for some other Spring projects via `spring-boot-starter-validation`." — evidence: GenAIProperties.java:1-12 (only `@ConfigurationProperties` and `@Data` annotations; no `@Validated`, no `jakarta.validation.constraints.*` imports) — severity: MEDIUM
- "The error message returned for a slow request leaks the timeout value verbatim: 'Gen AI request take longer that %s min'.formatted(genAIProperties.getRequestTimeout())'. With the timeout = 0 misconfiguration, an end-user sees 'Gen AI request take longer that 0 min' — confusing rather than diagnostic. (Plus the message has a typo: 'longer that' should be 'longer than'.)" — evidence: GenAIServiceImpl.java:48-51 — severity: LOW
- "There is no UI consumer for `POST /api/genai/ask` — only the OpenAPI-generated `GenaiApi.ts`, `GenAIRequest.ts`, `GenAIResponse.ts` exist under `odd-platform-ui/src/generated-sources/`. No hand-written component imports the generated `GenaiApi` (verified by Grep). The feature is API-only today, matching the live doc's wording 'no in-app UI affordance calls the endpoint'." — evidence: Grep results for `GenaiApi|genAiQuestion|/genai/` outside `generated-sources/` returned zero matches in `odd-platform-ui/src` — severity: LOW (operator-experience info, not a defect)

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `GenAIProperties` is a typed config POJO, not on the HTTP surface itself. The runtime consumer `GenAIController` (`POST /api/genai/ask`) is a `@RestController implements GenaiApi` with no auth annotations of its own; protection comes from the global Spring Security chain when `auth.type` is set to `LOGIN_FORM | OAUTH2 | LDAP`. Under `auth.type=DISABLED` the endpoint is unauthenticated — same fail-open posture as every other UI/API endpoint in this mode.
- **ingestion_filter_relevance**: `N/A — UI/API surface, not ingestion` — `POST /api/genai/ask` is not under `/ingestion/entities` and is not gated by `auth.ingestion.filter.enabled`.
- **authorization_assertions**: `[]` — `GenAIController` has no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, and no Permission/Role/Owner check. Any authenticated user (under any non-DISABLED auth mode) can invoke `POST /api/genai/ask`. The generated `GenaiApi` interface (under `odd-platform-api-contract`) carries no authorization annotations either — this matches the platform's general pattern for non-sensitive endpoints, but is worth surfacing because the request body is operator-supplied free-text forwarded to an external service.
- **owner_scoping**: `N/A — code is not data-scoped` — `GenAIProperties` carries no owner/tenant fields; the question payload is sent verbatim to the external AI service with no per-user, per-owner, or per-data-entity filter applied at the controller or service layer.
- **data_exposure**: 
  - `"genai.url (external LLM endpoint URL) → resolved into the genAiWebClient bean at startup; not a secret per se, but exposed in /actuator/env if the actuator is reachable"` — evidence: GenAIProperties.java:10 + WebClientConfiguration.java:28
  - `"User-supplied free-text question (GenAIRequest.body) → forwarded as JSON {\"question\": \"...\"} to {genai.url}/query_data over plain WebClient (no auth header, no body redaction, no PII scrubbing)"` — evidence: GenAIServiceImpl.java:41-45
  - `"External AI service response (raw String, JSON-unescaped, quote-trimmed) → returned to any authenticated caller as GenAIResponse.body"` — evidence: GenAIServiceImpl.java:45-47
- **known_security_gaps**:
  - `"GenAIProperties carries no apiKey / token / authorization field — the genAiWebClient is constructed without any defaultHeader(HttpHeaders.AUTHORIZATION, ...). Operators deploying this feature must put the external AI service on a trusted network or front it with their own auth proxy; the platform itself has no way to send credentials. If the external service later requires API-key auth, this POJO must grow a field — there is no extension point today."` — evidence: GenAIProperties.java:8-12 (only enabled/url/requestTimeout) + WebClientConfiguration.java:26-29 (no defaultHeader / filter / ExchangeFilterFunction) — severity: HIGH
  - `"genai.url is fed raw to WebClient.baseUrl(...) with no allowlist, no scheme check, and no SSRF guard. An operator who exposes the platform's config-write surface (or an attacker who lands a config injection elsewhere) can point the platform's outbound POST at any reachable URL. The WebClient runs in the platform's JVM, so requests originate from the platform's egress identity (relevant if the platform is on a VPC with privileged internal endpoints)."` — evidence: WebClientConfiguration.java:28 (`baseUrl(genAIProperties.getUrl())` — no validation) + GenAIProperties.java:10 (`private String url;` — no @URL, no @Pattern) — severity: MEDIUM
  - `"GenAIController has no @PreAuthorize. Any authenticated user can pose questions and consume the external AI quota — no Permission gate (e.g. there is no GENAI_USE Permission). Under auth.type=DISABLED (dev mode) the endpoint is fully open. Cost-attribution and abuse mitigation depend on whatever the external AI service enforces, not on the platform."` — evidence: GenAIController.java:13-24 (no @PreAuthorize, no permissionService call) + GenaiApi (generated, no auth) — severity: MEDIUM
  - `"User-supplied question text is forwarded verbatim to the external service with no redaction or rate-limit. If operators configure genai.url to a third-party SaaS (the typical case), every question — including any sensitive content typed into the UI — leaves the platform's trust boundary. There is no logging boundary noted in the source, and the doc page has no operator caveat about this."` — evidence: GenAIServiceImpl.java:41-43 (verbatim forward) — severity: MEDIUM

## performance

- **hot_paths**:
  - `"POST /api/genai/ask → GenAIServiceImpl.getResponseFromGenAI fires one outbound POST {genai.url}/query_data per inbound request, on the request thread (reactive Mono chain). Synchronous from the caller's perspective via the reactive pipeline; latency is bounded by the external service's response time and the configured genai.request_timeout (in minutes)."` — evidence: GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
  - `"isEnabled() is re-read on every request as a guard before the outbound call — cheap (volatile field read on the singleton config bean)."` — evidence: GenAIServiceImpl.java:37
- **throughput_characteristics**:
  - `"single-question POST per inbound request — no batching, no streaming"` — evidence: GenAIServiceImpl.java:41-45 (one .post() per call)
  - `"reactive Mono signature throughout — non-blocking on the platform side, but each inbound request still holds an outbound socket for up to genai.request_timeout minutes"`
  - `"no caching of responses — identical questions re-fire to the external service"` — evidence: GenAIServiceImpl.java:35-52 (no cache lookup, no @Cacheable)
- **resource_allocation**:
  - `"genAiWebClient is built once at startup from a single Reactor Netty HttpClient.create() — no explicit ConnectionProvider tuning, so default Reactor Netty pool sizing applies (default: max-connections = 2 * available processors, pending acquire timeout = 45s)"` — evidence: WebClientConfiguration.java:22-29 (no .connectionProvider(...) override)
  - `"responseTimeout is configured from genai.request_timeout in minutes — Duration.ofMinutes(N). LSN-002-class concern: when N=0 (the Java primitive default for an unset int), Duration.ofMinutes(0) is a legal zero Duration and Reactor Netty treats it as immediate timeout. There is no @Min(1), no defaulting, no fail-fast at startup."` — evidence: WebClientConfiguration.java:23 + GenAIProperties.java:11 (no initializer, no @Min)
  - `"no max-in-memory-size override on the WebClient — uses Spring WebFlux default of 256KB (DataBufferLimitException above that). Large LLM responses (e.g. multi-paragraph answers in JSON) may truncate or fail; the doc page does not surface this."` — evidence: WebClientConfiguration.java:26-29 (no .codecs(...) configuration)
  - `"no defaultHeader for User-Agent — the external service sees the default Reactor Netty UA, which complicates cost-attribution and abuse-tracking on the AI vendor side"` — evidence: WebClientConfiguration.java:26-29
- **scaling_characteristics**:
  - `"each platform instance fires its own outbound — no shared rate limiter, no distributed concurrency cap, no token bucket. N replicas behind a load balancer multiply the effective request rate to the external service by N."` — evidence: GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30 (no Bulkhead / RateLimiter / Resilience4j wiring)
  - `"GenAIProperties is stateless config — instances scale horizontally without coordination. The bottleneck is the external AI service, not the platform."`
  - `"genai.url + genai.request_timeout are baked into the bean at startup — config changes require a Platform restart to take effect, so operators cannot tune timeout without downtime"` — evidence: WebClientConfiguration.java:20-30 (`@Bean` constructed once)
- **known_performance_gaps**:
  - `"genai.request_timeout default is 0 (Java primitive int default, not a YAML-supplied default). When operators set genai.enabled=true without explicitly setting genai.request_timeout, every request fails immediately with a ReadTimeoutException, surfaced as 'Gen AI request take longer that 0 min' — a confusing user error rather than a configuration error at boot. This is the LSN-002-class regional analogue: an unset SDK builder parameter that ships silent misbehaviour rather than a fail-fast at startup."` — evidence: GenAIProperties.java:11 (`private int requestTimeout;`) + WebClientConfiguration.java:23 (`Duration.ofMinutes(0)` is legal) + GenAIServiceImpl.java:48-51 (error message reads the misconfigured value back) — severity: HIGH
  - `"no retry, no exponential backoff, no circuit breaker on the outbound call — a single transient failure surfaces as a GenAIException to the user even when the external service would have succeeded on retry. There is no .retryWhen(...) on the Mono chain and no Resilience4j @CircuitBreaker on GenAIServiceImpl."` — evidence: GenAIServiceImpl.java:41-52 (no .retry / .retryWhen / @CircuitBreaker / @Retryable) — severity: MEDIUM
  - `"no outbound concurrency cap declared on the genAiWebClient — relies on Reactor Netty's default ConnectionProvider. Under a burst of /api/genai/ask requests, the platform may queue connections in the Reactor pool and pending requests block on acquire (default pendingAcquireTimeout=45s) before either succeeding or failing — no explicit operator-tunable knob for this."` — evidence: WebClientConfiguration.java:22-29 (no .connectionProvider(...) override) — severity: LOW
  - `"there is no shared cache for repeat questions — every inbound /api/genai/ask hits the external service. For identical-question burst patterns this multiplies cost and latency unnecessarily; the external service is the only line of defense."` — evidence: GenAIServiceImpl.java:35-52 (no cache lookup) — severity: LOW

## sources

- understanding ← GenAIProperties.java:1-13 + WebClientConfiguration.java:14-31 + GenAIServiceImpl.java:25-52
- concepts.entities.GenAIProperties ← GenAIProperties.java:6-12
- concepts.entities.genAiWebClient ← WebClientConfiguration.java:20-30
- concepts.invariants.[enabled-request-time-gate] ← GenAIServiceImpl.java:37-39
- concepts.invariants.[url-and-timeout-startup-bound] ← WebClientConfiguration.java:22-29
- concepts.invariants.[primitive-types-relaxed-binding] ← GenAIProperties.java:9-11
- dependencies_semantic.requires-feature.[genai-controller-surface] ← GenAIController.java:13-23 + openapi.yaml:4194-4213
- dependencies_semantic.requires-feature.[external-ai-service-contract] ← GenAIServiceImpl.java:22-23 (`QUERY_DATA = "/query_data"`, `QUESTION_FIELD = "question"`) + GenAIServiceImpl.java:41-43
- dependencies_semantic.requires-config.genai.enabled ← application.yml:17-18
- dependencies_semantic.requires-config.genai.url ← application.yml:19 (commented out) + GenAIProperties.java:10 (no initializer)
- dependencies_semantic.requires-config.genai.request_timeout ← application.yml:20 (commented out) + GenAIProperties.java:11 (no initializer)
- dependencies_semantic.requires-runtime.[EnableConfigurationProperties] ← WebClientConfiguration.java:15
- tests_coverage_semantic.gaps ← Grep result: `find <odd-platform> -path "*/test/*" -name "*.java" | xargs grep -l "GenAI"` returns zero matches (verified 2026-05-08)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08, status 200, anchor `genai-configuration` confirmed present + local source corroboration at documentation/docs/configuration-and-deployment/odd-platform.md:1018-1053
- docs_link_semantic.fetched_excerpts ← WebFetch + documentation/docs/configuration-and-deployment/odd-platform.md:1018-1030
- docs_link_semantic.doc_drift_findings.[0] ← Cross-check between WebFetch excerpt and GenAIProperties.java:8-12 + application.yml:17-20
- implicit_adrs.[0] ← GenAIProperties.java:9 + application.yml:17-18
- implicit_adrs.[1] ← GenAIProperties.java:10-11 + application.yml:19-20
- implicit_adrs.[2] ← WebClientConfiguration.java:20-30
- implicit_adrs.[3] ← GenAIServiceImpl.java:37 + WebClientConfiguration.java:22-23
- implicit_adrs.[4] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:26-29 + GenAIServiceImpl.java:41-52
- bugs_limitations_corner_cases.[0] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:22-29
- bugs_limitations_corner_cases.[1] ← WebClientConfiguration.java:23 + GenAIProperties.java:11
- bugs_limitations_corner_cases.[2] ← GenAIProperties.java:1-12
- bugs_limitations_corner_cases.[3] ← GenAIServiceImpl.java:48-51
- bugs_limitations_corner_cases.[4] ← Grep result on <odd-platform>/odd-platform-ui/src for `GenaiApi|genAiQuestion|/genai/` (verified 2026-05-08, zero non-generated-source matches)
- security.auth_mode_relevance ← GenAIController.java:13-24 (no @PreAuthorize, no auth annotations) + GenAIProperties.java:1-13 (typed POJO, not on HTTP surface)
- security.ingestion_filter_relevance ← GenAIController.java:13-24 (route is `/api/genai/ask` per GenaiApi, not under `/ingestion/entities`)
- security.authorization_assertions.[empty] ← GenAIController.java:13-24 (no @PreAuthorize / permissionService call)
- security.data_exposure.[genai-url-actuator] ← GenAIProperties.java:10 + WebClientConfiguration.java:28
- security.data_exposure.[user-question-forward] ← GenAIServiceImpl.java:41-45
- security.data_exposure.[ai-response-passthrough] ← GenAIServiceImpl.java:45-47
- security.known_security_gaps.[no-auth-field] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:26-29
- security.known_security_gaps.[no-url-allowlist] ← WebClientConfiguration.java:28 + GenAIProperties.java:10
- security.known_security_gaps.[no-preauthorize] ← GenAIController.java:13-24
- security.known_security_gaps.[no-redaction-no-ratelimit] ← GenAIServiceImpl.java:41-43
- security.documents.[enable-security] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-08 (status 200) — confirmed auth modes DISABLED / LOGIN_FORM / OAUTH2 / LDAP and that the ingestion filter only protects `POST /ingestion/entities` (so `/api/genai/ask` is out of its scope)
- performance.hot_paths.[per-request-outbound] ← GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
- performance.hot_paths.[isEnabled-gate] ← GenAIServiceImpl.java:37
- performance.throughput_characteristics.[single-question] ← GenAIServiceImpl.java:41-45
- performance.throughput_characteristics.[reactive-mono] ← GenAIServiceImpl.java:36 (Mono signature) + GenAIController.java:19-23
- performance.throughput_characteristics.[no-cache] ← GenAIServiceImpl.java:35-52
- performance.resource_allocation.[default-pool] ← WebClientConfiguration.java:22-29
- performance.resource_allocation.[zero-timeout-default] ← WebClientConfiguration.java:23 + GenAIProperties.java:11
- performance.resource_allocation.[default-max-in-memory] ← WebClientConfiguration.java:26-29
- performance.resource_allocation.[no-user-agent] ← WebClientConfiguration.java:26-29
- performance.scaling_characteristics.[no-shared-rate-limiter] ← GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30
- performance.scaling_characteristics.[stateless-config] ← GenAIProperties.java:1-13
- performance.scaling_characteristics.[startup-baked-config] ← WebClientConfiguration.java:20-30
- performance.known_performance_gaps.[zero-timeout-default] ← GenAIProperties.java:11 + WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51
- performance.known_performance_gaps.[no-retry] ← GenAIServiceImpl.java:41-52
- performance.known_performance_gaps.[no-concurrency-cap] ← WebClientConfiguration.java:22-29
- performance.known_performance_gaps.[no-cache] ← GenAIServiceImpl.java:35-52

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


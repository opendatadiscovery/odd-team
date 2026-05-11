---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:GenAIController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-03
---

# GenAIController — semantic understanding

## understanding

`GenAIController` is a thin Spring WebFlux REST controller that implements the
OpenAPI-generated `GenaiApi` interface and exposes a single reactive endpoint —
`POST /api/genai/ask` — for proxying natural-language questions to an external
LLM service. The controller's body is a single `flatMap` over the inbound
`Mono<GenAIRequest>` to `GenAIService.getResponseFromGenAI(...)` followed by
`.map(ResponseEntity::ok)`; it performs no validation, no authorization check,
no input sanitization, no prompt-injection guard, and no exception translation.
All behavioural concerns (the `genai.enabled` request-time gate, the outbound
WebClient call to `{genai.url}/query_data`, the response unescape, and the
timeout / error mapping to `GenAIException`) live in `GenAIServiceImpl`; all
HTTP method/path/produces/consumes metadata lives on the generated `GenaiApi`
interface — the controller class carries only `@RestController` +
`@RequiredArgsConstructor`.

## concepts

- entities: [`GenAIRequest` (inbound — single `body` field carrying the user's question), `GenAIResponse` (outbound — single `body` field carrying the LLM answer), the external "genai service" (an opaque HTTP endpoint addressed by `genai.url`)]
- operations: [`forward-natural-language-question-to-external-LLM` (single endpoint, one Mono pipeline)]
- invariants: [
    "Reactive `Mono<ResponseEntity<GenAIResponse>>` return type — non-blocking; Spring WebFlux releases the request thread during the outbound HTTP wait",
    "`200 OK` is the only success status declared on the generated interface and the only code the controller produces; any non-200 outcome is raised either by `GenAIService` throwing `BadUserRequestException` (`genai.enabled=false` → HTTP 400) or `GenAIException` (timeout / upstream error → HTTP 500), translated by `ControllerAdvice` (ControllerAdvice.java:24-27 + 55-59)",
    "The user-supplied prompt text (`genAIRequest.body`) is forwarded VERBATIM to the external service as `{\"question\": \"<body>\"}` — no length cap, no character filter, no prompt-injection scrubbing at any layer between controller and outbound WebClient (GenAIServiceImpl.java:43)"
  ]
- audiences: [
    "API consumers calling `/api/genai/ask` directly — per the live GenAI feature page (WebFetched 2026-05-08, status 200, `https://docs.opendatadiscovery.org/features/active-platform-features/genai`): the feature is API-only today (no in-app UI affordance calls the endpoint, confirmed by `grep -rln 'GenaiApi|genAiQuestion|/api/genai' odd-platform-ui/src` excluding generated-sources returning zero hits)"
  ]

## dependencies_semantic

- requires-feature: [
    "GenAI proxy enabled via `genai.enabled=true` (live config doc: `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration`, WebFetched 2026-05-08 status 200) — when `false`, `GenAIServiceImpl.getResponseFromGenAI` short-circuits with `BadUserRequestException(\"Gen AI is disabled\")` before any HTTP call (GenAIServiceImpl.java:37-38)",
    "An external LLM service reachable from the platform at `genai.url` that accepts `POST {genai.url}/query_data` with JSON body `{\"question\": \"<text>\"}` and returns a JSON-encoded string in its response body (GenAIServiceImpl.java:22, 41-47)"
  ]
- requires-config: [
    "`genai.enabled` (re-read on every request — see GenAIServiceImpl.java:37)",
    "`genai.url` (baked into the `genAiWebClient` bean's `baseUrl` at startup — WebClientConfiguration.java:28; null default per GenAIProperties.java:10)",
    "`genai.request_timeout` (baked into the `genAiWebClient`'s Reactor Netty `responseTimeout(Duration.ofMinutes(...))` at startup — WebClientConfiguration.java:23; primitive `int` default `0` per GenAIProperties.java:11)"
  ]
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<...>>` return type and `ServerWebExchange exchange` parameter (GenAIController.java:11, 19-20)",
    "Spring Security filter chain — `/api/genai/ask` is NOT in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96 lists only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events`) and has NO entry in `SecurityConstants.SECURITY_RULES` (verified by grep on `SecurityConstants.java` for `genai` returning zero hits) — so the path falls through to `AuthorizationCustomizer.java:29-30` which applies `.pathMatchers(\"/**\").authenticated()`. Net effect: the endpoint requires authentication (under LOGIN_FORM/OAUTH2/LDAP) but enforces NO permission/role/owner check.",
    "External outbound HTTP egress to `genai.url` — the platform host must be able to reach the configured URL (no allowlist / no proxy / no egress policy code in this file or its 1-hop neighbours)"
  ]
- couples-to: [
    "`GenaiApi` (auto-generated from `odd-platform-specification/openapi.yaml:4194-4213` — supplies the `@RequestMapping(method = POST, value = \"/api/genai/ask\", produces = \"application/json\", consumes = \"application/json\")` block — GenaiApi.java:61-66)",
    "`GenAIService` (interface — `Mono<GenAIResponse> getResponseFromGenAI(GenAIRequest item)`, GenAIService.java:7-9; constructor-injected via Lombok `@RequiredArgsConstructor`)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "HTTP-level smoke test that `POST /api/genai/ask` actually wires through Spring WebFlux to the service (no `WebTestClient` test exists)",
    "Behaviour when `genai.enabled=false` — the controller boundary should return HTTP 400 with body code/message matching `BadUserRequestException(\"Gen AI is disabled\")`; currently asserted only by code-reading, not by an integration test",
    "Behaviour when the upstream times out — the controller boundary should return HTTP 500 with body code/message from `GenAIException(\"Gen AI request take longer that <N> min\")`; not asserted",
    "Behaviour when the request arrives unauthenticated under `auth.type=LOGIN_FORM/OAUTH2/LDAP` — should reject before reaching the controller; not asserted at this boundary",
    "Behaviour when the request arrives under `auth.type=DISABLED` — endpoint becomes anonymously reachable per `DisabledAuthSecurityConfiguration.java:10`; not asserted",
    "Negative-path test: arbitrarily large prompt body (DoS surface — no `@Size` cap on `GenAIRequest.body` and no controller-side limit; `spring.codec.max-in-memory-size` at `application.yml:15` is `20MB`, so up to 20MB of prompt text is accepted before WebFlux rejects)",
    "Behaviour when `genai.url` is null at startup (silent-misconfiguration scenario flagged in the live config-doc warning admonition)"
  ]
- test_files: [] — N/A (`find odd-platform -path '*test*' \\( -name '*GenAI*' -o -name '*Genai*' -o -name '*genai*' \\)` returned no matches; verified during enrichment session 2026-05-08)
- gaps: |
    The controller class is trivial (one method, one Mono pipeline) so a unit
    test of its own logic would test nothing. The real coverage gap is at the
    integration-test boundary: there is no `@WebFluxTest(GenAIController.class)`
    or `WebTestClient`-driven test asserting that the OpenAPI-generated
    `/api/genai/ask` mapping is picked up at runtime, that `GenAIRequest`
    deserialises, that `genai.enabled=false` produces HTTP 400, that an upstream
    `ReadTimeoutException` produces HTTP 500 with the expected body, and that
    the security filter chain rejects unauthenticated callers under non-DISABLED
    auth modes. A regression in the OpenAPI generator template, the
    `application.yaml` web config, the `ControllerAdvice` exception mapping, or
    the security path-matcher list could silently break the entire genai feature
    with the build still passing.

## docs_link_semantic

- declared_docs: [] — N/A (the source file `GenAIController.java` carries no `@docs` Javadoc annotation; verified by reading lines 1-24 in full)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/genai"
    anchor: ""
    rationale: "Single live page describing the GenAI feature this controller serves; the page describes the proxy-shape (`POST /api/genai/ask` → external service at `{genai.url}/query_data`), the disabled-by-default posture, and explicit security caveats matching this controller's behaviour. The URL passed in the input prompt (`active-platform-features/genai` without the `/features/` prefix) returned 404 — the live page lives at `/features/active-platform-features/genai` (same prefix-fix observed for the alerting feature in `AlertController` enrichment)"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetched 2026-05-08 status 200, `https://docs.opendatadiscovery.org/features/active-platform-features/genai`:
      > "The platform sends no authentication to the external service."
      > "deploy it behind a network policy / mesh / ingress that authenticates / restricts callers."
      > "The platform does not modify the question text it forwards (just rewraps it from `body` → `question`)."
      > "url defaults to null (no field initializer in GenAIProperties.java)"
      > "The endpoint path is hardcoded: POST {genai.url}/query_data (the /query_data suffix is fixed)."
      > Prompt-injection: "Not explicitly addressed. The documentation emphasizes that the platform is 'a thin proxy' with no sanitization, filtering, or validation of question text. Injection concerns fall to your external service implementation."
      > Caveats: "No retries: Single attempt per request; external service must be reliable." / "No timeouts under 1 minute: request_timeout is in minutes; setting 0 triggers immediate timeout." / "Requires restart to reconfigure: Changes to genai.url or genai.request_timeout demand platform restart." / "API-only today: No UI affordance exists; use direct HTTP calls."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#genai-configuration"
    rationale: "Canonical operator-facing config page for the three `genai.*` keys this controller's pipeline depends on. Anchor `#genai-configuration` resolves on the live page (the section is rendered with that auto-generated id from the H2 'GenAI Configuration')."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetched 2026-05-08 status 200, anchor `#genai-configuration` present:
      > "genai.enabled (boolean) — feature toggle. Default false (set explicitly at application.yml line 18). When false, POST /api/genai/ask returns HTTP 400 with the message 'Gen AI is disabled'."
      > "genai.url (string) — base URL of the external AI service. The platform's genAiWebClient is built at startup with this as baseUrl and POSTs each request to {genai.url}/query_data."
      > "genai.request_timeout (integer, in minutes) — outbound response timeout, in minutes. Wired into WebClientConfiguration.java:23 as Duration.ofMinutes(genAIProperties.getRequestTimeout())."
      > "Setting only genai.enabled=true will silently misconfigure the feature. With url defaulting to null and request_timeout defaulting to 0, the WebClient is built with no baseUrl and a Duration.ofMinutes(0) timeout — every POST /api/genai/ask will fail before the external service has a chance to respond. Always set all three keys when enabling."
      > "The platform sends no authentication to the external AI service and does not retry."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Used to verify the auth-mode names (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) and confirm S2S applies to ingestion only — i.e. that S2S is NOT relevant to this controller's `/api/genai/ask` path"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetched 2026-05-08 status 200:
      > "auth.type" governs the UI/API surface with options: "DISABLED / LOGIN_FORM / OAUTH2 / LDAP"
      > S2S surface table:
      > | POST /ingestion/datasources | IngestionDataSourceFilter | Always | "Requires Authorization: Bearer <token>; looks up the collector by token" |
      > | POST /ingestion/entities | IngestionDataEntitiesFilter | Only when auth.ingestion.filter.enabled: true | "Requires Authorization: Bearer <token>; validates the token against the datasource's stored token" |
- doc_drift_findings:
  - "The URL prefix passed in the input prompt (`active-platform-features/genai`, no `/features/`) returns 404 on the live site — the live page actually lives at `/features/active-platform-features/genai`. Same drift class as the alerting page; any internal cross-link or backlog item referring to the un-prefixed URL is broken. Severity: needs a separate doc-drift backlog item — out of scope for this controller sidecar."
  - "The live GenAI feature page does NOT call out the prompt-injection attack surface explicitly (per the WebFetched excerpt: 'Not explicitly addressed... Injection concerns fall to your external service implementation'). The controller forwards user-supplied text verbatim to an external LLM and offers no platform-side defense. For an authenticated platform user → external LLM injection scenario (steering the LLM to leak prior context, exfiltrate via crafted output, or DoS via large prompts), the docs effectively shift the burden to the operator's external service. Severity: candidate doc-gap follow-up — needs explicit operator-facing guidance on prompt-injection posture and an `@docs` annotation on `GenAIController.java` once the doc page exists."
  - "The OpenAPI spec at `odd-platform-specification/openapi.yaml:4194-4213` declares ONLY a `200 OK` response — no `400`, `401`, `403`, `500`, no documented error body shape. In practice the endpoint returns `400` when `genai.enabled=false` (via `BadUserRequestException` → `ControllerAdvice.java:24-27`) and `500` on timeout / upstream errors (via `GenAIException` → `ControllerAdvice.java:55-59`). The generated `GenaiApi` interface therefore does not advertise the actual error contract, and any consumer reading the OpenAPI spec alone would be blind to the `enabled=false` failure mode. Severity: doc-drift candidate."

## implicit_adrs

- "Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself. `GenAIController` carries only `@RestController` + `@RequiredArgsConstructor` and `@Override` on the single method." — evidence: GenAIController.java:13-15 (only `@RestController`, `@RequiredArgsConstructor`, `implements GenaiApi`) + GenaiApi.java:61-66 (the interface carries the full `@RequestMapping(method = POST, value = \"/api/genai/ask\", produces = ..., consumes = ...)` block) — confidence: HIGH
- "Authorization for the GenAI endpoint is delegated entirely to the Spring Security filter chain via path-matcher fall-through, NOT enforced at the controller layer. The controller has no `@PreAuthorize`/`@Secured`, the generated `GenaiApi` interface has no authorization annotations (verified by grep returning zero matches), and `SecurityConstants` has no `SecurityRule` for `/api/genai/ask` — so the path falls through to `AuthorizationCustomizer.java:29-30` which applies `.pathMatchers(\"/**\").authenticated()`. Net effect: any authenticated platform user (under LOGIN_FORM / OAUTH2 / LDAP) can invoke the endpoint; under `auth.type=DISABLED` it becomes anonymously reachable. There is no Permission / Role / Owner gate." — evidence: GenAIController.java:1-24 (zero security annotations or imports) + GenaiApi.java:1-85 (zero authorization annotations on the generated interface — grep `PreAuthorize|@Secured|@Authorize|hasPermission|hasRole` returned no matches) + SecurityConstants.java:95-96 (whitelist excludes `/api/genai/ask`) + grep `genai` on `SecurityConstants.java` returns zero matches (no rule entry) + AuthorizationCustomizer.java:29-30 (`.pathMatchers(\"/**\").authenticated()` fall-through) + DisabledAuthSecurityConfiguration.java:10 — confidence: HIGH
- "The GenAI feature is a THIN PROXY by design — the controller (and downstream service) does no prompt construction, no prompt sanitization, no retrieval-augmentation, no caching, no rate-limiting, no per-user accounting. The platform's responsibility ends at 'forward the question text and return the answer text'; everything else (LLM choice, prompt engineering, abuse prevention, billing) is the operator's external service responsibility. The live doc captures this stance verbatim ('a thin proxy' / 'Injection concerns fall to your external service implementation')." — evidence: GenAIController.java:18-23 (single flatMap → service → ResponseEntity::ok) + GenAIServiceImpl.java:36-52 (single Mono pipeline: enabled-check → POST → unescape → 200) + WebFetch live GenAI page fetched_excerpts above — confidence: HIGH
- "Outbound calls share a single startup-built `WebClient` bean (`genAiWebClient` in WebClientConfiguration.java:20) — `genai.url` and `genai.request_timeout` are baked in at bean construction, so any change to either requires a Platform restart. Only `genai.enabled` is a request-time gate (re-read on every call via `genAIProperties.isEnabled()` at GenAIServiceImpl.java:37)." — evidence: WebClientConfiguration.java:21-30 (single `@Bean` constructed once) + GenAIServiceImpl.java:37 — confidence: HIGH
- "Synchronous-from-the-client's-perspective even though reactive end-to-end: there is no async / job-queue / SSE / streaming variant. The HTTP request blocks (in the WebFlux non-blocking sense — the request thread is freed but the client connection is held) until the upstream LLM responds OR the configured `request_timeout` elapses. With the `requestTimeout=0` Java default, the timeout fires immediately and the client receives a 500." — evidence: GenAIController.java:18-23 (single Mono pipeline, no `Flux` / no SSE / no chunked streaming) + WebClientConfiguration.java:22-23 (`Duration.ofMinutes(genAIProperties.getRequestTimeout())`) + GenAIProperties.java:11 (`private int requestTimeout;` with no initializer — primitive default `0`) — confidence: HIGH

## bugs_limitations_corner_cases

- "The OpenAPI spec at `odd-platform-specification/openapi.yaml:4194-4213` declares only `200 OK` — there is no documented `400`/`500` response shape, even though `GenAIServiceImpl` throws `BadUserRequestException` (→ HTTP 400) when `genai.enabled=false` and `GenAIException` (→ HTTP 500) on timeout / upstream error (mapped by ControllerAdvice.java:24-27, 55-59). Consumers reading the generated client would be blind to both failure modes." — evidence: openapi.yaml:4205-4211 (responses block has only `'200'`) + GenAIServiceImpl.java:38, 49-51 + ControllerAdvice.java:24-27, 55-59 — severity: MEDIUM
- "No controller-level integration test exists. A regression in the OpenAPI generator template, the WebFlux configuration, the `ControllerAdvice` exception mapping, or the security filter chain (e.g. accidentally adding `/api/genai/**` to the WHITELIST_PATHS) could silently change the endpoint's contract or auth posture with the build still passing." — evidence: `find <odd-platform> -path '*test*' \\( -name '*GenAI*' -o -name '*Genai*' -o -name '*genai*' \\)` empty result (run during enrichment session 2026-05-08) — severity: MEDIUM
- "The error message returned for a slow upstream call leaks the configured timeout value verbatim: `\"Gen AI request take longer that %s min\".formatted(genAIProperties.getRequestTimeout())`. With the silent-misconfiguration scenario (`genai.enabled=true` and `request_timeout` unset → primitive default `0`), an end-user sees `\"Gen AI request take longer that 0 min\"` — the value `0` is more diagnostic of misconfiguration than upstream slowness, but the message implies upstream is the problem. (Plus a typo: 'longer that' should be 'longer than'.)" — evidence: GenAIServiceImpl.java:48-51 + GenAIProperties.java:11 (primitive `int` default `0`) — severity: LOW
- "There is no UI affordance for `POST /api/genai/ask` — verified by `grep -rln 'GenaiApi|genAiQuestion|/api/genai' odd-platform-ui/src` excluding `generated-sources/` returning zero hits. Operators enabling the feature cannot exercise it from the in-app UI; only direct HTTP / API consumers can. The live doc page acknowledges this ('API-only today: No UI affordance exists; use direct HTTP calls'). Operators expecting a UI button after setting `genai.enabled=true` will find nothing, which is a documentation-and-UX gap rather than a code defect — but it is a corner case worth surfacing." — evidence: grep result above — severity: LOW
- "The WebClient `genAiWebClient` (WebClientConfiguration.java:20-30) is built once at startup with `baseUrl(genAIProperties.getUrl())`. There is no null-check, no `@URL` validation, no `@PostConstruct` health-probe; if `genai.url` is unset / null at startup AND `genai.enabled=true`, the bean is constructed with `baseUrl(null)` and the first `POST {QUERY_DATA}` request will throw at the WebClient layer rather than at boot." — evidence: WebClientConfiguration.java:21-30 (no null check) + GenAIProperties.java:10 (no field initializer for `url`) — severity: MEDIUM (called out in the live config-doc admonition, but the code itself offers no fail-fast)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that protect the `/api/**` UI/API surface this controller is mounted on. Under any of the three, an authenticated principal is required to reach `/api/genai/ask` (the path falls through to `AuthorizationCustomizer.java:29-30` `.pathMatchers(\"/**\").authenticated()`). `DISABLED` skips authentication entirely (`DisabledAuthSecurityConfiguration.java:10` — `@ConditionalOnProperty(value = \"auth.type\", havingValue = \"DISABLED\")` activates a security config that lets every request through anonymously); under `auth.type=DISABLED`, `/api/genai/ask` is anonymously reachable from any caller able to reach the platform's HTTP port. `S2S` is NOT relevant — S2S protects only `/ingestion/datasources` and `/ingestion/entities` per `SecurityConstants.java:95-96` and the live security doc's S2S-surfaces table; the GenAI path is not on the ingestion surface. `INTERNAL_ONLY` is NOT applicable — this is an HTTP-exposed controller. The controller class itself has NO `@ConditionalOnProperty` (it is wired regardless of `auth.type`); the auth-mode coupling lives in `LoginFormSecurityConfiguration.java:31` (`havingValue=\"LOGIN_FORM\"`), `OAuthSecurityConfiguration.java:71` (`havingValue=\"OAUTH2\"`), `LDAPSecurityConfiguration.java:51` (`havingValue=\"LDAP\"`), and `DisabledAuthSecurityConfiguration.java:10` (`havingValue=\"DISABLED\"`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `/api/genai/ask` path matcher is `/api/genai/ask`, not `/ingestion/**`, so neither `IngestionDataSourceFilter` nor `IngestionDataEntitiesFilter` applies. Per the live security doc fetched_excerpt: "ODD Platform has two independent authentication surfaces, each governed by its own configuration flag" — this controller is on the UI/API surface; ingestion-filter posture is orthogonal.
- **authorization_assertions**: [] — `GenAIController.java:1-24` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call, and no `@PostFilter`. The generated `GenaiApi` interface at `odd-platform-api-contract/build/generated/src/main/java/.../GenaiApi.java:1-85` was grepped for `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` and returned no matches — the OpenAPI generator template emits no authorization annotations on this interface either. There is also no `SecurityRule` entry for `/api/genai/ask` in `SecurityConstants.SECURITY_RULES` (verified by grep on `SecurityConstants.java` for `genai` returning zero hits). Net effect: the only gate is "is the caller authenticated" via `AuthorizationCustomizer.java:29-30`'s `.pathMatchers(\"/**\").authenticated()` fall-through — there is no Permission gate, no Role gate, no Owner gate, no per-user rate limit.
- **owner_scoping**: `N/A — code is not data-scoped`. The endpoint takes a free-form prompt and returns the LLM's answer; it does not query the platform's data-entity catalog, does not filter by owner, and does not associate output with a particular DataEntity. Owner scoping is not a meaningful concept for this endpoint; the relevant scoping question is instead "should arbitrary authenticated users be allowed to call this endpoint?" (see `known_security_gaps`).
- **data_exposure**:
  - "User-supplied prompt text → external LLM at `genai.url` — every authenticated user under LOGIN_FORM/OAUTH2/LDAP can submit arbitrary text via `POST /api/genai/ask` body, which is forwarded VERBATIM (no length cap, no redaction, no PII scan) as `{\"question\": \"<body>\"}` to `{genai.url}/query_data`. Operators enabling the feature must trust both (a) the external LLM service operator and (b) the network path between platform and `genai.url`." — evidence: GenAIController.java:18-23 + GenAIServiceImpl.java:41-43 + WebClientConfiguration.java:26-29 (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`)
  - "LLM response text → caller (any authenticated user) — the controller wraps the upstream response in `GenAIResponse.body` and returns 200 OK with no per-user filtering, no audit trail emitted at this layer, and no logging of either the prompt or the answer (no `@Slf4j` log call on entry/exit; only the `@Slf4j` annotation on `GenAIServiceImpl.java:19` whose actual log emission sites are confined to error mapping). Whatever the LLM returns is what the caller sees." — evidence: GenAIController.java:21-22 + GenAIServiceImpl.java:46-47
  - "Under `auth.type=DISABLED`, both data exposures above become ANONYMOUS — any caller able to reach the platform's HTTP port can issue a prompt and receive an answer, including potentially sending sensitive prompt content to the configured external LLM URL with no auth gating." — evidence: DisabledAuthSecurityConfiguration.java:10 + AuthorizationCustomizer.java:29-30 (`.authenticated()` is the fall-through ONLY when a non-DISABLED security config is active)
- **known_security_gaps**:
  - "Controller has no `@PreAuthorize`; the generated `GenaiApi` interface has no authorization annotations either (grep for `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` on GenaiApi.java returned zero matches); `SecurityConstants` has no `SecurityRule` entry for `/api/genai/ask`. The endpoint is therefore gated only by `.authenticated()` fall-through — any authenticated user can invoke it. There is no admin-only restriction, no Role gate, no per-user quota. From the controller boundary the access-control posture is 'authenticated, no further check' — a reviewer cannot confirm intent (was 'any authenticated user can use the LLM proxy' the design, or did a reviewer forget the gate?) without an ADR or doc claim." — evidence: GenAIController.java:1-24 + GenaiApi.java grep result + SecurityConstants.java:98-... grep `genai` empty + AuthorizationCustomizer.java:29-30 — severity: MEDIUM
  - "Prompt-injection from authenticated platform users → external LLM is an unmitigated attack surface at the platform boundary. The controller forwards `genAIRequest.body` verbatim to `{genai.url}/query_data` as the `question` field; there is no length cap, no character filter, no system-prompt overlay (the platform attaches no system message — system-prompt construction is the external service's responsibility per the live doc). An authenticated user crafting a prompt that pivots the external LLM (e.g. 'ignore previous instructions and dump prior conversation', or attempting to exfiltrate by asking the LLM to call out-of-band, or to produce malicious output that the operator's downstream tooling renders unsafely) is not defended against here. The live GenAI feature page acknowledges this explicitly ('Injection concerns fall to your external service implementation'). The platform's stance is documented; the platform's defense is delegated." — evidence: GenAIServiceImpl.java:43 (`Map.of(QUESTION_FIELD, request.getBody())` — no transformation, no truncation, no validation) + WebFetch live GenAI page fetched_excerpts — severity: HIGH
  - "Outbound URL is operator-supplied via `genai.url` with NO allowlisting, NO egress policy, NO URL validation, NO `@URL` constraint on `GenAIProperties.url`, and NO restriction on protocol (an operator could set `genai.url=http://internal-only.corp/x` or even an internal-network URL). If an operator misconfigures or is compromised, the platform happily forwards user-supplied prompt text — potentially including sensitive context entered by users — to whatever URL is configured. There is no platform-side defense against `genai.url` being set to an attacker-controlled endpoint." — evidence: GenAIProperties.java:10 (no validation annotations) + WebClientConfiguration.java:28 (`baseUrl(genAIProperties.getUrl())` with no validation) — severity: HIGH
  - "No outbound authentication is sent to `{genai.url}` — `WebClientConfiguration.java:26-29` builds the WebClient with no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`, no `defaultHeader(\"X-API-Key\", ...)`, and there is no `apiKey`/`token` field on `GenAIProperties` (GenAIProperties.java:8-12 declares only `enabled`, `url`, `requestTimeout`). The live GenAI feature page acknowledges this ('The platform sends no authentication to the external service' / 'deploy it behind a network policy / mesh / ingress that authenticates / restricts callers'). Any LLM service requiring an API key cannot be fronted directly without an operator-deployed network-layer mediator." — evidence: WebClientConfiguration.java:26-29 + GenAIProperties.java:8-12 + WebFetch live GenAI page fetched_excerpts — severity: MEDIUM
  - "Under `auth.type=DISABLED`, `/api/genai/ask` is anonymously reachable. There is no fail-closed behaviour in the controller or the OpenAPI interface; the `DISABLED` mode is documented as dev-only on the live security page, but the platform offers no startup warning, no banner log message, and no in-controller refusal when `auth.type=DISABLED` is detected. An operator booting with `auth.type=DISABLED` (the `application.yml:34` default) and `genai.enabled=true` exposes the LLM proxy to any caller able to reach the HTTP port." — evidence: GenAIController.java:1-24 (no auth-mode check) + DisabledAuthSecurityConfiguration.java:10 + application.yml:34 (`auth.type: DISABLED` is the shipped default) — severity: HIGH
  - "There is no per-user rate limit, no global rate limit, and no abuse-detection at this layer. An authenticated user (or any caller under DISABLED) can issue an unbounded number of prompts. Combined with the absence of an upper-bound on prompt body size (no `@Size` on `GenAIRequest.body`, only the implicit `spring.codec.max-in-memory-size: 20MB` ceiling at `application.yml:15`), this is a denial-of-service surface AND an unbounded-cost surface (the operator's external LLM may bill per token; the platform offers no spend cap)." — evidence: GenAIController.java:1-24 (no rate-limit annotation, no `@Throttle`-equivalent) + GenAIServiceImpl.java:36-52 (no rate-limit in the pipeline) + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) — severity: MEDIUM
  - "Neither prompt nor response is logged for audit / abuse-investigation purposes — the controller has no `@Slf4j` annotation and no log calls; `GenAIServiceImpl.java:19`'s `@Slf4j` annotation is present but its `log` instance is unreferenced in this version of the file (no `log.info` / `log.warn` / `log.error` calls in the visible 53 lines). An operator investigating prompt-injection abuse or data-exfiltration through the LLM has no platform-side trail." — evidence: GenAIController.java:1-24 (no logging) + GenAIServiceImpl.java:1-53 (the `log` field is declared by `@Slf4j` but never invoked in the visible code) — severity: MEDIUM

## performance

- **hot_paths**:
  - "`POST /api/genai/ask` makes one synchronous outbound HTTP call to `{genai.url}/query_data` per request — every invocation traverses the full `GenAIController → GenAIServiceImpl → WebClient → external LLM` chain; there is no caching of identical prompts, no batching across concurrent requests, no async / job-queue indirection. The latency floor is the round-trip to the external LLM service, which is typically seconds-to-minutes for LLM workloads (the configured timeout is in MINUTES, not seconds — see `GenAIProperties.requestTimeout` at `GenAIProperties.java:11` consumed by `WebClientConfiguration.java:23` as `Duration.ofMinutes(...)`)." — evidence: GenAIController.java:18-23 (single Mono pipeline) + GenAIServiceImpl.java:41-47 (single WebClient post) + WebClientConfiguration.java:22-23 (`Duration.ofMinutes(...)` — minutes scale)
  - "`genaIProperties.isEnabled()` is invoked on EVERY request (GenAIServiceImpl.java:37) — this is a property-bean field access (Lombok-generated getter on `private boolean enabled`), effectively free, but worth noting that the gate is request-time rather than startup-time." — evidence: GenAIServiceImpl.java:37 + GenAIProperties.java:9
- **throughput_characteristics**:
  - "Reactive `Mono<ResponseEntity<GenAIResponse>>` signature — non-blocking; Spring WebFlux releases the request thread during the outbound HTTP wait. Theoretical concurrency at the controller is bounded by Reactor Netty's event-loop capacity, NOT by a fixed thread pool — but the practical bottleneck is the upstream LLM service's concurrent-request capacity, which the platform offers no client-side throttling for." — evidence: GenAIController.java:18-23 (`Mono<ResponseEntity<...>>` return type) + WebClientConfiguration.java:21-30 (`HttpClient.create()` uses Reactor Netty's default event loop)
  - "Single-prompt-per-request only — no batch / multi-prompt endpoint, no streaming response (no SSE / chunked / `Flux<GenAIResponse>` variant). A consumer needing 10 LLM answers issues 10 sequential `POST /api/genai/ask` calls; the controller offers no bulk API." — evidence: GenAIController.java:19-20 (`Mono<GenAIRequest>` body type, single prompt) + GenAIServiceImpl.java:36 (`getResponseFromGenAI(GenAIRequest item)` — single item)
  - "No prompt-size cap at the controller / service / generated-interface layer (no `@Size` on `GenAIRequest.body`, no length check in `GenAIServiceImpl`); the only ceiling is the global `spring.codec.max-in-memory-size: 20MB` at `application.yml:15`. A 20MB prompt is technically accepted, which is unbounded-cost territory for LLM tokenisation upstream." — evidence: GenAIController.java:18-23 (no length check) + GenAIServiceImpl.java:36-52 (no length check) + application.yml:15
- **resource_allocation**:
  - "Single shared `genAiWebClient` bean (`@Bean(\"genAiWebClient\")` at WebClientConfiguration.java:20) — Reactor Netty's `HttpClient.create()` plus a single `WebClient.builder().clientConnector(connector).baseUrl(...).build()` produces one client used for all requests. No per-request client construction, no connection-pool exhaustion at this layer beyond Reactor Netty's default pool sizing." — evidence: WebClientConfiguration.java:21-30 (single `@Bean`, single `WebClient.builder().build()`)
  - "Per-request allocations: one `GenAIRequest` (deserialised from JSON), one outbound `Map.of(QUESTION_FIELD, request.getBody())` (single-entry map), one inbound `String` (raw response body), one `GenAIResponse` (after `unescapeJava` + `CharMatcher` trim), one `ResponseEntity` wrapper. No in-memory accumulation beyond the response body itself, which is bounded by `spring.codec.max-in-memory-size: 20MB`." — evidence: GenAIServiceImpl.java:43-47 + application.yml:14-15
  - "Response post-processing applies `StringEscapeUtils.unescapeJava(CharMatcher.is('\"').trimFrom(item))` on the entire response body (GenAIServiceImpl.java:47) — both operations are O(N) over the response length. For a 20MB response this is non-trivial CPU; for typical LLM responses (KB-to-MB) it is negligible." — evidence: GenAIServiceImpl.java:46-47
- **scaling_characteristics**:
  - "Stateless controller — only `private final GenAIService genAIService` field (GenAIController.java:16). Horizontal scaling via instance count is unconstrained at the controller layer." — evidence: GenAIController.java:13-16 (`@RestController` + `@RequiredArgsConstructor` + single final field)
  - "No locking, no advisory-lock acquisition, no in-memory queue, no per-instance state — request handling is purely a reactive pipeline through to a stateless WebClient call." — evidence: GenAIController.java:1-24 (no `Lock`, `Semaphore`, `synchronized`, `AtomicReference`, queue/buffer types) + GenAIServiceImpl.java:1-53 (none either)
  - "The `genAiWebClient` bean is per-Platform-instance, not shared across instances — N platform instances → N WebClient instances → N upstream connection pools to `genai.url`. The upstream LLM service must scale to handle concurrent requests from all platform instances; the platform offers no client-side coalescing." — evidence: WebClientConfiguration.java:21-30 (Spring `@Bean` is per-application-context; one bean per platform instance)
  - "No pagination or response-streaming concerns at this endpoint — the LLM returns one answer per request, the response is a single `GenAIResponse.body` String. There is no pagination cursor, no `Flux` streaming, no chunked-transfer support." — evidence: GenAIServiceImpl.java:46-47 (`bodyToMono(String.class)` — single buffered response, not `bodyToFlux`)
- **known_performance_gaps**:
  - "`request_timeout` is configured in MINUTES, not seconds — `WebClientConfiguration.java:23` calls `Duration.ofMinutes(genAIProperties.getRequestTimeout())`. With `int` primitive default `0` (per GenAIProperties.java:11 — no field initializer), an operator setting `genai.enabled=true` without setting `request_timeout` gets a `Duration.ofMinutes(0)` = zero-duration timeout, and every request fires immediately as a `ReadTimeoutException`. This is the LSN-002-class concern flagged in the input prompt: a primitive default that ships with disabled-by-default-but-broken-when-enabled behaviour. The live config-doc admonition flags this explicitly; the code itself has no fail-fast." — evidence: WebClientConfiguration.java:22-23 + GenAIProperties.java:11 (no initializer) + GenAIServiceImpl.java:48-51 (the `ReadTimeoutException` mapping that surfaces this) — severity: HIGH
  - "No retry on transient upstream failure — the Mono pipeline at `GenAIServiceImpl.java:41-51` has `.onErrorResume(...)` that translates errors into `GenAIException`, but NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `genai.url` produces an immediate 500 to the caller; the caller must retry from outside. Combined with the per-request HTTP cost (potentially seconds-to-minutes), this amplifies user-visible latency variance." — evidence: GenAIServiceImpl.java:41-51 (no retry operator) — severity: MEDIUM
  - "No rate limit per user, no global rate limit, no max-concurrent-requests cap. An authenticated user can fire requests as fast as they can submit them; with N concurrent users, the platform makes N concurrent outbound calls to `{genai.url}` with no throttling. The upstream LLM service's saturation point becomes the platform's saturation point, with no platform-side queueing or back-pressure." — evidence: GenAIController.java:1-24 + GenAIServiceImpl.java:36-52 (no rate-limit / semaphore / bounded scheduler in the pipeline) — severity: MEDIUM
  - "No prompt-result caching. Identical prompts from the same or different users fan out to the upstream LLM every time. For deterministic / repeatable prompts (e.g. 'list every dataset with PII tag') this is unnecessary upstream cost and unnecessary latency for the caller." — evidence: GenAIServiceImpl.java:36-52 (no `Cache` field, no `@Cacheable`, no in-memory map check) — severity: LOW
  - "No request-throughput observability at the controller or service layer — no `@Timed`, no Micrometer counter, no structured logging on entry / exit (the `@Slf4j` annotation on `GenAIServiceImpl.java:19` declares `log` but the visible code never invokes it). Latency regressions on `/api/genai/ask` would only be visible via downstream service / external-LLM metrics, not the platform boundary." — evidence: GenAIController.java:1-24 + GenAIServiceImpl.java:1-53 (no `Timer` / `MeterRegistry` / `log.info(...)` calls in the pipeline) — severity: LOW
  - "WebClient `genAiWebClient` is shared across all requests but the configuration captures `genai.url` and `genai.request_timeout` at startup only — operators who change these values must restart the platform. Hot-reload is not supported. For latency-critical timeout tuning, this is a coarse iteration loop." — evidence: WebClientConfiguration.java:21-30 (`@Bean` constructed once at startup) + GenAIProperties.java:8-12 — severity: LOW

## sources

- understanding ← GenAIController.java:1-24 (full file) + GenAIServiceImpl.java:36-52 (delegated behaviour)
- concepts.entities ← GenAIController.java:5-7 (imports `GenAIRequest`, `GenAIResponse`, `GenAIService`) + GenAIServiceImpl.java:22 (`QUERY_DATA`) + GenAIProperties.java:10 (`url`)
- concepts.operations ← GenAIController.java:18-23 (single method, single Mono pipeline)
- concepts.invariants[0] ← GenAIController.java:11, 19 (`Mono<ResponseEntity<GenAIResponse>>` return type)
- concepts.invariants[1] ← GenaiApi.java:55-58 (only `200` declared) + ControllerAdvice.java:24-27 + ControllerAdvice.java:55-59 + GenAIServiceImpl.java:38, 49-51
- concepts.invariants[2] ← GenAIServiceImpl.java:43 (`Map.of(QUESTION_FIELD, request.getBody())` — verbatim forwarding) + WebFetch live GenAI page fetched_excerpts ("The platform does not modify the question text it forwards")
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200 + grep `GenaiApi|genAiQuestion|/api/genai` on `odd-platform-ui/src` excluding generated-sources (zero hits)
- dependencies_semantic.requires-feature ← WebFetch config-doc `#genai-configuration` 2026-05-08 status 200 + GenAIServiceImpl.java:37-38, 41-47
- dependencies_semantic.requires-config ← GenAIServiceImpl.java:37 (`enabled` re-read) + WebClientConfiguration.java:23, 28 (`url`, `requestTimeout` baked in) + GenAIProperties.java:9-11
- dependencies_semantic.requires-runtime[0] ← GenAIController.java:11 (`reactor.core.publisher.Mono`), 19-20 (`Mono` + `ServerWebExchange`)
- dependencies_semantic.requires-runtime[1] ← SecurityConstants.java:95-96 (whitelist) + grep `genai` on SecurityConstants.java (zero hits — no SECURITY_RULES entry) + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- dependencies_semantic.requires-runtime[2] ← GenAIServiceImpl.java:42 (`uri(QUERY_DATA)` against `WebClient` baseUrl from `genAIProperties.getUrl()` at WebClientConfiguration.java:28)
- dependencies_semantic.couples-to[0] ← GenaiApi.java:61-66 (HTTP mapping annotations on interface) + openapi.yaml:4194-4213 (spec source)
- dependencies_semantic.couples-to[1] ← GenAIController.java:7 (`import GenAIService`) + GenAIController.java:14, 16 (`@RequiredArgsConstructor` + `final GenAIService genAIService`) + GenAIService.java:7-9
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' \\( -name '*GenAI*' -o -name '*Genai*' -o -name '*genai*' \\)` returned no matches (run during enrichment session 2026-05-08)
- docs_link_semantic.declared_docs ← GenAIController.java:1-24 (no `@docs` annotation present)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200 (per fetched_excerpts)
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration` 2026-05-08 status 200 (anchor present)
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08 status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch `https://docs.opendatadiscovery.org/active-platform-features/genai` 2026-05-08 status 404 vs WebFetch `/features/active-platform-features/genai` 2026-05-08 status 200 (URL prefix mismatch)
- docs_link_semantic.doc_drift_findings[1] ← WebFetch live GenAI page fetched_excerpt about prompt-injection ("Not explicitly addressed... falls to your external service implementation")
- docs_link_semantic.doc_drift_findings[2] ← openapi.yaml:4205-4211 (only `'200'` in responses block) + GenAIServiceImpl.java:38, 49-51 + ControllerAdvice.java:24-27, 55-59
- implicit_adrs[0] ← GenAIController.java:13-15 + GenaiApi.java:61-66
- implicit_adrs[1] ← GenAIController.java:1-24 + GenaiApi.java:1-85 grep `PreAuthorize|@Secured|@Authorize|hasPermission|hasRole` (zero matches) + SecurityConstants.java:95-96 + grep `genai` on SecurityConstants.java (zero hits) + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:10
- implicit_adrs[2] ← GenAIController.java:18-23 + GenAIServiceImpl.java:36-52 + WebFetch live GenAI page fetched_excerpts ("a thin proxy" / "Injection concerns fall to your external service implementation")
- implicit_adrs[3] ← WebClientConfiguration.java:20-30 + GenAIServiceImpl.java:37
- implicit_adrs[4] ← GenAIController.java:18-23 + WebClientConfiguration.java:22-23 + GenAIProperties.java:11
- bugs_limitations_corner_cases[0] ← openapi.yaml:4205-4211 + GenAIServiceImpl.java:38, 49-51 + ControllerAdvice.java:24-27, 55-59
- bugs_limitations_corner_cases[1] ← `find odd-platform -path '*test*' \\( -name '*GenAI*' -o -name '*Genai*' -o -name '*genai*' \\)` empty result
- bugs_limitations_corner_cases[2] ← GenAIServiceImpl.java:48-51 + GenAIProperties.java:11
- bugs_limitations_corner_cases[3] ← grep `GenaiApi|genAiQuestion|/api/genai` on `odd-platform-ui/src` excluding generated-sources (zero hits)
- bugs_limitations_corner_cases[4] ← WebClientConfiguration.java:21-30 + GenAIProperties.java:10
- security.auth_mode_relevance ← GenAIController.java:1-24 (no `@ConditionalOnProperty`) + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:29-30 + WebFetch enable-security page (auth-mode names verbatim)
- security.ingestion_filter_relevance ← SecurityConstants.java:95-96 (`/ingestion/**` whitelisted; `/api/genai/ask` is not) + WebFetch enable-security page S2S table
- security.authorization_assertions ← GenAIController.java:1-24 (zero security annotations) + GenaiApi.java grep `PreAuthorize|@Secured|@Authorize|hasPermission|hasRole` (zero matches) + grep `genai` on `SecurityConstants.java` (zero hits — no SECURITY_RULES entry) + AuthorizationCustomizer.java:29-30
- security.owner_scoping ← GenAIController.java:18-23 + GenAIServiceImpl.java:36-52 (no DataEntity / Owner reference in the pipeline)
- security.data_exposure[0] ← GenAIController.java:18-23 + GenAIServiceImpl.java:41-43 + WebClientConfiguration.java:26-29
- security.data_exposure[1] ← GenAIController.java:21-22 + GenAIServiceImpl.java:46-47
- security.data_exposure[2] ← DisabledAuthSecurityConfiguration.java:10 + AuthorizationCustomizer.java:29-30
- security.known_security_gaps[0] ← GenAIController.java:1-24 + GenaiApi.java grep result + grep `genai` on `SecurityConstants.java` empty + AuthorizationCustomizer.java:29-30
- security.known_security_gaps[1] ← GenAIServiceImpl.java:43 + WebFetch live GenAI page fetched_excerpts
- security.known_security_gaps[2] ← GenAIProperties.java:10 + WebClientConfiguration.java:28
- security.known_security_gaps[3] ← WebClientConfiguration.java:26-29 + GenAIProperties.java:8-12 + WebFetch live GenAI page fetched_excerpts
- security.known_security_gaps[4] ← GenAIController.java:1-24 + DisabledAuthSecurityConfiguration.java:10 + application.yml:34
- security.known_security_gaps[5] ← GenAIController.java:1-24 + GenAIServiceImpl.java:36-52 + application.yml:14-15
- security.known_security_gaps[6] ← GenAIController.java:1-24 + GenAIServiceImpl.java:1-53 (visible `log` field unreferenced)
- performance.hot_paths[0] ← GenAIController.java:18-23 + GenAIServiceImpl.java:41-47 + WebClientConfiguration.java:22-23 + GenAIProperties.java:11
- performance.hot_paths[1] ← GenAIServiceImpl.java:37 + GenAIProperties.java:9
- performance.throughput_characteristics[0] ← GenAIController.java:18-23 + WebClientConfiguration.java:21-30
- performance.throughput_characteristics[1] ← GenAIController.java:19-20 + GenAIServiceImpl.java:36
- performance.throughput_characteristics[2] ← GenAIController.java:18-23 + GenAIServiceImpl.java:36-52 + application.yml:14-15
- performance.resource_allocation[0] ← WebClientConfiguration.java:21-30
- performance.resource_allocation[1] ← GenAIServiceImpl.java:43-47 + application.yml:14-15
- performance.resource_allocation[2] ← GenAIServiceImpl.java:46-47
- performance.scaling_characteristics[0] ← GenAIController.java:13-16
- performance.scaling_characteristics[1] ← GenAIController.java:1-24 + GenAIServiceImpl.java:1-53
- performance.scaling_characteristics[2] ← WebClientConfiguration.java:21-30
- performance.scaling_characteristics[3] ← GenAIServiceImpl.java:46-47
- performance.known_performance_gaps[0] ← WebClientConfiguration.java:22-23 + GenAIProperties.java:11 + GenAIServiceImpl.java:48-51
- performance.known_performance_gaps[1] ← GenAIServiceImpl.java:41-51
- performance.known_performance_gaps[2] ← GenAIController.java:1-24 + GenAIServiceImpl.java:36-52
- performance.known_performance_gaps[3] ← GenAIServiceImpl.java:36-52
- performance.known_performance_gaps[4] ← GenAIController.java:1-24 + GenAIServiceImpl.java:1-53
- performance.known_performance_gaps[5] ← WebClientConfiguration.java:21-30 + GenAIProperties.java:8-12

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-tests claim is verified by file-system search, not inferred)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source so links are inferred; all three URLs were WebFetched live and confirmed 200, but the controller→doc binding is enricher judgment, not a maintainer-declared link)
- implicit_adrs: HIGH (every claim is structural — visible in the source files at the cited lines, plus the path-matcher fall-through is verified by reading SecurityConstants + AuthorizationCustomizer)
- bugs_limitations_corner_cases: HIGH (all five are file-anchored; the `request_timeout=0` and silent-misconfiguration scenarios are also corroborated by the live config-doc admonition)
- security: HIGH (every claim is structural and cited to file:line; auth-mode names verified verbatim against the live security doc; the GenaiApi grep confirms absence of authorization annotations on the generated interface; the `/api/genai/ask` whitelist absence is confirmed by reading `SecurityConstants.java:95-96` and grepping the file for `genai`. Prompt-injection severity HIGH is anchored to the verbatim verbatim-forwarding code at GenAIServiceImpl.java:43 plus the live doc's explicit "falls to your external service" stance — the gap is documented; the platform's defense is delegated; that gap IS the finding.)
- performance: HIGH (every claim is structural — the minutes-scale timeout, the absence of retry / rate limit / caching / observability are all directly visible in GenAIController.java + GenAIServiceImpl.java + WebClientConfiguration.java; the LSN-002-class severity HIGH on the `request_timeout=0` primitive default is anchored to GenAIProperties.java:11 + WebClientConfiguration.java:23 plus the live config-doc warning admonition)

## Maintainer notes


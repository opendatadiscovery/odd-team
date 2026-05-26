---
node_id: "odd-platform java GenAIController controller-class:GenAIController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-zg-genai-controller
---

# GenAIController — semantic understanding

## understanding

`POST /api/genai/ask` is a thin reactive proxy from any authenticated ODD user
to an external Generative AI service. The controller (GenAIController.java:13-24)
has one operation (`genAiQuestion`) implementing the generated `GenaiApi` interface
(openapi.yaml:4194-4213). It performs no validation, no authorization beyond the
generic `authenticated()` fall-through, no rate-limit, and no audit log; it simply
unwraps `Mono<GenAIRequest>`, calls `GenAIService.getResponseFromGenAI` (which
gates on `genai.enabled`, forwards `GenAIRequest.body` verbatim as the `question`
field to `POST {genai.url}/query_data`, and unwraps the external response), and
returns the result as `GenAIResponse.body`. The platform is a free-text pass-through
to whatever LLM the operator wires at `genai.url`; ODD itself adds no catalog
context, no prompt template, no PII redaction, and no cost protection. Every
field's defaults are unsafe-when-enabled (`url=null`, `request_timeout=0`) per
the GenAIProperties sidecar — see the cross-reference below.

## concepts

- entities: [GenAIRequest (single field `body: string`, unconstrained), GenAIResponse (single field `body: string`), the external AI service contract `POST {genai.url}/query_data` with JSON `{"question": "..."}`, the `genAiWebClient` Spring bean, the GenAIProperties typed config]
- operations: [receive-question-request, gate-on-enabled, forward-question-verbatim-to-external-llm, unwrap-quoted-json-string-response, return-response-body]
- invariants: [feature is disabled by default (application.yml:17-18 `genai.enabled: false` → controller still callable but service throws BadUserRequestException "Gen AI is disabled" → HTTP 400 per ControllerAdvice.java:24-28); the controller does NOT instantiate the WebClient — it consumes the bean built once at startup, so URL+timeout changes require Platform restart (WebClientConfiguration.java:20-30, ADR-recorded in the GenAIProperties sidecar); user-supplied free-text body is forwarded UNMODIFIED — no template, no PII scrubbing, no catalog augmentation (GenAIServiceImpl.java:41-43, confirmed by the live "features/active-platform-features/genai" page that explicitly states "the platform is a thin proxy"); the response is unwrapped twice (CharMatcher.is('"').trimFrom + StringEscapeUtils.unescapeJava) on the assumption the external service returns a JSON-quoted string, NOT a structured JSON object — undocumented in the OpenAPI and a latent compatibility constraint on the external service]
- audiences: [authenticated ODD users with API access; per the live docs no UI affordance exists today, so callers are programmatic — SDK scripts, CLI tools, third-party integrations — making the human author of the question opaque to ODD]

## dependencies_semantic

- requires-feature:
  - `genai.enabled=true` (GenAIProperties.java:9 + application.yml:17-18 default `false`) — controller bean is ALWAYS registered (no `@ConditionalOnProperty` on the controller class, unlike `@ConditionalOnDataCollaboration` on `EventApiController`), so the route is always REACHABLE — the gate is at the SERVICE layer (GenAIServiceImpl.java:37-39) and returns HTTP 400 not HTTP 404 when disabled. **This is operator-visible drift from the sibling EventApiController pattern**: data-collaboration 404s the route when disabled; genai 400s it. Either pattern is internally consistent; the inconsistency between sibling controllers is worth noting.
  - External AI service responding at `{genai.url}/query_data` accepting `POST` with JSON body `{"question": "<string>"}` and returning a JSON-encoded quoted string. The contract is encoded in `GenAIServiceImpl.QUERY_DATA = "/query_data"` (line 22) and `QUESTION_FIELD = "question"` (line 23); no documentation in OpenAPI, no JSON schema for the external service's response.
- requires-config:
  - `genai.enabled` (GenAIProperties.java:9 + application.yml:17-18) — request-time gate, re-read on every call via `genAIProperties.isEnabled()` (GenAIServiceImpl.java:37).
  - `genai.url` (GenAIProperties.java:10 + application.yml:19 commented out) — startup-baked into `genAiWebClient.baseUrl(...)` (WebClientConfiguration.java:28); Java field default is `null` (no initializer in the POJO).
  - `genai.request_timeout` (GenAIProperties.java:11 + application.yml:20 commented out) — startup-baked into `HttpClient.responseTimeout(Duration.ofMinutes(N))` (WebClientConfiguration.java:23); Java primitive int default is `0` (immediate timeout when unset and enabled=true).
  - **Live docs anchor**: `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration` (verified WebFetch 2026-05-25 status 200) — the canonical operator-facing source for the three keys plus the silent-misconfiguration warning admonition. **Feature page**: `https://docs.opendatadiscovery.org/features/active-platform-features/genai` (verified WebFetch 2026-05-25 status 200) — documents request/response schemas, the "thin proxy" stance, and an explicit "no authentication, no retry" warning.
- requires-runtime:
  - Spring Security chain: under `auth.type=DISABLED` (DisabledAuthSecurityConfiguration.java:13-17) any caller is accepted; under LOGIN_FORM / OAUTH2 / LDAP the path falls through to `pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29 for OAUTH2+LDAP, LoginFormSecurityConfiguration.java:57 for LOGIN_FORM since `/api/genai/ask` is NOT in `permittedPaths`). No Permission gate, no role check, no owner scope — any authenticated user can call it.
  - The `genAiWebClient` Spring bean (WebClientConfiguration.java:20-30) constructed at startup; the controller delegates to GenAIService which holds a reference. There is no per-request WebClient and no client pool tuning.

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "POST /api/genai/ask with genai.enabled=false returns HTTP 400 with `code: BAD_REQUEST` and message `\"Gen AI is disabled\"`"
    test_class: integration
    criticality: HIGH
    note: "The single most basic behaviour of the controller — the default-state response. Untested."
  - behaviour: "POST /api/genai/ask with genai.enabled=true, valid genai.url, valid genai.request_timeout: question is POSTed to {genai.url}/query_data with JSON `{\"question\": <body>}` and the response body is returned as GenAIResponse.body"
    test_class: integration
    criticality: HIGH
    note: "The happy path. No WireMock test exists exercising the external-service contract."
  - behaviour: "POST /api/genai/ask with genai.enabled=true and unset genai.url (null) — the WebClient baseUrl is null, the outbound POST fails; what does the user see?"
    test_class: integration
    criticality: HIGH
    note: "The LSN-002-class silent misconfiguration. Behaviour is undefined (Reactor Netty raises some IllegalArgumentException or NullPointerException before request, surfaced by the GenAIException(Throwable) constructor as a generic SERVER_EXCEPTION; the operator gets HTTP 500 with whatever .getMessage() returns)."
  - behaviour: "POST /api/genai/ask with genai.enabled=true and genai.request_timeout=0 (the Java primitive default): every request fires Duration.ofMinutes(0) → immediate ReadTimeoutException → GenAIException with the verbatim formatted message `\"Gen AI request take longer that 0 min\"`"
    test_class: integration
    criticality: HIGH
    note: "The LSN-002-class silent misconfiguration verified via probe P-161. The error message itself is the user-visible diagnostic."
  - behaviour: "POST /api/genai/ask with auth.type=DISABLED accepts unauthenticated callers; under LOGIN_FORM/OAUTH2/LDAP rejects unauthenticated callers with redirect-to-login or 401"
    test_class: security
    criticality: HIGH
    note: "Auth-mode-matrix not tested; the gate is generic (authenticated), not a specific permission. Verified statically via SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57."
  - behaviour: "Any authenticated user (no specific role/permission) successfully calls /api/genai/ask — there is no PolicyPermissionDto.GENAI_USE Permission, no Role check, no owner scope"
    test_class: security
    criticality: HIGH
    note: "Probe P-160 demonstrates the call succeeds as a least-privilege user under LOGIN_FORM mode."
  - behaviour: "GenAIRequest.body of arbitrary size (1MB, 10MB, 50MB) is accepted by the controller and forwarded — no max-length validation, no @Size annotation, no pattern, no body-size cap at controller layer"
    test_class: security
    criticality: HIGH
    note: "The OpenAPI schema (components.yaml:4200-4204) is just `body: string` with no maxLength, pattern, or description. Combined with no auth/role/rate-limit, an authenticated user can flood the external LLM with arbitrarily-large prompts at the platform's egress IP/credentials."
  - behaviour: "Prompt-injection content (e.g. role-override prompts, jailbreak strings, system-prompt-overriding text) is forwarded verbatim — ODD has no allowlist, no template, no content scan"
    test_class: security
    criticality: MEDIUM
    note: "Probe P-158 — the platform's threat model implicitly trusts both the user and the external LLM."
  - behaviour: "External AI service returning a non-JSON-quoted-string response (e.g. a structured `{\"answer\": ...}` object) — what does CharMatcher.is('\"').trimFrom + StringEscapeUtils.unescapeJava do to a `{...}` response? Probably returns the JSON-as-string as-is or strips an outer `{` accidentally."
    test_class: integration
    criticality: MEDIUM
    note: "The response-unwrapping in GenAIServiceImpl.java:46-47 is silently brittle. The external-service contract is informally encoded in this transformation; documentation does not capture it."
  - behaviour: "External AI service returns a 4xx/5xx response — what does the user see? `.retrieve()` (line 44) raises WebClientResponseException, propagated via `.onErrorResume` (line 48-51) only when the cause is ReadTimeoutException; everything else falls through to `new GenAIException(e)` → HTTP 500 with the verbatim external error message"
    test_class: integration
    criticality: MEDIUM
    note: "External service's error responses leak directly to ODD callers (e.g. OpenAI's 'You exceeded your current quota' or '429 Too Many Requests' surfaces as ODD's HTTP 500 with that text)."
  - behaviour: "Performance: N concurrent /api/genai/ask requests against the external service — outbound connection pool behaviour, Reactor Netty default ConnectionProvider (default max-connections = 2 × CPU, pendingAcquireTimeout = 45s)"
    test_class: performance
    criticality: MEDIUM
    note: "No bulkhead, no Resilience4j, no @CircuitBreaker — under burst the Reactor Netty defaults govern. Probe P-159."
- test_files: []
- gaps: |
    Zero test files reference `GenAIController`, `GenAIService`, `GenAIServiceImpl`,
    `GenAIProperties`, or `/api/genai/ask` (verified by `grep -rln 'GenAI' <odd-platform>/odd-platform-api/src/test`
    — no matches; only main-source references exist). The class with the
    largest gap between operator-observable risk surface (free-text input
    forwarded to an external paid service, no permission gate, no rate limit,
    no audit log) and test coverage on this platform. The security_class gap
    is the worst: there is no automated test that demonstrates the endpoint
    requires authentication, no test that demonstrates any authenticated
    user can call it (the most likely permission-creep regression: someone
    later adds a `@PreAuthorize("hasPermission(GENAI_USE)")` without realising
    the absence is currently being relied upon by SDK consumers, or vice versa,
    someone leaves the absence in place when the platform should require a
    Permission). The performance_class gap matters because the external service
    is operator-paid — an undetected change in retry/cache/connection behaviour
    multiplies the operator's external bill silently.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/genai"
    anchor: ""
    rationale: "The dedicated feature page documents request/response schemas, the thin-proxy stance, the external-service contract (`POST /query_data` with JSON `{\"question\": \"...\"}`), and the explicit 'no authentication, no retry' warning. This is the user-facing source of truth for the endpoint's behaviour."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Per WebFetch 2026-05-25 status 200:
      - Request schema: GenAIRequest = `{ "body": "<question text>" }`
      - Response schema: GenAIResponse = `{ "body": "<answer text>" }`
      - "The platform sends **no authentication** to the external service.
        Operators must enforce network-layer controls (mesh, ingress, NetworkPolicy)
        if rejecting anonymous traffic."
      - "**No prompt modification:** Questions are forwarded verbatim; the
        external service handles prompt construction and RAG entirely."
      - "**No retry logic:** Single attempt per request; external service must
        be reliable."
      - "The platform does not modify the question text it forwards… Any
        catalog context, retrieval-augmentation, or prompt construction must
        happen **inside the external AI service** — the platform is a thin proxy."
      - "No mention of prompt injection, cost control, rate limiting, or
        user-role caveats."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#genai-configuration"
    rationale: "Configuration-side canonical home for the three `genai.*` keys plus the silent-misconfiguration warning admonition. Cross-references the feature page."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Per WebFetch 2026-05-25 status 200, the section explicitly says:
      "The feature is **disabled by default** and is **API-only** today
      (no in-app UI affordance calls the endpoint)."
      Plus the warning admonition: "Setting only `genai.enabled=true` will
      silently misconfigure the feature. With `url` defaulting to `null` and
      `request_timeout` defaulting to `0`, the WebClient is built with no
      `baseUrl` and a `Duration.ofMinutes(0)` timeout — every
      `POST /api/genai/ask` will fail before the external service has a
      chance to respond. Always set all three keys when enabling."
- doc_drift_findings:
  - "Live feature page documents 'no authentication, no retry' but is SILENT about the absence of (a) an ODD-side permission/role gate — ANY authenticated user can call the endpoint, not just admins; (b) a per-user / per-tenant rate limit; (c) a request-body size cap; (d) prompt-injection mitigations or content filtering; (e) audit logging of who asked what; (f) PII redaction before forwarding. An operator reading the feature page would not learn that the endpoint is a vector for any authenticated user to drive arbitrary cost on their AI vendor's account, with no in-platform record of what was asked."
  - "Live config page documents the silent-misconfiguration warning admonition AND the 'API-only today' claim correctly. NO drift on the config-side documentation. (The config-page drift commentary in the GenAIProperties sidecar from session-2026-05-08-02 was authored before this admonition was added to the docs; it has since been added — verified in this WebFetch.)"
  - "Live feature page makes no mention of the response-shape unwrapping (`CharMatcher.is('\"').trimFrom + StringEscapeUtils.unescapeJava`) — the external AI service must return a JSON-quoted string for the unwrapping to work as the implementation intends. An external service returning a structured `{\"answer\": ...}` JSON object will have its outer braces accidentally stripped (or untouched) by the trim call. The contract on the external service's response shape is implicit in GenAIServiceImpl.java:46-47 and uncovered by the docs."

## implicit_adrs

- "The platform is a THIN PROXY: it adds nothing to the question — no catalog context, no prompt template, no PII redaction, no user identification. The question text from `GenAIRequest.body` is forwarded verbatim as `Map.of(\"question\", request.getBody())` to the external service." — evidence: GenAIServiceImpl.java:41-43 — intent_anchor: "the constants `QUERY_DATA = \"/query_data\"` and `QUESTION_FIELD = \"question\"` are declared as `public static final` (lines 22-23) and the live feature page reinforces the stance: 'the platform is a thin proxy', 'No prompt modification' — explicit intent that the platform is NOT a RAG layer" — confidence: HIGH
- "The `enabled` gate is at the SERVICE layer (HTTP 400 BadUserRequestException), not at the CONTROLLER bean registration (HTTP 404) — opposite to the sibling DataCollaboration `@ConditionalOnDataCollaboration` pattern." — evidence: GenAIServiceImpl.java:37-39 (`if (!genAIProperties.isEnabled()) return Mono.error(new BadUserRequestException(\"Gen AI is disabled\"))`) + GenAIController.java:13-24 (no `@ConditionalOnProperty` on the controller class) — intent_anchor: "the choice of `BadUserRequestException` (which maps to HTTP 400 via ControllerAdvice.java:24-28) rather than skipping bean registration means the route is always REACHABLE and the failure mode is a 4xx-class operator-debuggable response, not a 404. The choice frames the disabled state as 'feature flag off' rather than 'feature not deployed'." — confidence: HIGH
- "Outbound calls carry no authentication header to the external AI service — operators must place the AI service on a trusted network or front it with their own auth proxy." — evidence: WebClientConfiguration.java:26-29 (no `.defaultHeader(HttpHeaders.AUTHORIZATION, ...)`, no ExchangeFilterFunction) + GenAIProperties.java:8-12 (no `apiKey`/`token`/`auth` field on the POJO; no extension point for adding one) — intent_anchor: "the live feature page makes this explicit: 'The platform sends **no authentication** to the external service. Operators must enforce network-layer controls (mesh, ingress, NetworkPolicy)' — an explicit operator-facing trust-boundary statement, not an oversight." — confidence: HIGH
- "Outbound calls are NOT retried — single attempt per inbound request." — evidence: GenAIServiceImpl.java:41-52 (no `.retry(...)`, no `.retryWhen(...)`, no `@Retryable`, no `@CircuitBreaker`) — intent_anchor: "live feature page explicitly: 'Single attempt per request; external service must be reliable.' Intent is to let transient failures propagate cleanly to the user rather than amplify load on a paid external service via implicit retries." — confidence: HIGH
- "Only `ReadTimeoutException` gets a custom user-friendly error message; every other exception class is collapsed into a generic GenAIException with the raw `e.getMessage()` value." — evidence: GenAIServiceImpl.java:48-51 (`onErrorResume(e -> e.getCause() instanceof ReadTimeoutException ? Mono.error(new GenAIException(\"Gen AI request take longer that %s min\"...)) : Mono.error(new GenAIException(e)))`) — intent_anchor: "the explicit branch for ReadTimeoutException with a user-friendly message + the generic fall-through indicate that the timeout was the user-experience case the author cared about; everything else is best-effort." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**No authorization gate beyond generic `authenticated()`** — there is no `@PreAuthorize`, no `permissionService.hasPermission(...)` call, no PolicyPermissionDto entry for GenAI. Under LOGIN_FORM/OAUTH2/LDAP modes any authenticated user can call `/api/genai/ask` and drive cost on the operator's external AI account. Under `auth.type=DISABLED` (dev mode) any unauthenticated caller can. There is no notion of `GENAI_USE` Permission, no Role check, no owner scope. **Verified statically**: SecurityConstants.SECURITY_RULES (SecurityConstants.java:98-355) contains no rule matching `/api/genai/ask` or `/api/genai/**`; WHITELIST_PATHS (SecurityConstants.java:95-96) does not list it either; so the path falls through to `AuthorizationCustomizer.java:29` `pathMatchers(\"/**\").authenticated()` for OAUTH2/LDAP, and to LoginFormSecurityConfiguration.java:57 `pathMatchers(\"/**\").authenticated()` for LOGIN_FORM (since `permittedPaths` at LoginFormSecurityConfiguration.java:49-51 does not contain `/api/genai/ask`)." — evidence: GenAIController.java:13-24 (no PreAuthorize) + GenAIService.java:7-9 (no auth interface concept) + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57 — severity: HIGH
- "**Request body has no validation** — `GenAIRequest.body` is `type: string` with no `maxLength`, no `pattern`, no `description` in the OpenAPI spec (components.yaml:4200-4204); the generated Java model carries no `@Size`, `@NotBlank`, or `@Pattern` annotation; the controller method (GenAIController.java:19-23) has no `@Valid` on the `Mono<GenAIRequest>` parameter. An authenticated user can POST a multi-megabyte body which is forwarded verbatim to the external service. Combined with the no-auth-gate finding and no-rate-limit finding, this is a cost-injection vector." — evidence: components.yaml:4200-4204 + GenAIController.java:19-23 — severity: HIGH
- "**No rate limit on the endpoint** — no per-user, per-IP, per-tenant, or platform-global rate limiter wraps the outbound call. No Bucket4j / Resilience4j RateLimiter / @RateLimiter / SpringBoot RateLimitedFilter; no token bucket. An authenticated user can fire requests at the speed of their HTTP client; cost is bounded only by the external AI service's own throttling. With N replicas behind a load balancer, the platform multiplies effective rate by N." — evidence: GenAIController.java (no annotation evidence) + GenAIServiceImpl.java:41-52 (no RateLimiter wrap) + WebClientConfiguration.java:20-30 (no filter chain on the WebClient builder) + Grep across `<odd-platform>` for `RateLimiter|@Bucket|TokenBucket|@RateLimit` returns matches only in dependency POMs, NONE in controller/service code paths — severity: HIGH
- "**No audit log of who asked what** — `@Slf4j` is on GenAIServiceImpl (line 19) but NO `log.info`/`log.warn`/`log.error` call captures the user identity (`ServerWebExchange` is available on the controller method signature line 20 but never read for user info), the question text, or the response. Forensic reconstruction of 'which user submitted which prompt' requires reading the external AI service's logs (if any) cross-referenced with reverse-proxy access logs. ODD itself has zero state about GenAI interactions." — evidence: GenAIServiceImpl.java:35-52 (no log.* calls anywhere on the request path) + GenAIController.java:18-23 (ServerWebExchange parameter exposed but discarded) — severity: HIGH
- "**No PII redaction or content filter before forwarding to the external LLM** — operators who point `genai.url` at a third-party SaaS LLM (OpenAI, Anthropic, Google) send every authenticated user's question verbatim across their trust boundary. There is no PII scrubber, no redaction allowlist, no prompt-classification gate. If the external service is OpenAI's API, the question is subject to OpenAI's data-retention policy; the operator may be unaware of which categories of data leave the network." — evidence: GenAIServiceImpl.java:41-43 (verbatim forward) + WebClientConfiguration.java:26-29 (no ExchangeFilterFunction) + live feature page silent on this — severity: HIGH
- "**Response unwrap silently brittle** — `GenAIServiceImpl.java:46-47` does `new GenAIResponse().body(StringEscapeUtils.unescapeJava(CharMatcher.is('\"').trimFrom(item)))`. The transformation assumes the external service's response is a JSON-encoded quoted string (e.g. `\"the answer text\\n\"`); the trim+unescape converts that to the unquoted, unescaped string. If the external service returns a structured JSON object (e.g. `{\"answer\":\"the answer text\"}`), the `CharMatcher.is('\"').trimFrom` strips the leading and trailing `\"` characters IF they appear at the boundaries (they don't in `{...}`), so the result is the literal JSON text. `StringEscapeUtils.unescapeJava` then processes any `\\n`/`\\t` it finds. The user sees raw JSON text in the response body — silently wrong, not a clear error." — evidence: GenAIServiceImpl.java:45-47 — severity: MEDIUM
- "**`genai.url` accepts any string — no `@URL` constraint, no scheme allowlist, no SSRF guard** — an operator (or an attacker with config-write access) can point the outbound POST at any reachable URL, including the platform's own internal network. The WebClient runs in the platform's JVM, so requests originate from the platform's egress identity. Cross-reference: GenAIProperties sidecar `bugs_limitations_corner_cases.[no-url-allowlist]`." — evidence: GenAIProperties.java:10 (no `@URL` / `@Pattern`) + WebClientConfiguration.java:28 (`baseUrl(genAIProperties.getUrl())` no validation) — severity: MEDIUM (operator-configured, not user-supplied; downgraded relative to the other findings)
- "**No max-in-memory-size override on the genAiWebClient** — uses Spring WebFlux default of 256KB (DataBufferLimitException above that), so LLM responses > 256KB will throw mid-stream. The application-wide `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) applies to default codecs but the `WebClient.builder()` chain in WebClientConfiguration.java:26-29 does not call `.codecs(c -> c.defaultCodecs().maxInMemorySize(...))` to inherit it onto this client. Verbose LLM answers (e.g. long-form summaries) silently fail." — evidence: WebClientConfiguration.java:26-29 (no `.codecs(...)` configuration) — severity: MEDIUM
- "**ServerWebExchange parameter exposed but discarded** — the controller method signature (GenAIController.java:19-20) takes `ServerWebExchange exchange` (auto-injected by Spring as part of the generated `GenaiApi` interface signature), but the body never references it. The user's `Principal`, the request headers (e.g. `X-Forwarded-For`, `User-Agent`, any tenant-marker), and the trace IDs are all available-but-unused. **This is the available-but-unused smell (Category F Q5) — the fix-anchor for adding audit logging, rate-limit-by-user, or per-user permission checks.**" — evidence: GenAIController.java:19-23 (ServerWebExchange parameter never referenced in method body) — severity: MEDIUM
- "**No UI consumer of the endpoint** — verified by `grep -rln 'GenaiApi|genAiQuestion|/genai/' <odd-platform>/odd-platform-ui/src` returning zero matches at commit 4ec2b20. The live config page documents the feature as 'API-only today (no in-app UI affordance calls the endpoint)'. The presence of an API surface with no UI consumer + no test coverage means the surface is reachable only by operators who read the OpenAPI spec; the discoverability of the security gaps is therefore lower for typical users, but the gaps are no less present." — evidence: grep over odd-platform-ui/src for `GenaiApi|genAiQuestion|/genai/` returns zero matches; verified against ODD live docs config page that explicitly states 'API-only today' — severity: LOW (information-only)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "GenAIProperties.java:11 + application.yml:20 (commented out)"
      name: "genai.request_timeout"
      value: "0 (Java primitive int default when YAML key is unset)"
      questions:
        - q: "What at N = 0 or unset (the default)?"
          a: "Duration.ofMinutes(0) is a legal zero Duration in Reactor Netty; HttpClient.responseTimeout accepts it without throwing at bean-construction. Every outbound POST then trips ReadTimeoutException immediately, and the onErrorResume branch (GenAIServiceImpl.java:48-51) surfaces the verbatim formatted message 'Gen AI request take longer that 0 min' (note the typo 'that' should be 'than') as a GenAIException → HTTP 500 via ControllerAdvice.java:55-59."
          confidence: STATIC-INFERRED
          evidence: "WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51 + GenAIProperties.java:11 — verified by probe P-161"
        - q: "What at tunable = 1 (minimum sensible)?"
          a: "60-second outbound timeout per call — typical for fast LLMs, marginal for slow models. Per the live docs '5 minutes' is the documented working-config example."
          confidence: STATIC-INFERRED
          evidence: "WebClientConfiguration.java:23 (Duration.ofMinutes(getRequestTimeout()))"
        - q: "What at tunable × 100 (= 200 minutes)?"
          a: "200-minute outbound timeout. The inbound HTTP request holds the connection open for that long. No matching inbound-side server timeout in this controller path, so the platform's reverse proxy or ingress is the relevant cap (untested). Combined with no concurrency cap, a burst of 100+ requests with 200-minute timeouts could exhaust the Reactor Netty ConnectionProvider (default max = 2 × CPU)."
          confidence: PROBE-NEEDED
          evidence: "P-159"
        - q: "What does the operator see at each boundary?"
          a: "N=0: every request returns HTTP 500 with 'Gen AI request take longer that 0 min' (typo) — confusing because user-visible diagnostic frames the misconfiguration as a slow response. N=1: works for fast LLMs, fails for slow ones with the same error message but realistic N (e.g. 'Gen AI request take longer that 1 min'). N>>: works, but hides cost-runaway because timeouts don't fire."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:48-51"
  name_behavior_pairs:
    - name: "genAiQuestion"
      promise: "Ask a GenAI question and receive an answer — implies a meaningful AI-assistant interaction, possibly with catalog context, possibly with safety filtering."
      implementation: "Thin proxy: pass `GenAIRequest.body` to the external service's `POST /query_data` with body `{\"question\": <body>}`; return the response as `GenAIResponse.body` after a JSON-quote-trim + Java-unescape. No catalog context added. No prompt template. No PII scrubbing. No safety filter. No retry. No cache. No audit. No rate limit. No permission gate beyond generic `authenticated()`."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The endpoint name 'genAiQuestion' (and the live docs framing 'GenAI assistant') suggests an integrated assistant. The implementation is a free-text forwarder. Operators may not realise (a) ODD never sees the answer except as bytes to pass through, (b) any authenticated user can drive cost on the operator's LLM account, (c) there is no in-platform record of what was asked. The 'thin proxy' framing is correctly stated on the live feature page — so the drift is mostly between the AUDIENCE EXPECTATION (an AI assistant on top of my data catalog) and the live IMPLEMENTATION (a free-text relay). The docs DO state the thin-proxy stance but UNDERSTATE the security implications."
      confidence: STATIC-INFERRED
      evidence: "GenAIServiceImpl.java:35-52 + live feature page WebFetch 2026-05-25 status 200"
    - name: "GenAIService.getResponseFromGenAI"
      promise: "Get a response from GenAI — implies a generation operation."
      implementation: "Gate on `genai.enabled`, forward question, unwrap quoted JSON response, map errors. Matches the name."
      drift: NONE
      operator_visible_consequence: "N/A — name and implementation align."
      confidence: STATIC-INFERRED
      evidence: "GenAIServiceImpl.java:35-52"
  orderings: []
  auth_gates:
    - location: "GenAIController.java:13-24 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57 + DisabledAuthSecurityConfiguration.java:13-17 + OAuthSecurityConfiguration.java:96-100 + LDAPSecurityConfiguration.java:143-147"
      endpoint: "POST /api/genai/ask"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: `anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:16) → endpoint accepts unauthenticated callers; service-level gate on `genai.enabled` still applies (HTTP 400 if disabled, otherwise forwards). LOGIN_FORM: path NOT in `permittedPaths` (LoginFormSecurityConfiguration.java:49-51) → falls through to `pathMatchers(\"/**\").authenticated()` (line 57) → requires login session; once authenticated, no permission check, any user with valid creds can call. OAUTH2: AuthorizationCustomizer (OAuthSecurityConfiguration.java:98) → path NOT in WHITELIST_PATHS (SecurityConstants.java:95-96) and NOT in SECURITY_RULES (SecurityConstants.java:98-355) → falls through to `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30). LDAP: same as OAUTH2 via LDAPSecurityConfiguration.java:145. **Three of four modes require authentication only — no Permission, no Role, no owner scope — and the fourth (DISABLED) requires nothing.**"
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-17 + LoginFormSecurityConfiguration.java:49-57 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + OAuthSecurityConfiguration.java:96-100 + LDAPSecurityConfiguration.java:143-147"
        - q: "What does an unauthenticated caller see?"
          a: "DISABLED: accepted (the service-level genai.enabled gate kicks in: HTTP 400 if disabled, otherwise the external call fires). LOGIN_FORM/OAUTH2/LDAP: rejected by Spring Security → HTTP 302 redirect to login (LOGIN_FORM) or HTTP 401/redirect to IdP (OAUTH2) or HTTP 401 (LDAP)."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-17 + Spring Security default behaviour for the authenticated() matcher"
        - q: "What does a wrong-role caller see?"
          a: "Role is irrelevant — no role/permission gate. Any authenticated principal with any role (including READ_ONLY / VIEWER) is admitted equally."
          confidence: STATIC-INFERRED
          evidence: "GenAIController.java:13-24 (no @PreAuthorize) + SecurityConstants.SECURITY_RULES (no /api/genai/* rule) — verified by probe P-160"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The AUTHENTICATION gate lives in the global Spring Security filter chain (AuthorizationCustomizer.java:29 fall-through), NOT on the controller. The FEATURE gate (genai.enabled) lives at the service layer (GenAIServiceImpl.java:37-39). There is NO authorization gate anywhere on the request path (controller, service, repository — there is no repository, the path goes straight to WebClient). No PolicyPermissionDto for GenAI exists."
          confidence: STATIC-INFERRED
          evidence: "GenAIController.java:13-24 + GenAIServiceImpl.java:37-39 + SecurityConstants.java:95-355 (search for GENAI / GEN_AI returns no matches in PolicyPermissionDto enum either)"
  resource_boundaries:
    - location: "GenAIServiceImpl.java:41-52 + WebClientConfiguration.java:20-30"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No persisted state on this path (the controller does not write to the database). Concurrent calls share the genAiWebClient bean — Reactor Netty's HttpClient is thread-safe under the default ConnectionProvider, so the only concurrency concern is connection-pool exhaustion (default max = 2 × CPU; pendingAcquireTimeout = 45s). Under burst, requests beyond the pool size wait up to 45s; if they exceed the configured request_timeout in minutes BEFORE acquiring a connection, the user sees a generic GenAIException with a Reactor Netty error message (NOT the friendly 'Gen AI request take longer that N min' message — that branch fires only for ReadTimeoutException, not for connection-acquire timeout)."
          confidence: PROBE-NEEDED
          evidence: "P-159"
        - q: "Is the call replay-safe?"
          a: "Yes operationally — the controller persists nothing, so re-running the same question produces a fresh external call. NO — economically — every replay incurs LLM cost, and there is no idempotency key. An attacker who captures a request can replay it N times to drive cost; the platform offers no defense."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:35-52 (no idempotency key handling, no cache, no dedup)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache on this path. Every `/api/genai/ask` call fires a fresh external POST. Identical questions from N users incur N LLM costs."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:35-52 (no `@Cacheable`, no Caffeine lookup, no manual cache)"
  request_inputs:
    - location: "GenAIController.java:19-20 (the Mono<GenAIRequest> body) + components.yaml:4200-4204 (the OpenAPI schema)"
      input_kind: body-field
      input_name: "GenAIRequest.body (single field, type: string, unconstrained)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A free-text question to ask the GenAI assistant; per the live feature page the GenAIRequest is documented as `{ \"body\": \"<question text>\" }`. The field name `body` is generic — it does not promise any specific structure or constraint beyond 'this is the question'."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4200-4204 + live feature page WebFetch 2026-05-25"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: GenAIController.genAiQuestion (line 19-23) → genAIService::getResponseFromGenAI (Mono.flatMap line 21) → GenAIServiceImpl.getResponseFromGenAI (line 36-52) → webClient.post().uri('/query_data').bodyValue(Map.of('question', request.getBody())) (line 41-43) → outbound HTTP POST to `{genai.url}/query_data` with JSON body `{\"question\": <verbatim user input>}`. Verbatim, no transformation, no validation, no length check."
          confidence: STATIC-INFERRED
          evidence: "GenAIController.java:19-23 + GenAIServiceImpl.java:36-52"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the input is forwarded verbatim as the 'question' in the external call. The name `body` is honest about being the request body content. BUT (and this is the subtle drift): the IMPLICIT promise of being inside a 'GenAI assistant' feature is that the platform adds catalog context — this is a feature-naming drift covered under name_behavior_pairs, not an input-name drift. The input-name itself does not lie about its destination."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:41-43"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no input-name drift on the body field."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The `ServerWebExchange exchange` parameter (GenAIController.java:20) is exposed in the controller signature but NEVER read — the body of `genAiQuestion` is a one-liner that doesn't touch `exchange`. The user `Principal`, the request headers (e.g. `X-Forwarded-For`, `User-Agent`), and the trace context are all available via `exchange.getPrincipal()` / `exchange.getRequest().getHeaders()` but discarded. **This is the canonical fix-anchor for audit logging, per-user rate limiting, or attaching the user identity to the outbound request.**"
          confidence: STATIC-INFERRED
          evidence: "GenAIController.java:19-23 (exchange parameter declared but unreferenced in body)"
      routes_to_finding: "bugs_limitations_corner_cases.[3] (no audit log) AND bugs_limitations_corner_cases.[8] (ServerWebExchange exposed-but-discarded)"
  probes_emitted:
    - probe_id: P-160
      question: "Under LOGIN_FORM / OAUTH2 auth modes, does a least-privilege authenticated user (no admin, no GenAI-specific permission, default Role) succeed in calling /api/genai/ask and reach the external service?"
      probe_path: "lineage/odd-platform/probes/P-160.yaml"
    - probe_id: P-161
      question: "Under genai.enabled=true with genai.request_timeout=0 (the unset Java primitive default), what HTTP status and error message does the user see?"
      probe_path: "lineage/odd-platform/probes/P-161.yaml"
    - probe_id: P-158
      question: "Does a prompt-injection-shaped question (role-override prompt, jailbreak header) reach the external service verbatim, and is there any platform-side trace of the prompt content?"
      probe_path: "lineage/odd-platform/probes/P-158.yaml"
    - probe_id: P-159
      question: "Under 50 concurrent requests with a slow external service (request_timeout=2 min, external sleeps 90s), does the Reactor Netty default ConnectionProvider exhaust? What does request 21+ see (acquire-timeout vs read-timeout)?"
      probe_path: "lineage/odd-platform/probes/P-159.yaml"
  stress_summary:
    triggers_total: 4
    questions_total: 17
    answers_static_inferred: 14
    answers_probe_needed: 3
    answers_reference: 0
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `[DISABLED, LOGIN_FORM, OAUTH2, LDAP]`
  Notes:
  - **DISABLED**: `anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:16) → unauthenticated callers accepted; the service-level `genai.enabled` gate still applies.
  - **LOGIN_FORM**: path NOT in `permittedPaths` (LoginFormSecurityConfiguration.java:49-51) → falls through to `pathMatchers("/**").authenticated()` (line 57). Login required; once logged in, no role/permission check.
  - **OAUTH2**: `AuthorizationCustomizer` (OAuthSecurityConfiguration.java:98) → path NOT in WHITELIST_PATHS, NOT in SECURITY_RULES → falls through to `pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29). Authenticated only.
  - **LDAP**: Same chain via LDAPSecurityConfiguration.java:145 → authenticated only.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion path. /api/genai/ask is not under /ingestion/**, S2S filter does not apply.`
- **authorization_assertions**: `[]`
  Notes: "GenAIController has no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, and no Permission entry exists in PolicyPermissionDto for GenAI usage. The generated GenaiApi interface (under odd-platform-api-contract) carries no authorization annotations either. Confirmed by reading GenAIController.java:13-24, GenAIServiceImpl.java:35-52, and grep for `GENAI_USE|GEN_AI|genai` across SecurityConstants.java + PolicyPermissionDto enum."
- **owner_scoping**: `N/A — code is not data-scoped. The endpoint does not query owner-bound resources; it forwards a free-text question to an external service. No per-user, per-owner, or per-tenant filter applied.`
- **data_exposure**:
  - "User-supplied free-text question (GenAIRequest.body) → forwarded as JSON `{\"question\": \"...\"}` to `{genai.url}/query_data` over plain WebClient (no auth header, no body redaction, no PII scrubbing). If `genai.url` points to a third-party SaaS, every question leaves the operator's trust boundary." — evidence: GenAIServiceImpl.java:41-43 + WebClientConfiguration.java:26-29
  - "External AI service response (raw String, JSON-unescaped, quote-trimmed) → returned to any authenticated caller as `GenAIResponse.body`. The response is not filtered or redacted before being shown to the caller." — evidence: GenAIServiceImpl.java:45-47
  - "No `log.*` call captures the question or the response — the question text does NOT appear in the platform's logs (positive for log-PII risk, NEGATIVE for forensics)." — evidence: GenAIServiceImpl.java:35-52 (no log.* calls anywhere)
  - "The user's Principal (which authenticated user asked) and the request headers are available via `ServerWebExchange exchange` but never read or recorded — there is no in-platform record of who asked what." — evidence: GenAIController.java:19-23 (exchange parameter declared but unreferenced)
- **known_security_gaps**:
  - "**No authorization beyond `authenticated()`** — any authenticated user (any Role, including read-only viewers) can call the endpoint and drive cost on the operator's external AI account. There is no `GENAI_USE` Permission and no Role check." — evidence: GenAIController.java:13-24 + SecurityConstants.SECURITY_RULES (no /api/genai/* rule) — severity: HIGH
  - "**No request-body validation** — `GenAIRequest.body` has no `@Size`, no `@Pattern`, no maxLength in OpenAPI; controller has no `@Valid`. Multi-megabyte prompts are accepted." — evidence: components.yaml:4200-4204 + GenAIController.java:19-23 — severity: HIGH
  - "**No rate limit** — no Bucket4j / Resilience4j / @RateLimit / token bucket wraps the endpoint or the outbound call. An authenticated user can fire requests at HTTP client speed." — evidence: GenAIController.java + GenAIServiceImpl.java + WebClientConfiguration.java (no rate-limit wiring on any of the three) — severity: HIGH
  - "**No audit log** — `@Slf4j` is present but no log.* call records the user, the question, or the response. Forensic reconstruction of misuse requires external service's logs cross-referenced with reverse-proxy access logs." — evidence: GenAIServiceImpl.java:35-52 (zero log.* calls) — severity: HIGH
  - "**No PII redaction / content filter** — user prompts are forwarded verbatim to whatever LLM the operator configured. There is no scrubber, no allowlist, no detection of credentials/secrets/PII in the prompt." — evidence: GenAIServiceImpl.java:41-43 + live feature page silent on this — severity: HIGH
  - "**ServerWebExchange exposed but discarded** — the user Principal and request headers are available but never read; this is the canonical fix-anchor for adding per-user audit + rate-limit + permission gating." — evidence: GenAIController.java:19-23 — severity: MEDIUM
  - "**Live docs document 'no authentication, no retry' but are silent about no-authorization, no-rate-limit, no-audit, no-PII-redaction** — an operator following the docs to enable the feature does not learn from the docs alone that any authenticated user can drive cost without trace." — evidence: WebFetch 2026-05-25 of `https://docs.opendatadiscovery.org/features/active-platform-features/genai` (status 200) — the page documents the platform-to-external-service security stance but omits the platform-to-user authorization stance — severity: HIGH (doc gap, not code gap; routes to docs follow-up)

## performance

- **hot_paths**:
  - "POST /api/genai/ask → GenAIServiceImpl.getResponseFromGenAI fires ONE outbound POST `{genai.url}/query_data` per inbound request, on the reactive request thread. Latency is bounded only by the external service's response time and `genai.request_timeout` (in minutes). No batching, no caching, no offload to a background queue — the request thread holds an outbound socket for the full external-service latency." — evidence: GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
  - "`isEnabled()` is re-read on every request as the first gate — cheap volatile field read on the singleton config bean." — evidence: GenAIServiceImpl.java:37
- **throughput_characteristics**:
  - "single-question POST per inbound request — no batching, no streaming over a websocket, no Server-Sent-Events for token-by-token streaming. The user waits for the full external response before any output." — evidence: GenAIServiceImpl.java:41-45 (single .post() per call) + GenAIController.java:18-23 (no SSE / WebSocket signature)
  - "reactive Mono signature throughout — non-blocking from the platform's perspective; each inbound request still holds an outbound socket for up to request_timeout minutes."
  - "no response caching — identical questions from different users (or even the same user) re-fire to the external service. No `@Cacheable`, no Caffeine, no manual cache." — evidence: GenAIServiceImpl.java:35-52
- **resource_allocation**:
  - "The `genAiWebClient` is built once at startup from a single `HttpClient.create()` (WebClientConfiguration.java:22-29) — no explicit ConnectionProvider tuning, so Reactor Netty defaults apply: max-connections = 2 × CPU, pendingAcquireTimeout = 45s, FIFO acquire order. Cross-reference GenAIProperties sidecar `performance.resource_allocation.[default-pool]`." — evidence: WebClientConfiguration.java:22-29
  - "`responseTimeout` configured from `genai.request_timeout` in MINUTES — `Duration.ofMinutes(N)`. N=0 (the unset primitive default) is a legal zero Duration; Reactor Netty treats it as immediate timeout. No `@Min(1)` constraint, no fail-fast at startup. LSN-002-class regional analogue: `MinIOClient.region(...)` unset → us-east-1; here `genai.request_timeout` unset → immediate timeout." — evidence: WebClientConfiguration.java:23 + GenAIProperties.java:11
  - "No max-in-memory-size override on the WebClient — uses Spring WebFlux default 256KB. The application-wide `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) is NOT inherited onto this client because `WebClient.builder()` chain (WebClientConfiguration.java:26-29) does not call `.codecs(...)`. Long-form LLM responses fail with DataBufferLimitException." — evidence: WebClientConfiguration.java:26-29 + application.yml:14-15
  - "No `defaultHeader` for `User-Agent` — the external service sees Reactor Netty's default UA, which complicates cost-attribution and abuse-tracking on the AI vendor side." — evidence: WebClientConfiguration.java:26-29
- **scaling_characteristics**:
  - "Each platform instance fires its own outbound — no shared rate limiter, no distributed concurrency cap, no cross-instance token bucket. N replicas behind a load balancer multiply effective request rate to the external service by N." — evidence: GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30 (no Resilience4j / Bulkhead / RateLimiter wiring)
  - "Stateless controller — instances scale horizontally without coordination. The bottleneck is the external AI service AND the operator's bill, not the platform CPU/memory." — evidence: GenAIController.java:13-24 (no instance state)
  - "`genai.url` + `genai.request_timeout` are baked into the bean at startup — config changes require a Platform restart. Operators cannot tune timeout without downtime; this is the explicit ADR per the GenAIProperties sidecar." — evidence: WebClientConfiguration.java:20-30 + GenAIProperties sidecar implicit_adrs.[2]
- **known_performance_gaps**:
  - "`genai.request_timeout` default is 0 (Java primitive int default, not a YAML-supplied default). When operators set `genai.enabled=true` without explicitly setting `genai.request_timeout`, every request fails immediately with a ReadTimeoutException, surfaced as 'Gen AI request take longer that 0 min' — a confusing user error rather than a configuration error at boot. **This is the LSN-002-class regional analogue: an unset SDK builder parameter that ships silent misbehaviour rather than a fail-fast at startup.** Cross-reference GenAIProperties sidecar `performance.known_performance_gaps.[zero-timeout-default]`." — evidence: GenAIProperties.java:11 + WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51 — severity: HIGH
  - "No retry, no exponential backoff, no circuit breaker on the outbound call — a single transient failure (e.g. the external service's 503 during deploy) surfaces as a GenAIException to the user even when the external service would have succeeded on retry. No `.retryWhen(...)` on the Mono chain, no `@CircuitBreaker`, no `@Retryable`." — evidence: GenAIServiceImpl.java:41-52 — severity: MEDIUM
  - "No outbound concurrency cap — relies on Reactor Netty's default ConnectionProvider. Under a burst of /api/genai/ask requests, the platform queues connection-acquire attempts in the Reactor pool (default pendingAcquireTimeout=45s) before either succeeding or failing with a non-ReadTimeoutException → falls into the generic GenAIException(Throwable) branch (line 51) and surfaces a less-helpful error message than the timeout path. Probe P-159 verifies the behaviour." — evidence: WebClientConfiguration.java:22-29 + GenAIServiceImpl.java:48-51 — severity: MEDIUM
  - "No response caching — identical questions re-fire to the external paid service. For repeated-question burst patterns (a user re-asking the same question, or a probe-style attack), the operator pays N times for the same answer. The only line of defense is the external service's own caching/dedup (typically: none)." — evidence: GenAIServiceImpl.java:35-52 — severity: LOW
  - "No request-body size limit at the controller layer — Spring WebFlux defaults govern. A 50MB JSON POST is read into memory by `Mono<GenAIRequest>` deserialization before parser dispatch. Combined with no-rate-limit, an authenticated user can spend operator memory + CPU + LLM cost on arbitrarily-large prompts." — evidence: GenAIController.java:19 (no DataBuffer size cap configured) + components.yaml:4200-4204 (no maxLength in schema) — severity: MEDIUM

## upstream_callers

- entry_point: "rest:POST /api/genai/ask"
  caller_node: "external programmatic caller (SDK / CLI / third-party integration) — the live config page explicitly states 'API-only today (no in-app UI affordance calls the endpoint)'. No UI consumer was found in odd-platform-ui/src at commit 4ec2b20."
  multiplicity_per_trigger: "1 per external caller invocation; unbounded total since there is no rate limit"
  evidence: "GenAIController.java:18-23 (the only callable entrypoint on the class, implements generated GenaiApi.genAiQuestion) + openapi.yaml:4194-4213 (the /api/genai/ask path) + grep over odd-platform-ui/src for GenaiApi|genAiQuestion|/genai/ returns zero matches"
  observation_class: rest-call
  unresolved: false

- entry_point: "unresolved — adversarial-style authenticated abuse"
  caller_node: "any authenticated user (any role, any owner association) — the endpoint has no Permission gate, so a legitimately-authenticated low-privilege user is functionally equivalent to an attacker for the cost-abuse risk surface"
  multiplicity_per_trigger: "unbounded — no rate limit, no per-user cap, no audit"
  evidence: "GenAIController.java:13-24 (no @PreAuthorize) + SecurityConstants.SECURITY_RULES (no /api/genai/* rule) — verified by probe P-160"
  observation_class: rest-call
  unresolved: true

## downstream_side_effects

- side_effect_class: external-call
  description: "Outbound HTTP POST to `{genai.url}/query_data` with JSON body `{\"question\": <user-supplied verbatim text>}`. The POST runs on the platform's egress identity (network-level credentials whatever the operator's deployment uses). No retry; single attempt per inbound call."
  evidence: "GenAIServiceImpl.java:41-43"
  cardinality_per_call: "1 (always, when genai.enabled=true); 0 (when genai.enabled=false — short-circuits at the service gate, no outbound call)"
  reachable_from_entry_points:
    - "rest:POST /api/genai/ask"
    - "unresolved — adversarial-style authenticated abuse"

- side_effect_class: page-render
  description: "Returns `{\"body\": <unescaped, quote-trimmed external response>}` to the caller. The body is the external service's response with JSON-string-quote-trim + Java-unescape applied. Brittle to non-JSON-quoted-string external responses (see bugs_limitations_corner_cases.[5])."
  evidence: "GenAIServiceImpl.java:45-47 + GenAIController.java:22 (.map(ResponseEntity::ok))"
  cardinality_per_call: "1 on success; on failure (timeout / external 5xx / connection failure) → no response body, HTTP 500 with the ErrorResponse from ControllerAdvice.handleGenAIException"
  reachable_from_entry_points:
    - "rest:POST /api/genai/ask"
    - "unresolved — adversarial-style authenticated abuse"

- side_effect_class: log-emit
  description: "ZERO log emissions on the request path. `@Slf4j` is declared on GenAIServiceImpl but no `log.*` call exists anywhere on the chain (controller → service → WebClient). The only operator-observable trace of a GenAI call is whatever the reverse proxy / ingress captures + whatever the external AI service logs."
  evidence: "GenAIController.java:13-24 (no Logger field) + GenAIServiceImpl.java:35-52 (no log.* call) + grep over the genai package confirms no logging on the path"
  cardinality_per_call: "0 — and that is itself a finding (no audit log)"
  reachable_from_entry_points:
    - "rest:POST /api/genai/ask"
    - "unresolved — adversarial-style authenticated abuse"

## sources

- understanding <- GenAIController.java:13-24 + GenAIServiceImpl.java:35-52 + GenAIProperties.java:8-12 + WebClientConfiguration.java:20-30 + openapi.yaml:4194-4213
- concepts.entities.GenAIRequest <- components.yaml:4200-4204
- concepts.entities.GenAIResponse <- components.yaml:4206-4210
- concepts.invariants.disabled-returns-400-not-404 <- GenAIServiceImpl.java:37-39 + ControllerAdvice.java:24-28 + GenAIController.java:13-24 (no @ConditionalOnProperty)
- concepts.invariants.thin-proxy <- GenAIServiceImpl.java:41-43 + WebFetch live feature page 2026-05-25 status 200
- concepts.invariants.response-unwrap-brittle <- GenAIServiceImpl.java:45-47
- dependencies_semantic.requires-feature.genai-enabled-pattern-difference <- GenAIController.java:13-24 (no @ConditionalOnProperty, unlike EventApiController.java:15 @ConditionalOnDataCollaboration)
- dependencies_semantic.requires-feature.external-contract <- GenAIServiceImpl.java:22-23, 41-43
- dependencies_semantic.requires-config.[genai-enabled-url-timeout] <- GenAIProperties.java:8-12 + application.yml:17-20
- dependencies_semantic.live-docs-anchors <- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration` 2026-05-25 status 200 + WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-25 status 200
- dependencies_semantic.requires-runtime.[auth-fall-through] <- SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57 + OAuthSecurityConfiguration.java:96-100 + LDAPSecurityConfiguration.java:143-147 + DisabledAuthSecurityConfiguration.java:13-17
- tests_coverage_semantic.gaps <- grep `<odd-platform>/odd-platform-api/src/test` for `GenAI|genai|/api/genai` returns zero matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[0] <- WebFetch live feature page 2026-05-25 status 200 (excerpts captured verbatim)
- docs_link_semantic.inferred_docs.[1] <- WebFetch live config page 2026-05-25 status 200 (anchor `genai-configuration` present)
- docs_link_semantic.doc_drift_findings.[0] <- WebFetch live feature page + GenAIController.java:13-24 + GenAIServiceImpl.java:35-52 (silence on no-authorization / no-rate-limit / no-audit / no-PII-redaction)
- docs_link_semantic.doc_drift_findings.[2] <- WebFetch live feature page + GenAIServiceImpl.java:45-47 (response-unwrap contract undocumented)
- implicit_adrs.[0] <- GenAIServiceImpl.java:22-23, 41-43 + WebFetch live feature page
- implicit_adrs.[1] <- GenAIServiceImpl.java:37-39 + ControllerAdvice.java:24-28 + GenAIController.java:13-24 (contrast with EventApiController.java:15)
- implicit_adrs.[2] <- WebClientConfiguration.java:26-29 + GenAIProperties.java:8-12 + WebFetch live feature page (operator-facing trust-boundary statement)
- implicit_adrs.[3] <- GenAIServiceImpl.java:41-52 + WebFetch live feature page
- implicit_adrs.[4] <- GenAIServiceImpl.java:48-51
- bugs_limitations_corner_cases.[0] <- GenAIController.java:13-24 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57
- bugs_limitations_corner_cases.[1] <- components.yaml:4200-4204 + GenAIController.java:19-23
- bugs_limitations_corner_cases.[2] <- GenAIController.java + GenAIServiceImpl.java + WebClientConfiguration.java + grep for rate-limit primitives across the genai/controller/config packages returns zero matches
- bugs_limitations_corner_cases.[3] <- GenAIServiceImpl.java:35-52 (no log.* calls) + GenAIController.java:19-23 (ServerWebExchange unreferenced)
- bugs_limitations_corner_cases.[4] <- GenAIServiceImpl.java:41-43 + WebClientConfiguration.java:26-29 + live feature page silent on PII
- bugs_limitations_corner_cases.[5] <- GenAIServiceImpl.java:45-47
- bugs_limitations_corner_cases.[6] <- GenAIProperties.java:10 + WebClientConfiguration.java:28 (cross-reference GenAIProperties sidecar)
- bugs_limitations_corner_cases.[7] <- WebClientConfiguration.java:26-29 + application.yml:14-15
- bugs_limitations_corner_cases.[8] <- GenAIController.java:19-23
- bugs_limitations_corner_cases.[9] <- grep `<odd-platform>/odd-platform-ui/src` for `GenaiApi|genAiQuestion|/genai/` returns zero matches at commit 4ec2b20 + live config page documents 'API-only today'
- security.auth_mode_relevance <- DisabledAuthSecurityConfiguration.java:13-17 + LoginFormSecurityConfiguration.java:49-57 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:22-30 + OAuthSecurityConfiguration.java:96-100 + LDAPSecurityConfiguration.java:143-147
- security.ingestion_filter_relevance <- GenAIController.java:13-24 (route /api/genai/ask not under /ingestion/**)
- security.authorization_assertions <- GenAIController.java:13-24 + SecurityConstants.SECURITY_RULES (no /api/genai/* match)
- security.owner_scoping <- GenAIController.java:13-24 + GenAIServiceImpl.java:35-52 (no owner query)
- security.data_exposure.[user-question-forward] <- GenAIServiceImpl.java:41-43
- security.data_exposure.[ai-response-passthrough] <- GenAIServiceImpl.java:45-47
- security.data_exposure.[no-log-emit] <- GenAIServiceImpl.java:35-52
- security.data_exposure.[server-web-exchange-discarded] <- GenAIController.java:19-23
- security.known_security_gaps.[0..6] <- see corresponding bugs_limitations_corner_cases sources
- performance.hot_paths <- GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
- performance.resource_allocation.[default-pool] <- WebClientConfiguration.java:22-29
- performance.resource_allocation.[zero-timeout] <- WebClientConfiguration.java:23 + GenAIProperties.java:11
- performance.resource_allocation.[max-in-memory] <- WebClientConfiguration.java:26-29 + application.yml:14-15
- performance.scaling_characteristics.[multiplied-rate] <- GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30
- performance.scaling_characteristics.[stateless] <- GenAIController.java:13-24
- performance.scaling_characteristics.[startup-baked] <- WebClientConfiguration.java:20-30
- performance.known_performance_gaps <- GenAIProperties.java:11 + WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51 (zero-timeout default) + GenAIServiceImpl.java:41-52 (no retry) + WebClientConfiguration.java:22-29 (no concurrency cap) + GenAIServiceImpl.java:35-52 (no cache) + components.yaml:4200-4204 (no maxLength)
- upstream_callers.[0] <- GenAIController.java:18-23 + openapi.yaml:4194-4213 + grep over odd-platform-ui/src
- upstream_callers.[1] <- GenAIController.java:13-24 (no PreAuthorize) + SecurityConstants.SECURITY_RULES
- downstream_side_effects.[0] <- GenAIServiceImpl.java:41-43
- downstream_side_effects.[1] <- GenAIServiceImpl.java:45-47 + GenAIController.java:22 + ControllerAdvice.java:55-59
- downstream_side_effects.[2] <- GenAIServiceImpl.java:35-52 (no log.* calls) + GenAIController.java:13-24 (no Logger field)
- stress_findings.probes_emitted <- `lineage/odd-platform/probes/P-160.yaml` (auth) + `P-161.yaml` (zero-timeout) + `P-158.yaml` (prompt-injection) + `P-159.yaml` (concurrency burst) — all emitted by this enrichment pass; P-156/P-157 were already claimed by the DataQualityRunsController batch (verified by Glob over lineage/odd-platform/probes/ at allocation time), so the GenAI probes shifted to the next free range P-158..P-161.
- cross-reference <- `lineage/odd-platform/understanding/odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md` (the config-side sidecar; this file does not duplicate the config analysis but references it)

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
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (3 of 17 questions resolve to PROBE-NEEDED; the load-bearing security claims — no permission gate, no rate limit, no audit log — are STATIC-INFERRED HIGH from absence-of-evidence + absence-of-grep-matches across the relevant primitive names. The probes verify operator-observable end-to-end consequences.)

## Maintainer notes


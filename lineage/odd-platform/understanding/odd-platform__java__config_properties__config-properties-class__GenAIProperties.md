---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:GenAIProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-zk-genai-properties
---

# GenAIProperties (`@ConfigurationProperties("genai")`) — semantic understanding

## understanding

This is the typed Spring Boot binding for the `genai.*` YAML namespace. It is the
single conceptual schema for the entire GenAI feature: three fields (`enabled`,
`url`, `requestTimeout`) bound from `application.yml` keys `genai.enabled`,
`genai.url`, `genai.request_timeout` via Spring relaxed-binding (snake_case ↔
camelCase). No `apiKey`, no `model`, no `maxTokens`, no `rateLimit`, no
`authToken`, no provider-selection field — the POJO is the floor of what the
external service contract requires (URL + boolean toggle + timeout). The bean
is instantiated by `@EnableConfigurationProperties(GenAIProperties.class)` in
`WebClientConfiguration` (WebClientConfiguration.java:15) and consumed at two
distinct lifecycle points: at bean-construction time (URL + timeout flow into
the `genAiWebClient` singleton at startup) and at request time (`enabled` is
re-read on every `POST /api/genai/ask` to gate the feature).

## concepts

- entities: [`GenAIProperties` (typed config POJO), the `genai.*` YAML namespace, the `genAiWebClient` Spring bean]
- operations: [bind `genai.enabled` to `boolean enabled`, bind `genai.url` to `String url`, bind `genai.request_timeout` to `int requestTimeout`]
- invariants: [`enabled` is a request-time gate (re-read on every call via `genAIProperties.isEnabled()`); `url` and `requestTimeout` are startup-time inputs (baked into the `WebClient` bean); the feature is **disabled** by `application.yml:18` shipping `genai.enabled: false`; field types use Java primitives (`boolean`, `int`) rather than wrappers — Spring binding silently succeeds when the YAML key is absent, falling back to the primitive default (`false` / `0`); no bean validation annotations are present, so misconfiguration surfaces at first request rather than at boot]
- audiences: [Platform operators configuring the GenAI proxy via `application.yml` or `GENAI_*` env vars; the `WebClientConfiguration` and `GenAIServiceImpl` runtime consumers]

## dependencies_semantic

- requires-feature: [the GenAI proxy controller surface (`POST /api/genai/ask` exposed via `GenAIController` — node `odd-platform java GenAIController controller-class:GenAIController`); an external AI service that accepts `POST {url}/query_data` with JSON body `{"question": "..."}` and returns a string-encoded response]
- requires-config: [`genai.enabled` (declared at `application.yml:18` with explicit value `false`); `genai.url` (`application.yml:19` is commented out — no Java field initializer, so the runtime default is `null`); `genai.request_timeout` (`application.yml:20` is commented out — no Java field initializer, so the runtime default is `0` minutes)]
- requires-runtime: [Spring Boot's `@ConfigurationProperties` binding; Spring's relaxed binding to map YAML `request_timeout` ↔ Java `requestTimeout` ↔ env `GENAI_REQUEST_TIMEOUT`; `@EnableConfigurationProperties(GenAIProperties.class)` declared in `WebClientConfiguration:15` to register the bean (the POJO itself has no `@Component` / `@ConfigurationPropertiesScan`); Lombok `@Data` to generate the getters/setters Spring binding needs]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "verifying that `genai.enabled=false` produces a `BadUserRequestException` ('Gen AI is disabled') at the controller — i.e. the request-time gate"
    test_class: integration
    criticality: HIGH
    note: "the disabled-by-default branch is the single most important behaviour of this POJO — it is the operator-visible safety property and has no test"
  - behaviour: "verifying that `genai.request_timeout=N` actually sets `Duration.ofMinutes(N)` on the underlying Reactor Netty `HttpClient.responseTimeout(...)`"
    test_class: integration
    criticality: HIGH
    note: "the unit `minutes` (not seconds, not millis) is a hidden contract; renaming the field type or changing the conversion would silently change every operator's deployed timeout by 60x"
  - behaviour: "verifying that `genai.enabled=true` with `genai.url` unset and `genai.request_timeout` unset boots cleanly but fails the first request with a deterministic error (no NPE, no silent hang)"
    test_class: integration
    criticality: HIGH
    note: "this is the LSN-001 / LSN-002 class — the silent-misconfiguration default; a Principal would have a regression test here"
  - behaviour: "verifying relaxed binding: that `genai.request_timeout` (snake_case), `genai.requestTimeout` (camelCase), and `GENAI_REQUEST_TIMEOUT` (env-var style) all bind to the same field"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "verifying that `@ConfigurationProperties` binding fails fast when the YAML supplies `genai.request_timeout: -5` (negative) — currently it succeeds (no `@Min(1)`) and `Duration.ofMinutes(-5)` is a negative duration"
    test_class: integration
    criticality: MEDIUM
- test_files: []
- gaps: |
    There is no `GenAIPropertiesTest`, `GenAIServiceImplTest`, `GenAIControllerTest`,
    or `WebClientConfigurationTest` anywhere under `odd-platform-api/src/test`
    — confirmed by Grep returning no matches for `GenAI` in the test tree. The
    most likely silent regression is a field rename or YAML key rename that
    breaks Spring binding silently: e.g. renaming `requestTimeout` to
    `timeoutMinutes` without updating `application.yml` leaves the int as `0`,
    the `genAiWebClient` is built with `Duration.ofMinutes(0)`, and every
    request times out immediately — but the platform boots cleanly and the
    feature is "enabled" from the operator's standpoint. The worst-covered
    class is `integration` — the bean-wiring + first-request chain has zero
    coverage; the highest-leverage gap is also `integration` (a test that asserts
    the disabled-by-default + first-request-error contract).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#genai-configuration"
    rationale: "There is no `@docs` annotation on `GenAIProperties.java` (verified by Grep). The published page `configuration-and-deployment/odd-platform` is the canonical operator-facing home for every key under the `genai.*` YAML prefix; the section `## GenAI Configuration` (anchor `#genai-configuration`) documents all three fields of this POJO. Confirmed live by WebFetch (status 200, anchor present) and locally by `documentation/docs/configuration-and-deployment/odd-platform.md:1018`."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-26 (status 200, anchor `genai-configuration` present):
    > "## GenAI Configuration
    >
    > * `genai.enabled` — feature toggle. **Default `false`**. When `false`, `POST /api/genai/ask` returns HTTP 400.
    > * `genai.url` — base URL of the external AI service. **No `@ConfigurationProperties` default** — the field has no initializer, so the runtime default is `null`.
    > * `genai.request_timeout` — outbound response timeout, **in minutes**. **No `@ConfigurationProperties` default** — the Java primitive `int` default is `0`, which means immediate timeout."
    >
    > {% hint style="warning" %}
    > **Setting only `genai.enabled=true` will silently misconfigure the feature.** With `url` defaulting to `null` and `request_timeout` defaulting to `0`, the WebClient is built with no `baseUrl` and a `Duration.ofMinutes(0)` timeout — every `POST /api/genai/ask` will fail before the external service has a chance to respond.
    > {% endhint %}
    >
    > "The platform sends **no authentication** to the external AI service and does **not retry**."
- doc_drift_findings:
  - "No drift on the three fields, defaults, or the silent-misconfiguration warning — the live page accurately states `enabled` defaults to `false` (verified at `application.yml:18`), `url` Java default is `null` (verified at `GenAIProperties.java:10` — `private String url;` with no initializer), and `requestTimeout` Java default is `0` (verified at `GenAIProperties.java:11` — `private int requestTimeout;` with no initializer)."
  - "Drift candidate (MEDIUM severity — operator-relevant naming): the YAML key is named `request_timeout` and the Java field `requestTimeout`, but the SDK call at `WebClientConfiguration.java:23` wires it into `HttpClient.responseTimeout(...)`, NOT into a request/connect timeout. The field name promises 'how long the platform spends sending the request'; the implementation actually means 'how long the platform waits for the external service's response after the request is sent'. The live doc page calls it 'outbound response timeout' (correct), but the YAML key + Java field name preserve the misleading promise. Naming-vs-behaviour drift class (Category B + Category F)."
  - "Absence-drift (MEDIUM severity): the live doc page explicitly states 'The platform sends no authentication to the external AI service and does not retry' — this is documented, so no drift on the absence claim. However, the live page does NOT warn operators that genai.url is fed to baseUrl with no SSRF guard, no scheme allowlist, and no @URL validation. An operator who runs a hosted ODD instance with an exposed config-write surface (e.g. a misconfigured /actuator) has an outbound-pivot pathway via genai.url that the doc does not flag."

## implicit_adrs

- "GenAI is shipped disabled-by-default — the YAML explicitly writes `enabled: false` rather than relying on the Java primitive default of `false`. This makes the disabled state visible to operators reading `application.yml`, not just an absence." — evidence: GenAIProperties.java:9 (`private boolean enabled;`) + application.yml:17-18 (`genai:\n  enabled: false`) — intent_anchor: "the YAML writes `enabled: false` rather than omitting the key, even though the primitive default is `false` — the redundancy is deliberate visibility" — confidence: HIGH
- "The `WebClient` for GenAI is built once at startup, not per-request — `genai.url` and `genai.request_timeout` changes require a Platform restart. The `enabled` flag is the ONLY field re-read at request time. This is a deliberate startup-vs-request-time split: a cheap volatile-read gate (`isEnabled()`) on every call, but no rebuild cost for URL/timeout changes." — evidence: WebClientConfiguration.java:20-30 (`@Bean("genAiWebClient")` constructs the client once) + GenAIServiceImpl.java:37 (`if (!genAIProperties.isEnabled())` re-checks every call) — intent_anchor: "the bean is named `genAiWebClient` (singleton convention) and the gate sits in the service body, not in a `@ConditionalOnProperty` on the bean — the bean ALWAYS exists, the gate is per-request" — confidence: HIGH
- "The POJO is wired via `@EnableConfigurationProperties(GenAIProperties.class)` on `WebClientConfiguration` rather than via `@ConfigurationPropertiesScan` or `@Component`. This is the standard Spring Boot pattern for a feature-scoped config class — only the configuration that needs the bean activates the binding. Removing the GenAI feature would mean removing the `@EnableConfigurationProperties` line, not deleting a `@Component` scattered elsewhere." — evidence: WebClientConfiguration.java:15 (`@EnableConfigurationProperties(GenAIProperties.class)`) + GenAIProperties.java:1-12 (no `@Component`, no `@ConfigurationPropertiesScan`) — intent_anchor: "the explicit `@EnableConfigurationProperties` is the documented Spring-Boot idiom for scoped config classes" — confidence: HIGH

## bugs_limitations_corner_cases

- "Silent misconfiguration when `genai.enabled=true` is the only key set: `url` Java default is `null` and `requestTimeout` Java default is `0`. The `genAiWebClient` bean is constructed with `baseUrl(null)` and `Duration.ofMinutes(0)`. The platform boots, the feature reports as enabled to the request-time gate, and every `POST /api/genai/ask` fails downstream — at WebClient (null base URL → IllegalArgumentException or relative-URL resolution failure) or via immediate timeout. The live docs flag this explicitly with a warning admonition; the source itself has no field-level safety (no `@NotNull`, no constructor validation, no `@PostConstruct` health check, no `@Validated` on the POJO)." — evidence: GenAIProperties.java:8-12 (no validation annotations, no initializers for `url`/`requestTimeout`) + WebClientConfiguration.java:22-29 (no null-check or zero-check before building the WebClient) — severity: HIGH
- "`requestTimeout=0` is silently accepted at startup: `Duration.ofMinutes(0)` is a legal `Duration` (zero duration), and `HttpClient.responseTimeout(Duration.ofMinutes(0))` does not throw at bean-construction time. There is no validation that `requestTimeout > 0`. The first request demonstrates the misconfiguration, not the boot." — evidence: WebClientConfiguration.java:23 (`Duration.ofMinutes(genAIProperties.getRequestTimeout())` with no positive-value check) + GenAIProperties.java:11 (`private int requestTimeout;` with no `@Min(1)`) — severity: HIGH
- "`requestTimeout` is bound to a Java primitive `int`. Spring binding silently succeeds when the YAML key is absent OR when the env var is unset. A wrapper type `Integer` would have allowed `null` as a sentinel (and an `@NotNull` validator would fail-fast at startup). The primitive choice trades clear misconfiguration signal for binding convenience." — evidence: GenAIProperties.java:11 (`private int` not `Integer`) — severity: MEDIUM
- "No bean-validation annotations are declared anywhere on the POJO. There is no `@Validated` at the class level, no `@NotBlank` / `@URL` on `url`, no `@Min(1)` on `requestTimeout`. Spring Boot's `@ConfigurationProperties` validation pipeline is therefore not engaged for this POJO, even though it is engaged for some other Spring projects via `spring-boot-starter-validation`. The dependency is in the classpath transitively (other parts of the platform use `jakarta.validation`), so the omission is a choice, not a missing dependency." — evidence: GenAIProperties.java:1-12 (only `@ConfigurationProperties` and `@Data` annotations; no `@Validated`, no `jakarta.validation.constraints.*` imports) — severity: MEDIUM
- "Field-name vs SDK-call drift: the YAML key `genai.request_timeout` and the Java field `requestTimeout` are wired into Reactor Netty's `responseTimeout(...)` at `WebClientConfiguration.java:23`. The name says 'request timeout' (the time spent sending); the SDK call sets the 'response timeout' (the time waiting for a reply). The live doc page corrects the name to 'outbound response timeout' but the operator-facing YAML key still misleads." — evidence: GenAIProperties.java:11 (`requestTimeout`) + WebClientConfiguration.java:23 (`.responseTimeout(Duration.ofMinutes(genAIProperties.getRequestTimeout()))`) — severity: MEDIUM
- "The POJO carries no `apiKey`, no `authToken`, no `model`, no `maxTokens`, no `provider`, no `rateLimit`, no `temperature`. Operators integrating with a paid LLM (OpenAI, Anthropic, Azure OpenAI) MUST front the platform with their own auth-injecting proxy — there is no extension point in this POJO. The schema implicitly assumes 'an unauthenticated HTTP service reachable on the platform's egress'. The live doc page does not warn operators of this missing surface." — evidence: GenAIProperties.java:8-12 (only 3 fields) + WebClientConfiguration.java:26-29 (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`, no `ExchangeFilterFunction`) — severity: HIGH
- "No provider abstraction: the constants `QUERY_DATA = '/query_data'` and `QUESTION_FIELD = 'question'` are hardcoded in `GenAIServiceImpl.java:22-23`. The POJO has no `endpoint` field to override the path and no `requestSchema` field to switch between provider request shapes (OpenAI Chat Completions, Anthropic Messages, etc.). The implicit contract is 'a service at `{genai.url}/query_data` accepting JSON `{\"question\": \"...\"}` and returning a string'. Off-the-shelf LLM providers do not match this shape; operators must front the platform with their own shim." — evidence: GenAIServiceImpl.java:22-23 + GenAIProperties.java:8-12 — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "GenAIProperties.java:9"
      name: "enabled"
      value: "false (Java primitive default + application.yml:18 explicit `enabled: false`)"
      questions:
        - q: "What at N = 0 (false)?"
          a: "Feature off: GenAIServiceImpl.java:37 short-circuits with BadUserRequestException('Gen AI is disabled'). The genAiWebClient bean is still constructed at startup (with whatever url/timeout were supplied, possibly nulls). No outbound call is made."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:37-39"
        - q: "What at N = 1 (true)?"
          a: "Feature on: the controller proceeds to the WebClient.post call. If url is null OR requestTimeout is 0, see Q3."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:41-52 + WebClientConfiguration.java:22-29"
        - q: "What at null / type-error inputs?"
          a: "Java primitive boolean — null is impossible; the binding either succeeds with true/false or fails to bind. Spring's relaxed binding accepts 'true'/'false'/'yes'/'no'/'1'/'0' (case-insensitive) at the YAML/env layer; anything else fails the BindException at boot."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:9 (primitive boolean)"
        - q: "What does the operator see at each boundary?"
          a: "enabled=false → HTTP 400 with 'Gen AI is disabled' (documented, expected). enabled=true with all other fields default → cascading runtime failure on first request (silent boot, then first POST /api/genai/ask returns 500 with either NPE on baseUrl or immediate ReadTimeoutException — see P-180)."
          confidence: PROBE-NEEDED
          evidence: "P-180"
    - location: "GenAIProperties.java:10"
      name: "url"
      value: "null (Java field default — no initializer; application.yml:19 comments out the example)"
      questions:
        - q: "What at null (the actual default)?"
          a: "WebClientConfiguration.java:28 calls `.baseUrl(null)` on the WebClient builder. Spring's WebClient.Builder treats null baseUrl as 'no base URL set' — subsequent .post().uri('/query_data') resolves '/query_data' as a relative URI with no scheme/host. Reactor Netty raises IllegalArgumentException or URI-resolution error at first request, NOT at bean construction. The platform boots cleanly."
          confidence: PROBE-NEEDED
          evidence: "P-180"
        - q: "What at an unreachable host (e.g. http://nonexistent.invalid)?"
          a: "WebClient connect fails with ConnectException, surfaced through the .onErrorResume at GenAIServiceImpl.java:48-51 as a generic GenAIException (not the timeout branch — the cause is not a ReadTimeoutException). The user sees HTTP 500 with the wrapped exception message."
          confidence: STATIC-INFERRED
          evidence: "GenAIServiceImpl.java:48-51"
        - q: "What at a malformed URL (e.g. 'not-a-url')?"
          a: "WebClient.builder().baseUrl('not-a-url').build() does NOT throw at construction; URI parsing is deferred. First request raises IllegalArgumentException via reactor-netty URI resolution. No allowlist, no scheme check, no @URL validation."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:10 (no validation) + WebClientConfiguration.java:28 (.baseUrl(...) with no pre-check)"
        - q: "What at a privileged-internal URL (e.g. http://localhost:9091/actuator)?"
          a: "Accepted. The WebClient happily POSTs to any URL the operator supplies. SSRF risk: an attacker with config-write access (e.g. compromised /actuator/refresh) can pivot the platform's egress identity at any reachable host. No allowlist; the live doc page does not surface this."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:10 + WebClientConfiguration.java:28"
        - q: "What does the operator see at each boundary?"
          a: "url=null + enabled=true → 500 on first request, no boot warning. url=garbage → same; the error message buries the configuration mistake. url=privileged-internal → silent success; the platform fires the operator's question text at the internal host."
          confidence: PROBE-NEEDED
          evidence: "P-180"
    - location: "GenAIProperties.java:11"
      name: "requestTimeout"
      value: "0 (Java primitive int default — no initializer; application.yml:20 comments out the example)"
      questions:
        - q: "What at N = 0 (the default)?"
          a: "WebClientConfiguration.java:23 calls Duration.ofMinutes(0), which is Duration.ZERO. Reactor Netty's HttpClient.responseTimeout(Duration.ZERO) is a legal call — the value is 'wait zero time for the response'. First outbound POST fires; the response timeout triggers immediately (or within nanoseconds). The .onErrorResume at GenAIServiceImpl.java:48-51 catches the ReadTimeoutException and surfaces 'Gen AI request take longer that 0 min' to the user."
          confidence: PROBE-NEEDED
          evidence: "P-179"
        - q: "What at N = 1 (the smallest sensible value)?"
          a: "responseTimeout = 1 minute. Reasonable for a fast LLM. The Mono completes if the external service replies within 60s; otherwise ReadTimeoutException → 'Gen AI request take longer that 1 min'."
          confidence: STATIC-INFERRED
          evidence: "WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51"
        - q: "What at N = MAX_INT (2,147,483,647)?"
          a: "Duration.ofMinutes(MAX_INT) ≈ 4080 years. Legal Duration, the WebClient will never time out on the responseTimeout side. The inbound HTTP request thread on the platform side would still time out per Spring WebFlux defaults, but the outbound socket can stay open indefinitely. Resource-leak class."
          confidence: STATIC-INFERRED
          evidence: "WebClientConfiguration.java:23 (no upper bound check)"
        - q: "What at N = negative (e.g. -5)?"
          a: "Spring binding accepts negative int. Duration.ofMinutes(-5) is a legal negative Duration. Reactor Netty's responseTimeout behavior on a negative value is undocumented — possible NPE, possible silently no-effective-timeout, possible immediate timeout. No @Min validation."
          confidence: PROBE-NEEDED
          evidence: "P-179"
        - q: "What does the operator see at each boundary?"
          a: "N=0 → every request fails with the misleading message 'Gen AI request take longer that 0 min'. N=MAX_INT → silent hang on a slow external service (no platform-side cutoff). N=negative → undefined behavior, possibly silent."
          confidence: PROBE-NEEDED
          evidence: "P-179"
  name_behavior_pairs:
    - name: "GenAIProperties (the class itself, on the operator surface)"
      promise: "Carries the configuration the platform needs to talk to a Generative AI service. The class name implies a complete config object."
      implementation: "Carries the bare minimum: a boolean toggle, a base URL, and a single timeout. No apiKey, no model, no maxTokens, no provider abstraction, no rateLimit, no temperature. Operators integrating with a paid LLM must front the platform with their own auth-injecting + request-shaping shim."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator reading the YAML reference and assuming this is 'how you configure GenAI' will not discover until first-request that no API-key field exists. The live doc page now documents the absence ('no authentication') but does not flag the resulting deployment-shape constraint (the platform expects an unauthenticated internal LLM proxy, NOT a SaaS endpoint)."
      confidence: STATIC-INFERRED
      evidence: "GenAIProperties.java:8-12 (three fields total)"
    - name: "requestTimeout / genai.request_timeout (the YAML key + Java field name)"
      promise: "The name 'request timeout' suggests how long the platform spends sending the request to the external service (a request-side budget — connect timeout + send timeout)."
      implementation: "Wired into Reactor Netty's HttpClient.responseTimeout(Duration.ofMinutes(N)) at WebClientConfiguration.java:23 — this is the RESPONSE timeout (how long to wait for a reply AFTER sending). The actual request-side timeout (connect + send) uses Reactor Netty's defaults — no operator-tunable knob. The live doc page documents this correctly as 'outbound response timeout' but the YAML key name preserves the original promise."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator who set genai.request_timeout=5 expecting 'fail fast if the request takes more than 5min to send' actually gets 'wait up to 5min for the external service to reply'. For LLMs (where the wait is almost entirely server-side processing) the practical result is close to the operator's intent, BUT a misconfigured downstream proxy that hangs at the TCP/TLS handshake stage would be governed by Reactor Netty defaults, not by genai.request_timeout."
      confidence: STATIC-INFERRED
      evidence: "GenAIProperties.java:11 (`requestTimeout`) + WebClientConfiguration.java:23 (`.responseTimeout(...)`)"
    - name: "isEnabled() (the request-time gate method)"
      promise: "Boolean accessor that returns whether the GenAI feature is on."
      implementation: "Lombok-generated getter for the `enabled` primitive boolean. Returns false by default. Used by GenAIServiceImpl.java:37 as a per-request gate. The bean construction path does NOT consult isEnabled() — the genAiWebClient bean is built regardless of the toggle. Disabling GenAI does NOT free the WebClient resources."
      drift: MINOR
      operator_visible_consequence: "Operator-imperceptible — the resource footprint of an idle WebClient bean is negligible. Worth noting for the bean-lifecycle invariant (LSN-002-class concern: the bean is wired with whatever url/timeout were supplied, even when the feature is gated off; toggling enabled=true later does NOT re-validate url/requestTimeout)."
      confidence: STATIC-INFERRED
      evidence: "WebClientConfiguration.java:20-30 (bean constructed unconditionally) + GenAIServiceImpl.java:37 (per-request gate)"
  orderings: []
  auth_gates:
    - location: "GenAIProperties.java:8-12"
      endpoint: "(this POJO does not host an endpoint; it carries the config that the GenAIController endpoint reads)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "REFERENCE — the auth posture lives at the GenAIController. Cross-reference: under DISABLED, anyone reachable can POST /api/genai/ask. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user can — there is no Permission gate. Confirmed at GenAIController.java:13-24 (no @PreAuthorize, no permissionService check)."
          confidence: REFERENCE
          evidence: "odd-platform java GenAIController controller-class:GenAIController"
        - q: "What does an unauthenticated caller see?"
          a: "REFERENCE — DISABLED mode: success (open endpoint). Non-DISABLED: 401 Unauthorized at the global Spring Security chain before reaching the controller."
          confidence: REFERENCE
          evidence: "odd-platform java GenAIController controller-class:GenAIController"
        - q: "What does a wrong-role caller see?"
          a: "REFERENCE — any authenticated user passes the gate; no role / permission / owner filter exists on this surface."
          confidence: REFERENCE
          evidence: "odd-platform java GenAIController controller-class:GenAIController"
        - q: "Where does the gate live?"
          a: "Nowhere on the POJO side. The only request-time gate is `genAIProperties.isEnabled()` at GenAIServiceImpl.java:37 — that is a feature-availability gate, NOT an authorization gate. No @PreAuthorize on the controller, no programmatic permissionService call, no Permission enum entry for GENAI_USE."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:8-12 + GenAIServiceImpl.java:37 + GenAIController.java:13-24 (REFERENCE)"
  resource_boundaries:
    - location: "WebClientConfiguration.java:20-30"
      kind: "bean-lifecycle (startup-baked)"
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The POJO is a singleton @ConfigurationProperties bean. Lombok @Data generates non-synchronized setters, but Spring binding writes to it once at boot (single-threaded). After boot the bean is effectively read-only (no /actuator/refresh writes it; no Spring Cloud Config wiring observed). isEnabled() is a primitive-boolean read — atomic on x86/ARM, no torn-read concern. Concurrent reads are safe."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:7 (`@Data` Lombok) + WebClientConfiguration.java:15 (`@EnableConfigurationProperties` — single-bind at boot)"
        - q: "Is the call replay-safe?"
          a: "N/A — this is a config POJO, not a request handler. The replay-safety property belongs to GenAIServiceImpl.getResponseFromGenAI (REFERENCE). The POJO itself is idempotent under read."
          confidence: REFERENCE
          evidence: "odd-platform java GenAIServiceImpl service-class:GenAIServiceImpl (when enriched)"
        - q: "What is the cache TTL / eviction key / staleness window?"
          a: "No cache fronts the POJO. The bean is read from memory on each isEnabled() call (volatile-equivalent for primitive boolean). url and requestTimeout are NOT re-read at runtime — they are baked into the genAiWebClient at boot. To change url/requestTimeout, restart the platform; to change enabled, just flip the YAML AND restart (env var changes also require restart since @ConfigurationProperties is not refresh-scoped)."
          confidence: STATIC-INFERRED
          evidence: "WebClientConfiguration.java:20-30 (bean constructed once at @Bean evaluation)"
        - q: "What does the operator see at each boundary?"
          a: "Toggling genai.enabled at runtime via /actuator/refresh (if exposed) would NOT take effect on the toggled field — @ConfigurationProperties beans are not refresh-scoped by default. The operator's mental model of 'flip the env var, restart, done' is correct; the model of 'flip via /actuator/refresh' is wrong but the doc does not flag this."
          confidence: STATIC-INFERRED
          evidence: "GenAIProperties.java:6-8 (no @RefreshScope)"
  request_inputs: []  # GenAIProperties does not host HTTP request inputs; it is a typed config POJO. The HTTP-input Category F triggers belong to GenAIController. See cross-reference.
  probes_emitted:
    - probe_id: P-180
      question: "What does the operator actually see when genai.enabled=true with url=null and request_timeout=0? Specific failure mode, response shape, error message."
      probe_path: "lineage/odd-platform/probes/P-180.yaml"
    - probe_id: P-178
      question: "Is the relaxed binding for genai.request_timeout (snake_case) ↔ Java requestTimeout (camelCase) ↔ env GENAI_REQUEST_TIMEOUT actually three-way active? Pin the binding contract before a future field-rename breaks it silently."
      probe_path: "lineage/odd-platform/probes/P-178.yaml"
    - probe_id: P-179
      question: "What does Reactor Netty's HttpClient.responseTimeout(Duration.ofMinutes(N)) actually do at N=0 and N=negative? Pin the LSN-002-class concern: a primitive-int default of 0 silently misconfigures the SDK."
      probe_path: "lineage/odd-platform/probes/P-179.yaml"
  stress_summary:
    triggers_total: 5      # 3 tunables + 1 bean-lifecycle + 1 auth-gate-by-reference
    questions_total: 23
    answers_static_inferred: 15
    answers_probe_needed: 5
    answers_reference: 3
    drift_flags: 2         # GenAIProperties-class-vs-completeness + requestTimeout-vs-responseTimeout
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `GenAIProperties` is a typed config POJO, not on the HTTP surface itself. The runtime consumer `GenAIController` (`POST /api/genai/ask`) is a `@RestController implements GenaiApi` with no auth annotations of its own; protection comes from the global Spring Security chain when `auth.type` is set to `LOGIN_FORM | OAUTH2 | LDAP`. Under `auth.type=DISABLED` the endpoint is unauthenticated — same fail-open posture as every other UI/API endpoint in this mode. The POJO's `enabled` flag is a feature gate (returns HTTP 400 when off), NOT an auth gate.
- **ingestion_filter_relevance**: `N/A — UI/API surface, not ingestion` — `POST /api/genai/ask` is not under `/ingestion/entities` and is not gated by `auth.ingestion.filter.enabled`.
- **authorization_assertions**: `[]` — `GenAIController` has no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, and no Permission/Role/Owner check. Any authenticated user (under any non-DISABLED auth mode) can invoke `POST /api/genai/ask`. There is no `GENAI_USE` Permission. The generated `GenaiApi` interface carries no authorization annotations either.
- **owner_scoping**: `N/A — code is not data-scoped` — `GenAIProperties` carries no owner/tenant fields; the question payload is sent verbatim to the external AI service with no per-user, per-owner, or per-data-entity filter applied at the controller or service layer.
- **data_exposure**:
  - `"genai.url (external LLM endpoint URL) → resolved into the genAiWebClient bean at startup; not a secret per se, but exposed in /actuator/env if the actuator endpoint is reachable. NO masking annotation (no @Value Sanitization, no Spring Boot env-endpoint sanitization rule)"` — evidence: GenAIProperties.java:10 + WebClientConfiguration.java:28
  - `"User-supplied free-text question (GenAIRequest.body) → forwarded as JSON {\"question\": \"...\"} to {genai.url}/query_data over plain WebClient (no auth header, no body redaction, no PII scrubbing)"` — evidence: GenAIServiceImpl.java:41-45
  - `"External AI service response (raw String, JSON-unescaped, quote-trimmed) → returned to any authenticated caller as GenAIResponse.body. No content filtering of the response (an LLM that returns sensitive data — system prompt leak, internal docs — would pass through verbatim)"` — evidence: GenAIServiceImpl.java:45-47
- **known_security_gaps**:
  - `"GenAIProperties carries no apiKey / token / authorization field. The genAiWebClient is constructed without any defaultHeader(HttpHeaders.AUTHORIZATION, ...). Operators deploying this feature MUST put the external AI service on a trusted network or front it with their own auth proxy; the platform has no native way to send credentials. The live doc page now documents this absence ('the platform sends no authentication') — but does not flag the deployment-shape constraint that follows (you cannot point this at OpenAI/Anthropic/Azure directly)."` — evidence: GenAIProperties.java:8-12 (no auth fields) + WebClientConfiguration.java:26-29 (no defaultHeader / filter / ExchangeFilterFunction) — severity: HIGH
  - `"genai.url is fed raw to WebClient.baseUrl(...) with no allowlist, no scheme check, no @URL validation, no SSRF guard. An operator who exposes /actuator/refresh (or an attacker who lands config injection elsewhere) can pivot the platform's outbound POST at any reachable URL. The WebClient runs in the platform's JVM, so requests originate from the platform's egress identity (relevant on a VPC with privileged internal endpoints — Kubernetes metadata service, cloud metadata endpoints, internal monitoring stacks)."` — evidence: WebClientConfiguration.java:28 (`baseUrl(genAIProperties.getUrl())` — no validation) + GenAIProperties.java:10 (`private String url;` — no @URL, no @Pattern) — severity: HIGH
  - `"No @Sensitive / @ToString.Exclude on the url field. If the application logs at DEBUG/TRACE and Lombok's @Data toString() is invoked anywhere (e.g. an env-dump on shutdown, a bean-introspection logger), the genai.url is emitted in plain text. The url itself is rarely a secret, but operators using the URL as the auth boundary (e.g. embedding an API token in the path or query string) leak that token in logs without warning."` — evidence: GenAIProperties.java:7 (`@Data` generates toString() across all fields) — severity: MEDIUM
  - `"GenAIController has no @PreAuthorize and no rate-limit. Any authenticated user can pose questions and consume the external AI quota — no Permission gate, no per-user throttle. Under auth.type=DISABLED (dev mode) the endpoint is fully open. Cost-attribution and abuse mitigation depend entirely on whatever the external AI service enforces, not on the platform. Cross-reference: this gap is fully owned by the GenAIController sidecar; recorded here because the POJO is the natural place to plug a rate-limit field (e.g. genai.rate_limit_per_user_per_hour) that doesn't exist."` — evidence: GenAIController.java:13-24 (REFERENCE) + GenAIProperties.java:8-12 (no rate-limit field) — severity: HIGH
  - `"User-supplied question text is forwarded verbatim to the external service with no redaction. If operators configure genai.url to a third-party SaaS (the typical case after fronting with an auth shim), every question — including any sensitive content typed into the UI — leaves the platform's trust boundary with no in-platform audit log. The platform does not record what was asked, by whom, when, against which catalog state."` — evidence: GenAIServiceImpl.java:41-43 (verbatim forward) — severity: HIGH

## performance

- **hot_paths**:
  - `"POST /api/genai/ask → GenAIServiceImpl.getResponseFromGenAI fires one outbound POST {genai.url}/query_data per inbound request, on the reactive request pipeline. Latency is bounded by the external service's response time and the configured genai.request_timeout (in minutes, i.e. coarse). isEnabled() is re-read on every request as a cheap primitive-read guard before the outbound call."` — evidence: GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
- **throughput_characteristics**:
  - `"single-question POST per inbound request — no batching, no streaming, no token-by-token incremental response (the entire LLM response is materialized in memory before being returned)"` — evidence: GenAIServiceImpl.java:41-45 (one .post() per call, .bodyToMono(String.class) materializes the full response)
  - `"reactive Mono signature throughout — non-blocking on the platform side, but each inbound request still holds an outbound socket for up to genai.request_timeout minutes (default 0 = immediate timeout)"`
  - `"no caching of responses — identical questions re-fire to the external service"` — evidence: GenAIServiceImpl.java:35-52 (no @Cacheable, no in-memory cache)
- **resource_allocation**:
  - `"genAiWebClient is built once at startup from a single Reactor Netty HttpClient.create() — no explicit ConnectionProvider tuning, so default Reactor Netty pool sizing applies (default: max-connections = 2 * available processors, pending acquire timeout = 45s)"` — evidence: WebClientConfiguration.java:22-29 (no .connectionProvider(...) override)
  - `"responseTimeout is configured from genai.request_timeout in minutes — Duration.ofMinutes(N). LSN-002-class concern: when N=0 (the Java primitive default for an unset int), Duration.ofMinutes(0) is a legal zero Duration and Reactor Netty treats it as immediate timeout. There is no @Min(1), no defaulting, no fail-fast at startup."` — evidence: WebClientConfiguration.java:23 + GenAIProperties.java:11 (no initializer, no @Min)
  - `"no max-in-memory-size override on the genAiWebClient — uses Spring WebFlux global codec default from application.yml:14-15 (spring.codec.max-in-memory-size: 20MB). Large LLM responses above 20MB fail with DataBufferLimitException; the doc page does not surface this."` — evidence: WebClientConfiguration.java:26-29 (no .codecs(...) configuration) + application.yml:14-15 (global codec setting)
  - `"no defaultHeader for User-Agent — the external service sees the default Reactor Netty UA, which complicates cost-attribution and abuse-tracking on the AI vendor side"` — evidence: WebClientConfiguration.java:26-29
- **scaling_characteristics**:
  - `"each platform instance fires its own outbound — no shared rate limiter, no distributed concurrency cap, no token bucket. N replicas behind a load balancer multiply the effective request rate to the external service by N."` — evidence: GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30 (no Bulkhead / RateLimiter / Resilience4j wiring)
  - `"GenAIProperties is stateless config — instances scale horizontally without coordination. The bottleneck is the external AI service, not the platform."`
  - `"genai.url + genai.request_timeout are baked into the bean at startup — config changes require a Platform restart to take effect, so operators cannot tune timeout without downtime"` — evidence: WebClientConfiguration.java:20-30 (`@Bean` constructed once)
- **known_performance_gaps**:
  - `"genai.request_timeout default is 0 (Java primitive int default, not a YAML-supplied default). When operators set genai.enabled=true without explicitly setting genai.request_timeout, every request fails immediately with a ReadTimeoutException, surfaced as 'Gen AI request take longer that 0 min' — a confusing user error rather than a configuration error at boot. This is the LSN-002-class analogue for SDK builders: an unset parameter ships silent misbehaviour rather than a fail-fast at startup."` — evidence: GenAIProperties.java:11 (`private int requestTimeout;`) + WebClientConfiguration.java:23 (`Duration.ofMinutes(0)` is legal) + GenAIServiceImpl.java:48-51 (error message reads the misconfigured value back) — severity: HIGH
  - `"no retry, no exponential backoff, no circuit breaker on the outbound call — a single transient failure surfaces as a GenAIException to the user even when the external service would have succeeded on retry. There is no .retryWhen(...) on the Mono chain and no Resilience4j @CircuitBreaker on GenAIServiceImpl."` — evidence: GenAIServiceImpl.java:41-52 (no .retry / .retryWhen / @CircuitBreaker / @Retryable) — severity: MEDIUM
  - `"no outbound concurrency cap declared on the genAiWebClient — relies on Reactor Netty's default ConnectionProvider. Under a burst of /api/genai/ask requests, the platform may queue connections in the Reactor pool and pending requests block on acquire (default pendingAcquireTimeout=45s) before either succeeding or failing — no explicit operator-tunable knob for this."` — evidence: WebClientConfiguration.java:22-29 (no .connectionProvider(...) override) — severity: LOW
  - `"there is no shared cache for repeat questions — every inbound /api/genai/ask hits the external service. For identical-question burst patterns this multiplies cost and latency unnecessarily; the external service is the only line of defense."` — evidence: GenAIServiceImpl.java:35-52 (no cache lookup) — severity: LOW

## upstream_callers

- entry_point: "boot:@EnableConfigurationProperties(GenAIProperties.class)"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.config config-class:WebClientConfiguration"
  multiplicity_per_trigger: 1
  evidence: "WebClientConfiguration.java:15 — `@EnableConfigurationProperties(GenAIProperties.class)` registers the singleton GenAIProperties bean at Spring boot; the bean is bound from `genai.*` YAML at boot and survives for the JVM lifetime"
  observation_class: boot-eval
  unresolved: false

- entry_point: "boot:@Bean('genAiWebClient')"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.config config-class:WebClientConfiguration"
  multiplicity_per_trigger: 1
  evidence: "WebClientConfiguration.java:20-30 — at @Bean evaluation, calls `genAIProperties.getUrl()` once (for `.baseUrl(...)`) and `genAIProperties.getRequestTimeout()` once (for `.responseTimeout(Duration.ofMinutes(...))`). Both reads happen at startup; the WebClient bean is then immutable for the JVM lifetime."
  observation_class: boot-eval
  unresolved: false

- entry_point: "rest:POST /api/genai/ask"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.service.genai service-class:GenAIServiceImpl"
  multiplicity_per_trigger: 2
  evidence: "GenAIServiceImpl.java:37 (`genAIProperties.isEnabled()` — per-request gate, READ ONCE per call) + GenAIServiceImpl.java:50 (`genAIProperties.getRequestTimeout()` — read in the error-message formatter ONLY when a ReadTimeoutException fires; under happy path the count is 1, under timeout path 2)"
  observation_class: rest-call
  unresolved: false

## downstream_side_effects

- side_effect_class: cache-mutate
  description: "Spring registers a singleton GenAIProperties bean in the BeanFactory; the bean is the canonical in-memory representation of the genai.* YAML/env state for the JVM lifetime"
  evidence: "WebClientConfiguration.java:15 + GenAIProperties.java:6 (`@ConfigurationProperties('genai')`)"
  cardinality_per_call: "1 (per JVM boot — N/A per HTTP call; reads after boot are read-only)"
  reachable_from_entry_points:
    - "boot:@EnableConfigurationProperties(GenAIProperties.class)"

- side_effect_class: cache-mutate
  description: "The genAiWebClient @Bean is constructed at startup using GenAIProperties — baking genai.url into .baseUrl(...) and genai.request_timeout into .responseTimeout(Duration.ofMinutes(N)). The WebClient is then registered as the singleton bean named 'genAiWebClient'."
  evidence: "WebClientConfiguration.java:20-30"
  cardinality_per_call: "1 (per JVM boot)"
  reachable_from_entry_points:
    - "boot:@Bean('genAiWebClient')"

- side_effect_class: log-emit
  description: "If logging at DEBUG/TRACE and any code calls GenAIProperties.toString() (Lombok @Data-generated), the url and other fields are emitted to logs. No @ToString.Exclude / @Sensitive annotation prevents this."
  evidence: "GenAIProperties.java:7 (`@Data`) — Lombok generates toString() with ALL fields"
  cardinality_per_call: "0..N (depends on log level + whether anyone calls toString())"
  reachable_from_entry_points:
    - "boot:@EnableConfigurationProperties(GenAIProperties.class)"
    - "(any code path that introspects the bean)"
  unresolved: true   # exhaustive list of callers that may invoke toString() is out of scope

## sources

- understanding ← GenAIProperties.java:1-13 + WebClientConfiguration.java:14-31 + GenAIServiceImpl.java:25-52
- concepts.entities.GenAIProperties ← GenAIProperties.java:6-12
- concepts.entities.genAiWebClient ← WebClientConfiguration.java:20-30
- concepts.invariants.[enabled-request-time-gate] ← GenAIServiceImpl.java:37-39
- concepts.invariants.[url-and-timeout-startup-bound] ← WebClientConfiguration.java:22-29
- concepts.invariants.[primitive-types-relaxed-binding] ← GenAIProperties.java:9-11
- concepts.invariants.[no-validation-annotations] ← GenAIProperties.java:1-12 (Grep for `@Validated`, `@NotNull`, `@Min`, `@URL` returned zero hits)
- dependencies_semantic.requires-feature.[genai-controller-surface] ← GenAIController.java:13-23 + openapi.yaml:4194-4213
- dependencies_semantic.requires-feature.[external-ai-service-contract] ← GenAIServiceImpl.java:22-23 (`QUERY_DATA = "/query_data"`, `QUESTION_FIELD = "question"`) + GenAIServiceImpl.java:41-43
- dependencies_semantic.requires-config.genai.enabled ← application.yml:17-18
- dependencies_semantic.requires-config.genai.url ← application.yml:19 (commented out) + GenAIProperties.java:10 (no initializer)
- dependencies_semantic.requires-config.genai.request_timeout ← application.yml:20 (commented out) + GenAIProperties.java:11 (no initializer)
- dependencies_semantic.requires-runtime.[EnableConfigurationProperties] ← WebClientConfiguration.java:15
- dependencies_semantic.requires-runtime.[lombok-data] ← GenAIProperties.java:3 (`import lombok.Data;`) + line 7 (`@Data`)
- tests_coverage_semantic.gaps ← Grep result: `find <odd-platform> -path "*/test/*" -name "*.java" | xargs grep -l "GenAI"` returns zero matches (verified 2026-05-26)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-26, status 200, anchor `genai-configuration` confirmed present
- docs_link_semantic.fetched_excerpts ← WebFetch on 2026-05-26
- docs_link_semantic.doc_drift_findings.[request-timeout-naming-drift] ← GenAIProperties.java:11 + WebClientConfiguration.java:23 (cross-check)
- docs_link_semantic.doc_drift_findings.[no-ssrf-warning] ← WebFetch result + GenAIProperties.java:10 (no validation) + WebClientConfiguration.java:28 (no scheme/allowlist check)
- implicit_adrs.[0] ← GenAIProperties.java:9 + application.yml:17-18
- implicit_adrs.[1] ← WebClientConfiguration.java:20-30 + GenAIServiceImpl.java:37
- implicit_adrs.[2] ← WebClientConfiguration.java:15 + GenAIProperties.java:1-12
- bugs_limitations_corner_cases.[silent-misconfig-default] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:22-29
- bugs_limitations_corner_cases.[zero-timeout-silent-accept] ← WebClientConfiguration.java:23 + GenAIProperties.java:11
- bugs_limitations_corner_cases.[primitive-binding] ← GenAIProperties.java:11
- bugs_limitations_corner_cases.[no-validation] ← GenAIProperties.java:1-12
- bugs_limitations_corner_cases.[request-vs-response-timeout-drift] ← GenAIProperties.java:11 + WebClientConfiguration.java:23
- bugs_limitations_corner_cases.[no-apikey-no-extension] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:26-29
- bugs_limitations_corner_cases.[no-provider-abstraction] ← GenAIServiceImpl.java:22-23 + GenAIProperties.java:8-12
- stress_findings.tunables.enabled ← GenAIProperties.java:9 + GenAIServiceImpl.java:37-39
- stress_findings.tunables.url ← GenAIProperties.java:10 + WebClientConfiguration.java:28 + GenAIServiceImpl.java:48-51
- stress_findings.tunables.requestTimeout ← GenAIProperties.java:11 + WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51
- stress_findings.name_behavior_pairs.[class-completeness] ← GenAIProperties.java:8-12
- stress_findings.name_behavior_pairs.[requestTimeout-vs-responseTimeout] ← GenAIProperties.java:11 + WebClientConfiguration.java:23
- stress_findings.name_behavior_pairs.[isEnabled-bean-lifecycle] ← WebClientConfiguration.java:20-30 + GenAIServiceImpl.java:37
- stress_findings.auth_gates.[no-poison-pill] ← GenAIController.java:13-24 (REFERENCE) + GenAIProperties.java:8-12 + GenAIServiceImpl.java:37
- stress_findings.resource_boundaries.[bean-lifecycle] ← GenAIProperties.java:7 (`@Data`) + WebClientConfiguration.java:15 + WebClientConfiguration.java:20-30
- security.auth_mode_relevance ← GenAIController.java:13-24 (REFERENCE) + GenAIProperties.java:1-13 (typed POJO, not on HTTP surface)
- security.ingestion_filter_relevance ← GenAIController.java:13-24 (REFERENCE — route is `/api/genai/ask` per GenaiApi, not under `/ingestion/entities`)
- security.authorization_assertions.[empty] ← GenAIController.java:13-24 (REFERENCE — no @PreAuthorize / permissionService call)
- security.data_exposure.[genai-url-actuator] ← GenAIProperties.java:10 + WebClientConfiguration.java:28
- security.data_exposure.[user-question-forward] ← GenAIServiceImpl.java:41-45
- security.data_exposure.[ai-response-passthrough] ← GenAIServiceImpl.java:45-47
- security.known_security_gaps.[no-auth-field] ← GenAIProperties.java:8-12 + WebClientConfiguration.java:26-29
- security.known_security_gaps.[no-url-allowlist] ← WebClientConfiguration.java:28 + GenAIProperties.java:10
- security.known_security_gaps.[lombok-tostring-leak] ← GenAIProperties.java:7
- security.known_security_gaps.[no-preauthorize] ← GenAIController.java:13-24 (REFERENCE) + GenAIProperties.java:8-12 (no rate-limit field)
- security.known_security_gaps.[no-redaction-no-audit] ← GenAIServiceImpl.java:41-43
- performance.hot_paths.[per-request-outbound] ← GenAIServiceImpl.java:35-52 + GenAIController.java:18-23
- performance.throughput_characteristics.[single-question] ← GenAIServiceImpl.java:41-45
- performance.throughput_characteristics.[reactive-mono] ← GenAIServiceImpl.java:36 + GenAIController.java:19-23
- performance.throughput_characteristics.[no-cache] ← GenAIServiceImpl.java:35-52
- performance.resource_allocation.[default-pool] ← WebClientConfiguration.java:22-29
- performance.resource_allocation.[zero-timeout-default] ← WebClientConfiguration.java:23 + GenAIProperties.java:11
- performance.resource_allocation.[default-max-in-memory] ← WebClientConfiguration.java:26-29 + application.yml:14-15
- performance.resource_allocation.[no-user-agent] ← WebClientConfiguration.java:26-29
- performance.scaling_characteristics.[no-shared-rate-limiter] ← GenAIServiceImpl.java:41 + WebClientConfiguration.java:20-30
- performance.scaling_characteristics.[stateless-config] ← GenAIProperties.java:1-13
- performance.scaling_characteristics.[startup-baked-config] ← WebClientConfiguration.java:20-30
- performance.known_performance_gaps.[zero-timeout-default] ← GenAIProperties.java:11 + WebClientConfiguration.java:23 + GenAIServiceImpl.java:48-51
- performance.known_performance_gaps.[no-retry] ← GenAIServiceImpl.java:41-52
- performance.known_performance_gaps.[no-concurrency-cap] ← WebClientConfiguration.java:22-29
- performance.known_performance_gaps.[no-cache] ← GenAIServiceImpl.java:35-52
- upstream_callers.[boot-enable-config] ← WebClientConfiguration.java:15
- upstream_callers.[boot-bean-construct] ← WebClientConfiguration.java:20-30
- upstream_callers.[rest-per-request-gate] ← GenAIServiceImpl.java:37 + GenAIServiceImpl.java:50
- downstream_side_effects.[bean-registration] ← WebClientConfiguration.java:15 + GenAIProperties.java:6
- downstream_side_effects.[webclient-construction] ← WebClientConfiguration.java:20-30
- downstream_side_effects.[lombok-tostring-log-emit] ← GenAIProperties.java:7

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
- downstream_side_effects: MEDIUM   # one entry (lombok-tostring) marked unresolved — exhaustive caller list out of scope
- stress_findings: MEDIUM            # 5 of 23 questions are PROBE-NEEDED (the load-bearing boundary behaviours at url=null / requestTimeout=0 / requestTimeout=negative); HIGH only after P-180 / P-178 / P-179 run

## Maintainer notes


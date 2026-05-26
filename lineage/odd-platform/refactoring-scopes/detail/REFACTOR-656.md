## REFACTOR-656 — GenAI's `genAiWebClient` builder does NOT call `.codecs(c -> c.defaultCodecs().maxInMemorySize(...))` — uses Spring WebFlux default 256KB; long-form LLM responses > 256KB fail with `DataBufferLimitException`; the application-wide `spring.codec.max-in-memory-size: 20MB` is NOT inherited

**Severity**: MEDIUM
**Category**: codec-default-misuse
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-07 Active Platform Features (GenAI), P-09 Configuration]

**Surfaced by**:
- `odd-platform__java__GenAIController__controller-class__GenAIController.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "**No max-in-memory-size override on the genAiWebClient** — uses Spring WebFlux default of 256KB (DataBufferLimitException above that), so LLM responses > 256KB will throw mid-stream. The application-wide `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) applies to default codecs but the `WebClient.builder()` chain in WebClientConfiguration.java:26-29 does not call `.codecs(c -> c.defaultCodecs().maxInMemorySize(...))` to inherit it onto this client. Verbose LLM answers (e.g. long-form summaries) silently fail."

**Statement**: The `genAiWebClient` is built via `WebClient.builder()` at `WebClientConfiguration.java:26-29`. The builder does NOT call `.codecs(c -> c.defaultCodecs().maxInMemorySize(...))`, so the per-client max-in-memory-size defaults to Spring WebFlux's hardcoded 256KB. The application-wide YAML setting `spring.codec.max-in-memory-size: 20MB` (`application.yml:14-15`) applies ONLY to default Spring-emitted codecs; it is NOT inherited automatically by `WebClient.builder()`-built clients.

Operator-visible failure mode:
- LLM response < 256KB → works.
- LLM response > 256KB → `DataBufferLimitException` thrown mid-deserialisation; the controller's `.onErrorResume` catches only `ReadTimeoutException` (`GenAIServiceImpl.java:48-51`); other exceptions fall to the generic `GenAIException(Throwable)` branch → HTTP 500 with whatever `e.getMessage()` returns.
- An operator running a verbose external LLM (e.g., one configured for long-form summaries, multi-paragraph reasoning, or code-generation with long output) sees a silent failure at 256KB.

This is the LSN-002-class regional analogue at the codec layer — an unset SDK builder parameter ships silent misbehaviour rather than fail-fast at startup. Cross-link with REFACTOR-016 (no `@URL` constraint on genai.url) and the broader GenAI hardening family.

**Evidence**:
- WebClient builder: `WebClientConfiguration.java:26-29` (no `.codecs(...)` call)
- App-wide YAML: `application.yml:14-15` (`spring.codec.max-in-memory-size: 20MB`)
- Default 256KB is Spring WebFlux's hardcoded value for `WebClient.builder()`-built clients without explicit codec config

**Existing-ADR-or-implied-prescription**: no governing ADR; the codec configuration was not anchored to a decision. The 20MB app-wide setting suggests the operator expected ALL clients to inherit it; the maintainer's omission of `.codecs(...)` on the GenAI client is silent misbehaviour.

**Proposed remedy**: add to `WebClientConfiguration.java` GenAI builder:
```java
return WebClient.builder()
    .baseUrl(genAIProperties.getUrl())
    .clientConnector(new ReactorClientHttpConnector(httpClient))
    .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(20 * 1024 * 1024))  // 20MB; inherit app-wide
    .build();
```

A more general fix: define a Spring `@Configuration` bean that provides a `WebClient.Builder` with the codec already configured; use that builder as the source for every WebClient in the codebase. Closes this gap + future-proofs against the same misbehaviour on any future WebClient.

**Severity rationale**: MEDIUM — silent failure at a documented capacity boundary; the operator has no way to know without reading the WebFlux source; the failure mode is HTTP 500 not a typed 4xx.

**Suggested backlog grouping**: `GenAI hardening sprint` (paired with REFACTOR-001 through -007, -014, -016, -019, -023).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-005 (GenAI thin-proxy stance — the codec config gap is one of the un-defended absences); the GenAI family of refactors.
- SUPERSEDES: none.
- CONFLICTS: none.

---

---
doc_page: "docs/active-platform-features/genai.md"
page_title: "GenAI assistant"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/genai"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/genai"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "GenAI Assistant"
    - "External LLM Service"
    - "Forward Natural-Language Question to External LLM"
  features:
    - "F-039"
  code_nodes:
    - "odd-platform java GenAIController controller-method:genAiQuestion"
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:GenAIController"
    - "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:GenAIProperties"
    - "odd-platform yaml application.yml config-prefix:genai"
    - "odd-platform openapi tags openapi-tag:genai"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Platform-to-user security danger admonition) claims 'No request-body size cap. Large free-form prompts pass through unbounded.' Code: there IS an effective 20MB ceiling — `spring.codec.max-in-memory-size: 20MB` at application.yml:15 rejects bodies over 20MB with DataBufferLimitException before they reach the controller; there is no GenAI-specific `@Size` on GenAIRequest.body, so the prompt is uncapped only WITHIN that 20MB global codec limit. 'Unbounded' overstates the surface. Evidence: odd-platform java GenAIController controller-method:genAiQuestion / GenAIController sidecar finding:performance + finding:security ('only the implicit spring.codec.max-in-memory-size: 20MB ceiling at application.yml:15') — severity LOW (operator risk flagged is real; only the word 'unbounded' is imprecise)."
  - "Page (Known limitations: 'request_timeout is in minutes') states the unit but does NOT disclose the name-vs-behavior drift: the YAML key `genai.request_timeout` is wired into Reactor Netty's HttpClient.responseTimeout(Duration.ofMinutes(N)) — the REPLY-wait timeout, not the request/send budget the name promises; there is no operator-tunable send/connect timeout. Evidence: WebClientConfiguration.java:23 + GenAIProperties.java:11 (per GenAIProperties sidecar bugs_limitations_corner_cases + the invariant:genai-request-timeout-yaml-key-actually-response-timeout graph node). The CANONICAL config home (configuration-and-deployment/odd-platform.md#genai-configuration) corrects this with 'outbound response timeout, in minutes'; this feature page links to that home but does not restate the correction — severity LOW (correction lives on the linked canonical surface)."
maintainer_curated: false
---

# GenAI assistant — doc understanding

This page is the operator/developer-facing home for the GenAI assistant: an opt-in, disabled-by-default thin proxy that forwards a free-text question from `POST /api/genai/ask` verbatim (as `{"question": "<body>"}`) to an operator-run external AI service at `POST {genai.url}/query_data`, then un-quote / Java-unescapes the response and returns it as `GenAIResponse.body`. It maps to feature `F-039` (the GenAI free-text proxy) and concept `GenAI Assistant`; the proxy operation is concept `Forward Natural-Language Question to External LLM` (implemented by `GenAIController.genAiQuestion` → `GenAIServiceImpl`), and the downstream operator-run service is concept `External LLM Service`. The endpoint surface is the `genAiQuestion` controller method on `GenAIController`; the three-key config (`genai.enabled` / `genai.url` / `genai.request_timeout`) is the `GenAIProperties` POJO bound from the `application.yml config-prefix:genai` namespace; the OpenAPI surface is `openapi-tag:genai`.

The page is unusually high-fidelity on the security posture. Its danger/warning admonitions disclose the load-bearing drift the F-039 feature node flagged: the `POST /api/genai/ask` route has **no RBAC entry** and falls through the catch-all `pathMatchers("/**").authenticated()` (confirmed at GenAIController sidecar: `AuthorizationCustomizer.java:29-30`, no `@PreAuthorize`, no `GENAI_USE` permission), is anonymously reachable under `auth.type=DISABLED`, has no per-user rate limit / audit trail / PII redaction, and carries a config-driven SSRF surface because `genai.url` has no `@URL` / scheme allow-list (GenAIProperties.java:10 + WebClientConfiguration.java:28). It also correctly documents the disabled-by-default gate (HTTP 400 "Gen AI is disabled"), the LSN-002-class silent-misconfiguration (`url` null + `request_timeout` 0 when only `enabled` is set), the no-auth / no-retry external contract, and the startup-baked WebClient (restart required for url/timeout changes). All of these are corroborated by the GenAIController + GenAIProperties sidecars.

Two residual drift findings remain, both LOW severity (see frontmatter): the page calls the request body "unbounded" when a 20MB global WebFlux codec ceiling applies (`application.yml:15`), and it states `request_timeout` is "in minutes" without restating the response-vs-send-timeout name-vs-behavior correction that the linked canonical config page carries. Note that `WebClientConfiguration` and `GenAIServiceImpl` are not scaffolded as discrete substrate CodeNodes (graph-search returned no matching nodes); their behaviour is fully captured inside the `GenAIController` controller-class sidecar and the `GenAIProperties` config-properties-class sidecar, so no node_id is bound for them (Rule 2 — confirm or omit).

## Maintainer notes

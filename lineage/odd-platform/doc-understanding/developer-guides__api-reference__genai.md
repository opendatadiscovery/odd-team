---
doc_page: "docs/developer-guides/api-reference/genai.md"
page_title: "GenAI"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/genai"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/genai"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "GenAI Assistant"
    - "Forward Natural-Language Question to External LLM"
  features:
    - "F-039"
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:GenAIController"
    - "odd-platform java GenAIController controller-method:genAiQuestion"
    - "odd-platform openapi tags openapi-tag:genai"
    - "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:GenAIProperties"
    - "odd-platform yaml application.yml config-prefix:genai"
audience: [developer, operator]
doc_claim_vs_code:
  - "Page describes genai.request_timeout only as the {minutes} value, without naming it an OUTBOUND RESPONSE timeout; the YAML key reads as a request-SEND timeout but the code wires Reactor Netty responseTimeout(Duration.ofMinutes(...)) — time to wait for the REPLY (DRIFT_NAME_VS_BEHAVIOR). Not a wrong claim on this page (config semantics are deferred via cross-link to the GenAI Configuration section), but the request_timeout=0 → Duration.ofMinutes(0) zero-timeout footgun and the request-vs-response naming nuance live only on the config page. Evidence: invariant:genai-request-timeout-yaml-key-actually-response-timeout; GenAIProperties.java:11 (primitive int default 0); WebClientConfiguration.java:23."
maintainer_curated: false
---

# GenAI — doc understanding

This API-reference page documents the platform's single GenAI HTTP endpoint —
`POST /api/genai/ask` (operation `genAiQuestion`) — a thin reactive proxy that
forwards a free-text question to an operator-run external AI service and returns
its answer. It binds to `GenAIController` (`controller:GenAIController`) and its
method `genAiQuestion`, the OpenAPI `genai` tag, the `GenAIProperties`
configuration POJO, and the `genai.*` `application.yml` prefix; conceptually it
is the canonical surface of the **GenAI Assistant** entity and the
**Forward Natural-Language Question to External LLM** operation, and it is the
API-reference face of feature **F-039**.

The page's claims are confirmed against the code with no contradicting drift.
The 400 path (`BadUserRequestException` body `"Gen AI is disabled"` when
`genai.enabled=false`) is `GenAIServiceImpl.java:37-38`; the 500 path and its
verbatim message `"Gen AI request take longer that %s min"` plus the
"no-retry / single attempt" claim are `GenAIServiceImpl.java:48-51` (a single
`webClient.post()` pipeline with `onErrorResume`, no `.retry`). The
authorization caveat — `SecurityConstants` carries no `/api/genai/**` entry, so
the route falls through to `.pathMatchers("/**").authenticated()`, and under
`auth.type=DISABLED` it is anonymously reachable — is confirmed at
`SecurityConstants.java:95-96` (whitelist + `SECURITY_RULES`, zero `genai`
hits) per the GenAIController sidecar's `requires-runtime` block. The page
correctly homes the feature narrative and config keys elsewhere and cross-links
to both, keeping the API-reference page scoped to the wire contract.

## Maintainer notes

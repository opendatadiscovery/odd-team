## STRENGTHENS — Batch ZG (GenAI family: new GenAIController controller-class sidecar deepens evidence for all 9 existing GenAI refactoring scopes)

A new controller-class sidecar (`odd-platform__java__GenAIController__controller-class__GenAIController.md`, distinct node_id from the prior `org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md` sidecar enriched in batch K) re-strengthens the entire 9-entry GenAI refactoring-scope family with deeper file-analyser/0.4.0 evidence + 2026-05-25 live-doc re-verification.

**Family roster** (existing, with new evidence):

- **REFACTOR-001** (no outbound auth) — confirmed at `WebClientConfiguration.java:26-29` (no `.defaultHeader(HttpHeaders.AUTHORIZATION, ...)`) + `GenAIProperties.java:8-12` (no apiKey/token field). Live feature page WebFetched 2026-05-25 status 200 explicitly: "The platform sends **no authentication** to the external service. Operators must enforce network-layer controls (mesh, ingress, NetworkPolicy)" — the doc's framing is operator-network-delegated; the absence of outbound auth is now documented as a stance, though REFACTOR-001 continues to track it as a gap because no rationale in the code defends it as architectural (cf. ADR-CANDIDATE-005's framing).
- **REFACTOR-002** (no retry/backoff) — confirmed at `GenAIServiceImpl.java:41-52` (no `.retry`/`.retryWhen`/`@Retryable`/`@CircuitBreaker`). Live feature page explicit: "**No retry logic:** Single attempt per request; external service must be reliable."
- **REFACTOR-003** (no rate limit/quota) — confirmed: grep across `<odd-platform>` for `RateLimiter|@Bucket|TokenBucket|@RateLimit` returns matches only in dependency POMs, NONE in controller/service code paths.
- **REFACTOR-004** (no prompt sanitisation) — confirmed at `GenAIServiceImpl.java:41-43` (verbatim forward) + live feature page silent on prompt-injection mitigations.
- **REFACTOR-007** (no audit logging) — confirmed at `GenAIServiceImpl.java:35-52` (zero `log.*` calls anywhere on the request path). The `ServerWebExchange exchange` parameter is exposed at the controller signature (line 20) but never read — the canonical fix-anchor for adding audit logging.
- **REFACTOR-014** (OpenAPI spec only declares 200) — confirmed; the 400 (disabled) and 500 (failure) responses are NOT in the contract. Compounds with ADR-CANDIDATE-223 NEW (the HTTP 400 framing for feature-flag-off should be in the spec).
- **REFACTOR-016** (no SSRF guard / URL allowlist) — confirmed at `GenAIProperties.java:10` (no `@URL`/`@Pattern`) + `WebClientConfiguration.java:28` (`baseUrl(genAIProperties.getUrl())` no validation).
- **REFACTOR-019** (`auth.type=DISABLED` + `genai.enabled=true` anonymously reachable) — confirmed at `GenAIController.java:13-24` (no method-level `@ConditionalOnProperty`) + global auth wiring is the operator's responsibility.
- **REFACTOR-023** (no controller-level integration test) — confirmed: grep over `<odd-platform>/odd-platform-api/src/test` for `GenAI|genai|/api/genai` returns zero matches at commit 4ec2b20.

**NEW companion gap surfaced this batch** (separate REFACTOR-656 NEW):
- **REFACTOR-656 NEW** — no `max-in-memory-size` override on `genAiWebClient`; uses Spring WebFlux default 256KB; long-form LLM responses > 256KB fail with `DataBufferLimitException`. The application-wide `spring.codec.max-in-memory-size: 20MB` (`application.yml:14-15`) is NOT inherited because `WebClient.builder()` chain doesn't call `.codecs(...)`.

**Cross-batch refinement**:

The GenAI family is now anchored by THREE sidecars:
1. **GenAIProperties** (config-side, batch B) — the typed-config POJO
2. **org_opendatadiscovery_oddplatform_controller__controller__GenAIController** (batch K) — the original controller sidecar
3. **GenAIController controller-class** (batch ZG NEW) — the file-analyser/0.4.0-enriched sidecar with deeper line anchors + 2026-05-25 doc re-verification

The 9-entry refactoring-scope family + the 3 ADRs (ADR-004 disabled-by-default + ADR-005 thin-proxy + ADR-223 NEW HTTP 400 framing) together form the GenAI architectural and operational SURFACE. The maintainer's GenAI hardening sprint (the suggested backlog grouping for all 10 entries — REFACTOR-001/-002/-003/-004/-007/-014/-016/-019/-023/-656 — plus the 3 ADRs codified) is the consolidated remediation path.

**Live-doc anchors re-verified 2026-05-25**:
- `https://docs.opendatadiscovery.org/features/active-platform-features/genai` — status 200; explicit "thin proxy" / "no authentication, no retry" framing.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration` — status 200; explicit silent-misconfiguration warning admonition + "API-only today" claim.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-005 (thin-proxy — the architectural stance); ADR-CANDIDATE-004 (disabled-by-default); ADR-CANDIDATE-223 NEW (HTTP 400 framing); all 9 GenAI family REFACTORs.
- SUPERSEDES: none.
- CONFLICTS: none.

---

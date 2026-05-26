# ADR-CANDIDATE-005 — GenAI feature is a THIN PROXY by design — the platform's responsibility ends at "forward question text, return answer text"; prompt construction, RAG, retrieval-augmentation are operator's external service responsibility

## STRENGTHENS — batch ZG (2026-05-25 — new `GenAIController__controller-class` sidecar joins the support set)

A NEW controller-class sidecar (`odd-platform__java__GenAIController__controller-class__GenAIController.md`, distinct node_id from the prior `org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md` sidecar enriched in batch K) reconfirms the thin-proxy stance with deeper evidence at the controller surface.

**New surfaced_by entry**:

- `odd-platform__java__GenAIController__controller-class__GenAIController.md:implicit_adrs.[0]` (HIGH) — "**The platform is a THIN PROXY: it adds nothing to the question — no catalog context, no prompt template, no PII redaction, no user identification.** The question text from `GenAIRequest.body` is forwarded verbatim as `Map.of(\"question\", request.getBody())` to the external service." — intent_anchor: "the constants `QUERY_DATA = \"/query_data\"` and `QUESTION_FIELD = \"question\"` are declared as `public static final` (GenAIServiceImpl.java:22-23) and the live feature page reinforces the stance: 'the platform is a thin proxy', 'No prompt modification' — explicit intent that the platform is NOT a RAG layer".

- `odd-platform__java__GenAIController__controller-class__GenAIController.md:implicit_adrs.[3]` (HIGH) — "**Outbound calls are NOT retried — single attempt per inbound request.**" — intent_anchor: "live feature page explicitly: 'Single attempt per request; external service must be reliable.' Intent is to let transient failures propagate cleanly to the user rather than amplify load on a paid external service via implicit retries."

- `odd-platform__java__GenAIController__controller-class__GenAIController.md:implicit_adrs.[4]` (MEDIUM) — "**Only `ReadTimeoutException` gets a custom user-friendly error message; every other exception class is collapsed into a generic GenAIException with the raw `e.getMessage()` value.**" — intent_anchor: "the explicit branch for ReadTimeoutException with a user-friendly message + the generic fall-through indicate that the timeout was the user-experience case the author cared about; everything else is best-effort."

**Cross-batch refinement**:

The thin-proxy stance is now anchored by THREE sidecars:
1. The original config-side sidecar (`GenAIProperties` — batch B) — documents the three-key config + the silent-misconfiguration warning.
2. The original controller-method-style sidecar (`org_opendatadiscovery_oddplatform_controller__controller__GenAIController` — batch K) — surfaced the thin-proxy framing first.
3. **NEW (this batch)** the controller-class sidecar with file-analyser/0.4.0 enrichment — adds deeper line-anchored intent + the `public static final` constant evidence + the `.onErrorResume` branch analysis + the live-feature-page WebFetch re-verification at 2026-05-25.

The two co-surfaced GenAI ADRs are also reconfirmed:
- **ADR-CANDIDATE-004** (GenAI shipped disabled-by-default) — line 169's "**The `enabled` gate is at the SERVICE layer (HTTP 400 BadUserRequestException), not at the CONTROLLER bean registration (HTTP 404)**" intersects with ADR-004's default-disabled stance.
- **ADR-CANDIDATE-223 NEW** (HTTP 400 framing for feature-flag-off) — the new controller-class sidecar surfaces the **CONTRAST with the sibling EventApiController** (`@ConditionalOnDataCollaboration` → 404 framing); this contrast is the case-law for ADR-223 NEW.

**Live-doc anchor re-verified**:
- `https://docs.opendatadiscovery.org/features/active-platform-features/genai` — WebFetched 2026-05-25 status 200. The live page now ALSO carries explicit "no authentication, no retry" + "platform is a thin proxy" / "No prompt modification" framing.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#genai-configuration` — WebFetched 2026-05-25 status 200. Carries the silent-misconfiguration warning admonition explicitly.

**Co-surfaced gaps reaffirmed**:

The new sidecar reconfirms the 9-entry refactoring-scope family already in the registry: REFACTOR-001 (no outbound auth), REFACTOR-002 (no retry), REFACTOR-003 (no rate limit), REFACTOR-004 (no prompt sanitisation), REFACTOR-007 (no audit logging), REFACTOR-014 (OpenAPI spec only declares 200), REFACTOR-016 (no SSRF guard / URL allowlist), REFACTOR-019 (`auth.type=DISABLED` + `genai.enabled=true` anonymously reachable), REFACTOR-023 (no controller-level integration test). Each gap is strengthened with deeper evidence from the controller-class sidecar.

**NEW companion gap surfaced this batch**:
- **REFACTOR-656 NEW** — no `max-in-memory-size` override on `genAiWebClient`; uses Spring WebFlux default 256KB. Long-form LLM responses > 256KB fail with `DataBufferLimitException`. The application-wide `spring.codec.max-in-memory-size: 20MB` is NOT inherited because `WebClient.builder()` chain doesn't call `.codecs(...)`. This is the LSN-002-class regional analogue at the codec layer — an unset SDK builder parameter that ships silent misbehaviour.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-004 (disabled-by-default), ADR-CANDIDATE-005 (thin-proxy), ADR-CANDIDATE-223 NEW (HTTP 400 framing). The three GenAI ADRs now form a coherent architectural cluster.
- SUPERSEDES: none.
- CONFLICTS: none. The doc page is consistent with the code stance; gaps are gap-shaped (no rationale defends them).

---

# ADR-CANDIDATE-223 — Feature-flag-disabled endpoints return HTTP 400 BadUserRequestException — request-time service-tier gate — NOT HTTP 404 via `@ConditionalOnProperty` bean-non-registration; framing is "feature flag off", not "feature not deployed"

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-07 Active Platform Features (cross-feature convention), P-09 Configuration (the feature-flag idiom)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__GenAIController__controller-class__GenAIController.md:implicit_adrs.[1]` (HIGH) — "**The `enabled` gate is at the SERVICE layer (HTTP 400 BadUserRequestException), not at the CONTROLLER bean registration (HTTP 404) — opposite to the sibling DataCollaboration `@ConditionalOnDataCollaboration` pattern.**" — intent_anchor: "the choice of `BadUserRequestException` (which maps to HTTP 400 via ControllerAdvice.java:24-28) rather than skipping bean registration means the route is always REACHABLE and the failure mode is a 4xx-class operator-debuggable response, not a 404. The choice frames the disabled state as 'feature flag off' rather than 'feature not deployed'."

**Decision statement**: When a feature is disabled via its YAML flag (`genai.enabled: false` is the canonical case), the GenAI controller's bean is STILL registered (no `@ConditionalOnProperty` on the controller class), and `POST /api/genai/ask` is STILL reachable. The disable-check fires at the SERVICE layer:

```java
// GenAIServiceImpl.java:37-39
if (!genAIProperties.isEnabled()) {
  return Mono.error(new BadUserRequestException("Gen AI is disabled"));
}
```

The `BadUserRequestException` maps to HTTP 400 via `ControllerAdvice.java:24-28`. The contrast — and the case-law — is the sibling `EventApiController` which carries `@ConditionalOnDataCollaboration` at the class level; when `datacollaboration.enabled: false`, the controller bean is NEVER registered, and `POST /api/datacollaboration/...` returns HTTP 404. Both patterns are internally consistent; this ADR codifies that the platform's CONVENTION for feature-flag-off is HTTP 400 (service-tier gate) rather than HTTP 404 (bean-non-registration).

The framing choice has operator-visible consequences:
- **400 framing**: the operator sees "feature flag off" — a 4xx response with a debuggable message; the route exists, the platform deployment IS this version. The fix is configuration.
- **404 framing**: the operator sees "feature not deployed" — a 4xx response with no message detail; the route appears absent, suggesting the platform deployment is missing the feature. The fix could be configuration OR deployment.

The 400 framing is the more operator-friendly choice for a feature that's NOT intended to be permanently absent (a feature flag) — it tells the operator "this is configurable; change the flag." The 404 framing is more appropriate for a feature that, when disabled, is a deployment topology decision (the operator deliberately deployed without it).

GenAI chose 400; DataCollaboration chose 404. This ADR captures the GenAI-style choice as a platform convention for feature flags whose state is operator-configurable at runtime (not deployment-time).

**Wisdom test**: PASS. Three intent anchors:
1. **Structural** — the contrast with the sibling `@ConditionalOnDataCollaboration` is deliberate. The maintainer chose NOT to use `@ConditionalOnProperty("genai.enabled")` despite the symmetric pattern being available.
2. **Type-anchored** — `BadUserRequestException` is the typed-exception choice; the platform has multiple exception classes (NotFoundException → 404, BadUserRequestException → 400) — the maintainer chose 400.
3. **Live-doc anchor** — the live `/configuration-and-deployment/odd-platform#genai-configuration` page describes the feature as runtime-configurable ("disabled by default ... operators set `genai.enabled=true` to enable") — consistent with the 400 framing.

Structural impact: the route is always present; the OpenAPI spec advertises the endpoint; SDK clients can call it and receive a 400 message on disabled state. Operators introspecting the platform's API surface see GenAI regardless of the flag value.

**Operator-visible consequence**:
- An operator hitting `POST /api/genai/ask` on a default-deployed platform receives `400 BAD_REQUEST` with `message: "Gen AI is disabled"` — clear, debuggable, immediately points to the configuration fix.
- A spec-conformant SDK consumer of the endpoint sees the endpoint in the OpenAPI spec regardless of deployment state.
- Contrast: hitting `POST /api/datacollaboration/...` on a default-deployed platform (where `datacollaboration.enabled: false`) receives 404 — the operator may infer the feature is missing from the build, when actually it's just unconfigured.

**Existing ADR**: closely related to **ADR-CANDIDATE-004** (GenAI shipped disabled-by-default — the flag's default state) AND **ADR-CANDIDATE-005** (GenAI thin-proxy stance — the feature's architectural scope). This ADR captures the WIRE-SURFACE behaviour of the disabled state; ADR-004 captures the default flag value; ADR-005 captures the feature's architectural ambition.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- The OpenAPI spec for GenAI declares only `200 OK` — the 400 (disabled) and 500 (failure) responses are NOT in the contract (REFACTOR-014 — STRENGTHEN). The spec-vs-code drift compounds with this ADR's framing choice: clients written to the spec don't know about the 400 path.

**Proposed action**: Promote to `adrs/drafts/feature-flag-disabled-http-400.md` (new ADR). Document:
1. The decision: feature flags use HTTP 400 BadUserRequestException at the service tier (NOT HTTP 404 via `@ConditionalOnProperty` bean non-registration).
2. The rationale: 400 framing is operator-friendly for runtime-configurable flags; 404 framing is appropriate for deployment-time absence.
3. The structural anchor: the `BadUserRequestException("X is disabled")` pattern at the service layer.
4. The OpenAPI commitment: the 400 response SHOULD be in the contract (REFACTOR-014 — the spec currently advertises only 200; the spec should be updated to include 400 with the "feature disabled" framing).
5. The convention's scope: this ADR applies to features that are operator-configurable at runtime; the sibling `@ConditionalOnDataCollaboration` pattern is for deployment-topology decisions.

**Severity rationale**: MEDIUM — cross-feature convention; affects every future feature-flag's wire-surface behaviour. Not security-architecture, but a consistency commitment that future maintainers must understand to keep the platform's wire-surface predictable.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-004 (GenAI default-disabled) + ADR-CANDIDATE-005 (GenAI thin-proxy). Three GenAI ADRs together: ADR-004 says "shipped disabled", ADR-005 says "thin proxy when enabled", ADR-223 says "disabled state surfaces as HTTP 400".
- SUPERSEDES: none.
- CONFLICTS: spec-vs-code: the OpenAPI spec only declares 200 (REFACTOR-014); this ADR's recommendation includes "fix the spec to include 400 in the contract".

---

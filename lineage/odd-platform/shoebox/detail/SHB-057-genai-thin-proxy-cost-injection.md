# SHB-057 — Any authenticated user can drive unbounded LLM cost via /api/genai/ask with no audit, no rate-limit, no size cap, no role gate

**Category**: clustering
**Severity**: HIGH

## Hypothesis

The GenAI endpoint exposes a feature-flagged proxy where ANY authenticated user (any role, including read-only viewers; any owner; even anonymous under `auth.type=DISABLED`) can POST an arbitrarily-large free-text body and trigger a chargeable outbound call to the operator's configured LLM endpoint. There is NO `@PreAuthorize`, NO `GENAI_USE` Permission, NO rate-limiter, NO body-size cap, NO prompt-injection filter, NO PII redaction, NO audit log of who-asked-what, NO response cache. The `ServerWebExchange` parameter is auto-injected on the controller method but NEVER read — the user `Principal`, request headers, and trace context are all available but discarded. The operator's only defences are: (a) the boot-time feature flag (`genai.enabled`); (b) the network-layer auth the operator configured for the LLM endpoint itself. Compounding: when `genai.enabled=true` but `genai.request_timeout` is unset (Java `int` default = 0), every call fails immediately with `Duration.ofMinutes(0)` → `ReadTimeoutException` → user-facing message "Gen AI request take longer that 0 min" (sic) — an LSN-002-class silent misconfiguration.

## Evidence

- `odd-platform-api/src/main/java/.../controller/GenAIController.java:13-24` — entire class: no `@PreAuthorize` annotation, no programmatic `permissionService.hasPermission(...)` call. The `genAiQuestion` method's body is a one-liner that ignores the auto-injected `ServerWebExchange exchange` parameter (line 20).
- `odd-platform-api/src/main/java/.../service/GenAIServiceImpl.java:37-52` — entire service body. `if (!genAIProperties.isEnabled()) return Mono.error(new BadUserRequestException("Gen AI is disabled"))` is the ONLY gate. The outbound POST is `webClient.post().uri("/query_data").bodyValue(Map.of("question", request.getBody()))` — verbatim forward, no transformation.
- `SecurityConstants.java:95-355` — no rule matches `/api/genai/ask` or `/api/genai/**`; `WHITELIST_PATHS` (line 95-96) does not list it. Path falls through to `AuthorizationCustomizer.java:29` `pathMatchers("/**").authenticated()` for OAUTH2/LDAP and `LoginFormSecurityConfiguration.java:57` for LOGIN_FORM. Under `DisabledAuthSecurityConfiguration.java:13-17`, the path is fully anonymous.
- `components.yaml:4200-4204` (OpenAPI `GenAIRequest`) — `body: string` with NO `maxLength`, NO `pattern`, NO description. Generated Java carries no `@Size` / `@NotBlank` annotations.
- `WebClientConfiguration.java:20-30` — bean built once at startup; URL + timeout baked in. No `RateLimiter`, no `defaultHeader`, no `ExchangeFilterFunction`. JDK / Reactor Netty default ConnectionProvider (max-connections = 2 × CPU, pendingAcquireTimeout = 45s).
- `GenAIProperties.java:11` — `request_timeout` is a Java `int` field with no `@Min(1)`; unset → 0 → `Duration.ofMinutes(0)` legal-but-immediate-timeout. Per `GenAIServiceImpl.java:48-51`, the `onErrorResume` formats `"Gen AI request take longer that %s min"` (sic — typo "that" should be "than") and the user sees `"Gen AI request take longer that 0 min"`.
- Live feature page (`features/active-platform-features/genai`, verified 2026-05-25 status 200) documents "no authentication, no retry" but is SILENT on the no-authorization, no-rate-limit, no-audit, no-PII-redaction class of gaps. The page UNDERSTATES the security implications. Per the sidecar `docs_link_semantic.doc_drift_findings.[0]`.
- Probe artifacts already exist: `P-158` (prompt injection), `P-159` (concurrency), `P-160` (least-privilege caller succeeds), `P-161` (`request_timeout=0` immediate-timeout). All probe-needed except P-160 + P-161 verified statically.
- F-039 already exists with these findings; this thread is an ENRICHER that surfaces the LSN-002-class compounding ("the obvious operator default ships immediate failure") + the unread-`ServerWebExchange` fix-anchor.

## Notes

- This is an ENRICHER for **F-039 GenAI Assistant**. F-039's headline already covers "no audit / rate-limit / sanitisation / cost protection." This thread surfaces TWO additional facets the existing feature flow may not have captured:
  - **The unread `ServerWebExchange` is the canonical fix-anchor**: adding audit logging, per-user rate limiting, or per-user permission gates becomes a ~10-line patch instead of a refactor. Anyone reviewing the file should immediately see that the user identity is one method-call away (`exchange.getPrincipal()`) and just-discarded.
  - **`request_timeout=0` is an LSN-002-class default-silent-misconfiguration**: operators following the docs to enable the feature WITHOUT setting all three keys ship an endpoint that fails 100% of the time with a typo-laden error message. The live config doc page acknowledges this (per the sidecar `docs_link_semantic.inferred_docs[1].fetched_excerpts`) — the silent-misconfiguration warning admonition was added in May 2026 — but the warning admonition is the DOC fix, not the CODE fix.
- The "thin proxy" stance is documented + intentional (live doc explicit) — the policy decision is sound for the stated goal (let the operator's LLM handle catalog context + prompt construction). The drift is between the policy and the missing operator-side controls (rate-limit / audit / RBAC) that the policy leaves the operator responsible for but does NOT surface in the docs.
- The unwrap-twice response pattern (`CharMatcher.is('"').trimFrom + StringEscapeUtils.unescapeJava` at `GenAIServiceImpl.java:46-47`) is brittle and undocumented — an external LLM that returns `{"answer": "..."}` instead of `"..."` produces silently-wrong content. Latent at the integration boundary.
- Cluster with SHB-053 (notifications cross-channel-abort) only at the meta-level: both are "OSS platform ships a permissive default that operators may not realise is permissive." Different code, same anti-pattern class.

## Next

1. **Graduate the LSN-002-class facet of F-039**: the `request_timeout=0` default should fail-fast at bean construction. REFACTOR-NNN: add `@Min(1)` validation OR a YAML-supplied default. HIGH severity.
2. **REFACTOR-NNN**: read `ServerWebExchange.getPrincipal()` at `GenAIController.java:20` and emit a structured `log.info("genai.ask user={} bytes={}", username, body.length())` at request entry. One-line patch, immediate audit-trail. HIGH.
3. **REFACTOR-NNN**: add `@Size(max=10000)` on the GenAIRequest body field; document the rationale in the OpenAPI description. MEDIUM.
4. **SEC-NNN**: introduce a `GENAI_USE` Permission + `@PreAuthorize` on the controller method. Backward-compat: ship as default-granted to all roles, operators can scope down. MEDIUM.
5. **REFACTOR-NNN**: wrap the WebClient with Resilience4j RateLimiter (operator-tunable via `genai.rate-limit-per-user-per-minute`). MEDIUM.
6. **DOC-NNN**: update `features/active-platform-features/genai` to surface the no-RBAC / no-rate-limit / no-audit posture explicitly with a "before enabling, ensure your LLM is on a private network" admonition.

## Links

- cluster_with: [F-039]
- merged_into: (open)
- supersedes: []

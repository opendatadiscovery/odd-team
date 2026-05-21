- **REFACTOR-049** (NEW 2026-05-10A): Under `auth.type=DISABLED`, the token regenerate endpoint is anonymously reachable — `COLLECTOR_TOKEN_REGENERATE` permission is bypassed entirely; any caller can rotate any collector's token and receive the plaintext
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[6]` (severity HIGH in DISABLED deployments)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[4]` (severity HIGH in DISABLED deployments)
  - **Statement**: Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` short-circuits all permission checks via `.anyExchange().permitAll()`. The `COLLECTOR_TOKEN_REGENERATE` permission gate at `SecurityConstants.java:135-137` is consumed only by `AuthorizationCustomizer` in the protected-mode security configurations. Result: any caller able to reach the platform on a DISABLED deployment can `PUT /api/collectors/{id}/token`, rotate any collector's token, and receive the plaintext in the response. `TokenGeneratorImpl.java:30-31` falls through to `Mono.just(this.regenerate(tokenPojo, null))` — the resulting TOKEN row's `updated_by` is NULL, so even the single-state forensic trail is empty.
  - **Evidence**: `TokenGeneratorImpl.java:27-32` (no-current-user fallback) + `DisabledAuthSecurityConfiguration.java` (filename per glob)
  - **Existing-ADR-or-implied-prescription**: None. (DISABLED is documented as dev-only in the live security docs, but the docs do not specifically warn about token-rotation exposure under DISABLED — only generic "use only in dev" guidance.)
  - **Proposed remedy**: Either (a) gate the rotation endpoint with `@ConditionalOnProperty(value="auth.type", havingValue="DISABLED", matchIfMissing=false)` to register a fail-closed bean variant; (b) add a startup banner WARN when `auth.type=DISABLED` is set in production-shaped deployments (e.g., when `spring.profiles.active!=dev`); (c) document the exposure prominently on the live `enable-security` page.
  - **Severity rationale**: HIGH (in DISABLED deployments). Combines with REFACTOR-046 (no audit log) for a forensically-invisible platform-wide ingestion DoS via rotation-spam.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token-rotation endpoint has the SAME DISABLED-mode bypass; credential-rotation-hijack surface confirmed for both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[2]` (HIGH in DISABLED deployments) — "Under `auth.type=DISABLED` the SecurityConstants permission rule chain is bypassed entirely — any caller able to reach the platform can rotate ANY data source's token and receive the new plaintext credential in the response. This is a credential-rotation-hijack surface: an attacker on a DISABLED deployment can break ingestion platform-wide and harvest the new tokens." — evidence: `SecurityConstants.java:124-126` (the `DATA_SOURCE_TOKEN_REGENERATE` rule is enforced only by the LOGIN_FORM/OAUTH2/LDAP security configs) + `TokenGeneratorImpl.java:31` (no-current-user fallback `regenerate(tokenPojo, null)` — rotation succeeds with `updated_by` NULL).
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:security.known_security_gaps` (HIGH) — confirms the credential-rotation-hijack surface for `DATA_SOURCE_TOKEN_REGENERATE` under DISABLED.

**Why a STRENGTHEN, not a new entry**: the DISABLED-mode permission bypass is the SAME mechanism (`DisabledAuthSecurityConfiguration` permitAll; `SecurityConstants.SECURITY_RULES` consumed only by the protected-mode configs) for `COLLECTOR_TOKEN_REGENERATE` and `DATA_SOURCE_TOKEN_REGENERATE` alike — and `TokenGeneratorImpl.java:30-31`'s no-current-user fallback applies identically. This is the SAME `TokenGeneratorImpl` and the SAME `DisabledAuthSecurityConfiguration`. This finding is also a member of the cross-cutting **REFACTOR-185** DISABLED-mode bypass cluster (which already triangulates 11+ sidecars across the SECURITY_RULES surface). Title should be re-scoped on triage to "ODD token-rotation endpoints (Collector + DataSource) anonymously reachable under DISABLED".

**Severity unchanged: HIGH (in DISABLED deployments)** — the data-source token rotation is anonymously reachable under DISABLED; combined with the REFACTOR-046 strengthen (no audit log, `updated_by` NULL under DISABLED) the rotation-hijack of data-source ingestion credentials is forensically invisible.

---

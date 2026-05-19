## REFACTOR-304 — Empty `SecurityContext` silently propagates rather than fail-fast — `getCurrentUser()` emits empty (not error) when `ReactiveSecurityContextHolder.getContext()` is empty; every owner-scoped consumer degrades to empty results indistinguishable from "user owns nothing"

**Severity**: MEDIUM
**Category**: observability (regression-detection surface)
**Pillars affected**: [P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "Empty SecurityContext silently propagates rather than fail-fast. When `ReactiveSecurityContextHolder.getContext()` emits empty (which happens under `auth.type=DISABLED` — no ServerSecurityContextRepository — or in a future regression where a WebFilter is misordered), `getCurrentUser` emits empty (no `.switchIfEmpty(Mono.error(...))`); every owner-scoped consumer therefore degrades to empty results."

**Description**: `AuthIdentityProviderImpl.getCurrentUser()` (lines 24-35) and `fetchAssociatedOwner()` (lines 50-53) both use reactive `flatMap` chains with NO `switchIfEmpty(Mono.error(...))` guard. When `ReactiveSecurityContextHolder.getContext()` emits empty (the dev-mode `auth.type=DISABLED` case where `DisabledAuthSecurityConfiguration.java:11-19` wires NO `ServerSecurityContextRepository`, OR a future regression where a WebFilter is misordered such that the SecurityContext is not propagated to the reactor Context), the entire chain short-circuits to empty without raising 401/403/500. There is no logging, no Micrometer counter, no warning.

**Failure mode**: A regression that broke principal propagation across the entire reactor pipeline (e.g. a WebFilter reordering during a Spring Security upgrade) would manifest as "every user sees empty My Objects" — diagnosable only by examining each affected endpoint individually. There is no boot-time validator that asserts the principal-propagation chain is functional; there is no per-request alert when the SecurityContext is missing. The regression is OBSERVABLE only via operator reports.

**Primary source citations**:
- `AuthIdentityProviderImpl.java:24-35` (no switchIfEmpty on the context lookup)
- `AuthIdentityProviderImpl.java:50-53` (no switchIfEmpty on the owner-lookup chain)
- `DisabledAuthSecurityConfiguration.java:11-19` (the dev-mode empty-context case — explicit no-ServerSecurityContextRepository wiring)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-029 (DISABLED-as-default + explicit-chain stance) frames DISABLED as a dev-only mode where empty-context is the expected behaviour. The IMPLIED prescription is that under non-DISABLED modes, the SecurityContext should NEVER be empty for an authenticated request — but the code has no assertion of this invariant. Under DISABLED on a network-reachable production deployment (REFACTOR-073 / REFACTOR-185 11-sidecar triangulated finding), the empty-context degradation is the same shape as a regression in non-DISABLED modes, making the two failure scenarios indistinguishable at the application layer.

**Proposed remedy**: Two options. (a) **Service-fix**: add `switchIfEmpty(Mono.fromRunnable(() -> log.warn("AuthIdentityProviderImpl: SecurityContext empty for request {}", ...)).then(Mono.empty()))` to surface a WARN-level log when the context is unexpectedly empty under non-DISABLED modes. Pair with a Micrometer counter `auth_empty_context_total{mode=...}` so operators can alert on "more than N empty contexts per minute under OAUTH2." (b) **Boot-time validator** (REFACTOR-073 candidate): at startup, assert that under `auth.type ∈ {LOGIN_FORM, OAUTH2, LDAP}`, the WebFilter chain DOES include a `ServerAuthenticationConverter` or equivalent producing a `SecurityContext`. This validator catches the regression-by-misorder failure mode at startup rather than at runtime.

**Severity rationale**: MEDIUM — observability gap; today DISABLED-mode is dev-only per docs, but the same code path is the regression-detection surface for non-DISABLED modes. Combined with the lineage-variant single-point-of-failure surfaced in batch G (anchor-set defence-in-depth absence), this is the single most fragile assumption in the owner-scoping defence.

**Suggested backlog grouping**: `Authorization audit batch` + `Boot-time security-posture hardening` (REFACTOR-073 family)

---

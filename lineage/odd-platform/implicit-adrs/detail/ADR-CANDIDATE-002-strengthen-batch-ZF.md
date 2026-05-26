# ADR-CANDIDATE-002 — Centralised authorization via `SecurityConstants.SECURITY_RULES` (no `@PreAuthorize`); positive-registration model

## STRENGTHENS — batch ZF (2026-05-25)

**Five new class-level confirmations**:

- `odd-platform__java__IngestionController__controller-class__IngestionController.md:concepts.invariants.[NO-programmatic-authorization-checks]` — "NO programmatic authorization checks anywhere in this controller body (no `@PreAuthorize`, no `permissionService.hasPermission(...)`, no `ReactiveSecurityContextHolder` lookup). Authorization is path-based via the upstream Spring SecurityWebFilterChain." (Path-based via WHITELIST_PATHS + IngestionDataSourceFilter / IngestionDataEntitiesFilter — a DIFFERENT auth layer but still centralized.)
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:implicit_adrs.[1]` — "Centralized authorization via `SecurityConstants.SECURITY_RULES` — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries that `AuthorizationCustomizer` registers against the WebFlux security chain. This class's three mutating methods are gated via `SecurityConstants.java:143-147`."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:concepts.invariants.[Four-method-authorization-asymmetry]` — "SecurityConstants.SECURITY_RULES[143-147] registers POST + PUT + DELETE against `/api/owners*`; the GET `/api/owners` path has NO rule."
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:concepts.invariants.[Auth-required-but-NO-per-permission-gate]` — "`/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS[95-96]` and has no `SECURITY_RULES[98-355]` entry; falls through to `pathMatchers(\"/**\").authenticated()`."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[All-three-endpoints-RBAC-ungated]` — "`SecurityConstants.SECURITY_RULES` has zero entries matching `/api/datacollaboration/**` or `/api/messages/**`; all three fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers(\"/**\").authenticated()`"
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:security.authorization_assertions` — "Endpoint has no @PreAuthorize and no programmatic permission check anywhere on the request path (controller -> service -> repository)."

The pattern holds — but batch ZF surfaces THREE distinct flavours that future maintainers should be aware of:

1. **Positive-registration** (the canonical pattern) — Owner mutations (POST/PUT/DELETE) have explicit SECURITY_RULES entries at SecurityConstants.java:143-147 with named permissions (OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE). This is what ADR-CANDIDATE-002 describes.

2. **Authenticated-fall-through** (a deliberate variation per ADR-CANDIDATE-003) — `getOwnerList` GET, `getMetadataFieldList` GET, all three DataCollab endpoints, all three Owner GET endpoints. These have NO SECURITY_RULES entry; they fall through to the catch-all `pathMatchers("/**").authenticated()` and are reachable by any authenticated user.

3. **Explicit-whitelist** (a fourth flavour batch ZF surfaces clearly) — IngestionController's 4-of-5 endpoints (via `WHITELIST_PATHS=[..., /ingestion/**, /api/slack/events, /actuator/**, ...]` at SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:50). EventApiController's `/api/slack/events` is the same shape. These are MORE PERMISSIVE than the default `authenticated()` fall-through — they explicitly skip the authentication check via `.permitAll()`. The WHITELIST_PATHS is the THIRD authorization-control list (after SECURITY_RULES + the fall-through), and it is the most security-sensitive: every entry deserves an architectural justification (e.g. webhook callbacks).

The strengthened evidence base is now **28 sidecars**. The architectural insight from batch ZF: SECURITY_RULES is one of THREE authorization-control mechanisms; `WHITELIST_PATHS` is the second; the catch-all `authenticated()` is the third. The three layers form a deliberate stack:
- WHITELIST_PATHS — public endpoints (webhook callbacks, actuator, ingestion).
- SECURITY_RULES — explicitly gated endpoints (mutations on managed resources).
- `authenticated()` fall-through — everything else (reads under the read-collaborative posture, per ADR-CANDIDATE-003).

ADR-CANDIDATE-002 should be EXTENDED to document all three layers explicitly; the current ADR wording emphasises only SECURITY_RULES.

---

## STRENGTHENS — Batch ZE (Discovery + Search + Links + Feature + Relationship + Title — 5 new negative-fall-through confirmations)

**Five new class-level sidecars confirm ADR-CANDIDATE-002's centralised authorization-via-SECURITY_RULES pattern.** Every batch-ZE controller has NO `@PreAuthorize`, NO programmatic `permissionService.hasPermission(...)` call, and falls through to `pathMatchers("/**").authenticated()` (LOGIN_FORM / OAUTH2 / LDAP) or `permitAll()` (DISABLED). None of the 5 controllers have an entry in `SecurityConstants.SECURITY_RULES` (verified via grep across all 5 sidecars). The 28-sidecar count of ADR-CANDIDATE-001 cross-validates from the controller-side; the 28-sidecar count of THIS ADR cross-validates from the authorization-fall-through side.

**New surfaced_by entries (the negative-fall-through pattern — controllers without SECURITY_RULES entries)**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[2]` (HIGH) — "**Centralised authorization via `SecurityConstants.SECURITY_RULES` — `/api/search*` is intentionally NOT rule-gated (ADR-CANDIDATE-002 instance + ADR-CANDIDATE-003 strengthen).** `SECURITY_RULES` has no entry for any search path; all seven endpoints fall through to `pathMatchers('/**').authenticated()`. This is the GET-collaborative convention applied to search: any authenticated user may read. The convention is structurally consistent with `getDataEntityDetails`, `getAllAlerts`, `getActivity`, `getCatalogDirectories`, `getNamespaceList`, etc. — search is one of many read-collaborative surfaces." — evidence: SecurityConstants.java (no search entries — `grep -in 'search\\|facet' <SecurityConstants.java>` returned 0 matches on 2026-05-25) + `AuthorizationCustomizer.java:29-30`
- `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.invariants.[3]` — "**Auth is required but NO per-permission gate** — `/api/titles` is not in `SecurityConstants.WHITELIST_PATHS[95-96]` and has no `SECURITY_RULES[98-355]` entry; falls through to `pathMatchers(\"/**\").authenticated()` in both `LoginFormSecurityConfiguration:57` and `AuthorizationCustomizer:29-30`. ... No `OWNER_RELATION_MANAGE`, no `DATA_ENTITY_OWNERSHIP_*`, no Permission consulted."
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:concepts.invariants.[3]` — "no @PreAuthorize, no programmatic authorization check, no rate-limit, no audit logging, no Cache-Control header on the response" + `:security.authorization_assertions: []` — "the authorization model is intentionally absent — feature flags are deployment-scoped and uniform across all users"
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[2]` — "**No authorization gate at any layer**: (a) the controller has no `@PreAuthorize` / no programmatic `permissionService.hasPermission(...)`; (b) the SECURITY_RULES table at `SecurityConstants.java:95-355` has NO entry matching `/api/relationships/**` (verified by reading the full 357-line file end-to-end); (c) the service applies no check; (d) the repository SQL does NOT JOIN against `OWNERSHIP`"
- `odd-platform__java__LinksController__controller-class__LinksController.md:stress_findings.auth_gates.[0]` — "Verified by tracing: /api/links is NOT in WHITELIST_PATHS (SecurityConstants.java:95-96) and has NO SecurityRule (so it falls through to the default `pathMatchers(\"/**\").authenticated()` at AuthorizationCustomizer.java:29-30)."

**Cross-batch refinement** (batch ZE extends specifically the READ-SURFACE coverage of the negative-fall-through):
- 5 new controllers; every one falls through to authenticated() with NO per-Permission gate. The negative-fall-through pattern now covers every read-collaborative endpoint inspected in batches A-ZE.
- The DISABLED-mode consequence (REFACTOR-185 cross-cutting cluster) extends to all 5: anonymous reachability under default deployment.

**Cumulative count update**: ADR-CANDIDATE-002 now triangulates across **28 sidecars** mirroring the ADR-CANDIDATE-001 count: every controller inspected applies the centralised-rules authorization pattern, regardless of whether the controller's endpoints have a positive entry (POLICY / ROLE / OWNER mutations have rules) or a negative fall-through (read surfaces, including all 5 batch-ZE additions).

**Severity unchanged**: HIGH — the canonical authorization-wiring stance.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (GET-uniformly-authenticated read-collaborative — all 5 batch-ZE controllers are read-only and fall through to `authenticated()` per this ADR); REFACTOR-185 (DISABLED bypass — all 5 batch-ZE controllers are exposed under DISABLED).
- SUPERSEDES: none.
- CONFLICTS: none.

---

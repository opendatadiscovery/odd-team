## STRENGTHENS — Batch ZD (RBAC + Integration + Identity — 5 new class-level confirmations of the centralised SECURITY_RULES pattern)

**Five new class-level sidecars promote the support count of ADR-CANDIDATE-002 from 18 to 23.** The pattern holds for every CREATE/UPDATE/DELETE mutation that adds a row to `SECURITY_RULES` AND for every GET that omits one — across both write (positive registration) AND read (negative fall-through) directions.

**New positive registrations (RBAC class-level confirmation)**:
- **RoleController** (`RoleController.java:1-52`) — all THREE Role mutation endpoints are registered: `POST /api/roles → ROLE_CREATE` (SecurityConstants.java:169), `PUT /api/roles/{role_id} → ROLE_UPDATE` (SecurityConstants.java:170-171), `DELETE /api/roles/{role_id} → ROLE_DELETE` (SecurityConstants.java:172-173) — every entry `NO_CONTEXT`. The controller carries NO `@PreAuthorize`. Class-level corroboration of batch-E's controller-method finding.
- **PolicyController** (`PolicyController.java:1-64`) — all THREE Policy mutation endpoints are registered: `POST /api/policies → POLICY_CREATE` (SecurityConstants.java:163-164), `PUT /api/policies/{policy_id} → POLICY_UPDATE` (SecurityConstants.java:165-166), `DELETE /api/policies/{policy_id} → POLICY_DELETE` (SecurityConstants.java:167-168) — every entry `NO_CONTEXT`. The 64-line file carries NO `@PreAuthorize`. Class-level cross-endpoint confirmation that ALL THREE mutations + ALL THREE reads (no rules) share the convention.

**New negative fall-through registrations (read-side confirmation)**:
- **IdentityController.whoami** — no rule registered; the path is NOT in `WHITELIST_PATHS`; under LOGIN_FORM/OAUTH2/LDAP the SecurityWebFilterChain rejects anonymous calls; under DISABLED no chain runs and the dummyOwner fires (per ADR-CANDIDATE-210). The absence of a rule encodes "whoami is the SOURCE of authorization, not a gated operation" — implicit_adr[1] of the IdentityController sidecar.
- **PermissionController.getResourcePermissions** — class-level confirmation that the read-collaborative posture holds at the class scope. SecurityConstants.java:98-355 contains zero entries for `/api/resource/.../permissions`. The 27-line controller is uniformly `@PreAuthorize`-free.
- **PolicyController** read endpoints — `getPolicyDetails`, `getPolicyList`, `getPolicySchema` all fall through to `.authenticated()`; SecurityConstants.java:163-168 contains entries ONLY for the mutation paths.
- **IntegrationController** — `GET /api/integrations` + `GET /api/integrations/{integration_id}` have NO SECURITY_RULES entries (verified by grep `INTEGRATION` in PolicyPermissionDto.java + SecurityConstants.java returning zero matches). Both endpoints fall through to `pathMatchers("/**").authenticated()`. The 28-line controller has NO `@PreAuthorize`. This is the first INTEGRATION-axis class-level confirmation of the read-collaborative posture (cross-link with ADR-CANDIDATE-003).

**New surfaced_by entries** (one line per sidecar):
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:implicit_adrs.[1]` ("The identity-exposure surface deliberately omits @PreAuthorize. ... The maintainer's intent: the whoami endpoint is the 'who am I?' question — answering it for the caller is the SOURCE of authorization, not a gated operation.")
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:concepts.invariants.[no-auth-annotation]` ("the class carries `@RestController` + `@RequiredArgsConstructor` only. No `@PreAuthorize`, no `@Secured`, no `permissionService.hasPermission(...)` call in the method body. `SecurityConstants.SECURITY_RULES` has ZERO entries for the path")
- `odd-platform__java__RoleController__controller-class__RoleController.md:implicit_adrs.[authorization wholly upstream]` ("Authorization is wholly upstream of the controller — no @PreAuthorize annotations, no programmatic permission checks. The platform's deliberate decision: 'authorization is wired at the SecurityWebFilterChain via the AuthorizationCustomizer + SECURITY_RULES table; controllers are authorization-AGNOSTIC at the source level'.")
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:implicit_adrs.[1]` ("Authorization is wired declaratively in `SecurityConstants.SECURITY_RULES`, NOT via `@PreAuthorize` on the controller method or its generated `*Api` interface. The decision is class-wide: NO method on PolicyController carries `@PreAuthorize` / `@Secured` / programmatic check (verified 2026-05-25 by reading the full file).")
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:implicit_adrs.[1]` ("The wizard surface is open-read by design — neither `SecurityConstants.SECURITY_RULES` nor `PolicyPermissionDto` defines an `INTEGRATION_*` permission, despite the parallel pattern of explicit SecurityRule entries for the namespace, datasource, term, tag, query-example, reference-data, owner-association, role, and policy controllers. Compare: every WRITE-shaped controller has SECURITY_RULES entries; every PURE-READ controller has none — the parallel structure across controllers IS the architectural statement.")

**Updated support count**: 23-sidecar coverage (was 18 after batch X-TAGGING). The pattern is the STRONGEST in the catalog — surfaced across:
- NO_CONTEXT mutations: Role + Policy + Owner + Permission + Namespace + Term + Tag + DataSource + Collector + ReferenceData CRUD.
- DATA_ENTITY-context mutations: ownership + status + tag + description + internal_name + custom_metadata.
- Read-side fall-through: detail / lineage / attachments / directory / alerts / activity / search / permissions discovery / identity / integration wizard / policy schema.
- Ingestion-path: WHITELIST + filter-gate composition.

**Cross-batch refinement (batch ZD)**: The five new sidecars CONFIRM that the absence-of-`@PreAuthorize` is structural at the class level — every batch-ZD sidecar verified the absence by reading the FULL file end-to-end (the sidecars explicitly cite "27/52/64/28-line files contain no security annotation"). This refutes any "annotation might exist on individual methods we didn't enumerate" concern from the controller-method-only batches; the class-level reads validate that the architectural commitment is whole-file, not just method-by-method.

**Severity unchanged**: HIGH — security-architecture decision affecting the entire HTTP surface.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative GET — all five batch-ZD sidecars confirm the read-side fall-through; IntegrationController is a NEW axis joining the read-collaborative family); ADR-CANDIDATE-051 (PolicyTypeDto.hasContext discriminator — the enum-level mirror of the centralised-vs-controller-level split); ADR-CANDIDATE-210 (whoami absence-of-@PreAuthorize is the IDENTITY-LAYER FACET of this ADR).
- SUPERSEDES: none.
- CONFLICTS: none.

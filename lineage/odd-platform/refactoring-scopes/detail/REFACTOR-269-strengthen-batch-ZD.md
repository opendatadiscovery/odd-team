## STRENGTHENS — Batch ZD (PolicyController + RoleController class-level — controller-tier confirmation of the non-admin pagination-ignored asymmetry)

**Two new class-level confirmations promote REFACTOR-269's triangulation by surfacing the HTTP-tier observability of the silent pagination asymmetry**:

- **PolicyController (CLASS-LEVEL)** — `PolicyController.java:34-41` (getPolicyList) is a thin proxy to `policyService.list(page, size, query)` which BRANCHES BY USER ROLE: ADMIN gets server-paged via `policyRepository.list(page, size, query)`; non-admin gets in-memory `filterUserPolicies(currentUserPolicies, query)` IGNORING page/size with `hasNext=false` always. The controller passes parameters through unchanged; the asymmetry is fully observable at the HTTP layer.
- **RoleController (CLASS-LEVEL)** — `RoleController.java:27-34` (getRolesList) is the SYMMETRIC SIBLING — same shape; same parameters passed through; same admin vs non-admin fork at `RoleServiceImpl.java:40-47` + `:136-142`. Non-admin caller hitting `GET /api/roles?page=2&size=20` receives their own attached roles (typically 1-3 items) — NOT page 2 of the catalog. The response's `hasNext` is false regardless. Per `stress_findings.name_behavior_pairs[getRolesList]`: "DRIFT_NAME_VS_BEHAVIOR — A non-ADMIN caller hitting `GET /api/roles?page=2&size=20` receives their OWN attached roles (typically 1-3 items) — NOT page 2 of the catalog. The endpoint name 'list of roles' silently means 'list of roles you can see' but the pagination contract is broken."

**Cross-batch refinement**: The pattern is now 3-sidecar confirmed across RBAC management endpoints (Policy list + Role list — both halves of the RBAC mutation surface) — a CLASS-WIDE convention in the PolicyService + RoleService implementations rather than a single-feature accident.

The architectural shape: the principal-aware fork at the service tier is a content-fork (admin sees full; non-admin sees own-attached) but the HTTP contract is silently asymmetric. An operator writing UI automation paginating Roles or Policies will get correct behaviour for ADMINs and silently broken behaviour for non-ADMINs. Same OpenAPI contract shape; different runtime behaviour by caller role.

**Updated triangulation count**: 3-sidecar (PolicyService — batch S; PolicyController — batch ZD; RoleService — batch S; RoleController — batch ZD — counted as 2 cross-controller pairs).

**Severity unchanged**: MEDIUM — silent contract asymmetry by user role; operator-visible UX bug not security bug.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative GET — the principal-aware fork is the service-tier mechanism that makes "you see what you can see" the contract).
- SUPERSEDES: none.
- CONFLICTS: none.

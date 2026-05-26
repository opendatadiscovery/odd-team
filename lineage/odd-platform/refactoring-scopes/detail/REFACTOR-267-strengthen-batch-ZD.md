## STRENGTHENS — Batch ZD (PolicyController class-level — controller-tier confirmation of the orphan-binding race on DELETE)

**One new class-level sidecar confirms the orphan-binding race surface at the HTTP boundary**:

- **PolicyController (CLASS-LEVEL)** — `PolicyController.deletePolicy` at `:52-57` is a thin `.flatMap` / `.thenReturn` delegation to `policyService.delete(policyId)` with NO transactional bracket at the controller level. The service-tier cascade-binding check at `PolicyServiceImpl.java:89-92` (isPolicyAttachedToRole then if-false, policyRepository.delete) is sequential R2DBC, NOT a transaction. Three-client race: client A `DELETE /api/policies/{id}` reads `isAttached=false` (line 89); client B `POST /api/roles/{r}/policies` adds a `role_to_policy` row referencing the policy; client A's pipeline continues to soft-delete (line 93). Result: surviving `role_to_policy` row referencing a soft-deleted `policy` — the exact orphan-binding state batch-H identified at the repository-layer JOIN that has no `deleted_at IS NULL` predicate.

The HTTP-tier observability is now confirmed: DELETE returns 204, the operator sees success, the policy is gone from the catalogue but its statements continue to grant permissions through `getRolesPolicies` (batch-H finding REFACTOR-230). The orphan binding compounds with REFACTOR-617 (read-side access to soft-deleted policy details — `getPolicyDetails` returns the soft-deleted body to any authenticated user).

**Severity unchanged**: HIGH — silent permission-leak race window.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-230 (the repository-tier JOIN — orphan bindings keep granting permissions), REFACTOR-266 (lost-update race on PUT — same non-atomic shape).
- SUPERSEDES: none.
- CONFLICTS: none.

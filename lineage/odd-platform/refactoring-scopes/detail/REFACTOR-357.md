## REFACTOR-357 — `ReactiveRoleRepositoryImpl.getDto / listDto / getByName` LEFT JOIN POLICY without `policy.deleted_at IS NULL` filter — symmetric mirror of batch-H REFACTOR-230 (Policy-side); soft-deleted policies still surface in RoleDto, in-memory permission-extractor chain still computes permissions FROM them if consumed transitively

**Severity**: HIGH
**Category**: missing-defence-in-depth (authorization — orphan-binding-grants-permission surface; mirror of REFACTOR-230)
**Surfaced by**:
- `ReactiveRoleRepositoryImpl.md:bugs_limitations_corner_cases[0]` (DRIFT-FACET-A — explicit primary-source statement of the gap as the structural mirror of batch-H)
- `ReactiveRoleRepositoryImpl.md:security.known_security_gaps[0]` (DRIFT-FACET-A under #security)
- Cross-batch: REFACTOR-230 (the Policy-side primary-source — `ReactivePolicyRepositoryImpl.getRolesPolicies`)

**Description**: `ReactiveRoleRepositoryImpl` exposes three custom DTO methods that all materialise the role-with-attached-policies view via `jsonArrayAgg(POLICY.asterisk())` (ADR-CANDIDATE-131 NEW). The SQL at lines 45-48 (`getDto`), 67-70 (`listDto`), and 87-90 (`getByName`) joins `POLICY` like this:

```sql
SELECT role.*, jsonArrayAgg(policy.*) AS policy_relations
FROM role
LEFT JOIN role_to_policy ON role.id = role_to_policy.role_id
LEFT JOIN policy ON role_to_policy.policy_id = policy.id
WHERE role.id = ? AND role.deleted_at IS NULL
GROUP BY role.*
```

The LEFT JOIN to `POLICY` has **NO `policy.deleted_at IS NULL` predicate**. The schema (`V0_0_55__add_policies_and_roles.sql:44-53`) declares `role_to_policy.policy_id` FK with NO `ON DELETE CASCADE` and NO trigger removing role_to_policy rows when `policy.deleted_at` is set.

Combined with the cascade-block defence at `PolicyServiceImpl.delete` (lines 89-92) which raises `CascadeDeleteException` if `isPolicyAttachedToRole(id)` returns true:

- (a) `PolicyServiceImpl.delete` refuses to soft-delete a policy that has surviving role_to_policy bindings — the service-tier defence.
- (b) But ANY path that BYPASSES `PolicyServiceImpl.delete` — direct SQL `UPDATE policy SET deleted_at = NOW() WHERE id = X`, a future admin tool, a future refactor weakening the cascade-check, a partial-transaction-failure committing the deleted_at write but rolling back the role_to_policy cleanup — produces orphan bindings.
- (c) `RoleRepository.getDto / listDto / getByName` materialise the orphan policy into the RoleDto's `Set<PolicyPojo>`. The soft-deleted policy's `policy` text column survives; its MANAGEMENT/ALL statements survive.
- (d) IF the RoleDto's `Set<PolicyPojo>` is consumed by the permission-extractor chain (today the extractor uses `ReactivePolicyRepositoryImpl.getRolesPolicies` directly — REFACTOR-230 is the primary defence-in-depth failure), the soft-deleted policy's permissions continue to be granted.

**The symmetry with REFACTOR-230**: REFACTOR-230 documented the Policy-side primary defence-in-depth gap (`getRolesPolicies` is the SOLE method that drives the permission-extractor hot path; it lacks the `policy.deleted_at IS NULL` filter). This scope is the Role-side mirror — the SAME pattern, the SAME failure mode, at the SAME class of method, in a DIFFERENT repository. BOTH halves of the RBAC role-policy retrieval surface have the soft-delete-filter gap on custom JOINs feeding `jsonArrayAgg`.

The maintainer-extension contract under ADR-CANDIDATE-068 (two-tier soft-delete) IS to apply `addSoftDeleteFilter` on every read. The `addSoftDeleteFilter` helper from the base class is applied automatically on `get` / `list` / `delete` against the PARENT table (ROLE), but NOT to custom JOIN targets (POLICY). The gap is the maintainer-extension contract failure at TWO sites — Policy + Role — with the same fix shape.

**Primary source citations**:
- `ReactiveRoleRepositoryImpl.java:45-48, 67-70, 87-90` — the three custom JOIN sites without policy.deleted_at filter
- `V0_0_55__add_policies_and_roles.sql:44-53` — role_to_policy FK with NO cascade
- `PolicyServiceImpl.java:89-92` — the service-layer defence (cascade-block on `isPolicyAttachedToRole`)
- Cross-batch: REFACTOR-230 — the Policy-side primary-source mirror
- Cross-batch: ADR-CANDIDATE-068 / -131 NEW — the architectural intent (every soft-deletable join filters `deleted_at IS NULL` per `addSoftDeleteFilter`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-068 (two-tier soft-delete taxonomy) PRESCRIBES the soft-delete-filter discipline on every read; ADR-CANDIDATE-131 NEW (jsonArrayAgg single-query DTO materialisation) PRESCRIBES that every relation LEFT JOIN consumed by jsonArrayAgg MUST filter `deleted_at IS NULL` — see the maintainer-extension contract in the ADR. This scope is the conformance gap.

**Proposed remedy**: Add the predicate to all three sites. Concretely:

```java
// Before (lines 45-48, 67-70, 87-90):
.leftJoin(POLICY).on(POLICY.ID.eq(ROLE_TO_POLICY.POLICY_ID))

// After:
.leftJoin(POLICY).on(POLICY.ID.eq(ROLE_TO_POLICY.POLICY_ID)
                     .and(POLICY.DELETED_AT.isNull()))
```

Add an integration test pinning the invariant:
1. Create policy P with MANAGEMENT/ALL.
2. Create role R; bind P to R via role_to_policy.
3. Soft-delete P via direct DB UPDATE (simulating service-bypass).
4. Assert `roleRepository.getDto(R.id)` returns RoleDto with `Set<PolicyPojo>` NOT containing P.

The test pins the invariant against future refactors that might remove the predicate. The fix is one-line additive; no migration needed.

**Severity rationale**: HIGH — RBAC authorization hot path symmetry with REFACTOR-230. Today the RoleDto's `Set<PolicyPojo>` is consumed by:
- `RoleServiceImpl.getCurrentUserRoles` (lines 95-101, 123-126) — feeds `PolicyServiceImpl.getCurrentUserPolicies` → permission-extractor chain.
- `RoleController.getRolesList` (operator-facing Roles tab) — displays soft-deleted policies to operators with no indication they're gone.

The soft-deleted-policy-still-granting-permissions surface fires UNDER the same conditions as REFACTOR-230 — operator-driven direct DB UPDATE, future admin tools, partial-transaction-failure scenarios. The cumulative risk is now 2x — BOTH the Policy-side and Role-side reads need fixing for full defence-in-depth.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-230 (Policy-side mirror), REFACTOR-188 (no audit on RBAC mutations), REFACTOR-073 (no boot-time security-posture validator). The four together describe the "RBAC observability + correctness is broken across four sites" surface.

---

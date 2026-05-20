## REFACTOR-230 — `ReactivePolicyRepositoryImpl.getRolesPolicies` (RBAC hot path) returns SOFT-DELETED policies — orphan role_to_policy bindings still grant permissions

**Severity**: HIGH
**Category**: missing-defence-in-depth (authorization)
**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:bugs_limitations_corner_cases[0]`
- `ReactivePolicyRepositoryImpl.md:security.known_security_gaps[0]`
- `ReactivePolicyRepositoryImpl.md:concepts.invariants[1]` (named explicitly: the custom JOIN does NOT carry the soft-delete filter)

**Description**: `getRolesPolicies` is the SOLE method on the repository above the inherited soft-delete CRUD; its SQL (`ReactivePolicyRepositoryImpl.java:32-35`) is:

```
SELECT policy.* FROM policy
JOIN role_to_policy ON role_to_policy.policy_id = policy.id
WHERE role_to_policy.role_id IN (?, ?, ...)
```

There is **no `policy.deleted_at IS NULL` predicate** on the JOIN. This is the hot path: `ManagementPermissionExtractor.getNonContextualPermissions` (`ManagementPermissionExtractor.java:31-41`) and `AbstractContextualPermissionExtractor.getContextualResourcePermissions` (`AbstractContextualPermissionExtractor.java:24-35`) both call `policyService.getCurrentUserPolicies()` → this method on EVERY authorized HTTP request.

The schema (`V0_0_55__add_policies_and_roles.sql:44-53`) declares the `role_to_policy.policy_id` FK with **no `ON DELETE CASCADE` and no trigger** that removes role_to_policy rows when `policy.deleted_at` is set. The application-layer defence lives in `PolicyServiceImpl.delete` (line 89-92) which raises `CascadeDeleteException` if `isPolicyAttachedToRole(id)` returns true — refusing the soft-delete while bindings exist.

**The gap**: the defence is single-layer at the service. ANY path that bypasses `PolicyServiceImpl.delete` — a direct SQL `UPDATE policy SET deleted_at = NOW() WHERE id = X`, a future admin tool that flips `deleted_at` directly, a future refactor that weakens the cascade-check, or a partial transaction failure that commits the deleted_at-write but rolls back the role_to_policy-clean — produces orphan bindings. Combined with the soft-deleted-policy's surviving `policy.policy` text column, the soft-deleted MANAGEMENT/ALL policy continues to grant the union of its permissions through `getRolesPolicies`. The reviewer reading the SQL has no way to know whether the absence of the soft-delete filter is intentional ("policy soft-delete is reversible — we want the permissions to come back if we restore") or accidental ("forgot to add the filter").

The wisdom-test verdict for this finding tips toward GAP rather than ADR: the comment-free SQL, the service-layer defence, and the parallel codepath at `ReactiveAbstractSoftDeleteCRUDRepository.addSoftDeleteFilter` (which DOES apply the filter on `get`/`list`/`delete`) all argue that the JOIN should also apply it. There is no rationale in any code comment, migration note, or live doc for excluding the filter; the absence is structurally unsafe and reads as oversight.

**Primary source citations**:
- `ReactivePolicyRepositoryImpl.java:32-35` — the JOIN without deleted_at filter
- `V0_0_55__add_policies_and_roles.sql:44-53` — FK with no cascade
- `PolicyServiceImpl.java:89-92` — the single-layer service-side defence
- `ManagementPermissionExtractor.java:31-41` — the hot-path consumer
- `AbstractContextualPermissionExtractor.java:24-35` — the per-resource consumer
- contrast: `ReactiveAbstractSoftDeleteCRUDRepository.java:96-104` — `addSoftDeleteFilter` is applied automatically on `get`/`list`/`delete` but the custom JOIN here does NOT inherit it

**Existing-ADR-or-implied-prescription**: implicit — the platform's convention is "soft-delete reads filter `deleted_at IS NULL`" (visible at every other read path through the base class). `getRolesPolicies` is the lone violator. The fix is one additional `AND policy.deleted_at IS NULL` predicate at line 34 — refactoring within the existing structure, NOT a structural change.

**Proposed remedy**: Add the predicate. Concretely, change:
```java
.where(ROLE_TO_POLICY.ROLE_ID.in(roleIds))
```
to:
```java
.where(ROLE_TO_POLICY.ROLE_ID.in(roleIds)
       .and(POLICY.DELETED_AT.isNull()))
```

Add an integration test that:
1. Creates a policy P with MANAGEMENT/ALL.
2. Binds P to role R.
3. Soft-deletes P via direct DB UPDATE (simulating the bypass).
4. Asserts `getRolesPolicies([R.id])` returns the empty list.
5. Assert the user attached to R can NO LONGER perform MANAGEMENT actions.

The test pins the invariant against future refactors that might remove the predicate. Cross-link with `ReactivePolicyRepositoryImpl` test class (currently zero coverage per the sidecar — see REFACTOR-244 about repository test bootstrap).

**Severity rationale**: HIGH — RBAC authorization hot path. A successful exploit means soft-deleted policies still grant permissions. The exploit chain is: (a) admin soft-deletes a policy by some path that bypasses PolicyServiceImpl.delete (direct DB, schema migration, future refactor), (b) the policy's role bindings survive, (c) every authorized request on those role members continues to be granted the policy's permissions. The detection signal is invisible: there's no audit log on RBAC mutations (per REFACTOR-188), no log emission on the repository read (per REFACTOR-244), and the soft-deleted policy is hidden from `PolicyController.list` / `get` (which DO filter deleted_at via the base class) — so the operator looking for the policy can't see it but the permission still fires.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-188 (no audit on RBAC mutations) and REFACTOR-073 (no boot-time security-posture validator). The triad together describes the "RBAC is invisibly compromisable" surface.

---

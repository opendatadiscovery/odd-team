## REFACTOR-386 — `RoleServiceImpl.update` on a soft-deleted role silently no-ops — the soft-delete base's idCondition adds `deleted_at IS NULL` filter, so the UPDATE matches zero rows and the Mono completes empty rather than raising NotFoundException; mirror of batch-H Policy DRIFT-FACET-D

**Severity**: MEDIUM
**Category**: misleading-api (silent no-op on soft-deleted target)
**Surfaced by**:
- `ReactiveRoleRepositoryImpl.md:bugs_limitations_corner_cases[DRIFT-FACET-D]`
- Cross-batch: batch-H DRIFT-FACET-D on Policy (the structural mirror)

**Description**: `ReactiveAbstractSoftDeleteCRUDRepository.java:77-79` defines `idCondition` as `ROLE.ID.eq(id).and(addSoftDeleteFilter())` — the soft-delete filter `deleted_at IS NULL` is appended. The inherited `update(roleId, RoleFormData)` issues `UPDATE role SET ... WHERE id = ? AND deleted_at IS NULL`. If the targeted role is soft-deleted, ZERO rows match and the UPDATE returns 0 rows changed.

Reactor's `Mono<Void>` completes empty rather than raising an error. The NotFound semantic lives at the SERVICE layer (`RoleServiceImpl.java:67`: `.switchIfEmpty(Mono.error(new NotFoundException("Role", id)))`).

**A service-bypassing caller** (e.g., a hypothetical future direct-repository injection or admin tool) invoking `roleRepository.update(...)` DIRECTLY silently NO-OPs — the caller sees a successful `Mono<Void>` with no signal that the update did not apply.

Mirror of batch-H DRIFT-FACET-D on `ReactivePolicyRepositoryImpl.update`. Today the only documented caller of `roleRepository.update` is `RoleServiceImpl.update` (which has the `.switchIfEmpty(NotFound)`). Future bypass-service callers are exposed.

**Primary source citations**:
- `ReactiveAbstractSoftDeleteCRUDRepository.java:77-79` — idCondition with deleted_at IS NULL
- `ReactiveAbstractCRUDRepository.java:107-110` — inherited update
- `RoleServiceImpl.java:66-67` — service-layer NotFound handling
- Cross-batch: REFACTOR-230's family — the soft-delete-base's `addSoftDeleteFilter` not being applied to custom paths

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-068 (two-tier soft-delete) prescribes the soft-delete-filter behaviour. This scope is the misleading-API surface that the architecture's `Mono<Void>` return type doesn't surface to bypass-service callers.

**Proposed remedy**:
1. **Have the base class `update` raise `NotFoundException` on zero-rows-updated** — moves the NotFound semantic INTO the repository layer. Breaking change for any caller that expects empty completion. Aligns the repository with the service's contract.
2. **Document the silent-no-op behaviour** on the inherited `update` method — Javadoc warning.
3. **Add a runtime assertion at the base class** — `Mono.deferContextual(...)` that throws if zero rows updated.

Option 2 is the smallest blast radius.

**Severity rationale**: MEDIUM — bypass-vulnerability companion; today fired only by the (well-protected) service tier. Future code edits could expose it. Mirror of batch-H Policy finding — consistent across both halves of the RBAC mutation surface.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-230 (Policy soft-delete-filter), REFACTOR-357 (Role-side mirror), REFACTOR-368 (RBAC forensic silence).

---

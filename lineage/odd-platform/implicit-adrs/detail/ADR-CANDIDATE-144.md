## ADR-CANDIDATE-144 — Owner role-rebind is SET-REPLACEMENT not field-merge — `deleteOwnerRelationsExcept(ownerId, newRoles).then(createRelations(ownerId, newRoles))` — REST-PUT semantics with destructive empty-list behaviour

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; codifies the SAME pattern used elsewhere for many-to-many role-rebinds)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Support count**: 2 sidecars (batch P updateOwner + batch P deleteOwner — both visit the `deleteOwnerRelationsExcept` primitive)
**Axes present**: services, repositories
**Batch**: P (2026-05-20)

**Surfaced by**:
- `OwnerController__controller-method__updateOwner.md:implicit_adrs.[2]` (HIGH) — "Role-rebinding is set-replacement, not field-merge — `deleteOwnerRelationsExcept(owner.getId(), newRoles).then(createRelations(owner.getId(), newRoles))` (`OwnerServiceImpl.java:76-81`) deletes all existing role-links not in `newRoles` and inserts the new set. An empty `roles` field on the form is interpreted as 'remove all roles', not 'don't touch'." — intent_anchor: "`ownerToRoleRepository.deleteOwnerRelationsExcept(owner.getId(), newRoles).thenReturn(owner)` then `.flatMap(owner -> ownerToRoleRepository.createRelations(owner.getId(), newRoles).thenReturn(owner))`" (`OwnerServiceImpl.java:76-81`)
- `OwnerController__controller-method__deleteOwner.md:implicit_adrs.[1]` (HIGH) — "Role bindings (OWNER_TO_ROLE) are HARD-DELETED on owner delete — encoded by the explicit call `ownerToRoleRepository.deleteOwnerRelationsExcept(id, List.of())` (`OwnerServiceImpl.java:97`)" — intent_anchor: "DSL.delete(OWNER_TO_ROLE).where(OWNER_TO_ROLE.OWNER_ID.eq(ownerId).and(OWNER_TO_ROLE.ROLE_ID.notIn(roleIds)))"

**Decision statement**: The platform's pattern for many-to-many relation updates on Owner (and likely on every entity with a join-table) is a SET-REPLACEMENT shape:
- `deleteOwnerRelationsExcept(ownerId, newRoles)` — DELETE all existing role-links where `role_id NOT IN newRoles`
- `.then(createRelations(ownerId, newRoles))` — INSERT all `newRoles`

This is REST-PUT semantics applied to the role collection: PUT means "the new state IS this set," not "merge this set into the current state."

Semantic implications:
- **(a) An empty `newRoles` is destructive — it deletes ALL current role-links.** `getRoleIdsList` (`OwnerServiceImpl.java:117-122`) collapses both `null` and empty list to `List.of()`. An API consumer who omits `roles` to mean "don't touch the role assignments" instead silently strips ALL roles.
- **(b) The same primitive is reused at the delete path** — `deleteOwnerRelationsExcept(id, List.of())` is the explicit "wipe everything" call at `OwnerServiceImpl.java:97`. The architectural choice is "delete and update share the same primitive; the difference is the second argument."
- **(c) The role-binding table (`OWNER_TO_ROLE`) is HARD-DELETE, not soft-delete** — a deleted role-link is permanently lost. This is the F-006 family pattern done CORRECTLY at this surface.
- **(d) Set-replacement composes with the centralised SECURITY_RULES gate** — `OWNER_UPDATE` grants "I may rename ANY owner AND replace their roles AND I cannot accidentally add a role via partial update."

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the SAME primitive is reused at the delete path with `List.of()`, which is impossible to reach by accident.
2. **Structural impact?** YES — affects every many-to-many relation update; affects API consumer's expected semantics; affects the destructive-empty-default hazard.
3. **Refactoring or structural?** STRUCTURAL — moving to merge-semantics would require introducing an "add this list" + "remove this list" pair (PATCH-style); changing the OpenAPI contract; updating every consumer.

**Existing ADR**: NEW; cross-link to ADR-CANDIDATE-002 (centralised SECURITY_RULES).

**Proposed action**: Promote to `adrs/drafts/many-to-many-set-replacement.md` (new ADR). Document the primitive, the PUT semantic, the destructive-empty caveat, the F-006 family alignment.

**Co-surfaced gaps**: REFACTOR-425 NEW (empty-roles destructively strips all role bindings), REFACTOR-426 NEW (no audit-event on the role-rebind).

**Severity rationale**: MEDIUM — REST-PUT-semantic convention; load-bearing for the platform's many-to-many relation update story; the destructive-empty caveat is the highest operational concern.

---

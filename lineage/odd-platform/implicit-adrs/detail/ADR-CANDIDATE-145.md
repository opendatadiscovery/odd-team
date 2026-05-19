## ADR-CANDIDATE-145 — Owner deletion uses MIXED soft+hard-delete persistence: soft-delete on the OWNER row (preserves audit history + frees name for re-creation via partial-unique-index), hard-delete on OWNER_TO_ROLE bindings (revokes permissions immediately, no orphan-binding) — the F-006 family pattern done CORRECTLY at this surface

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; positive case-law contrasting with F-006's POLICY/ROLE half)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Support count**: 1 sidecar primary-source (batch P deleteOwner) + cross-batch contrast with F-006 batch I PolicyServiceImpl + batch N RBAC orphan-binding pattern
**Axes present**: services, repositories, schema_migrations
**Batch**: P (2026-05-20)

**Surfaced by**:
- `OwnerController__controller-method__deleteOwner.md:implicit_adrs.[0]` (HIGH) — "Soft-delete on the OWNER entity is INTENTIONAL — encoded by the inheritance `ReactiveOwnerRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository` (`ReactiveOwnerRepositoryImpl.java:43`) AND by the partial-unique-index migration that paired soft-delete-aware uniqueness with the name-recovery story" — intent_anchor: "CREATE UNIQUE INDEX IF NOT EXISTS owner_name_unique ON owner (name) WHERE owner.deleted_at IS NULL;" (`V0_0_64__remove_is_deleted_field.sql:70`)
- `OwnerController__controller-method__deleteOwner.md:implicit_adrs.[1]` (HIGH) — "Role bindings (OWNER_TO_ROLE) are HARD-DELETED on owner delete — encoded by the explicit call `ownerToRoleRepository.deleteOwnerRelationsExcept(id, List.of())` (`OwnerServiceImpl.java:97`) … **This is the F-006 family pattern done CORRECTLY at this surface** — unlike the OWNER_TO_ROLE/POLICY soft-delete drift the F-006 family identified at the POLICY/ROLE half."

**Decision statement**: When `DELETE /api/owners/{owner_id}` is invoked (gated by `OWNER_DELETE` permission), the platform performs a DUAL-PERSISTENCE write:

1. **Soft-delete on `owner` row** — `UPDATE owner SET deleted_at = NOW() WHERE id = ?` (`ReactiveAbstractSoftDeleteCRUDRepository.delete`).
   - The row PERSISTS with `deleted_at` set; audit history (`created_at` + `deleted_at` timestamps) survives.
   - The partial-unique-index `owner_name_unique ON owner(name) WHERE deleted_at IS NULL` (V0_0_64__remove_is_deleted_field.sql:70) FREES the name for re-creation.
2. **Hard-delete on `owner_to_role` join-table** — `DELETE FROM owner_to_role WHERE owner_id = ?` (via `deleteOwnerRelationsExcept(id, List.of())`).
   - Role bindings are PHYSICALLY removed; permissions are revoked immediately.
   - No orphan binding can confer permissions to a soft-deleted owner.

This is a positive case-law statement contrasting the F-006 family's POLICY/ROLE half, which inherits soft-delete from `ReactiveAbstractSoftDeleteCRUDRepository` for BOTH the policy row AND the role-to-policy binding — producing the orphan-binding pattern surfaced by F-006 batch I + batch N RBAC orphan-binding pattern. The Owner half closes that gap by:
- **Choosing soft-delete on the directory row** (audit + name-recovery preserved)
- **Choosing HARD-delete on the binding row** (permission-revocation enforced)

The architectural commitments:
- **(a) The directory row's "deleted" state is the AUDIT artefact, not a permission artefact.**
- **(b) The partial-unique-index is the NAME-RECOVERY pattern's persistence-layer enforcement.**
- **(c) The hard-delete on the binding closes the orphan-binding gap on the OWNER side.**
- **(d) This is the prescription the POLICY/ROLE half SHOULD have followed.** The maintainer's choice at the Owner surface is the EXPLICIT model for fixing the F-006 family gap at the POLICY/ROLE surface.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the V0_0_64 migration commits BOTH changes in one script; the inheritance line is explicit; the `deleteOwnerRelationsExcept(id, List.of())` call is explicit (NOT a side-effect of the soft-delete cascade).
2. **Structural impact?** YES — affects every soft-delete entity's binding-table choice; provides the cross-batch prescription for the F-006 family's RBAC orphan-binding gap.
3. **Refactoring or structural?** STRUCTURAL — the mixed soft+hard-delete is the structural decision; moving to all-soft-delete (resurrecting the F-006 problem) or all-hard-delete (losing audit history) would require schema changes + migration scripts + every-consumer update.

**Existing ADR**: NEW; positive case-law statement complementing the F-006 cascade-incompleteness story. Cross-link to ADR-CANDIDATE-144 (set-replacement on role-rebind — uses the SAME primitive `deleteOwnerRelationsExcept` with `List.of()` to wipe all bindings).

**Proposed action**: Promote to `adrs/drafts/owner-mixed-soft-hard-delete-pattern.md` (new ADR). Document the dual-persistence choice + the partial-unique-index name-recovery pattern + the contrast with the F-006 family POLICY/ROLE soft-delete drift. Cite as the prescriptive model for any future RBAC-half refactor.

**Co-surfaced gaps**: REFACTOR-427 NEW (owner_association_request orphan rows), REFACTOR-428 NEW (FTS search vector NOT refreshed on owner delete), REFACTOR-429 NEW (idempotency / not-found indistinguishable on delete), REFACTOR-430 NEW (race-window between cascade-check and soft-delete — non-atomic).

**Severity rationale**: MEDIUM — positive-intent architectural decision with cross-batch prescriptive value; the supplementary gaps (REFACTOR-427..430) are MEDIUM operational concerns that don't undermine the core pattern.

---

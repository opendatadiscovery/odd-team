## REFACTOR-430 — Cascade-check + soft-delete on Owner is NOT atomic — concurrent `POST /api/dataentities/{id}/ownership` can slip past the existence check; MIRROR of F-006 batch I `cascade_check_non_atomic` facet on PolicyServiceImpl

**Severity**: MEDIUM (operationally rare; admin-time operations)
**Category**: race-window
**Pillars affected**: [P-08-management-administration, P-09-security-access-control]
**Batch**: P (2026-05-20)

**Surfaced by**: `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[4]`

**Description**: `OwnerServiceImpl.delete:88-100` runs `@ReactiveTransactional` (line 88) but under `READ COMMITTED` isolation (Spring/R2DBC default). The three `existsBy*` cascade-check reads (`OwnerServiceImpl.java:90-91`) do NOT acquire row-level locks (no `SELECT FOR UPDATE`, no Postgres advisory lock on `owner_id`). A concurrent `POST /api/dataentities/{id}/ownership` (creating an OWNERSHIP row for this owner) racing with `DELETE /api/owners/{owner_id}` is theoretically able to slip a fresh OWNERSHIP row past the existence check. Result: an OWNERSHIP row pointing to a soft-deleted OWNER. Mirrors F-006 batch I `cascade_check_non_atomic` facet (PolicyServiceImpl.delete + role_to_policy) — same shape, different table.

**Primary source citations**:
- `OwnerServiceImpl.java:88-100` (cascade-check + delete in one @ReactiveTransactional but no FOR UPDATE)
- F-006 batch I observed_vs_expected.facet `cascade_check_non_atomic`

**Existing-ADR-or-implied-prescription**: F-006 batch I `cascade_check_non_atomic` facet. ADR-CANDIDATE-145 (mixed soft+hard-delete) prescribes the atomicity but the implementation is not lock-protected.

**Proposed remedy**:
1. Add `.forUpdate()` to the three `existsBy*` repository methods (or equivalently to the owner-existence read at the start of the transaction).
2. ALTERNATIVELY (less invasive): switch the isolation level on the `@ReactiveTransactional` to `SERIALIZABLE` for delete operations only.
3. ALTERNATIVELY (lock-free): redesign as an UPDATE-then-check pattern: `UPDATE owner SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL AND NOT EXISTS(... cascade rows ...)` — atomic at Postgres level.

**Severity rationale**: MEDIUM — race-window is narrow; admin-time operations are rare; but the dirty-write outcome (orphan OWNERSHIP row) is the same as REFACTOR-427's orphan-row family.

**Suggested backlog grouping**: `RBAC concurrency hardening sprint` (pair with F-006 batch I PolicyServiceImpl + the other `cascade_check_non_atomic` instances).

---

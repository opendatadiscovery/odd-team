## REFACTOR-427 — Owner deletion does NOT cascade to `owner_association_request` — orphan rows persist pointing to soft-deleted owner; long-game RBAC-pollution surface

**Severity**: HIGH (under DISABLED auth mode the surface becomes attacker-reachable; ordinarily mitigated by OWNER_ASSOCIATION_* permission gates)
**Category**: cascade-incompleteness (cross-cutting; mirrors F-006 family pattern; cross-batch with the soft-delete-on-OWNER + hard-delete-on-OWNER_TO_ROLE positive pattern of ADR-CANDIDATE-145)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Batch**: P (2026-05-20)

**Surfaced by**:
- `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[1]` (HIGH) — "`owner_association_request` orphan rows are NOT cleaned up on owner delete — the cascade-block checks `termOwnership` + `ownership` + `userOwnerMapping` (`OwnerServiceImpl.java:90-91`) but NOT `owner_association_request`. The table has a foreign key to `owner(id)` (`V0_0_51__add_owner_association_request.sql:11` `CONSTRAINT owner_association_request_owner_fk FOREIGN KEY (owner_id) REFERENCES owner (id)`) but NO `ON DELETE` clause"
- `OwnerController__controller-method__deleteOwner.md:security.known_security_gaps.[1]` (MEDIUM)

**Description**: `OwnerServiceImpl.delete` (`:88-100`) runs a three-leg cascade-block check (`termOwnership.existsByOwner` + `ownership.existsByOwner` + `userOwnerMapping.isOwnerAssociated`) but does NOT check a fourth FK-bearing table: `owner_association_request`. The table's FK at `V0_0_51__add_owner_association_request.sql:11` has NO `ON DELETE` clause (defaults to `NO ACTION`); the table has no soft-delete column. Because OWNER uses soft-delete (UPDATE `deleted_at`, not DELETE FROM), the FK constraint is never consulted. **Result**: a `PENDING` or `APPROVED` owner_association_request for the just-deleted owner persists; the next `GET /api/owner_association_request` listing returns the orphan row.

The cross-flow consequence: an operator who deletes an owner AND THEN re-creates a NEW owner with the same name (the partial-unique-index pattern allows this — V0_0_64) finds the orphan request points to the OLD soft-deleted owner_id, NOT the new owner_id. The two ids are different; the orphan continues pointing into soft-deleted space. **An attacker with `OWNER_ASSOCIATION_*` permissions could plant orphan rows that survive future owner directory churn — useful for a long-game persistence technique.** Under `auth.type=DISABLED` (the shipped default), no permission is required at all; the surface is anonymously reachable.

The cross-batch pattern: this mirrors the F-006 family's cascade-incompleteness pattern (batch I PolicyServiceImpl + batch K OwnershipServiceImpl). The Owner side's cascade-block covers 3 of 4 FK-bearing tables; the missing 4th is `owner_association_request`.

**Primary source citations**:
- `OwnerServiceImpl.java:90-91` (three cascade checks; no `owner_association_request` check)
- `V0_0_51__add_owner_association_request.sql:11` (FK no ON DELETE; no `deleted_at` column)
- `ReactiveOwnerRepositoryImpl.java:140-159` (the `allowedForSync` LEFT JOIN that exposes the orphan in the listing endpoint)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-145 NEW (batch P — soft-delete on owner + hard-delete on OWNER_TO_ROLE — the F-006-family-done-correctly pattern) codifies the GENERAL principle of "the cascade-block should be comprehensive." This scope is the SPECIFIC incompleteness of that cascade-block — one of four tables is missed.

**Proposed remedy**:
1. Add a FOURTH leg to the cascade-block: `ownerAssociationRequestRepository.existsByOwner(ownerId)` (or restrict to PENDING/APPROVED statuses).
2. ALTERNATIVELY (less invasive): on owner delete, MARK any associated requests as CANCELLED (a status mutation in the same transaction).
3. ALTERNATIVELY (schema-level): add `ON DELETE SET NULL` or `ON DELETE CASCADE` to the FK at V0_0_51. (Schema migration with operational risk if requests are auditable; pair with maintainer triage.)
4. Companion `@WebFluxTest` regression asserting that a PENDING request for owner X blocks `DELETE /api/owners/{X}` with HTTP 400 USR004, OR that the request is auto-cancelled in the same transaction.

**Severity rationale**: HIGH under DISABLED auth (anonymous reach to plant orphans); MEDIUM under proper auth (still a long-game persistence vector but requires OWNER_ASSOCIATION_* permissions); selected HIGH because the worst case (DISABLED — shipped default) determines severity.

**Suggested backlog grouping**: `Owner directory cascade hardening sprint` (pair with REFACTOR-425 + REFACTOR-426 + REFACTOR-428 + REFACTOR-429 + REFACTOR-430).

---

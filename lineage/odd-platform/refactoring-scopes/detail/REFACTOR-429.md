## REFACTOR-429 — Owner deletion `Mono` propagation cannot distinguish 'I deleted it' from 'already deleted' from 'never existed' — no `switchIfEmpty(NotFoundException)` on `delete(id)`; MIRROR of F-006 batch K facet on OwnershipServiceImpl

**Severity**: MEDIUM
**Category**: missing-error-mapping / silent-200 (idempotency-on-missing)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Batch**: P (2026-05-20)

**Surfaced by**: `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[3]`

**Description**: `OwnerServiceImpl.delete` (lines 88-100) has no `switchIfEmpty(Mono.error(NotFoundException))` on `ownerRepository.delete(id)`. The repository's soft-delete UPDATE filters `idCondition` which adds `deleted_at IS NULL` (`ReactiveAbstractSoftDeleteCRUDRepository.java:76-79`); calling `delete(id)` against a non-existent or already-soft-deleted id returns an empty `Mono` (the `RETURNING` clause emits nothing). The downstream `.then()` (`OwnerServiceImpl.java:99`) and `.thenReturn(noContent())` (`OwnerController.java:44`) propagate empty as success → HTTP 204. **Caller cannot distinguish three outcomes**: (a) "owner X existed, I deleted it"; (b) "owner X was already soft-deleted, nothing changed"; (c) "owner X never existed at all."

The asymmetry within the same service: `OwnerServiceImpl.update` (lines 69-85) DOES `.switchIfEmpty(Mono.error(new NotFoundException("Owner", id)))` at line 73 — the same shape applied to update returns 404; on delete the same shape would return 404 but is missing. The maintainer chose ONE pattern for update and a DIFFERENT pattern for delete; the choice is unstated.

Mirrors F-006 batch K's `delete_no_not_found_validation` facet on `OwnershipServiceImpl.delete` — same gap, different table.

**Primary source citations**:
- `OwnerServiceImpl.java:88-100` (delete, no NotFound check)
- `OwnerServiceImpl.java:69-85` (update WITH `.switchIfEmpty(Mono.error(NotFoundException))`)
- F-006 batch K `delete_no_not_found_validation` facet

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-145 (mixed soft+hard-delete) implies idempotency-on-missing is "fine for delete" (REST DELETE-idempotency convention). This scope is the operator-facing UX gap: the platform's idempotency choice silently masks "owner does not exist" failures.

**Proposed remedy**:
1. Add `.switchIfEmpty(Mono.error(new NotFoundException("Owner", id)))` on `ownerRepository.delete(id)` before the `.then()` continuation, mirroring the update path's pattern. RESULT: a delete of a non-existent owner returns 404 USR001 instead of 204.
2. ALTERNATIVE (preserve REST DELETE-idempotency): keep the current behaviour but explicitly DOCUMENT it (the live `OWNER_DELETE` permission page should say "DELETE is idempotent; a 204 response does not guarantee the row existed"). Pair with an INFO-level log entry on the empty-Mono path so operators have a forensic trail.
3. Companion `@WebFluxTest` regression asserting (a) DELETE of existing owner returns 204; (b) DELETE of already-soft-deleted owner returns 204 (and log entry); (c) DELETE of never-existing owner returns 404 (or 204 + log per choice).

**Severity rationale**: MEDIUM — operator UX gap; not security-critical (cannot create data); affects forensic reconstruction.

**Suggested backlog grouping**: `Owner directory hygiene sprint` (group with REFACTOR-428).

---

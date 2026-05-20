## REFACTOR-432 — Soft-deleted owners visible via `GET /api/owners/{id}` (the `getDto` consumer) but invisible via `GET /api/owners` (the list consumer) — asymmetric visibility; info-leak surface if owner name is sensitive PII

**Severity**: MEDIUM
**Category**: info-leak-via-by-id (visibility-asymmetry)
**Pillars affected**: [P-08-management-administration, P-09-security-access-control]
**Batch**: P (2026-05-20)

**Surfaced by**: `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[6]` + `:security.known_security_gaps.[2]`

**Description**: `ReactiveOwnerRepositoryImpl.getDto` (lines 65-83) does NOT apply the soft-delete filter on OWNER (`WHERE OWNER.ID.eq(id)` without `deleted_at IS NULL`). Direct `GET /api/owners/{id}` via `OwnerService.getOwnerDtoById` (`OwnerServiceImpl.java:102-107`) RETURNS the soft-deleted row + `.switchIfEmpty(Mono.error(NotFoundException))` only fires when the ID does not exist at all. In contrast, `ReactiveOwnerRepositoryImpl.list` at lines 86-121 uses `enrichSelect` which calls `listCondition` (inherited from `ReactiveAbstractSoftDeleteCRUDRepository.listCondition` at lines 86-94) which adds `deleted_at IS NULL`. Soft-deleted owners do NOT appear in the listing.

**The visibility of a soft-deleted owner is INCONSISTENT across list vs by-id queries** — list hides them; by-id surfaces them. If a soft-deleted owner's name is sensitive (e.g., PII the platform stored), the by-id surface leaks it to a caller who knows the ID (e.g., from cached search results, from a stale lineage view, from a UI bookmark).

**Primary source citations**:
- `ReactiveOwnerRepositoryImpl.java:65-83` (`getDto` no `deleted_at` filter) vs `:86-121` (list filtered)
- `OwnerServiceImpl.java:102-107` (`getOwnerDtoById` consumer)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-145 (mixed soft+hard-delete) does NOT explicitly address the visibility-on-read of soft-deleted rows. The implied prescription is "soft-delete should be soft-delete consistently"; the by-id surface drifts from this principle.

**Proposed remedy**:
1. Add `deleted_at IS NULL` to `ReactiveOwnerRepositoryImpl.getDto` (mirrors the list filter).
2. ALTERNATIVELY (preserve admin-view of soft-deleted rows): introduce a `includeDeleted(boolean)` overload of `getOwnerDtoById` (mirrors the `DataEntityServiceImpl.getDetails(id, includeDeleted=true)` pattern from batch F); default to FALSE; require an explicit caller opt-in to view soft-deleted owners.
3. Companion `@WebFluxTest` regression asserting (a) GET of existing owner returns 200 with payload; (b) GET of soft-deleted owner WITHOUT includeDeleted returns 404; (c) GET of soft-deleted owner WITH includeDeleted=true returns 200 with deleted_at populated.

**Severity rationale**: MEDIUM — info-leak surface conditional on the name being sensitive; consistency drift between list and by-id reads.

**Suggested backlog grouping**: `Owner directory hygiene sprint` (group with REFACTOR-428 + REFACTOR-429 + REFACTOR-430).

---

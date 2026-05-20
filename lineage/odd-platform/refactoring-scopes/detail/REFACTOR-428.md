## REFACTOR-428 — Owner deletion does NOT refresh FTS search vectors — deleted owner's name continues surfacing in catalog search results until another event refreshes the affected entities' vectors; MIRROR of F-006 batch K facet on OwnershipServiceImpl

**Severity**: MEDIUM
**Category**: silent-200-on-missing-side-effect (cross-batch with batch-K F-006 facet)
**Pillars affected**: [P-01-data-discovery, P-08-management-administration, P-09-security-access-control]
**Batch**: P (2026-05-20)

**Surfaced by**: `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[2]`

**Description**: `OwnerServiceImpl.update` calls `updateSearchVectors(owner)` at line 82 → lines 109-114 refreshing BOTH `searchEntrypointRepository.updateChangedOwnerVectors` AND `termSearchEntrypointRepository.updateChangedOwnerVectors`. `OwnerServiceImpl.delete` (lines 89-100) has NO `updateSearchVectors` call. After a successful delete, the FTS index continues to surface the deleted owner's name when users search the catalog — matches against `search_entrypoint.search_vector` for data entities the owner bore, until those entities are otherwise modified. The asymmetry between update (vectors refreshed) and delete (vectors NOT refreshed) is unstated; the F-006 batch K finding (`delete_search_vector_not_refreshed` on OwnershipServiceImpl) is the cross-batch sibling — same gap, sibling delete path.

**Primary source citations**: `OwnerServiceImpl.java:69, 82` (create + update DO refresh) vs `:89-100` (delete does NOT)

**Existing-ADR-or-implied-prescription**: F-006 batch K facet `delete_search_vector_not_refreshed`. ADR-CANDIDATE-145 NEW (mixed soft+hard-delete pattern) prescribes the dual-write but is silent on the search-vector side effect.

**Proposed remedy**: Add `.flatMap(this::updateSearchVectors)` to `OwnerServiceImpl.delete` AFTER the soft-delete UPDATE. The two `updateChangedOwnerVectors` calls handle soft-deleted owners correctly (they fold the absence into the vector recomputation). Companion `@WebFluxTest` regression asserting that after DELETE, search for the deleted owner's name returns ZERO matches (or surfaces the deleted entities' vectors with the owner name absent).

**Severity rationale**: MEDIUM — UX/discovery gap (operators search for the OLD owner name and see stale results); paired with REFACTOR-426 (no audit) it's compounded confusion.

**Suggested backlog grouping**: `Owner directory hygiene sprint` (group with REFACTOR-425 + REFACTOR-426 + REFACTOR-427 + REFACTOR-429 + REFACTOR-430).

---

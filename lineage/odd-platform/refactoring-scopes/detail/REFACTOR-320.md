## REFACTOR-320 — `OwnershipServiceImpl.delete` flow does NOT refresh the search_entrypoint FTS vector — after a successful delete, the FTS index may continue surfacing the removed owner-name in catalog search results until the entity is otherwise modified

**Severity**: MEDIUM
**Category**: missing-validation (search-index-staleness)
**Pillars affected**: [P-01-data-discovery, P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__OwnershipServiceImpl.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "The `delete` flow does NOT refresh the `search_entrypoint` FTS vector. Compare: `create` (line 69) and `update` (line 116) call `searchEntrypointRepository.updateChangedOwnershipVectors(ownershipId)`. The `delete` flow at lines 81-96 has NO equivalent call. After a successful delete, the FTS index may still surface the old owner-name in catalog search results until the search vector is refreshed by some other event (e.g. a subsequent create or update on the same data entity)."

**Description**: `OwnershipServiceImpl.create` (line 69) and `update` (line 116) both invoke `searchEntrypointRepository.updateChangedOwnershipVectors(ownershipId)` after writing the row, refreshing the `search_entrypoint` materialised view's tsvector for the data entity. The `delete` flow (lines 81-96) has NO equivalent call. The FTS vector for the data entity therefore retains the old owner-name component until another mutation triggers a refresh (e.g. a subsequent create or update). Operators searching for "owner: Brand X" continue to find data entities they previously delinked from Brand X until the next unrelated edit on those entities.

**Failure mode**: An operator removes Owner "AcmeCorp" from 50 data entities (e.g. AcmeCorp left the organisation; ownership transferred to "PlatformTeam"). The delete operations succeed, but the FTS vector for each of those 50 data entities still contains "AcmeCorp" until a subsequent create / update on each entity. A search query "owner:AcmeCorp" continues to return the 50 entities. Operators auditing "remaining AcmeCorp assets" via search see misleading results.

**Primary source citations**:
- `OwnershipServiceImpl.java:69` (create updates vectors)
- `OwnershipServiceImpl.java:116` (update updates vectors)
- `OwnershipServiceImpl.java:81-96` (delete does NOT update vectors)
- Grep `searchEntrypointRepository` against `OwnershipServiceImpl.java` returns only lines 69 and 116

**Existing-ADR-or-implied-prescription**: None. The pattern across `create` + `update` IMPLIES that every mutation should refresh the FTS vector; the absence of the refresh in `delete` is a defect, not an ADR-level decision.

**Proposed remedy**: One-line addition — call `searchEntrypointRepository.updateChangedOwnershipVectors(...)` (or the dataEntityId-keyed variant if the ownership row is gone by then) inside the `delete` flow after the row is removed. Add a regression test asserting that an FTS search for the removed owner-name does NOT return the affected data entities after delete.

**Severity rationale**: MEDIUM — search-result staleness affects operator discovery flows; not a data-integrity issue but a real operator-trap.

**Suggested backlog grouping**: `Search index hygiene sprint`

---

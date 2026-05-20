## REFACTOR-219 — `upsertDataEntityInternalDescription` silently returns 200 OK with empty body when the data entity does not exist — misleading "upsert" semantic

**Severity**: MEDIUM
**Category**: missing-error-translation
**Surfaced by**:
- `upsertDataEntityInternalDescription.md:bugs_limitations_corner_cases[1]`
- `upsertDataEntityInternalDescription.md:concepts.invariants[2]`

**Description**: `setInternalDescription` is `DSL.update(DATA_ENTITY).set(INTERNAL_DESCRIPTION, …).where(DATA_ENTITY.ID.eq(dataEntityId)).returning()` (`ReactiveDataEntityRepositoryImpl.java:432-435`). If `dataEntityId` does not exist, the query updates 0 rows, the `mono(query).map(r -> r.into(DataEntityPojo.class))` returns `Mono.empty`, the rest of the reactive pipeline collapses, and the controller returns `200 OK` with an empty body — NOT `404 Not Found`. The operation is documented as an "upsert" (`openapi.yaml:929-930`, `summary: "Upsert DataEntity's internal description"`) — implying CREATE-or-UPDATE semantics. The implementation is pure UPDATE with silent no-op on missing entity. Compare with the sibling `updateStatus` (`DataEntityServiceImpl.java:467`) which calls `.switchIfEmpty(() -> Mono.error(new NotFoundException("DataEntity", id)))` to convert missing-entity into 404. The description path has no such guard. Operators using the API by id (e.g. from a script that scrapes ids from search results) cannot distinguish "wrote successfully" from "id is wrong / soft-deleted." Activity feed shows nothing in the no-op case (the `@ActivityLog(DESCRIPTION_UPDATED)` AOP advice on `updateDescription` does NOT emit an event because empty Mono short-circuits the advice).

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:430-438` (UPDATE only, no INSERT branch, no existence check)
- `DataEntityServiceImpl.java:323-333` (`upsertDescription` has no `NotFoundException` path)
- `DataEntityServiceImpl.java:467` (the sibling `updateStatus` showing the right pattern)
- `openapi.yaml:929-930` (the misleading "Upsert" summary)
- `DataEntityInternalStateServiceImpl.java:54-71` (the full empty-mono-propagating pipeline)

**Existing-ADR-or-implied-prescription**: implicit prescription in the sibling `updateStatus` codepath — the project's convention is to translate empty result on a per-id mutation to 404. This scope is an inconsistency, not a structural decision; remedying it is refactoring within the existing service-layer pattern.

**Proposed remedy**: Add `.switchIfEmpty(() -> Mono.error(new NotFoundException("DataEntity", dataEntityId)))` at the appropriate point in `DataEntityServiceImpl.upsertDescription` (or `DataEntityInternalStateServiceImpl.updateDescription`). Update the OpenAPI summary from "Upsert" to "Update" (the operationId rename is a breaking-name change; surface as a deprecation-and-rename in a separate scope or accept the cosmetic miscalling as low-priority). Add a `@WebFluxTest` asserting that a non-existent `dataEntityId` returns 404.

**Severity rationale**: MEDIUM — operator UX trap, not a security gap. The bug is silent failure detection on a write path used by both UI and external scripts. The fix is local, well-bounded, and has a clear sibling-pattern precedent.

**Suggested backlog grouping**: DOC-NNN companion (the OpenAPI summary is misleading) + a refactoring item (the NotFoundException translation) under a "DataEntityController API consistency" sprint.

---

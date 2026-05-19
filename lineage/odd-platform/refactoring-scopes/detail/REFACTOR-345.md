## REFACTOR-345 — DEG-lineage 404 conflates THREE semantically distinct conditions (DEG-not-found, non-DEG-typed entity, DEG-has-no-members) — operators cannot debug; the error message `Data entity group {id} doesn't exist` is misleading for two of the three cases

**Severity**: MEDIUM
**Category**: error-mapping (conflation)
**Pillars affected**: [P-05-data-lineage, P-08-management-administration]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**404 conflates three semantically distinct conditions** — `NotFoundException(\"Data entity group\", dataEntityGroupId)` at LineageServiceImpl.java:62 fires when (a) the DEG ID does not exist, (b) the ID references a non-DEG-typed entity, OR (c) the DEG exists but has zero non-soft-deleted members. The SQL CTE at ReactiveGroupEntityRelationRepositoryImpl.java:177-204 selects from `group_entity_relations` keyed on the entity's oddrn — for cases (a) and (b) the inner subquery `DSL.select(DATA_ENTITY.ODDRN).from(DATA_ENTITY).where(DATA_ENTITY.ID.eq(dataEntityGroupId))` either returns no row OR returns the wrong-typed oddrn, and the outer recursive CTE returns empty in both cases. The error message is identical for all three: 'Data entity group {id} doesn't exist'. Operators debugging 'why is my DEG-lineage call returning 404?' cannot discriminate."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:security.known_security_gaps.[4]` (LOW — operator-debugging cost; weak obfuscation in favour of enumeration resistance)

**Description**: `LineageServiceImpl.getDataEntityGroupLineage` at line 62 raises `NotFoundException("Data entity group", dataEntityGroupId)` via the `.switchIfEmpty(...)` operator on the member-resolution Flux. The Flux empties for THREE structurally different reasons that the error message cannot distinguish:

1. **DEG ID does not exist** (`data_entity` row with id=`dataEntityGroupId` is absent) — the inner subquery `DSL.select(DATA_ENTITY.ODDRN).from(DATA_ENTITY).where(DATA_ENTITY.ID.eq(dataEntityGroupId))` at `ReactiveGroupEntityRelationRepositoryImpl.java:182-184` returns no row; the outer recursive CTE returns empty.
2. **ID references a non-DEG-typed entity** (e.g. the caller passes a Dataset ID by mistake) — the data_entity row exists but is NOT a DEG; `group_entity_relations` has no row keyed on this entity's oddrn (the entity is not a group); the recursive CTE returns empty.
3. **DEG exists but has zero non-soft-deleted members** — the DEG itself is fine; `group_entity_relations` has no current member rows for this DEG; the recursive CTE returns empty.

All three produce identical `NotFoundException("Data entity group", dataEntityGroupId)` → HTTP 404 with the message `Data entity group {id} doesn't exist`. The message is **literally incorrect** for case (2) (the entity DOES exist, it's just not a DEG) and case (3) (the DEG DOES exist, it just has no members).

**Operator-debugging impact**:
- An operator who passes a Dataset ID by mistake sees "DEG doesn't exist" → spends time searching the DEG list for the missing ID, which is never going to appear because the ID was a Dataset all along.
- An operator whose DEG was emptied (last member soft-deleted or removed via the un-link API) sees "DEG doesn't exist" → assumes the DEG itself was deleted, which it wasn't.
- A third-party API consumer probing the endpoint cannot distinguish "give me a valid DEG ID" from "this DEG is empty, populate it first" — the contract is structurally underdetermined.

**Primary source citations**:
- `LineageServiceImpl.java:61-62` (the `.switchIfEmpty(Flux.error(new NotFoundException("Data entity group", dataEntityGroupId)))` chain)
- `ReactiveGroupEntityRelationRepositoryImpl.java:177-204` (the recursive CTE that returns empty for all three cases)
- `ReactiveGroupEntityRelationRepositoryImpl.java:182-184` (the inner subquery on DATA_ENTITY)
- (contrast) `getDataEntityDetails` neighbour sidecar — passes `.includeDeleted(true)` flag, distinguishing soft-deleted from never-existed at the contract layer

**Existing-ADR-or-implied-prescription**: none. The platform's general error-mapping pattern is `NotFoundException` for genuinely missing resources; the conflation here is a missed disambiguation.

**Proposed remedy**: Split the 404 conditions at the service layer:
1. Pre-check the entity class: before calling `getDEGEntitiesOddrns`, query `dataEntityRepository.existsByIdAndType(dataEntityGroupId, DATA_ENTITY_GROUP)` (or use the existing `includeDeleted` exists check). Raise `NotFoundException("Data entity group", id)` only when the entity does not exist; raise `BadRequestException("Entity {id} is not a Data Entity Group; it's a {type}")` when the entity exists but is the wrong type.
2. Distinguish empty-DEG from missing-DEG: after the membership-resolution returns empty, check whether the DEG exists at all; if yes, return `200 OK` with an empty `DataEntityGroupLineageList.items` (the natural empty response); if no, raise `NotFoundException`. This matches the design intent — an empty DEG with no members is a valid state, not an error.

The remedy is one extra DB round-trip (pre-check the entity class) plus a behavior change for case (3) (200 + empty items vs 404). Third-party consumers receiving 200 + `{items: []}` for empty DEGs may need to adapt, but the new contract is semantically correct.

**Severity rationale**: MEDIUM — operator-debugging UX gap; not a security or correctness issue at the data-layer. The fix is one extra DB round-trip + a minor contract change. The benefit is operator-debuggability + semantically-correct response shapes.

**Suggested backlog grouping**: `Error-mapping cleanup` — bundle with similar conflation findings (REFACTOR-208 series error-translation gaps).

---

## REFACTOR-338 — Soft-deleted DEG membership row blocks fresh ADD via PK collision → user sees "Data entity is already in this DEG" 400-error AFTER the user perceives the entity as removed; the soft-delete machinery + the upsert error-shape are inconsistent

**Severity**: MEDIUM
**Category**: ux-bug (misleading error message; soft-delete asymmetric visibility)
**Pillars affected**: [P-01-data-discovery, P-08-management-administration]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__addDataEntityDataEntityGroup.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "Soft-deleted membership + re-add produces misleading 'already in this DEG' error — the `group_entity_relations` PK is `(group_oddrn, data_entity_oddrn)` (`V0_0_21__add_data_entity_group_relation.sql:6`), NOT including `is_deleted` (added by `V0_0_79__data_deprecation.sql:14-15`). The soft-delete machinery (`softDeleteRelationsForDeletedDataEntities` at `ReactiveGroupEntityRelationRepositoryImpl.java:92-101`) flips `is_deleted=true` when the underlying data entity is deleted (e.g. via `STATUS=DELETED` cascade). The matching `restoreRelationsForDataEntities` (`:104-112`) is the only path to flip the bit back. After an entity is soft-deleted and later restored (status flips back to a non-DELETED state), the GROUP membership row remains soft-deleted; `getManuallyCreatedRelations` (filtered by `is_deleted=false` at `:127-137`) shows zero memberships for the entity. The user re-invokes `POST /api/dataentities/{id}/data_entity_group` to re-add membership, the INSERT collides with the PK, `onDuplicateKeyIgnore` returns an empty Flux, the service raises `BadUserRequestException(\"Data entity is already in this DEG\")` at `:402` — but from the user's perspective the entity is NOT visibly in the DEG. The error message is misleading"
- `odd-platform__java__DataEntityController__controller-method__addDataEntityDataEntityGroup.md:security.known_security_gaps.[3]` (LOW security-side framing; the higher-impact framing is the operator-trap)

**Description**: The `group_entity_relations` table was originally defined with composite PK `(group_oddrn, data_entity_oddrn)` per `V0_0_21__add_data_entity_group_relation.sql:6`. The migration `V0_0_79__data_deprecation.sql:14-15` later added an `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` column to support entity-deletion cascade soft-deletes — but did NOT include `is_deleted` in the PK. The result is an asymmetric soft-delete model:

- Soft-delete writes (`softDeleteRelationsForDeletedDataEntities` at `ReactiveGroupEntityRelationRepositoryImpl.java:92-101`) flip `is_deleted = TRUE` when the underlying data entity is deleted (e.g., via `STATUS = DELETED` cascade through `DataEntityInternalStateServiceImpl.softDeleteDataEntities`).
- Read-side filtering (`getManuallyCreatedRelations` at `:127-137`) applies `IS_DELETED.isFalse()` — the user sees zero memberships.
- Restore (`restoreRelationsForDataEntities` at `:104-112`) is the only path to flip the bit back to FALSE; it's called from the ingestion-driven entity-restore path.
- THIS endpoint (`addDataEntityToDEG`) does NOT call `restoreRelationsForDataEntities`. It uses `createRelationsReturning` with `.onDuplicateKeyIgnore()` (`:79-89`), which collides on the PK `(group_oddrn, data_entity_oddrn)` and returns empty.

The failure scenario:
1. User adds entity X to DEG Y → row `(Y.oddrn, X.oddrn, is_deleted=false)` exists.
2. Entity X status flips to DELETED → cascade soft-deletes the row → `(Y.oddrn, X.oddrn, is_deleted=true)`.
3. User restores entity X → entity's status flips back, BUT the `group_entity_relations` row stays `is_deleted=true` (the entity restore path does not call `restoreRelationsForDataEntities` for DEG memberships specifically — verify with cross-link investigation).
4. User sees X is NOT in DEG Y (the read query filters `is_deleted=false`).
5. User clicks 'Add to group' → POST `/api/dataentities/X/data_entity_group {data_entity_group_id: Y}` → INSERT collides with PK → `onDuplicateKeyIgnore` returns empty Flux → `BadUserRequestException("Data entity is already in this DEG")`.

The user-facing experience: "But I just SAW that X is not in Y. The error says it's already there. Where? How do I find it? Why can't I fix this?" The maintainer-side workaround (call `restoreRelationsForDataEntities`) is an admin-tool-only path not surfaced in the UI.

**Primary source citations**:
- `V0_0_21__add_data_entity_group_relation.sql:6` (PK without `is_deleted`)
- `V0_0_79__data_deprecation.sql:14-15` (the `is_deleted` column addition)
- `ReactiveGroupEntityRelationRepositoryImpl.java:79-89` (`onDuplicateKeyIgnore` on the plain PK collision)
- `ReactiveGroupEntityRelationRepositoryImpl.java:92-101` (soft-delete cascade)
- `ReactiveGroupEntityRelationRepositoryImpl.java:104-112` (`restoreRelationsForDataEntities` — the workaround path)
- `ReactiveGroupEntityRelationRepositoryImpl.java:127-137` (`getManuallyCreatedRelations` filters `is_deleted=false`)
- `DataEntityServiceImpl.java:402` (the misleading `BadUserRequestException`)
- absence of any `restoreRelationsForDataEntities` call in `DataEntityServiceImpl.addDataEntityToDEG`

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-068** (two-tier soft-delete inheritance taxonomy) — the soft-delete machinery is part of the platform's lifecycle architecture. **ADR-CANDIDATE-069** (edge tables HARD-DELETE by design) — `group_entity_relations` is an EDGE table and the maintainer's stated intent at `V0_0_76__term_relations_hard_delete.sql` (term-relations migration) was to convert edge-tables to HARD DELETE. But `group_entity_relations` retained the soft-delete model post-V0_0_79, creating the asymmetry this scope captures. The IMPLIED prescription is one of three options: (a) convert `group_entity_relations` to HARD DELETE like `data_entity_to_term` (consistency with ADR-CANDIDATE-069); (b) restructure the PK to include `is_deleted` so soft-deleted rows don't block re-adds; (c) make `addDataEntityToDEG` detect the soft-deleted-collision case and call `restoreRelationsForDataEntities` automatically.

**Proposed remedy**: Option (c) is the lowest-friction fix. At `DataEntityServiceImpl.addDataEntityToDEG`, detect the empty-Flux-on-conflict case and disambiguate by querying the soft-delete state:
```java
.switchIfEmpty(
    Mono.defer(() -> reactiveGroupEntityRelationRepository.existsSoftDeleted(groupOddrn, entityOddrn)
        .flatMap(softDeleted -> softDeleted
            ? reactiveGroupEntityRelationRepository.restoreRelationsForDataEntities(...).thenReturn(groupPojo)
            : Mono.error(new BadUserRequestException("Data entity is already in this DEG"))))
)
```
Companion: doc-side, the live groups-domains.md page should articulate the soft-delete-then-restore semantic. Option (a) (convert to HARD DELETE) is the architecturally cleaner fix but requires a migration that drops historical soft-deleted rows; option (b) (PK reshape) is a schema change with cascade implications across consuming queries; option (c) is in-code-only.

**Severity rationale**: MEDIUM — operator-trap UX bug; affects entity-deletion-then-restore workflows. Not HIGH because the trap surface is narrow (specifically the soft-delete-then-restore-then-re-add scenario) and operators recovering from it can call admin-tool paths. Cross-link with ADR-CANDIDATE-068 (soft-delete taxonomy), ADR-CANDIDATE-069 (HARD-DELETE on edge tables — the asymmetry this scope captures).

**Suggested backlog grouping**: `DEG-membership lifecycle sprint` (paired with REFACTOR-331 + REFACTOR-332 — the auth + audit + lifecycle trio).

---

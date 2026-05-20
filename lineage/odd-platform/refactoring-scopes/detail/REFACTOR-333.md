## REFACTOR-333 — `upsertDataEntityMetadataFieldValue` returns 200 OK with empty body on missing-pair / missing-entity (silent UPDATE-not-UPSERT) — UI claims success on writes that did not happen; STRENGTHENS batch-G `upsertDataEntityInternalDescription` pattern (now 2-sidecar)

**Severity**: MEDIUM
**Category**: silent-200-on-missing (cross-batch pattern; sibling to batch G upsertInternalDescription)
**Pillars affected**: [P-01-data-discovery, P-09-security-access-control]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "Silent 200-on-missing pair — when `(dataEntityId, metadataFieldId)` has no existing row in `metadata_field_value`, `ReactiveMetadataFieldValueRepositoryImpl.update` matches zero rows, the `Mono` collapses to empty, the FTS vector refresh and mapper are short-circuited, and the controller returns `200 OK` with an empty body rather than `404 Not Found`. The UI's redux thunk (`odd-platform-ui/src/redux/thunks/metadata.thunks.ts:51-54`) hardcodes a 'Metadata successfully updated.' success toast on any non-error response, so the user is told the write succeeded when no row was touched. Same pattern as `upsertDataEntityInternalDescription` (batch G)"
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "Silent 200-on-missing data entity — when `dataEntityId` does not exist (no `data_entity` row), the `metadataFieldService.get(metadataFieldId)` still returns the global field metadata, the UPDATE then matches zero rows in `metadata_field_value` ..., and the response is 200-with-empty-body. Unlike `createMetadata` (`DataEntityServiceImpl.java:257-258` does `reactiveDataEntityRepository.get(dataEntityId).switchIfEmpty(Mono.error(new NotFoundException))`), the upsert path NEVER validates the entity exists"

**Description**: `DataEntityController.upsertDataEntityMetadataFieldValue` (`DataEntityController.java:213-223`) is the `PUT /api/dataentities/{data_entity_id}/metadata/{metadata_field_id}` handler. The implementation is misnamed — the OpenAPI operationId is "upsertDataEntityMetadataFieldValue" but the repository call is a pure UPDATE: `DSL.update(METADATA_FIELD_VALUE).set(VALUE, ...).set(ACTIVE, pojo.getActive()).where(METADATA_FIELD_ID.eq(...).and(DATA_ENTITY_ID.eq(...))).returning()` at `ReactiveMetadataFieldValueRepositoryImpl.java:95-104`. If the `(dataEntityId, metadataFieldId)` pair has no existing row, the UPDATE matches zero rows, the `Mono` collapses to empty, the rest of the pipeline (search-vector refresh, mapper) is short-circuited via empty-mono propagation, and the controller returns `200 OK` with an EMPTY body — NOT 404. The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(...)))` at every layer (controller → service → repository).

Three semantically-distinct missing-cases all produce the same silent-200 response:
- (a) `dataEntityId` does not exist (no `data_entity` row) — unlike `createMetadata` which DOES check at `DataEntityServiceImpl.java:257-258`, the upsert path NEVER validates the entity exists.
- (b) `metadataFieldId` exists globally (the `metadata_field` table is platform-wide per ADR-CANDIDATE-NNN) but no `(dataEntityId, metadataFieldId)` pair exists in `metadata_field_value` (caller targets a field that was never `created` for this entity).
- (c) Both ids reference existing rows but the (entity, field) row has been deleted — same silent-200 outcome.

A NOTE on `metadataFieldId`: if the metadata-field row itself is missing, `MetadataFieldServiceImpl.get(metadataFieldId)` DOES throw `NotFoundException` (`MetadataFieldServiceImpl.java:31-33`) and the response is 404. So a non-existent FIELD id → 404, but a non-existent DATA-ENTITY id → 200-empty-body, AND a valid-but-unpaired (entity, field) → 200-empty-body. The asymmetry is itself a UX inconsistency that operators must reason about.

The UI consequence: the redux thunk at `odd-platform-ui/src/redux/thunks/metadata.thunks.ts:51-54` hardcodes a 'Metadata successfully updated.' success toast on ANY non-error response without inspecting whether the response body is populated. The user is told the write succeeded; on next page-render the field value is unchanged. Operators report this as a "silent failure" bug to the maintainer team.

This is the SAME PATTERN as `upsertDataEntityInternalDescription` (batch G — REFACTOR-NNN). Both methods are misnamed "upsert" but implement pure UPDATE with no entity-existence pre-check. The cross-batch pattern is: every PUT-shaped endpoint on `DataEntityController` that doesn't go through the explicit `reactiveDataEntityRepository.get(dataEntityId).switchIfEmpty(...)` pre-check pattern (as `createMetadata` and `createOwnership` do) shares this gap.

**Primary source citations**:
- `ReactiveMetadataFieldValueRepositoryImpl.java:95-104` (UPDATE-with-WHERE, no `switchIfEmpty`)
- `DataEntityServiceImpl.java:287-305` (no `reactiveDataEntityRepository.get` check, no `switchIfEmpty`)
- `DataEntityServiceImpl.java:257-258` (the CONTRASTING pattern — `createMetadata` DOES check)
- `metadata.thunks.ts:51-54` (UI hardcoded success toast on any non-error response)
- batch G `upsertDataEntityInternalDescription` sidecar (same pattern; this is the SECOND sidecar surfacing it)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-001** (controllers as delegates) — the controller is correctly thin; the gap is at the service layer. **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry) — the service-layer transaction boundary IS correct; the gap is the missing pre-check inside the transaction. The IMPLIED prescription is that every PUT-shaped endpoint that mutates a child relation should validate the parent entity exists before the WHERE-clause UPDATE no-ops.

**Proposed remedy**: Add a `reactiveDataEntityRepository.get(dataEntityId).switchIfEmpty(Mono.error(new NotFoundException("Data entity", dataEntityId)))` at the entry of `DataEntityServiceImpl.upsertMetadataFieldValue` (mirroring the pattern from `createMetadata` at line 257-258). Add a corresponding `switchIfEmpty(Mono.error(new NotFoundException("Metadata field value", dataEntityId + "/" + metadataFieldId)))` after the repository UPDATE to detect zero-row UPDATEs and surface 404. Companion: a `@WebFluxTest` regression that asserts (a) PUT against non-existent `dataEntityId` returns 404; (b) PUT against valid `dataEntityId` + valid `metadataFieldId` but no existing row returns 404; (c) PUT against valid pair returns 200 with payload. Apply the same fix to `upsertDataEntityInternalDescription` (batch G); the symmetric pattern means the fix shape is reusable across both endpoints.

**Severity rationale**: MEDIUM — UX bug ("I clicked save, the toast said success, the value didn't change") combined with audit-trail confusion (the activity log is also missing per REFACTOR-337 — operators have NO signal that the write didn't happen). Not HIGH because no data is corrupted; the user can re-create the metadata via the create endpoint after diagnosing the silent failure. Cross-batch with REFACTOR-NNN (batch G upsertInternalDescription same pattern); now 2-sidecar.

**Suggested backlog grouping**: `DataEntityController silent-200 cleanup sprint` (paired with batch G upsertInternalDescription). Companion `TEST-NNN — @WebFluxTest 404 regressions for upsert paths`.

---

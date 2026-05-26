# SHB-009 — Custom Metadata Value write drift (UPDATE-not-UPSERT silent 200, type validation absent, EXTERNAL overwrite, active=NULL regression, no activity event)

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators see a "metadata successfully updated" toast on the entity-detail Metadata panel that lies for at least five distinct failure modes because `PUT /api/dataentities/{id}/metadata/{field_id}` (`upsertDataEntityMetadataFieldValue`) is misnamed — the underlying repository call is a pure UPDATE-by-PK, not an UPSERT. (1) Non-existent `dataEntityId` → 200 with empty body. (2) Valid pair but no existing row → 200 with empty body. (3) Type mismatch (e.g. writing "not a number" to an INTEGER-typed field) → accepted verbatim. (4) EXTERNAL-origin field overwrite (collector-populated) → accepted, the override persists until next collector run. (5) `active=NULL` regression — every successful update writes `active=NULL` to the row because the impl's pojo never calls `.setActive(...)` and Postgres `DEFAULT TRUE` only applies on INSERT. (6) No `@ActivityLog` despite `CUSTOM_METADATA_UPDATED` being reserved in `ActivityEventTypeDto.java:18` — the activity feed has ZERO record of metadata updates. F-013 (Custom Metadata Field Editing) anchors the silent-UPDATE pattern; this thread enumerates the five additional drift facets F-013 does not capture.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104` — the UPDATE: `DSL.update(METADATA_FIELD_VALUE).set(VALUE, ...).set(ACTIVE, pojo.getActive()).where(METADATA_FIELD_ID.eq(...).and(DATA_ENTITY_ID.eq(...))).returning()`. Pure UPDATE; missing pair → 0 rows → `Mono.empty` → silent 200.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` — orchestration: `metadataFieldService.get` (throws NotFound for missing field) → `update` (silent for missing pair) → `updateMetadataVectors` (short-circuits on empty). The data-entity-existence check is ABSENT — contrast with `createMetadata` at lines 257-258 which DOES guard via `reactiveDataEntityRepository.get(...).switchIfEmpty(NotFoundException(...))`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295` — the pojo construction: only `setValue(...)`, `setMetadataFieldId(...)`, `setDataEntityId(...)` — never `.setActive(true)`. `getActive()` is `null` (boxed Boolean), so the UPDATE writes NULL into a `boolean DEFAULT TRUE` column — the DEFAULT only applies on INSERT.
- `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:175-186` — `metadata_field_value (data_entity_id, metadata_field_id, value text, active boolean DEFAULT TRUE)` composite PK.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/activity/ActivityEventTypeDto.java:18` — the `CUSTOM_METADATA_UPDATED` enum value exists but is NEVER emitted. `upsertMetadataFieldValue` has no `@ActivityLog` annotation. The slot is reserved-but-never-fired.
- `odd-platform-ui/src/redux/thunks/metadata.thunks.ts:33-56` — the UI toast: `"Metadata successfully updated."` on any 200 response without inspecting body emptiness. UI claims success on writes that didn't happen.
- `odd-platform-specification/components.yaml:2077-2086` — the `MetadataFieldType` enum (8 values) is OpenAPI documentation-only; nothing reads or enforces it at write time.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207` — auth IS enforced: `DATA_ENTITY_CUSTOM_METADATA_UPDATE` permission gate. NOT a permission-bypass thread; this is a SEMANTIC-CORRECTNESS thread.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md` (full sidecar; six findings enumerated).

## Notes

- **F-013 anchors the F-NNN-level pattern**; this thread extends it with the five specific drift facets the F-013 narrative may not enumerate at file:line resolution.
- **The activity-feed lie is the most operationally-damaging finding**: `CUSTOM_METADATA_UPDATED` is reserved as an enum value (suggesting someone planned to emit it) but no service method carries the annotation. An auditor inspecting "who changed cost_centre to $1.2M last Thursday" finds NOTHING in the activity feed. The audit trail is silently incomplete.
- **EXTERNAL overwrite is the most security-sensitive**: a user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` (typically granted to entity owners) can overwrite a `cost_centre` field that the collector populated. The override persists until the next collector run, at which point it's silently replaced. No audit signal warns the operator that their edit was reverted.
- **`active=NULL` regression depends on downstream consumers**: queries that filter `WHERE metadata_field_value.active = TRUE` will silently drop edited rows. Queries that use `IS DISTINCT FROM FALSE` are safe. Needs a sweep of consumers (`grep "metadata_field_value.active" odd-platform-api/`).
- **Type-mismatch is the silent-truncation flavour** of LSN-001-style defaults: the OpenAPI enum is published as the type contract; the implementation treats it as documentation. A user setting `value="abc"` on an INTEGER field gets `200 OK` and the value persists; a downstream consumer reading the value as `Long.parseLong(...)` crashes.
- **The silent-200 pattern matches F-004 (description) exactly**: `upsertDescription` and `upsertDataEntityMetadataFieldValue` use the same UPDATE-not-UPSERT pattern; both swallow the 0-rows case as `Mono.empty` and return 200. Both have explicit `switchIfEmpty(Mono.error(NotFoundException))` AVAILABLE but NOT WIRED. The two together suggest a "we'll add the guard later" technical debt across the service tier; SHB-NNN cluster candidate.
- **Cross-cutting with F-013** (Custom Metadata Field Editing) and F-038 (Data Collaboration if its description path shares this pattern). The pattern is "UPDATE-shaped reactive write returns 200 on no-op silently."

## Next

1. **REFACTOR-NNN — HIGH** — fix `upsertDataEntityMetadataFieldValue` to call `reactiveDataEntityRepository.get(dataEntityId).switchIfEmpty(Mono.error(new NotFoundException("Data entity", dataEntityId)))` before the metadata-field lookup. Mirror `createMetadata`'s shape at lines 257-258.
2. **REFACTOR-NNN — HIGH** — emit `CUSTOM_METADATA_UPDATED` activity event. Add `@ActivityLog(event = CUSTOM_METADATA_UPDATED)` + `@ActivityParameter(...)` to `upsertMetadataFieldValue`; write the handler that captures old + new value.
3. **REFACTOR-NNN — HIGH** — type validation: the OpenAPI `MetadataFieldType` enum should be enforced at write time. `MetadataFieldServiceImpl.get(metadataFieldId)` returns the type; the service should coerce/validate `formData.getValue()` against it (raise `BadUserRequestException` on mismatch).
4. **REFACTOR-NNN — MEDIUM** — `active=NULL` regression: explicitly set `.setActive(true)` on the pojo in `DataEntityServiceImpl.java:292-295`.
5. **REFACTOR-NNN — MEDIUM** — EXTERNAL-origin overwrite: should `upsertMetadataFieldValue` reject writes to EXTERNAL-origin fields? Decision pending — there is a legitimate use-case (operator override of ingested value) but the lack of activity event makes silent overrides dangerous. Recommend: ALLOW the write, but mark the row with an `override_by_user` flag and emit a distinct activity event.
6. **TEST-NNN — HIGH** — add WebTestClient tests for the five missing scenarios. The existing `DataEntityServiceTest.upsertMetadataFieldValueTest` is a happy-path mock-only test; none of the five drift facets are exercised.
7. **Cluster** with F-013 and F-004 (which is the description-side sibling of the silent-UPDATE-not-UPSERT pattern).

## Links

- cluster_with: [F-013, F-004]
- merged_into: (open)
- supersedes: []

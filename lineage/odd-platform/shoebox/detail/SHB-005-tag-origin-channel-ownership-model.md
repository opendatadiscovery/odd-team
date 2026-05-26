# SHB-005 — Tag Origin Channel Ownership (Collector-vs-UI ownership boundary)

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators see a "tags I assigned via the UI cannot be modified once a Collector also assigned them" enforcement because the platform implements a **three-channel ownership model** on tag↔target relations: `INTERNAL` (UI-set) is read-write to UI/API users, `EXTERNAL` (collector-set on `tag_to_data_entity`) and `EXTERNAL_STATISTICS` (dataset-statistics ingestion on `tag_to_dataset_field`) are read-only to UI/API users and are preserved across every UI-driven replace-all. The guard is enforced asymmetrically across three surfaces (tag-directory update/delete uses a boolean `external` aggregate; per-entity tag update uses `!external` filter; per-dataset-field tag update uses `origin = 'INTERNAL'` discriminator), and F-018 (Manual Object Tagging) names the side-channel-mint problem but does NOT name the channel-ownership model itself, which is the user-observable behaviour.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:49-50` — `update` guard: `BadUserRequestException("Can't update tag which has external relations")` if `tagDto.external()` aggregate is true. Tag-directory mutation is blocked if any data-entity relation is EXTERNAL.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:62-63` — `delete` guard with same shape: `BadUserRequestException("Can't delete tag which has external relations")`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:102` — `updateRelationsWithDataEntity` filters `currentRelations` to `!external` BEFORE computing the diff. EXTERNAL rows are protected.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:109` — new relations are hardcoded `setExternal(false)`. UI cannot impersonate Collector.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:289-295` — `deleteDatasetFieldInternalRelations` filters DELETE on `TAG_TO_DATASET_FIELD.ORIGIN.eq(TagOrigin.INTERNAL.toString())`. Replace-all-tags only touches the channel it owns.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/TagOrigin.java:3-7` — the three-member enum (`INTERNAL`, `EXTERNAL`, `EXTERNAL_STATISTICS`) encodes the multi-channel ownership model at the relation level.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:191-231` — `updateFieldsTags` is the EXTERNAL_STATISTICS channel writer, called from ingestion's dataset-statistics path.
- `odd-platform-api/src/main/resources/db/migration/V0_0_82__add_tag_to_dataset_field.sql:12` — schema-level: `origin varchar NOT NULL DEFAULT 'INTERNAL'`.

## Notes

- **F-018 anchors the directory side-door** (TermService / DataEntityService / DatasetFieldService / Collector all mint tag rows without `TAG_CREATE`). This thread anchors a DIFFERENT facet — the **per-relation ownership channel** that determines who can mutate what. The two are complementary; the side-door is about who creates the directory entry, this is about who owns the assignment.
- **Asymmetry in the guard shape** is worth noting: the data-entity side uses a boolean `external` column (`tag_to_data_entity.external`), the dataset-field side uses a `TagOrigin` enum with three values (`tag_to_dataset_field.origin`). A tag with INTERNAL data-entity relations + EXTERNAL dataset-field relations would NOT be blocked by `TagServiceImpl.update`'s guard (which reads only `tagDto.external()` — the data-entity aggregate). Operator-visible: tag-directory edits can succeed when one of the two channels has external relations.
- **The `delete` cascade is asymmetric** (cross-link `TagServiceImpl.md:bugs_limitations_corner_cases[3]`): `tag_to_term` and `tag_to_data_entity` rows are hard-deleted concurrently; `tag_to_dataset_field` rows are NOT touched. Operators deleting a tag attached to dataset fields leave orphan `tag_to_dataset_field` rows referencing a soft-deleted tag id. The orphans are invisible to UI reads (the listDatasetFieldDtos join applies `addSoftDeleteFilter`) but persist in DB indefinitely.
- **The case-sensitivity drift** (cross-link `TagServiceImpl.md:bugs_limitations_corner_cases[2]`): `divideTagsByExistence` uses `TAG.NAME.in(names)` (case-SENSITIVE) but the UI tag-search facet uses `containsIgnoreCase`. Search finds `Postgres`, user submits `postgres`, system mints a SECOND `postgres` tag — operators see two near-identical tags in the popular list.
- **Operator-facing scenarios this thread captures**:
  - User assigns "PII" via the UI; later, the dbt/Great Expectations collector tags the same entity with "PII" as EXTERNAL. The user's INTERNAL row remains, the EXTERNAL row joins, and the tag's `external()` aggregate is now true → the user can no longer UPDATE or DELETE the "PII" tag from the directory.
  - User opens dataset-field tags panel, sees both ingested-statistics tags (e.g. "cardinality:high") and manually-added tags; submits `tags: ['my-custom']` → INTERNAL rows are replaced with `['my-custom']`, EXTERNAL_STATISTICS rows survive. The display merges both, the operator sees `['my-custom', 'cardinality:high']`.

## Next

1. **Graduate** to `F-NNN — Tag Origin Channel Ownership` (P-01 Data Discovery / Annotation). Primary subjects: `TagServiceImpl.update/delete/updateRelationsWithDataEntity`, `ReactiveTagRepositoryImpl.deleteDatasetFieldInternalRelations`, `TagOrigin` enum, `tag_to_data_entity.external` column, `tag_to_dataset_field.origin` column.
2. **Cluster** with F-018 (Manual Object Tagging — the directory side-door) — they describe complementary facets of the same broader "Manual + Collector Tagging" feature; the feature-flow-builder may merge them into a larger F-018-extended.
3. **DOC-NNN** — the live `/active-platform-features/manual-object-tagging` page (status TBD; not yet fetched) should describe the EXTERNAL vs INTERNAL ownership model so operators understand why some tags refuse update / delete from the UI.
4. **REFACTOR-NNN — MEDIUM** — the asymmetry between boolean `external` and `TagOrigin` enum is technical debt; unifying on the enum would let `TagServiceImpl.update` guard against EXTERNAL relations on EITHER channel (currently it only sees the data-entity aggregate).
5. **REFACTOR-NNN — MEDIUM** — `tag_to_dataset_field` rows survive tag delete (asymmetric cascade); orphan-reaper job needed or `deleteDatasetFieldRelations` should be added to `TagServiceImpl.delete`'s `Flux.zip`.
6. **Case-sensitivity fix** — `listByNames` should use `lower()` comparison; partial unique index `tag_name_unique` should be on `lower(name)` rather than `name` to prevent the `Postgres`/`postgres` duplicate.

## Links

- cluster_with: [F-018]
- merged_into: (open)
- supersedes: []

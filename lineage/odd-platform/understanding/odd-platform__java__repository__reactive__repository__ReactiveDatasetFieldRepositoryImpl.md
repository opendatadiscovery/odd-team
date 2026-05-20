---
node_id: "odd-platform java repository reactive repository:ReactiveDatasetFieldRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-R-ReactiveDatasetFieldRepositoryImpl
---

# ReactiveDatasetFieldRepositoryImpl — semantic understanding

## understanding

`ReactiveDatasetFieldRepositoryImpl` is the **per-column metadata persistence layer** — 214 lines, 6 domain-specific public methods plus the 11 inherited CRUD methods from `ReactiveAbstractCRUDRepository<DatasetFieldRecord, DatasetFieldPojo>`. The class does NOT manage dataset_field lifecycle on its own — that role belongs to `DatasetFieldServiceImpl.createOrUpdateDatasetFields` (`DatasetFieldServiceImpl.java:134-156`) which delegates the row-shape decision (CREATE-new-version vs UPDATE-in-place) to the **dataset-structure-hash-derived diff** (`DatasetFieldServiceImpl.java:375-396`) before invoking this repository's `bulkCreate` / `bulkUpdate` inherited from the parent class. The DDL design is unusual and load-bearing: `V0_0_9__normalize_dataset_structure.sql` (lines 1-43) **DROPPED the `dataset_version_id` foreign key** from `dataset_field` and introduced a M:N join table `dataset_structure (dataset_version_id, dataset_field_id)` — this is the architectural decision the file's read shapes encode. `getLastVersionDatasetFieldsByOddrns` (lines 92-113) therefore needs a window-function CTE (`MAX(version) OVER (PARTITION BY oddrn)`) to find "the version row that belongs to the most recent dataset_version for each oddrn". A dataset_field row is **shared by every dataset_version that contains it** — when ingestion mutates a column's type/name/order, a new dataset_field row is created and a new dataset_structure row links it to the new dataset_version, but the OLD dataset_field row REMAINS and is still pointed at by the old dataset_version. There is NO cascade delete, NO soft-delete column (no `deleted_at`, no `is_deleted`, no STATUS — confirmed by `V0_0_1__init.sql:148-164` plus a sweep of every `ALTER TABLE dataset_field` migration), and NO orphan-cleanup job. The five domain-specific methods divide into: (a) two **user-edit writes** — `updateDescription` (lines 72-80), `updateInternalName` (lines 82-90) — both bare `DSL.update(...).where(ID.eq(?)).returning()` with empty→null normalisation; (b) one **batch read for ingestion** — `getLastVersionDatasetFieldsByOddrns` (lines 92-113) — chained from `DatasetFieldMetadataIngestionServiceImpl.ingestMetadata` (line 47) and `DatasetFieldServiceImpl.createOrUpdateDatasetFields` (line 141), partitioned at 1000-element batches by `JooqReactiveOperations.executeInPartitionReturning` (`JooqReactiveOperations.java:69-84`, BATCH_SIZE = 1000 line 24); (c) one **authorization helper** — `getDataEntityIdByDatasetFieldId` (lines 115-125) — invoked exclusively by `DatasetFieldResourceExtractor.extractResourceId` (line 26) to resolve a `datasetFieldId` path variable to its parent `data_entity.id` for permission checks; (d) one **detail read** — `getDatasetFieldWithTags` (lines 127-139) — returns a field plus its non-soft-deleted Tag set (`TAG.DELETED_AT.isNull()` line 133); (e) one **term-listing read** — `listByTerm` (lines 141-204) — the catalog-wide cross-owner enumeration that returns every dataset_field associated with a given term, fanned out across all data entities the field appears in. The class has **NO transactional annotation**, NO authorization filter at JOIN time, NO owner / namespace predicate, and NO `EXCLUDE_FROM_SEARCH` / status filter on the parent data_entity in `listByTerm`. Authorization lives upstream at `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:282-303`) which gates `/api/datasetfields/{dataset_field_id}/...` paths via `DatasetFieldResourceExtractor` → parent DataEntity → permission map. Reads bypass owner-scoping entirely (read-collaborative posture — same as `ReactiveDataEntityRepositoryImpl`, see `repository_reactive__repository__ReactiveDataEntityRepositoryImpl.md` invariant 6).

## concepts

- entities: [
    "`DatasetFieldPojo` (the jOOQ-generated POJO mapping `dataset_field` table rows — column metadata: `id`, `oddrn`, `name`, `parent_field_oddrn`, `field_order`, `type` (JSONB), `stats` (JSONB), `is_key`, `is_value`, `is_primary_key`, `is_sort_key`, `external_description`, `internal_description`, `internal_name`, `reference_oddrn`, `default_value` — assembled from `V0_0_1__init.sql:148-164` + `V0_0_46__primary_and_sort_key_for_dataset_field.sql:1-3` + `V0_0_66__add_dataset_field_default_value.sql:1-2` + `V0_0_72__dataset_field_reference_type.sql:1-2` + `V0_0_81__dataset_field_internal_name.sql:1-2`)",
    "`DatasetFieldWithTagsDto` (`getDatasetFieldWithTags` return — pojo + Set<TagPojo> for non-soft-deleted tags)",
    "`DatasetFieldTermsDto` (`listByTerm` return — pojo + parent DataEntity + DataSource + Namespace + aggregated owners/titles/ownership — assembled via the CTE join chain lines 169-189 and `DatasetFieldTermsDtoMapper::mapRecordToDto` line 203)",
    "`DATASET_FIELD` (the jOOQ table reference — points at the `dataset_field` PG table; NO `deleted_at` / `is_deleted` / `STATUS` column — see invariant 4)",
    "`DATASET_STRUCTURE` (the M:N join table linking dataset_version to dataset_field — `V0_0_9__normalize_dataset_structure.sql:1-16`, PK `(dataset_version_id, dataset_field_id)`)",
    "`DATASET_VERSION` (parent table — each version's fields enumerated via DATASET_STRUCTURE)",
    "`DATASET_FIELD_TO_TERM` (M:N — fields linked to glossary terms; the `listByTerm` join target line 188-189)",
    "`TAG_TO_DATASET_FIELD` (M:N — fields linked to tags; `getDatasetFieldWithTags` join line 132-133)",
    "`DATA_ENTITY` (parent dataset's row — `listByTerm` joins via the latest-version's `DATASET_VERSION.DATASET_ODDRN` line 170-180; `getDataEntityIdByDatasetFieldId` follows the same chain line 117-122)"
  ]
- operations: [
    "`upsert-by-oddrn-with-version-fork` — `bulkCreate` / `bulkUpdate` (inherited; called by `DatasetFieldServiceImpl.createOrUpdateDatasetFields` line 149-153 AFTER the hash-diff partitions fields into `pojosToCreate` (new dataset_field rows) and `pojosToUpdate` (in-place edit when the structure-hash matches)). The `createOrUpdate` semantics are NOT a single SQL UPSERT — they are CALLER-controlled: a hash collision means UPDATE the existing row's id; a hash miss means INSERT a new row that the caller then links into a NEW dataset_structure entry (preserving the old dataset_field row for historical dataset_versions).",
    "`latest-version-read-by-oddrns` — `getLastVersionDatasetFieldsByOddrns` (lines 92-113) — for each oddrn, return the dataset_field row whose linked dataset_version has the maximum version number; partitioned at 1000 oddrns per batch.",
    "`user-edit-internal-description` — `updateDescription` (lines 72-80) — bare update; empty/null string → NULL; verbatim storage (no Jsoup / Encode / length cap, like `ReactiveDataEntityRepositoryImpl.setInternalDescription`).",
    "`user-edit-internal-name` — `updateInternalName` (lines 82-90) — bare update; empty/null string → NULL; verbatim storage.",
    "`resolve-parent-dataentity-for-auth` — `getDataEntityIdByDatasetFieldId` (lines 115-125) — single-row SELECT walking dataset_field → dataset_structure → dataset_version → data_entity by oddrn match. Used by `DatasetFieldResourceExtractor` for permission scoping.",
    "`detail-with-tags-read` — `getDatasetFieldWithTags` (lines 127-139) — single field + Set<TagPojo> filtered by `TAG.DELETED_AT.isNull()`.",
    "`cross-owner-list-by-term` — `listByTerm` (lines 141-204) — given a term id + optional name-substring filter + page/size, returns every dataset_field linked to the term across all data entities. NO owner-scoping. NO `EXCLUDE_FROM_SEARCH` / status filter on parent data_entity.",
    "`inherited-CRUD` — `get` / `list` / `create` / `update` / `delete(id|ids)` / `bulkCreate` / `bulkUpdate` (parent class `ReactiveAbstractCRUDRepository` lines 69-156)."
  ]
- invariants: [
    "**dataset_field has NO native soft-delete column.** Verified by `V0_0_1__init.sql:148-164` defining the schema (id, dataset_version_id [later dropped], name, oddrn, parent_field_oddrn, field_order, stats, type, is_key, is_value, external_description, internal_description) and every subsequent `ALTER TABLE dataset_field` migration adding only `internal_name` / `reference_oddrn` / `default_value` / `is_primary_key` / `is_sort_key` — none adds `deleted_at` or `is_deleted` or `status`. `delete(id)` / `delete(ids)` inherited from `ReactiveAbstractCRUDRepository.java:144-155` issue HARD DELETE (`DSL.deleteFrom(recordTable).where(idCondition).returning()`). The repository contains NO `addSoftDeleteFilter` override (unlike `ReactiveDataEntityRepositoryImpl` line 109-123).",
    "**Version-aware identity: a dataset_field row is SHARED across every dataset_version that contains it.** `V0_0_9__normalize_dataset_structure.sql:1-16` introduced the M:N `dataset_structure` table AND `V0_0_9__normalize_dataset_structure.sql:40-43` DROPPED `dataset_field.dataset_version_id` FK + column. A column's evolution is recorded NOT by mutating one dataset_field row across versions but by creating NEW dataset_field rows when the structure-hash diverges (`DatasetFieldServiceImpl.java:385-394` partitions on `newVersionHash.equals(existingVersionHash)`).",
    "**Hash-diff partition: identical hash → UPDATE in place; differing hash → INSERT new row.** `DatasetFieldServiceImpl.java:385-394` builds the partition. When `newVersionHash.equals(existingVersionHash)`, the field goes into `fieldsToUpdate` and the existing row's id is reused (line 390); when not equal, the field goes into `fieldsToCreate` as a NEW row (line 392) — and `copyRelationsForNewDatasetFields` (line 324-335) copies INTERNAL tags + INTERNAL enum values from the old row to the new (operator-curated metadata follows the column forward).",
    "**Internal-name / internal-description are CALLER-curated, not ingestion-curated.** `DatasetFieldServiceImpl.getDatasetFieldUpdatedCopy` lines 308-322 explicitly RESTORES `internalDescription` and `internalName` from `lastExistingVersion` onto every new-or-updated copy. Ingestion does not touch these fields. Only the controller-edit paths `updateDescription` (line 72-80) / `updateInternalName` (line 82-90) write them.",
    "**`getLastVersionDatasetFieldsByOddrns` uses a window-function CTE** (lines 99-110: `MAX(DATASET_VERSION.VERSION).OVER(PARTITION BY DATASET_FIELD.ODDRN).AS(maxVersion)`). The `WHERE version = max_version` filter (line 110) picks the most recent dataset_version row each oddrn appears in. With 1000-oddrn batches via `executeInPartitionReturning` (line 94), the same oddrn appearing twice across batches would receive TWO separate CTE evaluations — but in practice the upstream caller (`DatasetFieldMetadataIngestionServiceImpl.getDatasetFieldPojoOddrns` line 103-109) collects oddrns from one ingestion request whose payload should not duplicate the same field oddrn.",
    "**No owner / tenant / namespace scoping on `listByTerm`.** Lines 169-189 join DATASET_FIELD → DATA_ENTITY → NAMESPACE / DATA_SOURCE / OWNERSHIP / OWNER / TITLE but apply NO filter on the parent DataEntity's `status` / `hollow` / `exclude_from_search` / `data_source_id`. A caller can enumerate every column of every dataset linked to a term across all data sources, including soft-deleted parent DataEntities (since the join is unfiltered).",
    "**Authorization is parent-scoped via `DatasetFieldResourceExtractor`** (lines 21-27 of that class). The extractor resolves `dataset_field_id` → parent `data_entity_id` via `getDataEntityIdByDatasetFieldId` (this repo line 115-125), then permission rules apply to the parent DataEntity. There is NO field-level permission — every field of a DataEntity has the same permissions as the parent.",
    "**`getDatasetFieldWithTags` excludes soft-deleted Tags but not the field itself.** Line 133: `TAG.DELETED_AT.isNull()` filters out tags whose owning Tag row has been soft-deleted. The dataset_field row itself is returned regardless of any deletion state on the parent DataEntity or DATASET_VERSION (and again, dataset_field has no own soft-delete column).",
    "**`listByTerm` materialises the inner CTE** via `DSL.with(DATASET_FIELD_CTE_NAME).asMaterialized(records)` line 191-192 — a Postgres planner hint forcing the inner select to materialise rather than inline. This is a performance choice for cases where the outer joins would otherwise re-evaluate the inner filter per row.",
    "**`updateDescription` / `updateInternalName` are NOT @ActivityLog-annotated at the repository layer** (lines 72-90) — activity-log emission happens one layer up at `DatasetFieldServiceImpl.updateInternalName` (line 98-99) via `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_INTERNAL_NAME_UPDATED)`. `updateDescription` at the service layer (line 86-95) has NO `@ActivityLog` — see `bugs_limitations_corner_cases`."
  ]
- audiences: [
    "`DatasetFieldServiceImpl` (the dominant caller — invokes `bulkCreate` / `bulkUpdate` via the CRUD parent on every ingestion-driven structure change; invokes `updateInternalName` / `getLastVersionDatasetFieldsByOddrns` directly; orchestrates `@ReactiveTransactional` boundary)",
    "`DatasetFieldMetadataIngestionServiceImpl` (caller of `getLastVersionDatasetFieldsByOddrns` line 47 — fetching the per-field POJO map BEFORE writing metadata-value rows linked to those field ids)",
    "`DatasetFieldResourceExtractor` (caller of `getDataEntityIdByDatasetFieldId` line 26 — the authorization layer's parent-dataentity resolver)",
    "`DatasetFieldInformationUpdatedActivityHandler` (caller of `getDatasetFieldWithTags` line 36 + `getDataEntityIdByDatasetFieldId` line 37 — activity-log state assembly for DESCRIPTION_UPDATED / TAGS_UPDATED / INTERNAL_NAME_UPDATED events)",
    "`DatasetFieldInternalInformationServiceImpl` (caller of `updateDescription` — wraps the description-edit + term-reextraction flow per `DatasetFieldServiceImpl.updateDescription` line 87-95)",
    "operators-via-API — indirectly via `DataSetFieldApiController` (PUT /api/datasetfields/{id}/name|description|tags|terms|enum_values + POST /api/datasetfields/{id}/terms + DELETE /api/datasetfields/{id}/terms/{termId} — all gated by SECURITY_RULES `SecurityConstants.java:282-303`)"
  ]

## dependencies_semantic

- requires-feature: [
    "`JooqReactiveOperations` — the reactive jOOQ wrapper; provides `mono(query)` / `flux(query)` / `executeInPartitionReturning(entities, mapper)` (BATCH_SIZE = 1000) (`JooqReactiveOperations.java:24,51,69`)",
    "`JooqQueryHelper` — used in `listByTerm` line 178, 189, 198 for `getField(cte, column)` projection through CTE-aliased tables",
    "`JooqRecordHelper` — `extractAggRelation(record, alias, class)` for JSON-array agg unwrapping in `mapRecordToDatasetFieldWithTags` line 209-210",
    "`DatasetFieldTermsDtoMapper` — record → DTO mapper for `listByTerm` return; line 203",
    "**Parent class `ReactiveAbstractCRUDRepository<DatasetFieldRecord, DatasetFieldPojo>`** — provides `get` / `list` / `create` / `update` / `bulkCreate` / `bulkUpdate` / `delete(id|ids)` / `paginate` / `recordToPojo` / `pojoToRecord` / `idCondition` / `nameField` / `idField`. Constructor wires `DATASET_FIELD` + `DatasetFieldPojo.class` (line 67). The parent's `bulkCreate` / `bulkUpdate` are `@ReactiveTransactional` (parent lines 113, 129), so the bulk methods carry a transaction even when invoked through this subclass."
  ]
- requires-config: [] — N/A. The class reads no config keys; no `@Value`, no `@ConditionalOnProperty`. Behaviour is fixed at compile time. The 1000-row batch ceiling comes from `JooqReactiveOperations.BATCH_SIZE` constant (`JooqReactiveOperations.java:24`), not from a tunable.
- requires-runtime: [
    "Spring WebFlux + reactor (`Mono` / `Flux` signatures throughout)",
    "jOOQ + R2DBC reactive Postgres bindings (every query is `jooqReactiveOperations.mono(query)` / `.flux(query)`)",
    "PostgreSQL — `dataset_field` table (PK bigserial, columns per `V0_0_1__init.sql:148-164` + subsequent migrations) + `dataset_structure` M:N table (`V0_0_9__normalize_dataset_structure.sql:1-16`) + `dataset_version` (one-to-many with dataset_structure) + `data_entity` (joined via DATASET_VERSION.DATASET_ODDRN = DATA_ENTITY.ODDRN). Plus the FK structure `dataset_field_to_term` (`V0_0_74__dataset_field_terms.sql:1-10`), `tag_to_dataset_field` (`V0_0_82__add_tag_to_dataset_field.sql`), `dataset_field_metadata_value` (`V0_0_66__add_dataset_field_default_value.sql:4-14`), `enum_value` (`V0_0_25__add_dataset_field_enum_values.sql`)."
  ]
- coupling: [
    "**Parent class `ReactiveAbstractCRUDRepository`** — every CRUD operation flows through the parent's `executeInPartitionReturning` path (`ReactiveAbstractCRUDRepository.java:175-185`). Bulk operations are 1000-row partitioned via `JooqReactiveOperations`. A change to the parent's bulk semantics (failOnDuplicateKey toggle, transactional boundary) silently changes this subclass's behaviour.",
    "**`DatasetFieldServiceImpl`** — the dominant caller. The hash-diff partition (`DatasetFieldServiceImpl.java:375-396`) IS the upsert-vs-version-fork decision; this repository sees only the resulting `pojosToCreate` and `pojosToUpdate` lists. A change to the hash logic (`DatasetVersionHashCalculator.calculateStructureHashFromPojos`) silently shifts how often a column edit creates a NEW row vs UPDATES the existing one — which in turn shifts the orphan-row growth rate.",
    "**`DatasetFieldResourceExtractor`** — the ONLY mechanism enforcing authorization for `/api/datasetfields/...` paths. `getDataEntityIdByDatasetFieldId` (line 115-125) returns `Mono.empty()` for unknown ids (its underlying `mono(query)` completes empty), and `DatasetFieldResourceExtractor.extractResourceId` (line 21-27) does NOT `.switchIfEmpty(error)` — an unknown id propagates as empty into the authorization chain (`ReactiveAuthorizationManagerFactory` for handling), where it ultimately denies the request. There is no `NotFoundException` thrown at this layer.",
    "**`ReactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors(datasetFieldId)`** (`ReactiveSearchEntrypointRepositoryImpl.java:475-490`+) — the FTS write-side. After every internal-name / tags edit on a dataset_field, `DatasetFieldServiceImpl.updateInternalName` (line 113) and `updateDatasetFieldTags` (line 127) call this to rebuild the search vector for the parent DataEntity. THIS REPOSITORY does NOT auto-refresh the search vector; the contract is delegated to callers. A new write method that forgets this step would silently desynchronise the search index.",
    "**`DatasetVersionHashCalculator`** — although not directly imported by this file, the structure-hash IS the discriminator that decides whether `bulkCreate` or `bulkUpdate` is called on a given oddrn. The hash factors are `name`, `type`, `is_key`, `is_value`, `is_primary_key`, `is_sort_key`, `external_description` (per `DatasetVersionHashCalculator.java`) — meaning that a rename (`name` change), type change, or PK/sort-key flag flip will create a NEW dataset_field row; a stats-only update will reuse the existing row.",
    "**Activity-log emission** — `DatasetFieldServiceImpl.updateInternalName` line 99 carries `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_INTERNAL_NAME_UPDATED)`; `updateDatasetFieldTags` line 119 carries `DATASET_FIELD_TAGS_UPDATED`. The activity row is emitted via the AOP aspect, captured by `DatasetFieldInformationUpdatedActivityHandler` (lines 22-69) which then calls this repo's `getDatasetFieldWithTags` and `getDataEntityIdByDatasetFieldId` to assemble the old-state / new-state JSON. `DatasetFieldServiceImpl.updateDescription` lines 87-95 has NO `@ActivityLog` annotation — description edits are NOT recorded in the activity feed (see `bugs_limitations_corner_cases`)."
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "`getDatasetFieldWithTags` returns a populated DTO for a known field id (`ReactiveDatasetFieldRepositoryImplTest.testGetDatasetFieldWithTags` lines 39-56 — uses `bulkCreate` to seed a single field, then asserts the returned pojo fields match)",
    "`updateDescription` writes the new description and preserves the existing external description (`ReactiveDatasetFieldRepositoryImplTest.testUpdateDescription` lines 58-76)"
  ]
- uncovered_behaviours: [
    "{behaviour: 'getDatasetFieldWithTags filters out soft-deleted Tags via TAG.DELETED_AT IS NULL', test_class: 'integration'} — the test at line 39-56 seeds tags via EasyRandom without setting DELETED_AT, so the filter line 133 is not exercised",
    "{behaviour: 'updateDescription stores Markdown / HTML verbatim — no backend sanitisation', test_class: 'security'} — F-004 fingerprint at the dataset_field surface unverified (the test asserts equality, not safety)",
    "{behaviour: 'updateDescription empty-string normalises to NULL (line 75)', test_class: 'unit'} — uncovered; the test seeds a populated description",
    "{behaviour: 'updateInternalName empty-string normalises to NULL (line 85)', test_class: 'unit'} — no test for updateInternalName at all",
    "{behaviour: 'updateInternalName / updateDescription return Mono.empty when id does not exist (no NotFoundException at repo layer)', test_class: 'unit'} — the silent-no-op-vs-404 contract unverified",
    "{behaviour: 'getLastVersionDatasetFieldsByOddrns returns the row from the MAX(version) dataset_version per oddrn', test_class: 'integration'} — window-function CTE correctness unverified",
    "{behaviour: 'getLastVersionDatasetFieldsByOddrns partitions oddrns at 1000-element batches via executeInPartitionReturning', test_class: 'integration'} — the 1001-oddrn case unverified; a regression to the partition logic would not be caught",
    "{behaviour: 'getDataEntityIdByDatasetFieldId returns Mono.empty for unknown id (does not throw)', test_class: 'integration'} — the unknown-id contract unverified; DatasetFieldResourceExtractor relies on it",
    "{behaviour: 'listByTerm enumerates dataset_fields across ALL data entities regardless of soft-delete / hollow / exclude_from_search state on the parent', test_class: 'integration'} — the cross-owner read-collaborative invariant unverified",
    "{behaviour: 'listByTerm name-substring filter applies containsIgnoreCase against DATASET_FIELD.NAME (line 148)', test_class: 'integration'} — unverified",
    "{behaviour: 'listByTerm pagination math (page-1)*size handles page=0 correctly (Postgres rejects negative offset)', test_class: 'unit'} — same class of latent regression as `getPopular.md` / `ReactiveDataEntityRepositoryImpl` paginated reads",
    "{behaviour: 'listByTerm uses asMaterialized() CTE materialisation hint and does not regress to inline planning', test_class: 'integration'} — uncovered; a future schema change could silently flip the planner's choice",
    "{behaviour: 'bulkCreate + bulkUpdate respect the partitioning at 1000-element BATCH_SIZE', test_class: 'integration'} — inherited from parent; not regression-tested here for the dataset_field shape",
    "{behaviour: 'delete(id) and delete(ids) issue HARD DELETE (no soft-delete column on dataset_field)', test_class: 'unit'} — the hard-delete contract is unverified and could be silently broken by a future `addSoftDeleteFilter` override mirroring the DataEntity pattern"
  ]
- test_files: [
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveDatasetFieldRepositoryImplTest.java:1-99` — 2 tests, integration via `BaseIntegrationTest`"
  ]
- gaps: |
    The repository's most-load-bearing read shape — `getLastVersionDatasetFieldsByOddrns` (the ingestion-tier batch read driving `DatasetFieldServiceImpl.createOrUpdateDatasetFields` and `DatasetFieldMetadataIngestionServiceImpl.ingestMetadata`) — has ZERO test coverage. The window-function CTE correctness is the load-bearing invariant for the entire dataset-structure ingestion flow: if `MAX(version) OVER (PARTITION BY oddrn)` returns a non-maximal row due to a Postgres / jOOQ planner change, every subsequent UPDATE-vs-INSERT decision in `DatasetFieldServiceImpl.buildDatasetFieldIngestionDto` (line 375-396) would be skewed, leading to silent orphan-row creation or in-place edits of the WRONG historical version. The four most consequential regressions to catch are:

    1. **CTE-versioning drift.** A maintainer changing the window function or removing the `version = max_version` filter would silently break ingestion's view of "current" fields. No test asserts that adding a NEWER dataset_version for the same oddrn promotes the new row to "current" within this method.
    2. **Authorization-resolver contract.** `getDataEntityIdByDatasetFieldId` (line 115-125) returning `Mono.empty()` for unknown ids is the contract `DatasetFieldResourceExtractor` relies on to deny unknown-id requests. A regression here (e.g. the join schema changing so that a tombstoned dataset_field returns a parent data_entity id even after the dataset is soft-deleted) would allow access through a stale dataset_field id. No test asserts the empty-vs-non-empty boundary.
    3. **Cross-owner enumeration via `listByTerm`.** A future maintainer adding a `filterByOwner(currentUserId)` predicate to scope this method would silently change the semantic — making term-linked dataset_field discovery owner-scoped. No regression-catcher asserts the current INCLUSIVE behaviour (every term-linked field across all owners). Conversely, the absence of `EXCLUDE_FROM_SEARCH` / `STATUS != DELETED` filter on the parent DataEntity is a discovery surface that exposes soft-deleted-parent fields — that gap also has no test.
    4. **`updateDescription` empty-string normalisation.** Lines 75 and 85 normalise empty strings to NULL — a future maintainer "improving" the API to accept whitespace-trimmed empty strings might re-introduce the empty-string-as-empty-string path; the activity feed and downstream filled-flag tracking depend on the NULL semantic.

    Additionally, **dataset_field has no own soft-delete and no own cascade trigger** (invariant 4 + corner-case 1). A regression-catcher test asserting that `delete(id)` issues HARD DELETE (versus a future soft-delete override) would surface architectural drift in the orphan-row management story.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (Grep across `ReactiveDatasetFieldRepositoryImpl.java` confirms no `@docs`, `// @docs`, or JavaDoc `{@link docs}` pattern).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: "#dataset-schema-diff"
    rationale: "dataset_field is the per-column metadata surface for datasets — the Dataset schema diff sub-feature of P-01 Data Discovery operates on dataset_field rows across dataset_version pairs. system-mission.md P-01 sub-feature 'Dataset schema diff (revision-pair visual diff)' is the closest doc-side anchor."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: pending-WebFetch-session
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features#alerting"
    anchor: "#alerting"
    rationale: "Schema changes detected at ingestion (DatasetStructureIngestionRequestProcessor sets `dto.setDatasetSchemaChanged(true)` line 146 when the structure-hash differs) trigger BACKWARDS_INCOMPATIBLE_SCHEMA alerts via `AlertActionResolverImpl`. The detection happens at the DATASET parent level (via `DatasetVersionHashCalculator`), not at the dataset_field row level — but the dataset_field rows ARE the substrate the hash is computed over. F-007 cross-reference."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: pending-WebFetch-session
    confidence: LOW
- doc_drift_findings:
  - "Live docs do not describe the version-aware identity model of dataset_field rows (shared across dataset_versions; new row created on hash-diff). Operators reading the schema-diff doc would not learn that a 'column rename' produces an orphan dataset_field row referenced only by historical dataset_versions. Worth surfacing as a DOC-NNN follow-up if/when the schema-diff feature gets its own canonical home."
  - "Live docs do not describe that internal-name / internal-description edits on a dataset_field are NOT propagated across dataset_versions — they are stored on a SINGLE dataset_field row. When a schema change creates a NEW dataset_field row (hash diverged), `DatasetFieldServiceImpl.getDatasetFieldUpdatedCopy` (line 308-322) COPIES the operator-curated internalDescription / internalName forward from the previous row. This forward-copy behaviour is non-obvious and undocumented."
  - "Live docs do not describe that `updateDescription` on a dataset_field does NOT emit an activity-feed event (no `@ActivityLog` annotation on `DatasetFieldServiceImpl.updateDescription` line 87) while `updateInternalName` and `updateDatasetFieldTags` DO (lines 99, 119). The asymmetry is invisible at the doc surface."

## implicit_adrs

- "**Dataset_field rows are versioned by reference, not by mutation — a column's evolution is captured by NEW rows in `dataset_field` and NEW links in `dataset_structure`, not by UPDATEs to the existing row.**" — evidence: V0_0_9__normalize_dataset_structure.sql:1-43 + DatasetFieldServiceImpl.java:375-396 — intent_anchor: "`V0_0_9__normalize_dataset_structure.sql:40-43`: `ALTER TABLE dataset_field DROP CONSTRAINT dataset_field_dataset_version_id_fkey, DROP COLUMN dataset_version_id` AND `DatasetFieldServiceImpl.java:392`: `fieldsToCreate.put(fieldPojo.getOddrn(), new DatasetFieldPair(existingField, fieldPojo));` — the explicit comment-free branch when `newVersionHash` differs from `existingVersionHash`. The DDL migration's deliberate drop of the version FK + the service's deliberate `pojosToCreate` partition together encode the decision: schema evolution = new row, not mutation." — confidence: HIGH

- "**Operator-curated metadata (internal-name, internal-description, INTERNAL-origin tags, INTERNAL enum values) is preserved across dataset-version forks** — when a hash-diff causes a NEW dataset_field row, the previous row's curated state is COPIED forward.** — evidence: DatasetFieldServiceImpl.java:308-322 + 324-335 + 352-373 — intent_anchor: "`DatasetFieldServiceImpl.java:315-316`: `copyNew.setInternalDescription(pair.lastExistingVersion().getInternalDescription()); copyNew.setInternalName(pair.lastExistingVersion().getInternalName());` PLUS `DatasetFieldServiceImpl.java:330-334`: `copyInternalTagsToNewFieldVersion` + `copyInternalEnumValuesToNewFieldVersion`. Explicit copy-forward of the four curated surfaces." — confidence: HIGH

- "**Authorization is parent-scoped: every dataset_field permission resolves to the parent DataEntity's permission via `DatasetFieldResourceExtractor` — there is NO field-level permission.**" — evidence: DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — intent_anchor: "`DatasetFieldResourceExtractor.java:26`: `.flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId);` — the final step of the resource resolver returns a `data_entity.id`, not a `dataset_field.id`. The downstream `ReactiveAuthorizationManager` then evaluates permissions against the parent DataEntity." — confidence: HIGH

- "**`listByTerm` is read-collaborative — it returns every dataset_field linked to a term across all owners / data sources / parent statuses, with no owner-scoping at JOIN time.**" — evidence: ReactiveDatasetFieldRepositoryImpl.java:141-204 — intent_anchor: "Lines 169-189 chain the joins DATA_ENTITY → DATA_SOURCE → NAMESPACE → OWNERSHIP → OWNER → TITLE → DATASET_FIELD_TO_TERM but never apply a `current-user owners` predicate. The aggregation `jsonArrayAgg(field(OWNER.asterisk()))` lines 165-167 instead SURFACES every owner of every entity to every caller — visible-to-all is the explicit design, matching `ReactiveDataEntityRepositoryImpl` invariant 6 (read-collaborative posture)." — confidence: HIGH

- "**Bulk operations are partitioned at 1000-row batches via `executeInPartitionReturning` rather than via stream / cursor — the contract is small-to-medium batches per ingestion call, not full-table operations.**" — evidence: ReactiveDatasetFieldRepositoryImpl.java:94 + JooqReactiveOperations.java:24 + JooqReactiveOperations.java:69-84 — intent_anchor: "`JooqReactiveOperations.java:24`: `private static final int BATCH_SIZE = 1000;` — a compile-time constant not exposed as config. `executeInPartitionReturning` short-circuits the partition path when `entities.size() <= BATCH_SIZE` (line 75-77), so the contract is also 'one-shot when small, partition when large' — explicit branch." — confidence: HIGH

## bugs_limitations_corner_cases

- "**`delete(id)` / `delete(ids)` inherited from `ReactiveAbstractCRUDRepository` issue HARD DELETE on dataset_field rows, but no caller in the platform invokes them — there is also NO scheduled orphan-cleanup job.** Schema-change forks leave the OLD dataset_field row in place, still referenced by the OLD dataset_structure row + the OLD dataset_version row. Over many ingestion cycles on a churning dataset, the `dataset_field` table grows monotonically. PG row count for a heavily-evolving dataset can be substantially larger than the current column count × ingestion-versions kept. No retention policy, no TTL, no admin endpoint to purge." — evidence: ReactiveAbstractCRUDRepository.java:144-155 + DatasetFieldServiceImpl.java:375-396 (no delete path) + no `*housekeeping*` scheduled job referencing `DATASET_FIELD` — severity: MEDIUM

- "**`updateDescription` on a dataset_field has NO @ActivityLog annotation — description edits are NOT recorded in the activity feed**, while `updateInternalName` (line 99) and `updateDatasetFieldTags` (line 119) DO emit activity events. Operators auditing a description change on a column will find no activity-feed evidence." — evidence: DatasetFieldServiceImpl.java:87-95 vs lines 98-115 (updateInternalName carries `@ActivityLog`) — severity: MEDIUM

- "**`updateDescription` stores user input VERBATIM with only empty-to-null normalisation — no Jsoup.clean, no Encode.html, no length cap.** Same F-004 verbatim-storage fingerprint as `ReactiveDataEntityRepositoryImpl.setInternalDescription` (lines 419-438 of that class). A Markdown / HTML payload submitted via PUT /api/datasetfields/{id}/description persists through reads. The UI's defence-in-depth at render layer (P-009 per system-mission.md F-004 cross-reference) is the operative safeguard." — evidence: ReactiveDatasetFieldRepositoryImpl.java:75-78 — severity: MEDIUM

- "**`updateInternalName` / `updateDescription` return Mono.empty when the dataset_field id does not exist — no NotFoundException at this layer.** `DatasetFieldServiceImpl.updateInternalName` line 104 does `.switchIfEmpty(Mono.error(new NotFoundException(...)))` — good. `DatasetFieldServiceImpl.updateDescription` line 86-95 does NOT switchIfEmpty before delegating to `datasetFieldInternalInformationService.updateDescription` — verify the downstream service's contract. If the chain completes empty, the API returns 200 OK with an empty body for a non-existent field id." — evidence: ReactiveDatasetFieldRepositoryImpl.java:72-90 + DatasetFieldServiceImpl.java:86-95 vs lines 100-115 — severity: LOW

- "**`listByTerm` enumerates every dataset_field linked to a term regardless of the parent data entity's `status` / `hollow` / `exclude_from_search` state.** A field on a soft-deleted DataEntity (`STATUS = DELETED`) still appears in `listByTerm` results — the joins (lines 169-189) apply no filter on the parent. Consequence: terms remain backlinked to columns of deleted datasets via the API. Mitigated only by the upstream `delete cascade` if soft-deletion ever became hard-delete." — evidence: ReactiveDatasetFieldRepositoryImpl.java:141-204 — severity: LOW

- "**`getLastVersionDatasetFieldsByOddrns` window-function CTE assumes `DATASET_VERSION.VERSION` is monotonic and unique per `DATASET_FIELD.ODDRN`.** If two distinct dataset_field rows for the same oddrn link via DATASET_STRUCTURE to the same MAX(version) — possible if a manual DB intervention or a future bug inserted dual rows — the method would return BOTH, and the downstream caller's `Collectors.toMap(DatasetFieldPojo::getOddrn, identity())` (`DatasetFieldMetadataIngestionServiceImpl.java:48`, `DatasetFieldServiceImpl.java:142`) would throw `IllegalStateException: Duplicate key`. No defensive merge function is supplied." — evidence: ReactiveDatasetFieldRepositoryImpl.java:99-110 + DatasetFieldMetadataIngestionServiceImpl.java:48 — severity: LOW

- "**`getDatasetFieldWithTags` aggregates tags via `jsonArrayAgg(field(TAG.asterisk().toString()))` line 130** — the JSON-agg-of-asterisk pattern fans out across `LEFT JOIN TAG_TO_DATASET_FIELD … LEFT JOIN TAG` (lines 132-133) and groups by `DATASET_FIELD.fields()` (line 135). A field with N tags produces a JSON array of length N; a field with 0 tags produces a JSON array containing a single `null` element (per Postgres `jsonb_agg` of an empty left-join — would need to verify whether the SELECT extracts to `null` or to `[]`). The mapper `mapRecordToDatasetFieldWithTags` line 207-213 uses `jooqRecordHelper.extractAggRelation` which would need to handle the null-element case. No test seeds a 0-tag field." — evidence: ReactiveDatasetFieldRepositoryImpl.java:127-139 + 207-213 — severity: LOW

- "**`getDataEntityIdByDatasetFieldId` follows a 3-table join chain (dataset_field → dataset_structure → dataset_version → data_entity) on EVERY authorization request that targets `/api/datasetfields/{id}/...`.** Five such routes — `/name`, `/description`, `/tags`, `/enum_values`, `/terms`, `/terms/{termId}` — each request issues this query before the controller method runs. No cache. For high-frequency edits this is one extra DB round-trip per request beyond what `/api/dataentities/{id}/...` would incur." — evidence: ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three UI auth modes that protect the API surface). `INTERNAL_ONLY` is partially applicable since this is a repository, not an HTTP surface, but the security-relevant invariants (parent-scoped permission resolution, cross-owner enumeration) only matter when an authenticated user reaches the API. `DISABLED` bypasses all gates and exposes the repository's full read surface. `S2S` does not apply — `/ingestion/*` paths do not route to this repository for direct reads; ingestion writes flow via `DatasetFieldServiceImpl.createOrUpdateDatasetFields` invoked from `DatasetStructureIngestionRequestProcessor` (`DatasetStructureIngestionRequestProcessor.java:42-48` chain).
- **ingestion_filter_relevance**: `INDIRECT — repository is reached during /ingestion/entities processing via DatasetStructureIngestionRequestProcessor`. The S2S ingestion filter (`auth.ingestion.filter.enabled`) gates the entry endpoint `POST /ingestion/entities`; once past, the IngestionRequest payload flows through `DatasetStructureIngestionRequestProcessor.process` → `datasetStructureService.createDatasetStructure` → `datasetFieldService.createOrUpdateDatasetFields` → this repository's bulkCreate / bulkUpdate. The repository itself has no auth check.
- **authorization_assertions**: `[]` — N/A at the repository layer. Authorization gates live at `SecurityConstants.java:282-303` (PathPatternParserServerWebExchangeMatcher rules with permission keys: `DATASET_FIELD_INTERNAL_NAME_UPDATE`, `DATASET_FIELD_DESCRIPTION_UPDATE`, `DATASET_FIELD_TAGS_UPDATE`, `DATASET_FIELD_ENUMS_UPDATE`, `DATASET_FIELD_ADD_TERM`, `DATASET_FIELD_DELETE_TERM`). Resolution to the parent DataEntity happens via `DatasetFieldResourceExtractor.java:21-27`, which in turn calls this repository's `getDataEntityIdByDatasetFieldId`. No `@PreAuthorize` annotations on this class.
- **owner_scoping**: `BYPASSES — listByTerm returns dataset_fields across all owners with no current-user filter`. `getLastVersionDatasetFieldsByOddrns`, `getDatasetFieldWithTags`, `getDataEntityIdByDatasetFieldId` are not data-scoped reads (they are point lookups by id / oddrn already resolved by upstream context). `listByTerm` (lines 141-204) is the cross-owner enumeration surface — every authenticated user can list every dataset_field tied to a term across all data sources. Confirms the read-collaborative posture pillar P-09 documents (system-mission.md P-09 maintainer notes: "every authenticated user can enumerate the entire catalog").
- **data_exposure**:
  - "`listByTerm` payload (DatasetFieldTermsDto) → any authenticated user with a valid session, no owner filter applied. Each item exposes: the dataset_field row (name, type, descriptions, stats, is_key flags), the parent DataEntity (id, oddrn, types, namespaces), the parent DataSource (oddrn, name), aggregated Owner+Title pairs (every owner of every parent entity), aggregated Ownership rows. Effectively a catalog-wide field-by-term inverted index visible to any logged-in user."
  - "`getDatasetFieldWithTags` payload → caller of `/api/datasetfields/{id}/...` after parent-DataEntity permission check. Exposes the dataset_field row + non-soft-deleted Tag set. Owner-scoping comes from upstream parent-DataEntity permission check, not from this method."
  - "`getDataEntityIdByDatasetFieldId` → returns only the parent data_entity id (Long). Low-information; used by the authorization layer itself."
- **known_security_gaps**:
  - "`listByTerm` is the cross-owner field-by-term enumeration with no per-owner scoping — same class of finding as `ReactiveDataEntityRepositoryImpl` read-collaborative posture. In ODD's stated `read-collaborative` model this is intentional (P-09 maintainer notes), but the documentation surface does not warn operators that term lookups reveal cross-tenant column metadata." — evidence: ReactiveDatasetFieldRepositoryImpl.java:141-204 — severity: MEDIUM
  - "`updateDescription` stores user-supplied Markdown / HTML verbatim with no backend sanitisation — F-004 verbatim-storage class. The persistent XSS-vector defence is the UI render layer (DefiniteDOMSanitiserPipeline cross-reference in P-009 / F-004 sidecars)." — evidence: ReactiveDatasetFieldRepositoryImpl.java:75-78 — severity: MEDIUM
  - "`getDataEntityIdByDatasetFieldId` returns Mono.empty for unknown ids — fail-closed at the authorization layer (the empty Mono propagates as 'no resource → deny'), but the failure mode is silent at the repository contract. A future caller treating `Mono.empty` as 'no permission needed' (rather than 'unknown resource') would open a hole. Today no caller does this; the gap is latent." — evidence: ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:21-27 — severity: LOW
  - "`listByTerm` does NOT apply `EXCLUDE_FROM_SEARCH` or `STATUS != DELETED` predicates on the parent DataEntity (lines 169-189). Fields of a soft-deleted DataEntity remain enumerable via term lookup. Consistent with `ReactiveDataEntityRepositoryImpl` invariant 3 (`EXCLUDE_FROM_SEARCH` is INCONSISTENTLY APPLIED) — this is another endpoint where the predicate is missing." — evidence: ReactiveDatasetFieldRepositoryImpl.java:169-189 + ReactiveDataEntityRepositoryImpl analogous invariant — severity: LOW

## performance

- **hot_paths**:
  - "`getLastVersionDatasetFieldsByOddrns` runs on EVERY ingestion request that contains dataset entities — invoked from both `DatasetStructureIngestionRequestProcessor` (via `DatasetFieldServiceImpl.createOrUpdateDatasetFields` line 141) AND `DatasetFieldMetadataIngestionServiceImpl.ingestMetadata` (line 47). Each invocation issues 1 CTE query per 1000-oddrn batch with a window-function over the dataset_field × dataset_structure × dataset_version chain. For a 5000-column dataset, this means 5 CTE queries per ingestion call." — evidence: ReactiveDatasetFieldRepositoryImpl.java:92-113 + DatasetFieldServiceImpl.java:141 + DatasetFieldMetadataIngestionServiceImpl.java:47
  - "`getDataEntityIdByDatasetFieldId` runs on EVERY request to `/api/datasetfields/{id}/name|description|tags|enum_values|terms|terms/{termId}` — one DB round-trip via 3-table join chain BEFORE the controller method executes. No cache." — evidence: ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:26
  - "`listByTerm` is called from `DatasetFieldServiceImpl.listByTerm` line 186 on every `GET /api/terms/{termId}/datasetfields?...` request. The CTE is materialised (line 191-192) and the outer query fans out 7-table left-joins (DATASET_FIELD_CTE × DATA_ENTITY × DATA_SOURCE × NAMESPACE × OWNERSHIP × OWNER × TITLE × DATASET_FIELD_TO_TERM)." — evidence: ReactiveDatasetFieldRepositoryImpl.java:141-204
- **throughput_characteristics**:
  - "`bulkCreate` / `bulkUpdate` inherited from parent — partitioned at 1000-row batches via `executeInPartitionReturning`. Each partition is one SQL roundtrip with multi-row INSERT or UPDATE-FROM-VALUES."
  - "Per-field user edits (`updateDescription`, `updateInternalName`) are single-item; no batch surface."
  - "`getLastVersionDatasetFieldsByOddrns` batches at 1000 oddrns per CTE — for 10K oddrns it issues 10 sequential CTE queries (not concurrent — `executeInPartitionReturning` uses `Flux::concat` line 82)."
  - "Reactive Mono/Flux signatures — non-blocking R2DBC pool, but per-call DB round-trip; no in-process result-set streaming for the CTE methods."
- **resource_allocation**:
  - "Each CTE call streams its result through R2DBC into a `Flux<Record>` then maps to `DatasetFieldPojo` via `r.into(DatasetFieldPojo.class)`. No bounded buffer at this layer — back-pressure is the only flow control."
  - "`listByTerm` aggregates owners/titles/ownership as JSON arrays (lines 165-167). For a term linked to many dataset_fields where each parent DataEntity has many owners, the per-row JSON payload can grow large."
  - "Window-function CTE in `getLastVersionDatasetFieldsByOddrns` materialises `cte` in Postgres — memory cost is `O(records × dataset_field_columns)` per partition."
- **scaling_characteristics**:
  - "Stateless — no in-memory cache, no per-instance state. Instances scale horizontally; the bottleneck is the shared Postgres."
  - "`listByTerm` is paginated by `size` and `(page-1)*size` (lines 199-200). With `asMaterialized()` CTE (line 192) the inner result-set lives in working memory once per query; outer LIMIT/OFFSET applied after the aggregation."
  - "No advisory-lock interaction. No leader-election dependency. No ShedLock."
  - "The dataset_field table itself has NO native partition / sharding — single-table monotonic growth. Per `V0_0_16__add_datasetfield_oddrn_index.sql` (referenced by Grep) there is an oddrn index; primary key is `id` bigserial."
- **known_performance_gaps**:
  - "`getLastVersionDatasetFieldsByOddrns` issues sequential CTE queries via `Flux::concat` (`JooqReactiveOperations.java:82`) — no parallel execution across partitions even though partitions are independent. For a 10K-oddrn ingestion call this is ~10 sequential round-trips that could in principle be parallel. The choice is intentional (R2DBC connection-pool pressure), but the trade-off is not documented." — evidence: JooqReactiveOperations.java:69-84 + ReactiveDatasetFieldRepositoryImpl.java:94 — severity: LOW
  - "`getDataEntityIdByDatasetFieldId` runs on every authorisation request (mentioned in hot_paths) — no caching, no co-fetching with the parent DataEntity permission lookup. For a workflow that edits 50 fields' descriptions on the same DataEntity, this is 50 sequential 3-table-join lookups even though the parent id is constant." — evidence: ReactiveDatasetFieldRepositoryImpl.java:115-125 — severity: LOW
  - "`listByTerm` aggregates ALL owners / titles / ownerships across all parent DataEntities matching the term — the JSON-array payload size is unbounded by anything except the `size` page parameter. A term linked to thousands of dataset_fields across many entities will produce large response payloads." — evidence: ReactiveDatasetFieldRepositoryImpl.java:164-167 — severity: LOW
  - "Orphan dataset_field rows accumulate monotonically — no scheduled cleanup of rows whose dataset_structure links are gone (or whose dataset_version is soft-deleted). For a heavily-evolving dataset, the table grows over time without ceiling. Read paths walking the table (`listByTerm`) pay an increasing cost over the system's lifetime." — evidence: ReactiveAbstractCRUDRepository.java:144-155 + no housekeeping job referencing DATASET_FIELD + the absence of soft-delete column — severity: MEDIUM

## sources

- understanding ← ReactiveDatasetFieldRepositoryImpl.java:1-214 + DatasetFieldServiceImpl.java:134-156, 308-396 + DatasetStructureIngestionRequestProcessor.java:42-79 + V0_0_9__normalize_dataset_structure.sql:1-43 + V0_0_1__init.sql:148-164
- concepts.entities.DatasetFieldPojo ← V0_0_1__init.sql:148-164 + V0_0_46__primary_and_sort_key_for_dataset_field.sql:1-3 + V0_0_66__add_dataset_field_default_value.sql:1-2 + V0_0_72__dataset_field_reference_type.sql:1-2 + V0_0_81__dataset_field_internal_name.sql:1-2
- concepts.entities.DATASET_STRUCTURE ← V0_0_9__normalize_dataset_structure.sql:1-16
- concepts.entities.DATASET_FIELD_TO_TERM ← V0_0_74__dataset_field_terms.sql:1-10
- concepts.entities.TAG_TO_DATASET_FIELD ← V0_0_82__add_tag_to_dataset_field.sql (referenced for FK existence)
- concepts.operations.upsert-by-oddrn-with-version-fork ← DatasetFieldServiceImpl.java:134-156, 375-396
- concepts.operations.latest-version-read-by-oddrns ← ReactiveDatasetFieldRepositoryImpl.java:92-113
- concepts.operations.user-edit-internal-description ← ReactiveDatasetFieldRepositoryImpl.java:72-80
- concepts.operations.user-edit-internal-name ← ReactiveDatasetFieldRepositoryImpl.java:82-90
- concepts.operations.resolve-parent-dataentity-for-auth ← ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:21-27
- concepts.operations.detail-with-tags-read ← ReactiveDatasetFieldRepositoryImpl.java:127-139
- concepts.operations.cross-owner-list-by-term ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- concepts.invariants.no-soft-delete ← V0_0_1__init.sql:148-164 + (sweep of ALTER TABLE dataset_field migrations) + ReactiveAbstractCRUDRepository.java:144-155
- concepts.invariants.version-aware-identity ← V0_0_9__normalize_dataset_structure.sql:1-43
- concepts.invariants.hash-diff-partition ← DatasetFieldServiceImpl.java:375-396
- concepts.invariants.internal-name-caller-curated ← DatasetFieldServiceImpl.java:308-322
- concepts.invariants.window-function-CTE ← ReactiveDatasetFieldRepositoryImpl.java:99-110
- concepts.invariants.no-owner-scoping ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- concepts.invariants.authorization-parent-scoped ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- concepts.invariants.tag-deletion-filter ← ReactiveDatasetFieldRepositoryImpl.java:133
- concepts.invariants.materialised-CTE ← ReactiveDatasetFieldRepositoryImpl.java:191-192
- concepts.invariants.activity-log-emission ← DatasetFieldServiceImpl.java:99 + DatasetFieldInformationUpdatedActivityHandler.java:22-69
- dependencies_semantic.requires-feature.parent-class ← ReactiveAbstractCRUDRepository.java:1-300 + ReactiveDatasetFieldRepositoryImpl.java:52-70
- dependencies_semantic.coupling.DatasetFieldServiceImpl ← DatasetFieldServiceImpl.java:134-156, 308-396
- dependencies_semantic.coupling.DatasetFieldResourceExtractor ← DatasetFieldResourceExtractor.java:1-28
- dependencies_semantic.coupling.FTS-write-side ← DatasetFieldServiceImpl.java:113, 127 + ReactiveSearchEntrypointRepositoryImpl.java:475-490
- dependencies_semantic.coupling.activity-log ← DatasetFieldServiceImpl.java:99, 119 + DatasetFieldInformationUpdatedActivityHandler.java:22-69
- tests_coverage_semantic.test_files ← ReactiveDatasetFieldRepositoryImplTest.java:1-99
- tests_coverage_semantic.covered_behaviours ← ReactiveDatasetFieldRepositoryImplTest.java:39-76
- docs_link_semantic.inferred_docs.[0] (Dataset schema diff) ← system-mission.md P-01 sub-feature seed
- docs_link_semantic.inferred_docs.[1] (Alerting / schema drift) ← DatasetStructureIngestionRequestProcessor.java:144-148 + AlertActionResolverImpl (cross-reference)
- implicit_adrs.[0] (versioning-by-reference) ← V0_0_9__normalize_dataset_structure.sql:1-43 + DatasetFieldServiceImpl.java:375-396
- implicit_adrs.[1] (preserved curated metadata) ← DatasetFieldServiceImpl.java:308-335
- implicit_adrs.[2] (parent-scoped authorization) ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- implicit_adrs.[3] (read-collaborative listByTerm) ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- implicit_adrs.[4] (1000-row batches) ← JooqReactiveOperations.java:24, 69-84 + ReactiveDatasetFieldRepositoryImpl.java:94
- bugs_limitations_corner_cases.[0] (no orphan cleanup) ← ReactiveAbstractCRUDRepository.java:144-155 + DatasetFieldServiceImpl.java:375-396
- bugs_limitations_corner_cases.[1] (description no activity log) ← DatasetFieldServiceImpl.java:87-95 vs lines 98-115
- bugs_limitations_corner_cases.[2] (description verbatim storage) ← ReactiveDatasetFieldRepositoryImpl.java:75-78
- bugs_limitations_corner_cases.[3] (silent-no-op-vs-404) ← ReactiveDatasetFieldRepositoryImpl.java:72-90 + DatasetFieldServiceImpl.java:86-95
- bugs_limitations_corner_cases.[4] (listByTerm soft-deleted parents) ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- bugs_limitations_corner_cases.[5] (duplicate-oddrn CTE risk) ← ReactiveDatasetFieldRepositoryImpl.java:99-110 + DatasetFieldMetadataIngestionServiceImpl.java:48
- bugs_limitations_corner_cases.[6] (tag agg null-element risk) ← ReactiveDatasetFieldRepositoryImpl.java:127-139, 207-213
- bugs_limitations_corner_cases.[7] (per-request 3-table join for auth) ← ReactiveDatasetFieldRepositoryImpl.java:115-125 + SecurityConstants.java:282-303
- security.auth_mode_relevance ← SecurityConstants.java:282-303 + DatasetFieldResourceExtractor.java:21-27
- security.authorization_assertions ← (none at repo layer; gates live at SecurityConstants.java:282-303 — verified by grep on the class)
- security.owner_scoping ← ReactiveDatasetFieldRepositoryImpl.java:141-204 (cross-owner enumeration)
- security.data_exposure.listByTerm ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- security.known_security_gaps.[0] (cross-owner enumeration) ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- security.known_security_gaps.[1] (verbatim description) ← ReactiveDatasetFieldRepositoryImpl.java:75-78
- security.known_security_gaps.[2] (Mono.empty for unknown id) ← ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:21-27
- security.known_security_gaps.[3] (no EXCLUDE_FROM_SEARCH / STATUS filter in listByTerm) ← ReactiveDatasetFieldRepositoryImpl.java:169-189
- performance.hot_paths.[0] (getLastVersionDatasetFieldsByOddrns on every ingestion) ← ReactiveDatasetFieldRepositoryImpl.java:92-113 + DatasetFieldServiceImpl.java:141 + DatasetFieldMetadataIngestionServiceImpl.java:47
- performance.hot_paths.[1] (getDataEntityIdByDatasetFieldId on every auth check) ← ReactiveDatasetFieldRepositoryImpl.java:115-125 + DatasetFieldResourceExtractor.java:26 + SecurityConstants.java:282-303
- performance.hot_paths.[2] (listByTerm CTE + 7 left joins) ← ReactiveDatasetFieldRepositoryImpl.java:141-204
- performance.scaling_characteristics.no-soft-delete-implies-orphan-growth ← ReactiveAbstractCRUDRepository.java:144-155 + absence of housekeeping job for DATASET_FIELD
- performance.known_performance_gaps.[0] (sequential partition execution) ← JooqReactiveOperations.java:69-84
- performance.known_performance_gaps.[3] (orphan accumulation) ← (same as scaling)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (live URLs not yet verified — `last_verified_status: pending-WebFetch-session`; doc anchors are inferred from system-mission.md pillar shape, not from a `@docs` annotation in source)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## back_links

- `back-to-feature`: F-004 (Entity Description Editing) — strengthens by extending the verbatim-storage class to the dataset_field surface (PUT /api/datasetfields/{id}/description). Same fingerprint as ReactiveDataEntityRepositoryImpl.setInternalDescription. The defence-in-depth surface remains the UI render pipeline (P-009 cross-reference).
- `back-to-feature`: F-005 (Lineage Graph Traversal — column-level lineage) — strengthens by surfacing dataset_field as the per-column substrate. Column-level lineage edges, when implemented, would reference these rows; the version-aware identity model (a column rename = new row) means lineage edges to an old name persist alongside lineage edges to the new name.
- `back-to-feature`: F-007 (AlertManager — schema-change alerts) — strengthens by clarifying that schema-drift detection happens at the DATASET parent level (via `DatasetVersionHashCalculator` on the structure hash + `DatasetStructureIngestionRequestProcessor.java:144-148` setting `datasetSchemaChanged=true`), NOT at the dataset_field row level. dataset_field rows are the substrate the hash is computed over, but the alert-action-resolver fires once per dataset, not once per field change.
- `back-to-pillar`: P-01 Data Discovery — sub-feature "Dataset schema diff (revision-pair visual diff)". This repository is the persistence layer that makes the version-pair diff possible (multiple dataset_field rows per oddrn linked via dataset_structure).
- `back-to-pillar`: P-09 Security & Access Control — strengthens read-collaborative posture invariant. listByTerm is another cross-owner enumeration surface alongside ReactiveDataEntityRepositoryImpl. Confirms that the posture extends from DataEntity-level to dataset_field-level reads.
- `back-to-pillar`: P-10 Integrations & Ingestion — strengthens the ingestion-tier pattern. getLastVersionDatasetFieldsByOddrns is invoked from BOTH DatasetStructureIngestionRequestProcessor AND DatasetFieldMetadataIngestionServiceImpl during /ingestion/entities processing. The 1000-row partition pattern is the shared idiom (cf. ReactiveDataEntityRepositoryImpl bulk paths).
- `cross-reference`: ReactiveDataEntityRepositoryImpl sidecar — sibling repository, shares the read-collaborative posture invariant + verbatim-description storage class. Differs in soft-delete semantics (DataEntity has STATUS-based soft-delete; dataset_field has none).
- `cross-reference`: ReactiveSearchEntrypointRepositoryImpl (DEFERRED per batch-N note) — the FTS write-side that this repository's edit paths trigger via DatasetFieldServiceImpl.updateInternalName line 113 (`updateDatasetFieldSearchVectors`). Confirms the FTS substrate participates in dataset_field edit flow even though that repository was never enriched.

## coherence_check

- **strengthens**:
  - system-mission.md P-09 maintainer notes "every authenticated user can enumerate the entire catalog" — extended to dataset_field surface via listByTerm
  - system-mission.md P-10 pattern "single-transaction-per-batch pipeline" + "1000-row partitioned bulk writes" — confirmed at dataset_field layer
  - ReactiveDataEntityRepositoryImpl invariant 6 "Multi-tenancy / owner-scoping is NOT enforced at JOIN time" — same posture observed here
  - ReactiveDataEntityRepositoryImpl invariant 3 "EXCLUDE_FROM_SEARCH is INCONSISTENTLY APPLIED" — listByTerm is another endpoint where the predicate is missing
  - F-004 verbatim-storage fingerprint — confirmed at the dataset_field surface (parallel to data_entity surface)

- **supersedes**: none — this is a fresh enrichment of a previously-unenriched node.

- **conflicts_surfaced**:
  - system-mission.md P-07 sub-feature "Activity Feed (global page + per-entity tab)" implicitly claims activity events for all curated metadata edits. The asymmetry on this surface — `updateDescription` is NOT logged while `updateInternalName` and `updateDatasetFieldTags` ARE (bugs_limitations_corner_cases entry 1) — surfaces a hidden gap in the Activity Feed's coverage promise. This conflict should be surfaced as a DOC-NNN follow-up or a backlog item ("Activity Feed coverage audit — dataset_field description edits not recorded").

## Maintainer notes

---
node_id: "odd-platform java repository reactive repository:ReactiveTagRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-19-batch-N
schema_version: v0.3.0
---

# ReactiveTagRepositoryImpl — semantic understanding

## understanding

`ReactiveTagRepositoryImpl` is the jOOQ/Reactor persistence surface for everything ODD does with `Tag` rows and their three relation tables (`TAG_TO_DATA_ENTITY`, `TAG_TO_DATASET_FIELD`, `TAG_TO_TERM`). It extends `ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` so all base CRUD (`create`, `bulkCreate`, `update`, `delete`, `list`) reads through a `tag.deleted_at IS NULL` filter applied via `addSoftDeleteFilter`. Beyond CRUD, the class hosts (a) read-side aggregations for the popular-tags surface (`getDto`, `listDataEntityDtos`, `listDatasetFieldDtos`, `listMostPopular` with a CTE that UNION-ALLs `tag_to_data_entity` + `tag_to_dataset_field` usage counts), (b) relation lookups (`listByNames`, `listByTerm`, `listTagsRelations`, `listTagRelations`) that drive the UI tag dropdown and the diff in `TagServiceImpl.updateRelationsWithDataEntity`, (c) per-relation create/delete primitives — `createDataEntityRelations` / `createTermRelations` / `createDatasetFieldRelations` (all `onDuplicateKeyIgnore`) and four `delete*Relations` overloads — and (d) the bulk-upsert `ingestData(List<TagPojo>)` driven by the `TAG_NAME_UNIQUE` partial index with an `onConflict(...).where(TAG.DELETED_AT.isNull()).doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME))` clause that is the platform's only DB-level race protection against concurrent novel-name creation.

## concepts

- entities: [
    "`TagPojo` (jOOQ-generated row pojo for `tag` table: `id`, `name`, `important`, `created_at`, `updated_at`, `deleted_at` — `is_deleted` column was dropped in `V0_0_64__remove_is_deleted_field.sql`)",
    "`TagDto` (service-layer record `TagDto(TagPojo tagPojo, Long usedCount, Boolean external)` — `TagDto.java:5` — aggregates `tag` row + `count(tag_to_data_entity.tag_id)` usage + `boolOr(tag_to_data_entity.external)` whether any usage is external)",
    "`TagToDataEntityPojo` (`tag_to_data_entity` row: `(tag_id, data_entity_id, external)` — the `external = true` flag distinguishes ingestion-derived relations from UI-set ones)",
    "`TagToDatasetFieldPojo` (`tag_to_dataset_field` row: `(tag_id, dataset_field_id, origin)` where `origin` is a `TagOrigin` enum — `INTERNAL | EXTERNAL | EXTERNAL_STATISTICS` per `TagOrigin.java:4-6`)",
    "`TagToTermPojo` (`tag_to_term` row: `(tag_id, term_id)`)",
    "`Indexes.TAG_NAME_UNIQUE` (the jOOQ-generated handle to the partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` — current shape per `V0_0_64__remove_is_deleted_field.sql:105`)"
  ]
- operations: [
    "`getDto(long id)` — single-row read with left-join count + `boolOr(external)` aggregation; uses `idCondition(id)` which is overridden by `ReactiveAbstractSoftDeleteCRUDRepository.idCondition` to add `deleted_at IS NULL`",
    "`listDataEntityDtos(Long dataEntityId)` — all non-deleted tags attached to a single data entity",
    "`listDatasetFieldDtos(long datasetFieldId)` — same shape for dataset-field tags; `external` aggregate is computed differently (`origin.eq(EXTERNAL)`) because `tag_to_dataset_field` uses a `TagOrigin` enum rather than a boolean",
    "`listTagsRelations(Collection<Long> datasetFieldIds, TagOrigin origin)` — dataset-field relations filtered by optional origin (used by ExternalTagIngestionRequestProcessor to fetch `EXTERNAL` relations + by DatasetFieldServiceImpl to copy `INTERNAL` relations during schema-version transitions)",
    "`listByNames(Collection<String> names)` — case-SENSITIVE exact-match lookup driving the existence-check in `TagServiceImpl.divideTagsByExistence`; soft-delete filter applied",
    "`listByTerm(long termId)` — joins `tag_to_term` + `tag`; soft-delete filter applied explicitly as `TAG.DELETED_AT.isNull()` (not via `idCondition` since this is not a primary-key lookup)",
    "`listMostPopular(String query, List<Long> ids, int page, int size)` — paginated popular-tags surface; uses an `asTable('tag_cte')` + UNION-ALL of `tag_to_data_entity` + `tag_to_dataset_field` usage counts; orders by descending count; passes through soft-delete filter via `listCondition(query)`; powers `GET /api/tags/popular` (`TagController.java:36-44`) globally for every user",
    "`listTagRelations(Collection<Long> dataEntityIds)` — bulk fetch of `tag_to_data_entity` rows; soft-delete filter on tag side; powers diff in `TagServiceImpl.updateRelationsWithDataEntity` + `ExternalTagIngestionRequestProcessor.updateDatasetEntityTags`",
    "`ingestData(List<TagPojo> tags)` — bulk upsert with `INSERT ... ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *` (`ReactiveTagRepositoryImpl.java:199-210`); uses `Indexes.TAG_NAME_UNIQUE.getFields()` to pin the conflict target to the `name` column",
    "`createDataEntityRelations(Collection<TagToDataEntityPojo>)` / `createDatasetFieldRelations(Collection<TagToDatasetFieldPojo>)` / `createTermRelations(long termId, Collection<Long> tagIds)` — bulk inserts with `onDuplicateKeyIgnore` (idempotent assignment); all build a single INSERT per call by chaining `.newRecord()`",
    "Four `delete*Relations` overloads — `deleteDataEntityRelations(Collection<TagToDataEntityPojo>)`, `deleteDataEntityRelations(long tagId)`, `deleteTermRelations(long termId, Collection<Long> tagIds)`, `deleteTermRelations(long tagId)`, `deleteDatasetFieldRelations(long tagId)`, `deleteDatasetFieldRelations(List<TagToDatasetFieldPojo>)`, `deleteDatasetFieldInternalRelations(long datasetFieldId)` — all hard-delete (`DSL.delete(...)`); relation tables are NOT soft-deleted, only `tag` rows are"
  ]
- invariants: [
    "Soft-delete is mediated by `deleted_at IS NULL` at the `tag` table level (`V0_0_64__remove_is_deleted_field.sql:105`); the `is_deleted` boolean column was removed in V0_0_64 (`V0_0_64__remove_is_deleted_field.sql:108`: `ALTER TABLE tag DROP COLUMN IF EXISTS is_deleted`). The earlier history is `V0_0_36__refactor_unique_index.sql:4` (`is_deleted IS FALSE`) → `V0_0_57__change_tag_unique_constraint_semantics.sql:3` (same but later replaced) → `V0_0_64`. Three migrations to land on the current shape.",
    "Tag-name uniqueness is enforced by the PARTIAL unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64__remove_is_deleted_field.sql:105`). A soft-deleted Tag does NOT block reinsertion of the same name — the partial index excludes deleted rows. This is the protection that allows `ingestData` to use `ON CONFLICT (name) WHERE DELETED_AT IS NULL DO UPDATE` cleanly.",
    "Tag-name match in `listByNames` is case-SENSITIVE because the underlying jOOQ `TAG.NAME.in(names)` translates to a SQL `IN` predicate against a `text` column without `LOWER()` or `ILIKE`. The popular-tags query in `listMostPopular` uses `listCondition` from the parent, which applies `nameField.containsIgnoreCase(nameQuery)` for the `query` parameter only — so substring-search-style queries are case-insensitive but exact-name dedup-lookup is case-sensitive. `Postgres` and `postgres` will be treated as two different tags by `TagServiceImpl.divideTagsByExistence`, even though `getPopularTagList(query='post')` would match both.",
    "The `Indexes.TAG_NAME_UNIQUE` jOOQ handle is the SINGLE source of conflict-target truth for the upsert path — `conflictFields` is computed dynamically (`ReactiveTagRepositoryImpl.java:199-202`) rather than hardcoded; a migration that changes the index would automatically change the conflict target. By contrast, the `WHERE TAG.DELETED_AT.isNull()` clause (`:207`) is hardcoded and depends on the partial-index predicate remaining `deleted_at IS NULL`. If the index predicate ever changed (e.g. to also filter on `is_important = false`), the `where` clause in this method would silently fail to match.",
    "The `ingestData` upsert sets `TAG.NAME = DSL.excluded(TAG.NAME)` on conflict — a no-op update that exists solely to trigger the RETURNING clause. Without this, conflicting rows would be silently skipped and the caller would not see the existing Tag's id. Critical for the caller (`TagServiceImpl.getOrInjectTagByName` for the ExternalTagIngestionRequestProcessor path) to be able to attach existing-tag relations.",
    "All relation-create methods use `onDuplicateKeyIgnore` rather than `onConflict(...).doUpdate(...)` — relation rows are write-once-as-truth; their conflict semantics is 'no-op if already exists'. By contrast, the `ingestData` upsert touches the same row (sets name = excluded name) to keep the RETURNING contract intact.",
    "Empty-collection guards on every batch method (`CollectionUtils.isEmpty(tags)` → `Flux.just()` at lines 103-105, 181-183, 219-221, 246-248, 268-270, 310-312; `tagIds.isEmpty()` at 267-270, 327-329) — caller may pass empty without DB roundtrip. This is consistent across the codebase but explicit here because `ingestData` and the bulk relation methods would otherwise issue empty INSERT statements that jOOQ does NOT accept.",
    "Hard-delete vs soft-delete asymmetry: `tag` rows are SOFT-deleted (the override in `ReactiveAbstractSoftDeleteCRUDRepository.delete`), but `tag_to_data_entity`, `tag_to_dataset_field`, `tag_to_term` rows are HARD-deleted in this class (all `delete*Relations` use `DSL.delete(...)`). Consequence: a tag with N relations, then deleted, then re-created with the same name (different id, since partial-index excludes deleted) loses all prior relation history — the relations were hard-deleted in `TagServiceImpl.delete` (`TagServiceImpl.java:64-66`) before the tag was soft-deleted, and re-creating the tag does not reattach them."
  ]
- audiences: [
    "`TagServiceImpl` — the dominant caller (10 of the 18 method invocations); responsible for the auto-create-on-miss UX (`getOrCreateTagsByName` calls `bulkCreate` + `listByNames`), the upsert path (`getOrInjectTagByName` calls `ingestData`), the per-data-entity diff (`updateRelationsWithDataEntity`), the term-relation orchestrator (`createRelationsWithTerm` / `deleteRelationsWithTerm`), and the dedicated CRUD route (`bulkCreate` for `TagController.createTag`)",
    "`ExternalTagIngestionRequestProcessor` (FINALIZING phase of `IngestionService` pipeline) — calls `listTagRelations`, `deleteDataEntityRelations`, `createDataEntityRelations`, `listTagsRelations(origin=EXTERNAL)`, `deleteDatasetFieldRelations`, `createDatasetFieldRelations` — every Tag mutation arriving from a Collector flows through here in a `@ReactiveTransactional` boundary",
    "`DatasetFieldServiceImpl` — calls `listTagsRelations(origin=INTERNAL)` to copy internal tag relations to new dataset-field versions during schema-diff transitions (`DatasetFieldServiceImpl.java:354`); also `deleteDatasetFieldInternalRelations` + `listDatasetFieldDtos`",
    "`DataEntityServiceImpl` — calls `listDataEntityDtos` to populate the per-entity tag list on detail-page reads (`DataEntityServiceImpl.java:622`)",
    "`DataEntityPermissionExtractor` — calls `listDataEntityDtos` to populate `tagsMono` for the policy-evaluation context in `DataEntityPolicyResolverContext` (`DataEntityPermissionExtractor.java:67`); means TAG state is part of the data flowing into RBAC decisions about that data entity",
    "`TagActivityHandlerImpl` — calls `listDataEntityDtos` to capture BEFORE / AFTER state for `TAG_ASSIGNMENT_UPDATED` activity-feed entries (`TagActivityHandlerImpl.java:41`)",
    "`TermServiceImpl` — calls `getOrCreateTagsByName` (`TermServiceImpl.java:257`) to attach tags to a term — making TERM creation a SECOND side-channel into the global Tag directory beyond the data-entity tag-assignment path"
  ]

## upstream_callers

- `TagServiceImpl` (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:32`) — primary caller; ten of the eleven repository methods are invoked here. Direct call sites: `bulkCreate` (`:40, 82`), `getDto` (`:47, 60`), `update` (`:52`), `delete` (`:66`), `listMostPopular` (`:75`), `deleteTermRelations(long)` (`:64`), `deleteDataEntityRelations(long)` (`:65`), `listByNames` (`:145`), `listDataEntityDtos` (`:119`), `listTagRelations` (`:101`), `createDataEntityRelations` (`:118`), `deleteDataEntityRelations(Collection)` (`:117`), `listByTerm` (`:126`), `deleteTermRelations(long, Collection)` (`:132`), `createTermRelations` (`:141`), `ingestData` (`:92`).
- `ExternalTagIngestionRequestProcessor` (`odd-platform-api/.../service/ingestion/processor/ExternalTagIngestionRequestProcessor.java:34`) — INGESTION pipeline (FINALIZING phase per `:53`); direct calls: `listTagRelations` (`:76`), `deleteDataEntityRelations(Collection)` (`:85`), `createDataEntityRelations` (`:88`), `listTagsRelations(EXTERNAL)` (`:108`), `deleteDatasetFieldRelations(List)` (`:115`), `createDatasetFieldRelations` (`:117`). Bypasses `TagServiceImpl` entirely for the dataset-entity side; uses `tagService.getOrInjectTagByName` instead for the upsert.
- `DatasetFieldServiceImpl` (`odd-platform-api/.../service/DatasetFieldServiceImpl.java`) — direct calls: `deleteDataEntityRelations(Collection)` (`:85`), `listTagsRelations(EXTERNAL)` (`:108`), `deleteDatasetFieldRelations` (`:115, 226`), `createDatasetFieldRelations` (`:117, 227`), `deleteDatasetFieldInternalRelations` (`:124`), `listDatasetFieldDtos` (`:129`), `listTagsRelations(INTERNAL)` (`:354`).
- `DataEntityServiceImpl` (`odd-platform-api/.../service/DataEntityServiceImpl.java:622`) — `listDataEntityDtos` for the per-entity detail-page assembly.
- `DataEntityPermissionExtractor` (`odd-platform-api/.../service/permission/extractor/DataEntityPermissionExtractor.java:67`) — `listDataEntityDtos` for `DataEntityPolicyResolverContext` — tags as Policy-evaluation input.
- `TagActivityHandlerImpl` (`odd-platform-api/.../service/activity/handler/TagActivityHandlerImpl.java:18, 41`) — `listDataEntityDtos` for BEFORE/AFTER activity-feed state capture.

## downstream_side_effects

- **DB writes to `tag` table** — `bulkCreate` (inherited, `ReactiveAbstractCRUDRepository.java:114-126` — INSERT with returning), `ingestData` (`ReactiveTagRepositoryImpl.java:191-213` — INSERT … ON CONFLICT … DO UPDATE), `update` (inherited, partial-update with `getNonUpdatableFields` filter), `delete` (inherited from `ReactiveAbstractSoftDeleteCRUDRepository.delete` — UPDATE setting `deleted_at = now()`).
- **DB writes to `tag_to_data_entity`** — `createDataEntityRelations` (`:259-264` INSERT … ON DUPLICATE KEY IGNORE), `deleteDataEntityRelations` x2 (HARD DELETE, `:227-229`, `:236-238`).
- **DB writes to `tag_to_dataset_field`** — `createDatasetFieldRelations` (`:359-370`), `deleteDatasetFieldRelations` x2 (`:290-295`, `:300-306`, `:309-323`), `deleteDatasetFieldInternalRelations` (`:289-296`).
- **DB writes to `tag_to_term`** — `createTermRelations` (`:336-346`), `deleteTermRelations` x2 (`:272-277`, `:280-286`).
- **Search-index side effects** — NONE in this class. The search vectors (`updateChangedTagVectors`, `updateChangedTagStructureVector`, `updateTagVectorsForDataEntity`) are owned by `ReactiveSearchEntrypointRepository` / `ReactiveTermSearchEntrypointRepository`; `TagServiceImpl` orchestrates the call chain.
- **Activity-feed side effects** — NONE in this class. `TagActivityHandlerImpl` reads via `listDataEntityDtos` for state-capture; the write to `activity` is in the activity subsystem.
- **External I/O** — NONE. Pure jOOQ/Postgres; no HTTP / S3 / SMTP / Slack / OTLP calls.
- **Transaction boundaries** — This class methods are NOT `@ReactiveTransactional`. They run within the caller's TX. `TagServiceImpl.updateRelationsWithDataEntity` (`:97`), `TagServiceImpl.delete` (`:58`), `TagServiceImpl.update` (`:45`), `TagServiceImpl.createRelationsWithTerm` (`:137`), and `ExternalTagIngestionRequestProcessor.process` (`:38`) all carry `@ReactiveTransactional` annotations — the repository acts as a TX participant, not a TX initiator. The inherited `bulkCreate` (`ReactiveAbstractCRUDRepository.java:113-126`) DOES carry `@ReactiveTransactional`, so direct invocations of `bulkCreate` (e.g., from `TagController.createTag` via `TagService.bulkCreate`) get an implicit TX.
- **Lock acquisition** — NONE. No `SELECT … FOR UPDATE`, no advisory locks, no explicit row-locking; the unique-index race in `ingestData` is mediated entirely by the partial unique constraint + `ON CONFLICT … DO UPDATE`.
- **Exception translation** — `JooqReactiveOperations.flux` / `.mono` invocations are wrapped in `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` (`JooqReactiveOperations.java:48`); a unique-index race on `tag.name` translates to `UniqueConstraintException("Tag with this name already exists")` (`ExceptionUtils.java:54-56`). However: this only fires for the `bulkCreate` path (which has no `onConflict` clause); the `ingestData` upsert SWALLOWS the race silently via `ON CONFLICT … DO UPDATE` and returns the existing row.

## dependencies_semantic

- requires-feature: [
    "Tag relation tables — `tag_to_data_entity` (added with `external` column in `V0_0_47__add_tag_external_attribute.sql:1`), `tag_to_dataset_field` (with `origin` TagOrigin enum column), `tag_to_term` — schema requirements anchored in the migration suite",
    "Tag soft-delete column — `tag.deleted_at` (`V0_0_64__remove_is_deleted_field.sql:96`); this class's CRUD inheritance depends on the column name being literally `deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:25` `private static final String DEFAULT_DELETED_AT_FIELD = \"deleted_at\"`)",
    "Tag partial unique index — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64__remove_is_deleted_field.sql:105`); the `ingestData` upsert pins to this index via `Indexes.TAG_NAME_UNIQUE.getFields()` (`:199-202`); the `WHERE TAG.DELETED_AT.isNull()` partial-index predicate is HARDCODED (`:207`)",
    "ExceptionUtils unique-constraint translation — `TAG_NAME_UNIQUE` is in the `formatMessage` cascade (`ExceptionUtils.java:54-56`); `bulkCreate` races translate to `UniqueConstraintException(\"Tag with this name already exists\")`",
    "TagOrigin enum — three values `INTERNAL | EXTERNAL | EXTERNAL_STATISTICS` (`TagOrigin.java:4-6`); only `INTERNAL` and `EXTERNAL` are referenced from this class (`:87` `boolOr(ORIGIN.eq(EXTERNAL))`; `:113` `ORIGIN.eq(origin.toString())`; `:292` `ORIGIN.eq(INTERNAL.toString())`; `:385` `ORIGIN.ne(INTERNAL.name())`); `EXTERNAL_STATISTICS` is referenced nowhere else in `odd-platform-api/main` either"
  ]
- requires-config: [] — N/A. Class reads no configuration; behaviour is unconditional.
- requires-runtime: [
    "Spring `@Repository`-managed bean — `@Repository` annotation at `:43`; `Spring` constructs via constructor injection (`:49-52`) passing `JooqReactiveOperations` + `JooqQueryHelper`",
    "jOOQ DSLContext (reactive) — via `JooqReactiveOperations.mono / .flux / .executeInPartitionReturning / .newRecord`",
    "Postgres — partial unique indexes, `boolOr`, `coalesce`, `count`, `sum`, `unionAll`, named CTE table `tag_cte` (`:150`), table-functions-in-CTE pattern",
    "`reactor-core` — `Mono` + `Flux` return shapes throughout; `Flux.just()` empty-flux short-circuits"
  ]
- couples-to: [
    "`ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (`extends` at `:44`) — inherits `delete(long)`, `delete(Collection)`, `idCondition`, `listCondition`, `addSoftDeleteFilter`, `getDeleteChangedFields`, `getNonUpdatableFields`",
    "`ReactiveTagRepository` (`implements` at `:45`) — 18 method contract (`ReactiveTagRepository.java:15-53`); 14 declared explicitly + 4 inherited from `ReactiveCRUDRepository<TagPojo>` (`get`, `list`, `create`, `update`, `bulkCreate`, `bulkUpdate`, `delete(long)`, `delete(Collection)`)",
    "`JooqReactiveOperations.executeInPartitionReturning` (`JooqReactiveOperations.java:69`) — partitions records at `BATCH_SIZE` (line 75-83); the `ingestData` upsert and the `insertManyReturning` inherited path use this. Implication: a >`BATCH_SIZE` upsert is split into multiple `INSERT … ON CONFLICT … DO UPDATE` statements via `Flux.concat`; each is a separate round-trip but all within the caller's TX.",
    "`Indexes.TAG_NAME_UNIQUE` (jOOQ-generated `org.opendatadiscovery.oddplatform.model.Indexes`) — the conflict-target handle; `getFields()` returns the `name` column",
    "`DateTimeUtil.generateNow()` (used at `:185` to stamp `updated_at` on bulk-upsert rows; identical pattern to inherited `bulkCreate`)",
    "Static jOOQ table imports (`:38-41`): `TAG`, `TAG_TO_DATASET_FIELD`, `TAG_TO_DATA_ENTITY`, `TAG_TO_TERM` — all generated from the live schema"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "Basic `create` round-trip (`testCreateTagPojo` at `TagRepositoryImplTest.java:30-44`) — asserts non-null id, name and important persisted",
    "Bulk create with all names present (`testBulkCreateTag` at `TagRepositoryImplTest.java:52-67`) — asserts every name persisted with id; uses 3 UUID-named tags",
    "`listByNames` returns the requested names (`testGetTagsByListNames` at `TagRepositoryImplTest.java:77-95`) — happy path, exact-name match, 3 tags",
    "`createDataEntityRelations` happy path with all tags (`testCreateRelationsWithDataEntity` at `:99-122`) — 3 tags, 3 relations, all tag ids present",
    "`createDataEntityRelations` with subset (`testCreateRelations_SomeTags` at `:126-148`) — 4 tags created, 2 related, asserts only 2 relations",
    "`createDataEntityRelations` with empty input (`testCreateRelationsIsEmpty` at `:152-160`) — asserts the `Flux.just()` short-circuit",
    "`deleteDataEntityRelations(Collection)` happy path (`testDeleteRelations` at `:164-190`) — 3 relations created + deleted, all tag ids present in delete result",
    "`deleteDataEntityRelations` with empty input (`testDeleteRelationsIsEmpty` at `:194-215`) — asserts the `Flux.just()` short-circuit even when the table has rows",
    "`update` happy path (`testUpdateTag` at `:219-235`) — change name, assert persisted",
    "`listMostPopular` happy path (`testListMostPopular` at `:239-267`) — 8 tags created, 4 renamed to `PopularName0..3`, asserts the page filters to the 4 popular ones"
  ]
- uncovered_behaviours: [
    "{
      \"behaviour\": \"`ingestData` upsert path — the bulk INSERT … ON CONFLICT … DO UPDATE upsert is not exercised in tests. The repository test only covers `bulkCreate` (no onConflict clause).\",
      \"test_class\": \"TagRepositoryImplTest (would add `testIngestData_InsertOnly`, `testIngestData_ConflictOnExistingName`, `testIngestData_MixedInsertAndConflict`, `testIngestData_PartitionedAcrossBatchSize`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Concurrent novel-name race — two parallel `ingestData` calls with overlapping names. The `ON CONFLICT … DO UPDATE` path SHOULD return both callers the same row, but the contract is not asserted.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testIngestData_ConcurrentNovelName_DoesNotThrow`, asserting both callers get the same `id` for the racing name) — race-condition test requires `StepVerifier` + parallel `Mono.zip`\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Concurrent `bulkCreate` race — two parallel `bulkCreate` with the same novel name. The expected outcome is `UniqueConstraintException` from one caller (via `ExceptionUtils.translateDatabaseException`); this is the `TagServiceImpl.getOrCreateTagsByName` TOCTOU surface.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testBulkCreate_ConcurrentDuplicateName_ThrowsUniqueConstraintException`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Case-sensitivity of `listByNames` — no test asserts that `Postgres` and `postgres` are returned as separate tags from `listByNames([\\\"Postgres\\\", \\\"postgres\\\"])`. This is the root cause of `TagServiceImpl.divideTagsByExistence` treating case-only-different names as novel — silently creating two Tag rows where the UI may render either case-folded.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListByNames_CaseSensitiveExactMatch`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Soft-delete bypass in `listByNames` — no test asserts that a soft-deleted tag (one with `deleted_at = now()`) is filtered out by `listByNames`. The `addSoftDeleteFilter` is wired in, but the test corpus does not exercise it for this specific method.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListByNames_FiltersSoftDeletedTags`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Reinsertion of a soft-deleted name — no test asserts that creating a Tag with the same name as a soft-deleted Tag succeeds (the partial unique index permits it). This is the auto-create resurrection corner case: if an operator deletes `PII` and a per-data-entity user submits `PII` via `DATA_ENTITY_TAGS_UPDATE`, a new Tag row is minted with a DIFFERENT id; prior `tag_to_data_entity` rows that were hard-deleted are not restored.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testCreate_AfterSoftDelete_SameNameSucceeds_DifferentId`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`getDto` for a soft-deleted tag — no test asserts that `getDto(deletedTagId)` returns `Mono.empty()`. The `idCondition` override should filter, but is not asserted for this method shape.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testGetDto_SoftDeletedTag_ReturnsEmpty`)\",
      \"severity\": \"LOW\"
    }",
    "{
      \"behaviour\": \"`listMostPopular` with `tag_to_dataset_field` usage — `testListMostPopular` only creates `tag` rows (no relations). The CTE's UNION-ALL of `tag_to_data_entity` + `tag_to_dataset_field` usage counts is not asserted; the `count` field could be silently zero for tags only used on dataset fields.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListMostPopular_TagsOnlyOnDatasetFields_RankedByUsage`, `testListMostPopular_TagsOnBothEntitiesAndFields_CountSummed`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listTagsRelations` filter by `TagOrigin` enum — no test asserts that passing `INTERNAL` vs `EXTERNAL` filters correctly; the schema-version-copy path in `DatasetFieldServiceImpl.copyInternalTagsToNewFieldVersion` depends on this filter to avoid duplicating EXTERNAL relations across versions.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListTagsRelations_FilterByOrigin`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listMostPopular` pagination — `testListMostPopular` uses page=1, size=numberOfTestTags (no page boundary); no test asserts that page=2 returns the next slice, that `total` is consistent across pages, or that an out-of-bounds page returns an empty page.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListMostPopular_Pagination`)\",
      \"severity\": \"LOW\"
    }",
    "{
      \"behaviour\": \"Tag-name length / charset / pattern — no test exercises empty strings, whitespace-only strings, very long names (no DB column constraint per migrations grep), or control-character names. The corresponding service-layer concern is REFACTOR-223's bounded-DoS angle.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testCreate_EmptyName`, `testCreate_WhitespaceName`, `testCreate_VeryLongName`, `testCreate_ControlCharacters`) — or a dedicated `TagValidationTest`\",
      \"severity\": \"LOW\"
    }"
  ]
- test_files: [
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java` (`extends BaseIntegrationTest` — Testcontainers-Postgres integration test; 10 tests covering basic CRUD + relation create/delete + popularity ranking; no `ingestData` test, no race-condition test, no soft-delete test)"
  ]
- gaps: |
    Where would a regression most likely land that the current tests would miss?
    
    1. **`ingestData` upsert path** — the most consequential method (every Collector-pushed tag flows here) is the LEAST covered. A regression in `Indexes.TAG_NAME_UNIQUE.getFields()` resolution, in the `WHERE TAG.DELETED_AT.isNull()` partial-index predicate matching, or in the `DSL.excluded(TAG.NAME)` RETURNING-trigger pattern would silently break ingestion-side tag relations. The unit test for this is one StepVerifier test away.
    
    2. **Auto-create-on-miss TOCTOU between `listByNames` and `bulkCreate`** — REFACTOR-223 lives at the *service* layer (`TagServiceImpl.getOrCreateTagsByName` reads-then-creates without a TX-internal lock; concurrent callers can both see the row as missing and both attempt to insert). The DB protects via `tag_name_unique`, so one caller wins and the other gets `UniqueConstraintException`. The race is real but the loser-handling path (caller sees `UniqueConstraintException`, retries `listByNames`, finds the row?) is NOT tested anywhere in the repository or the service test corpus. The auto-create-on-miss UX would surface a user-visible 500 on the second caller in the race.
    
    3. **Soft-delete resurrection** — the partial unique index permits re-creating a Tag with a previously-soft-deleted name; the `tag_to_*` relations are HARD-deleted in `TagServiceImpl.delete` before the soft-delete; therefore a re-created Tag has a DIFFERENT id and ZERO relations. This is correct behaviour but is not tested; an accidental change to the partial-index predicate (or to `TagServiceImpl.delete` ordering) could either let resurrection block forever or silently rewire orphaned `tag_to_*` rows to a new id.
    
    4. **`listMostPopular` UNION-ALL** — `testListMostPopular` covers only the `tag_to_data_entity` arm of the union. The `tag_to_dataset_field` arm (about half the popularity computation) is uncovered; a regression that, say, broke the `boolOr(ORIGIN.ne(INTERNAL.name()))` external-aggregate (`:385`) would silently mis-tag dataset-field-only tags as INTERNAL.
    
    5. **TagOrigin filter in `listTagsRelations`** — `DatasetFieldServiceImpl.copyInternalTagsToNewFieldVersion` (`:354`) depends on the `INTERNAL`-only filter to avoid duplicating EXTERNAL relations across schema versions during a re-ingestion. No repository test asserts the origin-filter semantics; a regression here would either lose internal tags on schema diff or duplicate external relations.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: "#applying-tags"
    rationale: "Live doc page describing the operator-facing Tag UX — 'create new tag inline' is the doc-side description of the auto-create-on-miss path this repository implements via `bulkCreate` (called from `TagServiceImpl.getOrCreateTagsByName`). The page documents `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` permissions; it does NOT mention `DATA_ENTITY_TAGS_UPDATE` as a second write path into the directory."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch summary 2026-05-19, status 200): "Three role-based permissions govern tag management: TAG_CREATE — 'Create a new tag in the catalog vocabulary'; TAG_UPDATE — Edit tag names or Important flag status; TAG_DELETE — Remove tags from vocabulary. Additionally, a TAG_ASSIGNMENT_UPDATED activity event tracks when tag assignments change on entities." Live-page also describes the apply-flow as "opening an entity detail surface and selecting from existing vocabulary or creating new labels on the spot" — the live-side acknowledgment of the auto-create UX without the permission-asymmetry framing.
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names both TAG_CREATE (MANAGEMENT scope) and DATA_ENTITY_TAGS_UPDATE (DATA_ENTITY scope) but does NOT name the side-channel where DATA_ENTITY_TAGS_UPDATE can grow the directory."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch summary 2026-05-19, status 200): "Management Permissions: TAG_CREATE: 'Allows creating a new tag.' TAG_UPDATE: 'Allows editing an existing tag.' TAG_DELETE: 'Allows deleting a tag.' Data Entity Permissions: DATA_ENTITY_TAGS_UPDATE: 'Allows editing a data entity's tags.' The documentation does not contain information about tag scope, side-channel functionality, or auto-create features."
    confidence: HIGH
- doc_drift_findings:
  - "The tagging doc page describes 'creating new labels on the spot' (live-page summary 2026-05-19) but does not state the consequence: any user with `DATA_ENTITY_TAGS_UPDATE` on a single data entity can mint a new row in the global `tag` directory visible to every other user via `GET /api/tags/popular`. The repository's `ingestData` upsert + the inherited `bulkCreate` are the actual write paths; the permissions page lists `TAG_CREATE` and `DATA_ENTITY_TAGS_UPDATE` separately without naming the second as a directory-write surface. REFACTOR-223 captures this gap."
  - "The doc page does not document case-sensitivity of tag names. `listByNames` is case-SENSITIVE (`TAG.NAME.in(names)` translates to a case-sensitive `IN`), and so `TagServiceImpl.divideTagsByExistence` treats `Postgres` and `postgres` as distinct novel names. The doc says nothing — operators have no way to know whether `PII` and `pii` collapse or fork. (Test gap + doc gap.)"

## implicit_adrs

- "Partial-unique-index-as-race-protection — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` is the platform's only locking mechanism for the auto-create-on-miss path. The `ingestData` upsert (`:204-210`) leans on `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` to make concurrent novel-name inserts idempotent without an application-level lock; the same mechanism does NOT protect the `bulkCreate` path used by `TagServiceImpl.getOrCreateTagsByName` (no `onConflict` clause inherited). Three migrations (`V0_0_36`, `V0_0_57`, `V0_0_64`) iterated on this index — a deliberate design choice and the load-bearing protection." — evidence: ReactiveTagRepositoryImpl.java:199-210 + V0_0_36__refactor_unique_index.sql:4 + V0_0_57__change_tag_unique_constraint_semantics.sql:3 + V0_0_64__remove_is_deleted_field.sql:103-105 — intent_anchor: "`DROP INDEX IF EXISTS tag_name_unique; CREATE UNIQUE INDEX IF NOT EXISTS tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL;` (V0_0_64:103-105) — the explicit re-creation after the `is_deleted` column removal is the maintainer-authored statement that the partial filter is the protection" — confidence: HIGH

- "Conflict-target is computed from `Indexes.TAG_NAME_UNIQUE.getFields()` rather than hardcoded `TAG.NAME` — `ingestData` dynamically resolves the conflict fields (`:199-202`) from the jOOQ-generated index handle. A migration that changes the index to `(name, namespace_id)` (for example, to add namespace-scoped tags) would automatically propagate to the upsert. By contrast, the `WHERE TAG.DELETED_AT.isNull()` predicate is hardcoded (`:207`) — index-shape changes propagate, predicate-shape changes do NOT. This is a structural choice favouring shape-evolution-friendly conflict targets at the cost of predicate-evolution coupling." — evidence: ReactiveTagRepositoryImpl.java:199-207 — intent_anchor: "`final List<Field<Object>> conflictFields = Indexes.TAG_NAME_UNIQUE.getFields().stream().map(of -> field(of.getName())).toList();` (`:199-202`) — explicit dynamic resolution rather than `TAG.NAME` literal" — confidence: HIGH

- "RETURNING-trigger via no-op `DO UPDATE SET name = EXCLUDED.name` — the upsert sets the conflicting row's name to itself (`DSL.excluded(TAG.NAME)` at `:209`). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op update exists solely to trigger the RETURNING clause. The caller (`TagServiceImpl.getOrInjectTagByName`) needs the id of every row (existing or newly inserted) to build `TagToDataEntityPojo` relations. This is a deliberate trade-off: a per-row touch on every ingestion-time conflict in exchange for caller convenience." — evidence: ReactiveTagRepositoryImpl.java:204-210 + TagServiceImpl.java:88-94 — intent_anchor: "`.doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME)).returning()` (`:208-210`) — name set to itself is the diagnostic" — confidence: HIGH

- "Soft-delete on `tag`, hard-delete on `tag_to_*` relations — the class extends `ReactiveAbstractSoftDeleteCRUDRepository` for the `tag` table (delete = `UPDATE … SET deleted_at = now()` per `ReactiveAbstractSoftDeleteCRUDRepository.java:51-58`), but every `delete*Relations` method here uses `DSL.delete(...)` (hard delete). The soft-delete intent is for the tag DIRECTORY entry (audit + uniqueness handling); relation rows have no audit semantics and are immediately removed. This is consistent across all four relation tables — a deliberate asymmetry, not an oversight." — evidence: ReactiveTagRepositoryImpl.java:217-323 (six hard-delete methods) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74 (soft-delete inheritance) — intent_anchor: "Class declaration: `extends ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (`:44`) for the tag table; explicit `DSL.delete(TAG_TO_DATA_ENTITY)` / `DSL.delete(TAG_TO_DATASET_FIELD)` / `DSL.deleteFrom(TAG_TO_TERM)` for relations — the asymmetric base-class choice is the architectural statement" — confidence: HIGH

- "`onDuplicateKeyIgnore` for relation creates — `createDataEntityRelations` / `createDatasetFieldRelations` / `createTermRelations` all use `onDuplicateKeyIgnore()` (`:261, 344, 367`). This makes relation-create idempotent: a second call with the same `(tag_id, data_entity_id)` pair is a no-op rather than a unique-constraint error. The semantic is 'attach tag if not already attached' rather than 'add a new attachment'. Consistent with replace-all diff in `TagServiceImpl.updateRelationsWithDataEntity`." — evidence: ReactiveTagRepositoryImpl.java:261, 344, 367 — intent_anchor: "`.onDuplicateKeyIgnore()` repeated three times across the relation-create methods — the consistency is the diagnostic" — confidence: HIGH

- "`bulkCreate` is the ONE create path that does NOT use `onConflict` — the inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`) has no `onConflict` clause; it relies on `ExceptionUtils.translateDatabaseException` to surface the `UniqueConstraintException` to the caller. This is the DIFFERENT contract from `ingestData` — `bulkCreate` is a fail-on-duplicate operation, `ingestData` is an upsert. Both exist intentionally because `TagController.createTag` (operator-explicit creation gated by `TAG_CREATE`) MUST fail on duplicate to surface the error to the user, while ingestion-side calls (the Collector pushing entity data with associated tags) MUST not fail because a tag with the same name was added moments earlier by a parallel pipeline." — evidence: ReactiveAbstractCRUDRepository.java:113-126 + ReactiveTagRepositoryImpl.java:191-213 + TagController.java:23-28 — intent_anchor: "Two distinct repository methods (`bulkCreate` inherited, `ingestData` declared) with different conflict semantics — the dual-method design is the architectural choice" — confidence: HIGH

## bugs_limitations_corner_cases

- "TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` — the service calls `listByNames(tagNames)` (`TagServiceImpl.java:145`) to filter existing names, then `bulkCreate(tagsToCreate)` (`:82`) for the remainder. Between these two reactor stages, another caller can insert the same novel name. The TX wraps both calls (`TagServiceImpl.updateRelationsWithDataEntity` is `@ReactiveTransactional` at `:97`), but in PostgreSQL's READ COMMITTED isolation (the default for Postgres + jOOQ-Reactive), the `listByNames` snapshot does NOT see uncommitted INSERTs from a concurrent TX, so the second caller will attempt `bulkCreate` with the now-conflicting name, hit `tag_name_unique`, and receive `UniqueConstraintException(\"Tag with this name already exists\")`. The user sees a 500-level error on a normal-looking PUT request. There is no caller-side retry of `listByNames` after the conflict. The `ingestData` upsert path is safe; the `bulkCreate` path is not. — evidence: TagServiceImpl.java:80-86 + TagServiceImpl.java:144-159 + ReactiveAbstractCRUDRepository.java:113-126 + ExceptionUtils.java:30-36, 54-56 — severity: HIGH"

- "Case-sensitive `listByNames` enables silent duplicate Tag rows via case variation — `listByNames` (`:120-125`) uses `TAG.NAME.in(names)` which translates to a case-sensitive SQL `IN`. `TagServiceImpl.divideTagsByExistence` (`:144-159`) calls `listByNames` then `existingTagNames.contains(n)` — also case-sensitive. A caller submitting `tag_name_list: ['PII']` against a directory that already contains `pii` will see `pii` as missing and mint a fresh `PII` row. The `tag_name_unique` partial index is also case-sensitive (PostgreSQL `text` column default), so both rows coexist. UI tag-dropdown renders both. Two operators looking for `pii` may apply different rows, fragmenting the search facet. There is no normalization layer. — evidence: ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + V0_0_64__remove_is_deleted_field.sql:105 — severity: MEDIUM"

- "Tag-name validation absent in repository AND in service AND in OpenAPI — `ingestData`, `bulkCreate`, and the inherited `create` all accept arbitrary `TagPojo.name: String` content. The PostgreSQL `tag.name` column has no `CHECK` constraint visible in any migration (no `length(name) BETWEEN` / no `name ~ '[A-Za-z0-9_-]+'`). The OpenAPI schema declares `type: string` only. Repository-layer consequences: an operator with `DATA_ENTITY_TAGS_UPDATE` can mint Tag rows with names of arbitrary length (per `TextDataType`-bound size), with newline / control characters, or whitespace-only. The popular-tags query (`listMostPopular`) returns these to every other user. REFACTOR-223 captures the DoS-shaped concern. — evidence: ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + (no validation in migration suite) — severity: MEDIUM"

- "`listMostPopular` is globally-scoped — no per-data-entity, per-owner, per-namespace, per-tenant filter. The `listCondition(query)` inherited filter is name-substring only. Any caller able to reach `GET /api/tags/popular` (every authenticated user under LOGIN_FORM/OAUTH2/LDAP; anonymous under DISABLED) sees every tag in the directory. Combined with the side-door write path (REFACTOR-223), a per-data-entity-owner can populate the popular-tags surface for ALL users. The repository has no native scoping concept — the `tag` directory is the unit of tenancy, and there is no concept of tenant. — evidence: ReactiveTagRepositoryImpl.java:137-167 + TagController.java:36-44 — severity: MEDIUM"

- "Resurrection of soft-deleted Tag does NOT restore relations — `TagServiceImpl.delete` (`:64-66`) sequence is `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` (BOTH HARD DELETES via this class's `:236-241` / `:280-286`), then `delete(tagId)` (soft-delete). Subsequent `bulkCreate(new TagPojo().setName(name))` with the same name succeeds (partial index permits it) but gets a NEW `id`. The `tag_to_*` rows that referenced the old id are gone. There is no maintainer-visible audit of this — a Tag silently deleted then recreated loses ALL its prior assignment history. — evidence: TagServiceImpl.java:58-70 + ReactiveTagRepositoryImpl.java:227-241, 272-286 + V0_0_64__remove_is_deleted_field.sql:105 (partial-index allows reuse) — severity: LOW"

- "Empty-batch contract differs between `ingestData` and the inherited `bulkCreate` — `ingestData` short-circuits on empty (`:181-183`); `bulkCreate` ALSO short-circuits (`ReactiveAbstractCRUDRepository.java:115-117`). However: jOOQ does not accept zero-record INSERT statements, so the empty-batch guard is load-bearing. A future change to remove the guard (perhaps believing jOOQ would handle it) would produce a runtime SQL error on every empty bulk call. The contract is not documented at the interface; only the duplication across both implementations encodes the constraint. — evidence: ReactiveTagRepositoryImpl.java:181-183 + ReactiveAbstractCRUDRepository.java:115-117 — severity: LOW"

- "`listTagsRelations(datasetFieldIds, origin=null)` path is implicit — the method (`:101-117`) accepts a null origin and skips the origin filter (`if (origin != null) { query = query.and(...) }`). Callers that pass `null` get ALL origins (INTERNAL + EXTERNAL + EXTERNAL_STATISTICS). There is no current caller that passes null (every caller specifies EXTERNAL or INTERNAL explicitly per the grep), but the contract is not documented and the inverse-of-EXTERNAL semantic (returning INTERNAL + EXTERNAL_STATISTICS) is not consumer-discoverable from the method shape. — evidence: ReactiveTagRepositoryImpl.java:101-117 + grep on `listTagsRelations` callers — severity: LOW"

- "`getDataEntityWithDatasetFields` CTE name collision — the CTE built at `:373-392` is named `'tag_cte'` (`:150`); the CTE's body is the paginated tag select; the union-all body references `TAG_TO_DATA_ENTITY` and `TAG_TO_DATASET_FIELD` joined back to the CTE. The CTE name is hardcoded; if two listMostPopular queries were composed (e.g., as subqueries of a parent), the inner CTE would collide. No current caller composes them. Defensible at this scope, but the hardcoded name is brittle. — evidence: ReactiveTagRepositoryImpl.java:150, 373-392 — severity: LOW"

- "`getDataEntityWithDatasetFields` external-aggregate divergence — the dataset-entity arm uses `boolOr(TAG_TO_DATA_ENTITY.EXTERNAL)` (boolean column); the dataset-field arm uses `boolOr(TAG_TO_DATASET_FIELD.ORIGIN.ne(TagOrigin.INTERNAL.name()))` (`:385`). The semantic 'is this tag used externally' is computed differently across the two relation tables — `EXTERNAL_STATISTICS` is folded into 'external' on the dataset-field side because `ne(INTERNAL)` includes it, but is folded into 'external' on the dataset-entity side ONLY if the boolean column was set. The result: a tag used only on dataset fields via `EXTERNAL_STATISTICS` will report `external = true` from `listMostPopular`, but the same tag's dataset-entity usage with `external = false` would still aggregate correctly. The divergence is intentional but not asserted in tests. — evidence: ReactiveTagRepositoryImpl.java:373-391 — severity: LOW"

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — repository runs inside the platform process and has no HTTP surface. The methods are reached through `TagService` (REST) and `ExternalTagIngestionRequestProcessor` (S2S ingestion); auth-mode coupling is at those upstream layers (DISABLED / LOGIN_FORM / OAUTH2 / LDAP for the UI path; `auth.s2s.enabled` for ingestion).
- **ingestion_filter_relevance**: `NO — repository internals, but DOWNSTREAM of the IngestionDataEntitiesFilter on the ingestion path`. When `ExternalTagIngestionRequestProcessor` writes via this repository, the request has already been filter-gated (`auth.ingestion.filter.enabled`); when `TagServiceImpl` writes via this repository, it's on a UI path that uses different auth.
- **authorization_assertions**: `[]` — repository performs zero authorization checks. The class trusts the caller to have already evaluated permissions. The 18 method contract surfaces would, if mistakenly invoked from an unauthorised path, write directly to the `tag` directory or the relation tables with no native defence. The architectural assumption is that `SecurityConstants.SECURITY_RULES` covers every controller path that reaches here.
- **owner_scoping**: `N/A — Tag directory has no owner concept`. There is no `tag.owner_id` column, no per-Owner Tag filtering anywhere in this class. `listMostPopular` and `listByNames` return globally. The Tag directory is a flat, globally-shared namespace by design; the side-door write surface (REFACTOR-223) compounds this.
- **data_exposure**:
  - "`Flux<TagPojo>` from `listByNames(['*'])` / `listByTerm(termId)` → ANY caller able to reach the upstream service method. The repository emits the full tag-row payload (id, name, important, created_at, updated_at, deleted_at) with no filtering."
  - "`Mono<TagDto>` / `Mono<List<TagDto>>` from `getDto` / `listDataEntityDtos` / `listDatasetFieldDtos` → repository returns aggregate usage count + external flag; usage counts across the global directory are derivable by enumerating data-entity ids. No per-tenant masking."
  - "`Mono<Page<TagDto>>` from `listMostPopular` → globally-ordered popular tags; any operator-generated tag (via the side-door of REFACTOR-223) immediately surfaces here for every other user. — evidence: `ReactiveTagRepositoryImpl.java:137-167`"
- **known_security_gaps**:
  - "Repository emits NO audit log on writes — `ingestData`, `bulkCreate` (inherited), `delete` (inherited soft-delete), and every `create*Relations` / `delete*Relations` method writes to a relation or directory table with NO repository-side activity event. The `TAG_ASSIGNMENT_UPDATED` activity event is emitted by the UPSTREAM service layer (`DataEntityServiceImpl.upsertTags` with `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)`). The ingestion-side path (`ExternalTagIngestionRequestProcessor`) writes via this repository directly and produces NO activity-feed entry. — evidence: ReactiveTagRepositoryImpl.java:179-371 (no `@ActivityLog`) + ExternalTagIngestionRequestProcessor.java:34-44 (no `@ActivityLog`) — severity: MEDIUM"
  - "Repository performs no name normalization, no length limit, no charset filter — the auto-create surface is wide-open for novel-name pollution (REFACTOR-223 DoS angle). A malicious caller with `DATA_ENTITY_TAGS_UPDATE` on a single data entity can mint thousands of garbage tag rows visible to every other user. — evidence: ReactiveTagRepositoryImpl.java:179-215 (no normalization) + (no migration-level CHECK constraint) — severity: MEDIUM"
  - "The hardcoded `WHERE TAG.DELETED_AT.isNull()` in the upsert's conflict predicate (`:207`) couples the repository's correctness to the partial-index predicate remaining `deleted_at IS NULL`. A future migration that broadens the predicate (e.g., to `deleted_at IS NULL AND important IS NOT NULL`) without updating this hardcoded clause would silently break the upsert — the `ON CONFLICT` would not match and PostgreSQL would raise a unique-violation that translates to `UniqueConstraintException` on every Collector push. — evidence: ReactiveTagRepositoryImpl.java:206-207 + V0_0_64__remove_is_deleted_field.sql:105 — severity: LOW"

## performance

- **hot_paths**:
  - "`ingestData` runs once per Collector batch per Tag set — the FINALIZING phase of `IngestionService` calls `ExternalTagIngestionRequestProcessor.process` once per request, which calls `tagService.getOrInjectTagByName` which calls `ingestData` with the full novel-tag set of the batch. The upsert is then partitioned by `executeInPartitionReturning` at `BATCH_SIZE`. — evidence: ReactiveTagRepositoryImpl.java:179-215 + ExternalTagIngestionRequestProcessor.java:71-72 + JooqReactiveOperations.java:69-84"
  - "`listMostPopular` runs once per `GET /api/tags/popular` call (page load + tag-dropdown surfaces) — uses a non-trivial UNION-ALL CTE across two relation tables with per-tag aggregates; no index hint is provided. Hot path for the Catalog Overview + tag-search-facet rendering. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392"
  - "`listDataEntityDtos(dataEntityId)` runs on EVERY data-entity detail page load (called by `DataEntityServiceImpl.java:622` + `DataEntityPermissionExtractor.java:67` + `TagActivityHandlerImpl.java:41`) — triple-call shape because the same data entity's tag list is materialised three times in different paths during a single request. No upstream caching. — evidence: ReactiveTagRepositoryImpl.java:68-81 + the three callers"
- **throughput_characteristics**:
  - "All write methods are reactive `Flux` / `Mono` — non-blocking; the underlying jOOQ-reactive PG driver releases the connection between awaits. No thread is held during DB round-trip."
  - "`executeInPartitionReturning` (used by `ingestData` and inherited `insertManyReturning`) partitions at `BATCH_SIZE` and concatenates the per-partition `Flux`es — `Flux.concat` is sequential, not parallel; a 5000-row upsert at `BATCH_SIZE=1000` is 5 sequential round-trips in the caller's TX. — evidence: JooqReactiveOperations.java:69-84"
  - "Relation-create methods build ONE INSERT … VALUES (…), (…), …, (…) statement per call (the `.set(...).newRecord()` loop chains into a single INSERT). No partitioning unless the batch exceeds `BATCH_SIZE` (and the relation methods don't call `executeInPartition*` — `createDataEntityRelations` directly builds the INSERT). For 10K+ relations in one call, the statement size grows linearly; no automatic chunking. — evidence: ReactiveTagRepositoryImpl.java:244-264, 326-347, 350-371"
- **resource_allocation**:
  - "Memory: per-call allocations are small for normal use (a few tags). `listMostPopular` materialises the `Flux<...>` to a `List<...>` via `.collectList()` for `pageifyResult` (`:162-166`) — for the popular-tags surface, the full result set is in memory simultaneously. Page-size is caller-controlled."
  - "DB connection: each method takes one connection per round-trip via `JooqReactiveOperations`; no connection pinning across the upsert + RETURNING."
  - "No client-side caching — every `listByNames` / `listMostPopular` is a fresh round-trip. The popular-tags surface refreshes from DB on every UI page load."
- **scaling_characteristics**:
  - "Stateless — repository instance has no per-call state; horizontal scaling unconstrained."
  - "No row-level locking — the auto-create-on-miss path's race is mediated by the partial unique index, NOT by `SELECT … FOR UPDATE`. Under high concurrency, racers receive `UniqueConstraintException` (for `bulkCreate`) or silently merge to the existing row (for `ingestData`)."
  - "`listMostPopular` has no pagination cap — `size` parameter is passed through verbatim to `paginate(...)`; an attacker submitting `size=100000` would force a full-directory aggregate. — evidence: ReactiveTagRepositoryImpl.java:138-167"
- **known_performance_gaps**:
  - "Triple-fetch of the same `listDataEntityDtos` payload during one request — `DataEntityServiceImpl.java:622` (detail-page assembly) + `DataEntityPermissionExtractor.java:67` (policy evaluation) + `TagActivityHandlerImpl.java:41` (activity-feed state) all call `tagRepository.listDataEntityDtos(dataEntityId)` for the same data entity during a single HTTP request. No request-scoped cache. — evidence: ReactiveTagRepositoryImpl.java:68-81 + three caller line refs — severity: LOW"
  - "`listMostPopular` UNION-ALL CTE runs on every popular-tags fetch — for very large directories, the per-tag UNION-ALL across `tag_to_data_entity` + `tag_to_dataset_field` is expensive. No materialized view; no `pg_stat_statements`-visible caching. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 — severity: LOW"
  - "No `EXPLAIN`-anchored benchmark in the test suite — the integration tests assert correctness, not query cost. A regression that pushes `listMostPopular` from `< 50ms` to `5s` would not surface in CI. — evidence: TagRepositoryImplTest.java:239-267 (correctness-only assertion) — severity: LOW"

## feature_hint

- pillar_id: P-01 (Data Discovery)
- sub_feature: Manual Object Tagging — the Tag directory IS the substrate of the tag facet, the Top-tags chip strip, and the per-entity tag rendering across Discovery.
- drift_class_facets:
  - REFACTOR-223 (Tag side-door — `DATA_ENTITY_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`) — repository-side substrate at `ingestData` + inherited `bulkCreate`
  - TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` (NEW — not yet a REFACTOR-NNN; would be filed under SEC-NNN authorization-audit OR an availability-shaped TOCTOU-cluster)
  - Case-sensitivity divergence between `listByNames` (exact, case-sensitive) and `listMostPopular`'s `query` (case-insensitive substring) — UX/data-integrity drift, not currently REFACTOR-tracked
  - Audit-log absence on the ingestion-side tag mutation path — `ExternalTagIngestionRequestProcessor` writes to relation tables with no activity-feed entry — extends the existing "Audit-log Presence Asymmetry" canonicalisation candidate in system-mission.md to the ingestion-side path
  - Cross-feature pattern: auto-create-on-miss family across Tag + Owner + Title + Term — REFACTOR-199 (Owner) + REFACTOR-206 (Title) + REFACTOR-223 (Tag, this repository's substrate); the family is suggested for grouping as a "SEC-NNN authorization-audit sprint" per REFACTOR-223
- cross_pillar_relationships: P-01 → P-10 (Tag directory grown by Collector pushes via `ExternalTagIngestionRequestProcessor`); P-01 → P-09 (Tag mutations gated by `TAG_CREATE` for the dedicated route + `DATA_ENTITY_TAGS_UPDATE` for the side-door; both bypass at the repository layer because there's no in-repository check); P-01 → P-07 (Tag mutations on the data-entity path emit `TAG_ASSIGNMENT_UPDATED` activity events upstream; the ingestion path does not)

## sources

- understanding ← ReactiveTagRepositoryImpl.java:1-401 (full file)
- concepts.entities.TagPojo ← ReactiveTagRepositoryImpl.java:20 (import) + V0_0_64__remove_is_deleted_field.sql:95-108 (column shape)
- concepts.entities.TagDto ← TagDto.java:5 + ReactiveTagRepositoryImpl.java:394-400 (`mapTag` projection)
- concepts.entities.TagToDataEntityPojo ← ReactiveTagRepositoryImpl.java:21 + V0_0_47__add_tag_external_attribute.sql:1
- concepts.entities.TagToDatasetFieldPojo ← ReactiveTagRepositoryImpl.java:22 + TagOrigin.java:3-7
- concepts.entities.TagToTermPojo ← ReactiveTagRepositoryImpl.java:23
- concepts.entities.Indexes.TAG_NAME_UNIQUE ← ReactiveTagRepositoryImpl.java:19, 199 + V0_0_36__refactor_unique_index.sql:4 + V0_0_57__change_tag_unique_constraint_semantics.sql:3 + V0_0_64__remove_is_deleted_field.sql:103-105
- concepts.operations ← ReactiveTagRepositoryImpl.java:54-401 (every method body)
- concepts.invariants[0] (soft-delete via deleted_at) ← V0_0_36__refactor_unique_index.sql:4 → V0_0_57__change_tag_unique_constraint_semantics.sql:3 → V0_0_64__remove_is_deleted_field.sql:95-108 + ReactiveAbstractSoftDeleteCRUDRepository.java:25, 51-58
- concepts.invariants[1] (partial unique index) ← V0_0_64__remove_is_deleted_field.sql:103-105 + ReactiveTagRepositoryImpl.java:199-207
- concepts.invariants[2] (case sensitivity) ← ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + ReactiveAbstractCRUDRepository.java:242-243 (`nameField.containsIgnoreCase(nameQuery)`)
- concepts.invariants[3] (dynamic conflict-target via Indexes.TAG_NAME_UNIQUE.getFields()) ← ReactiveTagRepositoryImpl.java:199-207
- concepts.invariants[4] (RETURNING-trigger no-op) ← ReactiveTagRepositoryImpl.java:204-210
- concepts.invariants[5] (`onDuplicateKeyIgnore` for relations) ← ReactiveTagRepositoryImpl.java:261, 344, 367
- concepts.invariants[6] (empty-batch guards) ← ReactiveTagRepositoryImpl.java:103-105, 181-183, 219-221, 246-248, 267-270, 310-312, 327-329 + ReactiveAbstractCRUDRepository.java:115-117
- concepts.invariants[7] (hard-delete relations) ← ReactiveTagRepositoryImpl.java:227-241, 272-286, 290-323
- concepts.audiences ← Grep result `reactiveTagRepository|ReactiveTagRepository` filtered to callers
- upstream_callers.TagServiceImpl ← TagServiceImpl.java:32, 40, 47, 52, 60, 64-66, 75, 82, 92, 101, 117, 118, 119, 126, 132, 141, 145
- upstream_callers.ExternalTagIngestionRequestProcessor ← ExternalTagIngestionRequestProcessor.java:34, 76, 85, 88, 108, 115, 117
- upstream_callers.DatasetFieldServiceImpl ← DatasetFieldServiceImpl.java:85, 108, 115, 117, 124, 129, 226, 227, 354
- upstream_callers.DataEntityServiceImpl ← DataEntityServiceImpl.java:622
- upstream_callers.DataEntityPermissionExtractor ← DataEntityPermissionExtractor.java:67
- upstream_callers.TagActivityHandlerImpl ← TagActivityHandlerImpl.java:18, 41
- downstream_side_effects.DB writes ← ReactiveTagRepositoryImpl.java:54-401 (every write path)
- downstream_side_effects.transaction boundaries ← ReactiveTagRepositoryImpl.java:1-401 (no @ReactiveTransactional anywhere) + TagServiceImpl.java:45, 58, 97, 137 + ExternalTagIngestionRequestProcessor.java:38 + ReactiveAbstractCRUDRepository.java:113-114
- downstream_side_effects.exception translation ← JooqReactiveOperations.java:47-48 (commented evidence) + ExceptionUtils.java:30-36, 54-56
- dependencies_semantic.requires-feature[relation tables] ← V0_0_47__add_tag_external_attribute.sql:1 + grep result `tag_to_*` migrations
- dependencies_semantic.requires-feature[soft-delete column] ← V0_0_64__remove_is_deleted_field.sql:95-108 + ReactiveAbstractSoftDeleteCRUDRepository.java:25
- dependencies_semantic.requires-feature[partial unique index] ← V0_0_64__remove_is_deleted_field.sql:103-105
- dependencies_semantic.requires-feature[ExceptionUtils translation] ← ExceptionUtils.java:20, 54-56
- dependencies_semantic.requires-feature[TagOrigin enum] ← TagOrigin.java + ReactiveTagRepositoryImpl.java:87, 113, 292, 385
- dependencies_semantic.couples-to[ReactiveAbstractSoftDeleteCRUDRepository] ← ReactiveTagRepositoryImpl.java:44 + ReactiveAbstractSoftDeleteCRUDRepository.java:22-118
- dependencies_semantic.couples-to[ReactiveTagRepository interface] ← ReactiveTagRepository.java:15-53
- dependencies_semantic.couples-to[executeInPartitionReturning] ← JooqReactiveOperations.java:69-84
- dependencies_semantic.couples-to[Indexes.TAG_NAME_UNIQUE] ← ReactiveTagRepositoryImpl.java:199 + ExceptionUtils.java:20
- dependencies_semantic.couples-to[DateTimeUtil] ← ReactiveTagRepositoryImpl.java:185
- tests_coverage_semantic.covered_behaviours ← TagRepositoryImplTest.java:28-267 (every test method)
- tests_coverage_semantic.uncovered_behaviours[ingestData] ← absence in TagRepositoryImplTest.java + ReactiveTagRepositoryImpl.java:179-215
- tests_coverage_semantic.uncovered_behaviours[concurrent novel-name race] ← absence + ReactiveTagRepositoryImpl.java:199-210 + TagServiceImpl.java:80-86
- tests_coverage_semantic.uncovered_behaviours[case-sensitivity] ← absence + ReactiveTagRepositoryImpl.java:120-125
- tests_coverage_semantic.uncovered_behaviours[soft-delete bypass] ← absence + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104
- tests_coverage_semantic.uncovered_behaviours[resurrection] ← absence + TagServiceImpl.java:58-70 + V0_0_64__remove_is_deleted_field.sql:103-105
- tests_coverage_semantic.uncovered_behaviours[listMostPopular pagination + dataset-field arm + TagOrigin filter] ← absence + ReactiveTagRepositoryImpl.java:137-167, 373-392, 101-117
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-19 of `https://docs.opendatadiscovery.org/features/data-discovery/tagging` (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-19 of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (status 200)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch result above + REFACTOR-223 + repository-side `bulkCreate` / `ingestData` paths
- docs_link_semantic.doc_drift_findings[1] ← WebFetch result (no tag-case-sensitivity content) + ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159
- implicit_adrs[0] ← V0_0_36__refactor_unique_index.sql + V0_0_57__change_tag_unique_constraint_semantics.sql + V0_0_64__remove_is_deleted_field.sql:103-105 + ReactiveTagRepositoryImpl.java:199-210
- implicit_adrs[1] ← ReactiveTagRepositoryImpl.java:199-207
- implicit_adrs[2] ← ReactiveTagRepositoryImpl.java:204-210 + TagServiceImpl.java:88-94
- implicit_adrs[3] ← ReactiveTagRepositoryImpl.java:44, 217-323 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74
- implicit_adrs[4] ← ReactiveTagRepositoryImpl.java:261, 344, 367
- implicit_adrs[5] ← ReactiveAbstractCRUDRepository.java:113-126 + ReactiveTagRepositoryImpl.java:191-213 + TagController.java:23-28
- bugs_limitations_corner_cases[TOCTOU] ← TagServiceImpl.java:80-86, 144-159 + ReactiveAbstractCRUDRepository.java:113-126 + ExceptionUtils.java:30-36, 54-56
- bugs_limitations_corner_cases[case-sensitive listByNames] ← ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159
- bugs_limitations_corner_cases[no validation] ← ReactiveTagRepositoryImpl.java:179-215 + migration suite absence
- bugs_limitations_corner_cases[global listMostPopular] ← ReactiveTagRepositoryImpl.java:137-167 + TagController.java:36-44
- bugs_limitations_corner_cases[resurrection] ← TagServiceImpl.java:58-70 + ReactiveTagRepositoryImpl.java:227-241, 272-286
- bugs_limitations_corner_cases[empty-batch contract] ← ReactiveTagRepositoryImpl.java:181-183 + ReactiveAbstractCRUDRepository.java:115-117
- bugs_limitations_corner_cases[listTagsRelations null origin] ← ReactiveTagRepositoryImpl.java:101-117
- bugs_limitations_corner_cases[CTE name collision] ← ReactiveTagRepositoryImpl.java:150, 373-392
- bugs_limitations_corner_cases[external-aggregate divergence] ← ReactiveTagRepositoryImpl.java:373-391
- security.auth_mode_relevance ← ReactiveTagRepositoryImpl.java:1-401 (no @ConditionalOnProperty, no Auth-mode imports) + callers grep
- security.ingestion_filter_relevance ← ExternalTagIngestionRequestProcessor.java:34, 53 (FINALIZING phase) + ReactiveTagRepositoryImpl.java:179-215
- security.authorization_assertions ← ReactiveTagRepositoryImpl.java:1-401 (no @PreAuthorize, no permission service calls)
- security.owner_scoping ← ReactiveTagRepositoryImpl.java:120-167 (no owner column, no per-Owner filter) + migration suite (no `tag.owner_id`)
- security.data_exposure ← ReactiveTagRepositoryImpl.java:120-167 + callers
- security.known_security_gaps[no audit] ← ReactiveTagRepositoryImpl.java:1-401 (no @ActivityLog) + ExternalTagIngestionRequestProcessor.java:38-44 (no @ActivityLog) + DataEntityServiceImpl.java:358 (UPSTREAM @ActivityLog)
- security.known_security_gaps[no validation] ← ReactiveTagRepositoryImpl.java:179-215 + migration suite
- security.known_security_gaps[hardcoded predicate] ← ReactiveTagRepositoryImpl.java:206-207 + V0_0_64__remove_is_deleted_field.sql:105
- performance.hot_paths[ingestData] ← ReactiveTagRepositoryImpl.java:179-215 + ExternalTagIngestionRequestProcessor.java:71 + JooqReactiveOperations.java:69-84
- performance.hot_paths[listMostPopular] ← ReactiveTagRepositoryImpl.java:137-167, 373-392 + TagController.java:36-44
- performance.hot_paths[listDataEntityDtos triple-fetch] ← ReactiveTagRepositoryImpl.java:68-81 + DataEntityServiceImpl.java:622 + DataEntityPermissionExtractor.java:67 + TagActivityHandlerImpl.java:41
- performance.throughput_characteristics[partitioning] ← JooqReactiveOperations.java:69-84
- performance.throughput_characteristics[single-statement relation INSERT] ← ReactiveTagRepositoryImpl.java:244-264, 326-347, 350-371
- performance.resource_allocation[collectList in popular] ← ReactiveTagRepositoryImpl.java:160-167
- performance.scaling_characteristics[no lock] ← ReactiveTagRepositoryImpl.java:1-401 (no FOR UPDATE, no advisory lock)
- performance.scaling_characteristics[no size cap] ← ReactiveTagRepositoryImpl.java:138, 147-148
- performance.known_performance_gaps[triple-fetch] ← repository method + three caller line refs
- performance.known_performance_gaps[no EXPLAIN benchmark] ← TagRepositoryImplTest.java:239-267
- feature_hint.pillar_id ← system-mission.md P-01 Data Discovery, sub-feature "Manual Object Tagging" + tagging.md (live, 2026-05-19) + REFACTOR-223 grouping suggestion
- feature_hint.drift_class_facets ← REFACTOR-223 (existing) + bugs_limitations_corner_cases above + system-mission.md canonicalisation candidate "Audit-log Presence Asymmetry"
- feature_hint.cross_pillar_relationships ← system-mission.md `relationships` block (P-10→P-01, P-09→P-01, P-01↔P-07)

## confidence_per_field

- understanding: HIGH (full file read; all 18 method shapes verified; substrate-pattern context confirmed by REFACTOR-223 + ADR-CANDIDATE-065)
- concepts: HIGH (entities, operations, invariants all traced to source file + parent class + migration suite)
- dependencies_semantic: HIGH (all imports + parent class + JooqReactiveOperations + Indexes verified at file:line)
- tests_coverage_semantic: HIGH (full test file read; uncovered-behaviour list cross-referenced against the actual method body shapes; gaps prose anchored on REFACTOR-223 + REFACTOR-family triangulation)
- docs_link_semantic: HIGH (live WebFetch of both inferred URLs returned 200 with content quoted verbatim)
- implicit_adrs: HIGH (six implicit ADRs each with intent_anchor quotation — migration text / dynamic-resolution code / extends-clause / repeated pattern)
- bugs_limitations_corner_cases: HIGH (nine concerns each anchored at file:line; TOCTOU + case-sensitivity are the highest-impact concerns, both cross-referenced to existing REFACTOR-223 context)
- security: HIGH (auth mode + ingestion-filter relevance + zero-auth-checks all verified by reading the file end-to-end + cross-ref to upstream callers; owner-scoping confirmed by migration suite absence)
- performance: MEDIUM (hot-paths are clear; throughput + resource-allocation reasoning is sound but no EXPLAIN was run — the triple-fetch finding is verified by grep, but its actual ms-cost on a real catalog is not measured this session)
- feature_hint: HIGH (pillar mapping is verbatim from system-mission.md P-01 sub-feature list; cross-pillar relationships are verbatim from system-mission.md relationships block)

## Maintainer notes

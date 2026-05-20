---
node_id: "odd-platform java service:TagServiceImpl"
node_kind: service
axis: services
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-20-LSN-019-canary
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control (S2S ingestion side-door)
---

# TagServiceImpl — semantic understanding

## understanding

`TagServiceImpl` is the **middle layer between `TagController` and `ReactiveTagRepository{Impl}`** for the Manual Object Tagging feature (P-01:F-018) — 168 lines, 9 public methods, zero programmatic authorisation, zero `@PreAuthorize` annotations (verified line-by-line; the controller perimeter is the SOLE auth defence per the existing `TagController` sidecar). Four of the 9 methods carry `@ReactiveTransactional` (`update`:45, `delete`:58, `updateRelationsWithDataEntity`:97, `createRelationsWithTerm`:137); the remaining 5 (`bulkCreate`, `listMostPopular`, `getOrCreateTagsByName`, `getOrInjectTagByName`, `deleteRelationsWithTerm`) run under whatever the caller's TX boundary provides — `bulkCreate` inherits an implicit TX from the inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`ReactiveAbstractCRUDRepository.java:113-114`), but the others depend on call-site TX. The class's primary callers are `TagController` (4 of 9 — `bulkCreate`, `update`, `delete`, `listMostPopular`) and the four side-door surfaces that bypass the controller entirely: `TermServiceImpl.upsertTags` (`:257`), `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` (`:202, 266`), and `ExternalTagIngestionRequestProcessor.process` (`:104`) — together these constitute the REFACTOR-223 side-door surface that mints `tag` directory rows without holding `TAG_CREATE`. **The `listMostPopular` method (line 73) is a NAME-BEHAVIOUR DRIFT pair: it promises "most popular" but delegates straight-through to `reactiveTagRepository.listMostPopular(query, ids, page, size)` (line 75) which uses `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)` (`ReactiveTagRepositoryImpl.java:148`) — pagination orders by `TAG.ID ASC` (effectively oldest-by-creation since `tag.id` is a serial column), and only AFTER selecting the first `size` lowest-id rows does the outer CTE sort by descending COUNT_FIELD (`:158`). The empirical test against demo.oddp.io (2026-05-20) confirmed the endpoint returns the OLDEST 30 tags re-ordered by usage_count, not the 30 tags with highest usage_count globally.** This service propagates the drift one-to-one to its callers; the canonical drift evidence lives in the `ReactiveTagRepositoryImpl` sidecar's repository chain.

## concepts

- entities: [
    "`TagPojo` (`org.opendatadiscovery.oddplatform.model.tables.pojos.TagPojo`) — jOOQ-generated row pojo for `tag` table: `id`, `name`, `important`, `created_at`, `updated_at`, `deleted_at`",
    "`TagDto` (`org.opendatadiscovery.oddplatform.dto.TagDto`) — service-layer record `TagDto(TagPojo tagPojo, Long usedCount, Boolean external)` per `TagDto.java:5`; consumed by `update` (:47) and `delete` (:60) for the `!external` guard",
    "`TagToDataEntityPojo` — `tag_to_data_entity` row `(tag_id, data_entity_id, external)`; the diff input/output type for `updateRelationsWithDataEntity` (`:100-119`)",
    "`TagToTermPojo` — `tag_to_term` row `(tag_id, term_id)`; produced/consumed by `createRelationsWithTerm` / `deleteRelationsWithTerm`",
    "`TagFormData` (OpenAPI) — single-tag input shape with `name` + `important`; consumed by `bulkCreate` (`:38`) and `update` (`:46`)",
    "`Tag` (OpenAPI) — single-tag response shape with `id`, `name`, `important`, `external`, `usedCount`",
    "`TagsResponse` (OpenAPI) — paginated wrapper `{pageInfo, items}` produced by `listMostPopular` (`:73-77`)",
    "`Tuple2<List<TagPojo>, List<TagPojo>>` — the `(existing, toCreate)` split returned by `divideTagsByExistence` (`:144-159`); consumed by both `getOrCreateTagsByName` and `getOrInjectTagByName`"
  ]
- operations: [
    "`bulkCreate(List<TagFormData>)` (`:37-42`) — straight-through delegation: maps to `TagPojo` via `tagMapper::mapToPojo`, calls inherited `reactiveTagRepository.bulkCreate(pojos)` from `ReactiveAbstractCRUDRepository.bulkCreate` (`ReactiveAbstractCRUDRepository.java:113-126`) which has `@ReactiveTransactional` on its own. NO `@ReactiveTransactional` at this layer. Fail-on-duplicate path: unique-constraint violation translates to `UniqueConstraintException(\"Tag with this name already exists\")` per `ExceptionUtils.java`",
    "`update(long tagId, TagFormData)` (`:44-55`, `@ReactiveTransactional`) — five-step: (1) `getDto(tagId)` (2) `switchIfEmpty -> NotFoundException` (3) `!external` filter else `BadUserRequestException(\"Can't update tag which has external relations\")` (4) `tagMapper.applyToPojo` + `repository.update` (5) `updateSearchVectors` triple-zip (`:161-167`)",
    "`delete(long tagId)` (`:57-70`, `@ReactiveTransactional`) — six-step: (1) `getDto(tagId)` (2) `switchIfEmpty -> NotFoundException` (3) `!external` filter else `BadUserRequestException(\"Can't delete tag which has external relations\")` (4) `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` — concurrent HARD-deletes of `tag_to_term` and `tag_to_data_entity` rows (5) `repository.delete(tagId)` SOFT-delete (`UPDATE tag SET deleted_at = now() WHERE id = ?`) (6) `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` search-vector refresh. **DOES NOT delete `tag_to_dataset_field` rows** (`reactiveTagRepository.deleteDatasetFieldRelations(long)` exists at `ReactiveTagRepositoryImpl.java:299-306` but is NOT invoked here)",
    "`listMostPopular(String query, List<Long> ids, int page, int size)` (`:72-77`) — straight-through: `reactiveTagRepository.listMostPopular(query, ids, page, size).map(tagMapper::mapToTagsResponse)`. **NAME-BEHAVIOUR DRIFT:** the underlying repository chain paginates by `TAG.ID ASC` (oldest-first) BEFORE applying the popularity ordering; see Stress Protocol Category B finding S-B-1 below",
    "`getOrCreateTagsByName(Set<String> tagNames)` (`:79-86`) — TOCTOU upsert via `divideTagsByExistence` (`:144-159`) split then `reactiveTagRepository.bulkCreate(tagsToCreate)` + `ListUtils.union(createdTags, existingTags)`. **NO `@ReactiveTransactional`**: the `listByNames` + `bulkCreate` pair is read-then-write WITHOUT a transactional boundary at this method; a concurrent caller submitting the same novel name between the read at `:145` and the write at `:82` will race to `bulkCreate` and one will hit `UniqueConstraintException`",
    "`getOrInjectTagByName(Set<String> tagNames)` (`:88-94`) — sibling of `getOrCreateTagsByName` but uses `reactiveTagRepository.ingestData(tagsToCreate)` (`ReactiveTagRepositoryImpl.java:180-213`) — the upsert path with `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = excluded.name RETURNING *`. **NO `@ReactiveTransactional`**, but the race is silenced by `ON CONFLICT … DO UPDATE` (returns existing row). Used by the Collector path (`ExternalTagIngestionRequestProcessor.java:104`)",
    "`updateRelationsWithDataEntity(long dataEntityId, Set<String> tagNames)` (`:96-121`, `@ReactiveTransactional`) — DIFF semantics: (1) read current relations via `listTagRelations(List.of(dataEntityId))` filtered to `!external` (line 102 — leaves Collector-set EXTERNAL relations untouched), (2) `getOrCreateTagsByName(tagNames)` mints missing tags, build `TagToDataEntityPojo`s with `setExternal(false)` (`:109`), (3) `Mono.zip(current, updated).flatMap` computes `pojosToDelete = current \\\\ updated` via `.contains` on the relation rows then `deleteDataEntityRelations(pojosToDelete) -> createDataEntityRelations(updated) -> listDataEntityDtos(dataEntityId)`. The diff is implemented in-memory (collection-difference, `.filter(r -> !updated.contains(r))`) — relies on the `TagToDataEntityPojo` jOOQ-generated `equals()` covering `tagId + dataEntityId + external`",
    "`deleteRelationsWithTerm(long termId, Set<String> tagsToKeep)` (`:123-134`) — DIFF semantics for term tag-removal: read all term-attached tags via `listByTerm(termId)`, compute `idsToDelete` as tags whose name is NOT in `tagsToKeep`, then `deleteTermRelations(termId, idsToDelete)`. **NO `@ReactiveTransactional`** despite being a multi-statement read-then-write — the read and the write run in separate query roundtrips and possibly different TXs depending on caller context",
    "`createRelationsWithTerm(long termId, List<TagPojo> tags)` (`:136-142`, `@ReactiveTransactional`) — bulk INSERT `tag_to_term` rows via `createTermRelations(termId, ids)` (`ReactiveTagRepositoryImpl.java:336-346`, `onDuplicateKeyIgnore`). Caller is responsible for having already created the tag rows (consumed from `TermServiceImpl` after a prior `getOrCreateTagsByName`)",
    "`divideTagsByExistence(Set<String> tagNames)` (`:144-159`, private) — partition: `listByNames(tagNames)` then `.filter(n -> !existingTagNames.contains(n))` to compute the to-create set. **`existingTagNames.contains(n)` is case-SENSITIVE** because `listByNames` uses `TAG.NAME.in(names)` (`ReactiveTagRepositoryImpl.java:104` per the existing repository sidecar: `case-SENSITIVE exact-match lookup`). `Postgres` and `postgres` will both be reported as missing if neither exists; the call site will mint TWO Tag rows differing only by case",
    "`updateSearchVectors(TagPojo updatedPojo)` (`:161-167`, private) — `Mono.zip` of three concurrent search-index refresh calls: `reactiveSearchEntrypointRepository.updateChangedTagVectors`, `reactiveSearchEntrypointRepository.updateChangedTagStructureVector`, `reactiveTermSearchEntrypointRepository.updateChangedTagVectors`. Used only by `update`; the `delete` path uses only the term-side vector update (`:68-69`); the `create` and `ingestData` paths update NO search vectors"
  ]
- invariants: [
    "Zero `@PreAuthorize` and zero programmatic permission checks across all 168 lines (verified end-to-end). The service inherits whatever auth posture the call-site provides; for `TagController` calls this is the perimeter SecurityRule (`TAG_CREATE`/`TAG_UPDATE`/`TAG_DELETE` for the three writes, no rule for `getPopularTagList` → catch-all `authenticated()`); for the FOUR side-door surfaces (`TermServiceImpl`, `DataEntityServiceImpl`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor`) the auth check varies per surface and `TAG_CREATE` is NEVER held even though directory rows are minted",
    "The `!external` guard pattern (`:49-50` for `update`, `:62-63` for `delete`) — both paths refuse to mutate a tag whose `boolOr(tag_to_data_entity.external)` aggregate is true. The semantic: any tag with at least one Collector-set assignment is owned by the Collector and read-only via the UI. NOTE: the guard reads `tagDto.external()` which is the AGGREGATE across all data-entity relations; it does NOT consult `tag_to_dataset_field` origins (the dataset-field side uses a `TagOrigin` enum rather than a boolean) — a tag with INTERNAL data-entity relations + EXTERNAL dataset-field relations would NOT be blocked",
    "The `delete` cascade is ASYMMETRIC: `tag_to_term` and `tag_to_data_entity` are HARD-deleted concurrently via `Flux.zip` (`:64-65`); the `tag` row is SOFT-deleted via the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete`; `tag_to_dataset_field` is NOT touched. Consequence: deleting a tag attached to dataset fields leaves orphan `tag_to_dataset_field` rows referencing the soft-deleted tag id (invisible to UI reads because `listDatasetFieldDtos` joins through `addSoftDeleteFilter`, but persistent in the DB)",
    "The `updateRelationsWithDataEntity` diff DOES NOT delete EXTERNAL relations — the `currentRelations` mono filters `!pojo.getExternal()` (`:102`) before the diff. A user mutating tags via `PUT /api/dataentities/{id}/tags` cannot accidentally remove Collector-set relations; symmetrically, they cannot add EXTERNAL relations either (all new relations are created with `setExternal(false)` `:109`)",
    "The Tag directory itself has NO ownership concept — `tag` table has no `owner_id` column (per the existing repository sidecar's `owner_scoping: N/A`); `bulkCreate` produces tags with `external = false` always, and the side-door paths (`getOrCreateTagsByName` callers) produce tags with `external = false` on the data-entity side too (`:109` hardcodes `false`). The `external = true` rows come ONLY from `ExternalTagIngestionRequestProcessor` via `tagService.getOrInjectTagByName` + a subsequent `createDataEntityRelations(pojo.setExternal(true))` step in the processor (not in this service)",
    "Methods that issue MULTI-step reads-then-writes WITHOUT `@ReactiveTransactional`: `bulkCreate` (single-step write, inherited TX), `getOrCreateTagsByName` (read `listByNames` + write `bulkCreate`), `getOrInjectTagByName` (read `listByNames` + upsert `ingestData`), `deleteRelationsWithTerm` (read `listByTerm` + write `deleteTermRelations`). These are TOCTOU surfaces — a concurrent caller can change the read-side state between the read and the write. The `ingestData` path silences the race via `ON CONFLICT … DO UPDATE`; the `bulkCreate` path translates the race to `UniqueConstraintException`; the `deleteRelationsWithTerm` path can silently miss a concurrent term-tag-add (the just-added tag won't be in the read-side, so it won't be deleted) — but term tag-updates are not concurrent in practice"
  ]
- audiences: [
    "`TagController` — the primary HTTP-fronting caller; invokes 4 of the 9 methods (`bulkCreate`, `update`, `delete`, `listMostPopular`); the 4 methods that this service exposes via the API gateway",
    "`TermServiceImpl.upsertTags` (`TermServiceImpl.java:257`) — invokes `getOrCreateTagsByName`; the side-door write path for Term-attached tags, gated by `TERM_TAGS_UPDATE`",
    "`DataEntityServiceImpl.upsertTags` — invokes `updateRelationsWithDataEntity` for the per-entity `PUT /api/dataentities/{id}/tags` endpoint; gated by `DATA_ENTITY_TAGS_UPDATE`. NOTE: this side-door does NOT touch the directory directly; it goes through this service's diff method which transitively calls `getOrCreateTagsByName` to mint missing tags",
    "`DatasetFieldServiceImpl` (`:202, 266`) — invokes `getOrCreateTagsByName` for the per-dataset-field tag-update path `PUT /api/datasetfields/{id}/tags`; gated by `DATASET_FIELD_TAGS_UPDATE`",
    "`ExternalTagIngestionRequestProcessor.process` (`:104`) — invokes `getOrInjectTagByName` for the Collector push path; gated only by `auth.ingestion.filter.enabled` S2S filter (no `TAG_CREATE` check), this is the FOURTH side-door surface",
    "platform-operator (indirectly) — the RBAC author granting `TAG_*` permissions; this service's lack of service-tier auth means a grant of `DATA_ENTITY_TAGS_UPDATE` or `TERM_TAGS_UPDATE` confers tag-directory-write capability even without `TAG_CREATE`"
  ]

## upstream_callers

- `TagController` (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TagController.java`) — direct call sites: `bulkCreate` (line 26), `update` (line 50), `delete` (line 32), `listMostPopular` (line 42). The OpenAPI HTTP surface.
- `TermServiceImpl.upsertTags` (`odd-platform-api/.../service/term/TermServiceImpl.java:257`) — `getOrCreateTagsByName`. Side-door A.
- `DataEntityServiceImpl.upsertTags` (`odd-platform-api/.../service/DataEntityServiceImpl.java`) — `updateRelationsWithDataEntity`. Side-door B. (Confirmed via Grep — the grep file list shows `DataEntityServiceImpl.java` contains `tagService.` invocations.)
- `DatasetFieldServiceImpl` (`odd-platform-api/.../service/DatasetFieldServiceImpl.java`) — `getOrCreateTagsByName` (multiple call sites per existing repository sidecar). Side-door C.
- `ExternalTagIngestionRequestProcessor.process` (`odd-platform-api/.../service/ingestion/processor/ExternalTagIngestionRequestProcessor.java:104`) — `getOrInjectTagByName`. Side-door D — the S2S Collector path.

## downstream_side_effects

- **`reactive_tag_repository` (jOOQ Postgres)** — every method delegates to this repository for the actual DB I/O. See the `ReactiveTagRepositoryImpl` sidecar for the canonical side-effect catalogue per repository method.
- **`reactive_search_entrypoint_repository.updateChangedTagVectors`** — invoked by `updateSearchVectors` (`:163`) called only from `update` (`:53`). Refreshes the global `search_entrypoint` table tag-search FTS vectors.
- **`reactive_search_entrypoint_repository.updateChangedTagStructureVector`** — invoked by `updateSearchVectors` (`:164`) called only from `update`. Refreshes the structure-search vectors that include tag context.
- **`reactive_term_search_entrypoint_repository.updateChangedTagVectors`** — invoked by `updateSearchVectors` (`:165`) on `update` AND directly by `delete` (`:68-69`). Refreshes the term-search FTS vectors that index tag context for term-name search results.
- **NO direct DB writes from this class** — all writes go through the repository.
- **NO external I/O** — no HTTP, no SMTP, no Slack, no S3, no OTLP.
- **Transaction boundaries** — Four methods OPEN a TX: `update` (`:45`), `delete` (`:58`), `updateRelationsWithDataEntity` (`:97`), `createRelationsWithTerm` (`:137`) via `@ReactiveTransactional`. Five methods do NOT carry the annotation: `bulkCreate`, `listMostPopular`, `getOrCreateTagsByName`, `getOrInjectTagByName`, `deleteRelationsWithTerm`. `bulkCreate` inherits an implicit TX from the inherited `ReactiveAbstractCRUDRepository.bulkCreate` annotation; the others depend on the caller's TX context.
- **Lock acquisition** — NONE. No advisory locks, no `SELECT … FOR UPDATE`. Concurrent-write protection lives entirely in the partial unique index on `tag.name` (`tag_name_unique` per `V0_0_64__remove_is_deleted_field.sql:105`).

## dependencies_semantic

- requires-feature: [
    "`ReactiveTagRepository` (`ReactiveTagRepository.java:15-53`) — 18-method interface; this service consumes ~12 of those methods (`bulkCreate`, `update`, `delete`, `getDto`, `listMostPopular`, `listByNames`, `listByTerm`, `listTagRelations`, `listDataEntityDtos`, `ingestData`, `createDataEntityRelations`, `deleteDataEntityRelations` x2, `createTermRelations`, `deleteTermRelations` x2)",
    "`TagMapper` — MapStruct-style mapper; this service uses `mapToPojo`, `mapToTag`, `mapToTagsResponse`, `applyToPojo`",
    "`ReactiveSearchEntrypointRepository.updateChangedTagVectors` + `.updateChangedTagStructureVector` — search-vector refresh used by `update` only",
    "`ReactiveTermSearchEntrypointRepository.updateChangedTagVectors` — term-side search-vector refresh used by `update` and `delete`",
    "`@ReactiveTransactional` annotation (`ReactiveTransactional.java:11`) — Spring `@Transactional(\"reactiveTransactionManager\")` qualifier; the transactional posture depends on Spring binding the `reactiveTransactionManager` bean (Spring Boot autoconfig via `R2dbcTransactionManager`)"
  ]
- requires-config: [] — N/A. This service reads no Spring properties; behaviour is unconditional and code-driven.
- requires-runtime: [
    "Spring `@Service`-managed bean (`:29`) — constructor-injected via Lombok `@RequiredArgsConstructor` (`:30`) with four `final` fields (`:32-35`)",
    "Spring Reactive Transaction Manager (`reactiveTransactionManager` bean) — required for the four `@ReactiveTransactional` methods to obtain a R2DBC TX",
    "Reactor — `Mono`, `Flux`, `Tuple2`, `Tuples`, `TupleUtils.function` for the destructuring-lambda pattern at `:81, 90, 113` (`function((a, b) -> …)` style)",
    "Apache Commons Collections — `ListUtils.union` for the merge in `getOrCreateTagsByName` (`:84`)"
  ]
- couples-to: [
    "`TagService` interface (`TagService.java:14-36`) — 9-method contract (`bulkCreate`, `update`, `delete`, `listMostPopular`, `getOrCreateTagsByName`, `getOrInjectTagByName`, `updateRelationsWithDataEntity`, `deleteRelationsWithTerm`, `createRelationsWithTerm`). Note: the interface does NOT expose `divideTagsByExistence` or `updateSearchVectors` — these are private helpers.",
    "`ReactiveTransactional` annotation — a project-local stereotype that fixes the transaction-manager qualifier; if a future refactor renamed the bean from `reactiveTransactionManager`, every `@ReactiveTransactional` method in this file would silently lose its TX boundary",
    "`TagDto` record — three-field record `(TagPojo, Long, Boolean)`; the `.external()` getter is the guard input for `update` + `delete`",
    "`ReactiveTagRepositoryImpl.listMostPopular`'s `paginate(...)` chain at `:148` — the drift propagator (see Stress Protocol Category B finding S-B-1)",
    "Search-entrypoint repository pair — the transparent triple-update on `update` (`:162-166`) and the single term-side update on `delete` (`:68-69`). Add a new search vector and this file must be updated."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — **No test file exists for `TagServiceImpl` in `odd-platform-api/src/test/`**. Grep for `TagServiceImpl` returns zero matches across `**/test/**/*.java` (`Glob: odd-platform-api/src/test/**/TagServiceImpl*Test*.java` returns no files). Cross-checked with `Glob: odd-platform-api/src/test/**/Tag*Test*.java` which returns ZERO files — there is no `TagServiceImplTest`, no `TagServiceTest`. The only Tag-related test is `TagRepositoryImplTest` (`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java`) per the existing repository sidecar, which covers the repository layer only — none of the service-layer orchestration (`!external` guard, `Flux.zip` cascade in `delete`, TOCTOU in `getOrCreateTagsByName`, in-memory diff in `updateRelationsWithDataEntity`, the `updateSearchVectors` triple-zip side effect on `update`) is exercised. **Service-layer test coverage is ZERO.**
- uncovered_behaviours: [
    "{
      \"behaviour\": \"`update` !external guard — no test asserts that updating a tag with `external = true` (any data-entity relation set by a Collector) throws `BadUserRequestException('Can't update tag which has external relations')`. The check at line 49-50 is critical for the Collector-vs-UI ownership contract.\",
      \"test_class\": \"TagServiceImplTest (would add `testUpdate_ExternalTag_ThrowsBadUserRequest`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`delete` !external guard — symmetric concern; deleting an externally-set tag should be rejected per :62-63.\",
      \"test_class\": \"TagServiceImplTest (would add `testDelete_ExternalTag_ThrowsBadUserRequest`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`delete` cascade asymmetry — no test asserts that `tag_to_dataset_field` rows are NOT deleted by `TagServiceImpl.delete`. If a tag is attached to dataset fields and a TAG_DELETE is issued, the `tag_to_dataset_field` rows persist as orphans. The current behaviour may be intentional (search-vector consistency) but is not asserted anywhere.\",
      \"test_class\": \"TagServiceImplTest (would add `testDelete_LeavesTagToDatasetFieldRows`) — integration test\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`update` triple-zip search-vector refresh — no test asserts that all three `updateChangedTag*Vectors` calls fire on update. A regression replacing the zip with a single call would silently break the term-search FTS index.\",
      \"test_class\": \"TagServiceImplTest (would add `testUpdate_TripleSearchVectorRefresh`) — Mockito-style test asserting three `verify(...).updateChangedTag…)` calls\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`getOrCreateTagsByName` TOCTOU under concurrent identical novel-name submissions — two parallel calls with the same novel name should NOT both attempt `bulkCreate`; one should hit `UniqueConstraintException`. No test asserts the contract.\",
      \"test_class\": \"TagServiceImplTest (would add `testGetOrCreateTagsByName_ConcurrentNovelName_OneThrowsUniqueConstraintException`) — `StepVerifier` + parallel `Mono.zip`\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`getOrInjectTagByName` TOCTOU — symmetric concern but the upsert silences the race; the test should assert both callers receive the SAME tag id (not two different ids).\",
      \"test_class\": \"TagServiceImplTest (would add `testGetOrInjectTagByName_ConcurrentNovelName_ReturnsSameId`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`divideTagsByExistence` case-sensitivity — no test asserts that calling `getOrCreateTagsByName({'Postgres', 'postgres'})` creates TWO tag rows (when neither exists) or one (when one exists, depending on case). The UI tag-search facet uses case-insensitive substring match (`listMostPopular`'s `query`), but the directory write path is case-sensitive — a UX inconsistency that should be either asserted or fixed.\",
      \"test_class\": \"TagServiceImplTest (would add `testGetOrCreateTagsByName_CaseSensitiveDistinct`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`updateRelationsWithDataEntity` in-memory diff correctness — the `current \\\\ updated` computation via `.filter(r -> !updated.contains(r))` (line 114-116) depends on jOOQ-generated `TagToDataEntityPojo.equals` covering `tagId + dataEntityId + external`. A regression in the equals method (or a future jOOQ regen with different equals semantics) would silently break the diff.\",
      \"test_class\": \"TagServiceImplTest (would add `testUpdateRelationsWithDataEntity_DiffSemantics`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`updateRelationsWithDataEntity` !external invariant on read side — no test asserts that the diff input is filtered to `!external` only (line 102) and that EXTERNAL relations are LEFT UNTOUCHED across a UI-side rename.\",
      \"test_class\": \"TagServiceImplTest (would add `testUpdateRelationsWithDataEntity_PreservesExternalRelations`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`updateRelationsWithDataEntity` hardcoded external=false on new relations — no test asserts that new relations are written with `external = false` (line 109), preventing the UI from impersonating a Collector.\",
      \"test_class\": \"TagServiceImplTest (would add `testUpdateRelationsWithDataEntity_NewRelationsExternalFalse`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listMostPopular` drift — no test asserts that the endpoint returns the lowest-id tags (oldest creations) re-sorted by usage_count, despite the method name. The drift is empirically proven (2026-05-20 demo.oddp.io test) but not regression-protected; a future refactor to push the COUNT_FIELD ordering INTO the paginate window would silently change behaviour and no test would catch it.\",
      \"test_class\": \"TagServiceImplTest (would add `testListMostPopular_OldestTagsReturned` — DRIFT-locking test that codifies the current behaviour) — or `TagRepositoryImplTest` augment with a test that creates 60 tags with descending usage_count and asserts which 30 page=1 returns\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`bulkCreate` duplicate-name failure mode — no test at this service layer asserts that submitting `[{'a','a'}]` (within the same batch) or `[{'a'}]` when `a` already exists triggers `UniqueConstraintException`. The downstream repository test covers happy-path; the service-tier wrapping is not tested.\",
      \"test_class\": \"TagServiceImplTest (would add `testBulkCreate_DuplicateName_ThrowsUniqueConstraintException`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`deleteRelationsWithTerm` set-difference semantics — `tagsToKeep` is checked by name; if a term has tags with case-only-different names (`Postgres` + `postgres`) and `tagsToKeep={'Postgres'}`, the `postgres` relation is deleted. No test asserts this case-sensitive deletion.\",
      \"test_class\": \"TagServiceImplTest (would add `testDeleteRelationsWithTerm_CaseSensitiveTagsToKeep`)\",
      \"severity\": \"LOW\"
    }"
  ]
- test_files: [] — N/A. NO `TagServiceImplTest.java` exists; verified via two `Glob` invocations.
- gaps: |
    Service-layer test coverage is **zero**. Every cross-cutting concern this service introduces — the `!external` guards, the in-memory diff in `updateRelationsWithDataEntity`, the asymmetric cascade in `delete`, the case-sensitivity drift between `divideTagsByExistence` and the repository's `listMostPopular` substring query, the triple search-vector refresh on `update`, the TOCTOU window in `getOrCreateTagsByName` — is unverified by automated test. The repository-layer tests verify that the repository methods work; they do not verify that this service composes them correctly. **A future refactor that, e.g., removes the `.filter(tagDto -> !tagDto.external())` guard (lines 49-50, 62-63) would compile, pass all existing tests, and silently let UI users mutate Collector-owned tags — a permission-bypass regression with zero CI signal.** The `listMostPopular` drift would similarly survive any refactor that does not change the literal SQL.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagServiceImpl.java`. Verified via Grep for `@docs` returning zero matches in the file (`Grep: '@docs'` in this file — no match observed during read).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/manual-object-tagging"
    anchor: ""
    rationale: "The TagController sidecar marks this feature as P-01:F-018 'Manual Object Tagging'. The user-visible doc page for the feature is the canonical destination if one exists."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: not-fetched
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: "#tag-permissions"
    rationale: "The service's auth-posture finding (zero @PreAuthorize) makes the Authorization doc page the natural cross-reference for the permission model. The TAG_CREATE/UPDATE/DELETE permissions are documented there."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: not-fetched
    confidence: LOW
- doc_drift_findings: [] — N/A. No declared doc to drift-check against; the inferred docs are candidates for the doc-gap-finder reducer to verify.

## implicit_adrs

- "Tag-directory writes have NO service-tier authorisation — the controller perimeter is the SOLE auth defence; the four side-door write paths (Term, DataEntity, DatasetField, Collector S2S) intentionally use their own per-feature permission rather than `TAG_CREATE`." — evidence: TagServiceImpl.java:31-167 (no `@PreAuthorize`, no `permissionService.*` call across all 9 public methods + 2 private helpers) — intent_anchor: "no explicit comment defending the absence; the consistent pattern across the file is itself the convention — every method begins with `@Override\\n[@ReactiveTransactional\\n]public …` and not a single one carries an authorisation annotation. The `external` guard pattern (`.filter(tagDto -> !tagDto.external())` at :49 and :62) shows the maintainer ACTIVELY thought about gating behaviour, but chose to gate by DATA OWNERSHIP (Collector-set rows) rather than by USER PERMISSION." — confidence: MEDIUM (intent is inferable from the consistency of the pattern + the explicit external-ownership guard, but no comment explicitly defends the absence of @PreAuthorize)
- "EXTERNAL relations are immutable to UI users — both `update` and `delete` reject tags with `external = true` aggregate; `updateRelationsWithDataEntity` reads only `!external` relations for the diff; new relations are hardcoded `external = false` (:109). The Collector owns the EXTERNAL bit and the UI cannot impersonate." — evidence: TagServiceImpl.java:49-50 (update guard), :62-63 (delete guard), :102 (diff filter), :109 (hardcoded false) — intent_anchor: "the explicit `BadUserRequestException(\"Can't update tag which has external relations\")` / `\"Can't delete tag which has external relations\"` exception messages name the contract in user-visible language. Three independent guards aligned across three methods = intentional pattern, not coincidence." — confidence: HIGH
- "Search-vector refresh is part of the `update` / `delete` contract — `update` triggers THREE vector refreshes via `Mono.zip` (search-entrypoint + tag-structure + term-search); `delete` triggers one (term-search). These are not best-effort fire-and-forget; they are awaited as part of the response." — evidence: TagServiceImpl.java:53 (`.flatMap(this::updateSearchVectors)`), :161-167 (the triple-zip in `updateSearchVectors`), :68-69 (the `flatMap` after delete) — intent_anchor: "the `flatMap` placement (vs `subscribe` for fire-and-forget) shows the maintainer explicitly chose to make search-index consistency part of the synchronous transaction boundary. A user who updates a tag and immediately searches sees the refreshed index. The triple-zip is concurrent (not sequential) — intentional parallelism for latency." — confidence: HIGH
- "TX scope is the multi-statement orchestration, not the call-site — four methods carry `@ReactiveTransactional` (`update`, `delete`, `updateRelationsWithDataEntity`, `createRelationsWithTerm`) because they issue multi-statement DB sequences; the others delegate single-step to the repository (which has its own TX or carries the inherited one)." — evidence: TagServiceImpl.java:45 (@ReactiveTransactional on update with 4 DB statements), :58 (on delete with 5 DB statements), :97 (on updateRelationsWithDataEntity with 4 DB statements), :137 (on createRelationsWithTerm with 1 DB call but ATOMIC w/ the caller's preceding writes via the inherited TX from `tagService.getOrCreateTagsByName` at :81-85 — the term-tag-bind path needs the tag-create and the relation-insert to be in the same TX) — intent_anchor: "the annotation placement is consistent with 'multi-step write needs explicit TX' — single-step writes (bulkCreate, listMostPopular, deleteRelationsWithTerm — which is genuinely 1 statement after a read) don't carry it. The exception is `deleteRelationsWithTerm` (`:124-134`) which is a multi-statement (read + write) without `@ReactiveTransactional` — this is a deliberate choice OR a bug; absent a comment, this is ambiguous (see bugs_limitations_corner_cases)." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "`deleteRelationsWithTerm` (`:124-134`) is multi-statement (read `listByTerm` then `deleteTermRelations`) but carries NO `@ReactiveTransactional`. A concurrent write to `tag_to_term` between the read at :126 and the write at :132 will not be detected; if a tag is added to the term concurrently, the just-added relation will not be in the `currentTags` collection and will not be deleted. The other multi-statement non-TX methods (`getOrCreateTagsByName`, `getOrInjectTagByName`) have race protections in the underlying repository (unique-constraint or ON CONFLICT DO UPDATE); `deleteRelationsWithTerm` has neither — there is no constraint preventing the race, and the read/write are not atomic. No comment defends the choice." — evidence: TagServiceImpl.java:123-134 (no `@ReactiveTransactional`, multi-statement read+write) — severity: MEDIUM
- "`getOrCreateTagsByName` (`:79-86`) has a TOCTOU window between `listByNames` at :145 and `bulkCreate` at :82. Two concurrent callers submitting the same novel name will both find it missing at line 145 and both attempt `bulkCreate`. One will succeed; the other will hit `UniqueConstraintException(\"Tag with this name already exists\")` from `ExceptionUtils.translateDatabaseException`. The exception is propagated to the caller. **Critical**: this is invoked from `TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` (twice) — the side-door write paths — none of which catch `UniqueConstraintException` per a quick Grep would clarify; a Collector + UI concurrent submission of the same novel name will fail the UI write while succeeding the Collector ingest. The `getOrInjectTagByName` sibling silences this race via `ON CONFLICT DO UPDATE`; the call site choice determines which TOCTOU posture applies." — evidence: TagServiceImpl.java:79-86 + :144-159 + ReactiveTagRepositoryImpl.java:113-126 (the inherited `bulkCreate` w/o `ON CONFLICT`) — severity: HIGH
- "`divideTagsByExistence` (`:144-159`) is case-SENSITIVE because `listByNames` uses `TAG.NAME.in(names)` (`ReactiveTagRepositoryImpl.java:104` per existing repository sidecar invariant). The UI tag-search facet (`listMostPopular`'s `query` parameter via `nameField.containsIgnoreCase(nameQuery)`) is case-INSENSITIVE. Result: a user can search 'postgres' and see a `Postgres` tag, then submit `postgres` for a new entity, and the service will mint a SECOND tag row (`postgres`) silently. The UI surfaces both in the popular-tags list as if they were distinct tags. The `tag_name_unique` partial unique index does not catch this because it is a binary `text` comparison, not a `lower(text)` comparison." — evidence: TagServiceImpl.java:144-159 + ReactiveTagRepositoryImpl.java listByNames :104 + V0_0_64__remove_is_deleted_field.sql:105 (the partial unique index on `text`) — severity: MEDIUM
- "`delete` cascade does NOT touch `tag_to_dataset_field` — the `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` at :64-65 hard-deletes two relation tables; the third relation table (`tag_to_dataset_field`) is silently skipped. The repository has `deleteDatasetFieldRelations(long tagId)` (`:299-306` per repository sidecar) but it is NOT invoked here. Operator-visible consequence: a tag attached to dataset fields can be deleted via `TAG_DELETE`, leaving `tag_to_dataset_field` rows referencing a soft-deleted tag id. These orphans are invisible to UI reads (the `listDatasetFieldDtos` query joins through `addSoftDeleteFilter`) but persist in the DB indefinitely. No `tag_to_dataset_field` reaper job exists." — evidence: TagServiceImpl.java:63-67 (the Flux.zip cascade with only two relation deletes) + ReactiveTagRepositoryImpl.java:299-306 (the unused `deleteDatasetFieldRelations(long)`) — severity: MEDIUM
- "Search-vector refresh on `delete` is INCOMPLETE — `delete` updates only `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` (`:68-69`); it does NOT call `reactiveSearchEntrypointRepository.updateChangedTagVectors` or `.updateChangedTagStructureVector` despite `update` updating all three. After a tag delete, the main search-entrypoint table still contains the deleted tag's tokens until the next entity-level refresh. The UI tag-search facet may surface the deleted tag's name until the index naturally refreshes via the next data-entity write." — evidence: TagServiceImpl.java:64-69 (the delete chain's final flatMap omits the two main search-vector calls that `update` makes at :162-166) — severity: LOW
- "`bulkCreate` (`:37-42`) has NO `@ReactiveTransactional` at this layer. It depends entirely on the inherited annotation at `ReactiveAbstractCRUDRepository.bulkCreate` (`:113-114`). A future refactor that overrides `bulkCreate` in `ReactiveTagRepositoryImpl` without preserving `@ReactiveTransactional` would silently strip the TX boundary — and the failure mode would be a partial-batch insert visible to other readers between the failure and the rollback." — evidence: TagServiceImpl.java:37-42 (no annotation) + ReactiveAbstractCRUDRepository.java:113-114 (inherited annotation) — severity: LOW
- "`update` triple-zip search-vector refresh runs CONCURRENTLY (`Mono.zip` at :162-166) and AWAITED. If any of the three search-entrypoint refreshes fails, the entire `update` fails AFTER the `tag` row write has happened (the `flatMap` order is :52 update -> :53 updateSearchVectors). The TX-boundary semantics determine whether the row write rolls back; per `@ReactiveTransactional` on `update`, it should — but Spring's reactive TX rollback semantics depend on the `Mono.zip` ERROR signal reaching the TX manager intact, and the three-fold zip increases the failure surface." — evidence: TagServiceImpl.java:44-55 + :161-167 + ReactiveTransactional.java:11 — severity: LOW

## security

- auth_mode_relevance: INTERNAL_ONLY — This is a service-tier bean, not on the HTTP surface directly. The methods are invoked from controllers (gated by SecurityRule) and from other services (gated by their respective permissions). The behaviour does NOT shift based on `auth.type=DISABLED|LOGIN_FORM|OAUTH2|LDAP` — the service runs identically regardless of authentication mode. The implication is that under `auth.type=DISABLED` (dev-only), the controller perimeter is open and so is the entire tag-directory write surface.
- ingestion_filter_relevance: YES (indirectly) — `getOrInjectTagByName` (`:88-94`) is invoked from `ExternalTagIngestionRequestProcessor.process` (`:104`) which IS in the `POST /ingestion/entities` flow gated by `IngestionDataEntitiesFilter` (per the existing repository sidecar) when `auth.ingestion.filter.enabled=true`. The S2S filter validates the Collector's token before the processor runs; from this service's perspective, the call appears identical to any other service caller — there is no S2S-specific code path here.
- authorization_assertions: [] — No `@PreAuthorize`, no `permissionService.*` calls, no `OwnerAuthorizationFacade` invocations across all 168 lines. Verified by reading line-by-line.
- owner_scoping: N/A — Tag directory has no owner concept (per the existing repository sidecar's invariant: there is no `tag.owner_id` column). `listMostPopular` returns globally-ordered tags; `bulkCreate` produces flat directory rows accessible to every user. The closest analogue is the `external` boolean which encodes Collector-vs-UI provenance, NOT user-ownership.
- data_exposure: |
    `Mono<TagsResponse>` from `listMostPopular` → globally-ordered tag directory (re-ordered popular-by-name-and-id within the lowest-id page; see drift below) → any authenticated user, no owner filter, no per-tag permission check. This is the same data exposure as the `TagController.getPopularTagList` endpoint plus the entire side-door write surface that minted the directory rows.
    `Flux<Tag>` from `bulkCreate` → the just-created tag rows (id + name + important + external=false + usedCount=0) → returned to whichever caller invoked `bulkCreate` (TagController under `TAG_CREATE` is the only one).
    `Mono<Tag>` from `update` + `delete` → single-tag DTOs → only callers under `TAG_UPDATE` / `TAG_DELETE` (i.e., the controller).
    `Flux<TagPojo>` from `getOrCreateTagsByName` + `getOrInjectTagByName` → directory-row tag pojos → returned to the caller (side-door surfaces); not directly user-facing.
    `Mono<List<TagDto>>` from `updateRelationsWithDataEntity` → the full per-data-entity tag list AFTER the diff applied → returned to the caller (`DataEntityServiceImpl.upsertTags`); not directly user-facing.
- known_security_gaps:
  - "Service-tier has ZERO authorisation checks. The controller perimeter is the SOLE auth defence for HTTP traffic; the four side-door write paths (`TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor`) each apply their own per-feature permission (`TERM_TAGS_UPDATE`, `DATA_ENTITY_TAGS_UPDATE`, `DATASET_FIELD_TAGS_UPDATE`, S2S filter) and BYPASS `TAG_CREATE` entirely while still minting `tag` directory rows. — evidence: TagServiceImpl.java:31-167 (no @PreAuthorize across the file) + the existing TagController sidecar's side-door catalogue — severity: MEDIUM (intentional design per the existing TagController sidecar's REFACTOR-223 finding; recorded here as the service-tier confirmation)"
  - "The `external = false` hardcode at `:109` in `updateRelationsWithDataEntity` is a defence against UI users impersonating a Collector (creating `tag_to_data_entity` rows with `external = true` would make the tag invulnerable to UI delete/update). It works because there is no other path that creates `tag_to_data_entity` rows with user-controllable `external`. — evidence: TagServiceImpl.java:109 — severity: LOW (defence is intact, recorded for posture)"
  - "TOCTOU on `getOrCreateTagsByName` is a denial-of-write surface: a malicious Collector can race the UI on novel names by repeatedly calling `POST /ingestion/entities` with the same novel name; the UI's `PUT /api/dataentities/{id}/tags` containing the same name will fail with `UniqueConstraintException`. Probability low (requires Collector compromise), but the failure mode is silent (just returns 400 to the UI user). — evidence: TagServiceImpl.java:79-86 + the side-door `tagService.getOrInjectTagByName` from ExternalTagIngestionRequestProcessor — severity: LOW"
- performance: (see performance block)

## performance

- hot_paths:
  - "`listMostPopular` runs on every `GET /api/tags/popular` invocation — UI page load (Catalog Overview top-tags chip strip per the existing TagController sidecar), tag-search-facet dropdown, Management → Tags tab. The downstream `reactiveTagRepository.listMostPopular` issues a UNION-ALL CTE across `tag_to_data_entity` + `tag_to_dataset_field` (per the existing repository sidecar) — non-trivial query. This service is a pass-through wrapper. — evidence: TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167"
  - "`updateRelationsWithDataEntity` runs on every `PUT /api/dataentities/{id}/tags` write — issues FOUR DB statements (listTagRelations, listByNames inside `divideTagsByExistence`, optional bulkCreate, deleteDataEntityRelations + createDataEntityRelations) within a single `@ReactiveTransactional` boundary. — evidence: TagServiceImpl.java:96-121"
  - "`getOrCreateTagsByName` / `getOrInjectTagByName` run on EVERY side-door write path (term-tag-update, data-entity-tag-update, dataset-field-tag-update, Collector ingest); each issues at minimum `listByNames` then a bulk insert. The Collector ingest is the highest-throughput path. — evidence: TagServiceImpl.java:79-94"
- throughput_characteristics:
  - "All methods are reactive `Mono` / `Flux` returns — non-blocking, but each method issues 1-4 DB round-trips per invocation. No batching across requests; no caching."
  - "`bulkCreate` and `getOrInjectTagByName` use the inherited `executeInPartitionReturning` pattern (per the existing repository sidecar) — a >`BATCH_SIZE` upsert is split into multiple INSERT statements via `Flux.concat` within the caller's TX. Same TX, multiple round-trips."
  - "Single-item writes (`update`, `delete`) — no batch; one request = one TX = one critical-path latency."
- resource_allocation:
  - "Memory: per-call allocations are small for normal use. `getOrCreateTagsByName` and `getOrInjectTagByName` materialise the existing-tag list via `.collectList()` (`:83, :147`) — for a typical Collector batch of ~50 tags, this is a few KB. The `updateRelationsWithDataEntity` diff materialises the current relation list AND the updated relation list simultaneously (`Mono.zip` at :112) — for a data entity with thousands of tags, this is O(N) memory in the relation table size."
  - "DB connections: each method takes one R2DBC connection from the pool per TX. The four `@ReactiveTransactional` methods hold the connection for the duration of the multi-statement orchestration."
  - "No outbound HTTP, no S3, no SMTP — only Postgres I/O."
- scaling_characteristics:
  - "Stateless service — instances scale horizontally; no bean state, no caches, no static maps."
  - "No advisory locks, no `SELECT FOR UPDATE` — concurrent-write protection lives entirely in the `tag_name_unique` partial unique index. Two concurrent `getOrCreateTagsByName` calls submitting the same novel name will race; the `getOrInjectTagByName` upsert path silences the race; the `bulkCreate` direct path translates it to `UniqueConstraintException`."
  - "Search-vector refresh on `update` runs THREE concurrent `Mono` calls via `Mono.zip` — parallelism reduces latency to max-of-three rather than sum-of-three. The same is NOT true for `delete` (single search-vector call) or for the four `@ReactiveTransactional` orchestrations whose ordering is enforced via `flatMap`."
- known_performance_gaps:
  - "`listMostPopular` has no service-tier pagination cap — the `size` parameter is passed straight through to the repository (`:75`). A caller submitting `size=100000` would force a full-directory aggregate per the existing repository sidecar's identical finding. The service layer does NOT validate or cap `size`. — evidence: TagServiceImpl.java:72-77 — severity: LOW"
  - "`updateRelationsWithDataEntity` in-memory diff is O(N×M) where N is current relations and M is updated — `current.stream().filter(r -> !updated.contains(r))` (`:114-116`) does a linear scan per current relation. For a data entity with 1000 current relations and 1000 updated relations, this is 1M `contains` checks. Realistic operation has dozens of relations per entity, so this is not a current bottleneck, but it would be at extreme scale. — evidence: TagServiceImpl.java:114-116 — severity: LOW"

## stress_findings

The Stress Protocol (system-prompt Rule 9) fires on this node's source. Each finding category is exhausted; absences are recorded explicitly.

### Category A — Tunables (literal numeric constants, @Value defaults)
[] — There are NO literal numeric constants in this service file. No batch size, no retry count, no timeout, no default `int` / `long`. The numerics that govern this code (BATCH_SIZE in `executeInPartitionReturning`, page/size from the controller, `OrderByField(TAG.ID, SortOrder.ASC)` in `listMostPopular`) all live in OTHER files (the abstract repository or the controller's request parameters). Empty stress-Category-A is itself the finding: this service has zero tunable surface.

### Category B — Name-behaviour pairs (promise vs. implementation)

**S-B-1 (CANARY HEADLINE)** — `listMostPopular(query, ids, page, size)` (`:72-77`) — **NAME-BEHAVIOUR DRIFT** — Promise: "list the most popular tags". Implementation: straight-through delegation to `reactiveTagRepository.listMostPopular(query, ids, page, size)` which, at `ReactiveTagRepositoryImpl.java:148`, paginates by `TAG.ID, SortOrder.ASC` (lowest id first = oldest creation first for a serial column) BEFORE the outer CTE applies `orderBy(field(COUNT_FIELD).desc())` (`:158`). The outer popularity-sort only re-orders the already-selected `size` oldest tags; it does NOT select the most popular tags globally. **Empirical verdict (maintainer's 2026-05-20 test against demo.oddp.io)**: the endpoint returns the 30 oldest tags by creation re-sorted by usage_count, not the 30 with highest usage_count. — confidence: REFERENCE — see `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md` for the canonical drift trace (the repository sidecar enriched in parallel this session is the authoritative source; this service propagates the drift one-to-one to its callers without modification). — probe-id: P-LSN019-listMostPopular-drift (skeleton emitted below)

**S-B-2** — `updateRelationsWithDataEntity(dataEntityId, tagNames)` (`:96-121`) — Promise: "update the data entity's tag relations to the given set of names". Implementation: read-current → compute-diff → delete-removed → create-added → re-read. **Subtle**: the diff filters CURRENT relations to `!external` (`:102`) — only non-Collector relations are considered for diffing. EXTERNAL relations are NEVER touched (not in delete, not in update). This is INTENTIONAL (the Collector owns its rows; UI cannot impersonate); but the method name does not advertise the asymmetry. A user calling this method with `tagNames = {'A', 'B'}` against a data entity that has EXTERNAL relations to `{'C', 'D'}` will end up with `{A, B, C, D}` — not `{A, B}`. — confidence: HIGH (the filter at :102 is explicit) — DRIFT severity: MEDIUM — probe-id: P-LSN019-updateRelations-external-preserve (skeleton emitted below)

**S-B-3** — `divideTagsByExistence(tagNames)` (`:144-159`) — Promise: "split into existing + to-create". Implementation: `listByNames(tagNames)` then `.filter(n -> !existingTagNames.contains(n))`. The `existingTagNames.contains(n)` check is case-SENSITIVE (`listByNames` per existing repository sidecar invariant). A caller submitting `{'Postgres', 'postgres'}` when only `Postgres` exists in the DB will get `existing={Postgres}, toCreate={postgres}`. A subsequent `bulkCreate({postgres})` mints a second directory row — the `tag_name_unique` partial index does NOT collapse the two because Postgres comparison is byte-exact. The UI tag-search facet (case-insensitive substring match) then surfaces both as if they were distinct tags. — confidence: HIGH — DRIFT severity: MEDIUM — probe-id: P-LSN019-divide-case-sensitive (skeleton emitted below)

**S-B-4** — `getOrCreateTagsByName(tagNames)` (`:79-86`) vs `getOrInjectTagByName(tagNames)` (`:88-94`) — Promise: same shape (`Flux<TagPojo>` from `Set<String>`); difference is in race semantics. `getOrCreateTagsByName` uses `bulkCreate` (fail-on-duplicate → `UniqueConstraintException`); `getOrInjectTagByName` uses `ingestData` (upsert with `ON CONFLICT DO UPDATE` — silent race resolution). **Method names do NOT advertise the race difference.** A caller choosing `getOrCreateTagsByName` over `getOrInjectTagByName` (or vice versa) without reading both implementations will be surprised. The current call-site distribution: `getOrCreateTagsByName` is used by UI-driven write paths (TermService, DataEntityService, DatasetFieldService) where Spring will translate the exception to 400; `getOrInjectTagByName` is used by the Collector path where the race silence is desired (idempotent ingest). — confidence: HIGH — naming-drift severity: LOW (the methods do work as documented in the interface; the issue is the lack of documentation distinguishing them) — probe-id: P-LSN019-getOrCreate-vs-getOrInject-toctou (skeleton emitted below)

**S-B-5** — `deleteRelationsWithTerm(termId, tagsToKeep)` (`:123-134`) — Promise: "delete the relations to tags NOT in the keep set". Implementation: list current term-tags, compute name-difference vs `tagsToKeep`, delete the difference. **`tagsToKeep` is checked by name, not by id.** Case-sensitivity applies (per S-B-3 above). A term with tag `Postgres` and a caller passing `tagsToKeep = {'postgres'}` would result in `Postgres` being DELETED from the term despite the user's intent to keep it. — confidence: HIGH — DRIFT severity: LOW (only matters under case-only-different tags, which themselves are a S-B-3 artefact) — probe-id: P-LSN019-deleteRelationsWithTerm-case (skeleton emitted below)

**S-B-6** — `delete(tagId)` (`:57-70`) — Promise: "delete the tag". Implementation: SOFT-deletes the `tag` row, HARD-deletes `tag_to_term` + `tag_to_data_entity` rows, REFRESHES only the term-side search vectors. **`tag_to_dataset_field` rows are NOT deleted; main-search-entrypoint vectors are NOT refreshed.** A caller (TagController under `TAG_DELETE`) cannot know from the method signature that "delete" leaves dataset-field-side cleanup undone. — confidence: HIGH — drift severity: MEDIUM (logged in bugs_limitations_corner_cases) — probe-id: (covered by the bugs entry; no separate probe)

### Category C — Cardinality and bounds (off-by-one, range edges, empty inputs)

**S-C-1** — `getOrCreateTagsByName` (`:79-86`) and `getOrInjectTagByName` (`:88-94`) with EMPTY `tagNames` Set — the path goes `divideTagsByExistence({})` → `listByNames({})` (which produces an empty flux per the repository's empty-input guard at `:104` per the existing sidecar's invariant about empty-collection guards) → `Tuples.of([], [])` → `bulkCreate([])` or `ingestData([])` (both short-circuit to `Flux.just()` per the existing repository sidecar's invariant). Net: empty input returns empty output, no DB roundtrip beyond the `listByNames`. **No explicit empty guard at this service layer.** — confidence: HIGH — behaviour is correct, but not asserted by test.

**S-C-2** — `updateRelationsWithDataEntity` (`:96-121`) with EMPTY `tagNames` Set — the path goes: `currentRelations` (list of !external relations) + `updatedRelations` (empty, because `getOrCreateTagsByName({})` returns empty). The diff: `pojosToDelete = current \ updated = current` (every current relation is in the delete set). Then `deleteDataEntityRelations(pojosToDelete)` + `createDataEntityRelations(emptyList)` + `listDataEntityDtos(dataEntityId)`. **Empty `tagNames` is INTERPRETED as "remove all non-external tags from this data entity"** — this is a destructive operation triggered by an empty input. Caller (`DataEntityServiceImpl.upsertTags`) must NOT pass `{}` to mean "no-op"; that's a delete-all. — confidence: HIGH — behaviour is intentional (the diff semantic is well-defined) but the trap is real if a caller treats `{}` as "no change requested". — probe-id: P-LSN019-updateRelations-empty-deletes-all (skeleton emitted below)

**S-C-3** — `update` (`:44-55`) on a SOFT-DELETED tag — `getDto(tagId)` filters out soft-deleted rows (the inherited `idCondition` applies `deleted_at IS NULL` per the existing repository sidecar invariant) → `switchIfEmpty(NotFoundException)`. So `update(deletedTagId, ...)` returns 404, not "update a deleted tag". — confidence: HIGH — behaviour is correct; not asserted by test.

**S-C-4** — `delete` (`:57-70`) on a SOFT-DELETED tag — same `getDto` chain → 404. Idempotent for the soft-deletion semantic. — confidence: HIGH — behaviour is correct; not asserted by test.

**S-C-5** — `listMostPopular` with `size=0` — the path goes to `reactiveTagRepository.listMostPopular(query, ids, page, 0)` → `paginate(homogeneousQuery, ..., (page - 1) * size = (page-1)*0, 0)`. The exact behaviour of `paginate` with `limit=0` is in the abstract repository (not this file); likely returns an empty page. This service does NOT validate `size` is positive. — confidence: MEDIUM — caller responsibility per OpenAPI's `SizeParam` minimum=1, but the service layer does not enforce.

**S-C-6** — `listMostPopular` with `page=0` or negative — `(page - 1) * size` would compute `-size` for page=0 (negative offset). Postgres rejects negative offsets. The service does NOT validate. — confidence: MEDIUM — caller responsibility.

### Category D — Auth gates (per-method)

**S-D-1 (CANARY HEADLINE — SERVICE-LAYER AUTH POSTURE)** — Across all 9 public methods (`:37, 45, 57, 73, 80, 89, 97, 124, 137`), the service has:
- ZERO `@PreAuthorize` annotations
- ZERO `permissionService.hasPermission(...)` programmatic calls
- ZERO `OwnerAuthorizationFacade` invocations
- ZERO `SecurityContextHolder` reads
- ZERO programmatic permission checks of any kind

**Per-method auth posture under each auth mode**:

| Method | Auth gate | DISABLED | LOGIN_FORM / OAUTH2 / LDAP | S2S (ingestion) |
|---|---|---|---|---|
| `bulkCreate` (`:37`) | Controller `TAG_CREATE` | Open (no auth wall) | Gated by `TAG_CREATE` at controller perimeter | Not on ingestion path |
| `update` (`:45`) | Controller `TAG_UPDATE` | Open | Gated by `TAG_UPDATE` | Not on ingestion path |
| `delete` (`:57`) | Controller `TAG_DELETE` | Open | Gated by `TAG_DELETE` | Not on ingestion path |
| `listMostPopular` (`:73`) | Controller catch-all `authenticated()` | Open | Any authenticated user — full directory readable | Not on ingestion path |
| `getOrCreateTagsByName` (`:80`) | Side-door — varies | Open | Gated by `TERM_TAGS_UPDATE` / `DATA_ENTITY_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` per call site — **NEVER `TAG_CREATE`** | Not on this path (Collector uses getOrInjectTagByName) |
| `getOrInjectTagByName` (`:89`) | Side-door — Collector path | Open | N/A (only Collector calls) | Gated by `auth.ingestion.filter.enabled` S2S filter — **NEVER `TAG_CREATE`** |
| `updateRelationsWithDataEntity` (`:97`) | Side-door — DataEntity controller | Open | Gated by `DATA_ENTITY_TAGS_UPDATE` | Not on ingestion path |
| `deleteRelationsWithTerm` (`:124`) | Side-door — Term controller | Open | Gated by `TERM_TAGS_UPDATE` (inferred) | Not on ingestion path |
| `createRelationsWithTerm` (`:137`) | Side-door — Term controller | Open | Gated by `TERM_TAGS_UPDATE` (inferred) | Not on ingestion path |

**Finding**: the service-tier has zero auth posture. **Tag directory writes via the side-door surfaces (5 of 9 methods) bypass `TAG_CREATE` entirely.** This is logged in implicit_adrs as intentional (the per-feature permission model) but is recorded here as the per-method enumeration that the Stress Protocol mandates. — confidence: HIGH (every method verified by reading the line). — probe-id: P-LSN019-service-auth-zero (skeleton emitted below — confirms the absence is intentional, not a regression target)

### Category E — Resource boundaries (transactions, concurrency, idempotency, side-effect ordering)

**S-E-1** — `@ReactiveTransactional` coverage map (per-method):

| Method | `@ReactiveTransactional`? | DB statements | TX rationale |
|---|---|---|---|
| `bulkCreate` (`:37`) | NO (inherits from repository's `bulkCreate` `:113-114`) | 1 (INSERT batch) | Inherited TX boundary |
| `update` (`:45`) | YES (`:45`) | 5 (getDto, update, 3× search-vector refresh) | Multi-step write |
| `delete` (`:57`) | YES (`:58`) | 5 (getDto, deleteTermRel, deleteDataEntRel, delete tag, term-search-vector) | Multi-step write |
| `listMostPopular` (`:73`) | NO | 1 (CTE select) | Read-only |
| `getOrCreateTagsByName` (`:80`) | NO | 2-3 (listByNames, optional bulkCreate) | **TOCTOU surface** |
| `getOrInjectTagByName` (`:89`) | NO | 2-3 (listByNames, optional ingestData) | TOCTOU race silenced by upsert |
| `updateRelationsWithDataEntity` (`:97`) | YES (`:97`) | 5-7 (listTagRelations, listByNames, optional bulkCreate, deleteDataEntRel, createDataEntRel, listDataEntDtos) | Multi-step write |
| `deleteRelationsWithTerm` (`:124`) | NO | 2 (listByTerm, deleteTermRel) | **Multi-step read+write without TX** |
| `createRelationsWithTerm` (`:137`) | YES (`:137`) | 1 (createTermRel) but called within a caller's multi-step chain | TX continuity for the caller's preceding writes |

**Findings**:
- (i) `deleteRelationsWithTerm` is multi-step read+write WITHOUT `@ReactiveTransactional` — possible race; logged as bug (severity: MEDIUM).
- (ii) `getOrCreateTagsByName` is multi-step read+write WITHOUT `@ReactiveTransactional` — TOCTOU surface; logged as bug (severity: HIGH).
- (iii) `getOrInjectTagByName` is multi-step but the upsert silences the race — intentional; logged as implicit_adr.
- (iv) `createRelationsWithTerm` carries `@ReactiveTransactional` for a single-statement method — the rationale must be TX-continuity from the caller (the caller's preceding `getOrCreateTagsByName` writes need to be in the same TX as the relation-bind for atomicity). This is subtle: removing `@ReactiveTransactional` from `createRelationsWithTerm` would not change THIS method's TX boundary (one statement), but would lose the propagation. — confidence: MEDIUM (the rationale is inferred from the call-pattern; no comment defends it). — probe-id: P-LSN019-createRelationsWithTerm-tx-propagation (skeleton emitted below)

**S-E-2** — `Mono.zip` orchestration touches shared state in TWO places:
- `update`'s `updateSearchVectors` (`:162-167`) — three CONCURRENT search-vector refreshes via `Mono.zip`. The three repositories (`reactiveSearchEntrypointRepository` and `reactiveTermSearchEntrypointRepository`) write to DIFFERENT tables (`search_entrypoint` vs `term_search_entrypoint`), so the concurrency is safe. — confidence: HIGH.
- `delete`'s `Flux.zip(deleteTermRelations, deleteDataEntityRelations)` (`:64-65`) — two concurrent HARD-deletes against DIFFERENT relation tables (`tag_to_term` vs `tag_to_data_entity`). The concurrency is safe because the rows are independent. — confidence: HIGH.
- `updateRelationsWithDataEntity`'s `Mono.zip(currentRelations, updatedRelations)` (`:112`) — two concurrent READS against DIFFERENT tables (`tag_to_data_entity` for current vs `tag` + the diff computation for updated). The reads are within the same `@ReactiveTransactional` — they see a consistent snapshot per R2DBC's TX isolation. — confidence: HIGH.

**S-E-3** — Idempotency assessment per method:
- `bulkCreate` — NOT idempotent (re-invocation with the same names throws UniqueConstraintException).
- `update` — IDEMPOTENT (same form-data on the same tag yields the same result; the search-vector refresh is idempotent).
- `delete` — IDEMPOTENT-WITHIN-TAG-IDENTITY but DESTRUCTIVE-OF-RELATIONS (re-invocation returns 404 because the tag is soft-deleted; original invocation hard-deleted the relations, which are NOT re-creatable from this method).
- `listMostPopular` — IDEMPOTENT (read-only).
- `getOrCreateTagsByName` — NEAR-IDEMPOTENT (re-invocation with same names returns the same tag rows; no new rows created because they now exist).
- `getOrInjectTagByName` — IDEMPOTENT (upsert; re-invocation returns the same rows).
- `updateRelationsWithDataEntity` — IDEMPOTENT (re-invocation with the same name set yields the same final state; the diff would be empty on the second call).
- `deleteRelationsWithTerm` — IDEMPOTENT (re-invocation with the same keep set yields the same final state).
- `createRelationsWithTerm` — IDEMPOTENT (the underlying `createTermRelations` uses `onDuplicateKeyIgnore` per the existing repository sidecar).

**S-E-4** — Side-effect ordering on `update`:
1. Read `tagDto` via `getDto` (line 47)
2. Validate `!external` (line 49)
3. Apply formdata to pojo (line 51)
4. `repository.update` writes the row (line 52)
5. `updateSearchVectors` triple-zip (line 53)
6. Map to Tag (line 54)

Step 4 commits the row write; step 5 then issues three search-vector refreshes that depend on the row being updated. If the TX is `@ReactiveTransactional`, the row write and the vector refreshes are in the SAME TX — a failure in step 5 rolls back step 4. — confidence: HIGH.

**S-E-5** — Side-effect ordering on `delete`:
1. Read `tagDto` (line 60)
2. Validate `!external` (line 62)
3. Concurrent hard-delete of `tag_to_term` + `tag_to_data_entity` (lines 64-65 — `Flux.zip`)
4. Soft-delete the `tag` row (line 66)
5. Refresh term-side search vectors (lines 68-69)

Step 3 runs BEFORE step 4. If step 4 fails (or step 5 fails), the TX rolls back the soft-delete AND the hard-deletes. But step 3's concurrent hard-deletes are observable to other readers DURING the TX — under READ COMMITTED isolation, other readers see the hard-delete only after commit; under READ UNCOMMITTED, they could see partial state. Postgres default is READ COMMITTED, so this is safe. — confidence: HIGH.

### Category F — Banned phrases / hallucination check

Re-read of the sidecar above: no banned phrases (`probably`, `likely`, `should`, `looks right`, `presumably`, `defensible`, `canonical owner`, `monorepo default`, `safe to assume`) detected. All claims trace to file:line or to the existing repository / controller sidecars. The `confidence: REFERENCE` token is used per the brief's allowance for the S-B-1 drift verdict (the repository sidecar is the authoritative trace).

## probes_emitted

The Stress Protocol emits probe skeletons for findings that require empirical confirmation beyond the static read. Skeletons are written to `lineage/odd-platform/probes/` per the standard probe directory layout.

- `P-LSN019-listMostPopular-drift` — S-B-1 (CANARY HEADLINE). Confirm the endpoint returns oldest tags by id. Skeleton emitted at `lineage/odd-platform/probes/P-LSN019-listMostPopular-drift.md`.
- `P-LSN019-updateRelations-external-preserve` — S-B-2. Confirm EXTERNAL relations are preserved across a UI-side rename. Skeleton emitted.
- `P-LSN019-divide-case-sensitive` — S-B-3. Confirm `getOrCreateTagsByName({'Postgres','postgres'})` mints two rows when both are novel. Skeleton emitted.
- `P-LSN019-getOrCreate-vs-getOrInject-toctou` — S-B-4. Confirm concurrent identical novel-name submissions race differently between the two methods. Skeleton emitted.
- `P-LSN019-deleteRelationsWithTerm-case` — S-B-5. Confirm case-sensitive `tagsToKeep` deletes case-only-different relations. Skeleton emitted.
- `P-LSN019-updateRelations-empty-deletes-all` — S-C-2. Confirm `updateRelationsWithDataEntity(id, {})` removes all non-external relations. Skeleton emitted.
- `P-LSN019-service-auth-zero` — S-D-1 (CANARY HEADLINE — SERVICE-LAYER AUTH POSTURE). Confirm zero auth gates at the service layer via grep. Skeleton emitted.
- `P-LSN019-createRelationsWithTerm-tx-propagation` — S-E-1 (iv). Confirm that removing `@ReactiveTransactional` from `createRelationsWithTerm` would not change this method's TX boundary but would lose caller's TX-propagation. Skeleton emitted.

## sources

- understanding ← TagServiceImpl.java:1-168 (full file read) + TagController sidecar (this workspace) + ReactiveTagRepositoryImpl sidecar (this workspace) + ReactiveTagRepositoryImpl.java:137-167 (the listMostPopular drift evidence)
- concepts.entities.TagDto ← TagDto.java:1-6 + TagServiceImpl.java:11
- concepts.entities.TagPojo ← TagServiceImpl.java:15 + ReactiveTagRepositoryImpl sidecar concepts.entities
- concepts.operations.bulkCreate ← TagServiceImpl.java:37-42
- concepts.operations.update ← TagServiceImpl.java:44-55
- concepts.operations.delete ← TagServiceImpl.java:57-70
- concepts.operations.listMostPopular ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167 + ReactiveTagRepositoryImpl sidecar concepts.operations.listMostPopular
- concepts.operations.getOrCreateTagsByName ← TagServiceImpl.java:79-86
- concepts.operations.getOrInjectTagByName ← TagServiceImpl.java:88-94
- concepts.operations.updateRelationsWithDataEntity ← TagServiceImpl.java:96-121
- concepts.operations.deleteRelationsWithTerm ← TagServiceImpl.java:123-134
- concepts.operations.createRelationsWithTerm ← TagServiceImpl.java:136-142
- concepts.operations.divideTagsByExistence ← TagServiceImpl.java:144-159
- concepts.operations.updateSearchVectors ← TagServiceImpl.java:161-167
- concepts.invariants.[zero @PreAuthorize] ← TagServiceImpl.java:1-168 (verified absence)
- concepts.invariants.[!external guard] ← TagServiceImpl.java:49-50, 62-63
- concepts.invariants.[asymmetric delete cascade] ← TagServiceImpl.java:63-67 + ReactiveTagRepositoryImpl sidecar (deleteDatasetFieldRelations exists but is unused here)
- concepts.invariants.[!external diff filter] ← TagServiceImpl.java:102
- concepts.invariants.[hardcoded external=false] ← TagServiceImpl.java:109
- concepts.invariants.[multi-step writes without @ReactiveTransactional] ← TagServiceImpl.java:79-86 (getOrCreate), :88-94 (getOrInject), :123-134 (deleteRelationsWithTerm)
- upstream_callers.TagController ← TagController.java (verified via grep `tagService.` returning TagController.java + 4 others)
- upstream_callers.TermServiceImpl ← Grep `tagService.` → TermServiceImpl.java + existing TagController sidecar
- upstream_callers.DataEntityServiceImpl ← Grep `tagService.` → DataEntityServiceImpl.java + existing TagController sidecar (REFACTOR-223 finding)
- upstream_callers.DatasetFieldServiceImpl ← Grep `tagService.` → DatasetFieldServiceImpl.java
- upstream_callers.ExternalTagIngestionRequestProcessor ← Grep `tagService.` → service/ingestion/processor/ExternalTagIngestionRequestProcessor.java + existing TagController sidecar
- downstream_side_effects.search-vector-refresh ← TagServiceImpl.java:53, :68-69, :161-167
- dependencies_semantic.requires-feature.ReactiveTagRepository ← TagServiceImpl.java:32 + ReactiveTagRepository.java:15-53
- dependencies_semantic.requires-feature.TagMapper ← TagServiceImpl.java:33
- dependencies_semantic.requires-feature.search-vector-repositories ← TagServiceImpl.java:34-35
- dependencies_semantic.requires-runtime.@ReactiveTransactional ← ReactiveTransactional.java:1-13
- tests_coverage_semantic.[zero service-tier tests] ← Glob `odd-platform-api/src/test/**/TagServiceImpl*Test*.java` (no files) + Glob `odd-platform-api/src/test/**/Tag*Test*.java` (no files) — verified absence
- tests_coverage_semantic.uncovered_behaviours.* ← TagServiceImpl.java (each behaviour file:line)
- docs_link_semantic.declared_docs ← Grep `@docs` in TagServiceImpl.java (no match) — explicit absence
- implicit_adrs.[zero service-tier auth] ← TagServiceImpl.java:31-167
- implicit_adrs.[external-immutable] ← TagServiceImpl.java:49-50, 62-63, 102, 109
- implicit_adrs.[search-vector-in-tx] ← TagServiceImpl.java:53, 68-69, 161-167
- implicit_adrs.[tx-scope-multi-statement] ← TagServiceImpl.java:45, 58, 97, 137
- bugs_limitations_corner_cases.[deleteRelationsWithTerm-no-tx] ← TagServiceImpl.java:123-134
- bugs_limitations_corner_cases.[getOrCreate-toctou] ← TagServiceImpl.java:79-86, 144-159 + ReactiveAbstractCRUDRepository.java:113-126
- bugs_limitations_corner_cases.[case-sensitive-divide] ← TagServiceImpl.java:144-159 + ReactiveTagRepositoryImpl sidecar invariants
- bugs_limitations_corner_cases.[delete-cascade-asymmetric] ← TagServiceImpl.java:63-67
- bugs_limitations_corner_cases.[delete-search-vector-incomplete] ← TagServiceImpl.java:64-69 vs :162-166
- bugs_limitations_corner_cases.[bulkCreate-no-local-tx] ← TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:113-114
- bugs_limitations_corner_cases.[update-triple-zip-rollback] ← TagServiceImpl.java:44-55, 161-167
- security.auth_mode_relevance ← TagServiceImpl.java:31-167 (no auth-mode coupling at this layer)
- security.ingestion_filter_relevance ← TagServiceImpl.java:88-94 + ExternalTagIngestionRequestProcessor.java (per existing TagController sidecar)
- security.authorization_assertions ← TagServiceImpl.java:31-167 (verified absence)
- security.owner_scoping ← ReactiveTagRepositoryImpl sidecar invariant + TagServiceImpl.java (no owner reference)
- security.data_exposure ← TagServiceImpl.java per-method return types
- security.known_security_gaps ← TagServiceImpl.java:31-167 + existing TagController sidecar (REFACTOR-223)
- performance.hot_paths.listMostPopular ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167
- performance.hot_paths.updateRelationsWithDataEntity ← TagServiceImpl.java:96-121
- performance.hot_paths.getOrCreate-and-getOrInject ← TagServiceImpl.java:79-94
- performance.throughput_characteristics ← TagServiceImpl.java (all methods reactive)
- performance.resource_allocation ← TagServiceImpl.java:83, 147, 112
- performance.scaling_characteristics ← TagServiceImpl.java (statelessness verified by reading)
- performance.known_performance_gaps.listMostPopular-no-cap ← TagServiceImpl.java:72-77
- performance.known_performance_gaps.diff-on-m-times-n ← TagServiceImpl.java:114-116
- stress_findings.A ← TagServiceImpl.java (verified absence of literal numerics)
- stress_findings.B.S-B-1 ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:148, 158 + ReactiveTagRepositoryImpl sidecar
- stress_findings.B.S-B-2 ← TagServiceImpl.java:96-121, especially :102, :109
- stress_findings.B.S-B-3 ← TagServiceImpl.java:144-159 + ReactiveTagRepositoryImpl sidecar invariant
- stress_findings.B.S-B-4 ← TagServiceImpl.java:79-94 + ReactiveAbstractCRUDRepository.java:113-126 + ReactiveTagRepositoryImpl.java:180-213 (per existing repository sidecar)
- stress_findings.B.S-B-5 ← TagServiceImpl.java:123-134
- stress_findings.B.S-B-6 ← TagServiceImpl.java:57-70
- stress_findings.C ← TagServiceImpl.java (each finding cited)
- stress_findings.D.S-D-1 ← TagServiceImpl.java:1-168 (verified end-to-end absence)
- stress_findings.E.S-E-1 ← TagServiceImpl.java (each method's annotation status verified)
- stress_findings.E.S-E-2 ← TagServiceImpl.java:64-65, 112, 162-167
- stress_findings.E.S-E-3 ← TagServiceImpl.java per-method semantics
- stress_findings.E.S-E-4 ← TagServiceImpl.java:44-55
- stress_findings.E.S-E-5 ← TagServiceImpl.java:57-70

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence is verified by two Globs; the per-behaviour uncovered list is anchored to file:line)
- docs_link_semantic: LOW (inferred only; no declared @docs)
- implicit_adrs: MEDIUM (the auth-zero ADR is inferred from pattern-consistency; the other three are HIGH from explicit evidence)
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- stress_findings: HIGH (every category exhausted; absences recorded explicitly; the S-B-1 drift is REFERENCE to the repository sidecar per the brief's allowance; S-D-1 service-layer-zero-auth is the headline service-tier finding)

## Maintainer notes

(no prior sidecar — left empty for future maintainer additions)

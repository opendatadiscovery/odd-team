---
node_id: "odd-platform java repository reactive repository:ReactiveTagRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-20-LSN-019-canary
schema_version: v0.4.0
stress_protocol_applied: true
---

# ReactiveTagRepositoryImpl — semantic understanding

## understanding

`ReactiveTagRepositoryImpl` is the jOOQ/Reactor persistence surface for everything ODD does with `Tag` rows and their three relation tables (`TAG_TO_DATA_ENTITY`, `TAG_TO_DATASET_FIELD`, `TAG_TO_TERM`). It extends `ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` so all base CRUD (`create`, `bulkCreate`, `update`, `delete`, `list`) reads through a `tag.deleted_at IS NULL` filter applied via `addSoftDeleteFilter`. Beyond CRUD, the class hosts (a) read-side aggregations — `getDto`, `listDataEntityDtos`, `listDatasetFieldDtos`, and the popular-tags surface `listMostPopular` (which is **misnamed at the SQL layer**: the `paginate(...)` call at line 148 wraps the homogeneous tag select with `ORDER BY tag.id ASC LIMIT size` BEFORE counts are computed, so the result is "the `size` lowest-ID tags re-ranked by count desc", NOT "the `size` tags with highest counts" — see `stress_findings.B1` for the full chain trace and LSN-019 for the empirical proof); (b) relation lookups (`listByNames`, `listByTerm`, `listTagsRelations`, `listTagRelations`) that drive the UI tag dropdown and the diff in `TagServiceImpl.updateRelationsWithDataEntity`; (c) per-relation create/delete primitives — `createDataEntityRelations` / `createTermRelations` / `createDatasetFieldRelations` (all `onDuplicateKeyIgnore`) and four `delete*Relations` overloads; and (d) the bulk-upsert `ingestData(List<TagPojo>)` driven by the `TAG_NAME_UNIQUE` partial index with an `onConflict(...).where(TAG.DELETED_AT.isNull()).doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME))` clause that is the platform's only DB-level race protection against concurrent novel-name creation.

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
    "`listMostPopular(String query, List<Long> ids, int page, int size)` — **NAME PROMISES POPULARITY-RANKED RESULTS; IMPLEMENTATION DELIVERS ID-ASC-PAGINATED THEN-RANKED RESULTS.** The JOOQ chain (lines 138-167) is: (1) line 144-145 build a homogeneous `selectFrom(TAG).where(listCondition(query) + optional id-list filter)`; (2) **line 148 wraps with `paginate(homogeneousQuery, [OrderByField(TAG.ID, ASC)], (page-1)*size, size)` — this is the SQL layer that `ORDER BY tag.id ASC LIMIT size OFFSET (page-1)*size`-truncates the candidate pool to `size` rows BEFORE counts are computed** (`JooqQueryHelper.paginate` lines 63-90: inner `SELECT u.*, count(*) OVER () _total, row_number() OVER (ORDER BY u.id ASC) _row FROM (homogeneous) u ORDER BY u.id ASC LIMIT size OFFSET (page-1)*size`); (3) line 150 materialises this as `tag_cte`; (4) line 151 `getDataEntityWithDatasetFields` (lines 373-391) builds `WITH tag_cte AS (...) SELECT ... LEFT JOIN tag_to_data_entity GROUP BY tag_cte.fields UNION ALL ... LEFT JOIN tag_to_dataset_field GROUP BY tag_cte.fields AS union_usages`; (5) lines 153-158 the OUTER select sums counts across both arms and adds `ORDER BY count DESC` — but the candidate pool was ALREADY truncated to the `size` lowest-ID tags. Net SQL behaviour: 'the `size` oldest tags (by tag.id ASC), re-ranked among themselves by count desc'. Equal-count ties are broken by PostgreSQL's natural row order, which inherits from the CTE = tag.id ASC. Empirical confirmation (`retrospectives/LSN-019:23-32`, 2026-05-20): 35 tags created with known IDs, every entity tagged by all 35, size=30 → the 30 oldest tags (IDs 1-30) are returned in tag.id ASC order; the 5 newest tags (IDs 31-35) are missing from the response despite being equally popular.",
    "`listTagRelations(Collection<Long> dataEntityIds)` — bulk fetch of `tag_to_data_entity` rows; soft-delete filter on tag side; powers diff in `TagServiceImpl.updateRelationsWithDataEntity` + `ExternalTagIngestionRequestProcessor.updateDatasetEntityTags`",
    "`ingestData(List<TagPojo> tags)` — bulk upsert with `INSERT ... ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *` (`ReactiveTagRepositoryImpl.java:199-210`); uses `Indexes.TAG_NAME_UNIQUE.getFields()` to pin the conflict target to the `name` column",
    "`createDataEntityRelations(Collection<TagToDataEntityPojo>)` / `createDatasetFieldRelations(Collection<TagToDatasetFieldPojo>)` / `createTermRelations(long termId, Collection<Long> tagIds)` — bulk inserts with `onDuplicateKeyIgnore` (idempotent assignment); all build a single INSERT per call by chaining `.newRecord()`",
    "Four `delete*Relations` overloads — all hard-delete (`DSL.delete(...)`); relation tables are NOT soft-deleted, only `tag` rows are"
  ]
- invariants: [
    "Soft-delete is mediated by `deleted_at IS NULL` at the `tag` table level (`V0_0_64__remove_is_deleted_field.sql:105`); the `is_deleted` boolean column was removed in V0_0_64 (`V0_0_64__remove_is_deleted_field.sql:108`: `ALTER TABLE tag DROP COLUMN IF EXISTS is_deleted`). The earlier history is `V0_0_36__refactor_unique_index.sql:4` (`is_deleted IS FALSE`) → `V0_0_57__change_tag_unique_constraint_semantics.sql:3` (same but later replaced) → `V0_0_64`. Three migrations to land on the current shape.",
    "Tag-name uniqueness is enforced by the PARTIAL unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64__remove_is_deleted_field.sql:105`). A soft-deleted Tag does NOT block reinsertion of the same name — the partial index excludes deleted rows. This is the protection that allows `ingestData` to use `ON CONFLICT (name) WHERE DELETED_AT IS NULL DO UPDATE` cleanly.",
    "Tag-name match in `listByNames` is case-SENSITIVE because the underlying jOOQ `TAG.NAME.in(names)` translates to a SQL `IN` predicate against a `text` column without `LOWER()` or `ILIKE`. The popular-tags query in `listMostPopular` uses `listCondition` from the parent, which applies `nameField.containsIgnoreCase(nameQuery)` for the `query` parameter only — so substring-search-style queries are case-insensitive but exact-name dedup-lookup is case-sensitive. `Postgres` and `postgres` will be treated as two different tags by `TagServiceImpl.divideTagsByExistence`, even though `getPopularTagList(query='post')` would match both.",
    "**`listMostPopular`'s pagination is applied INSIDE the CTE (before counts), not OUTSIDE (after ranking).** The `paginate(...)` call (line 148) takes the homogeneous `selectFrom(TAG).where(conditions)` and wraps it with `ORDER BY tag.id ASC LIMIT size`. The CTE is built FROM the paginated result. Therefore the candidate set entering the count-aggregation is the size lowest-ID tags matching the query — NOT a global popularity-ordered subset. Any tag added later (higher ID) that has high real-world usage cannot enter the result on page 1 if the directory already exceeds `size` tags. See stress_findings.B1 for the full chain trace.",
    "The `Indexes.TAG_NAME_UNIQUE` jOOQ handle is the SINGLE source of conflict-target truth for the upsert path — `conflictFields` is computed dynamically (`ReactiveTagRepositoryImpl.java:199-202`) rather than hardcoded; a migration that changes the index would automatically change the conflict target. By contrast, the `WHERE TAG.DELETED_AT.isNull()` clause (`:207`) is hardcoded and depends on the partial-index predicate remaining `deleted_at IS NULL`. If the index predicate ever changed (e.g. to also filter on `is_important = false`), the `where` clause in this method would silently fail to match.",
    "The `ingestData` upsert sets `TAG.NAME = DSL.excluded(TAG.NAME)` on conflict — a no-op update that exists solely to trigger the RETURNING clause. Without this, conflicting rows would be silently skipped and the caller would not see the existing Tag's id. Critical for the caller (`TagServiceImpl.getOrInjectTagByName` for the ExternalTagIngestionRequestProcessor path) to be able to attach existing-tag relations.",
    "All relation-create methods use `onDuplicateKeyIgnore` rather than `onConflict(...).doUpdate(...)` — relation rows are write-once-as-truth; their conflict semantics is 'no-op if already exists'. By contrast, the `ingestData` upsert touches the same row (sets name = excluded name) to keep the RETURNING contract intact.",
    "Empty-collection guards on every batch method (`CollectionUtils.isEmpty(...)` short-circuits at lines 103-105, 181-183, 219-221, 246-248, 267-270, 310-312, 327-329; `tagIds.isEmpty()` at 267-270, 327-329) — caller may pass empty without DB roundtrip. This is consistent across the codebase but explicit here because `ingestData` and the bulk relation methods would otherwise issue empty INSERT statements that jOOQ does NOT accept.",
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

## stress_findings

The Stress Protocol (LSN-019, Rule 9) fires on every detected trigger across five categories. Each finding records: trigger location, the auto-fired question, and ONE of three resolutions — trace-answer (STATIC-INFERRED with file:line), probe-answer (PROBE-NEEDED + emitted probe), or out-of-scope reference (REFERENCE + node_id).

### Category A — Tunables (numeric / null / boundary)

- **A1** — page=N parameter handling in `listMostPopular(query, ids, page, size)` (line 138). Question: what does the code do at `page=0`, `page=-1`, `page=null` (autoboxing)? Trace-answer: parameter is `int page`, not `Integer` (line 138), so the framework's `@RequestParam` autoboxing of a literal `null` querystring throws `NumberFormatException` upstream at controller boundary; `page=0` → `(0-1)*size = -size` → `LIMIT size OFFSET -size` → PostgreSQL rejects negative OFFSET with `SQL state 22023, "OFFSET must not be negative"`; `page=-1` → `OFFSET -2*size` → same error. No defensive guard in this file. Evidence: ReactiveTagRepositoryImpl.java:138, 148 + JooqQueryHelper.java:63-90 (no clamping). Confidence: STATIC-INFERRED.

- **A2** — `size=N` parameter handling. Question: what does the code do at `size=0`, `size=-1`, `size=100000`? Trace-answer: `size=0` → `LIMIT 0` → empty result with `_total` correctly reflecting underlying row count (via `count() OVER ()` at JooqQueryHelper:73); `size=-1` → `LIMIT -1` → PostgreSQL semantics: negative LIMIT raises SQL error; `size=100000` → executes a full-directory UNION-ALL CTE with no upper bound. No size cap anywhere in the file. Evidence: ReactiveTagRepositoryImpl.java:138, 148 (size passed through verbatim) + JooqQueryHelper.java:81 (`.limit(limit)` unbounded). Confidence: STATIC-INFERRED.

- **A3** — `BATCH_SIZE` for `executeInPartitionReturning` in `ingestData` (line 192). Question: what at batch >> BATCH_SIZE? Trace-answer: `executeInPartitionReturning` partitions at `BATCH_SIZE` (declared in `JooqReactiveOperations.java:69-84`) and sequentially chains per-partition `INSERT ... ON CONFLICT ... DO UPDATE` statements via `Flux.concat`. A 5000-row upsert at BATCH_SIZE=1000 → 5 sequential round-trips, all in the caller's TX. No parallelism. Confidence: STATIC-INFERRED (the BATCH_SIZE constant value itself is outside this file's scope; the partition-and-concat behaviour is verified).

- **A4** — `listByNames(Collection<String> names)` (line 120) at `names=[]` (empty). Question: what at empty collection? Trace-answer: there is NO empty-collection guard in `listByNames` (unlike `listTagsRelations` line 103, `ingestData` line 181, etc.). `TAG.NAME.in([])` translates to `TAG.NAME IN ()` — jOOQ emits a SQL-equivalent that PostgreSQL evaluates as FALSE for every row (zero matches). Behaviour is harmless but inconsistent with the rest of the file. Confidence: STATIC-INFERRED.

- **A5** — `listMostPopular` with `ids=[]` (empty Long list). Question: what at empty ids? Trace-answer: line 141 checks `CollectionUtils.isNotEmpty(ids)` before adding `TAG.ID.in(ids)` to conditions — empty ids skips the filter (= no id constraint), NOT zero results. Asymmetric with `listByNames` (which would emit `WHERE ID IN ()` and return zero). This is the documented contract for `getPopularTagList` (per OpenAPI `IdsParam`, optional). Confidence: STATIC-INFERRED.

### Category B — Name-behavior pairs

- **B1 — listMostPopular: NAME PROMISES POPULARITY; SQL DELIVERS ID-ASC-PAGINATED THEN-RANKED. (LSN-019 SMOKING GUN.)** Trigger: method name `listMostPopular` (line 138) + OpenAPI description `'Gets the list of existing tags sorted by popularity'` (`odd-platform-specification/openapi.yaml:345`). Question: does the SQL deliver popularity-ordered results across the full directory? Trace-answer: NO. Chain trace, line by line:
  - Line 144-145: `final Select<TagRecord> homogeneousQuery = DSL.selectFrom(TAG).where(conditions);` — flat tag select, soft-delete filter via `listCondition`, optional name-contains, optional id-list filter.
  - **Line 148: `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)` — this is the load-bearing call.** `paginate` lives in `JooqQueryHelper.paginate(baseSelect, orderByFields, offset, limit)` (lines 63-90); the function takes the homogeneous select, wraps it with `count(*) OVER () AS _total, row_number() OVER (ORDER BY tag.id ASC) AS _row`, and then applies `.orderBy(tag.id ASC).limit(size).offset((page-1)*size)`. Result: the homogeneous tag set is ORDER-BY-TAG.ID-ASC-LIMITED to `size` rows BEFORE any count aggregation happens.
  - Line 150: `final Table<? extends Record> tagCte = select.asTable("tag_cte");` — the size-truncated, ID-ASC-ordered result becomes the CTE.
  - Line 151 + lines 373-391: `getDataEntityWithDatasetFields` builds `WITH tag_cte AS (size-truncated-paginated-select) SELECT tag_cte.fields, ... LEFT JOIN tag_to_data_entity ... GROUP BY tag_cte.fields UNION ALL SELECT tag_cte.fields, ... LEFT JOIN tag_to_dataset_field ... GROUP BY tag_cte.fields AS union_usages`. The CTE is fixed at this point — the count aggregation runs OVER the already-truncated set.
  - Lines 153-158: the outer select sums counts across the UNION-ALL arms and `.orderBy(field(COUNT_FIELD).desc())`. This DOES re-rank by count desc — but only WITHIN the already-truncated candidate pool.
  - Net behaviour: **'pick the `size` lowest-ID tags matching the search/id filter; rank those `size` tags by usage count desc; on ties, PostgreSQL preserves the CTE-natural row order which is tag.id ASC'.** For a directory of 35 tags (all with equal usage_count) and size=30, page=1: tags with id=1..30 are returned in tag.id ASC order; tags with id=31..35 are not in the response at all.
  - Empirical evidence: `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32` (2026-05-20 maintainer test: created 35 tags at known timestamps with every entity tagged by all 35; observed return = OLDEST 30 by creation_at ASC, NOT highest count).
  - Evidence: ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90 + ReactiveAbstractCRUDRepository.java:294-299 (`paginate` delegate) + LSN-019:23-32 (empirical).
  - Confidence: STATIC-INFERRED via end-to-end JOOQ chain trace + EMPIRICAL via LSN-019; probe `P-010` queued to pin the SQL behaviour in CI so future regressions surface.

- **B2 — listByNames: NAME promises name-based lookup.** Trigger: method name `listByNames(Collection<String> names)` (line 120). Question: case sensitivity, null handling, soft-delete filter, duplicate names in input. Trace-answer:
  - Case sensitivity: `TAG.NAME.in(names)` (line 122) translates to SQL `name IN (...)`, case-SENSITIVE against the `text` column. `listByNames(["PII"])` does NOT match a row with `name='pii'`. (Evidence: ReactiveTagRepositoryImpl.java:120-125 + no LOWER/ILIKE.)
  - Null handling: `names=null` → `TAG.NAME.in(null)` → jOOQ throws `NullPointerException` (Collection.iterator). No defensive guard. Trace-answer: STATIC-INFERRED via jOOQ contract.
  - Soft-delete filter: applied via `addSoftDeleteFilter(TAG.NAME.in(names))` at line 122 — soft-deleted tags ARE filtered out. (Evidence: line 122 + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104.)
  - Duplicate names in input: `names=["PII", "PII"]` → SQL `name IN ('PII', 'PII')` → PostgreSQL dedupes the predicate; one row returned. Trace-answer: STATIC-INFERRED via SQL contract.
  - Confidence: STATIC-INFERRED.

- **B3 — getDto: NAME promises single-row fetch.** Trigger: method name `getDto(long id)` (line 55). Question: soft-delete posture, what at non-existent id. Trace-answer: `idCondition(id)` (line 61) is overridden in `ReactiveAbstractSoftDeleteCRUDRepository.idCondition` (line 77-79) to add `deleted_at IS NULL`. Soft-deleted tag → `Mono.empty()`. Non-existent id → `Mono.empty()`. No throwing on miss. (Evidence: ReactiveTagRepositoryImpl.java:55-66 + ReactiveAbstractSoftDeleteCRUDRepository.java:77-79.) Confidence: STATIC-INFERRED.

- **B4 — ingestData: NAME promises upsert; what's the conflict-key semantics?** Trigger: method name `ingestData(List<TagPojo>)` (line 180). Question: conflict target shape, what on conflict, what at empty input. Trace-answer:
  - Conflict target: `Indexes.TAG_NAME_UNIQUE.getFields()` (line 199-202) → dynamically resolves to `[name]` from the jOOQ-generated index handle. A future migration that changes the index to `(name, namespace_id)` would automatically propagate.
  - Conflict predicate: HARDCODED `WHERE TAG.DELETED_AT.isNull()` (line 207) — matches the partial index's WHERE clause. Brittle if index predicate ever changes.
  - On conflict: `doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME))` (lines 208-209) — sets name to itself (no-op update); purpose is to TRIGGER the RETURNING clause so the caller can see the existing row's id.
  - Empty input: `CollectionUtils.isEmpty(tags)` short-circuits at lines 181-183 → `Flux.just()`.
  - Confidence: STATIC-INFERRED.

- **B5 — deleteDataEntityRelations(long tagId) vs deleteDataEntityRelations(Collection<TagToDataEntityPojo>).** Trigger: two overloads with similar names (lines 218, 235). Question: do they have the same conflict semantics on missing-row? Trace-answer:
  - `deleteDataEntityRelations(Collection<TagToDataEntityPojo> relations)` at line 218: builds OR-of-AND condition over all pojos, hard-DELETE with `.returning()`. Returns `Flux<TagToDataEntityPojo>` of actually-deleted rows. Missing rows are silently absent from the response.
  - `deleteDataEntityRelations(long tagId)` at line 235: hard-DELETE all relations for a tag, `.returning()`. Returns deleted rows; on no-rows-match returns an empty Flux.
  - Both are idempotent on missing rows (no exception). Symmetric posture; reasonable.
  - Confidence: STATIC-INFERRED.

- **B6 — `listMostPopular` query parameter via `listCondition(query)`.** Trigger: query parameter `String query` in a name-promising-popularity method (line 138). Question: does `query` filter by tag name? Trace-answer: `listCondition(query)` is inherited from `ReactiveAbstractCRUDRepository.listCondition` (lines 236-249); if `StringUtils.isNotEmpty(nameQuery)` adds `nameField.containsIgnoreCase(nameQuery)` (line 243) — case-INSENSITIVE substring match on `tag.name`. So `listMostPopular(query='post', size=30)` returns up to 30 tags whose names match `%post%` case-insensitively, then ranked by count desc within the truncated pool (per B1). Confidence: STATIC-INFERRED.

### Category C — Orderings / pagination / aggregation

- **C1 — `.orderBy(field(COUNT_FIELD).desc())` at line 158.** Question: where exactly is this ORDER BY applied in the SQL, and what is the tie-break? Trace-answer:
  - The ORDER BY count DESC is applied at the OUTERMOST select, AFTER the UNION-ALL has been wrapped as `union_usages` and the per-tag count has been summed across both arms (lines 153-156).
  - Tie-break: there is NO secondary ORDER BY clause. When two tags have equal aggregated count, the order between them is determined by PostgreSQL's natural-row-order semantics within the GROUP BY result — practically, this inherits from the CTE's row order, which is `tag.id ASC` per the inner `paginate(...)` (B1).
  - For LSN-019's empirical scenario (every tag tagged by all entities, all counts equal), the tie-break dominates — and the result order is tag.id ASC. The "ORDER BY count DESC" at line 158 has no effective discriminating power.
  - Evidence: ReactiveTagRepositoryImpl.java:158 + lines 144-150 (inner ordering) + JooqQueryHelper.java:74, 80 (row_number + outer ORDER BY tag.id ASC).
  - Confidence: STATIC-INFERRED; pinned by probe P-010 (emitted).

- **C2 — `paginate(..., List.of(new OrderByField(TAG.ID, SortOrder.ASC)), ...)` at line 148.** Question: what default ordering does `paginate` apply? Trace-answer:
  - `JooqQueryHelper.paginate` (lines 63-90) takes an explicit `List<OrderByField>` — no default magic. Caller passes `[(TAG.ID, ASC)]`.
  - The function uses this list THREE times: (1) line 74 as the `row_number() OVER (ORDER BY ...)` window; (2) line 80 as the inner `ORDER BY ... LIMIT ... OFFSET ...` for the actual truncation; (3) line 89 as the outermost ORDER BY of the paginate result.
  - All three places ORDER BY tag.id ASC. There is no ORDER BY count anywhere in the paginate output.
  - Evidence: JooqQueryHelper.java:74, 80, 89 + ReactiveTagRepositoryImpl.java:148.
  - Confidence: STATIC-INFERRED.

- **C3 — UNION-ALL between `tag_to_data_entity` and `tag_to_dataset_field` arms (lines 373-391).** Question: ordering preservation across UNION ALL; aggregation correctness when same tag has both data-entity and dataset-field relations. Trace-answer:
  - PostgreSQL UNION ALL preserves no order; the outer select GROUPs BY tag_cte.fields (line 157) → per-tag aggregation across both arms. `DSL.sum(unionUsages.field(COUNT_FIELD, Integer.class))` (line 155) sums the counts: total = data-entity-count + dataset-field-count. `DSL.boolOr(unionUsages.field(EXTERNAL_FIELD, Boolean.class))` (line 154) → external flag is TRUE if either arm contributes a TRUE.
  - Note that the dataset-field arm computes external as `ORIGIN.ne(TagOrigin.INTERNAL.name())` (line 385) — so `EXTERNAL_STATISTICS` is folded into `external=true`. The data-entity arm uses the literal `external` column.
  - Correctness: a tag used 3x on data entities + 2x on dataset fields → `count=5`. Verified by inspection of the GROUP BY shape.
  - Confidence: STATIC-INFERRED.

- **C4 — `listDataEntityDtos` / `listDatasetFieldDtos` — no ORDER BY.** Trigger: list-returning methods (lines 68-98) with no `.orderBy(...)`. Question: what is the natural order? Trace-answer: PostgreSQL returns rows in unspecified order for `SELECT ... GROUP BY tag.fields`. In practice, PG often returns in primary-key order (tag.id ASC) for small group counts on indexed columns, but this is NOT guaranteed and could shift with VACUUM / planner changes. Callers should not depend on order. (None of the callers in `TagServiceImpl` / `DataEntityServiceImpl` etc. assume an order — they pass to UI which sorts client-side per the operator's facet selection.) Confidence: STATIC-INFERRED.

- **C5 — `listByNames` — no ORDER BY.** Trigger: list-returning method (line 120) with no `.orderBy(...)`. Question: caller-visible order? Trace-answer: caller `TagServiceImpl.divideTagsByExistence` (line 145) iterates the result into a `Set<String>` (`existingTagNames`), so order doesn't matter. Confidence: STATIC-INFERRED.

- **C6 — `listTagsRelations` / `listTagRelations` — no ORDER BY.** Trigger: list-returning methods (lines 100, 170). Question: order? Trace-answer: callers materialise to a `Set` / `Map` (per `ExternalTagIngestionRequestProcessor`), order-independent. Confidence: STATIC-INFERRED.

### Category D — Authorization gates (repository-layer interrogation)

- **D1 — auth_gates: [].** Question: are there any `@PreAuthorize`, `permissionService.hasPermission(...)`, owner-scoping filters in this file? Trace-answer: NONE. End-to-end grep of the file (lines 1-401) returns zero authorization checks. The repository trusts its caller to have evaluated permissions upstream. (Evidence: ReactiveTagRepositoryImpl.java:1-401 (no `@PreAuthorize`, no `permissionService`, no `owner_id` column reference, no per-Owner filter).)
  - The architectural posture is: repository = data plane; authorization = controller perimeter via `SecurityConstants.SECURITY_RULES` for the dedicated route + zero defence for the side-channels (REFACTOR-223 / DOC-GAP-168 captures this directory-write surface).
  - `listMostPopular` is reachable from any caller able to invoke it; the controller-level gate at `GET /api/tags/popular` is `pathMatchers("/**").authenticated()` (per the TagController sidecar's analysis) — every authenticated user under LOGIN_FORM/OAUTH2/LDAP can enumerate the directory.
  - Confidence: STATIC-INFERRED.

### Category E — Resource boundaries (concurrency / TX / locks / cache)

- **E1 — `ingestData` upsert race.** Trigger: `INSERT ... ON CONFLICT ... DO UPDATE` at lines 204-210. Question: can two simultaneous calls produce corrupted state? Trace-answer:
  - The partial unique index `tag_name_unique` (V0_0_64:103-105) serialises by-name conflicts at the PostgreSQL B-tree level. Two parallel TXs inserting the same novel name: one wins, one routes to `DO UPDATE`. Result: both callers get back the same `tag.id` via RETURNING — `ingestData` is race-safe by construction.
  - Replay-safe: yes; the upsert is idempotent w.r.t. tag identity.
  - No advisory lock, no `SELECT ... FOR UPDATE`, no `synchronized` block — the partial unique index is the entire locking mechanism.
  - Lock contention: per-name only (the B-tree lock is on the index entry); two parallel ingestions of DIFFERENT names do not block.
  - Confidence: STATIC-INFERRED.

- **E2 — `bulkCreate` race (inherited).** Trigger: `bulkCreate` is the OTHER write path for novel names (used by `TagServiceImpl.getOrCreateTagsByName` line 82). Question: same race protection? Trace-answer: NO. `ReactiveAbstractCRUDRepository.bulkCreate` (lines 113-126) has NO `onConflict` clause — pure `INSERT INTO tag (...) RETURNING *`. On unique-constraint violation, PostgreSQL throws which jOOQ translates via `ExceptionUtils.translateDatabaseException` (`ExceptionUtils.java:54-56`) to `UniqueConstraintException("Tag with this name already exists")`. So `TagServiceImpl.getOrCreateTagsByName`'s TOCTOU between `listByNames` and `bulkCreate` produces a user-visible 500 on the losing caller. Race posture: NOT safe. (Documented in `bugs_limitations_corner_cases` below.) Confidence: STATIC-INFERRED.

- **E3 — Transaction boundaries.** Trigger: no `@ReactiveTransactional` on any method in this file (lines 1-401 grep). Question: how does TX composition work? Trace-answer: methods are TX participants, not initiators. The upstream `TagServiceImpl.updateRelationsWithDataEntity` (`@ReactiveTransactional` at TagServiceImpl.java:97), `TagServiceImpl.delete` (`:58`), `TagServiceImpl.update` (`:45`), `TagServiceImpl.createRelationsWithTerm` (`:137`), and `ExternalTagIngestionRequestProcessor.process` (`:38`) carry the TX. The inherited `bulkCreate` and `bulkUpdate` from `ReactiveAbstractCRUDRepository` carry their own `@ReactiveTransactional` (lines 113-114, 129-130). Confidence: STATIC-INFERRED.

- **E4 — `addSoftDeleteFilter` composition under concurrent delete + read.** Trigger: soft-delete filter applied via `deleted_at IS NULL` at lines 75, 92, 122, 141 (via listCondition). Question: what if a concurrent TX soft-deletes a tag between a `listByNames` and a subsequent `getDto`? Trace-answer: standard READ COMMITTED snapshot semantics. The `listByNames` snapshot sees the row as non-deleted; the subsequent `getDto` may or may not see the new `deleted_at` depending on which snapshot it falls under. No cross-method snapshot consistency. If atomicity matters, the caller must wrap both calls in a single `@ReactiveTransactional` boundary. Confidence: STATIC-INFERRED.

- **E5 — `onDuplicateKeyIgnore` for relation inserts (lines 261, 344, 367).** Trigger: idempotent insert. Question: replay-safe? Trace-answer: yes. A second call with the same `(tag_id, data_entity_id)` pair is a no-op. (Note: not all DBs handle `ON DUPLICATE KEY IGNORE` semantics identically; jOOQ translates to `INSERT ... ON CONFLICT ... DO NOTHING` for PostgreSQL.) Confidence: STATIC-INFERRED.

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
- **Search-index side effects** — NONE in this class. The search vectors are owned by `ReactiveSearchEntrypointRepository` / `ReactiveTermSearchEntrypointRepository`; `TagServiceImpl` orchestrates the call chain.
- **Activity-feed side effects** — NONE in this class. `TagActivityHandlerImpl` reads via `listDataEntityDtos` for state-capture; the write to `activity` is in the activity subsystem.
- **External I/O** — NONE. Pure jOOQ/Postgres; no HTTP / S3 / SMTP / Slack / OTLP calls.
- **Transaction boundaries** — This class methods are NOT `@ReactiveTransactional`. They run within the caller's TX (per stress_findings.E3).
- **Lock acquisition** — NONE. No `SELECT … FOR UPDATE`, no advisory locks, no explicit row-locking; the unique-index race in `ingestData` is mediated entirely by the partial unique constraint + `ON CONFLICT … DO UPDATE` (per stress_findings.E1).
- **Exception translation** — `JooqReactiveOperations.flux` / `.mono` invocations are wrapped in `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` (`JooqReactiveOperations.java:48`); a unique-index race on `tag.name` translates to `UniqueConstraintException("Tag with this name already exists")` (`ExceptionUtils.java:54-56`). However: this only fires for the `bulkCreate` path (which has no `onConflict` clause); the `ingestData` upsert SWALLOWS the race silently via `ON CONFLICT … DO UPDATE` and returns the existing row.

## dependencies_semantic

- requires-feature: [
    "Tag relation tables — `tag_to_data_entity` (with `external` column in `V0_0_47__add_tag_external_attribute.sql:1`), `tag_to_dataset_field` (with `origin` TagOrigin enum column), `tag_to_term`",
    "Tag soft-delete column — `tag.deleted_at` (`V0_0_64__remove_is_deleted_field.sql:96`); inheritance depends on the column name being literally `deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:25` `DEFAULT_DELETED_AT_FIELD = \"deleted_at\"`)",
    "Tag partial unique index — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64__remove_is_deleted_field.sql:105`); the `ingestData` upsert pins via `Indexes.TAG_NAME_UNIQUE.getFields()` (`:199-202`); the `WHERE TAG.DELETED_AT.isNull()` predicate is HARDCODED (`:207`)",
    "ExceptionUtils unique-constraint translation — `TAG_NAME_UNIQUE` is in the `formatMessage` cascade (`ExceptionUtils.java:54-56`); `bulkCreate` races translate to `UniqueConstraintException(\"Tag with this name already exists\")`",
    "TagOrigin enum — three values `INTERNAL | EXTERNAL | EXTERNAL_STATISTICS` (`TagOrigin.java:4-6`); only `INTERNAL` and `EXTERNAL` are referenced from this class (`:87, 113, 292, 385`)",
    "JooqQueryHelper.paginate — the load-bearing pagination function (`JooqQueryHelper.java:63-90`); `listMostPopular`'s semantic correctness depends on the function's exact shape (inner ORDER BY tag.id ASC LIMIT size before count aggregation). Any change to `paginate` (e.g., moving the LIMIT outside the CTE) would change `listMostPopular`'s behaviour."
  ]
- requires-config: [] — N/A. Class reads no configuration; behaviour is unconditional.
- requires-runtime: [
    "Spring `@Repository`-managed bean — `@Repository` annotation at `:43`; Spring constructs via constructor injection (`:49-52`) passing `JooqReactiveOperations` + `JooqQueryHelper`",
    "jOOQ DSLContext (reactive) — via `JooqReactiveOperations.mono / .flux / .executeInPartitionReturning / .newRecord`",
    "Postgres — partial unique indexes, `boolOr`, `coalesce`, `count`, `sum`, `unionAll`, named CTE table `tag_cte` (`:150`), `row_number() OVER` (via paginate)",
    "`reactor-core` — `Mono` + `Flux` return shapes throughout; `Flux.just()` empty-flux short-circuits"
  ]
- couples-to: [
    "`ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (`extends` at `:44`) — inherits `delete(long)`, `delete(Collection)`, `idCondition`, `listCondition`, `addSoftDeleteFilter`, `getDeleteChangedFields`, `getNonUpdatableFields`",
    "`ReactiveTagRepository` (`implements` at `:45`) — 18 method contract",
    "`JooqReactiveOperations.executeInPartitionReturning` (`JooqReactiveOperations.java:69`) — partitions records at `BATCH_SIZE` (line 75-83); the `ingestData` upsert uses this. A >BATCH_SIZE upsert is split into multiple sequential `INSERT … ON CONFLICT … DO UPDATE` statements via `Flux.concat`; each is a separate round-trip but all within the caller's TX.",
    "`Indexes.TAG_NAME_UNIQUE` (jOOQ-generated `org.opendatadiscovery.oddplatform.model.Indexes`) — the conflict-target handle; `getFields()` returns the `name` column",
    "`DateTimeUtil.generateNow()` (used at `:185` to stamp `updated_at` on bulk-upsert rows; identical pattern to inherited `bulkCreate`)",
    "Static jOOQ table imports (`:38-41`): `TAG`, `TAG_TO_DATASET_FIELD`, `TAG_TO_DATA_ENTITY`, `TAG_TO_TERM` — all generated from the live schema"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "Basic `create` round-trip (`testCreateTagPojo` at `TagRepositoryImplTest.java:30-44`)",
    "Bulk create with all names present (`testBulkCreateTag` at `:52-67`)",
    "`listByNames` returns the requested names (`testGetTagsByListNames` at `:77-95`) — happy path, exact-name match, 3 tags",
    "`createDataEntityRelations` happy path (`testCreateRelationsWithDataEntity` at `:99-122`)",
    "`createDataEntityRelations` with subset (`testCreateRelations_SomeTags` at `:126-148`)",
    "`createDataEntityRelations` with empty input (`testCreateRelationsIsEmpty` at `:152-160`)",
    "`deleteDataEntityRelations(Collection)` happy path (`testDeleteRelations` at `:164-190`)",
    "`deleteDataEntityRelations` with empty input (`testDeleteRelationsIsEmpty` at `:194-215`)",
    "`update` happy path (`testUpdateTag` at `:219-235`)",
    "`listMostPopular` PARTIAL happy path (`testListMostPopular` at `:239-267`) — 8 tags created, 4 renamed to `PopularName0..3`, asserts the page filters to the 4 popular ones. **DOES NOT exercise the LSN-019 boundary case** (N > size with equal counts); does not assert the SQL-truth that `paginate` applies inside the CTE."
  ]
- uncovered_behaviours: [
    "{
      \"behaviour\": \"**LSN-019 — `listMostPopular` boundary case: N > size with equal counts → returns OLDEST `size` by tag.id ASC.** The test suite has zero coverage for the case where the directory exceeds `size` tags. Probe `P-010` (emitted) pins this in CI.\",
      \"test_class\": \"TagRepositoryImplTest — add `testListMostPopular_DirectorySizeExceedsLimit_ReturnsOldestNotMostPopular` (35 tags created with explicit IDs 1-35, every entity tagged with all 35; assert response IDs == [1..30] NOT [31..35] or any random subset)\",
      \"severity\": \"CRITICAL\"
    }",
    "{
      \"behaviour\": \"`ingestData` upsert path — the bulk INSERT … ON CONFLICT … DO UPDATE is not exercised in tests.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testIngestData_InsertOnly`, `testIngestData_ConflictOnExistingName`, `testIngestData_MixedInsertAndConflict`, `testIngestData_PartitionedAcrossBatchSize`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Concurrent novel-name race — two parallel `ingestData` calls with overlapping names should return both callers the same row, but the contract is not asserted.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testIngestData_ConcurrentNovelName_DoesNotThrow`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Concurrent `bulkCreate` race — two parallel `bulkCreate` with the same novel name. Expected: `UniqueConstraintException` from one caller; this is the `TagServiceImpl.getOrCreateTagsByName` TOCTOU surface.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testBulkCreate_ConcurrentDuplicateName_ThrowsUniqueConstraintException`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Case-sensitivity of `listByNames` — no test asserts `Postgres` vs `postgres` distinct lookup. Root cause of `TagServiceImpl.divideTagsByExistence` treating case-only-different names as novel.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListByNames_CaseSensitiveExactMatch`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Soft-delete bypass in `listByNames` — no test asserts a soft-deleted tag is filtered out.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListByNames_FiltersSoftDeletedTags`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listMostPopular` page=0 / page=-1 / size=0 / size=-1 boundary cases. Per stress_findings.A1/A2, these reach PostgreSQL and may error or return surprising shapes.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListMostPopular_PageZero_ReturnsError`, `testListMostPopular_SizeZero_ReturnsEmptyPage`, etc.)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listMostPopular` with `tag_to_dataset_field` usage — `testListMostPopular` only creates `tag` rows (no relations). The CTE's UNION-ALL of `tag_to_data_entity` + `tag_to_dataset_field` usage counts is not asserted; count could be silently zero for tags only used on dataset fields.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListMostPopular_TagsOnlyOnDatasetFields_RankedByUsage`, `testListMostPopular_TagsOnBothEntitiesAndFields_CountSummed`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`listTagsRelations` filter by `TagOrigin` enum — no test asserts INTERNAL vs EXTERNAL filtering.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testListTagsRelations_FilterByOrigin`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Tag-name length / charset / pattern — no test exercises empty strings, whitespace-only strings, very long names, or control-character names. REFACTOR-223's bounded-DoS angle.\",
      \"test_class\": \"TagRepositoryImplTest (would add `testCreate_EmptyName`, `testCreate_WhitespaceName`, `testCreate_VeryLongName`, `testCreate_ControlCharacters`)\",
      \"severity\": \"LOW\"
    }"
  ]
- test_files: [
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java` (`extends BaseIntegrationTest` — Testcontainers-Postgres integration test; 10 tests covering basic CRUD + relation create/delete + popularity ranking happy path; no `ingestData` test, no race-condition test, no soft-delete test, no LSN-019 boundary test)"
  ]
- gaps: |
    Where would a regression most likely land that the current tests would miss?
    
    1. **LSN-019 popular-tags drift** — the single largest miss. `testListMostPopular` asserts the happy path (4 tags become popular, 4 are returned in correct order) but never exercises the case where N (total) > size (limit). Probe P-010 pins this in CI; without it, a future refactor that "fixes" the paginate-inside-CTE shape would change the API's observable behaviour silently.
    
    2. **`ingestData` upsert path** — every Collector-pushed tag flows here and the method is COMPLETELY uncovered. A regression in `Indexes.TAG_NAME_UNIQUE.getFields()` resolution, in the hardcoded `WHERE TAG.DELETED_AT.isNull()` predicate matching, or in the `DSL.excluded(TAG.NAME)` RETURNING-trigger pattern would silently break ingestion-side tag relations.
    
    3. **Auto-create-on-miss TOCTOU between `listByNames` and `bulkCreate`** — REFACTOR-223 lives at the *service* layer. The race is real but the loser-handling path (caller sees `UniqueConstraintException`, retries `listByNames`, finds the row?) is NOT tested anywhere in the repository or the service test corpus. The auto-create-on-miss UX would surface a user-visible 500 on the second caller in the race.
    
    4. **Soft-delete resurrection** — the partial unique index permits re-creating a Tag with a previously-soft-deleted name; the `tag_to_*` relations are HARD-deleted before the soft-delete; therefore a re-created Tag has a DIFFERENT id and ZERO relations.
    
    5. **`listMostPopular` UNION-ALL** — `testListMostPopular` covers only the `tag_to_data_entity` arm. The `tag_to_dataset_field` arm (about half the popularity computation) is uncovered.
    
    6. **TagOrigin filter in `listTagsRelations`** — `DatasetFieldServiceImpl.copyInternalTagsToNewFieldVersion` (`:354`) depends on the `INTERNAL`-only filter; not tested.
    
    7. **Boundary conditions on `page` and `size`** — A1/A2 stress findings flag that the controller accepts arbitrary `int` and passes through to PostgreSQL. No test pins what callers see for degenerate values.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: "#applying-tags"
    rationale: "Live doc page describing the operator-facing Tag UX — 'create new tag inline' is the doc-side description of the auto-create-on-miss path this repository implements via `bulkCreate`. The page documents `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` permissions; it does NOT mention `DATA_ENTITY_TAGS_UPDATE` as a second write path into the directory."
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
  - "**Spec-vs-code drift on popular-tags ordering (LSN-019).** OpenAPI declares `GET /api/tags`: `description: 'Gets the list of existing tags sorted by popularity'` (`odd-platform-specification/openapi.yaml:345`). The implementation does NOT honour that contract when the directory exceeds `size` tags: per stress_findings.B1, the SQL truncates by tag.id ASC inside the CTE before counts are computed, so the response is 'oldest `size` tags ranked by popularity' rather than 'most popular `size` tags'. The spec promise is unmet. Either the spec should be updated to describe actual behaviour, or the code should be refactored to apply ORDER BY count BEFORE pagination. Currently the discrepancy is undisclosed to operators reading the spec."
  - "The tagging doc page describes 'creating new labels on the spot' (live-page summary 2026-05-19) but does not state the consequence: any user with `DATA_ENTITY_TAGS_UPDATE` on a single data entity can mint a new row in the global `tag` directory visible to every other user via `GET /api/tags/popular`. REFACTOR-223 captures this gap."
  - "The doc page does not document case-sensitivity of tag names. `listByNames` is case-SENSITIVE; the popular-tags query is case-INSENSITIVE on the `query` parameter. Operators have no way to know whether `PII` and `pii` collapse or fork."

## implicit_adrs

- "**`paginate-inside-CTE` is an intentional structural choice — but its semantic correctness for `listMostPopular` is questionable.** The JOOQ chain at lines 144-158 applies the size-limit BEFORE the count aggregation. This pattern is internally consistent with how `JooqQueryHelper.paginate` is used elsewhere in the codebase (every list-with-pagination endpoint uses the same shape; `ReactiveAbstractCRUDRepository.list` at lines 88-100 follows the same pattern). The structural choice — 'paginate the base table, then enrich' — is intentional for performance reasons (you don't want to compute aggregate counts over the entire directory just to discard most of them). However, this structural choice has a name-vs-behaviour mismatch ONLY for `listMostPopular`, because that method's name and OpenAPI description promise count-ranked results — which the pattern cannot deliver when N > size. The intent-anchor is implicit in the consistency of the codebase-wide pattern; the conflict between the pattern and this method's name is the LSN-019 surface." — evidence: ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + ReactiveAbstractCRUDRepository.java:88-100 — intent_anchor: "Pattern repetition: every paginated list endpoint in the codebase uses `paginate(homogeneous_select, order_fields, offset, limit)` with the LIMIT inside the CTE; the pattern is the design statement" — confidence: MEDIUM (consistency-evidence is strong; the trade-off-vs-name-mismatch is undocumented anywhere — no comment, no ADR, no exception message defending the choice for the popular-tags case specifically; this borders on `bugs_limitations_corner_cases`).

- "Partial-unique-index-as-race-protection — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` is the platform's only locking mechanism for the auto-create-on-miss path. The `ingestData` upsert (`:204-210`) leans on `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` to make concurrent novel-name inserts idempotent without an application-level lock; the same mechanism does NOT protect the `bulkCreate` path used by `TagServiceImpl.getOrCreateTagsByName` (no `onConflict` clause inherited). Three migrations (`V0_0_36`, `V0_0_57`, `V0_0_64`) iterated on this index." — evidence: ReactiveTagRepositoryImpl.java:199-210 + V0_0_36__refactor_unique_index.sql:4 + V0_0_57__change_tag_unique_constraint_semantics.sql:3 + V0_0_64__remove_is_deleted_field.sql:103-105 — intent_anchor: "`DROP INDEX IF EXISTS tag_name_unique; CREATE UNIQUE INDEX IF NOT EXISTS tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL;` (V0_0_64:103-105) — the explicit re-creation after the `is_deleted` column removal is the maintainer-authored statement that the partial filter is the protection" — confidence: HIGH

- "Conflict-target is computed from `Indexes.TAG_NAME_UNIQUE.getFields()` rather than hardcoded `TAG.NAME` — `ingestData` dynamically resolves the conflict fields (`:199-202`) from the jOOQ-generated index handle. A migration that changes the index to `(name, namespace_id)` would automatically propagate. By contrast, the `WHERE TAG.DELETED_AT.isNull()` predicate is hardcoded (`:207`) — index-shape changes propagate, predicate-shape changes do NOT." — evidence: ReactiveTagRepositoryImpl.java:199-207 — intent_anchor: "`final List<Field<Object>> conflictFields = Indexes.TAG_NAME_UNIQUE.getFields().stream().map(of -> field(of.getName())).toList();` (`:199-202`) — explicit dynamic resolution rather than `TAG.NAME` literal" — confidence: HIGH

- "RETURNING-trigger via no-op `DO UPDATE SET name = EXCLUDED.name` — the upsert sets the conflicting row's name to itself (`DSL.excluded(TAG.NAME)` at `:209`). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op update exists solely to trigger the RETURNING clause. The caller (`TagServiceImpl.getOrInjectTagByName`) needs the id of every row (existing or newly inserted) to build `TagToDataEntityPojo` relations." — evidence: ReactiveTagRepositoryImpl.java:204-210 + TagServiceImpl.java:88-94 — intent_anchor: "`.doUpdate().set(TAG.NAME, DSL.excluded(TAG.NAME)).returning()` (`:208-210`) — name set to itself is the diagnostic" — confidence: HIGH

- "Soft-delete on `tag`, hard-delete on `tag_to_*` relations — the class extends `ReactiveAbstractSoftDeleteCRUDRepository` for the `tag` table (delete = `UPDATE … SET deleted_at = now()`), but every `delete*Relations` method here uses `DSL.delete(...)` (hard delete). The soft-delete intent is for the tag DIRECTORY entry (audit + uniqueness handling); relation rows have no audit semantics and are immediately removed." — evidence: ReactiveTagRepositoryImpl.java:217-323 (six hard-delete methods) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74 — intent_anchor: "Class declaration: `extends ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (`:44`) for the tag table; explicit `DSL.delete(TAG_TO_DATA_ENTITY)` / `DSL.delete(TAG_TO_DATASET_FIELD)` / `DSL.deleteFrom(TAG_TO_TERM)` for relations — the asymmetric base-class choice is the architectural statement" — confidence: HIGH

- "`onDuplicateKeyIgnore` for relation creates — `createDataEntityRelations` / `createDatasetFieldRelations` / `createTermRelations` all use `onDuplicateKeyIgnore()` (`:261, 344, 367`). This makes relation-create idempotent: a second call with the same `(tag_id, data_entity_id)` pair is a no-op." — evidence: ReactiveTagRepositoryImpl.java:261, 344, 367 — intent_anchor: "`.onDuplicateKeyIgnore()` repeated three times across the relation-create methods — the consistency is the diagnostic" — confidence: HIGH

- "`bulkCreate` is the ONE create path that does NOT use `onConflict` — the inherited `ReactiveAbstractCRUDRepository.bulkCreate` has no `onConflict` clause; it relies on `ExceptionUtils.translateDatabaseException` to surface the `UniqueConstraintException`. `bulkCreate` is a fail-on-duplicate operation; `ingestData` is an upsert. The dual-method design is intentional: `TagController.createTag` (operator-explicit creation gated by `TAG_CREATE`) MUST fail on duplicate to surface the error to the user; ingestion-side calls MUST not fail because a tag with the same name was added moments earlier by a parallel pipeline." — evidence: ReactiveAbstractCRUDRepository.java:113-126 + ReactiveTagRepositoryImpl.java:191-213 + TagController.java:23-28 — intent_anchor: "Two distinct repository methods with different conflict semantics — the dual-method design is the architectural choice" — confidence: HIGH

## bugs_limitations_corner_cases

- "**LSN-019 SMOKING GUN: `listMostPopular` does not deliver popularity-ranked results when the directory exceeds `size` tags.** The method's name, the OpenAPI description (`'Gets the list of existing tags sorted by popularity'` at `odd-platform-specification/openapi.yaml:345`), and the existing service-level documentation imply count-ranked results. The implementation truncates the candidate pool by `tag.id ASC` BEFORE counts are computed (line 148: `paginate(homogeneousQuery, [(TAG.ID, ASC)], (page-1)*size, size)`). For directories with N > size tags, the response is the `size` oldest tags re-ranked among themselves — not the top `size` most-popular tags. Empirical proof: LSN-019:23-32 (35 tags, all equally popular, size=30 → oldest 30 returned; 5 newest absent). Operator-visible impact: a tag added today with 10,000 usage events is INVISIBLE on `/api/tags/popular` page 1 if 30+ older tags already exist; only the user paging through every page can find it (and even then, ordering within each page is broken). The UI's TopTagsList chip strip on the Discovery overview surface is effectively 'oldest 30 tags' — silently. — evidence: ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90 + odd-platform-specification/openapi.yaml:344-346 + retrospectives/LSN-019:23-32 — severity: HIGH — probe: P-010 (emitted to pin the SQL contract in CI)"

- "TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` — the service calls `listByNames(tagNames)` (`TagServiceImpl.java:145`) to filter existing names, then `bulkCreate(tagsToCreate)` (`:82`) for the remainder. Between these two reactor stages, another caller can insert the same novel name. In PostgreSQL READ COMMITTED isolation, the `listByNames` snapshot does NOT see uncommitted INSERTs from a concurrent TX, so the second caller will attempt `bulkCreate` with the now-conflicting name, hit `tag_name_unique`, and receive `UniqueConstraintException(\"Tag with this name already exists\")`. The user sees a 500-level error on a normal-looking PUT request. There is no caller-side retry of `listByNames` after the conflict. The `ingestData` upsert path is safe; the `bulkCreate` path is not. — evidence: TagServiceImpl.java:80-86 + TagServiceImpl.java:144-159 + ReactiveAbstractCRUDRepository.java:113-126 + ExceptionUtils.java:30-36, 54-56 — severity: HIGH"

- "Case-sensitive `listByNames` enables silent duplicate Tag rows via case variation — `listByNames` (`:120-125`) uses `TAG.NAME.in(names)` which translates to a case-sensitive SQL `IN`. `TagServiceImpl.divideTagsByExistence` (`:144-159`) calls `listByNames` then `existingTagNames.contains(n)` — also case-sensitive. A caller submitting `tag_name_list: ['PII']` against a directory that already contains `pii` will see `pii` as missing and mint a fresh `PII` row. The `tag_name_unique` partial index is also case-sensitive (PostgreSQL `text` column default), so both rows coexist. UI tag-dropdown renders both. — evidence: ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + V0_0_64__remove_is_deleted_field.sql:105 — severity: MEDIUM"

- "Tag-name validation absent in repository AND in service AND in OpenAPI — `ingestData`, `bulkCreate`, and the inherited `create` all accept arbitrary `TagPojo.name: String` content. The PostgreSQL `tag.name` column has no `CHECK` constraint visible in any migration. An operator with `DATA_ENTITY_TAGS_UPDATE` can mint Tag rows with names of arbitrary length, with newline / control characters, or whitespace-only. REFACTOR-223 captures the DoS-shaped concern. — evidence: ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + (no validation in migration suite) — severity: MEDIUM"

- "`listMostPopular` is globally-scoped — no per-data-entity, per-owner, per-namespace, per-tenant filter. The `listCondition(query)` inherited filter is name-substring only. Any caller able to reach `GET /api/tags/popular` (every authenticated user) sees every tag in the directory. Combined with the side-door write path (REFACTOR-223), a per-data-entity-owner can populate the popular-tags surface for ALL users. — evidence: ReactiveTagRepositoryImpl.java:137-167 + TagController.java:36-44 — severity: MEDIUM"

- "Page/size parameter boundary handling is unguarded (stress_findings.A1/A2) — `listMostPopular(page=0)` produces `LIMIT size OFFSET -size` which PostgreSQL rejects with `SQL state 22023`. `size=-1` similarly errors. `size=100000` executes a full-directory UNION-ALL CTE with no upper bound. No defensive clamping at any layer between controller and repository. Operator submitting a hand-crafted querystring → 500 errors with unhelpful SQL-state-leaked exception traces. — evidence: ReactiveTagRepositoryImpl.java:138, 148 + JooqQueryHelper.java:63-90 (no clamping) — severity: MEDIUM"

- "Resurrection of soft-deleted Tag does NOT restore relations — `TagServiceImpl.delete` (`:64-66`) sequence is `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` (BOTH HARD DELETES), then `delete(tagId)` (soft-delete). Subsequent `bulkCreate(new TagPojo().setName(name))` with the same name succeeds (partial index permits it) but gets a NEW `id`. The `tag_to_*` rows that referenced the old id are gone. — evidence: TagServiceImpl.java:58-70 + ReactiveTagRepositoryImpl.java:227-241, 272-286 — severity: LOW"

- "Empty-batch contract differs between `ingestData` and the inherited `bulkCreate` — `ingestData` short-circuits on empty (`:181-183`); `bulkCreate` ALSO short-circuits (`ReactiveAbstractCRUDRepository.java:115-117`). However: jOOQ does not accept zero-record INSERT statements, so the empty-batch guard is load-bearing. A future change to remove the guard would produce a runtime SQL error on every empty bulk call. — evidence: ReactiveTagRepositoryImpl.java:181-183 + ReactiveAbstractCRUDRepository.java:115-117 — severity: LOW"

- "`listTagsRelations(datasetFieldIds, origin=null)` path is implicit — the method (`:101-117`) accepts a null origin and skips the origin filter. Callers passing `null` get ALL origins (INTERNAL + EXTERNAL + EXTERNAL_STATISTICS). No current caller passes null, but the contract is not documented. — evidence: ReactiveTagRepositoryImpl.java:101-117 — severity: LOW"

- "`getDataEntityWithDatasetFields` CTE name collision — the CTE built at `:373-392` is named `'tag_cte'` (`:150`); hardcoded. If two listMostPopular queries were composed (e.g., as subqueries of a parent), the inner CTE would collide. No current caller composes them. — evidence: ReactiveTagRepositoryImpl.java:150, 373-392 — severity: LOW"

- "`getDataEntityWithDatasetFields` external-aggregate divergence — the dataset-entity arm uses `boolOr(TAG_TO_DATA_ENTITY.EXTERNAL)` (boolean column); the dataset-field arm uses `boolOr(TAG_TO_DATASET_FIELD.ORIGIN.ne(TagOrigin.INTERNAL.name()))` (`:385`). The semantic 'is this tag used externally' is computed differently across the two relation tables. The result: a tag used only on dataset fields via `EXTERNAL_STATISTICS` will report `external = true` from `listMostPopular`. — evidence: ReactiveTagRepositoryImpl.java:373-391 — severity: LOW"

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — repository runs inside the platform process and has no HTTP surface. The methods are reached through `TagService` (REST) and `ExternalTagIngestionRequestProcessor` (S2S ingestion); auth-mode coupling is at those upstream layers (DISABLED / LOGIN_FORM / OAUTH2 / LDAP for the UI path; `auth.s2s.enabled` for ingestion).
- **ingestion_filter_relevance**: `NO — repository internals, but DOWNSTREAM of the IngestionDataEntitiesFilter on the ingestion path`. When `ExternalTagIngestionRequestProcessor` writes via this repository, the request has already been filter-gated (`auth.ingestion.filter.enabled`); when `TagServiceImpl` writes via this repository, it's on a UI path that uses different auth.
- **authorization_assertions**: `[]` — repository performs zero authorization checks (stress_findings.D1). The class trusts the caller to have already evaluated permissions. The 18 method contract surfaces would, if mistakenly invoked from an unauthorised path, write directly to the `tag` directory or the relation tables with no native defence.
- **owner_scoping**: `N/A — Tag directory has no owner concept`. There is no `tag.owner_id` column, no per-Owner Tag filtering anywhere in this class. `listMostPopular` and `listByNames` return globally. The Tag directory is a flat, globally-shared namespace by design.
- **data_exposure**:
  - "`Flux<TagPojo>` from `listByNames` / `listByTerm` → ANY caller able to reach the upstream service method. The repository emits the full tag-row payload (id, name, important, created_at, updated_at, deleted_at) with no filtering."
  - "`Mono<TagDto>` / `Mono<List<TagDto>>` from `getDto` / `listDataEntityDtos` / `listDatasetFieldDtos` → repository returns aggregate usage count + external flag; usage counts across the global directory are derivable by enumerating data-entity ids. No per-tenant masking."
  - "`Mono<Page<TagDto>>` from `listMostPopular` → globally-truncated-by-ID popular tags (per LSN-019); any operator-generated tag (via the side-door of REFACTOR-223) eventually surfaces here once it reaches the top `size` by ID — but NEWER high-popularity tags are HIDDEN from operators who never page beyond page 1 (LSN-019 second-order consequence). — evidence: `ReactiveTagRepositoryImpl.java:137-167`"
- **known_security_gaps**:
  - "Repository emits NO audit log on writes — `ingestData`, `bulkCreate` (inherited), `delete` (inherited soft-delete), and every `create*Relations` / `delete*Relations` method writes to a relation or directory table with NO repository-side activity event. The `TAG_ASSIGNMENT_UPDATED` activity event is emitted by the UPSTREAM service layer. The ingestion-side path (`ExternalTagIngestionRequestProcessor`) writes via this repository directly and produces NO activity-feed entry. — evidence: ReactiveTagRepositoryImpl.java:1-401 (no `@ActivityLog`) + ExternalTagIngestionRequestProcessor.java:34-44 (no `@ActivityLog`) — severity: MEDIUM"
  - "Repository performs no name normalization, no length limit, no charset filter — the auto-create surface is wide-open for novel-name pollution (REFACTOR-223 DoS angle). — evidence: ReactiveTagRepositoryImpl.java:179-215 + (no migration-level CHECK constraint) — severity: MEDIUM"
  - "The hardcoded `WHERE TAG.DELETED_AT.isNull()` in the upsert's conflict predicate (`:207`) couples the repository's correctness to the partial-index predicate remaining `deleted_at IS NULL`. — evidence: ReactiveTagRepositoryImpl.java:206-207 + V0_0_64__remove_is_deleted_field.sql:105 — severity: LOW"

## performance

- **hot_paths**:
  - "`ingestData` runs once per Collector batch per Tag set — the FINALIZING phase of `IngestionService` calls `ExternalTagIngestionRequestProcessor.process` once per request, which calls `tagService.getOrInjectTagByName` which calls `ingestData` with the full novel-tag set of the batch. — evidence: ReactiveTagRepositoryImpl.java:179-215 + ExternalTagIngestionRequestProcessor.java:71-72"
  - "`listMostPopular` runs once per `GET /api/tags/popular` call — uses a non-trivial UNION-ALL CTE across two relation tables with per-tag aggregates; the per-call cost is bounded by `size` (the candidate pool is truncated INSIDE the CTE per LSN-019), so worst case is `O(size)` aggregates rather than `O(N)` aggregates — a counter-intuitive performance UPSIDE of the structural bug at the cost of correctness. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392"
  - "`listDataEntityDtos(dataEntityId)` runs on EVERY data-entity detail page load (called by `DataEntityServiceImpl.java:622` + `DataEntityPermissionExtractor.java:67` + `TagActivityHandlerImpl.java:41`) — triple-call shape for the same data entity during a single request. No request-scoped cache. — evidence: ReactiveTagRepositoryImpl.java:68-81 + the three callers"
- **throughput_characteristics**:
  - "All write methods are reactive `Flux` / `Mono` — non-blocking; the underlying jOOQ-reactive PG driver releases the connection between awaits."
  - "`executeInPartitionReturning` partitions at `BATCH_SIZE` and concatenates the per-partition `Flux`es — `Flux.concat` is sequential, not parallel; a 5000-row upsert at `BATCH_SIZE=1000` is 5 sequential round-trips in the caller's TX. — evidence: JooqReactiveOperations.java:69-84"
  - "Relation-create methods build ONE INSERT … VALUES (…), (…), …, (…) statement per call. No partitioning unless the batch exceeds `BATCH_SIZE`. For 10K+ relations in one call, the statement size grows linearly. — evidence: ReactiveTagRepositoryImpl.java:244-264, 326-347, 350-371"
- **resource_allocation**:
  - "Memory: per-call allocations are small for normal use. `listMostPopular` materialises the `Flux<...>` to a `List<...>` via `.collectList()` (`:162-166`) — for the popular-tags surface, the full result set is in memory simultaneously. Bounded by `size`."
  - "DB connection: each method takes one connection per round-trip via `JooqReactiveOperations`; no connection pinning across the upsert + RETURNING."
  - "No client-side caching — every `listByNames` / `listMostPopular` is a fresh round-trip."
- **scaling_characteristics**:
  - "Stateless — repository instance has no per-call state; horizontal scaling unconstrained."
  - "No row-level locking — the auto-create-on-miss path's race is mediated by the partial unique index, NOT by `SELECT … FOR UPDATE`. Under high concurrency, racers receive `UniqueConstraintException` (for `bulkCreate`) or silently merge to the existing row (for `ingestData`) — per stress_findings.E1/E2."
  - "`listMostPopular` has no pagination cap — `size` parameter is passed through verbatim. An attacker submitting `size=100000` would force a full-directory aggregate. The LSN-019 paginate-inside-CTE behaviour bounds the count-aggregation cost at `O(size)` — so a 100000-size request executes a 100000-row UNION-ALL CTE. — evidence: ReactiveTagRepositoryImpl.java:138-167"
- **known_performance_gaps**:
  - "Triple-fetch of the same `listDataEntityDtos` payload during one request — `DataEntityServiceImpl.java:622` + `DataEntityPermissionExtractor.java:67` + `TagActivityHandlerImpl.java:41` all call `tagRepository.listDataEntityDtos(dataEntityId)` for the same data entity during a single HTTP request. No request-scoped cache. — evidence: ReactiveTagRepositoryImpl.java:68-81 + three caller line refs — severity: LOW"
  - "`listMostPopular` UNION-ALL CTE runs on every popular-tags fetch — for `size`-truncated requests, cost is bounded; for the `getPopularTagList` UI surface (default size, no cap), cost depends on the directory size. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 — severity: LOW"
  - "No `EXPLAIN`-anchored benchmark in the test suite — the integration tests assert correctness, not query cost. — evidence: TagRepositoryImplTest.java:239-267 (correctness-only assertion) — severity: LOW"

## feature_hint

- pillar_id: P-01 (Data Discovery)
- sub_feature: Manual Object Tagging — the Tag directory IS the substrate of the tag facet, the Top-tags chip strip, and the per-entity tag rendering across Discovery.
- drift_class_facets:
  - **LSN-019 (this batch's discovery) — `listMostPopular` name-vs-behaviour mismatch — paginate-inside-CTE yields oldest-by-ID, not most-popular-by-count when N > size** — repository-side substrate at `ReactiveTagRepositoryImpl.java:138-167`. Probe P-010 emitted to pin in CI. Affects the operator-visible TopTagsList chip strip, the tag-search-facet, and any caller of `GET /api/tags/popular` page 1 when N > 30 (the typical default size).
  - REFACTOR-223 (Tag side-door — `DATA_ENTITY_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`) — repository-side substrate at `ingestData` + inherited `bulkCreate`
  - TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` (NEW — not yet a REFACTOR-NNN; would be filed under SEC-NNN authorization-audit OR an availability-shaped TOCTOU-cluster)
  - Case-sensitivity divergence between `listByNames` (exact, case-sensitive) and `listMostPopular`'s `query` (case-insensitive substring) — UX/data-integrity drift, not currently REFACTOR-tracked
  - Audit-log absence on the ingestion-side tag mutation path — `ExternalTagIngestionRequestProcessor` writes to relation tables with no activity-feed entry — extends the existing "Audit-log Presence Asymmetry" canonicalisation candidate
  - Cross-feature pattern: auto-create-on-miss family across Tag + Owner + Title + Term — REFACTOR-199 (Owner) + REFACTOR-206 (Title) + REFACTOR-223 (Tag, this repository's substrate); the family is suggested for grouping as a "SEC-NNN authorization-audit sprint" per REFACTOR-223
- cross_pillar_relationships: P-01 → P-10 (Tag directory grown by Collector pushes via `ExternalTagIngestionRequestProcessor`); P-01 → P-09 (Tag mutations gated by `TAG_CREATE` for the dedicated route + `DATA_ENTITY_TAGS_UPDATE` for the side-door; both bypass at the repository layer because there's no in-repository check); P-01 → P-07 (Tag mutations on the data-entity path emit `TAG_ASSIGNMENT_UPDATED` activity events upstream; the ingestion path does not)

## sources

- understanding ← ReactiveTagRepositoryImpl.java:1-401 (full file)
- concepts.entities ← ReactiveTagRepositoryImpl.java:17-27 (imports) + V0_0_64__remove_is_deleted_field.sql:95-108 + V0_0_47__add_tag_external_attribute.sql:1 + TagOrigin.java:3-7
- concepts.operations.listMostPopular (LSN-019 trace) ← ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90 + ReactiveAbstractCRUDRepository.java:294-299 + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32
- concepts.operations.other ← ReactiveTagRepositoryImpl.java:54-401 (every method body)
- concepts.invariants[paginate-inside-CTE] ← ReactiveTagRepositoryImpl.java:148 + JooqQueryHelper.java:63-90
- concepts.invariants[soft-delete] ← V0_0_64__remove_is_deleted_field.sql:95-108 + ReactiveAbstractSoftDeleteCRUDRepository.java:25, 51-58
- concepts.invariants[partial unique index] ← V0_0_64__remove_is_deleted_field.sql:103-105 + ReactiveTagRepositoryImpl.java:199-207
- concepts.invariants[case sensitivity] ← ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159 + ReactiveAbstractCRUDRepository.java:242-243
- concepts.invariants[dynamic conflict-target] ← ReactiveTagRepositoryImpl.java:199-207
- concepts.invariants[RETURNING-trigger no-op] ← ReactiveTagRepositoryImpl.java:204-210
- concepts.invariants[onDuplicateKeyIgnore for relations] ← ReactiveTagRepositoryImpl.java:261, 344, 367
- concepts.invariants[empty-batch guards] ← ReactiveTagRepositoryImpl.java:103-105, 181-183, 219-221, 246-248, 267-270, 310-312, 327-329
- concepts.invariants[hard-delete relations] ← ReactiveTagRepositoryImpl.java:227-241, 272-286, 290-323
- concepts.audiences ← Grep result `reactiveTagRepository|ReactiveTagRepository` filtered to callers
- stress_findings.A1 (page boundary) ← ReactiveTagRepositoryImpl.java:138, 148 + JooqQueryHelper.java:63-90
- stress_findings.A2 (size boundary) ← ReactiveTagRepositoryImpl.java:138, 148 + JooqQueryHelper.java:81
- stress_findings.A3 (BATCH_SIZE) ← ReactiveTagRepositoryImpl.java:192 + JooqReactiveOperations.java:69-84
- stress_findings.A4 (empty listByNames) ← ReactiveTagRepositoryImpl.java:120-125 (no guard)
- stress_findings.A5 (empty ids) ← ReactiveTagRepositoryImpl.java:141-143
- stress_findings.B1 (LSN-019 smoking gun) ← ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90 + ReactiveAbstractCRUDRepository.java:294-299 + odd-platform-specification/openapi.yaml:344-346 + retrospectives/LSN-019:23-32 + probe P-010 emitted
- stress_findings.B2 (listByNames) ← ReactiveTagRepositoryImpl.java:120-125 + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104
- stress_findings.B3 (getDto) ← ReactiveTagRepositoryImpl.java:55-66 + ReactiveAbstractSoftDeleteCRUDRepository.java:77-79
- stress_findings.B4 (ingestData) ← ReactiveTagRepositoryImpl.java:180-215
- stress_findings.B5 (deleteDataEntityRelations) ← ReactiveTagRepositoryImpl.java:218-241
- stress_findings.B6 (listCondition query) ← ReactiveTagRepositoryImpl.java:140 + ReactiveAbstractCRUDRepository.java:236-249
- stress_findings.C1 (outer ORDER BY count DESC, tie-break) ← ReactiveTagRepositoryImpl.java:158 + lines 144-150 + JooqQueryHelper.java:74, 80
- stress_findings.C2 (paginate default) ← JooqQueryHelper.java:74, 80, 89 + ReactiveTagRepositoryImpl.java:148
- stress_findings.C3 (UNION-ALL aggregation) ← ReactiveTagRepositoryImpl.java:373-391
- stress_findings.C4/C5/C6 (no ORDER BY) ← ReactiveTagRepositoryImpl.java:68-98, 120, 100, 170
- stress_findings.D1 (no authz) ← ReactiveTagRepositoryImpl.java:1-401 (no @PreAuthorize, no permissionService, no owner_id reference)
- stress_findings.E1 (ingestData race) ← ReactiveTagRepositoryImpl.java:199-210 + V0_0_64:103-105
- stress_findings.E2 (bulkCreate race) ← ReactiveAbstractCRUDRepository.java:113-126 + ExceptionUtils.java:54-56
- stress_findings.E3 (TX boundaries) ← ReactiveTagRepositoryImpl.java:1-401 (no @ReactiveTransactional) + TagServiceImpl.java:45, 58, 97, 137 + ExternalTagIngestionRequestProcessor.java:38 + ReactiveAbstractCRUDRepository.java:113-114
- stress_findings.E4 (snapshot semantics) ← ReactiveTagRepositoryImpl.java:75, 92, 122, 141 (soft-delete filter sites) + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104
- stress_findings.E5 (onDuplicateKeyIgnore) ← ReactiveTagRepositoryImpl.java:261, 344, 367
- upstream_callers ← TagServiceImpl.java:32, 40, 47, 52, 60, 64-66, 75, 82, 92, 101, 117-119, 126, 132, 141, 145 + ExternalTagIngestionRequestProcessor.java:34, 76, 85, 88, 108, 115, 117 + DatasetFieldServiceImpl.java:85, 108, 115, 117, 124, 129, 226, 227, 354 + DataEntityServiceImpl.java:622 + DataEntityPermissionExtractor.java:67 + TagActivityHandlerImpl.java:18, 41
- downstream_side_effects.DB writes ← ReactiveTagRepositoryImpl.java:54-401 (every write path)
- downstream_side_effects.exception translation ← JooqReactiveOperations.java:47-48 + ExceptionUtils.java:30-36, 54-56
- dependencies_semantic.requires-feature[paginate dependency] ← JooqQueryHelper.java:63-90 + ReactiveTagRepositoryImpl.java:148
- dependencies_semantic.couples-to[parent classes] ← ReactiveTagRepositoryImpl.java:44 + ReactiveAbstractSoftDeleteCRUDRepository.java:22-118 + ReactiveAbstractCRUDRepository.java:37-300
- tests_coverage_semantic.covered_behaviours ← TagRepositoryImplTest.java:28-267
- tests_coverage_semantic.uncovered_behaviours[LSN-019] ← absence in TagRepositoryImplTest.java + ReactiveTagRepositoryImpl.java:138-167 + retrospectives/LSN-019:23-32
- tests_coverage_semantic.uncovered_behaviours[other] ← absence + corresponding method-body line refs
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-19 of `https://docs.opendatadiscovery.org/features/data-discovery/tagging` (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-19 of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (status 200)
- docs_link_semantic.doc_drift_findings[LSN-019 spec-vs-code] ← odd-platform-specification/openapi.yaml:344-346 + ReactiveTagRepositoryImpl.java:138-167 + retrospectives/LSN-019:23-32
- docs_link_semantic.doc_drift_findings[side-door] ← WebFetch result above + REFACTOR-223 + repository-side `bulkCreate` / `ingestData` paths
- docs_link_semantic.doc_drift_findings[case-sensitivity] ← WebFetch result (no tag-case-sensitivity content) + ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159
- implicit_adrs[paginate-inside-CTE] ← ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + ReactiveAbstractCRUDRepository.java:88-100
- implicit_adrs[partial-unique-index-as-race-protection] ← V0_0_36 + V0_0_57 + V0_0_64:103-105 + ReactiveTagRepositoryImpl.java:199-210
- implicit_adrs[dynamic conflict-target] ← ReactiveTagRepositoryImpl.java:199-207
- implicit_adrs[RETURNING-trigger no-op] ← ReactiveTagRepositoryImpl.java:204-210 + TagServiceImpl.java:88-94
- implicit_adrs[soft-delete vs hard-delete asymmetry] ← ReactiveTagRepositoryImpl.java:44, 217-323 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74
- implicit_adrs[onDuplicateKeyIgnore for relations] ← ReactiveTagRepositoryImpl.java:261, 344, 367
- implicit_adrs[bulkCreate vs ingestData dual-method] ← ReactiveAbstractCRUDRepository.java:113-126 + ReactiveTagRepositoryImpl.java:191-213 + TagController.java:23-28
- bugs_limitations_corner_cases[LSN-019] ← ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90 + odd-platform-specification/openapi.yaml:344-346 + LSN-019:23-32 + probe P-010
- bugs_limitations_corner_cases[TOCTOU] ← TagServiceImpl.java:80-86, 144-159 + ReactiveAbstractCRUDRepository.java:113-126 + ExceptionUtils.java:30-36, 54-56
- bugs_limitations_corner_cases[case-sensitive] ← ReactiveTagRepositoryImpl.java:120-125 + TagServiceImpl.java:144-159
- bugs_limitations_corner_cases[no validation] ← ReactiveTagRepositoryImpl.java:179-215
- bugs_limitations_corner_cases[global listMostPopular] ← ReactiveTagRepositoryImpl.java:137-167 + TagController.java:36-44
- bugs_limitations_corner_cases[page/size boundary] ← ReactiveTagRepositoryImpl.java:138, 148 + JooqQueryHelper.java:63-90
- bugs_limitations_corner_cases[resurrection] ← TagServiceImpl.java:58-70 + ReactiveTagRepositoryImpl.java:227-241, 272-286
- bugs_limitations_corner_cases[empty-batch contract] ← ReactiveTagRepositoryImpl.java:181-183 + ReactiveAbstractCRUDRepository.java:115-117
- bugs_limitations_corner_cases[listTagsRelations null origin] ← ReactiveTagRepositoryImpl.java:101-117
- bugs_limitations_corner_cases[CTE name collision] ← ReactiveTagRepositoryImpl.java:150, 373-392
- bugs_limitations_corner_cases[external-aggregate divergence] ← ReactiveTagRepositoryImpl.java:373-391
- security.auth_mode_relevance ← ReactiveTagRepositoryImpl.java:1-401 + callers grep
- security.ingestion_filter_relevance ← ExternalTagIngestionRequestProcessor.java:34, 53 + ReactiveTagRepositoryImpl.java:179-215
- security.authorization_assertions ← ReactiveTagRepositoryImpl.java:1-401 (no @PreAuthorize, no permission service calls)
- security.owner_scoping ← ReactiveTagRepositoryImpl.java:120-167 (no owner column, no per-Owner filter)
- security.data_exposure ← ReactiveTagRepositoryImpl.java:120-167 + callers
- security.known_security_gaps ← ReactiveTagRepositoryImpl.java:1-401 (no @ActivityLog) + ExternalTagIngestionRequestProcessor.java:38-44 + DataEntityServiceImpl.java:358 (UPSTREAM @ActivityLog)
- performance.hot_paths ← ReactiveTagRepositoryImpl.java:137-167, 179-215, 68-81 + caller line refs
- performance.throughput_characteristics ← JooqReactiveOperations.java:69-84 + ReactiveTagRepositoryImpl.java:244-264, 326-347, 350-371
- performance.resource_allocation ← ReactiveTagRepositoryImpl.java:160-167
- performance.scaling_characteristics ← ReactiveTagRepositoryImpl.java:1-401 (no FOR UPDATE, no advisory lock) + ReactiveTagRepositoryImpl.java:138, 147-148
- performance.known_performance_gaps ← repository method + caller line refs + TagRepositoryImplTest.java:239-267
- feature_hint.pillar_id ← system-mission.md P-01 Data Discovery, sub-feature "Manual Object Tagging"
- feature_hint.drift_class_facets ← LSN-019 (this batch's discovery) + REFACTOR-223 (existing) + bugs_limitations_corner_cases above + system-mission.md canonicalisation candidate "Audit-log Presence Asymmetry"
- feature_hint.cross_pillar_relationships ← system-mission.md `relationships` block

## confidence_per_field

- understanding: HIGH (full file read + parent classes + JooqQueryHelper.paginate trace + LSN-019 empirical confirmation)
- concepts: HIGH (entities, operations, invariants all traced to source file + parent classes + migration suite; the LSN-019 invariant explicitly traced via stress_findings.B1)
- dependencies_semantic: HIGH (all imports + parent classes + JooqQueryHelper.paginate + JooqReactiveOperations + Indexes verified at file:line)
- tests_coverage_semantic: HIGH (full test file read; uncovered-behaviour list cross-referenced against method-body shapes; LSN-019 uncovered-behaviour explicitly called out; probe P-010 will provide CI-side regression protection)
- docs_link_semantic: HIGH (live WebFetch of both inferred URLs + OpenAPI spec lines 344-346 read directly; the spec-vs-code drift on the popular-tags ordering is now explicit)
- implicit_adrs: HIGH for the 6 long-standing ADRs; MEDIUM for the paginate-inside-CTE ADR (the pattern consistency is strong evidence of intent but no comment / exception / annotation defends the choice specifically for the popular-tags case — borderline gap)
- bugs_limitations_corner_cases: HIGH (eleven concerns each anchored at file:line; LSN-019 is the headline; the others survive from the v0.3.0 sidecar's analysis)
- security: HIGH (auth mode + ingestion-filter relevance + zero-auth-checks all verified end-to-end; LSN-019 data-exposure consequence added)
- performance: MEDIUM (hot-paths and characteristics traced; LSN-019 paginate-inside-CTE has a counter-intuitive performance UPSIDE flagged; no EXPLAIN run this session)
- feature_hint: HIGH (pillar mapping is verbatim from system-mission.md P-01; LSN-019 added as drift-class-facet)
- stress_findings: HIGH (every triggered question has a trace-answer OR probe; B1 is the LSN-019 case-law instantiation; A1/A2/E1/E2 are non-trivial boundary findings that the previous sidecar version did not surface)

## Maintainer notes

(empty — preserved from prior schema position; no maintainer body was present in the v0.3.0 sidecar at this heading)

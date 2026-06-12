---
node_id: "odd-platform java repository reactive repository:ReactiveTagRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 82812cdf1e01e38ac55b3e5ffb03eb1d4585d675
enriched_at_commit: 82812cdf1e01e38ac55b3e5ffb03eb1d4585d675
enriched_at_branch: "contrib/CTRIB-007-tag-popularity-ordering (base: main @ 6f356b72)"
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: re-enrichment-2026-06-12-ctrib-007-fix
schema_version: v0.5.0
stress_protocol_applied: true
supersedes: enrichment @ 9ac6436e (2026-05-20, file-analyser/0.4.0 — the LSN-019 canary sidecar)
---

# ReactiveTagRepositoryImpl — semantic understanding

## understanding

`ReactiveTagRepositoryImpl` is the jOOQ/Reactor persistence surface for everything ODD does with `Tag` rows and their three relation tables (`TAG_TO_DATA_ENTITY`, `TAG_TO_DATASET_FIELD`, `TAG_TO_TERM`); it extends `ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` so all base CRUD reads through a `tag.deleted_at IS NULL` filter. Beyond CRUD it hosts (a) read-side aggregations — `getDto`, `listDataEntityDtos`, `listDatasetFieldDtos`, and the popular-tags surface `listMostPopular`, which **as of commit 82812cdf (CTRIB-007 / GitHub #1773 Thread A, ships 0.28.0) genuinely delivers popularity ordering**: usage is aggregated over the FULL filtered tag directory first (data-entity + dataset-field arms summed via a UNION-ALL CTE), and `paginate(...)` is applied to the aggregated select ordered `count DESC, TAG.ID ASC` (lines 137-171) — replacing the pre-fix paginate-before-count shape that returned the oldest `size` tags re-ranked among themselves (LSN-019 / PLT-026); (b) relation lookups (`listByNames`, `listByTerm`, `listTagsRelations`, `listTagRelations`); (c) per-relation create/delete primitives (`onDuplicateKeyIgnore` creates, hard-delete removes); and (d) the bulk-upsert `ingestData(List<TagPojo>)` riding the `TAG_NAME_UNIQUE` partial index with `ON CONFLICT ... WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *` — the platform's only DB-level race protection for concurrent novel-name creation.

## concepts

- entities: [
    "`TagPojo` (jOOQ-generated row pojo for `tag`: `id`, `name`, `important`, `created_at`, `updated_at`, `deleted_at` — `is_deleted` dropped in `V0_0_64__remove_is_deleted_field.sql:107-108`)",
    "`TagDto` (service-layer record `TagDto(TagPojo tagPojo, Long usedCount, Boolean external)` — `TagDto.java:5`)",
    "`TagToDataEntityPojo` (`tag_to_data_entity` row: `(tag_id, data_entity_id, external)` — `external = true` marks ingestion-derived relations)",
    "`TagToDatasetFieldPojo` (`tag_to_dataset_field` row: `(tag_id, dataset_field_id, origin)`, `origin` a `TagOrigin` enum — `INTERNAL | EXTERNAL | EXTERNAL_STATISTICS` per `TagOrigin.java:4-6`)",
    "`TagToTermPojo` (`tag_to_term` row: `(tag_id, term_id)`)",
    "`Indexes.TAG_NAME_UNIQUE` (jOOQ handle to the partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` — `V0_0_64__remove_is_deleted_field.sql:103-105`)"
  ]
- operations: [
    "`getDto(long id)` — single-row read with left-join count + `boolOr(external)`; `idCondition(id)` (line 61) is overridden by `ReactiveAbstractSoftDeleteCRUDRepository.idCondition` (lines 76-79) to add `deleted_at IS NULL`",
    "`listDataEntityDtos(Long dataEntityId)` — all non-deleted tags attached to one data entity (lines 68-81)",
    "`listDatasetFieldDtos(long datasetFieldId)` — same shape for dataset-field tags; the `external` aggregate is `boolOr(ORIGIN.eq(EXTERNAL))` (line 87) because the relation carries a `TagOrigin` enum, not a boolean",
    "`listTagsRelations(Collection<Long> datasetFieldIds, TagOrigin origin)` (lines 100-117) — dataset-field relations with optional origin filter; callers pass all three enum values: `EXTERNAL` (ExternalTagIngestionRequestProcessor.java:108), `EXTERNAL_STATISTICS` (DatasetFieldServiceImpl.java:217-218), `INTERNAL` (DatasetFieldServiceImpl.java:354)",
    "`listByNames(Collection<String> names)` (lines 119-125) — case-SENSITIVE exact-match lookup driving `TagServiceImpl.divideTagsByExistence`; soft-delete filter applied via `addSoftDeleteFilter` (line 122)",
    "`listByTerm(long termId)` (lines 127-135) — joins `tag_to_term` + `tag`; explicit `TAG.DELETED_AT.isNull()` (line 132)",
    "`listMostPopular(String query, List<Long> ids, int page, int size)` (lines 137-171) — **FIXED CHAIN (82812cdf): aggregate-first, paginate-after.** (1) lines 140-145 build the homogeneous filtered tag select (`listCondition(query)` adds case-insensitive name-contains + `deleted_at IS NULL` via the soft-delete override; optional `TAG.ID.in(ids)`); (2) line 150 materialises the FULL filtered select as `tag_cte`; (3) line 151 + lines 377-396 `getDataEntityWithDatasetFields` builds the UNION-ALL of per-tag counts from `tag_to_data_entity` and `tag_to_dataset_field`; (4) lines 153-157 the aggregated select sums `count` and `boolOr`s `external` across both arms, GROUP BY tag fields; (5) **lines 159-162 `paginate(aggregatedSelect, [count DESC, TAG.ID ASC], (page-1)*size, size)`** — ordering and truncation now happen AFTER the global aggregation, so page 1 IS the globally most-used tags with a deterministic id-ASC tiebreak; (6) lines 164-170 `pageifyResult(records, mapTag, fetchCount(query, ids))` — `_total`/`_next` from the paginate window functions, with `fetchCount` as the empty-page fallback. The in-code comment at lines 147-149 states the intent and names the old failure shape verbatim.",
    "`listTagRelations(Collection<Long> dataEntityIds)` (lines 173-181) — bulk fetch of `tag_to_data_entity` rows, soft-delete filter on the tag side",
    "`ingestData(List<TagPojo> tags)` (lines 183-219) — bulk upsert `INSERT ... ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *`; conflict target resolved dynamically from `Indexes.TAG_NAME_UNIQUE.getFields()` (lines 203-206); partitioned at `BATCH_SIZE` via `executeInPartitionReturning` (line 196)",
    "`createDataEntityRelations` / `createDatasetFieldRelations` / `createTermRelations` — bulk inserts with `onDuplicateKeyIgnore` (lines 265, 371, 348): idempotent assignment",
    "Six `delete*Relations` overloads — all hard-delete (`DSL.delete(...)` / `DSL.deleteFrom(...)`); relation tables are never soft-deleted, only `tag` rows are"
  ]
- invariants: [
    "Soft-delete is mediated by `deleted_at IS NULL` on `tag` (`V0_0_64__remove_is_deleted_field.sql:99-108`); migration lineage `V0_0_36` → `V0_0_57` → `V0_0_64`.",
    "Tag-name uniqueness is the PARTIAL unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (`V0_0_64:103-105`); a soft-deleted tag does not block reinsertion of its name.",
    "`listByNames` name match is case-SENSITIVE (`TAG.NAME.in(names)`, line 122 — no LOWER/ILIKE); `listMostPopular`'s `query` is case-INSENSITIVE substring (`nameField.containsIgnoreCase`, ReactiveAbstractCRUDRepository.java:242-243). `Postgres` and `postgres` are distinct directory rows.",
    "**`listMostPopular` pagination is applied OUTSIDE the aggregation (fixed invariant as of 82812cdf).** The candidate set entering `paginate` is the per-tag usage aggregate over the WHOLE filtered directory; ordering is `count DESC, TAG.ID ASC` at all three layers of the paginate wrap (window, inner LIMIT select, outer select — JooqQueryHelper.java:73, 79, 88). A young heavily-used tag reaches page 1 regardless of directory size. Pre-82812cdf deployments (every release through 0.27.x) have the inverted shape (LSN-019 / PLT-026): pagination by `TAG.ID ASC` inside the CTE before counting → the oldest `size` tags re-ranked among themselves.",
    "Equal-count ties break deterministically by `TAG.ID ASC` — an EXPLICIT secondary order field (line 161), not an accident of row order as pre-fix.",
    "`Page._total` counts TAGS matching the filter (page-size-independent): `count(*) OVER ()` over the aggregated rows (JooqQueryHelper.java:72) when the page has rows; `fetchCount(query, ids)` (`SELECT count(*) FROM tag WHERE listCondition` — ReactiveAbstractCRUDRepository.java:229-234, soft-delete filtered via the override at ReactiveAbstractSoftDeleteCRUDRepository.java:92-94) when the page is empty. Both count the same set.",
    "`JooqQueryHelper.homogeneityCheck` (the paginate gatekeeper) exempts ALL unqualified (computed-alias) fields from the one-table invariant (JooqQueryHelper.java:141-146, comment at 143-145) — this neighbour-contract change is what makes the aggregated select paginatable; the FTS rank alias previously special-cased now falls under the general exemption. The invariant binds only table-qualified fields (lines 147-152).",
    "`Indexes.TAG_NAME_UNIQUE.getFields()` is the dynamic conflict-target for the upsert (lines 203-206); the `WHERE TAG.DELETED_AT.isNull()` conflict predicate is HARDCODED (line 211) and must track the partial-index predicate manually.",
    "The upsert's `DO UPDATE SET name = EXCLUDED.name` (lines 212-213) is a no-op write whose only purpose is triggering RETURNING so callers receive existing-row ids.",
    "Relation creates use `onDuplicateKeyIgnore` (write-once, no-op on replay); only `ingestData` uses `DO UPDATE` (to keep the RETURNING contract).",
    "Empty-collection guards short-circuit every batch method (lines 103-105, 185-187, 223-225, 249-251, 272-274, 314-316, 331-333, 355-357) — load-bearing, since jOOQ rejects zero-record INSERTs. `listByNames` is the one batch-shaped method WITHOUT a guard (lines 119-125).",
    "Hard-delete vs soft-delete asymmetry: `tag` rows soft-delete (ReactiveAbstractSoftDeleteCRUDRepository.java:50-74); all `tag_to_*` relation rows hard-delete here. A deleted-then-recreated tag gets a new id and zero relations."
  ]
- audiences: [
    "`TagServiceImpl` — dominant caller (service for `TagController`'s 4 REST operations + the tag side of ingestion via `getOrInjectTagByName`)",
    "`ExternalTagIngestionRequestProcessor` (FINALIZING phase of the ingestion pipeline) — relation diffing for collector-pushed tags; data-ENTITY tag names ride the race-safe `ingestData` upsert (via tagService.getOrInjectTagByName:71), but dataset-FIELD tag names ride the TOCTOU-prone `getOrCreateTagsByName`/`bulkCreate` path (ExternalTagIngestionRequestProcessor.java:104)",
    "`DatasetFieldServiceImpl` — internal/statistics tag relation maintenance across schema-version transitions",
    "`DataEntityServiceImpl` / `DataEntityPermissionExtractor` / `TagActivityHandlerImpl` — three independent `listDataEntityDtos` readers on the data-entity detail path (render, policy context, activity before/after capture)",
    "`TermServiceImpl` (service/term/TermServiceImpl.java:257, via `tagService.getOrCreateTagsByName`) — term tagging is a second side-channel into the global tag directory"
  ]

## stress_findings

Stress Protocol (Rule 9) fired on every detected trigger across six categories. Headline: the LSN-019 drift (S-B-1 of the superseded sidecar) is **RESOLVED in the working tree** — re-traced end-to-end below.

### Category A — Tunables

- **A1 — `page` handling in `listMostPopular` (line 138).** `page=0` → `(0-1)*size` → negative OFFSET (JooqQueryHelper.java:81) → PostgreSQL error `OFFSET must not be negative`; `page=-1` same class. No clamping in this file or the helper. Contract-level: the OpenAPI `PageParam` has NO `minimum:` constraint (odd-platform-specification/components.yaml:4219-4226), so nothing blocks `page=0` before the SQL. UNCHANGED by the fix. Confidence: STATIC-INFERRED. Evidence: ReactiveTagRepositoryImpl.java:138, 162 + JooqQueryHelper.java:80-81 + components.yaml:4219-4226.
- **A2 — `size` handling.** `size=0` → `LIMIT 0` → zero records → `pageifyResult` empty branch → `total` from `fetchCount(query, ids)` (full match count), `hasNext=false` (JooqQueryHelper.java:94-100, 121-123). `size=-1` → negative LIMIT → PostgreSQL error. `size=100000` → returns the whole directory; **post-fix the aggregation cost is INVARIANT to `size`** (the full-directory aggregate runs regardless; `size` bounds only the returned rows) — the pre-fix `O(size)` cost coupling is gone. Confidence: STATIC-INFERRED. Evidence: ReactiveTagRepositoryImpl.java:159-170 + JooqQueryHelper.java:80-81, 91-126.
- **A3 — `BATCH_SIZE` partitioning in `ingestData` (line 196).** `BATCH_SIZE = 1000` (JooqReactiveOperations.java:24); `executeInPartitionReturning` (JooqReactiveOperations.java:69-84) splits >1000-row upserts into sequential per-partition statements inside the caller's TX. Confidence: STATIC-INFERRED.
- **A4 — `listByNames([])`.** No empty guard (lines 119-125, unlike the eight guarded methods); `TAG.NAME.in(emptyList)` emits a never-true predicate → zero rows, one wasted round-trip. Harmless, inconsistent. Confidence: STATIC-INFERRED.
- **A5 — `listMostPopular(ids=[])`.** `CollectionUtils.isNotEmpty(ids)` (line 141) SKIPS the filter on empty → "no constraint", not "zero results" — asymmetric with `listByNames` but matching the optional-`ids` API contract. Confidence: STATIC-INFERRED.

### Category B — Name-behavior pairs

- **B1 — `listMostPopular`: name and OpenAPI promise (`'Gets the list of existing tags sorted by popularity'`, odd-platform-specification/openapi.yaml:345) vs implementation — drift: NONE as of 82812cdf.** Chain re-trace at the working tree:
  - Lines 140-145: filtered homogeneous tag select (name-contains, optional ids, `deleted_at IS NULL`).
  - Line 150: `tagCte = homogeneousQuery.asTable("tag_cte")` — the CTE is the FULL filtered directory (pre-fix it was the paginated/truncated select).
  - Lines 151 + 377-396: UNION-ALL usage arms over `tag_to_data_entity` and `tag_to_dataset_field`, LEFT JOINs guarantee one row per tag per arm.
  - Lines 153-157: aggregated select — `sum(count)`, `boolOr(external)`, GROUP BY tag fields → exactly one row per matching tag.
  - Lines 159-162: `paginate(aggregatedSelect, [field("count") DESC, TAG.ID ASC], (page-1)*size, size)` — ordering and LIMIT applied to the aggregate. `JooqQueryHelper.paginate` (62-89) applies the order list in the `row_number()` window (:73), the inner LIMIT select (:79-81), and the outer select (:88).
  - Net SQL behaviour: **"rank ALL matching tags by total usage desc, tie-break id asc, return page N"** — the name's promise, delivered.
  - The intent comment at lines 147-149 names the old failure: *"paginating the raw tag select windowed by id BEFORE counting returned the oldest tags re-ranked among themselves instead of the most popular"*.
  - Historical record (dated): pre-fix releases (≤0.27.x, e.g. main @ 6f356b72) have DRIFT_NAME_VS_BEHAVIOR here — LSN-019 (empirical proof at `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32`), tracked as PLT-026, fixed by GitHub #1773 Thread A / CTRIB-007.
  - Verification stack: failing-first unit test `TagRepositoryImplTest.testListMostPopularReturnsGloballyMostUsedTags` (TagRepositoryImplTest.java:276-335 — javadoc at 270-275 records the RED-on-pre-fix-main framing) + e2e `integration-tests/protocols/IT-005-top-tags-ordering.md` (status `ready`; frontmatter records GREEN-on-fix + RED-on-ref:main proven 2026-06-12) + maintainer's live API capture 2026-06-12 (35-tag seed; reported in the CTRIB-007 re-enrichment directive — attributed, not re-run this session).
  - Confidence: STATIC-INFERRED (end-to-end chain) + test-pinned.
- **B2 — `listByNames`.** Case-SENSITIVE exact match (line 122, no LOWER/ILIKE); soft-delete filtered (`addSoftDeleteFilter`, ReactiveAbstractSoftDeleteCRUDRepository.java:96-104); `names=null` → NPE from jOOQ's in(); duplicate input names dedupe in SQL. Confidence: STATIC-INFERRED.
- **B3 — `getDto`.** Soft-deleted or missing id → `Mono.empty()` (lines 54-66 + soft-delete idCondition override at ReactiveAbstractSoftDeleteCRUDRepository.java:76-79). No throw on miss. Confidence: STATIC-INFERRED.
- **B4 — `ingestData` upsert semantics.** Conflict target dynamic from the index handle (lines 203-206); conflict predicate hardcoded `WHERE TAG.DELETED_AT.isNull()` (line 211); no-op `DO UPDATE SET name = EXCLUDED.name` (lines 212-213) exists to trigger RETURNING; empty input short-circuits (lines 185-187). Confidence: STATIC-INFERRED.
- **B5 — `deleteDataEntityRelations` overloads (lines 221-245).** Both idempotent on missing rows (empty Flux, no exception); collection overload builds OR-of-AND predicates; single-tag overload deletes all of a tag's relations. Confidence: STATIC-INFERRED.
- **B6 — `query` parameter via `listCondition` (line 140).** Case-insensitive substring on `tag.name` (ReactiveAbstractCRUDRepository.java:240-249) + `deleted_at IS NULL` via the soft-delete override (ReactiveAbstractSoftDeleteCRUDRepository.java:86-94). Confidence: STATIC-INFERRED.

### Category C — Orderings / pagination / aggregation

- **C1 — ORDER BY of `listMostPopular` at the lowest SQL layer.** `count DESC, id ASC` in all three paginate layers (JooqQueryHelper.java:73 window, 79 inner, 88 outer); the inner select's `ORDER BY ... LIMIT size OFFSET (page-1)*size` is what the database truncates by. Tie-break: EXPLICIT `TAG.ID ASC` (line 161) — deterministic, resolving the pre-fix "no secondary order" gap. Page subsets are stable across calls for stable data. Confidence: STATIC-INFERRED.
- **C2 — `paginate` over an AGGREGATED select + the helper-contract change.** `paginate` (JooqQueryHelper.java:62-89) gates on `homogeneityCheck(baseSelect.getSelect())` (:66). The check (lines 138-154) now SKIPS every unqualified field — the comment (143-145): *"computed alias fields (the FTS rank, aggregations like count) are not table columns and cannot break the one-table invariant this check guards"* — so the aggregated select (qualified `union_usages` tag fields + unqualified `count`/`external` aliases) passes. This neighbour contract is documented HERE because the helper has no node of its own. Weakened-invariant note: the check no longer rejects a select whose unqualified aliases project columns of OTHER tables — the one-table invariant binds only qualified fields; `JooqQueryHelperTest` pins both the alias acceptance (:26-35) and the two-qualified-tables rejection (:37-44). Order-field resolution: `getOrderFields` (:156-161) resolves `field("count")` and `TAG.ID` by name against the wrapped table — both exist in the aggregated select. Confidence: STATIC-INFERRED.
- **C3 — UNION-ALL aggregation correctness (lines 377-396).** Each arm LEFT JOINs one relation table and GROUPs BY the CTE fields, so every tag appears in both arms (count 0 when unused); the outer `sum` adds data-entity + dataset-field usage; `boolOr` merges external flags. Arm divergence: the data-entity arm reads the boolean `EXTERNAL` column (:382); the dataset-field arm computes `ORIGIN.ne('INTERNAL')` (:389) — `EXTERNAL_STATISTICS` counts as external here. Confidence: STATIC-INFERRED.
- **C4 — `listDataEntityDtos` / `listDatasetFieldDtos` have no ORDER BY (lines 68-98).** Row order is planner-determined; no current caller depends on it (UI sorts client-side). Confidence: STATIC-INFERRED.
- **C5 — `listByNames` has no ORDER BY.** Caller materialises to existence sets (TagServiceImpl.java:144-159). Confidence: STATIC-INFERRED.
- **C6 — relation list methods have no ORDER BY (lines 100-117, 173-181).** Callers diff via collections; order-independent. Confidence: STATIC-INFERRED.
- **C7 — `_total`/`_next` semantics (lines 164-170).** `_total` = `count(*) OVER ()` across aggregated rows = number of matching TAGS (page-independent); `_next` = `_row <> _total` per row (JooqQueryHelper.java:72-73, 86, 104-115); empty page falls back to `fetchCount(query, ids)` which counts the same set under the same soft-delete filter (ReactiveAbstractCRUDRepository.java:229-234 + ReactiveAbstractSoftDeleteCRUDRepository.java:92-94). The new unit test asserts total=8 / hasNext=true on a 5+3 directory with pageSize 5 (TagRepositoryImplTest.java:327-328). Confidence: STATIC-INFERRED.

### Category D — Authorization gates

- **D1 — zero authorization checks in this file (lines 1-405).** No `@PreAuthorize`, no `permissionService`, no owner scoping. The repository trusts upstream: the REST perimeter for `GET /api/tags` (operationId `getPopularTagList`, openapi.yaml:342-346; TagController.java:36-44) and the per-permission gates on the write routes live at controller/security-config layers — auth-mode matrix (DISABLED/LOGIN_FORM/OAUTH2/LDAP) is the TagController sidecar's question. Confidence: STATIC-INFERRED for this file; REFERENCE → `odd-platform__java__TagController__controller-class__TagController` for the endpoint gate analysis. (Correction vs the superseded sidecar: the popular-tags REST path is `GET /api/tags`, not `/api/tags/popular`.)

### Category E — Resource boundaries

- **E1 — `ingestData` concurrent novel-name race: SAFE.** The partial unique index serialises by-name conflicts; the loser routes to `DO UPDATE` and still receives the row via RETURNING (lines 208-214). Replay-safe, per-name contention only. Confidence: STATIC-INFERRED.
- **E2 — `bulkCreate` race: NOT safe (inherited).** `ReactiveAbstractCRUDRepository.bulkCreate` (112-126) has no `onConflict`; a unique-violation translates to `UniqueConstraintException("Tag with this name already exists")` (ExceptionUtils.java:30-36, 54-56). The `TagServiceImpl.getOrCreateTagsByName` TOCTOU (listByNames :145 → bulkCreate :82) surfaces this to callers — including, sharpened this pass, the INGESTION pipeline's dataset-field arm (`tagService.getOrCreateTagsByName` at ExternalTagIngestionRequestProcessor.java:104 inside the FINALIZING `@ReactiveTransactional` at :38): a lost race fails the whole ingestion request TX, not just a UI PUT. Confidence: STATIC-INFERRED.
- **E3 — TX boundaries.** No `@ReactiveTransactional` in this file; methods participate in caller TXs (TagServiceImpl.java:45, 58, 97, 137; ExternalTagIngestionRequestProcessor.java:38) except the inherited `bulkCreate`/`bulkUpdate` which self-annotate (ReactiveAbstractCRUDRepository.java:112-114, 128-130). Confidence: STATIC-INFERRED.
- **E4 — soft-delete vs concurrent read.** Standard READ COMMITTED snapshots; no cross-method snapshot consistency; callers needing atomic read-then-act wrap in their own TX. Confidence: STATIC-INFERRED.
- **E5 — `onDuplicateKeyIgnore` relation creates (lines 265, 348, 371): replay-safe** (PostgreSQL `ON CONFLICT DO NOTHING`). Confidence: STATIC-INFERRED.

### Category F — Request-input naming alignment (new in this schema revision)

- **F1 — `query` (listMostPopular, line 138).** Promise: generic free-text filter (no specific entity implied). Implementation: case-insensitive substring on `tag.name` (B6 trace). Verdict: MATCHES. Evidence: ReactiveTagRepositoryImpl.java:140 + ReactiveAbstractCRUDRepository.java:242-243.
- **F2 — `ids` (listMostPopular, line 138).** Promise: restrict to these tag ids. Implementation: `TAG.ID.in(ids)` when non-empty (lines 141-143); empty/null means NO restriction (A5). Verdict: MATCHES, with the empty-means-all contract called out. Evidence: lines 141-143.
- **F3 — `page`/`size` (line 138-139).** Promise: page N of the popularity-ranked list. Implementation honours it post-fix (B1); pre-fix this pair was the LSN-019 silent translation ("page N of the id-ordered directory, re-ranked"). Verdict: MATCHES at 82812cdf. Evidence: lines 159-162.
- **F4 — `names` (listByNames, line 120).** Promise: look up tags by name. Implementation: exact, case-sensitive, soft-delete-filtered IN-match. Verdict: MATCHES with a sharp caveat — callers treating names as case-insensitive identifiers mint near-duplicates (routes to bugs entry 3; the live tagging doc now states "Tag names are case-sensitive" — WebFetch 2026-06-12). Evidence: line 122.
- **F5 — `origin` (listTagsRelations, line 101-102).** Promise: filter relations by tag origin. Implementation: equality filter when non-null; null returns ALL origins (lines 112-114). Verdict: MATCHES; the null contract is implicit (routes to bugs entry 9). Evidence: lines 112-114.
- **F6 — `tags` (ingestData, line 184).** Promise: ingest these tag rows. Implementation: name-keyed upsert returning canonical rows (B4). Verdict: MATCHES. Evidence: lines 195-218.

### probes_emitted

- probe_id: P-249 — question: "post-fix `listMostPopular` aggregates over the FULL filtered directory on every call; what is the execution cost at 10k-tag / 200k-relation scale, given Catalog Overview consumes this endpoint?" — probe_path: lineage/odd-platform/probes/P-249.yaml (test_class: performance).
- **P-010 lifecycle note (emitted by the superseded enrichment):** P-010 pins the EQUAL-COUNT regime (35 tags, all usage=2, assert oldest-30 returned). That regime is **fix-invariant**: the fixed chain's `count DESC, id ASC` ordering ALSO returns ids 1009..1038 when every count ties — so P-010's primary assertion stays green across the fix and CANNOT serve as the fix's regression guard (its own realism_caveats predicted a flip; the deterministic id-ASC tiebreak chosen by the fix makes the prediction wrong). The discriminating scenario (varying counts, youngest most-used) is what `TagRepositoryImplTest.testListMostPopularReturnsGloballyMostUsedTags` + IT-005 pin. P-010 is a candidate for retirement or amendment toward its own proposed P-010-B variant — flagged for the probe-runner/maintainer sweep.

### stress_summary

- triggers_total: 30 (A:5, B:6, C:7, D:1, E:5, F:6)
- questions_total: 34
- answers_static_inferred: 31
- answers_probe_needed: 1 (P-249 — directory-scale cost)
- answers_reference: 2 (TagController auth-mode matrix; UI Top-tags consumer multiplicity)
- drift_flags: 0 active (B1 drift RESOLVED at 82812cdf; recorded historically for ≤0.27.x deployments)

## upstream_callers

- entry_point: "rest:GET /api/tags (operationId getPopularTagList)"
  caller_node: "odd-platform java controller controller:TagController → TagServiceImpl.listMostPopular"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:36-44 → TagServiceImpl.java:73-77 → reactiveTagRepository.listMostPopular (TagServiceImpl.java:75)"
  observation_class: rest-call
- entry_point: "ui_route:/ (Catalog Overview 'Top tags' strip) + search Tag-facet seed list"
  caller_node: "REFERENCE — UI consumer nodes not yet enriched"
  multiplicity_per_trigger: unresolved
  unresolved: true
  evidence: "integration-tests/protocols/IT-005-top-tags-ordering.md:16-40 names the surface; live doc page features/data-discovery/tagging (WebFetch 2026-06-12) states both surfaces consume this endpoint"
  observation_class: ui-call
- entry_point: "rest:POST/PUT/DELETE tag + data-entity/term tag assignment routes (via TagServiceImpl)"
  caller_node: "TagServiceImpl"
  multiplicity_per_trigger: 1 per service call
  evidence: "TagServiceImpl.java — bulkCreate :40,:82; getDto :47,:60; update :52; deleteTermRelations(long) :64; deleteDataEntityRelations(long) :65; delete :66; ingestData :92; listTagRelations :100-101; deleteDataEntityRelations(Collection) :117; createDataEntityRelations :118; listDataEntityDtos :119; listByTerm :126; deleteTermRelations(termId, ids) :132; createTermRelations :141; listByNames :145"
  observation_class: rest-call
- entry_point: "ingestion:POST /ingestion/entities (FINALIZING phase)"
  caller_node: "ExternalTagIngestionRequestProcessor"
  multiplicity_per_trigger: 1 per ingestion request carrying tags
  evidence: "ExternalTagIngestionRequestProcessor.java — field :34; listTagRelations :75-76; deleteDataEntityRelations :85; createDataEntityRelations :88; listTagsRelations(EXTERNAL) :108; deleteDatasetFieldRelations :115; createDatasetFieldRelations :117; service-mediated getOrInjectTagByName :71 (→ ingestData) and getOrCreateTagsByName :104 (→ bulkCreate — the racy path)"
  observation_class: rest-call
- entry_point: "rest:dataset-field tag/description updates + dataset statistics ingestion"
  caller_node: "DatasetFieldServiceImpl"
  multiplicity_per_trigger: 1 per service call
  evidence: "DatasetFieldServiceImpl.java — field :75; deleteDatasetFieldInternalRelations :124; createDatasetFieldRelations :126, :227, :360; listDatasetFieldDtos :129; listTagsRelations(EXTERNAL_STATISTICS) :217-218; deleteDatasetFieldRelations :225-226; listTagsRelations(INTERNAL) :354"
  observation_class: rest-call
- entry_point: "rest:GET data-entity detail (3 independent readers per request path)"
  caller_node: "DataEntityServiceImpl + DataEntityPermissionExtractor + TagActivityHandlerImpl"
  multiplicity_per_trigger: up to 3 `listDataEntityDtos` calls for one entity during one request flow
  evidence: "DataEntityServiceImpl.java:127, 622; DataEntityPermissionExtractor.java:28, 67; TagActivityHandlerImpl.java:17-18, 41"
  observation_class: rest-call
- entry_point: "rest:term tag assignment"
  caller_node: "TermServiceImpl (service-level, via tagService.getOrCreateTagsByName)"
  multiplicity_per_trigger: 1
  evidence: "service/term/TermServiceImpl.java:257"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERT/UPSERT into `tag` — inherited `bulkCreate` (plain INSERT, ReactiveAbstractCRUDRepository.java:112-126), `ingestData` (ON CONFLICT upsert, lines 195-218), inherited `update`; soft-delete via inherited `delete` (UPDATE deleted_at, ReactiveAbstractSoftDeleteCRUDRepository.java:50-74)"
  evidence: "ReactiveTagRepositoryImpl.java:183-219 + parent classes"
  cardinality_per_call: "1 statement per ≤BATCH_SIZE(1000) partition"
  reachable_from_entry_points: ["rest:tag CRUD routes", "ingestion:POST /ingestion/entities", "rest:term tag assignment", "rest:dataset-field tag updates"]
- side_effect_class: db-write
  description: "`tag_to_data_entity` — bulk insert (onDuplicateKeyIgnore, lines 247-268); hard deletes (lines 221-245)"
  evidence: "ReactiveTagRepositoryImpl.java:221-268"
  cardinality_per_call: "0..N rows per call"
  reachable_from_entry_points: ["rest:data-entity tag assignment", "ingestion:POST /ingestion/entities"]
- side_effect_class: db-write
  description: "`tag_to_dataset_field` — bulk insert (line 371); hard deletes incl. INTERNAL-only variant (lines 292-327)"
  evidence: "ReactiveTagRepositoryImpl.java:292-327, 353-375"
  cardinality_per_call: "0..N rows per call"
  reachable_from_entry_points: ["rest:dataset-field tag updates", "ingestion:POST /ingestion/entities"]
- side_effect_class: db-write
  description: "`tag_to_term` — bulk insert (line 348); hard deletes (lines 270-290)"
  evidence: "ReactiveTagRepositoryImpl.java:270-290, 329-351"
  cardinality_per_call: "0..N rows per call"
  reachable_from_entry_points: ["rest:term tag assignment"]
- side_effect_class: log-emit
  description: "None directly; DataAccessException paths translate via `onErrorMap(..., ExceptionUtils::translateDatabaseException)` (JooqReactiveOperations.java:41, 48) — `bulkCreate` races surface as `UniqueConstraintException(\"Tag with this name already exists\")` (ExceptionUtils.java:54-56); `ingestData` swallows the same race silently via DO UPDATE"
  evidence: "JooqReactiveOperations.java:41, 48 + ExceptionUtils.java:30-36, 54-56"
  cardinality_per_call: "0..1"
  reachable_from_entry_points: ["all of the above"]
- Search-index, activity-feed, external I/O: NONE in this class — search vectors live in the SearchEntrypoint repositories (orchestrated by TagServiceImpl.java:161-167); activity events are emitted upstream; no HTTP/S3/SMTP. No locks, no caches; the unique index is the only concurrency mediator (E1).

## dependencies_semantic

- requires-feature: [
    "Relation tables `tag_to_data_entity` (external flag, `V0_0_47__add_tag_external_attribute.sql:1`), `tag_to_dataset_field` (TagOrigin column), `tag_to_term`",
    "`tag.deleted_at` column + literal name coupling (`DEFAULT_DELETED_AT_FIELD = \"deleted_at\"`, ReactiveAbstractSoftDeleteCRUDRepository.java:25)",
    "Partial unique index `tag_name_unique` (`V0_0_64:103-105`) — dynamic conflict target (lines 203-206) + HARDCODED predicate (line 211)",
    "`ExceptionUtils.formatMessage` cascade names TAG_NAME_UNIQUE (ExceptionUtils.java:54-56)",
    "`TagOrigin` enum (TagOrigin.java:3-7) — INTERNAL referenced at lines 296, 389; EXTERNAL at line 87; callers also pass EXTERNAL_STATISTICS through the `origin` parameter",
    "`JooqQueryHelper.paginate` (62-89) + `homogeneityCheck` alias exemption (138-154) — LOAD-BEARING for `listMostPopular`: reverting the exemption breaks the aggregated paginate with `IllegalArgumentException(\"...heterogeneous\")`; `pageifyResult` (91-126) supplies the Page contract",
    "`fetchCount(query, ids)` (ReactiveAbstractCRUDRepository.java:229-234) — empty-page total fallback, soft-delete-consistent via the listCondition override"
  ]
- requires-config: [] — N/A. No configuration reads; behaviour unconditional.
- requires-runtime: [
    "Spring `@Repository` bean (line 43), constructor injection of JooqReactiveOperations + JooqQueryHelper (lines 49-52)",
    "PostgreSQL — partial unique index, boolOr, sum, UNION ALL, named CTE `tag_cte` (line 150), window functions via paginate",
    "reactor-core Mono/Flux shapes"
  ]
- couples-to: [
    "`ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (line 44) — delete/idCondition/listCondition/addSoftDeleteFilter overrides",
    "`ReactiveTagRepository` interface (line 45)",
    "`JooqReactiveOperations.executeInPartitionReturning` (69-84; BATCH_SIZE=1000 at :24)",
    "`Indexes.TAG_NAME_UNIQUE` (jOOQ-generated)",
    "`DateTimeUtil.generateNow()` (line 189) — updated_at stamping",
    "Static jOOQ tables TAG / TAG_TO_DATASET_FIELD / TAG_TO_DATA_ENTITY / TAG_TO_TERM (lines 38-41)"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Basic create / bulk-create / update round-trips"
    test_class: integration
    test_files: ["TagRepositoryImplTest.java:31 (testCreateTagPojo), :53 (testBulkCreateTag), :220 (testUpdateTag) — BaseIntegrationTest/Testcontainers"]
  - behaviour: "`listByNames` returns requested names (happy path, 3 tags)"
    test_class: integration
    test_files: ["TagRepositoryImplTest.java:78 (testGetTagsByListNames)"]
  - behaviour: "Data-entity relation create/delete incl. empty-input no-ops"
    test_class: integration
    test_files: ["TagRepositoryImplTest.java:100, :127, :153, :165, :195"]
  - behaviour: "`listMostPopular` filter happy path — query-filtered subset returned with correct total/hasNext"
    test_class: integration
    test_files: ["TagRepositoryImplTest.java:240-268 (testListMostPopular)"]
  - behaviour: "**The fixed popularity contract (was the LSN-019 CRITICAL gap):** directory > page size, most-used tags are the YOUNGEST → page 1 contains them first, `count DESC, id ASC` order pinned with `containsExactly`, total counts the whole filtered directory, hasNext true, top usedCount asserted. RED on pre-fix main per the test javadoc."
    test_class: integration
    test_files: ["TagRepositoryImplTest.java:276-335 (testListMostPopularReturnsGloballyMostUsedTags; javadoc :270-275)"]
  - behaviour: "`homogeneityCheck` accepts one table's fields + computed unqualified aliases (the paginatable-aggregate contract) AND still rejects two qualified tables"
    test_class: unit
    test_files: ["JooqQueryHelperTest.java:26-35, :37-44"]
  - behaviour: "UI e2e: 'Top Tags' strip on Catalog Overview renders the most-used (youngest) tags at directory > page-size — GREEN-on-fix, RED-on-ref:main"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-005-top-tags-ordering.md (automation: e2e:specs/top-tags-ordering.spec.ts; validates F-018, regresses PLT-026)"]
- uncovered_behaviours:
  - behaviour: "`ingestData` upsert — insert-only, conflict-on-existing-name, mixed batch, >BATCH_SIZE partitioning. Grep `ingestData` in TagRepositoryImplTest.java returns zero matches (search root: odd-platform-api/src/test/java)."
    test_class: integration
    criticality: HIGH
  - behaviour: "Concurrent races: parallel `ingestData` same-name (assert both receive same id, no throw) and parallel `bulkCreate` same-name (assert UniqueConstraintException surfaces) — the TOCTOU pair from E1/E2"
    test_class: integration
    criticality: HIGH
  - behaviour: "`listMostPopular` dataset-FIELD usage arm — the new regression test seeds only `tag_to_data_entity`; a tag used solely on dataset fields contributing to rank is unasserted (UNION-ALL sum across arms)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Case-sensitivity pin for `listByNames` (`Postgres` vs `postgres` as distinct rows)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Soft-deleted tags filtered from `listByNames` / `listMostPopular`"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "page=0 / page=-1 / size=0 / size=-1 boundary shapes (A1/A2) — pin what callers observe (SQL error vs empty page)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`listTagsRelations` origin filter (INTERNAL vs EXTERNAL vs EXTERNAL_STATISTICS vs null=all)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Tag-name content boundaries (empty/whitespace/very long/control chars) — REFACTOR-223's bounded-DoS angle"
    test_class: security
    criticality: LOW
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java (11 tests; Testcontainers integration)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqQueryHelperTest.java (2 unit tests, new with the fix)",
    "integration-tests/protocols/IT-005-top-tags-ordering.md (odd-team e2e protocol + Playwright spec)"
  ]
- gaps: |
    The headline gap of the superseded sidecar (LSN-019 boundary case) is CLOSED by a
    three-layer stack: unit-adjacent helper test, repository integration test (failing-first
    on pre-fix main), and UI e2e (RED-on-ref:main). Residual highest-leverage gaps:
    (1) `ingestData` — every Collector-pushed tag flows through it and it has ZERO coverage;
    (2) the race pair (E1 safe / E2 unsafe) is asserted nowhere, and the unsafe path now
    demonstrably reaches ingestion via the dataset-field arm (ExternalTagIngestionRequestProcessor.java:104);
    (3) the dataset-field usage arm of the popularity rank is unexercised — a regression
    zeroing that arm's contribution would pass today's suite. Probe-side: P-010 pins the
    equal-count regime which is FIX-INVARIANT (see stress probes note) — it guards the
    id-ASC tie determinism, not the fix; P-249 (new) owns the directory-scale cost question.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (grep `@docs` in ReactiveTagRepositoryImpl.java: zero matches).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Manual Object Tagging page — documents the Top-tags surface, tag permissions, inline creation, case-sensitivity"
    last_verified_at: "2026-06-12"
    last_verified_status: 200
    fetched_excerpts: |
      WebFetch 2026-06-12 (status 200), title "Manual Object Tagging". The page NOW carries
      the pre-fix ordering caveat verbatim: "The 'Top tags' strip on Catalog Overview and the
      Tag-facet seed list are sorted by tag id, not by popularity." — "the platform's
      `listMostPopular` query truncates the tag directory to the requested page size BEFORE
      computing the per-tag usage count" — "a catalog with 35 tags of equal popularity and
      `size=30` returns the 30 oldest tags by id; the 5 youngest are absent". It also now
      documents the side-door ("pick from the existing tag vocabulary or create a new tag
      inline" via getOrCreateTagsByName; TAG_CREATE / TAG_UPDATE / TAG_DELETE plus the four
      *_TAGS_UPDATE minting paths + collector ingestion) and case-sensitivity ("Tag names are
      case-sensitive — `finance` and `Finance` are two separate tags").
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/data-discovery/tagging"
    anchor: ""
    rationale: "URL named in the re-enrichment directive — recorded as a fetch failure per Rule 1"
    last_verified_at: "2026-06-12"
    last_verified_status: 404
    fetched_excerpts: |
      WebFetch 2026-06-12: "Page Not Found"; the error page links to
      features/data-discovery/tagging as the tagging documentation. The canonical live path
      retains the /features/ prefix.
    confidence: HIGH (the 404 itself)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — tag permissions + the minting side-door caveats"
    last_verified_at: "2026-06-12"
    last_verified_status: 200
    fetched_excerpts: |
      WebFetch 2026-06-12 (status 200): TAG_CREATE now carries "Operator caveat: TAG_CREATE
      is not the only path that mints new tags — four *_TAGS_UPDATE permissions (data entity,
      dataset field, term) plus collector ingestion all silently create tag rows for novel
      names." DATA_ENTITY_TAGS_UPDATE / DATASET_FIELD_TAGS_UPDATE / TERM_TAGS_UPDATE each
      carry matching minting caveats.
  - pending_release: "0.28.0"
    train_ref: "documentation release/0.28.0 — docs/features/data-discovery/tagging.md fixed-behaviour note (branch not present in the local documentation clone's refs this session — grep release/0.28 in packed-refs: zero matches; ref + sha unverified, confidence LOW on the train pointer itself)"
    rationale: "The fixed-ordering note (aggregate-first, count DESC + id ASC, ships 0.28.0) rides the documentation release train per the release-train gating ADR; live GitBook publishes the latest release (0.27.x), so the live page CORRECTLY shows the pre-fix caveat until the 0.28.0 gate."
- doc_drift_findings:
  - "NO ACTIVE ordering drift at 82812cdf: the OpenAPI promise (`'Gets the list of existing tags sorted by popularity'`, odd-platform-specification/openapi.yaml:345) is now honoured by the implementation (stress B1). The live tagging page's pre-fix caveat accurately describes the latest PUBLISHED release (0.27.x) — expected release-train state, not drift. The caveat becomes stale-drift ONLY if the 0.28.0 documentation gate fails to replace it when the fix publishes; tracked by the pending_release entry above."
  - "RESOLVED since the 2026-05-19 enrichment: the tag-minting side-door (any *_TAGS_UPDATE holder grows the global directory without TAG_CREATE) is now documented on BOTH the tagging page and the permissions catalog (WebFetch 2026-06-12 excerpts above) — the superseded sidecar's drift findings 2 and 3 are closed."
  - "RESOLVED since 2026-05-19: tag-name case-sensitivity is now documented live ('finance and Finance are two separate tags')."

## implicit_adrs

- "**Popularity ranking is computed over the FULL filtered directory BEFORE pagination, with a deterministic `TAG.ID ASC` tiebreak — correctness chosen over the pre-fix O(page-size) aggregation shortcut.** The decision is stated in-code: lines 147-149 *'aggregate usage over the FULL filtered directory FIRST, then order by usage and paginate — paginating the raw tag select windowed by id BEFORE counting returned the oldest tags re-ranked among themselves instead of the most popular'*. Supersedes the superseded sidecar's 'paginate-inside-CTE is the codebase pattern' entry for this method (the plain `list(...)` path, ReactiveAbstractCRUDRepository.java:88-100, legitimately keeps paginate-first because it aggregates nothing)." — evidence: ReactiveTagRepositoryImpl.java:147-162 — intent_anchor: "the lines-147-149 comment quoted above" — confidence: HIGH
- "**`homogeneityCheck` exempts computed (unqualified-alias) fields from the one-table paginate invariant as a general rule** — making ANY single-table-plus-aggregates select paginatable; the FTS rank alias previously special-cased is subsumed by the general exemption. Trade-off accepted: the invariant binds only qualified fields." — evidence: JooqQueryHelper.java:138-154 — intent_anchor: "comment at :143-145: 'computed alias fields (the FTS rank, aggregations like count) are not table columns and cannot break the one-table invariant this check guards' + the dedicated unit pair JooqQueryHelperTest.java:21-44" — confidence: HIGH
- "Partial-unique-index-as-race-protection — `tag_name_unique ... WHERE tag.deleted_at IS NULL` is the platform's only locking mechanism for novel-name creation; `ingestData` leans on it via ON CONFLICT, `bulkCreate` deliberately does not." — evidence: ReactiveTagRepositoryImpl.java:203-214 + V0_0_36__refactor_unique_index.sql:4 + V0_0_57__change_tag_unique_constraint_semantics.sql:3 + V0_0_64__remove_is_deleted_field.sql:103-105 — intent_anchor: "V0_0_64:103-105 — the explicit DROP + re-CREATE of the partial index after the is_deleted column removal" — confidence: HIGH
- "Conflict-target computed from `Indexes.TAG_NAME_UNIQUE.getFields()` rather than hardcoded `TAG.NAME` — index-shape migrations propagate automatically; the WHERE predicate (line 211) does NOT." — evidence: ReactiveTagRepositoryImpl.java:203-211 — intent_anchor: "lines 203-206 — dynamic resolution from the generated index handle" — confidence: HIGH
- "RETURNING-trigger via no-op `DO UPDATE SET name = EXCLUDED.name` — DO NOTHING would hide existing-row ids from the ingestion caller that must build relations." — evidence: ReactiveTagRepositoryImpl.java:208-214 + TagServiceImpl.java:88-94 — intent_anchor: "name set to itself at :212-213" — confidence: HIGH
- "Soft-delete on `tag`, hard-delete on `tag_to_*` — the directory entry carries audit/uniqueness semantics; relation rows do not." — evidence: ReactiveTagRepositoryImpl.java:44 + :221-327 — intent_anchor: "base-class choice at :44 vs explicit DSL.delete for every relation method" — confidence: HIGH
- "`onDuplicateKeyIgnore` uniformly on the three relation-create methods — relation assignment is idempotent by design." — evidence: ReactiveTagRepositoryImpl.java:265, 348, 371 — intent_anchor: "the three-fold repetition of .onDuplicateKeyIgnore()" — confidence: HIGH
- "`bulkCreate` (fail-on-duplicate, operator-explicit creation) vs `ingestData` (upsert, pipeline-tolerant) as a deliberate dual-method design." — evidence: ReactiveAbstractCRUDRepository.java:112-126 + ReactiveTagRepositoryImpl.java:183-219 + TagController.java:22-28 — intent_anchor: "two repository methods with opposite conflict semantics serving the two write audiences" — confidence: HIGH

## bugs_limitations_corner_cases

- "**[FIXED at 82812cdf — deployment-reality note]** The LSN-019 / PLT-026 popular-tags ordering bug (paginate-by-id-before-count → oldest `size` tags re-ranked) is fixed on this branch (GitHub #1773 Thread A / CTRIB-007) and ships at 0.28.0. EVERY released version through 0.27.x exhibits the old behaviour; operators on published releases experience what the live doc caveat describes. Guards: TagRepositoryImplTest.java:276-335 (RED on pre-fix main) + IT-005 (RED on ref:main). — evidence: ReactiveTagRepositoryImpl.java:147-162 + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32 — severity: LOW (as a current-tree finding; HIGH for ≤0.27.x deployments)"
- "TOCTOU between `listByNames` and `bulkCreate` in `TagServiceImpl.getOrCreateTagsByName` — a concurrent insert between the existence check (:145) and `bulkCreate` (:82) yields `UniqueConstraintException` → user-visible 500; no retry. SHARPENED this pass: the ingestion pipeline's dataset-FIELD tag arm uses this same racy path (`tagService.getOrCreateTagsByName`, ExternalTagIngestionRequestProcessor.java:104) inside the FINALIZING `@ReactiveTransactional` (:38) — a lost race fails the whole ingestion request, so two Collectors pushing the same novel field-tag concurrently can fail one pipeline run. The data-ENTITY tag arm is safe (getOrInjectTagByName :71 → ingestData upsert). — evidence: TagServiceImpl.java:80-86, 144-159 + ReactiveAbstractCRUDRepository.java:112-126 + ExceptionUtils.java:30-36, 54-56 + ExternalTagIngestionRequestProcessor.java:38, 71, 104 — severity: HIGH"
- "Case-sensitive `listByNames` mints silent near-duplicates (`PII` vs `pii` coexist; both render in the UI dropdown). Now DISCLOSED in the live docs ('Tag names are case-sensitive', WebFetch 2026-06-12) — disclosure reduces operator surprise; the data-integrity fork remains. — evidence: ReactiveTagRepositoryImpl.java:119-125 + TagServiceImpl.java:144-159 + V0_0_64:105 — severity: MEDIUM"
- "No tag-name validation at repository, service, or schema level (no length cap, charset filter, or CHECK constraint in the migration suite) — REFACTOR-223's DoS-shaped concern; reachable by any *_TAGS_UPDATE holder. — evidence: ReactiveTagRepositoryImpl.java:183-219 + V0_0_64 (no CHECK) — severity: MEDIUM"
- "`listMostPopular` is globally scoped — no owner/namespace filter; every authenticated caller of `GET /api/tags` enumerates the whole directory with usage counts. — evidence: ReactiveTagRepositoryImpl.java:137-171 + TagController.java:36-44 — severity: MEDIUM"
- "page/size boundaries unguarded end-to-end: PageParam/SizeParam declare no minimum (components.yaml:4219-4235); `page=0` / negative values reach PostgreSQL and surface SQL-state errors (A1/A2). Post-fix nuance: oversized `size` no longer amplifies aggregation cost (full-directory anyway) — it only inflates the returned payload. — evidence: ReactiveTagRepositoryImpl.java:138, 159-162 + JooqQueryHelper.java:80-81 + components.yaml:4219-4235 — severity: MEDIUM"
- "Soft-deleted-tag resurrection loses relations: `TagServiceImpl.delete` hard-deletes relations (:64-65) before the soft-delete (:66); re-creating the name yields a new id with zero relations. — evidence: TagServiceImpl.java:58-70 + ReactiveTagRepositoryImpl.java:238-245, 283-290 — severity: LOW"
- "Empty-batch guards are load-bearing (jOOQ rejects zero-record INSERTs); removing any guard produces a runtime SQL error on empty calls. — evidence: ReactiveTagRepositoryImpl.java:185-187 + ReactiveAbstractCRUDRepository.java:114-117 — severity: LOW"
- "`listTagsRelations(origin=null)` silently means ALL origins — implicit contract, no caller currently passes null. — evidence: ReactiveTagRepositoryImpl.java:112-114 — severity: LOW"
- "Hardcoded CTE/table aliases `tag_cte` (line 150) and `union_usages` (line 395) — composition of two such queries would collide; no current caller composes them. — evidence: ReactiveTagRepositoryImpl.java:150, 377-396 — severity: LOW"
- "'External' is computed THREE different ways: data-entity arm `boolOr(EXTERNAL)` (:382), dataset-field arm `boolOr(ORIGIN <> 'INTERNAL')` (:389 — EXTERNAL_STATISTICS counts as external), and `listDatasetFieldDtos` `boolOr(ORIGIN = 'EXTERNAL')` (:87 — EXTERNAL_STATISTICS does NOT count). The same tag can report `external=true` from `listMostPopular` and `external=false` from `listDatasetFieldDtos`. — evidence: ReactiveTagRepositoryImpl.java:87, 382, 389 — severity: LOW"
- "P-010 probe is fix-invariant in its pinned regime (equal counts → id-ASC ties reproduce the oldest-30 result on BOTH sides of the fix); it does not guard the fix and its own flip-prediction was wrong — retire or amend toward its proposed varying-count P-010-B variant. — evidence: lineage/odd-platform/probes/P-010.yaml:154-180, 235-269 + ReactiveTagRepositoryImpl.java:159-162 — severity: LOW (probe-lifecycle hygiene)"

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — no HTTP surface of its own; reached via TagService (REST: DISABLED/LOGIN_FORM/OAUTH2/LDAP perimeter) and the ingestion pipeline (`auth.s2s` + ingestion filter perimeter).
- **ingestion_filter_relevance**: `NO — repository internals, but DOWNSTREAM of the ingestion path`: writes arriving via ExternalTagIngestionRequestProcessor were already perimeter-gated; UI-path writes use the regular auth modes.
- **authorization_assertions**: `[]` — zero checks in this file (stress D1); the repository trusts callers. Endpoint-side gates are the TagController sidecar's subject.
- **owner_scoping**: `N/A — the tag directory has no owner concept` (no owner column, no per-Owner filter anywhere in lines 1-405); a flat global namespace by design.
- **data_exposure**:
  - "Full tag rows (`id,name,important,created_at,updated_at,deleted_at`) via `listByNames`/`listByTerm` to any caller reaching the upstream service."
  - "Aggregate usage counts + external flags via `getDto`/`listDataEntityDtos`/`listDatasetFieldDtos`/`listMostPopular` — global usage telemetry derivable by any authenticated user; post-fix the popular page is genuinely the most-used set (the pre-fix 'young popular tags hidden from page 1' distortion is gone)."
- **known_security_gaps**:
  - "No repository-side audit/activity emission on writes; the ingestion-side relation mutations (via ExternalTagIngestionRequestProcessor) produce NO activity-feed entry at any layer — the UI path's TAG_ASSIGNMENT_UPDATED event is emitted upstream of this class only. — evidence: ReactiveTagRepositoryImpl.java:1-405 (no activity hooks) + ExternalTagIngestionRequestProcessor.java:37-44 — severity: MEDIUM"
  - "No name normalization/length/charset guard on the auto-create surfaces (REFACTOR-223). — evidence: ReactiveTagRepositoryImpl.java:183-219 — severity: MEDIUM"
  - "Upsert correctness coupled to the hardcoded `WHERE TAG.DELETED_AT.isNull()` (line 211) matching the partial-index predicate — a future index-predicate migration silently breaks the conflict match. — evidence: ReactiveTagRepositoryImpl.java:211 + V0_0_64:105 — severity: LOW"

## performance

- **hot_paths**:
  - "**`listMostPopular` post-fix cost class: O(full filtered directory) per call** — the UNION-ALL aggregates (two LEFT JOIN + GROUP BY arms over `tag_to_data_entity` AND `tag_to_dataset_field`) now run across EVERY matching tag on EVERY call, independent of `size`; pre-fix the CTE truncation bounded this at O(size) (the correctness-for-cost trade stated at lines 147-149). The endpoint feeds the Catalog Overview 'Top tags' tile + the search Tag-facet seed — a first-page surface. No cache. Directory-scale latency is runtime-only → probe P-249. — evidence: ReactiveTagRepositoryImpl.java:147-162, 377-396"
  - "`ingestData` runs once per Collector batch carrying tags (FINALIZING phase). — evidence: ReactiveTagRepositoryImpl.java:183-219 + ExternalTagIngestionRequestProcessor.java:71"
  - "`listDataEntityDtos` triple-read on one data-entity request flow (render + policy + activity capture), no request-scoped cache. — evidence: DataEntityServiceImpl.java:622 + DataEntityPermissionExtractor.java:67 + TagActivityHandlerImpl.java:41"
- **throughput_characteristics**:
  - "Reactive non-blocking end-to-end; one DB round-trip per method call."
  - "`executeInPartitionReturning` partitions at BATCH_SIZE=1000 and chains partitions SEQUENTIALLY (Flux.concat) inside the caller's TX — a 5000-row upsert is 5 serial round-trips. — evidence: JooqReactiveOperations.java:24, 69-84"
  - "Relation creates build one multi-VALUES INSERT per call; statement size grows linearly with batch."
- **resource_allocation**:
  - "`listMostPopular` materialises one page via `.collectList()` (lines 164-165) — bounded by `size`; the heavy lifting (full-directory aggregate) happens in PostgreSQL, not the JVM."
  - "No client-side caching anywhere in the class."
- **scaling_characteristics**:
  - "Stateless bean; horizontal scaling unconstrained."
  - "No explicit locks; the unique index mediates write races (E1/E2)."
  - "`size` no longer modulates aggregate cost (post-fix); the cost driver is directory + relation cardinality."
- **known_performance_gaps**:
  - "Full-directory aggregation on a first-page UI surface with no cache and no materialised usage counter — at 10k+ tags / 100k+ relations the per-render cost is unmeasured. Probe P-249 (emitted this pass) owns the measurement; mitigation candidates if it misses budget: per-tag usage counter column, materialised view, or response cache. — evidence: ReactiveTagRepositoryImpl.java:150-162 + lineage/odd-platform/probes/P-249.yaml — severity: MEDIUM (pending measurement)"
  - "Triple `listDataEntityDtos` fetch per detail-page flow. — evidence: the three caller refs above — severity: LOW"
  - "No EXPLAIN-anchored benchmark in the Java test suite (the new tests assert correctness, not cost). — evidence: TagRepositoryImplTest.java:238-335 — severity: LOW"

## feature_hint

- pillar_id: P-01 (Data Discovery)
- sub_feature: Manual Object Tagging (F-018) — the Tag directory is the substrate of the tag facet, the Top-tags strip, and per-entity tag rendering.
- drift_class_facets:
  - "**RESOLVED (this branch): LSN-019 / PLT-026 popularity-ordering drift** — fixed at 82812cdf (#1773 Thread A / CTRIB-007), ships 0.28.0; guarded by TagRepositoryImplTest.java:276-335 + IT-005; live-doc caveat replacement rides the documentation release/0.28.0 train."
  - "REFACTOR-223 (tag side-door: *_TAGS_UPDATE mints global directory rows without TAG_CREATE) — substrate `ingestData` + inherited `bulkCreate`; now docs-disclosed live (2026-06-12) but unchanged in code."
  - "TOCTOU `listByNames`→`bulkCreate` — now known to reach the ingestion pipeline via the dataset-field arm (ExternalTagIngestionRequestProcessor.java:104)."
  - "Case-sensitivity divergence (exact-sensitive lookup vs insensitive search) — docs-disclosed live; data-fork behaviour unchanged."
  - "Audit-log absence on ingestion-side tag mutations — extends the 'Audit-log Presence Asymmetry' canonicalisation candidate."
- cross_pillar_relationships: P-01 → P-10 (directory grown by Collector pushes); P-01 → P-09 (TAG_* + *_TAGS_UPDATE gates live above the repository; no in-repository defence); P-01 → P-07 (UI-path tag mutations emit activity upstream; ingestion-path mutations emit none).

## sources

- understanding ← ReactiveTagRepositoryImpl.java:1-405 (full file read this session)
- concepts.entities ← ReactiveTagRepositoryImpl.java:17-41 + TagDto.java:5 + TagOrigin.java:3-7 + V0_0_64__remove_is_deleted_field.sql:99-108 + V0_0_47__add_tag_external_attribute.sql:1
- concepts.operations.listMostPopular ← ReactiveTagRepositoryImpl.java:137-171, 377-396 + JooqQueryHelper.java:62-89, 91-126, 138-154 + ReactiveAbstractCRUDRepository.java:229-234, 240-249, 294-299 + ReactiveAbstractSoftDeleteCRUDRepository.java:86-94
- concepts.operations.other ← ReactiveTagRepositoryImpl.java:54-375 (every method body)
- concepts.invariants ← ReactiveTagRepositoryImpl.java:103-105, 119-125, 137-171, 185-187, 203-214, 223-225, 249-251, 265, 272-274, 314-316, 331-333, 348, 355-357, 371 + V0_0_64:99-108 + JooqQueryHelper.java:72-88, 138-154 + ReactiveAbstractSoftDeleteCRUDRepository.java:25, 50-104
- concepts.audiences ← caller files enumerated in upstream_callers (grep `ReactiveTagRepository` across odd-platform-api/src/main/java — 8 files: the impl, the interface, and 6 consumers)
- stress_findings.A1 ← ReactiveTagRepositoryImpl.java:138, 162 + JooqQueryHelper.java:80-81 + odd-platform-specification/components.yaml:4219-4235
- stress_findings.A2 ← ReactiveTagRepositoryImpl.java:159-170 + JooqQueryHelper.java:80-81, 91-126
- stress_findings.A3 ← ReactiveTagRepositoryImpl.java:196 + JooqReactiveOperations.java:24, 69-84
- stress_findings.A4 ← ReactiveTagRepositoryImpl.java:119-125
- stress_findings.A5 ← ReactiveTagRepositoryImpl.java:141-143
- stress_findings.B1 ← ReactiveTagRepositoryImpl.java:137-171 (comment :147-149), 377-396 + JooqQueryHelper.java:62-89 + odd-platform-specification/openapi.yaml:342-346 + TagRepositoryImplTest.java:270-335 + integration-tests/protocols/IT-005-top-tags-ordering.md:1-40 + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32
- stress_findings.B2 ← ReactiveTagRepositoryImpl.java:119-125 + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104
- stress_findings.B3 ← ReactiveTagRepositoryImpl.java:54-66 + ReactiveAbstractSoftDeleteCRUDRepository.java:76-79
- stress_findings.B4 ← ReactiveTagRepositoryImpl.java:183-219
- stress_findings.B5 ← ReactiveTagRepositoryImpl.java:221-245
- stress_findings.B6 ← ReactiveTagRepositoryImpl.java:140 + ReactiveAbstractCRUDRepository.java:240-249 + ReactiveAbstractSoftDeleteCRUDRepository.java:86-94
- stress_findings.C1 ← ReactiveTagRepositoryImpl.java:159-162 + JooqQueryHelper.java:73, 79, 88
- stress_findings.C2 ← JooqQueryHelper.java:62-89, 138-161 + JooqQueryHelperTest.java:17-44
- stress_findings.C3 ← ReactiveTagRepositoryImpl.java:377-396
- stress_findings.C4/C5/C6 ← ReactiveTagRepositoryImpl.java:68-98, 100-117, 119-125, 173-181
- stress_findings.C7 ← ReactiveTagRepositoryImpl.java:164-170 + JooqQueryHelper.java:72-73, 86, 91-126 + ReactiveAbstractCRUDRepository.java:229-234 + TagRepositoryImplTest.java:327-328
- stress_findings.D1 ← ReactiveTagRepositoryImpl.java:1-405 (no auth constructs) + TagController.java:36-44 + odd-platform-specification/openapi.yaml:342-346
- stress_findings.E1 ← ReactiveTagRepositoryImpl.java:203-214 + V0_0_64:103-105
- stress_findings.E2 ← ReactiveAbstractCRUDRepository.java:112-126 + ExceptionUtils.java:30-36, 54-56 + TagServiceImpl.java:80-86, 144-159 + ExternalTagIngestionRequestProcessor.java:38, 104
- stress_findings.E3 ← TagServiceImpl.java:45, 58, 97, 137 + ExternalTagIngestionRequestProcessor.java:38 + ReactiveAbstractCRUDRepository.java:112-114, 128-130
- stress_findings.E4 ← ReactiveTagRepositoryImpl.java:75, 92, 122, 140 + ReactiveAbstractSoftDeleteCRUDRepository.java:96-104
- stress_findings.E5 ← ReactiveTagRepositoryImpl.java:265, 348, 371
- stress_findings.F1-F6 ← ReactiveTagRepositoryImpl.java:101-102, 112-114, 119-125, 137-143, 159-162, 184, 195-218
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-249.yaml (written this session) + lineage/odd-platform/probes/P-010.yaml:154-180, 235-269
- upstream_callers ← TagController.java:36-44 + TagServiceImpl.java:40-145 + ExternalTagIngestionRequestProcessor.java:34, 38, 71, 75-76, 85, 88, 104, 108, 115, 117 + DatasetFieldServiceImpl.java:75, 124-129, 217-227, 354-360 + DataEntityServiceImpl.java:127, 622 + DataEntityPermissionExtractor.java:28, 67 + TagActivityHandlerImpl.java:17-18, 41 + service/term/TermServiceImpl.java:257 + integration-tests/protocols/IT-005-top-tags-ordering.md:16-40
- downstream_side_effects ← ReactiveTagRepositoryImpl.java:183-375 + JooqReactiveOperations.java:41, 48 + ExceptionUtils.java:30-36, 54-56 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74
- dependencies_semantic ← ReactiveTagRepositoryImpl.java:38-52, 189, 196, 203-211 + JooqQueryHelper.java:62-154 + JooqReactiveOperations.java:24, 69-84 + ReactiveAbstractCRUDRepository.java:229-234 + ReactiveAbstractSoftDeleteCRUDRepository.java:25
- tests_coverage_semantic ← TagRepositoryImplTest.java:21-335 (test-method anchors via @DisplayName grep) + JooqQueryHelperTest.java:1-45 + integration-tests/protocols/IT-005-top-tags-ordering.md:1-60 + grep `ingestData` in TagRepositoryImplTest.java (zero matches; search root odd-platform-api/src/test/java)
- docs_link_semantic ← WebFetch 2026-06-12: features/data-discovery/tagging (200), data-discovery/tagging (404), enable-security/authorization/permissions (200) + odd-platform-specification/openapi.yaml:342-346 + grep `release/0.28` in the local documentation clone's packed-refs (zero matches)
- implicit_adrs ← ReactiveTagRepositoryImpl.java:44, 147-162, 203-214, 221-327, 265, 348, 371 + JooqQueryHelper.java:138-154 + JooqQueryHelperTest.java:21-44 + V0_0_36/V0_0_57/V0_0_64 + ReactiveAbstractCRUDRepository.java:88-100, 112-126 + TagController.java:22-28 + TagServiceImpl.java:88-94
- bugs_limitations_corner_cases ← per-entry evidence inline above
- security ← ReactiveTagRepositoryImpl.java:1-405 + ExternalTagIngestionRequestProcessor.java:37-44 + TagController.java:36-44
- performance ← ReactiveTagRepositoryImpl.java:147-162, 164-165, 183-219, 377-396 + JooqReactiveOperations.java:24, 69-84 + the three listDataEntityDtos caller refs + lineage/odd-platform/probes/P-249.yaml
- feature_hint ← system-mission P-01 mapping carried from the superseded enrichment + the evidence chains above

## confidence_per_field

- understanding: HIGH (full file + parent classes + helper + tests read at the working tree; fix chain traced end-to-end)
- concepts: HIGH (every invariant re-anchored to current line numbers; superseded paginate-inside-CTE invariant replaced)
- dependencies_semantic: HIGH (helper contract change verified in code + unit tests)
- tests_coverage_semantic: HIGH (test files read; covered/uncovered re-derived; absence claims carry named grep roots per Rule 7.5)
- docs_link_semantic: HIGH (three live fetches this session incl. one recorded 404; release-train pointer itself LOW — branch ref not locally verifiable, noted inline)
- implicit_adrs: HIGH (all eight entries carry in-code intent anchors; the two new entries quote their comments verbatim)
- bugs_limitations_corner_cases: HIGH (twelve entries re-verified at current lines; the fixed headline reframed as deployment-reality)
- security: HIGH (zero-auth posture re-verified; endpoint path corrected to GET /api/tags)
- performance: MEDIUM (cost-class change is statically certain; the directory-scale latency number is PROBE-NEEDED → P-249)
- upstream_callers: HIGH (all service-layer sites re-greped at current lines; UI consumer remains an unresolved REFERENCE)
- downstream_side_effects: HIGH
- stress_findings: HIGH (31/34 questions STATIC-INFERRED with current-line evidence; 1 PROBE-NEEDED; 2 REFERENCE; 0 active drift flags)
- feature_hint: HIGH

## Maintainer notes

(empty — preserved from prior schema position; no maintainer body was present in the v0.3.0 sidecar at this heading)

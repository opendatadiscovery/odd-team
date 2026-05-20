---
node_id: "odd-platform java repository reactive repository:ReactiveDataEntityRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-H-ReactiveDataEntityRepositoryImpl
---

# ReactiveDataEntityRepositoryImpl — semantic understanding

## understanding

`ReactiveDataEntityRepositoryImpl` is the **centerpiece data-entity persistence layer** of the platform — 982 lines, 35+ public methods, all the read- and write-shapes through which `data_entity` rows transit. It extends `ReactiveAbstractSoftDeleteCRUDRepository<DataEntityRecord, DataEntityPojo>` but overrides `getDeleteChangedFields` and `addSoftDeleteFilter` to swap the inherited `deleted_at IS NULL` semantics for ODD's status-machine: a "deletion" is `STATUS = DELETED.getId()` plus `STATUS_UPDATED_AT = now()` plus `STATUS_SWITCH_TIME = null` (lines 109-123). Read paths fan out into a single CTE-builder helper `cteDataEntitySelect` (lines 909-939) that nine list-shaped public methods compose, layering custom `where` conditions, sort orders, optional FTS and limit/offset on top. Write paths are narrow and direct: `incrementViewCount` (read-as-write — lines 173-180), `setInternalName` / `setInternalDescription` (lines 419-438 — both store user input verbatim with empty-to-null normalisation), `updateDEG` (line 138-147), `createHollow` (line 414-416 — bulk insert via parent class `insertMany`). All write methods are method-only; the `@ReactiveTransactional` boundary lives one layer up in service callers (`DataEntityServiceImpl`, `DataEntityInternalStateServiceImpl`), wrapping the repository call together with downstream FTS-vector refresh + activity-emission + filled-flag toggle. The class has **NO transactional annotation**, NO multi-tenant scope filter at JOIN time (no namespace/owner predicate baked into the CTE), NO advisory-lock interaction, NO caller-identity check. Authorization is enforced upstream at the controller layer via `SECURITY_RULES` resource-permission resolution. Three known incidents trace to specific lines here: **F-001 view_count inflation** (line 176: `DATA_ENTITY.VIEW_COUNT.plus(1)`), **F-003 popular-ranking gap** (line 633: `DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC)` is the SOLE order signal AND lines 909-939 omit `EXCLUDE_FROM_SEARCH` — both confirmed from primary source), and **F-004 verbatim-description storage** (line 432-435: `DSL.update(DATA_ENTITY).set(DATA_ENTITY.INTERNAL_DESCRIPTION, …)` — no Jsoup.clean, no Encode.html, no length cap, raw user input persists).

## concepts

- entities: [
    "`DataEntityPojo` (the jOOQ-generated POJO mapping `data_entity` table rows — every read method's terminal map step lands here)",
    "`DataEntityDimensionsDto` / `DataEntityDetailsDto` (the enriched DTOs assembled by `DataEntityDtoMapper::mapDimensionRecord` / `::mapDetailsRecord` from the CTE result)",
    "`DataEntityDto` (a lighter wrapper used by `listPopular` / `listByOwner` / `getQuerySuggestions` via `mapDtoRecordFromCTE`)",
    "`DataEntityCTEQueryConfig` (the @Builder record-style config — `conditions`, `limitOffset`, `orderBy`, `fts`, `includeDeleted` — composed by every CTE-based list method; `DataEntityCTEQueryConfig.java:14-40`)",
    "`DataEntityStatusDto.DELETED` (`STATUS = DELETED.getId()` is ODD's soft-delete state — replaces the inherited `deleted_at IS NULL` predicate; lines 109-123)",
    "`DATA_ENTITY.HOLLOW` (boolean flag distinguishing real ingested entities from ingestion-placeholder shells; unconditionally excluded inside `cteDataEntitySelect` line 918 and `getDataEntityDefaultConditions` line 972)",
    "`DATA_ENTITY.EXCLUDE_FROM_SEARCH` (boolean flag for entities that should be hidden from search/facets/statistics; applied in `countByState` line 448 + `getDataEntityDefaultConditions` line 974 — **NOT applied inside `cteDataEntitySelect`** at lines 909-939)",
    "`DATA_ENTITY.VIEW_COUNT` (bigint counter — incremented exclusively by `incrementViewCount` line 176; ranked by `listPopular` line 633; not surfaced in any other method's WHERE / ORDER BY)",
    "`SEARCH_ENTRYPOINT` (the FTS-vector denorm — `cteDataEntitySelect` joins it ONLY when an `Fts` config is set; line 924-925)"
  ]
- operations: [
    "`bulk-read-by-id-or-oddrn` — `get(long)` / `get(List<Long>)` / `listByOddrns` (no enrichment, raw `DSL.selectFrom(DATA_ENTITY)`)",
    "`single-entity-detail` — `getDimensions(id)` / `getDetails(id)` / `getDataEntitySearchFields(id)` — CTE-assembled with aggregated JSON arrays for owners/titles/ownership/tags/metadata",
    "`list-by-relation` — `listByOwner` / `listByTerm` / `listByDatasourceAndType` / `getDEGEntities` / `getDEGExperimentRuns` / `getParentDEGs`",
    "`list-by-state` — `findByState` (the search/facet result list — applies `EXCLUDE_FROM_SEARCH` via `JooqFTSHelper.resultFacetStateConditions` only)",
    "`list-by-rank` — `listPopular(view_count DESC)` / `getQuerySuggestions(ts_rank DESC, limit 5)`",
    "`existence-checks` — `existsIncludingSoftDeleted` / `existsNonDeletedByDataSourceId` / `existsNonDeletedByNamespaceId`",
    "`aggregations` — `countByState` / `countByDatasourceAndType` / `getCountByDataSources` / `getExperimentRunsCount` / `getDataEntityDomainsInfo` / `getDataSourceEntityTypeIds`",
    "`scheduled-batch-read` — `getPojosForStatusSwitch` (rows whose `STATUS_SWITCH_TIME` has elapsed; consumed by `DataEntityStatusSwitchJob`)",
    "`writes` — `incrementViewCount` (+1 to `view_count`), `updateDEG` (type/namespace/internal_name), `setInternalName` / `setInternalDescription` (verbatim, empty→null), `createHollow` (bulk insert via parent `insertMany`)",
    "`unsafe-raw-SQL-fts-highlight` — `getHighlightedResult` (lines 799-806; `String.formatted(text, tsQuery)` interpolates parameters into raw SQL — see security gap)"
  ]
- invariants: [
    "**Soft-delete semantics differ from the inherited abstract class.** Parent uses `deleted_at IS NULL`; this class overrides to `STATUS != DELETED.getId()` (line 121) AND `STATUS_UPDATED_AT = now() + STATUS_SWITCH_TIME = null` on delete (lines 110-115). The base `deletedAtField` is passed as `null` in the constructor (line 103) so the inherited helpers all defer to this override.",
    "**Hollow entities are unconditionally excluded from CTE-based lists** (`cteDataEntitySelect` line 918: `DATA_ENTITY.HOLLOW.isFalse()` — no flag to opt in). Only `listByOddrns(... includeHollow=true)` (lines 243-245) and the raw `get()` paths can return hollow rows.",
    "**`EXCLUDE_FROM_SEARCH` is INCONSISTENTLY APPLIED.** It IS applied in `countByState` (line 448), `getDataEntityDefaultConditions` helper (line 974 — used by `listByDatasourceAndType` count via line 617, `countByDatasourceAndType`, `getDataSourceEntityTypeIds`, `getCountByDataSources`, `getDataEntityDomainsInfo`, `getDataEntityWithOwnership`), AND via `JooqFTSHelper.resultFacetStateConditions` line 149 (consumed by `findByState`). It is NOT applied in `cteDataEntitySelect` (lines 909-939) — affecting `listPopular`, `listByOwner`, `listByTerm`, `getDEGExperimentRuns`, `getDimensions(id|oddrns|ids)`, `getDetails(id)`, `getQuerySuggestions`. The `getDataEntityWithDataSourceAndNamespace` paths (lines 264-286) apply only `addSoftDeleteFilter`, not `EXCLUDE_FROM_SEARCH`.",
    "**Reads are NOT transactional at the repository layer.** No `@Transactional` / `@ReactiveTransactional` on this class. The transaction boundary lives in callers — e.g. `DataEntityServiceImpl.getDetails` (line 196-209) carries `@ReactiveTransactional` wrapping the repository read + the `incrementViewCount` side-effect.",
    "**Writes do NOT verify entity existence.** `setInternalName` / `setInternalDescription` / `incrementViewCount` / `updateDEG` are bare `DSL.update(...).where(ID.eq(id)).returning()` — if `id` does not exist they update 0 rows and the returned `Mono` completes empty. No `NotFoundException` is thrown at this layer; callers must `.switchIfEmpty(error)` (e.g. `DataEntityServiceImpl.getDetails:200` does, but `DataEntityServiceImpl.upsertDescription:325-333` does NOT — see neighbour sidecar `upsertDataEntityInternalDescription.md`).",
    "**Multi-tenancy / owner-scoping is NOT enforced at JOIN time.** No method on this repository takes a current-user / owner predicate. Owner-scoped lists (`listByOwner(ownerId, ...)`) require the CALLER to pass the owner id explicitly. The class assumes upstream authorization has already vetted who can read what.",
    "**`getHighlightedResult` interpolates user input into raw SQL via `String.formatted(...)`** (lines 801-802). The `text` parameter is the server-assembled `searchableString` (which itself includes user-controlled fields like `internal_name`, `internal_description`, tags from `DataEntityHighlightConverter.convert`); the `query` parameter is the raw user search string passed through `tsQuery` which only splits on space and appends `:*`, not escaping single-quote or other SQL metacharacters. See `bugs_limitations_corner_cases.[0]`.",
    "**View_count is a read-as-write side effect.** `incrementViewCount` (lines 173-180) is invoked by `DataEntityServiceImpl.getDetails` (line 207) on every successful read; the F-001 chain probe P-001 / P-004 confirms +1 per call empirically (see `getDataEntityDetails.md`)."
  ]
- audiences: [
    "`DataEntityServiceImpl` (the dominant caller — orchestrates `@ReactiveTransactional` boundary around most write paths and the read+increment-view-count path)",
    "`DataEntityInternalStateServiceImpl` (caller of `setInternalDescription` and the status-mutation helpers — also `@ReactiveTransactional`)",
    "`DataEntityHighlightServiceImpl` (caller of `getHighlightedResult` and `getDataEntitySearchFields` — the search-highlight surface)",
    "`HollowDataEntityIngestionRequestProcessor` (caller of `createHollow` — the ingestion-placeholder write path)",
    "`DataEntityStatusSwitchJob` (caller of `getPojosForStatusSwitch` — the scheduled job that promotes scheduled-status rows)",
    "`SearchServiceImpl` (caller of `findByState` / `countByState` / `getQuerySuggestions` — the catalog-search surface)",
    "operators-via-API — indirectly, via every controller surface that delegates here (DataEntityController, SearchController, AlertController, OwnershipController, TermController, etc.)"
  ]

## dependencies_semantic

- requires-feature: [
    "`JooqReactiveOperations` — the reactive jOOQ wrapper that lifts every query into `Mono<Record>` / `Flux<Record>` on the R2DBC pool",
    "`JooqQueryHelper` — used for `selectExists` and `getField(cte, column)` helpers when projecting through CTE-aliased tables",
    "`JooqFTSHelper` — the FTS-shape helper. `ftsCondition` builds `vector @@ to_tsquery(?)`; `ftsRankField` builds `ts_rank(vector, to_tsquery(?))`; `tsQuery` transforms user input into `word:* & word:*` (prefix-match per token, space-separated). `resultFacetStateConditions` returns the CTE+JOIN condition pair for facet search.",
    "`JooqRecordHelper` — `extractAggRelation(record, alias, class)` for JSON-array agg unwrapping",
    "`DataEntityDtoMapper` — `mapDimensionRecord` / `mapDetailsRecord` / `mapDtoRecordFromCTE` / `mapDataEntitySearchFieldsRecord` / `extractOwnershipRelation` — the record→DTO mapping bound to every list-shape return",
    "`DataEntityCTEQueryConfig` — the builder pattern that parameterises `cteDataEntitySelect`",
    "`FTSConstants.DATA_ENTITY_CONDITIONS` — the facet-type → condition function map used by `countByState`",
    "`DateTimeUtil.generateNow()` — used for `STATUS_UPDATED_AT` write and `STATUS_SWITCH_TIME` boundary on `getPojosForStatusSwitch`"
  ]
- requires-config: [] — N/A. The class reads no config keys; no `@Value`, no `@ConditionalOnProperty`. Behaviour is fixed at compile time.
- requires-runtime: [
    "Spring WebFlux + reactor (`Mono` / `Flux` signatures throughout)",
    "jOOQ + R2DBC reactive Postgres bindings (every query is `jooqReactiveOperations.mono(query)` / `.flux(query)`)",
    "PostgreSQL — `data_entity` table with columns `id`, `oddrn`, `internal_name`, `external_name`, `internal_description`, `external_description`, `type_id`, `namespace_id`, `data_source_id`, `entity_class_ids` (int[]), `status`, `status_updated_at`, `status_switch_time`, `view_count` (bigint NOT NULL DEFAULT 0), `hollow`, `exclude_from_search`, `manually_created`, `platform_created_at`. Plus the tsvector on `search_entrypoint` and `tsvector_agg` custom aggregate (`V0_0_14__normalize_fts_process.sql`)."
  ]
- coupling: [
    "**Parent class `ReactiveAbstractSoftDeleteCRUDRepository`** — provides `delete(id)` / `delete(ids)` / `idCondition` / `listCondition` / `getNonUpdatableFields` based on `deletedAtField`, but this subclass passes `null` for `deletedAtField` (line 103) and OVERRIDES `getDeleteChangedFields` + `addSoftDeleteFilter` to use the STATUS column instead. The parent's helpers that touch `deletedAtField` would NPE if called against this subclass — they are not, because every relevant path goes through the overrides.",
    "**`DataEntityServiceImpl`** — the dominant caller. Wraps repository writes in `@ReactiveTransactional`; orchestrates the side-effect chains (FTS vector refresh + filled-flag toggle + activity emission). See callers enumerated in `upstream_callers` below.",
    "**`SECURITY_RULES` resource permissions** — the repository's lack of caller-identity awareness is INTENTIONAL. The controller layer enforces `SecurityRule(DATA_ENTITY, '/api/dataentities/...', VERB, PERMISSION)` and rejects unauthorized callers before they reach the service / repository. A controller with no SECURITY_RULES entry (e.g. `getPopular` per `getPopular.md`) reaches this repository with no resource-permission check.",
    "**FTS vector refresh** — every write that affects searchable content (description, name) requires the caller to invoke `reactiveSearchEntrypointRepository.updateDataEntityVectors(id)` to refresh the tsvector. This repository does NOT auto-refresh; the contract is delegated to callers. A future write method that forgets this step would silently desynchronise the search index."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. There is NO `*RepositoryTest` for `ReactiveDataEntityRepositoryImpl` at any test layer.
- uncovered_behaviours: [
    "{behaviour: 'soft-delete via `addSoftDeleteFilter` correctly maps to STATUS != DELETED (not deleted_at IS NULL)', test_class: 'unit'} — no test verifies the override against the inherited semantics",
    "{behaviour: 'incrementViewCount issues +1 per call inside the @ReactiveTransactional boundary; rolls back on downstream enrichment failure', test_class: 'integration'} — F-001 chain unverified by JVM tests (only by live HTTP probe P-001 / P-004)",
    "{behaviour: 'listPopular ranking is exclusively view_count DESC, id DESC (no time decay, no per-entity weighting)', test_class: 'unit'} — F-003 ranking signal unverified",
    "{behaviour: 'listPopular includes entities with `exclude_from_search=true` (the CURRENT inconsistent behaviour vs other list paths)', test_class: 'unit'} — REFACTOR-222 regression catcher absent",
    "{behaviour: 'setInternalDescription empty-string normalises to NULL', test_class: 'unit'} — F-004 normalisation step unverified",
    "{behaviour: 'setInternalDescription stores Markdown / HTML verbatim — no backend sanitisation', test_class: 'unit'} — F-004 verbatim-store fingerprint unverified at this layer; P-009 probes it at the rendered-DOM layer",
    "{behaviour: 'setInternalDescription / setInternalName / incrementViewCount return Mono.empty when id does not exist (no NotFoundException at repo layer)', test_class: 'unit'} — the silent-no-op-vs-404 contract unverified",
    "{behaviour: 'getHighlightedResult rejects SQL-injection payloads in `text` and `query`', test_class: 'security'} — see `known_security_gaps[0]`; no test asserts current behaviour (today: payloads pass through `.formatted()` unescaped)",
    "{behaviour: 'cteDataEntitySelect applies addSoftDeleteFilter when includeDeleted=false, skips it when includeDeleted=true', test_class: 'unit'} — the soft-delete branch unverified",
    "{behaviour: 'cteDataEntitySelect always applies HOLLOW.isFalse() regardless of includeDeleted', test_class: 'unit'} — the hollow-exclusion invariant unverified",
    "{behaviour: 'findByState applies EXCLUDE_FROM_SEARCH via resultFacetStateConditions; getDEGExperimentRuns / listByOwner / listByTerm / listPopular do NOT', test_class: 'unit'} — the catalog-wide visibility inconsistency unverified",
    "{behaviour: 'createHollow bulk-insert sets HOLLOW=true and EXCLUDE_FROM_SEARCH=true on every row (buildHollowRecord line 862-864)', test_class: 'unit'} — the ingestion-placeholder defaults unverified",
    "{behaviour: 'listByOddrns with empty oddrns returns Flux.empty() not a full table scan (line 233-234)', test_class: 'unit'} — defensive short-circuit unverified",
    "{behaviour: 'getDimensions(id) includes soft-deleted entities (includeDeleted=true at line 186)', test_class: 'unit'} — the lifecycle-recovery surface unverified",
    "{behaviour: 'listPopular pagination math (page-1)*size handles page=0 correctly (Postgres rejects negative offset)', test_class: 'unit'} — see `getPopular.md`",
    "{behaviour: 'updateDEG only updates type_id / namespace_id / internal_name (not other DataEntityPojo fields)', test_class: 'unit'} — the selective-update invariant unverified",
    "{behaviour: 'getDataEntitySearchFields LEFT JOIN fan-out does not duplicate-row on owner/title/tag/metadata combinations', test_class: 'integration'} — JOIN cardinality unverified"
  ]
- test_files: [] — verified by `grep -rln 'ReactiveDataEntityRepositoryImpl' <odd-platform-repo>/odd-platform-api/src/test` returning 0 matches; no `DataEntityRepositoryTest.java` exists per `find <odd-platform-repo>/odd-platform-api/src/test -name '*DataEntityRepository*'` returning 0 matches.
- gaps: |
    The repository at the centre of the platform's data-entity persistence has **ZERO direct test coverage** — no `@DataJpaTest` / `@JooqTest` / `@SpringBootTest` integration test, no unit test of a single helper (`cteDataEntitySelect`, `getOrderFields`, `buildHollowRecord`, `hasAlerts`, `getDataEntityDefaultConditions`). The behavioural surface is verified only indirectly: (a) by the few API-layer tests that issue HTTP calls and inspect the JSON response (`DataEntityStatusChangeTest`, `DatasetVersionDiffTest`, `DataEntityStatisticsTest`); (b) by live HTTP probes against the running platform (P-001 / P-004 for F-001, P-009 for F-004) which catch externally-visible regressions but not the internal invariants. The most consequential regressions to catch are:

    1. **`EXCLUDE_FROM_SEARCH` inconsistency drift.** A future maintainer adding the predicate to `cteDataEntitySelect` would unify behaviour but silently change `listPopular` / `listByOwner` / `listByTerm` semantics — without a regression-catcher test asserting the current INCLUSIVE behaviour (or the future EXCLUSIVE behaviour) this is invisible.
    2. **Soft-delete override drift.** A maintainer working in the parent class (adding fields, changing semantics) without recognising this subclass's overrides could either (a) propagate `deleted_at` semantics that this class doesn't honour, or (b) break the STATUS-column override by removing a parent-class hook. The override at line 109-123 is invisible from the parent's vantage; a unit test against `addSoftDeleteFilter` would surface the contract.
    3. **`getHighlightedResult` SQL-injection vector.** No test currently exists; a future maintainer "improving" the highlight feature without recognising the raw-format SQL would not catch a regression that broadens the surface (or, conversely, a fix that adds parameterisation would be unverifiable).
    4. **CTE pagination math.** `(page-1)*size` for `page=0` produces a negative offset — Postgres rejects this; the endpoint returns 500. The pagination contract is encoded across line 250, 390, 530, 589, 606, 632, 722; a unit test fixture asserting `page=0` → `BadUserRequestException` (the documented contract elsewhere) would catch a regression here AND in every other paginated list. Today: silent 500.
    5. **JOIN cardinality on the dimensions-with-everything queries.** `getDataEntitySearchFields` LEFT JOINs against `OWNERSHIP`, `OWNER`, `TITLE`, `TAG_TO_DATA_ENTITY`, `TAG`, `METADATA_FIELD_VALUE`, `METADATA_FIELD` — six left-joins on a single root row. The aggregation `jsonArrayAgg(...)` over a fan-out produces N×M duplicates on combinations; without an integration test asserting deduplication via `groupBy` semantics, the response payload can silently swell.

    A `@JooqTest` suite that bootstraps Postgres + Liquibase + seeds 10 data entities (mix of statuses, hollow, exclude_from_search, view_count distribution) and exercises (i) every list method's filtering correctness, (ii) every write's empty-id behaviour, (iii) view_count increment idempotence vs concurrent writes, (iv) FTS query SQL-injection rejection, (v) CTE pagination edge cases would close the structural gap.

## upstream_callers

(Per Rule 6 — the methods of this repository fan into N controllers + N services. List the dominant upstream features, the entrypoint method, and the contributing feature ids where applicable.)

- caller_node: "odd-platform java DataEntityController controller-method:getDataEntityDetails"
  caller_path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:139-147"
  via_service: "DataEntityServiceImpl.getDetails (@ReactiveTransactional) → reactiveDataEntityRepository.getDetails(id) [line 217] + .incrementViewCount(id) [line 174]"
  feature_id: F-001
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md"
- caller_node: "odd-platform java DataEntityController controller-method:getPopular"
  caller_path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:307-313"
  via_service: "DataEntityServiceImpl.listPopular → reactiveDataEntityRepository.listPopular(page, size) [line 630]"
  feature_id: F-003
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md"
- caller_node: "odd-platform java DataEntityController controller-method:upsertDataEntityInternalDescription"
  caller_path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:202-211"
  via_service: "DataEntityServiceImpl.upsertDescription (@ReactiveTransactional) → DataEntityInternalStateServiceImpl.updateDescription (@ReactiveTransactional + @ActivityLog(DESCRIPTION_UPDATED)) → reactiveDataEntityRepository.setInternalDescription(id, description) [line 430]"
  feature_id: F-004
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__upsertDataEntityInternalDescription.md"
- caller_node: "odd-platform java DataEntityController controller-method:getMyObjects"
  via_service: "DataEntityServiceImpl.listAssociated → reactiveDataEntityRepository.listByOwner(ownerId, page, size) [line 516]"
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getMyObjects.md"
- caller_node: "odd-platform java DataEntityController controller-method:createOwnership / updateStatus / addDataEntityTerm / createDataEntityTagsRelations"
  via_service: "DataEntityServiceImpl.{addDataEntityToDEG, updateStatus, ...} → reactiveDataEntityRepository.get(id) [line 126] (existence check before mutation)"
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__{createOwnership,updateStatus,addDataEntityTerm,createDataEntityTagsRelations}.md"
- caller_node: "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
  via_service: "LineageServiceImpl + reactiveDataEntityRepository.listByOddrns / getDataEntitiesWithDataSourceAndNamespace"
  sidecar: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md"
- caller_node: "odd-platform java SearchController controller-method:* (search-result list)"
  via_service: "SearchServiceImpl.findByState → reactiveDataEntityRepository.findByState(state, page, size, owner) [line 652] + .countByState(state, owner) [line 441]"
- caller_node: "odd-platform java DataEntityHighlightServiceImpl (caller of getHighlightedResult)"
  caller_path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/search/DataEntityHighlightServiceImpl.java:44"
  via_service: "DataEntityHighlightServiceImpl.getHighlightedResult → reactiveDataEntityRepository.getHighlightedResult(searchableString, queryString) [line 799]"
- caller_node: "odd-platform java HollowDataEntityIngestionRequestProcessor"
  caller_path: "odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/processor/HollowDataEntityIngestionRequestProcessor.java:25"
  via_service: "reactiveDataEntityRepository.createHollow(extractHollowCandidates(request)) [line 414]"
- caller_node: "odd-platform java DataEntityStatusSwitchJob"
  via_service: "DataEntityStatusSwitchJob → reactiveDataEntityRepository.getPojosForStatusSwitch() [line 256] (scheduled batch read)"
- caller_node: "odd-platform java DataEntityGroupServiceImpl (DEG updates)"
  via_service: "DataEntityGroupServiceImpl.updateDEG → reactiveDataEntityRepository.updateDEG(pojo) [line 138]"

## downstream_side_effects

(Per Rule 6 — every write path's side-effect surface. F-flow targets called out by id.)

- side_effect: "UPDATE data_entity SET view_count = view_count + 1 WHERE id = ?"
  location: "ReactiveDataEntityRepositoryImpl.java:173-180 (incrementViewCount)"
  feature_id: F-001
  txn_scope: "wrapped by DataEntityServiceImpl.getDetails @ReactiveTransactional (DataEntityServiceImpl.java:197) — read + UPDATE share one transaction; rollback on enrichment failure releases the increment"
  empirically_proven: "P-001 (initial detection) + P-004 (refined). The +1-per-call contract is the F-001 fingerprint."
  notes: "This is the inflation-attack surface: no rate limit on the upstream GET, no authz gate on the popular ranking that consumes the resulting counter. See F-003 below."

- side_effect: "ORDER BY DATA_ENTITY.VIEW_COUNT DESC (sole ranking signal in popular list)"
  location: "ReactiveDataEntityRepositoryImpl.java:633 (listPopular cteConfig.orderBy)"
  feature_id: F-003
  txn_scope: "no transaction (single SELECT)"
  notes: "Confirmed from primary source: the CTE config sets exactly ONE orderBy field (`DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC)`) with NO time-decay, NO per-class weight, NO per-owner filter. The outer `getOrderFields(cteConfig, deCte)` (lines 945-968) appends a `DATA_ENTITY.ID.desc()` tiebreaker — but the primary signal is view_count alone. REFACTOR-222 (EXCLUDE_FROM_SEARCH not applied) IS confirmed from primary source: `cteDataEntitySelect` at lines 909-939 contains NO `DATA_ENTITY.EXCLUDE_FROM_SEARCH` predicate, only `DATA_ENTITY.HOLLOW.isFalse()` (line 918) and the soft-delete branch (lines 913-917)."

- side_effect: "UPDATE data_entity SET internal_description = ? WHERE id = ? (verbatim, no sanitisation)"
  location: "ReactiveDataEntityRepositoryImpl.java:430-438 (setInternalDescription)"
  feature_id: F-004
  txn_scope: "wrapped by DataEntityServiceImpl.upsertDescription @ReactiveTransactional (line 324) → DataEntityInternalStateServiceImpl.updateDescription @ReactiveTransactional (inner, line 55) + @ActivityLog(DESCRIPTION_UPDATED) — description write + FTS-vector refresh + filled-flag toggle + term-relation update + 2 activity-events share one transaction"
  exact_sql_shape: "DSL.update(DATA_ENTITY).set(DATA_ENTITY.INTERNAL_DESCRIPTION, newDescription).where(DATA_ENTITY.ID.eq(dataEntityId)).returning() — line 432-435. `newDescription = StringUtils.isEmpty(description) ? null : description;` is the SOLE transformation (line 431). NO Jsoup.clean, NO Encode.html, NO length cap, NO allowlist."
  empirically_proven: "P-009 (XSS render probe) — runs against the upstream GET that re-reads this column. The verbatim-store fingerprint is the F-004 signature."

- side_effect: "UPDATE data_entity SET internal_name = ? WHERE id = ?"
  location: "ReactiveDataEntityRepositoryImpl.java:419-427 (setInternalName)"
  txn_scope: "wrapped by DataEntityServiceImpl.upsertBusinessName @ReactiveTransactional + @ActivityLog(BUSINESS_NAME_UPDATED) at line 337"
  notes: "Sibling of setInternalDescription; same empty→null normalisation, same no-sanitisation pattern. internal_name is FTS-weight A (vs description's B per FTSConstants.java:38-40)."

- side_effect: "UPDATE data_entity SET type_id=?, namespace_id=?, internal_name=? WHERE id=?"
  location: "ReactiveDataEntityRepositoryImpl.java:138-147 (updateDEG)"
  txn_scope: "wrapped by DataEntityGroupServiceImpl.updateDEG @ReactiveTransactional"
  notes: "DEG-specific selective UPDATE — only three columns out of ~30 on the pojo are written. A maintainer adding fields to DataEntityPojo would not have them propagated through this path."

- side_effect: "Bulk INSERT INTO data_entity (oddrn, hollow, exclude_from_search) VALUES (...) — placeholder rows"
  location: "ReactiveDataEntityRepositoryImpl.java:414-416 (createHollow) + line 862-864 (buildHollowRecord)"
  txn_scope: "delegates to parent class insertMany(records, false); transaction boundary defined by ingestion caller HollowDataEntityIngestionRequestProcessor"
  notes: "Hollow rows are always created with hollow=true AND exclude_from_search=true — they NEVER appear in user-facing surfaces until a real ingestion fills them. NOT a write the operator UI exercises."

- side_effect: "Soft-delete via UPDATE data_entity SET status=DELETED, status_updated_at=now(), status_switch_time=null WHERE id IN (...)"
  location: "ReactiveDataEntityRepositoryImpl.java:109-115 (getDeleteChangedFields override) — inherited delete() method at parent class line 51-74 issues the UPDATE"
  txn_scope: "varies by caller; the parent class issues a single UPDATE without wrapping it"
  notes: "Inherited delete(id) / delete(ids) methods route through this override. The default `deleted_at` semantics of the parent class are NOT used."

- side_effect: "Raw-SQL formatted ts_headline call (FTS highlight)"
  location: "ReactiveDataEntityRepositoryImpl.java:799-806 (getHighlightedResult)"
  txn_scope: "no transaction (single SELECT)"
  notes: "**SQL-injection vector** — see `known_security_gaps[0]`. The `text` and `tsQuery(query)` are interpolated into raw SQL via `String.formatted(text, tsQuery)`. Both parameters can contain single quotes (the server-built searchableString includes user fields; the user query passes through `tsQuery` which only adds prefix-matching, not escaping)."

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation on the class or any method (verified by inspecting the file head and Javadoc-free method bodies).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/introduction/main-concepts"
    anchor: ""
    rationale: "Defines `Data Entity` — the platform's core concept this repository persists. Every public method on this class works with `data_entity` rows. The doc page should match the column shape (status, view_count, hollow, exclude_from_search, internal_description, internal_name)."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "not-verified — WebFetch denied this session"
    confidence: LOW
    fetched_excerpts: |
      N/A — WebFetch was denied in this session. The maintainer should fetch the live page to confirm that the public 'Data Entity' definition aligns with the column shape this repository operates on (status / view_count / hollow / exclude_from_search semantics).
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: ""
    rationale: "Operator-facing config / deployment surface. No `@Value` config keys consumed in this file; the page is unlikely to mention this repository directly. Inferred for completeness only."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "not-verified — WebFetch denied this session"
    confidence: LOW
    fetched_excerpts: |
      N/A — WebFetch denied.
- doc_drift_findings:
  - "**Doc-gap candidate**: the `exclude_from_search` semantics — which list surfaces apply the filter (search, statistics, count-by-state) vs which do NOT (popular, my-objects, by-term, by-DEG, by-id details) — are not documented in any operator-facing page. Operators marking entities `exclude_from_search=true` may reasonably expect them hidden from the catalog Overview's 'Popular' strip; the implementation contradicts that expectation."
  - "**Doc-gap candidate**: the `hollow` concept — ingestion-placeholder rows that exist as soon as a real entity references them via lineage, before the real entity itself is ingested — is platform-internal. Operators inspecting `data_entity` table count via DB tools would see hollow rows; no docs page explains them."
  - "**Doc-gap candidate**: the view_count→popular feedback loop — the F-001/F-003 chain that this repository implements — is undocumented. Operators evaluating the popular ranking for compliance / SLA reasons cannot find any reference to (a) how popularity is computed, (b) whether it can be inflated, (c) whether stale views age out."
  - "**Doc-gap candidate**: the soft-delete-via-status mechanism (STATUS=DELETED) replaces the conventional `deleted_at` column. Operators writing custom queries against the database may filter on `deleted_at IS NULL` and silently include deleted entities. The schema's two-mechanism mix (the parent class assumes `deleted_at`, this subclass uses `status`) is platform-internal; no docs reference it."

## implicit_adrs

- "Soft-delete is implemented via a STATUS-column state machine (DELETED is one of 5 statuses) rather than the conventional `deleted_at` timestamp column. The base class assumes `deleted_at`; this subclass overrides because data entities carry richer lifecycle (STABLE / DEPRECATED / DRAFT / UNASSIGNED / DELETED) where DELETED is just one terminal state." — evidence: ReactiveDataEntityRepositoryImpl.java:109-123 — intent_anchor: "the explicit override of `getDeleteChangedFields` AND `addSoftDeleteFilter` paired with passing `null` for the parent's `deletedAtField` constructor parameter (line 103) — this is a deliberate substitution, not an accident; the constructor's null argument forces every parent helper that touches `deletedAtField` to be unusable, which is the maintainer's signal that the override is the contract." — confidence: HIGH
- "Hollow entities exist as a distinct row class for ingestion-placeholder rows (lineage-referenced before-real-ingest), and they are SHIELDED from user-facing surfaces by an unconditional `HOLLOW.isFalse()` predicate inside `cteDataEntitySelect` and `getDataEntityDefaultConditions`. They surface ONLY through the raw `get()` paths or `listByOddrns(... includeHollow=true)`." — evidence: ReactiveDataEntityRepositoryImpl.java:918, 972, 244, 862-864 — intent_anchor: "the `includeHollow` parameter on `listByOddrns` (line 229) — the only public escape hatch — is paired with the `buildHollowRecord` helper (line 862-864) which sets `setHollow(true).setExcludeFromSearch(true)` on creation: hollow rows are dual-flagged as exclude-from-search from birth, reinforcing the intent that they never reach user surfaces." — confidence: HIGH
- "Read-as-write: a successful detail-read increments view_count in the same transaction as the read. The repository exposes `incrementViewCount` as a distinct method (rather than inlining the UPDATE into `getDetails`) so the caller controls the transaction boundary, the side-effect ordering, and the rollback semantics." — evidence: ReactiveDataEntityRepositoryImpl.java:173-180 + DataEntityServiceImpl.java:207, 488-495 — intent_anchor: "the method's `Mono<Long>` signature returning the post-increment value, which `DataEntityServiceImpl.incrementViewCount` (line 488-495) lifts into the response DTO via `dto.getDataEntity().setViewCount(count)` — the post-mutation read-back is intentional, and the `switchIfEmpty(Mono.just(dto))` (line 494) is the explicit fail-soft for missing entities." — confidence: HIGH
- "List-shape queries share a single CTE-builder helper (`cteDataEntitySelect`) that materialises a data-entity slice; outer queries layer joins, aggregations, and orderings on top. This is the intentional architecture for assembly-line query construction and the locus of the 9 list-shape methods' filtering semantics." — evidence: ReactiveDataEntityRepositoryImpl.java:909-939 (the helper) + DataEntityCTEQueryConfig.java:14-40 (the @Builder record-style config) + lines 222, 518, 555-557, 637, 668, 689, 874 (callers) — intent_anchor: "the consistent `Name deCteName = name(DATA_ENTITY_CTE_NAME); Select<Record> dataEntitySelect = cteDataEntitySelect(cteConfig); Table<Record> deCte = dataEntitySelect.asTable(deCteName);` triplet pattern reproduced verbatim across 6 methods — this is a maintainer-recognised idiom, not a copy-paste accident." — confidence: HIGH
- "Aggregated relations (owners, titles, ownerships, tags, metadata) are returned as JSON arrays via `jsonArrayAgg(...)` rather than as separate per-relation queries (no N+1 fanout, no IN-clause batching). This is the intentional architecture for hydrating the data-entity-with-everything detail view in one round-trip." — evidence: ReactiveDataEntityRepositoryImpl.java:295-304, 768-797, 880-887 — intent_anchor: "the `AGG_OWNER_FIELD` / `AGG_TITLE_FIELD` / `AGG_OWNERSHIP_FIELD` / `AGG_TAGS_FIELD` / `AGG_METADATA_FIELD` constants are stable named columns in `DataEntityCTEQueryConfig.java:14-24`, used uniformly by the `DataEntityDtoMapper` to extract aggregated relations — the convention is platform-wide." — confidence: HIGH
- "The repository is deliberately untransactional. Transaction boundaries live one layer up at the service. This allows individual repository methods to compose freely under either a shared transaction (when a caller wraps several calls in @ReactiveTransactional) or no transaction (when a caller fires-and-forgets). The trade-off is that callers can forget to wrap and silently lose atomicity." — evidence: ReactiveDataEntityRepositoryImpl.java:89-91 (no class-level @Transactional / @ReactiveTransactional) + DataEntityServiceImpl.java:197 (transactional getDetails) + DataEntityServiceImpl.java:325 (transactional upsertDescription) — intent_anchor: "the consistent @ReactiveTransactional placement on the service-layer caller (DataEntityServiceImpl) rather than the repository — a maintainer-recognised pattern across the codebase (every other Reactive*Repository follows the same convention)." — confidence: HIGH

## bugs_limitations_corner_cases

- "**SQL-injection vector in `getHighlightedResult`** (lines 799-806). The method builds raw SQL via `String.formatted(text, tsQuery)` and passes the resulting string to `DSL.field(sql, String.class)`. The `text` parameter is the server-assembled `searchableString` from `DataEntityHighlightConverter.convert(...)` which includes user-controlled fields (`internal_name`, `internal_description`, tags). The `query` parameter passes through `JooqFTSHelper.tsQuery` which only does `plainQuery.split(\" \").map(w -> w + \":*\").join(\"&\")` — NO single-quote escaping, NO sanitisation. A user-writable internal_description containing `\\'); DROP TABLE data_entity; --` would land verbatim into the `text` slot of `\"ts_headline('english', '%s', ...)\"`, breaking out of the SQL string literal. A search query containing `\\'\\)\\)|x'='` would land into the second slot. The attack surface is gated by `DATA_ENTITY_DESCRIPTION_UPDATE` for the description path (writer-side) and by `DATA_ENTITY_VIEW` for the highlight-read (reader-side) — but under `auth.type=DISABLED` both are bypassed. Severity HIGH because this is the only raw-SQL-format path in the file and the inputs flow from user-controllable surfaces." — evidence: ReactiveDataEntityRepositoryImpl.java:799-806 + JooqFTSHelper.java:164-168 (tsQuery does not escape) + DataEntityHighlightServiceImpl.java:43-44 (text comes from server-assembled searchableString including user fields) — severity: HIGH

- "**REFACTOR-222 confirmed: `EXCLUDE_FROM_SEARCH` is NOT applied in `cteDataEntitySelect`**, the CTE-builder helper consumed by 9 list-shape methods (`listPopular`, `listByOwner`, `listByTerm`, `getDEGExperimentRuns`, `getDimensions(id|oddrns|ids)`, `getDetails(id)`, `getQuerySuggestions`, `findByState` — note: `findByState` re-adds the predicate via `JooqFTSHelper.resultFacetStateConditions` at line 149, so it IS filtered). Other paths route through `getDataEntityDefaultConditions` (line 970-976) which DOES apply the filter — `countByState`, `countByDatasourceAndType`, `getDataSourceEntityTypeIds`, `getCountByDataSources`, `getDataEntityDomainsInfo`, `getDataEntityWithOwnership`. The inconsistency means entities marked `exclude_from_search=true` ARE included in the popular list, by-owner list, by-term list, DEG-children list, single-entity details, and FTS query suggestions; they are NOT included in count-by-state, statistics, the search results facet list, or count-by-datasource. Confirmed from primary source." — evidence: ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect omits EXCLUDE_FROM_SEARCH) vs lines 448, 974 (other paths include it) + JooqFTSHelper.java:149 (findByState re-adds it) — severity: MEDIUM (the gap is documented behaviour for popular/my-objects/by-term per `getPopular.md` already; raising visibility here)

- "**`createHollow` bulk-insert delegates to parent `insertMany(records, false)` with no per-row validation.** The `buildHollowRecord` helper (lines 862-864) only sets `oddrn`, `hollow=true`, `exclude_from_search=true` — every other column (status, type_id, namespace_id, data_source_id, internal_name, external_name, ...) is left to whatever Postgres default applies. The `status` column for a hollow row is NULL by default, which would fail the `status_updated_at` consistency invariant if any soft-delete operation touched a hollow row. (No code path currently does — soft-delete operations route through `idCondition` which adds the soft-delete filter that ALSO filters hollow=false implicitly via the cteDataEntitySelect contract — but the schema invariant is fragile.)" — evidence: ReactiveDataEntityRepositoryImpl.java:414-416 + 862-864 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-74 (parent's delete() touches deletedAtField which is null for this subclass) — severity: LOW

- "**`listByOddrns` pagination math under empty `size`+`page`: `DSL.noField(Integer.class)` fallback (lines 249-250).** When `size=null`, the LIMIT clause is `DSL.noField(Integer.class)` — which jOOQ renders as `null` cast to integer. Postgres semantics for `LIMIT NULL` is 'no limit', so this works — but the same pattern in `listByOwner` (line 529-530) is duplicated. A future change to one without the other would silently diverge pagination defaults across surfaces." — evidence: ReactiveDataEntityRepositoryImpl.java:249-250, 529-530 — severity: LOW

- "**`listPopular` page math (`(page-1)*size`) does not validate `page >= 1`.** A caller passing `page=0` produces a negative offset; Postgres rejects with a runtime error that surfaces as 500. The OpenAPI spec (per `getPopular.md`) does not declare `minimum: 1` on the page parameter. The same pattern is duplicated at lines 390, 530, 589, 606, 632, 722 — every paginated list method. A single utility method `validatePage(int page)` enforcing `page >= 1` would close 7 occurrences." — evidence: ReactiveDataEntityRepositoryImpl.java:632 (and 6 other call sites) — severity: LOW

- "**`getHighlightedResult` accepts `text` and `query` with no length cap.** A 100 MiB `internal_description` (no schema limit; see neighbour sidecar `upsertDataEntityInternalDescription.md:bugs_limitations_corner_cases[2]`) flows verbatim into the formatted SQL string AND through the JDBC pipeline AND through `ts_headline`. The Postgres function tolerates large inputs, but the JVM heap retains the entire string for the duration of the request. Couples with the SQL-injection finding above: oversized text is both a SQL-injection surface AND a DoS surface." — evidence: ReactiveDataEntityRepositoryImpl.java:799-806 + DataEntityHighlightConverter.java (text-assembly path) + no `@Size` / `@Valid` upstream — severity: LOW

- "**No EXPLAIN / index assertion** on `view_count` ordering. `listPopular` issues `ORDER BY view_count DESC` against `data_entity`. Per `getPopular.md:concepts.entities`, `view_count` has NO index (verified across all migration files). For a 100K+ entity catalog, the popular query is a full table scan + sort. Severity LOW because the LIMIT is small (typically 5-20) so Postgres can use a top-N sort, but the lack of an index is a known performance hazard if the catalog grows." — evidence: ReactiveDataEntityRepositoryImpl.java:633 + migration audit per `getPopular.md` — severity: LOW

- "**`getDataEntitySearchFields` LEFT JOIN fan-out may produce JSON-array duplicates** (lines 768-797). The 6 LEFT JOINs against OWNERSHIP, OWNER, TITLE, TAG_TO_DATA_ENTITY, TAG, METADATA_FIELD_VALUE, METADATA_FIELD on a single root row produce a Cartesian product; the `groupBy(groupByFields)` collapses to one row, but `jsonArrayAgg(...)` over a fan-out emits N×M duplicates inside the array unless the mapper de-duplicates. `DataEntityDtoMapper.mapDataEntitySearchFieldsRecord` must de-dup — not verified in this session." — evidence: ReactiveDataEntityRepositoryImpl.java:768-797 — severity: LOW (pending verification of mapper-side dedup)

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "Repository code is not on the HTTP surface. Auth-mode doesn't apply directly here, but every method's behaviour is downstream of the controller's auth gate. Under `auth.type=DISABLED` the controller layer bypasses SECURITY_RULES and any caller reaches the repository unchecked. The repository ITSELF has no fail-closed defence — it executes whatever query the caller requested." — evidence: ReactiveDataEntityRepositoryImpl.java:89-91 (no auth annotation, no caller-identity check) + DisabledAuthSecurityConfiguration.java (the DISABLED-mode bypass; cross-ref upsertDataEntityInternalDescription.md security gap [1]).
- ingestion_filter_relevance: "NO — repository code is not HTTP-shaped. The ingestion path reaches this class only via `createHollow` (from `HollowDataEntityIngestionRequestProcessor.java:25`), which is downstream of `IngestionDataEntitiesFilter`."
- authorization_assertions: [] — N/A. The repository enforces no authorization. All gates live upstream.
- owner_scoping: "BYPASSES at the repository layer — no method on this class takes a current-user / current-owner predicate. `listByOwner(ownerId, ...)` requires the caller to pass the owner id; the repository does not verify the caller IS that owner. Cross-owner reads are structurally possible if a caller passes an arbitrary `ownerId`."
- data_exposure:
  - "Every list-shape method potentially returns rows across all owners with no per-tenant filter. The dominant exposure is via `listPopular` (no filter at all), `findByState` (filter is by FacetStateDto, not by current-user), `getDimensions(oddrns)` (filter is by oddrn list, not by current-user). → any authenticated caller under LOGIN_FORM/OAUTH2/LDAP; any caller under DISABLED."
  - "`incrementViewCount` writes a counter that subsequently feeds `listPopular`. A caller able to call `getDetails` 1000 times (no rate limit upstream — confirmed in `getPopular.md`) can push any entity to top-1 of the popular ranking. Severity is MEDIUM — the data leak is via the side-effect on a shared ranking column, not via direct data exposure."
  - "`setInternalDescription` / `setInternalName` accept arbitrary content from the caller and store it verbatim. The data exposure on READ is downstream (every reader of the entity sees the content). The platform's content-injection surface — `<script>`, `<img src=x onerror>`, JavaScript: URLs, `[[ns:term]]` glossary mentions that auto-create term-relations — flows through these writes. P-009 probe-runs (per neighbour sidecar `upsertDataEntityInternalDescription.md:probe_verifications`) empirically prove the verbatim-store contract."
- known_security_gaps:
  - "**SQL-injection vector in `getHighlightedResult`** (lines 799-806) — raw `.formatted()` SQL with user-controllable inputs. The `searchableString` (which includes `internal_name`/`internal_description`/tags from the data entity) is one of the two interpolated parameters; the user query is the other. Both are user-writable through other paths. See `bugs_limitations_corner_cases[0]`. — severity: HIGH — evidence: ReactiveDataEntityRepositoryImpl.java:799-806 + JooqFTSHelper.java:164-168
  - "**Owner-scoping is delegated to upstream callers; the repository BYPASSES owner-scoping at JOIN time** — a maintainer adding a new controller endpoint that bypasses the SECURITY_RULES table can reach this repository with arbitrary parameters. — severity: MEDIUM — evidence: ReactiveDataEntityRepositoryImpl.java:89-91 + ReactiveDataEntityRepository.java:17 (interface signature has no owner / principal parameter)
  - "**EXCLUDE_FROM_SEARCH inconsistency** — entities flagged `exclude_from_search=true` ARE included in `listPopular` / `listByOwner` / `listByTerm` / `getDimensions(...)` / `getDetails(...)` etc. An operator marking an entity exclude-from-search to hide sensitive content from search may still see it surface in the catalog's 'Popular' strip or in by-owner listings. — severity: MEDIUM — evidence: ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect omits the predicate)
  - "**view_count inflation surface is structural** — `incrementViewCount` is method-only (no rate limit, no per-caller throttle); the consumer `listPopular` orders exclusively by this column. Confirmed from primary source. — severity: MEDIUM — evidence: ReactiveDataEntityRepositoryImpl.java:173-180 + 630-649

## performance

- hot_paths:
  - "**`getDetails(id)` + `getDimensions(id)`** — the entity-detail page's primary read. CTE-materialised; assembles owners/titles/ownership/lookup-table via jsonArrayAgg in one round-trip. Also triggers `incrementViewCount` (a second UPDATE in the same transaction)." — evidence: lines 217-225 + 488-495 of caller
  - "**`findByState(state, page, size, owner)`** — the catalog search's result-list. Six LEFT JOINs + CTE materialisation + facet conditions + status-priority CASE in the outer ORDER BY (lines 704-710). Called on every search keystroke / facet change in the UI." — evidence: lines 651-727
  - "**`getDataEntitySearchFields(id)`** — the search-highlight result assembly. Seven LEFT JOINs on a single root entity (the heaviest fan-out on the class). Called once per data-entity highlight render." — evidence: lines 762-796
  - "**`listPopular(page, size)`** — Overview-page popular strip. ORDER BY view_count DESC with no index; relies on top-N sort for small LIMIT." — evidence: line 629-649
  - "**`getQuerySuggestions`** — search-suggestion endpoint, called on every typeahead keystroke. Limited to 5 results (SUGGESTION_LIMIT, line 92)." — evidence: lines 471-513
- throughput_characteristics:
  - "Single-row reads (`get`, `getDetails`, `getDimensions(id)`, `existsIncludingSoftDeleted`) — fast, indexed primary-key lookups."
  - "List-shape reads — CTE-materialised; query-plan complexity grows with the number of LEFT JOINs and the size of the IN-list. The `Map.collectMap` step (e.g. `getCountByDataSources`, `getDEGEntities(groupOddrns)`, `getExperimentRunsCount`, `getParentDEGs`) is reactive but blocks the chain until the Flux completes."
  - "Writes are single-row UPDATEs with `returning()` — fast, one round-trip per call."
  - "Bulk inserts (`createHollow`) delegate to parent `insertMany(records, false)` — batched, one round-trip per batch."
- resource_allocation:
  - "Memory: every list-shape method's `jsonArrayAgg(field(OWNER.asterisk().toString()))` retains the aggregated JSON in Postgres before returning. For an entity with 100 owners + 100 tags + 100 metadata fields, the row payload can be MB-sized. Reactive `flux(query).map(...)` decodes the entire row in JVM heap before emitting downstream."
  - "DB connections: each method takes one connection from the R2DBC pool for the duration of the query. No explicit pool tuning in this class."
  - "No outbound HTTP, no third-party calls."
- scaling_characteristics:
  - "Stateless — instances scale horizontally."
  - "No advisory locks, no row-level locks issued explicitly. Postgres MVCC handles the implicit row-level locking on UPDATEs."
  - "Pagination is page-1-indexed (every paginated method uses `(page-1)*size`); no offset cap. Deep pagination (high `page`) degrades linearly per Postgres OFFSET semantics."
  - "No view_count contention serialisation — two simultaneous `incrementViewCount(id)` calls for the same entity race on the same row; Postgres serialises via row-level lock at MVCC layer, but `view_count = view_count + 1` is the standard non-atomic SQL pattern (`UPDATE ... SET col = col + 1` IS atomic per-statement in Postgres, so no lost-update — verified by SQL semantics, not by test)."
- known_performance_gaps:
  - "**No index on `view_count`** — `listPopular`'s `ORDER BY view_count DESC` is a full-table scan + top-N sort. For 100K+ entity catalogs, this degrades linearly. — severity: MEDIUM — evidence: ReactiveDataEntityRepositoryImpl.java:633 + migration audit per getPopular.md (no view_count index in any of 91 migration files)
  - "**FTS rebuild on every description write is full-vector reconstruction** (per neighbour sidecar `upsertDataEntityInternalDescription.md:performance.known_performance_gaps[1]`) — driven by the caller, not this class, but the repository's `setInternalDescription` is the trigger. — severity: LOW
  - "**`getDataEntitySearchFields` 7-LEFT-JOIN fan-out** — for entities with many tags + many metadata + many owners, the query-plan cost grows multiplicatively. — severity: LOW — evidence: ReactiveDataEntityRepositoryImpl.java:768-797
  - "**No streaming on large `listByOddrns` calls** — `flux(query)` is reactive but `.collectList()` at the service layer (e.g. `DataEntityServiceImpl.listAssociated`) materialises the full list in heap before responding. A 10K-oddrn call holds 10K data-entity payloads in heap. — severity: LOW
  - "**Deep-pagination OFFSET cost** — high page numbers (e.g. page=1000) on `findByState` / `listPopular` / `listByOwner` issue `OFFSET 14985` which Postgres still scans through. No cursor-based pagination alternative is exposed. — severity: LOW

## sources

- understanding ← ReactiveDataEntityRepositoryImpl.java:1-982 (full file) + ReactiveDataEntityRepository.java:1-119 (interface) + ReactiveAbstractSoftDeleteCRUDRepository.java:22-118 (parent class)
- concepts.entities.DataEntityPojo ← ReactiveDataEntityRepositoryImpl.java:90 (extends type parameter)
- concepts.entities.DataEntityCTEQueryConfig ← DataEntityCTEQueryConfig.java:14-40
- concepts.entities.DATA_ENTITY.HOLLOW / EXCLUDE_FROM_SEARCH / VIEW_COUNT ← ReactiveDataEntityRepositoryImpl.java:918, 974, 633 + interface line 28 (incrementViewCount signature)
- concepts.invariants.[0] (soft-delete override) ← ReactiveDataEntityRepositoryImpl.java:109-123 + ReactiveAbstractSoftDeleteCRUDRepository.java:25-33 (parent's deletedAtField semantics)
- concepts.invariants.[1] (hollow exclusion) ← ReactiveDataEntityRepositoryImpl.java:918, 972, 243-245
- concepts.invariants.[2] (EXCLUDE_FROM_SEARCH inconsistency) ← ReactiveDataEntityRepositoryImpl.java:448 + 974 + 909-939 (cteDataEntitySelect omits) + JooqFTSHelper.java:149 (findByState re-adds)
- concepts.invariants.[3] (no repo-layer txn) ← ReactiveDataEntityRepositoryImpl.java:88-91 (class declaration, no @Transactional / @ReactiveTransactional) + DataEntityServiceImpl.java:197, 324 (txn at service)
- concepts.invariants.[4] (writes don't verify existence) ← ReactiveDataEntityRepositoryImpl.java:174-180, 419-427, 430-438, 138-147 (all bare update() with `where(ID.eq(id)).returning()`)
- concepts.invariants.[5] (no owner-scoping) ← ReactiveDataEntityRepositoryImpl.java:1-982 (no current-user / owner predicate on any signature) + ReactiveDataEntityRepository.java:1-119 (interface — no principal parameter)
- concepts.invariants.[6] (SQL-format injection in getHighlightedResult) ← ReactiveDataEntityRepositoryImpl.java:799-806 + JooqFTSHelper.java:164-168 (tsQuery does not escape) + DataEntityHighlightServiceImpl.java:43-44 (text source)
- concepts.invariants.[7] (read-as-write) ← ReactiveDataEntityRepositoryImpl.java:173-180 + DataEntityServiceImpl.java:207, 488-495 + probe-run F-001 chain
- dependencies_semantic.requires-feature.[0..7] ← ReactiveDataEntityRepositoryImpl.java:97-107 (constructor injects JooqReactiveOperations, JooqQueryHelper, JooqRecordHelper, JooqFTSHelper, DataEntityDtoMapper) + DataEntityCTEQueryConfig.java + FTSConstants.java + DateTimeUtil.java
- dependencies_semantic.coupling.* ← ReactiveAbstractSoftDeleteCRUDRepository.java:22-118 (parent) + DataEntityServiceImpl.java:197, 324 (callers wrap in @ReactiveTransactional) + SecurityConstants.java (upstream authz, cross-ref) + ReactiveSearchEntrypointRepositoryImpl (FTS coupling, cross-ref)
- tests_coverage_semantic.covered_behaviours ← grep `ReactiveDataEntityRepositoryImpl` over `<odd-platform-repo>/odd-platform-api/src/test` → 0 matches; `find <odd-platform-repo>/odd-platform-api/src/test -name '*DataEntityRepository*'` → 0 matches
- tests_coverage_semantic.uncovered_behaviours.[*] ← each behaviour cited above traces to the corresponding line in ReactiveDataEntityRepositoryImpl.java
- upstream_callers ← grep `incrementViewCount|listPopular|setInternalDescription|setInternalName|updateDEG|createHollow|getDetails|getDimensions|listByOddrns|findByState|getDEGEntities|getDEGExperimentRuns|listByOwner|listByTerm|getDataEntityDomainsInfo|getDataSourceEntityTypeIds|countByState|countByDatasourceAndType|getHighlightedResult|getDataEntitySearchFields|getQuerySuggestions|listByDatasourceAndType|getParentDEGs|getDataEntityWithDataSourceAndNamespace|getDataEntityWithOwnership|getPojosForStatusSwitch` over `<odd-platform-repo>/odd-platform-api/src/main/java` → 53 files of consumers
- downstream_side_effects.[0] (F-001 view_count) ← ReactiveDataEntityRepositoryImpl.java:173-180 + DataEntityServiceImpl.java:197, 488-495 + getDataEntityDetails.md:probe_verifications
- downstream_side_effects.[1] (F-003 listPopular) ← ReactiveDataEntityRepositoryImpl.java:630-649 (full method body) + 909-939 (cteDataEntitySelect — EXCLUDE_FROM_SEARCH omission)
- downstream_side_effects.[2] (F-004 setInternalDescription) ← ReactiveDataEntityRepositoryImpl.java:430-438 + DataEntityServiceImpl.java:323-333 + DataEntityInternalStateServiceImpl.java:54-71
- downstream_side_effects.[3..7] (setInternalName / updateDEG / createHollow / soft-delete / getHighlightedResult) ← lines 419-427, 138-147, 414-416 + 862-864, 109-123, 799-806
- docs_link_semantic.* ← grep `@docs` in ReactiveDataEntityRepositoryImpl.java → 0 matches; WebFetch denied this session — inferred URLs marked LOW confidence
- implicit_adrs.[0] (soft-delete override) ← ReactiveDataEntityRepositoryImpl.java:103, 109-123
- implicit_adrs.[1] (hollow shielding) ← ReactiveDataEntityRepositoryImpl.java:918, 972, 244, 862-864
- implicit_adrs.[2] (read-as-write) ← ReactiveDataEntityRepositoryImpl.java:173-180 + DataEntityServiceImpl.java:207, 488-495
- implicit_adrs.[3] (CTE-builder helper) ← ReactiveDataEntityRepositoryImpl.java:909-939 + DataEntityCTEQueryConfig.java:14-40
- implicit_adrs.[4] (jsonArrayAgg relations) ← ReactiveDataEntityRepositoryImpl.java:295-304, 768-797, 880-887
- implicit_adrs.[5] (untransactional repo) ← ReactiveDataEntityRepositoryImpl.java:88-91 (no @Transactional) + DataEntityServiceImpl.java:197, 324
- bugs_limitations_corner_cases.[0] (SQL-injection) ← ReactiveDataEntityRepositoryImpl.java:799-806 + JooqFTSHelper.java:164-168 + DataEntityHighlightServiceImpl.java:43-44
- bugs_limitations_corner_cases.[1] (REFACTOR-222) ← ReactiveDataEntityRepositoryImpl.java:909-939 vs 448, 974 + JooqFTSHelper.java:149
- bugs_limitations_corner_cases.[2..7] ← lines 414-416 + 862-864, 249-250 + 529-530, 632, 799-806 + neighbour sidecar `upsertDataEntityInternalDescription.md`, 633, 768-797
- security.auth_mode_relevance ← ReactiveDataEntityRepositoryImpl.java:88-91 + upstream authz cross-ref (DisabledAuthSecurityConfiguration.java per `upsertDataEntityInternalDescription.md`)
- security.owner_scoping ← interface signatures lacking principal/owner parameter (ReactiveDataEntityRepository.java:1-119)
- security.known_security_gaps.[0..3] ← cited as `bugs_limitations_corner_cases[0]` + line 909-939 (EXCLUDE_FROM_SEARCH) + view_count surfaces above
- performance.hot_paths.[0..4] ← line 217 (getDetails), 651 (findByState), 762 (getDataEntitySearchFields), 629 (listPopular), 471 (getQuerySuggestions)
- performance.known_performance_gaps.[0..4] ← line 633 (no view_count index per migration audit in getPopular.md), 768-797 (LEFT JOIN fan-out), pagination offset semantics across the 7 sites

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero coverage is a high-confidence empirical finding; verified by exhaustive grep)
- upstream_callers: HIGH (verified by grep of all method names across `<odd-platform-repo>/odd-platform-api/src/main/java` — 53 files)
- downstream_side_effects: HIGH (each side effect traces to a specific line range)
- docs_link_semantic: LOW (WebFetch denied this session; cannot verify any URL)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (file-local scope; aggregate posture is concept-merger's job)
- performance: MEDIUM (some performance characteristics — e.g. JOIN-cardinality fan-out, view_count index absence at scale — depend on data shape, not statically resolvable)

## Maintainer notes

(empty — preserved for future maintainer prose)

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

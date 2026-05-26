# SHB-012 — Directory level-4 page-vs-count predicate divergence (EXCLUDE_FROM_SEARCH inconsistency breaks pagination math)

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators browsing the Directory (`/api/directory/datasources/{id}?type_id=&page=&size=`) see "X of Y entities" with X > Y possible AND page-2 returning rows that "shouldn't exist according to the count" because the page query and the count query use DIFFERENT predicate sets. `ReactiveDataEntityRepositoryImpl.listByDatasourceAndType` (the page path, via `cteDataEntitySelect`) applies `addSoftDeleteFilter` + `HOLLOW.isFalse()` — two filters. `ReactiveDataEntityRepositoryImpl.countByDatasourceAndType` (the count path, via `getDataEntityDefaultConditions`) applies THREE filters: HOLLOW + `STATUS != DELETED` + `EXCLUDE_FROM_SEARCH IS NULL OR = FALSE`. The third filter is the divergent one — entities with `EXCLUDE_FROM_SEARCH = TRUE` are RETURNED by the page query but NOT COUNTED by the count query. This is the second site of the bug-class REFACTOR-425 identified at `ReactiveDataSourceRepositoryImpl.listDto`; F-023 (Directory) doesn't capture the divergence.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DirectoryController.java:36-44` — `getDatasourceEntities` delegates level-4 to `DataEntityService.getDataEntitiesByDatasourceAndType`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:164-179` — the composition: page via `reactiveDataEntityRepository.listByDatasourceAndType(datasourceId, typeId, page, size)` (line 170) + count via `countByDatasourceAndType(datasourceId, typeId)` (line 173).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:595-613` — PAGE path: `cteConditions` only has `DATA_SOURCE_ID = ?` (+ optional `TYPE_ID = ?`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:909-939` — `cteDataEntitySelect → addSoftDeleteFilter(...)` adds `deleted_at IS NULL` + `STATUS != DELETED` (derived from the `getDeleteChangedFields` override at :110-116 + the `addSoftDeleteFilter` override at :118-122) PLUS `DATA_ENTITY.HOLLOW.isFalse()` (line 918). **Missing**: `DATA_ENTITY.EXCLUDE_FROM_SEARCH` filter.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:616-627` — COUNT path: `getDataEntityDefaultConditions()` returns THREE conditions: HOLLOW.isFalse() + STATUS != DELETED + EXCLUDE_FROM_SEARCH IS NULL or = FALSE.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:970-976` — `getDataEntityDefaultConditions` definition: the three filters list.
- F-023 (Directory) anchors the four-level browse but does NOT enumerate the pagination correctness defect.
- REFACTOR-425 identifies the FIRST site (`ReactiveDataSourceRepositoryImpl.listDto`); SHB-012 is the SECOND site of the same bug-class.

## Notes

- **Operator-visible symptom**: a datasource containing entities with `EXCLUDE_FROM_SEARCH = TRUE` (the platform sets this on some transient/intermediate entities — runs, hollow placeholders, framework-internal rows) shows the count column lower than the page-1 row count. UI rendering `pageData.length / count.total` shows >100% completion. Page-2 returns rows that "shouldn't exist" per the count.
- **The bug is silent in the common case**: deployments whose per-datasource entities are all `EXCLUDE_FROM_SEARCH = FALSE` (no platform-set transient entities for that source) show consistent counts. Manifests only in deployments using EXCLUDE_FROM_SEARCH to hide intermediate entities.
- **The fix is small**: align the predicate sets. Recommended: update `cteDataEntitySelect` (or `listByDatasourceAndType` specifically) to apply `EXCLUDE_FROM_SEARCH` filter, matching `getDataEntityDefaultConditions`. Alternative: drop `EXCLUDE_FROM_SEARCH` from the count predicate (matches existing page behaviour but changes the count semantics — riskier).
- **Cross-cutting bug class — PREDICATE-DIVERGENCE-IN-PAGINATION-WRAPPERS**: the same root pattern as REFACTOR-425. The bug class is now confirmed at TWO sites; an audit sweep across all repository `list*/count*` pairs in the codebase is the defensible follow-up. The Directory level-4 path is the SECOND surface; there may be more.
- **The Directory feature page** (`/features/data-discovery/directory`, verified 2026-05-20 status 200) doesn't acknowledge the EXCLUDE_FROM_SEARCH semantic at all. Operators have no source to reconcile the discrepancy.
- **REFACTOR-NNN candidate**: a sprint to audit all `list*/count*` repository pairs in the codebase for predicate-divergence. Recommended grouping with REFACTOR-425 in a "pagination-wrapper predicate audit" sprint.
- **Not a security thread**: this is a correctness/pagination-math defect, not an authorization gap.

## Next

1. **REFACTOR-NNN — MEDIUM** — fix `cteDataEntitySelect` to add `EXCLUDE_FROM_SEARCH IS NULL OR = FALSE` to the conditions list, matching `getDataEntityDefaultConditions`. This eliminates the divergence at this site.
2. **REFACTOR-NNN — MEDIUM** — pagination-wrapper predicate audit sprint. Walk every `ReactiveAbstractCRUDRepository` subclass and verify that every `list*` and the corresponding `count*` use the same WHERE clause. Expected outcome: 2-5 sites with similar divergences.
3. **TEST-NNN — MEDIUM** — `DirectoryTest` (currently covers levels 1 + 2) needs a level-4 case: ingest entities with `EXCLUDE_FROM_SEARCH = TRUE`, call `getDatasourceEntities`, assert `pageData.length === count.total` for that datasource. DRIFT-locking test that today FAILS until the fix lands.
4. **Cluster** with REFACTOR-425 as part of the pagination-predicate-audit grouping.
5. **DOC-NNN — LOW** — once the fix lands, update the `/features/data-discovery/directory` page to acknowledge the EXCLUDE_FROM_SEARCH-filtered listing (or leave it implicit — the operator doesn't need to know about the column).

## Links

- cluster_with: [F-023]
- merged_into: (open)
- supersedes: []

## REFACTOR-620 — `GET /api/search/{search_id}/results` returns `hasNext: true` REGARDLESS of remaining rows — `DataEntityServiceImpl.findByState:192` hard-codes `true`; third-party API consumers using the OpenAPI contract loop forever fetching empty pages

**Severity**: HIGH
**Category**: contract-bug + name-vs-behavior-drift (Category B)
**Pillars affected**: [P-04 Data Discovery]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**`getSearchResults.hasNext` is always `true` regardless of remaining rows — contract bug (Category B drift).** `DataEntityServiceImpl.findByState:181-194` constructs `new Page<>(dtos, total, true)` with `true` hard-coded; the mapper writes that into `DataEntityList.pageInfo.hasNext`. Operator-visible consequences: (a) third-party API consumers using the OpenAPI contract directly will loop fetching empty pages indefinitely; (b) the UI compensates client-side at `dataentitiesSearch.thunks.ts:62-63` with `hasNext: page * size < pageInfo.total` — but this is undocumented compensation and any other consumer (mobile client, CLI integration, automated test) is broken; (c) the documented `PageInfo` schema in the OpenAPI spec is a lie. Fix anchor: `DataEntityServiceImpl.java:192` change `true` → `(page * size) < total`."
- `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.name_behavior_pairs.[0]` (HIGH) — "`DataEntityList.pageInfo.hasNext` (response field on /api/search/{search_id}/results): drift DRIFT_NAME_VS_BEHAVIOR. Promise: 'hasNext is a boolean indicating whether MORE pages of results exist'. Implementation: 'hard-coded true regardless of remaining rows'."
- `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[6]` — "`SearchFacetsData.hasNext` is ALWAYS `true` regardless of remaining rows — `DataEntityServiceImpl.findByState:181-194` constructs `new Page<>(dtos, total, true)` with a hard-coded `true` for the `hasNext` boolean (`Page.java:11-15`); the UI compensates by computing `hasNext: page * size < pageInfo.total` in the `fetchDataEntitySearchResults` thunk (`dataentitiesSearch.thunks.ts:62-63`), but third-party API consumers reading the contract directly will pagination-loop indefinitely (Category B drift)"
- Probe `P-135` (Category A + B: getSearchResults.hasNext at size > total)

**Description**: `DataEntityServiceImpl.findByState` (the service-tier method called by `GET /api/search/{search_id}/results`) at line 192 constructs the `Page<>` wrapper with a HARD-CODED `true` for the `hasNext` boolean:

```java
// DataEntityServiceImpl.java:181-194
public Mono<Page<DataEntityDimensionsDto>> findByState(...) {
  return repository.findByState(state, page, size, owner)
    .collectList()
    .zipWith(repository.countByState(state, owner))
    .map(t -> {
      final List<DataEntityDimensionsDto> dtos = t.getT1();
      final Long total = t.getT2();
      return new Page<>(dtos, total, true);  // ← hard-coded TRUE
    });
}
```

The `Page<>` wrapper carries the `hasNext` boolean verbatim through `DataEntityMapper.mapPojos` into the `DataEntityList.pageInfo.hasNext` field that the OpenAPI contract documents at `openapi.yaml:734-755` as "Indicates whether more pages of results exist". A third-party API consumer (mobile client, CLI integration, automated test, third-party catalog connector) reads the OpenAPI contract literally:

```
do {
  response = api.getSearchResults(searchId, page++, size);
  consume(response.items);
} while (response.pageInfo.hasNext);
```

This loop NEVER TERMINATES on the backend's `hasNext: true` response. The consumer fetches page 1 (with items), page 2 (with items), ..., page N (where N*size >= total, items=[]), then page N+1 (items=[]), page N+2 (items=[]), ... — receiving empty pages forever until the consumer rate-limits, times out, or hits a circuit-breaker.

**The UI compensates client-side** at `dataentitiesSearch.thunks.ts:62-63`:
```typescript
return { ...res, pageInfo: { ...pageInfo, hasNext: page * size < pageInfo.total } };
```

The UI's client-side override hides the bug from the platform's primary consumer. Every OTHER consumer is broken.

**Primary source citations**:
- `DataEntityServiceImpl.java:181-194` — the `new Page<>(dtos, total, true)` line with the hard-coded `true`
- `Page.java:11-15` — the `Page<T>` record carries `(items, total, hasNext)` with no derivation logic
- `DataEntityMapper.mapPojos` — writes `pageInfo.hasNext` from `Page.hasNext` verbatim
- `openapi.yaml:734-755` — the `PageInfo` schema's `hasNext` field that operators / API consumers read
- `dataentitiesSearch.thunks.ts:62-63` — the UI's client-side `hasNext: page * size < pageInfo.total` override

**Existing-ADR-or-implied-prescription**: none directly. The platform's pagination convention is encoded in `JooqQueryHelper.paginate` + `JooqQueryHelper.pageifyResult` which DO compute `hasNext` correctly for sibling list endpoints (e.g. `getRelationships` per RelationshipController batch ZE, `getDataEntityList`, `getTitleList`). The convention is therefore "compute `hasNext = (page * size) < total`"; `DataEntityServiceImpl.findByState:192` is a DEVIATION from the convention. Sibling deviation: REFACTOR-319 (`TermServiceImpl.listByTerm` has the inverse bug — hasNext hard-coded `false`); both deviations point at the SAME architectural gap (no shared `Page<>` constructor that enforces the convention).

**Proposed remedy**: Three-step fix:
1. Replace `new Page<>(dtos, total, true)` at `DataEntityServiceImpl.java:192` with `new Page<>(dtos, total, (long) page * size < total)`.
2. Add an integration test asserting `GET /api/search/{search_id}/results` returns `hasNext: false` on the LAST page (`page * size >= total`).
3. Add a static-analysis rule (or a `Page.of(items, total, page, size)` factory method) that prevents future hard-coded `hasNext` boolean values at the `Page<>` construction sites.

The remedy is refactoring within the existing service-tier shape — not a structural change. The architecture (server-paginated `DataEntityList` response with `PageInfo`) stays the same.

**Severity rationale**: HIGH — third-party API contract bug on the platform's most-trafficked READ endpoint (the entire catalog-search-results surface). The UI hides the bug; every non-UI consumer is broken. Pairs with REFACTOR-319 (sibling-shape `hasNext: false` hard-coded) — both deviations call for the shared `Page.of(...)` factory fix.

**Suggested backlog grouping**: `Pagination contract hardening sprint` — couple with REFACTOR-319 (Term hasNext: false hard-coded), REFACTOR-020 (pagination unbounded), REFACTOR-347 (no ORDER BY on listByOddrns), REFACTOR-366 (Tag listByTerm pagination inconsistency).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-319 (sibling deviation — both call for the shared factory fix).
- SUPERSEDES: none.
- CONFLICTS: none.

---

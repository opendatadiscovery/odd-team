## STRENGTHENS — Batch ZE (Search + Title + Relationship — 3 new paginated endpoint surfaces confirm the platform-wide pagination unbounded class)

**Three new class-level sidecars confirm REFACTOR-020's platform-wide PageParam/SizeParam unbounded pattern.** Where prior batches enumerated 15+ paginated endpoint surfaces (DataEntity, Alert, Tag, Term, Owner, DataSource, etc.), batch ZE adds: SearchController (4 paginated endpoints — getSearchResults, getFiltersForFacet, listed paginated paths), TitleController (`getTitleList`), RelationshipController (`getRelationships`).

**New surfaced_by entries (the 3 batch-ZE paginated surfaces)**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**Pagination unbounded on every paginated endpoint — `getSearchResults`, `getFiltersForFacet`.** Controller params `Integer page, Integer size` carry no `@Min`/`@Max`; OpenAPI `PageParam`/`SizeParam` have no `minimum:`/`maximum:`; the repository computes `OFFSET = (page - 1) * size` without clamping. A caller passing `size=1_000_000` triggers a single bounded-only-by-Postgres/network query; `page=0` produces a negative OFFSET (implementation-defined behaviour). Same pattern as batch L (`getDataEntityAlerts`), batch M (`getFiltersForFacet`), batch E (`getSearchResults`)."
- `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[1]+[2]` — covered by NEW REFACTOR-623 (the Title-specific instance; cross-link).
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**Page-zero boundary triggers HTTP 500/400, not a graceful empty page**: `(page - 1) * size` at ReactiveDataEntityRelationshipRepositoryImpl.java:79 produces a negative offset for page=0. The OpenAPI PageParam (components.yaml — not read; verified by grep) lacks a `minimum: 1` constraint; Spring's binding accepts page=0. A JavaScript-style 0-indexed caller (typical) hits an opaque error instead of the first page."

**Cross-batch refinement** (batch ZE's contribution to the platform-wide pattern):

The pattern is now confirmed across **18+ paginated endpoint surfaces** spanning every controller in the platform. The pattern's structural primitive is the inherited `ReactiveAbstractCRUDRepository.list(page, size, query)` at line 84-91:

```java
// ReactiveAbstractCRUDRepository.java:84-91 — the structural primitive
public Mono<Page<T>> list(int page, int size, String nameQuery) {
  return jooqQueryHelper
    .paginate(
      DSL.selectFrom(tableForList()).where(listCondition(nameQuery)),
      List.of(new OrderByField(idField, SortOrder.ASC)),
      (page - 1) * size,
      size)  // ← no Math.max(0, ...) on offset; no Math.min(size, MAX) on limit
    .map(...);
}
```

Every CRUD-style list endpoint inherits this. The platform's pattern is "validate at the OpenAPI component layer" (one change cascades to all consumers); the OpenAPI components (PageParam at `components.yaml:4213-4221` and SizeParam at `components.yaml:4222-4229`) DO NOT carry `minimum:` / `maximum:` constraints.

**The compound severity**:
- Per-endpoint severity is MEDIUM (typically) — bounded by directory cardinality
- Cross-cutting severity is HIGH — 18+ endpoints all share the gap; a single platform-wide fix (add `minimum: 1, maximum: 1000` to the OpenAPI PageParam/SizeParam) closes all of them

**The 3 batch-ZE additions**:
1. **SearchController** — 2 paginated endpoints (`getSearchResults`, `getFiltersForFacet`); the size cap matters more here than for typical CRUD because the result-set is the FULL CATALOG SEARCH (potentially millions of rows for a query that matches everything)
2. **TitleController** — 1 paginated endpoint (`getTitleList`); the size cap is the new REFACTOR-623 finding (the Title-specific instance with the page=0 boundary surfacing as HTTP 500)
3. **RelationshipController** — 1 paginated endpoint (`getRelationships`); the size cap matters because the LIMIT applies to a 6-table-JOIN query (data_entity + relationships + erd_relationship_details + graph_relationship + source-entity + target-entity + data_source + namespaces)

**Triangulation count**: REFACTOR-020 now triangulates across **18+ paginated endpoint surfaces** in the platform's controller layer. The fix scope was already platform-wide; batch ZE confirms three more sibling surfaces share the gap.

**Severity unchanged at HIGH on aggregate** (per the existing detail file's severity rationale: each instance is MEDIUM, but the cross-cutting nature elevates to HIGH). The maintainer's prescription (add `minimum: 1, maximum: 1000` to OpenAPI PageParam/SizeParam) remains the structural fix point.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-498 (getPopularTagList page/size sibling); REFACTOR-552 (Tag size cap sibling); REFACTOR-623 NEW (the Title-specific page=0 + unbounded-size instance).
- SUPERSEDES: none.
- CONFLICTS: none.

---

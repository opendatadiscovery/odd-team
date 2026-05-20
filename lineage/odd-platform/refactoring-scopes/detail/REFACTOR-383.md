## REFACTOR-383 — Tag `listDataEntityDtos` triple-fetched per single HTTP request — `DataEntityServiceImpl.java:622` + `DataEntityPermissionExtractor.java:67` + `TagActivityHandlerImpl.java:41` all call the same query for the same data entity during one request; no request-scoped cache

**Severity**: LOW
**Category**: performance-redundant-work (read amplification on detail-page render)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:performance.known_performance_gaps[0]`

**Description**: A single HTTP request rendering a data-entity detail page triggers THREE calls to `tagRepository.listDataEntityDtos(dataEntityId)` for the SAME data entity:
- `DataEntityServiceImpl.java:622` — detail-page assembly (the canonical read).
- `DataEntityPermissionExtractor.java:67` — policy evaluation (RBAC permission resolution).
- `TagActivityHandlerImpl.java:41` — activity-feed state capture.

Each call issues a fresh SQL query. No request-scoped cache (no `@Cacheable`, no Reactor `Context`-scoped memoization).

The cost is multiplied across multiple data-entity surfaces per request (e.g., a lineage page rendering 20 entities triggers 60 calls).

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:68-81` — the repository method
- `DataEntityServiceImpl.java:622` + `DataEntityPermissionExtractor.java:67` + `TagActivityHandlerImpl.java:41` — the three callers

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (the @ReactiveTransactional boundary asymmetry) PRESCRIBES list reads OUTSIDE TX. Reactor Context-scoped caching would compose with this architecture.

**Proposed remedy**:
1. **Reactor Context-scoped cache** — `DataEntityServiceImpl` fetches once into Context; downstream callers consume the cached result.
2. **`@Cacheable` with short TTL** — Caffeine cache keyed on `dataEntityId`, TTL ≈ 1 second; the three calls within a request all hit the cache.
3. **Refactor the call sites** — DataEntityServiceImpl fetches once and passes the result down to the extractor and activity-handler.

Option 3 is the cleanest architectural fix.

**Severity rationale**: LOW — performance-redundant-work; correctness preserved.

**Suggested backlog grouping**: `Performance-baseline sprint` — pair with REFACTOR-228 (the Term triple-re-query pattern), REFACTOR-385 (the Term permission-resolution cache gap).

---

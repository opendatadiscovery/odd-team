## REFACTOR-587 — `POST /api/datasources` does not refresh the FTS `search_entrypoint` vector on create — `updateSearchVectors` runs only on the `update` path; a newly registered data source is invisible to full-text search until its first data_entity is ingested

**Severity**: LOW
**Category**: missing-fts-cleanup (deferred search-discoverability)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management), P-01 (Data Discovery — full-text search)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:bugs_limitations_corner_cases.[5]` (LOW) — "**No FTS vector refresh on register** — `updateSearchVectors` is invoked only from `update`, not `create`" — evidence: `DataSourceServiceImpl.java:63-65` (the create return path has no `updateSearchVectors` call; cf. line 77/80 in `update` which does).
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:performance.known_performance_gaps.[0]` (LOW) — "No FTS vector refresh on register — `updateSearchVectors` runs only from `update` (`DataSourceServiceImpl.java:77/80`), so a newly registered data source is absent from full-text search until its first data_entity is ingested."

**Description**: `DataSourceServiceImpl.create` (lines 51-66, `@ReactiveTransactional`) inserts the `token`, optionally the `namespace`, and the `data_source` row, then returns the persisted `DataSource` — with NO call to `updateSearchVectors` (`DataSourceServiceImpl.java:127-136`). The `update` path (lines 68-83) DOES call `updateSearchVectors` (lines 77, 80). So a data source created via `POST /api/datasources` does not get its `search_entrypoint` FTS vector populated at creation time. The newly registered data source is absent from catalog full-text search until something else refreshes the vector — typically its first `data_entity` ingestion (the entity-side FTS rebuild picks up the join). For a data source registered manually and not yet ingested-against, this is a transient discoverability gap: the source exists in the Management → Datasources tab but does not surface in search.

**Primary source citations**:
- `DataSourceServiceImpl.java:51-66` (the `create` method — no `updateSearchVectors` call on the return path)
- `DataSourceServiceImpl.java:77,80,127-136` (the `update` path's `updateSearchVectors` — the contrast case)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-206 (synchronous search-index consistency — the FTS refresh is an awaited step inside the `@ReactiveTransactional` write boundary) describes the platform's stated design: a write that changes searchable tokens refreshes the index synchronously. The `create` path's omission is a deviation from that design — a data-source CREATE changes the set of searchable data sources but does not refresh the index. GAP-shaped — the deviation has no stated rationale; the create path simply does not do what the update path does.

**Proposed remedy**: Add a `updateChangedDataSourceVector` (or `updateSearchVectors`) call to `DataSourceServiceImpl.create`'s return path, inside the existing `@ReactiveTransactional` boundary — mirroring the `update` path. The change is small and brings the create path into line with ADR-CANDIDATE-206's synchronous-search-index-consistency design.

**Severity rationale**: LOW — a transient discoverability gap, self-healing on first ingestion. A manually-registered, not-yet-ingested data source is absent from search; once a collector reports against it the join-driven FTS rebuild closes the gap. Operator-observable only in the narrow window between manual registration and first ingestion.

**Suggested backlog grouping**: `PERF-NNN / SEC-NNN FTS-consistency` — pair with REFACTOR-582 (the data-source `delete`-path FTS omission) and REFACTOR-489 (the Tag `delete`-path FTS deviation); all three are deviations from ADR-CANDIDATE-206's synchronous-search-index design.

---

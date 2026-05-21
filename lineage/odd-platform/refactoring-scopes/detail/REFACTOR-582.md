## REFACTOR-582 — `DELETE /api/datasources/{id}` does NOT clear the data source's FTS `search_entrypoint` vector — unlike the `update` path which calls `updateSearchVectors`; a soft-deleted data source may remain full-text-searchable

**Severity**: MEDIUM
**Category**: missing-fts-cleanup (stale search result)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management), P-01 (Data Discovery — full-text search surface)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**The FTS `search_entrypoint` vector is not cleared on delete.** `DataSourceServiceImpl.delete` (lines 85-96) calls no `searchEntrypointRepository` method — unlike `update` (lines 127-136). Whether a soft-deleted data source still appears in catalog search depends entirely on whether the search query JOINs `data_source` with a `deleted_at IS NULL` predicate; if it does not, the soft-deleted source remains searchable."
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:downstream_side_effects` (the `db-write` "Does NOT clear the FTS search_entrypoint vector" side effect — "0 FTS rows cleared (1 stale row left)").
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:coupling` — "The delete is the ONLY data-source mutation that touches NO FTS vector. `create` relies on entity-side FTS rebuild, `update` calls `updateSearchVectors` explicitly (`DataSourceServiceImpl.java:127-136`), `delete` calls neither."

**Description**: `DataSourceServiceImpl.update` (lines 68-83) refreshes the FTS index synchronously inside its `@ReactiveTransactional` boundary via `updateSearchVectors` (lines 77, 80, 127-136 — `updateChangedDataSourceVector` + namespace-vector handling). `DataSourceServiceImpl.delete` (lines 85-96) — also `@ReactiveTransactional` — calls NO `searchEntrypointRepository` method. After a successful soft-delete, the `data_source`'s `search_entrypoint` row still carries the indexed name/oddrn tokens. Whether the soft-deleted data source still surfaces in catalog full-text search depends entirely on whether the search query's JOIN against `data_source` carries a `deleted_at IS NULL` predicate — a behaviour NOT determinable from this method's scope (pinned by probe `P-048`). If the search JOIN omits the predicate, the soft-deleted data source remains discoverable via search — a stale result an operator would not expect after deletion.

**Primary source citations**:
- `DataSourceServiceImpl.java:85-96` (the delete method — no `searchEntrypointRepository` call)
- `DataSourceServiceImpl.java:127-136` (the `update` path's `updateSearchVectors` — the contrast case)
- Probe `P-048` (`lineage/odd-platform/probes/P-048.yaml`) — pins whether the soft-deleted source remains searchable

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-206 (NEW batch X-TAGGING — synchronous search-index consistency: search-index refresh is an awaited step inside the `@ReactiveTransactional` write boundary) — that ADR's own "Note on the asymmetry" explicitly records the SAME deviation for the Tag `delete` path (REFACTOR-489). The data-source `delete` path is a SECOND instance of the same deviation: the platform's stated design (search-index consistency as a synchronous post-condition of a write) is honoured on the `update` path but NOT on the `delete` path. This is GAP-shaped — the deviation has no stated rationale.

**Proposed remedy**: Add a `searchEntrypointRepository`-vector-clear (or `updateChangedDataSourceVector` re-run, which would re-evaluate the now-soft-deleted row) call to `DataSourceServiceImpl.delete` inside the existing `@ReactiveTransactional` boundary — mirroring the `update` path. Verify (via P-048) whether the catalog search query already filters `data_source.deleted_at IS NULL`; if it does, this gap is latent (the stale vector is masked by the read-side filter) and the fix is defence-in-depth; if it does not, the fix is correctness-critical. Pair the fix with the Tag-delete REFACTOR-489 (the sibling deviation) so the platform's FTS-on-delete behaviour is made uniform.

**Severity rationale**: MEDIUM — potential stale search result; severity bounded by the unknown (P-048) of whether the catalog search query already filters soft-deletes. If the search query filters `deleted_at`, the impact is a dead-but-harmless `search_entrypoint` row; if it does not, a deleted data source remains discoverable.

**Suggested backlog grouping**: `SEC-NNN / DOC-NNN FTS-on-delete consistency` — pair with REFACTOR-489 (Tag delete-path FTS deviation). Both are deviations from ADR-CANDIDATE-206's synchronous-search-index-consistency design.

---

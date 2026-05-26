## REFACTOR-666 — DatasetFieldController's per-request DB round-trip via `DatasetFieldResourceExtractor.extractResourceId` runs the 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE every authorized request; no cache; for high-edit-frequency users (data-curators bulk-editing column metadata) this is one extra round-trip per request beyond the operation itself

**Severity**: LOW
**Category**: per-request-DB-round-trip-no-cache
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control, P-08 Performance]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[7]` (LOW) — "**Per-request DB round-trip via `DatasetFieldResourceExtractor.extractResourceId`** — every authorized request to `/api/datasetfields/{id}/...` issues a 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE the controller method executes. No cache. For high-edit-frequency users (data-curators bulk-editing column metadata via the UI), this is one extra DB round-trip per HTTP request beyond the actual operation."

**Statement**: Per ADR-CANDIDATE-224 NEW, every authorized request to `/api/datasetfields/{dataset_field_id}/...` (5 of 7 endpoints) runs `DatasetFieldResourceExtractor.extractResourceId` which calls `reactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId(fieldId)` — a 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) returning the parent `data_entity.id`. This round-trip happens BEFORE the controller method runs, on every authorized request, with NO cache.

For high-edit-frequency sessions (a data curator bulk-editing column metadata across hundreds of columns; an automation script issuing per-column requests), the extractor's round-trip doubles the DB load:
- N edit operations → N extractor round-trips + N operation round-trips = 2N round-trips

The 3-table join is index-supported (`dataset_field.id` → `dataset_structure.dataset_field_id` → `dataset_version.id` → `data_entity.oddrn` are all FK-indexed), so each round-trip is sub-millisecond at typical scale; the GAP is the round-trip COUNT (network latency + connection-pool acquire), not the per-query SQL cost.

**Evidence**:
- Extractor: `DatasetFieldResourceExtractor.java:21-27`
- Repository method: `ReactiveDatasetFieldRepositoryImpl.java:115-125`
- Architectural intent: ADR-CANDIDATE-224 NEW (parent-scoped authorization is deliberate)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-224 NEW** captures the architectural intent (parent-scoped authorization is the deliberate model). THIS REFACTOR captures the perf-side cost of the choice: per-request extractor round-trip is the price of the model; a cache would close the gap without changing the model.

**Proposed remedy**:
- **Option A (Caffeine cache)**: add a short-TTL local cache `Cache<Long, Long>` keyed on `dataset_field_id → parent data_entity_id`. TTL 60s; size cap 10K entries. Closes the gap with no model change. The cache invariant is sound — `dataset_field_id` → `data_entity_id` is immutable once written (field's parent doesn't change).
- **Option B (Redis cache)** — if the platform already has Redis, use it for cross-instance cache sharing. Higher cost for low gain at typical scale.
- **Option C (request-scoped attribute)** — cache within the request scope only (Reactor `Context` carries the resolved parent id). Closes the gap for the same request but not across requests. Limited value.

Option A is the simplest fix.

**Severity rationale**: LOW — perf-side gap; affects only high-edit-frequency sessions; the per-query cost is small (sub-millisecond) at typical scale; the gap surfaces at scale (data curators bulk-editing hundreds of columns).

**Suggested backlog grouping**: `Performance optimisation polish sprint` (paired with REFACTOR-221 — no index on `data_entity.view_count` — same shape: cache or index would close).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-224 NEW (the parent-scoped authz model — the cache complements the model).
- SUPERSEDES: none.
- CONFLICTS: none.

---

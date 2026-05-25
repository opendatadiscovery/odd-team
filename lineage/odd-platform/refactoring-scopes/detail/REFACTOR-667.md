## REFACTOR-667 — Data Quality Dashboard's JSONB path extract `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` is recomputed at every query — no functional index visible in the migration history; for a catalog with hundreds of thousands of data entities the index absence means each dashboard query does a Seq Scan + per-row JSONB extract

**Severity**: MEDIUM
**Category**: jsonb-no-functional-index
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality, P-08 Performance, P-10 Ingestion (JSONB schema)]

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:performance.known_performance_gaps.[0]` (MEDIUM) — "JSONB path extract on `DATA_ENTITY.specific_attributes` is recomputed at every query without a functional index — Seq Scan + per-row extract for a catalog with hundreds of thousands of data entities. A `CREATE INDEX ... ON data_entity ((specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'))` would convert this to an index scan."

**Statement**: The DQ dashboard query at `ReactiveDataQualityRunsRepositoryImpl.java:46-47` extracts the DQ-test category from a JSONB path:

```sql
-- ReactiveDataQualityRunsRepositoryImpl.java:46-47
DATA_ENTITY.SPECIFIC_ATTRIBUTES.cast(SQLDataType.JSONB)
  .get('DATA_QUALITY_TEST').get('expectation').get('category')
```

The JOOQ-generated SQL emits `specific_attributes -> 'DATA_QUALITY_TEST' -> 'expectation' ->> 'category'`. Postgres re-evaluates this expression PER ROW; without a functional index, the dashboard query does a Seq Scan over `data_entity` and a per-row JSONB extract.

For a catalog with hundreds of thousands of data entities (a realistic scale for enterprise ODD deployments), the absence of a functional index manifests as:
- Dashboard load time grows linearly with `data_entity` row count
- Every UI filter change triggers a fresh full scan (no caching at the controller — REFACTOR-605 cluster)
- The dashboard becomes operator-unusable at scale

The fix is a one-line migration:

```sql
CREATE INDEX IF NOT EXISTS ix_data_entity_dq_test_category
  ON data_entity ((specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'))
  WHERE specific_attributes->'DATA_QUALITY_TEST'->'expectation' IS NOT NULL;
```

The partial-index variant (with the WHERE clause) restricts the index to rows that ACTUALLY have a DQ-test category — typically a small subset of the catalog (the test entities themselves, type=JOB). The index is then small and fast to maintain.

A directory audit of the migration history (`grep -i 'CREATE INDEX.*specific_attributes' <odd-platform>/odd-platform-api/src/main/resources/db/migration/` 2026-05-25) returned no DQ-category-specific index. The gap is uncovered.

**Evidence**:
- JSONB extract: `ReactiveDataQualityRunsRepositoryImpl.java:46-47`
- Migration audit: no functional index on the path (verified 2026-05-25)
- Companion sidecar (`DataQualityFilters`) confirms no debounce on UI filter changes — the dashboard hits the endpoint on every keystroke, compounding the perf cost

**Existing-ADR-or-implied-prescription**: no governing ADR. The performance optimisation choice was not made at the schema layer.

**Proposed remedy**: add the partial functional index in a new migration. Test with `EXPLAIN ANALYZE` against a representative-scale dataset to confirm the index is used. Cross-link with REFACTOR-221 (no index on `data_entity.view_count`) — same shape; the platform's tendency to add indices reactively.

**Severity rationale**: MEDIUM — perf gap that manifests at scale; the dashboard is a load-bearing operator-facing surface; the no-debounce UI compounds the cost; a one-line migration closes it.

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (paired with REFACTOR-605 — low-severity dashboard polish — and REFACTOR-221 — index gaps).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-605 (DQ dashboard polish cluster); REFACTOR-221 (analogous index gap on view_count).
- SUPERSEDES: none.
- CONFLICTS: none.

---

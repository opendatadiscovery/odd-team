## REFACTOR-265 — FTS-vector recompute / UsageReport / OTLP all run UNCONDITIONALLY on every ingestion, even on no-op idempotent re-ingestions — wasted Postgres CPU + statistics-table write churn

**Severity**: MEDIUM
**Category**: performance-redundant-work
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[7,8,9]`
- `IngestionService.md:performance.known_performance_gaps[0,1,4]`

**Description**: Three FINALIZING-phase / MAIN-phase processors run on EVERY ingestion call regardless of whether the call's payload represents actual change:

1. **FTSVectorsIngestionRequestProcessor** (FINALIZING phase, lines 18-25): collects all `request.getAllEntities().filter(non-JOB_RUN).map(id)` and calls `recalculateVectors(idsToProcess)` UNCONDITIONALLY. A re-ingestion that changes nothing still triggers a full FTS recompute for every entity in the payload. The recompute is the entire entity tsvector (per `ReactiveSearchEntrypointRepositoryImpl.java:82` — confirmed batch H sidecar), not just the changed-field slice. For an idempotent collector re-running the same payload every 30s, this is wasted Postgres CPU on every tick.

2. **UsageReportIngestionRequestProcessor** (MAIN phase, lines 22-25): `shouldProcess` returns `true` UNCONDITIONALLY (line 23). Writes to `data_entity_statistics` on every call. A zero-delta re-ingestion writes redundant stats rows (or updates the same row to the same values).

3. **OTLPMetricServiceImpl.exportMetrics** (terminal step in `IngestionServiceImpl.ingest`, line 72; line 24-32 of OTLPMetricServiceImpl): the metric extraction is SYNCHRONOUS INSIDE the transaction. For zero-delta ingestion, the entire `List<MetricData>` is built in-memory via every `MetricExtractor` (potentially calling a separate DB) — even though the resulting metrics will be identical to the previous tick's.

The combined cost: a high-frequency idempotent collector (30s tick, same payload) burns CPU + IO across THREE processors on every tick, with no actual platform-state change. Operators paying for Postgres CPU + collector retries see linear cost scaling with collector tick frequency.

The architectural choice is "process every ingestion uniformly; don't optimise for the idempotent case." The rejected alternative is delta-aware processing — only run the FTS recompute / UsageReport / OTLP for entities whose meaningful fields changed. The cost: a delta-detection step (compare incoming payload to existing DB state) adds complexity but cuts the common-case redundant work.

**Primary source citations**:
- `FTSVectorsIngestionRequestProcessor.java:18-25` — no diff check; processes all entities every time
- `UsageReportIngestionRequestProcessor.java:22-25` — `shouldProcess` returns `true` unconditionally
- `OTLPMetricServiceImpl.java:25-31` — metric extraction synchronous in transaction
- `IngestionServiceImpl.java:72` — OTLP step inside the ingest chain
- composes with ADR-CANDIDATE-079 (three-phase chain) — the processors plug in here without delta-awareness

**Existing-ADR-or-implied-prescription**: none. ADR-CANDIDATE-079 codifies the chain structure; the per-processor `shouldProcess` predicate is the extension point for delta-awareness, but the three processors don't use it. The fix is per-processor refactoring within the existing chain.

**Proposed remedy**: Three composable fixes (one per processor):
1. **FTS-vector delta-awareness**: in `FTSVectorsIngestionRequestProcessor`, compare the entity's existing tsvector inputs (name, internal_name, description, type, namespace, datasource, tags, terms) to the incoming values; only re-vectorize entities whose inputs CHANGED. The cost: one additional SELECT to fetch existing inputs (or a hash comparison); benefit: high-frequency idempotent re-ingestions become near-free.
2. **UsageReport delta-awareness**: in `UsageReportIngestionRequestProcessor`, compute `newEntities + restoredEntities + deletedEntities` count delta; if zero, return Mono.empty() to skip the write.
3. **OTLP delta-awareness**: in `OTLPMetricServiceImpl.exportMetrics`, gate the metric build on whether the request's entity delta is non-zero; skip extraction (and the synchronous in-transaction work) for zero-delta calls.

The fixes are independent; each one optimises one processor. Together they reduce the per-tick cost for idempotent collectors from O(N entities × 3 processors) to O(0) — the steady-state cost is the dataSource row-lock + the entity existence-check.

**Severity rationale**: MEDIUM — performance cost scales with collector tick frequency × entity count × 3. For a typical large deployment (1000 entities, 30s ticks, 3-5 collectors), the platform processes ~1M-5M wasted unit-of-work operations per day. Postgres CPU + statistics-table contention compound.

**Suggested backlog grouping**: `Ingestion performance sprint` — pair with REFACTOR-208 (no payload streaming) and broader ingestion-throughput concerns.

---

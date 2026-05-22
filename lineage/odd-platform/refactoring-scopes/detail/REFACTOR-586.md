## REFACTOR-586 — `data_source` has no optimistic-lock version column — two concurrent `PUT /api/datasources/{id}` edits are last-writer-wins with no conflict detection; operator A's edit silently vanishes under operator B's concurrent edit

**Severity**: LOW
**Category**: race-condition (lost update — no optimistic locking)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:performance.known_performance_gaps.[0]` (LOW) — "no optimistic-lock version column on `data_source` — concurrent operator edits silently lose the earlier write; not a throughput gap, a correctness-under-concurrency gap" — evidence: `V0_0_1__init.sql:38-50` (no version column) + `DataSourceServiceImpl.java:71-82`.
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:stress_findings.resource_boundaries` — "Two concurrent PUTs to the same id each run `getDto` (no `FOR UPDATE` in the UI path ...), then UPDATE. The UI update is last-writer-wins: both transactions read the same baseline, both apply their full-form REPLACE, the later commit overwrites the earlier with no conflict detection (no optimistic-lock version column on `data_source` — `V0_0_1__init.sql:38-50`). No corruption, but a lost update."

**Description**: `DataSourceServiceImpl.update` (lines 68-83) is `@ReactiveTransactional` but reads the existing row via `dataSourceRepository.getDto(id)` with no `FOR UPDATE` lock (the `FOR UPDATE` variant `getIdByOddrnForUpdate` is ingestion-path-only per the `ReactiveDataSourceRepositoryImpl` sidecar). The `data_source` table (`V0_0_1__init.sql:38-50`) has NO version / `@Version` / `updated_at`-as-optimistic-token column used in the UPDATE's WHERE clause. Two operators editing the same data source concurrently both read the same baseline `DataSourcePojo`, both apply their full-form REPLACE (REFACTOR-585), and the later transaction's commit overwrites the earlier with no conflict signal — operator A's edit is silently lost. There is no `HTTP 409 Conflict`, no `If-Match`/ETag, no detect-and-retry. This is the SAME structural shape as REFACTOR-210 (no optimistic locking on `DataEntityPojo` — concurrent status PUTs race last-writer-wins) — a DIFFERENT table (`data_source` vs `data_entity`) with the SAME missing-optimistic-lock gap.

**Primary source citations**:
- `V0_0_1__init.sql:38-50` (the `data_source` table DDL — no version column)
- `DataSourceServiceImpl.java:68-83` (the `update` method — `getDto` with no `FOR UPDATE`, then UPDATE)
- `ReactiveDataSourceRepositoryImpl` sidecar (confirms `getIdByOddrnForUpdate`'s `FOR UPDATE` is ingestion-only; the UI `getDto` path is unlocked)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-073 (Selective `FOR UPDATE` on ingestion-read paths only — explicit-comment intent at the concurrent-write surface; user-driven mutation reads deliberately unfenced) — this ADR records that the platform DELIBERATELY does not fence user-driven mutation reads with `FOR UPDATE`. That makes the ABSENCE of a row lock a stated decision. But the absence of ANY conflict-detection mechanism (no optimistic-lock version column either) is NOT covered by ADR-CANDIDATE-073 — the ADR justifies not pessimistically-locking; it does not justify having no optimistic-concurrency control at all. The lost-update window is a gap the existing ADR leaves open.

**Proposed remedy**: For a low-frequency operator-edit endpoint the simplest mitigation is optimistic concurrency: add a version column (or use `updated_at`) to `data_source` and include it in the UPDATE's WHERE clause; a 0-row-matched UPDATE means a concurrent edit landed first → return HTTP 409 and let the client re-fetch. Alternatively support `If-Match`/ETag on the PUT. Given data-source edits are rare (operator-initiated, low-frequency), this is LOW priority — but worth a backlog item so the lost-update window is a known, tracked gap rather than silent.

**Severity rationale**: LOW — a correctness-under-concurrency gap, but data-source edits are infrequent operator actions; two operators editing the SAME data source within the same few-second window is uncommon. Not data-loss in the catastrophic sense — the row stays consistent — but operator A's intended change is silently discarded. Consistent with the LOW-to-MEDIUM rating of the sibling REFACTOR-210 (DataEntityPojo).

**Suggested backlog grouping**: `SEC-NNN / PERF-NNN concurrency hardening` — pair with REFACTOR-210 (the `data_entity` sibling); a uniform optimistic-locking convention across the operator-edit endpoints would close both.

---

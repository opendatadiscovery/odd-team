# ADR-CANDIDATE-220 — Data Quality Dashboard reads a DENORMALISED `DATA_ENTITY_TASK_LAST_RUN` table (one row per test, `task_oddrn` PRIMARY KEY) — pre-compute "latest run per test" at write time rather than aggregating over `data_entity_task_run` at query time

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-04 Data Quality, P-10 Ingestion]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[0]` (HIGH) — "**The dashboard reads a denormalised 'latest run per test' table rather than aggregating over the full task-run history at query time.** The endpoint joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95, 117-141`) — a table whose `task_oddrn` is `PRIMARY KEY` and whose state is maintained out-of-band by the ingestion path (`V0_0_45__last_runs_table.sql:7-25`). The decision is to PRE-COMPUTE 'latest run per test' at write time (denormalisation) rather than computing `DISTINCT ON (task_oddrn) ORDER BY end_time DESC` at every dashboard load."

**Decision statement**: Pre-compute "latest run per test" at write time (denormalisation) by maintaining `DATA_ENTITY_TASK_LAST_RUN` whose `task_oddrn` column is `PRIMARY KEY` — guaranteeing one row per test, holding `last_task_run_oddrn`, `end_time`, `status`. The dashboard's `getLatestDataQualityRunsResults` (the per-category-per-status count slice), `getLatestTablesHealth` (the table-health classification), and the per-entity `last_run_oddrn` resolutions all join this table directly. The architectural choice is throughput-driven: the dashboard query fires on every UI filter change with no debounce per the companion `DataQualityFilters` sidecar's performance.hot_paths; recomputing `DISTINCT ON (task_oddrn) ORDER BY end_time DESC` across `data_entity_task_run` (which grows linearly with ingestion volume — every test run produces a row, every ingestion cycle creates rows) would scale poorly. The denormalisation IS the decision; it changes the dashboard's semantic from "count of test runs by status" to "count of tests by their latest-run-status" (gap-side surfaced as REFACTOR-653 — the LSN-019 instance at the dashboard surface where the doc says "count of test runs" but the code computes "count of tests").

The migration that creates the denormalisation:
```sql
-- V0_0_45__last_runs_table.sql:7-13 (table creation)
CREATE TABLE data_entity_task_last_run (
  task_oddrn varchar(2048) PRIMARY KEY,
  last_task_run_oddrn varchar(2048) NOT NULL,
  end_time timestamp,
  status varchar(64)
);

-- V0_0_45__last_runs_table.sql:15-25 (back-fill at deploy)
INSERT INTO data_entity_task_last_run (task_oddrn, last_task_run_oddrn, end_time, status)
  SELECT DISTINCT ON (tr.task_oddrn)
    tr.task_oddrn, tr.oddrn AS last_task_run_oddrn, tr.end_time, tr.status
  FROM data_entity_task_run tr
  ORDER BY tr.task_oddrn, tr.end_time DESC
ON CONFLICT (task_oddrn) DO UPDATE SET ...;
```

The `PRIMARY KEY (task_oddrn)` is the architectural commitment: there is EXACTLY ONE row per test in this table. The ingestion path (`TaskRunIngestionRequestProcessor`) UPSERTs into this table on every task-run ingestion, maintaining the "latest" invariant out-of-band. Read paths (the dashboard + the per-entity test-report's last-run lookup) consume the denormalised state directly without recomputing.

**Wisdom test**: PASS. Three intent anchors:
1. **Schema-level intent** — the migration's `PRIMARY KEY (task_oddrn)` is an explicit positive choice. The maintainer COULD have made `(task_oddrn, end_time)` composite (multi-row history) but DELIBERATELY chose single-row-per-test.
2. **Back-fill semantics** — the migration's `DISTINCT ON (task_oddrn) ORDER BY end_time DESC` codifies what "latest" means at the schema level; the read paths inherit the semantic.
3. **Structural impact** — every dashboard render + every per-entity test-report's "last run" surface depends on this table being maintained. A maintainer who reverted the denormalisation (or changed it to multi-row) would silently change the dashboard's semantic AND the per-entity "last run" rendering.

**Operator-visible consequence**:
- Dashboard's "Test Results Breakdown" ring counts TESTS keyed on latest-run-status, NOT test runs (this is the operator-surprise that REFACTOR-653 captures — the doc and the SQL diverge in the same way they did for `listMostPopular` / LSN-019).
- Per-entity "last run" shows the row from this denormalised table; if the ingestion path fails to update this table (e.g., a partial commit), the dashboard would show stale data with NO ERROR signal.
- The trade-off accepted: dashboard query simplicity (O(1) per test via PK lookup) over correctness-under-replay (a manual DB fixup that updates `data_entity_task_run` but not `data_entity_task_last_run` silently de-syncs the dashboard).

**Existing ADR**: no direct overlap. **Composes with ADR-CANDIDATE-081** (JOB_RUN entities are events not state — separates `data_entity_task_run` from `data_entity`). The denormalisation here is the ALREADY-WRITTEN-OUT projection of the latest-event slice; ADR-081 governs the event-vs-state separation, this ADR governs the latest-event-as-state projection.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-653 NEW** — the LSN-019 instance: dashboard counts TESTS not RUNS contrary to the doc's "count of test runs" wording. This ADR captures the architectural intent; REFACTOR-653 captures the doc-vs-code divergence operators see.
- **REFACTOR-667 NEW** — no functional index on the JSONB `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` path. The denormalisation closes the data-side scan but the metadata-side scan remains.

**Proposed action**: Promote to `adrs/drafts/dq-dashboard-denormalised-last-run.md` (new ADR). Document:
1. The decision: the dashboard reads `DATA_ENTITY_TASK_LAST_RUN` (PK on `task_oddrn`, one row per test) NOT `DATA_ENTITY_TASK_RUN` (the event log).
2. The migration anchor: `V0_0_45__last_runs_table.sql` declares the PK + back-fill semantics.
3. The ingestion-side commitment: every task-run ingestion must UPSERT this table; failure to maintain it silently de-syncs the dashboard.
4. The semantic implication: dashboard ring labels say "test runs" but the count is "tests keyed on latest run" (the LSN-019 instance — surface REFACTOR-653).
5. The doc-side gap: the live dashboard page should clarify the semantic (single-row-per-test, latest-run-status counted).

**Severity rationale**: HIGH — schema-level architectural choice with structural impact across the entire dashboard surface + the ingestion-side write contract. The denormalisation is the dashboard's load-bearing primitive. A future maintainer considering "let's compute latest from the event log directly" would be undoing this choice; the ADR is the explicit defence.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-081 (JOB_RUN as events); the denormalisation is the read-side projection of the event log.
- SUPERSEDES: none.
- CONFLICTS: none. The dashboard doc is silent on "latest run" semantics; the doc page sits in the operator's responsibility (REFACTOR-600 cluster).

---

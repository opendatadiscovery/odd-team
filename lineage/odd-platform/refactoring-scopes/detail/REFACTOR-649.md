## REFACTOR-649 — DataEntityRunController returns HTTP 500 mid-flight: the runs-history endpoint mapper fails on any result-set row whose status is `RUNNING` because the wire enum `DataEntityRunStatus` has 6 values but the DB column `data_entity_task_run.status` accepts 7

**Severity**: HIGH
**Category**: wire-enum-asymmetry
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality, P-10 Ingestion (the RUNNING value's source), P-11 Platform API (response contract)]

**Surfaced by**:
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**Wire enum vs DB enum asymmetry** — DB column `data_entity_task_run.status` accepts the seven-value `IngestionTaskRunStatus` enum (SUCCESS|FAILED|SKIPPED|BROKEN|ABORTED|RUNNING|UNKNOWN, IngestionTaskRun.java:28-36) but the wire enum `DataEntityRunStatus` declares only six values (RUNNING is missing, components.yaml:1407-1415). The DataEntityRunMapper flat-maps the String → wire enum target; MapStruct's String-to-enum conversion uses `Enum.valueOf()` which throws on unknown literals. Hypothesis: the runs-history endpoint returns HTTP 500 for any result set containing a RUNNING row — making the page UNAVAILABLE exactly while a test is in flight."

**Statement**: The runs-history endpoint at `GET /api/dataentities/{id}/runs` returns HTTP 500 whenever the result set contains a row whose `data_entity_task_run.status = 'RUNNING'`. The bug emerges from a SEVEN-vs-SIX enum-value asymmetry between the DB schema and the wire schema:

- **DB column** (`data_entity_task_run.status`) accepts seven values from `IngestionTaskRunStatus` (`IngestionTaskRun.java:28-36`):
  - `SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | RUNNING | UNKNOWN`
- **Wire enum** (`DataEntityRunStatus`) declares six values (`components.yaml:1407-1415`):
  - `SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN`  ← RUNNING missing

The `DataEntityRunMapper.java:13-14` flat-maps the String `status` column to the wire enum target via MapStruct's default String-to-enum conversion (`MapperConfig.java:7-13`). MapStruct uses `Enum.valueOf()`, which throws `IllegalArgumentException` on unknown literals (e.g., `"RUNNING"`).

The operator-visible failure mode: the runs-history page silently fails (HTTP 500) the MOMENT a test starts running — i.e., the moment the operator most wants to see it. The page works for all-completed result sets but breaks when in-flight rows are returned. The status-filter query parameter (`status=SUCCESS`) avoids the bug for filtered queries (RUNNING rows are excluded by the WHERE clause); the unfiltered listing (the default UI view) is exposed.

**Evidence**:
- DB enum: `IngestionTaskRun.java:28-36` (the seven-value enum)
- Wire enum: `components.yaml:1407-1415` (the six-value declaration — RUNNING missing)
- Mapper: `DataEntityRunMapper.java:13-14` (flat-map via default config) + `MapperConfig.java:7-13` (MapStruct config — String-to-enum uses Enum.valueOf)
- SQL filter: `ReactiveDataEntityTaskRunRepositoryImpl.java:166-168` (status filter applied only when supplied; null status returns ALL rows including RUNNING)
- Hypothesis emitted as probe `lineage/odd-platform/probes/P-151.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR. ADR-CANDIDATE-221 NEW (closed enum + UNKNOWN catch-all + always-padded response) governs the DQ-DASHBOARD's enum shape; this REFACTOR is the SYMMETRIC gap on the PER-ENTITY-RUNS path — the same enum-completeness commitment was NOT made on the wire schema for `DataEntityRunStatus`.

**Proposed remedy**:
- **Option A (preferred — wire-schema completion)**: add `RUNNING` to `DataEntityRunStatus` enum in `components.yaml`. Update UI consumers to render RUNNING with an in-flight indicator (cross-reference REFACTOR-650 — NULL end_time + RUNNING-at-top is already implicit in the SQL ordering).
- **Option B (mapper resilience)**: configure MapStruct to map unknown String values to UNKNOWN via `@ValueMapping(source = MappingConstants.ANY_REMAINING, target = "UNKNOWN")` on the wire enum. Catches future schema drift without requiring wire-schema changes.
- **Option C (server-side filter)**: hard-filter `STATUS != 'RUNNING'` in the repository for the runs-history endpoint. Hides RUNNING rows entirely; operator loses visibility into in-flight runs.

Option A is the operator-friendly fix; Option B is the defence-in-depth backstop.

**Severity rationale**: HIGH — silently-broken page during in-flight tests (the operator's highest-need moment); the failure is HTTP 500 not a graceful 4xx; no test catches it (the repository tests cover only completed runs).

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (paired with REFACTOR-592 — palette throws on unknown status — which is the SYMMETRIC defence-gap on the UI side).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-592 (the UI-side defence has the same shape — palette indexed by status enum; unknown value blanks the dashboard). The wire schema, the mapper, the UI palette form a three-layer trust chain; adding RUNNING requires coordinated update across all three.
- SUPERSEDES: none.
- CONFLICTS: none.

---

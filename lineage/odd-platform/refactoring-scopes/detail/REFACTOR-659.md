## REFACTOR-659 — DataSetController's "Latest" endpoint computes `max(DATASET_VERSION.VERSION)` not `max(created_at)`; correct under normal ingestion (`version` monotonic per `DatasetStructureIngestionRequestProcessor.incrementDatasetVersion`) but diverges after manual SQL fixup / replay / backfill

**Severity**: LOW
**Category**: latest-by-version-not-time
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (dataset structure), P-10 Ingestion (the monotonicity invariant)]

**Surfaced by**:
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[3]` (LOW) — "**'Latest' = max(version), not max(created_at)**: `getLatestDatasetVersion` (ReactiveDatasetVersionRepositoryImpl.java:160-217) computes `max(DATASET_VERSION.VERSION).as('dsv_max')` in a subquery joined back to the row with that version. In normal ingestion (DatasetStructureIngestionRequestProcessor.java:171-178: `version.getVersion() + 1`), this matches the latest-by-time. After manual SQL fixup / replay / backfill, the highest-version row may have an older `created_at` than another row; the endpoint returns the version-max row."

**Statement**: `GET /api/datasets/{id}/structure` (no version_id supplied) returns the "latest" dataset version. The implementation computes:

```sql
-- ReactiveDatasetVersionRepositoryImpl.getLatestDatasetVersion (lines 160-217)
SELECT * FROM dataset_version
WHERE dataset_oddrn = (SELECT oddrn FROM data_entity WHERE id = :datasetId)
  AND version = (SELECT max(version) FROM dataset_version WHERE dataset_oddrn = ...)
```

The "latest" key is `max(version)`, NOT `max(created_at)`. Under normal ingestion, the two are equivalent because `DatasetStructureIngestionRequestProcessor.incrementDatasetVersion` monotonically increments version by `+1` per ingestion cycle (`DatasetStructureIngestionRequestProcessor.java:171-178`):

```java
return new DatasetVersionPojo(...)
    .setVersion(latestVersion.getVersion() + 1)
    .setCreatedAt(LocalDateTime.now());
```

The invariant `higher_version ↔ later_created_at` holds at runtime; the endpoint returns the operator-expected "most-recently-ingested" row. The invariant CAN be violated by manual interventions:
- **Manual SQL fixup** — an operator inserts a row with version=99 to repair a gap; the `created_at` is set to `now()` but version=99 may be lower than other live rows' versions.
- **Replay** — an ingestion pipeline replays old events; the version counter resumes from an older state.
- **Backfill** — historical data ingested as backfill with explicit version numbers.

Under any of these, `max(version)` returns a row whose `created_at` is NOT the most recent. Operators using the endpoint with the expectation 'most-recently-ingested' see the wrong row.

The doc-side gap: the live `https://docs.opendatadiscovery.org/features/data-discovery/schema-diff` page does NOT define "latest"; the operator cannot tell the convention without reading the SQL.

**Evidence**:
- Latest SQL: `ReactiveDatasetVersionRepositoryImpl.java:160-217` (`max(version).as('dsv_max')`)
- Monotonic increment invariant: `DatasetStructureIngestionRequestProcessor.java:171-178` (`version + 1`)
- Doc page silent on "latest" definition: WebFetch 2026-05-25 status 200
- Hypothesis: `lineage/odd-platform/probes/P-148.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR. The "latest" semantic is implicit in the SQL.

**Proposed remedy**: one or more of:
- **(a) Doc-side fix**: explicitly state "Latest = the version with the highest numeric version, NOT max(created_at)" on the schema-diff doc page. Operators making manual fixups know what they're committing to.
- **(b) Add a tie-breaker / verification** — return the row matching both `max(version)` AND `version_created_at >= all other version_created_at`; if mismatch, log a warning. Detects monotonicity violations.
- **(c) Switch to max(created_at)** — change the SQL to `ORDER BY created_at DESC LIMIT 1`. Matches operator expectation but changes the semantic under replay (a backfilled-yesterday row with version=1 becomes "latest" the moment the backfill commits).

Option (a) is the smallest change.

**Severity rationale**: LOW — semantic-ambiguity edge case; affects only manual-intervention scenarios; runtime monotonicity invariant makes this invisible during normal operation.

**Suggested backlog grouping**: `DataSet API hygiene sprint` (paired with REFACTOR-657 — cross-dataset leak — and REFACTOR-658 — 500-not-404).

**Coherence check** (LSN-018):
- STRENGTHENS: none directly.
- SUPERSEDES: none.
- CONFLICTS: none.

---

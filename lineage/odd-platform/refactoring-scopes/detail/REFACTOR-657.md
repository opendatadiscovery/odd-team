## REFACTOR-657 — DataSetController's `dataEntityId` path parameter is documentation-only: the SQL filters by `versionId` only; an authenticated user can request `/api/datasets/X/structure/V` with V belonging to dataset Y and get Y's structure back (cross-dataset structure leak)

**Severity**: HIGH
**Category**: cross-dataset-leak
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (dataset structure), P-09 Security & Access Control, P-05 Lineage (dataset structure participates in diff visibility)]

**Surfaced by**:
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**dataEntityId path parameter is documentation-only** (Category F drift): controller accepts `dataEntityId` but it is consumed and dropped by `DatasetController.getDataSetStructureByVersionId` (line 28-30) — only `versionId` reaches `reactiveDatasetVersionRepository.getDatasetVersion` (ReactiveDatasetVersionRepositoryImpl.java:129) which filters by `DATASET_VERSION.ID.eq(datasetVersionId)`. Any authenticated user can request `/api/datasets/X/structure/V` with V belonging to dataset Y and get Y's structure back."
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[6]` (HIGH) — "**`getDatasetVersionWithFields` does not constrain by dataset**: the SQL at ReactiveDatasetVersionRepositoryImpl.java:149-156 is `WHERE DATASET_VERSION.ID.in(datasetVersionIds)` with no `dataset_oddrn` predicate; this is the SQL-level confirmation of the Category F drift recorded above."

**Statement**: Three of the four endpoints on `DataSetController` accept `dataEntityId` as a path parameter (`/api/datasets/{data_entity_id}/structure[/{version_id}|/diff|/relationships]`) but the SQL does NOT cross-check the `dataEntityId` against the supplied `version_id`. The endpoints affected:

1. **`getDataSetStructureByVersionId`** (`DatasetController.java:22-31`):
   - URL: `GET /api/datasets/{data_entity_id}/structure/{version_id}`
   - Service: `DatasetVersionServiceImpl.getDatasetVersion(datasetId, datasetVersionId)` uses `datasetId` only in the 404 error message (line 41-43); never passes it to SQL
   - Repository: `ReactiveDatasetVersionRepositoryImpl.getDatasetVersion(datasetVersionId)` filters by `DATASET_VERSION.ID.eq(datasetVersionId)` only — NO `dataset_oddrn` predicate

2. **`getDataSetStructureDiff`** (`DatasetController.java:43-50`):
   - URL: `GET /api/datasets/{data_entity_id}/structure/diff?firstVersionId=...&secondVersionId=...`
   - Service: `DatasetVersionServiceImpl.getDatasetVersionDiff(dataEntityId, firstVersionId, secondVersionId)` discards `dataEntityId` entirely (not even in the error message)
   - Repository: `ReactiveDatasetVersionRepositoryImpl.getDatasetVersionWithFields(List.of(firstVersionId, secondVersionId))` filters `DATASET_VERSION.ID.in(...)` only

3. **`getDataSetStructureLatest`** (`DatasetController.java:33-41`):
   - URL: `GET /api/datasets/{data_entity_id}/structure`
   - This endpoint DOES use `dataEntityId` — the subquery at `ReactiveDatasetVersionRepositoryImpl.java:166-167` joins DATA_ENTITY on ODDRN and filters `DATA_ENTITY.ID.eq(datasetId)`. The "latest" endpoint is correct; the leak applies to the OTHER THREE endpoints.

Operator-visible failure modes (cross-dataset enumeration via sequential `bigserial` version ids):
- **(a)** Request `/api/datasets/X/structure/V` with V belonging to Y → response 200 with Y's structure (column names, types, descriptions, tags, terms, lookup-table definitions). NO error, NO indication that V is not in X.
- **(b)** Request `/api/datasets/X/structure/diff?first=V1&second=V2` with V1∈Y, V2∈Z → response 200 with a cross-dataset diff body. The per-field statuses (CREATED / DELETED / NO_CHANGES / UPDATED) are computed across two unrelated datasets' fields → meaningless-but-200 response.
- **(c)** An authenticated user iterating `version_id=1, 2, 3, ...` reads every dataset's structure at every version.

The leak is the SQL-level confirmation of the Category F drift class (input-name-vs-implementation drift). The available-but-unused column is `DATASET_VERSION.DATASET_ODDRN` — already in the schema, already selected by adjacent queries, already joinable. A one-line predicate closes the leak:

```sql
-- closes the by-id leak
AND DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)

-- closes the diff leak (analogous predicate on both ids)
AND DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)
```

**Evidence**:
- Controller: `DatasetController.java:22-50`
- Service: `DatasetVersionServiceImpl.java:38-64`
- Repository (by-id): `ReactiveDatasetVersionRepositoryImpl.java:97-144`
- Repository (diff): `ReactiveDatasetVersionRepositoryImpl.java:147-157`
- Repository (latest — the correct counterpart): `ReactiveDatasetVersionRepositoryImpl.java:160-217`
- Hypothesis: `lineage/odd-platform/probes/P-147.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR. The Category F drift is unguarded. Compounds with REFACTOR-024 family (cross-owner read posture) — even WITHOUT the cross-dataset leak, any authenticated user reads any dataset's structure; the cross-dataset leak adds the SECOND-level enumeration vector (by-version-id enumeration).

**Proposed remedy**: add the `DATASET_VERSION.DATASET_ODDRN = (SELECT ODDRN FROM DATA_ENTITY WHERE ID = :datasetId)` predicate to BOTH the by-id and diff queries. Two-line change. Add integration tests that submit `dataEntityId=X, versionId=V_of_Y` and assert HTTP 404 (or 400 — the operator-friendly choice). Cross-link REFACTOR-008 (the `/term` vs `/terms` path-mismatch) for the systemic-fix question: should there be a CI check that walks the controller's path parameters against the SQL's predicates and flags discarded variables?

**Severity rationale**: HIGH — cross-dataset data-exposure leak; the leaked payload is schema metadata (column names, types, descriptions, tags, terms, lookup-table definitions) but the cross-dataset enumeration vector is general; combined with sequential version_ids the leak is fully discoverable.

**Suggested backlog grouping**: `Authorization audit batch` (paired with REFACTOR-024 family, REFACTOR-008 path-mismatch, REFACTOR-009 systemic-fix).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-024 (cross-owner read family — this leak is the SECOND-level enumeration vector on a surface already cross-owner-readable); REFACTOR-008 (analogous SECURITY_RULES path-mismatch — same systemic root cause: controller-vs-SQL drift).
- SUPERSEDES: none.
- CONFLICTS: none.

---

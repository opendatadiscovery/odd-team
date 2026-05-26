# SHB-007 — Dataset Schema Revision History (per-version structure + diff + cross-dataset version-id leak)

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators see a per-dataset "Revision History" surface (Structure tab + Compare tab) that lets them inspect any historical schema revision and diff any two revisions, computed by `DatasetVersionService` against `dataset_version` rows that the ingestion pipeline monotonically auto-increments per re-ingest. The feature is operator-essential — schema-diff is the primary tool for downstream-impact analysis after a breaking change — and is documented at `/features/data-discovery/schema-diff` (verified 2026-05-25 status 200). As of 2026-05-26 there is NO F-NNN anchored on this; F-022 covers the per-test DQ report flow but not dataset version diffs. AND there are TWO HIGH-severity correctness defects shared across all four `/api/datasets/{id}/structure*` endpoints: (1) the `data_entity_id` path component is **documentation-only** — the SQL filters by `version_id` only, so any authenticated user can read any dataset's schema by guessing version-ids; (2) "Latest" means `max(version)` not `max(created_at)`, which diverges silently after manual SQL fixup or replay.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DatasetController.java:22-50` — four GET endpoints under `/api/datasets/{data_entity_id}/...`: get-by-version-id, get-latest, diff-two-versions, list-relationships.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:129` — the by-id path filters `DATASET_VERSION.ID.eq(datasetVersionId)` ONLY. `dataEntityId` is consumed by the controller and dropped before reaching SQL.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:147-157` — the diff path uses `DATASET_VERSION.ID.in(List.of(firstVersionId, secondVersionId))` — same issue, doubled.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetVersionServiceImpl.java:69-71` — the diff endpoint throws bare `RuntimeException("Query returned %s rows for diff request")` when one or both ids don't exist → ControllerAdvice maps to 500. Identical-version-ids gets a clean `BadUserRequestException` → 400. Asymmetric error model.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDatasetVersionRepositoryImpl.java:160-217` — `getLatestDatasetVersion` computes `max(DATASET_VERSION.VERSION).as('dsv_max')` in a subquery, joins back. `created_at` exists but is not referenced.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/processor/DatasetStructureIngestionRequestProcessor.java:171-178` — the ingestion path `version.getVersion() + 1` is the monotonic-version assumption; "Latest" works correctly under normal ingestion but diverges under manual SQL fixup / replay.
- Live doc: `https://docs.opendatadiscovery.org/features/data-discovery/schema-diff` (verified 2026-05-25 status 200) — describes the feature ("Every re-ingest of a dataset that changes the structure creates a new revision. The revision history is browsable per dataset: pick any two revisions to see exactly what changed between them.").
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DataSetController__controller-class__DataSetController.md` (full sidecar with the Category F drift documented).

## Notes

- **Cross-dataset version_id leak (HIGH)**: `GET /api/datasets/X/structure/V` where V belongs to dataset Y returns Y's structure with HTTP 200. Schema payload includes: field names + types + descriptions + tags + terms + lookup-table definitions. Not row data, but the schema IS metadata the platform is supposed to scope. Same shape as REFACTOR-024 cross-owner read family but at a worse layer (the URL falsely IMPLIES dataset scoping that the implementation doesn't enforce).
- **Cross-dataset diff (HIGH)**: `GET /api/datasets/X/structure/diff?first=V1&second=V2` where V1 and V2 belong to different datasets returns a 200 with a "diff" body — every field appears as CREATED or DELETED depending on which dataset's side it lives. Nonsensical-but-200 response.
- **"Latest" silent semantics**: ingestion uses `version + 1` so highest-version = most-recently-created in NORMAL flow. After manual SQL fixup (operator inserting an older-revision row at a higher version number) or replay (collector re-ingesting an old version), `max(version)` and `max(created_at)` diverge. Operators reading `/structure` (no version_id) get the max-version row, which may be misleading.
- **500-vs-404 asymmetry on diff endpoint**: missing version_ids → 500 (bare `RuntimeException`). Identical version_ids → 400 (typed `BadUserRequestException`). Operators can't distinguish "platform broken" from "wrong id."
- **The fix for the cross-dataset leak is small**: `DATASET_VERSION.DATASET_ODDRN` is already SELECTed by the latest-version path and is FK-joinable to `DATA_ENTITY.ODDRN`. Adding `.and(DATASET_VERSION.DATASET_ODDRN.eq(select dataset.oddrn from data_entity where id = :datasetId))` predicate to `getDatasetVersion(versionId)` and `getDatasetVersionWithFields(ids)` closes the leak in two places.
- **Diff endpoint loads 2 versions' full field lists in-memory** with recursive `getParentOddrnChangedPojos` (DatasetVersionServiceImpl.java:156-180); no streaming, no pagination, no row-count guard — for pathological nested schemas (10K+ fields) this is a memory-bound operation.
- **Authorization gap**: no SecurityRule entry for `/api/datasets/*/structure*` or `/api/datasets/*/relationships` in `SecurityConstants` → catch-all `.authenticated()` only. Cross-owner read of any dataset's schema by any authenticated user; under `auth.type=DISABLED` it's anonymous.
- **The feature page `/features/data-modelling/relationships` claims "role-based visibility"** but the code path implements no role filter. Doc overstates the security model.

## Next

1. **Graduate** to `F-NNN — Dataset Schema Revision History` (P-01 Data Discovery / Schema dimension). Primary subjects: `DatasetController` (4 GETs), `DatasetVersionServiceImpl`, `ReactiveDatasetVersionRepositoryImpl.{getDatasetVersion,getDatasetVersionWithFields,getLatestDatasetVersion}`, `DatasetVersionHashCalculator`. Pillars include P-01 + the schema-management surface.
2. **REFACTOR-NNN — HIGH** — close the cross-dataset version_id leak: add `DATASET_VERSION.DATASET_ODDRN` predicate to the by-id and diff SQL paths. 2-3 line fix; eliminates the Category F drift.
3. **REFACTOR-NNN — MEDIUM** — fix the diff endpoint's 500-vs-404 asymmetry: throw `NotFoundException` (→ 404) when the version-id list returns fewer than 2 rows, instead of bare `RuntimeException`.
4. **REFACTOR-NNN — LOW** — document "Latest" semantics in the schema-diff doc page, OR change `getLatestDatasetVersion` to order by `created_at` and break ties on `version` (more robust under replay).
5. **TEST-NNN — HIGH** — `DatasetVersionDiffTest` covers happy-path; add negative tests for (a) cross-dataset version-id (currently 200, after fix 404), (b) non-existent version-id on diff (currently 500, after fix 404), (c) latest-after-manual-fixup ordering.
6. **DOC-NNN** — the `/features/data-modelling/relationships` page overstates security ("role-based visibility"); the code path implements no role filter. Either fix the docs or implement the gate.

## Links

- cluster_with: []
- merged_into: (open)
- supersedes: []

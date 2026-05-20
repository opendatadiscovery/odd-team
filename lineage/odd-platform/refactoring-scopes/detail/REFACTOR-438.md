## REFACTOR-438 — `dataset_field` orphan accumulation (no soft-delete + no cleanup job + version-by-reference compounding)

**Severity**: MEDIUM
**Category**: monotonic-table-growth / no-housekeeping
**Batch**: R (2026-05-20)
**Pillars affected**: [P-01-data-discovery (schema diff sub-feature), P-10-integrations-ingestion]

**Surfaced by**:
- `ReactiveDatasetFieldRepositoryImpl.md:bugs_limitations_corner_cases.[0]` (MEDIUM): "`delete(id)` / `delete(ids)` inherited from `ReactiveAbstractCRUDRepository` issue HARD DELETE on dataset_field rows, but no caller in the platform invokes them — there is also NO scheduled orphan-cleanup job. Schema-change forks leave the OLD dataset_field row in place, still referenced by the OLD dataset_structure row + the OLD dataset_version row. Over many ingestion cycles on a churning dataset, the `dataset_field` table grows monotonically. PG row count for a heavily-evolving dataset can be substantially larger than the current column count × ingestion-versions kept."
- `ReactiveDatasetFieldRepositoryImpl.md:known_performance_gaps.[3]` (MEDIUM): same finding from performance lens — "Orphan dataset_field rows accumulate monotonically — no scheduled cleanup of rows whose dataset_structure links are gone (or whose dataset_version is soft-deleted). For a heavily-evolving dataset, the table grows over time without ceiling. Read paths walking the table (`listByTerm`) pay an increasing cost over the system's lifetime."
- `ReactiveDatasetFieldRepositoryImpl.md:concepts.invariants.[0]` (HIGH): "dataset_field has NO native soft-delete column. Verified by V0_0_1__init.sql:148-164 defining the schema … and every subsequent ALTER TABLE dataset_field migration adding only `internal_name` / `reference_oddrn` / `default_value` / `is_primary_key` / `is_sort_key` — none adds `deleted_at` or `is_deleted` or `status`."

**Statement**: The dataset_field table has NO native soft-delete column (no `deleted_at`, no `is_deleted`, no STATUS — sweep-verified across V0_0_1__init.sql:148-164 + every subsequent ALTER TABLE migration) and the codebase has NO caller that invokes the inherited hard-delete methods. ADR-CANDIDATE-147 commits the schema to versioning-by-reference (NEW row on hash-diff), which is the correct architecture for schema-diff feature support; the GAP is the absence of a cleanup mechanism for rows whose dataset_structure links are gone (or whose linked dataset_versions are past retention).

**Operator-side consequences**:
- For a heavily-evolving dataset (e.g. a feature-engineering table with frequent column renames or type changes), the dataset_field table grows monotonically across ingestion cycles. A 200-column table with weekly schema changes over 5 years could accumulate 200 × 260 = 52,000 dataset_field rows where only 200 are "live".
- Read paths walking the table (`listByTerm` lines 141-204, the catalog-wide cross-owner enumeration) pay an increasing cost over the system's lifetime
- No housekeeping job references `DATASET_FIELD` (sweep-verified — no `*housekeeping*` class imports DATASET_FIELD or DATASET_STRUCTURE)
- `EmptyPartitionsHousekeepingJob` does NOT apply (dataset_field is not partitioned)
- The platform's storage forecast for any operator running many years would benefit from a known dataset_field growth rate; today it's emergent and bounded only by how active the schema-diff usage is

The negative-space relationship to ADR-CANDIDATE-147: that ADR commits to versioning-by-reference (the SCHEMA decision); this scope is the OPERATIONAL gap (no cleanup mechanism). The two are connected: the schema-evolution-as-new-row pattern is correct for schema-diff history, but operationally requires either (a) accept the growth, (b) cap retention, or (c) provide an admin-cleanup path.

**Evidence**:
- `ReactiveAbstractCRUDRepository.java:144-155` — inherited hard-delete methods (`delete(id)` / `delete(ids)`) exist as the CRUD contract
- sweep — no caller in the platform invokes `datasetFieldRepository.delete(...)` (DatasetFieldServiceImpl never calls delete; the housekeeping jobs don't either)
- `DatasetFieldServiceImpl.java:375-396` — hash-diff partition creating NEW rows on every schema change
- sweep — no `*housekeeping*` scheduled job referencing `DATASET_FIELD` or `DATASET_STRUCTURE`
- `V0_0_1__init.sql:148-164` + every subsequent `ALTER TABLE dataset_field` migration — no soft-delete column added
- `ReactiveDatasetFieldRepositoryImpl.java:141-204` — `listByTerm` walks ALL dataset_field rows (no filter to live-only)

**Existing-ADR-or-implied-prescription**: Companion to ADR-CANDIDATE-147 (versioning-by-reference is the architectural commitment; this gap is the negative-space consequence). No ADR mandates a cleanup mechanism today; the gap is silent at the doc-site.

**Proposed remedy**:
1. Add a `housekeeping.dataset-field.orphan-cleanup-enabled: true` configuration property + `housekeeping.dataset-field.retain-versions: N` (operator-tunable; default N=10 keeps the last 10 dataset_versions per parent data_entity)
2. Implement `DatasetFieldOrphanHousekeepingJob` that:
   - For each `data_entity` with `entity_class` containing DATASET, identifies the latest N dataset_version rows
   - Identifies dataset_field rows that are NO LONGER referenced by any retained dataset_structure link
   - Issues hard-DELETE on those orphan dataset_field rows
   - Optionally: delete the no-longer-needed dataset_structure rows referencing them
3. The cleanup also runs for soft-deleted data_entity rows (per DataEntityHousekeepingJob TTL — when the parent is purged, its entire schema history can go)
4. Schedule the cleanup at the existing housekeeping cadence (15-minute or daily)
5. Pre-cleanup safety: dataset_field rows referenced by `DATASET_FIELD_TO_TERM` (operator-glossary linkage) require explicit handling — either keep them (preserves the term association) or break the link (loses the term-history)
6. Document the cleanup policy on `features/data-discovery/dataset-schema-diff` (today the doc-site implies infinite history; the operator should know the retention)

**Severity rationale**: MEDIUM — manifests at multi-year deployments on churning datasets; not silent-data-loss class (no operator data lost), but silent-storage-growth that becomes operationally lethal at scale. The fix is bounded (one housekeeping job + one config knob).

**Suggested backlog grouping**: "Schema-evolution housekeeping" — together with REFACTOR-436 (metadata_field soft-delete-recovery) and REFACTOR-441 (activity-table monotonic growth) — all three are silent-storage-growth findings within the platform's per-table-housekeeping policy.

---

## ADR-CANDIDATE-147 — Dataset_field rows are VERSIONED BY REFERENCE, not by mutation — a column's evolution = NEW dataset_field row + NEW dataset_structure link; the M:N normalization in V0_0_9 is the structural commitment

**Severity**: HIGH
**Classification**: promote (NEW ADR; SCHEMA-ROOTED architectural commitment + service-tier hash-diff dispatch)
**Pillars affected**: [P-01-data-discovery (schema diff sub-feature), P-07-active-platform-features (schema-change alerts), P-10-integrations-ingestion]
**Support count**: 1 sidecar primary-source (batch R ReactiveDatasetFieldRepositoryImpl) + service-tier corroboration (DatasetFieldServiceImpl hash-diff partition lines 375-396) + migration anchor (V0_0_9__normalize_dataset_structure.sql:1-43)
**Axes present**: repositories, services, schema_migrations
**Batch**: R (2026-05-20)

**Surfaced by**:
- `ReactiveDatasetFieldRepositoryImpl.md:implicit_adrs.[0]` (HIGH) — "Dataset_field rows are versioned by reference, not by mutation — a column's evolution is captured by NEW rows in `dataset_field` and NEW links in `dataset_structure`, not by UPDATEs to the existing row." — evidence: V0_0_9__normalize_dataset_structure.sql:1-43 + DatasetFieldServiceImpl.java:375-396 — intent_anchor: "`V0_0_9__normalize_dataset_structure.sql:40-43`: `ALTER TABLE dataset_field DROP CONSTRAINT dataset_field_dataset_version_id_fkey, DROP COLUMN dataset_version_id` AND `DatasetFieldServiceImpl.java:392`: `fieldsToCreate.put(fieldPojo.getOddrn(), new DatasetFieldPair(existingField, fieldPojo));` — the explicit comment-free branch when `newVersionHash` differs from `existingVersionHash`. The DDL migration's deliberate drop of the version FK + the service's deliberate `pojosToCreate` partition together encode the decision: schema evolution = new row, not mutation." — confidence: HIGH

**Decision statement**: When a dataset's schema changes between two ingestion-emitted versions, the platform creates a NEW `dataset_field` row for every column whose structure-hash differs and links it to the new `dataset_version` via a NEW `dataset_structure(dataset_version_id, dataset_field_id)` row. The OLD `dataset_field` row is preserved, still referenced by the prior `dataset_version` via the prior `dataset_structure` link.

The structural commitment is rooted in `V0_0_9__normalize_dataset_structure.sql` which:
- Lines 1-16: introduces the M:N `dataset_structure` join table — `(dataset_version_id, dataset_field_id)` PK
- Lines 40-43: DROPs `dataset_field.dataset_version_id` FK + column

This replaces the previous "one dataset_field row per (column, version) pair" model with "one dataset_field row per (column-state) shared by every dataset_version that contains it".

The service-tier dispatch lives at `DatasetFieldServiceImpl.buildDatasetFieldIngestionDto` lines 375-396:
- when `newVersionHash.equals(existingVersionHash)` → the field goes into `fieldsToUpdate` and the existing row's id is reused
- when not equal → the field goes into `fieldsToCreate` as a NEW row

The hash factors are `name`, `type`, `is_key`, `is_value`, `is_primary_key`, `is_sort_key`, `external_description` (per `DatasetVersionHashCalculator.java`). A rename, type change, or PK/sort-key flag flip will create a NEW dataset_field row; a stats-only update will reuse the existing row.

Read shapes encode the decision:
- `getLastVersionDatasetFieldsByOddrns` (lines 92-113) uses a window-function CTE — `MAX(DATASET_VERSION.VERSION).OVER(PARTITION BY DATASET_FIELD.ODDRN)` — to find "the version row that belongs to the most recent dataset_version for each oddrn". This shape is REQUIRED because dataset_field rows are shared across versions.

The architectural commitments:
- **(a) The platform's schema-diff capability depends on multiple dataset_field rows per oddrn existing.** A one-row-per-column model would lose history.
- **(b) Backwards-incompatible schema-change alerts (P-07) are computed at the DATASET PARENT level via the structure-hash; dataset_field rows are the SUBSTRATE the hash is computed over.** The alert fires once per dataset, not once per field change.
- **(c) Adding a new column metadata field to `DatasetFieldPojo` requires deciding whether it participates in the version-fork hash** (→ new row on change) or not (→ in-place edit). Operator-curated fields (`internalDescription`, `internalName`) DO NOT participate in the hash; they are not version-bound (see ADR-CANDIDATE-148 forward-copy).
- **(d) The dataset_field table has NO native soft-delete column** (no `deleted_at`, no `is_deleted`, no STATUS — confirmed by `V0_0_1__init.sql:148-164` plus a sweep of every `ALTER TABLE dataset_field` migration). The "deletion" semantics are implicit — a column removed from a new dataset_version is preserved as an orphan row referenced only by historical dataset_versions.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — V0_0_9 is an explicit DDL migration with a name encoding the architectural intent (`normalize_dataset_structure`); `DROP COLUMN dataset_version_id` is a deliberate destructive ALTER; the service-tier dispatch at lines 375-396 is the matching decision logic; the window-function CTE at lines 99-110 is the consequent read shape.
2. **Structural impact?** YES — every dataset's schema-diff capability; every backwards-incompatible-schema alert; every operator's expectation of "schema history is preserved"; every future column-metadata field addition; the orphan-row management story for the dataset_field table.
3. **Refactoring or structural?** STRUCTURAL — moving to per-row mutation would require a new migration + retrofitting every consumer that walks dataset_structure + redesigning the schema-diff feature + redesigning the schema-change-alert detection logic.

**Existing ADR**: none. Cross-references:
- ADR-CANDIDATE-148 (forward-copy of operator-curated metadata — the consequence-ADR for protecting operator state across forks; together they describe the schema-evolution model + the state-preservation contract)
- REFACTOR-438 NEW (no orphan-cleanup job — the negative-space consequence of versioning-by-reference; partly inevitable, partly fixable via cleanup job)

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-438 NEW (dataset_field orphan accumulation)
- REFACTOR-439 NEW (verbatim XSS-class storage on dataset_field.internalDescription — F-004 family at the column surface)
- REFACTOR-440 NEW (updateDescription not @ActivityLog-annotated — audit gap on the column-edit surface)
- REFACTOR-218 family cross-reference (column-level lineage — dataset_field rows are the substrate)

**Proposed action**: Promote to `adrs/drafts/dataset-field-versioning-by-reference.md` (new ADR). Document the V0_0_9 schema commitment + the hash-diff partition logic + the schema-diff feature dependency + the orphan-row trade-off + the cross-reference to schema-change alerts (P-07). Live-doc-side: surface the model on `features/data-discovery/dataset-schema-diff` (today the doc-site implies schema diff but does not describe the multi-row preservation model); add a caveat that "column renames create new rows" so operators understand the dataset_field growth pattern.

**Severity rationale**: HIGH — structural commitment; the schema-diff feature's correctness depends on this; cross-cutting with P-07 schema-change alerts; doc-site silent today.

---

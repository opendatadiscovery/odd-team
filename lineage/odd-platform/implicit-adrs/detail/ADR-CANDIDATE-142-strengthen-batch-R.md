## ADR-CANDIDATE-142 — STRENGTHENED BATCH R — UPSERT-by-ODDRN partial-merge now has SQL-tier primary source from ReactiveDataSourceRepositoryImpl

**Severity unchanged**: HIGH
**Updated support count**: now **2 sidecars + service-tier test corroboration + SQL-tier identity-invariant** (1 batch-P controller-method primary source + 1 batch-R repository primary source + cross-batch corroboration with prepareForUpdate shape in batch-A IngestionService sidecar)
**Batch**: R (2026-05-20)

**New surfaced_by**:
- `ReactiveDataSourceRepositoryImpl.md:implicit_adrs.[0]` (HIGH) — "Partial-merge UPSERT contract is a SERVICE-tier convention, NOT a REPOSITORY-tier enforcement — the repository's inherited `bulkUpdate` (ReactiveAbstractCRUDRepository.java:128-142 → updateMany at 203-223) writes ALL non-non-updatable columns from the supplied records. The narrowing to ONLY name + description lives at `DataSourceIngestionServiceImpl.prepareForUpdate` (lines 74-92) via the copy-construct-then-setter pattern `new DataSourcePojo(a).setName(...).setDescription(...)`. The intent is visible in the SHAPE of the service-tier mapper: a maintainer adding a new payload-driven field MUST add it to `prepareForUpdate`; the repository would faithfully propagate it. STRENGTHENS ADR-CANDIDATE-142." — intent_anchor: "`new DataSourcePojo(a).setName(i.getName()).setDescription(i.getDescription())` — the COPY-CONSTRUCT from EXISTING is the deliberate signal of 'only these two fields are payload-driven; everything else is operator-owned.'"
- `ReactiveDataSourceRepositoryImpl.md:implicit_adrs.[1]` (HIGH) — "ODDRN identity is partial-unique-index-enforced; soft-delete enables ODDRN reuse — the partial unique index `data_source_oddrn_unique ON data_source(oddrn) WHERE deleted_at IS NULL` (V0_0_31__add_deleted_at_field.sql:29) is the SQL-tier mechanism for 'ODDRN is the stable identity for a datasource across re-registrations, but a soft-deleted datasource's ODDRN can be reused by a NEW row'. This is the structural mirror of the batch-N (Role) and batch-H (Policy) findings — the soft-delete-aware recreation pattern is consistent across the platform." — intent_anchor: "`CREATE UNIQUE INDEX IF NOT EXISTS data_source_oddrn_unique ON data_source (oddrn) WHERE deleted_at IS NULL;`"
- `ReactiveDataSourceRepositoryImpl.md:implicit_adrs.[2]` (HIGH) — "`getIdByOddrnForUpdate` uses Postgres row-level lock to serialise ingestion — the only `forUpdate()` call in the entire repository layer for the data_source table. The Postgres `SELECT … FOR UPDATE` row-lock is held until the surrounding `@ReactiveTransactional` commits, serialising IngestionServiceImpl's `persistDataEntities` flow (IngestionServiceImpl.java:65-74) against concurrent UI deletes / collector re-registrations of the same datasource."

**Cross-batch insight**: The ADR's load-bearing claim ("partial merge of name + description only") is now anchored at THREE layers:

1. **Service-tier (batch P)**: `DataSourceIngestionServiceImpl.prepareForUpdate` lines 74-92 — the SERVICE-tier narrowing. The original primary source surfaced at batch P from `IngestionController.createDataSourceEntity`.

2. **Repository-tier (batch R, NEW)**: `ReactiveDataSourceRepositoryImpl` — the REPOSITORY-tier confirmation that the narrowing is NOT enforced at SQL; the repository would propagate any field the service hands it. The `bulkUpdate` inherited from `ReactiveAbstractCRUDRepository.java:128-142` writes ALL non-non-updatable fields. This means:
   - A service-bypassing caller invoking `dataSourceRepository.bulkUpdate(List.of(pojoWithNewCollectorId))` would silently transfer ownership of a datasource from collector A to collector B (REFACTOR-RBR-cross-collector-overwrite finding from the sidecar).
   - The partial-merge guarantee is a SERVICE-TIER convention, not a structural defence.

3. **SQL-tier identity-invariant (batch R, NEW)**: The partial-unique-index `data_source_oddrn_unique ON data_source(oddrn) WHERE deleted_at IS NULL` (V0_0_31__add_deleted_at_field.sql:29) is the SQL-tier mechanism for "ODDRN is the stable identity; soft-deleted rows free their ODDRN for reuse". This enables the soft-delete-aware recreation pattern: a collector can re-register a previously-soft-deleted datasource with the same ODDRN and receive a NEW row (not the recovered old row). The pattern is consistent across the platform — also at `role.name`, `policy.name`, `tag.name`, `owner.name`, `data_source.name` (per V0_0_64 cleanup + sibling V0_0_31 migrations).

**Additional cross-batch enrichments** (these add nuance to the existing ADR, not new ADRs):
- The `forUpdate()` row-lock in `getIdByOddrnForUpdate` is the only such lock in the data_source surface — explicit serialization of ingestion against concurrent UI deletes. This is the concurrency-control consequence of the UPSERT-by-ODDRN model.
- The cascade-delete guards (`existsByCollector`, `existsByNamespace`) live at the SERVICE tier — the repository provides the EXISTS primitive; the service composes it. This is the deliberate split: cascade-delete is a BUSINESS-LOGIC concern, not a SCHEMA concern (the FKs have NO `ON DELETE` clauses per V0_0_34).

**Updated full triangulation enumeration (now 2 sidecars + SQL-tier substrate + service-tier test)**:
- Batch P: `IngestionController.createDataSourceEntity` — controller-side primary source
- Batch P: `DataSourceIngestionServiceTest.createDataSourcesTest` 6-case parameterized — service-tier test corroboration
- Batch R: `ReactiveDataSourceRepositoryImpl` — repository-tier + SQL-tier confirmation (NEW)

**Cross-references with batch-R sibling ADRs**:
- ADR-CANDIDATE-147 (dataset-field versioning-by-reference) — both ADRs encode the platform's "protect operator state from collector overwrites" pattern at different surfaces (datasource for the integration boundary; dataset_field for the column metadata).
- ADR-CANDIDATE-148 (dataset_field forward-copy of operator-curated metadata) — same family; the forward-copy on dataset_field is the column-tier mirror of the partial-merge on datasource.

**Severity unchanged at HIGH**.

---

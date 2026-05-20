## ADR-CANDIDATE-166 — LookupTable row storage is delegated to a physical PostgreSQL table in `lookup_tables_schema`, not stored as JSON in the catalog — reflects an operator-facing read pattern: SQL-joinable from downstream BI

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — encodes P-03 architectural commitment)
**Pillars affected**: [P-03-master-data-management, P-01-data-discovery (lookup tables are first-class data entities), P-10-integrations-ingestion (operator-curated, not collector-ingested)]
**Support count**: 1 sidecar primary-source (batch V ReferenceDataController class) + live-doc anchor at `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (verified 2026-05-20, status 200)
**Axes present**: controllers, repositories (cross-referenced via `ReferenceDataRepositoryImpl`)
**Batch**: V (2026-05-20)

**Surfaced by**:
- `ReferenceDataController__controller-class__ReferenceDataController.md:implicit_adrs.[3]` (HIGH) — "Row storage is delegated to a physical Postgres table in `lookup_tables_schema`, not stored as JSON in the catalog — reflects an operator-facing read pattern: SQL-joinable from downstream BI." — evidence: ReferenceDataRepositoryImpl.java:57 (`private static final String SCHEMA_NAME = "lookup_tables_schema";`), `createLookupTable` issuing DDL `CREATE SEQUENCE` + `CREATE TABLE` (lines 65-76), live-doc P-03 narrative ("direct PostgreSQL access via `lookup_tables_schema`") — intent_anchor: "`private static final String SCHEMA_NAME = \"lookup_tables_schema\";`" + the explicit DDL in `createLookupTable` — confidence: HIGH
- `ReferenceDataController__controller-class__ReferenceDataController.md:concepts.invariants.[0]` (HIGH) — "Every lookup table has a backing physical PostgreSQL table in `lookup_tables_schema` named `n_{namespaceId}__{lowercased_underscored_name}` (`ReferenceDataServiceImpl.java:191-194`)"

**Decision statement**: Lookup Tables (data entities of type `LOOKUP_TABLE`, see `DataEntityClassDto.java:43`) are stored as PHYSICAL PostgreSQL tables in a DEDICATED schema named `lookup_tables_schema` — NOT stored as JSON blobs in the catalog's metadata schema, NOT stored as rows in a generic `lookup_table_row` table.

The architectural commitments:
- **(a) Dedicated schema.** `private static final String SCHEMA_NAME = "lookup_tables_schema";` at `ReferenceDataRepositoryImpl.java:57` — the schema name is a compile-time constant, the schema is created via Flyway migration, and the schema is intentionally separate from the catalog's public schema so that downstream BI tools can `JOIN lookup_tables_schema.n_5__customer_lookups USING (customer_id)` directly without going through the catalog's metadata structures.
- **(b) Table-name template.** Every lookup table maps to a physical table named `n_{namespaceId}__{lowercased_underscored_name}` (`ReferenceDataServiceImpl.java:191-194`) — the `n_{namespaceId}` prefix avoids cross-namespace collisions, the `__` separator distinguishes namespace from table name, the lowercased + underscore-replaced name is the SQL-identifier-safe normalisation.
- **(c) DDL-driven lifecycle.** Create / add-column / rename / delete all issue DDL statements at the repository layer:
  - `createLookupTable` → `CREATE SEQUENCE` + `CREATE TABLE` (`ReferenceDataRepositoryImpl.java:65-76`)
  - `addColumns` → `ALTER TABLE ... ADD COLUMN`
  - `updateLookupTable` (rename) → `ALTER TABLE ... RENAME TO` (`ReferenceDataRepositoryImpl.java:181-202`)
  - `deleteLookupTable` → `DROP TABLE` (`ReferenceDataRepositoryImpl.java:268-277`)
- **(d) SQL-joinable contract.** The operator-facing P-03 docs explicitly promise `SQL-joinable from downstream BI` — operators are expected to write SQL queries against `lookup_tables_schema.n_5__customer_lookups`. The schema name + table-name template are STABLE PUBLIC contracts that operators depend on.
- **(e) Per-column type enforcement.** `LookupTableColumnTypes.java:30-50` enumerates 9 enum constants mapping to 8 distinct SQL data types (TYPE_VARCHAR / TYPE_INTEGER / TYPE_SERIAL / TYPE_DECIMAL / TYPE_BOOLEAN / TYPE_DATE / TYPE_TIME / TYPE_JSON / TYPE_UUID; INTEGER + SERIAL share INTEGER). Each is a CREATE TABLE column-type literal, not a serialized representation in JSON.

The platform's lookup-table SEARCH surface DOES use a per-table FTS-vector materialisation (`ReactiveLookupTableSearchEntrypointRepositoryImpl`) which is a SEPARATE concern (search-vector indexes) — but the storage is physical Postgres.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments: the dedicated schema name as a compile-time constant; the table-name template as a deterministic SQL-identifier-safe function; the DDL-driven CREATE/ALTER/RENAME/DROP at the repository layer. The live-doc page anchors the operator-facing contract.
2. **Structural impact?** YES — every operator's BI query against `lookup_tables_schema.n_5__customer_lookups` depends on this; every DDL operation acquires ACCESS EXCLUSIVE LOCK (per `ReferenceDataController` sidecar `performance.resource_allocation`); every backup / restore / migration must consider the schema; every operator who chooses a lookup-table name fixes a downstream-SQL-pinned table-name; every cascade-delete must DROP the physical table.
3. **Refactoring or structural?** STRUCTURAL — moving lookup-table rows to JSON in the catalog would BREAK the operator's SQL-joinable read pattern; collapsing the dedicated schema into the public schema would risk name collisions and audit-isolation; the DDL-driven lifecycle is structurally committed to the chosen storage shape.

**Existing ADR**: none in `adrs/`. The live doc at `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` mentions "direct PostgreSQL access via `lookup_tables_schema`" (verified 2026-05-20, status 200) — the architectural decision is doc-anchored but not ADR-codified.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-485 NEW batch V (lookup-table rename via ALTER TABLE breaks downstream SQL — operator-pinned `lookup_tables_schema.n_5__customer_lookups` references break silently when an operator renames the lookup table; no deprecation alias / view).
- REFACTOR-484-family (lookup-table row XSS surface — `LookupCharValidator.getValue` returns input verbatim; HTML/JS persists round-trip).
- 2-transaction inconsistency (lookup-table delete spans two transactions per `ReferenceDataController` sidecar `bugs_limitations_corner_cases.[4]` — `referenceDataRepository.deleteLookupTable` + `lookupDataService.deleteLookupTable` — no rollback semantics across the boundary; a failure between the catalog DELETE and the physical DROP TABLE leaves the catalog inconsistent).
- DDL serialization risk (rename / delete take ACCESS EXCLUSIVE LOCK; concurrent read-heavy traffic on a popular reference table blocks during operator edits; no advisory-lock-driven queue, no offline-rebuild pattern).
- Cascade-on-parent-DataEntity-delete is NOT enforced by FK constraint (orphan rows possible per `ReferenceDataController` sidecar `bugs_limitations_corner_cases.[3]`).

**Proposed action**: Promote to `adrs/drafts/lookup-tables-physical-postgres-storage.md` (new ADR). Document the schema name + the table-name template + the DDL-driven lifecycle + the operator-facing SQL-joinable contract + the rename caveat (RENAME breaks downstream) + the cascade-delete invariants + the cross-link to ADR-CANDIDATE-168 (the three-tier RBAC that gates these DDL operations).

**Severity rationale**: HIGH — load-bearing P-03 architectural decision; defines the operator-facing surface (SQL-joinable); structural commitment that the rename + delete + add-column lifecycle uses DDL (which acquires ACCESS EXCLUSIVE locks); the rename consequence is operationally significant.

---

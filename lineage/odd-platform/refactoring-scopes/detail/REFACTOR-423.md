## REFACTOR-423 — `POST /ingestion/datasources` overwrites operator-UI-edited `name` + `description` on the next collector startup — no log, no UI signal, no merge-conflict surface

**Severity**: MEDIUM
**Category**: silent-overwrite (operator-collector boundary)
**Pillars affected**: [P-10-integrations-ingestion, P-08-management-administration]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:concepts.invariants.[5]` (the inverse side of REFACTOR-422)

**Description**: An operator who manually renames a datasource in the UI (`PUT /api/datasources/{id}` with `name: "production-snowflake-warehouse"`) and then re-runs the collector with the original `name: "snowflake"` will see their UI-side rename silently OVERWRITTEN on the next `POST /ingestion/datasources` (because the partial-merge propagates `name` + `description` FROM the payload). The two writes have no merge-conflict resolution mechanism; last-write-wins, with the collector winning every time.

**Primary source citations**: `DataSourceIngestionServiceImpl.java:74-92` (the same mapper)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-142 (partial-merge upsert) explicitly defends "the collector author has the payload, the operator has the UI, last-write-wins for the 2 fields." This scope is the OPERATOR-SIDE caveat of the same ADR.

**Proposed remedy**:
1. Doc-side: surface the caveat on the UI's Datasources tab ("This name was last set by the collector at T; manual edits may be overwritten on the next collector restart").
2. UI-side: detect the overwrite (compare the last-seen `name` to the current `name`) and surface a "Collector overrode your edit" toast.
3. (Schema-side, large): add a `manually_edited_fields: text[]` column to track which fields the operator has edited; the mapper at `prepareForUpdate` respects the flag.

**Severity rationale**: MEDIUM — operational confusion; not data loss (the rename is recoverable by editing again).

**Suggested backlog grouping**: `Operator-collector boundary hygiene` (group with REFACTOR-422 + REFACTOR-424).

---

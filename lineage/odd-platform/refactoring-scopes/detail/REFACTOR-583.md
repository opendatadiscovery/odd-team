## REFACTOR-583 — An actively-ingested data source is effectively undeletable — the cascade-guard 400s while any live `data_entity` child exists; collector re-ingest re-creates children between the soft-delete-children and delete-source steps; the only reliable delete path (stop the collector first) is undocumented

**Severity**: MEDIUM
**Category**: missing-doc-prereq + race-condition (operational dead-end)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management), P-10 (Integrations / Ingestion)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**An actively-ingested data source is effectively undeletable.** The delete is blocked (HTTP 400) by `existsNonDeletedByDataSourceId` whenever a live `data_entity` child exists (`DataSourceServiceImpl.java:88-95`). `data_entity` rows are created by the collector and re-created on its next ingest tick. An operator who soft-deletes all entities and then deletes the source races the collector: if the collector re-ingests between the two steps, the next delete 400s again. The only reliable delete path is to stop the collector first — and the doc page does not mention this."
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:docs_link_semantic.doc_drift_findings.[0]` — the live `features/management` page describes deletion only as "remove a source no longer ingested" and documents NONE of: (a) the delete is BLOCKED with HTTP 400 if live children exist, (b) the delete is a soft-delete, (c) token cleanup, (d) the FK-orphaned children.
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:stress_findings.resource_boundaries` (the cascade-guard / concurrent-ingest interleave — "a delete and a concurrent collector ingest of the same ODDRN can interleave so the exists-check passes ... but a child entity is inserted before the soft-delete UPDATE commits — the result is a soft-deleted data_source with a live child").

**Description**: `DataSourceServiceImpl.delete` (lines 85-96) calls `dataEntityRepository.existsNonDeletedByDataSourceId(id)` (`ReactiveDataEntityRepositoryImpl.java:158-163` — `SELECT EXISTS(SELECT 1 FROM data_entity WHERE data_source_id = ? AND deleted_at IS NULL)`); if any non-soft-deleted `data_entity` references the data source, it throws `CascadeDeleteException` → HTTP 400 and performs NO mutation. Because `data_entity` rows are collector-created and re-created on every ingest tick, an operator following the only available delete sequence — (1) soft-delete all child entities, (2) delete the data source — RACES the collector: a re-ingest between steps 1 and 2 re-creates live `data_entity` rows, so step 2 400s again. The operator has no documented path out; the reliable sequence is "stop the collector, THEN soft-delete children, THEN delete the source" — and neither the live `features/management` page nor the API reference (which omits a Data Sources sub-page entirely) states this prerequisite. Separately, the cascade-guard itself has a concurrency window: the `existsNonDeletedByDataSourceId` check and the soft-delete UPDATE are not serialised against concurrent ingestion (the `delete` path does NOT take the `getIdByOddrnForUpdate` row lock the ingestion path uses), so a re-ingest interleaving between the check and the UPDATE can leave a soft-deleted `data_source` with a live `data_entity` child (pinned by P-047 for the static precondition; the live race is a follow-on).

**Primary source citations**:
- `DataSourceServiceImpl.java:88-95` (the cascade-guard — `existsNonDeletedByDataSourceId` → `CascadeDeleteException`)
- `ReactiveDataEntityRepositoryImpl.java:158-163` (the `SELECT EXISTS` cascade-guard primitive)
- WebFetched `https://docs.opendatadiscovery.org/features/management` 2026-05-21 status 200 (silent on the delete precondition)
- Probe `P-047` (`lineage/odd-platform/probes/P-047.yaml`) — pins the block/allow split

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-068 (two-tier soft-delete taxonomy, batch-ZB strengthen) records the data-source delete's service-tier cascade-guard as a facet of the soft-delete lifecycle. The cascade-guard ITSELF is a deliberate referential-integrity decision (the exception message states the rationale) — that is NOT the gap. The GAP is twofold and both halves are gap-shaped: (a) the operational prerequisite (stop the collector first) is undocumented — a doc-completeness gap with no defending rationale; (b) the cascade-guard's check-then-act is not serialised against ingestion — a race-condition gap.

**Proposed remedy**: (a) DOC-side: add a caveat block to `features/management.md` (and a Data Sources section to the API reference) stating that deleting a data source requires no live data entities, that an active collector must be stopped first, and that the delete is a soft-delete. (b) CODE-side (optional, lower priority): make the cascade-guard's `existsNonDeletedByDataSourceId` + soft-delete UPDATE serialise against concurrent ingestion of the same data source — e.g. take the `getIdByOddrnForUpdate`-style row lock for the delete, or re-check `existsNonDeletedByDataSourceId` inside the same statement as the UPDATE. (c) Optionally surface a clearer 400 message distinguishing "stop the collector" guidance.

**Severity rationale**: MEDIUM — an operational dead-end with no documented workaround; the operator who follows the product's only visible delete path repeatedly fails with an unexplained 400. Not data-loss; not security-critical; an operator-experience + doc-completeness gap with a latent race-condition tail.

**Suggested backlog grouping**: `DOC-NNN data-source-lifecycle doc-completeness` (the doc half — pair with REFACTOR-581/582 which are the other undocumented delete consequences) + optionally `SEC-NNN concurrency hardening` (the cascade-guard race half).

---

## REFACTOR-422 — `POST /ingestion/datasources` re-registration silently propagates ONLY `name` + `description` from the payload; `connection_url`, `type`, `active`, etc. CANNOT be updated via the ingestion endpoint — silent caveat; no doc warns

**Severity**: MEDIUM
**Category**: silent-no-propagation (architectural caveat that the doc-product fails to surface)
**Pillars affected**: [P-10-integrations-ingestion]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:bugs_limitations_corner_cases.[6]` + `:docs_link_semantic.doc_drift_findings.[0]`

**Description**: `DataSourceIngestionServiceImpl.prepareForUpdate` (lines 74-92) overwrites ONLY `name` and `description` from the new payload. The mapper preserves `connection_url`, `active`, `type`, `namespace_id`, `collector_id`, `token_id`, soft-delete flag, all timestamps. A collector author whose source's hostname genuinely changed CANNOT push the new `connection_url` via this endpoint — the response is `200 OK` regardless; the field is silently dropped. The operator must use the UI's `PUT /api/datasources/{id}` (different controller, requires UI auth) to update operational fields. The custom-collectors doc page (WebFetched 2026-05-20 status 200) says "Register data sources with the Platform via POST /ingestion/datasources once at startup" with NO mention of merge semantics.

**Primary source citations**:
- `DataSourceIngestionServiceImpl.java:74-92`
- WebFetched `https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors` 2026-05-20 (silent on merge)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-142 NEW (batch P — partial-merge upsert) codifies the SEMANTIC choice. This scope is the OPERATOR-CAVEAT side of the same decision — the ADR's positive-intent rationale is sound BUT the doc surface is silent on the trade-off.

**Proposed remedy**:
1. Doc-side: add a caveat block to `developer-guides/build-and-run/custom-collectors.md` documenting which fields are propagated by the collector vs which are operator-only.
2. (Optional code-side): log a WARN per-call when the payload contains a `connection_url` (or `type`/`active`) that differs from the existing row.
3. (Optional contract-side): explicitly mark `connection_url`/`type`/`active` as `readOnly: true` in the Ingestion-API contract's `DataSource` model.

**Severity rationale**: MEDIUM — silent UX caveat; affects every collector author whose source schema or hostname has changed.

**Suggested backlog grouping**: `DOC-NNN custom-collectors doc-completeness` (pair with REFACTOR-424 + REFACTOR-423).

---

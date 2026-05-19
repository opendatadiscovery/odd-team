## REFACTOR-424 — `POST /ingestion/datasources` payload's `namespace_name` is SILENTLY IGNORED; the platform's namespace_id comes from the Collector's namespace, not the payload — no log, no doc warns

**Severity**: MEDIUM
**Category**: silent-payload-drop (architectural caveat)
**Pillars affected**: [P-10-integrations-ingestion, P-08-management-administration]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:bugs_limitations_corner_cases.[5]`

**Description**: The Ingestion API contract's `DataSource` model includes a `namespace_name` field (per the upstream `opendatadiscovery-specification`'s schema). The platform's mapper at `DataSourceIngestionServiceImpl.java:106` inherits the namespace_id from the Collector's `namespace()`, IGNORING any namespace info in the payload. A custom-collector author setting `namespace_name = "my-team"` in the payload would see the datasource appear under the Collector's pre-configured namespace, NOT under `my-team`. No log records the silent drop. No doc warns about it.

**Primary source citations**:
- `DataSourceIngestionServiceImpl.java:99-111` (mapper uses Collector's namespace)
- absence of any log call when the field is dropped

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-143 NEW (batch P — namespace inherited from Collector, collector-tenancy model) codifies the architectural choice. This scope is the SILENT-DROP operational hazard.

**Proposed remedy**:
1. Doc-side: surface the inheritance on `developer-guides/build-and-run/custom-collectors.md` ("The platform's namespace for a datasource comes from the Collector entity it's bound to, NOT from the `namespace_name` field in the DataSource payload. Set the Collector's Namespace in the UI before generating the token.").
2. Code-side: log a WARN per-call when the payload's `namespace_name` is non-null and differs from the Collector's namespace.
3. Contract-side: mark `namespace_name` as `readOnly: true` on the Ingestion-API `DataSource` model (codegen would omit it from collector-side serialisation), OR remove the field entirely from the contract.

**Severity rationale**: MEDIUM — silent UX caveat; affects multi-namespace custom-collector authors.

**Suggested backlog grouping**: `DOC-NNN custom-collectors doc-completeness` (pair with REFACTOR-422 + REFACTOR-423).

---

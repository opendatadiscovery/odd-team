- **DOC-GAP-038**: `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:docs_link_semantic.doc_drift_findings.[0,1,2]` (all three HIGH) + `:bugs_limitations_corner_cases.[0,6]` (HIGH) + `:security.known_security_gaps.[0,3]` (HIGH)
    - `concepts.yaml:entities[Ingestion Filter]`
  - **Evidence**: see existing DOC-GAP-038 body (preserved); 2026-05-11 verifications stand.
  - **Proposed doc action**: Three-part doc action — per-datasource bearer-token sub-section, coverage table, default-behaviour admonition. See full text in batch 2026-05-10B retained.
  - **Cross-references**: DOC-GAP-036, DOC-GAP-003, DOC-GAP-034; LSN-001/LSN-002.
  - **Severity rationale**: HIGH — same shape as LSN-001 (attachment-ephemeral default).

#### Batch 2026-05-19-H STRENGTHENS — SQL primary-source confirmation of webhook-not-filter-matched

- Sidecar `odd-platform__java__repository_reactive__repository__ReactiveAlertRepositoryImpl.md:security.ingestion_filter_relevance` confirms verbatim: "`NO — repository is not HTTP. The path-mounted callers split: AlertManagerController (`POST /ingestion/alert/alertmanager`) is NOT gated by IngestionDataEntitiesFilter (the filter only matches `/ingestion/entities` POST). The ingestion processor path (AlertIngestionRequestProcessor) IS reached via `/ingestion/entities` and IS gated.`"
- Sidecar `:security.auth_mode_relevance` adds the `AlertManagerController.java:21` evidence: `@PostMapping(path = "ingestion/alert/alertmanager")` — a path that is NOT `/ingestion/entities` and therefore is NOT covered by the ingestion filter.
- This batch confirms at the **repository/security-aggregate layer** what DOC-GAP-038 captured at the **filter config-key-consumer layer**: the `auth.ingestion.filter.enabled` toggle is a per-path filter binding, and the path-matcher is the asymmetry source. Operators setting the toggle to `true` reasonably assume it protects every `/ingestion/*` endpoint; the path-matcher narrows coverage to one sub-path; the AlertManager webhook is silently outside.
- The doc-side coverage table proposed in DOC-GAP-038 should now include **two columns**: (i) auth.ingestion.filter.enabled = false (today's default) → both `/ingestion/entities` and `/ingestion/alert/alertmanager` are unauthenticated; (ii) auth.ingestion.filter.enabled = true → `/ingestion/entities` is gated by the bearer-token filter, `/ingestion/alert/alertmanager` is STILL unauthenticated. The operator who toggles the flag for production hardening retains a hole on the AlertManager webhook unless they ALSO gate that path at the perimeter.
- Cross-link **DOC-GAP-107** (the new compound AlertManager finding) — DOC-GAP-038 captures the toggle-asymmetry at the filter layer; DOC-GAP-107 captures the broader webhook-coverage + no-dedup + OpenAPI-undocumented gap that the same path-matcher asymmetry enables.

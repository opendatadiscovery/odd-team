# SHB-124 — Operators see their datasources commingled because ingestion routes by payload ODDRN, not by collector token identity

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators running multi-team or multi-tenant deployments expect that a Collector's bearer token implicitly scopes ingestion writes to "that Collector's datasources." The implementation does the opposite: the service-tier resolves the target datasource ONLY by the payload's `data_source_oddrn` (string), with NO check that the calling Collector "owns" that datasource. Even with the `auth.ingestion.filter.enabled=true` opt-in active, isolation depends entirely on (a) per-datasource token uniqueness (no `UNIQUE(value)` constraint visible at the schema level on the TOKEN table) and (b) operator discipline. When the filter is OFF (default), there is NO scoping at all — any caller can target any datasource. The result: the platform's Datasources tab shows a fused namespace of writes whose ORIGIN cannot be reconstructed from runtime state; there is no `last_ingested_by_collector` column on `data_source` or on `data_entity`.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionServiceImpl.java:68` — `dataSourceRepository.getIdByOddrnForUpdate(dataEntityList.getDataSourceOddrn())`. The ONLY datasource resolution; reads the ODDRN string from the request body, NEVER from any principal / session / collector-id.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/IngestionService.java:7-11` — the interface itself takes only `DataEntityList`. No principal parameter, no `Authentication`. The service is *architecturally* ignorant of the caller; the upstream filter is the SOLE point at which caller→datasource binding could happen.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:46-58` (per F-008 batch-O sidecar) — when the filter IS active, it validates the bearer token against the datasource named in the payload via the per-datasource TOKEN row. So filter-ON ≠ "Collector A's token can write only to Collector A's datasources" — it means "Collector A's token can write to ANY datasource that maps to A's token in the TOKEN table." A token-sharing misconfiguration (or a deliberate token reuse) cross-mixes namespaces.
- `odd-platform-api/src/main/resources/application.yml:46-48` — `auth.ingestion.filter.enabled: false` default. Under bundled defaults, the filter doesn't run; the service-tier resolution at line 68 is the entire defence — and there is none.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/processor/MetadataIngestionRequestProcessor.java:72-80` (per F-008 sidecar) — the destructive `bindingsToDelete = existingMetadataBindings.difference(currentBindings)` runs against whatever datasource was resolved at line 68. So payload-driven scoping → silent metadata destruction of *any* datasource, scoped by payload identity only.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/processor/LineageIngestionRequestProcessor.java:17` — `replaceLineagePaths(request.getLineageRelations())`. The replace verb operates against the payload-named establisher ODDRNs; cross-datasource lineage destruction is also enabled by payload-driven scoping.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveCollectorRepositoryImpl.java:89-97` — `getByToken` uses `TOKEN.VALUE.eq(token)` with no uniqueness check at code level. The schema-level UNIQUE on TOKEN.value is NOT visible in the repository code (would require a separate schema scan to confirm).

## Notes

- This is the SYSTEM-MISSION-named "security-relevant implicit ADR" surface. The system mission file flags this as a SHAPE-RELEVANT decision worth elevating; it is not yet anchored in any F-NNN (F-008 covers the destruction; this thread elevates the SCOPING MECHANISM).
- Operator mental model failure mode: "I have 3 Collectors and 3 teams. Each Collector has its own token. Therefore team A's data is isolated from team B's data." Code reality: as long as the filter is OFF (bundled default), team A's collector can target team B's datasource by writing team B's ODDRN in the request body. There is no UI-visible signal that this could happen.
- Operationally-visible symptom: an operator looking at the Datasources tab sees a fused list of all datasources. The `data_source.collector_id` field (set ONLY by `POST /ingestion/datasources`, NOT by subsequent `POST /ingestion/entities`) records which Collector REGISTERED the datasource, but does NOT record which Collector last INGESTED into it. A datasource registered by Collector A but routinely ingested by Collector B looks identical to a same-collector pipeline.
- The protection that is ACTUALLY enforced lives in the ADR-CANDIDATE-143 namespace-from-Collector inheritance (per `DataSourceIngestionServiceImpl.java:106` — namespace_id is hard-coded from the matched Collector at *registration* time). But this only constrains the namespace stamp at creation; it does NOT constrain WHICH Collector can ingest into a registered datasource subsequently.
- Cross-collector enumeration via the namespace surface is *separate* but COMPOSED: REFACTOR-024 (cross-owner enumeration) means Collector A can see Collector B's datasource list, then choose any ODDRN to write into.
- This is an ENRICHER for F-008 (which already lists `datasource_scoping_is_payload_driven_not_principal_driven` as a drift facet). The thread adds the OPERATOR-VISIBLE FRAMING: from the Datasources tab, the symptom is *fused namespaces*; from the threat-model lens, the mechanism is *payload-driven scoping*; from the documentation lens, the silence is `application.yml` not warning about it.
- The `data_source.collector_id` column + adding a `data_source.last_ingested_by_collector_id` audit column would let an operator at least *reconstruct* who wrote to what. Today the answer is unknowable from runtime state.

## Next

1. Treat this as an enricher for F-008; the feature-flow-builder should fold this into F-008's drift facet `datasource_scoping_is_payload_driven_not_principal_driven` with the OPERATOR-VISIBLE FRAMING (Datasources tab shows fused namespace) added explicitly to the feature flow's user-impact narrative.
2. File a REFACTOR-NNN: add `data_source.last_ingested_by_collector_id` + per-row audit timestamp; surface in the Datasources tab so operators can see ingestion provenance.
3. SEC-NNN: schema-level audit — assert TOKEN.value has a UNIQUE constraint at the DB level (or document that it does not). Sibling sidecar evidence says it does not; verify in `db/migration/`.
4. DOC-NNN: extend the live S2S authentication doc to explicitly state that filter-ON DOES NOT enforce "this collector can write only to its own datasources" — only "this collector's token is bound to a specific set of datasources at registration."

## Links

- cluster_with: [F-008]
- merged_into: F-008
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-008 (Ingestion-replace destruction surface) — appended the OPERATOR-VISIBLE FRAMING as a new facet `datasource_scoping_is_payload_driven_not_principal_driven_operator_visible_fused_namespace_shb_124` (drift_class: datasource_scoping_is_payload_driven_not_principal_driven). The thread's value is the Datasources-tab fused-namespace UI symptom + the system-mission "security-relevant implicit ADR" elevation; F-008 already carries the destruction-narrative for this scoping shape, so the SHB-124 evidence enriches rather than constitutes a new feature. ADR-NNN draft recommended next (the binary scoping decision is ADR-shaped).

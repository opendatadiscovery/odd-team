# SHB-130 — `odd.tenant-id` does nothing for metric storage on INTERNAL_POSTGRES (the default), making the documented per-tenant scoping a silent no-op for most deployments

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators running multi-tenant deployments configure `odd.tenant-id=tenantA` per the documentation, reasonably assuming this scopes metric writes/reads to that tenant. The implementation routes `odd.tenant-id` ONLY through the PROMETHEUS path (where it becomes a Prometheus label appended at extractor construction time and queried as a Prometheus filter on read). The INTERNAL_POSTGRES path — which is the DEFAULT (`metrics.storage` defaults to `INTERNAL_POSTGRES` via `matchIfMissing=true`) — has NO `tenant_id` column on `metric_series` / `metric_point` / `metric_family` / `metric_label` / `metric_label_value` / `metric_entity` tables. A deployment configured with `odd.tenant-id=tenantA` AND default storage STILL writes all metrics into one untyped Postgres namespace; cross-tenant metric write/read is the default behaviour. F-030 anchors the Metrics Ingestion feature but doesn't enumerate this per-storage-backend tenant-isolation asymmetry as a drift facet.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/InternalIngestionMetricsServiceImpl.java:66` — `@ConditionalOnProperty(name="metrics.storage", havingValue="INTERNAL_POSTGRES", matchIfMissing=true)`. This is the DEFAULT implementation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/ExternalIngestionMetricsServiceImpl.java:56` — `@ConditionalOnProperty(name="metrics.storage", havingValue="PROMETHEUS")`. Opt-in only.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/InternalIngestionMetricsServiceImpl.java:1-295` — verified by ingestMetrics sidecar bugs_limitations_corner_cases[2]: "no tenant_id column in any JOOQ POJO" — `MetricEntityPojo`, `MetricSeriesPojo`, `MetricPointPojo`, `MetricFamilyPojo`, `MetricLabelPojo`, `MetricLabelValuePojo` all lack the field.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/extractors/external/CounterTimeSeriesExtractor.java:22-25` — `@Value("${odd.tenant-id}")` read at extractor BEAN CONSTRUCTION. Only the PROMETHEUS-side extractors consume it. The Internal-side extractors (`CounterMetricsSeriesExtractor` etc.) do not read `odd.tenant-id` at all.
- `odd-platform-api/src/main/resources/application.yml:208-210` — `odd.tenant-id:` is declared empty by default. Operators MAY override it.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (WebFetched 2026-05-20 per ingestMetrics sidecar docs_link_semantic) — lists `odd.tenant-id` semantically as "tenant identifier appended as a Prometheus query label" — implicitly Prometheus-only — but does NOT explicitly state that INTERNAL_POSTGRES ignores it. Operators reading the docs may believe `odd.tenant-id` is universal.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:89-95` — no tenant check at controller; payload pass-through verbatim.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-20 per ingestMetrics sidecar) — `/ingestion/metrics` is uncovered by any filter. Compounds the per-storage tenant-isolation gap.

## Notes

- The asymmetry is structurally invisible at the deployment surface:
  - Operator sees `odd.tenant-id` documented as a tenant scoping mechanism.
  - Operator configures `odd.tenant-id=tenantA`.
  - Operator runs `metrics.storage=INTERNAL_POSTGRES` (default).
  - Metric writes happen with no tenant scoping; cross-tenant reads succeed silently.
  - There is NO startup warning, NO log line, NO admin-visible signal that the configured `odd.tenant-id` has no effect under the current storage backend.
- This is THE SAME CLASS as the LSN-001 attachment-storage default (silent insecure default shipped in the bundled YAML) and LSN-002 (silent SDK default that breaks the documented behaviour). The class signature: operator follows the docs, configures the property, the property does nothing because of an upstream condition the operator didn't know to check.
- Compounded by SHB-130's neighbouring finding (per ingestMetrics sidecar): the endpoint is UNAUTHENTICATED in every supported mode. Combined: any caller can POST metric series for any ODDRN with any labels, and there is no tenant scoping anywhere on the INTERNAL_POSTGRES path. A misbehaving collector on tenant A's network can pollute tenant B's metric history if both share the same `INTERNAL_POSTGRES` storage backend.
- F-030 (Metrics Ingestion) anchors the feature but only at the PROMETHEUS-vs-INTERNAL choice. The drift facet `tenant_id_only_applies_to_prometheus_path` would be a new addition to F-030.
- Additional ingestMetrics-sidecar surface that should not be left orphaned:
  - **ODDRN-by-payload attack** (ingestMetrics bugs_limitations_corner_cases[1]): a caller writes `MetricSet.oddrn = '//literal:any-string'`; no foreign key to `data_entity.oddrn`; arbitrary `metric_entity` rows mint silently. Cardinality DoS on Postgres OR Prometheus. **MEDIUM severity** — separate F-NNN candidate but bundle here as a NOTE.
  - **PII-label propagation** (ingestMetrics bugs_limitations_corner_cases): labels propagated verbatim from payload to storage. `user_email=joe@example.com` ends up in `metric_label_value` table (INTERNAL_POSTGRES) or Prometheus labels (PROMETHEUS). No sanitisation.
  - **Cross-storage migration is one-way and undocumented** — switching `metrics.storage` from INTERNAL_POSTGRES to PROMETHEUS makes pre-switch metric history UNREADABLE; reverse switches orphan Prometheus labels. Same shape as LSN-001 attachment migration drift.
- Fix shape:
  1. Add `tenant_id` column to `metric_series` + `metric_point` + `metric_entity` tables on the INTERNAL_POSTGRES path; populate from `odd.tenant-id` at write time; filter reads.
  2. OR documented as "INTERNAL_POSTGRES does not support tenant isolation; deploy one platform instance per tenant" — explicit operator guidance instead of silent default.
  3. AND a boot-time WARN log when `odd.tenant-id` is non-empty AND `metrics.storage=INTERNAL_POSTGRES`: "The configured tenant-id has no effect on the INTERNAL_POSTGRES storage backend."
- This is `open` because the maintainer call is between option (1) — schema change — and option (2) — documentation + WARN log. The decision needs ADR-level treatment.

## Next

1. Treat as ENRICHER for F-030. Add the drift facet `tenant_id_only_applies_to_prometheus_path` + the operator-visible symptom (configured `odd.tenant-id` has no effect under default storage).
2. ADR-NNN: choose between schema change (add tenant_id columns) vs documentation + WARN log. The choice is reversible if option-2 is chosen first.
3. Probe-NNN: against a local docker-compose mirror with `odd.tenant-id=tenantA` and default storage, ingest a metric for an ODDRN; query Postgres tables directly; confirm NO tenant_id column anywhere.
4. SEC-NNN: implement a boot-time validation log — if `odd.tenant-id` is non-empty AND `metrics.storage=INTERNAL_POSTGRES`, log a WARN with the documented mitigation.
5. DOC-NNN: extend the `configuration-and-deployment/odd-platform` page to explicitly state "INTERNAL_POSTGRES does not honour `odd.tenant-id`; for multi-tenant metric isolation, use `metrics.storage=PROMETHEUS` with a per-tenant Prometheus instance OR deploy one platform per tenant."
6. (separate F-NNN candidate) ODDRN-by-payload cardinality DoS surface — operator-observable as Postgres `metric_entity` row count growth OR Prometheus series count growth, no platform-side cap.

## Links

- cluster_with: [F-030]
- merged_into: (open — likely enriches F-030)
- supersedes: []

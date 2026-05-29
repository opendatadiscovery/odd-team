---
doc_page: "docs/active-platform-features/metrics-ingestion.md"
page_title: "Metrics Ingestion"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/metrics-ingestion"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/metrics-ingestion"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Metrics Ingestion", "Multi-Tenant Configuration (odd.tenant-id)"]
  features: ["F-030"]
  code_nodes:
    - "odd-platform java IngestionController controller-method:ingestMetrics"
    - "odd-platform java CounterTimeSeriesExtractor config-key-consumer:metrics.storage@L20"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (endpoint table, Body size cap row) frames an over-cap body as 'rejected before the controller runs' — code: over-cap payloads throw DataBufferLimitException surfacing as HTTP 500 (not 413, not a clean pre-controller rejection). The same 20 MB codec budget also bounds the OUTBOUND Prometheus remote-write, so a <20 MB inbound payload with high label cardinality can still fail at the >20 MB outbound WriteRequest. Evidence: application.yml:14-15 (spring.codec.max-in-memory-size: 20MB) + node `odd-platform java IngestionController controller-method:ingestMetrics` finding:bugs_limitations_corner_cases[3] + finding:performance.known_performance_gaps (codec-budget-shared bullet)."
  - "Page omits that an empty MetricSetList (items: []) silently returns 201 Created (a no-op), asymmetric with POST /ingestion/entities which 400s via BadUserRequestException('Ingestion payload is empty'). An operator pinging the endpoint to confirm liveness cannot distinguish a real write from a no-op. Operator-relevant on an unauthenticated write surface. Evidence: node ingestMetrics finding:bugs_limitations_corner_cases (no empty-payload 400 bullet) + InternalIngestionMetricsServiceImpl.java:80-82 + ExternalIngestionMetricsServiceImpl.java:86-88 + IngestionController.java:90-95 (no .switchIfEmpty guard)."
  - "Page omits that the endpoint performs NO validation that a MetricSet.oddrn belongs to a registered data entity — a caller can mint arbitrary metric_entity rows (Postgres) / arbitrary Prometheus series for non-existent ODDRNs (cardinality-pollution / DoS). Compounds the unauthenticated-write caveat the page does document. Evidence: node ingestMetrics finding:bugs_limitations_corner_cases (no ODDRN existence check bullet, MEDIUM) + InternalIngestionMetricsServiceImpl.java:86-88 (registerMetricEntityOddrns creates rows with no existence check; no FK metric_entity.entity_oddrn → data_entity.oddrn)."
maintainer_curated: false
---

# Metrics Ingestion — doc understanding

This page is the operator-facing narrative for the metrics-ingestion surface that the
graph already models as feature **F-030** and concept **"Metrics Ingestion"**
(concepts.yaml:1107). It documents the inbound push endpoint `POST /ingestion/metrics`
(node `odd-platform java IngestionController controller-method:ingestMetrics`), the
two boot-time storage backends gated by `metrics.storage`
(`InternalIngestionMetricsServiceImpl` default-on `matchIfMissing=true` vs
`ExternalIngestionMetricsServiceImpl` PROMETHEUS), and the per-entity Metrics-tab read
surface. The page is exceptionally well-grounded: its three "Known operator caveats"
map one-to-one onto F-030's enumerated drift classes and the ingestMetrics sidecar's
`finding:security` / `finding:bugs_limitations_corner_cases`, and every load-bearing
claim verified against primary source.

Confirmed accurate against code (independently re-grepped, not just sidecar-cited):
- **20 MB body cap** ← `application.yml:15` `max-in-memory-size: 20MB`.
- **Invalid `metrics.storage` → boot failure (`NoSuchBeanDefinitionException`)** ← the
  mirrored `@ConditionalOnProperty` on `InternalIngestionMetricsServiceImpl.java:66`
  (`INTERNAL_POSTGRES`, `matchIfMissing=true`) + `ExternalIngestionMetricsServiceImpl.java:56`
  (`PROMETHEUS`); a value outside the enum wires neither bean and the controller's
  `@Autowired IngestionMetricsService` fails at startup.
- **Tenant isolation is PROMETHEUS-only; `INTERNAL_POSTGRES` has no `tenant_id` column** ←
  concept "Multi-Tenant Configuration (odd.tenant-id)" (concepts.yaml:1187) + invariant
  node `tenant-isolation-nonexistent-on-default-backend-internal-postgres`; `odd.tenant-id`
  is consumed only at the PROMETHEUS extractor layer (`CounterTimeSeriesExtractor.java:20`
  `@ConditionalOnProperty(metrics.storage, PROMETHEUS)`, `@Value("${odd.tenant-id}")`),
  `application.yml:210` (`tenant-id:` empty default).
- **`POST /ingestion/metrics` unauthenticated under every `auth.type`; `auth.ingestion.filter.enabled`
  matches only `/ingestion/entities`** ← `SecurityConstants.java:96` whitelists `/ingestion/**`,
  applied via `AuthorizationCustomizer.java:22`; `IngestionDataEntitiesFilter.java:28`
  binds `new PathPatternParserServerWebExchangeMatcher("/ingestion/entities", POST)` only.
  This is the page's central HIGH-severity caveat and it is exactly correct.
- **Storage switch is one-way; history does not migrate** ← `InternalMetricReader` (default)
  vs `ExternalMetricReader` (PROMETHEUS) read from different stores; no migration tooling
  (ingestMetrics sidecar `finding:bugs_limitations_corner_cases`, cross-storage-migration bullet).

The page also corrects a stale path in the concept catalog implicitly: the live contract
path is `/ingestion/metrics` (ground-truth `BaseIngestionTest.java:92`), whereas
`concepts/detail/entities/metrics-ingestion.yaml:80,150` still reference
`/ingestion/metric_sets` — the page uses the correct `/ingestion/metrics` throughout.

Drift recorded in frontmatter is narrow: one claim-vs-code mismatch (the 20 MB "rejected
before the controller runs" framing vs the actual HTTP-500 `DataBufferLimitException`,
plus the unmentioned outbound-codec bound) and two operator-critical omissions on this
unauthenticated write surface (empty-payload silent 201; no ODDRN-existence validation).
These feed `doc-gaps.md` as DOC-NNN candidates; the page's existing three caveats are
sound and need no correction.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

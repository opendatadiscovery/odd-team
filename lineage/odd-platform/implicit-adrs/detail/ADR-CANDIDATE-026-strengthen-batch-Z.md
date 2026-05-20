## ADR-CANDIDATE-026 — STRENGTHENED BATCH Z — Mirrored-bean `@ConditionalOnProperty` boot-time storage-backend selection is applied at TWO LEVELS, not one — the SERVICE-INTERFACE level (`IngestionMetricsService` impl pair) confirms the pattern from one level above the per-MetricType extractor pair where ADR-026 originally surfaced

**Severity unchanged**: HIGH
**Updated support count**: now **2-LEVEL CROSS-TIER triangulation** (1 prior at batch B/C extractor level + 1 batch Z service-interface level)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
- `ingestMetrics.md:concepts.invariants.[1]` (HIGH) — "Service dispatch is BOOT-TIME via mirrored `@ConditionalOnProperty(name = \"metrics.storage\")` on the two `IngestionMetricsService` implementations. `InternalIngestionMetricsServiceImpl.java:66` declares `havingValue = \"INTERNAL_POSTGRES\", matchIfMissing = true` (default-on); `ExternalIngestionMetricsServiceImpl.java:56` declares `havingValue = \"PROMETHEUS\"`. The two beans are mutually exclusive at the Spring-container level; a value outside the enumeration (e.g. `metrics.storage=ELASTICSEARCH`) produces a zero-implementation configuration and the controller's `@Autowired` dependency fails at boot with `NoSuchBeanDefinitionException`."
- `ingestMetrics.md:implicit_adrs.[0]` (HIGH) — "Service-tier dispatch via mirrored `@ConditionalOnProperty` on the IngestionMetricsService interface — boot-time storage-backend selection, not request-time branching" — evidence: InternalIngestionMetricsServiceImpl.java:66 (`@ConditionalOnProperty(name = \"metrics.storage\", havingValue = \"INTERNAL_POSTGRES\", matchIfMissing = true)`) + ExternalIngestionMetricsServiceImpl.java:56 (`@ConditionalOnProperty(name = \"metrics.storage\", havingValue = \"PROMETHEUS\")`) — intent_anchor: "the `matchIfMissing = true` on the INTERNAL_POSTGRES side encodes default-on stance; the maintainer chose to gate at the @Service-interface level (one bean of the interface wired per deployment) rather than at the controller (which would branch inside `ingestMetrics`). Adding a third storage mode is an add-a-class change, mirrored against the existing pattern — consistent with the per-MetricType extractor design decision captured in CounterTimeSeriesExtractor sidecar's implicit_adrs.[0] (same mirrored-bean pattern, one level deeper)."

**Cross-batch picture — TWO-LEVEL MIRRORED-BEAN PATTERN**:

**Level 1 — Service-interface tier (NEW batch Z)**: `IngestionMetricsService` interface has TWO mirrored implementations:
- `InternalIngestionMetricsServiceImpl` (`@ConditionalOnProperty(value="metrics.storage", havingValue="INTERNAL_POSTGRES", matchIfMissing=true)`) — default-on
- `ExternalIngestionMetricsServiceImpl` (`@ConditionalOnProperty(value="metrics.storage", havingValue="PROMETHEUS")`)

**Level 2 — Per-MetricType extractor tier (ORIGINAL batch B/C)**: Inside whichever service impl wires, 4 MetricType extractor beans per side:
- `extractors/internal/{Counter,Gauge,Histogram,Summary}MetricsSeriesExtractor` — INTERNAL_POSTGRES variants (default-on via `matchIfMissing=true`)
- `extractors/external/{Counter,Gauge,Histogram,Summary}TimeSeriesExtractor` — PROMETHEUS variants

**Total: 10 mirrored beans (2 services + 8 extractors) all gated by the same `metrics.storage` property** — the architectural commitment is COMPOSED across both levels: service-interface and per-MetricType dispatch. A future maintainer adding a third storage backend (e.g. ELASTICSEARCH) must add: (a) a service-interface-tier impl + (b) 4 per-MetricType extractor beans for that backend. The dispatcher does not need editing; the pattern self-extends.

**The architectural opinion sharpens**:
1. **Default-on placement** (`matchIfMissing=true` on INTERNAL_POSTGRES side at BOTH levels) — consistent. The maintainer's bias toward "operator who never mentions `metrics.storage` runs the internal backend" is structurally encoded twice.
2. **Mutual exclusion via Spring DI** (not via runtime `if-then-else`) — consistent at both levels. The choice is made AT BOOT, not at request time.
3. **Extensibility seam at BOTH levels** — adding a third backend adds beans, not switch-case branches. The pattern composes recursively.

**Severity unchanged at HIGH** — the cross-tier triangulation (service-interface + per-MetricType extractor) is the strongest evidence yet that the mirrored-bean `@ConditionalOnProperty` pattern is the platform's canonical convention for boot-time storage-backend selection. Cross-link with ADR-CANDIDATE-012 (attachment storage — sibling pattern) is now even more direct — both apply the same Spring idiom at the service-interface level.

**Updated proposed action**: Strengthen the existing `adrs/drafts/metric-storage-conditional-wiring.md` candidate to document the TWO-LEVEL pattern explicitly. The architectural commitment is not just "extractors are mirrored"; it is "the WHOLE metrics-storage subsystem is mirrored at every layer that touches the storage backend distinction" — service-interface, per-MetricType, possibly per-MetricFamily extractors at level 3 if a future need emerges.

---

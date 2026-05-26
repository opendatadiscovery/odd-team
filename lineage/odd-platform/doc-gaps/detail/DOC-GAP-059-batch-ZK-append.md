## STRENGTHENS — HousekeepingTTLProperties config-properties sidecar provides the PRIMARY-SOURCE confirmation refresh in batch ZK

DOC-GAP-059 (batch D, 2026-05-12) established the Java-side `private int` field declaration vs the bundled `application.yml:168-170` `30`-day floor. Batch ZK refreshes the primary source via the HousekeepingTTLProperties config-properties-class sidecar at substrate commit `ede5d277` and confirms ALL load-bearing claims unchanged. The drift is now PRIMARY-SOURCE re-confirmed at 2026-05-26.

### Added surfaced_by (new sidecar cited)

- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:concepts.invariants[0]` — **NEW PRIMARY SOURCE — RE-CONFIRMATION**: "Three fields, all primitive `int`, all defaulted to `30` in `application.yml:168-170`. NO `= 30` initializer in the Java source — Java-side default is `0`, the safety floor lives at the YAML layer only (HousekeepingTTLProperties.java:9-11)." Verbatim primary-source citation matches DOC-GAP-059's existing evidence.
- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[Java-side default mismatch]` (HIGH per sidecar — verbatim quote of the LSN-001 silent-data-loss class).
- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:stress_findings.tunables.resolvedAlertsDays.[N=0]` — STATIC-INFERRED operator-impact at the boundary: "AlertHousekeepingJob.java:32-33 computes cutoff = `now() - 0 days` = `now()`. Predicate becomes `STATUS=RESOLVED OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= now())` — on the next 15-min cycle, ALL RESOLVED alerts AND ALL RESOLVED_AUTOMATICALLY alerts that completed before the cycle began are deleted. Operator sees: 'all resolved alerts vanished about 15 minutes after I edited my config' — LSN-001-shape silent data loss."
- `odd-platform__java__housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[Java vs YAML default mismatch]` — verbatim doc-side gap quote re-confirmed at 2026-05-26.

### New evidence (supplementary)

- **WebFetch re-verification 2026-05-26**: per HousekeepingTTLProperties sidecar `docs_link_semantic.inferred_docs[0]` — `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` status **200**. Verbatim doc copy unchanged from batch D: "Integer, days. Defaults to `30`." The live page continues to document the `30` value but does NOT clarify where the default LIVES (Java initializer vs bundled YAML). The 14-day stale-probe window has not closed the gap.
- **Cross-confirmation via the THREE TTL fields (re-confirmed at boundary)**: per sidecar stress_findings.tunables, ALL three fields (`resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays`) silently rebind to 0 under the same YAML-override pattern. The blast radius is:
  - All RESOLVED + RESOLVED_AUTOMATICALLY alerts (compounded by DOC-GAP-062's precedence bug)
  - All search-facets entries with `LAST_ACCESSED_AT <= now()` (i.e. all of them)
  - All soft-deleted data entities cascading through ~25 child tables (including S3 attachment deletion per LSN-001)
- The HousekeepingTTLProperties sidecar adds NEW DEPENDENCY-CONFIRMATION: the POJO is bound only when `housekeeping.enabled=true` is set AND the `ODDPlatformConfiguration` class is registered (`@EnableConfigurationProperties` registry). Per sidecar concepts.invariants: "POJO registered via `@EnableConfigurationProperties({MetricExporterProperties.class, HousekeepingTTLProperties.class})` at ODDPlatformConfiguration.java:13-16 (NOT via `@ConfigurationPropertiesScan` and NOT via `@Component`)" — the registration mechanism is an additional load-bearing detail.

### Severity update

Severity remains **HIGH** — primary-source re-confirmation does not change the assessment. Batch ZK confirms the gap persists at 2026-05-26.

---

**Batch ZK contribution**: 1 NEW PRIMARY SOURCE re-confirmation (HousekeepingTTLProperties sidecar at substrate commit `ede5d277`); coverage unchanged (1 sidecar); evidence chain reinforced; severity unchanged (HIGH).

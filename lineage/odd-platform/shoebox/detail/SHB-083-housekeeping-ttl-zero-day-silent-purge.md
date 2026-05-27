# SHB-083 — Housekeeping TTL Java-vs-YAML default mismatch silently deletes all historical state on operator-customised config

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators who override the shipped `application.yml` (Helm chart, `--spring.config.location=`, Kubernetes ConfigMap mount, Spring Cloud Config) without re-supplying the `housekeeping.ttl.*` block see all RESOLVED alerts, all search-facets entries, and all soft-deleted DataEntities (with ~25-table cascade including ownership / lineage / metrics / attachments) purged within 15 minutes of platform boot — silently, with no log above DEBUG. The shipped `application.yml:168-170` is the SOLE place the `30`-day default lives; the `HousekeepingTTLProperties` Java class declares `private int` fields with no initialiser, so Spring binds the primitive default `0`, the next 15-minute housekeeping cycle computes cutoff = `now() - 0 days = now()`, and the predicate `STATUS_UPDATED_AT <= now()` matches every row.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/config/HousekeepingTTLProperties.java:8-12` — three `private int resolvedAlertsDays;`, `private int searchFacetsDays;`, `private int dataEntityDeleteDays;` with NO `= 30` initialiser; Lombok `@Data`.
- `odd-platform-api/src/main/resources/application.yml:166-170` — the ONLY place `housekeeping.enabled: true` + the three `30` TTL defaults are shipped.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/AlertHousekeepingJob.java:32-33` + `SearchFacetsHousekeepingJob.java:25-26` + `DataEntityHousekeepingJob.java:73` — three call sites consuming the three primitive-int getters; cutoff = `DateTimeUtil.generateNow().minusDays(N)` (or `DSL.currentOffsetDateTime().minus(N)`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/service/HousekeepingJobManager.java:25-26` — `@Scheduled(fixedRate = 15, timeUnit = MINUTES)` + `@SchedulerLock(name = "housekeepingJob", lockAtLeastFor = "14m", lockAtMostFor = "14m")` — first cycle fires ~15 min after boot.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/DataEntityHousekeepingJob.java:71-128, 142` — ~25-table cascade including `fileUploadService.deleteFiles(filePojos).block()` against MinIO/S3.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/service/HousekeepingJobManager.java:30, 45` — manager logs only at `log.debug` (success) and `log.error` (per-job failure); successful destructive cycles are silent.

## Notes

- LSN-001-shape exactly: silent default + immediate destructive action + no preview + no dry-run + no metric. The fix is one-line per field (`private int resolvedAlertsDays = 30;`) OR `@DefaultValue("30")` (Spring Boot 2.6+).
- Compounds with the `AlertHousekeepingJob` jOOQ-precedence bug (SHB-096 sibling): even with `30` correctly set, manual `RESOLVED` alerts are deleted on every cycle regardless of TTL.
- Compounds with the `housekeeping.enabled` strict-opt-in semantics (`@ConditionalOnProperty` with NO `matchIfMissing`) — operator-customised application.yml that omits the master switch silently disables housekeeping; one that includes it but omits the TTL block silently zero-day purges. The two failure modes share the same root cause: defaults live in YAML, not Java.
- `@Min(0)` / `@Validated` on the POJO would catch operator-typo'd negative values (`-1` produces cutoff = `now() + 1 day`, matching all rows).
- Live docs (WebFetched 2026-05-26) say "Defaults to 30" — true ONLY when shipped application.yml is the resolved config. An operator reading the docs sees no warning that the 30-day floor is YAML-supplied, not Java-supplied.
- Cross-link: F-010 (housekeeping TTL purge) anchors the cycle but does NOT enumerate this drift class — F-010 describes WHAT the cycle does, not the silent zero-day-purge scenario when defaults are missing.

## Next

1. **ENRICH F-010** with this drift facet (`java_vs_yaml_default_mismatch_silent_zero_day_purge`) — the existing flow describes the 5 jobs + 15-min cadence but not the catastrophic-default-on-override scenario. Severity: HIGH because (a) common deployment pattern (Helm charts overlay application.yml), (b) destructive cascade includes attachments + lineage + ownership, (c) no observable signal at default log level.
2. **Probe**: stand up the platform with `--spring.config.location=` pointing at a minimal config that omits `housekeeping.ttl.*` block; seed a few RESOLVED alerts + soft-deleted entities; observe the 15-min cycle; confirm purge occurs.
3. **REFACTOR-NNN**: promote `= 30` into the Java class OR add `@DefaultValue("30") @Min(0) @Validated` on each field — two-line fix, prevents class.
4. **DOC-NNN**: update `/configuration-and-deployment/odd-platform#housekeeping` to warn that overriding application.yml requires re-supplying the housekeeping.ttl block.

## Links

- cluster_with: [F-010, SHB-096]
- merged_into: F-010
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — Java vs YAML default mismatch is a new drift facet on F-010 (Housekeeping TTL Enforcement). F-010 already anchors the 5-job cycle; this is a primary-source enrichment of the silent-zero-day-purge scenario when operators override application.yml without re-supplying the `housekeeping.ttl.*` block. F-010: shoebox_extensions_2026_05_26 → drift_class: java_vs_yaml_default_mismatch_silent_zero_day_purge_on_application_yml_override. Category flipped clustering → merged.

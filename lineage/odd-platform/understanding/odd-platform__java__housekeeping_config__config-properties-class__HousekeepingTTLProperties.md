---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.config config-properties-class:HousekeepingTTLProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: stress-complete
confidence_overall: MEDIUM
session_id: session-2026-05-26-batch-ZK
---

# HousekeepingTTLProperties (`@ConfigurationProperties("housekeeping.ttl")`) — semantic understanding

## understanding

`HousekeepingTTLProperties` is the Spring Boot typed binding for the `housekeeping.ttl.*` YAML namespace — a 12-line `@Data` POJO carrying exactly three `private int` fields (`resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays`), each defaulted to `30` in the shipped `application.yml:167-170` and bound at boot via `@EnableConfigurationProperties(HousekeepingTTLProperties.class)` at `ODDPlatformConfiguration.java:13-15`. It is consumed by exactly three of the five `HousekeepingJob` beans the `HousekeepingJobManager` (`@ConditionalOnProperty("housekeeping.enabled", havingValue = "true")`, `@Scheduled(fixedRate = 15, timeUnit = MINUTES)`, ShedLock `lockAtLeastFor = "14m" / lockAtMostFor = "14m"`) discovers and fans out on every 15-minute cycle: `AlertHousekeepingJob` reads `resolvedAlertsDays`; `SearchFacetsHousekeepingJob` reads `searchFacetsDays`; `DataEntityHousekeepingJob` reads `dataEntityDeleteDays`. **The other two HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` — do NOT consume this POJO; they drop empty past partitions via `PartitionService.getEmptyPastPartitions` regardless of age, and there is no `activity*Days` / `messageDays` field anywhere in this class.** The prompt's mention of "activity/alert partition eviction" is misleading on the activity side: this POJO has nothing to do with partition retention; it controls row-by-age deletion on three non-partitioned audit/state tables only.

## concepts

- entities: [HousekeepingTTLProperties, HousekeepingJobManager, HousekeepingJob (interface), AlertHousekeepingJob, SearchFacetsHousekeepingJob, DataEntityHousekeepingJob, EmptyPartitionsHousekeepingJob, ActivityEmptyPartitionsHousekeepingJob, MessageEmptyPartitionsHousekeepingJob, ODDPlatformConfiguration (@EnableConfigurationProperties registrar), ALERT table, ALERT_CHUNK table, SEARCH_FACETS table, DATA_ENTITY table (+ ~25 cascaded child tables), ACTIVITY table, MESSAGE table]
- operations: [bind housekeeping.ttl.resolved_alerts_days → int resolvedAlertsDays, bind housekeeping.ttl.search_facets_days → int searchFacetsDays, bind housekeeping.ttl.data_entity_delete_days → int dataEntityDeleteDays, supply per-cycle cutoff to three jOOQ DELETE chains, register POJO via @EnableConfigurationProperties at boot]
- invariants:
  - "Three fields, all primitive `int`, all defaulted to `30` in `application.yml:168-170`. NO `= 30` initializer in the Java source — Java-side default is `0`, the safety floor lives at the YAML layer only (HousekeepingTTLProperties.java:9-11)."
  - "Snake_case-to-camelCase Spring relaxed-binding maps `resolved_alerts_days` ↔ `resolvedAlertsDays`, `search_facets_days` ↔ `searchFacetsDays`, `data_entity_delete_days` ↔ `dataEntityDeleteDays` (verified by application.yml:168-170 binding successfully against the Java field names — confirmed at runtime in shipped configs)."
  - "POJO registered via `@EnableConfigurationProperties({MetricExporterProperties.class, HousekeepingTTLProperties.class})` at ODDPlatformConfiguration.java:13-16 (NOT via `@ConfigurationPropertiesScan` and NOT via `@Component` — Spring DI of this bean depends on `ODDPlatformConfiguration` being on the component scan)."
  - "The POJO is consumed by exactly THREE beans: `AlertHousekeepingJob` (line 21), `SearchFacetsHousekeepingJob` (line 17), `DataEntityHousekeepingJob` (line 64 — named `properties`). The two empty-partition jobs DO NOT inject this POJO."
  - "Subsystem master gate (`housekeeping.enabled`) lives OUTSIDE this POJO at `HousekeepingJobManager.java:18` (`@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")`, NO `matchIfMissing`). Default `true` in `application.yml:166` ships housekeeping ON; integration-test profile flips it to `false`."
  - "All three jOOQ chains use the same cutoff pattern: `DateTimeUtil.generateNow().minusDays(ttl)` (or `DSL.currentOffsetDateTime().minus(ttl)` for SearchFacets — jOOQ binds the integer as DAYS per the official manual). Cutoff is server-local-time UTC per `DateTimeUtil.generateNow` (`OffsetDateTime.now().atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime()` at DateTimeUtil.java:11-13)."
  - "`AlertHousekeepingJob` jOOQ predicate has a load-bearing precedence shape `.where(STATUS=RESOLVED).or(STATUS=RESOLVED_AUTOMATICALLY).and(STATUS_UPDATED_AT<=cutoff)` (lines 30-33). SQL operator precedence: `AND` binds tighter than `OR`. The resulting SQL is `WHERE (STATUS='RESOLVED') OR ((STATUS='RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))` — the TTL gate is bypassed for manual `RESOLVED` rows; they are deleted on the next 15-minute cycle regardless of `resolvedAlertsDays`. WebFetched docs page (2026-05-26 status 200) explicitly acknowledges this bug."
- audiences: [odd-platform operators tuning database growth, DBAs sizing the ALERT / SEARCH_FACETS / DATA_ENTITY tables, compliance / data-retention reviewers, https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform readers]

## dependencies_semantic

- requires-feature:
  - "Alert subsystem — `AlertHousekeepingJob.java:28-34` consumes `ALERT.STATUS` (`RESOLVED` / `RESOLVED_AUTOMATICALLY` codes), `ALERT.STATUS_UPDATED_AT`, `ALERT.ID` from the Alert state-machine."
  - "Search-facets feature — `SearchFacetsHousekeepingJob.java:23-27` consumes `SEARCH_FACETS.LAST_ACCESSED_AT` (added by migration V0_0_52__introduce_housekeeping.sql)."
  - "Data-entity soft-delete subsystem — `DataEntityHousekeepingJob.java:75-78` consumes `DATA_ENTITY.STATUS = DataEntityStatusDto.DELETED.getId()` + `STATUS_UPDATED_AT`."
  - "`HousekeepingJobManager` orchestrator — discovers `List<HousekeepingJob>` beans via constructor injection (HousekeepingJobManager.java:23); each consumer of this POJO is registered as a `@Component`."
- requires-config:
  - "`housekeeping.enabled` — boolean, default `true` in `application.yml:166`; gates the entire `HousekeepingJobManager` bean via `@ConditionalOnProperty(havingValue = \"true\")` (no `matchIfMissing`). NOT a field on this POJO."
  - "`housekeeping.ttl.resolved_alerts_days` — int days, no Java-side default (`private int resolvedAlertsDays;` line 9), YAML default `30` at application.yml:168."
  - "`housekeeping.ttl.search_facets_days` — int days, no Java-side default (line 10), YAML default `30` at application.yml:169."
  - "`housekeeping.ttl.data_entity_delete_days` — int days, no Java-side default (line 11), YAML default `30` at application.yml:170."
  - "Spring relaxed-binding for snake_case YAML → camelCase Java field names."
- requires-runtime:
  - "Spring Boot scheduling subsystem — required for the 15-minute `@Scheduled(fixedRate = 15, timeUnit = MINUTES)` cycle at HousekeepingJobManager.java:25 (enabled via `@EnableScheduling` at SchedulingConfiguration.java:13)."
  - "ShedLock with PG-backed `JdbcTemplateLockProvider` (SchedulingConfiguration.java:17-25) — required for multi-instance correctness of the `housekeepingJob` lock at HousekeepingJobManager.java:26."
  - "PostgreSQL — all three TTL-consuming jobs issue jOOQ DELETE statements; `DataEntityHousekeepingJob` issues ~25 cascaded DELETEs in a single jOOQ transaction (DataEntityHousekeepingJob.java:71-129)."
- coupling:
  - "**Conceptual sibling — not consumer — of `ActivityTablePartitionManager` (`odd.activity.partition-period`) and `MessageTablePartitionManager` (`datacollaboration.message-partition-period`)**: those control partition WIDTH on activity/message; the partition-empty-drop jobs (`ActivityEmptyPartitionsHousekeepingJob`, `MessageEmptyPartitionsHousekeepingJob`) participate in the same housekeeping scheduler but DO NOT consume this POJO. Time-based retention for activity/message rows does not exist anywhere — partition-empty-drop requires `COUNT(*) = 0` (PartitionServiceImpl.java:133-141) before drop."
  - "Shared 15-minute scheduling cadence + shared single `Connection` (HousekeepingJobManager.java:32) across all five HousekeepingJob beans — a slow `DataEntityHousekeepingJob` cascade blocks the other four jobs in the same cycle."
  - "**Operator-trap coupling with LSN-001 attachment-storage default** — `DataEntityHousekeepingJob.deleteFiles` (lines 131-143) calls `fileUploadService.deleteFiles(filePojos).block()` to remove stored attachments when an entity is purged. If `attachment.storage` is LOCAL ephemeral default (LSN-001), file-deletion is a no-op; if REMOTE, the housekeeping job hard-deletes the S3 object."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Spring binding: `housekeeping.ttl.resolved_alerts_days=7` from YAML flows to `AlertHousekeepingJob.housekeepingTTLProperties.getResolvedAlertsDays() == 7`."
    test_class: integration
    criticality: MEDIUM
    note: "Standard Spring binding; rare to break, but the snake_case-to-camelCase mapping has no positive test."
  - behaviour: "Default propagation: with `housekeeping.enabled=true` and ALL `housekeeping.ttl.*` keys absent (env-var-only deploy, no application.yml override of the bundled file), the three fields bind to `0` (Java primitive default) and the next housekeeping cycle deletes all RESOLVED alerts + all search-facets last-accessed before now() + all soft-deleted data entities — zero-day retention silently."
    test_class: integration
    criticality: CRITICAL
    note: "LSN-001-shape silent-data-loss. Promoting `= 30` initializers into the Java declaration would close this; no test asserts the current behaviour and no test would catch a regression that did."
  - behaviour: "Master-gate: `housekeeping.enabled=false` (or absent — no `matchIfMissing`) does NOT register `HousekeepingJobManager` bean; no housekeeping runs at all."
    test_class: integration
    criticality: MEDIUM
    note: "The integration-test profile flips to `false` (application-integration-test.yml:7-8) but uses this for opt-OUT — no positive assertion that the OPT-OUT actually disables all five jobs."
  - behaviour: "`AlertHousekeepingJob` jOOQ operator-precedence — confirm the SQL emitted: `WHERE (STATUS='RESOLVED') OR ((STATUS='RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))`. Manual `RESOLVED` rows deleted on next cycle regardless of TTL."
    test_class: integration
    criticality: HIGH
    note: "Live docs page acknowledges this bug; no regression test pins the current behaviour, and no test would validate a future parenthesisation fix."
  - behaviour: "`SearchFacetsHousekeepingJob.minus(int)` jOOQ binding — confirm `DSL.currentOffsetDateTime().minus(30)` renders as PostgreSQL `current_timestamp - interval '30 days'` (not `current_timestamp - 30` literal seconds)."
    test_class: unit
    criticality: HIGH
    note: "If jOOQ ever changed `.minus(Number)` semantics from days to e.g. seconds, the search-facets table would never evict (cutoff would be ~30 seconds ago instead of 30 days ago). Manual + autoincrement (jooq.org/doc) confirms days; pin with a SQL-snapshot test."
  - behaviour: "`DataEntityHousekeepingJob` ~25-table cascade completeness — for each future schema migration that adds a child table referencing DATA_ENTITY by FK, confirm a corresponding `deleteX(...)` step exists in `deleteDataEntities`."
    test_class: integration
    criticality: HIGH
    note: "An integration test seeding a soft-deleted DataEntity with rows in every cascaded child table and asserting ALL are removed would catch migration-drift."
  - behaviour: "ShedLock multi-instance race — two instances boot simultaneously, both attempt housekeeping at minute 0; only one acquires the lock, the other no-ops."
    test_class: integration
    criticality: MEDIUM
    note: "Single-JVM ShedLock tests are not equivalent — needs a multi-process or two-DataSource test."
- test_files: []
- gaps: |
    A grep against `odd-platform-api/src/test/java` for any of `HousekeepingTTLProperties`,
    `HousekeepingJobManager`, `HousekeepingJob`, `AlertHousekeepingJob`,
    `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`,
    `EmptyPartitionsHousekeepingJob`, `ActivityEmptyPartitionsHousekeepingJob`,
    `MessageEmptyPartitionsHousekeepingJob` returns ZERO matches. The entire
    housekeeping subsystem — including a known production bug acknowledged
    on the live docs page (manual RESOLVED alerts ignored by TTL) — has no
    positive test coverage. Integration tests flip `housekeeping.enabled: false`
    to OPT OUT of the subsystem, not to exercise it.

    The worst test_class gap is **integration** — every claim the docs page
    makes about behaviour (`30-day default`, `15-minute cycle`, `ShedLock
    serialisation`, `three cleanup tasks`) is currently un-asserted. The
    highest-leverage gap is the **Java-vs-YAML default mismatch**: a single
    integration test that asserts "no YAML present → housekeeping does not
    delete anything" (or, equivalently, "no YAML present → fields bind to
    `0` and the test SHOULD catch the silent-data-loss") would inform
    whether the maintainer should promote `= 30` into the Java class.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#housekeeping"
    rationale: "Canonical configuration-reference page for ODD Platform; the live page documents all four housekeeping keys (`housekeeping.enabled`, `housekeeping.ttl.resolved_alerts_days`, `housekeeping.ttl.search_facets_days`, `housekeeping.ttl.data_entity_delete_days`) with their `30`-day defaults and acknowledges the AlertHousekeepingJob jOOQ-precedence bug."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-26):
      - "`housekeeping.ttl.resolved_alerts_days` — Specifies how long alerts
        remain after being resolved before permanent deletion. The docs note:
        'Integer, days. Defaults to `30`.' However, there's a caveat: manual
        resolutions currently bypass the retention check due to a platform bug."
      - "`housekeeping.ttl.search_facets_days` — Controls retention of saved
        search-facet entries based on last access time. The configuration
        states: 'Integer, days. Defaults to `30`.'"
      - "`housekeeping.ttl.data_entity_delete_days` — Manages how long
        soft-deleted entities persist before permanent removal along with
        cascading related data. This defaults to: 'Integer, days. Defaults
        to `30`.'"
      - "All three TTL settings share a uniform default of 30 days. The
        housekeeping job itself runs every 15 minutes and is guarded by a
        ShedLock to prevent duplicate execution in multi-instance deployments."

      The page does NOT mention:
      - The Java-vs-YAML default mismatch — the `30` floor lives in the
        bundled `application.yml`, not in the Java class declaration. An
        operator who overrides `application.yml` without re-supplying
        `housekeeping.ttl.*` binds `0` silently.
      - The EmptyPartitionsHousekeepingJob beans — the page describes
        only the three TTL-driven cleanup tasks; the two partition-empty-drop
        jobs (activity, message) participate in the same 15-min cycle but
        are not enumerated.
      - The `lockAtMostFor = "14m"` vs `fixedRate = 15m` proximity — a
        14m+ cascade releases the lock prematurely and allows overlapping
        cycles across instances.
      - A tracking GitHub issue, fix-roadmap entry, or workaround for the
        acknowledged AlertHousekeepingJob bug.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "#configuration"
    rationale: "Cross-feature reference — the activity-feed page claims `odd.activity.partition-period` controls 'retention and partitioning'. This sidecar confirms from the housekeeping side that **no activity row-retention exists** — this POJO has no `activity*Days` field, and `ActivityEmptyPartitionsHousekeepingJob` requires partitions to already be empty before dropping."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Cross-confirmed against this node: the platform's housekeeping TTL
      surface explicitly does NOT include an activity-feed field, and the
      `ActivityEmptyPartitionsHousekeepingJob` (the only activity-touching
      housekeeping path) drops empty past partitions only.
- doc_drift_findings:
  - "**Activity-feed retention drift (cross-confirmed from second angle)**: the activity-feed live page claims 'Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`'. The code-side reality, viewed from this housekeeping POJO: the entire `housekeeping.ttl.*` surface contains exactly three fields and NONE targets ACTIVITY. The only activity-touching housekeeping path is `ActivityEmptyPartitionsHousekeepingJob`, which requires `COUNT(*) = 0` before dropping (PartitionServiceImpl.java:133-141). There is NO code path that deletes activity rows by age. Suggested DOC-NNN: rewrite the activity-feed Configuration section to state explicitly that ODD does NOT currently retention-delete activity rows."
  - "**Housekeeping job count mismatch — docs say 'three cleanup tasks', code has FIVE HousekeepingJob beans**: the canonical /configuration-and-deployment/odd-platform docs describe housekeeping as 'three cleanup tasks: resolved alerts, search-facet history, and soft-deleted data entities'. The code reality is FIVE `HousekeepingJob` beans — the three above PLUS `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob`. An operator cannot learn from this page that the same 15-min schedule that purges alerts also drops empty activity/message partitions."
  - "**Java vs YAML default mismatch is undocumented**: docs say 'Integer, days. Defaults to `30`'. Java declares `private int resolvedAlertsDays;` (no `= 30` initializer) — the `30` floor lives ONLY in the shipped `application.yml:168-170`. An operator overriding `application.yml` without re-supplying the `housekeeping.ttl` block silently rebinds to `0` and turns housekeeping into immediate hard-delete-everything-past-now(). Either (a) doc the default-lives-in-bundled-YAML caveat, OR (b) move the default into the Java declaration."
  - "**AlertHousekeepingJob jOOQ-precedence bug acknowledged but un-tracked**: docs acknowledge 'manual RESOLVED alerts are hard-deleted on the next housekeeping run regardless of this value' (referring to `resolved_alerts_days`). Code site is AlertHousekeepingJob.java:28-34. The acknowledgement carries no GitHub issue link, no `// FIXME` / `// TODO` in source, no workaround. Operators have no way to track resolution. Suggested DOC-NNN: link the acknowledgement to a tracked upstream issue + add an inline `// TODO(bug-NNN): operator-precedence — manual RESOLVED bypasses TTL` comment in source."

## implicit_adrs

- "Housekeeping and partition-management are kept as TWO distinct lifecycle subsystems — `housekeeping/` package handles row-by-age deletion + empty-partition-drop, while `partition/` package handles partition creation. The split is visible in: (a) two distinct ShedLock names (`housekeepingJob` 15-min vs `partitionCreationJob` daily at 00:01); (b) two distinct gates (`housekeeping.enabled` vs `odd.activity.partition-period`); (c) the abstract `EmptyPartitionsHousekeepingJob extends ... implements HousekeepingJob` (line 13) but constructor-injects `PartitionService` (line 14) — explicit two-package coupling at the type level rather than hiding the partition concern inside the housekeeping flow." — evidence: HousekeepingJobManager.java:18 (`@ConditionalOnProperty(\"housekeeping.enabled\")`) + EmptyPartitionsHousekeepingJob.java:13-14 (`abstract class ... implements HousekeepingJob` + `private final PartitionService partitionService`) + (sibling) odd-platform-api/src/main/java/.../partition/manager/ActivityTablePartitionManager.java — intent_anchor: "the `EmptyPartitionsHousekeepingJob` abstract class explicitly implements the housekeeping interface AND constructor-injects the PartitionService — neither concern is hidden inside the other; both are named at the type level" — confidence: HIGH
- "Three TTL values share a uniform `30`-day default in `application.yml` (lines 168-170) — the implicit decision is 'pick one default, apply across all three TTLs, let operators tune individually'. The uniformity (not three separately-tuned defaults) is the convention." — evidence: application.yml:167-170 (the `30 / 30 / 30` triplet, no per-field rationale comment) — intent_anchor: "the YAML block lists all three keys with identical `30` values back-to-back without per-line comments — the uniform choice across three semantically-distinct concerns reflects a 'one default to rule them all' stance" — confidence: MEDIUM (no source comment proves the choice is reasoned; the uniformity is the only signal)
- "Housekeeping is OPT-OUT in shipped deployments — `housekeeping.enabled: true` ships in `application.yml:166`, AND `@ConditionalOnProperty` carries NO `matchIfMissing`. The combination produces: (a) operators get housekeeping by default; (b) if `housekeeping.enabled` key is missing from the resolved config, the bean is NOT instantiated and housekeeping silently does not run. The decision favours bounded DB growth over data preservation." — evidence: HousekeepingJobManager.java:18 (`@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` — no `matchIfMissing`) + application.yml:165-166 (`housekeeping: enabled: true`) — intent_anchor: "the `havingValue = \"true\"` literal with NO `matchIfMissing` attribute — explicit strict-opt-in coupled with the shipped YAML default of `true` — combination is the decision: ship-with-housekeeping-on, but require explicit re-configuration if the bundled YAML is replaced" — confidence: HIGH
- "Bean registration is via `@EnableConfigurationProperties` on a central `@Configuration` class (`ODDPlatformConfiguration`) rather than `@ConfigurationPropertiesScan` (scan-all) or `@Component` on the POJO itself. The intent is: explicit registry of the project's typed-config classes in one place — `ODDPlatformConfiguration.java:13-15` enumerates `MetricExporterProperties.class` AND `HousekeepingTTLProperties.class`. Adding a new `@ConfigurationProperties` POJO requires editing this list, which is a discoverability feature (the registry is grep-able) at the cost of slight ceremony." — evidence: ODDPlatformConfiguration.java:13-16 (the explicit `@EnableConfigurationProperties` registry) + HousekeepingTTLProperties.java:6-8 (`@ConfigurationProperties` + `@Data` only — no `@Component`, no `@ConfigurationPropertiesScan`) — intent_anchor: "the `@EnableConfigurationProperties({...})` enumeration in ODDPlatformConfiguration.java:13-16 — adding a class requires editing this list, by design" — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**Java-side default mismatch — fields are `private int` with no initializer; the `30`-day safety floor lives ONLY in `application.yml:168-170`**. A deployment that overrides `application.yml` (e.g. `--spring.config.location=` mounting a custom config, Spring Cloud Config, Kubernetes ConfigMap mount over the bundled file) without re-supplying the `housekeeping.ttl.*` block binds `0` for all three fields. The next housekeeping cycle (~15 minutes after boot, ShedLock-guarded) would: (a) DELETE all RESOLVED + RESOLVED_AUTOMATICALLY alerts with `STATUS_UPDATED_AT <= now()` — i.e. ALL resolved alerts; (b) DELETE all SEARCH_FACETS with `LAST_ACCESSED_AT <= now()` — i.e. all of them; (c) DELETE all DATA_ENTITY rows in `DELETED` status with `STATUS_UPDATED_AT <= now()` — i.e. all soft-deleted entities, cascading through ~25 child tables. This is the LSN-001 shape (silent default produces production data loss). Promote defaults into Java: `private int resolvedAlertsDays = 30;` etc., or use Spring `@DefaultValue` on the field." — evidence: HousekeepingTTLProperties.java:9 (`private int resolvedAlertsDays;`), :10, :11 (all three — no initializer) + application.yml:168-170 (the `30` floor). — severity: HIGH
- "**No `activity*Days` or `messageDays` retention field — confirms drift surfaced from second angle**. This POJO has exactly three fields and there is no fourth for ACTIVITY or fifth for MESSAGE. `ActivityEmptyPartitionsHousekeepingJob.java:9-19` and `MessageEmptyPartitionsHousekeepingJob.java:12-25` both extend `EmptyPartitionsHousekeepingJob` which calls `partitionService.getEmptyPastPartitions(...)` (EmptyPartitionsHousekeepingJob.java:21-22) — and `PartitionServiceImpl.isPartitionEmpty` enforces `COUNT(*) = 0` (lines 133-141) BEFORE drop. A partition with even one row is retained indefinitely. **Time-based retention for activity-feed and message data does not exist anywhere in the platform codebase.**" — evidence: HousekeepingTTLProperties.java:8-12 (entire class — three fields, no activity/message field) + ActivityEmptyPartitionsHousekeepingJob.java:9-19 + MessageEmptyPartitionsHousekeepingJob.java:12-25 + EmptyPartitionsHousekeepingJob.java:21-22 + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no activity-by-age DELETE in any of them). — severity: HIGH (silent unbounded growth on activity audit trail in high-volume deployments; MEDIUM on message because DataCollaboration is opt-in)
- "**`AlertHousekeepingJob` jOOQ operator-precedence bypass — known + docs-acknowledged, un-tested, un-tracked**. AlertHousekeepingJob.java:28-34: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. SQL operator precedence: `AND` binds tighter than `OR`. Emitted SQL: `WHERE (STATUS = 'RESOLVED') OR ((STATUS = 'RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))`. The TTL gate is bypassed for manual `RESOLVED` rows; they are deleted on the next 15-minute cycle regardless of `resolvedAlertsDays`. Docs page acknowledges this (WebFetched 2026-05-26). Fix: parenthesise — `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`." — evidence: AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26. — severity: HIGH (silent data loss for manual alert resolutions — user marks alert RESOLVED, it disappears on next housekeeping cycle, docs promise 30-day retention but code bypasses it)
- "**No dry-run, no audit log of housekeeping deletions, no per-table metrics**. All three TTL-driven jobs log `log.debug(\"deleted N rows\")` (AlertHousekeepingJob.java:45, SearchFacetsHousekeepingJob.java:29, DataEntityHousekeepingJob.java:128) — debug-level, not captured in default production logging. No `@ActivityLog`, no Micrometer counter, no Prometheus gauge incrementing `housekeeping_deleted_total{table=...}`. Operators investigating 'how much did housekeeping delete yesterday' have no observable surface. Compliance frameworks requiring 'data-retention policy changes must be logged and reviewable' are not satisfied." — evidence: AlertHousekeepingJob.java:45 (`log.debug(\"Housekeeping job deleted {} resolved alerts\", deletedResolvedAlerts)`) + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128 + grep of housekeeping/ for `@ActivityLog | Counter | Meter` returns zero matches. — severity: MEDIUM
- "**`@ConditionalOnProperty(\"housekeeping.enabled\", havingValue = \"true\")` with NO `matchIfMissing`** — if `housekeeping.enabled` key is absent from the resolved config (operator deletes the key from a customised application.yml), `HousekeepingJobManager` bean is NOT instantiated and housekeeping silently does not run. The integration-test profile flips it to `false` deliberately, but an operator misconfiguration (missing key vs `false` key) produces identical no-op behaviour. The docs page describes housekeeping as on-by-default, which is true only because the shipped application.yml ships `enabled: true`." — evidence: HousekeepingJobManager.java:18 (no `matchIfMissing` attribute) + application-integration-test.yml:7-8 (the OPT-OUT). — severity: LOW
- "**`DataEntityHousekeepingJob.deleteFiles` `.block()` inside transaction** — DataEntityHousekeepingJob.java:142 calls `fileUploadService.deleteFiles(filePojos).block()` inside the surrounding `DSL.using(connection).transaction(ctx -> {...})` (line 71). If MinIO / S3 is unreachable (LSN-002-shape misconfig, network partition, credential rotation), the `block()` either hangs (no explicit timeout) or throws — rolling back the entire ~25-table cascade. The next 15-minute cycle retries the entire batch. If the failure is persistent, soft-deleted entities accumulate indefinitely while housekeeping silently fails each cycle (only `log.error` at HousekeepingJobManager.java:45)." — evidence: DataEntityHousekeepingJob.java:142 + DataEntityHousekeepingJob.java:71 + HousekeepingJobManager.java:41-47. — severity: MEDIUM
- "**No `@Min(0)` or `@PositiveOrZero` validation on the three TTL fields** — Spring Boot @ConfigurationProperties binds negative integers without complaint. An operator setting `housekeeping.ttl.resolved_alerts_days: -1` binds `-1` successfully; the downstream jOOQ chain computes cutoff = `now() - (-1) days` = `now() + 1 day`, and the predicate matches all rows. Adding `@Min(0)` (jakarta.validation) on each field + `@Validated` on the POJO would fail-fast at boot with a clear error message instead of silently producing wrong-cutoff data loss." — evidence: HousekeepingTTLProperties.java:8-12 (no @Min / @PositiveOrZero / @Validated annotations). — severity: MEDIUM (operator-typo gated; mitigated only by code review of the YAML)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "HousekeepingTTLProperties.java:9"
      name: "resolvedAlertsDays"
      value: "0 (Java primitive default) / 30 (application.yml default)"
      questions:
        - q: "What at N = 0 (the Java primitive default if YAML is overridden)?"
          a: "AlertHousekeepingJob.java:32-33 computes cutoff = `now() - 0 days` = `now()`. Predicate becomes `STATUS=RESOLVED OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= now())` — on the next 15-min cycle, ALL RESOLVED alerts AND ALL RESOLVED_AUTOMATICALLY alerts that completed before the cycle began are deleted. Operator sees: 'all resolved alerts vanished about 15 minutes after I edited my config' — LSN-001-shape silent data loss."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:9 + AlertHousekeepingJob.java:32-33 + DateTimeUtil.java:11-13"
        - q: "What at N = 1?"
          a: "Cutoff = `now() - 1 day`. RESOLVED_AUTOMATICALLY alerts older than 24h purged on next cycle; manual RESOLVED still deleted regardless (precedence bug). Search-facets, data-entity behave equivalently with their own field values."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:32-33"
        - q: "What at N = 30 (default)?"
          a: "Cutoff = `now() - 30 days`. RESOLVED_AUTOMATICALLY alerts past 30-day window purged; manual RESOLVED deleted regardless on next cycle."
          confidence: STATIC-INFERRED
          evidence: "application.yml:168-170 + AlertHousekeepingJob.java:32-33"
        - q: "What at N = negative (e.g. -1, accidentally set in YAML)?"
          a: "Cutoff = `now() - (-1) days` = `now() + 1 day`. Predicate `STATUS_UPDATED_AT <= now() + 1 day` matches all rows — ALL RESOLVED_AUTOMATICALLY alerts deleted. Manual RESOLVED still deleted (precedence bug). Same blast radius as N=0 essentially."
          confidence: PROBE-NEEDED
          evidence: "P-181"
        - q: "What at N = Integer.MAX_VALUE (overflow risk)?"
          a: "`LocalDateTime.minusDays(Long.MAX_VALUE)` throws DateTimeException. The cycle's runHousekeepingJob catches Exception and logs ERROR (HousekeepingJobManager.java:42-46), so the job no-ops. AlertHousekeepingJob throws and rolls back its transaction; SearchFacetsHousekeepingJob throws on the `.minus()` call. Operator sees error logs but no observable data effect."
          confidence: PROBE-NEEDED
          evidence: "P-181"
        - q: "What does operator see at each boundary?"
          a: "N=0 / N=negative: 'all resolved alerts vanished' (silent data loss, debug-level only); N=30: nominal behaviour; N=large: no observable effect except recurring error logs. Critical boundary is N=0 because it's the Java primitive default."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:45 (debug-level log) + HousekeepingJobManager.java:42-46"
    - location: "HousekeepingTTLProperties.java:10"
      name: "searchFacetsDays"
      value: "0 (Java primitive default) / 30 (application.yml default)"
      questions:
        - q: "What at N = 0?"
          a: "SearchFacetsHousekeepingJob.java:25-26 — `DSL.currentOffsetDateTime().minus(0)` = `current_timestamp - interval '0 days'` = `current_timestamp`. Predicate `LAST_ACCESSED_AT <= current_timestamp` matches all rows. ALL search_facets entries deleted on next cycle, silently. Operator sees: 'all saved searches vanished' — typically the user's filter preferences."
          confidence: STATIC-INFERRED
          evidence: "SearchFacetsHousekeepingJob.java:25-26"
        - q: "Does jOOQ's `.minus(int)` on `currentOffsetDateTime` bind as DAYS or as some other unit (seconds, milliseconds)?"
          a: "Per jOOQ official manual (WebFetched 2026-05-26 — sql-building/column-expressions/arithmetic-expressions): 'jOOQ supports Oracle-style syntax for adding days to a `Field<? extends java.util.Date>` ... integer argument represents days when using arithmetic operations on date/timestamp fields.' For PostgreSQL the emitted SQL is `current_timestamp - interval '<N> days'`. Confirmed semantics."
          confidence: STATIC-INFERRED
          evidence: "WebFetch https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/arithmetic-expressions/ 2026-05-26"
        - q: "What does operator see at boundary?"
          a: "N=0: search-facets table empty after first cycle. N=30 (default): facets entries last accessed >30 days ago deleted. N=large: no eviction within deployment lifetime."
          confidence: STATIC-INFERRED
          evidence: "SearchFacetsHousekeepingJob.java:25-26 + V0_0_52__introduce_housekeeping.sql:1 (the LAST_ACCESSED_AT column the predicate operates on)"
    - location: "HousekeepingTTLProperties.java:11"
      name: "dataEntityDeleteDays"
      value: "0 (Java primitive default) / 30 (application.yml default)"
      questions:
        - q: "What at N = 0?"
          a: "DataEntityHousekeepingJob.java:73 computes `deleteTime = now() - 0 days = now()`. Predicate `STATUS = DELETED AND STATUS_UPDATED_AT <= now()` matches ALL soft-deleted entities. Next cycle cascades ~25-table DELETE for every soft-deleted entity, including S3 attachment deletion via `fileUploadService.deleteFiles(filePojos).block()` (line 142). Blast radius is the largest of the three: cascades through OWNERSHIP, METADATA, MESSAGES, METRICS, LINEAGE, ALERTS, ACTIVITY, FILES, etc."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:71-128 + 142"
        - q: "What at default N = 30?"
          a: "Cutoff = `now() - 30 days`. Soft-deleted entities older than 30 days hard-purged with full cascade."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:73 + application.yml:170"
        - q: "What does operator see at boundary?"
          a: "N=0: 'all soft-deleted entities (and their ownerships, metadata, alerts, lineage, files) vanished immediately' — recovery impossible (no undo, no archive). N=30: nominal."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:71-129"
  name_behavior_pairs:
    - name: "HousekeepingTTLProperties (class name)"
      promise: "Configuration properties governing TTL (time-to-live) for housekeeping. Operator reading the class name expects: 'this class holds the retention thresholds for the housekeeping subsystem'."
      implementation: "The class has THREE fields covering resolved-alert TTL, search-facets TTL, data-entity-delete TTL. It does NOT cover ACTIVITY-row TTL or MESSAGE-row TTL — those are handled (or NOT handled, depending on viewpoint) by `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` which drop empty past partitions ignoring this POJO. The class name TRANSLATES_LEGITIMATELY because (a) only 3 of the 5 jobs need TTL knobs (the partition jobs use empty-partition detection instead, by design), (b) the missing coverage for activity/message ROW retention is an architectural choice not a naming defect."
      drift: MINOR
      operator_visible_consequence: "Operator searching 'TTL' for activity-feed retention finds this class, sees no activity field, and may incorrectly conclude activity is retained-by-something-else (the partition-period setting) — but partition-period only controls WIDTH, not retention. The class name accurately describes its scope; the gap is that 'no activity TTL exists' is an undocumented architectural fact."
      confidence: STATIC-INFERRED
      evidence: "HousekeepingTTLProperties.java:8-12 (three fields only) + ActivityEmptyPartitionsHousekeepingJob.java:9-19 (no TTL consumption) + EmptyPartitionsHousekeepingJob.java:21-22 (COUNT=0 requirement)"
    - name: "resolvedAlertsDays (field name)"
      promise: "Days after an alert reaches a resolved state before it is deleted by housekeeping."
      implementation: "Consumed by AlertHousekeepingJob.java:32-33 as `DateTimeUtil.generateNow().minusDays(housekeepingTTLProperties.getResolvedAlertsDays())`. Cutoff is correctly subtracted in DAYS. BUT the surrounding jOOQ predicate has a precedence bug (lines 28-33) that bypasses the TTL gate entirely for manual `RESOLVED` rows. The field NAME promises 'all resolved alerts after N days'; the code applies the gate only to `RESOLVED_AUTOMATICALLY` rows."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator marking an alert RESOLVED manually loses that alert on the next 15-minute housekeeping cycle, regardless of the configured `resolvedAlertsDays`. Docs acknowledge this; field name is unchanged; bug is unfixed."
      confidence: STATIC-INFERRED
      evidence: "AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26"
    - name: "searchFacetsDays (field name)"
      promise: "Days a search-facets entry is retained before deletion."
      implementation: "Consumed by SearchFacetsHousekeepingJob.java:25-26. The predicate operates on `SEARCH_FACETS.LAST_ACCESSED_AT` — i.e. it's days since LAST ACCESS, not days since CREATION. The field name is silent on whether the clock measures creation, last update, or last access. The migration that introduced this (V0_0_52__introduce_housekeeping.sql:1-8) renamed/added the column as `last_accessed_at`, so the semantics are 'last-accessed days, not creation days'."
      drift: MINOR
      operator_visible_consequence: "Operator configuring `search_facets_days=7` expecting 'delete facet entries older than 7 days' may be surprised that an entry created 30 days ago but accessed yesterday is NOT deleted (last-accessed time, not creation time). Live docs page describes this correctly: 'Controls retention of saved search-facet entries based on last access time.'"
      confidence: STATIC-INFERRED
      evidence: "SearchFacetsHousekeepingJob.java:23-26 + V0_0_52__introduce_housekeeping.sql:1-2"
    - name: "dataEntityDeleteDays (field name)"
      promise: "Days a soft-deleted data entity is retained before permanent (cascaded) deletion."
      implementation: "Consumed by DataEntityHousekeepingJob.java:73 — `deleteTime = now() - dataEntityDeleteDays`. Predicate filters `STATUS = DELETED AND STATUS_UPDATED_AT <= deleteTime` (line 76-77). Cascades through ~25 child tables in a single jOOQ transaction. Behavior matches name: 'days since soft-delete'."
      drift: NONE
      operator_visible_consequence: "N/A — name matches implementation."
      confidence: STATIC-INFERRED
      evidence: "DataEntityHousekeepingJob.java:73-78"
  orderings: []
  auth_gates:
    - location: "HousekeepingTTLProperties.java (entire file — POJO)"
      endpoint: "N/A — not HTTP. Boot-time @ConfigurationProperties bean."
      questions:
        - q: "What does this code do for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "INTERNAL_ONLY. The POJO is instantiated unconditionally at boot regardless of `auth.type`. It carries no auth-conditional annotation. The downstream housekeeping subsystem (HousekeepingJobManager and the five HousekeepingJob beans) also runs in the Spring scheduling context, NOT the HTTP surface — auth mode does not apply directly."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:1-12 (no auth annotation) + HousekeepingJobManager.java:18 (gated by housekeeping.enabled, not auth.type)"
        - q: "What does unauthenticated caller see?"
          a: "N/A — no HTTP surface. The bean is consumed only by other Spring beans on a `@Scheduled` cycle."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java (no @RestController, no @RequestMapping, no @Path)"
        - q: "What does wrong-role caller see?"
          a: "N/A — no HTTP surface."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java"
        - q: "Where does the gate live?"
          a: "NO authorization gate. The subsystem master gate is `housekeeping.enabled` at HousekeepingJobManager.java:18 (`@ConditionalOnProperty`) — a CONFIGURATION gate, not an authorization gate. Anyone who can modify the resolved configuration (env var, Spring Cloud Config, application.yml mount) controls the data-retention thresholds without any audit trail."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingJobManager.java:18 + HousekeepingTTLProperties.java (no @PreAuthorize / @Secured)"
  resource_boundaries:
    - location: "HousekeepingTTLProperties.java (the POJO itself)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous reads of this POJO produce inconsistent values?"
          a: "No — `@ConfigurationProperties` POJOs are bound once at Spring context refresh; the @Data-generated setters are not normally called after bind. Three Lombok-generated getters return primitive int values via direct field read — atomic in the JMM."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:7-8 (`@Data` Lombok) + primitive int field semantics"
        - q: "Is the POJO replay-safe (multiple cycles reading it return the same value)?"
          a: "Yes — bound once at boot, immutable in practice (no `@RefreshScope`, no Spring Cloud Config dynamic refresh). Restart required to change values."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java (no @RefreshScope) + ODDPlatformConfiguration.java:13-15 (registered at boot, not scoped)"
        - q: "If a cache fronts this — TTL / eviction key / staleness?"
          a: "N/A — no cache. The POJO IS the source of truth; downstream jobs call getters directly each cycle."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:33 + SearchFacetsHousekeepingJob.java:26 + DataEntityHousekeepingJob.java:73 (direct getter calls per cycle)"
  request_inputs:
    - location: "HousekeepingTTLProperties.java:9"
      input_kind: body-field
      input_name: "resolvedAlertsDays (bound from housekeeping.ttl.resolved_alerts_days YAML key)"
      questions:
        - q: "What does the input NAME promise the caller (operator) in plain English?"
          a: "Number of days a resolved alert remains in the database before being deleted by housekeeping. The qualifier 'resolved' implies 'any resolved alert' — both manual (RESOLVED) and automatic (RESOLVED_AUTOMATICALLY)."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:9 (field name) + application.yml:168 (YAML key) + WebFetch /configuration-and-deployment/odd-platform 2026-05-26 (docs say 'how long alerts remain after being resolved')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: AlertHousekeepingJob.java:21 (field injection) → AlertHousekeepingJob.java:33 (`housekeepingTTLProperties.getResolvedAlertsDays()` call) → `DateTimeUtil.generateNow().minusDays(N)` (line 32) → jOOQ predicate `ALERT.STATUS_UPDATED_AT.lessOrEqual(cutoff)` (line 32) → SQL emitted: `WHERE (STATUS = 'RESOLVED') OR ((STATUS = 'RESOLVED_AUTOMATICALLY') AND (STATUS_UPDATED_AT <= cutoff))` due to SQL precedence (AND binds tighter than OR)."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:21,28-34"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The name promises 'all resolved alerts after N days'. The implementation filters by TTL only the auto-resolved subset — manual `RESOLVED` rows are deleted on the next cycle regardless of N due to the precedence bug. The field name does NOT communicate this caveat; the live docs acknowledge it as a 'known platform bug'."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) Operator sets `resolved_alerts_days=90` to keep 90 days of resolved-alert history for compliance review. Auto-resolved alerts honor the 90-day window correctly. Manual resolutions vanish 15 minutes after the operator clicks Resolve — a user investigating an incident finds their manually-resolved-alert audit trail is gone within the hour. (b) Operator sets `resolved_alerts_days=0` (or leaves YAML unset → Java default 0): all RESOLVED_AUTOMATICALLY alerts AND all manual RESOLVED alerts deleted on next cycle (the precedence bug compounds with the Java-default bug)."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:28-34 (the predicate that bypasses TTL for manual RESOLVED)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The fix is structural (parenthesise the predicate), not data-shape — there's no 'better column to filter by'. The intent of the name is `STATUS IN (RESOLVED, RESOLVED_AUTOMATICALLY) AND STATUS_UPDATED_AT <= cutoff`; the implementation simply got the operator-precedence wrong. NO available-but-unused smell at the data layer; the bug is at the predicate-construction layer."
          confidence: STATIC-INFERRED
          evidence: "AlertHousekeepingJob.java:28-34 (the predicate site itself)"
      routes_to_finding: "bugs_limitations_corner_cases.[2] (the AlertHousekeepingJob jOOQ-precedence bug) AND docs_link_semantic.doc_drift_findings.[3] (the docs-acknowledged-but-untracked bug)"
    - location: "HousekeepingTTLProperties.java:10"
      input_kind: body-field
      input_name: "searchFacetsDays (bound from housekeeping.ttl.search_facets_days YAML key)"
      questions:
        - q: "What does the input NAME promise?"
          a: "Number of days a search-facets entry is retained before deletion. The field name itself does NOT specify the clock (creation? last update? last access?); the qualifier `_days` is the unit but not the start-time."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:10 + application.yml:169"
        - q: "What does the implementation USE the input for?"
          a: "Chain: SearchFacetsHousekeepingJob.java:17 (field injection) → SearchFacetsHousekeepingJob.java:26 (`housekeepingTTLProperties.getSearchFacetsDays()` call) → `DSL.currentOffsetDateTime().minus(N)` → SQL `current_timestamp - interval 'N days'` (per jOOQ official manual) → predicate `SEARCH_FACETS.LAST_ACCESSED_AT <= cutoff` (line 25-26)."
          confidence: STATIC-INFERRED
          evidence: "SearchFacetsHousekeepingJob.java:25-26 + jOOQ manual on .minus(Number) semantics"
        - q: "Does the implementation match the name?"
          a: "TRANSLATES_LEGITIMATELY. The name `searchFacetsDays` is silent on which clock starts — `last-accessed` is a reasonable interpretation (a facet preference re-opened recently is still useful). The live docs page documents the semantics correctly ('based on last access time'). The translation has a reason: V0_0_52__introduce_housekeeping.sql added `last_accessed_at` specifically to enable this TTL — the column name signals the clock."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "V0_0_52__introduce_housekeeping.sql:1-8 (the column-add migration) + SearchFacetsHousekeepingJob.java:25-26"
        - q: "Operator-visible consequence?"
          a: "Operator setting `search_facets_days=7` expects 'delete facets older than 7 days'. Actually deleted: 'facets where last access >7 days ago'. A facet entry created 30 days ago but accessed yesterday is RETAINED. The mismatch is documented on the live page but not in the field name."
          confidence: STATIC-INFERRED
          evidence: "SearchFacetsHousekeepingJob.java:25-26 (LAST_ACCESSED_AT, not CREATED_AT)"
        - q: "Available-but-unused smell?"
          a: "NONE. SEARCH_FACETS table carries LAST_ACCESSED_AT (the queried column) AND `last_accessed_at` is also the only timestamp on the table (creation timestamp is implicit via the DEFAULT clause of LAST_ACCESSED_AT at first insert). No closer-aligned data exists."
          confidence: STATIC-INFERRED
          evidence: "V0_0_52__introduce_housekeeping.sql:1-2"
      routes_to_finding: "implicit_adrs.[0] (TRANSLATES_LEGITIMATELY — the V0_0_52 migration is the documentation of intent)"
    - location: "HousekeepingTTLProperties.java:11"
      input_kind: body-field
      input_name: "dataEntityDeleteDays (bound from housekeeping.ttl.data_entity_delete_days YAML key)"
      questions:
        - q: "What does the input NAME promise?"
          a: "Number of days after a data-entity is marked DELETED (soft-delete) before it is permanently purged (with cascade). The `Delete` qualifier signals the start-clock: when the entity moved to DELETED status."
          confidence: STATIC-INFERRED
          evidence: "HousekeepingTTLProperties.java:11 + application.yml:170 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26 (docs say 'how long soft-deleted entities persist before permanent removal')"
        - q: "What does the implementation USE the input for?"
          a: "Chain: DataEntityHousekeepingJob.java:64 (field injection as `properties`) → DataEntityHousekeepingJob.java:73 (`properties.getDataEntityDeleteDays()` call) → `DateTimeUtil.generateNow().minusDays(N)` → predicate `DATA_ENTITY.STATUS = DELETED AND DATA_ENTITY.STATUS_UPDATED_AT <= deleteTime` (line 76-77). Cascades through ~25 child tables in a single jOOQ transaction (lines 99-126)."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:64,73-78"
        - q: "Does the implementation match the name?"
          a: "MATCHES. Filter is on `STATUS = DELETED AND STATUS_UPDATED_AT <= cutoff`; STATUS_UPDATED_AT changes when the entity's status changes, so for a soft-deleted entity it equals the soft-delete timestamp. The name's promise (days since soft-delete) is the column's content (timestamp of the status transition INTO DELETED)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:73-78 + (cross-reference) ReactiveDataEntityRepositoryImpl.java:112 (the soft-delete writes STATUS = DELETED.getId() and triggers STATUS_UPDATED_AT update)"
        - q: "Operator-visible consequence on mismatch?"
          a: "N/A — no mismatch."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:73-78"
        - q: "Available-but-unused smell?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataEntityHousekeepingJob.java:73-78"
      routes_to_finding: "N/A — no drift"
  probes_emitted:
    - probe_id: P-181
      question: "Negative-value and overflow boundary behaviour for HousekeepingTTLProperties fields — does N=-1 / N=Integer.MAX_VALUE silently delete-all / throw / no-op?"
      probe_path: "lineage/odd-platform/probes/P-181.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 39
    answers_static_inferred: 37
    answers_probe_needed: 2
    answers_reference: 0
    drift_flags: 3
```

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`HousekeepingTTLProperties` is a `@ConfigurationProperties` POJO; the housekeeping subsystem runs in the Spring scheduling context (not the HTTP surface). Auth mode (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP | S2S`) does not apply directly. The bean is instantiated unconditionally regardless of `auth.type`." — evidence: HousekeepingTTLProperties.java:6 (`@ConfigurationProperties(\"housekeeping.ttl\")` only — no auth-conditional annotation) + HousekeepingJobManager.java:18 (gated by housekeeping.enabled, not auth.type).
- ingestion_filter_relevance: "N/A — not HTTP. The housekeeping subsystem does not participate in `POST /ingestion/entities`; it runs on a Spring-scheduled fixed-rate cycle (HousekeepingJobManager.java:25)."
- authorization_assertions: []
- owner_scoping: "BYPASSES — the three TTL-driven jobs delete rows ACROSS ALL OWNERS without regard to the ODD ownership model. `AlertHousekeepingJob.java:28-34` has no `OWNERSHIP` join; `DataEntityHousekeepingJob.java:268-273` (`deleteOwnerships`) cascades through OWNERSHIP to remove all owner relations. This is intentional — housekeeping is a system-level admin operation — but any future change that narrowed the scope (e.g. per-owner soft-delete budgets) would need explicit re-design." — evidence: AlertHousekeepingJob.java:28-34 + DataEntityHousekeepingJob.java:268-273.
- data_exposure:
  - "Housekeeping jobs do NOT expose data outbound — they DELETE rows; no HTTP response, no log payload containing deleted content. The risk surface is INVERSE: deleted data is gone, the only acknowledgement is `log.debug(\"deleted N\")` at debug level. A compliance / forensic investigation for 'show me the deleted resolved alerts from 2025-12' cannot be satisfied — no archival, no audit log of WHAT was deleted, only the count at debug-level."
- known_security_gaps:
  - "**No tamper-evident audit log of housekeeping deletions** — a malicious operator with `housekeeping.ttl.resolved_alerts_days` write access (env-var override at deploy time, ConfigMap mount, Spring Cloud Config) could set the value to `0` and the next housekeeping cycle would silently destroy all RESOLVED alert history. There is no audit trail of the configuration change AND no audit trail of the deletion — both silent in production. Compliance frameworks requiring 'changes to data retention policies must be logged and reviewable' are not satisfied. Suggested mitigation: structured audit event on each housekeeping cycle (`audit.housekeeping.cycle{table=alerts, deleted=N, cutoff=...}`) + `@ActivityLog` on configuration-binding (boot-time)." — evidence: HousekeepingTTLProperties.java (entire file — no audit annotations) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (debug-level logs only). — severity: MEDIUM
  - "**No dry-run / no preview / no backup-before-delete mechanism** — the three TTL jobs hard-DELETE without any operator-overridable safeguard. There is no `housekeeping.dry-run=true` mode that logs what would be deleted, no `housekeeping.ttl.backup-table` that copies rows to an archive before delete, no operator gate at the YAML layer. A misconfigured `data_entity_delete_days=1` immediately cascades through ~25 tables on the next 15-minute cycle with no recovery path." — evidence: HousekeepingJobManager.java:25-39 (no dry-run check before `housekeepingJob.doHousekeeping(connection)`) + AlertHousekeepingJob.java:40-43 (the actual DELETE, no archival) + DataEntityHousekeepingJob.java:99-126 (the cascaded DELETE sequence). — severity: MEDIUM

## performance

- hot_paths:
  - "Housekeeping cycle runs every 15 minutes (HousekeepingJobManager.java:25 `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`). On busy clusters this cycle is on a critical operational path: a slow `DataEntityHousekeepingJob` cascade (can take minutes against a large soft-deleted backlog) holds the ShedLock for the full 14 minutes and starves other instances. Boot-time impact is zero (the job is `@Scheduled`, not `@PostConstruct`)."
- throughput_characteristics:
  - "Single shared connection, sequential fan-out — `HousekeepingJobManager.runHousekeepingJobs` (lines 27-39) acquires ONE `Connection` from `PGConnectionFactory` and iterates the five jobs synchronously. Total cycle time = sum of all five jobs' execution times. A slow `DataEntityHousekeepingJob` blocks `AlertHousekeepingJob` (which is single-table-DELETE fast) from running until it completes."
  - "Bulk DELETE in single jOOQ transaction — `DataEntityHousekeepingJob.doHousekeeping` (lines 71-82) wraps the entire ~25-table cascade in `DSL.using(connection).transaction(...)`. The transaction is held for the full cascade — for backlog of N soft-deleted entities, this is N × ~25 DELETE round-trips. PostgreSQL row-level locks held for the duration; concurrent INSERTs against the same entity may block."
- resource_allocation:
  - "DataEntityHousekeepingJob loads `List<DataEntityPojo> dataEntitiesToDelete` into memory before deleting (lines 75-78) — bounded only by backlog size. A platform with tens of thousands of soft-deleted entities (e.g. brief `data_entity_delete_days=1` misconfig) loads all into one in-memory list. No batching, no streaming, no LIMIT clause."
  - "`dataEntityIds` and `dataEntityOddrns` arrays held in memory for the full transaction (DataEntityHousekeepingJob.java:91-97)."
  - "`MESSAGE.UUID` collection in `deleteMessages` (lines 282-296) — all UUIDs for all deleted entities fetched into one `List<UUID>`. For an entity with millions of messages, this is a memory-budget hazard."
- scaling_characteristics:
  - "ShedLock-coordinated: `lockAtLeastFor = \"14m\" / lockAtMostFor = \"14m\"` (HousekeepingJobManager.java:26). Only one platform instance runs housekeeping per 15-minute slot. The 14-minute upper bound is dangerously close to the 15-minute schedule: a job running 14m1s releases the lock prematurely while still completing, and a second instance can acquire the next slot's lock while the first is still committing. `lockAtMostFor` ideally ≥ 2 × fixedRate (30m for a 15-min schedule)."
  - "`fixedRate` semantics: Spring `fixedRate = 15m` schedules the NEXT invocation 15 minutes AFTER the PREVIOUS invocation STARTED. A 20-minute cycle would queue the next invocation immediately on completion (5m late, then drift)."
  - "Activity / message empty-partition-drops scale O(P) where P = past partitions of the table — `getEmptyPastPartitions` issues one `SELECT count(*) = 0 FROM <partition>` per past partition. After 5 years at `partition-period=30`, P ≈ 60 — small constant cost but unbounded growth."
- known_performance_gaps:
  - "**No per-job parallelism — single Connection bottleneck**. Five `HousekeepingJob` beans run sequentially on a shared connection (HousekeepingJobManager.java:33-35). On a quiet system this is fine; on a system with a long `DataEntityHousekeepingJob` cascade, `AlertHousekeepingJob` and `SearchFacetsHousekeepingJob` are blocked for minutes. Splitting jobs across separate connections or moving the cascade to a paginated background job would decouple latencies." — evidence: HousekeepingJobManager.java:32 (single `pgConnectionFactory.getConnection()`). — severity: LOW
  - "**No backlog metric — invisible bloat**. No counter / gauge / `housekeeping.backlog{table=...}` metric exposes the row-count awaiting deletion. An operator cannot answer 'is housekeeping keeping up?' without manual SQL. Adding a Prometheus gauge at the start of each cycle would surface backlog growth before it becomes a 14-minute-ShedLock problem." — evidence: AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no Micrometer counters / gauges). — severity: LOW
  - "**`lockAtMostFor = \"14m\"` is dangerously close to `fixedRate = 15m`** — under contention or a long DataEntityHousekeepingJob cascade, the lock can release before the cycle commits, allowing a second instance to acquire it at minute 15 while the first is still finalising. A safer setting would be `lockAtMostFor` ≥ 2 × fixedRate." — evidence: HousekeepingJobManager.java:25-26. — severity: LOW

## upstream_callers

- entry_point: "boot:@EnableConfigurationProperties(HousekeepingTTLProperties.class)"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.config class:ODDPlatformConfiguration"
  multiplicity_per_trigger: 1
  evidence: "ODDPlatformConfiguration.java:13-15 — the central registry that registers this POJO as a Spring bean. Without this registration the POJO would not be in the application context and the three consumers would fail to autowire (Lombok-generated final-field constructors)."
  observation_class: boot-eval
- entry_point: "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping class:HousekeepingJobManager"
  multiplicity_per_trigger: 1
  evidence: "HousekeepingJobManager.java:25-39 — the @Scheduled cycle iterates List<HousekeepingJob> housekeepingJobs (constructor-injected at line 23) and calls doHousekeeping(connection) on each. The three TTL-driven jobs each invoke a getter on this POJO once per cycle (AlertHousekeepingJob.java:33, SearchFacetsHousekeepingJob.java:26, DataEntityHousekeepingJob.java:73)."
  observation_class: scheduled-trigger
- entry_point: "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate) — AlertHousekeepingJob"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.job housekeeping-job:AlertHousekeepingJob"
  multiplicity_per_trigger: 1
  evidence: "AlertHousekeepingJob.java:21 (constructor-injected field) + AlertHousekeepingJob.java:33 (call to `housekeepingTTLProperties.getResolvedAlertsDays()` once per cycle)."
  observation_class: scheduled-trigger
- entry_point: "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate) — SearchFacetsHousekeepingJob"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.job housekeeping-job:SearchFacetsHousekeepingJob"
  multiplicity_per_trigger: 1
  evidence: "SearchFacetsHousekeepingJob.java:17 (constructor-injected field) + SearchFacetsHousekeepingJob.java:26 (call to `housekeepingTTLProperties.getSearchFacetsDays()` once per cycle)."
  observation_class: scheduled-trigger
- entry_point: "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate) — DataEntityHousekeepingJob"
  caller_node: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.job housekeeping-job:DataEntityHousekeepingJob"
  multiplicity_per_trigger: 1
  evidence: "DataEntityHousekeepingJob.java:64 (constructor-injected field `properties`) + DataEntityHousekeepingJob.java:73 (call to `properties.getDataEntityDeleteDays()` once per cycle)."
  observation_class: scheduled-trigger

## downstream_side_effects

- side_effect_class: db-write
  description: "Provides the cutoff value that determines which ALERT + ALERT_CHUNK rows are DELETED on each cycle. The POJO field value is not itself a side effect, but the value materially controls the size of the delete-set in AlertHousekeepingJob."
  evidence: "AlertHousekeepingJob.java:32-43 (the predicate construction + DELETE) — controlled by `getResolvedAlertsDays()` at line 33"
  cardinality_per_call: "0..N rows per cycle (N = count of RESOLVED_AUTOMATICALLY alerts past TTL + ALL manual RESOLVED alerts due to the precedence bug)"
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"
- side_effect_class: db-write
  description: "Provides the cutoff value that controls which SEARCH_FACETS rows are DELETED."
  evidence: "SearchFacetsHousekeepingJob.java:23-27 — controlled by `getSearchFacetsDays()` at line 26"
  cardinality_per_call: "0..N rows per cycle (N = count of search_facets last accessed before now() - searchFacetsDays)"
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"
- side_effect_class: db-write
  description: "Provides the cutoff value that controls which DATA_ENTITY (soft-deleted) rows + ~25 cascaded child-table rows are DELETED."
  evidence: "DataEntityHousekeepingJob.java:71-128 — controlled by `getDataEntityDeleteDays()` at line 73"
  cardinality_per_call: "0..N data-entities per cycle, EACH cascading through ~25 child tables. Single jOOQ transaction."
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"
- side_effect_class: external-call
  description: "Indirect — when DataEntityHousekeepingJob fires with N>0 entities to delete AND those entities own File rows AND attachment storage is REMOTE (MinIO/S3), DataEntityHousekeepingJob.deleteFiles (line 131-143) calls fileUploadService.deleteFiles(filePojos).block() — i.e. each cycle issues an external S3 DELETE request for every attachment of every purged entity."
  evidence: "DataEntityHousekeepingJob.java:131-143 (the deleteFiles method) + (cross-reference) LSN-002 retro on attachment.storage REMOTE mode"
  cardinality_per_call: "0..M S3 DELETE requests per cycle (M = total attachments across all soft-deleted-past-TTL entities)"
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"
- side_effect_class: log-emit
  description: "debug-level log line per cycle per TTL-driven job: 'Housekeeping job deleted {N} resolved alerts' / 'deleted {N} outdated search facets' / 'Deleted data entities with ids {...}'"
  evidence: "AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128"
  cardinality_per_call: 3
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs (15-min fixedRate)"

## sources

- understanding ← HousekeepingTTLProperties.java:1-12 + ODDPlatformConfiguration.java:13-16 + HousekeepingJobManager.java:17-47 + AlertHousekeepingJob.java:20-48 + SearchFacetsHousekeepingJob.java:16-31 + DataEntityHousekeepingJob.java:63-129 + EmptyPartitionsHousekeepingJob.java:13-40 + ActivityEmptyPartitionsHousekeepingJob.java:9-19 + MessageEmptyPartitionsHousekeepingJob.java:12-26 + application.yml:165-170
- concepts.entities ← HousekeepingTTLProperties.java:8 + ODDPlatformConfiguration.java:13-16 + HousekeepingJobManager.java:21 + housekeeping/job/ directory listing
- concepts.operations ← HousekeepingTTLProperties.java:9-11 + HousekeepingJobManager.java:25-39 + AlertHousekeepingJob.java:24-46 + SearchFacetsHousekeepingJob.java:19-30 + DataEntityHousekeepingJob.java:68-128 + EmptyPartitionsHousekeepingJob.java:17-33
- concepts.invariants ← HousekeepingTTLProperties.java:9-11 + ODDPlatformConfiguration.java:13-16 + application.yml:165-170 + application-integration-test.yml:7-8 + HousekeepingJobManager.java:18,25-26 + EmptyPartitionsHousekeepingJob.java:21 + PartitionServiceImpl.java:133-141 + AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26
- dependencies_semantic.requires-feature ← AlertHousekeepingJob.java:14-15 + SearchFacetsHousekeepingJob.java:11 + DataEntityHousekeepingJob.java:34 + HousekeepingJobManager.java:23,32
- dependencies_semantic.requires-config ← HousekeepingJobManager.java:18 + HousekeepingTTLProperties.java:9-11 + application.yml:165-170
- dependencies_semantic.requires-runtime ← HousekeepingJobManager.java:25-26 + SchedulingConfiguration.java:13-25 + DataEntityHousekeepingJob.java:71
- dependencies_semantic.coupling ← ActivityEmptyPartitionsHousekeepingJob.java + MessageEmptyPartitionsHousekeepingJob.java + EmptyPartitionsHousekeepingJob.java:21-22 + PartitionServiceImpl.java:133-141 + DataEntityHousekeepingJob.java:131-143
- tests_coverage_semantic.test_files ← grep of <odd-platform-repo>/odd-platform-api/src/test/java for `Housekeeping*` returning zero matches
- tests_coverage_semantic.gaps ← absence verified via test-directory grep + application.yml:166 vs application-integration-test.yml:8 (the integration profile flips OFF)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-26 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed 2026-05-12 status 200
- docs_link_semantic.doc_drift_findings.[0] ← HousekeepingTTLProperties.java:8-12 + ActivityEmptyPartitionsHousekeepingJob.java:9-19 + EmptyPartitionsHousekeepingJob.java:21-22 + PartitionServiceImpl.java:133-141
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch /configuration-and-deployment/odd-platform + housekeeping/job/ directory listing (the FIVE bean files)
- docs_link_semantic.doc_drift_findings.[2] ← HousekeepingTTLProperties.java:9-11 + application.yml:168-170
- docs_link_semantic.doc_drift_findings.[3] ← AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform
- implicit_adrs.[0] ← HousekeepingJobManager.java:18 + EmptyPartitionsHousekeepingJob.java:13-14 + ActivityEmptyPartitionsHousekeepingJob.java:9
- implicit_adrs.[1] ← application.yml:167-170 (the 30/30/30 triplet)
- implicit_adrs.[2] ← HousekeepingJobManager.java:18 + application.yml:165-166
- implicit_adrs.[3] ← ODDPlatformConfiguration.java:13-16 + HousekeepingTTLProperties.java:6-8
- bugs_limitations_corner_cases.[0] ← HousekeepingTTLProperties.java:9-11 + application.yml:168-170
- bugs_limitations_corner_cases.[1] ← HousekeepingTTLProperties.java:8-12 + ActivityEmptyPartitionsHousekeepingJob.java:9-19 + MessageEmptyPartitionsHousekeepingJob.java:12-25 + EmptyPartitionsHousekeepingJob.java:21-22 + PartitionServiceImpl.java:133-141
- bugs_limitations_corner_cases.[2] ← AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26
- bugs_limitations_corner_cases.[3] ← AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128
- bugs_limitations_corner_cases.[4] ← HousekeepingJobManager.java:18 + application-integration-test.yml:7-8
- bugs_limitations_corner_cases.[5] ← DataEntityHousekeepingJob.java:142 + DataEntityHousekeepingJob.java:71 + HousekeepingJobManager.java:41-47
- bugs_limitations_corner_cases.[6] ← HousekeepingTTLProperties.java:8-12 (no @Min / @Validated annotations)
- stress_findings.tunables.* ← HousekeepingTTLProperties.java:9-11 + AlertHousekeepingJob.java:32-33 + SearchFacetsHousekeepingJob.java:25-26 + DataEntityHousekeepingJob.java:73 + WebFetch https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/arithmetic-expressions/ 2026-05-26
- stress_findings.name_behavior_pairs.* ← HousekeepingTTLProperties.java:8-12 + AlertHousekeepingJob.java:28-34 + SearchFacetsHousekeepingJob.java:23-26 + DataEntityHousekeepingJob.java:73-78 + V0_0_52__introduce_housekeeping.sql:1-8
- stress_findings.auth_gates ← HousekeepingTTLProperties.java + HousekeepingJobManager.java:18
- stress_findings.resource_boundaries ← HousekeepingTTLProperties.java:7-8 + ODDPlatformConfiguration.java:13-15
- stress_findings.request_inputs.* ← HousekeepingTTLProperties.java:9-11 + AlertHousekeepingJob.java:21,28-34 + SearchFacetsHousekeepingJob.java:17,25-26 + DataEntityHousekeepingJob.java:64,73-78 + V0_0_52__introduce_housekeeping.sql:1-8 + WebFetch /configuration-and-deployment/odd-platform 2026-05-26
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-181.yaml (emitted in this session)
- security.auth_mode_relevance ← HousekeepingTTLProperties.java:6 + HousekeepingJobManager.java:18
- security.ingestion_filter_relevance ← HousekeepingJobManager.java:25
- security.owner_scoping ← AlertHousekeepingJob.java:28-34 + DataEntityHousekeepingJob.java:268-273
- security.known_security_gaps.[0] ← HousekeepingTTLProperties.java (no audit annotations) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (debug-level only)
- security.known_security_gaps.[1] ← HousekeepingJobManager.java:25-39 + AlertHousekeepingJob.java:40-43 + DataEntityHousekeepingJob.java:99-126
- performance.hot_paths ← HousekeepingJobManager.java:25-26
- performance.throughput_characteristics ← HousekeepingJobManager.java:32-35 + DataEntityHousekeepingJob.java:71
- performance.resource_allocation ← DataEntityHousekeepingJob.java:75-78,91-97,282-296
- performance.scaling_characteristics ← HousekeepingJobManager.java:25-26 + PartitionServiceImpl.java:82-118
- performance.known_performance_gaps.[0] ← HousekeepingJobManager.java:32
- performance.known_performance_gaps.[1] ← AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no Micrometer)
- performance.known_performance_gaps.[2] ← HousekeepingJobManager.java:25-26
- upstream_callers.[0] ← ODDPlatformConfiguration.java:13-16
- upstream_callers.[1-4] ← HousekeepingJobManager.java:23,25-39 + AlertHousekeepingJob.java:21,33 + SearchFacetsHousekeepingJob.java:17,26 + DataEntityHousekeepingJob.java:64,73
- downstream_side_effects.[0] ← AlertHousekeepingJob.java:32-43
- downstream_side_effects.[1] ← SearchFacetsHousekeepingJob.java:23-27
- downstream_side_effects.[2] ← DataEntityHousekeepingJob.java:71-128
- downstream_side_effects.[3] ← DataEntityHousekeepingJob.java:131-143
- downstream_side_effects.[4] ← AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (test absence verified via test-directory grep — zero matches for any Housekeeping* class)
- docs_link_semantic: HIGH (two WebFetches in-session: /configuration-and-deployment/odd-platform 200 on 2026-05-26, /features/active-platform-features/activity-feed 200 on 2026-05-12 — both quoted verbatim; jOOQ manual WebFetched 2026-05-26 for .minus(Number) semantics)
- implicit_adrs: HIGH (four decisions with explicit code evidence; 30/30/30 uniformity MEDIUM at decision level due to absence of WHY-comment)
- bugs_limitations_corner_cases: HIGH (every finding cited at file:line; activity-retention drift cross-confirmed from second angle; jOOQ-precedence bug confirmed against docs acknowledgement)
- security: HIGH (auth-mode relevance + owner-scoping anchored on code; audit-log + dry-run gaps absence-shaped but well-evidenced via grep)
- performance: HIGH (single-Connection + lockAtMostFor + transaction-wrap evidence chain anchored)
- upstream_callers: HIGH (five upstream caller relationships fully traced to file:line, none unresolved)
- downstream_side_effects: HIGH (five side-effect classes, all anchored at file:line of the side-effect site)
- stress_findings: MEDIUM (37/39 questions STATIC-INFERRED with strong evidence; 2 questions PROBE-NEEDED — boundary cases for negative and Integer.MAX_VALUE values, deferred to P-181; load-bearing claims about default behaviour, precedence bug, and cross-job scope are all STATIC-INFERRED with code citations)

## Maintainer notes

(none — superseding the earlier v0.2.0 sidecar with the rev-2 schema upgrade; load-bearing facts preserved + extended with Stress Protocol categories, Category F request-input alignment, upstream_callers, downstream_side_effects, and an emitted probe P-181 for the negative-value / overflow boundaries.)

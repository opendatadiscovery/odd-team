---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.config config-properties-class:HousekeepingTTLProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-housekeeping-ttl-properties
---

# HousekeepingTTLProperties (`@ConfigurationProperties("housekeeping.ttl")`) — semantic understanding

## understanding

`HousekeepingTTLProperties` is the typed Spring Boot binding for the `housekeeping.ttl.*` YAML namespace and the **entire retention surface** of the ODD Platform housekeeping subsystem — a `@Component` `HousekeepingJobManager` that fires every 15 minutes (Spring `@Scheduled(fixedRate = 15, timeUnit = MINUTES)`, ShedLock-coordinated as `housekeepingJob` with `lockAtLeastFor = "14m" / lockAtMostFor = "14m"`) and iterates a discovered `List<HousekeepingJob>` of FIVE jobs total: three time-based purge jobs (`AlertHousekeepingJob`, `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`) that each consume one of this POJO's three fields, plus two `EmptyPartitionsHousekeepingJob` subclasses (`ActivityEmptyPartitionsHousekeepingJob`, `MessageEmptyPartitionsHousekeepingJob`) that do NOT consume this POJO and instead drop EMPTY past partitions only. The POJO carries exactly three primitive-int fields — `resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays` — each defaulted to `30` in the shipped `application.yml`. The subsystem master gate is `housekeeping.enabled` (default `true` in `application.yml`, gated by `@ConditionalOnProperty(value = "housekeeping.enabled", havingValue = "true")` on `HousekeepingJobManager`), which is read at boot only and does NOT live on this POJO. **There is NO `activity*Days` or `messageDays` field — the housekeeping TTL surface explicitly does NOT cover the `activity` or `message` tables; time-based retention for those tables does not exist anywhere in the codebase.**

## concepts

- entities: [HousekeepingTTLProperties, HousekeepingJobManager, HousekeepingJob (interface), AlertHousekeepingJob, SearchFacetsHousekeepingJob, DataEntityHousekeepingJob, EmptyPartitionsHousekeepingJob, ActivityEmptyPartitionsHousekeepingJob, MessageEmptyPartitionsHousekeepingJob, ALERT table, ALERT_CHUNK table, SEARCH_FACETS table, DATA_ENTITY table (and ~25 cascaded child tables), ACTIVITY table, MESSAGE table]
- operations: [bind housekeeping.ttl.resolved_alerts_days → int resolvedAlertsDays, bind housekeeping.ttl.search_facets_days → int searchFacetsDays, bind housekeeping.ttl.data_entity_delete_days → int dataEntityDeleteDays, schedule fixedRate=15min housekeeping cycle, fan out to all discovered HousekeepingJob beans, hard-DELETE resolved alerts + chunks past TTL, hard-DELETE search-facet rows past last-accessed TTL, cascade-DELETE soft-deleted data-entity rows + ~25 child relations past TTL, drop empty past partitions of activity/message]
- invariants:
  - "Three TTL fields, all integer days, all default to 30 in `application.yml` (HousekeepingTTLProperties.java:9-11 + application.yml:165-170)."
  - "Defaults shipped at the YAML level, NOT the Java level — fields are `private int` primitives with no `= 30` initializer; a deployment with no `application.yml` or missing `housekeeping.ttl.*` keys binds `0` and would hard-delete data INSTANTLY on first housekeeping cycle (LSN-001-shape silent-data-loss). Operators relying on env-var-only configuration (`HOUSEKEEPING_TTL_RESOLVED_ALERTS_DAYS` unset) are protected only because the bundled `application.yml` provides the `30`-day default — not because the Java code does."
  - "Subsystem master gate (`housekeeping.enabled`) defaults to `true` in `application.yml:166` — housekeeping runs unless explicitly disabled; the integration-test profile flips it to `false` (application-integration-test.yml:7-8)."
  - "The TTL surface covers EXACTLY three tables: ALERT (with ALERT_CHUNK cascade), SEARCH_FACETS, and DATA_ENTITY (with ~25-table cascade through DataEntityHousekeepingJob). ACTIVITY and MESSAGE tables have NO time-based retention; their only housekeeping is `EmptyPartitionsHousekeepingJob`, which drops past partitions ONLY if they are empty (`COUNT(*) = 0` check at PartitionServiceImpl.java:133-141)."
  - "All three TTL-consuming jobs use `DateTimeUtil.generateNow().minus<Days>(ttl)` as the cutoff — the cutoff is `now - ttl days` (HIGH-precision cutoff is per-cycle; ShedLock guarantees only one platform instance runs per 15-minute window)."
  - "`AlertHousekeepingJob` jOOQ predicate has an operator-precedence trap (`.where(STATUS=RESOLVED).or(STATUS=RESOLVED_AUTOMATICALLY).and(STATUS_UPDATED_AT <= cutoff)`) — the AND binds only to the second OR clause, producing the predicate `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. The TTL is therefore IGNORED for manual `RESOLVED` rows — they are hard-deleted on the very next 15-minute cycle regardless of `resolvedAlertsDays`. This is a known platform bug acknowledged on the live docs page (WebFetch /configuration-and-deployment/odd-platform: '...a known platform bug currently exempts manual resolutions from the retention check')."
- audiences: [odd-platform operators tuning database growth, DBAs sizing the alert/search/data-entity tables, compliance / data-retention reviewers who need to know what's purged and when, https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (Configure ODD Platform reference)]

## dependencies_semantic

- requires-feature:
  - "Alert subsystem (ALERT, ALERT_CHUNK tables exist and contain RESOLVED / RESOLVED_AUTOMATICALLY rows produced by the alert state-machine) — AlertHousekeepingJob.java:28-43 consumes RESOLVED data."
  - "Search-facets feature (SEARCH_FACETS table updated with LAST_ACCESSED_AT timestamps on every search query) — SearchFacetsHousekeepingJob.java:23-27 consumes."
  - "Data-entity soft-delete subsystem (DataEntityStatusDto.DELETED status set by an explicit operator action; STATUS_UPDATED_AT recorded) — DataEntityHousekeepingJob.java:71-80 consumes."
  - "`HousekeepingJobManager` (`@Scheduled` orchestrator) — discovers all `HousekeepingJob` beans via `List<HousekeepingJob>` constructor injection (HousekeepingJobManager.java:23) and runs each every 15 minutes under ShedLock."
  - "`PGConnectionFactory` — supplies the JDBC `Connection` on which all jOOQ DSL operations execute (HousekeepingJobManager.java:32). The connection is shared across all jobs in a single cycle."
- requires-config:
  - "`housekeeping.enabled` — boolean, no default in code; defaults to `true` in `application.yml:166`. Read by `@ConditionalOnProperty` on `HousekeepingJobManager.java:18` — if absent at deploy time AND the application.yml is overridden without this key, the bean is NOT instantiated and housekeeping silently does not run. `havingValue = \"true\"` (no `matchIfMissing`) — strict opt-in if the key is missing."
  - "`housekeeping.ttl.resolved_alerts_days` — int, no default in code (`private int resolvedAlertsDays;` HousekeepingTTLProperties.java:9); defaulted to `30` in `application.yml:168`."
  - "`housekeeping.ttl.search_facets_days` — int, no default in code (HousekeepingTTLProperties.java:10); defaulted to `30` in `application.yml:169`."
  - "`housekeeping.ttl.data_entity_delete_days` — int, no default in code (HousekeepingTTLProperties.java:11); defaulted to `30` in `application.yml:170`."
  - "Spring relaxed-binding maps snake_case YAML keys to camelCase Java fields (`resolved_alerts_days` ↔ `resolvedAlertsDays`)."
- requires-runtime:
  - "PostgreSQL — all three TTL jobs issue jOOQ DELETE statements against PG; `DataEntityHousekeepingJob` issues ~25 cascaded DELETEs in a single jOOQ transaction (DataEntityHousekeepingJob.java:71-129)."
  - "Spring Boot scheduling subsystem (`@Scheduled`) — required for the 15-minute fixed-rate cycle."
  - "ShedLock-Spring with a PG-backed lock provider for the `housekeepingJob` lock name — required for multi-instance correctness; without it, every instance would independently delete (DataEntityHousekeepingJob cascade is non-idempotent and races would be observable)."
  - "`DateTimeUtil.generateNow()` — the server-side `now()` reference; the cutoff is server-local-time, not UTC-explicit (timezone-implicit defect class — see ActivityTablePartitionManager sidecar for the parallel observation)."
- coupling:
  - "**Conceptual sibling** with `ActivityTablePartitionManager` (`odd.activity.partition-period` consumer at ActivityTablePartitionManager.java:11) and `MessageTablePartitionManager` (`datacollaboration.message-partition-period`) — those two beans control partition CADENCE on the activity/message tables, while `EmptyPartitionsHousekeepingJob` subclasses (in this housekeeping package) drop empty past partitions. **Together those subsystems do NOT constitute retention for activity/message — there is no `*Days` field for either table on this POJO, and the partition-empty-check requires the partition to already be empty (i.e. data must be deleted by some other path first, which does not exist for activity rows except indirectly via `DataEntityHousekeepingJob.deleteActivity`, DataEntityHousekeepingJob.java:228-232, which only fires when a data-entity is soft-deleted past its own TTL).**"
  - "Shared 15-minute scheduling cadence + shared `Connection` (via PGConnectionFactory) across all five HousekeepingJob beans — a slow DataEntityHousekeepingJob cycle (which issues ~25 DELETEs in a single transaction across all soft-deleted entities) can starve the other four jobs within the same 14m ShedLock window."
  - "**Operator-trap coupling** with the LSN-001 attachment-storage default — `DataEntityHousekeepingJob.deleteFiles` (lines 131-143) calls `fileUploadService.deleteFiles(filePojos).block()` to remove stored attachment files when a data-entity is purged. If `attachment.storage` is the LOCAL ephemeral default (LSN-001), file-deletion is a no-op (the storage was already wiped); if it's REMOTE S3, the housekeeping job hard-deletes the S3 object. An operator misconfiguring storage to LOCAL + setting `data_entity_delete_days=1` for testing purposes would silently lose all attachments at the first housekeeping cycle past the cutoff."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Binding: `housekeeping.ttl.resolved_alerts_days=7` flows through to `AlertHousekeepingJob.housekeepingTTLProperties.getResolvedAlertsDays() == 7`."
  - "Default propagation: with no `housekeeping.ttl.*` keys at all (env-var-only deploy with all env vars unset), the fields bind to `0` (Java int default) and the next housekeeping cycle hard-deletes ALL RESOLVED alerts + ALL search-facets last-accessed before `now()` + ALL soft-deleted data entities — i.e. zero-day retention by silent fallback."
  - "Master-gate: `housekeeping.enabled=false` does not register the `HousekeepingJobManager` bean and no housekeeping runs (integration-test profile relies on this behaviour at application-integration-test.yml:7-8 but there is no positive test asserting it)."
  - "AlertHousekeepingJob jOOQ operator-precedence: the documented known-bug behaviour (manual RESOLVED alerts deleted on next cycle regardless of TTL) — no regression test asserts the CURRENT behaviour, and no test asserts the INTENDED behaviour (both states share the cutoff). A future fix that rewrites the predicate could regress to the same bug without detection."
  - "DataEntityHousekeepingJob cascade: the ~25 cascaded DELETEs in DataEntityHousekeepingJob.deleteDataEntities (lines 99-126) form a critical transaction with no test coverage. Any future schema migration that adds a new child table referencing DATA_ENTITY by FK would need a new `deleteX(...)` step here; missing it would either (a) fail the transaction with FK violation (loud) or (b) leave orphan rows if FK is ON DELETE CASCADE (silent)."
  - "SearchFacetsHousekeepingJob's `DSL.currentOffsetDateTime().minus(housekeepingTTLProperties.getSearchFacetsDays())` (SearchFacetsHousekeepingJob.java:25-26) — `.minus(int)` on an Offset-DateTime expression: confirm jOOQ binds this as PostgreSQL `current_timestamp - interval '30 days'` and not as `current_timestamp - 30` (raw seconds/days). No test asserts the SQL emitted."
  - "ShedLock multi-instance race: two instances boot simultaneously, both attempt to run housekeeping at minute 0 — only one acquires the lock; the other no-ops. No test verifies this in a multi-process scenario (single-JVM ShedLock unit tests are not equivalent)."
  - "ActivityEmptyPartitionsHousekeepingJob / MessageEmptyPartitionsHousekeepingJob — confirm `getEmptyPastPartitions` returns only PAST partitions (the `isPartitionInPast` predicate at PartitionServiceImpl.java:129-131) AND only empty ones (`isPartitionEmpty` at lines 133-141). No coverage of the corner case where a non-empty past partition exists — confirm it is NOT dropped (i.e. the empty-check is the guard against data loss)."
- test_files: []
- gaps: |
    No test under `odd-platform-api/src/test/java` references `HousekeepingTTLProperties`,
    `HousekeepingJobManager`, `HousekeepingJob`, `AlertHousekeepingJob`,
    `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`,
    `EmptyPartitionsHousekeepingJob`, `ActivityEmptyPartitionsHousekeepingJob`,
    or `MessageEmptyPartitionsHousekeepingJob` (a grep against the test directory
    matching any of these returned zero hits). The entire housekeeping subsystem
    — including a known production bug already acknowledged on the live docs page
    (manual RESOLVED alerts ignored by TTL) — is exercised exclusively by
    integration tests that happen to flip `housekeeping.enabled: false` to
    OPT OUT of the subsystem, not to test it.

    Likeliest regression sites:

    1. **The `application.yml`-vs-Java-default split** — the safety floor for the
       three TTL fields lives in `application.yml`, not in the Java class. A future
       refactor that splits `application.yml` into profile-specific files (e.g.
       `application-prod.yml`) without copying the `housekeeping.ttl` block
       silently binds `0` and hard-deletes everything past `now()` on the first
       cycle. Promoting the defaults into the Java POJO (`private int resolvedAlertsDays = 30;`)
       would close this gap; no test enforces it currently.
    2. **jOOQ operator-precedence in `AlertHousekeepingJob`** — the known bug
       (lines 28-34 `.where().or().and()` precedence) has been around long
       enough to be documented; a fix that adds parentheses would need a test
       to lock in the corrected behaviour and prevent regression.
    3. **DataEntityHousekeepingJob cascade completeness** — the ~25-table
       cascade is a candidate for schema-evolution drift; an integration test
       that creates a soft-deleted data-entity with rows in every cascaded
       child table and asserts ALL are removed would catch missing-table
       regressions in future migrations.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#housekeeping"
    rationale: "Canonical configuration-reference page for ODD Platform; live content documents all four housekeeping keys (`housekeeping.enabled`, `housekeeping.ttl.resolved_alerts_days`, `housekeeping.ttl.search_facets_days`, `housekeeping.ttl.data_entity_delete_days`) and acknowledges the AlertHousekeepingJob jOOQ-precedence bug."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-12):
      - "ODD Platform runs a background **housekeeping job** that permanently
        deletes stale data on a schedule. The job fires every **15 minutes**, is
        guarded by a ShedLock so only one platform instance runs it at a time
        in a multi-instance deployment, and iterates through three cleanup
        tasks: resolved alerts, search-facet history, and soft-deleted data
        entities."
      - "`housekeeping.ttl.resolved_alerts_days`: how many days an alert in
        `RESOLVED_AUTOMATICALLY` status is kept after its status-update
        timestamp before the housekeeping job permanently deletes it (alongside
        its chunk records). Integer, days. Defaults to `30`. **Note:** the
        retention window is intended to apply to both `RESOLVED` (manual) and
        `RESOLVED_AUTOMATICALLY` (system) states, but a known platform bug
        currently exempts manual resolutions from the retention check —
        manual `RESOLVED` alerts are hard-deleted on the next housekeeping
        run regardless of this value."
      - "**Disabling housekeeping (`housekeeping.enabled: false`) stops all
        three cleanup jobs.** Resolved alerts, search-facet history, and
        soft-deleted data entities will accumulate indefinitely and the
        PostgreSQL database will grow without bound."

      The page does NOT mention:
      - the `housekeeping.ttl.*` fields' lack of a Java-side default (the
        `private int X;` declaration vs the `application.yml` floor; an
        operator misreading the documentation might assume `30` is hardcoded).
      - the EmptyPartitionsHousekeepingJob behaviour for activity/message
        tables — the page describes "three cleanup tasks" and the two
        empty-partitions jobs are NOT listed in this enumeration; an operator
        cannot learn from this page that activity/message empty partitions
        are also dropped on the same 15-min schedule.
      - the shared 15-minute cycle + 14-minute ShedLock window — operators
        sizing the DataEntityHousekeepingJob cascade (which can run for
        minutes against large data-entity backlogs) cannot infer that a slow
        cascade may push the ShedLock past its 14m maximum, releasing the lock
        prematurely on the holding instance and producing an undefined
        cross-instance race state.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "#configuration"
    rationale: "Cross-feature cross-reference — the activity-feed page is the surface that claims `odd.activity.partition-period` controls 'retention and partitioning'. This sidecar confirms from the housekeeping-side angle that **no activity retention exists** in the codebase (housekeeping has no `activity*Days` field; the only activity-touching job is the partition-empty-drop, which depends on data already being absent)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quote (WebFetched 2026-05-12):
      - "Activity-feed retention and partitioning are controlled by the
        platform-level setting `odd.activity.partition-period` on Configure
        ODD Platform."

      Cross-confirmed against this node: the platform's housekeeping TTL
      surface explicitly does NOT include an activity-feed field, and the
      `ActivityEmptyPartitionsHousekeepingJob` (the only activity-touching
      housekeeping path) drops empty past partitions — it does NOT delete
      activity-event rows by age. The activity-feed doc page's "retention"
      claim is unsupported from two angles: ActivityTablePartitionManager
      (which controls WIDTH only) AND HousekeepingTTLProperties (which has
      no activity field).
- doc_drift_findings:
  - "**Drift CONFIRMED from second angle (validates batch B REFACTOR-085 / DOC-NNN-activity-retention candidate)**: the activity-feed live page claims 'Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`'. The code-side reality, viewed from this housekeeping POJO, is that the entire `housekeeping.ttl.*` surface contains exactly three fields and NONE of them targets the ACTIVITY table. The only activity-touching housekeeping path is `ActivityEmptyPartitionsHousekeepingJob`, which calls `partitionService.getEmptyPastPartitions(...)` → `partitionService.dropPartition(...)` (EmptyPartitionsHousekeepingJob.java:21-27). That path requires the partition to already be EMPTY (`isPartitionEmpty` at PartitionServiceImpl.java:133-141 checks `COUNT(*) = 0`). There is NO code path that deletes activity rows by age. Therefore: time-based retention for the activity-feed does not exist in this codebase from either direction (partition manager OR housekeeping)."
  - "**Drift identified — housekeeping coverage incomplete on docs page**: the canonical /configuration-and-deployment/odd-platform docs page describes the housekeeping subsystem as 'three cleanup tasks: resolved alerts, search-facet history, and soft-deleted data entities'. The code reality is FIVE HousekeepingJob beans: those three PLUS `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob`. An operator reading the docs page cannot learn that the same 15-min schedule that purges alerts also drops empty activity/message partitions — this is a doc COMPLETENESS gap rather than a doc/code disagreement on values."
  - "**Drift identified — Java vs YAML default mismatch is undocumented**: the docs page says 'Integer, days. Defaults to `30`'. The Java source declares `private int resolvedAlertsDays;` (HousekeepingTTLProperties.java:9) with no `= 30` initializer — the `30` floor lives ONLY in the shipped `application.yml:168-170`. An operator who reads the docs as 'the default is 30 days' may not realise that overriding `application.yml` without re-supplying the `housekeeping.ttl` block silently rebinds to `0` (Java primitive default), turning the housekeeping subsystem into an immediate hard-delete-everything-past-now() job. Documentation could clarify by either: (a) noting the default lives in the bundled `application.yml` and is lost if the file is overridden, OR (b) advocating for the maintainer to move the default into the Java declaration."
  - "**Drift identified — known bug acknowledged on docs but unattached to a tracking issue / line citation**: the docs page acknowledges the AlertHousekeepingJob jOOQ-precedence bug ('manual `RESOLVED` alerts are hard-deleted on the next housekeeping run regardless of this value'). The bug is at AlertHousekeepingJob.java:28-34 — a documented bug without a corresponding GitHub issue link, retention-test, or fix-roadmap entry in the docs. The acknowledgement is useful but leaves operators with no way to track resolution or workaround. Candidate DOC-NNN: link the docs-page bug-acknowledgement to a tracked upstream issue."

## implicit_adrs

- "Housekeeping is a separate concern from partition management — these are TWO distinct lifecycle subsystems in the codebase (`housekeeping/` and `partition/` packages), with two distinct schedulers, two distinct ShedLock names (`housekeepingJob` 15-min / `partitionCreationJob` daily at 00:01), and two distinct advisory-lock IDs (housekeeping uses ShedLock only; partitions use a Postgres advisory lock id 90 at boot AND ShedLock at cron). The decision to keep them separate — rather than fold partition-empty-drop into a single housekeeping flow — is visible in the explicit subclass inheritance: `ActivityEmptyPartitionsHousekeepingJob extends EmptyPartitionsHousekeepingJob implements HousekeepingJob` — the partition-empty-drop participates in the housekeeping scheduler but lives behind a clean abstract base in `housekeeping/job/`, while the partition CADENCE creation lives in `partition/manager/`. The split is intentional: schedule-driven cleanup vs structural lifecycle." — evidence: HousekeepingJobManager.java:18 (`@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")`) + EmptyPartitionsHousekeepingJob.java:13 (`abstract class ... implements HousekeepingJob`) + ActivityEmptyPartitionsHousekeepingJob.java:9 (`extends EmptyPartitionsHousekeepingJob`) + the parallel `partition/manager/ActivityTablePartitionManager.java` for partition CREATION (different package, different lifecycle). — intent_anchor: "the abstract `EmptyPartitionsHousekeepingJob` deliberately implements `HousekeepingJob` (the housekeeping interface) while consuming a `PartitionService` (the partition service) — explicit two-package coupling that names both concerns at the type level rather than hiding the partition concern inside the housekeeping flow." — confidence: HIGH
- "Housekeeping defaults are intentionally CONSERVATIVE (30 days for all three TTLs) — a uniform 30-day window across alerts, search-facets, and soft-deleted entities is applied as a single default. The convention is that 30 days is operator-comfortable for 'oops I clicked delete' recovery on data entities, and 30 days of resolved alerts gives enough history for incident retrospectives. The uniformity (NOT three different defaults tuned per-table) is the implicit decision: 'pick one default, apply across all three TTLs, let operators tune individually'." — evidence: application.yml:167-170 (all three TTLs default to `30`, no per-field rationale comment but the consistency itself is the convention). — intent_anchor: "the `30 / 30 / 30` triplet in application.yml — no comment, but the uniform choice across three semantically-distinct concerns (alert RESOLVED state, search-facets last-access, data-entity soft-delete grace) reflects a deliberate 'one default to rule them all' stance." — confidence: MEDIUM (the WHY is convention; no source comment proves the 30-day choice is reasoned vs accidental).
- "Subsystem is OPT-OUT (`housekeeping.enabled: true` ships as default in application.yml) — the platform deletes data BY DEFAULT in shipped deployments. The decision favours bounded DB growth over data preservation; an operator must explicitly set `housekeeping.enabled: false` to retain all RESOLVED alerts / soft-deleted entities indefinitely. The opt-out stance is reinforced by the `@ConditionalOnProperty(havingValue = \"true\")` with no `matchIfMissing` — strict opt-in if the key is missing from the YAML, which combined with the shipped application.yml's `enabled: true` produces opt-out semantics for shipped deployments." — evidence: HousekeepingJobManager.java:18 (`@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` — no `matchIfMissing`) + application.yml:165-166 (`housekeeping: enabled: true`). — intent_anchor: "the `havingValue = \"true\"` literal with NO `matchIfMissing` attribute — explicit strict-opt-in coupled with the shipped YAML default of `true` — the combination is the architectural decision: ship-with-housekeeping-on, but require explicit configuration to remain on if application.yml is replaced." — confidence: HIGH

## bugs_limitations_corner_cases

- "**No `activity*Days` retention field — confirms drift surfaced in batch B from a second angle (REFACTOR-085 / activity-feed retention claim)**. The `HousekeepingTTLProperties` class has exactly three fields (`resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays`) and there is no fourth field for the activity-feed table. `ActivityEmptyPartitionsHousekeepingJob` (the only activity-touching housekeeping bean) calls `partitionService.getEmptyPastPartitions(...)` which checks `COUNT(*) = 0` BEFORE dropping (PartitionServiceImpl.java:133-141) — a partition with even one row will be retained indefinitely. Therefore: time-based retention for activity-feed data does not exist anywhere in the platform codebase. The /features/active-platform-features/activity-feed docs page's claim that `odd.activity.partition-period` controls 'retention and partitioning' is unsupported. **Cross-reference**: the parallel observation in `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md`'s `doc_drift_findings` notes that the partition-WIDTH knob controls cadence only; this sidecar adds that the housekeeping TTL surface explicitly EXCLUDES activity. Both angles agree the doc claim is wrong. Suggested DOC-NNN: rewrite the activity-feed Configuration section to say 'partitioning is controlled by `odd.activity.partition-period`; ODD does NOT currently retention-delete activity rows — operators with high-volume activity must manually drop old partitions or implement application-level archival.'" — evidence: HousekeepingTTLProperties.java:8-12 (entire class — three fields, no activity field) + AbstractPartitionManager.java:14-51 (no `dropPartition` invocation from CREATE path) + PartitionServiceImpl.java:133-141 (the `isPartitionEmpty` check) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no activity-by-age DELETE in any of them) + WebFetch /features/active-platform-features/activity-feed#configuration ('retention and partitioning are controlled by'). — severity: HIGH (LSN-001-shape silent-data-growth on the activity audit trail — a high-volume deployment WILL exhaust storage)
- "**No `messageDays` retention field for the datacollaboration `MESSAGE` table** — symmetric to the activity gap. `MessageEmptyPartitionsHousekeepingJob` (housekeeping/job/MessageEmptyPartitionsHousekeepingJob.java:12-25) only drops EMPTY past partitions, with `MESSAGE_PROVIDER_EVENT` as an excluded sibling table. There is no time-based retention for messages — operators running DataCollaboration with high message-throughput accumulate messages indefinitely. The /configuration-and-deployment/odd-platform docs page does not document either the activity-feed gap or the message gap." — evidence: HousekeepingTTLProperties.java:8-12 (no message field) + MessageEmptyPartitionsHousekeepingJob.java:18-21 (only empty-partition-drop, no row-delete-by-age). — severity: MEDIUM (DataCollaboration is feature-flagged off by default — limited blast radius — but operators who enable it inherit silent unbounded growth)
- "**Java-side default mismatch — fields are `private int` with no initializer; safety floor lives only in `application.yml`**. `HousekeepingTTLProperties.java:9-11` declares three `private int X;` fields with no `= 30` initializer. A deployment that overrides `application.yml` (e.g. mounts a different config file via `--spring.config.location=` or Spring Cloud Config) without re-supplying the `housekeeping.ttl.*` block will bind `0` for all three. The next housekeeping cycle (which runs ~15 minutes after boot) would: (a) DELETE all RESOLVED + RESOLVED_AUTOMATICALLY alerts whose status-update is `<= now()` — i.e. ALL resolved alerts; (b) DELETE all search-facets with `LAST_ACCESSED_AT <= now()` — i.e. all of them; (c) DELETE all data-entities in DELETED status with `STATUS_UPDATED_AT <= now()` — i.e. all soft-deleted entities, cascading through ~25 child tables. This is the LSN-001 shape: silent default produces production data loss. Promoting the defaults into the Java declaration (`private int resolvedAlertsDays = 30;`) would close this gap. Spring `@DefaultValue` on the field would also work but is less idiomatic in Java." — evidence: HousekeepingTTLProperties.java:9 (`private int resolvedAlertsDays;` — no `= 30`), :10 (`private int searchFacetsDays;`), :11 (`private int dataEntityDeleteDays;`) + application.yml:168-170 (the `30` floor). — severity: HIGH (LSN-001-shape silent-data-loss-on-default — exact same failure class as attachment.storage.mode default)
- "**`AlertHousekeepingJob` jOOQ operator-precedence bug — known and documented but un-tested and un-fixed**. AlertHousekeepingJob.java:28-34 reads: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's fluent-builder precedence: `.and(...)` binds to the most recent `.or(...)`, producing the predicate `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. The TTL therefore applies only to RESOLVED_AUTOMATICALLY rows; manual RESOLVED rows are hard-deleted on the very next 15-minute cycle. The docs page acknowledges this (WebFetch /configuration-and-deployment/odd-platform: '...a known platform bug currently exempts manual resolutions from the retention check') — but there is no test, no GitHub-issue link in the source, and no `// TODO` comment marking the bug. The fix is to parenthesise: `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` — group the OR before AND-ing the cutoff." — evidence: AlertHousekeepingJob.java:28-34 (the predicate chain) + WebFetch /configuration-and-deployment/odd-platform (the docs acknowledgement). — severity: HIGH (silent data loss for manual alert resolutions — a user marking an alert RESOLVED loses it on the next housekeeping cycle, with 30-day retention promised in docs but bypassed in code)
- "**No dry-run mode, no audit log of housekeeping deletions, no per-table metrics**. All three jobs log `log.debug(\"... deleted N rows ...\")` (AlertHousekeepingJob.java:45, SearchFacetsHousekeepingJob.java:29, DataEntityHousekeepingJob.java:128) — debug-level, not captured by default in production logging configuration. There is no structured audit emission (no `@ActivityLog`, no Prometheus counter incrementing `housekeeping_deleted_total{table=...}`). An operator investigating 'how much did housekeeping delete yesterday' has no observable surface — the deletion is silent in production logging." — evidence: AlertHousekeepingJob.java:45 (`log.debug(\"Housekeeping job deleted {} resolved alerts\", deletedResolvedAlerts)`) + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128 + grep of housekeeping/ for `@ActivityLog | Counter | Meter` returning zero matches. — severity: MEDIUM
- "**`@ConditionalOnProperty(\"housekeeping.enabled\", havingValue = \"true\")` with NO `matchIfMissing`** — if `housekeeping.enabled` is absent from the resolved configuration (e.g. operator deletes the key from a customised application.yml), the `HousekeepingJobManager` bean is NOT instantiated and housekeeping silently does not run. The integration-test profile flips it to `false` deliberately, but an operator misconfiguration (missing key vs `false` key) produces identical no-op behaviour. The docs page describes housekeeping as on-by-default, which is true only because the shipped application.yml ships `enabled: true` — the Java-side guard would block the bean if the key were absent." — evidence: HousekeepingJobManager.java:18 (no `matchIfMissing` attribute on `@ConditionalOnProperty`) + application-integration-test.yml:7-8 (the OPT-OUT). — severity: LOW (operator-error gated; ships with sane default)
- "**`DataEntityHousekeepingJob.deleteFiles` calls `fileUploadService.deleteFiles(filePojos).block()`** — the reactive call is `.block()`ed inside a jOOQ transaction (DataEntityHousekeepingJob.java:142). If MinIO / S3 storage is unreachable (LSN-002-shape region misconfiguration, network partition, credential rotation), the `block()` either hangs indefinitely (no explicit timeout) or throws — taking the surrounding jOOQ transaction with it. The transaction wraps the entire ~25-table cascade (DataEntityHousekeepingJob.java:71 `DSL.using(connection).transaction(ctx -> {...})`), so a single failed S3 delete rolls back ALL the cleanup for that batch of data entities. The next 15-minute cycle would retry the entire batch. If the failure is persistent (e.g. wrong S3 region), data entities accumulate in DELETED status indefinitely while housekeeping silently fails each cycle (only `log.error` at HousekeepingJobManager.java:45 surfaces it)." — evidence: DataEntityHousekeepingJob.java:142 (`fileUploadService.deleteFiles(filePojos).block()`) + DataEntityHousekeepingJob.java:71 (the surrounding `transaction(ctx -> ...)`) + HousekeepingJobManager.java:41-47 (the outer try/catch/log.error). — severity: MEDIUM (failure is loud in logs but the data-loss-prevention side-effect — soft-deleted entities never fully purged — is silent in the UI / metrics)

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`HousekeepingTTLProperties` is a `@ConfigurationProperties` POJO; the housekeeping subsystem runs in the Spring scheduling context (not the HTTP surface). Auth mode (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP | S2S`) does not apply directly. The bean is instantiated unconditionally regardless of `auth.type`." — evidence: HousekeepingTTLProperties.java:6 (`@ConfigurationProperties(\"housekeeping.ttl\")`, no auth-conditional annotation) + HousekeepingJobManager.java:18 (gated by housekeeping.enabled, not auth.type).
- ingestion_filter_relevance: "N/A — not HTTP. The housekeeping subsystem does not participate in `POST /ingestion/entities`; it runs on a Spring-scheduled fixed-rate cycle (HousekeepingJobManager.java:25)."
- authorization_assertions: []
- owner_scoping: "BYPASSES — the three TTL-driven jobs delete rows ACROSS ALL OWNERS without regard to the ODD ownership model. `AlertHousekeepingJob` deletes all RESOLVED_AUTOMATICALLY alerts past TTL regardless of which owner the alert was raised against; `DataEntityHousekeepingJob` cascades through OWNERSHIP (DataEntityHousekeepingJob.java:268-273 `deleteOwnerships`) to remove ALL ownership relations for the soft-deleted entity. This is intentional — housekeeping is a system-level admin operation — but means a future regression that, e.g., narrowed the AlertHousekeepingJob predicate to a per-owner scope would break the design intent. Cite the system-level scope in any future restructuring." — evidence: AlertHousekeepingJob.java:28-34 (no `OWNERSHIP` join, no owner filter) + DataEntityHousekeepingJob.java:268-273 (deleteOwnerships cascades).
- data_exposure:
  - "Housekeeping jobs do NOT expose data outbound — they DELETE rows; there is no HTTP response, log, or external sink containing the deleted content. The risk surface is INVERSE: deleted data is gone, and the only acknowledgement is `log.debug(\"deleted N\")` at debug level. A compliance / forensic-investigation request for 'show me the deleted resolved alerts from 2025-12' cannot be satisfied — no archival, no audit log of what was deleted, only the count at debug-level."
- known_security_gaps:
  - "**No tamper-evident audit log of housekeeping deletions** — a malicious operator with `housekeeping.ttl.resolved_alerts_days` write access (e.g. via env-var override at deploy time) could set the value to `0` and the next housekeeping cycle would silently destroy all RESOLVED alert history. There is no audit trail of the configuration change AND no audit trail of the deletion — both are silent in production. Compliance frameworks that require 'changes to data retention policies must be logged and reviewable' are not satisfied. Suggested mitigation: structured audit event on housekeeping cycle (`audit.housekeeping.cycle{table=alerts, deleted=N, cutoff=...}`) + `@ActivityLog` on configuration-binding (boot-time)." — evidence: HousekeepingTTLProperties.java (entire file — no audit annotations) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (none emit structured audit; all use `log.debug` only). — severity: MEDIUM
  - "**No dry-run / no preview / no backup-before-delete mechanism** — the three TTL jobs hard-DELETE without any operator-overridable safeguard. There is no `housekeeping.dry-run=true` mode that logs what would be deleted, no `housekeeping.ttl.backup-table` that copies rows to an archive before delete, no `--reload-config` style operator gate. A misconfigured `housekeeping.ttl.data_entity_delete_days=1` immediately cascades through ~25 tables on the next 15-minute cycle with no recovery path." — evidence: HousekeepingJobManager.java:25-39 (no `dry-run` check before the `housekeepingJob.doHousekeeping(connection)` call) + AlertHousekeepingJob.java:40-43 (the actual DELETE — no archival path) + DataEntityHousekeepingJob.java:99-126 (the cascaded DELETE sequence — no archival). — severity: MEDIUM (operator-error blast radius — the LSN-001 shape applies)

## performance

- hot_paths:
  - "Housekeeping cycle runs every 15 minutes (HousekeepingJobManager.java:25 `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`). On busy clusters, the cycle is on a critical operational path: a slow DataEntityHousekeepingJob cascade (which can take minutes against a large soft-deleted backlog) holds the ShedLock for the full 14 minutes and may starve other instances' housekeeping from running. Boot-time impact is zero (the job is `@Scheduled`, not `@PostConstruct`)."
- throughput_characteristics:
  - "Single connection, sequential job fan-out — `HousekeepingJobManager.runHousekeepingJobs` (lines 27-39) acquires ONE `Connection` from `PGConnectionFactory` and iterates `for (final HousekeepingJob housekeepingJob : housekeepingJobs)` — each job runs synchronously on the same connection. There is no parallelism across the five jobs. Total cycle time is the sum of all five jobs' execution times. A slow DataEntityHousekeepingJob blocks AlertHousekeepingJob from running until it completes."
  - "Bulk DELETE in jOOQ transaction — `DataEntityHousekeepingJob.doHousekeeping` (lines 71-82) wraps the entire ~25-table cascade in a single `DSL.using(connection).transaction(ctx -> {...})`. The transaction is held for the full duration of the cascade — for a backlog of N soft-deleted data entities, this is N × 25 DELETE round-trips. PostgreSQL holds row-level locks on all touched rows for the transaction duration; concurrent INSERTs against the same data entity (e.g. an ingestion writing alerts for a soon-to-be-purged entity) may block."
- resource_allocation:
  - "DataEntityHousekeepingJob loads `List<DataEntityPojo> dataEntitiesToDelete` into memory before deleting (lines 75-78) — bounded only by the backlog size of soft-deleted entities. A platform that has accumulated tens of thousands of soft-deleted entities (e.g. operator ran `data_entity_delete_days=1` briefly) would load all of them into a single in-memory list. No batching, no streaming, no LIMIT."
  - "Similarly `dataEntityIds` and `dataEntityOddrns` arrays at lines 91-97 — both held in memory for the full transaction duration."
  - "`MESSAGE.UUID` collection in `deleteMessages` (lines 282-296) — all message UUIDs for all deleted entities fetched into a `List<UUID>` before the cascaded DELETE; for an entity with millions of messages, this is a memory-budget hazard."
- scaling_characteristics:
  - "ShedLock-coordinated — `lockAtLeastFor = \"14m\" / lockAtMostFor = \"14m\"` (HousekeepingJobManager.java:26) — only one platform instance runs housekeeping per 15-minute slot. The 14-minute upper bound is dangerously close to the 15-minute schedule: a job that runs for 14 minutes 1 second releases the lock prematurely and a second instance can acquire it for the next cycle while the first is still committing. `lockAtMostFor` should be `> fixedRate / 2` for safety; the current values are right at the edge."
  - "`fixedRate` semantics: Spring `fixedRate = 15min` schedules the next invocation 15 minutes AFTER the previous invocation STARTED. If a cycle takes 10 minutes, the next cycle starts 5 minutes later. If a cycle takes 20 minutes (longer than the rate), Spring queues the next invocation immediately on cycle completion. Combined with ShedLock, this means a 20-minute cycle on one instance allows the next 15-minute slot on a DIFFERENT instance — the housekeeping cadence is approximately 15-min but with multi-instance jitter under heavy backlogs."
  - "Activity / message empty-partition-drops scale O(P) where P = number of past partitions of the table — `getEmptyPastPartitions` (PartitionServiceImpl.java:82-118) issues one `SELECT count(*) = 0 FROM <partition>` per past partition. A platform with multi-year activity history has dozens of past partitions; each cycle re-checks all of them (no caching of 'this partition was non-empty last cycle, skip checking this cycle'). At default `odd.activity.partition-period=30`, after 5 years there are ~60 past partitions to scan every 15 minutes — small constant cost but unbounded growth."
- known_performance_gaps:
  - "**No per-job parallelism — single Connection bottleneck**. The five HousekeepingJob beans run sequentially on a shared connection (HousekeepingJobManager.java:33-35). On a quiet system this is fine; on a system with a long DataEntityHousekeepingJob cascade, AlertHousekeepingJob and SearchFacetsHousekeepingJob (which are fast — single-table DELETEs) are blocked for minutes. Splitting jobs across separate connections or moving the cascade to a paginated background job would decouple the latency." — evidence: HousekeepingJobManager.java:32 (single `pgConnectionFactory.getConnection()` for the whole iteration). — severity: LOW (current production scale is tolerable; will matter at high data-entity-soft-delete throughput)
  - "**No backlog metric — invisible bloat**. No counter, no gauge, no `housekeeping.backlog{table=...}` metric exposes the number of rows awaiting deletion. An operator cannot answer 'is housekeeping keeping up?' without manual `SELECT count(*) FROM alert WHERE status IN (...) AND status_updated_at <= now() - 30 days` queries. Adding a Prometheus gauge at the start of each cycle would surface backlog growth before it becomes a 14-minute-ShedLock problem." — evidence: AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (none emit Micrometer counters or gauges). — severity: LOW
  - "**`lockAtMostFor = \"14m\"` is dangerously close to `fixedRate = 15m`** — under contention or a long DataEntityHousekeepingJob cascade, the lock can release before the cycle commits, allowing a SECOND instance to acquire the lock at minute 15 while the first is still finalising. ShedLock's contract is best-effort; this is a 'works-most-of-the-time' coordination window. A safer setting would be `lockAtMostFor` ≥ 2 × fixedRate (e.g. `30m` for a 15-min rate) to prevent overlapping cycles under any plausible cycle length." — evidence: HousekeepingJobManager.java:25-26 (`fixedRate = 15` vs `lockAtMostFor = \"14m\"`). — severity: LOW (theoretical; would manifest only with a 14m+ cascade)

## sources

- understanding ← HousekeepingTTLProperties.java:1-12 + HousekeepingJobManager.java:17-47 + AlertHousekeepingJob.java:20-48 + SearchFacetsHousekeepingJob.java:16-31 + DataEntityHousekeepingJob.java:63-129 + EmptyPartitionsHousekeepingJob.java:13-40 + ActivityEmptyPartitionsHousekeepingJob.java:9-19 + MessageEmptyPartitionsHousekeepingJob.java:12-26 + application.yml:165-170
- concepts.entities ← HousekeepingTTLProperties.java:8 + HousekeepingJobManager.java:21 + housekeeping/job/ directory listing (AlertHousekeepingJob.java, SearchFacetsHousekeepingJob.java, DataEntityHousekeepingJob.java, EmptyPartitionsHousekeepingJob.java, ActivityEmptyPartitionsHousekeepingJob.java, MessageEmptyPartitionsHousekeepingJob.java)
- concepts.operations ← HousekeepingTTLProperties.java:9-11 + HousekeepingJobManager.java:25-39 + AlertHousekeepingJob.java:24-46 + SearchFacetsHousekeepingJob.java:19-30 + DataEntityHousekeepingJob.java:68-128 + EmptyPartitionsHousekeepingJob.java:17-33
- concepts.invariants ← HousekeepingTTLProperties.java:9-11 + application.yml:165-170 + application-integration-test.yml:7-8 + HousekeepingJobManager.java:18,25-26 + EmptyPartitionsHousekeepingJob.java:21 + PartitionServiceImpl.java:133-141 + AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform (the known-bug acknowledgement)
- dependencies_semantic.requires-feature ← AlertHousekeepingJob.java:14-15 (ALERT_CHUNK + ALERT imports) + SearchFacetsHousekeepingJob.java:11 (SEARCH_FACETS import) + DataEntityHousekeepingJob.java:34 (DATA_ENTITY import) + HousekeepingJobManager.java:23 + HousekeepingJobManager.java:32
- dependencies_semantic.requires-config ← HousekeepingJobManager.java:18 + HousekeepingTTLProperties.java:9-11 + application.yml:165-170
- dependencies_semantic.requires-runtime ← HousekeepingJobManager.java:25 (@Scheduled) + HousekeepingJobManager.java:26 (@SchedulerLock — ShedLock) + DataEntityHousekeepingJob.java:71 (DSL.using(connection).transaction)
- dependencies_semantic.coupling ← ActivityTablePartitionManager.java:11 (cross-reference to partition-period axis) + DataEntityHousekeepingJob.java:131-143 (deleteFiles + LSN-001 storage default coupling)
- tests_coverage_semantic.test_files ← grep of <odd-platform-repo>/odd-platform-api/src/test/java for `Housekeeping*` returning zero matches
- tests_coverage_semantic.gaps ← reasoning anchored on test-directory absence + application.yml:166 vs application-integration-test.yml:8 (the integration profile flips OFF)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-12 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed 2026-05-12 status 200 (cross-reference for the activity-retention drift)
- docs_link_semantic.doc_drift_findings.[0] ← cross-reference to `lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md` (batch B sidecar) + HousekeepingTTLProperties.java:8-12 + AbstractPartitionManager.java + PartitionServiceImpl.java:133-141 + EmptyPartitionsHousekeepingJob.java
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch /configuration-and-deployment/odd-platform (the "three cleanup tasks" enumeration) + housekeeping/job/ directory listing (the five HousekeepingJob beans)
- docs_link_semantic.doc_drift_findings.[2] ← HousekeepingTTLProperties.java:9-11 (no Java-side defaults) + application.yml:168-170 (YAML floor)
- docs_link_semantic.doc_drift_findings.[3] ← AlertHousekeepingJob.java:28-34 + WebFetch /configuration-and-deployment/odd-platform (the docs acknowledgement)
- implicit_adrs.[0] ← HousekeepingJobManager.java:18 + EmptyPartitionsHousekeepingJob.java:13 + ActivityEmptyPartitionsHousekeepingJob.java:9 (two-package coupling pattern)
- implicit_adrs.[1] ← application.yml:167-170 (uniform 30 / 30 / 30 default triplet)
- implicit_adrs.[2] ← HousekeepingJobManager.java:18 + application.yml:165-166 (opt-out via shipped default)
- bugs_limitations_corner_cases.[0] ← HousekeepingTTLProperties.java:8-12 + AbstractPartitionManager.java:14-51 + PartitionServiceImpl.java:133-141 + (cross-reference) lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md + WebFetch /features/active-platform-features/activity-feed#configuration
- bugs_limitations_corner_cases.[1] ← HousekeepingTTLProperties.java:8-12 + MessageEmptyPartitionsHousekeepingJob.java:12-26
- bugs_limitations_corner_cases.[2] ← HousekeepingTTLProperties.java:9-11 + application.yml:168-170 (the Java vs YAML mismatch)
- bugs_limitations_corner_cases.[3] ← AlertHousekeepingJob.java:28-34 (the jOOQ predicate chain) + WebFetch /configuration-and-deployment/odd-platform (docs acknowledgement)
- bugs_limitations_corner_cases.[4] ← AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128 (all debug-level log statements)
- bugs_limitations_corner_cases.[5] ← HousekeepingJobManager.java:18 (no matchIfMissing) + application-integration-test.yml:7-8
- bugs_limitations_corner_cases.[6] ← DataEntityHousekeepingJob.java:142 (block() call) + DataEntityHousekeepingJob.java:71 (surrounding transaction) + HousekeepingJobManager.java:41-47 (the outer catch/log.error)
- security.auth_mode_relevance ← HousekeepingTTLProperties.java:6 + HousekeepingJobManager.java:18
- security.ingestion_filter_relevance ← HousekeepingJobManager.java:25 (@Scheduled, not @PostMapping)
- security.owner_scoping ← AlertHousekeepingJob.java:28-34 + DataEntityHousekeepingJob.java:268-273
- security.known_security_gaps.[0] ← HousekeepingTTLProperties.java (no audit annotations) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (debug-level log only)
- security.known_security_gaps.[1] ← HousekeepingJobManager.java:25-39 + AlertHousekeepingJob.java:40-43 + DataEntityHousekeepingJob.java:99-126
- performance.hot_paths ← HousekeepingJobManager.java:25 (fixedRate=15min) + HousekeepingJobManager.java:26 (lockAtMostFor=14m)
- performance.throughput_characteristics ← HousekeepingJobManager.java:32-35 (single Connection + sequential iteration) + DataEntityHousekeepingJob.java:71 (transaction wrap)
- performance.resource_allocation ← DataEntityHousekeepingJob.java:75-78 (list load) + lines 91-97 (id / oddrn arrays) + lines 282-296 (deleteMessages)
- performance.scaling_characteristics ← HousekeepingJobManager.java:25-26 (fixedRate vs lockAtMostFor) + PartitionServiceImpl.java:82-118 (getEmptyPastPartitions)
- performance.known_performance_gaps.[0] ← HousekeepingJobManager.java:32 (single Connection)
- performance.known_performance_gaps.[1] ← AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no Micrometer)
- performance.known_performance_gaps.[2] ← HousekeepingJobManager.java:25-26 (the lockAtMostFor / fixedRate ratio)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (test absence verified via test-directory grep — zero matches for any Housekeeping* class)
- docs_link_semantic: HIGH (two WebFetches in this session: /configuration-and-deployment/odd-platform 200, /features/active-platform-features/activity-feed 200; both quoted verbatim)
- implicit_adrs: HIGH (three decisions with explicit code evidence; the 30/30/30 default uniformity is marked MEDIUM at the decision level due to absence of a WHY-comment)
- bugs_limitations_corner_cases: HIGH (every finding cited at file:line; the activity-retention drift cross-confirmed against the parallel ActivityTablePartitionManager sidecar; the jOOQ-precedence bug confirmed against the docs acknowledgement)
- security: HIGH (auth-mode relevance and owner-scoping anchored on code; the audit-log gap and dry-run gap are absence-shaped but well-evidenced via grep)
- performance: HIGH (all observations anchored on the single-Connection + lockAtMostFor + transaction-wrap evidence chain)

## Maintainer notes

(none — net-new sidecar)

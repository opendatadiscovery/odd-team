---
node_id: "odd-platform java housekeeping job:ActivityEmptyPartitionsHousekeepingJob"
node_kind: housekeeping-job
axis: housekeeping
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: stress-complete
confidence_overall: HIGH
session_id: session-2026-05-20-VAL-LSN-019-batch-2
---

# ActivityEmptyPartitionsHousekeepingJob — semantic understanding

## understanding

`ActivityEmptyPartitionsHousekeepingJob` is a 17-line `@Component` that subclasses `EmptyPartitionsHousekeepingJob` and binds the `ACTIVITY` table as the target — it is the SOLE reaper of `public.activity` storage in the codebase. On every 15-minute cycle of `HousekeepingJobManager`, the parent class calls `PartitionService.getEmptyPastPartitions(connection, "activity", emptyList())`, which selects all `activity_YYYYMMDD_YYYYMMDD` partitions from `information_schema.tables`, filters to those whose end-date is BEFORE today (`isPartitionInPast`) AND whose row count is exactly zero (`SELECT count(*) = 0 FROM <partition>`), then issues an unconditional `DROP TABLE <partition>` per match. The job's behaviour HONORS its name — only EMPTY past partitions are dropped — but it is the only retention mechanism for `activity` rows, and its effectiveness is fully coupled to `ActivityTablePartitionManager`'s 30-day partition width: a 60-day-wide rolling partition never empties out unless an operator has stopped generating activity events for 60+ days, so on a steadily-used platform this job almost never drops anything.

## concepts

- entities: [ActivityEmptyPartitionsHousekeepingJob, EmptyPartitionsHousekeepingJob, HousekeepingJob, HousekeepingJobManager, PartitionService, PartitionServiceImpl, Tables.ACTIVITY (public.activity), ActivityTablePartitionManager]
- operations: [drop-empty-past-partition, list-partitions-by-prefix, check-partition-in-past, check-partition-empty, log-debug-on-drop, swallow-cycle-failure]
- invariants:
  - "Targets exactly one table: `Tables.ACTIVITY.getName()` = bare `activity` (the table is in `public` schema per `PartitionServiceImpl.DEFAULT_SCHEMA`)."
  - "No exclusions: `exclusions()` is not overridden, so the inherited `emptyList()` from `EmptyPartitionsHousekeepingJob.java:37-39` applies — every `activity_%` partition in `public` is a drop candidate."
  - "Empty-check is a real `SELECT count(*) = 0 FROM <partition>` query (PartitionServiceImpl.java:133-142) — the job does NOT drop partitions based on date math alone."
  - "Past-check uses `getLastPartitionDate(partitionName).isBefore(baseline)` where baseline = `DateTimeUtil.generateNow().toLocalDate()` (PartitionServiceImpl.java:86, 129-131); a partition is 'past' only when its END-DATE-encoded portion of the name is strictly before today's local date."
  - "Drop SQL is `DROP TABLE <partition>` with NO `IF EXISTS` (PartitionServiceImpl.java:122) — a partition that vanished between the empty-check and the drop will raise SQLException; the parent class wraps and rethrows as `RuntimeException` (EmptyPartitionsHousekeepingJob.java:30-32); `HousekeepingJobManager.runHousekeepingJob` catches `Exception` and logs ERROR (HousekeepingJobManager.java:42-46), so the cycle continues."
  - "No `@Transactional` and no JOOQ `transaction(...)` wrapper — runs against raw `java.sql.Connection` from `PGConnectionFactory` shared across all 5 housekeeping jobs (HousekeepingJobManager.java:32-35). PostgreSQL `DROP TABLE` is auto-commit per statement on a non-transactional connection."
- audiences:
  - "ODD Platform operators running long-lived (multi-year) deployments who need to understand why the `activity` table can grow monotonically even with this 'housekeeping' job present."
  - "DBAs sizing PostgreSQL storage for the activity audit trail."
  - "Maintainers debugging 'why isn't activity housekeeping reclaiming space?' — answer: partitions don't reach zero rows under any sustained-use workload."

## dependencies_semantic

- requires-feature:
  - "`PartitionService` (PartitionServiceImpl) — exposes `getEmptyPastPartitions` (the past + empty filter) and `dropPartition` (the raw `DROP TABLE`). Injected via the parent class constructor at EmptyPartitionsHousekeepingJob.java:14."
  - "`EmptyPartitionsHousekeepingJob` abstract base — provides the `doHousekeeping` template method that iterates `getEmptyPastPartitions` results and calls `dropPartition` per match (EmptyPartitionsHousekeepingJob.java:16-33)."
  - "`HousekeepingJobManager` orchestrator — discovers this bean via the `List<HousekeepingJob>` constructor injection (HousekeepingJobManager.java:23) alongside AlertHousekeepingJob, SearchFacetsHousekeepingJob, DataEntityHousekeepingJob, MessageEmptyPartitionsHousekeepingJob; fires the cycle every 15 minutes."
  - "`ActivityTablePartitionManager` (sibling, in `partition.manager` package) — CREATES the `activity_YYYYMMDD_YYYYMMDD` partitions this job drops. Without that creator running, this dropper has no input."
- requires-config:
  - "`housekeeping.enabled` (default `true` in application.yml:166; NO `matchIfMissing` on the orchestrator) — gates `HousekeepingJobManager` registration; with the bean absent, this job is created (it has no `@ConditionalOn*`) but never invoked because no orchestrator iterates it."
  - "`odd.activity.partition-period` (default `30` per application.yml:213 + ActivityTablePartitionManager.java:11) — sets the WIDTH (`2 × period` = 60 days) of each activity partition; THE FUNCTIONAL COUPLING to this job: partitions only empty out if a 60-day-wide window contains zero rows."
  - "NO TTL config key — `HousekeepingTTLProperties` (the `housekeeping.ttl` `@ConfigurationProperties`) carries `resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays` (3 keys at HousekeepingTTLProperties.java:9-11). There is NO `activityDays` / `activityRetentionDays` key. Activity retention is implicit through partition lifecycle — operators cannot set 'keep activity for N days' via configuration; they can only set partition WIDTH and wait for partitions to empty out (which requires no writes to that partition range)."
- requires-runtime:
  - "PostgreSQL with declarative partitioning (Postgres 10+; ODD ships migrations targeting 13+)."
  - "Spring Boot scheduling subsystem + ShedLock — provided by `HousekeepingJobManager.@Scheduled` + `@SchedulerLock` (HousekeepingJobManager.java:25-26)."
  - "`PGConnectionFactory` connection — bypasses HikariCP per the manager's `try (Connection ...) = pgConnectionFactory.getConnection()` at HousekeepingJobManager.java:32."
- coupling:
  - "Sibling `MessageEmptyPartitionsHousekeepingJob` (same `housekeeping/job` package) — both extend the same abstract base; Message variant ALSO overrides `exclusions()` to keep `MESSAGE_PROVIDER_EVENT` from being targeted (MessageEmptyPartitionsHousekeepingJob.java:22-25). Activity variant has NO such exclusions — every `activity_%`-named table in `public` is in scope."
  - "Naming-format coupling with `PartitionServiceImpl.getLastPartitionDate` — partition names MUST be exactly `<table>_YYYYMMDD_YYYYMMDD` (3 underscore parts). If `ActivityTablePartitionManager` ever renames partitions or this job's target table contains a `LIKE 'activity_%'` match that violates the format (e.g. a manual `activity_archive_old`), this job's parent will raise `IllegalArgumentException(\"Cannot parse table name\")` (PartitionServiceImpl.java:75) when checking `isPartitionInPast`."
  - "Cross-pillar coupling with `ActivityTablePartitionManager` (the creator) — the two beans NEVER share a transaction or a connection; the partition manager runs nightly at `00:01` cron, this job runs every 15 minutes. A partition created at 00:01 cannot be eligible for drop until its end-date is past — earliest at 00:01 + 60 days (the 2×period width)."
  - "Cross-pillar coupling to F-010 (`P-08:F-002` Housekeeping TTL Enforcement, pillar `P-08` Housekeeping) — F-010 already enumerates this job as the 4th of 5 housekeeping jobs; this sidecar PRIMARY-SOURCES that enumeration entry."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Job is registered as a Spring `@Component` (`@Component` at line 8) and is picked up by `HousekeepingJobManager`'s `List<HousekeepingJob>` injection at HousekeepingJobManager.java:23."
  - "On a partition that is PAST but NOT empty, the job correctly does NOT drop it (the `isPartitionEmpty` AND condition at PartitionServiceImpl.java:110)."
  - "On a partition that is EMPTY but NOT past, the job correctly does NOT drop it (the `isPartitionInPast` AND condition at PartitionServiceImpl.java:110)."
  - "On a partition that is BOTH past AND empty, the job drops it (PartitionServiceImpl.java:111)."
  - "On a partition that was empty at the `isPartitionEmpty` check but a concurrent INSERT lands BEFORE the `DROP TABLE` (the race), Postgres behaviour: `DROP TABLE` acquires `ACCESS EXCLUSIVE` lock; if a concurrent INSERT is in flight, the DROP waits behind it OR vice-versa depending on lock-arrival order — when DROP wins the race, the in-flight INSERT (which holds `RowExclusiveLock` on a partition that's about to vanish) errors with `relation \"activity_YYYYMMDD_YYYYMMDD\" does not exist` (since `DROP TABLE` invalidates the snapshot). NO TEST EXISTS for this race. See P-011."
  - "On a partition that was dropped by another process between the empty check and the drop, `DROP TABLE` (no `IF EXISTS`) raises `SQLException`; the parent class wraps as `RuntimeException`; the manager logs ERROR and continues. The other jobs in the same cycle continue to run."
  - "Behaviour when `housekeeping.enabled=false` — bean is still created (this class has no conditional) but the manager isn't, so `doHousekeeping` is never invoked. Verifying this orchestration absence is not currently tested."
- test_files: []
- gaps: |
    Zero test coverage. `grep -rln 'ActivityEmptyPartitionsHousekeepingJob\|EmptyPartitionsHousekeepingJob'
    <odd-platform-repo>/odd-platform-api/src/test` returns ZERO matches. The job is structurally
    trivial (override one method), but its EFFECTS are durability-critical and one
    of the few partition-DROP code paths in the platform.

    Likeliest regression sites:

    1. **`Tables.ACTIVITY.getName()` rename** — if the generated jOOQ table name
       were ever renamed (migration touching the underlying table) the override
       at line 16 would still compile but would target a different table; the
       past+empty filter would silently match nothing for `activity_%` and the
       new name would have no reaper. NO test would catch this rename.

    2. **`exclusions()` re-introduction** — the abstract base provides an empty
       default; this class does NOT override. A future maintainer adding
       activity-side related tables (e.g. an `activity_snapshot` archive table)
       could legitimately need an exclusion, but `LIKE 'activity_%'` already
       matches `activity_snapshot` — the entire archive table would become a
       drop candidate (empty + past → DROPPED on next 15-min cycle). NO test
       pins the no-exclusion contract.

    3. **Connection sharing semantics with HousekeepingJobManager** — the parent
       class operates on a `Connection` passed in; the manager opens ONE
       connection for all 5 jobs. If a prior job (e.g. DataEntityHousekeepingJob)
       left the connection in a bad state (uncommitted transaction holding
       row-locks on `activity` rows), this DDL job's `DROP TABLE` waits on
       that lock. NO INTEGRATION TEST exercises the 5-job sequential
       choreography.

    4. **The race window between `isPartitionEmpty` check and `DROP TABLE`** —
       the SELECT runs in one PreparedStatement, the DROP in a separate
       statement on the same Connection; no exclusive lock is held across
       them. A concurrent `INSERT INTO activity` landing in the in-between
       window finds the partition still exists (insert succeeds), then the
       DROP fires and the just-inserted row is GONE without any compensating
       transaction. See P-012.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "(none — page enumerates `housekeeping.ttl.*` keys but omits the two empty-partition jobs entirely)"
    rationale: "Canonical operator-facing configuration reference; documents the housekeeping subsystem at the level the operator interacts with."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-20):
      - "ODD Platform runs a background housekeeping job that permanently deletes stale data on a schedule. The job fires every 15 minutes."
      - "[the housekeeping job] operates across three cleanup tasks: resolved alerts, search-facet history, and soft-deleted data entities."
      - The page documents EXACTLY THREE `housekeeping.ttl.*` keys: `resolved_alerts_days`, `search_facets_days`, `data_entity_delete_days`.
      - The page documents `odd.activity.partition-period` separately under "Platform-level settings (`odd.*`)" — "The ODD Platform `activity` table is range-partitioned on a rolling date window; `odd.activity.partition-period` sets the partition width in days."

      Verbatim ABSENCES (confirmed by direct WebFetch):
      - The page DOES NOT mention `ActivityEmptyPartitionsHousekeepingJob`.
      - The page DOES NOT mention `MessageEmptyPartitionsHousekeepingJob`.
      - The page DOES NOT mention empty-partition cleanup or DROP procedures.
      - The page DOES NOT mention activity-table retention semantics.
      - The page DOES NOT enumerate 5 housekeeping jobs — it enumerates "three cleanup tasks" only.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "#configuration"
    rationale: "Feature-side cross-reference — the Activity Feed page's Configuration section points operators to the activity-partitioning key; this page was verified at status 200 from the ActivityTablePartitionManager sidecar (2026-05-10) and uses the misleading phrase 'retention and partitioning are controlled by `odd.activity.partition-period`'."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Inherited from sibling sidecar at
      `lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md`
      (verified 2026-05-10):
      - "Activity-feed retention and partitioning are controlled by the platform-level setting `odd.activity.partition-period` on Configure ODD Platform."
- doc_drift_findings:
  - "**Docs say 'three cleanup tasks', code runs FIVE jobs**: the live `/configuration-and-deployment/odd-platform` page says 'The job fires every 15 minutes' and enumerates 'three cleanup tasks' — but `HousekeepingJobManager`'s `List<HousekeepingJob>` injection at HousekeepingJobManager.java:23 picks up FIVE @Component beans, including this `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` whose existence is entirely absent from the docs. F-010 already tracks this as drift_class `docs_three_vs_code_five_job_count` (PRIMARY-SOURCED from HousekeepingJobManager sidecar batch K). This sidecar adds confirmation from the activity-side: the activity empty-partitions job exists, runs in the cycle, and is invisible to operators reading the canonical config page."
  - "**Activity-feed docs frame `odd.activity.partition-period` as controlling retention; reality is that this job + partition manager BOTH must agree to reclaim space**: the Activity Feed Configuration section (`/features/active-platform-features/activity-feed#configuration`) tells operators the setting controls 'retention AND partitioning'. The combined truth: (a) `ActivityTablePartitionManager` creates 60-day-wide partitions every 30 days; (b) this job drops a partition ONLY when it's both past-end-date AND empty (`SELECT count(*) = 0 FROM <partition>`). On a deployment that continuously generates activity events, partitions are NEVER empty by the time they're past — they may sit in the table indefinitely. The retention-via-emptiness model is not surfaced anywhere in the docs."
  - "**No `housekeeping.ttl.activity_days` exists; operators have no knob to bound activity retention by time**: HousekeepingTTLProperties.java:9-11 has only `resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays`. F-010 already tracks this as `cross_pillar_activity_retention_to_p_07`; this sidecar pins it at the consumer of activity retention (this job). An operator wanting 'keep activity for 90 days' has no time-based mechanism — only the partition lifecycle, which is volume-coupled, not time-coupled."

## implicit_adrs

- "**Symmetric naming pattern**: every concrete `EmptyPartitionsHousekeepingJob` subclass is named `<Table>EmptyPartitionsHousekeepingJob` and overrides ONE method (`getTargetTable`) plus optionally `exclusions()`. This class and `MessageEmptyPartitionsHousekeepingJob` (housekeeping/job/MessageEmptyPartitionsHousekeepingJob.java) apply the convention consistently — adding a new partitioned table requires only a 17-line subclass, no orchestrator change." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:9-17 + MessageEmptyPartitionsHousekeepingJob.java:12-25 + EmptyPartitionsHousekeepingJob.java:35-39. — intent_anchor: "the abstract base method `protected abstract String getTargetTable()` (EmptyPartitionsHousekeepingJob.java:35) + `protected List<String> exclusions() { return emptyList(); }` (EmptyPartitionsHousekeepingJob.java:37-39) — the two extension points are DELIBERATELY narrow; the convention is applied across both concrete subclasses." — confidence: HIGH

- "**Empty-only contract preserved by template method**: the abstract parent class does NOT expose a 'drop by date' or 'drop all past' API; the only exported behaviour is 'past AND empty'. Concrete subclasses cannot bypass the empty-check because they only inject the target-table name. The 'empty partitions' promise in the class name is structurally enforced — a subclass cannot legitimately drop a non-empty partition without rewriting the base." — evidence: EmptyPartitionsHousekeepingJob.java:21-22 (`partitionService.getEmptyPastPartitions`) + PartitionServiceImpl.java:109-112 (the `isPartitionInPast && isPartitionEmpty` AND). — intent_anchor: "the AND condition `isPartitionInPast(partitionName, baseline) && isPartitionEmpty(connection, partitionName)` in `getEmptyPastPartitions` (PartitionServiceImpl.java:110) — both predicates must hold; the structural design forces the empty check rather than relying on convention." — confidence: HIGH

## bugs_limitations_corner_cases

- "**Functionally a near-no-op on steadily-used platforms** — every `activity_%` partition spans `2 × odd.activity.partition-period = 60 days` (per AbstractPartitionManager.java:35 from the sibling sidecar). For this job to drop ANYTHING, the deployment must have produced ZERO activity events across a 60-day window AND that window must already be in the past. On a platform with daily activity, NO partition ever empties out; the job runs every 15 minutes (96×/day, 35K×/year), scans `information_schema.tables` and runs `SELECT count(*) = 0` per past partition, and reaps nothing. The combined effect with the no-drop-path in `ActivityTablePartitionManager` is **monotonic growth of the `activity` table on any non-dormant platform**." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:14-17 (binds to `ACTIVITY`) + EmptyPartitionsHousekeepingJob.java:21-22 (delegates to `getEmptyPastPartitions`) + PartitionServiceImpl.java:82-118 (the past+empty filter) + sibling sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md` `bugs_limitations_corner_cases.[0]` (monotonic growth — corroborated by repo-tier `ReactiveActivityRepositoryImpl` sidecar batch R showing zero `deleteFrom(ACTIVITY)` calls). — severity: HIGH (silent-data-growth class; LSN-001 shape on activity audit trail).

- "**Race window between empty-check and DROP TABLE** — `getEmptyPastPartitions` runs two SQL statements: the `SELECT count(*) = 0` (PartitionServiceImpl.java:134) followed by the `DROP TABLE` (PartitionServiceImpl.java:122). They are NOT in a transaction (the parent class `EmptyPartitionsHousekeepingJob.doHousekeeping` does not wrap in JOOQ's `DSL.using(connection).transaction(...)` unlike `AlertHousekeepingJob` and `DataEntityHousekeepingJob`). A concurrent `INSERT INTO activity` that lands AFTER the count-zero check but BEFORE the `DROP TABLE` acquires `ACCESS EXCLUSIVE` — Postgres will queue one behind the other on the partition's lock, but ONE will win: if INSERT wins, it succeeds, then DROP TABLE proceeds to drop a now-non-empty table SILENTLY (no recheck), deleting the just-inserted row. The row's caller never sees an error (INSERT returned success), but the row is gone. The job's name promises 'empty partitions' but the actual behaviour drops what was empty 'recently'." — evidence: PartitionServiceImpl.java:108-117 (the two-statement non-transactional pattern) + EmptyPartitionsHousekeepingJob.java:16-33 (no transaction wrapper, contrast with AlertHousekeepingJob.java:25 `transaction(...)`). — severity: HIGH (silent data loss; see P-012 probe).

- "**`DROP TABLE` has no `IF EXISTS`** — PartitionServiceImpl.java:122 (`DROP TABLE %s`). If two instances of the platform raced past ShedLock (e.g. `lockAtLeastFor=14m` releases before a slow cycle completes and the 15m schedule fires another instance — see F-010 facet `shedlock_window_dangerously_close_to_schedule`) and both observed the same empty partition, the second to issue `DROP TABLE` raises `SQLException: relation \"activity_YYYYMMDD_YYYYMMDD\" does not exist`. The parent class wraps as `RuntimeException` (EmptyPartitionsHousekeepingJob.java:31) and the manager logs ERROR. The cycle's remaining jobs continue — but on a tight ShedLock window the same race produces log noise on every 15-minute interval where a cycle straddles the boundary." — evidence: PartitionServiceImpl.java:121-127 + EmptyPartitionsHousekeepingJob.java:30-32 + HousekeepingJobManager.java:25-26 (the 14m/15m window) + F-010 drift_class `shedlock_window_dangerously_close_to_schedule`. — severity: MEDIUM

- "**`LIKE 'activity_%'` matches more than partition tables** — `PartitionServiceImpl.getEmptyPastPartitions` runs `WHERE table_schema = 'public' AND table_name LIKE 'activity_%'` (PartitionServiceImpl.java:90-91, parameterised at line 100). The pattern matches ANY table name starting with `activity_`, including a hypothetical manually-created `activity_archive`, `activity_export`, etc. If such a table is empty AND its name has exactly 3 underscore-separated parts (e.g. `activity_archive_v1`), the `getLastPartitionDate` parser at PartitionServiceImpl.java:72-80 will attempt to parse `v1` as a date — raising `DateTimeParseException` wrapped to crash the cycle. If the name has the right shape AND happens to encode a past date (e.g. `activity_old_20200101`), the parser succeeds and the table is DROPPED. NO exclusion is set on this job — `exclusions()` is not overridden." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:9-17 (no `exclusions()` override) + EmptyPartitionsHousekeepingJob.java:37-39 (default empty exclusions) + PartitionServiceImpl.java:73-80 (the brittle name parser) + sibling MessageEmptyPartitionsHousekeepingJob.java:22-25 (the Message variant DID add an exclusion for `MESSAGE_PROVIDER_EVENT`). — severity: LOW (requires manual operator action to trigger; but the pattern is fragile by design)

- "**No metric / observability** — the job emits `log.debug` lines (`Dropping {} partition`, `Dropped {} partitions for table {}` at EmptyPartitionsHousekeepingJob.java:25,29) only at DEBUG level (not enabled by default per `org.opendatadiscovery.oddplatform.housekeeping: info` in application.yml:254). An operator monitoring activity-table size has no Prometheus counter (`housekeeping_partitions_dropped_total{table=...}`), no last-drop-timestamp gauge, no eligible-partitions count. The only way to determine if this job ever drops anything is to enable DEBUG logging or to manually `\\dt+ activity_*` against Postgres." — evidence: EmptyPartitionsHousekeepingJob.java:25, 29 (log.debug) + application.yml:254 (`housekeeping: info` — debug suppressed by default) + grep partition + housekeeping packages for `MeterRegistry|Counter|Timer|Gauge` returns zero matches. — severity: MEDIUM

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "This is a `@Component` scheduled job, not an HTTP endpoint. The four auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) do not gate this code. The job runs whenever `housekeeping.enabled=true` regardless of `auth.type`." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:8 (`@Component`, no `@RestController`, no `@Conditional` on `auth.type`) + HousekeepingJobManager.java:17-18 (the orchestrator is gated by `housekeeping.enabled` only).
- ingestion_filter_relevance: "N/A — not HTTP. The job runs in Spring's scheduling thread pool via `HousekeepingJobManager.@Scheduled`; it never sees a request body, an `Authentication`, or the `IngestionDataEntitiesFilter`."
- authorization_assertions: []
- owner_scoping: "N/A — schema-level DDL (DROP TABLE). The `activity` table is system-wide; there is no per-Owner partitioning. The job operates above the ownership model."
- data_exposure:
  - "Partition existence reads from `information_schema.tables` — visible to any DB role with `SELECT` on system catalogs. Not user-facing."
- known_security_gaps:
  - "**DDL privilege requirement is undocumented**: this job requires `DROP TABLE` privilege on `public.activity_*` partition tables — equivalently, ownership of the parent `activity` table or `superuser` (Postgres requires the owner-or-superuser invariant for `DROP TABLE`). Combined with `ActivityTablePartitionManager`'s CREATE requirement (PartitionServiceImpl.java:55-66), the application's DB role must hold BOTH CREATE TABLE on `public` AND `DROP TABLE` on every partition it creates. The canonical config docs page does not enumerate this privilege requirement — operators running ODD against a managed Postgres (e.g. RDS) with a least-privileged role discover the gap only when partition lifecycle silently fails." — evidence: PartitionServiceImpl.java:121-127 (the `DROP TABLE` DDL) + WebFetch /configuration-and-deployment/odd-platform 2026-05-20 (no DB-privilege section). — severity: MEDIUM
  - "**No audit log of partition DROP** — unlike data-mutation paths covered by `@ActivityLog`, this job's `DROP TABLE` against the audit-trail table itself emits ONLY `log.debug` (EmptyPartitionsHousekeepingJob.java:25) at default-suppressed level. A compliance-aware deployment (SOX, GDPR records-of-processing) has no audit trail of WHICH partition was dropped WHEN — the very audit trail being managed has its own management actions invisible to audit." — evidence: EmptyPartitionsHousekeepingJob.java:25 (log.debug only) + grep `@ActivityLog\|AuditEvent\|tamperEvident` in `housekeeping` and `partition` packages (zero matches, observed pattern). — severity: MEDIUM (compliance shape; LSN-001-sibling observation)

## performance

- hot_paths:
  - "Per 15-minute cycle: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'activity_%'` — returns N rows where N = active partition count. For a deployment running 5 years with default `partition-period=30`, N ≈ 61 partitions (one new every 30 days). Each row triggers the per-partition empty-check `SELECT count(*) = 0 FROM <partition>` — that count is a SEQUENTIAL SCAN of the partition (no count-table-rows-via-pg_class shortcut; the SELECT touches data). For a 60-day-wide partition with 10M events/day = 600M rows, a sequential count costs gigabytes of I/O per partition per cycle — 96 cycles/day × 600M-row scan per partition = catastrophic if applied to non-empty partitions. **In practice**: Postgres can short-circuit `SELECT count(*) = 0` if the planner determines emptiness early, BUT there is no `LIMIT 1` hint and the predicate is `count(*) = 0`, not `EXISTS(SELECT 1 FROM ...)`. NO PROBE EXISTS to measure the actual I/O cost on a populated partition." — evidence: PartitionServiceImpl.java:89-105 (the partition list query) + PartitionServiceImpl.java:133-142 (the `count(*) = 0` predicate). See P-013.
- throughput_characteristics:
  - "Single-shot per cycle — no batching, no streaming. Each partition's empty-check + drop is a separate statement; no parallelism (the parent class's for-loop is sequential)."
  - "Synchronous JDBC — runs on the orchestrator's connection, sequential within the cycle. The 5-job cycle blocks on slow jobs (per F-010 `shared_connection_slowest_job_blocks_cycle` finding)."
- resource_allocation:
  - "**`SELECT count(*) FROM <partition>` reads every visible tuple in the partition** — Postgres has no fast `count(*)` shortcut for partitioned tables; the planner uses sequential scan unless an index-only scan applies (rare for `count(*)` without WHERE). For a NON-empty partition, this counts millions of rows per 15-minute cycle — even though the count is then compared to 0 and the partition is NOT dropped. This is the primary hidden cost of this job on busy deployments. NO PROBE EXISTS for the I/O cost (see P-013)."
  - "`DROP TABLE` acquires `ACCESS EXCLUSIVE` lock on the parent `activity` table briefly (Postgres 12+ optimisation for partition drop is mostly metadata-only, BUT the lock is still required) — blocks concurrent INSERTs to OTHER partitions of the same parent for the lock duration."
- scaling_characteristics:
  - "Runs on the ShedLock-elected leader instance only (one execution per 15-min cycle across the cluster). The 14m/14m window pairing with 15m schedule is the F-010 `shedlock_window_dangerously_close_to_schedule` finding — applies equally here (a long count-scan on a populated partition extends the cycle and risks racing the next schedule)."
  - "No pagination of the partition list — processes ALL past partitions per cycle. Deployments with partition_period=1 (1-day periods, 2-day-wide windows) accumulate 365 past partitions/year — the linear scan grows."
- known_performance_gaps:
  - "**`SELECT count(*) = 0` is an unindexed sequential scan on every past partition** — measure this on a populated activity partition with 10M+ rows; if the cost is multi-second per partition × 60+ partitions × 96 cycles/day, this is a significant hidden DB load on multi-year deployments. The fix would be `WHERE NOT EXISTS (SELECT 1 FROM <partition> LIMIT 1)` which short-circuits on first row. — evidence: PartitionServiceImpl.java:134 (`SELECT count(*) = 0 FROM %s`) + no `LIMIT` + no `EXISTS` rewrite. See P-013. — severity: MEDIUM (only material on populated activity partitions, but those are exactly the deployments where this matters)"
  - "**Job runs even on deployments that disabled activity ingestion entirely** — there is no `@ConditionalOn*` on this class (line 8: `@Component` only); if a deployment turned off activity entirely (no events generated), the partition list is still scanned every 15 minutes producing log noise and DB load proportional to existing partition count. — evidence: ActivityEmptyPartitionsHousekeepingJob.java:8 (no conditional). — severity: LOW"
  - "**No metric on time-spent-in-job** — operators cannot answer 'is this job spending 10ms or 10s per cycle?' without DEBUG logging on the housekeeping package. — evidence: EmptyPartitionsHousekeepingJob.java:16-33 (no Micrometer Timer wrapping). — severity: LOW"

## stress_findings

### Category A — Tunables (boundaries)

- **Trigger**: `odd.activity.partition-period` (default `30`, integer days) — consumed by sibling `ActivityTablePartitionManager`, but the value FUNCTIONALLY COUPLES with this job's behaviour because it determines partition width.
  - **Q-A.1**: What does this job DO at `partition-period=0`?
    - **Answer**: STATIC-INFERRED. The sibling `AbstractPartitionManager.createPartitionsIfNotExists` (AbstractPartitionManager.java:30, 33-37) computes `bufferDate = baseline.plusDays(0) = baseline`; the while-loop `while (lastPartitionDate.isBefore(bufferDate))` evaluates `baseline.isBefore(baseline) = false` — NO partition is created. With no `activity_%` partitions present, this job's `LIKE 'activity_%'` query (PartitionServiceImpl.java:90-91) returns empty result set; the inner for-loop (EmptyPartitionsHousekeepingJob.java:24-27) does not execute; the job is a no-op and logs `Dropped 0 partitions for table activity` at DEBUG. Concurrently any `INSERT INTO activity` would fail with `no partition of relation \"activity\" found for row`. — confidence: STATIC-INFERRED — evidence: AbstractPartitionManager.java:30,33-37 + PartitionServiceImpl.java:89-105.
  - **Q-A.2**: What does this job DO at `partition-period=-1` (negative)?
    - **Answer**: STATIC-INFERRED. The sibling partition manager would attempt `new TablePartition(lastPartitionDate, lastPartitionDate.plusDays(-2))` — `endDate < beginDate`. Postgres rejects `CREATE TABLE ... PARTITION OF activity FOR VALUES FROM (...) TO (<earlier-date>)` with `empty range specified for partition`. The CREATE fails, the orchestrator's try/catch logs ERROR and continues; this job runs and finds no partitions to drop (same as Q-A.1). — confidence: STATIC-INFERRED.
  - **Q-A.3**: What does this job DO at very large `partition-period=10000` (effectively no partitioning)?
    - **Answer**: STATIC-INFERRED. Sibling manager creates ONE partition spanning 20000 days (~54 years) starting at the baseline date. This job's past-check `isPartitionInPast` (PartitionServiceImpl.java:129-131) compares the partition's END-date encoded portion of the name against today; the only partition's end-date is 20000 days in the FUTURE — `isBefore(baseline)` returns false — the job NEVER drops the partition. Effectively a single permanent partition that this job never touches. — confidence: STATIC-INFERRED.
  - **Q-A.4**: What does this job DO when the `activity` table has 1000 past partitions accumulated?
    - **Answer**: PROBE-NEEDED. The empty-check loop runs `SELECT count(*) = 0` per past partition — 1000 sequential scans per 15-min cycle. The per-partition cost depends on partition size; even small partitions (~10K rows) at 1000-partition fan-out is 10M-row scan per cycle. **emitting P-013** to measure actual I/O cost on a populated multi-partition activity table.
  - **Q-A.5**: What does this job DO at `housekeeping.enabled=false`?
    - **Answer**: STATIC-INFERRED. `HousekeepingJobManager`'s `@ConditionalOnProperty("housekeeping.enabled", havingValue="true")` (HousekeepingJobManager.java:18) prevents the orchestrator bean from registering. This class's `@Component` (line 8) still registers — but no caller invokes `doHousekeeping`. Effectively dormant. — confidence: STATIC-INFERRED.
  - **Q-A.6**: What does this job DO at `housekeeping.enabled` UNSET (key absent from resolved config)?
    - **Answer**: STATIC-INFERRED. NO `matchIfMissing` on the orchestrator's conditional (HousekeepingJobManager.java:18); Spring evaluates the property as missing → conditional fails → orchestrator absent. Same effective outcome as Q-A.5 — dormant, silent. F-010 already tracks this as drift_class `strict_opt_in_vs_default_true_framing`. — confidence: STATIC-INFERRED.
  - **Q-A.7**: What does this job DO when there is NO `housekeeping.ttl.activity_days` config (it doesn't exist)?
    - **Answer**: STATIC-INFERRED. The class uses NO `HousekeepingTTLProperties` field — it doesn't read any `ttl` key. Activity retention is implicit via partition lifecycle, NOT via TTL config. Adding a `ttl.activity_days` to YAML would have no effect on this job. F-010 drift_class `cross_pillar_activity_retention_to_p_07` already tracks the asymmetry (3 TTL keys for 3 row-delete jobs + 0 TTL keys for 2 partition-drop jobs). — confidence: STATIC-INFERRED — evidence: ActivityEmptyPartitionsHousekeepingJob.java:1-17 (no `HousekeepingTTLProperties` import) + HousekeepingTTLProperties.java:6-11 (only 3 fields).

### Category B — Name-behavior pairs (THE CRITICAL ONE per LSN-019)

- **Trigger**: class name `ActivityEmptyPartitionsHousekeepingJob` promises **deletion only of EMPTY partitions** of the `activity` table. The orchestrator F-010 promises 'housekeeping cycle that purges stale data'. These are operator-trust-load-bearing names.
  - **Q-B.1**: Does the implementation actually verify a partition is empty before dropping it, or does it drop partitions older than TTL regardless?
    - **Answer**: STATIC-INFERRED — **the name HONORS the behaviour**. Trace: `doHousekeeping` (EmptyPartitionsHousekeepingJob.java:16-33) → `partitionService.getEmptyPastPartitions(connection, "activity", emptyList())` (line 21) → `PartitionServiceImpl.getEmptyPastPartitions` (PartitionServiceImpl.java:82-118) returns `partitionName` only when `isPartitionInPast(partitionName, baseline) && isPartitionEmpty(connection, partitionName)` (line 110). `isPartitionEmpty` (lines 133-142) runs **`SELECT count(*) = 0 FROM <partition>`** — a REAL empty check, not a date-only heuristic. The job DOES NOT drop populated partitions. Operator trust verdict: **name matches behaviour** at the centre. — confidence: STATIC-INFERRED — evidence: PartitionServiceImpl.java:110, 133-142.
  - **Q-B.2**: At the BOUNDARY — does the empty-check actually hold across the time between SELECT and DROP?
    - **Answer**: PROBE-NEEDED. The empty-check + drop are TWO separate PreparedStatements on the same Connection (PartitionServiceImpl.java:98-117 + 121-127), NOT wrapped in a transaction, NOT holding any pre-emptive lock. A concurrent `INSERT INTO activity` landing AFTER the count-zero check but BEFORE `DROP TABLE` acquires `ACCESS EXCLUSIVE` lock — Postgres queues them; whichever the lock arbiter selects wins. If INSERT wins, the row is inserted, then DROP TABLE proceeds (without recheck) and the row is GONE — **silently violating the 'empty partitions only' promise**. The class name's centre-meaning is preserved (the check did fire), but the boundary behaviour drifts (the partition was empty when checked, NOT empty when dropped). **emitting P-012** to verify the race window experimentally.
  - **Q-B.3**: The 'Activity housekeeping' framing — does this job actually achieve retention bounding for the activity table?
    - **Answer**: STATIC-INFERRED — **no, the framing drifts**. On any steadily-used platform, partitions stay non-empty for 60+ days (the 2×period width); this job never drops them. The only path to bounded activity retention is the OPERATOR manually issuing `DROP TABLE activity_YYYYMMDD_YYYYMMDD`. The class name says 'housekeeping' but the EFFECTIVE retention enforcement on a busy deployment is zero. The promise at the F-010 feature level is even stronger drift: 'housekeeping cycle that purges stale data' is interpreted by operators as 'time-based retention' — but for activity, retention is volume-conditional (only-if-empty). — confidence: STATIC-INFERRED — evidence: ActivityEmptyPartitionsHousekeepingJob.java:14-17 + PartitionServiceImpl.java:110 (empty check is mandatory) + WebFetch /features/active-platform-features/activity-feed#configuration ('retention and partitioning are controlled by `odd.activity.partition-period`' — misleading).
  - **Q-B.4**: 'EmptyPartitions**Housekeeping**Job' — does it run on the same cadence as the OTHER housekeeping jobs?
    - **Answer**: STATIC-INFERRED — yes, all 5 housekeeping jobs share the same orchestrator cadence (15m fixedRate + 14m/14m ShedLock window). But the CREATION counterpart (`ActivityTablePartitionManager`) runs nightly at `00:01` cron (PostgreSQLPartitionCreationJob.java:40) — DIFFERENT cadence, DIFFERENT lock pattern. The two halves of the activity partition lifecycle are scheduled by two unrelated mechanisms. F-010 tracks this as separate concerns; recording here as cross-batch coherence. — confidence: STATIC-INFERRED.

### Category C — Orderings / pagination / aggregation

- **Trigger**: this job processes a list of partitions per cycle.
  - **Q-C.1**: What is the ordering of partition processing?
    - **Answer**: STATIC-INFERRED. The query at PartitionServiceImpl.java:89-92 carries NO `ORDER BY` — Postgres natural order applies (typically physical-storage order of `information_schema.tables`, NOT date order). The for-loop in `EmptyPartitionsHousekeepingJob.java:24` processes partitions in that natural order. **No tie-break, no deterministic ordering**. For empty-only drops the order is operationally irrelevant (each is independent), BUT in a failure scenario where the first DROP raises an exception, partitions are dropped in non-deterministic order — partial completion of the cycle is undefined. — confidence: STATIC-INFERRED — evidence: PartitionServiceImpl.java:89-92 (no ORDER BY) + EmptyPartitionsHousekeepingJob.java:24-27 (sequential for-loop).
  - **Q-C.2**: Is there pagination?
    - **Answer**: STATIC-INFERRED — NO. Every past partition is scanned in one cycle; no `LIMIT`, no `OFFSET`, no continuation token. Acceptable when partition count is small (60-120); pathological when count grows large (>1000) — and there's no governor. — confidence: STATIC-INFERRED.

### Category D — Authorization gates

- **Trigger**: every controller endpoint, `@PreAuthorize`, programmatic auth check.
  - **Q-D.1**: What does this code return to each of the 4 auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)?
    - **Answer**: N/A — REFERENCE to `auth_mode_relevance: INTERNAL_ONLY`. This is a `@Component` scheduled job, NOT on the HTTP surface. The four auth modes never gate it. The job runs in Spring's scheduling thread whenever `housekeeping.enabled=true`, regardless of `auth.type`. Auth gates do not apply.
  - **Q-D.2**: Where does the gate live (controller / service / repository / nowhere)?
    - **Answer**: STATIC-INFERRED — **nowhere on the auth axis**. The gate is on `housekeeping.enabled=true` (HousekeepingJobManager.java:18); after that, the job runs as system with `ACCESS EXCLUSIVE` on `activity_*` partition tables. No per-user, per-Owner, or per-tenant scoping. — confidence: STATIC-INFERRED — evidence: HousekeepingJobManager.java:17-21 + ActivityEmptyPartitionsHousekeepingJob.java:8.

### Category E — Resource boundaries (THE BIG ONE per orchestrator prompt)

- **Trigger**: `@Transactional` / `synchronized` / cache / `ON CONFLICT` / `@Async` / partition-DROP DDL — ALL load-bearing in a job that touches partition lifecycle.
  - **Q-E.1**: Can two simultaneous calls produce corrupted state? — multi-instance race
    - **Answer**: STATIC-INFERRED. The orchestrator's `@SchedulerLock(name="housekeepingJob", lockAtLeastFor="14m", lockAtMostFor="14m")` (HousekeepingJobManager.java:26) elects ONE instance per 15-minute slot — under normal lock-holding, only one instance runs this job per cycle. UNDER the F-010 `shedlock_window_dangerously_close_to_schedule` racing scenario (a cycle ≥14m releases lock before next 15m slot fires), TWO instances can run concurrently. Both query `information_schema.tables` (PartitionServiceImpl.java:89-105), both find the same past-empty partitions, both attempt `DROP TABLE <partition>` (no `IF EXISTS`). Postgres serialises via `ACCESS EXCLUSIVE` lock — the first wins, the second errors with `relation does not exist`. Parent class wraps as `RuntimeException`, manager logs ERROR, cycle continues. **No corruption**, but **noisy logs** and **wasted work**. — confidence: STATIC-INFERRED — evidence: HousekeepingJobManager.java:25-26 + EmptyPartitionsHousekeepingJob.java:30-32 + PartitionServiceImpl.java:121-127. (Probe P-011 covers the deeper question: what about concurrent WRITES, not just concurrent DROPs.)
  - **Q-E.2**: Is the call replay-safe (idempotent)?
    - **Answer**: STATIC-INFERRED. Re-running the job is mostly idempotent: a partition that was already dropped will not appear in `information_schema.tables` so the LIKE query simply returns fewer rows. EXCEPT: if a partition is dropped between the LIKE query and the `count(*) = 0` check (vanishingly small window, but possible), the count query fails with `relation does not exist`, throwing — entire cycle's remaining DROPs skipped, manager logs ERROR. So: idempotent at the cycle-as-a-whole level under normal conditions; failure-fragile under tight races. — confidence: STATIC-INFERRED — evidence: PartitionServiceImpl.java:90-92 (the LIKE query at the start of the cycle), 134 (the count-zero check after).
  - **Q-E.3**: Cascading WRITES during DROP — what happens to a concurrent `INSERT INTO activity` targeting a partition that is MID-DROP?
    - **Answer**: PROBE-NEEDED — **THIS IS THE CRITICAL FINDING FOR THE 'EMPTY PARTITIONS' NAME PROMISE**. The empty-check (`SELECT count(*) = 0`) and the DROP TABLE are on the same Connection but NOT in a transaction (the parent class doesn't wrap in `transaction(...)` unlike Alert/DataEntity jobs). Between the check returning true and the DROP firing:
      1. Application code logs an activity event → routes to the per-partition INSERT via Postgres's partition routing (auto-routes by date range).
      2. The PRE-DROP partition still exists in `pg_class`; INSERT succeeds (commits immediately on the autocommit Connection of the writing path).
      3. The housekeeping Connection's DROP TABLE arrives; Postgres waits on the `ACCESS EXCLUSIVE` lock OR proceeds depending on the lock release order.
      4. When DROP proceeds, the just-inserted row's partition table is destroyed — the row is gone with no compensating undo, no error to the original INSERT caller (who saw committed-success).
    - **emitting P-012** to verify experimentally with a tight concurrent insert. Severity if confirmed: HIGH (silent data loss on the audit trail; LSN-001-shape — silent default + destructive action).
  - **Q-E.4**: Transactional posture — DDL inside a transaction in Postgres?
    - **Answer**: STATIC-INFERRED. The parent class `EmptyPartitionsHousekeepingJob.doHousekeeping` does NOT call `DSL.using(connection).transaction(...)` (unlike AlertHousekeepingJob.java:25 and DataEntityHousekeepingJob.java:71). The raw `Connection` from `PGConnectionFactory` is used directly. JDBC's default behaviour is autocommit=true unless explicitly disabled — and a search of `PGConnectionFactory` is NOT in the file:line set already read. ASSUMING autocommit=true (default), each `DROP TABLE` is a standalone transaction: commits immediately. **There is no rollback of partial drops** — if cycle drops 5 partitions then errors on the 6th, the first 5 stay dropped. — confidence: MEDIUM (need to verify PGConnectionFactory autocommit posture; see P-011 sub-probe).
  - **Q-E.5**: Empty-check + drop atomicity — is the AND atomic?
    - **Answer**: STATIC-INFERRED — **NO, the AND is not atomic**. PartitionServiceImpl.java:110 evaluates `isPartitionInPast && isPartitionEmpty` in Java (short-circuit AND on the result of TWO database round-trips: `getLastPartitionDate` parses the name only [no DB hit]; `isPartitionEmpty` runs a SELECT). After `isPartitionEmpty` returns true, the partition is added to the result list; the for-loop in `EmptyPartitionsHousekeepingJob.java:24-27` THEN issues `DROP TABLE` in a separate prepared-statement call. There is NO row-lock, partition-lock, or transaction holding from the empty-check through the drop. The race window is `[returntime of count(*)=0 SELECT, arrival of DROP TABLE at Postgres]` — typically milliseconds, BUT non-zero. — confidence: STATIC-INFERRED — evidence: PartitionServiceImpl.java:108-115 + EmptyPartitionsHousekeepingJob.java:24-27.

## sources

- understanding ← ActivityEmptyPartitionsHousekeepingJob.java:1-17 + EmptyPartitionsHousekeepingJob.java:1-40 + PartitionServiceImpl.java:82-142 + HousekeepingJobManager.java:1-48
- concepts.entities.ActivityEmptyPartitionsHousekeepingJob ← ActivityEmptyPartitionsHousekeepingJob.java:9
- concepts.entities.EmptyPartitionsHousekeepingJob ← EmptyPartitionsHousekeepingJob.java:13
- concepts.entities.HousekeepingJob ← HousekeepingJob.java:5
- concepts.entities.HousekeepingJobManager ← HousekeepingJobManager.java:21
- concepts.entities.PartitionService ← PartitionService.java:9
- concepts.entities.PartitionServiceImpl ← PartitionServiceImpl.java:19
- concepts.entities.Tables.ACTIVITY ← ActivityEmptyPartitionsHousekeepingJob.java:6,16 (verified via static import of `org.opendatadiscovery.oddplatform.model.Tables.ACTIVITY`)
- concepts.entities.ActivityTablePartitionManager ← ActivityTablePartitionManager.java:10 (sibling sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md`)
- concepts.invariants.[0] ← ActivityEmptyPartitionsHousekeepingJob.java:14-16 + PartitionServiceImpl.java:20
- concepts.invariants.[1] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 (no `exclusions()` override) + EmptyPartitionsHousekeepingJob.java:37-39
- concepts.invariants.[2] ← PartitionServiceImpl.java:133-142
- concepts.invariants.[3] ← PartitionServiceImpl.java:86, 129-131
- concepts.invariants.[4] ← PartitionServiceImpl.java:121-127 (no IF EXISTS) + EmptyPartitionsHousekeepingJob.java:30-32 (wraps RuntimeException) + HousekeepingJobManager.java:42-46 (logs ERROR + continues)
- concepts.invariants.[5] ← EmptyPartitionsHousekeepingJob.java:16-33 (no `transaction(...)` wrapper) + HousekeepingJobManager.java:32-35 (shared Connection from PGConnectionFactory)
- dependencies_semantic.requires-feature ← PartitionServiceImpl.java:82-142 (PartitionService.getEmptyPastPartitions + dropPartition) + EmptyPartitionsHousekeepingJob.java:14 (constructor injection of PartitionService) + HousekeepingJobManager.java:23 (List<HousekeepingJob> injection) + sibling sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md`
- dependencies_semantic.requires-config.[0] ← HousekeepingJobManager.java:18 + application.yml:166
- dependencies_semantic.requires-config.[1] ← ActivityTablePartitionManager.java:11 + application.yml:212-213
- dependencies_semantic.requires-config.[2] ← HousekeepingTTLProperties.java:6-11 (only 3 fields, no `activityDays`)
- dependencies_semantic.requires-runtime ← PartitionServiceImpl.java:121-127 (DROP TABLE — Postgres) + HousekeepingJobManager.java:25-26 (Spring @Scheduled + ShedLock)
- dependencies_semantic.coupling ← MessageEmptyPartitionsHousekeepingJob.java:22-25 + PartitionServiceImpl.java:72-80 + PostgreSQLPartitionCreationJob.java:40 + lineage/odd-platform/feature-flows/detail/F-010.yaml
- tests_coverage_semantic.gaps ← grep for `ActivityEmptyPartitionsHousekeepingJob\|EmptyPartitionsHousekeepingJob` in `<odd-platform-repo>/odd-platform-api/src/test` (ZERO matches verified)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (2026-05-20, status 200) — confirms 3-vs-5 job drift + activity-table retention absence
- docs_link_semantic.inferred_docs.[1] ← inherited from sibling sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md` (WebFetched 2026-05-10 status 200)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch /configuration-and-deployment/odd-platform live quotes + HousekeepingJobManager.java:23 + F-010 drift_class `docs_three_vs_code_five_job_count`
- docs_link_semantic.doc_drift_findings.[1] ← /features/active-platform-features/activity-feed#configuration (sibling sidecar quote) + ActivityEmptyPartitionsHousekeepingJob.java:14-16 + PartitionServiceImpl.java:110
- docs_link_semantic.doc_drift_findings.[2] ← HousekeepingTTLProperties.java:6-11 + F-010 drift_class `cross_pillar_activity_retention_to_p_07`
- implicit_adrs.[0] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + MessageEmptyPartitionsHousekeepingJob.java:12-25 + EmptyPartitionsHousekeepingJob.java:35-39
- implicit_adrs.[1] ← EmptyPartitionsHousekeepingJob.java:21-22 + PartitionServiceImpl.java:109-112
- bugs_limitations_corner_cases.[0] ← ActivityEmptyPartitionsHousekeepingJob.java:14-17 + EmptyPartitionsHousekeepingJob.java:21-22 + PartitionServiceImpl.java:82-118 + sibling sidecar `odd-platform__java__ActivityTablePartitionManager` + F-010
- bugs_limitations_corner_cases.[1] ← PartitionServiceImpl.java:108-117 + EmptyPartitionsHousekeepingJob.java:16-33 + AlertHousekeepingJob.java:25 (contrast)
- bugs_limitations_corner_cases.[2] ← PartitionServiceImpl.java:121-127 + EmptyPartitionsHousekeepingJob.java:30-32 + HousekeepingJobManager.java:25-26 + F-010 drift_class `shedlock_window_dangerously_close_to_schedule`
- bugs_limitations_corner_cases.[3] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + EmptyPartitionsHousekeepingJob.java:37-39 + PartitionServiceImpl.java:73-80 + MessageEmptyPartitionsHousekeepingJob.java:22-25
- bugs_limitations_corner_cases.[4] ← EmptyPartitionsHousekeepingJob.java:25, 29 + application.yml:254 + grep partition+housekeeping packages for Micrometer types
- security.auth_mode_relevance ← ActivityEmptyPartitionsHousekeepingJob.java:8 + HousekeepingJobManager.java:17-21
- security.known_security_gaps.[0] ← PartitionServiceImpl.java:121-127 + WebFetch /configuration-and-deployment/odd-platform 2026-05-20
- security.known_security_gaps.[1] ← EmptyPartitionsHousekeepingJob.java:25 + grep `@ActivityLog\|AuditEvent` in housekeeping+partition packages
- performance.hot_paths.[0] ← PartitionServiceImpl.java:89-105 + PartitionServiceImpl.java:133-142
- performance.throughput_characteristics ← EmptyPartitionsHousekeepingJob.java:16-33 (sequential) + HousekeepingJobManager.java:33-35 (shared connection) + F-010 drift_class `shared_connection_slowest_job_blocks_cycle`
- performance.resource_allocation ← PartitionServiceImpl.java:134 (`SELECT count(*) = 0`) + PartitionServiceImpl.java:121-127 (DROP TABLE)
- performance.scaling_characteristics ← HousekeepingJobManager.java:25-26 + PartitionServiceImpl.java:89-105
- performance.known_performance_gaps.[0] ← PartitionServiceImpl.java:134 (no LIMIT, no EXISTS)
- performance.known_performance_gaps.[1] ← ActivityEmptyPartitionsHousekeepingJob.java:8
- performance.known_performance_gaps.[2] ← EmptyPartitionsHousekeepingJob.java:16-33 (no Timer wrapping)
- stress_findings.Q-A.1..Q-A.7 ← AbstractPartitionManager.java:30,33-37 + PartitionServiceImpl.java:89-105 + HousekeepingJobManager.java:18 + HousekeepingTTLProperties.java:6-11 + ActivityEmptyPartitionsHousekeepingJob.java:1-17 + F-010 drift_classes
- stress_findings.Q-B.1..Q-B.4 ← PartitionServiceImpl.java:110, 133-142 + EmptyPartitionsHousekeepingJob.java:16-33 + PostgreSQLPartitionCreationJob.java:40 + WebFetch /features/active-platform-features/activity-feed#configuration
- stress_findings.Q-C.1, Q-C.2 ← PartitionServiceImpl.java:89-92 (no ORDER BY, no LIMIT) + EmptyPartitionsHousekeepingJob.java:24-27
- stress_findings.Q-D.1, Q-D.2 ← ActivityEmptyPartitionsHousekeepingJob.java:8 + HousekeepingJobManager.java:17-21
- stress_findings.Q-E.1 ← HousekeepingJobManager.java:25-26 + EmptyPartitionsHousekeepingJob.java:30-32 + F-010 drift_class
- stress_findings.Q-E.2 ← PartitionServiceImpl.java:90-92, 134
- stress_findings.Q-E.3 ← PartitionServiceImpl.java:108-117 + EmptyPartitionsHousekeepingJob.java:16-33 (no transaction) → emitted P-012
- stress_findings.Q-E.4 ← EmptyPartitionsHousekeepingJob.java:16-33 (no transaction wrapper) + contrast with AlertHousekeepingJob.java:25 → uncertainty resolved by P-011 sub-probe
- stress_findings.Q-E.5 ← PartitionServiceImpl.java:108-115 + EmptyPartitionsHousekeepingJob.java:24-27

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: MEDIUM
- performance: MEDIUM (one PROBE-NEEDED finding on count-scan I/O cost)
- stress_findings: HIGH (16 questions across 5 categories — 13 STATIC-INFERRED, 3 PROBE-NEEDED emitted as P-011, P-012, P-013; 1 N/A on auth)

## LSN cross-references

This sidecar IS the structural analogue node for LSN-018 (`retrospectives/LSN-018-reducer-contradiction-no-coherence-check.md`). LSN-018 was the case-law where the methodology had emitted `TEST-GAP-523` claiming "no TTL eviction on `search_facets`" — directly contradicted by `SearchFacetsHousekeepingJob`'s existence which `F-010` had ALREADY enumerated. The fix added a coherence-sweep across reducers. **This sidecar shows the pre-LSN-018-fix failure mode would have applied identically here**: a per-node enrichment of `ActivityController` or `ReactiveActivityRepositoryImpl` would observe "no `deleteFrom(ACTIVITY)` in the controller chain, no `deleteFrom(ACTIVITY)` in the repository" and emit `TEST-GAP-{NNN}` claiming "no TTL eviction on activity" — which would CONTRADICT F-010 batch-K's enumeration of `ActivityEmptyPartitionsHousekeepingJob` as the 4th of 5 housekeeping jobs. The Stress Protocol (LSN-019) PLUS the coherence-sweep (LSN-018) together close this class: the file-analyser INTERROGATES name-behavior pairs at the boundary (Q-B.1-B.4), and the reducer-side coherence-sweep cross-checks new test-gap emissions against feature-flows.

This sidecar also IS a VAL-LSN-019 validation: applies the Stress Protocol to a structurally simple node (17 lines) and demonstrates that the protocol produces NON-TRIVIAL findings even on apparently-trivial code — Q-E.3 (the race window) and Q-A.4 (the I/O-cost-at-scale) are operationally load-bearing findings that a descriptive read would not generate.

## probes emitted

- P-011 (PostgreSQL autocommit posture + multi-instance race) — `lineage/odd-platform/probes/P-011.yaml`
- P-012 (race window: empty-check → INSERT → DROP TABLE silent row loss) — `lineage/odd-platform/probes/P-012.yaml` — **HIGHEST severity finding pending probe**
- P-013 (I/O cost of `count(*) = 0` per past partition on populated activity table) — `lineage/odd-platform/probes/P-013.yaml`

## Maintainer notes

---
node_id: "odd-platform java ActivityTablePartitionManager config-key-consumer:odd.activity.partition-period@L11"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-02
---

# ActivityTablePartitionManager `odd.activity.partition-period` — semantic understanding

## understanding

`ActivityTablePartitionManager` is a Spring `@Component` that participates in the platform's range-partitioning lifecycle for the `public.activity` table: it injects the integer `partitionDaysPeriod` from `odd.activity.partition-period` (default `30`) and delegates partition-CREATION to `AbstractPartitionManager.createPartitionsIfNotExists`. The orchestrator `PostgreSQLPartitionCreationJob` fires it twice — once at boot via `@PostConstruct` (under a Postgres advisory lock id `partition.advisory-lock-id`, default `90`) and again nightly at `00:01` server-time via Spring `@Scheduled(cron = "0 1 0 * * *")` with ShedLock distributed coordination (`@SchedulerLock("partitionCreationJob", lockAtLeastFor = "10m", lockAtMostFor = "10m")`). The setting is **partition WIDTH/cadence only** — each created partition spans `2 × partitionDaysPeriod` days, and a new partition is appended every `partitionDaysPeriod` days; **no retention / drop logic ever runs for this table** (the abstract base never calls the `PartitionService.dropPartition` API that exists for housekeeping), so the `activity` table grows monotonically.

## concepts

- entities: [ActivityTablePartitionManager, AbstractPartitionManager, PartitionManager, PartitionService, PostgreSQLPartitionCreationJob, TablePartition, Tables.ACTIVITY (public.activity)]
- operations: [inject-partition-period, create-partition-if-not-exists, append-rolling-partition, boot-time-partition-init, nightly-cron-partition-refresh, acquire-advisory-lock, acquire-shedlock]
- invariants:
  - "Default partition width is 30 days when `odd.activity.partition-period` is unset (`@Value(\"${odd.activity.partition-period:30}\")` at ActivityTablePartitionManager.java:11)."
  - "Each created partition spans `2 × partitionDaysPeriod` days; new partitions are appended at `partitionDaysPeriod` cadence — overlap is structural by design (AbstractPartitionManager.java:35-37)."
  - "Boot-time partition creation runs UNDER advisory lock id `partition.advisory-lock-id` (default `90`); nightly cron run uses ShedLock `partitionCreationJob` with lockAtLeastFor=10m / lockAtMostFor=10m (PostgreSQLPartitionCreationJob.java:26-27, 40-41)."
  - "Per-manager exceptions are caught and logged at ERROR in `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (lines 57-60); the outer loop continues to the next manager — partition creation failure for the `activity` table is silent at the API/UI surface."
  - "The activity table has NO partition retention/drop path — `AbstractPartitionManager.createPartitionsIfNotExists` only CREATEs; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions` (which exist on the service interface, PartitionService.java:23-25)."
- audiences: [odd-platform operators tuning vacuum / partition-prune for high-volume activity, DBAs sizing the activity table for retention, https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (Configure ODD Platform reference)]

## dependencies_semantic

- requires-feature:
  - "`PartitionService` bean (`PartitionServiceImpl`) — exposes `createPartition`, `getLastPartitionTableName`, `getLastPartitionDate` (used by the abstract base), plus the unused-from-this-caller `getEmptyPastPartitions` and `dropPartition`."
  - "`PostgreSQLPartitionCreationJob` orchestrator — discovers all `PartitionManager` beans via the `List<PartitionManager>` constructor injection (PostgreSQLPartitionCreationJob.java:22) and runs each at boot and nightly."
  - "`PostgreSQLLeaderElectionManager` (boot-time) + `PGConnectionFactory` (nightly cron) — supply the JDBC Connection on which CREATE TABLE PARTITION runs."
  - "`DateTimeUtil.generateNow().toLocalDate()` (AbstractPartitionManager.java:23) — the timezone of the `baseline` date is whatever `DateTimeUtil` returns; partition boundaries are local-date, not UTC-explicit."
  - "Spring `@Scheduled` infrastructure + ShedLock + Postgres advisory locks — required for distributed-deployment correctness (multi-instance must serialise so only one node CREATEs)."
- requires-config:
  - "`odd.activity.partition-period` — integer, days, default `30` (ActivityTablePartitionManager.java:11 + application.yml:212-213)."
  - "`partition.advisory-lock-id` — long, no default in code (`@Value(\"${partition.advisory-lock-id}\")` at PostgreSQLPartitionCreationJob.java:26); set to `90` in application.yml:197-198. This is the boot-time advisory-lock id; ShedLock is used for the nightly cron."
- requires-runtime:
  - "PostgreSQL with declarative table partitioning (`CREATE TABLE ... PARTITION OF` — PostgreSQL 10+; ODD historically targets 13+)."
  - "Spring Boot — bean lifecycle (`@PostConstruct`) and the scheduling subsystem (`@Scheduled`)."
  - "ShedLock-Spring with a Postgres-backed lock provider for the `partitionCreationJob` name (wiring lives outside this file)."
- coupling:
  - "`MessageTablePartitionManager` is the sibling that consumes `datacollaboration.message-partition-period` (also default `30`); both are discovered into the same `List<PartitionManager>` and share the same advisory-lock-id, ShedLock name, and cron expression. A failure in one manager logs ERROR and the loop continues — the two tables are coupled through the shared scheduler but independent in their CREATE semantics."
  - "Naming-convention coupling with `PartitionServiceImpl.getLastPartitionDate` (PartitionServiceImpl.java:72-80): partition names must be exactly `{tableName}_{yyyyMMdd}_{yyyyMMdd}` (3 underscore-separated parts post-split); a partition manager that renamed the partitions or used a different formatter would crash with `IllegalArgumentException(\"Cannot parse table name\")` (line 75)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Boot-time partition creation: with no existing partitions, the manager creates the first window spanning `[baseline, baseline + 2×period]`."
  - "Boot-time partition creation: with an existing latest partition at `lastPartitionDate`, the manager loops until `lastPartitionDate >= baseline + period` (the `bufferDate`), appending overlapping windows."
  - "Nightly cron path under ShedLock — invocation only fires when the lock is acquired (`LockAssert.assertLocked()` at PostgreSQLPartitionCreationJob.java:43)."
  - "Failure path: `partitionService.createPartition` throws (e.g. permission denied, partition name collision). The outer catch at `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (line 57-60) logs ERROR and continues; the inner `AbstractPartitionManager.createPartitionsIfNotExists` wraps with `RuntimeException(e)` (line 49)."
  - "Custom `odd.activity.partition-period=7` (smaller window) — verifies the cadence scales without overlap-gap defects."
  - "Custom `odd.activity.partition-period=0` or negative value — undefined behaviour; no `@Min(1)` validation at the consumer (ActivityTablePartitionManager.java:11). `LocalDate.plusDays(0)` would loop with `lastPartitionDate.plusDays(0)` and reach the `bufferDate` check at the same date; the `while` predicate is `isBefore`, so `0` would NEVER enter the loop (boot would silently skip creation). Negative values would create partitions with `endDate < beginDate` — PostgreSQL would reject the CREATE."
  - "Concurrent multi-instance race: boot-time advisory-lock-90 path under contention — second instance blocks on `leaderElectionManager.acquire` until first releases."
- test_files: []
- gaps: |
    No test under `odd-platform-api/src/test/java` references `PartitionManager`,
    `PartitionService`, `ActivityTablePartitionManager`,
    `MessageTablePartitionManager`, or `PostgreSQLPartitionCreationJob` (grep
    returned zero matches against the test directory). The partition lifecycle
    is one of the platform's primary durability concerns for the activity audit
    trail — and none of it is exercised by automated tests.

    The likeliest regression sites:

    1. **`@Value(\"${odd.activity.partition-period:30}\")` default propagation** —
       a future migration that moves config to `@ConfigurationProperties` could
       silently drop the `:30` default and bind `0` (Java int default) on a
       deployment that left the key unset, producing zero partitions.
    2. **The `partitionDaysPeriod * 2L` arithmetic** (AbstractPartitionManager.java:35)
       — a refactor that changes the partition WIDTH formula breaks the implicit
       2x-overlap design; no test would catch the cadence regression.
    3. **Silent-fail swallow** (PostgreSQLPartitionCreationJob.java:57-60) — if
       partition creation fails (DB role missing CREATE privilege, name
       collision, lock contention), the job logs ERROR and continues; rows
       arriving in the period not covered by an existing partition would be
       REJECTED by Postgres with `no partition of relation "activity" found for
       row`. This rejection would surface in `@ActivityLog` callers as
       INSERT failures, but there is no INTEGRATION TEST that exercises the
       failure → fallback (or non-fallback) path.
    4. **Boot-time vs nightly cron divergence** — the boot path takes a JDBC
       Connection from `leaderElectionManager.acquire(activityLockId, false)`;
       the nightly path takes one from `pgConnectionFactory.getConnection()`.
       Different connections, different auto-commit / isolation defaults
       potentially, no test verifies they behave identically.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#activity-feed-partitioning-odd-activity-partition-period"
    rationale: "Canonical configuration-reference page for ODD Platform; verbatim live content names this key by its full path and documents the partition width semantics."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-10):
      - "The ODD Platform `activity` table is range-partitioned on a rolling date
        window; `odd.activity.partition-period` sets the partition width in days."
      - "The default creates a new partition every 30 days, which is appropriate
        for most deployments."
      - "Operators running high-volume deployments (millions of activity events
        per day) can tune this downward to narrow partitions — smaller partitions
        speed up vacuum and partition-prune operations on the activity feed."
      - "`odd.activity.partition-period`: partition width in days for the
        `activity` table. Integer, days. Defaults to `30`."

      The page enumerates `odd.activity.partition-period` in its list of
      documented configuration keys (verified via separate WebFetch listing
      ALL keys on the page — `odd.activity.partition-period` appears between
      `odd.tenant-id` and `odd.links`).

      The page does NOT mention:
      - partition RETENTION semantics (no DROP / cleanup discussion)
      - the `partition.advisory-lock-id` setting (omitted entirely; the key
        is in application.yml but unreferenced on the docs site for this
        partitioning context)
      - the `2 × partitionDaysPeriod` partition WIDTH (the docs say "the
        default creates a new partition every 30 days" — accurate for cadence
        but does not surface that each individual partition spans 60 days,
        producing a deliberate 2x overlap window).
      - the boot-time vs nightly-cron dual execution paths
      - silent-fail behaviour if partition creation throws.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "#configuration"
    rationale: "Feature-side cross-reference — the Activity Feed page's Configuration section points operators at the canonical config-reference page; this is the page batch A's `getActivity.md` already verified at status 200 with a now-updated Configuration section."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-10) from the
      "Configuration" section:
      - "Activity-feed retention and partitioning are controlled by the
        platform-level setting `odd.activity.partition-period` on Configure
        ODD Platform."
      - "Adjust the partitioning cadence per the volume your deployment
        generates — the operator-side reference is the canonical home for
        this key."

      Section headings on the page (verbatim, in order):
      - "Activity Feed"
      - "Where to find it"
      - "Filters on the global Activity page"
      - "Event types"
      - "Auto-resolved alert events"
      - "Configuration"
      - "Where to next"

      The page does NOT define `Activity Feed` as a canonical concept anywhere
      else, and the Configuration section does NOT itself describe the
      partition WIDTH — it only links forward to the operator reference.
- doc_drift_findings:
  - "Documentation claim: activity-feed page Configuration section states 'Activity-feed retention and partitioning are controlled by [`odd.activity.partition-period`]'. Code behaviour: the key controls ONLY partition WIDTH (the cadence of CREATE TABLE PARTITION) — there is NO retention / cleanup path in the code. `PartitionService.dropPartition` and `getEmptyPastPartitions` exist (PartitionService.java:21-25, PartitionServiceImpl.java:82-127) but `AbstractPartitionManager.createPartitionsIfNotExists` never calls them, and no other caller invokes `dropPartition` for the activity table (grep for `dropPartition` in the partition package returns only the service itself). The documentation overstates the configuration's effect — an operator setting `partition-period=7` to reduce 'retention' would only create narrower partitions; old partitions persist forever."
  - "Documentation claim: 'The default creates a new partition every 30 days'. Code behaviour: a new partition IS appended every `partition-period` days (HIGH-confidence agreement on cadence), but each partition's WIDTH is `2 × partition-period = 60 days` (AbstractPartitionManager.java:35: `lastPartitionDate.plusDays(partitionDaysPeriod * 2L)`). The 2x-overlap is invisible to readers of the docs page — operators sizing storage based on '30 days per partition' will underestimate the size of each individual partition by 2x."
  - "Documentation omission: the operator-facing reference does not mention `partition.advisory-lock-id` (default `90`) at all, despite the key being required-with-no-code-default (`@Value(\"${partition.advisory-lock-id}\")` — no `:N` fallback at PostgreSQLPartitionCreationJob.java:26). An operator who removes the key from application.yml at deploy time would fail bean wiring at boot. The application.yml ships with the default present, but this is an undocumented coupling between two settings."
  - "Documentation omission: partition-creation failure mode (DB role lacking CREATE privilege; partition-name collision; advisory-lock contention) is not surfaced. The actual behaviour — ERROR log + silent continue at PostgreSQLPartitionCreationJob.java:57-60, with downstream INSERT failures on rows arriving in uncovered date ranges — is invisible to operators reading the docs."

## implicit_adrs

- "Each partition spans `2 × partitionDaysPeriod` days (deliberate 2x-overlap) while new partitions are appended at `partitionDaysPeriod` cadence — produces forward-looking coverage so that INSERTs targeting `baseline + period` always land in an existing partition before the next creation cycle, eliminating the 'no partition for row' window at midnight on the boundary day." — evidence: AbstractPartitionManager.java:35 (`new TablePartition(lastPartitionDate, lastPartitionDate.plusDays(partitionDaysPeriod * 2L))`) + AbstractPartitionManager.java:30 (`bufferDate = baseline.plusDays(partitionDaysPeriod)`) + AbstractPartitionManager.java:37 (`lastPartitionDate = lastPartitionDate.plusDays(partitionDaysPeriod)`). — intent_anchor: "the `* 2L` literal multiplier on the partition END date combined with the `+ partitionDaysPeriod` advance of the cursor — the WIDTH-to-CADENCE ratio is hardcoded to 2:1, and the `while (lastPartitionDate.isBefore(bufferDate))` predicate ensures the partition-set always covers the next-period window before the job is scheduled to run again." — confidence: HIGH
- "Partition CREATE is gated by a Postgres advisory lock at boot (`partition.advisory-lock-id` = 90) AND by ShedLock at nightly cron (`partitionCreationJob`, lockAtLeastFor=10m / lockAtMostFor=10m) — defence-in-depth against multiple instances racing on `CREATE TABLE IF NOT EXISTS`. The dual mechanism reflects two distinct concurrency contexts: boot-time uses a single advisory lock because every instance boots and tries to initialise; nightly cron uses ShedLock to elect a single executor across the cluster (Spring's `@Scheduled` fires on every instance otherwise)." — evidence: PostgreSQLPartitionCreationJob.java:31 (`leaderElectionManager.acquire(activityLockId, false)`) + PostgreSQLPartitionCreationJob.java:40-43 (`@Scheduled(cron = ...) @SchedulerLock(...) LockAssert.assertLocked()`). — intent_anchor: "`leaderElectionManager.acquire(activityLockId, false)` in the @PostConstruct branch + `@SchedulerLock(name = \"partitionCreationJob\", lockAtLeastFor = \"10m\", lockAtMostFor = \"10m\")` on the cron branch — two named-lock mechanisms protecting the same critical section, both with explicit comments-of-the-shape (the `LockAssert.assertLocked()` is a defensive runtime-assertion that the ShedLock is in fact held)." — confidence: HIGH
- "Partition manager beans are discovered as a `List<PartitionManager>` by constructor injection rather than enumerated explicitly — adding a new table-partition manager only requires creating a new `@Component` extending `AbstractPartitionManager`; the orchestrator picks it up automatically. The pattern is applied consistently across `ActivityTablePartitionManager` and `MessageTablePartitionManager` (the latter additionally gated by `@ConditionalOnDataCollaboration` so it only registers when DataCollaboration is enabled)." — evidence: PostgreSQLPartitionCreationJob.java:22 (`private final List<PartitionManager> partitionManagers`) + MessageTablePartitionManager.java:17 (`@ConditionalOnDataCollaboration`) + ActivityTablePartitionManager.java:9 (`@Component`, no conditional). — intent_anchor: "Spring's `List<T>` collection injection is the chosen extensibility seam — the cross-manager consistency (`extends AbstractPartitionManager implements PartitionManager`, `@Getter private final String tableName = Tables.X.getName()`, `@Value(\"${...:30}\") @Getter private int partitionDaysPeriod`) shows the pattern is applied as a deliberate convention." — confidence: HIGH
- "Partition manager failures are caught at the orchestrator and logged at ERROR while the outer loop continues to the next manager — the design prioritises maximising partition-creation success across all tables over fail-fast detection of a single-table failure. A failing `activity` partition does NOT halt the boot of the application; it logs ERROR and the application proceeds with no partition coverage for the failure window." — evidence: PostgreSQLPartitionCreationJob.java:53-60 (`createPartitionIfNotExists` catches `Exception e`, calls `log.error(...)` and returns normally). — intent_anchor: "the `catch (final Exception e)` block at the orchestrator level deliberately swallows after logging — the outer `for (final PartitionManager partitionManager : partitionManagers)` loop in both the @PostConstruct and the @Scheduled methods continues to the next iteration regardless of failure." — confidence: MEDIUM (the WHY-anchor is the convention of try/catch/log/continue, but no `// continue on failure to maximise coverage` comment proves intent — the pattern itself is the only evidence).

## bugs_limitations_corner_cases

- "**No partition retention / DROP path for the `activity` table** — `AbstractPartitionManager.createPartitionsIfNotExists` only creates partitions; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions`. The activity table grows monotonically; an operator running ODD for several years with high-volume activity (e.g. 1M events/day) accumulates 365×N days × ~size-per-event of audit data with no automatic cleanup. The docs page (activity-feed `Configuration` section) explicitly tells operators the setting controls 'retention and partitioning' — that claim is **incorrect**: setting `partition-period=7` narrows partitions but does NOT shorten the retained window. To actually shorten retention an operator must manually `DROP TABLE activity_YYYYMMDD_YYYYMMDD` partitions." — evidence: AbstractPartitionManager.java:14-51 (no `dropPartition` invocation anywhere) + PartitionService.java:21-25 (`getEmptyPastPartitions` + `dropPartition` defined but unused by this caller; grep of the partition package for `dropPartition` returns only PartitionService.java + PartitionServiceImpl.java itself, no callers) + WebFetch /features/active-platform-features/activity-feed#configuration ('retention and partitioning are controlled by'). — severity: HIGH (silent-data-growth class — analogous to LSN-001 attachment-ephemeral-default in shape: silent operator-misleading default with production consequences)
- "**No `@Min(1)` validation on `partition-period`** — `@Value(\"${odd.activity.partition-period:30}\")` accepts `0`, negative integers, or any int. A `partition-period=0` boot would: (a) compute `bufferDate = baseline.plusDays(0)` = baseline; (b) the `while (lastPartitionDate.isBefore(bufferDate))` predicate evaluates `baseline.isBefore(baseline)` = false; (c) NO partition is created. Rows arriving for `INSERT INTO activity` would be REJECTED by Postgres with `no partition of relation \"activity\" found for row` — a silent operator misconfiguration produces a hard-fail INSERT path with no boot-time validation error. A negative value would attempt to CREATE a partition with `endDate < beginDate`, rejected by Postgres at CREATE time and logged at ERROR (then swallowed)." — evidence: ActivityTablePartitionManager.java:11 (no `@Min` / `@Positive`) + AbstractPartitionManager.java:30,33-37 (the bufferDate + while-loop arithmetic). — severity: MEDIUM
- "**Silent-fail on partition CREATE failure** — `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (lines 53-61) catches the `RuntimeException` raised by `AbstractPartitionManager.createPartitionsIfNotExists` (line 49) and logs at ERROR before continuing the loop. There is no alerting, no metric, no health-check degradation, no UI surfacing. An ODD instance that booted with a DB role lacking CREATE TABLE privilege would log ERROR once at boot and the application would continue serving traffic — until `activity` INSERTs began failing as rows arrived for the uncovered window." — evidence: PostgreSQLPartitionCreationJob.java:53-60 (the catch + log.error + return) + AbstractPartitionManager.java:48-50 (the wrapping RuntimeException). — severity: HIGH (silent-fail of a durability-critical subsystem)
- "**`Tables.ACTIVITY.getName()` returns `activity` (the table is in `public` schema per `PartitionServiceImpl.DEFAULT_SCHEMA = \"public\"`)** — there is no support for non-`public` schemas. A multi-tenant or schema-isolated deployment that placed the `activity` table outside `public` would silently fail to discover existing partitions (`getLastPartitionTableName` queries `table_schema = ?` bound to `public` always) and would attempt to CREATE partitions in `public` regardless of the actual host schema." — evidence: PartitionServiceImpl.java:20 (`private static final String DEFAULT_SCHEMA = \"public\"`) + PartitionServiceImpl.java:41 (`statement.setString(1, DEFAULT_SCHEMA)`) + ActivityTablePartitionManager.java:16 (`Tables.ACTIVITY.getName()` resolves to bare `activity` per generated Tables.java:91). — severity: LOW (most ODD deployments use `public`; a non-`public` deployment is an unsupported config)
- "**Partition naming is parser-coupled** — `PartitionServiceImpl.getLastPartitionDate` (lines 72-80) splits the partition name on `_` and expects exactly 3 parts (`activity_YYYYMMDD_YYYYMMDD`); fewer or more parts raises `IllegalArgumentException(\"Cannot parse table name\")`. If an operator manually creates a partition with a different name (e.g. `activity_archive_old`) and that partition becomes the lexicographically-greatest match for `WHERE table_name LIKE 'activity_%'`, the parser fails at next boot/cron — the abstract base's exception then wraps and logs at ERROR, partition creation skipped for the cycle." — evidence: PartitionServiceImpl.java:72-80 (the split + 3-part validation) + PartitionServiceImpl.java:42 (`statement.setString(2, tableName + \"_%\")` matches ANY suffix). — severity: LOW (requires manual operator action to trigger)
- "**Boot-time advisory-lock path has no `:default` fallback for `partition.advisory-lock-id`** — `@Value(\"${partition.advisory-lock-id}\")` at PostgreSQLPartitionCreationJob.java:26 carries NO `:default` (unlike the partition-period's `:30`). If an operator deletes the `partition.advisory-lock-id` key from a customised application.yml (or sets `PARTITION_ADVISORY_LOCK_ID=`), bean wiring at boot would fail with a Spring `IllegalArgumentException` (`Could not resolve placeholder`). The docs page does not list `partition.advisory-lock-id` as a documented key — it is a 'configuration ghost' for operators." — evidence: PostgreSQLPartitionCreationJob.java:26 (no `:` default) + application.yml:197-198 (`partition: advisory-lock-id: 90`) + WebFetch /configuration-and-deployment/odd-platform (full list of documented keys — `partition.advisory-lock-id` ABSENT from the documented set, while `notifications.wal.advisory-lock-id` and `datacollaboration.receive-event-advisory-lock-id` ARE listed). — severity: LOW (operator-error gated; ships with sane default)
- "**`@Scheduled(cron = \"0 1 0 * * *\")` is server-timezone-implicit** — Spring's `@Scheduled` defaults to the server's local timezone unless `zone` is specified; the cron runs at `00:01` local server time. A multi-region deployment where instances run in different timezones would create partitions at different wall-clock times; in single-instance deployments the date-boundary at midnight server-local-time may not match the `baseline = DateTimeUtil.generateNow().toLocalDate()` returned for an INSERT firing at that moment — though ShedLock's 10m hold prevents the same instance from re-firing, multi-instance races on `baseline` calculation at midnight UTC offset boundaries could theoretically produce off-by-one partition boundaries." — evidence: PostgreSQLPartitionCreationJob.java:40 (`@Scheduled(cron = \"0 1 0 * * *\")` — no `zone =` attribute) + AbstractPartitionManager.java:23 (`DateTimeUtil.generateNow().toLocalDate()` — local-date, not Instant). — severity: LOW (theoretical; ShedLock's 10m window covers the common cases)

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`ActivityTablePartitionManager` is a `@Component` bean on the partition-lifecycle subsystem — not on the HTTP surface. Auth mode (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP | S2S`) does not apply directly. The bean is instantiated on every boot regardless of `auth.type`." — evidence: ActivityTablePartitionManager.java:9 (`@Component`, no `@RestController` / `@Conditional...` gating on auth.type) + PostgreSQLPartitionCreationJob.java:18-21 (also unconditional).
- ingestion_filter_relevance: "N/A — not HTTP. This bean does not participate in the `POST /ingestion/entities` request flow; it runs in the Spring scheduling context."
- authorization_assertions: []
- owner_scoping: "N/A — partition-lifecycle code, not data-scoped. The partition manager operates on a DDL surface (`CREATE TABLE ... PARTITION OF`), not on data rows; there is no caller-user context inside `createPartitionsIfNotExists`."
- data_exposure:
  - "Partition names (e.g. `activity_20260510_20260709`) are written to PostgreSQL system catalogs (`information_schema.tables`) — any DB role with `SELECT` on `information_schema` learns the partition cadence and the deployment's date range of activity coverage. This is a system-level fingerprint, not a user-facing data exposure." — evidence: PartitionServiceImpl.java:29-38 (the SELECT against `information_schema.tables`) + PartitionServiceImpl.java:61-62 (the partition-name format).
- known_security_gaps:
  - "**Partition creation requires CREATE TABLE privilege on `public` schema for the application's DB role** — the deployment doc does not surface this requirement. An operator running ODD against a managed Postgres with a least-privileged DB role (e.g. a role with INSERT/SELECT but no DDL) would fail partition creation at boot, log ERROR, and silently degrade — `activity` INSERTs would then fail when the existing partition window is exhausted. This is a deployment-pre-req documentation gap with security-policy implications (DBAs designing least-privilege roles need to know to grant CREATE)." — evidence: PartitionServiceImpl.java:55-69 (the CREATE TABLE DDL) + WebFetch /configuration-and-deployment/odd-platform (the canonical config page does not enumerate DB role privilege requirements for partitioning). — severity: MEDIUM
  - "**No audit log emitted for partition CREATE / DROP operations** — unlike data-mutation paths covered by `@ActivityLog`, schema-level DDL operations are silent. An operator investigating 'who created this partition' or 'when was this partition dropped' has no audit trail beyond the Spring `log.debug` line at AbstractPartitionManager.java:43-44 (debug level — not captured by default in production logging configuration)." — evidence: AbstractPartitionManager.java:43-44 (debug-only log) + the absence of any `@ActivityLog` / structured-audit emission in the partition package. — severity: LOW

## performance

- hot_paths:
  - "Boot-time `@PostConstruct` blocks application startup until the partition advisory lock is acquired and ALL partition managers complete. For an instance booting against a database where another instance holds lock 90, the new instance blocks at `leaderElectionManager.acquire` until lock release — startup latency is unbounded under contention." — evidence: PostgreSQLPartitionCreationJob.java:30-38 (the @PostConstruct + the synchronous `try (Connection ... acquire(activityLockId, false))` blocking call).
  - "Nightly cron at `00:01` local-server-time — runs ONCE per 24h per ShedLock-electable instance. The job holds `lockAtMostFor = 10m` (PostgreSQLPartitionCreationJob.java:41) — a 10-minute window during which no other instance can run this job; under normal operation each manager's CREATE completes in milliseconds, but the lock window is sized for slow DB-fsync scenarios." — evidence: PostgreSQLPartitionCreationJob.java:40-41 (cron + SchedulerLock with explicit 10m hold).
- throughput_characteristics:
  - "Single-shot per cycle — no batching, no streaming. Each manager's `createPartitionsIfNotExists` issues a small fixed number of CREATE TABLE statements (typically 0-1 per cycle, since the previous cycle covered the next-period window)."
  - "Synchronous JDBC — `Connection.prepareStatement.execute` for each CREATE; not reactive. The orchestrator holds a single Connection across all managers in the loop (PostgreSQLPartitionCreationJob.java:31, 44) — connection-pool impact is one connection-second per cycle."
- resource_allocation:
  - "Per-cycle CREATE TABLE PARTITION operations on Postgres take an `ACCESS EXCLUSIVE` lock on the parent `activity` table for the duration of the statement — this is a DDL lock that blocks all concurrent INSERTs against `activity` for the brief window of `CREATE TABLE ... PARTITION OF`. For Postgres 12+ this is a fast metadata-only operation; on heavily loaded systems with long-running transactions on `activity` the DDL can stall behind in-flight queries." — evidence: PartitionServiceImpl.java:60-66 (the `CREATE TABLE IF NOT EXISTS %s PARTITION OF %s` DDL).
  - "No batch CREATE — each partition is created in a separate prepared statement (PartitionServiceImpl.java:60-66). For first-boot scenarios where the `activity` table has zero existing partitions, the loop creates the initial `1` partition only (since `lastPartitionDate.isBefore(bufferDate)` becomes false after one iteration), so the cycle-time is bounded regardless of historical data volume."
- scaling_characteristics:
  - "**Postgres advisory lock id `90` is a global serialisation point** — the BOOT-time path holds this lock across all partition managers. If a future feature added a 3rd partition manager, it would serialise behind the activity + message managers at boot. The advisory-lock id `90` does not collide with the wal/notifications lock id (`100`, application.yml:177), the datacollaboration receive-event lock (`110`, application.yml:201), or the datacollaboration sender-message lock (`120`, application.yml:202) — but the four lock-id values are managed by convention, not by a central registry." — evidence: application.yml:177-202 (the four lock-ids assigned by hand) + PostgreSQLPartitionCreationJob.java:26-27.
  - "ShedLock's `lockAtLeastFor = 10m` guarantees that even if the partition job completes in milliseconds, the lock is held for 10 minutes — preventing other instances from re-running the cron prematurely. In a 10-instance deployment this means only one instance creates partitions per day; the other 9 attempt and skip on lock contention." — evidence: PostgreSQLPartitionCreationJob.java:41 (`@SchedulerLock(name = ..., lockAtLeastFor = \"10m\", lockAtMostFor = \"10m\")`).
- known_performance_gaps:
  - "**Boot-time partition initialisation blocks application readiness** — `@PostConstruct` runs before Spring marks the application context as ready; in a multi-instance deployment where a slow leader holds advisory lock 90, follower instances cannot reach the readiness probe until the lock releases. There is no async / background variant of the boot-time path." — evidence: PostgreSQLPartitionCreationJob.java:29-38. — severity: LOW (under normal operation lock acquisition is fast; only an issue under DB-side contention).
  - "**No metric / observability instrumentation on the partition lifecycle** — the manager emits `log.debug` on success (AbstractPartitionManager.java:43-44) and `log.error` on failure (PostgreSQLPartitionCreationJob.java:58-59); there is no Micrometer counter / timer / gauge for partition-creation success-rate, last-success-timestamp, or partition-count. An operator monitoring an ODD deployment has no metric to alert on 'partition creation has been failing silently for 30 days'." — evidence: AbstractPartitionManager.java:43-44 + PostgreSQLPartitionCreationJob.java:58-59 (debug + error logs only) + grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` (zero matches, observed pattern). — severity: MEDIUM
  - "**Unbounded growth of the `activity` table** (cross-references `bugs_limitations_corner_cases.[0]`): with no DROP path, partition-prune at query time still works (Postgres can skip empty partitions), but the planner's overhead grows linearly with the partition count. After 5 years of `partition-period=7` (narrower partitions for performance), the `activity` table accumulates ~260 partitions and the planner cost of resolving the partition-set for a 30-day query window grows." — evidence: PartitionServiceImpl.java:120-127 (`dropPartition` defined but unused by activity caller) + AbstractPartitionManager.java:14-51 (no DROP invocation) + concepts.yaml:362-373 (the activity-feed concept with no retention statement). — severity: LOW (only material on multi-year deployments)

## sources

- understanding ← ActivityTablePartitionManager.java:1-21 + AbstractPartitionManager.java:14-51 + PostgreSQLPartitionCreationJob.java:18-62 + application.yml:197-213
- concepts.entities.ActivityTablePartitionManager ← ActivityTablePartitionManager.java:10
- concepts.entities.AbstractPartitionManager ← AbstractPartitionManager.java:14
- concepts.entities.PartitionManager ← PartitionManager.java:9
- concepts.entities.PartitionService ← PartitionService.java:9
- concepts.entities.PostgreSQLPartitionCreationJob ← PostgreSQLPartitionCreationJob.java:21
- concepts.entities.TablePartition ← TablePartition.java:5
- concepts.entities.Tables.ACTIVITY ← ActivityTablePartitionManager.java:16 + generated Tables.java:91 (`public.activity`)
- concepts.invariants.[0] ← ActivityTablePartitionManager.java:11
- concepts.invariants.[1] ← AbstractPartitionManager.java:30,33-37
- concepts.invariants.[2] ← PostgreSQLPartitionCreationJob.java:26-27, 40-41
- concepts.invariants.[3] ← PostgreSQLPartitionCreationJob.java:57-60
- concepts.invariants.[4] ← AbstractPartitionManager.java:14-51 (no dropPartition) + PartitionService.java:21-25
- dependencies_semantic.requires-feature ← PartitionServiceImpl.java:1-148 + PostgreSQLPartitionCreationJob.java:22 + PostgreSQLLeaderElectionManager.java:17 + AbstractPartitionManager.java:9-10
- dependencies_semantic.requires-config.[0] ← ActivityTablePartitionManager.java:11 + application.yml:212-213
- dependencies_semantic.requires-config.[1] ← PostgreSQLPartitionCreationJob.java:26-27 + application.yml:197-198
- dependencies_semantic.requires-runtime ← PartitionServiceImpl.java:60-66 (CREATE TABLE PARTITION OF — Postgres 10+) + PostgreSQLPartitionCreationJob.java:29-30,40-41 (Spring @PostConstruct + @Scheduled + @SchedulerLock)
- dependencies_semantic.coupling ← MessageTablePartitionManager.java:17,19 + PartitionServiceImpl.java:72-80 + application.yml:197-203
- tests_coverage_semantic.gaps ← grep for `PartitionManager|PartitionService|PostgreSQLPartitionCreationJob` in `<odd-platform>/odd-platform-api/src/test/java` (zero matches verified)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (status 200, 2026-05-10) + verbatim quotes of the `odd.activity.partition-period` section
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-10) + verbatim quotes of the Configuration section
- docs_link_semantic.doc_drift_findings.[0] ← AbstractPartitionManager.java:14-51 (no DROP) + PartitionService.java:21-25 (DROP exists but unused) + activity-feed-page Configuration section live quote
- docs_link_semantic.doc_drift_findings.[1] ← AbstractPartitionManager.java:35 (`* 2L`) + odd-platform page live quote ('default creates a new partition every 30 days')
- docs_link_semantic.doc_drift_findings.[2] ← PostgreSQLPartitionCreationJob.java:26 (no `:default`) + WebFetch /configuration-and-deployment/odd-platform full key list (partition.advisory-lock-id absent)
- docs_link_semantic.doc_drift_findings.[3] ← PostgreSQLPartitionCreationJob.java:57-60 (silent catch) + WebFetch /configuration-and-deployment/odd-platform (no failure-mode discussion)
- implicit_adrs.[0] ← AbstractPartitionManager.java:30, 33-37
- implicit_adrs.[1] ← PostgreSQLPartitionCreationJob.java:31, 40-43
- implicit_adrs.[2] ← PostgreSQLPartitionCreationJob.java:22 + MessageTablePartitionManager.java:17 + ActivityTablePartitionManager.java:9
- implicit_adrs.[3] ← PostgreSQLPartitionCreationJob.java:53-60
- bugs_limitations_corner_cases.[0] ← AbstractPartitionManager.java:14-51 + PartitionService.java:21-25 + WebFetch /features/active-platform-features/activity-feed#configuration
- bugs_limitations_corner_cases.[1] ← ActivityTablePartitionManager.java:11 + AbstractPartitionManager.java:30, 33-37
- bugs_limitations_corner_cases.[2] ← PostgreSQLPartitionCreationJob.java:53-60 + AbstractPartitionManager.java:48-50
- bugs_limitations_corner_cases.[3] ← PartitionServiceImpl.java:20, 41 + ActivityTablePartitionManager.java:16 + generated Tables.java:91
- bugs_limitations_corner_cases.[4] ← PartitionServiceImpl.java:72-80, 42
- bugs_limitations_corner_cases.[5] ← PostgreSQLPartitionCreationJob.java:26 + application.yml:197-198 + WebFetch /configuration-and-deployment/odd-platform key list
- bugs_limitations_corner_cases.[6] ← PostgreSQLPartitionCreationJob.java:40 + AbstractPartitionManager.java:23
- security.auth_mode_relevance ← ActivityTablePartitionManager.java:9 + PostgreSQLPartitionCreationJob.java:18-21
- security.data_exposure ← PartitionServiceImpl.java:29-38, 61-62
- security.known_security_gaps.[0] ← PartitionServiceImpl.java:55-69 + WebFetch /configuration-and-deployment/odd-platform
- security.known_security_gaps.[1] ← AbstractPartitionManager.java:43-44 + grep partition package for @ActivityLog (zero matches)
- performance.hot_paths.[0] ← PostgreSQLPartitionCreationJob.java:30-38
- performance.hot_paths.[1] ← PostgreSQLPartitionCreationJob.java:40-41
- performance.throughput_characteristics ← PostgreSQLPartitionCreationJob.java:31, 44 + PartitionServiceImpl.java:60-66
- performance.resource_allocation ← PartitionServiceImpl.java:60-66 + AbstractPartitionManager.java:39-47
- performance.scaling_characteristics ← PostgreSQLPartitionCreationJob.java:26-27, 41 + application.yml:177, 197-202
- performance.known_performance_gaps.[0] ← PostgreSQLPartitionCreationJob.java:29-38
- performance.known_performance_gaps.[1] ← AbstractPartitionManager.java:43-44 + PostgreSQLPartitionCreationJob.java:58-59 + grep for Micrometer types in partition package (zero matches)
- performance.known_performance_gaps.[2] ← PartitionServiceImpl.java:120-127 + AbstractPartitionManager.java:14-51 + concepts.yaml:362-373

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: MEDIUM
- performance: MEDIUM

## Maintainer notes

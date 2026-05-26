## STRENGTHENS — SchedulingConfiguration config-class sidecar provides the PRIMARY SOURCE confirming the session-housekeeping no-SchedulerLock asymmetry in batch ZK

DOC-GAP-227 (PostgreSQL session housekeeping `@Scheduled` job has NO leader-election guard) was originally surfaced by the SessionConfiguration sidecar (batch X). Batch ZK refreshes the framing via the **SchedulingConfiguration sidecar** — the class that declares `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` and the `LockProvider` bean — and confirms that the platform's scheduling-lock infrastructure is in place but the session-housekeeping handler does NOT opt in.

### Added surfaced_by (new sidecar cited)

- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[PostgreSQLSessionHousekeepingJobHandler has @Scheduled but NO @SchedulerLock]` (LOW per sidecar — verbatim: "PostgreSQLSessionHousekeepingJobHandler.java:13-18 declares `@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)` and `deleteExpiredSessions()` — but the class is missing the `@SchedulerLock` annotation that the other three `@Scheduled` methods (HousekeepingJobManager, DataEntityStatusSwitchJob, PostgreSQLPartitionCreationJob) all have. The `defaultLockAtMostFor = \"1h\"` at SchedulingConfiguration.java:14 does NOT apply because `defaultLockAtMostFor` is the default for `@SchedulerLock` that OMITS its own `lockAtMostFor` — it is NOT an implicit lock for bare `@Scheduled`. Result: a 5-replica deployment runs the expired-session purge 5 times per hour, not once.")
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:concepts.invariants[defaultLockAtMostFor]` — **NEW STRUCTURAL CLARIFICATION**: "`defaultLockAtMostFor = \"1h\"` applies ONLY to `@SchedulerLock`-annotated methods that omit their own `lockAtMostFor`. It does NOT provide automatic locking to bare `@Scheduled` methods." This is the canonical structural explanation of WHY the session-housekeeping handler runs unlocked despite the platform-level @EnableSchedulerLock(defaultLockAtMostFor=1h).
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:dependencies_semantic.coupling.[Asymmetric coupling with session-housekeeping]` — **NEW STRUCTURAL COUPLING**: "session-housekeeping DEPENDS on `@EnableScheduling` (otherwise it would not fire), but DOES NOT use `@EnableSchedulerLock`. Result: in a multi-replica deployment, EVERY replica runs the expired-session purge every hour — but since the job issues idempotent DELETE-by-expired-timestamp ... the races are operationally harmless (delete-a-nonexistent-row is no-op). The architectural inconsistency is real but not currently load-bearing."
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:security.known_security_gaps[No SchedulerLock on session-housekeeping job]` (LOW per sidecar — re-confirmation at the security framing).

### New evidence (supplementary)

- **The platform's lock infrastructure IS in place**: SchedulingConfiguration declares `@EnableSchedulerLock` + the `LockProvider` bean (using `usingDbTime` for clock-skew safety). The OTHER THREE @Scheduled jobs (housekeeping, status-switch, partition-creation) all use `@SchedulerLock` with explicit timing attributes. The session-housekeeping handler is the SOLE outlier.
- **The fix cost is minimal**: per sidecar `bugs_limitations_corner_cases`: "Suggested fix: add `@SchedulerLock(name = \"sessionHousekeepingJob\", lockAtLeastFor = \"30m\", lockAtMostFor = \"55m\")` to match the convention." One-line annotation addition.
- **WebFetch re-verification 2026-05-26**: per SchedulingConfiguration sidecar `docs_link_semantic.inferred_docs[0]` — `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` status **200**. The live doc page documents "Expired-session cleanup runs hourly and is **not configurable**" but does NOT mention the multi-replica behaviour. The doc-side fix proposed in DOC-GAP-227 (the "Multi-replica housekeeping behaviour" subsection) remains the primary doc action.
- **Cross-link to DOC-GAP-316 NEW**: the session-housekeeping no-SchedulerLock is one dimension of the broader scheduling-subsystem operational gap cluster (single-thread default + missing lock + Java-vs-YAML default). DOC-GAP-316 is the new comprehensive scheduling-subsystem finding.

### Severity update

Severity remains **MEDIUM** — primary-source re-confirmation at the SchedulingConfiguration platform-level vantage strengthens the structural framing without changing the severity class.

---

**Batch ZK contribution**: 1 NEW PRIMARY SOURCE at the scheduling-platform layer (SchedulingConfiguration sidecar); structural clarification of WHY the platform-level `defaultLockAtMostFor` doesn't apply to bare `@Scheduled`; coverage 1 → 2 sidecars; evidence chain reinforced; severity unchanged (MEDIUM); cross-link to DOC-GAP-316 NEW for the broader scheduling-subsystem cluster.

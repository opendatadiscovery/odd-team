## REFACTOR-700 — `PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions` declares `@Scheduled(fixedRate = 1h)` but is MISSING `@SchedulerLock` — runs on every platform replica simultaneously every hour, violating the platform-wide "every `@Scheduled` is paired with `@SchedulerLock`" convention codified by ADR-CANDIDATE-242

**Severity**: LOW
**Category**: missing-lock (convention violation; operationally harmless today due to idempotent DELETE-by-timestamp)
**Pillars affected**: [P-08 Management & Administration, P-09 Security & Access Control]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[1]` (LOW severity) — "**`PostgreSQLSessionHousekeepingJobHandler` has `@Scheduled` but NO `@SchedulerLock` — runs on every replica simultaneously**. PostgreSQLSessionHousekeepingJobHandler.java:13-18 declares `@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)` and `deleteExpiredSessions()` — but the class is missing the `@SchedulerLock` annotation that the other three `@Scheduled` methods (HousekeepingJobManager, DataEntityStatusSwitchJob, PostgreSQLPartitionCreationJob) all have. The `defaultLockAtMostFor = \"1h\"` at SchedulingConfiguration.java:14 does NOT apply because `defaultLockAtMostFor` is the default for `@SchedulerLock` that OMITS its own `lockAtMostFor` — it is NOT an implicit lock for bare `@Scheduled`."
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:security.known_security_gaps.[0]` (LOW severity) — same finding framed from the security angle (architectural inconsistency that would matter if session-purge ever became non-idempotent).

**Description**: `PostgreSQLSessionHousekeepingJobHandler.java:13-18` declares:
```java
@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)
public void deleteExpiredSessions() {
    sessionHousekeepingJob.deleteExpiredSessions().block();
}
```

The annotation is `@Scheduled` ONLY — no `@SchedulerLock` paired with it. Compare to the platform's three OTHER `@Scheduled` methods, all of which DO pair with `@SchedulerLock`:

| Job | `@Scheduled` | `@SchedulerLock` |
|---|---|---|
| HousekeepingJobManager.runHousekeepingJobs | `fixedRate=15min` | `name="housekeepingJob", lockAtLeastFor="14m", lockAtMostFor="14m"` |
| DataEntityStatusSwitchJob.run | `fixedRate=10min` | `name="statusSwitchJob", lockAtLeastFor="9m", lockAtMostFor="9m"` |
| PostgreSQLPartitionCreationJob.run | `cron="0 1 0 * * *"` | `name="partitionCreationJob", lockAtLeastFor="10m", lockAtMostFor="10m"` |
| **PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions** | `fixedRate=1h` | **NONE** |

The `defaultLockAtMostFor = "1h"` value on `@EnableSchedulerLock` at `SchedulingConfiguration.java:14` does **NOT** rescue this bean. `defaultLockAtMostFor` is the default for `@SchedulerLock` annotations that OMIT their own `lockAtMostFor` attribute — it is NOT an implicit lock for bare `@Scheduled` methods. ShedLock's AOP advisor (`MethodProxyScheduledLockAdvisor`) only intercepts methods that ARE `@SchedulerLock`-annotated; the session-housekeeping method has no annotation to intercept.

**Result**: in a multi-replica deployment, EVERY replica runs `deleteExpiredSessions()` every hour. With 5 replicas, the expired-session purge runs 5 times per hour, not once.

**Why this is operationally harmless TODAY**: the underlying `sessionHousekeepingJob.deleteExpiredSessions()` is a `Mono<Integer>` returning the deleted-row count from a `DELETE FROM session WHERE expires_at <= now()` query. The DELETE-by-expired-timestamp is **idempotent** — delete-a-nonexistent-row is a no-op. Multiple concurrent invocations race against the same expired-row set: the first replica's DELETE removes the rows, subsequent replicas' DELETEs match zero rows. PostgreSQL serialises the writes via row-level locks. No data corruption.

**Why this is an architectural inconsistency worth surfacing**:
1. **Violates the colocation-enforced convention codified by ADR-CANDIDATE-242 NEW**: scheduling enablement and ShedLock-aware locking are co-located in a single `SchedulingConfiguration` to make "scheduling without locking" structurally visible. The session-housekeeping handler IS scheduling-without-locking — it just happens to be operationally safe because the work is idempotent.
2. **Latent risk if the implementation evolves**: if a future maintainer adds an audit event on session purge (e.g. `auditService.log("session-purge", deletedCount)`), every replica emits a duplicate event per hour. If the implementation grows non-idempotent work (e.g. writing to a metrics counter, calling an external API, sending an alert), every replica duplicates the work.
3. **The platform-level `@EnableSchedulerLock` annotation is MISLEADING**: its name implies "all scheduled methods are locked", but the actual mechanic is opt-in per `@SchedulerLock` annotation. A reviewer of `SchedulingConfiguration.java` might assume the platform-level annotation suffices; the convention violation is invisible at the platform configuration layer.

**The convention violator's framing**: the docs page (WebFetched 2026-05-26) describes the expired-session cleanup as "not configurable" (which is true — there's no operator-tunable for the cadence or behaviour) but does NOT explain that it runs on every replica simultaneously every hour. An operator running 5 platform replicas does not learn from the docs that they get 5x the session-purge attempts per hour.

**Primary source citations**:
- PostgreSQLSessionHousekeepingJobHandler.java:13-18 (the `@Scheduled` without `@SchedulerLock`)
- HousekeepingJobManager.java:26, DataEntityStatusSwitchJob.java:22, PostgreSQLPartitionCreationJob.java:41 (the three that DO have `@SchedulerLock`)
- SchedulingConfiguration.java:14 (the `defaultLockAtMostFor = "1h"` that does NOT apply because the annotation is absent)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-242 NEW (scheduling-and-locking colocation) — the platform's structural enforcement that every `@Scheduled` should pair with `@SchedulerLock`. This REFACTOR is the ONE current violation of that convention; the violation is operationally harmless but structurally inconsistent.

**Proposed remedy**:
- Add `@SchedulerLock(name = "sessionHousekeepingJob", lockAtLeastFor = "30m", lockAtMostFor = "55m")` to PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions to match the convention. `lockAtMostFor = "55m"` is safely under the 60-minute cadence, providing a 5-minute slack window for shutdown / restart.
- Add an integration-test that asserts the `shedlock` table has a row with `name = "sessionHousekeepingJob"` after the first cycle completes.

**Severity rationale**: LOW — operationally harmless today (idempotent DELETE); convention violation; latent risk if the session-purge implementation ever became non-idempotent. The cost of the fix is one annotation + integration test.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` (with REFACTOR-698 / 699 / 701 / 702 / 703 / 704). Single-PR scope.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-242 (codifies the convention this REFACTOR violates), ADR-CANDIDATE-240 (the `.usingDbTime()` mechanism would extend safely to this method once `@SchedulerLock` is added).
- SUPERSEDES: none.
- CONFLICTS: none.

---

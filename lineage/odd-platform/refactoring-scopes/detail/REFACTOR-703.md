## REFACTOR-703 — No observability on ShedLock acquisition / release / contention; `SchedulingConfiguration.lockProvider` is uninstrumented; an operator answering "is replica B failing to acquire the housekeeping lock because replica A holds it for 14 minutes?" must SQL the `shedlock` PG table directly

**Severity**: LOW
**Category**: missing-observability
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[5]` (LOW severity) — "**No observability on lock acquisition / contention**. SchedulingConfiguration provides no Micrometer counter for `shedlock_acquisition_success_total` / `shedlock_acquisition_failure_total`, no histogram for lock-hold duration, no log emission on lock-contention events. An operator answering 'is replica B failing to acquire the housekeeping lock because replica A is holding it for the full 14 minutes?' has no observable surface — must inspect the `shedlock` PG table via SQL."
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:security.known_security_gaps.[1]` (LOW severity) — "**No audit log of LockProvider activity**. SchedulingConfiguration provides no Micrometer counter, no structured audit event, no log emission on lock-acquisition success / failure / contention. A malicious actor with PG write access could manipulate the `shedlock` table directly (insert a forever-held lock_until far in the future) to prevent housekeeping from running on any replica — silently disabling data-retention. There is no detection mechanism."

**Description**: `SchedulingConfiguration.java:17-25` constructs the `JdbcTemplateLockProvider` bean with `.usingDbTime()` (per ADR-CANDIDATE-240) but no instrumentation:
```java
@Bean
public LockProvider lockProvider(final DataSource dataSource) {
    return new JdbcTemplateLockProvider(
        JdbcTemplateLockProvider.Configuration.builder()
            .withJdbcTemplate(new JdbcTemplate(dataSource))
            .usingDbTime()
            .build()
    );
}
```

The returned `LockProvider` is a raw ShedLock library type. ShedLock's `LockProvider` interface has two methods: `lock(LockConfiguration)` returns `Optional<SimpleLock>` (`Optional.empty()` when contention prevents acquisition). The platform's wrapping does NOT instrument either path:

- **No Micrometer counters**: no `shedlock_acquisition_success_total{lock_name=...}`, no `shedlock_acquisition_failure_total{lock_name=...}`. An operator scraping `/actuator/prometheus` cannot answer "how often does the housekeeping lock fail to acquire on this replica?"
- **No Micrometer histograms**: no `shedlock_hold_duration_seconds{lock_name=...}`. An operator cannot answer "how long does each housekeeping cycle actually hold the lock for? Is it close to the `lockAtMostFor` ceiling?"
- **No structured audit events**: no `audit.shedlock.acquired` / `audit.shedlock.released` events. A SOC-2 compliance review asking "show me the audit trail of housekeeping-lock acquisitions over the last quarter" cannot be satisfied.
- **No log emissions on contention**: ShedLock's own internal logs are at `DEBUG` level by default; the platform does not elevate them or wrap them. A `kubectl logs` operator cannot tell whether a missing housekeeping cycle is due to contention vs. JVM-crash vs. application bug.

**Operator-impact scenarios**:

1. **Slow housekeeping cycle investigation**: housekeeping cadence drifts from 15-min to 25-min. The operator wants to know: is the DataEntityHousekeepingJob cascade taking 14 minutes (hitting `lockAtMostFor`)? Without lock-hold-duration histograms, they must SQL `SELECT locked_at, lock_until, now() FROM shedlock WHERE name = 'housekeepingJob'` mid-cycle to estimate. No retention; no historical view.

2. **Multi-replica race verification**: under a load test with 5 replicas, the operator wants to verify that exactly ONE replica acquires the housekeeping lock per 15-min window (the platform's correctness contract per ADR-CANDIDATE-240). Without acquisition counters per replica, they cannot count successes vs. failures across the cluster.

3. **Malicious tampering detection**: the security gap framed in `security.known_security_gaps.[1]`. A PG-write-access adversary inserts `INSERT INTO shedlock (name, lock_until, locked_at, locked_by) VALUES ('housekeepingJob', now() + interval '100 years', now(), 'attacker')` — every replica's `LockProvider.lock(...)` returns `Optional.empty()` for that lock name, silently disabling data retention. Without acquisition counters or audit events, the only detection mechanism is the absence of housekeeping side effects (which itself takes hours / days to notice — by which time the alert / search-facet / soft-deleted-entity tables have grown unbounded). The threat surface is bounded (requires DB write access — same as direct data deletion via SQL), but the silent-disabling property is the concerning class.

**Primary source citations**:
- SchedulingConfiguration.java:17-25 (no Micrometer instrumentation on the LockProvider Bean — raw `new JdbcTemplateLockProvider(...)` returned)
- `grep 'Counter\|Meter\|Gauge\|MeterRegistry' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config` returns no scheduling-related matches
- ShedLock library — `LockProvider` interface has no built-in metrics; instrumentation must be added by the consumer (decorator pattern)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-240 (`.usingDbTime()`) — the correctness contract for multi-replica coordination is established but UNINSTRUMENTED. Verifying the contract in production requires SQL queries against the `shedlock` table, not metric scraping.

**Proposed remedy**: Wrap the LockProvider with a Micrometer-instrumented decorator:
```java
@Bean
public LockProvider lockProvider(final DataSource dataSource, MeterRegistry registry) {
    LockProvider underlying = new JdbcTemplateLockProvider(...);
    return new InstrumentedLockProvider(underlying, registry);
}
```

Where `InstrumentedLockProvider` increments `shedlock.acquisition.success{lock_name=...}` / `shedlock.acquisition.failure{lock_name=...}` counters and records `shedlock.hold.duration.seconds{lock_name=...}` histogram on lock release. Total cost: ~50 lines for the decorator + boot-time test that asserts metric names exist.

Optional second pass: emit structured audit events on acquisition success / release / contention into the platform's existing audit infrastructure (the activity-feed if applicable, or a dedicated audit log) for SOC-2-class compliance review.

**Severity rationale**: LOW — operationally inconvenient but not a correctness defect. The fix has clear value for capacity-planning / contention-debugging / compliance-review surfaces.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` (with REFACTOR-698 / 699 / 700 / 701 / 702 / 704).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-240 (the correctness contract this REFACTOR makes observable).
- SUPERSEDES: none.
- CONFLICTS: none.

---

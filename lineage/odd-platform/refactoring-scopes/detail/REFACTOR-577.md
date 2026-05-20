## REFACTOR-577 — `ActivityEmptyPartitionsHousekeepingJob` emits NO Micrometer metrics, NO Counter / Timer / Gauge — operators cannot answer "how many partitions did this drop yesterday" / "is this job spending 10ms or 10s per cycle" / "is housekeeping keeping up?" without manual SQL queries

**Severity**: MEDIUM (production-operability gap)
**Category**: observability
**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:bugs_limitations_corner_cases[4]` (CANARY HEADLINE — "**No metric / observability** — the job emits `log.debug` lines only at DEBUG level (not enabled by default per `org.opendatadiscovery.oddplatform.housekeeping: info` in application.yml:254). An operator monitoring activity-table size has no Prometheus counter (`housekeeping_partitions_dropped_total{table=...}`), no last-drop-timestamp gauge, no eligible-partitions count. The only way to determine if this job ever drops anything is to enable DEBUG logging or to manually `\\dt+ activity_*` against Postgres" — MEDIUM)
- `ActivityEmptyPartitionsHousekeepingJob.md:performance.known_performance_gaps[2]` ("No metric on time-spent-in-job — operators cannot answer 'is this job spending 10ms or 10s per cycle?' without DEBUG logging on the housekeeping package")
- `EmptyPartitionsHousekeepingJob.java:25, 29` (the only output — `log.debug("Dropping {} partition")` and `log.debug("Dropped {} partitions for table {}")`)
- `application.yml:254` (`org.opendatadiscovery.oddplatform.housekeeping: info` — DEBUG suppressed by default)
- Grep `partition` + `housekeeping` packages for `MeterRegistry|Counter|Timer|Gauge` — zero matches verified

**Description**: `ActivityEmptyPartitionsHousekeepingJob` (via parent `EmptyPartitionsHousekeepingJob.doHousekeeping`) has TWO observability touch-points:
- `log.debug("Dropping {} partition", partition)` (line 25).
- `log.debug("Dropped {} partitions for table {}", droppedCount, targetTable)` (line 29).

Both are at DEBUG level. The default log-config in `application.yml:254` sets:

```yaml
logging.level:
  org.opendatadiscovery.oddplatform.housekeeping: info
```

DEBUG-level logs are SUPPRESSED by default. Operators running the platform have ZERO visibility into:
- How many partitions were eligible for drop per cycle.
- How many partitions actually dropped per cycle (the steady-state value is 0 per REFACTOR-085 — but operators can't confirm).
- How long per cycle the job spends scanning empty partitions (REFACTOR-564's hidden seq-scan cost).
- Cumulative count over deployment lifetime.
- Last-drop-timestamp (when did housekeeping last actually clean anything?).
- Per-partition scan time (which partition is slowest?).

**The structural absence**: no `MeterRegistry` injected, no `Counter`, no `Timer`, no `Gauge` anywhere in the housekeeping + partition packages (grep verified zero matches).

**Operator-visible consequences**:

1. **Operability gap**: an operator running ODD in production cannot answer "is housekeeping working" without manual SQL queries (`\dt+ activity_*` to count partitions; manual cross-reference with retention expectations).
2. **Cost visibility gap**: the per-cycle cost of REFACTOR-564 (count(*) seq-scan over populated partitions) is invisible — operators don't know they're paying that cost.
3. **Alert visibility gap**: there's no alarm condition. A failing housekeeping cycle (per REFACTOR-557 race, REFACTOR-145 transactional failure, REFACTOR-086 silent-fail-swallow) surfaces ONLY as a log.error line — no Prometheus alert, no Grafana panel.

**The structural fix**: instrument the job with Micrometer metrics.

**Cross-cutting context**: This is the **observability-absence defect class** affecting MULTIPLE housekeeping jobs:
- REFACTOR-089 (no Micrometer instrumentation on the partition lifecycle).
- REFACTOR-143 (no structured audit log or Micrometer on housekeeping deletions — three TTL jobs).
- REFACTOR-148 (no backlog metric — invisible bloat).
- This REFACTOR-577 (no metrics on the partition-drop housekeeping).
- REFACTOR-244 (no method-level observability across reactive-repository batch).

The collective fix is a coordinated observability sprint adding Micrometer instrumentation to the housekeeping subsystem.

**Primary source citations**:
- `EmptyPartitionsHousekeepingJob.java:25, 29` (the only DEBUG log lines)
- `application.yml:254` (DEBUG suppressed)
- `ActivityEmptyPartitionsHousekeepingJob.java:1-17` (verified no @Timed, no MeterRegistry)
- `HousekeepingJobManager.java:25-26` (the orchestrator — no metric wrapping either)
- Grep `MeterRegistry|Counter|Timer|Gauge` in `housekeeping/+partition/` — zero matches

**Existing-ADR-or-implied-prescription**: NONE. The observability absence is consistent with the platform's general posture (per REFACTOR-042 — no `@Timed`/Micrometer at DataEntityController boundary). The platform has NOT made Micrometer a project commitment.

**Proposed remedy**:

Author a `HousekeepingMetrics` bean centralising the housekeeping subsystem's Micrometer instrumentation:

```java
@Component
public class HousekeepingMetrics {
    private final MeterRegistry registry;
    private final Counter partitionsDropped;
    private final Counter partitionsScanned;
    private final Timer perCycleTimer;
    private final Timer perPartitionScanTimer;
    private final Gauge lastDropTimestamp;
    
    public HousekeepingMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.partitionsDropped = Counter.builder("housekeeping_partitions_dropped_total")
            .description("Number of empty past partitions dropped")
            .tag("table", "activity")
            .register(registry);
        this.partitionsScanned = Counter.builder("housekeeping_partitions_scanned_total")
            .description("Number of past partitions checked for emptiness")
            .tag("table", "activity")
            .register(registry);
        this.perCycleTimer = Timer.builder("housekeeping_cycle_duration")
            .description("Total time spent in a housekeeping cycle")
            .tag("job", "ActivityEmptyPartitions")
            .register(registry);
        // ... etc
    }
    
    public void recordDrop(String partitionName, Duration duration) { ... }
    public void recordCycle(Duration duration) { ... }
}
```

Wire into `EmptyPartitionsHousekeepingJob.doHousekeeping` to record per-partition and per-cycle metrics.

**Severity rationale**: MEDIUM — operability gap. Severity is bounded by:
- No production correctness defect today.
- The fix is incremental (add Micrometer instrumentation; no behaviour change).
- The blast radius is the entire housekeeping subsystem — the fix benefits ALL 5 jobs.
- Pair with REFACTOR-557 (race) for the highest-leverage activity-partition lifecycle hardening sprint.

**Suggested backlog grouping**: `PERF-NNN housekeeping observability sprint`. Pair with REFACTOR-089 (partition lifecycle metrics), REFACTOR-143 (TTL job audit log), REFACTOR-148 (backlog metric), REFACTOR-244 (reactive-repository observability). The collective fix is a single coordinated observability project.

---

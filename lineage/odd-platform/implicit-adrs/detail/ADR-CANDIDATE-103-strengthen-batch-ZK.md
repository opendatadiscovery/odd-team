## STRENGTHENS ADR-CANDIDATE-103 — SchedulingConfiguration (batch ZK, 2026-05-26)

**Primary-source FOUNDATION evidence**. Batch K (HousekeepingJobManager sidecar) framed ADR-103 from the housekeeping ORCHESTRATOR side. Batch ZK adds the FOUNDATION view: both orchestrators inherit `@EnableScheduling` + `@EnableSchedulerLock` from `SchedulingConfiguration.java:12-15` — i.e. the architectural split exists on TOP of a single shared scheduling-and-locking enablement. The two orchestrators are independent at the orchestrator-class level BUT share the same scheduling-import-and-lock-arbitration backbone — confirming the "two independent orchestrators with a shared structural foundation" framing of ADR-103.

**New batch-ZK evidence**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:dependencies_semantic.coupling[0]` (HIGH): "**Foundation for the entire housekeeping subsystem**. `HousekeepingJobManager` (`@Scheduled(fixedRate = 15, timeUnit = MINUTES)` + `@SchedulerLock(name = \"housekeepingJob\", lockAtLeastFor = \"14m\", lockAtMostFor = \"14m\")` at HousekeepingJobManager.java:25-26) depends on BOTH `@EnableScheduling` (otherwise the fixedRate has no effect) AND `@EnableSchedulerLock` (otherwise the multi-replica coordination claim collapses)."
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:dependencies_semantic.coupling[1]` (HIGH): "**Foundation for the partition-creation subsystem**. `PostgreSQLPartitionCreationJob.run()` at PostgreSQLPartitionCreationJob.java:40-51 — daily cron at 00:01 + `@SchedulerLock(\"partitionCreationJob\", 10m, 10m)`. Without this configuration, partitions would attempt to be created on every replica simultaneously, leading to PG advisory-lock contention or duplicate CREATE TABLE attempts."

**Implication for ADR-103**: the orchestrator split codified by ADR-103 is BUILT ON the shared single `SchedulingConfiguration` foundation. This dependency-direction is significant: a future refactor that splits scheduling enablement across multiple `@Configuration` classes (one for housekeeping, one for partition) would break the symmetry — both orchestrators currently rely on the same `LockProvider` bean (`SchedulingConfiguration.java:17-25`). The architectural separation is at the ORCHESTRATOR layer, NOT at the scheduling-foundation layer.

**Cross-batch ADR chain**:
- batch K (HousekeepingJobManager): orchestrator-side framing — two independent orchestrators with two distinct ShedLock names
- batch ZK (SchedulingConfiguration): FOUNDATION-side framing — both orchestrators share `@EnableScheduling` + `@EnableSchedulerLock` + the LockProvider bean from a single 26-line file
- batch ZK adds the ADR-CANDIDATE-240/241/242/243 family — the four FOUNDATION-level decisions UNDER ADR-103

**Severity unchanged**: MEDIUM (deployment-architecture decision; affects how the maintainer extends platform-internal scheduled work in the future).

---

## ADR-CANDIDATE-103 — Housekeeping orchestrator separation from partition-creation orchestrator — two parallel Spring-scheduled orchestrators (`HousekeepingJobManager` vs `PostgreSQLPartitionCreationJob`) with distinct package homes, distinct ShedLock names, distinct cadences, distinct fan-out patterns

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-08-management-administration]
**Support**: surfaced by 1 sidecar (`HousekeepingJobManager`) — primary-source; structural orchestration-architecture decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:implicit_adrs.[4]` (HIGH confidence) — "Housekeeping orchestrator separation from partition-creation orchestrator — the platform has TWO Spring-scheduled orchestrators for periodic platform-internal work: `HousekeepingJobManager` (this class, 15-min cleanup) and `PostgreSQLPartitionCreationJob` (partition/PostgreSQLPartitionCreationJob.java:21, daily partition CREATE at 00:01). The decision NOT to fold partition-creation into housekeeping (or vice versa) is visible in the package layout (`housekeeping/` vs `partition/`)."

**Decision statement**: The platform's platform-internal operational infrastructure is intentionally split across TWO Spring-scheduled orchestrators: (a) `HousekeepingJobManager` in `housekeeping/` package, fixedRate=15min, ShedLock name `housekeepingJob`, fans out to `List<HousekeepingJob>` (5 jobs); (b) `PostgreSQLPartitionCreationJob` in `partition/` package, daily cron `0 1 0 * * ?`, ShedLock name `partitionCreationJob`, fans out to `List<PartitionManager>`. The two share NO advisory lock id, NO scheduling configuration overlap (both inherit `@EnableScheduling` + `@EnableSchedulerLock` from `SchedulingConfiguration.java:13-14` only), and NO shared bean injection. The architectural posture: schedule-driven CLEANUP (TTL-driven hard-delete of past-retention rows) and structural LIFECYCLE CREATION (forward-coverage partition allocation) are independent concerns with independent operational profiles — operators may want to disable one without disabling the other, and the failure modes are unrelated (a failed cleanup leaves rows; a failed partition-create leaves the next day's writes blocked). The decision is reinforced by the integration-test profile flipping `housekeeping.enabled: false` without flipping any partition-creation flag (`application-integration-test.yml:7-8`).

**Wisdom test**: PASS. (1) Deliberate (two parallel orchestrator classes with two distinct package homes, two distinct ShedLock names, two distinct lifecycle anchors — the package split + naming consistency IS the explicit decision); (2) Structural impact (every future schedule-driven operational subsystem must choose between extending one of these orchestrators or minting a third — the architectural slot is established); (3) Folding the two into one (e.g. `OperationalScheduledJobs` aggregating both) would be a STRUCTURAL refactor.

**Evidence**:
- HousekeepingJobManager.md says: "Conceptual sibling with `PostgreSQLPartitionCreationJob` (the partition-CREATION cron orchestrator at `partition/PostgreSQLPartitionCreationJob.java:21`). Both inject `PGConnectionFactory` and both fan out to discovered beans (`List<PartitionManager>` vs `List<HousekeepingJob>`); the partition CREATION job runs nightly at `00:01` with a 10-minute ShedLock named `partitionCreationJob`. Housekeeping (this class) and partition-creation share NO advisory lock id — they coordinate via independent ShedLock names."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-045** (housekeeping-vs-partition separation — the maintainer's batch-D framing) — strengthens that framing with the primary-source orchestrator-class evidence. Composes with **ADR-CANDIDATE-046** (housekeeping opt-out) and **ADR-CANDIDATE-028** (partition lifecycle 2× forward-coverage). Composes with **ADR-CANDIDATE-101** (per-job failure isolation) and **ADR-CANDIDATE-102** (shared-connection-per-cycle) as the housekeeping orchestrator's internal structure.

**Cross-link gaps**:
- REFACTOR-183 (batch D) — no central advisory-lock-ID registry; the two orchestrators rely on distinct ShedLock names but the underlying advisory-lock id space is shared with Notifications (lock-id 100), DataCollab (110, 120), and others.
- REFACTOR-271 NEW — no housekeeping-job ordering contract (List<HousekeepingJob> injection order is Spring-discovered, not explicitly declared).

**Proposed action**: Promote to `adrs/drafts/operational-infrastructure-orchestrator-split.md` (new ADR). Document the package split + ShedLock-name uniqueness + cadence separation explicitly. Cross-link with ADR-CANDIDATE-045 (the maintainer's earlier framing of the same decision), ADR-CANDIDATE-046 (housekeeping opt-out), and ADR-CANDIDATE-028 (partition forward-coverage).

**Severity rationale**: MEDIUM — operational-architecture decision; affects how the maintainer extends platform-internal scheduled work in the future. The decision is the architectural slot for the "Platform-Internal Operational Infrastructure" canonicalisation candidate in `system-mission.md`.

---

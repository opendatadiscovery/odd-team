## ADR-CANDIDATE-101 — Per-job failure isolation in HousekeepingJobManager — one failed job does NOT abort the cycle; inner try/catch catches `Exception` and the outer loop continues to the next job

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-08-management-administration, P-04-data-quality, P-07-active-platform-features]
**Support**: surfaced by 1 sidecar (`HousekeepingJobManager`) — primary-source; structural failure-isolation decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:implicit_adrs.[0]` (HIGH confidence) — "Per-job failure isolation — one failed job does NOT abort the cycle. The inner try/catch at HousekeepingJobManager.java:41-47 catches `Exception` (the broadest checked-or-unchecked exception type) and logs at ERROR, then the outer loop (lines 33-35) continues to the next job. This is an intentional decision."

**Decision statement**: `HousekeepingJobManager.runHousekeepingJob` (lines 41-47) wraps each `housekeepingJob.doHousekeeping(connection)` call in `try { ... } catch (Exception e) { log.error(\"Error while running a housekeeping job\", e); }`. The catch is the BROADEST possible Java exception type (covering RuntimeExceptions, checked SQLExceptions, transactional rollback exceptions); the outer for-loop at lines 33-35 continues to the next job regardless of which job failed. By contrast, the OUTER `catch (SQLException e)` at line 36 catches connection-acquisition failure and aborts the cycle for ALL jobs that did not yet run — explicit two-tier exception handling: connection-level failure aborts the cycle; per-job failure isolates and continues. The architectural posture: each housekeeping job is operationally independent (each operates on a disjoint table set today: alerts vs search-facets vs data-entities vs activity-partitions vs message-partitions), and a transient failure in one (e.g. an FK violation introduced by a schema migration's race with housekeeping; the AlertHousekeepingJob jOOQ-precedence bug per REFACTOR-142; a network-stall during DataEntityHousekeepingJob's `.block()` per REFACTOR-145) should not prevent the other four from running their cleanup in the same cycle.

**Wisdom test**: PASS. (1) Deliberate (the per-job catch is NARROWER in scope than the connection-level catch — explicit two-tier handling; the choice of catching `Exception` rather than `RuntimeException` includes checked exceptions, signalling "catch everything per-job"); (2) Structural impact (every future `HousekeepingJob` implementation inherits this isolation contract; a job author can assume their job's failure does not block siblings); (3) Changing the contract (e.g. "halt cycle on first job failure" for transactional consistency) would be a STRUCTURAL change with cascading consequences for job-author expectations.

**Evidence**:
- HousekeepingJobManager.md says: "`runHousekeepingJob` (`HousekeepingJobManager.java:41-47`) catches `Exception` and logs at ERROR; the loop continues to the next job."
- HousekeepingJobManager.md says (intent anchor): "the per-job catch deliberately narrower than the outer try/catch (line 36 catches only `SQLException` from connection acquisition) — explicit two-tier exception handling: connection-level failure aborts the cycle; per-job failure isolates and continues."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-046** (housekeeping opt-out by shipped default) — together they form the housekeeping subsystem's resilience posture: ships ON (per ADR-CANDIDATE-046), and once on, individual jobs fail soft (per this ADR). Composes with **ADR-CANDIDATE-098** (notifications per-channel catch-and-continue) as the cross-feature pattern "fail-soft per unit, fail-loud at the orchestrator level."

**Cross-link gaps** (refactoring-scopes anchored on the absence this ADR endorses):
- REFACTOR-142 (batch D — primary-source CONFIRMED batch K) — AlertHousekeepingJob jOOQ operator-precedence bug; the per-job catch SWALLOWS the resulting silent-data-loss without metric or alert.
- REFACTOR-145 (batch D — primary-source CONFIRMED batch K) — `.block()` inside transaction; an S3-outage exception is caught by THIS ADR's per-job catch and logged at ERROR; the operator-visibility surface is debug logs only.
- REFACTOR-257 NEW — no Micrometer counter on per-job failure (the operator-observability gap the catch-and-continue stance does NOT defend).

**Proposed action**: Promote to `adrs/drafts/housekeeping-per-job-failure-isolation.md` (new ADR). Document the two-tier exception handling explicitly (connection-level aborts cycle; per-job isolates) AND enumerate the observability gap this stance creates (REFACTOR-257). Cross-link with ADR-CANDIDATE-046 (the opt-out shipping stance) and ADR-CANDIDATE-098 (the cross-feature catch-and-continue family).

**Severity rationale**: MEDIUM — failure-isolation architecture decision; affects operator response to housekeeping incidents. The alternative (halt cycle on first failure) would be operationally noisier (one bad migration could pause ALL cleanup) but would surface incidents faster.

---

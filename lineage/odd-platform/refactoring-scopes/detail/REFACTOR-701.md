## REFACTOR-701 — `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` at SchedulingConfiguration.java:14 is currently DEAD CODE; all three `@SchedulerLock` consumers set their own `lockAtMostFor` explicitly; no Javadoc marks the intent — a future maintainer cannot tell whether the default is vestigial or load-bearing

**Severity**: LOW
**Category**: missing-doc / dead-code-without-intent-marker
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[2]` (LOW severity) — "**`defaultLockAtMostFor = \"1h\"` is currently DEAD CODE**. All three `@SchedulerLock`-annotated methods in the codebase set their own `lockAtMostFor` explicitly (housekeepingJob = 14m, statusSwitchJob = 9m, partitionCreationJob = 10m). The `1h` default at SchedulingConfiguration.java:14 applies to ZERO methods in the current codebase. It exists as a latent safety floor for future `@SchedulerLock` annotations that omit their timing attributes — but no current code path exercises it. A reader of SchedulingConfiguration.java cannot tell from the file alone whether the default is meaningful; the `1h` value is only understood by reading the three downstream `@SchedulerLock` consumers and confirming each sets its own."

**Description**: `SchedulingConfiguration.java:14` declares:
```java
@EnableSchedulerLock(defaultLockAtMostFor = "1h")
```

ShedLock's annotation default for `defaultLockAtMostFor` is `Long.MAX_VALUE` — effectively "hold the lock until manual release". The maintainer's explicit `"1h"` value is a SAFETY FLOOR (ADR-CANDIDATE-241 NEW codifies the architectural intent). However, no current `@SchedulerLock` annotation in the codebase exercises this default:

| `@SchedulerLock` method | `lockAtMostFor` |
|---|---|
| HousekeepingJobManager.runHousekeepingJobs | `"14m"` (explicit) |
| DataEntityStatusSwitchJob.run | `"9m"` (explicit) |
| PostgreSQLPartitionCreationJob.run | `"10m"` (explicit) |

`grep '@SchedulerLock' <odd-platform-repo>/odd-platform-api/src/main/java` returns exactly three matches; all set `lockAtMostFor` explicitly. The `1h` default at line 14 governs ZERO methods today. The default is LATENT — designed to apply to future `@SchedulerLock` annotations whose authors omit explicit timing attributes — but the source file gives a reader no signal whether the default is intentional, vestigial, or "should be removed in cleanup".

**Why this is a refactoring scope (not the ADR-241 candidate)**: the architectural intent IS captured by ADR-CANDIDATE-241 (the `"1h"` safety floor is the deliberate design); the gap surfaced here is the **absence of a Javadoc or `//` comment** at the declaration site marking that intent. A future maintainer reading SchedulingConfiguration.java in isolation cannot tell:
- whether `"1h"` was chosen deliberately (the answer: yes, per ADR-241)
- whether any current code relies on it (the answer: no, dead code)
- whether removing the attribute is safe (the answer: removing it would silently flip the safety floor to `Long.MAX_VALUE`)

This is the doc-disclose / source-comment gap. The fix is a comment at the declaration site that closes the question.

**Operator-visible consequence**: none today (the default does not apply to any current job). But a future bug-shape: if a maintainer adds `@SchedulerLock(name = "X")` (no `lockAtMostFor`) without realising the `1h` default applies, the lock is held for 1h after a JVM crash — potentially blocking a critical recurring job for an hour. Conversely, if the maintainer EXPECTS `Long.MAX_VALUE` behaviour (the ShedLock library default), they discover the `1h` cap only on the first JVM-crash recovery, by which point operational damage may have accumulated.

**Primary source citations**:
- SchedulingConfiguration.java:14 (`@EnableSchedulerLock(defaultLockAtMostFor = "1h")` — no surrounding Javadoc or `//` comment)
- HousekeepingJobManager.java:26, DataEntityStatusSwitchJob.java:22, PostgreSQLPartitionCreationJob.java:41 (the three explicit `lockAtMostFor` overrides — all bypass the default)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-241 NEW codifies the architectural intent. This REFACTOR addresses the source-comment gap at the declaration site so the ADR's intent is visible without reading the ADR.

**Proposed remedy**: Add a `//` comment immediately above `@EnableSchedulerLock` at SchedulingConfiguration.java:14, e.g.:
```java
// Safety floor for any @SchedulerLock(name = "X") that omits its own
// lockAtMostFor; currently no consumer relies on this default (all three
// existing @SchedulerLock annotations set explicit values). See
// adrs/drafts/scheduler-lock-default-safety-floor.md (when promoted).
@EnableSchedulerLock(defaultLockAtMostFor = "1h")
```

Alternative: a Javadoc on the SchedulingConfiguration class itself summarising the four load-bearing decisions (`@EnableScheduling`, `@EnableSchedulerLock + defaultLockAtMostFor`, `.usingDbTime()`, shared DataSource) with ADR cross-links.

**Severity rationale**: LOW — no operational impact today; the gap is source-readability. The cost of the fix is 3-4 comment lines.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` (with REFACTOR-698 / 699 / 700 / 702 / 703 / 704). Trivial to include in the same PR.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-241 (this REFACTOR makes the ADR's intent visible at the declaration site).
- SUPERSEDES: none.
- CONFLICTS: none.

---

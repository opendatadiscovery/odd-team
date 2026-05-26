## ADR-CANDIDATE-241 — `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` is set as a SAFETY FLOOR for future `@SchedulerLock` annotations that omit their own `lockAtMostFor`; currently dead code, latent for future jobs

**Classification**: promote
**Severity**: LOW
**Pillars affected**: [P-08 Management & Administration]
**Support**: surfaced by 1 sidecar (`SchedulingConfiguration` — primary-source)
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:implicit_adrs.[1]` (HIGH confidence) — "`defaultLockAtMostFor = \"1h\"` as a latent safety floor — SchedulingConfiguration.java:14 sets a 1-hour default for any `@SchedulerLock` method that omits its own `lockAtMostFor`. Currently dead code (all three `@SchedulerLock` methods in the codebase set explicit values), but the choice of 1h vs Long.MAX_VALUE vs 5min is a load-bearing decision for future jobs. The intent: 'if a developer adds a `@SchedulerLock(name = \"newJob\")` without thinking about lock-timing, the lock cannot deadlock for longer than 1 hour'. 1h is operationally reasonable — long enough to cover most legitimate scheduled work, short enough that a JVM crash mid-cycle does not block the lock for a full day." — intent_anchor: "The presence of a non-default value on the `@EnableSchedulerLock` annotation IS the decision. The annotation's own default is `Long.MAX_VALUE` (effectively 'lock until manually released'); choosing `1h` instead is an explicit choice to set a safety ceiling."

**Decision statement**: `SchedulingConfiguration.java:14` declares `@EnableSchedulerLock(defaultLockAtMostFor = "1h")`. ShedLock's annotation default is `Long.MAX_VALUE` — effectively "hold the lock until manual release". The maintainer's explicit `"1h"` value is a SAFETY FLOOR for `@SchedulerLock`-annotated methods that omit their own `lockAtMostFor` attribute. All three currently-`@SchedulerLock`-annotated methods (`HousekeepingJobManager` 14m/14m, `DataEntityStatusSwitchJob` 9m/9m, `PostgreSQLPartitionCreationJob` 10m/10m) set their own timing pairs, so the `1h` default is **currently dead code in the application**. However the choice exists for the platform's future-proofing posture: any new `@SchedulerLock(name = "newJob")` declaration with no timing attribute inherits 1h. The trade-off considered: too short (5min) = legitimate long-running cleanup may release the lock prematurely; too long (24h) = a JVM crash mid-cycle blocks the lock for a full day. The `1h` value is the operationally-reasonable middle.

**Wisdom test**: PASS (borderline). (1) **Deliberate** — the `defaultLockAtMostFor = "1h"` attribute on `@EnableSchedulerLock` is explicit, not the library default (`Long.MAX_VALUE`); the maintainer made a positive choice. (2) **Structural impact** — applies platform-wide to future `@SchedulerLock` annotations; affects the contract for any future scheduled-task author. (3) **Changing the default IS a structural decision**, not refactoring — moving to 5min or 24h shifts the platform's safety posture. The wisdom-test borderline is that the value is currently DEAD CODE (no consumer relies on it); a maintainer could reasonably argue this is "premature configuration" rather than a load-bearing decision. But the **explicit override of the library default** is the intent anchor — the maintainer chose to set a value rather than let `Long.MAX_VALUE` apply, which is a positive design statement.

**Evidence**:
- SchedulingConfiguration.md says: "SchedulingConfiguration.java:14 (`@EnableSchedulerLock(defaultLockAtMostFor = \"1h\")`). — intent_anchor: 'The presence of a non-default value on the `@EnableSchedulerLock` annotation IS the decision. The annotation's own default is `Long.MAX_VALUE` (effectively 'lock until manually released'); choosing `1h` instead is an explicit choice to set a safety ceiling.'"
- SchedulingConfiguration.md `stress_findings.tunables[0]` walks the boundary cases: at "omitted" (library default = `Long.MAX_VALUE`), at "1h" (current state — dead code), at "100h" (operationally absurd), confirming the maintainer's choice is the operationally-reasonable middle.
- SchedulingConfiguration.md says: "grep `@SchedulerLock` across `<odd-platform-repo>/odd-platform-api/src/main` returns three matches, all of which set `lockAtMostFor` explicitly (HousekeepingJobManager.java:26, DataEntityStatusSwitchJob.java:22, PostgreSQLPartitionCreationJob.java:41)."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-240** (`.usingDbTime()` clock-skew immunity — sibling decision in the same `SchedulingConfiguration.java` file; both are load-bearing platform-level scheduling-and-locking defaults).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-701 NEW (`defaultLockAtMostFor = "1h"` is currently DEAD CODE — no Javadoc or comment marks the intent; a future maintainer reading SchedulingConfiguration.java cannot tell from the file alone whether the `1h` default is meaningful or vestigial)
- REFACTOR-700 NEW (session-housekeeping has `@Scheduled` but no `@SchedulerLock` — the `1h` default does NOT apply because the annotation is absent; an architectural inconsistency)

**Proposed action**: Promote to `adrs/drafts/scheduler-lock-default-safety-floor.md` (new ADR). Document the `1h` value as the operationally-reasonable safety floor for unspecified scheduled-task lock duration, and the operator-visible consequence: a `@SchedulerLock(name = "X")` declaration without `lockAtMostFor` inherits 1h — useful as a forgiveness mechanism, but every load-bearing scheduled task SHOULD set its own value (the three current jobs all do so). Combine with REFACTOR-701 (add a Javadoc making the safety-floor intent explicit at the declaration site).

**Severity rationale**: LOW — currently dead code; the value matters only for future scheduled tasks that omit `lockAtMostFor`. Codifying the rationale prevents a future "let's remove this defaulted attribute, no one uses it" refactor from regressing the safety floor.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-240 (sibling decision in the same file — together they define the platform's complete ShedLock posture).
- SUPERSEDES: none.
- CONFLICTS: none.

---

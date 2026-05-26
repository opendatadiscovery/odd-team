## ADR-CANDIDATE-242 — Spring scheduling enablement, ShedLock-spring AOP enablement, and the `LockProvider` `@Bean` factory are co-located on a SINGLE `@Configuration` class (`SchedulingConfiguration`) — the colocation deliberately makes scheduling-without-locking structurally impossible

**Classification**: promote
**Severity**: LOW
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Support**: surfaced by 1 sidecar (`SchedulingConfiguration` — primary-source)
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:implicit_adrs.[2]` (MEDIUM confidence) — "Co-locating scheduling enablement with the LockProvider bean — both `@EnableScheduling` and `@EnableSchedulerLock` are placed on the same `@Configuration` class that also declares the `lockProvider` Bean. The structural intent: scheduling-AND-locking are conceptually inseparable in this codebase. Splitting (e.g. one config for `@EnableScheduling`, another for `@EnableSchedulerLock` + LockProvider) would allow a future deployment to accidentally enable scheduling without locking — leading to multi-replica races. The single-class colocation enforces 'you cannot have scheduling without ShedLock-aware locking'." — intent_anchor: "The three annotations on lines 12-14 form an atomic unit; the absence of a sibling configuration class with just `@EnableScheduling` confirms the all-or-nothing intent."

**Decision statement**: `SchedulingConfiguration.java:12-15` stacks three load-bearing declarations on ONE `@Configuration` class: `@EnableScheduling` (Spring imports `ScheduledAnnotationBeanPostProcessor` + default `TaskScheduler`), `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` (ShedLock-spring imports `MethodProxyScheduledLockAdvisor`), and the `lockProvider(DataSource)` `@Bean` method (returns `JdbcTemplateLockProvider`). The decision NOT to split these across multiple configuration classes is structural: a future deployment cannot accidentally enable scheduling WITHOUT locking, because removing the entire `SchedulingConfiguration` class disables BOTH — `@Scheduled` annotations become inert AND the `@SchedulerLock` AOP advisor never wires. The colocation enforces the platform invariant: **scheduling and distributed-locking are inseparable** — every `@Scheduled` method MUST be paired with `@SchedulerLock` for multi-replica correctness (the convention 3 of 4 current jobs follow). An alternative architecture (one `@Configuration` for scheduling, a separate `@Configuration` for ShedLock, a third for the LockProvider bean) would have allowed selective disablement; the maintainer's choice deliberately forecloses that.

**Wisdom test**: PASS (MEDIUM confidence). (1) **Deliberate** — the colocation IS the evidence; no comment articulates the intent, but the absence of any sibling configuration class containing just `@EnableScheduling` confirms the all-or-nothing posture is structural. (2) **Structural impact** — splitting the file would be a STRUCTURAL refactor that changes the platform's scheduling-without-locking risk surface, not a refactoring within the current shape. (3) **Wisdom-test borderline**: the colocation could equally be explained by "this is a small enough configuration to fit in one file" — no comment articulates the architectural intent. The MEDIUM confidence in the source sidecar reflects this borderline — promoted as an ADR candidate because the **operational consequence** (scheduling-without-locking is structurally impossible) is real and load-bearing, even if the maintainer's authoring intent was incidental colocation rather than deliberate enforcement.

**Evidence**:
- SchedulingConfiguration.md says: "SchedulingConfiguration.java:12-15 (the three annotations stacked on one `@Configuration`)."
- SchedulingConfiguration.md says: "grep `@EnableScheduling|@EnableSchedulerLock` across `<odd-platform-repo>/odd-platform-api/src/main/java` returning ONE file (this one); the absence of a sibling configuration class with just `@EnableScheduling` confirms the all-or-nothing intent."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-240** (`.usingDbTime()`) and **ADR-CANDIDATE-241** (defaultLockAtMostFor=1h) — the three ADRs together define the platform's complete `SchedulingConfiguration` posture. Composes with **ADR-CANDIDATE-103** (housekeeping vs partition orchestrator split) — both downstream orchestrators inherit ALL THREE annotations + the LockProvider bean from this single file.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-700 NEW (session-housekeeping has `@Scheduled` but no `@SchedulerLock` — violates the colocation-enforced convention; the bean has scheduling without locking, contradicting the structural intent of this ADR)
- REFACTOR-702 NEW (LockProvider bean name `lockProvider` is generic — a future Redis-based LockProvider in a feature branch would collide; the single-class colocation does not extend to bean-name namespacing)

**Proposed action**: Promote to `adrs/drafts/scheduling-and-locking-colocation.md` (new ADR). Document the all-or-nothing posture as platform convention; cross-link with REFACTOR-700 as the existing violation (session-housekeeping breaks the convention even though the platform-level colocation makes the violation structurally visible — the missing `@SchedulerLock` annotation is the violation point, not the absence of a scheduling-enable configuration).

**Severity rationale**: LOW — the convention is currently held by 3 of 4 `@Scheduled` jobs; the 1 violation is operationally harmless (idempotent DELETE). Codifying the colocation as the structural enforcement mechanism prevents a future refactor from splitting `SchedulingConfiguration` into separate files, which would re-introduce the "scheduling-without-locking" risk surface.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-240, ADR-CANDIDATE-241 (siblings in the same file), ADR-CANDIDATE-103 (downstream orchestrators).
- SUPERSEDES: none.
- CONFLICTS: none.

---

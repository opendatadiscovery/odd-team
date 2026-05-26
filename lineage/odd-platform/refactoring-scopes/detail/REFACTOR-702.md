## REFACTOR-702 — `LockProvider` bean name `lockProvider` is single-word and generic; a future module declaring another `LockProvider` (Redis, ZooKeeper, JDBC-direct) would collide at boot with `ConflictingBeanDefinitionException` unless one is marked `@Primary` or `@Qualifier`-disambiguated

**Severity**: LOW
**Category**: bean-name-namespacing (preventive)
**Pillars affected**: [P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[4]` (LOW severity) — "**LockProvider bean name shadowing risk** — `lockProvider` is a single-word, generic Bean name. If a future module declares another `LockProvider` Bean (e.g. for a Redis-based lock in a feature branch), Spring's container fails to start with `ConflictingBeanDefinitionException` unless one uses `@Primary` or `@Qualifier`. The current single LockProvider is safe, but the bean name lacks a namespace prefix (`schedulerLockProvider` would be safer). Minor convention issue."

**Description**: `SchedulingConfiguration.java:17-25` declares the `LockProvider` bean as:
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

Spring derives the bean name from the method name: `lockProvider`. This is a generic single-word name that does NOT carry a project-namespace prefix. The platform currently has exactly ONE `LockProvider` bean — no collision is possible today. The concern is preventive:

**Future-shape collision scenarios**:
1. **Redis-based feature lock**: a future feature requires per-message locking against Redis (e.g. for DataCollaboration message-ordering or for a planned distributed-cache-coherence). The developer adds:
   ```java
   @Bean public LockProvider lockProvider(RedisTemplate t) { return new RedisLockProvider(t); }
   ```
   ...into a sibling configuration class. Spring fails to start: `ConflictingBeanDefinitionException: Annotation-specified bean name 'lockProvider' for bean class [...RedisLockProvider] conflicts with existing, non-compatible bean definition of same name`.

2. **Third-party library import**: a future dependency (e.g. a workflow / orchestration library that itself uses ShedLock) auto-configures its own `LockProvider` bean named `lockProvider`. Same `ConflictingBeanDefinitionException`.

3. **Module split** (less likely; the project is a single Spring Boot app today): if the platform is ever modularised and ShedLock is replicated into a sub-module's configuration, the bean-name collision surfaces.

**Why this is a LOW-severity preventive concern**:
- The collision is LOUD (boot fails) — not a silent misbehavior class. A developer adding the conflicting bean discovers the conflict at compile-and-run time on their own machine; they cannot accidentally ship a runtime regression.
- The fix is trivial once discovered: rename one of the beans (`schedulerLockProvider`, `redisLockProvider`) or use `@Primary` + `@Qualifier`.

**Why surface it at all**:
- The current bean name is a SUBOPTIMAL choice that imposes a name-collision-resolution cost on every future feature that brings its own locking primitive. A renaming (`schedulerLockProvider`) is a one-character-block change today; the same rename becomes a multi-touch refactor once consumers proliferate.
- The fix today is essentially free (one symbol change + zero downstream references — `LockProvider` is consumed by ShedLock's AOP advisor, NOT by application code directly searching by name).

**Primary source citations**:
- SchedulingConfiguration.java:17-25 (the `@Bean` method named `lockProvider`)
- Spring's bean-naming convention: method-name = bean-name unless overridden by `@Bean(name = "...")`
- The `@Bean` method does NOT use the `name` attribute — Spring derives `lockProvider` from the method name

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-242 NEW (scheduling-and-locking colocation in one Configuration class) — the colocation enforces that scheduling can't happen without ShedLock, but does NOT extend to bean-name-namespacing. This gap is the cosmetic counterpart to that structural enforcement.

**Proposed remedy**: Rename the bean to `schedulerLockProvider`:
```java
@Bean(name = "schedulerLockProvider")
public LockProvider schedulerLockProvider(final DataSource dataSource) {
    return new JdbcTemplateLockProvider(...);
}
```
ShedLock's AOP advisor finds the bean by TYPE (`LockProvider.class`), not by name — the rename has no downstream impact. A future Redis-LockProvider or library-provided LockProvider in a different bean name can coexist without `@Primary` / `@Qualifier` ceremony.

**Severity rationale**: LOW — preventive; no current operational impact. The cost of the fix is essentially zero (one-symbol rename); the value is that future bean-name collisions don't surface as boot-failures.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` (with REFACTOR-698 / 699 / 700 / 701 / 703 / 704). Trivial to fold into the same PR.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-242 (cosmetic counterpart to the structural-enforcement intent).
- SUPERSEDES: none.
- CONFLICTS: none.

---

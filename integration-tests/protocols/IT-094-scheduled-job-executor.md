---
id: IT-094
title: "Scheduled-job executor — ShedLock ledger, usingDbTime windows, session-job asymmetry"
gates:
  validates: [F-121]
  enforces: []
  regresses: [PLT-083]
test_class: integration
stack: odd-minimal
automation: "e2e:scheduled-job-executor.spec.ts"
plan_ref: I8
status: ready
---

# IT-094 — Scheduled-job executor architecture

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` probe (if any) is a convenience rail
> that runs the same steps and writes the same result; it never replaces the
> protocol. Reproducible by construction: same preparation + same run = same check.

## 1. What this checks
The four background jobs (`HousekeepingJobManager` 15m, `DataEntityStatusSwitchJob` 10m,
`PostgreSQLPartitionCreationJob` cron 00:01, `PostgreSQLSessionHousekeepingJobHandler` 1h) share Spring
Boot's default single-thread `TaskScheduler` (no `@Bean TaskScheduler`, zero `spring.task.scheduling.*`
keys) and the three @SchedulerLock-guarded ones coordinate via the `shedlock` table. Falsifiable claims:
- **F-121 UC-001/UC-007 (success)**: the guarded jobs run and register `shedlock` rows whose window
  (`lock_until - locked_at`) equals the source-declared `lockAtMostFor` EXACTLY (housekeeping 14m=840s,
  status-switch 9m=540s) — exact because the `JdbcTemplateLockProvider` is `.usingDbTime()`
  (`SchedulingConfiguration.java:22`), judging lock validity by PostgreSQL's clock (no JVM skew).
- **PLT-083 / UC-005+UC-006 (pin)**: `PostgreSQLSessionHousekeepingJobHandler.java:13` is `@Scheduled`
  with NO `@SchedulerLock`, so it writes NO shedlock row and runs on every replica hourly —
  `@EnableSchedulerLock` does NOT lock a bare `@Scheduled`.
- **UC-008**: `@EnableSchedulerLock(defaultLockAtMostFor="1h")` is dead code — every guarded job
  overrides it, so no live lock window is 3600s.

If the success claim FAILS, leader-election/usingDbTime is broken (cluster-wide concurrency risk). The
pins are GREEN today and FLIP RED when the session handler gains a `@SchedulerLock` / a job inherits the 1h default.

## 2. Preparation — build the test stand
- **Stack**: bring up `odd-minimal`. No seeds — this spec reads the live `shedlock` table the running
  platform populates. ids 20940-20949 reserved, unused. Side-effect-free.
- **Auth/config**: odd-minimal defaults (DISABLED).
- **Warm-up**: let the platform run at least one cadence of the slowest asserted job (housekeeping 15m,
  status-switch 10m) so their shedlock rows exist. The partition-creation row only appears after the
  00:01 cron (asserted opportunistically, never required).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- ShedLock populated: `SELECT name, EXTRACT(EPOCH FROM (lock_until-locked_at))::int FROM shedlock`
  → at least `housekeepingJob` (840) and `statusSwitchJob` (540).

## 4. Run protocol — what to run
1. Read all `shedlock` rows with their window seconds.
2. Assert the guarded jobs' windows match the source map (housekeeping 840s, status-switch 540s).
3. Assert NO session-shaped (`/session/i`) shedlock row exists while a guarded row does.
4. Assert no live window equals 3600s.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/scheduled-job-executor.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: `housekeepingJob` window = 840s and `statusSwitchJob` window = 540s; no session lock
  row exists; no lock window = 3600s.
- **FAIL** when: a guarded window drifts from its source `lockAtMostFor` (usingDbTime regression or a
  source change without updating this protocol); OR a session-shaped lock appears (PLT-083 fixed — move
  the pin to the promise); OR a 3600s window appears (a job started inheriting the 1h default).

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-121 UC-001 / UC-005 / UC-006 / UC-007 / UC-008 (`lineage/odd-platform/feature-flows/detail/F-121.yaml`)
- Bug: PLT-083 (session-housekeeping has no @SchedulerLock)
- Code: `SchedulingConfiguration.java:13-25`, `HousekeepingJobManager.java:25-26`,
  `DataEntityStatusSwitchJob.java:21-22`, `PostgreSQLPartitionCreationJob.java:40-41`,
  `PostgreSQLSessionHousekeepingJobHandler.java:13`
- Note: single-thread starvation (UC-001 full) + cron-misfire (UC-004) need a contrived multi-JVM/clock
  stand — remain functional/probe TEST-GAPs, not covered here.
- Plan: `lineage/odd-platform/test-plan.md` batch I8

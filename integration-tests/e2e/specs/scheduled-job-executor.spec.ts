import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-094 — F-121 Scheduled-Job Executor Architecture (the shared single-thread scheduler +
 * ShedLock coordination contract).
 *
 * Protocol: integration-tests/protocols/IT-094-scheduled-job-executor.md
 * Gates: validates F-121 (UC-001 jobs run · UC-007 usingDbTime · UC-008 defaultLockAtMostFor) ·
 *        regresses PLT-083 (session-housekeeping has no @SchedulerLock — runs N-fold on N replicas).
 *
 * F-121 is a pure operator-infrastructure feature — no UI hop. Four background jobs
 * (HousekeepingJobManager 15m, DataEntityStatusSwitchJob 10m, PostgreSQLPartitionCreationJob
 * cron 00:01, PostgreSQLSessionHousekeepingJobHandler 1h) share Spring Boot's default
 * `TaskScheduler` (poolSize=1 — SchedulingConfiguration.java declares no @Bean TaskScheduler and
 * application.yml ships zero `spring.task.scheduling.*` keys). The OBSERVABLE contract on a single
 * live stack is the ShedLock ledger: which jobs are leader-elected, the exact lock window each
 * declares, and — load-bearing — that the lock validity is judged by PostgreSQL's clock
 * (`.usingDbTime()`, SchedulingConfiguration.java:22), i.e. `lock_until - locked_at` equals the
 * source-declared window to the second, with zero JVM-clock drift.
 *
 * (The single-thread starvation promise UC-001 and the cron-misfire UC-004 require a contrived
 * multi-JVM / clock-warp stand — out of scope for a shared-stack characterization; this pins the
 * directly-observable ShedLock + usingDbTime + asymmetry contract. The starvation/misfire demands
 * remain functional/probe TEST-GAPs, noted in the protocol.)
 *
 * Namespace: this spec only READS shedlock (no seeds) + reads source-declared constants; ids
 * 20940-20949 reserved but unused. Idempotent / side-effect-free.
 */

// Source-declared ShedLock windows (the regression contract). If a job's @SchedulerLock
// lockAtMostFor changes in source, this map must change with it — that coupling is the point.
const GUARDED_WINDOWS_SECS: Record<string, number> = {
  housekeepingJob: 14 * 60, // HousekeepingJobManager.java:26  lockAtMostFor="14m"
  statusSwitchJob: 9 * 60, //  DataEntityStatusSwitchJob.java:22 lockAtMostFor="9m"
  // partitionCreationJob (PostgreSQLPartitionCreationJob.java:41, "10m") only writes a shedlock
  // row after its first 00:01 cron fire; the boot @PostConstruct path is unlocked, so it is NOT
  // reliably present on a freshly-booted stack — asserted opportunistically below, never required.
};
const DEFAULT_LOCK_AT_MOST_FOR_SECS = 60 * 60; // SchedulingConfiguration.java:14  defaultLockAtMostFor="1h"

test.describe('IT-094 F-121 scheduled-job executor — ShedLock ledger + usingDbTime + PLT-083 asymmetry', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS — UC-001 (jobs run, leader-elected) + UC-007 (usingDbTime).
  // The 15m housekeeping and 10m status-switch jobs are @SchedulerLock-guarded. Once each has
  // fired, the JdbcTemplateLockProvider writes a shedlock row whose (lock_until - locked_at)
  // equals exactly the declared lockAtMostFor — and because the provider is configured
  // `.usingDbTime()`, those timestamps come from PostgreSQL's current_timestamp, so the window
  // is exact regardless of JVM clock. We assert both rows exist with their source-exact windows.
  // ─────────────────────────────────────────────────────────────────────────
  test('SUCCESS UC-001/UC-007: guarded jobs are leader-elected with source-exact ShedLock windows (usingDbTime)', async () => {
    const rows = await dbQuery<{ name: string; window_secs: number; locked_by: string }>(
      `SELECT name, EXTRACT(EPOCH FROM (lock_until - locked_at))::int AS window_secs, locked_by
         FROM shedlock`,
    );
    const byName = new Map(rows.map((r) => [r.name, r]));

    for (const [name, expectedSecs] of Object.entries(GUARDED_WINDOWS_SECS)) {
      const row = byName.get(name);
      expect(
        row,
        `F-121 UC-001: the '${name}' @Scheduled job must run on the shared executor and acquire its ` +
          `ShedLock — a shedlock row proves a cycle fired. Present rows: ${JSON.stringify(rows.map((r) => r.name))}. ` +
          `(If absent: is odd-minimal up? give the slowest job one cadence — housekeeping 15m, status-switch 10m.)`,
      ).toBeTruthy();
      // UC-007 usingDbTime: lock_until - locked_at is written from PG's clock → exact, no JVM skew.
      expect(
        row?.window_secs,
        `F-121 UC-007 (.usingDbTime, SchedulingConfiguration.java:22): '${name}' lock window ` +
          `(lock_until - locked_at) must equal its source-declared lockAtMostFor of ${expectedSecs}s exactly — ` +
          `the JdbcTemplateLockProvider writes both timestamps from PostgreSQL current_timestamp, so there is ` +
          `no cross-replica clock drift. Got ${row?.window_secs}s.`,
      ).toBe(expectedSecs);
    }

    // opportunistic: if the daily partition-creation cron has fired, it too is guarded at 10m.
    const partition = byName.get('partitionCreationJob');
    if (partition) {
      expect(
        partition.window_secs,
        `F-121: partitionCreationJob (when present, after its 00:01 cron) declares lockAtMostFor="10m" ` +
          `(PostgreSQLPartitionCreationJob.java:41). Got ${partition.window_secs}s.`,
      ).toBe(10 * 60);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 1 — PLT-083 / F-121 UC-005 + UC-006 (GREEN now, RED on fix).
  // PostgreSQLSessionHousekeepingJobHandler.java:13 is `@Scheduled(fixedRate=1h)` with NO
  // `@SchedulerLock`. @EnableSchedulerLock only enables the AOP advisor; a bare @Scheduled method
  // is NOT leader-elected. So the session reaper writes NO shedlock row and runs on EVERY replica
  // every hour (UC-005 contradicted: not "exactly once cluster-wide"; UC-006 contradicted:
  // "@EnableSchedulerLock means every @Scheduled is leader-elected" is false). We assert: the
  // guarded jobs DO have shedlock rows, and NO session-shaped lock row exists.
  // KNOWN BUG (PLT-083): flips RED the moment a @SchedulerLock is added to the session handler.
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-005/UC-006 [PLT-083 pin, GREEN-now]: the session reaper is unguarded (no ShedLock row)', async () => {
    const allLocks = await dbQuery<{ name: string }>('SELECT name FROM shedlock');
    const names = allLocks.map((r) => r.name);

    // at least one guarded job has registered — proves ShedLock is wired and writing rows, so the
    // session row's absence below is specifically the missing @SchedulerLock, not an empty table.
    const guardedPresent = Object.keys(GUARDED_WINDOWS_SECS).filter((n) => names.includes(n));
    expect(
      guardedPresent.length,
      `setup: at least one guarded job must have a shedlock row (proves ShedLock is live), so the session ` +
        `reaper's absence is meaningful. Present: ${JSON.stringify(names)}.`,
    ).toBeGreaterThan(0);

    const sessionLocks = names.filter((n) => /session/i.test(n));
    expect(
      sessionLocks,
      `PLT-083 / F-121 UC-005+UC-006 (GREEN-now characterization): PostgreSQLSessionHousekeepingJobHandler is ` +
        `@Scheduled WITHOUT @SchedulerLock, so it acquires NO ShedLock and runs on every replica hourly. There ` +
        `must be NO session-shaped shedlock row while the guarded jobs (${JSON.stringify(guardedPresent)}) DO ` +
        `have one. This FLIPS RED when the session handler gains a @SchedulerLock (the fix). Got session ` +
        `locks: ${JSON.stringify(sessionLocks)}.`,
    ).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 2 — F-121 UC-008 (defaultLockAtMostFor="1h" is dead code today).
  // @EnableSchedulerLock(defaultLockAtMostFor="1h") only applies to a @SchedulerLock that OMITS its
  // own lockAtMostFor. Every guarded job in the codebase sets its own (14m/9m/10m), so the 1h
  // default governs ZERO methods today. Observable: no live shedlock window equals 3600s.
  // (Partial promise: the inheritance is real for a future omit-the-timing job; cosmetic now.)
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-008: the defaultLockAtMostFor=1h is dead code — no live lock window is 3600s', async () => {
    const rows = await dbQuery<{ name: string; window_secs: number }>(
      `SELECT name, EXTRACT(EPOCH FROM (lock_until - locked_at))::int AS window_secs FROM shedlock`,
    );
    const oneHourWindows = rows.filter((r) => r.window_secs === DEFAULT_LOCK_AT_MOST_FOR_SECS);
    expect(
      oneHourWindows,
      `F-121 UC-008: every @SchedulerLock job overrides lockAtMostFor (housekeeping 14m, status-switch 9m, ` +
        `partition 10m), so @EnableSchedulerLock(defaultLockAtMostFor="1h") applies to no method — no live lock ` +
        `window should be 3600s. A 3600s window would mean a job started inheriting the default (the contract ` +
        `becomes live). Got 1h windows: ${JSON.stringify(oneHourWindows)}.`,
    ).toEqual([]);
    // sanity: there is at least one guarded window to compare against (not a vacuous pass).
    expect(
      rows.length,
      `setup: at least one shedlock row must exist to make the "none is 1h" assertion meaningful. ` +
        `Got: ${JSON.stringify(rows)}.`,
    ).toBeGreaterThan(0);
  });
});

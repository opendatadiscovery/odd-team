import { test, expect } from '@playwright/test';
import { upHaStack, downHaStack, killLeader, leaderPid, waitingCount } from '../helpers/ha-stack';

/**
 * IT-012 — notifications WAL leader failover (ADR-0043): when the leader dies, a standby
 * takes over.
 *
 * Protocol: integration-tests/protocols/IT-012-notifications-wal-failover.md
 * Gates: enforces ADR-0043 (WAL single-leader via blocking advisory lock + failover).
 *
 * ADR-0043: the notification subscriber's first action is a BLOCKING acquire of advisory
 * lock 100, so exactly ONE replica reads the WAL (the leader) and the other BLOCKS; when
 * the leader's connection drops, the standby acquires the lock and takes over. Two
 * replicas share one Postgres; A is brought up first (the deterministic leader), B blocks.
 *
 * Observable: `pg_locks` for the advisory lock — one GRANTED holder (the leader) + one
 * WAITING (the standby). Kill the leader → the granted holder becomes a DIFFERENT backend
 * (the standby). The standby never hits the PLT-139 wedge because it blocks BEFORE the WAL
 * stream; the leader is made clean first (see ha-stack.ensureCleanLeader / PLT-139).
 *
 * EXPECTED RESULT: GREEN — one leader + one blocked standby; killing the leader hands the
 * lock to the standby within seconds. RED means leader election or failover broke.
 *
 * Self-contained: brings up its own 2-replica stack (:18085/:18086, pg :15437).
 */
test.describe('IT-012 notifications WAL leader failover (ADR-0043) — kill the leader, a standby takes over', () => {
  test.beforeAll(async () => {
    test.setTimeout(420_000); // two platform replicas + a possible PLT-139 un-wedge of the leader
    await upHaStack();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downHaStack();
  });

  test('exactly one replica leads (advisory lock); killing it hands leadership to the standby', async () => {
    test.setTimeout(180_000);

    // ---- leader election: exactly one granted advisory lock (leader) + the standby blocking ----
    const leader = await leaderPid();
    expect(
      leader,
      'ADR-0043: exactly one replica must hold the advisory lock (the elected leader).',
    ).not.toBeNull();
    expect(
      await waitingCount(),
      'ADR-0043: the non-leader replica must BLOCK on the advisory lock (a waiting lock entry).',
    ).toBeGreaterThanOrEqual(1);

    // ---- failover: kill the leader → the standby must acquire the lock (a NEW, non-null holder) ----
    killLeader();
    await expect
      .poll(
        async () => {
          const pid = await leaderPid();
          return pid !== null && pid !== leader; // a NEW backend now holds the lock
        },
        {
          timeout: 90_000,
          message:
            `ADR-0043 failover: after the leader (backend ${leader}) died, the standby must acquire ` +
            `the advisory lock and become the new leader (a different, non-null holder). It did not.`,
        },
      )
      .toBe(true);
  });
});

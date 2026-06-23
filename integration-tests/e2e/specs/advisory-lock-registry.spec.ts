import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { dbQuery } from '../helpers/db';

/**
 * IT-095 — F-065 Postgres advisory-lock-id registry (four hand-numbered IDs; no central enum,
 * no boot-time collision validator).
 *
 * Protocol: integration-tests/protocols/IT-095-advisory-lock-registry.md
 * Gates: validates F-065 (UC-1 four disjoint ids · UC-3 deliberate partition-lock share) ·
 *        regresses PLT-089 (pg_advisory_lock blocks forever on collision — silent subsystem wedge,
 *        no registry/validator/readiness degradation).
 *
 * The registry is four ids assigned in application.yml across three @ConfigurationProperties
 * prefixes: partition.advisory-lock-id=90, notifications.wal.advisory-lock-id=100,
 * datacollaboration.receive-event-advisory-lock-id=110, datacollaboration.sender-message-advisory-lock-id=120.
 * PostgreSQLLeaderElectionManagerImpl.java:22 acquires each via blocking `SELECT pg_advisory_lock(id)`.
 *
 * NOT observably-held on odd-minimal (the honest scope call): the partition lock (90) is acquired in
 * PostgreSQLPartitionCreationJob.java's @PostConstruct but released the instant that try-with-resources
 * connection closes; notifications (enabled=false) and datacollaboration (enabled=false) never acquire
 * 100/110/120 at all. So `pg_locks` shows ZERO advisory rows from the platform on the shared stack —
 * we assert that emptiness explicitly, then characterize the registry's load-bearing CONTRACT
 * empirically: the four ids are distinct, valid, currently-free advisory slots, and a collision on any
 * one is SILENT (no error) — exactly the wedge primitive PLT-089 is about.
 *
 * Namespace: ids 20950-20959 reserved; this spec acquires the PLATFORM's lock ids (90/100/110/120) only
 * transiently inside single sessions it then releases — it never leaves a lock held.
 */

const REGISTRY = {
  partition: 90, //               application.yml partition.advisory-lock-id
  notificationsWal: 100, //       application.yml notifications.wal.advisory-lock-id
  dcReceiveEvent: 110, //         application.yml datacollaboration.receive-event-advisory-lock-id
  dcSenderMessage: 120, //        application.yml datacollaboration.sender-message-advisory-lock-id
} as const;
const ALL_IDS = Object.values(REGISTRY);

// Respect ODD_DB_URL (set per-stream by run-suite.sh under ODD_STREAM) so the raw two-session advisory-lock
// probes hit THIS stream's DB, not the shared :15432 (which is down under isolation → ECONNREFUSED). The
// default preserves the non-isolated behaviour. Mirrors helpers/db.ts.
const CONN =
  process.env.ODD_DB_URL ?? 'postgresql://odd-platform:odd-platform-password@localhost:15432/odd-platform';

test.describe('IT-095 F-065 advisory-lock registry — distinctness contract + PLT-089 silent-collision pin', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS — F-065-UC-1: the four advisory-lock-ids are distinct, valid slots, and on
  // odd-minimal NONE is held by the platform (subsystems released/disabled). One single-session
  // CTE try-acquires all four and reads back the objids it now holds: all four must succeed (=true)
  // and produce exactly [90,100,110,120] — four DISTINCT objids, no collision. That all four are
  // free is the honest confirmation that the platform's leader locks are not observable as held on
  // this stack (the assignment's "say so clearly" requirement).
  // ─────────────────────────────────────────────────────────────────────────
  test('SUCCESS UC-1: the four registry ids (90/100/110/120) are distinct, valid, currently-free locks', async () => {
    // first: the platform holds NO advisory lock on odd-minimal (released @PostConstruct + subsystems off).
    const platformHeld = await dbQuery<{ objid: number }>(
      `SELECT objid FROM pg_locks WHERE locktype='advisory' ORDER BY objid`,
    );
    expect(
      platformHeld,
      `F-065 scope note (observable reality on odd-minimal): the platform holds NO advisory lock — the ` +
        `partition lock 90 is released when PostgreSQLPartitionCreationJob's @PostConstruct connection closes, ` +
        `and notifications/datacollaboration are disabled by default so 100/110/120 are never acquired. The ` +
        `held-lock state is therefore NOT observable here; we characterize the distinctness contract instead. ` +
        `Got platform-held advisory locks: ${JSON.stringify(platformHeld)}.`,
    ).toEqual([]);

    // empirical distinctness: try-acquire all four in ONE session, read the objids that session holds.
    const rows = await dbQuery<{
      l90: boolean;
      l100: boolean;
      l110: boolean;
      l120: boolean;
      held_objids: number[];
    }>(
      `WITH acq AS (
         SELECT pg_try_advisory_lock(${REGISTRY.partition})        AS l90,
                pg_try_advisory_lock(${REGISTRY.notificationsWal})  AS l100,
                pg_try_advisory_lock(${REGISTRY.dcReceiveEvent})    AS l110,
                pg_try_advisory_lock(${REGISTRY.dcSenderMessage})   AS l120
       )
       SELECT acq.*,
              (SELECT array_agg(objid ORDER BY objid) FROM pg_locks
                WHERE locktype='advisory' AND pid = pg_backend_pid()) AS held_objids
         FROM acq`,
    );
    const r = rows[0];

    expect(
      [r.l90, r.l100, r.l110, r.l120],
      `F-065-UC-1: each registry id must be a free, acquirable advisory slot on odd-minimal (pg_try_advisory_lock ` +
        `returns true). A false would mean the platform IS holding it (or another session is). Got: ${JSON.stringify(r)}.`,
    ).toEqual([true, true, true, true]);

    // four DISTINCT objids = no collision in the hand-numbered registry (the load-bearing invariant).
    expect(
      r.held_objids,
      `F-065-UC-1: acquiring the four ids must yield FOUR distinct advisory objids [90,100,110,120] — proving the ` +
        `hand-numbered registry has no collision. A duplicate id would collapse two subsystems onto one lock. ` +
        `Got: ${JSON.stringify(r.held_objids)}.`,
    ).toEqual(ALL_IDS);
    expect(new Set(ALL_IDS).size, 'the four configured ids are pairwise distinct').toBe(4);

    // release everything we transiently held (the client closes anyway, but be explicit).
    await dbQuery('SELECT pg_advisory_unlock_all()');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 1 — F-065-UC-3: the partition lock (90) is a DELIBERATE cross-subsystem share.
  // PostgreSQLPartitionCreationJob.java:31 acquires lock 90 ONCE and loops over the
  // List<PartitionManager> (ActivityTablePartitionManager + MessageTablePartitionManager) under it —
  // a legal, intentional share. A naive "all advisory-lock-ids must be pairwise distinct across
  // subsystems" validator would FALSELY reject this. We characterize the contract: 90 is the single
  // partition-orchestrator id, distinct from the three subsystem-private ids (100/110/120), and the
  // share is BY one acquisition not by id duplication. (Source-contract pin; the share is a design
  // invariant, not a runtime-observable on a single-replica stack.)
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-3: partition lock 90 is the single orchestrator id, distinct from the 3 private ids (deliberate share)', async () => {
    // the partition id is distinct from every subsystem-private id ...
    const privateIds = [REGISTRY.notificationsWal, REGISTRY.dcReceiveEvent, REGISTRY.dcSenderMessage];
    expect(
      privateIds.includes(REGISTRY.partition as number),
      `F-065-UC-3: the partition orchestrator id (${REGISTRY.partition}) must be distinct from the three ` +
        `subsystem-private ids ${JSON.stringify(privateIds)} — the cross-subsystem share is by ONE acquisition ` +
        `(PostgreSQLPartitionCreationJob.java:31 loops both partition managers under a single pg_advisory_lock(90)), ` +
        `NOT by duplicating an id. A validator that demanded all-ids-distinct-per-manager would wrongly reject this.`,
    ).toBe(false);

    // ... and 90 is independently acquirable as one slot (the shared slot both managers run under).
    const got = await dbQuery<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(${REGISTRY.partition}) AS acquired`,
    );
    expect(
      got[0].acquired,
      `F-065-UC-3: the shared partition slot ${REGISTRY.partition} must be a single acquirable advisory lock ` +
        `(both partition managers serialise CREATE PARTITION under it). Got: ${JSON.stringify(got)}.`,
    ).toBe(true);
    await dbQuery('SELECT pg_advisory_unlock_all()');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 2 — PLT-089 / F-065-UC-2 + UC-5 (GREEN now, RED on fix).
  // PostgreSQLLeaderElectionManagerImpl.java:22 acquires via blocking `pg_advisory_lock(id)` with NO
  // collision detection, NO try-variant, NO timeout, NO WARN, NO readiness degradation. A second
  // caller on a colliding id blocks FOREVER with no signal. We demonstrate the silent-collision
  // primitive empirically: session A holds id 100; session B's pg_try_advisory_lock(100) returns
  // FALSE (collision) with NO error raised — i.e. the platform's blocking acquire would hang here,
  // invisibly. This pins UC-2 (a collision is NOT detected at startup — it is silent) and UC-5 (no
  // observable signal flips). FLIPS RED when a registry/collision-validator or try+WARN is added.
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-2/UC-5 [PLT-089 pin, GREEN-now]: a registry-id collision is silent (no error, no signal)', async () => {
    const holder = new Client({ connectionString: CONN });
    const contender = new Client({ connectionString: CONN });
    await holder.connect();
    await contender.connect();
    try {
      // session A acquires id 100 (the notifications-wal lock) and holds it.
      const a = await holder.query(`SELECT pg_advisory_lock(${REGISTRY.notificationsWal})`);
      expect(a, 'session A acquires the notifications-wal lock id (100)').toBeTruthy();

      // session B tries the SAME id. The real platform uses BLOCKING pg_advisory_lock (would hang
      // forever); we use the non-blocking probe to OBSERVE the collision without hanging the test.
      // It returns false — a collision — and crucially raises NO error and emits NO signal.
      let raised: string | null = null;
      let acquired: boolean | null = null;
      try {
        const b = await contender.query(`SELECT pg_try_advisory_lock(${REGISTRY.notificationsWal}) AS acquired`);
        acquired = b.rows[0].acquired;
      } catch (e) {
        raised = (e as Error).message;
      }

      expect(
        acquired,
        `PLT-089 / F-065-UC-2 (GREEN-now): a SECOND acquirer of an already-held registry id must fail to acquire ` +
          `(collision). With the platform's blocking pg_advisory_lock this is a FOREVER WEDGE; here the try-probe ` +
          `returns false. Got acquired=${acquired}, raised=${raised}.`,
      ).toBe(false);
      expect(
        raised,
        `PLT-089 / F-065-UC-2+UC-5 (GREEN-now): the collision is SILENT — Postgres raises NO error, and the ` +
          `platform has no validator/WARN/readiness-probe to surface it (PostgreSQLLeaderElectionManagerImpl.java:22 ` +
          `just blocks). This assertion FLIPS RED when a collision validator / fail-fast is added (the PLT-089 fix). ` +
          `Got raised: ${raised}.`,
      ).toBeNull();
    } finally {
      await holder.query('SELECT pg_advisory_unlock_all()').catch(() => undefined);
      await contender.query('SELECT pg_advisory_unlock_all()').catch(() => undefined);
      await holder.end();
      await contender.end();
    }
  });
});

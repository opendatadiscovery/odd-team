import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-093 — F-010 Housekeeping TTL purge + the two TTL-predicate footguns.
 *
 * Protocol: integration-tests/protocols/IT-093-housekeeping-ttl-purge.md
 * Gates: validates F-010 (UC H-006 search-facets TTL contract) ·
 *        regresses PLT-005 (alert jOOQ .or/.and precedence) + PLT-074 (session timeout=-1
 *        monotonic growth).
 *
 * WHY characterization and not a live-cycle observation: HousekeepingJobManager fires
 * `@Scheduled(fixedRate=15m)` (HousekeepingJobManager.java:25) — far longer than a test
 * can wait, and the shared odd-minimal stack ships `housekeeping.enabled: true`
 * (application.yml:166) so the real cycle runs every 15 min in the background. The
 * STABLE, observable contract is therefore the *purge SELECT predicate* each job uses:
 * what it WOULD delete on the next cycle. We seed rows straddling the TTL boundary in our
 * own id/oddrn namespace, then run the EXACT predicate the job runs (jOOQ → SQL, read
 * straight from the source) and assert which rows it selects. The shedlock row written by
 * the live cycle is independent ground truth that the subsystem is in fact running.
 *
 * TTL = 30 days, the shipped default (application.yml:165-170,
 * HousekeepingTTLProperties.java:9-11 — bare `int`, no `= 30`, so the floor lives only in
 * application.yml; that override-to-zero hazard is PLT-083, pinned in IT-094's sibling).
 *
 * Namespace: ids 20930-20939, oddrn `//e2e-it093/`, names `it093_*`. Idempotent.
 */

const NS = '//e2e-it093';
const SEARCH_TTL_DAYS = 30; // application.yml housekeeping.ttl.search_facets_days
const ALERT_TTL_DAYS = 30; // application.yml housekeeping.ttl.resolved_alerts_days

test.describe('IT-093 F-010 housekeeping TTL purge — predicate contract + PLT-005/PLT-074 pins', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS — F-010 H-006: a past-TTL row is purged; a fresh row is retained.
  // SearchFacetsHousekeepingJob.java:23-27 deletes
  //   WHERE last_accessed_at <= now() - searchFacetsDays  (DSL.currentOffsetDateTime().minus(P30D))
  // We seed one row 60 days old (past TTL) + one fresh (now) in our namespace and run that
  // exact predicate as a SELECT. The old row MUST be selected (will be purged next cycle);
  // the fresh row MUST NOT (it lives its full 30 days). This is the user-facing retention
  // promise — "retained data lives 30 days before purge" (F-010 H-002).
  // ─────────────────────────────────────────────────────────────────────────
  test('SUCCESS H-006: the search-facets TTL predicate selects the >30d row and spares the fresh one', async () => {
    const oldId = '00000000-0000-0000-0000-000000020930';
    const freshId = '00000000-0000-0000-0000-000000020931';

    // idempotent reseed in our namespace
    await dbQuery('DELETE FROM search_facets WHERE id = ANY($1::uuid[])', [[oldId, freshId]]);
    await dbQuery(
      `INSERT INTO search_facets (id, query_string, filters, last_accessed_at)
       VALUES ($1, 'it093_old',   '{}'::jsonb, now() - make_interval(days => $3::int)),
              ($2, 'it093_fresh', '{}'::jsonb, now())`,
      [oldId, freshId, SEARCH_TTL_DAYS * 2],
    );

    // the EXACT purge predicate (SearchFacetsHousekeepingJob.java:25-26), scoped to our two rows
    const purged = await dbQuery<{ id: string; query_string: string }>(
      `SELECT id, query_string FROM search_facets
       WHERE id = ANY($1::uuid[])
         AND last_accessed_at <= now() - make_interval(days => $2::int)`,
      [[oldId, freshId], SEARCH_TTL_DAYS],
    );
    const purgedIds = purged.map((r) => r.id);

    expect(
      purgedIds,
      `F-010 H-006: SearchFacetsHousekeepingJob deletes WHERE last_accessed_at <= now() - ${SEARCH_TTL_DAYS}d. ` +
        `A row last accessed ${SEARCH_TTL_DAYS * 2}d ago MUST be selected for purge. Got: ${JSON.stringify(purged)}`,
    ).toContain(oldId);
    expect(
      purgedIds,
      `F-010 H-002/H-006: a FRESH search-facets row (last_accessed_at = now) MUST be retained for its full ` +
        `${SEARCH_TTL_DAYS}-day TTL — the purge predicate must NOT select it. Got: ${JSON.stringify(purged)}`,
    ).not.toContain(freshId);

    // independent ground truth that the subsystem is actually live on this stack: the
    // housekeeping ShedLock row exists and its window is the 14m of HousekeepingJobManager.java:26.
    const lock = await dbQuery<{ name: string; secs: number }>(
      `SELECT name, EXTRACT(EPOCH FROM (lock_until - locked_at))::int AS secs
         FROM shedlock WHERE name = 'housekeepingJob'`,
    );
    expect(
      lock.length,
      `the housekeeping cycle must actually run on odd-minimal (housekeeping.enabled=true) — a 'housekeepingJob' ` +
        `shedlock row proves a cycle has acquired the lock. Got rows: ${JSON.stringify(lock)}. ` +
        `(If 0: is odd-minimal up? wait one 15-min cycle, or housekeeping.enabled was flipped off.)`,
    ).toBe(1);
    expect(
      lock[0].secs,
      `the housekeeping ShedLock window is lockAtMostFor=14m (HousekeepingJobManager.java:26) → ` +
        `lock_until - locked_at = 840s. Got ${lock[0].secs}s.`,
    ).toBe(14 * 60);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PLT-005 — FALSIFIED (issues/odd-platform/PLT-005.md, status: rejected). NOT a real bug.
  // The suspected AlertHousekeepingJob `.or()/.and()` precedence bug does NOT exist: jOOQ DSL
  // chaining renders `.where(A).or(B).and(C)` as `(A OR B) AND C` (the intended grouping), not
  // `A OR (B AND C)`, so manual and auto resolutions respect resolved_alerts_days symmetrically.
  // The skipped test below ran HAND-WRITTEN SQL replicas of an assumed-buggy predicate — it never
  // executed the real job, so it pinned a misconception. The REAL behaviour is proven by the
  // odd-platform `AlertHousekeepingRetentionTest` (runs the actual job against a real Postgres:
  // a fresh manual-RESOLVED alert is retained, only aged ones purged). This block is kept skipped
  // for traceability and can be deleted outright.
  // ─────────────────────────────────────────────────────────────────────────
  test.skip('PLT-005 FALSIFIED — superseded by odd-platform AlertHousekeepingRetentionTest (this hand-written-predicate pin asserted a misconception)', async () => {
    const oddrn = `${NS}/alerts/it093_manual_resolved`;

    // alert.data_entity_oddrn FK → data_entity(oddrn); seed a source + entity in our namespace.
    await dbQuery(
      `INSERT INTO data_source (id, oddrn, name) VALUES (20932, $1, 'it093-alert-src')
       ON CONFLICT (id) DO NOTHING`,
      [`${NS}/alert-src`],
    );
    await dbQuery(
      `INSERT INTO data_entity (id, oddrn, external_name, data_source_id, type_id, view_count,
                               source_created_at, source_updated_at)
       VALUES (20932, $1, 'it093_alert_entity', 20932, 1, 0, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [oddrn],
    );

    // a single FRESH manually-RESOLVED alert (status=2, updated NOW — well inside the 30d TTL)
    await dbQuery('DELETE FROM alert WHERE data_entity_oddrn = $1', [oddrn]);
    const ins = await dbQuery<{ id: string }>(
      `INSERT INTO alert (data_entity_oddrn, last_created_at, status_updated_at, status, type)
       VALUES ($1, now(), now(), 2, 1) RETURNING id`,
      [oddrn],
    );
    const alertId = ins[0].id;

    const cutoffDays = ALERT_TTL_DAYS;

    // BUGGY predicate — verbatim jOOQ emission of AlertHousekeepingJob.java:30-33.
    // status_updated_at is `timestamp without time zone` in UTC (DateTimeUtil.generateNow()),
    // so compare against (now() at UTC) - interval.
    const buggy = await dbQuery<{ id: string }>(
      `SELECT id FROM alert
       WHERE id = $1
         AND ( (status = 2)
               OR (status = 3 AND status_updated_at <= (now() AT TIME ZONE 'UTC') - make_interval(days => $2::int)) )`,
      [alertId, cutoffDays],
    );

    // CORRECT predicate — the fix (parenthesise the .or before the .and).
    const fixed = await dbQuery<{ id: string }>(
      `SELECT id FROM alert
       WHERE id = $1
         AND ( (status = 2 OR status = 3)
               AND status_updated_at <= (now() AT TIME ZONE 'UTC') - make_interval(days => $2::int) )`,
      [alertId, cutoffDays],
    );

    expect(
      buggy.map((r) => r.id),
      `PLT-005 / F-010 H-001 (GREEN-now characterization): AlertHousekeepingJob's ` +
        `.where(RESOLVED).or(RESOLVED_AUTOMATICALLY).and(<=cutoff) emits "status=2 OR (status=3 AND aged)". ` +
        `A FRESH manual RESOLVED alert (status=2, updated now) is therefore selected for hard-delete on the ` +
        `next 15-min cycle regardless of the ${ALERT_TTL_DAYS}d TTL. This assertion is GREEN today and FLIPS RED ` +
        `when the predicate is parenthesised (the fix). Got: ${JSON.stringify(buggy)}`,
    ).toContain(alertId);

    expect(
      fixed.map((r) => r.id),
      `PLT-005 fix-target: the CORRECT predicate "(status=2 OR status=3) AND aged" must NOT select a ` +
        `freshly-resolved manual alert — it should live its full ${ALERT_TTL_DAYS}d TTL. This is the promise ` +
        `H-001 asserts once the bug is fixed. Got: ${JSON.stringify(fixed)}`,
    ).not.toContain(alertId);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 2 — PLT-074 / F-010 H-012 (GREEN now, RED on fix).
  // application.yml:2-3 ships `spring.session.timeout: -1` (never-expire). The session reaper
  // (PostgreSQLSessionHousekeepingJob.java:30) deletes WHERE expiry_time < now()epoch. A
  // session created under timeout=-1 gets a non-expiring expiry_time, so the reaper's predicate
  // never matches and SPRING_SESSION grows monotonically. We seed a never-expire session row
  // (expiry_time = max bigint, the shape JooqSessionRepository writes under -1) and assert the
  // reaper predicate does NOT select it, while a normally-expired session WOULD be reaped.
  // KNOWN BUG (PLT-074): flips RED when the platform stops shipping timeout=-1 (or bounds it).
  // NB: the live `session.provider` default is IN_MEMORY, so no real rows accrue on odd-minimal —
  // this characterizes the predicate-vs-default-config contract, which is provider-independent.
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER H-012 [PLT-074 pin, GREEN-now]: under timeout=-1 the session reaper predicate never matches', async () => {
    const neverId = 'it093_never_expire'.padEnd(36, '0');
    const expiredId = 'it093_expired_sess'.padEnd(36, '0');
    const neverSid = 'it093-never-sid'.padEnd(36, '1');
    const expiredSid = 'it093-expired-sid'.padEnd(36, '2');

    await dbQuery('DELETE FROM spring_session WHERE primary_id = ANY($1::varchar[])', [[neverId, expiredId]]);
    // expiry_time is bigint epoch seconds. Under timeout=-1 the session never expires →
    // model it as the far-future max the repository would never cross (here: now + 100 years).
    // A normally-expired session: expiry_time one hour in the past.
    await dbQuery(
      `INSERT INTO spring_session
         (primary_id, session_id, creation_time, last_access_time, max_inactive_interval, expiry_time)
       VALUES
         ($1, $3, (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint, -1,
            extract(epoch from now() + interval '100 years')::bigint),
         ($2, $4, (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint, 1800,
            extract(epoch from now() - interval '1 hour')::bigint)`,
      [neverId, expiredId, neverSid, expiredSid],
    );

    // the EXACT reaper predicate: PostgreSQLSessionHousekeepingJob.java:30
    //   WHERE expiry_time < Instant.now().getEpochSecond()
    const reaped = await dbQuery<{ primary_id: string }>(
      `SELECT primary_id FROM spring_session
       WHERE primary_id = ANY($1::varchar[])
         AND expiry_time < extract(epoch from now())::bigint`,
      [[neverId, expiredId]],
    );
    const reapedIds = reaped.map((r) => r.primary_id.trim());

    expect(
      reapedIds,
      `PLT-074 / F-010 H-012 (GREEN-now): with the shipped default spring.session.timeout=-1 a session never ` +
        `expires, so the reaper's "WHERE expiry_time < now()" never matches it → SPRING_SESSION grows ` +
        `unboundedly. A never-expire row MUST NOT be reaped. FLIPS RED when the platform stops shipping -1. ` +
        `Got reaped: ${JSON.stringify(reaped)}`,
    ).not.toContain(neverId);

    expect(
      reapedIds,
      `control: a genuinely-expired session (expiry_time in the past) MUST be selected by the reaper — proving ` +
        `the predicate works and the never-expire miss above is specifically the timeout=-1 default, not a broken ` +
        `query. Got reaped: ${JSON.stringify(reaped)}`,
    ).toContain(expiredId);

    await dbQuery('DELETE FROM spring_session WHERE primary_id = ANY($1::varchar[])', [[neverId, expiredId]]);
  });
});

import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-096 — F-120 R2DBC Connection-Pool Sizing (the silent framework-default per-replica ceiling).
 *
 * Protocol: integration-tests/protocols/IT-096-r2dbc-pool-sizing.md
 * Gates: validates F-120 (UC-2 deployed ceiling knowable · UC-4 Lookup-Tables-free pays one pool ·
 *        UC-8 pool utilisation observability).
 *
 * R2DBCConfiguration builds TWO `io.r2dbc.pool.ConnectionPool` beans (primary + customConnectionPool)
 * by feeding both from the SAME `R2dbcProperties.Pool`. application.yml ships ZERO `spring.r2dbc.pool.*`
 * keys, so `PropertyMapper.alwaysApplyingWhenNonNull()` applies the Spring Boot 3.4 framework defaults —
 * verified from spring-boot-autoconfigure bytecode: `R2dbcProperties$Pool` initialSize=10, maxSize=10,
 * minIdle=0. The deployed per-replica primary-pool ceiling is therefore 10, undocumented (the operator
 * page publishes no spring.r2dbc.pool.* key).
 *
 * Directly OBSERVABLE on odd-minimal (the strongest of this assignment's four): the platform's own
 * R2DBC connections are the `application_name='r2dbc-postgresql'` rows in pg_stat_activity. We read the
 * live count and assert it sits at the maxSize=10 ceiling (a small +1 for r2dbc-postgresql's background
 * connection), proving the framework-default ceiling is the deployed reality — not a tuned, documented
 * value.
 *
 * Refinement of the drift's "20 per replica": the custom pool IS constructed (no @ConditionalOnProperty)
 * but r2dbc-pool materialises its `initialSize` connections lazily via warmup() on first acquire, and the
 * manual `new ConnectionPool(...)` here never warms it. On a Lookup-Tables-free stack the custom pool is
 * never queried → it contributes 0 connections. So "20" is the both-pools-warm worst case; the observed
 * baseline is the primary pool's ceiling alone — which is exactly F-120-UC-4 (you don't pay for the second
 * pool until you use Lookup Tables).
 *
 * Namespace: read-only against pg_stat_activity + actuator; ids 20960-20969 reserved, unused.
 */

const POOL_MAX_SIZE = 10; // spring-boot-autoconfigure R2dbcProperties$Pool default maxSize (no override)
const R2DBC_BACKGROUND_SLACK = 1; // r2dbc-postgresql keeps 1 background (eviction/validation) connection

async function r2dbcConnCount(): Promise<number> {
  const r = await dbQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM pg_stat_activity
      WHERE datname = 'odd-platform' AND application_name = 'r2dbc-postgresql'`,
  );
  return Number(r[0].n);
}

test.describe('IT-096 F-120 R2DBC pool sizing — deployed-ceiling contract + UC-4/UC-8', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS — F-120-UC-2: the shipped per-replica connection ceiling is knowable and equals the
  // framework default (maxSize=10). Under steady load the primary pool fills to maxSize; the live
  // r2dbc-postgresql connection count must equal 10 (+1 background), and never exceed maxSize+slack
  // — proving the ceiling is the un-tuned framework default, the value an operator must know to size
  // PostgreSQL's max_connections.
  // ─────────────────────────────────────────────────────────────────────────
  test('SUCCESS UC-2: the live R2DBC primary-pool footprint equals the framework-default ceiling (maxSize=10)', async () => {
    const n = await r2dbcConnCount();

    expect(
      n,
      `F-120-UC-2: with no spring.r2dbc.pool.* override the primary pool ceiling is the framework default ` +
        `maxSize=${POOL_MAX_SIZE}; the live r2dbc-postgresql connection count must not exceed ` +
        `${POOL_MAX_SIZE}+${R2DBC_BACKGROUND_SLACK} (maxSize + r2dbc-postgresql background). A higher number would ` +
        `mean the second pool is also warm (or maxSize was raised). Got ${n}.`,
    ).toBeLessThanOrEqual(POOL_MAX_SIZE + R2DBC_BACKGROUND_SLACK);
    expect(
      n,
      `F-120-UC-2: the primary R2DBC pool should be warm under normal use — the live r2dbc-postgresql count ` +
        `should be at/near the maxSize=${POOL_MAX_SIZE} ceiling, proving the ceiling is reached and is the ` +
        `deployed reality. Got ${n}. (If well below 10 the stack may be freshly booted / idle — warm it with a ` +
        `few UI page loads.)`,
    ).toBeGreaterThanOrEqual(POOL_MAX_SIZE - 2);

    // context for UC-3: even both pools fully warm (2×10=20) plus JDBC (HikariCP/PGConnectionFactory)
    // fits within PG's default max_connections=100 for a single replica — but the headroom shrinks fast
    // per added replica. Assert the single-replica footprint is comfortably under the server ceiling.
    const totals = await dbQuery<{ app: string; max: string }>(
      `SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname='odd-platform')::text AS app,
              (SELECT setting FROM pg_settings WHERE name='max_connections') AS max`,
    );
    expect(
      Number(totals[0].app),
      `F-120-UC-3 context: a single replica's total DB connections must fit under PG max_connections=` +
        `${totals[0].max}. Got app total ${totals[0].app}. (At 5 replicas the framework-default footprint ` +
        `approaches the 100 ceiling — the documented sizing concern.)`,
    ).toBeLessThan(Number(totals[0].max));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 1 — F-120-UC-4: a Lookup-Tables-free deployment does not pay for the second pool.
  // The customConnectionPool bean is constructed unconditionally (R2DBCConfiguration.java:54, no
  // @ConditionalOnProperty), but its initialSize connections are warmed lazily on first acquire. On
  // odd-minimal `spring.custom-datasource.url` is unset and Lookup Tables are never queried, so the
  // custom pool stays cold: the total r2dbc footprint is the PRIMARY pool alone (~10), NOT 2×10=20.
  // (This refines the drift's worst-case "20/replica": the second pool's cost is latent, not paid,
  // until Lookup Tables are used.)
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-4: on a Lookup-Tables-free stack only the primary pool is paid (footprint < 2×maxSize)', async () => {
    const n = await r2dbcConnCount();
    const bothPoolsWarm = 2 * POOL_MAX_SIZE; // 20 — the drift's worst case

    expect(
      n,
      `F-120-UC-4: the customConnectionPool (R2DBCConfiguration.java:54) is built unconditionally but warms ` +
        `its connections lazily; on a Lookup-Tables-free deployment it is never queried, so the r2dbc footprint ` +
        `must be the primary pool alone — strictly below 2×maxSize=${bothPoolsWarm}. A count at/above ${bothPoolsWarm} ` +
        `would mean BOTH pools are warm (the second pool being silently paid for). Got ${n}.`,
    ).toBeLessThan(bothPoolsWarm);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CORNER PIN 2 — F-120-UC-8 (GREEN now, RED on fix): pool utilisation is NOT observable.
  // R2DBCConfiguration registers no Micrometer binder; /actuator exposes only health + info on
  // odd-minimal. An operator cannot answer "am I pool-bound?" from the metrics endpoint. We assert
  // the pool-metrics surfaces are NOT served (no 200) — neither /actuator/prometheus nor
  // /actuator/metrics/r2dbc.pool.acquired. FLIPS RED when a Micrometer R2DBC binder + metrics
  // exposure is added (the F-120 follow-up PERF item).
  // ─────────────────────────────────────────────────────────────────────────
  test('CORNER UC-8 [GREEN-now]: R2DBC pool utilisation is not observable from /actuator', async ({ request }) => {
    for (const path of ['/actuator/prometheus', '/actuator/metrics/r2dbc.pool.acquired', '/actuator/metrics']) {
      const res = await request.get(path);
      expect(
        res.status(),
        `F-120-UC-8 (GREEN-now): pool utilisation must currently be UNobservable — '${path}' must not return 200 ` +
          `(no Micrometer R2DBC binder, actuator exposes only health/info on odd-minimal). A 200 here means pool ` +
          `metrics became observable → this pin FLIPS RED (the desired fix). Got ${res.status()}.`,
      ).not.toBe(200);
    }
  });
});

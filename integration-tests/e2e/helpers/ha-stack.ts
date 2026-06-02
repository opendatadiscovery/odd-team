import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import * as path from 'node:path';
import { Client } from 'pg';

// Two-replica notifications stack for the ADR-0043 leader-election + failover test.
// The spec controls start order (A before B → A is the deterministic leader); the standby
// (B) blocks on the advisory lock BEFORE the WAL stream, so it never hits the PLT-139
// wedge — only a leader can wedge. __dirname is e2e/helpers.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-notifications-ha.docker-compose.yml',
);
const PROJECT = 'oddha';
const LEADER = 'probe-odd-platform-a';
const STANDBY = 'probe-odd-platform-b';
const A_HEALTH = 'http://localhost:18085/actuator/health';
const B_HEALTH = 'http://localhost:18086/actuator/health';
export const HA_DB_URL =
  process.env.ODD_HA_DB_URL ?? 'postgresql://odd-platform:odd-platform-password@localhost:15437/odd-platform';

const compose = (args: string) =>
  execSync(`docker-compose -p ${PROJECT} -f "${COMPOSE}" ${args}`, { stdio: 'inherit' });

async function db<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: HA_DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function waitHealth(url: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok && (await r.text()).includes('UP')) return;
    } catch {
      /* not up */
    }
    await sleep(3000);
  }
  throw new Error(`[ha] not healthy at ${url}`);
}

// granted advisory-lock holder pid (the current leader), or null if none.
export const leaderPid = (): Promise<number | null> =>
  db(async c => (await c.query("SELECT pid FROM pg_locks WHERE locktype='advisory' AND granted")).rows[0]?.pid ?? null);
// count of advisory locks currently being WAITED on (the blocked standby).
export const waitingCount = (): Promise<number> =>
  db(async c => Number((await c.query("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].count));

// Is the leader cleanly streaming (slot active + exactly one granted advisory lock)?
const isCleanLeader = (): Promise<boolean> =>
  db(async c => {
    const active = (await c.query("SELECT active FROM pg_replication_slots WHERE slot_name='odd_platform_replication_slot'")).rows[0]?.active;
    const granted = Number((await c.query("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted")).rows[0].count);
    return active === true && granted === 1;
  });

// Ensure the leader is a CLEAN stable leader. A fresh boot may hit the PLT-139 create-order
// wedge (slot before publication → the subscriber flaps the advisory lock, no stable
// leader). Recovery: with the publication now pre-existing, stop the leader, drop the slot,
// start it again → the slot is recreated AFTER the publication → no wedge. This is a
// documented test precondition for a separately-filed bug, not part of the assertion.
async function ensureCleanLeader(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (let i = 0; i < 15; i += 1) {
      if (await isCleanLeader()) return;
      await sleep(2000);
    }
    // wedged → un-wedge (PLT-139): stop leader, drop slot, start leader.
    // eslint-disable-next-line no-console
    console.log('[ha] leader appears wedged (PLT-139) — dropping slot + restarting to un-wedge…');
    execSync(`docker stop ${LEADER}`, { stdio: 'inherit' });
    await db(c =>
      c.query("SELECT pg_drop_replication_slot('odd_platform_replication_slot')").catch(() => undefined),
    );
    execSync(`docker start ${LEADER}`, { stdio: 'inherit' });
    await waitHealth(A_HEALTH);
  }
  throw new Error('[ha] could not obtain a clean stable leader (PLT-139 wedge persisted)');
}

// Bring up DB + leader A (clean), then standby B (blocks on the lock).
export async function upHaStack(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[ha] bringing up DB + leader A…');
  compose('up -d probe-database-ha probe-odd-platform-a');
  await waitHealth(A_HEALTH);
  await ensureCleanLeader();
  // eslint-disable-next-line no-console
  console.log('[ha] leader A is clean; bringing up standby B…');
  compose('up -d probe-odd-platform-b');
  await waitHealth(B_HEALTH);
  await sleep(3000); // let B reach + block on the advisory lock
}

export function killLeader(): void {
  execSync(`docker stop ${LEADER}`, { stdio: 'inherit' });
}

export async function downHaStack(): Promise<void> {
  try {
    compose('down -v');
  } catch {
    /* best-effort */
  }
}

export { STANDBY };

import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from 'pg';
import { composeCmd } from './docker';
import { composeUp } from './stack';

// INGESTION-GRADE dataset-pipeline stand (IT-145, adrs/drafts/ingestion-grade-e2e-stands.md
// — the ADR's named "dataset-structure stand" follow-on). Real source postgres + the REAL
// odd-collector (postgresql plugin) + the platform. The spec seeds NOTHING into the platform
// DB — every dataset/column/description/lineage edge asserted on arrives through the product
// pipeline. Mirrors helpers/ingestion-stack.ts (IT-128) and adds the mutate→re-collect loop:
//
//   mutateSource(sql)      — runs DDL/DML in the SOURCE warehouse (docker exec psql)
//   recollect()            — restarts the collector container → an immediate fresh startup pull
//   resolveEntityId(name)  — the ingested entity's platform id, by external_name (read-only)
//
// __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-ingestion-dataset.docker-compose.yml',
);
const PROJECT = 'oddingestds';
const SOURCE_CONTAINER = 'probe-ingestds-source-postgres';
const COLLECTOR_CONTAINER = 'probe-ingestds-collector';

// 127.0.0.1 (not localhost) — force IPv4 so node fetch / page.goto never resolve to ::1.
export const INGEST_BASE_URL = process.env.ODD_INGESTDS_BASE_URL ?? 'http://127.0.0.1:18089';
const PLATFORM_DB_URL = 'postgresql://odd-platform:odd-platform-password@127.0.0.1:15440/odd-platform';

export const upDatasetStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${INGEST_BASE_URL}/actuator/health`,
    label: 'ingestion dataset pipeline (source-postgres + collector-ready platform)',
  });

// Registers the collector through the REAL endpoint and returns the one-shot token value
// (POST /api/collectors → 201 Collector{token{value}} — wire is snake_case).
export async function registerCollector(name: string): Promise<string> {
  const r = await fetch(`${INGEST_BASE_URL}/api/collectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'IT-145 ingestion-grade dataset-pipeline stand' }),
  });
  if (!r.ok) throw new Error(`registerCollector: POST /api/collectors → ${r.status} ${await r.text()}`);
  const body = (await r.json()) as { token?: { value?: string } };
  const token = body.token?.value;
  if (!token) throw new Error(`registerCollector: no token.value in response: ${JSON.stringify(body)}`);
  return token;
}

// Starts the real odd-collector container with the freshly issued token (first pull).
export function startCollector(token: string): void {
  // eslint-disable-next-line no-console
  console.log('[e2e] starting the odd-collector container (profile: collector)…');
  execSync(
    `${composeCmd()} -p ${PROJECT} --profile collector -f "${COMPOSE}" up -d ${COLLECTOR_CONTAINER}`,
    { stdio: 'inherit', env: { ...process.env, COLLECTOR_TOKEN: token } },
  );
}

// Re-collect after a source mutation: restarting the container triggers a fresh STARTUP pull
// immediately (the collector also pulls every minute, but a restart is deterministic + fast).
// The token is already baked into the container's env from startCollector().
export function recollect(): void {
  // eslint-disable-next-line no-console
  console.log('[e2e] restarting the collector to force an immediate re-collection…');
  execSync(`docker restart ${COLLECTOR_CONTAINER}`, { stdio: 'inherit' });
}

// Run DDL/DML against the SOURCE warehouse (the "change a characteristic in postgres" step).
// SQL is fed on STDIN (not -c) so multi-line statements pass through cleanly — no shell
// quoting / newline-escaping traps. ON_ERROR_STOP so a bad statement fails loudly.
export function mutateSource(sql: string): void {
  execSync(`docker exec -i ${SOURCE_CONTAINER} psql -v ON_ERROR_STOP=1 -U warehouse -d warehouse`, {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

// Read-only platform-DB access for entity-id resolution + reconciliation checks. Reading the
// platform DB for assertions is the harness norm (playwright.config: "ground truth read
// straight from Postgres"); we never SEED it — every row under test arrived via the collector.
export async function queryPlatformDb<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: PLATFORM_DB_URL });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

// The ingested entity's platform id, by external_name (the source object name) — newest
// match, or null. (data_entity has no is_deleted column; deletion is modelled via `status`
// + `hollow`, surfaced by entityState() below for the deletion-phase assertion.)
export async function resolveEntityId(externalName: string): Promise<number | null> {
  const rows = await queryPlatformDb<{ id: string }>(
    `SELECT id FROM data_entity WHERE external_name = $1 ORDER BY id DESC`,
    [externalName],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

// The ingestion-reconciliation state of an entity (deletion phase): a source object dropped
// then re-collected is reconciled by the platform via `status` (e.g. DELETED) and/or `hollow`.
// Returns null when no row exists at all.
export async function entityState(
  externalName: string,
): Promise<{ id: number; status: string; hollow: boolean } | null> {
  const rows = await queryPlatformDb<{ id: string; status: string; hollow: boolean }>(
    `SELECT id, status, hollow FROM data_entity WHERE external_name = $1 ORDER BY id DESC`,
    [externalName],
  );
  return rows[0] ? { id: Number(rows[0].id), status: rows[0].status, hollow: rows[0].hollow } : null;
}

// Polls until the product pipeline has landed the expected truth (or times out). The
// collector pulls at startup; first ingestion usually lands well under a minute after start.
export async function waitForIngestion(
  predicate: () => Promise<boolean>,
  label: string,
  timeoutMs = 180_000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await predicate().catch(() => false)) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`[e2e] ingestion did not land within ${timeoutMs / 1000}s: ${label}`);
    }
    await sleep(5000);
  }
}

// Tears the WHOLE stand down (collector profile included) with volumes — fully ephemeral.
// The collector's log tail is dumped FIRST so a failed run keeps its diagnosis.
export function downDatasetStack(): void {
  try {
    // eslint-disable-next-line no-console
    console.log('[e2e] collector log tail (pre-teardown diagnostics):');
    execSync(`docker logs --tail 30 ${COLLECTOR_CONTAINER}`, { stdio: 'inherit' });
  } catch {
    /* collector may never have started */
  }
  try {
    execSync(`${composeCmd()} -p ${PROJECT} --profile collector -f "${COMPOSE}" down -v --remove-orphans`, {
      stdio: 'inherit',
      env: { ...process.env, COLLECTOR_TOKEN: 'unused-at-teardown' },
    });
  } catch {
    /* best-effort teardown */
  }
}

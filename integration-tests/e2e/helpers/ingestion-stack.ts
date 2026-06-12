import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { composeCmd } from './docker';
import { composeUp } from './stack';

// INGESTION-GRADE pipeline stand (IT-128, adrs/drafts/ingestion-grade-e2e-stands.md):
// real source systems (neo4j + a source postgres) + the REAL odd-collector + the platform.
// The spec seeds NOTHING into the platform DB — every entity asserted on arrives through
// the product pipeline: source system → collector plugin → ingestion API → platform.
//
// Token bootstrap is the real flow: registerCollector() calls POST /api/collectors and
// returns the ONE-SHOT token value; startCollector() hands it to the `collector` compose
// profile as $COLLECTOR_TOKEN. The token cannot be re-read later (one-shot reveal), which
// is why the stand is brought up FRESH per suite run and torn down with volumes.
//
// Worker-restart property (observed run 3, 2026-06-12): when a mid-suite failure makes
// Playwright restart the worker, beforeAll re-runs — that is SAFE here by construction:
// `up -d` on a live stand is a no-op, the platform accepts a duplicate collector name
// (a second registration + collector container re-ingests the SAME oddrn-keyed entities
// as upserts), and the end-of-run teardown removes everything regardless.
// __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-ingestion.docker-compose.yml',
);
const PROJECT = 'oddingest';

export const INGEST_BASE_URL = process.env.ODD_INGEST_BASE_URL ?? 'http://localhost:18087';
export const NEO4J_BROWSER_URL = 'http://localhost:17474';

export const upIngestionStack = (): Promise<void> =>
  composeUp({
    compose: COMPOSE,
    project: PROJECT,
    healthUrl: `${INGEST_BASE_URL}/actuator/health`,
    label: 'ingestion pipeline (neo4j + source-postgres + collector-ready platform)',
  });

// Registers the collector through the REAL endpoint and returns the one-shot token value
// (POST /api/collectors → 201 Collector{token{value}} — wire is snake_case).
export async function registerCollector(name: string): Promise<string> {
  const r = await fetch(`${INGEST_BASE_URL}/api/collectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'IT-128 ingestion-grade relationships stand' }),
  });
  if (!r.ok) throw new Error(`registerCollector: POST /api/collectors → ${r.status} ${await r.text()}`);
  const body = (await r.json()) as { token?: { value?: string } };
  const token = body.token?.value;
  if (!token) throw new Error(`registerCollector: no token.value in response: ${JSON.stringify(body)}`);
  return token;
}

// Starts the real odd-collector container with the freshly issued token.
export function startCollector(token: string): void {
  // eslint-disable-next-line no-console
  console.log('[e2e] starting the odd-collector container (profile: collector)…');
  execSync(`${composeCmd()} -p ${PROJECT} --profile collector -f "${COMPOSE}" up -d probe-ingest-collector`, {
    stdio: 'inherit',
    env: { ...process.env, COLLECTOR_TOKEN: token },
  });
}

// Polls until the product pipeline has landed the expected truth (or times out).
// The collector pulls on default_pulling_interval=1min and once at startup; first
// ingestion usually lands well under a minute after the container starts.
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

// Tears the WHOLE stand down (collector profile included) with volumes — the stand is
// fully ephemeral; the one-shot token dies with it. The collector's log tail is dumped
// FIRST so a failed run keeps its diagnosis (collection vs push vs auth) after `down -v`.
export function downIngestionStack(): void {
  try {
    // eslint-disable-next-line no-console
    console.log('[e2e] collector log tail (pre-teardown diagnostics):');
    execSync('docker logs --tail 30 probe-ingest-collector', { stdio: 'inherit' });
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

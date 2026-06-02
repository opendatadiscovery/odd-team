import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import * as path from 'node:path';

// Self-contained REMOTE/MinIO stack (postgres + MinIO@eu-west-1 + bucket-init + the
// platform with attachment.storage=REMOTE). Distinct ports/names/project from the
// odd-minimal stack the global setup runs, so the two coexist: this one is brought up
// and torn down by IT-008's own before/afterAll (the global setup never touches it).
//
// __dirname is e2e/helpers → three up to the workspace root.
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-minio.docker-compose.yml',
);
const PROJECT = 'oddminio';

export const MINIO_BASE_URL = process.env.ODD_MINIO_BASE_URL ?? 'http://localhost:18081';
export const MINIO_DB_URL =
  process.env.ODD_MINIO_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@localhost:15433/odd-platform';
const HEALTH = `${MINIO_BASE_URL}/actuator/health`;

// This stack is ALWAYS self-managed by the spec (it is dedicated — eu-west-1, REMOTE
// config); ODD_STACK_EXTERNAL (which governs the shared odd-minimal stack) does not
// apply. Run a focused IT-008 with ODD_STACK_EXTERNAL=1 to skip the unused odd-minimal
// bring-up while this stack still comes up.
export async function upMinioStack(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[e2e] bringing up the REMOTE/MinIO stack (eu-west-1)…');
  execSync(`docker-compose -p ${PROJECT} -f "${COMPOSE}" up -d`, { stdio: 'inherit' });
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(HEALTH);
      if (r.ok && (await r.text()).includes('UP')) {
        // eslint-disable-next-line no-console
        console.log(`[e2e] MinIO-stack platform healthy after ~${i * 3}s`);
        return;
      }
    } catch {
      /* not up yet */
    }
    await sleep(3000);
  }
  throw new Error(`[e2e] MinIO-stack platform not healthy at ${HEALTH} within ~180s`);
}

export async function downMinioStack(): Promise<void> {
  try {
    execSync(`docker-compose -p ${PROJECT} -f "${COMPOSE}" down -v`, { stdio: 'inherit' });
  } catch {
    /* best-effort teardown */
  }
}

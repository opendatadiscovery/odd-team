import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import * as path from 'node:path';
import { composeCmd } from './helpers/docker';

// Bring up the odd-minimal stack (platform + Postgres) the e2e specs run against.
// Reuses the SAME compose file the API-probe runtime uses — one stack definition,
// owned by odd-team. Set ODD_STACK_EXTERNAL=1 to skip (run against your own stack).
const COMPOSE = path.resolve(
  __dirname,
  '../../lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml',
);
const HEALTH = `${process.env.ODD_BASE_URL ?? 'http://127.0.0.1:18080'}/actuator/health`;

export default async function globalSetup(): Promise<void> {
  if (process.env.ODD_STACK_EXTERNAL === '1') {
    console.log('[e2e] ODD_STACK_EXTERNAL=1 — using an already-running stack; skipping bring-up.');
    return;
  }
  console.log('[e2e] bringing up odd-minimal stack…');
  execSync(`${composeCmd()} -f "${COMPOSE}" up -d`, { stdio: 'inherit' });

  // Platform start_period is ~30s; poll its actuator health until UP.
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(HEALTH);
      if (res.ok && (await res.text()).includes('UP')) {
        console.log(`[e2e] platform healthy after ~${i * 3}s`);
        return;
      }
    } catch {
      /* not up yet */
    }
    await sleep(3000);
  }
  throw new Error(`[e2e] platform did not become healthy at ${HEALTH} within ~90s`);
}

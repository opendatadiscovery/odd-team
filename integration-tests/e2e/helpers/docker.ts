import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import * as path from 'node:path';

// Recreate ONLY the platform container — the docker analogue of a Kubernetes pod
// restart / a redeploy: a fresh container with a fresh writable layer and fresh
// anonymous volumes, while the database container (and its data) is left untouched.
// This is exactly the operational event that triggers LSN-001: anything the platform
// wrote to its own ephemeral filesystem (LOCAL attachment storage at
// /tmp/odd/attachments) is gone, but the attachment's DB record survives.
//
// Uses the SAME compose file the harness brings up (global-setup.ts). `--force-recreate`
// replaces the container; `--renew-anon-volumes` (-V) ensures any anonymous volume the
// image might declare for /tmp is reset too (a K8s restart gets fresh storage either
// way); `--no-deps` leaves probe-database (and its volume) running so DB state persists.
// __dirname is integration-tests/e2e/helpers → three up to the workspace root.
// (global-setup.ts uses ../../ because it sits one level higher, in e2e/.)
const COMPOSE = path.resolve(
  __dirname,
  '../../../lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml',
);
const PLATFORM_SERVICE = 'probe-odd-platform';
const HEALTH = `${process.env.ODD_BASE_URL ?? 'http://localhost:18080'}/actuator/health`;

export async function recreatePlatformContainer(): Promise<void> {
  if (process.env.ODD_STACK_EXTERNAL === '1') {
    throw new Error(
      'recreatePlatformContainer(): this protocol recreates the platform container to ' +
        'prove LOCAL-storage data loss — not supported against an external stack. ' +
        'Unset ODD_STACK_EXTERNAL and let the harness manage the odd-minimal stack.',
    );
  }
  // eslint-disable-next-line no-console
  console.log('[e2e] recreating the platform container (fresh ephemeral storage; DB kept)…');
  execSync(
    `docker-compose -f "${COMPOSE}" up -d --force-recreate --renew-anon-volumes --no-deps ${PLATFORM_SERVICE}`,
    { stdio: 'inherit' },
  );
  // The fresh container's start_period is ~30s; poll its actuator health until UP.
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(HEALTH);
      if (res.ok && (await res.text()).includes('UP')) {
        // eslint-disable-next-line no-console
        console.log(`[e2e] platform healthy again after ~${i * 3}s`);
        return;
      }
    } catch {
      /* not up yet */
    }
    await sleep(3000);
  }
  throw new Error(`[e2e] platform did not become healthy at ${HEALTH} within ~120s after recreate`);
}

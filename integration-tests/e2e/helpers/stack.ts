import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Generic ephemeral docker-compose stack lifecycle for the self-managed, mode-specific
// stacks a spec brings up/tears down itself (the SHARED odd-minimal stack is handled by
// global-setup; these are the extra stacks — REMOTE/MinIO, LOGIN_FORM, LDAP, … — each on
// a distinct project + ports so they coexist). Used via thin per-stack wrappers
// (minio-stack.ts, loginform-stack.ts).

export interface StackOpts {
  compose: string; // absolute path to the compose file
  project: string; // docker-compose -p project (isolates names/network)
  healthUrl: string; // platform actuator health URL to poll
  label: string; // human label for logs
}

export async function composeUp(opts: StackOpts): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[e2e] bringing up the ${opts.label} stack…`);
  execSync(`docker-compose -p ${opts.project} -f "${opts.compose}" up -d`, { stdio: 'inherit' });
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(opts.healthUrl);
      if (r.ok && (await r.text()).includes('UP')) {
        // eslint-disable-next-line no-console
        console.log(`[e2e] ${opts.label} healthy after ~${i * 3}s`);
        return;
      }
    } catch {
      /* not up yet */
    }
    await sleep(3000);
  }
  throw new Error(`[e2e] ${opts.label} platform not healthy at ${opts.healthUrl} within ~180s`);
}

export async function composeDown(opts: { compose: string; project: string }): Promise<void> {
  try {
    execSync(`docker-compose -p ${opts.project} -f "${opts.compose}" down -v`, { stdio: 'inherit' });
  } catch {
    /* best-effort teardown */
  }
}

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { composeCmd } from './docker';

/**
 * The DEMO STAND — odd-platform's own `docker/demo.yaml`, driven exactly as `docker/README.md`
 * Step 1 tells a first-time evaluator to drive it. IT-154's stand.
 *
 * Deliberately NOT a `lineage/_extractor/probe-stacks/` profile and deliberately NOT routed
 * through `stack.ts`'s `composeUp`:
 *   - the compose file IS the artifact under test, so copying it into a probe-stack profile
 *     would test the copy, not the thing shipped to users;
 *   - `composeUp` does `up -d` (every service) and then polls for health itself. This stand
 *     must run `up -d odd-platform-enricher` — the documented command, one service — and the
 *     WHOLE POINT is that compose blocks that command until the platform is healthy. Measuring
 *     that is the test; re-implementing the wait in the harness would hide it.
 * `composeCmd()` IS reused: it carries the real knowledge (prefer the v2 plugin; legacy v1
 * crashes on container recreate against modern engines).
 *
 * The platform image is the published `ghcr.io/opendatadiscovery/odd-platform:latest`, because
 * that is what `docker/demo.yaml` pins and therefore what a user actually runs. It is PULLED
 * before every run and its digest recorded — otherwise the gate silently inherits whatever
 * months-old tag the local cache happens to hold (LSN-032/LSN-033).
 */

// __dirname is integration-tests/e2e/helpers → three up to the workspace root.
const WORKSPACE = path.resolve(__dirname, '../../../');
const PLATFORM_DIR = process.env.ODD_PLATFORM_DIR ?? path.resolve(WORKSPACE, '../odd-platform');

export const DEMO_COMPOSE = path.join(PLATFORM_DIR, 'docker/demo.yaml');
export const DEMO_PORTS_OVERRIDE = path.join(__dirname, 'demo-stand.ports.yml');
export const DEMO_PROJECT = process.env.ODD_DEMO_PROJECT ?? 'oddemo154';
export const DEMO_BASE_URL = process.env.ODD_DEMO_BASE_URL ?? 'http://localhost:18095';
export const DEMO_IMAGE = 'ghcr.io/opendatadiscovery/odd-platform:latest';

const files = `-f "${DEMO_COMPOSE}" -f "${DEMO_PORTS_OVERRIDE}"`;

export function demoCompose(args: string, opts: { timeoutMs?: number } = {}): string {
  return execSync(`${composeCmd()} -p ${DEMO_PROJECT} ${files} ${args}`, {
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 600_000,
    cwd: PLATFORM_DIR,
  });
}

/** Pull the published platform image and return the digest this run is actually testing. */
export function pullPlatformImage(): string {
  execSync(`docker pull -q ${DEMO_IMAGE}`, { stdio: 'ignore', timeout: 600_000 });
  return execSync(`docker image inspect ${DEMO_IMAGE} --format '{{index .RepoDigests 0}}'`, {
    encoding: 'utf8',
  }).trim();
}

/**
 * Run the documented Step-1 command and return how long it blocked. On a fixed stand that is
 * ~60-90s (compose waits for the platform's healthcheck); on the unfixed stand it returns in
 * seconds, because nothing is waiting for anything.
 */
export function upEnricher(): number {
  const started = Date.now();
  demoCompose('up -d odd-platform-enricher');
  return Date.now() - started;
}

/**
 * The moment the platform's healthcheck FIRST passed, as an ISO string.
 *
 * Must be read while the stand is still fresh: `.State.Health.Log` is a FIVE-ENTRY RING BUFFER,
 * so on a stand that has been up for a couple of minutes the oldest entry it still holds is a
 * recent probe, not the transition. Reading it at teardown reports a time ~20s in the past and
 * makes an ordering assertion fail against a perfectly correct stand — measured, on the first
 * run of this spec. `{{json ...}}` is used rather than `{{.Start}}` because Go's default time
 * rendering ("... +0200 CEST") is not parseable by Date.parse; the JSON encoding is RFC3339Nano.
 */
export function firstHealthyAt(container: string): string | null {
  // `null` when the service declares no healthcheck at all — which is exactly the state of the
  // UNFIXED demo stand, so this must return cleanly rather than throw, or the RED proof reads as
  // a harness crash instead of as the finding it is.
  // The NIL GUARD is in the Go template, not just around JSON.parse: `{{json .State.Health.Log}}`
  // does not return "null" when the service has no healthcheck, it makes `docker inspect` EXIT
  // NON-ZERO ("can't evaluate field Log in type *types.Health"), which throws out of execSync. On
  // the unfixed stand that happens inside beforeAll and skips every remaining assertion — measured,
  // on the first RED run of this spec, which reported 3 failed / 4 did not run instead of naming
  // each regression.
  const raw = inspect(container, '{{if .State.Health}}{{json .State.Health.Log}}{{else}}null{{end}}');
  const log = JSON.parse(raw) as Array<{ Start: string; ExitCode: number }> | null;
  const passed = (log ?? []).find((entry) => entry.ExitCode === 0);
  return passed ? passed.Start : null;
}

export function inspect(container: string, format: string): string {
  return execSync(`docker inspect -f '${format}' ${DEMO_PROJECT}-${container}-1`, {
    encoding: 'utf8',
  }).trim();
}

/** `.State.Health` is absent entirely when the service declares no healthcheck. */
export function healthStatus(container: string): string | null {
  const raw = inspect(container, '{{if .State.Health}}{{.State.Health.Status}}{{else}}NONE{{end}}');
  return raw === 'NONE' ? null : raw;
}

export function waitForEnricherExit(timeoutMs = 600_000): number {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (inspect('odd-platform-enricher', '{{.State.Status}}') === 'exited') {
      return Number(inspect('odd-platform-enricher', '{{.State.ExitCode}}'));
    }
    execSync('sleep 3');
  }
  throw new Error('[IT-154] the enricher never exited');
}

export function enricherLog(): string {
  return execSync(`docker logs ${DEMO_PROJECT}-odd-platform-enricher-1 2>&1`, { encoding: 'utf8' });
}

export function downDemoStand(): void {
  try {
    demoCompose('down -v', { timeoutMs: 180_000 });
  } catch {
    /* best-effort teardown */
  }
}

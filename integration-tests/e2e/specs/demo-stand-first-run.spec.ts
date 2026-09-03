import { test, expect } from '@playwright/test';
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  DEMO_BASE_URL,
  downDemoStand,
  enricherLog,
  healthStatus,
  inspect,
  firstHealthyAt,
  pullPlatformImage,
  upEnricher,
  waitForEnricherExit,
} from '../helpers/demo-stand';

/**
 * IT-154 — the demo stand delivers what docker/README.md Step 1 promises.
 *
 * Protocol: integration-tests/protocols/IT-154-demo-stand-first-run.md
 * Gates: regresses PLT-255 (odd-platform#1870) — the enricher losing the start-up race, and the
 *        08_s3_ingestion.json oddrn typo that silently dropped the 10th data source.
 *
 * WHY this is an integration test and not a unit test: both defects are only observable when the
 * real compose orchestration runs. Defect 1 is a race between two containers; defect 2 is a data
 * mismatch whose only symptom is a catalog that is quietly one data source short. Neither is
 * visible to anything that does not actually stand the demo up.
 *
 * MEASURED ON THE UNFIXED BASE (odd-platform 969a5d5b) so the RED half is evidence, not argument:
 *   - `.State.Health` is ABSENT on odd-platform — the file declares no healthcheck at all;
 *   - `up -d odd-platform-enricher` returns in seconds, and the enricher then polls a platform
 *     that needs 50-65s with a fixed ~40s budget: it lost twice on the maintainer's machine
 *     (the platform bound its port 15.1s AFTER the enricher had already exited 1) and won once
 *     here by 8.8s, decided by how long `pip install requests` happened to take;
 *   - `GET /api/datasources` -> 9, `//s3/cloud/aws` absent, `transaction_dataset` -> 0 results;
 *   - a sample naming an undefined data source prints one `Skipping` line and the run exits 0.
 *
 * Self-contained: brings up its own demo stand on 18095/15495 in beforeAll and tears it down in
 * afterAll. The platform image is the PUBLISHED ghcr `:latest` — that is what docker/demo.yaml
 * pins and therefore what a user runs — pulled fresh each run and its digest logged, so a green
 * result names the binary it was green against (LSN-032/LSN-033).
 */

const PLATFORM_DIR = process.env.ODD_PLATFORM_DIR ?? path.resolve(__dirname, '../../../../odd-platform');
const INJECTOR_DIR = path.join(PLATFORM_DIR, 'injector');
const SAMPLE_DIR = path.join(PLATFORM_DIR, 'docker/config/injector');
const PY_IMAGE = 'python:3.9.12-alpine3.15'; // the image docker/demo.yaml runs the enricher on

let upDurationMs = 0;
let enricherExit = -1;
// Captured in beforeAll, NOT in the assertion: .State.Health.Log is a 5-entry ring buffer and the
// transition has rolled out of it by teardown (see firstHealthyAt).
let platformFirstHealthy: string | null = null;
let enricherStartedAt = '';

const execAsync = promisify(exec);

/**
 * Run injector/inject.py exactly as the compose file does, against a chosen sample dir.
 *
 * ASYNC ON PURPOSE — do not "simplify" this back to `execSync`. Case 9 serves the stand-in Platform
 * from an http server inside THIS process, and `execSync` blocks Node's event loop for the whole
 * container run: the stub's socket is accepted by the kernel and then never answered, so the injector
 * sees `Read timed out` on every attempt and burns its entire readiness budget. Measured, on the first
 * run of case 9 — and it reads as a hang with no output at all, because a container killed by the exec
 * timeout never flushes python's block-buffered stdout. (`PYTHONUNBUFFERED` below is what
 * docker/demo.yaml sets, and is what makes such a run legible in the first place.)
 *
 * The exit code lives on `err.code` for `exec`, NOT on `err.status` as it does for `execSync` — reading
 * the wrong one silently turns every failure into `1` and makes the code assertions meaningless.
 */
async function runInjector(
  sampleDir: string,
  env: Record<string, string>,
  extraDockerArgs = '',
): Promise<{ code: number; out: string }> {
  const flags = Object.entries({ PYTHONUNBUFFERED: '1', ...env })
    .map(([k, v]) => `-e ${k}='${v}'`)
    .join(' ');
  const cmd =
    `docker run --rm ${extraDockerArgs} -v "${INJECTOR_DIR}":/injector -v "${sampleDir}":/samples ${flags} ` +
    `${PY_IMAGE} sh ./injector/start.sh 2>&1`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
    return { code: 0, out: stdout };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/**
 * A throwaway stand-in for the Platform that accepts everything EXCEPT the ingestion call.
 *
 * Case 9 needs an injection to fail for a reason that is not a configuration error, which is the one
 * shape the other cases cannot produce: cases 7 and 8 never reach the Platform at all. Rather than
 * depend on the real `400 USR003` (an upstream alert-uniqueness defect — PLT-014 — that would make this
 * spec's verdict hostage to someone else's fix), the failure is injected here deterministically, with
 * the same status and body shape the real Platform returns.
 *
 * Bound on port 0 so the OS picks a free port — nothing to collide with, nothing to reserve. The
 * injector container runs with `--network host` so `127.0.0.1` inside it is this process's loopback.
 */
function startStubPlatform(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '';
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    req.resume(); // drain the request body; the injector POSTs the whole sample
    if (url.startsWith('/actuator/health')) return send(200, { status: 'UP' });
    if (url.startsWith('/api/datasources') && req.method === 'GET') return send(200, { items: [] });
    if (url.startsWith('/api/datasources')) return send(200, { token: { value: 'stub-token' } });
    if (url.startsWith('/ingestion/entities')) {
      return send(400, {
        code: 'USR003',
        message: 'Database constraint violation',
        retryable: false,
        resolvable: true,
      });
    }
    return send(404, { message: 'not stubbed' });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as import('node:net').AddressInfo;
      resolve({
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

test.describe('IT-154 the demo stand delivers its documented first run', () => {
  // ONE test, SOFT assertions — not six tests, and not `serial`. Both of those were tried against
  // the unfixed base and both are wrong here:
  //   - `serial` stops at the first failure, so a red result cannot say WHICH defect regressed,
  //     and telling them apart is the entire job of assertions 4/5/6 (an empty catalog is the
  //     start-up race; a nine-source catalog is the oddrn typo);
  //   - six independent tests DO each report, but Playwright discards the worker after a failed
  //     test and starts a fresh one, which re-runs `beforeAll` — measured: on the base tree every
  //     red assertion rebuilt the whole demo stand, ~2 minutes each.
  // `expect.soft` gives what both were reaching for: every assertion reports, on one stand, in one
  // pass. The stand is expensive and shared; the assertions are independent reads of it.
  test.describe.configure({ timeout: 900_000 });

  test.beforeAll(async () => {
    downDemoStand(); // any leftover from an aborted run
    const digest = pullPlatformImage();
    // eslint-disable-next-line no-console
    console.log(`[IT-154] platform image under test: ${digest}`);
    upDurationMs = upEnricher();
    // eslint-disable-next-line no-console
    console.log(`[IT-154] \`up -d odd-platform-enricher\` blocked for ${Math.round(upDurationMs / 1000)}s`);
    // Read the ordering evidence NOW, while the health log still holds the transition.
    platformFirstHealthy = firstHealthyAt('odd-platform');
    enricherStartedAt = inspect('odd-platform-enricher', '{{.State.StartedAt}}');
    enricherExit = waitForEnricherExit();
  });

  test.afterAll(() => {
    downDemoStand();
  });

  test('the documented Step-1 command produces the documented result', async ({ page, request }) => {
    // 1 — the platform publishes readiness at all. On the unfixed stand `.State.Health` is absent.
    expect.soft(healthStatus('odd-platform'), 'odd-platform must declare a healthcheck').not.toBeNull();
    expect.soft(healthStatus('odd-platform'), 'and reach healthy').toBe('healthy');
    expect.soft(healthStatus('database'), 'database must declare a healthcheck and reach healthy').toBe('healthy');

    // 2 — the ordering, not the wall-clock duration: a duration threshold would assert machine
    // speed, and the property under test is the gate, not how fast the platform boots.
    expect.soft(platformFirstHealthy, 'the platform must have a passing health probe on record').not.toBeNull();
    if (platformFirstHealthy) {
      expect
        .soft(
          Date.parse(enricherStartedAt) >= Date.parse(platformFirstHealthy),
          `the enricher must not start before the platform is healthy ` +
            `(healthy at ${platformFirstHealthy}, enricher started ${enricherStartedAt})`,
        )
        .toBe(true);
    }

    // 3 — the run completed, and completed WHOLE.
    expect.soft(enricherExit, 'the enricher must exit 0').toBe(0);
    expect.soft(enricherLog(), 'no sample may be skipped for an undefined data source').not.toContain('Skipping');
    expect.soft(enricherLog(), 'no sample may fail to inject').not.toContain('were NOT injected');

    // 4 — the count docker/README.md Step 1 and the published Try-locally page both promise.
    const res = await request.get(`${DEMO_BASE_URL}/api/datasources?page=1&size=1000`);
    expect.soft(res.ok(), 'the catalog API must answer').toBe(true);
    const items = res.ok() ? ((await res.json()).items as Array<{ oddrn: string; name: string }>) : [];
    expect.soft(items.length, 'docker/README.md Step 1 promises 10 predefined data sources').toBe(10);
    expect
      .soft(items.map((i) => i.oddrn), "the S3 sample's data source is the one that used to be dropped")
      .toContain('//s3/cloud/aws');

    // 5 — separates the two defects: an EMPTY catalog is the start-up race, a NINE-source catalog
    // is the oddrn typo. Without this, a red 4 cannot tell you which one regressed.
    expect
      .soft(await search(request, 'kds_clickstream'), 'the catalog must actually hold ingested entities')
      .toBeGreaterThan(0);

    // 6 — the S3 sample's own entities.
    expect
      .soft(
        await search(request, 'transaction_dataset'),
        'the S3 sample injected 2 entities; before the oddrn fix it injected none',
      )
      .toBeGreaterThan(0);

    // 6b — and the operator SEES it, on the page the README sends them to.
    const list = page.waitForResponse(
      (r) => /\/api\/datasources(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto(`${DEMO_BASE_URL}/management/datasources`);
    await list;
    await expect
      .soft(
        page.getByText('Data Lake S3').first(),
        'the 10th data source must be rendered, not merely present in the API',
      )
      .toBeVisible({ timeout: 15_000 });
  });
});


test.describe('IT-154 the injector refuses to under-deliver, with no platform involved', () => {
  // Each case runs `pip install requests` in a throwaway container before the injector starts;
  // that is ~15s on a warm index and can be minutes on a cold or slow one. The default 60s would
  // make these flaky for a reason that has nothing to do with what they assert.
  test.describe.configure({ timeout: 300_000 });

  test('7 a sample naming an undefined data source fails the run loudly, before any waiting', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'it154-'));
    fs.cpSync(SAMPLE_DIR, tmp, { recursive: true });
    const broken = path.join(tmp, 'samples/08_s3_ingestion.json');
    const payload = JSON.parse(fs.readFileSync(broken, 'utf8'));
    payload.data_source_oddrn = '//s3/cloud/nowhere';
    fs.writeFileSync(broken, JSON.stringify(payload));

    // PLATFORM_HOST_URL points at a closed port on purpose: validation must happen BEFORE the
    // readiness wait, so this returns in seconds rather than burning the whole budget.
    const { code, out } = await runInjector(tmp, { PLATFORM_HOST_URL: 'http://127.0.0.1:9' });
    fs.rmSync(tmp, { recursive: true, force: true });

    expect(code, `a sample set that cannot be delivered must fail the run:\n${out}`).not.toBe(0);
    expect(out).toContain('08_s3_ingestion.json');
    expect(out).toContain('//s3/cloud/nowhere');
    expect(out, 'nothing may be injected when the sample set is invalid').toContain('Nothing has been injected');
    expect(out, 'validation must precede the readiness wait').not.toContain('Waiting for the platform');
  });

  test('8 run standalone, the readiness budget is tunable and the give-up message says what to do', async () => {
    const { code, out } = await runInjector(SAMPLE_DIR, {
      PLATFORM_HOST_URL: 'http://127.0.0.1:9',
      REACH_TRIES_NUMBER: '2',
      REACH_RETRY_DELAY_SECONDS: '1',
    });

    expect(code, `an unreachable platform must fail the run:\n${out}`).not.toBe(0);
    expect(out, 'the tries knob must be honoured').toContain('attempt 2 of 2');
    expect(out, 'the give-up message must name the knob to raise').toContain('REACH_TRIES_NUMBER');
    expect(out, 'and why a first start is slow').toContain('migration set');
  });

  // 9 — the OTHER half of "stop reporting success while under-delivering", and the one GATE-1
  // decision D1 turns on. Cases 7 and 8 cover the two paths that never reach the Platform; this is
  // the path that does, and whose old behaviour was a bare `except:` printing a GUESS
  // ("Possibly the 'ingestion.filter.enabled' property is set to 'true'") and carrying on. That
  // guess was measurably wrong on the real stand — the actual answer was 400 USR003 — so what this
  // asserts is that the reader is now handed the Platform's own words instead of ours.
  //
  // RED ON BASE: the unfixed injector prints neither the status, nor the body, nor any closing
  // summary; it prints the guess and exits 0. Every assertion below except the exit code fails there.
  test('9 an injection failure is reported with the platform\'s real answer, and summarised at the end', async () => {
    const stub = await startStubPlatform();
    try {
      const { code, out } = await runInjector(
        SAMPLE_DIR,
        {
          PLATFORM_HOST_URL: `http://127.0.0.1:${stub.port}`,
          REACH_TRIES_NUMBER: '5',
          REACH_RETRY_DELAY_SECONDS: '1',
        },
        '--network host',
      );

      // D1: loud, but NOT fatal — a runtime rejection may be upstream or transient, and a red
      // container on every repeat `up` is worse for a demo than a loud summary. The exit code is
      // deliberately 0, which is exactly why the summary has to carry the whole signal.
      expect(code, `an injection failure must NOT fail the run (GATE-1 D1):\n${out}`).toBe(0);

      // the platform's own answer, not a guess about a property that is not even set.
      // `HTTP 400` rather than a bare `400`, so the match cannot be satisfied by some incidental
      // number elsewhere in forty lines of output.
      expect(out, 'the real HTTP status must be reported').toContain('HTTP 400');
      expect(out, "the platform's own response body must be reported").toContain('USR003');
      expect(out, 'the old guess must be gone').not.toContain("Possibly the 'ingestion.filter.enabled'");

      // and again in a closing summary, because a single line among forty is what hid this before.
      // The summary must be the LAST thing printed — buried mid-log it is as invisible as the line
      // it replaced — so everything below is asserted on the text AFTER the summary header, not on
      // the whole output (where the per-failure lines would satisfy it on their own).
      const summaryAt = out.indexOf('were NOT injected');
      expect(summaryAt, 'a closing summary must name the incomplete run').toBeGreaterThan(-1);

      const lastInjectLine = out.lastIndexOf('Data source has been created');
      expect(summaryAt, 'the summary must come AFTER the per-sample lines').toBeGreaterThan(lastInjectLine);

      const summary = out.slice(summaryAt);
      expect(summary, 'the summary itself must name every file that failed').toContain(
        '01_airflow_ingestion.json',
      );
      expect(summary, "and carry the platform's answer, not just the file name").toContain('USR003');
    } finally {
      await stub.close();
    }
  });
});

async function search(
  request: import('@playwright/test').APIRequestContext,
  query: string,
): Promise<number> {
  const created = await request.post(`${DEMO_BASE_URL}/api/search`, {
    data: { query, filters: {} },
    headers: { 'Content-Type': 'application/json' },
  });
  const searchId = (await created.json()).search_id as string;
  const results = await request.get(`${DEMO_BASE_URL}/api/search/${searchId}/results?page=1&size=10`);
  return ((await results.json()).items ?? []).length;
}

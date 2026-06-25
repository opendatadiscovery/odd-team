import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-144 — DQ dashboard correctly accounts for run statuses incl. RUNNING (#1794).
 *
 * Protocol: integration-tests/protocols/IT-144-dq-dashboard-runstatus-accounting.md
 * Gates: validates F-032 (Quality Dashboard) · regresses 1794.
 *
 * Drives the REAL ingestion path (POST /ingestion/entities) so insertLastRuns runs, then reads the
 * catalog-wide dashboard (GET /api/dataqatests/runs) filtered to this spec's own datasource (the suite
 * shares one DB). RED on pre-#1794 main: the in-flight RUNNING run 500s on ingestion (NPE in the task-run
 * mapper); the breakdown never counts RUNNING; Table Health has no Unknown bucket and mis-rates non-failing
 * statuses. GREEN on the fix.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://127.0.0.1:18080';
const NS = 'it144';
const DS = `//${NS}`;

interface RunSpec {
  status: string;
  start: string;
  end?: string;
}

interface Item {
  oddrn: string;
  name: string;
  type: string;
  metadata?: unknown[];
  dataset?: { field_list: unknown[] };
  data_quality_test?: {
    suite_name: string;
    dataset_list: string[];
    expectation: { type: string; category: string };
  };
  data_quality_test_run?: {
    data_quality_test_oddrn: string;
    start_time: string;
    status: string;
    end_time?: string;
  };
}

async function ensureDatasource(): Promise<void> {
  const res = await fetch(`${BASE}/api/datasources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `${NS}-src`, oddrn: DS, namespace_name: `${NS}-ns` }),
  });
  if (!res.ok && res.status !== 400) {
    throw new Error(`datasource register -> ${res.status}: ${await res.text()}`);
  }
}

async function ingest(items: Item[]): Promise<number> {
  const res = await fetch(`${BASE}/ingestion/entities`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data_source_oddrn: DS, items }),
  });
  await res.text().catch(() => undefined);
  return res.status;
}

const table = (name: string): Item => ({
  oddrn: `${DS}/db/${name}`,
  name,
  type: 'TABLE',
  metadata: [],
  dataset: { field_list: [] },
});

const dqTest = (name: string, datasetOddrn: string, category: string): Item => ({
  oddrn: `${DS}/test/${name}`,
  name,
  type: 'JOB',
  metadata: [],
  data_quality_test: {
    suite_name: `${name}-suite`,
    dataset_list: [datasetOddrn],
    expectation: { type: 'assert', category },
  },
});

const run = (testName: string, idx: number, spec: RunSpec): Item => ({
  oddrn: `${DS}/test/${testName}/run/${idx}`,
  name: `${testName}-run-${idx}`,
  type: 'JOB_RUN',
  data_quality_test_run: {
    data_quality_test_oddrn: `${DS}/test/${testName}`,
    start_time: spec.start,
    status: spec.status,
    ...(spec.end ? { end_time: spec.end } : {}),
  },
});

function breakdownFor(dash: any, categoryDescription: string): Record<string, number> {
  const category = (dash.test_results ?? []).find((c: any) => c.category === categoryDescription);
  const out: Record<string, number> = {};
  (category?.results ?? []).forEach((r: any) => {
    out[r.status] = r.count;
  });
  return out;
}

test.describe('IT-144 DQ dashboard — account for run statuses incl. RUNNING (#1794)', () => {
  test('in-flight runs ingest + are counted, and Table Health uses the priority cascade incl. Unknown', async ({
    request,
    page,
  }) => {
    await ensureDatasource();

    // ---- Defect 1: a test (t1) whose latest run is an in-flight RUNNING run; t2 stays completed SUCCESS ----
    expect(
      await ingest([
        table('tbl1'),
        dqTest('t1', `${DS}/db/tbl1`, 'ASSERTION'),
        dqTest('t2', `${DS}/db/tbl1`, 'ASSERTION'),
        run('t1', 1, { status: 'SUCCESS', start: '2026-06-01T10:00:00+00:00', end: '2026-06-01T10:01:00+00:00' }),
        run('t2', 1, { status: 'SUCCESS', start: '2026-06-01T10:00:00+00:00', end: '2026-06-01T10:01:00+00:00' }),
      ]),
      'the completed-run ingestion must succeed',
    ).toBe(200);

    // The in-flight run (no end_time) must ingest. On pre-#1794 main this returns 500 (NPE in the task-run
    // ingestion mapper, which unconditionally read end_time) — this assertion is the RED proof.
    expect(
      await ingest([run('t1', 2, { status: 'RUNNING', start: '2026-06-01T11:00:00+00:00' })]),
      'an in-flight RUNNING run (no end_time) must ingest with 200, not 500',
    ).toBe(200);

    // ---- Defect 2: tables covering the cascade (SCHEMA_CHANGE category, to keep the ASSERTION breakdown clean) ----
    const cascade: Array<{ name: string; status: string; inFlight?: boolean }> = [
      { name: 'failed', status: 'FAILED' },
      { name: 'broken', status: 'BROKEN' },
      { name: 'unknown', status: 'UNKNOWN' },
      { name: 'success', status: 'SUCCESS' },
      { name: 'running', status: 'RUNNING', inFlight: true },
    ];
    const items: Item[] = [];
    for (const c of cascade) {
      items.push(table(`tbl_${c.name}`), dqTest(`t_${c.name}`, `${DS}/db/tbl_${c.name}`, 'SCHEMA_CHANGE'));
      items.push(
        run(`t_${c.name}`, 1, {
          status: c.status,
          start: '2026-06-02T10:00:00+00:00',
          ...(c.inFlight ? {} : { end: '2026-06-02T10:01:00+00:00' }),
        }),
      );
    }
    expect(await ingest(items), 'the cascade ingestion (incl. an in-flight RUNNING) must succeed').toBe(200);

    // ---- read the dashboard, isolated to this spec's datasource ----
    const rows = await dbQuery<{ id: string }>('SELECT id FROM data_source WHERE oddrn = $1', [DS]);
    const datasourceId = Number(rows[0]?.id);
    expect(datasourceId, 'the it144 datasource must exist after ingestion').toBeGreaterThan(0);

    const resp = await request.get(`${BASE}/api/dataqatests/runs?datasourceIds=${datasourceId}`);
    expect(resp.status()).toBe(200);
    const dash = await resp.json();

    // Defect 1 — the in-flight run is counted as RUNNING in the Test Results Breakdown (t1); t2 stays SUCCESS.
    const assertion = breakdownFor(dash, 'Assertion Tests');
    expect(assertion.RUNNING ?? 0, 'an in-flight test counts as RUNNING in the breakdown').toBe(1);
    expect(assertion.SUCCESS ?? 0, 'the completed test stays SUCCESS').toBe(1);

    // Defect 2 — the Table Health priority cascade incl. the new Unknown bucket.
    const health = dash.tables_dashboard.tables_health;
    expect(health.error_tables, 'FAILED -> Error').toBe(1);
    expect(health.warning_tables, 'BROKEN (no FAILED) -> Warning').toBe(1);
    expect(health.unknown_tables, 'UNKNOWN (no FAILED/BROKEN) -> the new Unknown bucket').toBe(1);
    expect(
      health.healthy_tables,
      'SUCCESS, in-flight RUNNING, and tbl1 (success+running, no failure) -> Healthy',
    ).toBe(3);

    // ---- UI smoke: the dashboard renders the new data shape (unknown_tables) without crashing ----
    await page.goto('/data-quality');
    await expect(page.getByText('Table Health')).toBeVisible();
    await expect(page.getByText('Test Results Breakdown')).toBeVisible();
  });
});

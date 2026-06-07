import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-059 — F-040 DQ Test Run History (paginated /runs).
 *
 * Protocol: integration-tests/protocols/IT-059-dq-run-history.md
 * Gates: validates F-040 (per-DQ-test run history; pagination + ordering; RUNNING 500).
 *
 * SUCCESS (F-040-UC-1, confirmed promise): a DQ test with several ingested runs returns a
 *   most-recent-first (end_time DESC), correctly paginated timeline; the union across pages
 *   is every run, once each, globally ordered.
 * CORNER 1 (F-040-UC-2, contradicted promise → RED-characterization pin, LSN-029): a run with
 *   status RUNNING makes the endpoint 500 — the DB enum has 7 values (incl. RUNNING), the wire
 *   enum DataEntityRunStatus has 6 (no RUNNING), and DataEntityRunMapper's MapStruct Enum.valueOf
 *   throws. The page is unavailable exactly while a test is in flight. KNOWN BUG (PLT-needed).
 * CORNER 2 (F-040-UC-4, contradicted promise): filtering by an unmappable status (RUNNING, or any
 *   invalid literal) 500s at param-binding, not 400; a valid filter (FAILED) returns 200.
 *
 * GROUND-BEFORE-ASSERT (curl-probed live 2026-06-07): runs shape =
 *   {items:[{id,oddrn,name,...,start_time,end_time,status_reason,status}], page_info:{total,hasNext}};
 *   5 runs at size 2 → page1=2 newest hasNext=true total=5, page3=1 oldest hasNext=false;
 *   a RUNNING DB row ⇒ 500; status=RUNNING/BANANA ⇒ 500; status=FAILED ⇒ 200 filtered.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const NS = 'it059';
const dsOddrn = `//${NS}/db/tables/sales`;
const dqOddrn = `//${NS}/ge/test/dq1`;
const RUN_COUNT = 5;

interface IngestItem {
  oddrn: string;
  name: string;
  type: string;
  metadata?: unknown[];
  dataset?: { field_list: unknown[] };
  data_quality_test?: { suite_name: string; dataset_list: string[]; expectation: { type: string } };
  data_quality_test_run?: {
    data_quality_test_oddrn: string;
    start_time: string;
    end_time: string;
    status: string;
    status_reason?: string;
  };
}

async function ingest(items: IngestItem[]): Promise<void> {
  const ds = await fetch(`${BASE}/api/datasources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `${NS}-src`, oddrn: `//${NS}`, namespace_name: `${NS}-ns` }),
  });
  if (!ds.ok && ds.status !== 400) throw new Error(`datasource register -> ${ds.status}: ${await ds.text()}`);
  const res = await fetch(`${BASE}/ingestion/entities`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data_source_oddrn: `//${NS}`, items }),
  });
  if (!res.ok) throw new Error(`ingest -> ${res.status}: ${await res.text()}`);
}

async function idByOddrn(oddrn: string): Promise<number> {
  const rows = await dbQuery<{ id: string }>('SELECT id FROM data_entity WHERE oddrn = $1', [oddrn]);
  expect(rows[0], `entity ${oddrn} must exist after ingestion`).toBeTruthy();
  return Number(rows[0].id);
}

// Seed a DQ test with RUN_COUNT runs, strictly increasing end_times (run i ends on day i),
// a mix of statuses, and a status_reason on the oldest. Idempotent via ingestion upsert.
async function seedRuns(): Promise<number> {
  const statuses = ['FAILED', 'SUCCESS', 'SUCCESS', 'BROKEN', 'SUCCESS']; // run 1..5
  const items: IngestItem[] = [
    { oddrn: dsOddrn, name: 'it059_sales', type: 'TABLE', metadata: [], dataset: { field_list: [] } },
    {
      oddrn: dqOddrn,
      name: 'it059_dq',
      type: 'JOB',
      metadata: [],
      data_quality_test: { suite_name: 'it059_suite', dataset_list: [dsOddrn], expectation: { type: 'expect_x' } },
    },
  ];
  for (let i = 1; i <= RUN_COUNT; i += 1) {
    const day = String(i).padStart(2, '0');
    items.push({
      oddrn: `${dqOddrn}/run/${i}`,
      name: `it059_run_${i}`,
      type: 'JOB_RUN',
      data_quality_test_run: {
        data_quality_test_oddrn: dqOddrn,
        start_time: `2026-06-${day}T10:00:00+00:00`,
        end_time: `2026-06-${day}T10:01:00+00:00`,
        status: statuses[i - 1],
        ...(i === 1 ? { status_reason: 'it059: col age had 3 nulls' } : {}),
      },
    });
  }
  await ingest(items);
  return idByOddrn(dqOddrn);
}

interface RunItem {
  oddrn: string;
  end_time: string;
  status: string;
  status_reason: string | null;
}
async function getRuns(dqId: number, page: number, size: number, status?: string) {
  const q = status ? `&status=${status}` : '';
  const res = await fetch(`${BASE}/api/dataentities/${dqId}/runs?page=${page}&size=${size}${q}`);
  const body = res.ok ? await res.json() : null;
  return { status: res.status, body };
}

test.describe('IT-059 F-040 — DQ test run history (paginated)', () => {
  test('SUCCESS (UC-1): runs paginate and order by end_time DESC; the union across pages is every run once', async () => {
    const dqId = await seedRuns();

    // page 1 of 3 (size 2): the 2 newest, hasNext=true, total=5
    const p1 = await getRuns(dqId, 1, 2);
    expect(p1.status, 'runs history must be 200 for a DQ test').toBe(200);
    expect(p1.body.items.length, 'page 1 size 2 returns 2 rows').toBe(2);
    expect(p1.body.page_info.total, 'page_info.total counts all seeded runs').toBe(RUN_COUNT);
    expect(p1.body.page_info.hasNext, 'more pages remain after page 1').toBe(true);
    // most-recent-first within the page
    expect(
      new Date(p1.body.items[0].end_time).getTime() >= new Date(p1.body.items[1].end_time).getTime(),
      'items are ordered end_time DESC within a page',
    ).toBe(true);

    const p2 = await getRuns(dqId, 2, 2);
    const p3 = await getRuns(dqId, 3, 2);
    expect(p3.body.items.length, 'last page (3) has the single remaining row').toBe(1);
    expect(p3.body.page_info.hasNext, 'no pages remain after the last').toBe(false);

    // union across pages = all 5 seeded runs, each exactly once, globally end_time DESC
    const all: RunItem[] = [...p1.body.items, ...p2.body.items, ...p3.body.items];
    const oddrns = all.map(r => r.oddrn);
    expect(new Set(oddrns).size, 'no run is duplicated across page boundaries').toBe(RUN_COUNT);
    for (let i = 1; i <= RUN_COUNT; i += 1) {
      expect(oddrns, `run ${i} appears exactly once across the pages`).toContain(`${dqOddrn}/run/${i}`);
    }
    const times = all.map(r => new Date(r.end_time).getTime());
    const sortedDesc = [...times].sort((a, b) => b - a);
    expect(times, 'the concatenated pages are globally ordered by end_time DESC').toEqual(sortedDesc);

    // the oldest run (run 1, on page 3) carries the verbatim status_reason — rendered as-is
    const oldest = all.find(r => r.oddrn === `${dqOddrn}/run/1`);
    expect(oldest?.status_reason, 'status_reason is returned verbatim (the F-040 diagnostic-text channel)').toBe(
      'it059: col age had 3 nulls',
    );
  });

  test('CORNER 1 (UC-2): a RUNNING run makes the whole history endpoint 500 [RED-characterization]', async () => {
    const dqId = await seedRuns();
    const runningOddrn = `${dqOddrn}/run/RUNNING1`;

    // A collector writes a RUNNING row (end_time NULL) for an in-flight execution — a real DB state.
    await dbQuery('DELETE FROM data_entity_task_run WHERE oddrn = $1', [runningOddrn]);
    await dbQuery(
      `INSERT INTO data_entity_task_run (oddrn, task_oddrn, start_time, end_time, status, type, name)
       VALUES ($1, $2, NOW(), NULL, 'RUNNING', 'DATA_QUALITY_TEST_RUN', 'it059 in-flight')`,
      [runningOddrn, dqOddrn],
    );
    try {
      const res = await getRuns(dqId, 1, 30);
      // KNOWN BUG (PLT-needed): wire enum DataEntityRunStatus (6 values, no RUNNING) vs DB
      // IngestionTaskRunStatus (7, incl RUNNING) — DataEntityRunMapper's MapStruct Enum.valueOf
      // throws IllegalArgumentException → HTTP 500. The history page is unavailable EXACTLY while
      // a test is in flight (the moment an operator most wants it). Pin the CURRENT 500 (LSN-029):
      // RED-flips when the mapper tolerates unknown literals or RUNNING is added to the wire enum.
      expect(
        res.status,
        'a RUNNING run currently 500s the entire runs page (wire/DB enum asymmetry). If this is now ' +
          '200, the mapper was made tolerant or RUNNING was added to the wire enum — flip this pin.',
      ).toBe(500);
    } finally {
      // never let the poison row leak into other specs / re-runs
      await dbQuery('DELETE FROM data_entity_task_run WHERE oddrn = $1', [runningOddrn]);
    }
  });

  test('CORNER 2 (UC-4): an unmappable status filter 500s (not 400); a valid filter returns 200 filtered [characterization]', async () => {
    const dqId = await seedRuns();

    // RUNNING is documented at the DB tier but absent from the wire enum → the controller's
    // generated enum param binding 500s instead of returning 400 Bad Request. Same for any
    // invalid literal. Pin the current 500-on-unmappable-filter (LSN-029) — flips if a 400 lands.
    const running = await getRuns(dqId, 1, 10, 'RUNNING');
    expect(running.status, 'status=RUNNING (not a wire enum value) currently 500s, not 400').toBe(500);

    const garbage = await getRuns(dqId, 1, 10, 'BANANA');
    expect(garbage.status, 'an invalid status literal currently 500s, not 400').toBe(500);

    const failed = await getRuns(dqId, 1, 10, 'FAILED');
    expect(failed.status, 'a valid status filter returns 200').toBe(200);
    expect(
      failed.body.items.every((r: RunItem) => r.status === 'FAILED'),
      'the FAILED filter returns only FAILED runs',
    ).toBe(true);
    expect(failed.body.items.length, 'exactly the one seeded FAILED run matches').toBe(1);
  });
});

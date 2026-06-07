import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-058 — F-022 Per-Dataset DQ Test Reports & SLA.
 *
 * Protocol: integration-tests/protocols/IT-058-dq-test-reports-sla.md
 * Gates: validates F-022 (per-dataset DQ read surface + SLA badge/JSON).
 *
 * SUCCESS (F-022-UC-08 + the read surface): a dataset with one ingested DQ test + run
 * exposes a coherent surface — list (dataqatests), test_report aggregate, SLA PNG badge,
 * SLA JSON report.
 * CORNER 1 (F-022-UC-01): /sla is image/png and /sla_report is application/json — the
 * content-types do not swap (the load-bearing F-022 doc-drift, pinned at the wire).
 * CORNER 2 (F-022-UC-03, contradicted promise → characterization pin, LSN-029): the test
 * list for a dataset with ZERO tests returns 404 (USR002), not 200+[]. We pin the CURRENT
 * 404 so it RED-flips if the empty-state promise is ever honoured.
 *
 * GROUND-BEFORE-ASSERT: every shape below was first curl-probed live (2026-06-07) —
 *   test_report = {score,total,success_total,...}; sla_report = {total,success,sla_colour,
 *   severity_weights:[...],sla_ref}; sla = image/png; empty list = 404 USR002.
 * Seeding goes through the REAL ingestion API so data_entity.specific_attributes is
 * populated — a hand-built DQ entity with null specific_attributes makes the list endpoint
 * NPE→500 (DataEntityMapperImpl.mapDataQualityTest:367), which is a malformed-entity path,
 * not this feature's promise.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const NS = 'it058';
const dsOddrn = `//${NS}/db/tables/sales`;
const dqOddrn = `//${NS}/ge/test/dq1`;
const bareDsOddrn = `//${NS}/db/tables/bare`; // a dataset with NO DQ test (empty-list 404 corner)

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

async function seed(): Promise<{ dsId: number; dqId: number; bareDsId: number }> {
  await ingest([
    { oddrn: dsOddrn, name: 'it058_sales', type: 'TABLE', metadata: [], dataset: { field_list: [] } },
    { oddrn: bareDsOddrn, name: 'it058_bare', type: 'TABLE', metadata: [], dataset: { field_list: [] } },
    {
      oddrn: dqOddrn,
      name: 'it058_dq',
      type: 'JOB',
      metadata: [],
      data_quality_test: { suite_name: 'it058_suite', dataset_list: [dsOddrn], expectation: { type: 'expect_x' } },
    },
    {
      oddrn: `${dqOddrn}/run/1`,
      name: 'it058_run_1',
      type: 'JOB_RUN',
      data_quality_test_run: {
        data_quality_test_oddrn: dqOddrn,
        start_time: '2026-06-01T10:00:00+00:00',
        end_time: '2026-06-01T10:01:00+00:00',
        status: 'SUCCESS',
      },
    },
  ]);
  return { dsId: await idByOddrn(dsOddrn), dqId: await idByOddrn(dqOddrn), bareDsId: await idByOddrn(bareDsOddrn) };
}

test.describe('IT-058 F-022 — per-dataset DQ test reports & SLA', () => {
  test('SUCCESS: the per-dataset DQ read surface composes (list + report + SLA badge + SLA JSON)', async ({
    request,
  }) => {
    const { dsId, dqId } = await seed();

    // ---- list dataqatests: 200 + the seeded test with its suite_name ----
    const list = await request.get(`${BASE}/api/datasets/${dsId}/dataqatests`);
    expect(list.status(), 'dataqatests list must be 200 for a dataset that has a test').toBe(200);
    const listBody = await list.json();
    const ids = (listBody.items ?? []).map((i: { id: number }) => i.id);
    expect(ids, 'the list must contain the seeded DQ test').toContain(dqId);
    const seededItem = (listBody.items ?? []).find((i: { id: number }) => i.id === dqId);
    expect(seededItem.suite_name, 'the seeded suite_name must round-trip on the list item').toBe('it058_suite');

    // ---- test_report: 200 + counts reflect the single SUCCESS run ----
    const report = await request.get(`${BASE}/api/datasets/${dsId}/test_report`);
    expect(report.status()).toBe(200);
    const reportBody = await report.json();
    expect(reportBody.total, 'test_report total must count the one seeded run').toBe(1);
    expect(reportBody.success_total, 'the one run is SUCCESS').toBe(1);
    expect(reportBody.failed_total).toBe(0);

    // ---- /sla: 200 image/png (the BI badge) ----
    const sla = await request.get(`${BASE}/api/datasets/${dsId}/sla`);
    expect(sla.status()).toBe(200);
    expect(
      sla.headers()['content-type'],
      'the /sla endpoint returns the PNG badge (NOT JSON) — the F-022 doc-drift reality',
    ).toContain('image/png');
    expect((await sla.body()).length, 'the PNG body must be non-empty').toBeGreaterThan(0);

    // ---- /sla_report: 200 application/json DataSetSLAReport ----
    const slaReport = await request.get(`${BASE}/api/datasets/${dsId}/sla_report`);
    expect(slaReport.status()).toBe(200);
    expect(
      slaReport.headers()['content-type'],
      'the /sla_report endpoint returns JSON (NOT the PNG) — the sibling of /sla',
    ).toContain('application/json');
    const slaBody = await slaReport.json();
    expect(['GREEN', 'YELLOW', 'RED'], 'sla_colour is one of the three statuses').toContain(slaBody.sla_colour);
    expect(slaBody.sla_ref, 'sla_ref self-links to the PNG endpoint').toContain(`/api/datasets/${dsId}/sla`);
    expect(Array.isArray(slaBody.severity_weights), 'severity_weights breakdown is present').toBe(true);
  });

  test('CORNER (F-022-UC-03): the DQ test list for a dataset with zero tests returns 404, not 200+[] [characterization]', async ({
    request,
  }) => {
    const { bareDsId } = await seed();

    const res = await request.get(`${BASE}/api/datasets/${bareDsId}/dataqatests`);
    // KNOWN BUG (PLT-needed): the empty test list is a 404 (USR002), not the REST-conventional
    // 200 + []. F-022-UC-03's promise ("empty state, not an error") is unmet. Pin the CURRENT
    // 404 so this RED-flips the day the service returns an empty collection instead (LSN-029).
    expect(
      res.status(),
      'a dataset with NO DQ tests currently returns 404 (DataQualityServiceImpl.java:38-42). ' +
        'If this is now 200, the empty-state promise was honoured — flip this characterization pin.',
    ).toBe(404);
    const body = await res.json();
    expect(body.code, 'the 404 carries the USR002 not-found code').toBe('USR002');
  });
});

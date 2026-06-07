import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-057 — F-057 DQ Test Severity Lifecycle (Minor / Major / Critical).
 *
 * Protocol: integration-tests/protocols/IT-057-dq-severity-lifecycle.md
 * Gates: validates F-057 (severity set/change → SLA colour; gate; history).
 *
 * SUCCESS (F-057-UC-002, confirmed promise): raising a FAILING test's severity MINOR→MAJOR
 *   flips the dataset SLA YELLOW→RED with NO run-status change (severity alone drives colour).
 * CORNER 1 (F-057-UC-005, contradicted under DISABLED): the severity PUT is declared
 *   permission-gated (DATASET_TEST_RUN_SET_SEVERITY, SecurityConstants.java:243-246), but
 *   under AUTH_TYPE=DISABLED the authorization framework is bypassed, so an ANONYMOUS caller
 *   can set severity. Documented dev-only posture — characterized here (LSN-001 family).
 * CORNER 2 (F-057-UC-006, contradicted promise → characterization pin, LSN-029): the write is
 *   an UPSERT on (data_quality_test_id, dataset_id) with no version/history column; after 3
 *   changes the DB holds ONE row with only the latest value. Prior severities are unrecoverable.
 *
 * GROUND-BEFORE-ASSERT (curl-probed live 2026-06-07 against SLACalculator):
 *   one FAILING test → MINOR ⇒ YELLOW (allMinorsFailed), MAJOR ⇒ RED (allMajorsFailed),
 *   CRITICAL ⇒ RED (anyCriticalFailed). Anon PUT under DISABLED ⇒ 200 with severity echoed back.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const NS = 'it057';
const dsOddrn = `//${NS}/db/tables/sales`;
const dqOddrn = `//${NS}/ge/test/dq1`;

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

// Seed a dataset + DQ test + one run, and force the test's LAST run to FAILED so that
// severity (not run status) governs the SLA colour. Idempotent via the ingestion upsert.
async function seedFailingTest(): Promise<{ dsId: number; dqId: number }> {
  await ingest([
    { oddrn: dsOddrn, name: 'it057_sales', type: 'TABLE', metadata: [], dataset: { field_list: [] } },
    {
      oddrn: dqOddrn,
      name: 'it057_dq',
      type: 'JOB',
      metadata: [],
      data_quality_test: { suite_name: 'it057_suite', dataset_list: [dsOddrn], expectation: { type: 'expect_x' } },
    },
    {
      oddrn: `${dqOddrn}/run/1`,
      name: 'it057_run_1',
      type: 'JOB_RUN',
      data_quality_test_run: {
        data_quality_test_oddrn: dqOddrn,
        start_time: '2026-06-01T10:00:00+00:00',
        end_time: '2026-06-01T10:01:00+00:00',
        status: 'FAILED',
      },
    },
  ]);
  // the SLA reads data_entity_task_last_run.status — pin it FAILED (ground-truth driver)
  await dbQuery(`UPDATE data_entity_task_last_run SET status = 'FAILED' WHERE task_oddrn = $1`, [dqOddrn]);
  return { dsId: await idByOddrn(dsOddrn), dqId: await idByOddrn(dqOddrn) };
}

// Anonymous severity PUT (no auth header). Under AUTH_TYPE=DISABLED this is accepted.
async function putSeverity(dsId: number, dqId: number, severity: 'MINOR' | 'MAJOR' | 'CRITICAL') {
  return fetch(`${BASE}/api/datasets/${dsId}/dataqatests/${dqId}/severity`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ severity }),
  });
}

async function slaColour(dsId: number): Promise<string> {
  const res = await fetch(`${BASE}/api/datasets/${dsId}/sla_report`);
  expect(res.ok, 'sla_report must read back').toBe(true);
  return (await res.json()).sla_colour;
}

test.describe('IT-057 F-057 — DQ test severity lifecycle', () => {
  test('SUCCESS (UC-002): raising a failing test MINOR→MAJOR flips the SLA YELLOW→RED with no run-status change', async () => {
    const { dsId, dqId } = await seedFailingTest();

    const r1 = await putSeverity(dsId, dqId, 'MINOR');
    expect(r1.status, 'severity PUT (MINOR) must succeed').toBe(200);
    expect(
      await slaColour(dsId),
      'a single FAILING test at MINOR severity aggregates to YELLOW (SLACalculator allMinorsFailed)',
    ).toBe('YELLOW');

    const r2 = await putSeverity(dsId, dqId, 'MAJOR');
    expect(r2.status, 'severity PUT (MAJOR) must succeed').toBe(200);
    expect(
      await slaColour(dsId),
      'raising the SAME failing test to MAJOR flips the dataset to RED — severity alone drove the ' +
        'colour, no test run changed (SLACalculator allMajorsFailed). This is the F-057-UC-002 promise.',
    ).toBe('RED');

    // and the controller echoes the new severity on the returned entity (write took effect)
    const r3 = await putSeverity(dsId, dqId, 'CRITICAL');
    expect(r3.status).toBe(200);
    expect((await r3.json()).severity, 'the returned data entity carries the just-set severity').toBe('CRITICAL');
    expect(await slaColour(dsId), 'a failing CRITICAL test is RED (anyCriticalFailed)').toBe('RED');
  });

  test('CORNER 1 (UC-005): under AUTH_TYPE=DISABLED the permission-gated severity PUT is reachable anonymously [characterization]', async () => {
    const { dsId, dqId } = await seedFailingTest();

    // No auth header at all. The PUT is declared gated by DATASET_TEST_RUN_SET_SEVERITY
    // (SecurityConstants.java:243-246), but DISABLED → DisabledAuthSecurityConfiguration permitAll
    // bypasses the whole authorization framework. Characterize the open posture (LSN-001).
    const res = await putSeverity(dsId, dqId, 'MAJOR');
    expect(
      res.status,
      'under DISABLED an anonymous caller can set severity (the documented dev-only open posture). ' +
        'If this is now 401/403, DISABLED stopped being fully-open — a behaviour change worth knowing.',
    ).toBe(200);
    expect((await res.json()).severity).toBe('MAJOR');
  });

  test('CORNER 2 (UC-006): successive severity changes overwrite in place — no history is retained [characterization]', async () => {
    const { dsId, dqId } = await seedFailingTest();

    await (await putSeverity(dsId, dqId, 'MINOR')).text();
    await (await putSeverity(dsId, dqId, 'MAJOR')).text();
    await (await putSeverity(dsId, dqId, 'CRITICAL')).text();

    // KNOWN BUG (PLT-needed): the upsert keeps a SINGLE row per (test,dataset) with no version /
    // history (ReactiveDataQualityRepositoryImpl.java:86-102). After three changes the prior
    // severities are unrecoverable from platform storage; a compliance reviewer cannot answer
    // "who set this to Critical, and what was it before". Pin the CURRENT lossy behaviour (LSN-029):
    // exactly one row holding only the latest value. RED-flips when a history/audit surface is added.
    const rows = await dbQuery<{ severity: string }>(
      'SELECT severity FROM data_quality_test_severity WHERE dataset_id = $1 AND data_quality_test_id = $2',
      [dsId, dqId],
    );
    expect(
      rows.length,
      'severity is stored as a single upserted row with no history; if this is >1, a history table ' +
        'was added — flip this characterization pin and assert the transition trail instead.',
    ).toBe(1);
    expect(rows[0].severity, 'the surviving row holds only the latest value (CRITICAL)').toBe('CRITICAL');
  });
});

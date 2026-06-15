import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-131 — F-057 DQ severity UI render fidelity + confirm gate (issue #1750 / CTRIB-015).
 *
 * Protocol: integration-tests/protocols/IT-131-dq-severity-render-bleed.md
 * Gates: regresses #1750 (the sibling-test severity render bleed + the instant unconfirmed save);
 *   validates F-057 (the severity the operator reads is the CURRENT test's own, and a change is
 *   deliberate and reflected from the persisted record).
 *
 * The headline defect (maintainer-verified 2026-06-10): on a dataset with >1 DQ test, the Severity
 * control kept showing the FIRST-mounted test's severity when navigating (in-app) to a sibling test
 * — every other field updated, severity did not — until a full page refresh. Three composing causes:
 * an uncontrolled `defaultValue` select read once at mount, a route element with no
 * `key={dataQATestId}`, and a slice that never reduced `setDataQATestSeverity.fulfilled`. The fix
 * conforms severity to the entity-Status confirm pattern (controlled-from-store value + a confirm
 * dialog + a store reduce + the remount key). IT-057 (SLA/PUT/DB) cannot see this — it never drives
 * the UI.
 *
 * RED proof (pre-fix, ODD_SUT=ref:main): test 1 fails — the sibling shows the first test's severity.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://127.0.0.1:18080';
const NS = 'it1750';
const dsOddrn = `//${NS}/db/tables/orders`;
const dqAOddrn = `//${NS}/ge/test/dqA`;
const dqBOddrn = `//${NS}/ge/test/dqB`;
const NAME_A = 'it1750_test_alpha';
const NAME_B = 'it1750_test_beta';

async function ingest(items: unknown[]): Promise<void> {
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

function testItem(oddrn: string, name: string, suite: string, dsList: string[]) {
  return {
    oddrn,
    name,
    type: 'JOB',
    metadata: [],
    data_quality_test: { suite_name: suite, dataset_list: dsList, expectation: { type: 'expect_x' } },
  };
}

function runItem(dqOddrn: string, n: number) {
  return {
    oddrn: `${dqOddrn}/run/${n}`,
    name: `${NS}_run_${n}`,
    type: 'JOB_RUN',
    data_quality_test_run: {
      data_quality_test_oddrn: dqOddrn,
      start_time: '2026-06-01T10:00:00+00:00',
      end_time: '2026-06-01T10:01:00+00:00',
      status: 'SUCCESS',
    },
  };
}

async function putSeverity(dsId: number, dqId: number, severity: 'MINOR' | 'MAJOR' | 'CRITICAL') {
  const res = await fetch(`${BASE}/api/datasets/${dsId}/dataqatests/${dqId}/severity`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ severity }),
  });
  expect(res.status, `severity PUT (${severity}) must succeed`).toBe(200);
}

// Seed one dataset + TWO DQ tests in the same suite, with DIFFERENT severities (idempotent).
async function seedTwoTests(): Promise<{ dsId: number; aId: number; bId: number }> {
  await ingest([
    { oddrn: dsOddrn, name: `${NS}_orders`, type: 'TABLE', metadata: [], dataset: { field_list: [] } },
    testItem(dqAOddrn, NAME_A, `${NS}_suite`, [dsOddrn]),
    testItem(dqBOddrn, NAME_B, `${NS}_suite`, [dsOddrn]),
    runItem(dqAOddrn, 1),
    runItem(dqBOddrn, 1),
  ]);
  const dsId = await idByOddrn(dsOddrn);
  const aId = await idByOddrn(dqAOddrn);
  const bId = await idByOddrn(dqBOddrn);
  await putSeverity(dsId, aId, 'MINOR');
  await putSeverity(dsId, bId, 'CRITICAL');
  return { dsId, aId, bId };
}

// The severity control shows the current test's severity as its text (+ a dropdown chevron).
const severityControl = (page: Page) => page.locator('[data-qa="dq-severity"]');

test.describe('IT-131 F-057 — DQ severity render fidelity + confirm gate', () => {
  test('the overview severity reflects the CURRENT test, not the first-mounted sibling (#1750)', async ({
    page,
  }) => {
    const { dsId, aId, bId } = await seedTwoTests();

    // 1. Fresh load on test A's overview — the control must show A's own severity (MINOR).
    await page.goto(`/dataentities/${dsId}/test-reports/${aId}/overview`);
    await expect(severityControl(page), 'test A renders its own severity (MINOR) on first mount').toContainText(
      'MINOR',
      { timeout: 15_000 },
    );

    // 2. In-app navigation to sibling test B (CRITICAL) by clicking its list Link — NOT a fresh goto
    //    (a full reload would remount and mask the bleed). The bug lived in the param-change path.
    await page.getByRole('link', { name: NAME_B }).click();
    await page.waitForURL(`**/test-reports/${bId}/overview`);

    // The panel's other fields are selector-driven and DO update to B (proves navigation worked).
    await expect(
      page.locator('h2').filter({ hasText: NAME_B }),
      'the panel heading updates to test B (selector-driven fields follow the route)',
    ).toBeVisible({ timeout: 10_000 });

    // 3. THE ASSERTION: the severity control must now read B's OWN severity (CRITICAL), not A's MINOR
    //    bled through. RED pre-fix (the un-remounted uncontrolled select kept MINOR).
    await expect(
      severityControl(page),
      "after navigating to sibling test B, Severity must show B's own severity (CRITICAL), not A's MINOR (#1750)",
    ).toContainText('CRITICAL', { timeout: 10_000 });
  });

  test('a severity change is gated by a confirm dialog and reflects the persisted record (#1750)', async ({
    page,
  }) => {
    const { dsId, aId } = await seedTwoTests();

    await page.goto(`/dataentities/${dsId}/test-reports/${aId}/overview`);
    await expect(severityControl(page)).toContainText('MINOR', { timeout: 15_000 });

    // open the control and choose a different severity — this must NOT persist immediately
    await severityControl(page).click();
    await page.getByRole('menuitem', { name: 'MAJOR' }).click();

    // the confirmation dialog previews the change; the control still shows the stored value (MINOR)
    await expect(
      page.getByText('Change the severity from MINOR to MAJOR?'),
      'choosing a severity opens a confirm dialog previewing the change',
    ).toBeVisible({ timeout: 10_000 });
    await expect(severityControl(page), 'nothing is persisted until the change is confirmed').toContainText(
      'MINOR',
    );

    // confirm — the mutation is awaited and reduced into the store, so the control reflects MAJOR
    // WITHOUT a page refresh.
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(
      severityControl(page),
      'after confirming, the control reflects the persisted severity (store-reduced, no refresh)',
    ).toContainText('MAJOR', { timeout: 10_000 });

    // and it is genuinely persisted — a fresh load reads MAJOR back
    await page.goto(`/dataentities/${dsId}/test-reports/${aId}/overview`);
    await expect(severityControl(page)).toContainText('MAJOR', { timeout: 15_000 });
  });
});

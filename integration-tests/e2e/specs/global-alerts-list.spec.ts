import { test, expect } from '@playwright/test';
import { seedEntityAlert, clearEntityAlerts } from '../helpers/db';

/**
 * IT-030 — F-126 Global Alerts List Page: /alerts shows all open alerts across entities.
 *
 * Protocol: integration-tests/protocols/IT-030-global-alerts-list.md
 * Gates: validates F-126 (an open alert reaches the platform-wide alerts list — distinct from IT-027
 *        F-014 which is the per-entity Alerts tab).
 *
 * The global Alerts page (/alerts "All" tab → GET /api/alerts) lists each open alert with its entity
 * name + type label (verbatim — verified live). Reuses the IT-027 alert+chunk seed (the alerts list
 * inner-joins alert_chunk). Data-driven: with no open alert, none is listed.
 */
const ALERT_TYPE = 'Backwards incompatible schema';

const alertsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse((r) => /\/api\/alerts(\?|\/|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok());

test.describe('F-126 Global alerts list — /alerts shows all open alerts', () => {
  test('an open alert appears in the global alerts list', async ({ page }) => {
    await seedEntityAlert('IT030 global alert');

    const alerts = alertsFetch(page);
    await page.goto('/alerts');
    await alerts;

    await expect(
      page.getByText(ALERT_TYPE).filter({ visible: true }).first(),
      'the global alerts list must render the open alert',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('with no open alert the alert is not listed (negative)', async ({ page }) => {
    await clearEntityAlerts();

    const alerts = alertsFetch(page);
    await page.goto('/alerts');
    await alerts;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(ALERT_TYPE).filter({ visible: true }),
      'with no open alert the alert must not be listed',
    ).toHaveCount(0);
  });
});

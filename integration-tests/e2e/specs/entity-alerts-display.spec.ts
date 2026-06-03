import { test, expect } from '@playwright/test';
import { seedEntityAlert, clearEntityAlerts, ENTITY_ID } from '../helpers/db';

/**
 * IT-027 — F-014 Per-Entity Alert View: the Alerts tab renders the entity's alerts.
 *
 * Protocol: integration-tests/protocols/IT-027-entity-alerts-display.md
 * Gates: validates F-014 (an alert raised on an entity reaches the per-entity Alerts read surface).
 *
 * The Alerts tab (/dataentities/{id}/alerts → GET /api/dataentities/{id}/alerts) renders each alert's
 * TYPE label (verbatim — e.g. "Backwards incompatible schema") + status. NB the alerts list
 * inner-joins alert_chunk, so the seed creates an alert + a chunk (see helper). Data-driven: an entity
 * with no alert renders none.
 */
const ALERT_TYPE = 'Backwards incompatible schema';

const alertsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/dataentities\/\d+\/alerts/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-014 Per-entity alert view — the Alerts tab renders the entity alerts', () => {
  test('an open alert renders on the Alerts tab', async ({ page }) => {
    await seedEntityAlert();

    const alerts = alertsFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/alerts`);
    await alerts;

    await expect(
      page.getByText(ALERT_TYPE).first(),
      'the Alerts tab must render the alert type',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no alerts does not render an alert (negative)', async ({ page }) => {
    await clearEntityAlerts();

    const alerts = alertsFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/alerts`);
    await alerts;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(ALERT_TYPE).filter({ visible: true }),
      'with no alert the alert type must not render',
    ).toHaveCount(0);
  });
});

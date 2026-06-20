import { test, expect } from '@playwright/test';
import {
  seedEntityAlert,
  clearEntityAlerts,
  seedOpenAndResolvedAlerts,
  IT030_OPEN_ALERT_ENTITY,
  IT030_RESOLVED_ALERT_ENTITY,
} from '../helpers/db';

/**
 * IT-030 — F-126 Global Alerts List Page + #1763 (alerts-view hardening).
 *
 * Protocol: integration-tests/protocols/IT-030-global-alerts-list.md
 * Gates: validates F-126 (an open alert reaches the platform-wide alerts list); regresses #1763 (resolved
 *        alerts are reachable on the GLOBAL page via the status filter — they were unreachable before, the
 *        "All" tab hard-filtered status=OPEN with no status parameter).
 *
 * The global Alerts page (/alerts -> GET /api/alerts/list) lists each alert with its entity name + type
 * label. The hardened view defaults to status=OPEN and exposes a Status filter (and Period / Datasource /
 * Namespace / Tag / Owner), driven by the URL query the filter widgets set. Data-driven: with no open alert
 * none is listed.
 */
const ALERT_TYPE = 'Backwards incompatible schema'; // the IT-027 seeded OPEN alert (used by the F-126 tests)

// The hardened page calls GET /api/alerts/list (the legacy GET /api/alerts is deprecated + no longer called).
const alertsListFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/alerts\/list/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-126 Global alerts list — /alerts shows all open alerts', () => {
  test('an open alert appears in the global alerts list', async ({ page }) => {
    await seedEntityAlert('IT030 global alert');

    const alerts = alertsListFetch(page);
    await page.goto('/alerts');
    await alerts;

    await expect(
      page.getByText(ALERT_TYPE).filter({ visible: true }).first(),
      'the global alerts list must render the open alert',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('with no open alert the alert is not listed (negative)', async ({ page }) => {
    await clearEntityAlerts();

    const alerts = alertsListFetch(page);
    await page.goto('/alerts');
    await alerts;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(ALERT_TYPE).filter({ visible: true }),
      'with no open alert the alert must not be listed',
    ).toHaveCount(0);
  });
});

test.describe('#1763 Global alerts — the status filter surfaces resolved alerts', () => {
  // Asserts on the two dedicated, uniquely-named seed entities (one with an OPEN alert only, one with a
  // RESOLVED alert only) rather than a bare type label, so the cross-platform "All" tab is not polluted by
  // other specs' alerts. An entity's name appears on the global list only when one of ITS alerts is listed.
  test('resolved alerts are hidden by default (Open) but reachable via the status filter', async ({
    page,
  }) => {
    await seedOpenAndResolvedAlerts();

    // Default global view = status OPEN: the open-alert entity appears; the resolved-only entity does NOT
    // (its single alert is resolved, filtered out of the default Open view).
    const dflt = alertsListFetch(page);
    await page.goto('/alerts');
    await dflt;

    await expect(
      page.getByText(IT030_OPEN_ALERT_ENTITY).filter({ visible: true }).first(),
      'the entity with an OPEN alert must appear on the default (Open) global view',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(IT030_RESOLVED_ALERT_ENTITY).filter({ visible: true }),
      'the resolved-only entity must NOT appear on the default (Open) global view',
    ).toHaveCount(0);

    // Selecting Status = Resolved (the filter sets ?status=RESOLVED) makes the resolved-only entity reachable
    // on the global page — the #1763 fix. On the pre-fix system there is no /api/alerts/list status parameter,
    // so the resolved alert is unreachable here (the RED proof).
    const resolved = alertsListFetch(page);
    await page.goto('/alerts?status=RESOLVED');
    await resolved;

    await expect(
      page.getByText(IT030_RESOLVED_ALERT_ENTITY).filter({ visible: true }).first(),
      'the resolved-only entity must be reachable on the global page via the status filter',
    ).toBeVisible({ timeout: 10_000 });
  });
});

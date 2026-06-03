import { test, expect } from '@playwright/test';
import { seedDataSource } from '../helpers/db';

/**
 * IT-026 — F-031 Data Source management: the management list renders configured data sources.
 *
 * Protocol: integration-tests/protocols/IT-026-datasource-management-list.md
 * Gates: validates F-031 (a configured data source reaches the management read surface).
 *
 * The configuration-audience management list (/management/datasources → GET /api/datasources) renders
 * each configured data source by name (verbatim — verified live). The list is data-driven: a name
 * that belongs to no data source is not listed.
 */
const NAME = 'IT026DataSource';
const GHOST = 'IT026GhostSource';

const listFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/datasources(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-031 Data Source management — the list renders configured data sources', () => {
  test.beforeEach(async () => {
    await seedDataSource(2026, NAME);
  });

  test('a configured data source appears in the management list', async ({ page }) => {
    const list = listFetch(page);
    await page.goto('/management/datasources');
    await list;

    await expect(
      page.getByText(NAME).first(),
      'the management list must render the configured data source name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a name that belongs to no data source is not listed (negative)', async ({ page }) => {
    const list = listFetch(page);
    await page.goto('/management/datasources');
    await list;
    await page.waitForTimeout(800);

    await expect(
      page.getByText(GHOST).filter({ visible: true }),
      'a non-existent data source name must not be listed',
    ).toHaveCount(0);
  });
});

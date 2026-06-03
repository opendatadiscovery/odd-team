import { test, expect } from '@playwright/test';
import { seedEntityNamespace, clearEntityNamespace, ENTITY_ID } from '../helpers/db';

/**
 * IT-025 — F-028 Namespace: the entity Overview renders the namespace (from its data source).
 *
 * Protocol: integration-tests/protocols/IT-025-entity-namespace-display.md
 * Gates: validates F-028 (a data source's namespace reaches the entity read surface).
 *
 * OverviewGeneral renders `dataSource.namespace.name` verbatim under the "Namespace" label
 * (confirmed in source). The field is data-driven: no namespace on the data source → nothing shown.
 */
const NS = 'IT025Namespace';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-028 Namespace — Overview renders the entity namespace', () => {
  test('the Overview renders the data source namespace', async ({ page }) => {
    await seedEntityNamespace(NS);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(NS).first(),
      'the Overview must render the entity namespace',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity whose data source has no namespace does not render one (negative)', async ({ page }) => {
    await clearEntityNamespace();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(NS).filter({ visible: true }),
      'with no namespace on the data source, the namespace must not render',
    ).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { seedEntityBusinessName, ENTITY_ID } from '../helpers/db';

/**
 * IT-031 — F-178 Entity header: business name (internal_name) display + fallback.
 *
 * Protocol: integration-tests/protocols/IT-031-entity-business-name-display.md
 * Gates: validates F-178 (the operator-set business name reaches the detail header heading; falls back
 *        to the collector external_name when unset).
 *
 * DataEntityDetailsHeader renders `internalName || externalName`. Success: a set internal_name shows as
 * the heading (verbatim). Negative: clearing internal_name falls back to external_name (the business
 * name is gone, the external name remains) — the heading is data-driven.
 */
const BUSINESS = 'IT031BusinessName';
const EXTERNAL = 'it002_table';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-178 Entity header — business name (internal name) display', () => {
  test('a set business name renders as the header heading', async ({ page }) => {
    await seedEntityBusinessName(BUSINESS);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(BUSINESS).first(),
      'the header must render the business name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('with no business name the header falls back to the external name (negative)', async ({ page }) => {
    await seedEntityBusinessName(null);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    // the external name renders as the fallback heading…
    await expect(
      page.getByText(EXTERNAL).first(),
      'the header must fall back to the external name',
    ).toBeVisible({ timeout: 10_000 });
    // …and the (now-unset) business name is gone.
    await expect(
      page.getByText(BUSINESS).filter({ visible: true }),
      'with no business name set, it must not render',
    ).toHaveCount(0);
  });
});

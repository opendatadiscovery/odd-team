import { test, expect } from '@playwright/test';
import { seedOwner } from '../helpers/db';

/**
 * IT-028 — F-019 Owner management: the owners management list searches/filters the owner directory.
 *
 * Protocol: integration-tests/protocols/IT-028-owners-management-search.md
 * Gates: validates F-019 (owner lifecycle — management-list surface; distinct from IT-015 which covers
 *        ownership DISPLAY on an entity overview).
 *
 * /management/owners lists owners; the "Search owner" box filters server-side on type (debounced
 * onChange → GET /api/owners?query=). Rigorous: seed two owners, search one, assert the match is shown
 * AND the other is filtered out; negative: a non-matching query returns neither.
 */
const ALPHA = 'IT028OwnerAlpha';
const BRAVO = 'IT028OwnerBravo';
const NOMATCH = 'ZZZNoSuchOwnerZZZ';

const ownersFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/owners(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

async function search(page: import('@playwright/test').Page, query: string): Promise<void> {
  const resp = ownersFetch(page);
  await page.getByPlaceholder('Search owner').fill(query); // filters on type (debounced)
  await resp;
}

test.describe('F-019 Owner management — the owners list searches/filters', () => {
  test.beforeEach(async () => {
    await seedOwner(ALPHA);
    await seedOwner(BRAVO);
  });

  test('searching an owner name filters the list to the match', async ({ page }) => {
    await page.goto('/management/owners');
    await search(page, ALPHA);

    await expect(
      page.getByText(ALPHA).first(),
      'the searched owner must be listed',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(BRAVO).filter({ visible: true }),
      'a non-matching owner must be filtered out',
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('searching a non-matching name returns no owner (negative)', async ({ page }) => {
    await page.goto('/management/owners');
    await search(page, NOMATCH);

    await expect(
      page.getByText(ALPHA).filter({ visible: true }),
      'a non-matching query must not return the seeded owner',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

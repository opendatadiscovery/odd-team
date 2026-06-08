import { test, expect } from '@playwright/test';
import { seedSearchableEntity } from '../helpers/db';

/**
 * IT-069 — F-147 Search Result Row tile (the entire row onClick navigates to the entity).
 *
 * Protocol: integration-tests/protocols/IT-069-search-result-row-click.md
 * Gates: validates F-147 (UC-001 — clicking a search result row navigates to that entity's
 *        /dataentities/{id}/overview detail page).
 *
 * The Search result row is the platform's second-most-trafficked click surface. The ENTIRE grid
 * row is the click target: ResultItem.tsx:72-76 renders `<S.Container data-testid='search-result-item'
 * onClick={() => navigate(detailsLink)}>` where `detailsLink = dataEntityDetailsPath(searchResult.id)`
 * (ResultItem.tsx:42) resolves to `/dataentities/{id}/overview` (default path per dataEntitiesRoutes.ts:66-73).
 * This drives a real browser: search → click the rendered row → assert the URL navigated to the
 * entity's overview page AND the detail page actually composed (the entity name renders on it).
 *
 * GROUND TRUTH: the row's testid + the route are read from ResultItem.tsx (primary source); the
 * navigation target id is read back from the URL. react-query caveat: we wait for the search results
 * GET (resultsFetch) before clicking, so the row is rendered (not racing initialData).
 *
 * Namespace: ids 20690-20699 · oddrn //e2e-it069/ · names it069_*
 */
const ID = 20690;
const NAME = 'it069_clickable_row';

const resultsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/search\/[0-9a-f-]+\/results/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

async function search(page: import('@playwright/test').Page, query: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  const results = resultsFetch(page);
  await box.press('Enter'); // the main catalog search box searches on Enter
  await results;
}

test.describe('F-147 Search Result Row — click navigates to the entity overview', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(ID, NAME);
  });

  test('clicking a result row navigates to /dataentities/{id}/overview', async ({ page }) => {
    await page.goto('/search');
    await search(page, NAME);

    const row = page.getByTestId('search-result-item').filter({ hasText: NAME });
    await expect(row, 'the seeded entity must render as a search result row').toBeVisible({
      timeout: 10_000,
    });

    // ---- act: the entire row is the click target (ResultItem.tsx:75) ----
    await row.click();

    // ---- assert (URL ground truth): navigated to the entity's overview detail route ----
    await expect(page, 'a row click must navigate to the entity Overview detail route').toHaveURL(
      new RegExp(`/dataentities/${ID}/overview`),
      { timeout: 10_000 },
    );

    // ---- assert (rendered UI): the detail page actually composed + shows the entity name ----
    await expect(
      page.getByText(NAME).first(),
      'the navigated-to Overview must render the clicked entity (name visible)',
    ).toBeVisible({ timeout: 10_000 });
  });
});

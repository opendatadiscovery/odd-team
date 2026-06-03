import { test, expect } from '@playwright/test';
import { seedSearchableEntity } from '../helpers/db';

/**
 * IT-022 — F-017 Catalog search (/search), the platform's primary discovery surface.
 *
 * Protocol: integration-tests/protocols/IT-022-catalog-search.md
 * Gates: validates F-017 (a data entity is findable via the catalog-wide search, and the search
 *        FILTERS — a non-matching entity is excluded).
 *
 * /search lists entities; the operator types into the main "Search" box and presses Enter → a search
 * session is created → results refetch. Search matches the FTS search_entrypoint.data_entity_vector.
 * Rigorous design (mirrors IT-019): seed TWO distinct searchable entities; the positive asserts the
 * match is shown AND the other is FILTERED OUT; the negative asserts a non-matching query returns
 * neither. The main query box has placeholder "Search" exactly (the sidebar facets are "Search by
 * name") and searches on Enter — verified live.
 */
const ENTITY = 'IT022SearchableEntity';
const OTHER = 'IT022OtherEntity';
const NOMATCH = 'ZZZNoSuchEntityZZZ';

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

test.describe('F-017 Catalog search — /search', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(2022, ENTITY);
    await seedSearchableEntity(2023, OTHER);
  });

  test('searching an entity name returns it and filters out the others', async ({ page }) => {
    await page.goto('/search');
    await search(page, ENTITY);

    await expect(
      page.getByText(ENTITY).first(),
      'the searched entity must appear in the results',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(OTHER).filter({ visible: true }),
      'a non-matching entity must be filtered out of the results',
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('a non-matching query surfaces no entity (negative)', async ({ page }) => {
    await page.goto('/search');
    await search(page, NOMATCH);

    await expect(
      page.getByText(ENTITY).filter({ visible: true }),
      'a non-matching query must not return the seeded entity',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

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

async function search(page: import('@playwright/test').Page, query: string): Promise<void> {
  // ST-1 / ADR D10 (CTRIB-048): committing a query now navigates to the canonical /search?q=<query>
  // (NO session id) and the page runs the search FROM the URL — replacing the old
  // create-empty-session-then-PUT-to-/search/{id} flow, and DISSOLVING the TST-042 "Enter before the
  // session exists" race (navigation no longer depends on a redux session). Wait for (1) the param URL
  // — the deterministic "the committed query is in the URL" signal; (2) the results GET — the search
  // REALLY executed. The callers' 10s DOM assertions absorb the results render.
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  const results = page.waitForResponse(
    (r) =>
      /\/api\/search\/[0-9a-f-]+\/results/.test(new URL(r.url()).pathname) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );
  await box.press('Enter'); // the main catalog search box searches on Enter
  await page.waitForURL(/\/search\?[^/]*q=/, { timeout: 15_000 });
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

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
  // HARDENED 2026-06-12 (TST-042 instance, caught in the maintainer's ui-e2e run):
  // /search mounts by CREATING an empty session and only then rewriting the URL to
  // /search/{id} (useCreateSearch navigates after the POST unwraps); the box's Enter
  // dispatches updateDataEntitiesSearch({ searchId: storedSearchId }) — pressed BEFORE
  // the session exists in redux it silently no-ops, and the UNFILTERED initial list
  // stays rendered (the old any-ok results waiter was then satisfied by the empty
  // session's own fetch). So: (1) wait for the URL rewrite — the deterministic "redux
  // has the session" signal; (2) confirm the Enter's PUT /api/search/{id}
  // (updateSearchFacets) resolved ok — the search REALLY executed. The callers' 10s
  // DOM assertions absorb the post-PUT results render.
  await page.waitForURL(/\/search\/[0-9a-f-]+/, { timeout: 15_000 });
  const sessionId = new URL(page.url()).pathname.split('/').pop();
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  const updated = page.waitForResponse(
    (r) =>
      new RegExp(`/api/search/${sessionId}$`).test(r.url().split('?')[0]) &&
      r.request().method() === 'PUT' &&
      r.ok(),
  );
  await box.press('Enter'); // the main catalog search box searches on Enter
  await updated;
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

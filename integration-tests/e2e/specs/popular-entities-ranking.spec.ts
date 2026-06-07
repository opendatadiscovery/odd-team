import { test, expect } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-066 — F-003 Popular Entities Ranking / exclude-from-search filter consistency.
 *
 * Protocol: integration-tests/protocols/IT-066-popular-entities-ranking.md
 * Gates: validates F-003 (UC-004 — `exclude_from_search=true` entities are hidden from the user-facing
 *        discovery list surface).
 *
 * Operators mark internal/staging entities `data_entity.exclude_from_search=true` to hide them from
 * discovery. F-003's finding is that the filter is applied INCONSISTENTLY across the 9 list-shape
 * surfaces: the catalog SEARCH path (findByState via JooqFTSHelper.resultFacetStateConditions, line 149)
 * DOES apply EXCLUDE_FROM_SEARCH, while the Popular CTE (cteDataEntitySelect, ReactiveDataEntityRepositoryImpl
 * .java:909-939) does NOT (probe P-006 pinned the leak).
 *
 * The Popular column itself is NOT browser-reachable on THIS deployment: it lives inside OwnerEntitiesList,
 * which Overview.tsx:25-27 gates behind `authType !== 'DISABLED'` — under the engine's DISABLED auth the
 * Recommended panel (incl. Popular) is hidden (F-003-UC-009, confirmed). So the user-facing discovery
 * surface a browser CAN drive here is /search. This test pins the CORRECT half of the inconsistency: the
 * SEARCH surface honors exclude_from_search. The Popular-CTE leak (UC-004's `contradicted` verdict) is
 * pinned at the API/repository layer by probe P-006 and cannot be reproduced through the UI under DISABLED.
 *
 * Rigorous design: seed TWO searchable entities sharing a term — one normal, one with
 * exclude_from_search=true. Search and assert the normal entity is shown AND the excluded entity is
 * filtered out. Asserting the excluded one is ABSENT (not just the normal one present) is the falsifiable
 * core: if a future change drops EXCLUDE_FROM_SEARCH from findByState, this row would appear and turn RED.
 *
 * GROUND TRUTH: exclude_from_search is a boolean column (default false) — verified live: a search for a
 * term matching both returns ONLY the non-excluded entity. db.ts has no exclude-from-search helper and
 * must not be edited, so the flag is set with dbQuery on OUR id.
 *
 * Namespace: ids 20660-20669 · oddrn //e2e-it066/ · names it066_*
 */
const NORMAL_ID = 20660;
const EXCLUDED_ID = 20661;
const TERM = 'it066excludecheck';
const NORMAL_NAME = `${TERM}_visible`;
const EXCLUDED_NAME = `${TERM}_hidden`;

const resultsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/search\/[0-9a-f-]+\/results/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

async function search(page: import('@playwright/test').Page, query: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  const results = resultsFetch(page);
  await box.press('Enter');
  await results;
}

test.describe('F-003 exclude-from-search — hidden entities stay out of the discovery surface', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(NORMAL_ID, NORMAL_NAME);
    await seedSearchableEntity(EXCLUDED_ID, EXCLUDED_NAME);
    // mark the second entity hidden-from-search (no named db.ts helper; set on OUR id with dbQuery)
    await dbQuery('UPDATE data_entity SET exclude_from_search = true WHERE id = $1', [EXCLUDED_ID]);
  });

  test('an exclude_from_search=true entity is hidden from the search results; a normal one is shown', async ({
    page,
  }) => {
    await page.goto('/search');
    await search(page, TERM);

    // ---- assert: the non-excluded entity IS discoverable ----
    await expect(
      page.getByTestId('search-result-item').filter({ hasText: NORMAL_NAME }),
      'a normal entity matching the query must appear in the search results',
    ).toBeVisible({ timeout: 10_000 });

    // ---- assert: the exclude_from_search entity is FILTERED OUT of the user-facing surface ----
    await expect(
      page.getByTestId('search-result-item').filter({ hasText: EXCLUDED_NAME }),
      'an exclude_from_search=true entity MUST NOT surface in the search results',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

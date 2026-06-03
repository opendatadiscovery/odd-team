import { test, expect } from '@playwright/test';
import { seedSearchableTerm } from '../helpers/db';

/**
 * IT-019 — F-024 Term search (Dictionary tab, /termsearch).
 *
 * Protocol: integration-tests/protocols/IT-019-term-search.md
 * Gates: validates F-024 (a term in the glossary is findable via the catalog-wide term search,
 *        and the search FILTERS — a non-matching term is excluded).
 *
 * The Dictionary tab is a SEARCH-WITH-FACETS surface (NOT a flat list — F-024 drift
 * `doc_calls_dictionary_tab_a_list_code_renders_search_with_facets_empty_first_view`). On load it
 * lists ALL terms; the operator types a query into "Search terms…" and presses Enter
 * (TermSearchInput fires the search on Enter only — onChange just tracks local text) → the search
 * session is updated → results refetch. Search matches the FTS term_search_entrypoint vector.
 *
 * Rigorous design: seed TWO distinct searchable terms; the positive asserts the match is shown AND
 * the other term is FILTERED OUT (proves search actually filters, not just the initial all-terms
 * list); the negative asserts a non-matching query returns neither.
 */
const TERM = 'IT019SearchableTerm';
const OTHER = 'IT019OtherDistinctTerm';
const NOMATCH = 'ZZZNoSuchTermZZZ';

const resultsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/terms\/search\/[0-9a-f-]+\/results/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

async function search(page: import('@playwright/test').Page, query: string): Promise<void> {
  const input = page.getByPlaceholder('Search terms...');
  await input.fill(query);
  const results = resultsFetch(page);
  await input.press('Enter'); // TermSearchInput searches on Enter only
  await results;
}

test.describe('F-024 Term search (Dictionary) — /termsearch', () => {
  test.beforeEach(async () => {
    await seedSearchableTerm(TERM);
    await seedSearchableTerm(OTHER);
  });

  test('searching a term name returns it and filters out the others', async ({ page }) => {
    await page.goto('/termsearch');
    await search(page, TERM);

    await expect(
      page.getByText(TERM).first(),
      'the searched term must appear in the results table',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(OTHER),
      'a non-matching term must be filtered out of the results',
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('a non-matching query surfaces no term (negative)', async ({ page }) => {
    await page.goto('/termsearch');
    await search(page, NOMATCH);

    await expect(
      page.getByText(TERM),
      'a non-matching query must not return the seeded term',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

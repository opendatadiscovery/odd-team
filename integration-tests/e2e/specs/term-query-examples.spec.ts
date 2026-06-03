import { test, expect } from '@playwright/test';
import { seedTermWithQueryExample, seedTermWithDefinition } from '../helpers/db';

/**
 * IT-034 — F-155 Term Query-Example Linkage: the term's Query-Examples tab shows linked examples.
 *
 * Protocol: integration-tests/protocols/IT-034-term-query-examples.md
 * Gates: validates F-155 (a query example linked to a term reaches the term's Query-Examples tab).
 *
 * The term detail "Query examples" tab (/terms/{id}/query-examples → GET /api/terms/{id}/queryexample)
 * lists the query examples linked to the term (definition + SQL, verbatim — verified live). Per-term +
 * data-driven: a term with no linked examples lists none.
 */
const QUERY_TERM = 'IT034QueryTerm';
const NO_QUERY_TERM = 'IT034NoQueryTerm';
const DEFINITION = 'IT034 example definition';
const QUERY = 'SELECT * FROM it034_demo';

// The term detail GET always fires; the query-examples tab data loads after. Wait on the term GET
// (catch-safe), then let the tab render — toBeVisible/toHaveCount poll the rest.
async function gotoQueryExamples(page: import('@playwright/test').Page, id: number): Promise<void> {
  const term = page
    .waitForResponse((r) => r.url().includes(`/api/terms/${id}`) && r.request().method() === 'GET' && r.ok(), {
      timeout: 20_000,
    })
    .catch(() => null);
  await page.goto(`/terms/${id}/query-examples`, { waitUntil: 'domcontentloaded' });
  await term;
  await page.waitForTimeout(1500);
}

test.describe('F-155 Term query examples — the term page lists linked query examples', () => {
  test('a query example linked to a term renders on the Query-Examples tab', async ({ page }) => {
    const id = await seedTermWithQueryExample(QUERY_TERM, DEFINITION, QUERY);

    await gotoQueryExamples(page, id);

    await expect(
      page.getByText(QUERY).first(),
      'the linked query example (SQL) must render on the term page',
    ).toBeVisible({ timeout: 12_000 });
  });

  test('a term with no query examples lists none (negative)', async ({ page }) => {
    const id = await seedTermWithDefinition(NO_QUERY_TERM, 'IT034 no-query term', 'IT034-ns');

    await gotoQueryExamples(page, id);

    await expect(
      page.getByText(QUERY).filter({ visible: true }),
      'a term with no linked query example must list none',
    ).toHaveCount(0, { timeout: 5_000 });
  });
});

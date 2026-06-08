import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-085 — F-025 Query Examples (CRUD + Faceted Search): the Data Modelling
 * Query Examples list page renders a seeded example AND the faceted search finds
 * it by its definition.
 *
 * Protocol: integration-tests/protocols/IT-085-query-examples-crud-search.md
 * Gates: validates F-025 (UC-002 catalog list render + UC-003 faceted search by token).
 *
 * GROUND TRUTH (read from source, 2026-06-07):
 *  - Route: /data-modelling/query-examples (routes/dataModelling/queryExamplesRoutes.ts +
 *    DataModellingRoutes.tsx). The page (QueryExamples.tsx) auto-creates a FRESH EMPTY search
 *    session on mount (useCreateQueryExampleSearch → POST /api/queryexample/search, total 0) and
 *    pushes ?querySearchId=<uuid> onto the URL. The list (QueryExamplesList.tsx) is
 *    `enabled: !!searchId` and reads GET /api/queryexample/search/{id}/results.
 *  - To surface a row the user types into the search box (SearchInput, placeholder
 *    "Search query examples") and presses ENTER → updateFacets fires
 *    PUT /api/queryexample/search/{id}, onSuccess invalidates ['searchQueryExamples'] → the
 *    list refetches and the seeded example appears. The faceted search matches
 *    query_example_search_entrypoint.search_vector (a GENERATED column =
 *    query_example_vector || data_entity_vector; ReactiveQueryExampleRepositoryImpl.findByState
 *    + JooqFTSHelper.ftsCondition) AND query_example.deleted_at IS NULL.
 *  - Each row renders the example id as a link + `definition` + `query` via <Markdown>
 *    (QueryExamplesListItem.tsx:35-53). Verified live: a seeded vector for "<def> <query>"
 *    returns total:1 for a token contained in the definition.
 *
 * SEED (dbQuery, ids 20850-20859, it085_ prefix): query_example row + the FTS entrypoint
 *  query_example_vector = to_tsvector('english', definition || ' ' || query). search_vector is
 *  generated, so we set query_example_vector (NOT search_vector). Idempotent.
 */
const QE_ID = 20850;
const TOKEN = 'it085zqltoken'; // unique single token, lives in the definition
const DEFINITION = `it085_ Query example definition mentioning ${TOKEN}`;
const QUERY = 'SELECT id, name FROM it085_orders WHERE status = $1';
const MISS_TOKEN = 'it085nomatchzzz'; // a token present in NO example — proves search is real

async function seedQueryExample(): Promise<void> {
  // Idempotent reset (entrypoint first — it references the example).
  await dbQuery('DELETE FROM query_example_search_entrypoint WHERE query_example_id = $1', [QE_ID]);
  await dbQuery('DELETE FROM query_example WHERE id = $1', [QE_ID]);
  await dbQuery(
    `INSERT INTO query_example (id, definition, query, created_at, updated_at, is_deleted)
     VALUES ($1, $2, $3, NOW(), NOW(), false)`,
    [QE_ID, DEFINITION, QUERY],
  );
  // search_vector is GENERATED (query_example_vector || data_entity_vector); set the source vector.
  await dbQuery(
    `INSERT INTO query_example_search_entrypoint (query_example_id, query_example_vector)
     VALUES ($1, to_tsvector('english', $2))`,
    [QE_ID, `${DEFINITION} ${QUERY}`],
  );
}

// The faceted-search results read for the active session (snake_case on the wire).
const resultsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/queryexample\/search\/[^/]+\/results/.test(r.url()) &&
      r.request().method() === 'GET' && r.ok(),
  );

async function openListAndSearch(page: import('@playwright/test').Page, term: string) {
  // Initial mount creates the empty session + first (empty) results read.
  const firstResults = resultsFetch(page);
  await page.goto('/data-modelling/query-examples');
  await firstResults;

  // Drive the REAL search box: type the term + Enter → updateFacets → list refetch.
  const box = page.getByPlaceholder('Search query examples');
  await expect(box, 'the query-examples search box must render').toBeVisible({ timeout: 10_000 });
  const afterSearch = resultsFetch(page);
  await box.click();
  await box.fill(term);
  await box.press('Enter');
  await afterSearch;
}

test.describe('F-025 Query Examples — list page renders + faceted search finds a seeded example', () => {
  test.beforeEach(async () => {
    await seedQueryExample();
  });

  test('the faceted search finds the seeded example by its definition and the list renders it', async ({
    page,
  }) => {
    await openListAndSearch(page, TOKEN);

    // PRIMARY assertion: what the user SEES — the example's definition rendered in the list.
    await expect(
      page.getByText(DEFINITION, { exact: false }).first(),
      'the seeded query example definition must render in the list after a matching search',
    ).toBeVisible({ timeout: 10_000 });

    // The row links to the example by id (QueryExamplesListItem renders id as a Link).
    await expect(
      page.getByRole('link', { name: String(QE_ID) }).first(),
      'the list row must link to the seeded example by id',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a search token that matches no example does not surface the seeded example (negative)', async ({
    page,
  }) => {
    await openListAndSearch(page, MISS_TOKEN);
    await page.waitForTimeout(800);

    await expect(
      page.getByText(DEFINITION, { exact: false }).filter({ visible: true }),
      'the seeded example must NOT appear for a non-matching search — faceted search is data-driven',
    ).toHaveCount(0);
  });
});

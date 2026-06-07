import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-087 — F-132 Query Example Details Tab Navigation: the details page renders the
 * Overview (definition + query) and its Linked Entities / Linked Terms tabs surface the
 * linked records.
 *
 * Protocol: integration-tests/protocols/IT-087-query-example-details-tabs.md
 * Gates: validates F-132 (UC-001 single-fetch overview render; UC-002 Linked Entities tab;
 *        UC-003 Linked Terms tab).
 *
 * GROUND TRUTH (read from source, 2026-06-07):
 *  - Route: /data-modelling/query-examples/:queryExampleId → GET /api/queryexample/{id}
 *    (useGetQueryExampleDetails). The container fetches the FULL payload once at mount
 *    (linkedEntities + linkedTerms included); tab switches are zero-network re-renders
 *    (QueryExampleDetailsContainer.tsx:26-94, amplification_factor 1).
 *  - Tabs (QueryExampleDetailsTabs.tsx:15-33, AppTabs type='primary' → MUI role=tab):
 *    "Overview" | "Linked Entities" (hint = linkedEntities.pageInfo.total) | "Linked Terms".
 *    Active tab driven by ?tab=overview|linked-entities|linked-terms; default 'overview'.
 *  - Overview (QueryExampleDetailsOverview.tsx) renders "Definition" + "Query" headings with
 *    the bodies via <Markdown>. Linked Entities (QueryExampleDetailsLinkedEntities + Item)
 *    renders each entity's `internalName ?? externalName`. Linked Terms
 *    (QueryExampleDetailsLinkedTerms + Item) renders each term's `name`.
 *  - Verified live (2026-06-07): GET /api/queryexample/{id} returns
 *    linked_entities.items[].external_name and linked_terms.items[].term.name for a seeded
 *    entity-link + term-link.
 *
 * SEED (dbQuery, ids 20870-20879, it087_ prefix): a data_source + data_entity, a query_example,
 *  a data_entity_to_query_example link, a term (+namespace), a query_example_to_term link.
 *  Idempotent (DELETE-then-INSERT on the fixed ids).
 */
const QE_ID = 20870;
const DS_ID = 20871;
const ENTITY_ID = 20871;
const ENTITY_NAME = 'it087_orders_table';
const TERM_NAME = 'it087_OrderStatus';
const NS_NAME = 'it087-ns';
const DEFINITION = 'it087_ details-page definition body';
const QUERY = 'SELECT status, COUNT(*) FROM it087_orders GROUP BY status';
const ENTITY_ODDRN = '//e2e-it087/db/tables/it087_orders_table';

async function seed(): Promise<void> {
  // Data source + a renderable data entity (DATA_SET / TABLE) to link.
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [DS_ID, '//e2e-it087/db', 'e2e-it087-src'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, oddrn = EXCLUDED.oddrn`,
    [ENTITY_ID, ENTITY_ODDRN, ENTITY_NAME, DS_ID],
  );

  // The query example (idempotent reset — children first).
  await dbQuery('DELETE FROM query_example_to_term WHERE query_example_id = $1', [QE_ID]);
  await dbQuery('DELETE FROM data_entity_to_query_example WHERE query_example_id = $1', [QE_ID]);
  await dbQuery('DELETE FROM query_example_search_entrypoint WHERE query_example_id = $1', [QE_ID]);
  await dbQuery('DELETE FROM query_example WHERE id = $1', [QE_ID]);
  await dbQuery(
    `INSERT INTO query_example (id, definition, query, created_at, updated_at, is_deleted)
     VALUES ($1, $2, $3, NOW(), NOW(), false)`,
    [QE_ID, DEFINITION, QUERY],
  );

  // Link the data entity (this surfaces on the Linked Entities tab).
  await dbQuery(
    'INSERT INTO data_entity_to_query_example (data_entity_id, query_example_id) VALUES ($1, $2)',
    [ENTITY_ID, QE_ID],
  );

  // A term + namespace, then link it (surfaces on the Linked Terms tab). The details join
  // requires term.deleted_at IS NULL (ReactiveQueryExampleRepositoryImpl), which a fresh
  // term satisfies.
  const nsRows = await dbQuery<{ id: string }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [
    NS_NAME,
  ]);
  const nsId = nsRows[0]
    ? Number(nsRows[0].id)
    : Number(
        (await dbQuery<{ id: string }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [NS_NAME]))[0].id,
      );
  const termRows = await dbQuery<{ id: string }>(
    'SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1',
    [TERM_NAME, nsId],
  );
  const termId = termRows[0]
    ? Number(termRows[0].id)
    : Number(
        (
          await dbQuery<{ id: string }>(
            'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
            [TERM_NAME, 'it087 linked term def', nsId],
          )
        )[0].id,
      );
  await dbQuery('DELETE FROM query_example_to_term WHERE query_example_id = $1 AND term_id = $2', [
    QE_ID,
    termId,
  ]);
  await dbQuery(
    'INSERT INTO query_example_to_term (query_example_id, term_id, is_description_link) VALUES ($1, $2, false)',
    [QE_ID, termId],
  );
}

const detailsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => new RegExp(`/api/queryexample/${QE_ID}(\\?|$)`).test(r.url()) &&
      r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-132 Query Example Details — Overview + Linked Entities + Linked Terms tabs', () => {
  test.beforeEach(async () => {
    await seed();
  });

  test('the Overview tab renders the definition and query verbatim', async ({ page }) => {
    const details = detailsFetch(page);
    await page.goto(`/data-modelling/query-examples/${QE_ID}`);
    await details;

    // Header confirms we are on the right example's details page.
    await expect(
      page.getByText(`Query Example #${QE_ID}`),
      'the details header must render the example id',
    ).toBeVisible({ timeout: 10_000 });

    // Overview is the default tab — definition + query bodies render (Markdown).
    await expect(
      page.getByText(DEFINITION, { exact: false }).first(),
      'the Overview must render the definition body',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('it087_orders', { exact: false }).first(),
      'the Overview must render the query body',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the Linked Entities tab shows the linked data entity', async ({ page }) => {
    const details = detailsFetch(page);
    await page.goto(`/data-modelling/query-examples/${QE_ID}`);
    await details;

    await page.getByRole('tab', { name: /Linked Entities/ }).click();

    await expect(
      page.getByText(ENTITY_NAME, { exact: false }).first(),
      'the Linked Entities tab must render the linked data entity name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the Linked Terms tab shows the linked glossary term', async ({ page }) => {
    const details = detailsFetch(page);
    await page.goto(`/data-modelling/query-examples/${QE_ID}`);
    await details;

    await page.getByRole('tab', { name: /Linked Terms/ }).click();

    await expect(
      page.getByText(TERM_NAME, { exact: false }).first(),
      'the Linked Terms tab must render the linked term name',
    ).toBeVisible({ timeout: 10_000 });
  });
});

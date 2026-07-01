import { test, expect, type Page } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-151 — F-017 search FACETS in the URL (ADR D10; slice ST-1b of the #1825 overhaul, CTRIB-049).
 *
 * Protocol: integration-tests/protocols/IT-151-search-url-facets.md
 * Gates: validates F-017 (the 8 facets + My Objects live in the URL, so a FACETED search is shareable,
 *        bookmarkable, and back/forward-correct — layered on ST-1a's query-URL); regresses the ST-1b
 *        facet-URL contract.
 *
 * ST-1b moves the FACETS into the URL. We exercise the on-page CLASS tab (Results.tsx / SearchResultsTabs) —
 * the round-1 write surface that is NOT in the Filters sidebar and would be missed by a sidebar-only writer.
 * Applying it navigates to the canonical /search?…&entityClasses[]=<id>; the page runs the filtered search
 * FROM the URL; a shared/bookmarked faceted URL reproduces it with no prior session; back/forward navigate
 * facet states; and removing the facet (the All tab) drops it from the URL and broadens the results (the
 * round-2 removal path — a plain server merge could never remove it, which is why the reader CREATEs a fresh
 * session per URL state = the REPLACE path).
 *
 * RED on ref:main (CTRIB-049 base, f63d3915): a class tab dispatches a PUT /facets that never touches the
 * URL, so no facet reaches the URL and a faceted deep-link is meaningless. GREEN on the working-tree SUT.
 *
 * Namespace: ids 21500-21509 · oddrn //e2e-it150f/ · names it150facets_*
 */
const TERM = 'it150facets';
const DATASET_ID = 21500;
const GROUP_ID = 21501;
const DATASET_NAME = `${TERM}_dataset`;
const GROUP_NAME = `${TERM}_group`;

// db.ts has no class-parameterised seeder and must not be edited (IT-068 precedent). Seed a non-DATA_SET
// searchable entity + its FTS vector directly with OUR ids. classIds '{8}' = DATA_ENTITY_GROUP; typeId 17 = DAG.
async function seedSearchableOfClass(
  id: number,
  name: string,
  classIds: string,
  typeId: number,
): Promise<void> {
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, 2001, $5, $4, 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = EXCLUDED.entity_class_ids, type_id = EXCLUDED.type_id`,
    [id, `//e2e-it150f/db/${id}`, name, classIds, typeId],
  );
  await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = $1', [id]);
  await dbQuery(
    `INSERT INTO search_entrypoint (data_entity_id, data_entity_vector) VALUES ($1, to_tsvector('english', $2))`,
    [id, name],
  );
}

// query-string serialises the class facet as entityClasses[]=<id> (bracket-separator); the browser may
// percent-encode the brackets. Match either form + a numeric id — the id itself is captured, never hardcoded.
const FACET_IN_URL = /entityClasses(\[\]|%5B%5D)=\d+/;

async function runSearch(page: Page, term: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(term);
  await box.press('Enter');
}

const datasetRowOf = (page: Page) =>
  page.getByTestId('search-result-item').filter({ hasText: DATASET_NAME });
const groupRowOf = (page: Page) =>
  page.getByTestId('search-result-item').filter({ hasText: GROUP_NAME });

test.describe('F-017 search URL state — facets in the URL (ST-1b / D10)', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(DATASET_ID, DATASET_NAME); // DATA_SET class {1}, type TABLE
    await seedSearchableOfClass(GROUP_ID, GROUP_NAME, '{8}', 17); // DATA_ENTITY_GROUP class {8}
  });
  test.afterAll(async () => {
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [DATASET_ID, GROUP_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [[DATASET_ID, GROUP_ID]]);
  });

  test('a class tab writes the facet to the URL + refilters; the All tab removes it (round-1 write + round-2 removal)', async ({
    page,
  }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);

    await page.goto('/search');
    await runSearch(page, TERM);
    await expect(datasetRow, 'the dataset appears under All').toBeVisible({ timeout: 15_000 });
    await expect(groupRow, 'the group appears under All').toBeVisible({ timeout: 15_000 });

    // apply the Datasets class tab — ST-1b serialises the facet into the URL (RED on main: no URL change).
    await page.getByRole('tab', { name: /Datasets/ }).click();
    await expect(page, 'the class facet is serialised into the URL').toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'the group class is filtered out').toHaveCount(0, { timeout: 15_000 });
    await expect(datasetRow, 'the dataset class remains').toBeVisible();

    // remove the facet via the All tab — it leaves the URL AND the results broaden (round-2 removal: the
    // reader CREATEs a fresh session per URL state = REPLACE, so a dropped facet is genuinely removed).
    await page.getByRole('tab', { name: /^All/ }).click();
    await expect(page, 'the facet is removed from the URL').not.toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'the group returns once the facet is cleared').toBeVisible({
      timeout: 15_000,
    });
    await expect(datasetRow).toBeVisible();
  });

  test('a faceted URL is shareable and back/forward navigates facet states', async ({ page }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);

    await page.goto('/search');
    await runSearch(page, TERM);
    await expect(datasetRow).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: /Datasets/ }).click();
    await expect(page).toHaveURL(FACET_IN_URL, { timeout: 15_000 });
    await expect(groupRow).toHaveCount(0, { timeout: 15_000 });
    const facetedUrl = page.url();

    // share/bookmark: open the faceted URL fresh (no prior session) — the filtered search reproduces.
    const fresh = await page.context().newPage();
    await fresh.goto(facetedUrl);
    await expect(
      fresh.getByTestId('search-result-item').filter({ hasText: DATASET_NAME }),
      'the shared faceted URL reproduces the dataset match',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      fresh.getByTestId('search-result-item').filter({ hasText: GROUP_NAME }),
      'the shared faceted URL keeps the group filtered out',
    ).toHaveCount(0, { timeout: 15_000 });
    await fresh.close();

    // back/forward: Back to the unfiltered query, Forward re-applies the facet.
    await page.goBack();
    await expect(page, 'Back leaves the facet URL').not.toHaveURL(FACET_IN_URL, { timeout: 15_000 });
    await expect(groupRow, 'Back re-runs the unfiltered query (group returns)').toBeVisible({
      timeout: 15_000,
    });
    await page.goForward();
    await expect(page, 'Forward re-applies the facet URL').toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'Forward re-applies the facet (group filtered out)').toHaveCount(0, {
      timeout: 15_000,
    });
  });
});

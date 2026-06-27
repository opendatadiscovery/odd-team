import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-147 — F-047 Dataset Structure: the tag filter reflects an in-page tag-add WITHOUT a reload,
 * and the filter chips are labelled as filters (#1679 / CTRIB-040 — follow-up to CTRIB-038).
 *
 * Protocol: integration-tests/protocols/IT-147-dataset-structure-filter-reactivity.md
 * Gates: validates F-047 (the Structure-tab tag/type filter stays consistent with the live structure
 * and is discoverable as a filter).
 *
 * Two maintainer-found UX defects on the #1679 filter:
 *  (1) REACTIVITY — after adding a tag to a column via the per-column editor, the new tag did NOT appear
 *      in the header filter-chip list until a full page reload. Root cause: DatasetStructureOverviewProvider
 *      hydrated the jotai datasetStructureRootAtom ONCE (useHydrateAtoms); the tag-write updated redux
 *      (fieldById) but the atom — which backs the filter chips — stayed frozen. SyncAtoms re-syncs it.
 *  (2) DISCOVERABILITY — the tag and type chips carried no label saying they are clickable filters.
 *
 * RED on `ref:c37ca11b` (the CTRIB-038 head, pre-fix): the "Filter by tag/type" labels do not exist, and
 * after Save the new tag chip never appears in the header filter without a reload. GREEN on the fix.
 *
 * Seeding: REAL ingestion (entity + columns) + the stats path for the baseline tag (IT-047-proven anon
 * mint under DISABLED). The NEW tag is then added through the UI editor — the only path that exercises the
 * real redux -> atom flow the defect lives in. Collision-free band: 2147.
 */
const DS_ID = 2147;
const DS = '//e2e-it147/ds';
const E = `${DS}/tables/it147_tbl`;
const STATS_URL = '/ingestion/entities/datasets/stats';
const H = { 'content-type': 'application/json' };

const COL = {
  email: `${E}/columns/it147_email`,
  plain: `${E}/columns/it147_plain`,
  amount: `${E}/columns/it147_amount`,
};
const stringCol = (oddrn: string, name: string) => ({
  oddrn,
  name,
  type: { type: 'TYPE_STRING', logical_type: 'varchar', is_nullable: true },
});
const numberCol = (oddrn: string, name: string) => ({
  oddrn,
  name,
  type: { type: 'TYPE_NUMBER', logical_type: 'bigint', is_nullable: true },
});

// Attach a baseline tag to a column via the stats ingestion path (anon mint under DISABLED — IT-047).
async function pushStringTags(
  request: APIRequestContext,
  fieldOddrn: string,
  fieldName: string,
  tags: string[],
): Promise<number> {
  const res = await request.post(STATS_URL, {
    headers: H,
    data: {
      items: [
        {
          dataset_oddrn: E,
          fields: {
            [fieldOddrn]: {
              name: fieldName,
              string_stats: { max_length: 8, avg_length: 5, nulls_count: 0, unique_count: 4 },
              tags: tags.map((t) => ({ name: t })),
            },
          },
        },
      ],
    },
  });
  return res.status();
}

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it147-ds');
  expect(
    await ingestEntities(DS, [
      tableEntity(E, 'it147_tbl', {
        dataset: {
          field_list: [
            stringCol(COL.email, 'it147_email'),
            stringCol(COL.plain, 'it147_plain'),
            numberCol(COL.amount, 'it147_amount'),
          ],
        },
      }),
    ]),
    'entity + columns ingest -> 200',
  ).toBe(200);
  // baseline: it147_email carries it147pii (so the header filter has a chip on load).
  expect(await pushStringTags(request, COL.email, 'it147_email', ['it147pii'])).toBe(201);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  return e!.id;
}

// A list-row column name renders as a level-4 heading; scope to it (not the detail-panel <h1>).
const col = (page: Page, name: string) =>
  page.getByRole('heading', { level: 4, name, exact: true });
const tagFilterChip = (page: Page, name: string) =>
  page.locator('[data-qa="dataset-structure-tag-filter"]').filter({ hasText: name });

test.describe('F-047 Dataset Structure — filter reactivity + filter labels (#1679 / CTRIB-040)', () => {
  test('a tag added in-page appears in the filter without reload; the chips are labelled filters', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    await page.goto(`/dataentities/${id}/structure`);

    // Baseline: all three columns render; the seeded it147pii filter chip is present.
    await expect(col(page, 'it147_email')).toBeVisible();
    await expect(col(page, 'it147_plain')).toBeVisible();
    await expect(tagFilterChip(page, 'it147pii')).toBeVisible();

    // DEFECT 2 — the chips are labelled as filters (RED on main: these labels do not exist).
    await expect(page.getByText('Filter by tag', { exact: true })).toBeVisible();
    await expect(page.getByText('Filter by type', { exact: true })).toBeVisible();

    // The new tag is NOT a filter option yet.
    await expect(tagFilterChip(page, 'it147livetag')).toHaveCount(0);

    // DEFECT 1 — add a tag to the untagged column it147_plain through the per-column editor.
    await col(page, 'it147_plain').click(); // re-point the right-rail editor to it147_plain
    await page.getByRole('button', { name: 'Add tags' }).click(); // it147_plain has no tags yet
    await page.getByPlaceholder('Enter tag name').fill('it147livetag');
    // the freeSolo autocomplete offers a "create new" option for the typed name — pick it.
    await page.getByRole('option').filter({ hasText: 'it147livetag' }).first().click();
    // the chip is staged in the dialog, then saved (PUT /api/datasetfields/{id}/tags).
    const saved = page.waitForResponse(
      (r) =>
        /\/api\/datasetfields\/\d+\/tags(\?|$)/.test(r.url()) &&
        r.request().method() === 'PUT' &&
        r.ok(),
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await saved;

    // THE FIX: the header filter must now offer the new tag as a chip — WITHOUT a page reload.
    // RED on ref:c37ca11b — the once-hydrated atom stays frozen, so this chip never appears here.
    await expect(tagFilterChip(page, 'it147livetag')).toBeVisible();
    // and it actually filters: clicking it narrows the list to it147_plain.
    await tagFilterChip(page, 'it147livetag').click();
    await expect(col(page, 'it147_plain')).toBeVisible();
    await expect(col(page, 'it147_email')).toHaveCount(0);
  });
});

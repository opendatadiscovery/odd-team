import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-146 — F-047 Dataset Structure: in-page tag / type column filter (#1679 / CTRIB-038).
 *
 * Protocol: integration-tests/protocols/IT-146-dataset-structure-tag-filter.md
 * Gates: validates F-047 (the Structure tab filters its column list by tag and by type, client-side).
 *
 * #1679 ("Tags / Filterable Datasets"): show the tags present across a dataset's columns as clickable
 * chips (with a per-tag column count) that filter the column list to columns carrying the tag; make the
 * existing data-type chips clickable filters too; combine with the name search; a clear-all resets.
 * It is a pure CLIENT-SIDE filter over the already-loaded structure (DataSetField.tags is in the payload).
 *
 * RED on main (ODD_SUT=ref:main): no tag chips render and the type chips are not clickable, so the chip
 * locators below find nothing → the test fails. GREEN on the fix.
 *
 * Seeding: REAL ingestion (entity + columns) + the stats path for tags — the IT-047-proven anonymous
 * tag mint under DISABLED (POST /ingestion/entities/datasets/stats), NOT PUT /api/datasetfields/{id}/tags.
 * Only 4 columns so the virtualized list renders them all (no scrolling). Collision-free band: 2146.
 */
const DS_ID = 2146;
const DS = '//e2e-it146/ds';
const E = `${DS}/tables/it146_tbl`;
const STATS_URL = '/ingestion/entities/datasets/stats';
const H = { 'content-type': 'application/json' };

const COL = {
  email: `${E}/columns/it146_email`,
  name: `${E}/columns/it146_name`,
  amount: `${E}/columns/it146_amount`,
  count: `${E}/columns/it146_count`,
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

// Attach tags to a string column via the stats ingestion path (anon mint under DISABLED — IT-047).
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
  await seedIngestionDataSource(DS_ID, DS, 'it146-ds');
  expect(
    await ingestEntities(DS, [
      tableEntity(E, 'it146_tbl', {
        dataset: {
          field_list: [
            stringCol(COL.email, 'it146_email'),
            stringCol(COL.name, 'it146_name'),
            numberCol(COL.amount, 'it146_amount'),
            numberCol(COL.count, 'it146_count'),
          ],
        },
      }),
    ]),
    'entity + columns ingest -> 200',
  ).toBe(200);
  // email -> {it146pii, it146sensitive}; name -> {it146pii}  => it146pii count 2, it146sensitive count 1.
  expect(await pushStringTags(request, COL.email, 'it146_email', ['it146pii', 'it146sensitive'])).toBe(201);
  expect(await pushStringTags(request, COL.name, 'it146_name', ['it146pii'])).toBe(201);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  return e!.id;
}

test.describe('F-047 Dataset Structure — in-page tag/type column filter (#1679)', () => {
  test('tag chips filter columns; type chips filter by type; clear resets', async ({ page, request }) => {
    const id = await setup(request);
    await page.goto(`/dataentities/${id}/structure`);

    // A column row in the list renders its name as an <h4> heading. Scope to level-4 headings so the
    // assertions target the LIST only — NOT the selected field's detail-panel header (an <h1> with the
    // same name; the view auto-selects the first column). This is also what makes the toHaveCount(0)
    // absence checks correct when the filtered-out column happens to be the selected one.
    const col = (name: string) =>
      page.getByRole('heading', { level: 4, name, exact: true });

    // Baseline: all four columns render on the Structure tab.
    await expect(col('it146_email')).toBeVisible();
    await expect(col('it146_name')).toBeVisible();
    await expect(col('it146_amount')).toBeVisible();
    await expect(col('it146_count')).toBeVisible();

    // The #1679 affordance: a tag chip per tag present on the columns, with a column count.
    const piiChip = page
      .locator('[data-qa="dataset-structure-tag-filter"]')
      .filter({ hasText: 'it146pii' });
    await expect(piiChip, 'the it146pii tag chip renders in the header').toBeVisible();
    await expect(piiChip, 'the chip shows the count of columns carrying it (2)').toContainText('2');

    // Click the PII chip -> only the two PII-tagged columns remain.
    await piiChip.click();
    await expect(col('it146_email')).toBeVisible();
    await expect(col('it146_name')).toBeVisible();
    await expect(col('it146_amount'), 'untagged number col is filtered out').toHaveCount(0);
    await expect(col('it146_count')).toHaveCount(0);

    // Clear All -> the full list returns.
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(col('it146_amount')).toBeVisible();

    // The "same for data types" ask: the number ("Dec") type chip is a clickable filter.
    // On a narrow header the type chips collapse behind a "Show N hidden" expander — open it first.
    const showHidden = page.getByRole('button', { name: /Show \d+ hidden/ });
    if ((await showHidden.count()) > 0) await showHidden.click();
    const decChip = page
      .locator('[data-qa="dataset-structure-type-filter"]')
      .filter({ hasText: 'Dec' });
    await expect(decChip, 'the Dec type chip is a rendered clickable filter').toBeVisible();
    await decChip.click();
    await expect(col('it146_amount')).toBeVisible();
    await expect(col('it146_count')).toBeVisible();
    await expect(col('it146_email'), 'string col filtered out by type=Dec').toHaveCount(0);
    await expect(col('it146_name')).toHaveCount(0);
  });
});

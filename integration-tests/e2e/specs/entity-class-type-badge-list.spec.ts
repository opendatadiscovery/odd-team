import { test, expect } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-073 — F-206 Entity Class / Type Badge encoding on SEARCH/LIST rows.
 *
 * Protocol: integration-tests/protocols/IT-073-entity-class-type-badge-list.md
 * Gates: validates F-206 (the shared EntityClassItem badge encodes an entity's class as the
 *        operator-scannable SHORT token on the catalog SEARCH result row — NOT the detail header,
 *        which is IT-018/F-177).
 *
 * F-206 anchors the shared class/type badge primitives. On a Search result row
 * (Search/Results/ResultItem/ResultItem.tsx:110-117) the row renders ONE EntityClassItem per
 * `entityClasses[]`, gated by `showClassIcons` (Results.tsx:157: true when no single entity-class
 * is selected — i.e. an "All"/text search). EntityClassItem renders the SHORT label from
 * DataEntityClassLabelMap (lib/constants.ts): DATA_SET -> "DS", DATA_TRANSFORMER -> "TS". This is
 * F-206-UC-7's untested half — the badge on a Search row (only the detail header was e2e-verified).
 *
 * Rigorous design (mirrors IT-022): seed a DATA_SET entity, search for it, assert its "DS" class
 * badge renders on the result row; the CORNER asserts the SAME row encodes the class SPECIFICALLY
 * ("DS" present, the transformer token "TS" absent) — proving the badge is class-DRIVEN, not a
 * constant chip. A second seeded entity of a different class CANNOT be used as the corner vehicle
 * here: any non-DATA_SET class (DATA_TRANSFORMER, DATA_QUALITY_TEST, …) that is FTS-findable but
 * lacks its class-specific details row makes GET /api/search/{id}/results 500 (DataEntityMapperImpl
 * dereferences getDataTransformerDetailsDto() with no null guard — already filed as PLT-147,
 * convergently re-confirmed live during this IT-073 build). DATA_SET is the only NPE-safe class for
 * this raw-seed path (mapStats tolerates null details), so the encoding-distinctness corner runs on
 * the DATA_SET row itself. [2026-06-12: PLT-147/#1755 FIXED (CTRIB-009) — the constraint is lifted;
 * widening the corner to a second raw-seeded class is tracked as TST-047. IT-068 locks the fixed
 * mapper contract; this spec's shape is unchanged until TST-047.]
 *
 * GROUND-TRUTH: ResultItem renders `EntityClassItem entityClassName={entityClass.name}` ->
 * DataEntityClassLabelMap.get(name).short. Class ids per DataEntityClassDto: DATA_SET=1. The label
 * map: DATA_SET -> 'DS', DATA_TRANSFORMER -> 'TS'. seedSearchableEntity seeds entity_class_ids={1}
 * (DATA_SET) + the FTS entrypoint so the row is findable + renders 200.
 *
 * Per-spec ids: 20730-20739.
 */
const SET_ENT = 20730;
const SET_NAME = 'IT073DatasetEntity';

const SET_BADGE = 'DS'; // DataEntityClassLabelMap.get(DATA_SET).short
const XFORM_BADGE = 'TS'; // DataEntityClassLabelMap.get(DATA_TRANSFORMER).short — must NOT appear for a DATA_SET row

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

test.describe('F-206 Entity class badge — Search result row', () => {
  test('a DATA_SET entity renders the "DS" class badge on the search row', async ({ page }) => {
    await seedSearchableEntity(SET_ENT, SET_NAME); // entity_class_ids={1} (DATA_SET) by default

    await page.goto('/search');
    await search(page, SET_NAME);

    // the result row appears…
    await expect(
      page.getByText(SET_NAME).first(),
      'the searched DATA_SET entity must appear in the results',
    ).toBeVisible({ timeout: 10_000 });
    // …carrying the DATA_SET short class badge "DS".
    await expect(
      page.getByText(SET_BADGE, { exact: true }).first(),
      'the search row must render the DATA_SET class short badge (DS)',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the badge encodes the class specifically — DS present, TS absent on a DATA_SET row (corner)', async ({
    page,
  }) => {
    await seedSearchableEntity(SET_ENT, SET_NAME); // DATA_SET

    await page.goto('/search');
    await search(page, SET_NAME);

    await expect(
      page.getByText(SET_NAME).first(),
      'the searched entity must appear in the results',
    ).toBeVisible({ timeout: 10_000 });
    // the badge is class-DRIVEN: a DATA_SET row shows "DS"…
    await expect(
      page.getByText(SET_BADGE, { exact: true }).first(),
      'the DATA_SET row must render the DS badge',
    ).toBeVisible({ timeout: 10_000 });
    // …and never a different class's token (the chip is not a constant — DATA_TRANSFORMER's "TS"
    // must not appear for a DATA_SET-only entity).
    await expect(
      page.getByText(XFORM_BADGE, { exact: true }).filter({ visible: true }),
      'a DATA_SET row must not render the DATA_TRANSFORMER short badge (TS)',
    ).toHaveCount(0);
  });
});

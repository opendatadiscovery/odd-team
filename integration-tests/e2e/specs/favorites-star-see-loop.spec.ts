import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn, seedSearchableTerm, dbQuery } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-148 — Favorites: the star -> see loop + the completion surface (#1815 / CTRIB-039 S3+S4).
 *
 * Protocol: integration-tests/protocols/IT-148-favorites-star-see-loop.md
 * Gates: validates F (Favorites) — a user can star any viewable asset and find it again on the
 * main-page panel and the Favorites tab; un-starring removes it everywhere, without a reload. S4 adds
 * the completion surface: the platform multi-select facet (A1), list-row stars (A4), and the
 * DISABLED-auth shared-bucket label (A8).
 *
 * RED-on-base by construction:
 *  - tests 1-3 (the S4 completion surface) were RED on 924d49de (pre-S4) and are GREEN since S4+S4b
 *    merged (origin/main da2932e1): the "Favorites (shared)" label (A8), the platform combobox facet
 *    (A1), and the Dictionary list-row star (A4).
 *  - test 4 (the Group-B Description column, #1815) is RED on da2932e1 — there is no Description column
 *    yet, so [data-qa="favorite-description"] does not exist — and GREEN on the Group-B working tree.
 *
 * Seeding: REAL ingestion of one TABLE data entity + one searchable Term. Auth DISABLED (odd-minimal
 * default) -> the favorites identity is the shared sentinel, so the test seeds and asserts against
 * that one bucket. Collision-free band: 2148.
 */
const DS_ID = 2148;
const DS = '//e2e-it148/ds';
const E = `${DS}/tables/it148_tbl`;
const NAME = 'it148_tbl';
const TERM = 'IT148FavTerm';
const FAV_DE = /\/api\/favorites\/DATA_ENTITY\/\d+(\?|$)/;
const FAV_TERM = /\/api\/favorites\/TERM\/\d+(\?|$)/;

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it148-ds');
  expect(await ingestEntities(DS, [tableEntity(E, NAME)]), 'entity ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  // Deterministic clean start: ensure the sentinel bucket has NOT favorited it (idempotent no-op).
  await request.delete(`/api/favorites/DATA_ENTITY/${e!.id}`);
  return e!.id;
}

const star = (page: Page) => page.locator('[data-qa="favorite-star"]');
const nameLink = (page: Page) => page.getByRole('link', { name: NAME, exact: true });
// Favorites is now a column inside the always-visible Recommended section (alongside Popular), so the
// home-page favorite assertions are scoped to that column — the page also shows the Popular column.
const favColumn = (page: Page) => page.locator('[data-qa="recommended-favorites"]');
const favoriteWrite = (page: Page, method: 'PUT' | 'DELETE', path: RegExp) =>
  page.waitForResponse(
    r => path.test(r.url()) && r.request().method() === method && r.ok()
  );

test.describe('Favorites — the star -> see loop + completion surface (#1815 / CTRIB-039)', () => {
  test('star an asset -> it shows on the main panel + the Favorites tab; un-star -> it is gone', async ({
    page,
    request,
  }) => {
    const id = await setup(request);

    // 1. Open the asset's detail page — the header star is present and NOT pressed.
    await page.goto(`/dataentities/${id}/overview`);
    await expect(star(page)).toBeVisible();
    await expect(star(page)).toHaveAttribute('aria-pressed', 'false');

    // 2. Star it — the star flips to pressed.
    const put = favoriteWrite(page, 'PUT', FAV_DE);
    await star(page).click();
    await put;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');

    // 3. The home-page Recommended section is always visible and shows the Favorites + Popular columns
    //    for every audience (Popular was owner-gated before — RED on base). The Favorites column lists
    //    the asset, and under DISABLED auth it is labelled "Favorites (shared)" (A8), non-possessively.
    await page.goto('/');
    await expect(page.getByText('Popular', { exact: true })).toBeVisible();
    await expect(page.getByText('Favorites (shared)')).toBeVisible();
    await expect(
      favColumn(page).getByRole('link', { name: NAME, exact: true })
    ).toBeVisible();

    // 4. The top-level Favorites tab lists it too, and is likewise labelled "(shared)" (A8).
    await page.goto('/favorites');
    await expect(page.getByRole('heading', { name: 'Favorites (shared)' })).toBeVisible();
    await expect(nameLink(page)).toBeVisible();

    // 5. Un-star it from the detail header.
    await page.goto(`/dataentities/${id}/overview`);
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');
    const del = favoriteWrite(page, 'DELETE', FAV_DE);
    await star(page).click();
    await del;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'false');

    // 6. It is gone from the home-page Favorites column.
    await page.goto('/');
    await expect(
      favColumn(page).getByRole('link', { name: NAME, exact: true })
    ).toHaveCount(0);
  });

  test('the Favorites tab uses the platform multi-select facet (A1), not a checkbox group', async ({
    page,
  }) => {
    // The facet renders regardless of whether anything is favorited (it lives in the sidebar).
    await page.goto('/favorites');
    // A1: the asset-type facet is the platform autocomplete (a combobox). The S3 skeleton rendered a
    //     fixed checkbox group with no combobox, so this is absent on ref:main.
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('star a Term from the Dictionary list row (A4) -> it appears on the Favorites tab', async ({
    page,
    request,
  }) => {
    await seedSearchableTerm(TERM);
    const rows = await dbQuery<{ id: number }>(
      'SELECT id FROM term WHERE name = $1 LIMIT 1',
      [TERM]
    );
    expect(rows[0], 'the seeded term must exist').toBeTruthy();
    const termId = rows[0].id;
    await request.delete(`/api/favorites/TERM/${termId}`); // deterministic clean start

    // Open the Dictionary (term search) and surface the seeded term's row.
    await page.goto('/termsearch');
    const input = page.getByPlaceholder('Search terms...');
    const results = page.waitForResponse(
      r =>
        /\/api\/terms\/search\/[0-9a-f-]+\/results/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.ok()
    );
    await input.fill(TERM);
    await input.press('Enter'); // TermSearchInput searches on Enter only
    await results;

    const termRow = page.locator('a', { hasText: TERM }).first();
    await expect(termRow, 'the searched term row must be visible').toBeVisible({
      timeout: 10_000,
    });

    // A4: the list row now carries a favorite star (the S3 Dictionary rows had none).
    const rowStar = termRow.locator('[data-qa="favorite-star"]');
    await expect(rowStar).toBeVisible();

    // Star it from the list row — its stop-propagation keeps the row link from navigating.
    const put = favoriteWrite(page, 'PUT', FAV_TERM);
    await rowStar.click();
    await put;

    // It now shows on the Favorites tab.
    await page.goto('/favorites');
    await expect(page.getByText(TERM).first()).toBeVisible({ timeout: 10_000 });

    // Cleanup — keep the shared sentinel bucket deterministic for re-runs.
    await request.delete(`/api/favorites/TERM/${termId}`);
  });

  test('the Favorites tab Description column renders the asset description with term links (#1815 Group B)', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    // Seed the term the description will mention, then give the entity an internal description that
    // mentions it. The server resolves [[Namespace:Term]] to a /terms link in FavoriteAsset.description,
    // which the Description column renders via Markdown. (Group B is absent on ref:main: no Description
    // column at all, so [data-qa="favorite-description"] does not exist -> RED on base.)
    await seedSearchableTerm(TERM); // IT148FavTerm in namespace IT019-ns
    await dbQuery('UPDATE data_entity SET internal_description = $1 WHERE id = $2', [
      `IT148DESCMARKER orders. See [[IT019-ns:${TERM}]] for context.`,
      id,
    ]);

    // Star it (setup() already cleared any prior favorite for a deterministic start).
    const put = favoriteWrite(page, 'PUT', FAV_DE);
    await page.goto(`/dataentities/${id}/overview`);
    await star(page).click();
    await put;

    // The Favorites tab's Description cell shows the description text, and the term mention is a link.
    await page.goto('/favorites');
    const descCell = page.locator('[data-qa="favorite-description"]').first();
    await expect(descCell, 'the Description cell is present').toBeVisible({ timeout: 10_000 });
    await expect(descCell).toContainText('IT148DESCMARKER');
    await expect(
      descCell.locator('a[href*="/terms/"]'),
      'the [[Namespace:Term]] mention renders as a term link'
    ).toBeVisible();

    // G-C12 pixel gate: capture the rendered Description column for the maintainer's review.
    await page.screenshot({ path: 'test-results/it148-description-column.png', fullPage: true });

    // Cleanup — restore the shared sentinel bucket + the entity for re-runs.
    await request.delete(`/api/favorites/DATA_ENTITY/${id}`);
    await dbQuery('UPDATE data_entity SET internal_description = NULL WHERE id = $1', [id]);
  });
});

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-148 — Favorites: the star -> see loop (#1815 / CTRIB-039 S3).
 *
 * Protocol: integration-tests/protocols/IT-148-favorites-star-see-loop.md
 * Gates: validates F (Favorites) — a user can star any viewable asset and find it again on the
 * main-page panel and the Favorites tab; un-starring removes it everywhere, without a reload.
 *
 * THE CLAIM: starring an asset from its detail header (a) flips the star to pressed, (b) surfaces the
 * asset on the main-page Favorites panel AND the top-level Favorites tab, and (c) un-starring removes
 * it from both — all driven by the slice, no reload.
 *
 * RED on `ref:main` (66c472e2, the S1+S2 backend merged but BEFORE the S3 frontend): there is no
 * favorite-star affordance, no Favorites panel and no `/favorites` route, so every step below fails.
 * GREEN on the S3 working tree.
 *
 * Seeding: REAL ingestion of one TABLE data entity (no columns needed — favorites act on the entity
 * itself). Auth DISABLED (odd-minimal default) -> the favorites identity is the shared sentinel, so
 * the test seeds and asserts against that one bucket. Collision-free band: 2148.
 */
const DS_ID = 2148;
const DS = '//e2e-it148/ds';
const E = `${DS}/tables/it148_tbl`;
const NAME = 'it148_tbl';
const FAV_PATH = /\/api\/favorites\/DATA_ENTITY\/\d+(\?|$)/;

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
const favoriteWrite = (page: Page, method: 'PUT' | 'DELETE') =>
  page.waitForResponse(
    r => FAV_PATH.test(r.url()) && r.request().method() === method && r.ok()
  );

test.describe('Favorites — the star -> see loop (#1815 / CTRIB-039)', () => {
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
    const put = favoriteWrite(page, 'PUT');
    await star(page).click();
    await put;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');

    // 3. The main-page Favorites panel now lists the asset.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
    await expect(nameLink(page)).toBeVisible();

    // 4. The top-level Favorites tab lists it too.
    await page.goto('/favorites');
    await expect(nameLink(page)).toBeVisible();

    // 5. Un-star it from the detail header.
    await page.goto(`/dataentities/${id}/overview`);
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');
    const del = favoriteWrite(page, 'DELETE');
    await star(page).click();
    await del;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'false');

    // 6. It is gone from the main-page panel.
    await page.goto('/');
    await expect(nameLink(page)).toHaveCount(0);
  });
});

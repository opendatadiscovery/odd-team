import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-149 — Recently Viewed: the open -> see loop + cross-surface recency + remove (#1816 / CTRIB-041 S2).
 *
 * Protocol: integration-tests/protocols/IT-149-recently-viewed-record-see-loop.md
 * Gates: validates F (Recently Viewed) — opening an asset records it; the user finds it again on the
 * main-page Recently Viewed panel; the "last viewed" value + a remove control show on the asset's detail
 * header; removing it drops it from the panel (no reload). Per-user identity; under DISABLED auth the set
 * is the shared instance-wide bucket (labelled "(shared)").
 *
 * RED-on-base by construction: on ref:main (9097c548 = the S1 backend merged, NO frontend) opening a
 * detail page fires no record-on-open POST and there is no Recently Viewed panel — so the record POST
 * never arrives and [data-qa="recommended-recently-viewed"] does not exist -> RED. GREEN on the S2
 * working tree (the record hook + panel + tag present).
 *
 * Seeding: REAL ingestion of one TABLE data entity. Auth DISABLED (odd-minimal default) -> the recency
 * identity is the shared sentinel, so the test seeds and asserts against that one bucket. Band: 2149.
 */
const DS_ID = 2149;
const DS = '//e2e-it149/ds';
const E = `${DS}/tables/it149_tbl`;
const NAME = 'it149_tbl';
const RV_DE = /\/api\/recently-viewed\/DATA_ENTITY\/\d+(\?|$)/;

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it149-ds');
  expect(await ingestEntities(DS, [tableEntity(E, NAME)]), 'entity ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  // Deterministic clean start: ensure the sentinel bucket has NOT recorded it (idempotent no-op).
  await request.delete(`/api/recently-viewed/DATA_ENTITY/${e!.id}`);
  return e!.id;
}

const rvPanel = (page: Page) => page.locator('[data-qa="recommended-recently-viewed"]');
const recordOnOpen = (page: Page) =>
  page.waitForResponse(
    r => RV_DE.test(r.url()) && r.request().method() === 'POST' && r.ok()
  );

test.describe('Recently Viewed — open -> see loop + cross-surface recency + remove (#1816 / CTRIB-041)', () => {
  test('opening an asset records it -> home panel + detail recency tag; remove -> it is gone', async ({
    page,
    request,
  }) => {
    const id = await setup(request);

    // 1. Open the asset's detail page — the deliberate record-on-open POST fires (a signal, NOT a side
    //    effect of the asset GET). On ref:main there is no such hook -> this wait times out (RED on base).
    const recorded = recordOnOpen(page);
    await page.goto(`/dataentities/${id}/overview`);
    await recorded;

    // 2. The home Recommended section shows the Recently Viewed panel, labelled "(shared)" under DISABLED
    //    auth (non-possessive — the bucket is instance-wide), listing the just-opened asset.
    await page.goto('/');
    await expect(page.getByText('Recently Viewed (shared)')).toBeVisible();
    await expect(
      rvPanel(page).getByRole('link', { name: NAME, exact: true })
    ).toBeVisible({ timeout: 10_000 });

    // 3. The cross-surface recency marker shows on the asset's detail header — the "last viewed" value +
    //    a remove control — because the asset is in the user's history (self-hydrated via the batch status).
    await page.goto(`/dataentities/${id}/overview`);
    const tag = page.locator('[data-qa="recently-viewed-tag"]').first();
    await expect(tag, 'the recency marker shows on the detail header').toBeVisible({ timeout: 10_000 });
    await expect(tag).toContainText('Viewed');

    // 4. Remove it from the home panel — the remove control DELETEs the entry (principal-scoped server-side).
    await page.goto('/');
    await expect(
      rvPanel(page).getByRole('link', { name: NAME, exact: true })
    ).toBeVisible({ timeout: 10_000 });
    const removed = page.waitForResponse(
      r => RV_DE.test(r.url()) && r.request().method() === 'DELETE' && r.ok()
    );
    await rvPanel(page).locator('[data-qa="recently-viewed-remove"]').first().click();
    await removed;

    // 5. It is gone from the panel — driven by the slice, no reload.
    await expect(
      rvPanel(page).getByRole('link', { name: NAME, exact: true })
    ).toHaveCount(0);

    // G-C12 pixel gate: capture the rendered Recently Viewed panel for the maintainer's review.
    await page.screenshot({ path: 'test-results/it149-recently-viewed-panel.png', fullPage: true });

    // Cleanup — keep the shared sentinel bucket deterministic for re-runs.
    await request.delete(`/api/recently-viewed/DATA_ENTITY/${id}`);
  });
});

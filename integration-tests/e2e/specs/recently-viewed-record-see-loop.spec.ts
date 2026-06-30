import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  seedIngestionDataSource,
  entityByOddrn,
  seedSearchableEntity,
  seedEntityAlert,
  ENTITY_ID,
} from '../helpers/db';
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

// Drive the main catalog search to a results table (mirrors IT-022): ST-1a / D10 (CTRIB-048) — committing a
// query navigates to the canonical /search?q=<query> (no session id) and the page runs the search from the URL.
async function search(page: Page, query: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  const results = page.waitForResponse(
    r =>
      /\/api\/search\/[0-9a-f-]+\/results/.test(new URL(r.url()).pathname) &&
      r.request().method() === 'GET' &&
      r.ok()
  );
  await box.press('Enter');
  await page.waitForURL(/\/search\?[^/]*q=/, { timeout: 15_000 });
  await results;
}

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

  test('on the list surface the recency shows in a dedicated column, not inline in the name (#1816 / CTRIB-042)', async ({
    page,
    request,
  }) => {
    const id = 2150;
    const NAME2 = 'IT149RvColEntity';
    await seedSearchableEntity(id, NAME2);
    await request.delete(`/api/recently-viewed/DATA_ENTITY/${id}`); // deterministic clean start

    // Open it once so it enters the user's recently-viewed history.
    const recorded = recordOnOpen(page);
    await page.goto(`/dataentities/${id}/overview`);
    await recorded;

    // On the catalog search list, the recency is a dedicated column (header + the row's marker), NOT
    // crammed inline next to the name. On ref:main the column does not exist -> RED by construction.
    await page.goto('/search');
    await search(page, NAME2);
    await expect(
      page.getByText('Recently viewed').first(),
      'the Recently-viewed column header is present on the list'
    ).toBeVisible({ timeout: 10_000 });
    const row = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: NAME2 })
      .first();
    await expect(row, 'the entity row is listed').toBeVisible({ timeout: 10_000 });
    await expect(
      row.locator('[data-qa="recently-viewed-tag"]'),
      'the recency marker renders in the row (its own column)'
    ).toBeVisible({ timeout: 10_000 });

    // G-C12 pixel gate: capture the rendered list column for the maintainer's review.
    await page.screenshot({ path: 'test-results/it149-recency-list-column.png', fullPage: true });

    await request.delete(`/api/recently-viewed/DATA_ENTITY/${id}`); // cleanup
  });

  test('the detail header shows the absolute open time (tz + explicit offset), not a relative "0 ago" (#1816 / CTRIB-043)', async ({
    page,
    request,
  }) => {
    const id = await setup(request);

    // Open the asset — record-on-open sets lastViewedAt = now, so the header value is ALWAYS ~now.
    const recorded = recordOnOpen(page);
    await page.goto(`/dataentities/${id}/overview`);
    await recorded;

    // The detail-header marker must show an ABSOLUTE timestamp with an explicit UTC offset (e.g.
    // "Viewed 29 Jun 2026, 12:34 UTC+00:00"). On ref:main the header renders the relative
    // "Viewed 0 seconds ago" — meaningless here (it resets on every refresh) — so the offset is absent
    // -> RED by construction; the fix makes it GREEN.
    const tag = page.locator('[data-qa="recently-viewed-tag"]').first();
    await expect(tag, 'the recency marker shows on the detail header').toBeVisible({
      timeout: 10_000,
    });
    await expect(
      tag,
      'an absolute timestamp with an explicit UTC offset, not a relative "x ago"'
    ).toContainText(/UTC[+-]\d{2}:\d{2}/, { timeout: 10_000 });
    await expect(tag, 'the meaningless relative "x ago" form is gone').not.toContainText('ago');

    // G-C12 pixel gate: capture the rendered detail-header timestamp for the maintainer's review.
    await page.screenshot({
      path: 'test-results/it149-detail-absolute-time.png',
      fullPage: true,
    });

    await request.delete(`/api/recently-viewed/DATA_ENTITY/${id}`); // cleanup
  });

  test('the Recently Viewed home column highlights a data entity with open alerts, like Popular (#1816 / CTRIB-044)', async ({
    page,
    request,
  }) => {
    // An entity with an OPEN alert, recorded into the recently-viewed history.
    await seedEntityAlert();
    await request.post(`/api/recently-viewed/DATA_ENTITY/${ENTITY_ID}`);

    // On the home Recommended section the Recently Viewed column flags the alerted row with the SAME
    // marker the Popular column uses (a red alert background + an alert icon). On ref:main the home
    // columns carry no alert marker -> RED by construction; the fix makes it GREEN.
    await page.goto('/');
    await expect(
      page.locator('[data-qa="recommended-recently-viewed"] [data-qa="recommended-alert"]'),
      'the Recently Viewed column flags the alerted entity (the Popular treatment)'
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: 'test-results/it149-recommended-alert-highlight.png',
      fullPage: true,
    });
    await request.delete(`/api/recently-viewed/DATA_ENTITY/${ENTITY_ID}`); // cleanup
  });

  test('the Search list pins the Name + Recently-viewed columns on a narrow screen, so the recency value + its remove control are on-screen without horizontal scrolling (#1816 / CTRIB-044)', async ({
    page,
    request,
  }) => {
    // A standard-width screen (lg breakpoint). The catalog search table floors at a min-width wider than the
    // results area here, so the trailing columns overflow — the pin is what keeps the recency cell on screen.
    await page.setViewportSize({ width: 1280, height: 820 });
    const id = 2211;
    const NAME = 'IT149ScrollColEntity';
    await seedSearchableEntity(id, NAME);
    await request.post(`/api/recently-viewed/DATA_ENTITY/${id}`);

    await page.goto('/search');
    await search(page, NAME);
    await expect(page.getByText('Recently viewed').first()).toBeVisible({ timeout: 10_000 });

    // The table floors at a min-width and OVERFLOWS the narrow viewport — it does NOT compress every column
    // into view (which clipped the recency cell). On ref:main there is no min-width so the columns compress
    // and the container is not scrollable -> this assertion is RED by construction.
    const overflow = await page
      .locator('#results-list')
      .evaluate(el => el.scrollWidth > el.clientWidth + 50);
    expect(overflow, 'the list overflows at its min-width rather than compressing every column').toBe(
      true
    );

    // Despite that overflow, the Recently-viewed column is PINNED to the right edge (and Name to the left),
    // so the recency value + its remove control are on-screen with NO horizontal scrolling — the maintainer
    // does not have to find/drag a scrollbar to see them. This is the robust guarantee (CTRIB-044 follow-up).
    const row = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: NAME })
      .first();
    await expect(
      row.locator('[data-qa="recently-viewed-remove"]'),
      'the recency remove control is reachable (pinned right) without scrolling'
    ).toBeInViewport({ timeout: 10_000 });
    await expect(
      page.getByText('Name').first(),
      'the Name column is pinned to the left'
    ).toBeInViewport();

    await page.screenshot({ path: 'test-results/it149-list-pinned.png', fullPage: true });
    await request.delete(`/api/recently-viewed/DATA_ENTITY/${id}`); // cleanup
  });
});

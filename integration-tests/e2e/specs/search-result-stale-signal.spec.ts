import { test, expect } from '@playwright/test';
import { seedSearchableEntity, setEntityLastIngestedDaysAgo } from '../helpers/db';

/**
 * IT-067 — F-146 Search Result Item rendering of the per-entity is_stale signal.
 *
 * Protocol: integration-tests/protocols/IT-067-search-result-stale-signal.md
 * Gates: validates F-146 (UC-1 — a stale entity renders the orange-clock icon on its Search result
 *        row; UC-2 — a fresh entity renders NO icon, the fresh state IS the absence of the icon).
 *
 * Every Search result row hands the backend `is_stale` boolean to the shared MetadataStale primitive:
 * ResultItem.tsx:87-90 `<MetadataStale isStale={searchResult.isStale} .../>`. MetadataStale.tsx:20-32
 * renders `<StaleIcon/>` ONLY when isStale=true and returns null otherwise. StaleIcon (StaleIcon.tsx)
 * is an orange clock — a single `<path fill="#FFAA00">` inside an `svg`. The backend predicate
 * (DataEntityStaleDetector.java:13) flips is_stale when `lastIngestedAt + odd.data-entity-stale-period
 * < now()`; the default period is ACTIVE on this image (verified: a 60-day-old entity reports
 * is_stale=true, a fresh one is_stale=false — same finding as IT-041).
 *
 * Rigorous design: seed TWO searchable entities sharing a search term — one STALE (last_ingested 60d
 * ago) and one FRESH (last_ingested now). Search, then assert the orange-clock icon renders on the
 * stale row ONLY and is absent on the fresh row. The absence-on-fresh assertion is what makes this a
 * real signal test and not just "an icon exists somewhere".
 *
 * GROUND TRUTH: the icon's exact DOM (svg + path fill #FFAA00) is read from StaleIcon.tsx; the
 * is_stale values are forced via last_ingested_at in the DB and confirmed on the wire (GET results
 * carries is_stale). react-query caveat: wait for the results GET before asserting.
 *
 * Namespace: ids 20670-20679 · oddrn //e2e-it067/ · names it067_*
 */
const STALE_ID = 20670;
const FRESH_ID = 20671;
const TERM = 'it067stalecheck';
const STALE_NAME = `${TERM}_stale`;
const FRESH_NAME = `${TERM}_fresh`;
const STALE_DAYS = 60; // well past any reasonable default stale-period

// The orange-clock StaleIcon: a single <path fill="#FFAA00"> (StaleIcon.tsx) — the render-faithful
// locator for "this row shows the stale signal".
const STALE_ICON = 'svg path[fill="#FFAA00"]';

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

test.describe('F-146 Search Result stale signal — orange-clock per-row', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(STALE_ID, STALE_NAME);
    await seedSearchableEntity(FRESH_ID, FRESH_NAME);
    await setEntityLastIngestedDaysAgo(STALE_ID, STALE_DAYS); // force is_stale=true
    await setEntityLastIngestedDaysAgo(FRESH_ID, 0); // freshly ingested -> is_stale=false
  });

  test('the stale row shows the orange-clock icon; the fresh row does not', async ({ page }) => {
    await page.goto('/search');
    await search(page, TERM);

    const staleRow = page.getByTestId('search-result-item').filter({ hasText: STALE_NAME });
    const freshRow = page.getByTestId('search-result-item').filter({ hasText: FRESH_NAME });

    await expect(staleRow, 'the stale entity must render as a result row').toBeVisible({
      timeout: 10_000,
    });
    await expect(freshRow, 'the fresh entity must render as a result row').toBeVisible({
      timeout: 10_000,
    });

    // ---- assert: the stale signal renders on the STALE row ----
    await expect(
      staleRow.locator(STALE_ICON),
      'the orange-clock stale icon MUST render on the stale row (is_stale=true)',
    ).toBeVisible({ timeout: 10_000 });

    // ---- assert: the fresh row carries NO stale signal (absence-of-icon IS the fresh state) ----
    await expect(
      freshRow.locator(STALE_ICON),
      'the fresh row MUST NOT render the stale icon (is_stale=false -> MetadataStale returns null)',
    ).toHaveCount(0);
  });
});

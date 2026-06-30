import { test, expect } from '@playwright/test';
import { seedSearchableEntity } from '../helpers/db';

/**
 * IT-047 — F-017 Catalog search: clearing the query RESETS the search (#1825-adjacent bug).
 *
 * Reported (maintainer, 2026-06-30): on /search, type a string then clear it — by the
 * clear "x" in the box OR by deleting the text and pressing Enter — and the results are
 * NOT reset; the box empties but the filtered result set stays. The full catalog should
 * come back (an empty query matches everything).
 *
 * Root cause (FE): the clear "x" (Input.handleCleanUpClick) only clears the local input
 * text; it never dispatches a search update. So the redux search session keeps the old
 * query and the old (filtered) results. The Enter path (handleUpdateSearch) DOES dispatch
 * an update for an empty query — kept here as a guard that the fix does not regress it.
 *
 * Design (mirrors IT-022): seed TWO distinct searchable entities; a unique-term search
 * yields exactly the one match (the other is filtered out); after clearing, the result
 * set must GROW back to the full catalog (strictly more than the single filtered match).
 * Asserting "row count grows" is pagination-proof — it does not depend on which entities
 * land on page 1 of the reset list.
 */
const ALPHA = 'IT047ClearAlpha';
const BETA = 'IT047ClearBeta';

const box = (page: import('@playwright/test').Page) =>
  page.getByPlaceholder('Search', { exact: true });
const rows = (page: import('@playwright/test').Page) =>
  page.getByTestId('search-result-item');
// The clear "x": the (last) button inside the search input's relative container —
// [search-icon button] … <input data-qa=search_string> … [clear-icon button]. Exists on
// both main (RED) and the fix (GREEN), so the RED proof observes the SYMPTOM, not a miss.
const clearX = (page: import('@playwright/test').Page) =>
  page.locator('div:has(> input[data-qa="search_string"]) button').last();

async function runSearch(page: import('@playwright/test').Page, query: string): Promise<void> {
  // /search mounts by creating an empty session then rewriting the URL to /search/{id};
  // the Enter dispatches PUT /api/search/{id}. Wait for both (IT-022's hardening).
  await page.waitForURL(/\/search\/[0-9a-f-]+/, { timeout: 15_000 });
  const sessionId = new URL(page.url()).pathname.split('/').pop();
  await box(page).fill(query);
  const updated = page.waitForResponse(
    (r) =>
      new RegExp(`/api/search/${sessionId}$`).test(r.url().split('?')[0]) &&
      r.request().method() === 'PUT' &&
      r.ok(),
  );
  await box(page).press('Enter');
  await updated;
}

// HELD per CTRIB-047 (maintainer GATE-1, 2026-06-30): the clear-✕ reset bug is reproduced + root-caused, but
// the FIX is DEFERRED into the #1825 search-overhaul epic. `.fixme` keeps this reproduction in the tree as
// ready groundwork WITHOUT running or failing (it needs a live stack + is RED on main until the fix lands).
// To activate: remove `.fixme`, fix the racy baseline count (await the row render before counting), register as
// IT-047 in suites.yaml, then run RED on ODD_SUT=ref:main → GREEN on the fix.
test.describe.fixme('F-017 Catalog search — clearing the query resets the search', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(2047, ALPHA);
    await seedSearchableEntity(2048, BETA);
  });

  test('clicking the clear (x) resets the search to the full catalog', async ({ page }) => {
    await page.goto('/search');
    await runSearch(page, ALPHA);

    await expect(page.getByText(ALPHA).first()).toBeVisible({ timeout: 10_000 });
    const filtered = await rows(page).count();
    console.log('[repro] rows after search:', filtered, 'box:', await box(page).inputValue());

    await clearX(page).click();
    await page.waitForTimeout(2500); // give any reset dispatch + refetch time to land
    const afterClear = await rows(page).count();
    console.log('[repro] rows after clear x:', afterClear, 'box:', await box(page).inputValue());
    await page.screenshot({ path: 'test-results/repro-clear-x.png', fullPage: true });

    await expect
      .poll(() => rows(page).count(), {
        message: 'clearing via the x must reset the search (results grow back past the single filtered match)',
        timeout: 8_000,
      })
      .toBeGreaterThan(filtered);
  });

  test('deleting the text + Enter resets the search to the full catalog', async ({ page }) => {
    await page.goto('/search');
    await runSearch(page, ALPHA);

    const filtered = await rows(page).count();
    console.log('[repro] (del+enter) rows after search:', filtered);

    await box(page).click();
    await box(page).press('Control+a');
    await box(page).press('Delete');
    await box(page).press('Enter');
    await page.waitForTimeout(2500);
    const afterClear = await rows(page).count();
    console.log('[repro] (del+enter) rows after clear:', afterClear, 'box:', await box(page).inputValue());

    await expect
      .poll(() => rows(page).count(), {
        message: 'clearing via delete+Enter must reset the search',
        timeout: 8_000,
      })
      .toBeGreaterThan(filtered);
  });
});

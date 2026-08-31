import { test, expect, type Page } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-152 — the My-data scope filter's URL contract, the retired tab strip, the result count, and the
 * auth.type=DISABLED posture (ST-8 of #1825 / #1842, CTRIB-062).
 *
 * Protocol: integration-tests/protocols/IT-152-my-data-scope-url-and-posture.md
 * Gates: validates F-017 (the search URL is the source of truth — the scope group joins it) and F-148 (the
 *        result tab strip, whose LAST tab this slice retires).
 *
 * These are the four claims observable WITHOUT an owner identity, so they run on the shared odd-minimal
 * stack. The owner-scoped half — each scope actually narrowing, and the home panels deep-linking into it —
 * needs an authenticating stack and lives in IT-153.
 *
 * RED on ref:main: `?my_data[]=` is an unknown param there, so it is dropped on the first mirror write (and
 * the retired-tab / count / hidden-group assertions all describe surfaces that do not exist yet).
 *
 * Namespace: ids 21520-21521 · oddrn //e2e-it152/ · names it152mydata_*
 */
const TERM = 'it152mydata';
const ALPHA_ID = 21520;
const BETA_ID = 21521;
const ALPHA_NAME = `${TERM}_alpha`;
const BETA_NAME = `${TERM}_beta`;

// query-string serialises a list param as name[]=a,b (bracket-separator); the browser may percent-encode the
// brackets, so every URL matcher accepts either form — the IT-151 precedent.
const SCOPE_IN_URL = /my_data(\[\]|%5B%5D)=UPSTREAM/;
const UP_DEPTH_IN_URL = /upstream_depth=2/;
const STATUS_IN_URL = /statuses(\[\]|%5B%5D)=\d+/;

async function runSearch(page: Page, term: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(term);
  await box.press('Enter');
}

// Give the two entities distinct lifecycle statuses so the Statuses sidebar facet has something real to
// select. `statuses` is used rather than `tags` deliberately: it is a FIXED-option facet whose dropdown is
// populated without an async fetch, which is the interaction IT-151 already proves works. (A first pass here
// used `tags` and timed out waiting for its option — that facet's options only arrive with the session's
// aggregated facet list.) DataEntityStatusDto: STABLE=3, DEPRECATED=4.
async function seedDistinctStatuses(): Promise<void> {
  await dbQuery('UPDATE data_entity SET status = 3 WHERE id = $1', [ALPHA_ID]); // STABLE
  await dbQuery('UPDATE data_entity SET status = 4 WHERE id = $1', [BETA_ID]); // DEPRECATED
}

test.describe('ST-8 My-data scope — URL contract, retired tabs, count, DISABLED posture', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(ALPHA_ID, ALPHA_NAME);
    await seedSearchableEntity(BETA_ID, BETA_NAME);
  });

  test.afterAll(async () => {
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [ALPHA_ID, BETA_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [[ALPHA_ID, BETA_ID]]);
  });

  // THE #1858 REGRESSION GUARD — the highest-risk wiring point in the slice. my_data + its depths are
  // URL-ONLY params, so Search.tsx's facet->URL mirror must merge them back from the live URL. A param
  // missing from that merge object survives a page load and then vanishes on the NEXT facet toggle: you
  // scope a search to your data, click one more filter, and silently get the whole catalog back.
  test('the scope + depth params SURVIVE a sidebar facet toggle (the #1858 mirror-merge class)', async ({
    page,
  }) => {
    await seedDistinctStatuses();

    await page.goto(`/search?q=${TERM}&my_data[]=UPSTREAM&upstream_depth=2`);
    await expect(page, 'the scope is in the URL on load').toHaveURL(SCOPE_IN_URL, { timeout: 15_000 });
    await expect(page, 'the depth is in the URL on load').toHaveURL(UP_DEPTH_IN_URL);

    // WAIT FOR THE PAGE TO SETTLE BEFORE TOUCHING THE SIDEBAR. A facet's option list is fetched lazily
    // (`getDataEntitySearchFacetOptions`) and needs the session's `searchId`, so a click that lands before the
    // session exists opens an empty dropdown that never repopulates. The results-count element only renders
    // once the asset search has resolved, so it is the honest "everything settled" signal — and under a
    // My-data scope on an auth-disabled deployment the count is legitimately 0, which is exactly the
    // fail-closed behaviour, not an error state.
    await expect(
      page.getByTestId('search-results-count'),
      'the search settled (0 results under a My-data scope with no owner — fail-closed, as designed)',
    ).toBeVisible({ timeout: 20_000 });

    // Toggle a sidebar facet the only way a user can — through the Statuses filter's dropdown.
    // The facet autocomplete is MUI **controlled-open**: the popup only shows after a debounced fetch
    // resolves and flips `autocompleteOpen`, so a bare click can land before the handler is wired and leave
    // the list closed for good. TYPE into it instead — `pressSequentially` drives the same
    // `onInputChange -> handleFacetSearch` path a user does, and is this workspace's recorded technique for
    // this widget. (A click alone passed when the stack was already warm and hung on a freshly-recreated one.)
    const statuses = page.locator('#filter-statuses');
    await statuses.click();
    await statuses.pressSequentially('STAB', { delay: 60 });
    const stableOption = page.getByRole('option', { name: 'STABLE' });
    await expect(stableOption, 'the Statuses dropdown offered STABLE').toBeVisible({ timeout: 30_000 });
    await stableOption.click();

    await expect(page, 'the toggled facet reaches the URL').toHaveURL(STATUS_IN_URL, { timeout: 15_000 });
    await expect(page, 'and the My-data scope is STILL there — not dropped by the mirror').toHaveURL(
      SCOPE_IN_URL,
    );
    await expect(page, 'and so is its per-direction depth').toHaveURL(UP_DEPTH_IN_URL);

    // Give the 400ms mirror debounce more than enough time to fire a late write that could still drop it.
    await page.waitForTimeout(1_500);
    await expect(page, 'no late mirror write drops the scope').toHaveURL(SCOPE_IN_URL);
  });

  test('the result tab strip is GONE, and the match count survives its retirement', async ({ page }) => {
    await page.goto('/search');
    await runSearch(page, TERM);

    await expect(
      page.getByTestId('search-result-item').filter({ hasText: ALPHA_NAME }),
      'the seeded entity is found, so the page really rendered results',
    ).toBeVisible({ timeout: 15_000 });

    // NB: scope this to the retired LABELS, not to `getByRole('tab')` wholesale — the app TOOLBAR
    // (Catalog / Dictionary / Management / ...) is also a MUI tab strip, and this slice does not touch it.
    // A blanket count-0 assertion fails against the toolbar and says nothing about the result strip.
    for (const retired of ['My Objects', 'Datasets', 'Transformers', 'Quality Tests']) {
      await expect(
        page.getByRole('tab', { name: new RegExp(retired) }),
        `the result-class tab "${retired}" is retired — ST-4 removed seven, ST-8 removed the last`,
      ).toHaveCount(0);
    }

    const count = page.getByTestId('search-results-count');
    await expect(count, 'the count moved into the results header — it was ONLY on the retired tab hint').toBeVisible(
      { timeout: 15_000 },
    );
    await expect(count, 'and it reports the two seeded matches').toHaveText(/2 results/);
  });

  test('an empty search reports "0 results" — not a bare list that reads as a loading failure', async ({
    page,
  }) => {
    await page.goto('/search');
    await runSearch(page, 'it152nothingmatchesthistoken');

    await expect(page.getByTestId('search-results-count')).toHaveText(/0 results/, { timeout: 15_000 });
  });

  // The DISABLED posture (spec R7). There is no user-owner identity on this deployment, so the filter could
  // only ever be empty — and a permanently-dead control is clutter with no remedy. This mirrors what the
  // manual already publishes for the twin surface: the Recommended panel is hidden entirely under DISABLED.
  // The contrasting state (signed in, no Owner binding -> rendered, DISABLED, remedy named) is IT-153.
  test('the My-data group is HIDDEN under auth.type=DISABLED — never a silently-empty control', async ({
    page,
  }) => {
    await page.goto('/search');
    await expect(page.locator('#filter-asset_kinds'), 'the sidebar itself rendered').toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.locator('#filter-my_data'),
      'no My-data control on a deployment where it can never resolve an owner',
    ).toHaveCount(0);
    await expect(
      page.getByText('My data', { exact: true }),
      'and no orphaned group heading either',
    ).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { seedSearchableEntity } from '../helpers/db';

/**
 * IT-150 — F-017 search state in the URL (ST-1 / ADR D10; slice ST-1a of the #1825 search overhaul, CTRIB-048).
 *
 * Protocol: integration-tests/protocols/IT-150-search-url-state.md
 * Gates: validates F-017 (the search query lives in the URL as ?q=, so a search is shareable, bookmarkable,
 *        and back/forward-correct — the canonical param URL replaces the expiring /search/{sessionId} share
 *        handle). regresses: the ST-1a query-URL contract.
 *
 * ST-1a moves the search QUERY into the URL. Committing a query (home hero OR the search-page box) navigates
 * to the canonical /search?q=<query> — NO session id in the URL — and the page runs the search from the URL.
 * A shared/bookmarked param URL re-runs deterministically; browser back/forward navigate prior query states;
 * a malformed param URL fails closed to the default browse. Legacy /search/{sessionId} deep-links keep
 * working (D9) — proven by IT-125, unchanged here.
 *
 * RED on ref:main (CTRIB-048 base): main navigates committed queries to /search/{sessionId} (no ?q=), so the
 * URL + share + back/forward assertions all fail. GREEN on the working-tree SUT.
 */
const ALPHA = 'IT150UrlAlpha';
const BETA = 'IT150UrlBeta';

const resultsLoaded = (page: Page) =>
  page.waitForResponse(
    (r) =>
      /\/api\/search\/[0-9a-f-]+\/results/.test(new URL(r.url()).pathname) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

test.describe('F-017 search URL state — ?q= is the canonical, shareable form (ST-1a / D10)', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(2150, ALPHA);
    await seedSearchableEntity(2151, BETA);
  });

  test('committing a query writes ?q= to the URL (no session id) and shows the match', async ({ page }) => {
    await page.goto('/search');
    const box = page.getByPlaceholder('Search', { exact: true });
    await box.fill(ALPHA);
    const results = resultsLoaded(page);
    await box.press('Enter');

    // ST-1a: the canonical share URL is /search?q=<query> — NOT the old /search/{sessionId}.
    await expect(page, 'the committed query lands in the URL as ?q=').toHaveURL(
      /\/search\?[^/]*q=IT150UrlAlpha/,
      { timeout: 15_000 },
    );
    expect(new URL(page.url()).pathname, 'the URL carries no session-id segment').toBe('/search');
    await results;

    await expect(
      page.getByText(ALPHA).first(),
      'the committed query renders its match',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(BETA).filter({ visible: true }),
      'non-matching entities are filtered out',
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('opening a /search?q= URL fresh (no prior session) reproduces the search — the share/bookmark proof', async ({ page }) => {
    await page.goto(`/search?q=${ALPHA}`);

    await expect(
      page.getByPlaceholder('Search', { exact: true }),
      'the query is restored into the box from the URL alone',
    ).toHaveValue(ALPHA, { timeout: 15_000 });
    await expect(
      page.getByText(ALPHA).first(),
      'the shared/bookmarked URL reproduces the result with no pre-existing session',
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(BETA).filter({ visible: true })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test('browser back/forward navigates prior query states', async ({ page }) => {
    await page.goto(`/search?q=${ALPHA}`);
    await expect(page.getByText(ALPHA).first()).toBeVisible({ timeout: 15_000 });

    const box = page.getByPlaceholder('Search', { exact: true });
    await box.fill(BETA);
    await box.press('Enter');
    await expect(page).toHaveURL(/q=IT150UrlBeta/, { timeout: 15_000 });
    await expect(page.getByText(BETA).first()).toBeVisible({ timeout: 10_000 });

    await page.goBack();
    await expect(page, 'back returns to the prior query in the URL').toHaveURL(
      /q=IT150UrlAlpha/,
      { timeout: 15_000 },
    );
    await expect(
      page.getByText(ALPHA).first(),
      'back re-runs the prior query (the URL is the source of truth)',
    ).toBeVisible({ timeout: 10_000 });

    await page.goForward();
    await expect(page).toHaveURL(/q=IT150UrlBeta/, { timeout: 15_000 });
    await expect(page.getByText(BETA).first()).toBeVisible({ timeout: 10_000 });
  });

  test('unknown / extra params are ignored — the search still runs (fail-closed, R5)', async ({ page }) => {
    // R5 (fail closed): a shared URL may carry unknown extras (tracking params, a future facet key the
    // current build does not know). The SPA IGNORES them and still runs the q search — it never breaks.
    // (A genuinely malformed %-encoding like `%zz` is rejected by the server with a 400 BEFORE the SPA
    // loads — that is the server's URL validation, covered by the framework-status contract, not an SPA
    // concern; so the SPA-side fail-closed is exercised with valid-encoding unknown params.)
    await page.goto(`/search?q=${ALPHA}&foo=bar&utm_source=x`);

    await expect(
      page.getByPlaceholder('Search', { exact: true }),
      'the search box renders and restores the query despite unknown extra params',
    ).toHaveValue(ALPHA, { timeout: 15_000 });
    await expect(
      page.getByText(ALPHA).first(),
      'the q search runs; the unknown params are ignored, not fatal',
    ).toBeVisible({ timeout: 10_000 });
  });
});

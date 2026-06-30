import { test, expect, type Page } from '@playwright/test';

/**
 * IT-125 — F-017 search deep-link to a NON-EXISTENT / expired search session — FIXED CONTRACT (#1760).
 *
 * Protocol: integration-tests/protocols/IT-125-search-session-not-found.md
 * Gates: validates F-017 (search). regresses: PLT-150/#1760 + the #1761 advice class.
 *
 * RE-GROUNDED 2026-06-11 (LSN-029 flip): the original pins asserted the pre-fix behaviour —
 * filters-path 500 SYS001 + the generic "Unknown Error" boundary. Re-verification falsified their
 * mechanics: the REAL filters route (facet/{type}) already 404'd; the 500 came from the
 * ControllerAdvice catch-all swallowing framework ResponseStatusExceptions on an UNROUTED path;
 * and the SPA never fetched any deep-linked session at all (the /search/* splat route dropped the
 * :searchId param since #1551, Dec 2023) — the old "Unknown Error" only rendered when stack
 * residue (PLT-147/#1755 transformer NPE) broke the silently-created REPLACEMENT search, so that
 * pin was order/residue-dependent (it failed on a fresh pre-fix stack, run-log 2026-06-11).
 *
 * Fixed contract under test:
 *  - every missing-session read is 404 USR002 (facets, results, facet/{type});
 *  - an unrouted /api path is a framework 404 (not 500); an invalid facet enum is 400 USR001;
 *  - /search/{id} and /termsearch/{id} actually LOAD the deep-linked session (router param wired);
 *  - a dead link renders the graceful "This search has expired" state with a working
 *    "Start new search" recovery (asserted to the new-session URL, NOT to the results list —
 *    keeps this spec independent of PLT-147 seed residue).
 */

// A syntactically-valid UUID that will never be a real search session.
const MISSING = 'ffffffff-1125-4125-8125-ffffffffffff';

const apiGet = (page: Page, pathname: string) =>
  page.waitForResponse(
    (r) => new URL(r.url()).pathname === pathname && r.request().method() === 'GET',
  );

test.describe('F-017 search — deep-link to a non-existent/expired session (#1760 fixed contract)', () => {
  test('missing-session reads are uniformly 404 USR002 — facets, results, and the real filters route', async ({ request }) => {
    for (const ep of [
      `/api/search/${MISSING}`,
      `/api/search/${MISSING}/results?page=1&size=30`,
      `/api/search/${MISSING}/facet/TAGS?page=1&size=30`,
    ]) {
      const res = await request.get(ep);
      expect(res.status(), `${ep}: a missing search session must be a clean 404. Got ${res.status()}.`).toBe(404);
      const body = (await res.json()) as { code?: string };
      expect(body.code, `${ep}: the 404 carries USR002 "Search not found"`).toBe('USR002');
    }
  });

  test('framework statuses pass through the advice — unrouted path 404, invalid facet enum 400 (no 500 SYS001)', async ({ request }) => {
    // #1760's literal reproduction URL: matches NO route. Pre-fix: NoResourceFoundException(404)
    // swallowed by the Exception catch-all -> 500 SYS001. Post-fix: the 404 passes through.
    const unrouted = await request.get(`/api/search/${MISSING}/filters/entityClasses`);
    expect(unrouted.status(), 'an unrouted /api path keeps the framework 404 (advice pass-through)').toBe(404);
    expect(((await unrouted.json()) as { code?: string }).code).toBe('USR002');

    // Invalid enum on the real route: ServerWebInputException(400) — the #1761 class.
    const badEnum = await request.get(`/api/search/${MISSING}/facet/entityClasses?page=1&size=30`);
    expect(badEnum.status(), 'an invalid facet_type is the client\'s 400, not a platform 500').toBe(400);
    expect(((await badEnum.json()) as { code?: string }).code).toBe('USR001');
  });

  test('UI: /search/{missing} renders the graceful expired state and "Start new search" recovers', async ({ page }) => {
    await page.goto(`/search/${MISSING}`);

    await expect(
      page.getByText('This search has expired'),
      '#1760 (UX): a dead search link explains itself instead of a generic error or a silent reset',
    ).toBeVisible({ timeout: 15_000 });

    const startNew = page.getByRole('button', { name: 'Start new search' });
    await expect(startNew, 'the expired state offers a start-a-new-search affordance').toBeVisible();

    await startNew.click();
    // Recovery (ST-1a / ADR D10, CTRIB-048): "Start new search" now navigates to the canonical clean
    // /search (no session id — a fresh browse), replacing the dead /search/{missing} link; the expired
    // state clears. (Pre-ST-1a this minted a new /search/{uuid} session URL — RED-on-base discriminator.)
    // Deliberately NOT asserting the results list (PLT-147 seed residue must not flake this).
    await expect(page).toHaveURL(/\/search$/, { timeout: 15_000 });
    await expect(page.getByText('This search has expired')).toBeHidden();
  });

  test('UI: /search/{valid} deep-link actually loads the shared session (the #1551 splat regression)', async ({ page, request }) => {
    const QUERY = 'it125deeplink';
    const created = await request.post('/api/search', {
      data: { query: QUERY, filters: {} },
    });
    expect(created.ok()).toBeTruthy();
    const searchId = ((await created.json()) as { search_id: string }).search_id;
    expect(searchId).toMatch(/[0-9a-f-]{36}/);

    // The old splat route silently POSTed a NEW search for every deep-link. Collect POSTs to prove
    // the deep-linked session is LOADED, not replaced.
    const searchPosts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/search') searchPosts.push(r.url());
    });

    const facetsLoaded = apiGet(page, `/api/search/${searchId}`);
    await page.goto(`/search/${searchId}`);
    const facets = await facetsLoaded;
    expect(facets.status(), 'the deep-linked session is fetched (router param wired again)').toBe(200);

    await expect(
      page.getByPlaceholder('Search', { exact: true }),
      'the shared session\'s query is restored in the search box',
    ).toHaveValue(QUERY, { timeout: 15_000 });
    expect(searchPosts, 'no replacement search is silently created for a valid deep-link').toHaveLength(0);
  });

  test('UI: /termsearch/{valid} restores and /termsearch/{missing} shows the expired state (same class)', async ({ page, request }) => {
    const created = await request.post('/api/terms/search', { data: { query: '', filters: {} } });
    expect(created.ok()).toBeTruthy();
    const termSearchId = ((await created.json()) as { search_id: string }).search_id;

    const facetsLoaded = apiGet(page, `/api/terms/search/${termSearchId}`);
    await page.goto(`/termsearch/${termSearchId}`);
    expect((await facetsLoaded).status(), 'the deep-linked term-search session is fetched').toBe(200);

    await page.goto(`/termsearch/${MISSING}`);
    await expect(
      page.getByText('This search has expired'),
      'a dead term-search link gets the same graceful expired state',
    ).toBeVisible({ timeout: 15_000 });
  });
});

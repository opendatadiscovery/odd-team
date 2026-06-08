import { test, expect } from '@playwright/test';

/**
 * IT-125 — F-017 search deep-link to a NON-EXISTENT / expired search session.
 *
 * Protocol: integration-tests/protocols/IT-125-search-session-not-found.md
 * Gates: validates F-017 (search) — the expired/invalid-session deep-link path the happy-path
 *        catalog-search spec never exercises. regresses: PLT-150.
 *
 * A user who bookmarks/shares a /search/{id} URL, or returns after the ephemeral search session is
 * evicted by the housekeeping TTL, hits a session id that no longer exists. TRUE clean-stack behaviour
 * (maintainer-found 2026-06-08, re-probed on an undisturbed stack):
 *  - facets `GET /api/search/{id}` and results `GET /api/search/{id}/results` correctly return
 *    404 USR002 "Search not found" (Mono path → NotFoundException maps to 404). ✓ CONFIRMED — green-lock.
 *  - filters `GET /api/search/{id}/filters/...` returns 500 SYS001 — the bug (PLT-150): getFilterOptions
 *    returns a Flux the controller wraps `Mono.just(flux).map(ok)`, so 200 commits BEFORE the Flux hits
 *    the missing-session NotFoundException → it degrades to 500 instead of 404. RED-on-fix pin.
 *  - UI `/search/{id}` → the SPA error boundary shows a generic "Unknown Error / Return to the Home Page"
 *    (no graceful "search expired — start a new one"). UX-gap pin.
 */

// A syntactically-valid UUID that will never be a real search session.
const MISSING = 'ffffffff-1125-4125-8125-ffffffffffff';

test.describe('F-017 search — deep-link to a non-existent/expired session (PLT-150)', () => {
  test('CONFIRMED: facets + results of a missing session return 404 "Search not found" (graceful)', async ({ request }) => {
    for (const ep of [`/api/search/${MISSING}`, `/api/search/${MISSING}/results?page=1&size=30`]) {
      const res = await request.get(ep);
      expect(res.status(), `${ep}: a missing search session must be a clean 404 (Mono path maps NotFoundException). Got ${res.status()}.`).toBe(404);
      const body = (await res.json()) as { code?: string };
      expect(body.code, `${ep}: the 404 carries USR002 "Search not found"`).toBe('USR002');
    }
  });

  test('PLT-150 pin: the filters endpoint 500s on a missing session (should be 404, like facets/results)', async ({ request }) => {
    const res = await request.get(`/api/search/${MISSING}/filters/entityClasses?page=1&size=30`);
    // KNOWN BUG (PLT-150): getFilterOptions returns a Flux; the controller commits 200 before the Flux
    // hits the missing-session NotFoundException → 500 SYS001, not the 404 the Mono paths give. Pin the
    // current 500 so it FLIPS RED when getFilterOptions gains the same not-found handling (→ 404).
    expect(
      res.status(),
      `PLT-150: the filters read of a missing session currently 500s (Flux-wrapping commits 200 first). ` +
        `Got ${res.status()} — if 404, the fix landed: update this pin.`,
    ).toBe(500);
    expect(((await res.json()) as { code?: string }).code, 'the 500 carries the generic SYS001 catch-all').toBe('SYS001');
  });

  test('UX pin: /search/{missing} renders the generic "Unknown Error" boundary, not a graceful expired state', async ({ page }) => {
    await page.goto(`/search/${MISSING}`);
    await expect(
      page.getByText(/Unknown Error/i),
      'PLT-150 (UX): the SPA shows the generic "Unknown Error" boundary for an expired/invalid search link',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/Home Page/i),
      'the boundary offers only "Return to the Home Page" — no start-a-new-search affordance',
    ).toBeVisible();
  });
});

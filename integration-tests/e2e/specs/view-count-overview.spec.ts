import { test, expect } from '@playwright/test';
import { seedEntity, readViewCount, ENTITY_ID } from '../helpers/db';

/**
 * IT-002 — F-001 view_count, the REAL user scenario.
 *
 * Protocol: integration-tests/protocols/IT-002-view-count-ui-overview.md
 * Gates: validates F-001 (Popular-Entities ranking is driven by view_count) ·
 *        regresses PLT-104 (LSN-017 UI double-count).
 *
 * Why this is the integration test (and the API probe P-001 is only a backend
 * sub-check): the double-count lives in a React useEffect dependency-array bug
 * (LSN-017). An HTTP probe hitting GET /api/dataentities/{id} sees the correct
 * backend +1/call and CANNOT observe the doubling. Only opening the page in a real
 * browser fires the buggy effect. So the user-observable truth is only reachable
 * end-to-end, UI included — which is the whole point.
 *
 * EXPECTED RESULT TODAY: RED. One Overview page-open registers +2, not +1. That red
 * IS the regression signal for PLT-104; it goes green when PLT-104 is fixed.
 */
test.describe('F-001 view_count — opening the entity Overview page', () => {
  test('a single page-open registers exactly one view (PLT-104: it double-counts)', async ({ page }) => {
    // ---- arrange: a fresh entity at view_count = 0 (seeded in the DB, not via API) ----
    await seedEntity();
    expect(await readViewCount(), 'precondition: seeded entity starts at 0 views').toBe(0);

    // ---- act: the real user action — open the entity's Overview page, exactly once ----
    // Route note: ODD serves the entity page at /dataentities/{id}/overview. If this 404s
    // or the count stays 0, confirm the route against the running UI and adjust here.
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    // Let the detail fetch(es) the page fires settle (the bug fires GET detail twice).
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // settle margin for the second (buggy) fetch

    // ---- assert: one visit == one view (documented/intended behaviour) ----
    const finalCount = await readViewCount();
    expect(
      finalCount,
      `One Overview page-open must register exactly ONE view; got ${finalCount}. ` +
        `2 → the LSN-017/PLT-104 UI double-count is live (the bug this test pins). ` +
        `0 → the page did not load the entity (verify the UI route in this spec).`,
    ).toBe(1);
  });
});

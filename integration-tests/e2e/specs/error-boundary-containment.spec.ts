import { test, expect } from '@playwright/test';
import { interceptDashboard } from '../helpers/net';

/**
 * IT-006 — SPA error-boundary containment.
 *
 * Protocol: integration-tests/protocols/IT-006-error-boundary-containment.md
 * Gates: validates F-042 (Page-level UI error handling) · regresses TEST-GAP-1013.
 *
 * The gap (TEST-GAP-1013 / F-042): odd-platform-ui has NO React error boundary
 * anywhere (`grep -r "ErrorBoundary\\|componentDidCatch" src` → 0 hits). So ANY
 * render-time throw — a malformed/version-skewed API payload, an out-of-enum value,
 * a null where an object was expected — propagates to the React root, unmounts the
 * ENTIRE tree, and white-screens the whole app (nav chrome included), not just the
 * one broken view. This is the *class* behind the IT-004 dashboard crash: IT-004 pins
 * the specific palette lookup (PLT-052); IT-006 pins the missing containment that
 * turns any such local fault into a total outage.
 *
 * We induce a render throw with a malformed dashboard payload (`tablesDashboard: null`
 * → DataQualityContent.tsx:55 `data.tablesDashboard.tablesHealth` throws). This throw
 * is INDEPENDENT of the PLT-052 palette fix, so this test stays meaningful after IT-004
 * goes green — it isolates the error-boundary contract, not the palette bug.
 *
 * EXPECTED RESULT TODAY: RED. The malformed payload blanks the whole app (#root empties)
 * because nothing contains the throw. Goes green when a root/route-level ErrorBoundary
 * is added so the app shell survives and a contained error UI is shown.
 */
test.describe('IT-006 error boundary — a render throw must be contained, not white-screen the app', () => {
  test('a malformed dashboard payload leaves the app shell intact (TEST-GAP-1013 / F-042)', async ({
    page,
  }) => {
    // ---- baseline: the app shell renders normally ----
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const baselineLen = (await page.locator('#root').innerText().catch(() => '')).trim().length;
    expect(baselineLen, 'precondition: the app renders content before we inject a fault').toBeGreaterThan(0);

    // ---- arrange: a malformed dashboard payload that throws during render regardless
    //      of any palette fix (null where an object is dereferenced) ----
    await interceptDashboard(page, body => {
      body.tablesDashboard = null; // DataQualityContent.tsx:55 dereferences .tablesHealth
    });

    // ---- act: navigate to the dashboard so the throw fires ----
    await page.goto('/data-quality');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // ---- assert: the app must NOT have white-screened. With an error boundary, the
    //      throw is contained — the shell (nav) + a contained error UI remain, so #root
    //      still has content. With no boundary (today), the whole tree unmounts → blank. ----
    const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
    expect(
      rootText.length,
      `A render-time throw must be CONTAINED, not blank the whole app. #root is empty ` +
        `after a malformed dashboard payload — the entire React tree (nav chrome included) ` +
        `unmounted because there is no error boundary anywhere in odd-platform-ui ` +
        `(TEST-GAP-1013 / F-042). Add a root/route-level ErrorBoundary so a local fault ` +
        `degrades to a contained error UI instead of a total outage.`,
    ).toBeGreaterThan(0);
  });
});

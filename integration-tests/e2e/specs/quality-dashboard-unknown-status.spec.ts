import { test, expect } from '@playwright/test';
import { interceptDashboard } from '../helpers/net';

/**
 * IT-004 — Quality Dashboard unknown run-status blanks the page.
 *
 * Protocol: integration-tests/protocols/IT-004-quality-dashboard-unknown-status.md
 * Gates: validates F-032 (Quality Dashboard) · regresses PLT-052 (Defect 1).
 *
 * The bug: `DataQualityContent.tsx:47-48` does
 *   palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown
 * `palette.runStatus` is keyed by exactly the SIX DataEntityRunStatus values
 * (SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN). Any other status makes
 * `palette.runStatus[status]` undefined, so `.color` throws a TypeError BEFORE the
 * `??` can apply the fallback — during render, with no error boundary, blanking the
 * WHOLE dashboard (PLT-052: "A backend enum addition blanks the dashboard with the
 * build still green").
 *
 * Why simulate via response injection (not a DB seed): the defect is a UI render bug,
 * and PLT-052's stated trigger is a *backend enum addition*. We reproduce that exactly
 * by mutating the REAL dashboard response (so the shape is guaranteed correct) and
 * injecting one future status value into the test-results breakdown. The human-carryable
 * DB-seed equivalent (a `data_entity_task_last_run.status` outside the enum — the column
 * is VARCHAR(64), not a DB enum) is in the protocol §2.
 *
 * EXPECTED RESULT TODAY: RED. The unknown status throws and the dashboard does not
 * render. Goes green when line 48 becomes `palette.runStatus[status]?.color ?? …`.
 */

const FUTURE_STATUS = 'WARNING'; // a plausible future run-status the palette does not know

test.describe('IT-004 Quality Dashboard — an unknown run status must degrade, not blank the page', () => {
  test('an out-of-enum run status renders gracefully instead of crashing the dashboard (PLT-052)', async ({
    page,
  }) => {
    // ---- arrange: make the dashboard receive a status its palette does not know ----
    const intercept = await interceptDashboard(page, body => {
      // wire format is snake_case: test_results[].results[].{status,count}
      const poison = { status: FUTURE_STATUS, count: 1 };
      if (Array.isArray(body.test_results) && body.test_results.length > 0) {
        body.test_results[0].results = [...(body.test_results[0].results ?? []), poison];
      } else {
        body.test_results = [{ category: 'EXPECTATION', results: [poison] }];
      }
    });

    const renderErrors: string[] = [];
    page.on('pageerror', e => renderErrors.push(String(e)));

    // ---- act: open the dashboard; WAIT for the mutated response to land + re-render.
    //      react-query renders valid `initialData` (all-zero, known statuses) FIRST, so
    //      asserting too early would false-pass before the poisoned fetch resolves. ----
    const dashResp = page
      .waitForResponse(r => /dataqatests\/runs/i.test(r.url()), { timeout: 15_000 })
      .catch(() => null);
    await page.goto('/data-quality');
    await dashResp;
    await page.waitForTimeout(1500);

    // guard: prove the poison actually reached the UI — else the rest false-passes
    expect(
      intercept.injected,
      `the dashboard response was never intercepted+mutated (injected=0) — the test would ` +
        `false-pass. Check interceptDashboard's match against /api/dataqatests/runs.`,
    ).toBeGreaterThan(0);

    // ---- assert: the dashboard rendered its own content (graceful degrade), i.e. the
    //      component did NOT throw during render. "Test Results Breakdown" lives in the
    //      same component (DataQualityContent.tsx:110); if the palette lookup throws,
    //      nothing in the component renders and this title is absent. ----
    await expect(
      page.getByText('Test Results Breakdown'),
      `An out-of-enum run status ("${FUTURE_STATUS}") must render with a fallback colour, ` +
        `not throw. The dashboard failed to render — palette.runStatus["${FUTURE_STATUS}"] is ` +
        `undefined and .color threw before the ?? fallback (PLT-052 Defect 1, ` +
        `DataQualityContent.tsx:47-48). Uncaught render errors: ${JSON.stringify(renderErrors)}.`,
    ).toBeVisible();

    // corroboration: no uncaught TypeError reached the window (the render-throw signature)
    expect(
      renderErrors.filter(e => /color|undefined|TypeError/i.test(e)),
      `no uncaught render TypeError expected once the lookup is null-safe`,
    ).toEqual([]);
  });
});

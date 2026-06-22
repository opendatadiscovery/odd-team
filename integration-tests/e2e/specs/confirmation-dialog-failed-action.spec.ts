import { test, expect } from '@playwright/test';
import { ensureNamespace, cleanupLookupTablesByPrefix, createLookupTable } from '../helpers/lookup';

/**
 * IT-138 — a failed destructive confirm un-wedges the shared ConfirmationDialog (#1766 / PLT-163 / CTRIB-027).
 *
 * Protocol: integration-tests/protocols/IT-138-confirmation-dialog-failed-action.md
 * Gates: validates F-058 (lookup-table delete, a mutateAsync ConfirmationDialog consumer) ·
 *        regresses PLT-163 (the shared-component swallow → stuck-spinner modal).
 *
 * On main the dialog's `onClose` did `.catch(() => {})` — a rejected mutateAsync (non-2xx) left `isLoading`
 * stuck true, so DialogWrapper kept `pointer-events:none` (mouse-dead) with a forever-spinning bar. The fix
 * clears loading + surfaces the reason inline (reusing DialogWrapper's `errorText`), leaving the dialog open.
 *
 * This asserts the FIXED behaviour → RED on `ODD_SUT=ref:main` (wedged), GREEN on the working-tree fix.
 * The failure is forced via route-interception (deterministic); any real refusal (cascade-block USR004,
 * RBAC 403, 500, network) drives the identical front-end path. Probed live 2026-06-22 (CTRIB-027).
 */
const NS = 'ct027_ns';
const LIST_URL = '/master-data/lookup-tables';
const FORCED_MESSAGE = 'Forced 500 (CTRIB-027 repro)';

test.describe('F-058 / PLT-163 — a refused lookup-table delete must NOT wedge the ConfirmationDialog', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'ct027_');
  });
  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'ct027_');
  });

  test('a 500 on confirm clears the spinner, restores interactivity, and shows the error inline (dialog stays open)', async ({
    page,
    request,
  }) => {
    const name = 'ct027_wedge_target';
    await createLookupTable(request, { name, namespace_name: NS, description: 'CTRIB-027 IT-138' });

    await page.route('**/api/referencedata/table/**', async route => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: FORCED_MESSAGE }),
        });
      }
      return route.fallback();
    });

    await page.goto(LIST_URL);
    const nameCell = page.getByText(name, { exact: true }).first();
    await expect(nameCell, 'the seeded lookup table must render').toBeVisible({ timeout: 15_000 });

    // reveal the row actions (HiddenCell is excluded from the a11y tree until RowContainer:hover)
    await nameCell.hover();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Are you sure you want to delete this lookup table?')).toBeVisible();

    const failed = page.waitForResponse(
      r => r.url().includes('/api/referencedata/table/') && r.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Delete lookup table', exact: true }).click();
    await failed;

    // --- FIXED behaviour (RED on ref:main, GREEN on the fix) ---

    // 1) the dialog STAYS OPEN so the user can read the error and retry / cancel
    await expect(
      dialog.getByText('Are you sure you want to delete this lookup table?'),
      'the dialog must stay open after a failed delete',
    ).toBeVisible();

    // 2) the reason is shown INLINE, inside the dialog (on main: swallowed → never appears)
    await expect(
      dialog.getByText(FORCED_MESSAGE),
      'BUG IF ABSENT: the server reason must be surfaced inline (the .catch no longer swallows)',
    ).toBeVisible({ timeout: 10_000 });

    // 3) the loading spinner is CLEARED (on main: isLoading stuck true → bar keeps running)
    await expect(
      dialog.locator('.MuiLinearProgress-root'),
      'BUG IF VISIBLE: the spinner is stuck (isLoading never reset)',
    ).toBeHidden();

    // 4) the dialog is INTERACTIVE again — pointer-events restored (on main: stuck at none, mouse-dead)
    const pe = await page.evaluate(() => {
      const el = document.querySelector('.MuiDialog-root') as HTMLElement | null;
      return el ? getComputedStyle(el).pointerEvents : 'NOT-FOUND';
    });
    expect(pe, 'BUG IF none: the dialog must be mouse-interactive again (pointer-events restored)').toBe(
      'all',
    );

    await page.screenshot({ path: 'test-results/ctrib027-arm1-recovered.png', fullPage: false });
  });
});

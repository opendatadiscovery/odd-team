import { test, expect } from '@playwright/test';
import { seedDataSource, seedTermWithDefinition } from '../helpers/db';

/**
 * IT-141 — a refused destructive confirm on a redux-THUNK consumer must NOT close-as-success / navigate
 * away as if it succeeded (#1766 ARM-2 / PLT-233 + PLT-234 / CTRIB-031).
 *
 * Protocol: integration-tests/protocols/IT-141-confirmation-dialog-thunk-arm.md
 * Gates: validates F-031 (data source management — a thunk ConfirmationDialog consumer) ·
 *        regresses PLT-233 (thunk-arm silent close-as-success) + PLT-234 (term-delete navigate-away).
 *
 * The sibling IT-138 covers the mutateAsync arm (the #1797 stuck-spinner). THIS covers the OTHER arm:
 * the ~13 consumers that pass a bare `dispatch(thunk(...))` to ConfirmationDialog.onConfirm. A
 * redux-toolkit dispatch promise RESOLVES even on a rejected action, so on a refused delete the dialog
 * closed exactly as on success — and for a term it navigated to term-search as if the term were deleted.
 * The fix appends `.unwrap()` (rejects on the rejected action) so the dialog's `.catch` keeps it open
 * and the term's `.then(navigate)` only runs on success.
 *
 * Asserts the FIXED behaviour → RED on `ODD_SUT=ref:main` (closes / navigates away), GREEN on the
 * working-tree fix. The failure is forced via route-interception (deterministic); any real refusal
 * (cascade-block, RBAC 403, 500, network) drives the identical front-end path.
 *
 * NB the inline dialog message is the GENERIC 'An error occurred': `.unwrap()` throws the thunk's
 * already-parsed rejectWithValue payload (an AppError, no `.response`), so ConfirmationDialog's
 * getErrorResponse falls back to the generic text; the SPECIFIC server reason is shown in the toast
 * (from handleResponseThunk). The discriminator vs main is the dialog staying OPEN / not navigating.
 */
const FORCED = 'Forced 500 (CTRIB-031 thunk-arm repro)';
const GENERIC_INLINE = 'An error occurred';

test.describe('F-031 / PLT-233+234 — a refused redux-thunk confirm must not close-as-success / navigate-away', () => {
  test('datasource delete (thunk arm): a 500 keeps the dialog OPEN — no close-as-success; the row remains', async ({
    page,
  }) => {
    const dsId = 931766; // CTRIB-031 fixed id (DB-seeded) so the DELETE route is deterministic
    const dsName = 'ct031_ds_thunk_arm';
    await seedDataSource(dsId, dsName);

    await page.route(/\/api\/datasources\/\d+$/, async route => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: FORCED }),
        });
      }
      return route.fallback();
    });

    await page.goto('/management/datasources');
    const nameCell = page.getByText(dsName, { exact: true }).first();
    await expect(nameCell, 'the seeded datasource must render').toBeVisible({ timeout: 15_000 });

    // scope to THIS row's card (the nearest ancestor that holds the action buttons), so the Delete
    // click never lands on another seeded datasource's row. Actions are opacity:0 until row hover.
    const card = nameCell.locator('xpath=ancestor::div[.//button][1]');
    await card.hover();
    await card.getByRole('button', { name: 'Delete', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('Are you sure you want to delete this datasource?')
    ).toBeVisible();

    const failed = page.waitForResponse(
      r => /\/api\/datasources\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'
    );
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await failed;

    // --- FIXED behaviour (RED on ref:main = closes-as-success) ---

    // 1) the dialog STAYS OPEN (on main: the always-resolving dispatch closes it as if it succeeded)
    await expect(
      dialog.getByText('Are you sure you want to delete this datasource?'),
      'BUG IF GONE: the dialog must stay open after a failed delete (not close-as-success)'
    ).toBeVisible();

    // 2) the unwrapped rejection surfaces inline (generic — the specific reason is in the toast)
    await expect(
      dialog.getByText(GENERIC_INLINE),
      'BUG IF ABSENT: the rejection must reach the dialog .catch (inline error shown)'
    ).toBeVisible({ timeout: 10_000 });

    // 3) the datasource row is still present — the delete did not happen
    await expect(page.getByText(dsName, { exact: true }).first()).toBeVisible();

    await page.screenshot({ path: 'test-results/ctrib031-datasource-thunk-arm.png' });
  });

  test('term delete (thunk arm, PLT-234): a 500 does NOT navigate away — stays on the term page', async ({
    page,
  }) => {
    const termName = 'CT031TermThunkArm';
    const termId = await seedTermWithDefinition(
      termName,
      'CTRIB-031 thunk-arm navigate-gating repro'
    );

    await page.route(/\/api\/terms\/\d+$/, async route => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: FORCED }),
        });
      }
      return route.fallback();
    });

    await page.goto(`/terms/${termId}/overview`);
    await expect(
      page.getByRole('heading', { name: termName }).first(),
      'the term detail page must render'
    ).toBeVisible({ timeout: 15_000 });

    // open the kebab menu (the icon-only button right after Edit in the term header), then the Delete item
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).locator('xpath=following::button[1]').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('Are you sure you want to delete this term?')
    ).toBeVisible();

    const failed = page.waitForResponse(
      r => /\/api\/terms\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'
    );
    await dialog.getByRole('button', { name: 'Delete term', exact: true }).click();
    await failed;

    // --- FIXED behaviour (RED on ref:main = navigates to term-search as if deleted) ---

    // 1) the page must STAY on the term detail page (on main: .then(navigate) fires on the failed delete)
    await expect(
      page,
      'BUG IF CHANGED: a failed term delete must NOT navigate away (still on the term detail page)'
    ).toHaveURL(new RegExp(`/terms/${termId}(/|$)`));

    // 2) the dialog stays open with the rejection surfaced
    await expect(
      dialog.getByText('Are you sure you want to delete this term?'),
      'BUG IF GONE: the dialog must stay open after a failed term delete'
    ).toBeVisible();

    await page.screenshot({ path: 'test-results/ctrib031-term-navigate-gating.png' });
  });
});

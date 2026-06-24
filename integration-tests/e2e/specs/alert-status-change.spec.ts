import { test, expect } from '@playwright/test';
import { seedEntityAlert, ENTITY_ID } from '../helpers/db';

/**
 * IT-142 — odd-platform#1803 (CTRIB-034): an alert status change is reflected on the per-entity Alerts tab
 * WITHOUT a refresh, and both surfaces confirm before flipping the status.
 *
 * Protocol: integration-tests/protocols/IT-142-alert-status-change-reflect-confirm.md
 * Gates: validates F-014 (per-entity alert view) status-change reflection; regresses odd-platform#1803.
 *
 * RED on ODD_SUT=ref:main:
 *  - Defect 2: clicking Resolve flips the status with NO confirmation dialog (so `getByRole('dialog')` is
 *    never visible — this test's primary RED assertion).
 *  - Defect 1: on the per-entity tab the row then stays "Open"/"Resolve" until a refetch, because the thunk
 *    emits `dataEntityId` while the reducer reads `entityId`, leaving the per-entity update branch dead.
 * GREEN on the working-tree fix: the dialog gates the flip and the row reflects "Resolved" in place.
 */

const RESOLVE = { name: 'Resolve', exact: true } as const;
const REOPEN = { name: 'Reopen', exact: true } as const;
const RESOLVE_QUESTION = 'Are you sure you want to resolve this alert?';

const perEntityAlertsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/dataentities\/\d+\/alerts/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok()
  );

test.describe('F-014 / #1803 — alert status change reflects without refresh + confirms before flipping', () => {
  test('per-entity tab: Resolve confirms, then reflects "Resolved" without a refresh', async ({
    page,
  }) => {
    await seedEntityAlert();

    const alerts = perEntityAlertsFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/alerts`);
    await alerts;

    await expect(
      page.getByRole('button', RESOLVE),
      'an open alert shows a Resolve button'
    ).toBeVisible({ timeout: 10_000 });

    // Defect 2 — a confirmation dialog must appear BEFORE the flip (RED on base: the flip is immediate).
    await page.getByRole('button', RESOLVE).first().click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog,
      'a confirmation dialog must appear before the status flips'
    ).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(RESOLVE_QUESTION)).toBeVisible();

    await dialog.getByRole('button', RESOLVE).click();

    // Defect 1 — the per-entity row reflects the new status WITHOUT a refresh (the trigger flips to Reopen).
    await expect(
      page.getByRole('button', REOPEN),
      'after confirming, the row must reflect "Resolved" without a refresh (button flips to Reopen)'
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', RESOLVE)).toHaveCount(0);
  });

  test('per-entity tab: cancelling the dialog leaves the alert open (confirmation gates the flip)', async ({
    page,
  }) => {
    await seedEntityAlert();

    const alerts = perEntityAlertsFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/alerts`);
    await alerts;

    await page.getByRole('button', RESOLVE).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // dismiss without confirming
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });

    await expect(
      page.getByRole('button', RESOLVE),
      'a cancelled confirmation must leave the alert open (Resolve still offered)'
    ).toBeVisible();
    await expect(page.getByRole('button', REOPEN)).toHaveCount(0);
  });

  test('global Alerts page: Resolve confirms before flipping (Defect 2, second surface)', async ({
    page,
  }) => {
    await seedEntityAlert();

    await page.goto('/alerts');
    await expect(
      page.getByRole('button', RESOLVE).first(),
      'the global page lists the open alert with a Resolve button'
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', RESOLVE).first().click();
    await expect(
      page.getByRole('dialog'),
      'the global Alerts page must also confirm before flipping'
    ).toBeVisible({ timeout: 5_000 });
  });
});

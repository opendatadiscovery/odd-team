import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-108 — F-173 Active-tab Remove UserOwnerMapping (Management → Associations → Active -> Remove ->
 * DELETE /api/owners/mapping/{owner_id}).
 *
 * Protocol: integration-tests/protocols/IT-108-remove-user-owner-mapping.md
 * Gates: validates F-173 (UC-001 the Active tab lists an approved/live binding with a per-row Remove) ·
 *        characterization-pins F-173 UC-001 under DISABLED auth (the Remove DELETE 500s and the binding is
 *        NOT soft-deleted — PLT-148) · notes the F-173 UC-002 UI/backend permission mismatch (PLT-040).
 *
 * READ side (genuine UI assertion): the Active tab (/management/associations/active) consumes
 * GET /api/owner_association_request?status=APPROVED and renders one row per APPROVED request
 * (User name / Owner name / Role / Provider / Resolved by / Resolved at) with a per-row Remove button
 * behind a ConfirmationDialog (ActiveAssociationRequest.tsx, verified verbatim). The row IS the binding.
 *
 * WRITE side (characterization pin): Remove fires DELETE /api/owners/mapping/{owner_id} which on success
 * would soft-delete the user_owner_mapping row (deleted_at set) and cancel the APPROVED request
 * (OwnerAssociationRequestServiceImpl.deleteActiveUserOwnerMapping -> cancelAssociationByOwnerId +
 * deleteActiveUserRelation, :116-122). BUT cancelAssociationByOwnerId resolves the acting user via
 * getCurrentUser().switchIfEmpty(error) at :158-159, and under auth.type=DISABLED there is no security
 * context -> 500. No write occurs.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - DELETE /api/owners/mapping/{owner_id} -> HTTP 500 SYS001 ; the user_owner_mapping row remains live
 *    (deleted_at stays NULL). (Container log: RuntimeException "There is no current authorization" at
 *    OwnerAssociationRequestServiceImpl.java:159.)
 *
 * The binding is seeded directly (under DISABLED the create paths that would normally produce it are
 * themselves broken — PLT-148). Namespace: ids 21080-21089 only; names it108_; idempotent.
 */

const OWNER_ID = 21080;
const OWNER_NAME = 'it108_owner';
const BOUND_USER = 'it108_bound_user';

const activeFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/owner_association_request(\?|$)/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

// Seed an APPROVED owner_association_request (so the Active tab lists it) + a LIVE user_owner_mapping
// row (so the binding exists and the Remove has a target). Idempotent.
async function seedActiveBinding(): Promise<void> {
  await dbQuery(`INSERT INTO owner (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [
    OWNER_ID,
    OWNER_NAME,
  ]);
  await dbQuery(
    `DELETE FROM owner_association_request_activity
     WHERE owner_association_request_id IN (SELECT id FROM owner_association_request WHERE owner_id = $1)`,
    [OWNER_ID],
  );
  await dbQuery(`DELETE FROM owner_association_request WHERE owner_id = $1`, [OWNER_ID]);
  await dbQuery(`DELETE FROM user_owner_mapping WHERE owner_id = $1 OR oidc_username = $2`, [OWNER_ID, BOUND_USER]);

  await dbQuery(
    `INSERT INTO owner_association_request
       (username, owner_id, status, status_updated_at, status_updated_by, created_at, provider)
     VALUES ($1, $2, 'APPROVED', NOW(), 'it108_admin', NOW(), 'github')`,
    [BOUND_USER, OWNER_ID],
  );
  // the live binding (deleted_at NULL) the Remove targets — partial unique index unique_deleted_at_per_owner.
  await dbQuery(
    `INSERT INTO user_owner_mapping (owner_id, oidc_username, provider, deleted_at)
     VALUES ($1, $2, 'github', NULL)`,
    [OWNER_ID, BOUND_USER],
  );
}

test.describe('F-173 Active-tab Remove — the Active tab lists a binding; Remove is blocked under DISABLED', () => {
  test.beforeEach(async () => {
    await seedActiveBinding();
  });

  test('SUCCESS/UC-001: an approved binding renders in the Active tab with a Remove affordance', async ({ page }) => {
    const active = activeFetch(page);
    await page.goto('/management/associations/active');
    await active;

    await expect(
      page.getByText(BOUND_USER).first(),
      'the bound user must be listed in the Active tab',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(OWNER_NAME).first(),
      'the bound owner must be listed in the Active tab',
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove' }).first(),
      'the per-row Remove (unbind) affordance must be present',
    ).toBeVisible();
  });

  test('CHARACTERIZATION/UC-001 (PLT-148): removing a binding 500s under DISABLED and the binding stays live', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-148): DELETE /api/owners/mapping/{owner_id} 500s under auth.type=DISABLED because
    // deleteActiveUserOwnerMapping -> cancelAssociationByOwnerId -> getCurrentUser().switchIfEmpty(error)
    // (:158-159) has no security context. GREEN now; RED on fix.
    // NB also F-173 UC-002 (PLT-040): the UI gates Remove on OWNER_ASSOCIATION_MANAGE while the backend
    // gates this DELETE on OWNER_RELATION_MANAGE; the synthetic admin holds BOTH, so the gate mismatch is
    // not what fails here — the 500 is the auth-context defect, independent of PLT-040.
    const resp = await request.delete(`/api/owners/mapping/${OWNER_ID}`);
    expect(
      resp.status(),
      'KNOWN BUG (PLT-148): remove currently 500s under DISABLED auth — RED here means the unbind path was fixed',
    ).toBe(500);

    // ground-truth read-back: the binding is still live (deleted_at NULL).
    const live = await dbQuery<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM user_owner_mapping WHERE owner_id = $1 AND oidc_username = $2`,
      [OWNER_ID, BOUND_USER],
    );
    expect(live.length, 'the binding row must still exist').toBe(1);
    expect(live[0]?.deleted_at, 'the binding must NOT be soft-deleted by a failed Remove (deleted_at stays NULL)').toBeNull();
  });

  test('CORNER/UC-003 (PLT-148): the binding remains in the Active list after the failed Remove', async ({ page }) => {
    // Drive the failing DELETE, then re-render the Active tab from the browser: the binding must still be
    // listed (UI-observable evidence that the failed Remove did not take effect).
    await page.goto('/management/associations/active');
    await activeFetch(page);

    // fire the (failing) unbind via the same endpoint the Remove button calls.
    const del = await page.request.delete(`/api/owners/mapping/${OWNER_ID}`);
    expect(del.status(), 'KNOWN BUG (PLT-148): the unbind 500s under DISABLED').toBe(500);

    // re-load Active and confirm the row is still there.
    const active = activeFetch(page);
    await page.goto('/management/associations/active');
    await active;
    await expect(
      page.getByText(BOUND_USER).first(),
      'the binding must remain listed after a failed Remove (no effect)',
    ).toBeVisible({ timeout: 10_000 });
  });
});

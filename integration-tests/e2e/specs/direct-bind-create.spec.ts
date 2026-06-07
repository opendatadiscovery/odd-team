import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-107 — F-172 Admin Direct-Bind UserOwnerMapping Create (Management → Associations → "+ Create
 * association" -> POST /api/owners/mapping).
 *
 * Protocol: integration-tests/protocols/IT-107-direct-bind-create.md
 * Gates: validates F-172 (the "Create association" affordance renders + opens the modal form) ·
 *        characterization-pins F-172 H-001 under DISABLED auth (the direct-bind POST 500s and creates NO
 *        user_owner_mapping row — PLT-148).
 *
 * READ side (genuine UI assertion): the Associations header renders a "Create association" button behind
 * <WithPermissions permissionTo={OWNER_RELATION_MANAGE}> (OwnerAssociationsHeader.tsx:29-39, verified
 * verbatim). The synthetic admin has OWNER_RELATION_MANAGE, so the button shows; clicking it opens the
 * OwnerAssociationForm modal (title "Create association", fields: Owner / User / Provider).
 *
 * WRITE side (characterization pin): submit fires
 * POST /api/owners/mapping {ownerId, oidcUsername, provider} which on success would create a
 * user_owner_mapping row + a REQUEST_MANUALLY_APPROVED activity row
 * (OwnerAssociationRequestServiceImpl.createUserOwnerMapping -> createManualAssociationRequest ->
 * createRelation, :107-148). BUT createManualAssociationRequest resolves the acting user via
 * getCurrentUser().switchIfEmpty(error) at :134-135 (and cancelAssociationByOwnerId at :158-159), and
 * under auth.type=DISABLED there is no security context -> 500. No write occurs.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - POST /api/owners/mapping {ownerId, oidcUsername, provider} -> HTTP 500 SYS001 ; NO user_owner_mapping
 *    row, NO owner_association_request row, NO activity row. (Container log: RuntimeException
 *    "There is no current authorization" at OwnerAssociationRequestServiceImpl.java:159.)
 *  - The owner field is an existing-owner autocomplete (OwnerIdAutocomplete) — no owner can be minted from
 *    this form (F-172 H-002 positive finding; the service resolves ownerId via getOwnerDtoById, not
 *    getOrCreate).
 *
 * Driving the three autocomplete/text fields to a valid submit is brittle, and the UI swallows the 500
 * (handleCloseSubmittedForm only fires on isSuccess). We assert the affordance + modal via the real DOM,
 * then characterize the actual mutation at the API boundary it owns.
 *
 * Namespace: ids 21070-21079 only; names it107_; idempotent.
 */

const OWNER_ID = 21070;
const OWNER_NAME = 'it107_owner';
const BIND_USER = 'it107_bind_user';

test.describe('F-172 Admin direct-bind — the Create-association affordance renders; the bind is blocked under DISABLED', () => {
  test.beforeEach(async () => {
    await dbQuery(`INSERT INTO owner (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [
      OWNER_ID,
      OWNER_NAME,
    ]);
    await dbQuery(`DELETE FROM user_owner_mapping WHERE owner_id = $1 OR oidc_username = $2`, [OWNER_ID, BIND_USER]);
    await dbQuery(
      `DELETE FROM owner_association_request_activity
       WHERE owner_association_request_id IN (SELECT id FROM owner_association_request WHERE owner_id = $1)`,
      [OWNER_ID],
    );
    await dbQuery(`DELETE FROM owner_association_request WHERE owner_id = $1`, [OWNER_ID]);
  });

  test('SUCCESS/H-001: the "Create association" affordance renders and opens the create-association modal form', async ({
    page,
  }) => {
    await page.goto('/management/associations/new');

    const createBtn = page.getByRole('button', { name: 'Create association' });
    await expect(createBtn, 'the "+ Create association" header affordance must render (admin has OWNER_RELATION_MANAGE)')
      .toBeVisible({ timeout: 10_000 });

    // open the modal — its content (the form fields) is the direct-bind surface.
    await createBtn.click();
    await expect(
      page.getByText('User', { exact: true }).first(),
      'the modal exposes the User field (oidcUsername)',
    ).toBeVisible({ timeout: 10_000 });
    // the Save button gates on form validity — present in the modal.
    await expect(
      page.getByRole('button', { name: 'Save' }),
      'the create-association modal exposes a Save submit',
    ).toBeVisible();
  });

  test('CHARACTERIZATION/H-001 (PLT-148): the direct-bind POST 500s under DISABLED and creates no mapping', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-148): POST /api/owners/mapping 500s under auth.type=DISABLED because
    // createManualAssociationRequest -> getCurrentUser().switchIfEmpty(error) (:134-135) and
    // cancelAssociationByOwnerId (:158-159) have no security context. GREEN now; RED on fix.
    const resp = await request.post('/api/owners/mapping', {
      data: { ownerId: OWNER_ID, oidcUsername: BIND_USER, provider: 'github' },
    });
    expect(
      resp.status(),
      'KNOWN BUG (PLT-148): direct-bind currently 500s under DISABLED auth — RED here means the write path was fixed',
    ).toBe(500);

    // ground-truth read-back: no binding, no request, no activity.
    const mappings = await dbQuery(
      `SELECT 1 FROM user_owner_mapping WHERE owner_id = $1 AND deleted_at IS NULL`,
      [OWNER_ID],
    );
    expect(mappings.length, 'a failed direct-bind must not write a user_owner_mapping row').toBe(0);
    const reqs = await dbQuery(`SELECT 1 FROM owner_association_request WHERE owner_id = $1`, [OWNER_ID]);
    expect(reqs.length, 'a failed direct-bind must not write an owner_association_request row').toBe(0);
  });

  test('CORNER/H-002: the bind owner is selected from existing owners (no owner can be minted from this form)', async ({
    page,
  }) => {
    // F-172 H-002 positive finding: the Owner field is an OwnerIdAutocomplete (existing-owner picker),
    // and the service resolves it via getOwnerDtoById — there is no free-text owner-name -> getOrCreate
    // path here (unlike the F-075 self-request form). We assert the affordance is an autocomplete input,
    // not a free-text owner-name field that would mint. (DOM-level evidence of the no-mint design.)
    await page.goto('/management/associations/new');
    await page.getByRole('button', { name: 'Create association' }).click();
    // the owner field is a combobox (MUI Autocomplete renders role="combobox"); a mint-capable design
    // would instead be a plain text owner-NAME input. Its presence is the no-mint evidence.
    await expect(
      page.getByRole('combobox').first(),
      'the Owner field is an existing-owner autocomplete (combobox), not a free-text name input that could mint',
    ).toBeVisible({ timeout: 10_000 });
  });
});

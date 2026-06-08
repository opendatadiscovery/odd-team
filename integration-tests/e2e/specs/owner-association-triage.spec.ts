import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-106 — F-171 Operator-Facing Owner-Association Triage Workflow (Management → Associations → New).
 *
 * Protocol: integration-tests/protocols/IT-106-owner-association-triage.md
 * Gates: validates F-171 (H-001 the Pending list renders pending requests with per-row Accept/Reject) ·
 *        characterization-pins F-171 H-001/H-002 under DISABLED auth (the Approve/Reject PUT 500s and the
 *        request status does NOT change — PLT-148).
 *
 * READ side (genuine UI assertion): the New-requests tab (/management/associations/new) consumes
 * GET /api/owner_association_request?status=PENDING and renders one row per pending request
 * (User name / Owner name / Role / Provider) with Accept + Reject buttons behind ConfirmationDialogs
 * (NewAssociationRequest.tsx, verified verbatim).
 *
 * WRITE side (characterization pin): Accept fires
 * PUT /api/owner_association_request/{id} {status:APPROVED} which on success would flip the row to
 * APPROVED and create a user_owner_mapping (OwnerAssociationRequestServiceImpl.updateOwnerAssociationRequest
 * -> createMappingForApprovedRequest, :90-105,184-190). But the service first resolves the acting user via
 * getCurrentUser().switchIfEmpty(error) at :92-93, and under auth.type=DISABLED there is no security
 * context -> RuntimeException("There is no current authorization") -> HTTP 500. No write occurs.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - GET  /api/owner_association_request?status=PENDING                 -> 200 (read OK)
 *  - PUT  /api/owner_association_request/{id} {status:APPROVED}         -> 500 SYS001 ; row stays PENDING,
 *    status_updated_by stays NULL, NO user_owner_mapping row created. (Container log: RuntimeException
 *    "There is no current authorization" at OwnerAssociationRequestServiceImpl.java:93.)
 *
 * The seeded PENDING row is created directly in the DB because under DISABLED the normal create path
 * (POST /api/owner_association_request, F-075) is itself broken by the same defect (PLT-148 / IT-105).
 *
 * Namespace: ids 21060-21069 only; names it106_; idempotent.
 */

const OWNER_ID = 21060;
const OWNER_NAME = 'it106_owner';
const PENDING_USER = 'it106_pending_user';

const pendingFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/owner_association_request(\?|$)/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

// Seed a single PENDING owner_association_request for OWNER_ID, returning its id. Idempotent.
async function seedPendingRequest(): Promise<number> {
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
  await dbQuery(`DELETE FROM user_owner_mapping WHERE owner_id = $1`, [OWNER_ID]);
  const row = (
    await dbQuery<{ id: string }>(
      `INSERT INTO owner_association_request (username, owner_id, status, created_at, provider)
       VALUES ($1, $2, 'PENDING', NOW(), 'github') RETURNING id`,
      [PENDING_USER, OWNER_ID],
    )
  )[0];
  return Number(row.id);
}

test.describe('F-171 Owner-Association triage — the Pending tab lists requests; Approve is blocked under DISABLED', () => {
  let requestId: number;

  test.beforeEach(async () => {
    requestId = await seedPendingRequest();
  });

  test('SUCCESS/H-001: a pending request renders in the New tab with Accept/Reject affordances', async ({
    page,
  }) => {
    const pending = pendingFetch(page);
    await page.goto('/management/associations/new');
    await pending;

    await expect(
      page.getByText(PENDING_USER).first(),
      'the pending request requester must be listed in the New tab',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(OWNER_NAME).first(),
      'the pending request target owner must be listed',
    ).toBeVisible();
    // The per-row triage affordances (the operator-USE side of the workflow).
    await expect(
      page.getByRole('button', { name: 'Accept' }).first(),
      'the per-row Accept affordance must be present',
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reject' }).first(),
      'the per-row Reject affordance must be present',
    ).toBeVisible();
  });

  test('CHARACTERIZATION/H-001 (PLT-148): approving a request 500s under DISABLED and the row stays PENDING (no mapping)', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-148): PUT /api/owner_association_request/{id} 500s under auth.type=DISABLED because
    // OwnerAssociationRequestServiceImpl.updateOwnerAssociationRequest resolves the acting user via
    // getCurrentUser().switchIfEmpty(error) (:92-93) and DISABLED auth installs no security context.
    // This pin is GREEN now and flips RED the instant the approve path starts succeeding (the fix).
    const resp = await request.put(`/api/owner_association_request/${requestId}`, {
      data: { status: 'APPROVED' },
    });
    expect(
      resp.status(),
      'KNOWN BUG (PLT-148): approve currently 500s under DISABLED auth — RED here means the write path was fixed',
    ).toBe(500);

    // ground-truth read-back: the request is untouched and NO binding was created.
    const after = await dbQuery<{ status: string; status_updated_by: string | null }>(
      `SELECT status, status_updated_by FROM owner_association_request WHERE id = $1`,
      [requestId],
    );
    expect(after[0]?.status, 'the request status must still be PENDING (the 500 wrote nothing)').toBe('PENDING');
    expect(after[0]?.status_updated_by, 'status_updated_by must still be NULL').toBeNull();
    const mappings = await dbQuery(`SELECT 1 FROM user_owner_mapping WHERE owner_id = $1 AND deleted_at IS NULL`, [
      OWNER_ID,
    ]);
    expect(mappings.length, 'no user_owner_mapping may be created by a failed approve').toBe(0);
  });

  test('CHARACTERIZATION/H-002 (PLT-148): rejecting a request 500s under DISABLED and the row stays PENDING', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-148): the DECLINE branch hits the same getCurrentUser().switchIfEmpty(error) :92-93.
    const resp = await request.put(`/api/owner_association_request/${requestId}`, {
      data: { status: 'DECLINED' },
    });
    expect(
      resp.status(),
      'KNOWN BUG (PLT-148): reject currently 500s under DISABLED auth — RED here means the write path was fixed',
    ).toBe(500);

    const after = await dbQuery<{ status: string }>(
      `SELECT status FROM owner_association_request WHERE id = $1`,
      [requestId],
    );
    expect(after[0]?.status, 'the request status must still be PENDING (the 500 wrote nothing)').toBe('PENDING');
  });
});

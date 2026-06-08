import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-109 — F-174 Owner-Association History tab (the only operator-visible audit surface in the
 * Management → Associations subtree).
 *
 * Protocol: integration-tests/protocols/IT-109-owner-association-history.md
 * Gates: validates F-174 (H-004 RESOLVED filter surfaces every non-pending event; the per-row status
 *        badge renders the resolved status verbatim).
 *
 * The History tab (/management/associations/history) consumes
 * GET /api/owner_association_request/activity?status=RESOLVED and renders one row per
 * owner_association_request_activity entry: User name / Owner name / Role / Provider / Resolved by /
 * Status / Resolved at. RESOLVED = activity.status != 'PENDING' (verified in
 * ReactiveOwnerAssociationRequestActivityRepositoryImpl.getConditions default branch:
 * STATUS.ne('PENDING')). The status badge text is APPROVED -> "Approved", DECLINED -> "Declined"
 * (RequestStatus.tsx:9-15, verified verbatim).
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - GET /api/owner_association_request/activity?status=RESOLVED -> HTTP 200; rows feed from
 *    owner_association_request_activity joined to owner_association_request + owner. An activity row
 *    with status='APPROVED' or 'DECLINED' is surfaced; a 'PENDING' one is excluded.
 *  - Schema (verified): owner_association_request(id, username, owner_id, status, status_updated_at,
 *    status_updated_by, created_at, provider); owner_association_request_activity(id,
 *    owner_association_request_id, event_type, status, created_at, status_updated_by).
 *
 * This is a pure READ surface — it does NOT call getCurrentUser, so it is unaffected by the
 * DISABLED-auth write-surface 500 (PLT-148) that breaks the sibling Accept/Reject/Remove/Create paths.
 * We seed the activity rows directly (the only honest way to populate History under DISABLED, where the
 * write paths that would normally create them are themselves broken — see PLT-148).
 *
 * Namespace: ids 21090-21099 only; names it109_; idempotent.
 */

const OWNER_APPROVED_ID = 21090;
const OWNER_DECLINED_ID = 21091;
const APPROVED_OWNER_NAME = 'it109_owner_approved';
const DECLINED_OWNER_NAME = 'it109_owner_declined';
const APPROVED_USER = 'it109_user_approved';
const DECLINED_USER = 'it109_user_declined';

const activityFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/owner_association_request\/activity(\?|$)/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

// Seed one resolved owner_association_request + its activity row, returning nothing.
// status is stored verbatim ('APPROVED' | 'DECLINED'); the activity row mirrors it so the
// RESOLVED filter (activity.status != 'PENDING') surfaces it and RequestStatus renders the badge.
async function seedResolvedActivity(
  ownerId: number,
  ownerName: string,
  username: string,
  status: 'APPROVED' | 'DECLINED',
): Promise<void> {
  await dbQuery(`INSERT INTO owner (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [
    ownerId,
    ownerName,
  ]);
  // idempotent reset of this owner's request + activity rows
  await dbQuery(
    `DELETE FROM owner_association_request_activity
     WHERE owner_association_request_id IN (SELECT id FROM owner_association_request WHERE owner_id = $1)`,
    [ownerId],
  );
  await dbQuery(`DELETE FROM owner_association_request WHERE owner_id = $1`, [ownerId]);
  const req = (
    await dbQuery<{ id: string }>(
      `INSERT INTO owner_association_request
         (username, owner_id, status, status_updated_at, status_updated_by, created_at, provider)
       VALUES ($1, $2, $3, NOW(), 'it109_resolver', NOW(), 'github') RETURNING id`,
      [username, ownerId, status],
    )
  )[0];
  await dbQuery(
    `INSERT INTO owner_association_request_activity
       (owner_association_request_id, event_type, status, created_at, status_updated_by)
     VALUES ($1, $2, $3, NOW(), 'it109_resolver')`,
    [req.id, status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_DECLINED', status],
  );
}

test.describe('F-174 Owner-Association History — resolved requests render with their status', () => {
  test.beforeEach(async () => {
    await seedResolvedActivity(OWNER_APPROVED_ID, APPROVED_OWNER_NAME, APPROVED_USER, 'APPROVED');
    await seedResolvedActivity(OWNER_DECLINED_ID, DECLINED_OWNER_NAME, DECLINED_USER, 'DECLINED');
  });

  test('SUCCESS/H-004: an approved and a declined request both appear in History with their status badge', async ({
    page,
  }) => {
    const activity = activityFetch(page);
    await page.goto('/management/associations/history');
    await activity;

    // the approved row: username + owner name + "Approved" badge all rendered
    await expect(
      page.getByText(APPROVED_USER).first(),
      'the approved request requester must be listed in History',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(APPROVED_OWNER_NAME).first(),
      'the approved request owner must be listed in History',
    ).toBeVisible();
    await expect(
      page.getByText('Approved', { exact: true }).first(),
      'the APPROVED status must render as the "Approved" badge (RequestStatus.tsx)',
    ).toBeVisible();

    // the declined row: username + owner name + "Declined" badge all rendered
    await expect(
      page.getByText(DECLINED_USER).first(),
      'the declined request requester must be listed in History',
    ).toBeVisible();
    await expect(
      page.getByText(DECLINED_OWNER_NAME).first(),
      'the declined request owner must be listed in History',
    ).toBeVisible();
    await expect(
      page.getByText('Declined', { exact: true }).first(),
      'the DECLINED status must render as the "Declined" badge (RequestStatus.tsx)',
    ).toBeVisible();
  });

  test('CORNER/H-005: the free-text search filters History to the matching requester (server-side)', async ({
    page,
  }) => {
    // The header "Search requests" box drives query -> activity endpoint; the repo matches
    // USERNAME.containsIgnoreCase OR OWNER.NAME.containsIgnoreCase
    // (ReactiveOwnerAssociationRequestActivityRepositoryImpl.getConditions).
    await page.goto('/management/associations/history');
    await activityFetch(page);

    const filtered = activityFetch(page);
    await page.getByPlaceholder('Search requests').fill(APPROVED_USER);
    await filtered;

    await expect(
      page.getByText(APPROVED_USER).first(),
      'the searched requester must remain listed',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(DECLINED_USER).filter({ visible: true }),
      'a non-matching requester must be filtered out of History',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

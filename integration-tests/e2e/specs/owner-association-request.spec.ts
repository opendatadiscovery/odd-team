import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-105 — F-075 User-Owner Association Request flow (POST /api/owner_association_request).
 *
 * Protocol: integration-tests/protocols/IT-105-owner-association-request.md
 * Gates: validates F-075 (H-004 the create endpoint is ungated-by-design — reachable to any caller, no
 *        SECURITY_RULES entry) · characterization-pins F-075 H-001 under DISABLED auth (the self-request
 *        POST 500s and creates NO owner_association_request row — PLT-148).
 *
 * The create endpoint POST /api/owner_association_request {name} is the write side of the user-owner
 * association. It has NO entry in SecurityConstants.SECURITY_RULES (verified — the file gates GET/PUT on
 * /api/owner_association_request but not POST), so the permission decision is in-service:
 * OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest branches on the caller's permission set
 * (DIRECT_OWNER_SYNC -> auto-approve+bind; else -> PENDING request). BUT the very first step resolves the
 * acting user via getCurrentUser().switchIfEmpty(error) at :55-56.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - POST /api/owner_association_request {name:"..."} -> HTTP 500 SYS001. NO owner_association_request row
 *    is created and NO user_owner_mapping row is created. (Container log: RuntimeException
 *    "There is no current authorization" — getCurrentUser is empty because DISABLED auth installs no
 *    security context.) So the documented two-step self-request flow is non-functional under DISABLED.
 *  - The status is a 500 (in-service failure), NOT a 403/404 — confirming the endpoint IS reachable
 *    (ungated by SECURITY_RULES, H-004); it fails deep in the service, not at the security filter.
 *  - whoami reports the synthetic admin, which HAS DIRECT_OWNER_SYNC — so on a working auth posture this
 *    POST would take the auto-approve (self-mint-then-self-bind) branch (the F-075 H-002 hazard). That
 *    branch is unreachable here because the create 500s before the permission check.
 *
 * The home-page form that would normally trigger this POST (F-142) is itself hidden under DISABLED
 * (Overview.tsx isShowOwnerAssociation predicate — see IT-110), so there is no UI path to drive the
 * mutation; the mutation is exercised at the API boundary it owns. The assignment's "shows in the Pending
 * list" outcome is unreachable under DISABLED for two independent reasons: (a) the POST 500s before any
 * row is written, and (b) even on a working posture the synthetic admin auto-approves (DIRECT_OWNER_SYNC),
 * which lands in Active, not Pending. We assert the REAL behaviour.
 *
 * Namespace: ids 21050-21059 only; names it105_; idempotent.
 */

const OWNER_ID = 21050;
const OWNER_NAME = 'it105_existing_owner';
const NEW_OWNER_NAME = 'it105_brand_new_owner';

test.describe('F-075 User-Owner Association request — create is reachable but blocked under DISABLED', () => {
  test.beforeEach(async () => {
    // an existing owner to request (the standard self-request target). Idempotent.
    await dbQuery(`INSERT INTO owner (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [
      OWNER_ID,
      OWNER_NAME,
    ]);
    // clean any prior request/mapping rows for a re-runnable assertion
    await dbQuery(
      `DELETE FROM owner_association_request_activity
       WHERE owner_association_request_id IN
         (SELECT id FROM owner_association_request WHERE username = $1 OR owner_id = $2)`,
      [`%it105%`, OWNER_ID],
    );
    await dbQuery(`DELETE FROM owner_association_request WHERE owner_id = $1`, [OWNER_ID]);
    await dbQuery(`DELETE FROM user_owner_mapping WHERE owner_id = $1`, [OWNER_ID]);
    // make sure the brand-new owner name does NOT pre-exist (corner test asserts no silent mint).
    await dbQuery(`DELETE FROM owner WHERE name = $1`, [NEW_OWNER_NAME]);
  });

  test('CHARACTERIZATION/H-001 (PLT-148): self-requesting an existing owner 500s under DISABLED and writes no request row', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-148): POST /api/owner_association_request 500s under auth.type=DISABLED because
    // OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest calls
    // getCurrentUser().switchIfEmpty(error) (:55-56) and DISABLED auth installs no security context.
    // GREEN now; flips RED the moment the create path starts succeeding (the fix).
    const resp = await request.post('/api/owner_association_request', {
      data: { name: OWNER_NAME },
    });
    expect(
      resp.status(),
      'KNOWN BUG (PLT-148): create currently 500s under DISABLED auth — RED here means the write path was fixed',
    ).toBe(500);

    // ground-truth read-back: nothing was written for this owner.
    const reqs = await dbQuery(`SELECT 1 FROM owner_association_request WHERE owner_id = $1`, [OWNER_ID]);
    expect(reqs.length, 'a failed create must not write an owner_association_request row').toBe(0);
    const mappings = await dbQuery(`SELECT 1 FROM user_owner_mapping WHERE owner_id = $1 AND deleted_at IS NULL`, [
      OWNER_ID,
    ]);
    expect(mappings.length, 'a failed create must not write a user_owner_mapping row').toBe(0);
  });

  test('CORNER/H-004: the create endpoint is reachable (ungated by SECURITY_RULES) — it fails in-service (500), not at the filter (403/404)', async ({
    request,
  }) => {
    // F-075 H-004: POST /api/owner_association_request has no SECURITY_RULES entry, so any caller reaches
    // the controller. The distinguishing evidence is the FAILURE MODE: a 500 (deep-in-service) rather than
    // a 403 (blocked at the security filter) or 404 (no route). This pins the ungated-by-design posture.
    const resp = await request.post('/api/owner_association_request', {
      data: { name: OWNER_NAME },
    });
    expect(resp.status(), 'the endpoint must be routed (not 404)').not.toBe(404);
    expect(resp.status(), 'the endpoint must be ungated at the filter (not 403)').not.toBe(403);
    expect(resp.status(), 'it reaches the service and fails there (500) under DISABLED — H-004 + PLT-148').toBe(500);
  });

  test('CORNER/H-005 (PLT-148): a never-seen owner name is NOT silently minted when the create 500s', async ({
    request,
  }) => {
    // F-075 H-005: getOrCreate would mint a brand-new Owner for an unseen name. Under DISABLED the create
    // 500s at getCurrentUser BEFORE getOrCreate is committed (the whole method is @ReactiveTransactional),
    // so the directory must NOT accrete a new owner row. (On a working posture this is exactly the
    // self-mint hazard the feature-flow flags; here we pin that a FAILED create leaves no residue.)
    const resp = await request.post('/api/owner_association_request', {
      data: { name: NEW_OWNER_NAME },
    });
    expect(resp.status(), 'KNOWN BUG (PLT-148): create 500s under DISABLED').toBe(500);

    const minted = await dbQuery(`SELECT 1 FROM owner WHERE name = $1`, [NEW_OWNER_NAME]);
    expect(minted.length, 'a failed self-request must not mint a brand-new owner directory row').toBe(0);
  });
});

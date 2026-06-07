import { test, expect } from '@playwright/test';

/**
 * IT-110 — F-142 User-Owner Association Request Workflow (the home-page user-binding entry point).
 *
 * Protocol: integration-tests/protocols/IT-110-user-owner-association-home.md
 * Gates: validates F-142 (UC-011 — the home-page association affordance is gated by the auth posture);
 *        characterizes the DISABLED-auth posture for the current (synthetic admin, unbound) user.
 *
 * The home page (Overview.tsx) renders the OwnerAssociation card ONLY when
 *   isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')
 * (Overview.tsx:25-27, verified verbatim). The card itself is the 4-branch state machine
 * (form / pending / declined / approved) in OwnerAssociation.tsx.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080, auth.type=DISABLED):
 *  - The stack runs auth.type=DISABLED, so isShowOwnerAssociation is false -> the OwnerAssociation card
 *    is NOT rendered on the home page.
 *  - Additionally GET /api/info returns HTTP 500 (SYS001) on this stack, so `appInfo` is undefined and
 *    the predicate is false on that count too. EITHER way the card is hidden. (The /api/info 500 is a
 *    separate platform defect; here it merely reinforces the hidden-affordance characterization.)
 *  - whoami returns the synthetic `admin` (dummyOwner fallback) — an UNBOUND user (no user_owner_mapping),
 *    which under a NON-DISABLED posture would be the exact state that shows the request form. Under
 *    DISABLED that form is unreachable from the home page.
 *
 * Operator consequence (why this is worth pinning): under the DISABLED posture an unbound user has NO
 * home-page self-service path to request owner association — the affordance the docs describe as living
 * "at the bottom of the main page" is simply absent. (And even if the predicate were satisfied, the
 * underlying POST /api/owner_association_request 500s under DISABLED — see PLT-148 / IT-105.) The
 * binding can only be created by an admin via Management → Associations under a provider-backed auth mode.
 *
 * A RED here means the home affordance started rendering under DISABLED (a deliberate behaviour change
 * worth reconciling against the predicate + PLT-148).
 *
 * No DB seeds — the synthetic admin is already unbound on a fresh stack. ids 21100-21109 reserved (unused).
 */

test.describe('F-142 User-Owner Association home — the affordance under the DISABLED auth posture', () => {
  test('SUCCESS/UC-011: the home page renders but the owner-association request card is NOT shown (auth.type=DISABLED)', async ({
    page,
  }) => {
    await page.goto('/');

    // positive anchor: the Overview home page itself renders (the catalog main search is always present).
    await expect(
      page.getByPlaceholder('Search', { exact: false }).first(),
      'the Overview home page must render (main search present)',
    ).toBeVisible({ timeout: 15_000 });

    // characterization: the OwnerAssociation state-machine card is hidden under DISABLED.
    // Its three reachable text surfaces (form CTA / pending screen / declined banner) must all be absent.
    await expect(
      page.getByText('Request is being checked').filter({ visible: true }),
      'the PENDING waiting screen must not render under DISABLED',
    ).toHaveCount(0);
    await expect(
      page.getByText('association request rejected').filter({ visible: true }),
      'the DECLINED banner must not render under DISABLED',
    ).toHaveCount(0);
    // The request form (Overview-side OwnerAssociationForm) carries a "Send a request" / "Associate"
    // submit affordance; neither should be present on the home page under DISABLED.
    await expect(
      page.getByRole('button', { name: /send a request/i }).filter({ visible: true }),
      'the home-page association request submit button must not render under DISABLED',
    ).toHaveCount(0);
  });

  test('CORNER: the current user is unbound (no user_owner_mapping) — the precondition that would otherwise show the form', async ({
    request,
  }) => {
    // whoami is the synthetic admin; an unbound user is exactly the F-142 branch-1 precondition. We assert
    // the precondition holds (so the hidden-affordance result above is genuinely "hidden-despite-eligible",
    // not "not-shown-because-already-bound"). whoami's associatedOwner is null/absent for an unbound user.
    const resp = await request.get('/api/identity/whoami');
    expect(resp.status(), 'whoami returns 200 (dummyOwner fallback under DISABLED)').toBe(200);
    const body = (await resp.json()) as { identity?: { username?: string }; owner?: unknown };
    expect(body.identity?.username, 'the synthetic identity is admin').toBe('admin');
    // `owner` (the associated owner) is absent/null for an unbound user — the eligible-but-hidden state.
    expect(body.owner ?? null, 'the synthetic admin has no associated owner (unbound)').toBeNull();
  });
});

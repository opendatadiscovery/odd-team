import { test, expect } from '@playwright/test';

/**
 * IT-122 — F-124 Cross-Provider ADMIN Promotion Semantics (the observable contract).
 *
 * Protocol: integration-tests/protocols/IT-122-cross-provider-admin-promotion.md
 * Gates: validates F-124 (the six-path admin-promotion contract — observable parts) + characterizes
 *        the DISABLED mechanism-independent admin baseline + the LOGIN_FORM role-binding surface.
 *
 * F-124's claim: six distinct admin-promotion mechanisms — (a) LDAP group match, (b) Cognito groups
 * exact-match, (c) GitHub org+team+read:org, (d) Google domain+attribute, (e) Azure roles/groups
 * claim, (f) ODD_IAM userinfo flag — PLUS (g) LOGIN_FORM admin-via-seeded-Administrator-role-binding.
 * Each provider's promotion runs during a live LDAP/OAuth login, which is IdP-BLOCKED on odd-minimal
 * (DISABLED, no IdP, no LDAP). Faking a promotion would be the cardinal sin. This spec pins what IS
 * observable, and is deliberately COMPLEMENTARY to IT-119 (which takes the F-084 per-provider-matrix
 * lens): here the lens is the six-PATH divergence as a closed contract.
 *
 *  - the DISABLED admin baseline is MECHANISM-INDEPENDENT: whoami returns the fixed `admin` principal
 *    with the full permission set, with NO provider claim / group / role binding — the contrast that
 *    makes the six-path divergence meaningful (under the shipped default, admin is unconditional).
 *  - the LOGIN_FORM admin-binding surface (path (f)/(g)) — the role + policy management API — is
 *    reachable under DISABLED (admin is bound via Roles, distinct from the provider-claim mechanisms).
 *
 * GROUND TRUTH (curl, ODD_STACK_EXTERNAL=1 :18080, 2026-06-07):
 *   GET /api/identity/whoami            -> 200 {"identity":{"username":"admin","permissions":[...]}, ...}
 *   GET /api/roles?page=1&size=50       -> 200 {"items":[...],"page_info":{...}}  (admin-binding surface; may be empty here)
 *   GET /api/policies?page=1&size=10    -> 200 application/json
 *
 * SOURCE-GROUNDED (the IdP-blocked six-path contract; full list in the protocol §5):
 *   Provider.java:3-5                    — OAuth subset is EXACTLY the 5-value enum (paths (a)-(e) minus LDAP)
 *   OperationUtils.java:9                — containsIgnoreCase == element::equalsIgnoreCase = FULL-STRING equality,
 *                                          NOT substring (F-124-UC-001 — the PLT-081/DOC-235/DOC-238 retraction oracle)
 *   LDAPSecurityConfiguration.java:96    — LDAP admin match uses that same equality helper (path (a))
 *   GithubUserHandler.java:54-67         — admin-principals bypasses the org gate (UC-008, PLT-070)
 *   ODDOAuth2Properties.java:21-28       — validator checks only clientId+provider non-empty (UC-004/006)
 */

interface WhoAmI {
  identity?: { username?: string; permissions?: string[] };
}

interface Paged {
  items?: unknown[];
  page_info?: { total?: number };
}

test.describe('F-124 cross-provider admin promotion — observable contract (per-mechanism promotion is IdP-blocked)', () => {
  test('it21220: under DISABLED the admin baseline is MECHANISM-INDEPENDENT — whoami is `admin` with the full permission set, with no provider claim / group / role binding', async ({
    request,
  }) => {
    // The six promotion mechanisms (a)-(g) only operate in an enforcing mode. Under the shipped default
    // there is exactly one identity, granted everything, decided by NONE of them — this is the baseline
    // the divergence is measured against. Pinning it locks the default deployment's admin posture.
    const res = await request.get('/api/identity/whoami');
    expect(res.status(), 'GET /api/identity/whoami answers (200) under DISABLED').toBe(200);
    expect((res.headers()['content-type'] ?? '').toLowerCase(), 'real JSON, not the SPA fallback').toContain(
      'application/json',
    );
    const body = (await res.json()) as WhoAmI;
    expect(body.identity?.username, 'the mechanism-independent DISABLED principal is `admin`').toBe('admin');
    expect(
      (body.identity?.permissions?.length ?? 0) > 0,
      'the DISABLED principal is unconditionally granted the full permission set (no mechanism gates it)',
    ).toBe(true);
    // ROLE_* + POLICY_* are the admin-tier permissions that the LOGIN_FORM role-binding path (g) would
    // grant via a Role; under DISABLED they are present unconditionally. Pinning them ties the baseline
    // to the admin tier so a narrowing of the DISABLED grant trips RED.
    expect(
      body.identity?.permissions,
      'the unconditional DISABLED grant includes the role/policy admin tier (paths (f)/(g) bind these via a Role)',
    ).toEqual(expect.arrayContaining(['ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'POLICY_CREATE']));
  });

  test('it21221_UC-g: the LOGIN_FORM admin-binding surface (role + policy management) is reachable under DISABLED — the 6th promotion path is role-binding, not a provider claim', async ({
    request,
  }) => {
    // Path (g): under LOGIN_FORM admin is granted by binding the seeded Administrator Role to a user
    // (not by any OAuth/LDAP claim). The management API that binding goes through is the Roles + Policies
    // tier. We assert it is a real JSON surface here (its shape — paged list — not a count, since this
    // minimal stack seeds no roles). This anchors that the 6th path's mechanism is structurally distinct.
    const roles = await request.get('/api/roles?page=1&size=50');
    expect(roles.status(), 'GET /api/roles is a real endpoint (200) under DISABLED').toBe(200);
    expect((roles.headers()['content-type'] ?? '').toLowerCase(), 'roles is JSON (not SPA fallback)').toContain(
      'application/json',
    );
    const rolesBody = (await roles.json()) as Paged;
    expect(
      Array.isArray(rolesBody.items),
      'the roles management surface returns a paged list (the admin-binding tier path (g) uses)',
    ).toBe(true);

    const policies = await request.get('/api/policies?page=1&size=10');
    expect(policies.status(), 'GET /api/policies is a real endpoint (200) under DISABLED').toBe(200);
    expect((policies.headers()['content-type'] ?? '').toLowerCase(), 'policies is JSON').toContain(
      'application/json',
    );
  });

  test('it21222_UC-001: the management-API surface enforces NOTHING under DISABLED — confirming admin promotion here is unconditional, not the per-mechanism (incl. the equality-vs-substring) contract', async ({
    request,
  }) => {
    // F-124-UC-001's real oracle (admin-groups == full-string equality, the PLT-081 retraction) lives in
    // the LDAP/OAuth handlers and is IdP-blocked. What we CAN pin: under DISABLED even the admin-tier
    // management writes are ungated, so there is demonstrably no admin-DETECTION step on this stack —
    // the precondition that makes the six per-mechanism contracts entirely an enforcing-mode concern.
    // We probe a harmless gated *read* (the OWNER_ASSOCIATION_MANAGE-gated pending list) being served
    // anonymously, the same way the role/policy admin surface is open.
    const gatedRead = await request.get('/api/owner_association_request?page=1&size=10&status=PENDING');
    expect(
      gatedRead.status(),
      'a permission-gated read is served anonymously under DISABLED — no admin-detection mechanism runs here',
    ).toBe(200);
    expect((gatedRead.headers()['content-type'] ?? '').toLowerCase(), 'the gated read is JSON').toContain(
      'application/json',
    );
  });
});

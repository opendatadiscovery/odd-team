import { test, expect } from '@playwright/test';
import { upLdapStack, downLdapStack, LDAP_BASE_URL, LDAP_USER } from '../helpers/ldap-stack';

/**
 * IT-010 — LDAP RBAC enforcement: a non-admin USER is denied a gated admin mutation.
 *
 * Protocol: integration-tests/protocols/IT-010-ldap-rbac-enforcement.md
 * Gates: enforces ADR-0002 (centralised path-matcher authz) + ADR-0003 (read-collaborative).
 *
 * The invariant: under an enforcing auth mode, the AuthorizationCustomizer applies
 * SECURITY_RULES (path+method → permission), and a principal without the required
 * permission is denied (403). This is the load-bearing authz backbone — and LDAP is the
 * ONLY mode that exercises it locally: DISABLED is open; LOGIN_FORM grants every
 * credential ADMIN and leaves the AuthorizationCustomizer UNwired (rules inert). There is
 * NO ADMIN bypass (ReactiveNonContextPermissionAuthorizationManager resolves permissions
 * from policies), so a freshly-authenticated USER with no policies is denied every gated
 * mutation.
 *
 * What it proves: log in as a non-admin LDAP user (alice; no admin-groups → USER role),
 * then attempt OWNER_DELETE → 403. A 404 would mean authz was BYPASSED (the request
 * reached the controller and the owner simply didn't exist) — the inert-rules behaviour
 * LOGIN_FORM exhibits. 403 vs 404 is exactly the enforcement signal.
 *
 * EXPECTED RESULT: GREEN. A RED here means SECURITY_RULES stopped enforcing under LDAP
 * (a real ADR-0002 regression) or LDAP auth broke.
 *
 * Self-contained: brings up its own OpenLDAP + LDAP-mode platform stack (:18083).
 */
test.describe('IT-010 LDAP RBAC enforcement — a non-admin USER is denied a gated admin mutation', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000); // openldap + seed + platform (start_period ~30s)
    await upLdapStack();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downLdapStack();
  });

  test('an authenticated non-admin USER is denied OWNER_DELETE (403) — SECURITY_RULES enforce under LDAP (ADR-0002/0003)', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // ---- log in via LDAP form-login (the SESSION cookie persists in this request context) ----
    const login = await request.post(`${LDAP_BASE_URL}/login`, {
      form: { username: LDAP_USER.username, password: LDAP_USER.password },
      maxRedirects: 0,
    });
    const loc = login.headers()['location'] ?? '';
    expect(login.status(), `LDAP login should 302 (got ${login.status()})`).toBe(302);
    expect(
      loc,
      `LDAP login as ${LDAP_USER.username} must SUCCEED (Location → '/', not /login?error). Got ` +
        `'${loc}'. A /login?error means the LDAP bind failed — check the relative dn-pattern ` +
        `(cn={0},ou=users, relative to base) and the seeded credentials.`,
    ).not.toContain('error');

    // ---- the authenticated USER (no policies → no OWNER_DELETE) attempts an admin mutation ----
    const del = await request.delete(`${LDAP_BASE_URL}/api/owners/999999`, { maxRedirects: 0 });
    expect(
      del.status(),
      `Under LDAP, a non-admin USER must be DENIED OWNER_DELETE with 403 — the AuthorizationCustomizer ` +
        `applies SECURITY_RULES and the USER has no OWNER_DELETE permission (no ADMIN bypass). ` +
        `Got ${del.status()}. 404 = authz BYPASSED (request reached the controller; the inert-rules ` +
        `behaviour LOGIN_FORM has). 302/401 = the login didn't establish a session. ADR-0002/0003.`,
    ).toBe(403);
  });
});

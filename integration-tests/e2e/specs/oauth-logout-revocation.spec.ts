import { test, expect } from '@playwright/test';

/**
 * IT-120 — F-086 OAuth Logout Token-Revocation Semantics (the observable contract).
 *
 * Protocol: integration-tests/protocols/IT-120-oauth-logout-revocation.md
 * Gates: validates F-086 (logout-endpoint behaviour observable without an IdP) + characterizes
 *        the DISABLED-mode logout posture.
 *
 * F-086's claim — Google/GitHub REVOKE the IdP token at logout while Azure/Cognito/ODD_IAM only
 * clear the local session — happens inside the per-provider *LogoutSuccessHandler.handle() chain,
 * which is wired ONLY under auth.type=OAUTH2 (OAuthLogoutSuccessHandler is
 * @ConditionalOnProperty(havingValue="OAUTH2")). On odd-minimal (auth.type=DISABLED, no IdP) that
 * chain is NOT instantiated, so the per-provider revocation behaviour is IdP-BLOCKED. Faking a
 * provider logout would be the cardinal sin. This spec pins what IS observable: the logout-ENDPOINT
 * contract under DISABLED.
 *
 * GROUND TRUTH (curl, ODD_STACK_EXTERNAL=1 :18080, 2026-06-07):
 *   GET  /logout                         -> 200 text/html (SPA index — no GET-logout route under DISABLED)
 *   POST /logout                         -> 302  Location: /login?logout   (Spring Security DEFAULT logout)
 *   POST /logout (with attacker params)  -> 302  Location: /login?logout   (params ignored; see IT-121)
 *
 * SOURCE-GROUNDED (the IdP-blocked revocation contract; full list in the protocol §5):
 *   OAuthLogoutSuccessHandler.java:16          — @ConditionalOnProperty havingValue="OAUTH2" (absent under DISABLED)
 *   GoogleLogoutSuccessHandler.java:43-56      — POST oauth2.googleapis.com/revoke (CONFIRMED revoke, UC-01)
 *   GithubLogoutSuccessHandler.java:51-65      — DELETE /applications/{client_id}/grant (CONFIRMED revoke, UC-01)
 *   CognitoLogoutSuccessHandler.java:33-50     — NO /oauth2/revoke call (CONTRADICTED, UC-02, PLT-073);
 *                                                empty logout-uri returns Mono.empty BEFORE invalidate (UC-04)
 *   AzureLogoutSuccessHandler.java:30-47       — end-session redirect + session invalidate, no revoke (UC-03);
 *                                                URI.create(null) NPE on null logout-uri (UC-05, PLT-130)
 *   ODDIAMLogoutSuccessHandler.java:30-46      — session-only, no revoke
 */

test.describe('F-086 OAuth logout token-revocation — observable endpoint contract (per-provider revoke is IdP-blocked)', () => {
  test('it21200_UC-10: GET /logout under DISABLED is the inert SPA fallback (no GET-logout route is configured)', async ({
    request,
  }) => {
    // DisabledAuthSecurityConfiguration wires no .logout(); a GET /logout therefore hits the SPA
    // catch-all (index.html, 200). This pins that the logout BUTTON's GET target is not a server route
    // here — the actual session-termination is the POST below (F-086-UC-10: a coherent outcome, not a 500).
    const res = await request.get('/logout', { maxRedirects: 0 });
    expect(res.status(), 'GET /logout is the SPA fallback (200) under DISABLED — no GET-logout server route').toBe(
      200,
    );
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'the GET /logout body is the SPA index.html (text/html), not a controller/redirect',
    ).toContain('text/html');
  });

  test('it21201_UC-04: POST /logout under DISABLED is Spring Security default logout — 302 to /login?logout (session-invalidating; NO external IdP revocation)', async ({
    request,
  }) => {
    // Even under DISABLED, ServerHttpSecurity wires a default logout on POST /logout: it invalidates
    // the WebSession and redirects to /login?logout. Crucially the per-provider OAuth revocation
    // handlers are NOT in the chain (their dispatcher bean is @ConditionalOnProperty=OAUTH2), so the
    // ONLY effect is the local default logout — the observable form of "logout always at least clears
    // the local session" (F-086-UC-04's promise, here satisfied by the default chain).
    const res = await request.post('/logout', { maxRedirects: 0 });
    expect(
      res.status(),
      'POST /logout is a 302 (Spring default logout) under DISABLED — a live, session-invalidating endpoint',
    ).toBe(302);

    const location = res.headers()['location'] ?? '';
    expect(
      location,
      'the default-logout redirect target is the FIXED /login?logout — NOT an external IdP end-session URL ' +
        '(no per-provider revocation handler runs under DISABLED)',
    ).toBe('/login?logout');
  });

  test('it21202: POST /logout does not redirect to any EXTERNAL host under DISABLED (no provider end-session URL is emitted)', async ({
    request,
  }) => {
    // Corner pin: the redirect must be a server-relative path, never an absolute external URL. Under
    // OAUTH2 the per-provider handler would emit an absolute IdP end-session Location; here it must not.
    // This locks the boundary so a future change that accidentally wires an OAuth logout handler into
    // the DISABLED chain (leaking an external redirect) trips RED.
    const res = await request.post('/logout', { maxRedirects: 0 });
    expect(res.status(), 'precondition: POST /logout is a 302').toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(
      /^https?:\/\//i.test(location),
      `the DISABLED logout redirect must be server-relative, not an absolute external URL (got "${location}")`,
    ).toBe(false);
  });
});

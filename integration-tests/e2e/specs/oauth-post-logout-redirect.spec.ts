import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-121 — F-089 Post-Logout Redirect Provenance (the observable contract). SECURITY-class.
 *
 * Protocol: integration-tests/protocols/IT-121-oauth-post-logout-redirect.md
 * Gates: validates F-089 (the SAFE-DEFAULT half observable without an IdP) + characterizes the
 *        DISABLED logout redirect's resistance to attacker-controlled inputs.
 *
 * F-089's claim: under OAUTH2 the five *LogoutSuccessHandlers derive the IdP post_logout_redirect_uri
 * from UriUtils.getBaseUri(inbound request URI) — i.e. from the Host header — with NO platform.base-url
 * allowlist, enabling an open-redirect behind a proxy that trusts X-Forwarded-Host. That handler chain
 * is wired ONLY under auth.type=OAUTH2, so on odd-minimal (DISABLED, no IdP) the open-redirect is
 * structurally UNREACHABLE — IdP-BLOCKED. (Responsible disclosure: the mechanism is documented from
 * source in the protocol §5; no exploit recipe; no live exploitation is performed.)
 *
 * What IS observable — and is F-089-UC-3's safe-default promise — is that the redirect which DOES run
 * under DISABLED (Spring Security's default logout) IGNORES attacker-controlled inputs: it always
 * redirects to the fixed, server-relative /login?logout, reflecting neither a post_logout_redirect_uri
 * query param nor an X-Forwarded-Host header.
 *
 * GROUND TRUTH (curl, ODD_STACK_EXTERNAL=1 :18080, 2026-06-07):
 *   POST /logout                                                  -> 302 Location: /login?logout
 *   POST /logout?post_logout_redirect_uri=https://evil.example.com/ -> 302 Location: /login?logout
 *   POST /logout  -H 'X-Forwarded-Host: evil.example.com'         -> 302 Location: /login?logout
 *   POST /logout  -H 'X-Forwarded-Host: evil.example.com' -H 'X-Forwarded-Proto: https' -> 302 Location: /login?logout
 *
 * SOURCE-GROUNDED (the IdP-blocked open-redirect contract; full list in the protocol §5):
 *   UriUtils.java:11-23                  — getBaseUri: scheme+host from the request, strips path/query (no allowlist)
 *   Azure/Cognito/Google/Github/ODDIAM LogoutSuccessHandler — post_logout_redirect_uri = UriUtils.getBaseUri(requestUri)
 *   application.yml:209                  — platform-base-url shipped COMMENTED OUT (no active allowlist to cross-check Host)
 *   OAuthLogoutSuccessHandler.java:16    — @ConditionalOnProperty=OAUTH2 (the whole chain absent under DISABLED)
 */

const EVIL_HOST = 'evil.example.com';

// All assertions reduce to: the Location must be exactly /login?logout and must never contain the
// attacker host. We centralise so each variant pins the same safe-default invariant.
async function postLogoutLocation(
  request: APIRequestContext,
  opts: { query?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; location: string }> {
  const res = await request.post(`/logout${opts.query ?? ''}`, {
    headers: opts.headers,
    maxRedirects: 0,
  });
  return { status: res.status(), location: res.headers()['location'] ?? '' };
}

test.describe('F-089 post-logout redirect provenance — DISABLED safe default (OAUTH2 Host-derived open-redirect is IdP-blocked)', () => {
  test('it21210_UC-3: the baseline DISABLED logout redirect is the fixed server-relative /login?logout', async ({
    request,
  }) => {
    const { status, location } = await postLogoutLocation(request);
    expect(status, 'POST /logout is a 302 (default logout) under DISABLED').toBe(302);
    expect(location, 'the safe-default redirect target is the fixed /login?logout').toBe('/login?logout');
  });

  test('it21211_UC-2: an attacker-supplied post_logout_redirect_uri query param is IGNORED (no open-redirect on the default posture)', async ({
    request,
  }) => {
    // F-089-UC-2 (the open-redirect promise). Under DISABLED the default logout does not honour a
    // post_logout_redirect_uri at all — the attacker host must never appear in the Location. The
    // OAUTH2 Host-derived variant (where this promise is CONTRADICTED behind a Host-trusting proxy)
    // is IdP-blocked and tracked PLT-075.
    const { status, location } = await postLogoutLocation(request, {
      query: `?post_logout_redirect_uri=https://${EVIL_HOST}/`,
    });
    expect(status, 'POST /logout with an attacker redirect param still 302s (does not error)').toBe(302);
    expect(location, 'the attacker redirect param is ignored — target stays /login?logout').toBe('/login?logout');
    expect(
      location.includes(EVIL_HOST),
      `the attacker host must NOT appear in the redirect Location (got "${location}")`,
    ).toBe(false);
  });

  test('it21212_UC-2: an X-Forwarded-Host header is NOT reflected into the redirect (forward-headers-strategy defaults to none)', async ({
    request,
  }) => {
    // The crux of the open-redirect: under OAUTH2 + a Host-trusting proxy, UriUtils.getBaseUri would
    // emit the forwarded host. Under DISABLED with the default forward-headers-strategy=none, the
    // forwarded Host is not trusted AND the default-logout target is a fixed relative path — so the
    // host is not reflected. We test both with and without X-Forwarded-Proto to be thorough.
    const noProto = await postLogoutLocation(request, { headers: { 'X-Forwarded-Host': EVIL_HOST } });
    expect(noProto.status, 'POST /logout with X-Forwarded-Host still 302s').toBe(302);
    expect(
      noProto.location.includes(EVIL_HOST),
      `X-Forwarded-Host must NOT be reflected into the logout redirect (got "${noProto.location}")`,
    ).toBe(false);
    expect(noProto.location, 'redirect target stays the fixed /login?logout').toBe('/login?logout');

    const withProto = await postLogoutLocation(request, {
      headers: { 'X-Forwarded-Host': EVIL_HOST, 'X-Forwarded-Proto': 'https' },
    });
    expect(
      withProto.location.includes(EVIL_HOST),
      `X-Forwarded-Host + X-Forwarded-Proto must NOT be reflected (got "${withProto.location}")`,
    ).toBe(false);
    expect(withProto.location, 'redirect target stays the fixed /login?logout (proto variant)').toBe('/login?logout');
  });
});

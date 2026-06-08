import { test, expect } from '@playwright/test';

/**
 * IT-112 — F-088 S2S API Key — Global Admin Grant Surface (auth.s2s.enabled).
 *
 * Protocol: integration-tests/protocols/IT-112-s2s-api-key-admin-grant.md
 * Gates: validates F-088 (UC-7 the DISABLED+S2S no-op posture) · regresses PLT-001 (s2s NPE reachable).
 *
 * SECURITY-class. Responsible disclosure: we assert the OBSERVABLE posture (status codes + a non-sensitive
 * structural marker) only. No secret is sent or dumped — the X-API-Key values used are deliberately junk;
 * the point is that ANY header value triggers the path, not any real token.
 *
 * GROUND TRUTH (read before asserting):
 *  - odd-minimal.docker-compose.yml:54 — the shared stack sets ONLY AUTH_TYPE=DISABLED. It does NOT set
 *    auth.s2s.enabled or auth.s2s.token, so s2s is at its defaults: enabled=false, token=null
 *    (S2sTokenProvider.java:10-13 @Value defaults). The full "is s2s enabled" characterization for this
 *    stack: DISABLED, s2s NOT enabled.
 *  - S2sAuthenticationFilter.java:17-19 — `@Component implements WebFilter` with NO @ConditionalOnProperty.
 *    In Spring WebFlux a WebFilter bean is auto-registered into the GLOBAL filter chain regardless of which
 *    SecurityWebFilterChain is active. DisabledAuthSecurityConfiguration never calls addFilterAt(...) — but
 *    that does not matter: the bean still runs on every request because it is a global WebFilter.
 *  - S2sAuthenticationFilter.java:26-29 — `if (!s2sTokenProvider.isValidToken(extractTokenFromRequest(...)))
 *    return chain.filter(exchange);`. So a request WITHOUT X-API-Key returns null token -> isValidToken's
 *    isBlank guard short-circuits to false -> the filter is a clean pass-through (the 200 baseline).
 *  - S2sTokenProvider.java:15-21 — isValidToken: `if (isBlank(token)) return false; return s2sToken.equals(token);`.
 *    With a PRESENT X-API-Key but s2sToken==null (unconfigured), `s2sToken.equals(token)` dereferences null
 *    -> NullPointerException -> the request fails with HTTP 500.
 *
 * OBSERVED POSTURE (verified live this build, AUTH_TYPE=DISABLED, s2s unconfigured):
 *   GET /api/identity/whoami  no header  -> 200 (synthetic admin, see IT-111)
 *   GET /api/identity/whoami  X-API-Key  -> 500   (the NPE path)
 *   GET /api/dataentities/classes no hdr -> 200
 *   GET /api/dataentities/classes X-API-Key -> 500
 *
 * KNOWN BUG (PLT-001): the existing PLT-001 draft calls this NPE "unreachable in production" / severity:low
 * because it assumes S2sAuthenticationFilter is "conditionally registered only when auth.s2s.enabled=true".
 * That assumption is FALSE — the filter is an unconditional global WebFlux WebFilter, so on the SHIPPED
 * default (AUTH_TYPE=DISABLED, s2s unset) ANY unauthenticated caller can turn ANY endpoint into a 500 by
 * adding one header. This is a trivial unauthenticated denial-of-service, not a dormant landmine. This spec
 * pins the CURRENT (buggy) behaviour per LSN-029: the 500 assertions go RED the instant the NPE is fixed
 * (the fixed filter must pass-through to 200 when s2s is unconfigured) — which is the regression signal we
 * want. See report for the PLT-001 correction.
 */

// Deliberately non-secret junk values. The bug fires on ANY present header, independent of the value.
const JUNK_KEY = 'it112-not-a-real-key';

test.describe('F-088 S2S API key under DISABLED — observable posture + PLT-001 NPE pin', () => {
  test('baseline: under DISABLED, requests WITHOUT X-API-Key are served normally (the filter is a clean pass-through)', async ({
    request,
  }) => {
    // whoami with no key -> 200 synthetic admin (the DISABLED contract; cross-check IT-111).
    const whoami = await request.get('/api/identity/whoami', { maxRedirects: 0 });
    expect(
      whoami.status(),
      'no X-API-Key -> isValidToken(null) short-circuits false -> S2sAuthenticationFilter passes through -> 200',
    ).toBe(200);
    expect(
      ((await whoami.json()) as { identity?: { username?: string } }).identity?.username,
      'baseline DISABLED identity is the synthetic "admin"',
    ).toBe('admin');

    // a static reference GET with no key -> 200 (same pass-through).
    const classes = await request.get('/api/dataentities/classes', { maxRedirects: 0 });
    expect(
      classes.status(),
      'no X-API-Key -> a normal DISABLED-permitAll 200 on a static reference endpoint',
    ).toBe(200);
  });

  test('UC-7 / PLT-001 (KNOWN BUG): with auth.s2s unconfigured, ANY X-API-Key header makes whoami 500 (s2sToken NPE)', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-001): S2sAuthenticationFilter is a global WebFilter; isValidToken dereferences the
    // null s2sToken -> NPE -> 500. The CORRECT behaviour (post-fix) is a clean pass-through to 200 (s2s is
    // not enabled here, so the key must simply be ignored). We pin the CURRENT 500 (LSN-029): RED on fix.
    const res = await request.get('/api/identity/whoami', {
      headers: { 'X-API-Key': JUNK_KEY },
      maxRedirects: 0,
    });
    expect(
      res.status(),
      'KNOWN BUG (PLT-001): X-API-Key on an s2s-unconfigured stack throws NPE in S2sTokenProvider.isValidToken ' +
        '-> 500. When fixed (defensive null guard -> pass-through), this becomes 200 and the pin goes RED — ' +
        're-ground IT-112 then. A 200 today would mean the filter is NOT auto-registered (contradicts source).',
    ).toBe(500);

    // Structural marker only (responsible disclosure): the 500 body is the platform's generic error wrapper.
    // We assert the SHAPE (an error status payload for this path), never any internals.
    const body = (await res.json()) as { status?: number; path?: string; error?: string };
    expect(
      body.status,
      'the 500 surfaces as the platform error wrapper (status:500) — a structural marker, no secret content',
    ).toBe(500);
    expect(body.path, 'the error wrapper echoes the request path').toContain('/api/identity/whoami');
  });

  test('PLT-001 blast radius: the X-API-Key 500 is NOT whoami-specific — a normal reference endpoint 500s too', async ({
    request,
  }) => {
    // The same global-filter NPE hits every endpoint. /api/dataentities/classes is 200 without a key
    // (asserted in the baseline test); WITH a key it 500s — proving the DoS is platform-wide, not endpoint-local.
    const res = await request.get('/api/dataentities/classes', {
      headers: { 'X-API-Key': JUNK_KEY },
      maxRedirects: 0,
    });
    expect(
      res.status(),
      'KNOWN BUG (PLT-001): the same s2sToken NPE fires on a plain reference endpoint -> 500. Platform-wide ' +
        'unauthenticated DoS via a single header on the shipped DISABLED default. RED when the NPE is fixed.',
    ).toBe(500);
  });
});

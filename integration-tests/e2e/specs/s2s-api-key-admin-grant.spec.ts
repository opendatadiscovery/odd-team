import { test, expect } from '@playwright/test';

/**
 * IT-112 — F-088 S2S API Key under DISABLED — observable posture + the PLT-001 fix (pass-through).
 *
 * Protocol: integration-tests/protocols/IT-112-s2s-api-key-admin-grant.md
 * Gates: validates F-088 (UC-7 the DISABLED+S2S no-op posture) · regresses PLT-001 (s2s NPE / unauthenticated DoS).
 *
 * RE-GROUNDED 2026-06-19 (CTRIB-022 / issue #1765, LSN-029). This spec used to PIN the CURRENT (buggy)
 * behaviour: any `X-API-Key` header on an s2s-unconfigured stack returned HTTP 500 (a NullPointerException in
 * `S2sTokenProvider.isValidToken`). PLT-001 is now FIXED (null-guard: an unconfigured/blank configured token
 * validates nothing), so the filter is a clean PASS-THROUGH and the request returns its normal response. Per
 * the flip protocol (retrospectives/LSN-029) the pin is re-grounded to assert the CORRECT post-fix behaviour
 * and `@pins` -> `@regresses` — it now goes RED if the NPE/DoS ever returns (e.g. on a pre-fix image:
 * `ODD_SUT=published:0.28.0` / `ref:main`).
 *
 * SECURITY-class. Responsible disclosure: we assert the OBSERVABLE posture (status codes + a non-sensitive
 * identity marker) only. The `X-API-Key` values used are deliberately junk; the point is that ANY header value
 * is now correctly IGNORED when s2s is unconfigured, not that any real token is involved.
 *
 * GROUND TRUTH (read before asserting):
 *  - odd-minimal.docker-compose.yml:54 — the shared stack sets ONLY AUTH_TYPE=DISABLED. It does NOT set
 *    auth.s2s.enabled or auth.s2s.token, so s2s is at its defaults: enabled=false, token=null
 *    (S2sTokenProvider.java:10-13 @Value defaults).
 *  - S2sAuthenticationFilter.java:26-29 — `if (!s2sTokenProvider.isValidToken(extractTokenFromRequest(...)))
 *    return chain.filter(exchange);`. The filter is a global WebFilter; on an INVALID token it passes through.
 *  - S2sTokenProvider.java:15-21 (POST-FIX) — `isValidToken`:
 *    `if (isBlank(token) || isBlank(s2sToken)) return false; return s2sToken.equals(token);`. With s2sToken
 *    null/blank (unconfigured) it returns false for ANY incoming token -> the filter passes through. No NPE.
 *
 * OBSERVED POSTURE (verified live this build, AUTH_TYPE=DISABLED, s2s unconfigured):
 *   GET /api/identity/whoami       no header  -> 200 (synthetic admin, see IT-111)
 *   GET /api/identity/whoami       X-API-Key  -> 200 (key IGNORED; identical to no header — the fix)
 *   GET /api/dataentities/classes  no header  -> 200
 *   GET /api/dataentities/classes  X-API-Key  -> 200 (key IGNORED)
 *
 * REGRESSION SIGNAL (PLT-001): if any of the X-API-Key requests returns 500 again, the NPE/DoS has regressed
 * (or the SUT is a pre-fix image). The pre-fix RED proof: run this spec on `ODD_SUT=published:0.28.0`.
 */

// Deliberately non-secret junk values. The fix means ANY present header is ignored when s2s is unconfigured.
const JUNK_KEY = 'it112-not-a-real-key';

test.describe('F-088 S2S API key under DISABLED — observable posture + PLT-001 fix (pass-through)', () => {
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

  test('UC-7 / PLT-001 (FIXED): with auth.s2s unconfigured, ANY X-API-Key header is IGNORED — whoami stays 200', async ({
    request,
  }) => {
    // PLT-001 fix: S2sTokenProvider.isValidToken returns false when s2sToken is null/blank (s2s unconfigured),
    // so the global filter passes through and the key is simply ignored — the request returns its normal
    // DISABLED response (200, synthetic admin) instead of the pre-fix 500 NPE. RED here = the NPE/DoS regressed
    // (or the SUT is a pre-fix image — the RED proof: ODD_SUT=published:0.28.0).
    const res = await request.get('/api/identity/whoami', {
      headers: { 'X-API-Key': JUNK_KEY },
      maxRedirects: 0,
    });
    expect(
      res.status(),
      'PLT-001 FIXED: X-API-Key on an s2s-unconfigured stack is ignored (null-guard -> pass-through) -> 200, ' +
        'NOT the pre-fix 500. A 500 means the s2sToken NPE has regressed.',
    ).toBe(200);
    expect(
      ((await res.json()) as { identity?: { username?: string } }).identity?.username,
      'the ignored key leaves the normal DISABLED identity (synthetic "admin") — identical to the no-header case',
    ).toBe('admin');
  });

  test('PLT-001 blast radius (FIXED): the X-API-Key 500 is gone platform-wide — a normal reference endpoint stays 200', async ({
    request,
  }) => {
    // The same global-filter path: /api/dataentities/classes is 200 without a key (baseline); WITH a junk key it
    // is now ALSO 200 (the key is ignored) — proving the unauthenticated DoS is closed platform-wide, not just on
    // whoami. RED here = the NPE/DoS regressed.
    const res = await request.get('/api/dataentities/classes', {
      headers: { 'X-API-Key': JUNK_KEY },
      maxRedirects: 0,
    });
    expect(
      res.status(),
      'PLT-001 FIXED: the s2sToken NPE no longer fires on a plain reference endpoint -> 200 (key ignored). ' +
        'A 500 means the platform-wide unauthenticated DoS has regressed.',
    ).toBe(200);
  });
});

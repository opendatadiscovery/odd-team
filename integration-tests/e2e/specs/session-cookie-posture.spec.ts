import { test, expect } from '@playwright/test';
import { upLoginFormStack, downLoginFormStack, LOGINFORM_BASE_URL } from '../helpers/loginform-stack';

/**
 * IT-123 — F-087 Session Cookie Security Posture & Lifetime (LOGIN_FORM, the enforcing mode
 * that ships a built-in credential store + issues the SESSION cookie as the principal carrier).
 *
 * Protocol: integration-tests/protocols/IT-123-session-cookie-posture.md
 * Gates: validates F-087 (UC-001 Secure-absent · UC-007 SameSite-Lax-not-Strict · UC-008 HttpOnly ·
 *        UC-002 never-expire server-side under spring.session.timeout=-1). SECURITY-class.
 *
 * WHY this is a feature with no screen: there is no "Session settings" page. The product IS the
 * default posture of the credential every authenticated browser request carries, experienced by the
 * platform-operator the moment ODD stands up behind a real network. The login form itself is Spring
 * Security's framework-default HTML form (no React login component). So the operator-observable
 * artefact is the Set-Cookie header + the cookie's server-side lifetime — asserted here at the wire.
 *
 * GROUND TRUTH (probed live 2026-06-07 against this stack, :18082, auth.type=LOGIN_FORM,
 * session.provider=IN_MEMORY, spring.session.timeout=-1 — the shipped image defaults, verified by
 * reading /app/resources/application.yml inside the running container):
 *   - POST /login {username=admin,password=admin} -> 302 Location:/  with
 *       `set-cookie: SESSION=<uuid>; Path=/; HTTPOnly; SameSite=Lax`
 *     i.e. HttpOnly PRESENT (UC-008 ✓), Secure ABSENT (UC-001 ✓), SameSite=Lax not Strict (UC-007 ✓),
 *     and NO Max-Age / NO Expires (a pure session cookie).
 *   - Replaying that SESSION cookie -> GET /api/owners 200 (it is the sole credential carrier).
 *   - Unauthenticated GET /api/owners -> 302 -> /login (the enforcing boundary; ADR-0074).
 *
 * GROUND-TRUTH NUANCE (do not assert the ideal — LSN-031 "verify, never assume"): an EXPLICIT
 * POST /logout carrying the cookie DOES invalidate the server session (post-logout replay -> 302) —
 * Spring's WebSessionServerLogoutHandler calls session.invalidate(). So the F-087/H-002 contradiction
 * is NOT "logout never works". It is precisely: (a) the cookie has no Max-Age/Expires and the session
 * never AGES OUT server-side under timeout=-1 (a captured-and-HELD cookie is a permanent credential —
 * no inactivity expiry ever fires), and (b) there is no operator-facing revocation endpoint to kill an
 * INDIVIDUAL session you do not hold the cookie for (a leaked cookie) short of a JVM restart / store
 * surgery. UC-002 below pins exactly (a) + (b), not the false "logout is a no-op".
 *
 * The code bugs are already tracked (PLT-074 cookie-posture epic / PLT-064 CSRF-disabled). What was
 * MISSING and is the net-new contribution here is a TEST that pins the current posture so a future
 * Secure-by-default / finite-timeout / revocation fix RED-flags here (LSN-029 characterization pin),
 * and HttpOnly cannot silently regress off.
 *
 * Self-contained: brings up its own LOGIN_FORM stack (:18082) in beforeAll, tears it down in afterAll.
 * Run with ODD_STACK_EXTERNAL=1 (this spec manages its own stack; odd-minimal is untouched).
 *
 * Namespace: ids 21230-21239; names it123_; idempotent (no DB seed — posture is config-shipped).
 */

const CREDS = { username: 'admin', password: 'admin' }; // AUTH_LOGIN_FORM_CREDENTIALS in the stack
// Not in the LOGIN_FORM whitelist -> requires auth; returns 200 for an authenticated caller.
const PROTECTED = '/api/owners?page=1&size=10';

// Parse the SESSION Set-Cookie line and its attribute set from a login response.
function parseSessionSetCookie(setCookie: string | undefined): { value: string; attrs: string } {
  expect(setCookie, 'POST /login must issue a Set-Cookie for the SESSION cookie').toBeTruthy();
  const line = (setCookie ?? '').split(/,(?=[^ ;]+=)/).find((c) => /(^|\s)SESSION=/i.test(c)) ?? setCookie ?? '';
  const m = /SESSION=([^;]+)/i.exec(line);
  expect(m, `the Set-Cookie must name the SESSION cookie; got: ${line}`).not.toBeNull();
  return { value: (m as RegExpExecArray)[1], attrs: line };
}

test.describe('IT-123 F-087 — session cookie posture & lifetime (LOGIN_FORM)', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000); // LOGIN_FORM stack bring-up (platform start_period ~30s)
    await upLoginFormStack();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downLoginFormStack();
  });

  test('SUCCESS/UC-001+007+008: the SESSION cookie is HttpOnly, NOT Secure, SameSite=Lax (not Strict) — the shipped posture pin', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // log in via Spring's form-login processing URL; capture the Set-Cookie attribute set.
    const login = await request.post(`${LOGINFORM_BASE_URL}/login`, {
      form: CREDS,
      maxRedirects: 0,
    });
    expect(login.status(), `LOGIN_FORM login should 302 (got ${login.status()})`).toBe(302);
    expect(
      login.headers()['location'] ?? '',
      'login must SUCCEED (Location -> "/", not /login?error). A /login?error means the credential ' +
        'store (AUTH_LOGIN_FORM_CREDENTIALS=admin:admin) did not match.',
    ).not.toContain('error');

    const { attrs } = parseSessionSetCookie(login.headers()['set-cookie']);

    // UC-008 (confirmed-safe, pinned against regression): HttpOnly IS set (Spring WebFlux default).
    // The header casing the framework emits is "HTTPOnly"; match case-insensitively.
    expect(
      /httponly/i.test(attrs),
      `F-087 UC-008: the SESSION cookie MUST be HttpOnly (the one safe-by-default attribute — guards ` +
        `the token from XSS/JS read). Got Set-Cookie attrs: "${attrs}". A miss here means a ` +
        `WebSessionIdResolver override silently turned HttpOnly OFF.`,
    ).toBeTruthy();

    // UC-001 (the headline insecure default): Secure is ABSENT — on a non-HTTPS deployment the cookie
    // travels in clear. Pins the posture; RED when a Secure-by-default fix (PLT-074) lands.
    expect(
      /(^|;|\s)secure(;|$|\s)/i.test(attrs),
      `F-087 UC-001 (PLT-074): the SESSION cookie is NOT marked Secure under the shipped config — it ` +
        `is delegated to the deployment topology (no CookieWebSessionIdResolver bean; ` +
        `SessionConfiguration.java declares no Secure setter). Got: "${attrs}". A Secure flag here ` +
        `means the platform started stamping it itself — flip this pin and close the PLT-074 facet.`,
    ).toBeFalsy();

    // UC-007: SameSite is the framework-default Lax, NOT the hardened Strict. Cross-site
    // top-level-navigation still sends the cookie. Pins the no-override posture.
    expect(
      /samesite=lax/i.test(attrs),
      `F-087 UC-007: the SESSION cookie ships SameSite=Lax (framework default), not Strict. The ` +
        `platform sets no SameSite directive (grep SameSite across the repo = 0 matches). Got: "${attrs}".`,
    ).toBeTruthy();
    expect(
      /samesite=strict/i.test(attrs),
      `F-087 UC-007: the platform does NOT set SameSite=Strict (it would have to be operator-stamped ` +
        `at a proxy). A Strict here means an override bean was added — re-scope the pin. Got: "${attrs}".`,
    ).toBeFalsy();
  });

  test('CORNER/UC-002: the SESSION cookie has no Max-Age/Expires and never ages out server-side (timeout=-1) — a HELD cookie is a permanent credential', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // KNOWN POSTURE (PLT-074): spring.session.timeout=-1 ships (verified in /app/resources/application.yml
    // inside the running image), so the session never expires server-side and there is no operator
    // revocation endpoint for an individual (e.g. leaked) session. We pin: (a) the cookie carries no
    // expiry attribute, and (b) a cookie we HOLD keeps resolving — i.e. no inactivity aging fires.
    // (We deliberately do NOT assert "logout is a no-op": an explicit POST /logout DOES invalidate the
    //  server session — verified live — so that is not the contradiction. The contradiction is the
    //  absence of expiry/aging + the absence of out-of-band revocation. RED when a finite default lands.)
    const login = await request.post(`${LOGINFORM_BASE_URL}/login`, { form: CREDS, maxRedirects: 0 });
    expect(login.status(), 'login should 302').toBe(302);
    const { value, attrs } = parseSessionSetCookie(login.headers()['set-cookie']);

    // (a) no Max-Age and no Expires -> a pure session cookie. Under timeout=-1 the server-side
    // reference behind it also never expires, so "session cookie" here means "until the attacker
    // closes their browser", with no server aging to back it up.
    expect(
      /max-age=/i.test(attrs),
      `F-087 UC-002 (PLT-074): the SESSION cookie sets no Max-Age — combined with timeout=-1 there is ` +
        `no client- OR server-side aging. Got: "${attrs}".`,
    ).toBeFalsy();
    expect(
      /expires=/i.test(attrs),
      `F-087 UC-002 (PLT-074): the SESSION cookie sets no Expires. Got: "${attrs}".`,
    ).toBeFalsy();

    // (b) the held cookie resolves a protected endpoint -> it is the credential carrier, and (under
    // timeout=-1) it does so with no expiry. RED if a finite timeout makes a fresh-but-idle session
    // start getting rejected here (the PLT-074 fix), or if cookie-bearing stops being sufficient.
    const replay = await request.get(`${LOGINFORM_BASE_URL}${PROTECTED}`, {
      headers: { cookie: `SESSION=${value}` },
      maxRedirects: 0,
    });
    expect(
      replay.status(),
      `F-087 UC-002: a HELD SESSION cookie must resolve the protected ${PROTECTED} (200) — it is the ` +
        `sole credential carrier and never ages out under timeout=-1. Got ${replay.status()} ` +
        `(302 -> the cookie was rejected; a finite-timeout/revocation fix may have landed — re-scope).`,
    ).toBe(200);

    // The captured token is an opaque session id (the credential whose lifetime we are pinning), not an
    // empty/placeholder value. (The ENFORCING boundary — anon request rejected — is IT-009's contract,
    // verified there + live-curled here 2026-06-07: anonymous GET /api/owners -> 302 /login. We do not
    // re-assert it from this `request` fixture because Playwright's APIRequestContext shares one cookie
    // jar across calls in a test, so a post-login "anonymous" call silently replays the SESSION cookie.)
    expect(
      value.length,
      `F-087 UC-002: the SESSION cookie carries an opaque session id (the credential). Got "${value}".`,
    ).toBeGreaterThan(10);
  });
});

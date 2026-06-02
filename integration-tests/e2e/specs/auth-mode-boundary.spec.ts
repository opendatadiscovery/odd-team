import { test, expect } from '@playwright/test';
import {
  upLoginFormStack,
  downLoginFormStack,
  LOGINFORM_BASE_URL,
  DISABLED_BASE_URL,
} from '../helpers/loginform-stack';

/**
 * IT-009 — auth-mode boundary (ADR-0074): the mode decides whether auth is required.
 *
 * Protocol: integration-tests/protocols/IT-009-auth-mode-boundary.md
 * Gates: enforces ADR-0074 (pluggable auth modes) · TEST-GAP-778.
 *
 * The invariant: `auth.type` selects the SecurityWebFilterChain. DISABLED does
 * `anyExchange().permitAll()` (everything open); every other mode ends the chain with
 * `.pathMatchers("/**").authenticated()`, so a non-whitelisted route requires
 * authentication. This is the foundational auth-mode contract every authz behaviour
 * sits on, and it had zero coverage.
 *
 * Why LOGIN_FORM (not OAUTH2/LDAP): it's the only enforcing mode that stands up locally
 * with no external IdP (credentials via auth.login-form-credentials). NB it proves only
 * the AUTHENTICATION boundary — LOGIN_FORM grants every credential ADMIN and does NOT
 * wire the AuthorizationCustomizer, so per-user RBAC is a separate (LDAP-backed) tier.
 *
 * EXPECTED RESULT: GREEN — DISABLED open, LOGIN_FORM closed. A RED here means the
 * auth-mode switch failed to change enforcement (a real ADR-0074 regression).
 *
 * Self-contained: brings up its own LOGIN_FORM stack (:18082); the DISABLED half is the
 * shared odd-minimal stack (:18080) from global-setup — so DON'T run this focused with
 * ODD_STACK_EXTERNAL=1 (that skips odd-minimal).
 */

// Not in the LOGIN_FORM whitelist (health/favicon/ingestion/slack) → authenticated when
// enforced; a static reference endpoint that returns 200 under DISABLED with no required
// query params (unlike /api/owners, which 500s without page/size).
const PROBE = '/api/dataentities/classes';

test.describe('IT-009 auth-mode boundary (ADR-0074) — the mode decides whether auth is required', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000); // LOGIN_FORM stack bring-up (platform start_period ~30s)
    await upLoginFormStack();
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await downLoginFormStack();
  });

  test('DISABLED leaves a protected endpoint open; LOGIN_FORM requires authentication (TEST-GAP-778)', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // ---- DISABLED (shared odd-minimal :18080) — anyExchange().permitAll() ----
    const disabled = await request.get(`${DISABLED_BASE_URL}${PROBE}`, { maxRedirects: 0 });
    expect(
      disabled.ok(),
      `ADR-0074: under DISABLED, ${PROBE} must be anonymously reachable (permitAll). Got ` +
        `${disabled.status()}. (Is the shared odd-minimal stack up? Don't run this focused ` +
        `with ODD_STACK_EXTERNAL=1 — that skips the DISABLED stack.)`,
    ).toBeTruthy();

    // ---- LOGIN_FORM (:18082) — non-DISABLED modes wire .anyExchange().authenticated() ----
    const loginForm = await request.get(`${LOGINFORM_BASE_URL}${PROBE}`, { maxRedirects: 0 });
    expect(
      loginForm.ok(),
      `ADR-0074 / TEST-GAP-778: under LOGIN_FORM, ${PROBE} must REQUIRE authentication — an ` +
        `unauthenticated request must be rejected (401, or 302→/login), not served. Got ` +
        `${loginForm.status()}. A 2xx here means the auth-mode switch failed to enforce ` +
        `authentication (the foundational ADR-0074 contract).`,
    ).toBeFalsy();
  });
});

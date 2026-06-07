import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-119 — F-084 OAuth Provider Admin-Detection Matrix (the observable contract).
 *
 * Protocol: integration-tests/protocols/IT-119-oauth-admin-detection-matrix.md
 * Gates: validates F-084 (the per-provider admin-detection contract — the part observable
 *        without an IdP) + characterizes the DISABLED-mode identity baseline.
 *
 * F-084's full claim — that `admin-attribute` / `admin-groups` / `admin-principals` /
 * `allowed-domain` / `organization-name` diverge per provider, and that only 5 providers are
 * enum-recognised — is *mostly about a live OAuth login*, which is IdP-BLOCKED on odd-minimal
 * (auth.type=DISABLED, no OIDC provider configured, so NONE of the @Conditional *UserHandler
 * beans are even instantiated). Faking an OAuth login would be the cardinal sin (the same class
 * of miss that let Swagger silently break). So this spec pins ONLY what is observable here:
 *
 *  - the DISABLED identity contract the SPA actually sits on (GET /api/identity/whoami → a fixed
 *    `admin` principal with the FULL permission set: under the shipped default there is NO
 *    per-provider admin *detection* at all — everyone is admin). This is the baseline the OAuth
 *    matrix is the enforcing-mode alternative to.
 *  - that the live OAuth-init endpoints are INERT under DISABLED (SPA fallback, not an external
 *    302) — i.e. the live admin-promotion path is genuinely unreachable here, which is WHY the
 *    per-provider promises are deferred-with-reason (documented in the protocol §5).
 *
 * GROUND TRUTH (curl, ODD_STACK_EXTERNAL=1 :18080, 2026-06-07):
 *   GET /api/identity/whoami            -> 200 {"identity":{"username":"admin","permissions":[...77 perms...]}, "owner":null, ...}
 *   GET /api/appInfo                    -> 200 {"projectVersion":"0.27.13","authType":"DISABLED"}
 *   GET /oauth2/authorization/google    -> 200 text/html (SPA index — no OAuth client registered)
 *   GET /oauth2/authorization/cognito   -> 200 text/html (SPA index)
 *
 * SOURCE-GROUNDED (the IdP-blocked contract; full list in the protocol §5):
 *   Provider.java:3-5            — enum is EXACTLY {COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE} (5 values)
 *   CustomOIDCUserHandler.java:28-34 — shouldHandle == provider NOT in the 5-enum (Okta/Keycloak land here)
 *   GoogleUserHandler.java:37-73 — reads adminPrincipals only; NEVER getAdminGroups() (H-002 no-op, PLT-069)
 *   GithubUserHandler.java:54-68 — adminPrincipals fast-path returns BEFORE the org-gate (H-003 bypass, PLT-070)
 *   AbstractOIDCUserHandler.java:33-55 — Cognito/Azure/Custom/ODDIAM read BOTH principals AND groups
 *   OperationUtils.java:9        — containsIgnoreCase == element::equalsIgnoreCase (full-string equality, H-007)
 */

// The 5 enum-recognised providers + 2 NOT-in-enum names (Okta/Keycloak) that fall through to
// CustomOIDCUserHandler. We don't drive a login (IdP-blocked); we assert each provider's OAuth
// init endpoint is the inert SPA fallback under DISABLED, proving the live flow is unreachable.
const ENUM_PROVIDERS = ['google', 'github', 'cognito', 'azure', 'odd_iam'];
const NON_ENUM_PROVIDERS = ['okta', 'keycloak'];

interface WhoAmI {
  identity?: { username?: string; permissions?: string[] };
  owner?: unknown;
  association_request?: unknown;
}

async function isSpaFallback(request: APIRequestContext, path: string): Promise<boolean> {
  // Under DISABLED with no OAuth client, /oauth2/authorization/{p} is not a real Spring endpoint;
  // the SPA catch-all serves index.html (200 text/html). A real OAuth init would be a 302 to the
  // IdP authorize URL. We treat "200 + html + NOT a redirect" as the inert fallback.
  const res = await request.get(path, { maxRedirects: 0 });
  if (res.status() !== 200) return false;
  const ct = (res.headers()['content-type'] ?? '').toLowerCase();
  return ct.includes('text/html');
}

test.describe('F-084 OAuth admin-detection matrix — observable contract (live flow is IdP-blocked)', () => {
  test('it21190_H-baseline: under DISABLED the identity contract is a fixed `admin` principal with the FULL permission set (no per-provider detection runs)', async ({
    request,
  }) => {
    // This is the operator-observable baseline the SPA sits on under the shipped default. The OAuth
    // per-provider admin-detection matrix is the ENFORCING-mode alternative to this — but on the
    // minimal stack there is exactly one identity, granted everything, with no detection step at all.
    const res = await request.get('/api/identity/whoami');
    expect(res.status(), 'GET /api/identity/whoami answers (200) under DISABLED').toBe(200);
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'a real controller JSON body, not the SPA index.html fallback',
    ).toContain('application/json');

    const body = (await res.json()) as WhoAmI;
    expect(body.identity?.username, 'DISABLED synthesises the fixed `admin` principal').toBe('admin');
    expect(
      Array.isArray(body.identity?.permissions) && (body.identity?.permissions?.length ?? 0) > 0,
      'the DISABLED principal carries the FULL permission set (everyone is admin) — the baseline the OAuth matrix replaces',
    ).toBe(true);
    // Pin a couple of high-value admin permissions so a future narrowing of the DISABLED grant trips RED.
    expect(
      body.identity?.permissions,
      'the DISABLED admin grant includes role/policy management (the platform-admin tier)',
    ).toEqual(expect.arrayContaining(['POLICY_CREATE', 'ROLE_CREATE']));
  });

  test('it21191: every OAuth-init endpoint is INERT under DISABLED (SPA fallback, not an external IdP 302) — the live admin-promotion path is unreachable here', async ({
    request,
  }) => {
    // No OAuth client is configured on odd-minimal, so the per-provider handler beans (gated by
    // GoogleCondition/AzureCondition/... which bind auth.oauth2.client) are not active. The login
    // endpoints therefore cannot start a real flow — they fall through to the SPA. This is the
    // mechanical reason the H-001..H-011 promises below are deferred-with-reason, not testable here.
    for (const p of ENUM_PROVIDERS) {
      expect(
        await isSpaFallback(request, `/oauth2/authorization/${p}`),
        `under DISABLED /oauth2/authorization/${p} must be the inert SPA fallback (no IdP configured), ` +
          `not a 302 to an external authorize endpoint — confirms the live OAuth flow is unreachable`,
      ).toBe(true);
    }
  });

  test('it21192_H-006: a NOT-in-enum provider name (okta/keycloak) has no dedicated OAuth-init surface under DISABLED — source: it would route to CustomOIDCUserHandler with no per-provider admin mapping', async ({
    request,
  }) => {
    // F-084 H-006 (CONTRADICTED): the live docs claim Okta/Keycloak parity, but Provider.java has 5
    // values and CustomOIDCUserHandler.shouldHandle catches everything else (getDefaultGroupsClaim()
    // returns null → admin-groups path is inert for them). We cannot exercise that promotion without an
    // IdP; what IS observable is that these names are equally inert under DISABLED (SPA fallback), i.e.
    // there is no first-class Okta/Keycloak endpoint either. The promotion asymmetry is deferred (PLT-071).
    for (const p of NON_ENUM_PROVIDERS) {
      expect(
        await isSpaFallback(request, `/oauth2/authorization/${p}`),
        `/oauth2/authorization/${p} is the inert SPA fallback under DISABLED — Okta/Keycloak have no ` +
          `enum value and no configured client; their admin-detection parity is IdP-blocked (PLT-071)`,
      ).toBe(true);
    }
  });
});

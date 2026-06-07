import { test, expect } from '@playwright/test';

/**
 * IT-064 — F-119 Deployment-Info Introspection Surface (GET /api/appInfo).
 *
 * Protocol: integration-tests/protocols/IT-064-appinfo-introspection.md
 * Gates: validates F-119 (UC H-001 exact shape · H-003 anonymous-under-DISABLED fingerprint).
 *
 * `AppInfoController#getAppInfo` (AppInfoController.java:23-28) returns
 *   `new AppInfo().projectVersion(buildProperties.getVersion()).authType(authType)`
 * where authType is the raw `@Value("${auth.type}")` (AppInfoController.java:17). The path is
 * NOT in SecurityConstants.WHITELIST_PATHS (SecurityConstants.java:27); under the shipped default
 * auth.type=DISABLED, DisabledAuthSecurityConfiguration wires `.anyExchange().permitAll()`
 * (DisabledAuthSecurityConfiguration.java:18) so the endpoint answers any unauthenticated caller.
 *
 * Operator caveat (the reason to characterize this): under DISABLED a single unauthenticated GET
 * returns the PRECISE platform version (CVE-scoping) + the active auth mode — a passive recon
 * fingerprint. The live security docs document this exact surface (DOC-GAP-037 closed). These pins
 * lock (a) what an anonymous caller sees and (b) that the shape is exactly two fields — so any
 * future field added to AppInfo (widening the unauthenticated fingerprint) trips the corner test.
 *
 * GROUNDED 2026-06-07: `curl -s :18080/api/appInfo` -> 200 `{"projectVersion":"0.27.13","authType":"DISABLED"}`.
 */

interface AppInfoBody {
  projectVersion?: string;
  authType?: string;
  [k: string]: unknown;
}

test.describe('F-119 Deployment-Info Introspection Surface (/api/appInfo)', () => {
  test('it20640_H-003: an anonymous (no-credential) GET /api/appInfo returns 200 + the deployment version and auth mode', async ({
    request,
  }) => {
    // No Authorization header is sent. Under the shipped default auth.type=DISABLED the request is permitted.
    const res = await request.get('/api/appInfo');
    expect(res.status(), 'GET /api/appInfo answers an anonymous caller with 200 under DISABLED').toBe(200);
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'the response is JSON (a real controller body, not the SPA index.html fallback)',
    ).toContain('application/json');

    const body = (await res.json()) as AppInfoBody;
    // projectVersion is buildProperties.getVersion() — a non-empty semver-ish string the operator sees.
    expect(
      typeof body.projectVersion === 'string' && body.projectVersion.length > 0,
      'projectVersion is disclosed to an anonymous caller (the precise version — CVE-scoping fingerprint)',
    ).toBe(true);
    // authType echoes the raw @Value("${auth.type}"); on this shipped-default stack it is DISABLED.
    expect(
      body.authType,
      'authType is disclosed to an anonymous caller; this stack runs the shipped default DISABLED',
    ).toBe('DISABLED');
  });

  test('it20641_H-001: the /api/appInfo response shape is EXACTLY {projectVersion, authType} — no extra operator-sensitive field leaks', async ({
    request,
  }) => {
    // Characterization pin of the unauthenticated fingerprint SURFACE. AppInfoController emits only the two
    // AppInfo fields (AppInfoController.java:25-26); the OpenAPI AppInfo schema (components.yaml AppInfo)
    // declares only projectVersion + authType. If a future change adds a third field to AppInfo it widens the
    // anonymous fingerprint — this assertion goes RED and forces a deliberate review of the new exposure.
    const res = await request.get('/api/appInfo');
    expect(res.status(), 'precondition: /api/appInfo is reachable').toBe(200);
    const body = (await res.json()) as AppInfoBody;

    const keys = Object.keys(body).sort();
    expect(
      keys,
      'AppInfo must expose ONLY projectVersion + authType anonymously; a new key here = a widened unauthenticated fingerprint to re-review',
    ).toEqual(['authType', 'projectVersion']);
  });
});

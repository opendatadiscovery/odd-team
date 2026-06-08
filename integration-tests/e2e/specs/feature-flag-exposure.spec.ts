import { test, expect } from '@playwright/test';

/**
 * IT-117 — F-034 Platform Feature-Flag Exposure (GET /api/features/active).
 *
 * Protocol: integration-tests/protocols/IT-117-feature-flag-exposure.md
 * Gates: validates F-034 (UC-4 stock-install empty shape · UC-5 anonymous reach under DISABLED ·
 *        UC-8 deployment-wide, not per-user).
 *
 * GROUND TRUTH (read 2026-06-07):
 *   - `FeatureController#getActiveFeatures` (FeatureController.java:17-20) returns
 *     `featureResolver.resolveActiveFeatures()`.
 *   - `FeatureResolverImpl` (FeatureResolverImpl.java:16-31) captures the two @Value SpEL booleans
 *     `${datacollaboration.enabled}` + `${notifications.enabled}` (FeatureResolver.java:7,10) into a
 *     `private final Set<Feature>` ONCE in the constructor: DATA_COLLABORATION is added iff
 *     datacollaboration.enabled is true; ALERT_NOTIFICATIONS iff notifications.enabled is true.
 *     resolveActiveFeatures() returns `new FeatureList().items(new ArrayList<>(activeFeatures))`.
 *   - Shipped defaults (application.yml:173 `notifications.enabled: false`, :205
 *     `datacollaboration.enabled: false`) → the active set is EMPTY → the endpoint returns
 *     `{"items":[]}` on a stock install.
 *   - `/api/features/active` is NOT in SecurityConstants.WHITELIST_PATHS
 *     (SecurityConstants.java:95-96 = {"/actuator/**","/favicon.ico","/ingestion/**","/img/**",
 *     "/api/slack/events"}) and has no SECURITY_RULES entry, so it falls through to the
 *     authenticated default — but under the shipped auth.type=DISABLED,
 *     DisabledAuthSecurityConfiguration wires `.anyExchange().permitAll()`, so the endpoint answers
 *     any unauthenticated caller. There is NO @PreAuthorize on the controller and the resolved set
 *     is constructor-global (FeatureResolverImpl.java:14) — the same list for every caller,
 *     deployment-wide, not per-user.
 *
 * Operator caveat (why characterize this): under DISABLED a single unauthenticated GET tells an
 * external scanner exactly which optional platform features (Data Collaboration / Alert
 * Notifications) are activated — a passive feature-fingerprint (F-034 facet
 * disabled_mode_anonymous_feature_fingerprinting, LOW). These pins lock (a) the stock-install
 * empty baseline, (b) what an anonymous caller learns, and (c) that the items array carries ONLY
 * the two known Feature enum names — so any new flag widening the anonymous fingerprint, or any
 * default flipping a flag on out of the box, trips a test.
 *
 * GROUNDED 2026-06-07: `curl -s :18080/api/features/active` -> 200 `{"items":[]}` on this
 * shipped-default DISABLED stack (both flags at their false defaults).
 *
 * NOTE on the two CONTRADICTED F-034 promises NOT pinned here: UC-2 (the toolbar chrome is
 * invariant to the flag set) and UC-3 (boot-immutability — actuator/refresh ignored) are real
 * contradictions tracked as PLT-068, but neither is observable on THIS stack: the flags are
 * boot-bound (FeatureResolverImpl constructor) and the running shared stack cannot be reconfigured
 * or restarted from here, and the chrome-invariance pin already lives with the toolbar feature
 * (IT-101 / F-041). So IT-117 characterizes the exposure surface that IS observable under the
 * shipped default; PLT-068's chrome/refresh defects are out of this stack's reach.
 */

interface FeatureItem {
  // The OpenAPI Feature enum: DATA_COLLABORATION | ALERT_NOTIFICATIONS (components.yaml Feature).
  [k: string]: unknown;
}
interface FeatureListBody {
  items?: string[];
  [k: string]: unknown;
}

// The known Feature enum values FeatureResolverImpl can ever emit (FeatureResolverImpl.java:23,27).
const KNOWN_FEATURES = ['ALERT_NOTIFICATIONS', 'DATA_COLLABORATION'];

test.describe('F-034 Platform Feature-Flag Exposure (/api/features/active)', () => {
  test('it21170_UC-4: stock install (both flags false) -> 200 JSON {"items":[]} (not null, not 404)', async ({
    request,
  }) => {
    // The shipped defaults leave both datacollaboration.enabled and notifications.enabled false
    // (application.yml:173,205). FeatureResolverImpl adds neither Feature, so the list is empty —
    // but it MUST be a real 200 JSON body with an empty array, never null and never a 404.
    const res = await request.get('/api/features/active');
    expect(res.status(), 'GET /api/features/active answers 200 (the endpoint exists and resolves)').toBe(
      200,
    );
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'the response is JSON (a real controller body, not the SPA index.html fallback)',
    ).toContain('application/json');

    const body = (await res.json()) as FeatureListBody;
    expect(Array.isArray(body.items), 'FeatureList.items is an array (never null)').toBe(true);
    // Stock install: no optional feature is activated -> the array is empty. If a future default
    // flips a flag ON out of the box (widening what ships enabled), this assertion goes RED.
    expect(
      body.items,
      'on the shipped DISABLED stock install (both flags false) the active-feature set is empty',
    ).toEqual([]);
  });

  test('it21171_UC-5: an anonymous (no-credential) GET is permitted under DISABLED and returns the feature list', async ({
    request,
  }) => {
    // No Authorization header. /api/features/active is NOT whitelisted (SecurityConstants.java:95-96)
    // yet under auth.type=DISABLED DisabledAuthSecurityConfiguration permitAll() lets it through —
    // so an external scanner can read the feature-flag set without authenticating (the
    // disabled_mode_anonymous_feature_fingerprinting facet). This pin locks that anonymous reach;
    // it flips RED if a future build either whitelists/authz-gates this path or changes DISABLED's
    // posture (any of which would change the documented anonymous-reach baseline).
    const res = await request.get('/api/features/active', {
      // belt-and-braces: explicitly send no auth header
      headers: {},
    });
    expect(
      res.status(),
      'under DISABLED an unauthenticated caller reaches FeatureController (200, not 302/401)',
    ).toBe(200);
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'the anonymous caller gets the JSON feature list, not a login redirect / SPA fallback',
    ).toContain('application/json');

    const body = (await res.json()) as FeatureListBody;
    expect(
      Array.isArray(body.items),
      'the anonymous caller learns the feature-flag set shape (items[]) — the fingerprint surface',
    ).toBe(true);
  });

  test('it21172_UC-8 (corner): the items array contains ONLY known Feature enum names — no extra flag leaks the fingerprint wider', async ({
    request,
  }) => {
    // Characterization pin of the fingerprint CONTENT. FeatureResolverImpl can only ever add
    // DATA_COLLABORATION or ALERT_NOTIFICATIONS (FeatureResolverImpl.java:23,27), and the resolved
    // set is constructor-global (FeatureResolverImpl.java:14) — identical for every caller,
    // deployment-wide, with no @PreAuthorize on the controller. So whatever the deployment toggles
    // on, the items array is a subset of the two known enum names. A NEW value here = a new optional
    // feature whose anonymous-exposure + UI-gating must be deliberately re-reviewed (the
    // feature_enum_ui_backend_skew_silent_disable facet). On this stock stack the set is empty,
    // which is trivially a subset; the assertion is the load-bearing guard for future flags.
    const res = await request.get('/api/features/active');
    expect(res.status(), 'precondition: /api/features/active is reachable').toBe(200);
    const body = (await res.json()) as FeatureListBody;
    const items = body.items ?? [];

    for (const f of items) {
      expect(
        KNOWN_FEATURES,
        `feature "${f}" exposed anonymously must be a known Feature enum name; a new value = a widened fingerprint to re-review`,
      ).toContain(f);
    }
    // And there are no duplicates (the resolver builds from a Set — FeatureResolverImpl.java:20,30).
    expect(
      new Set(items).size,
      'the resolved feature set has no duplicate entries (built from a Set<Feature>)',
    ).toBe(items.length);
  });
});

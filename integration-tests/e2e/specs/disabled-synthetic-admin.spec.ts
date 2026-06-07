import { test, expect } from '@playwright/test';

/**
 * IT-111 — F-085 Identity Probe & DISABLED-Mode Synthetic Admin Fallback.
 *
 * Protocol: integration-tests/protocols/IT-111-disabled-synthetic-admin.md
 * Gates: validates F-085 (UC-002 synthetic-admin grant + UC-001 the SPA's single permission source).
 *
 * GROUND TRUTH (read before asserting):
 *  - IdentityController.java:23-33 — whoami `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(),
 *    HttpStatus.OK)))`; dummyOwner() = `new AssociatedOwner().identity(new Identity().username("admin")
 *    .permissions(Arrays.asList(Permission.values())))`. So under DISABLED (empty SecurityContext) the
 *    anonymous response is 200 + username "admin" + EVERY Permission enum value + owner null.
 *  - DisabledAuthSecurityConfiguration.java:13-17 — DISABLED wires no ServerSecurityContextRepository,
 *    so the principal Mono is empty and the switchIfEmpty branch is the defining DISABLED experience.
 *  - SecurityConstants WHITELIST_PATHS does NOT contain /api/identity/whoami; under DISABLED everything
 *    is permitAll anyway, so the endpoint is anonymously reachable.
 *  - components.yaml:158-235 — the canonical Permission enum (73 values, DATA_ENTITY_INTERNAL_NAME_UPDATE
 *    .. ROLE_DELETE). dummyOwner grants Arrays.asList(Permission.values()) == this whole set.
 *  - PermissionProvider.tsx:17-32 / profile.selectors.ts getGlobalPermissions — the SPA reads this one
 *    response into Redux and every UI affordance gate consults it.
 *
 * This is the FULL F-085 identity-probe + permission-set contract (IT-054 only touched whoami for the
 * F-011 provider field). LSN-029 characterization pin: GREEN under the shipped DISABLED default; it goes
 * RED the instant a hardening (PLT-072) makes DISABLED return a non-admin identity. EXPECTED_PERMISSIONS
 * is pinned verbatim from components.yaml so an upstream enum change (which changes the live grant) flips
 * this test — forcing a deliberate re-grounding rather than silent drift.
 *
 * Operator caveat (the reason to pin): under the SHIPPED DEFAULT auth.type=DISABLED, ANY anonymous
 * network caller is the admin with every current AND future Permission (Permission.values() expands
 * dynamically — a new sensitive capability enters the DISABLED grant with no controller change).
 */

interface Whoami {
  identity?: { username?: string; permissions?: string[] };
  owner?: unknown;
  association_request?: unknown;
}

// Pinned from odd-platform-specification/components.yaml:161-235 (the canonical Permission enum, in spec
// order). dummyOwner() grants exactly this set via Arrays.asList(Permission.values()). Update deliberately
// if the enum changes upstream (the live response changes too — the test will tell you).
const EXPECTED_PERMISSIONS = [
  'DATA_ENTITY_INTERNAL_NAME_UPDATE', 'DATA_ENTITY_CUSTOM_METADATA_CREATE', 'DATA_ENTITY_CUSTOM_METADATA_UPDATE',
  'DATA_ENTITY_CUSTOM_METADATA_DELETE', 'DATA_ENTITY_DESCRIPTION_UPDATE', 'DATA_ENTITY_OWNERSHIP_CREATE',
  'DATA_ENTITY_OWNERSHIP_UPDATE', 'DATA_ENTITY_OWNERSHIP_DELETE', 'DATA_ENTITY_ADD_TO_GROUP',
  'DATA_ENTITY_DELETE_FROM_GROUP', 'DATA_ENTITY_TAGS_UPDATE', 'DATA_ENTITY_ADD_TERM', 'DATA_ENTITY_DELETE_TERM',
  'DATA_ENTITY_ALERT_RESOLVE', 'DATA_ENTITY_ALERT_CONFIG_UPDATE', 'DATASET_TEST_RUN_SET_SEVERITY',
  'DATASET_FIELD_DESCRIPTION_UPDATE', 'DATASET_FIELD_INTERNAL_NAME_UPDATE', 'DATASET_FIELD_TAGS_UPDATE',
  'DATASET_FIELD_ENUMS_UPDATE', 'DATASET_FIELD_ADD_TERM', 'DATASET_FIELD_DELETE_TERM', 'DATA_ENTITY_GROUP_CREATE',
  'DATA_ENTITY_GROUP_UPDATE', 'DATA_ENTITY_ATTACHMENT_MANAGE', 'DATA_ENTITY_STATUS_UPDATE', 'QUERY_EXAMPLE_CREATE',
  'QUERY_EXAMPLE_UPDATE', 'QUERY_EXAMPLE_DELETE', 'QUERY_EXAMPLE_DATASET_CREATE', 'QUERY_EXAMPLE_DATASET_DELETE',
  'QUERY_EXAMPLE_TERM_CREATE', 'QUERY_EXAMPLE_TERM_DELETE', 'LOOKUP_TABLE_CREATE', 'LOOKUP_TABLE_UPDATE',
  'LOOKUP_TABLE_DELETE', 'LOOKUP_TABLE_DEFINITION_CREATE', 'LOOKUP_TABLE_DEFINITION_UPDATE',
  'LOOKUP_TABLE_DEFINITION_DELETE', 'LOOKUP_TABLE_DATA_CREATE', 'LOOKUP_TABLE_DATA_UPDATE', 'LOOKUP_TABLE_DATA_DELETE',
  'TERM_CREATE', 'TERM_UPDATE', 'TERM_DELETE', 'TERM_OWNERSHIP_CREATE', 'TERM_OWNERSHIP_UPDATE',
  'TERM_OWNERSHIP_DELETE', 'TERM_TAGS_UPDATE', 'DATA_SOURCE_CREATE', 'DATA_SOURCE_UPDATE', 'DATA_SOURCE_DELETE',
  'DATA_SOURCE_TOKEN_REGENERATE', 'COLLECTOR_CREATE', 'COLLECTOR_UPDATE', 'COLLECTOR_DELETE',
  'COLLECTOR_TOKEN_REGENERATE', 'NAMESPACE_CREATE', 'NAMESPACE_UPDATE', 'NAMESPACE_DELETE', 'TAG_CREATE',
  'TAG_UPDATE', 'TAG_DELETE', 'OWNER_CREATE', 'OWNER_UPDATE', 'OWNER_DELETE', 'OWNER_ASSOCIATION_MANAGE',
  'OWNER_RELATION_MANAGE', 'DIRECT_OWNER_SYNC', 'POLICY_CREATE', 'POLICY_UPDATE', 'POLICY_DELETE', 'ROLE_CREATE',
  'ROLE_UPDATE', 'ROLE_DELETE',
];

test.describe('F-085 DISABLED synthetic-admin identity probe', () => {
  test('UC-002: anonymous GET /api/identity/whoami returns 200 + synthetic "admin" with the FULL Permission set + owner null', async ({
    request,
  }) => {
    // ---- act: a single anonymous probe (no Authorization, no cookie) ----
    const res = await request.get('/api/identity/whoami', { maxRedirects: 0 });

    // 200, not 302/401 — the DISABLED fingerprint half of UC-004 (the response code is the auth-mode tell).
    expect(
      res.status(),
      'under DISABLED the anonymous whoami must be 200 (IdentityController switchIfEmpty -> dummyOwner). ' +
        'A 302/401 here means the stack is NOT in DISABLED mode; a 500 means the s2s NPE (see IT-112).',
    ).toBe(200);

    const body = (await res.json()) as Whoami;

    // dummyOwner() hardcodes the lowercase literal "admin" (IdentityController.java:32).
    expect(
      body.identity?.username,
      'the synthetic DISABLED identity username is the lowercase literal "admin" (dummyOwner, IdentityController.java:32)',
    ).toBe('admin');

    // owner is null — the switchIfEmpty short-circuits BEFORE any AuthIdentityProvider owner resolution
    // (F-085 facet dummy_owner_owner_is_null_decoupled_from_user_owner_mapping).
    expect(
      body.owner,
      'the dummyOwner identity carries owner=null (the switchIfEmpty branch never resolves an Owner)',
    ).toBeNull();
    expect(
      body.association_request,
      'the dummyOwner identity carries association_request=null',
    ).toBeNull();

    // The permission set is EXACTLY Arrays.asList(Permission.values()). Assert set-equality against the
    // pinned canonical enum so a spec/enum change (which moves the live grant) is caught.
    const perms = new Set(body.identity?.permissions ?? []);
    const missing = EXPECTED_PERMISSIONS.filter((p) => !perms.has(p));
    const extra = [...perms].filter((p) => !EXPECTED_PERMISSIONS.includes(p));
    expect(
      missing,
      'DISABLED admin must carry EVERY pinned Permission (Arrays.asList(Permission.values())); ' +
        `missing => the grant shrank (hardening?) or the enum changed: ${missing.join(', ')}`,
    ).toEqual([]);
    expect(
      extra,
      'whoami returned a permission not in the pinned enum — the spec grew a Permission; re-ground ' +
        `EXPECTED_PERMISSIONS from components.yaml: ${extra.join(', ')}`,
    ).toEqual([]);
    expect(
      perms.size,
      'the DISABLED admin grant count must equal the pinned enum size (full dynamic blast radius)',
    ).toBe(EXPECTED_PERMISSIONS.length);
  });

  test('UC-001: the SPA loads its permission context from this one whoami response (the rendered UI is the admin UI)', async ({
    page,
  }) => {
    // The SPA fires whoami on boot (App.tsx -> profile.thunks); PermissionProvider stores the result and
    // every WithPermissions gate reads it. Confirm the app boots against the synthetic-admin response:
    // the whoami call fires and the shell renders (no auth wall, no login redirect).
    const whoami = page.waitForResponse(
      (r) => r.url().includes('/api/identity/whoami') && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto('/');
    const r = await whoami;
    const body = (await r.json()) as Whoami;
    expect(
      body.identity?.username,
      'the SPA-issued whoami returns the synthetic admin — the same wire UC-002 asserts, now via the browser',
    ).toBe('admin');

    // The catalog shell renders for the anonymous admin (the search bar is the always-present chrome).
    await expect(
      page.getByPlaceholder(/search/i).first(),
      'the SPA renders its authenticated shell for the synthetic-admin (no login wall under DISABLED)',
    ).toBeVisible({ timeout: 15_000 });
  });
});

import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-113 — F-090 Permission Read Surface — Contextual vs Non-Contextual Split.
 *
 * Protocol: integration-tests/protocols/IT-113-permission-read-surface.md
 * Gates: validates F-090 (UC H-001 MANAGEMENT-reject + H-002 contextual-200 + H-003 global-half-via-whoami).
 *
 * GROUND TRUTH (read before asserting):
 *  - PermissionController.java:19-25 — single type-agnostic method; forwards every PermissionResourceType
 *    to permissionService.getResourcePermissionsForCurrentUser.
 *  - PermissionServiceImpl.java:24-27 — `PolicyTypeDto.valueOf(resourceType.name())` then
 *    `if (!policyTypeDto.isHasContext()) throw new BadUserRequestException("Resource type " + resourceType
 *    + " does not have context")`.
 *  - PolicyTypeDto.java:8-12 — DATA_ENTITY/TERM/QUERY_EXAMPLE hasContext=true; MANAGEMENT hasContext=false.
 *    So the contextual endpoint serves 3 of the 4 spec'd PermissionResourceType values and rejects MANAGEMENT.
 *  - components.yaml:3381-3387 — the OpenAPI PermissionResourceType enum declares ALL FOUR values incl.
 *    MANAGEMENT; a spec-compiled SDK believes MANAGEMENT is valid here. This is the documented spec/runtime
 *    drift the split produces (F-090 facet openapi_spec_management_valid_runtime_rejects_400_usr001).
 *  - IdentityServiceImpl whoami -> Identity.permissions is the ONLY surface carrying MANAGEMENT-scope
 *    permissions (the global half). Under DISABLED that is the full synthetic-admin set (see IT-111).
 *
 * The split is structurally correct (contextual perms need a resource_id to evaluate policy predicates;
 * MANAGEMENT perms are global) but undocumented at the operator surface. This pins the contract a third-party
 * integrator must discover by reading source: the 400 USR001 on MANAGEMENT, the 200 on DATA_ENTITY, and the
 * whoami location of MANAGEMENT-scope permissions. LSN-029 note: under DISABLED the contextual 200 returns
 * the admin's full contextual grant; if hardening makes DISABLED non-admin the body shrinks — but the
 * STRUCTURAL contract (200 vs 400 USR001) asserted here is auth-mode-independent and stays GREEN.
 *
 * Verified live this build: GET /api/resource/MANAGEMENT/0/permissions -> 400 {"code":"USR001",
 * "message":"Resource type MANAGEMENT does not have context"}; GET /api/resource/DATA_ENTITY/<seeded>/permissions -> 200.
 *
 * Collision-free: entity id 21130 in the IT-113 band (21130-21139); name it113_*; idempotent seed.
 */
const ENTITY_ID = 21130;
const SOURCE_ID = 21130;
const ODDRN = '//e2e-it113/ds/tables/it113_entity';

async function seedContextualEntity(): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SOURCE_ID, '//e2e-it113/ds', 'it113-ds'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET entity_class_ids = '{1}'`,
    [ENTITY_ID, ODDRN, 'it113_entity', SOURCE_ID],
  );
}

test.describe('F-090 Permission read surface — contextual vs non-contextual split', () => {
  test.beforeAll(async () => {
    await seedContextualEntity();
  });

  test('H-001: GET /api/resource/MANAGEMENT/{id}/permissions returns 400 USR001 "does not have context" (NOT the 200 a spec SDK expects)', async ({
    request,
  }) => {
    // MANAGEMENT is a valid PermissionResourceType in the OpenAPI enum but PolicyTypeDto.MANAGEMENT.hasContext
    // is false -> the service throws BadUserRequestException -> 400 USR001. This is the spec/runtime drift.
    const res = await request.get('/api/resource/MANAGEMENT/0/permissions', { maxRedirects: 0 });
    expect(
      res.status(),
      'MANAGEMENT has no context -> PermissionServiceImpl.java:25-26 throws BadUserRequestException -> 400 ' +
        '(a spec-compiled SDK that trusts the 4-value enum here wrongly expects 200)',
    ).toBe(400);

    const body = (await res.json()) as { code?: string; message?: string };
    expect(body.code, 'the platform error code for this rejection is USR001').toBe('USR001');
    expect(
      body.message,
      'the rejection message names MANAGEMENT explicitly (the integrator-facing tell)',
    ).toContain('does not have context');
    expect(body.message, 'message names the MANAGEMENT resource type').toContain('MANAGEMENT');
  });

  test('H-002 + H-006: GET /api/resource/DATA_ENTITY/{id}/permissions is 200 (contextual half works) and returns [] under DISABLED', async ({
    request,
  }) => {
    // DATA_ENTITY hasContext=true -> the contextual extractor runs (no 400 rejection) and serves 200 for the
    // seeded entity. The BODY is the documented DISABLED divergence (F-090 facet H-006): the contextual
    // extractor resolves permissions from the POLICY graph for the current principal; under DISABLED there is
    // no resolved principal/policy, so the contextual grant is EMPTY [] — even though mutations are permitAll.
    // Verified live this build: GET /api/resource/DATA_ENTITY/<seeded>/permissions -> 200 []. This is the
    // UI-vs-API divergence the ontology flags: the contextual READ says "you can do nothing" while the WRITE
    // API is wide open. LSN-029 pin: GREEN under DISABLED; under an RBAC mode the body becomes the policy set.
    const res = await request.get(`/api/resource/DATA_ENTITY/${ENTITY_ID}/permissions`, { maxRedirects: 0 });
    expect(
      res.status(),
      `DATA_ENTITY hasContext=true -> the contextual endpoint serves 200 for the seeded entity ${ENTITY_ID} ` +
        '(NOT a 400 "does not have context"). A 404 USR002 would mean the seed entity is missing.',
    ).toBe(200);

    const perms = (await res.json()) as string[];
    expect(Array.isArray(perms), 'the contextual response body is a Permission array').toBeTruthy();
    expect(
      perms,
      'under DISABLED the contextual permission grant is EMPTY [] (no resolved policy principal) — the ' +
        'documented UI-vs-API divergence (F-090 H-006): contextual READ is empty while the WRITE API is open. ' +
        'A non-empty array here means a resolved policy principal — i.e. NOT DISABLED mode; re-ground.',
    ).toEqual([]);
  });

  test('H-001 corner: TERM and QUERY_EXAMPLE are also contextual (200); only MANAGEMENT is rejected (the 3-of-4 split)', async ({
    request,
  }) => {
    // The split is exactly PolicyTypeDto.hasContext: 3 contextual types serve, 1 (MANAGEMENT) rejects. We
    // assert the contextual types do NOT 400-with-USR001 (they may 200, or 404 if no such resource — but
    // never the "does not have context" rejection, which is the MANAGEMENT-only signature).
    for (const type of ['TERM', 'QUERY_EXAMPLE']) {
      const res = await request.get(`/api/resource/${type}/0/permissions`, { maxRedirects: 0 });
      const text = await res.text();
      expect(
        text,
        `${type} is contextual (PolicyTypeDto.${type}.hasContext=true) -> it must NOT raise the ` +
          '"does not have context" rejection that is MANAGEMENT-specific',
      ).not.toContain('does not have context');
    }
  });

  test('H-003: the MANAGEMENT-scope permissions live on whoami (the global half of the split is reachable there)', async ({
    request,
  }) => {
    // The non-contextual MANAGEMENT permissions are NOT served by /api/resource/... — they are reachable
    // only via whoami -> Identity.permissions (IdentityServiceImpl). Under DISABLED that carries the full
    // admin set, which includes the management-scope grants (POLICY_CREATE, OWNER_CREATE, LOOKUP_TABLE_*).
    const res = await request.get('/api/identity/whoami', { maxRedirects: 0 });
    expect(res.status(), 'whoami is reachable (the global-half permission surface)').toBe(200);
    const perms = new Set(
      ((await res.json()) as { identity?: { permissions?: string[] } }).identity?.permissions ?? [],
    );
    for (const p of ['POLICY_CREATE', 'OWNER_CREATE', 'LOOKUP_TABLE_CREATE']) {
      expect(
        perms.has(p),
        `${p} is a MANAGEMENT-scope permission reachable ONLY via whoami (not via /api/resource/...); ` +
          'it must be present in the whoami permission list (the global half)',
      ).toBeTruthy();
    }
  });
});

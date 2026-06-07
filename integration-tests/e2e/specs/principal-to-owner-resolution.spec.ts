import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-054 — F-011 Principal-to-Owner Resolution chokepoint under DISABLED (the per-request
 * security chokepoint; high SEC / DATA-LOSS risk).
 *
 * Protocol: integration-tests/protocols/IT-054-principal-to-owner-resolution.md
 * Gates: validates F-011 (UC: identity resolution under DISABLED — no authenticated principal).
 *
 * GROUND TRUTH (read from source + curl-probed live against the running odd-minimal stack):
 *   Two endpoints resolve "the current user", and they DISAGREE under DISABLED:
 *
 *   (1) IdentityController.whoami (GET /api/identity/whoami) — IdentityController.java:24-33.
 *       identityService.whoami() routes through AuthIdentityProviderImpl.getCurrentUser()
 *       (AuthIdentityProviderImpl.java:24-35), which reads ReactiveSecurityContextHolder.getContext().
 *       Under DISABLED there is NO SecurityContext -> getCurrentUser() emits Mono.empty() ->
 *       whoami().switchIfEmpty(dummyOwner()) (IdentityController.java:27) substitutes a SYNTHETIC
 *       identity: username="admin" + EVERY Permission.values() (~75 perms) + owner=null.
 *
 *   (2) AuthIdentityProviderImpl.fetchAssociatedOwner (AuthIdentityProviderImpl.java:50-53) —
 *       the owner-scoping resolver consumed by all 15 owner-scoped read/write surfaces. It
 *       chains getCurrentUser().flatMap(userOwnerMappingRepository.getAssociatedOwner(...)).
 *       Because getCurrentUser() is empty under DISABLED, the flatMap NEVER fires the SQL —
 *       fetchAssociatedOwner() short-circuits to Mono.empty() at the principal step, before any
 *       user_owner_mapping / ownership data is even consulted.
 *
 *   The characterization, then: under DISABLED the principal resolves to a PHANTOM "admin" that
 *   holds every PERMISSION (the UI renders it as a fully-privileged user) yet is bound to NO OWNER.
 *   So every owner-scoped surface attributes to nobody and returns empty — the "current owner" is
 *   null even though the "current user" is a god-mode admin. This is the F-011 security boundary
 *   under the shipped default: full permission, zero owner identity.
 *
 * These are LSN-029 characterization pins of the SHIPPED DEFAULT auth.type=DISABLED. They are GREEN
 * now and flip the moment the default becomes fail-closed, whoami stops synthesising an all-perms
 * admin, or owner-scoping starts attributing anonymous traffic to a real owner.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

// it054_ namespace for any seeded rows (idempotent; cleaned at end of the owner-scoping test).
const NS = 'it054_';
const OWNED_ENTITY_ID = 20540;
const OWNED_SOURCE_ID = 20541;
const OWNED_ODDRN = `//it054/ds/tables/${NS}owned`;

interface WhoAmI {
  identity?: { username?: string | null; permissions?: string[] | null };
  owner?: unknown | null;
  association_request?: unknown | null;
}

test.describe('IT-054 F-011 — Principal-to-Owner resolution under DISABLED', () => {
  test('SUCCESS (whoami): under DISABLED, the current user resolves to a synthetic all-permissions "admin" with NO owner (the phantom-admin / no-owner boundary)', async ({
    request,
  }) => {
    // The wire that the SPA's AppToolbar + every permission-gated affordance reads.
    const res = await request.get(`${BASE}/api/identity/whoami`);
    expect(res.status(), 'GET /api/identity/whoami is anonymously reachable (200) under DISABLED').toBe(200);

    const body = (await res.json()) as WhoAmI;

    // IdentityController.dummyOwner() sets username="admin" (IdentityController.java:32).
    expect(
      body.identity?.username,
      'F-011: under DISABLED, whoami substitutes the dummy identity username "admin" (IdentityController.java:30-33). ' +
        'A change here means whoami stopped synthesising the phantom admin — re-scope the pin.',
    ).toBe('admin');

    // dummyOwner() grants Arrays.asList(Permission.values()) — i.e. EVERY permission. We assert it is
    // a large, non-empty set AND that load-bearing destructive perms are present (the god-mode boundary),
    // without hardcoding the exact count (which grows as new permissions are added to the enum).
    const perms = body.identity?.permissions ?? [];
    expect(
      perms.length,
      'F-011: the synthetic admin holds the FULL permission enum (Permission.values()) — a large set, ' +
        `not a scoped one. Got ${perms.length} permissions.`,
    ).toBeGreaterThan(40);
    for (const destructive of ['DATA_SOURCE_DELETE', 'OWNER_DELETE', 'POLICY_CREATE', 'COLLECTOR_CREATE']) {
      expect(
        perms,
        `F-011: the DISABLED phantom admin holds every permission including the destructive "${destructive}". ` +
          'This is the open-posture boundary: full RBAC authority granted with no authenticated principal.',
      ).toContain(destructive);
    }

    // THE BOUNDARY: god-mode permissions, but NO owner identity. owner is null because
    // getAssociatedOwner is never resolved (getCurrentUser() is empty under DISABLED) and
    // IdentityServiceImpl maps a null-id OwnerPojo to null (IdentityServiceImpl.java:47).
    expect(
      body.owner,
      'F-011: the phantom admin is bound to NO owner (owner:null) — full permission, zero owner-scope. ' +
        'A non-null owner here would mean anonymous DISABLED traffic now attributes to a real owner ' +
        '(an owner-scoping change) — flip the pin.',
    ).toBeNull();
    expect(
      body.association_request,
      'F-011: no pending owner-association either (association_request:null) — the synthetic admin has no owner linkage at all.',
    ).toBeNull();
  });

  test('CORNER (owner-scoping): fetchAssociatedOwner short-circuits at the empty principal — an owner-scoped read returns [] under DISABLED EVEN WHEN owned entities exist in the DB', async () => {
    // Seed a real entity OWNED by a real owner. If the resolver consulted the DB, /my could return
    // this row; it does NOT, because getCurrentUser() is empty before the SQL ever runs. This proves
    // the short-circuit is at the PRINCIPAL step (AuthIdentityProviderImpl.java:51), not the data step.
    await dbQuery(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [OWNED_SOURCE_ID, '//it054/ds', `${NS}ds`],
    );
    await dbQuery(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, '{1}'::int[], 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET entity_class_ids = '{1}'::int[]`,
      [OWNED_ENTITY_ID, OWNED_ODDRN, `${NS}owned`, OWNED_SOURCE_ID],
    );
    // owner + title (schema: ownership.title_id is the role link — see helpers/db.ts seedEntityOwner).
    const ownerSel = await dbQuery<{ id: number }>(`SELECT id FROM owner WHERE name = $1 LIMIT 1`, [`${NS}owner`]);
    const ownerId =
      ownerSel[0]?.id ??
      (await dbQuery<{ id: number }>(`INSERT INTO owner (name) VALUES ($1) RETURNING id`, [`${NS}owner`]))[0].id;
    const titleSel = await dbQuery<{ id: number }>(`SELECT id FROM title WHERE name = $1 LIMIT 1`, [`${NS}title`]);
    const titleId =
      titleSel[0]?.id ??
      (await dbQuery<{ id: number }>(`INSERT INTO title (name) VALUES ($1) RETURNING id`, [`${NS}title`]))[0].id;
    await dbQuery(`DELETE FROM ownership WHERE data_entity_id = $1`, [OWNED_ENTITY_ID]);
    await dbQuery(`INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $3)`, [
      OWNED_ENTITY_ID,
      ownerId,
      titleId,
    ]);

    // Confirm the seed is real (so a [] response cannot be blamed on missing data).
    const owned = await dbQuery<{ n: number }>(`SELECT count(*)::int AS n FROM ownership WHERE data_entity_id = $1`, [
      OWNED_ENTITY_ID,
    ]);
    expect(owned[0].n, 'precondition: the entity is genuinely owned in the DB').toBe(1);

    // The owner-scoped read. listAssociated -> fetchAssociatedOwner().flatMapMany(listByOwner)
    // (DataEntityServiceImpl.java:212-216). Empty principal -> empty Flux -> [].
    const res = await fetch(`${BASE}/api/dataentities/my?page=1&size=100`);
    expect(res.status, 'GET /api/dataentities/my is anonymously reachable (200) under DISABLED').toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(
      Array.isArray(rows) && rows.length,
      'F-011: the owner-scoped /my read returns [] under DISABLED even though a genuinely-owned entity ' +
        'exists — proving fetchAssociatedOwner short-circuits at the empty principal (getCurrentUser is ' +
        'empty, the user_owner_mapping/ownership SQL is never reached). A non-empty result would mean the ' +
        'resolver started attributing anonymous traffic to an owner (an owner-scoping regression).',
    ).toBe(0);

    // cleanup (idempotent — keep the shared external DB clean for sibling specs).
    await dbQuery(`DELETE FROM ownership WHERE data_entity_id = $1`, [OWNED_ENTITY_ID]);
    await dbQuery(`DELETE FROM data_entity WHERE id = $1`, [OWNED_ENTITY_ID]);
    await dbQuery(`DELETE FROM data_source WHERE id = $1`, [OWNED_SOURCE_ID]);
    await dbQuery(`DELETE FROM owner WHERE name = $1`, [`${NS}owner`]);
    await dbQuery(`DELETE FROM title WHERE name = $1`, [`${NS}title`]);
  });
});

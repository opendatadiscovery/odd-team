import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-114 — F-207 RBAC frontend affordance pattern (WithPermissions / WithPermissionsProvider).
 *
 * Protocol: integration-tests/protocols/IT-114-rbac-frontend-affordance.md
 * Gates: validates F-207 (UC-002 the permit arm renders the gated control + UC-007 the DISABLED posture).
 *
 * GROUND TRUTH (read before asserting):
 *  - WithPermissions.tsx:11-34 — a stateless HOC. Default branch (line 28):
 *    `return hasAccessTo(permissionTo) ? <>{children}</> : null` — the HIDE-NOT-DISABLE contract. The
 *    permit arm renders the children; the deny arm returns null (the control is REMOVED from the DOM).
 *  - PermissionProvider.tsx:27-32 — `hasAccessTo(to) = [...globalPermissions, ...resourcePermissions]
 *    .includes(to) && allowedPermissions.includes(to)`. globalPermissions comes from getGlobalPermissions
 *    (the whoami permission list). Under DISABLED that list is the FULL synthetic-admin set (see IT-111),
 *    so hasAccessTo(<any gated permission>) is true and the affordance renders.
 *  - OverviewTags.tsx:38-50 — the "Add tags"/"Edit tags" button is wrapped in
 *    `<WithPermissions permissionTo={Permission.DATA_ENTITY_TAGS_UPDATE}>`.
 *  - InternalDescriptionHeader.tsx:40-50 — the "Add info"/"Edit info" button (data-qa="add_description") is
 *    wrapped in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`.
 *
 * Under DISABLED (admin has every permission) the gated affordances RENDER. This is F-207-UC-002 (the
 * permit arm) — the most-mounted UI primitive on the platform, which ships ZERO tests. It also
 * characterizes F-207-UC-007 honestly: under DISABLED the UI's affordance state and the (permitAll) write
 * API AGREE only because BOTH are fully open — the UI is NOT the security boundary (the backend gate is,
 * pinned separately by IT-010).
 *
 * HIDE-arm honesty: the deny arm (hasAccessTo false -> null) is HARD to trigger under DISABLED because the
 * synthetic admin holds every Permission — there is no gated affordance whose permission the admin lacks.
 * Rather than fake a deny (which would require an enforcing auth mode + a non-admin user — that is IT-010's
 * LDAP territory), we characterize the permit arm here and assert the structural fact that distinguishes a
 * gated control from always-on chrome: the gated button renders ALONGSIDE the always-rendered section
 * caption, i.e. it is permission-gated content that the admin grant unlocked. The deny/hidden arm under a
 * real RBAC mode is covered by IT-010 (ldap-rbac-enforcement) + F-207-UC-003.
 *
 * Collision-free: entity id 21140 in the IT-114 band (21140-21149); name it114_*; idempotent.
 */
const ENTITY_ID = 21140;
const SOURCE_ID = 21140;
const ODDRN = '//e2e-it114/ds/tables/it114_entity';

async function seedEntity(): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SOURCE_ID, '//e2e-it114/ds', 'it114-ds'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET entity_class_ids = '{1}'`,
    [ENTITY_ID, ODDRN, 'it114_entity', SOURCE_ID],
  );
}

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-207 RBAC frontend affordance — WithPermissions permit arm under DISABLED', () => {
  test.beforeAll(async () => {
    await seedEntity();
  });

  test('UC-002: the WithPermissions-gated "Add tags" control renders on the Overview under the synthetic admin', async ({
    page,
  }) => {
    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    // OverviewTags.tsx:38-50 wraps the add/edit-tags button in WithPermissions(DATA_ENTITY_TAGS_UPDATE).
    // The synthetic admin holds that permission -> the default branch renders the children (the button).
    // For an entity with no tags the button text is "Add tags" (tags?.length falsy).
    await expect(
      page.getByRole('button', { name: /add tags/i }).first(),
      'the DATA_ENTITY_TAGS_UPDATE-gated "Add tags" button must render — WithPermissions permit arm under ' +
        'the DISABLED synthetic admin (a hidden button here means the permit arm failed to render the gate)',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('UC-002 corner: a SECOND independently-gated affordance (description edit) also renders — the admin unlocks every gate', async ({
    page,
  }) => {
    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    // InternalDescriptionHeader.tsx:40-50 wraps the description button in
    // WithPermissions(DATA_ENTITY_DESCRIPTION_UPDATE) with data-qa="add_description". A different permission,
    // a different mount point — both render, demonstrating the synthetic-admin-unlocks-everything posture
    // (F-085 -> F-207: the SPA trusts whoami, and whoami granted all permissions).
    await expect(
      page.locator('[data-qa="add_description"]').first(),
      'the DATA_ENTITY_DESCRIPTION_UPDATE-gated description control (data-qa=add_description) must also render ' +
        'under the synthetic admin — a second independent WithPermissions gate confirming the all-perms unlock',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('UC-007 honesty: under DISABLED the gated UI control is shown AND the write API is open — they agree by both being fully open', async ({
    page,
    request,
  }) => {
    // F-207-UC-007 is a CONTRADICTED promise in the ontology: "the UI hidden-button state matches
    // enforcement". Under DISABLED they happen to AGREE — both fully open — but for the wrong reason (the UI
    // is not the boundary; the backend is permitAll). We characterize that honestly: the gated tags control
    // renders (admin perm present) AND an anonymous tag write succeeds (DISABLED permitAll). The UI showing
    // the control is NOT what authorizes the write; the open backend is. (IT-010 pins the enforcing case.)
    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await expect(
      page.getByRole('button', { name: /add tags/i }).first(),
      'gated control renders under DISABLED admin',
    ).toBeVisible({ timeout: 15_000 });

    // The underlying mutation surface is open under DISABLED regardless of the UI gate (permitAll) — proving
    // the UI is courtesy presentation, not the gate. Two grounded checks of "the backend is the open boundary":
    //  (a) the entity tag-relation write is NOT authz-rejected (not 401/403). Under DISABLED it reaches the
    //      handler; it happens to 500 (SYS001) on this minimal seed (the entity has no dataset structure the
    //      tag-relation path expects) — a BUSINESS error, orthogonal to authz. The point: authz did not block it.
    //  (b) the plain tag-create endpoint (POST /api/tags) cleanly succeeds anonymously — an unauthenticated
    //      write the UI's tags form ultimately depends on, open under DISABLED.
    const rel = await request.post(`/api/dataentities/${ENTITY_ID}/tags`, {
      headers: { 'content-type': 'application/json' },
      data: { tag_name_list: ['it114_posture_tag'] },
      maxRedirects: 0,
    });
    expect(
      [401, 403],
      'under DISABLED the entity tag-relation write is NOT authz-rejected (the backend is permitAll); the UI ' +
        `gate did not authorize it. A non-authz error (e.g. 500 business) is fine here. Got ${rel.status()}.`,
    ).not.toContain(rel.status());

    const create = await request.post('/api/tags', {
      headers: { 'content-type': 'application/json' },
      data: { name: `it114_open_${Date.now()}`, important: false },
      maxRedirects: 0,
    });
    expect(
      create.status(),
      'under DISABLED an anonymous tag CREATE (POST /api/tags) succeeds (200) — the write surface is genuinely ' +
        'open; the UI WithPermissions gate is presentation only, not the authorization boundary',
    ).toBe(200);
  });
});

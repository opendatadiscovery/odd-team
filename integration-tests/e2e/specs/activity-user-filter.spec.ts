import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-129 — F-021 / F-196 Activity actor filters + dual-name rows (#1657 / CTRIB-010 v2).
 *
 * Protocol: integration-tests/protocols/IT-129-activity-user-filter.md
 * Gates: validates F-021 (global page) + F-196 (per-entity tab); regresses LSN-020. The backend
 *        churn-invariance is locked by the unit test ReactiveActivityRepositoryActorFilterTest; this is
 *        the user-facing half (LSN-031).
 *
 * GROUND TRUTH (read before assert) — the v2 model makes three axes explicit (ODD User vs Owner):
 *  - "Owner" (data-qa owner_filter, ownerIds) = owner of the asset (OWNERSHIP).
 *  - "Made by (owner)" (data-qa made_by_owner_filter, user_ids) = the actor's CURRENT owner via the
 *    mutable user_owner_mapping; dropdown fed by GET /api/owners.
 *  - "Made by (user)" (data-qa made_by_user_filter, usernames) = the actor's external username
 *    (activity.created_by), immutable; dropdown fed by GET /api/activity/users; works for unmapped users.
 *  - The action row shows BOTH names: the immutable username AND the current owner name ("alice as Owner
 *    X") — ActivityActorLabel. The wire is snake_case; we intercept it and assert on the rendered DOM.
 *  - created_by NOT NULL + is_system_event=false -> the row renders the actor; created_at=NOW() lands in
 *    the live partition AND the default UI window (now-5d..now+1d).
 *
 * Ids: owner 21280, entities 21281-21282 (oddrn //e2e-it129/, names it129_*). Idempotent.
 */

const OWNER_ID = 21280;
const OWNER_NAME = 'it129_owner_alpha';
const ENT_A = 21281;
const NAME_A = 'it129_entity_a';
const ENT_B = 21282;
const NAME_B = 'it129_entity_b';
const ALICE = 'it129_alice'; // mapped to it129_owner_alpha
const BOB = 'it129_bob'; // NO owner mapping — the discriminator

async function seedEntity(id: number, name: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, `//e2e-it129/db-${id}`, `e2e-it129-${id}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name`,
    [id, `//e2e-it129/db-${id}/tables/${name}`, name]
  );
}

async function seedActivity(entityId: number, createdBy: string): Promise<void> {
  await dbQuery('DELETE FROM activity WHERE data_entity_id = $1', [entityId]);
  await dbQuery(
    `INSERT INTO activity
       (data_entity_id, event_type, old_state, new_state, is_system_event, created_at, created_by)
     VALUES ($1, 'DESCRIPTION_UPDATED', '{"description":""}'::jsonb,
             '{"description":"changed by ${createdBy}"}'::jsonb, false, NOW(), $2)`,
    [entityId, createdBy]
  );
}

async function cleanup(): Promise<void> {
  for (const id of [ENT_A, ENT_B]) {
    await dbQuery('DELETE FROM activity WHERE data_entity_id = $1', [id]);
    await dbQuery('DELETE FROM data_entity WHERE id = $1', [id]);
    await dbQuery('DELETE FROM data_source WHERE id = $1', [id]);
  }
  await dbQuery(`DELETE FROM user_owner_mapping WHERE oidc_username LIKE 'it129_%'`);
  await dbQuery('DELETE FROM owner WHERE id = $1', [OWNER_ID]);
}

function activityQuery(extra: Record<string, string | number> = {}): string {
  const begin = new Date();
  begin.setDate(begin.getDate() - 5);
  begin.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  const params: Record<string, string | number> = {
    beginDate: begin.getTime(),
    endDate: end.getTime(),
    size: 30,
    type: 'ALL',
    ...extra,
  };
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

const usersFetch = (page: Page) =>
  page.waitForResponse(
    r => /\/api\/activity\/users(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok()
  );

const ownersFetch = (page: Page) =>
  page.waitForResponse(
    r => /\/api\/owners(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok()
  );

async function openFilterAndSearch(page: Page, dataQa: string, term: string): Promise<void> {
  const input = page.locator(`[data-qa='${dataQa}']`).getByRole('combobox');
  await input.click();
  await input.fill(term);
}

test.describe('F-021/F-196 Activity actor filters + dual-name rows (#1657 v2)', () => {
  test.beforeAll(async () => {
    await cleanup();
    await dbQuery(
      `INSERT INTO owner (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [OWNER_ID, OWNER_NAME]
    );
    await dbQuery(
      `INSERT INTO user_owner_mapping (owner_id, oidc_username, provider, deleted_at)
       VALUES ($1, $2, 'INTERNAL', NULL)`,
      [OWNER_ID, ALICE]
    );
    await seedEntity(ENT_A, NAME_A);
    await seedEntity(ENT_B, NAME_B);
    await seedActivity(ENT_A, ALICE); // alice IS mapped to an owner
    await seedActivity(ENT_B, BOB); // bob has NO owner mapping
  });

  test.afterAll(async () => {
    await cleanup();
  });

  // All three actor/asset filters are exposed (was two ambiguous ones pre-v2).
  test('the global page exposes Owner + Made by (owner) + Made by (user) filters', async ({ page }) => {
    await page.goto(`/activity?${activityQuery()}`);
    await page.waitForResponse(r => /\/api\/activity(\?|$)/.test(r.url()) && r.ok());

    await expect(page.locator("[data-qa='owner_filter']")).toBeVisible();
    await expect(page.locator("[data-qa='made_by_owner_filter']")).toBeVisible();
    await expect(page.locator("[data-qa='made_by_user_filter']")).toBeVisible();
  });

  // "Made by (user)" is fed by /api/activity/users and lists audit usernames — INCLUDING bob, who has no
  // owner association. Pre-fix the only user-ish filter was owner-fed and bob could not appear.
  test('"Made by (user)" lists audit actors, including a user with no owner association', async ({
    page,
  }) => {
    await page.goto(`/activity?${activityQuery()}`);
    await page.waitForResponse(r => /\/api\/activity(\?|$)/.test(r.url()) && r.ok());

    const fetched = usersFetch(page);
    await openFilterAndSearch(page, 'made_by_user_filter', 'it129');
    await fetched; // proves the dropdown source is /api/activity/users, not /api/owners

    const listbox = page.locator('ul[role="listbox"]');
    await expect(listbox.getByText(ALICE, { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(
      listbox.getByText(BOB, { exact: false }),
      'an audit actor with no owner association must be listable (the #1657 fix)'
    ).toBeVisible({ timeout: 10_000 });
  });

  // Selecting a username narrows the feed to THAT actor (usernames= on the wire, immutable axis).
  test('selecting "Made by (user)" filters the feed to that actor only', async ({ page }) => {
    await page.goto(`/activity?${activityQuery()}`);
    await page.waitForResponse(r => /\/api\/activity(\?|$)/.test(r.url()) && r.ok());

    const usersResp = usersFetch(page);
    await openFilterAndSearch(page, 'made_by_user_filter', BOB);
    await usersResp;

    const filtered = page.waitForResponse(
      r =>
        /\/api\/activity(\?|$)/.test(r.url()) &&
        r.url().includes('usernames') &&
        r.url().includes(BOB) &&
        !r.url().includes('user_ids') &&
        r.request().method() === 'GET' &&
        r.ok()
    );
    await page.locator('ul[role="listbox"] li', { hasText: BOB }).first().click();
    await filtered; // the wire carries usernames=, not user_ids=

    await expect(page.getByText(NAME_B).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.getByText(NAME_A)).toHaveCount(0);
  });

  // "Made by (owner)" is the actor's-current-owner axis (user_ids on the wire) — it still works; its
  // dropdown lists Owners. Selecting owner_alpha returns alice's event (alice is mapped to owner_alpha).
  test('selecting "Made by (owner)" filters by the actor\'s current owner (user_ids axis)', async ({
    page,
  }) => {
    await page.goto(`/activity?${activityQuery()}`);
    await page.waitForResponse(r => /\/api\/activity(\?|$)/.test(r.url()) && r.ok());

    const ownersResp = ownersFetch(page);
    await openFilterAndSearch(page, 'made_by_owner_filter', OWNER_NAME);
    await ownersResp; // the dropdown is Owner-fed (GET /api/owners), not /api/activity/users

    const filtered = page.waitForResponse(
      r =>
        /\/api\/activity(\?|$)/.test(r.url()) &&
        r.url().includes('user_ids') &&
        r.request().method() === 'GET' &&
        r.ok()
    );
    await page.locator('ul[role="listbox"] li', { hasText: OWNER_NAME }).first().click();
    await filtered; // the wire carries user_ids= (the actor's-owner axis)

    await expect(page.getByText(NAME_A).first()).toBeVisible({ timeout: 10_000 });
  });

  // The action row shows BOTH identities: the immutable username AND the current owner name.
  test('an action row shows both the username and the current owner name', async ({ page }) => {
    await page.goto(`/activity?${activityQuery()}`);
    await page.waitForResponse(r => /\/api\/activity(\?|$)/.test(r.url()) && r.ok());

    // alice authored on entity A and is mapped to owner_alpha -> her row carries BOTH names.
    await expect(page.getByText(NAME_A).first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(ALICE, { exact: false }).first(),
      'the immutable external username must render on the row'
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(OWNER_NAME, { exact: false }).first(),
      "the actor's current owner name must ALSO render on the row (dual-name)"
    ).toBeVisible({ timeout: 10_000 });
  });

  // The per-entity Activity tab exposes the same two actor filters (no asset-Owner — the entity is fixed).
  test('the per-entity Activity tab exposes Made by (owner) + Made by (user)', async ({ page }) => {
    await page.goto(`/dataentities/${ENT_A}/activity?${activityQuery()}`);
    await page.waitForResponse(
      r => /\/api\/dataentities\/\d+\/activity(\?|$)/.test(r.url()) && r.ok()
    );

    await expect(page.locator("[data-qa='made_by_owner_filter']")).toBeVisible();
    await expect(page.locator("[data-qa='made_by_user_filter']")).toBeVisible();

    const fetched = usersFetch(page);
    await openFilterAndSearch(page, 'made_by_user_filter', 'it129');
    await fetched;
    await expect(
      page.locator('ul[role="listbox"]').getByText(ALICE, { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });
});

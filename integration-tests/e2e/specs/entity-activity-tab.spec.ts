import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-089 — F-196 Per-Entity Activity tab: /dataentities/{id}/activity surfaces the audit
 * trail scoped to THAT entity only (no cross-entity leakage), and the Event-type filter narrows it.
 *
 * Protocol: integration-tests/protocols/IT-089-entity-activity-tab.md
 * Gates: validates F-196 (F-196-UC-1 entity-id-scoped read; F-196-UC-9 event-type narrows;
 *        F-196-UC-10 the core happy-path — a change action shows on the entity's Activity tab).
 *        Sibling to IT-088 (F-021 global feed); distinct backend endpoint.
 *
 * GROUND TRUTH (read before assert):
 *  - Route: DataEntityDetailsRoutes.tsx:105 mounts `<DataEntityActivity />` at `activity` (BARE —
 *    no RestrictedRoute / WithPermissionsProvider). Tab strip: DataEntityDetailsTabs.tsx:91-94.
 *  - Read path: ReactiveActivityRepositoryImpl.findDataEntityActivities adds DATA_ENTITY.ID.eq(
 *    dataEntityId) (line 140) on top of the [beginDate,endDate) + optional eventType conditions —
 *    so the result is strictly scoped to the one entity. The per-entity UI (DataEntityActivity/
 *    Filters) exposes only Calendar + Event type + User (NO type-tabs axis).
 *  - ActivityItem renders the entity external_name (ActivityItem.tsx) + the event field. Same
 *    UTC-naive created_at + snake_case-wire facts as IT-088.
 *
 * Ids: 20890-20891 (oddrn //e2e-it089/, names it089_*). Idempotent.
 */
const ENT_A = 20890;
const NAME_A = 'it089_scoped_entity';
const ENT_B = 20891;
const NAME_B = 'it089_other_entity';

// The description/business-name payload strings live behind a collapsed "Show details" toggle
// (StringActivityField.isDetailsOpen defaults false), so we do NOT assert on them. The robust,
// default-visible discriminators are: the entity external_name (ActivityItem.tsx:53, always shown)
// and the ActivityFieldHeader label "<activityName> was <eventType>" — "Description" for a
// DESCRIPTION_UPDATED row, "Business name" for a BUSINESS_NAME_UPDATED row (ActivityItem.tsx:107/115).
const HDR_DESCRIPTION = 'Description';
const HDR_BUSINESS_NAME = 'Business name';
const PAYLOAD_DESC = 'it089 description body';
const PAYLOAD_BIZ = 'it089_new_business_name';
const PAYLOAD_OTHER = 'it089 OTHER entity description'; // event on entity B

async function seedEntity(id: number, name: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, `//e2e-it089/db-${id}`, `e2e-it089-${id}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [id, `//e2e-it089/db-${id}/tables/${name}`, name]
  );
}

async function seedActivity(id: number, eventType: string, payload: string): Promise<void> {
  const newState =
    eventType === 'BUSINESS_NAME_UPDATED'
      ? JSON.stringify({ internal_name: payload })
      : JSON.stringify({ description: payload });
  await dbQuery(
    `INSERT INTO activity
       (data_entity_id, event_type, old_state, new_state, is_system_event, created_at, created_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, true, NOW(), NULL)`,
    [id, eventType, JSON.stringify({ description: '' }), newState]
  );
}

async function cleanup(): Promise<void> {
  for (const id of [ENT_A, ENT_B]) {
    await dbQuery('DELETE FROM activity WHERE data_entity_id = $1', [id]);
    await dbQuery('DELETE FROM data_entity WHERE id = $1', [id]);
    await dbQuery('DELETE FROM data_source WHERE id = $1', [id]);
  }
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

const entityActivityFetch = (page: Page, id: number) =>
  page.waitForResponse(
    r =>
      new RegExp(`/api/dataentities/${id}/activity`).test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok()
  );

test.describe('F-196 Per-entity Activity tab — entity-scoped audit trail', () => {
  test.beforeAll(async () => {
    await cleanup();
    await seedEntity(ENT_A, NAME_A);
    await seedEntity(ENT_B, NAME_B);
    // entity A: two events of distinct types (the happy-path change record).
    await seedActivity(ENT_A, 'DESCRIPTION_UPDATED', PAYLOAD_DESC);
    await seedActivity(ENT_A, 'BUSINESS_NAME_UPDATED', PAYLOAD_BIZ);
    // entity B: an event that must NOT appear on entity A's tab (scope guard).
    await seedActivity(ENT_B, 'DESCRIPTION_UPDATED', PAYLOAD_OTHER);
  });

  test.afterAll(async () => {
    await cleanup();
  });

  // F-196-UC-1 / UC-10 (confirmed): each entity's Activity tab shows ONLY that entity's own
  // change events — the endpoint adds DATA_ENTITY.ID.eq(dataEntityId), so events never cross
  // entities. SUCCESS path proven by the default-visible field-header labels, scoped to the
  // results list (the per-entity ActivityItem does NOT print the entity name — the entity is
  // implied — so the discriminator is the event-type header, not the name). The detail-page
  // chrome carries its own "Business name" affordance, hence the data-qa scoping.
  //
  // Entity A has BOTH a DESCRIPTION_UPDATED and a BUSINESS_NAME_UPDATED event; entity B has ONLY
  // a DESCRIPTION_UPDATED event. So: A's tab shows both headers; B's tab shows "Description" but
  // NOT "Business name" — proving A's business-name event did not leak onto B's entity-scoped tab.
  test("each entity's Activity tab is scoped to that entity's own events", async ({ page }) => {
    // --- entity A: the complete per-entity change record (both event headers render) ---
    let fetched = entityActivityFetch(page, ENT_A);
    await page.goto(`/dataentities/${ENT_A}/activity?${activityQuery()}`);
    await fetched;

    const listA = page.locator("[data-qa='activity_results_list']");
    await expect(listA, "entity A's activity results list must render").toBeVisible({
      timeout: 10_000,
    });
    await expect(
      listA.getByText(HDR_DESCRIPTION).first(),
      "entity A's tab must render the DESCRIPTION_UPDATED row header"
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      listA.getByText(HDR_BUSINESS_NAME).first(),
      "entity A's tab must render the BUSINESS_NAME_UPDATED row header"
    ).toBeVisible({ timeout: 10_000 });

    // --- entity B: scoped to its OWN single event (Description); A's bizname event must NOT leak ---
    fetched = entityActivityFetch(page, ENT_B);
    await page.goto(`/dataentities/${ENT_B}/activity?${activityQuery()}`);
    await fetched;

    const listB = page.locator("[data-qa='activity_results_list']");
    await expect(listB, "entity B's activity results list must render").toBeVisible({
      timeout: 10_000,
    });
    await expect(
      listB.getByText(HDR_DESCRIPTION).first(),
      "entity B's tab must render its own DESCRIPTION_UPDATED row"
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await expect(
      listB.getByText(HDR_BUSINESS_NAME),
      "entity A's BUSINESS_NAME_UPDATED event must NOT leak onto entity B's entity-scoped tab"
    ).toHaveCount(0);
  });

  // F-196-UC-9 (confirmed): the Event-type filter narrows the per-entity tab.
  test('the Event-type filter narrows the per-entity tab', async ({ page }) => {
    const fetched = entityActivityFetch(page, ENT_A);
    await page.goto(
      `/dataentities/${ENT_A}/activity?${activityQuery({ eventType: 'DESCRIPTION_UPDATED' })}`
    );
    await fetched;

    const list = page.locator("[data-qa='activity_results_list']");
    await expect(
      list.getByText(HDR_DESCRIPTION).first(),
      'the DESCRIPTION_UPDATED row must remain after filtering for it'
    ).toBeVisible({ timeout: 10_000 });

    // the BUSINESS_NAME_UPDATED event on the SAME entity is narrowed out by the event-type filter.
    // Scoped to the results list so the entity-header "Business name" affordance is excluded.
    await page.waitForTimeout(1000);
    await expect(
      list.getByText(HDR_BUSINESS_NAME),
      'the BUSINESS_NAME_UPDATED row must be narrowed out by eventType=DESCRIPTION_UPDATED'
    ).toHaveCount(0);
  });
});

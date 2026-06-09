import { test, expect, type Page } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-126 — F-021 Activity Feed tag+owner fan-out (PLT-176 / issue #1744 / PR #1745).
 *
 * The user-facing symptom: filter the global Activity feed by tag AND owner on an entity that
 * carries several of each. The list query LEFT-JOINs the one-to-many tag_to_data_entity and
 * ownership tables with no DISTINCT, so each activity is returned N tags x M owners times; the
 * count endpoint inflates the "All" badge by the same factor while the front end de-duplicates
 * the list by id — so the badge disagrees with the visible cards. The EXISTS-semi-join fix
 * (PR #1745) makes the list carry one row per event and the badge equal the distinct list.
 *
 * RED against the PUBLISHED image (ghcr ...:latest, still buggy); GREEN against the branch-built
 * image. Per LSN-032 this suite MUST run against odd-platform:contrib-* (ODD_PLATFORM_IMAGE), not
 * the published image — else it green-washes the fix.
 *
 * validates F-021 ; regresses PLT-176
 * Protocol: integration-tests/protocols/IT-126-activity-tag-owner-fanout.md
 *
 * Ids 20890-20895 (oddrn //e2e-it126/, names it126_*). Idempotent.
 */

const ENT = 20890;
const SRC = 20890;
const TAG1 = 20891;
const TAG2 = 20892;
const OWN1 = 20893;
const OWN2 = 20894;
const TITLE = 20895;
const NAME = 'it126_fanout_entity';

async function cleanup(): Promise<void> {
  await dbQuery('DELETE FROM activity WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM ownership WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM data_entity WHERE id = $1', [ENT]);
  await dbQuery('DELETE FROM data_source WHERE id = $1', [SRC]);
  await dbQuery('DELETE FROM tag WHERE id = ANY($1::bigint[])', [[TAG1, TAG2]]);
  await dbQuery('DELETE FROM ownership WHERE owner_id = ANY($1::bigint[])', [[OWN1, OWN2]]);
  await dbQuery('DELETE FROM owner WHERE id = ANY($1::bigint[])', [[OWN1, OWN2]]);
  await dbQuery('DELETE FROM title WHERE id = $1', [TITLE]);
}

// One entity carrying 2 matching tags + 2 matching owners + ONE activity. The query under test
// fans that single activity out to 2x2 = 4 rows on the unfixed backend.
async function seed(): Promise<void> {
  await cleanup();
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SRC, `//e2e-it126/db-${SRC}`, `e2e-it126-${SRC}`]
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $1, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [ENT, `//e2e-it126/db-${ENT}/tables/${NAME}`, NAME]
  );
  // 2 tags + both linked to the entity
  await dbQuery(
    `INSERT INTO tag (id, name, important) VALUES ($1, $2, false), ($3, $4, false)
     ON CONFLICT (id) DO NOTHING`,
    [TAG1, 'it126_tag_a', TAG2, 'it126_tag_b']
  );
  await dbQuery(
    `INSERT INTO tag_to_data_entity (tag_id, data_entity_id) VALUES ($1, $3), ($2, $3)
     ON CONFLICT DO NOTHING`,
    [TAG1, TAG2, ENT]
  );
  // title + 2 owners + both linked to the entity (ownership carries data_entity_id)
  await dbQuery(`INSERT INTO title (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    TITLE,
    'it126_title',
  ]);
  await dbQuery(
    `INSERT INTO owner (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
    [OWN1, 'it126_owner_a', OWN2, 'it126_owner_b']
  );
  await dbQuery(
    `INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $4), ($1, $3, $4)`,
    [ENT, OWN1, OWN2, TITLE]
  );
  // ONE activity on the entity, created_at = NOW() (in the live partition AND the default UI window)
  await dbQuery(
    `INSERT INTO activity
       (data_entity_id, event_type, old_state, new_state, is_system_event, created_at, created_by)
     VALUES ($1, 'DESCRIPTION_UPDATED', '{"description":""}'::jsonb,
             '{"description":"it126 changed the description"}'::jsonb, true, NOW(), NULL)`,
    [ENT]
  );
}

// Drive the global Activity page with BOTH the tag and the owner filter (the audit "narrow it
// down" path). camelCase array params as the FE route reads them; the generated client maps these
// to the snake_case tag_ids / owner_ids on the wire.
function activityUrl(): string {
  const begin = new Date();
  begin.setDate(begin.getDate() - 5);
  begin.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return (
    `/activity?beginDate=${begin.getTime()}&endDate=${end.getTime()}&size=30&type=ALL` +
    `&tagIds[]=${TAG1},${TAG2}&ownerIds[]=${OWN1},${OWN2}`
  );
}

const isList = (u: string) => /\/api\/activity(\?|$)/.test(u) && !/\/counts/.test(u);
const isCounts = (u: string) => /\/api\/activity\/counts/.test(u);

test.describe('F-021 Activity Feed — tag+owner fan-out (PLT-176)', () => {
  test.beforeAll(seed);
  test.afterAll(cleanup);

  test('a tag+owner-filtered feed returns one row per event and a matching count badge', async ({
    page,
  }: {
    page: Page;
  }) => {
    const listP = page.waitForResponse(
      r => isList(r.url()) && r.request().method() === 'GET',
      { timeout: 20_000 }
    );
    const countsP = page
      .waitForResponse(r => isCounts(r.url()) && r.request().method() === 'GET', { timeout: 20_000 })
      .catch(() => null);

    await page.goto(activityUrl());
    const listResp = await listP;
    const countsResp = await countsP;

    // the filters actually reached the backend (no false-pass on an unfiltered feed)
    expect(listResp.url(), 'the list request must carry tag_ids + owner_ids').toMatch(/tag_ids=/);
    expect(listResp.url(), 'the list request must carry tag_ids + owner_ids').toMatch(/owner_ids=/);
    expect(listResp.ok(), `GET /api/activity must be 2xx (was ${listResp.status()})`).toBeTruthy();

    const body: unknown = await listResp.json();
    const rows: Array<{ id: number }> = Array.isArray(body)
      ? (body as Array<{ id: number }>)
      : (((body as Record<string, unknown>).items ??
          (body as Record<string, unknown>).data ??
          []) as Array<{ id: number }>);
    const ids = rows.map(a => a.id);
    const distinct = new Set(ids).size;

    // the seeded activity is present (the filter matched the entity's 2 tags + 2 owners)
    expect(distinct, 'the seeded activity must appear under the tag+owner filter').toBeGreaterThanOrEqual(1);

    // THE FIX: the list must carry ONE row per event, not N tags x M owners duplicates.
    // RED (published image): 4 rows / 1 distinct. GREEN (branch image): 1 / 1.
    expect(ids.length, 'the tag+owner filter must NOT fan a single activity into N*M duplicate rows').toBe(
      distinct
    );

    // the user-facing symptom: the "All" count badge (total_count) must equal the distinct list the
    // user sees — when the counts request carried the same filters.
    if (countsResp && isCounts(countsResp.url()) && /tag_ids=/.test(countsResp.url()) && /owner_ids=/.test(countsResp.url())) {
      const counts = (await countsResp.json()) as { total_count?: number };
      expect(
        counts.total_count,
        'the "All" badge (GET /api/activity/counts.total_count) must equal the distinct events shown'
      ).toBe(distinct);
    }

    // the UI actually rendered the entity's event (the browser drove the real flow end to end)
    await expect(
      page.getByText(NAME).first(),
      'the filtered feed must render the seeded entity'
    ).toBeVisible({ timeout: 10_000 });
  });
});

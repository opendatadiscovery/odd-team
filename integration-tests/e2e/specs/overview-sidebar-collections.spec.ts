import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-072 — F-179 Overview-tab sidebar collections (Tags / Terms / Groups).
 *
 * Protocol: integration-tests/protocols/IT-072-overview-sidebar-collections.md
 * Gates: validates F-179 (the entity Overview right-sidebar composes the Tags, Dictionary-terms,
 *        and Data-entity-groups collection panels, each rendering its members).
 *
 * The entity Overview (DataEntityDetails/Overview/Overview.tsx) lays out a right column (xs={3})
 * stacking OverviewGeneral + OverviewGroups ("Data entity groups") + OverviewTags ("Tags") +
 * OverviewTerms ("Dictionary terms"). Each panel is data-driven: it renders its members' names
 * verbatim, or a "Not created"/empty branch when absent. F-179's drift (slice-then-sort ordering)
 * lives in the >visibleLimit overflow path; THIS test pins the user-facing promise the panels
 * EXIST and render their members when the entity has a tag + a term + a group — the sidebar
 * collections are composed, not missing. (Ordering correctness for >20 members is a separate
 * F-179 concern owned by the contradicted UC-1/2/4/5 promises.)
 *
 * Per-spec ids: 20720-20729. The entity is seeded with ONE tag + ONE term + ONE group membership,
 * each via the verified per-surface SQL (tag+tag_to_data_entity; term+data_entity_to_term;
 * group_entity_relations by oddrn), replicated against this spec's own ids.
 */
const SRC = 20720;
const ENT = 20721;
const GROUP_ENT = 20722;
const ENT_ODDRN = '//e2e-it072/db/tables/it072_tbl';
const GROUP_ODDRN = '//e2e-it072/db/groups/it072_group';

const TAG = 'IT072SidebarTag';
const TERM = 'IT072 Sidebar Term';
const GROUP = 'IT072SidebarGroup';
const NS = 'it072-ns';

async function seedEntityWithCollections(): Promise<void> {
  // base source + entity (DATA_SET so it renders a normal detail Overview)
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SRC, '//e2e-it072/db', 'it072-src'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, $5::int[], 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = EXCLUDED.entity_class_ids`,
    [ENT, ENT_ODDRN, 'it072_tbl', SRC, [1]],
  );

  // --- tag (tag + tag_to_data_entity) ---
  const tagRows = await dbQuery<{ id: number }>('SELECT id FROM tag WHERE name = $1 LIMIT 1', [TAG]);
  const tagId =
    tagRows[0]?.id ??
    (await dbQuery<{ id: number }>('INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id', [TAG]))[0].id;
  await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1 AND tag_id = $2', [ENT, tagId]);
  await dbQuery('INSERT INTO tag_to_data_entity (tag_id, data_entity_id, external) VALUES ($1, $2, false)', [
    tagId,
    ENT,
  ]);

  // --- term (namespace + term + data_entity_to_term) ---
  const nsRows = await dbQuery<{ id: number }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [NS]);
  const nsId =
    nsRows[0]?.id ??
    (await dbQuery<{ id: number }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [NS]))[0].id;
  const termRows = await dbQuery<{ id: number }>(
    'SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1',
    [TERM, nsId],
  );
  const termId =
    termRows[0]?.id ??
    (
      await dbQuery<{ id: number }>(
        'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
        [TERM, 'IT072 sidebar term', nsId],
      )
    )[0].id;
  await dbQuery('DELETE FROM data_entity_to_term WHERE data_entity_id = $1 AND term_id = $2', [ENT, termId]);
  await dbQuery(
    'INSERT INTO data_entity_to_term (data_entity_id, term_id, is_description_link) VALUES ($1, $2, false)',
    [ENT, termId],
  );

  // --- group membership (group is itself a DEG data_entity; link via group_entity_relations) ---
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 17, $5::int[], 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, oddrn = EXCLUDED.oddrn, entity_class_ids = EXCLUDED.entity_class_ids`,
    [GROUP_ENT, GROUP_ODDRN, GROUP, SRC, [8]],
  );
  await dbQuery('DELETE FROM group_entity_relations WHERE group_oddrn = $1 AND data_entity_oddrn = $2', [
    GROUP_ODDRN,
    ENT_ODDRN,
  ]);
  await dbQuery(
    'INSERT INTO group_entity_relations (group_oddrn, data_entity_oddrn, is_deleted) VALUES ($1, $2, false)',
    [GROUP_ODDRN, ENT_ODDRN],
  );
}

async function seedBareEntity(): Promise<void> {
  // entity exists but with NO tag / term / group — the negative state
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SRC, '//e2e-it072/db', 'it072-src'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, $5::int[], 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = EXCLUDED.entity_class_ids`,
    [ENT, ENT_ODDRN, 'it072_tbl', SRC, [1]],
  );
  await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM data_entity_to_term WHERE data_entity_id = $1', [ENT]);
  await dbQuery('DELETE FROM group_entity_relations WHERE data_entity_oddrn = $1', [ENT_ODDRN]);
}

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENT}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-179 Overview sidebar collections — Tags / Terms / Groups', () => {
  test('an entity with a tag + term + group renders all three sidebar collections', async ({ page }) => {
    await seedEntityWithCollections();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENT}/overview`);
    await detail;

    // the three collection panels are composed (their section headings render)…
    await expect(page.getByText('Tags', { exact: true }).first(), 'Tags panel heading').toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText('Dictionary terms', { exact: true }).first(),
      'Terms panel heading',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Data entity groups', { exact: true }).first(),
      'Groups panel heading',
    ).toBeVisible({ timeout: 10_000 });

    // …and each panel renders its member verbatim.
    await expect(page.getByText(TAG).first(), 'the assigned tag must render in the Tags panel').toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(TERM).first(), 'the linked term must render in the Terms panel').toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(GROUP).first(),
      'the group membership must render in the Groups panel',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no tag/term/group renders none of those members (negative)', async ({ page }) => {
    await seedBareEntity();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENT}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(TAG).filter({ visible: true }),
      'with no tag the tag name must not render',
    ).toHaveCount(0);
    await expect(
      page.getByText(TERM).filter({ visible: true }),
      'with no term the term name must not render',
    ).toHaveCount(0);
    await expect(
      page.getByText(GROUP).filter({ visible: true }),
      'with no group the group name must not render',
    ).toHaveCount(0);
  });
});

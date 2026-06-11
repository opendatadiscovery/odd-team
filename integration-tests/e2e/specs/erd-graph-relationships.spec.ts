import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-077 — F-037 ERD/Graph Relationships Listing: the Data Modelling → Relationships list
 * page renders the documented two-column source/target contract, applies the catalog's
 * default visibility predicates, survives a mistyped ?type= deep-link, and the graph
 * relationship detail labels its endpoints correctly.
 *
 * Protocol: integration-tests/protocols/IT-077-erd-graph-relationships.md
 * Gates: validates F-037; regresses PLT-056 (#1752 Defects 1, 2, 4 + the graph label swap).
 *
 * RE-GROUNDED 2026-06-12 with the #1752 fix (CTRIB-006) — LSN-029 flip-on-fix:
 *   - H-002 was a GREEN characterization pin of the Target-column copy-paste bug
 *     (RelationshipsListItem.tsx:73-81 rendered item.sourceDataEntity in BOTH columns; the
 *     2026-06-07 pin asserted source×2 + target×0). The fix makes the Target cell read
 *     item.targetDataEntity — H-002 now asserts the CORRECT contract (source×1 + target×1)
 *     and is the regression guard. RED on any pre-fix SUT (verified vs ODD_SUT=ref:main).
 *   - NEW: the list hides soft-DELETED / exclude_from_search relationship entities
 *     (#1752 Defect 2 — the repository now applies the getDataEntityDefaultConditions trio).
 *   - NEW: ?type=foo degrades to the ALL view (validated fallback in Relationships.tsx +
 *     RelationshipsTabs.tsx) instead of a dead empty screen (#1752 Defect 4).
 *   - NEW: the graph-relationship overview renders "Source:" = the source dataset and
 *     "Target:" = the target dataset (GraphRelationship.tsx labels were swapped).
 *   - GREEN-LOCKS (#1752 Defect 5, unchanged behaviour now documented in the OpenAPI spec):
 *     the list id IS the {relationship_id} path param; the details payload's
 *     erd_relationship_id does NOT round-trip (404).
 *
 * SEED (own ids, namespace //e2e-it077/, names it077_*; idempotent):
 *   - 20771 `it077_rel` (ERD, healthy) + DISTINCT source 20772 `it077_source` / target
 *     20773 `it077_target` + relationships row + erd_relationship_details row.
 *   - 20774 `it077_hidden_deleted` (status=5 DELETED) + 20775 `it077_hidden_excluded`
 *     (exclude_from_search=true) — must NOT be listed.
 *   - 20776 `it077_graph` (GRAPH, type 26) + relationships row (type GRAPH) +
 *     graph_relationship row (is_directed) — drives the overview label check.
 */
const SRC = 20770;
const REL = 20771; // the healthy ERD relationship-class data_entity (the list row)
const S = 20772; // source dataset
const T = 20773; // target dataset
const REL_DELETED = 20774; // soft-DELETED relationship entity — must be hidden
const REL_EXCLUDED = 20775; // exclude_from_search relationship entity — must be hidden
const REL_GRAPH = 20776; // GRAPH relationship entity (type 26) — drives the detail labels

const DS_ODDRN = '//e2e-it077/db';
const REL_ODDRN = '//e2e-it077/db/relationships/it077_rel';
const S_ODDRN = '//e2e-it077/db/tables/it077_source';
const T_ODDRN = '//e2e-it077/db/tables/it077_target';
const REL_DELETED_ODDRN = '//e2e-it077/db/relationships/it077_hidden_deleted';
const REL_EXCLUDED_ODDRN = '//e2e-it077/db/relationships/it077_hidden_excluded';
const REL_GRAPH_ODDRN = '//e2e-it077/db/relationships/it077_graph';

const relationshipsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(r => r.url().includes('/api/relationships') && r.request().method() === 'GET' && r.ok());

async function seedEntity(id: number, oddrn: string, name: string, typeId: number, classIds: string): Promise<void> {
  await dbQuery(
    `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,
                              hollow,status,exclude_from_search,source_created_at,source_updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,0,false,1,false,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn,
       entity_class_ids=EXCLUDED.entity_class_ids, type_id=EXCLUDED.type_id,
       hollow=false, status=1, exclude_from_search=false`,
    [id, oddrn, name, SRC, typeId, classIds],
  );
}

async function seedRelationships(): Promise<void> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    DS_ODDRN,
    'it077-src',
  ]);
  // Healthy ERD relationship + DISTINCT source/target datasets (distinct names make D1 observable).
  await seedEntity(REL, REL_ODDRN, 'it077_rel', 25, '{9}');
  await seedEntity(S, S_ODDRN, 'it077_source', 1, '{1}');
  await seedEntity(T, T_ODDRN, 'it077_target', 1, '{1}');
  // Hidden-by-default relationship entities (#1752 Defect 2): soft-DELETED + exclude_from_search.
  await seedEntity(REL_DELETED, REL_DELETED_ODDRN, 'it077_hidden_deleted', 25, '{9}');
  await dbQuery(`UPDATE data_entity SET status = 5 WHERE id = $1`, [REL_DELETED]);
  await seedEntity(REL_EXCLUDED, REL_EXCLUDED_ODDRN, 'it077_hidden_excluded', 25, '{9}');
  await dbQuery(`UPDATE data_entity SET exclude_from_search = true WHERE id = $1`, [REL_EXCLUDED]);
  // GRAPH relationship entity (type 26 → the overview mounts OverviewGraphRelationship).
  await seedEntity(REL_GRAPH, REL_GRAPH_ODDRN, 'it077_graph', 26, '{9}');

  // relationships rows (source→target; one per relationship-class entity) + detail rows.
  await dbQuery(`DELETE FROM erd_relationship_details WHERE relationship_id IN (SELECT id FROM relationships WHERE data_entity_id IN ($1,$2,$3,$4))`,
    [REL, REL_DELETED, REL_EXCLUDED, REL_GRAPH]);
  await dbQuery(`DELETE FROM graph_relationship WHERE relationship_id IN (SELECT id FROM relationships WHERE data_entity_id IN ($1,$2,$3,$4))`,
    [REL, REL_DELETED, REL_EXCLUDED, REL_GRAPH]);
  await dbQuery(`DELETE FROM relationships WHERE data_entity_id IN ($1,$2,$3,$4)`,
    [REL, REL_DELETED, REL_EXCLUDED, REL_GRAPH]);
  const erdRel = await dbQuery<{ id: number }>(
    `INSERT INTO relationships (data_entity_id, source_dataset_oddrn, target_dataset_oddrn, relationship_type)
     VALUES ($1,$2,$3,'ERD') RETURNING id`,
    [REL, S_ODDRN, T_ODDRN],
  );
  await dbQuery(
    `INSERT INTO erd_relationship_details (relationship_id, source_dataset_field_oddrn, target_dataset_field_oddrn, is_identifying, cardinality)
     VALUES ($1, ARRAY[$2], ARRAY[$3], false, 'ONE_TO_ONE')`,
    [erdRel[0].id, `${S_ODDRN}/columns/id`, `${T_ODDRN}/columns/id`],
  );
  for (const deId of [REL_DELETED, REL_EXCLUDED]) {
    await dbQuery(
      `INSERT INTO relationships (data_entity_id, source_dataset_oddrn, target_dataset_oddrn, relationship_type)
       VALUES ($1,$2,$3,'ERD')`,
      [deId, S_ODDRN, T_ODDRN],
    );
  }
  const graphRel = await dbQuery<{ id: number }>(
    `INSERT INTO relationships (data_entity_id, source_dataset_oddrn, target_dataset_oddrn, relationship_type)
     VALUES ($1,$2,$3,'GRAPH') RETURNING id`,
    [REL_GRAPH, S_ODDRN, T_ODDRN],
  );
  await dbQuery(
    `INSERT INTO graph_relationship (relationship_id, is_directed, specific_attributes)
     VALUES ($1, true, '{"engine":"it077"}'::jsonb)`,
    [graphRel[0].id],
  );
}

test.describe('F-037 ERD/Graph Relationships listing — #1752 fixed contract', () => {
  test.beforeEach(async () => {
    await seedRelationships();
  });

  test('H-001: the Relationships list page renders the relationship row (name, type, source)', async ({ page }) => {
    const list = relationshipsFetch(page);
    await page.goto('/data-modelling/relationships?q=it077_rel');
    await list;

    await expect(
      page.getByText('Relationships', { exact: true }).first(),
      'the Relationships list page must render its title',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('it077_rel', { exact: true }).filter({ visible: true }).first(),
      'the Relationships list must render the seeded relationship by name',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('it077_source').filter({ visible: true }).first(),
      'the Relationships list must render the source entity in the Source column',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('H-002 (re-grounded, was the PLT-056 D1 pin): the Target column renders the TARGET entity', async ({
    page,
  }) => {
    // Was the LSN-029 GREEN characterization pin of the copy-paste bug (source×2 / target×0,
    // pinned 2026-06-07). The #1752 fix flips it: each name renders exactly once, in its own column.
    const list = relationshipsFetch(page);
    await page.goto('/data-modelling/relationships?q=it077_rel');
    await list;

    await expect(
      page.getByText('it077_rel', { exact: true }).filter({ visible: true }).first(),
      'precondition: the seeded relationship row renders',
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText('it077_source').filter({ visible: true }),
      'FIXED CONTRACT (#1752 D1): the source name renders exactly once (the Source column only)',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.getByText('it077_target').filter({ visible: true }),
      'FIXED CONTRACT (#1752 D1): the target name renders exactly once (the Target column)',
    ).toHaveCount(1, { timeout: 15_000 });
  });

  test('visibility (#1752 D2): soft-DELETED and exclude_from_search relationships are not listed', async ({
    page,
  }) => {
    const list = relationshipsFetch(page);
    await page.goto('/data-modelling/relationships?q=it077_hidden');
    await list;

    await expect(
      page.getByText('0 relationships overall').first(),
      'the H1 total must count only visible relationships — DELETED/excluded are filtered server-side',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('it077_hidden_deleted').filter({ visible: true }),
      'a soft-DELETED relationship entity must not be listed',
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByText('it077_hidden_excluded').filter({ visible: true }),
      'an exclude_from_search relationship entity must not be listed',
    ).toHaveCount(0, { timeout: 15_000 });
  });

  test('?type=foo (#1752 D4): a mistyped type deep-link degrades to the ALL view, not a dead screen', async ({
    page,
  }) => {
    const respPromise = page.waitForResponse(
      r => r.url().includes('/api/relationships') && r.request().method() === 'GET',
    );
    await page.goto('/data-modelling/relationships?type=foo&q=it077_rel');
    const resp = await respPromise;

    expect(
      new URL(resp.url()).searchParams.get('type'),
      'the unknown ?type= must be validated client-side and fall back to ALL',
    ).toBe('ALL');
    expect(resp.status(), 'the fallback request must succeed').toBe(200);
    await expect(
      page.getByText('it077_rel', { exact: true }).filter({ visible: true }).first(),
      'the list must render (no dead empty state) for a mistyped ?type= deep-link',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('tab', { name: 'All' }),
      'the All tab must be the active tab after the fallback',
    ).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
  });

  test('graph detail labels (#1752): "Source:" renders the source dataset, "Target:" the target', async ({
    page,
  }) => {
    // GraphRelationship.tsx rendered targetDataEntity under "Source:" and sourceDataEntity under
    // "Target:" (verified live 2026-06-11). The fix puts each entity under its own label.
    await page.goto(`/dataentities/${REL_GRAPH}/overview`);
    await expect(page.getByText('Source:', { exact: true })).toBeVisible({ timeout: 15_000 });

    const sourceBlock = page.locator('text=Source:').locator('xpath=ancestor::div[1]');
    const targetBlock = page.locator('text=Target:').locator('xpath=ancestor::div[1]');
    await expect(
      sourceBlock,
      'the block labelled "Source:" must carry the SOURCE dataset',
    ).toContainText('it077_source', { timeout: 15_000 });
    await expect(
      targetBlock,
      'the block labelled "Target:" must carry the TARGET dataset',
    ).toContainText('it077_target', { timeout: 15_000 });
  });

  test('id contract green-locks (#1752 D5): list id resolves; erd_relationship_id does not round-trip', async ({
    request,
  }) => {
    // Unchanged behaviour, now stated in the OpenAPI spec: {relationship_id} IS the relationship's
    // data-entity id (the list `id`); the details payload's erd_relationship_id is an internal
    // detail-record id and is NOT a valid path-param value.
    const detail = await request.get(`/api/relationships/erd/${REL}`);
    expect(detail.status(), 'the list id must resolve the erd detail').toBe(200);
    const body = await detail.json();
    expect(body.id, 'the detail id is the relationship data-entity id').toBe(REL);
    const erdDetailId = body.erd_relationship?.erd_relationship_id;
    expect(erdDetailId, 'the payload exposes the internal erd detail-record id').toBeTruthy();
    expect(erdDetailId, 'the internal id differs from the path-param id space').not.toBe(REL);

    const trap = await request.get(`/api/relationships/erd/${erdDetailId}`);
    expect(
      trap.status(),
      'feeding erd_relationship_id back into {relationship_id} must NOT resolve (the documented trap)',
    ).toBe(404);
  });
});

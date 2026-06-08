import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-074 — F-016 DEG-Anchored Lineage: the Group lineage tab on a Data Entity Group
 * renders the lineage relationships AMONG the group's member entities.
 *
 * Protocol: integration-tests/protocols/IT-074-deg-anchored-lineage.md
 * Gates: validates F-016 (UC-001 happy-path render; UC-005 empty-members → 404 conflation, the
 * empty-membership branch of the 3-condition conflation the feature catalogues).
 *
 * GROUND BEFORE ASSERT (primary-source reads, not guessed — files in odd-platform):
 *   - Lineage.tsx:18-24 — the Lineage tab dispatcher: `isDEG ? <DEGLineage/> : <HierarchyLineage/>`.
 *     isDEG is true iff the entity's class set contains ENTITY_GROUP (class id 8).
 *   - DEGLineage.tsx:14-17 — fires useDataEntityGroupLineage({dataEntityId}) →
 *     GET /api/dataentitygroups/{id}/lineage (lib/hooks/api/dataEntity.ts:45-49).
 *   - DEGLineage/.../Node.tsx:60-62 — a member node renders `data.internalName || data.externalName`
 *     as visible <S.TitleContainer> text (queryable).
 *   - LineageServiceImpl.getDataEntityGroupLineage (LineageServiceImpl.java:59-85): resolves the DEG's
 *     members via the recursive CTE (ReactiveGroupEntityRelationRepositoryImpl.getDEGEntitiesOddrns,
 *     :177-204 — membership via group_entity_relations.group_oddrn). Line 62 `.switchIfEmpty(...)`
 *     raises NotFoundException("Data entity group", id) when membership resolution is EMPTY → 404.
 *     Edges come from the bidirectional-IN overload getLineageRelations(List<String>)
 *     (ReactiveLineageRepositoryImpl :112-119 — BOTH endpoints must be members).
 *
 * EMPIRICALLY VERIFIED (curl against this stack, 2026-06-07, before asserting — NOT assumed):
 *   - DEG 20741 with 2 members + edge A→B → 200, items[0].nodes=[20742 it074_src, 20743 it074_tgt],
 *     edges=[{20742→20743}]. (UC-001 ground truth.)
 *   - SAME DEG with 0 members (memberships deleted) → 404 USR002 "Data entity group ... not found".
 *     (UC-005 ground truth — the empty-membership branch of the conflation.)
 *   - (Aside: a DEG with members but no edge returns 200 with one singleton-node stream PER member —
 *     members still render; so "no edge" is NOT an empty-state. The genuine empty/error case is
 *     empty-membership → 404. We assert the verified behaviour, not the ideal.)
 *
 * SEED (own ids, namespace //e2e-it074/, names it074_*; idempotent):
 *   data_source 20740 · DEG 20741 (class {8}, type 17) · members 20742/20743 (class {1}, type 1).
 *
 * use_cases verified: F-016-UC-001 (happy-path render), F-016-UC-005 (empty-members 404).
 */
const SRC = 20740; // data_source
const DEG = 20741; // the Data Entity Group
const M_A = 20742; // member A (lineage parent)
const M_B = 20743; // member B (lineage child)

const DS_ODDRN = '//e2e-it074/db';
const DEG_ODDRN = '//e2e-it074/db/groups/it074_deg';
const A_ODDRN = '//e2e-it074/db/tables/it074_src';
const B_ODDRN = '//e2e-it074/db/tables/it074_tgt';

const groupLineageFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r => /\/api\/dataentitygroups\/\d+\/lineage/.test(r.url()) && r.request().method() === 'GET'
  );

// Seed the DEG + its two member entities + an inter-member lineage edge A→B. When
// `withMembers` is false the membership rows are removed (the DEG still exists, but member
// resolution is empty → the service raises the empty-membership 404).
async function seedDeg(withMembers: boolean): Promise<void> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    DS_ODDRN,
    'it074-src',
  ]);
  // The DEG itself (class DATA_ENTITY_GROUP=8, type DAG=17) — what isDEG keys on in the UI dispatcher.
  await dbQuery(
    `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,source_created_at,source_updated_at)
     VALUES ($1,$2,$3,$4,17,'{8}',0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn, entity_class_ids='{8}', type_id=17`,
    [DEG, DEG_ODDRN, 'it074_deg', SRC]
  );
  // Two member entities (class DATA_SET=1, type TABLE=1) — render as DEG-lineage nodes by name.
  for (const [id, oddrn, name] of [
    [M_A, A_ODDRN, 'it074_src'],
    [M_B, B_ODDRN, 'it074_tgt'],
  ] as const) {
    await dbQuery(
      `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,source_created_at,source_updated_at)
       VALUES ($1,$2,$3,$4,1,'{1}',0,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn, entity_class_ids='{1}'`,
      [id, oddrn, name, SRC]
    );
  }
  // Membership: by ODDRN. Reset then (optionally) re-link both members to the DEG.
  await dbQuery(`DELETE FROM group_entity_relations WHERE group_oddrn = $1`, [DEG_ODDRN]);
  if (withMembers) {
    for (const member of [A_ODDRN, B_ODDRN]) {
      await dbQuery(
        `INSERT INTO group_entity_relations (group_oddrn, data_entity_oddrn, is_deleted) VALUES ($1,$2,false)`,
        [DEG_ODDRN, member]
      );
    }
  }
  // Inter-member lineage edge A→B (both members → survives the bidirectional-IN edge filter).
  await dbQuery(
    `DELETE FROM lineage WHERE parent_oddrn IN ($1,$2) OR child_oddrn IN ($1,$2)`,
    [A_ODDRN, B_ODDRN]
  );
  await dbQuery(
    `INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) VALUES ($1,$2,$1,false)`,
    [A_ODDRN, B_ODDRN]
  );
}

test.describe('F-016 DEG-anchored lineage — the Group lineage tab renders member lineage', () => {
  test('UC-001: opening a DEG with inter-member edges renders the member lineage graph', async ({ page }) => {
    await seedDeg(true);

    const lineage = groupLineageFetch(page);
    await page.goto(`/dataentities/${DEG}/lineage`);
    const res = await lineage;
    // The class-driven dispatcher routed to the DEG branch and the DEG-lineage endpoint answered 200
    // (NOT the empty-membership 404) — the DEG-anchored read path, distinct from per-entity lineage.
    expect(res.status(), 'GET /api/dataentitygroups/{id}/lineage must be 200 for a DEG with members + edges').toBe(200);

    // The DEG canvas renders each member node by name (DEG Node.tsx:60-62 — internalName||externalName).
    // react-flow node labels can appear both as a hidden <title> and a visible label — scope to visible.
    await expect(
      page.getByText('it074_src').filter({ visible: true }).first(),
      'the DEG Group-lineage canvas must render member A (lineage parent) — UI did not compose the DEG graph if absent'
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('it074_tgt').filter({ visible: true }).first(),
      'the DEG Group-lineage canvas must render member B (lineage child) — the inter-member edge target'
    ).toBeVisible({ timeout: 20_000 });
  });

  test('UC-005: a DEG that exists but has no members returns the empty-membership 404 (conflation branch)', async ({
    page,
  }) => {
    // The DEG row exists, but membership resolution is empty → LineageServiceImpl.java:62 switchIfEmpty
    // raises NotFoundException → HTTP 404. (One of the three conditions the F-016 404-conflation
    // facet documents; verified empirically against this stack.)
    await seedDeg(false);

    const lineage = groupLineageFetch(page);
    await page.goto(`/dataentities/${DEG}/lineage`);
    const res = await lineage;
    expect(
      res.status(),
      'a DEG with zero resolvable members must 404 (empty-membership branch of the 404 conflation)'
    ).toBe(404);

    // The DEG canvas composes no member node on the 404 path (no stale/wrong-entity render).
    await page.waitForTimeout(1500);
    await expect(
      page.getByText('it074_src').filter({ visible: true }),
      'with no members the DEG lineage canvas must render no member node'
    ).toHaveCount(0);
  });
});

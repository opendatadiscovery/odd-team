import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-077 — F-037 ERD/Graph Relationships Listing: the Data Modelling → Relationships list
 * page renders the relationships surface; and it PINS the live target-column copy-paste bug.
 *
 * Protocol: integration-tests/protocols/IT-077-erd-graph-relationships.md
 * Gates: validates F-037 (H-001 the list renders the documented surface) +
 * regresses PLT-056 Defect 1 (H-002 CONTRADICTED — the Target column renders SOURCE data).
 *
 * GROUND BEFORE ASSERT (primary-source reads + empirical probe — not guessed; odd-platform):
 *   - Relationships.tsx:38-84 — the list page: title "Relationships", a 5-column table
 *     (Name | Type | Namespace,Datasource | Source | Target), 30-row infinite scroll over
 *     GET /api/relationships (useSearchRelationships, size:30). Route /data-modelling/relationships
 *     (relationshipsRoutes.ts; DataModellingRoutes.tsx:40).
 *   - RelationshipsSearchInput.tsx — a "Search relationships" box bound to `?q` (filters the
 *     relationship-row external_name; ReactiveDataEntityRelationshipRepositoryImpl.java:68-69).
 *   - RelationshipsListItem.tsx:64-72 — the SOURCE cell renders item.sourceDataEntity (name/oddrn/id).
 *   - RelationshipsListItem.tsx:73-81 — the TARGET cell ALSO renders item.sourceDataEntity (verbatim
 *     copy of the Source cell). `item.targetDataEntity` is NEVER referenced in the file. THE BUG.
 *   - RelationshipMapper.java:50-62 — the API DTO is correct: distinct source_data_entity +
 *     target_data_entity. Backend right, UI wrong (doc-correct/code-wrong, F-037a / PLT-056 Defect 1).
 *
 * EMPIRICALLY VERIFIED (this stack, 2026-06-07, before asserting):
 *   - GET /api/relationships?...&query=it077_rel → 200, source_data_entity.external_name="it077_source",
 *     target_data_entity.external_name="it077_target" (BOTH distinct + present — API correct).
 *   - UI /data-modelling/relationships?q=it077_rel → "it077_rel"×1, "it077_source"×2 (Source AND Target
 *     columns), "it077_target"×0. Page body contains "it077_source" but NOT "it077_target". THE BUG.
 *
 * SEED (own ids, namespace //e2e-it077/, names it077_*; idempotent): a relationship-class entity
 *   20771 (class DATA_RELATIONSHIP=9, type ENTITY_RELATIONSHIP=25, external_name it077_rel) + DISTINCT
 *   source 20772 (it077_source) + target 20773 (it077_target) + a `relationships` row
 *   (source→target, type ERD). Distinct source/target names are what make the bug observable.
 *
 * use_cases verified: F-037-H-001 (list renders documented surface),
 * F-037-H-002 (CONTRADICTED — Target column shows Source; regression pin for PLT-056 Defect 1).
 */
const SRC = 20770;
const REL = 20771; // the relationship-class data_entity (the list row)
const S = 20772; // source dataset
const T = 20773; // target dataset

const DS_ODDRN = '//e2e-it077/db';
const REL_ODDRN = '//e2e-it077/db/relationships/it077_rel';
const S_ODDRN = '//e2e-it077/db/tables/it077_source';
const T_ODDRN = '//e2e-it077/db/tables/it077_target';

const relationshipsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(r => r.url().includes('/api/relationships') && r.request().method() === 'GET' && r.ok());

async function seedRelationship(): Promise<void> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    DS_ODDRN,
    'it077-src',
  ]);
  // The relationship as a data_entity (class DATA_RELATIONSHIP=9, type ENTITY_RELATIONSHIP=25) — the list row.
  await dbQuery(
    `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,source_created_at,source_updated_at)
     VALUES ($1,$2,$3,$4,25,'{9}',0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn, entity_class_ids='{9}', type_id=25`,
    [REL, REL_ODDRN, 'it077_rel', SRC]
  );
  // DISTINCT source + target datasets (class DATA_SET=1) — distinct names make the copy-paste observable.
  for (const [id, oddrn, name] of [
    [S, S_ODDRN, 'it077_source'],
    [T, T_ODDRN, 'it077_target'],
  ] as const) {
    await dbQuery(
      `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,source_created_at,source_updated_at)
       VALUES ($1,$2,$3,$4,1,'{1}',0,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn, entity_class_ids='{1}'`,
      [id, oddrn, name, SRC]
    );
  }
  // The relationships row: source→target, type ERD. (relationships has no is_deleted column.)
  await dbQuery(`DELETE FROM relationships WHERE data_entity_id = $1`, [REL]);
  await dbQuery(
    `INSERT INTO relationships (data_entity_id, source_dataset_oddrn, target_dataset_oddrn, relationship_type)
     VALUES ($1,$2,$3,'ERD')`,
    [REL, S_ODDRN, T_ODDRN]
  );
}

test.describe('F-037 ERD/Graph Relationships listing — surface renders; target-column bug pinned', () => {
  test('H-001: the Relationships list page renders the relationship row (name, type, source)', async ({ page }) => {
    await seedRelationship();

    const list = relationshipsFetch(page);
    await page.goto('/data-modelling/relationships?q=it077_rel'); // search narrows to our seeded row
    await list;

    // The page chrome + the relationship row by name (RelationshipsListItem Name cell).
    await expect(
      page.getByText('Relationships', { exact: true }).first(),
      'the Relationships list page must render its title'
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('it077_rel').filter({ visible: true }).first(),
      'the Relationships list must render the seeded relationship by name'
    ).toBeVisible({ timeout: 15_000 });
    // Type badge (ERD → ENTITY_RELATIONSHIP) + the source entity name in the Source column.
    await expect(
      page.getByText('it077_source').filter({ visible: true }).first(),
      'the Relationships list must render the source entity in the Source column'
    ).toBeVisible({ timeout: 15_000 });
  });

  test('H-002 (PIN PLT-056 Defect 1): the Target column renders the SOURCE entity, not the target', async ({
    page,
  }) => {
    // KNOWN BUG (PLT-056 Defect 1): RelationshipsListItem.tsx:73-81 renders the Target cell with
    // item.sourceDataEntity (a verbatim copy of the Source cell at :64-72); item.targetDataEntity is
    // never read. The API returns the correct distinct target (verified). So the list shows the SOURCE
    // name in BOTH columns and the target's distinct name nowhere. This is a GREEN characterization pin
    // of the CURRENT incorrect behaviour (LSN-029): it asserts what the user wrongly SEES today; it goes
    // RED the instant the one-property fix (sourceDataEntity → targetDataEntity at lines 75/77/79) lands.
    await seedRelationship();

    const list = relationshipsFetch(page);
    await page.goto('/data-modelling/relationships?q=it077_rel');
    await list;

    // Precondition: the row rendered (so we are pinning the cell, not a no-render).
    await expect(
      page.getByText('it077_rel').filter({ visible: true }).first(),
      'precondition: the seeded relationship row renders'
    ).toBeVisible({ timeout: 15_000 });

    // BUG signature 1: the SOURCE name appears in BOTH the Source AND the Target cells → 2 occurrences.
    await expect(
      page.getByText('it077_source').filter({ visible: true }),
      'KNOWN BUG: the source name renders TWICE (Source + Target columns) — copy-paste at RelationshipsListItem.tsx:73-81'
    ).toHaveCount(2, { timeout: 15_000 });

    // BUG signature 2: the target entity's DISTINCT name is NOWHERE on the page (the Target cell dropped it).
    // The API DID return it (verified) — so a 0-count here is purely the UI copy-paste, and the moment the
    // fix lands the target name will appear and this pin will RED, flagging that the bug is gone.
    await expect(
      page.getByText('it077_target').filter({ visible: true }),
      'KNOWN BUG (PLT-056 Defect 1): the target entity name must currently be ABSENT (Target column shows Source). ' +
        'When this goes RED, the copy-paste is FIXED — flip H-002 to confirmed and retire this pin.'
    ).toHaveCount(0, { timeout: 15_000 });
  });
});

import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-076 — F-186 Lineage canvas Compact/Full view-mode toggle: the two modes render the
 * canvas nodes distinctly, and the choice round-trips through the `?full=` URL param.
 *
 * Protocol: integration-tests/protocols/IT-076-lineage-view-mode-toggle.md
 * Gates: validates F-186 (H-003 toggling re-renders the Hierarchy canvas distinctly;
 * H-009 Compact drops the detail block Full shows; H-001 the `?full=` choice round-trips via URL).
 *
 * GROUND BEFORE ASSERT (primary-source reads + empirical probe, not guessed):
 *   - LineageControls.tsx:50-119 — the Hierarchy canvas exposes an AppTabs Full/Compact control
 *     (items [{Full},{Compact}], selectedTab = full?0:1). handleViewChange sets `full = newIdx<=0`.
 *   - defaultLineageQuery.full = true (lineageLib/constants.ts:74-76) — the canvas opens in FULL.
 *   - Info.tsx (node content renderer): with an externalName, FULL mode renders the "Space" + "Source"
 *     attribute rows (Info.tsx:67-119, including the data source name); COMPACT mode (full=false,
 *     externalName present) falls through to the final `full ? <ODDRN> : null` → null, so the
 *     Source/Space rows are DROPPED. The node title renders in both.
 *   - EMPIRICALLY VERIFIED (this stack, 2026-06-07) on a seeded Hierarchy lineage:
 *       FULL  → "Source"×3, "Space"×3, data source name "it076-src"×3 visible; URL has no `full` (default true).
 *       click Compact → "Source"×0, "Space"×0, "it076-src"×0; title still visible; URL flips to `?full=false`.
 *     So the two modes render distinctly and the choice persists in the URL.
 *
 * SEED (own ids, namespace //e2e-it076/, names it076_*; idempotent): a Hierarchy (non-DEG) lineage —
 *   data_source 20760 (WITH a namespace, so "Space" has content) · entity 20761 (DATA_SET) ·
 *   upstream parent 20762 · lineage edge parent→entity. (NOT a DEG → routes to HierarchyLineage,
 *   the subtree whose Compact/Full re-renders the node shape.)
 *
 * use_cases verified: F-186-H-003 (Hierarchy re-render distinct), F-186-H-009 (Compact drops the
 * detail block), F-186-H-001 (the `?full=` choice round-trips via the URL).
 */
const SRC = 20760;
const ENT = 20761; // the lineage root (Hierarchy canvas)
const PAR = 20762; // upstream parent

const DS_ODDRN = '//e2e-it076/db';
const ENT_ODDRN = '//e2e-it076/db/tables/it076_entity';
const PAR_ODDRN = '//e2e-it076/db/tables/it076_parent';

const lineageFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(r => /\/lineage\/(up|down)stream/.test(r.url()) && r.ok());

async function seedHierarchyLineage(): Promise<void> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    DS_ODDRN,
    'it076-src',
  ]);
  // Give the data source a namespace so the FULL-mode "Space" row has content.
  const ns = await dbQuery<{ id: number }>(`SELECT id FROM namespace WHERE name = $1 LIMIT 1`, ['it076-ns']);
  const nsId =
    ns[0]?.id ?? (await dbQuery<{ id: number }>(`INSERT INTO namespace (name) VALUES ($1) RETURNING id`, ['it076-ns']))[0].id;
  await dbQuery(`UPDATE data_source SET namespace_id = $2 WHERE id = $1`, [SRC, nsId]);

  for (const [id, oddrn, name] of [
    [ENT, ENT_ODDRN, 'it076_entity'],
    [PAR, PAR_ODDRN, 'it076_parent'],
  ] as const) {
    await dbQuery(
      `INSERT INTO data_entity (id,oddrn,external_name,data_source_id,type_id,entity_class_ids,view_count,source_created_at,source_updated_at)
       VALUES ($1,$2,$3,$4,1,'{1}',0,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET external_name=EXCLUDED.external_name, oddrn=EXCLUDED.oddrn, entity_class_ids='{1}'`,
      [id, oddrn, name, SRC]
    );
  }
  await dbQuery(`DELETE FROM lineage WHERE child_oddrn = $1 OR parent_oddrn = $1`, [ENT_ODDRN]);
  await dbQuery(
    `INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) VALUES ($1,$2,$1,false)`,
    [PAR_ODDRN, ENT_ODDRN]
  );
}

// The FULL-mode "Source"/"Space" detail rows — present in Full, dropped in Compact.
const sourceRow = (page: import('@playwright/test').Page) =>
  page.getByText('Source', { exact: true }).filter({ visible: true });

test.describe('F-186 Lineage Compact/Full toggle — the two modes render distinctly', () => {
  test('H-003/H-009: toggling Full→Compact drops the Source/Space detail block the node shows in Full', async ({
    page,
  }) => {
    await seedHierarchyLineage();

    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${ENT}/lineage`); // opens in FULL (defaultLineageQuery.full=true)
    await lineage;

    // FULL mode: the node renders by name AND shows the "Source" detail row (Info.tsx full+externalName).
    await expect(
      page.getByText('it076_entity').filter({ visible: true }).first(),
      'the lineage root must render on the Hierarchy canvas'
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      sourceRow(page).first(),
      'FULL mode must render the node "Source" detail row'
    ).toBeVisible({ timeout: 15_000 });

    // Toggle to COMPACT.
    await page.getByText('Compact', { exact: true }).first().click();

    // COMPACT mode: the "Source" detail rows are dropped (the density promise of the label).
    await expect(
      sourceRow(page),
      'COMPACT mode must drop the "Source" detail row that FULL showed (distinct render)'
    ).toHaveCount(0, { timeout: 15_000 });
    // The node title still renders — Compact changes node DETAIL, not node presence.
    await expect(
      page.getByText('it076_entity').filter({ visible: true }).first(),
      'the node title must still render in COMPACT mode'
    ).toBeVisible();
  });

  test('H-001: the Compact/Full choice round-trips through the ?full= URL param (deep-link)', async ({ page }) => {
    await seedHierarchyLineage();

    // Deep-link directly into COMPACT via the URL params the toggle writes. The toggle always emits
    // the FULL query (incl. `d` depth); a bare `?full=false` would omit `d` and trip the separate
    // unset-lineage_depth 500 (F-054-UC-5 / F-055), unrelated to the view-mode round-trip — so we
    // deep-link with the complete `?d=1&full=false` the control actually produces.
    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${ENT}/lineage?d=1&full=false`);
    await lineage;

    await expect(
      page.getByText('it076_entity').filter({ visible: true }).first(),
      'the node must render on a ?full=false deep-link'
    ).toBeVisible({ timeout: 20_000 });
    // A ?full=false deep-link opens in Compact → no "Source" detail row (the param is honoured on load).
    await expect(
      sourceRow(page),
      'a ?full=false deep-link must open in COMPACT (no Source detail row) — the choice survives reload via the URL'
    ).toHaveCount(0, { timeout: 15_000 });
  });
});

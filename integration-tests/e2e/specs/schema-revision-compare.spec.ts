import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-078 — F-191 Dataset Schema Revision Compare Viewer (UI surface).
 *
 * Protocol: integration-tests/protocols/IT-078-schema-revision-compare.md
 * Gates: validates F-191 (the side-by-side per-field diff between two dataset versions renders).
 *
 * The Compare viewer (route /dataentities/{id}/structure/compare?firstVersionId=&secondVersionId=
 * → DatasetStructureCompare.tsx) fires GET /api/datasets/{id}/structure/diff?first_version_id=&
 * second_version_id= and renders one row per affected field, with BOTH versions' field names shown
 * side-by-side (DatasetStructureCompareListItem.tsx:64-69 renders state.name). The backend
 * (DatasetVersionServiceImpl.buildDataSetVersionDiffList) classifies each field CREATED (in v2 only)
 * / DELETED (in v1 only) / UPDATED / NO_CHANGES. Operator workflow: "what changed in this table's
 * schema between ingest A and ingest B". F-191 sits at 0/11 verified promises — the central
 * status-coded-diff happy path (UC-001/003) is hand-proven-but-untested. Operator consequence of a
 * regression: a schema-evolution diff renders blank or wrong, and an operator investigating a
 * breaking change is misled.
 *
 * GROUND-BEFORE-ASSERT: the diff needs TWO dataset_version rows for the SAME dataset_oddrn with
 * different field sets. We seed v1={col_a,col_b}, v2={col_a,col_c}; the diff (v1→v2) MUST surface
 * the removed col_b and the added col_c. dataset_field.stats must be non-null '{}' (deserializeStats
 * NPEs on null for the structure path); dataset_field.type must be valid JSONB (the diff's
 * deserializeType reads type.data()).
 */

// ---- namespace (ids in the assigned 20780–20789 range; oddrn //e2e-it078/; names it078_) ----
const SRC = 20780;
const ENT = 20781;
const DS_ODDRN = '//e2e-it078/db/tables/it078_ds';
const COL_A = 'it078_col_a'; // present in BOTH versions
const COL_B = 'it078_col_b'; // present in v1 ONLY -> DELETED in the v1->v2 diff
const COL_C = 'it078_col_c'; // present in v2 ONLY -> CREATED in the v1->v2 diff
const GHOST = 'it078_ghost_col'; // present in NEITHER version -> never rendered

const TYPE_JSON = JSON.stringify({ type: 'TYPE_STRING', logical_type: 'varchar', is_nullable: true });

interface VersionRow {
  id: number;
}

// Seed a DATA_SET entity with two versions; returns the two version ids (v1 older, v2 newer).
async function seedTwoVersions(): Promise<{ v1: number; v2: number }> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    '//e2e-it078/db',
    'it078-src',
  ]);
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count, source_created_at, source_updated_at)
     VALUES ($1,$2,$3,$4,1,'{1}',0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [ENT, DS_ODDRN, 'it078_ds', SRC],
  );

  // idempotent reset: drop prior structure links + versions + fields for this oddrn
  await dbQuery(
    `DELETE FROM dataset_structure ds USING dataset_version dv
     WHERE ds.dataset_version_id = dv.id AND dv.dataset_oddrn = $1`,
    [DS_ODDRN],
  );
  await dbQuery(`DELETE FROM dataset_version WHERE dataset_oddrn = $1`, [DS_ODDRN]);
  await dbQuery(`DELETE FROM dataset_field WHERE oddrn LIKE $1`, [`${DS_ODDRN}/columns/%`]);

  const fieldId = async (name: string): Promise<number> => {
    const rows = await dbQuery<{ id: number }>(
      `INSERT INTO dataset_field (name, oddrn, field_order, type, stats, is_primary_key, is_sort_key, is_key, is_value)
       VALUES ($1,$2,0,$3::jsonb,'{}'::jsonb,false,false,false,false) RETURNING id`,
      [name, `${DS_ODDRN}/columns/${name}`, TYPE_JSON],
    );
    return Number(rows[0].id);
  };
  const fa = await fieldId(COL_A);
  const fb = await fieldId(COL_B);
  const fc = await fieldId(COL_C);

  const version = async (n: number): Promise<number> => {
    const rows = await dbQuery<VersionRow>(
      `INSERT INTO dataset_version (version, version_hash, created_at, dataset_oddrn)
       VALUES ($1,$2,NOW(),$3) RETURNING id`,
      [n, `it078-v${n}`, DS_ODDRN],
    );
    return Number(rows[0].id);
  };
  const v1 = await version(1);
  const v2 = await version(2);

  // v1 = {col_a, col_b}; v2 = {col_a, col_c}
  await dbQuery(`INSERT INTO dataset_structure (dataset_version_id, dataset_field_id) VALUES ($1,$2),($1,$3)`, [
    v1,
    fa,
    fb,
  ]);
  await dbQuery(`INSERT INTO dataset_structure (dataset_version_id, dataset_field_id) VALUES ($1,$2),($1,$3)`, [
    v2,
    fa,
    fc,
  ]);
  return { v1, v2 };
}

const diffFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/datasets\/\d+\/structure\/diff(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-191 Dataset Schema Revision Compare Viewer — side-by-side per-field diff', () => {
  test('the compare viewer renders the added + removed field between two versions (UC-001/UC-003)', async ({
    page,
  }) => {
    const { v1, v2 } = await seedTwoVersions();

    // ground truth: confirm the two versions carry the expected field sets
    const v1Fields = await dbQuery<{ name: string }>(
      `SELECT df.name FROM dataset_structure ds JOIN dataset_field df ON df.id = ds.dataset_field_id WHERE ds.dataset_version_id = $1 ORDER BY df.name`,
      [v1],
    );
    expect(v1Fields.map(r => r.name)).toEqual([COL_A, COL_B]);

    const diff = diffFetch(page);
    await page.goto(`/dataentities/${ENT}/structure/compare?firstVersionId=${v1}&secondVersionId=${v2}`);
    await diff;

    // the compare HEADER composed (proves we are on the compare surface, not the structure tab)
    await expect(
      page.getByText('Revision compare').first(),
      'the Compare viewer header must render',
    ).toBeVisible({ timeout: 10_000 });

    // the REMOVED field (v1-only) renders on the diff (DELETED side)
    await expect(
      page.getByText(COL_B).first(),
      'a field present in v1 but not v2 (DELETED) must render in the diff',
    ).toBeVisible({ timeout: 10_000 });

    // the ADDED field (v2-only) renders on the diff (CREATED side)
    await expect(
      page.getByText(COL_C).first(),
      'a field present in v2 but not v1 (CREATED) must render in the diff',
    ).toBeVisible({ timeout: 10_000 });

    // a column in NEITHER version must never render
    await expect(
      page.getByText(GHOST).filter({ visible: true }),
      'a column in neither version must not render',
    ).toHaveCount(0);
  });

  test('identical version ids surface an error state, not a confident empty diff (UC-006/UC-005)', async ({
    page,
  }) => {
    const { v1 } = await seedTwoVersions();

    // backend: DatasetVersionServiceImpl.getDatasetVersionDiff throws BadUserRequestException (400)
    // when firstVersionId == secondVersionId ("Couldn't show diff for identical versions").
    const sameDiff = page.waitForResponse(
      r => /\/api\/datasets\/\d+\/structure\/diff(\?|$)/.test(r.url()) && r.request().method() === 'GET',
    );
    await page.goto(`/dataentities/${ENT}/structure/compare?firstVersionId=${v1}&secondVersionId=${v1}`);
    const res = await sameDiff;

    // ground truth: the diff request is refused 4xx (the picker self-disables this in the UI, but a
    // pasted URL bypasses the picker — this is the URL-paste path the F-191 reflection flags).
    expect(res.status(), 'identical version ids must be a 4xx, not a 200').toBeGreaterThanOrEqual(400);

    // the header still composes, but NO diff row renders (no col_b/col_c diff rows on an errored fetch)
    await expect(page.getByText('Revision compare').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(600);
    await expect(
      page.getByText(COL_B).filter({ visible: true }),
      'an errored (identical-id) compare must not render a diff row',
    ).toHaveCount(0);

    // KNOWN BEHAVIOUR (F-191 UC-005, tracked PLT-028): the surface routes 400 (identical ids) and
    // 500 (missing id) through the SAME AppErrorPage — the operator cannot tell "I typed wrong" from
    // "platform broken". This test pins that the identical-id case is a 4xx and renders no diff; the
    // 400-vs-500 undifferentiation itself is a separate tracked defect (no fix asserted here).
  });
});

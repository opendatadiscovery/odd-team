import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-079 — F-192 Per-Column Annotation Editor Composition (UI surface).
 *
 * Protocol: integration-tests/protocols/IT-079-column-annotation-editor.md
 * Gates: validates F-192 (the right-rail per-column annotation editor renders for a selected field).
 *
 * The Structure tab's two-column view (DatasetStructureView.tsx) puts the field LIST on the left and
 * the per-column annotation editor (DatasetFieldOverview.tsx) on the right. The right-rail composes
 * six sub-editors against the SINGLE field in selectedFieldIdAtom (default = datasetStructureRoot[0]):
 * header (field name as <h1>, DatasetFieldHeader.tsx:62-64), INTERNAL DESCRIPTION
 * (DatasetFieldDescription.tsx:57-59 heading + DatasetFieldDescriptionPreview rendering the
 * internal_description, or "Description is not created yet" when empty), tags, enums, terms.
 * F-192 sits at 0/11 verified promises — UC-001 (clicking a column re-points the editor) is the
 * central hand-proven-but-untested render promise. Operator workflow: open a dataset's Structure tab
 * and read/curate a column's internal description. Operator consequence of a regression: the
 * annotation editor renders blank and a data engineer cannot read a column's documented meaning.
 *
 * Route: /dataentities/{id}/structure → (redirect) /structure/overview/{versionId}. We navigate the
 * versioned overview URL directly for determinism and wait for the by-version structure fetch
 * (GET /api/datasets/{id}/structure/{versionId}) that hydrates the view.
 *
 * GROUND-BEFORE-ASSERT: seed a DATA_SET entity with one dataset_version + one dataset_field carrying
 * a distinctive internal_description; assert the right-rail renders the column name + the
 * INTERNAL DESCRIPTION heading + the description text; DB read-back confirms the annotation. A second
 * column with NO internal_description renders the empty-annotation placeholder.
 */

// ---- namespace (ids in the assigned 20790–20799 range; oddrn //e2e-it079/; names it079_) ----
const SRC = 20790;
const ENT_DESCRIBED = 20791; // a column WITH an internal description (the annotation under test)
const ENT_EMPTY = 20792; // a column with NO internal description (the empty-annotation corner)
const COL_DESCRIBED = 'it079_described_col';
const COL_EMPTY = 'it079_empty_col';
const INTERNAL_DESC = 'it079 annotation: this column holds the user identifier';

const TYPE_JSON = JSON.stringify({ type: 'TYPE_STRING', logical_type: 'varchar', is_nullable: true });

interface IdRow {
  id: number;
}

// Seed a DATA_SET entity with a single version + a single column; returns the version id. The column's
// internal_description is set to `internalDescription` (or left null for the empty-annotation case).
async function seedDatasetWithColumn(
  entId: number,
  dsOddrn: string,
  extName: string,
  colName: string,
  internalDescription: string | null,
): Promise<number> {
  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    SRC,
    '//e2e-it079/db',
    'it079-src',
  ]);
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count, source_created_at, source_updated_at)
     VALUES ($1,$2,$3,$4,1,'{1}',0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
    [entId, dsOddrn, extName, SRC],
  );

  // idempotent reset for this oddrn
  await dbQuery(
    `DELETE FROM dataset_structure ds USING dataset_version dv
     WHERE ds.dataset_version_id = dv.id AND dv.dataset_oddrn = $1`,
    [dsOddrn],
  );
  await dbQuery(`DELETE FROM dataset_version WHERE dataset_oddrn = $1`, [dsOddrn]);
  await dbQuery(`DELETE FROM dataset_field WHERE oddrn = $1`, [`${dsOddrn}/columns/${colName}`]);

  const fid = Number(
    (
      await dbQuery<IdRow>(
        `INSERT INTO dataset_field
           (name, oddrn, field_order, type, stats, is_primary_key, is_sort_key, is_key, is_value, internal_description)
         VALUES ($1,$2,0,$3::jsonb,'{}'::jsonb,false,false,false,false,$4) RETURNING id`,
        [colName, `${dsOddrn}/columns/${colName}`, TYPE_JSON, internalDescription],
      )
    )[0].id,
  );
  const vid = Number(
    (
      await dbQuery<IdRow>(
        `INSERT INTO dataset_version (version, version_hash, created_at, dataset_oddrn)
         VALUES (1,$1,NOW(),$2) RETURNING id`,
        [`it079-${colName}`, dsOddrn],
      )
    )[0].id,
  );
  await dbQuery(`INSERT INTO dataset_structure (dataset_version_id, dataset_field_id) VALUES ($1,$2)`, [vid, fid]);
  return vid;
}

const structureByVersionFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    r =>
      /\/api\/datasets\/\d+\/structure\/\d+(\?|$)/.test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

test.describe('F-192 Per-Column Annotation Editor — the right-rail column editor renders', () => {
  test('the annotation editor renders the column name + INTERNAL DESCRIPTION + the description text (UC-001)', async ({
    page,
  }) => {
    const dsOddrn = '//e2e-it079/db/tables/it079_described';
    const vid = await seedDatasetWithColumn(
      ENT_DESCRIBED,
      dsOddrn,
      'it079_described',
      COL_DESCRIBED,
      INTERNAL_DESC,
    );

    // ground truth: the column carries the annotation in the DB
    const dbRows = await dbQuery<{ internal_description: string }>(
      `SELECT internal_description FROM dataset_field WHERE oddrn = $1`,
      [`${dsOddrn}/columns/${COL_DESCRIBED}`],
    );
    expect(dbRows[0]?.internal_description, 'the column must carry the seeded annotation in the DB').toBe(
      INTERNAL_DESC,
    );

    const structure = structureByVersionFetch(page);
    await page.goto(`/dataentities/${ENT_DESCRIBED}/structure/overview/${vid}`);
    await structure;

    // the right-rail editor header renders the column name (DatasetFieldHeader <h1>)
    await expect(
      page.getByText(COL_DESCRIBED).first(),
      'the per-column editor must render the selected column name',
    ).toBeVisible({ timeout: 10_000 });

    // the INTERNAL DESCRIPTION section heading renders (the annotation editor's own heading)
    await expect(
      page.getByText('INTERNAL DESCRIPTION').first(),
      'the annotation editor must render the INTERNAL DESCRIPTION section',
    ).toBeVisible({ timeout: 10_000 });

    // the annotation text itself renders in the preview (UI -> backend -> DB round trip)
    await expect(
      page.getByText(INTERNAL_DESC).first(),
      'the editor must render the column annotation text from the DB',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a column with no annotation renders the empty-annotation placeholder (corner)', async ({ page }) => {
    const dsOddrn = '//e2e-it079/db/tables/it079_empty';
    const vid = await seedDatasetWithColumn(ENT_EMPTY, dsOddrn, 'it079_empty', COL_EMPTY, null);

    // ground truth: the column has NO internal description
    const dbRows = await dbQuery<{ internal_description: string | null }>(
      `SELECT internal_description FROM dataset_field WHERE oddrn = $1`,
      [`${dsOddrn}/columns/${COL_EMPTY}`],
    );
    expect(dbRows[0]?.internal_description, 'the column must have no annotation in the DB').toBeNull();

    const structure = structureByVersionFetch(page);
    await page.goto(`/dataentities/${ENT_EMPTY}/structure/overview/${vid}`);
    await structure;

    // the editor still composes for the column...
    await expect(page.getByText(COL_EMPTY).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('INTERNAL DESCRIPTION').first()).toBeVisible({ timeout: 10_000 });

    // ...and the description preview shows the empty-annotation placeholder
    // (DatasetFieldDescriptionPreview.tsx:17-19 "Description is not created yet")
    await expect(
      page.getByText('Description is not created yet').first(),
      'an un-annotated column must render the empty-annotation placeholder',
    ).toBeVisible({ timeout: 10_000 });
  });
});

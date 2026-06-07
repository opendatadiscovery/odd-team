import { test, expect } from '@playwright/test';
import {
  ensureNamespace,
  cleanupLookupTablesByPrefix,
  createLookupTable,
  addColumns,
  addRows,
  catalogRow,
  physicalColumns,
  physicalTableRowCount,
  dbRows,
} from '../helpers/lookup';

/**
 * IT-050 — F-026 Lookup Tables (Reference Data Management): the create / define / populate flow.
 *
 * Protocol: integration-tests/protocols/IT-050-lookup-tables-rdm.md
 * Gates: validates F-026 (UC-001 happy-path SQL-joinable table + UC-007 collision-500 pin +
 *        UC-010 PATCH cross-table-jump pin).
 *
 * Lookup Tables are operator-curated reference data stored as REAL Postgres tables in
 * lookup_tables_schema (the documented public surface downstream BI/ETL joins against). The full
 * lifecycle: POST /table (create) -> POST /table/{id}/columns (define schema) -> POST
 * /table/{id}/data (populate). Per F-026 use_case_coverage the whole user-facing promise layer is
 * UNGUARDED (only 2 service-tier unit tests exist; zero exercise a promise end-to-end).
 *
 *   F-026-UC-001 (CONFIRMED, happy-path green-lock): the create+define+populate flow yields a real
 *   SQL-joinable physical table (n_{nsId}__{slug}) whose columns + rows are readable DIRECTLY from
 *   lookup_tables_schema — i.e. the "reference data is SQL-joinable" contract the docs promise.
 *
 *   F-026-UC-007 (CONTRADICTED, LSN-029 pin): two table names that normalise to the same physical
 *   name in one namespace (buildTableName = name.toLowerCase().replace(' ','_'),
 *   ReferenceDataServiceImpl.java:191-194; no uniqueness pre-check at :73-86) collide at the DDL
 *   `CREATE TABLE` and surface a generic 500 (SYS001), not a friendly 409. Pinned GREEN on the 500.
 *
 *   F-026-UC-010 (CONTRADICTED, LSN-029 pin): updateLookupTableField discards the path
 *   lookup_table_id (ReferenceDataServiceImpl.java:126-143 takes only columnId), so PATCH
 *   /table/{A}/column/{col_of_B} mutates table B's column even though the caller addressed table A.
 *   The READ path (getLookupTableField:58-70) DOES enforce the parent-table linkage — the write
 *   path is asymmetric. Pinned GREEN on the cross-table PATCH succeeding + actually renaming B's
 *   physical column.
 *
 * Live + DB evidence (probe 2026-06-07): create->200 (auto id col); +columns->200 phys cols
 * [id,code,label]; +rows->200 phys rows [{id:1,code:US,label:United States},{id:2,code:CA,...}];
 * collision second create->500 SYS001; GET cross-table->400 "doesn't belong to", PATCH
 * cross-table->200 and B's physical column became "bcol_renamed".
 *
 * Collision-free: namespace it050_ns, names prefixed it050_, table/column ids read back from the
 * API (DB-serial). Band 20500-20509 reserved for this lane.
 */
const NS = 'it050_ns';

test.describe('F-026 Lookup Tables (RDM) — create / define / populate', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'it050_');
  });

  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'it050_');
  });

  test('UC-001: create + define columns + populate rows yields a SQL-joinable physical table (CONFIRMED)', async ({
    request,
  }) => {
    // ---- create ----
    const t = await createLookupTable(request, { name: 'it050_country_codes', namespace_name: NS });
    expect(t.fields.map((f) => f.name), 'create auto-provisions an id primary key column').toContain('id');

    // ---- define schema (two VARCHAR columns) ----
    const cols = await addColumns(request, t.table_id, [
      { name: 'code', field_type: 'VARCHAR', is_nullable: false },
      { name: 'label', field_type: 'VARCHAR' },
    ]);
    expect(cols.status, 'add columns -> 200').toBe(200);
    const codeF = cols.body.fields.find((f) => f.name === 'code')!;
    const labelF = cols.body.fields.find((f) => f.name === 'label')!;
    expect(codeF && labelF, 'both defined columns are returned by the API').toBeTruthy();

    // ---- populate two rows ----
    const rows = await addRows(request, t.table_id, [
      [
        { field_id: codeF.field_id, value: 'US' },
        { field_id: labelF.field_id, value: 'United States' },
      ],
      [
        { field_id: codeF.field_id, value: 'CA' },
        { field_id: labelF.field_id, value: 'Canada' },
      ],
    ]);
    expect(rows.status, 'add rows -> 200').toBe(200);
    expect(rows.body.items?.length, 'the API echoes both inserted rows').toBe(2);

    // ---- assert the PHYSICAL table is real + SQL-joinable (ground-truth, read straight from PG) ----
    const cat = await catalogRow(t.table_id);
    const phys = cat!.table_name;
    expect(phys, 'physical name follows n_{nsId}__{slug}').toMatch(/^n_\d+__it050_country_codes$/);
    expect(
      await physicalColumns(phys),
      'the physical reference table carries the defined columns (DDL CREATE/ALTER ran)',
    ).toEqual(['id', 'code', 'label']);
    expect(
      await physicalTableRowCount(phys),
      'UC-001: the populated rows are SQL-joinable straight from lookup_tables_schema (the documented public surface)',
    ).toBe(2);
    // and the actual values round-tripped verbatim
    const valueRows = await dbRows<{ code: string; label: string }>(
      `SELECT code, label FROM lookup_tables_schema."${phys}" ORDER BY id`,
    );
    const values = valueRows.map((row) => `${row.code}=${row.label}`);
    expect(values, 'the inserted reference data is readable verbatim downstream').toEqual([
      'US=United States',
      'CA=Canada',
    ]);
  });

  test('UC-007: two names normalising to the same physical name collide with a raw 500, not a 409 (CONTRADICTED pin)', async ({
    request,
  }) => {
    // First create succeeds and owns the physical name n_{ns}__it050_dup_name.
    const first = await request.post('/api/referencedata/table', {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it050_dup name', namespace_name: NS }, // space -> '_'
    });
    expect(first.status(), 'the first table claims the normalised physical name').toBe(200);

    // KNOWN BUG (PLT needed): buildTableName lossy-normalises and createLookupTable does NOT
    // pre-check uniqueness, so the colliding DDL `CREATE TABLE` raises a generic 500 (SYS001)
    // instead of a friendly 409 "lookup table with name X already exists in namespace Y".
    // F-026-UC-007 / facet build_table_name_lossy_normalisation_collision_500.
    const second = await request.post('/api/referencedata/table', {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it050_dup_name', namespace_name: NS }, // already underscored -> SAME physical name
    });
    expect(
      second.status(),
      'UC-007 pin: a normalisation collision currently yields a 500 (the contradicted promise). ' +
        'When the platform adds a uniqueness pre-check this becomes 409/400 and this pin flips RED.',
    ).toBe(500);
    const body = (await second.json()) as { code?: string };
    expect(body.code, 'the 500 is the generic SYS001 (no actionable collision message)').toBe('SYS001');
  });

  test('UC-010: PATCH /table/{A}/column/{col_of_B} mutates table B (path table-id discarded — cross-table jump, CONTRADICTED pin)', async ({
    request,
  }) => {
    // table A (the address the caller is authorised against) ...
    const tableA = await createLookupTable(request, { name: 'it050_table_a', namespace_name: NS });
    // ... and table B, whose column we will mutate THROUGH table A's URL.
    const tableB = await createLookupTable(request, { name: 'it050_table_b', namespace_name: NS });
    const colsB = await addColumns(request, tableB.table_id, [{ name: 'bcol', field_type: 'VARCHAR' }]);
    expect(colsB.status).toBe(200);
    const bCol = colsB.body.fields.find((f) => f.name === 'bcol')!;

    // The READ path enforces the parent-table linkage (symmetry baseline): GET via A's URL -> 400.
    const readCross = await request.get(`/api/referencedata/table/${tableA.table_id}/columns/${bCol.field_id}`);
    expect(
      readCross.status(),
      'baseline: the READ path correctly rejects a column that belongs to another table (400)',
    ).toBe(400);

    // KNOWN BUG (PLT needed): the WRITE path (updateLookupTableField) takes only columnId and drops
    // the path lookup_table_id, so PATCH succeeds regardless of which table the URL names — a caller
    // authorised on table A edits table B's column. F-026-UC-010 / facet
    // update_column_path_param_discarded_cross_table_jump.
    const patchCross = await request.patch(
      `/api/referencedata/table/${tableA.table_id}/columns/${bCol.field_id}`,
      { headers: { 'content-type': 'application/json' }, data: { name: 'it050_bcol_renamed' } },
    );
    expect(
      patchCross.status(),
      'UC-010 pin: the cross-table PATCH currently SUCCEEDS (200) — the contradicted promise. ' +
        'When the write path adds the column-belongs-to-table guard this becomes 400 and this pin flips RED.',
    ).toBe(200);

    // ground-truth: the rename actually landed on table B's PHYSICAL column (not table A).
    const catB = await catalogRow(tableB.table_id);
    expect(
      await physicalColumns(catB!.table_name),
      'the cross-table PATCH renamed table B\'s physical column (proving the path table-id was ignored)',
    ).toContain('it050_bcol_renamed');
    const catA = await catalogRow(tableA.table_id);
    expect(
      await physicalColumns(catA!.table_name),
      'table A (the addressed table) was untouched — only id column',
    ).toEqual(['id']);
  });
});

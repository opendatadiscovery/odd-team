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
 * Gates: validates F-026 (UC-001 happy-path SQL-joinable table + UC-007 collision rejected 400 +
 *        UC-010 PATCH cross-table guard + UC-011 DELETE cross-table guard).
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
 *   F-026-UC-007 (RE-GROUNDED RED->GREEN per LSN-029, odd-platform#1769 defect a): two names that
 *   normalise to the same physical name in one namespace (buildTableName = name.toLowerCase()
 *   .replace(' ','_')) USED to collide at the DDL `CREATE TABLE` and surface a generic 500 (SYS001).
 *   createLookupTable now pre-checks uniqueness (existsByTableName) and rejects the collision with an
 *   actionable 400 USR003 ("already exists in this namespace") — the platform's standard
 *   uniqueness-collision contract (ControllerAdvice maps UniqueConstraintException -> 400, ErrorCode
 *   .UNIQUE_CONSTRAINT = USR003). This was the LSN-029 collision-500 pin; it now asserts the FIX and
 *   stays RED on pre-fix main (where the second create still 500s).
 *
 *   F-026-UC-010 (RE-GROUNDED RED->GREEN per LSN-029, odd-platform#1769 defect b): updateLookupTableField
 *   USED to discard the path lookup_table_id (took only columnId), so PATCH /table/{A}/column/{col_of_B}
 *   mutated table B's column even though the caller addressed table A. The write path now enforces the
 *   SAME column-belongs-to-table guard the READ path (getLookupTableField) always has — a mismatched
 *   column-id is rejected with 400 "doesn't belong to" and table B is left untouched. This was the
 *   LSN-029 cross-table-jump pin; it now asserts the FIX and stays RED on pre-fix main.
 *
 *   F-026-UC-011 (NEW, odd-platform#1769 defect b twin): deleteLookupTableField had the IDENTICAL
 *   dropped-path-id defect and is destructive — DELETE /table/{A}/column/{col_of_B} dropped table B's
 *   column. It now enforces the same guard: a cross-table DELETE is rejected with 400 and B's column
 *   survives. RED on pre-fix main (where the cross-table DELETE 204s + drops B's column).
 *
 * Pre-fix live + DB evidence (probe 2026-06-07; reproduced on current main 2026-06-23): create->200
 * (auto id col); +columns->200 phys cols [id,code,label]; +rows->200; collision second create->500
 * SYS001; GET cross-table->400 "doesn't belong to", PATCH cross-table->200 + B's column renamed. The
 * fix flips the collision to 400 USR003 and the cross-table PATCH/DELETE to 400 (B untouched).
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

  test('UC-007: two names normalising to the same physical name are rejected with an actionable 400, not a raw 500 (re-grounded fix)', async ({
    request,
  }) => {
    // First create succeeds and owns the physical name n_{ns}__it050_dup_name.
    const first = await request.post('/api/referencedata/table', {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it050_dup name', namespace_name: NS }, // space -> '_'
    });
    expect(first.status(), 'the first table claims the normalised physical name').toBe(200);

    // FIX (odd-platform#1769 defect a): createLookupTable now pre-checks uniqueness (existsByTableName)
    // and rejects the normalisation collision with an actionable 400 USR003 instead of the old raw 500
    // SYS001. SoT for the expected status/code: the platform's uniqueness-collision contract
    // (ControllerAdvice maps UniqueConstraintException -> 400, ErrorCode.UNIQUE_CONSTRAINT = USR003).
    // F-026-UC-007 / facet build_table_name_lossy_normalisation_collision_500. Stays RED on pre-fix
    // main (where the second create still 500s with SYS001).
    const second = await request.post('/api/referencedata/table', {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it050_dup_name', namespace_name: NS }, // already underscored -> SAME physical name
    });
    expect(
      second.status(),
      're-grounded: a normalisation collision is now a client 400, not a server 500',
    ).toBe(400);
    const body = (await second.json()) as { code?: string; message?: string };
    expect(body.code, 'the collision maps to the platform uniqueness-collision code USR003').toBe('USR003');
    expect(
      (body.message ?? '').toLowerCase(),
      'the 400 carries an actionable "already exists" message (not the opaque SYS001 Internal Server Error)',
    ).toContain('already exists');
  });

  test('UC-010: PATCH /table/{A}/column/{col_of_B} is rejected (400) and table B is untouched (re-grounded fix)', async ({
    request,
  }) => {
    // table A (the address the caller uses) ...
    const tableA = await createLookupTable(request, { name: 'it050_table_a', namespace_name: NS });
    // ... and table B, whose column the caller will try to mutate THROUGH table A's URL.
    const tableB = await createLookupTable(request, { name: 'it050_table_b', namespace_name: NS });
    const colsB = await addColumns(request, tableB.table_id, [{ name: 'bcol', field_type: 'VARCHAR' }]);
    expect(colsB.status).toBe(200);
    const bCol = colsB.body.fields.find((f) => f.name === 'bcol')!;

    // The READ path always enforced the parent-table linkage (symmetry baseline): GET via A's URL -> 400.
    const readCross = await request.get(`/api/referencedata/table/${tableA.table_id}/columns/${bCol.field_id}`);
    expect(
      readCross.status(),
      'baseline: the READ path rejects a column that belongs to another table (400)',
    ).toBe(400);

    // FIX (odd-platform#1769 defect b): the WRITE path now enforces the SAME column-belongs-to-table
    // guard the READ path does, so a cross-table PATCH is rejected with 400 "doesn't belong to" instead
    // of mutating table B. F-026-UC-010 / facet update_column_path_param_discarded_cross_table_jump.
    // Stays RED on pre-fix main (where the cross-table PATCH still 200s + renames B).
    const patchCross = await request.patch(
      `/api/referencedata/table/${tableA.table_id}/columns/${bCol.field_id}`,
      { headers: { 'content-type': 'application/json' }, data: { name: 'it050_bcol_renamed' } },
    );
    expect(
      patchCross.status(),
      're-grounded: the cross-table PATCH is now rejected by the read-path guard (400)',
    ).toBe(400);

    // ground-truth: table B's PHYSICAL column was NOT renamed (the guard protected the wrong-addressed table).
    const bCols = await physicalColumns((await catalogRow(tableB.table_id))!.table_name);
    expect(bCols, 'table B still has its original bcol — the cross-table PATCH did not land').toContain('bcol');
    expect(bCols, 'table B was NOT renamed by the cross-table PATCH').not.toContain('it050_bcol_renamed');
  });

  test('UC-011: DELETE /table/{A}/column/{col_of_B} is rejected (400) and table B keeps its column (new — defect b twin)', async ({
    request,
  }) => {
    const tableA = await createLookupTable(request, { name: 'it050_del_a', namespace_name: NS });
    const tableB = await createLookupTable(request, { name: 'it050_del_b', namespace_name: NS });
    const colsB = await addColumns(request, tableB.table_id, [{ name: 'bcol', field_type: 'VARCHAR' }]);
    expect(colsB.status).toBe(200);
    const bCol = colsB.body.fields.find((f) => f.name === 'bcol')!;

    // FIX (odd-platform#1769 defect b twin): deleteLookupTableField had the same dropped-path-id defect
    // and is DESTRUCTIVE — it dropped a column off the wrong table. It now enforces the same
    // column-belongs-to-table guard. Stays RED on pre-fix main (cross-table DELETE 204s + drops B's column).
    const delCross = await request.delete(`/api/referencedata/table/${tableA.table_id}/columns/${bCol.field_id}`);
    expect(
      delCross.status(),
      're-grounded: the cross-table DELETE is rejected by the read-path guard (400)',
    ).toBe(400);

    // ground-truth: table B's PHYSICAL column survived (the destructive cross-table drop was blocked).
    expect(
      await physicalColumns((await catalogRow(tableB.table_id))!.table_name),
      'table B still has bcol — the cross-table DELETE did not drop it',
    ).toContain('bcol');
  });
});

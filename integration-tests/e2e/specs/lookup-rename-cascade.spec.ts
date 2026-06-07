import { test, expect } from '@playwright/test';
import {
  ensureNamespace,
  cleanupLookupTablesByPrefix,
  createLookupTable,
  catalogRow,
  physicalTableExists,
} from '../helpers/lookup';

/**
 * IT-048 — F-059 Lookup Table Rename Cascade: an operator metadata edit silently renames the
 * underlying physical Postgres reference table (DATA-LOSS risk).
 *
 * Protocol: integration-tests/protocols/IT-048-lookup-rename-cascade.md
 * Gates: validates F-059 (UC-001 destructive physical rename + UC-002 harmless edit guard).
 *
 * A lookup table is operator-curated reference data: its rows live in a REAL Postgres table in
 * `lookup_tables_schema` named n_{nsId}__{name.toLowerCase().replace(' ','_')}
 * (ReferenceDataServiceImpl.buildTableName:191-194). Downstream pipelines (dbt, BI, notebooks)
 * JOIN against that documented public surface by name. So "edit the table's name in the UI" — a
 * pure-metadata action to the operator — runs `ALTER TABLE ... RENAME TO` against the public
 * schema (ReferenceDataRepositoryImpl.updateLookupTable:191-201, line 192). There is NO alias
 * view, NO warning, NO audit event: the rename is a hidden side effect of a metadata edit.
 *
 *   F-059-UC-002 (CONFIRMED, success green-lock): the service short-circuits the DDL when the
 *   normalised physical name is UNCHANGED — `table.tablesPojo().getTableName().equals(tableDto
 *   .getTableName()) ? Mono.empty() : ...rename` (ReferenceDataServiceImpl.java:119-122). So a
 *   description-only edit (or a name change that normalises to the same physical name) leaves the
 *   physical table — and therefore every downstream join — intact.
 *
 *   F-059-UC-001 (CONTRADICTED, LSN-029 characterization pin): a name change that normalises to a
 *   DIFFERENT physical name renames the underlying table; the OLD physical relation no longer
 *   resolves. The operator expected a metadata-only rename. This test GREENs by reproducing the
 *   silent rename (the current, contradicted-promise behaviour); it flips RED the instant the
 *   platform decouples business-name from physical-name OR lands a deprecation alias (the fix in
 *   F-059 expected[a-c] / PLT below) — exactly the regression signal we want.
 *
 * Live + DB evidence captured 2026-06-07 (probe): create "it048 ..." -> table_name
 * n_{ns}__it048_..., physical table present in lookup_tables_schema; PUT rename -> catalog
 * table_name changes, OLD physical table_name "still exists? false", NEW "exists? true".
 *
 * Collision-free: namespace it048_ns, names prefixed it048_, table ids read back from the API
 * (DB-serial). Assigned id band 20480-20489 is reserved for this lane (used for any raw rows).
 */
const NS = 'it048_ns';

test.describe('F-059 Lookup Table Rename Cascade — metadata edit renames the physical table', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'it048_');
  });

  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'it048_');
  });

  test('UC-002: a description-only edit does NOT rename the physical table (harmless-edit guard, CONFIRMED)', async ({
    request,
  }) => {
    // ---- arrange: a lookup table backed by a real physical table ----
    const created = await createLookupTable(request, {
      name: 'it048_codes',
      namespace_name: NS,
      description: 'before',
    });
    const before = await catalogRow(created.table_id);
    expect(before, 'catalog row must exist after create').not.toBeNull();
    const physName = before!.table_name;
    expect(physName, 'physical name follows n_{nsId}__{slug}').toMatch(/^n_\d+__it048_codes$/);
    expect(
      await physicalTableExists(physName),
      'create must materialise the physical reference table in lookup_tables_schema',
    ).toBe(true);

    // ---- act: edit ONLY the description; the name (hence normalised physical name) is unchanged ----
    const res = await request.put(`/api/referencedata/table/${created.table_id}`, {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it048_codes', description: 'after' },
    });
    // NB the OpenAPI spec documents 201 for this PUT but the running platform returns 200
    // (verified live 2026-06-07) — assert the real contract, not the spec's stated code.
    expect(res.status(), 'a metadata edit must succeed').toBe(200);

    // ---- assert (UC-002 guard): the equals-guard short-circuited the DDL; physical table intact ----
    const after = await catalogRow(created.table_id);
    expect(after!.table_name, 'physical table_name is unchanged by a description-only edit').toBe(physName);
    expect(
      await physicalTableExists(physName),
      'UC-002: a description-only edit must NOT drop/rename the physical table (downstream joins survive)',
    ).toBe(true);
  });

  test('UC-001: renaming the table RENAMES the physical Postgres table; the old relation is gone (DATA-LOSS pin, CONTRADICTED)', async ({
    request,
  }) => {
    // ---- arrange: a lookup table downstream BI would join against by its physical name ----
    const created = await createLookupTable(request, {
      name: 'it048_customer_lookups',
      namespace_name: NS,
      description: 'revenue dashboard joins this',
    });
    const before = await catalogRow(created.table_id);
    const oldPhys = before!.table_name;
    expect(oldPhys).toMatch(/^n_\d+__it048_customer_lookups$/);
    expect(await physicalTableExists(oldPhys), 'precondition: old physical table exists').toBe(true);

    // ---- act: the operator renames the table in the UI (to "clarify the concept") ----
    // KNOWN BUG (PLT needed): this metadata edit silently runs ALTER TABLE ... RENAME TO on a
    // documented public schema. No alias view, no warning dialog, no audit event. See F-059-UC-001
    // / F-059 facet rename_cascade_breaks_documented_public_surface_silently (HIGH).
    const res = await request.put(`/api/referencedata/table/${created.table_id}`, {
      headers: { 'content-type': 'application/json' },
      data: { name: 'it048_customer_lookup_codes', description: 'revenue dashboard joins this' },
    });
    expect(res.status(), 'the rename must succeed (it is a normal metadata edit to the operator)').toBe(200);

    // ---- assert (UC-001 pin): the physical table was RENAMED — the old relation no longer resolves ----
    const after = await catalogRow(created.table_id);
    const newPhys = after!.table_name;
    expect(newPhys, 'the normalised physical name changed with the business name').toBe(
      oldPhys.replace('it048_customer_lookups', 'it048_customer_lookup_codes'),
    );
    expect(
      await physicalTableExists(newPhys),
      'the table now lives under the NEW physical name',
    ).toBe(true);
    // The contradicted promise, pinned GREEN: the OLD physical relation is GONE. A downstream
    // pipeline still issuing `SELECT ... FROM lookup_tables_schema.<oldPhys>` now errors
    // "relation does not exist" — silent breakage of the documented public surface.
    expect(
      await physicalTableExists(oldPhys),
      'DATA-LOSS pin: the OLD physical relation must be gone after a UI rename (downstream joins break silently). ' +
        'If this becomes true (old name still resolves), the platform gained an alias/decoupled the name — flip this pin.',
    ).toBe(false);
  });
});

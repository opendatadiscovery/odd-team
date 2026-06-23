import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-037 — F-055 Lineage Depth Boundary Contract.
 *
 * Protocol: integration-tests/protocols/IT-037-lineage-depth-boundary.md
 * Gates: validates F-055; pins DOC-GAP-089 / TEST-GAP-279 (unset-depth contract break).
 *
 * The downstream/upstream lineage endpoints take an OPTIONAL lineage_depth. The api-reference doc
 * states "Unset returns the platform's default depth". This was unimplementable until #1758: the impl
 * bound the param as a primitive int → null autoboxing threw → HTTP 500. FIXED in #1758 by declaring
 * `default: 1` on the parameter in the OpenAPI spec, so an omitted lineage_depth binds to 1 and the
 * existing entity's depth-1 graph returns 200 — matching the documented default. This spec now
 * regresses the FIXED contract (unset → 200, depth=1 → 200); it was a GREEN @pins of the 500 (LSN-029)
 * until the fix landed.
 */
const DS_ID = 2037;
const DS_ODDRN = '//e2e-it037/datasource';
const E = `${DS_ODDRN}/tables/it037_entity`;

async function ingestOne() {
  await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it037-ds');
  expect(await ingestEntities(DS_ODDRN, [tableEntity(E, 'it037_entity')]), 'entity ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the entity must exist after ingest').not.toBeNull();
  return e!.id;
}

test.describe('F-055 Lineage Depth Boundary Contract', () => {
  test('an explicit lineage_depth returns the lineage graph (200)', async ({ request }) => {
    const id = await ingestOne();
    const res = await request.get(`/api/dataentities/${id}/lineage/downstream?lineage_depth=1`);
    expect(res.status(), 'an explicit depth must return the graph (200)').toBe(200);
  });

  test('UNSET lineage_depth returns the default-depth graph (200), not a 500 — #1758 fixed', async ({
    request,
  }) => {
    const id = await ingestOne();
    // Re-grounded RED→GREEN on the #1758 fix (G-C15 / LSN-029): the doc promises a default-depth result
    // on omission; the fix declares `default: 1` in the OpenAPI spec, so an omitted lineage_depth binds
    // to 1 and the existing entity's depth-1 graph returns 200 (was a primitive-int NPE → 500 on base).
    // Still goes RED on ref:main (unset → 500 ≠ 200); green only on the fix.
    const res = await request.get(`/api/dataentities/${id}/lineage/downstream`);
    expect(res.status(), 'unset lineage_depth returns the default-depth graph (200) — #1758 fixed').toBe(200);
  });
});

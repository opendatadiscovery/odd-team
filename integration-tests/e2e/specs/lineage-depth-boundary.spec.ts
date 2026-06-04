import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-037 — F-055 Lineage Depth Boundary Contract.
 *
 * Protocol: integration-tests/protocols/IT-037-lineage-depth-boundary.md
 * Gates: validates F-055; pins DOC-GAP-089 / TEST-GAP-279 (unset-depth contract break).
 *
 * The downstream/upstream lineage endpoints take an OPTIONAL lineage_depth. The live api-reference
 * doc states "Unset returns the platform's default depth", but the impl binds the param as a
 * primitive int → null autoboxing throws → HTTP 500. So the documented unset contract is
 * unimplementable. Operator consequence: a caller (or the lineage canvas) that omits the depth gets
 * a 500, not a default graph. Confirmed live on this image (unset → 500, depth=1 → 200).
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

  test('PINS F-055/DOC-GAP-089: UNSET lineage_depth 500s (NPE) instead of the documented default', async ({
    request,
  }) => {
    const id = await ingestOne();
    // GREEN characterization pin (LSN-029) of the broken contract: the doc promises a default-depth
    // result on omission, but the primitive-int param NPEs → 500. Flip this to expect 200 the moment
    // the fix lands (Integer + a sensible default, OR spec change to required:true).
    const res = await request.get(`/api/dataentities/${id}/lineage/downstream`);
    expect(res.status(), 'unset lineage_depth currently 500s — the bug this pins').toBe(500);
  });
});

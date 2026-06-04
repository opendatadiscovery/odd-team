import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-039 — F-047 Dataset Field per-Column Surface (structure via REAL ingestion).
 *
 * Protocol: integration-tests/protocols/IT-039-dataset-structure-ingest.md
 * Gates: validates F-047 (ingested dataset columns appear on the dataset structure).
 *
 * A collector ingests a dataset with a column list; the platform must expose those columns on
 * GET /api/datasets/{id}/structure. Driven through the REAL ingestion contract (the prior raw-DB
 * seed hit a deserializeStats NPE; real ingest sets the field shape correctly → 200). Re-ingesting
 * with a new column must surface it (schema evolution). Operator consequence of failure: a dataset's
 * schema never appears / a column add never propagates.
 */
const DS_ID = 2039;
const DS_ODDRN = '//e2e-it039/datasource';
const E = `${DS_ODDRN}/tables/it039_table`;
const COL = 'it039_user_id';
const COL2 = 'it039_created_at';
const GHOST = 'it039_ghost_col';

const colField = (name: string) => ({
  oddrn: `${E}/columns/${name}`,
  name,
  type: { type: 'TYPE_STRING', logical_type: 'varchar', is_nullable: true },
});
const ingestWithColumns = (cols: string[]) =>
  ingestEntities(DS_ODDRN, [tableEntity(E, 'it039_table', { dataset: { field_list: cols.map(colField) } })]);

test.describe('F-047 Dataset Field — column structure via real ingestion', () => {
  test('an ingested dataset column appears on the dataset structure (and a ghost column does not)', async ({
    request,
  }) => {
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it039-ds');
    expect(await ingestWithColumns([COL]), 'entity+column ingest -> 200').toBe(200);
    const e = await entityByOddrn(E);
    expect(e, 'the entity must exist').not.toBeNull();

    const res = await request.get(`/api/datasets/${e!.id}/structure`);
    expect(res.status(), 'structure -> 200 (real ingest, no deserializeStats NPE)').toBe(200);
    const body = await res.text();
    expect(body, 'the ingested column must appear in the structure').toContain(COL);
    expect(body, 'a never-ingested column must NOT appear').not.toContain(GHOST);
  });

  test('re-ingesting with a new column surfaces it on the structure (schema evolution)', async ({ request }) => {
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it039-ds');
    expect(await ingestWithColumns([COL]), 'initial ingest -> 200').toBe(200);
    expect(await ingestWithColumns([COL, COL2]), 're-ingest with an added column -> 200').toBe(200);
    const e = await entityByOddrn(E);
    expect(e).not.toBeNull();

    const res = await request.get(`/api/datasets/${e!.id}/structure`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body, 'the newly-added column must appear after re-ingest').toContain(COL2);
  });
});

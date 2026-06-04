import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity, numberField, ingestNumberFieldStats } from '../helpers/ingest';

/**
 * IT-044 — F-095 Statistics Ingestion (per-column stats persist + read back).
 *
 * Protocol: integration-tests/protocols/IT-044-stats-ingestion.md
 * Gates: validates F-095 (the dataset-statistics ingestion endpoint persists per-field stats).
 *
 * A collector pushes per-column statistics via POST /ingestion/entities/datasets/stats; the platform
 * must persist them onto the dataset's fields and serve them on GET /api/datasets/{id}/structure.
 * Verified shape (read, not guessed): DataSetFieldStat.number_stats (a wrong wrapper key is silently
 * ignored → a hollow 201, so we assert the READ-BACK, never the POST status alone). Operator
 * consequence of failure: pushed column statistics silently vanish.
 */
const DS_ID = 2044;
const DS = '//e2e-it044/ds';
const E = `${DS}/tables/it044_tbl`;
const F_STATS = `${E}/columns/amount`;
const F_NOSTATS = `${E}/columns/qty`;
const UNIQUE = 4242;

test.describe('F-095 Statistics Ingestion — per-column stats persist + read back', () => {
  test('ingested number-field stats read back on the structure; a field with no stats carries none', async ({
    request,
  }) => {
    await seedIngestionDataSource(DS_ID, DS, 'it044-ds');
    expect(
      await ingestEntities(DS, [
        tableEntity(E, 'it044_tbl', { dataset: { field_list: [numberField(F_STATS, 'amount'), numberField(F_NOSTATS, 'qty')] } }),
      ]),
      'entity + two number fields ingest -> 200',
    ).toBe(200);
    const e = await entityByOddrn(E);
    expect(e, 'the dataset entity must exist').not.toBeNull();

    // push stats for ONLY the 'amount' field
    expect(
      await ingestNumberFieldStats(E, F_STATS, 'amount', {
        low_value: 1,
        high_value: 100,
        mean_value: 50,
        median_value: 50,
        nulls_count: 0,
        unique_count: UNIQUE,
      }),
      'stats POST -> 201',
    ).toBe(201);

    const res = await request.get(`/api/datasets/${e!.id}/structure`);
    expect(res.status(), 'structure -> 200').toBe(200);
    const json = (await res.json()) as { field_list?: Array<{ name?: string; stats?: { number_stats?: { unique_count?: number } | null } }> };
    const fields = json.field_list ?? [];
    const amount = fields.find((f) => f.name === 'amount');
    const qty = fields.find((f) => f.name === 'qty');

    expect(amount?.stats?.number_stats?.unique_count, "the 'amount' field's ingested unique_count must read back").toBe(
      UNIQUE,
    );
    expect(qty?.stats?.number_stats ?? null, "the 'qty' field had NO stats ingested -> number_stats must be null").toBeNull();
  });
});

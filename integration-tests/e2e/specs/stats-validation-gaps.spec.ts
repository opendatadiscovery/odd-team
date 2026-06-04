import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity, numberField } from '../helpers/ingest';

/**
 * IT-045 — F-095 Statistics Ingestion: INPUT-VALIDATION gaps (pins PLT-142).
 *
 * Protocol: integration-tests/protocols/IT-045-stats-validation-gaps.md
 * Gates: validates F-095 (UC-11/UC-10/UC-5) · pins PLT-142 (stats endpoint has no input validation).
 *
 * The stats ingestion endpoint (POST /ingestion/entities/datasets/stats) performs NO validation:
 *  - UC-11: an empty/null body 500s (server error) instead of a clean 4xx.
 *  - UC-10: stats keyed by an unknown/typo'd field ODDRN are silently accepted (201) — no failure signal.
 *  - UC-5:  out-of-range stats (negative counts, inverted min/max) are stored verbatim, not rejected/normalised.
 * All three are LSN-029 characterization pins: GREEN while the gap exists, RED when validation lands.
 * Operator consequence: garbage column statistics enter the catalog silently; a typo'd ODDRN is a no-op
 * with no signal to the collector author.
 */
const STATS = '/ingestion/entities/datasets/stats';
const JSON_HEADERS = { 'content-type': 'application/json' };
const DS_ID = 2045;
const DS = '//e2e-it045/ds';
const E = `${DS}/tables/it045_tbl`;
const F = `${E}/columns/amount`;
const GHOST = `${E}/columns/ghost_field`;

async function ingestDatasetWithField(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it045-ds');
  expect(
    await ingestEntities(DS, [tableEntity(E, 'it045_tbl', { dataset: { field_list: [numberField(F, 'amount')] } })]),
    'entity+field ingest -> 200',
  ).toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  return e!.id;
}

test.describe('F-095 Statistics Ingestion — input-validation gaps (PLT-142)', () => {
  test('PINS PLT-142 (UC-11): an empty / null stats body 500s instead of a clean 4xx', async ({ request }) => {
    expect((await request.post(STATS, { data: '', headers: JSON_HEADERS })).status(), 'empty body -> 500 (bug)').toBe(500);
    expect((await request.post(STATS, { data: 'null', headers: JSON_HEADERS })).status(), 'null body -> 500 (bug)').toBe(500);
  });

  test('PINS PLT-142 (UC-10): stats for an unknown/typo field ODDRN are silently accepted (201)', async ({ request }) => {
    await ingestDatasetWithField(request);
    const res = await request.post(STATS, {
      headers: JSON_HEADERS,
      data: { items: [{ dataset_oddrn: E, fields: { [GHOST]: { name: 'ghost', number_stats: { nulls_count: 0, unique_count: 7 } } } }] },
    });
    expect(res.status(), 'an unknown field ODDRN is silently accepted (201) — no 4xx / warning to the collector').toBe(201);
  });

  test('PINS PLT-142 (UC-5): out-of-range stats (negative counts, inverted min/max) are stored verbatim', async ({ request }) => {
    const id = await ingestDatasetWithField(request);
    const post = await request.post(STATS, {
      headers: JSON_HEADERS,
      data: { items: [{ dataset_oddrn: E, fields: { [F]: { name: 'amount', number_stats: { low_value: 100, high_value: 1, nulls_count: -5, unique_count: -9 } } } }] },
    });
    expect(post.status(), 'out-of-range stats accepted (201)').toBe(201);

    const struct = await request.get(`/api/datasets/${id}/structure`);
    expect(struct.status()).toBe(200);
    const json = (await struct.json()) as { field_list?: Array<{ name?: string; stats?: { number_stats?: { low_value?: number; high_value?: number; nulls_count?: number } | null } }> };
    const ns = (json.field_list ?? []).find((f) => f.name === 'amount')?.stats?.number_stats;
    expect(ns, 'the field must carry the pushed stats').not.toBeNull();
    expect(ns!.nulls_count, 'negative nulls_count stored verbatim (no validation)').toBe(-5);
    expect((ns!.low_value ?? 0) > (ns!.high_value ?? 0), 'inverted min/max stored verbatim (low_value > high_value)').toBe(true);
  });
});

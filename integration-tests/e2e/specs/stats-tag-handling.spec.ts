import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity, numberField } from '../helpers/ingest';

/**
 * IT-047 — F-095 Statistics Ingestion: tag handling (UC-6 anon mint + UC-7 re-push replace).
 *
 * Protocol: integration-tests/protocols/IT-047-stats-tag-handling.md
 * Gates: validates F-095 (UC-6 tags created via stats ingestion + UC-7 re-push tag reconciliation).
 *
 * The stats endpoint accepts a `tags` block per field (DataSetFieldStat.tags). Two unverified F-095
 * promises, both CONTRADICTED (LSN-029 characterization pins, read-back-confirmed):
 *  - UC-6: under DISABLED, tags pushed via stats are created + linked to the field by an ANONYMOUS caller
 *    (no TAG_CREATE permission required) — the DISABLED open posture extends to tag minting.
 *  - UC-7: a re-push OMITTING a previously-sent tag SILENTLY DROPS it (replace, not merge). This is the
 *    producer-tag (EXTERNAL_STATISTICS) replace semantics — correct for a full push, but a transient /
 *    partial scrape silently loses tags. (INTERNAL/UI-curated tags are NOT clobbered — see F-095-UC-9.)
 */
const DS_ID = 2047;
const DS = '//e2e-it047/ds';
const E = `${DS}/tables/it047_tbl`;
const F = `${E}/columns/c`;
const STATS_URL = '/ingestion/entities/datasets/stats';
const H = { 'content-type': 'application/json' };

async function pushFieldTags(request: APIRequestContext, tags: string[]): Promise<number> {
  const res = await request.post(STATS_URL, {
    headers: H,
    data: { items: [{ dataset_oddrn: E, fields: { [F]: { name: 'c', number_stats: { nulls_count: 0, unique_count: 5 }, tags: tags.map((t) => ({ name: t })) } } }] },
  });
  return res.status();
}

async function fieldTags(request: APIRequestContext, id: number): Promise<string[]> {
  const res = await request.get(`/api/datasets/${id}/structure`);
  expect(res.status()).toBe(200);
  const json = (await res.json()) as { field_list?: Array<{ name?: string; tags?: Array<{ name?: string }> }> };
  return (json.field_list ?? []).find((f) => f.name === 'c')?.tags?.map((t) => t.name ?? '') ?? [];
}

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it047-ds');
  expect(
    await ingestEntities(DS, [tableEntity(E, 'it047_tbl', { dataset: { field_list: [numberField(F, 'c')] } })]),
    'entity+field ingest -> 200',
  ).toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  return e!.id;
}

test.describe('F-095 Statistics Ingestion — tag handling', () => {
  test('UC-6: tags pushed via stats are created + linked to the field (anonymous, under DISABLED)', async ({ request }) => {
    const id = await setup(request);
    expect(await pushFieldTags(request, ['it047_tagA', 'it047_tagB']), 'stats+tags -> 201').toBe(201);
    expect(await fieldTags(request, id), 'both pushed tags created + linked anonymously').toEqual(
      expect.arrayContaining(['it047_tagA', 'it047_tagB']),
    );
  });

  test('UC-7: a re-push omitting a previously-sent tag SILENTLY DROPS it (replace, not merge)', async ({ request }) => {
    const id = await setup(request);
    expect(await pushFieldTags(request, ['it047_tagA', 'it047_tagB'])).toBe(201);
    expect(await fieldTags(request, id), 'precondition: both tags present').toEqual(
      expect.arrayContaining(['it047_tagA', 'it047_tagB']),
    );
    expect(await pushFieldTags(request, ['it047_tagA']), 're-push (omit tagB) -> 201').toBe(201);
    const tags = await fieldTags(request, id);
    expect(tags, 'UC-7: the still-declared tag is preserved').toContain('it047_tagA');
    expect(tags, 'UC-7: the omitted tag is SILENTLY DROPPED (replace, not merge — partial-scrape caveat)').not.toContain(
      'it047_tagB',
    );
  });
});

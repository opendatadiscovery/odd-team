import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn, setEntityLastIngestedDaysAgo } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-041 — F-208 Data Entity Staleness Indicator.
 *
 * Protocol: integration-tests/protocols/IT-041-entity-staleness.md
 * Gates: validates F-208 (is_stale reflects time-since-last-ingest; re-ingest clears it).
 *
 * An entity not re-ingested for longer than the deployment stale-period is flagged is_stale (the
 * orange-clock signal) so operators can spot a collector that stopped feeding it. Verified live: the
 * default period is active even with no explicit `odd.data-entity-stale-period` env (30d-old → stale),
 * which DISPROVES the F-208-UC-2 "unset silently disables the signal" concern on this image.
 * Operator consequence of failure: a dead collector goes unnoticed (stale data trusted as fresh).
 */
const DS_ID = 2041;
const DS_ODDRN = '//e2e-it041/datasource';
const E = `${DS_ODDRN}/tables/it041_table`;

async function isStale(request: APIRequestContext, id: number): Promise<boolean> {
  const res = await request.get(`/api/dataentities/${id}`);
  expect(res.status(), 'entity detail -> 200').toBe(200);
  return ((await res.json()) as { is_stale?: boolean }).is_stale === true;
}

async function ingestFresh(): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it041-ds');
  expect(await ingestEntities(DS_ODDRN, [tableEntity(E, 'it041_table')]), 'ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the entity must exist').not.toBeNull();
  return e!.id;
}

test.describe('F-208 Data Entity Staleness Indicator', () => {
  test('a just-ingested entity is fresh; one not re-ingested past the period is stale', async ({ request }) => {
    const id = await ingestFresh();
    expect(await isStale(request, id), 'a just-ingested entity must NOT be stale').toBe(false);

    await setEntityLastIngestedDaysAgo(id, 30);
    expect(await isStale(request, id), 'an entity not re-ingested for 30 days must be flagged stale').toBe(true);
  });

  test('re-ingesting a stale entity clears the staleness flag', async ({ request }) => {
    const id = await ingestFresh();
    await setEntityLastIngestedDaysAgo(id, 30);
    expect(await isStale(request, id), 'precondition: the entity is stale').toBe(true);

    expect(await ingestEntities(DS_ODDRN, [tableEntity(E, 'it041_table')]), 're-ingest -> 200').toBe(200);
    expect(await isStale(request, id), 're-ingestion (refreshing last_ingested_at) must clear staleness').toBe(false);
  });
});

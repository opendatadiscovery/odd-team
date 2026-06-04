import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, ingestMetrics, tableEntity, gaugeFamily, getEntityMetricsBody } from '../helpers/ingest';

/**
 * IT-036 — F-030 Metrics Ingestion (collector → platform → read-back).
 *
 * Protocol: integration-tests/protocols/IT-036-metrics-ingestion.md
 * Gates: validates F-030 (the metrics ingestion + serve-back contract).
 *
 * A collector pushes metric families for an entity via POST /ingestion/metrics; the platform must
 * persist them and serve them back on GET /api/dataentities/{id}/metrics. The actor is the collector
 * (an ingestion feature), so this drives the real ingestion endpoint + the read API end-to-end.
 * Operator consequence of failure: pushed metrics silently vanish (data loss) or never render.
 */
const DS_ID = 2036;
const DS_ODDRN = '//e2e-it036/datasource';
const E_POS = `${DS_ODDRN}/tables/it036_with_metrics`;
const E_NEG = `${DS_ODDRN}/tables/it036_no_metrics`;
const FAMILY = 'it036_http_requests';
const VALUE = 4242; // distinctive so a body.contains() is unambiguous

test.describe('F-030 Metrics Ingestion — collector ingests metrics, platform serves them back', () => {
  test('ingested metrics persist and are read back on the entity', async () => {
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it036-ds');
    expect(await ingestEntities(DS_ODDRN, [tableEntity(E_POS, 'it036_with_metrics')]), 'entity ingest -> 200').toBe(200);
    const e = await entityByOddrn(E_POS);
    expect(e, 'the entity must exist after ingest').not.toBeNull();

    expect(await ingestMetrics(E_POS, [gaugeFamily(FAMILY, VALUE, 'req/sec')]), 'metrics ingest -> 201').toBe(201);

    const { status, body } = await getEntityMetricsBody(e!.id);
    expect(status, 'GET /api/dataentities/{id}/metrics -> 200').toBe(200);
    expect(body, 'the ingested metric family must be readable back').toContain(FAMILY);
    expect(body, 'the ingested gauge value must be served back').toContain(String(VALUE));
  });

  test('an entity with no ingested metrics returns no metric family (no phantom metrics)', async () => {
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it036-ds');
    expect(await ingestEntities(DS_ODDRN, [tableEntity(E_NEG, 'it036_no_metrics')]), 'entity ingest -> 200').toBe(200);
    const e = await entityByOddrn(E_NEG);
    expect(e, 'the entity must exist').not.toBeNull();

    const { status, body } = await getEntityMetricsBody(e!.id);
    expect(status, 'GET metrics -> 200').toBe(200);
    expect(body, 'an entity with no metrics must NOT carry another entity metric family').not.toContain(FAMILY);
  });
});

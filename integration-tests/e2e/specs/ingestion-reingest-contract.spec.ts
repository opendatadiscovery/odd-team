import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-035 — F-008 Batch Ingestion (S2S API): the ingestion-write CONTRACT.
 *
 * Protocol: integration-tests/protocols/IT-035-ingestion-reingest-contract.md
 * Gates: validates F-008 (UC-13 re-ingest reconciliation + UC-06 batch atomicity).
 *
 * F-008 is the platform's largest + most destructive write surface (LSN-001 class). These
 * are the first integration tests that drive the REAL ingestion endpoint (POST
 * /ingestion/entities) rather than raw-DB seeding — the prior PHASE3 plateau's unlock.
 *
 * UC-13 (data-loss guard): a collector that, on one tick, scrapes only a SUBSET of a
 * datasource's entities must NOT cause the omitted entities to be destroyed. The operator
 * consequence of failure is silent catalog data loss on a transient partial scrape.
 *
 * UC-06 (atomicity): a malformed batch (here: a duplicate ODDRN within one payload) must be
 * rejected as a whole — never partially applied. Source: IngestionServiceImpl.persistDataEntities
 * collects items via Collectors.toMap(getOddrn, identity) (IngestionServiceImpl.java:83-86),
 * which throws on a duplicate key BEFORE any DB write.
 */
const DS_ID = 2035;
const DS_ODDRN = '//e2e-it035/datasource';
const A = `${DS_ODDRN}/tables/it035_a`;
const B = `${DS_ODDRN}/tables/it035_b`;

test.describe('F-008 Batch Ingestion — ingestion-write contract', () => {
  test('UC-13: re-ingesting a subset does NOT destroy the omitted entity (non-destructive)', async () => {
    // ---- arrange: a datasource the ingestion API resolves the items against ----
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it035-ds');

    // ---- act 1: ingest BOTH a and b ----
    expect(
      await ingestEntities(DS_ODDRN, [tableEntity(A, 'it035_a'), tableEntity(B, 'it035_b')]),
      'the initial two-entity ingest must succeed (200)',
    ).toBe(200);
    const bFull = await entityByOddrn(B);
    expect(bFull, 'b must exist after the full ingest').not.toBeNull();
    expect(bFull!.hollow, 'b must be a live (non-hollow) entity after a direct ingest').toBe(false);

    // ---- act 2: re-ingest ONLY a (b is omitted — the transient partial scrape) ----
    expect(
      await ingestEntities(DS_ODDRN, [tableEntity(A, 'it035_a')]),
      'the partial re-ingest must succeed (200)',
    ).toBe(200);

    // ---- assert (UC-13 contract): b must SURVIVE — omitting it must not delete or hollow it ----
    const bPartial = await entityByOddrn(B);
    expect(
      bPartial,
      'UC-13 data-loss guard: omitting b from a re-ingest must NOT hard-delete it',
    ).not.toBeNull();
    expect(
      bPartial!.hollow,
      'UC-13 data-loss guard: omitting b from a re-ingest must NOT silently hollow it (replace-not-merge)',
    ).toBe(false);
  });

  test('UC-06: a duplicate ODDRN within one payload is rejected whole — never partially applied', async () => {
    await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it035-ds');
    const dup = `${DS_ODDRN}/tables/it035_dup`;

    // two items sharing one oddrn → IngestionServiceImpl.toMap throws BEFORE any DB write
    const status = await ingestEntities(DS_ODDRN, [tableEntity(dup, 'dup1'), tableEntity(dup, 'dup2')]);
    expect(
      status,
      'UC-06: a duplicate-ODDRN batch must be rejected (>=400) — currently a 500 crash (toMap IllegalStateException)',
    ).toBeGreaterThanOrEqual(400);

    // atomicity: nothing from the rejected batch was persisted (no partial write)
    expect(
      await entityByOddrn(dup),
      'UC-06 atomicity: a rejected batch must leave NO partial rows',
    ).toBeNull();
  });
});

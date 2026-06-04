import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, lineageEdgeExists } from '../helpers/db';
import { ingestEntities, tableEntity, transformerEntity } from '../helpers/ingest';

/**
 * IT-043 — F-008/F-005 lineage via ingestion + UC-13 (the lineage-edge half).
 *
 * Protocol: integration-tests/protocols/IT-043-lineage-ingestion-reconcile.md
 * Gates: validates F-005 (lineage established by ingestion) + F-008 (UC-13 re-ingest reconciliation, edge half).
 *
 * Verified empirically (not guessed): ingesting a JOB transformer with data_transformer.inputs=[A],
 * outputs=[B] creates TWO lineage edges A→job and job→B. Re-ingesting the job with outputs=[] REMOVES
 * the omitted job→B edge (replaceLineagePaths — replace, not merge). This is the edge-level half of
 * F-008-UC-13 (IT-035 already covered the entity level: omitted ENTITIES survive — non-destructive).
 *
 * Operator caveat the pin documents: a transient / incomplete collector scrape of a job (fewer outputs
 * than reality) SILENTLY DROPS the missing lineage edges — the LSN-001 silent-loss class, at the edge level.
 */
const DS_ID = 2043;
const DS = '//e2e-it043/ds';
const A = `${DS}/tables/it043_src`;
const B = `${DS}/tables/it043_tgt`;
const T = `${DS}/jobs/it043_job`;

async function establishPipeline(): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it043-ds');
  return ingestEntities(DS, [tableEntity(A, 'it043_src'), tableEntity(B, 'it043_tgt'), transformerEntity(T, 'it043_job', [A], [B])]);
}

test.describe('F-005/F-008 lineage via ingestion — establish + re-ingest reconciliation (UC-13 edge half)', () => {
  test('ingesting a transformer establishes input→job→output lineage edges', async () => {
    expect(await establishPipeline(), 'pipeline ingest -> 200').toBe(200);
    expect(await lineageEdgeExists(A, T), 'the input→job lineage edge must exist after ingest').toBe(true);
    expect(await lineageEdgeExists(T, B), 'the job→output lineage edge must exist after ingest').toBe(true);
  });

  test('UC-13 edge half: re-ingesting the job without an output removes the omitted edge (replace, not merge)', async () => {
    expect(await establishPipeline(), 'establish -> 200').toBe(200);
    expect(await lineageEdgeExists(T, B), 'precondition: the job→output edge exists').toBe(true);

    // re-ingest ONLY the job, now declaring NO outputs → replaceLineagePaths drops the omitted edge
    expect(await ingestEntities(DS, [transformerEntity(T, 'it043_job', [A], [])]), 're-ingest -> 200').toBe(200);
    expect(
      await lineageEdgeExists(T, B),
      'UC-13: a partial re-ingest (job re-declared with fewer outputs) REMOVES the omitted lineage edge — ' +
        'replace, not merge. Operator caveat: a transient/incomplete scrape silently drops lineage edges.',
    ).toBe(false);
  });
});

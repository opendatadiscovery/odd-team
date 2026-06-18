import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, IngestEntity } from '../helpers/ingest';

/**
 * IT-136 — ML_MODEL ingestion type mapping (opendatadiscovery/odd-platform#1725, CTRIB-021,
 * ADR ml-entity-taxonomy).
 *
 * Protocol: integration-tests/protocols/IT-136-ml-model-ingestion-type.md
 *
 * The ingestion contract advertises `ML_MODEL`, but the platform had no internal counterpart, so
 * `IngestionMapperImpl` (DataEntityTypeDto.valueOf) threw IllegalArgumentException → an opaque 500
 * (#1725). The fix makes ML_MODEL the model-identity GROUP and resolves a wire ML_MODEL by payload
 * shape: data_consumer → ML_MODEL_ARTIFACT, data_entity_group → ML_MODEL, data_transformer →
 * ML_MODEL_TRAINING; an unmappable contract type → a clean 400.
 *
 * RED on ODD_SUT=ref:main: step 1/2 ingest returns 500 (the bug); step 3 returns 500 (UNKNOWN unmapped).
 */
const DS_ID = 21360;
const DS = '//e2e-it136/ds';
const BASE = process.env.ODD_BASE_URL ?? 'http://127.0.0.1:18080';

// Read an ingested entity's resolved type via the catalog API (the read-back path that, when the
// platform-API output enum lacks the value, 500s — babaMar's secondary error on #1725).
async function entityTypeName(id: number): Promise<string | null> {
  const res = await fetch(`${BASE}/api/dataentities/${id}`);
  if (!res.ok) throw new Error(`GET /api/dataentities/${id} -> ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { type?: { name?: string } };
  return body.type?.name ?? null;
}

test.describe('IT-136 — ML_MODEL ingestion type mapping (#1725, ADR ml-entity-taxonomy)', () => {
  test('ML_MODEL + data_consumer ingests (200) and reads back as ML_MODEL_ARTIFACT (was a 500 on main)', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it136-ds');
    const oddrn = `${DS}/consumer/chatbot`;
    const item = {
      oddrn,
      name: 'Chatbot',
      type: 'ML_MODEL',
      metadata: [],
      data_consumer: { inputs: [`${DS}/input/features`] },
    } as unknown as IngestEntity;

    expect(
      await ingestEntities(DS, [item]),
      'POST /ingestion/entities {type:ML_MODEL, data_consumer} -> 200 (the #1725 fix; was an opaque 500)',
    ).toBe(200);

    const e = await entityByOddrn(oddrn);
    expect(e, 'the ML_MODEL (consumer-shaped) entity persisted').not.toBeNull();
    expect(
      await entityTypeName(e!.id),
      'read-back: a consumer-shaped ML_MODEL is the trained model artifact (no secondary read-back 500)',
    ).toBe('ML_MODEL_ARTIFACT');
  });

  test('ML_MODEL + data_entity_group ingests (200) and reads back as the ML_MODEL group identity', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it136-ds');
    const memberOddrn = `${DS}/consumer/member-model`;
    const groupOddrn = `${DS}/group/churn-model`;
    const member = {
      oddrn: memberOddrn,
      name: 'member-model',
      type: 'ML_MODEL',
      metadata: [],
      data_consumer: { inputs: [] },
    } as unknown as IngestEntity;
    const group = {
      oddrn: groupOddrn,
      name: 'churn-model',
      type: 'ML_MODEL',
      metadata: [],
      data_entity_group: { entities_list: [memberOddrn] },
    } as unknown as IngestEntity;

    expect(
      await ingestEntities(DS, [member, group]),
      'a batch with an ML_MODEL group + its member -> 200',
    ).toBe(200);

    const g = await entityByOddrn(groupOddrn);
    expect(g, 'the ML_MODEL group entity persisted').not.toBeNull();
    expect(
      await entityTypeName(g!.id),
      'read-back: an ML_MODEL with a data_entity_group payload is the model-identity group type',
    ).toBe('ML_MODEL');
  });

  test('an unmappable ingestion type (UNKNOWN) is a clean 400, not an unmapped 500', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it136-ds');
    const item = {
      oddrn: `${DS}/unknown/x`,
      name: 'x',
      type: 'UNKNOWN',
      metadata: [],
      data_consumer: { inputs: [] },
    } as unknown as IngestEntity;

    expect(
      await ingestEntities(DS, [item]),
      'a contract type with no internal counterpart -> a graceful 400, never a 500',
    ).toBe(400);
  });
});

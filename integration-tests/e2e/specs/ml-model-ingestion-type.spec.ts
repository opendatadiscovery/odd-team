import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity, IngestEntity } from '../helpers/ingest';

/**
 * IT-136 — ML_MODEL ingestion maps 1:1 to the contract (opendatadiscovery/odd-platform#1725, CTRIB-021,
 * ADR ml-entity-taxonomy).
 *
 * Protocol: integration-tests/protocols/IT-136-ml-model-ingestion-type.md
 *
 * The ingestion contract advertises `ML_MODEL`, but the platform had no internal counterpart, so
 * `DataEntityTypeDto.valueOf("ML_MODEL")` threw IllegalArgumentException -> an opaque 500 (#1725). The fix
 * adds `ML_MODEL` to the internal enum as the model-identity GROUP, so the platform maps the contract type
 * 1:1 by name (NO payload-shape inference in the platform -- the specification is the contract). Consequences:
 *  - `ML_MODEL` + a data_entity_group payload ingests (200) and reads back as `ML_MODEL` (the group identity).
 *  - `ML_MODEL` is a GROUP, so a data_consumer-shaped `ML_MODEL` is a contract violation -> a clean 4xx
 *    (use `ML_MODEL_ARTIFACT` for a consumer-model -- added to the spec via SPC-004), NOT the pre-fix 500.
 *
 * RED on ODD_SUT=ref:main: both cases return 500 (the internal enum lacks ML_MODEL).
 */
const DS_ID = 21360;
const DS = '//e2e-it136/ds';
const BASE = process.env.ODD_BASE_URL ?? 'http://127.0.0.1:18080';

// Read an ingested entity's resolved type via the catalog API (the read-back path that, when the
// platform-API output enum lacks the value, 500s -- the secondary error on #1725).
async function entityTypeName(id: number): Promise<string | null> {
  const res = await fetch(`${BASE}/api/dataentities/${id}`);
  if (!res.ok) throw new Error(`GET /api/dataentities/${id} -> ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { type?: { name?: string } };
  return body.type?.name ?? null;
}

test.describe('IT-136 — ML_MODEL ingestion 1:1 (#1725, ADR ml-entity-taxonomy)', () => {
  test('ML_MODEL + data_entity_group ingests (200) and reads back as the ML_MODEL group identity (was a 500 on main)', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it136-ds');
    const memberOddrn = `${DS}/tables/member`;
    const groupOddrn = `${DS}/group/churn-model`;
    const member = tableEntity(memberOddrn, 'member-table');
    const group = {
      oddrn: groupOddrn,
      name: 'churn-model',
      type: 'ML_MODEL',
      metadata: [],
      data_entity_group: { entities_list: [memberOddrn] },
    } as unknown as IngestEntity;

    expect(
      await ingestEntities(DS, [member, group]),
      'a batch with an ML_MODEL group + a member -> 200 (the #1725 fix; was an opaque 500)',
    ).toBe(200);

    const g = await entityByOddrn(groupOddrn);
    expect(g, 'the ML_MODEL group entity persisted').not.toBeNull();
    expect(
      await entityTypeName(g!.id),
      'read-back: ML_MODEL maps 1:1 to the model-identity group type (no secondary read-back 500)',
    ).toBe('ML_MODEL');
  });

  test('ML_MODEL is a group: a data_consumer-shaped ML_MODEL is a clean 4xx (use ML_MODEL_ARTIFACT), not a 500', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it136-ds');
    const item = {
      oddrn: `${DS}/consumer/chatbot`,
      name: 'Chatbot',
      type: 'ML_MODEL',
      metadata: [],
      data_consumer: { inputs: [`${DS}/input/features`] },
    } as unknown as IngestEntity;

    // ML_MODEL is the model-identity GROUP (per the contract/taxonomy). A consumer-model must be sent as
    // ML_MODEL_ARTIFACT (added to the ingestion spec via SPC-004). The platform does NOT silently re-map by
    // payload shape -- a consumer-shaped ML_MODEL is a type-vs-class contract violation: a clean 4xx, not a 500.
    expect(
      await ingestEntities(DS, [item]),
      'a consumer-shaped ML_MODEL is a clean 4xx (contract violation), never a 500',
    ).toBe(400);
  });
});

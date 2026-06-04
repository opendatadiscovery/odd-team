import { test, expect } from '@playwright/test';
import { seedIngestionDataSource } from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-046 — F-008 DISABLED-mode open posture: anonymous WRITE + anonymous collector/token minting.
 *
 * Protocol: integration-tests/protocols/IT-046-ingestion-disabled-open-posture.md
 * Gates: validates F-008 (UC-01 anonymous write + UC-10 anonymous collector/token creation under DISABLED).
 *
 * Under the SHIPPED DEFAULT auth.type=DISABLED, the platform permits every request (no credential).
 * Two LSN-029 characterization pins of that posture — GREEN under DISABLED, they flip the moment the
 * default becomes fail-closed (or these surfaces get gated):
 *  - UC-01: an anonymous caller WRITES via POST /ingestion/entities (the platform's most destructive surface).
 *  - UC-10: an anonymous caller MINTS a collector + a usable 40-char S2S token via POST /api/collectors.
 *
 * Operator caveat (the reason to pin): a DISABLED deployment is FULLY OPEN — any network caller can write
 * the catalog AND mint S2S credentials. DISABLED is for trusted networks only; do not run it on an
 * internet-exposed deployment.
 */
const DS_ID = 2046;
const DS = '//e2e-it046/ds';

test.describe('F-008 DISABLED-mode open posture', () => {
  test('UC-01: under DISABLED, an anonymous (no-credential) caller can WRITE via POST /ingestion/entities', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it046-ds');
    // the ingest helper sends NO Authorization header; under DISABLED the entities filter is off -> it writes.
    expect(
      await ingestEntities(DS, [tableEntity(`${DS}/tables/it046_anon`, 'it046_anon')]),
      'UC-01: an anonymous POST /ingestion/entities succeeds (200) under DISABLED — no credential required',
    ).toBe(200);
  });

  test('UC-10: under DISABLED, an anonymous caller MINTS a collector + a usable S2S token via POST /api/collectors', async ({
    request,
  }) => {
    const res = await request.post('/api/collectors', {
      headers: { 'content-type': 'application/json' },
      data: { name: `it046-col-${Date.now()}`, namespace_name: 'it046-ns' },
    });
    expect(res.status(), 'anonymous collector creation succeeds (200) under DISABLED').toBe(200);
    const token = ((await res.json()) as { token?: { value?: string } }).token?.value ?? '';
    expect(token.length, 'a usable S2S token is minted anonymously (non-empty value)').toBeGreaterThan(0);
  });
});

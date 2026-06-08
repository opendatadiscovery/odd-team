import { test, expect } from '@playwright/test';
import { seedIngestionDataSource, entityByOddrn } from '../helpers/db';
import { ingestEntities, tableEntity, IngestEntity } from '../helpers/ingest';

/**
 * IT-061 — F-096 Ingestion Batch Atomicity & Error Contract: malformed-item-mid-batch + empty-batch.
 *
 * Protocol: integration-tests/protocols/IT-061-ingestion-batch-atomicity.md
 * Gates: validates F-096 (H-001 all-or-nothing rollback · the client-error-vs-5xx error contract · H-? empty-batch 400).
 *
 * POST /ingestion/entities runs the WHOLE batch (datasource lookup + entity upsert + processor chain +
 * OTLP export) inside ONE @ReactiveTransactional (IngestionServiceImpl.ingest:66-73). The response is
 * binary — 200 OK or a 5xx/4xx with no per-item breakdown (Mono<ResponseEntity<Void>>). IT-035 already
 * covers the duplicate-ODDRN-in-one-payload case (500 via Collectors.toMap). This protocol exercises a
 * DIFFERENT failure: a MALFORMED item (missing required `type`) sitting MID-BATCH next to a valid one,
 * plus the empty-batch contract.
 *
 * - SUCCESS (H-001 direction): a 2-item all-valid batch returns 200 and BOTH entities are persisted —
 *   the atomic transaction commits as a unit.
 * - CORNER 1 (H-001 rollback + error-contract drift): a batch [valid, malformed-no-type] returns 500
 *   (NOT a precise 400), AND the valid sibling is NOT persisted — the whole batch rolled back. The
 *   atomicity guarantee is CONFIRMED (no half-applied catalog); the ERROR CONTRACT is the drift (the
 *   collector author gets an opaque 500 `SYS001`, indistinguishable from a platform crash, with no
 *   indication WHICH item or WHY). KNOWN BUG (PLT-045 family — client error surfaces as 5xx; F-096
 *   facet `client_error_surfaces_as_5xx`). The 500 half is a characterization pin: it flips the day a
 *   @ExceptionHandler maps the malformed-item case to a 4xx.
 * - CORNER 2 (clean contract, CONFIRM): an EMPTY items[] batch returns 400 `USR001` "Ingestion payload
 *   is empty" — the controller's `.filter(isNotEmpty).switchIfEmpty(BadUserRequestException)` short-circuit
 *   (IngestionController.postDataEntityList:40-42). This is the one error path with a precise, resolvable
 *   client-error contract; the pin guards it from regressing into a 200-no-op or a 5xx.
 *
 * GROUNDED LIVE (2026-06-07, anon under DISABLED, against a registered datasource):
 *   [valid, {oddrn,name,metadata} no type] -> 500 SYS001; the valid sibling `good1` -> 0 rows (rolled back).
 *   { items: [] } -> 400 {"code":"USR001","message":"Ingestion payload is empty"}.
 *   2x valid -> 200, both rows present.
 *
 * Operator consequence: a custom-collector author who ships one bad item in a 100-item batch loses the
 * whole batch (correct — no partial catalog) but is told only "500" — they cannot tell "you sent bad
 * data" from "the platform fell over", so they write blind retry-with-backoff against a permanent error.
 *
 * Namespacing: it061_ ids/oddrns, distinct datasource id 20610. Idempotent re-seed.
 */
const DS_ID = 20610;
const DS = '//e2e-it061/ds';

// a structurally malformed ingestion item: required `type` omitted. Jackson/validation rejects it,
// which the service surfaces as a generic 500 (no @ExceptionHandler for the malformed-item case).
function malformedNoType(oddrn: string, name: string): IngestEntity {
  return { oddrn, name, metadata: [] } as unknown as IngestEntity;
}

test.describe('F-096 Batch Atomicity & Error Contract — malformed-mid-batch + empty', () => {
  test('H-001 (success direction): an all-valid multi-item batch commits atomically — 200 and every entity persisted', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it061-ds');
    const a = `${DS}/tables/it061_ok_a`;
    const b = `${DS}/tables/it061_ok_b`;

    expect(
      await ingestEntities(DS, [tableEntity(a, 'it061_ok_a'), tableEntity(b, 'it061_ok_b')]),
      'an all-valid 2-item batch succeeds (200)',
    ).toBe(200);

    expect(await entityByOddrn(a), 'H-001: first entity of the committed batch is persisted').not.toBeNull();
    expect(await entityByOddrn(b), 'H-001: second entity of the committed batch is persisted').not.toBeNull();
  });

  test('H-001 (rollback) + error-contract: a malformed item mid-batch returns 500 (opaque) AND rolls back the valid sibling (KNOWN BUG PLT-045, 500-half is a RED pin)', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it061-ds');
    const good = `${DS}/tables/it061_mixed_good`;
    const bad = `${DS}/tables/it061_mixed_bad`;

    // pre-state: the good entity must not already exist (so a post-state presence can only come from THIS batch)
    expect(await entityByOddrn(good), 'precondition: the good entity does not exist before the mixed batch').toBeNull();

    // ---- act: a batch whose 2nd item is malformed (no `type`) ----
    const status = await ingestEntities(DS, [tableEntity(good, 'it061_mixed_good'), malformedNoType(bad, 'it061_mixed_bad')]);

    // ERROR-CONTRACT DRIFT: the client error surfaces as an opaque 5xx, not a precise 4xx.
    // This is the characterization half — GREEN now, flips RED when the malformed-item case maps to 4xx.
    expect(
      status,
      'error contract (KNOWN BUG): a malformed item yields an opaque 500 SYS001 — no per-item 400/422 diagnostic for the collector author',
    ).toBe(500);

    // ATOMICITY (CONFIRMED): the valid sibling in the same batch was rolled back — the catalog is never half-applied.
    expect(
      await entityByOddrn(good),
      'H-001 atomicity: the valid sibling of a failed batch is NOT persisted (whole batch rolled back, no partial write)',
    ).toBeNull();
  });

  test('empty-batch contract: an empty items[] payload returns a precise 400 USR001, never a 200 no-op or a 5xx', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it061-ds');

    // hit the endpoint directly so we can read the error BODY, not just the status the helper returns.
    const res = await fetch(`${BASE()}/ingestion/entities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data_source_oddrn: DS, items: [] }),
    });
    expect(
      res.status,
      'empty-batch contract: an empty payload is a precise client error (400), not a 200 no-op nor a 5xx',
    ).toBe(400);

    const body = (await res.json()) as { code?: string; message?: string; resolvable?: boolean };
    expect(body.code, 'empty-batch error code is the USR001 bad-request code').toBe('USR001');
    expect(
      (body.message ?? '').toLowerCase(),
      'empty-batch error message names the empty payload (a resolvable, precise diagnostic)',
    ).toContain('empty');
  });
});

function BASE(): string {
  return process.env.ODD_BASE_URL ?? 'http://localhost:18080';
}

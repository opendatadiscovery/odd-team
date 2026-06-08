import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-051 — F-076 Cross-Management cascade-on-delete protection (Owner / Namespace / DataSource).
 *
 * Protocol: integration-tests/protocols/IT-051-cascade-on-delete-protection.md
 * Gates: validates F-076 (UC H-001 cascade-block + allowed-delete) · characterization-pins F-076 H-007
 *        (the missing 4th cascade leg — owner_association_request does NOT block an Owner delete).
 *
 * The promise (F-076 H-001): a Management parent (Owner / Namespace / DataSource) that still has a
 * live referent CANNOT be deleted (the cascade-check blocks it); one with no referents CAN. Verified
 * end-to-end against the running platform — the protective behaviour is real, but had ZERO e2e coverage
 * (F-076 sat at 1/12 verified promises, the one verified only at the unit tier).
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080):
 *  - DELETE a referenced DataSource  -> 400 USR004 "Data source cannot be deleted: there are still
 *    data entities attached" (DataSourceServiceImpl.java:87-95 → CascadeDeleteException → ControllerAdvice
 *    @ResponseStatus(BAD_REQUEST), ErrorCode.CASCADE_DELETE = "USR004"). Row stays (deleted_at IS NULL).
 *  - DELETE a referenced Namespace   -> 400 USR004 "Namespace cannot be deleted: there are still
 *    resources attached" (NamespaceServiceImpl.java:74-90, 4-leg check).
 *  - DELETE a referenced Owner        -> 400 USR004 "Owner cannot be deleted: there are still resources
 *    attached" (OwnerServiceImpl.java:88-100, 3-leg check).
 *  - DELETE an EMPTY parent           -> 204 + the row is soft-deleted (deleted_at set, hidden from list).
 *
 * The contract is 400 + USR004 — NOT the 409 the F-076 frontmatter floated as a hypothesis. We assert
 * the REAL behaviour (status 400 AND the USR004 error code AND the row surviving).
 *
 * NB this is the DATA-LOSS-class feature: the cascade-block is the only thing standing between an
 * operator's Delete click and an orphaned referent. A RED here means a parent with live children became
 * deletable (orphaning rows) OR an empty parent stopped being deletable (a teardown regression).
 *
 * Auth: odd-minimal default auth.type=DISABLED → anon DELETE reaches the service (the DELETE security
 * rules in SecurityConstants are bypassed under DISABLED). This test exercises the SERVICE-TIER cascade
 * gate, which is mode-independent.
 *
 * Namespace: ids 20510-20519 only; names prefixed it051_; oddrn //e2e-it051/. Idempotent seeds.
 */

const DS_BLOCKED_ID = 20510;
const DS_BLOCKED_ENTITY_ID = 20511;
const NS_BLOCKED_ID = 20512;
const NS_BLOCKED_DS_ID = 20513;
const OWNER_BLOCKED_ID = 20514;
const OWNER_BLOCKED_DS_ID = 20515;
const OWNER_BLOCKED_ENTITY_ID = 20516;
const OWNER_BLOCKED_TITLE_ID = 20517;
const OWNER_EMPTY_ID = 20518;
const OWNER_OAR_ID = 20519;

interface ErrBody {
  code?: string;
  message?: string;
}

test.describe('F-076 cascade-on-delete protection — a referenced Management parent cannot be deleted', () => {
  test('SUCCESS/H-001: a DataSource with a live data entity cannot be deleted (400 USR004), and the row survives', async ({
    request,
  }) => {
    // arrange: a data source + a non-deleted data entity that references it (the cascade referent)
    await dbQuery(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET oddrn = EXCLUDED.oddrn, name = EXCLUDED.name, deleted_at = NULL`,
      [DS_BLOCKED_ID, '//e2e-it051/ds-blocked', 'it051_ds_blocked'],
    );
    // NB image schema: data_entity has NO deleted_at (uses `hollow`/`status`); a freshly-inserted row
    // is "non-deleted" (status defaults to a non-DELETED value), which is what existsNonDeletedByDataSourceId
    // counts. So a plain insert is a valid live referent — no soft-delete column to set.
    await dbQuery(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count, source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET data_source_id = EXCLUDED.data_source_id`,
      [DS_BLOCKED_ENTITY_ID, '//e2e-it051/ds-blocked/tables/t', 'it051_blocked_t', DS_BLOCKED_ID],
    );

    const res = await request.delete(`/api/datasources/${DS_BLOCKED_ID}`);
    expect(
      res.status(),
      'a referenced DataSource delete must be REJECTED with 400 (CascadeDeleteException → ControllerAdvice BAD_REQUEST)',
    ).toBe(400);
    const body = (await res.json()) as ErrBody;
    expect(body.code, 'the cascade-block error code must be USR004 (ErrorCode.CASCADE_DELETE)').toBe('USR004');

    // the parent must SURVIVE (no soft-delete happened) — the data-loss guard held
    const rows = await dbQuery<{ alive: number }>(
      'SELECT count(*)::int AS alive FROM data_source WHERE id = $1 AND deleted_at IS NULL',
      [DS_BLOCKED_ID],
    );
    expect(rows[0].alive, 'the blocked DataSource must remain (not soft-deleted)').toBe(1);
  });

  test('CORNER/H-001: a Namespace referenced by a data source cannot be deleted (400 USR004), and the row survives', async ({
    request,
  }) => {
    await dbQuery(
      `INSERT INTO namespace (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL`,
      [NS_BLOCKED_ID, 'it051_ns_blocked'],
    );
    // reference it: a data source whose namespace_id points at the namespace (NamespaceServiceImpl leg 1)
    await dbQuery(
      `INSERT INTO data_source (id, oddrn, name, namespace_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET namespace_id = EXCLUDED.namespace_id, deleted_at = NULL`,
      [NS_BLOCKED_DS_ID, '//e2e-it051/ds-for-ns', 'it051_ds_for_ns', NS_BLOCKED_ID],
    );

    const res = await request.delete(`/api/namespaces/${NS_BLOCKED_ID}`);
    expect(res.status(), 'a referenced Namespace delete must be REJECTED with 400').toBe(400);
    expect(((await res.json()) as ErrBody).code, 'cascade-block code USR004').toBe('USR004');

    const rows = await dbQuery<{ alive: number }>(
      'SELECT count(*)::int AS alive FROM namespace WHERE id = $1 AND deleted_at IS NULL',
      [NS_BLOCKED_ID],
    );
    expect(rows[0].alive, 'the blocked Namespace must remain (not soft-deleted)').toBe(1);
  });

  test('CORNER/H-001: an Owner referenced by an ownership row cannot be deleted (400 USR004), and the row survives', async ({
    request,
  }) => {
    await dbQuery(
      `INSERT INTO owner (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL`,
      [OWNER_BLOCKED_ID, 'it051_owner_blocked'],
    );
    // reference it via an ownership row (OwnerServiceImpl leg 2: ownershipRepository.existsByOwner)
    await dbQuery(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [OWNER_BLOCKED_DS_ID, '//e2e-it051/ds-for-owner', 'it051_ds_for_owner'],
    );
    await dbQuery(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count, source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
      [OWNER_BLOCKED_ENTITY_ID, '//e2e-it051/ds-for-owner/t', 'it051_owner_t', OWNER_BLOCKED_DS_ID],
    );
    await dbQuery(`INSERT INTO title (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OWNER_BLOCKED_TITLE_ID,
      'it051_title',
    ]);
    await dbQuery('DELETE FROM ownership WHERE data_entity_id = $1 AND owner_id = $2', [
      OWNER_BLOCKED_ENTITY_ID,
      OWNER_BLOCKED_ID,
    ]);
    await dbQuery('INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $3)', [
      OWNER_BLOCKED_ENTITY_ID,
      OWNER_BLOCKED_ID,
      OWNER_BLOCKED_TITLE_ID,
    ]);

    const res = await request.delete(`/api/owners/${OWNER_BLOCKED_ID}`);
    expect(res.status(), 'a referenced Owner delete must be REJECTED with 400').toBe(400);
    expect(((await res.json()) as ErrBody).code, 'cascade-block code USR004').toBe('USR004');

    const rows = await dbQuery<{ alive: number }>(
      'SELECT count(*)::int AS alive FROM owner WHERE id = $1 AND deleted_at IS NULL',
      [OWNER_BLOCKED_ID],
    );
    expect(rows[0].alive, 'the blocked Owner must remain (not soft-deleted)').toBe(1);
  });

  test('CORNER/H-001 (allowed side): an Owner with NO referents IS deleted (204) and soft-deleted', async ({
    request,
  }) => {
    // arrange: an owner with zero ownership / termOwnership / userOwnerMapping rows
    await dbQuery(
      `INSERT INTO owner (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL`,
      [OWNER_EMPTY_ID, 'it051_owner_empty'],
    );
    await dbQuery('DELETE FROM ownership WHERE owner_id = $1', [OWNER_EMPTY_ID]);

    const res = await request.delete(`/api/owners/${OWNER_EMPTY_ID}`);
    expect(res.status(), 'an unreferenced Owner delete must SUCCEED (204 No Content)').toBe(204);

    // soft-delete semantics: the row is retained but deleted_at is set (ReactiveAbstractSoftDeleteCRUDRepository)
    const rows = await dbQuery<{ gone: boolean }>(
      'SELECT (deleted_at IS NOT NULL) AS gone FROM owner WHERE id = $1',
      [OWNER_EMPTY_ID],
    );
    expect(rows[0]?.gone, 'the deleted Owner must be soft-deleted (deleted_at set), not hard-removed').toBe(true);
  });

  test('CORNER/H-007 (KNOWN BUG pin): an Owner referenced ONLY by an owner_association_request is STILL deleted — the cascade omits the OAR leg, orphaning the request row', async ({
    request,
  }) => {
    // KNOWN BUG (PLT-needed, REFACTOR-427): OwnerServiceImpl.delete checks 3 legs — termOwnership,
    // ownership, userOwnerMapping (OwnerServiceImpl.java:90-91) — but OMITS owner_association_request.
    // F-076 H-007 promises the Owner delete is "blocked by every owner-bearing referent, including
    // owner_association_request rows". Reality (verified live 2026-06-07): the delete SUCCEEDS (204) and
    // leaves an orphan OAR row pointing at the now-soft-deleted Owner.
    //
    // This is an LSN-029 characterization pin: it asserts the CURRENT (wrong) behaviour, so it stays
    // GREEN today and turns RED the instant a 4th cascade leg is added — which is exactly when the
    // promise becomes true and this pin must be flipped to assert the block.
    await dbQuery(
      `INSERT INTO owner (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL`,
      [OWNER_OAR_ID, 'it051_owner_oar'],
    );
    // referent: ONLY an owner_association_request row (no ownership / termOwnership / userOwnerMapping)
    await dbQuery('DELETE FROM ownership WHERE owner_id = $1', [OWNER_OAR_ID]);
    await dbQuery('DELETE FROM owner_association_request WHERE owner_id = $1', [OWNER_OAR_ID]);
    await dbQuery(
      `INSERT INTO owner_association_request (username, owner_id, status, created_at)
       VALUES ($1, $2, 'PENDING', NOW())`,
      ['it051_oar_user', OWNER_OAR_ID],
    );

    const res = await request.delete(`/api/owners/${OWNER_OAR_ID}`);
    // CURRENT (buggy) behaviour: the OAR leg is not checked, so the delete is allowed.
    expect(
      res.status(),
      'KNOWN BUG: an Owner referenced only by an OAR row is deletable (the cascade omits the OAR leg)',
    ).toBe(204);

    const orphan = await dbQuery<{ orphans: number }>(
      'SELECT count(*)::int AS orphans FROM owner_association_request WHERE owner_id = $1',
      [OWNER_OAR_ID],
    );
    expect(
      orphan[0].orphans,
      'KNOWN BUG: the OAR row is orphaned — it still points at the now-deleted Owner (REFACTOR-427)',
    ).toBe(1);
  });

  test.afterAll(async () => {
    // tidy the shared stack — remove every it051_ probe row in FK-safe order
    await dbQuery('DELETE FROM ownership WHERE owner_id = ANY($1::bigint[])', [[OWNER_BLOCKED_ID]]);
    await dbQuery('DELETE FROM owner_association_request WHERE owner_id = ANY($1::bigint[])', [[OWNER_OAR_ID]]);
    await dbQuery('DELETE FROM owner WHERE id = ANY($1::bigint[])', [
      [OWNER_BLOCKED_ID, OWNER_EMPTY_ID, OWNER_OAR_ID],
    ]);
    await dbQuery('DELETE FROM title WHERE id = ANY($1::bigint[])', [[OWNER_BLOCKED_TITLE_ID]]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [
      [DS_BLOCKED_ENTITY_ID, OWNER_BLOCKED_ENTITY_ID],
    ]);
    await dbQuery('UPDATE data_source SET namespace_id = NULL WHERE id = ANY($1::bigint[])', [[NS_BLOCKED_DS_ID]]);
    await dbQuery('DELETE FROM data_source WHERE id = ANY($1::bigint[])', [
      [DS_BLOCKED_ID, NS_BLOCKED_DS_ID, OWNER_BLOCKED_DS_ID],
    ]);
    await dbQuery('DELETE FROM namespace WHERE id = ANY($1::bigint[])', [[NS_BLOCKED_ID]]);
  });
});

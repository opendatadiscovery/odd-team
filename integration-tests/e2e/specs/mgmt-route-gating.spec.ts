import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-053 — F-105 Management Section Route Gating: reads bypass authorization; under DISABLED so do mutations.
 *
 * Protocol: integration-tests/protocols/IT-053-mgmt-route-gating.md
 * Gates: validates F-105 (UC H-001 reads are not gated · H-002 the lone gated surface) and characterizes
 *        the DISABLED-mode posture where even the one gated read + every gated mutation are open.
 *
 * F-105 is the Management-section route-gating posture: of the Management surfaces, only the
 * owner-association area is gated at all (SecurityConstants has a SecurityRule only on the OAR *pending*
 * list GET, requiring OWNER_ASSOCIATION_MANAGE — SecurityConstants.java:148-150; the UI mirrors this with
 * the sole RestrictedRoute on /management/associations). Every other Management read falls through to the
 * `.authenticated()` catch-all (AuthorizationCustomizer.java:29-30) — i.e. NOT permission-gated. Mutations
 * DO carry *_CREATE/*_UPDATE/*_DELETE rules. But the SHIPPED DEFAULT auth.type=DISABLED collapses ALL of
 * this: `.anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:13-18) means an anonymous
 * caller reaches BOTH the one gated read AND every gated mutation.
 *
 * This spec characterizes the ACTUAL posture at the API tier (the UI route-gating is a separate RTL/e2e
 * surface; this pins the HTTP authorization model the SPA sits on):
 *  - H-001: a Management read (the OAR pending list) that IS permission-gated under enforcing modes is
 *    nevertheless served to an anonymous caller under DISABLED — reads bypass gating.
 *  - mutation posture: a gated mutation (POST /api/tags ⇒ TAG_CREATE; DELETE /api/tags/{id} ⇒ TAG_DELETE)
 *    succeeds anonymously under DISABLED — the mutation gate is bypassed too.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080): GET /api/owner_association_request
 * (the gated pending list) → 200 anon with status param; POST /api/tags → 200 anon; the created tag is
 * then DELETE-able → 204 anon.
 *
 * Operator caveat this PINS: under DISABLED the entire authorization model is inert — anonymous callers
 * both READ the full admin catalog and MUTATE it. The permission rules in SecurityConstants only take
 * effect in an enforcing mode (LOGIN_FORM/OAUTH2/LDAP). A RED here means the DISABLED posture changed.
 *
 * Namespace: ids 20530-20539 only; names prefixed it053_. Idempotent.
 */

const ENFORCING_GATED_READ = '/api/owner_association_request?page=1&size=10&status=PENDING';
const TAG_NAME = 'it053_route_tag';

interface TagItem {
  id?: number;
  name?: string;
}

test.describe('F-105 Management route gating — reads bypass authz; under DISABLED mutations do too', () => {
  test('H-001: a read that is permission-gated under enforcing modes (OAR pending list) is served to an anonymous caller under DISABLED', async ({
    request,
  }) => {
    // /api/owner_association_request GET is the ONE Management read with a SecurityRule
    // (OWNER_ASSOCIATION_MANAGE). Under an enforcing mode an anon caller is rejected; under DISABLED the
    // SecurityWebFilterChain permitAll bypasses the rule, so the read is served. (Requires status param.)
    const res = await request.get(ENFORCING_GATED_READ);
    expect(
      res.status(),
      'under DISABLED the OAR pending-list gate is bypassed — an anonymous caller is served (200), not 401/403',
    ).toBe(200);
    expect(res.headers()['content-type'] ?? '', 'a real JSON read (not the SPA fallback)').toContain(
      'application/json',
    );
    expect(JSON.parse(await res.text()), 'the gated read returns a paged list body').toHaveProperty('items');
  });

  test('mutation posture: a GATED mutation (POST /api/tags ⇒ TAG_CREATE) succeeds anonymously under DISABLED, and the created row is then anonymously DELETE-able (TAG_DELETE)', async ({
    request,
  }) => {
    // clean any prior run
    await dbQuery('DELETE FROM tag WHERE name = $1', [TAG_NAME]);

    // POST /api/tags carries the TAG_CREATE SecurityRule (SecurityConstants.java:138). Under DISABLED the
    // gate is bypassed → an anonymous create succeeds.
    const createRes = await request.post('/api/tags', {
      headers: { 'content-type': 'application/json' },
      data: [{ name: TAG_NAME, important: false }],
    });
    expect(
      createRes.status(),
      'under DISABLED an anonymous POST /api/tags succeeds (the TAG_CREATE gate is bypassed)',
    ).toBe(200);
    const created = (await createRes.json()) as TagItem[];
    const tagId = created.find((t) => t.name === TAG_NAME)?.id;
    expect(tagId, 'the anonymously-created tag has a real id (DB write happened)').toBeTruthy();

    // ground-truth read-back: the tag row really exists
    const rows = await dbQuery<{ n: number }>('SELECT count(*)::int AS n FROM tag WHERE id = $1 AND name = $2', [
      tagId,
      TAG_NAME,
    ]);
    expect(rows[0].n, 'the created tag is present in the DB').toBe(1);

    // DELETE /api/tags/{id} carries TAG_DELETE — also bypassed under DISABLED.
    const delRes = await request.delete(`/api/tags/${tagId}`);
    expect(
      delRes.status(),
      'under DISABLED an anonymous DELETE /api/tags/{id} succeeds (the TAG_DELETE gate is bypassed)',
    ).toBe(204);

    // the mutation truly took effect — `tag` is soft-deleted (deleted_at set), so no LIVE row remains
    // (verified live: DELETE /api/tags/{id} sets deleted_at; live-row count drops to 0).
    const after = await dbQuery<{ n: number }>(
      'SELECT count(*)::int AS n FROM tag WHERE id = $1 AND name = $2 AND deleted_at IS NULL',
      [tagId, TAG_NAME],
    );
    expect(after[0].n, 'the anonymous delete soft-deleted the tag (no live row remains)').toBe(0);
  });

  test.afterAll(async () => {
    await dbQuery('DELETE FROM tag WHERE name = $1', [TAG_NAME]);
  });
});

import { test, expect } from '@playwright/test';

/**
 * IT-038 — F-123 Deletion Semantics Per-Resource Contract.
 *
 * Protocol: integration-tests/protocols/IT-038-deletion-recreate-semantics.md
 * Gates: validates F-123 (soft-delete must not block re-creation of the same name).
 *
 * F-123 (DATA-LOSS axis): a resource that is deleted and then re-created with the SAME name must
 * succeed — a soft-deleted row must not leave a unique-constraint landmine that blocks the operator
 * from re-creating it. Verified here for DataSource (create → DELETE → re-create same name+oddrn).
 * Operator consequence of failure: "name already exists" on a name the operator just deleted —
 * a confusing, data-loss-adjacent dead end.
 */
const NS = 'it038-ns';
const dsBody = (name: string, oddrn: string) => ({ name, oddrn, namespace_name: NS });

test.describe('F-123 Deletion Semantics — soft-delete must not block re-creation', () => {
  test('UC-1: delete a datasource, then re-create one with the same name+oddrn succeeds', async ({ request }) => {
    const name = 'it038_recreate_ds';
    const oddrn = '//it038/recreate-ds';

    const c1 = await request.post('/api/datasources', { data: dsBody(name, oddrn) });
    expect(c1.status(), 'initial create -> 200').toBe(200);
    const id1 = (await c1.json()).id as number;

    const del = await request.delete(`/api/datasources/${id1}`);
    expect(del.status(), 'delete -> 204').toBe(204);

    const c2 = await request.post('/api/datasources', { data: dsBody(name, oddrn) });
    expect(
      c2.status(),
      'UC-1: re-creating the same name+oddrn after delete must SUCCEED (no soft-deleted-row collision)',
    ).toBe(200);
  });

  test('delete is effective — the deleted datasource is gone from the active list', async ({ request }) => {
    const name = 'it038_deleted_ds';
    const oddrn = '//it038/deleted-ds';

    const c = await request.post('/api/datasources', { data: dsBody(name, oddrn) });
    expect(c.status()).toBe(200);
    const id = (await c.json()).id as number;
    expect((await request.delete(`/api/datasources/${id}`)).status()).toBe(204);

    const list = await request.get('/api/datasources?page=1&size=1000');
    expect(list.status(), 'datasource list -> 200').toBe(200);
    // .json() throws on the SPA HTML fallback → a real failure, never a false pass
    const json = (await list.json()) as { items?: Array<{ oddrn?: string }> };
    const oddrns = (json.items ?? []).map((d) => d.oddrn);
    expect(oddrns, 'the deleted datasource must not appear in the active list').not.toContain(oddrn);
  });
});

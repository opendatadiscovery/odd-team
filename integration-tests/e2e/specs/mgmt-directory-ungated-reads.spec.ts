import { test, expect } from '@playwright/test';
import { dbQuery, seedDataSource, seedOwner } from '../helpers/db';

/**
 * IT-052 — F-074 Management directory list endpoints are universally ungated reads (DISABLED posture).
 *
 * Protocol: integration-tests/protocols/IT-052-mgmt-directory-ungated-reads.md
 * Gates: validates F-074 (UC H-003 anonymous full-directory read under DISABLED · H-006 the forensic OAR
 *        activity log is anonymously reachable). Characterization pin of the documented open-read posture.
 *
 * The posture (F-074, implicit ADR-CANDIDATE-003 "read-collaborative"): every Management directory LIST
 * endpoint is an UNGATED read — none carries a *_READ permission, none has a GET SecurityRule (verified
 * SecurityConstants.java:98-355: zero *_READ entries; the only GET rule is OWNER_ASSOCIATION_MANAGE on the
 * OAR *pending* list). All other list GETs fall through to AuthorizationCustomizer's catch-all
 * `.authenticated()` (AuthorizationCustomizer.java:29-30). Under the SHIPPED DEFAULT auth.type=DISABLED,
 * the SecurityWebFilterChain is `.anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:13-18),
 * so an ANONYMOUS (no-credential) caller reads the full directory.
 *
 * GROUND TRUTH (probed live 2026-06-07, ODD_STACK_EXTERNAL=1 :18080): anon GET → 200 + JSON on
 * /api/owners, /api/namespaces, /api/tags, /api/datasources, /api/collectors, /api/titles, /api/policies,
 * /api/roles, /api/owners/providers, and /api/owner_association_request/activity (with the required
 * status param).
 *
 * Why assert BODY not status alone: a 200 on an unknown route could be the SPA's index.html fallback. We
 * assert the response is JSON AND contains a row we seeded — proving the real directory read fired, not a
 * fallback. (The activity endpoint asserts the JSON list shape — it has no seedable referent here.)
 *
 * Operator caveat this PINS (the reason to characterize, not "fix"): a DISABLED deployment is FULLY OPEN —
 * any network caller reads the entire Management catalog (owner roster incl. PII-bearing names, datasource
 * ODDRNs, collector identities, policy/role topology, and the OAR forensic audit log). DISABLED is for
 * trusted networks only. A RED here means the open-read posture changed — re-confirm the security model
 * and the operator docs before treating it as a regression.
 *
 * Namespace: ids 20520-20529 only; names prefixed it052_; oddrn //e2e-it052/. Idempotent seeds.
 */

const OWNER_NAME = 'it052_owner_dir';
const NS_NAME = 'it052_ns_dir';
const TAG_NAME = 'it052_tag_dir';
const DS_ID = 20520;
const DS_NAME = 'it052_ds_dir';

interface ListBody {
  items?: Array<{ name?: string }>;
}

// anon GET (the request fixture sends NO Authorization header) → parse JSON, return {status, names}.
async function anonList(
  request: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<{ status: number; contentType: string; names: string[]; raw: string }> {
  const res = await request.get(path);
  const contentType = res.headers()['content-type'] ?? '';
  const raw = await res.text();
  let names: string[] = [];
  try {
    const body = JSON.parse(raw) as ListBody;
    names = (body.items ?? []).map((i) => i.name ?? '');
  } catch {
    names = []; // not JSON (e.g. SPA fallback) → no names, the assertion below will catch it
  }
  return { status: res.status(), contentType, names, raw };
}

test.describe('F-074 Management directory ungated reads — anon reads the full directory under DISABLED', () => {
  test.beforeAll(async () => {
    await seedOwner(OWNER_NAME);
    await seedDataSource(DS_ID, DS_NAME);
    await dbQuery(
      `INSERT INTO namespace (name) SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM namespace WHERE name = $1::text)`,
      [NS_NAME],
    );
    await dbQuery(
      `INSERT INTO tag (name, important) SELECT $1::text, false
       WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name = $1::text)`,
      [TAG_NAME],
    );
  });

  test('H-003: an anonymous caller reads the Owner directory (200 + the seeded owner in the JSON body)', async ({
    request,
  }) => {
    const { status, contentType, names } = await anonList(request, `/api/owners?page=1&size=100&query=${OWNER_NAME}`);
    expect(status, 'GET /api/owners must be anonymously reachable (200) under DISABLED').toBe(200);
    expect(contentType, 'the response must be a real JSON directory read, not the SPA HTML fallback').toContain(
      'application/json',
    );
    expect(names, 'the seeded owner must appear in the anonymously-read directory').toContain(OWNER_NAME);
  });

  test('H-003: an anonymous caller reads the Namespace, Tag and DataSource directories (200 + seeded rows)', async ({
    request,
  }) => {
    const ns = await anonList(request, `/api/namespaces?page=1&size=100&query=${NS_NAME}`);
    expect(ns.status, 'GET /api/namespaces anon-reachable').toBe(200);
    expect(ns.names, 'seeded namespace present in anon read').toContain(NS_NAME);

    const tag = await anonList(request, `/api/tags?page=1&size=100&query=${TAG_NAME}`);
    expect(tag.status, 'GET /api/tags anon-reachable').toBe(200);
    expect(tag.names, 'seeded tag present in anon read').toContain(TAG_NAME);

    const ds = await anonList(request, `/api/datasources?page=1&size=100&query=${DS_NAME}`);
    expect(ds.status, 'GET /api/datasources anon-reachable').toBe(200);
    expect(ds.names, 'seeded datasource present in anon read').toContain(DS_NAME);
  });

  test('H-003: the remaining ungated Management reads (collectors / titles / policies / roles / providers) all serve anon (200 JSON)', async ({
    request,
  }) => {
    // none of these carry a *_READ permission or a GET SecurityRule → ungated; under DISABLED they serve anon.
    for (const path of [
      '/api/collectors?page=1&size=10',
      '/api/titles?page=1&size=10',
      '/api/policies?page=1&size=10',
      '/api/roles?page=1&size=10',
    ]) {
      const r = await anonList(request, path);
      expect(r.status, `GET ${path} must be anonymously reachable (200) under DISABLED`).toBe(200);
      expect(r.contentType, `GET ${path} must return JSON (a real read, not the SPA fallback)`).toContain(
        'application/json',
      );
    }

    // providers enumerates the deployment auth topology (F-074 H-005) — JSON object, no `items` list.
    const providers = await request.get('/api/owners/providers');
    expect(providers.status(), 'GET /api/owners/providers anon-reachable (deployment fingerprint surface)').toBe(200);
    expect(providers.headers()['content-type'] ?? '', 'providers returns JSON').toContain('application/json');
    expect(JSON.parse(await providers.text()), 'providers body carries the default_providers topology').toHaveProperty(
      'default_providers',
    );
  });

  test('H-006: the OAR forensic ACTIVITY log is anonymously reachable under DISABLED (200 JSON list)', async ({
    request,
  }) => {
    // The activity log is a RICHER forensic dataset than the pending list, and unlike the pending list it
    // has NO SecurityRule at all (SecurityConstants has a rule only for /api/owner_association_request GET,
    // not /activity). It requires a `status` query param (a missing one is mishandled as 500 — a separate
    // latent defect, see PLT note in the report); with the param it serves anon.
    const res = await request.get('/api/owner_association_request/activity?page=1&size=10&status=APPROVED');
    expect(
      res.status(),
      'H-006: the OAR activity audit log must be anonymously reachable (200) under DISABLED — it is ungated',
    ).toBe(200);
    expect(res.headers()['content-type'] ?? '', 'activity log returns a real JSON read').toContain('application/json');
    expect(JSON.parse(await res.text()), 'activity log body is a paged list').toHaveProperty('items');
  });

  test.afterAll(async () => {
    await dbQuery('DELETE FROM owner WHERE name = $1', [OWNER_NAME]);
    await dbQuery('DELETE FROM tag WHERE name = $1', [TAG_NAME]);
    await dbQuery('DELETE FROM namespace WHERE name = $1', [NS_NAME]);
    await dbQuery('DELETE FROM data_source WHERE id = $1', [DS_ID]);
  });
});

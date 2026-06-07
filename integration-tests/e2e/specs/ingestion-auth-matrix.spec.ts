import { test, expect } from '@playwright/test';
import { seedIngestionDataSource } from '../helpers/db';
import { tableEntity } from '../helpers/ingest';

/**
 * IT-062 — F-094 Ingestion API Authentication Coverage Matrix: the DISABLED open-posture endpoint matrix.
 *
 * Protocol: integration-tests/protocols/IT-062-ingestion-auth-matrix.md
 * Gates: validates F-094 (UC-3 default-off entities · UC-4 sibling stats/metrics uncovered · UC-5 alertmanager
 *        uncovered · the per-endpoint coverage matrix H-001/004/005/006).
 *
 * `auth.ingestion.filter.enabled` reads like "authenticate the /ingestion/ namespace", but the bean it
 * gates (IngestionDataEntitiesFilter) binds an EXACT-LITERAL `/ingestion/entities` POST matcher and
 * defaults OFF; the sibling mutating endpoints carry NO filter in ANY shipped config, and under UI auth
 * modes the whole `/ingestion/**` prefix is in SecurityConstants.WHITELIST_PATHS. The operator-observable
 * surface is a multi-cell matrix nobody enumerated in-repo.
 *
 * IT-046 already pins the `/ingestion/entities` cell (anon write 200) + anon collector/token mint. This
 * protocol does the BROADER ENDPOINT MATRIX: it characterizes that under the shipped default
 * auth.type=DISABLED, EVERY ingestion endpoint is anonymously reachable — none returns an auth rejection
 * (401/403). All are LSN-029 pins of the CURRENT open posture; they flip the day the namespace is gated.
 *
 *   endpoint                                   method  observed (anon, DISABLED)   what the pin asserts
 *   /ingestion/entities/datasets/stats         POST    201 Created                 exact 201 (anon side-effect)
 *   /ingestion/metrics                         POST    201 Created                 exact 201 (anon side-effect)
 *   /ingestion/alert/alertmanager              POST    200 OK                      exact 200 (Prometheus webhook open)
 *   /ingestion/dataentities?deg_oddrn=         GET     reached handler (not 401/3) NOT auth-rejected
 *   /ingestion/datasources                     POST    reached handler (not 401/3) NOT auth-rejected
 *
 * The stats/metrics/alertmanager cells assert the exact 2xx (the request reaches and runs the side-effect
 * path anonymously). The dataentities/datasources cells return a 500 under DISABLED (a server-side lookup /
 * missing-session-collector error) — that 500 is NOT an auth verdict; the load-bearing claim is the request
 * is NOT rejected by an auth gate (status is neither 401 nor 403), i.e. it traversed the security chain and
 * reached the handler. Asserting "not 401/403" is the honest characterization of "no auth coverage".
 *
 * GROUNDED LIVE (2026-06-07, no credential, auth.type=DISABLED): stats 201 · metrics 201 · alertmanager 200 ·
 * GET dataentities 500 · POST datasources 500. A bogus `Authorization: Bearer ...` is ignored (still 201) —
 * DISABLED bypasses every SECURITY_RULES entry.
 *
 * Operator caveat (why pin it): on a network-reachable DISABLED deployment (the shipped default) EVERY
 * ingestion endpoint is open — an anonymous caller can push entities, dataset stats, metrics, and fire the
 * AlertManager webhook. DISABLED is for trusted networks only; never internet-expose it. Enabling
 * `auth.ingestion.filter.enabled=true` closes ONLY /ingestion/entities — the sibling endpoints stay open.
 *
 * Namespacing: it062_ ids/oddrns, datasource id 20620. Read-or-write-only; idempotent.
 */
const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const DS_ID = 20620;
const DS = '//e2e-it062/ds';

// helper: POST/GET with NO Authorization header, return {status, body}
async function anon(method: 'POST' | 'GET', path: string, body?: unknown): Promise<{ status: number; body: string }> {
  const opt: RequestInit = { method, headers: body ? { 'content-type': 'application/json' } : {} };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opt);
  return { status: res.status, body: await res.text().catch(() => '') };
}

test.describe('F-094 Ingestion auth coverage matrix — DISABLED open posture (sibling endpoints)', () => {
  test('UC-4: POST /ingestion/entities/datasets/stats is anonymously reachable under DISABLED (201, no auth coverage)', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it062-ds');
    // an empty fields map is a valid (no-op) stats payload; the point is the AUTH posture, not the stats effect.
    const r = await anon('POST', '/ingestion/entities/datasets/stats', {
      items: [{ dataset_oddrn: `${DS}/tables/it062_x`, fields: {} }],
    });
    expect(
      r.status,
      'UC-4: the dataset-stats endpoint accepts an anonymous POST (201) — the ingestion filter does not cover it',
    ).toBe(201);
  });

  test('UC-4: POST /ingestion/metrics is anonymously reachable under DISABLED (201, no auth coverage) — a credential is ignored', async () => {
    const r = await anon('POST', '/ingestion/metrics', { items: [] });
    expect(
      r.status,
      'UC-4: the metrics endpoint accepts an anonymous POST (201) — no filter covers /ingestion/metrics',
    ).toBe(201);

    // DISABLED bypasses SECURITY_RULES entirely: a bogus bearer changes nothing (still 201, not 401).
    const withBogus = await fetch(`${BASE}/ingestion/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer it062-bogus-token' },
      body: JSON.stringify({ items: [] }),
    });
    await withBogus.text().catch(() => undefined);
    expect(
      withBogus.status,
      'under DISABLED a bogus credential is ignored — the endpoint still returns 201, never 401',
    ).toBe(201);
  });

  test('UC-5: POST /ingestion/alert/alertmanager (Prometheus webhook) is anonymously reachable under DISABLED (200, no auth coverage)', async () => {
    const r = await anon('POST', '/ingestion/alert/alertmanager', { alerts: [] });
    expect(
      r.status,
      'UC-5: the AlertManager webhook accepts an anonymous POST (200) — no @PreAuthorize, no filter, /ingestion/** whitelisted',
    ).toBe(200);
  });

  test('matrix: the read + datasource ingestion endpoints traverse the security chain anonymously (NOT 401/403) under DISABLED', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it062-ds');

    // GET /ingestion/dataentities by DEG oddrn — reaches the handler anonymously (a lookup error, not an auth verdict).
    const get = await anon('GET', `/ingestion/dataentities?deg_oddrn=${encodeURIComponent(DS)}`);
    expect(
      [401, 403].includes(get.status),
      `matrix: GET /ingestion/dataentities is NOT auth-rejected under DISABLED (got ${get.status}, not 401/403) — it reaches the handler`,
    ).toBe(false);

    // POST /ingestion/datasources — reaches the controller anonymously; it dies on the missing session
    // collector-id (a 500), NOT on an auth gate. The load-bearing claim: no auth rejection.
    const post = await anon('POST', '/ingestion/datasources', { items: [{ oddrn: `${DS}2`, name: 'it062-ds2' }] });
    expect(
      [401, 403].includes(post.status),
      `matrix: POST /ingestion/datasources is NOT auth-rejected under DISABLED (got ${post.status}, not 401/403) — it reaches the handler`,
    ).toBe(false);
  });

  test('contrast (UC-3 sanity): the documented-as-covered endpoint /ingestion/entities is ALSO anon-open by default (filter default-off)', async () => {
    await seedIngestionDataSource(DS_ID, DS, 'it062-ds');
    // distinct from IT-046's pin: here it anchors the matrix — even the ONE filterable endpoint is open by default.
    const r = await anon('POST', '/ingestion/entities', {
      data_source_oddrn: DS,
      items: [tableEntity(`${DS}/tables/it062_entities`, 'it062_entities')],
    });
    expect(
      r.status,
      'UC-3: /ingestion/entities accepts an anonymous write (200) because auth.ingestion.filter.enabled defaults to false',
    ).toBe(200);
  });
});

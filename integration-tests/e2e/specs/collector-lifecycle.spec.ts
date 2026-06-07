import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-097 — F-020 Collector Lifecycle Management: the full create → list → rotate → delete loop.
 *
 * Protocol: integration-tests/protocols/IT-097-collector-lifecycle.md
 * Gates: validates F-020 (UC-01 register · the masked-list read · UC token-rotate · UC delete),
 *        cross-links F-163 one-shot reveal (IT-100 owns the cross-surface pattern).
 *
 * Collector lifecycle is the operator-facing CRUD + token-issuance surface under
 * Management → Collectors. Under the SHIPPED DEFAULT auth.type=DISABLED the platform permits every
 * request, so this whole loop runs anonymously (the same open posture IT-046 pins). Each step is
 * verified at the REAL boundary — the HTTP response body AND a Postgres read-back — never a status
 * code alone:
 *
 *  - REGISTER (POST /api/collectors): mints a `collector` row + a `token` row, returns the 40-char
 *    plaintext token ONCE. DB read-back: the collector exists, deleted_at IS NULL, token_id FK set.
 *  - LIST (GET /api/collectors): the created collector appears, with its token MASKED to `******`+last6
 *    (TokenMapper.mapValue — showToken=false on reads). A soft-deleted collector is hidden.
 *  - ROTATE (PUT /api/collectors/{id}/token): returns a NEW 40-char plaintext; the token row's value
 *    changes in the DB while created_at is preserved (an UPDATE, not a new row).
 *  - DELETE (DELETE /api/collectors/{id}): 204; the collector row is SOFT-deleted (deleted_at stamped,
 *    row retained) and disappears from the list.
 *  - UI (/management/collectors): the CollectorsList page (GET /api/collectors on mount) renders the
 *    created collector's name in the rendered DOM.
 *
 * GROUNDED LIVE (2026-06-07, anon under DISABLED):
 *   POST /api/collectors -> 200 {id, token:{value:"<40 alnum>"}}; the OpenAPI GET list path is
 *   /api/collectors (NOT /api/collectors/list — the feature-flow trace was wrong; /list 500s as a
 *   non-route). GET /api/collectors -> {items:[{token:{value:"******hdEUlj"}}], page_info:{total,hasNext}}.
 *   PUT /api/collectors/{id}/token -> 200, token.value rotates, created_at preserved, updated_at advances.
 *   DELETE -> 204, collector.deleted_at stamped, row kept (soft-delete; ReactiveAbstractSoftDeleteCRUDRepository).
 *
 * Operator caveat (pinned, the reason this matters): under DISABLED every step above is reachable by
 * any anonymous network caller — collectors + usable S2S tokens are minted with no credential. DISABLED
 * is for trusted networks only. (The plaintext-at-rest + orphan-token defects are pinned by IT-060.)
 *
 * Namespacing: collectors get server-assigned ids, so we key on the returned id + an it097_-prefixed
 * unique name (namespace it097-ns). Every collector this spec creates is soft-deleted at test end
 * (idempotent, re-runnable against the shared ODD_STACK_EXTERNAL stack).
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const NS = 'it097-ns';

interface CollectorResp {
  id: number;
  name: string;
  description?: string | null;
  namespace?: { id?: number; name?: string };
  token?: { id?: number; value?: string; created_at?: string; updated_at?: string };
}

async function createCollector(name: string): Promise<CollectorResp> {
  const res = await fetch(`${BASE}/api/collectors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, namespace_name: NS }),
  });
  expect(res.status, 'anonymous collector register succeeds (200) under DISABLED').toBe(200);
  return (await res.json()) as CollectorResp;
}

async function listCollectors(query: string): Promise<CollectorResp[]> {
  const res = await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(query)}`);
  expect(res.status, 'GET /api/collectors (the management list read) succeeds (200)').toBe(200);
  const body = (await res.json()) as { items?: CollectorResp[] };
  return body.items ?? [];
}

async function deleteCollector(id: number): Promise<number> {
  const res = await fetch(`${BASE}/api/collectors/${id}`, { method: 'DELETE' });
  await res.text().catch(() => undefined);
  return res.status;
}

test.describe('F-020 Collector Lifecycle Management — register / list-masked / rotate / delete', () => {
  test('UC-01 + list: register a collector (40-char token + DB row), then it appears in the list MASKED', async () => {
    const name = `it097_lifecycle_${Date.now()}`;
    const created = await createCollector(name);
    try {
      // ---- register reveals a 40-char plaintext token exactly once ----
      const plaintext = created.token?.value ?? '';
      expect(plaintext, 'register returns a 40-char alphanumeric S2S token').toMatch(/^[A-Za-z0-9]{40}$/);
      expect(created.id, 'register returns the new collector id').toBeGreaterThan(0);
      expect(created.name, 'the created collector carries the submitted name').toBe(name);

      // ---- DB read-back: the collector + token rows exist, live, FK-linked ----
      const rows = await dbQuery<{ deleted_at: string | null; token_id: number; vlen: number }>(
        `SELECT c.deleted_at, c.token_id, length(t.value) AS vlen
           FROM collector c JOIN token t ON t.id = c.token_id WHERE c.id = $1`,
        [created.id],
      );
      expect(rows.length, 'a collector row + its token row exist in Postgres after register').toBe(1);
      expect(rows[0].deleted_at, 'the freshly created collector is live (deleted_at IS NULL)').toBeNull();
      expect(Number(rows[0].vlen), 'the token row stores the full 40-char value').toBe(40);

      // ---- list read returns the collector with the token MASKED (one-time-reveal contract) ----
      const items = await listCollectors(name);
      const item = items.find((i) => i.id === created.id);
      expect(item, 'the created collector is returned by GET /api/collectors').toBeTruthy();
      const masked = item!.token?.value ?? '';
      expect(
        masked,
        'the list read MASKS the token as `******`+last6 (TokenMapper showToken=false on reads)',
      ).toMatch(/^\*{6}.{6}$/);
      expect(masked.slice(-6), 'the mask exposes the genuine plaintext suffix').toBe(plaintext.slice(-6));
    } finally {
      await deleteCollector(created.id);
    }
  });

  test('rotate: PUT /api/collectors/{id}/token returns a NEW plaintext token; the DB value changes, created_at is preserved', async () => {
    const name = `it097_rotate_${Date.now()}`;
    const created = await createCollector(name);
    try {
      const original = created.token?.value ?? '';
      expect(original, 'the registered token is 40-char plaintext').toMatch(/^[A-Za-z0-9]{40}$/);

      const beforeRows = await dbQuery<{ value: string; created_at: string }>(
        `SELECT t.value, t.created_at FROM token t JOIN collector c ON c.token_id = t.id WHERE c.id = $1`,
        [created.id],
      );
      expect(beforeRows.length, 'the collector has one token row before rotation').toBe(1);
      const createdAtBefore = String(beforeRows[0].created_at);
      expect(beforeRows[0].value, 'the at-rest value equals the registered plaintext (no hash)').toBe(original);

      // ---- act: rotate ----
      const res = await fetch(`${BASE}/api/collectors/${created.id}/token`, { method: 'PUT' });
      expect(res.status, 'token rotation succeeds (200)').toBe(200);
      const rotated = ((await res.json()) as CollectorResp).token?.value ?? '';
      expect(rotated, 'rotation returns a NEW 40-char plaintext token').toMatch(/^[A-Za-z0-9]{40}$/);
      expect(rotated, 'the rotated token differs from the original').not.toBe(original);

      // ---- DB read-back: the same token row was UPDATED in place (created_at preserved) ----
      const afterRows = await dbQuery<{ value: string; created_at: string }>(
        `SELECT t.value, t.created_at FROM token t JOIN collector c ON c.token_id = t.id WHERE c.id = $1`,
        [created.id],
      );
      expect(afterRows.length, 'still exactly one token row after rotation (UPDATE, not a new row)').toBe(1);
      expect(afterRows[0].value, 'the at-rest value now equals the rotated plaintext').toBe(rotated);
      expect(String(afterRows[0].created_at), 'rotation preserves created_at (in-place UPDATE)').toBe(createdAtBefore);
    } finally {
      await deleteCollector(created.id);
    }
  });

  test('delete: DELETE /api/collectors/{id} returns 204, soft-deletes the row, and removes it from the list', async () => {
    const name = `it097_delete_${Date.now()}`;
    const created = await createCollector(name);

    // present in the list before delete
    const before = await listCollectors(name);
    expect(before.some((i) => i.id === created.id), 'the collector is listed before delete').toBe(true);

    // ---- act: delete ----
    expect(await deleteCollector(created.id), 'collector delete returns 204 No Content').toBe(204);

    // ---- DB read-back: SOFT-deleted (row retained, deleted_at stamped) ----
    const parent = await dbQuery<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM collector WHERE id = $1`,
      [created.id],
    );
    expect(parent.length, 'the collector row still exists after delete (soft-delete, not hard-delete)').toBe(1);
    expect(parent[0].deleted_at, 'delete stamps deleted_at (soft-delete)').not.toBeNull();

    // ---- the soft-deleted collector is hidden from the management list ----
    const after = await listCollectors(name);
    expect(
      after.some((i) => i.id === created.id),
      'a soft-deleted collector is no longer returned by GET /api/collectors',
    ).toBe(false);
  });

  test('UI: /management/collectors renders the created collector name in the rendered DOM', async ({ page }) => {
    const name = `it097_ui_${Date.now()}`;
    const created = await createCollector(name);
    try {
      // CollectorsList fires GET /api/collectors on mount (CollectorsList.tsx:44-46) — wait for it
      // before asserting (react-query/redux caveat: the row is not in the DOM until the fetch lands).
      const listResp = page.waitForResponse(
        (r) => /\/api\/collectors(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
      );
      await page.goto('/management/collectors');
      await listResp;

      await expect(
        page.getByText(name).first(),
        'the Collectors management page renders the created collector name',
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteCollector(created.id);
    }
  });
});

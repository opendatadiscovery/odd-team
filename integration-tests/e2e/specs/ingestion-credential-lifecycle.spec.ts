import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-060 — F-125 Ingestion Credential Storage & Lifecycle: mint / reveal / orphan.
 *
 * Protocol: integration-tests/protocols/IT-060-ingestion-credential-lifecycle.md
 * Gates: validates F-125 (UC-004 one-time reveal · UC-001 orphan-forever teardown · UC-005 plaintext-at-rest).
 *
 * The 40-char bearer token every collector/datasource presents on POST /ingestion/* is the SECURITY
 * load-bearing credential beneath ingestion auth. F-125's reflection says its lifecycle has an
 * issue/rotate/view path but NO retire path: the `token` table has no deleted_at, soft-deleting the
 * parent leaves the token row live, and HousekeepingJobManager's cascade never purges it — so every
 * credential ever minted accumulates in PostgreSQL forever (H-001, HIGH). Two of the three checks here
 * are LSN-029 characterization pins of CURRENT (broken/known) behaviour — GREEN now, RED the day the
 * platform hardens (hash-at-rest / orphan-purge):
 *
 *  - UC-004 (happy path, CONFIRMED): a freshly minted collector returns its 40-char plaintext token
 *    exactly once on create; a subsequent list read returns it MASKED (`******`+last6). Secret-reveal-once.
 *  - UC-001 (teardown, CONTRADICTED -> RED PIN): deleting the collector soft-deletes the parent
 *    (deleted_at set, row still present) but the token row SURVIVES — orphaned, never reclaimed. The pin
 *    asserts the orphan persists; it flips RED when an orphan-purge ships (per-delete or housekeeping sweep).
 *    KNOWN BUG (PLT-087 D1 covers the DataSource per-delete leg only; the Collector-side delete AND the
 *    daily housekeeping sweep are net_new — F-125 H-001).
 *  - UC-005 (render, CONTRADICTED -> RED PIN): the token stored in `token.value` is BYTE-IDENTICAL to the
 *    plaintext the API returned on create — no hash, no encryption at rest. A DB-side reader (replica /
 *    pg_dump / backup) recovers every live credential with one SELECT. Combined with UC-001 it recovers
 *    every credential EVER minted. KNOWN BUG (PLT-085 — odd-platform's CollectorTokenStorageKnownBugTest
 *    pins the same plaintext lookup at the unit tier; this is its end-to-end mint-side companion).
 *
 * GROUNDED LIVE (2026-06-07, anon under auth.type=DISABLED): create -> 200 + plaintext token.value (40 ch);
 * token.value in DB === api value (plaintext at rest); delete -> 204, collector.deleted_at set + row kept,
 * token row count unchanged (orphan); list read -> `******`+last6 (masked). token columns:
 * id,value,created_at,created_by,updated_at,updated_by — NO deleted_at/is_deleted.
 *
 * Operator caveat (the reason to pin): a DISABLED deployment mints these tokens anonymously, stores them
 * in clear text, and never reclaims them on delete. Secure your Postgres backups/replicas accordingly.
 *
 * Namespacing: collectors get server-assigned ids, so we key on the returned id + an it060_-prefixed
 * unique name. Each created collector is soft-deleted at the end of its test (idempotent, re-runnable).
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

interface CollectorResp {
  id: number;
  name: string;
  token?: { id?: number; value?: string };
}

async function createCollector(name: string): Promise<CollectorResp> {
  const res = await fetch(`${BASE}/api/collectors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, namespace_name: 'it060-ns' }),
  });
  expect(res.status, 'anonymous collector create succeeds (200) under DISABLED').toBe(200);
  return (await res.json()) as CollectorResp;
}

async function deleteCollector(id: number): Promise<number> {
  const res = await fetch(`${BASE}/api/collectors/${id}`, { method: 'DELETE' });
  await res.text().catch(() => undefined);
  return res.status;
}

test.describe('F-125 Ingestion Credential Lifecycle — mint / reveal / orphan', () => {
  test('UC-004: a minted token is shown in plaintext exactly once on create, then masked on list read', async () => {
    const name = `it060_reveal_${Date.now()}`;
    const created = await createCollector(name);
    try {
      // ---- create reveals the full 40-char plaintext exactly once ----
      const plaintext = created.token?.value ?? '';
      expect(
        plaintext,
        'UC-004: the create response reveals a 40-char plaintext S2S token',
      ).toMatch(/^[A-Za-z0-9]{40}$/);
      expect(plaintext.startsWith('******'), 'the create-time value is NOT masked').toBe(false);

      // ---- a subsequent list read returns the SAME token MASKED (one-time reveal) ----
      const res = await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(name)}`);
      expect(res.status, 'collectors list read succeeds').toBe(200);
      const list = (await res.json()) as { items?: CollectorResp[] };
      const item = (list.items ?? []).find((i) => i.id === created.id);
      expect(item, 'the freshly created collector is in the list').toBeTruthy();
      const masked = item!.token?.value ?? '';
      expect(
        masked,
        'UC-004 one-time-reveal: the list read returns the token MASKED as `******`+last6, not the plaintext',
      ).toMatch(/^\*{6}.{6}$/);
      expect(
        masked,
        'UC-004: the masked read is NOT the plaintext value (the secret is revealed only once)',
      ).not.toBe(plaintext);
      // the last-6 of the mask are the genuine tail of the plaintext (the mask exposes a suffix)
      expect(masked.slice(-6), 'the mask tail is the genuine plaintext suffix').toBe(plaintext.slice(-6));
    } finally {
      await deleteCollector(created.id);
    }
  });

  test('UC-005: the token is stored PLAINTEXT at rest — DB value is byte-identical to the revealed token (KNOWN BUG PLT-085, RED pin)', async () => {
    const name = `it060_plaintext_${Date.now()}`;
    const created = await createCollector(name);
    try {
      const plaintext = created.token?.value ?? '';
      expect(plaintext, 'a 40-char plaintext token was minted').toMatch(/^[A-Za-z0-9]{40}$/);

      // read the token straight from Postgres via the collector's token_id FK (ground truth, no API)
      const rows = await dbQuery<{ value: string }>(
        `SELECT t.value FROM token t JOIN collector c ON c.token_id = t.id WHERE c.id = $1`,
        [created.id],
      );
      expect(rows.length, 'the collector has exactly one token row').toBe(1);
      const atRest = rows[0].value;

      // KNOWN BUG (PLT-085): no hash, no encryption — the stored value IS the secret verbatim.
      // This pin is GREEN today and flips RED the moment hash-at-rest (value_hash + bcrypt) ships.
      expect(
        atRest,
        'UC-005 plaintext-at-rest: token.value in Postgres equals the plaintext the API revealed — a DB reader recovers the live credential',
      ).toBe(plaintext);
      expect(
        atRest.length,
        'the at-rest value is the full 40-char secret (not a truncated hash/digest)',
      ).toBe(40);
    } finally {
      await deleteCollector(created.id);
    }
  });

  test('UC-001: deleting the collector orphans its token forever — soft-delete parent, token row survives (KNOWN BUG, RED pin)', async () => {
    const name = `it060_orphan_${Date.now()}`;
    const created = await createCollector(name);

    // capture the token row id BEFORE delete (via the FK), and the global token count
    const before = await dbQuery<{ token_id: number }>(`SELECT token_id FROM collector WHERE id = $1`, [created.id]);
    expect(before.length, 'the collector exists before delete').toBe(1);
    const tokenId = Number(before[0].token_id);
    expect(Number.isFinite(tokenId), 'the collector has a token_id FK').toBe(true);

    // ---- act: delete the collector (the operator "retires" it) ----
    expect(await deleteCollector(created.id), 'collector delete succeeds (204 No Content)').toBe(204);

    // ---- the parent is SOFT-deleted: row still present, deleted_at stamped, hidden from the list ----
    const parent = await dbQuery<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM collector WHERE id = $1`,
      [created.id],
    );
    expect(parent.length, 'the collector row still exists after delete (soft-delete, not hard-delete)').toBe(1);
    expect(parent[0].deleted_at, 'the collector is soft-deleted: deleted_at is stamped').not.toBeNull();

    const listRes = await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(name)}`);
    const list = (await listRes.json()) as { items?: { id: number }[] };
    expect(
      (list.items ?? []).some((i) => i.id === created.id),
      'a soft-deleted collector is hidden from the management list',
    ).toBe(false);

    // ---- UC-001 RED PIN: the token row is ORPHANED — it survives the parent's deletion forever ----
    // The token table has no deleted_at and nothing purges it (HousekeepingJobManager has no token leg).
    // GREEN today; flips RED when a per-delete cleanup or housekeeping orphan-sweep ships (F-125 H-001).
    const orphan = await dbQuery<{ n: string }>(`SELECT count(*) AS n FROM token WHERE id = $1`, [tokenId]);
    expect(
      Number(orphan[0].n),
      'UC-001 orphan-forever: the token row SURVIVES collector deletion (orphaned, never reclaimed) — KNOWN BUG, no orphan-purge exists',
    ).toBe(1);

    // and the orphan is structurally undeletable-by-design: the token table has no soft-delete column
    const cols = await dbQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'token'`,
    );
    const colNames = cols.map((c) => c.column_name);
    expect(
      colNames.includes('deleted_at') || colNames.includes('is_deleted'),
      'UC-001 root cause: the `token` table has NO deleted_at/is_deleted column — orphans cannot even be soft-marked',
    ).toBe(false);
  });
});

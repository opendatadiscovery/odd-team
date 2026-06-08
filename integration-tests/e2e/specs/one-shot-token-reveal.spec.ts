import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-100 — F-163 Cross-Management one-shot token reveal pattern (UI angle).
 *
 * Protocol: integration-tests/protocols/IT-100-one-shot-token-reveal.md
 * Gates: validates F-163 (UC-001 fresh reveal: plaintext + Copy + "you will not be able to retrieve it
 *        again" banner · UC-002 masked read: `******`+last6, no Copy, Regenerate offered · UC-006 the
 *        substring-`******` sniff classifies masked-vs-plaintext correctly today).
 *
 * F-163 is the SHARED one-shot reveal UX used by BOTH CollectorItemToken and DataSourceItemToken: the
 * server returns the 40-char plaintext token ONCE (on create/rotate), and every subsequent read returns
 * it MASKED as `******`+last6. The UI decides reveal-vs-masked purely by the substring sniff
 * `token.value.substring(0, 6) === '******'` (CollectorItemToken.tsx:26 == DataSourceItemToken.tsx:26 —
 * identical, no shared constant). IT-060 pins this contract at the API level for F-125; THIS spec drives
 * the REAL browser to verify the cross-management UI PATTERN: the reveal affordances on create and the
 * masking on a subsequent read.
 *
 * We exercise the Collectors surface (one of the two parallel surfaces; the Collector token UX is
 * byte-for-byte the same shape as the DataSource one — F-163's whole point). The reveal state is only
 * reachable by CREATING IN THE UI, because redux must hold the one-shot plaintext response for
 * CollectorItemToken's sniff to return isHidden=false; a page reload re-fetches the list (masked) and
 * the reveal collapses — which is exactly the "shown ONCE then masked" contract under test.
 *
 * GROUNDED LIVE (2026-06-07, DISABLED — admin identity carries all four COLLECTOR_* permissions, so the
 * Add/Copy/Regenerate affordances render):
 *   Add collector -> POST /api/collectors -> 200 plaintext token -> redux holds it -> CollectorItem
 *   renders the plaintext <Token>, a Copy button (CollectorItemToken.tsx:52), and the warning InfoItem
 *   "Save token in a secure location. You will not be able to retrieve it again." (CollectorItem.tsx:87-98).
 *   Page reload -> GET /api/collectors -> token masked `******`+last6 -> isHidden=true -> NO Copy, the
 *   Regenerate confirmation button instead (CollectorItemToken.tsx:36-50), banner gone.
 *
 * Operator caveat (the reason this is one-shot): if the operator navigates away / refreshes before
 * copying, the plaintext is unrecoverable — the only path back is a destructive rotation. The warning
 * banner is the sole signal, and it is derived from the mask state (it vanishes on the next refresh).
 *
 * Namespacing: server-assigned ids; we key on an it100_-prefixed unique name and soft-delete at end.
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
const REVEAL_BANNER = /You will not be able to retrieve it again/i;

async function deleteCollectorByName(name: string): Promise<void> {
  // resolve the (live) collector id by name via the list read, then delete — idempotent cleanup.
  const res = await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(name)}`);
  if (!res.ok) return;
  const body = (await res.json()) as { items?: { id: number; name: string }[] };
  const hit = (body.items ?? []).find((i) => i.name === name);
  if (hit) await fetch(`${BASE}/api/collectors/${hit.id}`, { method: 'DELETE' }).then((r) => r.text());
}

test.describe('F-163 one-shot token reveal — cross-management UI pattern (Collectors surface)', () => {
  test('UC-001 + UC-002 + UC-006: create reveals plaintext + Copy + warning banner; a refresh masks it (no Copy, Regenerate offered)', async ({
    page,
  }) => {
    const name = `it100_reveal_${Date.now()}`;

    // capture the one-shot plaintext from the create response so we can prove the later mask is its tail
    let plaintext = '';
    page.on('response', async (r) => {
      if (/\/api\/collectors(\?|$)/.test(r.url()) && r.request().method() === 'POST' && r.ok()) {
        try {
          plaintext = ((await r.json()) as { token?: { value?: string } }).token?.value ?? '';
        } catch {
          /* ignore */
        }
      }
    });

    try {
      await page.goto('/management/collectors');

      // ---- create the collector IN THE UI (Add collector dialog -> Name -> Save) ----
      await page.getByRole('button', { name: 'Add collector' }).click();
      // the shared Input renders its label as a styled div (not a <label htmlFor>), so target the
      // react-hook-form field by its name attribute (input[name="name"]) inside the open dialog.
      const nameField = page.locator('form#collector-create-form input[name="name"]');
      await expect(nameField, 'the Add-collector dialog Name field is shown').toBeVisible({ timeout: 10_000 });
      await nameField.fill(name);
      const createResp = page.waitForResponse(
        (r) => /\/api\/collectors(\?|$)/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
      );
      await page.getByRole('button', { name: 'Save' }).click();
      await createResp;

      // ---- UC-001: the reveal state — plaintext token + Copy button + the one-shot warning banner ----
      const card = page.locator('div', { hasText: name }).first();
      await expect(card, 'the newly created collector card is rendered').toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByText(REVEAL_BANNER).first(),
        'UC-001: the one-shot warning banner is shown on a fresh create',
      ).toBeVisible({ timeout: 10_000 });

      expect(plaintext, 'the create response carried a 40-char plaintext token').toMatch(/^[A-Za-z0-9]{40}$/);
      await expect(
        page.getByText(plaintext).first(),
        'UC-001: the full 40-char plaintext token is rendered (revealed) in the DOM',
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByRole('button', { name: 'Copy' }).first(),
        'UC-001: a Copy affordance is offered while the token is revealed (plaintext)',
      ).toBeVisible();

      // ---- UC-002 + UC-006: a refresh re-fetches the list (masked) — reveal collapses ----
      const listResp = page.waitForResponse(
        (r) => /\/api\/collectors(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
      );
      await page.reload();
      await listResp;

      await expect(page.getByText(name).first(), 'the collector still lists after refresh').toBeVisible({
        timeout: 10_000,
      });

      // the masked token (`******`+last6) is now what renders — derive the expected mask from the
      // captured plaintext tail (the server mask exposes the genuine last 6 chars).
      const expectedMask = `******${plaintext.slice(-6)}`;
      await expect(
        page.getByText(expectedMask).first(),
        'UC-002: after refresh the token renders MASKED as `******`+last6',
      ).toBeVisible({ timeout: 10_000 });

      // UC-006: cross-check against the API ground truth — the list read returns exactly that mask.
      const masked =
        (
          ((await (
            await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(name)}`)
          ).json()) as { items?: { name: string; token?: { value?: string } }[] }).items ?? []
        ).find((i) => i.name === name)?.token?.value ?? '';
      expect(masked, 'UC-006: the masked read matches `******`+last6 (substring-sniff classifies it masked)').toBe(
        expectedMask,
      );

      // the one-shot warning is GONE once masked, and Copy is no longer offered
      await expect(
        page.getByText(REVEAL_BANNER),
        'UC-002: the one-shot warning banner disappears once the token is masked',
      ).toHaveCount(0);
      await expect(
        page.getByText(plaintext),
        'UC-002: the full plaintext is no longer present in the DOM after the masked refetch',
      ).toHaveCount(0);

      // and the masked state offers Regenerate (the only recovery path) instead of Copy
      await expect(
        page.getByRole('button', { name: 'Regenerate' }).first(),
        'UC-002: the masked state offers Regenerate (rotation is the only path back to a usable token)',
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteCollectorByName(name);
    }
  });

  test('UC-006 contract: the server mask format is exactly `******`+last6 — the literal both UI surfaces sniff for', async () => {
    // F-163's fragility hinges on the mask format. This pins the server-side contract that
    // CollectorItemToken.tsx:26 AND DataSourceItemToken.tsx:26 both depend on (substring(0,6) === '******').
    // If the mask format ever changes, BOTH UI surfaces silently break — this pin RED-flags that change.
    const name = `it100_maskfmt_${Date.now()}`;
    const created = (await (
      await fetch(`${BASE}/api/collectors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, namespace_name: 'it100-ns' }),
      })
    ).json()) as { id: number; token?: { value?: string } };
    try {
      const plaintext = created.token?.value ?? '';
      expect(plaintext, 'create returns 40-char plaintext').toMatch(/^[A-Za-z0-9]{40}$/);

      const item =
        (
          ((await (
            await fetch(`${BASE}/api/collectors?page=1&size=100&query=${encodeURIComponent(name)}`)
          ).json()) as { items?: { id: number; token?: { value?: string } }[] }).items ?? []
        ).find((i) => i.id === created.id);
      const masked = item?.token?.value ?? '';

      // exactly six asterisks, then exactly six tail chars — the format both UIs hard-code.
      expect(masked, 'UC-006: masked format is six `*` + six tail chars').toMatch(/^\*{6}[A-Za-z0-9]{6}$/);
      expect(masked.startsWith('******'), 'UC-006: the mask prefix is exactly `******` (the sniffed literal)').toBe(
        true,
      );
      expect(masked.slice(-6), 'UC-006: the mask tail is the genuine plaintext suffix').toBe(plaintext.slice(-6));

      // ground-truth: the at-rest value is the full plaintext (the mask is presentation-only on read)
      const atRest = await dbQuery<{ value: string }>(
        `SELECT t.value FROM token t JOIN collector c ON c.token_id = t.id WHERE c.id = $1`,
        [created.id],
      );
      expect(atRest[0]?.value, 'the masking is read-side only — the stored value is the full token').toBe(plaintext);
    } finally {
      await fetch(`${BASE}/api/collectors/${created.id}`, { method: 'DELETE' }).then((r) => r.text());
    }
  });
});

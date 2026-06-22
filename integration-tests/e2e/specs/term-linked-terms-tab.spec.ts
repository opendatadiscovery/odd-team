import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-082 — F-152 Term Linked-Terms Tab: the term detail "Linked terms" tab lists every term
 * linked TO this term (term↔term reverse-lookup).
 *
 * Protocol: integration-tests/protocols/IT-082-term-linked-terms-tab.md
 * Gates: validates F-152 — UC-001 (a term with linked terms renders the Name/Namespace table on
 *        /terms/{id}/linked-terms) + UC-005 (empty state on a term with zero linked terms).
 *
 * GROUND-TRUTH (read 2026-06): the tab route is /terms/{id}/linked-terms (termsRoutes.ts:29 +
 * TermDetailsRoutes.tsx:32). The list component (LinkedTermsList.tsx:28-32) calls
 * GET /api/terms/{term_id}/linked_terms?page&size&query (TermApi.ts:807 — the CORRECTED route;
 * the F-152 flow's claimed "/api/terms/{id}/term → 500/405" was STALE, based on the wrong path).
 * The repository (ReactiveTermRepositoryImpl.getLinkedTermsByTargetTermId paginated, :466-499)
 * resolves: `WHERE assignedTermRelations.ASSIGNED_TERM_ID = {termId}` joined on
 * `assignedTermRelations.TARGET_TERM_ID = TERM.ID` — so the TERM rendered on term X's tab is the
 * row where term_to_term(target_term_id = renderedTerm.id, assigned_term_id = X). Each row renders
 * `linkedTerm.term.name` + `.namespace.name` (LinkedTerm.tsx:27-36).
 *
 * NB the empty-state copy is the documented copy-paste bug (LinkedTermsList.tsx:81 renders
 * "No linked entities" on the LINKED TERMS tab — F-152 facet
 * copy_paste_empty_state_no_linked_entities_in_linked_terms_view). The empty-corner test asserts
 * the current (buggy) literal so it pins the behaviour and goes RED the instant the copy is fixed.
 */
const NS = 'it082_ns';
const HOST_NAME = 'it082_HostTerm'; // term X — the tab we open
const LINKED_NAME = 'it082_LinkedTerm'; // term B — must appear on X's Linked-Terms tab
const EMPTY_NAME = 'it082_EmptyHostTerm'; // a term with no linked terms

async function getOrCreateNamespace(name: string): Promise<number> {
  const sel = await dbQuery<{ id: number }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [name]);
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [name]);
  return Number(ins[0].id);
}

async function getOrCreateTerm(name: string, nsId: number, definition: string): Promise<number> {
  const sel = await dbQuery<{ id: number }>(
    'SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1',
    [name, nsId],
  );
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>(
    'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
    [name, definition, nsId],
  );
  return Number(ins[0].id);
}

/**
 * Make `linkedId` appear on `hostId`'s Linked-Terms tab. Verified direction (above):
 * term_to_term(target_term_id = linkedId, assigned_term_id = hostId). Idempotent.
 */
async function seedTermLinkedToTerm(hostId: number, linkedId: number): Promise<void> {
  await dbQuery(
    'DELETE FROM term_to_term WHERE target_term_id = $1 AND assigned_term_id = $2',
    [linkedId, hostId],
  );
  await dbQuery(
    'INSERT INTO term_to_term (target_term_id, assigned_term_id, is_description_link) VALUES ($1, $2, false)',
    [linkedId, hostId],
  );
}

const linkedTermsFetch = (page: import('@playwright/test').Page, id: number) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/terms/${id}/linked_terms`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-152 Term Linked-Terms tab — reverse-lookup of linked terms', () => {
  test('UC-001: a term linked to another term lists it on the Linked-Terms tab', async ({ page }) => {
    const nsId = await getOrCreateNamespace(NS);
    const hostId = await getOrCreateTerm(HOST_NAME, nsId, 'it082 host term');
    const linkedId = await getOrCreateTerm(LINKED_NAME, nsId, 'it082 linked term');
    await seedTermLinkedToTerm(hostId, linkedId);

    const linked = linkedTermsFetch(page, hostId);
    await page.goto(`/terms/${hostId}/linked-terms`);
    await linked;

    await expect(
      page.getByText(LINKED_NAME).first(),
      'the linked term name must render on the Linked-Terms tab',
    ).toBeVisible({ timeout: 10_000 });

    // The row also renders the linked term's namespace (LinkedTerm.tsx:34).
    await expect(
      page.getByText(NS).first(),
      'the linked term namespace must render on the row',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('UC-005: a term with zero linked terms shows the empty state', async ({ page }) => {
    const nsId = await getOrCreateNamespace(NS);
    const emptyId = await getOrCreateTerm(EMPTY_NAME, nsId, 'it082 empty host');
    // ensure no term_to_term rows reference it as assigned (host) term
    await dbQuery('DELETE FROM term_to_term WHERE assigned_term_id = $1', [emptyId]);

    const linked = linkedTermsFetch(page, emptyId);
    await page.goto(`/terms/${emptyId}/linked-terms`);
    await linked;
    await page.waitForTimeout(800);

    // No linked term row renders.
    await expect(
      page.getByText(LINKED_NAME).filter({ visible: true }),
      'a term with no links must list no linked term',
    ).toHaveCount(0);

    // CTRIB-028 (#1754 Defect 6): the empty-state copy on the LINKED-TERMS tab now reads
    // "No linked terms" (was the copy-pasted "No linked entities"). Re-grounded RED→GREEN per LSN-029 —
    // this guards the corrected copy; it goes RED on ref:main (which still renders "No linked entities").
    await expect(
      page.getByText('No linked terms').first(),
      'empty-state copy on the Linked-Terms tab reads "No linked terms"',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('No linked entities'),
      'the copy-pasted "No linked entities" no longer appears on the Linked-Terms tab',
    ).toHaveCount(0);
  });

  // CTRIB-028 (#1754 Defect 5): a REAL backend failure on the linked-terms endpoint must render an
  // error, NOT the empty state. Pre-fix, isFetched flips true after the error so the error page hid
  // and "No linked entities" rendered (a real outage read as an empty relation). RED on ref:main.
  test('D5: a real 500 on linked_terms renders an error, not the empty state', async ({ page }) => {
    const nsId = await getOrCreateNamespace(NS);
    const hostId = await getOrCreateTerm(HOST_NAME, nsId, 'it082 host term');
    await page.route(`**/api/terms/${hostId}/linked_terms**`, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    );
    await page.goto(`/terms/${hostId}/linked-terms`);
    await page.waitForTimeout(2000);
    await expect(
      page.getByText('Return to the'),
      'the AppErrorPage (not the empty state) renders on a real failure',
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No linked terms')).toHaveCount(0);
    await expect(page.getByText('No linked entities')).toHaveCount(0);
  });

  // CTRIB-028 (#1754 Defect 7): the linked-terms search is debounced — typing N chars must NOT fire
  // one request per keystroke. RED on ref:main (un-debounced → one request per keystroke).
  test('D7: linked-terms search is debounced (≤2 requests for 5 keystrokes)', async ({ page }) => {
    const nsId = await getOrCreateNamespace(NS);
    const hostId = await getOrCreateTerm(HOST_NAME, nsId, 'it082 host term');
    await page.goto(`/terms/${hostId}/linked-terms`);
    await page.waitForResponse(r => r.url().includes('/linked_terms') && r.ok());
    await page.waitForTimeout(600);
    let requests = 0;
    page.on('request', r => {
      if (r.method() === 'GET' && r.url().includes(`/api/terms/${hostId}/linked_terms`)) requests += 1;
    });
    await page.getByPlaceholder('Search').first().pressSequentially('abcde', { delay: 120 });
    await page.waitForTimeout(1500);
    expect(requests, 'debounced: not one request per keystroke').toBeLessThanOrEqual(2);
  });
});

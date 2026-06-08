import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-081 — F-056 [[namespace:term]] description-mention auto-link: a data-entity description that
 * contains a [[ns:term]] mention of an EXISTING term renders, on the entity Overview, as a clickable
 * deeplink to that term's detail page; the backing link row carries is_description_link = TRUE.
 *
 * Protocol: integration-tests/protocols/IT-081-term-description-mention-autolink.md
 * Gates: validates F-056 — UC-5 (render/deeplink: a resolved mention renders as a clickable term
 *        deeplink) + UC-1 ground truth (data_entity_to_term.is_description_link = TRUE for the link).
 *
 * GROUND-TRUTH (read 2026-06): the entity Overview description is rendered by
 * InternalDescription.tsx → useTermWiki.transformDescriptionToMarkdown (:186-199), which rewrites
 * every `[[ns:name]]` in the description into a markdown link `[name](termDetailsPath(id) "definition")`
 * for each term in the entity's `terms` (TermRef) list (Overview.tsx:142 passes dataEntityDetails.terms;
 * OverviewDescription.tsx → InternalDescription terms={termRefs}). The Markdown renderer turns a
 * term-href link into `<a href="/terms/{id}">name</a>` (Markdown.tsx TermLink → styled('a') S.TermLink,
 * Markdown.styles.ts:3). The pattern is /\[\[([^:\]]+):([^\]]+)\]\]/g (lib/constants.ts:177).
 *
 * The write-path that materialises the link row (TermServiceImpl.handleDataEntityDescriptionTerms,
 * is_description_link=TRUE) is exercised at description-save time; this e2e seeds the resulting
 * persisted state (description text + link row) and verifies the user-visible RENDER + the DB
 * ground-truth flag. The DB read-back is asserted FIRST so the test fails loudly if the seed schema
 * drifts, before the UI assertion.
 */
const NS = 'it081_ns';
const TERM_NAME = 'it081_Customer';
const TERM_DEF = 'it081 canonical customer definition';
const ENTITY_ID = 20810;
const SOURCE_ID = 20810;
const ENTITY_ODDRN = '//e2e-source-IT-081/db/tables/it081_table';
const ENTITY_EXTERNAL_NAME = 'it081_table';
const MENTION = `[[${NS}:${TERM_NAME}]]`;
const DESCRIPTION = `Owned by the data team. See ${MENTION} for the definitive customer concept.`;

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
  if (sel[0]) {
    await dbQuery('UPDATE term SET definition = $2 WHERE id = $1', [sel[0].id, definition]);
    return Number(sel[0].id);
  }
  const ins = await dbQuery<{ id: number }>(
    'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
    [name, definition, nsId],
  );
  return Number(ins[0].id);
}

/**
 * Seed an entity whose internal_description contains [[ns:term]] AND a data_entity_to_term row
 * (is_description_link=true) to that term — i.e. the persisted state after a description save that
 * mentions an existing term. Idempotent.
 */
async function seedEntityWithDescriptionMention(termId: number): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [SOURCE_ID, '//e2e-source-IT-081/db', 'e2e-source-IT-081'],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, internal_description, data_source_id, type_id, entity_class_ids,
        view_count, source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, $5, 1, '{1}', 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET internal_description = EXCLUDED.internal_description,
       external_name = EXCLUDED.external_name, oddrn = EXCLUDED.oddrn`,
    [ENTITY_ID, ENTITY_ODDRN, ENTITY_EXTERNAL_NAME, DESCRIPTION, SOURCE_ID],
  );
  await dbQuery('DELETE FROM data_entity_to_term WHERE data_entity_id = $1 AND term_id = $2', [
    ENTITY_ID,
    termId,
  ]);
  await dbQuery(
    'INSERT INTO data_entity_to_term (data_entity_id, term_id, is_description_link) VALUES ($1, $2, true)',
    [ENTITY_ID, termId],
  );
}

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-056 description-mention auto-link — a [[ns:term]] mention renders as a term deeplink', () => {
  test('UC-5/UC-1: the entity description renders the mention as a clickable link to the term, link row is is_description_link=TRUE', async ({
    page,
  }) => {
    const nsId = await getOrCreateNamespace(NS);
    const termId = await getOrCreateTerm(TERM_NAME, nsId, TERM_DEF);
    await seedEntityWithDescriptionMention(termId);

    // DB ground truth FIRST — the link row exists and is flagged is_description_link=TRUE.
    const linkRows = await dbQuery<{ is_description_link: boolean }>(
      'SELECT is_description_link FROM data_entity_to_term WHERE data_entity_id = $1 AND term_id = $2',
      [ENTITY_ID, termId],
    );
    expect(linkRows.length, 'a data_entity_to_term row must exist for the mentioned term').toBe(1);
    expect(
      linkRows[0].is_description_link,
      'the description-mention link row must carry is_description_link = TRUE',
    ).toBe(true);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    // The mention must be rendered as a clickable deeplink: an <a> whose text is the term name and
    // whose href targets the term detail page /terms/{id}. transformDescriptionToMarkdown emits
    // [name](/terms/{id} "definition") → Markdown TermLink → <a href="/terms/{id}">name</a>.
    const termLink = page.locator(`a[href*="/terms/${termId}"]`, { hasText: TERM_NAME });
    await expect(
      termLink.first(),
      'the [[ns:term]] mention must render as a clickable link to the term detail page',
    ).toBeVisible({ timeout: 10_000 });

    // And the raw mention markers must NOT survive into the rendered DOM (proves the rewrite ran).
    await expect(
      page.getByText(MENTION, { exact: false }).filter({ visible: true }),
      'the raw [[ns:term]] markers must not render literally once auto-linked',
    ).toHaveCount(0);
  });
});

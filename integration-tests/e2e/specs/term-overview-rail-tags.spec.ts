import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-084 — F-156 Term Overview Right-Rail tag chips: the term Overview renders the assigned tag
 * chips with importance-first ordering (important tags precede non-important; alphabetical within
 * each group).
 *
 * Protocol: integration-tests/protocols/IT-084-term-overview-rail-tags.md
 * Gates: validates F-156 — UC-002 (at <=20 tags the importance-first sort is honoured: SUCCESS) +
 *        UC-008 (a term with no tags shows the actionable "Not created." empty state).
 *
 * GROUND-TRUTH (read 2026-06): route /terms/{id}/overview → GET /api/terms/{id} (TermDetails).
 * OverviewTags.tsx renders chips: `tags.slice(0, visibleLimit=20).sort(tagsCompare)` (:47-49).
 * tagsCompare (:20-26) returns important-first, then name.localeCompare. TagItem renders the tag
 * name verbatim as the chip label (TagItem.tsx:32-42). Empty state is "Not created." (:93). Term
 * tags link table: tag_to_term(tag_id, term_id); tag(id, name, important) (verified via
 * information_schema).
 *
 * SUCCESS ORDER TRAP: the important tag is named so it sorts AFTER the plain tag alphabetically
 * (z... vs a...). Correct importance-first ordering therefore puts the important chip BEFORE the
 * plain one — the OPPOSITE of alphabetical — so a green assertion proves the importance sort and
 * not an accidental alpha pass.
 *
 * DEFERRED — the slice-then-sort bug (F-156 facet
 * tags_slice_then_sort_ordering_bug_important_tags_silently_hidden, OverviewTags.tsx:47-49) hides an
 * important tag only when it falls at API-payload index >=20. VERIFIED (2026-06, live probe of
 * GET /api/terms/{id}.tags): the backend returns the tags in NON-DETERMINISTIC order (neither id nor
 * importance ordered), so an e2e cannot deterministically force the important tag past index 20 — a
 * pin here would flake on hash ordering. This bug belongs in a unit test that renders OverviewTags
 * with a fixed 21-tag array (already listed in F-156 test_matrix.unit as a GAP); it is intentionally
 * NOT pinned at the e2e layer.
 */
const TERM_NS = 'it084_ns';
const TERM_NAME = 'it084_TaggedTerm';
const IMPORTANT_TAG = 'it084_zzz_important'; // alphabetically LAST — must still render FIRST
const PLAIN_TAG = 'it084_aaa_plain'; // alphabetically FIRST — must render AFTER the important one

// empty-state fixture (UC-008)
const EMPTY_TERM_NAME = 'it084_UntaggedTerm';

async function getOrCreateNamespace(name: string): Promise<number> {
  const sel = await dbQuery<{ id: number }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [name]);
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [name]);
  return Number(ins[0].id);
}

async function getOrCreateTerm(name: string, nsId: number): Promise<number> {
  const sel = await dbQuery<{ id: number }>(
    'SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1',
    [name, nsId],
  );
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>(
    'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
    [name, 'it084 term', nsId],
  );
  return Number(ins[0].id);
}

async function getOrCreateTag(name: string, important: boolean): Promise<number> {
  const sel = await dbQuery<{ id: number }>('SELECT id FROM tag WHERE name = $1 LIMIT 1', [name]);
  if (sel[0]) {
    await dbQuery('UPDATE tag SET important = $2 WHERE id = $1', [sel[0].id, important]);
    return Number(sel[0].id);
  }
  const ins = await dbQuery<{ id: number }>(
    'INSERT INTO tag (name, important) VALUES ($1, $2) RETURNING id',
    [name, important],
  );
  return Number(ins[0].id);
}

async function linkTagToTerm(termId: number, tagId: number): Promise<void> {
  await dbQuery('DELETE FROM tag_to_term WHERE term_id = $1 AND tag_id = $2', [termId, tagId]);
  await dbQuery('INSERT INTO tag_to_term (tag_id, term_id) VALUES ($1, $2)', [tagId, termId]);
}

const termFetch = (page: import('@playwright/test').Page, id: number) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/terms/${id}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-156 Term Overview right-rail — tag chips with importance-first ordering', () => {
  test('UC-002: at <=20 tags the important tag chip renders before the non-important one', async ({
    page,
  }) => {
    const nsId = await getOrCreateNamespace(TERM_NS);
    const termId = await getOrCreateTerm(TERM_NAME, nsId);
    const importantId = await getOrCreateTag(IMPORTANT_TAG, true);
    const plainId = await getOrCreateTag(PLAIN_TAG, false);
    // clean slate then link both
    await dbQuery('DELETE FROM tag_to_term WHERE term_id = $1', [termId]);
    await linkTagToTerm(termId, importantId);
    await linkTagToTerm(termId, plainId);

    const detail = termFetch(page, termId);
    await page.goto(`/terms/${termId}/overview`);
    await detail;

    // Both chips render.
    await expect(page.getByText(IMPORTANT_TAG).first(), 'important tag chip must render').toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(PLAIN_TAG).first(), 'plain tag chip must render').toBeVisible({
      timeout: 10_000,
    });

    // Importance-first ORDER: the important chip's name must appear before the plain chip's name in
    // the rendered DOM. We compare the two chips' bounding-box positions (top, then left). Both
    // names are unique it084_ strings so the locators are unambiguous.
    const importantBox = await page.getByText(IMPORTANT_TAG).first().boundingBox();
    const plainBox = await page.getByText(PLAIN_TAG).first().boundingBox();
    expect(importantBox, 'important chip must be laid out').not.toBeNull();
    expect(plainBox, 'plain chip must be laid out').not.toBeNull();
    const importantBefore =
      importantBox!.y < plainBox!.y - 1 ||
      (Math.abs(importantBox!.y - plainBox!.y) <= 1 && importantBox!.x < plainBox!.x);
    expect(
      importantBefore,
      `important chip ("${IMPORTANT_TAG}", alpha-last) must render BEFORE plain chip ` +
        `("${PLAIN_TAG}", alpha-first) — proving importance-first sort, not alphabetical. ` +
        `important=(${importantBox!.x},${importantBox!.y}) plain=(${plainBox!.x},${plainBox!.y})`,
    ).toBe(true);
  });

  test('UC-008: a term with no tags shows the "Not created." empty state', async ({ page }) => {
    const nsId = await getOrCreateNamespace(TERM_NS);
    const termId = await getOrCreateTerm(EMPTY_TERM_NAME, nsId);
    await dbQuery('DELETE FROM tag_to_term WHERE term_id = $1', [termId]);

    const detail = termFetch(page, termId);
    await page.goto(`/terms/${termId}/overview`);
    await detail;

    // No it084_ tag chip renders for this term.
    await expect(
      page.getByText(IMPORTANT_TAG).filter({ visible: true }),
      'an untagged term must render no tag chips',
    ).toHaveCount(0);

    // The Tags section heading is present...
    await expect(
      page.getByRole('heading', { name: 'Tags' }).first(),
      'the Tags section heading must render',
    ).toBeVisible({ timeout: 10_000 });
    // ...and the tags-specific empty state renders its "Add tags" affordance (OverviewTags.tsx:96)
    // — this uniquely identifies the Tags rail's empty state (the generic "Not created." copy is
    // shared by other rail sections, so we assert the tag-specific Add-tags control instead).
    await expect(
      page.getByRole('button', { name: 'Add tags' }).first(),
      'the empty Tags rail must offer an inline "Add tags" affordance',
    ).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
import { seedTermLinkedToEntity, seedTermWithDefinition } from '../helpers/db';

/**
 * IT-033 — F-002 (term-side): the term's "Linked entities" tab lists entities linked to the term.
 *
 * Protocol: integration-tests/protocols/IT-033-term-linked-entities.md
 * Gates: validates F-002 — the term→entity reverse-lookup view (distinct surface + code path from
 *        IT-016, which verifies the entity→term direction).
 *
 * The term detail "Linked entities" tab (/terms/{id}/linked-entities → GET /api/terms/{id}/linked_entities)
 * lists the entities linked to the term. Per-term + data-driven: a term with no links lists none.
 */
const LINKED_TERM = 'IT033LinkedTerm';
const UNLINKED_TERM = 'IT033UnlinkedTerm';
const ENTITY_NAME = 'it002_table'; // entity 2001's external_name

const linkedEntitiesFetch = (page: import('@playwright/test').Page, id: number) =>
  page.waitForResponse((r) => r.url().includes(`/api/terms/${id}/linked_entities`) && r.ok());

test.describe('F-002 Term linked entities — the term page lists linked entities', () => {
  test('a term linked to an entity lists it on the Linked entities tab', async ({ page }) => {
    const id = await seedTermLinkedToEntity(LINKED_TERM);

    const linked = linkedEntitiesFetch(page, id);
    await page.goto(`/terms/${id}/linked-entities`);
    await linked;

    await expect(
      page.getByText(ENTITY_NAME).first(),
      'the linked entity must be listed on the term page',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a term with no linked entities lists none (negative)', async ({ page }) => {
    const id = await seedTermWithDefinition(UNLINKED_TERM, 'IT033 unlinked term', 'IT033-ns');

    const linked = linkedEntitiesFetch(page, id);
    await page.goto(`/terms/${id}/linked-entities`);
    await linked;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(ENTITY_NAME).filter({ visible: true }),
      'a term with no links must list no entity',
    ).toHaveCount(0);
  });
});

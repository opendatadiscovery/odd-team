import { test, expect } from '@playwright/test';
import { seedEntityTag, clearEntityTags, ENTITY_ID } from '../helpers/db';

/**
 * IT-020 — F-018 Manual Object Tagging: the Overview renders an entity's assigned tag chips.
 *
 * Protocol: integration-tests/protocols/IT-020-entity-tags-display.md
 * Gates: validates F-018 (a tag assigned to an entity reaches the entity read surface).
 *
 * The tags panel is data-driven: it shows the assigned tag chip (name rendered verbatim — verified
 * live) and nothing when unassigned. Distinct from IT-005 (F-018 catalog Top-Tags ordering bug) —
 * this is the per-entity tag-chip display on the Overview (OverviewTags / TagItem).
 */
const TAG = 'IT020GoldTag';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-018 Entity tags — Overview renders the tag chip', () => {
  test('a tagged entity renders the tag on the Overview', async ({ page }) => {
    await seedEntityTag(TAG);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(TAG).first(),
      'the Overview must render the assigned tag name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no tags does not render the tag (negative)', async ({ page }) => {
    await clearEntityTags();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(TAG),
      'with no tag assignment the tag name must not render',
    ).toHaveCount(0);
  });
});

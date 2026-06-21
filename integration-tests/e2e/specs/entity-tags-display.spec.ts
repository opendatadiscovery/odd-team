import { test, expect } from '@playwright/test';
import {
  seedEntityTag,
  clearEntityTags,
  seedEntityImportantTagPastCap,
  ENTITY_ID,
} from '../helpers/db';

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
  // Each test owns its precondition: start from a clean tag set on the shared entity (2001). The #1768
  // case below seeds >20 tags via seedEntityImportantTagPastCap; without this hermetic reset a reused /
  // pinned stack (build-once, run IT-020 then feature-complete against one image — the LSN-033 pattern)
  // carries that residue into the positive test, pushing its single seeded tag past the importance-
  // ordered 20-cap so it is no longer in the collapsed view. Caught in the CTRIB-026 /review.
  test.beforeEach(async () => {
    await clearEntityTags();
  });

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

  // #1768 Defect 1 + 3 — the Overview tag list truncates to 20. An important tag past that cap must
  // still surface (importance-ordered) WITHOUT expanding "View All", and an inline hint must show the
  // visible/total counts. Pre-fix `tags.slice(0,20).sort(...)` sorted only the already-truncated
  // window, hiding the important tag; this is the user-facing regression guard for the fix.
  test('an important tag past the truncation cap is visible while collapsed (#1768)', async ({
    page,
  }) => {
    const { importantName, total } = await seedEntityImportantTagPastCap();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    // Defect 1: the important tag (seeded last in wire order) ranks first after sort-before-slice,
    // so it is in the collapsed top-20 without clicking "View All". RED on the pre-fix slice-then-sort.
    await expect(
      page.getByText(importantName).first(),
      'the important tag must appear in the collapsed top-20 (sort before slice)',
    ).toBeVisible({ timeout: 10_000 });

    // Defect 3: the inline truncation hint shows visible/total without expanding.
    await expect(
      page.getByText(`Showing 20 of ${total}`),
      'the truncation hint must show the visible/total counts',
    ).toBeVisible();
  });
});

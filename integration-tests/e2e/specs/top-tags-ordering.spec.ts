import { test, expect } from '@playwright/test';
import { seedPopularYoungTags } from '../helpers/db';

/**
 * IT-005 — Top Tags ordering (oldest-by-id, not most-popular).
 *
 * Protocol: integration-tests/protocols/IT-005-top-tags-ordering.md
 * Gates: validates F-018 (Manual Object Tagging) · regresses PLT-026 (LSN-019).
 *
 * The bug: `ReactiveTagRepositoryImpl.listMostPopular` paginates by `TAG.ID ASC`
 * BEFORE aggregating usage (ReactiveTagRepositoryImpl.java:147-148). Page 1 (size 30)
 * is therefore the 30 OLDEST tags by id, re-ranked by usage only WITHIN that window —
 * so the youngest tags can never reach page 1 even when they are the most used. The
 * OpenAPI op `getPopularTagList` and the "Top Tags" UI label both promise "sorted by
 * popularity"; the implementation cannot honour that past one page.
 *
 * Why a real backend (no mock): the defect is in the SQL. The Overview's TopTagsList
 * re-sorts client-side by usedCount, so the popular-young tags can only be missing
 * from the UI because the backend never returned them. We seed a catalog where the
 * 5 most-used tags are also the 5 youngest, then read the rendered Top Tags.
 *
 * EXPECTED RESULT TODAY: RED. The 5 most-popular (youngest) tags are absent from Top
 * Tags; the strip shows older, less-used tags. Goes green when listMostPopular
 * aggregates BEFORE paginating (move ORDER BY usage_count DESC outside the paginate).
 */
test.describe('IT-005 Top Tags — the most-popular tags must appear, even when youngest', () => {
  test('the 5 most-used (youngest) tags surface on the Overview "Top Tags" strip (PLT-026 / F-018 H-001)', async ({
    page,
  }) => {
    // ---- arrange: 30 old low-use tags + 5 young high-use tags (seeded in the DB) ----
    const popNames = await seedPopularYoungTags();
    expect(popNames.length, 'precondition: 5 popular-young tag names were seeded').toBe(5);

    // ---- act: open the home/Overview page, which renders the "Top Tags" strip via
    //      useGetPopularTags({ page: 1, size: 30 }) → the buggy listMostPopular ----
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Give the Top Tags query time to resolve and render its TagItems.
    await page.waitForTimeout(1500);

    // ---- assert: the most-popular tag (usedCount=5, youngest) MUST be on the strip.
    //      It is the clearest falsifier — a correct popularity sort ranks it #1; the
    //      buggy oldest-by-id pagination drops it off page 1 entirely. ----
    const mostPopular = popNames[popNames.length - 1]; // the last-seeded = youngest = highest id
    await expect(
      page.getByText(mostPopular, { exact: true }),
      `The most-used tag "${mostPopular}" (usedCount=5, the youngest) must appear in ` +
        `"Top Tags". If it is absent, listMostPopular returned the 30 OLDEST tags by id ` +
        `and re-ranked only within them (PLT-026 / LSN-019, ReactiveTagRepositoryImpl.java:147-148) ` +
        `— the "Top Tags"/getPopularTagList "sorted by popularity" contract is broken past page 1. ` +
        `Seeded popular-young tags: ${JSON.stringify(popNames)}.`,
    ).toBeVisible();
  });
});

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
 * EXPECTED RESULT: GREEN since the 2026-06-12 fix (#1773 Thread A / CTRIB-007) —
 * listMostPopular now aggregates usage over the FULL directory, then orders
 * usage DESC with id-ASC ties, then paginates. This spec guards that contract:
 * it flips RED if pagination ever truncates before aggregation again (proven
 * RED against pre-fix main, run-log 2026-06-12).
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

    // ---- assert: EVERY most-used tag (usedCount=5, the youngest five) MUST be on the
    //      strip — a correct popularity sort ranks them on page 1; the old oldest-by-id
    //      pagination dropped them off page 1 entirely (fixed by #1773 Thread A /
    //      CTRIB-007: usage aggregated over the full directory, THEN paginated).
    //      The TagItem chip renders the name and the usedCount span with a CSS-margin
    //      gap (no whitespace text node): textContent is "it005-POP-0055". So match the
    //      name as a SUBSTRING, never exact/word-boundary (the pin was born RED — its
    //      PASS side first ran on the 2026-06-12 fix and exposed this). ----
    for (const name of [...popNames].reverse()) { // youngest (highest id) first — the clearest falsifier
      await expect(
        page.getByText(name),
        `The most-used tag "${name}" (usedCount=5, among the youngest) must appear in ` +
          `"Top Tags". If it is absent, listMostPopular returned the 30 OLDEST tags by id ` +
          `and re-ranked only within them (PLT-026 / LSN-019, the pre-0.28.0 bug at ` +
          `ReactiveTagRepositoryImpl.java:147-148) — the "Top Tags"/getPopularTagList ` +
          `"sorted by popularity" contract would be broken past page 1. ` +
          `Seeded popular-young tags: ${JSON.stringify(popNames)}.`,
      ).toBeVisible();
    }
  });
});

import { test, expect } from '@playwright/test';

/**
 * IT-130 — F-032 Data Quality dashboard: the ownership-role filter is labelled
 * "Owner title", not the ambiguous bare "Title".
 *
 * Protocol: integration-tests/protocols/IT-130-dq-owner-title-filter-label.md
 * Gates: validates F-032 (Quality Dashboard filtering) · traces #1767 / CTRIB-011
 *        (the LSN-020 input-name-vs-binding family; backlog PLT-179).
 *
 * The bug: the DQ-dashboard filter rendered the bare label `t('Title')`
 * (TitleFilter.tsx:29) while its value space is ODD's ownership-Title catalog and its
 * selected ids bind to OWNERSHIP.TITLE_ID (the owner's ROLE, e.g. "Data Steward") —
 * NOT the dataset name. An operator reads "Title" as the dataset name and gets a
 * confidently-wrong, non-empty aggregate with no error/empty-state. The fix relabels
 * the filter to "Owner title" (it pairs with the adjacent "Owner" filter and matches
 * the platform's existing OwnerTitleAutocomplete naming), keeping the intended binding.
 *
 * EXPECTED: GREEN on the working-tree SUT (the fix); RED on `ODD_SUT=ref:main` (pre-fix,
 * the filter reads the bare "Title", so "Owner title" is absent).
 *
 * No seed/auth needed: the filter sidebar (DataQuality.tsx:11) renders on /data-quality
 * regardless of DQ data, on the odd-minimal DISABLED stack.
 */

test.describe('IT-130 DQ dashboard — ownership filter is labelled "Owner title" (#1767)', () => {
  test('the ownership-role filter reads "Owner title", not the bare "Title"', async ({
    page,
  }) => {
    await page.goto('/data-quality');

    // the filter panel rendered (DataQualityFilters.tsx:59 — the "Filters" heading)
    await expect(
      page.getByText('Filters', { exact: true }),
      'the Data Quality filter sidebar must render on /data-quality',
    ).toBeVisible({ timeout: 20_000 });

    // the ownership filter is labelled "Owner title". On the pre-fix SUT the label is
    // the bare "Title" and this finds zero -> RED.
    const ownerTitle = page.getByText('Owner title');
    await expect(
      ownerTitle.first(),
      'the DQ ownership-role filter must be labelled "Owner title" — it binds ' +
        'OWNERSHIP.TITLE_ID (the owner role, not the dataset name; #1767/CTRIB-011). ' +
        'A bare "Title" here reads as the dataset name and silently misleads operators.',
    ).toBeVisible({ timeout: 20_000 });

    // it appears on BOTH the tables side and the tests side of the panel
    // (DataQualityFilters.tsx:73 deTitleIds + :88 titleIds — one shared component)
    expect(
      await ownerTitle.count(),
      'the "Owner title" filter must render on both the tables side and the tests side',
    ).toBeGreaterThanOrEqual(2);

    // pixel review (design-before-build step 5): capture the rendered filter sidebar
    await page.screenshot({ path: 'test-results/it-130-dq-owner-title-filter.png' });
  });
});

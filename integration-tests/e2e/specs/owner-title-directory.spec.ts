import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-080 — F-036 Owner-Relationship Title Directory.
 *
 * Protocol: integration-tests/protocols/IT-080-owner-title-directory.md
 * Gates: validates F-036 (the Title directory's operator-facing surfaces).
 *
 * A "Title" is an owner-relationship label ("Data Steward", "DBA", ...) attached when ownership is
 * granted, and consumed by Policy conditions (dataEntity:owner:title == 'X'). F-036's PRIMARY finding
 * (ui_review_2026_05_26 + reflection H-006/UC-006, both CONTRADICTED) is that there is NO Titles
 * MANAGEMENT directory: ManagementTabs.tsx:19-50 enumerates 9 tabs and none is Titles; managementRoutes
 * declares no titles route; TitleController has no write endpoint; the soft-delete machinery has zero
 * production callers. The directory is administered ONLY via the free-text auto-create side-channel and
 * is readable ONLY through the Data Quality runs TitleFilter. The assignment's hypothesis ("navigate the
 * titles management route, verify the title renders in the directory") is therefore CONTRADICTED by the
 * product — so per LSN-029 this spec PINS the contradiction (no Titles tab) as the primary test, and
 * exercises the one genuine operator-visible read surface (the DQ-runs TitleFilter) as the corner.
 *
 * Operator consequence of the contradiction: an operator who reads the live Policies caveat, recognises
 * a case-variant policy leak, and goes looking for a "Titles" tab to clean it up finds nothing — the
 * directory grows monotonically and cannot be curated in-product (F-036 H-006). Tracked: DOC-GAP-146 /
 * REFACTOR-206 / REFACTOR-624.
 *
 * GROUND-BEFORE-ASSERT:
 *  - Primary: navigate /management; assert the rendered tab nav shows the known tabs and NO "Titles"
 *    tab (role=tab characterization; flips RED the day a curation surface is added).
 *  - Corner: seed a title row; navigate /data-quality; open a "Title" filter autocomplete; assert the
 *    seeded title renders as a dropdown option (UI render of the directory via GET /api/titles) + DB
 *    read-back confirms the row.
 */

// ---- namespace (the assigned 20800–20809 range is for entities; title.id is a sequence so we key the
// title by NAME — names it080_; idempotent SELECT-then-INSERT) ----
const TITLE_NAME = 'it080_ZZZ_Steward';

// The 9 Management tabs that DO exist (managementRoutes.ts + ManagementTabs.tsx). "Titles" is NOT one.
const EXISTING_TABS = [
  'Namespaces',
  'Datasources',
  'Integrations',
  'Collectors',
  'Owners',
  'Tags',
  'Roles',
  'Policies',
];

async function seedTitle(name: string): Promise<number> {
  const sel = await dbQuery<{ id: number }>(`SELECT id FROM title WHERE name = $1 LIMIT 1`, [name]);
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>(`INSERT INTO title (name) VALUES ($1) RETURNING id`, [name]);
  return Number(ins[0].id);
}

test.describe('F-036 Owner-Relationship Title Directory', () => {
  test('Management has NO Titles management/curation tab (UC-006 contradiction pin)', async ({ page }) => {
    await page.goto('/management');

    // the Management nav rendered (a known tab is present) — proves we are looking at the real nav,
    // not an unrendered/empty shell that would make the negative assertion vacuous.
    await expect(
      page.getByRole('tab', { name: 'Owners' }).first(),
      'the Management tab nav must render (Owners tab present)',
    ).toBeVisible({ timeout: 10_000 });

    // every documented management tab is present...
    for (const tab of EXISTING_TABS) {
      await expect(
        page.getByRole('tab', { name: tab }).first(),
        `the '${tab}' management tab must render`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // ...and there is NO "Titles" management tab. This is the CONTRADICTION the assignment's
    // hypothesis ("titles management directory") runs into: the product has no titles curation surface.
    // KNOWN BUG / GAP (F-036 H-006, tracked DOC-GAP-146 + REFACTOR-206): the Title directory is
    // write-only-by-accumulation via the ownership-form side-channel; it has no Management tab, no
    // list view, no rename/merge/delete UI. RED the instant a Titles curation surface is added.
    await expect(
      page.getByRole('tab', { name: 'Titles' }),
      'there must be NO Titles management tab (admin-via-side-channel is the sole write path)',
    ).toHaveCount(0);
  });

  test('a seeded title is reachable via the Data Quality runs Title filter (the one read surface)', async ({
    page,
  }) => {
    const titleId = await seedTitle(TITLE_NAME);

    // ground truth: the title row exists in the directory
    const dbRows = await dbQuery<{ id: number; name: string }>(`SELECT id, name FROM title WHERE id = $1`, [
      titleId,
    ]);
    expect(dbRows[0]?.name, 'the seeded title must exist in the directory').toBe(TITLE_NAME);

    // the DQ runs page hosts two "Title" filter autocompletes (DataQualityFilters.tsx:73,88), each
    // backed by GET /api/titles (useGetTitleList). Opening one fires the directory fetch.
    const titlesFetch = page.waitForResponse(
      r => /\/api\/titles(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto('/data-quality');

    // The shared Input renders the label as a styled <label> with no htmlFor, so the a11y tree shows it
    // as a standalone "Title" text node followed by a combobox "Search by name" (placeholder, shared by
    // every filter). Anchor on the "Title" text and take the FIRST combobox that follows it. .first() on
    // the text = the "Filters for tables" Title filter (deTitleIds, the first of the two TitleFilters).
    const titleInput = page
      .getByText('Title', { exact: true })
      .first()
      .locator('xpath=following::*[@role="combobox"][1]');
    await expect(titleInput, 'the DQ-runs Title filter input must render').toBeVisible({ timeout: 10_000 });
    await titleInput.click();
    await titlesFetch;

    // type the distinctive seeded name to narrow the options (server returns id-ASC; the client filters)
    await titleInput.fill('it080');

    // the seeded title renders as a selectable option in the directory dropdown (UI render of the row)
    await expect(
      page.getByRole('option', { name: new RegExp(TITLE_NAME) }).first(),
      'the seeded title must render as an option in the DQ-runs Title filter directory dropdown',
    ).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-071 — F-141 Catalog Overview Home Page (the SPA home shell at `/`).
 *
 * Protocol: integration-tests/protocols/IT-071-catalog-overview-home.md
 * Gates: validates F-141 (the Overview.tsx home composition renders its catalog-wide landing
 *        widgets — search + per-class usage dashboard + directory strip — into one route).
 *
 * Overview.tsx (the `/` route) composes six independent widgets: MainSearch + TopTagsList +
 * Domains + DataEntitiesUsageInfo + Directory (+ conditional OwnerAssociation). The skeleton lifts
 * once identity + the popular-tags fetch resolve (Overview.tsx:29-32); the other widgets self-load.
 * This drives a real browser to `/` and asserts the composition SHELL actually rendered, by
 * checking the always-present, data-driven widgets:
 *   - MainSearch — the hero search box (placeholder "Search", shared/MainSearch)
 *   - DataEntitiesUsageInfo — the "Entities" dashboard with a "Total entities" count
 *     (DataEntitiesUsageInfoView.tsx: heading t('Entities') + t('Total entities') + totalCount)
 *   - Directory strip — the Overview-side mini Directory (heading t('Directories'))
 *
 * GROUND-TRUTH (curled live 2026-06-07): `/` fires GET /api/tags?page=1&size=30 (popular tags —
 * the skeleton-lift gate), GET /api/dataentities/usage (total_count:20 -> the Entities widget),
 * GET /api/directory. UC-01 (the composition smoke) had NO test before this.
 *
 * Per-spec ids: 20710-20719. A searchable entity is seeded so the catalog is non-empty and the
 * usage dashboard has a real count to render; a popular tag drives the home Top-Tags strip.
 */
const TAG = 'IT071HomeTag';
const ENT_FOR_TAG = 20712;
const ENT_NAME = 'it071_home_entity';

// the popular-tags fetch that gates the home-page skeleton (Overview.tsx waits on it before
// composing). GET /api/tags?page=... is the wire path for getPopularTagList (verified live).
const popularTagsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) =>
      /\/api\/tags(\?|$)/.test(r.url()) &&
      r.url().includes('size=') &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

// Seed a searchable entity, then tag it, so the tag has usedCount>=1 and surfaces in the
// catalog-wide popular-tags list the home Top-Tags strip renders. Replicates seedEntityTag's
// verified SQL (tag + tag_to_data_entity) but against this spec's own ids.
async function seedPopularTag(): Promise<void> {
  await seedSearchableEntity(ENT_FOR_TAG, ENT_NAME);
  const rows = await dbQuery<{ id: number }>('SELECT id FROM tag WHERE name = $1 LIMIT 1', [TAG]);
  const tagId =
    rows[0]?.id ??
    (await dbQuery<{ id: number }>('INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id', [TAG]))[0].id;
  await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1 AND tag_id = $2', [ENT_FOR_TAG, tagId]);
  await dbQuery('INSERT INTO tag_to_data_entity (tag_id, data_entity_id, external) VALUES ($1, $2, false)', [
    tagId,
    ENT_FOR_TAG,
  ]);
}

test.describe('F-141 Catalog Overview Home — / composition', () => {
  test('the home page composes the catalog-overview widgets (search + usage dashboard + directory)', async ({
    page,
  }) => {
    // ---- arrange: a non-empty catalog so the usage dashboard has a real count ----
    await seedSearchableEntity(20710, 'it071_overview_seed');

    // ---- act: open the home page; wait for the popular-tags fetch that lifts the skeleton ----
    const tags = popularTagsFetch(page);
    await page.goto('/');
    await tags;

    // ---- assert: the composition shell rendered its always-present widgets ----
    // (1) MainSearch hero box — the home (`mainSearch`) variant uses the descriptive placeholder
    // t('main search placeholder') = "Search data tables, feature group, jobs and ML models via
    // keywords" (verified in en.json), NOT the terse "Search" of the /search-page box.
    await expect(
      page.getByPlaceholder(/Search data tables/i).first(),
      'the home page must render the MainSearch hero box',
    ).toBeVisible({ timeout: 10_000 });

    // (2) DataEntitiesUsageInfo — the "Entities" dashboard with the "Total entities" count card.
    await expect(
      page.getByText('Total entities', { exact: true }).first(),
      'the home page must compose the per-class usage dashboard (Total entities card)',
    ).toBeVisible({ timeout: 10_000 });

    // (3) Directory strip — the Overview-side mini Directory. NB its heading is t('Directory')
    // (SINGULAR — Overview/Directory/Directory.tsx), distinct from the full-page t('Directories').
    // It renders only when GET /api/directory returns >0 prefix buckets (the catalog is non-empty).
    await expect(
      page.getByText('Directory', { exact: true }).first(),
      'the home page must compose the Directory strip',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the home Top-Tags strip renders a popular (used) tag', async ({ page }) => {
    // ---- arrange: a tag with usedCount>=1 so it reaches the catalog-wide popular list ----
    await seedPopularTag();

    const tags = popularTagsFetch(page);
    await page.goto('/');
    await tags;

    // the popular tag chip must appear in the home Top-Tags strip (TopTagsList renders tag.name).
    await expect(
      page.getByText(TAG).first(),
      'a used tag must surface in the home page Top-Tags strip',
    ).toBeVisible({ timeout: 10_000 });
  });
});

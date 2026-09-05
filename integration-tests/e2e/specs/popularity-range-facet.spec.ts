import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { dbQuery, seedSearchableEntity, seedSearchableTerm } from '../helpers/db';

/**
 * IT-156 — the Popularity range facet, driven as a user (ST-9 / #1843 / CTRIB-066, ADR D5/D8/D10/D11).
 *
 * Protocol: integration-tests/protocols/IT-156-popularity-range-facet.md
 * Gates: validates F-017 (the catalog-search promise; F-017-UC-16).
 *
 * WHY EVERY CASE ASSERTS *NARROWING*, NOT PRESENCE
 * ------------------------------------------------
 * On `ref:main` the `popularity_min` / `popularity_max` params are unknown and `paramsToSearchState` drops them, so a
 * deep link lists the whole match set — "the 40-view entity is listed" is GREEN on the unfixed base. Each case therefore
 * asserts that the entities OUTSIDE the band (and the term, which has no view count) are ABSENT: that is what goes RED.
 *
 * GROUND TRUTH (read before assert):
 *  - The range rides the URL in SCORES (band 5 = 31–62 views, band 9 = 511–1,022, band 0 = never viewed); the chip and
 *    the thumbs speak VIEWS, from the server's facet response.
 *  - MUI's slider thumbs are hidden range inputs (role=slider); a keyboard step moves ONE rail stop (marks-only mode),
 *    and the rail holds only the OCCUPIED bands (here 0 / 5 / 9) — so one → on the left thumb lands on band 5.
 *  - The facet wire: POST /api/search/assets/facets/popularity → { buckets: [{score, min_views, max_views, count}] }
 *    (snake_case on the wire; the TS client camelCases AFTER fetch, so the response body read here is snake_case).
 *  - Seeding sets BOTH view_count and the union score (the snapshot job would otherwise reset a bare score to 0).
 *
 * Namespace: ids 21560-21562 · names it156pop_* · term it156popterm · saved search prefix it156-.
 */
const TOKEN = 'it156pop';
const NEVER_ID = 21560;
const SOME_ID = 21561;
const MANY_ID = 21562;
const NEVER = `${TOKEN}_never`;
const SOME = `${TOKEN}_some`; // 40 views → band 5 (31–62)
const MANY = `${TOKEN}_many`; // 1,000 views → band 9 (511–1,022)
const TERM = `${TOKEN}term`;
const SAVED_PREFIX = 'it156-';

// query-string serialises the range as two scalar params; the browser may percent-encode brackets elsewhere.
const MIN5 = /popularity_min=5/;
const MAX5 = /popularity_max=5/;
const MIN4 = /popularity_min=4/;
const STATUS_IN_URL = /statuses(\[\]|%5B%5D)=\d+/;
const FACET_URL = /\/api\/search\/assets\/facets\/popularity$/;

async function seedViews(id: number, views: number): Promise<void> {
  await dbQuery('UPDATE data_entity SET view_count = $2, status = 1 WHERE id = $1', [id, views]);
  await dbQuery(
    `UPDATE asset_search_entrypoint SET popularity_score = asset_popularity_bucket($2::bigint)
      WHERE asset_kind = 'DATA_ENTITY' AND asset_id = $1`,
    [id, views],
  );
}

async function deleteSavedSearchesNamed(request: APIRequestContext, prefix: string): Promise<void> {
  const res = await request.get('/api/saved_searches?page=1&size=100');
  if (!res.ok()) return;
  const body = (await res.json()) as { items: Array<{ id: number; name: string }> };
  for (const item of body.items ?? []) {
    if (item.name.startsWith(prefix)) await request.delete(`/api/saved_searches/${item.id}`);
  }
}

async function setup(request: APIRequestContext): Promise<void> {
  await seedSearchableEntity(NEVER_ID, NEVER);
  await seedSearchableEntity(SOME_ID, SOME);
  await seedSearchableEntity(MANY_ID, MANY);
  await seedSearchableTerm(TERM);
  await seedViews(NEVER_ID, 0);
  await seedViews(SOME_ID, 40);
  await seedViews(MANY_ID, 1000);
  await deleteSavedSearchesNamed(request, SAVED_PREFIX);
}

/** The results header only renders once the asset search has resolved — the honest "everything settled" signal. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByTestId('search-results-count')).toBeVisible({ timeout: 30_000 });
}

async function gotoSearch(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await settled(page);
}

/** The narrowing oracle: `present` are listed, `absent` are not. RED on base for the absent half. */
async function expectListed(page: Page, present: string[], absent: string[]): Promise<void> {
  for (const name of present) {
    await expect(page.getByText(name, { exact: true }).first(), `${name} is listed`).toBeVisible({ timeout: 15_000 });
  }
  for (const name of absent) {
    await expect(
      page.getByText(name, { exact: true }).filter({ visible: true }),
      `THE NARROWING: ${name} must be absent (on ref:main it is listed — the range is dropped there)`,
    ).toHaveCount(0);
  }
}

const control = (page: Page) => page.locator('[data-qa="filter-popularity"]');
const chip = (page: Page) => page.locator('[data-qa="filter-popularity-chip"]');
const thumbs = (page: Page) => control(page).getByRole('slider');

test.describe('Popularity range facet — narrows, survives, saves, and the tile links into it (#1843)', () => {
  test.beforeAll(async ({ request, browser }) => {
    test.setTimeout(180_000);
    await setup(request);
    // warm-up: absorb the platform's cold start outside any case's budget (TST-057)
    const page = await browser.newPage();
    await page.goto(`/search?q=${TOKEN}`);
    await page.getByTestId('search-results-count').waitFor({ state: 'visible', timeout: 150_000 });
    await page.close();
  });

  test.afterAll(async ({ request }) => {
    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [NEVER_ID, SOME_ID, MANY_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [[NEVER_ID, SOME_ID, MANY_ID]]);
  });

  test('1 — a keyboard step on each thumb narrows the RENDERED list to the band, data entities only', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, [NEVER, SOME, MANY, TERM], []);
    await expect(control(page).getByText('Data entities only')).toBeVisible();
    await expect(thumbs(page), 'the two thumbs are on the page').toHaveCount(2);

    // → on the LEFT thumb: one rail stop up, from band 0 to band 5 (the rail holds only 0 / 5 / 9)
    await thumbs(page).nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page, 'the lower bound reaches the URL').toHaveURL(MIN5, { timeout: 15_000 });
    await settled(page);
    await expect(chip(page)).toHaveText('Popularity: 31+ views');
    await expectListed(page, [SOME, MANY], [NEVER, TERM]);

    // ← on the RIGHT thumb: from the open top down to band 5 → a closed band
    await thumbs(page).nth(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page, 'the upper bound reaches the URL').toHaveURL(MAX5, { timeout: 15_000 });
    await expect(page).toHaveURL(MIN5);
    await settled(page);
    await expect(chip(page)).toHaveText('Popularity: 31 – 62 views');
    await expectListed(page, [SOME], [NEVER, MANY, TERM]);
  });

  test('2 — a deep link applies the range and names the band', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}&popularity_min=4`);
    await expect(chip(page)).toHaveText('Popularity: 15+ views');
    await expectListed(page, [SOME, MANY], [NEVER, TERM]);
  });

  test('3 — the range SURVIVES a sidebar facet toggle (the #1858 mirror-merge class)', async ({ page }) => {
    test.setTimeout(120_000);
    await dbQuery('UPDATE data_entity SET status = 3 WHERE id = $1', [SOME_ID]); // STABLE
    await gotoSearch(page, `/search?q=${TOKEN}&popularity_min=4`);
    await expectListed(page, [SOME, MANY], [NEVER]);

    // The Statuses facet is a controlled-open autocomplete: type the FULL value (the IT-152 idiom).
    const statuses = page.locator('#filter-statuses');
    await statuses.click();
    await statuses.pressSequentially('STABLE', { delay: 40 });
    const stable = page.getByRole('option', { name: 'STABLE' });
    await expect(stable, 'the Statuses dropdown offered STABLE').toBeVisible({ timeout: 30_000 });
    await stable.click();

    await expect(page, 'the toggled facet reaches the URL').toHaveURL(STATUS_IN_URL, { timeout: 15_000 });
    await expect(page, 'and the range is STILL there — not dropped by the mirror').toHaveURL(MIN4);
    await page.waitForTimeout(1_500); // more than the 400 ms mirror debounce — no late write drops it
    await expect(page, 'no late mirror write drops the range').toHaveURL(MIN4);
    await settled(page);
    await expectListed(page, [SOME], [NEVER, MANY]);
    await dbQuery('UPDATE data_entity SET status = 1 WHERE id = $1', [SOME_ID]);
  });

  test('4 — Clear All removes the range (after it demonstrably narrowed)', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}&popularity_min=4`);
    await expectListed(page, [SOME], [NEVER]);
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page).not.toHaveURL(/popularity_/, { timeout: 15_000 });
    await settled(page);
    await expectListed(page, [NEVER, SOME, MANY, TERM], []);
  });

  test('5 — a saved search stores the range and reapplies it (the LSN-042 class, tenth dimension)', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await gotoSearch(page, `/search?q=${TOKEN}&popularity_min=5&popularity_max=5`);
    await expectListed(page, [SOME], [NEVER, MANY]);

    await page.getByRole('button', { name: 'Save current search' }).click();
    await page.getByPlaceholder('Enter search name').fill(`${SAVED_PREFIX}band5`);
    const created = page.waitForResponse(
      r => /\/api\/saved_searches$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST' && r.status() === 201,
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const spec = ((await (await created).json()) as { spec: Record<string, unknown> }).spec;
    expect(spec.popularity, 'the stored spec carries the range (snake_case wire: popularity{min,max})').toEqual({
      min: 5,
      max: 5,
    });

    // Reload UNFILTERED — the never-viewed entity is back — then reapply.
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, [NEVER], []);
    await page.getByRole('button', { name: 'Saved searches' }).click();
    await page.getByText(`${SAVED_PREFIX}band5`, { exact: true }).click();
    await expect(page, 'reapply rebuilt the range into the URL').toHaveURL(MIN5, { timeout: 15_000 });
    await expect(page).toHaveURL(MAX5);
    await settled(page);
    await expectListed(page, [SOME], [NEVER, MANY]);
  });

  test('6 — the distribution counts the data entities of the OTHER filters, never the term, and follows a facet', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    type Facet = { buckets: Array<{ score: number; min_views: number; max_views: number | null; count: number }> };
    const first = page.waitForResponse(r => FACET_URL.test(new URL(r.url()).pathname) && r.status() === 200);
    await gotoSearch(page, `/search?q=${TOKEN}`);
    const facet = (await (await first).json()) as Facet;
    expect(facet.buckets, '21 bands, scores 0..20 in order').toHaveLength(21);
    expect(facet.buckets.map(b => b.score)).toEqual(Array.from({ length: 21 }, (_, i) => i));
    const counts = Object.fromEntries(facet.buckets.map(b => [b.score, b.count]));
    expect(counts[0], 'band 0 holds the never-viewed entity only — the term is NOT counted').toBe(1);
    expect(counts[5]).toBe(1);
    expect(counts[9]).toBe(1);
    expect(facet.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(3);
    expect(facet.buckets[4].min_views).toBe(15);
    expect(facet.buckets[4].max_views).toBe(30);
    expect(facet.buckets[20].max_views, 'the top band is open').toBeNull();

    // apply a facet: only the STABLE entity (40 views) remains counted
    await dbQuery('UPDATE data_entity SET status = 3 WHERE id = $1', [SOME_ID]);
    const next = page.waitForResponse(r => FACET_URL.test(new URL(r.url()).pathname) && r.status() === 200);
    const statuses = page.locator('#filter-statuses');
    await statuses.click();
    await statuses.pressSequentially('STABLE', { delay: 40 });
    const stable = page.getByRole('option', { name: 'STABLE' });
    await expect(stable).toBeVisible({ timeout: 30_000 });
    await stable.click();
    const narrowed = (await (await next).json()) as Facet;
    const narrowedCounts = Object.fromEntries(narrowed.buckets.map(b => [b.score, b.count]));
    expect(narrowedCounts[5], 'the STABLE entity in band 5 is counted').toBe(1);
    expect(narrowedCounts[9], 'the non-STABLE entity in band 9 is not').toBe(0);
    expect(narrowedCounts[0]).toBe(0);
    await dbQuery('UPDATE data_entity SET status = 1 WHERE id = $1', [SOME_ID]);
  });

  test('7 — the home Popular tile links to a search that reproduces it: most viewed first, unviewed absent', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    // the Popular tile's link is the one whose href carries the popularity sort (the other tiles link elsewhere)
    const viewAll = page.locator('a[href*="sort=popularity"]', { hasText: 'View all' });
    await expect(viewAll, 'the Popular tile has a View all').toBeVisible({ timeout: 30_000 });
    await expect(viewAll).toHaveAttribute('href', '/search?popularity_min=1&sort=popularity');
    await viewAll.click();
    await settled(page);
    await expect(page).toHaveURL(/popularity_min=1/);
    await expect(page).toHaveURL(/sort=popularity/);
    await expect(page.locator('[data-qa="search-sort-menu"]'), 'the sort menu shows the new ordering').toHaveText(
      /Most popular/,
    );
    await expect(chip(page)).toHaveText('Popularity: 1+ views');
    // relative order: other specs may have seeded higher-viewed entities, so assert MANY above SOME, NEVER absent
    const rows = page.getByTestId('search-result-item');
    const manyIdx = await rows.filter({ hasText: MANY }).first().evaluate(el =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    );
    const someIdx = await rows.filter({ hasText: SOME }).first().evaluate(el =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    );
    expect(manyIdx, 'the 1,000-view entity is listed above the 40-view one').toBeLessThan(someIdx);
    await expectListed(page, [MANY, SOME], [NEVER, TERM]);
  });

  test('8 — the "Never viewed" preset lists only never-viewed data entities', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await control(page).getByRole('button', { name: 'Never viewed' }).click();
    await expect(page).toHaveURL(/popularity_max=0/, { timeout: 15_000 });
    await expect(page).toHaveURL(/popularity_min=0/);
    await settled(page);
    await expect(chip(page)).toHaveText('Popularity: never viewed');
    await expectListed(page, [NEVER], [SOME, MANY, TERM]);
  });

  test('9 — with no data entity left by the other filters the control is disabled with its reason', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}&asset_kinds[]=TERM`);
    await expect(page.locator('[data-qa="filter-popularity-disabled"]')).toHaveText(
      'No data entities match your other filters',
      { timeout: 30_000 },
    );
    await expect(thumbs(page)).toHaveCount(0);
  });
});

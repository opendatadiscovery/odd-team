import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  seedIngestionDataSource,
  entityByOddrn,
  seedSearchableEntity,
  seedSearchableTerm,
} from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-155 — a saved search reproduces the search that was saved (#1878 / CTRIB-065, ADR D11).
 *
 * Protocol: integration-tests/protocols/IT-155-saved-search-round-trip.md
 * Gates: validates F-017 (the saved-search promise); regresses PLT-256 (odd-platform#1878).
 *
 * GROUND TRUTH (read before assert):
 *  - Save: SavedSearchForm.tsx captures `location.search` into the spec and POSTs /api/saved_searches; the
 *    201 body is the stored spec (snake_case wire: `favorites`, `asset_kinds` — captured on the real stack in
 *    contributor/CTRIB-065.md §3, where main@96d77668 answered 201 with NEITHER key).
 *  - Reapply: SavedSearches.tsx rebuilds the URL from the stored spec and navigates; the Search page re-reads
 *    the URL (D10) — the Favorites checkbox and the Asset-type narrowing are URL-driven.
 *  - Share: the "Copy link" button calls navigator.clipboard.writeText(<the same rebuilt URL>).
 *  - The oracle is NARROWING: a foil that matches the query token but is outside the scope must be ABSENT.
 */

const DS_ID = 2155;
const DS = '//e2e-it155/ds';
const E = `${DS}/tables/it155_tbl`;
const NAME = 'it155_tbl';
const FOIL_ID = 21551;
const FOIL = 'it155_unstarred_foil';
const TOKEN = 'it155';
const TERM = 'IT155SavedTerm';
const SAVED_PREFIX = 'it155-';

async function deleteSavedSearchesNamed(request: APIRequestContext, prefix: string): Promise<void> {
  const res = await request.get('/api/saved_searches?page=1&size=100');
  if (!res.ok()) return;
  const body = (await res.json()) as { items: Array<{ id: number; name: string }> };
  for (const item of body.items ?? []) {
    if (item.name.startsWith(prefix)) await request.delete(`/api/saved_searches/${item.id}`);
  }
}

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it155-ds');
  expect(await ingestEntities(DS, [tableEntity(E, NAME)]), 'entity ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  await seedSearchableEntity(FOIL_ID, FOIL);
  await seedSearchableTerm(TERM);
  await request.delete(`/api/favorites/DATA_ENTITY/${FOIL_ID}`);
  await request.delete(`/api/favorites/DATA_ENTITY/${e!.id}`);
  await deleteSavedSearchesNamed(request, SAVED_PREFIX);
  return e!.id;
}

const favFilter = (page: Page) =>
  page.getByRole('checkbox', { name: /^Favorites( \(shared\))? only$/ });

/**
 * Navigate to a search URL and wait for the search page to have BOOTED — the saved-search toolbar's
 * "Save current search" button renders once the page is up. The SPA's first paint under load can exceed a
 * single assertion's 15 s bound (TST-057, the contention class), so the boot gets the run's own headroom
 * here; every narrowing assertion afterwards keeps its normal bound.
 */
async function gotoSearch(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page
    .getByRole('button', { name: 'Save current search' })
    .waitFor({ state: 'visible', timeout: 45_000 });
}

/** Save the CURRENT search under `name` through the real dialog; returns the 201 body's stored spec. */
async function saveCurrentSearch(page: Page, name: string): Promise<Record<string, unknown>> {
  await page.getByRole('button', { name: 'Save current search' }).click();
  await page.getByPlaceholder('Enter search name').fill(name);
  const created = page.waitForResponse(
    r =>
      /\/api\/saved_searches$/.test(new URL(r.url()).pathname) &&
      r.request().method() === 'POST' &&
      r.status() === 201
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const body = (await (await created).json()) as { spec: Record<string, unknown> };
  return body.spec;
}

/**
 * Open the Saved-searches popover and reapply the entry named `name`. The popover is a MUI Modal and stays
 * open after the navigation, which marks the rest of the page aria-hidden — so it is dismissed (Escape, as a
 * user would click away) before any role-based assertion on the reapplied page.
 */
async function reapply(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Saved searches' }).click();
  await page.getByText(name, { exact: true }).click();
  await page.keyboard.press('Escape');
}

async function expectListed(page: Page, name: string, present: boolean) {
  const rows = page.getByText(name).filter({ visible: true });
  if (present) {
    await expect(rows.first(), `${name} is listed`).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(rows, `THE NARROWING: ${name} must be absent`).toHaveCount(0);
  }
}

test.describe('Saved search — save -> reapply / share keeps every dimension (#1878)', () => {
  // WARM-UP, once per run: the first request to a freshly started platform (JIT, first queries) plus the first
  // SPA bundle load routinely exceed a single case's bound on a loaded box (TST-057) — three of four runs of
  // this spec lost exactly their FIRST navigation that way. One throw-away page load absorbs it, so each case
  // below measures the saved-search behaviour, not the JVM's cold start. Its own budget, outside any case's.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await browser.newPage();
    await page.goto(`/search?q=${TOKEN}`);
    await page
      .getByRole('button', { name: 'Save current search' })
      .waitFor({ state: 'visible', timeout: 150_000 });
    await page.close();
  });

  test('the Favorites scope survives save -> reapply (the foil stays out)', async ({ page, request }) => {
    const id = await setup(request);
    // arrange: the subject is starred; the foil never is
    expect((await request.put(`/api/favorites/DATA_ENTITY/${id}`)).ok(), 'star via API').toBeTruthy();

    // 1. the live favorites-scoped search is narrowed
    await gotoSearch(page, `/search?favorites=yes&q=${TOKEN}`);
    await expectListed(page, NAME, true);
    await expectListed(page, FOIL, false);

    // 2. save it — the 201 body (the STORED spec) carries the scope. On main this key is absent.
    const spec = await saveCurrentSearch(page, `${SAVED_PREFIX}favorites`);
    expect(spec.favorites, 'the stored spec keeps favorites=true (absent on main)').toBe(true);

    // 3. from the unfiltered search, reapply -> the URL, the control and the list all carry the scope
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, FOIL, true); // unfiltered baseline: the foil is here
    await reapply(page, `${SAVED_PREFIX}favorites`);
    await expect(page).toHaveURL(/favorites=yes/, { timeout: 15_000 });
    await expect(favFilter(page), 'the Favorites checkbox reflects the reapplied scope').toBeChecked();
    await expectListed(page, NAME, true);
    await expectListed(page, FOIL, false);
    // The rendered surface after reapply, for the human review of the change (G-C12 step 5): the toggle on,
    // the URL carrying the scope, the list narrowed.
    await page.screenshot({ path: 'test-results/it155-reapplied-favorites.png', fullPage: true });

    await request.delete(`/api/favorites/DATA_ENTITY/${id}`);
    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
  });

  test('the Asset-type narrowing survives save -> reapply (the data entity stays out)', async ({
    page,
    request,
  }) => {
    await setup(request);

    // 4. the live Terms-only search lists the Term and not the data entity
    await gotoSearch(page, `/search?asset_kinds[]=TERM&q=${TOKEN}`);
    await expectListed(page, TERM, true);
    await expectListed(page, NAME, false);

    // 5. save it (the stored spec keeps the kinds), reapply from the unfiltered search
    const spec = await saveCurrentSearch(page, `${SAVED_PREFIX}terms`);
    expect(spec.asset_kinds, 'the stored spec keeps asset_kinds (absent on main)').toEqual(['TERM']);

    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, NAME, true); // unfiltered baseline
    await reapply(page, `${SAVED_PREFIX}terms`);
    await expect(page).toHaveURL(/asset_kinds/, { timeout: 15_000 });
    await expect(page).toHaveURL(/TERM/);
    await expectListed(page, TERM, true);
    await expectListed(page, NAME, false);

    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
  });

  test('the copied share link carries the same dimensions as the reapply URL', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    expect((await request.put(`/api/favorites/DATA_ENTITY/${id}`)).ok()).toBeTruthy();
    // The Copy-link button calls navigator.clipboard.writeText — capture it (no anchor exists to read).
    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { __it155Copied: string[] }).__it155Copied = copied;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            copied.push(text);
            return Promise.resolve();
          },
        },
      });
    });

    await gotoSearch(page, `/search?favorites=yes&q=${TOKEN}`);
    await expectListed(page, NAME, true);
    await saveCurrentSearch(page, `${SAVED_PREFIX}share`);

    // 6. the row: [name] [Rename] [Copy link] [Delete] — the copy button is the middle icon button
    await page.getByRole('button', { name: 'Saved searches' }).click();
    const row = page
      .getByText(`${SAVED_PREFIX}share`, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"MuiGrid-item")][1]');
    await expect(row.getByRole('button'), 'the row carries Rename / Copy link / Delete').toHaveCount(3);
    await row.getByRole('button').nth(1).click();
    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __it155Copied: string[] }).__it155Copied)
      )
      .toHaveLength(1);
    const link = (await page.evaluate(
      () => (window as unknown as { __it155Copied: string[] }).__it155Copied
    ))[0];
    expect(link, 'the share link is the pre-filtered search URL').toMatch(/\/search\?/);
    expect(link).toMatch(/favorites=yes/);
    expect(link).toMatch(new RegExp(`q=${TOKEN}`));

    await request.delete(`/api/favorites/DATA_ENTITY/${id}`);
    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
  });

  test('a row saved BEFORE the widening reapplies unchanged — no invented narrowing (compatibility)', async ({
    page,
    request,
  }) => {
    await setup(request);
    // 7. a pre-#1878 spec: query + filters only
    const created = await request.post('/api/saved_searches', {
      data: { name: `${SAVED_PREFIX}legacy`, spec: { query: TOKEN, filters: {} } },
    });
    expect(created.status(), 'legacy-shaped spec is accepted').toBe(201);

    // Start from a NARROWED search (the foil is out), so reapplying the legacy row is a real transition:
    // the URL must become exactly the legacy spec — the narrowing gone, no param invented, the foil back.
    // (The saved-search toolbar only renders on a search page, hence a query in the starting URL.)
    await gotoSearch(page, `/search?favorites=yes&q=${TOKEN}`);
    await reapply(page, `${SAVED_PREFIX}legacy`);
    await expect(page).toHaveURL(new RegExp(`q=${TOKEN}`), { timeout: 15_000 });
    await expect(page).not.toHaveURL(/favorites=/);
    await expect(page).not.toHaveURL(/asset_kinds/);
    await expectListed(page, FOIL, true); // unfiltered: the foil is listed, nothing was narrowed

    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
  });
});

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  seedIngestionDataSource,
  entityByOddrn,
  seedSearchableEntity,
  seedSearchableTerm,
  dbQuery,
} from '../helpers/db';
import { ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-148 — Favorites: the star -> find-it-again loop, now through the Catalog search's Favorites filter
 * (#1815 / CTRIB-039 S3+S4, re-grounded for ST-7 / #1841 / CTRIB-061).
 *
 * Protocol: integration-tests/protocols/IT-148-favorites-star-see-loop.md
 * Gates: validates F (Favorites) — a user can star any viewable asset and find it again, on the main-page
 * panel and via the search filter that replaced the retired `/favorites` tab; un-starring removes it.
 *
 * WHY EVERY CASE ASSERTS *NARROWING*, NOT PRESENCE
 * ------------------------------------------------
 * The obvious re-grounding — "go to /search?favorites=yes and assert the starred asset is listed" — is
 * GREEN ON THE UNFIXED BASE. On `ref:main` the `favorites` param does not exist, `paramsToSearchState`
 * drops it as unknown, and the *unfiltered* search lists that asset anyway. The test would pass against
 * the very bug it exists to catch (the G-C15 neutered-test shape).
 *
 * So the stand seeds a PAIR — one starred asset and one deliberately un-starred asset that matches the
 * same query — and every case asserts BOTH that the starred one is present AND that the un-starred one is
 * ABSENT. The absence is what goes RED on base, because there the filter does nothing and both are listed.
 *
 * RED-on-`ref:main` per case: (1) the un-starred asset is present in the "filtered" list · (2) `/favorites`
 * still renders the old tab instead of redirecting · (3) the panel's "View all" goes to `/favorites` ·
 * (4) there is no Favorites control in the Filters sidebar at all, so nothing to click, preserve, or label.
 *
 * Seeding: REAL ingestion for the starred data entity (the star -> see loop must run the production write
 * path) + a direct searchable seed for the un-starred foil and the Term. Auth DISABLED (odd-minimal
 * default) -> the favorites identity is the shared sentinel, so the test seeds and asserts one bucket.
 * Collision-free band: 2148.
 */
const DS_ID = 2148;
const DS = '//e2e-it148/ds';
const E = `${DS}/tables/it148_tbl`;
const NAME = 'it148_tbl';
/** The foil: matches the same search token, and is NEVER starred. Its ABSENCE is the RED-on-base signal. */
const FOIL_ID = 21481;
const FOIL = 'it148_unstarred_foil';
/** Both names start with this, and the FTS is prefix-matched, so one query returns the pair. */
const TOKEN = 'it148';
const TERM = 'IT148FavTerm';
const FAV_DE = /\/api\/favorites\/DATA_ENTITY\/\d+(\?|$)/;
const FAV_TERM = /\/api\/favorites\/TERM\/\d+(\?|$)/;

/** The Catalog search, narrowed to favorites, for a token that matches BOTH the starred asset and the foil. */
const FAV_SEARCH = `/search?favorites=yes&q=${TOKEN}`;

async function setup(request: APIRequestContext): Promise<number> {
  await seedIngestionDataSource(DS_ID, DS, 'it148-ds');
  expect(await ingestEntities(DS, [tableEntity(E, NAME)]), 'entity ingest -> 200').toBe(200);
  const e = await entityByOddrn(E);
  expect(e, 'the dataset entity must exist').not.toBeNull();
  // The foil must be searchable by the same token but never favorited.
  await seedSearchableEntity(FOIL_ID, FOIL);
  await request.delete(`/api/favorites/DATA_ENTITY/${FOIL_ID}`);
  // Deterministic clean start: ensure the sentinel bucket has NOT favorited the subject (idempotent no-op).
  await request.delete(`/api/favorites/DATA_ENTITY/${e!.id}`);
  return e!.id;
}

const star = (page: Page) => page.locator('[data-qa="favorite-star"]');
const favColumn = (page: Page) => page.locator('[data-qa="recommended-favorites"]');
// Selected by ROLE + accessible name, not a data-qa hook: FormControlLabel associates the visible label with
// the input, so this is the same thing a user (and a screen reader) sees, and it cannot silently break if a
// styled MUI wrapper stops forwarding a custom attribute. The name is auth-mode dependent, hence the regex.
const favFilter = (page: Page) => page.getByRole('checkbox', { name: /^Favorites( \(shared\))? only$/ });
const favoriteWrite = (page: Page, method: 'PUT' | 'DELETE', path: RegExp) =>
  page.waitForResponse(r => path.test(r.url()) && r.request().method() === method && r.ok());

/** The narrowing oracle: the starred asset is listed AND the un-starred foil is not. RED on base. */
async function expectNarrowedToFavorites(page: Page, presentName: string) {
  await expect(page.getByText(presentName).first(), 'the starred asset is listed').toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText(FOIL).filter({ visible: true }),
    'THE NARROWING: an asset the caller has not starred must be absent (on ref:main it is present)'
  ).toHaveCount(0);
}

test.describe('Favorites — star -> find it again via the search filter (#1815 / #1841)', () => {
  test('star an asset -> the panel lists it and the Favorites filter narrows to it; un-star -> gone', async ({
    page,
    request,
  }) => {
    const id = await setup(request);

    // 1. The asset's detail page — the header star renders and is NOT pressed.
    await page.goto(`/dataentities/${id}/overview`);
    await expect(star(page)).toBeVisible();
    await expect(star(page)).toHaveAttribute('aria-pressed', 'false');

    // 2. Star it — the star flips to pressed.
    const put = favoriteWrite(page, 'PUT', FAV_DE);
    await star(page).click();
    await put;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');

    // 3. The home-page Favorites column lists it, labelled "(shared)" under DISABLED auth.
    await page.goto('/');
    await expect(page.getByText('Favorites (shared)')).toBeVisible();
    await expect(favColumn(page).getByRole('link', { name: NAME, exact: true })).toBeVisible();

    // 4. The Catalog search, scoped to favorites, NARROWS to it — the foil is excluded.
    await page.goto(FAV_SEARCH);
    await expectNarrowedToFavorites(page, NAME);

    // 5. Un-star it from the detail header.
    await page.goto(`/dataentities/${id}/overview`);
    await expect(star(page)).toHaveAttribute('aria-pressed', 'true');
    const del = favoriteWrite(page, 'DELETE', FAV_DE);
    await star(page).click();
    await del;
    await expect(star(page)).toHaveAttribute('aria-pressed', 'false');

    // 6. It is gone from the panel AND from the favorites-scoped search.
    await page.goto('/');
    await expect(favColumn(page).getByRole('link', { name: NAME, exact: true })).toHaveCount(0);
    await page.goto(FAV_SEARCH);
    await expect(
      page.getByText(NAME).filter({ visible: true }),
      'an un-starred asset leaves the scope (the soft-deleted favorite row must not still match)'
    ).toHaveCount(0, { timeout: 15_000 });
  });

  test('the /favorites tab is retired — the URL redirects to the pre-filtered search, never a blank page', async ({
    page,
    request,
  }) => {
    await setup(request);
    // Every bookmark and shared link to the old tab must still land somewhere useful. There is no
    // catch-all route in the app, so a bare route deletion would render the toolbar over an empty area.
    await page.goto('/favorites');
    await expect(page, 'the old tab URL redirects to the favorites-scoped search').toHaveURL(
      /\/search\?favorites=yes/,
      { timeout: 15_000 }
    );
    // And the top-level tab itself is gone from the toolbar.
    await expect(
      page.getByRole('tab', { name: 'Favorites', exact: true }),
      'no Favorites tab remains in the main navigation'
    ).toHaveCount(0);
  });

  test('the home panel "View all" lands on the search already narrowed to favorites', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    await page.goto(`/dataentities/${id}/overview`);
    const put = favoriteWrite(page, 'PUT', FAV_DE);
    await star(page).click();
    await put;

    await page.goto('/');
    await favColumn(page).getByRole('link', { name: 'View all' }).click();
    await expect(page).toHaveURL(/favorites=yes/, { timeout: 15_000 });
    await expectNarrowedToFavorites(page, NAME);

    await request.delete(`/api/favorites/DATA_ENTITY/${id}`);
  });

  test('CLICKING the filter narrows; a redux-facet toggle PRESERVES it; Clear All clears it (#1858 class)', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    await page.goto(`/dataentities/${id}/overview`);
    const put = favoriteWrite(page, 'PUT', FAV_DE);
    await star(page).click();
    await put;

    // Drive the CONTROL, not a crafted URL: this is the only case that proves the write path.
    await page.goto(`/search?q=${TOKEN}`);
    await expect(page.getByText(FOIL).first(), 'unfiltered, the foil is listed').toBeVisible({
      timeout: 15_000,
    });
    // `.click()`, NOT `.check()`. Playwright's check() clicks and then requires THE SAME element to report
    // checked — but this control navigates, so React re-mounts it and the original handle is detached. That
    // is an API mismatch, not a product defect: the run that exposed it logged "navigations have finished",
    // i.e. the click DID write the URL. The assertions below are strictly stronger than the one check()
    // makes — the URL gained the param, the re-rendered control reflects it, and the list actually narrowed.
    await favFilter(page).click();
    await expect(page).toHaveURL(/favorites=yes/, { timeout: 15_000 });
    await expect(favFilter(page), 'the re-rendered control reflects the scope it just wrote').toBeChecked();
    await expectNarrowedToFavorites(page, NAME);

    // THE #1858 REGRESSION CLASS — the actual preservation check, and the reason this case exists.
    // Search.tsx's mirror rebuilds the URL from the REDUX facet state, which carries none of the URL-only
    // params. Toggling a redux facet (Datasource is one; the favorites scope is not) re-fires that mirror.
    // If `favorites` is missing from the merge-back list, it is silently dropped right here — the filter
    // vanishes on an unrelated click, with no error. Exactly what #1858 fixed for the class filter.
    // Datasource is a SingleFilterItem -> MUI `AppSelect`, NOT the Autocomplete that MultipleFilterItem
    // (Statuses/Tag/Owner) renders. `#filter-datasources` is therefore MUI's HIDDEN native input
    // (aria-hidden, tabindex=-1) and the visible `role="combobox"` div intercepts every pointer event —
    // clicking the id selector can never succeed. Drive the visible combobox by role + accessible name,
    // the same way a user and a screen reader reach it.
    await page.getByRole('combobox', { name: /Datasource/i }).click();
    await page.getByRole('option', { name: 'it148-ds', exact: true }).click();
    await expect(
      page,
      'a redux-facet toggle must PRESERVE the favorites scope in the URL (#1858 class)'
    ).toHaveURL(/favorites=yes/, { timeout: 15_000 });
    await expectNarrowedToFavorites(page, NAME);

    // Clear All is the one control that SHOULD drop it: favorites is a filter, and a filter reset clears
    // every filter. (Query, sort and My-Objects are deliberately preserved by that reset — not filters.)
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page, 'Clear All is a filter reset — it clears the favorites scope too').toHaveURL(
      url => !url.search.includes('favorites='),
      { timeout: 15_000 }
    );

    await page.goto(FAV_SEARCH);
    await expect(favFilter(page), 'starts checked from the URL').toBeChecked();
    await favFilter(page).click();
    await expect(page, 'unchecking removes the param entirely, not favorites=no').toHaveURL(
      url => !url.search.includes('favorites='),
      { timeout: 15_000 }
    );
    await expect(favFilter(page), 'and the re-rendered control is off').not.toBeChecked();

    await request.delete(`/api/favorites/DATA_ENTITY/${id}`);
  });

  test('a starred Term is reachable through the same filter (the scope is cross-kind)', async ({
    page,
    request,
  }) => {
    await setup(request);
    await seedSearchableTerm(TERM);
    const rows = await dbQuery<{ id: number }>('SELECT id FROM term WHERE name = $1 LIMIT 1', [TERM]);
    expect(rows[0], 'the seeded term must exist').toBeTruthy();
    const termId = rows[0].id;
    await request.delete(`/api/favorites/TERM/${termId}`); // deterministic clean start

    await page.goto('/termsearch');
    await page.getByPlaceholder('Search terms...').fill(TERM);
    await page.keyboard.press('Enter');
    const row = page.getByText(TERM).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const put = favoriteWrite(page, 'PUT', FAV_TERM);
    await page.locator('[data-qa="favorite-star"]').first().click();
    await put;

    // The favorites scope is cross-kind: one filter, one list, all three asset kinds.
    await page.goto(`/search?favorites=yes&q=${TERM}`);
    await expect(page.getByText(TERM).first(), 'the starred Term is in the scope').toBeVisible({
      timeout: 15_000,
    });

    await request.delete(`/api/favorites/TERM/${termId}`);
  });

  test('under DISABLED auth the filter says (shared) and carries the consequence as inline help', async ({
    page,
    request,
  }) => {
    await setup(request);
    await page.goto(`/search?q=${TOKEN}`);
    // The label preserves the STATE; the info icon preserves the CONSEQUENCE the retired tab spelled out
    // in a banner. On ref:main there is no favorites control at all, so both are absent.
    await expect(page.getByText('Favorites (shared) only')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-qa="filter-favorites-info"]')).toBeVisible();
  });

  test('with the scope on and nothing starred, the empty state TEACHES the star', async ({
    page,
    request,
  }) => {
    const id = await setup(request);
    await request.delete(`/api/favorites/DATA_ENTITY/${id}`); // ensure the bucket is empty for this token

    await page.goto(FAV_SEARCH);
    // The retired tab's empty state taught a first-time user what the star does. A bare "No matches found"
    // would drop that teaching — the quiet way retiring a surface loses a feature.
    await expect(page.getByText('Star an asset to pin it here.')).toBeVisible({ timeout: 15_000 });
  });
});

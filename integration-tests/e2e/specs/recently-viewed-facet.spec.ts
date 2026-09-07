import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { dbQuery, seedSearchableEntity, seedSearchableTerm } from '../helpers/db';

/**
 * IT-157 — the Last-viewed (recency) scope, driven as a user (ST-10 / #1844 / CTRIB-067, ADR D3/D8/D10/D11).
 *
 * Protocol: integration-tests/protocols/IT-157-recently-viewed-facet.md
 * Gates: validates F-017 (the catalog-search promise; F-017-UC-18).
 *
 * WHY EVERY CASE ASSERTS *NARROWING*, NOT PRESENCE
 * ------------------------------------------------
 * On `ref:main` the `recently_viewed` / `viewed_after` / `viewed_before` params are unknown and
 * `paramsToSearchState` drops them, so a deep link lists the whole match set — "the opened entity is listed" is
 * GREEN on the unfixed base. Each case therefore asserts that the assets the user has NOT opened are ABSENT: that
 * is what goes RED.
 *
 * ISOLATION — READ THIS BEFORE ADDING A CASE
 * ------------------------------------------
 * Under `auth.type=DISABLED` there is exactly ONE history bucket (the `__shared__ / DISABLED` sentinel), and
 * IT-149 drives the same bucket for the Recently Viewed panel. So this spec NEVER empties it: it seeds and asserts
 * its own token's rows and uses windows to exclude, never deletion. The truly-empty-history state (the control
 * disabled with its reason) is proven in vitest, where the signal is mocked, precisely because proving it in the
 * browser would mean a global mutation that breaks a sibling spec. Case 9's single DELETE removes one of THIS
 * spec's own rows and re-records it immediately afterwards.
 *
 * GROUND TRUTH (read before assert):
 *  - Opening a detail page records the view via `POST /api/recently-viewed/{kind}/{id}`; the API is used directly
 *    here so a case's setup does not depend on the detail page rendering.
 *  - The scope rides the URL as `recently_viewed=yes` (no bounds, "any time") or as ISO-8601 `Z` instants in
 *    `viewed_after` / `viewed_before` — never both spellings at once.
 *  - `last_viewed_at` is a UTC `timestamp without time zone`; the window bounds are INCLUSIVE.
 *
 * Namespace: ids 21570-21572 · names it157rv_* · term it157rvterm · saved search prefix it157-.
 */
const TOKEN = 'it157rv';
const OPENED_ID = 21570;
const ALSO_ID = 21571;
const NEVER_ID = 21572;
const OPENED = `${TOKEN}_opened`;
const ALSO = `${TOKEN}_also`;
const NEVER = `${TOKEN}_never`;
const TERM = `${TOKEN}term`;
const SAVED_PREFIX = 'it157-';

const ANY_TIME = /recently_viewed=yes/;
const AFTER = /viewed_after=/;
const STATUS_IN_URL = /statuses(\[\]|%5B%5D)=\d+/;

/** Record an open through the real endpoint — the same signal a detail page sends. */
async function open(request: APIRequestContext, kind: string, id: number): Promise<void> {
  const res = await request.post(`/api/recently-viewed/${kind}/${id}`);
  expect(res.status(), `recording an open of ${kind}/${id} returns 204`).toBe(204);
}

/** Move one of THIS spec's own rows back in time, so a window can exclude it deterministically. */
async function backdate(kind: string, id: number, interval: string): Promise<void> {
  await dbQuery(
    `UPDATE recently_viewed SET last_viewed_at = (now() at time zone 'UTC') - $3::interval
      WHERE asset_kind = $1 AND asset_id = $2`,
    [kind, id, interval],
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
  await seedSearchableEntity(OPENED_ID, OPENED);
  await seedSearchableEntity(ALSO_ID, ALSO);
  await seedSearchableEntity(NEVER_ID, NEVER);
  await seedSearchableTerm(TERM);
  // Clean start for THIS spec's rows only — never the whole bucket (see the isolation note above).
  await dbQuery('DELETE FROM recently_viewed WHERE asset_id = ANY($1::bigint[])', [
    [OPENED_ID, ALSO_ID, NEVER_ID],
  ]);
  await open(request, 'DATA_ENTITY', OPENED_ID);
  await open(request, 'DATA_ENTITY', ALSO_ID);
  const term = await dbQuery<{ id: string }>('SELECT id FROM term WHERE name = $1 LIMIT 1', [TERM]);
  if (term[0]) await open(request, 'TERM', Number(term[0].id));
  // `also` is a week old; `opened` and the term stay at "now". A 3-day window then separates them.
  await backdate('DATA_ENTITY', ALSO_ID, '7 days');
  await deleteSavedSearchesNamed(request, SAVED_PREFIX);
}

/** The results header renders only once the asset search resolved — the honest "everything settled" signal. */
async function settled(page: Page): Promise<void> {
  // 60s, not 30s: the header is rendered under `!isLoading`, so this waits out the FIRST query on a stack that
  // has just been `compose up`-ed. Measured — the full-suite run failed here at 30s while the identical case
  // passed on a warm stack. It is a WAIT, never an oracle: every narrowing assertion is below.
  await expect(page.getByTestId('search-results-count')).toBeVisible({ timeout: 60_000 });
}

/**
 * Re-establishes the AGE SEPARATION the window cases depend on: `also` a week old, `opened` at now.
 * `setup()` cannot own this alone — case 9 re-opens `also` to prove that re-opening restores it, which upserts
 * `last_viewed_at` to now and silently widens every later "Today" window to include it. A fixture one case
 * mutates is a fixture every later case must re-assert, not inherit.
 */
async function separateAges(): Promise<void> {
  await backdate('DATA_ENTITY', ALSO_ID, '7 days');
}

/** The SPA shell failed to boot because a lazily-imported route chunk never arrived. */
const CHUNK_BOOT_FAILURE = /dynamically imported module/;

/**
 * Navigate, then wait for the results header — recovering ONE measured environment failure on the way.
 *
 * Chromium aborts in-flight downloads with `net::ERR_NETWORK_CHANGED` when the HOST's network configuration
 * changes (Docker creating and tearing down bridge networks does exactly that, and this suite brings stacks up
 * beside itself). When that hits one of the SPA's code-split chunks, React Router's lazy import rejects with
 * "Failed to fetch dynamically imported module" and — odd-platform-ui ships no error boundary — the page renders
 * BLANK, so every locator on it is simply absent. Read out of the failing run's trace (`pageError` +
 * `ERR_NETWORK_CHANGED` on `assets/Search-*.js`), not guessed from the symptom.
 *
 * A reload re-requests the chunk and the app boots. This is a retry of the NAVIGATION, never of an assertion:
 * every narrowing oracle below still runs exactly once, against a page that actually rendered, and the suite's
 * `retries: 0` stays as it is — a regression pin must never be masked by a retry.
 */
async function gotoSearch(page: Page, url: string): Promise<void> {
  let bootFailed = false;
  const watch = (e: Error) => {
    if (CHUNK_BOOT_FAILURE.test(e.message)) bootFailed = true;
  };
  page.on('pageerror', watch);
  try {
    await page.goto(url);
    let deadline = Date.now() + 60_000;
    for (;;) {
      if (await page.getByTestId('search-results-count').isVisible().catch(() => false)) return;
      if (bootFailed) {
        bootFailed = false;
        await page.reload();
        deadline = Date.now() + 60_000; // the reload gets its own full budget
        continue;
      }
      if (Date.now() > deadline) break;
      await page.waitForTimeout(250);
    }
    await settled(page); // out of budget with no boot failure: fail with the standard, attributable message
  } finally {
    page.off('pageerror', watch);
  }
}

/** The narrowing oracle: `present` are listed, `absent` are not. RED on base for the absent half. */
async function expectListed(page: Page, present: string[], absent: string[]): Promise<void> {
  for (const name of present) {
    await expect(page.getByText(name, { exact: true }).first(), `${name} is listed`).toBeVisible({ timeout: 15_000 });
  }
  for (const name of absent) {
    await expect(
      page.getByText(name, { exact: true }).filter({ visible: true }),
      `THE NARROWING: ${name} must be absent (on ref:main it is listed — the scope is dropped there)`,
    ).toHaveCount(0);
  }
}

const control = (page: Page) => page.locator('[data-qa="filter-recently_viewed"]');
/**
 * The Sort-by control. `getByRole('combobox')` matches TEN elements on this page (every facet autocomplete, the
 * search box, and this) — observed in a strict-mode violation, not guessed. The sort select is the one labelled
 * by `search-sort-label`, which is the control's own stable hook.
 */
const sortControl = (page: Page) => page.locator('[aria-labelledby="search-sort-label"]');
const chip = (page: Page) => page.locator('[data-qa="filter-recently_viewed-chip"]');

/**
 * The home page's equivalent of {@link gotoSearch}: same one-reload recovery of a chunk boot failure, waiting on
 * the Recently Viewed panel instead of the search-results header.
 */
async function gotoHome(page: Page): Promise<void> {
  const panel = page.locator('[data-qa="recently-viewed-view-all"]');
  let bootFailed = false;
  const watch = (e: Error) => {
    if (CHUNK_BOOT_FAILURE.test(e.message)) bootFailed = true;
  };
  page.on('pageerror', watch);
  try {
    await page.goto('/');
    let deadline = Date.now() + 60_000;
    for (;;) {
      if (await panel.isVisible().catch(() => false)) return;
      if (bootFailed) {
        bootFailed = false;
        await page.reload();
        deadline = Date.now() + 60_000;
        continue;
      }
      if (Date.now() > deadline) break;
      await page.waitForTimeout(250);
    }
    await expect(panel, 'the home page rendered its Recently Viewed panel').toBeVisible({ timeout: 60_000 });
  } finally {
    page.off('pageerror', watch);
  }
}

test.describe('Last viewed scope — narrows to my history, orders it, survives, saves, and the panel links in (#1844)', () => {
  test.beforeAll(async ({ request, browser }) => {
    test.setTimeout(180_000);
    await setup(request);
    // warm-up: absorb the platform's cold start outside any case's budget (TST-057)
    const page = await browser.newPage();
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await page.close();
  });

  test.afterAll(async ({ request }) => {
    await deleteSavedSearchesNamed(request, SAVED_PREFIX);
    await dbQuery('DELETE FROM recently_viewed WHERE asset_id = ANY($1::bigint[])', [
      [OPENED_ID, ALSO_ID, NEVER_ID],
    ]);
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [OPENED_ID, ALSO_ID, NEVER_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [[OPENED_ID, ALSO_ID, NEVER_ID]]);
  });

  test('1 — the scope narrows to what I opened, and searching never records a view', async ({ page }) => {
    test.setTimeout(180_000);
    // R13: the read path must never write. A search that recorded views would inflate every user's own history.
    // The RECORD endpoint is POST /api/recently-viewed/{ASSET_KIND}/{id}. `POST /api/recently-viewed/status` is a
    // batch READ (which of these assets are in my history — it draws the row markers) that happens to use POST for
    // its body; counting it would make this oracle fire on a read. Observed on the running stack, not assumed.
    // OBSERVE, never intercept: `page.route` + `route.continue()` re-issues every matching request through the
    // Playwright server, and on this page that reproducibly left the SPA unrendered (a blank page, measured — the
    // results header never mounted inside 60s). A `page.on('request')` listener is passive by construction, so the
    // oracle cannot perturb the very load it is judging.
    const recorded: string[] = [];
    page.on('request', req => {
      const path = new URL(req.url()).pathname;
      if (req.method() === 'POST' && /^\/api\/recently-viewed\/[A-Z_]+\/\d+$/.test(path)) {
        recorded.push(path);
      }
    });

    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, [OPENED, ALSO, NEVER, TERM], []);

    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expect(chip(page)).toHaveText('Last viewed: any time');
    await expectListed(page, [OPENED, ALSO, TERM], [NEVER]);
    expect(recorded, 'searching must NEVER record a view — the read path does not write').toEqual([]);
  });

  test('2 — the scope is cross-kind and the qualifier says whose views these are', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    // Unlike Popularity there is no "data entities only" exclusion: an unopened TERM is absent because it was not
    // opened, while an opened one is listed.
    await expectListed(page, [TERM], [NEVER]);
    // The qualifier states WHOSE views these are — the thing "Last viewed" alone does not say. Which of the two
    // wordings appears depends on the deployment's auth posture, and THAT is case 11's assertion, not this one.
    await expect(
      control(page).getByText(/Assets (you have|anyone has) opened/),
      'the facet says whose history it is scoping to',
    ).toBeVisible();
  });

  test('3 — a preset narrows by WHEN, and the chip names the resolved date', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED, ALSO], []);

    await control(page).getByRole('button', { name: 'Today' }).click();
    await expect(page, 'the preset resolves to a concrete instant in the URL').toHaveURL(AFTER, { timeout: 15_000 });
    await expect(page, 'and the bounds-free token is gone — one spelling per state').not.toHaveURL(ANY_TIME);
    await settled(page);
    // `also` was opened a week ago; `opened` today. The chip shows the RESOLVED date, never the preset's name.
    await expect(chip(page)).toContainText('Last viewed: since');
    await expectListed(page, [OPENED], [ALSO, NEVER]);
  });

  test('4 — the scope SURVIVES a sidebar facet toggle (the #1858 mirror-merge class)', async ({ page }) => {
    test.setTimeout(180_000);
    await dbQuery('UPDATE data_entity SET status = 3 WHERE id = $1', [OPENED_ID]); // STABLE
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED, ALSO], [NEVER]);

    // The Statuses facet is a controlled-open autocomplete: type the FULL value (the IT-152 idiom).
    const statuses = page.locator('#filter-statuses');
    await statuses.click();
    await statuses.pressSequentially('STABLE', { delay: 40 });
    const stable = page.getByRole('option', { name: 'STABLE' });
    await expect(stable, 'the Statuses dropdown offered STABLE').toBeVisible({ timeout: 30_000 });
    await stable.click();

    await expect(page, 'the toggled facet reaches the URL').toHaveURL(STATUS_IN_URL, { timeout: 15_000 });
    await expect(page, 'and the scope is STILL there — not dropped by the mirror').toHaveURL(ANY_TIME);
    await page.waitForTimeout(1_500); // more than the 400 ms mirror debounce — no late write drops it
    await expect(page, 'no late mirror write drops the scope').toHaveURL(ANY_TIME);
    await settled(page);
    await expectListed(page, [OPENED], [NEVER, ALSO]);
    await dbQuery('UPDATE data_entity SET status = 1 WHERE id = $1', [OPENED_ID]);
  });

  test('5 — Clear All removes the scope AND its ordering (after it demonstrably narrowed)', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes&sort=last_viewed`);
    await expectListed(page, [OPENED], [NEVER]);
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page, 'the scope is gone').not.toHaveURL(/recently_viewed|viewed_after|viewed_before/, {
      timeout: 15_000,
    });
    await expect(page, 'and so is the ordering it made meaningful — no sort the list does not have').not.toHaveURL(
      /sort=last_viewed/,
    );
    await settled(page);
    await expectListed(page, [OPENED, ALSO, NEVER, TERM], []);
  });

  test('6 — a saved search stores the scope and reapplies it (the LSN-042 class, eleventh dimension)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED, ALSO], [NEVER]);

    await page.getByRole('button', { name: 'Save current search' }).click();
    await page.getByPlaceholder('Enter search name').fill(`${SAVED_PREFIX}anytime`);
    const created = page.waitForResponse(
      r => /\/api\/saved_searches$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST' && r.status() === 201,
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const spec = ((await (await created).json()) as { spec: Record<string, unknown> }).spec;
    // PRESENCE is the switch. The wire shape observed on the running stack is `{viewed_after: null,
    // viewed_before: null}` — Jackson writes the unset bounds explicitly — so the oracle is "the key is there and
    // no bound is set", NOT a literal `{}`. Reading it as an absence is the LSN-042 failure this case exists for:
    // a saved search that reports success and reapplies unnarrowed.
    const stored = spec.recently_viewed as Record<string, unknown> | undefined;
    expect(stored, 'the stored spec carries the scope — "any time" is a REAL state, not an absence').toBeDefined();
    expect(
      Object.values(stored ?? {}).filter(v => v !== null && v !== undefined),
      'and it carries no bounds — that is what "any time" means',
    ).toEqual([]);

    // Reload UNFILTERED — the never-opened entity is back — then reapply.
    await gotoSearch(page, `/search?q=${TOKEN}`);
    await expectListed(page, [NEVER], []);
    await page.getByRole('button', { name: 'Saved searches' }).click();
    await page.getByText(`${SAVED_PREFIX}anytime`, { exact: true }).click();
    await expect(page, 'reapply rebuilt the scope into the URL').toHaveURL(ANY_TIME, { timeout: 15_000 });
    await settled(page);
    await expectListed(page, [OPENED, ALSO], [NEVER]);
  });

  test('7 — with the scope on, the list reads newest-first and the sort menu says so', async ({ page }) => {
    test.setTimeout(180_000);
    await separateAges();

    // The BROWSE default. A text query still wins with relevance on BOTH sides of the wire (SearchSortDto
    // .resolveEffective and defaultSortForContext agree), so the default only becomes "Recently viewed" where
    // there is no query — asserted here rather than assumed, because the run proved the q= URL reads "Relevance".
    await gotoSearch(page, '/search?recently_viewed=yes');
    await expect(sortControl(page), 'the scope makes Recently viewed the browse default').toContainText(
      'Recently viewed',
    );

    // The ORDER the list actually has. `opened` was viewed today, `also` a week ago.
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes&sort=last_viewed`);
    await expect(sortControl(page), 'and the control states the ordering that was applied').toContainText(
      'Recently viewed',
    );
    const rows = page.getByText(new RegExp(`^${TOKEN}_(opened|also)$`));
    await expect(rows.first()).toHaveText(OPENED);
  });

  test('8 — the home panel View all opens exactly that list', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoHome(page);
    const viewAll = page.locator('[data-qa="recently-viewed-view-all"]');
    await expect(viewAll, 'the Recently Viewed panel now leads somewhere (#1832)').toBeVisible({ timeout: 60_000 });
    await expect(viewAll).toHaveAttribute('href', '/search?recently_viewed=yes&sort=last_viewed');

    await viewAll.click();
    await settled(page);
    await expect(page).toHaveURL(ANY_TIME);
    // The tile, continued: my history, newest first, and nothing I have not opened.
    await expectListed(page, [OPENED], [NEVER]);
  });

  test('9 — removing an entry drops it from the scoped list, and re-opening restores it', async ({ page, request }) => {
    test.setTimeout(180_000);
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED, ALSO], [NEVER]);

    // The only DELETE in this spec, and it touches one of THIS spec's own rows (see the isolation note).
    const removed = await request.delete(`/api/recently-viewed/DATA_ENTITY/${ALSO_ID}`);
    expect(removed.status()).toBe(204);
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED], [ALSO, NEVER]);

    // Restore it for any later case / re-run, and prove re-opening genuinely re-adds it.
    await open(request, 'DATA_ENTITY', ALSO_ID);
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await expectListed(page, [OPENED, ALSO], [NEVER]);
  });

  test('10 — a shared link resolves to the RECIPIENT\'s history, and junk bounds never filter', async ({ page }) => {
    test.setTimeout(180_000);
    // The URL carries instants only — no identity — so the same link run by anyone resolves against THEIR history.
    // Under DISABLED auth that is the one shared bucket, which is what the "(shared)" label discloses.
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    expect(page.url(), 'no username or asset id is ever put in the URL').not.toMatch(/user|oidc|asset_id/);

    // Junk fails CLOSED: no chip, no narrowing — never an error page, never a partial filter.
    await gotoSearch(page, `/search?q=${TOKEN}&viewed_after=not-a-date`);
    await expect(chip(page)).toHaveCount(0);
    await expectListed(page, [OPENED, ALSO, NEVER, TERM], []);

    // A bare date is zone-ambiguous and is rejected the same way, rather than guessed into a timezone.
    await gotoSearch(page, `/search?q=${TOKEN}&viewed_after=2026-09-01`);
    await expect(chip(page)).toHaveCount(0);
    await expectListed(page, [NEVER], []);
  });

  test('12 — the same link returns the same rows in another timezone (the boundary is an instant, not a day)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    // The maintainer's own note: "a 'viewed since yesterday' filter that's off by a timezone reads as broken".
    // The URL carries INSTANTS, so a recipient fourteen hours ahead must get the SAME assets — only the dates
    // they read on the chip may differ. Anything else means the boundary was serialised as a bare day somewhere.
    await separateAges(); // case 9 re-opened `also`; without this its row is inside today's window
    await gotoSearch(page, `/search?q=${TOKEN}&recently_viewed=yes`);
    await control(page).getByRole('button', { name: 'Today' }).click();
    await expect(page).toHaveURL(AFTER, { timeout: 15_000 });
    await settled(page);
    await expectListed(page, [OPENED], [ALSO, NEVER]);
    const sharedUrl = page.url();

    const far = await browser.newContext({ timezoneId: 'Pacific/Kiritimati' });
    try {
      const theirPage = await far.newPage();
      await gotoSearch(theirPage, sharedUrl);
      await expectListed(theirPage, [OPENED], [ALSO, NEVER]);
      await expect(
        theirPage.locator('[data-qa="filter-recently_viewed-chip"]'),
        'the recipient still sees a resolved date, rendered in THEIR zone',
      ).toContainText('Last viewed: since');
    } finally {
      await far.close();
    }
  });

  test('11 — under DISABLED auth the control says the history is shared', async ({ page }) => {
    await gotoSearch(page, `/search?q=${TOKEN}`);
    // The odd-minimal stack runs AUTH_TYPE=DISABLED, so there is one instance-wide bucket. The filter WORKS here
    // (returning empty would contradict the panel it links from) and the label + inline help disclose it.
    await expect(control(page).getByText('Last viewed (shared)')).toBeVisible({ timeout: 30_000 });
    await expect(control(page).getByText('Assets anyone has opened')).toBeVisible();
    await expect(page.locator('[data-qa="filter-recently_viewed-info"]')).toBeVisible();
  });
});

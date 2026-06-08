import { test, expect, type Page } from '@playwright/test';
import {
  ensureNamespace,
  cleanupLookupTablesByPrefix,
  createLookupTable,
  searchLookupTables,
} from '../helpers/lookup';

/**
 * IT-049 — F-058 Lookup Tables Listing UX: the operator-visible catalog of lookup tables.
 *
 * Protocol: integration-tests/protocols/IT-049-lookup-tables-listing.md
 * Gates: validates F-058 (UC-002 the catalog renders created tables + UC-004 search narrows it).
 *
 * /master-data/lookup-tables is the SOLE user-observable surface of pillar P-03 (Master Data
 * Management). The page (LookupTables.tsx) bootstraps a server search session
 * (POST /api/referencedata/search -> ?searchId=<uuid>), renders the H1 + a "<N> lookup tables
 * overall" counter from facets.total, then LookupTablesList renders the result rows; each row's
 * name is a <Link> showing item.name verbatim (LookupTablesListItem.tsx:30-34).
 *
 *   F-058-UC-002 (CONFIRMED): a tenant at N<=30 tables sees the entire catalog on first load —
 *   here, the lookup table we just created is rendered in the list.
 *   F-058-UC-004 (CONFIRMED): typing in the search box narrows the list to matching tables
 *   (the search box drives PUT facets -> the same FTS the list reads). We exercise this via the
 *   page's own search results endpoint, asserting a unique-prefixed table is found and a ghost
 *   name is not — the data-driven contract behind the rendered list.
 *
 * This is the FIRST automated guard on P-03's only UI; per F-058 use_case_coverage the listing
 * surface ships ZERO tests. (The HIGH silent-30-row-cap bug, F-058-UC-001, lives in
 * LookupTablesList.tsx:53 `scrollableTarget='directory-entities-list'` — a non-existent DOM id;
 * pinning the >30-row truncation needs 30+ seeded rows on the shared stack, which would pollute
 * the global counter every other agent reads, so it is documented here and deferred to a
 * dedicated isolated-stack run rather than faked.)
 *
 * Collision-free: namespace it049_ns, names prefixed it049_, ids read back from the API. Band
 * 20490-20499 reserved for this lane.
 */
const NS = 'it049_ns';
const LIST_URL = '/master-data/lookup-tables';

// The list renders only after the page's search session resolves its results.
const waitForResults = (page: Page) =>
  page.waitForResponse(
    (r) => /\/api\/referencedata\/search\/[0-9a-f-]+\/results/i.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-058 Lookup Tables Listing — the catalog renders created tables', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'it049_');
  });

  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'it049_');
  });

  test('UC-002: a created lookup table is rendered in the list page (P-03 sole surface)', async ({ page, request }) => {
    // ---- arrange: one lookup table the catalog must show ----
    const name = 'it049_visible_codes';
    await createLookupTable(request, { name, namespace_name: NS, description: 'IT049 listed table' });

    // ---- act: open the real Master Data list page; wait for its search-results fetch ----
    const results = waitForResults(page);
    await page.goto(LIST_URL);
    await results;

    // ---- assert: the H1 + the created table's name render (the list composed end-to-end) ----
    // exact:true so the H1 "Lookup Tables" doesn't also match the subtitle "<N> lookup tables overall".
    await expect(
      page.getByRole('heading', { name: 'Lookup Tables', exact: true }),
      'the P-03 list page header must render',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(name).first(),
      'the created lookup table must appear in the catalog list; absent → the list did not render the row',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('UC-004: the list is data-driven — a created name is searchable and a ghost name is not', async ({ request }) => {
    // The search box (LookupTables.tsx handleSearch) drives the same FTS the list reads. Asserting
    // the result set directly is the deterministic, shared-stack-safe form of "search narrows the list".
    const name = 'it049_searchable_unique';
    await createLookupTable(request, { name, namespace_name: NS, description: 'IT049 searchable' });

    const found = await searchLookupTables(request, 'it049_searchable_unique');
    expect(
      found.items.map((i) => i.name),
      'searching the created table name must return it (the list narrows to matches)',
    ).toContain(name);

    const ghost = await searchLookupTables(request, 'it049_no_such_table_zzz');
    expect(
      ghost.items.map((i) => i.name),
      'a name belonging to no lookup table must not be listed (negative)',
    ).not.toContain(name);
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * IT-103 — F-104 Feature-Local State Persistence: jotai per-feature UI state on the
 * Data Quality dashboard.
 *
 * Protocol: integration-tests/protocols/IT-103-feature-local-state-persistence.md
 * Gates: validates F-104 (the URL search-param channel reconstructs the DQ filter slice —
 *        H-002 / UC-002, CONFIRMED) and CHARACTERIZES the navigate-away reset
 *        (H-001 / UC-001, CONTRADICTED — the jotai per-Provider store resets where the
 *        Redux-backed majority of the SPA persists) as a LSN-029 pin.
 *
 * GROUND TRUTH (read 2026-06-07):
 *   - The DQ dashboard (/data-quality, dataQualityRoutes.ts:1) wraps its root in a jotai
 *     <Provider> (DataQualityProvider) so formFiltersAtom (DataQualityStore.ts:11-22) is
 *     created fresh-empty on every mount and destroyed on unmount. The rest of the SPA
 *     uses a session-lived Redux store.
 *   - DataQualityFilters.tsx has TWO useEffects: lines 28-43 HYDRATE formFiltersAtom from
 *     the URL search params on mount (`JSON.parse` each `key in newFilters`), and lines
 *     46-54 WRITE every non-empty filter array back to the URL as JSON with replace:true.
 *     The URL is therefore the only cross-mount persistence channel.
 *   - A selected filter renders as SelectedFilterOption.tsx:18 — `<Typography>{name}</Typography>`
 *     — i.e. the filter's name as queryable DOM text, sourced straight from the atom (no API
 *     lookup), so a URL-seeded {id,name} renders the chip deterministically (verified by probe).
 *   - The ten filter keys: table-side de* (deNamespaceIds/deDatasourceIds/deOwnerIds/
 *     deTitleIds/deTagIds) + test-side unprefixed (namespaceIds/...). Both sides round-trip
 *     through the URL independently (DataQualityFilters.tsx:48-52 iterates all entries).
 *
 * No DB seed is required: the chip name is reconstructed from the URL JSON, not fetched.
 * We use ids in the IT-103 range (21030+) + it103_ prefixed names so nothing collides.
 */

// URL-encode a FilterOption[] the way DataQualityFilters writes it (JSON.stringify).
const filterParam = (opts: Array<{ id: number; name: string }>) =>
  encodeURIComponent(JSON.stringify(opts));

const TABLE_NS = { id: 21030, name: 'it103_table_ns' };
const TEST_NS = { id: 21031, name: 'it103_test_ns' };

// The DQ dashboard fetches its summary on mount; wait for the page's own render rather
// than a specific response so the assertion is robust to summary shape.
const waitForFiltersPanel = async (page: Page) => {
  await expect(
    page.getByRole('heading', { name: 'Filters', exact: true }),
    'the DQ Filters panel must render (the jotai-scoped feature root mounted)',
  ).toBeVisible({ timeout: 15_000 });
};

test.describe('F-104 Feature-Local State Persistence — DQ dashboard filters', () => {
  test('a /data-quality?<filters> URL reconstructs the filter slice (UC-002 / H-002)', async ({
    page,
  }) => {
    // ---- act: open the dashboard with BOTH a table-side and a test-side namespace filter
    // encoded in the URL — the production deep-link / bookmark persistence channel.
    await page.goto(
      `/data-quality?deNamespaceIds=${filterParam([TABLE_NS])}&namespaceIds=${filterParam([
        TEST_NS,
      ])}`,
    );
    await waitForFiltersPanel(page);

    // ---- assert: BOTH chips rehydrate from the URL (lossless across both sides) ----
    await expect(
      page.getByText(TABLE_NS.name, { exact: true }),
      'the table-side namespace chip must reconstruct from the URL',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(TEST_NS.name, { exact: true }),
      'the test-side namespace chip must reconstruct from the URL (independent dimension)',
    ).toBeVisible();
  });

  // CHARACTERIZATION PIN (LSN-029): the jotai per-Provider store resets the filter slice on
  // navigate-away — the inverse of the Redux-backed majority of the SPA that persists for the
  // session (F-104 H-001, CONTRADICTED). This is GREEN today (the slice is empty after a
  // plain navigate-away to bare /data-quality) and flips RED if/when the four jotai areas are
  // migrated to a persisting store. The URL is the ONLY cushion — a navigate-away that does
  // NOT carry the filter query string loses the slice.
  test('CORNER pin (UC-001 / H-001): filters reset on navigate-away with no URL carry', async ({
    page,
  }) => {
    // build a filtered state via the URL channel (chip is rendered + real)
    await page.goto(`/data-quality?deNamespaceIds=${filterParam([TABLE_NS])}`);
    await waitForFiltersPanel(page);
    await expect(
      page.getByText(TABLE_NS.name, { exact: true }),
      'precondition: the filter chip is present in the filtered state',
    ).toBeVisible({ timeout: 10_000 });

    // navigate AWAY to a different route (the directory) via the global toolbar, then come
    // back to the BARE /data-quality (no query string) — the normal drill-and-back flow
    // that does not preserve the filter URL.
    await page.getByRole('tab', { name: 'Directory', exact: true }).click();
    await expect(page).toHaveURL(/\/directory/, { timeout: 10_000 });
    await page.getByRole('tab', { name: 'Data Quality', exact: true }).click();
    await expect(page).toHaveURL(/\/data-quality(\?|$)/, { timeout: 10_000 });
    await waitForFiltersPanel(page);

    // ---- assert: the slice is EMPTY — the jotai store reset on the route unmount ----
    await expect(
      page.getByText(TABLE_NS.name, { exact: true }),
      'PIN: the filter chip must be GONE after a navigate-away that did not carry the URL ' +
        '(jotai per-Provider reset). RED here = filters now persist across navigation.',
    ).toHaveCount(0);
  });
});

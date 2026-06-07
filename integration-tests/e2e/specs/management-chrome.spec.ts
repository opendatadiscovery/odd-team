import { test, expect, type Page } from '@playwright/test';

/**
 * IT-104 — F-161 Management section top-level chrome: the tab strip + sub-nav shell.
 *
 * Protocol: integration-tests/protocols/IT-104-management-chrome.md
 * Gates: validates F-161 (the Management chrome renders its sidebar tab strip and a
 *        sub-area is reachable — H-005 default-redirect + H-006 tab navigation, both
 *        CONFIRMED) and CHARACTERIZES the admin-surface recon posture (H-001 — every admin
 *        tab label is advertised to the viewer) as a current-behaviour pin.
 *
 * GROUND TRUTH (read + DOM-probed 2026-06-07):
 *   - Management.tsx:8-22 mounts at /management/* : a fixed 3/9 grid with ManagementTabs
 *     (left sidebar) + ManagementRoutes (content pane), inside one outer
 *     WithPermissionsProvider seeded with OWNER_ASSOCIATION_MANAGE.
 *   - ManagementTabs.tsx:19-50 renders 9 vertical AppTabs (role="tab"): Namespaces,
 *     Datasources, Integrations, Collectors, Owners, Tags, Associations (hidden iff the
 *     viewer lacks OWNER_ASSOCIATION_MANAGE), Roles, Policies. These nine names are
 *     DISTINCT from the global toolbar tabs (Catalog/Directory/.../Activity) also on the
 *     page, so each management tab name is an unambiguous role=tab locator.
 *   - ManagementRoutes.tsx:151 — bare /management redirects (<Navigate to='namespaces'
 *     replace />) to /management/namespaces; the Namespaces sub-route mounts in the pane.
 *   - DOM probe on the running DISABLED stack: bare /management -> /management/namespaces;
 *     ALL nine sidebar tabs render (Associations VISIBLE — the dummy principal resolves
 *     OWNER_ASSOCIATION_MANAGE as granted under DISABLED). The recon posture (every admin
 *     surface advertised) is therefore the observed default and matches the live
 *     /features/management doc (F-161 H-008).
 */

// The nine management sidebar tab labels are unique on the page (toolbar uses other names).
const mgmtTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

test.describe('F-161 Management section chrome — tab strip + sub-nav', () => {
  test('bare /management redirects to Namespaces and renders the sidebar tab strip (H-005)', async ({
    page,
  }) => {
    await page.goto('/management');

    // ---- assert: the default redirect lands the operator on the Namespaces sub-area ----
    await expect(page, 'bare /management must redirect to the Namespaces sub-area').toHaveURL(
      /\/management\/namespaces/,
      { timeout: 15_000 },
    );

    // ---- assert: the sidebar tab strip renders its tabs ----
    for (const name of ['Namespaces', 'Datasources', 'Owners', 'Tags', 'Roles', 'Policies']) {
      await expect(
        mgmtTab(page, name),
        `the Management sidebar must render the ${name} tab`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // ---- assert: the default sub-area is the SELECTED tab (content pane coupled to it) ----
    await expect(
      mgmtTab(page, 'Namespaces'),
      'the Namespaces tab must be selected after the default redirect (the sub-area is mounted)',
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking a sidebar tab navigates to that sub-area and swaps the pane (H-006)', async ({
    page,
  }) => {
    await page.goto('/management');
    await expect(page).toHaveURL(/\/management\/namespaces/, { timeout: 15_000 });
    await expect(mgmtTab(page, 'Owners')).toBeVisible({ timeout: 10_000 });

    // click the Owners sidebar tab — the sub-nav must route + swap the content pane
    await mgmtTab(page, 'Owners').click();

    await expect(page, 'clicking Owners must navigate to the Owners sub-area URL').toHaveURL(
      /\/management\/owners/,
      { timeout: 10_000 },
    );
    await expect(
      mgmtTab(page, 'Owners'),
      'the Owners tab must become the selected tab (content pane swapped to it)',
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      mgmtTab(page, 'Namespaces'),
      'the previously-selected Namespaces tab must no longer be selected',
    ).not.toHaveAttribute('aria-selected', 'true');
  });

  // CHARACTERIZATION PIN (H-001): the Management sidebar advertises the EXISTENCE of every
  // admin surface to the viewer — the privileged Roles + Policies admin tabs are rendered
  // as reachable labels. On the DISABLED stack all nine tabs (incl. Associations) are
  // visible. This pins the read-collaborative / recon posture (matches the live
  // /features/management doc, F-161 H-008); RED here = the chrome stopped advertising an
  // admin surface label (a visibility-model change worth noticing).
  test('CORNER pin (H-001): the sidebar advertises the admin-surface catalog', async ({
    page,
  }) => {
    await page.goto('/management');
    await expect(page).toHaveURL(/\/management\/namespaces/, { timeout: 15_000 });

    // the privileged admin surfaces are advertised as reachable tabs to the viewer
    await expect(
      mgmtTab(page, 'Policies'),
      'PIN: the Policies admin tab is advertised in the sidebar (recon posture)',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      mgmtTab(page, 'Roles'),
      'PIN: the Roles admin tab is advertised in the sidebar (recon posture)',
    ).toBeVisible();
    await expect(
      mgmtTab(page, 'Associations'),
      'PIN: on the DISABLED stack the principal resolves OWNER_ASSOCIATION_MANAGE, so even ' +
        'the conditionally-hidden Associations tab is advertised. RED = the hide gate changed.',
    ).toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * IT-101 — F-041 Application Toolbar: the single global navigation chrome.
 *
 * Protocol: integration-tests/protocols/IT-101-application-toolbar.md
 * Gates: validates F-041 (the persistent top-of-viewport chrome renders its parts
 *        and persists across routes — UC-1, UC-12) + characterizes UC-2 (DISABLED-mode
 *        identity label) as a LSN-029 pin.
 *
 * GROUND TRUTH (read 2026-06-07):
 *   - AppToolbar.tsx:56 is mounted EXACTLY ONCE in App.tsx above <Routes> — one global
 *     chrome above every route. It composes: a brand block (AppToolbar.tsx:54-60 — a
 *     react-router <Link to='/'> wrapping the logo + a Typography h4 reading "Platform"),
 *     the 9-tab primary nav (ToolbarTabs.tsx:34-82 — Catalog / Directory / Data Quality /
 *     Data Modelling / Master Data / Management / Dictionary / Alerts / Activity, each an
 *     AppLinkTab = MUI Tab rendered as a react-router Link, so each is an <a> with an href),
 *     the App Info menu (AppInfoMenu), and the user cluster (AppToolbar.tsx:74 —
 *     <S.UserName>{owner?.name ?? identity?.username}</S.UserName>).
 *   - Tab labels render as plain text (AppTabLabel.tsx:37 `{name}`).
 *   - Under auth.type=DISABLED (the running stack), IdentityController returns a dummyOwner
 *     with username='admin' and ownership is null, so the user cluster renders the literal
 *     "admin" (F-041-UC-2 contradicted — feature-flows/detail/F-041.yaml).
 */

// The toolbar fires GET /api/identity/whoami on mount (App.tsx:48 fetchIdentity); waiting
// for it (react-query/redux) before asserting the user cluster avoids an empty-label race.
const whoami = (page: Page) =>
  page.waitForResponse(
    r => r.url().includes('/api/identity/whoami') && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-041 Application Toolbar — global navigation chrome', () => {
  test('the toolbar renders brand + primary nav + user cluster on a route (UC-1)', async ({
    page,
  }) => {
    const id = whoami(page);
    // open a concrete route (the directory) — the toolbar is route-independent chrome
    await page.goto('/directory');
    await id;

    // ---- assert: brand block ---- the "Platform" h4 inside the logo Link to '/'
    await expect(
      page.getByRole('link', { name: /Platform/ }).first(),
      'the brand block (logo + "Platform", linked to /) must render',
    ).toBeVisible({ timeout: 10_000 });

    // ---- assert: primary navigation tabs render ----
    // The 9 tabs are MUI Tabs rendered as react-router Links: ARIA role is `tab`, and
    // because each is an <a>, the destination is on its href. Catalog -> /search ;
    // Management -> /management ; Directory -> /directory.
    const catalog = page.getByRole('tab', { name: 'Catalog' });
    await expect(catalog, 'the Catalog primary-nav tab must render').toBeVisible();
    await expect(catalog, 'Catalog must link to the /search surface').toHaveAttribute(
      'href',
      /\/search/,
    );
    await expect(
      page.getByRole('tab', { name: 'Management' }),
      'the Management primary-nav tab must render',
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Directory', exact: true }),
      'the Directory primary-nav tab must render',
    ).toBeVisible();

    // ---- assert: the user / profile cluster renders an identity label ----
    // Under DISABLED the engine returns username='admin'; the cluster is non-empty.
    await expect(
      page.getByText('admin', { exact: true }).first(),
      'the user cluster must render the identity label (admin under DISABLED auth)',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the toolbar persists across navigation — single global chrome (UC-12)', async ({
    page,
  }) => {
    await page.goto('/directory');
    // brand present on route 1
    await expect(page.getByRole('link', { name: /Platform/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    const catalogHref1 = await page
      .getByRole('tab', { name: 'Catalog' })
      .getAttribute('href');

    // navigate to a SECOND route by clicking the Management tab (in-app SPA nav, no reload)
    await page.getByRole('tab', { name: 'Management' }).click();
    await expect(page).toHaveURL(/\/management/, { timeout: 10_000 });

    // the SAME chrome is still mounted on route 2 (not re-created per route)
    await expect(
      page.getByRole('link', { name: /Platform/ }).first(),
      'the brand block must persist on the second route (one global chrome)',
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Catalog' }),
      'the primary-nav tabs must persist on the second route',
    ).toBeVisible();
    const catalogHref2 = await page
      .getByRole('tab', { name: 'Catalog' })
      .getAttribute('href');
    expect(catalogHref1, 'Catalog tab is the same chrome element across routes').not.toBeNull();
    expect(catalogHref2).toContain('/search');
  });

  // KNOWN BUG (PLT-needed): under auth.type=DISABLED the toolbar presents an anonymous
  // caller as the literal "admin" with no DISABLED-mode warning banner (F-041-UC-2,
  // contradicted; AppToolbar.tsx:74 + IdentityController dummyOwner). This is a GREEN
  // characterization pin (LSN-029): it asserts the CURRENT behaviour and flips RED the
  // day the identity render gains a real viewer / a DISABLED-mode signal.
  test('CORNER pin (UC-2): DISABLED-mode user cluster shows the literal "admin"', async ({
    page,
  }) => {
    const id = whoami(page);
    await page.goto('/directory');
    await id;

    await expect(
      page.getByText('admin', { exact: true }).first(),
      'PIN: under DISABLED the toolbar renders the synthetic dummyOwner username "admin" ' +
        '(no anonymous-viewer signal). RED here = the DISABLED-mode identity render changed.',
    ).toBeVisible({ timeout: 10_000 });
  });
});

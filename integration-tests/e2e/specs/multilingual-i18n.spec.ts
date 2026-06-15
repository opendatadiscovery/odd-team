import { test, expect, type Page } from '@playwright/test';

/**
 * IT-102 — F-043 Multilingual UI: the six-locale i18next translation layer.
 *
 * Protocol: integration-tests/protocols/IT-102-multilingual-i18n.md
 * Gates: validates F-043 (switching locale re-renders the SPA translated — UC-1;
 *        localStorage persistence across reload — UC-2; unknown locale falls back to
 *        English, never a key-literal or third locale — the i18n.ts:23 fallback guard).
 *
 * GROUND TRUTH (read 2026-06-07):
 *   - locales/i18n.ts:1-31 — a singleton i18next with SIX locales (en/es/ch/fr/ua/hy,
 *     constants.ts:158-165 LANGUAGES_MAP). Initial language = localStorage('i18nextLng')
 *     IF it is one of the six, else 'en' (i18n.ts:22-25). No ?lng= query support.
 *   - The locale switcher is in the user menu: AppToolbar.tsx:97-116 mounts
 *     <SelectLanguage> with an openBtn reading t('Select language'); SelectLanguage.tsx:28-33
 *     awaits i18n.changeLanguage(lang) + localStorage.setItem('i18nextLng', lang). The
 *     dialog lists the six LANGUAGES_MAP names (English / Spanish / Chinese / French /
 *     Ukrainian / Armenian).
 *   - Translations are verbatim per locale JSON. Catalog: en "Catalog" -> es "Catálogo"
 *     (es.json:59). Management: en "Management" -> es "Administración" (es.json:198). These
 *     are the toolbar's always-visible chrome tabs (ToolbarTabs.tsx:37,61) — a stable,
 *     route-independent place to read a translated string.
 *   - 'admin' (the DISABLED user label) is NOT a translation key — it is the same in
 *     every locale, so it is a poor probe; the Catalog tab is the probe.
 */

const DISMISS_OVERLAYS = async (page: Page) => {
  // close any open MUI menu/dialog by Escape so a re-open is clean
  await page.keyboard.press('Escape').catch(() => {});
};

// Drive the REAL locale switcher: open the user menu, open "Select language", pick a
// language by its English LANGUAGES_MAP name. This exercises SelectLanguage.tsx's
// i18n.changeLanguage + localStorage write — the production switch path.
async function switchLanguageViaUi(page: Page, languageName: string) {
  // 1. open the user-account menu (the clickable user cluster, AppToolbar.tsx:68-73)
  await page.getByRole('button', { name: 'account of current user' }).click();
  // 2. open the "Select language" entry (the SelectLanguage openBtn)
  await page.getByText('Select language', { exact: true }).click();
  // 3. the dialog lists the six languages — pick one by name
  await page.getByRole('dialog').getByText(languageName, { exact: true }).click();
}

test.describe('F-043 Multilingual UI — locale switching + fallback', () => {
  test.beforeEach(async ({ context }) => {
    // start each test from a clean, deterministic locale (no carried-over preference)
    await context.clearCookies();
  });

  test('switching to Spanish renders the UI translated (UC-1)', async ({ page }) => {
    await page.goto('/directory');
    // baseline: English chrome — the Catalog tab reads "Catalog"
    await expect(
      page.getByRole('tab', { name: 'Catalog' }),
      'baseline: the English Catalog tab must render before switching',
    ).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Spanish');

    // ---- assert: the SPA re-renders in Spanish — the Catalog tab now reads "Catálogo" ----
    await expect(
      page.getByRole('tab', { name: 'Catálogo' }),
      'after switching to Spanish the Catalog tab must render its es.json value "Catálogo"',
    ).toBeVisible({ timeout: 10_000 });
    // and the English label is gone (it was translated, not duplicated)
    await expect(
      page.getByRole('tab', { name: 'Catalog' }),
      'the English "Catalog" tab must no longer be present after translating',
    ).toHaveCount(0);
  });

  test('a chosen locale persists across a full page reload (UC-2)', async ({ page }) => {
    await page.goto('/directory');
    await expect(page.getByRole('tab', { name: 'Catalog' })).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Spanish');
    await expect(page.getByRole('tab', { name: 'Catálogo' })).toBeVisible({ timeout: 10_000 });

    // localStorage('i18nextLng') was written (SelectLanguage.tsx:30); a full reload reads
    // it back (i18n.ts:22) and boots Spanish — no need to re-pick the language.
    await DISMISS_OVERLAYS(page);
    await page.reload();
    await expect(
      page.getByRole('tab', { name: 'Catálogo' }),
      'the Spanish preference must survive a reload (localStorage round-trip)',
    ).toBeVisible({ timeout: 10_000 });
    const stored = await page.evaluate(() => window.localStorage.getItem('i18nextLng'));
    expect(stored, 'i18nextLng must be persisted as "es"').toBe('es');
  });

  // REGRESSION #1748 (PLT-190): three of the nine toolbar tabs (Data Quality / Data
  // Modelling / Master Data) had NO key in ANY of the six locale catalogs — the natural-keys
  // fallback rendered the raw English literal beside six translated siblings under every
  // non-English locale (a half-translated primary nav). The catalogs now carry all nine tab
  // keys; this case pins the FULL tab set under Ukrainian (the issue's user story).
  test('every toolbar tab translates under a non-English locale (regression #1748)', async ({
    page,
  }) => {
    await page.goto('/directory');
    await expect(
      page.getByRole('tab', { name: 'Catalog', exact: true }),
      'baseline: the English chrome must render before switching',
    ).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Ukrainian');

    // all NINE tabs render their ua.json values — including the three #1748 keys
    const uaTabs = [
      'Каталог',
      'Директорія',
      'Якість даних',
      'Моделювання даних',
      'Майстер-дані',
      'Менеджмент',
      'Словник',
      'Сповіщення',
      'Активність',
    ];
    for (const name of uaTabs) {
      await expect(
        page.getByRole('tab', { name, exact: true }),
        `the "${name}" tab must render its ua.json value (no missing-key fallback)`,
      ).toBeVisible({ timeout: 10_000 });
    }
    // and the previously-keyless three no longer fall back to the raw English literal
    for (const literal of ['Data Quality', 'Data Modelling', 'Master Data']) {
      await expect(
        page.getByRole('tab', { name: literal, exact: true }),
        `the raw English literal "${literal}" must be gone under ua (#1748)`,
      ).toHaveCount(0);
    }
  });

  // CORNER: an unknown / unsupported locale must fall back to English. i18n.ts:23 guards
  // `languages.includes(storedLanguage) ? storedLanguage : 'en'`, so a bogus stored value
  // boots English — NOT a key-literal and NOT a third locale. We seed the bogus value via
  // an init script so it is present at the very first i18n module load (the production
  // read point), then assert the English chrome renders.
  test('CORNER: an unknown stored locale falls back to English', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('i18nextLng', 'zz-bogus');
    });
    await page.goto('/directory');

    // English renders (the fallback) — Catalog reads "Catalog", not "Catálogo" / a key id
    await expect(
      page.getByRole('tab', { name: 'Catalog' }),
      'an unknown locale must fall back to English — the Catalog tab reads "Catalog"',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('tab', { name: 'Catálogo' }),
      'the unknown locale must NOT have loaded Spanish',
    ).toHaveCount(0);
  });

  // REGRESSION PLT-226 (#1783 second-order): SelectLanguage.tsx built the picker from
  // `i18n.languages` (the runtime fallback chain), and #1783's fallbackLng:'en' collapsed that to
  // ['en'] — so the dialog offered ONLY English and no user could switch locale. CTRIB-014 lists
  // Object.keys(LANGUAGES_MAP) instead. RED on the pre-fix SUT (one row), GREEN once every supported
  // locale is offered. This is also why the switch cases above (UC-1/UC-2/#1748/#1751) could run.
  test('the language picker offers every supported locale, not just English (regression PLT-226)', async ({
    page,
  }) => {
    await page.goto('/directory');
    await page.getByRole('button', { name: 'account of current user' }).click();
    await page.getByText('Select language', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const name of [
      'English',
      'Spanish',
      'Chinese',
      'French',
      'Ukrainian',
      'Armenian',
      'Brazilian Portuguese',
    ]) {
      await expect(
        dialog.getByText(name, { exact: true }),
        `the language picker must offer "${name}" (PLT-226: fallbackLng:'en' had collapsed the picker to English-only)`,
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // REGRESSION #1751 (PLT-215, CTRIB-014): after #1783 completed en.json + set fallbackLng:'en',
  // each non-English catalog still trailed en by 84 keys — feature-surface strings that rendered
  // the raw English label under a non-en locale (degraded, not a foreign leak). CTRIB-014 translated
  // all 84 into es/br/ch/fr/ua/hy. The Data Modelling sub-tabs ('Query Examples', 'Relationships' —
  // DataModellingTabs.tsx, pure t() labels) are two of those keys and render synchronously, like the
  // #1748 toolbar tabs. RED on ODD_SUT=ref:main (es falls back to English), GREEN on the fix.
  test('previously-untranslated feature keys render translated under a non-English locale (regression #1751)', async ({
    page,
  }) => {
    await page.goto('/data-modelling');
    // baseline English: the Data Modelling sub-tabs read their English labels
    await expect(
      page.getByRole('tab', { name: 'Relationships', exact: true }),
      'baseline: the English "Relationships" sub-tab must render before switching',
    ).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Spanish');

    // the sub-tabs now render their es.json values — the keys #1751 added
    await expect(
      page.getByRole('tab', { name: 'Relaciones', exact: true }),
      'after switching to Spanish, the "Relationships" sub-tab must render es.json "Relaciones" (#1751)',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('tab', { name: 'Ejemplos de consulta', exact: true }),
      'the "Query Examples" sub-tab must render es.json "Ejemplos de consulta" (#1751)',
    ).toBeVisible({ timeout: 10_000 });
    // and the raw English literal is gone — it was translated, not falling back to en
    await expect(
      page.getByRole('tab', { name: 'Relationships', exact: true }),
      'the raw English "Relationships" must be gone under es (was the #1751 fallback gap)',
    ).toHaveCount(0);
  });

  // REGRESSION #1751 / PLT-205 (the maintainer's reported example): the Relationships PAGE BODY was
  // HARDCODED English (RelationshipsTitle heading + the "... overall" count + the search placeholder) —
  // no t() at all, so it rendered English under EVERY locale even after the catalog catch-up. CTRIB-014
  // wrapped the whole unwrapped-string class in t() (+ a no-literal-string lint guard). Drive the real
  // page under es and assert the body renders translated, not English.
  test('the Relationships page body renders translated under a non-English locale (#1751 / PLT-205)', async ({
    page,
  }) => {
    await page.goto('/data-modelling/relationships');
    // baseline English: the page heading + search placeholder are English
    await expect(
      page.getByRole('heading', { name: 'Relationships', exact: true }),
      'baseline: the English "Relationships" page heading must render before switching',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder('Search relationships'),
      'baseline: the English "Search relationships" placeholder must render before switching',
    ).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Spanish');

    // the page body now renders its es.json values (these strings were hardcoded before CTRIB-014)
    await expect(
      page.getByRole('heading', { name: 'Relaciones', exact: true }),
      'after switching to es, the page heading must read es.json "Relaciones"',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder('Buscar relaciones'),
      'the search placeholder must read es.json "Buscar relaciones"',
    ).toBeVisible({ timeout: 10_000 });
    // and the raw English body strings are gone — they were hardcoded, now translated
    await expect(
      page.getByRole('heading', { name: 'Relationships', exact: true }),
      'the raw English "Relationships" heading must be gone under es',
    ).toHaveCount(0);
    await expect(
      page.getByPlaceholder('Search relationships'),
      'the raw English "Search relationships" placeholder must be gone under es',
    ).toHaveCount(0);
  });

  // REGRESSION #1751 / PLT-205 (the second wave — the strings the no-literal-string lint MISSED):
  // ~18 user-facing strings sat in JSX *attributes* (placeholder / label / aria-label) that the eslint
  // guard silently skipped, so they rendered English under every locale even after the first wrap pass.
  // CTRIB-014 wrapped them all + added a deterministic vitest attribute-guard (i18n-key-parity.test.ts).
  // The Master Data > Lookup Tables page is one such surface — its H1 + search placeholder are now
  // translated. Drive the real page under es and assert the body renders Spanish, not English.
  test('the Lookup Tables page (H1 + search placeholder) renders translated under es (#1751 / PLT-205 wave 2)', async ({
    page,
  }) => {
    await page.goto('/master-data/lookup-tables');
    // baseline English — the page H1 + the (previously-unwrapped) search placeholder
    await expect(
      page.getByRole('heading', { name: 'Lookup Tables', exact: true }),
      'baseline: the English "Lookup Tables" H1 must render before switching',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder('Search lookup tables...'),
      'baseline: the English "Search lookup tables..." placeholder must render before switching',
    ).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Spanish');

    // the page now renders its es.json values
    await expect(
      page.getByRole('heading', { name: 'Tablas de búsqueda', exact: true }),
      'after switching to es, the H1 must read es.json "Tablas de búsqueda"',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder('Buscar tablas de búsqueda...'),
      'the search placeholder must read es.json "Buscar tablas de búsqueda..." (was an unwrapped literal pre-CTRIB-014)',
    ).toBeVisible({ timeout: 10_000 });
    // and the raw English strings are gone
    await expect(
      page.getByPlaceholder('Search lookup tables...'),
      'the raw English "Search lookup tables..." placeholder must be gone under es',
    ).toHaveCount(0);
  });

  // REGRESSION #1751 / PLT-205 (wave 3 — the maintainer's /search example, 2026-06-15): the search
  // result-type tabs ("All", "My Objects", "Datasets", …) are string literals in a TS object array
  // (SearchResultsTabs.tsx) rendered via <AppTabs>, so they live OUTSIDE JSX — the eslint no-literal-string
  // rule and the JSX-attribute guard BOTH miss them; they rendered English under every locale (the maintainer
  // drove /search under `ua` and saw the English tab strip). CTRIB-014 wrapped them in t() + added a
  // deterministic object-property guard. Drive a real search under `ua` and assert the tab strip is Ukrainian.
  test('the search result-type tabs render translated under a non-English locale (#1751 / PLT-205 wave 3)', async ({
    page,
  }) => {
    await page.goto('/search');
    // perform a search so the result-tab strip renders (the main catalog box searches on Enter)
    const box = page.getByPlaceholder('Search', { exact: true });
    await box.fill('a');
    await box.press('Enter');
    // baseline English: the result-type tab strip renders "All" + "My Objects" (names carry a count hint,
    // so match by substring, like IT-068)
    await expect(
      page.getByRole('tab', { name: /All/ }),
      'baseline: the English "All" search tab must render before switching',
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /My Objects/ })).toBeVisible({ timeout: 10_000 });

    await switchLanguageViaUi(page, 'Ukrainian');

    // the tab strip now renders its ua.json values (these were hardcoded literals pre-CTRIB-014)
    await expect(
      page.getByRole('tab', { name: /Усі/ }),
      'after switching to ua, the "All" tab must read ua.json "Усі"',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('tab', { name: /Мої об'єкти/ }),
      'the "My Objects" tab must read ua.json "Мої об\'єкти"',
    ).toBeVisible({ timeout: 10_000 });
    // and the raw English tab label is gone — it was a hardcoded literal, now translated
    await expect(
      page.getByRole('tab', { name: /My Objects/ }),
      'the raw English "My Objects" tab must be gone under ua',
    ).toHaveCount(0);
  });
});

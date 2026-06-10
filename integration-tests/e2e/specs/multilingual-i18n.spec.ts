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
});

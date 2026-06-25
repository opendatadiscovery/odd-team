import { test, expect, type Page } from '@playwright/test';

/**
 * IT-143 — odd-platform#1776 (CTRIB-036): the home-page main-search placeholder renders the
 * TRANSLATED hint under a non-English locale, not a literal gloss of the symbolic i18n key.
 *
 * Protocol: integration-tests/protocols/IT-143-i18n-main-search-placeholder.md
 * Gates: validates F-141 (the Overview home composition — the non-en render of the MainSearch box);
 *        regresses odd-platform#1776 / PLT-221 (all six non-en catalogs translated the symbolic KEY
 *        `main search placeholder`, not the en VALUE — the home search hint).
 *
 * The home MainSearch box is `Overview.tsx:47` `<MainSearch mainSearch />` with NO `placeholder`
 * prop, so `MainSearchInput.tsx:71` `placeholder ?? mainSearchPlaceholder` falls through to
 * `t('main search placeholder')`. en.json's value is the long hint ("Search data tables, feature
 * group, jobs and ML models via keywords") — IT-071 covers that EN path. The six non-en catalogs
 * had instead translated the KEY ("main search space" / "main search pointer" / the literal word
 * "placeholder" in Chinese), so a non-English operator saw a meaningless literal on the first
 * surface they meet. `i18n.ts:24` picks the language from `localStorage('i18nextLng')` at init, so
 * we force the locale before the app boots and assert the rendered placeholder is the translated
 * hint (RED on `ODD_SUT=ref:main`, GREEN on the fix). This is the non-en complement to IT-071.
 */

// The popular-tags fetch that gates the home skeleton-lift (Overview.tsx) — the MainSearch box
// renders in the post-skeleton composition, so wait for it (mirrors IT-071). GET /api/tags?...size=
// is the wire path for the popular-tags list; it resolves even on an empty catalog (no seed needed).
const popularTagsFetch = (page: Page) =>
  page.waitForResponse(
    r =>
      /\/api\/tags(\?|$)/.test(r.url()) &&
      r.url().includes('size=') &&
      r.request().method() === 'GET' &&
      r.ok()
  );

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// locale → { a distinctive fragment of the CORRECT translated hint ; the pre-#1776 literal-key gloss }.
// Two representatives (Latin + Cyrillic); the per-locale value shape is covered structurally by the
// unit guard (odd-platform-ui i18n-key-parity.test.ts, all six catalogs).
const CASES = [
  { locale: 'es', hint: 'tablas de datos', gloss: 'espacio para búsqueda principal' },
  { locale: 'ua', hint: 'таблиць даних', gloss: 'основний покажчик пошуку' },
] as const;

test.describe('F-141 home main-search placeholder is a translated hint under non-en locales (#1776)', () => {
  for (const { locale, hint, gloss } of CASES) {
    test(`${locale}: the home search box shows the translated hint, not the literal key-gloss`, async ({
      page,
    }) => {
      // ---- arrange: force the locale BEFORE the app boots (i18n.ts:24 reads localStorage at init) ----
      await page.addInitScript(lng => window.localStorage.setItem('i18nextLng', lng), locale);

      // ---- act: open the home page; wait for the popular-tags fetch that lifts the skeleton ----
      const tags = popularTagsFetch(page);
      await page.goto('/');
      await tags;

      // ---- assert (1): the MainSearch placeholder is the TRANSLATED hint (a multi-item list) ----
      await expect(
        page.getByPlaceholder(new RegExp(hint, 'i')).first(),
        `the ${locale} home search box must render the translated hint (containing "${hint}"), not the literal key-gloss — odd-platform#1776`
      ).toBeVisible({ timeout: 10_000 });

      // ---- assert (2, anti-regression): the pre-#1776 literal-key gloss is gone ----
      await expect(
        page.getByPlaceholder(new RegExp(escapeRegExp(gloss), 'i')),
        `the pre-#1776 literal-key gloss "${gloss}" must no longer be the ${locale} search-box placeholder`
      ).toHaveCount(0);
    });
  }
});

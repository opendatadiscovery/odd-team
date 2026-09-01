import type { Page } from '@playwright/test';

/**
 * Drive the REAL locale switcher: open the user menu, open "Select language", pick a language by its English
 * `LANGUAGES_MAP` name. This exercises `SelectLanguage.tsx`'s `i18n.changeLanguage` + localStorage write —
 * the production switch path, not a test-only shortcut into i18next.
 *
 * Extracted from `multilingual-i18n.spec.ts` (where it lived as a local function) when IT-153 needed it too.
 * The reason a second spec needs it is worth stating, because it is the whole point of the guard: ODD's
 * recurring i18n defect is user-facing strings built in a TS object array OUTSIDE JSX, which both the eslint
 * no-literal-string rule and the JSX-attribute guard miss (#1751 / PLT-205). Catalog key-parity does not catch
 * that class either — the key exists in all seven locale files and the component never calls `t()` on it. The
 * only thing that catches it is DRIVING the page under a non-English locale, so any spec that ships new
 * user-facing labels on a surface it owns should be able to do exactly that.
 */
export async function switchLanguageViaUi(page: Page, languageName: string): Promise<void> {
  // 1. open the user-account menu (the clickable user cluster, AppToolbar.tsx:68-73)
  await page.getByRole('button', { name: 'account of current user' }).click();
  // 2. open the "Select language" entry (the SelectLanguage openBtn)
  await page.getByText('Select language', { exact: true }).click();
  // 3. the dialog lists the languages — pick one by name
  await page.getByRole('dialog').getByText(languageName, { exact: true }).click();
}

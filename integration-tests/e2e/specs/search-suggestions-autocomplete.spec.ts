import { test, expect } from '@playwright/test';
import { seedSearchableEntity } from '../helpers/db';

/**
 * IT-132 — F-017 Search-as-you-type suggestions (the home-page autocomplete dropdown).
 *
 * Protocol: integration-tests/protocols/IT-132-search-suggestions-autocomplete.md
 * Gates: validates F-017 (typing surfaces matching entities in the suggestions dropdown).
 *
 * Complements IT-022 (Enter -> /results): this drives the distinct type-ahead affordance
 * (SearchSuggestionsAutocomplete + getQuerySuggestions). The home page mounts <MainSearch mainSearch/>;
 * typing fires a debounced GET /api/search/suggestions and renders the matches in [data-qa=search_dropdown].
 * Suggestions match the FTS search_entrypoint vector — seedSearchableEntity seeds it.
 *
 * Reliability: the dropdown is MUI controlled-open (opens once searchText is non-empty), so we type
 * keystroke-by-keystroke (pressSequentially) rather than fill(); we assert BOTH the backend response body
 * (network truth) AND the rendered dropdown (the UI proof).
 */
const MATCH = 'IT132SuggestEntity';
const OTHER = 'IT132OtherEntity';

test.describe('F-017 Search suggestions / autocomplete', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(2132, MATCH);
    await seedSearchableEntity(2133, OTHER);
  });

  test('typing in the main search box surfaces matching entities in the suggestions dropdown', async ({
    page,
  }) => {
    await page.goto('/');

    const box = page.locator('[data-qa="search_string"]');
    await expect(box, 'the main search box renders on the home page').toBeVisible({ timeout: 15_000 });

    const suggestions = page.waitForResponse(
      r => r.url().includes('/api/search/suggestions') && r.request().method() === 'GET' && r.ok(),
      { timeout: 15_000 },
    );

    await box.click();
    await box.pressSequentially(MATCH, { delay: 80 }); // keystrokes open the controlled dropdown + debounced fetch

    // (a) network truth: the suggestions endpoint returns the match.
    // NB: the raw HTTP wire is snake_case (external_name); the TS client camelCases only AFTER fetch.
    const body = (await (await suggestions).json()) as Array<{ external_name?: string }>;
    expect(
      body.some(e => e.external_name === MATCH),
      'the suggestions response must contain the matching entity',
    ).toBeTruthy();
    expect(
      body.some(e => e.external_name === OTHER),
      'the suggestions response must not contain the non-matching entity',
    ).toBeFalsy();

    // (b) UI proof: the match renders in the dropdown; the non-match does not
    const dropdown = page.locator('[data-qa="search_dropdown"]');
    await expect(
      dropdown.getByText(MATCH).first(),
      'the matching entity must appear in the suggestions dropdown',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dropdown.getByText(OTHER),
      'a non-matching entity must not be suggested',
    ).toHaveCount(0);
  });
});

import { test, expect, type Page, type Response } from '@playwright/test';
import { latestSearchFacetQuery } from '../helpers/db';

/**
 * IT-003 — search tsquery poisoning (the persistent-500 footgun).
 *
 * Protocol: integration-tests/protocols/IT-003-search-tsquery-poisoning.md
 * Gates: validates F-017 (Search Filter Facets) + F-024 (Term Search & Browse) ·
 *        regresses PLT-090 (catalog /search) + PLT-127 (dictionary /termsearch).
 *
 * The bug (one root cause, two surfaces): the typed query is persisted verbatim into
 * the search session row and later inlined into a raw `to_tsquery(?)` —
 * `JooqFTSHelper.tsQuery` (JooqFTSHelper.java:164-168) does NOT escape tsquery
 * operators (`(` `)` `:` `&` `|` `!` `*`). So a single metacharacter (common in
 * technical names — `user(id)`, `ratio:1`) raises Postgres `42601 syntax error in
 * tsquery`, surfaced to the user as HTTP 500. Worse, the malformed string is
 * PERSISTED to the session row, so every later read of that session 500s again until
 * the housekeeping TTL evicts it (default 30 days) — a one-keystroke, shareable,
 * persistent denial-of-service on a bookmarked search.
 *
 * Why e2e (not an API probe): this is the user-observable failure of a normal action
 * — a person typing a name with a paren into the search box. The browser flow
 * (type → submit → session created → results read 500s → reopen 500s) is exactly the
 * user's experience; the protocol drives that flow and reads the persisted poison
 * straight from Postgres as independent ground truth.
 *
 * EXPECTED RESULT TODAY: RED on both surfaces. The metacharacter 500s and poisons the
 * session. The red is the regression signal; it goes green when JooqFTSHelper escapes
 * tsquery operators (the one fix closes PLT-090 + PLT-127).
 */

// The filed repro from PLT-090: tokens `foo` and `)(` reach
// `to_tsquery('foo:* & )(:*')`, which Postgres rejects (42601). Any unbalanced
// operator works; this is the documented payload.
const POISON = 'foo )(';

// Collect every JSON-API server error (5xx) the page receives during a flow. On a
// healthy stack a search submit produces only 2xx (results, or 0 rows at 200 →
// "No matches found"). A 5xx here IS the to_tsquery parse failure reaching the user.
function watchApi5xx(page: Page): string[] {
  const hits: string[] = [];
  page.on('response', (r: Response) => {
    try {
      if (r.status() >= 500 && r.url().includes('/api/')) {
        hits.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
      }
    } catch {
      /* ignore malformed URL */
    }
  });
  return hits;
}

test.describe('IT-003 search tsquery poisoning — a metacharacter must not 500 or poison the session', () => {
  test('catalog search: a tsquery metacharacter returns gracefully, no persistent 500 (PLT-090 / F-017 H-007)', async ({
    page,
  }) => {
    const errors = watchApi5xx(page);

    // ---- control: a well-formed query must work (proves search + stack are healthy,
    //      so a later 5xx is specifically the poison and not a broken stand) ----
    // Route note: the Overview page (/) renders the main search input
    // (MainSearchInput → data-qa="search_string"); Enter creates a /search/{id}
    // session. If this selector/flow changes, re-ground against odd-platform-ui's
    // MainSearchInput / SearchSuggestionsAutocomplete.
    await page.goto('/');
    const box = page.locator('[data-qa="search_string"]');
    await box.waitFor({ state: 'visible' });
    await box.fill('dataset');
    await box.press('Enter');
    await page.waitForLoadState('networkidle');
    expect(
      errors,
      `setup: a well-formed catalog search must not 5xx — search/stack is broken ` +
        `before the poison is even tested. Got: ${JSON.stringify(errors)}`,
    ).toEqual([]);

    // ---- act: type a malformed tsquery and submit ----
    await box.fill(POISON);
    await box.press('Enter');
    await page.waitForTimeout(2500); // settle the results read (+ any react-query retries)

    // ---- persistence probe: the malformed query is persisted to the session row;
    //      reopening the /search/{id} URL re-runs the same to_tsquery and 500s again ----
    const sessionUrl = page.url();
    await page.goto('/');
    await page.goto(sessionUrl); // reopen the (poisoned) session URL
    await page.waitForTimeout(2500);

    // ---- evidence (not the gate): what actually got persisted into search_facets ----
    const persisted = await latestSearchFacetQuery();

    expect(
      errors,
      `A tsquery metacharacter in catalog search must be escaped → results or ` +
        `"No matches found", NEVER a 5xx. Got server errors: ${JSON.stringify(errors)}. ` +
        `Persisted search_facets.query_string = ${JSON.stringify(persisted)}. ` +
        `Each 5xx = Postgres 42601 from JooqFTSHelper.tsQuery inlining the query into ` +
        `to_tsquery() unescaped (PLT-090 / F-017 H-007); a non-empty list on the SECOND ` +
        `(reopen) read proves the persistent-DoS half — the session stays broken.`,
    ).toEqual([]);
  });

  test('dictionary (term) search: a tsquery metacharacter returns gracefully, no persistent 500 (PLT-127 / F-024 H-009)', async ({
    page,
  }) => {
    const errors = watchApi5xx(page);

    // ---- control: a well-formed term search must work ----
    // Route note: /termsearch renders TermSearchInput (placeholder "Search terms…").
    // Same JooqFTSHelper sink as the catalog surface (PLT-127 is the term-search twin
    // of PLT-090 — one fix closes both).
    await page.goto('/termsearch');
    const box = page.getByPlaceholder(/search term/i);
    await box.waitFor({ state: 'visible' });
    await box.fill('glossary');
    await box.press('Enter');
    await page.waitForLoadState('networkidle');
    expect(
      errors,
      `setup: a well-formed term search must not 5xx. Got: ${JSON.stringify(errors)}`,
    ).toEqual([]);

    // ---- act: poison ----
    await box.fill(POISON);
    await box.press('Enter');
    await page.waitForTimeout(2500);

    // ---- persistence probe: reopen the resulting term-search session URL ----
    const sessionUrl = page.url();
    await page.goto('/termsearch');
    await page.goto(sessionUrl);
    await page.waitForTimeout(2500);

    expect(
      errors,
      `A tsquery metacharacter in dictionary/term search must be escaped → results or ` +
        `"No matches found", NEVER a 5xx. Got server errors: ${JSON.stringify(errors)}. ` +
        `Same root cause as the catalog surface — JooqFTSHelper.tsQuery un-escaped ` +
        `to_tsquery (PLT-127 / F-024 H-009).`,
    ).toEqual([]);
  });
});

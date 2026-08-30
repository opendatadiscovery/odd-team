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

  // -------------------------------------------------------------------------------------------------------
  // ST-6 (#1840) extension. The sink now understands three OPERATORS — a quoted phrase, a `-` exclusion and
  // the bare word `or` — so the fail-closed guard has a second family of payloads to survive: operator-SHAPED
  // strings that are syntactically incomplete (an unbalanced quote, a dangling dash, a bare `or`, mixtures).
  // The property under test is unchanged and is the whole point of building the query from Postgres
  // constructors that cannot raise: whatever the user types, they get a page — results or "No matches found".
  // -------------------------------------------------------------------------------------------------------

  const OPERATOR_POISON = [
    '"unbalanced',      // a quote that never closes
    'trailing-',        // a dash glued to the end of a word
    '- -',              // dashes with nothing to negate
    'or',               // the OR operator with no operands
    'or or',
    '"" ""',            // empty phrases
    '-"',               // a negated, unterminated, empty phrase
    '"-"',              // a phrase that is only a dash
    'foo )( -"" or',    // the PLT-090 payload mixed with operator shapes
    '?{0}',             // characters the sanitiser does NOT strip (jOOQ template + bind markers)
  ];

  test('catalog search: operator-shaped payloads return a page, never a 5xx (ST-6 / #1840)', async ({
    page,
  }) => {
    const errors = watchApi5xx(page);

    await page.goto('/');
    const box = page.locator('[data-qa="search_string"]');
    await box.waitFor({ state: 'visible' });
    await box.fill('dataset');
    await box.press('Enter');
    await page.waitForLoadState('networkidle');
    expect(
      errors,
      `setup: a well-formed catalog search must not 5xx before the operator payloads are tested. ` +
        `Got: ${JSON.stringify(errors)}`,
    ).toEqual([]);

    for (const payload of OPERATOR_POISON) {
      await box.fill(payload);
      await box.press('Enter');
      await page.waitForTimeout(1200);
      expect(
        errors,
        `Operator-shaped payload ${JSON.stringify(payload)} must yield a page, never a 5xx. ` +
          `Got server errors: ${JSON.stringify(errors)}. Every leaf of the compiled query comes from a ` +
          `Postgres constructor that cannot raise on metacharacters (to_tsquery over the sanitiser, ` +
          `phraseto_tsquery, plainto_tsquery), and the user's text is always a BIND — so a 5xx here means ` +
          `the query is being assembled as SQL text again (the #1756 / PLT-090 regression).`,
      ).toEqual([]);
    }
  });

  test('dictionary (term) search: operator-shaped payloads return a page, never a 5xx (ST-6 / #1840)', async ({
    page,
  }) => {
    const errors = watchApi5xx(page);

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

    // The term surface shares the sink, so it must survive the same payloads — this is the "one query
    // language, not two dialects" property that made the shared sink the unit of change for ST-6.
    for (const payload of OPERATOR_POISON) {
      await box.fill(payload);
      await box.press('Enter');
      await page.waitForTimeout(1200);
      expect(
        errors,
        `Operator-shaped payload ${JSON.stringify(payload)} must not 5xx the dictionary surface either. ` +
          `Got: ${JSON.stringify(errors)}`,
      ).toEqual([]);
    }
  });
});

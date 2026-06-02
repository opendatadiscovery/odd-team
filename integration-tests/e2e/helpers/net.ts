import type { Page } from '@playwright/test';

export interface InterceptState {
  /** how many dashboard responses were actually intercepted + mutated.
   *  A test MUST assert this is > 0 — otherwise a no-op interception (wrong
   *  shape / wrong URL) silently passes the rest of the test (a false green). */
  injected: number;
}

// Intercept the catalog-wide Data Quality dashboard JSON response and run `mutate`
// over its parsed body before it reaches the UI. We match on the wire field
// `test_results` (snake_case — see the NB below) rather than a hard-coded URL, so the
// hook's endpoint can change without breaking the caller. The mutate callback also
// operates on snake_case keys (`test_results`, `tables_dashboard`).
//
// IMPORTANT (learned from a false-green run): we re-fulfill with an EXPLICIT `body:`,
// NOT `{ response, json }` — passing the fetched `response` makes Playwright resend
// the ORIGINAL body and the mutation is lost. We also rebuild status + content-type
// from scratch and drop the original headers (content-encoding/content-length would
// not match the rewritten body).
//
// Returns an InterceptState the caller asserts on (`injected > 0`). Note the react-query
// `initialData` caveat: the dashboard renders valid placeholder data BEFORE this mutated
// response arrives, so callers must wait for the response to land before asserting.
export async function interceptDashboard(
  page: Page,
  mutate: (body: any) => void,
): Promise<InterceptState> {
  const state: InterceptState = { injected: 0 };
  await page.route('**/api/**', async route => {
    let resp;
    try {
      resp = await route.fetch();
    } catch {
      return route.fallback();
    }
    const ct = resp.headers()['content-type'] ?? '';
    if (!ct.includes('json')) return route.fulfill({ response: resp });
    let body: any;
    try {
      body = await resp.json();
    } catch {
      return route.fulfill({ response: resp });
    }
    // NB: the wire format is snake_case (`test_results`); the generated TS client
    // converts to camelCase (`testResults`) only AFTER fetch, so we MUST match/mutate
    // the snake_case keys here at the HTTP layer.
    if (body && typeof body === 'object' && 'test_results' in body) {
      mutate(body);
      state.injected += 1;
      return route.fulfill({
        status: resp.status(),
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }
    return route.fulfill({ response: resp });
  });
  return state;
}

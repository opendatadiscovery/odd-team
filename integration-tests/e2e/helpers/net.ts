import type { Page } from '@playwright/test';

// Intercept the catalog-wide Data Quality dashboard JSON response and run `mutate`
// over its parsed body before it reaches the UI. We match on the dashboard SHAPE
// (`testResults` + `tablesDashboard`, as consumed by DataQualityContent.tsx) rather
// than a hard-coded URL, so the hook's exact endpoint can change without breaking the
// caller. The original response's status/headers are preserved; only the body changes.
//
// Used by IT-004 (inject an unknown run status) and IT-006 (inject a malformed payload
// to force a render throw) — both exercise the UI's resilience to unexpected server
// data, which is a UI contract, so mutating the response (not the DB) is the right tool.
export async function interceptDashboard(
  page: Page,
  mutate: (body: any) => void,
): Promise<void> {
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
    if (body && typeof body === 'object' && 'testResults' in body && 'tablesDashboard' in body) {
      mutate(body);
      return route.fulfill({ response: resp, json: body });
    }
    return route.fulfill({ response: resp });
  });
}

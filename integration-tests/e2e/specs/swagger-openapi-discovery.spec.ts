import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-042 — F-097 Swagger UI / OpenAPI spec discovery (the surface that silently broke).
 *
 * Protocol: integration-tests/protocols/IT-042-swagger-openapi-discovery.md
 * Gates: validates F-097 (Swagger UI surface exists) · pins PLT-141 (spec fails to load).
 *
 * odd-platform ships springdoc-openapi. application.yml SWAPS the paths: the Swagger UI is at
 * /api/v3/api-docs (302 → the webjars shell) and the OpenAPI JSON is at /api/v3/swagger-ui.html.
 *
 * This is the test that was MISSING when the 2026-04 Spring 6.2 upgrade silently broke Swagger
 * (springdoc 2.2.0 NoSuchMethodError on ControllerAdviceBean → the spec request hangs). Without it the
 * regression shipped undetected. Test 1 locks the working half (the UI shell is served — and is the
 * REAL springdoc shell, not the SPA index.html catch-all). Test 2 is an LSN-029 characterization pin of
 * the broken half (the spec does not load); it flips RED the moment PLT-141 is fixed (springdoc → 2.7.x)
 * and the spec returns — at which point invert it to assert the spec loads.
 */

// True iff the OpenAPI JSON spec actually returns a document within a bounded budget (a hang → false).
async function specLoads(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get('/api/v3/swagger-ui.html', { timeout: 8000 });
    if (!res.ok()) return false;
    const body = (await res.text()).toLowerCase();
    return body.includes('"openapi"') || body.includes('"paths"'); // a genuine OpenAPI document
  } catch {
    return false; // timeout / hang / error = the spec did not load
  }
}

test.describe('F-097 Swagger UI / OpenAPI spec discovery', () => {
  test('the Swagger UI shell is served (the documented interactive API surface exists)', async ({ request }) => {
    // /api/v3/api-docs is the UI route (springdoc.swagger-ui.path) — a real 302 to the webjars shell,
    // NOT the SPA index.html 200 fallback.
    const ui = await request.get('/api/v3/api-docs', { maxRedirects: 0 });
    expect([200, 302], 'the Swagger UI route must be a real endpoint (302 to the shell), not absent').toContain(
      ui.status(),
    );
    // the shell itself is the genuine springdoc Swagger UI (contains "swagger", unlike the SPA "Data Catalog" index)
    const shell = await request.get('/api/v3/webjars/swagger-ui/index.html', { timeout: 8000 });
    expect(shell.status(), 'the Swagger UI shell must load (200)').toBe(200);
    expect((await shell.text()).toLowerCase(), 'must be the real Swagger UI shell, not the SPA fallback').toContain(
      'swagger',
    );
  });

  test('PINS PLT-141: the OpenAPI spec currently FAILS to load (springdoc 2.2.0 × Spring 6.2 hang)', async ({
    request,
  }) => {
    // GREEN while the bug exists (the spec hangs). Flips RED when PLT-141 lands (springdoc → 2.7.x) and
    // the spec returns — then invert this to assert specLoads === true.
    expect(
      await specLoads(request),
      'PLT-141: the OpenAPI spec must currently NOT load (it hangs); flip this when springdoc is bumped',
    ).toBe(false);
  });
});

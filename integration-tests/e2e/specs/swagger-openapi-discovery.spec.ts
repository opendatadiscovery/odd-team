import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-042 — F-097 Swagger UI / OpenAPI spec discovery (the surface that silently broke, now locked GREEN).
 *
 * Protocol: integration-tests/protocols/IT-042-swagger-openapi-discovery.md
 * Gates: validates F-097 (Swagger UI surface works end-to-end) · regression-locks PLT-141 / #1759.
 *
 * odd-platform ships springdoc-openapi. application.yml SWAPS the paths: the Swagger UI is at
 * /api/v3/api-docs (302 → the springdoc shell — /api/v3/swagger-ui/index.html on 2.8.x; the 2.2.0-era
 * /api/v3/webjars/... target is gone) and the OpenAPI JSON documents live under /api/v3/swagger-ui.html
 * (bare = the full un-grouped document; per group: /platform-api, /ingestion-api; /swagger-config for the
 * UI bootstrap).
 *
 * HISTORY (the pin → lock flip, LSN-029): this spec was born 2026-06-04 as a characterization PIN of
 * PLT-141 — springdoc 2.2.0 × Spring 6.2 threw NoSuchMethodError on ControllerAdviceBean while building
 * response schemas; reactor treated it as a JVM-fatal, so the spec request hung forever and the UI sat on
 * "Failed to load API definition". The pin was GREEN-while-broken (asserting the spec does NOT load).
 * 2026-06-12 (#1759, CTRIB-008): springdoc bumped 2.2.0 → 2.8.17 (the Boot-3.4.x-declared line) — the pin
 * INVERTED per its own flip protocol to assert the spec LOADS, locking the working state so the next
 * springdoc × Spring binary drift trips here instead of shipping silently. RED proof on pre-fix main:
 * the group-document fetch times out (the hang). Unit-bucket sibling: odd-platform
 * OpenApiDocsContractTest (same contract, in-process).
 */

// The two grouped OpenAPI documents (SwaggerUIConfiguration.java) — served under the JSON root.
const GROUP_DOCS = ['/api/v3/swagger-ui.html/platform-api', '/api/v3/swagger-ui.html/ingestion-api'];

// True iff the URL returns a genuine OpenAPI document within a bounded budget (a hang/error → false).
async function fetchOpenApiDocument(
  request: APIRequestContext,
  url: string,
): Promise<{ ok: boolean; openapi?: string; pathCount?: number }> {
  try {
    const res = await request.get(url, { timeout: 8000 });
    if (!res.ok()) return { ok: false };
    const body = (await res.json()) as { openapi?: string; paths?: Record<string, unknown> };
    if (!body.openapi || !body.paths) return { ok: false };
    return { ok: true, openapi: body.openapi, pathCount: Object.keys(body.paths).length };
  } catch {
    return { ok: false }; // timeout / hang / non-JSON = the document did not load
  }
}

test.describe('F-097 Swagger UI / OpenAPI spec discovery', () => {
  test('the Swagger UI shell is served (the documented interactive API surface exists)', async ({ request }) => {
    // /api/v3/api-docs is the UI route (springdoc.swagger-ui.path) — a real 302 to the springdoc shell,
    // NOT the SPA index.html 200 fallback. The shell's concrete path is springdoc-version-owned (2.2.0:
    // /api/v3/webjars/swagger-ui/index.html; 2.8.x: /api/v3/swagger-ui/index.html), so follow the actual
    // Location instead of hardcoding it.
    const ui = await request.get('/api/v3/api-docs', { maxRedirects: 0 });
    expect(ui.status(), 'the Swagger UI route must be a real redirect to the shell, not absent/SPA-200').toBe(302);
    const location = ui.headers()['location'];
    expect(location, 'the redirect carries the shell location').toBeTruthy();
    // the shell itself is the genuine springdoc Swagger UI (contains "swagger", unlike the SPA "Data Catalog" index)
    const shell = await request.get(location!, { timeout: 8000 });
    expect(shell.status(), `the Swagger UI shell at ${location} must load (200)`).toBe(200);
    expect((await shell.text()).toLowerCase(), 'must be the real Swagger UI shell, not the SPA fallback').toContain(
      'swagger',
    );
  });

  test('LOCKS #1759/PLT-141 fix: both grouped OpenAPI documents load (springdoc compatible with the Spring line)', async ({
    request,
  }) => {
    // INVERTED PIN (2026-06-12): GREEN = the documents load. On pre-fix main this fails by timeout —
    // exactly the pinned NoSuchMethodError hang. If a future Spring/springdoc bump reintroduces binary
    // drift, this trips RED here (and in the unit-bucket OpenApiDocsContractTest) before it ships.
    for (const url of GROUP_DOCS) {
      const doc = await fetchOpenApiDocument(request, url);
      expect(doc.ok, `${url} must return a genuine OpenAPI document (openapi + paths) within 8s`).toBe(true);
      expect(doc.openapi, `${url} declares an OpenAPI 3.x document`).toMatch(/^3\./);
      expect(doc.pathCount ?? 0, `${url} carries at least one operation path`).toBeGreaterThan(0);
    }
    // the bare JSON root serves the full un-grouped document too (it HUNG on 2.2.0)
    const bare = await fetchOpenApiDocument(request, '/api/v3/swagger-ui.html');
    expect(bare.ok, 'the bare /api/v3/swagger-ui.html document must load (it hung on springdoc 2.2.0)').toBe(true);
    // the swagger-config the UI bootstraps from lists exactly the two definitions
    const cfg = await request.get('/api/v3/swagger-ui.html/swagger-config', { timeout: 8000 });
    expect(cfg.status(), 'the swagger-config bootstrap resource must load').toBe(200);
    const cfgBody = (await cfg.json()) as { urls?: Array<{ name: string }> };
    const names = (cfgBody.urls ?? []).map(u => u.name).sort();
    expect(names, 'the UI offers exactly the two configured definitions').toEqual(['ingestion-api', 'platform-api']);
  });

  test('the rendered Swagger UI loads the API definition (the user-facing surface, not just the wire)', async ({
    page,
  }) => {
    // The operator's actual flow: open {base}/api/v3/api-docs in a browser. Pre-fix this rendered the
    // shell with "Failed to load API definition"; post-fix the definition loads and operations render.
    await page.goto('/api/v3/api-docs');
    // .swagger-ui is nested (section + inner div) — .first() avoids the strict-mode violation
    await expect(page.locator('.swagger-ui').first(), 'the Swagger UI app must mount').toBeVisible({ timeout: 15000 });
    // the definition title renders (the document was fetched and parsed by the UI)
    await expect(page.locator('.swagger-ui .info .title').first(), 'a loaded definition shows its title').toBeVisible({
      timeout: 15000,
    });
    // at least one operation/tag block is listed — the definition actually has content
    await expect(
      page.locator('.swagger-ui .opblock-tag, .swagger-ui .opblock').first(),
      'the loaded definition lists operations',
    ).toBeVisible({ timeout: 15000 });
    // and the pre-fix failure text is gone
    await expect(
      page.getByText('Failed to load API definition'),
      'the PLT-141 failure banner must not render',
    ).toHaveCount(0);
  });
});

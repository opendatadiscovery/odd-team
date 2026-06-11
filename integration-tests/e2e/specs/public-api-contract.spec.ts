import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-063 — F-029 Platform Public API Contract (the single OpenAPI 3.0.3 document for the platform API).
 *
 * Protocol: integration-tests/protocols/IT-063-public-api-contract.md
 * Gates: validates F-029 (UC-14 spec path/method is authoritative · UC-12 spec<->platform conformance);
 *        pins PLT-141 (the live OpenAPI spec endpoint fails to load — distinct from IT-042's UI-shell test).
 *
 * F-029's structural root finding (UC-12) is that there is ZERO end-to-end conformance check between the
 * 4212-line `odd-platform-specification/openapi.yaml` and the running platform — every other drift class
 * accumulates undefended. IT-042 already covers the Swagger UI shell + pins the hung spec endpoint
 * (PLT-141: springdoc 2.2.0 x Spring 6.2). This spec does something DIFFERENT: a SPEC->PLATFORM conformance
 * check that does NOT depend on the hung /api/v3 spec endpoint. It takes documented GET operations straight
 * from openapi.yaml and asserts the LIVE platform honours them (status + spec-declared response shape).
 *
 * GROUNDED 2026-06-07 against :18080 + read of odd-platform-specification/openapi.yaml + components.yaml:
 *   GET /api/dataentities/classes -> 200 {"entity_classes":[...]}            (DataEntityClassAndTypeDictionary)
 *   GET /api/dataentities/usage   -> 200 {"total_count","unfilled_count","data_entity_classes_info"}  (all 3 required)
 *   GET /api/identity/whoami      -> 200 {"identity":{...}}                  (AssociatedOwner; identity required)
 *   GET /api/tags?page=1&size=10  -> 200 {"items":[...],"page_info":{...}}   (PageParam+SizeParam are required:true)
 *   GET /api/tags  (no page/size)  -> 500 SYS001  (required params omitted -> server error, not the spec's 200/400)
 */

const PAGED = '?page=1&size=10';

async function getJson(request: APIRequestContext, path: string): Promise<{ status: number; body: unknown }> {
  const res = await request.get(path);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

test.describe('F-029 Platform Public API Contract — spec <-> platform conformance', () => {
  test('it20630_UC-14: documented GET operations are honoured live with their spec-declared response shape', async ({
    request,
  }) => {
    // UC-14 (CONFIRMED in the reflection): the OpenAPI spec is the path/method authority — every controller
    // implements a generated *Api interface and carries no overriding HTTP mapping. This asserts that authority
    // on the wire for three no-parameter GETs, checking BOTH the status code AND the spec-declared top-level
    // response field-set (the conformance dimension UC-12 says is otherwise undefended).

    // openapi.yaml getDataEntityClasses -> DataEntityClassAndTypeDictionary { entity_classes }
    const classes = await getJson(request, '/api/dataentities/classes');
    expect(classes.status, 'GET /api/dataentities/classes returns the spec-declared 200').toBe(200);
    expect(
      Object.prototype.hasOwnProperty.call(classes.body as object, 'entity_classes'),
      'response carries the spec-declared DataEntityClassAndTypeDictionary.entity_classes field',
    ).toBe(true);
    expect(Array.isArray((classes.body as { entity_classes?: unknown }).entity_classes), 'entity_classes is a list').toBe(
      true,
    );

    // openapi.yaml getDataEntitiesUsage -> DataEntityUsageInfo { total_count, unfilled_count, data_entity_classes_info } (all required)
    const usage = await getJson(request, '/api/dataentities/usage');
    expect(usage.status, 'GET /api/dataentities/usage returns the spec-declared 200').toBe(200);
    for (const required of ['total_count', 'unfilled_count', 'data_entity_classes_info']) {
      expect(
        Object.prototype.hasOwnProperty.call(usage.body as object, required),
        `response carries the spec-REQUIRED DataEntityUsageInfo.${required} field`,
      ).toBe(true);
    }

    // openapi.yaml whoami -> AssociatedOwner { identity (required), owner?, association_request? }
    const whoami = await getJson(request, '/api/identity/whoami');
    expect(whoami.status, 'GET /api/identity/whoami returns the spec-declared 200').toBe(200);
    expect(
      Object.prototype.hasOwnProperty.call(whoami.body as object, 'identity'),
      'response carries the spec-REQUIRED AssociatedOwner.identity field',
    ).toBe(true);
  });

  test('it20631_UC-12 [conformance pin]: paginated list operations honour the {items,page_info} shape WITH required page+size, and 400 (not the spec 200) WITHOUT them', async ({
    request,
  }) => {
    // Two halves of a real spec<->platform conformance characterization (LSN-029):
    //  (a) The happy path: /api/tags WITH the spec-required PageParam+SizeParam (components.yaml: both required:true)
    //      returns the spec-declared paginated envelope { items, page_info }.
    //  (b) The conformance GAP, narrowed 2026-06-11 (flipped per this pin's own protocol): /api/tags WITHOUT
    //      page/size now returns a typed 400 USR001 — the advice ResponseStatusException pass-through
    //      (#1760/#1761, CTRIB-005) keeps the framework's MissingRequestValueException status instead of the
    //      old opaque 500 SYS001. Still NOT the spec-declared 200 (the spec declares no error responses at
    //      all) — that residual spec<->platform gap is the UC-12 class and stays pinned here.
    const withParams = await getJson(request, `/api/tags${PAGED}`);
    expect(withParams.status, 'GET /api/tags?page&size returns the spec-declared 200').toBe(200);
    for (const field of ['items', 'page_info']) {
      expect(
        Object.prototype.hasOwnProperty.call(withParams.body as object, field),
        `paginated response carries the spec-declared envelope field "${field}"`,
      ).toBe(true);
    }
    expect(Array.isArray((withParams.body as { items?: unknown }).items), 'items is a list').toBe(true);

    // Same operation, required params omitted.
    const noParams = await request.get('/api/tags');
    expect(
      noParams.status(),
      'omitting the spec-required page/size yields a typed 400 (advice pass-through, #1761) — the spec itself still declares only 200',
    ).toBe(400);
    expect(
      ((await noParams.json()) as { code?: string }).code,
      'the 400 carries the user-error code USR001 (a typed 4xx for a missing required param)',
    ).toBe('USR001');
  });

  test('it20632_UC-12 PINS PLT-141: the live OpenAPI spec document still FAILS to load (no machine-readable contract to conform against)', async ({
    request,
  }) => {
    // The reason a SPEC->PLATFORM conformance check must hand-pick endpoints (above) instead of reading the live
    // spec: the served OpenAPI document does not load. springdoc 2.2.0 x Spring 6.2 throws NoSuchMethodError on
    // ControllerAdviceBean and the spec request hangs/errors (PLT-141; IT-042 pins the same break from the
    // UI-shell angle). Here it is pinned from the CONTRACT angle: there is no consumable machine-readable contract
    // on a running deployment. GREEN while PLT-141 is open; flips RED when springdoc is bumped and the document
    // returns — at which point this test should be inverted to drive the conformance loop from the LIVE spec.
    let specLoads = false;
    try {
      const res = await request.get('/api/v3/swagger-ui.html', { timeout: 8000 });
      if (res.ok()) {
        const body = (await res.text()).toLowerCase();
        specLoads = body.includes('"openapi"') || body.includes('"paths"');
      }
    } catch {
      specLoads = false; // timeout / hang / error = the spec did not load
    }
    expect(
      specLoads,
      'PLT-141: the live OpenAPI spec document must currently NOT load; flip + invert this when springdoc is bumped',
    ).toBe(false);
  });
});

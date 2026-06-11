import { test, expect } from '@playwright/test';
import { createDataSource, ingestEntities, tableEntity } from '../helpers/ingest';

/**
 * IT-056 — F-064 "My objects" silent-empty across Activity / Alerts under DISABLED.
 *
 * Protocol: integration-tests/protocols/IT-056-my-objects-silent-empty.md
 * Gates: validates F-064 (UC-2 Activity My silent-empty · UC-4 Alerts My silent-empty · UC-5
 *        count-side silent-zero). Cross-refs F-011 (the chokepoint) + F-021/F-007 (the surfaces).
 *
 * THE PROMISE F-064 EXISTS TO PIN (and which its own use_case_coverage records as CONFIRMED-but-
 * UNVERIFIED — 1/9, the empty-owner branch has zero CI guard): the platform's "My objects" surfaces
 * silently render EMPTY when the caller has no owner association, with NO signal distinguishing
 * "you own nothing / no activity" from "you are not bound to an owner". Under auth.type=DISABLED
 * there is never a principal-owner association (F-011: fetchAssociatedOwner short-circuits to empty),
 * so the silent-empty is reproducible deterministically.
 *
 * GROUND TRUTH (source + live curl against odd-minimal):
 *   - Activity ALL feed (GET /api/activity?type=ALL) IS populated and ungated — it returns real
 *     DATA_ENTITY_CREATED rows from ingestion (ActivityServiceImpl.fetchAllActivities).
 *   - Activity MY (type=MY_OBJECTS) -> [] via fetchMyActivities .switchIfEmpty(Flux.empty())
 *     (ActivityServiceImpl.java:194-198) because the owner is empty.
 *   - getActivityCounts returns total_count=N (>0) but my_objects_count=0 via
 *     getMyObjectActivitiesCount .defaultIfEmpty(0L) (ActivityServiceImpl.java:239-243).
 *   - Alerts MY (GET /api/alerts/my) -> 200 with an EMPTY BODY (AlertServiceImpl.listByOwner
 *     .fetchAssociatedOwner().flatMap(...) — the Mono completes empty, no AlertList serialised).
 *
 * The decisive contradiction this RED-pins: total_count proves activity EXISTS, yet the My Objects
 * list AND its count badge are both empty/zero — byte-identical to "nothing happened". This is the
 * silent-empty failure mode (LSN-029 characterization pin of CURRENT behaviour; it goes RED the
 * moment a diagnostic affordance / hint payload / sentinel ships — REFACTOR-224 / F-064 UC-6).
 *
 * Wire note: the activity endpoint params are snake_case (begin_date, end_date) — verified live;
 * the camelCase form makes Spring see begin_date missing -> MissingRequestValueException, which
 * ControllerAdvice mistranslates to 500 (pinned in the CORNER test below; candidate PLT, same class
 * as PLT-076).
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

// Wide window so any freshly-ingested + historical activity falls inside it.
const BEGIN = '2020-01-01T00:00:00.000Z';
const END = '2099-01-01T00:00:00.000Z';

interface ActivityCounts {
  total_count: number;
  my_objects_count: number;
  downstream_count: number;
  upstream_count: number;
}

test.describe('IT-056 F-064 — "My objects" silent-empty under DISABLED', () => {
  test.beforeAll(async () => {
    // Make the ALL feed deterministically non-empty: ingesting an entity emits a DATA_ENTITY_CREATED
    // activity row (verified live). Self-sufficient against a freshly-reset DB.
    const ts = Date.now();
    const dsOddrn = `//it056/ds-${ts}`;
    await createDataSource(dsOddrn, `it056-ds-${ts}`, 'it056-ns');
    const status = await ingestEntities(dsOddrn, [tableEntity(`${dsOddrn}/tables/it056_seed`, 'it056_seed')]);
    expect(status, 'precondition: anonymous ingest seeds an activity-producing entity (200 under DISABLED)').toBe(200);
  });

  test('RED PIN (UC-2 + UC-5): Activity ALL is populated, yet My Objects returns [] AND my_objects_count=0 — silent-empty indistinguishable from "no activity"', async ({
    request,
  }) => {
    // (a) The ALL feed proves activity EXISTS (the catalog is not empty).
    const allRes = await request.get(
      `${BASE}/api/activity?begin_date=${BEGIN}&end_date=${END}&size=50&type=ALL`,
    );
    expect(allRes.status(), 'GET /api/activity?type=ALL reachable (200) under DISABLED').toBe(200);
    const allRows = (await allRes.json()) as unknown[];
    expect(
      Array.isArray(allRows) && allRows.length,
      'precondition: the global (ALL) activity feed returns >=1 event — there IS activity to be shown.',
    ).toBeGreaterThan(0);

    // (b) The MY_OBJECTS feed is silently empty — same endpoint, same window, just owner-scoped.
    const myRes = await request.get(
      `${BASE}/api/activity?begin_date=${BEGIN}&end_date=${END}&size=50&type=MY_OBJECTS`,
    );
    expect(myRes.status(), 'GET /api/activity?type=MY_OBJECTS reachable (200) under DISABLED').toBe(200);
    const myRows = (await myRes.json()) as unknown[];
    expect(
      Array.isArray(myRows) && myRows.length,
      'F-064-UC-2 (RED PIN): Activity My Objects returns [] under DISABLED while the ALL feed has events — ' +
        'the silent-empty contract (fetchMyActivities .switchIfEmpty(Flux.empty()) on the empty owner). ' +
        'This flips GREEN->RED the moment the empty-owner branch errors, returns a hint payload, or (worst) ' +
        'falls back to an unscoped ALL fetch (a permission-bypass regression).',
    ).toBe(0);

    // (c) The count badge: total_count proves data exists; my_objects_count=0 reinforces "empty for you".
    const countsRes = await request.get(`${BASE}/api/activity/counts?begin_date=${BEGIN}&end_date=${END}`);
    expect(countsRes.status(), 'GET /api/activity/counts reachable (200) under DISABLED').toBe(200);
    const counts = (await countsRes.json()) as ActivityCounts;
    expect(
      counts.total_count,
      'precondition: total_count > 0 — the counts endpoint confirms activity exists globally.',
    ).toBeGreaterThan(0);
    expect(
      counts.my_objects_count,
      'F-064-UC-5 (RED PIN): my_objects_count is 0 under DISABLED even though total_count > 0 — the ' +
        'count-side silent-zero (.defaultIfEmpty(0L)). There is no sentinel distinguishing this 0-because-' +
        'no-owner-association from a legitimate 0. Flips when a missing-association sentinel ships.',
    ).toBe(0);
  });

  test('RED PIN (UC-4): Alerts My Objects returns 200 with an empty body under DISABLED (symmetric silent-empty on the alerting surface)', async ({
    request,
  }) => {
    // AlertServiceImpl.listByOwner: fetchAssociatedOwner().flatMap(listByOwner) -> empty owner short-
    // circuits the flatMap -> the Mono<AlertList> completes empty -> 200 with NO body serialised.
    const res = await request.get(`${BASE}/api/alerts/my?page=1&size=50`);
    expect(res.status(), 'GET /api/alerts/my reachable (200) under DISABLED').toBe(200);

    const body = (await res.text()).trim();
    // Either an empty body (Mono completed empty) or an AlertList with zero items both satisfy
    // "no alerts surfaced". The silent-empty is that there is NO diagnostic either way.
    let itemCount = 0;
    if (body) {
      const parsed = JSON.parse(body) as { items?: unknown[] };
      itemCount = Array.isArray(parsed.items) ? parsed.items.length : 0;
    }
    expect(
      itemCount,
      'F-064-UC-4 (RED PIN): Alerts My Objects surfaces zero alerts under DISABLED (empty body / empty ' +
        'items) with no diagnostic distinguishing "no alerts on entities you own" from "you are not bound ' +
        'to an owner" — the symmetric arm of the cross-feature silent-empty class. Flips when the empty-' +
        'owner alert path errors or carries an association-missing hint.',
    ).toBe(0);

    // Corroborating: /api/alerts/totals reports my_total=0 alongside whatever total exists.
    const totalsRes = await request.get(`${BASE}/api/alerts/totals`);
    expect(totalsRes.status(), 'GET /api/alerts/totals reachable (200)').toBe(200);
    const totals = (await totalsRes.json()) as { my_total?: number };
    expect(
      totals.my_total,
      'F-064: alert my_total is 0 under DISABLED (no owner) — the alert-count side of the silent-empty class.',
    ).toBe(0);
  });

  test('CORNER (FIXED #1761): the activity endpoint maps a missing required query param to a clean 400', async ({
    request,
  }) => {
    // FLIPPED 2026-06-11 per this pin's own pre-authored protocol (it asserted the 500 and named
    // the flip condition): the ControllerAdvice ResponseStatusException pass-through (#1760/#1761,
    // CTRIB-005) keeps the framework's 400 BAD_REQUEST ("Required query parameter 'begin_date' is
    // not present.") instead of the catch-all's 500 SYS001. The unit guard for this exact surface
    // is FrameworkErrorStatusMappingTest.missingRequiredQueryParamKeepsFramework400 (odd-platform CI).
    const res = await request.get(`${BASE}/api/activity?type=ALL&size=5`); // no begin_date / end_date
    expect(
      res.status(),
      'F-064 CORNER: a missing required query parameter on /api/activity is the client\'s 400 (USR001), ' +
        'not a platform 500 — fixed by the advice pass-through (#1761).',
    ).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code, 'the 400 carries the user-error code USR001, not SYS001').toBe('USR001');
  });
});

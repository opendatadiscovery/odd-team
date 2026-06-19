import { test, expect, type Page } from '@playwright/test';
import {
  ensureNamespace,
  cleanupLookupTablesByPrefix,
  createLookupTable,
  updateLookupTable,
  getEntityActivity,
  catalogRow,
} from '../helpers/lookup';

/**
 * IT-137 — F-059 Lookup Table Rename Audit Trail (PLT-057 / #1753 Defect 2).
 *
 * Protocol: integration-tests/protocols/IT-137-lookup-rename-activity.md
 * Gates: regresses PLT-057 D2 (rename emitted no ActivityEvent). validates F-059.
 *
 * Renaming a lookup table runs `ALTER TABLE ... RENAME TO` on the documented public
 * `lookup_tables_schema` surface (IT-048 pins that data-loss cascade). Before the fix, that mutation
 * emitted NO activity event (ReferenceDataServiceImpl.updateLookupTable had no @ActivityLog, and
 * ActivityEventTypeDto had no LOOKUP_TABLE_RENAMED slot), so "who renamed which table when" was
 * unanswerable from the platform. The fix annotates the service method + adds a handler that captures
 * the lookup table's display name (old + new) keyed to its backing data entity, so the activity feed
 * records "Table name was updated from <old> to <new>".
 *
 * This test drives the REAL rename via the API (not a SQL-seeded activity row) so the activity ASPECT
 * fires — the only way to prove the emission. RED on main (no event); GREEN on the fix.
 * RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-137`.
 *
 * Stack: odd-minimal, AUTH_TYPE=DISABLED. Namespace it137_ns; names it137_*; ids read back from the API.
 */
const NS = 'it137_ns';
const RENAMED = 'LOOKUP_TABLE_RENAMED';

const activityFetch = (page: Page) =>
  page.waitForResponse(
    r => /\/api\/activity(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok()
  );

// The UI default window is now-5d .. now+1d (Activity/common.ts); build the same as epoch-ms params.
function activityQuery(): string {
  const begin = new Date();
  begin.setDate(begin.getDate() - 5);
  begin.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return `beginDate=${begin.getTime()}&endDate=${end.getTime()}&size=30&type=ALL`;
}

test.describe('F-059 Lookup Table Rename Audit Trail — the rename emits a LOOKUP_TABLE_RENAMED event', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'it137_');
  });

  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'it137_');
  });

  test('UC-001: a rename emits one LOOKUP_TABLE_RENAMED event carrying old -> new name', async ({
    page,
    request,
  }) => {
    // ---- arrange: a lookup table with a backing data entity ----
    const lt = await createLookupTable(request, {
      name: 'it137_customer_lookups',
      namespace_name: NS,
      description: 'audit repro',
    });
    const row = await catalogRow(lt.table_id);
    const dataEntityId = row?.data_entity_id;
    expect(dataEntityId, 'the lookup table must have a backing data entity').toBeTruthy();

    // pre-condition: no rename event yet (proves the event below is caused by the rename)
    const before = await getEntityActivity(request, dataEntityId as number);
    expect(
      before.filter(e => e.event_type === RENAMED),
      'no rename event before the rename'
    ).toHaveLength(0);

    // ---- act: rename via the REAL API (the path the UI edit form drives -> the activity aspect) ----
    expect(
      await updateLookupTable(request, lt.table_id, {
        name: 'it137_customer_lookup_codes',
        description: 'audit repro',
      }),
      'rename PUT -> 200'
    ).toBe(200);

    // ---- assert (API — the emission, the core fix): exactly one rename event with old -> new name ----
    const after = await getEntityActivity(request, dataEntityId as number);
    const renames = after.filter(e => e.event_type === RENAMED);
    expect(renames, 'the rename must emit exactly one LOOKUP_TABLE_RENAMED event').toHaveLength(1);
    expect(renames[0].old_state?.lookup_table_name?.name, 'old state carries the pre-rename name').toBe(
      'it137_customer_lookups'
    );
    expect(renames[0].new_state?.lookup_table_name?.name, 'new state carries the post-rename name').toBe(
      'it137_customer_lookup_codes'
    );

    // ---- assert (UI — the feed renders it): the global Activity page shows the renamed entity ----
    const fetched = activityFetch(page);
    await page.goto(`/activity?${activityQuery()}`);
    await fetched;
    await expect(
      page.getByText('it137_customer_lookup_codes').first(),
      'the global Activity feed must render the renamed lookup table'
    ).toBeVisible({ timeout: 10_000 });
  });

  test('UC-002: a description-only edit (name unchanged) emits NO rename event (guard)', async ({
    request,
  }) => {
    const lt = await createLookupTable(request, {
      name: 'it137_stable_name',
      namespace_name: NS,
      description: 'before',
    });
    const row = await catalogRow(lt.table_id);
    const dataEntityId = row?.data_entity_id as number;

    // edit ONLY the description; the name (and so the captured state) is unchanged -> the aspect's
    // oldState == newState guard suppresses the event. A metadata-only edit is not a rename.
    expect(
      await updateLookupTable(request, lt.table_id, {
        name: 'it137_stable_name',
        description: 'after',
      }),
      'description-only edit -> 200'
    ).toBe(200);

    const events = await getEntityActivity(request, dataEntityId);
    expect(
      events.filter(e => e.event_type === RENAMED),
      'a description-only edit must NOT emit a LOOKUP_TABLE_RENAMED event'
    ).toHaveLength(0);
  });
});

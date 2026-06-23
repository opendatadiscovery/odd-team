import { test, expect } from '@playwright/test';
import {
  ensureNamespace,
  cleanupLookupTablesByPrefix,
  createLookupTable,
  updateLookupTable,
} from '../helpers/lookup';

/**
 * IT-140 — F-026 Lookup Tables: the create/edit Description reaches the entity Overview (#1781).
 *
 * Protocol: integration-tests/protocols/IT-140-lookup-description-on-overview.md
 *
 * Regresses odd-platform#1781: the lookup-table Description was stored on lookup_tables only and
 * never propagated to the associated Data Entity, so the entity Overview's description was empty —
 * a quiet waste of the operator's curation effort. The fix treats a lookup table as a source
 * auto-ingested into the catalog, so its description is the entity's EXTERNAL (source) description
 * (DataEntityMapperImpl.mapCreatedLookupTablePojo on create + applyToPojo on update), which the
 * Overview already renders (OverviewDescription -> ExternalDescription). The catalog's own INTERNAL
 * description (the term-linkable About editor) is left independent — verified untouched by the unit
 * test; term-linking itself is unchanged and covered by IT-081.
 *
 * RED on ref:main: external_description stays null -> ExternalDescription renders nothing -> the
 * marker is absent (the create/edit assertions fail). GREEN on the working tree: external_description
 * is set -> the marker is visible. Drives the REAL create/update API (the bug's own path), not a DB
 * seed, so it exercises the propagation end-to-end.
 *
 * Collision-free: namespace it140_ns, names prefixed it140_, entity id read back from the create
 * response (DB-serial — never hardcoded).
 */
const NS = 'it140_ns';
const CREATE_MARKER = 'IT140 lookup description marker on create';
const UPDATE_MARKER = 'IT140 lookup description marker after edit';

const detailFetch = (page: import('@playwright/test').Page, id: number) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${id}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-026 Lookup Tables — the description reaches the entity Overview (#1781)', () => {
  test.beforeEach(async ({ request }) => {
    await ensureNamespace(NS);
    await cleanupLookupTablesByPrefix(request, 'it140_');
  });

  test.afterAll(async ({ request }) => {
    await cleanupLookupTablesByPrefix(request, 'it140_');
  });

  test('a description set at create renders on the entity Overview', async ({ page, request }) => {
    const lt = await createLookupTable(request, {
      name: 'it140_with_desc',
      namespace_name: NS,
      description: CREATE_MARKER,
    });

    const detail = detailFetch(page, lt.dataset_id);
    await page.goto(`/dataentities/${lt.dataset_id}/overview`);
    await detail;

    await expect(
      page.getByText(CREATE_MARKER).first(),
      'the lookup-table description must render on the entity Overview',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('editing the lookup-table description updates the Overview', async ({ page, request }) => {
    const lt = await createLookupTable(request, {
      name: 'it140_edit_desc',
      namespace_name: NS,
      description: CREATE_MARKER,
    });
    const status = await updateLookupTable(request, lt.table_id, {
      name: 'it140_edit_desc',
      description: UPDATE_MARKER,
    });
    expect(status, 'update lookup table -> 200').toBe(200);

    const detail = detailFetch(page, lt.dataset_id);
    await page.goto(`/dataentities/${lt.dataset_id}/overview`);
    await detail;

    await expect(
      page.getByText(UPDATE_MARKER).first(),
      'the edited lookup-table description must render on the entity Overview',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(CREATE_MARKER),
      'the superseded description must no longer render',
    ).toHaveCount(0);
  });

  test('a lookup table with no description renders no marker (negative)', async ({ page, request }) => {
    const lt = await createLookupTable(request, { name: 'it140_no_desc', namespace_name: NS });

    const detail = detailFetch(page, lt.dataset_id);
    await page.goto(`/dataentities/${lt.dataset_id}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(CREATE_MARKER),
      'no description set -> no marker on the Overview',
    ).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-068 — F-148 Search Result Class-Tab Filter (the tab strip atop /search results).
 *
 * Protocol: integration-tests/protocols/IT-068-search-class-tab-filter.md
 * Gates: validates F-148 (UC-001 — clicking the Datasets tab narrows the result list to dataset-class
 *        entities); regresses PLT-147 (transformer-class entity NPEs the results list — RED-on-fix pin).
 *
 * The 9-tab strip (All / My Objects / Datasets / Transformers / ...) is a distinct UX surface from the
 * 7-facet sidebar (SearchResultsTabs.tsx). A class tab carries the numeric backend class id as its value
 * (SearchResultsTabs.tsx:29-31 — `value: totals[DataEntityClassNameEnum.SET]?.id`); clicking it dispatches
 * a facet mutation on the `entityClasses` facet (Results.tsx:83-100) that flows through the F-017 backbone
 * (PUT /api/search/{id}/facets -> re-fetch). Verified live: applying entityClasses=[SET] to a session with
 * a dataset + a group (same term) returns ONLY the dataset.
 *
 * GROUND TRUTH: the tab renders as a MUI Tab (role="tab") whose label is the literal "Datasets" string
 * (SearchResultsTabs.tsx:29 — no t() wrapping) plus a catalog-wide count hint. The class-id facet semantics
 * are read from SearchResultsTabs.tsx + Results.tsx and confirmed against the live PUT-facets round-trip.
 * react-query caveat: every search/facet results GET is awaited before asserting.
 *
 * Class choice for the SUCCESS test: DATA_SET (class 1) vs DATA_ENTITY_GROUP (class 8). Both render cleanly
 * through DataEntityMapperImpl. The obvious second class — DATA_TRANSFORMER (class 2) — was DISQUALIFIED
 * for the happy path because it triggers a real platform bug (see the second test): the mapper NPEs on a
 * transformer whose details DTO is null, 500ing the whole results list.
 *
 * Namespace: ids 20680-20689 · oddrn //e2e-it068/ · names it068_*
 */
const DATASET_ID = 20680;
const GROUP_ID = 20681;
const TRANSFORMER_ID = 20682;
// Two tests, two DISJOINT FTS tokens — the characterization test seeds a transformer that 500s the
// results list (PLT-147); if it shared a search token with the success test, the success test's search
// would also match that transformer and 500. `it068setgrp` and `it068xfmpin` tokenize independently.
const SUCCESS_TERM = 'it068setgrp';
const DATASET_NAME = `${SUCCESS_TERM}_dataset`;
const GROUP_NAME = `${SUCCESS_TERM}_group`;
const PIN_TERM = 'it068xfmpin';
const TRANSFORMER_NAME = `${PIN_TERM}_transformer`;

// db.ts has no class-parameterised search seeder and must not be edited. Seed a non-DATA_SET searchable
// entity + its FTS vector directly with dbQuery using OUR ids (no collision with parallel agents).
// classIds e.g. '{8}' (DATA_ENTITY_GROUP) / '{2}' (DATA_TRANSFORMER); typeId e.g. 17 (DAG) / 5 (JOB).
async function seedSearchableOfClass(
  id: number,
  name: string,
  classIds: string,
  typeId: number,
): Promise<void> {
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, 2001, $5, $4, 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = EXCLUDED.entity_class_ids, type_id = EXCLUDED.type_id`,
    [id, `//e2e-it068/db/${id}`, name, classIds, typeId],
  );
  await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = $1', [id]);
  await dbQuery(
    `INSERT INTO search_entrypoint (data_entity_id, data_entity_vector) VALUES ($1, to_tsvector('english', $2))`,
    [id, name],
  );
}

const resultsFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/search\/[0-9a-f-]+\/results/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

// Any results GET, regardless of status — used by the characterization pin to observe the 500.
const anyResultsResponse = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/search\/[0-9a-f-]+\/results/.test(r.url()) && r.request().method() === 'GET',
  );

async function typeQuery(page: import('@playwright/test').Page, query: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(query);
  await box.press('Enter'); // the main catalog search box searches on Enter
}

test.describe('F-148 Search Class-Tab Filter — narrows results by entity class', () => {
  test('clicking the Datasets tab filters the results to dataset-class entities', async ({ page }) => {
    await seedSearchableEntity(DATASET_ID, DATASET_NAME); // DATA_SET class {1}, type TABLE
    await seedSearchableOfClass(GROUP_ID, GROUP_NAME, '{8}', 17); // DATA_ENTITY_GROUP class {8}, type DAG

    await page.goto('/search');
    await typeQuery(page, SUCCESS_TERM);

    const datasetRow = page.getByTestId('search-result-item').filter({ hasText: DATASET_NAME });
    const groupRow = page.getByTestId('search-result-item').filter({ hasText: GROUP_NAME });

    // ---- precondition: the All tab shows BOTH classes (poll the rendered rows; react-query retries a
    //      cold-session GET, so we wait for the UI to settle rather than racing a single response) ----
    await expect(datasetRow, 'the dataset must appear under the All tab').toBeVisible({ timeout: 15_000 });
    await expect(groupRow, 'the group must appear under the All tab').toBeVisible({ timeout: 15_000 });

    // ---- act: click the "Datasets" class tab (a facet mutation -> re-fetch) ----
    const datasetsTab = page.getByRole('tab', { name: /Datasets/ });
    await expect(datasetsTab, 'the Datasets class tab must be present in the tab strip').toBeVisible();
    await datasetsTab.click();

    // ---- assert: the result set is now scoped to the dataset class. We assert on the rendered outcome
    //      (group gone, dataset kept) which only holds AFTER the facet PUT + re-fetch land — no need to
    //      latch onto a specific response, which is racy on a freshly-seeded cold session. ----
    await expect(
      groupRow,
      'the group-class entity must be filtered OUT by the Datasets tab',
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(
      datasetRow,
      'the dataset-class entity must remain after the Datasets tab is applied',
    ).toBeVisible({ timeout: 15_000 });
  });

  // KNOWN BUG (PLT-147): DataEntityMapperImpl.mapPojo (DataEntityMapperImpl.java:99, via mapPojos:175)
  // dereferences dto.getDataTransformerDetailsDto().sourceList() with NO null guard. A DATA_TRANSFORMER
  // (class {2}) entity whose details DTO is null therefore NPEs -> the whole search-results GET 500s
  // (SYS001). The DATA_SET branch is null-safe (mapStats tolerates null) and DATA_ENTITY_GROUP is
  // explicitly guarded; transformer + quality-test are not. This is a LSN-029 characterization pin:
  // GREEN today (asserts the CURRENT broken behaviour), flips RED when the mapper is null-guarded
  // (then the row renders and the GET returns 200). DO NOT "fix" this test to assert the ideal.
  test('CHARACTERIZATION (PLT-147): a transformer-class result currently 500s the list and renders no row', async ({
    page,
  }) => {
    await seedSearchableOfClass(TRANSFORMER_ID, TRANSFORMER_NAME, '{2}', 5); // DATA_TRANSFORMER class {2}, type JOB

    await page.goto('/search');
    const resultsResp = anyResultsResponse(page);
    await typeQuery(page, TRANSFORMER_NAME);
    const resp = await resultsResp;

    // ---- ground truth: the results GET currently 500s on the transformer-class entity ----
    expect(
      resp.status(),
      'PLT-147: the results GET currently 500s on a transformer-class entity (NPE in DataEntityMapperImpl). ' +
        'If this is now 200, the mapper was fixed — flip this pin to assert the row renders.',
    ).toBeGreaterThanOrEqual(500);

    // ---- what the user sees: NO result row for the transformer (the list failed to render) ----
    await expect(
      page.getByTestId('search-result-item').filter({ hasText: TRANSFORMER_NAME }),
      'PLT-147: the transformer entity does not render as a result row (the list 500d)',
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

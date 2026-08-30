import { test, expect } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-068 — F-148 Search Result Class-Tab Filter (the tab strip atop /search results).
 *
 * Protocol: integration-tests/protocols/IT-068-search-class-tab-filter.md
 * Gates: validates F-148 (UC-001 — clicking the Datasets tab narrows the result list to dataset-class
 *        entities); regresses PLT-147/#1755 (FIXED 2026-06-12: a null-details transformer used to NPE
 *        the results list AND the detail page; the former GREEN-while-broken pin is re-grounded to a
 *        regression lock asserting both surfaces work — LSN-029 flip, CTRIB-009).
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
 * through DataEntityMapperImpl. The obvious second class — DATA_TRANSFORMER (class 2) — was originally
 * DISQUALIFIED for the happy path because it triggered PLT-147 (the mapper NPEd on a transformer whose
 * details DTO is null, 500ing the whole results list). That bug is FIXED (#1755, 2026-06-12); the class
 * choice stays as-is — the second test now locks the transformer contract end-to-end on its own.
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
  // Clean ALL three seeds up. History: while PLT-147 was open, a leftover class-2 transformer with NULL
  // specific_attributes (id 20682) was TOXIC to the shared stack — an EMPTY-query search matches every
  // entity, so the poisoned row 500d the plain Catalog page for ALL later users (maintainer hit it live,
  // 2026-06-11 — CTRIB-005). The #1755 null-guard fix removed the 500, but seed hygiene stays: leftover
  // rows still pollute other specs' counts and empty-query result pages.
  test.afterAll(async () => {
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [DATASET_ID, GROUP_ID, TRANSFORMER_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [
      [DATASET_ID, GROUP_ID, TRANSFORMER_ID],
    ]);
  });

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

    // ---- act: apply the "Datasets" entity class (a facet write -> re-fetch) ----
    // RE-POINTED by ST-8 (#1842 / CTRIB-062): this clicked the "Datasets" CLASS TAB. ST-4 retired the seven
    // class tabs (class selection became the Data-entity-type sidebar filter) and ST-8 retired the last one,
    // so the tab strip no longer exists. The claim under test — selecting the Datasets class narrows the
    // results to dataset-class entities — is unchanged and is asserted on the same rendered outcome; only
    // the control the user reaches for has moved. The PLT-147 regression lock below is untouched.
    await page.locator('#filter-entityClasses').click();
    await page.getByRole('option', { name: 'Datasets', exact: true }).click();

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

  // REGRESSION LOCK (PLT-147 / #1755 — FIXED): DataEntityMapperImpl used to dereference
  // dto.getDataTransformerDetailsDto().sourceList() with NO null guard (mapPojo:99 via mapPojos, and
  // mapDtoDetails:298 on the detail path). A DATA_TRANSFORMER (class {2}) entity whose details DTO is
  // null (entity_class_ids says transformer, specific_attributes has no transformer block) NPEd -> the
  // WHOLE search-results GET (and the entity-detail GET) 500d SYS001. This test was the LSN-029
  // characterization pin of that behaviour (GREEN-while-broken, asserting >=500 + no row); it flipped
  // RED on the null-guard fix and is RE-GROUNDED here (2026-06-12, CTRIB-009) to lock the FIXED
  // contract on BOTH #1755 surfaces: the results list renders the transformer row (200), and clicking
  // through, its detail page loads (200). The seed shape is unchanged — exactly the null-details row
  // that used to kill both pages.
  test('REGRESSION (PLT-147 fixed): a transformer-class result renders in the list and its detail page loads', async ({
    page,
  }) => {
    await seedSearchableOfClass(TRANSFORMER_ID, TRANSFORMER_NAME, '{2}', 5); // DATA_TRANSFORMER class {2}, type JOB

    await page.goto('/search');
    const resultsResp = anyResultsResponse(page);
    await typeQuery(page, TRANSFORMER_NAME);
    const resp = await resultsResp;

    // ---- the fixed contract: the results GET succeeds on a null-details transformer ----
    expect(
      resp.status(),
      'PLT-147 regression: the results GET must be 200 on a transformer-class entity whose details DTO ' +
        'is null (a >=500 here means the DataEntityMapperImpl null-guard regressed — see #1755)',
    ).toBe(200);

    // ---- what the user sees: the transformer renders as a result row (empty Sources/Targets cells) ----
    const row = page.getByTestId('search-result-item').filter({ hasText: TRANSFORMER_NAME });
    await expect(
      row,
      'PLT-147 regression: the transformer entity must render as a result row',
    ).toBeVisible({ timeout: 15_000 });

    // ---- the second #1755 surface: the detail page (mapDtoDetails) loads for the same entity ----
    const detailResp = page.waitForResponse(
      (r) =>
        new RegExp(`/api/dataentities/${TRANSFORMER_ID}$`).test(r.url()) && r.request().method() === 'GET',
    );
    await row.getByText(TRANSFORMER_NAME).click(); // the whole row navigates (ResultItem onClick)
    expect(
      (await detailResp).status(),
      'PLT-147 regression: the entity-detail GET must be 200 for a null-details transformer (mapDtoDetails path)',
    ).toBe(200);
    await expect(
      page.getByText(TRANSFORMER_NAME).first(),
      'PLT-147 regression: the detail page renders the entity (header shows the name)',
    ).toBeVisible({ timeout: 15_000 });
  });
});

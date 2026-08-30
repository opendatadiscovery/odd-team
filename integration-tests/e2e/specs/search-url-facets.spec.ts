import { test, expect, type Page } from '@playwright/test';
import { seedSearchableEntity, dbQuery } from '../helpers/db';

/**
 * IT-151 — F-017 search FACETS in the URL (ADR D10; slice ST-1b of the #1825 overhaul, CTRIB-049).
 *
 * Protocol: integration-tests/protocols/IT-151-search-url-facets.md
 * Gates: validates F-017 (the 8 facets + My Objects live in the URL, so a FACETED search is shareable,
 *        bookmarkable, and back/forward-correct — layered on ST-1a's query-URL); regresses the ST-1b
 *        facet-URL contract.
 *
 * ST-1b moves the FACETS into the URL. Applying an entity-class narrowing navigates to the canonical
 * /search?…&entityClasses[]=<id>; the page runs the filtered search FROM the URL; a shared/bookmarked faceted
 * URL reproduces it with no prior session; back/forward navigate facet states; and REMOVING the facet drops
 * it from the URL and broadens the results (the round-2 removal path — a plain server merge could never
 * remove it, which is why the reader CREATEs a fresh session per URL state = the REPLACE path).
 *
 * RE-POINTED by ST-8 (#1842 / CTRIB-062). This test used the on-page CLASS TAB as its write surface; ST-4
 * retired the seven class tabs and ST-8 retired the last one, so the tab strip no longer exists. The write
 * surface is now the **Data entity type** filter in the sidebar (`DataEntityTypeFilter`, `#filter-entityClasses`),
 * which is where class selection lives since ST-4 — and which carries the SAME URL contract. The assertions
 * are unchanged in substance and strength: apply -> the facet is in the URL and the other class drops out;
 * remove -> the facet leaves the URL and the other class returns. Still RED on ref:main (CTRIB-049 base,
 * f63d3915), where no facet reaches the URL at all.
 *
 * RED on ref:main (CTRIB-049 base, f63d3915): a class tab dispatches a PUT /facets that never touches the
 * URL, so no facet reaches the URL and a faceted deep-link is meaningless. GREEN on the working-tree SUT.
 *
 * Namespace: ids 21500-21509 · oddrn //e2e-it150f/ · names it150facets_*
 */
const TERM = 'it150facets';
const DATASET_ID = 21500;
const GROUP_ID = 21501;
const DATASET_NAME = `${TERM}_dataset`;
const GROUP_NAME = `${TERM}_group`;

// db.ts has no class-parameterised seeder and must not be edited (IT-068 precedent). Seed a non-DATA_SET
// searchable entity + its FTS vector directly with OUR ids. classIds '{8}' = DATA_ENTITY_GROUP; typeId 17 = DAG.
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
    [id, `//e2e-it150f/db/${id}`, name, classIds, typeId],
  );
  await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = $1', [id]);
  await dbQuery(
    `INSERT INTO search_entrypoint (data_entity_id, data_entity_vector) VALUES ($1, to_tsvector('english', $2))`,
    [id, name],
  );
}

// query-string serialises the class facet as entityClasses[]=<id> (bracket-separator); the browser may
// percent-encode the brackets. Match either form + a numeric id — the id itself is captured, never hardcoded.
const FACET_IN_URL = /entityClasses(\[\]|%5B%5D)=\d+/;

async function runSearch(page: Page, term: string): Promise<void> {
  const box = page.getByPlaceholder('Search', { exact: true });
  await box.fill(term);
  await box.press('Enter');
}

// ST-8 re-point: class selection is the sidebar Data-entity-type multiselect (an autocomplete + removable
// chips — FixedOptionsMultiFilter), not the retired tab strip. Selecting opens the autocomplete and picks the
// option; deselecting clicks the "x" on the rendered chip, the direct analogue of the old "All" tab.
async function selectEntityClass(page: Page, className: string): Promise<void> {
  await page.locator('#filter-entityClasses').click();
  await page.getByRole('option', { name: className, exact: true }).click();
}

async function deselectEntityClass(page: Page, className: string): Promise<void> {
  await page.getByTitle(className, { exact: true }).locator('..').getByRole('button').click();
}

const datasetRowOf = (page: Page) =>
  page.getByTestId('search-result-item').filter({ hasText: DATASET_NAME });
const groupRowOf = (page: Page) =>
  page.getByTestId('search-result-item').filter({ hasText: GROUP_NAME });

// B1 (rework) — the SIDEBAR facets + statuses. `tags` is a non-immune ECHOED facet (unlike the class tab):
// deselecting it must re-sync so the results refetch. `statuses` was never echoed → its chip never rendered.
const TAG_IN_URL = /tags(\[\]|%5B%5D)=\d+/;
const STATUS_IN_URL = /statuses(\[\]|%5B%5D)=\d+/;

// Seed a tag linked to the DATASET only, so tags[]=<id> narrows to it (the group has no tag). Returns the id —
// captured at runtime, never hardcoded (tag ids are auto-increment). SELECT-then-INSERT (tag.name not a reliable
// unique constraint — the db.ts seedEntityTag precedent) + DELETE-then-INSERT the link; idempotent.
async function seedTagOnDataset(tagName: string): Promise<number> {
  const existing = await dbQuery<{ id: number }>('SELECT id FROM tag WHERE name = $1 LIMIT 1', [tagName]);
  const tagId = existing[0]?.id
    ?? (await dbQuery<{ id: number }>(
      'INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id', [tagName]))[0].id;
  await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1 AND tag_id = $2', [DATASET_ID, tagId]);
  await dbQuery('INSERT INTO tag_to_data_entity (tag_id, data_entity_id, external) VALUES ($1, $2, false)',
    [tagId, DATASET_ID]);
  return Number(tagId);
}

// B1 — give the two entities distinct lifecycle statuses so statuses[]=3 (STABLE) narrows to the dataset.
// DataEntityStatusDto: STABLE=3, DEPRECATED=4 (data_entity.status smallint; DELETED=5 hides the entity).
async function seedDistinctStatuses(): Promise<void> {
  await dbQuery('UPDATE data_entity SET status = 3 WHERE id = $1', [DATASET_ID]); // STABLE
  await dbQuery('UPDATE data_entity SET status = 4 WHERE id = $1', [GROUP_ID]); // DEPRECATED
}

test.describe('F-017 search URL state — facets in the URL (ST-1b / D10)', () => {
  test.beforeEach(async () => {
    await seedSearchableEntity(DATASET_ID, DATASET_NAME); // DATA_SET class {1}, type TABLE
    await seedSearchableOfClass(GROUP_ID, GROUP_NAME, '{8}', 17); // DATA_ENTITY_GROUP class {8}
  });
  test.afterAll(async () => {
    // the tag link (case A/B seeds) references data_entity — clear it first or the entity DELETE hits the FK
    await dbQuery('DELETE FROM tag_to_data_entity WHERE data_entity_id = ANY($1::bigint[])', [
      [DATASET_ID, GROUP_ID],
    ]);
    await dbQuery('DELETE FROM tag WHERE name = $1', [`${TERM}_tag`]);
    await dbQuery('DELETE FROM search_entrypoint WHERE data_entity_id = ANY($1::bigint[])', [
      [DATASET_ID, GROUP_ID],
    ]);
    await dbQuery('DELETE FROM data_entity WHERE id = ANY($1::bigint[])', [[DATASET_ID, GROUP_ID]]);
  });

  test('a class tab writes the facet to the URL + refilters; the All tab removes it (round-1 write + round-2 removal)', async ({
    page,
  }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);

    await page.goto('/search');
    await runSearch(page, TERM);
    await expect(datasetRow, 'the dataset appears under All').toBeVisible({ timeout: 15_000 });
    await expect(groupRow, 'the group appears under All').toBeVisible({ timeout: 15_000 });

    // apply the Datasets entity class from the sidebar — ST-1b serialises the facet into the URL
    // (RED on main: no URL change). The class TAB this used to click was retired by ST-8.
    await selectEntityClass(page, 'Datasets');
    await expect(page, 'the class facet is serialised into the URL').toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'the group class is filtered out').toHaveCount(0, { timeout: 15_000 });
    await expect(datasetRow, 'the dataset class remains').toBeVisible();

    // remove the facet by deselecting the chip — it leaves the URL AND the results broaden (round-2 removal:
    // the reader CREATEs a fresh session per URL state = REPLACE, so a dropped facet is genuinely removed).
    // This is the direct analogue of the retired "All" tab, on the control that replaced it.
    await deselectEntityClass(page, 'Datasets');
    await expect(page, 'the facet is removed from the URL').not.toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'the group returns once the facet is cleared').toBeVisible({
      timeout: 15_000,
    });
    await expect(datasetRow).toBeVisible();
  });

  test('a faceted URL is shareable and back/forward navigates facet states', async ({ page }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);

    await page.goto('/search');
    await runSearch(page, TERM);
    await expect(datasetRow).toBeVisible({ timeout: 15_000 });
    await selectEntityClass(page, 'Datasets');
    await expect(page).toHaveURL(FACET_IN_URL, { timeout: 15_000 });
    await expect(groupRow).toHaveCount(0, { timeout: 15_000 });
    const facetedUrl = page.url();

    // share/bookmark: open the faceted URL fresh (no prior session) — the filtered search reproduces.
    const fresh = await page.context().newPage();
    await fresh.goto(facetedUrl);
    await expect(
      fresh.getByTestId('search-result-item').filter({ hasText: DATASET_NAME }),
      'the shared faceted URL reproduces the dataset match',
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      fresh.getByTestId('search-result-item').filter({ hasText: GROUP_NAME }),
      'the shared faceted URL keeps the group filtered out',
    ).toHaveCount(0, { timeout: 15_000 });
    await fresh.close();

    // back/forward: Back to the unfiltered query, Forward re-applies the facet.
    await page.goBack();
    await expect(page, 'Back leaves the facet URL').not.toHaveURL(FACET_IN_URL, { timeout: 15_000 });
    await expect(groupRow, 'Back re-runs the unfiltered query (group returns)').toBeVisible({
      timeout: 15_000,
    });
    await page.goForward();
    await expect(page, 'Forward re-applies the facet URL').toHaveURL(FACET_IN_URL, {
      timeout: 15_000,
    });
    await expect(groupRow, 'Forward re-applies the facet (group filtered out)').toHaveCount(0, {
      timeout: 15_000,
    });
  });

  // B1 (rework) — a SIDEBAR-facet deselect must re-sync so the results refetch. RED on ref:f89c9a65 (ST-1b with
  // B1): the deselected tag is carried as a phantom → isFacetsStateSynced stranded false → Results.tsx never
  // refetches → the group never returns (and the still-armed mirror can revert a later navigation).
  test('a sidebar facet + Clear All reloads the results (no stranded sync, no revert)', async ({ page }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);
    const tagId = await seedTagOnDataset(`${TERM}_tag`);

    // a shareable link carrying a sidebar TAG facet — only the tagged dataset (the group has no tag).
    await page.goto(`/search?q=${TERM}&tags[]=${tagId}`);
    await expect(datasetRow, 'the tagged dataset is shown').toBeVisible({ timeout: 15_000 });
    await expect(groupRow, 'the untagged group is filtered out').toHaveCount(0, { timeout: 15_000 });
    await expect(page, 'the tag facet is in the URL').toHaveURL(TAG_IN_URL, { timeout: 15_000 });

    // Clear All removes the facet — the results MUST broaden (the group returns), proving the create response
    // re-synced and Results.tsx refetched.
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page, 'the tag facet leaves the URL').not.toHaveURL(TAG_IN_URL, { timeout: 15_000 });
    await expect(groupRow, 'the group returns once the facet is cleared (results refetched)').toBeVisible({
      timeout: 15_000,
    });
    await expect(datasetRow).toBeVisible();

    // no-revert (W2): the still-un-synced mirror must NOT re-navigate back to the tag link (> the 400ms debounce).
    await page.waitForTimeout(1_000);
    await expect(page, 'the cleared URL is not reverted by a stale mirror write').not.toHaveURL(TAG_IN_URL);

    // W2 fold-in — Back AFTER the deselect lands on the tagged state and STAYS there: the tagged result
    // reproduces (the create re-synced) and no stale debounced mirror write bounces the URL afterwards.
    await page.goBack();
    await expect(page, 'Back returns to the tagged URL').toHaveURL(TAG_IN_URL, { timeout: 15_000 });
    await expect(groupRow, 'the tag filter re-applies (group filtered out)').toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(datasetRow).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(page, 'the restored URL is not bounced by a stale mirror write').toHaveURL(TAG_IN_URL);
  });

  // B1 (rework) — `statuses` is a REAL sidebar facet the server filters on but never echoed back
  // (FacetStateMapperImpl.mapDto omitted it), so selecting a status stranded `isFacetsStateSynced` and froze
  // the results. Wire shapes captured live: options = {id:3,name:'STABLE'} (ids = DataEntityStatusDto);
  // the URL-derived create echoes the request's names (null) — the chip label must survive that echo.
  test('a status filter narrows results, keeps its chip label, and deep-links (echo + label-preserve)', async ({
    page,
  }) => {
    const datasetRow = datasetRowOf(page);
    const groupRow = groupRowOf(page);
    await seedDistinctStatuses(); // dataset STABLE(3) · group DEPRECATED(4)

    // ---- select flow: pick STABLE in the Statuses sidebar facet ----
    await page.goto(`/search?q=${TERM}`);
    await expect(datasetRow, 'both entities visible before filtering').toBeVisible({ timeout: 15_000 });
    await expect(groupRow).toBeVisible({ timeout: 15_000 });

    await page.locator('#filter-statuses').click();
    await page.getByRole('option', { name: 'STABLE' }).click();

    // the committed status reaches the URL and refilters server-side (RED on the B1 build: the un-echoed
    // status strands `synced` → Results.tsx never refetches → the group never disappears).
    await expect(page, 'the status facet reaches the URL').toHaveURL(STATUS_IN_URL, { timeout: 15_000 });
    await expect(groupRow, 'DEPRECATED group is filtered out').toHaveCount(0, { timeout: 15_000 });
    await expect(datasetRow, 'STABLE dataset remains').toBeVisible();

    // the chip label survives the settle: the URL-derived create echoes name:null, and the reducer must keep
    // the label it already knows (RED without the label-preserving merge: the chip blanks ~1s after select).
    await page.waitForTimeout(2_000);
    await expect(page.getByTitle('STABLE'), 'the STABLE chip is still labelled after the create settles')
      .toBeVisible();
    // #1835 — the chip renders the RAW facet value (STABLE), not TextFormatted's capitalized "Stable"
    // (which diverged from the sidebar dropdown option showing the raw enum). RED on ref:main (chip
    // text "Stable") -> GREEN on the fix.
    await expect(page.getByTitle('STABLE'), 'the chip renders the raw value, matching the dropdown')
      .toHaveText('STABLE');
    await expect(groupRow, 'the filtered results did not revert').toHaveCount(0);

    // ---- deep-link flow: the same state reproduces fresh from the URL ----
    await page.goto(`/search?q=${TERM}&statuses[]=3`);
    await expect(datasetRow, 'the status-filtered dataset renders (results settle)').toBeVisible({
      timeout: 15_000,
    });
    await expect(groupRow, 'the DEPRECATED group is filtered out on the deep-link').toHaveCount(0, {
      timeout: 15_000,
    });
    // ST-1d — a FRESH faceted deep-link now renders LABELLED chips. The URL carries the status id only, and the
    // server resolves facet names in the echo (SearchServiceImpl.resolveFacetNames → the SearchFilter.name the FE
    // chip reads). RED on ref:main (ab63b6d3 echoed name:null → the chip had no title) → GREEN on the ST-1d fix.
    await expect(page.getByTitle('STABLE'), 'the deep-linked status chip is labelled (server-resolved echo)')
      .toBeVisible({ timeout: 15_000 });
  });
});

import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-070 — F-023 Directory: hierarchy-driven catalog browse via ODDRN-prefix grouping.
 *
 * Protocol: integration-tests/protocols/IT-070-directory-hierarchy-browse.md
 * Gates: validates F-023 (the /directory hierarchy renders the data-source-type cards and,
 *        on drill-down, each registered instance with its ODDRN-derived connection properties).
 *
 * The Directory is the catalog's HIERARCHY-driven browse surface (vs Search's query-driven one).
 * Level 1 (`GET /api/directory`, Directory.tsx) renders ONE CARD PER ODDRN PREFIX, each with the
 * catalog-wide entity count (DirectoryItem.tsx renders name + pluralize(count, 'entity','entities')).
 * Level 2 (`GET /api/directory/datasources?prefix=...`, DataSourceList.tsx) lists each registered
 * instance; its table columns are DERIVED from the response's `properties` object — so the
 * ODDRN-reflected connection properties (host/database for Postgres) become VISIBLE table cells
 * (the `oddrn_reflection_infrastructure_property_leak` facet, confirmed at the UI rendering tier).
 *
 * GROUND-TRUTH (curled live 2026-06-07): a data source with a postgres-shaped oddrn
 * `//postgresql/host/<host>/databases/<db>` parses to prefix `postgresql` (DirectoryServiceImpl
 * getDataSourcePrefix -> OddrnPath.prefix) -> level-1 card name "Postgresql"; level-2 reflects
 * {host, database} (DirectoryServiceImpl.getOddrnPathProperties, reflection over @PathField).
 * A non-parseable oddrn would bucket to "Other" (UNKNOWN_DATASOURCE_TYPE) — we use a parseable
 * one so the real prefix card + the reflected properties render.
 *
 * Per-spec ids: 20700-20709 (source + entity). oddrn namespace //postgresql/host/it070-... +
 * the unique source name so it is findable amid the catalog's other 'other'-bucket sources.
 */
const SRC = 20700;
const ENT = 20701;
const HOST = 'it070-pg.internal';
const DB = 'it070_db';
const SRC_NAME = 'it070-directory-src';
const DS_ODDRN = `//postgresql/host/${HOST}/databases/${DB}`;
const ENT_ODDRN = `${DS_ODDRN}/tables/it070_tbl`;
const PREFIX = 'postgresql';
const PREFIX_CARD = 'Postgresql'; // StringUtils.capitalize(prefix) — verified live

// Seed a postgres-shaped data source + one renderable entity under it, so the source parses to
// the `postgresql` prefix (real level-1 card) AND carries reflected {host, database} at level 2.
// entity_class_ids passed as a real int[] param ($5::int[]) — a bare '{1}' literal in a JS
// template string trips Postgres 42601 (learned during the ground-truth probe).
async function seedDirectorySource(): Promise<void> {
  await dbQuery(
    `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET oddrn = EXCLUDED.oddrn, name = EXCLUDED.name`,
    [SRC, DS_ODDRN, SRC_NAME],
  );
  await dbQuery(
    `INSERT INTO data_entity
       (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
        source_created_at, source_updated_at)
     VALUES ($1, $2, $3, $4, 1, $5::int[], 0, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET data_source_id = EXCLUDED.data_source_id,
       oddrn = EXCLUDED.oddrn, entity_class_ids = EXCLUDED.entity_class_ids`,
    [ENT, ENT_ODDRN, 'it070_tbl', SRC, [1]],
  );
}

const level1Fetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/api/directory') && r.request().method() === 'GET' && r.ok(),
  );

const level2Fetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) =>
      r.url().includes('/api/directory/datasources') &&
      r.url().includes(`prefix=${PREFIX}`) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

test.describe('F-023 Directory — hierarchy-driven catalog browse', () => {
  test.beforeEach(async () => {
    await seedDirectorySource();
  });

  test('the Directory landing page shows the data-source-type card for the seeded source (level 1)', async ({
    page,
  }) => {
    // ---- act: open the Directory landing page; wait for the level-1 fetch ----
    const level1 = level1Fetch(page);
    await page.goto('/directory');
    await level1;

    // ---- assert: the page heading + the prefix card the seeded source produced ----
    // (the "Directories" heading is a Typography variant='h0' — a CUSTOM MUI variant that renders
    // as a non-semantic element, NOT an <h_>, so it is matched by text, not by the heading role.)
    await expect(
      page.getByText('Directories', { exact: true }).first(),
      'the Directory landing page must render its heading',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(PREFIX_CARD, { exact: true }).first(),
      'level 1 must render one card per ODDRN prefix — the seeded postgres source produces a "Postgresql" card',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('drilling into the source type lists the instance with its ODDRN-reflected connection properties (level 2)', async ({
    page,
  }) => {
    // ---- act: deep-link to the level-2 data-source list for the postgresql prefix ----
    const level2 = level2Fetch(page);
    await page.goto(`/directory/${PREFIX}`);
    await level2;

    // ---- assert: the registered instance renders by name ----
    await expect(
      page.getByText(SRC_NAME).first(),
      'level 2 must list the registered data-source instance by name',
    ).toBeVisible({ timeout: 10_000 });

    // …and its ODDRN-derived connection properties render as table cells (the reflection leak:
    // host + database become visible columns — F-023 oddrn_reflection_infrastructure_property_leak).
    await expect(
      page.getByText(HOST, { exact: true }).first(),
      'the reflected ODDRN host property must render as a level-2 table cell',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(DB, { exact: true }).first(),
      'the reflected ODDRN database property must render as a level-2 table cell',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the seeded postgres source does not appear under an unrelated prefix bucket (negative)', async ({
    page,
  }) => {
    // The 'other' bucket holds sources whose oddrn does NOT parse; our postgres-shaped source
    // parses to `postgresql`, so it must NOT show on the 'other' level-2 list.
    const otherFetch = page.waitForResponse(
      (r) =>
        r.url().includes('/api/directory/datasources') &&
        r.url().includes('prefix=other') &&
        r.request().method() === 'GET' &&
        r.ok(),
    );
    await page.goto('/directory/other');
    await otherFetch;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(SRC_NAME).filter({ visible: true }),
      'a postgres-parseable source must not appear under the "other" (unparseable) bucket',
    ).toHaveCount(0);
  });
});

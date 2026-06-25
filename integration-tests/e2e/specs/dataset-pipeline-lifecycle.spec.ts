import { test, expect } from '@playwright/test';
import {
  INGEST_BASE_URL,
  upDatasetStack,
  downDatasetStack,
  registerCollector,
  startCollector,
  recollect,
  mutateSource,
  resolveEntityId,
  entityState,
  waitForIngestion,
} from '../helpers/ingestion-dataset-stack';

/**
 * IT-145 — the CORE collect→store→visualize capability through the REAL product pipeline
 * (ingestion-grade e2e; the "dataset-structure stand" follow-on named in
 * adrs/drafts/ingestion-grade-e2e-stands.md):
 *
 *     source-postgres (warehouse: tables + view + COMMENTs + rows)
 *            │  odd-collector (postgresql plugin, REAL one-shot token)
 *            ▼
 *     odd-platform → GET /api/datasets|dataentities → the UI
 *
 * NOTHING is seeded into the platform DB — every dataset, column, type, description, row
 * count and lineage edge asserted on arrives through the real collector. The assertions
 * compare ODD against the SEEDED SOURCE TRUTH, with the mapping cited from the adapter
 * code (odd-collectors .../adapters/postgresql, read 2026-06-25):
 *
 *   tables/views → DataEntity (TABLE / VIEW)            mappers/tables.py, views.py
 *   columns → DataSetField; pg_type.typname → ODD type  mappers/columns.py, types.py
 *   COMMENT ON TABLE/COLUMN → description                repository.py obj_/col_description
 *   reltuples (after ANALYZE) → DataSet.rows_number      mappers/tables.py silent(int)
 *   VIEW dependency → DataTransformer.inputs (lineage)   adapter.py create_lineage
 *
 * Then the user-facing lifecycle the maintainer asked for: CHANGE the source (add column,
 * edit comment, add table, add rows; drop a table) → the collector re-runs → assert ODD's
 * API + UI reflect EXACTLY the expected delta. All values below were observed live on the
 * real pipeline before authoring (run 2026-06-25); ids are resolved by external_name (never
 * hardcoded — they are sequence-assigned).
 *
 * Protocol: integration-tests/protocols/IT-145-dataset-pipeline-lifecycle.md
 * Gates: validates F-045 (dataset structure) + F-005 (lineage) + F-008 (batch ingestion /
 *   re-ingest reconcile, UC-04/UC-13) through the ingestion-grade tier; characterizes the
 *   source-deletion reconciliation gap (PLT — logged as a follow-up).
 */

// The KNOWN source truth (mirrors source-postgres-init.sql) → the ODD type per types.py.
const PRODUCTS_TYPES: Record<string, string> = {
  id: 'TYPE_INTEGER', // pg int8
  sku: 'TYPE_STRING', // text
  title: 'TYPE_STRING', // varchar
  price: 'TYPE_NUMBER', // numeric
  released_on: 'TYPE_DATETIME', // date
  created_at: 'TYPE_DATETIME', // timestamp
  in_stock: 'TYPE_INTEGER', // int4
};

interface StructureField {
  name: string;
  is_primary_key: boolean;
  external_description: string | null;
  type: { type: string; logical_type: string; is_nullable: boolean };
}
interface EntityDetail {
  external_name: string;
  type: { name: string };
  external_description: string | null;
  data_source: { name: string };
  stats?: { rows_count?: number; fields_count?: number; consumers_count?: number };
}

const getJson = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${INGEST_BASE_URL}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return (await r.json()) as T;
};
const detail = (id: number) => getJson<EntityDetail>(`/api/dataentities/${id}`);
const structure = (id: number) => getJson<{ field_list: StructureField[] }>(`/api/datasets/${id}/structure`);

// Resolve an entity id by name or fail with a clear message (keeps every test's first line honest).
async function idOf(externalName: string): Promise<number> {
  const id = await resolveEntityId(externalName);
  expect(id, `entity '${externalName}' must be ingested (resolvable by external_name)`).not.toBeNull();
  return id as number;
}

test.describe.serial('IT-145 dataset pipeline — source truth vs ODD through the real collector', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000); // first run pulls postgres:latest + odd-collector:latest
    await upDatasetStack();
    const token = await registerCollector('it145-dataset-stand');
    startCollector(token);
    await waitForIngestion(async () => {
      const id = await resolveEntityId('products');
      if (!id) return false;
      const s = await structure(id).catch(() => null);
      return !!s && s.field_list.length === Object.keys(PRODUCTS_TYPES).length;
    }, 'products table + its 7 columns ingested via the collector');
  });

  test.afterAll(() => {
    downDatasetStack();
  });

  // ---- Phase A: the initial collection reflects the seeded source truth ----

  test('datasets: tables ingest as TABLE, the view as VIEW, under the real datasource', async () => {
    const [products, categories, view] = [
      await detail(await idOf('products')),
      await detail(await idOf('categories')),
      await detail(await idOf('active_products')),
    ];
    expect(products.type.name, 'a source table ingests as a TABLE entity').toBe('TABLE');
    expect(categories.type.name, 'the second source table ingests as a TABLE entity').toBe('TABLE');
    expect(view.type.name, 'a source view ingests as a VIEW entity').toBe('VIEW');
    expect(products.data_source.name, 'the entity is attributed to the collector datasource').toBe(
      'it145_postgres_warehouse',
    );
  });

  test('columns + types: every column lands with the ODD type the adapter maps from pg_type.typname', async () => {
    const { field_list } = await structure(await idOf('products'));
    expect(
      field_list.map((f) => f.name).sort(),
      'all 7 source columns reach the Structure surface',
    ).toEqual(Object.keys(PRODUCTS_TYPES).sort());
    for (const [name, oddType] of Object.entries(PRODUCTS_TYPES)) {
      const f = field_list.find((x) => x.name === name)!;
      expect(f.type.type, `${name}: ODD type per types.py (logical=${f.type.logical_type})`).toBe(oddType);
    }
    expect(
      field_list.find((f) => f.name === 'id')!.is_primary_key,
      'the PRIMARY KEY column is flagged is_primary_key',
    ).toBe(true);
  });

  test('descriptions: table + column COMMENTs reach ODD as external descriptions', async () => {
    const products = await detail(await idOf('products'));
    expect(products.external_description, 'COMMENT ON TABLE → entity external_description').toBe(
      'Catalog of sellable products',
    );
    const sku = (await structure(await idOf('products'))).field_list.find((f) => f.name === 'sku')!;
    expect(sku.external_description, 'COMMENT ON COLUMN → field external_description').toBe(
      'Stock keeping unit, unique per product',
    );
  });

  test('stats: row count + field count are derived from the source (reltuples after ANALYZE)', async () => {
    const products = await detail(await idOf('products'));
    expect(products.stats?.rows_count, 'rows_number = the 3 seeded rows').toBe(3);
    expect(products.stats?.fields_count, 'fields_count = the 7 columns').toBe(7);
  });

  test('lineage: the view → table dependency becomes an upstream edge', async () => {
    const productsId = await idOf('products');
    const viewId = await idOf('active_products');
    const up = await getJson<{ upstream: { nodes: { external_name: string }[] } }>(
      `/api/dataentities/${viewId}/lineage/upstream?lineage_depth=1`,
    );
    expect(
      up.upstream.nodes.map((n) => n.external_name),
      "the view's upstream lineage contains the products table it reads from",
    ).toContain('products');
    const products = await detail(productsId);
    expect(products.stats?.consumers_count, 'the products table reports its downstream consumer (the view)').toBeGreaterThanOrEqual(
      1,
    );
  });

  test('UI: the ingested dataset renders its columns + description on the platform pages', async ({ page }) => {
    const productsId = await idOf('products');
    await page.goto(`${INGEST_BASE_URL}/dataentities/${productsId}/structure`);
    await expect(
      page.getByText('sku', { exact: true }).first(),
      'the ingested column renders on the Structure tab',
    ).toBeVisible({ timeout: 20_000 });
    await page.goto(`${INGEST_BASE_URL}/dataentities/${productsId}/overview`);
    await expect(
      page.getByText('Catalog of sellable products', { exact: false }).first(),
      'the ingested table description renders on the overview',
    ).toBeVisible({ timeout: 20_000 });
  });

  // ---- Phase B: CHANGE the source → re-collect → ODD reflects exactly the delta ----

  test('delta: add a column, edit the comment, add a table, add a row → next collection reflects all of it', async () => {
    test.setTimeout(240_000);
    mutateSource(
      `ALTER TABLE products ADD COLUMN discount numeric(5,2);
       COMMENT ON TABLE products IS 'Catalog of sellable products (v2)';
       CREATE TABLE suppliers (id bigint PRIMARY KEY, name text NOT NULL);
       COMMENT ON TABLE suppliers IS 'Upstream product suppliers';
       INSERT INTO products (id, sku, title, price, in_stock) VALUES (4, 'SKU-0004', 'Sprocket', 2.25, 7);
       ANALYZE;`,
    );
    recollect();
    await waitForIngestion(async () => {
      const sid = await resolveEntityId('suppliers');
      if (!sid) return false;
      const s = await structure(await idOf('products'));
      return s.field_list.some((f) => f.name === 'discount');
    }, 'the new column + new table land after re-collection');

    const productsId = await idOf('products');
    const { field_list } = await structure(productsId);
    expect(field_list.map((f) => f.name), 'the added column appears in the structure').toContain('discount');
    expect(field_list.find((f) => f.name === 'discount')!.type.type, 'numeric(5,2) → TYPE_NUMBER').toBe(
      'TYPE_NUMBER',
    );

    const products = await detail(productsId);
    expect(products.external_description, 'the edited COMMENT is reflected').toBe(
      'Catalog of sellable products (v2)',
    );
    expect(products.stats?.rows_count, 'the inserted row bumps rows_count 3 → 4').toBe(4);
    expect(products.stats?.fields_count, 'the added column bumps fields_count 7 → 8').toBe(8);

    const suppliers = await detail(await idOf('suppliers'));
    expect(suppliers.type.name, 'the new source table ingests as a new TABLE dataset').toBe('TABLE');
    expect(suppliers.external_description, 'the new table carries its COMMENT').toBe('Upstream product suppliers');
  });

  test('delta UI: the newly-added column renders on the Structure tab after re-collection', async ({ page }) => {
    const productsId = await idOf('products');
    await page.goto(`${INGEST_BASE_URL}/dataentities/${productsId}/structure`);
    await expect(
      page.getByText('discount', { exact: true }).first(),
      'the column added to the source renders in the UI after the collector re-ran',
    ).toBeVisible({ timeout: 20_000 });
  });

  // ---- Phase C: source DELETION reconciliation (characterization, LSN-029) ----

  test('deletion: a dropped source table is NOT reconciled away on a pull re-ingest (current behavior)', async () => {
    test.setTimeout(240_000);
    // Drop categories; bump the products comment to v3 as the "re-collection completed" sentinel.
    mutateSource(
      `DROP TABLE categories;
       COMMENT ON TABLE products IS 'Catalog of sellable products (v3)';`,
    );
    recollect();
    await waitForIngestion(async () => {
      const p = await detail(await idOf('products')).catch(() => null);
      return !!p && p.external_description === 'Catalog of sellable products (v3)';
    }, 'the post-deletion re-collection has completed (products comment = v3)');

    // CHARACTERIZATION: the catalog still shows the categories dataset even though its source
    // table is gone — ODD's pull-ingestion does not mark source-absent entities deleted. This
    // is an operator-facing reconciliation gap (logged as a follow-up), pinned here so the test
    // flips the day ODD adds deletion reconciliation (then re-ground to assert removal).
    const categories = await entityState('categories');
    expect(categories, 'the dropped table still resolves — it is not removed').not.toBeNull();
    expect(
      categories!.hollow,
      'and it is not even flagged hollow/deleted — it persists as a normal entity',
    ).toBeFalsy();
  });
});

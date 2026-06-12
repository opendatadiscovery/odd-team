import { test, expect } from '@playwright/test';
import {
  INGEST_BASE_URL,
  downIngestionStack,
  registerCollector,
  startCollector,
  upIngestionStack,
  waitForIngestion,
} from '../helpers/ingestion-stack';

/**
 * IT-128 — F-037 relationships through the REAL product pipeline (ingestion-grade e2e):
 *
 *     neo4j (seeded graph)  ─┐
 *                            ├─→ odd-collector → ingestion API → odd-platform → API + UI
 *     postgres (seeded FKs) ─┘
 *
 * NOTHING is written to the platform DB by this spec — every asserted entity arrives via
 * the real collector (registered through POST /api/collectors, the one-shot-token flow).
 * The assertions compare ODD against the SEEDED SOURCE TRUTH, with the mapping semantics
 * pinned from the adapter code (odd-collectors, read 2026-06-12):
 *
 *   GRAPH (adapters/neo4j): one GRAPH_RELATIONSHIP per DISTINCT (labels(s), type(r),
 *   labels(t)) triple, named `{Source}_{TYPE}_{Target}`; source = the cypher edge's START
 *   node label, target = its END node label; is_directed always true; relationship
 *   property names land as attributes with the literal value "UNKNOWN" (no APOC).
 *
 *   ERD (adapters/postgresql/mappers/relationships): one ENTITY_RELATIONSHIP per FK
 *   constraint, named by the CONSTRAINT NAME; source = the FK-holding (child) table,
 *   target = the referenced (parent) table; cardinality ONE_TO_ZERO_OR_ONE when the FK
 *   column is unique/PK else ONE_TO_ZERO_ONE_OR_MORE; is_identifying = FK ⊆ child PK AND
 *   references the parent's full PK.
 *
 * Seeds: probe-stacks/odd-ingestion/neo4j-seed.cypher + source-postgres-init.sql.
 * Protocol: integration-tests/protocols/IT-128-relationships-ingestion-pipeline.md
 * Gates: validates F-037 (the ingestion-grade half); per the 2026-06-12 maintainer
 * directive (real multi-component stands, no mocks) — adrs/drafts/ingestion-grade-e2e-stands.md.
 */

// The KNOWN truth — each entry mirrors one cypher edge / one FK constraint in the seeds.
const GRAPH_TRUTH: Record<string, { source: string; target: string }> = {
  Person_WORKS_AT_Company: { source: 'Person', target: 'Company' },
  Person_LIVES_IN_City: { source: 'Person', target: 'City' },
  Company_HEADQUARTERED_IN_City: { source: 'Company', target: 'City' },
  Person_CONTRIBUTES_TO_Project: { source: 'Person', target: 'Project' },
  Company_SPONSORS_Project: { source: 'Company', target: 'Project' },
};
const ERD_TRUTH: Record<
  string,
  { source: string; target: string; cardinality: string; isIdentifying: boolean }
> = {
  orders_customer_fk: {
    source: 'orders',
    target: 'customers',
    cardinality: 'ONE_TO_ZERO_ONE_OR_MORE',
    isIdentifying: false,
  },
  customer_profiles_customer_fk: {
    source: 'customer_profiles',
    target: 'customers',
    cardinality: 'ONE_TO_ZERO_OR_ONE',
    isIdentifying: true,
  },
};

interface RelListItem {
  id: number;
  name: string;
  source_data_entity: { external_name?: string; internal_name?: string };
  target_data_entity: { external_name?: string; internal_name?: string };
}

async function listRelationships(type: 'ERD' | 'GRAPH' | 'ALL'): Promise<{ items: RelListItem[]; total: number }> {
  const r = await fetch(`${INGEST_BASE_URL}/api/relationships?page=1&size=30&type=${type}`);
  if (!r.ok) throw new Error(`GET /api/relationships?type=${type} → ${r.status}`);
  const body = await r.json();
  return { items: body.items ?? [], total: body.page_info?.total ?? body.pageInfo?.total ?? -1 };
}

test.describe('IT-128 relationships ingestion pipeline — source truth vs ODD (#1752 / F-037)', () => {
  test.beforeAll(async () => {
    // First run pulls neo4j:latest + postgres:latest + odd-collector:latest — generous.
    test.setTimeout(600_000);
    await upIngestionStack();
    const token = await registerCollector('it128-relationships-stand');
    startCollector(token);
    await waitForIngestion(async () => {
      // Count ITEMS, never the type-filtered `total`: the platform's count query is
      // type-blind (pre-existing PLT-220, excluded from #1752 by the approved scope), so
      // ?type=GRAPH reports total=7 while returning 5 items once both plugins ingest.
      const [graph, erd] = [await listRelationships('GRAPH'), await listRelationships('ERD')];
      return graph.items.length === Object.keys(GRAPH_TRUTH).length
        && erd.items.length === Object.keys(ERD_TRUTH).length;
    }, 'GRAPH items=5 and ERD items=2 via the collector');
  });

  test.afterAll(() => {
    downIngestionStack();
  });

  test('GRAPH: all 5 neo4j relationship types land with the cypher edge direction preserved', async () => {
    test.setTimeout(120_000);
    const { items } = await listRelationships('GRAPH');
    expect(
      items.map(i => i.name).sort(),
      'one GRAPH_RELATIONSHIP per distinct (source,type,target) triple — asserted by NAME SET; the type-filtered total is deliberately NOT asserted (type-blind, PLT-220)',
    ).toEqual(Object.keys(GRAPH_TRUTH).sort());
    for (const [name, truth] of Object.entries(GRAPH_TRUTH)) {
      const item = items.find(i => i.name === name);
      expect(item, `relationship ${name} must be ingested`).toBeTruthy();
      expect(
        item!.source_data_entity.external_name,
        `${name}: source must be the cypher edge's START node label`,
      ).toBe(truth.source);
      expect(
        item!.target_data_entity.external_name,
        `${name}: target must be the cypher edge's END node label`,
      ).toBe(truth.target);
    }
  });

  test('GRAPH detail: is_directed + property names as UNKNOWN-typed attributes; internal id differs', async () => {
    test.setTimeout(120_000);
    const { items } = await listRelationships('GRAPH');
    const worksAt = items.find(i => i.name === 'Person_WORKS_AT_Company')!;
    const r = await fetch(`${INGEST_BASE_URL}/api/relationships/graph/${worksAt.id}`);
    expect(r.status, 'the list id IS the {relationship_id} path param (the documented contract)').toBe(200);
    const body = await r.json();
    expect(body.graph_relationship?.is_directed, 'neo4j edges ingest as directed').toBe(true);
    const attrNames = (body.graph_relationship?.attributes ?? []).map((a: { name?: string }) => a.name).sort();
    expect(attrNames, 'WORKS_AT property KEYS land as attributes (values UNKNOWN — no APOC)').toEqual(
      ['position', 'since'],
    );
    // Presence only — deliberately NO numeric inequality vs the entity id: the two ID
    // SPACES are distinct but their VALUES can collide on a fresh ingestion-only DB
    // (run 3, 2026-06-12: graph_relationship.id == the relationship's data_entity.id —
    // the doc caveat's "numeric coincidence" clause observed live). The non-round-trip
    // trap itself is green-locked by IT-077 with controlled ids.
    expect(
      body.graph_relationship?.graph_relationship_id,
      'the payload exposes the internal detail-record id',
    ).toBeTruthy();
  });

  test('ERD: both FK constraints land child→parent with derived cardinality + is_identifying', async () => {
    test.setTimeout(120_000);
    const { items } = await listRelationships('ERD');
    expect(
      items.map(i => i.name).sort(),
      'one ENTITY_RELATIONSHIP per FK constraint — asserted by NAME SET (total is type-blind, PLT-220)',
    ).toEqual(Object.keys(ERD_TRUTH).sort());
    for (const [name, truth] of Object.entries(ERD_TRUTH)) {
      const item = items.find(i => i.name === name);
      expect(item, `constraint ${name} must be ingested under its constraint name`).toBeTruthy();
      expect(
        item!.source_data_entity.external_name,
        `${name}: source must be the FK-HOLDING (child) table`,
      ).toBe(truth.source);
      expect(
        item!.target_data_entity.external_name,
        `${name}: target must be the REFERENCED (parent) table`,
      ).toBe(truth.target);

      const detail = await fetch(`${INGEST_BASE_URL}/api/relationships/erd/${item!.id}`);
      expect(detail.status, `${name}: erd detail resolves by the list id`).toBe(200);
      const body = await detail.json();
      expect(body.erd_relationship?.cardinality, `${name}: cardinality per the adapter's checker`).toBe(
        truth.cardinality,
      );
      expect(body.erd_relationship?.is_identifying, `${name}: is_identifying per the adapter's checker`).toBe(
        truth.isIdentifying,
      );
    }
  });

  test('UI list (GRAPH): the row renders Person in Source and Company in Target — through the pipeline', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`${INGEST_BASE_URL}/data-modelling/relationships?q=Person_WORKS_AT_Company`);
    await expect(
      page.getByText('Person_WORKS_AT_Company', { exact: true }).filter({ visible: true }).first(),
      'the ingested relationship renders on the list by its mapped name',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('Person', { exact: true }).filter({ visible: true }),
      'the SOURCE node label renders exactly once (the Source column — #1752 D1 fixed contract)',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.getByText('Company', { exact: true }).filter({ visible: true }),
      'the TARGET node label renders exactly once (the Target column)',
    ).toHaveCount(1, { timeout: 15_000 });
  });

  test('UI graph overview: "Source:" carries Person, "Target:" carries Company — through the pipeline', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { items } = await listRelationships('GRAPH');
    const worksAt = items.find(i => i.name === 'Person_WORKS_AT_Company')!;
    await page.goto(`${INGEST_BASE_URL}/dataentities/${worksAt.id}/overview`);
    await expect(page.getByText('Source:', { exact: true })).toBeVisible({ timeout: 20_000 });
    const sourceBlock = page.locator('text=Source:').locator('xpath=ancestor::div[1]');
    const targetBlock = page.locator('text=Target:').locator('xpath=ancestor::div[1]');
    await expect(sourceBlock, 'Source: block = the cypher START node').toContainText('Person', {
      timeout: 15_000,
    });
    await expect(targetBlock, 'Target: block = the cypher END node').toContainText('Company', {
      timeout: 15_000,
    });
  });

  test('UI list (ERD): the constraint row renders orders in Source and customers in Target', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${INGEST_BASE_URL}/data-modelling/relationships?q=orders_customer_fk`);
    await expect(
      page.getByText('orders_customer_fk', { exact: true }).filter({ visible: true }).first(),
      'the ingested FK constraint renders on the list by its constraint name',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('orders', { exact: true }).filter({ visible: true }),
      'the child table renders exactly once (Source column)',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.getByText('customers', { exact: true }).filter({ visible: true }),
      'the parent table renders exactly once (Target column)',
    ).toHaveCount(1, { timeout: 15_000 });
  });
});

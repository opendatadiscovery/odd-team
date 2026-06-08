import { test, expect } from '@playwright/test';
import { entityByOddrn, seedIngestionDataSource } from '../helpers/db';
import { ingestEntities } from '../helpers/ingest';

/**
 * IT-075 — F-054 Microservices Lineage: probe whether a DISTINCT microservices-lineage
 * surface exists, or whether microservices render on the SAME uniform lineage canvas as
 * any other data entity. Assert the REALITY (not the doc's earlier "distinct pillar" framing).
 *
 * Protocol: integration-tests/protocols/IT-075-microservices-lineage.md
 * Gates: validates F-054 (UC-1 happy-path microservice render on the uniform canvas;
 * UC-7 the documented product decision — uniform HierarchyLineage canvas, NO microservice-
 * specific operational affordance).
 *
 * THE PROBE (crux of F-054 — HIGH risk, doc-promised distinct surface):
 *   F-054 was seeded as "doc-promised distinct pillar surface that has NO code-side anchor."
 *   Primary-source + config probe (verified this run against odd-platform):
 *     - Lineage.tsx:18-24 — the dispatcher branches ONLY on isDEG (ENTITY_GROUP class 8).
 *       NO isMicroservice branch (grep `isMicroservice` over odd-platform-ui/src → 0 hits).
 *     - NO microservice-specific lineage component (grep `microservice` over
 *       components/DataEntityDetails/Lineage/ → 0 hits); NO distinct microservices route
 *       (grep `microservices` over src/routes/ → 0 hits).
 *     - DataEntityClassDto: MICROSERVICE (type 13) ∈ class DATA_TRANSFORMER (2) — NOT ENTITY_GROUP.
 *       isDEG is false → a microservice falls through to <HierarchyLineage/> — the SAME renderer a
 *       Postgres table uses. LineageServiceImpl.getLineage takes no EntityClass parameter.
 *   => There is NO distinct microservices-lineage surface. (Per F-054 scanner_review
 *      SR-20260527T1700Z the live doc was UPDATED to acknowledge "same UI surface as Data Objects
 *      Lineage" — so today it is a doc-CONFIRMED uniform surface, not a contradiction.) We pin the
 *      uniform-surface contract: a microservice opens the standard hierarchy canvas with the
 *      Hierarchy-only controls ("Show full names", "Depth", "Expand all nested items") that the DEG
 *      branch lacks and that no microservice-specific surface adds.
 *
 * SEED via the INGESTION API (the faithful path — assignment-sanctioned). Two MICROSERVICE
 * entities with a call edge ms→down; ingestion composes a proper transformer entity the detail
 * endpoint renders (a RAW data_entity transformer seed 500s on the detail composer — a seed-fidelity
 * limitation, NOT an F-054 product bug, so we don't mis-pin it). The auto-assigned id is resolved by
 * oddrn lookup. EMPIRICALLY VERIFIED this run: detail 200, downstream+upstream 200, both nodes +
 * the three Hierarchy-only controls render.
 *
 * use_cases verified: F-054-UC-1 (microservice renders on the uniform canvas),
 * F-054-UC-7 (uniform HierarchyLineage canvas, no microservice-specific affordance).
 */
const DS_ID = 20750;
const DS_ODDRN = '//e2e-it075/db';
const MS_ODDRN = '//e2e-it075/db/microservices/it075_ms';
const DOWN_ODDRN = '//e2e-it075/db/microservices/it075_down';

function microserviceItem(oddrn: string, name: string, outputs: string[]) {
  return {
    oddrn,
    name,
    type: 'MICROSERVICE',
    metadata: [],
    data_transformer: { source_code_url: null, sql: null, inputs: [], outputs },
  };
}

let msId = 0;

test.beforeAll(async () => {
  await seedIngestionDataSource(DS_ID, DS_ODDRN, 'it075-src');
  const status = await ingestEntities(DS_ODDRN, [
    microserviceItem(MS_ODDRN, 'it075_ms', [DOWN_ODDRN]), // call edge ms → down
    microserviceItem(DOWN_ODDRN, 'it075_down', []),
  ]);
  expect(status, 'ingesting the two MICROSERVICE entities must return 200').toBe(200);
  const row = await entityByOddrn(MS_ODDRN);
  expect(row, 'the ingested microservice must exist by oddrn').not.toBeNull();
  msId = row!.id;
});

const lineageFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(r => /\/lineage\/(up|down)stream/.test(r.url()) && r.ok());

test.describe('F-054 Microservices lineage — uniform canvas, no distinct surface', () => {
  test('UC-1: a MICROSERVICE with a call edge renders its neighbour on the lineage canvas', async ({ page }) => {
    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${msId}/lineage`);
    await lineage; // a microservice uses the STANDARD per-entity lineage endpoint, not a special one

    // The downstream neighbour renders by name on the uniform hierarchy canvas (visx node, queryable).
    await expect(
      page.getByText('it075_down').filter({ visible: true }).first(),
      'the microservice lineage canvas must render its downstream neighbour — microservices participate in the uniform graph'
    ).toBeVisible({ timeout: 20_000 });
  });

  test('UC-7: the microservice opens the uniform HierarchyLineage canvas — NO distinct microservice surface', async ({
    page,
  }) => {
    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${msId}/lineage`);
    await lineage;

    await expect(
      page.getByText('it075_ms').filter({ visible: true }).first(),
      'the microservice root must render on the standard canvas'
    ).toBeVisible({ timeout: 20_000 });
    // Hierarchy-ONLY controls (LineageControls.tsx:60-119) prove the microservice routed to the
    // standard hierarchy renderer — the DEG branch lacks these, and no microservice-specific surface
    // adds them. Their presence IS the uniform-surface evidence (the doc-promised "distinct pillar"
    // is the uniform canvas).
    await expect(
      page.getByText('Show full names').filter({ visible: true }).first(),
      'the Hierarchy-only "Show full names" control must be present — confirms uniform-surface routing'
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Depth', { exact: false }).filter({ visible: true }).first(),
      'the Hierarchy-only "Depth" control must be present — the standard per-entity lineage canvas'
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Expand all nested items').filter({ visible: true }).first(),
      'the Hierarchy-only "Expand all nested items" control must be present — not a microservice-specific surface'
    ).toBeVisible({ timeout: 15_000 });
  });
});

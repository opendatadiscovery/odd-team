import { test, expect } from '@playwright/test';
import { seedEntityLineage, clearEntityLineage, ENTITY_ID } from '../helpers/db';

/**
 * IT-029 — F-005 Lineage Graph Traversal: the Lineage tab renders related (upstream) entities.
 *
 * Protocol: integration-tests/protocols/IT-029-entity-lineage-display.md
 * Gates: validates F-005 (a lineage relation reaches the entity's Lineage read surface).
 *
 * The Lineage tab (/dataentities/{id}/lineage → GET /api/dataentities/{id}/lineage/upstream) renders
 * the lineage graph; node labels are queryable text (react-flow HTML nodes — verified live). The graph
 * is data-driven: an entity with no lineage shows no related node.
 */
const UPSTREAM = 'IT029Upstream';

const lineageFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse((r) => /\/lineage\/(up|down)stream/.test(r.url()) && r.ok());

test.describe('F-005 Lineage graph — the Lineage tab renders related entities', () => {
  test('an upstream entity renders on the Lineage graph', async ({ page }) => {
    await seedEntityLineage(UPSTREAM);

    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/lineage`);
    await lineage;

    // react-flow renders the node name in a hidden SVG <title> AND a visible label — scope to visible
    // (KEY LESSON 4: getByText matches hidden DOM).
    await expect(
      page.getByText(UPSTREAM).filter({ visible: true }).first(),
      'the Lineage tab must render the upstream entity node',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('an entity with no lineage does not render a related entity (negative)', async ({ page }) => {
    await clearEntityLineage();

    const lineage = lineageFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/lineage`);
    await lineage;
    await page.waitForTimeout(1500);

    await expect(
      page.getByText(UPSTREAM).filter({ visible: true }),
      'with no lineage the upstream entity must not render',
    ).toHaveCount(0);
  });
});

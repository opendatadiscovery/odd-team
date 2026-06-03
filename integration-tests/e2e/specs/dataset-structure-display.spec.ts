import { test, expect } from '@playwright/test';
import { seedDatasetColumn, ENTITY_ID } from '../helpers/db';

/**
 * IT-023 — F-045 Dataset structure: the Structure tab renders the dataset's columns.
 *
 * Protocol: integration-tests/protocols/IT-023-dataset-structure-display.md
 * Gates: validates F-045 (a dataset's schema/columns reach the Structure read surface).
 *
 * The Structure tab (/dataentities/{id}/structure → GET /api/datasets/{id}/structure latest) renders
 * the dataset's column rows (name verbatim, type abbreviated). The list is data-driven: a column not
 * in the dataset is not rendered. Seeding requires a dataset_version + dataset_field + the
 * dataset_structure link, with non-null dataset_field.stats (see helper / KEY LESSON note).
 */
const COLUMN = 'IT023Column';
const GHOST = 'IT023GhostColumn';

const structureFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => /\/api\/datasets\/\d+\/structure(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-045 Dataset structure — Structure tab renders the columns', () => {
  test.beforeEach(async () => {
    await seedDatasetColumn(COLUMN);
  });

  test('a dataset column renders on the Structure tab', async ({ page }) => {
    const structure = structureFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/structure`);
    await structure;

    await expect(
      page.getByText(COLUMN).first(),
      'the Structure tab must render the dataset column name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a column not in the dataset is not rendered (negative)', async ({ page }) => {
    const structure = structureFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/structure`);
    await structure;
    await page.waitForTimeout(800);

    await expect(
      page.getByText(GHOST).filter({ visible: true }),
      'a column not in the dataset structure must not render',
    ).toHaveCount(0);
  });
});

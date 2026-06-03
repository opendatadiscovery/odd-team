import { test, expect } from '@playwright/test';
import { seedEntityDescription, ENTITY_ID } from '../helpers/db';

/**
 * IT-014 — F-004 Entity Description: the Overview renders the internal description.
 *
 * Protocol: integration-tests/protocols/IT-014-entity-description-display.md
 * Gates: validates F-004 (Entity Description Editing — the edited description reaches the read surface).
 *
 * The description panel must be data-driven: it shows the entity's internal description when set,
 * and shows nothing (no stale/placeholder) when unset. Verified against the real Overview.
 */
const MARKER = 'IT014 internal description marker text';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-004 Entity Description — Overview renders the internal description', () => {
  test('a seeded internal description renders on the Overview', async ({ page }) => {
    await seedEntityDescription(MARKER);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(MARKER).first(),
      'the Overview must render the entity internal description',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no description does not render the marker (negative)', async ({ page }) => {
    await seedEntityDescription(null);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(MARKER),
      'a cleared description must not render the marker (no stale/placeholder value)',
    ).toHaveCount(0);
  });
});

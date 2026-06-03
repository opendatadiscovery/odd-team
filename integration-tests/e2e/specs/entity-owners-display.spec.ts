import { test, expect } from '@playwright/test';
import { seedEntityOwner, clearEntityOwners, ENTITY_ID } from '../helpers/db';

/**
 * IT-015 — F-019 Owners: the Overview renders the entity's assigned owners.
 *
 * Protocol: integration-tests/protocols/IT-015-entity-owners-display.md
 * Gates: validates F-019 (Owner Lifecycle Management — assigned ownership reaches the read surface).
 *
 * The owners panel must be data-driven: it shows assigned owners and nothing when unassigned.
 */
const OWNER = 'IT015 Owner Alice';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-019 Owners — Overview renders assigned owners', () => {
  test('a seeded owner renders on the Overview', async ({ page }) => {
    await seedEntityOwner(OWNER);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(OWNER).first(),
      'the Overview must render the assigned owner name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no ownership does not render the owner (negative)', async ({ page }) => {
    await clearEntityOwners();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(OWNER),
      'with no ownership the owner name must not render (no stale owner)',
    ).toHaveCount(0);
  });
});

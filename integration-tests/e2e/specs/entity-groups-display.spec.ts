import { test, expect } from '@playwright/test';
import { seedEntityGroupMembership, clearEntityGroupMembership, ENTITY_ID } from '../helpers/db';

/**
 * IT-024 — F-012 Data Entity Group membership: the Overview renders the groups an entity belongs to.
 *
 * Protocol: integration-tests/protocols/IT-024-entity-groups-display.md
 * Gates: validates F-012 (a group membership reaches the member entity's read surface).
 *
 * The Overview "Data entity groups" section lists the DEGs the entity is a member of (name verbatim —
 * verified live). Membership is via group_entity_relations(group_oddrn, data_entity_oddrn). The panel
 * is data-driven: no membership → no group shown.
 */
const GROUP = 'IT024Group';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-012 Data entity group membership — Overview renders the group', () => {
  test('a member entity renders its group on the Overview', async ({ page }) => {
    await seedEntityGroupMembership(GROUP);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(GROUP).first(),
      'the Overview must render the group the entity belongs to',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity in no group does not render the group (negative)', async ({ page }) => {
    await clearEntityGroupMembership();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(GROUP).filter({ visible: true }),
      'with no membership the group must not render',
    ).toHaveCount(0);
  });
});

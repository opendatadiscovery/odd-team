import { test, expect } from '@playwright/test';
import { seedEntity, ENTITY_ID } from '../helpers/db';

/**
 * IT-013 — F-176 Data Entity Overview, composed reading surface.
 *
 * Protocol: integration-tests/protocols/IT-013-data-entity-overview-composition.md
 * Gates: validates F-176 (the /dataentities/{id}/overview composer renders the entity).
 *
 * The Overview (Overview.tsx, default route per dataEntitiesRoutes.ts:66-73) is the
 * most-used read surface in ODD. This drives a real browser to it and asserts the
 * entity actually composes + renders end-to-end — and that a non-existent id does NOT
 * render the seeded entity (no wrong-entity/stale render).
 */
test.describe('F-176 Data Entity Overview — composed reading surface', () => {
  test('opening a seeded entity composes the Overview and renders its name', async ({ page }) => {
    // ---- arrange: a renderable entity (id 2001, external_name it002_table) ----
    await seedEntity();

    // ---- act: open the Overview; wait for the detail fetch (react-query) to resolve ----
    const detail = page.waitForResponse(
      (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    // ---- assert: the Overview composed + rendered the entity (its name is shown) ----
    await expect(
      page.getByText('it002_table').first(),
      'the Overview must render the seeded entity name; absent → it did not compose/load the entity',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a non-existent entity id does not render the seeded entity (negative)', async ({ page }) => {
    await seedEntity(); // entity 2001 exists; we navigate to a DIFFERENT, absent id

    await page.goto('/dataentities/999999/overview');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // the absent entity must NOT render entity 2001's name (no wrong-entity / stale render)
    await expect(
      page.getByText('it002_table'),
      'a bad entity id must not render some other entity',
    ).toHaveCount(0);
  });
});

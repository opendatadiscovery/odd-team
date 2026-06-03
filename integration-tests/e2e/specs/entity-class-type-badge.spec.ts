import { test, expect } from '@playwright/test';
import { seedEntityClassType, ENTITY_ID } from '../helpers/db';

/**
 * IT-018 — F-177 Class / Type badges on the data-entity detail header.
 *
 * Protocol: integration-tests/protocols/IT-018-entity-class-type-badge.md
 * Gates: validates F-177 (the entity's class + type reach the operator-visible header badges).
 *
 * DataEntityDetailsHeader renders one CLASS badge per `entity_classes[]` (the short label, e.g.
 * DATA_SET → "DS" via DataEntityClassLabelMap) + one TYPE badge (`type.name` via
 * stringFormatted, e.g. TABLE → "TABLE"). Both labels are transform-derived (KEY LESSON 2) —
 * verified live: a TABLE/DATA_SET entity renders "DS" then "TABLE" next to the name.
 *
 * The badges must be data-driven. Negative pins the documented F-177 drift
 * (`class_array_empty_renders_no_badge`): an entity with no classes renders NO class badge.
 */
const TABLE_TYPE_ID = 1; // DataEntityTypeDto.TABLE
const DATA_SET_CLASS_ID = 1; // DataEntityClassDto.DATA_SET (TABLE belongs to DATA_SET)
const TYPE_BADGE = 'TABLE'; // stringFormatted("TABLE", "_", "all")
const CLASS_BADGE = 'DS'; // DataEntityClassLabelMap.get(SET).short

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-177 Class/Type badges — detail header', () => {
  test('class + type badges render for a classified TABLE entity', async ({ page }) => {
    await seedEntityClassType(TABLE_TYPE_ID, [DATA_SET_CLASS_ID]);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(TYPE_BADGE, { exact: true }).first(),
      'the header must render the TYPE badge',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(CLASS_BADGE, { exact: true }).first(),
      'the header must render the CLASS short badge',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no classes renders no class badge — type badge remains (negative)', async ({
    page,
  }) => {
    await seedEntityClassType(TABLE_TYPE_ID, []);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    // type is unchanged, so the type badge still renders…
    await expect(
      page.getByText(TYPE_BADGE, { exact: true }).first(),
      'the TYPE badge must still render (type unchanged)',
    ).toBeVisible({ timeout: 10_000 });
    // …but with no entity classes there is no class badge (documented F-177 drift:
    // class_array_empty_renders_no_badge — silently indistinguishable from unclassified).
    await expect(
      page.getByText(CLASS_BADGE, { exact: true }),
      'with no entity classes the class badge must not render',
    ).toHaveCount(0);
  });
});

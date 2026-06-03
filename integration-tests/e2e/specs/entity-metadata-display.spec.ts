import { test, expect } from '@playwright/test';
import { seedEntityMetadata, clearEntityMetadata, ENTITY_ID } from '../helpers/db';

/**
 * IT-017 — F-013 Custom Metadata: the Overview renders custom metadata key/value pairs.
 *
 * Protocol: integration-tests/protocols/IT-017-entity-metadata-display.md
 * Gates: validates F-013 (an operator-curated custom metadata field value reaches the
 *        entity read surface — the OverviewMetadata panel).
 *
 * The metadata panel must be data-driven: it shows the field name + value when a value
 * is set for the entity, and the value is absent when the entity has no custom metadata.
 * (The write-side of F-013 carries the documented silent-UPDATE-not-UPSERT drift family;
 * this IT pins the READ/display contract that the panel is value-driven per entity.)
 */
const FIELD = 'IT017_cost_centre';
const VALUE = 'IT017-ACME-42-CostCentre';
// MetadataItem renders the field NAME through TextFormatted, which lower-cases the name
// and replaces `_` with a space ('IT017_cost_centre' → 'It017 cost centre'). The VALUE is
// rendered verbatim. So we assert the value verbatim (the actual datum that proves the
// metadata reached the read surface) + the label via a transform-tolerant regex.
const LABEL_RE = /it017\s+cost\s+centre/i;

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-013 Custom Metadata — Overview renders the field name + value', () => {
  test('a custom metadata field value renders on the Overview', async ({ page }) => {
    await seedEntityMetadata(FIELD, VALUE);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(VALUE).first(),
      'the Overview must render the custom metadata field value (verbatim)',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(LABEL_RE).first(),
      'the Overview must render the custom metadata field label',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no custom metadata does not render the value (negative)', async ({ page }) => {
    await clearEntityMetadata();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(VALUE),
      'with no custom metadata value the value must not render',
    ).toHaveCount(0);
  });
});

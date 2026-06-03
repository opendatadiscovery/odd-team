import { test, expect } from '@playwright/test';
import { seedEntityTerm, clearEntityTerms, ENTITY_ID } from '../helpers/db';

/**
 * IT-016 — F-002 Term-to-Entity Linkage: the Overview renders linked glossary terms.
 *
 * Protocol: integration-tests/protocols/IT-016-entity-terms-display.md
 * Gates: validates F-002 (a term linked to an entity reaches the entity read surface).
 *
 * The terms panel must be data-driven: it shows linked terms and nothing when unlinked.
 */
const TERM = 'IT016 Term Customer';

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

test.describe('F-002 Term-to-Entity — Overview renders linked terms', () => {
  test('a linked term renders on the Overview', async ({ page }) => {
    await seedEntityTerm(TERM);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      page.getByText(TERM).first(),
      'the Overview must render the linked term name',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an entity with no linked terms does not render the term (negative)', async ({ page }) => {
    await clearEntityTerms();

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;
    await page.waitForTimeout(1000);

    await expect(
      page.getByText(TERM),
      'with no term link the term name must not render',
    ).toHaveCount(0);
  });
});

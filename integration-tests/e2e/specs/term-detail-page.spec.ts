import { test, expect } from '@playwright/test';
import { seedTermWithDefinition } from '../helpers/db';

/**
 * IT-032 — F-151 Term Detail Page Composition: a term's detail page renders its name + definition.
 *
 * Protocol: integration-tests/protocols/IT-032-term-detail-page.md
 * Gates: validates F-151 (a glossary term's detail page composes its name + definition — distinct from
 *        IT-019 term SEARCH and IT-016 term-to-entity linkage).
 *
 * The term detail page (/terms/{id}/overview → GET /api/terms/{id}) renders the term name + definition
 * verbatim (verified live). Term-specific: another term's definition does not appear on this page.
 */
const A_NAME = 'IT032TermAlpha';
const A_DEF = 'IT032 Alpha definition: the canonical customer identifier';
const B_DEF = 'IT032 Bravo definition: must not appear on the Alpha page';

const termFetch = (page: import('@playwright/test').Page, id: number) =>
  page.waitForResponse((r) => r.url().includes(`/api/terms/${id}`) && r.request().method() === 'GET' && r.ok());

async function seedPair(): Promise<number> {
  const id = await seedTermWithDefinition(A_NAME, A_DEF);
  await seedTermWithDefinition('IT032TermBravo', B_DEF);
  return id;
}

test.describe('F-151 Term detail page — renders the term name + definition', () => {
  test('the term detail page renders the term name and definition', async ({ page }) => {
    const id = await seedPair();

    const detail = termFetch(page, id);
    await page.goto(`/terms/${id}/overview`);
    await detail;

    await expect(page.getByText(A_NAME).first(), 'the term name must render').toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(A_DEF).first(), 'the term definition must render').toBeVisible({ timeout: 10_000 });
  });

  test('the term detail page does not show another term definition (negative)', async ({ page }) => {
    const id = await seedPair();

    const detail = termFetch(page, id);
    await page.goto(`/terms/${id}/overview`);
    await detail;
    await page.waitForTimeout(800);

    await expect(
      page.getByText(B_DEF).filter({ visible: true }),
      "another term's definition must not appear on this term page",
    ).toHaveCount(0);
  });
});

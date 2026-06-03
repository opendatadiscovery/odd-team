import { test, expect } from '@playwright/test';
import { seedEntityStatus, ENTITY_ID } from '../helpers/db';

/**
 * IT-021 — F-044 Data Entity Status: the detail header renders the entity's lifecycle status badge.
 *
 * Protocol: integration-tests/protocols/IT-021-entity-status-display.md
 * Gates: validates F-044 (the entity's lifecycle status reaches the operator-visible header badge).
 *
 * DataEntityStatusDto: UNASSIGNED(1)/DRAFT(2)/STABLE(3)/DEPRECATED(4)/DELETED(5). The header renders
 * the status name verbatim uppercase (verified live: STABLE, DEPRECATED). The badge must be
 * data-driven — it reflects the actual status, so a different status name is NOT shown.
 *
 * (F-044's lifecycle has a documented status_updated_at/30-day-TTL drift on the WRITE path; that is
 * a separate write-side pin. This IT covers the READ/display contract.)
 */
const STABLE = 3;
const DEPRECATED = 4;

const detailFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) => r.url().includes(`/api/dataentities/${ENTITY_ID}`) && r.request().method() === 'GET' && r.ok(),
  );

// The status edit control renders ALL status names as HIDDEN dropdown options, so a plain
// getByText matches them (textContent includes hidden DOM). Scope to VISIBLE only — the badge.
const visibleStatus = (page: import('@playwright/test').Page, name: string) =>
  page.getByText(name, { exact: true }).filter({ visible: true });

test.describe('F-044 Entity status — header status badge', () => {
  test('the header renders the entity lifecycle status badge', async ({ page }) => {
    await seedEntityStatus(DEPRECATED);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      visibleStatus(page, 'DEPRECATED').first(),
      'the header must render the lifecycle status badge',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the status badge reflects the actual status — a different status is not shown (negative)', async ({
    page,
  }) => {
    await seedEntityStatus(STABLE);

    const detail = detailFetch(page);
    await page.goto(`/dataentities/${ENTITY_ID}/overview`);
    await detail;

    await expect(
      visibleStatus(page, 'STABLE').first(),
      'the actual status (STABLE) must render',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      visibleStatus(page, 'DEPRECATED'),
      'a non-current status must not be shown as the badge',
    ).toHaveCount(0, { timeout: 5_000 });
  });
});

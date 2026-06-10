import { test, expect, type Page } from '@playwright/test';
import { seedCrossNamespaceLinkedTerms } from '../helpers/db';

/**
 * IT-127 — #1746 (PLT-006): the term overview must render when a linked term lives in ANOTHER namespace.
 *
 * Protocol: integration-tests/protocols/IT-127-term-cross-namespace-linked-term.md
 * Gates: validates F-151 (term detail composition) + F-056 ([[ns:term]] description mention);
 *        regresses PLT-006 / odd-platform#1746.
 *
 * Two collaborating defects white-screened the page on the unfixed platform:
 *  - backend: getTermDetailsDto aggregated the PARENT's namespace instead of the linked terms'
 *    (wrong table alias) -> GET /api/terms/{id} serialized terms[].term.namespace = null for any
 *    cross-namespace linked term, violating the spec contract (TermRef.namespace required);
 *  - frontend: useTermWiki's useState lazy initializer dereferenced term.namespace.name -> TypeError
 *    on first render; no error boundary -> the WHOLE app unmounted to a blank page.
 *
 * Case 1 pins the backend fix end-to-end (wire payload + rendered page + the F-056 deeplink rewrite).
 * Case 2 pins the frontend guard by forcing the pre-fix wire shape (namespace:null) through route
 * interception — the page must degrade gracefully, never white-screen, even if a future backend
 * regression re-violates the contract. Applied-guard: the interception counts what it nulled, so a
 * non-firing route can never false-green (route-interception case-law).
 */

const PARENT = 'IT127CrossNsParent';
const LINKED = 'IT127CrossNsLinked';
const LINKED_NS = 'IT127-linked-ns';

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('IT-127 — term overview with a cross-namespace linked term (#1746)', () => {
  test('case 1 — the wire payload resolves every linked-term namespace and the page renders', async ({
    page,
  }) => {
    const { parentId, linkedId } = await seedCrossNamespaceLinkedTerms(PARENT, LINKED);
    const errors = collectPageErrors(page);

    const detail = page.waitForResponse(
      (r) => r.url().endsWith(`/api/terms/${parentId}`) && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto(`/terms/${parentId}/overview`);
    const payload = (await (await detail).json()) as {
      terms: Array<{ term: { id: number; namespace: { name: string } | null } }>;
    };

    // the spec contract: TermRef.namespace is required — never null on the wire
    expect(payload.terms.length, 'the parent term must carry its linked term').toBeGreaterThan(0);
    for (const lt of payload.terms) {
      expect(lt.term.namespace, `linked term ${lt.term.id} must carry its namespace`).not.toBeNull();
    }
    const cross = payload.terms.find((lt) => lt.term.id === linkedId);
    expect(cross?.term.namespace?.name, 'the linked term must keep ITS OWN namespace').toBe(LINKED_NS);

    // the operator-visible promise: the overview RENDERS (the unfixed build white-screens)
    await expect(page.getByText(PARENT).first(), 'the term name must render').toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Definition').first(), 'the definition block must render').toBeVisible();
    // F-056 promise: the [[ns:term]] mention rewrites to a deeplink of the linked term
    await expect(
      page.locator(`a[href*="/terms/${linkedId}"]`).first(),
      'the cross-namespace mention must rewrite to the linked-term deeplink',
    ).toBeVisible({ timeout: 10_000 });

    expect(errors, `no render crash expected, got: ${errors.join(' | ')}`).toEqual([]);
  });

  test('case 2 — a contract-violating namespace:null payload degrades gracefully, never a white screen', async ({
    page,
  }) => {
    const { parentId } = await seedCrossNamespaceLinkedTerms(PARENT, LINKED);
    const errors = collectPageErrors(page);

    // force the pre-fix wire shape: every linked term's namespace nulled. The applied-guard
    // (injected counter) makes a silently non-firing route fail the test instead of false-greening.
    let injected = 0;
    await page.route(`**/api/terms/${parentId}`, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const lt of body.terms ?? []) {
        lt.term.namespace = null;
        injected += 1;
      }
      await route.fulfill({ response, json: body });
    });

    await page.goto(`/terms/${parentId}/overview`);

    await expect(
      page.getByText(PARENT).first(),
      'the term name must render even on a namespace:null payload',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Definition').first(),
      'the definition block must render even on a namespace:null payload',
    ).toBeVisible();

    expect(injected, 'the interception must have nulled at least one linked-term namespace').toBeGreaterThan(0);
    expect(
      errors.filter((e) => e.includes('Cannot read properties of null')),
      'the null-namespace guard must prevent the initializer crash',
    ).toEqual([]);
  });
});

import { test, expect } from '@playwright/test';
import { seedEntityMetadata } from '../helpers/db';

/**
 * IT-040 — F-046 Custom Metadata Field Catalogue (autocomplete discovery).
 *
 * Protocol: integration-tests/protocols/IT-040-metadata-catalogue.md
 * Gates: validates F-046 (the INTERNAL metadata-field catalogue is queryable; a query filters).
 *
 * Operators curate custom (INTERNAL-origin) metadata fields; the catalogue at
 * GET /api/metadata/fields backs the "add custom metadata" autocomplete so a field defined once is
 * reusable everywhere. A query must match the field and exclude non-matches. Operator consequence of
 * failure: duplicate fields proliferate (the same field re-typed because the catalogue didn't surface it).
 */
const FIELD = 'it040_cost_center';

async function namesFor(request: import('@playwright/test').APIRequestContext, query: string): Promise<string[]> {
  const res = await request.get(`/api/metadata/fields?query=${query}`);
  expect(res.status(), 'metadata catalogue -> 200').toBe(200);
  const json = (await res.json()) as { items?: Array<{ name?: string }> };
  return (json.items ?? []).map((f) => f.name ?? '');
}

test.describe('F-046 Custom Metadata Field Catalogue — autocomplete discovery', () => {
  test('a seeded INTERNAL metadata field is discoverable via the catalogue query', async ({ request }) => {
    await seedEntityMetadata(FIELD, 'it040-value');
    expect(await namesFor(request, 'it040'), 'the seeded INTERNAL field must be in the catalogue').toContain(FIELD);
  });

  test('a non-matching query does not return the field (autocomplete filters)', async ({ request }) => {
    await seedEntityMetadata(FIELD, 'it040-value');
    expect(
      await namesFor(request, 'zzznotamatch'),
      'a non-matching query must not return the seeded field',
    ).not.toContain(FIELD);
  });
});

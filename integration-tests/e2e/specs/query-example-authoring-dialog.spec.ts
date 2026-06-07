import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-086 — F-131 Query Example Authoring Dialog (Create): the real UI write flow.
 * Open the Create dialog from the Query Examples list, fill Definition + the Query
 * Markdown editor, submit, and verify the new example renders on its details page AND
 * exists in the DB (ground-truth read-back).
 *
 * Protocol: integration-tests/protocols/IT-086-query-example-authoring-dialog.md
 * Gates: validates F-131 (UC-002 one submit creates exactly one example; UC-012 dialog
 *        auto-closes + routes to the fresh details page).
 *
 * GROUND TRUTH (read from source, 2026-06-07):
 *  - The "Add query example" button (QueryExamples.tsx:36-46) is wrapped in
 *    <WithPermissions QUERY_EXAMPLE_CREATE> — under AUTH_TYPE=DISABLED every permission is
 *    granted, so the button renders. Clicking it opens the DialogWrapper holding
 *    QueryExampleForm (QueryExampleForm.tsx).
 *  - Two fields: `definition` is a plain <Input label="Definition"> (line 86); `query` is a
 *    <Markdown editor> (line 105-111) = @uiw/react-md-editor <MDEditor preview='edit'> with a
 *    real <textarea> inside #md-editor (Markdown.tsx:103-111). Both validate only
 *    required + non-empty-after-trim; the Save button "Add query example" is
 *    `disabled={!formState.isValid}` (line 124), validated mode:'onChange'.
 *  - Submit (onSubmit, line 54-67) calls useCreateQueryExample → POST /api/queryexample
 *    (QueryExampleController.createQueryExamples, returns 200 + QueryExampleDetails with id),
 *    then reset() + navigate(queryExamplesPath(qe.id)) → /data-modelling/query-examples/{id}.
 *    The details container header renders `Query Example #${id}`
 *    (QueryExampleDetailsContainer.tsx:47) and the Overview shows the Definition + Query
 *    via <Markdown> (QueryExampleDetailsOverview.tsx). Verified live (2026-06-07): POST
 *    /api/queryexample stores definition+query verbatim and the row is immediately readable.
 *
 * NAMESPACE: ids 20860-20869; definition prefixed it086_. The created id is auto-assigned
 *  (bigserial), so we read the created row back BY its unique definition (idempotent cleanup
 *  on every run by that definition prefix).
 */
const STAMP = 'it086zauth';
const DEFINITION = `it086_ authored-via-dialog ${STAMP}`;
const QUERY = `SELECT * FROM it086_authored WHERE marker = '${STAMP}'`;

async function cleanup(): Promise<void> {
  // Remove any prior run's example(s) authored by this spec (match the unique definition).
  await dbQuery(
    `DELETE FROM query_example_search_entrypoint qse USING query_example q
     WHERE qse.query_example_id = q.id AND q.definition = $1`,
    [DEFINITION],
  );
  await dbQuery('DELETE FROM query_example WHERE definition = $1', [DEFINITION]);
}

test.describe('F-131 Query Example Authoring Dialog — create flow writes UI→backend→DB', () => {
  test.beforeEach(async () => {
    await cleanup();
  });
  test.afterEach(async () => {
    await cleanup();
  });

  test('creating a query example via the dialog renders it on the details page and persists it in the DB', async ({
    page,
  }) => {
    await page.goto('/data-modelling/query-examples');

    // Open the authoring dialog.
    await page.getByRole('button', { name: 'Add query example' }).click();

    // Fill Definition. The custom <Input> renders the field as <input name="definition"> (the
    // "Definition" label is a styled span, not a <label for>, so we target by name attribute).
    const definitionField = page.locator('input[name="definition"]');
    await expect(definitionField, 'the Definition field must render in the dialog').toBeVisible({
      timeout: 10_000,
    });
    await definitionField.fill(DEFINITION);

    // Fill the Query Markdown editor (MDEditor renders a real <textarea> inside #md-editor).
    const queryEditor = page.locator('#md-editor textarea').first();
    await expect(queryEditor, 'the Query Markdown editor must render in the dialog').toBeVisible({
      timeout: 10_000,
    });
    await queryEditor.click();
    await queryEditor.fill(QUERY);

    // Submit — the Save button enables only when the form is valid (presence + trim).
    const submit = page.getByRole('button', { name: 'Add query example', exact: true }).last();
    await expect(submit, 'the submit button must enable once both fields are valid').toBeEnabled({
      timeout: 10_000,
    });

    // The create POST returns the new id; capture it to assert navigation + DB read-back.
    const createResp = page.waitForResponse(
      (r) => /\/api\/queryexample(\?|$)/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
    );
    await submit.click();
    const created = await (await createResp).json();
    const newId = Number(created.id);
    expect(newId, 'the create endpoint must return a numeric id').toBeGreaterThan(0);

    // PRIMARY assertion: the UI auto-navigates to the fresh details page header.
    await expect(
      page.getByText(`Query Example #${newId}`),
      'after create the dialog must route to the new query example details page',
    ).toBeVisible({ timeout: 15_000 });

    // The Overview renders the authored Definition + Query the user just typed.
    await expect(
      page.getByText(DEFINITION, { exact: false }).first(),
      'the details Overview must render the authored definition',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(STAMP, { exact: false }).first(),
      'the details Overview must render the authored query body (contains the unique marker)',
    ).toBeVisible({ timeout: 10_000 });

    // GROUND TRUTH: the row exists in the DB exactly once, with verbatim definition + query.
    const rows = await dbQuery<{ id: string; definition: string; query: string }>(
      'SELECT id, definition, query FROM query_example WHERE definition = $1 AND is_deleted = false',
      [DEFINITION],
    );
    expect(rows.length, 'exactly one query example must be persisted (amplification_factor 1)').toBe(1);
    expect(Number(rows[0].id)).toBe(newId);
    expect(rows[0].query).toBe(QUERY);
  });
});

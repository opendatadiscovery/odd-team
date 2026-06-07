import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db';

/**
 * IT-083 — F-154 Term Create / Edit Form: the "Add term" dialog is a true UI write flow — filling
 * Name + Namespace + Definition and submitting creates the term (rendered on its detail page AND a
 * row in the `term` table) and navigates to the new term's detail page.
 *
 * Protocol: integration-tests/protocols/IT-083-term-create-edit-form.md
 * Gates: validates F-154 — H-001 (Add term with valid Name/Namespace/Definition creates the term and
 *        navigates to its detail page) + H-012 (blank/whitespace Name blocks submit).
 *
 * GROUND-TRUTH (read 2026-06): the "Add term" CTA lives on the Dictionary header
 * (TermSearchHeader.tsx:18-20, route /termsearch → App.tsx:63) and mounts TermsForm
 * (TermSearch/TermForm/TermsForm.tsx). The dialog (DialogWrapper → MUI Dialog) has three fields:
 * Name (Input placeholder "Start enter the name", :157), Namespace (NamespaceAutocomplete,
 * placeholder "Namespace", freeSolo — :161-167), Definition (Markdown editor, id='md-editor' textarea,
 * :183). Submit button text "Add term", disabled while `!formState.isValid` (:192-198). On success
 * the redux createTerm thunk → POST /api/terms, then navigate(termDetailsPath(response.id)) (:110).
 * Under DISABLED auth the admin principal holds TERM_CREATE (verified via /api/identity/whoami).
 *
 * The namespace is PRE-SEEDED so the autocomplete shows a real option (deterministic selection),
 * independent of the novel-namespace create side-channel (a separate F-154 facet). The term is
 * deleted up-front so the run is repeatable against the shared external stack.
 */
const NS = 'it083_ns';
const TERM_NAME = 'it083_NewTerm';
const DEFINITION = 'it083 definition authored through the Add term dialog';

async function getOrCreateNamespace(name: string): Promise<number> {
  const sel = await dbQuery<{ id: number }>('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [name]);
  if (sel[0]) return Number(sel[0].id);
  const ins = await dbQuery<{ id: number }>('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [name]);
  return Number(ins[0].id);
}

async function deleteTermByName(name: string): Promise<void> {
  // FK-safe teardown of any prior run's term + its search-entrypoint + link rows.
  const rows = await dbQuery<{ id: number }>('SELECT id FROM term WHERE name = $1', [name]);
  for (const r of rows) {
    await dbQuery('DELETE FROM term_search_entrypoint WHERE term_id = $1', [r.id]);
    await dbQuery('DELETE FROM tag_to_term WHERE term_id = $1', [r.id]);
    await dbQuery('DELETE FROM data_entity_to_term WHERE term_id = $1', [r.id]);
    await dbQuery('DELETE FROM term_to_term WHERE target_term_id = $1 OR assigned_term_id = $1', [r.id]);
    await dbQuery('DELETE FROM term WHERE id = $1', [r.id]);
  }
}

test.describe('F-154 Term create form — the Add term dialog creates a term (UI write)', () => {
  test('H-001: Add term with Name/Namespace/Definition creates the term and navigates to its detail page', async ({
    page,
  }) => {
    await getOrCreateNamespace(NS);
    await deleteTermByName(TERM_NAME);

    await page.goto('/termsearch');

    // Open the dialog from the "Add term" CTA.
    await page.getByRole('button', { name: 'Add term' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'the Add term dialog must open').toBeVisible({ timeout: 10_000 });

    // Name.
    await dialog.getByPlaceholder('Start enter the name').fill(TERM_NAME);

    // Namespace — type the pre-seeded namespace, then pick the matching option from the listbox.
    const nsInput = dialog.getByPlaceholder('Namespace');
    await nsInput.click();
    await nsInput.fill(NS);
    // The async (debounced) options list resolves; click the option whose text is our namespace.
    const nsOption = page.getByRole('option', { name: NS }).first();
    await nsOption.waitFor({ state: 'visible', timeout: 10_000 });
    await nsOption.click();

    // Definition — the MD editor textarea.
    const definitionEditor = dialog.locator('#md-editor textarea').first();
    await definitionEditor.fill(DEFINITION);

    // Submit. The button enables only when the form is valid (all three required fields set).
    const submit = dialog.getByRole('button', { name: 'Add term', exact: true });
    await expect(submit, 'submit must be enabled once the form is valid').toBeEnabled({ timeout: 10_000 });

    const createResp = page.waitForResponse(
      (r) => r.url().endsWith('/api/terms') && r.request().method() === 'POST',
    );
    await submit.click();
    const resp = await createResp;
    expect(resp.status(), 'POST /api/terms must succeed (2xx)').toBeLessThan(300);

    // The app navigates to the new term's detail page; the term name renders there.
    await page.waitForURL(/\/terms\/\d+\//, { timeout: 15_000 });
    await expect(
      page.getByText(TERM_NAME).first(),
      'the created term name must render on its detail page',
    ).toBeVisible({ timeout: 10_000 });

    // DB ground truth — the term row exists with the typed definition + namespace.
    const created = await dbQuery<{ id: number; definition: string }>(
      `SELECT t.id, t.definition FROM term t
       JOIN namespace n ON n.id = t.namespace_id
       WHERE t.name = $1 AND n.name = $2`,
      [TERM_NAME, NS],
    );
    expect(created.length, 'exactly one term row must be created').toBe(1);
    expect(created[0].definition, 'the created term must carry the typed definition').toBe(DEFINITION);
  });

  test('H-012: a blank/whitespace Name leaves the submit button disabled (required-field guard)', async ({
    page,
  }) => {
    await getOrCreateNamespace(NS);

    await page.goto('/termsearch');
    await page.getByRole('button', { name: 'Add term' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill only whitespace in Name; set namespace + definition so ONLY the name is invalid.
    await dialog.getByPlaceholder('Start enter the name').fill('   ');

    const nsInput = dialog.getByPlaceholder('Namespace');
    await nsInput.click();
    await nsInput.fill(NS);
    const nsOption = page.getByRole('option', { name: NS }).first();
    await nsOption.waitFor({ state: 'visible', timeout: 10_000 });
    await nsOption.click();

    await dialog.locator('#md-editor textarea').first().fill('a valid definition');

    // The name validator is `value => !!value.trim()` — whitespace-only is invalid, so submit stays disabled.
    await expect(
      dialog.getByRole('button', { name: 'Add term', exact: true }),
      'submit must stay disabled while Name is whitespace-only',
    ).toBeDisabled({ timeout: 10_000 });
  });
});

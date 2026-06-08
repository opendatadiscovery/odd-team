import { test, expect } from '@playwright/test';

/**
 * IT-099 — F-162 Integration Wizard argument-form UX (IntegrationCodeSnippetWithForm).
 *
 * Protocol: integration-tests/protocols/IT-099-integration-wizard-form.md
 * Gates: validates F-162 (UC-1 one labelled field per declared arg · UC-2 Configure substitutes the
 *        typed values into the rendered snippet · UC-6 the static platform_url is injected INVISIBLY).
 *
 * F-162 is the wizard's operator-facing AUTHORING surface: the operator types argument values into a
 * client-side form, clicks Configure, and the server-supplied Handlebars template is rendered as Markdown
 * (a YAML code-fence) with the values substituted in — the text they copy-paste into their collector
 * config. This is a UI feature, so it drives the REAL browser (page.goto -> rendered DOM) and asserts on
 * the rendered DOM, with a waitForResponse on the React-Query integration fetch first (react-query caveat).
 *
 * GROUNDED LIVE (2026-06-07, DISABLED) against the postgresql wizard:
 *   GET /api/integrations/postgresql -> content_blocks [Overview (0 snippets), Configure (1 snippet, 7 args)].
 *   The form (IntegrationCodeSnippetWithForm.tsx:37-110) renders one labelled <Input> per non-static,
 *   non-boolean argument: "Data source name", "Data source description", "Database name", "Host", "Port",
 *   "User". The first arg platform_url has name=null + a staticValue -> rendered as a display:none hidden
 *   input (NOT visible to the operator). Configure (disabled until formState.isValid) flips showForm=false
 *   and renders <Markdown> of the compiled template -> a YAML block containing
 *   `platform_host_url: http://your.odd.platform` and `name: <typed ds_name>`.
 *   Route: the per-title tab path is the raw title, so the Configure form lives at
 *   /management/integrations/postgresql/Configure (the default route redirects to Overview, which has
 *   no form).
 *
 * Operator caveat (pinned via UC-6): the platform_url substitution is rendered into a display:none input,
 * so the operator never SEES that http://your.odd.platform is being baked into their snippet — combined
 * with the unset-default placeholder (F-033) they silently ship a non-routable collector config. The pin
 * asserts the static value reaches the rendered snippet while staying invisible in the form.
 */

const INTEGRATION = 'postgresql';
const CONFIGURE_PATH = `/management/integrations/${INTEGRATION}/Configure`;

// The argument LABELS the form renders for postgresql (arg.name), in manifest order, minus the
// name=null static platform_url. Each maps to an <Input placeholder={`Enter ${name} ...`}>.
const FIELD_LABELS = [
  'Data source name',
  'Data source description',
  'Database name',
  'Host',
  'Port',
  'User',
];

const integrationFetch = (page: import('@playwright/test').Page) =>
  page.waitForResponse(
    (r) =>
      new RegExp(`/api/integrations/${INTEGRATION}(\\?|$)`).test(r.url()) &&
      r.request().method() === 'GET' &&
      r.ok(),
  );

test.describe('F-162 Integration Wizard argument-form — render + configure + substitute', () => {
  test('UC-1: the argument form renders one labelled field per declared (non-static) argument', async ({
    page,
  }) => {
    const fetched = integrationFetch(page);
    await page.goto(CONFIGURE_PATH);
    await fetched;

    // each declared argument becomes a labelled field — assert the label text is rendered
    for (const label of FIELD_LABELS) {
      await expect(
        page.getByText(label, { exact: true }).first(),
        `UC-1: the form renders a field labelled "${label}"`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // and the input for a representative field is present + editable (the placeholder is `Enter <name> ...`)
    const hostInput = page.getByPlaceholder('Enter Host ...');
    await expect(hostInput, 'UC-1: the Host argument renders an editable input').toBeVisible();

    // the Configure button exists and is disabled until the required fields are filled
    await expect(
      page.getByRole('button', { name: 'Configure' }),
      'UC-1: a Configure submit button is rendered',
    ).toBeVisible();
  });

  test('UC-2 + UC-6: filling the fields and clicking Configure renders the snippet with typed values + the invisibly-injected platform_url', async ({
    page,
  }) => {
    const fetched = integrationFetch(page);
    await page.goto(CONFIGURE_PATH);
    await fetched;

    const dsName = 'it099_pg_source';
    const values: Record<string, string> = {
      'Data source name': dsName,
      'Data source description': 'it099 e2e wizard form',
      'Database name': 'it099_db',
      Host: 'it099-host.local',
      Port: '5432',
      User: 'it099_user',
    };

    // fill every required field (the form gates Configure on formState.isValid)
    for (const [label, value] of Object.entries(values)) {
      const input = page.getByPlaceholder(`Enter ${label} ...`);
      await input.fill(value);
    }

    // UC-6 (pinned): the static platform_url argument is rendered as a hidden (display:none) input — it
    // exists in the form DOM but is NOT visible to the operator. The literal placeholder text never
    // appears as visible text while the form is shown.
    const hiddenStatic = page.locator('input[value="http://your.odd.platform"]');
    await expect(
      hiddenStatic,
      'UC-6: the static platform_url is registered as a hidden form input',
    ).toBeAttached();
    await expect(
      hiddenStatic,
      'UC-6 pin: the static platform_url input is invisible to the operator (display:none)',
    ).toBeHidden();

    // ---- act: Configure (enabled once the required fields validate) ----
    const configureBtn = page.getByRole('button', { name: 'Configure' });
    await expect(configureBtn, 'Configure enables once all required fields are filled').toBeEnabled({
      timeout: 10_000,
    });
    await configureBtn.click();

    // ---- the panel transitions to the configured view: Reconfigure + the rendered snippet ----
    await expect(
      page.getByRole('button', { name: 'Reconfigure' }),
      'UC-2: after Configure the panel shows the Reconfigure affordance',
    ).toBeVisible({ timeout: 10_000 });

    // UC-2: the rendered Markdown snippet contains the typed data-source name (substituted into the
    // {{ ds_name }} template slot).
    await expect(
      page.getByText(new RegExp(`name:\\s*${dsName}`)).first(),
      'UC-2: the rendered snippet substitutes the typed ds_name into the YAML',
    ).toBeVisible({ timeout: 10_000 });

    // UC-6/UC-2: the rendered snippet ALSO carries the invisibly-injected platform_url placeholder
    // (now visible only in the OUTPUT, never in the form input) — the bake-in the operator copies.
    await expect(
      page.getByText(/platform_host_url:\s*http:\/\/your\.odd\.platform/).first(),
      'UC-6: the static platform_url placeholder is baked into the rendered snippet text',
    ).toBeVisible({ timeout: 10_000 });
  });
});

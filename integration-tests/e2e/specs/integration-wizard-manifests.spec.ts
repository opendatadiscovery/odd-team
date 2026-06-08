import { test, expect } from '@playwright/test';

/**
 * IT-098 — F-033 Integration Wizard: classpath-loaded YAML manifests served with config snippets.
 *
 * Protocol: integration-tests/protocols/IT-098-integration-wizard-manifests.md
 * Gates: validates F-033 (UC-09 full registry list · UC-03/UC-08 platform_url substitution ·
 *        UC-05 case-insensitive lookup · UC-02 dead installed field · UC-04 missing-id behaviour pin).
 *
 * The Integration Wizard surface — IntegrationController exposes GET /api/integrations (the preview
 * list) + GET /api/integrations/{id} (the full Integration with platform_url-substituted code snippets).
 * Both are backed by a classpath-loaded META-INF/wizard/*.yaml registry built once at boot. This is the
 * platform's copy-paste affordance for collector setup. API/config-level e2e — assert on the response
 * BODY (parsed JSON), never a status code alone.
 *
 * GROUNDED LIVE (2026-06-07, anon under DISABLED, against the shipped odd-platform image whose docker
 * classpath carries the wizard overlays — i.e. the manifests ARE present here, unlike a bare source
 * checkout):
 *   GET /api/integrations -> 200 {items:[{id,name,description,installed:false}, ...]} incl. "postgresql".
 *   GET /api/integrations/postgresql -> 200 {id,name,description,installed:false,content_blocks:[...]}
 *     whose "Configure" block's code_snippet template substitutes {{platform_url}} ->
 *     "http://your.odd.platform" (the unset-default placeholder) and declares the collector config args
 *     (ds_name, plugin_host, plugin_port:INTEGER, plugin_user, ...).
 *   GET /api/integrations/{AIRBYTE|Airbyte|airbyte} -> all 200, byte-identical (case-insensitive lookup).
 *   GET /api/integrations/<unknown> -> 200 with an EMPTY body (content-length 0). NB: the ontology +
 *     OpenAPI claimed 204; the live shipped image returns 200-empty. This spec PINS the ACTUAL behaviour
 *     (LSN-029) — it stays GREEN today and flips RED the day a proper 404 (NotFoundException) ships.
 *
 * Operator caveat (pinned): under DISABLED these endpoints are anonymously readable; the substituted
 * platform_url leaks to any network caller, and the default placeholder bakes into copy-pasted snippets
 * until odd.platform-base-url is set. (F-033 facets default_platform_url_placeholder / disabled_mode_
 * anonymous_reachability — doc-side tracked as DOC-GAP-279 / DOC-256.)
 */

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

interface PreviewItem {
  id: string;
  name: string;
  description: string;
  installed: boolean;
}
interface Argument {
  name: string | null;
  parameter: string;
  type: string;
  static_value?: string | null;
}
interface CodeSnippet {
  template: string;
  arguments?: Argument[];
}
interface ContentBlock {
  title: string;
  content: string;
  code_snippets?: CodeSnippet[];
}
interface Integration {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  content_blocks: ContentBlock[];
}

test.describe('F-033 Integration Wizard — classpath manifests served with config', () => {
  test('UC-09 + UC-02: GET /api/integrations returns the full registry; every preview carries installed=false (dead field)', async () => {
    const res = await fetch(`${BASE}/api/integrations`);
    expect(res.status, 'the wizard preview list endpoint returns 200').toBe(200);
    const body = (await res.json()) as { items: PreviewItem[] };

    expect(Array.isArray(body.items), 'the response carries an items array').toBe(true);
    expect(
      body.items.length,
      'the registry is non-empty (the shipped image overlays META-INF/wizard/*.yaml on the classpath)',
    ).toBeGreaterThan(0);

    // a known integration is present with its human name
    const pg = body.items.find((i) => i.id === 'postgresql');
    expect(pg, 'a known integration (postgresql) is present in the registry').toBeTruthy();
    expect(pg!.name, 'the preview carries the human-readable name').toBe('PostgreSQL');

    // UC-02 (LSN-029 pin): the `installed` field is hardcoded false for EVERY manifest — the UI's
    // "Integrated" badge is structurally dead. GREEN today; flips RED if real install-detection ships.
    expect(
      body.items.every((i) => i.installed === false),
      'UC-02 dead-field pin: every integration reports installed=false (IntegrationMapper @Mapping constant)',
    ).toBe(true);
  });

  test('UC-03 + UC-08: GET /api/integrations/postgresql returns content_blocks with platform_url substituted + the config args', async () => {
    const res = await fetch(`${BASE}/api/integrations/postgresql`);
    expect(res.status, 'the single-integration endpoint returns 200 for a known id').toBe(200);
    const integ = (await res.json()) as Integration;

    expect(integ.id, 'the payload echoes the requested id').toBe('postgresql');
    expect(
      Array.isArray(integ.content_blocks) && integ.content_blocks.length > 0,
      'the integration carries content_blocks',
    ).toBe(true);

    // find the code snippet (the Configure block carries the parameterised template)
    const snippets = integ.content_blocks.flatMap((b) => b.code_snippets ?? []);
    const snippet = snippets.find((s) => (s.arguments ?? []).length > 0);
    expect(snippet, 'a code snippet with declared arguments is served (the copy-paste config)').toBeTruthy();

    // UC-08 platform_url substitution: the backend's role is to supply the SUBSTITUTION VALUE for
    // platform_url as the static_value of a static argument (StaticArgumentMappingContext sourcing
    // odd.platform-base-url, here the unset-default placeholder). The template itself still carries the
    // raw `{{ platform_url }}` Handlebars slot — the actual bake-in happens client-side (F-162 / IT-099
    // renders it). So at the API tier we assert: (a) the static value is the placeholder, and (b) the
    // template declares the matching slot the client will substitute.
    const platformArg = (snippet!.arguments ?? []).find((a) => a.parameter === 'platform_url');
    expect(platformArg, 'the snippet declares the static platform_url argument').toBeTruthy();
    expect(
      platformArg!.static_value,
      'UC-03/UC-08: the backend supplies platform_url = the unset-default placeholder (odd.platform-base-url commented out)',
    ).toBe('http://your.odd.platform');
    expect(
      snippet!.template,
      'the template declares the {{ platform_url }} slot the client substitutes the static value into',
    ).toMatch(/\{\{\s*platform_url\s*\}\}/);

    // the snippet declares the real collector config args (so it is genuinely useful, not a stub)
    const paramNames = (snippet!.arguments ?? []).map((a) => a.parameter);
    expect(paramNames, 'the postgres snippet declares the data-source name arg').toContain('ds_name');
    expect(paramNames, 'the postgres snippet declares the host arg').toContain('plugin_host');
    const portArg = (snippet!.arguments ?? []).find((a) => a.parameter === 'plugin_port');
    expect(portArg?.type, 'the port arg is typed INTEGER in the manifest schema').toBe('INTEGER');
  });

  test('UC-05: integration lookup is case-insensitive — Airbyte / AIRBYTE / airbyte resolve to the same manifest', async () => {
    const [lower, title, upper] = await Promise.all(
      ['airbyte', 'Airbyte', 'AIRBYTE'].map((id) => fetch(`${BASE}/api/integrations/${id}`)),
    );
    expect(lower.status, 'lowercase id resolves (200)').toBe(200);
    expect(title.status, 'TitleCase id resolves (200)').toBe(200);
    expect(upper.status, 'UPPERCASE id resolves (200)').toBe(200);

    const [a, b, c] = await Promise.all([lower.json(), title.json(), upper.json()]);
    expect((a as Integration).id, 'the manifest id is canonical lowercase regardless of request casing').toBe('airbyte');
    expect(
      JSON.stringify(b),
      'UC-05 case-insensitive: a TitleCase request returns the identical manifest',
    ).toBe(JSON.stringify(a));
    expect(
      JSON.stringify(c),
      'UC-05 case-insensitive: an UPPERCASE request returns the identical manifest',
    ).toBe(JSON.stringify(a));
  });

  test('UC-04: GET /api/integrations/{unknown-id} returns 200 with an EMPTY body — NOT 404 (LSN-029 characterization pin)', async () => {
    // CONTRADICTS the ontology + OpenAPI, which claimed 204. The live shipped image returns 200 with a
    // zero-length body (the registry's Mono.empty short-circuits .map(ResponseEntity::ok); WebFlux emits
    // an empty 200, not 204, in this build). We PIN THE ACTUAL behaviour: it is GREEN today and flips RED
    // the day a proper 404 NotFoundException is wired (the F-033 silent_204_on_missing_id remediation).
    // KNOWN BUG (PLT-149): missing-id has no 404 — the existence oracle is a 200/empty-body, and the
    // OpenAPI contract documents neither this nor a 204 (the ontology's recorded "204" was itself wrong).
    const res = await fetch(`${BASE}/api/integrations/this-id-does-not-exist-it098`);
    expect(
      res.status,
      'UC-04 pin: an unknown integration id returns 200 (not 404, and not the 204 the ontology claimed)',
    ).toBe(200);
    const text = await res.text();
    expect(text, 'UC-04 pin: the unknown-id 200 carries an EMPTY body').toBe('');

    // contrast: a known id returns a non-empty JSON body at the same endpoint shape
    const known = await fetch(`${BASE}/api/integrations/postgresql`);
    expect(known.status, 'a known id returns 200').toBe(200);
    expect((await known.text()).length, 'a known id returns a non-empty body').toBeGreaterThan(0);
  });
});

---
id: IT-099
title: "Integration Wizard argument-form — labelled field per arg, Configure substitutes typed values + invisibly-injected platform_url into the rendered snippet"
gates:
  validates: [F-162]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:integration-wizard-form.spec.ts"
plan_ref: I5
status: ready
---

# IT-099 — F-162 Integration Wizard argument-form UX

## 1. What this checks

F-162 is the wizard's operator-facing **authoring** surface (`IntegrationCodeSnippetWithForm`): the operator
types argument values into a client-side form, clicks Configure, and the server-supplied Handlebars template
is rendered as Markdown (a YAML code-fence) with the values substituted — the text they copy-paste into their
collector config. UI feature → drives the REAL browser (`page.goto` → rendered DOM), with a `waitForResponse`
on the React-Query integration fetch first (react-query caveat). Three claims:

- **UC-1 (CONFIRMED):** the form renders one labelled field per non-static, non-boolean argument. For
  `postgresql`: "Data source name", "Data source description", "Database name", "Host", "Port", "User".
  Each is an `<Input placeholder="Enter <name> ...">`. A Configure submit button is rendered.
- **UC-6 (CONTRADICTED → pin):** the static `platform_url` argument (name=null, has a staticValue) renders
  as a `display:none` hidden input — the operator NEVER sees the value being baked in. The pin asserts the
  static input is attached but hidden, and that the value surfaces only in the rendered OUTPUT.
- **UC-2 (CONFIRMED):** filling the required fields enables Configure; clicking it flips the panel to the
  configured view (Reconfigure + the rendered Markdown), and the rendered snippet substitutes the typed
  `ds_name` (`name: <value>`) AND carries the invisibly-injected `platform_url`
  (`platform_host_url: http://your.odd.platform`).

**Operator consequence (pinned via UC-6):** because the platform_url substitution is invisible in the form,
the operator can silently ship a non-routable collector config when the platform default placeholder
(`http://your.odd.platform`, F-033) is still in effect — the misconfiguration is only visible in the output.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack. The shipped
  image carries the wizard overlays (so `postgresql` is on the classpath).
- **Auth/config:** DISABLED → the wizard UI is reachable. `odd.platform-base-url` unset (default placeholder).
- **Seed:** none. The form is client-only; no values persist server-side (Configure is a local render).
- **Route:** the per-title tab path is the raw content title, so the Configure form lives at
  `/management/integrations/postgresql/Configure` (the default route redirects to Overview, which has no form).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- The target wizard has an arg-bearing snippet: `GET /api/integrations/postgresql` →
  `content_blocks[*].code_snippets[*].arguments` non-empty (incl. `platform_url` with static_value + `ds_name`/`plugin_host`/…).

## 4. Run protocol

1. `page.goto('/management/integrations/postgresql/Configure')`; wait for GET `/api/integrations/postgresql`.
2. Assert each label is visible: "Data source name", "Data source description", "Database name", "Host", "Port", "User";
   the Host `<input>` (placeholder "Enter Host ...") is editable; a "Configure" button is present.
3. Fill every required field; assert `input[value="http://your.odd.platform"]` is attached but hidden (UC-6).
4. Assert "Configure" becomes enabled, click it.
5. Assert "Reconfigure" appears; the rendered snippet shows `name: <typed ds_name>` and
   `platform_host_url: http://your.odd.platform`.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-099`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/integration-wizard-form.spec.ts`).

## 5. Assertions

- **PASS** when: the form renders a labelled field per declared (non-static) arg + a Configure button; the
  static platform_url input is attached but hidden; Configure enables on a valid form and, on click, renders
  the snippet with the typed `ds_name` substituted AND the platform_url placeholder baked in.
- **FLIPS (RED)** when: the static platform_url becomes a visible/disclosed field (UC-6 remediation — a
  read-only static-substitutions preview shipped). Re-scope the pin.
- **FAIL** when: a declared argument renders no field, Configure never enables on a valid form, or the
  rendered snippet does not substitute the typed values / omits the platform_url bake-in.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-099.md`.

## Cross-references
- Source: F-162 UC-1 (one field per arg, confirmed) · UC-2 (Configure substitutes, confirmed) · UC-6
  (static value injected invisibly, contradicted).
- Plan: `lineage/odd-platform/test-plan.md` batch I5.
- Related: IT-098 (F-033 the registry/classpath chain that serves these manifests + the platform_url
  static_value this form bakes in).

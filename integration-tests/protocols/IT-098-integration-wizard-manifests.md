---
id: IT-098
title: "Integration Wizard manifests — classpath YAML served with config args, case-insensitive lookup, dead installed field, 200-empty on unknown id"
gates:
  validates: [F-033]
  enforces: []
  regresses: [PLT-149]
test_class: integration
stack: odd-minimal
automation: "e2e:integration-wizard-manifests.spec.ts"
plan_ref: I5
status: ready
---

# IT-098 — F-033 Integration Wizard (classpath manifest registry)

## 1. What this checks

`IntegrationController` exposes two endpoints backed by a classpath-loaded `META-INF/wizard/*.yaml` registry
built once at boot: `GET /api/integrations` (preview list) + `GET /api/integrations/{id}` (full Integration
with code snippets). This is the platform's copy-paste affordance for collector setup. API/config-level e2e —
assert on the parsed response BODY, never a status code alone. Five claims:

- **UC-09 (CONFIRMED):** `GET /api/integrations` returns the full registry (`items[]`); a known integration
  (`postgresql` → name `PostgreSQL`) is present.
- **UC-02 (CONTRADICTED → pin):** every preview carries `installed: false` (hardcoded `@Mapping` constant) —
  the UI's "Integrated" badge is structurally dead. GREEN today; flips RED if real install-detection ships.
- **UC-03/UC-08 (PARTIAL/CONFIRMED):** `GET /api/integrations/postgresql` returns `content_blocks` whose
  Configure snippet declares the static `platform_url` argument with `static_value = http://your.odd.platform`
  (the unset-default placeholder, `odd.platform-base-url` commented out) and the real config args
  (`ds_name`, `plugin_host`, `plugin_port:INTEGER`, …). NB the backend supplies the static VALUE; the
  template keeps the raw `{{ platform_url }}` slot — the actual bake-in is client-side (F-162 / IT-099).
- **UC-05 (CONFIRMED):** lookup is case-insensitive — `airbyte` / `Airbyte` / `AIRBYTE` all return the
  identical manifest (canonical id `airbyte`).
- **UC-04 (CONTRADICTED → pin):** `GET /api/integrations/{unknown-id}` returns **HTTP 200 with an EMPTY
  body** — NOT 404, and NOT the 204 the ontology + OpenAPI claimed. **KNOWN BUG** (PLT-needed): missing-id
  has no 404; the existence oracle is a 200/empty-body; the OpenAPI contract documents neither 204 nor this.

**Operator consequence:** under DISABLED these endpoints are anonymously readable; the substituted
`platform_url` leaks to any caller, and the default placeholder bakes into copy-pasted snippets until
`odd.platform-base-url` is set (F-033 default_platform_url_placeholder / disabled_mode_anonymous_reachability;
doc-side tracked as DOC-GAP-279 / DOC-256).

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack.
  NB the **shipped odd-platform image** carries the wizard overlays on its docker classpath, so the registry
  is populated here (a bare source checkout has zero `META-INF/wizard/*.yaml` — F-033 empty-default facet).
- **Auth/config:** DISABLED → both endpoints anonymously reachable. `odd.platform-base-url` unset (default
  placeholder).
- **Seed:** none — the registry is classpath state, read-only, boot-constructed.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Registry populated: `curl -fsS http://localhost:18080/api/integrations | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["items"]))'` → `> 0` (and includes `postgresql`).

## 4. Run protocol

1. `GET /api/integrations` → 200; `items[]` non-empty; contains `{id:postgresql, name:PostgreSQL}`; every item `installed:false`.
2. `GET /api/integrations/postgresql` → 200; a code snippet with `arguments[]`; the `platform_url` arg's
   `static_value == "http://your.odd.platform"`; the template matches `{{ platform_url }}`; args include `ds_name`, `plugin_host`, `plugin_port` (type INTEGER).
3. `GET /api/integrations/{airbyte|Airbyte|AIRBYTE}` → all 200, byte-identical body, canonical id `airbyte`.
4. `GET /api/integrations/this-id-does-not-exist-it098` → **200 with empty body**; a known id at the same
   endpoint returns a non-empty JSON body.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-098`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/integration-wizard-manifests.spec.ts`).

## 5. Assertions

- **PASS (current platform)** when: the list is non-empty with `postgresql`; all previews are `installed:false`;
  the postgres snippet declares `platform_url` static_value = the placeholder + the matching template slot +
  the real config args; case-insensitive lookup returns identical manifests; an unknown id returns 200 + empty body.
- **FLIPS (RED)** when: any preview reports `installed:true` (real detection shipped — UC-02 fixed), OR an
  unknown id returns 404/204 (missing-id remediation shipped — UC-04 fixed), OR lookup becomes case-sensitive,
  OR the placeholder default changes. Each flip is a measurable change — re-scope the pin.
- **FAIL** when: the list endpoint 500s/empties on a populated classpath, or a known single-integration read
  loses its content_blocks / args.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-098.md`.

## Cross-references
- Source: F-033 UC-09 (list, confirmed) · UC-02 (dead installed field, contradicted) · UC-03/08 (platform_url
  substitution) · UC-05 (case-insensitive, confirmed) · UC-04 (missing-id — ontology said 204; LIVE is
  200-empty — pin corrects the record).
- Plan: `lineage/odd-platform/test-plan.md` batch I5.
- Related: IT-099 (F-162 the wizard argument-form UI that renders + substitutes these snippets).

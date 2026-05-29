---
doc_page: "docs/integrations/integration-wizard.md"
page_title: "Integration Wizard"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/integration-wizard"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["operation:list-integrations-wizard-registry", "entitie:collector"]
  features: ["F-033"]
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:IntegrationController"
    - "odd-platform java IntegrationController controller-method:getIntegrationPreviews"
    - "odd-platform java IntegrationController controller-method:getIntegration"
    - "odd-platform java StaticArgumentMappingContext config-key-consumer:odd.platform-base-url@L16"
audience: [operator, developer]
doc_claim_vs_code: []
maintainer_curated: false
---

# Integration Wizard — doc understanding

The page documents the in-app **Integration Wizard** (Management → Integrations): a
data-driven template generator that renders `collector_config.yaml` snippets from
classpath-packaged manifests. It maps cleanly to feature `F-033` ("Integration Wizard
— classpath-loaded YAML manifests served with case-insensitive id lookup + platform_url
substitution") and to the read-surface concept `operation:list-integrations-wizard-registry`
("List + Get Integration Wizard Manifests"). The page's two documented endpoints are the
verbatim methods of `IntegrationController` — `getIntegrationPreviews` (`GET /api/integrations`,
`IntegrationController.java:25-27`) and `getIntegration` (`GET /api/integrations/{integration_id}`,
`IntegrationController.java:18-22`). The Collector entity concept (`entitie:collector`) is a
secondary binding: the "Wizard vs `collector_config.yaml`" section contrasts the wizard's
ephemeral snippet output against the operator-maintained collector config file.

Every load-bearing runtime claim was verified to source (no drift):

- **Static `platform_url` parameter** — confirmed by `StaticArgumentMappingContext`
  (config-key-consumer node `odd.platform-base-url@L16`). The `@Value` consumer is
  `odd.platform-base-url` with the Java default placeholder `http://your.odd.platform`
  (`StaticArgumentMappingContext.java:16`), mapped to the wire param name `platform_url`
  (constant at `:11`, `Map.of` at `:19`). The page's cited range `:11-19` accurately spans
  this block, and the caveat that a fresh deployment pre-fills the placeholder URL is correct.
- **No RBAC gate on the wizard endpoints** — confirmed. `IntegrationController` carries only
  `@RestController` + `@RequiredArgsConstructor`; neither method has a `@PreAuthorize`
  (full file read, 28 lines). A grep for `integration` across the entire `auth/` package
  returns zero matches, so there is no `SecurityRule` entry for `/api/integrations*`. The
  path therefore falls through to the default matcher `spec.pathMatchers("/**").authenticated()`
  (`AuthorizationCustomizer.java:29-30`); `/api/integrations*` is not in `WHITELIST_PATHS`.
  The page's security hint (any-authenticated read; anonymous under `auth.type=DISABLED`;
  no write-level gate) is grounded exactly in code — an LSN-class operator caveat the page
  surfaces correctly rather than omits.
- **Classpath manifest registry** — confirmed by `IntegrationRegistryFactory`: scan location
  `classpath*:META-INF/wizard/*.yaml` (`:26`) via `PathMatchingResourcePatternResolver` (`:25`),
  parsed and stored in a case-insensitive `TreeMap<>(Comparator.comparing(String::toLowerCase))`
  (`:36`). The DTO contract files (`IntegrationOverviewDto`, `IntegrationCodeSnippetArgumentDto`,
  …) exist as named.

Live verification: the mechanical guess `/integrations/integration-wizard` 301-redirects to the
real GitBook slug `/integrations/integrations/integration-wizard` (the doubled `integrations/`
segment is the page-group slug); the resolved URL returns 200 and renders all documented sections
(Static parameters, API surface, Integration registry, the RBAC warning hint).

## Maintainer notes

---
doc_page: "docs/developer-guides/api-reference/integrations.md"
page_title: "Integrations"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/integrations"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "List + Get Integration Wizard Manifests"
    - "Integration Wizard Manifest (classpath META-INF/wizard/*.yaml)"
    - "Integration `installed: boolean` field is hardcoded `false` — structurally-dead UI badge"
    - "Integration getIntegration({unknown-id}) returns 204 No Content, NOT 404"
    - "Integration Wizard endpoints have NO RBAC permission (open-read across all auth modes including anonymous-under-DISABLED)"
  features:
    - "F-033"
  code_nodes:
    - "odd-platform java IntegrationController controller-method:getIntegrationPreviews"
    - "odd-platform java IntegrationController controller-method:getIntegration"
  audience: [developer]
doc_claim_vs_code:
  - "Page documents the two endpoints with NO HTTP status codes; code returns 204 No Content (NOT 404) for GET /api/integrations/{id} on an unknown id — Mono.justOrEmpty(registry.get(id)) yields Mono.empty, short-circuiting the .map chain; Spring WebFlux maps the empty Mono to 204. OpenAPI declares only 200. Direct REST/SDK consumers get an uncontracted response. Evidence: invariant:integration-wizard-204-on-missing-id-not-404-silent-empty / IntegrationController.java:19-22 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + openapi.yaml:75-81."
  - "Page is silent on the authorization posture; both endpoints have NO INTEGRATION_* permission and no SECURITY_RULES entry — they fall through to pathMatchers(\"/**\").authenticated() under LOGIN_FORM/OAUTH2/LDAP (any authenticated user reads the full registry) and to .anyExchange().permitAll() under auth.type=DISABLED (any network caller reads anonymously). Under DISABLED with a non-default odd.platform-base-url set to an internal hostname, that hostname LEAKS via the rendered code-snippet static_value. The posture is intentional (manifests are not secrets) but the doc never states it. Evidence: invariant:integration-wizard-no-rbac-permission-open-read-posture / SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + PolicyPermissionDto (zero INTEGRATION matches)."
  - "Page says the `installed` flag 'is currently always false — a UI affordance reserved for future state-tracking', framing it as a benign placeholder; code shows it is a structurally-dead, REQUIRED contract field hardcoded via @Mapping(target=\"installed\", constant=\"false\") on BOTH mapper shapes — no code path inspects real install state, and the UI's conditional 'Integrated' badge NEVER renders. A consumer reading the REQUIRED field reasonably builds tooling on a value that can never be meaningful. Evidence: invariant:integration-installed-field-hardcoded-false-dead-ui-badge / IntegrationMapper.java:27 + :30 + IntegrationPreviewItem.tsx:44-51 + components.yaml:64-70."
  - "Page does not warn that the wizard registry is EMPTY on a default checkout — there are ZERO META-INF/wizard/*.yaml files in the repo; manifests arrive only via external classpath overlays (vendor jars, docker-image overlays). GET /api/integrations on a stock build returns {items: []}. Evidence: operation:list-integrations-wizard-registry (Behavioural surprise 2) / entitie:integration-wizard-manifest-classpath-meta-inf-yaml + IntegrationRegistryFactory.java:26-40 (classpath*:META-INF/wizard/*.yaml)."
  - "Page documents the `staticValue` of `platform_url` snippet args as 'resolved server-side' without noting the default. When odd.platform-base-url is unset (application.yml:209 is commented out), the substituted value is the placeholder http://your.odd.platform; operators copy-pasting snippets without setting the override point their collector at a non-existent host. Evidence: operation:list-integrations-wizard-registry (Behavioural surprise 7) / StaticArgumentMappingContext.java:16."
maintainer_curated: false
---

# Integrations — doc understanding

This developer-guide page documents the Integration Wizard's HTTP read surface: the two endpoints on `IntegrationController` (`GET /api/integrations` → `getIntegrationPreviews`, `GET /api/integrations/{integration_id}` → `getIntegration`), so a developer can script integration-snippet generation directly instead of going through the wizard UI. The bindings are confirmed: both controller-method nodes (`IntegrationController.java:24` and `:18`) document exactly these two operations, and feature F-033 ("Integration Wizard — classpath-loaded YAML manifests served with case-insensitive id lookup + platform_url substitution") is the implementing flow. The canonical operation/entity/invariant concepts live as graph nodes from batch 2026-05-25-ZD.

The page is **accurate on the happy path** (the methods, paths, operation IDs, response shapes, and the `installed`/snippet-argument structure all match the code) but **omits the operator-critical edges the code enforces**: it documents no HTTP status codes (so misses the 204-not-404 contract drift), is silent on the open-read/anonymous-under-DISABLED authorization posture, frames the dead `installed` field as a benign placeholder rather than a never-true REQUIRED field, and warns of neither the empty-default registry nor the `platform_url` placeholder default. These are LSN-001/LSN-002-class omissions (silent contract mismatch + config disclosure) and are surfaced above as DOC-GAP candidates with `file:line` evidence.

## Catalog note

`concepts.yaml` (v8, generated at commit `ede5d277`, `sidecar_count: 50`) predates the batch-2026-05-25-ZD Integration Wizard enrichment and carries **no** canonical entry for this surface — `processed_node_ids` shows no Integration node was folded in. The five `describes.concepts` names above are therefore bound to the confirmed graph-node titles (verified via `graph-node`), not to catalog entries. A `concepts.yaml` refresh should fold these in; until then the graph nodes are their only canonical home.

## Maintainer notes

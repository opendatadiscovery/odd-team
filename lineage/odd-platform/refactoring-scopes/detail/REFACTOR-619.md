## REFACTOR-619 — Integration Wizard surface — auth posture, default-empty state, case-insensitive contract, status-code semantics, `installed: false` constant, `platform_url` placeholder — undocumented across all live doc pages

**Severity**: MEDIUM
**Category**: doc-code-drift / missing-operator-guidance
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (the wizard's operator-onboarding workflow), P-09 Security & Access Control (the open-read posture)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:docs_link_semantic.doc_drift_findings.[0..4]` (all MEDIUM-severity, five separate drift findings — pulled together here as the integrated doc-side gap):
  - "The live wizard doc page (`integration-wizard` WebFetched 2026-05-25, status 200) is silent on the auth posture — does NOT state that `/api/integrations*` requires authentication under LOGIN_FORM/OAUTH2/LDAP, does NOT state that DISABLED mode allows anonymous access, does NOT mention that there is no RBAC permission specific to the wizard."
  - "The live API-reference page (`api-reference/integrations` WebFetched 2026-05-25, status 200) does NOT document the 204-on-missing-id behaviour — operators cannot read what the response is for an unknown integration id; the page omits response schemas, HTTP status codes, and authentication requirements entirely."
  - "The `installed: boolean` field in the OpenAPI contract is structurally dead — `IntegrationPreview.installed` is REQUIRED per `components.yaml:64-70`, but `IntegrationMapper.java:27, 30` hardcodes `installed: false` on every response. The live API-reference page lists `{id, name, description, installed}` as the IntegrationPreview shape without warning that `installed` is always false."
  - "`platform_url` substitution under default config exposes a placeholder — `application.yml:209` has `odd.platform-base-url` commented out; the `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")` default at `StaticArgumentMappingContext.java:16` resolves to the literal `http://your.odd.platform`."
  - "Case-insensitive id collision is undocumented — the TreeMap comparator `Comparator.comparing(String::toLowerCase)` at `IntegrationRegistryFactory.java:36` + merge function `(o1, o2) -> o2` at line 35 mean two wizard YAMLs with same-lowercased ids silently merge (last-load-wins). No live doc page mentions this constraint on wizard authors."

**Statement**: Five separate doc-side gaps form an INTEGRATED gap at the wizard surface — the wizard feature ships with operator-visible behaviour that no live doc page documents:

1. **Auth posture under each `auth.type` mode** — silent (REFACTOR-616 + cross-link with ADR-CANDIDATE-209's open-read commitment).
2. **204-on-missing-id contract** — silent (REFACTOR-612).
3. **`installed: false` constant** — silent (REFACTOR-611 — the API-reference shape mentions the field but doesn't say it's always false).
4. **`platform_url` placeholder on default config** — partially documented (the fallback exists) but the default-deployment consequence is silent (REFACTOR-615).
5. **Case-insensitive id collision** — silent (REFACTOR-613).

Operators authoring wizard manifests, writing third-party API clients, or auditing the platform's security posture cannot get this information from the docs alone — they must read source code. The wizard feature was shipped without its operator-facing contract documentation; this scope is the doc-side completion for the feature.

**Evidence**:
- WebFetch `https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` 2026-05-25 status 200 (silent on auth, default-empty, installed, case-collision)
- WebFetch `https://docs.opendatadiscovery.org/integrations/integrations` 2026-05-25 status 200 (silent on RBAC, 204-on-missing, installed-false)
- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` 2026-05-25 status 200 (omits response schemas, HTTP status codes, authentication requirements)
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-25 status 200 (no INTEGRATION_* permission listed — correctly reflects code)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-209 (NEW this batch) anchors the architectural commitments; the doc-side fix is the natural follow-through. The scope is one DOC-NNN tranche updating four live pages.

**Proposed remedy**: A coordinated DOC-NNN sprint updating four live doc pages — (1) `/integrations/integrations/integration-wizard` — expand with auth posture (per auth.type mode), default-empty state, case-collision contract; (2) `/integrations/integrations` — name the RBAC posture (no INTEGRATION_* permission; open-read by design); (3) `/developer-guides/api-reference/integrations` — add response schemas, HTTP status codes (200 + 204-on-missing), authentication requirements; (4) `/configuration-and-deployment/enable-security/authentication/disabled-authentication` — add the wizard surface to the enumeration of anonymously-readable endpoints under DISABLED (compose with REFACTOR-616).

**Severity rationale**: MEDIUM — doc-side completion for a shipped feature. Operators consuming the wizard surface today read source code or the wizard's own UI to learn its behaviour; the doc-side gap doesn't break functionality but degrades self-service operator onboarding.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" / "Integration Wizard doc completion" (composes with REFACTOR-611/-612/-613/-614/-615/-616 — the wizard surface has SIX co-surfaced gaps; the doc-side fix is the integrating remedy for the four that are doc-driftable).

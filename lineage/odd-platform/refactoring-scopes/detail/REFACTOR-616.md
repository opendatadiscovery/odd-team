## REFACTOR-616 — Under `auth.type=DISABLED`, the wizard registry (including operator-configured `platform_url`) is anonymously readable; an internal hostname configuration leaks to any network caller

**Severity**: MEDIUM
**Category**: info-disclosure / DISABLED-mode-blast-radius
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (wizard surface anonymous reach under DISABLED), P-09 Security & Access Control (the DISABLED-mode information-disclosure blast radius)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[6]` (MEDIUM) — "Under `auth.type=DISABLED` the wizard surface is anonymously reachable — `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`; any network caller able to reach the HTTP port can `GET /api/integrations` and read every wizard manifest, including the substituted `platform_url`. If operators set `odd.platform-base-url` to an internal hostname (a typical deployment pattern for the `notification` and `slack` paths that share the property), the internal URL leaks via this anonymous-readable surface."

**Statement**: Under `auth.type=DISABLED` (the application.yml-shipped default per ADR-CANDIDATE-029), `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`. Any network caller able to reach the HTTP port can `GET /api/integrations` and `GET /api/integrations/{id}` and read every wizard manifest, including the substituted `platform_url` value (per REFACTOR-615).

If operators set `odd.platform-base-url` to an internal hostname (a typical deployment pattern — the same property is shared by the `notification` channel `slack-link` rendering and other internal-URL substitution surfaces), the internal URL leaks via this anonymous-readable surface. An attacker probing `/api/integrations` from outside the network perimeter recovers an internal hostname (e.g. `http://odd-platform.internal.corp:8080`) — useful reconnaissance for lateral movement into the internal network.

The live wizard doc page (WebFetched 2026-05-25) does NOT mention DISABLED's anonymous-access posture. Combined with REFACTOR-185 (DISABLED bypasses all SECURITY_RULES) + REFACTOR-068 (AppInfoController under DISABLED), this is the THIRD anonymous-discoverable information-disclosure surface under DISABLED.

**Evidence**:
- `DisabledAuthSecurityConfiguration.java:13-18` (`.anyExchange().permitAll()`)
- `StaticArgumentMappingContext.java:16` (`odd.platform-base-url` substitution)
- `IntegrationMapper.java:38-45` (substitution into snippet `static_value`)
- WebFetch live wizard doc 2026-05-25 status 200 — silent on DISABLED-mode reach.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-029 (DISABLED-as-default) accepts the operator-onboarding-velocity vs blast-radius trade-off; this refactoring scope is the SPECIFIC consequence at the integration-wizard surface. The fix is operator-network-segmentation guidance in the docs + a doc-side enumeration of which endpoints leak which configuration values under DISABLED.

**Proposed remedy**: Doc-side: the live `disabled-authentication` page should enumerate that under DISABLED + default deployment, the wizard registry is anonymously readable AND that `odd.platform-base-url` substitution exposes the configured value. Code-side: optional — add an `IntegrationFilter` gating `/api/integrations*` behind an explicit operator opt-in (parallel to the `IngestionDataEntitiesFilter` pattern with `auth.ingestion.filter.enabled`). Maintainer triage: the operator-network-segmentation doc-side fix is cheaper and consistent with the DISABLED-mode caveat pattern.

**Severity rationale**: MEDIUM — anonymous-discoverable internal URL recovery. The blast radius depends on whether operators set `odd.platform-base-url` to a sensitive value; default-config deployments leak only the literal placeholder per REFACTOR-615. Production deployments where the property is set to an internal hostname leak the internal hostname to any network caller under DISABLED.

**Suggested backlog grouping**: "DISABLED-mode hardening / docs batch" (compose with REFACTOR-185, REFACTOR-068, REFACTOR-607 — all DISABLED-mode anonymous-disclosure surfaces).

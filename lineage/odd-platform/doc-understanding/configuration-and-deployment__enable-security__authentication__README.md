---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/README.md"
page_title: "Authentication"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Auth Mode"
  features:
    - "F-088"
  code_nodes:
    - "odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10"
    - "odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.s2s.enabled@L140"
audience: [operator]
doc_claim_vs_code:
  - "Page enumerates the four auth mechanisms (Disabled/Login form/OAuth2-OIDC/LDAP) as a flat menu but omits that DISABLED is the application.yml-shipped DEFAULT — an operator landing on this index does not learn the out-of-box posture is permit-all no-auth. evidence: odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10 — application.yml:32-34 (`auth: # DISABLED, LOGIN_FORM, OAUTH2, LDAP` / `type: DISABLED`); the sibling enable-security parent page surfaces the ingestion-default danger admonition but this auth index carries no equivalent default-posture note. LSN-001/LSN-002 default-with-consequence class."
  - "Page frames S2S as 'API-key authentication for server-to-server clients, complements any of the above' — the 'server-to-server' / 'complements' framing understates the blast radius. A single X-API-Key shared secret forces a synthetic `User.withUsername('ADMIN').roles('ADMIN')` principal across ALL /** paths under LOGIN_FORM/OAUTH2/LDAP, with cross-mode collision against any operator-named user 'ADMIN'. evidence: F-088 — S2sAuthenticationFilter.java:31-39 (hardcoded ADMIN principal) + OAuthSecurityConfiguration.java:108-110 (filter scope is /**, wired at SecurityWebFiltersOrder.HTTP_BASIC). The detail belongs on s2s.md, not this index, but the index's one-liner is the operator's first impression of S2S scope."
maintainer_curated: false
---

# Authentication — doc understanding

This page is the operator-facing navigational index for ODD Platform's UI/API
authentication. It frames the four mechanisms selected by the `auth.type` knob
(Disabled / Login form / OAuth2-OIDC / LDAP) and the orthogonal S2S API-key
surface (`auth.s2s.enabled`), then fans out to five child pages. It maps to the
canonical **Auth Mode** concept (`entitie:auth-mode` — the `auth.type` knob with
exactly those four values plus S2S, confirmed via graph-node) and, for the S2S
line, to feature **F-088 (S2S API Key — Global Admin Grant Surface)**. The four
`auth.type` values are dispatched by the four `*SecurityConfiguration` consumer
classes; the DISABLED consumer (`auth.type@L10`) and the S2S-enable consumer
(`auth.s2s.enabled@L140`) are bound here as the representative code anchors for
an index page (the per-mode deep dives live on the child sidecars).

Two drift findings are surfaced as overview-level omissions rather than
per-mode contradictions: (1) the index does not signal that DISABLED is the
shipped default (`application.yml:32-34`), so the no-auth out-of-box posture is
invisible at the entry point; (2) the S2S "complements any of the above"
one-liner understates that S2S grants synthetic ADMIN across all `/**` paths
(F-088 — `S2sAuthenticationFilter.java:31-39` + `OAuthSecurityConfiguration.java:108-110`).
Both are DOC-GAP candidates for the doc-gap-finder to triage; both detail homes
are the child pages (`disabled-authentication.md`, `s2s.md`).

## Maintainer notes

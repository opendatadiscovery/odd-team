---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/disabled-authentication.md"
page_title: "Disable authentication"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication/disabled-authentication"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Auth Mode"
    - "Deployment Introspection (/api/appInfo)"
    - "Permission (Authorization)"
  features:
    - "F-119"
  code_nodes:
    - "odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10"
    - "odd-platform java IdentityController controller-method:dummyOwner"
    - "odd-platform java AppInfoController controller-method:getAppInfo"
    - "odd-platform java AppInfoController config-key-consumer:auth.type@L18"
audience: [operator]
doc_claim_vs_code:
  - "Page claims the actuator env masking is governed by `show-values: WHEN_AUTHORIZED`. Code: `application.yml` sets NO `management.endpoint.env.show-values` key (lines 226-240 declare only `exposure.include: health, prometheus, env, info` + `endpoint.env.enabled: true`), so the effective value is the Spring Boot framework default `NEVER` — per invariant `concepts/detail/invariants/plaintext-db-credentials-default-with-actuator-env-exposed-default.yaml:1` (\"Spring Boot 3.4+ defaults management.endpoint.env.show-values=NEVER\"). The page's load-bearing conclusion holds (values redacted to an anonymous caller, keys + JDBC URL host/port/dbname leak — the URL is NOT covered by the value mask), but the cited literal `WHEN_AUTHORIZED` is not what the deployment configures. Evidence: application.yml:226-240 + plaintext-db-credentials-default-with-actuator-env-exposed-default.yaml:1."
  - "Page claims `/actuator/**` is whitelisted in Spring Security in EVERY auth mode (not just DISABLED). Under DISABLED this is confirmed — the chain is `.anyExchange().permitAll()` (node `odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10`, DisabledAuthSecurityConfiguration.java:10-19). The all-modes actuator whitelist (a `/actuator/**` permit rule inside LoginForm/OAuth/LDAP chains) was NOT independently confirmed in this pass against a code node; the env-exposed-by-default fact IS confirmed (application.yml:231). Flag for the maintainer to pin the actuator whitelist in the three authenticated `*SecurityConfiguration` siblings, or soften the \"every auth mode\" wording."
maintainer_curated: false
---

# Disable authentication — doc understanding

This page is the operator-facing home for `auth.type: DISABLED` (the `application.yml`-shipped default — `DisabledAuthSecurityConfiguration` at `auth.type@L10` cites `application.yml:32-34`). It sets the config (`auth.type: DISABLED` / `AUTH_TYPE=DISABLED`), carries the production-danger admonition, and then enumerates the anonymous-reachability surface — the LSN-class data-exposure picture for DISABLED mode. It maps to three curated concepts: **Auth Mode** (the `auth.type` knob + the four-mode fingerprint matrix), **Deployment Introspection (/api/appInfo)** / feature **F-119** (the version + auth-mode disclosure surface), and **Permission (Authorization)** (the enum the synthetic admin is granted).

The page's central security claims are code-grounded and confirmed via graph-node:

- **`.anyExchange().permitAll()` / every path reachable** — node `odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10` (DisabledAuthSecurityConfiguration.java:10-19): the DISABLED chain permits all exchanges, no CSRF, no CORS, no S2S filter wired, no boot WARN.
- **`whoami` returns a synthetic `admin` with `Permission.values()`** — node `odd-platform java IdentityController controller-method:dummyOwner` (IdentityController.java:30) constructs the `AssociatedOwner` with literal lowercase `username="admin"` and `Arrays.asList(Permission.values())`. The mechanism + blast radius are pinned in invariant `concepts/detail/invariants/refactor-185-identity-layer-facet-batch-zd-whoami-admin-grant.yaml:1` (anonymous caller receives a positive admin-grant; `WithPermissionsProvider` unlocks every UI affordance; the UI renders `admin` at `AppToolbar.tsx:74`). The page documents this accurately, including the auto-expansion of the grant as the Permission enum grows.
- **`/api/appInfo` leaks version + auth-mode unauthenticated** — feature F-119 + node `odd-platform java AppInfoController controller-method:getAppInfo` (AppInfoController.java:23) returns `{projectVersion, authType}` to any caller; `auth.type@L18` is the config-key consumer. Matches the page's passive-fingerprint claim.
- **Fingerprint matrix (DISABLED→200, LOGIN_FORM→302, OAUTH2/LDAP→401)** — corroborated by the **Auth Mode** concept's four `*SecurityConfiguration` siblings (Disabled permit-all; LoginForm/OAuth/LDAP authenticate). The 302-vs-401 distinction is a behavioural claim not independently re-derived per-mode in this pass, but is consistent with the permit-all-vs-authenticated split the concept cites.

Notable: the **prior** doc-drift recorded against the `refactor-185-identity-layer-facet-batch-zd-whoami-admin-grant` invariant (WebFetched 2026-05-25: the live pages were SILENT on the whoami endpoint, the admin-fallback identity claim, and the UI permission-gate collapse) has been REMEDIATED in the current page (doc HEAD 30795b4) — the page now documents all of it with the correct mechanism. This is closed drift, not an open finding.

The "Reserved usernames" section (literal lowercase `admin` synthetic identity vs literal uppercase `ADMIN` in the S2S filter; case-sensitive owner-mapping match) is code-accurate per invariant `concepts/detail/invariants/s2s-admin-username-literal-collision.yaml:1` (`S2sAuthenticationFilter.java:31-39` hardcodes `User.withUsername("ADMIN")`; jOOQ `.eq()` is case-sensitive so only the exact literal collides). That invariant's "docs are silent" note is also now remediated by this section + the cross-linked s2s.md page. (The curated concept "Administrator-name reservation asymmetry on CRUD" is a DIFFERENT subject — RBAC create-path name guards — and is deliberately NOT bound here.)

Two open drift findings (see frontmatter): the `show-values: WHEN_AUTHORIZED` literal does not match the deployed config (no key set → framework default `NEVER`), and the "every auth mode" actuator-whitelist wording is not pinned to a confirmed code node in the three authenticated modes.

## Maintainer notes

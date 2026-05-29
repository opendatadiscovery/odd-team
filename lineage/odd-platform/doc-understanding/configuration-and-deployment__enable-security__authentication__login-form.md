---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/login-form.md"
page_title: "Login form"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication/login-form"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Auth Mode"
    - "LOGIN_FORM hard-codes ADMIN for every user — RBAC framework INERT"
    - "Session cookie security attributes (HttpOnly / Secure / SameSite) are not configured anywhere"
    - "Cross-provider username row-duplication in external JOINs (Alert / Activity / Owner / OwnerAssociationRequest) — STRENGTHENED batch VAL-LSN-019-B with Activity repository-tier PRIMARY SOURCE pin"
  features: []
  code_nodes:
    - "odd-platform java LoginFormSecurityConfiguration config-key-consumer:auth.type@L31"
    - "odd-platform java LoginFormSecurityConfiguration config-key-consumer:auth.login-form-credentials@L70"
    - "odd-platform java LoginFormSecurityConfiguration config-key-consumer:auth.login-form-redirect@L41"
audience: [operator]
doc_claim_vs_code:
  - "Page documents an open-redirect surface on `auth.login-form-redirect` (URI.create with no scheme/host/base-URL allowlist). CONFIRMED in code: LoginFormSecurityConfiguration.java:41 reads `@Value(\"${auth.login-form-redirect:}\")`, line 89 returns `URI.create(redirectUri)` with no validation. NOT drift — page is accurate. Gap: the substrate captured the open-redirect invariant only as the DataCollab/Slack instance (invariant:open-redirect-class-server-side-302-trusts-third-party-url-verbatim → DataCollaborationController.java:41-49); the login-form-redirect instance the page documents has no dedicated invariant concept node. Evidence: odd-platform java LoginFormSecurityConfiguration config-key-consumer:auth.login-form-redirect@L41 / LoginFormSecurityConfiguration.java:41,89."
  - "Page (danger admonition) states the shipped config contains default credentials `admin:admin,root:root` and warns to change them before non-local deployment. CONFIRMED accurate: application.yml:37 `login-form-credentials: admin:admin,root:root`. Caveat is warning-only with no programmatic guardrail (per invariant:login-form-admin-for-every-user-rbac-inert). The page also correctly frames the risk as conditional (\"If you enable LOGIN_FORM ... without overriding\") — application.yml:34 ships `type: DISABLED`, so the default creds only activate once an operator selects LOGIN_FORM. No drift. Evidence: application.yml:34,37; odd-platform java LoginFormSecurityConfiguration config-key-consumer:auth.login-form-credentials@L70."
maintainer_curated: false
---

# Login form — doc understanding

This page is the operator manual for ODD Platform's `LOGIN_FORM` authentication mode — the
simplest `auth.type` value (the Auth Mode entity; the knob is `auth.type`, set per
`LoginFormSecurityConfiguration` config-key-consumer `auth.type@L31`). It documents how
credentials are supplied (`auth.login-form-credentials` / `AUTH_LOGIN_FORM_CREDENTIALS`,
confirmed at config node `auth.login-form-credentials@L70`) and then carries four
operator-critical caveats, each grounded in the wiring of
`LoginFormSecurityConfiguration.java`. The page maps cleanly to the implementation — every
caveat was verified against the source and none is drift.

The "every user is ADMIN / Policy and Role tables are not consulted" section is the doc face
of the invariant `LOGIN_FORM hard-codes ADMIN for every user — RBAC framework INERT`:
`LoginFormSecurityConfiguration.java:81` calls `getAuthorities(true)` (the `isAdmin` flag) and
lines 55-57 wire only `.pathMatchers(permittedPaths).permitAll().pathMatchers("/**").authenticated()`
with **no** `AuthorizationCustomizer`, so `SecurityConstants.SECURITY_RULES` is inert and
operator-authored Policies/Roles never gate the live chain. The "CSRF protection is disabled"
section is confirmed by line 54 (`.csrf(ServerHttpSecurity.CsrfSpec::disable)`); its
cross-reference to absent `Secure` / `SameSite=Strict` cookie attributes is the invariant
`Session cookie security attributes ... are not configured anywhere`. The
"`auth.login-form-redirect` is operator-trusted" section is confirmed by line 41 (`@Value`)
+ line 89 (`URI.create` with no allowlist). The "Cross-mode user-name collision (activity
feed read paths)" section is the doc face of `Cross-provider username row-duplication in
external JOINs ...` — `ReactiveActivityRepositoryImpl.java:157-158,178-179,199-200,221-222`
join `USER_OWNER_MAPPING` on `OIDC_USERNAME` with no `PROVIDER` discriminator.

Feature binding: F-088 (S2S API Key global-admin grant) is adjacent but is the
`auth.s2s.enabled` shared-secret path, which this page does **not** document; it is therefore
not bound here (binding it would be a mis-attribution).

## Maintainer notes

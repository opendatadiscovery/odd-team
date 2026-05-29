---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/s2s.md"
page_title: "Server-to-Server (S2S) authentication"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication/s2s"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "S2S 'ADMIN' username literal collision with operator-named users"
  features:
    - "F-088"
  code_nodes:
    - "odd-platform java auth filter:S2sAuthenticationFilter"
    - "odd-platform java config:LoginFormSecurityConfiguration"
    - "odd-platform java config:OAuthSecurityConfiguration"
    - "odd-platform java config:LDAPSecurityConfiguration"
    - "odd-platform java config:DisabledAuthSecurityConfiguration"
    - "odd-platform java service:AuthIdentityProviderImpl"
    - "odd-platform java repository:ReactiveUserOwnerMappingRepositoryImpl"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page describes the GLOBAL S2S filter (X-API-Key -> synthetic ADMIN, admin-everywhere) but its `curl` example POSTs to `/ingestion/entities` with `X-API-Key`. There are TWO independent auth paths to that endpoint: the global `S2sAuthenticationFilter` (X-API-Key, ADMIN-everywhere) and the collector-scoped `IngestionDataEntitiesFilter` (Authorization: Bearer <token>, gated by `auth.ingestion.filter.enabled` default false). The page does not disambiguate the two; an operator who has only `auth.ingestion.filter` configured (not `auth.s2s`) will find `X-API-Key` does nothing on `/ingestion/entities`. Evidence: S2sAuthenticationFilter.java:20,27 (X-API-Key path) vs concepts.yaml DataEntity-aggregate `IngestionController.postDataEntityList` note (Bearer path) — header-mismatch is a 2-sidecar cross-cutting doc-drift invariant (concepts.yaml:220). DOC-GAP candidate (LOW: page itself is internally correct; the gap is cross-page disambiguation)."
maintainer_curated: false
---

# Server-to-Server (S2S) authentication — doc understanding

This page is the operator-facing manual for ODD Platform's `auth.s2s.*` API-key mechanism: a single long-lived token, presented in the `X-API-Key` header, that authenticates a non-human caller (CI/CD, automation, scheduled ingestion) as the built-in `ADMIN`. Every load-bearing runtime claim on the page is confirmed against first-hand source and feature flow **F-088** ("S2S API Key — Global Admin Grant Surface"):

- **X-API-Key -> built-in ADMIN, admin-everywhere.** The filter forces a synthetic `User.withUsername("ADMIN").roles("ADMIN")` principal with `grantedAuthorityExtractor.getAuthorities(true)` for any request bearing a valid token — `S2sAuthenticationFilter.java:31-39`. `getAuthorities(true)` returns exactly `Set.of(SimpleGrantedAuthority("ADMIN"))` (GrantedAuthorityExtractor.java:12-14), so the page's "ADMIN user and ADMIN role … can call any endpoint that admins can call" is precise — this is the F-088 global-admin blast radius.
- **Runs alongside interactive auth, not instead of it.** The filter is composed at `SecurityWebFiltersOrder.HTTP_BASIC` (highest-priority pre-auth slot) in all three interactive chains — `LoginFormSecurityConfiguration.java:62`, `OAuthSecurityConfiguration.java:109`, `LDAPSecurityConfiguration.java:150`. On an invalid/absent token the filter calls `chain.filter(exchange)` unmodified (`S2sAuthenticationFilter.java:27-28`), so the normal auth chain handles the request — confirms the "falls through" claim.
- **Refuses to start if the token is missing when enabled.** `S2sTokenProvider.validate()` `@PostConstruct` throws `IllegalStateException` when `s2sEnabled && isBlank(s2sToken)` (`S2sTokenProvider.java:23-27`). Defaults `auth.s2s.enabled=false`, `auth.s2s.token=null` (`:10-13`).
- **Static-string equality, no rotation/scoping.** `s2sToken.equals(token)` (`S2sTokenProvider.java:20`) — confirms "single static string compared for equality … not rotated, expired, or scoped."
- **DISABLED-mode no-op (operator caveat #2).** `DisabledAuthSecurityConfiguration` builds only `anyExchange().permitAll()` and never adds `s2sAuthenticationFilter` (`DisabledAuthSecurityConfiguration.java:12-18`); the filter is wired exclusively in the three interactive configs. Confirms "the S2S filter is never wired into the chain in that mode."
- **Operator caveat #1 — literal `ADMIN` username collision.** Confirmed via concept invariant `s2s-admin-username-literal-collision`: the filter hardcodes `"ADMIN"` (`S2sAuthenticationFilter.java:31`); `AuthIdentityProviderImpl.getCurrentUser()` maps the `UsernamePasswordAuthenticationToken` to `UserDto("ADMIN", null)` (`AuthIdentityProviderImpl.java:29-33`); the owner lookup matches `WHERE OIDC_USERNAME='ADMIN' AND PROVIDER IS NULL` case-sensitively (`ReactiveUserOwnerMappingRepositoryImpl.java:116-127`). A real LOGIN_FORM/LDAP user named `ADMIN` (provider=null) inherits the S2S caller's owner binding — exactly the page's warning.

Net: this is an accurate, well-authored security page; the F-088 blast radius and both operator caveats are faithful to the code. The only drift is cross-page (the `/ingestion/entities` example does not disambiguate the global S2S `X-API-Key` path from the collector `Bearer` path) — logged above as a LOW DOC-GAP candidate.

## Maintainer notes

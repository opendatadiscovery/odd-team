---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/ldap.md"
page_title: "LDAP"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication/ldap"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Auth Mode"
    - "LOGIN_FORM/LDAP provider=null cross-mode bleed"
  features: []
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDLDAPProperties"
    - "odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.type@L51"
audience: [operator]
doc_claim_vs_code:
  - "CRITICAL — page claims admin-group matching is `case-insensitive substring containment` (section 'Admin promotion (substring overpromotion warning)', live verbatim: a configured `ops` promotes members of `devops`, `noops`, `appops`, `dataops`); code does case-insensitive FULL-STRING equality. The LDAP match call site `LDAPSecurityConfiguration.java:94-97` delegates to `OperationUtils.containsIgnoreCase`, whose body is `collection.stream().anyMatch(element::equalsIgnoreCase)` (verbatim primary-source verification at ../odd-platform commit 80637ed, recorded in concepts/detail/canonicalisation_candidates/substring-match-admin-escalation-ldap-containsignorecase.yaml, status RETRACTED-FACTUALLY-WRONG). `equalsIgnoreCase` is full-string, not substring — `ops` does NOT match `devops`/`noops`/`dataops`. The page's entire overpromotion table + the 'use long full-group-name tokens' mitigation describe a behaviour the code does not have. Correct claim: `admin-groups: ['Admin']` matches `Admin`/`admin`/`ADMIN` but NOT `Administrator` or `admin-contractors`. Evidence: odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.type@L51 / LDAPSecurityConfiguration.java:94-97 + OperationUtils.java:5-11."
  - "Page claims `auth.ldap.active-directory.domain` is required when AD is enabled ('Active directory' section: domain must be set when `enabled: true`); code does NOT enforce this. `ODDLDAPProperties.domain` is a plain `String` (line 37) with no `@NotNull` and no cross-field check in `@PostConstruct validate()` (lines 40-49 validate ONLY url-non-empty + dnPattern-OR-filter). A deployment with `enabled: true` and no `domain` boots successfully and constructs `new ActiveDirectoryLdapAuthenticationProvider(null, url)` (LDAPSecurityConfiguration.java:76-83) — silently degraded AD bind, not a boot failure. Evidence: odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDLDAPProperties / ODDLDAPProperties.java:37,40-49 + LDAPSecurityConfiguration.java:76-83."
  - "Page is silent on the `ldap://` vs `ldaps://` distinction; code accepts any scheme verbatim. `LDAPSecurityConfiguration.java:117-124` passes `properties.getUrl()` into `LdapContextSource.setUrl(...)` with no scheme enforcement; `validate()` only checks `StringUtils.isEmpty(url)` (ODDLDAPProperties.java:42-44). An `ldap://` URL (the page's own example, `ldap://localhost:389`) sends the bind password AND every end-user login credential in cleartext, with no boot warning. LSN-002-class silent-insecure-default. Evidence: odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.type@L51 / LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-44."
  - "Page documents `auth.ldap.password` with no sensitive-exposure caveat; code binds it as a plain `String` via Lombok `@Data` (ODDLDAPProperties.java:14) and the bundled `application.yml` exposes `/actuator/env` by default (lines 226-231), which `SecurityConstants.WHITELIST_PATHS` permitAll-s (`/actuator/**`). The resolved bind password is reachable at `/actuator/env` by any caller able to hit the platform HTTP port. The page gives operators no warning. Evidence: odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.type@L51 / ODDLDAPProperties.java:14 + LDAPSecurityConfiguration.java security finding + application.yml:226-231 + SecurityConstants.java:95-96."
  - "Minor — page documents `auth.ldap.groups.filter` default value `(member={0})` ('Define admin groups' section) as if the platform supplies it; the `ODDLDAPProperties.Group.filter` field is a plain `String` (line 30) initialising to null, and the platform passes it through only when non-empty (LDAPSecurityConfiguration.java:106-113). When unset, the default `(member={0})` comes from Spring Security's own `DefaultLdapAuthoritiesPopulator`, not from platform code. The value the operator sees is correct; the doc misattributes its owner. Evidence: odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDLDAPProperties / ODDLDAPProperties.java:30."
maintainer_curated: false
---

# LDAP — doc understanding

This page is the operator setup guide for ODD Platform's `auth.type=LDAP` authentication mode (concept **Auth Mode**). It enumerates the entire `auth.ldap.*` configuration surface bound by the `ODDLDAPProperties` `@ConfigurationProperties("auth.ldap")` POJO (`config-properties-class:ODDLDAPProperties`, prefix `auth.ldap`, confirmed via graph-node) — connection (url/username/password), user-locator strategy (dn-pattern OR user-filter), group→admin mapping, and the Active Directory branch. The stack those keys drive is wired by `LDAPSecurityConfiguration` (`config-key-consumer:auth.type@L51`, gated by `@ConditionalOnProperty(auth.type=LDAP)`), which the page documents implicitly through the `admin-groups`, AD, and connection sections.

The page carries two operator-critical caveats beyond plain config reference. The **cross-mode user-name collision** section documents the confirmed invariant **LOGIN_FORM/LDAP provider=null cross-mode bleed**: the activity-feed read paths join `USER_OWNER_MAPPING` on `OIDC_USERNAME` only (`ReactiveActivityRepositoryImpl.java:157-158/178-179/199-200/221-222`), and both LOGIN_FORM and LDAP principals carry `provider=null` (`AuthIdentityProviderImpl.java:29-33`), so same-named users across modes resolve to the same `OwnerPojo` — the page's claim matches the code. The **empty-`admin-groups`** sub-section (every authenticated LDAP user gets `USER` only, no boot warning) likewise matches `LDAPSecurityConfiguration.java:91-93` — page and code agree.

The high-value drift is the **substring overpromotion** section: it is factually wrong against verified source. The admin-group matcher is full-string `equalsIgnoreCase`, not substring containment (primary-source-verified at commit 80637ed; the L51 sidecar's older substring claim was the propagation source and is retracted). The page's worked example (`ops` → `devops`/`noops`/`dataops`) cannot occur. See `doc_claim_vs_code` for this plus the AD-domain, ldap-vs-ldaps, actuator-env-password, and groups-filter-default findings, all with code evidence.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

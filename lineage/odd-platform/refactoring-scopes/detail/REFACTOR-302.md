## REFACTOR-302 — LOGIN_FORM ↔ LDAP cross-mode bleed via `provider=null` — a LOGIN_FORM user `alice` and an LDAP user `alice` both resolve to the SAME Owner-link via the (alice, null) USER_OWNER_MAPPING row; migration scenarios silently grant the second-mode user the first-mode user's Owner

**Severity**: HIGH
**Category**: missing-auth (cross-mode identity collision)
**Pillars affected**: [P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:bugs_limitations_corner_cases.[0]` (HIGH) — "LOGIN_FORM ↔ LDAP cross-mode bleed via provider=null. A LOGIN_FORM user `alice` and an LDAP user `alice` both produce `UserDto(\"alice\", null)` at AuthIdentityProviderImpl.java:32. The downstream lookup at `getConditions(\"alice\", null)` builds `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL`."

**Description**: The compound-key shape `(oidc_username, provider)` resolves to provider=null for both LOGIN_FORM and LDAP auth flows (per ADR-CANDIDATE-104 NEW batch K — OAuth2-only non-null provider). The `USER_OWNER_MAPPING` lookup at `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` builds `WHERE OIDC_USERNAME = ? AND DELETED_AT IS NULL AND PROVIDER IS NULL` (no auth-mode discriminator beyond the null-provider null-equality check). The codepath has NO mode-check, NO warning log on cross-mode hit, NO fail-fast. The migration step (e.g. an operator switching from `auth.type=LOGIN_FORM` to `auth.type=LDAP` with overlapping usernames) is silent.

**Failure mode**: An operator migrates from LOGIN_FORM to LDAP. Both modes contain a user named `alice`. The pre-migration LOGIN_FORM `alice` had an OwnerAssociationRequest approved and an `(alice, null) → owner_id=42` row in USER_OWNER_MAPPING. Post-migration, the LDAP `alice` (potentially a different human, depending on the LDAP directory's contents) logs in. `getCurrentUser()` returns `UserDto("alice", null)` (per AuthIdentityProviderImpl.java:32 else-branch). `fetchAssociatedOwner` returns the EXISTING `owner_id=42` Owner — the LDAP-alice human now sees, owns, and can act on every entity the LOGIN_FORM-alice's Owner row was tied to. No warning surfaces.

**Primary source citations**:
- `AuthIdentityProviderImpl.java:29-33` (the OAuth2 instanceof check; else-branch produces null)
- `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` (the (oidc_username=?, provider=?-or-isNull) clause builder)
- `LoginFormSecurityConfiguration.java:30-34` (the MapReactiveUserDetailsService configuration — produces UsernamePasswordAuthenticationToken)
- `LDAPSecurityConfiguration.java:50-57` (the LdapAuthenticationProvider configuration — produces UsernamePasswordAuthenticationToken with the same shape)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-104 (NEW batch K — OAuth2-only non-null provider) IS the architectural decision that produces this collision. The ADR's rationale is that LOGIN_FORM and LDAP are each "local" to a deployment — operators were never expected to run both simultaneously, and migration was assumed to be a one-time switch. The IMPLIED prescription is that the (oidc_username, null) namespace is per-deployment-globally-unique; migration MUST disambiguate or the cross-mode bleed is the price. The doc-side silence on this requirement is the operator-trap: operators reading the live authentication / user-owner-association doc cannot infer they need to migrate USER_OWNER_MAPPING rows when switching auth modes with overlapping usernames.

**Proposed remedy**: Three options. (a) **Migration-friendly code-fix**: extend the `provider` shape to distinguish LOGIN_FORM (`"LOGIN_FORM"`) from LDAP (`"LDAP"`) at `AuthIdentityProviderImpl.java:29-33`; introduce a USER_OWNER_MAPPING migration that promotes existing `provider=null` rows to a sentinel for the active auth mode at boot. This is a structural change (per ADR-CANDIDATE-104 wisdom-test). (b) **Operator-doc fix**: document the cross-mode collision risk on the live authentication / user-owner-association pages explicitly; provide a migration playbook for "switching from LOGIN_FORM to LDAP with overlapping usernames." (c) **Boot-time guard**: add a `SecurityPostureValidator` per REFACTOR-073 that warns at boot if `auth.type` changes AND any rows in USER_OWNER_MAPPING have provider=null. Options (b) + (c) together close the operator-trap without structural change.

**Severity rationale**: HIGH — security crossover during migration; undocumented; affects every deployment that switches auth modes. The collision is structurally enabled by ADR-CANDIDATE-104's deliberate compound-key shape, so the fix path is either documentation-first (preserve the ADR) or compound-key extension (revise the ADR).

**Suggested backlog grouping**: `Authorization audit batch` + companion DOC-NNN on the live authentication page

---

## REFACTOR-353 — PROVIDER-NULL CROSS-MODE BLEED — LOGIN_FORM / LDAP / S2S share a single null-provider namespace in user_owner_mapping; a deployment migrating between modes silently merges identity sets across the auth boundary

**Severity**: HIGH
**Category**: missing-auth (authentication-boundary defence)
**Surfaced by**:
- `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[0]` (PRIMARY-SOURCE — the SQL-layer manifestation)
- `ReactiveUserOwnerMappingRepositoryImpl.md:security.known_security_gaps[0]` (PRIMARY-SOURCE security gap)
- Cross-batch: batch K `AuthIdentityProviderImpl.md` (the principal-resolution else-branch producing `UserDto(name, null)` for LOGIN_FORM / LDAP / S2S — the architectural triangle's other vertex)

**Description**: `ReactiveUserOwnerMappingRepositoryImpl.getConditions(oidcUsername, provider)` at lines 121-125 builds the WHERE clause:

```java
conditions.add(USER_OWNER_MAPPING.OIDC_USERNAME.eq(oidcUsername));
conditions.add(USER_OWNER_MAPPING.DELETED_AT.isNull());
if (StringUtils.isNotEmpty(provider)) {
  conditions.add(USER_OWNER_MAPPING.PROVIDER.eq(provider));
} else {
  conditions.add(USER_OWNER_MAPPING.PROVIDER.isNull());
}
```

Combined with `AuthIdentityProviderImpl.java:29-33` (which produces `UserDto(name, null)` for LOGIN_FORM, LDAP, and S2S — only OAuth2 produces a non-null provider), the consequence is:

- A LOGIN_FORM user named `'alice'` resolves to: `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL`.
- An LDAP user named `'alice'` resolves to: `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL`.
- An S2S API-key call resolves to: `WHERE OIDC_USERNAME = 'ADMIN' AND DELETED_AT IS NULL AND PROVIDER IS NULL` (per S2sAuthenticationFilter.java:31-34 — hardcoded uppercase).

**Three high-risk scenarios this enables**:
- **(a) LOGIN_FORM → LDAP migration retains identity** — an operator who had `'alice'` configured in `LoginFormSecurityConfiguration`'s admin-users config and now switches `auth.type=LDAP` with a directory containing `cn=alice,...` will see alice's LOGIN_FORM owner-mapping inherited by the new LDAP login. The operator's mental model says "I switched auth modes; identity is fresh"; the reality is the prior mapping survives.
- **(b) Concurrent LOGIN_FORM + LDAP deployments with overlapping usernames** — silently collide identities. (This scenario is technically blocked by the `@ConditionalOnProperty(value="auth.type", havingValue=...)` mutex on the four SecurityConfiguration classes, but a future operator splitting LOGIN_FORM admin and LDAP users via composing-not-mutex paths could collide.)
- **(c) S2S username='ADMIN' literal collision** — see REFACTOR-354 for the dedicated scope.

**There is NO mode-check, NO warning log, NO fail-fast at this layer.** The repository's `.eq()` is case-sensitive (Postgres VARCHAR default), so `'admin'` ≠ `'Admin'` ≠ `'ADMIN'` are different rows — but exact-case matches collapse identities.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:121-125` (the IS_NULL branch — the SQL-layer manifestation)
- `AuthIdentityProviderImpl.java:29-33` (the principal-layer producer of provider=null for non-OAuth2 modes)
- `LoginFormSecurityConfiguration.java:30-34` + `LDAPSecurityConfiguration.java:50-57` + `S2sAuthenticationFilter.java:31-34` (the three modes that funnel into the null-provider bucket)
- `V0_0_55__add_policies_and_roles.sql:1-2` (`ADD COLUMN IF NOT EXISTS provider VARCHAR(255)` — NULLABLE; NULL is a first-class value, not a sentinel)
- `V0_0_89__update_user_owner.sql:13-15` (the partial unique index `(oidc_username, provider) WHERE deleted_at IS NULL` — treats NULL as a unique value)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-130 NEW (provider-null collapse) documents the **architectural decision** that makes this gap a documented cost of the design, not a defect. The maintainer deliberately collapsed three modes into one null-provider namespace for simpler schema; this scope is the operational consequence. The remedy is NOT "remove the architectural decision" but "add the missing safeguards" — either a migration-time guard, a runtime warning, or a mode-discrimination column.

**Proposed remedy**: Three options for the maintainer to choose:
1. **Document and accept** — add a paragraph to ADR-CANDIDATE-130's ADR draft explicitly warning operators about the migration UX. The cross-mode-bleed is a documented behaviour; operators inheriting an environment must understand it. Pair with a doc-site warning in `documentation/docs/configuration-and-deployment/enable-security/`.
2. **Add a runtime warning** — `ReactiveUserOwnerMappingRepositoryImpl.getAssociatedOwner` logs `log.warn(...)` when it resolves a row with `provider=null` AND the deployment's current `auth.type` is different from the prior write. Requires schema extension: add `auth_mode_at_write VARCHAR(20)` column or a `boot_id UUID` column to track the writing context. The warning surfaces the migration-time inheritance to the operator.
3. **Add a mode-discrimination column** — schema migration adding `auth_mode VARCHAR(20) NOT NULL` to user_owner_mapping; all reads filter by mode; all writes record mode. Full structural fix that eliminates the collapse. UX trade-off: forces a difficult backfill migration on existing deployments (which mode did each historical row come from?) — likely require an operator-driven heuristic.

**Severity rationale**: HIGH — security-boundary failure during a deliberate operator action (auth-mode migration). The failure mode is silent and non-obvious; the operator's mental model of "I switched auth modes; identity is fresh" is violated. The blast radius is the entire RBAC plane — Owner mappings carry Role attachments, so an inherited owner inherits the role permissions. An attacker who anticipated the migration (or who happens to share a username with a prior LOGIN_FORM admin) inherits administrative access. Documented as the cost of ADR-CANDIDATE-130 NEW.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — pair with REFACTOR-354 (S2S ADMIN collision) and REFACTOR-355 (cross-provider JOIN row duplication). The three together describe the provider-null collapse's operational risk surface.

---

## REFACTOR-301 — `S2sAuthenticationFilter` hardcodes username='ADMIN' which collides with operator-named LOGIN_FORM/LDAP user 'ADMIN' via the `(username, provider=null)` USER_OWNER_MAPPING lookup — S2S API-key holders inherit that user's owner-link

**Severity**: HIGH
**Category**: missing-auth (boundary failure on naming collision)
**Pillars affected**: [P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:bugs_limitations_corner_cases.[1]` (HIGH) — "S2S filter hardcodes username='ADMIN' which collides with operator-named users. S2sAuthenticationFilter.java:31-34 builds `User.withUsername(\"ADMIN\").roles(\"ADMIN\")` and wraps in UsernamePasswordAuthenticationToken (provider will be null at AuthIdentityProviderImpl.java:32). Any S2S call that invokes a service using `fetchAssociatedOwner` looks up `WHERE OIDC_USERNAME = 'ADMIN' AND PROVIDER IS NULL`. If an operator has named a LOGIN_FORM or LDAP user 'ADMIN' (uppercase, exact case-sensitive match — the SQL uses `eq`, not `equalIgnoreCase`), the S2S caller will resolve to THAT user's Owner."

**Description**: `S2sAuthenticationFilter.java:31-34` constructs an authenticated principal as `UserDetails.withUsername("ADMIN").roles("ADMIN")` and wraps it in a `UsernamePasswordAuthenticationToken` with no provider information. The downstream `AuthIdentityProviderImpl.getCurrentUser()` (lines 29-33) hits the non-OAuth2 else branch → `UserDto("ADMIN", null)`. `fetchAssociatedOwner` chains through to `ReactiveUserOwnerMappingRepositoryImpl.getConditions("ADMIN", null)` which builds `WHERE OIDC_USERNAME = 'ADMIN' AND DELETED_AT IS NULL AND PROVIDER IS NULL`.

**Failure mode**: If an operator-administered LOGIN_FORM or LDAP deployment has a user named 'ADMIN' (uppercase, exact case-match) with an associated Owner row, every S2S API-key call inherits that user's Owner-link via `fetchAssociatedOwner`. The S2S caller's downstream behaviour (per the 15-callsite enumeration in the AuthIdentityProviderImpl sidecar — DataEntityPermissionExtractor, TermPermissionExtractor, ManagementPermissionExtractor, ActivityServiceImpl, DataEntityServiceImpl, AlertServiceImpl, etc.) becomes scoped to THAT operator user's owner — not the platform-wide ADMIN scope the S2S role implies. The case-sensitivity reduces the attack surface (operators must spell 'ADMIN' uppercase exactly) but does NOT eliminate it.

**Primary source citations**:
- `S2sAuthenticationFilter.java:31-34` (the hardcoded `User.withUsername("ADMIN").roles("ADMIN")`)
- `S2sAuthenticationFilter.java:37-39` (`new UsernamePasswordAuthenticationToken` wrap with no provider field)
- `AuthIdentityProviderImpl.java:29-33` (the else-branch produces `UserDto("ADMIN", null)`)
- `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` (the `eq(OIDC_USERNAME, name).and(PROVIDER.isNull())` SQL clause for the (ADMIN, null) lookup)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-032 (S2S composes-not-mutex) frames S2S as a programmatic-caller path orthogonal to UI auth modes. ADR-CANDIDATE-104 (NEW batch K — OAuth2-only non-null provider) is the architectural anchor: the choice to collapse non-OAuth2 modes to `provider=null` is what enables the collision. The IMPLIED prescription is that S2S callers should resolve to a DEDICATED "system" Owner OR have NO owner-scoping at all (the filter's "ADMIN" role suggests platform-wide reach, but the owner-lookup downstream contradicts it).

**Proposed remedy**: Two options. (a) **Code-fix**: change `S2sAuthenticationFilter.java:31-34` to use a sentinel username impossible to collide with operator usernames (e.g. `"__s2s__"`, `"__platform_s2s_caller__"`) AND seed a corresponding `user_owner_mapping` row at startup that points at a dedicated "S2S" or "Platform" Owner — OR — entirely bypass `fetchAssociatedOwner` for S2S callers by detecting the S2S role and returning a sentinel UserDto that downstream owner-scoped reads handle as "system" rather than as a user-Owner-link. (b) **Operator-doc fix**: document the collision risk on the S2S configuration page explicitly so operators know to avoid naming users 'ADMIN' (uppercase). The code-fix (a) is preferred because it removes the operator-naming-discipline requirement entirely.

**Severity rationale**: HIGH — security-boundary failure on operator-naming collision; the collision is defensible by operator hygiene but NOT by code, AND it is undocumented at the live docs layer. Cross-link with REFACTOR-108 (batch C — S2S grants ADMIN across `/**`) and REFACTOR-073 (batch B — no boot-time security-posture validator). A boot-time validator that asserts no user_owner_mapping row exists for (username='ADMIN', provider=null) would catch this.

**Suggested backlog grouping**: `Authorization audit batch` + `S2S hardening sprint`

---

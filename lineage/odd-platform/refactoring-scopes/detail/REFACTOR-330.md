## REFACTOR-330 — `AuthIdentityProviderImpl.getCurrentUserProviderRole` silently drops authorities beyond the first — `authorities.iterator().next()` reads only the first GrantedAuthority; a future RBAC hierarchy refactor adding (USER, READ_QUERY_EXAMPLE) etc. would silently lose information

**Severity**: LOW
**Category**: misleading-code (latent regression vector)
**Pillars affected**: [P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:bugs_limitations_corner_cases.[5]` (LOW) — "`getCurrentUserProviderRole` silently drops authorities beyond the first. Line 44 invokes `authorities.iterator().next().getAuthority()`. If the GrantedAuthorityExtractor ever emits more than one authority (a future RBAC hierarchy refactor), the second-and-beyond are silently ignored. Today this is fine — the extractor emits exactly USER or ADMIN — but a future change that added (USER, READ_QUERY_EXAMPLE) etc. would silently lose information without test cover."

**Description**: `AuthIdentityProviderImpl.getCurrentUserProviderRole()` (lines 41-46) extracts the authority via `authorities.iterator().next().getAuthority()` followed by `UserProviderRole.valueOf(authority)`. The implementation assumes EXACTLY ONE authority per Authentication. Today's `GrantedAuthorityExtractor` emits exactly `USER` or `ADMIN`; the assumption is correct. A future RBAC refactor that adds richer authority sets (e.g. Spring Security 6 composite authorities like `(USER, READ_DATA_ENTITY, WRITE_DATA_ENTITY)`) would silently drop the second-and-beyond authorities; the platform would behave as if the user has only the first authority.

**Failure mode**: A future maintainer extends `GrantedAuthorityExtractor` to emit `(USER, READ_DATA_ENTITY)` for a feature that should distinguish "user who can read DEs" from "user who can't." The downstream `getCurrentUserProviderRole` returns only `USER`; the `READ_DATA_ENTITY` distinction is lost. The new feature appears broken (some users see DE reads, others don't, but the platform reports both as USER role).

**Primary source citations**:
- `AuthIdentityProviderImpl.java:41-46` (iterator().next() with no aggregation)

**Existing-ADR-or-implied-prescription**: None. The platform's RBAC model today is the 2-role `(USER|ADMIN)` per UserProviderRole enum. The IMPLIED prescription is that this method's contract is "return the principal-level provider-role"; a future shift to composite authorities would invalidate the contract.

**Proposed remedy**: Two options. (a) **Defensive single-authority assertion**: at line 44, check `authorities.size() == 1` and emit a WARN log + Micrometer counter if the assumption is violated. (b) **Aggregating return type**: change the method signature to `Mono<Set<UserProviderRole>>` and return the full set. The first option preserves the current contract while surfacing future regressions; the second changes the API but supports richer RBAC.

**Severity rationale**: LOW — latent; only triggers on a future ADR change. Worth a comment + log at minimum.

**Suggested backlog grouping**: `Authorization audit batch` (code-hygiene item)

---

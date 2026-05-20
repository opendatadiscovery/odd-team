## ADR-CANDIDATE-104 — OAuth2 is the ONLY auth flow distinguished by a non-null `provider` string; LOGIN_FORM, LDAP, and S2S all collapse to `provider=null` in the `(username, provider)` compound key — deliberate "OAuth2 federates per-IDP; local modes share one namespace" stance

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-09-security-access-control]
**Support**: surfaced by 1 sidecar (`AuthIdentityProviderImpl`) — primary-source; structural identity-architecture decision with HIGH-severity operational consequences
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:implicit_adrs.[1]` (HIGH confidence) — "OAuth2 is the ONLY auth flow distinguished by a non-null `provider` string; LOGIN_FORM and LDAP collapse to provider=null. Lines 29-33 explicitly cast on `OAuth2AuthenticationToken` and read `getAuthorizedClientRegistrationId()`. The else-branch on line 32 hard-codes `null` for every other Authentication subtype."

**Decision statement**: `AuthIdentityProviderImpl.getCurrentUser()` (lines 29-33) uses a SINGLE `instanceof OAuth2AuthenticationToken` check to discriminate among the platform's four UI auth flows (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) plus S2S: if OAuth2, set `provider = registrationId` (the OAuth2 client registration id, e.g. `github`, `google`, `keycloak`); otherwise, set `provider = null`. The downstream `USER_OWNER_MAPPING.PROVIDER` column is therefore (a) the OAuth2 registration-id for OAuth2 users, (b) NULL for LOGIN_FORM users, LDAP users, AND S2S API-key callers (S2sAuthenticationFilter.java:37-39 explicit `new UsernamePasswordAuthenticationToken`). The architectural posture: OAuth2 inherently federates across multiple IDPs (github vs google vs keycloak — same username "alice" can mean different humans), so the registration-id is the natural namespace differentiator; LOGIN_FORM and LDAP are each "local" to the deployment (one configured auth backend), so the maintainer chose NOT to distinguish them and accepts that they share a single (username, null) namespace.

**Wisdom test**: PASS. (1) Deliberate (the explicit `if (authentication instanceof OAuth2AuthenticationToken oauthToken) { ... } else { return new UserDto(username, null); }` is the design statement — the maintainer chose pattern-matching on the OAuth2 subtype specifically, not a per-mode dispatch); (2) Structural impact (the compound-key shape `(oidc_username, provider)` is the persistence-level identity contract for the entire RBAC + owner-link surface; consumed by 15+ callsites of `fetchAssociatedOwner` and by `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` SQL clause); (3) Changing the shape (e.g. distinguishing LOGIN_FORM from LDAP via `provider = "LOGIN_FORM"` / `provider = "LDAP"`) would be a STRUCTURAL change requiring a DB migration of every existing USER_OWNER_MAPPING row.

**Evidence**:
- AuthIdentityProviderImpl.md says: "`if (authentication instanceof OAuth2AuthenticationToken oauthToken) { ... } else { return new UserDto(username, null); }` — the pattern-match-and-else IS the decision: only the OAuth2 subtype carries provider info; all others are pooled into the null bucket."
- AuthIdentityProviderImpl.md says (downstream): "the downstream lookup at `getConditions(\"alice\", null)` builds `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL`" (ReactiveUserOwnerMappingRepositoryImpl.java:116-127)
- AuthIdentityProviderImpl.md says (consequence): "A LOGIN_FORM user `alice` and an LDAP user `alice` both produce `UserDto(\"alice\", null)` at AuthIdentityProviderImpl.java:32. The downstream lookup at `getConditions(\"alice\", null)` builds `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL`."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-015** (owner-scoped reads via reactor Context principal flow — this ADR IS the principal-resolution primitive that ADR-CANDIDATE-015 consumes). Composes with **ADR-CANDIDATE-030** (4-way enum mode selection at `*SecurityConfiguration`) — together they describe the identity-architecture: 4 auth modes × 1 compound-key shape × OAuth2-specific federation. Composes with **ADR-CANDIDATE-105** (NEW — single-Mono owner resolution) — the compound key is the input to the Mono-not-Flux lookup.

**Cross-link gaps** (refactoring-scopes anchored on the absence this ADR endorses):
- REFACTOR-246 NEW — LOGIN_FORM ↔ LDAP cross-mode bleed via provider=null (HIGH; migration scenarios with overlapping usernames silently grant the second-mode user the first-mode user's Owner-link).
- REFACTOR-245 NEW — S2S username='ADMIN' collision (HIGH; S2S API-key callers inherit any LOGIN_FORM/LDAP user named "ADMIN" via the (ADMIN, null) USER_OWNER_MAPPING lookup).

**Proposed action**: Promote to `adrs/drafts/auth-compound-key-oauth2-federation.md` (new ADR). Document the compound-key shape `(oidc_username, provider)` explicitly, with the OAuth2-federates / local-modes-share-namespace rationale AND the migration-time consequence (REFACTOR-246) the maintainer accepts. Cross-link with ADR-CANDIDATE-015 (owner-link via reactor Context), ADR-CANDIDATE-030 (mode selection), and ADR-CANDIDATE-105 (Mono-not-Flux owner resolution). The live docs do NOT name this shape today — a DOC-NNN follow-up is the maintainer-companion deliverable.

**Severity rationale**: HIGH — load-bearing identity-architecture decision; the compound-key shape is the persistence-level contract for RBAC, owner-link, S2S, and DISABLED-mode handling. The migration-scenario bleed (REFACTOR-246) is a real operator-trap; the ADR's documentation closes the doc-side silence.

---

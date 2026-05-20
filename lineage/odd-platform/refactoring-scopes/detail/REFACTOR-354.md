## REFACTOR-354 — S2S username='ADMIN' literal collision with operator-named LOGIN_FORM/LDAP user via provider=null bucket — S2S callers inherit the operator-named user's Owner-scoped reads and mutations

**Severity**: HIGH
**Category**: missing-auth (authentication-boundary defence — literal collision)
**Surfaced by**:
- `ReactiveUserOwnerMappingRepositoryImpl.md:security.known_security_gaps[1]`
- Cross-batch: `S2sAuthenticationFilter.java:31-34` (the literal username hardcode)

**Description**: `S2sAuthenticationFilter` (per the batch-E sidecar's surface and confirmed at file:line) hardcodes the S2S API-key principal as:

```java
new UsernamePasswordAuthenticationToken("ADMIN", null, ...)  // uppercase, case-sensitive
```

Combined with the provider-null collapse (REFACTOR-353 / ADR-CANDIDATE-130 NEW), the persistence-layer lookup for an S2S API-key call becomes:

```sql
SELECT * FROM user_owner_mapping
WHERE OIDC_USERNAME = 'ADMIN'   -- case-sensitive, exact
  AND DELETED_AT IS NULL
  AND PROVIDER IS NULL
```

If an operator names a LOGIN_FORM or LDAP user `'ADMIN'` (exact uppercase, case-sensitive match), the S2S API-key call inherits that user's Owner. The Owner carries Role attachments; the Roles carry Policies; the Policies grant Permissions. An S2S caller — typically a Collector pushing metadata, gated by the platform-wide `auth.s2s.enabled` flag — would suddenly perform reads/mutations as the operator-named user.

**The case-sensitive `.eq()` predicate at `ReactiveUserOwnerMappingRepositoryImpl.java:119` MITIGATES some collision cases**: an operator named `'Admin'` or `'admin'` does NOT collide (different byte strings). But the exact-uppercase `'ADMIN'` IS the collision surface — and `'ADMIN'` is a common name choice for operators creating an administrator account in LDAP or LOGIN_FORM.

**The unintended-consequence chain**:
- (1) Operator configures an LDAP directory with a group named `'Admins'` containing user `'ADMIN'`.
- (2) S2S API-keys are enabled (`auth.s2s.enabled=true`).
- (3) A Collector sends an ingestion call with the S2S API key.
- (4) `S2sAuthenticationFilter` produces `UsernamePasswordAuthenticationToken("ADMIN", ...)`.
- (5) `AuthIdentityProviderImpl.fetchAssociatedOwner` calls `userOwnerMappingRepository.getAssociatedOwner("ADMIN", null)`.
- (6) The lookup finds the operator's `'ADMIN'` LDAP user's owner mapping (provider=null because LDAP collapses to null).
- (7) The S2S call now operates as the operator's `'ADMIN'` user with whatever Roles that user has.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:119` — case-sensitive `.eq()`
- `ReactiveUserOwnerMappingRepositoryImpl.java:121-125` — provider-null branch
- `S2sAuthenticationFilter.java:31-34` — hardcoded uppercase 'ADMIN'
- `AuthIdentityProviderImpl.java:29-33` — provider=null for S2S
- Cross-batch: ADR-CANDIDATE-130 NEW (provider-null collapse) + REFACTOR-108 (S2S grants ADMIN across /**)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-130 NEW documents the provider-null collapse architecture; REFACTOR-108 documents the S2S privilege scope. This scope is the COMPOUNDING failure mode where the two architectural choices intersect at the literal username 'ADMIN'. The remedy depends on which side of the intersection to harden:

**Proposed remedy**: Four options:
1. **Reserve 'ADMIN' as a forbidden operator-username** — validate at LOGIN_FORM config-parse time and at LDAP directory-attribute-mapping time that no operator-mapped user can have the literal uppercase username `'ADMIN'`. Surfaces the conflict at boot rather than at runtime.
2. **Add a discriminator to the S2S principal** — change `S2sAuthenticationFilter` to produce `username='__SYSTEM_S2S__'` (a string that operators cannot collide with by naming convention) instead of `'ADMIN'`. Requires migrating any existing user_owner_mapping row that has `oidc_username='ADMIN'` (likely zero rows today; defensive).
3. **Disable Owner-mapping lookup for S2S** — `AuthIdentityProviderImpl.fetchAssociatedOwner` could short-circuit when the principal is the S2S-marked principal, returning a synthesised system-Owner instead of consulting `user_owner_mapping`. Requires the S2S principal to carry a marker that the resolver can detect.
4. **Add provider='S2S' for S2S calls** — S2sAuthenticationFilter writes the principal as `UsernamePasswordAuthenticationToken("ADMIN", null, ..., provider="S2S")` and AuthIdentityProviderImpl passes `"S2S"` (non-empty) to `getAssociatedOwner`, which then resolves to `WHERE OIDC_USERNAME = 'ADMIN' AND PROVIDER = 'S2S'` — no collision with provider=null. Requires `S2sAuthenticationFilter` schema change to track the provider.

Option 4 is the smallest-blast-radius fix; Option 2 has the cleanest semantics; Option 1 is the most operator-friendly.

**Severity rationale**: HIGH — exact-uppercase username collision on a common-choice operator name. The failure mode is silent (no log, no error, just inherited identity); the blast radius is full Owner-mapped permissions. Compounds with REFACTOR-108 (S2S grants ADMIN across /**) — the S2S privilege is BROAD; if the principal also inherits operator-named permissions, the surface is wider still.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — pair with REFACTOR-353 and REFACTOR-355.

---

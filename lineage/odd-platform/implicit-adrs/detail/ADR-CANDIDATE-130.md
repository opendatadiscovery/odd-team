## ADR-CANDIDATE-130 — Provider-null collapse — LOGIN_FORM / LDAP / S2S share a single null-provider namespace at the persistence layer; OAuth2 is the ONLY mode that federates per-IDP. The schema's nullable `provider` column + the application-side `PROVIDER IS NULL` predicate + AuthIdentityProviderImpl's `UserDto(name, null)` form the deliberate architectural triangle, accepting cross-mode-bleed risk during migration scenarios as the trade-off for simpler schema

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 3 vertices of the same architectural triangle (batch K AuthIdentityProviderImpl + batch N ReactiveUserOwnerMappingRepositoryImpl + schema V0_0_55 `provider` column)
**Axes present**: repositories, services, schema
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveUserOwnerMappingRepositoryImpl.md:implicit_adrs.[2]` (HIGH) — "**Provider-null collapse is the deliberate-by-omission design choice — LOGIN_FORM/LDAP/S2S share a provider namespace.** The `getConditions` helper at lines 121-125 reads: `if (StringUtils.isNotEmpty(provider)) conditions.add(PROVIDER.eq(provider)); else conditions.add(PROVIDER.isNull());`. The decision is the BRANCH IS-NULL: empty-string and null provider strings both produce the same `PROVIDER IS NULL` predicate. Combined with AuthIdentityProviderImpl.java:29-33 (the else-branch that produces UserDto(name, null) for LOGIN_FORM, LDAP, and S2S), this file is the persistence-layer manifestation of an architectural decision: only OAuth2 federates per-IDP and warrants a per-provider namespace; LOGIN_FORM, LDAP, and S2S are 'local' to the deployment and share a single null-provider bucket. The trade-off the maintainer accepted: simpler schema (no per-mode discrimination), at the cost of cross-mode user-identity bleed during migration scenarios. **Routed to implicit_adrs because the design intent is consistent with the OAuth2-only-non-null-provider decision documented in AuthIdentityProviderImpl batch K (implicit_adrs.[1]) — the persistence layer is the SECOND vertex of the same architectural triangle (the third being the schema's nullable `provider` column).**" — intent_anchor: "the SQL clause `StringUtils.isNotEmpty(provider) ? PROVIDER.eq(provider) : PROVIDER.isNull()` and the migration's nullable `provider` column TOGETHER are the architectural triangle; null is a first-class provider value, not a sentinel — the maintainer's deliberate accommodation for LOGIN_FORM and LDAP"
- Cross-batch: `AuthIdentityProviderImpl.md:implicit_adrs.[1]` (batch K) — the principal-layer twin that produces `UserDto(name, null)` for LOGIN_FORM / LDAP / S2S authentications.

**Decision statement**: ODD's user-owner mapping schema represents authentication-provider identity via a **nullable `provider` column** where `NULL` is a first-class value (NOT a sentinel for missing data) meaning "local-to-this-deployment identity". The architectural decision encompasses three vertices:

1. **Schema vertex** — `V0_0_55__add_policies_and_roles.sql:1-2` declares `provider VARCHAR(255)` with NO `NOT NULL` clause. The partial unique index `user_owner_mapping_oidc_username_provider_deleted_key` ON `(oidc_username, provider) WHERE deleted_at IS NULL` (V0_0_89:13-15) treats NULL as a unique value — `(alice, NULL)` is one row; `(alice, 'github')` is another row; both can coexist.
2. **Principal-resolution vertex** — `AuthIdentityProviderImpl.java:29-33` (batch K primary-source) produces `UserDto(name, registrationId)` for OAuth2 logins where `registrationId` is the Spring OAuth2 client name (e.g., `'github'`, `'azure-ad'`, `'cognito'`). For LOGIN_FORM / LDAP / S2S logins, the else-branch produces `UserDto(name, null)` — the provider field is deliberately NULL.
3. **Persistence-read vertex** — `ReactiveUserOwnerMappingRepositoryImpl.getConditions(oidcUsername, provider)` at lines 121-125: `if (StringUtils.isNotEmpty(provider)) conditions.add(PROVIDER.eq(provider)); else conditions.add(PROVIDER.isNull());`. The branch consumes the principal's provider and builds the WHERE clause: OAuth2 lookups become `PROVIDER = 'github'`; LOGIN_FORM / LDAP / S2S lookups become `PROVIDER IS NULL`.

The architectural choices encoded:
- **(a) OAuth2-only federation** — only OAuth2 has a meaningful per-IDP namespace concept. The `registrationId` distinguishes per-IDP identity claims (`alice@github` ≠ `alice@google` ≠ `alice@azure`). LOGIN_FORM / LDAP / S2S do NOT federate — they are local to the deployment (LOGIN_FORM users are config-file entries; LDAP users are queried via the operator-configured directory; S2S is a hardcoded ADMIN). The maintainer chose to collapse all three local modes into one provider namespace.
- **(b) Simpler schema** — a per-mode discrimination column (e.g., `auth_mode varchar(20) NOT NULL`) would have required application-layer migration code to backfill on every existing row, plus per-mode discrimination in every query, plus mode-specific UI affordances. The single-nullable-provider design is one column with NO migration backfill.
- **(c) Acknowledged cross-mode-bleed risk** — a deployment migrating LOGIN_FORM → LDAP with overlapping usernames silently merges the identity sets. An operator who had user `'alice'` in `LoginFormSecurityConfiguration`'s admin-users config and now switches `auth.type=LDAP` with a directory containing `cn=alice,...` will see alice's LOGIN_FORM owner-mapping inherited by the LDAP login. The maintainer accepts this risk in exchange for the simpler schema. Documented as REFACTOR-353 (HIGH).
- **(d) S2S username='ADMIN' literal collision** — `S2sAuthenticationFilter.java:31-34` hardcodes the S2S API-key principal as `username='ADMIN'` (uppercase, case-sensitive). Combined with the provider-null collapse, S2S callers' lookups become `WHERE OIDC_USERNAME = 'ADMIN' AND PROVIDER IS NULL`. If an operator names a LOGIN_FORM / LDAP user `'ADMIN'` (exact uppercase), S2S inherits that user's Owner. Documented as REFACTOR-354 (HIGH).
- **(e) Cross-provider username display collision in external JOINs** — multiple downstream repositories (Alert / Activity / OwnerAssociationRequest / Owner) LEFT JOIN `USER_OWNER_MAPPING ON OIDC_USERNAME = X` WITHOUT a provider equality clause. If two ACTIVE rows exist for `(alice, NULL)` and `(alice, GITHUB)`, the LEFT JOIN matches BOTH rows producing row duplication in alerts/activity and non-deterministic Owner display. Documented as REFACTOR-355 (HIGH).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the architectural triangle (schema NULLABLE + principal-layer `UserDto(name, null)` + persistence-layer `PROVIDER IS NULL`) is internally consistent. Each vertex requires the other two to be in this exact shape. The maintainer DESIGNED each vertex with the others in mind. The trade-offs (REFACTOR-353/354/355) are acknowledged in the sidecar's known_security_gaps as the COST of this design, not as bugs.
2. **Structural impact?** YES — affects every authenticated request that resolves an owner-id; affects the schema's partial-unique-index design (the `(oidc_username, provider)` shape uniquely-keys `(alice, NULL)` separately from `(alice, 'github')`); affects every downstream repository that JOINs `USER_OWNER_MAPPING` (the JOIN's clause omits provider — see -355); affects the LDAP / LOGIN_FORM / S2S mode-switch UX (migration retains identity).
3. **Switching to per-mode discrimination is REFACTORING or STRUCTURAL?** STRUCTURAL — adding a `auth_mode` column would require: (i) schema migration with mode-classification of existing rows (impossible — the original auth mode is not recorded); (ii) every read query in 5+ repositories updated to filter by mode; (iii) every write query updated to write the mode column; (iv) mode-aware UI affordances for the manual-mapping endpoint. A multi-week migration, not a refactor.

**Evidence**:
- ReactiveUserOwnerMappingRepositoryImpl.md says: "the SQL clause `StringUtils.isNotEmpty(provider) ? PROVIDER.eq(provider) : PROVIDER.isNull()` and the migration's nullable `provider` column TOGETHER are the architectural triangle; null is a first-class provider value, not a sentinel — the maintainer's deliberate accommodation for LOGIN_FORM and LDAP"
- ReactiveUserOwnerMappingRepositoryImpl.java:121-125 — the persistence-read branch
- AuthIdentityProviderImpl.java:29-33 — the principal-resolution else-branch producing `UserDto(name, null)` for LOGIN_FORM / LDAP / S2S
- V0_0_55__add_policies_and_roles.sql:1-2 — schema declares `provider VARCHAR(255)` NULLABLE
- V0_0_89__update_user_owner.sql:13-15 — partial unique index treats NULL as a distinct value

**Existing ADR**: none. **Composes with ADR-CANDIDATE-129 NEW** (clear-active-then-INSERT — perpetuates the provider-null collapse across binding changes). **Composes with ADR-CANDIDATE-068** (two-tier soft-delete — user_owner_mapping uses standard `deleted_at`). **Composes with ADR-CANDIDATE-074** (soft-delete-aware identity LEFT JOIN — the read-side complement; -355 documents the cross-provider collision the LEFT JOIN doesn't defend against). **Composes with ADR-CANDIDATE-029, -030, -031, -036, -037** (auth-mode family — this ADR specifies how the auth-mode-selection-by-`@ConditionalOnProperty` chain manifests at the persistence layer).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-353 NEW — PROVIDER-NULL CROSS-MODE BLEED (HIGH; LOGIN_FORM / LDAP / S2S share namespace; migration scenarios silently collide identities).
- REFACTOR-354 NEW — S2S username='ADMIN' literal collision via provider=null bucket (HIGH; operator-naming collision opens S2S Owner inheritance).
- REFACTOR-355 NEW — Cross-provider username display collision in external JOINs (HIGH; Alert/Activity/OwnerAssociationRequest/Owner repositories JOIN on OIDC_USERNAME only, row-duplication on cross-provider naming collision).
- REFACTOR-369 NEW — empty-string vs null provider indistinguishable in `IS_NULL` branch (LOW; unreachable rows on the empty-string write path).

**Proposed action**: Promote to `adrs/drafts/provider-null-collapse.md` (new ADR). Document:
- The architectural triangle (schema NULLABLE + principal-resolution else-branch + persistence-read branch).
- The OAuth2-only federation rationale.
- The trade-off acknowledged (REFACTOR-353/354/355).
- The migration UX implication (LOGIN_FORM → LDAP retains identity; OAuth2 → OAuth2-different-registration changes identity).
- The maintainer-extension contract: future authentication modes must EITHER federate (produce a non-null provider string) OR collapse to NULL with the cross-mode-bleed warning. Any new external-system principal source MUST decide which bucket to join.
- The downstream JOIN discipline (REFACTOR-355 — every JOIN to `USER_OWNER_MAPPING` MUST include the provider equality clause to avoid cross-provider row duplication; the existing 4 sites are the gap).
- The S2S ADMIN-username discipline (REFACTOR-354 — operators cannot have a user named 'ADMIN' under LOGIN_FORM/LDAP if S2S is enabled).

Cross-link with ADR-CANDIDATE-129 / -074 / -068 / -070 / -029-037.

**Severity rationale**: HIGH — security-architecture-defining decision. Affects every authenticated request's principal-resolution chain; affects every owner-scoped query's owner-id derivation; affects the LDAP/LOGIN_FORM/S2S deployment migration UX; affects the cross-provider collision surface (REFACTOR-355 — row-duplication is more severe than display-only mismatch). Compatible-change calculus for any future RBAC, ownership, or audit work requires understanding this ADR.

---

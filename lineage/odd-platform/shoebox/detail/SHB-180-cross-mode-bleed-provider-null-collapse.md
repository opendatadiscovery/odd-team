# SHB-180 — LOGIN_FORM ↔ LDAP ↔ S2S cross-mode owner bleed via `provider=null` collapse

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators running ODD with multiple authentication modes over a deployment's lifetime (e.g. starting with LOGIN_FORM, migrating to LDAP, then enabling S2S) discover that user-to-Owner associations bleed across modes because the platform's principal resolver collapses every non-OAuth2 auth mode to `provider=null`. The `user_owner_mapping` table stores `(oidc_username, provider, owner_id, deleted_at)`; the SQL bridge query (`getAssociatedOwner`) uses the predicate `OIDC_USERNAME.eq(?) AND DELETED_AT IS NULL AND (provider non-empty ? PROVIDER.eq(?) : PROVIDER.isNull())`. A LOGIN_FORM user `alice` with `provider=null` and a LDAP user `alice` (`provider=null`) and an S2S collector with username `alice` (`provider=null`) ALL resolve to the SAME `OwnerPojo` if their usernames collide — regardless of which auth mode minted the row. The cross-mode bleed is unidirectional: OAuth2 users (where `provider=registrationId`) are isolated, but every non-OAuth2 user shares one provider slot.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveUserOwnerMappingRepositoryImpl.java:116-127` — `getConditions(oidcUsername, provider)` builds the WHERE clause; line 121-125: `if (StringUtils.isNotEmpty(provider)) PROVIDER.eq(provider) else PROVIDER.isNull()`. The branch fires on null AND on empty-string — both produce the `IS NULL` predicate.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/AuthIdentityProviderImpl.java:29-33` — the principal resolver: OAuth2 → `registrationId`-as-provider; non-OAuth2 (LOGIN_FORM, LDAP, S2S) → `provider=null`. Single point of resolution.
- `concepts/detail/invariants/provider-null-cross-mode-bleed.yaml` (referenced in the UserOwnerMapping sidecar) — pre-existing concept-catalog entry confirming this is a known invariant captured at concept-merger time.
- `odd-platform-api/src/main/resources/db/migration/V0_0_89__update_user_owner.sql:9-15` — the partial unique indexes: `unique_deleted_at_per_owner ON user_owner_mapping (owner_id) WHERE deleted_at IS NULL` AND `user_owner_mapping_oidc_username_provider_deleted_key ON user_owner_mapping (oidc_username, provider) WHERE deleted_at IS NULL`. The DB enforces "at most one active row per (username, provider) tuple" — which means a `(alice, null)` row created by a LOGIN_FORM signup blocks a later LDAP `alice` from getting a distinct mapping.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/IdentityServiceImpl.java:38-39` — `getAssociatedOwner` → `.defaultIfEmpty(new OwnerPojo())` masks the unmapped case in the whoami response (returns an empty OwnerPojo rather than 404), so a user authenticating via a NEW mode whose `(username, null)` slot is held by another mode's prior user gets... the prior user's OwnerPojo. Silent identity collision.
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl.md` — bugs_limitations_corner_cases section names this as primary source for the cross-mode bleed.

## Notes

- **The realistic attack surface is the LDAP-after-LOGIN_FORM migration.** Step 1: operator runs ODD with `auth.type=LOGIN_FORM`; user `alice@example.com` signs up, gets an Owner `Alice` (`user_owner_mapping(oidc_username='alice@example.com', provider=null, owner_id=42)`). Step 2: operator migrates to `auth.type=LDAP`; LDAP returns a different user with username `alice@example.com` (same DN format) → the principal resolver produces `(oidc_username='alice@example.com', provider=null)` → `getAssociatedOwner` returns Owner 42 → the LDAP user inherits the LOGIN_FORM user's owner, ownership grants, role bindings, my-objects, alerts, etc.
- **The S2S case is even worse.** Collectors don't have OwnerPojo associations (the ingestion filter sets `COLLECTOR_ID_SESSION_KEY` directly), but the `provider=null` collapse means that IF a future feature added "collector owner" semantics resolving by username, an S2S collector named `alice` would inherit alice's owner. The current ingestion path bypasses `getAssociatedOwner`, so this is latent rather than active.
- **The downstream impact surface is enormous.** `getAssociatedOwner` consumers include: SearchServiceImpl `my_objects=true`, AlertService `listByOwner` + `listDependentObjectsAlerts`, DataEntityService `getMyObjects` family, ActivityService `MY_OBJECTS`, DataCollaborationService (15 call-sites per AuthIdentityProviderImpl audiences). Every owner-scoped read on the platform inherits the bleed.
- **The DB-side partial unique index is doing the WRONG enforcement.** `user_owner_mapping_oidc_username_provider_deleted_key WHERE deleted_at IS NULL` makes `(alice, null)` unique-per-active-row, which is the CORRECT data model — but combined with the application's "create the row if not exists, otherwise reuse" pattern, it means whoever GETS the (alice, null) slot FIRST locks every future non-OAuth2 alice into the same Owner.
- **The fix is at the principal resolver, not the repository.** AuthIdentityProviderImpl.java:29-33 should produce a distinct provider literal per mode (`"LOGIN_FORM"`, `"LDAP"`, `"S2S"`) — the SQL layer would then naturally segregate. The repository code is correct; the resolver is the broken abstraction.
- **This is a `clustering` thread** — evidence is comprehensive: SQL primary source, principal-resolver primary source, concept-catalog entry confirming pre-existing recognition, the DB partial unique index, the IdentityService masking of the empty case. Graduation gate met.
- Related: F-011 (Principal-to-Owner Resolution — already names UserDto → OwnerPojo). This thread is the cross-mode-bleed facet F-011 currently DOES NOT enumerate; F-011 should absorb this as a drift class.

## Next

1. **Fold into F-011** — drift_classes update: `[oauth2_isolated_via_registrationId, non_oauth2_collapsed_to_provider_null, login_form_ldap_s2s_bleed_via_username_collision, partial_unique_index_enforces_first_writer_wins_locking, identityservice_defaultifempty_masks_collision]`. Update F-011 primary subjects to include AuthIdentityProviderImpl.java:29-33, ReactiveUserOwnerMappingRepositoryImpl.java:116-127, V0_0_89:9-15.
2. **Open follow-ups**:
   - SEC-NNN (HIGH) — AuthIdentityProviderImpl should emit a distinct provider literal per non-OAuth2 mode (`"LOGIN_FORM"` / `"LDAP"` / `"S2S"` / `"DISABLED"` if applicable). This is a one-line resolver change that closes the bleed at the source. Existing `(username, null)` rows can stay; the DB partial unique index naturally segregates new mappings.
   - REFACTOR-NNN — DB migration to backfill provider values on existing `(*, null, *)` rows where the operator can attest the mode of origin. Manual data-recovery exercise; only relevant for deployments that have actively used multiple non-OAuth2 modes.
   - DOC-NNN — operator security page should add a CRITICAL admonition for operators considering an auth-mode migration: "Migrating between LOGIN_FORM / LDAP / S2S will cause user-to-Owner associations to bleed across modes for any colliding usernames. Read X before migrating."
3. **Probe** — run two sequential auth modes (LOGIN_FORM → LDAP) against a fresh container, create user `alice` under each, and confirm via the `whoami` endpoint that the second authentication returns the FIRST user's OwnerPojo.
4. **Verify** the concept-catalog `provider-null-cross-mode-bleed` entry is present at the canonical path and references this thread.

## Links

- cluster_with: [F-011]
- merged_into: (open — feature-flow-builder to fold into F-011)
- supersedes: []

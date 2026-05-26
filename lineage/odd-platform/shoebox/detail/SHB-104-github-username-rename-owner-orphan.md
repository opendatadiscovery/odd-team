# SHB-104 — GitHub login rename silently orphans Owner association

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators using GitHub OAuth see a **silent loss of Owner-link** when a user renames their GitHub login. The platform uses GitHub's mutable `login` string as the username key in `USER_OWNER_MAPPING(oidc_username, provider)`; GitHub allows free login renames at any time (the old name enters 90-day escrow then becomes available to others). After a rename, the next login presents `(alice2, github)` to the principal resolver; the prior `(alice, github)` row is orphaned with no automatic migration, no signal in the UI ("you have no Owner — request association"), no fallback to GitHub's stable numeric `id`, and no doc warning. The feature is "GitHub-rename data-link integrity" — a cross-cutting hypothesis the F-011 anchor flagged but did not name.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/impl/GithubUserHandler.java:36` — `USER_LOGIN = "login"` constant; the `OAuth2User` name resolves to GitHub's `login` (mutable) string, NOT the stable numeric `id`. Line 56 confirms `user-name-attribute` defaults to this constant.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/AuthIdentityProviderImpl.java:29-33` — `OAuth2AuthenticationToken` branch constructs `UserDto(username, registrationId)` where `username` is the OAuth2User's name. No id-based fallback, no canonical-id tracking.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveUserOwnerMappingRepositoryImpl.java:116-127` — `getConditions(provider, username)` builds `WHERE oidc_username = ? AND deleted_at IS NULL AND (provider = ? OR provider IS NULL)`. The username is the lookup partition; a renamed user does NOT match.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerAssociationRequestServiceImpl.java:54-76` — the explicit request-and-approval round-trip is the ONLY documented path to populate `USER_OWNER_MAPPING`. No auto-create on first-login under any auth mode. So a renamed user, on next login, hits empty Owner Mono → silent empty `/my-objects`, `/my-alerts`, MY_OBJECTS activity etc.
- WebFetched 2026-05-19 live user-owner-association docs verbatim: "one user can be associated only with one owner and vice versa" + "Auto-creation on first login: Not documented in this page." Live docs silent on the compound (username, provider) key shape AND silent on rename consequences.
- AlertService.listByOwner / DataEntityService.listAssociated / SearchServiceImpl.search(my_objects=true) / ActivityServiceImpl.listMyEvents — every owner-scoped consumer degrades to empty results with HTTP 200, NOT 401/403/404. Silent invisibility, no on-screen prompt.

## Notes

- **Same shape applies to GitHub, NOT to other OAuth providers in code today** because GitHub is the only provider whose primary identifier (`login`) is operator-mutable post-account-creation. Google's `sub` is stable; Azure's `oid` is stable; Cognito's `cognito:username` is fixed. But the IDP-mutability risk extends to ANY future OIDC provider configured with `user-name-attribute: preferred_username` (a mutable field), so a generic "Mutable-username principal identifier" feature might subsume this.
- **Operator threat model**: a former employee renames their GitHub login `alice` → `alice2` (legitimate). A new external contractor signs up for GitHub and grabs `alice` (after escrow). The new `alice` logs in via the platform's GitHub OAuth IDP, satisfies org-membership at `GithubUserHandler.java:76-91`, and is treated as a fresh user (no USER_OWNER_MAPPING row matches `(alice, github)` because the OLD alice's row was orphaned 90 days ago — but only IF an admin re-mapped them; if not, the row persists). If the row persists, the new alice INHERITS the prior alice's Owner-link. This is a security boundary failure caused by GitHub's login-escrow rotation interacting with ODD's mutable username key.
- Caveat: the same `OAuth2User` flow propagates the registrationId (the operator-chosen YAML key like `github_corp`), so renaming `auth.oauth2.client.github` → `auth.oauth2.client.github_corp` ALSO orphans every owner-link. This is a deployment-time migration hazard the docs do not warn about.
- This is an ENRICHER for F-011 (Principal-to-Owner Resolution). F-011 anchors the compound-key drift; this thread provides the concrete GitHub-rename surface that turns the drift into a recoverable-only-by-admin failure mode.
- Mitigation candidates: (a) switch to GitHub's `id` claim as the username key — backward incompatible; (b) add a one-shot CLI/admin endpoint "rebind USER_OWNER_MAPPING from `alice` to `alice2`"; (c) emit a startup WARN log + a UI banner on first login if no Owner row matches: "Your account has no Owner association — [request] [contact admin]"; (d) document the rename hazard.

## Next

1. Probe — clone an existing user's `oidc_username` in `USER_OWNER_MAPPING`, then change the GitHub login (or simulate by editing the column). Verify the orphan-row state and the silent empty `/my-objects` behaviour.
2. Verify whether ODD's prior `(alice, github)` row is REUSED by a subsequent GitHub account claiming `alice`. The schema partition allows this; the docs do not warn.
3. ENRICHER for F-011 — extend the feature flow with a `username_mutability_compound_key_orphaning` facet. Cross-reference with `GithubUserHandler.java:36` + `AuthIdentityProviderImpl.java:29-33` + `OwnerAssociationRequestServiceImpl.java:54-76` + live docs gap.
4. DOC-NNN — file a doc gap on the live user-owner-association page to warn operators (and users) about (a) the compound-key shape, (b) the GitHub-rename hazard, (c) the registrationId rename hazard, (d) the absence of auto-create + the absence of a UI prompt.
5. Consider as a SEC-NNN — the new-user-inherits-old-user-link scenario is a security boundary failure mode under realistic operational conditions.

## Links

- cluster_with: [F-011]
- merged_into: F-011
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — explicit ENRICHER call-out in thread's Notes block; substrate evidence is operator-narrative + threat-model concretisation, not new file:line beyond what F-011 batches O/N already carry. Appended a 2026-05-26-shoebox-F batch extension to F-011 with three new drift facets — `github_login_escrow_recycle_new_user_inherits_orphaned_owner_link_security_boundary`, `oauth2_registration_id_yaml_key_rename_orphans_user_owner_mapping_provider_column`, `mutable_username_attribute_family_orphan_by_rename_open_to_any_oidc_provider`. STRENGTHENS=3 against existing F-011 facets; SUPERSEDES=0; CONFLICTS=0.

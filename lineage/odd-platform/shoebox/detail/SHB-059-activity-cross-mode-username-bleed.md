# SHB-059 — Activity feed username actor identity bleeds across auth providers — LDAP "alice" and LOGIN_FORM "alice" are indistinguishable in audit history

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

The activity-feed write path resolves the current user via `authIdentityProvider.getCurrentUser()` which returns `UserDto(username, provider)`, but the persisted `activity.created_by varchar(512) NULLABLE` column carries `.username()` ONLY — the provider tag is DROPPED at the mapper boundary. Concrete operator-visible consequence: a deployment that migrates from LOGIN_FORM to LDAP, OR a deployment that runs LOGIN_FORM + OAUTH2 simultaneously with overlapping usernames, OR an organization whose LDAP shortName matches a local-account username, generates audit rows where "alice" cannot be disambiguated. The read-side USER_OWNER_MAPPING LEFT JOIN compounds the bleed — it also joins by username only (`OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL`), so a forensic query asking "which Alice changed the description on 2026-05-19?" returns ALL Alices in one row. This is a SOX/GDPR-class audit-attribution gap: the audit trail is internally consistent but cross-provider ambiguous.

## Evidence

- `odd-platform-api/src/main/java/.../service/ActivityServiceImpl.java:47, 58` — both `createActivityEvent` and `createActivityEvents` use `.map(UserDto::username)` — `UserDto.provider()` is discarded before reaching the mapper.
- `ActivityServiceImpl.java:49, 60` — the `switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))` fallback fires when `getCurrentUser()` is empty (no SecurityContext → system event); concrete failure modes: (a) `ActivityIngestionRequestProcessor` (no SecurityContext on S2S ingestion); (b) `AlertServiceImpl` scheduled-job paths that lose SecurityContext across thread boundaries; (c) `auth.type=DISABLED`.
- Per ActivityServiceImpl sidecar `invariants.[3]` — "The username is the actor-identity field, not the (username, provider) tuple" — confirmed at the schema level: V0_0_48__add_activity.sql defines `created_by` as `varchar(512) NULLABLE` with no `created_by_provider` companion column. The schema commits the username-only contract.
- ActivityMapper.java:79-81 — MapStruct mapper signature `mapToPojo(event, createdAt, createdBy)` — accepts a single `String createdBy`, not a `UserDto`.
- `ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222` (referenced in ActivityServiceImpl sidecar) — every read-side LEFT JOIN: `USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY AND USER_OWNER_MAPPING.DELETED_AT IS NULL`. No provider filter on either side.
- ActivityServiceImpl sidecar `implicit_adrs.[1]` MEDIUM confidence — "The decision: usernames are globally unique across providers, OR the project accepts the cross-mode bleed. The latter is the observable reality."
- Live `configuration-and-deployment/enable-security/authorization` page (verified 2026-05-08 status 200 per AlertController sidecar) — names the Policies/Permissions/Roles/Owners model but DOES NOT name a uniqueness-of-username invariant across providers. Operators cannot infer from the docs that running multiple auth providers needs username-globally-unique config hygiene.
- Activity Feed page (`features/active-platform-features/activity-feed`, verified 2026-05-20) — Auto-resolved alert events appear as system events. No mention of cross-provider identity.

## Notes

- This is an ENRICHER for **F-021 Activity Feed** (existing). F-021 covers the cross-owner audit-trail read surface; this thread surfaces the cross-provider audit-write surface. The two together compose the operator-relevant "actor identity contract" feature.
- Concept-merger candidate: "actor identity is the username, not the (username, provider) tuple, by design." Surfaces in: activity audit, user_owner_mapping, alerting `status_updated_by` (per AlertServiceImpl), permission-policy bindings. The same scope.
- The bleed is bidirectional:
  - **Write-side**: two Alices write `created_by='alice'` indistinguishably.
  - **Read-side**: USER_OWNER_MAPPING joins both audit rows to BOTH Owner mappings (if both Alices have associations), producing a fan-out where one event appears N times in the UI.
- The pseudonym `null` for system events is a separate concern (per ActivityServiceImpl sidecar `implicit_adrs.[0]` — system events have NULL created_by, intentionally) but compounds with this: an operator cannot tell from the activity feed whether "system" (no creator) vs "alice across two providers" (creator was alice somewhere) vs "ingestion path that lost SecurityContext" (creator was alice but the Reactor context dropped it).
- A SAFE fix: add a `created_by_provider` column to `activity`, plumb `UserDto.provider()` through the mapper, update the JOIN to bind by both `(username, provider)`. Schema migration; non-trivial but mechanical. The schema bump is justified by the audit-correctness gain.
- An ALTERNATIVE fix: enforce a `(username, provider)` uniqueness constraint at the USER_OWNER_MAPPING level + add a doc admonition. Cheaper but only mitigates the read-side; the write-side `created_by` remains username-only.

## Next

1. **Probe**: configure LOGIN_FORM + LDAP simultaneously with overlapping usernames; mutate a data entity description as each Alice; query `/api/activity?dataEntityId={id}` and observe whether the events are distinguishable.
2. **Graduate** as F-NNN "Activity audit actor-identity model — cross-provider username bleed" OR enrich F-021 with this as a load-bearing security/compliance concern.
3. **SEC-NNN MEDIUM** — either schema migration adding `created_by_provider` OR doc admonition warning operators to keep usernames globally unique across providers.
4. **DOC-NNN MEDIUM** — `configuration-and-deployment/enable-security/authorization` should state the cross-provider identity model explicitly; operators running multi-provider deployments need this.
5. **Cross-check**: alert's `status_updated_by` field (per AlertServiceImpl + ReactiveAlertRepositoryImpl) shares the same shape — confirm whether the bleed exists symmetrically on the alerting surface (likely yes).

## Links

- cluster_with: [F-021, F-011]
- merged_into: (open)
- supersedes: []

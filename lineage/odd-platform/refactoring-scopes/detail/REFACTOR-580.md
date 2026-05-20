## REFACTOR-580 — STRENGTHEN of the cross-mode actor-bleed concept: `ReactiveActivityRepositoryImpl` read paths LEFT JOIN `USER_OWNER_MAPPING` by `OIDC_USERNAME` only (no provider qualifier) — a LOGIN_FORM 'alice' and an LDAP 'alice' resolve to the SAME OwnerPojo; cross-mode bleed is structurally encoded in 4 different read methods

**Severity**: HIGH (forensic-integrity violation under multi-auth-mode deployments)
**Category**: cross-mode-bleed (extends the existing `provider-null-cross-mode-bleed` concept; this REFACTOR is the activity-tier instance)
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[1]` (CANARY HEADLINE — "**Cross-mode actor bleed: LOGIN_FORM 'alice' and LDAP 'alice' resolve to the SAME OwnerPojo on the read path**. Every read query LEFT JOINs `USER_OWNER_MAPPING ON OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` (lines 157-158, 178-179, 199-200, 221-222) — provider-agnostic. A deployment migrating from LOGIN_FORM to LDAP without uniqueness on (`username`, `provider`) tuples at the user-creation layer will see the historical LOGIN_FORM 'alice' activity rows mapped to the LDAP 'alice' owner — even if those are different people" — HIGH; PRIMARY-SOURCE for read-side cross-mode bleed)
- `ReactiveActivityRepositoryImpl.md:implicit_adrs[3]` ("**Actor resolution joins USER_OWNER_MAPPING by username only (not by auth provider)**: every read path issues `.leftJoin(USER_OWNER_MAPPING).on(USER_OWNER_MAPPING.OIDC_USERNAME.eq(ACTIVITY.CREATED_BY).and(USER_OWNER_MAPPING.DELETED_AT.isNull()))` (lines 157-158, 178-179, 199-200, 221-222). The join is provider-agnostic")
- `ReactiveActivityRepositoryImpl.md:security.known_security_gaps[0]` (HIGH — "**Provider-agnostic actor resolution = cross-mode bleed read surface**")
- `ActivityServiceImpl.md:security.known_security_gaps[1]` (MEDIUM — "cross-mode bleed propagator at the persistence layer: UserDto.provider is dropped before reaching activity.created_by")
- `ActivityHandler.md:stress_findings.S-D-2` (the auth-mode coverage — confirms the handler is auth-mode-agnostic; doesn't carry provider info)
- `ActivityController.md:security.known_security_gaps[STRESS_D2-cross-mode-bleed]` (the controller-tier surface)

**Description**: Four distinct read methods in `ReactiveActivityRepositoryImpl` join `USER_OWNER_MAPPING` to resolve the actor identity for activity rows:

- `findAllActivities` (line 73-89) — uses `getCommonConditions` which adds the LEFT JOIN at line 220-222.
- `findMyActivities` (line 91-107) — same.
- `findDependentActivities` (line 109-126) — same.
- `findDataEntityActivities` (line 128-142) — same.

All four issue:

```sql
LEFT JOIN USER_OWNER_MAPPING 
  ON USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY
 AND USER_OWNER_MAPPING.DELETED_AT IS NULL
```

The `OWNERSHIP` table has 4 columns (`OWNER_ID`, `OIDC_USERNAME`, `PROVIDER`, `DELETED_AT`). The join predicate omits `PROVIDER` — provider-agnostic.

The write side (`ActivityServiceImpl.java:47-49`) records the activity's `created_by` using `UserDto::username` only — the provider is DROPPED before the row commits:

```java
.map(UserDto::username)   // drops UserDto.provider
.map(username -> activityMapper.mapToPojo(event, activityCreateTime, username))
```

`V0_0_48__add_activity.sql:10` (`created_by varchar(512)` — NULLABLE) — the schema has NO provider column. The platform structurally cannot distinguish a LOGIN_FORM 'alice' from an LDAP 'alice' at the activity level.

**The bleed scenario**:
1. Deployment 1 (LOGIN_FORM): user 'alice' performs N description edits. The activity rows record `created_by = 'alice'`.
2. Deployment migrates to OAUTH2 (e.g. via OKTA SSO). A different person (also named 'alice', but from corporate AD) authenticates.
3. The platform creates a USER_OWNER_MAPPING row for the new alice (OAuth provider).
4. The OLD LOGIN_FORM mappings may have been DELETED_AT-set during migration (operator cleanup), but if they have DELETED_AT IS NULL, the read-side LEFT JOIN matches BOTH the old and new alice mappings.
5. The historical LOGIN_FORM 'alice' activity rows are visually attributed to the new OAUTH2 'alice' — DIFFERENT PERSON.

**Operator-visible consequence**:
- Forensic incident response: "who edited this description on March 1?" — the audit row says 'alice' → resolved to the current (OAUTH2) alice's OwnerPojo → but the actual editor was the LOGIN_FORM alice (a different person).
- Compliance audit: SOX / GDPR records-of-processing reviews see misattributed events.
- Operator confidence in the audit trail degrades.

**Cross-cutting context**: This is the **provider-null-cross-mode-bleed concept** (per existing concept index entry, established in earlier batches at `ReactiveUserOwnerMappingRepositoryImpl` — batch N). This REFACTOR is the ACTIVITY-TIER instance. The bleed mechanism is:
- WRITE side records only `username` (no provider qualifier).
- READ side joins only by `username` (no provider filter).
- A platform deployment with multiple concurrent auth modes (or migrating between modes) produces ambiguous resolution.

The collective fix requires changes at MULTIPLE layers:
- Schema migration: add `created_by_provider` column to the activity table.
- Write-side update: include provider when writing activity rows.
- Read-side update: include provider in the JOIN predicate.
- Migration backfill: existing activity rows have `created_by_provider IS NULL` — must be handled.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:157-158` (the LEFT JOIN — verified omits PROVIDER)
- `ReactiveActivityRepositoryImpl.java:178-179` (same)
- `ReactiveActivityRepositoryImpl.java:199-200` (same)
- `ReactiveActivityRepositoryImpl.java:220-222` (same — the `getCommonConditions` shared site)
- `ActivityServiceImpl.java:47-49` (write side — `UserDto::username` only)
- `V0_0_48__add_activity.sql:10` (`created_by varchar(512)` — no provider column)
- Concept index entry `provider-null-cross-mode-bleed` (established in batch N — `ReactiveUserOwnerMappingRepositoryImpl`)
- `ReactiveUserOwnerMappingRepositoryImpl` batch N sidecar (the resolution-side primary source)

**Existing-ADR-or-implied-prescription**: NONE explicitly. The implicit decision is "usernames are globally unique across providers, OR the project accepts the cross-mode bleed" — the latter is the observable reality (codified as ADR-CANDIDATE-? from the existing concept-merger run; this REFACTOR strengthens with the activity-tier evidence).

**Proposed remedy**: Three options:

1. **LOWEST cost — Document the limitation**: Add an admonition to `activity-feed.md` AND to the multi-auth-mode setup docs: "The activity feed resolves actor identity by username only. Deployments using multiple concurrent auth modes (or migrating between modes) may see misattribution if two users share a username across modes. Operators are responsible for ensuring username uniqueness across providers."

2. **MEDIUM cost — Schema migration + write/read fix**: Add `created_by_provider VARCHAR(32)` column to the activity table. Backfill existing rows with NULL (mark as 'unknown provider'). Update writes to include the provider; update reads to filter by `(USERNAME, PROVIDER)` tuple.

3. **HIGHER cost — Replace `created_by` with `created_by_user_id BIGINT FK` reference**: Store the owner-mapping FK directly on the activity row, decoupling from username-string. Resolves the bleed structurally. Requires schema migration + write-side service refactor to resolve username to mapping at write time + read-side JOIN simplification.

**Recommended**: Option 1 (document the limitation) immediately — closes the operator-awareness gap. Investigate Option 2 (schema fix) in a future hardening sprint. Option 3 is the long-term architecturally clean solution but requires substantial coordination.

**Severity rationale**: HIGH — forensic-integrity violation under multi-auth-mode deployments. Severity is bounded by:
- Single-auth-mode deployments (the most common case) DO NOT trigger the bleed.
- Migration scenarios (LOGIN_FORM → OAuth2) are the primary trigger.
- The bleed is structural; the fix requires coordinated schema + code changes.

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling), REFACTOR-558 (oldState race), REFACTOR-560 (system_event flag), REFACTOR-566 (idempotency), REFACTOR-561 (row-order non-determinism). The six activity-audit-correctness scopes together define the audit-trail trust contract.

---

## REFACTOR-567 — `findMyActivities` axis-mismatch — filters by `OWNERSHIP.OWNER_ID = currentOwnerId` (activity ON entities I own), NOT by `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` (activity I performed) — a user with no ownership attachments but who has made platform changes sees NOTHING in the "My" tab; their own work is invisible to themselves

**Severity**: MEDIUM (UX semantic gap)
**Category**: misleading-api
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[3]` (CANARY HEADLINE — "**'My Activities' axis-mismatch: `findMyActivities(currentOwnerId)` filters by `OWNERSHIP.OWNER_ID = currentOwnerId` (activity ON entities I own), NOT by `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` (activity I performed)**. ... The UI's 'My' tab shows 'changes to entities my owner is attached to' — which is NOT 'changes I personally made'" — MEDIUM)
- `ReactiveActivityRepositoryImpl.md:stress_findings.B2` ("`findMyActivities` name promises 'my activities'... **'My' = activity on entities I own.** Line 103 threads `currentOwnerId` into `ownerIds` slot of `getCommonConditions`, which produces `OWNERSHIP.OWNER_ID.in([currentOwnerId])`. The actor side (USER_OWNER_MAPPING.OWNER_ID, line 273) is NOT auto-filtered by current user")
- `ActivityServiceImpl.md:stress_findings.S-D-2` ("MY_OBJECTS silently empty for users without associated Owner" — composes with this finding for the corner case)
- `ReactiveActivityRepositoryImpl.java:91-107` (the `findMyActivities` method body)
- `ReactiveActivityRepositoryImpl.java:264-275` (`getCommonConditions` — `ownerIds` vs `userIds` are different predicates; lines 269-271 are owner-axis, line 273 is user-axis)
- `ActivityServiceImpl.java:184-199` (`fetchMyActivities` — passes `currentOwnerId` to `findMyActivities` for owner-axis filter)
- WebFetch `/features/active-platform-features/activity-feed` (2026-05-20, status 200; User filter framed for "auditing a specific person's platform activity")

**Description**: `ReactiveActivityRepositoryImpl.findMyActivities(currentOwnerId, ...)` (`:91-107`):

```java
public Flux<ActivityDto> findMyActivities(
    OffsetDateTime beginDate, OffsetDateTime endDate, Integer size,
    Long currentOwnerId,
    Long datasourceId, Long namespaceId, List<Long> tagIds,
    List<Long> userIds, ActivityEventTypeDto eventType,
    Long lastEventId, OffsetDateTime lastEventDateTime
) {
  return jooqReactiveOperations.flux(
    DSL.using(connection).select(/* ... */)
      .from(ACTIVITY)
      .join(DATA_ENTITY).on(...)
      .leftJoin(USER_OWNER_MAPPING).on(...)
      .leftJoin(OWNER).on(...)
      // ... other conditional joins ...
      .where(getCommonConditions(
        beginDate, endDate,
        List.of(currentOwnerId),     // <-- passed as the OWNER_IDS slot for OWNERSHIP filter
        userIds,                      // <-- passed separately as USER_IDS slot for USER_OWNER_MAPPING filter
        // ...
      ))
      .orderBy(...)
      .limit(size)
  );
}
```

In `getCommonConditions` (lines 264-275):

```java
private List<Condition> getCommonConditions(
    OffsetDateTime beginDate, OffsetDateTime endDate,
    List<Long> ownerIds,            // <-- OWNERSHIP.OWNER_ID predicate at line 269-271
    List<Long> userIds,              // <-- USER_OWNER_MAPPING.OWNER_ID predicate at line 273
    // ...
) {
  // ...
  if (CollectionUtils.isNotEmpty(ownerIds)) {
    conditions.add(OWNERSHIP.OWNER_ID.in(ownerIds));            // line 270 — entity-side ownership
  }
  if (CollectionUtils.isNotEmpty(userIds)) {
    conditions.add(USER_OWNER_MAPPING.OWNER_ID.in(userIds));    // line 273 — actor-side identity
  }
  // ...
}
```

**The semantic ambiguity**: `currentOwnerId` is threaded into the `ownerIds` slot — the ENTITY-OWNERSHIP axis. This produces the predicate "activity rows where the entity's owner is the current user's owner" — i.e. "changes to entities I own".

**The user's intuition**: "My" should mean "activity I PERFORMED" — the ACTOR axis. That predicate would be on `USER_OWNER_MAPPING.OWNER_ID.in([currentOwnerId])` (joining the activity row's `created_by` username to the current user's owner-mapping).

**The product framing on the live docs** (per WebFetch 2026-05-20): the `User` filter parameter is framed for "auditing a specific person's platform activity" — which IS the ACTOR axis. The `Owner` filter parameter is the entity-owner axis. The "My" tab's mapping to `currentOwnerId` THEN to the ENTITY-OWNER axis is inconsistent with the User-filter framing.

**The corner case (composing with REFACTOR-???)**: a user authenticated via LOGIN_FORM ('alice') whose `user_owner_mapping` row has NOT yet been created (admin oversight, or a brand-new user) AND who has made platform changes (description edits, tag assignments):
- Their activity rows have `created_by = 'alice'` (the OIDC_USERNAME — recorded at INSERT).
- They have NO `OwnershipPojo` rows (no `OWNERSHIP.OWNER_ID` matches their owner-id).
- They visit the "My" tab → `fetchMyActivities` → `authIdentityProvider.fetchAssociatedOwner()` returns empty → `.switchIfEmpty(Flux.empty())` → empty response.
- They DID make changes but the UI shows "no activity".

Even WITHOUT the corner case: a user WHO HAS an owner-mapping but is NOT an owner of any data entity sees an empty "My" tab even though they may have made platform changes.

**Cross-cutting context**: This is the **axis-confusion defect class** in the audit-log UX. Standard fix:
- Rename "My Objects" to "My Owned Entities" (current behaviour) — clarifies the semantic.
- Add an ALTERNATIVE "My Actions" / "My Changes" tab that filters by actor (USER_OWNER_MAPPING side).
- Cross-link to documentation explaining the distinction.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:91-107` (verified file:line: `findMyActivities` method body)
- `ReactiveActivityRepositoryImpl.java:264-275` (`getCommonConditions` — the asymmetric `ownerIds` vs `userIds` predicates)
- `ReactiveActivityRepositoryImpl.java:269-271` (line 270: `OWNERSHIP.OWNER_ID.in(ownerIds)`)
- `ReactiveActivityRepositoryImpl.java:272-275` (line 273: `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`)
- `ActivityServiceImpl.java:184-199` (`fetchMyActivities` — uses `currentOwnerId` from `fetchAssociatedOwner`)
- WebFetch `/features/active-platform-features/activity-feed` (the User filter framed for "auditing a specific person's platform activity")

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-022 (View-modes for activity streams are encoded as a single `type` enum parameter — MY_OBJECTS / DOWNSTREAM / UPSTREAM / ALL — dispatching at the service layer) is the dispatch contract. The CONTENT of "My Objects" is not specified in any ADR. The defect is the implicit interpretation of "My" — the maintainer chose entity-ownership-axis without explicit anchor.

**Proposed remedy**: Three options:

1. **LOWEST cost — rename the tab/parameter to clarify**:
   - UI: "My Objects" → "My Owned Entities"
   - OpenAPI: `MY_OBJECTS` → `MY_OWNED_ENTITIES` (breaking change for client SDKs) OR add a parallel `MY_ACTIONS` enum value.
   - Documentation: add a sentence to `activity-feed.md` explaining "My Owned Entities shows changes to entities you own, NOT changes you performed."
   - Effort: small, but breaks OpenAPI consumer compatibility.

2. **MEDIUM cost — Add a parallel "My Actions" filter**:
   - Add a new enum value `MY_ACTIONS` that thread `currentOwnerId` into the `userIds` slot of `getCommonConditions` (the actor-axis).
   - UI: add a tab "My Actions" alongside "My Objects".
   - Documentation: explain both.
   - Effort: moderate. Preserves backward compatibility; adds the missing functionality.

3. **HIGHEST cost — Unify into a single "My" tab that does both axes**:
   - "My" returns the UNION of (entity-ownership-axis AND actor-axis) for the current user.
   - Single tab, comprehensive coverage.
   - Effort: moderate. Behaviour change (more rows returned).

**Recommended**: Option 1 (rename for clarity) + Option 2 (add `MY_ACTIONS` as a parallel filter). Option 1 closes the immediate UX confusion; Option 2 adds the missing functionality without breaking existing clients.

**Severity rationale**: MEDIUM — UX semantic gap. A common operator workflow ("show me what I changed today") returns wrong results. Severity is bounded by:
- Operators familiar with the platform know the convention (entity-ownership axis); newcomers are confused.
- Workaround: a user can pass `userIds=[currentUserOwnerId]` explicitly (if they know to look it up).
- The fix is incremental.

**Suggested backlog grouping**: `UX-NNN activity-feed clarity sprint`. Pair with REFACTOR-565 (`ownerIds` silently dropped — the related asymmetric-parameter defect), REFACTOR-061 (`lasEventId` typo).

---

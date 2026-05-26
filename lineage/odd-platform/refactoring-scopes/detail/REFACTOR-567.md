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


## STRENGTHENS — Batch ZL (2026-05-26 — Activity page-root component adds the SIXTH surface layer; the LSN-020 drift now spans SQL + service + controller + UI Filters component + en.json + live doc + Activity PAGE-ROOT composition)

The Activity page-root sidecar surfaces the same `userIds` axis-mismatch defect at the PAGE-ROOT COMPOSITION layer — where the operator FIRST encounters the misleading label, with the `<Filters/>` child mounted as one of the two siblings (`<Filters/>` + `<ActivityResults/>`). The drift now spans SIX layers; the operator-visible surface is end-to-end.

**New surfaced_by entries**:

- `odd-platform__ts__react-component__component__Activity.md:bugs_limitations_corner_cases[0]` (HIGH) — "The 'User' filter (Filters.tsx:93-98 — `<MultipleFilter filterName='userIds' name={t('User')} />`) is operator-misleading at the UI layer (Category F TRANSLATES_SILENTLY — LSN-020). MultipleFilter at `components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34` dispatches `fetchOwnersList` for any `filterName !== 'tagIds'`; MultipleFilterAutocomplete (lines 44-47) does the same. The dropdown therefore lists OWNERS, not users. Selecting an OWNER puts its ID into `queryParams.userIds`; the backend binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. Three operator-observable consequences: (a) users without a user-owner mapping cannot be selected at all (silent absence from dropdown); (b) reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; (c) multiple users sharing an owner collapse into a single filter result. The label says 'User'; the live doc says 'performed by'; the implementation says owner-of-the-actor-via-mapping."

- `odd-platform__ts__react-component__component__Activity.md:stress_findings.name_behavior_pairs[0]` (HIGH) — "DRIFT_NAME_VS_BEHAVIOR. Users without an owner mapping cannot be selected (silent dropdown absence); reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; multiple users mapped to the same owner collapse into one filter result." — explicit DRIFT_NAME_VS_BEHAVIOR flag at the PAGE-ROOT stress_findings.

- `odd-platform__ts__react-component__component__Activity.md:stress_findings.request_inputs[0]` (HIGH) — "available-but-unused column smell: YES. `ACTIVITY.CREATED_BY` (text column carrying the actual actor's OIDC username) is read in the LEFT JOIN at `ReactiveActivityRepositoryImpl.java:221` (`USER_OWNER_MAPPING.OIDC_USERNAME.eq(ACTIVITY.CREATED_BY)`), SELECTED in the result mapping via `buildBaseQuery` at line 212, but ABSENT from any WHERE predicate. This is the column an actor-filter that honored the parameter name would filter on." — Activity page-root SURFACES the available-but-unused column smell explicitly at the page-composition layer.

- `odd-platform__ts__react-component__component__Activity.md:security.known_security_gaps[1]` (HIGH) — "The 'User' filter label is operator-misleading at this surface. An auditor using the page to investigate 'what did user X do?' is given a UI control labelled 'User', whose underlying filter is on owner-of-actor-via-mapping. The audit conclusion drawn from the filtered list is wrong in shape — the user X's actions are absent unless X has a user-owner mapping, and the actions of every other user mapped to X's owner are present. This is the operator-facing surface of LSN-020."

**What this strengthening adds**: the prior strengthening (batch ZJ via en.json) anchored the drift at the i18n resource bundle layer (5 layers total: SQL + service + controller + UI Filters component + en.json + live doc). Batch ZL adds the SIXTH surface — the PAGE-ROOT COMPOSITION:

1. **The page-root Activity.tsx EXPLICITLY COMPOSES `<Filters/>` + `<ActivityResults/>` as two sibling children** — Activity.tsx:6-17 is the composition where the operator FIRST encounters the misleading label. The page-root is the LANDING POINT for the entire feature.

2. **The page-root carries the SECURITY consequence** — Activity's security.known_security_gaps[1] explicitly frames the LSN-020 drift as an AUDIT-MISLEADING concern: a security/compliance reviewer following the live docs to find a suspect user's activity gets entity-ownership-axis results (wrong shape). The page-root is where the auditor lands; the misleading label is at this level.

3. **The page-root surfaces the available-but-unused column smell EXPLICITLY** — Activity.tsx:stress_findings.request_inputs[0] enumerates the `ACTIVITY.CREATED_BY` column as the available-but-unused candidate the actor-filter SHOULD have used. The page-root composition is where the architectural mismatch becomes visible.

4. **Full operator-facing surface area now**: Page-root + Filters component + i18n key + live doc + service + SQL — six layers of reinforcement of the WRONG promise. The fix span widens correspondingly:
   - Rename SQL column or add parallel actor-filter (the architectural fix)
   - Relabel the UI Filters component (Filters.tsx:93-98 changes `filterName='userIds'` to `'ownerIds'` or similar)
   - Rename i18n key (en.json:347 + 5 non-English locales — per natural-keys ADR-CANDIDATE-011)
   - Update live doc page copy ("performed by" → "owned by")
   - Update the Activity page-root's audience copy (security/compliance reviewer guidance)
   - Optionally add the missing "Actor" filter (a new MultipleFilter dispatching to fetchActiveUsersList or similar) — the most ambitious fix

**Triangulation count after ZL**: 6 sidecars (was 5 — SQL + service + controller + UI Filters + en.json; ZL adds Activity page-root composition).

**Severity unchanged**: MEDIUM. The cross-layer corroboration is comprehensive; the fix span is well-understood; the priority is bounded by the compliance-audit-misleading framing.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-565 (ownerIds silently dropped for MY_OBJECTS/UPSTREAM/DOWNSTREAM); REFACTOR-060 (userIds/ownerIds filter parameter enumeration); ADR-CANDIDATE-011 (natural-keys i18n contract); ADR-CANDIDATE-091 (URL-as-source-of-truth — the Activity page-root surfaces this pattern too, strengthened in this batch).
- SUPERSEDES: none.
- CONFLICTS: none.

---

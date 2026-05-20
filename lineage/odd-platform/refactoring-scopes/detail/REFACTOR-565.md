## REFACTOR-565 — `ActivityServiceImpl.getActivityList` silently drops the `ownerIds` query parameter for `type=MY_OBJECTS|UPSTREAM|DOWNSTREAM` view modes — operator filtering "show me Alice's activity on UPSTREAM entities" gets the WHOLE UPSTREAM lineage's activity, unfiltered

**Severity**: MEDIUM (silent-parameter-drop UX bug)
**Category**: silent-feature-ignored
**Surfaced by**:
- `ActivityServiceImpl.md:stress_findings.S-B-2` (CANARY HEADLINE — "`getActivityList` drops `ownerIds` for non-ALL view modes" — line 108 fetchMyActivities accepts NO ownerIds; line 110/112 fetchDependentActivities also accepts NO ownerIds. The HTTP-API-visible `ownerIds` query parameter is **silently ignored** for MY_OBJECTS / UPSTREAM / DOWNSTREAM modes")
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[1]` ("ownerIds query parameter is silently dropped for type=MY_OBJECTS|UPSTREAM|DOWNSTREAM, asymmetric with type=ALL. An operator setting type=MY_OBJECTS&owner_ids=[5] gets ONLY their own owner's activity (the owner-5 filter is ignored)" — MEDIUM)
- `ActivityServiceImpl.java:107-116` (the switch dispatch with parameter-asymmetric branches)
- `ActivityServiceImpl.java:168-181` (`fetchAllActivities` — accepts `ownerIds`)
- `ActivityServiceImpl.java:184-199` (`fetchMyActivities` — does NOT accept `ownerIds`)
- `ActivityServiceImpl.java:201-217` (`fetchDependentActivities` — does NOT accept `ownerIds`)
- `ActivityController.java:30-31` (the `ownerIds` parameter — bound on the HTTP API regardless of `type`)

**Description**: `ActivityServiceImpl.getActivityList` (`:85-117`) dispatches by `type`:

```java
return switch (type) {
  case ALL -> fetchAllActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds, ownerIds, userIds, eventTypeDto, lastEventId, lastEventDateTime);
  case MY_OBJECTS -> fetchMyActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds,        userIds, eventTypeDto, lastEventId, lastEventDateTime);  // no ownerIds
  case UPSTREAM -> fetchDependentActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds,   userIds, eventTypeDto, lastEventId, lastEventDateTime, LineageStreamKind.UPSTREAM);  // no ownerIds
  case DOWNSTREAM -> fetchDependentActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds, userIds, eventTypeDto, lastEventId, lastEventDateTime, LineageStreamKind.DOWNSTREAM); // no ownerIds
  case null -> fetchAllActivities(...);  // default — ALL
};
```

The `fetchAllActivities` method (`:168-181`) accepts and threads `ownerIds` into the repository's `OWNERSHIP.OWNER_ID.in(ownerIds)` predicate. The `fetchMyActivities` (`:184-199`) and `fetchDependentActivities` (`:201-217`) methods accept NO `ownerIds` parameter; the field is silently discarded.

**The asymmetric controller surface**:
- `ActivityController.getActivity` (lines 23-41) accepts `ownerIds` as a query parameter REGARDLESS of `type`.
- The HTTP API doesn't fail validation when `ownerIds=[5]&type=MY_OBJECTS` is submitted.
- The OpenAPI spec documents `ownerIds` as a filter parameter without conditional behaviour caveats.
- The service silently DROPs the value for 3 of 4 view modes.

**Operator-visible consequence**: an operator using the UI's filter sidebar enters "User filter: alice, View: MY_OBJECTS" expecting "activity on entities I own that involved alice as actor". The submitted request becomes `GET /api/activity?type=MY_OBJECTS&owner_ids=[alice]`. The service:
- Looks up Alice's owner-id (say, 5).
- Submits to `fetchMyActivities` — which calls `authIdentityProvider.fetchAssociatedOwner()` (the CALLER's owner, not Alice's).
- The `ownerIds=[5]` parameter is DROPPED. The query is `OWNERSHIP.OWNER_ID = <caller's owner_id>` — caller-only narrow.
- The response is the caller's own activity, NOT Alice's.

The operator sees a result that LOOKS like the filter worked (rows returned, filtered by some owner), but the filter was actually ignored. They cannot diagnose this without reading source code.

**Cross-cutting context**: This is the **asymmetric-parameter-dispatch defect class** — a controller accepts more parameters than the service can process for some branches. Standard fixes:

1. Make all dispatch branches accept the full parameter set (uniform service signature).
2. Reject invalid combinations at validation (controller refuses `ownerIds + type=MY_OBJECTS` with `BadUserRequestException`).
3. Document the constraint (OpenAPI spec adds a caveat).

The cleanest fix is (1) — extend `fetchMyActivities` and `fetchDependentActivities` to also accept `ownerIds` and apply the same `OWNERSHIP.OWNER_ID.in(ownerIds)` filter as `fetchAllActivities`.

**Primary source citations**:
- `ActivityServiceImpl.java:85-117` (the switch dispatch — verified asymmetric parameter passing)
- `ActivityServiceImpl.java:168-181` (`fetchAllActivities` signature includes `ownerIds`)
- `ActivityServiceImpl.java:184-199` (`fetchMyActivities` signature — does NOT include `ownerIds`)
- `ActivityServiceImpl.java:201-217` (`fetchDependentActivities` signature — does NOT include `ownerIds`)
- `ActivityController.java:30-31` (the `ownerIds` parameter exposed on the HTTP API)
- `ReactiveActivityRepositoryImpl.java:269-271` (the `OWNERSHIP.OWNER_ID.in(ownerIds)` predicate in `getCommonConditions`)
- `openapi.yaml:3206-3347` (the controller's spec — `ownerIds` documented without conditional caveat)

**Existing-ADR-or-implied-prescription**: NONE. The defect is incidental — the maintainer added `ownerIds` to `fetchAllActivities` but did not propagate to the other branches. No ADR defends or constrains the dispatch.

**Proposed remedy**: Two options:

1. **LOWEST cost — extend `fetchMyActivities` and `fetchDependentActivities` to accept and pass `ownerIds`**:
   ```java
   // BEFORE:
   private Flux<Activity> fetchMyActivities(
       OffsetDateTime beginDate, OffsetDateTime endDate, Integer size,
       Long datasourceId, Long namespaceId, List<Long> tagIds,
       List<Long> userIds, ActivityEventTypeDto eventType,
       Long lastEventId, OffsetDateTime lastEventDateTime
   ) {
     return authIdentityProvider.fetchAssociatedOwner()
       .flatMapMany(owner -> activityRepository.findMyActivities(
         beginDate, endDate, size, owner.getId(),
         datasourceId, namespaceId, tagIds, userIds, eventType,
         lastEventId, lastEventDateTime
       ))
       .switchIfEmpty(Flux.empty())
       .map(activityMapper::mapToActivity);
   }

   // AFTER (extended with ownerIds):
   private Flux<Activity> fetchMyActivities(
       OffsetDateTime beginDate, OffsetDateTime endDate, Integer size,
       Long datasourceId, Long namespaceId, List<Long> tagIds,
       List<Long> ownerIds,                                    // NEW
       List<Long> userIds, ActivityEventTypeDto eventType,
       Long lastEventId, OffsetDateTime lastEventDateTime
   ) {
     return authIdentityProvider.fetchAssociatedOwner()
       .flatMapMany(owner -> {
         // Always include caller's owner; merge with caller-supplied ownerIds
         final List<Long> effectiveOwnerIds = ownerIds == null
           ? List.of(owner.getId())
           : Stream.concat(Stream.of(owner.getId()), ownerIds.stream()).distinct().toList();
         return activityRepository.findActivitiesForOwners(
           beginDate, endDate, size, effectiveOwnerIds,
           datasourceId, namespaceId, tagIds, userIds, eventType,
           lastEventId, lastEventDateTime
         );
       })
       .switchIfEmpty(Flux.empty())
       .map(activityMapper::mapToActivity);
   }
   ```
   Same pattern for `fetchDependentActivities`. The repository method may need a new variant or the existing `findMyActivities` extended to accept a list of owner IDs.

   Trade-off: changes the semantics of `type=MY_OBJECTS&owner_ids=[X]` — was "ignored", becomes "caller's owner UNION X". This is the intuitive behaviour but technically a behaviour change.

2. **MEDIUM cost — reject the asymmetric combination at validation**:
   ```java
   if ((type == ActivityType.MY_OBJECTS || type == ActivityType.UPSTREAM || type == ActivityType.DOWNSTREAM)
       && ownerIds != null && !ownerIds.isEmpty()) {
     return Flux.error(new BadUserRequestException(
       "ownerIds parameter is not supported for type=" + type + "; use type=ALL"
     ));
   }
   ```
   Cleaner contract; refuses ambiguous combinations. UX cost: callers must understand the constraint.

**Recommended**: Option 1 — extend the parameter set uniformly. The user's expectation when submitting `ownerIds + type=MY_OBJECTS` is "AND" semantics ("my objects, plus owned by X") — current behaviour is "drop the second condition". Option 1 honors the intent.

**Severity rationale**: MEDIUM — silent-parameter-drop UX bug. The caller's filter is ignored without signal. Severity is bounded by:
- Most operators submit `type=ALL` or use the default (no type), where `ownerIds` works correctly.
- The defect is discoverable by manual UI testing (the operator notices the filter "doesn't work").
- The fix is incremental (no schema migration, no API change at the controller level).

**Suggested backlog grouping**: `UX-NNN activity-feed filter consistency sprint`. Pair with REFACTOR-067 (`size` unbounded — also controller-surface quality), REFACTOR-061 (`lasEventId` typo — same controller).

---

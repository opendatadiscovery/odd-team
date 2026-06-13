---
node_id: "odd-platform java service:ActivityServiceImpl"
node_kind: service
axis: services
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-20-LSN-019-batch-activity
pillar_anchored_features:
  - P-07:F-003 Activity Feed Audit-Trail Surface (THIS service is the orchestration layer between controller and repository AND the write-side funnel from @ActivityLog aspects)
  - P-09:F-001 RBAC (read-side: zero @PreAuthorize, zero programmatic authorization, zero owner-scoping on cross-owner reads; write-side: createdBy username with no provider tag — cross-mode bleed propagator)
  - P-08:F-002 Housekeeping TTL Enforcement (this service's writes are the rows that the ActivityEmptyPartitionsHousekeepingJob never drops while non-empty)
  - P-07:F-001 Alerting (AlertServiceImpl.applyAlertActions emits ALERT_STATUS_UPDATED + OPEN/RESOLVED_ALERT_RECEIVED through createActivityEvents within ONE @ReactiveTransactional)
---

# ActivityServiceImpl — semantic understanding

## understanding

`ActivityServiceImpl` is the **273-line orchestration layer between `ActivityController` (read) / `ActivityAspect`+ingestion+alerting (write) and `ReactiveActivityRepository`**, with a 17-handler dispatch sub-system for context-info computation. It exposes nine public methods on the `ActivityService` interface plus three private helpers and two private dispatch helpers. **Zero `@PreAuthorize` annotations, zero programmatic authorization checks, zero `@ReactiveTransactional` annotations end-to-end** (verified line-by-line lines 33-273). The READ side (`getActivityList`, `getDataEntityActivityList`, `getActivityCounts`) is NOT owner-scoped at the service layer except for the `MY_OBJECTS` view-mode which threads `authIdentityProvider.fetchAssociatedOwner().getId()` as a filter — this is the SOLE owner-scoping mechanism in the entire service. The WRITE side (`createActivityEvent`, `createActivityEvents`) is a thin map-and-save with **NO local transactional boundary**: it resolves the current user's username via `authIdentityProvider.getCurrentUser()`, calls `activityMapper.mapToPojo(event, time, username)`, and delegates to `activityRepository.saveReturning`/`save`. **CRITICAL TX FINDING:** the `ActivityAspect.monoActivityAspect` decorator (`ActivityAspect.java:42`) carries `@ReactiveTransactional` and wraps the WHOLE `@ActivityLog`-annotated business method PLUS the `postActivity` call to `activityService.createActivityEvent` — so the activity row IS written in the SAME transaction as the business mutation it describes, but **ONLY when the emit is routed through `@ActivityLog`**. The two write surfaces that bypass `@ActivityLog` (AlertServiceImpl.applyAlertActions + ActivityIngestionRequestProcessor.process) carry their own `@ReactiveTransactional` at outer entry points (`AlertServiceImpl.java:201`, `IngestionServiceImpl.java:66`). **HEADLINE STRESS FINDING:** the auth-username resolution is a `switchIfEmpty` fallback to `null` (line 49 + line 60) — a system event (no SecurityContext: scheduler, ingestion outside HTTP, anonymous DISABLED auth) writes `activity.created_by = NULL`, which orphans on the USER_OWNER_MAPPING LEFT JOIN and surfaces in the UI as 'unattributed'/'system'. This is intentional (the docs note "system-emitted events with no operator identity attached") but the SAME mechanism applies when an authenticated mutation crosses a reactive context boundary that loses the `ReactiveSecurityContextHolder` — silently attributing the event to 'system' with no warning. The `MY_OBJECTS` view-mode and the four `getMyObjectActivitiesCount`/`get*Count` paths use `fetchAssociatedOwner` (line 194, 239, 254), which returns `Mono.empty()` for users with no `user_owner_mapping` row — `.switchIfEmpty(Flux.empty())` (line 198) then silently empty-returns. **The 'My' view is silently empty for users with no associated Owner**, a discoverable surprise to operators reading the UI without understanding the User-Owner association requirement.

## concepts

- entities: [
    "`ActivityCreateEvent` (`dto/activity/ActivityCreateEvent.java:1-14`) — Lombok @Builder + @Getter on five fields: `long dataEntityId`, `ActivityEventTypeDto eventType`, `String oldState` (JSON-string), `String newState` (JSON-string), `boolean systemEvent`. The input shape to the write path.",
    "`ActivityContextInfo` (`dto/activity/ActivityContextInfo.java:1-11`) — Lombok @Builder + @Getter on two `final` fields: `Long dataEntityId`, `String oldState`. Produced by `getActivityHandler(eventType).getContextInfo(parameters)` BEFORE the business mutation runs (so the handler can snapshot the pre-state of the data entity); consumed by `ActivityAspect.postActivity` to compute the `oldState`/`newState` diff.",
    "`ActivityPojo` — jOOQ-generated row pojo for `activity` table: `id (bigserial)`, `data_entity_id (bigint NOT NULL FK)`, `event_type (text)`, `old_state (jsonb)`, `new_state (jsonb)`, `is_system_event (boolean)`, `created_at (timestamp)`, `created_by (varchar 512 NULLABLE)`. The `activityMapper.mapToPojo(event, createdAt, createdBy)` call (`:48-49, :59-60` here; `ActivityMapper.java:79-81`) is a MapStruct-generated mapper that sets `is_system_event` from `event.systemEvent` and copies the other fields through.",
    "`ActivityEventTypeDto` (`dto/activity/ActivityEventTypeDto.java:1-31`) — 27-value enum (OWNERSHIP_CREATED/UPDATED/DELETED, TAG_ASSIGNMENT_UPDATED, DATA_ENTITY_CREATED/OVERVIEW_UPDATED/METADATA_UPDATED/SCHEMA_UPDATED/RELATION_UPDATED, TERM_ASSIGNMENT_UPDATED, DESCRIPTION_UPDATED, BUSINESS_NAME_UPDATED, DATA_ENTITY_STATUS_UPDATED, CUSTOM_METADATA_CREATED/UPDATED/DELETED, DATASET_FIELD_VALUES_UPDATED, DATASET_FIELD_DESCRIPTION_UPDATED, DATASET_FIELD_INTERNAL_NAME_UPDATED, DATASET_FIELD_TAGS_UPDATED, DATASET_FIELD_TERM_ASSIGNMENT_UPDATED, CUSTOM_GROUP_CREATED/UPDATED, ALERT_HALT_CONFIG_UPDATED, ALERT_STATUS_UPDATED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED). The discriminator for `getActivityHandler(eventType)` dispatch (`:260-264`).",
    "`UserDto` (`dto/security/UserDto.java`) — `(String username, String provider)` record returned by `AuthIdentityProvider.getCurrentUser()`. **Only `.username()` is consumed** at line 47, 58 — the provider is DROPPED before reaching the persisted row. This is the cross-mode-bleed propagator: a LOGIN_FORM-authenticated 'alice' and an LDAP-authenticated 'alice' both write `activity.created_by = 'alice'`. Confirmed by the ReactiveActivityRepositoryImpl sidecar's invariant about USER_OWNER_MAPPING.OIDC_USERNAME join filtering by username only.",
    "`OwnerPojo` — returned by `authIdentityProvider.fetchAssociatedOwner()` (line 194, 239, 254) for the MY_OBJECTS view-mode and the three count paths. The `getId()` is threaded as `currentOwnerId` to `findMyActivities`/`getMyObjectsActivitiesCount`.",
    "`Activity` (OpenAPI) — single-activity-row response shape; produced by `activityMapper.mapToActivity(activityDto)` (`:135, :181, :197, :215`).",
    "`ActivityCountInfo` (OpenAPI) — `{totalCount, myObjectsCount, downstreamCount, upstreamCount}`. Produced by `getActivityCounts` via a 4-way `Mono.zip` (line 158-165).",
    "`ActivityType` (OpenAPI) — enum `MY_OBJECTS | DOWNSTREAM | UPSTREAM | ALL`; the view-mode dispatch input to `getActivityList` (line 107-116 switch).",
    "`LineageStreamKind` (`dto/lineage/LineageStreamKind`) — enum `UPSTREAM | DOWNSTREAM`; threaded into `dataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)` (line 212, 254) to compute the `oddrns` lineage scope for DOWNSTREAM/UPSTREAM view modes.",
    "`ActivityHandler` (`service/activity/handler/ActivityHandler.java:9-22`) — 4-method interface (`isHandle(eventType)`, `getContextInfo(parameters)`, `getUpdatedState(parameters, dataEntityId)`, `getUpdatedState(parameters, dataEntityIds)` default-throwing). 17 implementations across `service/activity/handler/` (DescriptionUpdatedActivityHandler, OwnershipCreated/Updated/DeletedActivityHandler, TermAssignment, DatasetFieldTermAssignment, DatasetFieldInformationUpdated, DatasetFieldValuesUpdated, BusinessName, DataEntityCreated, DataEntityStatusUpdated, CustomGroupCreated/Updated, AlertHaltConfigUpdated, AlertStatusUpdated) — verified via Glob enumeration."
  ]
- operations: [
    "`createActivityEvent(ActivityCreateEvent event) -> Mono<Void>` (`:43-52`) — single-row write path. `DateTimeUtil.generateNow()` snapshots UTC time at line 45; `authIdentityProvider.getCurrentUser()` resolves username; `activityMapper.mapToPojo(event, time, username)` builds the pojo; `activityRepository.saveReturning(pojo)` persists and the `.then()` swallows the returned ActivityPojo. **CRITICAL:** the `.switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))` (line 49) fires when SecurityContext is empty — null-username write, persisted as `created_by = NULL`, surfaces as 'system event' actor in UI reads.",
    "`createActivityEvents(List<ActivityCreateEvent> events) -> Mono<Void>` (`:54-63`) — batch-row write path. Same auth-resolution + switchIfEmpty pattern; `Flux.fromStream(mapEventsToPojos(events, time, username))` produces a Flux of pojos; `activityRepository.save(list)` is the batched insert (partitioned in 1000-row chunks per the repository sidecar). **EDGE CASE — discoverable behaviour:** when `events.isEmpty()`, `Flux.fromStream(mapEventsToPojos(empty, time, username))` is also empty, which triggers `switchIfEmpty` (line 60) to fire the null-username fallback (also producing empty Flux). The result is `.collectList()` yields `List.of()` then `activityRepository.save(emptyList)` — verified harmless but the switchIfEmpty fires for TWO conditions (auth-empty AND events-empty), conflating those signals. See stress finding S-B-1.",
    "`getContextInfo(parameters, eventType) -> Mono<ActivityContextInfo>` (`:65-69`) — dispatch helper; finds the matching handler via `getActivityHandler(eventType)` and calls `handler.getContextInfo(parameters)`. The handler reads the current data-entity state (the `oldState`) before the business mutation runs. Called from `ActivityAspect.monoActivityAspect` line 48 + `fluxActivityAspect` line 68 + `ActivityIngestionRequestProcessor.process` line 26.",
    "`getUpdatedInfo(parameters, dataEntityIds, eventType) -> Mono<Map<Long, String>>` (`:71-76`) — multi-data-entity variant; calls `handler.getUpdatedState(parameters, dataEntityIds)` — which throws `UnsupportedOperationException` by default (ActivityHandler.java:18-21) for handlers that don't override. Only handlers that handle bulk-update event types (e.g. DATA_ENTITY_CREATED — verified ActivityIngestionRequestProcessor.process line 27 calls this with `request.getNewIds()`) implement this method.",
    "`getUpdatedInfo(parameters, dataEntityId, eventType) -> Mono<String>` (`:78-83`) — single-data-entity variant; calls `handler.getUpdatedState(parameters, dataEntityId)`. Called from `ActivityAspect.postActivity` line 85.",
    "`getActivityList(beginDate, endDate, size, ds, ns, tagIds, ownerIds, userIds, type, eventType, lastEventId, lastEventDateTime) -> Flux<Activity>` (`:85-117`) — primary READ path; the 12-parameter signature mirrors the controller's HTTP query. **VALIDATION:** if `beginDate == null || endDate == null`, errors with `BadUserRequestException` (line 98-100). **TYPE DISPATCH:** `null` => `fetchAllActivities`; `MY_OBJECTS` => `fetchMyActivities`; `DOWNSTREAM`/`UPSTREAM` => `fetchDependentActivities`; `ALL` => `fetchAllActivities` (line 107-116). **Type-to-method bridge:** `ActivityType.ALL` and `null` both route to `fetchAllActivities` — discoverable equivalence with no operator-visible difference. `ownerIds` is consumed only by `fetchAllActivities` (`:179`); it is DROPPED for MY_OBJECTS/UPSTREAM/DOWNSTREAM (`:108, :110, :112`) — a user passing `ownerIds=[5]` + `type=MY_OBJECTS` gets ONLY their own owner's data-entity activity, not owner-5's. See stress finding S-B-2.",
    "`getDataEntityActivityList(beginDate, endDate, size, dataEntityId, userIds, eventType, lastEventId, lastEventDateTime) -> Flux<Activity>` (`:119-136`) — per-data-entity READ path. Same `beginDate==null||endDate==null` validation; no view-mode dispatch (always returns activities for the one named data entity). **NO permission check** on the dataEntityId — any authenticated caller can read activity for any data entity (cross-owner visibility).",
    "`getActivityCounts(beginDate, endDate, ds, ns, tagIds, ownerIds, userIds, eventType) -> Mono<ActivityCountInfo>` (`:138-166`) — 4-way `Mono.zip` of total/myObject/downstream/upstream counts. **NO beginDate/endDate validation here**: unlike `getActivityList`, if `beginDate==null` the SQL receives a null parameter and the repository's `getCommonConditions` would still run (the existing repo sidecar confirms `.add(ACTIVITY.CREATED_AT.greaterOrEqual(...))` only fires when not-null). See stress finding S-B-3.",
    "`fetchAllActivities` / `fetchMyActivities` / `fetchDependentActivities` (`:168-217`, private) — view-mode dispatch helpers; each delegates to `activityRepository.find*Activities(...)` + `.map(activityMapper::mapToActivity)`. `fetchMyActivities` (`:184-199`) and `fetchDependentActivities` (`:201-217`) carry `.switchIfEmpty(Flux.empty())` — silently empty-return when the owner/lineage prerequisite is missing.",
    "`getTotalCount` / `getMyObjectActivitiesCount` / `getDependentActivitiesCount` (`:219-258`, private) — count helpers. Each carries `.defaultIfEmpty(0L)` — silently returns 0 when the repository emits empty (which `getMyObjectActivitiesCount` does for users without an associated Owner, line 239-243).",
    "`getActivityHandler(eventType) -> ActivityHandler` (`:260-264`, private) — linear-scan dispatch: `handlers.stream().filter(handler -> handler.isHandle(eventType)).findFirst().orElseThrow(() -> new RuntimeException(\"Can't find handler for event type \" + eventType.name()))`. Called for every `getContextInfo` and `getUpdatedInfo` invocation — **O(N) over 17 handlers per call**, but N=17 and the call rate is bound to user-mutation rate. The `RuntimeException` throw is a defensive guard against an unhandled enum value; it would manifest as a 500 if a new ActivityEventTypeDto enum value is added without a corresponding handler.",
    "`mapEventsToPojos(events, time, username) -> Stream<ActivityPojo>` (`:266-272`, private) — Stream-based mapper called twice in `createActivityEvents` (line 59 with username, line 60 with null). **NOTE:** the same Stream cannot be re-consumed; each call produces a NEW stream via `.stream()`, so the switchIfEmpty fallback is safe."
  ]
- invariants: [
    "**Zero `@PreAuthorize`, zero programmatic authorization, zero `@ReactiveTransactional` at the service layer** (lines 33-273, verified line-by-line). Authorization is inherited from the call-site: ActivityController (catch-all `.authenticated()` for the read path), `@ActivityLog`-annotated business methods (whose own auth + `@ReactiveTransactional` cover the write path via ActivityAspect), AlertServiceImpl.applyAlertActions (covers `@ReactiveTransactional` + service-level `@PreAuthorize(MANAGE_ALERTS)`), ActivityIngestionRequestProcessor (S2S ingestion filter + IngestionServiceImpl.ingest's `@ReactiveTransactional`).",
    "**`activity.created_by = NULL` is the system-event signal** (line 49, 60). `switchIfEmpty` fires when `authIdentityProvider.getCurrentUser()` is `Mono.empty()` — which AuthIdentityProviderImpl produces when there is no SecurityContext, no Authentication, OR when `ReactiveSecurityContextHolder.getContext()` is empty in the Reactor context. Three code paths produce this: (a) ActivityIngestionRequestProcessor (no SecurityContext on S2S ingestion path); (b) AlertServiceImpl scheduled-job and reactive flows that lose the SecurityContext across thread boundaries; (c) DISABLED auth mode (per AuthIdentityProviderImpl.getCurrentUser there is no Authentication object). The mapper persists `null` to `activity.created_by`.",
    "**The user-provider tag is DROPPED before persistence** (`UserDto::username` mapping at line 47, 58 picks only `.username()` and discards `.provider()`). This is the cross-mode-bleed mechanism — a LOGIN_FORM-authenticated 'alice' and an LDAP-authenticated 'alice' write the same `created_by` value. The repository's USER_OWNER_MAPPING LEFT JOIN (per the existing repository sidecar invariant lines 157-158, 178-179, 199-200, 221-222) then joins by `OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` — username-only, no provider filter — propagating the bleed at read time.",
    "**The `MY_OBJECTS` view-mode silently empty-returns for users without an associated Owner** (line 194-198: `authIdentityProvider.fetchAssociatedOwner().flatMapMany(...).switchIfEmpty(Flux.empty())`). `fetchAssociatedOwner()` per AuthIdentityProviderImpl.java:50-53 is `getCurrentUser().flatMap(user -> userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider()))`. If either the user is unauthenticated OR the user has no `user_owner_mapping` row, the MY_OBJECTS feed returns no rows — and `getActivityCounts` returns `myObjectsCount = 0` (line 243's `.defaultIfEmpty(0L)`). The operator cannot tell from the response whether they have no activity OR they have no Owner association.",
    "**Activity emit ordering across multi-statement writes is the responsibility of the caller's TX, not this service.** ActivityServiceImpl.createActivityEvent does NOT carry `@ReactiveTransactional`; it returns `Mono<Void>` that the caller composes. When the caller is `ActivityAspect.monoActivityAspect` (line 42), the aspect's `@ReactiveTransactional` wraps the WHOLE business method + the postActivity emit — so the activity row is in the SAME TX as the mutation. When the caller is AlertServiceImpl.applyAlertActions (line 201 `@ReactiveTransactional` + flatMap to `registerAlertCreatedEvents` then `registerAutomaticallyResolvedAlertsActivityEvents`), same — one outer TX wraps the data mutation + the activity emit. When the caller is ActivityIngestionRequestProcessor (no `@ReactiveTransactional` on the processor itself but `IngestionServiceImpl.ingest` line 66 wraps the WHOLE ingestion pipeline including processor invocations) — same.",
    "**There is NO replay-safety / idempotency mechanism on the write path.** `activityRepository.saveReturning(pojo)` performs an unconditional INSERT (`DSL.insertInto(ACTIVITY).set(record).returning()` per the repository sidecar line 52-53); there is no `ON CONFLICT` clause, no idempotency key, no dedup. If a caller retries the SAME mutation (e.g. user double-clicks the description-update button, or a retry-policy fires), TWO activity rows are created with sequential `id` values and indistinguishable payloads. The aspect's `.filter(newState -> !info.getOldState().equals(newState))` at ActivityAspect.java:86 catches the no-op case (the second click finds the state already updated → no emit), but a TRUE concurrent double-mutation (two different oldStates resolving to the same newState in opposite orders) emits one row per resolution path. Two activity rows with the same payload + sequential ids is the operator-visible drift.",
    "**Time generation is non-atomic with the row write.** `DateTimeUtil.generateNow()` is called ONCE in `createActivityEvent` line 45 and `createActivityEvents` line 56 — at the moment the Mono builder runs, not at the moment the INSERT hits the database. For a Mono that takes 200ms to resolve (auth lookup + mapper + DB roundtrip), the persisted `created_at` is the BEFORE-CALL time, NOT the COMMIT time. Two near-simultaneous mutations emitted in opposite order can have their `created_at` columns inverted vs commit order — and since the repository's cursor pagination orders by `created_at DESC, id DESC` (per repo sidecar line 291), a user paging by cursor can see events in commit-inverted order.",
    "**`getActivityList` validation is asymmetric to `getActivityCounts`.** `getActivityList` validates `beginDate==null||endDate==null -> BadUserRequestException` (line 98-100, 128-130); `getActivityCounts` does NOT (lines 138-166 contain no null-check). The repository's `getCommonConditions` per existing sidecar would build a `WHERE ...` with no `created_at` predicate at all if both dates are null — yielding a count over the ENTIRE activity table (full audit history, all retained partitions). Discoverable performance cliff: a UI bug or operator querying `/api/activity/counts` without dates issues an unbounded count query."
  ]
- audiences: [
    "`ActivityController` — invokes `getActivityList` (controller line 30), `getDataEntityActivityList` (controller-method sidecar references but not in this class's scope), `getActivityCounts` (controller line ~50). The HTTP read perimeter.",
    "`ActivityAspect` (`service/activity/ActivityAspect.java:48, 68, 85, 94`) — invokes `getContextInfo` (BEFORE business method), `getUpdatedInfo` (AFTER), and `createActivityEvent` (AFTER, conditional on state-change). The PRIMARY write funnel for the 18 `@ActivityLog`-annotated methods across 10 service files (TermServiceImpl, OwnershipServiceImpl, DatasetFieldServiceImpl, EnumValueServiceImpl, DataEntityServiceImpl, DatasetFieldInternalInformationServiceImpl, AlertHaltConfigServiceImpl, AlertServiceImpl, DataEntityGroupServiceImpl, DataEntityInternalStateServiceImpl). Each `@ActivityLog`-annotated method has an `ActivityEventTypeDto event()` value that maps to ONE of the 17 handler implementations.",
    "`ActivityIngestionRequestProcessor.process` (`service/ingestion/processor/ActivityIngestionRequestProcessor.java:26-32`) — the S2S ingestion path's DATA_ENTITY_CREATED emit. Calls `getContextInfo(emptyMap(), DATA_ENTITY_CREATED)` + `getUpdatedInfo(emptyMap(), request.getNewIds(), DATA_ENTITY_CREATED)` + `createActivityEvents(list)`. The processor runs in the FINALIZING phase of IngestionServiceImpl.ingest's `@ReactiveTransactional` (IngestionServiceImpl.java:66).",
    "`AlertServiceImpl.registerNewAlertsActivityEvents` (`service/AlertServiceImpl.java:309-325`) + `.registerAutomaticallyResolvedAlertsActivityEvents` (line 247-258) — emits OPEN_ALERT_RECEIVED/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED via `createActivityEvents`. Called from `applyAlertActions` (line 201 `@ReactiveTransactional`); the `systemEvent=true` flag (line 252, 318) ensures these events surface as system events in the UI (per the live docs page: 'Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed').",
    "`odd-platform-ui-end-user` (indirectly via ActivityController) — operators reading the global Activity Feed page and per-entity Activity tab. The page surfaces every recorded change on every data entity across all owners (no service-level filtering); the UI's audience-of-trust is whoever can log in (LOGIN_FORM/OAUTH2/LDAP) — see security block below.",
    "platform-operator (indirectly via reading the SQL or the docs) — the actor configuring `odd.activity.partition-period` (default 30 days; documented in https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform — verified WebFetch 2026-05-20). This service WRITES the rows whose retention is configured at the partition level externally."
  ]

## stress_findings

Triggered by Stress Protocol (LSN-019 Rule 9) — each finding records the question, the trigger location, and the resolution (TRACE / PROBE-NEEDED / REFERENCE).

### Category B — Name-behavior pairs

- **S-B-1 — `createActivityEvents` switchIfEmpty conflates two signals**
  - Trigger: `:54-63` `createActivityEvents` `.flatMapMany(username -> ...).switchIfEmpty(Flux.fromStream(mapEventsToPojos(events, activityCreateTime, null)))`
  - Question: When does `switchIfEmpty` (line 60) fire? Only when auth-context is empty, or also when `events` is empty?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — `Flux.fromStream(empty)` is an empty Flux; `Flux.empty()` triggers `switchIfEmpty`. So switchIfEmpty fires for TWO independent conditions: (1) `authIdentityProvider.getCurrentUser()` is `Mono.empty()` (no SecurityContext → null-username row, intentional); (2) `events.isEmpty()` (caller passes an empty list → re-runs `mapEventsToPojos(empty, time, null)` which is also empty → harmless no-op). The conditions cannot be distinguished from inside this method. **Operator-visible drift:** none (case 2 is correctly handled as a no-op); but a future refactor that added side-effects to the switchIfEmpty branch (e.g. logging "system event detected") would mis-fire on case 2. Confidence: STATIC-INFERRED HIGH.

- **S-B-2 — `getActivityList` drops `ownerIds` for non-ALL view modes**
  - Trigger: `:107-116` switch on `ActivityType`: ALL passes `ownerIds` to `fetchAllActivities`; MY_OBJECTS / UPSTREAM / DOWNSTREAM do NOT thread `ownerIds` through.
  - Question: The HTTP API exposes `ownerIds` as a query parameter on `/api/activity` regardless of `type`. Does the parameter take effect for `type=MY_OBJECTS`? For `type=UPSTREAM`?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — line 108 (`fetchMyActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds, userIds, eventTypeDto, lastEventId, lastEventDateTime)`) accepts NO `ownerIds`; line 110/112 (`fetchDependentActivities(... List<Long> userIds, ActivityEventTypeDto eventType, Long lastEventId, OffsetDateTime lastEventDateTime, LineageStreamKind lineageStreamKind)`) also accepts NO `ownerIds`. The HTTP-API-visible `ownerIds` query parameter is **silently ignored** for MY_OBJECTS / UPSTREAM / DOWNSTREAM modes. The OpenAPI spec does not document this asymmetry (per ActivityController sidecar's `conflicts_surfaced` block, the `type` parameter is itself undocumented). **Operator-visible drift:** an operator filtering "show me Alice's activity on UPSTREAM entities" by setting `type=UPSTREAM&owner_ids=[alice]` gets the WHOLE UPSTREAM lineage's activity, unfiltered by owner. Severity: MEDIUM (the filter silently disappears). Confidence: STATIC-INFERRED HIGH.

- **S-B-3 — `getActivityCounts` accepts null dates; `getActivityList` rejects them**
  - Trigger: `:138-166` `getActivityCounts` has no null-check on `beginDate`/`endDate`; `:98-100, :128-130` `getActivityList`/`getDataEntityActivityList` reject null with `BadUserRequestException`.
  - Question: What does `/api/activity/counts` return when called without `begin_date` or `end_date`? Is the query bounded?
  - Resolution: **PROBE-NEEDED (P-023)** — based on STATIC-INFERRED reading of the repository sidecar's `getCommonConditions`, the count query would build no `created_at` predicate and aggregate over the ENTIRE retained activity history (all partitions per F-010 housekeeping). This could be an unbounded count over millions of rows. The maintainer test should call `/api/activity/counts` without dates against a populated demo platform and measure (a) HTTP status, (b) response body, (c) latency. **Operator-visible drift hypothesis:** a UI bug or operator using `curl /api/activity/counts` without dates triggers an unbounded scan — a performance cliff at scale. See P-023 below. Confidence: PROBE-NEEDED MEDIUM.

- **S-B-4 — `createActivityEvent` name vs `createActivityEvents` name promise**
  - Trigger: `:43-52` `createActivityEvent` (singular) and `:54-63` `createActivityEvents` (plural). Both names suggest creating activity ROWS in the database, which they do.
  - Question: Does either method retry on failure? Does either method respect idempotency keys?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — neither method has retry, idempotency, or replay-safety. `saveReturning` is an unconditional INSERT (per repository sidecar line 52-53); `save` is an unconditional batched INSERT. A caller-side retry produces TWO rows. **Operator-visible drift:** any caller that retries (Spring Retry, RestTemplate retry, user double-click) creates duplicate audit entries. Severity: MEDIUM. Confidence: STATIC-INFERRED HIGH.

### Category C — Orderings / pagination / aggregation

- **S-C-1 — `getActivityCounts` Mono.zip ordering**
  - Trigger: `:158-165` `Mono.zip(totalCount, myObjectActivitiesCount, downstreamActivitiesCount, upstreamActivitiesCount)`.
  - Question: Are the four count queries issued concurrently or sequentially? If concurrently, can they observe inconsistent reads (a row written between the totalCount and myObjectActivitiesCount queries appears in some but not others)?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — Reactor's `Mono.zip` subscribes to all four sources concurrently (default behaviour). Since `ActivityServiceImpl` carries no `@ReactiveTransactional` and the call from `ActivityController.getActivityCounts` carries none either (per existing controller sidecar — no `@ReactiveTransactional` on the controller class or method, default READ COMMITTED isolation from R2DBC connection pool), the four queries execute against four separate JDBC connections at READ COMMITTED isolation. A row INSERTed between the four queries CAN appear in some counts but not others — the four sub-counts are NOT guaranteed to sum to or align with `totalCount`. **Operator-visible drift:** UI displays `totalCount=100, myObjects+downstream+upstream≠100`. Severity: LOW (visual inconsistency only; never affects correctness of any single count). Confidence: STATIC-INFERRED HIGH.

- **S-C-2 — Time generation vs commit time**
  - Trigger: `:45, :56` `DateTimeUtil.generateNow()` called once at Mono build time.
  - Question: Is `activity.created_at` the time of the INSERT statement, the time of TX commit, or the time the Mono was constructed?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — `DateTimeUtil.generateNow()` returns `OffsetDateTime.now().atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime()` (DateTimeUtil.java:11-13) AT THE MOMENT the assembling thread runs that line — which is at Mono assembly, NOT at the INSERT execution time. For an `@ActivityLog` mutation that takes 200ms (auth lookup + business mutation + activity emit + commit), the persisted `created_at` is the t=0 assembly time; the actual commit happens at t=200ms. Two near-simultaneous mutations issued in opposite order can have inverted `created_at` columns vs commit-order. **Operator-visible drift:** a user paging the Activity Feed by `(lastEventId, lastEventDateTime)` cursor (created_at DESC per repo sidecar line 291) can see events in commit-inverted order. Severity: LOW (intra-second only; the repository uses a tuple comparison `(trunc(created_at, SECOND), id)` per repo sidecar line 287-288). Confidence: STATIC-INFERRED HIGH.

### Category D — Authorization gates

- **S-D-1 — Zero authorization at the service layer**
  - Trigger: lines 33-273 contain NO `@PreAuthorize`, NO programmatic `permissionService.*`, NO `permissions.contains(...)` checks.
  - Question: For each of the 4 auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP), what visibility / write capability does an authenticated caller (any role, any owner) have?
  - Resolution: **REFERENCE** to ActivityController class sidecar's `security` block (coherence_notes:F-006) — read perimeter is catch-all `.authenticated()`, no per-permission gate, no owner-scoping at SQL except MY_OBJECTS. Write perimeter is gated by the `@ActivityLog`-annotated method's own auth (e.g. `@PreAuthorize(DATA_ENTITY_DESCRIPTION_UPDATE)` on the business method covers the description-update activity emit). For DISABLED mode, the perimeter `.authenticated()` is bypassed and EVERY caller can read every activity row — this is per the AuthIdentityProviderImpl behaviour where DISABLED has no Authentication object so `getCurrentUser` returns empty and the `createdBy` is null. Confidence: REFERENCE HIGH (the class sidecar already documents this).

- **S-D-2 — `MY_OBJECTS` silently empty for users without associated Owner**
  - Trigger: `:194-198` `fetchMyActivities` calls `authIdentityProvider.fetchAssociatedOwner().flatMapMany(...).switchIfEmpty(Flux.empty())`.
  - Question: What does the UI show to a LOGIN_FORM-authenticated user 'alice' who has NO `user_owner_mapping` row?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — `fetchAssociatedOwner` returns `Mono.empty()` (per AuthIdentityProviderImpl:50-53 — `getCurrentUser().flatMap(user -> userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider()))` where the inner repository call returns empty for missing mapping). `.switchIfEmpty(Flux.empty())` at line 198 silently empty-returns; `getMyObjectActivitiesCount` line 239-243 returns `0L`. The user sees a MY_OBJECTS feed with no rows + `myObjectsCount=0`. **No error, no UI hint that the user has no Owner association.** Severity: MEDIUM (discoverability — operators reading the docs about "My objects" cannot tell from the UI whether they have no activity OR no Owner mapping). Confidence: STATIC-INFERRED HIGH.

- **S-D-3 — `getDataEntityActivityList` has no per-data-entity authorization**
  - Trigger: `:119-136` `getDataEntityActivityList(dataEntityId)` — accepts a `dataEntityId` parameter and unconditionally fetches activity for that ID.
  - Question: Can an authenticated user query activity for a data entity they have no permission to view?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — this service has no permission check; the controller has no `@PreAuthorize` (per the existing controller class sidecar `coherence_notes.F-006`); the generated `ActivityApi` interface carries no annotations; the repository's `findDataEntityActivities` (line 129-142 of repo) issues `DATA_ENTITY.ID.eq(dataEntityId)` unconditionally. **Every authenticated user can read activity for every data entity in the system, including data entities they have no other permission to see, and read the JSON old/newState payloads which may include description content, tag changes, ownership changes, term assignments.** Severity: MEDIUM (forensic-visibility leak; the data-entity-level access control is bypassed for the activity surface). Confidence: STATIC-INFERRED HIGH.

### Category E — Resource boundaries

- **S-E-1 — Transactional boundary depends entirely on caller**
  - Trigger: lines 33-273 contain NO `@ReactiveTransactional` annotation; lines 44-63 (write paths) have NO local TX boundary.
  - Question: Is the activity row written in the SAME transaction as the data-entity mutation it describes? If the mutation rolls back, does the activity row roll back? If the activity emit fails, does the mutation roll back?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — the answer depends on the caller path:
    - **`@ActivityLog`-annotated method path** (most common — ActivityAspect.java:42 `@ReactiveTransactional` on `monoActivityAspect`): the aspect wraps the WHOLE business method PLUS the postActivity emit in ONE TX. Roll back the business mutation → roll back the activity row. Activity emit fails → roll back the mutation. **CONSISTENT but potentially surprising:** a transient repository error on the activity write rolls back a successful business mutation, surfaces a 500 to the user with no indication the mutation was actually successful-but-rolled-back.
    - **AlertServiceImpl.applyAlertActions path** (`AlertServiceImpl.java:201` `@ReactiveTransactional`): the outer method wraps the alert mutation + the `registerAlertCreatedEvents` and `registerAutomaticallyResolvedAlertsActivityEvents` calls in ONE TX. Same semantics as @ActivityLog.
    - **ActivityIngestionRequestProcessor.process path** (no `@ReactiveTransactional` on the processor; `IngestionServiceImpl.ingest:66` `@ReactiveTransactional` wraps the WHOLE pipeline): same — one outer TX covers the ingestion mutation + the activity emit.
  - **Confidence: STATIC-INFERRED HIGH** for the three paths above. **Operator-visible drift:** for the @ActivityLog and AlertService paths, an activity-write failure rolls back the business mutation (surprising to operators expecting the mutation to be the primary side-effect and audit to be best-effort). For the ingestion path, an activity-write failure rolls back the WHOLE ingestion batch (including any other entities being ingested in the same request) — large blast radius.

- **S-E-2 — No idempotency / replay-safety**
  - Trigger: `:50, :62` `activityRepository.saveReturning(...)` / `activityRepository.save(...)`. Per the repository sidecar lines 50-71, these are unconditional INSERT statements with no `ON CONFLICT` clause.
  - Question: If the same `ActivityCreateEvent` is submitted twice (caller retry, user double-click, scheduler re-fire), how many rows are written?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — TWO rows, with sequential `id` values and indistinguishable payloads. The aspect path provides PARTIAL protection: `ActivityAspect.postActivity` line 86 filters `!info.getOldState().equals(newState)` — if a retry submits the same mutation after the first succeeded, the oldState now equals the newState (because the state already changed) and the emit is skipped. But for TRUE concurrent retries (two requests arriving before either has committed) BOTH succeed at the activity-write level (no `ON CONFLICT`, no advisory lock). Severity: MEDIUM (the activity table can carry duplicate-looking rows; the UI displays them as separate events). Confidence: STATIC-INFERRED HIGH.

- **S-E-3 — `Mono.zip` in `getActivityCounts` — cross-query consistency**
  - See S-C-1 above (cross-referenced; same finding from a different angle).

- **S-E-4 — `getActivityHandler` linear-scan with RuntimeException on miss**
  - Trigger: `:260-264` `handlers.stream().filter(...).findFirst().orElseThrow(() -> new RuntimeException("Can't find handler for event type " + eventType.name()))`.
  - Question: What happens when a new `ActivityEventTypeDto` enum value is added without a corresponding handler? When does the system fail?
  - Resolution: **TRACE-answer (STATIC-INFERRED)** — the failure manifests at the FIRST call to `getContextInfo` or `getUpdatedInfo` for the new event type. The RuntimeException would propagate up through ActivityAspect.postActivity (which would short-circuit the business method's reactive chain), Mono.error → caller sees 500 Internal Server Error. The `RuntimeException` (not `IllegalArgumentException` or `NoSuchElementException`) is a discoverable smell — but the broader concern is that there is no CI-time check (e.g. integration test) that asserts every `ActivityEventTypeDto` value has a handler. Severity: LOW (the symptom is loud; a new enum value would surface at first invocation, not silently misbehave). Confidence: STATIC-INFERRED HIGH.

### Category A — Tunables

- **S-A-1 — No literal numeric constants in this service**
  - Trigger: scanned lines 33-273; the `Integer size` parameter passes through unchanged; no `Math.min(size, MAX_PAGE_SIZE)` clamp; no `@Value` injection.
  - Question: What is the upper bound on `size` for `getActivityList`?
  - Resolution: **REFERENCE** to ActivityController class sidecar — the size parameter is bounded only by the controller's HTTP layer (which per the sidecar has no upper bound either, line 26). The service layer adds no clamping. A pathological caller can request `size=1000000` and the repository will issue `LIMIT 1000000`. Confidence: REFERENCE HIGH.

## upstream_callers

- `ActivityController` (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ActivityController.java`) — invokes `getActivityList` + `getActivityCounts`. The HTTP read perimeter.
- `ActivityAspect.postActivity` (`ActivityAspect.java:48, 68, 85, 94`) — invokes `getContextInfo` (pre-mutation), `getUpdatedInfo` single-id (post-mutation), `createActivityEvent`. The PRIMARY write funnel for 10 service files / 18+ `@ActivityLog`-annotated methods.
- `ActivityIngestionRequestProcessor.process` (`service/ingestion/processor/ActivityIngestionRequestProcessor.java:26-31`) — invokes `getContextInfo` + `getUpdatedInfo` multi-id + `createActivityEvents`. The S2S ingestion DATA_ENTITY_CREATED emit.
- `AlertServiceImpl.registerNewAlertsActivityEvents` (`AlertServiceImpl.java:309-325`) + `.registerAutomaticallyResolvedAlertsActivityEvents` (`:247-258`) — invokes `createActivityEvents` for OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED (systemEvent=true).
- `DataEntityController.getDataEntityActivityList` (per existing repo sidecar; controller-method sidecar exists) — invokes `getDataEntityActivityList`. Per-data-entity Activity tab read.

## downstream_side_effects

- **`ReactiveActivityRepository.saveReturning(ActivityPojo)`** — INSERT to `public.activity` table. Returns the persisted pojo (id assigned by sequence). Single-row write path for `createActivityEvent`.
- **`ReactiveActivityRepository.save(List<ActivityPojo>)`** — Batched INSERT to `public.activity` table, partitioned in 1000-row chunks per repository sidecar line 62 (`executeInPartition`). No return value; multi-row write path for `createActivityEvents`.
- **`ReactiveActivityRepository.findAllActivities` / `findMyActivities` / `findDependentActivities` / `findDataEntityActivities`** — SELECT from `public.activity` with various filter + LEFT JOIN chains. Read paths.
- **`ReactiveActivityRepository.getTotalActivitiesCount` / `getMyObjectsActivitiesCount` / `getDependentActivitiesCount`** — SELECT COUNT(*) variants for the count surface.
- **`AuthIdentityProvider.getCurrentUser()`** — Reactive SecurityContext lookup; READ-ONLY. Returns `Mono.empty()` when no SecurityContext.
- **`AuthIdentityProvider.fetchAssociatedOwner()`** — Reactive SecurityContext lookup + `userOwnerMappingRepository.getAssociatedOwner(username, provider)` DB query. READ-ONLY.
- **`DataEntityRelationsService.getDependentDataEntityOddrns(LineageStreamKind)`** — Lineage graph traversal for DOWNSTREAM/UPSTREAM view modes. READ-ONLY but potentially expensive (depth-bounded by lineage configuration).
- **17 `ActivityHandler` implementations' `getContextInfo` + `getUpdatedState` calls** — each handler does its own DB read of the data-entity state (per DescriptionUpdatedActivityHandler.java:27 example `dataEntityRepository.get(dataEntityId)`). READ-ONLY DB queries within the outer TX.
- **NO external I/O** — no HTTP, no SMTP, no Slack, no S3, no OTLP, no async queue. All side-effects are DB queries.
- **Transaction boundaries** — NONE at this layer; inherited from caller (`@ReactiveTransactional` on `ActivityAspect.monoActivityAspect` / `AlertServiceImpl.applyAlertActions` / `IngestionServiceImpl.ingest`).
- **Lock acquisition** — NONE. No advisory locks, no `SELECT ... FOR UPDATE`.

## dependencies_semantic

- requires-feature:
  - "`ReactiveActivityRepository` interface (`repository/reactive/ReactiveActivityRepository.java:11-87`) — 8-method interface; this service consumes ALL 8 methods. The sole repository binding."
  - "`AuthIdentityProvider` (`auth/AuthIdentityProvider.java:8-14`) — 3-method interface; this service consumes `getCurrentUser()` (line 46, 57) and `fetchAssociatedOwner()` (line 194, 239, 254). Does NOT consume `getCurrentUserProviderRole()`."
  - "`DataEntityRelationsService` (`service/DataEntityRelationsService.java`) — consumed for `.getDependentDataEntityOddrns(LineageStreamKind)` (line 212, 254). The lineage-graph adapter for DOWNSTREAM/UPSTREAM scoping."
  - "`ActivityMapper` (`mapper/ActivityMapper.java`) — MapStruct mapper; this service uses `.mapToPojo(event, time, username)` (line 48, 49, 60, 271) and `.mapToActivity(activityDto)` (line 135, 181, 197, 215). Note: `mapToPojo` is the write-direction; `mapToActivity` is the read-direction (called via `activityRepository::mapToActivity` lambda)."
  - "`List<ActivityHandler> handlers`** (Spring auto-discovery, line 41) — the 17 `@Component`-annotated handler implementations under `service/activity/handler/`. Each `ActivityEventTypeDto` value should have exactly one handler whose `isHandle(eventType)` returns true. `getActivityHandler` (line 260-264) does linear scan; the first match wins. NO CI-time assertion that every enum value has a handler."
- requires-config:
  - "[] — N/A. This service reads no Spring properties. Indirect dependency: `odd.activity.partition-period` (default 30, application.yml:213; documented at https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform per WebFetch 2026-05-20) controls the rolling partition window for the `activity` table this service WRITES to. If partition coverage fails, INSERTs from `saveReturning`/`save` fail at Postgres layer with 'no partition of relation ACTIVITY found for row'."
- requires-runtime:
  - "Spring `@Service`-managed bean (`:33`) — constructor-injected via Lombok `@RequiredArgsConstructor` (`:34`) with five `final` fields (`:37-41`)."
  - "Reactor — `Mono`, `Flux`, `Tuples`, `TupleUtils.function` (`:31`); the destructuring-lambda pattern at line 159."
  - "Spring Security ReactiveSecurityContext (via AuthIdentityProvider) — required for `getCurrentUser` / `fetchAssociatedOwner`. NOT required for the system-event fallback path (line 49, 60)."
  - "AspectJ runtime — for ActivityAspect's `@Around` advice that wraps `@ActivityLog`-annotated methods. WITHOUT AspectJ, the write path collapses to only the AlertService + Ingestion direct calls (`@ActivityLog` becomes a no-op annotation)."
- couples-to:
  - "`ActivityService` interface (`ActivityService.java:16-62`) — 9-method contract. The interface is implemented by THIS class only (no test-double, no decorator)."
  - "17 `ActivityHandler` implementations — adding a new `ActivityEventTypeDto` enum value WITHOUT a corresponding handler triggers `RuntimeException` at first invocation (line 263). No CI-time check enforces completeness."
  - "`ActivityAspect` (`service/activity/ActivityAspect.java`) — the aspect's `@ReactiveTransactional` IS the TX boundary for the @ActivityLog write path; removing the aspect's annotation would silently lose the activity-row TX semantics for ALL 18+ `@ActivityLog`-annotated methods."
  - "`ReactiveSecurityContextHolder` (via AuthIdentityProviderImpl) — the auth-context lookup mechanism for `getCurrentUser`. A future refactor to a different security framework would break the `created_by` resolution and emit ALL activity rows with `created_by=NULL`."
  - "ActivityMapper's `mapToPojo` MapStruct binding — a column rename in V0_NN migrations would require mapper regeneration; a silent failure of the mapper to set `is_system_event` from `event.systemEvent` (line 79-81 of mapper) would mis-categorize system events as user events in the UI."

## tests_coverage_semantic

- covered_behaviours: [] — **No test file exists for `ActivityServiceImpl` in `odd-platform-api/src/test/`**. Glob for `**/ActivityService*Test*.java` returns zero matches. The only Activity-related test is `ActivityMapperTest.java` (`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/ActivityMapperTest.java`) which covers the mapper layer only. **Service-layer test coverage is ZERO** — no unit test for the dispatch logic, the auth-resolution fallback, the view-mode dispatch in `getActivityList`, the validation in `getActivityList`/`getDataEntityActivityList`, the `Mono.zip` count aggregation, or any of the Stress Protocol findings above.
- uncovered_behaviours:
  - "{behaviour: 'createActivityEvent system-event fallback — no test asserts that when authIdentityProvider.getCurrentUser() returns Mono.empty(), the persisted row has created_by=NULL (the .switchIfEmpty branch at line 49). A regression that swapped the fallback to a hardcoded \"system\" string would silently change the UI semantics for unattributed events.', test_class: 'ActivityServiceImplTest (would add testCreateActivityEvent_NoAuthContext_NullCreatedBy)', severity: HIGH}"
  - "{behaviour: 'createActivityEvent provider-drop — no test asserts that UserDto.provider is DROPPED from the persisted row (line 47 maps UserDto::username only). A regression mapping UserDto::toString or adding provider to the pojo would change the cross-mode-bleed semantics.', test_class: 'ActivityServiceImplTest (would add testCreateActivityEvent_ProviderDropped)', severity: MEDIUM}"
  - "{behaviour: 'createActivityEvents empty-list edge case — no test asserts that createActivityEvents(emptyList) is a harmless no-op rather than throwing or producing a phantom row. The switchIfEmpty conflation noted in S-B-1 is not regression-tested.', test_class: 'ActivityServiceImplTest (would add testCreateActivityEvents_EmptyList_NoOp)', severity: LOW}"
  - "{behaviour: 'getActivityList null-date validation — no test asserts that beginDate==null OR endDate==null throws BadUserRequestException (line 98-100, 128-130). A regression removing the validation would surface as cross-history unbounded queries.', test_class: 'ActivityServiceImplTest (would add testGetActivityList_NullBeginDate_ThrowsBadUserRequest)', severity: HIGH}"
  - "{behaviour: 'getActivityCounts null-date acceptance — no test asserts (or constrains) the behaviour when getActivityCounts is called without dates. This is the asymmetric-validation bug surfaced in S-B-3. A test should either assert the current behaviour (unbounded count) OR assert the desired behaviour (rejection symmetric to getActivityList).', test_class: 'ActivityServiceImplTest (would add testGetActivityCounts_NullDates_BehaviourPin)', severity: MEDIUM}"
  - "{behaviour: 'ownerIds dropped for non-ALL view modes — no test asserts that ownerIds parameter is IGNORED when type=MY_OBJECTS/UPSTREAM/DOWNSTREAM. S-B-2 finding; the asymmetry is operator-visible drift.', test_class: 'ActivityServiceImplTest (would add testGetActivityList_OwnerIdsDroppedForNonAll)', severity: MEDIUM}"
  - "{behaviour: 'MY_OBJECTS silently empty for users without associated Owner — S-D-2 finding. No test asserts the silent empty-return behaviour of fetchMyActivities for unmapped users. A regression that started throwing an error would surface as a 500 to users; a regression that started returning ALL activity (e.g. removed the .switchIfEmpty) would be a permission bypass.', test_class: 'ActivityServiceImplTest (would add testFetchMyActivities_NoAssociatedOwner_EmptyReturn)', severity: HIGH}"
  - "{behaviour: 'getDataEntityActivityList no per-entity authz — no test asserts the contract that ANY authenticated user can read ANY data entitys activity. This is the S-D-3 finding. Without a regression test (asserting the current behaviour OR asserting a desired tightening), a future refactor to add owner-scoping would silently break the global Activity Feed.', test_class: 'ActivityServiceImplTest (would add testGetDataEntityActivityList_CrossOwnerAuthnOnly)', severity: HIGH}"
  - "{behaviour: 'getActivityHandler missing-handler RuntimeException — no test asserts that adding a new ActivityEventTypeDto value without a handler throws RuntimeException at first invocation. The S-E-4 silent-add risk goes undetected.', test_class: 'ActivityServiceImplTest (would add testGetActivityHandler_UnknownEventType_ThrowsRuntimeException)', severity: MEDIUM}"
  - "{behaviour: 'Mono.zip count aggregation cross-query consistency — no test asserts the (intentional) inconsistency between totalCount and sum-of-sub-counts (S-C-1). A future refactor wrapping the four counts in a single TX would fix the inconsistency but would also change the behaviour silently.', test_class: 'ActivityServiceImplTest (would add testGetActivityCounts_ConcurrentSnapshotInconsistency)', severity: LOW}"
  - "{behaviour: 'Activity emit rollback under business-method success — no test asserts that an ActivityRepository failure rolls back the @ActivityLog method (intended). This is the S-E-1 finding (a behaviour many operators would find surprising — they expect activity to be best-effort). A regression that decoupled the TX (e.g. moved activity emit to a separate TX) would silently break the audit-trail consistency contract.', test_class: 'ActivityAspectTest or @SpringBootTest integration (would add testActivityLog_ActivityWriteFailure_RollsBackBusinessMethod)', severity: HIGH}"
  - "{behaviour: 'createActivityEvent retry/replay produces duplicate rows — S-E-2 finding. No test asserts the (current) non-idempotency. A regression adding ON CONFLICT or an idempotency key would change behaviour silently.', test_class: 'ActivityServiceImplTest (would add testCreateActivityEvent_DoubleSubmit_TwoRowsCreated)', severity: MEDIUM}"
- test_files: [] — N/A. NO `ActivityServiceImplTest.java` exists; verified via Glob.
- gaps: |
    Service-layer test coverage is **zero**. Every cross-cutting concern this service introduces — the auth-resolution null-username fallback (line 49, 60), the view-mode dispatch in getActivityList (line 107-116), the asymmetric date validation between getActivityList and getActivityCounts (S-B-3), the silently-dropped ownerIds for non-ALL view modes (S-B-2), the silently-empty MY_OBJECTS feed for users without Owner mapping (S-D-2), the linear-scan handler dispatch with RuntimeException-on-miss (S-E-4), the cross-query consistency of Mono.zip (S-C-1) — is unverified by automated test. **A future refactor that, e.g., removed the `.switchIfEmpty(Mono.defer(() -> mapToPojo(event, time, null)))` block (line 49-50) would COMPILE, pass all existing tests, and silently fail every ingestion DATA_ENTITY_CREATED activity emit (because ActivityIngestionRequestProcessor runs without SecurityContext) — a critical audit-trail regression with zero CI signal.**

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `ActivityServiceImpl.java`. Verified by reading line-by-line; no comment-form `@docs:` URL annotation present.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "The Activity Feed feature's canonical doc page. This service is the orchestration layer for both the read AND write paths of the feature."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "Every metadata edit the platform observes — entity lifecycle transitions, ownership changes, tag and term assignments, dataset-field edits, alerts — emits a typed event onto the feed."
      "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)."
      The page does NOT document: (a) whether all users see all activity or if visibility is permission-scoped; (b) the MY_OBJECTS silent-empty behaviour for unmapped users; (c) transactional semantics between business mutation and activity emit; (d) the cross-mode bleed (LOGIN_FORM 'alice' === LDAP 'alice'); (e) the asymmetric ownerIds parameter for non-ALL view modes; (f) the non-idempotency of activity emit.
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: ""
    rationale: "Activity partition configuration doc — `odd.activity.partition-period` controls the rolling-window the rows this service writes are partitioned by."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "`odd.activity.partition-period`: partition width in days for the `activity` table. Integer, days. Defaults to `30`."
      "The default creates a new partition every 30 days, which is appropriate for most deployments."
      "Operators running high-volume deployments (millions of activity events per day) can tune this downward to narrow partitions — smaller partitions speed up vacuum and partition-prune operations on the activity feed."
      "The documentation does not address activity retention or cleanup policies for the activity table itself—only partition width configuration."
    confidence: HIGH
- doc_drift_findings:
  - "DRIFT (doc-silent on read-side authorization): The activity-feed.md page does NOT mention that every authenticated user sees every recorded change on every data entity across all owners. Operators reading the page cannot infer the cross-owner visibility posture. The doc should add an admonition noting: 'The Activity Feed (global page and per-entity tab) is visible to every authenticated user. No per-data-entity authorization is enforced at the read surface; activity payloads (oldState/newState JSON) for any data entity can be read by any authenticated caller via the /api/activity/{dataEntityId}/list endpoint.'"
  - "DRIFT (doc-silent on MY_OBJECTS prerequisite): The activity-feed.md page mentions a 'My objects' view mode but does NOT document that this view is silently empty for users with no Owner association (user_owner_mapping row). The User-Owner association doc page should be cross-linked from activity-feed.md, and a sentence added: 'The My objects view returns activity only for data entities owned by the Owner you are associated with. If no association exists, the My objects view is empty.'"
  - "DRIFT (doc-silent on retention semantics): The configuration doc states 'The documentation does not address activity retention or cleanup policies for the activity table itself—only partition width configuration.' (verbatim from WebFetch). Combined with the F-010 finding that ActivityEmptyPartitionsHousekeepingJob drops ONLY EMPTY past partitions, the actual semantics are 'the activity table grows monotonically forever; only fully-empty partitions are dropped'. The doc should add an admonition: 'The activity table has no row-level TTL. Partitions are dropped only when empty; once a partition contains any activity row, that partition (and its rows) persist until manual intervention.'"

## implicit_adrs

- "**System events have NULL created_by, intentionally**" — evidence: ActivityServiceImpl.java:49 + line 60 (`.switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))`); intent_anchor: corroborated by live doc page (WebFetch 2026-05-20 status 200): "Auto-resolution events emitted from the Alerting subsystem are recorded as system events on the feed (no operator identity attached)." The fallback-to-null pattern IS the protocol-level signal of "no operator identity"; the docs explicitly anchor this. — confidence: HIGH

- "**The username is the actor-identity field, not the (username, provider) tuple**" — evidence: ActivityServiceImpl.java:47, 58 `.map(UserDto::username)` drops the provider; ReactiveActivityRepositoryImpl line 157-158 LEFT JOIN by OIDC_USERNAME only (per repo sidecar invariant); intent_anchor: the schema's `activity.created_by varchar(512) NULLABLE` (V0_0_48__add_activity.sql per the repo sidecar) accepts the username — no provider column exists. The decision: usernames are globally unique across providers, OR the project accepts the cross-mode bleed. The latter is the observable reality. — confidence: MEDIUM (the schema supports either interpretation; no comment in the source explicitly chooses one)

- "**The activity row is in the same TX as the business mutation, via the aspect's @ReactiveTransactional**" — evidence: `ActivityAspect.java:42` `@ReactiveTransactional` on `monoActivityAspect` (the @Around advice that wraps @ActivityLog methods); `ActivityServiceImpl` itself has NO @ReactiveTransactional; the design depends on the aspect for TX wrapping; intent_anchor: the aspect's annotation placement (on the @Around method, not on the @ActivityLog annotation or on the activity service) IS the explicit design choice — alternative designs (separate TX for activity, async fire-and-forget) would require removing or relocating the annotation. The aspect-level annotation forces atomicity. — confidence: HIGH

- "**Linear-scan handler dispatch with RuntimeException-on-miss is the chosen failure mode**" — evidence: `:260-264` `handlers.stream().filter(...).findFirst().orElseThrow(() -> new RuntimeException("Can't find handler for event type " + eventType.name()))`; intent_anchor: the explicit `orElseThrow` with an exception message naming the missing event type — the maintainer expected a missing handler to be loud, not silent. Linear-scan (vs Map<Type, Handler>) accepts O(N) lookup cost for 17 handlers in exchange for autowire-by-collection simplicity. — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**`getActivityCounts` accepts null begin/end dates**, asymmetric with `getActivityList` (which validates them). Per S-B-3 stress finding, a `/api/activity/counts` call without dates yields an unbounded scan over the entire retained activity table. Severity: MEDIUM. Evidence: lines 138-166 (no null-check) vs lines 98-100, 128-130 (BadUserRequestException). Probe P-023 emitted."

- "**`ownerIds` query parameter is silently dropped for `type=MY_OBJECTS|UPSTREAM|DOWNSTREAM`**, asymmetric with `type=ALL`. Per S-B-2 stress finding. An operator setting `type=MY_OBJECTS&owner_ids=[5]` gets ONLY their own owner's activity (the owner-5 filter is ignored). Severity: MEDIUM. Evidence: lines 107-116 (switch dispatching to `fetchAllActivities` only for `null` and `ALL`; the other branches drop `ownerIds`)."

- "**MY_OBJECTS view silently empty for users with no associated Owner**. Per S-D-2 stress finding. A LOGIN_FORM user with no `user_owner_mapping` row sees the MY_OBJECTS feed return zero rows + `myObjectsCount=0` with no UI signal that they need to be Owner-associated. Severity: MEDIUM. Evidence: lines 194-198 (`fetchMyActivities` `.switchIfEmpty(Flux.empty())`); lines 239-243 (`getMyObjectActivitiesCount` `.defaultIfEmpty(0L)`)."

- "**`getDataEntityActivityList` has no per-data-entity authorization**. Any authenticated user can query activity for any data entity (including data entities they have no permission to see), reading the JSON oldState/newState payloads which may include description content, tag changes, ownership changes. Per S-D-3 stress finding. Severity: MEDIUM. Evidence: lines 119-136 (no permission check; no controller-level @PreAuthorize per existing ActivityController sidecar; no ActivityApi annotation per existing controller class sidecar)."

- "**Activity emit is non-idempotent**. Two concurrent submissions of the same `ActivityCreateEvent` produce TWO rows with sequential ids. The aspect's `.filter(newState -> !info.getOldState().equals(newState))` (ActivityAspect.java:86) provides PARTIAL protection (catches the post-success retry), but TRUE concurrent retries both succeed at the write level. Per S-E-2 stress finding. Severity: MEDIUM. Evidence: line 50, 62 (`activityRepository.saveReturning`/`save` — unconditional INSERT per repo sidecar lines 50-71)."

- "**Activity-row write failures roll back business mutations** (via the aspect's `@ReactiveTransactional`). A transient repository error on the activity write rolls back a successful business mutation and surfaces a 500 to the user. This is the intended behaviour for audit-trail consistency but is operationally surprising — operators expect audit to be best-effort. Per S-E-1 stress finding. Severity: LOW (intended but discoverable). Evidence: ActivityAspect.java:42 (`@ReactiveTransactional` on `monoActivityAspect`); ActivityServiceImpl.java has NO local TX so the aspect's TX is the boundary."

- "**`activity.created_at` is the Mono-assembly time, not the COMMIT time**. Two near-simultaneous mutations can have inverted `created_at` columns vs commit order. Per S-C-2 stress finding. The cursor pagination uses tuple comparison `(trunc(created_at, SECOND), id)` per the repo sidecar lines 287-288, mitigating intra-second drift via the id tie-breaker — but inter-second drift (for mutations that take >1s to commit) is operator-visible. Severity: LOW. Evidence: line 45, 56 (`DateTimeUtil.generateNow()` at Mono build time)."

- "**No CI-time check that every `ActivityEventTypeDto` enum value has a corresponding `ActivityHandler` implementation**. A new enum value added without a handler triggers `RuntimeException` at first invocation. Per S-E-4 stress finding. Severity: LOW (loud failure; not silent). Evidence: lines 260-264; the handler list is autowired by Spring component scan with no compile-time exhaustiveness check."

- "**Cross-query inconsistency in `getActivityCounts`** — four count queries (`totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount`) run concurrently via `Mono.zip` against four separate connections at READ COMMITTED isolation. A row INSERTed between the queries appears in some counts but not others; `totalCount ≠ myObjectsCount + downstreamCount + upstreamCount` is possible. Per S-C-1 stress finding. Severity: LOW (visual UI inconsistency only). Evidence: lines 158-165."

## security

- auth_mode_relevance: INTERNAL_ONLY — this service is not on the HTTP surface directly; it is invoked by ActivityController (HTTP perimeter), ActivityAspect (in-process), AlertServiceImpl (in-process), ActivityIngestionRequestProcessor (S2S perimeter). Authentication mode is bound at the perimeter; this service receives the SecurityContext (or empty) via `ReactiveSecurityContextHolder` through `AuthIdentityProvider`. For DISABLED mode: no SecurityContext exists → `getCurrentUser()` is `Mono.empty()` → all writes carry `created_by=NULL`.
- ingestion_filter_relevance: YES (indirectly) — `ActivityIngestionRequestProcessor.process` is invoked by `IngestionServiceImpl.ingest` during the S2S `POST /ingestion/entities` flow gated by `auth.ingestion.filter.enabled`. This service's `createActivityEvents` is the write call from that path. The S2S filter does NOT inject a SecurityContext — so ingestion-emitted activity rows carry `created_by=NULL` (system events).
- authorization_assertions:
  - "[] — NO @PreAuthorize, NO programmatic permission check, NO @ConditionalOnProperty in ActivityServiceImpl (lines 33-273 verified). Authorization is entirely caller-perimeter-bound."
- owner_scoping: BYPASSES (with one MY_OBJECTS exception)
  - "Read paths (`getActivityList` for `type=null|ALL`, `getDataEntityActivityList`, `getActivityCounts`): NO owner-scoping; return data across owners — evidence: lines 86-117, 119-136, 138-166. The `ownerIds` parameter is a CALLER-PROVIDED filter, not a permission gate; the caller can pass any value or `null`."
  - "MY_OBJECTS view-mode: RESPECTS owner-scoping — evidence: lines 194-196 `authIdentityProvider.fetchAssociatedOwner().flatMapMany(owner -> activityRepository.findMyActivities(..., owner.getId(), ...))`. The current user's associated owner.id is threaded as a filter."
  - "Write paths: N/A — activity rows are written to a global table with no owner column; visibility at read time is determined by the read path's filter."
- data_exposure:
  - "Activity payload (oldState/newState JSON, eventType, dataEntityId, createdBy, createdAt) → any authenticated user, no owner filter applied at service or controller layer (per existing ActivityController sidecar coherence_notes.F-006)"
  - "Activity payload for ANY data entity via `/api/activity/{dataEntityId}/list` → any authenticated user, no per-entity permission gate (S-D-3 finding)"
  - "Activity counts (total, myObjects, downstream, upstream) for ANY date range → any authenticated user, including potentially unbounded queries (S-B-3 finding: null dates accepted)"
- known_security_gaps:
  - "controller-tier authorization is `.authenticated()`-only; service-tier authorization is zero; the entire Activity Feed is visible to any authenticated user across all owners — evidence: ActivityServiceImpl.java:33-273 (no @PreAuthorize) + ActivityController.java (per existing sidecar, no @PreAuthorize on either method); severity: MEDIUM — this is per-design for the global Activity Feed BUT operator-visible via the per-data-entity endpoint (`getDataEntityActivityList`) which exposes activity for entities the caller may have no other access to"
  - "cross-mode bleed propagator at the persistence layer: UserDto.provider is dropped before reaching activity.created_by — evidence: ActivityServiceImpl.java:47, 58 (`.map(UserDto::username)`); ReactiveActivityRepositoryImpl LEFT JOIN by OIDC_USERNAME only (per repo sidecar invariant); severity: MEDIUM — a LOGIN_FORM 'alice' performing an activity-emitting mutation appears as the same actor as an LDAP 'alice' in the Activity Feed"
  - "MY_OBJECTS view silently empty for users without Owner association — evidence: ActivityServiceImpl.java:194-198; the user cannot tell they have no Owner mapping (no UI signal); severity: LOW (discoverability concern, not a security gap per se)"
  - "system-event detection is via `created_by IS NULL` and `is_system_event = TRUE` — a future refactor that started populating a synthetic username (e.g. 'system' or 'ingestion-bot') would silently change the UI's discrimination of system vs user events — evidence: ActivityServiceImpl.java:49, 60 (`.switchIfEmpty(... mapToPojo(event, time, null))`); severity: LOW"

## performance

- hot_paths:
  - "every `@ActivityLog`-annotated business method invokes `getContextInfo` (BEFORE mutation) + `getUpdatedInfo` (AFTER mutation) + `createActivityEvent` (AFTER, conditional) — three additional reactive sub-calls per mutation. Each sub-call carries its own DB roundtrip (handler's DataEntity read for `getContextInfo`/`getUpdatedInfo`, the INSERT for `createActivityEvent`)" — evidence: ActivityServiceImpl.java:65-83 (handler dispatch); ActivityAspect.java:48, 85, 94 (aspect calls)
  - "linear-scan handler dispatch (`getActivityHandler`, line 260-264) runs O(N=17) per activity emit; for 18+ @ActivityLog-annotated methods at a typical platform call rate, this is a per-request 17-element stream walk plus an `isHandle(eventType)` boolean check per handler" — evidence: line 260-264
  - "`Mono.zip` 4-way concurrent count queries in `getActivityCounts` — issues four DB roundtrips concurrently per /api/activity/counts call" — evidence: line 158-165
- throughput_characteristics:
  - "single-row write path (`createActivityEvent`) — one INSERT per call; not batched at this layer"
  - "batch write path (`createActivityEvents`) — partitioned in 1000-row chunks via `JooqReactiveOperations.executeInPartition` per repository sidecar line 62; called from ActivityIngestionRequestProcessor (DATA_ENTITY_CREATED per ingestion batch) and AlertServiceImpl (per alert batch)"
  - "READ paths return `Flux<Activity>` — streaming; backpressure-aware. Single-shot `LIMIT size` queries per the repository sidecar line 292"
- resource_allocation:
  - "no in-process caching at this layer; every read hits the repository (which hits Postgres)"
  - "the 17 ActivityHandler beans are singleton @Components; the handlers list is autowired once at startup. No per-request handler instantiation."
  - "no outbound HTTP, no SMTP, no S3, no OTLP, no async queue"
  - "DB connection: one R2DBC connection per Mono/Flux subscription; the four-way `Mono.zip` in `getActivityCounts` uses up to 4 concurrent connections from the R2DBC pool"
- scaling_characteristics:
  - "stateless service — instances scale horizontally"
  - "no advisory locks, no SELECT FOR UPDATE — write contention is at the activity table's INSERT path (Postgres write lock per row; partition awareness implicit in declarative range-partitioning)"
  - "no pagination on the READ paths at the service layer — pagination is provided by the controller via `(lastEventId, lastEventDateTime, size)` cursor; size is NOT clamped at service or controller (per ActivityController sidecar)"
  - "the 27-value ActivityEventTypeDto enum + 17 handlers — adding a new event type requires adding a new handler, but the linear-scan dispatch scales O(N) per call; at N=100 handlers, dispatch would become a measurable hot-path overhead"
- known_performance_gaps:
  - "`getActivityCounts` accepts null dates and would issue an unbounded count over the entire activity table — see S-B-3 stress finding; probe P-023 emitted; severity: MEDIUM"
  - "no size clamp on read paths — a caller requesting `size=1000000` triggers a `LIMIT 1000000` query at the repository — evidence: line 86-117 passes `size` through unmodified; severity: LOW (the controller's HTTP layer has no clamp either per ActivityController sidecar)"
  - "linear-scan O(N=17) handler dispatch per activity emit — scales linearly with handler count; at current N this is a microsecond cost but degrades if new event types are added without restructuring to Map<EventType, Handler> — evidence: line 260-264; severity: LOW"
  - "Mono.zip 4-way concurrent count queries on every `/api/activity/counts` call — consumes 4 R2DBC connections concurrently; under load this can exhaust the connection pool faster than serialized count queries — evidence: line 158-165; severity: LOW"

## sources

- understanding ← ActivityServiceImpl.java:33-273 (whole-file read); ActivityAspect.java:42, 86 (TX boundary); AuthIdentityProviderImpl.java:24-35, 50-53 (auth-context resolution); existing ActivityController + ReactiveActivityRepositoryImpl sidecars (cross-reference); live activity-feed.md doc (WebFetch 2026-05-20 status 200)
- concepts.entities.ActivityCreateEvent ← dto/activity/ActivityCreateEvent.java:1-14
- concepts.entities.ActivityContextInfo ← dto/activity/ActivityContextInfo.java:1-11
- concepts.entities.ActivityPojo ← ActivityMapper.java:79-81; existing ReactiveActivityRepositoryImpl sidecar
- concepts.entities.ActivityEventTypeDto ← dto/activity/ActivityEventTypeDto.java:1-31
- concepts.entities.UserDto ← AuthIdentityProvider.java:9, AuthIdentityProviderImpl.java:30, 32
- concepts.entities.ActivityHandler ← service/activity/handler/ActivityHandler.java:9-22; Glob enumeration of 17 implementations
- concepts.operations.createActivityEvent ← ActivityServiceImpl.java:43-52
- concepts.operations.createActivityEvents ← ActivityServiceImpl.java:54-63
- concepts.operations.getContextInfo ← ActivityServiceImpl.java:65-69
- concepts.operations.getUpdatedInfo ← ActivityServiceImpl.java:71-83
- concepts.operations.getActivityList ← ActivityServiceImpl.java:85-117
- concepts.operations.getDataEntityActivityList ← ActivityServiceImpl.java:119-136
- concepts.operations.getActivityCounts ← ActivityServiceImpl.java:138-166
- concepts.operations.fetchAllActivities/fetchMyActivities/fetchDependentActivities ← ActivityServiceImpl.java:168-217
- concepts.operations.getTotalCount/getMyObjectActivitiesCount/getDependentActivitiesCount ← ActivityServiceImpl.java:219-258
- concepts.operations.getActivityHandler ← ActivityServiceImpl.java:260-264
- concepts.operations.mapEventsToPojos ← ActivityServiceImpl.java:266-272
- concepts.invariants.zero-authz ← ActivityServiceImpl.java:33-273 (line-by-line absence of @PreAuthorize / @ConditionalOnProperty)
- concepts.invariants.system-event-null-created-by ← ActivityServiceImpl.java:49, 60 + AuthIdentityProviderImpl.java:24-35 + live docs excerpt
- concepts.invariants.provider-dropped ← ActivityServiceImpl.java:47, 58 (`.map(UserDto::username)`); existing ReactiveActivityRepositoryImpl sidecar invariant
- concepts.invariants.MY_OBJECTS-empty ← ActivityServiceImpl.java:194-198; AuthIdentityProviderImpl.java:50-53
- concepts.invariants.tx-from-caller ← ActivityServiceImpl.java:33-273 (no @ReactiveTransactional); ActivityAspect.java:42; AlertServiceImpl.java:201; IngestionServiceImpl.java:66
- concepts.invariants.no-idempotency ← ActivityServiceImpl.java:50, 62; existing repo sidecar lines 50-71
- concepts.invariants.time-at-assembly ← ActivityServiceImpl.java:45, 56; DateTimeUtil.java:11-13
- concepts.invariants.asymmetric-validation ← ActivityServiceImpl.java:98-100, 128-130 vs 138-166
- concepts.audiences.ActivityController ← existing ActivityController class sidecar
- concepts.audiences.ActivityAspect ← ActivityAspect.java:42-95
- concepts.audiences.ActivityIngestionRequestProcessor ← service/ingestion/processor/ActivityIngestionRequestProcessor.java:23-32
- concepts.audiences.AlertServiceImpl ← service/AlertServiceImpl.java:201, 247-258, 309-325
- stress_findings.S-B-1 ← ActivityServiceImpl.java:54-63 (analysis of switchIfEmpty firing conditions)
- stress_findings.S-B-2 ← ActivityServiceImpl.java:107-116 (switch dispatch + parameter signatures)
- stress_findings.S-B-3 ← ActivityServiceImpl.java:138-166 (no null-check) vs 98-100, 128-130 (BadUserRequestException)
- stress_findings.S-B-4 ← ActivityServiceImpl.java:43-63 + existing ReactiveActivityRepositoryImpl sidecar lines 50-71 (no ON CONFLICT)
- stress_findings.S-C-1 ← ActivityServiceImpl.java:158-165 + Reactor Mono.zip semantics
- stress_findings.S-C-2 ← ActivityServiceImpl.java:45, 56 + DateTimeUtil.java:11-13
- stress_findings.S-D-1 ← ActivityServiceImpl.java:33-273 (absence); existing ActivityController class sidecar coherence_notes.F-006
- stress_findings.S-D-2 ← ActivityServiceImpl.java:194-198; AuthIdentityProviderImpl.java:50-53
- stress_findings.S-D-3 ← ActivityServiceImpl.java:119-136; existing ActivityController sidecar
- stress_findings.S-E-1 ← ActivityServiceImpl.java:33-273 (no @ReactiveTransactional); ActivityAspect.java:42; AlertServiceImpl.java:201; IngestionServiceImpl.java:66
- stress_findings.S-E-2 ← ActivityServiceImpl.java:50, 62; existing repo sidecar lines 50-71
- stress_findings.S-E-4 ← ActivityServiceImpl.java:260-264
- stress_findings.S-A-1 ← ActivityServiceImpl.java:33-273 (whole-file numeric-constant scan: no literals besides `ASC`/`DESC` sort-key constants)
- security.* ← ActivityServiceImpl.java:33-273 (absence) + existing ActivityController class sidecar + AuthIdentityProviderImpl.java:50-53
- performance.* ← ActivityServiceImpl.java:43-63, 65-83, 138-166, 260-264 + existing repo sidecar
- implicit_adrs.[0] ← ActivityServiceImpl.java:49, 60 + live docs excerpt (WebFetch 2026-05-20)
- implicit_adrs.[1] ← ActivityServiceImpl.java:47, 58 + existing repo sidecar invariant
- implicit_adrs.[2] ← ActivityAspect.java:42; ActivityServiceImpl.java lacks @ReactiveTransactional
- implicit_adrs.[3] ← ActivityServiceImpl.java:260-264 (explicit RuntimeException with named event-type in message)
- bugs_limitations_corner_cases.* ← ActivityServiceImpl.java:98-100, 128-130, 138-166, 107-116, 194-198, 119-136, 50, 62, 49, 60, 158-165, 260-264, 45, 56
- docs_link_semantic.inferred_docs.[0] ← https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (WebFetch 2026-05-20, status 200)
- docs_link_semantic.inferred_docs.[1] ← https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (WebFetch 2026-05-20, status 200)
- tests_coverage_semantic.test_files ← Glob enumeration: no `ActivityService*Test*.java`; only `ActivityMapperTest.java` exists

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (two live URLs WebFetched; doc-drift findings stated as factual gaps not yet authored)
- implicit_adrs: HIGH (4 ADRs, three HIGH-confidence + one MEDIUM with explicit caveat)
- bugs_limitations_corner_cases: HIGH (9 findings, each file:line-anchored)
- security: HIGH
- performance: HIGH
- stress_findings: HIGH (12 findings across categories A/B/C/D/E; 11 STATIC-INFERRED + 1 PROBE-NEEDED with P-023 emitted)

## probe_skeletons_emitted

- P-023 — `getActivityCounts` accepts null dates triggering unbounded count over entire activity history. Skeleton at `lineage/odd-platform/probes/P-023.yaml`. Status: pending-stress-protocol.

## Maintainer notes

(empty — no prior sidecar; reserved for maintainer prose to be preserved across refreshes)

## CTRIB-010 / odd-platform#1657 update (2026-06-13) — v2 fix shipped on contrib/CTRIB-010-activity-actor-filter

All read signatures thread \`usernames\` next to \`userIds\`; NEW \`getActivityUsers\` passes through to the
repository + maps via \`ActivityMapper.mapToActivityUserList\` (#1657 v2). Both actor axes are intentional.

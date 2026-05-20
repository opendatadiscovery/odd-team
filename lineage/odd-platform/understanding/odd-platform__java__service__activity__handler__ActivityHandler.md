---
node_id: "odd-platform java service activity handler:ActivityHandler"
node_kind: interface
axis: services
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: stress-complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-20-VAL-LSN-019-batch-2-activity
pillar_anchored_features:
  - P-08 Management & Administration (Activity Feed surface)
  - "F-???-activity-audit-trail (cross-cutting audit feature; this interface is the dispatch core)"
---

# ActivityHandler — semantic understanding

## understanding

`ActivityHandler` is a **4-method interface (3 abstract + 1 default that throws)** in 22 lines (`ActivityHandler.java:9-22`) that defines the dispatch contract for ODD's Activity-feed audit-event recording. **It is NOT a write-side "handle(event)" interface as the dispatch pattern name might suggest** — it is a **state-snapshot differ**: `getContextInfo(parameters)` captures the OLD state of the affected `data_entity` BEFORE the mutation runs; `getUpdatedState(parameters, dataEntityId)` captures the NEW state AFTER the mutation runs. **The handler never writes the `ActivityPojo`** — the actual diff (`oldState != newState` string-equality at `ActivityAspect.java:86`) and the persist (`activityRepository.saveReturning` at `ActivityServiceImpl.java:50`) happen in `ActivityAspect`/`ActivityServiceImpl` AFTER both snapshots are in hand. The interface has ~18 concrete implementations (Glob `service/activity/handler/*.java` → 19 files including the interface itself and 2 abstract bases). Dispatch is by linear scan: `ActivityServiceImpl.getActivityHandler` (`:260-264`) iterates `List<ActivityHandler>` calling `isHandle(eventType)` until one returns `true`, then `findFirst().orElseThrow(RuntimeException("Can't find handler ..."))`. Spring's bean ordering determines which handler wins when more than one matches (`DatasetFieldInformationUpdatedActivityHandler.isHandle` at `:26-30` matches THREE event types — DESCRIPTION/TAGS/INTERNAL_NAME — so a future handler registered for the same trio would non-deterministically displace it based on `@Component` discovery order). The whole flow (getContextInfo → joinPoint.proceed → getUpdatedState → activityRepository.saveReturning) runs inside `@ReactiveTransactional` on the aspect (`ActivityAspect.java:42, 62`) — **emit failures or state-read failures roll back the actual mutation**, a non-obvious coupling for callers that expect "audit is best-effort".

## concepts

- entities: [
    "`ActivityHandler` — the 4-method interface itself; consumed by the AOP-driven `ActivityAspect` and directly by `ActivityServiceImpl`",
    "`ActivityEventTypeDto` (`dto/activity/ActivityEventTypeDto.java:3-31`) — 27-value enum: OWNERSHIP_CREATED, OWNERSHIP_UPDATED, OWNERSHIP_DELETED, TAG_ASSIGNMENT_UPDATED, DATA_ENTITY_CREATED, DATA_ENTITY_OVERVIEW_UPDATED, DATA_ENTITY_METADATA_UPDATED, DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED, TERM_ASSIGNMENT_UPDATED, DESCRIPTION_UPDATED, BUSINESS_NAME_UPDATED, DATA_ENTITY_STATUS_UPDATED, CUSTOM_METADATA_CREATED/UPDATED/DELETED, DATASET_FIELD_VALUES_UPDATED, DATASET_FIELD_DESCRIPTION_UPDATED, DATASET_FIELD_INTERNAL_NAME_UPDATED, DATASET_FIELD_TAGS_UPDATED, DATASET_FIELD_TERM_ASSIGNMENT_UPDATED, CUSTOM_GROUP_CREATED/UPDATED, ALERT_HALT_CONFIG_UPDATED, ALERT_STATUS_UPDATED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED",
    "`ActivityContextInfo` (`dto/activity/ActivityContextInfo.java:8-11`) — 2-field record `{Long dataEntityId, String oldState}`; produced by `getContextInfo`; the `oldState` is the JSON-serialized snapshot",
    "`ActivityCreateEvent` (`dto/activity/ActivityCreateEvent.java:8-14`) — 5-field record `{long dataEntityId, ActivityEventTypeDto eventType, String oldState, String newState, boolean systemEvent}`; built by `ActivityAspect.postActivity` (`:87-94`) from the two snapshots and dispatched to `activityService::createActivityEvent`",
    "`Map<String, Object> parameters` — opaque key-value bag passed through both methods; populated by `ActivityAspect.extractActivityParameters` (`:97-110`) from `@ActivityParameter`-annotated method args on the calling write method. Key strings live in `utils/ActivityParameterNames` (e.g. `DATA_ENTITY_ID`, `OWNERSHIP_ID`, `ALERT_ID`, `DATASET_FIELD_ID`)",
    "**Concrete impl population** (18 classes verified via `Glob: service/activity/handler/*.java`): `BusinessNameUpdatedActivityHandler`, `AlertHaltConfigUpdatedActivityHandler`, `CustomGroupCreatedActivityHandler`, `DatasetFieldTermAssignmentActivityHandler`, `OwnershipCreatedActivityHandler`, `TagActivityHandlerImpl`, `AlertStatusUpdatedHandler`, `OwnershipUpdatedActivityHandler`, `DatasetFieldInformationUpdatedActivityHandler` (handles 3 event types), `DescriptionUpdatedActivityHandler`, `DataEntityCreatedActivityHandler`, `OwnershipDeletedActivityHandler`, `DataEntityStatusUpdatedActivityHandler`, `DatasetFieldValuesUpdatedActivityHandler`, `CustomGroupUpdatedActivityHandler`, `TermAssignmentActivityHandler`, plus 2 abstract bases (`AbstractOwnershipActivityHandler`, `AbstractCustomGroupActivityHandler`). Three of the 27 enum values are NOT covered by any concrete handler in this directory: `DATA_ENTITY_OVERVIEW_UPDATED`, `DATA_ENTITY_METADATA_UPDATED`, `DATA_ENTITY_SCHEMA_UPDATED`, `DATA_ENTITY_RELATION_UPDATED`, `CUSTOM_METADATA_CREATED/UPDATED/DELETED`, `OPEN_ALERT_RECEIVED`, `RESOLVED_ALERT_RECEIVED` — verified by reading each handler's `isHandle` body; an `ActivityLog`-annotated method using one of these event types would throw `RuntimeException(\"Can't find handler for event type ...\")` at `ActivityServiceImpl.java:263`"
  ]
- operations: [
    "`isHandle(ActivityEventTypeDto)` (`:10`) — boolean predicate that each concrete impl uses to claim its event type(s). NO @Override annotation requirement, NO ordering guarantee, NO mutual-exclusivity check. `ActivityServiceImpl.getActivityHandler` (`:260-264`) does `stream().filter().findFirst()` — the FIRST `true` wins. `DatasetFieldInformationUpdatedActivityHandler.isHandle` (`:26-30`) returns `true` for THREE distinct event types via `||` chain; no other handler claims those three (verified), so no collision occurs at the current state, but the interface contract does NOT enforce mutual exclusivity",
    "`getContextInfo(Map<String, Object> parameters)` (`:12`) — Mono producer of `ActivityContextInfo`. Called by `ActivityAspect` BEFORE `joinPoint.proceed()` (`:48-49, 68-69`). Concrete impls do ONE of three patterns: (a) read OLD state from the DB given an id parameter (`BusinessNameUpdatedActivityHandler:27-32`, `DescriptionUpdatedActivityHandler:27-32`, `TagActivityHandlerImpl:26-32`, `AlertHaltConfigUpdatedActivityHandler:28-34`, `AlertStatusUpdatedHandler:30-35`, `TermAssignmentActivityHandler:31-37`, `OwnershipUpdatedActivityHandler` + `OwnershipDeletedActivityHandler` via `AbstractOwnershipActivityHandler.getContextInfoByOwnership:25-40`, `OwnershipCreatedActivityHandler:24-30`, `DatasetFieldInformationUpdatedActivityHandler:33-43`, `DatasetFieldValuesUpdatedActivityHandler:34-43`, `DatasetFieldTermAssignmentActivityHandler:36-45`); (b) read OLD state from the in-memory `parameters` map BEFORE any DB read happens (`DataEntityStatusUpdatedActivityHandler:32-37` reads `DataEntityPojo` directly from the parameter bag — NO DB read for old state, snapshot-from-caller); (c) hard-code `oldState = \"{}\"` for CREATE events (`DataEntityCreatedActivityHandler:31`, `CustomGroupCreatedActivityHandler:24`)",
    "`getUpdatedState(Map<String, Object> parameters, Long dataEntityId)` (`:14-15`) — Mono producer of String JSON. Called by `ActivityAspect.postActivity` (`:85`) AFTER the wrapped method's reactive chain completes. Pattern: re-read the same DB shape that `getContextInfo` read but reflecting POST-mutation state. **The handler trusts the caller to pass the right `dataEntityId`** — for handlers like `AlertStatusUpdatedHandler` where the parameters contain an `ALERT_ID` rather than `DATA_ENTITY_ID`, the handler re-reads the alert from `ActivityParameterNames.AlertStatusUpdated.ALERT_ID` in `parameters` (`AlertStatusUpdatedHandler:39-40`), NOT from the `dataEntityId` argument; the `dataEntityId` arg is ignored on that path, illustrating the contract's flexibility (handlers may use either source)",
    "`getUpdatedState(Map<String, Object> parameters, List<Long> dataEntityIds)` (`:17-21`, DEFAULT method) — throws `UnsupportedOperationException(\"getUpdatedState for multiple ids is not implemented yet for this handler\")` UNLESS overridden. Verified overrides: ONLY `DataEntityCreatedActivityHandler.getUpdatedState(parameters, List<Long>)` (`:46-49`) and `DataEntityStatusUpdatedActivityHandler.getUpdatedState(parameters, List<Long>)` (`:51-55`). All 16 other concrete impls inherit the throwing default. The ONLY caller of the multi-id path is `ActivityIngestionRequestProcessor.process` (`:25-32`) which dispatches `DATA_ENTITY_CREATED` only (`:26-28`) — so the runtime is safe in current usage, but the interface contract advertises a polymorphic batch path that 14/16 impls do NOT support. A future `@ActivityLog` annotation passing a multi-id parameters bag for any other event would throw at runtime with the misleading error message above"
  ]
- invariants: [
    "**Snapshot-differ contract, NOT write-handler contract.** The interface defines only state-reading methods. Diff computation (`postActivity`'s `filter(newState -> !info.getOldState().equals(newState))` at `ActivityAspect:86`) is OUTSIDE the handler scope; `ActivityPojo` persistence (`activityRepository::saveReturning`) is OUTSIDE the handler scope. A handler that misimplements `getContextInfo` or `getUpdatedState` produces a wrong-but-still-emitted activity record OR a silently-no-emit (oldState == newState, filter blocks)",
    "**State equality is JSON-string equality**, NOT semantic equality (`ActivityAspect:86`). JSON serialization uses `JSONSerDeUtils.serializeJson` (`utils/JSONSerDeUtils.java:56-66`) backed by Jackson's `ObjectMapper` with `SNAKE_CASE` PropertyNamingStrategy (`:20`). Field-order in serialization tracks declared order in the *ActivityStateDto, so changing field declaration order in a DTO would produce different JSON strings for identical underlying state and silently emit a spurious activity. Conversely, two semantically-different states that serialize to identical JSON (e.g. all fields default-null in pojo vs. genuinely-empty-but-loaded pojo) would silently NOT emit",
    "**Linear handler dispatch.** `ActivityServiceImpl.getActivityHandler` (`:260-264`) does `handlers.stream().filter(handler -> handler.isHandle(eventType)).findFirst().orElseThrow(RuntimeException)`. With 18 impls, the average dispatch cost is ~9 isHandle calls per event. This runs once per `getContextInfo`, once per `getUpdatedInfo`, twice per `@ActivityLog`-annotated method invocation. No caching",
    "**No `@Override` requirement on `isHandle`.** The interface declares the method but does not annotate it `@FunctionalInterface`; a concrete impl that does NOT override `isHandle` would inherit the default (no default exists at line 10 — it's abstract); a compile error would surface. The interface IS de-facto multi-method-abstract; the language guarantees implementation",
    "**The default multi-id `getUpdatedState` throws at runtime, not at compile time.** Concrete impls that do not need batch behaviour silently inherit the throw. A caller (specifically `ActivityServiceImpl.getUpdatedInfo(parameters, List<Long>, eventType)` at `:72-76`) that dispatches to an event type whose handler doesn't override the multi-id path would receive `UnsupportedOperationException` at the first subscription. The current code dispatches only `DATA_ENTITY_CREATED` to this path (verified via Grep — `ActivityIngestionRequestProcessor` is the only caller, line 27-28); adding a second multi-id event type without overriding would be a latent NPE-class regression",
    "**Wrapping `@ReactiveTransactional` makes audit emission TX-coupled.** The aspect (`ActivityAspect:42, 62`) annotates the around-advice methods with `@ReactiveTransactional`; thus `getContextInfo` + the underlying mutation + `getUpdatedState` + `createActivityEvent` (`activityRepository.saveReturning` at `ActivityServiceImpl:50`) all share ONE R2DBC transaction. Emit failure rolls back the actual mutation. This is the intended *audit-or-fail* semantic, but is not stated anywhere — a future caller that expects best-effort audit (e.g., a high-throughput path) would be surprised that an `ActivityRepository` write failure blocks the user-facing mutation",
    "**System-event auth-context auto-degradation.** `ActivityServiceImpl.createActivityEvent` (`:46-49`) does `authIdentityProvider.getCurrentUser().map(UserDto::username).switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, ..., null))))`. When no security context is present (ingestion thread, background scheduler), the username falls back to `null` SILENTLY — no warning logged, no metric, no fail-fast. The resulting `ActivityPojo.created_by_user_id` is NULL. Combined with the fact that `ActivityIngestionRequestProcessor.process` (`:24-32`) calls `createActivityEvents` (plural — without the @ReactiveTransactional aspect wrapper, since it does not go through the @ActivityLog AOP path), and builds events with `systemEvent=true` (`:53`), the system-event audit-trail user is permanently and silently anonymous"
  ]
- audiences: [
    "`ActivityServiceImpl` (`service/activity/ActivityServiceImpl.java:41`) — holds `private final List<ActivityHandler> handlers` (Spring autowires all `@Component` impls into the list, declaration-order-dependent), exposes three dispatch methods (`getContextInfo`, `getUpdatedInfo`(Long), `getUpdatedInfo`(List<Long>)) that each call `getActivityHandler(eventType)` and delegate",
    "`ActivityAspect` (`service/activity/ActivityAspect.java:26`) — wraps every `@ActivityLog`-annotated method via AspectJ around-advice (`:41-59` for Mono, `:61-79` for Flux); orchestrates the two-snapshot collection + diff + emit; this is the primary caller of the interface's contract semantics",
    "`ActivityIngestionRequestProcessor` (`service/ingestion/processor/ActivityIngestionRequestProcessor.java:20`) — invokes `getContextInfo` + `getUpdatedInfo(List<Long>)` directly (without the aspect) for the bulk DATA_ENTITY_CREATED path during ingestion FINALIZING phase (`:40-42`)",
    "**Concrete impl set** (18 files) — each one is the substantive owner of one or more event types. New event types added to `ActivityEventTypeDto` require a new handler; absence is detected only at runtime via the `RuntimeException` at `ActivityServiceImpl:263`",
    "platform-operator (indirectly) — Activity Feed UI reader; sees ActivityPojo rows in the activity feed at `/activity` or per-data-entity at `/dataentities/{id}/activity`. The operator's experience depends on the handler producing semantically-correct old/new states; broken handlers manifest as 'changes the user didn't make' or 'changes the user DID make that aren't logged'"
  ]

## upstream_callers

- **`ActivityServiceImpl`** (`service/activity/ActivityServiceImpl.java`) — direct call sites:
  - `getActivityHandler(eventType).getContextInfo(parameters)` at `:68`
  - `getActivityHandler(eventType).getUpdatedState(parameters, dataEntityIds)` at `:75`
  - `getActivityHandler(eventType).getUpdatedState(parameters, dataEntityId)` at `:82`
- **`ActivityAspect`** (`service/activity/ActivityAspect.java`) — indirect via `ActivityServiceImpl`:
  - `activityService.getContextInfo(activityParameters, eventType)` at `:48, 68` (Mono and Flux variants)
  - `activityService.getUpdatedInfo(activityParameters, info.getDataEntityId(), eventType)` at `:85`
- **`ActivityIngestionRequestProcessor`** (`service/ingestion/processor/ActivityIngestionRequestProcessor.java:25-31`) — direct, without aspect:
  - `activityService.getContextInfo(emptyMap(), ActivityEventTypeDto.DATA_ENTITY_CREATED)` at `:26`
  - `activityService.getUpdatedInfo(emptyMap(), request.getNewIds(), ActivityEventTypeDto.DATA_ENTITY_CREATED)` at `:27`
- **All `@ActivityLog`-annotated methods** (10 callers verified via Grep):
  - `DataEntityServiceImpl.upsertBusinessName` (`:336-338`) — BUSINESS_NAME_UPDATED
  - `DataEntityServiceImpl.upsertTags` (`:358-360`) — TAG_ASSIGNMENT_UPDATED
  - `OwnershipServiceImpl.create` (`:48-50`) — OWNERSHIP_CREATED
  - `OwnershipServiceImpl.delete` (`:77-79`) — OWNERSHIP_DELETED
  - `OwnershipServiceImpl.update` (`:100-102`) — OWNERSHIP_UPDATED
  - `DatasetFieldInternalInformationServiceImpl.updateDescription` (`:28-30`) — DATASET_FIELD_DESCRIPTION_UPDATED
  - `DatasetFieldServiceImpl.updateInternalName` (`:99-101`) — DATASET_FIELD_INTERNAL_NAME_UPDATED
  - `DatasetFieldServiceImpl.updateDatasetFieldTags` (`:119-121`) — DATASET_FIELD_TAGS_UPDATED
  - `AlertHaltConfigServiceImpl.saveAlertHaltConfig` (`:36-37`) — ALERT_HALT_CONFIG_UPDATED
  - `TermServiceImpl.linkTermWithDataEntity` (`:169-171`) — TERM_ASSIGNMENT_UPDATED
  - (plus likely 5-6 more not enumerated in the head-limit Grep result)

## downstream_side_effects

- **DB reads** (per-handler-specific, via repositories) — each concrete impl issues at least ONE DB read per `getContextInfo` call and ONE per `getUpdatedState` call, on the same data fetched twice. For TX-coupled flows under `@ReactiveTransactional`, both reads see TX-consistent data; for the ingestion path (no TX boundary on the aspect), the two reads may straddle other concurrent writes
- **NO direct DB writes from the handler** — every concrete impl is read-only. Writes happen in `activityRepository.saveReturning` (`ActivityServiceImpl:50`) AFTER the handler returns
- **NO external I/O** — no HTTP, SMTP, Slack, S3, OTLP from any handler verified (4 concrete impls + 2 abstract bases read end-to-end; pattern uniformity across the rest is high-confidence)
- **Search-vector refresh: N/A** — handlers do NOT update search-entrypoint vectors; that responsibility lives in the wrapping write services (e.g. `TagServiceImpl.updateSearchVectors`)
- **Transaction boundaries** — handlers do NOT carry `@ReactiveTransactional`; the aspect's around-advice carries it (`ActivityAspect:42, 62`). The ingestion processor's call (`:24-32`) is OUTSIDE this TX since it doesn't go through the aspect — its `Mono.zip(getContextInfo, getUpdatedInfo).map(...).flatMap(createActivityEvents)` runs under whatever TX context the ingestion runner provides (`IngestionRequestProcessor.process` is called from the ingestion finalizing phase, which itself is not wrapped in a per-request TX at the platform level — verified via `IngestionProcessingPhase.FINALIZING` enum usage)

## dependencies_semantic

- requires-feature: [
    "`ActivityCreateEvent` (`dto/activity/ActivityCreateEvent.java:8-14`) — the diff-output value object, populated by `ActivityAspect.postActivity:87-94` AFTER both snapshots return",
    "`ActivityContextInfo` (`dto/activity/ActivityContextInfo.java:8-11`) — the snapshot-output value object, populated by every `getContextInfo` impl",
    "`ActivityEventTypeDto` (`dto/activity/ActivityEventTypeDto.java:3-31`) — the dispatch key; every concrete impl owns one or more enum values via `isHandle`",
    "`ActivityParameter` annotation (`service/activity/ActivityParameter.java`, inferred from `ActivityAspect:104`) — parameter-level annotation on `@ActivityLog` methods; the aspect extracts annotated arguments into the parameters map by name",
    "`ActivityParameterNames` constants (`utils/ActivityParameterNames.java`) — string-key constants used by both the @ActivityParameter callers and the handler's `parameters.get(...)` lookups; a typo on either side fails silently at runtime"
  ]
- requires-config: [] — N/A. No Spring properties read by the interface or by inspected concrete impls. Behaviour is fully code-driven
- requires-runtime: [
    "Spring `@Component`-managed beans (all concrete impls) — autowired into `ActivityServiceImpl.handlers` (`:41`) as a `List<ActivityHandler>`; the list ordering depends on Spring's `@Component` discovery + classpath scan + `@Order` annotations (NONE used in any inspected impl)",
    "Spring AOP / AspectJ — `ActivityAspect` (`:23`) declares `@Aspect` + `@Pointcut(@annotation(ActivityLog))`; AspectJ weaving requires `spring-boot-starter-aop` on the classpath (verified via the @Profile(!integration-test) annotation excluding the aspect from integration tests)",
    "Spring Reactive Transaction Manager (`reactiveTransactionManager` bean) — required for the aspect's `@ReactiveTransactional` to acquire a TX boundary",
    "Reactor — `Mono`, `Flux`, `TupleUtils.function`, `Mono.zip`, `Mono.deferContextual` for the auth-context lookup pattern in `ActivityServiceImpl`",
    "Jackson `ObjectMapper` with `SNAKE_CASE` PropertyNamingStrategy (`JSONSerDeUtils:14-20`) — the JSON serialization that produces the `oldState`/`newState` strings. The strategy is GLOBAL to the utility; changing it would re-serialize every historical activity row's diff comparator basis and break diff equality"
  ]
- couples-to: [
    "`ActivityAspect` — the aspect IS the de facto consumer of the snapshot-differ contract; any change to the interface's method signatures requires synchronized changes to the aspect's `getContextInfo`/`getUpdatedInfo` call sites",
    "`ActivityServiceImpl.handlers` — the autowired `List<ActivityHandler>` injection is the bootstrap discovery mechanism; new handlers automatically join the list, removed handlers automatically leave. Order is not stable across Spring versions",
    "Every `@ActivityLog`-annotated method in the codebase — the `ActivityEventTypeDto` enum value passed to `@ActivityLog(event=...)` must match an `isHandle` returning true on at least ONE concrete impl, OR the runtime throws `RuntimeException(\"Can't find handler ...\")` at first invocation",
    "`ActivityIngestionRequestProcessor.process` — out-of-aspect direct consumer; its choice to call `activityService.createActivityEvents` (plural, batch) rather than going through `@ActivityLog` is the reason the multi-id `getUpdatedState` default-throw matters"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — **No test file exists for `ActivityHandler` or any concrete impl in `odd-platform-api/src/test/`**. Glob `service/activity/**/*.java` in src/test returns NOTHING. Glob `**/Activity*.java` in src/test returns only `ActivityMapperTest.java` (which exercises `ActivityMapper` row-pojo serialization, NOT the handler contract). **Handler dispatch coverage is ZERO.** The interface's snapshot-differ contract, the linear dispatch, the multi-id default-throw, the auth-context fallback, the TX-coupled emit, none of these have an automated regression test
- uncovered_behaviours: [
    "{
      \"behaviour\": \"Linear dispatch + first-match-wins — no test asserts that `getActivityHandler(eventType)` returns the EXPECTED handler for each of the 27 enum values. A future refactor that, e.g., registers two handlers responding to the same enum value would silently shadow one based on Spring bean discovery order — no test would catch the wrong-handler-runs failure.\",
      \"test_class\": \"ActivityServiceImplTest (would add `testGetActivityHandler_AllEventTypes_RoutesToExpectedImpl`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Missing-handler RuntimeException — no test asserts that `getActivityHandler(eventType)` for an enum value with no matching `isHandle` throws the documented RuntimeException with the documented message. The contract's failure mode is opaque.\",
      \"test_class\": \"ActivityServiceImplTest (would add `testGetActivityHandler_UnregisteredEventType_ThrowsRuntimeException`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Multi-id getUpdatedState default-throws — no test asserts that the 16 concrete impls inheriting the default `getUpdatedState(parameters, List<Long>)` throw `UnsupportedOperationException` with the documented message when called. A future code path that mistakenly calls the multi-id variant for, say, OWNERSHIP_UPDATED would NPE/throw with a poor message; no test guards the contract.\",
      \"test_class\": \"ActivityHandlerContractTest (would add `testMultiIdGetUpdatedState_UnsupportedHandlers_ThrowsUnsupportedOperation`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"OLD-vs-NEW state race under concurrent mutations of the SAME data entity — `getContextInfo` captures pre-mutation state; the wrapped mutation runs; `getUpdatedState` captures post-mutation state. If a SECOND concurrent @ActivityLog-annotated method also captures pre-mutation state BEFORE its mutation runs, both transactions see the pre-A state as their oldState, but one sees post-A+post-B state and the other sees only post-A state — the diff records collide.\",
      \"test_class\": \"ActivityServiceImplTest (would add `testConcurrentOwnershipUpdates_DiffIntegrity` — StepVerifier with two concurrent `OwnershipServiceImpl.update` calls on the same data entity, assert resulting ActivityPojo old/new states are pairwise consistent)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Postgres row-order non-determinism in ownership/tag list serialization — `getOwnershipsByDataEntityId` (`ReactiveOwnershipRepositoryImpl.java:130-145`) and `listDataEntityDtos` (`ReactiveTagRepositoryImpl.java:69-81`) issue queries with NO `ORDER BY` clause. The handler serializes the list result as JSON; SAME underlying owners can serialize as `[A, B]` or `[B, A]` depending on Postgres row order (which can change after VACUUM, UPDATE-storage moves, or query-plan changes). The diff `info.getOldState().equals(newState)` (`ActivityAspect:86`) is string-equality — a row-order flip emits a spurious activity event showing the same owners 'changed' to the same owners in different order.\",
      \"test_class\": \"OwnershipUpdatedActivityHandlerTest (would add `testGetContextInfo_OwnershipListOrderingStability` + integration probe; see P-018 below for the runnable form)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"System-event username silent null — `ActivityServiceImpl.createActivityEvent` (`:46-49`) uses `switchIfEmpty(Mono.defer(() -> Mono.just(... null ...)))` for empty auth context. No test asserts that ingestion-path activity events DO carry `created_by_user_id = NULL` (current observable behaviour) AND that the null is reflected appropriately in the Activity Feed UI — does the UI show 'system' or 'unknown user' or blank?\",
      \"test_class\": \"ActivityServiceImplTest (would add `testCreateActivityEvent_NoAuthContext_PersistsNullUserId`) + ActivityControllerTest (UI render of null user)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"TX-coupled emit failure rolls back the wrapping mutation — no test asserts that an `ActivityRepository.saveReturning` failure inside the aspect's @ReactiveTransactional rolls back the wrapped business mutation. A future regression that splits the TX (e.g. moves the activity emit to an @Async post-commit hook) would silently change the audit-or-fail semantic.\",
      \"test_class\": \"ActivityAspectIntegrationTest (would add `testEmitFailureRollsBackWrappedMutation` — failure-injection on the activity repository)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"oldState == newState filter — no test asserts that when a user submits a write that does NOT change the underlying state (idempotent update: same description, same name, same owners), NO ActivityPojo is created. The current behaviour (`ActivityAspect:86` filter) is correct in spirit but is not regression-protected; a refactor that, e.g., always emits would silently produce noise in the Activity Feed.\",
      \"test_class\": \"ActivityAspectIntegrationTest (would add `testIdempotentWrite_NoActivityEmitted`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Stale-read between getContextInfo and getUpdatedState within the same TX — for handlers reading the same DB row twice (e.g. `BusinessNameUpdatedActivityHandler`), under `@ReactiveTransactional` with default isolation (READ_COMMITTED in Postgres), the two reads see TX-consistent data. But if a future refactor moves the second read OUTSIDE the TX (e.g. for performance), the snapshot pair could see two committed states without the wrapped mutation in between. No test pins the within-TX read-consistency.\",
      \"test_class\": \"BusinessNameUpdatedActivityHandlerTest\",
      \"severity\": \"LOW\"
    }",
    "{
      \"behaviour\": \"JSON field-order semantic stability — Jackson with default PropertyOrder serializes fields in declaration order. A future Lombok upgrade, IDE-driven field reorder, or `@JsonPropertyOrder` introduction would silently change `oldState` strings without changing semantics, and EVERY existing in-flight diff comparator would emit a spurious activity. No test pins JSON byte-stability of `*ActivityStateDto` serialization.\",
      \"test_class\": \"JSONSerDeUtilsTest (would add fixture tests for every `*ActivityStateDto` golden-bytes assertion)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Alert-delete race in `AlertStatusUpdatedHandler` — if the alert row is deleted between `getContextInfo` (`AlertStatusUpdatedHandler:30-35`) and `getUpdatedState` (`:38-40`), the second `alertRepository.get(alertId)` returns `Mono.empty()`. The aspect's `flatMap` chain propagates the empty upstream, so the `filter(...)` (`ActivityAspect:86`) is never reached, no activity event is emitted. The handler's `oldState` was computed but discarded — a silent audit gap with no error log.\",
      \"test_class\": \"AlertStatusUpdatedHandlerTest (would add `testGetUpdatedState_AlertDeletedDuringMutation_SilentNoEmit`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"Default `oldState = \\\"{}\\\"` for CREATE handlers — `DataEntityCreatedActivityHandler:31` and `CustomGroupCreatedActivityHandler:24` hard-code `oldState = \\\"{}\\\"`. If a future bug in `getUpdatedState` ever returns `\\\"{}\\\"` for a real created entity (e.g. an empty-pojo deserialization), the diff filter blocks emission and the CREATE goes silently unrecorded.\",
      \"test_class\": \"DataEntityCreatedActivityHandlerTest (would add `testGetUpdatedState_NeverReturnsEmptyObject_OnSuccessfulCreate`)\",
      \"severity\": \"LOW\"
    }"
  ]
- test_files: [] — N/A. **No `ActivityHandlerTest.java`, no `ActivityServiceImplTest.java`, no `ActivityAspectTest.java`, no `*ActivityHandlerTest.java` for any concrete impl.** Verified by Glob: `src/test/**/*Activity*.java` returns only `ActivityMapperTest.java` (mapper unit, not handler dispatch)
- gaps: |
    Handler-tier test coverage is **zero**. The interface's contract (linear dispatch, first-match-wins, multi-id default-throw, JSON-string diff equality, snapshot-pair freshness within a TX) is unverified. **Most critically: the OLD-vs-NEW state race under concurrent mutation of the same entity is the kind of bug that produces wrong audit records under load AND is invisible to single-threaded testing.** A future refactor that, e.g., moves `getContextInfo` capture to happen AFTER `joinPoint.proceed()` (eliminating the race but changing the semantic to "compare against current-not-pre state") would compile, pass every existing test, and silently break the audit-trail's truthfulness for the entire dataset of historical activities. The Activity Feed is a user-facing accountability surface; a wrong-diff bug is a trust-destroyer.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `ActivityHandler.java` (4 lines of imports, 22 lines of interface body — verified end-to-end via Read). No `@docs` in any inspected concrete impl
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/activity"
    anchor: ""
    rationale: "The Activity Feed is a user-visible surface; if a docs page exists for the feature, it is the canonical destination. The URL is a candidate inferred from the URL-pattern convention (`/active-platform-features/{feature}`); not WebFetched in this session (WebFetch budget retained for the maintainer to verify per the framework's live-doc principle)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: not-fetched
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: "#activity-controller"
    rationale: "Activity is an OpenAPI surface (ActivityController exists per parallel sidecar). The API reference page is the canonical destination for endpoint-level documentation if present."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: not-fetched
    confidence: LOW
- doc_drift_findings: [] — N/A. No declared doc to drift-check; inferred docs are doc-gap-finder candidates

## implicit_adrs

- "**State-snapshot differ pattern over write-handler pattern**: the interface defines READ-only methods (`getContextInfo` + `getUpdatedState`); diff computation lives outside in `ActivityAspect.postActivity` (`:81-95`). The decision is intentional: keeping handlers read-only means a handler's mistake at worst produces a wrong DIFF (visible to operator), not a wrong WRITE (corrupting business state). The aspect's transactional wrap makes the audit-emit failure roll back the business mutation — `audit or nothing` semantic." — evidence: `ActivityHandler.java:9-22` + `ActivityAspect.java:41-95` + `ActivityServiceImpl.java:50` — intent_anchor: "the interface signature `Mono<ActivityContextInfo> getContextInfo(...)` and `Mono<String> getUpdatedState(...)` — both READ; no `Mono<Void> write(...)` analogue. The aspect's `@ReactiveTransactional` on the around-advice is the explicit coupling." — confidence: HIGH

- "**Linear handler-list dispatch (vs. map-based)**: `ActivityServiceImpl.getActivityHandler` (`:260-264`) iterates `List<ActivityHandler>` calling `isHandle()` rather than maintaining a `Map<ActivityEventTypeDto, ActivityHandler>`. The decision tolerates multi-event-type handlers (`DatasetFieldInformationUpdatedActivityHandler` handles 3 events) at the cost of O(N) dispatch and silent handler-order ambiguity if two handlers claim the same event." — evidence: `ActivityServiceImpl.java:260-264` + `DatasetFieldInformationUpdatedActivityHandler.java:26-30` — intent_anchor: "the abstract method `boolean isHandle(ActivityEventTypeDto)` instead of, e.g., `Set<ActivityEventTypeDto> handledEvents()` or `ActivityEventTypeDto handledEvent()` — chosen to support the `||`-chain pattern of multi-event handling that `DatasetFieldInformationUpdatedActivityHandler` demonstrates" — confidence: MEDIUM (the design is observable; the rationale is inferred — no comment explicitly defends the choice)

- "**Default-throw multi-id getUpdatedState as a 'lazy override' opt-in**: the interface provides a default `getUpdatedState(parameters, List<Long>)` that throws `UnsupportedOperationException`. Only handlers that need bulk behaviour override; others inherit the safe-fail default. The decision is explicit (the throw message names the intent: `\"not implemented yet for this handler\"`)." — evidence: `ActivityHandler.java:17-21` — intent_anchor: "`throw new UnsupportedOperationException(\"getUpdatedState for multiple ids is not implemented yet for this handler\")` — the message frames the absence as deliberate-but-temporary, opt-in-when-needed" — confidence: HIGH

- "**Snake-case JSON serialization as the audit-row stable form**: `JSONSerDeUtils:20` sets `PropertyNamingStrategies.SNAKE_CASE` globally for the Jackson ObjectMapper. The activity-feed `oldState`/`newState` strings are therefore snake_case, durable in DB, and stable across Java refactors of the `*ActivityStateDto` field names — until someone changes the strategy or per-DTO `@JsonProperty` annotations." — evidence: `utils/JSONSerDeUtils.java:14-20` — intent_anchor: "the strategy is set at the GLOBAL `ObjectMapper` configuration — applies to every diff-state serialization across all 18 handlers without per-DTO repetition; this is a deliberate centralization" — confidence: HIGH

## bugs_limitations_corner_cases

- "OLD-vs-NEW state race: two concurrent `@ActivityLog`-annotated mutations on the SAME data entity both capture `oldState = pre-mutation`, both wrapped mutations run interleaved, and `getUpdatedState` (called after each mutation completes) sees the AFTER-BOTH state. Handler A's emitted ActivityPojo records `pre-mutation → after-A+B` (wrong: A only saw its own change happen). Handler B records the same. The Activity Feed shows two activity rows each claiming credit for the other's change." — evidence: `ActivityAspect.java:41-59` + `ActivityServiceImpl.java:46-50` — severity: HIGH

- "Linear handler dispatch + Spring `@Component` ordering ambiguity: `ActivityServiceImpl.getActivityHandler` (`:261-263`) uses `stream().filter().findFirst()`. If two handlers ever respond `true` for the same `ActivityEventTypeDto`, Spring bean discovery order determines which wins, with no validation, no @Order annotation, no startup warning. A future PR adding a duplicate handler would compile, deploy, and silently route events to the wrong impl." — evidence: `ActivityServiceImpl.java:260-264` — severity: MEDIUM

- "Default multi-id `getUpdatedState` throws at first subscription, not at boot: the interface advertises `Mono<Map<Long, String>> getUpdatedState(parameters, List<Long>)` as a polymorphic method, but 16 of 18 concrete impls inherit the throwing default. A future caller (or a `@ActivityLog`-annotated batch path) dispatching to any unimplemented event type would throw `UnsupportedOperationException` at runtime with the message 'getUpdatedState for multiple ids is not implemented yet for this handler'. No boot-time validation enumerates impls × method-overrides." — evidence: `ActivityHandler.java:17-21` + `ActivityServiceImpl.java:75` + per-handler verification (only `DataEntityCreatedActivityHandler:46-49` and `DataEntityStatusUpdatedActivityHandler:51-55` override) — severity: MEDIUM

- "Postgres row-order non-determinism in ownership-list and tag-list serialization: `getOwnershipsByDataEntityId` (`ReactiveOwnershipRepositoryImpl.java:130-145`) has NO `ORDER BY`; `listDataEntityDtos` (`ReactiveTagRepositoryImpl.java:69-81`) has NO `ORDER BY` (only `groupBy(TAG.fields())`). Both produce `List<*Dto>` which the activity handler serializes as JSON. Postgres returns rows in storage order, which can change after VACUUM, UPDATE-MOVE, or query-plan changes. SAME underlying owner/tag set can serialize as `[A, B]` or `[B, A]` — and `ActivityAspect:86`'s `info.getOldState().equals(newState)` is string-equality. A row-order flip emits a spurious activity record showing the same entities 'changed'. Operator confidence in the Activity Feed degrades." — evidence: `ReactiveOwnershipRepositoryImpl.java:130-145` (no ORDER BY) + `AbstractOwnershipActivityHandler.java:19-22` (collectList → JSON) + `ReactiveTagRepositoryImpl.java:69-81` (no ORDER BY) + `TagActivityHandlerImpl.java:41-50` (list → JSON) + `ActivityAspect.java:86` (string-equality) — severity: HIGH

- "System-event username silently null: `ActivityServiceImpl.createActivityEvent` (`:46-49`) uses `authIdentityProvider.getCurrentUser().map(UserDto::username).switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, ..., null))))`. When no security context is present (ingestion thread, background scheduler), the username falls back to `null`. No `log.warn`, no metric, no `IllegalStateException` for the system-event case. The resulting `ActivityPojo.created_by_user_id` is NULL with no in-system indicator that 'this was an ingestion-driven event'. The `systemEvent` boolean exists on `ActivityCreateEvent` (`:13`) but is not used to distinguish a null-username system event from a null-username auth-context-bug user event." — evidence: `ActivityServiceImpl.java:43-52, 53-63` — severity: MEDIUM

- "Aspect/non-aspect path split for the same handler: handlers are invoked via TWO different code paths: (1) AOP-driven via `ActivityAspect` (`:41-95`) wrapped in `@ReactiveTransactional`; (2) direct via `ActivityIngestionRequestProcessor.process` (`:24-32`) without aspect, without TX wrap. The same `DataEntityCreatedActivityHandler.getUpdatedState` runs in two different transactional regimes. Behaviour drift in one regime (e.g. a future refactor adds something assuming TX-context) silently breaks the other." — evidence: `ActivityAspect.java:42, 62` + `ActivityIngestionRequestProcessor.java:24-32` — severity: LOW

- "Several event types in the enum have no concrete handler: `DATA_ENTITY_OVERVIEW_UPDATED`, `DATA_ENTITY_METADATA_UPDATED`, `DATA_ENTITY_SCHEMA_UPDATED`, `DATA_ENTITY_RELATION_UPDATED`, `CUSTOM_METADATA_CREATED`, `CUSTOM_METADATA_UPDATED`, `CUSTOM_METADATA_DELETED`, `OPEN_ALERT_RECEIVED`, `RESOLVED_ALERT_RECEIVED` — verified by reading every `isHandle` body across 18 inspected files. A future `@ActivityLog(event = DATA_ENTITY_SCHEMA_UPDATED)` would throw `RuntimeException(\"Can't find handler for event type DATA_ENTITY_SCHEMA_UPDATED\")` at first invocation. No boot-time check warns of the missing-handler set." — evidence: `dto/activity/ActivityEventTypeDto.java:3-31` (enum) + per-handler-file `isHandle` bodies + `ActivityServiceImpl.java:263` (throw) — severity: LOW

- "JSON declaration-order coupling for ActivityStateDto fields: Jackson (with no `@JsonPropertyOrder`) serializes fields in declaration order. A future Lombok upgrade, an IDE-driven 'organize fields' on any of the 16 `*ActivityStateDto` classes, or migration to records (which have a defined declaration order from the canonical constructor) — would change `oldState` JSON byte-strings without changing semantics, immediately emitting a spurious activity event for every in-flight diff against the historical fields. Pre-shift baseline diffs would no longer match post-shift state, even for unchanged entities." — evidence: `utils/JSONSerDeUtils.java:14-20` (no @JsonPropertyOrder applied) + every inspected `*ActivityStateDto` (field-list declaration order is the de-facto JSON order) — severity: MEDIUM

## security

- auth_mode_relevance: INTERNAL_ONLY — `ActivityHandler` is a service-tier dispatch interface, not on the HTTP surface. Auth mode does not directly apply; the wrapping `@ActivityLog`-annotated methods on services like `OwnershipServiceImpl` / `DataEntityServiceImpl` carry the request's auth context via Reactor's contextual lookup in `AuthIdentityProvider`. The handler runs in whatever auth-mode regime the calling chain inherits

- ingestion_filter_relevance: NO — handler methods are not HTTP. However, the `ActivityIngestionRequestProcessor.process` path is a CONSUMER of the handler interface (`:24-32`) and IS gated by `auth.ingestion.filter.enabled` (S2S filter at the ingestion controller boundary, per parallel sidecars). Ingestion-driven activity events therefore inherit the S2S boundary's posture; the handler itself is downstream and doesn't re-authenticate

- authorization_assertions: [] — N/A. Handler interface has zero `@PreAuthorize` (no annotations at all on lines 9-22 of `ActivityHandler.java`); concrete impls have zero `@PreAuthorize` (verified on 6 concrete impls). The Activity Feed's authorization model lives at the controller layer (`ActivityController`'s `/activity` endpoint, per parallel sidecar) and at the wrapping `@ActivityLog`-annotated method's own `@PreAuthorize`. Handlers themselves are unauthorized by design — they are infrastructure

- owner_scoping: N/A — handler is not data-scoped at this layer. Owner-scoping of the Activity Feed (does the user see all activities or only their owned entities' activities?) is enforced at `ActivityController` + `ReactiveActivityRepository`, NOT here. The handler reads whatever the calling mutation passes via `parameters`

- data_exposure: [
    "(via handler chain) ActivityPojo.old_state + new_state — JSON snapshots of the affected entity's pre/post state; exposed to any user who can read the Activity Feed (per `ActivityController.getActivityList` auth posture). For a description handler, this means the FULL description content (including any sensitive data the user pasted into the description) is durably logged in the `activity` table as a string. Operators are not warned that activity rows persist sensitive description content beyond the data entity's own lifecycle"
  ]

- known_security_gaps: [
    "**created_by_user_id silent NULL for system events** — `ActivityServiceImpl.createActivityEvent:46-49` silently falls back to `null` username when auth context is empty. For ingestion-driven activities (`ActivityIngestionRequestProcessor`), this is expected, but no `systemEvent=true` flag is set on the ActivityPojo at the persistence layer (the flag exists on `ActivityCreateEvent:13` but is not surfaced on the row). Operator auditing 'which user changed X?' sees NULL with no way to distinguish 'system did it via ingestion' from 'a real user wrote X but the auth context was lost due to a bug'. — evidence: ActivityServiceImpl.java:46-49 + ActivityCreateEvent.java:13 + (need to verify ActivityPojo.system_event column exists) — severity: MEDIUM",
    "**Description / business-name handlers durably persist user-supplied text** — `DescriptionUpdatedActivityHandler` (`:41-43`) serializes the internal_description string verbatim into `ActivityStateDto`, which is then JSON-serialized into `activity.old_state` / `activity.new_state` as TEXT/JSONB. A description containing PII, secrets, or accidental sensitive paste is durably logged at every change, with full content retained until DB-level deletion of activity rows (no documented retention policy). — evidence: DescriptionUpdatedActivityHandler.java:41-43 + ActivityServiceImpl.java:50 — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "`ActivityServiceImpl.getActivityHandler` (`:260-264`) — O(N) linear scan with N = 18 (concrete handler count). Runs TWICE per `@ActivityLog`-annotated method invocation (once for getContextInfo, once for getUpdatedInfo). At a sustained 100 mutations/min platform-wide (10 ownership changes, 50 description edits, 40 tag updates), that's ~3,600 isHandle calls/min — small in absolute terms but uncached. — evidence: ActivityServiceImpl.java:260-264",
    "`getContextInfo` + `getUpdatedState` per-handler DB reads — each concrete impl issues at minimum ONE DB read to capture state. For `OwnershipUpdatedActivityHandler`, that's `getOwnershipsByDataEntityId` (a 3-table JOIN: OWNERSHIP × OWNER × TITLE), called twice per ownership-change. For `DatasetFieldValuesUpdatedActivityHandler` (`:36-43, 48-50`), it's `Mono.zip` of THREE concurrent DB reads each side — six total DB roundtrips per dataset-field-value mutation. — evidence: AbstractOwnershipActivityHandler.java:19-22 + DatasetFieldValuesUpdatedActivityHandler.java:34-51",
    "JSON serialization on every state capture — Jackson `ObjectMapper.writeValueAsString` is called once per `getContextInfo` and once per `getUpdatedState`. For DTOs with embedded lists (`OwnershipActivityStateDto` list, `DatasetFieldEnumValuesActivityStateDto` list), serialization cost scales with collection size. — evidence: JSONSerDeUtils.java:56-66"
  ]

- throughput_characteristics: [
    "Single-event-per-mutation: `@ActivityLog` AOP fires one ActivityPojo per wrapped method call. The aspect doesn't batch; it doesn't debounce. A user submitting 50 rapid ownership updates produces 50 activity rows.",
    "Bulk ingestion via the multi-id path: `ActivityIngestionRequestProcessor.process` calls `getUpdatedInfo(List<Long>)` and persists via `createActivityEvents` (plural — `ActivityServiceImpl:55-63` uses `activityRepository.save(List)` for batch INSERT). This is the only batch-aware path; the multi-id default-throw blocks any future extension to other event types.",
    "Reactive Mono/Flux pipeline — non-blocking; multiple parallel `@ActivityLog` invocations on different entities scale horizontally on the WebFlux event loop without thread starvation. Within a single TX, the chain is serial."
  ]

- resource_allocation: [
    "Per-invocation memory: each captured state is held as a `String` in JSON form, allocated twice (old + new) per invocation. For a description state of, say, 10KB markdown, that's 20KB of String-on-heap per activity event for the duration of the TX. At sustained 100 events/min × 20KB, ~120MB/min throughput-allocated (rapidly garbage-collected).",
    "DB connection pool — every handler invocation requires at least ONE R2DBC connection (for the DB read); `DatasetFieldValuesUpdatedActivityHandler` requires THREE concurrent connections from the pool (`Mono.zip` of three reads) per `getContextInfo` call. R2DBC pool exhaustion under sustained activity load is a latent concern at unknown pool size (`spring.r2dbc.pool.max-size` setting not inspected here)."
  ]

- scaling_characteristics: [
    "Stateless dispatch — handlers carry no per-instance state; horizontally scale-out replicates the dispatch trivially.",
    "No advisory lock, no row lock — concurrent activity emission on the same entity from two replicas does NOT serialise; both replicas emit their own ActivityPojo. The `oldState != newState` filter (`ActivityAspect:86`) does NOT deduplicate across replicas — two replicas seeing the same pre-mutation state and emitting against the same post-mutation state produces two activity rows.",
    "No pagination on getContextInfo / getUpdatedState — for handlers reading lists (`AbstractOwnershipActivityHandler.getDataEntityOwnerships`, `TagActivityHandlerImpl.getTagsState`), the full unfiltered list is loaded into memory and JSON-serialized. A data entity with 1000 ownerships would produce a 1000-element JSON list for each diff. There is no soft cap, no warning."
  ]

- known_performance_gaps: [
    "Linear handler dispatch on every event — uncached `O(N)` filter through `List<ActivityHandler>` per `getContextInfo` + per `getUpdatedInfo` (twice per @ActivityLog method). At N=18 the constant is small, but the dispatch is on the synchronous critical path of every write. A `Map<ActivityEventTypeDto, ActivityHandler>` precomputed at bean-init time would reduce it to O(1) with the same multi-event-handler shape (a single handler reachable by multiple keys). — evidence: ActivityServiceImpl.java:260-264 — severity: LOW",
    "Twice-read DB state for handlers — `getContextInfo` reads pre-mutation state; `getUpdatedState` reads the SAME table again post-mutation. For ownership/tag handlers, this is 2× JOIN cost per audit emission. Caching the pre-mutation state in the Reactor context across the join-point would halve the DB-read cost. — evidence: AbstractOwnershipActivityHandler.java:19-22 + OwnershipUpdatedActivityHandler.java:23-33 — severity: LOW",
    "No size cap on serialized state — handlers serializing list-shaped state (ownerships, tags, terms, enum-values) have no maximum-list-size cap. A pathological data entity (e.g. one with 10,000 ownership rows accumulated via ingestion) would produce a 10,000-element JSON list for every ownership-related activity emission. — evidence: AbstractOwnershipActivityHandler.java:19-22 (no `.take(N)`) + TagActivityHandlerImpl.java:41-50 (no limit) — severity: LOW"
  ]

## stress_findings

This sidecar is emitted under Rule 9 of the file-analyser prompt. The Stress Protocol fires five categories of structural interrogation. For this node, Category B (Name-behaviour pairs) + Category E (Resource boundaries) carry the canonical drift; Category D (Auth gates) carries a partial finding; Category A (Tunables) and Category C (Orderings) are mostly absent at the interface layer (numeric tunables are downstream in concrete impls; orderings live in the repositories the impls call).

### Category B — Name-behaviour pairs

**S-B-1: The interface name "ActivityHandler" implies write-handling; the contract is read-only state snapshotting.**

- Question: a developer reading the class name `ActivityHandler` and the dispatch pattern `List<ActivityHandler>` reasonably expects this is a "handle(event)" interface — invoke method, side effect happens, done. Does the contract match the name?
- Answer (TRACE): the interface has NO write method; all four methods are read-only state observers (`isHandle` boolean, `getContextInfo` produces `Mono<ActivityContextInfo>`, `getUpdatedState` produces `Mono<String>` × 2). The actual write happens OUTSIDE the handler in `ActivityServiceImpl.createActivityEvent` (`:50`). A developer-extending-the-interface might add a new write-side concern to a concrete impl and have it discoverable only by reading the entire `ActivityAspect` flow.
- Outcome: confidence STATIC-INFERRED. The name is misleading-but-trustworthy if you read the methods. A maintainer rename to `ActivityStateSnapshotProvider` or `ActivityDiffSource` would better convey intent.

**S-B-2: Method name `isHandle` implies a boolean dispatch question; the implementation is a per-event-type filter that can match multiple event types per handler.**

- Question: does `isHandle(eventType)` promise exactly-one-handler-per-event-type? Or is it valid for two handlers to both return true?
- Answer (TRACE): the contract does NOT enforce mutual exclusivity. `DatasetFieldInformationUpdatedActivityHandler:26-30` returns true for THREE event types (DESCRIPTION/TAGS/INTERNAL_NAME) via `||` chain — this is intentional. The dispatcher uses `stream().filter().findFirst()` (`ActivityServiceImpl:262`) — silently first-wins on bean ordering. The name `isHandle` does not signal this ambiguity.
- Outcome: confidence STATIC-INFERRED. Implicit ADR S-B-2 documented above.

**S-B-3: `getUpdatedState(parameters, List<Long>)` default-throws — but is advertised as a polymorphic API.**

- Question: how many of the 18 concrete impls actually support the multi-id path? Which event types are safely batchable?
- Answer (TRACE): 2 of 18 override the default — `DataEntityCreatedActivityHandler:46-49` and `DataEntityStatusUpdatedActivityHandler:51-55`. All other 16 inherit the throwing default. The ONLY caller dispatches DATA_ENTITY_CREATED only (`ActivityIngestionRequestProcessor:25-32`). Safe-at-current-state; latent regression on any extension.
- Outcome: confidence STATIC-INFERRED. Bug-shaped (documented in bugs_limitations_corner_cases).

### Category E — Resource boundaries (idempotency, ordering, transaction, concurrency)

**S-E-1: IDEMPOTENCY — replaying the same `ActivityCreateEvent` produces TWO `ActivityPojo` rows, not one.**

- Question: if a network blip causes the client to retry an `OwnershipServiceImpl.update` call, are two ActivityPojo rows created? Is there any deduplication key?
- Answer (TRACE): no idempotency key on `ActivityCreateEvent` (`:8-14` — 5 fields, none deduplication-capable). `ActivityRepository.saveReturning` (`ActivityServiceImpl:50`) is INSERT-not-UPSERT. Two retries → two rows. The Activity Feed shows two events for one logical change. — evidence: ActivityCreateEvent.java:8-14 + ActivityServiceImpl.java:50.
- Outcome: confidence STATIC-INFERRED. Bug-shaped: a retry-storm produces a noisy audit feed.

**S-E-2: ORDERING — OLD-state capture vs. NEW-state capture race under concurrent mutations.**

- Question: if two users A and B concurrently submit `OwnershipServiceImpl.update` on the SAME data entity, what does the Activity Feed show? Are both diffs correct (showing the right A→A' and B→B' pairs)?
- Answer (TRACE): both transactions start `getContextInfo` with the same pre-mutation owners. Tx A runs its mutation, Tx B runs its mutation. Tx A's `getUpdatedState` reads post-A state; Tx B's `getUpdatedState` reads post-A+post-B state (since A committed first if B is later; under READ_COMMITTED, B sees A's commit). Both ActivityPojo rows show `pre-mutation → post-A+post-B`, with two rows attributed to A and B. — evidence: ActivityAspect.java:48-58 + ActivityServiceImpl.java:46-50.
- Outcome: confidence PROBE-NEEDED. The trace establishes the race-window structure, but the exact emitted ActivityPojo content depends on R2DBC TX isolation level + Postgres MVCC behaviour under interleaved commits. Probe-skeleton emitted: **P-019** below.

**S-E-3: TRANSACTIONAL COUPLING — emit failure rolls back business mutation.**

- Question: if `activityRepository.saveReturning` fails (e.g. DB connection lost), does the wrapped `OwnershipServiceImpl.update` roll back?
- Answer (TRACE): the aspect's around-advice is annotated `@ReactiveTransactional` (`ActivityAspect:42, 62`). The entire chain (getContextInfo → proceed → postActivity → saveReturning) runs in ONE TX. R2DBC will roll back on any reactive error in the chain. — evidence: ActivityAspect.java:42, 62 + ActivityServiceImpl.java:46-52.
- Outcome: confidence STATIC-INFERRED. This is intentional (audit-or-fail semantic, captured in implicit_adrs above) but surprising for callers expecting best-effort audit.

**S-E-4: ROW-ORDER NON-DETERMINISM — Postgres returns rows without ORDER BY; JSON-string equality is row-order-sensitive.**

- Question: for handlers serializing list-shaped state (owners, tags, terms), is the JSON output deterministic across query plans?
- Answer (TRACE): `ReactiveOwnershipRepositoryImpl.getOwnershipsByDataEntityId:130-145` has NO `ORDER BY`. `ReactiveTagRepositoryImpl.listDataEntityDtos:69-81` has NO `ORDER BY`. The `Flux<OwnershipDto>.collectList()` (`AbstractOwnershipActivityHandler:19-22`) collects in arrival order. The Jackson list serialization is in iteration order. Postgres can change row order after VACUUM, UPDATE-storage relocation, or query-plan change. — evidence: ReactiveOwnershipRepositoryImpl.java:130-145 + ReactiveTagRepositoryImpl.java:69-81 + AbstractOwnershipActivityHandler.java:19-22 + ActivityAspect.java:86 (string-equality).
- Outcome: confidence PROBE-NEEDED. The mechanism is clear; the question "does this actually flip under normal load on a production-sized DB?" requires a runtime probe. Probe-skeleton emitted: **P-018** below.

**S-E-5: SYSTEM-EVENT USERNAME — silent NULL with no observable signal.**

- Question: when an ingestion-driven activity event is emitted, what is the `ActivityPojo.created_by_user_id`?
- Answer (TRACE): the auth-context fallback at `ActivityServiceImpl.createActivityEvent:46-49` produces `username = null` when no security context is present. `ActivityIngestionRequestProcessor.process` runs on the ingestion thread → no security context → null username → ActivityPojo.created_by_user_id = NULL. The systemEvent flag exists on the ActivityCreateEvent DTO (`:13`) but its propagation to the ActivityPojo column needs verification.
- Outcome: confidence PROBE-NEEDED. Probe-skeleton emitted: **P-020** below.

**S-E-6: STALE-READ within transaction.**

- Question: under `@ReactiveTransactional` with default Postgres isolation (READ_COMMITTED), are `getContextInfo`'s DB read and `getUpdatedState`'s DB read TX-consistent — i.e. does `getContextInfo` see exactly the committed state-before-this-mutation?
- Answer (TRACE): under READ_COMMITTED, snapshots are taken per-statement, not per-transaction. `getContextInfo`'s read sees the most-recent-committed state at the moment of that statement; `getUpdatedState`'s read sees state at the moment of THAT statement — which is post-our-mutation. So `oldState` is correct (pre-our-mutation, latest-committed at capture time) and `newState` is correct (post-our-mutation). However, if a concurrent committed mutation happened to commit BETWEEN our `getContextInfo` start and our `joinPoint.proceed()` start, we'd see THEIR state as our "old", attributing their change to our diff. This is structurally S-E-2 (the OLD-vs-NEW race).
- Outcome: confidence STATIC-INFERRED. Composes with S-E-2.

### Category D — Auth gates

**S-D-1: AUTH CONTEXT PROPAGATION** — the dispatcher captures the user only in `createActivityEvent`, not in the handler.

- Question: do handler `getContextInfo` / `getUpdatedState` methods have access to the calling user's identity?
- Answer (TRACE): the handler signatures take only `Map<String, Object> parameters` and `Long dataEntityId` — no auth context. The user lookup happens in `ActivityServiceImpl.createActivityEvent` (`:46-49`) via `authIdentityProvider.getCurrentUser()`. The user is captured ONCE at the dispatcher layer; the handler is auth-agnostic by design (read-only, no per-user filtering). — evidence: ActivityHandler.java:9-22 (no Auth* parameter) + ActivityServiceImpl.java:46-49 (capture site).
- Outcome: confidence STATIC-INFERRED. By design.

**S-D-2: AUTH MODE COVERAGE** — handler runs under all four auth modes the same way.

- Question: does handler behaviour differ between DISABLED / LOGIN_FORM / OAUTH2 / LDAP?
- Answer (TRACE): handler is downstream of the auth filter; auth mode determines whether the request reached the controller at all. Once dispatched, the handler is auth-mode-agnostic. — evidence: ActivityHandler.java is not in the controller-or-filter chain.
- Outcome: confidence STATIC-INFERRED. N/A — auth mode is irrelevant at this layer.

### Category A — Tunables

**S-A-1: NO TUNABLES at the interface layer.** Verified by reading the file end-to-end: zero `@Value`, zero numeric constants, zero `application.yml`-bound properties. Tunables live in concrete impls and the wrapping service tier (e.g. ingestion batch size, activity-feed page size at the controller).
- Outcome: REFERENCE → ActivityController sidecar for page-size tunable; ActivityRepository sidecar for query-side tunables.

### Category C — Orderings

**S-C-1: NO ORDERINGS at the interface layer.** Handler does not query, paginate, or sort. The orderings that matter are in the repositories the handlers call (ownership, tag, term repositories) — all flagged in S-E-4 above.
- Outcome: REFERENCE → ReactiveOwnershipRepositoryImpl sidecar (when authored), ReactiveTagRepositoryImpl sidecar (existing), ReactiveTermRepository sidecar (when authored).

### Summary of probe emissions

- **P-018** — Ownership/tag-list row-order non-determinism produces spurious diff events (S-E-4).
- **P-019** — Concurrent OWNERSHIP_UPDATED race produces wrong attribution (S-E-2).
- **P-020** — System-event username silent NULL (S-E-5).

## sources

- understanding ← `service/activity/handler/ActivityHandler.java:9-22` + `service/activity/ActivityServiceImpl.java:260-264` (linear dispatch) + `service/activity/ActivityAspect.java:41-95` (snapshot orchestration)
- concepts.entities ← `dto/activity/ActivityEventTypeDto.java:3-31` (enum 27 values) + `dto/activity/ActivityContextInfo.java:8-11` + `dto/activity/ActivityCreateEvent.java:8-14` + Glob `service/activity/handler/*.java` (18 files)
- concepts.operations ← `service/activity/handler/ActivityHandler.java:10, 12, 14-15, 17-21` (method signatures) + per-impl bodies cited inline
- concepts.invariants ← `ActivityHandler.java:9-22` + `ActivityServiceImpl.java:260-264` + `ActivityAspect.java:86` (string-equality) + `ActivityServiceImpl.java:46-49` (auth-fallback null)
- upstream_callers.* ← `Grep '@ActivityLog\\('` over `odd-platform-api/src/main/java/.../service/*` (10 call sites enumerated)
- downstream_side_effects ← `ActivityServiceImpl.java:50` (saveReturning) + per-handler DB-read verification
- dependencies_semantic.requires-feature ← imports + usage cited inline
- dependencies_semantic.requires-runtime ← `ActivityAspect.java:23-25` (@Aspect + @Profile) + `ActivityServiceImpl.java:33-41` (@Service + final fields)
- tests_coverage_semantic.test_files ← Glob `src/test/**/Activity*.java` returns only ActivityMapperTest.java; Glob `src/test/**/service/activity/**` returns nothing
- docs_link_semantic ← N/A (no @docs annotation; inferred candidates listed not-fetched)
- implicit_adrs ← inline citations
- bugs_limitations_corner_cases.[OLD-vs-NEW race] ← `ActivityAspect.java:41-59` + `ActivityServiceImpl.java:46-50` (mechanism)
- bugs_limitations_corner_cases.[linear dispatch] ← `ActivityServiceImpl.java:260-264`
- bugs_limitations_corner_cases.[multi-id default-throw] ← `ActivityHandler.java:17-21` + override-verification per-handler
- bugs_limitations_corner_cases.[row-order non-determinism] ← `ReactiveOwnershipRepositoryImpl.java:130-145` (no ORDER BY) + `ReactiveTagRepositoryImpl.java:69-81` (no ORDER BY) + `AbstractOwnershipActivityHandler.java:19-22` (list → JSON) + `ActivityAspect.java:86` (string-eq)
- bugs_limitations_corner_cases.[system-event NULL] ← `ActivityServiceImpl.java:46-49` (switchIfEmpty null)
- bugs_limitations_corner_cases.[aspect/non-aspect split] ← `ActivityAspect.java:42, 62` (TX-wrapped) + `ActivityIngestionRequestProcessor.java:24-32` (no aspect)
- bugs_limitations_corner_cases.[missing-handler enum values] ← `ActivityEventTypeDto.java:3-31` + per-handler `isHandle` body verification
- bugs_limitations_corner_cases.[JSON declaration-order coupling] ← `JSONSerDeUtils.java:14-20`
- security.* ← `ActivityHandler.java:9-22` (no @PreAuthorize) + `ActivityServiceImpl.java:46-49` (auth boundary)
- performance.* ← `ActivityServiceImpl.java:260-264` (linear dispatch) + `AbstractOwnershipActivityHandler.java:19-22` (per-event DB reads) + `DatasetFieldValuesUpdatedActivityHandler.java:36-43` (3-zip reads)
- stress_findings.S-B-1 ← `ActivityHandler.java:9-22` (read-only methods) + `ActivityAspect.java:81-95` (diff site)
- stress_findings.S-B-2 ← `DatasetFieldInformationUpdatedActivityHandler.java:26-30` (`||` chain) + `ActivityServiceImpl.java:261-263` (first-match-wins)
- stress_findings.S-B-3 ← `ActivityHandler.java:17-21` (default throw) + override-verification (only DataEntityCreated + DataEntityStatusUpdated)
- stress_findings.S-E-1 ← `ActivityCreateEvent.java:8-14` (no dedup key) + `ActivityServiceImpl.java:50` (saveReturning INSERT)
- stress_findings.S-E-2 ← `ActivityAspect.java:48-58` (pre-mutation capture) + `ActivityServiceImpl.java:46-50` (separate TX layers) — probe P-019
- stress_findings.S-E-3 ← `ActivityAspect.java:42, 62` (@ReactiveTransactional) + `ActivityServiceImpl.java:46-52` (chained)
- stress_findings.S-E-4 ← `ReactiveOwnershipRepositoryImpl.java:130-145` (no ORDER BY) + `ReactiveTagRepositoryImpl.java:69-81` (no ORDER BY) + `ActivityAspect.java:86` (string-eq) — probe P-018
- stress_findings.S-E-5 ← `ActivityServiceImpl.java:46-49` (switchIfEmpty null) + `ActivityIngestionRequestProcessor.java:24-32` (system path) — probe P-020
- stress_findings.S-E-6 ← R2DBC + Postgres MVCC reasoning, deferred to S-E-2
- stress_findings.S-D-1 ← `ActivityHandler.java:9-22` (signature) + `ActivityServiceImpl.java:46-49` (capture site)
- stress_findings.S-D-2 ← Auth-mode irrelevance at service layer
- stress_findings.S-A-1 ← `ActivityHandler.java:1-22` (zero @Value verified)
- stress_findings.S-C-1 ← `ActivityHandler.java:9-22` (no query/order/page; references repository sidecars)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH (entity list, operation list, invariant list all from end-to-end reads of interface + 8 concrete impls + aspect + dispatcher)
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the zero-coverage claim is verified by direct Glob over `src/test/**/Activity*.java` returning only ActivityMapperTest.java)
- docs_link_semantic: LOW (no declared docs; inferred candidates not WebFetched)
- implicit_adrs: HIGH (each has intent_anchor evidence from the code itself)
- bugs_limitations_corner_cases: HIGH for items with file:line evidence (OLD/NEW race, linear dispatch, multi-id default-throw, system-event null, missing-handler enum values) and MEDIUM for items where the mechanism is clear but the operator-visible impact is inference (JSON declaration-order coupling)
- security: HIGH for the structural claims (no @PreAuthorize, INTERNAL_ONLY layer); MEDIUM for data_exposure (description content durability is structural but the operator-visible UI rendering is not verified here)
- performance: HIGH for the structural claims (linear dispatch, twice-read pattern, no list-size cap); MEDIUM for quantitative estimates (sustained throughput numbers are illustrative, not measured)
- stress_findings: HIGH for the STATIC-INFERRED findings (S-B-1, S-B-2, S-B-3, S-E-1, S-E-3, S-E-6, S-D-1, S-D-2, S-A-1, S-C-1); PROBE-NEEDED status for S-E-2, S-E-4, S-E-5 — probes P-019, P-018, P-020 emitted to lift these to PROBE-VERIFIED when the probe-runner picks them up

## Maintainer notes

(Reserved for maintainer prose preserved across refreshes; file-analyser does not write here.)

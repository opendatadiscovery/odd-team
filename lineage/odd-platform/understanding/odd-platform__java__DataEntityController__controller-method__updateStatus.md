---
node_id: "odd-platform java DataEntityController controller-method:updateStatus"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-F
---

# DataEntityController.updateStatus — semantic understanding

## understanding

Reactive HTTP handler for `PUT /api/dataentities/{data_entity_id}/statuses`: deserialises a `DataEntityStatusFormData` body carrying the target `DataEntityStatus` (one of `UNASSIGNED / DRAFT / STABLE / DEPRECATED / DELETED`) plus an optional `propagate` flag and an optional `status_switch_time`, delegates to `DataEntityService.updateStatus(dataEntityId, status)`, and returns the applied `DataEntityStatus` as `200 OK`. The controller method itself is a three-operator reactor pipeline (deserialise → invoke service → wrap response); all state-change semantics — switchable-status validation, propagation to data-entity-group members, soft-delete cascade, restore-on-undelete, and activity logging — live in `DataEntityServiceImpl.updateStatus` and `DataEntityInternalStateServiceImpl.changeStatusForDataEntities`. Status is modelled as a settable resource property (PUT on `/statuses`), not as discrete state-machine transitions (no `/deprecate`, no `/restore` peer endpoints) — the same shape `AlertController.changeAlertStatus` uses for alerts.

## concepts

- entities: [DataEntity, DataEntityStatus, DataEntityStatusFormData, DataEntityStatusEnum, DataEntityGroup]
- operations: [update-data-entity-status, propagate-status-to-group-members, schedule-status-auto-switch-to-deleted, soft-delete-data-entity, restore-deleted-data-entity]
- invariants:
  - "Body is `Mono<DataEntityStatusFormData>` — deserialisation is deferred until the reactor pipeline subscribes."
  - "The endpoint always returns 200 with the applied `DataEntityStatus`; non-2xx outcomes (400 missing-switch-time, 404 data-entity-missing) are propagated as errors from the service layer, not constructed in the controller."
  - "Switchable statuses (`DRAFT`, `DEPRECATED`) require a `status_switch_time` — request omitting it is rejected with `BadUserRequestException` mapped to `400 Bad Request`."
  - "The set of legal status values is a closed enum of five members; the OpenAPI schema does not mark `status` as required on `DataEntityStatusFormData` (`components.yaml:1126-1132`), so a body with a `null` status field is reachable and would throw NPE on `statusFormData.getStatus().getStatus()` in the service before reaching the validation guard."
  - "`propagate=true` is only honoured when the target data entity is a `DATA_ENTITY_GROUP`; for non-group entities the flag is silently ignored."
- audiences: [odd-platform-ui (entity-detail page status dropdown calls this endpoint), human operators triaging data-entity lifecycle, the in-platform `DataEntityStatusSwitchJob` writes status changes through the SAME service path but originates server-side (not via this controller method)]

## dependencies_semantic

- requires-feature:
  - "DataEntityService bean — owns the validation guard, neighbour-fetch when propagating, and delegation to the internal-state service."
  - "DataEntityInternalStateServiceImpl — owns the actual mutation, soft-delete cascade (lineage / group-relations / parent-group-relations / statistics / filled-flag), restore path, and activity-event emission."
  - "ReactiveDataEntityRepository — `get(id)`, `bulkUpdate(pojos)`, `getPojosForStatusSwitch()` (called by the scheduled job, not this method)."
  - "ReactiveGroupEntityRelationRepository — `getDEGEntitiesOddrns(groupId)` when `propagate=true` for a DEG."
  - "ActivityService + `DataEntityStatusUpdatedActivityHandler` — captures `oldState` before the mutation, emits `DATA_ENTITY_STATUS_UPDATED` events post-mutation, payload `{status, status_switch_time}` JSON-serialised."
  - "DataEntityMapper.applyStatus — projects the `DataEntityStatus` onto the persistence pojo (sets `status`, `status_switch_time`, conditionally `status_updated_at`)."
  - "DataEntityStatisticsService — adjusts the per-entity-class / per-type count rows when soft-deleting or restoring."
  - "OpenAPI-generated `DataEntityApi` interface — HTTP method, path, content-types, and parameter binding all come from the generated default method (`openapi.yaml:1019-1040`)."
- requires-config:
  - "`housekeeping.ttl.data_entity_delete_days` (default 30, `application.yml:170`) — consumed by `DataEntityHousekeepingJob` to hard-delete `DELETED` entities once `STATUS_UPDATED_AT < now - N days`. NOT consumed by this method, but defines the soft-delete window every successful `DELETED` transition opens."
  - "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — admission to this endpoint is gated by the active `SecurityWebFilterChain` (see security block below); the `DATA_ENTITY_STATUS_UPDATE` SecurityRule is wired by `AuthorizationCustomizer` only when a non-DISABLED chain is active."
- requires-runtime:
  - "Spring WebFlux (`@RestController` + reactive `Mono` pipeline)."
  - "Reactor Core (`Mono.flatMap` / `map` composition)."
  - "jOOQ + R2DBC (`ReactiveDataEntityRepository.bulkUpdate` / `lineageRepository.softDeleteLineageRelations`, etc., all reactive jOOQ queries)."
  - "ShedLock (Postgres-backed) for the paired `DataEntityStatusSwitchJob` (every 10 minutes, 9-minute lock window) — not in the request path but shares the same write path."
- coupling:
  - "Authorization: protected by `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/statuses', PUT, DATA_ENTITY_STATUS_UPDATE)` — `SecurityConstants.java:277-281`. The controller method itself has NO `@PreAuthorize`; the gate lives in `AuthorizationCustomizer` which is applied only by the LOGIN_FORM / OAUTH2 / LDAP `SecurityWebFilterChain` beans. The `DisabledAuthSecurityConfiguration` bean uses `anyExchange().permitAll()` and bypasses SECURITY_RULES entirely."
  - "Resource-scoped permission: the `DATA_ENTITY` extractor resolves `data_entity_id` from the path variable; `ReactiveResourcePermissionAuthorizationManager` then calls `permissionService.getResourcePermissionsForCurrentUser(DATA_ENTITY, dataEntityId)` and asserts `DATA_ENTITY_STATUS_UPDATE` is in the result. This means the policy framework allows per-entity grants — not just the platform-wide flag."

## tests_coverage_semantic

- covered_behaviours:
  - "End-to-end happy path UNASSIGNED → STABLE (no switch time required) via `DataEntityStatusChangeTest.statusChangeTest`, lines 36-40."
  - "End-to-end DEPRECATED with `status_switch_time` round-trips correctly (status reflects + switch_time persisted) — `DataEntityStatusChangeTest.statusChangeTest`, lines 42-48."
  - "Validation guard: DRAFT with `status_switch_time=null` returns 4xx — `DataEntityStatusChangeTest.statusChangeTest`, lines 50-51 (`changeStatusExceptionally`)."
- uncovered_behaviours:
  - "Soft-delete path (target=DELETED): no test exercises `softDeleteDataEntities` cascade — lineage / group-relation / parent-group-relation soft-deletes, statistics decrement, manually-created-DEG `MANUALLY_CREATED` unfill, attachment retention."
  - "Restore path (DELETED → STABLE / DRAFT / DEPRECATED / UNASSIGNED): no test confirms that lineage relations / group relations / parent-group relations are restored and statistics re-incremented."
  - "Propagation path: no test exercises `propagate=true` on a `DATA_ENTITY_GROUP` (the cascading status update to every member oddrn)."
  - "Group-vs-non-group propagation: no test confirms that `propagate=true` on a non-group entity is silently ignored (per `needToPropagateStatus` requiring `DATA_ENTITY_GROUP` membership)."
  - "Scheduled auto-flip-to-DELETED: no test exercises `DataEntityStatusSwitchJob` (selects entities where `status_switch_time <= now` and bulk-flips them to DELETED)."
  - "Activity-event emission: no assertion that `DATA_ENTITY_STATUS_UPDATED` events are persisted with the correct `oldState` / `newState` payloads."
  - "Concurrency: no test exercises two simultaneous PUTs against the same `dataEntityId` (last-writer-wins behaviour vs lost-update)."
  - "404 path: `dataEntityId` does not exist → `NotFoundException` from `reactiveDataEntityRepository.get(id).switchIfEmpty(...)` (`DataEntityServiceImpl.java:467`)."
  - "Authorization path: caller without `DATA_ENTITY_STATUS_UPDATE` is rejected with 403; caller with policy-scoped grant on a DIFFERENT entity is rejected on THIS entity."
  - "DISABLED-mode reachability: the endpoint accepts unauthenticated requests when `auth.type=DISABLED`."
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DataEntityStatusChangeTest.java:22-90 — the only integration test exercising this endpoint."
- gaps: |
    The single integration test covers the validation-guard happy path and the basic STABLE / DEPRECATED transitions but skips every side-effect path that makes status changes load-bearing: the soft-delete cascade, the restore path, propagation to DEG members, the scheduled auto-flip job, the activity-event payload, and authorization.

    The highest-likelihood regression sites are:
    - `DataEntityMapperImpl.applyStatus` (lines 242-253) — see `bugs_limitations_corner_cases` for the `statusUpdatedAt` ordering bug. A targeted unit test asserting `statusUpdatedAt` is bumped on real status transitions would catch this and prevent housekeeping TTL drift.
    - `DataEntityInternalStateServiceImpl.changeStatusForDataEntities` — the `if (DELETED)` branch and the restore branch are mutually exclusive paths with disjoint side effects; a refactor that consolidates them risks omitting the restore-side `lineageRepository.restoreLineageRelations` call.
    - The propagation branch in `DataEntityServiceImpl.updateStatus` (lines 469-476) fetches DEG member oddrns and concats the parent pojo via `concatWithValues` — a refactor that swaps the order risks the parent being applied twice or not at all.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/statuses"
    anchor: ""
    rationale: "The canonical feature documentation page for Data Entity Statuses — names the five lifecycle states, the soft-delete TTL, the auto-switch behaviour, the group-vs-member propagation, and the `DATA_ENTITY_STATUS_UPDATE` permission."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "The documentation describes five distinct statuses for catalogued entities:
      1. UNASSIGNED — The default state when metadata collectors ingest new entities
      2. DRAFT — 'test entity in the data source — not yet ready for downstream consumption'
      3. STABLE — Entities that are 'stable and fully operational'
      4. DEPRECATED — A warning marker for entities 'deprecated for planned removal'
      5. DELETED — Soft-deleted entities hidden from default views"

      "DELETED entities remain recoverable for 30 days by default, governed by
      the `housekeeping.ttl.data_entity_delete_days` configuration setting."

      "Operators need the `DATA_ENTITY_STATUS_UPDATE` permission to change a
      data entity's status. This permission belongs to the Data entity
      permissions group and gates status edits on the entity detail page."
  - url: "https://docs.opendatadiscovery.org/active-platform-features/activity-feed"
    anchor: ""
    rationale: "The Activity Feed page is the canonical home for the `DATA_ENTITY_STATUS_UPDATED` event payload — the audit trail this controller method emits on every successful call."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Activity-feed event listing on the local source-of-truth markdown:
      "DATA_ENTITY_STATUS_UPDATED – an entity's status changed (UNASSIGNED,
      DRAFT, STABLE, DEPRECATED, DELETED). This is the event to filter on to
      find entity deletions — there is no separate 'deleted' event type."
      (from documentation/docs/active-platform-features/activity-feed.md:35)
  - url: "https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation"
    anchor: ""
    rationale: "Use-case-flavoured doc describing the deprecation workflow a Data Engineer / Analyst follows — the human-side story behind the `STABLE → DEPRECATED → DELETED` transitions this endpoint serves."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "The deprecation use-case addresses the challenge of safely retiring
      outdated or poorly-maintained data objects while protecting downstream
      systems from failure. The recommended deprecation sequence involves:
      Identifying dependent systems and users; Communicating with stakeholders
      in advance; Providing a transition period (typically 3 months);
      Archiving and then deleting the object after notification."
- doc_drift_findings:
  - "The Data Entity Statuses page (`/features/data-discovery/statuses`) accurately documents the five-state lifecycle, the `DATA_ENTITY_STATUS_UPDATE` permission, and the soft-delete TTL config key. Code-doc agreement is HIGH at the verified commit."
  - "The Statuses doc claims `DRAFT` and `DEPRECATED` 'let operators set a time period after which the status auto-transitions to DELETED' (lines 14, 16 of the local markdown). Code matches: `DataEntityStatusDto` marks DRAFT and DEPRECATED as `isSwitchable=true` (lines 13-15 of the dto), and `DataEntityStatusSwitchJob` runs every 10 minutes scanning for `status_switch_time <= now`. No drift."
  - "The Statuses doc claims any-to-any status transitions are allowed (no state-machine restriction documented) and the code confirms this: `DataEntityServiceImpl.updateStatus` and `DataEntityInternalStateServiceImpl.changeStatusForDataEntities` impose NO transition-graph guard — `DELETED → STABLE`, `STABLE → DRAFT`, `UNASSIGNED → DELETED` are all legal. The doc's silence is consistent with the code's permissiveness; this is intentional (per the docs' 'group-vs-member' section and the restore-on-undelete logic that explicitly supports `DELETED → *`)."
  - "The Statuses doc says the soft-delete window default is 30 days and the config key is `housekeeping.ttl.data_entity_delete_days`. Verified: `application.yml:170` sets `data_entity_delete_days: 30` and `HousekeepingTTLProperties.java:11` reads it. No drift."
  - "Doc-gap candidate (out of scope for this sidecar): the page does NOT document the API endpoint surface (`PUT /api/dataentities/{id}/statuses`) nor the `propagate` request-body flag's semantics (group-only, silently ignored on non-groups). Operators using the REST API directly have no canonical doc for the propagation flag."
  - "Doc-gap candidate (out of scope): the page does not mention that the auto-flip-to-DELETED job runs on a 10-minute cadence with a 9-minute ShedLock window — operators wondering when a DRAFT/DEPRECATED entity will tip into DELETED cannot derive the precision from the docs."

## implicit_adrs

- "Data-entity status is modelled as a settable resource property (PUT on `/api/dataentities/{id}/statuses` with the target enum), not as discrete state-machine transitions exposed via dedicated endpoints (no `/deprecate`, `/delete`, `/restore`)." — evidence: DataEntityController.java:193-200 (single PUT endpoint, body is target status) + odd-platform-specification/openapi.yaml:1019-1040 (single PUT operation, no peer transition endpoints). — intent_anchor: "summary: Update status to data entity / description: Update deprecation status to data entity" (openapi.yaml:1021-1022 — operation summary frames it as a setter). — confidence: HIGH
- "The set of legal data-entity statuses is a closed five-member enum, not an open string — clients cannot introduce new states without an OpenAPI + DTO change." — evidence: DataEntityStatusEnum.java:24-34 (generated enum with five members) + DataEntityStatusDto.java:11-27 (server-side enum with `isSwitchable` flag) + components.yaml:802-820 (OpenAPI schema closed enum). — intent_anchor: "UNASSIGNED, DRAFT, STABLE, DEPRECATED, DELETED" (the five-member closure is repeated identically in three places). — confidence: HIGH
- "Switchable statuses (`DRAFT`, `DEPRECATED`) encode their auto-transition-to-DELETED intent via an `isSwitchable` boolean on `DataEntityStatusDto`, not via configuration or runtime metadata — the rule that DRAFT and DEPRECATED auto-flip is baked into the enum's structure." — evidence: DataEntityStatusDto.java:12-16 (`DRAFT(2, true)` / `DEPRECATED(4, true)` — the second constructor arg IS the `isSwitchable` flag) + DataEntityServiceImpl.java:462-465 (`isSwitchableStatus(status) && status.getStatusSwitchTime() == null` → BadUserRequestException). — intent_anchor: "DRAFT(2, true), STABLE(3, false), DEPRECATED(4, true), DELETED(5, false)" (DataEntityStatusDto.java:13-16 — the structural flag enforcing the auto-flip distinction). — confidence: HIGH
- "Soft-delete is the platform's deletion model — `DELETED` is a state, not a row removal. Hard deletion is deferred to the `DataEntityHousekeepingJob` after the TTL window, intentionally separating user intent (status flip) from physical purge." — evidence: DataEntityInternalStateServiceImpl.java:78-98 (DELETED branch calls `softDeleteDataEntities`, not a row delete) + DataEntityHousekeepingJob.java:73-82 (the TTL-driven hard-delete path runs in a separate Spring-scheduled job). — intent_anchor: the method name `softDeleteDataEntities` (DataEntityInternalStateServiceImpl.java:106) is the convention. — confidence: HIGH
- "Status transitions are recorded as `DATA_ENTITY_STATUS_UPDATED` activity events with explicit `oldState` and `newState` payloads, captured at the service layer (not via a `@ActivityLog` AOP intercept, unlike most other mutation paths in this service). The handler emits the (status, status_switch_time) tuple JSON-serialised for both states." — evidence: DataEntityInternalStateServiceImpl.java:155-182 (programmatic activity-event construction with `oldState` captured before the mutation and `newState` resolved after) + DataEntityStatusUpdatedActivityHandler.java:39-63 (the handler's `getState(pojo)` JSON-serialises the tuple). — intent_anchor: "Programmatic event emission (vs. AOP) is required here because the mutation is bulk (`bulkUpdate(pojos)`) and the `oldState` must be captured per-pojo before the in-place mutation; the AOP intercept's single-resource shape (`@ActivityParameter(...)` on a method arg) does not fit." — confidence: HIGH
- "When the target entity is a Data Entity Group, the `propagate` flag is honoured by re-fetching all group members via `getDEGEntitiesOddrns` and applying the status to each plus the parent — `propagate` is intentionally a per-call opt-in, not a configuration default." — evidence: DataEntityServiceImpl.java:680-684 (`needToPropagateStatus` requires `Boolean.TRUE.equals(propagate)` AND `DATA_ENTITY_GROUP` class membership) + DataEntityServiceImpl.java:468-476 (the propagation branch). — intent_anchor: "the explicit `Boolean.TRUE.equals(...)` null-safe check encodes the intent that `null` and `false` are equivalent (do not propagate)." — confidence: HIGH

## bugs_limitations_corner_cases

- "`DataEntityMapperImpl.applyStatus` sets `pojo.setStatus(statusDto.getId())` on line 247 BEFORE the `if (statusDto.getId() != pojo.getStatus())` check on line 249 — at the point of the check, `pojo.getStatus()` already equals `statusDto.getId()`, so the condition is always false and `statusUpdatedAt` is NEVER set on any status transition. The housekeeping TTL relies on `STATUS_UPDATED_AT` to compute the soft-delete window (`DataEntityHousekeepingJob.java:73`: `STATUS_UPDATED_AT.lessOrEqual(now - N days)`); if `status_updated_at` is `null` for entities that have transitioned to DELETED via this code path, the housekeeping query's `lessOrEqual` predicate against a NULL column evaluates to NULL (≈ false in SQL three-valued logic) — those entities would never be hard-deleted. This is a HIGH-severity bug: it both breaks the documented 30-day retention window AND silently defeats the soft-delete cascade. The fix is trivial (capture the prior status before mutating, or use a boolean local before `setStatus`); the bug is present at the verified commit `ede5d277`." — evidence: DataEntityMapperImpl.java:242-253 (the ordering inversion) + DataEntityHousekeepingJob.java:73-82 (the TTL query that depends on the column). — severity: HIGH
- "No state-machine guard: any-to-any status transitions are allowed (UNASSIGNED → DELETED, DELETED → DRAFT, DRAFT → STABLE, etc.). The Statuses doc is silent on whether transitions are restricted, and the code is permissive. Restore-from-DELETED is intentional (the live doc explicitly documents the soft-delete window allowing return to a visible state), but transitions like `UNASSIGNED → DELETED` skipping DRAFT / DEPRECATED bypass the auto-switch-time intent entirely and leave no audit signal that this was unusual." — evidence: DataEntityServiceImpl.java:459-481 (no transition-graph check) + DataEntityInternalStateServiceImpl.java:75-98 (no source-state guard before applying). — severity: LOW (intentional permissiveness per Statuses doc, but operators reading the docs cannot derive that any-to-any is supported; the doc lists `STABLE` and `UNASSIGNED` as 'set by operator' without naming what set-transitions are reachable).
- "No optimistic locking on `DataEntityPojo` — concurrent PUTs to the same `dataEntityId` race on last-writer-wins. Two simultaneous operators each issuing a DEPRECATED + status_switch_time on the same entity can result in one of their `status_switch_time` values being silently overwritten. The activity log captures both events with their respective `oldState` snapshots taken BEFORE the parallel mutation began — so the audit shows two transitions FROM the same `oldState` to (potentially) different `newState` values, which can mislead a forensic reader." — evidence: DataEntityInternalStateServiceImpl.java:75-98 (no `@Version` annotation on the entity, no `WHERE status = oldStatus AND status_updated_at = oldTimestamp` guard on the update) + DataEntityServiceImpl.java:466-480 (no lock acquisition before the get/update sequence). — severity: MEDIUM
- "No bulk-update endpoint: the operation accepts a single `data_entity_id` from the path. Operators deprecating a batch (e.g. after a deploy retires a pipeline) issue N PUT requests. The propagation flag only helps when the batch is exactly a DEG's members; arbitrary multi-entity batches require N round-trips." — evidence: DataEntityController.java:193-200 (single `dataEntityId` path variable) + openapi.yaml:1019-1040 (no peer batch endpoint). — severity: LOW
- "The activity-event emission runs unconditionally — even when the status doesn't change (e.g. `STABLE → STABLE` writes an event with identical `oldState` and `newState`). Activity-table growth is proportional to call count, not state-change count." — evidence: DataEntityInternalStateServiceImpl.java:75-98 (no `if (newStatus == currentStatus) skipLog` short-circuit). — severity: LOW
- "Body-validation gap: `DataEntityStatusFormData.status` is NOT marked `required` in the OpenAPI schema (`components.yaml:1126-1132` has no `required:` block) but `DataEntityServiceImpl.updateStatus` does `statusFormData.getStatus().getStatus()` unconditionally (line 461). A body `{}` reaches the service and throws NPE — surfaced to the client as a generic 500, not the validation-error 400 the user-facing flow expects." — evidence: components.yaml:1126-1132 + DataEntityServiceImpl.java:461. — severity: MEDIUM
- "Bulk soft-delete via propagation: when `propagate=true` is applied to a DEG whose members include other groups (DEG-of-DEGs), the implementation calls `getDEGEntitiesOddrns(dataEntityId)` ONCE and processes the result — there is no recursive descent. Operators expecting cascading propagation through nested groups will get only the immediate children." — evidence: DataEntityServiceImpl.java:470 (`getDEGEntitiesOddrns(dataEntityId)` is non-recursive — single-hop) + ReactiveGroupEntityRelationRepository (signature confirms single-level). — severity: LOW (semantic limitation; documented neither in code-comments nor in the Statuses doc).
- "DISABLED-mode reachability: under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` uses `anyExchange().permitAll()` and SECURITY_RULES is not applied. Any unauthenticated caller able to reach the application port can issue PUT /api/dataentities/{id}/statuses with target=DELETED on any entity. The Statuses doc says 'Operators need the DATA_ENTITY_STATUS_UPDATE permission' — this is true only when auth.type is LOGIN_FORM / OAUTH2 / LDAP. Per the live security docs DISABLED is dev-only, but a production deployment that mis-sets auth.type exposes wholesale data-entity soft-deletion to anonymous traffic — and since the soft-delete cascades to lineage, group-relations, and statistics, the blast radius is wide." — evidence: DisabledAuthSecurityConfiguration.java:14-17 (`anyExchange().permitAll()`) + SecurityConstants.java:277-281 (the DATA_ENTITY_STATUS_UPDATE rule that DISABLED bypasses). — severity: HIGH

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP
  - "PUT on the UI/API surface (`/api/dataentities/{id}/statuses`) — protected by `SecurityConstants.SECURITY_RULES` when the active chain is LoginFormSecurityConfiguration / OAuthSecurityConfiguration / LDAPSecurityConfiguration. Under DISABLED, the chain uses `anyExchange().permitAll()` and SECURITY_RULES is NOT consulted." — evidence: DataEntityController.java:67-70 (@RestController, no method-level annotations) + SecurityConstants.java:277-281 (the SECURITY_RULES entry) + DisabledAuthSecurityConfiguration.java:14-17 (the DISABLED bypass).
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. The `IngestionDataEntitiesFilter` only registers on `POST /ingestion/entities`; PUT `/api/dataentities/{id}/statuses` is outside that path matcher."
- authorization_assertions:
  - "`SECURITY_RULES` entry: `new SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/statuses', PUT, DATA_ENTITY_STATUS_UPDATE)` — declarative rule wired by `AuthorizationCustomizer` into the SecurityWebFilterChain when auth.type ∈ {LOGIN_FORM, OAUTH2, LDAP}. Resolution path: `ReactiveResourcePermissionAuthorizationManager.check` → `ResourceExtractor` resolves `data_entity_id` from the URI → `permissionService.getResourcePermissionsForCurrentUser(DATA_ENTITY, dataEntityId)` → matches against `DATA_ENTITY_STATUS_UPDATE`. The permission is resource-scoped: policies can grant `DATA_ENTITY_STATUS_UPDATE` on a per-entity basis." — evidence: SecurityConstants.java:277-281 + ReactiveResourcePermissionAuthorizationManager.java:22-32 + ReactiveAuthorizationManagerFactory.java:46 (`DATA_ENTITY → DATA_ENTITY_ID`).
- owner_scoping: "N/A — code is not data-scoped at the controller-method layer; scoping is delegated to the Policy framework. The `DATA_ENTITY` resource context permits the maintainer to write a policy granting `DATA_ENTITY_STATUS_UPDATE` only on entities the user is an owner of (via Policy schema), but the controller method itself does not check `authIdentityProvider.fetchAssociatedOwner()` — it relies on the authorization manager to have rejected the request before it reaches the handler."
- data_exposure:
  - "Successful PUT response body: `DataEntityStatus` payload (`status`, `status_switch_time`) → caller with `DATA_ENTITY_STATUS_UPDATE` permission on that entity (under LOGIN_FORM/OAUTH2/LDAP); any caller able to reach the port under DISABLED." — evidence: DataEntityController.java:194-200 (response shape) + DataEntityServiceImpl.java:480 (`.thenReturn(statusFormData.getStatus())` — echoes the requested status).
  - "Audit-trail emission: `DATA_ENTITY_STATUS_UPDATED` activity event persisted with `data_entity_id`, `oldState` (JSON `{status, status_switch_time}` snapshot), `newState` (same shape, post-mutation). Read-back via `/api/dataentities/{id}/activity` (`GET getDataEntityActivity`) exposes who changed what and when, gated by read-side authorization (separate audit surface)." — evidence: DataEntityInternalStateServiceImpl.java:164-182 (event construction) + DataEntityStatusUpdatedActivityHandler.java:39-63 (state JSON shape).
- known_security_gaps:
  - "Under `auth.type=DISABLED`, the endpoint is reachable by ANY caller who can reach the application port. `DisabledAuthSecurityConfiguration.securityWebFilterChainDisabled` uses `anyExchange().permitAll()`, completely bypassing the SECURITY_RULES table and the resource-scoped permission check. Combined with the soft-delete cascade (lineage / group-relations / statistics all updated atomically with the entity), an anonymous caller can effectively wipe the catalog. The live docs frame DISABLED as dev-only, but the platform itself does NOT fail-closed on this path — there is no `@PreAuthorize` defensive annotation and no runtime check inside the service." — evidence: DisabledAuthSecurityConfiguration.java:9-19 (`@ConditionalOnProperty(value = 'auth.type', havingValue = 'DISABLED')` + `anyExchange().permitAll()`) + SecurityConstants.java:277-281 (the rule the DISABLED chain bypasses) + DataEntityInternalStateServiceImpl.java:106-129 (the soft-delete cascade with no caller-identity check). — severity: HIGH
  - "Activity-event emission depends on the service-layer code path: programmatic emission via `logStatusChangeEvents(oldStates, ids)` (DataEntityInternalStateServiceImpl.java:164-169). If a future refactor calls `dataEntityRepository.bulkUpdate(updatedPojos)` directly (bypassing the internal-state service), the audit row silently disappears. The activity capture is NOT a `@ActivityLog` AOP annotation on the repository / mapper layer — it's a service-method invariant that the next maintainer must preserve." — evidence: DataEntityInternalStateServiceImpl.java:73-98 (programmatic emission inside `changeStatusForDataEntities`) + absence of `@ActivityLog` on the repository class. — severity: MEDIUM
  - "Body-shape weakness: `DataEntityStatusFormData.status` is not marked required by the OpenAPI schema; a body `{}` reaches the service before the validation guard runs, surfacing as NPE → 500, not 400. An authenticated attacker probing the endpoint can fingerprint that the API rejects malformed bodies with a stack-trace shape rather than a validation error — minor information disclosure." — evidence: components.yaml:1126-1132 (no `required:` on `DataEntityStatusFormData`) + DataEntityServiceImpl.java:461 (unguarded `.getStatus().getStatus()`). — severity: LOW

## performance

- hot_paths:
  - "Single-item PUT on the UI/API surface — typically called from the entity-detail page status dropdown, not a hot path on a per-request basis. The downstream effect IS expensive: a `DELETED` transition runs the soft-delete cascade (lineage relations, group relations, parent-group relations, statistics, manually-created-DEG fill-flag) in a single reactive transaction." — evidence: DataEntityController.java:193-200 + DataEntityInternalStateServiceImpl.java:106-129 (the cascade).
  - "Propagation amplification: when `propagate=true` on a DEG, the work multiplies by the group's child count — the `bulkUpdate` writes N+1 pojo rows (N children + the parent) and the cascade re-runs lineage / group-relation soft-deletes for every child oddrn." — evidence: DataEntityServiceImpl.java:468-476 (the propagation branch) + DataEntityInternalStateServiceImpl.java:75-98 (the per-pojo cascade).
- throughput_characteristics:
  - "Single-item PUT per status change — no bulk-update endpoint on the `DataEntityApi` surface."
  - "Reactive `Mono` signature — non-blocking on the request thread, but the work is still per-call: 1 DB read (existence + neighbour resolution if propagating), 1 batched DB write (bulkUpdate), the soft-delete cascade reads/writes for DELETED transitions (or the restore cascade for non-DELETED transitions from a DELETED state), 1 DB read of post-mutation pojos (for activity newState resolution), 1 activity-row INSERT per affected entity."
  - "The scheduled `DataEntityStatusSwitchJob` uses the same write path: it runs every 10 minutes (fixed-rate), holds a 9-minute ShedLock, and bulk-flips ALL entities whose `status_switch_time <= now`. A large backlog of DRAFT / DEPRECATED entities whose switch times all expire in the same window will burst through this single job invocation — no batching cap, no per-tick limit." — evidence: DataEntityStatusSwitchJob.java:21-31 + ReactiveDataEntityRepositoryImpl.java:256-262 (the `getPojosForStatusSwitch` query returns ALL eligible pojos, no LIMIT).
- resource_allocation:
  - "Per-call cost: 1 DB read for the target pojo (`reactiveDataEntityRepository.get`), 0-1 DB read for DEG member oddrns when propagating, 0-N DB reads for member pojos (`listByOddrns`), 1 batched DB write (`bulkUpdate`), the cascade adds 3-7 more DB writes depending on the transition direction (soft-delete: lineage + group-relations + parent-group-relations + statistics + filled-flag-unfill; restore: same set but inserts/restores), 1 activity-row INSERT per affected entity. The whole sequence runs on the same `@ReactiveTransactional` context (declared on `changeStatusForDataEntities`)." — evidence: DataEntityInternalStateServiceImpl.java:73-77 (@ReactiveTransactional + Mono<Void> signature) + the cascade methods at lines 106-153.
  - "No outbound HTTP, no in-memory accumulation of large structures, no streaming. Memory pressure is bounded by the DEG member-count when propagating (loaded into a list via `collectList` before bulk-update)."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally."
  - "ShedLock-guarded scheduled job (`DataEntityStatusSwitchJob`): only one instance at a time runs the auto-flip; safe to scale the platform horizontally. The lock name is `statusSwitchJob` (DataEntityStatusSwitchJob.java:22) — distinct from other jobs."
  - "No row-level lock or advisory lock on the user-initiated path — two simultaneous PUTs to the same `dataEntityId` race (last-writer-wins). The cascade's individual table writes acquire their own row locks but the entity-status mutation has no `SELECT … FOR UPDATE` or `@Version` annotation."
  - "No pagination on this endpoint (single-item or DEG-scoped). The DEG propagation branch is unbounded by member-count: a DEG with 10K members issues a 10K-row `bulkUpdate` plus a 10K-element cascade in a single transaction — long-running, high-lock-fanout."
- known_performance_gaps:
  - "No bulk-status-change endpoint covering arbitrary entity lists — operators with cross-DEG batches issue N round-trips. The propagation flag is a partial mitigation but only when the batch is exactly a DEG's children." — evidence: DataEntityController.java:193-200 + openapi.yaml:1019-1040 (no peer batch endpoint). — severity: LOW
  - "DEG propagation transaction has no member-count cap. A 10K-member DEG transition runs the full cascade for every child inside one `@ReactiveTransactional` boundary — Postgres lock acquisition fan-out scales linearly with member count and can stall concurrent reads on those tables." — evidence: DataEntityServiceImpl.java:470 (no `.take(N)`) + DataEntityInternalStateServiceImpl.java:75-98 (no per-element transaction split). — severity: MEDIUM
  - "Scheduled auto-flip job has no per-tick batch cap. `getPojosForStatusSwitch` returns ALL eligible pojos and the cascade runs for the entire list in one tick. A DRAFT entity created 30 days ago with switch_time=today, multiplied by, say, 5K such entities all expiring in the same hour, will run a single transaction processing 5K pojos and their cascades — potentially exceeding the 9-minute lock window." — evidence: ReactiveDataEntityRepositoryImpl.java:256-262 (no LIMIT in the query) + DataEntityStatusSwitchJob.java:21-30 (no chunking). — severity: MEDIUM
  - "Activity-event emission runs unconditionally regardless of whether the status actually changed (e.g. `STABLE → STABLE` still writes an event with identical oldState/newState). Activity-table growth is proportional to call count, not state-change count." — evidence: DataEntityInternalStateServiceImpl.java:75-98 (no early-return for no-op transitions). — severity: LOW

## sources

- understanding ← DataEntityController.java:193-200 + DataEntityServiceImpl.java:459-481 + DataEntityInternalStateServiceImpl.java:73-98
- concepts.entities.DataEntity ← DataEntityController.java:9
- concepts.entities.DataEntityStatus ← DataEntityStatus.java (generated, components.yaml:811-820)
- concepts.entities.DataEntityStatusFormData ← DataEntityStatusFormData.java:23 + components.yaml:1126-1132
- concepts.entities.DataEntityStatusEnum ← DataEntityStatusEnum.java:24-34
- concepts.entities.DataEntityGroup ← DataEntityServiceImpl.java:683 + DataEntityStatusDto.java:11-27
- concepts.invariants.[0] ← DataEntityController.java:195
- concepts.invariants.[1] ← DataEntityController.java:197-199 + DataEntityServiceImpl.java:462-465
- concepts.invariants.[2] ← DataEntityServiceImpl.java:462-465 + DataEntityStatusDto.java:13-16 (isSwitchable for DRAFT/DEPRECATED)
- concepts.invariants.[3] ← components.yaml:1126-1132 (no required block) + DataEntityServiceImpl.java:461
- concepts.invariants.[4] ← DataEntityServiceImpl.java:680-684 (needToPropagateStatus)
- dependencies_semantic.requires-feature.[0] ← DataEntityController.java:53 + DataEntityController.java:71 (private final DataEntityService)
- dependencies_semantic.requires-feature.[1] ← DataEntityInternalStateServiceImpl.java:73-98 (changeStatusForDataEntities)
- dependencies_semantic.requires-feature.[2] ← DataEntityServiceImpl.java:466-476 + ReactiveDataEntityRepositoryImpl.java:256-262 (getPojosForStatusSwitch)
- dependencies_semantic.requires-feature.[3] ← DataEntityServiceImpl.java:470 (getDEGEntitiesOddrns)
- dependencies_semantic.requires-feature.[4] ← DataEntityInternalStateServiceImpl.java:155-182 + DataEntityStatusUpdatedActivityHandler.java:25-63
- dependencies_semantic.requires-feature.[5] ← DataEntityMapperImpl.java:242-253 (applyStatus)
- dependencies_semantic.requires-feature.[6] ← DataEntityInternalStateServiceImpl.java:117-118 + .135-143 (statistics updates)
- dependencies_semantic.requires-feature.[7] ← openapi.yaml:1019-1040 + DataEntityController.java:9 (`implements DataEntityApi`)
- dependencies_semantic.requires-config.[0] ← application.yml:170 + HousekeepingTTLProperties.java:11 + DataEntityHousekeepingJob.java:73 (the TTL consumer)
- dependencies_semantic.requires-config.[1] ← SecurityConstants.java:277-281 + DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:20-32
- dependencies_semantic.requires-runtime.[0] ← DataEntityController.java:62 (@RestController) + DataEntityController.java:65 (Mono import)
- dependencies_semantic.coupling.[0] ← SecurityConstants.java:277-281 + AuthorizationCustomizer.java:24-28
- dependencies_semantic.coupling.[1] ← ReactiveAuthorizationManagerFactory.java:46 + ReactiveResourcePermissionAuthorizationManager.java:22-32
- tests_coverage_semantic.test_files.[0] ← DataEntityStatusChangeTest.java:22-90 (verified via Read of the file)
- tests_coverage_semantic.covered_behaviours ← DataEntityStatusChangeTest.java:36-51
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/statuses (status 200, 2026-05-12) + local SoT documentation/docs/data-discovery/statuses.md:9-29
- docs_link_semantic.inferred_docs.[1] ← documentation/docs/active-platform-features/activity-feed.md:35 (local source-of-truth — live URL not separately re-verified in this session; the local markdown is the SoT for the published page)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation (status 200, 2026-05-12)
- implicit_adrs.[0] ← DataEntityController.java:193-200 + openapi.yaml:1019-1040
- implicit_adrs.[1] ← DataEntityStatusEnum.java:24-34 + DataEntityStatusDto.java:11-27 + components.yaml:802-820
- implicit_adrs.[2] ← DataEntityStatusDto.java:12-16 + DataEntityServiceImpl.java:462-465
- implicit_adrs.[3] ← DataEntityInternalStateServiceImpl.java:78-98 + DataEntityHousekeepingJob.java:67-82
- implicit_adrs.[4] ← DataEntityInternalStateServiceImpl.java:155-182 + DataEntityStatusUpdatedActivityHandler.java:25-63
- implicit_adrs.[5] ← DataEntityServiceImpl.java:680-684 + DataEntityServiceImpl.java:468-476
- bugs_limitations_corner_cases.[0] ← DataEntityMapperImpl.java:242-253 + DataEntityHousekeepingJob.java:73-82
- bugs_limitations_corner_cases.[1] ← DataEntityServiceImpl.java:459-481 + DataEntityInternalStateServiceImpl.java:73-98
- bugs_limitations_corner_cases.[2] ← DataEntityInternalStateServiceImpl.java:73-98 + DataEntityServiceImpl.java:466-480
- bugs_limitations_corner_cases.[3] ← DataEntityController.java:193-200 + openapi.yaml:1019-1040
- bugs_limitations_corner_cases.[4] ← DataEntityInternalStateServiceImpl.java:75-98
- bugs_limitations_corner_cases.[5] ← components.yaml:1126-1132 + DataEntityServiceImpl.java:461
- bugs_limitations_corner_cases.[6] ← DataEntityServiceImpl.java:470 (single getDEGEntitiesOddrns call, no recursion)
- bugs_limitations_corner_cases.[7] ← DisabledAuthSecurityConfiguration.java:14-17 + SecurityConstants.java:277-281
- security.auth_mode_relevance ← DataEntityController.java:67-70 + SecurityConstants.java:277-281 + DisabledAuthSecurityConfiguration.java:14-17
- security.ingestion_filter_relevance ← DataEntityController.java:193-200 (path is /api/dataentities/..., not /ingestion/entities)
- security.authorization_assertions.[0] ← SecurityConstants.java:277-281 + ReactiveResourcePermissionAuthorizationManager.java:22-32 + ReactiveAuthorizationManagerFactory.java:46
- security.data_exposure.[0] ← DataEntityController.java:194-200 + DataEntityServiceImpl.java:480
- security.data_exposure.[1] ← DataEntityInternalStateServiceImpl.java:164-182 + DataEntityStatusUpdatedActivityHandler.java:39-63
- security.known_security_gaps.[0] ← DisabledAuthSecurityConfiguration.java:9-19 + SecurityConstants.java:277-281 + DataEntityInternalStateServiceImpl.java:106-129
- security.known_security_gaps.[1] ← DataEntityInternalStateServiceImpl.java:73-98 + DataEntityInternalStateServiceImpl.java:164-169
- security.known_security_gaps.[2] ← components.yaml:1126-1132 + DataEntityServiceImpl.java:461
- performance.hot_paths.[0] ← DataEntityController.java:193-200 + DataEntityInternalStateServiceImpl.java:106-129
- performance.hot_paths.[1] ← DataEntityServiceImpl.java:468-476 + DataEntityInternalStateServiceImpl.java:75-98
- performance.throughput_characteristics ← DataEntityController.java:193-200 + DataEntityServiceImpl.java:466-480 + DataEntityStatusSwitchJob.java:21-31 + ReactiveDataEntityRepositoryImpl.java:256-262
- performance.resource_allocation ← DataEntityInternalStateServiceImpl.java:73-77 + .106-153
- performance.scaling_characteristics ← DataEntityStatusSwitchJob.java:22 (`@SchedulerLock(name = 'statusSwitchJob')`) + DataEntityInternalStateServiceImpl.java:75-98 (no version field)
- performance.known_performance_gaps.[0] ← DataEntityController.java:193-200 + openapi.yaml:1019-1040
- performance.known_performance_gaps.[1] ← DataEntityServiceImpl.java:470 + DataEntityInternalStateServiceImpl.java:75-98
- performance.known_performance_gaps.[2] ← ReactiveDataEntityRepositoryImpl.java:256-262 + DataEntityStatusSwitchJob.java:21-30
- performance.known_performance_gaps.[3] ← DataEntityInternalStateServiceImpl.java:75-98

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM

## Maintainer notes

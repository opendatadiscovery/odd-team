---
node_id: "odd-platform java ActivityController controller-class:ActivityController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-T01
related_features:
  - F-021   # P-07:F-003 Activity Feed Audit-Trail Surface (THIS controller IS the read surface)
  - F-006   # P-09:F-001 RBAC — audit-silence pattern (the 9-sidecar pattern; controller surfaces what the schema-rooted scope can record)
  - F-010   # P-08:F-002 Housekeeping / partition rotation (this controller READS what the partition manager paves)
  - F-007   # P-07:F-001 Alerting — 4 of 27 event types originate here (OPEN/RESOLVED/STATUS/HALT_CONFIG)
related_pillar_features:
  - P-07:F-003    # Activity Feed sub-feature of Active Platform Features (the read surface this controller serves)
  - P-09:F-001    # RBAC (audit-silence asymmetry — controller-side confirmation: NO @PreAuthorize, NO entry in SecurityConstants)
  - P-08:F-002    # Housekeeping TTL Enforcement (partition rotation interaction)
related_concepts:
  - activity-table-partitioning
  - audit-log-presence-asymmetry-2-tier-audit-story
  - no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f
  - provider-null-cross-mode-bleed
  - read-collaborative-cross-owner-enumeration-posture
coherence_notes:
  - kind: strengthens
    target: F-021
    note: |
      THIS controller IS F-021's read entry-point. The class-level sidecar adds the
      pillar-level framing that the per-method sidecar (getActivity) anchors to a single
      endpoint. The 2-method controller surface (GET /api/activity + GET /api/activity/counts)
      is the COMPLETE read surface for the global Activity Feed — there is no admin
      variant, no bulk export, no streaming alternative, and no programmatic API-reference
      page (WebFetch 2026-05-20: /developer-guides/api-reference/activity → 404). The
      filter shape on the controller mirrors the doc's 7 facets (Calendar→begin/end_date,
      Datasource→datasource_id, Namespace→namespace_id, Event type→event_type, Tag→tag_ids,
      Owner→owner_ids, User→user_ids) PLUS three undocumented public-API parameters: `type`
      (ActivityType view-mode dispatch — the MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL tabs
      from the UI), `last_event_id` + `last_event_date_time` (cursor pagination), and `size`
      (page size with no upper bound).
  - kind: strengthens
    target: F-006
    note: |
      F-006's audit-silence pattern reaches a 9-sidecar count (PolicyController +
      RoleController + OwnerController × 3 methods + PolicyServiceImpl + RoleServiceImpl
      + OwnerServiceImpl + ReactiveActivityRepositoryImpl batch-R), and the
      ActivityController CLASS sidecar CONFIRMS the controller-side limb: there is NO
      `@PreAuthorize` on the class, NO `@PreAuthorize` on either method (line 23, 43),
      NO entry for `/api/activity` or `/api/activity/counts` in
      `SecurityConstants.SECURITY_RULES` (verified: zero matches across the 357-line
      file), and the generated `ActivityApi` interface carries no authorization
      annotations either. The read surface is therefore gated only by Spring's default
      `.authenticated()` rule (LoginFormSecurityConfiguration.java:57 +
      AuthorizationCustomizer.java:29-30 for OAUTH2 + LDAP). Combined with batch-R's
      schema-rooted scope (`activity.data_entity_id` NOT NULL FK), the picture is:
      every authenticated user sees every recorded change on every data entity across
      all owners — AND those recorded changes structurally cannot include RBAC mutations,
      Datasource registrations, Owner CRUD, or Collector token rotations.
  - kind: strengthens
    target: F-010
    note: |
      F-010's partition-rotation cycle (ActivityTablePartitionManager creates partitions;
      ActivityEmptyPartitionsHousekeepingJob drops only EMPTY past partitions; no
      row-level TTL exists) is the WRITE-PATH lifecycle for the table THIS controller
      reads. The cursor pagination shape `(lastEventId, lastEventDateTime)` ordered
      `created_at DESC` (per ReactiveActivityRepositoryImpl batch-R lines 287-291) means
      a paginating client reads newest-first into the growing partition tail; deep-window
      cursoring reaches into older partitions that — per F-010 — are NEVER dropped while
      non-empty. The controller's lack of `size` upper bound (ActivityController.java:26)
      compounds the F-010-described unbounded-growth concern: a wide-window list call
      can scan the full retained activity history.
  - kind: strengthens
    target: F-007
    note: |
      4 of the 27 ActivityEventType enum values (OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED,
      ALERT_STATUS_UPDATED, ALERT_HALT_CONFIG_UPDATED) originate from AlertServiceImpl flows
      (per ReactiveActivityRepositoryImpl batch-R coherence note). This controller is therefore
      the READ surface where F-007's audit-trail contribution becomes user-visible. The doc
      page (activity-feed.md lines 65-68) explicitly cross-links to the Alerting feature for
      these four event types; the controller does not distinguish them from the 16 metadata-edit
      types — they flow through the same `event_type` filter and the same payload shape.
  - kind: conflicts_surfaced
    target: F-021
    note: |
      DOC-vs-CODE enum-count mismatch (the batch-R observation, now CONFIRMED at the
      controller layer): the live activity-feed.md page (WebFetch 2026-05-20, status 200)
      names exactly 20 event types in the global filter section, with a hint block stating
      "few additional internal event types (entity overview / metadata / schema / relation
      updates, custom metadata create / update / delete) that are recorded on the entity's
      own Activity tab but are intentionally hidden from the global Activity filter." Those
      additional types resolve to 7 enum values (DATA_ENTITY_OVERVIEW_UPDATED,
      DATA_ENTITY_METADATA_UPDATED, DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED,
      CUSTOM_METADATA_CREATED, CUSTOM_METADATA_UPDATED, CUSTOM_METADATA_DELETED) — 20 + 7 = 27,
      matching the components.yaml:3167-3196 enum and the ActivityEventTypeDto.java:3-31 enum
      (verified: 27 values in each). The doc framing is technically reconcilable BUT a careful
      operator reading the page cannot enumerate the 7 internal types — they are mentioned
      categorically, not by name. The controller's `event_type` query parameter accepts any
      of the 27 values per the OpenAPI spec (openapi.yaml:3259-3262 + 3335-3338, schema =
      ActivityEventType); there is no server-side filtering that REJECTS a request for
      DATA_ENTITY_OVERVIEW_UPDATED on the global endpoint, even though the docs imply this
      view is restricted to per-entity tabs. This is partial drift: discoverable via the
      OpenAPI spec but undocumented in the user-facing page.
  - kind: conflicts_surfaced
    target: F-021
    note: |
      DOC-vs-CODE `type` parameter omission: the live activity-feed.md page (WebFetch
      2026-05-20, status 200) makes no mention of the `type` query parameter on
      `/api/activity` — yet the controller (line 32) declares it, the OpenAPI spec
      documents it (openapi.yaml:3255-3258 schema = ActivityType {ALL, MY_OBJECTS,
      DOWNSTREAM, UPSTREAM}), and the service implements a four-way dispatch on it
      (ActivityServiceImpl.java:107-117). The doc page describes the 7 filter facets
      but not the 4 view-mode tabs (My objects / Upstream / Downstream / All) that
      are part of the UI surface per the per-method sidecar's inference. Operators
      reading the doc cannot discover that the same endpoint serves four different
      ownership scopes, nor that 3 of those 4 scopes bypass owner filtering entirely
      (only MY_OBJECTS consults `authIdentityProvider.fetchAssociatedOwner()`).
upstream_callers:
  - kind: openapi-route
    via: "GET /api/activity → operationId getActivity (openapi.yaml:3206-3284) → ActivityController.getActivity (line 24-41)"
    notes: "OpenAPI spec routes the endpoint via the generated ActivityApi interface (the controller `implements ActivityApi` on line 20); HTTP method, path, query parameter binding, and response shape come from the spec, not from in-class annotations."
  - kind: openapi-route
    via: "GET /api/activity/counts → operationId getActivityCounts (openapi.yaml:3286-3347) → ActivityController.getActivityCounts (line 44-56)"
    notes: "Same generation pattern; 8 query parameters (begin/end_date, datasource_id, namespace_id, tag_ids, owner_ids, user_ids, event_type). Note: no `type` parameter on counts — the response shape returns all four counts (total / myObjects / downstream / upstream) in one payload."
  - kind: ui-component
    via: "odd-platform-ui Activity-page React component(s) — calls /api/activity via the OpenAPI-generated TypeScript client (not enriched yet; UI-axis sidecar pending)"
    notes: "The Activity page in the UI is the primary visible consumer; per the per-entity Activity tab pattern (activity-feed.md line 14), every data-entity detail page also issues a /api/dataentities/{id}/activity call (a DIFFERENT endpoint owned by DataEntityController, not this controller)."
  - kind: external-api-client
    via: "Any caller authenticated under LOGIN_FORM/OAUTH2/LDAP, OR any caller under auth.type=DISABLED, OR any S2S caller with auth.s2s.enabled=true (which grants ADMIN)"
    notes: "No @PreAuthorize, no entry in SecurityConstants.SECURITY_RULES — any authenticated identity reaches both endpoints. There is no programmatic API-reference page (verified 404 on /developer-guides/api-reference/activity); external API consumers discover the endpoints via the OpenAPI spec or the live Swagger UI at /api/v3/api-docs."
downstream_side_effects:
  - kind: db-read
    target: "public.activity (range-partitioned by created_at)"
    via: "ActivityServiceImpl → ReactiveActivityRepositoryImpl.findAllActivities / findMyActivities / findDependentActivities / findDataEntityActivities + the four count methods"
    notes: "Every call to getActivity issues 1 paginated SELECT over the partitioned activity table joined with DATA_ENTITY (INNER), USER_OWNER_MAPPING (LEFT, by OIDC_USERNAME only — see provider-null-cross-mode-bleed concept), OWNER (LEFT via the USER_OWNER_MAPPING join), plus conditional joins for DATA_SOURCE/NAMESPACE/TAG_TO_DATA_ENTITY/OWNERSHIP. Every call to getActivityCounts issues FOUR parallel SELECT COUNT(*) queries (Mono.zip — ActivityServiceImpl.java:158)."
  - kind: db-read
    target: "user-owner mapping + owner tables (LEFT JOIN for actor resolution)"
    via: "ReactiveActivityRepositoryImpl.buildBaseQuery (lines 218-225) + addJoins (lines 227-244)"
    notes: "Actor identity (the activity's `created_by` username) is resolved to a catalog OwnerPojo via LEFT JOIN; NULL OwnerPojo surfaces as 'system' in the UI. The join filters by USER_OWNER_MAPPING.OIDC_USERNAME only — not by provider — so a LOGIN_FORM-authed 'alice' and an LDAP-authed 'alice' resolve to the same OwnerPojo (cross-mode-bleed mirrored from batch N's ReactiveUserOwnerMappingRepositoryImpl sidecar)."
  - kind: lineage-graph-traversal
    target: "data_entity lineage graph"
    via: "ActivityServiceImpl.fetchDependentActivities → DataEntityRelationsService.getDependentDataEntityOddrns(LineageStreamKind) → recursive-CTE walk through lineage edges"
    notes: "Only fires when caller sets `type=UPSTREAM` or `type=DOWNSTREAM`. Cost depends on lineage graph depth at the call time. NOT caller-ownership filtered: anyone can ask 'what changed upstream of any entity I know an ID for' without being an owner of that entity."
  - kind: identity-resolution
    target: "AuthIdentityProvider.fetchAssociatedOwner()"
    via: "ActivityServiceImpl.fetchMyActivities (line 194) + ActivityServiceImpl.getMyObjectActivitiesCount (line 239)"
    notes: "Only fires for `type=MY_OBJECTS` and the myObjectsCount aggregate. Resolves the caller's session principal to the catalog OwnerPojo via the user-owner mapping. Returns empty Mono if the user has no association — `switchIfEmpty(Flux.empty())` (ActivityServiceImpl.java:198) silently returns an empty feed. Visually indistinguishable on the UI from 'no activity in window'."
  - kind: error-propagation
    target: "Reactor onError signal → Spring WebFlux DefaultErrorAttributes → HTTP 400/500 response"
    via: "ActivityServiceImpl.java:99-100 (BadUserRequestException for null beginDate/endDate); ActivityServiceImpl.java:263 (RuntimeException for unknown event-type handler — does not apply to this controller's read path); JooqReactiveOperations error translation for DB errors"
    notes: "BadUserRequestException → HTTP 400; any underlying DB error (e.g. partition-creation failure → 'no partition of relation activity found for row' at INSERT, but this controller does NOT insert) → HTTP 500. The reactive pipeline does NOT catch or translate errors locally — propagation is to Spring's default error-handling chain."
---

# ActivityController (class) — semantic understanding

## understanding

`ActivityController` is the 2-method REST class implementing `ActivityApi` (the OpenAPI-generated interface) that serves the global Activity Feed read surface: `GET /api/activity` (paginated event list, 12 query parameters) and `GET /api/activity/counts` (single-payload aggregate of total / my-objects / upstream / downstream counts, 8 query parameters). The class itself is pure plumbing — `@RestController` + `@RequiredArgsConstructor` injecting one collaborator (`ActivityService`), two `@Override` methods that wrap `activityService.*` calls in `Mono.just(...)`/`.map(ResponseEntity::ok)`. All validation (`beginDate`/`endDate` null check → `BadUserRequestException`), four-way view-mode dispatch (ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM), owner / lineage / cursor logic, and DTO mapping live in `ActivityServiceImpl`. The class carries no authorization annotations and is not enumerated in `SecurityConstants.SECURITY_RULES` — both endpoints fall to Spring's default `.authenticated()` rule, making the global cross-owner audit trail readable by any authenticated identity under LOGIN_FORM/OAUTH2/LDAP (and anonymously under DISABLED).

## concepts

- entities: [Activity (response DTO), ActivityCountInfo (response DTO), ActivityType (request enum: ALL/MY_OBJECTS/DOWNSTREAM/UPSTREAM), ActivityEventType (request enum: 27 values across 7 doc-grouped categories), ActivityService (delegate), ActivityApi (generated interface)]
- operations: [list-activity-window, count-activity-aggregates, filter-by-7-facets, filter-by-view-mode-type, cursor-paginate, delegate-to-service]
- invariants:
  - "Class implements one interface: `ActivityApi` (generated from openapi.yaml:3206-3347). The HTTP method, path, query parameter binding, and response shapes come from generation — there are NO `@GetMapping` / `@RequestParam` annotations in this class (line 18-57)."
  - "Two endpoints exposed: `getActivity` (line 24) and `getActivityCounts` (line 44). Both are read-only `GET`s; the controller has NO write endpoint (the WRITE surface for activity rows is ActivityServiceImpl.createActivityEvent / createActivityEvents, called from @ActivityLog-annotated services and AlertServiceImpl)."
  - "Both methods accept `ServerWebExchange exchange` as the trailing parameter (lines 36, 52) but do NOT use it — neither method reads any header, principal, or attribute from the exchange. Authentication is asserted via the SecurityWebFilterChain BEFORE the handler runs; the handler does not consult the principal directly (the per-call `fetchAssociatedOwner()` reads the principal via AuthIdentityProvider inside ActivityServiceImpl, not via the exchange)."
  - "`getActivity` accepts 12 user-controlled query parameters + `exchange`: beginDate, endDate, size, datasourceId, namespaceId, tagIds, ownerIds, userIds, type, eventType, lasEventId (sic — typo preserved on the Java method signature; OpenAPI uses correct `last_event_id`), lastEventDateTime."
  - "`getActivityCounts` accepts 8 user-controlled query parameters + `exchange`: beginDate, endDate, datasourceId, namespaceId, tagIds, ownerIds, userIds, eventType. NO `type` parameter — the response returns all four view-mode counts simultaneously."
  - "Both methods return `Mono<ResponseEntity<...>>` — the reactive shape is preserved from interface through implementation; no thread blocking inside the controller."
- audiences: [odd-platform-ui-end-user (global Activity page; activity-feed.md), odd-api-consumer (anyone driving /api/activity programmatically via the OpenAPI spec), platform-operator auditing change-history, security-compliance-reviewer reading post-incident, https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed]

## dependencies_semantic

- requires-feature:
  - "`ActivityService` (interface in service/activity/) — the controller's single injected collaborator (field at line 21); ActivityServiceImpl is the only implementation. Owns: BadUserRequestException validation, four-way ActivityType dispatch, ownership-resolution via AuthIdentityProvider, lineage-resolution via DataEntityRelationsService, mapping from ActivityPojo to OpenAPI Activity payload."
  - "`ActivityApi` (generated interface in api/contract/api/) — declares both method signatures the controller `@Override`s (lines 23, 43). All HTTP-binding (method, path, query parameters, response shape) lives on this interface; the controller is structurally an SPI implementation."
  - "Spring WebFlux `@RestController` (line 18) + Lombok `@RequiredArgsConstructor` (line 19) — wires the bean and the single-arg constructor that takes `ActivityService activityService`."
- requires-config: []
- requires-runtime:
  - "Spring WebFlux reactive runtime (`@RestController` + Mono/Flux response signatures)."
  - "Reactor Core (`Mono.just(...).map(...)`)."
  - "OpenAPI-generated `ActivityApi` on the classpath — without it the controller does not compile."
- coupling:
  - "Authorization: NO `@PreAuthorize`, NO `hasPermission(...)`, NO programmatic permission check at controller layer (lines 1-58). The generated `ActivityApi` interface carries no authorization annotations either (grep verified). `/api/activity` and `/api/activity/counts` are NOT enumerated in `SecurityConstants.SECURITY_RULES` (SecurityConstants.java:98-356, full file read; zero matches for 'activity' / 'Activity' / 'ACTIVITY'). Neither path is in `WHITELIST_PATHS` (line 95-96). Access falls through to Spring's default rule under each auth mode: `pathMatchers('/**').authenticated()` (LoginFormSecurityConfiguration.java:57) / `AuthorizationCustomizer.java:29-30` (OAUTH2 + LDAP). Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration.java:16` calls `.anyExchange().permitAll()` — anonymous reachable."
  - "S2S coupling: `auth.s2s.enabled=true` grants the S2S caller ADMIN; that ADMIN identity satisfies `.authenticated()` and can therefore read the full cross-owner audit trail via these endpoints. Per ODD's documented two-surface posture (`enable-security/README.md`: 'Enabling one does not protect the other'), an operator who enables S2S for ingestion gives any token-holder full audit-trail read."
  - "Ingestion-filter coupling: `IngestionDataEntitiesFilter` applies only to `/ingestion/entities` — does NOT apply to `/api/*` (per the path matcher in batch-D's IngestionDataEntitiesFilter sidecar). Setting `auth.ingestion.filter.enabled=true` does NOT add a gate to these endpoints."
  - "Schema-rooted scope: `ReactiveActivityRepositoryImpl` (batch R sidecar) and the V0_0_48__add_activity.sql migration constrain `activity.data_entity_id` to NOT NULL + FK. This is the structural ceiling on what THIS controller can ever return: RBAC mutations, Owner CRUD, Datasource registrations, Collector token rotations CANNOT be in the result set because they cannot be in the table."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - test_class: "(no test class exists)"
    behaviour: "Happy path `getActivity` with all defaults (type=null, no filters) returns 2xx with a Flux<Activity>; `getActivityCounts` returns 2xx with an ActivityCountInfo payload."
  - test_class: "(no test class exists)"
    behaviour: "Validation: `getActivity` with `beginDate=null` (or `endDate=null`) propagates BadUserRequestException through the Mono.error → HTTP 400."
  - test_class: "(no test class exists)"
    behaviour: "View-mode dispatch: `getActivity` with `type=MY_OBJECTS` filters by caller's owner; with `type=UPSTREAM`/`DOWNSTREAM` walks lineage; with `type=ALL` (and `type=null`) bypasses owner filter. Four distinct response sets must be covered."
  - test_class: "(no test class exists)"
    behaviour: "Authorization: when `auth.type=LOGIN_FORM` (or OAUTH2 / LDAP) and the caller is unauthenticated, the SecurityWebFilterChain rejects the request before the controller runs (HTTP 401). When the caller IS authenticated, the request reaches the controller regardless of ownership association — there is no per-endpoint Permission gate to test."
  - test_class: "(no test class exists)"
    behaviour: "DISABLED-mode behaviour: under `auth.type=DISABLED`, an unauthenticated caller reaches the endpoint and reads the full cross-owner audit trail (a documented dev-only mode, but the test would assert the reachability and the absence of a fail-closed gate)."
  - test_class: "(no test class exists)"
    behaviour: "User-id and owner-id enumeration: passing `userIds=[1..N]` returns activity rows only for ids that have generated events in the window — the response cardinality leaks which ids correspond to active users."
  - test_class: "(no test class exists)"
    behaviour: "Cursor-pagination correctness: paginating with `(lastEventId=X, lastEventDateTime=Y)` returns the next-older window without overlap or skipped rows at the boundary."
  - test_class: "(no test class exists)"
    behaviour: "Unbounded `size`: `getActivity` with `size=Integer.MAX_VALUE` does not reject the call; the DB plans a wide scan. No `@Max` constraint, no programmatic check (line 26)."
  - test_class: "(no test class exists)"
    behaviour: "Hidden-event-type filtering: `getActivity` with `eventType=DATA_ENTITY_OVERVIEW_UPDATED` (one of the 7 internal types per the doc page) is accepted and returns matching rows from the global endpoint — confirming the docs' 'hidden from global filter' framing is UI-tier-only, not server-enforced."
- test_files: []
- gaps: |
    The class has zero test coverage: no `ActivityControllerTest.java` exists under `odd-platform-api/src/test/`, and no test references `getActivity`, `getActivityCounts`, `getActivityList`, `fetchAllActivities`, `fetchMyActivities`, or `fetchDependentActivities` (verified via Glob across the test tree). The validation path (BadUserRequestException for null dates) is the most visible regression risk: a refactor that moves the null check from ActivityServiceImpl to a controller-layer annotation would silently change the error code (BadUserRequestException → ConstraintViolationException) without any test catching it.

    The four-way view-mode dispatch is the largest uncovered surface — refactoring ActivityType (renaming an enum value, collapsing branches, or adding a fifth view mode) could regress one or more dispatch arms silently. The MY_OBJECTS branch in particular (only branch that consults `authIdentityProvider.fetchAssociatedOwner()`) is the highest-leverage test gap: a refactor that changes the empty-Mono behaviour silently degrades MY_OBJECTS into 'shows nothing' — visually indistinguishable from 'no activity in window'.

    Cross-mode-bleed (LEFT JOIN by OIDC_USERNAME only, per batch R's invariants[1]) is unobservable at the controller layer in tests because all current happy-path test fixtures would use a single auth provider. A test that fixtures two providers with overlapping usernames would surface the bleed.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Canonical feature-page for the global Activity Feed UI surface — this controller is the API behind that page."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Page title: "Activity Feed".

      The page lists exactly 20 visible event types in the global filter,
      organised by 6 categories:
        - Data entity lifecycle (4): DATA_ENTITY_CREATED, DATA_ENTITY_STATUS_UPDATED,
          BUSINESS_NAME_UPDATED, DESCRIPTION_UPDATED.
        - Ownership (3): OWNERSHIP_CREATED, OWNERSHIP_UPDATED, OWNERSHIP_DELETED.
        - Tags and terms (2): TAG_ASSIGNMENT_UPDATED, TERM_ASSIGNMENT_UPDATED.
        - Dataset fields (5): DATASET_FIELD_VALUES_UPDATED, DATASET_FIELD_DESCRIPTION_UPDATED,
          DATASET_FIELD_INTERNAL_NAME_UPDATED, DATASET_FIELD_TAGS_UPDATED,
          DATASET_FIELD_TERM_ASSIGNMENT_UPDATED.
        - Data entity groups (2): CUSTOM_GROUP_CREATED, CUSTOM_GROUP_UPDATED.
        - Alerts (4): OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED, ALERT_STATUS_UPDATED,
          ALERT_HALT_CONFIG_UPDATED.

      The 7 filter facets on the global Activity page (Calendar, Datasource,
      Namespace, Event type, Tag, Owner, User) correspond to the controller's
      parameters beginDate/endDate, datasourceId, namespaceId, eventType,
      tagIds, ownerIds, userIds.

      The page mentions: "The platform emits a few additional internal event
      types (entity overview / metadata / schema / relation updates, custom
      metadata create / update / delete) that are recorded on the entity's
      own Activity tab but are intentionally hidden from the global Activity
      filter to keep the feed concise." These 7 internal types + the 20
      named types = 27, matching components.yaml:3167-3196 and
      ActivityEventTypeDto.java:3-31.

      The page does NOT mention:
        - The `type` query parameter (ActivityType: ALL / MY_OBJECTS /
          UPSTREAM / DOWNSTREAM) that switches between four ownership scopes.
        - Authorization / who can see global activity (no visibility statement).
        - Owner-scoping (the page is silent on whether the view is
          owner-scoped by default; in reality only MY_OBJECTS is).
        - Pagination mechanics (cursor via lastEventId + lastEventDateTime).
        - The `size` parameter or default page size.
        - That the 7 internal types are server-acceptable on the global
          endpoint (they are; the docs imply they aren't).
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/activity"
    anchor: ""
    rationale: "Expected per-tag API-reference page paralleling /developer-guides/api-reference/alerts."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Page returns 404: "This page may have been moved, renamed, or deleted."
      No dedicated API-reference page exists for the `activity` OpenAPI tag
      on the live site. Compare: /developer-guides/api-reference/alerts
      exists and documents the alerts tag. The activity endpoints are
      undocumented at the per-tag reference level.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical authorization-vocabulary page — verified to confirm Policies / Permissions / Roles / Owners / User-owner association are the correct ODD terms."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Five core authorization concepts: Policies, Permissions, Roles, Owners,
      User-owner association.

      The page does NOT mention any per-endpoint protection wiring for
      /api/activity or audit-log visibility controls. The framework is
      documented in the abstract; the read-collaborative posture for the
      activity feed is invisible to a maintainer relying only on this page.
- doc_drift_findings:
  - "Enum-count mismatch (PARTIAL DRIFT): activity-feed.md lists 20 named event types in the global filter section + a categorical mention of 7 internal types ('entity overview / metadata / schema / relation updates, custom metadata create / update / delete'); the spec (components.yaml:3167-3196) and DTO (ActivityEventTypeDto.java:3-31) carry 27 values. The 20 + 7 = 27 sum is reconcilable, but the 7 internal types are not enumerated by name — an operator filtering for those internal types via the API has no doc-side reference for their names."
  - "Server-side acceptance of hidden types (CODE-DOC DRIFT): the doc page says the 7 internal types are 'hidden from the global Activity filter' — but the controller's `eventType` query parameter and the OpenAPI spec accept ALL 27 values without server-side rejection at the global endpoint. The 'hidden' framing is a UI-only convention; the API surface is fully open."
  - "`type` parameter undocumented (CODE-DOC DRIFT): the doc page lists 7 filter facets but makes no mention of the `type` query parameter (ActivityType: ALL / MY_OBJECTS / UPSTREAM / DOWNSTREAM) that the controller declares (line 32), the spec documents (openapi.yaml:3255-3258), and the service implements (ActivityServiceImpl.java:107-117). The four UI tabs for view-mode are documented nowhere on the public docs."
  - "Visibility framing absent (CODE-DOC DRIFT with security implications): the doc page makes no statement about who can see the global activity feed. In reality, any authenticated user under LOGIN_FORM/OAUTH2/LDAP sees the full cross-owner audit trail (default `type=null` → `fetchAllActivities`, no owner filter). The page omits this and the authorization page omits the per-endpoint wiring — the read-collaborative posture is invisible to a documentation reader."
  - "No first-party API-reference page for the activity tag (CODE-DOC DRIFT): /developer-guides/api-reference/activity returns 404. The alerts tag has a per-tag reference page; the activity tag does not. Bi-directional code↔doc coverage gap (Gate 6)."
  - "OpenAPI spec under-documents the endpoints: openapi.yaml:3208-3209 carries description 'Returns activity for dedicated period' — no per-parameter descriptions, no view-mode semantics, no cursor-pagination notes, no visibility statement. The spec is the only API-reference surface and it under-documents the endpoint."

## implicit_adrs

- "The Activity read surface is exposed as a class with exactly 2 methods — global feed (`GET /api/activity`) and aggregate counts (`GET /api/activity/counts`) — with no admin variant and no streaming variant. The pair-of-methods shape encodes a design that the global feed and the counts are SEPARATE API calls, computed independently (counts run 4 parallel queries; the list runs 1 paginated query). The convention is consistent with the controller package's REST patterns." — evidence: ActivityController.java:18-57 (only 2 methods exist) + ActivityApi (generated interface, only 2 abstract methods per the spec at openapi.yaml:3206-3347). — intent_anchor: "The two methods share filter parameters but return distinct shapes: `Mono<ResponseEntity<Flux<Activity>>>` for the list (line 24) and `Mono<ResponseEntity<ActivityCountInfo>>` for the aggregate (line 44); merging them would couple count-aggregation latency with paginated list-fetch latency on the same call — the separation is deliberate." — confidence: MEDIUM
- "Controller methods accept `ServerWebExchange exchange` parameters they never read (lines 36, 52) — Spring WebFlux passes the exchange to handlers per the generated `ActivityApi` interface contract, but the controller does not consult headers, principals, or attributes from it. Identity-and-principal resolution lives in `ActivityServiceImpl.fetchMyActivities` via `authIdentityProvider.fetchAssociatedOwner()` (ActivityServiceImpl.java:194), not in the controller. The convention is: authentication is asserted by the SecurityWebFilterChain before the handler runs; the handler trusts that assertion." — evidence: ActivityController.java:36 (`exchange` parameter, never referenced in the method body) + ActivityController.java:52 (same) + ActivityServiceImpl.java:194,239 (identity reads via authIdentityProvider). — intent_anchor: "The unused `exchange` parameters and the absence of any principal access from the controller layer signal a deliberate division: the WebFilterChain owns authentication, the service owns identity-driven dispatch, the controller owns nothing." — confidence: MEDIUM
- "The controller class itself carries no logic, no `@PreAuthorize`, no `@Slf4j` (no logging), and no exception handling — it is intentionally thin to make the OpenAPI-generated interface the canonical source of HTTP-binding truth. The pattern is identical to AlertController and other controllers in the package per the substrate's controller-class axis." — evidence: ActivityController.java:1-58 (zero imports beyond Lombok + Spring base + the generated ActivityApi + the DTOs + the service) + ActivityApi interface (generated from openapi.yaml). — intent_anchor: "Every method body is exactly one statement: a Mono.just() wrapper or a direct service-method call mapped to ResponseEntity.ok. The shape is a 'pure proxy' pattern; the convention applies across the package." — confidence: HIGH

## bugs_limitations_corner_cases

- "Public-API parameter typo on the Java surface: `getActivity` declares `final Long lasEventId` on line 34 (missing the `t` in 'last'). The OpenAPI parameter is `last_event_id` (correct); the Java method signature exposes `lasEventId`. The controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)` (line 39) — the service interface declares the parameter as `final Long lastEventId` (ActivityService.java:42). The typo is local to this controller's method signature; OpenAPI-generated client SDKs use the spec's `last_event_id` and would not carry the typo, but a developer reading the controller code directly sees `lasEventId`." — evidence: ActivityController.java:34 + ActivityService.java:42 (correct spelling) + openapi.yaml:3263-3267 (correct `last_event_id`). — severity: LOW
- "Both methods accept `ServerWebExchange exchange` (lines 36, 52) but reference it nowhere in the method bodies. The parameter is required by the generated `ActivityApi` interface contract; unused-parameter warnings are suppressed at the project level. Not a defect per se, but a clutter signal that documentation about the controller→service handoff is absent." — evidence: ActivityController.java:36,52 + grep within the method bodies (zero references). — severity: LOW
- "No `@PreAuthorize`, no programmatic authorization gate at the controller layer, and no entry for either endpoint in `SecurityConstants.SECURITY_RULES` (verified: zero matches across the 357-line file for 'activity' / 'ACTIVITY' / 'Activity'). The endpoints fall through to Spring's default `.authenticated()` rule; under DISABLED auth mode, anonymous traffic reaches them. The OpenAPI spec contains no security requirement annotation on either endpoint. The 'read-collaborative cross-owner enumeration posture' concept in the catalog is rooted here." — evidence: ActivityController.java:1-58 + SecurityConstants.java:95-356 + DisabledAuthSecurityConfiguration.java:16 + openapi.yaml:3206-3347 (no `security:` block on either operation). — severity: HIGH (informational — the design decision is consistent with the read-collaborative posture across the codebase, but the user-facing doc page contains no warning)
- "`getActivity` accepts arbitrary `userIds` and `ownerIds` lists (lines 30-31) with no validation that the IDs reference existing users / owners. A caller can submit `userIds=[1..N]` to probe which ids correspond to active users via response cardinality. Combined with the lack of rate limiting on `/api/activity`, this is a low-cost id-enumeration vector." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 (parameters passed through unchanged) + grep for '@RateLimit'/'RateLimiter' in the controller package (zero matches). — severity: MEDIUM
- "`size` parameter has no `@Max` constraint, no documented upper bound, and no programmatic check at controller or service layer (line 26). A caller submitting `size=Integer.MAX_VALUE` triggers a wide DB scan limited only by Postgres's LIMIT plan and the partition layout. Combined with the absence of `type=null` owner-scoping, a single mis-tuned client can issue a wide-window cross-owner audit-trail dump." — evidence: ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292 (`.limit(size)` — uses the passed value directly). — severity: MEDIUM
- "Both endpoints expose audit-trail history including `old_state` and `new_state` of every tracked field. The Activity payload (components.yaml:2861-2935) includes structured before/after values for descriptions, business names, internal names, custom-metadata key/value pairs, tag assignments, term assignments, and ownership transitions. If those fields ever carried sensitive content (incident notes in descriptions, customer identifiers in business names), the global feed exposes them to ALL authenticated users. The doc page omits any caveat about description content sensitivity." — evidence: components.yaml:2861-2935 + ActivityController.java:23-41 (no field redaction) + ActivityServiceImpl.java:86-117 (no owner filter for the default path) + activity-feed.md (WebFetch 2026-05-20, status 200, no sensitivity caveat). — severity: MEDIUM
- "`getActivityCounts` issues 4 parallel aggregation queries per call (`Mono.zip` of totalCount / myObjectsCount / downstreamCount / upstreamCount per ActivityServiceImpl.java:158-165). A UI that polls the counts endpoint on a refresh interval drives 4× the apparent endpoint count of DB load. No caching, no debouncing, no precomputed aggregate." — evidence: ActivityServiceImpl.java:139-166 (the zip pattern) + the absence of any cache annotation across the call chain. — severity: LOW

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED (dev-only — endpoints reachable anonymously)
  - "`/api/activity` and `/api/activity/counts` are UI/API-surface endpoints. Under LOGIN_FORM/OAUTH2/LDAP, Spring's default `.authenticated()` rule applies (LoginFormSecurityConfiguration.java:57 / AuthorizationCustomizer.java:29-30). The endpoints are not in `WHITELIST_PATHS` (SecurityConstants.java:95-96) and not in `SECURITY_RULES` (lines 98-356, full file verified). Under `auth.type=DISABLED` (DisabledAuthSecurityConfiguration.java:16), `.anyExchange().permitAll()` opens the endpoints to anonymous callers. S2S applies (auth.s2s.enabled=true grants ADMIN identity) — an S2S caller satisfies `.authenticated()` and reads the full audit trail."
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. `IngestionDataEntitiesFilter` applies only to `/ingestion/entities`; neither of these endpoints is reachable through the ingestion path. Setting `auth.ingestion.filter.enabled=true` does NOT add a gate to `/api/activity` or `/api/activity/counts`."
- authorization_assertions: []
  - "Neither method carries `@PreAuthorize`, `@PostAuthorize`, `@Secured`, programmatic `permissionService.hasPermission(...)` call, or any other authorization check. The class has no class-level authorization annotation. The generated `ActivityApi` interface has no authorization annotations (grep verified across the generated sources)." — evidence: ActivityController.java:18-57 (no annotations beyond @RestController + @RequiredArgsConstructor + per-method @Override) + ActivityApi.java generated interface (no auth annotations) + SecurityConstants.java:98-356 (no /api/activity entry).
- owner_scoping: "BYPASSES by default (`type=null` and `type=ALL`); BYPASSES for `type=UPSTREAM`/`DOWNSTREAM` (lineage-scoped, not caller-ownership-scoped); RESPECTS for `type=MY_OBJECTS` (consults `authIdentityProvider.fetchAssociatedOwner()`)."
  - "The default path returns activity rows for every data entity matching the date / datasource / namespace / tag / owner / user filters — across ALL owners. Only MY_OBJECTS filters to the caller's owner association. UPSTREAM/DOWNSTREAM walks the lineage graph WITHOUT ownership filtering — anyone can ask 'what changed upstream of any entity I know' regardless of whether they own it. This is consistent with the read-collaborative posture across odd-platform (concepts.yaml:64,72: 27+ read endpoints bypass owner scoping)." — evidence: ActivityController.java:23-41 + ActivityServiceImpl.java:86-117 (the four-way dispatch) + ActivityServiceImpl.java:168-182 (fetchAllActivities — no owner filter) + ActivityServiceImpl.java:184-199 (fetchMyActivities — only path consulting fetchAssociatedOwner) + ActivityServiceImpl.java:201-217 (fetchDependentActivities — lineage-scoped, no caller-ownership filter).
- data_exposure:
  - "Activity payload (Activity schema components.yaml:2861-2889): id, event_type (one of 27 enum values), created_at, created_by (AssociatedOwner — exposes actor's owner + username), data_entity (DataEntityRef — exposes entity's oddrn, naming, type), old_state + new_state (every tracked field's value before/after — descriptions, business names, dataset-field internal names, custom-metadata values, term/tag assignments, ownership transitions, alert halt-config changes). → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any caller under DISABLED; any S2S caller." — evidence: components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 (no field redaction) + ActivityServiceImpl.java:86-117.
  - "ActivityCountInfo payload (components.yaml:1953-1962 — schema observation): totalCount (cross-owner, no filter), myObjectsCount (owner-scoped to the caller), downstreamCount + upstreamCount (lineage-scoped, NO caller-ownership filter). → same audience as above. Even a caller with no owner association can read totalCount and (via UPSTREAM/DOWNSTREAM with crafted lineage queries) lineage-scoped counts across the platform." — evidence: ActivityController.java:43-56 + ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258.
  - "Filter parameters as enumeration probes: passing `userIds=[1..N]` reveals which ids have generated activity (response cardinality); passing `ownerIds=[1..N]` reveals owner-id activity volume; passing `eventType=DATA_ENTITY_OVERVIEW_UPDATED` reveals 1 of the 7 'hidden' internal types is actually surfaceable through the global endpoint. → any authenticated user (or anonymous under DISABLED)." — evidence: ActivityController.java:30-31,33 + ActivityServiceImpl.java:179-181.
- known_security_gaps:
  - "`/api/activity` and `/api/activity/counts` have no per-endpoint authorization wiring — no `@PreAuthorize`, no programmatic permission check, no entry in `SecurityConstants.SECURITY_RULES`. Any authenticated user reads the GLOBAL cross-owner audit trail, including audit events on resources they have no ownership association with. The Policies/Permissions/Roles/Owners framework documented at /enable-security/authorization is not applied. The user-facing activity-feed.md page contains no warning about this." — evidence: ActivityController.java:1-58 + SecurityConstants.java:95-356 (full file read; zero matches) + WebFetch /features/active-platform-features/activity-feed (200, no visibility statement) + WebFetch /enable-security/authorization (200, no per-endpoint wiring mention). — severity: HIGH
  - "Under `auth.type=DISABLED` the endpoints are reachable by anonymous traffic — no fail-closed behaviour. Per the live security docs, DISABLED is dev-only; but a production deployment that mis-sets `auth.type` exposes the full cross-owner audit trail (including actor usernames, ownership transitions, description content) to anyone able to reach the application port." — evidence: ActivityController.java:1-58 + DisabledAuthSecurityConfiguration.java:16 (`.anyExchange().permitAll()`). — severity: MEDIUM (gated on dev-only deployment guidance being followed)
  - "S2S exposure: `auth.s2s.enabled=true` grants ADMIN to any caller bearing a valid S2S token. ADMIN satisfies `.authenticated()` and therefore reads the full audit trail. An operator who enables S2S for ingestion (e.g. a collector token) inadvertently grants that token-holder full audit-read. The two-surface invariant ('Enabling one does not protect the other') applies in reverse: a permissively-issued S2S token leaks the audit-trail." — evidence: ActivityController.java:1-58 + S2sAuthenticationFilter wiring (per batch-D sidecars, granting ADMIN identity). — severity: MEDIUM
  - "`userIds` and `ownerIds` filter parameters allow low-cost id enumeration via response-cardinality side-channel. No rate limiting on the endpoint. Combined with the unbounded `size` parameter, a sweep of id ranges is operationally trivial." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 + grep for rate-limit annotations (zero matches in controller package). — severity: MEDIUM
  - "Audit-trail content sensitivity: `old_state` / `new_state` on the Activity payload includes free-text fields (descriptions, business names, custom-metadata values). The platform does not redact, mask, or sensitivity-label these fields at the API surface. Any operator who has historically used descriptions for incident notes, customer identifiers, or internal tickets has those fields readable by every authenticated user. The doc page contains no caveat." — evidence: components.yaml:2891-2935 (ActivityState schema) + DescriptionActivityStateDto.java:3 (no redaction logic) + activity-feed.md (no caveat). — severity: MEDIUM
  - "Audit-trail SILENCE on RBAC/Owner CRUD/Datasource/Collector mutations (the F-006 9-sidecar pattern, batch R schema-rooted at the SQL level): this controller surfaces only what `activity.data_entity_id NOT NULL` permits — operationally, a Role creation, Policy edit, Owner deletion, or Collector token rotation produces NO row in this feed. A security-compliance reviewer reading the activity feed cannot detect a Policy that was edited to remove a permission gate. The audit story is partial; the doc page does not state the scope boundary." — evidence: V0_0_48__add_activity.sql:4,12 (NOT NULL FK) + ReactiveActivityRepositoryImpl batch-R sidecar invariants[0] + activity-feed.md (no scope-boundary statement). — severity: HIGH

## performance

- hot_paths:
  - "`getActivity` (default path, type=null or type=ALL): 1 partitioned SELECT over `public.activity` joined with DATA_ENTITY (INNER), USER_OWNER_MAPPING (LEFT) + OWNER (LEFT via mapping), plus conditional joins for DATA_SOURCE/NAMESPACE/TAG_TO_DATA_ENTITY/OWNERSHIP based on which filters are set. Filtered by 8 facets + cursor; ordered `created_at DESC, id DESC`; limited to `size`. For wide-window calls with no filters and large `size`, the scan touches multiple partitions." — evidence: ActivityController.java:23-41 (parameters threaded through unchanged) + ReactiveActivityRepositoryImpl.java:74-89,208-244,279-295.
  - "`getActivity` (type=UPSTREAM/DOWNSTREAM): lineage-graph resolution BEFORE the activity SELECT — `DataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)` runs first, then the activity query restricts by `DATA_ENTITY.ODDRN IN (...)`. For deep lineage graphs, the resolution step dominates latency; the IN-clause cardinality scales with the dependent-entity count." — evidence: ActivityServiceImpl.java:201-217 + ReactiveActivityRepositoryImpl.java:109-126.
  - "`getActivityCounts`: 4 parallel Mono.zip aggregation queries against `activity` (totalCount + myObjectsCount + downstreamCount + upstreamCount). Every call drives 4 SELECT COUNT(*) round-trips. A UI polling this endpoint on a refresh interval multiplies DB load 4×." — evidence: ActivityController.java:43-56 + ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258.
  - "`getActivity` (type=MY_OBJECTS): 1 lookup against `user_owner_mapping` to resolve `fetchAssociatedOwner()` + 1 activity-table SELECT filtered by `OWNERSHIP.OWNER_ID = currentOwnerId`. Lower cost than the default path because OWNERSHIP join narrows the result set early; still cursor-paginated." — evidence: ActivityServiceImpl.java:184-199 + ReactiveActivityRepositoryImpl.java:91-107.
- throughput_characteristics:
  - "Reactive Mono/Flux signature — non-blocking on request thread; DB I/O is the bottleneck. The Flux<Activity> response streams through the WebFlux pipeline without buffering the full result in controller memory."
  - "Single-window GET per call — no streaming alternative, no chunked response, no batch / bulk variant. A UI rendering a multi-window dashboard issues N separate calls."
  - "Cursor pagination via `(lastEventId, lastEventDateTime)` — client controls page boundaries; server has no session state."
  - "No SSE / WebSocket variant for real-time activity-feed updates — clients poll. The frequency of polling drives the `getActivityCounts` load."
- resource_allocation:
  - "Per-call cost (type=null or ALL): 1 DB read over `activity` filtered by 8 facets. Memory: bounded by Flux backpressure and `size`."
  - "Per-call cost (type=MY_OBJECTS): 1 user-owner-mapping lookup + 1 activity-table SELECT (narrowed by OWNERSHIP)."
  - "Per-call cost (type=UPSTREAM/DOWNSTREAM): 1 lineage-graph traversal (cost depends on graph depth and `getNeighbours` limits per the LineageServiceImpl sidecar) + 1 activity-table SELECT (narrowed by IN-clause on resolved oddrns)."
  - "Per-call cost (counts endpoint): 4× the corresponding list query without the LIMIT — full-window COUNT(*) aggregations."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally. No session state, no in-memory cache, no per-instance counters."
  - "Read path only — no row-level lock, no advisory lock. Concurrent calls compete for DB connections and Postgres planner resources but do not serialise on locks."
  - "Cursor pagination scales linearly with page count for the requesting client; offset pagination (not used) would degrade quadratically."
  - "No server-enforced upper bound on `size` — a single mis-tuned client can drive arbitrarily expensive single round-trips. The DB plan + Postgres LIMIT clause are the only safeguard."
  - "F-010 interaction: the `activity` table grows monotonically while non-empty partitions are never dropped (ActivityTablePartitionManager creates but never drops; ActivityEmptyPartitionsHousekeepingJob drops only empty past partitions). Read scans over the full historical window scale with deployment age."
- known_performance_gaps:
  - "`size` parameter has no `@Max` constraint and no programmatic upper bound (line 26). A single call with `size=Integer.MAX_VALUE` triggers a wide DB scan." — evidence: ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292. — severity: MEDIUM
  - "`getActivityCounts` issues 4 parallel aggregation queries per call with no caching, debouncing, or precomputed aggregate. A UI polling the counts endpoint on a refresh interval (e.g. every 30s) multiplies DB load 4×." — evidence: ActivityServiceImpl.java:139-166. — severity: LOW
  - "`fetchDependentActivities` runs a lineage-graph traversal in the hot path before issuing the activity query — for entities with deep upstream/downstream graphs, this is multi-hop network/CTE work per call. No precomputed dependency-set on activity rows." — evidence: ActivityServiceImpl.java:201-217. — severity: LOW (depends on deployment-specific lineage depth)
  - "Composite-cursor predicate `row(trunc(ACTIVITY.CREATED_AT, SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (ReactiveActivityRepositoryImpl.java:287-288) requires an index covering `(created_at DESC, id DESC)` on `activity` to avoid full-partition scans on deep pagination. The index strategy lives in the V0_0_48 migration, not in this controller; an index loss would degrade pagination linearly with depth." — evidence: ActivityController.java:34-35 (cursor parameters) + ReactiveActivityRepositoryImpl.java:287-291. — severity: LOW (out-of-scope for the controller, but worth surfacing)
  - "No rate limiting at the controller layer — a hostile or mis-tuned client can drive arbitrarily many `getActivity` calls with arbitrarily large `size` values. Combined with cross-owner reachability, this is also a security concern (id enumeration via brute-force)." — evidence: ActivityController.java:1-58 + grep for `@RateLimit`/`RateLimiter` in controller package (zero matches). — severity: MEDIUM

## sources

- understanding ← ActivityController.java:1-58 + ActivityServiceImpl.java:86-117 + components.yaml:2861-2935,3159-3196 + openapi.yaml:3206-3347
- concepts.entities.Activity ← ActivityController.java:7 + components.yaml:2861-2889
- concepts.entities.ActivityCountInfo ← ActivityController.java:8 + components.yaml:1953-1962 (schema location verified via openapi.yaml:3344-3345 ref)
- concepts.entities.ActivityType ← ActivityController.java:10 + components.yaml:3159-3166
- concepts.entities.ActivityEventType ← ActivityController.java:9 + components.yaml:3167-3196 + ActivityEventTypeDto.java:3-31
- concepts.invariants.[0] ← ActivityController.java:20 (implements ActivityApi) + openapi.yaml:3206-3347
- concepts.invariants.[1] ← ActivityController.java:18-57 (the 2 method bodies)
- concepts.invariants.[2] ← ActivityController.java:36,52 (exchange parameter never read in method body) + ActivityServiceImpl.java:194 (identity reads via authIdentityProvider, not via exchange)
- concepts.invariants.[3] ← ActivityController.java:24-36 (the 12+1 parameters of getActivity)
- concepts.invariants.[4] ← ActivityController.java:44-52 (the 8+1 parameters of getActivityCounts)
- concepts.invariants.[5] ← ActivityController.java:24 + ActivityController.java:44 (both return Mono<ResponseEntity<...>>)
- dependencies_semantic.requires-feature.[0] ← ActivityController.java:11 + ActivityController.java:21 + ActivityServiceImpl.java:33-274
- dependencies_semantic.requires-feature.[1] ← ActivityController.java:6 + ActivityController.java:20 (`implements ActivityApi`) + openapi.yaml:3206-3347
- dependencies_semantic.requires-feature.[2] ← ActivityController.java:18-19 (annotations) + Lombok generated constructor
- dependencies_semantic.requires-runtime ← ActivityController.java:13-16 (Spring + Reactor imports)
- dependencies_semantic.coupling.[0-auth] ← ActivityController.java:1-58 (no annotations) + SecurityConstants.java:95-356 (no /api/activity rule) + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16
- dependencies_semantic.coupling.[1-S2S] ← ActivityController.java:1-58 + S2sAuthenticationFilter wiring per batch-D sidecars
- dependencies_semantic.coupling.[2-ingestion-filter] ← IngestionDataEntitiesFilter sidecar (batch D) + ActivityController.java (path /api/* not /ingestion/*)
- dependencies_semantic.coupling.[3-schema-rooted-scope] ← V0_0_48__add_activity.sql:4,12 (referenced via ReactiveActivityRepositoryImpl batch-R sidecar)
- tests_coverage_semantic ← Glob `**/ActivityControllerTest*` (no files found) + Glob `**/ActivityServiceImplTest*` (no files found) under odd-platform-api/
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/activity (status 404, 2026-05-20)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization (status 200, 2026-05-20)
- docs_link_semantic.doc_drift_findings.[0-enum-count] ← WebFetch /features/active-platform-features/activity-feed (lists 20 + 7 categorical) + components.yaml:3167-3196 (27 enum values) + ActivityEventTypeDto.java:3-31 (27 enum values)
- docs_link_semantic.doc_drift_findings.[1-hidden-types-server-accepted] ← activity-feed.md "hidden from the global Activity filter" + openapi.yaml:3259-3262 schema=ActivityEventType (any of 27 accepted) + ActivityServiceImpl.java:101-102 (eventType DTO valueOf, accepts any enum)
- docs_link_semantic.doc_drift_findings.[2-type-param-undocumented] ← activity-feed.md (no `type` mention) + ActivityController.java:32 + openapi.yaml:3255-3258 + ActivityServiceImpl.java:107-117
- docs_link_semantic.doc_drift_findings.[3-visibility-absent] ← activity-feed.md (no visibility statement) + ActivityController.java:1-58 + ActivityServiceImpl.java:86-117 + SecurityConstants.java:95-356 + enable-security/authorization (no per-endpoint wiring)
- docs_link_semantic.doc_drift_findings.[4-api-reference-404] ← WebFetch /developer-guides/api-reference/activity (404) + presence of /developer-guides/api-reference/alerts (parallel page exists for alerts tag)
- docs_link_semantic.doc_drift_findings.[5-spec-under-documents] ← openapi.yaml:3208-3209 (terse description) + 3211-3273 (no per-parameter descriptions) + 3289-3338
- implicit_adrs.[0] ← ActivityController.java:18-57 (exactly 2 methods, distinct return shapes) + openapi.yaml:3206-3347 (spec carries 2 operations under tag `activity`)
- implicit_adrs.[1] ← ActivityController.java:36,52 (exchange parameter unread) + ActivityServiceImpl.java:194,239 (identity reads via authIdentityProvider)
- implicit_adrs.[2] ← ActivityController.java:1-58 (no logging, no exception handling, no logic beyond delegate)
- bugs_limitations_corner_cases.[0-typo] ← ActivityController.java:34 + ActivityService.java:42 + openapi.yaml:3263-3267
- bugs_limitations_corner_cases.[1-unused-exchange] ← ActivityController.java:36,52
- bugs_limitations_corner_cases.[2-no-authz] ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + DisabledAuthSecurityConfiguration.java:16 + openapi.yaml:3206-3347 (no security:)
- bugs_limitations_corner_cases.[3-id-enumeration] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- bugs_limitations_corner_cases.[4-unbounded-size] ← ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292
- bugs_limitations_corner_cases.[5-sensitive-content] ← components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 + ActivityServiceImpl.java:86-117 + activity-feed.md (no caveat)
- bugs_limitations_corner_cases.[6-counts-4x-load] ← ActivityServiceImpl.java:139-166
- security.auth_mode_relevance ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter sidecar (batch D — path matcher /ingestion/entities only) + ActivityController.java (paths under /api/)
- security.authorization_assertions ← ActivityController.java:1-58 + SecurityConstants.java:95-356 (full file verified)
- security.owner_scoping ← ActivityController.java:23-41,43-56 + ActivityServiceImpl.java:86-117 + ActivityServiceImpl.java:168-217 + concepts.yaml:64,72
- security.data_exposure.[0] ← components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 + ActivityServiceImpl.java:86-217
- security.data_exposure.[1] ← ActivityController.java:43-56 + ActivityServiceImpl.java:139-258
- security.data_exposure.[2] ← ActivityController.java:30-31,33 + ActivityServiceImpl.java:179-181
- security.known_security_gaps.[0-no-authz-on-endpoint] ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + WebFetch /enable-security/authorization (200) + WebFetch /features/active-platform-features/activity-feed (200)
- security.known_security_gaps.[1-DISABLED-anonymous] ← ActivityController.java:1-58 + DisabledAuthSecurityConfiguration.java:16
- security.known_security_gaps.[2-S2S-leakage] ← ActivityController.java:1-58 + S2sAuthenticationFilter wiring (batch D)
- security.known_security_gaps.[3-id-enumeration] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 + (grep for rate-limit annotations in controller package: zero matches)
- security.known_security_gaps.[4-payload-sensitivity] ← components.yaml:2891-2935 + DescriptionActivityStateDto.java:3 + activity-feed.md (WebFetch 2026-05-20, status 200, no caveat)
- security.known_security_gaps.[5-rbac-audit-silence] ← V0_0_48__add_activity.sql:4,12 (NOT NULL FK) + ReactiveActivityRepositoryImpl batch-R sidecar invariants[0] + activity-feed.md (no scope-boundary statement)
- performance.hot_paths.[0] ← ActivityController.java:23-41 + ReactiveActivityRepositoryImpl.java:74-89,208-244,279-295
- performance.hot_paths.[1] ← ActivityServiceImpl.java:201-217 + ReactiveActivityRepositoryImpl.java:109-126
- performance.hot_paths.[2] ← ActivityController.java:43-56 + ActivityServiceImpl.java:139-166,219-258
- performance.hot_paths.[3] ← ActivityServiceImpl.java:184-199 + ReactiveActivityRepositoryImpl.java:91-107
- performance.throughput_characteristics ← ActivityController.java:23-56 + ActivityServiceImpl.java:86-166
- performance.resource_allocation ← ActivityServiceImpl.java:168-258 + ReactiveActivityRepositoryImpl.java:74-295
- performance.scaling_characteristics ← ActivityController.java:18 (stateless @RestController) + ActivityServiceImpl.java:86-258 + ActivityTablePartitionManager sidecar (F-010 partition rotation)
- performance.known_performance_gaps.[0-unbounded-size] ← ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292
- performance.known_performance_gaps.[1-counts-4x] ← ActivityServiceImpl.java:139-166
- performance.known_performance_gaps.[2-lineage-walk] ← ActivityServiceImpl.java:201-217
- performance.known_performance_gaps.[3-cursor-index] ← ActivityController.java:34-35 + ReactiveActivityRepositoryImpl.java:287-291
- performance.known_performance_gaps.[4-no-rate-limit] ← ActivityController.java:1-58 + (grep for @RateLimit / RateLimiter in controller package: zero matches)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: MEDIUM
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM

## Maintainer notes

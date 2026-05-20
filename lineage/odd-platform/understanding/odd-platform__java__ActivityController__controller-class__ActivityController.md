---
node_id: "odd-platform java ActivityController controller-class:ActivityController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: stress-complete
confidence_overall: HIGH
session_id: session-2026-05-20-T03
related_features:
  - F-021   # P-07:F-003 Activity Feed Audit-Trail Surface
  - F-006   # P-09:F-001 RBAC — audit-silence pattern
  - F-010   # P-08:F-002 Housekeeping / partition rotation (write-path lifecycle of the table this controller reads)
  - F-007   # P-07:F-001 Alerting — 4 of 27 event types originate here
related_pillar_features:
  - P-07:F-003
  - P-09:F-001
  - P-08:F-002
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
      THIS controller IS F-021's read entry-point. Batch G3 (file-analyser/0.4.0
      Stress Protocol rewrite) confirms the 2-method controller surface
      (GET /api/activity + GET /api/activity/counts) is the COMPLETE read
      surface for the global Activity Feed — there is no admin variant, no
      bulk export, no streaming alternative, and no programmatic API-reference
      page (WebFetch 2026-05-20: /developer-guides/api-reference/activity → 404).
      The filter shape on the controller mirrors the doc's 7 facets PLUS
      three undocumented public-API parameters: `type` (ActivityType view-mode
      dispatch), `last_event_id` + `last_event_date_time` (cursor pagination),
      and `size` (page size with no upper bound). Critically, the live doc
      page (WebFetch 2026-05-20, status 200) is SILENT on visibility,
      pagination, ordering, AND retention semantics — five categories of
      operator-facing behaviour completely missing.
  - kind: strengthens
    target: F-006
    note: |
      F-006's audit-silence pattern is structurally rooted at the schema
      level (`activity.data_entity_id NOT NULL FK`) and the controller-side
      limb is confirmed: NO `@PreAuthorize` on the class, NO `@PreAuthorize`
      on either method (lines 23, 43), NO entry for `/api/activity` or
      `/api/activity/counts` in `SecurityConstants.SECURITY_RULES` (zero
      matches across the 357-line file), NO `security:` block on either
      operation in openapi.yaml. The read surface is gated only by Spring's
      default `.authenticated()` rule. Combined with batch-R's schema-rooted
      scope, the picture is: every authenticated user sees every recorded
      change on every data entity across all owners — AND those recorded
      changes structurally cannot include RBAC mutations, Datasource
      registrations, Owner CRUD, or Collector token rotations.
  - kind: strengthens
    target: F-010
    note: |
      F-010's partition-rotation cycle (ActivityTablePartitionManager creates
      partitions; ActivityEmptyPartitionsHousekeepingJob drops only EMPTY
      past partitions; no row-level TTL exists) is the WRITE-PATH lifecycle
      for the table THIS controller reads. The cursor pagination shape
      `(lastEventId, lastEventDateTime)` ordered `created_at DESC, id DESC`
      (ReactiveActivityRepositoryImpl.java:291) means a paginating client
      reads newest-first into the growing partition tail; deep-window
      cursoring reaches into older partitions that — per F-010 — are NEVER
      dropped while non-empty. The controller's lack of `size` upper bound
      compounds the F-010-described unbounded-growth concern.
  - kind: conflicts_surfaced
    target: F-021
    note: |
      DOC-vs-CODE drift on FIVE categories. The live activity-feed.md page
      (WebFetch 2026-05-20, status 200, full inventory captured in
      `docs_link_semantic.fetched_excerpts`) says NOTHING about:
      (1) visibility / authorization / who-can-see — NOT MENTIONED
      (2) the `type` query parameter / 4 view-mode tabs — NOT MENTIONED
      (3) pagination / cursor / page size / default size — NOT MENTIONED
      (4) ordering / sort order / chronological — NOT MENTIONED
      (5) retention is mentioned only as a forward-pointer to the
          partition-period setting — partition WIDTH not retention.
      All five are operator-visible behaviours the controller embodies; the
      doc page is structurally incomplete.
  - kind: conflicts_surfaced
    target: F-021
    note: |
      ENUM-COUNT DRIFT (carries over from previous enrichments + confirmed
      2026-05-20). Doc lists 20 named event types + categorical mention of
      7 internal types (entity overview / metadata / schema / relation
      updates, custom metadata create / update / delete); spec
      (components.yaml:3167-3196) and DTO (ActivityEventTypeDto.java:3-31)
      carry 27 values. The 7 internal types are server-acceptable on the
      global endpoint (no server-side filtering by the framing 'hidden from
      global feed' — that framing is UI-tier-only).
upstream_callers:
  - kind: openapi-route
    via: "GET /api/activity → operationId getActivity (openapi.yaml:3206-3284) → ActivityController.getActivity (line 24-41)"
    notes: "OpenAPI spec routes the endpoint via the generated ActivityApi interface (`implements ActivityApi` on line 20); HTTP method, path, query parameter binding, and response shape come from the spec. NOTE: openapi.yaml uses $ref './components.yaml/#/components/parameters/SizeParam' (line 3273) — and SizeParam carries `required: true` (components.yaml:4226). So per the SPEC, `size` is REQUIRED on /api/activity. But the Java method declares `final Integer size` (boxed, nullable) — the controller doesn't validate. STRESS_A1 below."
  - kind: openapi-route
    via: "GET /api/activity/counts → operationId getActivityCounts (openapi.yaml:3286-3347) → ActivityController.getActivityCounts (line 44-56)"
    notes: "Same generation pattern; 8 query parameters (begin/end_date, datasource_id, namespace_id, tag_ids, owner_ids, user_ids, event_type). NO `size` parameter on counts (single payload), NO `type` parameter (response returns all four counts in one payload)."
  - kind: ui-component
    via: "odd-platform-ui Activity-page React component(s) — calls /api/activity via OpenAPI-generated TypeScript client"
    notes: "The Activity page in the UI is the primary visible consumer; per the per-entity Activity tab pattern (activity-feed.md line 14), every data-entity detail page also issues a /api/dataentities/{id}/activity call (a DIFFERENT endpoint owned by DataEntityController.getDataEntityActivity, not this controller)."
  - kind: external-api-client
    via: "Any caller authenticated under LOGIN_FORM/OAUTH2/LDAP, OR any caller under auth.type=DISABLED (anonymous), OR any S2S caller with auth.s2s.enabled=true (which grants ADMIN)"
    notes: "No @PreAuthorize, no entry in SecurityConstants.SECURITY_RULES — any authenticated identity reaches both endpoints. No programmatic API-reference page (verified 404 on /developer-guides/api-reference/activity); external consumers discover endpoints via the OpenAPI spec or the live Swagger UI."
downstream_side_effects:
  - kind: db-read
    target: "public.activity (range-partitioned by created_at, partition width 60d / cadence 30d per ActivityTablePartitionManager)"
    via: "ActivityServiceImpl → ReactiveActivityRepositoryImpl.findAllActivities / findMyActivities / findDependentActivities + the four count methods"
    notes: "Every call to getActivity issues 1 paginated SELECT over the partitioned activity table joined with DATA_ENTITY (INNER), USER_OWNER_MAPPING (LEFT, by OIDC_USERNAME only — see provider-null-cross-mode-bleed concept), OWNER (LEFT via the USER_OWNER_MAPPING join), plus conditional joins for DATA_SOURCE/NAMESPACE/TAG_TO_DATA_ENTITY/OWNERSHIP. Every call to getActivityCounts issues FOUR parallel SELECT COUNT(*) queries (Mono.zip — ActivityServiceImpl.java:158). Ordered by `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()` at ReactiveActivityRepositoryImpl.java:291 — STRESS_C2 below."
  - kind: db-read
    target: "user-owner mapping + owner tables (LEFT JOIN for actor resolution)"
    via: "ReactiveActivityRepositoryImpl.buildBaseQuery (lines 217-225) + addJoins (lines 227-244)"
    notes: "Actor identity (the activity's `created_by` username) is resolved to a catalog OwnerPojo via LEFT JOIN; NULL OwnerPojo surfaces as 'system' in the UI. The join filters by USER_OWNER_MAPPING.OIDC_USERNAME only — not by provider — so a LOGIN_FORM-authed 'alice' and an LDAP-authed 'alice' resolve to the same OwnerPojo (cross-mode-bleed; STRESS_D2)."
  - kind: lineage-graph-traversal
    target: "data_entity lineage graph"
    via: "ActivityServiceImpl.fetchDependentActivities → DataEntityRelationsService.getDependentDataEntityOddrns(LineageStreamKind)"
    notes: "Only fires when caller sets `type=UPSTREAM` or `type=DOWNSTREAM`. Cost depends on lineage graph depth at the call time. NOT caller-ownership filtered — anyone can ask 'what changed upstream of any entity I know an ID for' without being an owner."
  - kind: identity-resolution
    target: "AuthIdentityProvider.fetchAssociatedOwner()"
    via: "ActivityServiceImpl.fetchMyActivities (line 194) + ActivityServiceImpl.getMyObjectActivitiesCount (line 239)"
    notes: "Only fires for `type=MY_OBJECTS` and the myObjectsCount aggregate. Returns empty Mono if the user has no association → `switchIfEmpty(Flux.empty())` (ActivityServiceImpl.java:198) silently returns an empty feed. Visually indistinguishable on the UI from 'no activity in window'. STRESS_D3 below."
  - kind: error-propagation
    target: "Reactor onError signal → @RestControllerAdvice → HTTP 400/500 response"
    via: "ActivityServiceImpl.java:98-100 + ControllerAdvice.handleBadRequest(BadUserRequestException)"
    notes: "BadUserRequestException maps to HTTP 400 via ControllerAdvice.java:24-28. CRITICAL CAVEAT for getActivity: validation error is raised as `Flux.error(BadUserRequestException)` (ActivityServiceImpl.java:99), but the controller wraps the FLUX in `Mono.just(...)` then `.map(ResponseEntity::ok)` (lines 37-40) — the OUTER Mono never errors. The flux-error only manifests when WebFlux subscribes to the body. STRESS_B2 below — needs PROBE."
---

# ActivityController (class) — semantic understanding

## understanding

`ActivityController` is the 2-method REST class implementing `ActivityApi` (the OpenAPI-generated interface) that serves the global Activity Feed read surface: `GET /api/activity` (paginated event list, 12 query parameters) and `GET /api/activity/counts` (single-payload aggregate of total / my-objects / upstream / downstream counts, 8 query parameters). The class itself is pure plumbing — `@RestController` + `@RequiredArgsConstructor` injecting one collaborator (`ActivityService`), two `@Override` methods that wrap `activityService.*` calls in `Mono.just(...)`/`.map(ResponseEntity::ok)`. All validation (`beginDate`/`endDate` null check → `BadUserRequestException` via `Flux.error(...)` in the service), four-way view-mode dispatch (ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM), owner / lineage / cursor logic, and DTO mapping live in `ActivityServiceImpl`. The class carries no authorization annotations and is not enumerated in `SecurityConstants.SECURITY_RULES` — both endpoints fall to Spring's default `.authenticated()` rule, making the global cross-owner audit trail readable by any authenticated identity under LOGIN_FORM/OAUTH2/LDAP (and anonymously under DISABLED). Activity rows are ordered `ACTIVITY.CREATED_AT DESC, ACTIVITY.ID DESC` at the repository layer (ReactiveActivityRepositoryImpl.java:291) — a deterministic tie-break exists, but it is undocumented.

## concepts

- entities: [Activity (response DTO), ActivityCountInfo (response DTO), ActivityType (request enum: ALL/MY_OBJECTS/DOWNSTREAM/UPSTREAM), ActivityEventType (request enum: 27 values across 7 doc-grouped categories), ActivityService (delegate), ActivityApi (generated interface), BadUserRequestException (validation), ControllerAdvice (@RestControllerAdvice → HTTP 400 mapping)]
- operations: [list-activity-window, count-activity-aggregates, filter-by-7-facets, filter-by-view-mode-type, cursor-paginate, delegate-to-service, propagate-validation-error]
- invariants:
  - "Class implements one interface: `ActivityApi` (generated from openapi.yaml:3206-3347). HTTP method, path, query parameter binding, and response shapes come from generation — there are NO `@GetMapping` / `@RequestParam` annotations in this class (line 18-57)."
  - "Two endpoints exposed: `getActivity` (line 24) and `getActivityCounts` (line 44). Both are read-only `GET`s; the controller has NO write endpoint. The WRITE surface for activity rows is `ActivityServiceImpl.createActivityEvent` / `createActivityEvents` (lines 43-63), invoked by `@ActivityLog`-annotated services and AlertServiceImpl flows."
  - "Both methods accept `ServerWebExchange exchange` as the trailing parameter (lines 36, 52) but do NOT use it — neither method reads any header, principal, or attribute from the exchange. Authentication is asserted via the SecurityWebFilterChain BEFORE the handler runs."
  - "`getActivity` accepts 12 user-controlled query parameters + `exchange`: beginDate, endDate, size, datasourceId, namespaceId, tagIds, ownerIds, userIds, type, eventType, lasEventId (sic — typo preserved on the Java method signature; OpenAPI uses correct `last_event_id`), lastEventDateTime."
  - "`getActivityCounts` accepts 8 user-controlled query parameters + `exchange`: beginDate, endDate, datasourceId, namespaceId, tagIds, ownerIds, userIds, eventType. NO `type` parameter — the response returns all four view-mode counts simultaneously."
  - "Both methods return `Mono<ResponseEntity<...>>` — the reactive shape is preserved from interface through implementation; no thread blocking inside the controller. For `getActivity`, the response shape is `Mono<ResponseEntity<Flux<Activity>>>` — a Mono of an HTTP response wrapping a streaming Flux body."
  - "Repository-layer ORDER BY (read query): `ACTIVITY.CREATED_AT DESC, ACTIVITY.ID DESC` at ReactiveActivityRepositoryImpl.java:291. Deterministic tie-break on (created_at, id) — newer events first, with id descending as tie-break when two events share the same second-truncated created_at."
- audiences: [odd-platform-ui-end-user (global Activity page; activity-feed.md), odd-api-consumer (anyone driving /api/activity programmatically via the OpenAPI spec), platform-operator auditing change-history, security-compliance-reviewer reading post-incident, https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed]

## dependencies_semantic

- requires-feature:
  - "`ActivityService` (interface in service/activity/) — the controller's single injected collaborator (field at line 21); ActivityServiceImpl is the only implementation. Owns: BadUserRequestException validation (line 98-100), four-way ActivityType dispatch (line 107-117), ownership-resolution via AuthIdentityProvider (line 194), lineage-resolution via DataEntityRelationsService (line 212), mapping from ActivityPojo to OpenAPI Activity payload."
  - "`ActivityApi` (generated interface in api/contract/api/) — declares both method signatures the controller `@Override`s (lines 23, 43). All HTTP-binding (method, path, query parameters, response shape) lives on this interface; the controller is structurally an SPI implementation."
  - "`ControllerAdvice` @RestControllerAdvice (controller/exception/ControllerAdvice.java) — maps `BadUserRequestException` → HTTP 400 (lines 24-28). REQUIRED for getActivity's validation error to reach the caller as a 4xx (STRESS_B2 question hinges on whether @RestControllerAdvice catches Flux-internal errors or only Mono-level errors)."
  - "Spring WebFlux `@RestController` (line 18) + Lombok `@RequiredArgsConstructor` (line 19) — wires the bean and the single-arg constructor that takes `ActivityService activityService`."
- requires-config: []
- requires-runtime:
  - "Spring WebFlux reactive runtime (`@RestController` + Mono/Flux response signatures)."
  - "Reactor Core (`Mono.just(...).map(...)`)."
  - "OpenAPI-generated `ActivityApi` on the classpath — without it the controller does not compile."
- coupling:
  - "Authorization: NO `@PreAuthorize`, NO `hasPermission(...)`, NO programmatic permission check at controller layer. The generated `ActivityApi` interface carries no authorization annotations either. `/api/activity` and `/api/activity/counts` are NOT enumerated in `SecurityConstants.SECURITY_RULES` (zero matches in the full 357-line file). Neither path is in `WHITELIST_PATHS`. Access falls through to Spring's default rule under each auth mode: `pathMatchers('/**').authenticated()` (LoginFormSecurityConfiguration.java:57) / `AuthorizationCustomizer.java:29-30` (OAUTH2 + LDAP). Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration.java:16` calls `.anyExchange().permitAll()` — anonymous reachable."
  - "S2S coupling: `auth.s2s.enabled=true` grants the S2S caller ADMIN; that ADMIN identity satisfies `.authenticated()` and can read the full cross-owner audit trail. An operator who enables S2S for ingestion gives any token-holder full audit-trail read (the two-surface invariant)."
  - "Ingestion-filter coupling: `IngestionDataEntitiesFilter` applies only to `/ingestion/entities` — does NOT apply to `/api/*`. Setting `auth.ingestion.filter.enabled=true` does NOT add a gate to these endpoints."
  - "Schema-rooted scope: `ReactiveActivityRepositoryImpl` and V0_0_48 migration constrain `activity.data_entity_id` to NOT NULL + FK. Structural ceiling on what THIS controller can ever return: RBAC mutations, Owner CRUD, Datasource registrations, Collector token rotations CANNOT be in the result set."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - test_class: "(no test class exists)"
    behaviour: "Happy path `getActivity` with all defaults (type=null, no filters) returns 2xx with a Flux<Activity>; `getActivityCounts` returns 2xx with an ActivityCountInfo payload."
  - test_class: "(no test class exists)"
    behaviour: "Validation: `getActivity` with `beginDate=null` (or `endDate=null`) propagates BadUserRequestException through the Mono.error → HTTP 400. **STRESS_B2: untested whether @RestControllerAdvice catches Flux-internal error on a streaming-body response; the controller's Mono.just(Flux.error()).map(ResponseEntity::ok) shape means the OUTER Mono succeeds while the inner Flux errors only on subscription — Spring's actual behaviour at the headers/body seam needs probe.**"
  - test_class: "(no test class exists)"
    behaviour: "View-mode dispatch: `getActivity` with `type=MY_OBJECTS` filters by caller's owner; with `type=UPSTREAM`/`DOWNSTREAM` walks lineage; with `type=ALL` (and `type=null`) bypasses owner filter."
  - test_class: "(no test class exists)"
    behaviour: "Authorization: when `auth.type=LOGIN_FORM` (or OAUTH2 / LDAP) and the caller is unauthenticated, the SecurityWebFilterChain rejects the request (HTTP 401). When authenticated, the request reaches the controller regardless of ownership — no per-endpoint Permission gate."
  - test_class: "(no test class exists)"
    behaviour: "DISABLED-mode behaviour: under `auth.type=DISABLED`, an unauthenticated caller reaches the endpoint and reads the full cross-owner audit trail."
  - test_class: "(no test class exists)"
    behaviour: "User-id and owner-id enumeration: passing `userIds=[1..N]` returns activity rows only for ids that have generated events — the response cardinality leaks active-user ids."
  - test_class: "(no test class exists)"
    behaviour: "Cursor-pagination correctness: paginating with `(lastEventId=X, lastEventDateTime=Y)` returns the next-older window without overlap or skipped rows at the boundary. **STRESS_C2: also verifies the second-truncation in the WHERE predicate (ReactiveActivityRepositoryImpl.java:285-288) does not skip events that share the same second.**"
  - test_class: "(no test class exists)"
    behaviour: "Unbounded `size`: `getActivity` with `size=Integer.MAX_VALUE` does not reject; the DB plans a wide scan. STRESS_A2: also `size=null`, `size=0`, `size=-1`."
  - test_class: "(no test class exists)"
    behaviour: "Hidden-event-type filtering: `getActivity` with `eventType=DATA_ENTITY_OVERVIEW_UPDATED` (one of the 7 internal types) is accepted on the global endpoint."
  - test_class: "(no test class exists)"
    behaviour: "STRESS_E1: read-while-partition-create concurrency — verify that the boot-time and nightly cron CREATE TABLE PARTITION ACCESS EXCLUSIVE lock does not interfere with concurrent read traffic. Probe emitted (P-017)."
- test_files: []
- gaps: |
    The class has zero direct test coverage: no `ActivityControllerTest.java` exists under `odd-platform-api/src/test/`, and no test references `getActivity`, `getActivityCounts`, `getActivityList`, `fetchAllActivities`, `fetchMyActivities`, or `fetchDependentActivities` (verified via Glob across the test tree at session start; zero matches).

    The validation path (BadUserRequestException for null dates) is the most visible regression risk: a refactor that changes the Mono.just(Flux.error()) shape, or removes ControllerAdvice's BadUserRequestException handler, would silently change the error code (HTTP 400 → HTTP 200 with error in stream body) without any test catching it. This is also the Stress Protocol's STRESS_B2 question — the body-error vs headers-error split is untested.

    The four-way view-mode dispatch is the largest uncovered surface — refactoring ActivityType (renaming an enum value, collapsing branches, or adding a fifth view mode) could regress one or more dispatch arms silently. The MY_OBJECTS branch (only branch that consults `authIdentityProvider.fetchAssociatedOwner()`) is the highest-leverage gap: a refactor that changes the empty-Mono behaviour silently degrades MY_OBJECTS into 'shows nothing' — visually indistinguishable from 'no activity in window'.

    Cross-mode-bleed (LEFT JOIN by OIDC_USERNAME only) is unobservable at the controller layer in tests because all current happy-path test fixtures would use a single auth provider. A test that fixtures two providers with overlapping usernames would surface the bleed.

    The ordering (CREATED_AT DESC, ID DESC) is undocumented and untested — a refactor that drops the `ID DESC` tie-break would produce non-deterministic page boundaries (two events with identical second-truncated created_at could swap positions across paginated calls).

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
      Live page inventory (WebFetch 2026-05-20, status 200) — direct quotes
      from the 5-category visibility/UX inventory query:

      (1) Authorization / Visibility / RBAC / Permissions / Owners:
        "NOT MENTIONED — The page does not discuss who can access the
        Activity Feed, permission levels, or visibility controls."

      (2) Query Parameters / View-Mode Tabs (type=ALL/MY_OBJECTS/UPSTREAM/DOWNSTREAM):
        "NOT MENTIONED — The page does not mention `type` query parameters
        or tabs like 'My objects,' 'Upstream,' 'Downstream,' or 'All.'"

      (3) Pagination / Cursor / Page Size:
        "NOT MENTIONED — The page contains no information about pagination,
        cursor-based navigation, page sizes, or default limits."

      (4) Ordering / Sort Order / Chronological Arrangement:
        "NOT MENTIONED — The page does not specify how events are ordered,
        whether newest-first or chronological sorting is applied, or if
        sort order is configurable."

      (5) Data Retention / Partition Lifecycle:
        "'Activity-feed retention and partitioning are controlled by the
        platform-level setting `odd.activity.partition-period`' — The page
        references a configuration setting but defers specifics to external
        documentation."

      The page lists 20 visible event types in the global filter + a
      categorical mention of 7 internal types — the 7 are not enumerated by
      name. Sum = 27, matching components.yaml:3167-3196 and
      ActivityEventTypeDto.java:3-31.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/activity"
    anchor: ""
    rationale: "Expected per-tag API-reference page paralleling /developer-guides/api-reference/alerts."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Page returns 404 (inherited from previous file-analyser/0.2.0 enrichment
      at session-2026-05-20-T01; same status confirmed indirectly via the
      inventory above. The `activity` OpenAPI tag has no first-party
      reference page. Compare: /developer-guides/api-reference/alerts exists.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical authorization-vocabulary page — Policies / Permissions / Roles / Owners / User-owner association."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Five core authorization concepts: Policies, Permissions, Roles, Owners,
      User-owner association. The page does NOT mention any per-endpoint
      protection wiring for /api/activity or audit-log visibility controls
      (inherited verification from batch-N; within the 11-day stale-probe
      cadence per LSN-018, not re-fetched).
- doc_drift_findings:
  - "FIVE-CATEGORY DOC SILENCE (NEW finding, batch G3): the live activity-feed.md page (WebFetch 2026-05-20, status 200) is silent on authorization, type parameter, pagination, ordering, AND lifecycle. Every observable behaviour the controller embodies for an operator-facing audit-trail surface is missing from the public docs. This is not a single drift — it is a structurally incomplete page."
  - "ENUM-COUNT DRIFT (carried forward, verified): 20 named event types + categorical 7 internal types = 27, matching the code; but the 7 internal types are not enumerated by name."
  - "HIDDEN-TYPES SERVER-ACCEPTED (carried forward): the doc says the 7 internal types are 'hidden from the global Activity filter', but the controller and OpenAPI spec accept all 27 values. The 'hidden' framing is UI-tier-only."
  - "TYPE-PARAMETER UNDOCUMENTED (carried forward): doc page lists 7 filter facets but never mentions the `type` parameter (ALL/MY_OBJECTS/UPSTREAM/DOWNSTREAM) that the controller declares (line 32), the spec documents (openapi.yaml:3255-3258), and the service dispatches on (ActivityServiceImpl.java:107-117)."
  - "VISIBILITY-STATEMENT ABSENT (carried forward, with security implications): doc page makes no statement about who can see global activity. Reality: any authenticated user under LOGIN_FORM/OAUTH2/LDAP sees the full cross-owner audit trail; under DISABLED, anonymous. The page omits this, the authorization page omits per-endpoint wiring."
  - "API-REFERENCE 404 (carried forward, verified): /developer-guides/api-reference/activity returns 404; bi-directional code↔doc coverage gap (Gate 6)."
  - "OPENAPI SPEC UNDER-DOCUMENTS: openapi.yaml:3208-3209 carries 'Returns activity for dedicated period' — no per-parameter descriptions, no view-mode semantics, no cursor-pagination notes, no visibility statement, no ordering statement."
  - "SizeParam REQUIRED-IN-SPEC vs NULLABLE-IN-JAVA: openapi.yaml:3273 uses `$ref './components.yaml/#/components/parameters/SizeParam'` and SizeParam carries `required: true` (components.yaml:4226). But the Java method declares `final Integer size` — boxed, nullable, no validation. Spec says size is required; code accepts size=null. **NEW finding from STRESS_A1.**"

## implicit_adrs

- "The Activity read surface is exposed as a class with exactly 2 methods — global feed (`GET /api/activity`) and aggregate counts (`GET /api/activity/counts`) — with no admin variant, no streaming variant, no bulk export, no SSE. The pair-of-methods shape encodes a design that the global feed and the counts are SEPARATE API calls, computed independently (counts run 4 parallel queries; the list runs 1 paginated query)." — evidence: ActivityController.java:18-57 (only 2 methods exist) + openapi.yaml:3206-3347 (spec carries 2 operations under tag `activity`). — intent_anchor: "The two methods share filter parameters but return distinct shapes: `Mono<ResponseEntity<Flux<Activity>>>` for the list (line 24) and `Mono<ResponseEntity<ActivityCountInfo>>` for the aggregate (line 44); merging them would couple count-aggregation latency with paginated list-fetch latency." — confidence: MEDIUM
- "Controller methods accept `ServerWebExchange exchange` parameters they never read (lines 36, 52) — Spring WebFlux passes the exchange to handlers per the generated interface contract, but the controller does not consult headers, principals, or attributes. The convention is: authentication is asserted by the SecurityWebFilterChain before the handler runs; identity-driven dispatch lives in the service via `authIdentityProvider.fetchAssociatedOwner()`." — evidence: ActivityController.java:36,52 (exchange unread) + ActivityServiceImpl.java:194,239 (identity reads via authIdentityProvider). — intent_anchor: "The unused `exchange` parameters and the absence of any principal access from the controller layer signal a deliberate division: WebFilterChain owns authentication, service owns identity-driven dispatch, controller owns nothing." — confidence: MEDIUM
- "The controller class itself carries no logic, no `@PreAuthorize`, no `@Slf4j` (no logging), and no exception handling — it is intentionally thin to make the OpenAPI-generated interface the canonical source of HTTP-binding truth. The pattern is identical to AlertController and other controllers in the package." — evidence: ActivityController.java:1-58 (zero imports beyond Lombok + Spring base + the generated ActivityApi + DTOs + the service). — intent_anchor: "Every method body is exactly one statement: a Mono.just() wrapper or a direct service-method call mapped to ResponseEntity.ok. The shape is a 'pure proxy' pattern; the convention applies across the package." — confidence: HIGH
- "Cursor pagination via `(lastEventId, lastEventDateTime)` as a deliberate alternative to offset/limit — the activity table is append-only and grows monotonically (F-010); offset pagination would degrade quadratically. The repository implements this via `row(trunc(ACTIVITY.CREATED_AT, SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (ReactiveActivityRepositoryImpl.java:287-288) — a composite cursor that uses second-truncation to avoid microsecond-precision issues at the boundary." — evidence: ActivityController.java:34-35 (the two cursor parameters as a pair) + ReactiveActivityRepositoryImpl.java:283-291 (the composite cursor predicate). — intent_anchor: "The `row(...).lessThan(...)` shape with `trunc(CREATED_AT, SECOND)` is a standard cursor-pagination pattern adapted for second-precision timestamps; the same pattern appears at DataEntityController.getDataEntityActivity per concepts.yaml:108, establishing the convention." — confidence: HIGH
- "ORDER BY at the read query: `ACTIVITY.CREATED_AT DESC, ACTIVITY.ID DESC` (ReactiveActivityRepositoryImpl.java:291) — deterministic tie-break on (created_at, id), newest first, with id descending when two events share the same second-truncated timestamp." — evidence: ReactiveActivityRepositoryImpl.java:290-292 (orderBy + limit). — intent_anchor: "The `ACTIVITY.ID.desc()` tie-break is a deliberate determinism choice — without it, two events with identical second-truncated created_at could swap positions across paginated calls (the cursor predicate truncates to second). The dual-key ORDER BY closes that ambiguity." — confidence: HIGH (STRESS_C2 verified the actual ORDER BY at the lowest layer)

## bugs_limitations_corner_cases

- "Public-API parameter typo on the Java surface: `getActivity` declares `final Long lasEventId` on line 34 (missing the `t` in 'last'). The OpenAPI parameter is `last_event_id` (correct); the Java method signature exposes `lasEventId`. The controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)` (line 39); the service interface declares the parameter as `final Long lastEventId` (ActivityService.java:42). The typo is local to this controller's method signature; OpenAPI-generated client SDKs use the spec's `last_event_id` and would not carry the typo." — evidence: ActivityController.java:34 + ActivityService.java:42 + openapi.yaml:3263-3267. — severity: LOW
- "Both methods accept `ServerWebExchange exchange` (lines 36, 52) but reference it nowhere in the method bodies." — evidence: ActivityController.java:36,52. — severity: LOW
- "No `@PreAuthorize`, no programmatic authorization gate at the controller layer, and no entry for either endpoint in `SecurityConstants.SECURITY_RULES` (zero matches). Endpoints fall through to Spring's default `.authenticated()` rule; under DISABLED auth mode, anonymous traffic reaches them. The OpenAPI spec contains no `security:` block on either operation. The 'read-collaborative cross-owner enumeration posture' concept in the catalog is rooted here." — evidence: ActivityController.java:1-58 + SecurityConstants.java:95-356 + DisabledAuthSecurityConfiguration.java:16 + openapi.yaml:3206-3347. — severity: HIGH
- "`getActivity` accepts arbitrary `userIds` and `ownerIds` lists with no validation that the IDs reference existing users / owners. A caller can submit `userIds=[1..N]` to probe which ids correspond to active users via response cardinality. Combined with the lack of rate limiting on `/api/activity`, this is a low-cost id-enumeration vector." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 + grep for '@RateLimit'/'RateLimiter' in the controller package (zero matches). — severity: MEDIUM
- "`size` parameter has no `@Max` constraint, no documented upper bound, no programmatic check at controller or service layer, and is NULLABLE on the Java surface despite being marked `required: true` in the OpenAPI spec (components.yaml:4226). A caller submitting `size=Integer.MAX_VALUE` triggers a wide DB scan; submitting `size=null` propagates `null` to JOOQ `.limit(null)` — behaviour PROBE-NEEDED (STRESS_A1; probe P-016). Submitting `size=0` returns an empty Flux; submitting `size=-1` propagates a negative to PostgreSQL LIMIT which rejects at the DB layer (PROBE-NEEDED — STRESS_A2; probe P-016)." — evidence: ActivityController.java:26 (no `@Max`, no `@NotNull`) + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292 + components.yaml:4226 (`required: true`). — severity: MEDIUM
- "Audit-trail content sensitivity: `old_state` / `new_state` on the Activity payload includes free-text fields (descriptions, business names, custom-metadata values). The platform does not redact, mask, or sensitivity-label these fields at the API surface. The doc page contains no caveat about description sensitivity." — evidence: components.yaml:2891-2935 + DescriptionActivityStateDto.java:3 + activity-feed.md (WebFetch 2026-05-20, status 200, no caveat). — severity: MEDIUM
- "`getActivityCounts` issues 4 parallel aggregation queries per call (Mono.zip of totalCount / myObjectsCount / downstreamCount / upstreamCount per ActivityServiceImpl.java:158-165). A UI that polls the counts endpoint on a refresh interval drives 4× the apparent endpoint count of DB load. No caching, no debouncing, no precomputed aggregate." — evidence: ActivityServiceImpl.java:139-166. — severity: LOW
- "Validation-error response shape ambiguity (NEW finding, STRESS_B2): `getActivity`'s validation path uses `Flux.error(BadUserRequestException)` from the service layer (ActivityServiceImpl.java:99), wrapped by the controller as `Mono.just(<error-flux>).map(ResponseEntity::ok)` (lines 37-40). The OUTER Mono of `ResponseEntity<Flux<Activity>>` succeeds — `.ok(<flux>)` produces a 200 status. The Flux body errors only when WebFlux subscribes to write the response body. Whether @RestControllerAdvice's BadUserRequestException handler (ControllerAdvice.java:24-28) maps this to HTTP 400 depends on whether the body-subscription error is raised BEFORE the 200 headers are committed. **Outcome PROBE-NEEDED — emitted P-015.** Operator-visible impact: if response headers commit before subscription, callers receive HTTP 200 with an error in the streaming body; if Spring rescues, HTTP 400 with ErrorResponse JSON." — evidence: ActivityController.java:37-40 + ActivityServiceImpl.java:98-100 + ControllerAdvice.java:24-28 + Mono.just / ResponseEntity.ok semantics (untested at runtime). — severity: HIGH (operator-visible error-response shape; pinned to probe)

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED (dev-only)
  - "`/api/activity` and `/api/activity/counts` are UI/API-surface endpoints. Under LOGIN_FORM/OAUTH2/LDAP, Spring's default `.authenticated()` rule applies (LoginFormSecurityConfiguration.java:57 / AuthorizationCustomizer.java:29-30). Endpoints are not in `WHITELIST_PATHS` and not in `SECURITY_RULES`. Under `auth.type=DISABLED` (DisabledAuthSecurityConfiguration.java:16), `.anyExchange().permitAll()` opens the endpoints to anonymous callers. S2S applies — `auth.s2s.enabled=true` grants ADMIN identity that satisfies `.authenticated()` and reads the full audit trail." — evidence: ActivityController.java:1-58 + SecurityConstants.java:95-356 (full file verified) + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16.
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. `IngestionDataEntitiesFilter` applies only to `/ingestion/entities`; neither of these endpoints is reachable through the ingestion path."
- authorization_assertions: []
  - "Neither method carries `@PreAuthorize`, `@PostAuthorize`, `@Secured`, programmatic `permissionService.hasPermission(...)` call, or any other authorization check. The generated `ActivityApi` interface has no authorization annotations." — evidence: ActivityController.java:18-57 + ActivityApi.java (generated interface) + SecurityConstants.java:98-356.
- owner_scoping: "BYPASSES by default (`type=null` and `type=ALL`); BYPASSES for `type=UPSTREAM`/`DOWNSTREAM` (lineage-scoped, not caller-ownership-scoped); RESPECTS for `type=MY_OBJECTS` (consults `authIdentityProvider.fetchAssociatedOwner()`)."
  - "Default path returns activity rows for every data entity matching the date/datasource/namespace/tag/owner/user filters — across ALL owners. Only MY_OBJECTS filters to the caller's owner association. UPSTREAM/DOWNSTREAM walks the lineage graph WITHOUT ownership filtering — anyone can ask 'what changed upstream of any entity I know' regardless of whether they own it. Consistent with the read-collaborative posture (concepts.yaml:64,72)." — evidence: ActivityController.java:23-41 + ActivityServiceImpl.java:86-117 (the four-way dispatch) + ActivityServiceImpl.java:168-182 (no owner filter) + ActivityServiceImpl.java:184-199 (fetchAssociatedOwner only here) + ActivityServiceImpl.java:201-217 (lineage-scoped, no ownership filter).
- data_exposure:
  - "Activity payload (Activity schema, components.yaml:2861-2889): id, event_type (one of 27 enum values), created_at, created_by (AssociatedOwner — exposes actor's owner + username), data_entity (DataEntityRef — exposes entity's oddrn, naming, type), old_state + new_state (every tracked field's value before/after — descriptions, business names, dataset-field internal names, custom-metadata values, term/tag assignments, ownership transitions, alert halt-config changes). → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any caller under DISABLED; any S2S caller." — evidence: components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 + ActivityServiceImpl.java:86-117.
  - "ActivityCountInfo payload: totalCount (cross-owner, no filter), myObjectsCount (owner-scoped), downstreamCount + upstreamCount (lineage-scoped, NO caller-ownership filter). Even a caller with no owner association can read totalCount." — evidence: ActivityController.java:43-56 + ActivityServiceImpl.java:139-166,219-258.
  - "Filter parameters as enumeration probes: passing `userIds=[1..N]` reveals which ids have generated activity; passing `eventType=DATA_ENTITY_OVERVIEW_UPDATED` reveals that the 7 'hidden' internal types are surfaceable through the global endpoint." — evidence: ActivityController.java:30-31,33 + ActivityServiceImpl.java:179-181.
- known_security_gaps:
  - "`/api/activity` and `/api/activity/counts` have no per-endpoint authorization wiring. Any authenticated user reads the GLOBAL cross-owner audit trail, including audit events on resources they have no ownership association with. The Policies/Permissions/Roles/Owners framework is not applied. The user-facing activity-feed.md page contains no warning (WebFetch 2026-05-20: visibility NOT MENTIONED)." — evidence: ActivityController.java:1-58 + SecurityConstants.java:95-356 + WebFetch /features/active-platform-features/activity-feed (200, no visibility statement). — severity: HIGH
  - "Under `auth.type=DISABLED` the endpoints are reachable by anonymous traffic — no fail-closed behaviour. A production deployment that mis-sets `auth.type` exposes the full cross-owner audit trail (including actor usernames, ownership transitions, description content) to anyone able to reach the application port." — evidence: ActivityController.java:1-58 + DisabledAuthSecurityConfiguration.java:16. — severity: MEDIUM (gated on dev-only deployment guidance being followed)
  - "S2S exposure: `auth.s2s.enabled=true` grants ADMIN to any caller bearing a valid S2S token; ADMIN reads the full audit trail. An operator enabling S2S for ingestion (e.g. a collector token) inadvertently grants that token-holder full audit-read." — evidence: ActivityController.java:1-58 + S2sAuthenticationFilter wiring per batch-D sidecars. — severity: MEDIUM
  - "`userIds` and `ownerIds` filter parameters allow low-cost id enumeration via response-cardinality side-channel. No rate limiting on the endpoint. Combined with the unbounded `size` parameter, a sweep of id ranges is operationally trivial." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 + grep for rate-limit annotations (zero matches). — severity: MEDIUM
  - "Audit-trail content sensitivity: `old_state` / `new_state` includes free-text fields (descriptions, business names, custom-metadata values). No redaction, no masking, no sensitivity-label. Any operator who has used descriptions for incident notes, customer identifiers, or internal tickets has those fields readable by every authenticated user." — evidence: components.yaml:2891-2935 + DescriptionActivityStateDto.java:3 + activity-feed.md (no caveat). — severity: MEDIUM
  - "Audit-trail SILENCE on RBAC/Owner CRUD/Datasource/Collector mutations (F-006 9-sidecar pattern, batch R schema-rooted): this controller surfaces only what `activity.data_entity_id NOT NULL` permits — a Role creation, Policy edit, Owner deletion, or Collector token rotation produces NO row in this feed. A security-compliance reviewer reading the feed cannot detect a Policy edited to remove a permission gate." — evidence: V0_0_48__add_activity.sql:4,12 (NOT NULL FK) + ReactiveActivityRepositoryImpl batch-R sidecar invariants[0] + activity-feed.md (no scope-boundary statement). — severity: HIGH
  - "STRESS_D2: Provider-NULL cross-mode bleed — the LEFT JOIN at ReactiveActivityRepositoryImpl.java:220-222 joins `USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY` filtered only by `USER_OWNER_MAPPING.DELETED_AT IS NULL` — NO provider filter. A LOGIN_FORM-authed user 'alice' creating activity, then an LDAP-authed user 'alice' on the same platform would resolve to the SAME OwnerPojo in the audit feed. Inferred from the LEFT JOIN shape; verified by neighbour repository sidecar." — evidence: ReactiveActivityRepositoryImpl.java:220-222. — severity: MEDIUM
  - "STRESS_D3: MY_OBJECTS silent-empty for users with no owner association — `ActivityServiceImpl.fetchMyActivities` calls `authIdentityProvider.fetchAssociatedOwner()` and `switchIfEmpty(Flux.empty())` (line 198). A user authenticated but unmapped sees an empty feed; visually indistinguishable from 'no activity in window'. No error, no log, no header — operator cannot distinguish 'I'm unmapped' from 'no events'." — evidence: ActivityServiceImpl.java:184-199. — severity: LOW (UX-shaped, but with security implications: an admin investigating a user's activity scope cannot detect the empty-mapping condition)

## performance

- hot_paths:
  - "`getActivity` (default path, type=null or type=ALL): 1 partitioned SELECT over `public.activity` joined with DATA_ENTITY (INNER), USER_OWNER_MAPPING (LEFT) + OWNER (LEFT via mapping), plus conditional joins for DATA_SOURCE/NAMESPACE/TAG_TO_DATA_ENTITY/OWNERSHIP. Filtered by 8 facets + cursor; ordered `created_at DESC, id DESC` (ReactiveActivityRepositoryImpl.java:291); limited to `size`. For wide-window calls with no filters and large `size`, the scan touches multiple partitions." — evidence: ActivityController.java:23-41 + ReactiveActivityRepositoryImpl.java:74-89,208-244,279-295.
  - "`getActivity` (type=UPSTREAM/DOWNSTREAM): lineage-graph resolution BEFORE the activity SELECT — `DataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)` runs first, then the activity query restricts by `DATA_ENTITY.ODDRN IN (...)`. For deep lineage graphs, the resolution step dominates latency." — evidence: ActivityServiceImpl.java:201-217 + ReactiveActivityRepositoryImpl.java:109-126.
  - "`getActivityCounts`: 4 parallel Mono.zip aggregation queries against `activity` (totalCount + myObjectsCount + downstreamCount + upstreamCount). Every call drives 4 SELECT COUNT(*) round-trips. A UI polling this endpoint multiplies DB load 4×." — evidence: ActivityController.java:43-56 + ActivityServiceImpl.java:139-166,219-258.
  - "`getActivity` (type=MY_OBJECTS): 1 lookup against `user_owner_mapping` to resolve `fetchAssociatedOwner()` + 1 activity-table SELECT filtered by `OWNERSHIP.OWNER_ID = currentOwnerId`. Lower cost than the default path because OWNERSHIP join narrows the result set early." — evidence: ActivityServiceImpl.java:184-199 + ReactiveActivityRepositoryImpl.java:91-107.
- throughput_characteristics:
  - "Reactive Mono/Flux signature — non-blocking on request thread; DB I/O is the bottleneck. The Flux<Activity> response streams through the WebFlux pipeline without buffering the full result in controller memory."
  - "Single-window GET per call — no streaming alternative, no chunked response, no batch / bulk variant. A UI rendering a multi-window dashboard issues N separate calls."
  - "Cursor pagination via `(lastEventId, lastEventDateTime)` — client controls page boundaries; server has no session state."
  - "No SSE / WebSocket variant for real-time activity-feed updates — clients poll. The frequency of polling drives `getActivityCounts` load."
- resource_allocation:
  - "Per-call cost (type=null or ALL): 1 DB read over `activity` filtered by 8 facets. Memory: bounded by Flux backpressure and `size`."
  - "Per-call cost (type=MY_OBJECTS): 1 user-owner-mapping lookup + 1 activity-table SELECT (narrowed by OWNERSHIP)."
  - "Per-call cost (type=UPSTREAM/DOWNSTREAM): 1 lineage-graph traversal + 1 activity-table SELECT (narrowed by IN-clause on resolved oddrns)."
  - "Per-call cost (counts endpoint): 4× the corresponding list query without the LIMIT — full-window COUNT(*) aggregations."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally. No session state, no in-memory cache, no per-instance counters."
  - "Read path only — no row-level lock, no advisory lock. Concurrent calls compete for DB connections and Postgres planner resources but do not serialise on locks."
  - "Cursor pagination scales linearly with page count for the requesting client; offset pagination (not used) would degrade quadratically."
  - "No server-enforced upper bound on `size` — a single mis-tuned client can drive arbitrarily expensive single round-trips. DB plan + Postgres LIMIT clause are the only safeguard."
  - "F-010 interaction: the `activity` table grows monotonically while non-empty partitions are never dropped. Read scans over the full historical window scale with deployment age."
  - "STRESS_E1: read-during-CREATE-PARTITION concurrency — `CREATE TABLE ... PARTITION OF activity` takes ACCESS EXCLUSIVE on the parent during DDL (boot-time + nightly cron). Read traffic blocks behind the DDL lock for the brief window of CREATE; in Postgres 12+ this is fast metadata-only operation. Inferred from PartitionServiceImpl.java:60-66 (CREATE statement) + the absence of any read-side lock-hint. The interaction is benign in steady-state but pathological if many readers stack behind a slow CREATE." — evidence: PartitionServiceImpl.java:60-66 + ReactiveActivityRepositoryImpl.java (no lock hints).
- known_performance_gaps:
  - "`size` parameter has no `@Max` constraint and no programmatic upper bound (line 26). A single call with `size=Integer.MAX_VALUE` triggers a wide DB scan." — evidence: ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292. — severity: MEDIUM
  - "`getActivityCounts` issues 4 parallel aggregation queries per call with no caching, debouncing, or precomputed aggregate." — evidence: ActivityServiceImpl.java:139-166. — severity: LOW
  - "`fetchDependentActivities` runs a lineage-graph traversal in the hot path before issuing the activity query — for entities with deep upstream/downstream graphs, this is multi-hop network/CTE work per call. No precomputed dependency-set on activity rows." — evidence: ActivityServiceImpl.java:201-217. — severity: LOW (depends on deployment-specific lineage depth)
  - "Composite-cursor predicate `row(trunc(ACTIVITY.CREATED_AT, SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (ReactiveActivityRepositoryImpl.java:287-288) requires an index covering `(created_at DESC, id DESC)` on `activity` to avoid full-partition scans on deep pagination. The index strategy lives in the V0_0_48 migration, not in this controller; an index loss would degrade pagination linearly with depth." — evidence: ActivityController.java:34-35 + ReactiveActivityRepositoryImpl.java:287-291. — severity: LOW (out-of-scope for the controller, but worth surfacing)
  - "No rate limiting at the controller layer — a hostile or mis-tuned client can drive arbitrarily many `getActivity` calls with arbitrarily large `size` values." — evidence: ActivityController.java:1-58 + grep for `@RateLimit`/`RateLimiter` in controller package (zero matches). — severity: MEDIUM

## stress_findings

Per file-analyser/0.4.0 Rule 9 (Stress Protocol — non-negotiable). For each
trigger detected in the code, one of three resolutions: STATIC-INFERRED
(trace-answer in the code), PROBE-NEEDED (requires runtime; probe emitted),
REFERENCE (out-of-scope; another sidecar answers).

### Category A — Tunables

- id: STRESS_A1
  trigger: "`size` parameter at ActivityController.java:26 — `final Integer size` (boxed, nullable, no `@Max`, no `@NotNull`); OpenAPI SizeParam is `required: true` (components.yaml:4226)."
  question: "What does the controller do when `size=null` is passed? What does the DB do when JOOQ `.limit(null)` is invoked? Operator-visible outcome at each boundary."
  resolution: STATIC-INFERRED
  answer: |
    `size=null` propagates from controller through service (ActivityServiceImpl.java:179-180) into repository (ReactiveActivityRepositoryImpl.java:292: `.limit(size)` with a nullable Integer). JOOQ's `.limit(Integer)` accepts null and treats it as "no LIMIT clause" — the generated SQL omits LIMIT entirely. The full result set is streamed back: an unbounded scan of the activity table for the date window. The OpenAPI spec's `required: true` is NOT enforced because Spring's parameter binding uses the boxed type from the generated interface (Integer) — null binding is silently allowed. Operator-visible drift: the spec says size is required, the code accepts null and returns the full table. **This is a DOC-vs-SPEC-vs-CODE inconsistency.**
  evidence: "ActivityController.java:26 + components.yaml:4226 (`required: true`) + ReactiveActivityRepositoryImpl.java:292 (.limit(size) with no null guard) + JOOQ documentation behaviour (null → no LIMIT clause emitted)."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: docs_link_semantic.doc_drift_findings.[size-required-vs-nullable] + bugs_limitations_corner_cases.[size-unbounded]
  routes_to_probe: P-016

- id: STRESS_A2
  trigger: "`size` parameter at ActivityController.java:26 — no `@Min` or `@Max` validation."
  question: "What does the controller do when `size=0`? `size=-1`? `size=Integer.MAX_VALUE`?"
  resolution: STATIC-INFERRED + PROBE-NEEDED
  answer: |
    `size=0`: JOOQ emits `LIMIT 0` → DB returns empty result set; controller returns 200 OK with empty Flux. STATIC-INFERRED HIGH.
    `size=-1`: JOOQ emits `LIMIT -1`; PostgreSQL rejects negative LIMIT with `ERROR: LIMIT must not be negative`. The error propagates as a Reactor onError to the controller; ControllerAdvice.handleServerException catches the generic exception and returns HTTP 500 with `Internal Server Error`. Operator-visible: a -1 size yields a 500, not a 400. STATIC-INFERRED MEDIUM (the Postgres error is well-known; the exception-to-500 mapping is inferred from ControllerAdvice.java:61-66).
    `size=Integer.MAX_VALUE` (2.1B): JOOQ emits `LIMIT 2147483647`; PostgreSQL accepts and plans a full-table scan against the activity table, bounded only by the row count in the date window. For a 1M-row window the response streams 1M Activity payloads through Flux backpressure to the client. STATIC-INFERRED HIGH.
    PROBE-NEEDED for the -1 case to confirm the actual HTTP status code (500 vs 400 vs 422) and the error body shape. Emitted P-016.
  evidence: "ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292 + ControllerAdvice.java:61-66 + PostgreSQL LIMIT documentation."
  confidence: STATIC-INFERRED HIGH for size=0 and size=MAX_VALUE; PROBE-NEEDED for size=-1
  routes_to_probe: P-016
  routes_to_finding: bugs_limitations_corner_cases.[size-unbounded] + known_security_gaps.[id-enumeration]

- id: STRESS_A3
  trigger: "`odd.activity.partition-period` config consumer (ActivityTablePartitionManager.java:11, default 30) — bounds the partition lifecycle but indirectly bounds what THIS controller can read."
  question: "What does the controller's read query return when the date window exceeds the available partition coverage?"
  resolution: REFERENCE
  answer: |
    The activity table grows monotonically (F-010); empty past partitions are dropped by ActivityEmptyPartitionsHousekeepingJob but non-empty partitions are NEVER dropped. So for a deployment older than partition-period × N days with no maintenance, the controller can read the full history. The read query at ReactiveActivityRepositoryImpl.java:290-292 has no defensive partition-bounds check. For a date window where Postgres has no partition (e.g. activity table 2y old; query for beginDate = 5y ago), Postgres returns zero rows from the un-covered window without error. STATIC-INFERRED HIGH at the controller scope.
  evidence: "ReactiveActivityRepositoryImpl.java:290-292 + neighbour sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md` (F-010 interaction)."
  routes_to_sidecar: lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md

### Category B — Name-behavior pairs

- id: STRESS_B1
  trigger: "Method name `getActivity` (line 24) promises 'returns activity events'; `getActivityCounts` (line 44) promises aggregate counts."
  question: "Do the names match the implementation? What does the SQL chain actually return?"
  resolution: STATIC-INFERRED
  answer: |
    `getActivity` → ActivityServiceImpl.getActivityList → fetchAllActivities/fetchMyActivities/fetchDependentActivities → ReactiveActivityRepositoryImpl.findAllActivities → SELECT over activity JOIN data_entity etc., ordered by `CREATED_AT DESC, ID DESC`, limited to `size`. Name MATCHES: it does return activity events in a paginated window.
    `getActivityCounts` → ActivityServiceImpl.getActivityCounts → 4 parallel `SELECT COUNT(*)` queries (totalCount, myObjectsCount, downstreamCount, upstreamCount). Name MATCHES: it does return aggregate counts.
    BUT: the `total` in totalCount is misleadingly named. `getTotalCount` (ActivityServiceImpl.java:219-230) computes `COUNT(*)` of the cross-owner activity matching the filter set — it is "the total visible to the caller", not "the absolute total of all activity in the platform". For an unauthenticated caller under LOGIN_FORM (rejected at the WebFilterChain), there's no API access. For an authenticated caller, the count is over what the caller can SEE — which is everything except RBAC/Owner CRUD/Datasource mutations (audit-silence). The "total" framing is consistent with the controller's read-collaborative posture but a security-compliance reviewer reading "total activity count = 5,234" should understand this excludes the silenced categories. STATIC-INFERRED HIGH.
  evidence: "ActivityController.java:24,44 + ActivityServiceImpl.java:86-117,139-166,219-258 + ReactiveActivityRepositoryImpl.java:74-126,144-206."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: implicit_adrs.[2-thin-proxy] + known_security_gaps.[6-rbac-audit-silence]

- id: STRESS_B2
  trigger: "`getActivity` validation path uses `Flux.error(BadUserRequestException)` from the service (ActivityServiceImpl.java:99), wrapped by the controller as `Mono.just(<flux>).map(ResponseEntity::ok)` (ActivityController.java:37-40). The Mono successfully produces a `ResponseEntity.ok(<error-flux>)`."
  question: "Does the @RestControllerAdvice handler (ControllerAdvice.handleBadRequest, mapping BadUserRequestException → 400) ACTUALLY catch this error and return HTTP 400, or does Spring commit HTTP 200 headers before subscribing to the body Flux (in which case the caller receives HTTP 200 + error-in-stream)?"
  resolution: PROBE-NEEDED
  answer: |
    The OUTER Mono returns `Mono<ResponseEntity<Flux<Activity>>>` successfully — `.ok(<flux>)` constructs a 200 response with the flux as the body. Spring WebFlux's `ResponseEntityResultHandler` would then subscribe to the body Flux to write it; at that point the Flux.error materialises. Spring's default error-handling chain DOES include `AbstractErrorWebExceptionHandler` which can rescue errors before headers commit — but that path is fragile and depends on the response-writer's order of operations. The 7 sibling Mono-return controllers (e.g. getActivityCounts at line 53) propagate errors UP the outer Mono, where @RestControllerAdvice catches at the boundary; this getActivity path is asymmetric.
    Possible outcomes:
    (a) Spring rescues: HTTP 400 with ErrorResponse JSON body (per ControllerAdvice). The 200 headers were never committed because the Flux subscription failed pre-write.
    (b) Headers commit first: HTTP 200 with the error materialising in the streaming body as a Reactor onError signal — client receives a 200 with a malformed JSON array or a connection-closed-mid-stream.
    (c) Spring commits 500 with generic Internal Server Error (the generic Exception handler catches what the BadUserRequestException handler missed due to the WebFlux body-subscription seam).
    The current empirical behaviour is unknown. **PROBE-NEEDED: P-015 emitted.**
  evidence: "ActivityController.java:37-40 + ActivityServiceImpl.java:98-100 + ControllerAdvice.java:24-28 + Spring WebFlux ResponseEntityResultHandler internals (not statically determinable without runtime test)."
  confidence: PROBE-NEEDED
  routes_to_probe: P-015
  routes_to_finding: bugs_limitations_corner_cases.[validation-error-shape-ambiguity]

### Category C — Orderings / pagination / aggregation

- id: STRESS_C1
  trigger: "Cursor pagination at ReactiveActivityRepositoryImpl.java:284-288: `row(trunc(ACTIVITY.CREATED_AT, SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)`. Second-precision truncation."
  question: "What happens when two activity events share the same second-truncated `created_at`? Does the second-truncated cursor predicate skip events?"
  resolution: STATIC-INFERRED
  answer: |
    The cursor predicate is composite `(trunc(created_at, SECOND), id) < (truncated_cursor_time, cursor_id)`. SQL row-tuple comparison: for two events A (created_at=10:00:01.5, id=100) and B (created_at=10:00:01.7, id=99), both share `trunc(...) = 10:00:01.0`. After fetching event A, the cursor passes (10:00:01, 100). For the next page, the predicate becomes `(10:00:01, ?) < (10:00:01, 100)` which means `id < 100` (lexicographic on tuple). Event B (id=99) IS less than 100 — included.
    Edge case: if 5 events share the same second AND have id assignments that don't strictly decrease relative to the cursor (e.g. A=id 100, B=id 99, C=id 101), the cursor passing (10:00:01, 99) on the next page selects `id < 99` — skipping event C (id=101) that hadn't yet been returned. C would be returned ONLY if a later page's cursor passed an id >= 101.
    The ORDER BY at line 291 is `CREATED_AT DESC, ID DESC` — so events ordered by descending id within the same second. The cursor's id refers to the LAST returned event's id. If the client paginates page 1 ending at id 100, page 2 starts at id < 100 — events with id in (100, ∞) ARE NOT returned on page 2. The ordering guarantees this is correct AT BOUNDARY for events strictly newer than the cursor; for events sharing the second-truncated time, the predicate works because ORDER BY id DESC means we returned higher ids first.
    BUT: a write that lands AFTER the first page was returned and BEFORE the second page is requested — with a new id higher than 100 but timestamp in the SAME second — would NOT be returned by page 2 (it would be returned ONLY by a refresh of page 1). This is the expected behaviour for cursor pagination (consistency over recency).
    Conclusion: the cursor IS deterministic and SHOULD NOT skip events for a static snapshot of the activity table. For an actively-written table, new events landing within the cursor's already-seen time range would be skipped on subsequent pages — that's by design (cursor pagination provides consistent windowing over an append-only log; new inserts within a paged window are page-1-only).
    STATIC-INFERRED MEDIUM — the analysis assumes JOOQ's row-tuple `.lessThan(...)` translates to PostgreSQL's `ROW(a, b) < ROW(c, d)` semantics, which is lexicographic by definition.
  evidence: "ReactiveActivityRepositoryImpl.java:283-291 + PostgreSQL row-tuple comparison documentation + JOOQ row(...).lessThan(...) translation behaviour."
  confidence: STATIC-INFERRED MEDIUM
  routes_to_finding: implicit_adrs.[4-order-by-tie-break]

- id: STRESS_C2
  trigger: "ORDER BY at ReactiveActivityRepositoryImpl.java:291: `orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())`."
  question: "Does the implementation order match the name `getActivity` and operator expectations? Is the tie-break deterministic?"
  resolution: STATIC-INFERRED
  answer: |
    Ordering: CREATED_AT DESC (newest first), then ID DESC (newer ID first when timestamps tie). Deterministic tie-break — two events with the same created_at always return in the same id order. MATCHES the implicit operator expectation of "newest activity first". NOT documented on the live doc page (WebFetch 2026-05-20: ordering NOT MENTIONED).
    The LSN-019 class miss does NOT apply here — `getActivity` is not name-mismatched like `listMostPopular` was. The name "get activity" makes no specific ordering promise; the implementation provides reasonable defaults.
    However: STRESS_C1's edge case (active writes during pagination) is invisible to the operator reading the docs — there is no caveat that newly-arriving events within a paged window are page-1-only.
    STATIC-INFERRED HIGH for the ordering itself; STATIC-INFERRED MEDIUM for the operator-visible drift (the docs say nothing about ordering at all).
  evidence: "ReactiveActivityRepositoryImpl.java:290-292 + WebFetch activity-feed.md (ordering NOT MENTIONED)."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: implicit_adrs.[4-order-by-tie-break] + doc_drift_findings.[ordering-absent]

- id: STRESS_C3
  trigger: "`getActivityCounts` issues 4 parallel SELECT COUNT(*) queries via Mono.zip (ActivityServiceImpl.java:158-165)."
  question: "What ordering do the count aggregates use? What happens when the 4 parallel queries land at different transaction snapshots?"
  resolution: STATIC-INFERRED
  answer: |
    COUNT(*) is order-independent (cardinality doesn't depend on ordering). The 4 queries run in parallel via Mono.zip with no shared transaction — each is a separate read snapshot. For a steadily-written activity table, a count taken at T=0 (totalCount), T=0+epsilon (myObjectsCount), T=0+2epsilon (downstreamCount), T=0+3epsilon (upstreamCount) can each return values reflecting different write states. The 4 counts are NOT mutually consistent: `totalCount` may be 100, `myObjectsCount` 12, `downstreamCount` 5, `upstreamCount` 8 — but the underlying snapshot for total is the latest commit at T=0, while my/downstream/upstream may include later commits. The UI displaying `total - my - downstream - upstream = "other"` would compute a slightly-skewed value.
    STATIC-INFERRED HIGH — the absence of `Mono.zip(...).usingScheduler(...)` or a shared transaction context makes this trivially true. The aggregate-cross-consistency is a known property of Mono.zip; the question is whether the UI math depends on consistent snapshots. It probably doesn't (the UI shows 4 numbers separately, not a derived "other"), but if a downstream caller computes deltas, the inconsistency surfaces.
  evidence: "ActivityServiceImpl.java:139-166 (Mono.zip of 4 separate Mono queries, no shared TX context) + ActivityServiceImpl.java:219-258 (each count method opens its own DB connection via JooqReactiveOperations)."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: known_performance_gaps.[counts-4x]

### Category D — Authorization gates

- id: STRESS_D1
  trigger: "ActivityController.java:1-58 has NO @PreAuthorize on either method, NO class-level authorization annotation. ActivityApi (generated interface) carries no authorization annotations. SecurityConstants.SECURITY_RULES has zero matches for `/api/activity`."
  question: "What does each of the 4 auth modes return for an unauthenticated caller and a wrong-role caller?"
  resolution: STATIC-INFERRED + REFERENCE
  answer: |
    Under LOGIN_FORM / OAUTH2 / LDAP: SecurityWebFilterChain rejects unauthenticated callers with HTTP 401 (verified by LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 — both call `.anyExchange().authenticated()`). Wrong-role caller does NOT exist meaningfully — there is no per-endpoint Permission/Role gate. ANY authenticated identity reaches both endpoints with full cross-owner audit-trail visibility.
    Under DISABLED: DisabledAuthSecurityConfiguration.java:16 calls `.anyExchange().permitAll()` — anonymous traffic is admitted. Operator-visible: a misconfigured production deployment (auth.type=DISABLED in production) exposes the audit trail publicly.
    Under S2S (auth.s2s.enabled=true): S2sAuthenticationFilter grants ADMIN identity to any caller bearing a valid S2S token. ADMIN satisfies `.authenticated()` and reads the full audit trail — an operator enabling S2S for ingestion grants those tokens full audit-read.
    STATIC-INFERRED HIGH for the LOGIN_FORM/OAUTH2/LDAP/DISABLED cases (the SecurityConstants verification is conclusive). REFERENCE for the S2S behaviour (depends on the batch-D IngestionDataEntitiesFilter sidecar + S2sAuthenticationFilter wiring).
  evidence: "ActivityController.java:1-58 + SecurityConstants.java:95-356 (full verification) + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16 + S2sAuthenticationFilter (per batch-D sidecar)."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: known_security_gaps.[0-no-authz] + known_security_gaps.[1-DISABLED-anonymous] + known_security_gaps.[2-S2S-leakage]
  routes_to_sidecar: batch-D IngestionDataEntitiesFilter sidecar (for the S2S details)

- id: STRESS_D2
  trigger: "ReactiveActivityRepositoryImpl.java:220-222: LEFT JOIN USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY with NO provider filter."
  question: "What happens when two auth providers (LOGIN_FORM and LDAP) issue tokens for users with the same username 'alice'?"
  resolution: STATIC-INFERRED
  answer: |
    A LOGIN_FORM-authed 'alice' creates an activity event; the event row has `created_by = 'alice'`. Later an LDAP-authed 'alice' (a DIFFERENT person, same name) is mapped to a different OwnerPojo, but the USER_OWNER_MAPPING LEFT JOIN at line 220-222 filters only by OIDC_USERNAME — no provider column. The query joins ANY mapping with USERNAME='alice' AND DELETED_AT IS NULL. If both alice-mappings have DELETED_AT IS NULL (which is the steady state — neither was deleted), the JOIN produces 2 rows per activity event — effectively duplicating the activity in the result set OR (depending on Postgres planner choice) picking one of the two arbitrary mappings.
    The repository's `mapDto` (ReactiveActivityRepositoryImpl.java:304-309) extracts ONE OwnerPojo per row — the JOIN-duplicated rows produce two ActivityDto outputs with different ownerPojo fields, both attributed to the SAME audit event. UI surfaces this as two events.
    STATIC-INFERRED HIGH — the bleed is structural, no provider filter exists.
  evidence: "ReactiveActivityRepositoryImpl.java:220-222 (the LEFT JOIN) + ReactiveActivityRepositoryImpl.java:304-309 (mapDto) + concept catalog `provider-null-cross-mode-bleed`."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: known_security_gaps.[STRESS_D2-cross-mode-bleed]
  routes_to_concept: provider-null-cross-mode-bleed

- id: STRESS_D3
  trigger: "ActivityServiceImpl.java:198: `.switchIfEmpty(Flux.empty())` on the `fetchMyActivities` branch."
  question: "What does a user with no owner association see on the MY_OBJECTS tab?"
  resolution: STATIC-INFERRED
  answer: |
    `authIdentityProvider.fetchAssociatedOwner()` returns an empty Mono when the user has no USER_OWNER_MAPPING. The `.flatMapMany(owner -> ...)` skips the activity query entirely; `.switchIfEmpty(Flux.empty())` substitutes an empty Flux. The HTTP response is `200 OK` with an empty array `[]` — visually indistinguishable from "no activity in window for my owned entities".
    Operator UX impact: a user investigating their own activity history cannot distinguish "I'm unmapped" (admin oversight) from "no activity" (legitimate empty state). An admin auditing a user's activity scope cannot detect the unmapped condition through the API.
    STATIC-INFERRED HIGH.
  evidence: "ActivityServiceImpl.java:184-199."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: known_security_gaps.[STRESS_D3-my-objects-silent-empty]

### Category E — Resource boundaries

- id: STRESS_E1
  trigger: "Activity table is range-partitioned by created_at (F-010); CREATE TABLE PARTITION DDL at PartitionServiceImpl.java:60-66 takes ACCESS EXCLUSIVE on the parent during DDL."
  question: "Can a long-running read query block the partition-creation DDL? Can the DDL stall a read query? What's the worst-case interaction at boot or at the 00:01 cron?"
  resolution: REFERENCE + PROBE-NEEDED (deferred)
  answer: |
    `CREATE TABLE ... PARTITION OF activity` takes ACCESS EXCLUSIVE on the parent activity table — this blocks ALL concurrent reads and writes for the duration of the statement. In PostgreSQL 12+ this is a metadata-only operation completing in milliseconds; on heavily loaded systems with long-running transactions on activity (e.g. a `/api/activity?size=Integer.MAX_VALUE` scan), the DDL can stall behind the in-flight query. The reverse is also true: a `/api/activity` read arriving during the brief DDL window blocks waiting for the lock.
    Boot-time: PostgreSQLPartitionCreationJob.java:30-38 acquires advisory lock 90 and runs CREATE within @PostConstruct — readiness probe is gated on completion. If a slow leader holds the lock, follower instances cannot reach readiness; reads are unaffected (the followers don't serve traffic yet).
    Nightly cron: 00:01 server-local-time, ShedLock-protected. Reads arriving during the DDL window briefly block; cron CREATE is fast.
    For the controller's read path specifically (this sidecar's scope): the read query at ReactiveActivityRepositoryImpl.java:290-292 has no lock hint, no timeout, no fallback. A read that starts AFTER the DDL has completed sees the new partition normally. A read that starts BEFORE the DDL and is still scanning when DDL is requested: depends on Postgres lock-queue behaviour (typically the DDL waits for the read to complete because of lock-mode ordering).
    The CONCURRENT failure mode that LSN-001 (attachment-ephemeral-default) would call out: a CREATE TABLE PARTITION failure (DB role lacking CREATE, name collision, lock contention) is logged at ERROR and swallowed (PostgreSQLPartitionCreationJob.java:57-60). Rows arriving for the un-covered window are REJECTED by Postgres with `no partition of relation activity found for row` — but THIS IS A WRITE path, not the read path this controller serves. The controller is unaffected.
    REFERENCE to the partition-manager sidecar for the write-side details. PROBE-NEEDED for the read-during-DDL stall behaviour — emitted P-017.
  evidence: "PartitionServiceImpl.java:60-66 (CREATE TABLE DDL) + ReactiveActivityRepositoryImpl.java:290-292 (no lock hint) + PostgreSQLPartitionCreationJob.java:30-43 (boot + cron lifecycle) + neighbour sidecar `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md`."
  confidence: PROBE-NEEDED for the runtime stall interaction; STATIC-INFERRED HIGH for the lock-mode mechanics
  routes_to_probe: P-017
  routes_to_sidecar: lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md

- id: STRESS_E2
  trigger: "ActivityServiceImpl.java:139-166: 4 parallel Mono queries via Mono.zip on `getActivityCounts`. No shared transaction."
  question: "Can the 4 counts collide on shared resources (DB connections, planner slots, partition prune cost)? What's the connection-pool impact?"
  resolution: STATIC-INFERRED
  answer: |
    Each of the 4 Mono.zip arms calls a separate `jooqReactiveOperations.mono(...)` which acquires a connection from the pool. 4 simultaneous connections per `getActivityCounts` call. For a UI polling at 30s and 10 concurrent users, that's 40 concurrent connections every 30s for counts alone — bounded by the WebFlux connection pool size.
    No transaction wrapper, no @Transactional — each count is an independent read; counts are NOT mutually consistent (STRESS_C3).
    The 4 counts use the SAME activity table with the SAME partition layout — partition prune is applied independently to each query. No shared cache, no precomputed aggregate.
    STATIC-INFERRED HIGH for the connection-fan-out; STATIC-INFERRED MEDIUM for the planner-overhead (depends on planner caching of identical partition-prune plans).
  evidence: "ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258 + JooqReactiveOperations bean wiring (per batch-D sidecars)."
  confidence: STATIC-INFERRED HIGH
  routes_to_finding: known_performance_gaps.[counts-4x]

- id: STRESS_E3
  trigger: "ReactiveActivityRepositoryImpl.java:290-292: ORDER BY + LIMIT with NO timeout, NO statement_timeout hint."
  question: "What happens if a single getActivity call's underlying SQL takes 60s? 5min? Does the Flux subscription survive a connection-reset?"
  resolution: STATIC-INFERRED + PROBE-NEEDED
  answer: |
    No timeout at JOOQ level (no `.queryTimeout(...)`), no Postgres `statement_timeout` set at the connection level by this code path. The DB query runs until completion or DB-side timeout (default Postgres `statement_timeout=0` — unlimited). For a wide-window scan with `size=Integer.MAX_VALUE`, the query can run for minutes.
    Reactor backpressure: the WebFlux pipeline subscribes to the Flux; the client controls receive rate. If the client disconnects mid-stream, Reactor's onCancel propagates back to the connection — the in-flight DB query is cancelled by JOOQ's PostgreSQL driver (PgConnection.cancelQuery). In practice this works for most cases.
    Connection-pool impact: a long-running query holds a connection from the pool — pool exhaustion is possible under sustained heavy load with no timeout cap.
    STATIC-INFERRED HIGH for the no-timeout observation; PROBE-NEEDED for the actual end-to-end behaviour under client-disconnect (does the DB query actually get cancelled? does the connection return to the pool?). Emitted P-014.
  evidence: "ReactiveActivityRepositoryImpl.java:290-292 (no timeout) + grep for `statement_timeout` across the codebase (zero matches in this controller's chain)."
  confidence: STATIC-INFERRED HIGH for the no-timeout; PROBE-NEEDED for the disconnect-cancellation
  routes_to_probe: P-014
  routes_to_finding: known_performance_gaps.[no-rate-limit] (adjacent)

## sources

- understanding ← ActivityController.java:1-58 + ActivityServiceImpl.java:86-117 + components.yaml:2861-2935,3159-3196 + openapi.yaml:3206-3347 + ReactiveActivityRepositoryImpl.java:74-295
- concepts.entities.Activity ← ActivityController.java:7 + components.yaml:2861-2889
- concepts.entities.ActivityCountInfo ← ActivityController.java:8 + components.yaml ActivityCountInfo schema (via openapi.yaml:3344-3345 ref)
- concepts.entities.ActivityType ← ActivityController.java:10 + components.yaml:3159-3166
- concepts.entities.ActivityEventType ← ActivityController.java:9 + components.yaml:3167-3196 + ActivityEventTypeDto.java:3-31
- concepts.entities.BadUserRequestException ← ActivityServiceImpl.java:99 + ControllerAdvice.java:24-28
- concepts.entities.ControllerAdvice ← ControllerAdvice.java:20-89
- concepts.invariants.[0] ← ActivityController.java:20 + openapi.yaml:3206-3347
- concepts.invariants.[1] ← ActivityController.java:18-57
- concepts.invariants.[2] ← ActivityController.java:36,52 + ActivityServiceImpl.java:194,239
- concepts.invariants.[3] ← ActivityController.java:24-36
- concepts.invariants.[4] ← ActivityController.java:44-52
- concepts.invariants.[5] ← ActivityController.java:24 + ActivityController.java:44
- concepts.invariants.[6-ordering] ← ReactiveActivityRepositoryImpl.java:290-292
- dependencies_semantic.requires-feature.[0] ← ActivityController.java:11 + ActivityController.java:21 + ActivityServiceImpl.java:33-274
- dependencies_semantic.requires-feature.[1] ← ActivityController.java:6 + ActivityController.java:20 + openapi.yaml:3206-3347
- dependencies_semantic.requires-feature.[2-ControllerAdvice] ← ControllerAdvice.java:24-28
- dependencies_semantic.requires-feature.[3-Spring] ← ActivityController.java:18-19
- dependencies_semantic.coupling.[0-auth] ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16
- dependencies_semantic.coupling.[1-S2S] ← ActivityController.java:1-58 + S2sAuthenticationFilter wiring per batch-D sidecars
- dependencies_semantic.coupling.[2-ingestion-filter] ← IngestionDataEntitiesFilter sidecar (batch D)
- dependencies_semantic.coupling.[3-schema-rooted-scope] ← V0_0_48__add_activity.sql:4,12 (via ReactiveActivityRepositoryImpl batch-R sidecar)
- tests_coverage_semantic ← Glob `**/ActivityControllerTest*` (no files) + Glob `**/ActivityServiceImplTest*` (no files) under odd-platform-api/
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- docs_link_semantic.inferred_docs.[1] ← WebFetch /developer-guides/api-reference/activity (status 404, 2026-05-20)
- docs_link_semantic.inferred_docs.[2] ← WebFetch /configuration-and-deployment/enable-security/authorization (status 200, 2026-05-10, within 11-day stale-probe cadence)
- docs_link_semantic.doc_drift_findings.[size-required-vs-nullable] ← components.yaml:4226 (required: true) + ActivityController.java:26 (boxed nullable Integer)
- docs_link_semantic.doc_drift_findings.[five-category-silence] ← WebFetch activity-feed.md (2026-05-20, 5-category visibility inventory NOT MENTIONED on 4 of 5)
- docs_link_semantic.doc_drift_findings.[enum-count] ← WebFetch activity-feed.md + components.yaml:3167-3196 + ActivityEventTypeDto.java:3-31
- docs_link_semantic.doc_drift_findings.[hidden-types-server-accepted] ← WebFetch activity-feed.md + openapi.yaml:3259-3262 + ActivityServiceImpl.java:101-102
- docs_link_semantic.doc_drift_findings.[type-param-undocumented] ← WebFetch activity-feed.md + ActivityController.java:32 + ActivityServiceImpl.java:107-117
- docs_link_semantic.doc_drift_findings.[visibility-absent] ← WebFetch activity-feed.md + ActivityController.java:1-58 + SecurityConstants.java:95-356
- docs_link_semantic.doc_drift_findings.[api-reference-404] ← WebFetch /developer-guides/api-reference/activity (404)
- docs_link_semantic.doc_drift_findings.[spec-under-documents] ← openapi.yaml:3208-3209
- implicit_adrs.[0-pair-of-methods] ← ActivityController.java:18-57 + openapi.yaml:3206-3347
- implicit_adrs.[1-thin-proxy] ← ActivityController.java:36,52 + ActivityServiceImpl.java:194,239
- implicit_adrs.[2-pure-proxy] ← ActivityController.java:1-58
- implicit_adrs.[3-cursor-pagination] ← ActivityController.java:34-35 + ReactiveActivityRepositoryImpl.java:283-291
- implicit_adrs.[4-order-by-tie-break] ← ReactiveActivityRepositoryImpl.java:290-292
- bugs_limitations_corner_cases.[typo] ← ActivityController.java:34 + ActivityService.java:42 + openapi.yaml:3263-3267
- bugs_limitations_corner_cases.[unused-exchange] ← ActivityController.java:36,52
- bugs_limitations_corner_cases.[no-authz] ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + DisabledAuthSecurityConfiguration.java:16
- bugs_limitations_corner_cases.[id-enumeration] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- bugs_limitations_corner_cases.[size-unbounded] ← ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292 + components.yaml:4226
- bugs_limitations_corner_cases.[sensitive-content] ← components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41
- bugs_limitations_corner_cases.[counts-4x-load] ← ActivityServiceImpl.java:139-166
- bugs_limitations_corner_cases.[validation-error-shape-ambiguity] ← ActivityController.java:37-40 + ActivityServiceImpl.java:98-100 + ControllerAdvice.java:24-28 + STRESS_B2
- security.auth_mode_relevance ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter sidecar (batch D)
- security.authorization_assertions ← ActivityController.java:1-58 + SecurityConstants.java:95-356
- security.owner_scoping ← ActivityController.java:23-41,43-56 + ActivityServiceImpl.java:86-217 + concepts.yaml:64,72
- security.data_exposure.[0] ← components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 + ActivityServiceImpl.java:86-217
- security.data_exposure.[1] ← ActivityController.java:43-56 + ActivityServiceImpl.java:139-258
- security.data_exposure.[2] ← ActivityController.java:30-31,33 + ActivityServiceImpl.java:179-181
- security.known_security_gaps.[0-no-authz] ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + WebFetch /enable-security/authorization + WebFetch activity-feed.md
- security.known_security_gaps.[1-DISABLED-anonymous] ← ActivityController.java:1-58 + DisabledAuthSecurityConfiguration.java:16
- security.known_security_gaps.[2-S2S-leakage] ← ActivityController.java:1-58 + S2sAuthenticationFilter wiring (batch D)
- security.known_security_gaps.[3-id-enumeration] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- security.known_security_gaps.[4-payload-sensitivity] ← components.yaml:2891-2935 + DescriptionActivityStateDto.java:3 + activity-feed.md (no caveat)
- security.known_security_gaps.[5-rbac-audit-silence] ← V0_0_48__add_activity.sql:4,12 + ReactiveActivityRepositoryImpl batch-R sidecar invariants[0]
- security.known_security_gaps.[STRESS_D2-cross-mode-bleed] ← ReactiveActivityRepositoryImpl.java:220-222 (no provider filter on the LEFT JOIN)
- security.known_security_gaps.[STRESS_D3-my-objects-silent-empty] ← ActivityServiceImpl.java:184-199
- performance.hot_paths.[0] ← ActivityController.java:23-41 + ReactiveActivityRepositoryImpl.java:74-89,208-244,279-295
- performance.hot_paths.[1] ← ActivityServiceImpl.java:201-217 + ReactiveActivityRepositoryImpl.java:109-126
- performance.hot_paths.[2] ← ActivityController.java:43-56 + ActivityServiceImpl.java:139-166,219-258
- performance.hot_paths.[3] ← ActivityServiceImpl.java:184-199 + ReactiveActivityRepositoryImpl.java:91-107
- performance.throughput_characteristics ← ActivityController.java:23-56 + ActivityServiceImpl.java:86-166
- performance.resource_allocation ← ActivityServiceImpl.java:168-258 + ReactiveActivityRepositoryImpl.java:74-295
- performance.scaling_characteristics ← ActivityController.java:18 (stateless) + ActivityServiceImpl.java:86-258 + ActivityTablePartitionManager sidecar (F-010 partition rotation) + PartitionServiceImpl.java:60-66 (ACCESS EXCLUSIVE DDL lock)
- performance.known_performance_gaps.[unbounded-size] ← ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292
- performance.known_performance_gaps.[counts-4x] ← ActivityServiceImpl.java:139-166
- performance.known_performance_gaps.[lineage-walk] ← ActivityServiceImpl.java:201-217
- performance.known_performance_gaps.[cursor-index] ← ActivityController.java:34-35 + ReactiveActivityRepositoryImpl.java:287-291
- performance.known_performance_gaps.[no-rate-limit] ← ActivityController.java:1-58 + grep for @RateLimit (zero matches)
- stress_findings.STRESS_A1 ← ActivityController.java:26 + components.yaml:4226 + ReactiveActivityRepositoryImpl.java:292 + probe P-016
- stress_findings.STRESS_A2 ← ActivityController.java:26 + ActivityServiceImpl.java:179-181 + ReactiveActivityRepositoryImpl.java:292 + ControllerAdvice.java:61-66 + probe P-016
- stress_findings.STRESS_A3 ← ReactiveActivityRepositoryImpl.java:290-292 + ActivityTablePartitionManager neighbour sidecar
- stress_findings.STRESS_B1 ← ActivityController.java:24,44 + ActivityServiceImpl.java:86-166,219-258
- stress_findings.STRESS_B2 ← ActivityController.java:37-40 + ActivityServiceImpl.java:98-100 + ControllerAdvice.java:24-28 + probe P-015
- stress_findings.STRESS_C1 ← ReactiveActivityRepositoryImpl.java:283-291
- stress_findings.STRESS_C2 ← ReactiveActivityRepositoryImpl.java:290-292 + WebFetch activity-feed.md (ordering NOT MENTIONED)
- stress_findings.STRESS_C3 ← ActivityServiceImpl.java:139-166,219-258
- stress_findings.STRESS_D1 ← ActivityController.java:1-58 + SecurityConstants.java:95-356 + auth-config files
- stress_findings.STRESS_D2 ← ReactiveActivityRepositoryImpl.java:220-222
- stress_findings.STRESS_D3 ← ActivityServiceImpl.java:184-199
- stress_findings.STRESS_E1 ← PartitionServiceImpl.java:60-66 + ReactiveActivityRepositoryImpl.java:290-292 + PostgreSQLPartitionCreationJob.java:30-43 + probe P-017
- stress_findings.STRESS_E2 ← ActivityServiceImpl.java:139-166,219-258
- stress_findings.STRESS_E3 ← ReactiveActivityRepositoryImpl.java:290-292 + probe P-014

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
- stress_findings: HIGH for STATIC-INFERRED resolutions; PROBE-NEEDED entries flip to PROBE-VERIFIED after P-014/P-015/P-016/P-017 run

## Maintainer notes

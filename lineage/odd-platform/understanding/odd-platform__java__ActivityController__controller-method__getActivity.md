---
node_id: "odd-platform java ActivityController controller-method:getActivity"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-01
---

# ActivityController.getActivity — semantic understanding

## understanding

Reactive HTTP handler for `GET /api/activity`: returns a `Flux<Activity>` window of audit-trail events between `beginDate` and `endDate`, narrowed by twelve query parameters (size, datasourceId, namespaceId, tagIds, ownerIds, userIds, type, eventType, lastEventId, lastEventDateTime). The controller is pure plumbing — it wraps the service call in `Mono.just(...)` and maps the resulting `Flux` into a `ResponseEntity.ok`; all filter dispatch, ownership-resolution, and validation live in `ActivityServiceImpl.getActivityList` (lines 86-117). The `type` parameter (`ActivityType.MY_OBJECTS | DOWNSTREAM | UPSTREAM | ALL`) is the only filter that introduces ownership-awareness — `MY_OBJECTS` flows through `authIdentityProvider.fetchAssociatedOwner()` to filter to the caller's owner association; `ALL` (and the `null`/default branch) returns activity across every owner in the platform.

## concepts

- entities: [Activity, ActivityType, ActivityEventType, ActivityState, AssociatedOwner, DataEntityRef]
- operations: [list-activity, audit-trail-read, filter-by-window, filter-by-owner-scope, filter-by-event-type, cursor-paginate-activity]
- invariants:
  - "`beginDate` and `endDate` are validated at the service layer — `null` for either raises `BadUserRequestException('Begin date and end date can't be null')` (ActivityServiceImpl.java:98-100). The OpenAPI spec marks both `required: true` (openapi.yaml:3214,3220), so the runtime check is belt-and-braces for callers that bypass spec validation."
  - "Cursor pagination via `(lastEventId, lastEventDateTime)` — append-only audit data, no offset/skip parameter exists on this endpoint."
  - "The `type` parameter switches dispatch among four service paths: `null|ALL` → `fetchAllActivities` (no ownership filter); `MY_OBJECTS` → `fetchMyActivities` (filters to caller's owner); `DOWNSTREAM`/`UPSTREAM` → `fetchDependentActivities` over the data-entity lineage graph (no caller-ownership filter — anyone authenticated can ask 'what changed upstream of the data entities I am downstream of?')."
  - "Activity payload exposes audit-trail history including `old_state` and `new_state` of every tracked field (description text, tag assignments, ownership changes, custom-metadata values, dataset-field internal names, business names — every event-type listed in `ActivityEventType`)."
- audiences: [odd-platform-ui (Activity Feed page, https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed), operators auditing platform changes, security/compliance reviewers]

## dependencies_semantic

- requires-feature:
  - "`ActivityService` bean — owns the four-way type dispatch, BadUserRequestException validation, ownership resolution via `AuthIdentityProvider.fetchAssociatedOwner()`, lineage resolution via `DataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)`, and the mapping from `ActivityPojo` rows to OpenAPI `Activity` payload."
  - "OpenAPI-generated `ActivityApi` interface — the controller is a pure `@Override` of two interface methods; HTTP method (`GET`), paths (`/api/activity`, `/api/activity/counts`), parameter binding (twelve query parameters for getActivity, eight for getActivityCounts), and response types come from the generated interface."
  - "`AuthIdentityProvider` bean (used transitively via `ActivityServiceImpl`) — resolves the current user's associated owner for `MY_OBJECTS` and the count of my-object activities."
  - "`DataEntityRelationsService` (used transitively) — walks the lineage graph for `UPSTREAM`/`DOWNSTREAM` views."
- requires-config: []
- requires-runtime:
  - "Spring WebFlux (`@RestController` + reactive `Mono`/`Flux` pipeline)."
  - "Reactor Core (`Mono.just(...).map(...)`)."
  - "PostgreSQL `activity` table reached via `ReactiveActivityRepository` (transitively through the service)."
- coupling:
  - "Authorization: ActivityController carries no `@PreAuthorize`, no `hasPermission(...)`, no programmatic permission check. The generated `ActivityApi` interface also carries no authorization annotations (grep verified). `/api/activity` is not enumerated in `SecurityConstants.SECURITY_RULES` (SecurityConstants.java:98-356) and is not in `WHITELIST_PATHS` (SecurityConstants.java:95-96), so access falls through to the default `pathMatchers('/**').authenticated()` rule in `LoginFormSecurityConfiguration.java:57`, `OAuthSecurityConfiguration.java` via `AuthorizationCustomizer.java:29-30`, and `LDAPSecurityConfiguration.java` via the same `AuthorizationCustomizer`. Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration.java:16` calls `.anyExchange().permitAll()` — the endpoint is reachable by any caller able to reach the application port."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Happy-path: valid `beginDate`/`endDate` window with `type=null` returns Flux of `Activity` rows across all owners."
  - "Validation-error path: `beginDate=null` (or `endDate=null`) returns `BadUserRequestException('Begin date and end date can't be null')` (ActivityServiceImpl.java:98-100)."
  - "`type=MY_OBJECTS` happy-path: caller has an associated owner → activity filtered to that owner's data entities. Caller has no associated owner (`fetchAssociatedOwner` returns empty Mono) → `switchIfEmpty(Flux.empty())` (ActivityServiceImpl.java:198) → caller sees no activity, no error."
  - "`type=DOWNSTREAM`/`UPSTREAM` paths: lineage resolution succeeds → activity for dependent entities; lineage is empty → empty Flux."
  - "Filter combinations: tagIds + ownerIds + userIds intersection; multi-element list semantics (OR within facet, AND across facets — the actual SQL semantics are not surfaced in the service)."
  - "Cursor-pagination correctness: `(lastEventId, lastEventDateTime)` boundary handling at result-set boundaries."
  - "Cross-owner enumeration via `userIds` filter — passing a known user id reveals whether they have any activity in the window (an enumeration probe; no authorization gate prevents it)."
- test_files: []
- gaps: |
    No test under `odd-platform-api/src/test` references `ActivityController`,
    `getActivityList`, or `fetchAllActivities`/`fetchMyActivities`/`fetchDependentActivities`
    (verified via grep across the test directory; zero matches). Neither the
    happy-path nor the validation-error path nor the four type-dispatch
    branches are exercised by automated tests.

    The MY_OBJECTS branch (ActivityServiceImpl.java:184-199) is the most
    likely regression site: it depends on `authIdentityProvider.fetchAssociatedOwner()`
    returning a non-empty Mono. A refactor that changes the
    AuthIdentityProvider behaviour for anonymous / service-context callers
    (e.g. resolving to an empty owner) silently degrades MY_OBJECTS into
    "shows nothing" — visually indistinguishable from "no activity in window"
    on the UI.

    The cursor pagination semantics (`lastEventId` + `lastEventDateTime`) are
    inherited from the repository layer and never unit-tested at the
    controller/service seam.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Canonical feature-page for the global Activity Feed UI surface; the only ODD doc page that names the global Activity page and its filters."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Page title: "Activity Feed". Headings: "Where to find it", "Filters on
      the global Activity page", "Event types", "Auto-resolved alert events",
      "Configuration".

      The page lists seven filter facets for the global Activity page:
      Calendar (date / date-range), datasource, namespace, event type, tags,
      owners, users. The Owner filter is described as useful for "'what
      happened to my team's data this week'" and the User filter as useful
      for "auditing a specific person's platform activity."

      The page lists 20+ event types organised by category (lifecycle,
      ownership, tags/terms, dataset fields, groups, alerts). Auto-resolved
      alerts appear as system events without operator identity.

      The page does NOT mention:
      - The `type` parameter that switches between MY_OBJECTS / UPSTREAM /
        DOWNSTREAM / ALL views (the controller and ActivityType enum support
        it; the doc does not).
      - Who can see activity (no authorization / visibility statement).
      - Whether the view is owner-scoped by default or cross-owner.
      - Pagination mechanics (cursor via `lastEventId` + `lastEventDateTime`).
      - The `size` parameter or default page size.
      - Free-text descriptions surfaced via `DescriptionActivityStateDto`,
        custom-metadata values surfaced via `CustomMetadataActivityState`,
        dataset-field internal-name changes, or business-name edits.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/activity"
    anchor: ""
    rationale: "Expected API-reference page for the `activity` OpenAPI tag — aligned with the existing `developer-guides/api-reference/alerts` page that documents the alerts tag."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Page returns 404. No dedicated API-reference page exists for the
      `activity` tag on the live site. The endpoints (`GET /api/activity`,
      `GET /api/activity/counts`) have no first-party API-reference
      documentation; an operator wanting to drive the API programmatically
      must read the OpenAPI spec directly (openapi.yaml:3206-3398).
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical authorization-vocabulary page — verified live to confirm Policies / Permissions / Roles / Owners / User-owner association are the correct ODD terms used in the security block of this sidecar."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Five core authorization concepts: Policies, Permissions, Roles, Owners,
      User-owner association.

      Live page contains NO mention of activity-feed endpoints, audit-log
      visibility controls, or per-endpoint protection of /api/activity. The
      authorization framework is documented in the abstract; per-endpoint
      wiring (or its absence) is not surfaced.
- doc_drift_findings:
  - "The activity-feed feature page (live, 200) lists seven filter facets but omits the controller's `type` parameter (MY_OBJECTS/UPSTREAM/DOWNSTREAM/ALL) which is a primary axis of the API and a visible UI tab. Either the docs need to add the type/tab axis, or the type parameter is UI-internal and should be removed from the public API surface."
  - "The activity-feed feature page makes no visibility statement — operators reading the docs cannot determine that ANY authenticated user can read the GLOBAL activity feed across all owners (including audit trails for resources they have no ownership association with). This is a doc-gap with security implications, not just a coverage gap."
  - "No `developer-guides/api-reference/activity` page exists on the live site (404 verified). The `activity` OpenAPI tag has no first-party reference page, unlike `alerts` which has `developer-guides/api-reference/alerts`. Bi-directional code↔doc coverage gap."
  - "The OpenAPI spec at openapi.yaml:3206-3284 carries `description: 'Returns activity for dedicated period'` — no per-parameter descriptions, no mention of the MY_OBJECTS/UPSTREAM/DOWNSTREAM/ALL semantics, no visibility statement. The spec is the only API-reference surface and it under-documents the endpoint."

## implicit_adrs

- "Activity stream uses cursor pagination (`lastEventId` + `lastEventDateTime`) rather than offset/limit — appropriate for append-only audit data and avoids deep-offset performance cliffs." — evidence: ActivityController.java:34-35 (the two cursor parameters as a pair) + ActivityServiceImpl.java:179-180 (`findAllActivities(... lastEventId, lastEventDateTime)`) + lineage/odd-platform/concepts.yaml:108 (the same pattern is observed and labelled across the codebase). — intent_anchor: "The parameter pair appears as `lastEventId` + `lastEventDateTime` (note the typo `lasEventId` at line 34 — preserved verbatim on the public API surface) — the same cursor shape is reused at `getDataEntityActivity` (DataEntityController.java:351-365 per concepts.yaml:108), establishing 'cursor pagination for activity streams' as a cross-controller convention." — confidence: HIGH
- "Date-range filter is enforced at the service-layer entry point with a `BadUserRequestException`, even though the OpenAPI spec marks `begin_date` and `end_date` as `required: true`. The redundant runtime check is intentional defence-in-depth against callers that bypass spec validation (e.g. internal service-to-service calls that wire the service directly)." — evidence: ActivityServiceImpl.java:98-100 (the `if (beginDate == null || endDate == null)` guard) + openapi.yaml:3214,3220 (`required: true` on both date parameters). — intent_anchor: "`throw new BadUserRequestException(\"Begin date and end date can't be null\")` — the exception message frames the contract explicitly even though OpenAPI would already reject this." — confidence: MEDIUM
- "The four `ActivityType` enum values (ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM) encode UI-driven view modes as a server-side dispatch parameter rather than as separate endpoints (e.g. `/api/activity/mine`, `/api/activity/upstream`). The controller method signature, the service `getActivityList` switch (ActivityServiceImpl.java:107-117), and the components.yaml enum (components.yaml:3159-3166) all model this as a single parameterised endpoint." — evidence: ActivityController.java:32 (`final ActivityType type`) + ActivityServiceImpl.java:107-117 (the four-arm `switch (type)`) + components.yaml:3159-3166 (the closed enum). — intent_anchor: "The `switch (type)` block exhausts the four enum members on a single method — the type is the dispatch parameter; separating into endpoints would have required four interface methods." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Public-API parameter typo: the `getActivity` method declares `final Long lasEventId` on line 34 (missing the `t` in `last`). The OpenAPI parameter is `last_event_id` (correct) but the Java method signature exposes `lasEventId` — generated client code derived from this signature would carry the typo. Since the controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)`, the typo also lives on the service interface (ActivityService.java:42)." — evidence: ActivityController.java:34 (`final Long lasEventId`) + ActivityService.java:42 (`final Long lastEventId` — fixed at the service interface, so the controller's local variable name is the only surface that carries the typo). — severity: LOW
- "`ActivityType=null` (the default when the caller omits the `type` parameter) is treated as `ALL` semantically (`fetchAllActivities`) but the dispatch is implemented as an explicit null-check (`if (type == null)`) BEFORE the `switch` — the `ALL` enum value also routes to `fetchAllActivities` inside the switch. There are two paths to the same destination; a refactor that only updates one branch (e.g. adds owner-scoping to `ALL` but not to `null`) would silently bypass the new gate when callers omit the parameter." — evidence: ActivityServiceImpl.java:103-115 (the `if (type == null) { return fetchAllActivities(...) }` followed by `case ALL -> fetchAllActivities(...)`). — severity: MEDIUM
- "`userIds` and `ownerIds` filter parameters accept arbitrary `List<Long>` with no validation that the IDs reference existing users/owners. A caller can submit `userIds=[1,2,3,...,N]` to probe which users have generated platform activity in the window — a low-cost user-id enumeration vector. The response shape (empty vs. populated Flux) distinguishes valid-and-active from invalid-or-inactive users." — evidence: ActivityController.java:30-31 (no validation of `ownerIds`/`userIds`) + ActivityServiceImpl.java:179-181 (parameters passed straight to repository). — severity: MEDIUM
- "`size` parameter has no documented or enforced upper bound at the controller or service layer. A caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan / Postgres LIMIT clause behaviour; there is no input-validation rejection of obviously-abusive sizes." — evidence: ActivityController.java:26 (`final Integer size`, no `@Max` or programmatic check) + ActivityServiceImpl.java:179-180 (parameter passed through to repository). — severity: LOW
- "Activity payload surfaces audit history including `old_state` and `new_state` of every tracked field — `DescriptionActivityStateDto(String description)` (DescriptionActivityStateDto.java:3) carries user-supplied free-text descriptions of data entities (and dataset fields). If those descriptions ever included sensitive data (incident notes, customer identifiers, internal tickets), the activity feed surfaces them to any authenticated user via the global `/api/activity` endpoint with no owner-scoping. The doc page omits this entirely." — evidence: DescriptionActivityStateDto.java:3 + ActivityState.java in components.yaml:2891-2935 (the structured `old_state`/`new_state` surface) + the absence of any field-level redaction or owner filter in ActivityServiceImpl.fetchAllActivities (lines 168-182). — severity: MEDIUM
- "The `ActivityCountInfo` response from `getActivityCounts` exposes `totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount` in a single payload — `totalCount` is computed without any owner filter (ActivityServiceImpl.java:219-230). Any authenticated user calling `/api/activity/counts` learns the total cross-owner activity volume in the window, even if they cannot enumerate the events themselves under `MY_OBJECTS`. (In practice they CAN enumerate via `type=ALL`, but the counts endpoint trivially exposes the aggregate without paging.)" — evidence: ActivityServiceImpl.java:139-166 (the `zip` of four counts, all computed with the same filter set the caller passed in plus owner-resolution for MY_OBJECTS only) + ActivityServiceImpl.java:219-230 (`getTotalCount` with no owner filter). — severity: LOW (informational — the same data is reachable via the list endpoint).

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP
  - "GET-on-collection handler exposed under the `/api/activity` UI/API surface — the same surface protected by SecurityWebFilterChain when `auth.type ∈ {LOGIN_FORM, OAUTH2, LDAP}`. The endpoint is NOT enumerated in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96) nor in `SecurityConstants.SECURITY_RULES` (SecurityConstants.java:98-356), so the default `pathMatchers('/**').authenticated()` rule applies (LoginFormSecurityConfiguration.java:57 / AuthorizationCustomizer.java:29-30 for OAUTH2 + LDAP)." — evidence: ActivityController.java:18 (@RestController) + ActivityController.java:1-58 (no auth annotations) + SecurityConstants.java:95-96 (whitelist) + SecurityConstants.java:98-356 (security rules — no /api/activity entry). DISABLED skips auth entirely (DisabledAuthSecurityConfiguration.java:16 `.anyExchange().permitAll()`). S2S applies only to `/ingestion/entities` — not relevant here.
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. `S2sAuthenticationFilter` is wired only when `auth.s2s.enabled=true` and applies via the chain to whatever the chain's matchers accept; `/api/activity` is in the authenticated set, not the WHITELIST. The ingestion-data-entity filter (`/ingestion/entities`) does not apply here."
- authorization_assertions: []
  - "ActivityController.getActivity has `@Override` only (line 23) — no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call. The generated `ActivityApi` interface also carries no authorization annotations (grep of the generated interface for `@PreAuthorize|hasPermission|hasRole|hasAuthority` returned zero matches). `/api/activity` is not enumerated in `SecurityConstants.SECURITY_RULES`, so the `AuthorizationCustomizer` does not register a Permission gate for it — admission falls through to `pathMatchers('/**').authenticated()`. Authorization for this endpoint is binary: 'is the caller authenticated under the configured auth.type', not 'does the caller have permission to read this Owner's activity'." — evidence: ActivityController.java:23-41 + ActivityApi.java (generated, no auth annotations) + SecurityConstants.java:98-356 (no /api/activity rule) + AuthorizationCustomizer.java:24-30.
- owner_scoping: "BYPASSES (default and `type=ALL`) / RESPECTS (only when `type=MY_OBJECTS`) / BYPASSES (`type=UPSTREAM`/`DOWNSTREAM` — lineage-scoped, not caller-owner-scoped). The default `type=null` path (`fetchAllActivities`, ActivityServiceImpl.java:104-105 + 168-182) returns activity rows for every data entity matching the date/datasource/namespace/tag/owner/user filters — across all owners. Only `type=MY_OBJECTS` (`fetchMyActivities`, ActivityServiceImpl.java:184-199) consults `authIdentityProvider.fetchAssociatedOwner()` to filter to the caller's owner association. The `UPSTREAM`/`DOWNSTREAM` paths (`fetchDependentActivities`, ActivityServiceImpl.java:201-217) walk the lineage graph via `DataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)` — the resulting set of dependent oddrns is NOT filtered by the caller's ownership; anyone can ask 'what is upstream of X' regardless of whether they own X. This is consistent with the read-side ownership pattern across odd-platform (concepts.yaml:64,72 — `getDataEntityActivity`, `getDataEntityDetails`, and 27+ read endpoints bypass owner scoping)." — evidence: ActivityServiceImpl.java:86-117 (the four-way dispatch) + ActivityServiceImpl.java:168-182 (fetchAllActivities — no owner filter) + ActivityServiceImpl.java:184-199 (fetchMyActivities — only path that calls fetchAssociatedOwner) + ActivityServiceImpl.java:201-217 (fetchDependentActivities — no caller-ownership filter).
- data_exposure:
  - "Activity payload (id, event_type, created_at, created_by (AssociatedOwner — exposes the actor's owner + username), data_entity (DataEntityRef — exposes the entity's oddrn + naming + type), old_state + new_state (every tracked field's value before/after the change — including `description` free-text via DescriptionActivityStateDto, `business_name` edits, `internal_name` edits on dataset fields, custom-metadata key/value, term assignments, tag assignments, ownership transitions, alert halt-config changes)) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, no owner filter applied at controller, service, or repository layer for the default/ALL/UPSTREAM/DOWNSTREAM type paths; under DISABLED, any caller able to reach the port." — evidence: components.yaml:2861-2935 (Activity + ActivityState schemas) + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 (no field redaction) + ActivityServiceImpl.java:86-117 + ActivityServiceImpl.java:168-217.
  - "Aggregate counts (totalCount, myObjectsCount, downstreamCount, upstreamCount) → any authenticated user via `GET /api/activity/counts`. `totalCount` is cross-owner; `myObjectsCount` is owner-scoped to the caller; downstream/upstream are lineage-scoped without caller-ownership filtering." — evidence: ActivityController.java:43-56 + ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258.
  - "Filter inputs (`userIds`, `ownerIds`) act as enumeration probes — a caller can submit a list of candidate user/owner ids and observe response cardinality to learn which ids correspond to active users/owners. No authorization gate prevents this." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 (parameters threaded through unchanged).
- known_security_gaps:
  - "`/api/activity` (and `/api/activity/counts`) has no `@PreAuthorize`, no programmatic permission check at controller or service layer, and no entry in `SecurityConstants.SECURITY_RULES` to wire a Permission gate via the `AuthorizationCustomizer`. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user can read the GLOBAL activity feed across every owner in the platform — including audit trails for resources they have no ownership association with, exposing actor identity (created_by) and full old-state/new-state diffs of descriptions, business names, ownership changes, and custom metadata. The Policies/Permissions/Roles/Owners framework documented at `/configuration-and-deployment/enable-security/authorization` is not applied to this endpoint." — evidence: ActivityController.java:1-58 + ActivityServiceImpl.java:86-117 + SecurityConstants.java:95-356 (no rule for /api/activity) + WebFetch /configuration-and-deployment/enable-security/authorization (live page, no per-endpoint wiring; live activity-feed page, no visibility statement). — severity: HIGH
  - "`type=null` (caller omits the parameter) and `type=ALL` both route to `fetchAllActivities` via separate branches — a future refactor that adds owner-scoping to the `ALL` enum case without also handling the `null` case would silently bypass the new gate. Defence-in-depth requires either collapsing the two branches or asserting `type` non-null at the controller layer." — evidence: ActivityServiceImpl.java:103-105 (the `if (type == null)` branch) + ActivityServiceImpl.java:114 (`case ALL -> fetchAllActivities(...)`). — severity: MEDIUM
  - "`userIds` and `ownerIds` filter parameters are not validated — submission of arbitrary id lists allows enumeration of which users/owners have generated platform activity. No rate limit on `/api/activity`; an attacker can sweep id ranges quickly." — evidence: ActivityController.java:30-31 + ActivityServiceImpl.java:179-181 + grep for `@RateLimit|@Throttle|RateLimiter` across the controller package (zero matches, observed pattern). — severity: MEDIUM
  - "Under `auth.type=DISABLED` the endpoint is reachable by anonymous traffic — no fail-closed behaviour. Per the live docs, DISABLED is dev-only, but a production deployment that mis-sets `auth.type` exposes the full cross-owner audit trail to anonymous callers." — evidence: ActivityController.java:1-58 (no fail-closed annotation) + DisabledAuthSecurityConfiguration.java:16 (`.anyExchange().permitAll()`). — severity: LOW (gated on dev-only deployment guidance being followed).

## performance

- hot_paths:
  - "`fetchAllActivities` runs a single PostgreSQL query against the `activity` table filtered by 8 facets + cursor (begin/end date, datasourceId, namespaceId, tagIds, ownerIds, userIds, eventType, lastEventId, lastEventDateTime). With no upper bound enforced at the controller, a caller submitting a wide date window + no filters + large `size` triggers a full-window scan. Cursor pagination via `(lastEventId, lastEventDateTime)` is the correct shape for append-only audit data and avoids deep-offset cliffs, but the FIRST page on a wide window is still O(N) over rows that match the filters." — evidence: ActivityController.java:23-41 (the parameters threaded through) + ActivityServiceImpl.java:168-182 + (concepts.yaml:108 — established as the cursor-pagination pattern for activity streams).
  - "`fetchDependentActivities` runs lineage-graph resolution (`DataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)`) BEFORE the activity query — `flatMapMany` waits for the oddrn set, then queries `findDependentActivities(... oddrns)`. For deep lineage graphs the resolution step dominates latency." — evidence: ActivityServiceImpl.java:201-217 (the two-step `flatMapMany`).
  - "`getActivityCounts` issues FOUR parallel Mono queries (`totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount`) via `Mono.zip` — every call to `/api/activity/counts` runs four separate aggregation queries against the `activity` table." — evidence: ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258.
- throughput_characteristics:
  - "Single-window GET per call — no streaming, no chunked response. The reactive `Flux<Activity>` flows from repository to response, but the cursor parameters mean the client controls page boundaries explicitly."
  - "Reactive Mono/Flux signature — non-blocking on the request thread; downstream DB I/O is the bottleneck."
  - "No batch / bulk variant of `/api/activity` — a UI rendering a multi-window activity dashboard issues N separate calls."
- resource_allocation:
  - "Per-call cost (type=ALL or null): 1 DB aggregation/range scan over the `activity` table filtered by 8 facets. No outbound HTTP, no in-memory accumulation beyond the result Flux."
  - "Per-call cost (type=MY_OBJECTS): 1 DB read to resolve `fetchAssociatedOwner()` (auth/user/owner table lookup) + 1 activity-table scan filtered by `owner.getId()`."
  - "Per-call cost (type=UPSTREAM/DOWNSTREAM): 1 lineage-graph traversal (cost depends on graph depth and configured `getNeighbours` limits) + 1 activity-table scan filtered by the resulting oddrn set (IN-clause cardinality matches the dependent-entity count)."
  - "Per-call cost (counts endpoint): 4× the above — `totalCount` + `myObjectsCount` + downstream + upstream, all zipped."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally."
  - "No row-level lock, no advisory lock — purely a read path. Concurrent calls compete for DB connections and Postgres planner resources but do not serialise on locks."
  - "Cursor pagination scales linearly with page count for the requesting client — appropriate for an audit log. Offset pagination (not used here) would degrade quadratically for deep pages."
  - "No server-enforced upper bound on `size` — a single call can be made arbitrarily expensive in one round-trip by setting `size=Integer.MAX_VALUE`. The DB query plan + Postgres LIMIT clause are the only safeguard."
- known_performance_gaps:
  - "`size` parameter has no `@Max` constraint and no programmatic upper bound. A single mis-tuned client (or hostile caller) can issue `size=10000000` and force the DB to plan a wide scan. The cursor design assumes well-behaved clients page through with reasonable `size`; that assumption is undocumented." — evidence: ActivityController.java:26 + ActivityServiceImpl.java:179-181. — severity: MEDIUM
  - "`getActivityCounts` issues four parallel aggregation queries per call. For a UI that polls the counts endpoint on a refresh interval, the DB load is 4× the apparent endpoint count. No caching, no debouncing, no aggregate-table." — evidence: ActivityServiceImpl.java:139-166. — severity: LOW
  - "`fetchDependentActivities` walks the lineage graph before issuing the activity query — for entities with deep upstream/downstream graphs, this is a multi-hop traversal in the hot path. No cache, no precomputed dependency-set on the activity row itself." — evidence: ActivityServiceImpl.java:201-217 + ActivityServiceImpl.java:246-258. — severity: LOW (depends on deployment-specific lineage graph depth).
  - "Cursor pagination uses `(lastEventId, lastEventDateTime)` as a composite cursor — the repository implementation must filter on both fields with a tiebreaker. If the underlying SQL composite-cursor predicate is not backed by an index covering `(created_at DESC, id DESC)` on `activity`, deep-window scans degrade. Out-of-scope for this controller-method sidecar (lives in the repository), but worth surfacing." — evidence: ActivityController.java:34-35 + ActivityServiceImpl.java:179-180. — severity: LOW

## sources

- understanding ← ActivityController.java:23-41 + ActivityServiceImpl.java:86-117 + components.yaml:2861-2889 + components.yaml:3159-3166
- concepts.entities.Activity ← ActivityController.java:7 + components.yaml:2861-2889
- concepts.entities.ActivityType ← ActivityController.java:10 + components.yaml:3159-3166
- concepts.entities.ActivityEventType ← ActivityController.java:9 + components.yaml:3167-3197
- concepts.entities.ActivityState ← components.yaml:2891-2935
- concepts.invariants.[0] ← ActivityServiceImpl.java:98-100 + openapi.yaml:3214,3220
- concepts.invariants.[1] ← ActivityController.java:34-35 (cursor parameters) + ActivityServiceImpl.java:179-180
- concepts.invariants.[2] ← ActivityServiceImpl.java:103-117 (the four-way switch)
- concepts.invariants.[3] ← components.yaml:2861-2935 (Activity + ActivityState schemas)
- dependencies_semantic.requires-feature.[0] ← ActivityController.java:11 + ActivityController.java:21 + ActivityServiceImpl.java:14-29
- dependencies_semantic.requires-feature.[1] ← ActivityController.java:6 + ActivityController.java:20 (`implements ActivityApi`) + openapi.yaml:3206-3398
- dependencies_semantic.requires-feature.[2] ← ActivityServiceImpl.java:14,194,239 (`authIdentityProvider.fetchAssociatedOwner`)
- dependencies_semantic.requires-feature.[3] ← ActivityServiceImpl.java:24,212,254 (`dataEntityRelationsService.getDependentDataEntityOddrns`)
- dependencies_semantic.requires-runtime ← ActivityController.java:13-16
- dependencies_semantic.coupling ← ActivityController.java:1-58 + ActivityApi.java (generated, grep returned no auth annotations) + SecurityConstants.java:95-356 + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16
- tests_coverage_semantic ← absence of any test file matching `ActivityController` / `getActivityList` / `fetchAllActivities` across `odd-platform-api/src/test` (verified via find + grep, zero matches)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-10)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/activity (status 404, 2026-05-10)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization (status 200, 2026-05-10)
- implicit_adrs.[0] ← ActivityController.java:34-35 + ActivityServiceImpl.java:179-180 + concepts.yaml:108
- implicit_adrs.[1] ← ActivityServiceImpl.java:98-100 + openapi.yaml:3214,3220
- implicit_adrs.[2] ← ActivityController.java:32 + ActivityServiceImpl.java:107-117 + components.yaml:3159-3166
- bugs_limitations_corner_cases.[0] ← ActivityController.java:34 + ActivityService.java:42
- bugs_limitations_corner_cases.[1] ← ActivityServiceImpl.java:103-115
- bugs_limitations_corner_cases.[2] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- bugs_limitations_corner_cases.[3] ← ActivityController.java:26 + ActivityServiceImpl.java:179-180
- bugs_limitations_corner_cases.[4] ← DescriptionActivityStateDto.java:3 + components.yaml:2891-2935 + ActivityServiceImpl.java:168-182
- bugs_limitations_corner_cases.[5] ← ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-230
- security.auth_mode_relevance ← ActivityController.java:18 + ActivityController.java:1-58 + SecurityConstants.java:95-356 + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:16 + WebFetch /configuration-and-deployment/enable-security/authorization (200)
- security.ingestion_filter_relevance ← ActivityController.java:23-41 (path /api/activity, not /ingestion) + LoginFormSecurityConfiguration.java:49-50,61-63
- security.authorization_assertions ← ActivityController.java:23-41 + ActivityApi.java (generated, no auth annotations) + SecurityConstants.java:98-356 (no /api/activity rule) + AuthorizationCustomizer.java:24-30
- security.owner_scoping ← ActivityServiceImpl.java:86-117 + ActivityServiceImpl.java:168-182 + ActivityServiceImpl.java:184-199 + ActivityServiceImpl.java:201-217 + concepts.yaml:64,72
- security.data_exposure.[0] ← components.yaml:2861-2935 + DescriptionActivityStateDto.java:3 + ActivityController.java:23-41 + ActivityServiceImpl.java:86-217
- security.data_exposure.[1] ← ActivityController.java:43-56 + ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258
- security.data_exposure.[2] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- security.known_security_gaps.[0] ← ActivityController.java:1-58 + ActivityServiceImpl.java:86-117 + SecurityConstants.java:95-356 + WebFetch /configuration-and-deployment/enable-security/authorization
- security.known_security_gaps.[1] ← ActivityServiceImpl.java:103-115
- security.known_security_gaps.[2] ← ActivityController.java:30-31 + ActivityServiceImpl.java:179-181
- security.known_security_gaps.[3] ← ActivityController.java:1-58 + DisabledAuthSecurityConfiguration.java:16
- performance.hot_paths.[0] ← ActivityController.java:23-41 + ActivityServiceImpl.java:168-182 + concepts.yaml:108
- performance.hot_paths.[1] ← ActivityServiceImpl.java:201-217
- performance.hot_paths.[2] ← ActivityServiceImpl.java:139-166 + ActivityServiceImpl.java:219-258
- performance.resource_allocation ← ActivityServiceImpl.java:168-258
- performance.scaling_characteristics ← ActivityController.java:18 + ActivityServiceImpl.java:86-258
- performance.known_performance_gaps.[0] ← ActivityController.java:26 + ActivityServiceImpl.java:179-181
- performance.known_performance_gaps.[1] ← ActivityServiceImpl.java:139-166
- performance.known_performance_gaps.[2] ← ActivityServiceImpl.java:201-217 + ActivityServiceImpl.java:246-258
- performance.known_performance_gaps.[3] ← ActivityController.java:34-35 + ActivityServiceImpl.java:179-180

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

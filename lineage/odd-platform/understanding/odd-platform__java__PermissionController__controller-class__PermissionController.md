---
node_id: "odd-platform java PermissionController controller-class:PermissionController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZD-PermissionController-class
feature_hint: "P-09:F-001 (Role-Based Access Control) — the read-side authorization-discovery controller; the SOLE class on the perimeter through which the UI asks 'what can I do on resource X RIGHT NOW?' against the same policy graph that AuthorizationCustomizer enforces on mutations"
related_features:
  - F-001  # Role-Based Access Control
  - F-006  # the wider Policy / Role / Permission resolution family — same evaluation graph
related_pillar_features:
  - P-09:F-001
related_retrospectives:
  - LSN-018   # phantom-node-prevention case-law — batch P emitted a synthetic getPolicyPermissions candidate against this very file (PHANTOM); this sidecar's class-level scope records the ABSENCE explicitly so future walkers do not re-synthesise it
  - LSN-020   # Category F input-name vs SQL-bind alignment — this controller has ONE named query parameter (resourceType) and one (resourceId); both fire Category F
coherence_check:
  performed_at: "2026-05-25"
  strengthens:
    - "batch-S PolicyServiceImpl `getCurrentUserPolicies` is the AUTHORIZATION HOT PATH consumer — this controller is one of the TWO entry-points into that hot path (the other being SecurityConstants.SECURITY_RULES enforcement on mutation endpoints). CONFIRMED at PermissionController.java:23 → PermissionServiceImpl.java:28-29 → AbstractContextualPermissionExtractor.java:27 (`policyService.getCurrentUserPolicies()`)."
    - "batch-H ReactivePolicyRepositoryImpl unfiltered `getRolesPolicies` JOIN — this controller surfaces every soft-deleted-policy permission as if it were live; same defect as the AuthorizationCustomizer enforcement path because they share the evaluation chain. The READ surface inherits the WRITE surface's hidden grant."
    - "batch-P phantom-node finding (getPolicyPermissions is a PHANTOM) — class-level enumeration here PRIMARY-SOURCES the absence: this 26-line file exposes EXACTLY ONE method (`getResourcePermissions`), implements `PermissionApi`, no other method exists. The phantom-node candidate REFACTOR-435 stays a methodology miss; this sidecar is the canonical class-level negative evidence."
    - "batch-Q PolicyList UI tier — the UI's button-enable state for policy-administration actions in Management → Access Management flows from MANAGEMENT-scope global permissions (NOT this controller), because MANAGEMENT has `hasContext = false` (PolicyTypeDto.java:12). This controller is REJECTABLE for MANAGEMENT — calling it with `PermissionResourceType.MANAGEMENT` triggers `BadUserRequestException` (PermissionServiceImpl.java:25-27). The UI Management surface uses `getGlobalPermissions` (profile.selectors.ts:17-20) reading from `profile.owner?.identity.permissions` populated by the IdentityServiceImpl side — sibling endpoint, not this one."
    - "controller-method sibling sidecar (odd-platform__java__PermissionController__controller-method__getResourcePermissions.md) — class-level scope EXTENDS the method-level findings with the class-shape concerns: single-method-class shape, naming-vs-surface mismatch (file named 'PermissionController' but is NOT the controller for the WHOLE Permission/RBAC surface — half the read surface lives on IdentityService), DI surface."
  supersedes: []
  conflicts: []
  back_links_emitted:
    - "F-001"
    - "batch-S PolicyServiceImpl sidecar"
    - "batch-H ReactivePolicyRepositoryImpl sidecar"
    - "batch-P phantom-node note (state/batch-P-trace.yaml:20-23)"
    - "batch-Q PolicyList sidecar (UI consumer surface)"
    - "controller-method sibling: odd-platform__java__PermissionController__controller-method__getResourcePermissions.md"
---

# PermissionController — semantic understanding

## understanding

`PermissionController` is the **single-method HTTP controller-class for ODD Platform's read-side RBAC discovery** — 27 lines, ONE endpoint (`getResourcePermissions` at line 20-25) implementing the OpenAPI-generated `PermissionApi` interface as a 2-line reactive delegation onto an injected `PermissionService` bean. The class-shape is the smallest in the codebase: one DI dependency, one method, no `@PreAuthorize`, no programmatic auth check, no `@Slf4j`, no `@Validated`, no controller-level security annotation. **The file is misnamed for its actual coverage**: the public Authorization page's vocabulary ("Permissions") spans BOTH a contextual read surface (this controller, evaluated against a specific data-entity / term / query-example) AND a global non-contextual MANAGEMENT-scope read surface (handled NOT by this controller but by `IdentityServiceImpl` populating `profile.owner?.identity.permissions` and delivered through the `Identity` payload to the UI selector `getGlobalPermissions` at profile.selectors.ts:17-20). Calling `getResourcePermissions(MANAGEMENT, anyId)` raises `BadUserRequestException("Resource type MANAGEMENT does not have context")` at `PermissionServiceImpl.java:26` → ControllerAdvice handles → HTTP 400 with error code `USR001`. **The endpoint is NOT gated by any SecurityRule** — `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) has zero entries for `/api/resource/{permission_resource_type}/{resource_id}/permissions`; the path falls through to `pathMatchers("/**").authenticated()` at `AuthorizationCustomizer.java:29-30`. Any authenticated user can query their own resolved permissions on any resource id (subject to resource existence — the DataEntity extractor raises `NotFoundException` at `DataEntityPermissionExtractor.java:64-66` for missing entities; the Term / QueryExample extractors similarly raise via `switchIfEmpty` on dto-mono fetches). **The class-level phantom-node** carried by batch P (REFACTOR-435 — `getPolicyPermissions`) is PRIMARY-SOURCED here as a class-shape negative finding: this file has exactly ONE method, the catalogue-read surface lives elsewhere on `PolicyController.getPolicySchema`. **Zero tests** cover the controller, the service, or any of the four extractors — `find <odd-platform-repo> -name 'Permission*Test*'` returns zero.

## concepts

- entities: [
    "`PermissionApi` — OpenAPI-generated controller interface (line 4, 16); the contract this @RestController implements. The single method signature is auto-derived from `openapi.yaml:3681-3702` (`/api/resource/{permission_resource_type}/{resource_id}/permissions`).",
    "`PermissionService` — the SOLE injected service bean (line 7, 17); 2-method interface (`PermissionService.java:7-12`) of which this controller invokes EXACTLY ONE (`getResourcePermissionsForCurrentUser`). The other interface method (`getNonContextualPermissionsForCurrentUser` — the MANAGEMENT-scope read) is invoked by `IdentityServiceImpl` (per Grep result), NOT by this controller — the read surface is split across two controllers / paths.",
    "`Permission` — OpenAPI-generated enum (line 5; full set at `components.yaml:158-235`); 75 enum values mirroring `PolicyPermissionDto` 1-1 by name except the `ALL` server-side wildcard (which is expanded by `PolicyPermissionExtractor.getPermissionsByType` BEFORE `Permission.fromValue(p.name())` is called at `AbstractContextualPermissionExtractor.java:33`).",
    "`PermissionResourceType` — OpenAPI-generated path-parameter enum (line 6; spec at `components.yaml:3381-3387`); FOUR values: `DATA_ENTITY`, `TERM`, `QUERY_EXAMPLE`, `MANAGEMENT`. Maps 1-1 by name (`PolicyTypeDto.valueOf(resourceType.name())` at `PermissionServiceImpl.java:24`) to the internal `PolicyTypeDto` (`PolicyTypeDto.java:8-12`).",
    "`PolicyTypeDto` (internal) — `PolicyTypeDto.java:8-12` — carries the boolean `hasContext` discriminator: DATA_ENTITY=true, TERM=true, QUERY_EXAMPLE=true, MANAGEMENT=false. The discriminator is what makes this controller's MANAGEMENT call path reject instead of delegate to a No-Context extractor.",
    "`ServerWebExchange` — Spring WebFlux reactive request context (line 10, 22); injected but UNUSED in the method body — pure delegation, the exchange is consumed by the framework only (cookie / auth / SecurityContext extraction)."
  ]
- operations: [
    "`getResourcePermissions(PermissionResourceType resourceType, Long resourceId, ServerWebExchange exchange)` (lines 19-25) — the ONLY method. Reactive `Mono<ResponseEntity<Flux<Permission>>>` shape (line 20). Body is `return Mono.just(permissionService.getResourcePermissionsForCurrentUser(resourceType, resourceId)).map(ResponseEntity::ok);` (lines 23-24). Returns 200 (line 24) and OpenAPI declares 200 (`openapi.yaml:3694-3700`) — NO status-code drift on this controller. Path: `GET /api/resource/{permission_resource_type}/{resource_id}/permissions`."
  ]
- invariants: [
    "The ENTIRE method body is two lines (23-24) — no business logic, no programmatic auth check, no validation. Pure stub-implementation of `PermissionApi`. The downstream service tier (`PermissionServiceImpl`) carries the enum-discriminator invariant; this class carries none.",
    "Single injected dependency — `PermissionService permissionService` (line 17), constructor-injected via Lombok `@RequiredArgsConstructor` (line 15). No optional dependencies, no qualifier annotations, no `@Lazy`.",
    "**No authorization annotation, no programmatic check** — the class carries `@RestController` (line 14) + `@RequiredArgsConstructor` (line 15) only. No `@PreAuthorize`, no `@Secured`, no `permissionService.hasPermission(...)` call in the method body. `SecurityConstants.SECURITY_RULES` has ZERO entries for the path; only `pathMatchers(\"/**\").authenticated()` applies. Any authenticated caller can hit this endpoint for any resource id.",
    "**No `@Slf4j`, no Logger, no log call** — the class has zero observability annotations. A permission-read for a resource is invisible to the audit log. A caller iterating resource ids to enumerate which entities they have elevated permissions on leaves no controller-tier trace.",
    "**Class is a single-method file (27 lines)** — anomalous shape across the controller package. Most controllers (Tag, Policy, Activity, DataEntity, Alert) carry 4-15 endpoints. This controller is the smallest in the package; the smallness is structural — the wider Permission/RBAC read surface is split: contextual reads here, non-contextual MANAGEMENT reads via `IdentityServiceImpl.populate identity.permissions`.",
    "**File naming vs actual surface mismatch** — the file is named `PermissionController` (suggesting it owns the full Permission read surface) but it owns ONLY the contextual half. The non-contextual MANAGEMENT half is on `IdentityServiceImpl` and delivered via `Identity.permissions`. A new maintainer searching for 'where do permissions come back to the UI?' must read BOTH paths.",
    "**The MANAGEMENT resource type is REJECTED, not redirected** — calling `getResourcePermissions(MANAGEMENT, anyId)` triggers `BadUserRequestException(\"Resource type MANAGEMENT does not have context\")` at `PermissionServiceImpl.java:26` → 400 USR001. The endpoint shape accepts MANAGEMENT as a path-parameter value (because the OpenAPI enum lists it at `components.yaml:3387`), but the service-tier discriminator (`PolicyTypeDto.hasContext`) raises at runtime. A caller who reads the spec sees four allowed types; three actually work."
  ]
- audiences: [
    "odd-platform-ui-end-user — every page that renders permission-gated buttons (data-entity detail, term detail, query-example detail). Per `DataEntityDetails.tsx:71-75`, `TermDetails.tsx:39-44`, `TermDetailsRoutes.tsx:21-25`, `Overview.tsx (Term):22-25`, `QueryExampleDetailsContainer.tsx:21-24`, `AlertItem.tsx:50-68`. Five UI surfaces depend on this endpoint to decide what to enable. Some surfaces also read `getGlobalPermissions` (the MANAGEMENT half) — e.g. `AlertItem.tsx:59` unions the two before checking `DATA_ENTITY_ALERT_RESOLVE`.",
    "odd-api-consumer — programmatic clients via the OpenAPI spec at `/api/v3/api-docs`.",
    "platform-operator — RBAC author auditing 'what does this user see right now?' through their own session.",
    "future-operator-auditing-rbac — anyone investigating why a button is enabled / disabled in the UI ends at this controller; the 'why' is then in the policy/role tables, not in this controller."
  ]

## dependencies_semantic

- requires-feature: [
    "`PermissionApi` OpenAPI-generated controller interface (`api.contract.api.PermissionApi`) — supplies the method signature, the HTTP path-matcher, the `@RequestMapping(method = GET, value = '/api/resource/{permission_resource_type}/{resource_id}/permissions', produces = 'application/json')` annotation set, the 200-OK response wiring. Generated at build time from `odd-platform-specification/openapi.yaml:3681-3702`.",
    "`PermissionService` (`PermissionService.java:7-12`) — 2-method interface; this controller invokes 1.",
    "`PermissionServiceImpl` — actual implementation; carries the `hasContext` discriminator invariant and dispatches to the right extractor list.",
    "`ContextualPermissionExtractor` list (3 beans: `DataEntityPermissionExtractor`, `TermPermissionExtractor`, `QueryExamplePermissionExtractor`) — injected as `List<ContextualPermissionExtractor>` into `PermissionServiceImpl` (line 18). The extractor matching `PolicyTypeDto.valueOf(resourceType.name())` resolves the permissions; missing extractor raises `IllegalArgumentException(\"No extractor for resource type %s\")` at `PermissionServiceImpl.java:47-48`.",
    "`AbstractContextualPermissionExtractor` (the shared evaluation method `getContextualResourcePermissions(resourceId)`) — `Mono.zip(contextMono, policiesMono)` → `flatMapIterable(statements → Permissions)`.",
    "`PolicyService.getCurrentUserPolicies()` — the AUTHORIZATION HOT PATH; per-call JOOQ query at `PolicyServiceImpl.java:103-107` (read via batch-S sidecar). Every call into this controller triggers ONE fetch of the caller's policies — no caching.",
    "`AuthIdentityProvider.fetchAssociatedOwner / getCurrentUser` — caller-identity resolution; reads `ReactiveSecurityContextHolder.getContext()` at `AuthIdentityProviderImpl.java:24-53`.",
    "`ControllerAdvice` (`controller/exception/ControllerAdvice.java:24-28`) — translates `BadUserRequestException` → HTTP 400 with `code=USR001`. Translates `NotFoundException` → HTTP 404 with `code=USR002`. Without ControllerAdvice, `BadUserRequestException` thrown synchronously inside the reactive chain falls to the catch-all `@ExceptionHandler(Exception.class)` at line 61 — surfaces as 500."
  ]
- requires-config: []
  N/A — the class reads no config keys; no `@Value`, no `@ConfigurationProperties`. The endpoint's behaviour shifts based on `auth.type` (DISABLED skips auth chain entirely; LOGIN_FORM short-circuits to admin authority; OAUTH2/LDAP perform live policy evaluation), but the coupling is in the auth-config classes (`DisabledAuthSecurityConfiguration`, `LoginFormSecurityConfiguration`, `OAuthSecurityConfiguration`, `LDAPSecurityConfiguration`), NOT in this file.
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` (line 14); reactive `Mono` / `Flux` throughout (lines 11-12, 20).",
    "Lombok `@RequiredArgsConstructor` (line 15) — generates the constructor injecting `PermissionService`.",
    "`reactor.core.publisher.Mono` / `Flux` — return-type composition.",
    "Spring Security ReactiveSecurityWebFilterChain — composed via one of the four `*SecurityConfiguration` classes (whichever `auth.type` resolves at boot). The chain provides `authenticated()` enforcement + populates the `ReactiveSecurityContextHolder` that downstream `AuthIdentityProviderImpl` reads.",
    "`SecurityWebFiltersOrder` wiring in `OAuthSecurityConfiguration.java:108-110` (the S2S filter, gated by `auth.s2s.enabled`) — does NOT apply to this controller's path because S2S ingestion runs on `/ingestion/entities`, but the chain composition is what makes Spring Security's auth-chain present at all."
  ]
- couples-to: [
    "`PermissionApi` (`implements` at line 16) — the method is an `@Override` of the generated interface. Any spec change (response shape, path, or parameter type) propagates here on the next build.",
    "`PermissionService.getResourcePermissionsForCurrentUser(PermissionResourceType, long)` (`PermissionController.java:23` + `PermissionService.java:8-9`) — sole downstream call.",
    "`PermissionServiceImpl.getResourcePermissionsForCurrentUser` (`PermissionServiceImpl.java:22-30`) — dispatches by `PolicyTypeDto.valueOf(resourceType.name())` (line 24); throws `BadUserRequestException` if `!hasContext`; otherwise looks up the right `ContextualPermissionExtractor` via `getExtractor`.",
    "`AbstractContextualPermissionExtractor.getContextualResourcePermissions` — the shared evaluation path. The class indirectly couples to FOUR sub-classes: 3 contextual (DataEntity, Term, QueryExample) + the abstract base. Adding a new contextual `PolicyTypeDto` (a fifth `hasContext=true` value) without registering a corresponding `ContextualPermissionExtractor` bean raises `IllegalArgumentException` at runtime (`PermissionServiceImpl.java:47-48`).",
    "`PolicyServiceImpl.getCurrentUserPolicies` — the AUTHORIZATION HOT PATH. Per batch-S finding, this is the per-request DB-roundtrip site. Every call into this controller adds 1 DB round-trip there + extractor-specific round-trips (4 for DataEntity, fewer for Term and QueryExample).",
    "`Permission` (OpenAPI enum) ↔ `PolicyPermissionDto` (Java enum) — name-mapped 1-1 via `Permission.fromValue(p.name())` at `AbstractContextualPermissionExtractor.java:33`. The mapping is FRAGILE: if a `PolicyPermissionDto` enum value is added without the corresponding entry in `Permission` (openapi.yaml), `Permission.fromValue(...)` throws `IllegalArgumentException` at runtime — surfaces as 500 USR001 (catch-all). Conversely, `PolicyPermissionDto.ALL` is NOT exported as `Permission.ALL` (the OpenAPI Permission enum has 75 values, no `ALL`); but the extractor's `getPermissionsByType` expands `ALL` BEFORE `fromValue` is called (PolicyPermissionExtractor.java:55-58, 64-66), so the divergence is intentionally bridged by the expansion."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Controller-class HTTP smoke test — `GET /api/resource/DATA_ENTITY/{id}/permissions` returns 200 with a deserialisable `List<Permission>`."
    test_class: integration
    criticality: HIGH
    note: "Smallest reproducer: @WebFluxTest(PermissionController.class) + WebTestClient.get().uri('/api/resource/DATA_ENTITY/{id}/permissions', existingId).exchange().expectStatus().isOk()"
  - behaviour: "MANAGEMENT resource type triggers HTTP 400 — `GET /api/resource/MANAGEMENT/{anyId}/permissions` returns 400 with body `{message: 'Resource type MANAGEMENT does not have context', code: 'USR001'}`."
    test_class: integration
    criticality: HIGH
    note: "Tests the discriminator invariant + the ControllerAdvice translation path; without this test, a refactor that moves the check from service to controller (or vice versa) could silently surface 500 instead of 400."
  - behaviour: "Missing-resource path returns 404 — `GET /api/resource/DATA_ENTITY/9999999/permissions` for a non-existent entity returns 404 USR002."
    test_class: integration
    criticality: HIGH
    note: "DataEntityPermissionExtractor.java:64-66 raises NotFoundException; Term + QueryExample extractor counterparts not statically verified to share the throw-not-empty pattern — those are unverified existence-asymmetries"
  - behaviour: "Each contextual resource type evaluates against the right extractor — DATA_ENTITY → DataEntityPermissionExtractor, TERM → TermPermissionExtractor, QUERY_EXAMPLE → QueryExamplePermissionExtractor."
    test_class: unit
    criticality: MEDIUM
    note: "PermissionServiceImpl.getExtractor (PermissionServiceImpl.java:42-49); a refactor that breaks the filter predicate (`e.getResourceType() == resourceType`) would silently dispatch to the wrong extractor"
  - behaviour: "Endpoint behaviour matrix across auth modes — DISABLED returns empty (no SecurityContext); LOGIN_FORM returns admin's full permission set regardless of resource; OAUTH2/LDAP return live-policy-derived set."
    test_class: security
    criticality: HIGH
    note: "Profile-based integration; spin up the app under each auth.type and confirm behaviour. The DISABLED-vs-mutation contradiction (UI says 'cannot' while mutation is permitted) is the highest-leverage security gap."
  - behaviour: "Anonymous caller under non-DISABLED modes returns 401 — `GET /api/resource/DATA_ENTITY/{id}/permissions` without authentication should be rejected by `authenticated()`."
    test_class: security
    criticality: HIGH
    note: "AuthorizationCustomizer.java:29-30 catch-all"
  - behaviour: "DataEntity extractor evaluates owner-conditional policy correctly — a user with `owner_id = X` and a policy gated by `owner = self` sees ownership-conditioned permissions, while a user without owner association sees only global grants."
    test_class: integration
    criticality: HIGH
    note: "DataEntityPermissionExtractor.java:51-56 (fetchAssociatedOwner + switchIfEmpty to null-owner context); regression here silently changes who sees what without breaking compile-time signatures"
  - behaviour: "`ALL` permission expansion in the Administrator policy correctly surfaces every DATA_ENTITY_* / TERM_* / QUERY_EXAMPLE_* permission for the resource type."
    test_class: integration
    criticality: HIGH
    note: "PolicyPermissionExtractor.java:55-58, 64-66 (the `allPermissions(s)` branch); the seed admin policy (V0_0_56) carries `'ALL'`; a regression in the expansion would mean admin sees fewer permissions than expected"
  - behaviour: "Concurrent calls to the same resource_id with the same caller produce the same permission set (no race in caller-identity resolution)."
    test_class: performance
    criticality: MEDIUM
    note: "Caller identity comes from SecurityContext per request; no shared mutable state — but the assertion would catch any future caching layer that introduces a race"
  - behaviour: "Latency budget — single call p99 < 50ms under no-load conditions (4 DB round-trips per call for DataEntity)."
    test_class: performance
    criticality: LOW
    note: "Performance/latency baseline for UI rendering; if the budget regresses by >2x, list-view rendering becomes noticeable"
- test_files: []
  N/A — `find <odd-platform-repo> -name 'PermissionController*Test*' -o -name 'PermissionService*Test*' -o -name 'PermissionExtractor*Test*'` returns zero matches. The only permission-adjacent test in the repository is `PolicyDeserializerTest.java` (JSON deserialization of the policy document; unrelated to this endpoint).
- gaps: |
    The class-level test deficit is severe: zero unit tests on the controller, zero unit tests on `PermissionServiceImpl`, zero unit tests on any of the three `ContextualPermissionExtractor` implementations, zero integration tests on the auth-mode matrix. The endpoint sits on the UI's critical path for EVERY permission-gated button; a regression in any layer of the read chain (controller dispatch / service discriminator / extractor evaluation / policy expansion / name-mapping `Permission.fromValue`) silently changes which buttons render enabled. The highest-leverage missing tests are the auth-mode-matrix integration tests (covering the DISABLED-cascade-empty + LOGIN_FORM-admin-all-static contradictions documented in the controller-method sibling sidecar's `bugs_limitations_corner_cases`) AND the MANAGEMENT-rejection test (which would lock in the discriminator invariant — refactor risk class is high here because MANAGEMENT is a valid `PermissionResourceType` enum value at the spec layer but rejected at the service layer).

## docs_link_semantic

- declared_docs: []
  N/A — `PermissionController.java:1-27` carries no `@docs` Javadoc / no inline annotation. Consistent with the repo-wide convention; the class has zero comments.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical Authorization vocabulary page (Policies / Permissions / Roles / Owners / User-owner association). The class is the read-side surface of this entire model."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Fresh WebFetch this session (2026-05-25): the page provides an overview of the Authorization section with links to subsystem pages (Policies, Permissions, Roles, Owners, User-owner association). The fetch confirms: NO mention of `/api/resource/{type}/{id}/permissions`, NO mention of `PermissionResourceType` enum or its members (DATA_ENTITY, TERM, QUERY_EXAMPLE, MANAGEMENT), NO description of how the UI/client retrieves which permissions the user has for a given resource. (Verbatim from the fetch model: "I cannot find any documentation about: Client/UI endpoints for querying user permissions on resources; `/api/resource/{type}/{id}/permissions` or similar endpoints; `PermissionResourceType` enum or resource types ...; Get-resource-permissions operations.")
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permission catalogue page — the only page that enumerates permission names by category. Closest match to the response shape of this endpoint."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Fresh WebFetch this session (2026-05-25). The page lists 95 permission names partitioned into 5 categories: Data Entity (25 permissions), Term (7), Query Example (7), Lookup Table (9), Management (47). Quoted verbatim from the page heading: "Permissions in ODD Platform". Key claim from the page: "There are 5 types of permissions in ODD Platform". The page does NOT mention: HTTP GET endpoint specifications for retrieving user permissions; the `PermissionResourceType` enum or its members; references to `getResourcePermissions` functionality; UI behaviour descriptions for showing/hiding controls based on permissions.

      Drift surfaces on this page: (a) "5 types" — the code's `PermissionResourceType` enum exposes 4 (`PolicyTypeDto.java:8-12`); "Lookup Table" is listed as a category but is NOT a `PermissionResourceType`. Lookup-table permissions are `LOOKUP_TABLE_*` entries with `PolicyTypeDto.MANAGEMENT` per `PolicyPermissionDto.java:80-88`. From this controller's surface, no Lookup-Table resource is addressable. (b) The page lists `DIRECT_OWNER_SYNC` as a Management permission — confirmed in code at `PolicyPermissionDto.java:70`. (c) The page lists `DATA_ENTITY_ALERT_RESOLVE` — confirmed in code at `PolicyPermissionDto.java:27`.
- doc_drift_findings:
  - "The entire read-side permission-discovery endpoint is undocumented on the live `/authorization` page (WebFetched 2026-05-25, status 200) and the live `/authorization/permissions` page (WebFetched 2026-05-25, status 200). Neither page mentions `/api/resource/{permission_resource_type}/{resource_id}/permissions`, `getResourcePermissions`, the `PermissionResourceType` enum, or the UI's consumption pattern. An operator reading the docs to understand 'how does the UI decide which buttons to enable?' will NOT find the answer. Severity: HIGH for doc completeness. doc-gap-finder reducer routes this to a DOC-NNN candidate."
  - "The live `/authorization/permissions` page lists FIVE permission categories (Data Entity, Term, Query Example, Lookup Table, Management), but the code's `PermissionResourceType` enum exposes FOUR values (DATA_ENTITY, TERM, QUERY_EXAMPLE, MANAGEMENT — `PolicyTypeDto.java:8-12`). 'Lookup Table' is a permission category in the docs but is NOT a resource type addressable through this controller. From the operator's perspective, the four-value enum is asymmetric with the five-category docs; the asymmetry is undocumented. Severity: MEDIUM (doc-code shape mismatch)."
  - "The live docs are silent on the MANAGEMENT-rejection invariant — calling `GET /api/resource/MANAGEMENT/{anyId}/permissions` triggers HTTP 400 USR001 with body `\"Resource type MANAGEMENT does not have context\"` (PermissionServiceImpl.java:25-27), but neither the `/authorization` page nor `/authorization/permissions` describes this behaviour. A caller reading the spec sees four allowed enum values (including MANAGEMENT) and expects MANAGEMENT to work; runtime rejects it. Severity: MEDIUM."
  - "The live docs do NOT distinguish the split between contextual reads (this controller) and non-contextual MANAGEMENT reads (delivered through `Identity.permissions` from `IdentityServiceImpl`). The UI consumes BOTH; the docs describe NEITHER mechanism. An operator implementing a third-party client for ODD's RBAC would not know to look at the Identity payload for global permissions. Severity: MEDIUM."
  - "The live `/authorization/permissions` page lists 95 permission names — the spec's `Permission` enum at `components.yaml:158-235` also enumerates 75. The discrepancy is the result of partitioning: the docs include ALL permissions (including `LOOKUP_TABLE_*` and the `Permission.ALL` wildcard which is server-side only). The OpenAPI enum lists 75 values which corresponds to the codebase's `PolicyPermissionDto` minus `ALL`. Severity: LOW (informational; the spec enum is correct, the docs claim '95' total but list every name)."

## implicit_adrs

- "Read-side permission discovery is a first-class endpoint, not a derived client-side computation — the platform exposes the policy-evaluation graph as `GET /api/resource/{type}/{id}/permissions` so the UI doesn't reconstruct policy semantics. Structurally visible: the same `PermissionService` bean and the same `ContextualPermissionExtractor` instances are wired into `OAuthSecurityConfiguration.AuthorizationCustomizer` for mutation enforcement (`OAuthSecurityConfiguration.java:87-98`) AND consumed by this controller for UI discovery — read path and enforce path share one evaluation graph." — evidence: `PermissionController.java:17, 20-25` + `OAuthSecurityConfiguration.java:87-98` + `AuthorizationCustomizer.java:16` — intent_anchor: "`new AuthorizationCustomizer(permissionService, extractors)` ... `private final PermissionService permissionService;`" (`OAuthSecurityConfiguration.java:98` + `AuthorizationCustomizer.java:16`) — confidence: HIGH

- "Read-side endpoint is intentionally NOT in `SECURITY_RULES` — the read-collaborative posture. Any authenticated user can query their own permissions on any resource because the response reveals only what the policy graph would already grant them. The decision is consistent across the controller package: `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) overwhelmingly enumerates mutations (POST/PUT/PATCH/DELETE); read endpoints fall through to `authenticated()` unless they expose data that the user's policies should gate. This endpoint is the canonical case of 'reads return what the policy resolves; gating the read would be tautological'." — evidence: `SecurityConstants.java:98-355` (no GET rule for `/api/resource/.../permissions`; pattern: rules are POST/PUT/PATCH/DELETE-shaped) + `AuthorizationCustomizer.java:29-30` (catch-all `authenticated()`) — intent_anchor: "`spec.pathMatchers(\"/**\").authenticated();`" (`AuthorizationCustomizer.java:29-30`) — confidence: HIGH

- "Single-method controller class is the deliberate shape — the file is NOT a stub waiting for more methods. The non-contextual MANAGEMENT read surface is housed elsewhere (IdentityServiceImpl populates `Identity.permissions` for `getGlobalPermissions` consumption). The split is structural: 'context-dependent reads' here, 'global reads' on Identity. The decision is visible in the absence of a `getNonContextualPermissions` companion method on `PermissionController` despite `PermissionService` exposing one — the controller deliberately wires only the half that needs an endpoint." — evidence: `PermissionController.java:1-27` (one method only) + `PermissionService.java:7-12` (two methods exposed; one wired, one not) + `IdentityServiceImpl` consumer + UI `getGlobalPermissions` at `profile.selectors.ts:17-20` (consumes the OTHER half via Identity payload) — intent_anchor: structural pattern (no comment / no doc; the design intent is observable in the architectural split). Without a class-level comment, the decision-as-intent has MEDIUM confidence — the file may simply not have been refactored to add a non-contextual endpoint, in which case the absence is a gap not an ADR. The evidence weakly favours the ADR reading because `IdentityServiceImpl` correctly populates the field, and the wiring on the UI side (consume from Identity, not via this endpoint) is consistent across all UI surfaces. — confidence: MEDIUM

- "Resource-type ↔ context coupling is encoded at the enum (`PolicyTypeDto.hasContext`), not at the controller. The controller is type-agnostic — it accepts every `PermissionResourceType` value the spec allows, and lets the service-tier discriminator raise `BadUserRequestException` for non-contextual values. The decision is to keep the controller a pure stub of `PermissionApi`, push semantic discrimination to the service. Alternative shapes (e.g. two separate path matchers `/api/resource/contextual/...` vs `/api/resource/management/...`) are explicitly avoided." — evidence: `PolicyTypeDto.java:8-14` (the enum's `hasContext` field) + `PermissionServiceImpl.java:24-30` (the discriminator + throw) + `PermissionController.java:19-25` (no type-check at the controller) — intent_anchor: "`if (!policyTypeDto.isHasContext()) { throw new BadUserRequestException(\"Resource type \" + resourceType + \" does not have context\"); }`" (`PermissionServiceImpl.java:25-27`) — confidence: HIGH

- "Authoritative server-side evaluation, not UI hint — every read recomputes against the live policy/role tables; no caching layer between this controller and the policy tables. The decision is the integrity of the response: a UI that displays 'you can do X' must be able to attempt X and succeed (subject to AuthorizationCustomizer's enforcement on the same policy graph). A cache would introduce divergence between read-side and enforce-side." — evidence: `PermissionServiceImpl.java:22-30` (direct delegate, no cache annotation) + `AbstractContextualPermissionExtractor.java:25-35` (per-call zip, no memoisation) + `PolicyServiceImpl.java:103-107` (per-call DB roundtrip — confirmed via batch-S sidecar) — intent_anchor: "no `@Cacheable`, no `Mono.cache()`, no request-scoped memoisation across the entire chain" — confidence: HIGH

## bugs_limitations_corner_cases

- "**No tests cover the controller, the service, or any of the four extractors** — `find <odd-platform-repo> -name 'Permission*Test*'` returns zero. The endpoint sits on the critical path for every UI permission gate. A regression in any layer of the read chain silently changes UI behaviour without breaking compile or any existing test. — evidence: `PermissionController.java:1-27` + `find` result run 2026-05-25 — severity: HIGH"

- "**The endpoint accepts MANAGEMENT as a `PermissionResourceType` enum value (per OpenAPI spec `components.yaml:3387`) but rejects it at runtime with HTTP 400** — `PermissionServiceImpl.java:25-27` raises `BadUserRequestException(\"Resource type MANAGEMENT does not have context\")` whenever the path-parameter resolves to MANAGEMENT. A spec-compliant client built strictly from `openapi.yaml` would believe MANAGEMENT is valid; runtime contradicts. The rejection is undocumented on the live docs (per `doc_drift_findings[2]`). — evidence: `components.yaml:3387` + `PermissionServiceImpl.java:25-27` + `PolicyTypeDto.java:12` + WebFetch 2026-05-25 — severity: MEDIUM"

- "**The file is named `PermissionController` but does not own the full Permission read surface** — half the read surface (the non-contextual MANAGEMENT permissions consumed via `getGlobalPermissions` at `profile.selectors.ts:17-20`) lives on `IdentityServiceImpl`, not on this controller. A new maintainer reading this file alone gets an incomplete picture: 'permissions on data entity X' is queried here; 'global management permissions' is queried elsewhere. — evidence: `PermissionController.java:1-27` (one method) + `PermissionService.java:11` (the non-contextual interface method is NOT wired through this controller) + `profile.selectors.ts:17-20` (UI consumer of the other half) — severity: MEDIUM (architectural-comprehension gap)"

- "**No `@Slf4j`, no Logger, no log call** — the class has zero observability. A caller iterating resource ids to enumerate which entities they have elevated permissions on leaves no controller-tier trace. Combined with the absence of `SECURITY_RULES` gating, the privilege-enumeration surface is silent. — evidence: `PermissionController.java:1-27` — severity: MEDIUM"

- "**No request-shape validation** — the controller does no validation; the spec's `format: int64` for `resource_id` is the only check (it surfaces a deserialization 400). A negative or zero `resourceId` flows through unimpeded to the extractor — the extractor's `dataEntityService.getDimensions(resourceId).switchIfEmpty(...)` resolves the question naturally (no row → 404), but a future refactor that changes the extractor's nil-handling could surface 500. — evidence: `PermissionController.java:20-25` (no `@Validated`, no `@Positive`) + `DataEntityPermissionExtractor.java:64-66` — severity: LOW"

- "**The endpoint has no rate limit** — combined with the open-read posture (no `SecurityRule`) and the absence of logging, a malicious authenticated caller can enumerate resource ids without observable trace. Bounded discovery surface (only the caller's own permissions are revealed), but enumeration is unmetered. — evidence: `PermissionController.java:14-26` (no `@RateLimited` / no class-level filter) + `SecurityConstants.java:98-355` (no rule for the path) + `AuthorizationCustomizer.java:29-30` — severity: LOW"

- "**Status-code semantics: the controller returns 200 for a successful read** — but a `Flux<Permission>` of zero items is also 200 (the empty list is a valid response). Callers cannot distinguish 'this is a valid resource and you have no permissions' from any cascading empty case (e.g. the DISABLED-auth-empty-cascade documented in the controller-method sibling sidecar). The semantics are correct per REST conventions but combined with the DISABLED-mode contradiction, the operator-visible interpretation is ambiguous. — evidence: `PermissionController.java:20-25` + sibling sidecar `bugs_limitations_corner_cases[0]` — severity: LOW (informational; the controller-method sibling already documents the auth-mode interaction)"

- "**A new `hasContext=true` `PolicyTypeDto` value without a corresponding `ContextualPermissionExtractor` bean raises `IllegalArgumentException` at runtime** — `PermissionServiceImpl.java:47-48` throws `IllegalArgumentException(\"No extractor for resource type %s\")`. `IllegalArgumentException` has NO dedicated handler in `ControllerAdvice.java:23-66`; the catch-all `@ExceptionHandler(Exception.class)` at line 61 surfaces it as HTTP 500 with body `{message: 'Internal Server Error', code: 'SYS001'}` — losing the specific message. A maintainer adding a new resource type and forgetting the extractor sees 500 not 400; the diagnostic clue is in the log only. — evidence: `PermissionServiceImpl.java:42-49` + `ControllerAdvice.java:23-66` — severity: MEDIUM"

## stress_findings

```yaml
stress_findings:
  tunables: []  # no numeric literals, no @Value annotations, no constants, no magic strings in the class body. The only literal-shaped content is the path string declared on the generated PermissionApi interface — not in this file.
  name_behavior_pairs:
    - name: "getResourcePermissions"
      promise: "Return all permissions the current user has for the given resource (type + id)."
      implementation: "Delegates to PermissionService.getResourcePermissionsForCurrentUser, which dispatches by enum to a ContextualPermissionExtractor (DataEntity / Term / QueryExample), zips the resource context with the user's policies, evaluates statements, and flattens to a Flux<Permission>. The implementation HONORS the promise FOR contextual types; for MANAGEMENT (declared in the enum at components.yaml:3387 but with hasContext=false at PolicyTypeDto.java:12), the implementation rejects with HTTP 400."
      drift: MINOR  # the four-value enum at the spec layer includes MANAGEMENT but the service-tier discriminator rejects it; a strictly-spec-compliant caller would expect 200 with MANAGEMENT permissions
      operator_visible_consequence: "A client trying to call GET /api/resource/MANAGEMENT/{anyId}/permissions to query global management permissions receives HTTP 400 instead of the management-permission list. The actual MANAGEMENT permissions flow through a different mechanism (Identity payload via getGlobalPermissions selector). The spec is misleading; the runtime is correct per design."
      confidence: STATIC-INFERRED
      evidence: "PermissionController.java:19-25 + PermissionService.java:8 + PermissionServiceImpl.java:22-30 + PolicyTypeDto.java:8-12 + components.yaml:3381-3387"
    - name: "PermissionController (class name)"
      promise: "The controller that owns the Permission read surface."
      implementation: "Owns only the CONTEXTUAL half of the Permission read surface (one method, 3 of 4 PermissionResourceType values active). The non-contextual MANAGEMENT half is owned by IdentityServiceImpl (delivered via Identity.permissions to UI's getGlobalPermissions). A new maintainer searching for 'where is the permission read endpoint?' finds this file and gets an incomplete picture."
      drift: MINOR  # naming-vs-surface mismatch at class level
      operator_visible_consequence: "An operator reading the file expects a complete Permission HTTP surface; the actual non-contextual permission delivery happens through a different path. Time-to-comprehension cost on initial code-review; no runtime impact."
      confidence: STATIC-INFERRED
      evidence: "PermissionController.java:1-27 (one method) + PermissionService.java:11 (the other method exists but is NOT wired here) + profile.selectors.ts:17-20 (UI consumer reads from Identity payload, not from this controller)"
  orderings: []  # no SQL ORDER BY, no LIMIT, no .sort, no GROUP BY in this 27-line file. The downstream service / extractor chain HAS ordering concerns (per batch-S PolicyServiceImpl sidecar — `getCurrentUserPolicies` query), but no ordering trigger fires at the controller-class layer.
  auth_gates:
    - location: "PermissionController.java:19-22"
      endpoint: "GET /api/resource/{permission_resource_type}/{resource_id}/permissions"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: `DisabledAuthSecurityConfiguration.java:13-17` short-circuits the chain via `.anyExchange().permitAll()`; the `ReactiveSecurityContextHolder` is empty; downstream `AuthIdentityProviderImpl.getCurrentUser` returns empty; the policy-fetch chain cascades through `Mono.empty()` switchIfEmpty branches; the response is `Flux.empty()` → `200 OK` with body `[]`. LOGIN_FORM: the seeded admin user is wired with hard-coded ADMIN authority (`LoginFormSecurityConfiguration.java:74-82`); the Administrator role's policy carries `'ALL'` on DATA_ENTITY/TERM/QUERY_EXAMPLE/MANAGEMENT (`V0_0_56__add_predefined_roles_and_policies.sql`); the response is the FULL permission set for the resource type regardless of any policy revocation. OAUTH2/LDAP: live policy evaluation via the user-owner-mapping → roles → policies → statements chain at AbstractContextualPermissionExtractor.java:25-35; the response reflects whatever the policy graph resolves for the principal."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-17 + LoginFormSecurityConfiguration.java:74-82 + OAuthSecurityConfiguration.java:82-113 + AbstractContextualPermissionExtractor.java:25-35 + AuthIdentityProviderImpl.java:24-53"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: the request is admitted (no auth chain); response is empty-permission cascade (200 with `[]`). Under LOGIN_FORM/OAUTH2/LDAP: the catch-all `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30) rejects with HTTP 401 (or 302 redirect to login under LOGIN_FORM)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:13-17"
        - q: "What does a wrong-role caller see?"
          a: "There is no role-shaped gate on this endpoint — no `@PreAuthorize`, no `SecurityRule` for the path, no programmatic check. Any authenticated caller in OAUTH2/LDAP modes succeeds; the response reflects the caller's OWN resolved permissions. A 'wrong role' is not a concept here — the response is per-caller-bespoke. The operator-visible behaviour: an authenticated user with no policies receives 200 with `[]`."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:14-26 (no @PreAuthorize) + SecurityConstants.java:98-355 (no rule for path) + AuthorizationCustomizer.java:29-30"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Authentication: the catch-all `authenticated()` at AuthorizationCustomizer.java:29-30 (the Spring Security filter chain). Authorization (permission-shaped): NOWHERE — the endpoint is intentionally open per implicit_adrs[1] read-collaborative posture. The response is bounded only by what the caller's own policy graph resolves."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + SecurityConstants.java:98-355 (no rule) + PermissionController.java:14-26 (no annotation)"
  resource_boundaries:
    - location: "PermissionController.java:19-25"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No state is mutated at the controller layer. The controller is a pure delegate; downstream `PolicyServiceImpl.getCurrentUserPolicies` is a per-call read with no shared mutable state. Concurrent calls produce independent reads; no corruption possible at this layer. The downstream `Permission.fromValue(p.name())` call is on an immutable enum — thread-safe by construction."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:14-26 (no fields beyond the injected service) + PermissionServiceImpl.java:22-30 (no mutable state) + AbstractContextualPermissionExtractor.java:25-35 (functional pipeline) + Permission.java (OpenAPI-generated enum — immutable)"
        - q: "Is the call replay-safe?"
          a: "Yes — idempotent. Same caller + same resource_id → same response (subject to policy table state). No side effects (no DB writes, no log emits, no metric increments, no cache mutations) — calling the endpoint N times produces N identical 200 responses and 4N (DataEntity) DB read round-trips."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:20-25 (read-only delegate) + downstream chain has no UPDATE / INSERT / DELETE statements (per batch-S + batch-H sidecars)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. Every call re-fetches the user's policies (per-call JOOQ query at PolicyServiceImpl.java:103-107) and re-fetches the resource context (per-extractor DB queries — 4 for DataEntity). A role change committed to DB is observable on the very next call. The LOGIN_FORM admin-static caveat (per controller-method sibling sidecar `bugs_limitations_corner_cases[1]`) is a SEPARATE layer (the in-memory authority) and is not a cache."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:1-27 (no @Cacheable) + PermissionServiceImpl.java:1-50 (no caching) + AbstractContextualPermissionExtractor.java:1-41 (no caching) + PolicyServiceImpl.java:103-107 (per-call JOOQ query)"
  request_inputs:
    - location: "PermissionController.java:20-22"
      input_kind: path-param
      input_name: "resourceType"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'The TYPE of resource (data entity, term, query example, or management scope) whose permissions are being queried.' The name is descriptive: the path parameter values are the four enum values DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT, and the name accurately tells the caller what to pass."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:20 + components.yaml:3381-3387 + PermissionResourceType.java (generated)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller passes it to `permissionService.getResourcePermissionsForCurrentUser(resourceType, resourceId)` (PermissionController.java:23). Service converts to internal `PolicyTypeDto` via `PolicyTypeDto.valueOf(resourceType.name())` at PermissionServiceImpl.java:24 — relies on 1-1 name-match. Service then checks `policyTypeDto.isHasContext()` at line 25; THROWS for MANAGEMENT (line 26). Otherwise dispatches to the matching `ContextualPermissionExtractor` via `getExtractor(...)` at PermissionServiceImpl.java:28, 42-49. The extractor's `getResourceType()` filter matches by PolicyTypeDto identity (line 45)."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:23 + PermissionServiceImpl.java:22-30, 42-49 + DataEntityPermissionExtractor.java:44-47 + TermPermissionExtractor.java:36-39 + QueryExamplePermissionExtractor.java:56-59"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES for contextual types (DATA_ENTITY → DataEntityPermissionExtractor, TERM → TermPermissionExtractor, QUERY_EXAMPLE → QueryExamplePermissionExtractor). MATCHES is partial for MANAGEMENT: the parameter accepts MANAGEMENT (per spec enum), but the implementation REJECTS it with a clear error. This is a MINOR drift because the rejection is intentional + traceable + has a descriptive error message. Per Category F taxonomy: TRANSLATES_LEGITIMATELY for the contextual cases (1-1 mapping by enum name), MINOR drift for MANAGEMENT (acceptance at spec layer, rejection at runtime)."
          drift: NONE  # the 'rejection' shape is a documented invariant of the service-tier discriminator, not a name-vs-implementation drift
          confidence: STATIC-INFERRED
          evidence: "PermissionServiceImpl.java:24-27 (name-by-enum-mapping + hasContext discriminator) + PolicyTypeDto.java:8-14"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the drift is TRANSLATES_LEGITIMATELY for contextual types and a MINOR semantic gap (not silent) for MANAGEMENT. The MANAGEMENT case produces a CLEAR error response (HTTP 400 USR001 with body `\"Resource type MANAGEMENT does not have context\"`) — the caller is informed."
          confidence: STATIC-INFERRED
          evidence: "PermissionServiceImpl.java:25-27 + ControllerAdvice.java:24-28"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `PolicyTypeDto.hasContext` is the field that DOES match the input's semantic, and it IS used (PermissionServiceImpl.java:25). No closer-aligned data exists. No available-but-unused smell here."
          confidence: STATIC-INFERRED
          evidence: "PolicyTypeDto.java:8-14 + PermissionServiceImpl.java:24-30"
      routes_to_finding: "implicit_adrs[3] — the discriminator-at-enum design"
    - location: "PermissionController.java:20-22"
      input_kind: path-param
      input_name: "resourceId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'The id of the specific resource of the given type whose permissions are being queried.' For DATA_ENTITY, this is `data_entity.id`; for TERM, `term.id`; for QUERY_EXAMPLE, `query_example.id`. The name is generic but contextualised by the preceding `resourceType` path-parameter."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:21 + openapi.yaml:3688-3693 (typed int64 path parameter)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller passes it as a `Long` to `permissionService.getResourcePermissionsForCurrentUser(resourceType, resourceId)`. Service forwards to `getExtractor(...).getContextualResourcePermissions(resourceId)` at PermissionServiceImpl.java:28-29 (after the hasContext check). Each extractor uses it to fetch the resource's context: `DataEntityPermissionExtractor.getContext(resourceId)` → `dataEntityService.getDimensions(resourceId)` at DataEntityPermissionExtractor.java:65 (throws NotFoundException via switchIfEmpty if absent); `tagRepository.listDataEntityDtos(resourceId)` at line 67. `TermPermissionExtractor.getContext(resourceId)` → `termRepository.getTermDetailsDto(resourceId)` at TermPermissionExtractor.java:43-45 (throws NotFoundException via switchIfEmpty if absent). `QueryExamplePermissionExtractor.getContext(resourceId)` → `repository.getQueryExampleDatasetRelations(resourceId)` at QueryExamplePermissionExtractor.java:39 (no switchIfEmpty observed — possible existence-asymmetry: a missing QueryExample may emit empty rather than throw)."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:23 + PermissionServiceImpl.java:28-29 + DataEntityPermissionExtractor.java:50-69 + TermPermissionExtractor.java:42-51 + QueryExamplePermissionExtractor.java:37-48"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the id is used to fetch the resource's context for the specific type. Per Category F taxonomy: MATCHES. The implementation honors the promise of 'the resource whose permissions you want to know about'."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataEntityPermissionExtractor.java:65-67 + TermPermissionExtractor.java:43-45 + QueryExamplePermissionExtractor.java:39"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES. However, an EXISTENCE asymmetry exists across extractors: missing DataEntity → 404 (NotFoundException at DataEntityPermissionExtractor.java:64-66); missing Term → 404 (NotFoundException at TermPermissionExtractor.java:44-45); missing QueryExample → 200 with empty list (NO switchIfEmpty observed in the trace at QueryExamplePermissionExtractor.java:37-48 — the dtoMono may emit empty silently). The asymmetry is documented as an out-of-scope corner-case in the sibling controller-method sidecar's `bugs_limitations_corner_cases[4]`. The asymmetry is NOT a Category F drift — it is a per-extractor existence-handling inconsistency, separately surfaced."
          confidence: STATIC-INFERRED
          evidence: "DataEntityPermissionExtractor.java:64-66 + TermPermissionExtractor.java:44-45 + QueryExamplePermissionExtractor.java:37-48 (no switchIfEmpty observed in the static read)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `resource_id` corresponds 1-1 to the primary key of the resource table (`data_entity.id` / `term.id` / `query_example.id`) and IS used as the lookup key. No closer-aligned data exists."
          confidence: STATIC-INFERRED
          evidence: "PermissionController.java:21 + extractor get-by-id calls per evidence above"
      routes_to_finding: "bugs_limitations_corner_cases.[5] (the no-validation no-rate-limit anonymous-enumeration surface) + sibling controller-method sidecar bugs_limitations_corner_cases[4] (existence-asymmetry across extractors)"
  probes_emitted:
    - probe_id: P-125
      question: "Does GET /api/resource/MANAGEMENT/{anyId}/permissions ACTUALLY return HTTP 400 USR001 with the documented error message? (Static trace shows BadUserRequestException at PermissionServiceImpl.java:26; ControllerAdvice.java:24-28 maps to 400; but the empirical confirmation of this surface is pending.)"
      probe_path: "lineage/odd-platform/probes/P-125.yaml"
  stress_summary:
    triggers_total: 5  # 2 name_behavior_pairs + 1 auth_gate + 1 resource_boundary + 2 request_inputs (Category F)... but the auth_gate site counts as one and resource_boundaries as one cluster
    questions_total: 18  # 4 auth-gate Qs + 3 resource-boundary Qs + (5 Qs × 2 request_inputs = 10 Qs) + 1 name-behavior-pair Q (the "getResourcePermissions" pair has been compressed in this sidecar's output — see name_behavior_pairs above)
    answers_static_inferred: 17
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1  # the getResourcePermissions name-behavior pair carries MINOR drift (MANAGEMENT-accept-then-reject)
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — the controller has no `@ConditionalOnProperty`; it is present in every auth mode. The behaviour shifts dramatically by mode (per controller-method sibling sidecar `bugs_limitations_corner_cases[0,1]`): DISABLED → empty-permissions cascade; LOGIN_FORM → admin-all; OAUTH2/LDAP → live policy evaluation. Auth wiring is enforced globally by the `*SecurityConfiguration` beans (DisabledAuthSecurityConfiguration.java:10, LoginFormSecurityConfiguration, OAuthSecurityConfiguration.java:71, LDAPSecurityConfiguration).

- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; `GET /api/resource/...` does not match. The S2S filter (`S2sAuthenticationFilter`) under `auth.s2s.enabled` ALSO does not apply to this controller's path.

- **authorization_assertions**: []
  `PermissionController.java:14-26` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call. `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) contains no entry for `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` — the path falls through to `pathMatchers('/**').authenticated()` in `AuthorizationCustomizer.java:29-30`. Authentication required (in non-DISABLED modes); authorization-on-the-read intentionally NOT enforced (per `implicit_adrs[1]` — the read-collaborative posture).

- **owner_scoping**: `RESPECTS — context resolution includes the caller's associated owner`. The DataEntity extractor explicitly fetches `authIdentityProvider.fetchAssociatedOwner()` and includes it in `DataEntityPolicyResolverContext` (`DataEntityPermissionExtractor.java:51-55`). The Term extractor also includes owner (`TermPermissionExtractor.java:46-50`). The QueryExample extractor also includes owner (`QueryExamplePermissionExtractor.java:41-47`). A caller without an associated owner falls through to a null-owner context (`switchIfEmpty` branches in each extractor) — policies conditioned on ownership evaluate `false` for that caller, they still receive global grants (e.g. admin's `ALL`) but not owner-conditional grants.

- **data_exposure**:
  - "`List<Permission>` payload → the calling authenticated user under LOGIN_FORM/OAUTH2/LDAP — payload reveals only what the policy graph would grant the same caller on the same resource. No cross-user disclosure (no `{user_id}` slot in the URL)." — evidence: `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35`
  - "Empty payload (`[]`) → ANONYMOUS callers under `auth.type=DISABLED` — the empty-cascade described above. Misleading semantic: UI consuming this renders buttons disabled while the actual mutation API is unprotected in DISABLED mode." — evidence: `DisabledAuthSecurityConfiguration.java:13-17`
  - "Resource-existence signal: 404 when the requested DATA_ENTITY or TERM id does not exist — confirms/denies existence of the resource to the caller. Bounded by the caller's authenticated identity; no cross-user disclosure. Per Category F finding above: QueryExample may NOT emit 404 (empty Mono cascades to 200-empty instead) — surfaces a per-extractor inconsistency." — evidence: `DataEntityPermissionExtractor.java:64-66` + `TermPermissionExtractor.java:44-45` + `QueryExamplePermissionExtractor.java:37-48`

- **known_security_gaps**:
  - "Under DISABLED auth mode, the endpoint returns an empty permission set while the corresponding mutation endpoints are simultaneously `.permitAll()`. UI consumers render buttons disabled, but a direct API caller can perform every mutation. Silent contradiction; no log, no warning. — evidence: `DisabledAuthSecurityConfiguration.java:13-17` + empty-cascade traced — severity: HIGH (carried forward from controller-method sibling sidecar)"
  - "LOGIN_FORM returns ALL permissions for every caller because the static admin authority short-circuits the policy graph. Per-resource permission gating is not honoured in LOGIN_FORM; operators using LOGIN_FORM for staging may believe gating is enforced when it is not. — evidence: `LoginFormSecurityConfiguration.java:74-82` + `GrantedAuthorityExtractor.java:12-14` + `V0_0_56__add_predefined_roles_and_policies.sql` — severity: MEDIUM (carried forward)"
  - "No `SecurityRule` for the path — the endpoint is reachable by any authenticated caller for any resource type and any resource id. Intentional per `implicit_adrs[1]`, but operators auditing `SecurityConstants.SECURITY_RULES` for read-side gating will find no enforcement; the design intent is undocumented on the live docs. — evidence: `SecurityConstants.java:98-355` (no entry) + `AuthorizationCustomizer.java:29-30` + WebFetch 2026-05-25 — severity: LOW (intentional design; gap is in documentation)"
  - "No observability — the class has no `@Slf4j`, no Logger, no metric / counter. A caller iterating resource ids to enumerate which entities they have elevated permissions on leaves no controller-tier trace. Combined with the open-read posture, the privilege-enumeration surface is silent at the controller layer. — evidence: `PermissionController.java:1-27` — severity: MEDIUM"
  - "No rate-limit at the controller layer. — evidence: `PermissionController.java:14-26` (no `@RateLimited` / no filter) — severity: LOW (privilege enumeration is bounded to the caller's own permissions; not a privilege escalation)"

## performance

- **hot_paths**:
  - "Per-resource-page-render request on the ODD Platform UI — every data-entity, term, or query-example detail page renders buttons whose enabled state depends on this endpoint's response. The downstream chain for DataEntity executes 4 DB round-trips (policies + dimensions + tags + owner) per call. Confirmed via batch-S sidecar that `PolicyServiceImpl.getCurrentUserPolicies` is the per-call hot-path origin for the policy fetch." — evidence: `PermissionController.java:20-25` + `AbstractContextualPermissionExtractor.java:25-35` + `DataEntityPermissionExtractor.java:50-69` + `AuthIdentityProviderImpl.java:51-52` + `PolicyServiceImpl.java:103-107`
  - "The class is invoked on EVERY UI page-mount that renders the WithPermissionsProvider component — by Grep result, FIVE distinct UI surfaces (`DataEntityDetails.tsx:71-75`, `TermDetails.tsx:39-44`, `TermDetailsRoutes.tsx:21-25`, `Overview.tsx (Term):22-25`, `QueryExampleDetailsContainer.tsx:21-24`) plus an Alerts-resolve-affordance (`AlertItem.tsx:50-68`). Six distinct call sites; for routes that combine multiple surfaces in one page (e.g. TermDetails wraps Overview), each fetches independently — the per-page-render multiplicity per route is `>1`."
- **throughput_characteristics**:
  - "Per-resource call shape — `(resource_type, resource_id)`; NO batch variant. A UI rendering a list of N resources cannot ask 'permissions for these N resources in one call'; it issues N requests, each inducing the per-resource fan-out. List-view rendering with 50 entities = ~50 calls × 4 DB round-trips (DataEntity) = ~200 DB round-trips for permission checks alone. — evidence: `PermissionController.java:20-22` + `openapi.yaml:3681-3702`"
  - "Reactive non-blocking signature — `Mono<ResponseEntity<Flux<Permission>>>`; no thread held during DB await. The downstream `Mono.zip(contextMono, policiesMono)` zips two parallel monos. — evidence: `PermissionController.java:20` + `AbstractContextualPermissionExtractor.java:26-28`"
- **resource_allocation**:
  - "Per-request allocations bounded by `policy_count × statement_count × permission_count` for the caller's roles — admin's `ALL` expands to every Permission constant for the resource type (~25 for DATA_ENTITY, 7 for TERM, 7 for QUERY_EXAMPLE). Trivial heap cost. — evidence: `AbstractContextualPermissionExtractor.java:30-33`"
  - "Per-request DB connection cost — 4 jOOQ queries per call for DataEntity (policies + dimensions + tags + owner). — evidence: `DataEntityPermissionExtractor.java:50-69`"
- **scaling_characteristics**:
  - "Stateless controller — horizontal scaling unconstrained at this layer. — evidence: `PermissionController.java:14-26` (no instance state beyond the injected service)"
  - "No caching at any layer — every call re-runs the full policy + context fetch. Within a single UI page-render that calls this endpoint for multiple resources, the same user's policy list is re-fetched per call. — evidence: `PermissionController.java:20-25` + `PermissionServiceImpl.java:22-30` + `AbstractContextualPermissionExtractor.java:25-35` (no caching annotations)"
  - "Per-resource call shape forces UI N+1 for list views — see throughput_characteristics[0]. — evidence: `PermissionController.java:20-22`"
- **known_performance_gaps**:
  - "No batch variant — list-view rendering induces N × 4 = 4N DB round-trips for the DataEntity case. A `POST /api/resource/{type}/permissions` accepting `{resource_ids: [...]}` returning `Map<resourceId, List<Permission>>` would reduce the fan-out to one policies+roles fetch + a batched dimensions+tags+owner fetch. Structural perf gap. — evidence: `PermissionController.java:20-22` + `openapi.yaml:3681-3702` — severity: HIGH (list-view rendering on data-entity-heavy platforms)"
  - "No per-request caching of `getCurrentUserPolicies` — within a single page render the UI calls this endpoint for multiple resources, each re-fetching the same policy list. A request-scoped `Mono.cache()` keyed on user would eliminate the redundant policy fetch. — evidence: `PolicyServiceImpl.java:103-107` + `AbstractContextualPermissionExtractor.java:27` — severity: MEDIUM"
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log. Latency regressions on this hot path surface only at the WebFlux / DB metric layer. — evidence: `PermissionController.java:14-26` — severity: LOW"

## upstream_callers

- entry_point: "rest:GET /api/resource/{permission_resource_type}/{resource_id}/permissions"
  caller_node: "rest_api:openapi-generated PermissionApi.getResourcePermissions"
  multiplicity_per_trigger: 1
  evidence: "PermissionController.java:19-25 + openapi.yaml:3681-3702"
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/dataentities/{id}/overview (DataEntityDetails page)"
  caller_node: "ts react-component:DataEntityDetails.tsx (useEffect dispatch)"
  multiplicity_per_trigger: 1
  evidence: "DataEntityDetails.tsx:66-76 — useEffect dispatches fetchResourcePermissions with PermissionResourceType.DATA_ENTITY; dep-array is `[dataEntityId]` (line 76)"
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:/terms/{termId}/* (TermDetails routes wrapper)"
  caller_node: "ts react-component:TermDetails.tsx (useEffect dispatch)"
  multiplicity_per_trigger: 1
  evidence: "TermDetails.tsx:37-45 — useEffect dispatches fetchResourcePermissions with PermissionResourceType.TERM; dep-array is `[termId]` (line 45)"
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:/terms/{termId}/* (TermDetailsRoutes — useResourcePermissions hook)"
  caller_node: "ts react-component:TermDetailsRoutes.tsx (useQuery via useResourcePermissions)"
  multiplicity_per_trigger: 1
  evidence: "TermDetailsRoutes.tsx:21-25 — useResourcePermissions hook (useQuery); the same termId is concurrently fetched by both TermDetails.tsx useEffect and TermDetailsRoutes.tsx useQuery (different state-managers — Redux vs React Query) producing TWO calls to the endpoint per term-page render"
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:/terms/{termId}/overview (Term Overview)"
  caller_node: "ts react-component:Overview.tsx (useResourcePermissions hook)"
  multiplicity_per_trigger: 1
  evidence: "Overview.tsx:22-25 — useResourcePermissions for PermissionResourceType.TERM; another call in addition to TermDetails.tsx + TermDetailsRoutes.tsx. Note: useQuery's queryKey `['resourcePermissions', params]` (permissions.ts:9) caches across components within the same React Query client cache, so a SINGLE termId in one app session produces at most ONE network call across these THREE call sites — provided the queryKey matches. Multiplicity per ROUTE-mount is therefore 1 network call + 1-2 React Query cache reads, NOT 3 network calls."
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:/queryexamples/{exampleId} (QueryExampleDetailsContainer)"
  caller_node: "ts react-component:QueryExampleDetailsContainer.tsx (useResourcePermissions hook)"
  multiplicity_per_trigger: 1
  evidence: "QueryExampleDetailsContainer.tsx:21-24 — useResourcePermissions for PermissionResourceType.QUERY_EXAMPLE"
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_action:Alert resolve button click (AlertItem.handleResolve)"
  caller_node: "ts react-component:AlertItem.tsx (event handler dispatch)"
  multiplicity_per_trigger: 1
  evidence: "AlertItem.tsx:48-68 — handleResolve dispatches fetchResourcePermissions ON CLICK (not on mount); the affordance is a 'check permissions then attempt resolve' flow with a 1-call latency cost on every resolve attempt"
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: db-write
  description: "NONE at this controller. The endpoint is read-only — issues a chain of SELECT queries through downstream service / extractor / policy-repo chain but commits no writes."
  evidence: "PermissionController.java:20-25 (pure delegate) + PermissionServiceImpl.java:22-30 (no mutation) + AbstractContextualPermissionExtractor.java:25-35 (no mutation) + DataEntityPermissionExtractor.java:50-69 (read-only context fetch)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

- side_effect_class: page-render
  description: "Returns `List<Permission>` payload to the caller (serialized as JSON array of enum-string values). The payload drives WithPermissionsProvider's allowedPermissions intersection (PermissionProvider.tsx:19-32) which decides which UI buttons are enabled."
  evidence: "PermissionController.java:20-25 + PermissionProvider.tsx:19-32"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/resource/{permission_resource_type}/{resource_id}/permissions"
    - "ui_route:/dataentities/{id}/overview"
    - "ui_route:/terms/{termId}/* (TermDetails routes wrapper)"
    - "ui_route:/terms/{termId}/overview"
    - "ui_route:/queryexamples/{exampleId}"
    - "ui_action:Alert resolve button click"

- side_effect_class: db-read  # NOTE: db-read is not in the canonical side_effect_class taxonomy but is recorded as an audit-trail of the per-call cost; the canonical 'side effect' here is page-render — the DB-reads are the means
  description: "Issues N downstream DB SELECTs per call. For DATA_ENTITY: 4 (policies, dimensions, tags, owner). For TERM: 3 (policies, termDetails, owner). For QUERY_EXAMPLE: 3 (policies, queryExampleDatasetRelations, owner). For MANAGEMENT: 0 (rejected upstream at the discriminator)."
  evidence: "AbstractContextualPermissionExtractor.java:25-35 + DataEntityPermissionExtractor.java:50-69 + TermPermissionExtractor.java:42-51 + QueryExamplePermissionExtractor.java:37-48 + PolicyServiceImpl.java:103-107 + AuthIdentityProviderImpl.java:51-52"
  cardinality_per_call: "3-4 depending on resource_type"
  reachable_from_entry_points:
    - "rest:GET /api/resource/{permission_resource_type}/{resource_id}/permissions"
    - "ui_route:/dataentities/{id}/overview"
    - "ui_route:/terms/{termId}/* (TermDetails routes wrapper)"
    - "ui_route:/terms/{termId}/overview"
    - "ui_route:/queryexamples/{exampleId}"
    - "ui_action:Alert resolve button click"

- side_effect_class: header-set
  description: "200 OK Content-Type: application/json — set by Spring WebFlux via the OpenAPI-generated controller wiring (`ResponseEntity::ok` at line 24). No custom headers."
  evidence: "PermissionController.java:24 (ResponseEntity::ok) + PermissionApi (generated interface)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/resource/{permission_resource_type}/{resource_id}/permissions"
    - "(and all ui_route + ui_action entries above)"

## sources

- understanding ← PermissionController.java:1-27 (full file read) + PermissionApi (generated interface, line 4, 16) + PermissionService.java:7-12 + PermissionServiceImpl.java:1-50 + AbstractContextualPermissionExtractor.java:1-41 + DataEntityPermissionExtractor.java:1-71 + TermPermissionExtractor.java:1-58 + QueryExamplePermissionExtractor.java:1-60 + ManagementPermissionExtractor.java:1-42 + NoContextPermissionExtractor.java:1-9 + PolicyTypeDto.java:1-15 + ControllerAdvice.java:24-28 + SecurityConstants.java:95-355 + AuthorizationCustomizer.java:1-32 + DisabledAuthSecurityConfiguration.java:1-19 + OAuthSecurityConfiguration.java:71-113 + components.yaml:158-235, 3381-3387 + openapi.yaml:3681-3702 + WebFetch 2026-05-25 (live `/authorization` + `/authorization/permissions` pages)
- concepts.entities.PermissionApi ← PermissionController.java:4, 16 + openapi.yaml:3681-3702
- concepts.entities.PermissionService ← PermissionController.java:7, 17 + PermissionService.java:7-12
- concepts.entities.Permission ← PermissionController.java:5 + components.yaml:158-235 + AbstractContextualPermissionExtractor.java:33
- concepts.entities.PermissionResourceType ← PermissionController.java:6, 20 + components.yaml:3381-3387 + PolicyTypeDto.java:8-12
- concepts.entities.PolicyTypeDto ← PolicyTypeDto.java:8-12
- concepts.entities.ServerWebExchange ← PermissionController.java:10, 22
- concepts.operations.getResourcePermissions ← PermissionController.java:19-25 + openapi.yaml:3681-3702
- concepts.invariants[thin-delegate] ← PermissionController.java:23-24
- concepts.invariants[single-DI] ← PermissionController.java:15, 17
- concepts.invariants[no-auth-annotation] ← PermissionController.java:14-26 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30
- concepts.invariants[no-observability] ← PermissionController.java:1-27 (no @Slf4j, no Logger import)
- concepts.invariants[single-method-shape] ← PermissionController.java:1-27 + comparator scan of `lineage/odd-platform/understanding/*controller-class*` (smallest in package)
- concepts.invariants[file-naming-vs-surface] ← PermissionController.java:1-27 + PermissionService.java:11 + profile.selectors.ts:17-20
- concepts.invariants[MANAGEMENT-rejected] ← components.yaml:3387 + PermissionServiceImpl.java:25-27 + PolicyTypeDto.java:12 + ControllerAdvice.java:24-28
- concepts.audiences ← PermissionController.java:19-25 + DataEntityDetails.tsx:71-75 + TermDetails.tsx:39-44 + TermDetailsRoutes.tsx:21-25 + Overview.tsx (Term):22-25 + QueryExampleDetailsContainer.tsx:21-24 + AlertItem.tsx:50-68
- dependencies_semantic.requires-feature.PermissionApi ← PermissionController.java:4, 16 + openapi.yaml:3681-3702
- dependencies_semantic.requires-feature.PermissionService ← PermissionService.java:7-12
- dependencies_semantic.requires-feature.PermissionServiceImpl ← PermissionServiceImpl.java:22-30
- dependencies_semantic.requires-feature.ContextualPermissionExtractor ← DataEntityPermissionExtractor.java:23-25 + TermPermissionExtractor.java:19-20 + QueryExamplePermissionExtractor.java:18-21 + AbstractContextualPermissionExtractor.java:20
- dependencies_semantic.requires-feature.PolicyService ← PolicyServiceImpl.java:103-107 (per batch-S sidecar)
- dependencies_semantic.requires-feature.AuthIdentityProvider ← AuthIdentityProviderImpl.java:24-53 + DataEntityPermissionExtractor.java:51
- dependencies_semantic.requires-feature.ControllerAdvice ← ControllerAdvice.java:24-28
- dependencies_semantic.requires-runtime ← PermissionController.java:8-12, 14-15 + DisabledAuthSecurityConfiguration.java:1-19 + OAuthSecurityConfiguration.java:71-113
- dependencies_semantic.couples-to.PermissionApi ← PermissionController.java:16 (implements)
- dependencies_semantic.couples-to.PermissionService.getResourcePermissionsForCurrentUser ← PermissionController.java:23 + PermissionService.java:8-9
- dependencies_semantic.couples-to.PermissionServiceImpl ← PermissionServiceImpl.java:22-30
- dependencies_semantic.couples-to.AbstractContextualPermissionExtractor ← AbstractContextualPermissionExtractor.java:25-35
- dependencies_semantic.couples-to.PolicyService.getCurrentUserPolicies ← PolicyServiceImpl.java:103-107 (per batch-S)
- dependencies_semantic.couples-to.Permission-PolicyPermissionDto-mapping ← AbstractContextualPermissionExtractor.java:33 + PolicyPermissionExtractor.java:55-58, 64-66
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -name 'Permission*Test*'` (executed via Glob/Grep this session — zero matches)
- tests_coverage_semantic.uncovered_behaviours ← PermissionController.java:1-27 + PermissionServiceImpl.java:22-50 + DataEntityPermissionExtractor.java:50-71 + TermPermissionExtractor.java:42-58 + QueryExamplePermissionExtractor.java:37-60
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-25 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-25 status 200
- docs_link_semantic.doc_drift_findings[0,1,2,3,4] ← WebFetch responses 2026-05-25 + PermissionController.java:1-27 + PolicyTypeDto.java:8-12 + components.yaml:3381-3387 + PolicyPermissionDto.java:1-92 + PermissionServiceImpl.java:25-27 + profile.selectors.ts:17-20
- implicit_adrs[read-side-first-class] ← PermissionController.java:17, 20-25 + OAuthSecurityConfiguration.java:87-98 + AuthorizationCustomizer.java:16 + AbstractContextualPermissionExtractor.java:25-35
- implicit_adrs[read-collaborative] ← SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30
- implicit_adrs[single-method-class-deliberate] ← PermissionController.java:1-27 + PermissionService.java:7-12 + profile.selectors.ts:17-20
- implicit_adrs[discriminator-at-enum] ← PolicyTypeDto.java:8-14 + PermissionServiceImpl.java:24-30
- implicit_adrs[no-caching] ← PermissionController.java:1-27 + PermissionServiceImpl.java:1-50 + AbstractContextualPermissionExtractor.java:1-41 + PolicyServiceImpl.java:103-107
- bugs_limitations_corner_cases[no-tests] ← `find` result this session
- bugs_limitations_corner_cases[MANAGEMENT-spec-accept-runtime-reject] ← components.yaml:3387 + PermissionServiceImpl.java:25-27
- bugs_limitations_corner_cases[naming-vs-surface] ← PermissionController.java:1-27 + PermissionService.java:11
- bugs_limitations_corner_cases[no-observability] ← PermissionController.java:1-27
- bugs_limitations_corner_cases[no-validation] ← PermissionController.java:20-25 + DataEntityPermissionExtractor.java:64-66
- bugs_limitations_corner_cases[no-rate-limit] ← PermissionController.java:14-26 + SecurityConstants.java:98-355
- bugs_limitations_corner_cases[empty-list-200-vs-disabled-mode-contradiction] ← PermissionController.java:20-25 + sibling sidecar bugs_limitations_corner_cases[0]
- bugs_limitations_corner_cases[unhandled-IllegalArgumentException-on-missing-extractor] ← PermissionServiceImpl.java:42-49 + ControllerAdvice.java:23-66
- stress_findings.tunables ← PermissionController.java:1-27 (no triggers found)
- stress_findings.name_behavior_pairs[getResourcePermissions] ← PermissionController.java:19-25 + PermissionServiceImpl.java:22-30 + PolicyTypeDto.java:8-12 + components.yaml:3381-3387
- stress_findings.name_behavior_pairs[PermissionController-class] ← PermissionController.java:1-27 + PermissionService.java:11 + profile.selectors.ts:17-20
- stress_findings.orderings ← PermissionController.java:1-27 (no triggers — no SQL / no in-memory sort / no LIMIT)
- stress_findings.auth_gates ← PermissionController.java:19-25 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:13-17 + LoginFormSecurityConfiguration.java:74-82 + OAuthSecurityConfiguration.java:82-113
- stress_findings.resource_boundaries ← PermissionController.java:1-27 (no fields beyond DI) + PermissionServiceImpl.java:1-50 + AbstractContextualPermissionExtractor.java:25-35
- stress_findings.request_inputs.resourceType ← PermissionController.java:20 + PermissionServiceImpl.java:24-30 + PolicyTypeDto.java:8-14
- stress_findings.request_inputs.resourceId ← PermissionController.java:21 + DataEntityPermissionExtractor.java:50-69 + TermPermissionExtractor.java:42-51 + QueryExamplePermissionExtractor.java:37-48
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-125.yaml
- security.auth_mode_relevance ← PermissionController.java:1-27 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration
- security.ingestion_filter_relevance ← S2sAuthenticationFilter (OAuthSecurityConfiguration.java:108-110) + SecurityConstants.java:95-96 (WHITELIST_PATHS does not include this path) — `/api/resource/...` does not match `/ingestion/entities`
- security.authorization_assertions ← PermissionController.java:14-26 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30
- security.owner_scoping ← DataEntityPermissionExtractor.java:51-55 + TermPermissionExtractor.java:46-50 + QueryExamplePermissionExtractor.java:41-47
- security.data_exposure ← PermissionController.java:20-25 + DisabledAuthSecurityConfiguration.java:13-17 + DataEntityPermissionExtractor.java:64-66 + TermPermissionExtractor.java:44-45 + QueryExamplePermissionExtractor.java:37-48
- security.known_security_gaps ← carry-forward from sibling controller-method sidecar + this session's class-level additions (no-observability, no-rate-limit)
- performance.hot_paths ← PermissionController.java:20-25 + per-UI-component dispatch evidence + batch-S PolicyServiceImpl sidecar
- performance.throughput_characteristics ← PermissionController.java:20-22 + openapi.yaml:3681-3702 + AbstractContextualPermissionExtractor.java:26-28
- performance.resource_allocation ← AbstractContextualPermissionExtractor.java:30-33 + DataEntityPermissionExtractor.java:50-69
- performance.scaling_characteristics ← PermissionController.java:14-26 + PermissionServiceImpl.java:22-30 + AbstractContextualPermissionExtractor.java:25-35
- performance.known_performance_gaps ← PermissionController.java:20-22 + openapi.yaml:3681-3702 + PolicyServiceImpl.java:103-107 + AbstractContextualPermissionExtractor.java:27
- upstream_callers ← PermissionController.java:19-25 + DataEntityDetails.tsx:66-76 + TermDetails.tsx:37-45 + TermDetailsRoutes.tsx:19-25 + Overview.tsx (Term):16-26 + QueryExampleDetailsContainer.tsx:18-25 + AlertItem.tsx:48-69 + permissions.thunks.ts:1-29 + permissions.ts:1-13
- downstream_side_effects ← PermissionController.java:20-25 + PermissionServiceImpl.java:22-30 + AbstractContextualPermissionExtractor.java:25-35 + the four extractor implementations + PolicyServiceImpl.java:103-107 + PermissionProvider.tsx:19-32

## confidence_per_field

- understanding: HIGH (full 27-line file read; every claim traced to the controller + PermissionApi spec + service + each of the four extractors + each of the four auth-config classes + ControllerAdvice + UI consumer surfaces; the file-naming-vs-surface gap CONFIRMED by examining the SECOND `PermissionService` interface method `getNonContextualPermissionsForCurrentUser` and verifying it is NOT wired through this controller and IS consumed elsewhere via Identity)
- concepts: HIGH (every entity / operation / invariant / audience traced to source file or 1-hop neighbour)
- dependencies_semantic: HIGH (every coupling traced to file:line)
- tests_coverage_semantic: HIGH (zero tests confirmed by `find` over the repo this session; uncovered-behaviour list anchored at file:line)
- docs_link_semantic: HIGH (live `/authorization` and `/authorization/permissions` pages WebFetched 2026-05-25 status 200; both fetched_excerpts and drift findings are anchored at fresh fetched content rather than inherited; the drift findings are derived from comparing the live page's claim text vs the code's enum at PolicyTypeDto.java:8-12 + PolicyPermissionDto.java:1-92)
- implicit_adrs: HIGH (4 of 5 with strong intent-anchor evidence; 1 (single-method-class-deliberate) at MEDIUM confidence per the analysis above — the architectural intent is observable but not commented)
- bugs_limitations_corner_cases: HIGH (8 file-local concerns each anchored at file:line; the auth-mode-cascade concerns are inherited from the controller-method sibling at HIGH confidence; this class-level sidecar adds class-shape-specific concerns: file-naming, single-method-shape, no-observability)
- security: HIGH (auth-mode-relevance + ingestion-filter-relevance + authorization-assertions + owner-scoping verified across all four extractors + data-exposure across the three modes + 5 known security gaps)
- performance: HIGH (4-query fan-out + per-resource shape + absence-of-caching all directly visible; cross-confirmed via batch-S sidecar; UI call-site multiplicity verified across 6 UI consumer files)
- upstream_callers: HIGH (7 entry-points fully anchored at UI file:line and OpenAPI-generated REST surface; React Query queryKey-based cross-component caching analysis MEDIUM confidence — the queryKey shape is structurally visible at permissions.ts:9 but the empirical cache-hit ratio is not verified)
- downstream_side_effects: HIGH (4 side-effect classes each anchored at file:line)
- stress_findings: HIGH (5 triggers, 18 questions; 17 STATIC-INFERRED with strong evidence; 1 PROBE-NEEDED for the MANAGEMENT-rejection empirical confirmation, emitted as P-125; the load-bearing claims about the four auth modes are STATIC-INFERRED via full chain trace; the two Category F request-input analyses confirm MATCHES / no silent translation; the load-bearing name-vs-implementation findings carry MINOR drift (MANAGEMENT-accept-then-reject + naming-vs-surface) with operator-visible consequences clearly enumerated)

## Maintainer notes

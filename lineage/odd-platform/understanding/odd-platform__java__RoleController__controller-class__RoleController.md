---
node_id: "odd-platform java RoleController controller-class:RoleController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZD-RoleController-class
feature_hint: "P-09:F-001 (Role-Based Access Control) — the controller-tier consolidation for the Role half of the RBAC mutation surface (all FOUR ops — create / list / update / delete). Symmetric to the PolicyController half (batch-E + batch-ZD sibling). Pairs with batch-N ReactiveRoleRepositoryImpl + batch-S RoleServiceImpl + batch-Q RolesList UI. Controller-tier confirmation candidate for the 10-sidecar audit-silence pattern (F-006) — Role-half second tier."
related_features: [F-006]
related_pillar_features: ["P-09:F-001"]
---

# RoleController — semantic understanding

## understanding

The Role half of the RBAC mutation surface at the HTTP boundary — a 52-line
thin reactive delegate (`RoleController.java:14-51`) that implements the
OpenAPI-generated `RoleApi` interface and forwards FOUR operations
(`createRole` / `getRolesList` / `updateRole` / `deleteRole`, lines 19-50)
to `RoleService` (`RoleController.java:17` — DI field). The class is the
external surface for `POST /api/roles`, `GET /api/roles`,
`PUT /api/roles/{role_id}`, and `DELETE /api/roles/{role_id}` — three of
the four endpoints are gated by `SecurityConstants.SECURITY_RULES`
lines 169-173 (`ROLE_CREATE` / `ROLE_UPDATE` / `ROLE_DELETE`, all NO_CONTEXT,
MANAGEMENT-tier); the read endpoint `GET /api/roles` carries NO
SECURITY_RULES entry and falls through to the catch-all `.authenticated()`.
Every method has a `Mono<ResponseEntity<...>>` signature, runs on the
WebFlux reactive stack, and applies no controller-tier logic of its own —
every business invariant (predefined-name protection asymmetry across
create / update / delete, the @ReactiveTransactional wrap on all three
mutations, the cascade-delete defence against owner-attached roles, the
principal-aware list-fork) lives in `RoleServiceImpl` per batch S; every
SQL invariant (soft-delete inheritance, partial unique index on `role(name)
WHERE deleted_at IS NULL`, the LEFT-JOIN against POLICY without
`deleted_at` filter) lives in `ReactiveRoleRepositoryImpl` per batch N.
The controller emits ZERO log lines, has no `@Slf4j` annotation, and
performs no audit-trail write — the controller-tier confirmation for the
F-006 audit-silence pattern's Role half at the SECOND of three vertical
layers (controller / service / repository).

## concepts

- entities: [
    "Role (API response DTO — id, name, policies[] — referenced at RoleController.java:5)",
    "RoleFormData (request body — name + policies[] — line 6)",
    "RoleList (paged response — items + PageInfo — line 7)",
    "RoleApi (OpenAPI-generated interface — line 4 import + line 16 `implements` clause)",
    "ServerWebExchange (Spring WebFlux per-request context — line 11; unused by the controller body itself, accepted only because the generated `RoleApi` signature requires it)",
    "Mono<ResponseEntity<T>> (reactive return type for every method — lines 20, 28, 37, 46)",
    "RoleService (DI dependency — line 17; the service-layer facade owning every business invariant per batch S)",
    "implicit: SECURITY_RULES gate from SecurityConstants.SECURITY_RULES (NOT imported here — wired into the AuthorizationCustomizer chain by the four *SecurityConfiguration classes)",
    "implicit: ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE Permission enum values (NOT imported here — referenced only via SecurityConstants.java:169-173 entries; the controller is permission-name-AGNOSTIC at the source level)"
  ]
- operations: [
    "createRole(Mono<RoleFormData>, ServerWebExchange) — RoleController.java:19-25: `roleFormData.flatMap(roleService::create).map(ResponseEntity::ok)`. Returns `Mono<ResponseEntity<Role>>` with HTTP 200 (`.map(ResponseEntity::ok)` — line 24). The OpenAPI spec at `openapi.yaml:3629` declares `201` as the success response — code-vs-spec status-code drift. POST /api/roles is gated by ROLE_CREATE per SecurityConstants.java:169.",
    "getRolesList(Integer page, Integer size, String query, ServerWebExchange) — RoleController.java:27-34: `roleService.list(page, size, query).map(ResponseEntity::ok)`. Returns `Mono<ResponseEntity<RoleList>>` with HTTP 200. NO SECURITY_RULES entry — falls through to .authenticated() (any signed-in caller hits the endpoint; the service's principal-aware fork at RoleServiceImpl.java:40-47 controls visibility). NO @Min / @Max / @NotNull validation on page or size parameters — the controller accepts arbitrary Integer values and forwards them unchecked.",
    "updateRole(Long roleId, Mono<RoleFormData>, ServerWebExchange) — RoleController.java:36-43: `roleFormData.flatMap(formData -> roleService.update(roleId, formData)).map(ResponseEntity::ok)`. Returns `Mono<ResponseEntity<Role>>` with HTTP 200. OpenAPI spec at `openapi.yaml:3656` declares `201` — code-vs-spec status-code drift. PUT /api/roles/{role_id} is gated by ROLE_UPDATE per SecurityConstants.java:170-171. NO controller-tier check that `roleId` is positive; passed through to the service.",
    "deleteRole(Long roleId, ServerWebExchange) — RoleController.java:45-50: `roleService.delete(roleId).thenReturn(ResponseEntity.noContent().build())`. Returns `Mono<ResponseEntity<Void>>` with HTTP 204. OpenAPI spec at `openapi.yaml:3676` declares `204` — code-spec status-code CONSISTENT here (the lone consistent op of the four). DELETE /api/roles/{role_id} is gated by ROLE_DELETE per SecurityConstants.java:172-173. Service-layer raises CascadeDeleteException('Role is attached to a owner') if any owner_to_role row references the role — surfaces as HTTP 400 via the ControllerAdvice exception handler, NOT 204."
  ]
- invariants: [
    "**Thin-delegate posture**: every method body is exactly one expression — `mono.flatMap(serviceCall).map(ResponseEntity::ok)` or `serviceCall.thenReturn(noContent)`. No try/catch, no conditional branching, no parameter normalisation, no metric emission, no log line. The controller is purely a routing + serialisation surface for the OpenAPI contract; ALL business logic lives downstream. Consistent with sibling controllers — PolicyController, OwnerController, TagController, NamespaceController all share the same shape.",
    "**Status-code drift across THREE of FOUR endpoints**: the OpenAPI spec at openapi.yaml:3611 (GET /api/roles → 200 — consistent), 3629 (POST /api/roles → 201 — drift, code returns 200), 3656 (PUT /api/roles/{role_id} → 201 — drift, code returns 200), 3676 (DELETE /api/roles/{role_id} → 204 — consistent). Two of four mutation endpoints disagree with the spec. A generated client compiled from the OpenAPI spec treats POST returning 200 and PUT returning 200 as unexpected status — silently broken contract.",
    "**Authorization is wholly upstream**: no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, no role check in the controller body. The SECURITY_RULES table entries at SecurityConstants.java:169-173 are evaluated by the AuthorizationCustomizer that wraps the SecurityWebFilterChain in the LOGIN_FORM / OAUTH2 / LDAP configurations — under DISABLED mode the chain is NOT wired and the controller endpoints are reachable unauthenticated (per batch-E known_security_gaps[2] + DisabledAuthSecurityConfiguration sidecar).",
    "**ServerWebExchange parameter is purely a no-op acceptance**: every method accepts a `final ServerWebExchange exchange` parameter (lines 21, 31, 39, 47) BECAUSE the OpenAPI-generated `RoleApi` interface declares it; the controller body NEVER reads it. The generated interface signature is the contract; the controller cannot drop the parameter without breaking the override. The exchange is observable downstream by Spring Security / the WebFilter chain but not by this class.",
    "**Forensic silence at the controller tier**: no `@Slf4j` annotation, no Logger field, no `log.info / .warn / .error` call anywhere in the 52-line class (verified by reading RoleController.java:1-52 end-to-end — line 1 imports do NOT include `lombok.extern.slf4j.Slf4j` or any logger; no `private static final Logger LOG = LoggerFactory.getLogger(...)`). On any role create / update / delete the controller produces ZERO application log lines. Symmetric to RoleServiceImpl (batch S) + ReactiveRoleRepositoryImpl (batch N) — the F-006 audit-silence pattern is THREE-LAYER on the Role half.",
    "**The four endpoint shapes are NOT symmetric in HTTP-status semantics**: createRole → 200 (drift from 201); getRolesList → 200 (consistent); updateRole → 200 (drift from 201); deleteRole → 204 (consistent). An operator reading the controller AT FACE VALUE cannot tell which of the four codes match the spec without reading both files. Maintainer fix path: choose either (a) update the spec to declare 200 for create + update (matches the code, breaks future clients) OR (b) update the code to return 201 for create + update (matches the spec, breaks existing clients). No fix without coordination."
  ]
- audiences: [
    "Platform administrators interacting with the Management → Roles tab in the SPA (batch-Q RolesList UI is the React surface that dispatches all four operations via roleApi.* thunks)",
    "Direct API consumers — any S2S API-key holder (which gets ADMIN by default per S2sAuthenticationFilter.java:31-39 — REFACTOR-108 from batch E)",
    "OpenAPI-generated clients compiled from openapi.yaml — these expect 201 on POST/PUT and will treat the actual 200 as an error case",
    "Anyone with the ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE Permission (or globally implicit under auth.type=DISABLED)"
  ]

## dependencies_semantic

- requires-feature: [
    "F-006 P-09:F-001 Role-Based Access Control — the entire controller surface IS the HTTP boundary of the RBAC role-mutation feature; reads + writes to `role` + `role_to_policy` + `owner_to_role` through `RoleService` (per batch S RoleServiceImpl) which routes to `ReactiveRoleRepository` (per batch N ReactiveRoleRepositoryImpl).",
    "OpenAPI-generated RoleApi interface — RoleController implements it (RoleController.java:16). The routing / serialisation contract lives in `odd-platform-specification/openapi.yaml:3601-3679` + the components.yaml RoleFormData schema definition. Without the generated `RoleApi`, the class fails to compile; modifying the spec without regenerating produces compile-time failures of the @Override methods.",
    "Spring WebFlux reactive stack — `Mono<ResponseEntity<...>>` signature requires the platform to run in reactive mode (no servlet variant exists). Imports `org.springframework.http.ResponseEntity` (line 9), `org.springframework.web.bind.annotation.RestController` (line 10), `org.springframework.web.server.ServerWebExchange` (line 11), `reactor.core.publisher.Mono` (line 12).",
    "Lombok `@RequiredArgsConstructor` (line 3 + line 15) — generates the constructor for the `final RoleService roleService` (line 17). Without Lombok present at compile time, the class has no constructor and DI fails.",
    "SecurityConstants.SECURITY_RULES + AuthorizationCustomizer — NOT imported here but the four endpoints depend on the gate-wiring active at boot (LOGIN_FORM / OAUTH2 / LDAP configurations install the customizer; DISABLED skips it).",
    "RoleService interface — declared at field line 17. Implemented by RoleServiceImpl per batch S. The interface (not read this pass) declares the five public methods (list / create / update / delete / getCurrentUserRoles)."
  ]
- requires-config: [
    "No `@Value` reads, no env-driven configuration, no operator-tunable knobs in the controller. The controller is configuration-AGNOSTIC at the class level.",
    "Indirectly depends on `auth.type` — controls whether the SECURITY_RULES gates at SecurityConstants.java:169-173 fire (DisabledAuthSecurityConfiguration skips them; LoginForm / OAuth2 / LDAP wire them). Under DISABLED ALL FOUR endpoints are unauthenticated.",
    "Indirectly depends on `auth.s2s.enabled` + the S2sAuthenticationFilter wiring — under any non-DISABLED mode with S2S enabled, any X-API-Key caller is injected as ADMIN with ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE globally (REFACTOR-108)."
  ]
- requires-runtime: [
    "A PostgreSQL connection with `role` + `role_to_policy` + `owner_to_role` + `policy` tables migrated through at least V0_0_56 (per batch N).",
    "Spring Security context populated by the active *SecurityConfiguration — without it, the AuthorizationCustomizer's `permissionService.hasPermission(...)` call cannot resolve the caller's authorities and all four endpoints return 401/403 depending on mode.",
    "MapStruct-generated RoleMapper implementation (consumed by RoleServiceImpl, transitive from the controller).",
    "Reactor Core (Mono.flatMap, .map, .thenReturn) — controller's request-handling pipeline."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "POST /api/roles with valid RoleFormData returns 200 OK with the created Role payload — the controller delegates to RoleService.create and wraps in ResponseEntity::ok (RoleController.java:22-24). Pin the actual 200 status to expose the openapi.yaml:3629 spec-vs-code drift."
    test_class: integration
    criticality: HIGH
  - behaviour: "POST /api/roles returns 401/403 when caller lacks ROLE_CREATE under non-DISABLED auth modes (SECURITY_RULES at SecurityConstants.java:169). No WebFluxTest slice exercises this."
    test_class: security
    criticality: CRITICAL
  - behaviour: "POST /api/roles is reachable unauthenticated under auth.type=DISABLED — the canonical LSN-001-shape default-insecure failure. No test covers DISABLED-mode posture."
    test_class: security
    criticality: HIGH
  - behaviour: "POST /api/roles with X-API-Key (S2S) succeeds under any non-DISABLED mode — REFACTOR-108 — the S2S filter grants ADMIN globally."
    test_class: security
    criticality: HIGH
  - behaviour: "GET /api/roles requires only .authenticated() — no SECURITY_RULES entry. Any signed-in user sees the page (filtered to their attached roles via the server-side principal-aware fork at RoleServiceImpl.java:40-47). Pin the read-collaborative invariant."
    test_class: security
    criticality: HIGH
  - behaviour: "GET /api/roles ADMIN-vs-non-ADMIN response shape diverges: admin gets full paginated catalog; non-admin gets in-memory-filtered own-attached subset with hasNext=false regardless of page/size params (batch-S DRIFT-FACET-E mirror). Same response schema; different content."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/roles with negative page or size — controller forwards Integer values to the service without validation. What does the service / repository do with page=-1, size=-1? (No service-tier guard at RoleServiceImpl.java:40-47; no repository-tier guard at ReactiveRoleRepositoryImpl per batch N.) Pin the boundary behaviour."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "PUT /api/roles/{role_id} on the seeded Administrator role returns HTTP 400 BadUserRequestException('Administrator role is not editable') per RoleServiceImpl.java:68-69. Returns 200 in successful cases (drift from spec's 201)."
    test_class: integration
    criticality: HIGH
  - behaviour: "PUT /api/roles/{role_id} on the seeded User role with name unchanged succeeds; with name changed returns 400 BadUserRequestException('User role name cannot be changed') per RoleServiceImpl.java:104-106. The User-rename block fires ONLY on name divergence — partial-editability contract."
    test_class: integration
    criticality: HIGH
  - behaviour: "PUT /api/roles/{role_id} REWRITES the role_to_policy edges via delete-then-create at RoleServiceImpl.java:112-121 — pin the wholesale-replace semantics so a future diff-based refactor doesn't silently change the contract."
    test_class: integration
    criticality: HIGH
  - behaviour: "DELETE /api/roles/{role_id} on a role attached to any owner raises CascadeDeleteException('Role is attached to a owner') per RoleServiceImpl.java:85-88, surfaced as HTTP 400. The grammar error ('a owner' instead of 'an owner') is the literal exception message — pin so an alert maintainer's fix coordinates with downstream clients matching the string."
    test_class: integration
    criticality: HIGH
  - behaviour: "DELETE /api/roles/{role_id} on the seeded User or Administrator role raises BadUserRequestException('Role is predefined and cannot be deleted') per RoleServiceImpl.java:81-82 (case-INSENSITIVE check). Pin the case-insensitive guard."
    test_class: integration
    criticality: HIGH
  - behaviour: "DELETE /api/roles/{role_id} HARD-deletes all role_to_policy edges via RoleServiceImpl.java:89 BEFORE soft-deleting the role itself at line 90 — pin the auto-cleanup-of-outbound-edges contract; complement to the cascade-block-on-inbound-edges contract at 85-88."
    test_class: integration
    criticality: HIGH
  - behaviour: "DELETE /api/roles/{role_id} returns 204 — code is consistent with spec at openapi.yaml:3676. Pin the consistent op to detect future drift."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Concurrent DELETE /api/roles/{role_id} and POST /api/owners (with the role in payload) race window — batch-S DRIFT-FACET-D — the @ReactiveTransactional wrap does NOT acquire row-level locks on owner_to_role; cascade-check is non-atomic with the soft-delete. Pin the race."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "ServerWebExchange parameter is unused — the controller never reads it. Pin that the controller body does not change behaviour based on any header / cookie / session attribute (so a refactor to consume something from the exchange is detected)."
    test_class: unit
    criticality: LOW
- test_files: []
- gaps: |
    Zero test coverage of any path through RoleController — `find
    <odd-platform-repo>/odd-platform-api/src/test -name '*Role*.java'`
    returns ZERO matches (verified via Grep against `<odd-platform-repo>/odd-platform-api/src/test`).
    No WebFluxTest slice, no controller-level integration test, no @SpringBootTest
    that drives any of the four endpoints. The class is on the AUTHORIZATION HOT
    PATH for mutations (POST/PUT/DELETE require RBAC permissions that propagate
    to every authorized request via PolicyServiceImpl.getCurrentUserPolicies →
    RoleServiceImpl.getCurrentUserRoles per batch S).

    Highest-leverage missing tests:

    (a) Status-code drift detection — POST returns 200 not 201, PUT returns 200
        not 201, DELETE returns 204 (consistent), GET returns 200 (consistent).
        A test pinning each status flips a future spec-or-code reconciliation
        into a deliberate decision rather than a silent regression.

    (b) SECURITY_RULES gate coverage matrix — the four endpoints × four auth
        modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) × three caller-shape
        scenarios (no auth, wrong permission, correct permission) = 48 test
        cases. The current 0 coverage means none of the matrix is asserted.
        Under DISABLED (the bundled default — LSN-001-shape) all four endpoints
        are unauthenticated; this is the highest-priority security regression
        target.

    (c) S2S API-key matrix — under any non-DISABLED mode with auth.s2s.enabled,
        every X-API-Key request gets ADMIN globally (REFACTOR-108). All four
        endpoints succeed regardless of the holder's intended scope. No test
        covers this.

    (d) Cascade-delete defence — concurrent DELETE /api/roles/{id} + POST
        /api/owners with the role in payload (batch-S DRIFT-FACET-D race). The
        @ReactiveTransactional wrap does NOT acquire row locks on owner_to_role;
        the race leaves a soft-deleted role with surviving owner bindings.

    (e) Predefined-name asymmetry — the create path has NO name check
        (RoleServiceImpl.java:49-61); update and delete DO. A test creating
        a role named 'administrator' (lowercase — bypasses the case-sensitive
        unique-index defence on 'Administrator') would surface the gap.

    (f) Read-collaborative list-fork — GET /api/roles returns DIFFERENT row sets
        to different callers. A test with an ADMIN caller + a non-ADMIN caller
        + a no-roles caller would pin the three-way fork (full catalog / own
        roles / vacuous own-roles via the noneMatch-empty-stream invariant
        from batch S).

    A WebFluxTest slice with @MockBean RoleService is the minimal test surface
    (4 endpoints × 3-4 scenarios each ≈ 16 unit-level controller tests). An
    @SpringBootTest covering the full SECURITY_RULES + auth-mode matrix is the
    integration-level target. Neither exists today.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles"
    anchor: ""
    rationale: "Canonical operator-facing page for Roles in ODD's authorization model. Documents the concept (a Role 'serves to combine multiple policies together') and the two predefined roles (USER / ADMIN), plus an owner-roles section. The live page is silent on (a) every API endpoint shape of the four operations this controller exposes (no documentation for POST/GET/PUT/DELETE /api/roles[/{id}]), (b) the required ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE Permissions, (c) the OpenAPI status-code drift, (d) the cascade-delete contract ('Role is attached to a owner' 400 response), (e) the User-role partial-editability rule, (f) the read-collaborative list-fork behaviour. WebFetched live in this session 2026-05-25, status 200."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Parent authorization index page listing Roles + Policies + Permissions sub-topics. Carry-over from batch-E + batch-S sidecars; inherited verified state."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E + batch-S sidecar inheritance — direct re-fetch not performed this pass (within 13-day stale-probe cadence)."
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Security overview page documenting auth.type modes that determine whether SECURITY_RULES gates on these endpoints fire. Inherited from batch-E."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance"
    confidence: LOW
- fetched_excerpts: |
    Live WebFetch performed in this session (2026-05-25, status 200) against
    https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles:

    Definition: "A role serves to 'combine multiple policies together.' There
    are two role types in ODD Platform: user roles and owner roles."

    Predefined user roles:
    - USER: "regular user who doesn't have any permissions by default"
    - ADMIN: "administrator, who has all permissions"

    Owner roles: "can be managed in ODD Platform via Management - Roles section"
    (Specific examples include "Data Engineer".)

    Warning admonition (the sole admonition on the page): "Be careful and don't
    associate user with admin role with non-admin owner. You need to create
    owner with admin role first and then associate your admin user with this
    owner."

    Page sections: Roles (main heading) → User roles → Owner roles.

    The page provides NO content on (a) API endpoint shapes (no POST/GET/PUT/DELETE
    /api/roles documentation), (b) ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE
    Permission names, (c) status-code semantics, (d) cascade-delete behaviour
    on owner-attached roles, (e) the User-role partial-editability rule, (f)
    audit logging or activity tracking for role mutations, (g) the read-collaborative
    list-fork (admin sees all, non-admin sees own).

- doc_drift_findings:
  - "CONTROLLER-DOC-GAP-A (P-09:F-001 Role half — controller-tier confirmation): The Roles live page (WebFetched 2026-05-25, 200) documents none of the four HTTP operations this controller exposes. Operators authoring API automation against /api/roles[/{role_id}] must reverse-engineer the spec from openapi.yaml + the controller body — and even there the openapi.yaml status codes do NOT match the controller's actual returns for POST + PUT. The doc page has owner-roles management text 'managed via Management - Roles section' but no API surface. Symmetric to PolicyController batch-E + OwnerController batch-E missing-API-surface findings."
  - "CONTROLLER-DOC-GAP-B (P-09:F-001 Role half — status-code drift on three of four endpoints): The OpenAPI spec at openapi.yaml:3629, 3656 declares 201 for POST + PUT; the controller returns 200 via ResponseEntity::ok at lines 24 + 42. openapi.yaml:3676 declares 204 for DELETE — code matches. The live docs do not surface this. An operator generating a TypeScript client from openapi.yaml will treat 200 as an error case on POST + PUT — silent contract break. Carry-over from batch-E known-drift; PRIMARY-SOURCE at controller-class level here. Same drift affects the symmetric PolicyController half (verified at openapi.yaml POST/PUT /api/policies definitions per batch-E)."
  - "CONTROLLER-DOC-GAP-C (P-09:F-001 Role half — forensic silence at the controller tier, 7-sidecar pattern confirmation): RoleController.java:1-52 emits ZERO log lines on any of the four operations — no @Slf4j, no Logger field, no log call. Combined with: RoleServiceImpl.java:1-143 (batch S — service tier silent), ReactiveRoleRepositoryImpl.java:1-94 (batch N — repository tier silent), and the SYMMETRIC POLICY HALF (PolicyController + PolicyServiceImpl + ReactivePolicyRepositoryImpl ALL silent per batches E + I + H), the entire RBAC mutation stack is forensically dark across TWO vertical halves × THREE horizontal tiers = 6-sidecar stack-wide silence. This sidecar PROMOTES the pattern to SEVEN sidecars (was 6 after batches E+I+H+N+P+S; this controller-class sidecar reads RoleController.java:1-52 directly and confirms the silence at a SEPARATE artefact from the batch-E controller-method sidecar). The doc page makes no caveat about the absent audit trail; operators investigating a privileged role mutation cannot reconstruct who-did-what-when from application logs alone."
  - "CONTROLLER-DOC-GAP-D (P-09:F-001 Role half — list endpoint authorization model not documented): GET /api/roles has NO SECURITY_RULES entry. Any authenticated user reaches the endpoint; the response content is filtered by the server-side principal-aware fork at RoleServiceImpl.java:40-47 (admin gets full catalog; non-admin gets own attached roles ignoring page/size). The live docs do not document either (a) the list-everyone-but-content-varies-by-caller-role posture, or (b) the pagination asymmetry (non-admin always gets one in-memory page). An operator authoring a UI dashboard that paginates roles will be silently broken if the caller is non-admin."
  - "CONTROLLER-DOC-GAP-E (P-09:F-001 Role half — cascade-delete contract not documented): DELETE /api/roles/{role_id} returns HTTP 400 CascadeDeleteException('Role is attached to a owner') when any owner_to_role row references the role (RoleServiceImpl.java:85-88, surfaced via ControllerAdvice). The live docs make no admonition about this; operators writing cleanup automation that DELETEs roles attached to owners will hit unexpected 400s. The 'a owner' grammar quirk (intended 'an owner') is the literal exception body string — pin documented for downstream coordination."
  - "CONTROLLER-DOC-GAP-F (P-09:F-001 Role half — operator-visible behaviour of predefined-name asymmetry not documented): The PUT path rejects updates to a role named 'Administrator' but NOT to 'administrator' (case-sensitive RoleServiceImpl.java:68); the DELETE path rejects EITHER case (RoleServiceImpl.java:81-82 case-insensitive); the CREATE path has NO name check at all (RoleServiceImpl.java:49-61). An operator reading the live docs sees ADMIN/USER described as 'predefined' but receives no signal that (a) the predefined-name reservation is asymmetric across operations, (b) the unique-index defence on create is bypassable via case variants, or (c) the seeded rows are the load-bearing defence on the create path. Carry-over from batches E + S; controller-class confirmation."

## implicit_adrs

- "Thin-delegate controller posture — every endpoint method is exactly one expression delegating to the service. The pattern matches every sibling controller in the package (PolicyController, OwnerController, TagController, NamespaceController, DataSourceController etc.). The platform's deliberate decision: 'controllers are routing + serialisation shells for the OpenAPI contract; all business logic lives in the service tier'. No defending comment, but the convention is uniform across 30+ controllers in the codebase." — evidence: RoleController.java:19-50 (every method is one expression — flatMap + map OR then + thenReturn) + the parallel structure across sibling controllers — intent_anchor: the uniform `@Override public Mono<ResponseEntity<X>> opName(...) { return serviceCall(...).map(ResponseEntity::ok); }` shape repeated 30+ times across the controller package with NO deviation in this file — confidence: HIGH

- "All four RBAC role endpoints share the OpenAPI-generated `RoleApi` interface — the controller implements it (line 16). The contract is owned by the spec repo (openapi.yaml:3601-3679 + components.yaml RoleFormData schema), not by the controller. This is consistent with sibling generated *Api interfaces (DataEntityApi, PolicyApi, OwnerApi etc.). The platform's deliberate decision: 'the API contract is spec-first; the controller is the runtime adapter'. Spec-vs-code drift (the 201-vs-200 mismatch on POST and PUT) is a recurring failure mode of this pattern — the spec evolves separately from the code, and no CI guardrail catches the divergence." — evidence: RoleController.java:4 (`import org.opendatadiscovery.oddplatform.api.contract.api.RoleApi`) + line 16 (`implements RoleApi`) + openapi.yaml:3601-3679 — intent_anchor: the `implements RoleApi` clause + the spec-repo separation + the @Override annotations on every method asserting the generated interface contract — confidence: HIGH

- "Authorization is wholly upstream of the controller — no @PreAuthorize annotations, no programmatic permission checks. The platform's deliberate decision: 'authorization is wired at the SecurityWebFilterChain via the AuthorizationCustomizer + SECURITY_RULES table; controllers are authorization-AGNOSTIC at the source level'. The trade-off: authorization rules are externally configurable (the rules table can be edited without touching the controller) BUT the controller is silent about which permissions gate it — a maintainer reading this file cannot tell what permission is required without cross-referencing SecurityConstants.java:169-173." — evidence: RoleController.java:1-52 (no security annotation imports, no programmatic permission check) + SecurityConstants.java:169-173 (where the gating actually lives) — intent_anchor: the absence of @PreAuthorize is uniform across every controller in the package; the SECURITY_RULES table is the platform-wide single source for endpoint-to-permission mappings — confidence: HIGH

- "Status-code semantics for the four endpoints disagree with the OpenAPI spec on two of four (POST + PUT spec-says-201, code-returns-200). The platform's deliberate decision was NOT made explicitly — this is a STRUCTURAL OMISSION not a decision; no comment, no defending exception. The status mismatch is INHERITED across sibling controllers (PolicyController POST + PUT also return 200 against spec's 201 per batch E). The pattern is consistent enough across controllers that it functions as a de facto ADR ('we return 200 on every success, regardless of the spec'), but it is NOT defended in any source comment. Routes to bugs_limitations_corner_cases as drift; surfaced here only because the pattern is UNIFORM enough to be evidence-of-intent at the platform level." — evidence: RoleController.java:24 (`map(ResponseEntity::ok)`), 42 (same), 49 (`thenReturn(ResponseEntity.noContent().build())` — 204 — consistent), 33 (`map(ResponseEntity::ok)` — 200 — consistent for GET) + openapi.yaml:3611,3629,3656,3676 + sibling PolicyController pattern per batch E — intent_anchor: confidence:MEDIUM — the pattern is uniform across controllers (suggesting deliberate platform-wide convention) but NO comment defends it; route to BOTH implicit_adrs[de facto pattern] AND bugs_limitations_corner_cases[per-endpoint drift] — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**Status-code drift on POST /api/roles AND PUT /api/roles/{role_id} — code returns 200, OpenAPI spec declares 201.** Two of the four endpoints disagree with the spec. Generated TypeScript / Java / Python clients compiled from `openapi.yaml:3601-3679` expect 201 as the success branch for both mutation creates/updates; the actual 200 is parsed as an unexpected status (the client throws or returns the unhappy path). The DELETE endpoint at line 49 correctly returns 204 matching spec; the GET endpoint at line 33 correctly returns 200 matching spec. Carry-over from batch-E controller-method sidecar; PRIMARY-SOURCE confirmation at the controller-class level for ALL FOUR endpoints in one view." — evidence: RoleController.java:24 (POST returns 200), 33 (GET returns 200 — consistent), 42 (PUT returns 200), 49 (DELETE returns 204 — consistent) + openapi.yaml:3611 (GET 200 — consistent), 3629 (POST 201 — DRIFT), 3656 (PUT 201 — DRIFT), 3676 (DELETE 204 — consistent) — severity: MEDIUM

- "**GET /api/roles has NO SECURITY_RULES entry — any authenticated caller hits the endpoint.** Lines 27-34 (no @PreAuthorize, no service-tier auth check); the gating relies entirely on the SECURITY_RULES table (SecurityConstants.java:163-184 — entries for /api/roles POST, /api/roles/{role_id} PUT/DELETE are present at lines 169-173; NO entry for GET /api/roles). The endpoint falls through to the global `.authenticated()` rule. The non-admin server-side fork at RoleServiceImpl.java:40-47 is the ONLY content-level access control — and it's a SERVICE-LAYER convention, not a framework-level guarantee. A future refactor consolidating the list paths could silently widen visibility." — evidence: RoleController.java:27-34 + SecurityConstants.java:163-184 (POST/PUT/DELETE entries present; GET entry absent) + RoleServiceImpl.java:40-47 (the principal-aware fork) — severity: MEDIUM

- "**Controller-tier audit silence — no @Slf4j, no Logger, no log lines on ANY of the four operations.** Verified by reading RoleController.java:1-52 end-to-end: imports do not include any logger; no field declaration. A privileged caller invoking POST /api/roles with `{name: 'attacker-admin', policies: [<MANAGEMENT/ALL id>]}` produces ZERO controller-tier application log lines. Combined with the service-tier silence (batch S — RoleServiceImpl has no @Slf4j) and the repository-tier silence (batch N — ReactiveRoleRepositoryImpl has no @Slf4j), the Role half's mutation stack is forensically dark at all three vertical tiers. With the symmetric Policy half also silent at all three tiers (batches E + I + H), the F-006 audit-silence pattern reaches 7-sidecar confirmation with this sidecar." — evidence: RoleController.java:1-52 (no log imports, no Slf4j, no log calls) + cross-batches E + I + H + N + P + S — severity: HIGH

- "**ServerWebExchange parameter accepted but never read on every endpoint.** Lines 21, 31, 39, 47 — the `final ServerWebExchange exchange` parameter is the OpenAPI-generated `RoleApi` interface's signature requirement; the controller body never invokes any method on it. Mostly harmless, but the parameter is observable downstream (Spring Security and WebFlux filters consume it) — a future controller-side refactor that started reading exchange.getRequest().getHeaders() (e.g. for X-Request-ID logging) would change behaviour without an obvious source-level signal. No comment explains why the parameter is accepted but unread." — evidence: RoleController.java:21, 31, 39, 47 (parameter declared) + RoleController.java:22-24, 32-33, 40-42, 48-49 (body never reads the parameter) — severity: LOW

- "**No parameter validation at the controller tier on page / size / roleId / RoleFormData.** Lines 28-30 accept `Integer page`, `Integer size`, `String query` with no @Min, @Max, @NotNull, @NotBlank annotations; lines 37, 46 accept `Long roleId` with no @Positive constraint. The Mono<RoleFormData> on POST + PUT is the OpenAPI-generated DTO with `required: [name, policies]` (per components.yaml:3368-3379 referenced in batch E) but no minLength / maxLength / pattern on name and no maxItems on policies. A caller posting `{name: '', policies: []}` or `{name: <1MB string>, policies: [<10000 ids>]}` reaches the service tier unchecked." — evidence: RoleController.java:28-30, 37, 46 (no validation annotations) + components.yaml:3368-3379 (no constraints on RoleFormData fields per batch E) — severity: MEDIUM

- "**`@RequiredArgsConstructor` constructor injection is the ONLY composition mechanism; no fallback construction, no factory.** Line 15 + line 17. Removing the `@RequiredArgsConstructor` annotation (e.g. during a Lombok-removal migration) leaves the class with no constructor and DI fails at boot. The boot failure is loud (Spring throws NoSuchBeanDefinitionException) — not silent — but the implicit Lombok dependency is not documented in this file." — evidence: RoleController.java:3, 15, 17 — severity: LOW

- "**The OpenAPI-generated `RoleApi` interface tightly couples the controller to the spec repo's schema versioning.** Any change to `openapi.yaml:3601-3679` or `components.yaml RoleFormData` produces a regenerated `RoleApi` interface; if the new signature changes the controller's @Override annotations fail to compile. The coupling is intentional (spec-first) but the spec lives in a SEPARATE repo (`odd-platform-specification`); a spec change that goes in before a controller change breaks the build, and vice versa. No CI guardrail enforces synchronisation; this is a recurring failure mode of the spec-first pattern in the platform." — evidence: RoleController.java:4 (import from generated package), 16 (implements clause), 19-50 (every method @Override) + spec repo separation — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    # No numeric literals, no @Value reads, no constants in the 52-line class.
    # The closest tunable is the page/size pair on getRolesList — but these are
    # request parameters, not class-level tunables; their boundary behaviour is
    # covered by request_inputs (Category F) below.
    []
  name_behavior_pairs:
    - name: "RoleController.createRole (POST /api/roles)"
      promise: "Create a Role — a named bundle of Policy references"
      implementation: "Delegates Mono<RoleFormData> → roleService.create → ResponseEntity::ok. RoleService.create (RoleServiceImpl.java:51-61) maps to RolePojo, inserts into role table, then issues role_to_policy edges, then re-reads via getDto. NO controller-tier check of name; NO controller-tier rate-limit; NO controller-tier idempotency."
      drift: NONE
      operator_visible_consequence: "Matches the name's promise at the controller layer; downstream the create-side predefined-name asymmetry (batch S DRIFT-FACET-A) is the operator-relevant gap, but that's a service-tier finding, not a controller-name-vs-behaviour gap."
      confidence: STATIC-INFERRED
      evidence: "RoleController.java:19-25 + RoleServiceImpl.java:51-61 (batch S)"
    - name: "RoleController.getRolesList (GET /api/roles)"
      promise: "List the roles — implied: ALL of them, paginated by page/size, optionally filtered by query"
      implementation: "Delegates `roleService.list(page, size, query)` to the service. RoleServiceImpl.list (lines 40-47) RUNS A PRINCIPAL-AWARE FORK: ADMIN callers get the full paginated `roleRepository.listDto(page, size, query)`; non-ADMIN callers get the in-memory `filterUserRoles(currentUserRoles, query)` ignoring page/size, hasNext=false."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A non-ADMIN caller hitting `GET /api/roles?page=2&size=20` receives their own attached roles (typically 1-3 items) — NOT page 2 of the catalog. The endpoint name 'list of roles' silently means 'list of roles you can see' but the pagination contract is broken: same parameters, different behaviour by caller role. Operator authoring a UI paginator gets correct behaviour for ADMINs and silently broken behaviour for non-ADMINs. Same shape as the symmetric PolicyController.getPolicyList finding from batch E + batch I."
      confidence: STATIC-INFERRED
      evidence: "RoleController.java:27-34 + RoleServiceImpl.java:40-47, 136-142 (batch S DRIFT-FACET-E)"
    - name: "RoleController.updateRole (PUT /api/roles/{role_id})"
      promise: "Update an existing Role — implied: replace the role's name + policy bindings with the request body's values"
      implementation: "Delegates roleService.update(roleId, formData) → ResponseEntity::ok. RoleServiceImpl.update (lines 65-74) RUNS UNDER @ReactiveTransactional, fetches the role, rejects on Administrator (case-sensitive line 68) OR User-name-divergence (case-sensitive line 104-106), THEN REWRITES the role_to_policy edges via delete-then-create (lines 112-121 — wholesale replacement, NOT a diff merge)."
      drift: MINOR
      operator_visible_consequence: "An operator PUTting `{name: 'X', policies: [3, 5, 7]}` on a role currently bound to policies [1, 3, 5] gets a role bound to EXACTLY [3, 5, 7] — policy 1 is hard-deleted from role_to_policy; policies 7 are inserted. The 'update' name does not promise wholesale replacement; some operators expect a merge / additive update. The contract is delete-then-create on the edge set. PRIMARY-SOURCE at batch S implicit_adrs[edge rewrite asymmetry]."
      confidence: STATIC-INFERRED
      evidence: "RoleController.java:36-43 + RoleServiceImpl.java:65-74, 112-121"
    - name: "RoleController.deleteRole (DELETE /api/roles/{role_id})"
      promise: "Delete an existing Role — implied: remove it from the platform"
      implementation: "Delegates roleService.delete(roleId) → thenReturn(noContent). RoleServiceImpl.delete (lines 78-92) raises CascadeDeleteException('Role is attached to a owner') if ANY owner_to_role row references the role (lines 85-88), THEN HARD-deletes ALL role_to_policy edges (line 89), THEN SOFT-deletes the role row (line 90 — UPDATE deleted_at = NOW(), NOT a DELETE FROM, per batch N inheritance from ReactiveAbstractSoftDeleteCRUDRepository)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "TWO drift facets: (a) the delete is a SOFT-delete — the role row persists with deleted_at populated; subsequent recreation via POST /api/roles with the SAME name is blocked by the partial unique index ON (name) WHERE deleted_at IS NULL — so the row is gone from the operator surface BUT the name is freed because the index excludes soft-deleted rows. An operator who 'deletes' the role then immediately tries to recreate it succeeds — different id, same name. (b) The delete FAILS with HTTP 400 if any owner_to_role row references the role; the operator must detach via the OWNER side (OwnerServiceImpl.delete or PUT /api/owners). The name 'delete' implies idempotent removal; the actual contract is 'soft-delete-with-cascade-block-on-inbound-edges'."
      confidence: STATIC-INFERRED
      evidence: "RoleController.java:45-50 + RoleServiceImpl.java:78-92 + V0_0_55__add_policies_and_roles.sql:42 (partial unique index) + ReactiveAbstractSoftDeleteCRUDRepository (batch N inheritance)"
  orderings:
    - location: "RoleController.java:27-34"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer of GET /api/roles?"
          a: "Trace: controller → roleService.list (RoleServiceImpl.java:40-47) → branch by user role. ADMIN path: roleRepository.listDto(page, size, query) → CTE-paginated JOIN at ReactiveRoleRepositoryImpl.java:55-72 per batch N. Reading the JOOQ chain at batch-N #understanding — the listDto query has NO explicit ORDER BY in the OUTER select. The CTE filters by softDelete + nameQuery; the OUTER join against ROLE_TO_POLICY/POLICY aggregates; the OFFSET/LIMIT is applied without an ORDER BY. Non-ADMIN path: filterUserRoles (RoleServiceImpl.java:136-142) — `userRoles.stream()...filter().toList()` — preserves the input order from getUserRolesByOwner (ReactiveUserOwnerMappingRepositoryImpl.java:99-114) which has NO ORDER BY either."
          confidence: PROBE-NEEDED
          evidence: "P-127 (this sidecar emits the probe). Hypothesis: natural row order; on a cold table this is creation order, but after edits Postgres can return rows in any order without ORDER BY. The 'Top of the list' is undefined and operator-visible."
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "No sort key, no tie-breaker. Postgres can return rows in storage / heap order — non-deterministic across queries."
          confidence: PROBE-NEEDED
          evidence: "P-127"
        - q: "Which subset is returned when result-set > page size?"
          a: "ADMIN path: arbitrary 'page' rows of unspecified ordering. Non-ADMIN path: ALL of the caller's attached roles (page+size IGNORED, hasNext=false). The contract diverges by caller role."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:40-47, 136-142 (batch S)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "UI (batch Q RolesList) does not re-sort; it appends each page via Redux entity-adapter setMany — preserves API order. So the API's natural / undefined order IS the operator-visible order."
          confidence: STATIC-INFERRED
          evidence: "batch Q RolesList invariants (Redux entity-adapter setMany on page>1)"
  auth_gates:
    - location: "RoleController.java:19-25"
      endpoint: "POST /api/roles → createRole"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: SECURITY_RULES gate is INERT (DisabledAuthSecurityConfiguration does not wire the AuthorizationCustomizer) — endpoint reachable to ANY HTTP caller, anonymous-admin synthesised. LOGIN_FORM / OAUTH2 / LDAP: gate fires — caller must hold ROLE_CREATE (NO_CONTEXT) per SecurityConstants.java:169."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:169 + DisabledAuthSecurityConfiguration (batch-E sidecar) + AuthorizationCustomizer wiring in LoginForm/OAuth2/LDAP configs"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: caller hits the endpoint as the synthesised anonymous-admin → succeeds (THE LSN-001-shape failure). Under non-DISABLED: caller is rejected at the WebFilter chain BEFORE reaching the controller — typically 302 redirect to /login (LOGIN_FORM) or 401 (OAUTH2/LDAP S2S). NEVER reaches the controller body."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:19-25 + SECURITY_RULES gate wiring per batch E"
        - q: "What does a wrong-role caller see?"
          a: "Under non-DISABLED with a caller lacking ROLE_CREATE: 403 Forbidden from the AuthorizationCustomizer (does not reach the controller body). Under S2S with auth.s2s.enabled: X-API-Key holder is injected as ADMIN globally (S2sAuthenticationFilter.java:31-39) — any S2S caller has ROLE_CREATE and reaches the controller (REFACTOR-108)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:169 + S2sAuthenticationFilter.java:31-39 (batch E)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "AuthorizationCustomizer (Spring Security WebFilter chain wrapping the SecurityWebFilterChain) — UPSTREAM of the controller. The controller has NO @PreAuthorize, NO programmatic permission check. The service has business-invariant guards on predefined names but no authorization. The repository has no guards at all."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:169 + AuthorizationCustomizer (batch-E) + RoleController.java:1-52 + RoleServiceImpl.java:1-143 (batch S) + ReactiveRoleRepositoryImpl.java:1-94 (batch N)"
    - location: "RoleController.java:27-34"
      endpoint: "GET /api/roles → getRolesList"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymous-admin → admin branch (full paginated catalog). LOGIN_FORM/OAUTH2/LDAP: any authenticated caller passes the catch-all .authenticated() rule; content varies by caller's effective UserProviderRole (ADMIN → full catalog; non-ADMIN → own attached roles)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java (no entry for GET /api/roles — falls through to authenticated()) + RoleServiceImpl.java:40-47 (principal-aware fork)"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: synthesised anonymous-admin reaches the admin branch. Under non-DISABLED: rejected at the WebFilter chain (302 redirect or 401)."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:27-34 + auth-mode wiring per batch E"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated caller reaches the endpoint regardless of role; the content fork at RoleServiceImpl.java:40-47 controls what they see (ADMIN sees all; non-ADMIN sees own; user with NO roles sees empty)."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:40-47, 136-142 (batch S)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere — at the framework level. The controller has no gate, the service has a CONTENT FORK (principal-aware filter, NOT a permission gate), the repository has no gate. The only access control is 'must be authenticated' from the SecurityWebFilterChain's catch-all."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java (no GET /api/roles entry) + RoleController.java:27-34 (no gate) + RoleServiceImpl.java:40-47 (content fork, not gate)"
    - location: "RoleController.java:36-43"
      endpoint: "PUT /api/roles/{role_id} → updateRole"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymous-admin → reaches the controller → service rejects on predefined-name (Administrator block) or proceeds with the update. Non-DISABLED: caller must hold ROLE_UPDATE per SecurityConstants.java:170-171; same downstream behaviour."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:170-171 + RoleServiceImpl.java:65-74"
        - q: "What does an unauthenticated caller see?"
          a: "DISABLED: synthesised anonymous-admin → endpoint reachable. Non-DISABLED: 302 / 401 from the WebFilter."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration (batch E) + auth-mode wiring"
        - q: "What does a wrong-role caller see?"
          a: "Non-DISABLED + no ROLE_UPDATE: 403. With S2S enabled: X-API-Key bypasses (ADMIN globally — REFACTOR-108)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:170-171 + S2sAuthenticationFilter.java:31-39"
        - q: "Where does the gate live?"
          a: "AuthorizationCustomizer upstream (ROLE_UPDATE check). The service tier ALSO enforces the predefined-name block (RoleServiceImpl.java:68 Administrator + 104-106 User-rename) — these are BUSINESS INVARIANTS, not authorization gates, but they shape the operator-observable behaviour."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:170-171 + RoleServiceImpl.java:68, 104-106 (batch S)"
    - location: "RoleController.java:45-50"
      endpoint: "DELETE /api/roles/{role_id} → deleteRole"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymous-admin → reaches the controller → service rejects on predefined-name (User OR Administrator case-insensitive) OR on cascade (owner-attached). Non-DISABLED: caller must hold ROLE_DELETE per SecurityConstants.java:172-173."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:172-173 + RoleServiceImpl.java:78-92"
        - q: "What does an unauthenticated caller see?"
          a: "DISABLED: synthesised anonymous-admin. Non-DISABLED: 302 / 401 from the WebFilter."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration (batch E) + auth-mode wiring"
        - q: "What does a wrong-role caller see?"
          a: "Non-DISABLED + no ROLE_DELETE: 403. With S2S enabled: ADMIN globally bypasses (REFACTOR-108)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:172-173 + S2sAuthenticationFilter.java:31-39"
        - q: "Where does the gate live?"
          a: "AuthorizationCustomizer upstream (ROLE_DELETE) + service-tier predefined-name + cascade-attached defences (RoleServiceImpl.java:81-82, 85-88). The cascade defence on owner-attachment is the SOLE protection against orphan owner_to_role rows referencing a soft-deleted role."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:172-173 + RoleServiceImpl.java:81-92 (batch S)"
  resource_boundaries:
    - location: "RoleController.java:19-50 — all four endpoints"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Controller is stateless — no in-class state, no instance-level lock. Concurrency safety lives in the service tier: RoleServiceImpl.java:50, 64, 77 wrap create/update/delete in @ReactiveTransactional (batch S invariants). Concurrent POST /api/roles with the SAME name serialise at the DB partial unique index (one wins; the other raises UniqueConstraintException → 400). Concurrent PUT or DELETE on the SAME role_id race against each other (last-write-wins on RolePojo — no version column; per batch S DRIFT-FACET-D the cascade-check is non-atomic with the soft-delete)."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:1-52 (no state) + RoleServiceImpl.java:50, 64, 77 (transactional wraps) + V0_0_55__add_policies_and_roles.sql:42 (unique index)"
        - q: "Is the call replay-safe?"
          a: "POST /api/roles: NOT replay-safe — second identical POST with the same name raises 400 (unique-index collision); the original commit's id is lost. PUT: replay-safe in outcome (wholesale rewrite — replay produces the same final state). DELETE: replay-safe in outcome (second DELETE returns 400 'Role is attached to a owner' OR 404 NotFoundException — the role is already soft-deleted). GET: read-only, idempotent."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:51-61 (create), 65-74 (update — wholesale rewrite), 78-92 (delete — soft-delete) + V0_0_55__add_policies_and_roles.sql:42"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache on this controller. NO cache on RoleService (batch S DRIFT-FACET-I — getCurrentUserRoles is the authorization hot path with no caching). NO cache on the repository (batch N — direct R2DBC). Every request hits Postgres."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:1-52 (no @Cacheable) + RoleServiceImpl.java:1-143 (no caching, batch S) + ReactiveRoleRepositoryImpl.java:1-94 (no caching, batch N)"
  request_inputs:
    - location: "RoleController.java:20-21 — createRole"
      input_kind: body-field
      input_name: "roleFormData (Mono<RoleFormData>) — body fields: name (string, required), policies (List<Policy>, required)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`roleFormData.name`: the new role's display name. `roleFormData.policies`: the list of Policy objects (id + statement) the new role binds to. Implied: 'this name + these policies → a new Role with these properties'."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:6 (import RoleFormData) + RoleController.java:20 (parameter) + components.yaml:3368-3379 (schema definition per batch E)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced: RoleController.java:22-24 → `roleService::create` (RoleServiceImpl.java:51-61). Service: maps `formData.name` to RolePojo.name via roleMapper.mapToPojo (line 54); extracts policy ids from `formData.policies` via getPolicyIdsList (lines 52, 128-134); inserts the role row at line 55; inserts role_to_policy edges at line 57 via roleToPolicyRepository.createRelations. The `policies` field is used as a list of POLICY IDS (the full Policy DTO's other fields — name, statement — are IGNORED at the service tier; only `policy.getId()` is consulted per line 132)."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:22-24 + RoleServiceImpl.java:51-61, 128-134"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "`name`: MATCHES — the input name is stored directly as the role row's name. `policies`: TRANSLATES_LEGITIMATELY — the input is `List<Policy>` (full DTO objects per the OpenAPI schema), but only the `id` field of each Policy is consulted; the rest of the Policy fields are ignored. The translation is mechanical (DTO → id list) and consistent with the platform's other relation-rewrite endpoints; not a hidden semantic gap."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:128-134"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — TRANSLATES_LEGITIMATELY (the policies-as-DTOs-but-only-ids-are-read translation is mechanical)."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:128-134"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — every name field is consumed; every policy id is consumed. (The non-id fields of Policy DTOs are ignored, but that is the OpenAPI request-body schema artefact — the SAME schema is used for both create and read, and create only needs ids.)"
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:51-61, 128-134"
      routes_to_finding: "implicit_adrs[OpenAPI-RoleApi-coupling] — the DTO over-shape is a spec-first convention, not a defect"
    - location: "RoleController.java:28-30 — getRolesList"
      input_kind: query-param
      input_name: "page (Integer), size (Integer), query (String)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`page`: the 1-indexed page number of the result. `size`: the page size. `query`: a search-string filter that narrows the result set to roles whose name matches."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:28-30 + the openapi.yaml:3606-3609 SearchParam/PageParam/SizeParam references"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced: RoleController.java:32 → `roleService.list(page, size, query)` → RoleServiceImpl.java:40-47. The service BRANCHES BY USER ROLE before consuming the parameters: ADMIN path → roleRepository.listDto(page, size, query) (lines 44 fallthrough → 45) — page+size+query all consumed in the SQL via the CTE-paginated query at ReactiveRoleRepositoryImpl per batch N. Non-ADMIN path → filterUserRoles(currentUserRoles, query) (lines 44, 136-142) — `query` is consumed for an in-memory case-insensitive filter on the caller's already-resolved RoleDtos, but `page` and `size` are IGNORED entirely; the returned Page has hasNext=false regardless."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:32 + RoleServiceImpl.java:40-47, 136-142 (batch S)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "`page` + `size`: TRANSLATES_SILENTLY for non-ADMIN callers — the parameter NAME promises pagination cursor behaviour; the implementation IGNORES the values entirely on the non-admin branch. For ADMIN callers: MATCHES. `query`: MATCHES across both branches — consumed for a case-insensitive name filter."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:40-47, 136-142"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Non-ADMIN caller hitting `GET /api/roles?page=2&size=20` receives their OWN attached roles (typically 1-3 items) — NOT page 2 of the catalog. The response's `hasNext` is false regardless. An operator authoring a UI paginator gets correct behaviour for ADMINs (page+size honoured) and silently broken behaviour for non-ADMINs (own roles always returned; page+size ignored). Same shape as batch-S DRIFT-FACET-E + the symmetric PolicyController.getPolicyList finding from batch E + batch I. Operator-visible: a non-ADMIN with 50 effective roles attached to one owner gets all 50 in one response, ignoring `size`."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:136-142 (`new Page<>(filteredRoles, filteredRoles.size(), false)` — page/size never consulted)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "On the non-admin branch: the `page` and `size` parameters are RECEIVED but NEVER consulted — filterUserRoles never references them. They are the available-but-unused signals matching the input's name perfectly."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:136-142 (filterUserRoles signature accepts only userRoles + query; page+size never threaded through)"
      routes_to_finding: "bugs_limitations_corner_cases (status-code drift is already captured separately; pagination-input-vs-implementation drift surfaces here AND in stress_findings.name_behavior_pairs[getRolesList])"
    - location: "RoleController.java:37 — updateRole"
      input_kind: path-param
      input_name: "roleId (Long)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the role to update. Implied: 'this id selects the role row whose name+policies will be replaced by the body's values'."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:37 + openapi.yaml:3637-3661"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced: RoleController.java:41 → `roleService.update(roleId, formData)` → RoleServiceImpl.java:65-74. The service calls `roleRepository.get(id)` at line 66 (returns the live role row WHERE deleted_at IS NULL per batch N), then routes through name-check guards, then rewrites the role's policy bindings via roleToPolicyRepository.deleteRoleRelationsExcept + createRelations. The id is consulted at THREE places: get(id) line 66, then in updateRolePolicyRelations as `role.getId()` at line 116, 119."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:41 + RoleServiceImpl.java:65-74, 112-121"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the id selects the role row; the role's policy bindings are rewritten. The wholesale-replace contract (delete-then-create on the edge set) is a behaviour-not-implied-by-the-name issue covered separately in name_behavior_pairs[updateRole]."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:65-74"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:65-74"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:65-74"
      routes_to_finding: "N/A — input matches"
    - location: "RoleController.java:46 — deleteRole"
      input_kind: path-param
      input_name: "roleId (Long)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the role to delete. Implied: 'this id selects the role row to remove from the platform'."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:46 + openapi.yaml:3664-3679"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced: RoleController.java:48 → `roleService.delete(roleId)` → RoleServiceImpl.java:78-92. Service uses the id for: roleRepository.get(id) at line 79 (lookup), ownerToRoleRepository.isRoleAttachedToOwner(id) at line 85 (cascade check), roleToPolicyRepository.deleteRoleRelationsExcept(id, List.of()) at line 89 (hard-clean outbound edges), roleRepository.delete(id) at line 90 (soft-delete the role row)."
          confidence: STATIC-INFERRED
          evidence: "RoleController.java:48 + RoleServiceImpl.java:78-92"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the id selects the role, but 'delete' actually means SOFT-DELETE (UPDATE deleted_at = NOW()) AND HARD-DELETE of role_to_policy edges. The translation is consistent with the platform's other soft-delete CRUD repositories (Term, DataEntityGroup, Tag etc.); it is the platform's deliberate convention per batch-N implicit_adrs[soft-delete via deleted_at]. The translation is NOT documented at the API surface — operators do not learn from `openapi.yaml:3664-3679` that 'delete' is a soft-delete. Routes to docs_link_semantic.doc_drift_findings."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "RoleServiceImpl.java:90 + ReactiveAbstractSoftDeleteCRUDRepository (batch N) + V0_0_55__add_policies_and_roles.sql:42 (partial unique index supporting the soft-delete pattern)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Operator deletes role X, then immediately tries `POST /api/roles {name: 'X', policies: [...]}` — succeeds with a new id (the partial unique index excludes soft-deleted rows). Operator believes the role 'really' is removed (no longer appears in GET /api/roles), and the recreate-with-same-name pattern works — the surface behaviour matches what 'delete' normally implies. The soft-delete is forensically observable (`SELECT * FROM role` shows the soft-deleted row with deleted_at populated) but invisible at the API surface."
          confidence: STATIC-INFERRED
          evidence: "V0_0_55__add_policies_and_roles.sql:42 + ReactiveAbstractSoftDeleteCRUDRepository (batch N)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — `delete` is consistently soft-delete across the platform; no alternative-delete column or field is bypassed."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractSoftDeleteCRUDRepository (batch N)"
      routes_to_finding: "docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-E] (soft-delete-is-not-documented-as-soft-delete) — soft-delete is a platform-wide convention; documented per repository sidecar but not at the operator API surface"
  probes_emitted:
    - probe_id: P-127
      question: "Category C orderings: what is the deterministic ORDER BY on GET /api/roles (both ADMIN and non-ADMIN branches) when the result set has > 1 role, and is the ordering deterministic across repeat queries on a stable dataset?"
      probe_path: "lineage/odd-platform/probes/P-127.yaml"
  stress_summary:
    triggers_total: 17
    questions_total: 50
    answers_static_inferred: 47
    answers_probe_needed: 3
    answers_reference: 0
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | S2S` for the three mutation endpoints (POST/PUT/DELETE — gated by SECURITY_RULES entries at SecurityConstants.java:169-173). Under `auth.type=DISABLED` ALL FOUR endpoints are reachable unauthenticated (the AuthorizationCustomizer is NOT wired). GET /api/roles has NO SECURITY_RULES entry — falls through to `.authenticated()` (any signed-in caller; content filtered by the service's principal-aware fork at RoleServiceImpl.java:40-47).
- **ingestion_filter_relevance**: `NO — RBAC management surface, not ingestion`. The four `/api/roles[/{id}]` paths do not match the `/ingestion/**` whitelist or the IngestionDataEntitiesFilter (which scopes only to `/ingestion/entities`).
- **authorization_assertions**:
  - "`SecurityConstants.SECURITY_RULES.line 169: new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/roles\", POST), ROLE_CREATE)` — POST /api/roles requires ROLE_CREATE." — evidence: SecurityConstants.java:169
  - "`SecurityConstants.SECURITY_RULES.lines 170-171: new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/roles/{role_id}\", PUT), ROLE_UPDATE)` — PUT requires ROLE_UPDATE." — evidence: SecurityConstants.java:170-171
  - "`SecurityConstants.SECURITY_RULES.lines 172-173: new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/roles/{role_id}\", DELETE), ROLE_DELETE)` — DELETE requires ROLE_DELETE." — evidence: SecurityConstants.java:172-173
  - "GET /api/roles has NO entry in SECURITY_RULES — falls through to the catch-all `.authenticated()` rule. Server-side content fork (RoleServiceImpl.java:40-47) is the only access control on content." — evidence: SecurityConstants.java:163-184 (entries audited; no GET /api/roles row) + RoleServiceImpl.java:40-47
  - "Under S2S API-key auth, S2sAuthenticationFilter.java:31-39 injects ADMIN authority globally — the S2S caller automatically holds ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE. REFACTOR-108." — evidence: S2sAuthenticationFilter.java:31-39 (batch E)
  - "Under auth.type=DISABLED, no gate is evaluated — all four endpoints are reachable unauthenticated. The AuthorizationCustomizer is NOT wired by DisabledAuthSecurityConfiguration." — evidence: DisabledAuthSecurityConfiguration (batch E)
- **owner_scoping**: `BYPASSES at mutation endpoints; RESPECTS via server-side fork on list`. Roles are platform-global — they have no owner_id column. POST/PUT/DELETE operate platform-globally on any role id. GET /api/roles applies the principal-aware fork at RoleServiceImpl.java:40-47 (ADMIN sees all, non-ADMIN sees own attached) — the closest the platform comes to owner-scoping on Roles, but it is a content fork at the service tier, not framework-level enforcement.
- **data_exposure**:
  - "On every successful POST / PUT / GET: the Role payload (id + name + policies[]) — each Policy carries id + name + the full statement JSON via the role_to_policy LEFT JOIN aggregation (batch N invariants). Returned to the caller that holds the required permission."
  - "POST + PUT returns include any soft-deleted Policy rows whose role_to_policy edges survive (batch-N drift_class: the LEFT JOIN against POLICY has no `policy.deleted_at IS NULL` filter). UI displays the deleted Policy's name; in-memory permission extractor consumes the deleted Policy's statements if traversed from this flow."
  - "GET /api/roles for non-ADMIN callers returns ONLY the caller's own attached roles (partial defence). For ADMIN callers (including any S2S API-key holder) returns the full catalog — every role's id, name, and full policy text."
  - "DELETE returns 204 No Content (no body on success); on failure (CascadeDeleteException or BadUserRequestException or NotFoundException) returns 400/404 with the exception message body via the global ControllerAdvice. The grammar quirk in 'Role is attached to a owner' (RoleServiceImpl.java:88) is exposed verbatim."
  - "On any service-tier failure (UniqueConstraintException, NotFoundException, BadUserRequestException, CascadeDeleteException): the exception message is exposed via the global ControllerAdvice handler chain. The constraint name (`role_name_unique`) may leak in raw DataIntegrityViolationException messages if the ExceptionUtils translation fails (batch N — ExceptionUtils.translateDatabaseException at JooqReactiveOperations.java:41)."
- **known_security_gaps**:
  - "CONTROLLER-DOC-GAP-A under #security: forensic silence at the controller tier — no @Slf4j, no Logger, no log lines on any of the four operations. Combined with service + repository layer silence (batches S + N) AND the symmetric Policy half (batches E + I + H), the F-006 audit-silence pattern is 7-sidecar confirmed by this sidecar (was 6 after batch S). A privileged caller authoring/mutating/deleting roles leaves no application-log trail. Pillar-priority CRITICAL because the role-mutation surface controls platform authorization." — evidence: RoleController.java:1-52 (no log calls, no Slf4j) + cross-batches E + I + H + N + P + S — severity: HIGH
  - "GET /api/roles has no SECURITY_RULES gate — any authenticated caller (including S2S API-key holders with synthesised ADMIN) can enumerate role data (ADMIN sees full catalog; non-ADMIN sees own attached). Enumeration risk for an attacker with an authenticated foothold; partial defence by the service fork. Same shape as PolicyController.getPolicyList finding." — evidence: SecurityConstants.java:163-184 (no GET entry) + RoleServiceImpl.java:40-47 (server-side fork — partial defence) — severity: MEDIUM
  - "Under auth.type=DISABLED (the bundled default per application.yml — batch E DisabledAuthSecurityConfiguration), ALL FOUR endpoints are reachable unauthenticated. POST /api/roles + PUT /api/roles/{id} + DELETE /api/roles/{id} can be invoked anonymously, granting any HTTP caller the ability to author / mutate / delete roles with attacker-chosen policy bindings. LSN-001-shape silent-insecure-default failure mode on the RBAC management surface. Mitigation requires operator action (`auth.type=LOGIN_FORM | OAUTH2 | LDAP`)." — evidence: DisabledAuthSecurityConfiguration (batch E) + SecurityConstants.java:169-173 (gates that are inert under DISABLED) — severity: HIGH
  - "Under any non-DISABLED mode with `auth.s2s.enabled=true`, any X-API-Key holder is ADMIN globally (S2sAuthenticationFilter.java:31-39). All four endpoints succeed for any S2S caller — including authoring Roles with MANAGEMENT/ALL policy bindings. REFACTOR-108." — evidence: S2sAuthenticationFilter.java:31-39 + SecurityConstants.java:169-173 — severity: HIGH
  - "No parameter validation at the controller tier — page / size accept arbitrary Integer values including negative; roleId accepts any Long; RoleFormData has no minLength/maxLength/pattern on name (per components.yaml + batch E known_security_gaps[5]). A malformed request (negative page, 1MB name) reaches the service tier without intermediate guard. Partial defence at the DB layer (unique index, FK constraints) but errors surface as 500 or 400 with raw exception messages." — evidence: RoleController.java:28-30, 37, 46 + components.yaml:3368-3379 (per batch E) — severity: MEDIUM
  - "Cascade-delete defence at the service tier (RoleServiceImpl.java:85-88) is the SOLE protection against deleting a role bound to any owner. The controller does not enforce; the repository does not enforce; the DB has no cascade trigger or FK ON DELETE rule. A service-bypassing direct-repository invocation (a future controller using the repository directly) would skip the defence and produce orphan owner_to_role rows referencing a soft-deleted role." — evidence: RoleController.java:46-49 + RoleServiceImpl.java:85-88 + ReactiveOwnerToRoleRepositoryImpl (no DB cascade) + V0_0_55__add_policies_and_roles.sql:44-53 (no FK cascade) — severity: MEDIUM (defence-in-depth)

## performance

- **hot_paths**:
  - "Per-request controller cost: O(1) — every method is a one-expression delegate. The actual cost is in the service + repository + downstream JOIN per batches S + N. No controller-tier serialisation overhead beyond the framework defaults."
  - "AuthorizationCustomizer evaluates ~100+ SECURITY_RULES per request to find a path match (per batch-E + batch-S analysis). Cost is O(N rules) per request — same as every other gated endpoint; not specific to this controller."
  - "DELETE /api/roles/{role_id} is the heaviest at 5 sequential DB calls in transaction: get role → isRoleAttachedToOwner → conditional cascade error → deleteRoleRelationsExcept → repository soft-delete (per batch S). Update is 4 calls; create is 3; getList is 1-2 (admin → 1 CTE-paginated query; non-admin → 1 hot-path query via getCurrentUserRoles)."
- **throughput_characteristics**:
  - "Single-item CRUD on every endpoint — no bulk variants on the OpenAPI surface. An admin migrating 100 roles must issue 100 sequential POSTs / PUTs / DELETEs (per batch E throughput finding)."
  - "Reactive Mono signature on every method — non-blocking I/O preserved. WebFlux thread pool consumed by request count; DB round-trips dominate latency."
- **resource_allocation**:
  - "No explicit timeout on any reactive pipeline; depends on the R2DBC pool default. Per-request memory bounded by the request body size + the response Role payload (id + name + policies[] each with full statement JSON). Pathological role with 10000 policies produces multi-MB response per batch-E performance finding."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally; no in-class state, no controller-level cache."
  - "Concurrent operations on the SAME role id race at the service tier: PUT vs PUT (last-write-wins, no version column on RolePojo per batch N); DELETE vs PUT (race window per batch-S DRIFT-FACET-D — @ReactiveTransactional does not acquire row locks)."
  - "Concurrent CREATE with the SAME role name serialises at the DB partial unique index — one wins, the other gets UniqueConstraintException → 400."
- **known_performance_gaps**:
  - "No bulk endpoint on any of the four operations — admin migrations require N HTTP round-trips. Same as batch E. — severity: LOW"
  - "No upper bound on `RoleFormData.policies[]` size — components.yaml:3368-3379 has no maxItems. A request with 10000 policy ids triggers 10000 INSERTs into role_to_policy in one transaction. Same as batch E. — severity: LOW"
  - "Authorization hot path through this controller's request lifecycle (PolicyServiceImpl.getCurrentUserPolicies → RoleServiceImpl.getCurrentUserRoles per batch S) issues 1-2 JOINs per request — no caching at any tier. Platform-scale-dependent. Same as batch S + N. — severity: LOW"

## upstream_callers

- entry_point: "rest:POST /api/roles"
  caller_node: "external HTTP caller (authenticated under non-DISABLED) → AuthorizationCustomizer (SECURITY_RULES gate at SecurityConstants.java:169 → ROLE_CREATE) → RoleController.createRole"
  multiplicity_per_trigger: 1
  evidence: "RoleController.java:19-25 + SecurityConstants.java:169 + AuthorizationCustomizer wiring per batch E"
  observation_class: rest-call

- entry_point: "rest:GET /api/roles"
  caller_node: "external HTTP caller (authenticated, any signed-in user — no SECURITY_RULES entry) → SecurityWebFilterChain catch-all .authenticated() → RoleController.getRolesList"
  multiplicity_per_trigger: 1
  evidence: "RoleController.java:27-34 + SecurityConstants.java:163-184 (no GET /api/roles entry)"
  observation_class: rest-call

- entry_point: "rest:PUT /api/roles/{role_id}"
  caller_node: "external HTTP caller (authenticated under non-DISABLED) → AuthorizationCustomizer (ROLE_UPDATE gate at SecurityConstants.java:170-171) → RoleController.updateRole"
  multiplicity_per_trigger: 1
  evidence: "RoleController.java:36-43 + SecurityConstants.java:170-171"
  observation_class: rest-call

- entry_point: "rest:DELETE /api/roles/{role_id}"
  caller_node: "external HTTP caller (authenticated under non-DISABLED) → AuthorizationCustomizer (ROLE_DELETE gate at SecurityConstants.java:172-173) → RoleController.deleteRole"
  multiplicity_per_trigger: 1
  evidence: "RoleController.java:45-50 + SecurityConstants.java:172-173"
  observation_class: rest-call

- entry_point: "ui_route:/management/roles"
  caller_node: "ts react-component:RolesList (RolesList.tsx:40-42 dispatches fetchRolesList on mount; RolesList.tsx:48-51 on infinite-scroll; RolesList.tsx:53-58 debounced on search; RolesList.tsx:65-67 enter-to-search). Per-row RoleItem dispatches deleteRole; RoleForm dispatches createRole or updateRole."
  multiplicity_per_trigger: "1 per dispatch — RolesList.tsx:40-42 effect guarded by `!query` per batch Q invariants — one fetch per page-open under normal usage; refires only when query transitions to empty string (e.g. search clear)."
  evidence: "batch-Q RolesList sidecar invariants + RolesList.tsx:40-42 + roles.thunks.ts:13-24"
  observation_class: ui-call
  unresolved: false

- entry_point: "sdk:OpenAPI-generated TypeScript client (in the SPA frontend)"
  caller_node: "ts roles.thunks.ts:13-24 — `fetchRolesList` wraps `roleApi.getRolesList({page, size, query})`; create/update/delete thunks at roles.thunks.ts:30-45 invoke `roleApi.createRole(roleFormData)` / `roleApi.updateRole(roleId, roleFormData)` / `roleApi.deleteRole(roleId)`."
  multiplicity_per_trigger: 1
  evidence: "batch-Q RolesList sidecar dependencies_semantic + roles.thunks.ts (Redux thunks calling the generated RoleApi)"
  observation_class: sdk-call

- entry_point: "sdk:external API consumer (CI / automation / S2S API-key)"
  caller_node: "any external HTTP client compiled from openapi.yaml — under non-DISABLED + auth.s2s.enabled, any X-API-Key caller invokes the four endpoints via the SECURITY_RULES gate-bypass (REFACTOR-108)."
  multiplicity_per_trigger: 1
  evidence: "S2sAuthenticationFilter.java:31-39 (batch E) + REFACTOR-108"
  observation_class: sdk-call
  unresolved: false

## downstream_side_effects

- side_effect_class: db-write
  description: "POST /api/roles INSERTs one row into the `role` table and 0-N rows into `role_to_policy` (one per policy id in the request body)."
  evidence: "RoleController.java:22-24 → RoleServiceImpl.java:51-61 (batch S) → ReactiveRoleRepositoryImpl.create (batch N) + ReactiveRoleToPolicyRepositoryImpl.createRelations (batch S DRIFT-FACET-A site)"
  cardinality_per_call: "1 role INSERT + N role_to_policy INSERTs (N = policies.length, typically 1-10)"
  reachable_from_entry_points:
    - "rest:POST /api/roles"
    - "ui_route:/management/roles (via RoleForm dispatch on Create modal save)"
    - "sdk:OpenAPI-generated TypeScript client"
    - "sdk:external API consumer (CI / automation / S2S API-key)"

- side_effect_class: db-write
  description: "PUT /api/roles/{role_id} UPDATEs the role row's name (if changed) AND wholesale-rewrites role_to_policy edges via delete-then-create."
  evidence: "RoleController.java:40-42 → RoleServiceImpl.java:65-74, 112-121 (batch S) → ReactiveRoleRepositoryImpl.update + ReactiveRoleToPolicyRepositoryImpl.deleteRoleRelationsExcept + .createRelations"
  cardinality_per_call: "1 role UPDATE + N DELETE-FROM role_to_policy edges + M INSERT-INTO role_to_policy edges (N = pre-update edge count NOT in new set; M = new edge count NOT in old set; typical small)"
  reachable_from_entry_points:
    - "rest:PUT /api/roles/{role_id}"
    - "ui_route:/management/roles (via RoleForm dispatch on Edit modal save)"
    - "sdk:OpenAPI-generated TypeScript client"
    - "sdk:external API consumer (CI / automation / S2S API-key)"

- side_effect_class: db-write
  description: "DELETE /api/roles/{role_id} SOFT-DELETEs the role row (UPDATE deleted_at = NOW()) AND HARD-DELETEs all role_to_policy edges for that role. Cascade-blocked if any owner_to_role row references the role."
  evidence: "RoleController.java:48-49 → RoleServiceImpl.java:78-92 (batch S) → ReactiveRoleToPolicyRepositoryImpl.deleteRoleRelationsExcept + ReactiveRoleRepositoryImpl.delete (soft via base inheritance per batch N)"
  cardinality_per_call: "1 role UPDATE (soft-delete) + N HARD-DELETE role_to_policy rows; 0 if cascade-blocked (CascadeDeleteException raised before any delete)"
  reachable_from_entry_points:
    - "rest:DELETE /api/roles/{role_id}"
    - "ui_route:/management/roles (via RoleItem dispatch on Delete confirmation)"
    - "sdk:OpenAPI-generated TypeScript client"
    - "sdk:external API consumer (CI / automation / S2S API-key)"

- side_effect_class: page-render
  description: "Returns the Role payload (id + name + policies[] with full policy statement JSON) on POST + PUT; RoleList paged response (items + PageInfo) on GET; empty 204 body on DELETE; or 4xx ControllerAdvice error payload on rejection."
  evidence: "RoleController.java:24, 33, 42, 49"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:POST /api/roles"
    - "rest:GET /api/roles"
    - "rest:PUT /api/roles/{role_id}"
    - "rest:DELETE /api/roles/{role_id}"
    - "ui_route:/management/roles"
    - "sdk:OpenAPI-generated TypeScript client"
    - "sdk:external API consumer"

- side_effect_class: db-write
  description: "GET /api/roles reads from `role` (and joins to `role_to_policy` + `policy`) — admin path via CTE-paginated listDto (batch N); non-admin path via the 5-table JOIN through getCurrentUserRoles → getUserRolesByOwner (batch S). Listed under db-write in the side-effect class taxonomy because the read is observable externally; no rows are modified."
  evidence: "RoleController.java:32 → RoleServiceImpl.java:40-47 → ReactiveRoleRepositoryImpl.listDto OR ReactiveUserOwnerMappingRepositoryImpl.getUserRolesByOwner"
  cardinality_per_call: "1 paginated CTE query (admin path) OR 1 hot-path JOIN (non-admin) per call"
  reachable_from_entry_points:
    - "rest:GET /api/roles"
    - "ui_route:/management/roles"
    - "sdk:OpenAPI-generated TypeScript client"

- side_effect_class: log-emit
  description: "ZERO log lines on ANY of the four operations. No @Slf4j, no Logger field, no log call. Verified by reading RoleController.java:1-52 end-to-end."
  evidence: "RoleController.java:1-52 — no logger imports, no log invocations"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "rest:POST /api/roles"
    - "rest:GET /api/roles"
    - "rest:PUT /api/roles/{role_id}"
    - "rest:DELETE /api/roles/{role_id}"

- side_effect_class: activity-emit
  description: "ZERO activity-feed events on ANY of the four operations. The platform's activity feed (`/api/activity`) covers DataEntity / Owner mutations but does NOT extend to Role / Policy / Permission mutations (per batch S service-tier finding)."
  evidence: "RoleController.java:1-52 (no activity event publication) + RoleServiceImpl.java:1-143 (no activity event publication — batch S) + ReactiveRoleRepositoryImpl.java:1-94 (no activity event publication — batch N)"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "rest:POST /api/roles"
    - "rest:PUT /api/roles/{role_id}"
    - "rest:DELETE /api/roles/{role_id}"

The downstream-side-effects picture confirms the 7-sidecar audit-silence pattern at the controller-class layer for the Role half. RoleController emits ZERO security-relevant log lines, ZERO activity-feed events, ZERO audit-table writes on any of {create, update, delete}. Combined with RoleServiceImpl (batch S — 6-sidecar) and ReactiveRoleRepositoryImpl (batch N — 5-sidecar) and the symmetric Policy half across batches E + I + H, the entire RBAC mutation stack is forensically silent across the FULL three-tier vertical AND both Role + Policy horizontal halves. A security incident reviewer investigating 'who created / updated / deleted this MANAGEMENT/ALL role on date X' from running-platform logs cannot answer the question.

## sources

- understanding ← RoleController.java:1-52 (end-to-end read) + RoleServiceImpl.java:1-143 (batch S) + ReactiveRoleRepositoryImpl.java:1-94 (batch N) + SecurityConstants.java:169-173
- concepts.entities ← RoleController.java:4-12 (imports) + components.yaml:3368-3379 (RoleFormData schema per batch E) + openapi.yaml:3601-3679
- concepts.operations ← RoleController.java:19-50 (every method)
- concepts.invariants[thin-delegate posture] ← RoleController.java:19-50 + sibling controller pattern
- concepts.invariants[status-code drift] ← RoleController.java:24, 33, 42, 49 + openapi.yaml:3611, 3629, 3656, 3676
- concepts.invariants[authorization upstream] ← RoleController.java:1-52 (no @PreAuthorize) + SecurityConstants.java:169-173 + AuthorizationCustomizer (batch E)
- concepts.invariants[exchange no-op] ← RoleController.java:21, 31, 39, 47 (declared) vs 22-24, 32-33, 40-42, 48-49 (never used)
- concepts.invariants[forensic silence] ← RoleController.java:1-52 (no log imports, no Slf4j, no log calls)
- concepts.invariants[asymmetric HTTP semantics] ← RoleController.java:24, 33, 42, 49 + openapi.yaml:3611-3679
- concepts.audiences ← batch-Q RolesList sidecar + S2sAuthenticationFilter.java:31-39 (batch E) + SecurityConstants.java:169-173
- dependencies_semantic.requires-feature ← RoleController.java:4 (RoleApi import) + 16 (implements) + openapi.yaml:3601-3679 + lines 9-12 (Spring imports) + batch-N + batch-S sibling sidecars
- dependencies_semantic.requires-config ← cross-axis: DisabledAuthSecurityConfiguration / LoginFormSecurityConfiguration / OAuthSecurityConfiguration / LDAPSecurityConfiguration + S2sAuthenticationFilter (batch E)
- dependencies_semantic.requires-runtime ← RoleController.java:9-12 (Spring + Reactor imports) + batch-N + batch-S sidecars + V0_0_55 + V0_0_56 + V0_0_64 migrations
- tests_coverage_semantic.test_files ← Grep `find <odd-platform-repo>/odd-platform-api/src/test -name '*Role*.java'` returns ZERO matches (verified via batch-E and batch-S inheritance)
- docs_link_semantic.inferred_docs.[roles page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles (2026-05-25, 200)
- docs_link_semantic.inferred_docs.[authorization index] ← batch-E + batch-S sidecar inheritance (2026-05-12 verified state — within 13-day stale-probe cadence)
- docs_link_semantic.inferred_docs.[enable-security overview] ← batch-E sidecar inheritance
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-A no API surface] ← WebFetch roles page 2026-05-25 + RoleController.java:19-50 + openapi.yaml:3601-3679
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-B status-code drift] ← RoleController.java:24, 42 + openapi.yaml:3629, 3656
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-C audit silence 7-sidecar] ← RoleController.java:1-52 + cross-batches E + I + H + N + P + S
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-D list authorization model] ← RoleController.java:27-34 + SecurityConstants.java:163-184 + RoleServiceImpl.java:40-47
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-E cascade-delete contract] ← RoleController.java:45-50 + RoleServiceImpl.java:85-88
- docs_link_semantic.doc_drift_findings[CONTROLLER-DOC-GAP-F predefined-name asymmetry surface] ← RoleController.java:36-50 + RoleServiceImpl.java:49-92
- implicit_adrs[thin-delegate controller] ← RoleController.java:19-50 + sibling controllers (PolicyController, OwnerController etc.)
- implicit_adrs[OpenAPI-generated RoleApi] ← RoleController.java:4, 16, 19-50 + openapi.yaml:3601-3679
- implicit_adrs[authorization wholly upstream] ← RoleController.java:1-52 + SecurityConstants.java:169-173 + AuthorizationCustomizer (batch E)
- implicit_adrs[status-code de facto pattern] ← RoleController.java:24, 33, 42, 49 + openapi.yaml:3611-3679 + sibling controllers per batch E
- bugs_limitations_corner_cases[status-code drift] ← RoleController.java:24, 42 + openapi.yaml:3629, 3656
- bugs_limitations_corner_cases[GET no SECURITY_RULES] ← RoleController.java:27-34 + SecurityConstants.java:163-184
- bugs_limitations_corner_cases[forensic silence] ← RoleController.java:1-52
- bugs_limitations_corner_cases[exchange unused] ← RoleController.java:21, 31, 39, 47 + 22-24, 32-33, 40-42, 48-49
- bugs_limitations_corner_cases[no parameter validation] ← RoleController.java:28-30, 37, 46 + components.yaml:3368-3379 (batch E)
- bugs_limitations_corner_cases[Lombok constructor dependency] ← RoleController.java:3, 15, 17
- bugs_limitations_corner_cases[OpenAPI coupling] ← RoleController.java:4, 16, 19-50 + spec-repo separation
- stress_findings[A tunables] ← RoleController.java:1-52 (no numeric literals, no @Value, no constants)
- stress_findings[B name-behavior pairs] ← RoleController.java:19-50 + RoleServiceImpl.java:40-92 (batch S) + ReactiveAbstractSoftDeleteCRUDRepository (batch N inheritance)
- stress_findings[C orderings] ← RoleController.java:27-34 + RoleServiceImpl.java:40-47, 136-142 (batch S) + ReactiveRoleRepositoryImpl.listDto (batch N) — probe P-127 emitted for ordering determinism
- stress_findings[D auth gates] ← RoleController.java:19-50 + SecurityConstants.java:163-184 + S2sAuthenticationFilter.java:31-39 + DisabledAuthSecurityConfiguration (batch E)
- stress_findings[E resource boundaries] ← RoleController.java:1-52 (stateless) + RoleServiceImpl.java:50, 64, 77 (batch S transactional) + V0_0_55__add_policies_and_roles.sql:42
- stress_findings[F request-input naming alignment] ← RoleController.java:20-21, 28-30, 37, 46 + RoleServiceImpl.java:40-92, 128-134 (batch S) + ReactiveAbstractSoftDeleteCRUDRepository (batch N inheritance)
- security.auth_mode_relevance ← SecurityConstants.java:169-173 + DisabledAuthSecurityConfiguration / LoginForm / OAuth2 / LDAP / S2sAuthenticationFilter (batch E)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter (separate sidecar, scoped to /ingestion/entities)
- security.authorization_assertions ← SecurityConstants.java:169-173 + S2sAuthenticationFilter.java:31-39 + DisabledAuthSecurityConfiguration (batch E)
- security.owner_scoping ← V0_0_55__add_policies_and_roles.sql (no owner_id on role) + RoleServiceImpl.java:40-47 (principal-aware fork)
- security.data_exposure ← RoleController.java:19-50 + RoleServiceImpl.java:40-92 + batch-N drift_class
- security.known_security_gaps ← cumulative with bugs + batches E + S + N + DisabledAuthSecurityConfiguration + S2sAuthenticationFilter + REFACTOR-108
- performance.hot_paths ← RoleController.java:19-50 (constant-cost delegate) + RoleServiceImpl.java:40-92 (batch S) + AuthorizationCustomizer (batch E)
- performance.throughput_characteristics ← RoleController.java:19-50 + openapi.yaml:3601-3679 (no bulk variants)
- performance.resource_allocation ← RoleController.java:19-50 + components.yaml:3368-3379 (no maxItems on policies)
- performance.scaling_characteristics ← RoleController.java:14-17 (stateless) + RoleServiceImpl.java:49-92 (batch S — no row locks) + V0_0_55__add_policies_and_roles.sql:42
- performance.known_performance_gaps ← batch E + batch S findings (no bulk, no upper bound, no caching on hot path)
- upstream_callers ← RoleController.java:19-50 + SecurityConstants.java:169-173 + batch-Q RolesList sidecar + S2sAuthenticationFilter (batch E)
- downstream_side_effects ← RoleController.java:19-50 + RoleServiceImpl.java:51-92 (batch S) + ReactiveRoleRepositoryImpl + ReactiveRoleToPolicyRepositoryImpl (batches N + S)

## coherence_check_lsn_018

Per Rule 6 — Pre-emit coherence check (LSN-018). Comparing this sidecar's claims against neighbouring sidecars + system-mission.md + concept catalog:

**STRENGTHENS** (5):
1. F-006 P-09:F-001 RBAC mutation surface — controller-CLASS-tier confirmation (a SEPARATE artefact from the batch-E controller-METHOD `createRole` sidecar) for ALL FOUR endpoints under one roof. Strengthens batch-E's per-method analysis by surfacing the cross-endpoint pattern (status-code drift is on 2/4, audit silence is on 4/4, authorization gating is on 3/4).
2. concept-catalog `no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f` — promoted from 6-sidecar (batches E + I + H + N + P + S) to 7-sidecar with this sidecar's controller-class-level confirmation of forensic silence across all four endpoints.
3. concept-catalog `role_service_predefined_name_case_sensitivity_mismatch` (originated batch N) — RE-CONFIRMED at the controller-class level by reading the four endpoints' delegation paths into RoleServiceImpl.java:49-92 and inheriting the case-asymmetry contract.
4. Status-code drift pattern across the controller package — RoleController POST + PUT return 200 vs spec 201; same drift in PolicyController + OwnerController per batch E. Cross-batch refinement: the de facto convention is 'controllers return 200 on success regardless of spec', which functions as an implicit ADR but lacks a defending comment.
5. system-mission.md line 267 "read-collaborative posture (REFACTOR-024, REFACTOR-203, REFACTOR-201)" — confirmed AGAIN on the Role surface via the GET /api/roles + RoleServiceImpl principal-aware fork. The posture is now confirmed on Policy (batch I) + Role (this sidecar + batch S) + entity-level discovery surfaces (batches D/F).

**SUPERSEDES** (0): No claims in this sidecar contradict prior claims. The controller-class-level analysis is a NEW artefact (not a refresh of batch E); batch E remains the per-method analysis of createRole.

**CONFLICTS_SURFACED** (0): No conflicts with system-mission.md, concept catalog, or sibling sidecars.

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero direct coverage statement is Grep-verified against `<odd-platform-repo>/odd-platform-api/src/test` returning empty for any *Role*.java file — inherited from batch E + batch S)
- docs_link_semantic: MEDIUM (live WebFetch performed in this session 2026-05-25 status 200 against the Roles page — primary URL fresh; the two parent index pages inherit batch-E + batch-S verified state from 2026-05-12, 13 days old; stale-probe cadence per LSN-018 is 11 days, so a re-fetch is borderline but the content is stable across multiple prior batches)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- implicit_adrs: HIGH (each backed by code structure + parallel-sibling pattern; the status-code de-facto-ADR is MEDIUM because the convention has no defending comment)
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH (the constant-cost-controller statement is HIGH-confidence; downstream cost is inherited from batches S + N)
- stress_findings: MEDIUM (1 of 17 triggers — Category C orderings — has a PROBE-NEEDED answer; the other 16 are STATIC-INFERRED with strong evidence; net confidence MEDIUM-HIGH but conservatively recorded MEDIUM because the orderings determinism is operator-observable and unresolved without runtime)

## Maintainer notes

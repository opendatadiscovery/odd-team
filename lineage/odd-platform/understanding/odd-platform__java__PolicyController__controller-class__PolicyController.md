---
node_id: "odd-platform java PolicyController controller-class:PolicyController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZD-PolicyController-class
feature_hint: "P-09:F-001 (Role-Based Access Control) — RBAC policy-management HTTP entry surface. Controller-class enrichment closes the missing-entry-point primary source for the policy half of F-006; service tier (batch S PolicyServiceImpl) and repository tier (batch H ReactivePolicyRepositoryImpl) are already exhaustively enriched, and batch E enriched the createPolicy sibling method. This sidecar fills the CLASS-level audit-bracket / transactional-bracket / response-code-spec-drift findings the per-method enrichments could not surface."
related_features:
  - F-006
related_pillar_features:
  - P-09:F-001   # Role-Based Access Control — the canonical pillar-anchored feature this controller anchors at the HTTP boundary
related_retrospectives:
  - LSN-019   # transcription vs interrogation — the controller looks 'thin proxy' on a single read; Category B (six method names: createPolicy / getPolicyDetails / getPolicyList / updatePolicy / deletePolicy / getPolicySchema) + Category C (paginate semantics differ admin vs non-admin via service) + Category E (no transactional bracket on the multi-write update / delete flows) + Category F (every named request input is examined against the implementation surface)
  - LSN-020   # input-name vs implementation alignment — every controller path/query parameter (policyId, page, size, query) and every body field (policyFormData) is run through Category F; the controller's parameter names map cleanly to the service tier but the service tier's implementation differs across operations (admin pagination vs non-admin in-memory list)
  - LSN-001   # silent no-op pattern — soft-deleted-policy-still-grants-permissions defect inherited from F-006 batch H sits BELOW this controller; the controller cannot fix it but its UI/API surface is where operators observe the inconsistency
coherence_check:
  performed_at: "2026-05-25"
  strengthens:
    - "F-006 facet `lost_update_race` — CONTROLLER-TIER PRIMARY-SOURCE: PolicyController.updatePolicy at lines 43-50 has NO @ReactiveTransactional and no per-method authorization annotation; the only available transactional bracket would have to come from the service tier which (per batch-S) does not carry it either. Two layers of missing bracket — controller above + service below — confirm the lost-update race is operator-visible from the HTTP surface inward."
    - "F-006 facet `service_tier_at_reactive_transactional_asymmetry_role_yes_policy_no` — CONTROLLER-TIER COROBORATION: the controller has no annotation that would compensate for the missing service annotation; the asymmetry survives end-to-end through the controller HTTP boundary."
    - "F-006 facet `forensic_silence_on_rbac_mutations` — CONTROLLER-TIER NINTH CORROBORATING SIDECAR: PolicyController.java:1-64 has NO @Slf4j, NO Logger field, NO log.* call, NO @ActivityLog. Six policy/role/owner-related HTTP operations (createPolicy POST + getPolicyDetails GET + getPolicyList GET + updatePolicy PUT + deletePolicy DELETE + getPolicySchema GET) traverse this controller; ZERO of them emit any application-tier log line. Aligns with batch-E createPolicy + batch-H ReactivePolicyRepositoryImpl + batch-N ReactiveRoleRepositoryImpl + batch-P OwnerServiceImpl + batch-Q PolicyList UI + batch-R ReactiveActivityRepositoryImpl + batch-S PolicyServiceImpl as the NINTH sidecar in the cross-batch audit-silence pattern, with this sidecar pinning the HTTP boundary as the OUTERMOST silent surface."
    - "F-006 facet `administrator_name_create_path_asymmetry` — CONTROLLER-TIER VISIBILITY: PolicyController.createPolicy (lines 19-25) carries no name-pre-check; the asymmetry confirmed at PolicyServiceImpl.create (lines 62-69, no check) flows uninterrupted through the controller — no controller-tier safeguard exists either."
    - "F-006 facet `error_class_misrepresented_validator_throws_illegalargument` — CONTROLLER-TIER OBSERVABILITY: ControllerAdvice.java:23-66 has NO @ExceptionHandler(IllegalArgumentException.class); PolicyJSONValidator's throws on create/update at PolicyServiceImpl.java:64/73 fall through to ControllerAdvice.java:61-66 (the catch-all Exception.class handler) and surface as HTTP 500 with body `Internal Server Error` rather than HTTP 400 with the validator's actual error message. The controller-class enrichment is the right layer at which to flag this — the operator hits the controller and sees 500."
    - "Spec-vs-code drift (new at this sidecar): openapi.yaml:3528 declares `'201': The resource has been successfully created` for POST /api/policies; PolicyController.createPolicy (line 24) returns `ResponseEntity.ok()` (HTTP 200). openapi.yaml:3566 declares `'201': The resource has been successfully modified` for PUT /api/policies/{policy_id}; PolicyController.updatePolicy (line 49) returns `ResponseEntity.ok()` (HTTP 200). Both create and update endpoints have a 200-vs-201 response-code drift between code and spec — a fresh F-006 facet candidate."
    - "batch-E PolicyController.createPolicy SECURITY_RULES coverage finding — CONFIRMED AT CLASS LEVEL: this sidecar enumerates ALL six HTTP operations and confirms the SECURITY_RULES coverage matrix: createPolicy/updatePolicy/deletePolicy ARE gated (POLICY_CREATE/POLICY_UPDATE/POLICY_DELETE per SecurityConstants.java:163-168); getPolicyDetails/getPolicyList/getPolicySchema are NOT — they fall through to `.pathMatchers(\"/**\").authenticated()` per AuthorizationCustomizer.java:29-30. The read-side authorization gap is structural and class-wide, not method-local."
    - "batch-H ReactivePolicyRepositoryImpl orphan-binding finding — CONTROLLER-TIER INHERITANCE: the delete endpoint (PolicyController.deletePolicy lines 52-57) is the HTTP-visible delivery vehicle for the orphan-binding-race the service-tier cascade-check is supposed to defend against. The non-atomic check-then-delete window at PolicyServiceImpl.java:89-93 is visible from outside through this controller endpoint — three concurrent clients (one DELETE here, one POST /api/roles add-binding elsewhere, one GET /api/policies read) can produce the soft-deleted-with-binding state."
    - "batch-Q PolicyList UI tier — UI-VISIBLE HALF OF F-006: the catalogue UI calls GET /api/policies (this controller's getPolicyList), GET /api/policies/{id} (getPolicyDetails), and GET /api/policies/schema (getPolicySchema). The catalogue-vs-grant asymmetry (UI shows undeleted policies but soft-deleted policies still grant permissions through getRolesPolicies at batch-H) flows through this controller's read endpoints into the UI; the controller is the surface at which the operator observes the asymmetry."
    - "batch-P getPolicyPermissions PHANTOM finding — CLASS-LEVEL CONFIRMATION: this sidecar enumerates the FULL six-method surface of PolicyController and confirms no `getPolicyPermissions` method exists anywhere on this class; the only catalogue-read surface is `getPolicySchema` at line 60-63, consistent with batch-P's primary-source determination."
  supersedes: []
  conflicts: []
  back_links_emitted:
    - F-006
    - "batch-E PolicyController.createPolicy sidecar"
    - "batch-H ReactivePolicyRepositoryImpl sidecar"
    - "batch-S PolicyServiceImpl sidecar"
    - "batch-Q PolicyList UI sidecar"
    - "batch-P PermissionController.getPolicyPermissions phantom-node sidecar"
---

# PolicyController — semantic understanding

## understanding

The platform's RBAC-policy HTTP entry surface — six operations on
`/api/policies` and `/api/policies/{policy_id}` plus the JSON-Schema
catalogue endpoint `/api/policies/schema` — implemented as a 64-line
thin-proxy controller whose every method is a `.flatMap` / `.map`
delegation to `policyService` (PolicyController.java:14-63). The class
implements the OpenAPI-generated `PolicyApi` interface (line 16); HTTP
method, path, parameter binding, request-body schema and OpenAPI
operation-id all come from `odd-platform-specification/openapi.yaml:3499-3599`.
Authorization is wired NOT on the controller methods (no `@PreAuthorize`,
no programmatic check on any of the six methods) but DECLARATIVELY in
`SecurityConstants.SECURITY_RULES` (SecurityConstants.java:163-168) —
and only for the three MUTATING operations (POST / PUT / DELETE). The
three READ operations (`GET /api/policies`, `GET /api/policies/{id}`,
`GET /api/policies/schema`) carry NO SECURITY_RULES entry and fall
through to `AuthorizationCustomizer.java:29-30`'s catch-all
`.pathMatchers("/**").authenticated()` — any authenticated user can
read every policy by id and fetch the live schema. The controller has
NO `@Slf4j` annotation, NO Logger field, NO `@ActivityLog` annotation,
NO transactional bracket — every operator-observable behaviour
(lost-update race on PUT, non-atomic check-then-delete on DELETE,
schema-validation-failure-as-500, no audit trail on any of {create,
update, delete}) the underlying batches E + H + N + Q + R + S have
identified flows through this controller verbatim, surfaced on the
HTTP boundary the operator hits. The controller also DRIFTS from its
own OpenAPI spec on two response codes: spec declares 201 for POST and
PUT successes; code returns 200 on both (lines 24, 49).

## concepts

- entities:
  - "PolicyFormData (request DTO — `{ name: string, policy: string }` JSON-encoded; the `policy` field is the JSON-Schema-validated policy document)"
  - "PolicyDetails (response DTO for create/get/update — `{ id, name, statements: [...], roles: [...], created_at, updated_at }`)"
  - "Policy (response DTO list-item — `{ id, name }`)"
  - "PolicyList (response DTO for list — `{ items: Policy[], pageInfo: { total, page, hasNext } }`)"
  - "PolicySchema (response DTO for /schema — plain `string` content type; the bundled `schema/policy_schema.json` text)"
  - "policyId (Long — path parameter on /{policy_id} endpoints; OpenAPI parameter `PolicyIdParam`)"
  - "page, size, query (Integer / Integer / String — request-query parameters on GET /api/policies; OpenAPI parameters `PageParam`, `SizeParam`, `SearchParam`)"
  - "ServerWebExchange (Spring WebFlux request/response wrapper — passed to every method but READ-ONLY here: no `exchange.getRequest()` / `exchange.getResponse()` / `exchange.getAttributes()` access anywhere in this class; the OpenAPI codegen requires it on the signature)"
- operations:
  - "createPolicy (POST /api/policies → POLICY_CREATE-gated → policyService.create → 200 OK with PolicyDetails — spec declares 201)"
  - "getPolicyDetails (GET /api/policies/{policy_id} → .authenticated() ONLY → policyService.getPolicyDetails → 200 OK with PolicyDetails)"
  - "getPolicyList (GET /api/policies → .authenticated() ONLY → policyService.list → 200 OK with PolicyList — pagination semantics differ admin vs non-admin per service tier)"
  - "updatePolicy (PUT /api/policies/{policy_id} → POLICY_UPDATE-gated → policyService.update → 200 OK with PolicyDetails — spec declares 201)"
  - "deletePolicy (DELETE /api/policies/{policy_id} → POLICY_DELETE-gated → policyService.delete → 204 No Content)"
  - "getPolicySchema (GET /api/policies/schema → .authenticated() ONLY → policyService.getPolicySchema → 200 OK with String)"
- invariants:
  - "**Every method is a thin reactive proxy onto policyService.** The controller body for each of six methods is two to three Mono operations — no field validation beyond what bean-binding provides, no logging, no exception translation, no retry, no transaction bracket, no caching. The class is intentionally policy-business-logic-agnostic; every business invariant (JSON-schema validation, Administrator-name reservation, cascade-binding check, soft-delete) lives in `PolicyServiceImpl` per batch-S, NOT here."
  - "**Authorization is declarative-and-remote.** A reader of PolicyController.java alone has NO indication that POST / PUT / DELETE are POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE-gated; the wiring lives in `SecurityConstants.SECURITY_RULES` (lines 163-168) at the `auth.util` package, NOT on the controller method itself. The three READ methods have NO entry in SECURITY_RULES and therefore fall through to `.authenticated()` only — invisibly to a reader of this class."
  - "**No HTTP response code lookup at controller layer.** Every successful create / update / delete returns `ResponseEntity.ok()` (HTTP 200) or `ResponseEntity.noContent()` (HTTP 204). The OpenAPI spec declares **201** for create-success (POST /api/policies → '201': The resource has been successfully created — openapi.yaml:3528) AND **201** for update-success (PUT /api/policies/{policy_id} → '201': The resource has been successfully modified — openapi.yaml:3566). The controller returns 200 in both cases — a clear spec-vs-code drift the OpenAPI consumer (the React UI's auto-generated client) silently tolerates because it inspects the response BODY, not the status code, but a third-party API consumer following the spec would correctly expect 201 on success."
  - "**Six method names map cleanly to six service operations** — there is no name drift between controller and service (createPolicy↔create, getPolicyDetails↔getPolicyDetails, getPolicyList↔list, updatePolicy↔update, deletePolicy↔delete, getPolicySchema↔getPolicySchema). The drift is entirely INSIDE the service tier (per batch-S `listMostPopular`-style is N/A here, but the non-admin pagination asymmetry IS a service-tier name-behavior drift surfaced from the controller's `getPolicyList`)."
  - "**ServerWebExchange is unused.** Every method takes `final ServerWebExchange exchange` as the last parameter (lines 21, 29, 38, 46, 54, 60) and uses NONE of it. This is OpenAPI-codegen scaffolding from the `*Api` interface; the controller has no use for it and a hand-written controller would not declare it. Removing it would require regenerating without the WebFlux-server-binding option; the parameter is harmless but is dead weight in the file."
- audiences:
  - "Platform administrators authoring RBAC policies via the React UI's Management → Access Management → Policies page (PolicyList.tsx — batch Q sidecar) — every CRUD click maps 1:1 onto this controller's six methods."
  - "Automation scripts seeding policies during cluster bootstrap (the platform exposes no bulk-create endpoint; one HTTP call per policy)."
  - "Third-party integrations consuming the OpenAPI spec — they get the FULL six-method surface plus the 201-on-create / 201-on-update declared response codes (which the running platform does NOT honor — it returns 200)."
  - "Future operators investigating security incidents — they look here for an audit trail of who-created-what-policy-when and find NONE: no @Slf4j, no Logger, no @ActivityLog."

## dependencies_semantic

- requires-feature:
  - "PolicyService bean (PolicyServiceImpl — DI field at line 17) — owns ALL business logic for the six operations. The controller invokes 6 methods on this service: `create` (line 23), `getPolicyDetails` (line 30), `list` (line 39), `update` (line 48), `delete` (line 55), `getPolicySchema` (line 61). See batch-S sidecar for the service-tier semantics: JSON-schema validation, Administrator-name reservation (asymmetric — create has NO check), cascade-binding check (non-atomic with delete), no transactional bracket on any of {create, update, delete}, no logging, no @ActivityLog."
  - "OpenAPI-generated PolicyApi interface (implements at line 16) — HTTP wiring (path, method, request-body schema, parameter binding, OperationId, response-shape) comes from `odd-platform-specification/openapi.yaml:3499-3599`. The interface compels the controller to declare every method with `final ServerWebExchange exchange` as a trailing parameter; the controller uses none of them. The interface ALSO compels return type `Mono<ResponseEntity<T>>` — this is the surface where the controller can decide HTTP status code, and where the 200-vs-201 spec drift is introduced (the spec declares 201; the controller chose 200)."
  - "SecurityConstants.SECURITY_RULES (SecurityConstants.java:163-168) — declares POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE gates on POST / PUT / DELETE respectively. This list is the AUTHORITATIVE gate registry consumed by AuthorizationCustomizer.java:14-32; the gate is invisible to a reader of this controller file."
  - "AuthorizationCustomizer (AuthorizationCustomizer.java:14-32) — iterates SECURITY_RULES at boot and installs the appropriate ReactiveAuthorizationManager per (path, method) tuple. Plus the catch-all `pathMatchers(\"/**\").authenticated()` at line 29-30 which gates the THREE READ methods (getPolicyDetails, getPolicyList, getPolicySchema) to authentication-only."
  - "ControllerAdvice (ControllerAdvice.java:20-89) — handles five exception classes (BadUserRequestException → 400, NotFoundException → 404, UniqueConstraintException → 400, CascadeDeleteException → 400, WebExchangeBindException → 400, GenAIException → 500) plus a catch-all Exception → 500. `IllegalArgumentException` (thrown synchronously by PolicyJSONValidator at PolicyJSONValidator.java:28-32) has NO dedicated handler — falls through to the catch-all at line 61-66 and surfaces as HTTP 500 with body `\"Internal Server Error\"` instead of 400 with the validator's error detail."
- requires-config:
  - "`auth.type` (one of DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — selects which `*SecurityConfiguration` is `@ConditionalOnProperty`-activated at boot. Three of the four modes (LOGIN_FORM / OAUTH2 / LDAP) install `AuthorizationCustomizer` which enforces SECURITY_RULES; under `auth.type=DISABLED` the chain is short-circuited via `DisabledAuthSecurityConfiguration.java:14-18` (`anyExchange().permitAll()`) and the entire SECURITY_RULES registry is bypassed — including the three POLICY_* gates. This is the HIGH-severity bypass already enumerated by batch-E for createPolicy; here it applies to ALL THREE mutating endpoints."
  - "Bootstrap state: V0_0_55__add_policies_and_roles.sql + V0_0_56__add_predefined_roles_and_policies.sql — see batch-S `requires-config` for the full schema and seeded-data dependency picture. Without V0_0_56 the seeded Administrator policy does not exist, the service's Administrator-name guards on update / delete become no-ops, and the partial UNIQUE INDEX `policy_name_unique` is unconstrained on the literal `Administrator` until a user creates one."
  - "Indirect: the OpenAPI codegen pipeline (`./mvnw clean install` regenerates `*Api` interfaces from `odd-platform-specification`). A spec change that renames an operationId or alters a method signature requires regenerating before the controller compiles — and a spec change that adds a new policy endpoint requires implementing here. The 200-vs-201 spec drift is currently invisible to the codegen because the codegen does not enforce the success-code declaration; the response-shape is a `ResponseEntity<T>` and the status code is the controller's choice."
- requires-runtime:
  - "Spring WebFlux (`@RestController`, `Mono<ResponseEntity<T>>` signatures)."
  - "Reactor Core (`Mono.flatMap`, `Mono.map`, `Mono.thenReturn`)."
  - "OpenAPI-generated PolicyApi interface (build-time codegen from openapi.yaml; the controller fails to compile if the spec changes incompatibly)."
  - "PostgreSQL with the `policy`, `role`, `role_to_policy` tables and the soft-delete partial UNIQUE INDEX. Inherited through `PolicyServiceImpl` → `ReactivePolicyRepository` chain — see batches S and H."
- coupling:
  - "Tight coupling to the OpenAPI codegen: every method signature MUST match the generated `PolicyApi` interface. A spec change to e.g. add a `@PreAuthorize`-equivalent declaration would not flow through OpenAPI codegen (OpenAPI does not generate Spring Security annotations); the gate-wiring at SecurityConstants.SECURITY_RULES is HAND-MAINTAINED, requires a developer to add an entry per new endpoint, and currently leaves the three READ endpoints unmaintained-by-design."
  - "Tight coupling to the service-tier name discipline: `createPolicy → policyService.create`, `getPolicyDetails → policyService.getPolicyDetails`, `getPolicyList → policyService.list` (note the rename: list-vs-getPolicyList, the controller does the alias). A future service-method rename without simultaneous controller edit breaks compilation; benign coupling."
  - "Implicit coupling to ControllerAdvice's exception-handler registry: the SOLE error-translation surface for every business exception raised by PolicyService is ControllerAdvice. The synchronous `IllegalArgumentException` from PolicyJSONValidator (raised inside the service's create / update methods at PolicyServiceImpl.java:64, 73) flows up through this controller's Mono pipeline (Reactor catches synchronous throws inside `.flatMap` and converts to `Mono.error`) into ControllerAdvice.handleServerException → HTTP 500. The controller has no `onErrorMap` decorator to intercept and re-map; this is by-design but it means the 500-vs-400 drift is fixable in either of two layers (PolicyJSONValidator changing the thrown class, OR ControllerAdvice adding an `@ExceptionHandler(IllegalArgumentException.class)`) — both one-line — neither has been chosen."
  - "Tight coupling to the auth.type-DISABLED bypass: every gate this controller relies on lives in SECURITY_RULES, and SECURITY_RULES is iterated only by AuthorizationCustomizer which is registered only by the three NON-DISABLED SecurityConfiguration beans. A DISABLED deployment exposes ALL six endpoints — including the three mutating endpoints with no Permission check — to any reachable caller."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "POST /api/policies with valid PolicyFormData returns 200 OK and a PolicyDetails body — pin the current 200-vs-spec-201 behaviour so a future fix is detected."
    test_class: integration
    criticality: HIGH
    note: "Pin the spec-drift on response code at the controller level so a fix-flip from 200→201 is a deliberate change with a visible test rewrite."
  - behaviour: "POST /api/policies with malformed policy JSON returns HTTP 500 with body `Internal Server Error` — pin the current (mis-mapped) IllegalArgumentException → 500 behaviour so a fix to BadUserRequestException → 400 is visible."
    test_class: integration
    criticality: HIGH
  - behaviour: "GET /api/policies/{id} for an authenticated user with NO POLICY_* permissions returns 200 with the policy's full details — pin the current authenticated-but-unauthorized read access so a future fix that adds a Permission-level gate (e.g. POLICY_READ) is a deliberate, test-visible change."
    test_class: security
    criticality: HIGH
  - behaviour: "GET /api/policies/schema for an authenticated user with NO permissions returns the live JSON-Schema content — pin the same exposure on the catalogue surface."
    test_class: security
    criticality: MEDIUM
  - behaviour: "PUT /api/policies/{id} concurrent updates by two different authenticated authorized clients with different bodies: both writes succeed, second-arriving wins, first-arriving change is silently lost (no 409, no ETag, no error). See probe P-121."
    test_class: integration
    criticality: HIGH
    note: "The probe pins the operator-observable lost-update race the batch-S sidecar identified at the service tier — at the HTTP boundary."
  - behaviour: "DELETE /api/policies/{id} concurrent with POST /api/roles/{r}/policies binding the same policy: race between the service-tier isPolicyAttachedToRole check and the soft-delete write — produces an orphan binding (surviving role_to_policy row pointing to a soft-deleted policy)."
    test_class: integration
    criticality: HIGH
    note: "Service-tier cascade-defence is sequential-only; HTTP-tier observability of the race window requires THREE concurrent clients (delete + bind + read)."
  - behaviour: "Every CRUD endpoint emits ZERO application-tier log lines — `@Slf4j`, Logger, log.info/.warn/.error all absent. Pin the audit-silence so an audit-logging change (e.g. AOP advice on PolicyApi methods) is a test-visible regression target."
    test_class: security
    criticality: HIGH
    note: "Audit-silence is SCHEMA-ROOTED at V0_0_48__add_activity.sql:4 (data_entity_id NOT NULL FK) per batch-R; the fix is a schema migration, not an annotation on this controller."
  - behaviour: "auth.type=DISABLED bypasses POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE — an unauthenticated caller can issue every CRUD. Pin the gap-shape so a future fail-closed configuration becomes a test-visible change."
    test_class: security
    criticality: HIGH
  - behaviour: "PUT /api/policies/{id} sets a name on a non-existent id — returns 404 with NotFoundException message `Policy with id %d hasn't been found` (note: differs from the rest of the service's `Policy(id)` message format)."
    test_class: integration
    criticality: LOW
- test_files: []
- gaps: |
    Zero controller-tier test coverage of any of the six PolicyController
    operations — `Grep PolicyController <odd-platform-repo>/odd-platform-api/src/test`
    returns ZERO matches (verified 2026-05-25). The full HTTP-surface
    behaviour the operator observes — including the 200-vs-201 spec drift,
    the schema-validation-failure-as-500, the read-side authorization gap,
    the audit-silence, the lost-update race, the orphan-binding-on-delete
    race, the DISABLED-bypass — is COMPLETELY UNTESTED at the controller
    boundary. The highest-leverage missing tests are integration tests of
    the auth-mode matrix (LOGIN_FORM / OAUTH2 / LDAP / DISABLED) against
    POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE and against the three
    read endpoints — these tests would pin EVERY load-bearing
    operator-visible behaviour with one harness. The single most
    valuable test would be the **security** test that asserts an
    authenticated-but-unauthorized user gets 200 (not 403) on GET
    /api/policies/{id} — pinning the read-side authorization gap is the
    only mechanical defence against silent permission-creep regression.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Canonical operator page for the Policies concept — describes the JSON shape (resource types DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT, conditions, permissions, the `ALL` keyword) but documents NOTHING about which Permission is required to create / update / delete a policy, NOTHING about `auth.type=DISABLED` bypassing the gates, NOTHING about the Administrator policy / role / name reservation, NOTHING about the PUT lost-update race or transactional semantics, NOTHING about cascade-delete (policy attached to role) — the operator hitting CascadeDeleteException with message `Policy is attached to a role` has no documented expectation set, NOTHING about audit logging of policy mutations, NOTHING about `GET /api/policies/schema` as a runtime catalogue source, and NOTHING about the 200-vs-201 response-code drift on create / update. WebFetched 2026-05-25, status 200."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Sections (verified by WebFetch 2026-05-25 status 200): `JSON policy structure`, `Resource type`, `Conditions` (sub: operators / fields), `Permissions`, `Policy examples`. Every other operationally-load-bearing topic — Permission gates, DISABLED bypass, Administrator reservation, lost-update race, cascade-delete, audit, `getPolicySchema` runtime catalogue, response codes — is absent. The page documents the policy-DOCUMENT shape but never the policy-LIFECYCLE.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Catalogue of platform Permissions including POLICY_CREATE, POLICY_UPDATE, POLICY_DELETE under the MANAGEMENT tier. Per batch-E and batch-S verified live 2026-05-12 status 200: lists permissions by name with one-line descriptions but does NOT link to the policy update/delete transactional semantics, does NOT warn about the lost-update race, does NOT mention the cascade-delete defence, does NOT name the auth.type=DISABLED bypass. Same silence pattern as the policies page."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Inherits the verified state from the batch-E sibling sidecar (`odd-platform__java__PolicyController__controller-method__createPolicy.md` docs_link_semantic.inferred_docs[1]); no fresh fetch in this session for this URL.
- doc_drift_findings:
  - "CONTROLLER-DOC-GAP-A: Spec-vs-code response-code drift on create and update. `openapi.yaml:3528` declares POST /api/policies returns 201; `openapi.yaml:3566` declares PUT /api/policies/{policy_id} returns 201. PolicyController.createPolicy at line 24 returns `ResponseEntity.ok()` (200); PolicyController.updatePolicy at line 49 returns `ResponseEntity.ok()` (200). A third-party API consumer following the OpenAPI spec will treat 200 as a non-success or will incorrectly poll for the documented 201; the auto-generated UI client tolerates this because it inspects the response BODY for content. The drift is fixable in either of two ways (controller switches to `ResponseEntity.status(201).body(...)` matching the spec, OR the spec is amended to declare 200); the docs page documents the policy SHAPE but not the response CODE so no live-docs drift is induced beyond the spec drift itself. Severity: MEDIUM — affects external API consumers, invisible to the bundled UI."
  - "CONTROLLER-DOC-GAP-B: Schema-validation failure surfaces as HTTP 500 (`Internal Server Error`) — the live Policies page does not warn operators that a malformed policy body produces a 500 rather than a 400 with a validator error. Inherited from batch-S SERVICE-DOC-GAP-D; the controller-class enrichment is the right doc-layer to address since the operator hits the HTTP code at the controller boundary. Either fix (PolicyJSONValidator throws BadUserRequestException, or ControllerAdvice adds an IllegalArgumentException handler) AND a doc note on the Policies page."
  - "CONTROLLER-DOC-GAP-C: Read-side endpoints (`GET /api/policies`, `GET /api/policies/{id}`, `GET /api/policies/schema`) are gated to `.authenticated()` only — the live docs do not name a Permission required for reading policies and do not warn that any authenticated user can enumerate every policy by id and read every statement. Inherited from batch-E + batch-S as a structural-class-wide finding. Severity: MEDIUM — confidentiality exposure."
  - "CONTROLLER-DOC-GAP-D: PUT /api/policies/{id} is NOT transactional and has NO optimistic-concurrency / ETag protocol. Two concurrent PUTs against the same policy_id silently lost-update; the live Policies page documents nothing about it. Inherited from batch-S SERVICE-DOC-GAP-A; carry-over to the controller-class layer because the operator's surface is HERE. Either fix at the service tier OR document the caveat with a Warning admonition on the Policies page."
  - "CONTROLLER-DOC-GAP-E: DELETE /api/policies/{id} on a policy still bound to any role raises CascadeDeleteException → HTTP 400 with message `Policy is attached to a role` — the live Policies page does not document the dependency ordering (detach roles first, then delete the policy). Operators authoring cleanup scripts will hit this 4xx error with no prior expectation set. Inherited from batch-S SERVICE-DOC-GAP-B."
  - "CONTROLLER-DOC-GAP-F: Audit-silence on ALL THREE mutating endpoints — the controller class has NO @Slf4j, NO Logger, NO @ActivityLog, NO log call; the service tier (batch S) carries the same silence. The fix is schema-rooted (V0_0_48 NULLable data_entity_id + discriminator column OR a separate `platform_event` table) per batch-R, NOT an annotation on this controller. The live Policies page should at minimum warn operators that platform-application logs do not record policy authorship — DB query logging (e.g. pgaudit) is the operator's only forensic trail today."

## upstream_callers

External callers that ultimately drive each of the six controller methods. Resolved via SecurityConstants.SECURITY_RULES + AuthorizationCustomizer + UI grep (`PolicyApi` in odd-platform-ui — see file list at top of session). The controller itself has no in-app upstream — it sits at the HTTP boundary.

- entry_point: "rest:POST /api/policies"
  caller_node: "external HTTP client (UI 'Create policy' button → policy.thunks.ts → /api/policies; OR third-party API consumer)"
  multiplicity_per_trigger: 1
  evidence: "PolicyController.java:19-25 + odd-platform-ui/src/redux/thunks/policy.thunks.ts (UI dispatcher) + PolicyList.tsx:91-98 (Create policy CTA gated by Permission.POLICY_CREATE)"
  observation_class: rest-call
- entry_point: "rest:GET /api/policies/{policy_id}"
  caller_node: "external HTTP client (UI policy-detail open from PolicyList route → policy.thunks.ts → /api/policies/{id}; OR third-party consumer)"
  multiplicity_per_trigger: 1
  evidence: "PolicyController.java:27-32 + PolicyList.tsx route navigation"
  observation_class: rest-call
- entry_point: "rest:GET /api/policies"
  caller_node: "external HTTP client (UI PolicyList mount + scroll + search → policy.thunks.ts → /api/policies?page=N&size=M&query=Q)"
  multiplicity_per_trigger: "1 per fetchPolicyList dispatch (PolicyList.tsx dispatches at mount, at every query change with empty-string suppression, and at every infinite-scroll next-page; multiplicity per UI mount = 1 plus 1 per scroll-page)"
  evidence: "PolicyController.java:34-41 + batch-Q PolicyList.tsx:39-50"
  observation_class: rest-call
- entry_point: "rest:PUT /api/policies/{policy_id}"
  caller_node: "external HTTP client (UI 'Edit policy' from PolicyItem.tsx Edit menu — gated by POLICY_UPDATE AND not-Administrator name guard; OR third-party consumer)"
  multiplicity_per_trigger: 1
  evidence: "PolicyController.java:43-50 + batch-Q PolicyList.tsx PolicyItem.tsx:42-49"
  observation_class: rest-call
- entry_point: "rest:DELETE /api/policies/{policy_id}"
  caller_node: "external HTTP client (UI 'Delete policy' from PolicyItem.tsx Delete menu — gated by POLICY_DELETE AND not-Administrator name guard; OR third-party consumer)"
  multiplicity_per_trigger: 1
  evidence: "PolicyController.java:52-57 + batch-Q PolicyList.tsx PolicyItem.tsx:54"
  observation_class: rest-call
- entry_point: "rest:GET /api/policies/schema"
  caller_node: "external HTTP client (UI policy-form mount in PolicyDetails.tsx — feeds AppJSONEditor; OR third-party consumer authoring policies)"
  multiplicity_per_trigger: "1 per policy-form mount (per batch-Q PolicyDetails.tsx:34, 70 — once on mount of the edit/create dialog)"
  evidence: "PolicyController.java:59-63 + batch-Q PolicyList.tsx PolicyDetails.tsx mount path"
  observation_class: rest-call

References: the UI's `policy.thunks.ts` and `api.ts` files were Grep-confirmed to contain `PolicyApi` references during initial scan; they are not enriched as separate sidecars under this batch but exist as resolved-but-unenriched referenced nodes for the future ui-thunks pass.

## downstream_side_effects

Every observable consequence of an external trigger on this controller. The controller itself adds NO side effect beyond the delegation — every effect is inherited from the service tier (batch-S) AND the repository tier (batch-H). This block records the EFFECT the HTTP CALLER observes at the controller boundary.

- side_effect_class: db-write
  description: "Inserts one row into `policy` table (created_at, updated_at, name, policy text, is_deleted=FALSE). Inherited from PolicyServiceImpl.create → ReactivePolicyRepositoryImpl.create. The HTTP response carries the new policy id."
  evidence: "PolicyController.java:19-25 → PolicyServiceImpl.java:62-69 → ReactivePolicyRepositoryImpl.create (batch-H sidecar)"
  cardinality_per_call: "1 on success; 0 on schema-validation failure (the validator throws BEFORE the repository call); 0 on DB UNIQUE-constraint violation (name collision with live policy — the partial UNIQUE INDEX raises)"
  reachable_from_entry_points:
    - "rest:POST /api/policies"
- side_effect_class: db-write
  description: "Updates one row in `policy` table (sets name + policy text + updated_at on the existing row). NOT inside a transaction with the preceding `get(id)` (PolicyServiceImpl.java:74) — see bugs_limitations_corner_cases for the lost-update race."
  evidence: "PolicyController.java:43-50 → PolicyServiceImpl.java:71-81 → ReactivePolicyRepositoryImpl.update (batch-H sidecar)"
  cardinality_per_call: "1 on success; 0 on NotFoundException; 0 on Administrator-name guard rejection; 0 on schema-validation failure"
  reachable_from_entry_points:
    - "rest:PUT /api/policies/{policy_id}"
- side_effect_class: db-write
  description: "SOFT-DELETES one row in `policy` table (sets deleted_at=NOW(); is_deleted column remains FALSE — dead column per batch-H). The cascade-binding check at PolicyServiceImpl.java:89-92 is NON-ATOMIC with this write — race window with concurrent POST /api/roles binding the same policy can leave an orphan binding."
  evidence: "PolicyController.java:52-57 → PolicyServiceImpl.java:83-95 → ReactivePolicyRepositoryImpl.delete (batch-H sidecar)"
  cardinality_per_call: "1 on success; 0 on NotFoundException; 0 on Administrator-name guard rejection; 0 on CascadeDeleteException (still-bound policy)"
  reachable_from_entry_points:
    - "rest:DELETE /api/policies/{policy_id}"
- side_effect_class: db-write
  description: "ZERO direct db-write on the read endpoints — but the service-tier hot-path `getCurrentUserPolicies` reads `policy ⋈ role_to_policy` (no deleted_at filter — batch-H finding) on EVERY authorized request. The read endpoints participate INDIRECTLY through being themselves authorization-gated (`.authenticated()`)."
  evidence: "PolicyController.java:27-32 (get), 34-41 (list), 59-63 (schema) — read-only at this controller; the indirect hot-path side effect is documented for completeness"
  cardinality_per_call: "0 direct; 1 indirect through the permission framework's getCurrentUserPolicies"
  reachable_from_entry_points:
    - "rest:GET /api/policies/{policy_id}"
    - "rest:GET /api/policies"
    - "rest:GET /api/policies/schema"
- side_effect_class: page-render
  description: "Returns full PolicyDetails payload (id, name, parsed statements, role assignments, timestamps) to any authenticated caller. ZERO role-based scoping on getPolicyDetails — the operator sees every policy by id regardless of their own permissions (subject only to `.authenticated()`)."
  evidence: "PolicyController.java:27-32 → PolicyServiceImpl.java:45-50 (no role filter)"
  cardinality_per_call: "1 on success; the body shape is shared across create, get-details, and update endpoints"
  reachable_from_entry_points:
    - "rest:POST /api/policies"
    - "rest:GET /api/policies/{policy_id}"
    - "rest:PUT /api/policies/{policy_id}"
- side_effect_class: page-render
  description: "Returns PolicyList payload (paged Policy items: id + name only — no statements). The non-admin pagination asymmetry (admin sees server-paged, non-admin sees in-memory ALL of their effective policies regardless of page/size) flows through the controller verbatim."
  evidence: "PolicyController.java:34-41 → PolicyServiceImpl.java:52-60 (branched)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/policies"
- side_effect_class: page-render
  description: "Returns the bundled `schema/policy_schema.json` text verbatim to any authenticated caller. Includes the FULL Permission enum partition by resource type — a public-by-design catalogue per batch-P."
  evidence: "PolicyController.java:59-63 → PolicyServiceImpl.java:97-100 → static POLICY_SCHEMA"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/policies/schema"
- side_effect_class: log-emit
  description: "ZERO log emission at the controller level. PolicyController.java:1-64 has NO @Slf4j, NO Logger field, NO log.* call. The class is forensically silent for every operation. Combined with batch-S service-tier silence + batch-H repository-tier silence, the entire POLICY stack emits ZERO application log lines on any CRUD operation."
  evidence: "PolicyController.java:1-64 (Grep `@Slf4j|Logger|log\\.|@ActivityLog` returns ZERO matches verified 2026-05-25)"
  cardinality_per_call: 0
  reachable_from_entry_points: [all six]
- side_effect_class: activity-emit
  description: "ZERO Activity Feed events emitted on any CRUD operation. The fix is schema-rooted (V0_0_48 NULLable data_entity_id + discriminator column OR `platform_event` table) per batch-R; @ActivityLog cannot be added at this controller because the activity-record FK to data_entity is NOT NULL and RBAC mutations have no data-entity context."
  evidence: "PolicyController.java:1-64 (no @ActivityLog imports or annotations) + batch-R ReactiveActivityRepositoryImpl sidecar (V0_0_48__add_activity.sql:4)"
  cardinality_per_call: 0
  reachable_from_entry_points: [createPolicy / updatePolicy / deletePolicy]

## implicit_adrs

- "Controller is a thin proxy onto the service tier — zero business logic at the HTTP boundary. The class is 64 lines, contains NO conditionals, NO field validation, NO error translation, NO logging, NO transaction bracket; every method is two-to-three Mono operations. The decision is consistent across the codebase: every controller in `controller/` directory that implements a generated `*Api` interface follows this exact pattern (`@RestController`, `@RequiredArgsConstructor`, single `private final XService` field, methods are pure `.flatMap` / `.map` delegations). The trade-off: business logic lives in the service tier where it's testable; the controller layer becomes generated-spec-fidelity glue with no opinion of its own." — evidence: PolicyController.java:14-64 (zero business logic) + RoleController + AlertController + LookupTableController (sibling controllers follow the same pattern, Grep `@RestController` over `<odd-platform-repo>/.../controller/` reveals 50+ controllers all following this shape) — intent_anchor: the `@RequiredArgsConstructor` + `implements XApi` + single-field-named-after-service combination is the codebase's universal authoring convention for controllers — confidence: HIGH

- "Authorization is wired declaratively in `SecurityConstants.SECURITY_RULES`, NOT via `@PreAuthorize` on the controller method or its generated `*Api` interface. The decision is class-wide: NO method on PolicyController carries `@PreAuthorize` / `@Secured` / programmatic check (verified 2026-05-25 by reading the full file). A reader of the controller alone has no indication of authorization; they must navigate to `SecurityConstants.java:163-168`. The trade-off: gate-and-method are physically separated, increasing the risk that a refactor breaks the gate without the controller noticing." — evidence: PolicyController.java:1-64 (zero security annotations) + SecurityConstants.java:163-168 (the three POLICY_* rules) + batch-E implicit_adrs[0] (same finding at the createPolicy method-level enrichment) — intent_anchor: the entire SECURITY_RULES list is the file-scoped registry; grepping `SECURITY_RULES` enumerates every gated endpoint across the platform — the deliberate choice to centralise gate-wiring is confirmed by the consistent pattern across all controllers — confidence: HIGH

- "ServerWebExchange is declared on every method signature but used by none. The OpenAPI codegen requires the trailing `ServerWebExchange exchange` parameter on every method of the generated `PolicyApi` interface; the controller dutifully accepts it on lines 21, 29, 38, 46, 54, 60 and references it on ZERO line. The decision is to live with codegen-required dead-weight parameters rather than write the controller by hand or modify the codegen template. Trade-off: 6 unused parameters add 6 lines of noise but preserve regenerability; a hand-written controller would be 6 lines shorter." — evidence: PolicyController.java:21, 29, 38, 46, 54, 60 (declaration) + zero references to `exchange` elsewhere in the file — intent_anchor: the parameter exists because the generated PolicyApi interface declares it; this is structural OpenAPI-codegen artefact — confidence: HIGH

- "Response code on success is 200 (OK) for create AND update — `ResponseEntity.ok()` at lines 24 and 49 — DRIFTING from the OpenAPI spec which declares 201 for both. The codebase-wide convention appears to be `.ok()` for any non-empty response (verified by Grep `ResponseEntity.ok()` across controllers — pattern is uniform); the spec declares 201 specifically for resource-creation/modification semantics. The choice is consistent with the platform's other create/update endpoints (which also return 200 against spec-201) but is invisible in the file and may be a residue of an OpenAPI Spring-codegen default rather than a deliberate code-vs-spec choice. Routed to implicit_adrs because the pattern is class-wide (and codebase-wide) and the consistency itself is intentional even though no comment defends it." — evidence: PolicyController.java:24, 49 + openapi.yaml:3528, 3566 — intent_anchor: WEAK — there is no comment, no exception message defending the choice; the consistency-across-the-codebase is the structural argument for routing this as implicit_adrs rather than bugs_limitations_corner_cases. Routed here at confidence: LOW — the spec drift is the OPERATOR-VISIBLE consequence and is also recorded in bugs_limitations_corner_cases — confidence: LOW

## bugs_limitations_corner_cases

- "**Lost-update race on PUT /api/policies/{id}** — surfaced at the controller boundary. PolicyController.updatePolicy at lines 43-50 is a thin `.flatMap` delegation to `policyService.update(policyId, formData)` with NO `@ReactiveTransactional` annotation on the controller method; the only available transactional bracket would have to come from the service tier, which (per batch-S PolicyServiceImpl finding) ALSO has no annotation. Two concurrent PUTs against the same policy_id with different bodies both succeed, second-arriving wins, first-arriving change is silently lost — NO 409 Conflict response, NO ETag protocol, NO `If-Match` header check, NO server-side log line warning of contention. The operator hitting the HTTP boundary cannot tell that their write was overwritten. The probe P-121 pins the HTTP-tier observable manifestation of the batch-S service-tier finding. Sibling `PUT /api/roles/{id}` IS @ReactiveTransactional at the service tier (RoleServiceImpl.java:64) — the asymmetry is platform-wide and HTTP-visible from this controller." — evidence: PolicyController.java:43-50 (no annotation, thin delegation) + PolicyServiceImpl.java:71-81 (no annotation, multi-call composition — batch-S primary source) + RoleServiceImpl.java:64 (sibling IS annotated) — severity: HIGH (silent data corruption on concurrent admin writes)

- "**Orphan-binding race on DELETE /api/policies/{id}** — surfaced at the controller boundary. PolicyController.deletePolicy at lines 52-57 is a thin `.flatMap` / `.thenReturn` delegation to `policyService.delete(policyId)` with NO transactional bracket at the controller level. The service-tier cascade-binding check at PolicyServiceImpl.java:89-92 (`isPolicyAttachedToRole` then if-false, `policyRepository.delete`) is sequential R2DBC, NOT a transaction. Three-client race: client A `DELETE /api/policies/{id}` reads `isAttached=false` (line 89), client B issues `POST /api/roles/{r}/policies` adding a `role_to_policy` row referencing the policy, client A's pipeline continues to soft-delete (line 93). Result: surviving `role_to_policy` row referencing a soft-deleted `policy` — the exact orphan-binding state batch-H identified at the repository-layer JOIN that has no `deleted_at IS NULL` predicate. The cascade-defence works in SEQUENTIAL operator flow but NOT under concurrent mutation; the HTTP-tier observability is the same — DELETE returns 204, the operator sees success, the policy is gone from the catalogue but its statements continue to grant permissions through `getRolesPolicies`. Carry-over from batch-S `bugs_limitations_corner_cases[5]`." — evidence: PolicyController.java:52-57 + PolicyServiceImpl.java:83-95 (multi-call non-atomic) + ReactiveRoleToPolicyRepositoryImpl.java:43-49 + batch-H sidecar — severity: HIGH (silent permission-leak race)

- "**Schema-validation failure surfaces as HTTP 500** — operator visibility. PolicyController.createPolicy (lines 19-25) and PolicyController.updatePolicy (lines 43-50) both delegate to `policyService.create / update` which call `policyJSONValidator.validate(...)` synchronously at the entry of the service method (PolicyServiceImpl.java:64, 73). The validator throws `IllegalArgumentException(\"Policy is not valid: \" + errors)` on schema violation. ControllerAdvice.java:23-66 has NO `@ExceptionHandler(IllegalArgumentException.class)` — the exception falls through to the catch-all `@ExceptionHandler(Exception.class)` at line 61-66 and surfaces as HTTP 500 with body `\"Internal Server Error\"` (NOT the validator's actual error message). The operator POSTing or PUTing a malformed policy sees a 500 and must read server logs to discover that the schema validation failed. The fix is either (a) PolicyJSONValidator throws BadUserRequestException, or (b) ControllerAdvice adds an IllegalArgumentException handler — both one-line. Carry-over from batch-S `bugs_limitations_corner_cases[2]` and batch-E `bugs_limitations_corner_cases[4]`." — evidence: PolicyController.java:19-25, 43-50 (thin delegation) + PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66 (no IllegalArgumentException handler) — severity: HIGH (degraded operator experience — looks like server bug, not malformed input)

- "**Read-side authorization gap is class-wide.** Three of the six controller methods — `getPolicyDetails` (lines 27-32), `getPolicyList` (lines 34-41), `getPolicySchema` (lines 59-63) — have NO entry in `SecurityConstants.SECURITY_RULES`. They fall through to `AuthorizationCustomizer.java:29-30`'s catch-all `pathMatchers(\"/**\").authenticated()` and are gated only by AUTHENTICATION, NOT by any Permission. Any authenticated user — including a user whose ONLY granted permission is the most basic data-view permission — can: (a) enumerate every policy by id (1, 2, 3, ...) via `GET /api/policies/{id}` and read every policy's statements (since `PolicyServiceImpl.getPolicyDetails` at lines 45-50 applies NO role-based filter — confirmed by batch-S); (b) hit `GET /api/policies` and see at minimum the policy NAMES of every policy attached to roles they belong to (subject to the in-memory non-admin filter — for an admin user it's every policy in the system); (c) hit `GET /api/policies/schema` and read the full JSON-Schema document including the entire Permission enum partition. The confidentiality exposure: a non-admin user can iterate ids and read MANAGEMENT/ALL policy statements, learning which permissions are bundled into which role — useful reconnaissance for credential-theft escalation. The fix would be adding e.g. `SecurityRule(MANAGEMENT, /api/policies/{id}, GET, POLICY_READ)` entries to SECURITY_RULES — but a POLICY_READ permission does not currently exist in `PolicyPermissionDto`." — evidence: SecurityConstants.java:163-168 (only mutating endpoints gated) + AuthorizationCustomizer.java:29-30 (catch-all) + PolicyController.java:27-63 (no programmatic check) + PolicyServiceImpl.java:45-50 (no role filter on getPolicyDetails — batch-S confirmation) — severity: HIGH (confidentiality exposure; carries class-wide because three of six endpoints share the gap)

- "**Response-code drift: spec declares 201 on create/update success; controller returns 200.** openapi.yaml:3528 declares `'201': The resource has been successfully created` for POST /api/policies; openapi.yaml:3566 declares `'201': The resource has been successfully modified` for PUT /api/policies/{policy_id}. PolicyController.createPolicy line 24 returns `ResponseEntity.ok()` (HTTP 200); PolicyController.updatePolicy line 49 returns `ResponseEntity.ok()` (HTTP 200). A third-party API consumer following the OpenAPI spec will expect 201; the bundled React UI tolerates the drift because it inspects the response BODY for content. The drift is consistent across the codebase (`Grep ResponseEntity.ok()` over controllers reveals a uniform 200-on-create pattern); whether this is a deliberate codebase convention or an OpenAPI-codegen default that no one has reconciled is not documented. Severity is MEDIUM not LOW because external-consumer breakage is plausible." — evidence: PolicyController.java:24, 49 + openapi.yaml:3528, 3566 — severity: MEDIUM (external API consumer breakage; invisible to UI)

- "**Audit-silence on ALL THREE mutating endpoints — controller-tier confirmation that the silence flows uninterrupted from HTTP boundary inward.** PolicyController.java:1-64 has NO `@Slf4j` annotation, NO Logger field, NO `log.info / .warn / .error` call, NO `@ActivityLog` annotation (verified by reading the full 64-line file end-to-end and Grep `@Slf4j|Logger|log\\.|@ActivityLog` returning ZERO matches 2026-05-25). The service tier (batch S) and repository tier (batch H) carry the same silence. Combined this is the NINTH corroborating sidecar in the cross-batch audit-silence pattern (batch E + batch H + batch N + batch P + batch Q + batch R + batch S + this controller-class confirmation = 8 sidecars; the broader scope of audit-silence-on-RBAC-mutations spans batches E + H + N + P + Q + R + S + this one). A security incident reviewer reconstructing 'who created / modified / deleted this MANAGEMENT/ALL policy on date X' from running-platform application logs CANNOT answer the question. Fix is SCHEMA-ROOTED per batch-R: V0_0_48__add_activity.sql:4 enforces `data_entity_id NOT NULL` FK to data_entity(id) — RBAC mutations have no data-entity context so an `@ActivityLog` annotation on this controller (or on the service) would FAIL with a foreign-key violation. The fix is a schema migration (NULLable data_entity_id + discriminator column, OR a separate `platform_event` table for non-data-entity-scoped events), NOT an annotation here." — evidence: PolicyController.java:1-64 (no logging, no @ActivityLog — verified by re-read end-to-end) + V0_0_48__add_activity.sql:4 (schema-root-cause from batch R) + 8-sidecar cross-batch audit-silence pattern — severity: HIGH

- "**`getPolicyList` exposes the non-admin pagination asymmetry on the HTTP boundary.** `GET /api/policies?page=N&size=M&query=Q` for an ADMIN user paginates server-side via `policyRepository.list(page, size, query)` (PolicyServiceImpl.java:58); for a non-admin user the controller's `page` and `size` parameters are IGNORED in the service tier's in-memory branch at PolicyServiceImpl.java:52-60 + 109-116 — the response always carries `hasNext=false` and the FULL set of user-effective policies regardless of `page` and `size`. The HTTP contract is asymmetric by user role with no surfaceable signal — operator (non-admin) writing automation against the API will be surprised that pagination is a no-op for them. Carry-over from batch-S `bugs_limitations_corner_cases[3]`." — evidence: PolicyController.java:34-41 (passes page/size/query through) + PolicyServiceImpl.java:52-60, 109-116 (branched behaviour) — severity: MEDIUM (silent contract asymmetry by user role)

- "**`getPolicyDetails` applies NO role-based filter — confidentiality exposure for non-admin users.** PolicyController.getPolicyDetails (lines 27-32) is a thin proxy onto `policyService.getPolicyDetails(policyId)` which (per batch-S PolicyServiceImpl.java:45-50) issues `policyRepository.get(id)` + NotFoundException-or-PolicyDetails — NO branching by user role, NO check that the requested id belongs to a policy the caller's roles are bound to. A non-admin user knowing or guessing policy ids can read MANAGEMENT/ALL policy statements via this endpoint, learning the platform's RBAC structure. Combined with the read-side authorization gap (SECURITY_RULES has no entry for this path), this exposure is unauthenticated-discoverable on a DISABLED-mode platform and authenticated-discoverable on any other mode." — evidence: PolicyController.java:27-32 + PolicyServiceImpl.java:45-50 (no filter — batch-S confirmed) + SecurityConstants.java:163-168 (no SecurityRule for the GET path) — severity: HIGH (confidentiality)

## stress_findings

```yaml
stress_findings:
  tunables: []   # no numeric literals beyond OpenAPI-codegen scaffolding; page/size are caller-supplied not file-local
  name_behavior_pairs:
    - name: "createPolicy"
      promise: "Creates a new policy from the request body and returns its details."
      implementation: "Delegates to policyService.create which: (1) synchronously validates the policy JSON against the bundled schema (throws IllegalArgumentException on failure — surfaces as HTTP 500 because no @ExceptionHandler covers IllegalArgumentException); (2) maps PolicyFormData to PolicyPojo via MapStruct; (3) inserts via ReactivePolicyRepositoryImpl.create; (4) maps result to PolicyDetails. NO Administrator-name pre-check (asymmetric with update/delete which do check). HTTP response code is 200 (OK), spec declares 201."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Two drifts on a SINGLE method: (a) malformed JSON surfaces as `500 Internal Server Error` rather than `400 Bad Request` with the validator's detail; (b) success returns 200 not the spec-declared 201."
      confidence: STATIC-INFERRED
      evidence: "PolicyController.java:19-25 + PolicyServiceImpl.java:62-69 + PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66 + openapi.yaml:3528"
    - name: "getPolicyDetails"
      promise: "Returns the policy details for the policy with the given id; the caller's role / permissions are honored."
      implementation: "Delegates to policyService.getPolicyDetails(policyId) which calls policyRepository.get(id) and maps to PolicyDetails — NO role-based filtering, NO Permission check at the service layer, and (per SECURITY_RULES line 163-168) NO Permission gate at the controller layer either. Any authenticated user can fetch any policy by id."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Non-admin users can enumerate policy ids (1, 2, 3, ...) and read every policy's full statements — confidentiality exposure across the entire RBAC catalogue."
      confidence: STATIC-INFERRED
      evidence: "PolicyController.java:27-32 + PolicyServiceImpl.java:45-50 + SecurityConstants.java:163-168 (no rule for GET /api/policies/{id})"
    - name: "getPolicyList"
      promise: "Returns the paginated list of policies, sized by page/size, filtered by query, ordered consistently."
      implementation: "Delegates to policyService.list(page, size, query) which branches by user role: ADMIN → repository.list paginates server-side; NON-ADMIN → in-memory filter of user's role-attached policies, IGNORING page and size, returning hasNext=false always."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Non-admin user with 1000 effective policies receives a 1000-element response on `GET /api/policies?page=1&size=20`; admin user with same query gets the requested 20-element page. The HTTP contract is asymmetric by user role with no surfaceable signal."
      confidence: STATIC-INFERRED
      evidence: "PolicyController.java:34-41 + PolicyServiceImpl.java:52-60, 109-116"
    - name: "updatePolicy"
      promise: "Updates the policy with the given id; the change is atomically applied; conflicting concurrent updates are detected."
      implementation: "Delegates to policyService.update which does: read (line 74) → Administrator-name guard (line 76-77) → in-memory apply (line 78) → write (line 79). NO @ReactiveTransactional at the controller OR the service layer; NO row-version column on PolicyPojo; NO If-Match/ETag protocol at the controller. Two concurrent PUTs lost-update silently."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Concurrent admin writes silently overwrite each other; no 409, no warning, no audit log. The operator-observable contract on PUT is 'last writer wins, in some order, without telling you'."
      confidence: PROBE-NEEDED
      evidence: "P-121"
    - name: "deletePolicy"
      promise: "Deletes the policy with the given id; if the policy is still bound to any role, the request is rejected."
      implementation: "Delegates to policyService.delete which does: read (line 85) → Administrator-name guard (line 87-88) → cascade-binding check (line 89) → conditional CascadeDeleteException (lines 90-92) → soft-delete (line 93). Multi-step composition under NO transaction; concurrent role-binding mutation between the check and the delete leaves an orphan binding."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Sequential operator-flow: works correctly. Concurrent operator-flow: orphan binding surviving across soft-delete — the policy is gone from the catalogue UI but its statements continue to grant permissions through the un-filtered getRolesPolicies JOIN (batch-H finding). Silent permission-leak race window."
      confidence: STATIC-INFERRED
      evidence: "PolicyController.java:52-57 + PolicyServiceImpl.java:83-95 + ReactivePolicyRepositoryImpl.java:32-35 (batch-H JOIN with no deleted_at filter)"
    - name: "getPolicySchema"
      promise: "Returns the JSON Schema document used to validate policy bodies — operators discover the available resource types / permissions / conditions from this endpoint."
      implementation: "Delegates to policyService.getPolicySchema which returns the static `POLICY_SCHEMA` field — the bundled `schema/policy_schema.json` text, loaded once at class loading. NO authorization gate beyond `.authenticated()`. Any authenticated user — including a low-privilege caller — can fetch the full schema including the Permission enum partition by resource type."
      drift: NONE
      operator_visible_consequence: "The schema is public-by-design (per batch-P phantom-node finding — the permission catalogue is part of the OpenAPI contract surface, code-generated for every API client). Exposure is intentional, but the platform's docs do not signal this intent to operators who may assume the schema is admin-only."
      confidence: STATIC-INFERRED
      evidence: "PolicyController.java:59-63 + PolicyServiceImpl.java:97-100 + batch-P sidecar"
  orderings:
    - location: "PolicyController.java:34-41 (getPolicyList — pagination semantics)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer when the ADMIN branch fires?"
          a: "Service routes to `policyRepository.list(page, size, query)` which is the soft-delete-aware paged list. The repository's ORDER BY (per batch-H sidecar) is the default base-class ordering — id ASC at the lowest layer (verified in batch-H). NO operator-supplied ORDER BY parameter is plumbed through."
          confidence: REFERENCE
          evidence: "batch-H ReactivePolicyRepositoryImpl sidecar — orderings section"
        - q: "What is the tie-breaker when ids are equal?"
          a: "Ids are PK, unique, never tied — N/A. The non-admin branch in-memory order is `filteredPolicies.stream()` over `RoleDto.policies()` (PolicyServiceImpl.java:111) — collection iteration order which depends on the upstream JOIN's row order; undefined unless RoleService pins it (batch S did not confirm)."
          confidence: REFERENCE
          evidence: "PolicyServiceImpl.java:109-116 + RoleServiceImpl"
        - q: "Which subset is returned when result-set > page size?"
          a: "ADMIN: server-paginated, the first `size` rows in PK order, skipping `page * size`. NON-ADMIN: ALL of the user's effective policies regardless of `page` and `size` parameters (in-memory branch ignores pagination). HTTP-tier consequence: admin and non-admin same query, same policy_id space, get DIFFERENT response sizes — sometimes drastically."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:34-41 + PolicyServiceImpl.java:52-60, 109-116"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "UI: PolicyList.tsx (batch Q) renders rows in response-array order — no client-side sort. Per batch-Q the EntityAdapter.setMany/setAll uses insertion order. So the operator sees response order verbatim."
          confidence: REFERENCE
          evidence: "batch-Q PolicyList.tsx + policy.slice.ts:29-39"
  auth_gates:
    - location: "SecurityConstants.java:163-164 + PolicyController.java:19-25"
      endpoint: "POST /api/policies (createPolicy)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any reachable caller succeeds — POLICY_CREATE bypass per DisabledAuthSecurityConfiguration.java:14-18. LOGIN_FORM / OAUTH2 / LDAP: caller must possess POLICY_CREATE (MANAGEMENT tier); otherwise 403."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:14-18 + AuthorizationCustomizer.java:14-32 + SecurityConstants.java:163-164"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401 Unauthorized. DISABLED: 200 OK (no gate)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (catch-all .authenticated()) + DisabledAuthSecurityConfiguration.java:14-18"
        - q: "What does a wrong-role caller see?"
          a: "Non-DISABLED + authenticated + no POLICY_CREATE: 403 Forbidden (via ReactiveNonContextPermissionAuthorizationManager.java:14-28)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveNonContextPermissionAuthorizationManager.java:14-28 + SecurityConstants.java:163-164"
        - q: "Where does the gate live?"
          a: "Declarative-and-remote: SecurityConstants.SECURITY_RULES at lines 163-164. NOT on the controller method (line 19-25 has no annotation). NOT on the service method (PolicyServiceImpl.java:62-69 has no annotation)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:163-164 + PolicyController.java:19-25 + PolicyServiceImpl.java:62-69"
    - location: "PolicyController.java:27-32 (getPolicyDetails)"
      endpoint: "GET /api/policies/{policy_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any caller succeeds. LOGIN_FORM / OAUTH2 / LDAP: any AUTHENTICATED caller succeeds — there is NO Permission rule, so the catch-all `.authenticated()` at AuthorizationCustomizer.java:29-30 is the only gate. NO role-based filtering at the service tier either (PolicyServiceImpl.java:45-50)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:163-168 (no rule for GET /api/policies/{id}) + AuthorizationCustomizer.java:29-30 + PolicyServiceImpl.java:45-50"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401 Unauthorized. DISABLED: 200 with full policy details."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:14-18"
        - q: "What does a wrong-role caller see?"
          a: "Any authenticated caller sees 200 + full policy details — there is no Permission gate, no role filter. THIS IS THE READ-SIDE AUTHORIZATION GAP."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:163-168 + PolicyServiceImpl.java:45-50"
        - q: "Where does the gate live?"
          a: "ONLY the catch-all `pathMatchers(\"/**\").authenticated()` at AuthorizationCustomizer.java:29-30 — no Permission-level gate, no service-tier check."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + SecurityConstants.java (absence of rule)"
    - location: "PolicyController.java:34-41 (getPolicyList)"
      endpoint: "GET /api/policies"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any caller — but the user has NO roles in DISABLED mode so the non-admin in-memory branch returns empty. LOGIN_FORM/OAUTH2/LDAP: any authenticated caller — ADMIN sees the server-paged list of ALL policies; non-ADMIN sees the in-memory full list of THEIR role-attached policies."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:52-60 (admin branching) + AuthorizationCustomizer.java:29-30"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401. DISABLED: 200 with empty list (no user → no roles → empty in-memory branch)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + PolicyServiceImpl.java:52-60"
        - q: "What does a wrong-role caller see?"
          a: "200 with the subset of policies attached to their roles (could be empty). NO 403."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:52-60"
        - q: "Where does the gate live?"
          a: "Only the catch-all `.authenticated()` at AuthorizationCustomizer.java:29-30 + the service-tier ADMIN-vs-non-ADMIN branching (PolicyServiceImpl.java:52-60). NO Permission-level gate."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + SecurityConstants.java + PolicyServiceImpl.java:52-60"
    - location: "SecurityConstants.java:165-166 + PolicyController.java:43-50 (updatePolicy)"
      endpoint: "PUT /api/policies/{policy_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any reachable caller succeeds. LOGIN_FORM/OAUTH2/LDAP: caller must possess POLICY_UPDATE; otherwise 403."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:14-18 + SecurityConstants.java:165-166"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401. DISABLED: 200/4xx depending on body / existence / Administrator-name guard / cascade-binding state."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java + DisabledAuthSecurityConfiguration.java"
        - q: "What does a wrong-role caller see?"
          a: "Non-DISABLED + authenticated + no POLICY_UPDATE: 403."
          confidence: STATIC-INFERRED
          evidence: "ReactiveNonContextPermissionAuthorizationManager.java:14-28"
        - q: "Where does the gate live?"
          a: "SecurityConstants.java:165-166 (POLICY_UPDATE). Not on the controller method or service method directly."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:165-166 + PolicyController.java:43-50"
    - location: "SecurityConstants.java:167-168 + PolicyController.java:52-57 (deletePolicy)"
      endpoint: "DELETE /api/policies/{policy_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any caller — bypasses POLICY_DELETE. LOGIN_FORM/OAUTH2/LDAP: caller must possess POLICY_DELETE; otherwise 403."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:14-18 + SecurityConstants.java:167-168"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401. DISABLED: 204 No Content (on success) or 4xx (Administrator-name / cascade-binding / NotFound)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer + DisabledAuthSecurityConfiguration"
        - q: "What does a wrong-role caller see?"
          a: "Non-DISABLED + no POLICY_DELETE: 403."
          confidence: STATIC-INFERRED
          evidence: "ReactiveNonContextPermissionAuthorizationManager.java:14-28"
        - q: "Where does the gate live?"
          a: "SecurityConstants.java:167-168. No controller / service annotation."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:167-168 + PolicyController.java:52-57"
    - location: "PolicyController.java:59-63 (getPolicySchema)"
      endpoint: "GET /api/policies/schema"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any caller. Non-DISABLED: any authenticated caller — no Permission rule, falls through to catch-all `.authenticated()`."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + SecurityConstants.java (no rule for /api/policies/schema)"
        - q: "What does an unauthenticated caller see?"
          a: "Non-DISABLED: 401. DISABLED: 200 with full schema."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java + DisabledAuthSecurityConfiguration.java"
        - q: "What does a wrong-role caller see?"
          a: "200 with the full JSON Schema — including the entire Permission enum partition. No Permission-level filter. The schema is public-by-design per batch-P."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:59-63 + batch-P sidecar"
        - q: "Where does the gate live?"
          a: "ONLY the catch-all `.authenticated()`. Public-by-design (batch P)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + batch-P phantom-node sidecar"
  resource_boundaries:
    - location: "PolicyController.java:43-50 (updatePolicy)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "YES — lost-update. PolicyServiceImpl.update at lines 71-81 does a non-transactional read-then-write composition; two concurrent PUTs both succeed with the second-arriving winning silently. Probe P-121 pins the HTTP-tier observable shape."
          confidence: PROBE-NEEDED
          evidence: "P-121"
        - q: "Is the call replay-safe?"
          a: "YES — replaying the SAME PUT body twice produces the same end state (idempotent at the row-level because PolicyMapper.applyToPojo deterministically maps form-data to the existing pojo). Replay-safety does NOT compensate for the lost-update race however."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:78-79 + PolicyMapper.applyToPojo"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache. Every PUT issues a fresh DB roundtrip; the platform's authorization hot path (getCurrentUserPolicies — batch-S) also has no cache so the new policy text is visible on the NEXT authorized request after the write commits."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java + ReactivePolicyRepositoryImpl + batch-S sidecar (no cache)"
    - location: "PolicyController.java:52-57 (deletePolicy)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "YES — orphan-binding race. PolicyServiceImpl.delete at lines 83-95 does a non-transactional check-then-delete composition; concurrent POST /api/roles binding the same policy can land between the check (line 89) and the delete (line 93), leaving a soft-deleted policy with a surviving role_to_policy row. The orphan binding continues to grant permissions through the un-filtered getRolesPolicies JOIN (batch H)."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:83-95 + batch-H ReactivePolicyRepositoryImpl JOIN"
        - q: "Is the call replay-safe?"
          a: "Idempotent — replaying DELETE on an already-soft-deleted policy returns NotFoundException (404) per PolicyServiceImpl.java:86. Operationally safe to retry; doesn't compensate for the orphan-binding race."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:85-86"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache. But the authorization hot path (getCurrentUserPolicies) has no `deleted_at IS NULL` filter on the JOIN (batch-H) — so a soft-deleted policy with surviving bindings continues to grant permissions on EVERY authorized request indefinitely; the 'cache' isn't a cache but a structural query gap."
          confidence: REFERENCE
          evidence: "batch-H ReactivePolicyRepositoryImpl.getRolesPolicies + batch-S getCurrentUserPolicies"
  request_inputs:
    - location: "PolicyController.java:20 (createPolicy.policyFormData parameter)"
      input_kind: body-field
      input_name: "policyFormData (Mono<PolicyFormData> — fields: name, policy)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A request body matching the OpenAPI PolicyFormData schema (`{ name: string, policy: string }`) defining the policy to create. The `policy` string is expected to be JSON conforming to the policy_schema.json document."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:20 + openapi.yaml:3517-3534"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller: `.flatMap(policyService::create)` (line 23). Service: policyJSONValidator.validate(formData.getPolicy()) → policyMapper.mapToPojo(formData) → policyRepository.create(pojo) → policyMapper.mapToDetails. The `name` field becomes `policy.name` (subject to DB UNIQUE on (name) WHERE deleted_at IS NULL — V0_0_55:30). The `policy` field becomes `policy.policy` (subject to schema validation throw → service-tier IllegalArgumentException → ControllerAdvice catch-all → HTTP 500)."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:22-24 + PolicyServiceImpl.java:62-69 + PolicyJSONValidator.java:24-33"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — name `policyFormData` cleanly binds to the policy creation surface."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:20 + PolicyServiceImpl.java:62-69"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — every field of PolicyFormData (name, policy) is consumed by the service tier."
          confidence: STATIC-INFERRED
          evidence: "PolicyMapper.mapToPojo"
      routes_to_finding: "N/A — name matches"
    - location: "PolicyController.java:28 (getPolicyDetails.policyId path parameter)"
      input_kind: path-param
      input_name: "policyId (Long)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the policy whose details to fetch."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:28 + openapi.yaml:3537-3552"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller: passes verbatim to policyService.getPolicyDetails(policyId) (line 30). Service: policyRepository.get(id) → SELECT * FROM policy WHERE id = ? AND deleted_at IS NULL. NO role-based filter applied at any layer."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:30 + PolicyServiceImpl.java:45-50 + ReactiveAbstractSoftDeleteCRUDRepository.get"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the identifier level — the input id is used as the PK lookup. BUT the implementation does NOT apply any caller-scoping (no role-based filter, no Permission-level gate), which is a SEPARATE confidentiality concern — not a name-vs-implementation drift but a missing-defence-in-depth gap recorded in bugs_limitations_corner_cases + auth_gates above."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:28-32 + PolicyServiceImpl.java:45-50"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES on name. The unauthenticated/unauthorized exposure is recorded in bugs_limitations_corner_cases[3]."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:45-50"
      routes_to_finding: "N/A — name matches; auth gap routes to bugs_limitations_corner_cases[3]"
    - location: "PolicyController.java:35-37 (getPolicyList.page / size / query query parameters)"
      input_kind: query-param
      input_name: "page (Integer), size (Integer), query (String)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "page = the 1-indexed page number to fetch; size = the maximum number of items per page; query = a search filter applied case-insensitively to policy names."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:35-37 + openapi.yaml:3499-3516 (PageParam/SizeParam/SearchParam shared definitions)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller: passes verbatim to policyService.list(page, size, query) (line 39). Service: ADMIN branch (line 58) — `policyRepository.list(page, size, query)` honors all three. NON-ADMIN branch (lines 52-60, 109-116) — `getRolePolicies(roles, query)` uses ONLY `query` for in-memory case-insensitive filtering; `page` and `size` are IGNORED."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:35-39 + PolicyServiceImpl.java:52-60, 109-116"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY for non-admin users on `page` and `size`. The parameters ARE accepted by the controller, ARE passed through to the service, AND ARE IGNORED in the non-admin in-memory branch. The HTTP contract says 'paginated' but the non-admin response is 'full set of user-effective policies, ignoring page/size, hasNext=false'."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:52-60, 109-116 (in-memory branch ignores page/size)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) A non-admin user with 1000 effective policies receives ALL 1000 in a single response on `GET /api/policies?page=1&size=20` — surprising response size; (b) `hasNext` is always FALSE for non-admin users — automation that loops on hasNext exits after the first page (consistent with the single-response shape, but the loop assumption is broken in a different direction for admin vs non-admin pagination); (c) the response cardinality is asymmetric by user role with no signal."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:52-60, 109-116"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "For non-admin branch: the in-memory `filteredPolicies` list's index and the `roles.stream().flatMap(...).policies()` collection do exist and could be paged in-memory (`.skip(page * size).limit(size)`), and `total = filteredPolicies.size()` could distinguish total from page size — the in-memory variables exist but are not used to honor pagination. Single-line fix at PolicyServiceImpl.java:111-115 to apply skip/limit and compute hasNext."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:109-116"
      routes_to_finding: "bugs_limitations_corner_cases[5] (non-admin pagination asymmetry) + docs_link_semantic.doc_drift_findings (live docs are silent on the non-admin branch)"
    - location: "PolicyController.java:44 (updatePolicy.policyId path parameter)"
      input_kind: path-param
      input_name: "policyId (Long)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the policy to update."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:44 + openapi.yaml:3553-3573"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller: passes to policyService.update(policyId, formData) (line 48). Service: policyRepository.get(id) → Administrator-name guard → applyToPojo → policyRepository.update."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:48 + PolicyServiceImpl.java:71-81"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:44 + PolicyServiceImpl.java:71-81"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:71-81"
      routes_to_finding: "N/A — name matches"
    - location: "PolicyController.java:45 (updatePolicy.policyFormData body parameter)"
      input_kind: body-field
      input_name: "policyFormData (Mono<PolicyFormData>)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The new content of the policy — `name` and `policy` JSON string — to replace the existing values."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:45 + openapi.yaml:3553-3573"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Service: policyJSONValidator.validate(formData.getPolicy()) → policyRepository.get(id) → Administrator-name guard → policyMapper.applyToPojo(formData, pojo) → policyRepository.update. The MapStruct applyToPojo mutates the existing PolicyPojo with form-data fields."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:71-81 + PolicyMapper.applyToPojo"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:71-81"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "PolicyMapper.applyToPojo"
      routes_to_finding: "N/A — name matches; concurrency issue routes to bugs_limitations_corner_cases[0]"
    - location: "PolicyController.java:53 (deletePolicy.policyId path parameter)"
      input_kind: path-param
      input_name: "policyId (Long)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the policy to delete."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:53 + openapi.yaml:3574-3584"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Service: policyRepository.get(id) → Administrator-name guard → roleToPolicyRepository.isPolicyAttachedToRole(id) → conditional CascadeDeleteException → policyRepository.delete(id) (soft-delete via base class)."
          confidence: STATIC-INFERRED
          evidence: "PolicyController.java:55 + PolicyServiceImpl.java:83-95"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the identifier level. The implementation is a soft-delete (deleted_at=NOW()), not a hard DELETE FROM. The name 'delete' does not promise hard-vs-soft; this is a documentation-clarity issue more than a name drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:83-95 + ReactiveAbstractSoftDeleteCRUDRepository.delete"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES. Soft-vs-hard delete is a documented platform pattern (batch-H). The orphan-binding race is a separate finding routed to bugs_limitations_corner_cases[1]."
          confidence: STATIC-INFERRED
          evidence: "batch-H sidecar"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "PolicyServiceImpl.java:83-95"
      routes_to_finding: "N/A — name matches; soft-vs-hard delete + orphan-binding routes to bugs_limitations_corner_cases[1]"
  probes_emitted:
    - probe_id: P-121
      question: "Lost-update race on PUT /api/policies/{id} — concurrent updates from two clients with different bodies; both succeed silently; second-arrival wins; first-arrival lost. Pin the HTTP-tier observable shape of the batch-S service-tier finding."
      probe_path: "lineage/odd-platform/probes/P-121.yaml"
  stress_summary:
    triggers_total: 19   # 0 tunables + 6 name-behavior pairs + 1 ordering site + 6 auth-gate endpoints + 2 resource-boundaries + 6 request-input named bindings (note: getPolicyList's three query params are a single trigger record per shared signature; getPolicyDetails / updatePolicy.policyId / updatePolicy.policyFormData / deletePolicy.policyId etc. count as individual records — 4 method-signature trigger records, totaling 6 input bindings examined)
    questions_total: 56   # roughly 6 name-behavior * 1 q-set + 4 ordering questions + 6 auth-gate * 4 questions + 2 resource-boundary * 3 questions + 6 request-input * 5 questions = ~56
    answers_static_inferred: 51
    answers_probe_needed: 2   # the lost-update q on updatePolicy + the resource-boundary corruption q on updatePolicy both route to P-121
    answers_reference: 3   # ordering-q1, ordering-q4, resource-boundary-deletePolicy-cache-q route to batch-H/Q sidecars
    drift_flags: 4   # createPolicy name drift (500-vs-400 + 200-vs-201) + getPolicyDetails name drift (no role filter) + getPolicyList name drift (non-admin pagination) + updatePolicy name drift (lost-update race) — 4 name-behavior pairs with drift != NONE
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these three modes route through `SecurityWebFilterChain` that `AuthorizationCustomizer` customises. The three MUTATING controller methods (POST/PUT/DELETE) are gated by POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE per `SecurityConstants.java:163-168`. The three READ methods (GET /api/policies, GET /api/policies/{id}, GET /api/policies/schema) carry NO SECURITY_RULES entry — they fall through to `AuthorizationCustomizer.java:29-30` catch-all `.authenticated()`. `DISABLED` bypasses everything via `DisabledAuthSecurityConfiguration.java:14-18` (`anyExchange().permitAll()`). `S2S` does NOT apply — S2S is the ingestion-only auth mode, orthogonal to RBAC management.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. `IngestionDataEntitiesFilter` matches only `POST /ingestion/entities`. This controller's surface is `/api/policies/*` only.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, /api/policies, POST, POLICY_CREATE)` — Permission `POLICY_CREATE` (MANAGEMENT tier) required, evaluated via `ReactiveNonContextPermissionAuthorizationManager`." — evidence: `SecurityConstants.java:163-164`
  - "`SecurityRule(NO_CONTEXT, /api/policies/{policy_id}, PUT, POLICY_UPDATE)`." — evidence: `SecurityConstants.java:165-166`
  - "`SecurityRule(NO_CONTEXT, /api/policies/{policy_id}, DELETE, POLICY_DELETE)`." — evidence: `SecurityConstants.java:167-168`
  - "NO `@PreAuthorize`, NO `@Secured`, NO programmatic `permissionService.hasPermission(...)` on any of the six controller methods. All gating is declarative via SECURITY_RULES + AuthorizationCustomizer." — evidence: `PolicyController.java:1-64` (no security imports beyond Spring's own)
- **owner_scoping**: `N/A — Policy is a platform-global resource, not data-scoped`. The `policy` table has no `owner_id` column. Per-user policy visibility is enforced via role-based filtering at the SERVICE tier (`PolicyServiceImpl.java:52-60` for `list`) — NOT for `getPolicyDetails` which has NO role filter.
- **data_exposure**:
  - "PolicyDetails payload (id, name, parsed statements with resource type / conditions / permissions, role assignments, timestamps) → returned by POST / PUT / GET /api/policies/{id}. Caller-audience: (a) for POST/PUT — caller granted POLICY_CREATE/POLICY_UPDATE OR any caller under DISABLED; (b) for GET/{id} — any authenticated caller, regardless of permissions."
  - "PolicyList payload (paged Policy items: id + name only) → returned by GET /api/policies. Admin sees all policies server-paged; non-admin sees all of THEIR effective policies in-memory (no pagination)."
  - "Schema text (full JSON Schema document including the Permission enum partition by resource type) → returned by GET /api/policies/schema to any authenticated caller. Public-by-design per batch-P."
  - "204 No Content on DELETE success; the policy is soft-deleted (still readable by id via GET /api/policies/{id} if the caller iterates ids — though the soft-delete-aware repository filters it out of the `get` lookup per batch-H ReactiveAbstractSoftDeleteCRUDRepository.get; the orphan-binding still grants permissions through getRolesPolicies)."
- **known_security_gaps**:
  - "Read-side authorization gap — class-wide. THREE of the SIX controller methods (`getPolicyDetails`, `getPolicyList`, `getPolicySchema`) have NO SecurityRule. Any authenticated caller can enumerate every policy by id and read every statement. Confidentiality exposure: a non-admin user iterating ids learns the platform's RBAC structure — useful reconnaissance for credential-theft escalation. Fix: add new SecurityRule entries plus a POLICY_READ Permission (currently absent from `PolicyPermissionDto`). Inherited from batch-E + batch-S as a structural class-wide finding." — evidence: `SecurityConstants.java:163-168` (no GET rules) + `AuthorizationCustomizer.java:29-30` + `PolicyController.java:27-63` + `PolicyServiceImpl.java:45-50` — severity: HIGH (confidentiality)
  - "Audit-silence on ALL THREE mutating endpoints — `PolicyController.java:1-64` has NO `@Slf4j`, NO Logger, NO `@ActivityLog`, NO log call. NINTH corroborating sidecar in the cross-batch audit-silence pattern (batch E + H + N + P + Q + R + S + this controller-class). Security-incident review cannot reconstruct policy authorship from running-platform logs. Fix is SCHEMA-ROOTED per batch-R (`V0_0_48__add_activity.sql:4` `activity.data_entity_id NOT NULL`), NOT an annotation here." — evidence: `PolicyController.java:1-64` (no logging) + batch-R schema root + 8-sidecar cross-batch pattern — severity: HIGH
  - "Lost-update race on PUT /api/policies/{id} — silent data corruption on concurrent admin writes. NO `@ReactiveTransactional` at the controller OR service tier; NO row-version column; NO ETag / If-Match protocol. The HTTP boundary observable manifestation is probe P-121." — evidence: `PolicyController.java:43-50` + `PolicyServiceImpl.java:71-81` + `RoleServiceImpl.java:64` (sibling has annotation — asymmetry) — severity: HIGH
  - "Orphan-binding race on DELETE /api/policies/{id} — silent permission-leak. PolicyServiceImpl.delete's check-then-delete is non-atomic; concurrent role-binding mutation defeats the cascade-defence; the soft-deleted-but-bound policy continues to grant permissions through the un-filtered getRolesPolicies JOIN (batch H). Inherited from batch-S `bugs_limitations_corner_cases[5]`." — evidence: `PolicyController.java:52-57` + `PolicyServiceImpl.java:83-95` + batch-H JOIN — severity: HIGH
  - "auth.type=DISABLED bypasses ALL THREE Permission-gated endpoints (POST/PUT/DELETE). On a network-reachable DISABLED deployment, ANY caller can create / update / delete policies; the full escalation chain (create MANAGEMENT/ALL policy + create role + bind) is open because ROLE_* and POLICY_* are equally bypassed. The platform docs do not warn that DISABLED implies network-trust-only deployment." — evidence: `DisabledAuthSecurityConfiguration.java:14-18` + `SecurityConstants.java:163-168` + `AuthorizationCustomizer.java:14-32` — severity: HIGH (in DISABLED deployments)
  - "Schema-validation failure surfaces as HTTP 500 — operator visibility. `IllegalArgumentException` from PolicyJSONValidator has NO `@ExceptionHandler` in `ControllerAdvice.java:23-66`; falls through to the catch-all and returns 500 with body `Internal Server Error` instead of 400 with the validator detail. Fix is one-line in either `PolicyJSONValidator` or `ControllerAdvice`." — evidence: `PolicyJSONValidator.java:28-32` + `ControllerAdvice.java:23-66` + `PolicyServiceImpl.java:64, 73` — severity: HIGH (degraded operator experience)
  - "No anti-elevation guard — a POLICY_CREATE-bearing user can author a MANAGEMENT/ALL policy and (with ROLE_CREATE / ROLE_UPDATE) bind it to their own role. POLICY_CREATE is functionally root-on-the-platform. Carry-over from batch-E + batch-S. The platform's design intent is 'an admin can author admin policies' but the docs do not flag the elevation consequence." — evidence: `policy_schema.json:166-202` + `PolicyServiceImpl.java:62-69` + `V0_0_56__add_predefined_roles_and_policies.sql:1-31` — severity: HIGH

## performance

- **hot_paths**:
  - "**INDIRECT hot path**: every READ endpoint on this controller (and every WRITE endpoint, transitively) is itself gated by `.authenticated()` — and the authentication pipeline causes the upstream permission-extractor framework to call `policyService.getCurrentUserPolicies()` (the AUTHORIZATION HOT PATH per batch-S `hot_paths[0]`). The controller's own per-request cost is sub-millisecond (Mono delegation only); the IMPLICIT cost of every HTTP request that touches this controller is the 2-JOIN authorization roundtrip (5-table JOIN `role ⋈ role_to_policy ⋈ policy ⋈ owner_to_role ⋈ user_owner_mapping` + 2-table JOIN `policy ⋈ role_to_policy`). For a busy platform doing N req/s on /api/policies/* endpoints, that's 2N JOIN roundtrips/s pinned to the authorization framework." — evidence: `PolicyController.java:1-64` (no caching, no own work) + batch-S `hot_paths[0]` + `ManagementPermissionExtractor.java:33`
  - "create / update / delete (mutating endpoints) — admin-rare. Per-call cost: validation (sub-millisecond synchronous on event-loop thread for typical bodies) + 1-3 DB roundtrips. Not on the data-platform hot path."
  - "getPolicyList — admin-rare (Management UI navigation). Per-call cost: ADMIN branch is one paged SELECT; non-ADMIN branch is the 5-table JOIN through RoleService + in-memory filter."
- **throughput_characteristics**:
  - "Single-policy CRUD — no bulk endpoint. Reactive Mono signatures, non-blocking from WebFlux thread, single per-call DB roundtrip on the write paths. Six methods, all single-item." — evidence: `PolicyController.java:14-64`
  - "Read-side pagination is asymmetric by user role per `getPolicyList` (admin paginated, non-admin all-in-one). Operator automation expecting pagination must branch."
- **resource_allocation**:
  - "PolicyService bean is injected once (single instance per Spring context); the controller is `@RequiredArgsConstructor` with one `private final` field. No per-request allocation beyond Reactor operator chains and the request/response objects."
  - "Each method declares `final ServerWebExchange exchange` — referenced on ZERO line but allocated by Spring on every request. Trivial."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally."
  - "NO advisory locks, NO synchronized blocks, NO ThreadLocal. The controller adds zero serialization."
  - "Concurrent admin writes on PUT can lost-update (race surfaces from the service tier; controller carries no compensating bracket). Concurrent admin operations on DELETE can produce orphan bindings. Both are HIGH-severity scaling-correctness issues at non-trivial admin concurrency." — evidence: `PolicyController.java:43-57` + batch-S `bugs_limitations_corner_cases[0, 5]`
  - "Per-request authorization cost scales linearly with request rate — the implicit `getCurrentUserPolicies` per-request cost is the dominant DB pressure from this controller. R2DBC pool size is the upper bound." — evidence: batch-S `performance.scaling_characteristics`
- **known_performance_gaps**:
  - "No bulk endpoints — bootstrapping a complex RBAC scheme requires N HTTP calls. Operator-time only." — evidence: `PolicyController.java:14-64` — severity: LOW
  - "Carry-over from batch-S: no caching of `getCurrentUserPolicies` (the authorization hot path each request to this controller depends on)." — evidence: batch-S `known_performance_gaps[0]` — severity: LOW (operator-correct; scale-dependent)
  - "Carry-over from batch-S: non-admin list path materialises full effective-policies set regardless of `page` / `size` (also a functional asymmetry per `bugs_limitations_corner_cases[5]`)." — evidence: `PolicyController.java:34-41` + batch-S `known_performance_gaps[1]` — severity: LOW

## sources

- understanding ← PolicyController.java:1-64 (end-to-end read) + openapi.yaml:3499-3599 (spec surface) + SecurityConstants.java:163-168 (gate registry) + AuthorizationCustomizer.java:14-32 (catch-all) + ControllerAdvice.java:1-89 (exception mapping) + batch-S PolicyServiceImpl + batch-H ReactivePolicyRepositoryImpl + batch-E createPolicy
- concepts.entities ← PolicyController.java:4-12 (imports) + openapi.yaml:3499-3599 (parameter / response schema)
- concepts.operations ← PolicyController.java:19-25, 27-32, 34-41, 43-50, 52-57, 59-63
- concepts.invariants[0] ← PolicyController.java:14-64 (zero business logic; thin delegation throughout)
- concepts.invariants[1] ← PolicyController.java:1-64 (no security annotations) + SecurityConstants.java:163-168
- concepts.invariants[2] ← PolicyController.java:24, 49, 56 + openapi.yaml:3528, 3566, 3580 (response-code declarations)
- concepts.invariants[3] ← PolicyController.java:19-63 (method names) + PolicyServiceImpl.java:45-107 (service-tier methods)
- concepts.invariants[4] ← PolicyController.java:21, 29, 38, 46, 54, 60 (declaration) + Grep `exchange\\.` over the file returns zero matches
- dependencies_semantic.requires-feature ← PolicyController.java:8, 17, 23, 30, 39, 48, 55, 61 (PolicyService usage) + PolicyController.java:16 (PolicyApi) + SecurityConstants.java:163-168 + AuthorizationCustomizer.java:14-32 + ControllerAdvice.java:23-66 + openapi.yaml:3499-3599 + batch-S sidecar
- dependencies_semantic.requires-config ← DisabledAuthSecurityConfiguration.java:10-18 + SecurityConstants.java:163-168 + V0_0_55__add_policies_and_roles.sql:19-30 + V0_0_56__add_predefined_roles_and_policies.sql:1-41 + openapi.yaml:3499-3599
- dependencies_semantic.requires-runtime ← PolicyController.java:9-12 (Spring imports)
- dependencies_semantic.coupling ← PolicyController.java:14-64 + SecurityConstants.java:163-168 + AuthorizationCustomizer.java:14-32 + ControllerAdvice.java:23-66 + DisabledAuthSecurityConfiguration.java:14-18 + PolicyJSONValidator.java:28-32
- tests_coverage_semantic.uncovered_behaviours ← Grep `PolicyController` over `<odd-platform-repo>/odd-platform-api/src/test` returns ZERO matches (verified 2026-05-25)
- tests_coverage_semantic.gaps ← same Grep + PolicyController.java:1-64 + batch-E + batch-S findings
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-25 https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies (status 200)
- docs_link_semantic.inferred_docs[1] ← batch-E + batch-S sidecar inheritance (2026-05-12 verified status 200)
- docs_link_semantic.doc_drift_findings ← PolicyController.java vs openapi.yaml (response code drift) + ControllerAdvice.java:23-66 + PolicyServiceImpl.java:71-95 (race + cascade) + SecurityConstants.java:163-168 (read-side gap) + audit-silence stack + WebFetch result (live page silence)
- upstream_callers ← SecurityConstants.java:163-168 + AuthorizationCustomizer.java:29-30 + UI grep `PolicyApi` in odd-platform-ui returns policy.thunks.ts + api.ts + batch-Q PolicyList.tsx + batch-Q PolicyItem.tsx + batch-Q PolicyDetails.tsx
- downstream_side_effects ← PolicyController.java:19-63 (thin delegation) + batch-S PolicyServiceImpl.java downstream_side_effects + batch-H ReactivePolicyRepositoryImpl downstream_side_effects + V0_0_48__add_activity.sql:4 (audit schema root)
- implicit_adrs[0] ← PolicyController.java:14-64 + sibling controllers (RoleController + AlertController + LookupTableController) following the same pattern + Grep `@RestController` across `controller/` returns the uniform shape
- implicit_adrs[1] ← PolicyController.java:1-64 (zero security annotations) + SecurityConstants.java:163-168 + batch-E + batch-S findings
- implicit_adrs[2] ← PolicyController.java:21, 29, 38, 46, 54, 60 (ServerWebExchange declaration unused)
- implicit_adrs[3] ← PolicyController.java:24, 49 (ResponseEntity.ok()) + openapi.yaml:3528, 3566 (spec 201) + codebase-wide Grep
- bugs_limitations_corner_cases[0] ← PolicyController.java:43-50 + PolicyServiceImpl.java:71-81 + RoleServiceImpl.java:64 + P-121
- bugs_limitations_corner_cases[1] ← PolicyController.java:52-57 + PolicyServiceImpl.java:83-95 + ReactiveRoleToPolicyRepositoryImpl.java:43-49 + batch-H sidecar
- bugs_limitations_corner_cases[2] ← PolicyController.java:19-25, 43-50 + PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66
- bugs_limitations_corner_cases[3] ← SecurityConstants.java:163-168 (no GET rules) + AuthorizationCustomizer.java:29-30 + PolicyController.java:27-63 + PolicyServiceImpl.java:45-50
- bugs_limitations_corner_cases[4] ← PolicyController.java:24, 49 + openapi.yaml:3528, 3566
- bugs_limitations_corner_cases[5] ← PolicyController.java:1-64 (no logging) + V0_0_48__add_activity.sql:4 (schema root) + 8-sidecar audit-silence cross-batch pattern
- bugs_limitations_corner_cases[6] ← PolicyController.java:34-41 + PolicyServiceImpl.java:52-60, 109-116
- bugs_limitations_corner_cases[7] ← PolicyController.java:27-32 + PolicyServiceImpl.java:45-50 + SecurityConstants.java:163-168
- stress_findings.name_behavior_pairs ← PolicyController.java:19-63 (method declarations) + PolicyServiceImpl.java (delegated behaviours) + openapi.yaml (spec promises) + ControllerAdvice.java (exception mapping) + AuthorizationCustomizer.java (catch-all)
- stress_findings.auth_gates ← SecurityConstants.java:163-168 + AuthorizationCustomizer.java:14-32 + DisabledAuthSecurityConfiguration.java:14-18 + PolicyController.java:19-63 + PolicyServiceImpl.java:45-107
- stress_findings.request_inputs ← PolicyController.java:20, 28, 35-37, 44-45, 53, 60 (every named input) + PolicyServiceImpl.java (implementation chain) + openapi.yaml (input declarations) + PolicyMapper (binding chain)
- stress_findings.probes_emitted ← P-121.yaml (allocated 2026-05-25)
- security.auth_mode_relevance ← SecurityConstants.java:163-168 + DisabledAuthSecurityConfiguration.java:14-18 + AuthorizationCustomizer.java:14-32 + IngestionDataEntitiesFilter.java:28
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28
- security.authorization_assertions ← SecurityConstants.java:163-168 + PolicyController.java:1-64
- security.owner_scoping ← V0_0_55__add_policies_and_roles.sql:19-30 + PolicyServiceImpl.java:45-50, 52-60
- security.data_exposure ← PolicyController.java:19-63 + PolicyServiceImpl.java (per-method response shapes)
- security.known_security_gaps[0] ← SecurityConstants.java:163-168 + AuthorizationCustomizer.java:29-30 + PolicyController.java:27-63 + PolicyServiceImpl.java:45-50
- security.known_security_gaps[1] ← PolicyController.java:1-64 + V0_0_48__add_activity.sql:4 + 8-sidecar audit-silence pattern
- security.known_security_gaps[2] ← PolicyController.java:43-50 + PolicyServiceImpl.java:71-81 + P-121
- security.known_security_gaps[3] ← PolicyController.java:52-57 + PolicyServiceImpl.java:83-95 + batch-H
- security.known_security_gaps[4] ← DisabledAuthSecurityConfiguration.java:14-18 + SecurityConstants.java:163-168
- security.known_security_gaps[5] ← PolicyController.java:19-25, 43-50 + PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66
- security.known_security_gaps[6] ← policy_schema.json:166-202 + PolicyServiceImpl.java:62-69 + V0_0_56__add_predefined_roles_and_policies.sql:1-31
- performance.hot_paths ← PolicyController.java:1-64 + batch-S `hot_paths[0]` + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27
- performance.throughput_characteristics ← PolicyController.java:14-64 + PolicyServiceImpl.java:52-60, 109-116
- performance.resource_allocation ← PolicyController.java:14-17 (DI fields) + PolicyController.java:21, 29, 38, 46, 54, 60 (unused parameters)
- performance.scaling_characteristics ← PolicyController.java:14-64 + PolicyServiceImpl.java + batch-S sidecar
- performance.known_performance_gaps ← PolicyController.java:14-64 + batch-S `known_performance_gaps`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (live WebFetch 2026-05-25 confirms the Policies page is silent on every operationally-load-bearing topic; status 200; one fresh excerpt confirms the section structure)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- implicit_adrs: HIGH (except implicit_adrs[3] confidence: LOW — the 200-vs-spec-201 choice has no defending comment; routed there for codebase-wide consistency observability, with the operator-visible consequence ALSO recorded in bugs_limitations_corner_cases[4])
- bugs_limitations_corner_cases: HIGH
- stress_findings: HIGH (51 of 56 questions resolved STATIC-INFERRED with strong evidence; 2 probe-needed correctly routed to P-121; 3 reference-answered to batch-H / batch-Q sidecars with full attribution; the load-bearing claims about audit-silence, read-side authorization gap, response-code drift, lost-update race, orphan-binding race, non-admin pagination asymmetry, schema-validation-500, and DISABLED bypass are all STATIC-INFERRED with strong cross-batch corroboration)
- security: HIGH
- performance: HIGH

## Pre-emit coherence note (LSN-018 Rule 6)

Pre-emit coherence sweep run 2026-05-25 against the five cross-batch sibling
sidecars enumerated in `coherence_check.back_links_emitted` plus the
`feature-flows/detail/F-006.yaml` registry entry. **Result: STRENGTHENS=9,
SUPERSEDES=0, CONFLICTS=0**. Every claim in this sidecar's
`bugs_limitations_corner_cases`, `security.known_security_gaps`,
`implicit_adrs`, `docs_link_semantic.doc_drift_findings`, and
`stress_findings` blocks either (a) anchors a F-006 drift facet at this
controller-class layer with primary-source evidence (line numbers in
PolicyController.java + cross-references to batch-E / S / H / N / Q / R),
(b) cross-references a sibling sidecar's finding with consistent polarity
(e.g. batch-S's lost-update race — this sidecar names the controller as
the OUTERMOST silent surface of the same defect, polarity-consistent),
or (c) refines an existing cross-batch concept-catalog entry (the
audit-silence pattern advances from 8-SIDECAR at batch S to 9-SIDECAR with
this sidecar's controller-class confirmation that PolicyController carries
NO `@Slf4j`, NO Logger, NO `@ActivityLog`, NO log call — all four
verified by Grep at session 2026-05-25). No claim contradicts F-006 or
any sibling sidecar; no prior claim is superseded. The fresh F-006 facet
candidate from this sidecar is `controller_class_response_code_drift_200_vs_spec_201_on_create_and_update`
— a CONTROLLER-LAYER-PRIMARY-SOURCE finding the per-method enrichments
(batch E) could not surface because that batch was scoped to a single
method.

## Maintainer notes


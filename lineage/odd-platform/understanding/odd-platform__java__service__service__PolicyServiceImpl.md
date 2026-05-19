---
node_id: "odd-platform java service service:PolicyServiceImpl"
node_kind: service
axis: services
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-I-PolicyServiceImpl
---

# PolicyServiceImpl — semantic understanding

## understanding

The platform's RBAC-policy business-logic bean — every operator action that
touches the `policy` table for create / read / update / delete flows through
here, AND every authorized HTTP request resolves the calling user's effective
permissions through `getCurrentUserPolicies()` at this layer (the hot path
into `policyRepository.getRolesPolicies(...)` at PolicyServiceImpl.java:103-107).
The service owns three invariants the repository does not: (1) the
`Administrator` policy name is reserved against UPDATE and DELETE
(PolicyServiceImpl.java:76, 87) but not against CREATE — the create-side
asymmetry surfaced in batch E is confirmed at the service layer here, not
closed; (2) the policy JSON body is validated against the bundled
`schema/policy_schema.json` (Draft 2019-09) before any persistence call
(PolicyServiceImpl.java:64, 73); (3) a policy cannot be soft-deleted while
any `role_to_policy` row still references it — `CascadeDeleteException` is
raised at PolicyServiceImpl.java:89-92, the SOLE service-layer defence
against the orphan-binding permission leak that batch H established
(`ReactivePolicyRepositoryImpl.getRolesPolicies` does not filter
`deleted_at IS NULL`). None of `create`, `update`, `delete` carries
`@ReactiveTransactional` — a deliberate inconsistency vs RoleServiceImpl
(`RoleServiceImpl.java:50, 64, 77` ALL annotated) — which exposes the
update path's read-then-write at PolicyServiceImpl.java:71-81 as a
classic lost-update race window between two concurrent PUTs on the same
policy id.

## concepts

- entities: [PolicyPojo (jOOQ row record — id, name, policy text, created_at, updated_at, is_deleted, deleted_at), PolicyFormData (API DTO — name + policy JSON string), PolicyDetails (API response DTO — id, name, role assignments, parsed statements, timestamps), Policy (API list-item DTO — id, name), PolicyList (paged Policy items + PageInfo), RoleDto (record of RolePojo + Collection<PolicyPojo> — used to resolve the current user's effective policies in-memory for non-admin list path), POLICY_SCHEMA (the loaded `schema/policy_schema.json` content as a static-final String at PolicyServiceImpl.java:28, 37-43 — held twice in memory: once here as raw text, once as parsed JsonSchema in PolicyJSONValidator)]
- operations: [getPolicyDetails (single-policy READ — PolicyServiceImpl.java:45-50), list (paged READ with administrator-vs-non-administrator branching — PolicyServiceImpl.java:52-60, 109-116), create (validate JSON + INSERT — PolicyServiceImpl.java:62-69), update (validate JSON + READ + Administrator-name guard + write — PolicyServiceImpl.java:71-81), delete (READ + Administrator-name guard + cascade-binding check + soft-delete — PolicyServiceImpl.java:83-95), getPolicySchema (returns the bundled schema text to API consumers — PolicyServiceImpl.java:97-100), getCurrentUserPolicies (hot-path consumer-side function on every authorized request — PolicyServiceImpl.java:102-107)]
- invariants:
  - "Policy bodies are JSON-Schema-validated UNCONDITIONALLY before persistence on BOTH create AND update paths (PolicyServiceImpl.java:64, 73). The validator throws `IllegalArgumentException` on schema failure (PolicyJSONValidator.java:28-32). The throw happens SYNCHRONOUSLY at the entry of the reactive method, BEFORE any Mono is constructed — but Reactor catches synchronous exceptions inside the calling `.flatMap(policyService::create)` (PolicyController.java:23) and converts them to `Mono.error`, so practical propagation works. Anti-pattern: the synchronous throw bypasses any reactive error-handling decorator. Note also the route: `IllegalArgumentException` has NO dedicated `@ExceptionHandler` in `ControllerAdvice.java:23-66`, so it falls through to the catch-all `@ExceptionHandler(Exception.class)` at line 61 — surfaces as HTTP 500 with body `\"Internal Server Error\"`, NOT 400 with the validator's error detail."
  - "The `Administrator` policy name (constant ADMINISTRATOR_POLICY at PolicyServiceImpl.java:29) is reserved against UPDATE and DELETE only — not CREATE. Update raises `BadUserRequestException(\"Administrator policy cannot be updated\")` at line 77; delete raises `BadUserRequestException(\"Administrator policy cannot be deleted\")` at line 88. Create (lines 62-69) has no name-pre-check; the only protection against a duplicate `Administrator` is the DB's `policy_name_unique` partial UNIQUE INDEX (V0_0_55__add_policies_and_roles.sql:30) which raises a translated `UniqueConstraintException` ONLY while the seeded Administrator row is live (`deleted_at IS NULL`). The reservation asymmetry is identical at this layer to what batch E captured at the controller layer — confirmed primary-source: the gap lives in this file."
  - "Cascade-binding check on delete is the SOLE defence against the orphan-binding permission leak. PolicyServiceImpl.java:89-92 issues `roleToPolicyRepository.isPolicyAttachedToRole(id)` and raises `CascadeDeleteException(\"Policy is attached to a role\")` if any `role_to_policy` row references the policy. Without this guard the policy would be soft-deleted but its statements would still resolve via `getRolesPolicies` (batch H finding — `ReactivePolicyRepositoryImpl.java:32-35` JOIN has no `policy.deleted_at IS NULL` predicate). The check is correct but lives in service code only — any code path that bypasses the service (a future repository-direct caller, a DB-direct hot-fix UPDATE setting `deleted_at`, a `delete()` refactor that drops this filter) re-opens the gap."
  - "NO `@ReactiveTransactional` on `create` (line 62), `update` (line 71), or `delete` (line 83). The base class's `ReactiveAbstractCRUDRepository.create / update / delete` (ReactiveAbstractCRUDRepository.java:102-105, 107-110, 144-149) are single-statement and self-atomic at the DB layer, but the service-layer COMPOSITION across multiple repo calls — `update`'s `get` then `update` (lines 74, 79), `delete`'s `get` then `isPolicyAttachedToRole` then `delete` (lines 85, 89, 93) — runs WITHOUT a transaction boundary. Side-by-side asymmetry: `RoleServiceImpl.create / update / delete` (RoleServiceImpl.java:50, 64, 77) ARE @ReactiveTransactional. The platform's pattern is therefore inconsistent: roles get the transaction, policies do not."
  - "List path branches by user role IN MEMORY (PolicyServiceImpl.java:52-60). For admin users (`UserProviderRole.ADMIN` = `Administrator` per UserProviderRole.java:9), the `.filter` on line 55-56 fails (the user HAS the Admin role, so `noneMatch` returns false), the Mono empties, and `.switchIfEmpty(Mono.defer(() -> policyRepository.list(page, size, query)))` (line 58) hits the repository's paged list query. For non-admin users, `.map(roles -> getRolePolicies(roles, query))` (line 57) builds an in-memory `Page<PolicyPojo>` from the policies already attached to the user's roles via `RoleDto.policies()` — IGNORING the `page` and `size` request parameters, returning all of the user's effective policies with `hasNext=false` (PolicyServiceImpl.java:109-116). A non-admin user with many policies sees inconsistent pagination semantics vs. an admin."
  - "`getCurrentUserPolicies` (lines 102-107) is the AUTHORIZATION HOT PATH — invoked from `ManagementPermissionExtractor.getNonContextualPermissions` (ManagementPermissionExtractor.java:33) and `AbstractContextualPermissionExtractor.getContextualResourcePermissions` (AbstractContextualPermissionExtractor.java:27) on every authorized HTTP request that traverses the permission framework (i.e. every entry in `SecurityConstants.SECURITY_RULES` except those whose path falls under `WHITELIST_PATHS`). No request-scoped cache, no thread-local memoisation: every authorized request issues a fresh DB roundtrip through the policy↔role_to_policy JOIN."
- audiences: [PolicyController (controller delegate — `POST /api/policies`, `GET /api/policies`, `GET /api/policies/{id}`, `PUT /api/policies/{id}`, `DELETE /api/policies/{id}`, `GET /api/policies/schema`), ManagementPermissionExtractor + AbstractContextualPermissionExtractor (per-request permission resolution — see hot_paths below), platform administrators authoring RBAC policies via UI Management → Access Management, future operators investigating who can grant what]

## dependencies_semantic

- requires-feature:
  - "ReactivePolicyRepository (DI field at line 31) — owns the policy-table CRUD + the `getRolesPolicies` JOIN. See batch-H sidecar `odd-platform__java__repository_reactive__repository__ReactivePolicyRepositoryImpl.md` for the persistence-layer semantics (soft-delete inheritance, partial UNIQUE INDEX, missing deleted_at filter on JOIN)."
  - "ReactiveRoleToPolicyRepository (DI field at line 32) — the service calls ONLY `isPolicyAttachedToRole(id)` (line 89), the binding-existence check used by the cascade-delete defence. The repository (ReactiveRoleToPolicyRepositoryImpl.java:43-49) issues `SELECT EXISTS(SELECT 1 FROM role_to_policy WHERE policy_id = ?)`."
  - "PolicyJSONValidator (DI field at line 33) — the JSON-Schema validation bean. Loads `schema/policy_schema.json` ONCE at construction (PolicyJSONValidator.java:18-22 — V201909 JsonSchemaFactory), runs `jsonSchema.validate(objectMapper.readTree(policyJson))` per request (PolicyJSONValidator.java:24-33). Raises `IllegalArgumentException(\"Policy is not valid: \" + errors)` on non-empty error set."
  - "PolicyMapper (DI field at line 34) — MapStruct-generated converter between PolicyFormData ↔ PolicyPojo ↔ PolicyDetails ↔ Policy (PolicyMapper.java:17-37). `mapToPojo` (create path), `applyToPojo` (update path — @MappingTarget mutates the existing pojo with form-data fields), `mapToDetails`, `mapToPolicy`, `mapToPolicyList`, `mapToPolicyDtos`, `mapToDto` (the last parses the stored `policy` text column into a typed `PolicyDto` via `JSONSerDeUtils.deserializeJson`)."
  - "RoleService (DI field at line 35) — only `getCurrentUserRoles()` is called (line 54, 104). The service builds the current user's `List<RoleDto>` (RolePojo + attached PolicyPojo collection) via `userOwnerMappingRepository.getUserRolesByOwner` (ReactiveUserOwnerMappingRepositoryImpl.java:99-114) — a JOIN over `role ⋈ role_to_policy ⋈ policy ⋈ owner_to_role ⋈ user_owner_mapping`."
  - "OpenAPI-generated PolicyApi interface — implicit; PolicyController implements it. HTTP wiring (path / method / operation id) comes from the spec repo's openapi.yaml, not this file."
- requires-config:
  - "Bootstrap state: V0_0_55__add_policies_and_roles.sql (creates `policy`, `role`, `role_to_policy`, `owner_to_role` tables + the partial unique indexes) AND V0_0_56__add_predefined_roles_and_policies.sql (seeds the `Administrator` policy with `{statements: [DATA_ENTITY/ALL, TERM/ALL, MANAGEMENT/ALL]}`, the `Administrator` and `User` roles, the role-to-policy edge for Administrator). Without the V0_0_56 seed, the literal name `Administrator` used at PolicyServiceImpl.java:29 would have no row to protect — update/delete guards become no-ops but the create-side gap remains."
  - "Classpath: `schema/policy_schema.json` MUST be on the classpath at boot (loaded at PolicyServiceImpl class-loading via `loadPolicySchema()` lines 37-43 — `ClassPathResource(\"schema/policy_schema.json\")`). A missing or unreadable resource raises `RuntimeException` from the static initializer at line 41, which prevents PolicyServiceImpl bean instantiation and fails fast at boot."
  - "Indirect: `auth.type` (one of DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — does not affect this service directly, but governs whether the upstream `AuthorizationCustomizer` enforces POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE on the controller path. Under `auth.type=DISABLED` every authorized callsite into `getCurrentUserPolicies()` still runs but the principal is the synthesised anonymous-admin user (batch-E sidecar capture)."
- requires-runtime:
  - "Spring WebFlux (reactive Mono pipeline)."
  - "Reactor Core (Mono.just, .map, .flatMap, .filter, .switchIfEmpty, .then, .defer)."
  - "networknt json-schema-validator (V201909) — via the PolicyJSONValidator bean."
  - "jOOQ-on-R2DBC for every repository call — the service does not bypass to a blocking JDBC path."
  - "PostgreSQL with the `policy`, `role_to_policy` tables and the `policy_name_unique` partial UNIQUE INDEX present."
- coupling:
  - "Tight coupling to the `Administrator` literal string at PolicyServiceImpl.java:29, 76, 87. Renaming the seeded Administrator policy without simultaneously editing this constant + V0_0_56's INSERT silently disables the update/delete name-protection AND breaks the role's policy resolution (`getCurrentUserRoles` matches on `UserProviderRole.ADMIN.getValue() == \"Administrator\"` — UserProviderRole.java:9 — and the seeded `Administrator` ROLE has the same name as the policy). The double meaning of `Administrator` (a policy NAME AND a role NAME both seeded together with the same string at V0_0_56__add_predefined_roles_and_policies.sql:2, 34) is fragile."
  - "Strong coupling to the `is_deleted` / `deleted_at` soft-delete column choice. The cascade-delete defence at lines 89-92 protects against soft-delete-with-bindings, but ANY direct DB UPDATE setting `policy.deleted_at` bypasses it. There is no DB trigger mirroring the defence at the schema layer (no `ON DELETE / ON UPDATE` cascade between policy.deleted_at and role_to_policy)."
  - "Implicit coupling to `RoleServiceImpl.getCurrentUserRoles` data shape: PolicyServiceImpl.list at lines 52-60 reads `roles -> roles.stream().flatMap(r -> r.policies().stream())` (line 111) expecting `RoleDto.policies()` to be a fully-resolved `Collection<PolicyPojo>` per role. If `userOwnerMappingRepository.getUserRolesByOwner` ever changes shape (e.g. switches from eager JOIN to lazy load), the in-memory list path produces incorrect results silently. No test pins this contract."
  - "The validator's exception class choice (`IllegalArgumentException` vs the project-standard `BadUserRequestException`) couples to `ControllerAdvice.java:23-66` having NO `@ExceptionHandler(IllegalArgumentException.class)` — the request surfaces as HTTP 500 not 400. Operators debugging a malformed policy body cannot tell from the response whether the schema check failed or a server error occurred. Carry-over from batch-E sidecar bugs_limitations_corner_cases[4]."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "create() with a valid PolicyFormData persists a new policy via the repository and returns mapped PolicyDetails."
    test_class: "PolicyServiceImplTest"
  - "create() with an invalid JSON body raises `IllegalArgumentException` from PolicyJSONValidator BEFORE any repository call (verify ordering — repository.create must not be invoked)."
    test_class: "PolicyServiceImplTest"
  - "create() with a body that fails `additionalProperties: false` at the top level (e.g. extra `\"id\": 42` field) raises `IllegalArgumentException` with the validator's error message — pin policy_schema.json:15 invariant."
    test_class: "PolicyServiceImplTest"
  - "create() with `name=\"Administrator\"` SUCCEEDS at the service layer (no name pre-check) — the DB UNIQUE constraint then trips and surfaces as `UniqueConstraintException`. Pin the current (asymmetric) behaviour so a future symmetry-fix is detected."
    test_class: "PolicyServiceImplTest"
  - "update() on a non-existent id raises `NotFoundException(\"Policy with id %d hasn't been found\")` from line 75 — note the message shape differs from `NotFoundException(\"Policy\", id)` used elsewhere (line 48, 86)."
    test_class: "PolicyServiceImplTest"
  - "update() on the seeded Administrator policy id raises `BadUserRequestException(\"Administrator policy cannot be updated\")` from line 77."
    test_class: "PolicyServiceImplTest"
  - "update() validates JSON BEFORE the existence check — verify ordering with a non-existent id AND an invalid body; the validation error wins (the synchronous throw at line 73 fires before the reactive chain starts)."
    test_class: "PolicyServiceImplTest"
  - "update() lost-update race window: two concurrent `update(id, body)` calls for the same policy id, both reading the same v1 row before either writes. Both writes succeed, second wins, first's change is silently lost. Pin the current (race-vulnerable) behaviour so a future `@ReactiveTransactional` fix detects."
    test_class: "PolicyServiceImplConcurrencyTest"
  - "delete() on a non-existent id raises `NotFoundException(\"Policy\", id)` from line 86."
    test_class: "PolicyServiceImplTest"
  - "delete() on the seeded Administrator policy raises `BadUserRequestException(\"Administrator policy cannot be deleted\")` from line 88."
    test_class: "PolicyServiceImplTest"
  - "delete() on a policy attached to any role raises `CascadeDeleteException(\"Policy is attached to a role\")` from lines 89-92 — the orphan-binding defence."
    test_class: "PolicyServiceImplTest"
  - "delete() on a policy with no role bindings succeeds: invokes `policyRepository.delete(id)` (soft-delete via base class) and returns the mapped Policy."
    test_class: "PolicyServiceImplTest"
  - "list() for an Administrator user returns the repository's paged list result (line 58 branch)."
    test_class: "PolicyServiceImplTest"
  - "list() for a non-Administrator user returns the in-memory filtered list of their role-attached policies (lines 57, 109-116) — IGNORING `page` and `size` parameters, `hasNext=false`. Pin the non-admin pagination asymmetry."
    test_class: "PolicyServiceImplTest"
  - "list() for a user with EMPTY roles list: `roles.stream().noneMatch(...)` returns true vacuously, the `.map` branch is taken, `getRolePolicies` returns an empty Page. Verify the user is not silently routed to the admin-only repository path."
    test_class: "PolicyServiceImplTest"
  - "list() with a query string filters case-insensitively (lines 112-113 — `policy.getName().toLowerCase().contains(query.toLowerCase())`)."
    test_class: "PolicyServiceImplTest"
  - "getCurrentUserPolicies() returns the repository's `getRolesPolicies(roleIds)` result for the current user's role-id list (lines 103-107) — verify the empty-role-list short-circuits to `Mono.just(List.of())` (delegated to the repository at ReactivePolicyRepositoryImpl.java:29-31)."
    test_class: "PolicyServiceImplTest"
  - "getCurrentUserPolicies() returns SOFT-DELETED policies that still have surviving role bindings — pin the batch-H repository-level finding at the service-level surface (the service does NOT filter the repository's output)."
    test_class: "PolicyServiceImplTest"
  - "getPolicySchema() returns the bundled `schema/policy_schema.json` content unmodified."
    test_class: "PolicyServiceImplTest"
  - "getPolicyDetails() on a non-existent id raises `NotFoundException(\"Policy\", id)` from line 48."
    test_class: "PolicyServiceImplTest"
  - "The class fails to load if `schema/policy_schema.json` is missing from the classpath (line 41 raises `RuntimeException` from the static initializer)."
    test_class: "PolicyServiceImplClassLoadingTest"
- test_files: []
- gaps: |
    Zero test coverage of any path through PolicyServiceImpl —
    `Grep PolicyService|PolicyServiceImpl <odd-platform-repo>/odd-platform-api/src/test`
    returns ZERO matches (verified 2026-05-19). The only policy-related test
    file in the entire suite is `PolicyDeserializerTest.java` (DTO Jackson
    polymorphism — does not invoke the service). This service is on the
    AUTHORIZATION HOT PATH (every authorized request → `getCurrentUserPolicies`)
    AND on every operator-facing policy CRUD operation. Untested regressions
    that would ship silently: (a) the create-side Administrator-name asymmetry
    being inadvertently closed (good) or widened (bad); (b) the cascade-binding
    defence being dropped — re-opening the orphan-binding permission leak
    (batch H finding); (c) the JSON-schema validator being skipped, e.g. by a
    refactor that moves validation behind a flag; (d) the synchronous
    `policyJSONValidator.validate(...)` throw at lines 64, 73 being routed
    through a `Mono.fromRunnable` chain that swallows the exception; (e) the
    update lost-update race (lines 71-81) being closed (i.e., a maintainer
    adding `@ReactiveTransactional` without realising the new transaction
    semantic breaks a downstream consumer). The highest-leverage missing test
    is the cascade-delete defence — it is the SOLE service-layer protection
    against the orphan-binding security gap identified at the repository
    layer in batch H.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Canonical operator page for the Policies concept — describes the JSON shape (resource types, conditions, permissions, ALL) but documents nothing about update lost-update races, the synchronous validation pattern, the IllegalArgumentException → 500 mapping, the cascade-delete defence, or the Administrator-name CREATE-side asymmetry. Batch E sibling sidecar (PolicyController.createPolicy) verified this page live 2026-05-12, status 200: silent on operator-visible service-layer behaviours, silent on Administrator reservation specifics (gives no warning that the name is reserved at the UPDATE/DELETE layer)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance — WebFetch denied in batch-I session"
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Catalogue of platform Permissions (POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE etc., MANAGEMENT tier). Batch E verified live 2026-05-12, status 200: lists the permissions by name with one-line descriptions but does not link to the policy-update transactional semantics, does not warn about the lost-update race, does not mention the cascade-delete defence."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    last_verified_via: "batch-E sidecar inheritance — WebFetch denied in batch-I session"
    confidence: LOW
- fetched_excerpts: |
    Direct WebFetch was unavailable in this session (Permission to use WebFetch
    has been denied — 2026-05-19). The above doc-link records inherit the
    verified-2026-05-12 state captured in the batch-E sibling sidecar at
    `lineage/odd-platform/understanding/odd-platform__java__PolicyController__controller-method__createPolicy.md`
    docs_link_semantic.inferred_docs[0] and [1], where the policies page and
    permissions page were both confirmed status 200 and confirmed silent on
    service-layer transactional semantics. No fresh excerpts are claimed in
    this sidecar.
- doc_drift_findings:
  - "SERVICE-DOC-GAP-A: The Policies operator page (verified 2026-05-12 batch-E) does not document that `PUT /api/policies/{id}` is NOT transactional — two concurrent updates against the same policy can lost-update silently with no error returned to either caller. The platform's other RBAC mutation surfaces (`RoleServiceImpl.update`) ARE transactional, so the asymmetry is a quirk operators would not expect. Either harden the service (add `@ReactiveTransactional`) and update the docs, or document the contract caveat with a `Warning` admonition."
  - "SERVICE-DOC-GAP-B: The Policies page does not mention the cascade-delete contract — that deleting a policy fails with `CascadeDeleteException(\"Policy is attached to a role\")` if the policy is still bound to any role. Operators authoring automation scripts to clean up policies will hit this 4xx error with no prior expectation set. The error message itself (`\"Policy is attached to a role\"`) is correct and surfaceable; the doc just needs a sentence on the dependency ordering (detach roles first, then delete the policy)."
  - "SERVICE-DOC-GAP-C: The Policies page does not document the Administrator-name CREATE-side asymmetry. The doc does not warn that (a) the name `Administrator` is reserved against UPDATE/DELETE but NOT against CREATE, (b) the only protection against a duplicate `Administrator` is the DB UNIQUE index which fires only while the seeded row is live, (c) if the seeded Administrator row is ever soft-deleted out-of-band, a custom `Administrator` policy with arbitrary statements can be created. Carry-over from batch-E DOC-GAP-D — re-surfaced here because the gap LIVES at the service layer this sidecar enriches."
  - "SERVICE-DOC-GAP-D: Schema-validation failure surfaces as HTTP 500 with body `\"Internal Server Error\"` (because `IllegalArgumentException` falls through `ControllerAdvice.handleServerException` at ControllerAdvice.java:61-66), NOT as HTTP 400 with the validator's detailed error message. The Policies page does not warn that a malformed policy body produces a 500 rather than a 400 — operators debugging will misread the response as a server bug."

## upstream_callers

The exhaustive set of source-code locations that invoke any method on `PolicyService` / `PolicyServiceImpl`. All discovered by `Grep policyService\\.|PolicyService` across `<odd-platform-repo>/odd-platform-api/src/main` (verified 2026-05-19):

- PolicyController.java:30 — `policyService.getPolicyDetails(policyId)` from `getPolicyDetails(Long, ServerWebExchange)` — handles `GET /api/policies/{policy_id}`. No SECURITY_RULES entry for this path (line 28-32) — falls through to the catch-all `pathMatchers(\"/**\").authenticated()` — any authenticated user can read policy details.
- PolicyController.java:39 — `policyService.list(page, size, query)` from `getPolicyList(Integer, Integer, String, ServerWebExchange)` — handles `GET /api/policies`. Likewise no SECURITY_RULES entry — `.authenticated()` only.
- PolicyController.java:23 — `policyService::create` via `.flatMap(policyService::create)` from `createPolicy(Mono<PolicyFormData>, ServerWebExchange)` — handles `POST /api/policies`, gated by SECURITY_RULES at SecurityConstants.java:163-164 (POLICY_CREATE Permission). Batch-E sidecar enriches this method end-to-end.
- PolicyController.java:48 — `policyService.update(policyId, formData)` from `updatePolicy(Long, Mono<PolicyFormData>, ServerWebExchange)` — handles `PUT /api/policies/{policy_id}`, gated by SECURITY_RULES at SecurityConstants.java:165-166 (POLICY_UPDATE Permission).
- PolicyController.java:55 — `policyService.delete(policyId)` from `deletePolicy(Long, ServerWebExchange)` — handles `DELETE /api/policies/{policy_id}`, gated by SECURITY_RULES at SecurityConstants.java:167-168 (POLICY_DELETE Permission).
- PolicyController.java:61 — `policyService.getPolicySchema()` from `getPolicySchema(ServerWebExchange)` — handles `GET /api/policies/schema`. No SECURITY_RULES entry — any authenticated user can fetch the live JSON Schema; carry-over from batch-E known_security_gaps[6].
- ManagementPermissionExtractor.java:33 — `policyService.getCurrentUserPolicies()` from `getNonContextualPermissions()` — invoked by `ReactiveNonContextPermissionAuthorizationManager` to resolve MANAGEMENT-tier permissions on every authorized request whose `SecurityRule.context == NO_CONTEXT`.
- AbstractContextualPermissionExtractor.java:27 — `policyService.getCurrentUserPolicies()` from `getContextualResourcePermissions(long resourceId)` — invoked by `ReactiveResourcePermissionAuthorizationManager` to resolve DATA_ENTITY / TERM / QUERY_EXAMPLE permissions on every authorized request whose `SecurityRule.context != NO_CONTEXT`. The abstract base class is extended by `DataEntityPermissionExtractor`, `TermPermissionExtractor`, `QueryExamplePermissionExtractor` (constructor calls at lines 25-26, 26-27, 31-32 of those files — verified by Grep).

The service has NO non-PolicyController / non-permission-extractor callers — no batch jobs, no message-queue consumers, no startup hooks. The full upstream surface is the controller (admin CRUD) + the permission framework (hot path).

## downstream_side_effects

Every external system the service touches when invoked:

- **PostgreSQL `policy` table (READ)** — `getPolicyDetails`, `list` (admin branch), `update`'s `get(id)` (line 74), `delete`'s `get(id)` (line 85). Inherited from `ReactivePolicyRepositoryImpl` + base class — see batch-H sidecar downstream_side_effects for the SQL shapes.
- **PostgreSQL `policy` table (WRITE — INSERT)** — `create` (line 67). DB-default `created_at`, `updated_at`, `is_deleted` columns populated. The DB enforces `policy_name_unique` partial UNIQUE INDEX (V0_0_55__add_policies_and_roles.sql:30) — collision raises SQLSTATE 23505 translated by `ExceptionUtils.translateDatabaseException` (verified in batch-H sidecar).
- **PostgreSQL `policy` table (WRITE — UPDATE)** — `update` (line 79). NOT inside a transaction with the preceding `get(id)` at line 74 — see invariants[3] and bugs_limitations_corner_cases below. The base updateOne (ReactiveAbstractCRUDRepository.java:162-173) issues `UPDATE policy SET name = ?, policy = ?, updated_at = NOW() WHERE id = ?` (the `getNonUpdatableFields` list strips `id`, `created_at`, and — for soft-delete base — `deleted_at`).
- **PostgreSQL `policy` table (WRITE — SOFT-DELETE)** — `delete` (line 93). Inherited soft-delete from `ReactiveAbstractSoftDeleteCRUDRepository.delete` (lines 50-59) — UPDATE setting `deleted_at = NOW()`, NOT a DELETE FROM. The `is_deleted` boolean column remains FALSE (dead column — batch-H finding).
- **PostgreSQL `role_to_policy` table (READ — EXISTS)** — `delete`'s `isPolicyAttachedToRole(id)` (line 89) issues `SELECT EXISTS(SELECT 1 FROM role_to_policy WHERE policy_id = ?)` via ReactiveRoleToPolicyRepositoryImpl.java:43-49.
- **PostgreSQL `policy ⋈ role_to_policy` JOIN (READ)** — `getCurrentUserPolicies` (line 106) → `policyRepository.getRolesPolicies(roleIds)` → JOIN at ReactivePolicyRepositoryImpl.java:32-35. Invoked on EVERY authorized HTTP request through the permission extractors. NO `deleted_at IS NULL` predicate on the JOIN — batch-H finding inherited here.
- **PostgreSQL `role ⋈ role_to_policy ⋈ policy ⋈ owner_to_role ⋈ user_owner_mapping` JOIN (READ)** — `list` (line 54), `getCurrentUserPolicies` (line 104) BOTH call `roleService.getCurrentUserRoles()`, which delegates to `userOwnerMappingRepository.getUserRolesByOwner(...)` — a 5-table JOIN at ReactiveUserOwnerMappingRepositoryImpl.java:99-114. Materialised twice per authorized request when both `list` and `getCurrentUserPolicies` fire from the same request flow (which they don't currently — but the data dependency is worth flagging).
- **Classpath I/O (CLASS LOAD ONLY)** — `loadPolicySchema()` (lines 37-43) reads `schema/policy_schema.json` ONCE at class loading. Idempotent, no per-request I/O.
- **In-memory operations** — `getRolePolicies(roles, query)` (lines 109-116) — stream / filter / toList of the user's role-attached PolicyPojos. No DB, no I/O. The `Page` constructor at line 115 carries `hasNext = false` regardless of result size.
- **NO outbound HTTP**, **NO file I/O on the request path**, **NO message-queue publication**, **NO metric emission**, **NO audit-log write** (no `log.info` / `log.warn` calls — verified by reading PolicyServiceImpl.java:1-117 end-to-end; the class has no `@Slf4j` annotation, no Logger field, no log call).

The downstream-side-effects picture confirms batch-E + batch-H's RBAC-mutations-are-forensically-silent pattern at THIS layer too: PolicyServiceImpl emits ZERO security-relevant log lines on any of {create, update, delete} a policy. Combined with PolicyController.java:1-65 (also no `@Slf4j`) and ReactivePolicyRepositoryImpl.java:1-40 (also no application-level log lines), the entire controller-service-repository stack for the policy table is forensically silent — a security incident reviewer reconstructing 'who created / updated / deleted this MANAGEMENT/ALL policy on date X' from running-platform logs alone cannot answer the question. They must consult external DB audit (Postgres `pg_audit` if enabled).

## implicit_adrs

- "Service-layer business invariants — Administrator-name reservation, JSON-schema validation, cascade-delete defence — are enforced HERE, not at the repository or DB layer. The repository (ReactivePolicyRepositoryImpl) is intentionally policy-agnostic (batch-H sidecar implicit_adrs[3] confirms this is the consistent pattern across every Reactive*Repository). The choice is consistent with the package layout (`service.*` owns business logic; `repository.reactive.*` owns persistence)." — evidence: PolicyServiceImpl.java:62-95 (validate + name guard + cascade check all in service) + ReactivePolicyRepositoryImpl.java:1-40 (no business invariants in repository) + batch-H sidecar implicit_adrs[3] — intent_anchor: the service file contains EVERY business invariant verbatim; renaming the constant `ADMINISTRATOR_POLICY` at line 29 changes the platform's bootstrap protection — the rule is named and locally citable — confidence: HIGH

- "Policy bodies are validated against a bundled JSON Schema SYNCHRONOUSLY at the entry of `create` and `update`, BEFORE any reactive composition. The decision was to fail fast on malformed input rather than push validation into the Mono pipeline. The trade-off: synchronous throws happen on the WebFlux event-loop thread (cheap for a sub-millisecond schema walk on a typical-size policy), but the throw bypasses any Mono-level retry / fallback decorator." — evidence: PolicyServiceImpl.java:64 (validate called BEFORE `Mono.just(formData)`) + PolicyServiceImpl.java:73 (validate called BEFORE `policyRepository.get(id)` chain) + PolicyJSONValidator.java:24-33 (synchronous parse + validate, throws IllegalArgumentException) — intent_anchor: the validator is invoked OUTSIDE the reactive chain on both methods — a deliberate stylistic choice; the alternative (`Mono.fromCallable(() -> { validator.validate(...); return formData; })`) is structurally available and not used — confidence: MEDIUM (no comment explains the choice; inferred from consistent pattern across both methods)

- "The `Administrator` policy is name-reserved against UPDATE and DELETE but NOT against CREATE — the operator-visible bootstrap admin path is protected against accidental destruction via standard endpoints, but the platform does NOT prevent the creation of a SECOND policy named `Administrator` at the service layer (relying instead on the DB UNIQUE constraint). Batch-E established the asymmetry at the controller-layer-via-service-layer; this sidecar confirms primary-source: the asymmetry IS in PolicyServiceImpl, not a controller-layer omission." — evidence: PolicyServiceImpl.java:29 (constant), 62-69 (create — no name guard), 76-77 (update — name guard + rejection), 87-88 (delete — name guard + rejection) — intent_anchor: the constant `ADMINISTRATOR_POLICY = \"Administrator\"` and the explicit rejection text `\"Administrator policy cannot be updated\"` / `\"...cannot be deleted\"` are the maintainer's surfaced intent; the absence of the same check on `create` is a structural omission — confidence: HIGH (the asymmetry is intentional or oversight; the maintainer-visible behaviour is the contract operators depend on)

- "Cascade-delete is HARD-BLOCKED at the service layer rather than implemented as a cascading cleanup. When the operator tries to delete a policy still bound to any role, the platform raises `CascadeDeleteException(\"Policy is attached to a role\")` — it does NOT auto-detach the bindings. The alternative pattern (silently delete the bindings then soft-delete the policy) was NOT chosen; the operator must explicitly detach via `PUT /api/roles/{role_id}` first. This is the inverse of `RoleServiceImpl.delete` (line 89) which DOES auto-clean role_to_policy edges before deleting the role — a deliberate asymmetry between the two RBAC entities." — evidence: PolicyServiceImpl.java:89-92 (CascadeDeleteException raised) vs RoleServiceImpl.java:89 (`then(roleToPolicyRepository.deleteRoleRelationsExcept(id, List.of()))` — auto-cleanup before delete) + CascadeDeleteException.java:1-7 (project-specific exception type with ErrorCode.CASCADE_DELETE) — intent_anchor: the asymmetric pattern is named via the dedicated `CascadeDeleteException` class and the explicit error message; the operator-visible contract is documented in the rejection text — confidence: HIGH

- "Service composition methods (create, update, delete) are NON-TRANSACTIONAL at this layer, in deliberate inconsistency with the sibling RoleServiceImpl which IS transactional. The base repository's `create` / `update` / `delete` are single-statement and self-atomic at the DB layer, but the service-layer multi-call composition (e.g. `delete` reads existence + binding then soft-deletes) is NOT enclosed in a transaction. The maintainer's intent is ambiguous: either (a) policy lifecycle is rare enough that races are acceptable, or (b) the missing annotation is an oversight. The asymmetry vs RoleServiceImpl argues 'oversight' — there is no defending comment." — evidence: PolicyServiceImpl.java:62 (create — no annotation), 71 (update — no annotation), 83 (delete — no annotation) + RoleServiceImpl.java:50, 64, 77 (`@ReactiveTransactional` on all three) + ReactiveAbstractCRUDRepository.java:102-105, 107-110, 144-149 (base methods un-annotated) + ReactiveAbstractCRUDRepository.java:113, 129 (only bulk* methods carry the annotation) — intent_anchor: WEAK — there is no comment, no exception message, no naming convention defending the absence. The discriminator under the routing test (system-prompt 'Routing examples'): NO comment / annotation / convention defends the absence → this entry is borderline; routing as implicit_adrs because the inconsistency-with-sibling-service is itself observable as a design choice the maintainer either made or missed — but ALSO recorded in bugs_limitations_corner_cases because the OPERATOR-VISIBLE consequence is the lost-update race. Routed here as confidence: LOW; the gap-shape characterisation lives in bugs_limitations_corner_cases — confidence: LOW

## bugs_limitations_corner_cases

- "Lost-update race on `PUT /api/policies/{id}`. PolicyServiceImpl.update at lines 71-81 issues two separate R2DBC calls — `policyRepository.get(id)` (line 74) reads the current row, then `policyRepository::update` (line 79) writes the new row — OUTSIDE any `@ReactiveTransactional`. The race window: client A reads v1 (line 74), client B reads v1 concurrently, client A's mapper applies form-data to the v1 pojo and writes (line 78-79 → v2 success), client B's mapper applies its DIFFERENT form-data to its OWN copy of v1 and writes (line 78-79 → v3 success — but v3 was derived from v1, not v2). Client A's change is silently overwritten. Postgres has no optimistic-concurrency token on the row (no `version` field on PolicyPojo, verified by reading the imports at lines 7-21) and no row-level lock. The sibling `RoleServiceImpl.update` is `@ReactiveTransactional` (RoleServiceImpl.java:64) — even there, the wrapping transaction does not by itself prevent lost-update without `SELECT ... FOR UPDATE` or row-version tracking, but it at least scopes the read+write to a single connection (R2DBC). For PolicyServiceImpl, even the connection-scope guarantee is absent. Severity is MEDIUM rather than HIGH because policy authoring is administrator-rare (typical platform has ~5-20 policies, single admin team), but the silent-lost-update mode is exactly the class of bug that ships unnoticed until a multi-admin operator audit." — evidence: PolicyServiceImpl.java:71-81 (read-then-write under no transaction) + ReactiveTransactional.java:9-13 (the annotation exists and is the wrap mechanism used elsewhere) + ReactiveAbstractCRUDRepository.java:107-110 (base update — un-annotated) + RoleServiceImpl.java:64 (sibling IS annotated) — severity: MEDIUM

- "Administrator-name CREATE-side asymmetry (confirmed PRIMARY-SOURCE at this layer). PolicyServiceImpl.create (lines 62-69) has NO check against `formData.getName().equals(ADMINISTRATOR_POLICY)`. The constant is defined at line 29 and consulted at lines 76, 87 (update / delete), but NOT at line 64-67 (create). The only protection against a duplicate `Administrator` policy is the DB partial UNIQUE INDEX (V0_0_55__add_policies_and_roles.sql:30), which: (a) protects WHILE the seeded Administrator row is live (`deleted_at IS NULL`); (b) DOES NOT protect if the seeded row is ever soft-deleted out-of-band (any DB-direct `UPDATE policy SET deleted_at = NOW() WHERE name = 'Administrator'`); (c) produces a `UniqueConstraintException` (translated by ExceptionUtils, surfaced as HTTP 400 via ControllerAdvice.java:36-40) rather than the cleaner `BadUserRequestException(\"Administrator name is reserved\")` the rest of the file emits. Carry-over from batch-E DOC-GAP-D + bugs_limitations_corner_cases[3] — confirmed at the service layer this sidecar enriches." — evidence: PolicyServiceImpl.java:29 (constant), 62-69 (no name check on create), 76-77 (name check on update), 87-88 (name check on delete) + V0_0_55__add_policies_and_roles.sql:30 (partial UNIQUE INDEX) — severity: MEDIUM (DB-defended in steady state; gap surfaces on out-of-band soft-delete of the seeded row)

- "Schema-validation failure maps to HTTP 500, not 400. `PolicyJSONValidator.validate` throws `IllegalArgumentException(\"Policy is not valid: \" + errors)` (PolicyJSONValidator.java:28-32). `ControllerAdvice` (ControllerAdvice.java:22-89) has handlers for `BadUserRequestException` → 400, `NotFoundException` → 404, `UniqueConstraintException` → 400, `CascadeDeleteException` → 400, `WebExchangeBindException` → 400, `GenAIException` → 500, and a catch-all `Exception.class` → 500 with message `\"Internal Server Error\"`. `IllegalArgumentException` has NO dedicated handler — it falls through to the catch-all at lines 61-66 and surfaces as HTTP 500 with the body `\"Internal Server Error\"` (NOT the validator's actual error message). An operator POSTing a malformed policy gets a generic server error and must read server logs to see the schema violation. The fix is either (a) PolicyJSONValidator throws BadUserRequestException, or (b) ControllerAdvice adds an IllegalArgumentException handler — either way one-line." — evidence: PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66 (no IllegalArgumentException handler) + PolicyServiceImpl.java:13 (imports BadUserRequestException — used elsewhere in the same class) — severity: MEDIUM

- "Non-admin user list path silently ignores pagination. PolicyServiceImpl.list (lines 52-60) for a non-admin user takes the in-memory branch at line 57 → `getRolePolicies(roles, query)` (lines 109-116). This builds a `Page<PolicyPojo>` with `total = filteredPolicies.size()` and `hasNext = false` REGARDLESS of `page` and `size` request parameters. A non-admin with 1000 effective policies (pathological but possible if many MANAGEMENT/ALL policies are bound to one role) receives a 1000-element response on `GET /api/policies?page=1&size=20`. The admin branch (line 58) correctly paginates via `policyRepository.list(page, size, query)`. Asymmetric pagination contract." — evidence: PolicyServiceImpl.java:52-60 + 109-116 (`new Page<>(filteredPolicies, filteredPolicies.size(), false)`) — severity: LOW

- "Empty-roles list silently routes through the non-admin in-memory branch. PolicyServiceImpl.list at line 55: `roles.stream().noneMatch(r -> r.pojo().getName().equals(\"Administrator\"))` returns TRUE for an EMPTY roles list (vacuously). The `.map` is then taken; `getRolePolicies(emptyList, query)` returns an empty `Page` (no policies at all). The intent is presumably 'a user with no roles sees no policies' — which is correct — but the path is the same as 'a user with non-admin roles sees their role-attached policies'. A subtle assumption: a user with NO roles should NOT be able to see the admin-only policy list. The current implementation respects that, but a maintainer flipping `.noneMatch` to `.anyMatch` (e.g. for a refactor) would silently route empty-role users to the admin path. The single line is the only thing keeping that invariant; no test pins it." — evidence: PolicyServiceImpl.java:52-60 + Java Stream API semantics (vacuous truth of `noneMatch` on empty stream) — severity: LOW

- "Cascade-delete check is non-atomic with the soft-delete. PolicyServiceImpl.delete at lines 83-95 issues `policyRepository.get(id)` → name check → `roleToPolicyRepository.isPolicyAttachedToRole(id)` → conditional CascadeDeleteException → `policyRepository.delete(id)`. The check (line 89) and the delete (line 93) are SEPARATE R2DBC calls outside any transaction. Race window: client A reads `isAttached = false` (line 89), client B `POST /api/roles` or `PUT /api/roles/{id}` adds a `role_to_policy` row referencing the policy, client A continues to `policyRepository.delete(id)` (line 93) and soft-deletes the now-bound policy. Result: a SURVIVING role binding to a SOFT-DELETED policy — the exact orphan-binding permission-leak state batch H identified at the repository layer. The defence at lines 89-92 closes the gap in the SEQUENTIAL operator case but NOT in the concurrent-mutation case. `@ReactiveTransactional` would mitigate by scoping read+delete to a single connection; per-row-level `SELECT ... FOR UPDATE` would fully close." — evidence: PolicyServiceImpl.java:83-95 (multi-call delete flow under no transaction) + ReactiveRoleToPolicyRepositoryImpl.java:43-49 (isPolicyAttachedToRole — read-only EXISTS) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (base delete — single UPDATE, self-atomic) — severity: MEDIUM

- "JSON-Schema-validation runs on the WebFlux event-loop thread. PolicyJSONValidator.validate (PolicyJSONValidator.java:24-33) does `objectMapper.readTree(policyJson)` (network-and-buffer parse — synchronous) + `jsonSchema.validate(...)` (schema walk over parsed JSON — synchronous). Invoked at PolicyServiceImpl.java:64, 73 OUTSIDE any `.publishOn(Schedulers.boundedElastic())` — the work runs on the calling thread. For typical policies (sub-millisecond), no consequence. For a pathological 1MB policy body, the parse-and-validate becomes a non-trivial cost on a non-blocking thread. Reactor convention is `Mono.fromCallable(...).subscribeOn(boundedElastic)` for blocking work; this code does not follow it. The decision is consistent with batch-E observation that the validator was treated as 'effectively non-blocking'." — evidence: PolicyServiceImpl.java:64, 73 (synchronous invocation) + PolicyJSONValidator.java:24-33 (no async hand-off) — severity: LOW

- "`getCurrentUserPolicies()` issues a fresh DB roundtrip on EVERY authorized request. Hot path through `policyService.getCurrentUserPolicies()` → `roleService.getCurrentUserRoles()` (5-table JOIN at ReactiveUserOwnerMappingRepositoryImpl.java:99-114) → `policyRepository.getRolesPolicies(roleIds)` (2-table JOIN at ReactivePolicyRepositoryImpl.java:32-35). Two JOINs per authorized request, no request-scoped cache, no user-scoped cache, no Caffeine / Redis layer. For a busy platform with N req/s, this is 2N JOINs/s for permission resolution alone — orthogonal to the actual request's business work. Today's behaviour is correct (always fresh); the cost is low for typical platforms but unbounded for high-RPS deployments." — evidence: PolicyServiceImpl.java:102-107 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 — severity: LOW

- "No audit-log on any RBAC mutation at this layer. PolicyServiceImpl has NO `@Slf4j` annotation, NO Logger field, NO `log.info / .warn / .error` call (verified by reading PolicyServiceImpl.java:1-117 end-to-end). Create, update, delete of policies — including the seeded Administrator if the name check were ever weakened — produce ZERO application-level log lines. Combined with the controller (PolicyController.java:1-65) and the repository (ReactivePolicyRepositoryImpl.java:1-40) also being log-silent, the entire policy-mutation stack is forensically dark. Security-incident review of 'who created / modified this MANAGEMENT/ALL policy on date X' from running-platform logs is impossible. Pattern consistent with batch-E + batch-H (REFACTOR-188 RBAC narrowing)." — evidence: PolicyServiceImpl.java:1-117 (no log imports, no Slf4j) + Grep for `log\\.` in the file returns zero matches — severity: HIGH

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — service bean, not on the HTTP surface. Auth mode does not gate this service directly. However, every method except `getCurrentUserPolicies` is called by `PolicyController` whose endpoints ARE auth-mode-relevant: `POST/PUT/DELETE /api/policies/...` are gated by `LOGIN_FORM | OAUTH2 | LDAP` modes via `SecurityConstants.SECURITY_RULES` (lines 163-168 — POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE). `GET /api/policies` and `GET /api/policies/{id}` have NO SECURITY_RULES entry — they require ONLY `.authenticated()` and so any authenticated user can read every policy in the system. Under `auth.type=DISABLED` everything is bypassed (batch-E sidecar). `getCurrentUserPolicies` runs on every authorized request transitively through the permission extractors — under DISABLED the extractors are not invoked because the entire authorization chain is short-circuited.
- **ingestion_filter_relevance**: `NO — RBAC management surface, not ingestion`. `IngestionDataEntitiesFilter` matches only `POST /ingestion/entities`; this service is on the policy-CRUD path, never on the ingestion path.
- **authorization_assertions**:
  - "No `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` on any method in this file. Authorization is enforced UPSTREAM at the controller boundary by `SecurityConstants.SECURITY_RULES`. The service trusts its caller." — evidence: PolicyServiceImpl.java:1-117 (no security-annotation imports)
  - "The `Administrator`-name reservation at lines 76, 87 IS a runtime authorization-shaped check (it blocks an authenticated, POLICY_UPDATE/POLICY_DELETE-bearing user from mutating a specific protected row), but it is not framework-level — it is service-coded logic. Bypassable by any caller that does not route through this service." — evidence: PolicyServiceImpl.java:76, 87 (the filter() + switchIfEmpty()) + BadUserRequestException.java:1-7
- **owner_scoping**: `N/A — Policy is a platform-global resource`. The `policy` table has no `owner_id` column (V0_0_55__add_policies_and_roles.sql:19-28). The list path's branch by user role (lines 52-60) is NOT owner-scoping — it is role-based filtering: admin users see ALL policies via the repository, non-admin users see only the policies attached to THEIR roles (in-memory filter on the eager `RoleDto.policies()` collection).
- **data_exposure**:
  - "PolicyDetails payload (id, name, parsed statements including resource type / conditions / permissions, role assignments, timestamps) → returned by `getPolicyDetails`, `create`, `update`. Audience: caller granted the corresponding Permission under non-DISABLED auth modes, or any caller under DISABLED."
  - "PolicyList payload (paged Policy items: id, name) → returned by `list`. Admin users see the full DB-paged list (paged via repository); non-admin users see ONLY their role-attached policies (in-memory). The pagination contract differs by role — an admin filtering by name sees server-side filter; a non-admin filtering by name sees in-memory filter that ignores page/size."
  - "Full `PolicyPojo` list → returned by `getCurrentUserPolicies` to the permission extractors. The extractors consume the policy text to compute permissions; the policy NAMES and full JSON statements flow through in-memory caller code on every authorized request. Not directly HTTP-exposed by THIS method."
  - "Schema text → returned verbatim by `getPolicySchema` to any authenticated caller. Carry-over from batch-E known_security_gaps[6]."
- **known_security_gaps**:
  - "Orphan-binding permission-leak race window between cascade-delete check (line 89) and soft-delete (line 93). A concurrent role-binding mutation can land between the two non-transactional calls, leaving a soft-deleted policy with surviving role bindings — the exact state batch H identified as the repository-layer security gap. The service-layer defence at lines 89-92 is sequential-only; concurrent mutation defeats it. `@ReactiveTransactional` plus `SELECT ... FOR UPDATE` semantics on `isPolicyAttachedToRole` would close." — evidence: PolicyServiceImpl.java:83-95 + ReactivePolicyRepositoryImpl.java:32-35 (the JOIN with no deleted_at filter) — severity: MEDIUM
  - "Administrator-name CREATE-side asymmetry is a defence-in-depth gap. The DB UNIQUE constraint defends in steady state, but any out-of-band soft-delete of the seeded Administrator row (DB-direct UPDATE, broken migration, future endpoint that bypasses the name guard) re-opens the gap and PolicyServiceImpl.create has no symmetric protection. One line at lines 62-69 (`if (formData.getName().equals(ADMINISTRATOR_POLICY)) return Mono.error(new BadUserRequestException(\"Administrator name is reserved\"))`) closes it." — evidence: PolicyServiceImpl.java:62-69, 76-77, 87-88 + V0_0_55__add_policies_and_roles.sql:30 — severity: MEDIUM (gap-of-gaps; surfaces only on out-of-band soft-delete)
  - "Forensic-silence of RBAC mutations. No `@Slf4j`, no Logger, no log line on create / update / delete of policies. A security incident review cannot reconstruct policy authorship from running-platform logs alone. Consistent gap across the stack (controller + service + repository all log-silent). Pattern carries to all three batches: E (controller), H (repository), I (service)." — evidence: PolicyServiceImpl.java:1-117 (zero log calls, no Slf4j) — severity: HIGH
  - "Schema-validation failure surfaces as HTTP 500 (Internal Server Error) rather than HTTP 400. Operators POSTing a malformed policy body cannot tell from the response whether the error is a server bug or a malformed request. The validator runs (correctly) but the exception type choice + ControllerAdvice routing combine to misrepresent the error class. Carry-over from batch-E known_security_gaps[3]." — evidence: PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66 + PolicyServiceImpl.java:64, 73 — severity: MEDIUM
  - "Read-side endpoints (`GET /api/policies`, `GET /api/policies/{id}`, `GET /api/policies/schema`) are NOT in `SECURITY_RULES` — they require only `.authenticated()`. Any authenticated user can enumerate every policy by id and read every statement. The list-path branches by role (line 52-60) is a partial defence — non-admin users see only their role-attached policies in the LIST — but `getPolicyDetails(id)` (line 45-50) does NOT apply role-based scoping; any authenticated user with a valid id can fetch any policy's full details. This is a confidentiality issue: a non-admin user can iterate ids and read MANAGEMENT/ALL policy statements, learning which permissions are bundled into which role." — evidence: SecurityConstants.java:163-168 (no rules for GET endpoints) + PolicyController.java:27-32, 34-41, 59-63 (no programmatic check) + PolicyServiceImpl.java:45-50 (no role-based filter on getPolicyDetails) — severity: MEDIUM
  - "No anti-elevation guard. A POLICY_CREATE-bearing user can author a `MANAGEMENT/ALL` policy and then (with ROLE_CREATE or ROLE_UPDATE — both MANAGEMENT-tier) bind it to a role they belong to, completing a self-elevation chain. The validator (PolicyJSONValidator + schema) accepts MANAGEMENT/ALL as a legal shape — identical to the seeded Administrator. There is no 'cannot grant permissions you don't already have' check. This is intentional in the platform's design (an administrator can author administrator policies — that's the bootstrap) but the consequence is that POLICY_CREATE is functionally root-on-the-platform. Carry-over from batch-E known_security_gaps[2]." — evidence: PolicyServiceImpl.java:62-69 (no elevation check) + policy_schema.json (accepts MANAGEMENT/ALL) + V0_0_56__add_predefined_roles_and_policies.sql:1-31 (Administrator uses MANAGEMENT/ALL) — severity: HIGH

## performance

- **hot_paths**:
  - "`getCurrentUserPolicies` (lines 102-107) is the AUTHORIZATION HOT PATH. Invoked from `ManagementPermissionExtractor.getNonContextualPermissions` (ManagementPermissionExtractor.java:33) AND from `AbstractContextualPermissionExtractor.getContextualResourcePermissions` (AbstractContextualPermissionExtractor.java:27) on EVERY authorized HTTP request that traverses the permission framework. Cost per call: 1 invocation of `roleService.getCurrentUserRoles()` (5-table JOIN — ReactiveUserOwnerMappingRepositoryImpl.java:99-114) + 1 invocation of `policyRepository.getRolesPolicies(roleIds)` (2-table JOIN — ReactivePolicyRepositoryImpl.java:32-35). Two DB roundtrips per authorized request, no caching." — evidence: PolicyServiceImpl.java:102-107 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + RoleServiceImpl.java:95-101 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114
  - "`list` (line 52-60) for ADMIN users — `policyRepository.list(page, size, query)` is a paged SELECT on `policy` (single table). Admin-rare, no impact at scale."
  - "`create`, `update`, `delete` are admin-rare paths. Per-call cost: validation (sub-ms for typical policies, synchronous on event-loop thread) + 1-3 DB roundtrips."
- **throughput_characteristics**:
  - "Single-policy CRUD — no bulk endpoint exposed via the service interface (PolicyService.java:11-25 — only single-item operations). The repository base supports `bulkCreate / bulkUpdate` (ReactiveAbstractCRUDRepository.java:113-142, transactional) but PolicyService does not invoke them."
  - "`getCurrentUserPolicies` materialises a `Mono<List<PolicyPojo>>` per call — fully collected, not streamed. For typical policy cardinality per user (~1-10) this is trivial; for pathological cases (1000+ policies bound to a single role) the per-request heap allocation is proportional and unbounded."
- **resource_allocation**:
  - "POLICY_SCHEMA (lines 28, 37-43) — held twice in memory: once here as a static-final String (raw text), once in PolicyJSONValidator as a parsed JsonSchema (PolicyJSONValidator.java:18-22). Typical schema is ~5KB raw, ~15KB parsed; trivial per-instance cost."
  - "`getCurrentUserPolicies` per-call allocation: `Mono<List<PolicyPojo>>` whose List size = current user's policy count. For typical users (1-10 policies, each ~500 bytes of policy text) ≈ 5KB per request. The List is held through the extractor's flatMapIterable consumption (ManagementPermissionExtractor.java:34-40)."
  - "`list` for non-admin users (lines 109-116): allocates a new `Page<>` + a `List<PolicyPojo>` derived from the user's role-attached policies, retained for the response duration. Bounded by the user's effective policy count."
- **scaling_characteristics**:
  - "Stateless service — instances scale horizontally. No locks, no advisory locks, no shared state."
  - "Concurrent updates to the same policy id can lost-update (no `@ReactiveTransactional`, no optimistic-concurrency token). Concurrent INSERTs of the same name serialise at the DB via the partial UNIQUE INDEX (one wins, the other surfaces as UniqueConstraintException)."
  - "Per-request authorization cost (`getCurrentUserPolicies`) scales linearly with request rate. For a platform doing 100 req/s with full RBAC, that's 200 JOIN roundtrips/s on top of the request's business DB calls. R2DBC pool size (`spring.r2dbc.pool.max-size`) is the upper bound; saturation degrades request latency."
- **known_performance_gaps**:
  - "No caching of `getCurrentUserPolicies`. The result for a stable (user, roles, role_to_policy edges) tuple is stable for the lifetime of the role-policy relationships (changes only on policy/role/role_to_policy mutations). A request-scoped or user-scoped TTL cache would significantly reduce DB load on RBAC-heavy platforms. Today's behaviour is correct (always fresh) but not optimised. The cache invariant is non-trivial: invalidation must trigger on PolicyServiceImpl.update / delete AND RoleServiceImpl.update / delete." — evidence: PolicyServiceImpl.java:102-107 (no cache) + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 — severity: LOW (correctness is preserved; cost is platform-scale-dependent)
  - "Non-admin list path materialises ALL user-effective policies in memory (lines 109-116) regardless of `page` / `size` request parameters. For pathological role-policy cardinality, the response size is unbounded. Both a pagination bug (functional asymmetry vs admin path) AND a performance gap." — evidence: PolicyServiceImpl.java:52-60 + 109-116 — severity: LOW
  - "Synchronous JSON-schema validation on the WebFlux event-loop thread (PolicyServiceImpl.java:64, 73 — see bugs_limitations_corner_cases[6]). Sub-ms for typical policies; non-trivial for pathological body sizes." — evidence: PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:24-33 — severity: LOW

## sources

- understanding ← PolicyServiceImpl.java:1-117 (end-to-end read) + ReactivePolicyRepositoryImpl.java:32-35 (batch-H finding inherited) + RoleServiceImpl.java:50,64,77 (transactional sibling for asymmetry comparison)
- concepts.entities ← PolicyServiceImpl.java:7-12, 28-32 + PolicyMapper.java:17-37 + RoleDto.java:1-8
- concepts.operations ← PolicyServiceImpl.java:45-50, 52-60, 62-69, 71-81, 83-95, 97-100, 102-107, 109-116
- concepts.invariants[0] ← PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:24-33 + ControllerAdvice.java:23-66 (no IllegalArgumentException handler)
- concepts.invariants[1] ← PolicyServiceImpl.java:29, 62-69 (no check on create), 76-77 (check on update), 87-88 (check on delete) + V0_0_55__add_policies_and_roles.sql:30
- concepts.invariants[2] ← PolicyServiceImpl.java:89-92 + batch-H sidecar (ReactivePolicyRepositoryImpl.java:32-35 — JOIN with no deleted_at filter)
- concepts.invariants[3] ← PolicyServiceImpl.java:62, 71, 83 (no annotation) + RoleServiceImpl.java:50, 64, 77 (@ReactiveTransactional) + ReactiveAbstractCRUDRepository.java:102-110, 144-149 (base unannotated)
- concepts.invariants[4] ← PolicyServiceImpl.java:52-60, 109-116 + UserProviderRole.java:9 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114
- concepts.invariants[5] ← PolicyServiceImpl.java:102-107 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27
- dependencies_semantic.requires-feature ← PolicyServiceImpl.java:31-35 (DI fields) + batch-H sidecar (repository semantics) + PolicyJSONValidator.java:14-33 + PolicyMapper.java:17-37 + RoleService.java:11-21 + ReactiveRoleToPolicyRepositoryImpl.java:24-56
- dependencies_semantic.requires-config ← V0_0_55__add_policies_and_roles.sql:19-30 + V0_0_56__add_predefined_roles_and_policies.sql:1-41 + PolicyServiceImpl.java:37-43
- dependencies_semantic.requires-runtime ← PolicyServiceImpl.java:21-23 (Spring imports) + PolicyJSONValidator.java:1-12 (networknt imports) + ReactivePolicyRepositoryImpl.java:1-20 (jOOQ + R2DBC)
- dependencies_semantic.coupling[0] ← PolicyServiceImpl.java:29, 76, 87 + V0_0_56__add_predefined_roles_and_policies.sql:2, 34 + UserProviderRole.java:9
- dependencies_semantic.coupling[1] ← PolicyServiceImpl.java:89-92 + V0_0_55__add_policies_and_roles.sql:44-53 (no cascade FK)
- dependencies_semantic.coupling[2] ← PolicyServiceImpl.java:52-60, 109-116 + RoleDto.java:7 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114
- dependencies_semantic.coupling[3] ← PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66
- tests_coverage_semantic.uncovered_behaviours ← Grep `PolicyService|PolicyServiceImpl <odd-platform-repo>/odd-platform-api/src/test` returns ZERO matches (verified 2026-05-19)
- tests_coverage_semantic.gaps ← same Grep + PolicyServiceImpl.java:1-117 + batch-H sidecar finding
- docs_link_semantic.inferred_docs[0] ← batch-E sidecar inheritance — see `odd-platform__java__PolicyController__controller-method__createPolicy.md` docs_link_semantic.inferred_docs[0]
- docs_link_semantic.inferred_docs[1] ← same — batch-E sidecar inheritance docs_link_semantic.inferred_docs[1]
- docs_link_semantic.doc_drift_findings ← PolicyServiceImpl.java:71-81 (race) + 89-92 (cascade) + 62-69 vs 76, 87 (create asymmetry) + ControllerAdvice.java:23-66 (no IllegalArgumentException handler) + batch-E sibling sidecar (live page silence)
- upstream_callers ← Grep `policyService\\.|PolicyService` across `<odd-platform-repo>/odd-platform-api/src/main` (verified 2026-05-19) + PolicyController.java:17, 23, 30, 39, 48, 55, 61 + ManagementPermissionExtractor.java:22, 33 + AbstractContextualPermissionExtractor.java:21, 27 + DataEntityPermissionExtractor.java:31 + TermPermissionExtractor.java:25 + QueryExamplePermissionExtractor.java:26
- downstream_side_effects ← PolicyServiceImpl.java:45-107 + batch-H sidecar downstream_side_effects + ReactiveRoleToPolicyRepositoryImpl.java:43-49 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114 + V0_0_55__add_policies_and_roles.sql:19-53
- implicit_adrs[0] ← PolicyServiceImpl.java:62-95 (all invariants in service) + ReactivePolicyRepositoryImpl.java:1-40 (no invariants in repo) + batch-H sidecar implicit_adrs[3]
- implicit_adrs[1] ← PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:24-33
- implicit_adrs[2] ← PolicyServiceImpl.java:29, 62-69, 76-77, 87-88
- implicit_adrs[3] ← PolicyServiceImpl.java:89-92 + RoleServiceImpl.java:89 + CascadeDeleteException.java:1-7
- implicit_adrs[4] ← PolicyServiceImpl.java:62, 71, 83 + RoleServiceImpl.java:50, 64, 77 + ReactiveAbstractCRUDRepository.java:102-149
- bugs_limitations_corner_cases[0] ← PolicyServiceImpl.java:71-81 + ReactiveTransactional.java:9-13 + ReactiveAbstractCRUDRepository.java:107-110 + RoleServiceImpl.java:64
- bugs_limitations_corner_cases[1] ← PolicyServiceImpl.java:29, 62-69, 76-77, 87-88 + V0_0_55__add_policies_and_roles.sql:30
- bugs_limitations_corner_cases[2] ← PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66 + PolicyServiceImpl.java:13
- bugs_limitations_corner_cases[3] ← PolicyServiceImpl.java:52-60, 109-116
- bugs_limitations_corner_cases[4] ← PolicyServiceImpl.java:52-60 (Java stream noneMatch on empty list)
- bugs_limitations_corner_cases[5] ← PolicyServiceImpl.java:83-95 + ReactiveRoleToPolicyRepositoryImpl.java:43-49 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- bugs_limitations_corner_cases[6] ← PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:24-33
- bugs_limitations_corner_cases[7] ← PolicyServiceImpl.java:102-107 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114
- bugs_limitations_corner_cases[8] ← PolicyServiceImpl.java:1-117 (no @Slf4j, no Logger) + batch-E + batch-H consistent silence pattern
- security.auth_mode_relevance ← PolicyServiceImpl.java:1-117 + PolicyController.java:1-65 + SecurityConstants.java:163-168 + batch-E sidecar
- security.ingestion_filter_relevance ← PolicyController.java:1-65 + batch-E sidecar
- security.authorization_assertions ← PolicyServiceImpl.java:1-117 (no annotations) + PolicyServiceImpl.java:76, 87 (runtime name-check) + BadUserRequestException.java:1-7
- security.owner_scoping ← V0_0_55__add_policies_and_roles.sql:19-28 + PolicyServiceImpl.java:52-60
- security.data_exposure ← PolicyServiceImpl.java:45-50, 52-60, 62-69, 71-81, 83-95, 97-100, 102-107
- security.known_security_gaps[0] ← PolicyServiceImpl.java:83-95 + batch-H sidecar known_security_gaps[0]
- security.known_security_gaps[1] ← PolicyServiceImpl.java:29, 62-69, 76-77, 87-88 + V0_0_55__add_policies_and_roles.sql:30
- security.known_security_gaps[2] ← PolicyServiceImpl.java:1-117 (no logging) + batch-E + batch-H pattern
- security.known_security_gaps[3] ← PolicyJSONValidator.java:28-32 + ControllerAdvice.java:23-66
- security.known_security_gaps[4] ← SecurityConstants.java:163-168 + PolicyController.java:27-63 + PolicyServiceImpl.java:45-50
- security.known_security_gaps[5] ← PolicyServiceImpl.java:62-69 + policy_schema.json:166-202 + V0_0_56__add_predefined_roles_and_policies.sql:1-31
- performance.hot_paths ← PolicyServiceImpl.java:102-107 + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27 + ReactiveUserOwnerMappingRepositoryImpl.java:99-114
- performance.throughput_characteristics ← PolicyService.java:11-25 + ReactiveAbstractCRUDRepository.java:113-142
- performance.resource_allocation ← PolicyServiceImpl.java:28, 37-43 + PolicyJSONValidator.java:18-22 + PolicyServiceImpl.java:102-107
- performance.scaling_characteristics ← PolicyServiceImpl.java:62-95 (no annotations) + V0_0_55__add_policies_and_roles.sql:30
- performance.known_performance_gaps[0] ← PolicyServiceImpl.java:102-107 (no cache) + ManagementPermissionExtractor.java:33 + AbstractContextualPermissionExtractor.java:27
- performance.known_performance_gaps[1] ← PolicyServiceImpl.java:52-60 + 109-116
- performance.known_performance_gaps[2] ← PolicyServiceImpl.java:64, 73 + PolicyJSONValidator.java:24-33

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: LOW (WebFetch denied in this session; inherits batch-E verified state from 2026-05-12)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- implicit_adrs: HIGH (except implicit_adrs[4] confidence: LOW — the non-transactional choice has no defending comment; routed here for symmetry-with-sibling-service observability, with the operator-visible consequence ALSO recorded in bugs_limitations_corner_cases[0])
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes


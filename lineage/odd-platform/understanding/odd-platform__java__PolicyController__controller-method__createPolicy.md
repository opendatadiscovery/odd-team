---
node_id: "odd-platform java PolicyController controller-method:createPolicy"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-E
---

# PolicyController.createPolicy — semantic understanding

## understanding

Reactive HTTP handler for `POST /api/policies`: persists a new RBAC permission policy (a named JSON document of `statements` over resource types `DATA_ENTITY | TERM | QUERY_EXAMPLE | MANAGEMENT` granting specific `permissions` or the `ALL` wildcard) which becomes a building block of the platform's authorization model the moment it is bound to a role. The controller is a thin proxy onto `PolicyService.create(PolicyFormData)`; the service synchronously validates the policy body against the bundled JSON Schema (`schema/policy_schema.json`) via `PolicyJSONValidator.validate(...)`, maps to a `PolicyPojo`, and inserts via `ReactivePolicyRepository.create(...)`. Because policies become the operative authorization rules consumed by every `ReactiveNonContextPermissionAuthorizationManager` and `ReactiveResourcePermissionAuthorizationManager`, the right to create a policy is the right to grant arbitrary platform-wide power — `POLICY_CREATE` (MANAGEMENT tier) is the gate, but it is wired in `SecurityConstants.SECURITY_RULES`, not on the controller method itself, and the gate does not apply when `auth.type=DISABLED`.

## concepts

- entities: [Policy, PolicyFormData (name + policy JSON string), PolicyDetails, PolicyPojo, PolicyStatementDto, PolicyPermissionDto, PolicyTypeDto (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT), Role, RoleToPolicy binding]
- operations: [create-policy, validate-policy-json-schema, persist-policy, return-policy-details]
- invariants:
  - "Endpoint is gated by Permission `POLICY_CREATE` (MANAGEMENT tier) via SecurityConstants.SECURITY_RULES at SecurityConstants.java:163-164 — no `@PreAuthorize`, no programmatic check on the controller method."
  - "Policy body is validated server-side against `schema/policy_schema.json` (JSON Schema Draft 2019-09) before persistence; an invalid body raises `IllegalArgumentException` from PolicyJSONValidator and is mapped to a client error."
  - "Policy names are subject to a database-level partial UNIQUE INDEX (`policy_name_unique` on `policy(name) WHERE deleted_at IS NULL`, V0_0_55__add_policies_and_roles.sql:30) — duplicate-name POST fails at the DB layer; the service has no pre-check that returns a clean 409 Conflict."
  - "Creating a policy does NOT attach it to any role — a new policy is inert until a separate `POST /api/roles/{role_id}` or role-update binds it via `role_to_policy`. The created policy is, however, immediately visible in `GET /api/policies` to any caller whose roles let them list policies."
  - "Policies authored with `resource.type = MANAGEMENT` and `permissions: [ALL]` grant every MANAGEMENT permission — including `POLICY_CREATE`, `POLICY_UPDATE`, `POLICY_DELETE`, `ROLE_*`, `OWNER_*`, `DATA_SOURCE_*`, `COLLECTOR_*` — to any role they are bound to. This is the same shape as the seeded `Administrator` policy."
- audiences: [platform administrators authoring RBAC policies via the UI's Management → Access Management page, automation scripts seeding policies during cluster bootstrap, future operators investigating who can grant what]

## dependencies_semantic

- requires-feature:
  - "PolicyService bean (PolicyServiceImpl) — owns the `create(PolicyFormData)` operation: validate JSON, map to PolicyPojo, insert via repository, map back to PolicyDetails."
  - "PolicyJSONValidator bean — loads `schema/policy_schema.json` once at construction (V201909 JsonSchemaFactory) and runs `jsonSchema.validate(...)` per request; non-empty ValidationMessage set raises `IllegalArgumentException(\"Policy is not valid: ...\")`."
  - "ReactivePolicyRepository (ReactivePolicyRepositoryImpl, extending ReactiveAbstractSoftDeleteCRUDRepository) — issues the `INSERT INTO policy(name, policy, ...)` via jOOQ over R2DBC."
  - "PolicyMapper — converts PolicyFormData ↔ PolicyPojo ↔ PolicyDetails and parses the stored `policy` text column back into statements for the read path."
  - "OpenAPI-generated PolicyApi interface — controller implements `Mono<ResponseEntity<PolicyDetails>> createPolicy(Mono<PolicyFormData>, ServerWebExchange)`; HTTP method/path/operationId come from `odd-platform-specification/openapi.yaml:3517-3534`."
- requires-config:
  - "`auth.type` (one of `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) — selects which `*SecurityConfiguration` `@ConditionalOnProperty` activates. Only the three non-DISABLED modes install `AuthorizationCustomizer` which iterates `SECURITY_RULES` and enforces `POLICY_CREATE` for this path."
  - "Bootstrap state: V0_0_56__add_predefined_roles_and_policies.sql seeds the `Administrator` policy (MANAGEMENT + DATA_ENTITY + TERM, all `ALL`) and the `Administrator` role binding — without it, NO user has POLICY_CREATE in any auth mode until a policy is manually authored."
- requires-runtime:
  - "Spring WebFlux (RestController + reactive Mono pipeline)."
  - "Reactor Core (Mono.flatMap composition)."
  - "networknt json-schema-validator (V201909)."
  - "jOOQ-on-R2DBC reactive PG insert (no `@ReactiveTransactional` on `PolicyServiceImpl.create` — single-statement insert, so atomicity isn't compromised, but inconsistent with `update`/`delete` paths in the same file which would benefit from transactional grouping if a side-effect were added)."
- coupling:
  - "Authorization gate is declarative-and-remote: it lives in `SecurityConstants.SECURITY_RULES` (auth/util package), not on the controller. A reader of PolicyController.java alone has no way to know that the endpoint requires `POLICY_CREATE` — they must navigate to `SecurityConstants.java:163-164`."
  - "The `getPolicySchema` peer endpoint (`GET /api/policies/schema`, PolicyController.java:60-63) returns the SAME `schema/policy_schema.json` that the validator enforces — but `getPolicySchema` is NOT in `SECURITY_RULES`, so it falls through to the catch-all `.pathMatchers(\"/**\").authenticated()` at AuthorizationCustomizer.java:29-30. Any authenticated user (no permission required) can fetch the schema."
  - "`SecurityConstants.WHITELIST_PATHS` (consumed at AuthorizationCustomizer.java:21-23 as `permitAll()`) determines which paths bypass the entire auth chain in non-DISABLED modes; `/api/policies` is not on the whitelist."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Controller-layer test of `POST /api/policies` returning 200 with a PolicyDetails body for a well-formed PolicyFormData."
  - "Service-layer test of `PolicyServiceImpl.create` — happy path persisting a valid policy, error path on an invalid policy body raising `IllegalArgumentException` from PolicyJSONValidator."
  - "PolicyJSONValidator-level tests of each schema invariant: MANAGEMENT with `conditions` rejected (schema $defs/policy_resource `if MANAGEMENT then not conditions`); DATA_ENTITY-typed permissions rejected for a MANAGEMENT-typed resource (schema cross-type `if/then` blocks at policy_schema.json:55-202); empty `statements` array rejected (`minItems: 1` at policy_schema.json:12)."
  - "Integration test of the auth gate: an authenticated user WITHOUT `POLICY_CREATE` Permission gets 403 on `POST /api/policies`; the same user WITH the Permission (via the Administrator role or a custom MANAGEMENT/ALL policy) gets 200."
  - "Integration test of `auth.type=DISABLED`: confirm that the endpoint succeeds for an unauthenticated caller — this is the gap-shape behaviour worth pinning to a test so a future change can't silently regress to `authenticated()` and then back."
  - "Test of duplicate-name handling: POST a second policy with an existing live policy's name and assert the surfaced error (currently the DB UNIQUE constraint violation surfaces as a low-level error, not a clean 409 Conflict — worth pinning the current behaviour and then improving it)."
  - "Test of `Administrator`-name reservation on create: the service's `update` and `delete` paths explicitly block the name `Administrator` (PolicyServiceImpl.java:76, 87), but `create` does NOT — a user with POLICY_CREATE can create a SECOND policy named `Administrator` (it would fail at the DB `policy_name_unique` index since the seeded one isn't soft-deleted), but if the seeded one is ever soft-deleted, a custom Administrator policy could be created. Pin the current behaviour."
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/json/PolicyDeserializerTest.java — JSON-deserialization-layer test for Policy DTOs (not the createPolicy HTTP / service flow; covers Jackson polymorphism only)."
- gaps: |
    The entire `POST /api/policies` business path is untested at controller, service,
    validator, and integration layers. A regression that (a) silently demotes
    `POLICY_CREATE` to `.authenticated()` (e.g. a SecurityConstants.java edit removing
    the rule), (b) breaks PolicyJSONValidator schema enforcement (e.g. an exception
    swallowed and the body persisted verbatim), or (c) introduces an audit-log side
    effect that isn't transactional with the insert, would not be caught. Given that
    `POLICY_CREATE` is the keys-to-the-kingdom permission (a policy with MANAGEMENT/ALL
    grants the creator full administrative power if bound to their role), the lack of
    even one integration test asserting that an unauthorised user is 403'd is a
    high-severity TEST-GAP candidate.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: ""
    rationale: "Canonical page for the Policies concept. WebFetched 2026-05-12, status 200: the page documents the policy JSON shape (resource types DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT, conditions, permissions, the `ALL` keyword) but does NOT explain who can create policies (no Permission named), does NOT mention the seeded `Administrator` policy, does NOT warn about `auth.type=DISABLED` bypassing the gate, and does NOT cover operational caveats (audit logging, duplicate-name handling, idempotency, the `GET /api/policies/schema` endpoint)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Catalog of platform Permissions. WebFetched 2026-05-12, status 200: page lists `POLICY_CREATE: \"Allows creating a new access policy.\"`, `POLICY_UPDATE: \"Allows editing an existing access policy.\"`, `POLICY_DELETE: \"Allows deleting an access policy.\"` under Management permissions tier (\"High-level administrative actions for managing the platform's infrastructure and configuration.\"). Page does NOT name which auth modes enforce these, does NOT mention the bootstrap Administrator role, does NOT explain MANAGEMENT-tier semantics beyond the tier name."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "Auth-modes index. WebFetched 2026-05-12, status 200: lists `Disable authentication` among modes WITHOUT warning that DISABLED bypasses every authorization gate including POLICY_CREATE. The sub-page `/configuration-and-deployment/enable-security/authentication/disabled-authentication` may carry the warning but is not fetched here (budget exhausted)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "DOC-GAP-A: The Policies page (configuration-and-deployment/enable-security/authorization/policies) documents the policy schema as a feature but never names the Permission required to author one. A reader landing on the page from the UI's Management → Access Management → Policies button has no way to know that `POLICY_CREATE` (MANAGEMENT tier) is the gate, nor that the seeded `Administrator` role/policy is the only out-of-the-box bearer of that permission. A 'Who can create policies' or 'Bootstrap administrator' section is missing."
  - "DOC-GAP-B: The Policies page does not mention the `GET /api/policies/schema` endpoint (PolicyController.java:60-63) which returns the live JSON Schema the server validates against. A reader writing custom integrations has no documented way to discover the schema programmatically."
  - "DOC-GAP-C: Neither the Policies page nor the Permissions catalog warns that under `auth.type=DISABLED` the entire `SECURITY_RULES` registry is bypassed (DisabledAuthSecurityConfiguration.java:14-18: `authorizeExchange ... anyExchange().permitAll()`). Any caller able to reach a DISABLED-mode platform on the network can POST /api/policies and create a MANAGEMENT/ALL policy — but they cannot escalate without also binding it to a role they control, which also requires Role* permissions also bypassed under DISABLED. A `Warning` admonition on the Policies page (and the Permissions page, and the DISABLED authentication sub-page) is missing. Pairs with REFACTOR-073 (default-DISABLED + no-fail-fast) and ADR-CANDIDATE-002 (centralised SECURITY_RULES) from prior batches."
  - "DOC-GAP-D: The Policies page does not document the `Administrator` policy/role name reservation. The service blocks UPDATE / DELETE of any policy named `Administrator` (PolicyServiceImpl.java:76, 87) with `BadUserRequestException(\"Administrator policy cannot be updated\")` / `BadUserRequestException(\"Administrator policy cannot be deleted\")`, but the CREATE path has no such block. A reader following the docs to author a policy named `Administrator` (e.g. after soft-deleting the seeded one) will hit DB UNIQUE-constraint violations with no documented expectation set."
  - "DOC-GAP-E: The Policies page does not name an operational audit-logging story. `PolicyServiceImpl.create` has no `log.info(...)` / `log.warn(...)` audit call; the `policy` table has `created_at` and (jOOQ-generated) `created_by` columns populated but the API-facing PolicyDetails projection does not expose them, so a security-incident reviewer reconstructing 'who created this MANAGEMENT/ALL escalation policy on 2026-04-30' must read the DB directly. The docs do not warn operators to enable DB query logging if they want a forensic trail of policy authorship."

## implicit_adrs

- "Authorization for mutating /api/policies endpoints is wired declaratively in `SecurityConstants.SECURITY_RULES`, not via `@PreAuthorize` annotations on the controller or its generated `*Api` interface" — evidence: SecurityConstants.java:163-168 (POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE rules) + PolicyController.java:19-25 (no `@PreAuthorize`, no programmatic check) — intent_anchor: the entire `SecurityConstants.SECURITY_RULES` list is the file-scoped registry of (path, method, permission) tuples, named such that grepping `SECURITY_RULES` enumerates every gated endpoint; the consistent pattern across controllers (Alert, Collector, DataSource, Owner, Policy, Role, Term, LookupTable etc.) confirms this is intentional rather than accidental — confidence: HIGH

- "Policy bodies are validated against a bundled JSON Schema at write-time, not just at read-time, ensuring the persisted `policy` text column is always schema-valid against the V201909 schema bundled with the running build" — evidence: PolicyJSONValidator.java:18-22 (loads `schema/policy_schema.json` once at construction) + PolicyJSONValidator.java:24-33 (validates per request, raises IllegalArgumentException on non-empty errors) + PolicyServiceImpl.java:64 (validator invoked before any persistence) — intent_anchor: the validator is named `PolicyJSONValidator` (not `PolicyValidator` or `PolicyShapeChecker`), is annotated `@Component` so it lives in the DI container, and is invoked unconditionally on the create AND update paths (PolicyServiceImpl.java:64, 73) — the design treats schema validity as a hard pre-persistence invariant — confidence: HIGH

- "MANAGEMENT-tier permission-checking is non-contextual (path-based) rather than entity-context-based — there is no per-policy ACL beyond `POLICY_CREATE` itself" — evidence: SecurityConstants.java:163-164 uses `NO_CONTEXT` (not `DATA_ENTITY` / `TERM` / `QUERY_EXAMPLE`) which routes via `ReactiveNonContextPermissionAuthorizationManager.java:14-28` to `permissionService.getNonContextualPermissionsForCurrentUser(MANAGEMENT)` — intent_anchor: `AuthorizationManagerType.NO_CONTEXT` is a deliberate enum value distinct from the contextual values, and `ReactiveNonContextPermissionAuthorizationManager` is structurally distinct from `ReactiveResourcePermissionAuthorizationManager` — confidence: HIGH

- "The `Administrator` policy is reserved by name — UPDATE and DELETE on any policy with that name are server-side rejected with a `BadUserRequestException`, preserving the bootstrap admin path against accidental deletion via the standard endpoints" — evidence: PolicyServiceImpl.java:76 (`filter(policy -> !policy.getName().equals(ADMINISTRATOR_POLICY))` + `switchIfEmpty(... \"Administrator policy cannot be updated\"))`) + PolicyServiceImpl.java:87-88 (same shape on delete) + PolicyServiceImpl.java:29 (`ADMINISTRATOR_POLICY = \"Administrator\"`) — intent_anchor: the constant is explicitly named `ADMINISTRATOR_POLICY` and the rejection text says `Administrator policy cannot be updated/deleted` — the design treats the bootstrap policy as a tripwire-protected resource — confidence: HIGH

- "Policy names are subject to a soft-delete-aware partial UNIQUE INDEX, allowing a deleted policy's name to be reused but preventing two live policies from sharing a name" — evidence: V0_0_55__add_policies_and_roles.sql:30 (`CREATE UNIQUE INDEX IF NOT EXISTS policy_name_unique ON policy (name) WHERE deleted_at IS NULL;`) + ReactiveAbstractSoftDeleteCRUDRepository pattern in ReactivePolicyRepositoryImpl.java:19 — intent_anchor: the partial-index predicate `WHERE deleted_at IS NULL` is a deliberate SQL design that pairs with the soft-delete base repository — confidence: HIGH

## bugs_limitations_corner_cases

- "Under `auth.type=DISABLED`, `POLICY_CREATE` is bypassed entirely — DisabledAuthSecurityConfiguration installs a single filter chain whose `.authorizeExchange(... anyExchange().permitAll())` short-circuits the entire `SECURITY_RULES` registry (it does not register `AuthorizationCustomizer`). Any caller able to reach the platform on a DISABLED deployment can POST /api/policies and create a MANAGEMENT/ALL policy. The policy is inert until role-bound, but `POST /api/roles` and `PUT /api/roles/{role_id}` are ALSO in SECURITY_RULES (also bypassed under DISABLED), so the full escalation chain is open. Pairs with batch-C finding REFACTOR-073 (default-DISABLED + no-fail-fast) and ADR-CANDIDATE-002 (centralised SECURITY_RULES). The docs do not warn against using DISABLED on a network-reachable deployment." — evidence: DisabledAuthSecurityConfiguration.java:9-18 (`@ConditionalOnProperty(value=\"auth.type\", havingValue=\"DISABLED\")` + `anyExchange().permitAll()`) + AuthorizationCustomizer.java:14-32 (only activated outside DISABLED, iterates SECURITY_RULES) + SecurityConstants.java:163-164 (POLICY_CREATE rule that DISABLED never visits) — severity: HIGH (in DISABLED deployments)

- "Policy creation is NOT audit-logged. PolicyServiceImpl.create has no `log.info/warn/audit` call (verified by reading PolicyServiceImpl.java:62-69 end-to-end). The `policy` table's row-history is single-state — there is no `policy_audit` / `policy_history` companion table and no append-only log of (who, when, what JSON). A security incident review of 'a MANAGEMENT/ALL policy named X was created on date Y — who authored it?' cannot be answered from the running platform; an operator would need to consult external DB audit (e.g. Postgres `pg_audit`) if it happens to be enabled." — evidence: PolicyServiceImpl.java:62-69 (no log calls, no audit insert) + V0_0_55__add_policies_and_roles.sql:19-30 (no audit table) — severity: HIGH

- "Duplicate-name POST is not handled cleanly. The service has no pre-check for an existing live policy with the same name; the request falls through to the repository INSERT and the DB `policy_name_unique` partial UNIQUE INDEX raises a Postgres `unique_violation` (SQLSTATE 23505). The reactive pipeline surfaces this as an unhandled `DataAccessException` rather than a `409 Conflict` / `BadUserRequestException` with a precise message. From an API-consumer perspective, the same body POSTed twice produces a 200 the first time and a 500-class error the second time, with no idempotency story." — evidence: PolicyServiceImpl.java:62-69 (no name pre-check) + ReactivePolicyRepositoryImpl.java (no upsert / ON CONFLICT logic; relies on `ReactiveAbstractSoftDeleteCRUDRepository.create`) + V0_0_55__add_policies_and_roles.sql:30 (partial UNIQUE index) — severity: MEDIUM

- "The `Administrator` name is reserved on UPDATE and DELETE (PolicyServiceImpl.java:76, 87) but NOT on CREATE. A privileged user can create a SECOND policy with `name = \"Administrator\"`; the DB UNIQUE constraint will reject it because the seeded one is live, BUT if the seeded `Administrator` policy is ever soft-deleted by some other path (no such path is present in this code today, but the soft-delete pattern means `deleted_at` could be set out-of-band), a custom `Administrator` policy could be re-created with arbitrary statements. The defence-in-depth would be to symmetrize the name-reservation across all three endpoints." — evidence: PolicyServiceImpl.java:62-69 (create — no name check) + PolicyServiceImpl.java:71-81 (update — `filter(policy -> !policy.getName().equals(ADMINISTRATOR_POLICY))`) + PolicyServiceImpl.java:83-95 (delete — same shape) — severity: LOW

- "PolicyJSONValidator.validate uses `IllegalArgumentException` rather than the project's domain exception (`BadUserRequestException` — used elsewhere in PolicyServiceImpl.java:13, 77, 88). The default Spring WebFlux exception mapping for `IllegalArgumentException` is `500 Internal Server Error` (unless a `@ControllerAdvice` translates it); the project does have an `ExceptionsHandler` but the mapping table for `IllegalArgumentException` is worth verifying — the operator's experience of POST'ing an invalid schema may surface as 500 rather than 400, masking that the request was actually well-formed-but-schema-invalid." — evidence: PolicyJSONValidator.java:28-32 (`throw new IllegalArgumentException(\"Policy is not valid: \" + errors)`) + PolicyServiceImpl.java imports of `BadUserRequestException` (line 13) used in the same class on other paths — severity: MEDIUM

- "`getPolicySchema` (`GET /api/policies/schema`, PolicyController.java:60-63) is NOT in `SECURITY_RULES` — it falls through to AuthorizationCustomizer's `pathMatchers(\"/**\").authenticated()` catch-all. Any authenticated user (regardless of permissions) can fetch the live JSON Schema used by PolicyJSONValidator. This isn't a vulnerability per se (the schema is server-side enforced anyway), but operators may assume the schema is a 'protected' artifact when it is not. The docs do not document the endpoint at all." — evidence: SecurityConstants.java:163-168 (only POLICY_CREATE/UPDATE/DELETE rules; no `/api/policies/schema` rule) + AuthorizationCustomizer.java:29-30 (`pathMatchers(\"/**\").authenticated()`) + PolicyController.java:60-63 — severity: LOW

- "No rate-limit, no max-policies-per-account throttle. A privileged-but-malicious user (or a stolen session of a MANAGEMENT-permission user) can create thousands of policies in a tight loop; nothing on the server limits the rate or the cardinality, and the `getPolicyList` endpoint pages over them which would degrade UI performance." — evidence: PolicyController.java:19-25 (no `@RateLimited`) + SecurityConstants.java:163-164 (no throttle metadata on the SecurityRule) + ReactivePolicyRepositoryImpl.java (no cardinality cap) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these three modes route through the SecurityWebFilterChain that AuthorizationCustomizer customises (the customiser iterates SECURITY_RULES and enforces POLICY_CREATE on `POST /api/policies`). `DISABLED` short-circuits all authorization via DisabledAuthSecurityConfiguration.java:14-18 (`anyExchange().permitAll()`) — POLICY_CREATE is NOT enforced in DISABLED mode; this is the HIGH-severity gap above. `S2S` does NOT apply — S2S is the ingestion-only auth mode (IngestionDataEntitiesFilter at /ingestion/entities), orthogonal to RBAC management endpoints.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. `IngestionDataEntitiesFilter` matches only `POST /ingestion/entities` (IngestionDataEntitiesFilter.java:28). POST /api/policies is a separate UI/admin endpoint; the ingestion S2S filter does not gate it.
- **authorization_assertions**:
  - "`SecurityRule(NO_CONTEXT, /api/policies, POST, POLICY_CREATE)` — Permission `POLICY_CREATE` (MANAGEMENT tier per PolicyPermissionDto.java:71) required, evaluated via ReactiveNonContextPermissionAuthorizationManager" — evidence: SecurityConstants.java:163-164 + PolicyPermissionDto.java:71 + ReactiveNonContextPermissionAuthorizationManager.java:14-28
  - "No `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call on the controller method itself" — evidence: PolicyController.java:19-25
- **owner_scoping**: `N/A — Policy is a platform-global resource, not data-scoped`. Policies are global authorization documents; the `policy` table has no `owner_id` column, no `getPoliciesByOwner` lookup. MANAGEMENT-tier permission gates them globally.
- **data_exposure**:
  - "PolicyDetails payload (id, name, role assignments, policy JSON statements, created/updated timestamps) → caller granted `POLICY_CREATE` Permission, OR any caller in an `auth.type=DISABLED` deployment"
  - "Creating a policy gives the creator no immediate authorization gain — the policy is inert until role-bound. BUT the creator who also has `ROLE_CREATE` / `ROLE_UPDATE` can bind the new policy to a role they belong to, completing an escalation. Both POLICY_CREATE and ROLE_* are MANAGEMENT-tier and seeded together on the Administrator role, but a custom MANAGEMENT/ALL policy bound to a non-Administrator role would also include both."
- **known_security_gaps**:
  - "Under `auth.type=DISABLED`, POLICY_CREATE is bypassed — any reachable caller can create MANAGEMENT/ALL policies. The full escalation requires also creating/binding a role, but `POST /api/roles` is similarly bypassed under DISABLED. Network-reachable DISABLED deployments are catastrophically exposed; the docs (Policies page, Permissions catalog, Authentication index) do not warn." — evidence: DisabledAuthSecurityConfiguration.java:14-18 + AuthorizationCustomizer.java:14-32 + SecurityConstants.java:163-164 — severity: HIGH (in DISABLED deployments)
  - "Policy creation is not audit-logged. The `policy` table is single-state (no append-only history table, no `log.info(\"created policy ...\")` in PolicyServiceImpl). A security review of 'who authored this dangerous MANAGEMENT/ALL policy?' has no in-application answer." — evidence: PolicyServiceImpl.java:62-69 (no log calls) + V0_0_55__add_policies_and_roles.sql:19-30 (no audit table) — severity: HIGH
  - "Anyone with MANAGEMENT/ALL can grant themselves arbitrary MANAGEMENT permissions by creating a policy with `resource: {type: MANAGEMENT}, permissions: [ALL]` and binding it to a role they belong to. The validator (PolicyJSONValidator.java + schema) does not block the MANAGEMENT/ALL combination — it is a legal policy shape, identical to the seeded Administrator. There is no 'cannot grant permissions you don't have' check (delegation/elevation guard). This is the design intent (an admin can author admin policies), but the consequence is that POLICY_CREATE is functionally root-on-the-platform and the docs do not flag this." — evidence: policy_schema.json:166-202 (MANAGEMENT type accepts ALL keyword) + PolicyServiceImpl.java:62-69 (no anti-elevation check) + V0_0_56__add_predefined_roles_and_policies.sql:22-28 (seeded Administrator uses MANAGEMENT/ALL) — severity: HIGH
  - "PolicyJSONValidator raises `IllegalArgumentException` instead of `BadUserRequestException` — depending on the project's `ExceptionsHandler` mapping, an invalid schema may surface as 500 rather than 400. Operators debugging a malformed policy may misread the error as a server bug." — evidence: PolicyJSONValidator.java:28-32 + PolicyServiceImpl.java:13 (uses `BadUserRequestException` elsewhere) — severity: MEDIUM
  - "Duplicate-name POST surfaces as DB UNIQUE-constraint violation rather than a clean 409 Conflict — caller cannot distinguish 'invalid input' from 'duplicate' from 'server error'." — evidence: PolicyServiceImpl.java:62-69 + V0_0_55__add_policies_and_roles.sql:30 — severity: MEDIUM
  - "`Administrator` name is reserved on UPDATE/DELETE but NOT on CREATE — if the seeded `Administrator` policy is ever soft-deleted, a custom `Administrator` could be re-created with arbitrary statements, confusing operators who rely on the name as a tripwire." — evidence: PolicyServiceImpl.java:62-69 vs PolicyServiceImpl.java:76, 87 — severity: LOW
  - "`GET /api/policies/schema` is not gated by any Permission (no SECURITY_RULES entry) — any authenticated user can fetch the live JSON Schema. Not a vulnerability, but the docs do not document the endpoint and operators may assume schema artefacts are admin-only." — evidence: SecurityConstants.java:163-168 (no schema-endpoint rule) + AuthorizationCustomizer.java:29-30 + PolicyController.java:60-63 — severity: LOW

## performance

- **hot_paths**:
  - "Endpoint runs synchronously from the caller's perspective: PolicyJSONValidator.validate (in-memory JSON parse + schema walk over a single statements array, sub-millisecond for typical policies) + 1 DB INSERT into `policy` (no joins). Not on the ingestion hot path; called rarely (per-policy authoring is an admin operation)." — evidence: PolicyJSONValidator.java:24-33 + PolicyServiceImpl.java:62-69 + ReactivePolicyRepositoryImpl.java:19-25 (inherits create from ReactiveAbstractSoftDeleteCRUDRepository)
- **throughput_characteristics**:
  - "Single-policy POST — no bulk-create endpoint. Reactive Mono signature, non-blocking from the WebFlux thread, single DB round-trip." — evidence: PolicyController.java:19-25 + PolicyServiceImpl.java:62-69
- **resource_allocation**:
  - "JsonSchema is loaded ONCE at PolicyJSONValidator construction (PolicyJSONValidator.java:18-22) — no per-request schema reparse. ObjectMapper is injected (project-wide singleton). Negligible per-request memory footprint." — evidence: PolicyJSONValidator.java:14-22
  - "POLICY_SCHEMA is also loaded as a `static final` String once at PolicyServiceImpl class-loading (PolicyServiceImpl.java:28, 37-43) — the same schema is held twice in memory (as a String for `getPolicySchema` and as a parsed JsonSchema in PolicyJSONValidator). Trivial memory cost for typical schema size (~5KB)." — evidence: PolicyServiceImpl.java:28, 37-43 + PolicyJSONValidator.java:18-22
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally. No locks, no advisory locks, no shared state. The unique-name index on `policy(name) WHERE deleted_at IS NULL` provides DB-level concurrency safety against two simultaneous POSTs of the same name (one wins with INSERT, the other gets unique_violation)." — evidence: PolicyController.java:14-17 + V0_0_55__add_policies_and_roles.sql:30
- **known_performance_gaps**:
  - "No bulk-create endpoint — bootstrapping a complex RBAC scheme via the API requires N HTTP calls. For platforms with custom role models, this is operator-time wasted but not platform-load-significant." — evidence: PolicyController.java:19-25 (single-policy signature) — severity: LOW

## sources

- understanding ← PolicyController.java:19-25 + PolicyServiceImpl.java:62-69 + PolicyJSONValidator.java:24-33 + SecurityConstants.java:163-164 + DisabledAuthSecurityConfiguration.java:9-18
- concepts.entities ← PolicyController.java:5-8 (DTO imports) + PolicyServiceImpl.java:7-12 + PolicyPermissionDto.java:13-89 + policy_schema.json:644-652
- concepts.operations ← PolicyServiceImpl.java:62-69
- concepts.invariants[0] ← SecurityConstants.java:163-164 + PolicyController.java:19-25 (no annotation)
- concepts.invariants[1] ← PolicyJSONValidator.java:24-33 + PolicyServiceImpl.java:64
- concepts.invariants[2] ← V0_0_55__add_policies_and_roles.sql:30 + PolicyServiceImpl.java:62-69 (no pre-check)
- concepts.invariants[3] ← PolicyServiceImpl.java:62-69 (no role binding in create)
- concepts.invariants[4] ← V0_0_56__add_predefined_roles_and_policies.sql:1-31 + policy_schema.json:166-202 + PolicyPermissionDto.java:71
- dependencies_semantic.requires-feature ← PolicyServiceImpl.java:25-69 + PolicyJSONValidator.java:13-33 + ReactivePolicyRepositoryImpl.java:18-25 + openapi.yaml:3517-3534
- dependencies_semantic.requires-config ← DisabledAuthSecurityConfiguration.java:10 + V0_0_56__add_predefined_roles_and_policies.sql:1-41
- dependencies_semantic.coupling ← SecurityConstants.java:163-168 + PolicyController.java:60-63 + AuthorizationCustomizer.java:21-30
- tests_coverage_semantic.test_files ← filesystem search for `Policy*.java` under odd-platform-api/src/test (only PolicyDeserializerTest exists; no controller/service/validator/integration test for createPolicy)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-12 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-12 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200)
- docs_link_semantic.inferred_docs[2] ← WebFetch 2026-05-12 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (status 200)
- docs_link_semantic.doc_drift_findings ← cross-reference of fetched live-page excerpts vs. SecurityConstants.java:163-164 + DisabledAuthSecurityConfiguration.java + PolicyServiceImpl.java:62-95
- implicit_adrs[0] ← SecurityConstants.java:163-168 + PolicyController.java:19-25 + consistent pattern across controllers
- implicit_adrs[1] ← PolicyJSONValidator.java:14-33 + PolicyServiceImpl.java:64, 73
- implicit_adrs[2] ← SecurityConstants.java:163-164 (NO_CONTEXT) + ReactiveNonContextPermissionAuthorizationManager.java:14-28
- implicit_adrs[3] ← PolicyServiceImpl.java:29, 76, 87
- implicit_adrs[4] ← V0_0_55__add_policies_and_roles.sql:30 + ReactivePolicyRepositoryImpl.java:19
- bugs_limitations_corner_cases[0] ← DisabledAuthSecurityConfiguration.java:9-18 + AuthorizationCustomizer.java:14-32 + SecurityConstants.java:163-164
- bugs_limitations_corner_cases[1] ← PolicyServiceImpl.java:62-69 + V0_0_55__add_policies_and_roles.sql:19-30
- bugs_limitations_corner_cases[2] ← PolicyServiceImpl.java:62-69 + ReactivePolicyRepositoryImpl.java + V0_0_55__add_policies_and_roles.sql:30
- bugs_limitations_corner_cases[3] ← PolicyServiceImpl.java:29, 62-69, 76, 87
- bugs_limitations_corner_cases[4] ← PolicyJSONValidator.java:28-32 + PolicyServiceImpl.java:13
- bugs_limitations_corner_cases[5] ← SecurityConstants.java:163-168 + AuthorizationCustomizer.java:29-30 + PolicyController.java:60-63
- bugs_limitations_corner_cases[6] ← PolicyController.java:19-25 + SecurityConstants.java:163-164
- security.auth_mode_relevance ← SecurityConstants.java:163-164 + DisabledAuthSecurityConfiguration.java:14-18 + AuthorizationCustomizer.java:14-32 + IngestionDataEntitiesFilter.java:28
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28
- security.authorization_assertions[0] ← SecurityConstants.java:163-164 + PolicyPermissionDto.java:71 + ReactiveNonContextPermissionAuthorizationManager.java:14-28
- security.authorization_assertions[1] ← PolicyController.java:19-25
- security.data_exposure ← PolicyServiceImpl.java:62-69 + V0_0_56__add_predefined_roles_and_policies.sql:1-41 + SecurityConstants.java:169-173 (ROLE_CREATE rule)
- security.known_security_gaps[0] ← DisabledAuthSecurityConfiguration.java:14-18 + SecurityConstants.java:163-164
- security.known_security_gaps[1] ← PolicyServiceImpl.java:62-69 + V0_0_55__add_policies_and_roles.sql:19-30
- security.known_security_gaps[2] ← policy_schema.json:166-202 + PolicyServiceImpl.java:62-69 + V0_0_56__add_predefined_roles_and_policies.sql:22-28
- security.known_security_gaps[3] ← PolicyJSONValidator.java:28-32 + PolicyServiceImpl.java:13
- security.known_security_gaps[4] ← PolicyServiceImpl.java:62-69 + V0_0_55__add_policies_and_roles.sql:30
- security.known_security_gaps[5] ← PolicyServiceImpl.java:62-69 vs 71-81, 83-95
- security.known_security_gaps[6] ← SecurityConstants.java:163-168 + AuthorizationCustomizer.java:29-30 + PolicyController.java:60-63
- performance.hot_paths ← PolicyJSONValidator.java:24-33 + PolicyServiceImpl.java:62-69 + ReactivePolicyRepositoryImpl.java:19-25
- performance.throughput_characteristics ← PolicyController.java:19-25 + PolicyServiceImpl.java:62-69
- performance.resource_allocation ← PolicyJSONValidator.java:14-22 + PolicyServiceImpl.java:28, 37-43
- performance.scaling_characteristics ← PolicyController.java:14-17 + V0_0_55__add_policies_and_roles.sql:30
- performance.known_performance_gaps[0] ← PolicyController.java:19-25

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes


---
node_id: "odd-platform java RoleController controller-method:createRole"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-E-RoleController-createRole
---

# RoleController.createRole — semantic understanding

## understanding

`POST /api/roles` creates a new Role — a named bundle of Policy references that can be attached to an Owner (and through the user→owner mapping, to authenticated users) to grant authorization permissions. The controller is a thin reactive delegate (`RoleController.java:19-25`) that hands the parsed `RoleFormData` to `RoleService.create` (`RoleServiceImpl.java:51-61`), which maps the form to a `RolePojo`, persists it via `ReactiveRoleRepository.create`, then writes role↔policy relations via `roleToPolicyRepository.createRelations` and re-reads the resulting `RoleDto`. The endpoint sits behind the platform's RBAC gate — `SecurityConstants.SECURITY_RULES` line 169 declares `("/api/roles", POST) → ROLE_CREATE` (NO_CONTEXT) — so the caller must hold a Policy granting `ROLE_CREATE` to reach the controller body.

## concepts

- entities: ["Role (id, name, policies)", "Policy (referenced by id in the form)", "RoleFormData (request body: name + policies[])", "RolePojo (DB row)", "RoleDto (Role + joined policy_relations)", "UserProviderRole.ADMIN / .USER (predefined seeded roles)", "ROLE_CREATE permission (PolicyPermissionDto)", "owner-to-role mapping (downstream, not touched by create)"]
- operations: ["accept a POST /api/roles request body with `name` + `policies[]`", "map to RolePojo and INSERT into `role` table", "INSERT role_id↔policy_id rows into `role_to_policy`", "re-read the resulting RoleDto and return 200 OK with the populated Role payload"]
- invariants: ["the endpoint is gated by SECURITY_RULES — only callers with ROLE_CREATE permission may invoke it (SecurityConstants.java:169)", "the entire create flow runs under `@ReactiveTransactional` (RoleServiceImpl.java:50) — partial role-without-relations cannot persist", "the partial unique index `role_name_unique` on `role(name) WHERE deleted_at IS NULL` (V0_0_55__add_policies_and_roles.sql:42; recreated by V0_0_64) enforces name uniqueness AT THE DATABASE LAYER ONLY — there is no service-layer pre-check", "predefined roles 'Administrator' and 'User' are seeded by Flyway migration V0_0_56 — they pre-exist with stable names but mutable ids", "an empty / missing `policies` array yields `List.of()` and a role with zero policy bindings (RoleServiceImpl.java:128-134)"]
- audiences: ["platform administrators creating named permission bundles (e.g. 'Data Steward', 'Read-Only Auditor') to be attached to owners", "the UI's `Management → Access Control → Roles` screen", "anyone — human or service — who holds a Policy granting `ROLE_CREATE`, including any S2S API-key caller (which gets ADMIN+ROLE_CREATE by default per S2sAuthenticationFilter)"]

## dependencies_semantic

- requires-feature: ["the ODD authorization framework (Policy / Permission / Role / Owner / user-owner mapping) — `RoleController` would be inert without `SecurityConstants.SECURITY_RULES`, `PermissionService`, and the `role` / `policy` / `role_to_policy` tables", "the OpenAPI-generated `RoleApi` interface — `RoleController implements RoleApi` (line 16), and the routing / serialisation contract lives in `odd-platform-specification/openapi.yaml:3601-3636` + `components.yaml:3368-3379`", "Spring WebFlux reactive stack — `Mono<ResponseEntity<Role>>` signature requires the platform to run in reactive mode (no servlet variant exists)", "the active authentication mode wired by one of the four `*SecurityConfiguration` classes — the SECURITY_RULES gate only fires under LOGIN_FORM / OAUTH2 / LDAP; under `auth.type=DISABLED` (the bundled default in application.yml) the `AuthorizationCustomizer` is NOT wired and ROLE_CREATE is reachable unauthenticated (DisabledAuthSecurityConfiguration.java + LSN-001-shape)"]
- requires-config: ["auth.type — controls whether the SECURITY_RULES gate fires (DisabledAuthSecurityConfiguration skips it; LoginForm / OAuth2 / LDAP wire it)", "the `role_to_policy` and `role` table schemas (Flyway V0_0_55, V0_0_56, V0_0_64) — required at boot or the JOOQ-generated `RoleRecord` mappings fail to load", "no controller-specific properties; `RoleController` does not read `@Value` anything"]
- requires-runtime: ["a PostgreSQL connection with the JOOQ-generated `role`, `policy`, `role_to_policy` tables present and migrated through at least V0_0_56", "Spring Security context populated by whichever `*SecurityConfiguration` is active — without it, `permissionService.hasPermission(...)` (invoked from `AuthorizationCustomizer` via `manager(NO_CONTEXT, ..., ROLE_CREATE)`) cannot resolve the caller's authorities"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: POST /api/roles returns 200 with the created Role (the OpenAPI spec at openapi.yaml:3629 declares 201, but RoleController.java:24 returns 200 via `ResponseEntity::ok` — code-spec drift, no test asserts the actual status)"
  - "behaviour: SECURITY_RULES ROLE_CREATE gate blocks a caller without the permission (no integration test in `odd-platform-api/src/test`)"
  - "behaviour: SECURITY_RULES gate is BYPASSED under `auth.type=DISABLED` (no test covers the DISABLED-mode security-posture)"
  - "behaviour: S2S API-key caller (ADMIN-by-default per S2sAuthenticationFilter) can create roles under LOGIN_FORM / OAUTH2 / LDAP"
  - "behaviour: empty `policies` list creates a role with zero policy bindings (RoleServiceImpl.java:128-134 returns `List.of()`)"
  - "behaviour: nonexistent policy id in `policies[]` — does `roleToPolicyRepository.createRelations` reject, or does the JOIN-row INSERT silently fail / FK-error? (no validation in the service layer at RoleServiceImpl.java:51-61)"
  - "behaviour: duplicate role name — does the `role_name_unique` partial index produce a 409 / 400, or does it bubble as a 500 with a Postgres `duplicate key` message? (no service-layer pre-check at RoleServiceImpl.java:51-61; no `BadUserRequestException` for unique-violation)"
  - "behaviour: empty / null `name` — RoleFormData has `required: [name, policies]` in components.yaml:3377-3379 but no minLength / pattern; what does `roleRepository.create` do with empty string? (no test)"
  - "behaviour: creating a role with the exact name 'Administrator' or 'User' (predefined names) — IS rejected by `role_name_unique` ONLY because the migration V0_0_56 already inserted those rows; if an operator hard-deletes them, this protection vanishes (no service-layer check on UserProviderRole names AT CREATE, unlike `update` and `delete` which DO check — RoleServiceImpl.java:68-69 and 81-84)"
  - "behaviour: ReactiveTransactional rollback on roleToPolicyRepository.createRelations failure (RoleServiceImpl.java:50,56-57) — does the inserted role row get rolled back?"
  - "behaviour: name length / charset — the live docs do not specify a limit; the DB column is `name VARCHAR` (V0_0_55__add_policies_and_roles.sql) with PostgreSQL's unbounded default — a 1MB name is theoretically accepted"
- test_files: []
- gaps: |
    Zero test coverage of the entire Role lifecycle in `odd-platform-api/src/test`. `find odd-platform-api/src/test -name '*Role*.java'` returns empty (Grep 2026-05-12). No controller test, no service-layer test, no integration test, no WebFluxTest slice. The endpoint is RBAC-gated, mutates shared platform state (creating a Role attaches to Owners which authorize EVERY downstream action), and is referentially coupled to PolicyController (a Role is a bundle of Policies). A regression that (a) inverted the SECURITY_RULES path matcher so `("/api/roles", POST)` granted to wrong permission; (b) dropped the `@ReactiveTransactional` annotation leaking partial role-without-relations rows; (c) allowed creating a Role named "Administrator" when the predefined seed had been deleted (re-establishing the protected-name semantically but with a different id+policies); (d) returned 200 instead of the spec's 201; (e) leaked the Postgres unique-violation as a 500; or (f) accepted policy ids referencing soft-deleted policies (no `WHERE deleted_at IS NULL` filter in createRelations — not verified in this pass) would all ship unchallenged. The unprotected-name-on-create is the highest-leverage gap: `update` and `delete` explicitly check `UserProviderRole.values()` (RoleServiceImpl.java:68, 81-84) but `create` does not — so an operator who somehow drops the seeded Administrator row (e.g. via a manual SQL DELETE) can recreate it via this endpoint with attacker-chosen policy bindings.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles"
    anchor: ""
    rationale: "The canonical user-facing page for Roles in ODD's authorization model. Documents what a Role is and the two predefined roles (USER / ADMIN) but does NOT document the role-creation API surface, name constraints, uniqueness rules, or the ROLE_CREATE permission."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Parent authorization page; lists Roles as a sub-topic but does not embed creation guidance."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Security overview; documents auth.type modes that determine whether the SECURITY_RULES gate on this endpoint fires."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles` (WebFetched 2026-05-12, status 200):
    - "A role is useful for combining multiple policies together."
    - "USER: regular user who doesn't have any permissions by default"
    - "ADMIN: administrator, who has all permissions"
    - Warning quoted from the page: "Be careful and don't associate user with admin role with non-admin owner."
    - The page mentions "admin groups for AWS Cognito or admin team in GitHub" as examples of provider-side role assignment, but does NOT describe how those provider-issued roles map to or interact with platform-created Role rows.
    - The page provides NO content on (a) creating new roles via the UI or API, (b) name format / length / uniqueness constraints, (c) whether predefined roles can be overwritten, (d) audit / logging behaviour for role mutations, (e) the API endpoint shape (no `POST /api/roles` documentation).

    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (WebFetched 2026-05-12, status 200):
    - The authorization index page lists `Roles` as a sub-topic but contains no embedded role-creation guidance.

- doc_drift_findings:
  - "Live docs at `/authorization/roles` describe Roles as 'useful for combining multiple policies together' but do NOT document the `POST /api/roles` creation surface, the `ROLE_CREATE` permission required to invoke it, or the partial-unique-name index enforcing uniqueness. An operator reading the Roles page learns only that the two predefined roles exist (`USER`, `ADMIN`) — there is no signal that custom roles are creatable, much less how to create them or which permission gates the action. The UI's Management→Access Control→Roles screen and `POST /api/roles` are de facto undocumented features."
  - "Live docs do NOT document the `Administrator` / `User` name-protection asymmetry between `create` and `update`/`delete`. `RoleServiceImpl.update` (line 68-69) and `.delete` (line 81-84) explicitly check `UserProviderRole.values()` and reject mutations targeting the predefined names; `RoleServiceImpl.create` (line 51-61) has NO such check. If an operator deletes the seeded `Administrator` row (e.g. via direct SQL bypassing the soft-delete API), this endpoint can recreate a row named 'Administrator' with attacker-chosen policy bindings — and any LDAP / OAuth2 / DISABLED-mode user mapped to that role gains those bindings transparently."
  - "Live docs do NOT document the relationship (or lack thereof) between platform-created Role rows and LDAP `admin-groups` (`auth.ldap.groups.admin-groups`) or OAuth2 admin claims (`auth.oauth2.client.{id}.admin-attribute` / `auth.oauth2.client.{id}.admin-principals`). Reading the LDAP / OAuth2 / Roles pages together, an operator might reasonably believe creating a Role named 'admins' or 'Administrator' would automatically grant it to LDAP users in the configured admin-groups. The actual implementation (LDAPSecurityConfiguration.java:91-99, OAuthSecurityConfiguration.java + GrantedAuthoritiesMapper) maps directory groups DIRECTLY to `UserProviderRole.ADMIN` / `.USER`, NOT to platform Role rows. Custom roles created via this endpoint are reachable ONLY through the Owner→Role attachment chain (Management UI / `OwnerToRoleRepository`), never automatically via auth-mode group mapping."
  - "Live docs do NOT mention that the OpenAPI spec at `openapi.yaml:3629` declares a 201 response for POST /api/roles, while the controller returns 200 (`RoleController.java:24` — `.map(ResponseEntity::ok)`). The spec-vs-code drift is silent: callers writing client code from the spec will treat 200 as an error case (the spec says ONLY 201 is the success branch)."
  - "Live docs do NOT mention the absence of audit logging on role creation. There is no `@Slf4j` log line, no audit table insert, no event publication on `RoleServiceImpl.create` (RoleServiceImpl.java:51-61). A privileged caller creating a malicious Role leaves no trail in the platform's logs unless an external mechanism (database audit trigger, network IDS) is configured."

## implicit_adrs

- "Role mutation endpoints (create / update / delete) are uniformly gated by the SECURITY_RULES table — `POST /api/roles → ROLE_CREATE`, `PUT /api/roles/{id} → ROLE_UPDATE`, `DELETE /api/roles/{id} → ROLE_DELETE` — all NO_CONTEXT (no resource-extractor). The pattern matches the sibling Policy / Owner / Tag / Namespace mutation endpoints (SecurityConstants.java lines 100-173): every NO_CONTEXT mutation has a single named Permission. This is a deliberate platform-wide convention: 'every mutating /api/* endpoint requires a Permission; resource-context endpoints attach an extractor; everything else is permitAll-then-authenticated.'" — evidence: SecurityConstants.java:169-173 + the parallel structure across NAMESPACE/POLICY/ROLE/TAG/OWNER blocks at lines 100-173 — intent_anchor: the uniform `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(..., METHOD), PERMISSION)` shape repeated 30+ times across the file with no exception — confidence: HIGH

- "Predefined system roles are protected from MUTATION (update / delete) by service-layer enum checks against `UserProviderRole.values()` (RoleServiceImpl.java:67-69 + 81-84) but NOT from CREATION — i.e. the platform's deliberate posture is 'the seeded Administrator/User rows are immutable in-place, but the names are only protected for as long as the seeded rows exist'. The partial unique index `role_name_unique` (V0_0_55__add_policies_and_roles.sql:42) provides the actual recreation-blocking enforcement at the DB layer — the service code's enum check is a higher-quality error path (`BadUserRequestException` vs. raw SQL state)." — evidence: RoleServiceImpl.java:67-69 + 81-84 + V0_0_55__add_policies_and_roles.sql:42 + V0_0_56__add_predefined_roles_and_policies.sql:33-36 — intent_anchor: the explicit `UserProviderRole.values()` enumeration check on update/delete plus the `BadUserRequestException("Role is predefined and cannot be deleted")` and `BadUserRequestException("Administrator role is not editable")` messages — confidence: HIGH

- "The role-to-policy relation is rewritten ENTIRELY on every `update` (RoleServiceImpl.java:112-121 — `deleteRoleRelationsExcept(role.getId(), newPolicies)` then `createRelations(...)`), but is INSERT-ONLY on `create` (lines 56-57 — `createRelations(role.getId(), policies)`). This is consistent with the create/update asymmetry — a new role has no prior relations, so the create path doesn't need the diff. The deliberate platform decision is 'role-policy edges are owned by the Role, not the Policy; mutate them as a set on update, never diff individually'." — evidence: RoleServiceImpl.java:56-57 (create) + 112-121 (update) — intent_anchor: the parallel `roleToPolicyRepository.createRelations(...)` call on both paths but only the update path calls `deleteRoleRelationsExcept(...)` first — confidence: HIGH

- "`@ReactiveTransactional` (RoleServiceImpl.java:50) wraps the create flow — role INSERT + role↔policy INSERTs run in a single transaction. The platform's deliberate posture is 'no orphan role rows without their policy relations; no orphan role↔policy rows without their parent role'. This matches the same annotation on `update` (line 64) and `delete` (line 77) — every mutating service method on Roles is transactional." — evidence: RoleServiceImpl.java:50, 64, 77 — intent_anchor: the uniform `@ReactiveTransactional` annotation on all three mutating methods plus the implementation pattern (multi-step flatMap chain inside a single Mono per method) — confidence: HIGH

## bugs_limitations_corner_cases

- "`RoleServiceImpl.create` (lines 51-61) does NOT check `UserProviderRole.values()` before creating a new Role, unlike `.update` (line 68-69) and `.delete` (line 81-84) which DO. The only thing preventing recreation of a row named 'Administrator' or 'User' is the partial unique index `role_name_unique` on `role(name) WHERE deleted_at IS NULL` (V0_0_55__add_policies_and_roles.sql:42). If an operator hard-deletes the seeded Administrator row (e.g. `DELETE FROM role WHERE name='Administrator'` via direct SQL — bypassing the soft-delete path), this endpoint can recreate it with attacker-chosen policy bindings. The recreated row will then bind to any user-owner mapping that referenced the original Administrator role's id (FK semantics depend on the `owner_to_role` and `role_to_policy` cascade behaviour, not verified in this pass). The asymmetry is silent: no comment, no exception, no doc warning." — evidence: RoleServiceImpl.java:51-61 (no UserProviderRole check) compared to RoleServiceImpl.java:67-69 + 81-84 (check present) + V0_0_55__add_policies_and_roles.sql:42 + V0_0_56__add_predefined_roles_and_policies.sql:33-36 — severity: HIGH

- "OpenAPI spec / controller status-code drift: `openapi.yaml:3629` declares `'201': The resource has been successfully created` as the success response for POST /api/roles. `RoleController.java:24` returns `ResponseEntity::ok` (200). The spec is wrong or the controller is wrong; either way, a generated client compiled from the spec will treat the actual 200 response as an unexpected status. The same drift affects PUT /api/roles/{id} — spec declares 201 (openapi.yaml:3656), controller returns 200 (RoleController.java:42)." — evidence: RoleController.java:24,42 + openapi.yaml:3629,3656 — severity: MEDIUM

- "Zero validation on the role `name` field at the application layer. `RoleFormData` (components.yaml:3368-3379) declares `name: string` as required but has NO `minLength`, `maxLength`, or `pattern`. `RoleServiceImpl.create` (line 51-61) passes the raw value through `roleMapper.mapToPojo(formData)` to JOOQ INSERT without trimming, validating, or rejecting empty strings. A POST with `{ \"name\": \"\", \"policies\": [] }` produces either a `null`-constraint violation (if `role.name` is `NOT NULL`) or successfully inserts an empty-name role — the latter would then collide with subsequent empty-name creates (uniqueness) but pass the first call. No service-layer guard; the DB layer is the only fence. Live docs do not specify name constraints." — evidence: components.yaml:3368-3379 + RoleServiceImpl.java:51-61 + RoleMapper (mapper class not read this pass; the call site shows no transformation other than direct field copy) — severity: MEDIUM

- "Zero validation that policy ids in `RoleFormData.policies` reference EXISTING and NOT-soft-deleted policies. `RoleServiceImpl.getPolicyIdsList` (lines 128-134) extracts `policy.getId()` from the form payload and passes the raw id list to `roleToPolicyRepository.createRelations(role.getId(), policies)` (line 57). If the caller submits an arbitrary integer id, the JOIN row INSERT will fail with a Postgres FK error (assuming the `role_to_policy` table has a FK to `policy.id`; not verified in this pass), which surfaces as a 500. If the FK references the live table without `deleted_at` filtering, soft-deleted policies could still satisfy the FK and produce a Role bound to invisible / unreachable Policies. No pre-check, no validation error message, no doc warning." — evidence: RoleServiceImpl.java:57,128-134 + ReactiveRoleToPolicyRepository (FK / filter semantics not verified this pass) — severity: MEDIUM

- "Duplicate-role-name handling surfaces as a raw SQL state from PostgreSQL. `RoleServiceImpl.create` (lines 51-61) does NOT pre-check `roleRepository.getByName(formData.getName())`. The partial unique index `role_name_unique` (V0_0_55__add_policies_and_roles.sql:42) raises a `duplicate key value violates unique constraint` error on the second create call with the same name; with no explicit catch / translation, this surfaces as a 500 / generic error rather than a 409 Conflict or 400 Bad Request with a clean message. Compare to the `update` path which produces tidy `BadUserRequestException` messages (lines 68-69, 105-106). Operators reading the live docs cannot tell what HTTP status a duplicate-name attempt will produce." — evidence: RoleServiceImpl.java:51-61 (no pre-check, no try/catch) + V0_0_55__add_policies_and_roles.sql:42 — severity: MEDIUM

- "No audit logging on role mutations. `RoleServiceImpl.create` (lines 51-61), `.update` (lines 65-74), and `.delete` (lines 78-92) do NOT emit `@Slf4j` log lines, do NOT publish events, and do NOT insert into any audit table. A privileged caller who creates / mutates / deletes Roles leaves no trail in the platform's logs. The activity feed (`/api/activity`, the platform's audit-trail surface) covers DataEntity / Owner mutations (per the activity feed sidecars) but does NOT extend to Role / Policy / Permission mutations. This is the highest-leverage audit gap in the RBAC surface: a hijacked admin account or an S2S API key can rewrite the authorization model invisibly." — evidence: RoleServiceImpl.java:39-92 (no log lines, no event publication) + cross-axis observation: the activity feed (`/api/activity`) does not include RBAC mutation events — severity: HIGH

- "Under `auth.type=DISABLED` (the bundled default in application.yml — DisabledAuthSecurityConfiguration.java:10), the `AuthorizationCustomizer` is NOT wired into the security chain, so the `SECURITY_RULES` entry for `("/api/roles", POST) → ROLE_CREATE` (SecurityConstants.java:169) is INERT. The endpoint is reachable unauthenticated — any HTTP caller can create / mutate roles on a deployment running the default configuration. This is the LSN-001-shape failure mode (silently insecure default surfaced as a platform-wide implicit ADR — REFACTOR-073 in `lineage/odd-platform/refactoring-scopes.md`)." — evidence: DisabledAuthSecurityConfiguration.java:10 + SecurityConstants.java:169 + the absence of `AuthorizationCustomizer` wiring in DisabledAuthSecurityConfiguration.java + REFACTOR-073 — severity: HIGH

- "Under any non-DISABLED auth mode with `auth.s2s.enabled=true` (LDAPSecurityConfiguration.java:149-151 + OAuthSecurityConfiguration.java + LoginFormSecurityConfiguration.java — same insertion pattern), any caller carrying a valid `X-API-Key` is injected into the security context as `ADMIN` with ADMIN authority (S2sAuthenticationFilter.java:31-39). The S2S identity is granted `ROLE_CREATE` by way of being ADMIN — so any S2S API-key holder can create new Roles, including a role that grants further Permissions to itself or to other Owners (S2S identity is implicit-admin everywhere). This is REFACTOR-108 in `refactoring-scopes.md`." — evidence: LDAPSecurityConfiguration.java:149-151 + S2sAuthenticationFilter.java:31-39 + SecurityConstants.java:169 + REFACTOR-108 — severity: HIGH

- "Predefined roles are name-checked case-INSENSITIVELY on delete (RoleServiceImpl.java:81-84 — `equalsIgnoreCase(role.getName())`) but case-SENSITIVELY on update (line 68 — `equals(UserProviderRole.ADMIN.getValue())`). An operator can: (a) create a role named 'administrator' (lowercase) — bypasses the unique index because it's a different string; (b) cannot delete it because the case-insensitive check matches the predefined enum; (c) CAN update it because the case-sensitive check does NOT match. The semantic gap is small but the inconsistency is suspect." — evidence: RoleServiceImpl.java:68 (case-sensitive `.equals(...)`) vs. 82 (case-insensitive `.equalsIgnoreCase(...)`) — severity: LOW

- "No max-length / charset constraint on role name. `role.name VARCHAR` (V0_0_55__add_policies_and_roles.sql) defaults to PostgreSQL's unbounded `text`-equivalent. The platform accepts a 1MB role name, a name with Unicode RTL override characters, a name with embedded null bytes (`\\0`), a name with whitespace-only content (`'   '`). The live docs do not specify a limit. UI rendering / log truncation / SQL filter behaviour for pathological names is unspecified." — evidence: V0_0_55__add_policies_and_roles.sql + RoleServiceImpl.java:51-61 (no length validation) + RoleFormData spec at components.yaml:3368-3379 (no pattern/length) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | S2S` (the SECURITY_RULES gate at SecurityConstants.java:169 is wired into the `AuthorizationCustomizer` only by the LOGIN_FORM / OAUTH2 / LDAP `SecurityWebFilterChain` factories — NOT by DisabledAuthSecurityConfiguration. S2S sits in the same chain and shortcuts to ADMIN). Under `auth.type=DISABLED` the gate is inert and the endpoint is unauthenticated.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. `/api/roles` does NOT match the `/ingestion/**` whitelist or the `IngestionDataEntitiesFilter` path filter (which scopes to `/ingestion/entities`).
- **authorization_assertions**:
  - "`SecurityConstants.SECURITY_RULES` entry at line 169: `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/roles\", POST), ROLE_CREATE)` — caller must hold a Policy granting `ROLE_CREATE` permission. NO_CONTEXT means no resource-id extraction; the permission is a global capability, not scoped to a particular Role / Owner." — evidence: SecurityConstants.java:169 + AuthorizationCustomizer.java:24-28
  - "Under S2S API-key auth (X-API-Key header), `S2sAuthenticationFilter.java:31-39` injects ADMIN authority — the S2S caller automatically holds ROLE_CREATE and every other Permission." — evidence: S2sAuthenticationFilter.java:31-39 + the implicit `ALL` permission policy seeded by V0_0_56 for the Administrator role
  - "Under `auth.type=DISABLED`, no gate is evaluated — the controller method is reachable to any HTTP caller. The `AuthorizationCustomizer` is NOT wired by `DisabledAuthSecurityConfiguration` (DisabledAuthSecurityConfiguration.java)." — evidence: DisabledAuthSecurityConfiguration.java + the absence of `AuthorizationCustomizer` reference in that class
- **owner_scoping**: `N/A — code is not data-scoped`. Roles are a platform-global concept — they are not owned by any particular Owner; they ARE the binding between Permission bundles and Owners. Once created, a Role is visible in the role list to every authenticated caller who hits `GET /api/roles` (which is permitAll under the SECURITY_RULES table — there is NO list-roles gate; only ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE are gated). This is consistent with ADR-CANDIDATE-003 (read-collaborative / mutating-gated) and the sibling Policy / Tag / Namespace patterns.
- **data_exposure**:
  - "On successful create: the returned `Role` payload (id, name, policies[]) — exposed to the caller that just created it. Policies are returned with their full statement list (per `RoleDto.policies` JSON aggregation in ReactiveRoleRepositoryImpl.java:42-50)." — evidence: RoleController.java:22-24 + RoleServiceImpl.java:59-60
  - "On failure: a Postgres SQL state (e.g. unique-key violation on duplicate name) likely surfaces as a 500 with the Postgres error message in the response body — potential disclosure of column name `name` and constraint name `role_name_unique`. No global exception handler explicitly translates DataIntegrityViolationException to a sanitised response on this path (not verified in this pass — no `@ExceptionHandler` on RoleController; the global handler chain is in the GlobalExceptionHandler bean which was not read this pass)." — evidence: RoleServiceImpl.java:51-61 (no try/catch around the repository INSERT) + V0_0_55__add_policies_and_roles.sql:42
  - "No data exposure to other callers from the act of creation itself — the side effect (a new Role row) is visible to anyone calling `GET /api/roles` (cross-axis: RoleController.getRolesList — read-collaborative)."
- **known_security_gaps**:
  - "Predefined-name protection asymmetry: `create` does NOT check `UserProviderRole.values()` while `update` and `delete` DO (RoleServiceImpl.java:51-61 vs. 67-69 + 81-84). An operator who hard-deletes the seeded Administrator row (bypassing the soft-delete path) can recreate it via this endpoint with attacker-chosen policies." — evidence: RoleServiceImpl.java:51-61 + 67-69 + 81-84 + V0_0_56__add_predefined_roles_and_policies.sql:33-36 — severity: HIGH
  - "No audit logging on role mutations. A hijacked admin (or any S2S API-key holder) can rewrite the authorization model — create new high-privilege Roles, attach them to existing Owners through other endpoints, or replace Policy bindings — and leave no trail in the platform's logs. The `activity` feed does NOT cover Role / Policy / Permission mutations (cross-axis observation; activity feed sidecars cover DataEntity / Owner activity)." — evidence: RoleServiceImpl.java:39-92 (no Slf4j, no event publishing) — severity: HIGH
  - "DISABLED mode (the bundled default) leaves this endpoint unauthenticated. Combined with the global ADMIN-by-default principal under DISABLED, an attacker with network reach can issue `POST /api/roles` to create a Role with `MANAGEMENT/ALL` Policy and chain into full platform compromise. This is the canonical LSN-001-shape failure on the RBAC surface — REFACTOR-073 (no boot-time security-posture validator)." — evidence: DisabledAuthSecurityConfiguration.java + SecurityConstants.java:169 + REFACTOR-073 in `lineage/odd-platform/refactoring-scopes.md` — severity: HIGH
  - "S2S API-key holders are implicit ADMIN (S2sAuthenticationFilter.java:31-39). Any S2S caller can create new high-privilege Roles. The S2S token grants ADMIN globally, not scoped to ingestion — this is REFACTOR-108. The live docs surface this for `/ingestion` paths but not for the RBAC surface (`/api/roles`, `/api/policies`)." — evidence: S2sAuthenticationFilter.java:31-39 + SecurityConstants.java:169 + REFACTOR-108 in `lineage/odd-platform/refactoring-scopes.md` — severity: HIGH
  - "No validation that policy ids in the request body reference live, non-soft-deleted Policies. A Role can be created bound to a Policy id that does not exist (FK error surfacing as 500) or — depending on the `role_to_policy` table's FK filter semantics — to a soft-deleted Policy id (invisible to subsequent `GET` but bindable). Not verified in this pass; surfacing as suspect." — evidence: RoleServiceImpl.java:57,128-134 — severity: MEDIUM
  - "Role name field accepts arbitrary length / charset. A name with Unicode RTL-override characters, embedded null bytes, or 1MB+ length is accepted by both spec (components.yaml:3368-3379 — no `minLength`/`maxLength`/`pattern`) and the service code. UI rendering and log truncation behaviour for pathological names is undefined." — evidence: components.yaml:3368-3379 + RoleServiceImpl.java:51-61 + V0_0_55__add_policies_and_roles.sql — severity: LOW
  - "No content-type validation beyond what the framework's JSON deserialiser provides. A request with `Content-Type: application/json` and a malformed body produces a Spring WebFlux deserialization error (`ServerWebInputException`) — surface and message are framework defaults, not platform-curated." — evidence: RoleController.java:19-25 (no explicit content-type guard, no `@Valid` annotation since the controller delegates to OpenAPI-generated `RoleApi`) — severity: LOW
  - "Cross-reference to LDAP / OAuth2 group mapping: Roles created via this endpoint are reachable ONLY through the Owner→Role attachment chain (UI Management + `OwnerToRoleRepository`). LDAP `admin-groups` (`auth.ldap.groups.admin-groups`, LDAPSecurityConfiguration.java:94-99) and OAuth2 admin claims (per OAuthSecurityConfiguration's `GrantedAuthoritiesMapper`) map directory groups DIRECTLY to `UserProviderRole.ADMIN` / `.USER` — not to platform Role rows. A custom Role named 'Administrator' (lowercase) would NOT be auto-granted to LDAP users in `admin-groups` even if its policies are identical to the predefined Administrator's. This is documentation-shaped, not a security bug — but it is a recurring operator confusion the live docs do not address." — evidence: LDAPSecurityConfiguration.java:91-99 + RoleServiceImpl.java:51-61 (no auth-mode coupling) + the LDAP sidecar at `lineage/odd-platform/understanding/odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md` — severity: MEDIUM (operator confusion / documentation gap)

## performance

- **hot_paths**:
  - "Single POST per role-creation; the operation runs three DB calls in sequence inside one transaction (roleRepository.create → roleToPolicyRepository.createRelations(N rows) → roleRepository.getDto). N == policies.length. For a typical role with 1-10 policies, total wall-clock is bounded by the network RTT plus three Postgres round-trips on the same reactive connection." — evidence: RoleServiceImpl.java:51-61
  - "AuthorizationCustomizer evaluates ~100+ SECURITY_RULES per request to find a path match (SecurityConstants.java:98-355 + AuthorizationCustomizer.java:22-30). Per-request cost is O(N rules) — same as every other gated endpoint." — evidence: SecurityConstants.java:98-355 + AuthorizationCustomizer.java:22-30
- **throughput_characteristics**:
  - "Reactive Mono signature — non-blocking, but per-call DB round-trips dominate. No batch-create endpoint exists; an admin migrating 100 Roles must issue 100 separate POSTs." — evidence: RoleController.java:19-25 + RoleApi spec (no batch variant in openapi.yaml:3601-3636)
- **resource_allocation**:
  - "No explicit timeout on the reactive pipeline; depends on the underlying R2DBC pool's per-call default (typically 30s in Spring Boot defaults — not verified for this deployment)." — evidence: RoleServiceImpl.java:51-61 (no `.timeout(...)` operator)
  - "Memory: bounded — the request body is small (a name + a short policy id list); the result includes the joined policies aggregated as JSON (ReactiveRoleRepositoryImpl.java:42-50). A pathological role with 10000 policies would produce a multi-MB response — no upper bound on the input policies list size in the spec." — evidence: components.yaml:3368-3379 (no maxItems on policies) + RoleServiceImpl.java:51-61
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally." — evidence: RoleController.java:15 (`@RequiredArgsConstructor`, no instance state) + lack of any cache / lock
  - "Concurrent creates of the same role name race at the DB unique-index; one wins, the other gets a duplicate-key error. No application-level coordination." — evidence: RoleServiceImpl.java:51-61 + V0_0_55__add_policies_and_roles.sql:42
- **known_performance_gaps**:
  - "No bulk-create endpoint. Migrating Roles in bulk requires N HTTP round-trips. For an enterprise migration from a different RBAC tool, this is operationally annoying but not a runtime bottleneck." — evidence: RoleApi spec (openapi.yaml:3601-3636) — severity: LOW
  - "No upper bound on `RoleFormData.policies[]` size (components.yaml:3368-3379). A request with 10000 policy ids produces 10000 INSERTs into `role_to_policy` in one transaction — large transactions on a hot table." — evidence: components.yaml:3368-3379 + RoleServiceImpl.java:57 — severity: LOW

## sources

- understanding ← RoleController.java:19-25 + RoleServiceImpl.java:51-61 + SecurityConstants.java:169
- concepts.entities ← RoleController.java:5-8 + RoleServiceImpl.java:1-37 + UserProviderRole.java:8-12 + components.yaml:3368-3379
- concepts.operations ← RoleController.java:19-25 + RoleServiceImpl.java:51-61
- concepts.invariants[SECURITY_RULES gate] ← SecurityConstants.java:169
- concepts.invariants[ReactiveTransactional] ← RoleServiceImpl.java:50
- concepts.invariants[role_name_unique partial index] ← V0_0_55__add_policies_and_roles.sql:42 + V0_0_64__remove_is_deleted_field.sql:88-90 + V0_0_58__rename_constraints.sql:3-9
- concepts.invariants[predefined seeded roles] ← V0_0_56__add_predefined_roles_and_policies.sql:33-36 + UserProviderRole.java:8-12
- concepts.invariants[empty policies → no bindings] ← RoleServiceImpl.java:128-134
- concepts.audiences ← live docs (WebFetched 2026-05-12) + SecurityConstants.java:169 + S2sAuthenticationFilter.java:31-39
- dependencies_semantic.requires-feature.[authorization framework] ← SecurityConstants.java:169 + AuthorizationCustomizer.java + V0_0_55__add_policies_and_roles.sql
- dependencies_semantic.requires-feature.[OpenAPI-generated RoleApi] ← RoleController.java:4,16 + openapi.yaml:3601-3636 + components.yaml:3368-3379
- dependencies_semantic.requires-feature.[reactive stack] ← RoleController.java:11-12,20
- dependencies_semantic.requires-feature.[auth-mode wiring] ← cross-axis: DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- dependencies_semantic.requires-config.[auth.type] ← cross-axis: the four `*SecurityConfiguration` classes
- dependencies_semantic.requires-runtime.[Postgres schema] ← V0_0_55__add_policies_and_roles.sql + V0_0_56__add_predefined_roles_and_policies.sql
- dependencies_semantic.requires-runtime.[Spring Security context] ← AuthorizationCustomizer.java:24-28 + SecurityConstants.java:169
- tests_coverage_semantic.test_files ← Grep `find odd-platform-api/src/test -name '*Role*.java'` returns empty (2026-05-12)
- docs_link_semantic.inferred_docs.[roles page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles (2026-05-12, 200)
- docs_link_semantic.inferred_docs.[authorization index] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization (2026-05-12, 200)
- docs_link_semantic.inferred_docs.[enable-security overview] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-12, 200)
- docs_link_semantic.doc_drift_findings.[no creation surface documented] ← WebFetch roles page 2026-05-12 + RoleController.java:19-25 + SecurityConstants.java:169
- docs_link_semantic.doc_drift_findings.[predefined-name protection asymmetry] ← RoleServiceImpl.java:51-61 vs. 67-69 + 81-84
- docs_link_semantic.doc_drift_findings.[role rows vs. LDAP/OAuth2 group mapping] ← LDAPSecurityConfiguration.java:91-99 + RoleServiceImpl.java:51-61 + WebFetch roles page 2026-05-12
- docs_link_semantic.doc_drift_findings.[spec-vs-code 201 vs. 200] ← openapi.yaml:3629,3656 + RoleController.java:24,42
- docs_link_semantic.doc_drift_findings.[no audit logging] ← RoleServiceImpl.java:39-92
- implicit_adrs.[uniform SECURITY_RULES gating] ← SecurityConstants.java:169 + parallel structure lines 100-173
- implicit_adrs.[predefined-name mutation-only protection] ← RoleServiceImpl.java:67-69 + 81-84 + V0_0_55__add_policies_and_roles.sql:42
- implicit_adrs.[role-to-policy rewrite-on-update / insert-on-create] ← RoleServiceImpl.java:56-57,112-121
- implicit_adrs.[ReactiveTransactional on all mutating methods] ← RoleServiceImpl.java:50,64,77
- bugs_limitations_corner_cases.[create-side name-protection gap] ← RoleServiceImpl.java:51-61 + 67-69 + 81-84 + V0_0_55__add_policies_and_roles.sql:42 + V0_0_56__add_predefined_roles_and_policies.sql:33-36
- bugs_limitations_corner_cases.[201-vs-200 drift] ← RoleController.java:24,42 + openapi.yaml:3629,3656
- bugs_limitations_corner_cases.[no name validation] ← components.yaml:3368-3379 + RoleServiceImpl.java:51-61
- bugs_limitations_corner_cases.[no policy-id validation] ← RoleServiceImpl.java:57,128-134
- bugs_limitations_corner_cases.[duplicate-name SQL surfacing] ← RoleServiceImpl.java:51-61 + V0_0_55__add_policies_and_roles.sql:42
- bugs_limitations_corner_cases.[no audit logging] ← RoleServiceImpl.java:39-92
- bugs_limitations_corner_cases.[DISABLED mode bypass] ← DisabledAuthSecurityConfiguration.java + SecurityConstants.java:169 + REFACTOR-073
- bugs_limitations_corner_cases.[S2S implicit ADMIN] ← S2sAuthenticationFilter.java:31-39 + SecurityConstants.java:169 + REFACTOR-108
- bugs_limitations_corner_cases.[case-sensitivity mismatch update vs delete] ← RoleServiceImpl.java:68 vs. 82
- bugs_limitations_corner_cases.[no length/charset bounds] ← V0_0_55__add_policies_and_roles.sql + components.yaml:3368-3379 + RoleServiceImpl.java:51-61
- security.auth_mode_relevance ← SecurityConstants.java:169 + DisabledAuthSecurityConfiguration.java + LoginFormSecurityConfiguration.java + OAuthSecurityConfiguration.java + LDAPSecurityConfiguration.java + S2sAuthenticationFilter.java
- security.ingestion_filter_relevance ← SecurityConstants.java:95-96 (WHITELIST_PATHS) + IngestionDataEntitiesFilter (separate node, scoped to /ingestion/entities)
- security.authorization_assertions.[1] ← SecurityConstants.java:169 + AuthorizationCustomizer.java:24-28
- security.authorization_assertions.[2] ← S2sAuthenticationFilter.java:31-39
- security.authorization_assertions.[3] ← DisabledAuthSecurityConfiguration.java + REFACTOR-073
- security.owner_scoping ← RoleServiceImpl.java (no owner-filter calls; cross-axis: RoleController.getRolesList shows admin-vs-user filtering on the LIST path but the CREATE path has no equivalent)
- security.data_exposure.[1] ← RoleController.java:22-24 + RoleServiceImpl.java:59-60 + ReactiveRoleRepositoryImpl.java:42-50
- security.data_exposure.[2] ← RoleServiceImpl.java:51-61 + V0_0_55__add_policies_and_roles.sql:42
- security.data_exposure.[3] ← RoleController.java (getRolesList sibling — cross-axis)
- security.known_security_gaps.[create-side predefined-name asymmetry] ← RoleServiceImpl.java:51-61 + 67-69 + 81-84 + V0_0_56
- security.known_security_gaps.[no audit logging on RBAC mutations] ← RoleServiceImpl.java:39-92
- security.known_security_gaps.[DISABLED mode reachable] ← DisabledAuthSecurityConfiguration.java + REFACTOR-073
- security.known_security_gaps.[S2S implicit ADMIN over RBAC] ← S2sAuthenticationFilter.java:31-39 + REFACTOR-108
- security.known_security_gaps.[no policy-id validation] ← RoleServiceImpl.java:57,128-134
- security.known_security_gaps.[no name length / charset bounds] ← components.yaml:3368-3379 + RoleServiceImpl.java:51-61
- security.known_security_gaps.[no content-type guard beyond framework default] ← RoleController.java:19-25
- security.known_security_gaps.[Role rows vs. LDAP/OAuth2 mapping confusion] ← LDAPSecurityConfiguration.java:91-99 + RoleServiceImpl.java + WebFetch roles page 2026-05-12
- performance.hot_paths.[3-RPC create path] ← RoleServiceImpl.java:51-61
- performance.hot_paths.[O(N rules) gate cost] ← SecurityConstants.java:98-355 + AuthorizationCustomizer.java:22-30
- performance.throughput_characteristics ← RoleController.java:19-25 + openapi.yaml:3601-3636
- performance.resource_allocation.[no timeout] ← RoleServiceImpl.java:51-61
- performance.resource_allocation.[unbounded policies] ← components.yaml:3368-3379 + RoleServiceImpl.java:57
- performance.scaling_characteristics.[stateless] ← RoleController.java:15
- performance.scaling_characteristics.[unique-index race] ← RoleServiceImpl.java:51-61 + V0_0_55__add_policies_and_roles.sql:42
- performance.known_performance_gaps.[no bulk] ← openapi.yaml:3601-3636
- performance.known_performance_gaps.[no policies upper bound] ← components.yaml:3368-3379 + RoleServiceImpl.java:57

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero-coverage statement is Grep-verified against `odd-platform-api/src/test/**/*Role*.java`)
- docs_link_semantic: MEDIUM (inferred docs only — no `@docs` annotation in source; the three inferred URLs WebFetched live and confirmed 200; doc-drift findings are HIGH-confidence because the live page's content was directly compared against the consumer code)
- implicit_adrs: HIGH (each backed by code structure + parallel-sibling pattern across SECURITY_RULES entries and across the three mutating service methods)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line; the policy-id validation gap is MEDIUM because the FK semantics of `role_to_policy` were not verified in this pass — surfaced as suspect, not confirmed)
- security: HIGH (the cross-cutting findings — DISABLED bypass, S2S implicit ADMIN, no audit logging, create-side name asymmetry — are file:line-anchored AND cross-referenced to REFACTOR-073 / REFACTOR-108 from `lineage/odd-platform/refactoring-scopes.md`)
- performance: MEDIUM (the 3-RPC and O(N) statements are HIGH-confidence from code; the timeout default and FK semantics are deferred-confidence — runtime-determined and not verified this pass)

## Maintainer notes

